import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { Command } from '@langchain/langgraph';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import { z } from 'zod';
import { authorize } from '../governance/authorization.js';
import { AccessScope, PermissionGrant, Principal, type Operation } from '../governance/contracts.js';
import { scopeKey, tokenHash, transaction } from './database.js';
import { RuntimeError } from './contracts.js';
import { createOrder } from '../office/contracts.js';
import { createOfficeWorkflow, OFFICE_WORKFLOW_VERSION } from '../office/workflow.js';
import { officeRegistry } from '../office/registry.js';
import { HumanAnswer } from '../office/runtime-contracts.js';
import type { OfficeIntelligence } from '../office/runtime-contracts.js';

type Tx = PoolClient;
type Auth = { principal: Principal; scope: AccessScope };
const officeResource = (scope: AccessScope) => ({ type: 'workflow', id: 'office-pilot', scope });
const StartInput = z.object({ objective: z.string().trim().min(1).max(4000) }).strict();
const AnswerInput = z.object({ answer: HumanAnswer }).strict();

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
 private async syncIndex(id: string, scope: AccessScope, objective: string, status: string) {
  await this.pool.query(
   `INSERT INTO veridis_runtime_v1.office_orders(id,scope_key,thread_id,objective,status)
    VALUES($1,$2,$3,$4,$5)
    ON CONFLICT (id) DO UPDATE SET status=$5, updated_at=clock_timestamp()`,
   [id, scopeKey(scope), `${OFFICE_WORKFLOW_VERSION}:${id}`, objective, status],
  );
 }
 // La pregunta de un ask_user pendiente vive en snapshot.tasks[].interrupts, no en el estado
 // que devuelve invoke(); hay que leerla aparte para mostrar el texto, no solo "interrumpido".
 private shape(
  state: { order: unknown; turns: number; rejectedDecisions: number; lastError: string | null; modelCalls: unknown[] },
  snapshot: { next: readonly string[]; tasks: readonly { interrupts?: readonly { value?: unknown }[] }[] },
 ) {
  const pendingQuestion = snapshot.tasks.flatMap((t) => t.interrupts ?? [])
   .map((i) => i.value as { question?: string } | undefined).find((v) => v?.question)?.question ?? null;
  return { order: state.order, turns: state.turns, rejectedDecisions: state.rejectedDecisions, lastError: state.lastError,
   modelCalls: state.modelCalls, interrupted: snapshot.next.length > 0, pendingQuestion,
   limits: { maxTurns: this.options.maxTurns ?? 100, maxRejectedDecisions: this.options.maxRejectedDecisions ?? 3, maxQuestions: this.options.maxQuestions ?? 5 } };
 }
 async start(token: string, raw: unknown) {
  const input = StartInput.parse(raw);
  const auth = await transaction(this.pool, async (tx) => {
   const auth = await this.auth(tx, token);
   await this.permit(tx, auth, null, 'draft.create');
   return auth;
  });
  const id = randomUUID();
  const threadId = `${OFFICE_WORKFLOW_VERSION}:${id}`;
  const order = createOrder({
   id, workspaceId: auth.scope.workspaceId, objective: input.objective,
   criteria: [{ id: 'delivery', description: 'Entregable que responde al objetivo, con evidencias y revisión independiente.' }],
   limits: { maxTasks: 10, maxSteps: 60, maxRevisionsPerTask: 2 },
  });
  await this.syncIndex(id, auth.scope, input.objective, 'active');
  const config = { configurable: { thread_id: threadId }, recursionLimit: 300 };
  await this.graph().invoke({ order }, config);
  const snapshot = await this.graph().getState(config);
  const state = snapshot.values as Parameters<typeof this.shape>[0];
  await this.syncIndex(id, auth.scope, input.objective, (state.order as { status: string }).status);
  await this.audit(this.pool, auth, id, 'office.started', { objective: input.objective });
  return { id, ...this.shape(state, snapshot) };
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
