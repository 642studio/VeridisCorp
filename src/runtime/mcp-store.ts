import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { Ajv, type ValidateFunction } from 'ajv';
import type { AccessScope, Principal } from '../governance/contracts.js';
import { scopeKey } from './database.js';
import { decryptSecret, encryptSecret } from './secrets.js';
import type { MemoryStore } from './memory-store.js';
import { RuntimeError } from './contracts.js';
import {
  callMcpTool, displayMcpUrl, inspectMcpServer, parseMcpUrl, McpConnectError,
  type McpCredential, type McpServerInfo, type McpToolInfo, type McpOrigin,
} from '../office/mcp-client.js';

// Conexiones MCP de la empresa y lo que la empresa sabe de ellas. Cada conexión tiene una memoria
// corporativa propia (entityType "integration", entityId "mcp-<nombre>") que el motor reescribe en
// cada cambio: qué es, para qué sirve, qué herramientas ofrece y cuáles están activas, quién la
// conectó y en qué estado está. Así cualquier agente o el chat la encuentran por significado más
// adelante ("¿tenemos algo para leer la documentación de un repo?") aunque nadie recuerde su nombre.

export type McpStatus = 'active' | 'needs_auth' | 'error' | 'requested' | 'removed';
export type McpTrust = 'confirmed' | 'unconfirmed';
// accessSetBy 'human': el servidor no declaró si la herramienta escribe y un humano lo decidió (solo
// en ese caso se permite). Con 'read', el revisor puede volver a llamarla para verificar.
export type McpStoredTool = McpToolInfo & { enabled: boolean; accessSetBy?: 'server' | 'human' };
export type McpActor = { principal: Principal; orderId?: string | null };
export type McpConnection = {
  id: string; name: string; url: string | null; displayUrl: string | null; status: McpStatus; trust: McpTrust;
  purpose: string; addedBy: Principal; originOrderId: string | null; server: McpServerInfo | null;
  tools: McpStoredTool[]; hasCredential: boolean; memoryId: string | null; lastError: string | null;
  lastCheckedAt: string | null; callCount: number; lastUsedAt: string | null; createdAt: string; updatedAt: string;
};

type Row = {
  id: string; name: string; url: string | null; status: McpStatus; trust: McpTrust; purpose: string;
  added_by: Principal; origin_order_id: string | null; server: McpServerInfo | null; tools: McpStoredTool[];
  credential_encrypted: Buffer | null; memory_id: string | null; last_error: string | null;
  last_checked_at: Date | null; call_count: number; last_used_at: Date | null; created_at: Date; updated_at: Date;
};

const shape = (row: Row): McpConnection => ({
  id: row.id, name: row.name, url: row.url, displayUrl: row.url ? displayMcpUrl(row.url) : null,
  status: row.status, trust: row.trust, purpose: row.purpose, addedBy: row.added_by, originOrderId: row.origin_order_id,
  server: row.server, tools: row.tools ?? [], hasCredential: row.credential_encrypted !== null, memoryId: row.memory_id,
  lastError: row.last_error, lastCheckedAt: row.last_checked_at?.toISOString() ?? null, callCount: row.call_count,
  lastUsedAt: row.last_used_at?.toISOString() ?? null, createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString(),
});

export function normalizeConnectionName(raw: string): string {
  const name = raw.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  if (!name) throw new RuntimeError(400, 'El nombre de la conexión no es válido');
  return name;
}

const ACCESS_TEXT: Record<McpToolInfo['access'], string> = { read: 'lectura', write: 'escribe', unknown: 'no declara si escribe' };
const accessText = (t: McpStoredTool) => `${ACCESS_TEXT[t.access]}${t.accessSetBy === 'human' ? ', según un humano' : ''}`;
const STATUS_TEXT: Record<McpStatus, string> = {
  active: 'activa', needs_auth: 'requiere credencial', error: 'con error', requested: 'solicitada, sin conectar todavía', removed: 'retirada',
};

