import { BlockList, isIP } from 'node:net';
import { lookup } from 'node:dns/promises';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { redactSecrets } from './repo-tools.js';

// Cliente MCP de bajo nivel (sin base de datos): validar la URL, conectarse por HTTP (Streamable
// HTTP y, si el servidor es antiguo, SSE), leer qué ofrece y llamar una herramienta. Solo
// transportes remotos: un servidor MCP local por stdio ejecuta un comando en esta máquina, y eso
// nunca lo decide un agente (queda fuera a propósito; ver docs/office-architecture.md).

// read: el servidor declara que solo lee (readOnlyHint); write: declara que escribe o borra;
// unknown: no declara nada (muchos servidores reales, p. ej. DeepWiki). Solo 'read' nace activa.
export type McpAccessLevel = 'read' | 'write' | 'unknown';
export type McpToolInfo = {
  name: string; title: string | null; description: string;
  inputSchema: Record<string, unknown>; access: McpAccessLevel;
};
export type McpServerInfo = {
  name: string | null; version: string | null; instructions: string | null;
  transport: 'streamable-http' | 'sse';
};
export type McpCredential = { headerName: string; value: string };

export type McpErrorKind = 'auth' | 'blocked' | 'network' | 'protocol';
export class McpConnectError extends Error {
  constructor(message: string, readonly kind: McpErrorKind) { super(message); }
}

// Quién pide la conexión cambia qué se permite: un agente solo llega a https público (no a la red
// interna, ni a la nube de metadatos, ni a localhost); un humano puede conectar su propio n8n en la
// LAN o por Tailscale.
export type McpOrigin = 'agent' | 'human';

const BLOCKED = new BlockList();
for (const [net, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15],
  ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
] as const) BLOCKED.addSubnet(net, prefix, 'ipv4');
for (const [net, prefix] of [
  ['::', 128], ['::1', 128], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8], ['64:ff9b::', 96], ['2001:db8::', 32],
] as const) BLOCKED.addSubnet(net, prefix, 'ipv6');

export function isPrivateAddress(address: string): boolean {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
  if (mapped) return BLOCKED.check(mapped[1]!, 'ipv4');
  const family = isIP(address);
  if (family === 4) return BLOCKED.check(address, 'ipv4');
  if (family === 6) return BLOCKED.check(address, 'ipv6');
  return true;
}

// Forma de la URL, sin red. Nunca usuario:clave dentro de la URL: para eso está la credencial
// cifrada (si no, quedaría en claro en la tabla y en la memoria).
export function parseMcpUrl(raw: string, origin: McpOrigin): URL {
  let url: URL;
  try { url = new URL(raw.trim()); } catch { throw new McpConnectError('La URL del servidor MCP no es válida', 'blocked'); }
  if (url.username || url.password) throw new McpConnectError('La URL no puede llevar usuario ni contraseña; usa una credencial', 'blocked');
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new McpConnectError('Solo se admiten servidores MCP por http o https', 'blocked');
  const strict = origin === 'agent' && !allowPrivateForAgents;
  if (strict && url.protocol !== 'https:') throw new McpConnectError('Un agente solo puede conectar servidores MCP por https', 'blocked');
  if (strict && (url.hostname === 'localhost' || url.hostname.endsWith('.localhost') || url.hostname.endsWith('.local') || url.hostname.endsWith('.internal'))) {
    throw new McpConnectError('Un agente no puede conectar servidores de la red interna', 'blocked');
  }
  return url;
}

// Lo que se muestra en memoria y prompts: sin query string (algunos servidores ponen ahí su llave).
export function displayMcpUrl(raw: string): string {
  try { const url = new URL(raw); return `${url.origin}${url.pathname}`; } catch { return raw.slice(0, 200); }
}

// Pruebas: permite a un "agente" llegar a un servidor MCP de prueba en 127.0.0.1.
let allowPrivateForAgents = false;
export function allowPrivateMcpForTests(value: boolean): void { allowPrivateForAgents = value; }

async function assertPublicHost(url: URL): Promise<void> {
  if (allowPrivateForAgents) return;
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(host) ? [host] : (await lookup(host, { all: true }).catch(() => {
    throw new McpConnectError(`No se pudo resolver ${host}`, 'network');
  })).map((entry) => entry.address);
  if (!addresses.length || addresses.some(isPrivateAddress)) {
    throw new McpConnectError('Un agente no puede conectar servidores de la red interna', 'blocked');
  }
}

// Cada petición (no solo la primera) vuelve a comprobar el host: el SDK no sigue redirecciones a
// otro origen (redirectPolicy por defecto), y esto cubre que el mismo nombre cambie de IP entre
// llamadas. Queda la ventana mínima entre esta resolución y la de fetch (documentado).
function guardedFetch(origin: McpOrigin): typeof fetch {
  return async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (origin === 'agent') await assertPublicHost(url);
    return fetch(input, init);
  };
}

function headersFor(credential: McpCredential | null): Record<string, string> {
  if (!credential) return {};
  const name = credential.headerName.trim() || 'Authorization';
  const value = name.toLowerCase() === 'authorization' && !/\s/.test(credential.value.trim())
    ? `Bearer ${credential.value.trim()}` : credential.value.trim();
  return { [name]: value };
}

