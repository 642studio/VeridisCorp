import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { Pool, type PoolClient } from 'pg';
import { Command } from '@langchain/langgraph';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import { Cron } from 'croner';
import { z } from 'zod';
import { authorize } from '../governance/authorization.js';
import { AccessScope, PermissionGrant, Principal, type Operation } from '../governance/contracts.js';
import { scopeKey, tokenHash, transaction } from './database.js';
import { RuntimeError } from './contracts.js';
import { createOrder } from '../office/contracts.js';
import { createOfficeWorkflow, OFFICE_WORKFLOW_VERSION } from '../office/workflow.js';
import { budgetStatus } from '../office/budget.js';
import { loadModelRouter, platformOf, ModelRouter, ModelStage, type ModelCallRecord } from '../office/models.js';
import { Id as AgentId } from '../office/contracts.js';
import { officeRegistry } from '../office/registry.js';
import { HumanAnswer, ArchivistReply, IngestReply, AssistantReply, type AssistantContext } from '../office/runtime-contracts.js';
import { loadPriceList, priceTokens, type PriceList } from '../office/prices.js';
import { summarizeUsage, type UsageRow } from '../office/usage.js';
import type { OfficeIntelligence, HumanExchange } from '../office/runtime-contracts.js';
import type { ModelUsage } from '../office/models.js';
import type { WorkOrder } from '../office/contracts.js';
import { fireOnce } from './scheduler.js';
import { companyMemoryScope, type MemoryStore } from './memory-store.js';
import { exportRecordToVault } from './memory-export.js';
import { splitDocument, SECTION_MAX } from './memory-ingest.js';
import type { McpStore } from './mcp-store.js';
import { McpConnectError } from '../office/mcp-client.js';
import { VOICE_ID_PATTERN } from './elevenlabs-proxy.js';

// config/prices.active.json y config/models.active.json son archivos que un operador edita a
// mano en disco (ver AGENTS.md: el operador copia precios desde la página vigente del
// proveedor). Cachear su contenido para siempre, como hacía esta clase antes, significaba que
// un precio o perfil nuevo solo tomaba efecto tras reiniciar el servidor — visto en vivo: los
// precios de Claude agregados hoy no aparecían en CONSUMO hasta reiniciar. watchFile() revisa el
// mtime del archivo en cada llamada (un stat, no una lectura) y solo vuelve a parsear cuando
// cambió. Sin VERIDIS_*_FILE configurado no hay archivo que vigilar: se comporta igual que antes,
// carga una vez.
function watchFile<T>(fileEnvVar: string, load: () => T): () => T {
 let cached: T;
 let loadedMtimeMs: number | undefined;
 let hasLoaded = false;
 return () => {
  const filePath = process.env[fileEnvVar]?.trim();
  let mtimeMs: number | undefined;
  if (filePath) { try { mtimeMs = statSync(filePath).mtimeMs; } catch { /* usa el último valor cargado */ } }
  if (!hasLoaded || (filePath && mtimeMs !== loadedMtimeMs)) {
   cached = load();
   loadedMtimeMs = mtimeMs;
   hasLoaded = true;
  }
  return cached;
 };
}
type Tx = PoolClient;
const slug = (value: string) => value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
 .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'memoria';
type Auth = { principal: Principal; scope: AccessScope };
const officeResource = (scope: AccessScope) => ({ type: 'workflow', id: 'office-pilot', scope });
const MemoryStatus = z.enum(['proposed', 'validated', 'superseded', 'quarantined']);
const StartInput = z.object({ objective: z.string().trim().min(1).max(4000) }).strict();
const AnswerInput = z.object({ answer: HumanAnswer }).strict();
const AskInput = z.object({ question: z.string().trim().min(1).max(4000), threadId: z.uuid().nullable().optional() }).strict();
const QuarantineInput = z.object({ reason: z.string().trim().min(1).max(2000) }).strict();
const ElevenLabsVoiceInput = z.object({ voiceId: z.string().trim().regex(VOICE_ID_PATTERN) }).strict();
// null en profileId quita el override del agente para esa etapa (vuelve a heredar el perfil de la
// etapa o el default de la oficina) — ver OfficeRuntime.updateAgentModelProfile.
const AgentModelProfileInput = z.object({ agentId: AgentId, stage: ModelStage, profileId: AgentId.nullable() }).strict();
// Hasta ~200 mil caracteres por documento: más de eso conviene partirlo a mano en varias importaciones.
const ImportPlanInput = z.object({ title: z.string().trim().min(1).max(200), text: z.string().trim().min(1).max(200000) }).strict();
const ImportSectionInput = z.object({
 title: z.string().trim().min(1).max(200), section: z.string().trim().min(1).max(400), text: z.string().trim().min(1).max(SECTION_MAX),
 // Un documento escrito por quien lo importa puede entrar ya confirmado: es la confirmación humana.
 confirm: z.boolean().default(false),
}).strict();
// Conexiones MCP: la credencial va en una cabecera (Authorization por defecto; "Bearer " se agrega solo).
const McpCredentialInput = z.object({
 headerName: z.string().trim().min(1).max(80).regex(/^[A-Za-z0-9-]+$/).default('Authorization'),
 value: z.string().trim().min(1).max(4000),
}).strict();
const McpConnectionInput = z.object({
 name: z.string().trim().min(1).max(40), url: z.string().trim().max(500).nullable().optional(),
 purpose: z.string().trim().min(1).max(500), credential: McpCredentialInput.nullable().optional(),
}).strict();
const McpToolsInput = z.object({
 enabled: z.record(z.string().min(1).max(120), z.boolean()).optional(),
 access: z.record(z.string().min(1).max(120), z.enum(['read', 'write'])).optional(),
}).strict();
const McpCredentialUpdate = z.object({ credential: McpCredentialInput.nullable() }).strict();
const ScheduleInput = z.object({
 name: z.string().trim().min(1).max(200),
 objective: z.string().trim().min(1).max(4000),
 cronExpression: z.string().trim().min(1).max(100),
 timezone: z.string().trim().min(1).max(100),
}).strict();
const ScheduleUpdateInput = z.object({
 name: z.string().trim().min(1).max(200).optional(),
 objective: z.string().trim().min(1).max(4000).optional(),
 cronExpression: z.string().trim().min(1).max(100).optional(),
 timezone: z.string().trim().min(1).max(100).optional(),
 enabled: z.boolean().optional(),
}).strict();
type ScheduledTaskRow = {
 id: string; name: string; objective_template: string; cron_expression: string; timezone: string;
 enabled: boolean; current_order_id: string | null; consecutive_failures: number;
 last_run_at: Date | null; last_fired_order_id: string | null; created_at: Date; updated_at: Date;
};
// Valida y, de paso, calcula la próxima ejecución — croner tira sobre la expresión cron o la
// zona horaria inválidas en la misma llamada, así que una sola función cubre ambos casos.
function nextRunOf(cronExpression: string, timezone: string): Date | null {
 try { return new Cron(cronExpression, { timezone }).nextRun(); }
 catch { throw new RuntimeError(400, 'Expresión cron o zona horaria inválida'); }
}
// Identidad para disparos automáticos (src/runtime/scheduler.ts): no hay sesión humana detrás,
// así que nunca pasa por auth() — se autoriza como cualquier otro principal de servicio, con su
// propio permiso otorgado vía runtime:provision (mismo patrón que content-orchestrator/
// delivery-executor en runtime/service.ts).
export const scheduler = { kind: 'service' as const, id: 'scheduler' };
export const telegramBridge = { kind: 'service' as const, id: 'telegram-bridge' };