// Texto de la memoria de una conexión. Determinista (sin modelo): lo que la empresa sabe de una
// conexión debe salir de lo que de verdad se observó al conectarse, no de un resumen que pueda
// inventar. Las palabras del servidor van entre comillas angulares: son su descripción, no un hecho.
export function connectionMemoryContent(conn: McpConnection, when = new Date()): string {
  const who = conn.addedBy.kind === 'human' ? `${conn.addedBy.id} (humano)` : `el agente ${conn.addedBy.id}`;
  const date = when.toISOString().slice(0, 10);
  const lines = [`Conexión MCP «${conn.name}» (integración externa)${conn.displayUrl ? `, ${conn.displayUrl}` : ''}: ${STATUS_TEXT[conn.status]}.`];
  lines.push(`Para qué sirve, según quien la conectó: ${conn.purpose}`);
  if (conn.server?.name) lines.push(`El servidor se identifica como «${conn.server.name}»${conn.server.version ? ` v${conn.server.version}` : ''}.`);
  if (conn.server?.instructions) lines.push(`El servidor se describe así: «${conn.server.instructions.slice(0, 400)}»`);
  const enabled = conn.tools.filter((t) => t.enabled);
  const off = conn.tools.filter((t) => !t.enabled);
  if (enabled.length) {
    lines.push(`Herramientas activas: ${enabled.map((t) => `${t.name} (${accessText(t)}${t.description ? `: ${t.description.slice(0, 140)}` : ''})`).join('; ')}.`);
  }
  if (off.length) lines.push(`Herramientas apagadas hasta que un humano las active: ${off.map((t) => `${t.name} (${accessText(t)}${t.description ? `: ${t.description.slice(0, 100)}` : ''})`).join('; ')}.`);
  if (conn.status === 'needs_auth') lines.push('Falta una credencial: un humano debe agregarla en Conexiones para poder usarla.');
  if (conn.status === 'error' && conn.lastError) lines.push(`Último error al conectar: ${conn.lastError}`);
  if (conn.status === 'requested') lines.push('Falta la URL del servidor: un humano o un agente con mcp.connect debe completarla.');
  if (conn.status === 'removed') lines.push('Ya no está disponible para los agentes.');
  lines.push(`${conn.status === 'requested' ? 'Solicitada' : 'Conectada'} por ${who} el ${date}${conn.originOrderId ? ` en el expediente ${conn.originOrderId}` : ''}`
    + `${conn.trust === 'confirmed' ? '; confirmada por un humano' : `; sin confirmar por un humano${conn.status === 'active' ? ' (ya se puede usar; la confirmación es una revisión posterior)' : ''}`}.`);
  if (conn.status === 'active') lines.push(`Se usa con mcp_call (conexión "${conn.name}") desde los puestos con mcp.use.`);
  return lines.join('\n');
}

const ajv = new Ajv({ strict: false, allErrors: false, validateSchema: false });
// Ajv guarda cada esquema compilado por identidad del objeto, y el que viene de la base es un objeto
// nuevo en cada llamada: se compila una sola vez por texto de esquema. Un esquema que Ajv no entiende
// no bloquea la llamada (el servidor valida igual); solo se pierde esta validación previa.
const validators = new Map<string, ValidateFunction | null>();
function validatorFor(schema: Record<string, unknown>): ValidateFunction | null {
  const key = JSON.stringify(schema);
  if (!validators.has(key)) {
    if (validators.size > 500) validators.clear();
    try { validators.set(key, ajv.compile(schema)); } catch { validators.set(key, null); }
  }
  return validators.get(key) ?? null;
}

export class McpStore {
  constructor(
    private readonly pool: Pool,
    private readonly memory: MemoryStore | null,
    // VERIDIS_TOKEN_ENCRYPTION_KEY: sin ella se puede conectar todo lo que no pida credencial.
    private readonly encryptionKey: Buffer | null,
  ) {}