function classify(error: unknown): McpConnectError {
  if (error instanceof McpConnectError) return error;
  const code = (error as { code?: unknown }).code;
  const message = error instanceof Error ? error.message : String(error);
  if (code === 401 || code === 403 || /\b(401|403)\b|unauthori[sz]ed|forbidden|invalid_token/i.test(message)) {
    return new McpConnectError('El servidor pide credencial (401/403)', 'auth');
  }
  if (/fetch failed|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|timed? ?out|aborted|EAI_AGAIN/i.test(message)) {
    return new McpConnectError(`No se pudo llegar al servidor: ${message.slice(0, 200)}`, 'network');
  }
  return new McpConnectError(`El servidor no respondió como un servidor MCP: ${redactSecrets(message).slice(0, 300)}`, 'protocol');
}

export type McpTarget = { url: string; origin: McpOrigin; credential: McpCredential | null; timeoutMs?: number };

async function withSession<T>(target: McpTarget, work: (client: Client, transport: McpServerInfo['transport']) => Promise<T>): Promise<T> {
  const url = parseMcpUrl(target.url, target.origin);
  if (target.origin === 'agent') await assertPublicHost(url);
  const timeout = target.timeoutMs ?? 20000;
  const requestInit: RequestInit = { headers: headersFor(target.credential) };
  const attempts: [McpServerInfo['transport'], () => Transport][] = [
    ['streamable-http', () => new StreamableHTTPClientTransport(url, { requestInit, fetch: guardedFetch(target.origin) })],
    ['sse', () => new SSEClientTransport(url, { requestInit, fetch: guardedFetch(target.origin) })],
  ];
  let firstError: McpConnectError | null = null;
  for (const [kind, makeTransport] of attempts) {
    const client = new Client({ name: 'veridiscorp', version: '1.0.0' });
    try {
      await client.connect(makeTransport(), { timeout });
    } catch (error) {
      await client.close().catch(() => undefined);
      const classified = classify(error);
      firstError ??= classified;
      // Credencial o URL bloqueada: probar el otro transporte no cambia nada.
      if (classified.kind === 'auth' || classified.kind === 'blocked') throw classified;
      continue;
    }
    try { return await work(client, kind); }
    catch (error) { throw classify(error); }
    finally { await client.close().catch(() => undefined); }
  }
  throw firstError ?? new McpConnectError('No se pudo conectar al servidor MCP', 'network');
}

const MAX_TOOLS = 100;
const MAX_SCHEMA_CHARS = 8000;

// Qué es y qué ofrece el servidor. Todo lo que dice de sí mismo (nombre, instrucciones,
// descripciones) es dato externo: se recorta aquí y se presenta siempre como tal.
export async function inspectMcpServer(target: McpTarget): Promise<{ server: McpServerInfo; tools: McpToolInfo[] }> {
  return withSession(target, async (client, transport) => {
    const tools: McpToolInfo[] = [];
    let cursor: string | undefined;
    do {
      const page = await client.listTools(cursor ? { cursor } : undefined, { timeout: target.timeoutMs ?? 20000 });
      for (const tool of page.tools) {
        if (tools.length >= MAX_TOOLS) break;
        const schemaText = JSON.stringify(tool.inputSchema ?? {});
        tools.push({
          name: tool.name.slice(0, 120),
          title: (tool.title ?? tool.annotations?.title ?? null)?.slice(0, 120) ?? null,
          description: redactSecrets((tool.description ?? '').replace(/\s+/g, ' ').trim()).slice(0, 500),
          inputSchema: schemaText.length <= MAX_SCHEMA_CHARS ? (tool.inputSchema as Record<string, unknown>) : { type: 'object' },
          // Solo lo que el servidor declara de lectura cuenta como tal; sin declarar, no se asume nada.
          access: tool.annotations?.readOnlyHint === true ? 'read'
            : tool.annotations?.readOnlyHint === false || tool.annotations?.destructiveHint === true ? 'write' : 'unknown',
        });
      }
      cursor = tools.length < MAX_TOOLS ? page.nextCursor : undefined;
    } while (cursor);
    const version = client.getServerVersion();
    const instructions = client.getInstructions();
    return {
      server: {
        name: version?.name?.slice(0, 120) ?? null, version: version?.version?.slice(0, 40) ?? null,
        instructions: instructions ? redactSecrets(instructions.replace(/\s+/g, ' ').trim()).slice(0, 600) : null,
        transport,
      },
      tools,
    };
  });
}

const MAX_OUTPUT = 12000;

type ContentPart = { type: string; text?: string; uri?: string; resource?: { uri?: string; text?: string } };
export function renderMcpContent(content: unknown, structured: unknown): string {
  const parts = Array.isArray(content) ? content as ContentPart[] : [];
  const text = parts.map((part) => {
    if (part.type === 'text') return part.text ?? '';
    if (part.type === 'resource') return part.resource?.text ?? `[recurso: ${part.resource?.uri ?? 'sin uri'}]`;
    if (part.type === 'resource_link') return `[enlace: ${part.uri ?? ''}]`;
    return `[${part.type} omitido]`;
  }).join('\n').trim();
  const body = text || (structured !== undefined ? JSON.stringify(structured) : '');
  const safe = redactSecrets(body);
  return safe.length > MAX_OUTPUT ? `${safe.slice(0, MAX_OUTPUT)}\n… [recortado: ${safe.length - MAX_OUTPUT} caracteres más]` : safe || '(sin contenido)';
}

export async function callMcpTool(target: McpTarget, tool: string, args: Record<string, unknown>): Promise<{ isError: boolean; text: string }> {
  return withSession({ ...target, timeoutMs: target.timeoutMs ?? 60000 }, async (client) => {
    const result = await client.callTool({ name: tool, arguments: args }, undefined, { timeout: target.timeoutMs ?? 60000 });
    return { isError: result.isError === true, text: renderMcpContent(result.content, result.structuredContent) };
  });
}