// Reabre, bajo la misma sesión/autorización que runtime/, la ejecución real de office/ que
// los comandos CLI office:run/resume/answer suspendieron (ver docs/runtime-pilot.md). A
// diferencia de ContentRuntime, cada avance puede disparar varias llamadas reales de una sola
// vez: el tope siempre presente es maxTurns del workflow; el presupuesto en dinero por expediente
// (maxCostMicros, src/office/budget.ts) es opcional y solo se aplica si se configuró.
export class OfficeRuntime {
 private readonly saver: PostgresSaver;
 constructor(
  private readonly pool: Pool, private readonly intelligence: OfficeIntelligence,
  // maxCostMicros no es del workflow sino de cada expediente: se copia a order.limits al crearlo
  // (VERIDIS_OFFICE_MAX_COST_MICROS), así cambiar la variable no reinterpreta expedientes ya en curso.
  private readonly options: { maxTurns?: number; maxRejectedDecisions?: number; maxQuestions?: number; maxCostMicros?: number | null; priceList?: PriceList | null } = {},
  private readonly memory?: MemoryStore,
  // Ruta de un vault de Obsidian (VERIDIS_MEMORY_VAULT_PATH): si está presente, cada validación
  // exitosa también espeja esa memoria a disco (ver src/runtime/memory-export.ts). Postgres sigue
  // siendo la fuente de verdad; un fallo al escribir el archivo no revierte ni falla la validación.
  private readonly memoryVaultPath?: string | null,
  private readonly mcp?: McpStore,
 ) {
  this.saver = new PostgresSaver(pool);
 }
 async setup(options: { migrate?: boolean } = {}) {
  if (options.migrate !== false) { await this.saver.setup(); return; }
  // Producción usa un rol sin DDL. Las tablas se preparan con runtime:db y el rol dueño.
  await this.pool.query('SELECT 1 FROM public.checkpoints LIMIT 0');
  await this.pool.query('SELECT 1 FROM public.checkpoint_blobs LIMIT 0');
  await this.pool.query('SELECT 1 FROM public.checkpoint_writes LIMIT 0');
 }
 private graph() {
  const { maxCostMicros: _perOrder, ...workflowOptions } = this.options;
  return createOfficeWorkflow(this.intelligence, officeRegistry, this.saver, workflowOptions);
 }
 // Archivista (memoria automática, decisión 2026-10-31): al cerrar un expediente se destila, en
 // segundo plano, lo que valga la pena recordar — sin retrasar la respuesta al humano ni poder
 // fallar el expediente. settled() existe para que las pruebas esperen a que termine.
 private readonly distilling = new Set<Promise<void>>();
 async settled() { await Promise.allSettled([...this.distilling]); }
 private scheduleDistill(auth: Auth, id: string, order: unknown) {
  if (!this.memory || !this.intelligence.distill || (order as { status?: string }).status !== 'completed') return;
  const run: Promise<void> = this.distill(auth, id, order as WorkOrder)
   .catch((error: unknown) => this.audit(this.pool, auth, id, 'memory.distill_failed', { reason: error instanceof Error ? error.message : 'desconocido' }).catch(() => undefined))
   .finally(() => { this.distilling.delete(run); });
  this.distilling.add(run);
 }
 private async distill(auth: Auth, id: string, order: WorkOrder) {
  const claimed = await this.pool.query(
   'UPDATE veridis_runtime_v1.office_orders SET memory_distilled_at = clock_timestamp() WHERE id = $1 AND memory_distilled_at IS NULL RETURNING id', [id]);
  if (!claimed.rows.length) return;
  // Mismo ámbito fijo que usan memory.write/memory.query de los agentes (configureMemory en cli.ts).
  const scope = companyMemoryScope();
  const existing = await this.memory!.query(scope, order.objective, { limit: 8, track: false });
  // Solo lo producido de verdad: entregas de tareas completadas, recortadas para no mandar un
  // expediente enorme a un modelo barato.
  const deliverables = order.tasks.filter((t) => t.status === 'completed' && t.submission)
   .map((t) => ({ task: t.title, agentId: t.assignedAgentId, summary: t.submission!.summary.slice(0, 3000) }));
  if (!deliverables.length) return;
  let usage: ModelUsage | null = null;
  const reply = ArchivistReply.parse(await this.intelligence.distill!({
   objective: order.objective, deliverables,
   existing: existing.map((r) => ({ id: r.record.id, entityType: r.record.entityType, entityId: r.record.entityId, content: r.record.content, confirmed: r.record.status === 'validated' })),
  }, (u) => { usage = u; }));
  const knownIds = new Set(existing.map((r) => r.record.id));
  const saved: string[] = [];
  for (const memory of reply.memories) {
   const record = await this.memory!.propose(scope, {
    entityType: memory.entityType, entityId: slug(memory.entityId), content: memory.content, kind: memory.kind,
    provenance: [{ reference: `expediente://${id} (archivista)`, observedAt: new Date().toISOString() }],
    trust: 'internal_unverified',
    // Solo se acepta refutar algo que el archivista de verdad vio: nunca un id inventado.
    contradicts: memory.contradicts && knownIds.has(memory.contradicts) ? memory.contradicts : null,
   });
   saved.push(record.id);
  }
  const counted = usage as ModelUsage | null;
  // Fuera del presupuesto del expediente (ya cerró): queda en la auditoría con su consumo real.
  await this.audit(this.pool, auth, id, 'memory.distilled', { memoryIds: saved, inputTokens: counted?.inputTokens ?? null, outputTokens: counted?.outputTokens ?? null });
 }
 private async auth(tx: Tx, token: string): Promise<Auth> {
  if (!token || token.length > 200) throw new RuntimeError(401, 'Sesión inválida');
  const result = await tx.query('SELECT principal,scope FROM veridis_runtime_v1.sessions WHERE token_hash=$1 AND NOT revoked AND expires_at > clock_timestamp()', [tokenHash(token)]);
  if (!result.rows[0]) throw new RuntimeError(401, 'Sesión inválida o vencida');
  const principal = Principal.parse(result.rows[0].principal);
  if (principal.kind !== 'human') throw new RuntimeError(401, 'Se requiere sesión humana');
  return { principal, scope: AccessScope.parse(result.rows[0].scope) };
 }
 private async grants(tx: Tx, scope: AccessScope) {
  const rows = await tx.query('SELECT data FROM veridis_runtime_v1.grants WHERE scope_key=$1', [scopeKey(scope)]);
  return rows.rows.map((r) => PermissionGrant.parse(r.data));
 }
 private async audit(tx: Tx | Pool, auth: Auth, orderId: string | null, event: string, details: Record<string, unknown> = {}) {
  await tx.query('INSERT INTO veridis_runtime_v1.audit(run_id,scope_key,data) VALUES($1,$2,$3)',
   [orderId, scopeKey(auth.scope), { principal: auth.principal, event, ...details }]);
 }
 private async permit(tx: Tx, auth: Auth, orderId: string | null, operation: Operation) {
  const decision = authorize({ schemaVersion: 1, runId: orderId ?? randomUUID(), correlationId: orderId ?? randomUUID(), scope: auth.scope, principal: auth.principal },
   operation, officeResource(auth.scope), await this.grants(tx, auth.scope), new Date());
  if (!decision.allowed) {
   await this.audit(this.pool, auth, null, 'authorization.denied', { requestedOrderId: orderId, operation });
   throw new RuntimeError(403, 'Sin autorización para esta operación');
  }
  await this.audit(tx, auth, orderId, 'authorization.allowed', { operation, grantIds: decision.grantIds });
 }
 private async indexRow(tx: Tx, auth: Auth, id: string) {
  const row = await tx.query('SELECT thread_id FROM veridis_runtime_v1.office_orders WHERE id=$1 AND scope_key=$2', [z.uuid().parse(id), scopeKey(auth.scope)]);
  if (!row.rows[0]) {
   await this.audit(this.pool, auth, null, 'resource.denied', { requestedOrderId: id });
   throw new RuntimeError(404, 'Expediente no disponible');
  }
  return row.rows[0].thread_id as string;
 }
 // scheduleId solo se escribe en el insert inicial (nunca cambia); el ON CONFLICT no lo toca.
 // modelCalls es el acumulado completo de state.modelCalls a este punto; solo la cola nueva desde
 // usage_synced_count se vuelca a usage_records (ver docs del esquema en database.ts). El UPDATE
 // ON CONFLICT toma el lock de fila que serializa dos syncIndex concurrentes del mismo id.
 private async syncIndex(
  id: string, scope: AccessScope, objective: string, status: string,
  modelCalls: ModelCallRecord[], scheduleId: string | null = null,
 ) {
  await transaction(this.pool, async (tx) => {
   const row = await tx.query<{ usage_synced_count: number }>(
    `INSERT INTO veridis_runtime_v1.office_orders(id,scope_key,thread_id,objective,status,created_by_schedule_id)
     VALUES($1,$2,$3,$4,$5,$6)
     ON CONFLICT (id) DO UPDATE SET status=$5, updated_at=clock_timestamp()
     RETURNING usage_synced_count`,
    [id, scopeKey(scope), `${OFFICE_WORKFLOW_VERSION}:${id}`, objective, status, scheduleId],
   );
   const pending = modelCalls.slice(row.rows[0]!.usage_synced_count);
   if (!pending.length) return;
   for (const call of pending) {
    await tx.query(
     `INSERT INTO veridis_runtime_v1.usage_records(scope_key,order_id,agent_id,profile_id,provider,model,input_tokens,output_tokens,cost_micros)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
     [scopeKey(scope), id, call.agentId, call.profileId, call.provider, call.model, call.inputTokens, call.outputTokens, call.costMicros],
    );
   }
   await tx.query('UPDATE veridis_runtime_v1.office_orders SET usage_synced_count=$2 WHERE id=$1', [id, modelCalls.length]);
  });
 }
 // La pregunta de un ask_user pendiente vive en snapshot.tasks[].interrupts, no en el estado
 // que devuelve invoke(); hay que leerla aparte para mostrar el texto, no solo "interrumpido".
 private shape(
  state: { order: unknown; turns: number; rejectedDecisions: number; lastError: string | null; modelCalls: unknown[]; exchanges: HumanExchange[] },
  snapshot: { next: readonly string[]; tasks: readonly { interrupts?: readonly { value?: unknown }[] }[] },
 ) {
  const pendingQuestion = snapshot.tasks.flatMap((t) => t.interrupts ?? [])
   .map((i) => i.value as { question?: string } | undefined).find((v) => v?.question)?.question ?? null;
  const order = state.order as { limits?: { maxCostMicros?: number | null } };
  return { order: state.order, turns: state.turns, rejectedDecisions: state.rejectedDecisions, lastError: state.lastError,
   modelCalls: state.modelCalls, exchanges: state.exchanges, interrupted: snapshot.next.length > 0, pendingQuestion,
   limits: { maxTurns: this.options.maxTurns ?? 100, maxRejectedDecisions: this.options.maxRejectedDecisions ?? 3, maxQuestions: this.options.maxQuestions ?? 5 },
   budget: budgetStatus(state.modelCalls as ModelCallRecord[], order.limits?.maxCostMicros) };
 }
 // Cuerpo real de "iniciar", ya resuelto el Auth — lo reusan tanto start() (sesión humana vía
 // token) como startScheduled() (disparo automático, sin token). id es opcional para que un
 // disparo programado pueda generarlo antes de llamar aquí y usarlo para reclamar su propio
 // candado contra solapamiento en scheduled_tasks (ver src/runtime/scheduler.ts).
 private async startWithAuth(auth: Auth, objective: string, options: { id?: string; scheduleId?: string | null } = {}) {
  const id = options.id ?? randomUUID();
  const threadId = `${OFFICE_WORKFLOW_VERSION}:${id}`;
  const order = createOrder({
   id, workspaceId: auth.scope.workspaceId, objective,
   criteria: [{ id: 'delivery', description: 'Entregable que responde al objetivo, con evidencias y revisión independiente.' }],
   limits: { maxTasks: 10, maxSteps: 60, maxRevisionsPerTask: 2, maxCostMicros: this.options.maxCostMicros ?? null },
  });
  await this.syncIndex(id, auth.scope, objective, 'active', [], options.scheduleId ?? null);
  const config = { configurable: { thread_id: threadId }, recursionLimit: 300 };
  await this.graph().invoke({ order }, config);
  const snapshot = await this.graph().getState(config);
  const state = snapshot.values as Parameters<typeof this.shape>[0];
  await this.syncIndex(id, auth.scope, objective, (state.order as { status: string }).status, state.modelCalls as ModelCallRecord[], options.scheduleId ?? null);
  this.scheduleDistill(auth, id, state.order);
  await this.audit(this.pool, auth, id, 'office.started', { objective, ...(options.scheduleId ? { scheduleId: options.scheduleId } : {}) });
  return { id, ...this.shape(state, snapshot) };
 }
 async start(token: string, raw: unknown) {
  const input = StartInput.parse(raw);
  const auth = await transaction(this.pool, async (tx) => {
   const auth = await this.auth(tx, token);
   await this.permit(tx, auth, null, 'draft.create');
   return auth;
  });
  return this.startWithAuth(auth, input.objective);
 }
 // Llamado solo por el scheduler: orderId ya fue generado por quien llama, para poder reclamar
 // el candado de scheduled_tasks antes de arrancar un expediente real que puede tardar minutos.
 async startScheduled(scope: AccessScope, objective: string, scheduleId: string, orderId: string) {
  const auth: Auth = { principal: scheduler, scope };
  await transaction(this.pool, async (tx) => { await this.permit(tx, auth, null, 'draft.create'); });
  return this.startWithAuth(auth, objective, { id: orderId, scheduleId });
 }
 async list(token: string) {
  return transaction(this.pool, async (tx) => {
   const auth = await this.auth(tx, token);
   await this.permit(tx, auth, null, 'data.read');
   const rows = await tx.query(
    'SELECT id,objective,status,created_at,updated_at FROM veridis_runtime_v1.office_orders WHERE scope_key=$1 ORDER BY created_at DESC LIMIT 50',
    [scopeKey(auth.scope)],
   );
   return { orders: rows.rows };
  });
 }
 // Cuerpo real de "leer" (solo getState(), sin invoke(): nunca dispara una llamada real de IA),
 // ya resuelto el Auth — lo reusan tanto get() (sesión humana) como getAsService() (el puente de
 // Telegram, para poder contestar el estado al instante sin esperar a que termine lo pesado).
 private async getWithAuth(auth: Auth, id: string) {
  const threadId = await transaction(this.pool, async (tx) => {
   const threadId = await this.indexRow(tx, auth, id);
   await this.permit(tx, auth, id, 'data.read');
   return threadId;
  });
  const config = { configurable: { thread_id: threadId }, recursionLimit: 300 };
  const snapshot = await this.graph().getState(config);
  if (!snapshot.values.order) throw new RuntimeError(404, 'Expediente no disponible');
  return { id, ...this.shape(snapshot.values as Parameters<typeof this.shape>[0], snapshot) };
 }
 async get(token: string, id: string) {
  const auth = await transaction(this.pool, async (tx) => this.auth(tx, token));
  return this.getWithAuth(auth, id);
 }
 async getAsService(principal: Principal, scope: AccessScope, id: string) {
  return this.getWithAuth({ principal, scope }, id);
 }
 async advance(token: string, id: string) {
  const { auth, threadId } = await transaction(this.pool, async (tx) => {
   const auth = await this.auth(tx, token);
   const threadId = await this.indexRow(tx, auth, id);
   await this.permit(tx, auth, id, 'draft.create');
   return { auth, threadId };
  });
  const config = { configurable: { thread_id: threadId }, recursionLimit: 300 };
  await this.graph().invoke(null, config);
  const snapshot = await this.graph().getState(config);
  const state = snapshot.values as Parameters<typeof this.shape>[0];
  await this.syncIndex(id, auth.scope, (state.order as { objective: string }).objective, (state.order as { status: string }).status, state.modelCalls as ModelCallRecord[]);
  this.scheduleDistill(auth, id, state.order);
  await this.audit(this.pool, auth, id, 'office.advanced', {});
  return { id, ...this.shape(state, snapshot) };
 }
 // enabled=false no tiene próxima ejecución real (nadie la va a disparar hasta reactivarla) —
 // calcularla de todas formas confundiría a la UI, que ya tiene su propio botón "reactivar".
 private shapeSchedule(row: ScheduledTaskRow) {
  let nextRunAt: string | null = null;
  if (row.enabled) { try { nextRunAt = nextRunOf(row.cron_expression, row.timezone)?.toISOString() ?? null; } catch { nextRunAt = null; } }
  return {
   id: row.id, name: row.name, objective: row.objective_template, cronExpression: row.cron_expression,
   timezone: row.timezone, enabled: row.enabled, running: row.current_order_id !== null,
   consecutiveFailures: row.consecutive_failures, lastRunAt: row.last_run_at?.toISOString() ?? null,
   lastFiredOrderId: row.last_fired_order_id, createdAt: row.created_at.toISOString(),
   updatedAt: row.updated_at.toISOString(), nextRunAt,
  };
 }
 // Igual que indexRow() para expedientes: el filtro por scope_key decide si el recurso existe
 // para quien pregunta antes de evaluar el permiso de la operación — así una sesión de otro
 // cliente recibe 404, nunca 403, sin importar qué permisos tenga otorgados en general.
 private async scheduleRowRaw(tx: Tx, auth: Auth, id: string): Promise<ScheduledTaskRow> {
  const row = await tx.query('SELECT * FROM veridis_runtime_v1.scheduled_tasks WHERE id=$1 AND scope_key=$2', [id, scopeKey(auth.scope)]);
  if (!row.rows[0]) { await this.audit(this.pool, auth, null, 'resource.denied', { requestedScheduleId: id }); throw new RuntimeError(404, 'Tarea programada no disponible'); }
  return row.rows[0] as ScheduledTaskRow;
 }
 async createSchedule(token: string, raw: unknown) {
  const input = ScheduleInput.parse(raw);
  nextRunOf(input.cronExpression, input.timezone);
  return transaction(this.pool, async (tx) => {
   const auth = await this.auth(tx, token);
   await this.permit(tx, auth, null, 'data.write');
   const id = randomUUID();
   const inserted = await tx.query(
    `INSERT INTO veridis_runtime_v1.scheduled_tasks(id, scope_key, scope, name, objective_template, cron_expression, timezone)
     VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [id, scopeKey(auth.scope), auth.scope, input.name, input.objective, input.cronExpression, input.timezone],
   );
   await this.audit(tx, auth, id, 'schedule.created', { scheduleId: id });
   return this.shapeSchedule(inserted.rows[0] as ScheduledTaskRow);
  });
 }
 async listSchedules(token: string) {
  return transaction(this.pool, async (tx) => {
   const auth = await this.auth(tx, token);
   await this.permit(tx, auth, null, 'data.read');
   const rows = await tx.query('SELECT * FROM veridis_runtime_v1.scheduled_tasks WHERE scope_key=$1 ORDER BY created_at DESC LIMIT 100', [scopeKey(auth.scope)]);
   return { schedules: rows.rows.map((r) => this.shapeSchedule(r as ScheduledTaskRow)) };
  });
 }
 async getSchedule(token: string, raw_id: string) {
  const id = z.uuid().parse(raw_id);
  return transaction(this.pool, async (tx) => {
   const auth = await this.auth(tx, token);
   const row = await this.scheduleRowRaw(tx, auth, id);
   await this.permit(tx, auth, id, 'data.read');
   return this.shapeSchedule(row);
  });
 }
 async updateSchedule(token: string, raw_id: string, raw: unknown) {
  const id = z.uuid().parse(raw_id);
  const input = ScheduleUpdateInput.parse(raw);
  if (Object.keys(input).length === 0) throw new RuntimeError(400, 'No hay cambios que aplicar');
  return transaction(this.pool, async (tx) => {
   const auth = await this.auth(tx, token);
   const current = await this.scheduleRowRaw(tx, auth, id);
   await this.permit(tx, auth, id, 'data.write');
   if (input.cronExpression !== undefined || input.timezone !== undefined) {
    nextRunOf(input.cronExpression ?? current.cron_expression, input.timezone ?? current.timezone);
   }
   const result = await tx.query(
    `UPDATE veridis_runtime_v1.scheduled_tasks SET
      name = COALESCE($3, name), objective_template = COALESCE($4, objective_template),
      cron_expression = COALESCE($5, cron_expression), timezone = COALESCE($6, timezone),
      enabled = COALESCE($7, enabled), updated_at = clock_timestamp()
     WHERE id=$1 AND scope_key=$2 RETURNING *`,
    [id, scopeKey(auth.scope), input.name ?? null, input.objective ?? null, input.cronExpression ?? null, input.timezone ?? null, input.enabled ?? null],
   );
   await this.audit(tx, auth, id, 'schedule.updated', { scheduleId: id, fields: Object.keys(input) });
   return this.shapeSchedule(result.rows[0] as ScheduledTaskRow);
  });
 }
 async deleteSchedule(token: string, raw_id: string) {
  const id = z.uuid().parse(raw_id);
  return transaction(this.pool, async (tx) => {
   const auth = await this.auth(tx, token);
   await this.scheduleRowRaw(tx, auth, id);
   await this.permit(tx, auth, id, 'data.write');
   await tx.query('DELETE FROM veridis_runtime_v1.scheduled_tasks WHERE id=$1 AND scope_key=$2', [id, scopeKey(auth.scope)]);
   await this.audit(tx, auth, id, 'schedule.deleted', { scheduleId: id });
   return { id };
  });
 }
 // Disparo manual para pruebas de operador — misma fireOnce que usa el Cron real (src/runtime/
 // scheduler.ts), así que respeta exactamente las mismas reglas de candado y límite de tasa; no
 // es un camino separado que podría divergir del automático.
 async fireSchedule(token: string, raw_id: string) {
  const id = z.uuid().parse(raw_id);
  const auth = await transaction(this.pool, async (tx) => {
   const auth = await this.auth(tx, token);
   await this.scheduleRowRaw(tx, auth, id);
   await this.permit(tx, auth, id, 'draft.create');
   return auth;
  });
  const result = await fireOnce(this.pool, this, id);
  await this.audit(this.pool, auth, id, 'schedule.fired_manually', { result });
  return transaction(this.pool, async (tx) => ({ result, ...this.shapeSchedule(await this.scheduleRowRaw(tx, auth, id)) }));
 }
 // Igual patrón que el resto de recursos hijos de un expediente: existencia-en-scope (vía el
 // order_id al que pertenece el archivo) antes que permiso — una sesión de otro cliente recibe
 // 404, nunca 403, sin importar qué permisos tenga otorgados en general.
 async getFile(token: string, raw_id: string) {
  const id = z.uuid().parse(raw_id);
  return transaction(this.pool, async (tx) => {
   const auth = await this.auth(tx, token);
   const row = await tx.query(
    `SELECT f.filename, f.content_type, f.content FROM veridis_runtime_v1.office_files f
     JOIN veridis_runtime_v1.office_orders o ON o.id = f.order_id
     WHERE f.id=$1 AND o.scope_key=$2`,
    [id, scopeKey(auth.scope)],
   );
   if (!row.rows[0]) { await this.audit(this.pool, auth, null, 'resource.denied', { requestedFileId: id }); throw new RuntimeError(404, 'Archivo no disponible'); }
   await this.permit(tx, auth, null, 'data.read');
   const file = row.rows[0] as { filename: string; content_type: string; content: Buffer };
   return { filename: file.filename, contentType: file.content_type, content: file.content };
  });
 }
 // Memoria automática: lo que proponen agentes o el archivista ya está vigente sin confirmar; aquí
 // un humano lo confirma (validateMemory) o lo descarta (quarantineMemory). El ámbito fijo de
 // memoria corporativa (companyMemoryScope, src/runtime/memory-store.ts) significa que solo una
 // sesión aprovisionada exactamente con ese scope puede ver o decidir algo aquí — una sesión de
 // cliente normal no lo alcanza, igual que sameScope() exige en el resto de la autorización.
 async listMemory(token: string, rawStatus: unknown) {
  const status = MemoryStatus.catch('proposed').parse(rawStatus);
  return transaction(this.pool, async (tx) => {
   const auth = await this.auth(tx, token);
   await this.permit(tx, auth, null, 'data.read');
   if (!this.memory) throw new RuntimeError(409, 'La memoria corporativa no está configurada en este servidor');
   return { records: await this.memory.listByStatus(auth.scope, status) };
  });
 }
 // Importar un documento a memoria, paso 1: partirlo en secciones (sin IA, determinista). La
 // interfaz manda después cada sección a ingestMemorySection para mostrar avance real.
 async planMemoryImport(token: string, raw: unknown) {
  const { title, text } = ImportPlanInput.parse(raw);
  await transaction(this.pool, async (tx) => {
   const auth = await this.auth(tx, token);
   await this.permit(tx, auth, null, 'data.write');
  });
  return { title, sections: splitDocument(text) };
 }
 // Paso 2: una sección -> hasta 12 memorias, vigentes sin confirmar como todo lo automático. Lo que
 // ya existe con el mismo sentido se le muestra al modelo para que no lo duplique.
 async ingestMemorySection(token: string, raw: unknown) {
  const input = ImportSectionInput.parse(raw);
  const auth = await transaction(this.pool, async (tx) => {
   const auth = await this.auth(tx, token);
   await this.permit(tx, auth, null, 'data.write');
   return auth;
  });
  if (!this.memory) throw new RuntimeError(409, 'La memoria corporativa no está configurada en este servidor');
  if (!this.intelligence.ingest) throw new RuntimeError(409, 'Este servidor no tiene un modelo configurado para importar memoria');
  const existing = await this.memory.query(auth.scope, `${input.section}\n${input.text.slice(0, 600)}`, { limit: 10, track: false });
  let usage: ModelUsage | null = null;
  const reply = IngestReply.parse(await this.intelligence.ingest({
   title: input.title, section: input.section, text: input.text,
   existing: existing.map((r) => ({ id: r.record.id, entityType: r.record.entityType, entityId: r.record.entityId, content: r.record.content, confirmed: r.record.status === 'validated' })),
  }, (u) => { usage = u; }));
  const knownIds = new Set(existing.map((r) => r.record.id));
  const saved = [];
  for (const memory of reply.memories) {
   const record = await this.memory.propose(auth.scope, {
    entityType: memory.entityType, entityId: slug(memory.entityId), content: memory.content, kind: memory.kind,
    provenance: [{ reference: `documento: ${input.title} § ${input.section} (importado por ${auth.principal.id}${input.confirm ? ', confirmado al importar' : ''})`, observedAt: new Date().toISOString() }],
    trust: 'internal_unverified',
    contradicts: memory.contradicts && knownIds.has(memory.contradicts) ? memory.contradicts : null,
   });
   saved.push(input.confirm ? await this.memory.validate(auth.scope, record.id) : record);
  }
  const counted = usage as ModelUsage | null;
  await this.audit(this.pool, auth, null, 'memory.ingested', { title: input.title, section: input.section, memoryIds: saved.map((r) => r.id), inputTokens: counted?.inputTokens ?? null, outputTokens: counted?.outputTokens ?? null });
  return { section: input.section, memories: saved, inputTokens: counted?.inputTokens ?? null, outputTokens: counted?.outputTokens ?? null };
 }
 // Respuesta rápida del chat: una llamada con la memoria ya consultada, en segundos, en vez de un
 // expediente completo (CEO, área, especialistas, revisor) que tarda de 30 s a varios minutos.
 // Si lo pedido es trabajo, devuelve mode "order" con el encargo redactado y la UI lo abre como
 // expediente con start() — que exige su propio permiso (draft.create); aquí basta data.read.
 async ask(token: string, raw: unknown) {
  const input = AskInput.parse(raw);
  const auth = await transaction(this.pool, async (tx) => {
   const auth = await this.auth(tx, token);
   await this.permit(tx, auth, null, 'data.read');
   return auth;
  });
  return this.askWithAuth(auth, input);
 }
 // Mismo patrón que startAsService()/answerAsService(): el puente de Telegram usa esto primero,
 // con su propio principal de servicio, para filtrar un saludo o una pregunta simple antes de
 // abrir un expediente completo — igual que ya hace el chat ASISTENTE de la web.
 async askAsService(principal: Principal, scope: AccessScope, question: string, threadId?: string | null) {
  const input = AskInput.parse({ question, ...(threadId ? { threadId } : {}) });
  return this.askWithAuth({ principal, scope }, input);
 }
 private async askWithAuth(auth: Auth, input: z.infer<typeof AskInput>) {
  if (!this.intelligence.ask) throw new RuntimeError(409, 'Este servidor no tiene un modelo configurado para el asistente');
  const key = scopeKey(auth.scope);
  const threadId = input.threadId ?? randomUUID();
  const previous = input.threadId
   ? (await this.pool.query<{ question: string; answer: string }>(
    `SELECT question, answer FROM veridis_runtime_v1.assistant_messages
     WHERE scope_key=$1 AND thread_id=$2 ORDER BY created_at DESC LIMIT 6`, [key, threadId])).rows.reverse()
   : [];
  if (input.threadId && !previous.length) throw new RuntimeError(404, 'Conversación no disponible');
  const started = Date.now();
  // Mismo ámbito que la memoria de los agentes. La pregunta anterior entra en la búsqueda para que
  // un seguimiento corto ("¿y cuánto cuesta?") encuentre el tema de la conversación.
  let memories: AssistantContext['memories'] = [];
  if (this.memory) {
   const memoryScope = companyMemoryScope();
   const search = [previous.at(-1)?.question, input.question].filter(Boolean).join('\n');
   try {
    memories = (await this.memory.query(memoryScope, search, { limit: 8, track: false })).map((r) => ({
     id: r.record.id, entityType: r.record.entityType, entityId: r.record.entityId, kind: r.record.kind ?? 'fact',
     content: r.record.content, confirmed: r.record.status === 'validated',
    }));
   } catch {
    // Sin embeddings o sin memoria: se responde igual, sin ella.
   }
  }
  // Estado en vivo de las conexiones MCP: la memoria dice qué se sabe de cada una, esto dice cómo están ahora.
  let connections: AssistantContext['connections'];
  if (this.mcp) {
   connections = (await this.mcp.list(companyMemoryScope()).catch(() => [])).map((c) => ({
    name: c.name, status: c.status, confirmedByHuman: c.trust === 'confirmed', purpose: c.purpose,
    usableTools: c.status === 'active' ? c.tools.filter((t) => t.enabled).map((t) => t.name) : [],
    offTools: c.tools.filter((t) => !t.enabled).map((t) => t.name),
   }));
  }
  let usage: ModelUsage | null = null;
  const reply = AssistantReply.parse(await this.intelligence.ask({ question: input.question, history: previous, memories, ...(connections ? { connections } : {}) }, (u) => { usage = u; }));
  const counted = usage as ModelUsage | null;
  // Solo cuentan las memorias que el modelo dice haber usado y que de verdad se le dieron.
  const usedIds = [...new Set(reply.memoryIds)].filter((id) => memories.some((m) => m.id === id));
  const used = memories.filter((m) => usedIds.includes(m.id));
  if (this.memory && usedIds.length) await this.memory.recordRecalls(companyMemoryScope(), usedIds).catch(() => undefined);
  const mode = reply.mode === 'order' && reply.objective?.trim() ? 'order' : 'answer';
  const objective = mode === 'order' ? reply.objective!.trim() : null;
  const selection = this.intelligence.selectModel?.({ stage: 'execute', agentId: 'assistant', capability: 'assistant.answer' });
  const price = priceTokens(this.priceList(), selection?.provider ?? 'unknown', selection?.model ?? 'unknown', counted ?? { inputTokens: null, outputTokens: null });
  const id = randomUUID();
  const latencyMs = Date.now() - started;
  const row = await this.pool.query<{ created_at: Date }>(
   `INSERT INTO veridis_runtime_v1.assistant_messages(id,thread_id,scope_key,principal,question,answer,mode,objective,memories,provider,model,input_tokens,output_tokens,cost_micros,latency_ms,profile_id)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING created_at`,
   [id, threadId, key, auth.principal, input.question, reply.answer, mode, objective, JSON.stringify(used),
    selection?.provider ?? 'unknown', selection?.model ?? 'unknown', counted?.inputTokens ?? null, counted?.outputTokens ?? null, price.costMicros, latencyMs,
    selection?.profileId ?? null],
  );
  await this.audit(this.pool, auth, null, 'assistant.answered', { messageId: id, threadId, mode, memoryIds: usedIds,
   inputTokens: counted?.inputTokens ?? null, outputTokens: counted?.outputTokens ?? null, costMicros: price.costMicros, latencyMs });
  return { id, threadId, question: input.question, answer: reply.answer, mode, objective, memories: used, scene: reply.scene,
   inputTokens: counted?.inputTokens ?? null, outputTokens: counted?.outputTokens ?? null,
   costMicros: price.costMicros, costStatus: price.costStatus, latencyMs, createdAt: row.rows[0]!.created_at };
 }
 private readonly loadPriceListWatched = watchFile('VERIDIS_PRICES_FILE', () => { try { return loadPriceList(); } catch { return null; } });
 private priceList(): PriceList | null {
  if (this.options.priceList !== undefined) return this.options.priceList;
  return this.loadPriceListWatched();
 }
 // Solo para resolver, por perfil, su plataforma (platformOf) y su apiKeyEnv en el panel de
 // consumo — nunca para invocar un modelo. null si la configuración no carga; el panel entonces
 // no puede distinguir plataforma/credencial y lo deja explícito (ver usage()).
 private readonly loadRouterWatched = watchFile('VERIDIS_MODELS_FILE', () => { try { return loadModelRouter(); } catch { return null; } });
 private router(): ModelRouter | null {
  return this.loadRouterWatched();
 }
 // Gasto acumulado de todo el ámbito (todos los expedientes + el chat ASISTENTE), agregado por
 // agente, plataforma, credencial (apiKeyEnv) y modelo. Ver docs del esquema en database.ts:
 // usage_records y assistant_messages.profile_id son las dos fuentes; se combinan aquí porque
 // cada una solo conoce su propia mitad del consumo real.
 async usage(token: string) {
  return transaction(this.pool, async (tx) => {
   const auth = await this.auth(tx, token);
   await this.permit(tx, auth, null, 'data.read');
   const key = scopeKey(auth.scope);
   const office = await tx.query<{ agent_id: string; profile_id: string; model: string; cost_micros: string | null }>(
    'SELECT agent_id, profile_id, model, cost_micros FROM veridis_runtime_v1.usage_records WHERE scope_key=$1', [key]);
   const assistant = await tx.query<{ profile_id: string | null; model: string; cost_micros: string | null }>(
    'SELECT profile_id, model, cost_micros FROM veridis_runtime_v1.assistant_messages WHERE scope_key=$1', [key]);
   const rows: UsageRow[] = [
    ...office.rows.map((r) => ({ agentId: r.agent_id, profileId: r.profile_id, model: r.model, costMicros: r.cost_micros === null ? null : Number(r.cost_micros) })),
    ...assistant.rows.map((r) => ({ agentId: 'assistant', profileId: r.profile_id, model: r.model, costMicros: r.cost_micros === null ? null : Number(r.cost_micros) })),
   ];
   const router = this.router();
   return summarizeUsage(rows, this.priceList()?.currency ?? 'USD', (profileId) => {
    if (!router) return null;
    try { const profile = router.profile(profileId); return { provider: profile.provider, apiKeyEnv: profile.apiKeyEnv, baseURL: profile.baseURL }; }
    catch { return null; }
   });
  });
 }
 // Panel CONFIGURACIONES: qué proveedor/modelo usa cada perfil y si su variable de entorno está
 // definida — nunca el valor de la credencial. Mismo router() cacheado de usage(), misma razón:
 // la política pública resuelta no contiene secretos (ver src/office/models.ts).
 async settings(token: string) {
  return transaction(this.pool, async (tx) => {
   const auth = await this.auth(tx, token);
   await this.permit(tx, auth, null, 'data.read');
   const router = this.router();
   const providers = router ? Object.entries(router.snapshot().profiles).map(([profileId, profile]) => ({
    profileId, provider: platformOf(profile.provider, profile.baseURL), model: profile.model,
    apiKeyEnv: profile.apiKeyEnv, baseURL: profile.baseURL ?? null,
    configured: Boolean(process.env[profile.apiKeyEnv]?.trim()),
   })) : [];
   const voiceRow = await tx.query<{ value: string }>(
    "SELECT value FROM veridis_runtime_v1.settings WHERE scope_key=$1 AND key='elevenlabs.voiceId'", [scopeKey(auth.scope)]);
   const totpRow = await tx.query<{ n: number }>('SELECT count(*)::int AS n FROM veridis_runtime_v1.totp_credentials');
   return {
    providers,
    elevenlabs: {
     configured: Boolean(process.env.VERIDIS_ELEVENLABS_API_KEY?.trim()),
     voiceId: voiceRow.rows[0]?.value ?? process.env.VERIDIS_ELEVENLABS_VOICE_ID?.trim() ?? null,
     modelId: process.env.VERIDIS_ELEVENLABS_MODEL_ID?.trim() || 'eleven_multilingual_v2',
    },
    integrations: {
     telegram: Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim() && process.env.TELEGRAM_ALLOWED_CHAT_IDS?.trim()),
     gmail: Boolean(process.env.GMAIL_OAUTH_CLIENT_ID?.trim() && process.env.GMAIL_OAUTH_CLIENT_SECRET?.trim()),
    },
    totpEnrolled: totpRow.rows[0]!.n > 0,
   };
  });
 }
 // Ruta del archivo de política de modelos (VERIDIS_MODELS_FILE), si el servidor arrancó con uno.
 // Sin esa variable, la oficina sigue el modo de compatibilidad de un solo perfil (loadModelRouter)
 // y la política no es editable desde la UI — no hay archivo al que escribir.
 private modelsFilePath(): string | null {
  const file = process.env.VERIDIS_MODELS_FILE?.trim();
  return file || null;
 }
 // Política de modelos en forma editable: perfiles resueltos (sin secretos, igual que settings())
 // más el mapa agents tal como está en el archivo — a diferencia de settings(), que solo da la
 // lista plana de perfiles. agentIds viene del registro real, no del archivo, para poder asignar
 // modelo a un agente que todavía no tiene ningún override.
 async modelPolicy(token: string) {
  return transaction(this.pool, async (tx) => {
   const auth = await this.auth(tx, token);
   await this.permit(tx, auth, null, 'data.read');
   const router = this.router();
   const filePath = this.modelsFilePath();
   const agentIds = officeRegistry.list().map((agent) => agent.id);
   if (!router || !filePath) return { editable: false, filePath: null, profiles: [], stages: null, agents: {}, agentIds };
   const snapshot = router.snapshot();
   const profiles = Object.entries(snapshot.profiles).map(([profileId, profile]) => ({
    profileId, provider: platformOf(profile.provider, profile.baseURL), model: profile.model,
    apiKeyEnv: profile.apiKeyEnv, baseURL: profile.baseURL ?? null,
    configured: Boolean(process.env[profile.apiKeyEnv]?.trim()),
   }));
   // Se relee el archivo (no el snapshot resuelto) para que el mapa agents mostrado sea
   // literalmente lo que hay en disco — el snapshot ya resolvió modelEnv a su valor y perdería
   // esa indirección si se usara para reconstruir la edición.
   const onDisk = JSON.parse(readFileSync(resolve(filePath), 'utf8')) as { agents?: Record<string, Record<string, string>> };
   return { editable: true, filePath, profiles, stages: snapshot.stages, agents: onDisk.agents ?? {}, agentIds };
  });
 }
 // Escribe agents[agentId][stage] en el archivo de política (borra la clave si profileId es null,
 // y el agente entero si se queda sin ninguna etapa), valida la política resultante completa
 // reconstruyendo un ModelRouter real (mismas comprobaciones que al arrancar: perfil inexistente,
 // reglas duplicadas, etc.) y, solo si es válida, la escribe a disco y recarga los dos cachés en
 // memoria que existen en este proceso (el de este runtime y el de OfficeIntelligence) para que
 // aplique de inmediato, sin reiniciar el servidor. El fingerprint de la política (ver
 // OfficeIntelligence.modelPolicyFingerprint) cambia con esto a propósito: un expediente en curso
 // con el fingerprint anterior sigue rechazando reanudar hasta una migración explícita, igual que
 // documenta docs/model-routing.md para cualquier otro cambio de política.
 async updateAgentModelProfile(token: string, raw: unknown) {
  const input = AgentModelProfileInput.parse(raw);
  return transaction(this.pool, async (tx) => {
   const auth = await this.auth(tx, token);
   await this.permit(tx, auth, null, 'data.write');
   const filePath = this.modelsFilePath();
   if (!filePath) throw new RuntimeError(409, 'La política de modelos no es editable en este servidor: falta VERIDIS_MODELS_FILE.');
   try { officeRegistry.get(input.agentId); } catch { throw new RuntimeError(404, 'Agente no registrado: ' + input.agentId); }
   const resolvedPath = resolve(filePath);
   const policyInput = JSON.parse(readFileSync(resolvedPath, 'utf8'));
   const agents = { ...(policyInput.agents ?? {}) } as Record<string, Record<string, string>>;
   const current = { ...(agents[input.agentId] ?? {}) };
   if (input.profileId === null) delete current[input.stage]; else current[input.stage] = input.profileId;
   if (Object.keys(current).length) agents[input.agentId] = current; else delete agents[input.agentId];
   const updated = { ...policyInput, agents };
   let router: ModelRouter;
   try { router = new ModelRouter(updated, process.env); }
   catch (error) { throw new RuntimeError(400, error instanceof Error ? error.message : 'Política de modelos inválida'); }
   writeFileSync(resolvedPath, JSON.stringify(updated, null, 2) + '\n', 'utf8');
   // loadRouterWatched() recarga sola en la siguiente llamada (el mtime del archivo ya cambió);
   // reloadModelRouter sigue siendo necesario porque OfficeIntelligence guarda su propia instancia.
   this.intelligence.reloadModelRouter?.(router);
   await this.audit(tx, auth, null, 'settings.model_policy_changed', { agentId: input.agentId, stage: input.stage, profileId: input.profileId });
   return { agentId: input.agentId, stage: input.stage, profileId: input.profileId };
  });
 }
 // Usado por el proxy de texto-a-voz (http.ts) para que la voz elegida en CONFIGURACIONES
 // aplique sin que el navegador vea nunca la API key. null si no hay preferencia guardada (la
 // llamada cae al valor fijo por entorno, igual que antes de que existiera esta pantalla).
 async elevenLabsVoiceId(token: string): Promise<string | null> {
  return transaction(this.pool, async (tx) => {
   const auth = await this.auth(tx, token);
   await this.permit(tx, auth, null, 'data.read');
   const row = await tx.query<{ value: string }>(
    "SELECT value FROM veridis_runtime_v1.settings WHERE scope_key=$1 AND key='elevenlabs.voiceId'", [scopeKey(auth.scope)]);
   return row.rows[0]?.value ?? null;
  });
 }
 async setElevenLabsVoice(token: string, raw: unknown) {
  const { voiceId } = ElevenLabsVoiceInput.parse(raw);
  return transaction(this.pool, async (tx) => {
   const auth = await this.auth(tx, token);
   await this.permit(tx, auth, null, 'data.write');
   await tx.query(
    `INSERT INTO veridis_runtime_v1.settings(scope_key,key,value,updated_by) VALUES($1,'elevenlabs.voiceId',$2,$3)
     ON CONFLICT (scope_key,key) DO UPDATE SET value=$2, updated_by=$3, updated_at=clock_timestamp()`,
    [scopeKey(auth.scope), JSON.stringify(voiceId), auth.principal],
   );
   await this.audit(tx, auth, null, 'settings.elevenlabs_voice_changed', { voiceId });
   return { voiceId };
  });
 }
 async assistantThreads(token: string) {
  return transaction(this.pool, async (tx) => {
   const auth = await this.auth(tx, token);
   await this.permit(tx, auth, null, 'data.read');
   const rows = await tx.query(
    `SELECT thread_id AS "threadId", (array_agg(question ORDER BY created_at))[1] AS title, count(*)::int AS messages,
      bool_and(mode = 'order') AS "onlyHandoffs", min(created_at) AS "createdAt", max(created_at) AS "updatedAt"
     FROM veridis_runtime_v1.assistant_messages WHERE scope_key=$1
     GROUP BY thread_id ORDER BY max(created_at) DESC LIMIT 50`, [scopeKey(auth.scope)]);
   return { threads: rows.rows };
  });
 }
 async assistantThread(token: string, threadId: string) {
  return transaction(this.pool, async (tx) => {
   const auth = await this.auth(tx, token);
   await this.permit(tx, auth, null, 'data.read');
   const rows = await tx.query(
    `SELECT id, thread_id AS "threadId", question, answer, mode, objective, memories, input_tokens AS "inputTokens",
      output_tokens AS "outputTokens", cost_micros::float8 AS "costMicros", latency_ms AS "latencyMs", created_at AS "createdAt"
     FROM veridis_runtime_v1.assistant_messages WHERE scope_key=$1 AND thread_id=$2 ORDER BY created_at`,
    [scopeKey(auth.scope), z.uuid().parse(threadId)]);
   if (!rows.rows.length) throw new RuntimeError(404, 'Conversación no disponible');
   return { threadId, messages: rows.rows };
  });
 }
 // Datos del mapa de memoria: nodos con su uso real y enlaces por similitud (MemoryStore.graph).
 async memoryGraph(token: string) {
  return transaction(this.pool, async (tx) => {
   const auth = await this.auth(tx, token);
   await this.permit(tx, auth, null, 'data.read');
   if (!this.memory) throw new RuntimeError(409, 'La memoria corporativa no está configurada en este servidor');
   return this.memory.graph(auth.scope);
  });
 }
 async validateMemory(token: string, raw_id: string) {
  const id = z.uuid().parse(raw_id);
  const { auth, validated } = await transaction(this.pool, async (tx) => {
   const auth = await this.auth(tx, token);
   await this.permit(tx, auth, null, 'approval.decide');
   if (!this.memory) throw new RuntimeError(409, 'La memoria corporativa no está configurada en este servidor');
   // "No encontrada en este ámbito" (incluida una de otro ámbito) es 404, igual que getFile();
   // cualquier otro motivo (ya validada, ya sustituida) es una transición inválida real y debe
   // seguir el camino genérico de abajo (409, mismo patrón que decideApproval en runtime/service.ts).
   const validated = await this.memory.validate(auth.scope, id).catch((error) => {
    if (error instanceof Error && error.message.includes('no encontrada')) throw new RuntimeError(404, error.message);
    throw error;
   });
   await this.audit(tx, auth, null, 'memory.validated', { memoryId: id, entityType: validated.entityType, entityId: validated.entityId, version: validated.version });
   return { auth, validated };
  });
  // Fuera de la transacción a propósito: escribir a disco no debe mantenerla abierta, y un fallo
  // aquí no debe revertir una validación que ya ocurrió de verdad en Postgres (la fuente de verdad).
  if (this.memoryVaultPath) {
   // Si esta validación puso otra memoria en cuarentena (contradicts), su archivo también se
   // reescribe: si no, Obsidian seguiría mostrando como vigente un dato ya refutado.
   const mirrored = [validated];
   if (validated.contradicts) {
    const target = await this.memory!.get(auth.scope, validated.contradicts).catch(() => null);
    if (target?.status === 'quarantined') mirrored.push(target);
   }
   for (const record of mirrored) {
    try {
     const filePath = exportRecordToVault(this.memoryVaultPath, record);
     await this.audit(this.pool, auth, null, 'memory.vault_exported', { memoryId: record.id, filePath });
    } catch (error) {
     await this.audit(this.pool, auth, null, 'memory.vault_export_failed', { memoryId: record.id, reason: error instanceof Error ? error.message : 'desconocido' });
    }
   }
  }
  return validated;
 }
 // Mismo permiso y forma que validateMemory: poner en cuarentena también es una decisión humana de
 // gobierno sobre memoria corporativa, nunca algo que un agente pueda hacer por sí mismo. El motivo
 // es obligatorio (QuarantineInput): a diferencia de "nunca se valida" para una propuesta mala, aquí
 // SÍ hace falta justificar por qué algo que ya era vigente deja de serlo.
 async quarantineMemory(token: string, raw_id: string, raw: unknown) {
  const id = z.uuid().parse(raw_id);
  const { reason } = QuarantineInput.parse(raw);
  const { auth, quarantined } = await transaction(this.pool, async (tx) => {
   const auth = await this.auth(tx, token);
   await this.permit(tx, auth, null, 'approval.decide');
   if (!this.memory) throw new RuntimeError(409, 'La memoria corporativa no está configurada en este servidor');
   const quarantined = await this.memory.quarantine(auth.scope, id, reason).catch((error) => {
    if (error instanceof Error && error.message.includes('no encontrada')) throw new RuntimeError(404, error.message);
    throw error;
   });
   await this.audit(tx, auth, null, 'memory.quarantined', { memoryId: id, entityType: quarantined.entityType, entityId: quarantined.entityId, version: quarantined.version, reason });
   return { auth, quarantined };
  });
  if (this.memoryVaultPath) {
   try {
    const filePath = exportRecordToVault(this.memoryVaultPath, quarantined);
    await this.audit(this.pool, auth, null, 'memory.vault_exported', { memoryId: id, filePath });
   } catch (error) {
    await this.audit(this.pool, auth, null, 'memory.vault_export_failed', { memoryId: id, reason: error instanceof Error ? error.message : 'desconocido' });
   }
  }
  return quarantined;
 }
 // Conexiones MCP (src/runtime/mcp-store.ts). Leer y agregar son trabajo normal (data.read / data.write);
 // activar herramientas que escriben, confirmar lo que conectó un agente y retirar una conexión son
 // decisiones de gobierno (approval.decide), igual que confirmar o descartar memoria. La conexión con
 // el servidor ocurre fuera de la transacción: puede tardar segundos y no debe retener la base.
 private async mcpAuth(token: string, operation: Operation): Promise<{ auth: Auth; mcp: McpStore }> {
  const auth = await transaction(this.pool, async (tx) => {
   const auth = await this.auth(tx, token);
   await this.permit(tx, auth, null, operation);
   return auth;
  });
  if (!this.mcp) throw new RuntimeError(409, 'Las conexiones MCP no están configuradas en este servidor');
  return { auth, mcp: this.mcp };
 }
 private async mcpCall<T>(work: () => Promise<T>): Promise<T> {
  try { return await work(); }
  catch (error) {
   if (error instanceof McpConnectError) throw new RuntimeError(400, error.message);
   throw error;
  }
 }
 async listConnections(token: string) {
  const { auth, mcp } = await this.mcpAuth(token, 'data.read');
  return { connections: await mcp.list(auth.scope) };
 }
 async addConnection(token: string, raw: unknown) {
  const input = McpConnectionInput.parse(raw);
  const { auth, mcp } = await this.mcpAuth(token, 'data.write');
  return this.mcpCall(() => mcp.connect(auth.scope, { name: input.name, url: input.url ?? null, purpose: input.purpose, credential: input.credential ?? null }, { principal: auth.principal }));
 }
 async refreshConnection(token: string, rawId: string) {
  const id = z.uuid().parse(rawId);
  const { auth, mcp } = await this.mcpAuth(token, 'data.write');
  return this.mcpCall(() => mcp.refresh(auth.scope, id, { principal: auth.principal }));
 }
 async setConnectionCredential(token: string, rawId: string, raw: unknown) {
  const id = z.uuid().parse(rawId);
  const { credential } = McpCredentialUpdate.parse(raw);
  const { auth, mcp } = await this.mcpAuth(token, 'data.write');
  return this.mcpCall(() => mcp.setCredential(auth.scope, id, credential, { principal: auth.principal }));
 }
 async setConnectionTools(token: string, rawId: string, raw: unknown) {
  const id = z.uuid().parse(rawId);
  const change = McpToolsInput.parse(raw);
  const { auth, mcp } = await this.mcpAuth(token, 'approval.decide');
  return mcp.setTools(auth.scope, id, change, { principal: auth.principal });
 }
 async confirmConnection(token: string, rawId: string) {
  const id = z.uuid().parse(rawId);
  const { auth, mcp } = await this.mcpAuth(token, 'approval.decide');
  return mcp.confirm(auth.scope, id, { principal: auth.principal });
 }
 async removeConnection(token: string, rawId: string) {
  const id = z.uuid().parse(rawId);
  const { auth, mcp } = await this.mcpAuth(token, 'approval.decide');
  return mcp.remove(auth.scope, id, { principal: auth.principal });
 }
 async answer(token: string, id: string, raw: unknown) {
  const auth = await transaction(this.pool, async (tx) => this.auth(tx, token));
  return this.answerWithAuth(auth, id, raw);
 }
 // Compartido con answer(): un llamador de confianza dentro del mismo proceso (sin sesión/token)
 // construye su propio Auth directo, igual que startScheduled() ya hace para el scheduler — el
 // permiso real sigue viniendo de un grant real en la tabla grants, nunca de confiar en quien llama.
 private async answerWithAuth(auth: Auth, id: string, raw: unknown) {
  const input = AnswerInput.parse(raw);
  const threadId = await transaction(this.pool, async (tx) => {
   const threadId = await this.indexRow(tx, auth, id);
   await this.permit(tx, auth, id, 'draft.create');
   return threadId;
  });
  const config = { configurable: { thread_id: threadId }, recursionLimit: 300 };
  const before = await this.graph().getState(config);
  if (!before.next.length) throw new RuntimeError(409, 'No hay una pregunta pendiente que responder');
  await this.graph().invoke(new Command({ resume: input.answer }), config);
  const snapshot = await this.graph().getState(config);
  const state = snapshot.values as Parameters<typeof this.shape>[0];
  await this.syncIndex(id, auth.scope, (state.order as { objective: string }).objective, (state.order as { status: string }).status, state.modelCalls as ModelCallRecord[]);
  this.scheduleDistill(auth, id, state.order);
  await this.audit(this.pool, auth, id, 'office.answered', {});
  return { id, ...this.shape(state, snapshot) };
 }
 // Mismo patrón que startScheduled(): un llamador interno de confianza (el puente de Telegram,
 // src/runtime/telegram.ts) actúa con su propio principal de servicio, nunca con el de quien le
 // escribió — el mensaje de Telegram es un dato de entrada (el objective), no una identidad.
 async startAsService(principal: Principal, scope: AccessScope, objective: string) {
  const auth: Auth = { principal, scope };
  await transaction(this.pool, async (tx) => { await this.permit(tx, auth, null, 'draft.create'); });
  return this.startWithAuth(auth, objective);
 }
 async answerAsService(principal: Principal, scope: AccessScope, id: string, raw: unknown) {
  return this.answerWithAuth({ principal, scope }, id, raw);
 }
}