  private async row(scope: AccessScope, where: { id?: string; name?: string }): Promise<Row | null> {
    const { rows } = where.id
      ? await this.pool.query<Row>('SELECT * FROM veridis_runtime_v1.mcp_connections WHERE scope_key=$1 AND id=$2', [scopeKey(scope), where.id])
      : await this.pool.query<Row>(`SELECT * FROM veridis_runtime_v1.mcp_connections WHERE scope_key=$1 AND name=$2 AND status <> 'removed'`, [scopeKey(scope), where.name]);
    return rows[0] ?? null;
  }
  private async requireRow(scope: AccessScope, id: string): Promise<Row> {
    const row = await this.row(scope, { id });
    if (!row) throw new RuntimeError(404, 'Conexión no disponible');
    return row;
  }
  private credentialOf(row: Row): McpCredential | null {
    if (!row.credential_encrypted) return null;
    if (!this.encryptionKey) throw new McpConnectError('La conexión tiene credencial pero falta VERIDIS_TOKEN_ENCRYPTION_KEY', 'auth');
    return JSON.parse(decryptSecret(row.credential_encrypted, this.encryptionKey)) as McpCredential;
  }
  private originOf(row: Row): McpOrigin { return row.added_by.kind === 'human' ? 'human' : 'agent'; }

  async audit(scope: AccessScope, actor: McpActor, event: string, details: Record<string, unknown>): Promise<void> {
    await this.pool.query('INSERT INTO veridis_runtime_v1.audit(run_id,scope_key,data) VALUES($1,$2,$3)',
      [actor.orderId ?? null, scopeKey(scope), { principal: actor.principal, event, ...details }]);
  }

  async list(scope: AccessScope, options: { includeRemoved?: boolean } = {}): Promise<McpConnection[]> {
    const { rows } = await this.pool.query<Row>(
      `SELECT * FROM veridis_runtime_v1.mcp_connections WHERE scope_key=$1 ${options.includeRemoved ? '' : "AND status <> 'removed'"} ORDER BY created_at`,
      [scopeKey(scope)]);
    return rows.map(shape);
  }
  async get(scope: AccessScope, id: string): Promise<McpConnection> { return shape(await this.requireRow(scope, id)); }
  async getByName(scope: AccessScope, name: string): Promise<McpConnection | null> {
    const row = await this.row(scope, { name: normalizeConnectionName(name) });
    return row ? shape(row) : null;
  }

  // Conectar (o dejar solicitada, sin URL). Un nombre ya usado se reutiliza si es la misma URL o si
  // estaba solicitada / sin credencial / con error (completar lo pendiente); una URL distinta para
  // una conexión activa exige otro nombre — así nadie redirige en silencio una conexión que otros usan.
  async connect(scope: AccessScope, input: { name: string; url: string | null; purpose: string; credential?: McpCredential | null }, actor: McpActor): Promise<McpConnection> {
    const name = normalizeConnectionName(input.name);
    const origin: McpOrigin = actor.principal.kind === 'human' ? 'human' : 'agent';
    const url = input.url?.trim() ? parseMcpUrl(input.url, origin).toString() : null;
    if (input.credential && !this.encryptionKey) throw new RuntimeError(409, 'Guardar una credencial requiere VERIDIS_TOKEN_ENCRYPTION_KEY');
    const existing = await this.row(scope, { name });
    if (existing && existing.status === 'active' && url && existing.url !== url) {
      throw new RuntimeError(409, `Ya existe la conexión activa «${name}» con otra URL; usa otro nombre`);
    }
    // Un agente no rebaja algo ya conectado: si la conexión existe activa y no trae URL, solo se lee.
    if (existing && !url && existing.status !== 'requested') return shape(existing);
    const id = existing?.id ?? randomUUID();
    const credential = input.credential
      ? encryptSecret(JSON.stringify(input.credential), this.encryptionKey!)
      : existing?.credential_encrypted ?? null;
    // Quien pone la URL es el autor de la conexión, y eso decide las reglas de red al conectarse: si
    // un agente completa una solicitud humana con su propia URL, se le aplican las de un agente.
    const newUrl = Boolean(url && url !== existing?.url);
    const addedBy = !existing || newUrl || (origin === 'human' && existing.added_by.kind !== 'human') ? actor.principal : existing.added_by;
    const trust: McpTrust = origin === 'human' || (!newUrl && existing?.trust === 'confirmed') ? 'confirmed' : 'unconfirmed';
    // El propósito que dejó un humano no lo reescribe un agente.
    const purpose = (origin === 'agent' && existing?.added_by.kind === 'human' && existing.purpose)
      || input.purpose.trim() || existing?.purpose || 'Sin propósito indicado';
    if (existing) {
      await this.pool.query(
        `UPDATE veridis_runtime_v1.mcp_connections SET url=$3, purpose=$4, trust=$5, added_by=$6, credential_encrypted=$7, updated_at=clock_timestamp()
         WHERE scope_key=$1 AND id=$2`,
        [scopeKey(scope), id, url ?? existing.url, purpose, trust, addedBy, credential]);
    } else {
      await this.pool.query(
        `INSERT INTO veridis_runtime_v1.mcp_connections(id, scope_key, name, url, status, trust, purpose, added_by, origin_order_id, credential_encrypted)
         VALUES($1,$2,$3,$4,'requested',$5,$6,$7,$8,$9)`,
        [id, scopeKey(scope), name, url, trust, purpose, addedBy, actor.orderId ?? null, credential]);
    }
    await this.audit(scope, actor, url ? 'mcp.connect_requested' : 'mcp.requested', { connectionId: id, name, url: url ? displayMcpUrl(url) : null });
    if (!url && !existing?.url) return this.remember(scope, shape(await this.requireRow(scope, id)), actor);
    return this.refresh(scope, id, actor);
  }

