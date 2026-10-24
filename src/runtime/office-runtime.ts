import { randomUUID } from 'node:crypto';
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
import { officeRegistry } from '../office/registry.js';
import { HumanAnswer } from '../office/runtime-contracts.js';
import type { OfficeIntelligence, HumanExchange } from '../office/runtime-contracts.js';
import { fireOnce } from './scheduler.js';

type Tx = PoolClient;
type Auth = { principal: Principal; scope: AccessScope };
const officeResource = (scope: AccessScope) => ({ type: 'workflow', id: 'office-pilot', scope });
const StartInput = z.object({ objective: z.string().trim().min(1).max(4000) }).strict();
const AnswerInput = z.object({ answer: HumanAnswer }).strict();
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

// Reabre, bajo la misma sesión/autorización que runtime/, la ejecución real de office/ que
// los comandos CLI office:run/resume/answer suspendieron (ver docs/runtime-pilot.md). A
// diferencia de ContentRuntime, cada avance puede disparar varias llamadas reales de una sola
// vez: el tope está en maxTurns del workflow, no en un presupuesto en dólares por expediente.
export class OfficeRuntime {
 private readonly saver: PostgresSaver;
 constructor(
  private readonly pool: Pool, private readonly intelligence: OfficeIntelligence,
  private readonly options: { maxTurns?: number; maxRejectedDecisions?: number; maxQuestions?: number } = {},
 ) {
  this.saver = new PostgresSaver(pool);
 }
 async setup() { await this.saver.setup(); }
 private graph() {
  return createOfficeWorkflow(this.intelligence, officeRegistry, this.saver, this.options);
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
 private async syncIndex(id: string, scope: AccessScope, objective: string, status: string, scheduleId: string | null = null) {
  await this.pool.query(
   `INSERT INTO veridis_runtime_v1.office_orders(id,scope_key,thread_id,objective,status,created_by_schedule_id)
    VALUES($1,$2,$3,$4,$5,$6)
    ON CONFLICT (id) DO UPDATE SET status=$5, updated_at=clock_timestamp()`,
   [id, scopeKey(scope), `${OFFICE_WORKFLOW_VERSION}:${id}`, objective, status, scheduleId],
  );
 }
 // La pregunta de un ask_user pendiente vive en snapshot.tasks[].interrupts, no en el estado
 // que devuelve invoke(); hay que leerla aparte para mostrar el texto, no solo "interrumpido".
 private shape(
  state: { order: unknown; turns: number; rejectedDecisions: number; lastError: string | null; modelCalls: unknown[]; exchanges: HumanExchange[] },
  snapshot: { next: readonly string[]; tasks: readonly { interrupts?: readonly { value?: unknown }[] }[] },
 ) {
  const pendingQuestion = snapshot.tasks.flatMap((t) => t.interrupts ?? [])
   .map((i) => i.value as { question?: string } | undefined).find((v) => v?.question)?.question ?? null;
  return { order: state.order, turns: state.turns, rejectedDecisions: state.rejectedDecisions, lastError: state.lastError,
   modelCalls: state.modelCalls, exchanges: state.exchanges, interrupted: snapshot.next.length > 0, pendingQuestion,
   limits: { maxTurns: this.options.maxTurns ?? 100, maxRejectedDecisions: this.options.maxRejectedDecisions ?? 3, maxQuestions: this.options.maxQuestions ?? 5 } };
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
   limits: { maxTasks: 10, maxSteps: 60, maxRevisionsPerTask: 2 },
  });
  await this.syncIndex(id, auth.scope, objective, 'active', options.scheduleId ?? null);
  const config = { configurable: { thread_id: threadId }, recursionLimit: 300 };
  await this.graph().invoke({ order }, config);
  const snapshot = await this.graph().getState(config);
  const state = snapshot.values as Parameters<typeof this.shape>[0];
  await this.syncIndex(id, auth.scope, objective, (state.order as { status: string }).status, options.scheduleId ?? null);
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
 async get(token: string, id: string) {
  const { auth, threadId } = await transaction(this.pool, async (tx) => {
   const auth = await this.auth(tx, token);
   const threadId = await this.indexRow(tx, auth, id);
   await this.permit(tx, auth, id, 'data.read');
   return { auth, threadId };
  });
  const config = { configurable: { thread_id: threadId }, recursionLimit: 300 };
  const snapshot = await this.graph().getState(config);
  if (!snapshot.values.order) throw new RuntimeError(404, 'Expediente no disponible');
  return { id, ...this.shape(snapshot.values as Parameters<typeof this.shape>[0], snapshot) };
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
  await this.syncIndex(id, auth.scope, (state.order as { objective: string }).objective, (state.order as { status: string }).status);
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
 async answer(token: string, id: string, raw: unknown) {
  const input = AnswerInput.parse(raw);
  const { auth, threadId } = await transaction(this.pool, async (tx) => {
   const auth = await this.auth(tx, token);
   const threadId = await this.indexRow(tx, auth, id);
   await this.permit(tx, auth, id, 'draft.create');
   return { auth, threadId };
  });
  const config = { configurable: { thread_id: threadId }, recursionLimit: 300 };
  const before = await this.graph().getState(config);
  if (!before.next.length) throw new RuntimeError(409, 'No hay una pregunta pendiente que responder');
  await this.graph().invoke(new Command({ resume: input.answer }), config);
  const snapshot = await this.graph().getState(config);
  const state = snapshot.values as Parameters<typeof this.shape>[0];
  await this.syncIndex(id, auth.scope, (state.order as { objective: string }).objective, (state.order as { status: string }).status);
  await this.audit(this.pool, auth, id, 'office.answered', {});
  return { id, ...this.shape(state, snapshot) };
 }
}
