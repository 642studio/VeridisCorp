import { createServer, type IncomingMessage } from 'node:http';
import { z, ZodError } from 'zod';
import { ContentRuntime } from './service.js';
import type { OfficeRuntime } from './office-runtime.js';
import type { Scheduler } from './scheduler.js';
import { RuntimeError } from './contracts.js';
import { loginWithTotp } from './totp.js';
import { synthesizeElevenLabs, listElevenLabsVoices } from './elevenlabs-proxy.js';

const LoginRequest = z.object({ principalId: z.string().trim().min(1).max(100), code: z.string().trim().regex(/^\d{6}$/) }).strict();
const TtsRequest = z.object({ text: z.string().trim().min(1).max(2000) }).strict();

// 32 KB por defecto; solo la importación de documentos a memoria pide más (maxBytes).
async function body(req: IncomingMessage, maxBytes = 32768): Promise<unknown> {
 if (!req.headers['content-type']?.startsWith('application/json')) throw new RuntimeError(415, 'Se requiere JSON');
 let size = 0; const chunks: Buffer[] = [];
 for await (const chunk of req) {
  size += chunk.length; if (size > maxBytes) throw new RuntimeError(413, 'Solicitud demasiado grande');
  chunks.push(chunk);
 }
 try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
 catch { throw new RuntimeError(400, 'JSON inválido'); }
}
// scheduler puede ser undefined (VERIDIS_SCHEDULER_ENABLED=false): las rutas de abajo siguen
// funcionando igual (crear/editar/borrar tareas programadas en la base), solo que ningún Cron
// real las dispara hasta que el proceso arranque con el flag activo.
export function createRuntimeServer(runtime: ContentRuntime, office?: OfficeRuntime, scheduler?: Scheduler, totpEncryptionKey?: Buffer) {
 const server = createServer(async (req, res) => {
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  try {
   const url = new URL(req.url ?? '/', 'http://localhost');
   const path = url.pathname;
   // Única ruta sin Bearer: intercambia un código de la app de autenticación por una sesión real.
   if (req.method === 'POST' && path === '/auth/login') {
    if (!totpEncryptionKey) throw new RuntimeError(503, 'Login con authenticator app no configurado');
    const { principalId, code } = LoginRequest.parse(await body(req));
    const sessionToken = await loginWithTotp(runtime.pool, totpEncryptionKey, principalId, code);
    res.writeHead(200); res.end(JSON.stringify({ token: sessionToken }));
    return;
   }
   const token = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(req.headers.authorization ?? '')?.[1];
   if (!token) throw new RuntimeError(401, 'Se requiere sesión');
   if (req.method === 'POST' && path === '/tts/elevenlabs') {
    const { text } = TtsRequest.parse(await body(req));
    // Preferencia guardada en CONFIGURACIONES, si existe (ver office-runtime.ts); si no hay
    // office/ habilitado o no hay preferencia, cae al valor fijo por entorno de siempre.
    const voiceOverride = office ? await office.elevenLabsVoiceId(token).catch(() => null) : null;
    const { contentType, body: audioBody } = await synthesizeElevenLabs(runtime.pool, token, text, voiceOverride);
    res.setHeader('content-type', contentType);
    res.writeHead(200);
    res.end(audioBody);
    return;
   }
   if (req.method === 'GET' && path === '/tts/elevenlabs/voices') {
    const voices = await listElevenLabsVoices(runtime.pool, token);
    res.writeHead(200); res.end(JSON.stringify({ voices }));
    return;
   }
   let result: unknown;
   if (req.method === 'POST' && path === '/runs') result = await runtime.start(token, await body(req));
   else if (req.method === 'GET' && path === '/runs') {
    const status = url.searchParams.get('status');
    const limit = url.searchParams.get('limit');
    const cursor = url.searchParams.get('cursor');
    result = await runtime.list(token, {
     ...(status ? { status: status.split(',').map((s) => s.trim()) } : {}),
     limit: limit === null ? 20 : Number(limit),
     ...(cursor ? { cursor } : {}),
    });
   } else if (req.method === 'GET' && path === '/organization') {
    result = await runtime.organization(token);
   } else if (req.method === 'GET' && /^\/agents\/[a-zA-Z0-9][a-zA-Z0-9._:-]{0,119}$/.test(path)) {
    result = await runtime.agent(token, path.slice('/agents/'.length));
   } else if (office && req.method === 'POST' && path === '/office/orders') {
    result = await office.start(token, await body(req));
   } else if (office && req.method === 'GET' && path === '/office/orders') {
    result = await office.list(token);
   } else if (office && /^\/office\/orders\/([0-9a-f-]{36})(?:\/(advance|answer))?$/.test(path)) {
    const officeMatch = /^\/office\/orders\/([0-9a-f-]{36})(?:\/(advance|answer))?$/.exec(path)!;
    const id = officeMatch[1]!; const action = officeMatch[2];
    if (req.method === 'GET' && !action) result = await office.get(token, id);
    else if (req.method === 'POST' && action === 'advance') result = await office.advance(token, id);
    else if (req.method === 'POST' && action === 'answer') result = await office.answer(token, id, await body(req));
    else throw new RuntimeError(405, 'Método no disponible');
   } else if (office && req.method === 'GET' && /^\/office\/files\/([0-9a-f-]{36})$/.test(path)) {
    // Primera ruta binaria del servidor: todo lo demás termina en res.end(JSON.stringify(...))
    // con content-type: application/json fijo (ver arriba); aquí lo sobreescribimos y salimos
    // antes de llegar a ese camino genérico.
    const fileId = /^\/office\/files\/([0-9a-f-]{36})$/.exec(path)![1]!;
    const file = await office.getFile(token, fileId);
    res.setHeader('content-type', file.contentType);
    res.setHeader('content-disposition', `attachment; filename="${file.filename.replace(/[\\"]/g, '_')}"`);
    res.writeHead(200);
    res.end(file.content);
    return;
   } else if (office && req.method === 'POST' && path === '/office/assistant/ask') {
    result = await office.ask(token, await body(req));
   } else if (office && req.method === 'GET' && path === '/office/assistant/threads') {
    result = await office.assistantThreads(token);
   } else if (office && req.method === 'GET' && /^\/office\/assistant\/threads\/([0-9a-f-]{36})$/.test(path)) {
    result = await office.assistantThread(token, /^\/office\/assistant\/threads\/([0-9a-f-]{36})$/.exec(path)![1]!);
   } else if (office && req.method === 'POST' && path === '/office/memory/import/plan') {
    result = await office.planMemoryImport(token, await body(req, 1024 * 1024));
   } else if (office && req.method === 'POST' && path === '/office/memory/import/section') {
    result = await office.ingestMemorySection(token, await body(req, 64 * 1024));
   } else if (office && req.method === 'GET' && path === '/office/memory/graph') {
    result = await office.memoryGraph(token);
   } else if (office && req.method === 'GET' && path === '/office/memory') {
    result = await office.listMemory(token, url.searchParams.get('status'));
   } else if (office && req.method === 'POST' && /^\/office\/memory\/([0-9a-f-]{36})\/validate$/.test(path)) {
    result = await office.validateMemory(token, /^\/office\/memory\/([0-9a-f-]{36})\/validate$/.exec(path)![1]!);
   } else if (office && req.method === 'POST' && /^\/office\/memory\/([0-9a-f-]{36})\/quarantine$/.test(path)) {
    result = await office.quarantineMemory(token, /^\/office\/memory\/([0-9a-f-]{36})\/quarantine$/.exec(path)![1]!, await body(req));
   } else if (office && req.method === 'GET' && path === '/office/usage') {
   result = await office.usage(token);
  } else if (office && req.method === 'GET' && path === '/office/settings') {
   result = await office.settings(token);
  } else if (office && req.method === 'POST' && path === '/office/settings/elevenlabs-voice') {
   result = await office.setElevenLabsVoice(token, await body(req));
  } else if (office && req.method === 'GET' && path === '/office/connections') {
    result = await office.listConnections(token);
   } else if (office && req.method === 'POST' && path === '/office/connections') {
    result = await office.addConnection(token, await body(req));
   } else if (office && /^\/office\/connections\/([0-9a-f-]{36})\/(refresh|credential|tools|confirm|remove)$/.test(path)) {
    const [, id, action] = /^\/office\/connections\/([0-9a-f-]{36})\/(refresh|credential|tools|confirm|remove)$/.exec(path)!;
    if (req.method !== 'POST') throw new RuntimeError(405, 'Método no disponible');
    if (action === 'refresh') result = await office.refreshConnection(token, id!);
    else if (action === 'credential') result = await office.setConnectionCredential(token, id!, await body(req));
    else if (action === 'tools') result = await office.setConnectionTools(token, id!, await body(req));
    else if (action === 'confirm') result = await office.confirmConnection(token, id!);
    else result = await office.removeConnection(token, id!);
   } else if (office && req.method === 'POST' && path === '/office/schedules') {
    result = await office.createSchedule(token, await body(req));
    scheduler?.register({ id: (result as { id: string }).id, cron_expression: (result as { cronExpression: string }).cronExpression, timezone: (result as { timezone: string }).timezone });
   } else if (office && req.method === 'GET' && path === '/office/schedules') {
    result = await office.listSchedules(token);
   } else if (office && /^\/office\/schedules\/([0-9a-f-]{36})(?:\/(update|delete|fire))?$/.test(path)) {
    const scheduleMatch = /^\/office\/schedules\/([0-9a-f-]{36})(?:\/(update|delete|fire))?$/.exec(path)!;
    const id = scheduleMatch[1]!; const action = scheduleMatch[2];
    if (req.method === 'GET' && !action) result = await office.getSchedule(token, id);
    else if (req.method === 'POST' && action === 'update') {
     result = await office.updateSchedule(token, id, await body(req));
     const r = result as { enabled: boolean; cronExpression: string; timezone: string };
     if (r.enabled) scheduler?.register({ id, cron_expression: r.cronExpression, timezone: r.timezone });
     else scheduler?.unregister(id);
    } else if (req.method === 'POST' && action === 'delete') {
     result = await office.deleteSchedule(token, id);
     scheduler?.unregister(id);
    } else if (req.method === 'POST' && action === 'fire') result = await office.fireSchedule(token, id);
    else throw new RuntimeError(405, 'Método no disponible');
   } else {
    const match = /^\/runs\/([0-9a-f-]{36})(?:\/(advance|revise|approve|execute|reconcile|regenerate))?$/.exec(path);
    if (!match) throw new RuntimeError(404, 'Ruta no disponible');
    const id = match[1]!; const action = match[2];
    if (req.method === 'GET' && !action) result = await runtime.get(token, id);
    else if (req.method === 'POST') {
     switch (action) {
      case 'advance': result = await runtime.advance(token, id); break;
      case 'revise': result = await runtime.revise(token, id, await body(req)); break;
      case 'approve': result = await runtime.approve(token, id, await body(req)); break;
      case 'execute': result = await runtime.execute(token, id); break;
      case 'reconcile': result = await runtime.reconcile(token, id); break;
      case 'regenerate': result = await runtime.regenerate(token, id); break;
      default: throw new RuntimeError(404, 'Ruta no disponible');
     }
    } else throw new RuntimeError(405, 'Método no disponible');
   }
   res.writeHead(200); res.end(JSON.stringify(result));
  } catch (error) {
   if (!(error instanceof RuntimeError) && !(error instanceof ZodError)) {
    process.stderr.write(`Error inesperado en ${req.method} ${req.url}: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`);
   }
   const token = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(req.headers.authorization ?? '')?.[1];
   if (token) await runtime.recordRejected(token, error instanceof RuntimeError ? String(error.status) : error instanceof ZodError ? 'invalid_contract' : 'invalid_transition');
   res.writeHead(error instanceof RuntimeError ? error.status : error instanceof ZodError ? 400 : 409);
   res.end(JSON.stringify({ error: error instanceof RuntimeError ? error.message : error instanceof ZodError ? 'Solicitud o contrato inválido' : 'La operación no está permitida en su estado actual' }));
  }
 });
 server.requestTimeout = 65000; server.headersTimeout = 10000;
 return server;
}