  // Vuelve a leer qué ofrece el servidor. Lo que un humano activó o apagó se conserva por nombre;
  // una herramienta nueva entra con la regla por defecto: lectura activa, escritura apagada.
  async refresh(scope: AccessScope, id: string, actor: McpActor): Promise<McpConnection> {
    const row = await this.requireRow(scope, id);
    if (row.status === 'removed') throw new RuntimeError(409, 'La conexión está retirada');
    if (!row.url) throw new RuntimeError(409, 'La conexión todavía no tiene URL');
    let status: McpStatus = 'active'; let lastError: string | null = null;
    let server = row.server; let tools = row.tools ?? [];
    try {
      const inspected = await inspectMcpServer({ url: row.url, origin: this.originOf(row), credential: this.credentialOf(row) });
      const previous = new Map(tools.map((t) => [t.name, t]));
      server = inspected.server;
      tools = inspected.tools.map((t) => {
        const before = previous.get(t.name);
        // Lo que un humano decidió sobre una herramienta que el servidor sigue sin declarar se conserva.
        const access = t.access === 'unknown' && before?.accessSetBy === 'human' ? before.access : t.access;
        return { ...t, access, accessSetBy: access === t.access ? 'server' as const : 'human' as const, enabled: before?.enabled ?? access === 'read' };
      });
    } catch (error) {
      const failure = error instanceof McpConnectError ? error : new McpConnectError(error instanceof Error ? error.message : 'error', 'protocol');
      status = failure.kind === 'auth' ? 'needs_auth' : 'error';
      lastError = failure.message.slice(0, 500);
    }
    const { rows } = await this.pool.query<Row>(
      `UPDATE veridis_runtime_v1.mcp_connections SET status=$3, server=$4, tools=$5, last_error=$6, last_checked_at=clock_timestamp(), updated_at=clock_timestamp()
       WHERE scope_key=$1 AND id=$2 RETURNING *`,
      [scopeKey(scope), id, status, server, JSON.stringify(tools), lastError]);
    await this.audit(scope, actor, 'mcp.inspected', { connectionId: id, name: row.name, status, tools: tools.length, error: lastError });
    return this.remember(scope, shape(rows[0]!), actor);
  }

