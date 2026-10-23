import { createHash, randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import { z } from 'zod';
import { authorize, authorizeDelegation } from '../governance/authorization.js';
import { actionDigest, authorizeAction, decideApproval, requestApproval } from '../governance/approvals.js';
import { AccessScope, ApprovalRecord, ExecutionBudget, PermissionGrant, Principal, type ExecutionContext, type Operation } from '../governance/contracts.js';
import { ArtifactVersion } from '../governance/enterprise-contracts.js';
import { officeRegistry } from '../office/registry.js';
import { agentSummary } from '../office/agent-files.js';
import { scopeKey, tokenHash, transaction } from './database.js';
import { Content, Defaults, Review, Run, RuntimeError, StartRequest, executor, orchestrator, reviewer, worker, workflowResource } from './contracts.js';
import type { DeliveryConnector, ModelGateway, ModelResult } from './providers.js';
import { pilotCapabilities, validateCapability } from './capability-catalog.js';

type Tx = PoolClient;
type Auth = { principal: Principal; scope: AccessScope };
const digest = (text: string) => createHash('sha256').update(text).digest('hex');
const RetryInput = z.object({ text: Content.shape.text }).strict();
// Rechazar exige explicar por qué (regenerar/revisar depende de ese motivo); aprobar no.
const ApprovalInput = z.object({ version: z.number().int().positive(), decision: z.enum(['approved', 'rejected', 'revoked']), reason: z.string().trim().min(1).max(4000).optional() })
 .strict().refine((v) => v.decision !== 'rejected' || Boolean(v.reason), 'Rechazar requiere indicar un motivo');
const RUN_STATUSES = Run.shape.status.options;
const ListRunsQuery = z.object({
 status: z.array(Run.shape.status).min(1).max(RUN_STATUSES.length).optional(),
 limit: z.number().int().min(1).max(100),
 cursor: z.string().trim().min(1).max(200).optional(),
}).strict();
const Cursor = z.object({ createdAt: z.string(), id: z.uuid() }).strict();
const encodeCursor = (value: z.infer<typeof Cursor>) => Buffer.from(JSON.stringify(Cursor.parse(value))).toString('base64url');
const decodeCursor = (raw: string) => {
 try { return Cursor.parse(JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'))); }
 catch { throw new RuntimeError(400, 'Cursor inválido'); }
};
// Estados que requieren atención humana; calculado aquí para que el cliente no deba repetir la regla.
const ATTENTION_STATUSES = new Set<Run['status']>(['awaiting_approval', 'failed', 'outcome_unknown']);
const summarize = (run: Run) => ({
 id: run.id, status: run.status, brief: run.brief, createdAt: run.createdAt, deadline: run.deadline,
 version: run.version, reservedCostMicros: run.reservedCostMicros, budget: run.budget,
 modelCalls: run.modelCalls, toolCalls: run.toolCalls, approverHumanId: run.approverHumanId,
 createdByHumanId: run.createdByHumanId, needsAttention: ATTENTION_STATUSES.has(run.status),
});
export class ContentRuntime {
 readonly budget: z.infer<typeof ExecutionBudget>;
 constructor(readonly pool: Pool, private readonly model: ModelGateway, private readonly connector: DeliveryConnector,
  private readonly options: { budget?: z.infer<typeof ExecutionBudget>; modelReservationMicros?: number; toolReservationMicros?: number; callTimeoutMs?: number } = {}) {
  this.budget = ExecutionBudget.parse(options.budget ?? Defaults);
  for (const n of [options.modelReservationMicros ?? 10000, options.toolReservationMicros ?? 1000, options.callTimeoutMs ?? 30000]) {
   if (!Number.isSafeInteger(n) || n <= 0) throw new Error('Reserva o límite inválido');
  }
 }
 private async auth(tx: Tx, token: string): Promise<Auth> {
  if (!token || token.length > 200) throw new RuntimeError(401, 'Sesión inválida');
  const result = await tx.query('SELECT principal,scope FROM veridis_runtime_v1.sessions WHERE token_hash=$1 AND NOT revoked AND expires_at > clock_timestamp()', [tokenHash(token)]);
  if (!result.rows[0]) throw new RuntimeError(401, 'Sesión inválida o vencida');
  const principal = Principal.parse(result.rows[0].principal);
  if (principal.kind !== 'human') throw new RuntimeError(401, 'Se requiere sesión humana');
  return { principal, scope: AccessScope.parse(result.rows[0].scope) };
 }
 private context(auth: Auth, id: string, principal = auth.principal): ExecutionContext {
  return { schemaVersion: 1, runId: id, correlationId: id, scope: auth.scope, principal };
 }
 private async grants(tx: Tx, scope: AccessScope) {
  const rows = await tx.query('SELECT data FROM veridis_runtime_v1.grants WHERE scope_key=$1', [scopeKey(scope)]);
  return rows.rows.map((r) => PermissionGrant.parse(r.data));
 }
 private async audit(tx: Tx | Pool, auth: Auth, runId: string | null, event: string, details: Record<string, unknown> = {}) {
  await tx.query('INSERT INTO veridis_runtime_v1.audit(run_id,scope_key,data) VALUES($1,$2,$3)',
   [runId, scopeKey(auth.scope), { principal: auth.principal, event, ...details }]);
 }
 // id es null para operaciones de ámbito que no refieren un expediente concreto (por ejemplo, listar).
 private async permit(tx: Tx, auth: Auth, id: string | null, operation: Operation, principal = auth.principal) {
  const ctx = this.context(auth, id ?? randomUUID(), principal);
  const decision = authorize(ctx, operation, workflowResource(auth.scope), await this.grants(tx, auth.scope), new Date());
  if (!decision.allowed) {
   await this.audit(this.pool, { ...auth, principal }, null, 'authorization.denied', { requestedRunId: id, operation });
   throw new RuntimeError(403, 'Sin autorización para esta operación');
  }
  await this.audit(tx, { ...auth, principal }, id, 'authorization.allowed', { operation, grantIds: decision.grantIds });
 }
 private async load(tx: Tx, auth: Auth, id: string, lock = false): Promise<Run> {
  const rows = await tx.query('SELECT data FROM veridis_runtime_v1.runs WHERE id=$1 AND scope_key=$2' + (lock ? ' FOR UPDATE' : ''), [z.uuid().parse(id), scopeKey(auth.scope)]);
  if (!rows.rows[0]) {
   await this.audit(this.pool, auth, null, 'resource.denied', { requestedRunId: id });
   throw new RuntimeError(404, 'Expediente no disponible');
  }
  return Run.parse(rows.rows[0].data);
 }
 private async save(tx: Tx, run: Run) {
  await tx.query('UPDATE veridis_runtime_v1.runs SET data=$2 WHERE id=$1', [run.id, Run.parse(run)]);
  await tx.query("UPDATE veridis_runtime_v1.tasks SET data=data || $2::jsonb WHERE run_id=$1 AND id='content'", [run.id, { status: run.status, artifactVersion: run.version }]);
 }
 async recordRejected(token: string, event: string) {
  // No conservar cuerpos de solicitudes ni secretos en la auditoría de errores.
  try {
   await transaction(this.pool, async (tx) => {
    const auth = await this.auth(tx, token);
    await this.audit(tx, auth, null, 'request.rejected', { event });
   });
  } catch { /* Una sesión no verificable no se convierte en identidad de auditoría. */ }
 }
 async start(token: string, raw: unknown) {
  const input = StartRequest.parse(raw); const id = randomUUID();
  await transaction(this.pool, async (tx) => {
   const auth = await this.auth(tx, token);
   await this.permit(tx, auth, id, 'draft.create');
   const grants = await this.grants(tx, auth.scope);
   for (const principal of [auth.principal, orchestrator]) {
    const decision = authorizeDelegation({ context: this.context(auth, id, principal), assigneeAgentId: worker.id, capability: 'content.draft' }, grants, (agentId) => officeRegistry.get(agentId), new Date());
    if (!decision.allowed) throw new RuntimeError(403, 'Delegación no autorizada');
   }
   const now = new Date();
   const run = Run.parse({ id, scope: auth.scope, createdByHumanId: auth.principal.id, approverHumanId: input.approverHumanId,
    brief: input.brief, status: 'queued', version: 0, createdAt: now.toISOString(), deadline: new Date(now.getTime() + this.budget.maxDurationMs).toISOString(),
    budget: this.budget, reservedCostMicros: 0, modelCalls: 0, toolCalls: 0, leaseUntil: null, activeAttemptId: null, action: null, review: null });
   await tx.query('INSERT INTO veridis_runtime_v1.runs(id,scope_key,data) VALUES($1,$2,$3)', [id, scopeKey(auth.scope), run]);
   await tx.query('INSERT INTO veridis_runtime_v1.tasks(run_id,id,data) VALUES($1,$2,$3)', [id, 'content', { assignedAgentId: worker.id, capability: 'content.draft', status: 'pending' }]);
   await this.audit(tx, { ...auth, principal: orchestrator }, id, 'plan.created', { capability: 'content.draft', assignedAgentId: worker.id, requestedBy: auth.principal });
  });
  return this.get(token, id);
 }
 async get(token: string, id: string) {
  return transaction(this.pool, async (tx) => {
   const auth = await this.auth(tx, token); const run = await this.load(tx, auth, id);
   await this.permit(tx, auth, id, 'data.read');
   const artifacts = await tx.query('SELECT version,content,content_hash,data FROM veridis_runtime_v1.artifacts WHERE run_id=$1 ORDER BY version', [id]);
   const attempts = await tx.query('SELECT data FROM veridis_runtime_v1.attempts WHERE run_id=$1 ORDER BY id', [id]);
   const audit = await tx.query('SELECT sequence,occurred_at,data FROM veridis_runtime_v1.audit WHERE run_id=$1 ORDER BY sequence', [id]);
   const approvals = await tx.query('SELECT version,data FROM veridis_runtime_v1.approvals WHERE run_id=$1 ORDER BY version', [id]);
   return { run, artifacts: artifacts.rows, attempts: attempts.rows.map((r) => r.data), audit: audit.rows, approvals: approvals.rows };
  });
 }
 async list(token: string, raw: unknown) {
  const query = ListRunsQuery.parse(raw);
  return transaction(this.pool, async (tx) => {
   const auth = await this.auth(tx, token);
   await this.permit(tx, auth, null, 'data.read');
   const cursor = query.cursor ? decodeCursor(query.cursor) : null;
   const rows = await tx.query<{ data: Run }>(
    `SELECT data FROM veridis_runtime_v1.runs
     WHERE scope_key=$1 AND ($2::text[] IS NULL OR status = ANY($2))
       AND ($3::text IS NULL OR (created_at,id) < ($3,$4))
     ORDER BY created_at DESC, id DESC LIMIT $5`,
    [scopeKey(auth.scope), query.status ?? null, cursor?.createdAt ?? null, cursor?.id ?? null, query.limit],
   );
   const runs = rows.rows.map((r) => summarize(Run.parse(r.data)));
   await this.audit(tx, auth, null, 'runs.listed', { statusFilter: query.status ?? null, limit: query.limit, count: runs.length });
   const last = rows.rows.at(-1)?.data;
   return { runs, nextCursor: last && runs.length === query.limit ? encodeCursor({ createdAt: last.createdAt, id: last.id }) : null };
  });
 }
 // El organigrama no es dato de un cliente/proyecto (no tiene AccessScope propio); se protege
 // igual que el resto del piloto por consistencia, no porque workflow/content-pilot sea su recurso real.
 async organization(token: string) {
  return transaction(this.pool, async (tx) => {
   const auth = await this.auth(tx, token);
   await this.permit(tx, auth, null, 'data.read');
   if (!officeRegistry.organization) throw new RuntimeError(404, 'No hay organigrama configurado');
   return { organization: officeRegistry.organization.snapshot(), agents: officeRegistry.list().map(agentSummary) };
  });
 }
 // Perfil completo de un solo agente, incluidas sus instrucciones (system prompt) y contexto.
 // Solo lectura: no hay todavía una vía autorizada para modificar prompts desde aquí
 // (ver docs/runtime-pilot.md sobre por qué la edición queda para después).
 async agent(token: string, id: string) {
  return transaction(this.pool, async (tx) => {
   const auth = await this.auth(tx, token);
   await this.permit(tx, auth, null, 'data.read');
   try { return officeRegistry.get(id); }
   catch { throw new RuntimeError(404, 'Agente no encontrado en el catálogo'); }
  });
 }
 private reserve(run: Run, kind: 'model' | 'tool') {
  const now = Date.now(); const reservation = kind === 'model' ? this.options.modelReservationMicros ?? 10000 : this.options.toolReservationMicros ?? 1000;
  if (now >= Date.parse(run.deadline) || run.reservedCostMicros + reservation > run.budget.maxCostMicros
   || (kind === 'model' ? run.modelCalls >= run.budget.maxModelCalls : run.toolCalls >= run.budget.maxToolCalls)) throw new RuntimeError(409, 'Límite de ejecución o presupuesto alcanzado');
  run.reservedCostMicros += reservation;
  if (kind === 'model') run.modelCalls++; else run.toolCalls++;
  return reservation;
 }
 private async artifact(tx: Tx, run: Run, text: string) {
  run.version++;
  run.action = { schemaVersion: 1, id: `${run.id}.v${run.version}`, version: run.version, requestedBy: executor,
   operation: 'content.publish', resource: workflowResource(run.scope),
   input: { artifactId: run.id, artifactVersion: run.version, contentHash: digest(text) },
   idempotencyKey: `${run.id}.v${run.version}`, expiresAt: run.deadline };
  const data = ArtifactVersion.parse({ schemaVersion: 1, artifactId: run.id, version: run.version, scope: run.scope,
   owner: worker, kind: 'deliverable', status: 'in_review', storageReference: `postgres://${run.id}/${run.version}`,
   contentHash: digest(text), mediaType: 'text/plain', createdAt: new Date().toISOString(), taskIds: ['content'], sourceVersionRefs: [], approvalIds: [] });
  await tx.query('INSERT INTO veridis_runtime_v1.artifacts(run_id,version,content,content_hash,data) VALUES($1,$2,$3,$4,$5)', [run.id, run.version, text, digest(text), data]);
  run.status = 'awaiting_review'; run.review = null;
 }
 private async bounded<T>(work: (signal: AbortSignal) => Promise<T>, deadline: string): Promise<T> {
  const timeoutMs = Math.min(this.options.callTimeoutMs ?? 30000, Date.parse(deadline) - Date.now());
  if (timeoutMs <= 0) throw new RuntimeError(409, 'Plazo agotado');
  const controller = new AbortController(); let timer: ReturnType<typeof setTimeout>;
  try {
   return await Promise.race([work(controller.signal), new Promise<never>((_, reject) => {
    timer = setTimeout(() => { controller.abort(); reject(new Error('Tiempo de llamada agotado')); }, timeoutMs);
   })]);
  } finally { clearTimeout(timer!); }
 }
 private async runModel(token: string, id: string, stage: 'generate' | 'review', options: { regenerate?: boolean } = {}) {
  const agent = stage === 'generate' ? worker : reviewer;
  const capability = stage === 'generate' ? 'content.draft' : 'work.review';
  if (!pilotCapabilities.candidates(capability, 1).some((b) => b.agentId === agent.id)) throw new RuntimeError(403, 'Capacidad no habilitada');
  const info = this.model.identify(stage); // Metadatos del adaptador, no del modelo.
  const claim = await transaction(this.pool, async (tx) => {
   const auth = await this.auth(tx, token); const run = await this.load(tx, auth, id, true);
   await this.permit(tx, auth, id, 'draft.create');
   await this.permit(tx, auth, id, 'draft.create', agent);
   const grants = await this.grants(tx, auth.scope);
   const delegated = authorizeDelegation({ context: this.context(auth, id, orchestrator), assigneeAgentId: agent.id, capability }, grants, (agentId) => officeRegistry.get(agentId), new Date());
   if (!delegated.allowed) throw new RuntimeError(403, 'Delegación no autorizada');
   // Regenerar parte de una versión rechazada por un humano, no de un expediente recién creado.
   const expected = stage === 'generate' ? (options.regenerate ? 'awaiting_approval' : 'queued') : 'awaiting_review';
   const active = stage === 'generate' ? 'generating' : 'reviewing';
   if (run.status === active && run.leaseUntil && Date.parse(run.leaseUntil) <= Date.now()) {
    await tx.query("UPDATE veridis_runtime_v1.attempts SET data=data || $2::jsonb WHERE id=$1", [run.activeAttemptId, { outcome: 'unknown', finishedAt: new Date().toISOString() }]);
   } else if (run.status !== expected && !(run.status === 'failed' && (stage === 'generate' ? run.version === 0 : run.version > 0 && run.review === null))) {
    throw new RuntimeError(409, 'Etapa no disponible o ya en ejecución');
   }
   let feedback: { text: string; reason: string } | null = null;
   if (options.regenerate) {
    const approvalRow = await tx.query('SELECT data FROM veridis_runtime_v1.approvals WHERE run_id=$1 AND version=$2 FOR UPDATE', [id, run.version]);
    if (approvalRow.rows[0]?.data?.status !== 'rejected') throw new RuntimeError(409, 'Solo se puede regenerar una versión rechazada');
    const artifactRow = await tx.query('SELECT content FROM veridis_runtime_v1.artifacts WHERE run_id=$1 AND version=$2', [id, run.version]);
    feedback = { text: artifactRow.rows[0].content, reason: approvalRow.rows[0].data.reason ?? '' };
   }
   const reservationMicros = this.reserve(run, 'model'); const attemptId = randomUUID();
   const rows = stage === 'review' ? await tx.query('SELECT content FROM veridis_runtime_v1.artifacts WHERE run_id=$1 AND version=$2', [id, run.version]) : null;
   run.status = active; run.activeAttemptId = attemptId;
   run.leaseUntil = new Date(Date.now() + (this.options.callTimeoutMs ?? 30000) + 5000).toISOString();
   await this.save(tx, run);
   await tx.query('INSERT INTO veridis_runtime_v1.attempts(id,run_id,kind,data) VALUES($1,$2,$3,$4)', [attemptId, id, 'model', {
    agentId: agent.id, departmentId: officeRegistry.get(agent.id).organization!.departmentId,
    ...info, stage, startedAt: new Date().toISOString(), outcome: 'pending', inputTokens: null, outputTokens: null,
    costMicros: null, costStatus: 'unknown', reservationMicros, currency: run.budget.currency,
   }]);
   await this.audit(tx, { ...auth, principal: agent }, id, 'model.reserved', { attemptId, reservationMicros, stage, regenerate: Boolean(options.regenerate) });
   return { run, auth, attemptId, regenerate: Boolean(options.regenerate),
    data: { brief: run.brief, ...(rows ? { text: rows.rows[0].content as string } : {}), ...(feedback ? { text: feedback.text, feedback: feedback.reason } : {}) } };
  });
  let result: ModelResult | undefined; let failed = false;
  try {
   validateCapability(capability, 'input', claim.data);
   result = await this.bounded((signal) => this.model.invoke(stage, claim.data, signal), claim.run.deadline);
   validateCapability(capability, 'output', result.output);
   (stage === 'generate' ? Content : Review).parse(result.output);
   for (const count of [result.inputTokens, result.outputTokens]) if (count !== null && (!Number.isSafeInteger(count) || count < 0)) throw new Error('Consumo inválido');
  } catch { failed = true; }
  await transaction(this.pool, async (tx) => {
   const run = await this.load(tx, claim.auth, id, true);
   const current = run.activeAttemptId === claim.attemptId;
   await tx.query('UPDATE veridis_runtime_v1.attempts SET data=data || $2::jsonb WHERE id=$1', [claim.attemptId, {
    outcome: !current ? 'discarded' : failed ? 'failed' : 'succeeded', finishedAt: new Date().toISOString(),
    inputTokens: result?.inputTokens ?? null, outputTokens: result?.outputTokens ?? null,
   }]);
   if (!current) return;
   run.activeAttemptId = null; run.leaseUntil = null;
   if (failed) run.status = 'failed';
   else if (stage === 'generate') await this.artifact(tx, run, Content.parse(result!.output).text);
   else {
    run.review = Review.parse(result!.output);
    run.status = run.review.accepted ? 'awaiting_approval' : 'failed';
    if (run.review.accepted) {
     const approval = requestApproval({ id: randomUUID(), action: run.action!, approver: { kind: 'human', id: run.approverHumanId }, expiresAt: run.deadline }, new Date());
     await tx.query('INSERT INTO veridis_runtime_v1.approvals(run_id,version,data) VALUES($1,$2,$3)', [id, run.version, approval]);
    }
   }
   await this.save(tx, run);
   await this.audit(tx, { ...claim.auth, principal: agent }, id, failed ? 'model.failed' : 'model.completed', { attemptId: claim.attemptId, version: run.version, regenerate: claim.regenerate });
  });
  if (failed) throw new RuntimeError(502, 'Falló el modelo; intento y reserva registrados');
 }
 // Regenera la versión rechazada: una sola llamada real de generación que recibe el texto
 // anterior y el motivo exacto del rechazo humano. El humano sigue decidiendo cuándo gastarla
 // (lo dispara un clic explícito en la UI, nunca automáticamente al rechazar).
 async regenerate(token: string, id: string) {
  await this.runModel(token, id, 'generate', { regenerate: true });
  return this.get(token, id);
 }
 async advance(token: string, id: string) {
  // El grafo usa solo referencias. La sesión no entra en su estado ni en checkpoints.
  const State = Annotation.Root({ id: Annotation<string>(), stage: Annotation<string>() });
  const graph = new StateGraph(State).addNode('observe', async () => {
   const { run } = await this.get(token, id);
   return { stage: ['queued', 'generating'].includes(run.status) || (run.status === 'failed' && !run.version) ? 'generate'
    : ['awaiting_review', 'reviewing'].includes(run.status) || (run.status === 'failed' && !run.review) ? 'review' : 'end' };
  }).addNode('generate', async () => { await this.runModel(token, id, 'generate'); return {}; })
   .addNode('review', async () => { await this.runModel(token, id, 'review'); return {}; })
   .addEdge(START, 'observe').addConditionalEdges('observe', (s) => s.stage, { generate: 'generate', review: 'review', end: END })
   .addEdge('generate', 'review').addEdge('review', END).compile();
  await graph.invoke({ id }, { recursionLimit: 10 });
  return this.get(token, id);
 }
 async revise(token: string, id: string, raw: unknown) {
  const input = RetryInput.parse(raw);
  await transaction(this.pool, async (tx) => {
   const auth = await this.auth(tx, token); const run = await this.load(tx, auth, id, true);
   await this.permit(tx, auth, id, 'draft.create');
   if (['generating', 'reviewing', 'dispatching', 'outcome_unknown', 'completed'].includes(run.status) || Date.now() >= Date.parse(run.deadline)) throw new RuntimeError(409, 'No se puede modificar esta etapa');
   // Conserva la aprobación histórica y revoca únicamente la versión afectada.
   await tx.query("UPDATE veridis_runtime_v1.approvals SET data=data || $3::jsonb WHERE run_id=$1 AND version=$2", [id, run.version, { status: 'revoked', decidedAt: new Date().toISOString(), reason: 'Versión sustituida' }]);
   await tx.query("UPDATE veridis_runtime_v1.artifacts SET data=data || $3::jsonb WHERE run_id=$1 AND version=$2", [id, run.version, { status: 'superseded' }]);
   await this.artifact(tx, run, input.text); await this.save(tx, run);
   await this.audit(tx, auth, id, 'artifact.revised', { version: run.version });
  });
  return this.get(token, id);
 }
 async approve(token: string, id: string, raw: unknown) {
  const input = ApprovalInput.parse(raw);
  await transaction(this.pool, async (tx) => {
   const auth = await this.auth(tx, token); const run = await this.load(tx, auth, id, true);
   if (run.version !== input.version || !['awaiting_approval', 'approved'].includes(run.status)) throw new RuntimeError(409, 'Versión o estado de aprobación obsoleto');
   const rows = await tx.query('SELECT data FROM veridis_runtime_v1.approvals WHERE run_id=$1 AND version=$2 FOR UPDATE', [id, run.version]);
   const approval = decideApproval(ApprovalRecord.parse(rows.rows[0]?.data), run.action!, this.context(auth, id), input.decision, input.reason, await this.grants(tx, auth.scope), new Date());
   await tx.query('UPDATE veridis_runtime_v1.approvals SET data=$3 WHERE run_id=$1 AND version=$2', [id, run.version, approval]);
   run.status = input.decision === 'approved' ? 'approved' : 'awaiting_approval'; await this.save(tx, run);
   await tx.query("UPDATE veridis_runtime_v1.artifacts SET data=data || $3::jsonb WHERE run_id=$1 AND version=$2", [id, run.version, { status: input.decision === 'approved' ? 'approved' : 'in_review', approvalIds: [approval.id] }]);
   await this.audit(tx, auth, id, 'approval.' + input.decision, { approvalId: approval.id, actionDigest: actionDigest(run.action!) });
  });
  return this.get(token, id);
 }
 async execute(token: string, id: string) {
  const claim = await transaction(this.pool, async (tx) => {
   const auth = await this.auth(tx, token); const run = await this.load(tx, auth, id, true);
   await this.permit(tx, auth, id, 'content.publish');
   if (run.status !== 'approved') throw new RuntimeError(409, 'La ejecución requiere una aprobación vigente');
   const rows = await tx.query('SELECT data FROM veridis_runtime_v1.approvals WHERE run_id=$1 AND version=$2 FOR UPDATE', [id, run.version]);
   const permission = authorizeAction(this.context(auth, id, executor), run.action!, await this.grants(tx, auth.scope), ApprovalRecord.parse(rows.rows[0]?.data), new Date());
   if (!permission.allowed) throw new RuntimeError(403, 'Ejecución no autorizada');
   const artifact = (await tx.query('SELECT content,content_hash FROM veridis_runtime_v1.artifacts WHERE run_id=$1 AND version=$2', [id, run.version])).rows[0];
   if (digest(artifact.content) !== artifact.content_hash || artifact.content_hash !== run.action!.input.contentHash) throw new RuntimeError(409, 'Integridad de artefacto inválida');
   const reservationMicros = this.reserve(run, 'tool'); const attemptId = randomUUID();
   run.status = 'dispatching'; run.activeAttemptId = attemptId;
   run.leaseUntil = new Date(Date.now() + (this.options.callTimeoutMs ?? 30000) + 5000).toISOString();
   await this.save(tx, run);
   await tx.query('INSERT INTO veridis_runtime_v1.operations(run_id,version,idempotency_key,data) VALUES($1,$2,$3,$4)', [id, run.version, run.action!.idempotencyKey, {
    status: 'dispatching', actionDigest: actionDigest(run.action!), contentHash: artifact.content_hash, approvalId: permission.approvalId,
    key: run.action!.idempotencyKey, externalReference: null, attemptId, lookupCount: 0,
   }]);
   await tx.query('INSERT INTO veridis_runtime_v1.attempts(id,run_id,kind,data) VALUES($1,$2,$3,$4)', [attemptId, id, 'tool', {
    agentId: executor.id, provider: 'delivery-connector', startedAt: new Date().toISOString(), outcome: 'pending', reservationMicros,
    costMicros: null, costStatus: 'unknown', currency: run.budget.currency, inputTokens: null, outputTokens: null,
   }]);
   await this.audit(tx, { ...auth, principal: executor }, id, 'tool.dispatching', { attemptId, actionDigest: actionDigest(run.action!), approvalId: permission.approvalId, grantIds: permission.grantIds });
   return { auth, run, attemptId, artifact };
  });
  let reference: string | null = null;
  try { reference = (await this.bounded((signal) => this.connector.send(claim.run.action!.idempotencyKey, {
   text: claim.artifact.content, contentHash: claim.artifact.content_hash,
  }, signal), claim.run.deadline)).reference; } catch { /* No presumir que la operación no ocurrió. */ }
  await this.finishDelivery(claim.auth, id, claim.attemptId, reference);
  return this.get(token, id);
 }
 private async finishDelivery(auth: Auth, id: string, attemptId: string, reference: string | null, lookupId?: string) {
  await transaction(this.pool, async (tx) => {
   const run = await this.load(tx, auth, id, true);
   if (run.activeAttemptId !== attemptId) return;
   run.status = reference ? 'completed' : 'outcome_unknown'; run.leaseUntil = null;
   if (reference) run.activeAttemptId = null;
   await this.save(tx, run);
   await tx.query('UPDATE veridis_runtime_v1.operations SET data=data || $3::jsonb WHERE run_id=$1 AND version=$2', [id, run.version, { status: reference ? 'confirmed' : 'outcome_unknown', externalReference: reference }]);
   await tx.query('UPDATE veridis_runtime_v1.attempts SET data=data || $2::jsonb WHERE id=$1', [attemptId, { outcome: reference ? 'succeeded' : 'unknown', finishedAt: new Date().toISOString() }]);
   if (reference) await tx.query("UPDATE veridis_runtime_v1.artifacts SET data=data || $3::jsonb WHERE run_id=$1 AND version=$2", [id, run.version, { status: 'delivered' }]);
   if (lookupId) await tx.query('UPDATE veridis_runtime_v1.attempts SET data=data || $2::jsonb WHERE id=$1', [lookupId, {
    outcome: reference ? 'succeeded' : 'unknown', finishedAt: new Date().toISOString(),
   }]);
   await this.audit(tx, { ...auth, principal: executor }, id, reference ? 'tool.confirmed' : 'tool.outcome_unknown', { attemptId, externalReference: reference });
  });
 }
 async reconcile(token: string, id: string) {
  const claim = await transaction(this.pool, async (tx) => {
   const auth = await this.auth(tx, token); const run = await this.load(tx, auth, id, true);
   await this.permit(tx, auth, id, 'data.read'); await this.permit(tx, auth, id, 'data.read', executor);
   if (!['dispatching', 'outcome_unknown'].includes(run.status) || (run.leaseUntil && Date.parse(run.leaseUntil) > Date.now())) throw new RuntimeError(409, 'La operación está activa o no requiere conciliación');
   this.reserve(run, 'tool');
   run.leaseUntil = new Date(Date.now() + (this.options.callTimeoutMs ?? 30000) + 5000).toISOString(); await this.save(tx, run);
   const op = (await tx.query('SELECT data FROM veridis_runtime_v1.operations WHERE run_id=$1 AND version=$2', [id, run.version])).rows[0].data;
   const lookupId = randomUUID();
   await tx.query('INSERT INTO veridis_runtime_v1.attempts(id,run_id,kind,data) VALUES($1,$2,$3,$4)', [lookupId, id, 'tool', {
    agentId: executor.id, provider: 'delivery-lookup', startedAt: new Date().toISOString(), outcome: 'pending', costMicros: null,
    costStatus: 'unknown', reservationMicros: this.options.toolReservationMicros ?? 1000, currency: run.budget.currency, inputTokens: null, outputTokens: null,
   }]);
   return { auth, run, op, lookupId };
  });
  let reference: string | null = null;
  try { reference = (await this.bounded((signal) => this.connector.lookup(claim.op.key, claim.op.contentHash, signal), claim.run.deadline))?.reference ?? null; } catch { /* Conciliación manual si no se puede confirmar. */ }
  await this.finishDelivery(claim.auth, id, claim.run.activeAttemptId!, reference, claim.lookupId);
  return this.get(token, id);
 }
}