  // Decisión humana: qué herramientas pueden usar los agentes (las que escriben nacen apagadas).
  async setTools(scope: AccessScope, id: string, change: { enabled?: Record<string, boolean>; access?: Record<string, 'read' | 'write'> }, actor: McpActor): Promise<McpConnection> {
    const row = await this.requireRow(scope, id);
    const enabled = change.enabled ?? {};
    const access = change.access ?? {};
    const byName = new Map((row.tools ?? []).map((t) => [t.name, t]));
    const unknown = [...Object.keys(enabled), ...Object.keys(access)].filter((name) => !byName.has(name));
    if (unknown.length) throw new RuntimeError(400, `Herramientas desconocidas: ${[...new Set(unknown)].join(', ')}`);
    // Solo se clasifica lo que el servidor no declaró: si el servidor dice que escribe, un humano no lo contradice aquí.
    const declared = Object.keys(access).filter((name) => byName.get(name)!.accessSetBy !== 'human' && byName.get(name)!.access !== 'unknown');
    if (declared.length) throw new RuntimeError(400, `El servidor ya declara si estas herramientas escriben: ${declared.join(', ')}`);
    const tools = (row.tools ?? []).map((t) => ({
      ...t, enabled: enabled[t.name] ?? t.enabled,
      ...(access[t.name] ? { access: access[t.name]!, accessSetBy: 'human' as const } : {}),
    }));
    const { rows } = await this.pool.query<Row>(
      'UPDATE veridis_runtime_v1.mcp_connections SET tools=$3, updated_at=clock_timestamp() WHERE scope_key=$1 AND id=$2 RETURNING *',
      [scopeKey(scope), id, JSON.stringify(tools)]);
    await this.audit(scope, actor, 'mcp.tools_changed', { connectionId: id, name: row.name, enabled, access });
    return this.remember(scope, shape(rows[0]!), actor);
  }

  async setCredential(scope: AccessScope, id: string, credential: McpCredential | null, actor: McpActor): Promise<McpConnection> {
    const row = await this.requireRow(scope, id);
    if (credential && !this.encryptionKey) throw new RuntimeError(409, 'Guardar una credencial requiere VERIDIS_TOKEN_ENCRYPTION_KEY');
    await this.pool.query(
      'UPDATE veridis_runtime_v1.mcp_connections SET credential_encrypted=$3, updated_at=clock_timestamp() WHERE scope_key=$1 AND id=$2',
      [scopeKey(scope), id, credential ? encryptSecret(JSON.stringify(credential), this.encryptionKey!) : null]);
    await this.audit(scope, actor, credential ? 'mcp.credential_set' : 'mcp.credential_cleared', { connectionId: id, name: row.name });
    return row.url ? this.refresh(scope, id, actor) : shape(await this.requireRow(scope, id));
  }

  // Confirmación humana de una conexión que hizo un agente: la conexión y su memoria pasan a confirmadas.
  async confirm(scope: AccessScope, id: string, actor: McpActor): Promise<McpConnection> {
    const row = await this.requireRow(scope, id);
    const { rows } = await this.pool.query<Row>(
      `UPDATE veridis_runtime_v1.mcp_connections SET trust='confirmed', updated_at=clock_timestamp() WHERE scope_key=$1 AND id=$2 RETURNING *`,
      [scopeKey(scope), id]);
    await this.audit(scope, actor, 'mcp.confirmed', { connectionId: id, name: row.name });
    return this.remember(scope, shape(rows[0]!), actor);
  }

  async remove(scope: AccessScope, id: string, actor: McpActor): Promise<McpConnection> {
    const row = await this.requireRow(scope, id);
    const { rows } = await this.pool.query<Row>(
      `UPDATE veridis_runtime_v1.mcp_connections SET status='removed', credential_encrypted=NULL, updated_at=clock_timestamp() WHERE scope_key=$1 AND id=$2 RETURNING *`,
      [scopeKey(scope), id]);
    await this.audit(scope, actor, 'mcp.removed', { connectionId: id, name: row.name });
    return this.remember(scope, shape(rows[0]!), actor);
  }

  // Llamada de un agente. readOnly: el revisor vuelve a ejecutar para verificar y nunca debe repetir
  // una escritura. Los argumentos se validan contra el esquema que declaró el servidor.
  async call(scope: AccessScope, name: string, toolName: string, args: Record<string, unknown>, actor: McpActor & { readOnly: boolean }): Promise<{ isError: boolean; text: string }> {
    const row = await this.row(scope, { name: normalizeConnectionName(name) });
    if (!row) throw new McpConnectError(`No existe la conexión MCP «${name}»`, 'protocol');
    if (row.status !== 'active' || !row.url) throw new McpConnectError(`La conexión «${row.name}» está ${STATUS_TEXT[row.status]}`, 'protocol');
    const tool = (row.tools ?? []).find((t) => t.name === toolName);
    if (!tool) throw new McpConnectError(`La conexión «${row.name}» no tiene la herramienta «${toolName}»`, 'protocol');
    if (!tool.enabled) throw new McpConnectError(`La herramienta «${toolName}» está apagada: un humano debe activarla en Conexiones`, 'blocked');
    if (actor.readOnly && tool.access !== 'read') throw new McpConnectError(`«${toolName}» escribe: en revisión solo se usan herramientas de lectura`, 'blocked');
    const validate = validatorFor(tool.inputSchema);
    if (validate && !validate(args)) {
      throw new McpConnectError(`Argumentos inválidos para ${toolName}: ${ajv.errorsText(validate.errors).slice(0, 300)}`, 'protocol');
    }
    try {
      const result = await callMcpTool({ url: row.url, origin: this.originOf(row), credential: this.credentialOf(row) }, toolName, args);
      await this.pool.query(
        'UPDATE veridis_runtime_v1.mcp_connections SET call_count=call_count+1, last_used_at=clock_timestamp() WHERE id=$1', [row.id]);
      // Solo nombres de argumentos en la auditoría: los valores pueden traer datos de la empresa.
      await this.audit(scope, actor, 'mcp.called', { connectionId: row.id, name: row.name, tool: toolName, argumentNames: Object.keys(args), isError: result.isError });
      return result;
    } catch (error) {
      const failure = error instanceof McpConnectError ? error : new McpConnectError(error instanceof Error ? error.message : 'error', 'protocol');
      await this.audit(scope, actor, 'mcp.call_failed', { connectionId: row.id, name: row.name, tool: toolName, kind: failure.kind, error: failure.message.slice(0, 300) });
      // Una credencial vencida cambia lo que la empresa sabe de la conexión: se refleja en su memoria.
      if (failure.kind === 'auth') {
        const { rows } = await this.pool.query<Row>(
          `UPDATE veridis_runtime_v1.mcp_connections SET status='needs_auth', last_error=$2, updated_at=clock_timestamp() WHERE id=$1 RETURNING *`,
          [row.id, failure.message.slice(0, 500)]);
        await this.remember(scope, shape(rows[0]!), actor).catch(() => undefined);
      }
      throw failure;
    }
  }

  // Reescribe la memoria de la conexión si cambió lo que se sabe de ella. Es estado observado por el
  // motor, no una afirmación de alguien: la versión nueva sustituye a todas las anteriores de la misma
  // conexión (también a una de antes de retirarla y volver a conectarla con el mismo nombre). Queda
  // confirmada solo si la conexión está confirmada y el cambio lo hizo un humano: que alguien pulse
  // "volver a probar" en una conexión que hizo un agente no la da por revisada.
  private async remember(scope: AccessScope, conn: McpConnection, actor: McpActor): Promise<McpConnection> {
    if (!this.memory) return conn;
    try {
      const content = connectionMemoryContent(conn);
      const previous = conn.memoryId ? await this.memory.get(scope, conn.memoryId) : null;
      const previousActive = previous && (previous.status === 'proposed' || previous.status === 'validated') ? previous : null;
      if (previousActive?.content === content) return conn;
      const record = await this.memory.propose(scope, {
        entityType: 'integration', entityId: `mcp-${conn.name}`, content,
        kind: conn.status === 'active' || conn.status === 'removed' ? 'fact' : 'question',
        provenance: [{ reference: `conexion-mcp://${conn.id}${actor.orderId ? ` (expediente ${actor.orderId})` : ''}`, observedAt: new Date().toISOString() }],
        trust: 'internal_unverified',
      });
      const saved = actor.principal.kind === 'human' && conn.trust === 'confirmed' ? await this.memory.validate(scope, record.id) : record;
      await this.memory.supersedeOthers(scope, 'integration', `mcp-${conn.name}`, saved.id);
      await this.pool.query('UPDATE veridis_runtime_v1.mcp_connections SET memory_id=$2 WHERE id=$1', [conn.id, saved.id]);
      return { ...conn, memoryId: saved.id };
    } catch (error) {
      // Memoria caída (p. ej. sin embeddings): la conexión sigue funcionando; queda registrado.
      console.error(`No se pudo guardar la memoria de la conexión ${conn.name}: ${error instanceof Error ? error.message : 'error'}`);
      return conn;
    }
  }
}
