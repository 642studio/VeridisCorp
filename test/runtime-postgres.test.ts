import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer, type Server } from 'node:http';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { Pool } from 'pg';
import { ContentRuntime } from '../src/runtime/service.js';
import { OfficeRuntime, scheduler } from '../src/runtime/office-runtime.js';
import { createRuntimeServer } from '../src/runtime/http.js';
import { migrate, provisionSession, scopeKey, tokenHash } from '../src/runtime/database.js';
import { executor, orchestrator, reviewer, worker, Defaults } from '../src/runtime/contracts.js';
import type { AccessScope, Principal } from '../src/governance/contracts.js';
import type { ModelGateway, DeliveryConnector } from '../src/runtime/providers.js';
import { AssistantReply, type OfficeIntelligence } from '../src/office/runtime-contracts.js';
import { officeRegistry } from '../src/office/registry.js';
import { persistGeneratedPdf } from '../src/office/intelligence.js';
import { MemoryStore } from '../src/runtime/memory-store.js';
import { MEMORY_EMBEDDING_DIMENSIONS, type Embedder } from '../src/runtime/embeddings.js';

// Determinista, sin IA real: crea una tarea, la despacha, la revisa y cierra el expediente.
function officeTestIntelligence(): OfficeIntelligence {
 return {
  async coordinate({ order }) {
   const task = order.tasks[0];
   if (!task) return { type: 'command', command: { type: 'add_task', task: {
    id: 'task-1', title: 'Prueba', assignedAgentId: 'content', capability: 'content.draft',
    dependsOn: [], criteria: [{ id: 'c1', description: 'Responde al objetivo' }],
   } } };
   if (task.status === 'pending') return { type: 'dispatch', taskId: task.id };
   if (task.status === 'in_review') return { type: 'review', taskId: task.id, reviewerId: 'review' };
   if (task.status === 'completed') return { type: 'command', command: { type: 'close_order', assessments: [
    { criterionId: 'delivery', accepted: true, evidenceIds: task.submission!.evidence.map((e) => e.id), explanation: 'Completo' },
   ] } };
   return { type: 'command', command: { type: 'pause_order', reason: 'Estado inesperado en la prueba' } };
  },
  async execute() {
   return { type: 'result', submission: { summary: 'Entrega de prueba', evidence: [{ id: 'ev1', kind: 'artifact', reference: 'test://1', summary: 'Prueba' }] } };
  },
  async review({ task }) {
   return { assessments: task.criteria.map((c) => ({ criterionId: c.id, accepted: true, evidenceIds: task.submission!.evidence.map((e) => e.id), explanation: 'OK' })) };
  },
 };
}

const connectionString = process.env.VERIDIS_TEST_DATABASE_URL;
const model: ModelGateway = {
 identify: () => ({ provider: 'test', model: 'deterministic' }),
 async invoke(stage) { return { output: stage === 'generate' ? { text: 'Borrador verificable del piloto' } : { accepted: true, explanation: 'Cumple el encargo de prueba' }, inputTokens: 12, outputTokens: 8 }; },
};
async function listen(server: Server) {
 await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
 return `http://127.0.0.1:${(server.address() as { port: number }).port}`;
}
async function close(server: Server) { server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); }
async function request(base: string, token: string, path: string, body?: unknown) {
 const response = await fetch(base + path, { method: body === undefined ? 'GET' : 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
 return { status: response.status, data: await response.json() as any };
}
async function identity(pool: Pool, scope?: AccessScope) {
 const actualScope = scope ?? { workspaceId: randomUUID(), companyId: '642', divisionId: 'studio', clientId: randomUUID(), projectId: 'pilot' };
 const human: Principal = { kind: 'human', id: randomUUID() };
 const token = await provisionSession(pool, { principal: human, scope: actualScope, expiresAt: new Date(Date.now() + 3600000).toISOString(), permissions: [
  { principal: human, operations: ['draft.create', 'data.read', 'approval.decide', 'content.publish'], resourceType: 'workflow', resourceIds: ['content-pilot'] },
  { principal: human, operations: ['task.assign'], resourceType: 'agent', resourceIds: ['content'] },
  { principal: orchestrator, operations: ['task.assign'], resourceType: 'agent', resourceIds: ['content', 'review'] },
  { principal: worker, operations: ['draft.create'], resourceType: 'workflow', resourceIds: ['content-pilot'] },
  { principal: reviewer, operations: ['draft.create'], resourceType: 'workflow', resourceIds: ['content-pilot'] },
  { principal: executor, operations: ['content.publish', 'data.read'], resourceType: 'workflow', resourceIds: ['content-pilot'] },
 ] });
 return { token, human, scope: actualScope };
}

test('ruta vertical autenticada y persistente sobre PostgreSQL real', { skip: !connectionString, timeout: 60000 }, async (t) => {
 const pool = new Pool({ connectionString, max: 12 }); await migrate(pool);
 const deliveries = new Map<string, { text: string; contentHash: string; reference: string }>(); let sends = 0;
 const connector: DeliveryConnector = {
  async send(key, payload) { sends++; deliveries.set(key, { ...payload, reference: 'delivery://' + key }); return { reference: 'delivery://' + key }; },
  async lookup(key, hash) { const item = deliveries.get(key); return item && item.contentHash === hash ? { reference: item.reference } : null; },
 };
 const runtime = new ContentRuntime(pool, model, connector); const server = createRuntimeServer(runtime); const base = await listen(server);
 const owner = await identity(pool);
 const start = async (who = owner) => {
  const response = await request(base, who.token, '/runs', { brief: 'Preparar un texto de prueba', approverHumanId: who.human.id });
  assert.equal(response.status, 200, JSON.stringify(response.data)); return response.data.run.id as string;
 };
 const advance = async (id: string) => {
  const response = await request(base, owner.token, `/runs/${id}/advance`, {});
  assert.equal(response.status, 200, JSON.stringify(response.data)); return response.data;
 };
 const approve = (id: string, version = 1) => request(base, owner.token, `/runs/${id}/approve`, { version, decision: 'approved', reason: 'Contenido revisado por el responsable' });
 try {
  await t.test('rechaza sesiones inventadas, ámbitos de otro cliente e identidad enviada por el usuario', async () => {
   assert.equal((await request(base, 'x'.repeat(43), '/runs', { brief: 'No', approverHumanId: owner.human.id })).status, 401);
   assert.equal((await request(base, owner.token, '/runs', { brief: 'No', approverHumanId: owner.human.id, principal: { kind: 'human', id: 'ceo' } })).status, 400);
   const id = await start();
   const other = await identity(pool, { ...owner.scope, clientId: 'other' });
   assert.equal((await request(base, other.token, `/runs/${id}`)).status, 404);
   assert.equal((await request(base, other.token, `/runs/${id}/execute`, {})).status, 404);
  });
  await t.test('genera, revisa, aprueba y entrega conservando versiones, consumo y auditoría', async () => {
   const id = await start(); const draft = await advance(id);
   assert.equal(draft.run.status, 'awaiting_approval'); assert.equal(draft.artifacts.length, 1);
   assert.equal(draft.attempts.length, 2); assert(draft.attempts.every((a: any) => a.inputTokens === 12));
   assert.equal((await request(base, owner.token, `/runs/${id}/execute`, {})).status, 409);
   assert.equal((await approve(id)).status, 200);
   const finished = await request(base, owner.token, `/runs/${id}/execute`, {});
   assert.equal(finished.status, 200); assert.equal(finished.data.run.status, 'completed');
   assert(finished.data.audit.some((a: any) => a.data.event === 'tool.confirmed'));
   assert(finished.data.attempts.every((a: any) => a.costMicros === null && a.reservationMicros > 0));
  });
  await t.test('la ejecución concurrente consume una sola autorización y envía una vez', async () => {
   const id = await start(); await advance(id); await approve(id); const before = sends;
   const responses = await Promise.all([request(base, owner.token, `/runs/${id}/execute`, {}), request(base, owner.token, `/runs/${id}/execute`, {})]);
   assert.deepEqual(responses.map((r) => r.status).sort(), [200, 409]); assert.equal(sends, before + 1);
  });
  await t.test('modificar una pieza aprobada conserva historial y exige revisión y aprobación nuevas', async () => {
   const id = await start(); await advance(id); await approve(id);
   const changed = await request(base, owner.token, `/runs/${id}/revise`, { text: 'Nueva versión solicitada por el cliente' });
   assert.equal(changed.data.run.version, 2); assert.equal(changed.data.artifacts.length, 2);
   assert.equal((await approve(id, 1)).status, 409);
   assert.equal((await request(base, owner.token, `/runs/${id}/execute`, {})).status, 409);
   await advance(id); assert.equal((await approve(id, 2)).status, 200);
   assert.equal((await request(base, owner.token, `/runs/${id}/execute`, {})).data.run.status, 'completed');
   const history = await pool.query('SELECT data FROM veridis_runtime_v1.approvals WHERE run_id=$1 AND version=1', [id]);
   assert.equal(history.rows[0].data.status, 'revoked');
  });
  await t.test('rechazar una versión queda visible y bloquea volver a decidirla, sin cambiar la etapa del expediente', async () => {
   const id = await start(); await advance(id);
   const rejected = await request(base, owner.token, `/runs/${id}/approve`, { version: 1, decision: 'rejected', reason: 'Falta precisión en el encargo' });
   assert.equal(rejected.status, 200, JSON.stringify(rejected.data));
   assert.equal(rejected.data.run.status, 'awaiting_approval', 'rechazar no cambia la etapa: queda a la espera de una revisión');
   const approval = rejected.data.approvals.find((a: any) => a.version === 1);
   assert.equal(approval.data.status, 'rejected');
   assert.equal(approval.data.reason, 'Falta precisión en el encargo');
   assert.equal((await approve(id, 1)).status, 409, 'una aprobación ya rechazada no puede decidirse de nuevo');
   const revised = await request(base, owner.token, `/runs/${id}/revise`, { text: 'Versión corregida tras el rechazo' });
   assert.equal(revised.data.run.version, 2);
   // revise() marca la aprobación anterior como 'revoked' (sustituida), sin importar si venía
   // de un rechazo o una aprobación; el motivo original del rechazo sigue en la auditoría.
   assert.equal(revised.data.approvals.find((a: any) => a.version === 1).data.status, 'revoked');
   assert(revised.data.audit.some((a: any) => a.data.event === 'approval.rejected'), 'el rechazo original queda en la auditoría aunque la aprobación se marque revoked');
  });
  await t.test('regenera desde una versión rechazada usando el motivo como entrada real del modelo', async () => {
   const id = await start(); await advance(id);
   const rejected = await request(base, owner.token, `/runs/${id}/approve`, { version: 1, decision: 'rejected', reason: 'Falta precisión en el encargo' });
   assert.equal(rejected.data.run.status, 'awaiting_approval');
   const other = await start(); await advance(other);
   assert.equal((await request(base, owner.token, `/runs/${other}/regenerate`, {})).status, 409, 'no se puede regenerar una versión que no fue rechazada');
   const regenerated = await request(base, owner.token, `/runs/${id}/regenerate`, {});
   assert.equal(regenerated.status, 200, JSON.stringify(regenerated.data));
   assert.equal(regenerated.data.run.status, 'awaiting_review', 'regenerar solo genera; sigue pendiente de revisión independiente');
   assert.equal(regenerated.data.run.version, 2, 'regenerar crea una versión nueva, igual que una revisión humana');
   assert.equal(regenerated.data.artifacts.length, 2);
   assert.equal(regenerated.data.approvals.find((a: any) => a.version === 1).data.status, 'rejected', 'la versión 1 conserva su rechazo original, no se reescribe');
   assert.equal(regenerated.data.attempts.filter((a: any) => a.stage === 'generate').length, 2, 'queda registrado el intento original y el de regeneración');
   assert.equal((await request(base, owner.token, `/runs/${id}/regenerate`, {})).status, 409, 'ya no está awaiting_approval, no puede regenerarse de nuevo');
   const advanced = await advance(id);
   assert.equal(advanced.run.status, 'awaiting_approval');
  });
  await t.test('aprobar no exige motivo; rechazar sin motivo se rechaza', async () => {
   const id = await start(); await advance(id);
   const approved = await request(base, owner.token, `/runs/${id}/approve`, { version: 1, decision: 'approved' });
   assert.equal(approved.status, 200, JSON.stringify(approved.data));
   assert.equal(approved.data.run.status, 'approved');
   assert.equal(approved.data.approvals.find((a: any) => a.version === 1).data.reason, undefined);
   const other = await start(); await advance(other);
   assert.equal((await request(base, owner.token, `/runs/${other}/approve`, { version: 1, decision: 'rejected' })).status, 400, 'rechazar sin motivo sigue sin permitirse');
  });
  await t.test('lista expedientes del ámbito, calcula atención pendiente y pagina con cursor estable', async () => {
   const local = await identity(pool);
   const ids = [await start(local), await start(local), await start(local)];
   await request(base, local.token, `/runs/${ids[0]}/advance`, {});
   const everything = await request(base, local.token, '/runs');
   assert.equal(everything.status, 200);
   assert.deepEqual(everything.data.runs.map((r: any) => r.id).sort(), [...ids].sort());
   const attention = everything.data.runs.find((r: any) => r.id === ids[0]);
   assert.equal(attention.status, 'awaiting_approval'); assert.equal(attention.needsAttention, true);
   assert.equal(everything.data.runs.find((r: any) => r.id === ids[1]).needsAttention, false);
   const filtered = await request(base, local.token, '/runs?status=awaiting_approval');
   assert.deepEqual(filtered.data.runs.map((r: any) => r.id), [ids[0]]);
   const page1 = await request(base, local.token, '/runs?limit=2');
   assert.equal(page1.data.runs.length, 2); assert(page1.data.nextCursor);
   const page2 = await request(base, local.token, `/runs?limit=2&cursor=${encodeURIComponent(page1.data.nextCursor)}`);
   assert.equal(page2.data.runs.length, 1); assert.equal(page2.data.nextCursor, null);
   const seen = new Set([...page1.data.runs, ...page2.data.runs].map((r: any) => r.id));
   assert.deepEqual([...seen].sort(), [...ids].sort());
   const other = await identity(pool, { ...local.scope, clientId: 'otro-cliente' });
   assert.equal((await request(base, other.token, '/runs')).data.runs.length, 0);
   assert.equal((await request(base, local.token, '/runs?cursor=no-es-base64-valido')).status, 400);
  });
  await t.test('expone el organigrama con la misma autorización que los expedientes', async () => {
   const local = await identity(pool);
   const response = await request(base, local.token, '/organization');
   assert.equal(response.status, 200, JSON.stringify(response.data));
   assert.equal(response.data.organization.executiveAgentId, 'ceo');
   const content = response.data.agents.find((a: any) => a.id === 'content');
   const review = response.data.agents.find((a: any) => a.id === 'review');
   assert.ok(content && review, 'content y review deben estar en el catálogo de agentes');
   assert.equal(response.data.agents.length, officeRegistry.list().length);
   assert.equal('instructions' in content, false);
   assert.equal('knowledge' in content, false);
   const revoked = await identity(pool);
   await pool.query('UPDATE veridis_runtime_v1.sessions SET revoked=true WHERE token_hash=$1', [tokenHash(revoked.token)]);
   assert.equal((await request(base, revoked.token, '/organization')).status, 401);
   assert.equal((await request(base, 'y'.repeat(43), '/organization')).status, 401);
  });
  await t.test('expone el perfil completo de un agente, incluidas sus instrucciones, con la misma sesión', async () => {
   const local = await identity(pool);
   const response = await request(base, local.token, '/agents/content');
   assert.equal(response.status, 200, JSON.stringify(response.data));
   assert.equal(response.data.id, 'content');
   assert.ok(typeof response.data.instructions === 'string' && response.data.instructions.length > 0);
   assert.ok(Array.isArray(response.data.capabilities) && response.data.capabilities.includes('content.draft'));
   assert.equal((await request(base, local.token, '/agents/no-existe-este-id')).status, 404);
  });
  await t.test('revocar el permiso del ejecutor bloquea la herramienta aun con aprobación humana', async () => {
   const local = await identity(pool); const id = await start(local);
   assert.equal((await request(base, local.token, `/runs/${id}/advance`, {})).status, 200);
   assert.equal((await request(base, local.token, `/runs/${id}/approve`, { version: 1, decision: 'approved', reason: 'Revisado' })).status, 200);
   await pool.query("DELETE FROM veridis_runtime_v1.grants WHERE scope_key=$1 AND data->'principal'->>'id'='delivery-executor'", [scopeKey(local.scope)]);
   const before = sends;
   assert.equal((await request(base, local.token, `/runs/${id}/execute`, {})).status, 403); assert.equal(sends, before);
  });
  await t.test('el límite impide llamadas y los fallos conservan consumo desconocido y reserva', async () => {
   let calls = 0;
   const failing = new ContentRuntime(pool, { ...model, async invoke() { calls++; throw new Error('Fallo controlado del proveedor'); } }, connector,
    { budget: { ...Defaults, maxModelCalls: 1 } });
   const fs = createRuntimeServer(failing); const fb = await listen(fs);
   try {
    const started = await request(fb, owner.token, '/runs', { brief: 'Fallo', approverHumanId: owner.human.id }); const id = started.data.run.id;
    assert.equal((await request(fb, owner.token, `/runs/${id}/advance`, {})).status, 502);
    const failed = await request(fb, owner.token, `/runs/${id}`);
    assert.equal(failed.data.attempts[0].outcome, 'failed'); assert.equal(failed.data.attempts[0].costMicros, null);
    assert(failed.data.run.reservedCostMicros > 0);
    assert.equal((await request(fb, owner.token, `/runs/${id}/advance`, {})).status, 409); assert.equal(calls, 1);
   } finally { await close(fs); }
  });
  await t.test('los límites de gasto, herramientas y plazo bloquean llamadas antes de ejecutarlas', async () => {
   for (const limits of [{ maxCostMicros: 0 }, { maxToolCalls: 0 }, { maxDurationMs: 1 }]) {
    let modelCalls = 0; let toolCalls = 0;
    const limited = new ContentRuntime(pool, { ...model, async invoke(stage, data, signal) { modelCalls++; return model.invoke(stage, data, signal); } },
     { ...connector, async send(key, payload, signal) { toolCalls++; return connector.send(key, payload, signal); } }, { budget: { ...Defaults, ...limits } });
    const ls = createRuntimeServer(limited); const lb = await listen(ls);
    try {
     const created = await request(lb, owner.token, '/runs', { brief: 'Encargo acotado', approverHumanId: owner.human.id }); const id = created.data.run.id;
     if ('maxDurationMs' in limits) await delay(5);
     const advanced = await request(lb, owner.token, `/runs/${id}/advance`, {});
     if ('maxToolCalls' in limits) {
      assert.equal(advanced.status, 200);
      await request(lb, owner.token, `/runs/${id}/approve`, { version: 1, decision: 'approved', reason: 'Revisado' });
      assert.equal((await request(lb, owner.token, `/runs/${id}/execute`, {})).status, 409);
     } else { assert.equal(advanced.status, 409); assert.equal(modelCalls, 0); }
     assert.equal(toolCalls, 0);
    } finally { await close(ls); }
   }
  });
  await t.test('una salida fuera del JSON Schema no crea artefacto y conserva el intento fallido', async () => {
   const invalid = new ContentRuntime(pool, { ...model, async invoke() { return { output: { text: 'Texto', role: 'admin' }, inputTokens: 5, outputTokens: 4 }; } }, connector);
   const vs = createRuntimeServer(invalid); const vb = await listen(vs);
   try {
    const created = await request(vb, owner.token, '/runs', { brief: 'Verificar contrato', approverHumanId: owner.human.id }); const id = created.data.run.id;
    assert.equal((await request(vb, owner.token, `/runs/${id}/advance`, {})).status, 502);
    const failed = await request(vb, owner.token, `/runs/${id}`);
    assert.equal(failed.data.artifacts.length, 0); assert.equal(failed.data.attempts[0].outcome, 'failed');
    assert.equal(failed.data.attempts[0].inputTokens, 5);
   } finally { await close(vs); }
  });
  await t.test('si se altera el artefacto almacenado, no se entrega contenido distinto del aprobado', async () => {
   const id = await start(); await advance(id); await approve(id);
   await pool.query("UPDATE veridis_runtime_v1.artifacts SET content='Contenido alterado' WHERE run_id=$1 AND version=1", [id]);
   const before = sends;
   assert.equal((await request(base, owner.token, `/runs/${id}/execute`, {})).status, 409); assert.equal(sends, before);
  });
  await t.test('revocar una sesión impide seguir accediendo al expediente', async () => {
   const local = await identity(pool); const id = await start(local);
   await pool.query('UPDATE veridis_runtime_v1.sessions SET revoked=true WHERE token_hash=$1', [tokenHash(local.token)]);
   assert.equal((await request(base, local.token, `/runs/${id}`)).status, 401);
  });
  await t.test('un resultado incierto sin confirmación se concilia sin reenviar', async () => {
   let sent = 0;
   const ambiguous = new ContentRuntime(pool, model, { async send() { sent++; throw new Error('Respuesta perdida'); }, async lookup() { return null; } });
   const as = createRuntimeServer(ambiguous); const ab = await listen(as);
   try {
    const created = await request(ab, owner.token, '/runs', { brief: 'Entrega ambigua', approverHumanId: owner.human.id }); const id = created.data.run.id;
    await request(ab, owner.token, `/runs/${id}/advance`, {});
    await request(ab, owner.token, `/runs/${id}/approve`, { version: 1, decision: 'approved', reason: 'Revisado' });
    assert.equal((await request(ab, owner.token, `/runs/${id}/execute`, {})).data.run.status, 'outcome_unknown');
    assert.equal((await request(ab, owner.token, `/runs/${id}/execute`, {})).status, 409);
    assert.equal((await request(ab, owner.token, `/runs/${id}/reconcile`, {})).data.run.status, 'outcome_unknown'); assert.equal(sent, 1);
   } finally { await close(as); }
  });
  await t.test('reiniciar un proceso tras enviar al conector conserva el estado y recupera por consulta', async () => {
   const received = new Map<string, { text: string; contentHash: string }>(); let putCount = 0;
   let signalReceived!: () => void; const sent = new Promise<void>((resolve) => { signalReceived = resolve; });
   const target = createServer(async (req, res) => {
    const key = decodeURIComponent(req.url!.split('/').pop()!);
    if (req.method === 'PUT') {
     let text = ''; for await (const part of req) text += part;
     received.set(key, JSON.parse(text)); putCount++; signalReceived(); return; // Efecto confirmado en el receptor, respuesta interrumpida.
    }
    const stored = received.get(key);
    if (!stored) { res.writeHead(404); res.end(); return; }
    res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ reference: 'delivery://' + key, contentHash: stored.contentHash }));
   });
   const targetBase = await listen(target);
   const spawnWorker = async () => {
    const child = fork('scripts/runtime-test-worker.mjs', [], { execArgv: ['--import', 'tsx'], stdio: ['ignore', 'ignore', 'inherit', 'ipc'], env: { ...process.env, VERIDIS_TEST_DATABASE_URL: connectionString, VERIDIS_TEST_DELIVERY_URL: targetBase } });
    const message = await Promise.race([once(child, 'message'), once(child, 'exit').then(() => { throw new Error('El worker terminó antes de iniciar'); })]);
    return { child, url: 'http://127.0.0.1:' + (message[0] as { port: number }).port };
   };
   let active = await spawnWorker();
   try {
    const created = await request(active.url, owner.token, '/runs', { brief: 'Prueba de reinicio', approverHumanId: owner.human.id }); const id = created.data.run.id;
    await request(active.url, owner.token, `/runs/${id}/advance`, {});
    await request(active.url, owner.token, `/runs/${id}/approve`, { version: 1, decision: 'approved', reason: 'Validado' });
    const pending = request(active.url, owner.token, `/runs/${id}/execute`, {}).catch(() => null);
    await sent; const exit = once(active.child, 'exit'); active.child.kill('SIGKILL'); await exit; await pending;
    active = await spawnWorker();
    const recovered = await request(active.url, owner.token, `/runs/${id}`);
    assert.equal(recovered.data.run.status, 'dispatching'); assert.equal(recovered.data.artifacts.length, 1);
    await delay(Math.max(0, Date.parse(recovered.data.run.leaseUntil) - Date.now()) + 50);
    const reconciled = await request(active.url, owner.token, `/runs/${id}/reconcile`, {});
    assert.equal(reconciled.status, 200, JSON.stringify(reconciled.data)); assert.equal(reconciled.data.run.status, 'completed');
    assert.equal(putCount, 1); assert.equal(reconciled.data.attempts.length, 4);
   } finally {
    if (active.child.exitCode === null && !active.child.killed) { const exit = once(active.child, 'exit'); active.child.kill('SIGKILL'); await exit; }
    await close(target);
   }
  });
 } finally { await close(server); await pool.end(); }
});

test('office/ real sobre HTTP: crear, avanzar y listar un expediente con varios agentes', { skip: !connectionString, timeout: 30000 }, async (t) => {
 const pool = new Pool({ connectionString, max: 6 }); await migrate(pool);
 const office = new OfficeRuntime(pool, officeTestIntelligence(), { maxTurns: 10, maxRejectedDecisions: 3, maxQuestions: 2 });
 await office.setup();
 const content = new ContentRuntime(pool, {
  identify: () => ({ provider: 'test', model: 'deterministic' }),
  async invoke() { return { output: { text: 'no usado' }, inputTokens: 0, outputTokens: 0 }; },
 }, { async send() { throw new Error('no usado'); }, async lookup() { return null; } });
 const server = createRuntimeServer(content, office); const base = await listen(server);
 const scope: AccessScope = { workspaceId: randomUUID(), companyId: '642', divisionId: 'studio', clientId: randomUUID(), projectId: 'office-pilot' };
 const human: Principal = { kind: 'human', id: randomUUID() };
 const token = await provisionSession(pool, { principal: human, scope, expiresAt: new Date(Date.now() + 3600000).toISOString(), permissions: [
  { principal: human, operations: ['draft.create', 'data.read'], resourceType: 'workflow', resourceIds: ['office-pilot'] },
 ] });
 try {
  await t.test('un expediente sin autorización sobre office-pilot se rechaza', async () => {
   const otherScope = { ...scope, clientId: 'otro-cliente' };
   const otherToken = await provisionSession(pool, { principal: { kind: 'human', id: randomUUID() }, scope: otherScope, expiresAt: new Date(Date.now() + 3600000).toISOString(), permissions: [] });
   assert.equal((await request(base, otherToken, '/office/orders', { objective: 'Sin permiso' })).status, 403);
  });
  await t.test('crea, avanza solo y cierra el expediente con varios agentes reales por la ruta HTTP', async () => {
   const started = await request(base, token, '/office/orders', { objective: 'Preparar una prueba con varios agentes' });
   assert.equal(started.status, 200, JSON.stringify(started.data));
   assert.equal(started.data.order.status, 'completed');
   assert.equal(started.data.order.tasks[0].assignedAgentId, 'content');
   assert.equal(started.data.order.tasks[0].status, 'completed');
   assert(started.data.order.events.some((e: any) => e.actor.agentId === 'review' || e.command?.type === 'review_task'));
   const id = started.data.id;
   const got = await request(base, token, `/office/orders/${id}`);
   assert.equal(got.status, 200); assert.equal(got.data.order.status, 'completed');
   // Sin VERIDIS_OFFICE_MAX_COST_MICROS el expediente no tiene presupuesto: la API igual informa
   // el estado (nivel 'none'), en vez de omitir el campo y dejar a la UI adivinarlo.
   assert.equal(got.data.budget.level, 'none');
   assert.equal(got.data.budget.maxCostMicros, null);
   assert.equal(got.data.order.limits.maxCostMicros, null);
   const listed = await request(base, token, '/office/orders');
   assert.equal(listed.status, 200);
   assert(listed.data.orders.some((o: any) => o.id === id && o.status === 'completed'));
   const otherToken2 = await provisionSession(pool, { principal: { kind: 'human', id: randomUUID() }, scope: { ...scope, clientId: 'otro-cliente' }, expiresAt: new Date(Date.now() + 3600000).toISOString(), permissions: [
    { principal: { kind: 'human', id: randomUUID() }, operations: ['data.read'], resourceType: 'workflow', resourceIds: ['office-pilot'] },
   ] });
   assert.equal((await request(base, otherToken2, `/office/orders/${id}`)).status, 404);
  });
  await t.test('avanzar un expediente que ya terminó no reclama trabajo nuevo', async () => {
   const started = await request(base, token, '/office/orders', { objective: 'Expediente ya cerrado' });
   const id = started.data.id;
   const advanced = await request(base, token, `/office/orders/${id}/advance`, {});
   assert.equal(advanced.status, 200); assert.equal(advanced.data.order.status, 'completed');
  });
 } finally { await close(server); await pool.end(); }
});

test('office/ tareas programadas sobre HTTP: crear, listar, editar, disparar y borrar', { skip: !connectionString, timeout: 30000 }, async (t) => {
 const pool = new Pool({ connectionString, max: 6 }); await migrate(pool);
 const office = new OfficeRuntime(pool, officeTestIntelligence(), { maxTurns: 10, maxRejectedDecisions: 3, maxQuestions: 2 });
 await office.setup();
 const content = new ContentRuntime(pool, {
  identify: () => ({ provider: 'test', model: 'deterministic' }),
  async invoke() { return { output: { text: 'no usado' }, inputTokens: 0, outputTokens: 0 }; },
 }, { async send() { throw new Error('no usado'); }, async lookup() { return null; } });
 const server = createRuntimeServer(content, office); const base = await listen(server);
 const scope: AccessScope = { workspaceId: randomUUID(), companyId: '642', divisionId: 'studio', clientId: randomUUID(), projectId: 'office-pilot' };
 const human: Principal = { kind: 'human', id: randomUUID() };
 const token = await provisionSession(pool, { principal: human, scope, expiresAt: new Date(Date.now() + 3600000).toISOString(), permissions: [
  { principal: human, operations: ['draft.create', 'data.read', 'data.write'], resourceType: 'workflow', resourceIds: ['office-pilot'] },
  // El disparo manual (/fire) pasa por fireOnce -> startScheduled, que se autoriza como el
  // principal de servicio del scheduler, no como el humano que pidió el disparo.
  { principal: scheduler, operations: ['draft.create'], resourceType: 'workflow', resourceIds: ['office-pilot'] },
 ] });
 try {
  let scheduleId = '';
  await t.test('crea una tarea programada con cron válido y calcula la próxima ejecución', async () => {
   const created = await request(base, token, '/office/schedules', { name: 'Resumen semanal', objective: 'Redactar un resumen semanal de prueba', cronExpression: '0 9 * * 1', timezone: 'America/Hermosillo' });
   assert.equal(created.status, 200, JSON.stringify(created.data));
   assert.equal(created.data.enabled, true); assert.equal(created.data.running, false);
   assert(created.data.nextRunAt, 'debe calcular la próxima ejecución real');
   scheduleId = created.data.id;
  });
  await t.test('una expresión cron o zona horaria inválida se rechaza antes de tocar la base', async () => {
   assert.equal((await request(base, token, '/office/schedules', { name: 'Mala', objective: 'x', cronExpression: 'no es cron', timezone: 'UTC' })).status, 400);
   assert.equal((await request(base, token, '/office/schedules', { name: 'Mala', objective: 'x', cronExpression: '0 9 * * 1', timezone: 'Zona/Inventada' })).status, 400);
  });
  await t.test('listar incluye la tarea creada; verla por id respeta el ámbito del cliente', async () => {
   const listed = await request(base, token, '/office/schedules');
   assert.equal(listed.status, 200); assert(listed.data.schedules.some((s: any) => s.id === scheduleId));
   const got = await request(base, token, `/office/schedules/${scheduleId}`);
   assert.equal(got.status, 200); assert.equal(got.data.id, scheduleId);
   const otherToken = await provisionSession(pool, { principal: { kind: 'human', id: randomUUID() }, scope: { ...scope, clientId: 'otro-cliente' }, expiresAt: new Date(Date.now() + 3600000).toISOString(), permissions: [
    { principal: { kind: 'human', id: randomUUID() }, operations: ['data.read'], resourceType: 'workflow', resourceIds: ['office-pilot'] },
   ] });
   assert.equal((await request(base, otherToken, `/office/schedules/${scheduleId}`)).status, 404);
  });
  await t.test('editar sin permiso data.write se rechaza con 403', async () => {
   const limitedHuman: Principal = { kind: 'human', id: randomUUID() };
   const limitedToken = await provisionSession(pool, { principal: limitedHuman, scope, expiresAt: new Date(Date.now() + 3600000).toISOString(), permissions: [
    { principal: limitedHuman, operations: ['data.read'], resourceType: 'workflow', resourceIds: ['office-pilot'] },
   ] });
   assert.equal((await request(base, limitedToken, `/office/schedules/${scheduleId}/update`, { enabled: false })).status, 403);
  });
  await t.test('editar cambia cron y zona horaria revalidando ambos juntos', async () => {
   const updated = await request(base, token, `/office/schedules/${scheduleId}/update`, { cronExpression: '0 0 * * *', timezone: 'UTC' });
   assert.equal(updated.status, 200, JSON.stringify(updated.data));
   assert.equal(updated.data.cronExpression, '0 0 * * *'); assert.equal(updated.data.timezone, 'UTC');
   assert.equal((await request(base, token, `/office/schedules/${scheduleId}/update`, { cronExpression: 'no es cron' })).status, 400);
  });
  await t.test('el disparo manual usa la misma fireOnce que el Cron real y marca el expediente', async () => {
   const fired = await request(base, token, `/office/schedules/${scheduleId}/fire`, {});
   assert.equal(fired.status, 200, JSON.stringify(fired.data));
   assert.equal(fired.data.result, 'fired'); assert(fired.data.lastFiredOrderId);
   const order = await pool.query('SELECT created_by_schedule_id, status FROM veridis_runtime_v1.office_orders WHERE id=$1', [fired.data.lastFiredOrderId]);
   assert.equal(order.rows[0].created_by_schedule_id, scheduleId);
   assert.equal(order.rows[0].status, 'completed');
  });
  await t.test('apagar quita la próxima ejecución; reactivar la devuelve (ida y vuelta de "reactivar")', async () => {
   const disabled = await request(base, token, `/office/schedules/${scheduleId}/update`, { enabled: false });
   assert.equal(disabled.data.enabled, false); assert.equal(disabled.data.nextRunAt, null, 'una tarea apagada no muestra próxima ejecución');
   const reactivated = await request(base, token, `/office/schedules/${scheduleId}/update`, { enabled: true });
   assert.equal(reactivated.data.enabled, true); assert(reactivated.data.nextRunAt);
  });
  await t.test('borrar la tarea programada la quita del listado y de la vista por id', async () => {
   const deleted = await request(base, token, `/office/schedules/${scheduleId}/delete`, {});
   assert.equal(deleted.status, 200, JSON.stringify(deleted.data)); assert.equal(deleted.data.id, scheduleId);
   assert.equal((await request(base, token, `/office/schedules/${scheduleId}`)).status, 404);
   const listed = await request(base, token, '/office/schedules');
   assert.equal(listed.data.schedules.some((s: any) => s.id === scheduleId), false);
  });
 } finally { await close(server); await pool.end(); }
});

test('office_files (pdf.generate): persiste con deduplicación real y aislamiento por ámbito', { skip: !connectionString, timeout: 30000 }, async (t) => {
 const pool = new Pool({ connectionString, max: 6 }); await migrate(pool);
 const office = new OfficeRuntime(pool, officeTestIntelligence(), { maxTurns: 10, maxRejectedDecisions: 3, maxQuestions: 2 });
 await office.setup();
 const content = new ContentRuntime(pool, {
  identify: () => ({ provider: 'test', model: 'deterministic' }),
  async invoke() { return { output: { text: 'no usado' }, inputTokens: 0, outputTokens: 0 }; },
 }, { async send() { throw new Error('no usado'); }, async lookup() { return null; } });
 const server = createRuntimeServer(content, office); const base = await listen(server);
 const scope: AccessScope = { workspaceId: randomUUID(), companyId: '642', divisionId: 'studio', clientId: randomUUID(), projectId: 'office-pilot' };
 const human: Principal = { kind: 'human', id: randomUUID() };
 const token = await provisionSession(pool, { principal: human, scope, expiresAt: new Date(Date.now() + 3600000).toISOString(), permissions: [
  { principal: human, operations: ['draft.create', 'data.read'], resourceType: 'workflow', resourceIds: ['office-pilot'] },
 ] });
 try {
  let orderId = '';
  await t.test('crea un expediente real al que vincular los archivos de prueba', async () => {
   const started = await request(base, token, '/office/orders', { objective: 'Expediente para probar office_files' });
   assert.equal(started.status, 200, JSON.stringify(started.data));
   orderId = started.data.id;
  });
  let firstFileId = '';
  await t.test('la misma entrada no duplica el archivo; una entrada distinta sí crea uno nuevo', async () => {
   const rawOutput = JSON.stringify({ filename: 'reporte.pdf', contentType: 'application/pdf', pages: 1, base64: Buffer.from('%PDF-prueba').toString('base64') });
   const first = JSON.parse(await persistGeneratedPdf(pool, orderId, { title: 'Reporte A' }, rawOutput)) as { fileId: string };
   const second = JSON.parse(await persistGeneratedPdf(pool, orderId, { title: 'Reporte A' }, rawOutput)) as { fileId: string };
   assert.equal(first.fileId, second.fileId, 'misma (order_id, input): no debe duplicar');
   const count = await pool.query('SELECT count(*)::int AS n FROM veridis_runtime_v1.office_files WHERE order_id=$1', [orderId]);
   assert.equal(count.rows[0].n, 1);
   firstFileId = first.fileId;
   const third = JSON.parse(await persistGeneratedPdf(pool, orderId, { title: 'Reporte B' }, rawOutput)) as { fileId: string };
   assert.notEqual(third.fileId, firstFileId, 'input distinto para el mismo order_id sí crea un archivo nuevo');
  });
  await t.test('GET /office/files/{id} sirve el PDF real con la sesión correcta', async () => {
   const response = await fetch(`${base}/office/files/${firstFileId}`, { headers: { authorization: `Bearer ${token}` } });
   assert.equal(response.status, 200);
   assert.equal(response.headers.get('content-type'), 'application/pdf');
   assert.ok(/attachment; filename="reporte\.pdf"/.test(response.headers.get('content-disposition') ?? ''));
   const bytes = Buffer.from(await response.arrayBuffer());
   assert.equal(bytes.toString('latin1'), '%PDF-prueba');
  });
  await t.test('una sesión de otro cliente recibe 404, nunca 403', async () => {
   const otherToken = await provisionSession(pool, { principal: { kind: 'human', id: randomUUID() }, scope: { ...scope, clientId: 'otro-cliente' }, expiresAt: new Date(Date.now() + 3600000).toISOString(), permissions: [
    { principal: { kind: 'human', id: randomUUID() }, operations: ['data.read'], resourceType: 'workflow', resourceIds: ['office-pilot'] },
   ] });
   const response = await fetch(`${base}/office/files/${firstFileId}`, { headers: { authorization: `Bearer ${otherToken}` } });
   assert.equal(response.status, 404);
  });
  await t.test('un id inexistente también responde 404', async () => {
   const response = await fetch(`${base}/office/files/${randomUUID()}`, { headers: { authorization: `Bearer ${token}` } });
   assert.equal(response.status, 404);
  });
 } finally { await close(server); await pool.end(); }
});

function unitVector(index: number): number[] {
 const vector = new Array(MEMORY_EMBEDDING_DIMENSIONS).fill(0);
 vector[index] = 1;
 return vector;
}
const fakeMemoryEmbedder: Embedder = { dimensions: MEMORY_EMBEDDING_DIMENSIONS, async embed(text) { return unitVector(text.includes('postgres') ? 0 : 1); } };

test('memoria corporativa sobre HTTP: solo validate() la vuelve buscable, y el ámbito es real', { skip: !connectionString, timeout: 30000 }, async (t) => {
 const pool = new Pool({ connectionString, max: 6 }); await migrate(pool);
 const memory = new MemoryStore(pool, fakeMemoryEmbedder, 'fake-test-embedder');
 const vault = mkdtempSync(join(tmpdir(), 'veridis-vault-'));
 const office = new OfficeRuntime(pool, officeTestIntelligence(), { maxTurns: 10, maxRejectedDecisions: 3, maxQuestions: 2 }, memory, vault);
 await office.setup();
 const content = new ContentRuntime(pool, {
  identify: () => ({ provider: 'test', model: 'deterministic' }),
  async invoke() { return { output: { text: 'no usado' }, inputTokens: 0, outputTokens: 0 }; },
 }, { async send() { throw new Error('no usado'); }, async lookup() { return null; } });
 const server = createRuntimeServer(content, office); const base = await listen(server);
 // Mismo ámbito que companyMemoryScope() produce con sus valores por defecto (ver
 // src/runtime/memory-store.ts): una sesión real de memoria corporativa debe aprovisionarse
 // exactamente así, no con un scope de cliente cualquiera.
 const memoryScope: AccessScope = { workspaceId: 'veridiscorp', companyId: '642-studio', divisionId: 'general', clientId: null, projectId: null };
 const human: Principal = { kind: 'human', id: randomUUID() };
 const token = await provisionSession(pool, { principal: human, scope: memoryScope, expiresAt: new Date(Date.now() + 3600000).toISOString(), permissions: [
  { principal: human, operations: ['data.read', 'approval.decide'], resourceType: 'workflow', resourceIds: ['office-pilot'] },
 ] });
 try {
  let proposedId = '';
  await t.test('memory.write (simulada) guarda y memory.query ya la encuentra, marcada sin confirmar', async () => {
   const proposed = await memory.propose(memoryScope, {
    entityType: 'project', entityId: 'veridiscorp', content: 'Configuración de acceso remoto a postgres.',
    provenance: [{ reference: 'test://1', observedAt: new Date().toISOString() }], trust: 'internal_unverified',
   });
   proposedId = proposed.id;
   const found = await memory.query(memoryScope, 'postgres');
   assert.equal(found[0]?.record.id, proposedId);
   assert.equal(found[0]?.record.status, 'proposed');
  });
  await t.test('GET /office/memory?status=proposed la lista', async () => {
   const listed = await request(base, token, '/office/memory?status=proposed');
   assert.equal(listed.status, 200, JSON.stringify(listed.data));
   assert.ok(listed.data.records.some((r: { id: string }) => r.id === proposedId));
  });
  await t.test('POST /office/memory/{id}/validate la deja vigente y buscable, y espeja al vault de Obsidian', async () => {
   const validated = await request(base, token, `/office/memory/${proposedId}/validate`, {});
   assert.equal(validated.status, 200, JSON.stringify(validated.data));
   assert.equal(validated.data.status, 'validated');
   const found = await memory.query(memoryScope, 'postgres remoto');
   assert.equal(found[0]?.record.id, proposedId);
   const exported = readFileSync(join(vault, 'project', 'veridiscorp.md'), 'utf8');
   assert.match(exported, /Configuración de acceso remoto a postgres\./);
   assert.match(exported, /#veridis #memoria #project/);
  });
  await t.test('validar de nuevo la misma propuesta responde 409, no 200', async () => {
   const second = await request(base, token, `/office/memory/${proposedId}/validate`, {});
   assert.equal(second.status, 409);
  });
  await t.test('POST /office/memory/{id}/quarantine exige un motivo y solo aplica a una memoria vigente', async () => {
   const withoutReason = await request(base, token, `/office/memory/${proposedId}/quarantine`, {});
   assert.equal(withoutReason.status, 400);
   const quarantined = await request(base, token, `/office/memory/${proposedId}/quarantine`, { reason: 'Dato obsoleto tras migrar el servidor.' });
   assert.equal(quarantined.status, 200, JSON.stringify(quarantined.data));
   assert.equal(quarantined.data.status, 'quarantined');
   assert.equal(quarantined.data.quarantineReason, 'Dato obsoleto tras migrar el servidor.');
   assert.deepEqual(await memory.query(memoryScope, 'postgres remoto'), []);
   const exported = readFileSync(join(vault, 'project', 'veridiscorp.md'), 'utf8');
   assert.match(exported, /Estado: quarantined/);
   assert.match(exported, /Motivo de cuarentena: Dato obsoleto tras migrar el servidor\./);
  });
  await t.test('poner en cuarentena una segunda vez responde 409, no 200', async () => {
   const second = await request(base, token, `/office/memory/${proposedId}/quarantine`, { reason: 'otra vez' });
   assert.equal(second.status, 409);
  });
  await t.test('validar una corrección (contradicts) también reescribe en el vault la memoria que pasó a cuarentena', async () => {
   // Bug encontrado en una prueba local real: solo se exportaba la corrección, y Obsidian seguía
   // mostrando como "validated" la memoria refutada.
   const original = await memory.propose(memoryScope, {
    entityType: 'company', entityId: 'respaldo', content: 'El respaldo corre a las 03:00.',
    provenance: [{ reference: 'test://3', observedAt: new Date().toISOString() }], trust: 'internal_unverified',
   });
   assert.equal((await request(base, token, `/office/memory/${original.id}/validate`, {})).status, 200);
   const correction = await memory.propose(memoryScope, {
    entityType: 'company', entityId: 'respaldo-correccion', content: 'El respaldo corre a las 04:00.',
    provenance: [{ reference: 'test://4', observedAt: new Date().toISOString() }], trust: 'verified', contradicts: original.id,
   });
   assert.equal((await request(base, token, `/office/memory/${correction.id}/validate`, {})).status, 200);
   const exported = readFileSync(join(vault, 'company', 'respaldo.md'), 'utf8');
   assert.match(exported, /Estado: quarantined/);
   assert.match(exported, /Motivo de cuarentena: Contradicha por company\/respaldo-correccion v1/);
  });
  await t.test('una propuesta de otro ámbito es invisible e invalidable desde el ámbito de memoria corporativa', async () => {
   const otherScope: AccessScope = { ...memoryScope, clientId: 'otro-cliente' };
   const otherProposed = await memory.propose(otherScope, {
    entityType: 'project', entityId: 'otro', content: 'Nota de otro ámbito.',
    provenance: [{ reference: 'test://2', observedAt: new Date().toISOString() }], trust: 'internal_unverified',
   });
   // token está aprovisionada en memoryScope: ni ve ni puede validar algo que vive en otherScope.
   const listedFromMemoryScope = await request(base, token, '/office/memory?status=proposed');
   assert.ok(!listedFromMemoryScope.data.records.some((r: { id: string }) => r.id === otherProposed.id));
   const response = await request(base, token, `/office/memory/${otherProposed.id}/validate`, {});
   assert.equal(response.status, 404);
  });
 } finally { await close(server); await pool.end(); rmSync(vault, { recursive: true, force: true }); }
});

test('el archivista destila memoria al cerrar un expediente, una sola vez, y el mapa la expone', { skip: !connectionString, timeout: 30000 }, async () => {
 const pool = new Pool({ connectionString, max: 6 }); await migrate(pool);
 const memory = new MemoryStore(pool, fakeMemoryEmbedder, 'fake-test-embedder');
 let distills = 0;
 const intelligence: OfficeIntelligence = {
  ...officeTestIntelligence(),
  async distill(context, onUsage) {
   distills += 1;
   onUsage?.({ inputTokens: 50, outputTokens: 20 });
   assert.equal(context.deliverables[0]?.summary, 'Entrega de prueba');
   // entityId sin normalizar y un contradicts inventado: el runtime normaliza uno y descarta el otro.
   return { memories: [{ kind: 'decision', entityType: 'company', entityId: 'Política de Respaldo', content: 'Se decidió respaldar postgres a diario.', contradicts: 'id-inventado' }] };
  },
 };
 const office = new OfficeRuntime(pool, intelligence, { maxTurns: 10, maxRejectedDecisions: 3, maxQuestions: 2 }, memory);
 await office.setup();
 const content = new ContentRuntime(pool, {
  identify: () => ({ provider: 'test', model: 'deterministic' }),
  async invoke() { return { output: { text: 'no usado' }, inputTokens: 0, outputTokens: 0 }; },
 }, { async send() { throw new Error('no usado'); }, async lookup() { return null; } });
 const server = createRuntimeServer(content, office); const base = await listen(server);
 const memoryScope: AccessScope = { workspaceId: 'veridiscorp', companyId: '642-studio', divisionId: 'general', clientId: null, projectId: null };
 const human: Principal = { kind: 'human', id: randomUUID() };
 const token = await provisionSession(pool, { principal: human, scope: memoryScope, expiresAt: new Date(Date.now() + 3600000).toISOString(), permissions: [
  { principal: human, operations: ['draft.create', 'data.read'], resourceType: 'workflow', resourceIds: ['office-pilot'] },
 ] });
 try {
  const started = await request(base, token, '/office/orders', { objective: 'Definir la política de respaldo' });
  assert.equal(started.status, 200, JSON.stringify(started.data));
  assert.equal(started.data.order.status, 'completed');
  await office.settled();
  const found = (await memory.query(memoryScope, 'postgres', { track: false })).find((r) => r.record.entityId === 'politica-de-respaldo');
  assert(found, 'el archivista no guardó la memoria');
  assert.equal(found.record.kind, 'decision');
  assert.equal(found.record.status, 'proposed');
  assert.equal(found.record.contradicts, null);
  assert.match(found.record.provenance[0]!.reference, new RegExp(`expediente://${started.data.id}`));
  // Avanzar un expediente ya cerrado no vuelve a destilar.
  await request(base, token, `/office/orders/${started.data.id}/advance`, {});
  await office.settled();
  assert.equal(distills, 1);
  const graph = await request(base, token, '/office/memory/graph');
  assert.equal(graph.status, 200, JSON.stringify(graph.data));
  assert(graph.data.nodes.some((n: { record: { id: string } }) => n.record.id === found.record.id));
 } finally { await close(server); await pool.end(); }
});

test('importar un documento a memoria: plan sin IA, secciones con IA, todo sin confirmar y con su origen', { skip: !connectionString, timeout: 30000 }, async () => {
 const pool = new Pool({ connectionString, max: 6 }); await migrate(pool);
 const memory = new MemoryStore(pool, fakeMemoryEmbedder, 'fake-test-embedder');
 const seen: string[] = [];
 const intelligence: OfficeIntelligence = {
  ...officeTestIntelligence(),
  async ingest(context, onUsage) {
   seen.push(context.section);
   onUsage?.({ inputTokens: 300, outputTokens: 90 });
   return { memories: [{ kind: 'fact', entityType: 'company', entityId: `Dato ${context.section}`, content: `Sobre ${context.section}: el respaldo de postgres es diario.`, contradicts: null }] };
  },
 };
 const office = new OfficeRuntime(pool, intelligence, { maxTurns: 10, maxRejectedDecisions: 3, maxQuestions: 2 }, memory);
 await office.setup();
 const content = new ContentRuntime(pool, {
  identify: () => ({ provider: 'test', model: 'deterministic' }),
  async invoke() { return { output: { text: 'no usado' }, inputTokens: 0, outputTokens: 0 }; },
 }, { async send() { throw new Error('no usado'); }, async lookup() { return null; } });
 const server = createRuntimeServer(content, office); const base = await listen(server);
 const memoryScope: AccessScope = { workspaceId: 'veridiscorp', companyId: '642-studio', divisionId: 'general', clientId: null, projectId: null };
 const human: Principal = { kind: 'human', id: randomUUID() };
 const token = await provisionSession(pool, { principal: human, scope: memoryScope, expiresAt: new Date(Date.now() + 3600000).toISOString(), permissions: [
  { principal: human, operations: ['data.read', 'data.write'], resourceType: 'workflow', resourceIds: ['office-pilot'] },
 ] });
 // Otra persona: los permisos se resuelven por ámbito y principal, no por token.
 const reader: Principal = { kind: 'human', id: randomUUID() };
 const readOnly = await provisionSession(pool, { principal: reader, scope: memoryScope, expiresAt: new Date(Date.now() + 3600000).toISOString(), permissions: [
  { principal: reader, operations: ['data.read'], resourceType: 'workflow', resourceIds: ['office-pilot'] },
 ] });
 try {
  // Más grande que el límite general de 32 KB: el plan acepta documentos largos.
  const doc = `1. PERFIL\n${'Texto del perfil.\n'.repeat(2000)}\n2. NEGOCIO\n${'Texto del negocio.\n'.repeat(300)}`;
  assert(Buffer.byteLength(doc) > 32768);
  const plan = await request(base, token, '/office/memory/import/plan', { title: 'Contexto de prueba', text: doc });
  assert.equal(plan.status, 200, JSON.stringify(plan.data));
  assert(plan.data.sections.length >= 2);
  assert.equal((await request(base, readOnly, '/office/memory/import/plan', { title: 'x', text: 'y' })).status, 403);
  const first = plan.data.sections[0];
  const imported = await request(base, token, '/office/memory/import/section', { title: 'Contexto de prueba', section: first.section, text: first.text });
  assert.equal(imported.status, 200, JSON.stringify(imported.data));
  assert.equal(seen[0], first.section);
  const record = imported.data.memories[0];
  assert.equal(record.status, 'proposed');
  assert.equal(record.kind, 'fact');
  assert.match(record.entityId, /^[a-z0-9-]+$/);
  assert.match(record.provenance[0].reference, /^documento: Contexto de prueba § /);
  assert.equal(imported.data.inputTokens, 300);
  // Quien escribió el documento puede importarlo ya confirmado.
  const confirmed = await request(base, token, '/office/memory/import/section', { title: 'Contexto propio', section: first.section, text: first.text, confirm: true });
  assert.equal(confirmed.status, 200, JSON.stringify(confirmed.data));
  assert.equal(confirmed.data.memories[0].status, 'validated');
  assert.match(confirmed.data.memories[0].provenance[0].reference, /confirmado al importar/);
 } finally { await close(server); await pool.end(); }
});

test('asistente rápido: responde con memoria en una llamada, guarda la conversación y pasa el trabajo a la oficina', { skip: !connectionString, timeout: 30000 }, async () => {
 const pool = new Pool({ connectionString, max: 6 }); await migrate(pool);
 const memory = new MemoryStore(pool, fakeMemoryEmbedder, 'fake-test-embedder');
 const memoryScope: AccessScope = { workspaceId: 'veridiscorp', companyId: '642-studio', divisionId: 'general', clientId: null, projectId: null };
 const marker = randomUUID().slice(0, 8);
 const backup = await memory.propose(memoryScope, {
  entityType: 'decision', entityId: `respaldo-${marker}`, content: `El respaldo de postgres ${marker} es diario a las 3 am.`,
  provenance: [{ reference: 'test://asistente', observedAt: new Date().toISOString() }], trust: 'internal_unverified',
 });
 const contexts: Parameters<NonNullable<OfficeIntelligence['ask']>>[0][] = [];
 const intelligence: OfficeIntelligence = {
  ...officeTestIntelligence(),
  async ask(context, onUsage) {
   contexts.push(context);
   onUsage?.({ inputTokens: 120, outputTokens: 40 });
   if (context.question.includes('cotización')) return { mode: 'order', answer: 'Lo paso a la oficina.', objective: 'Preparar una cotización de redes sociales.', memoryIds: [], scene: null };
   if (context.question.includes('sin encargo')) return { mode: 'order', answer: 'Lo paso a la oficina.', objective: '  ', memoryIds: [], scene: null };
   if (context.question.includes('muéstrame una onda')) {
    return { mode: 'answer', answer: 'Aquí tienes una onda.', objective: null, memoryIds: [],
     scene: { label: 'Onda', colorHex: '#35e0e0', layers: [{ type: 'wave', freqX: 8, freqY: 0, phase: 0, speed: 1.2, weight: 0.8 }] } };
   }
   const used = context.memories.find((m) => m.content.includes(marker));
   return { mode: 'answer', answer: used ? `Diario a las 3 am.` : 'No lo sé.', objective: null, memoryIds: used ? [used.id, 'id-inventado'] : [], scene: null };
  },
 };
 const office = new OfficeRuntime(pool, intelligence, { maxTurns: 10, maxRejectedDecisions: 3, maxQuestions: 2, priceList: null }, memory);
 await office.setup();
 const content = new ContentRuntime(pool, {
  identify: () => ({ provider: 'test', model: 'deterministic' }),
  async invoke() { return { output: { text: 'no usado' }, inputTokens: 0, outputTokens: 0 }; },
 }, { async send() { throw new Error('no usado'); }, async lookup() { return null; } });
 const server = createRuntimeServer(content, office); const base = await listen(server);
 const human: Principal = { kind: 'human', id: randomUUID() };
 const token = await provisionSession(pool, { principal: human, scope: memoryScope, expiresAt: new Date(Date.now() + 3600000).toISOString(), permissions: [
  { principal: human, operations: ['data.read'], resourceType: 'workflow', resourceIds: ['office-pilot'] },
 ] });
 const otherScope: AccessScope = { ...memoryScope, divisionId: `otra-${marker}` };
 const outsider: Principal = { kind: 'human', id: randomUUID() };
 const outsiderToken = await provisionSession(pool, { principal: outsider, scope: otherScope, expiresAt: new Date(Date.now() + 3600000).toISOString(), permissions: [
  { principal: outsider, operations: ['data.read'], resourceType: 'workflow', resourceIds: ['office-pilot'] },
 ] });
 try {
  const first = await request(base, token, '/office/assistant/ask', { question: '¿Cada cuánto respaldamos postgres?' });
  assert.equal(first.status, 200, JSON.stringify(first.data));
  assert.equal(first.data.mode, 'answer');
  assert.equal(first.data.objective, null);
  // Solo la memoria usada y real: el id inventado por el modelo se descarta.
  assert.deepEqual(first.data.memories.map((m: { id: string }) => m.id), [backup.id]);
  assert.equal(first.data.inputTokens, 120);
  assert.equal(first.data.costStatus, 'unknown');
  const recalls = await pool.query('SELECT count(*)::int AS n FROM veridis_runtime_v1.memory_recalls WHERE memory_id=$1', [backup.id]);
  assert.equal(recalls.rows[0].n, 1);

  const second = await request(base, token, '/office/assistant/ask', { question: '¿y a qué hora?', threadId: first.data.threadId });
  assert.equal(second.status, 200, JSON.stringify(second.data));
  assert.equal(second.data.threadId, first.data.threadId);
  assert.deepEqual(contexts.at(-1)!.history, [{ question: '¿Cada cuánto respaldamos postgres?', answer: 'Diario a las 3 am.' }]);

  const order = await request(base, token, '/office/assistant/ask', { question: 'Prepara una cotización', threadId: first.data.threadId });
  assert.equal(order.data.mode, 'order');
  assert.equal(order.data.objective, 'Preparar una cotización de redes sociales.');
  // "order" sin encargo redactado no puede abrir un expediente vacío: queda como respuesta.
  const empty = await request(base, token, '/office/assistant/ask', { question: 'algo sin encargo' });
  assert.equal(empty.data.mode, 'answer');
  assert.equal(empty.data.scene, null);

  // "scene" viaja intacta en la respuesta HTTP cuando el modelo la emite; el resto de turnos van con null.
  // Hilo propio (sin threadId) para no alterar el conteo de mensajes del hilo de "first" que se revisa abajo.
  const withScene = await request(base, token, '/office/assistant/ask', { question: 'muéstrame una onda' });
  assert.equal(withScene.status, 200, JSON.stringify(withScene.data));
  assert.equal(withScene.data.scene.label, 'Onda');
  assert.equal(withScene.data.scene.layers.length, 1);
  assert.equal(withScene.data.scene.layers[0].type, 'wave');

  const threads = await request(base, token, '/office/assistant/threads');
  const thread = threads.data.threads.find((t: { threadId: string }) => t.threadId === first.data.threadId);
  assert.equal(thread.messages, 3);
  assert.equal(thread.title, '¿Cada cuánto respaldamos postgres?');
  const detail = await request(base, token, `/office/assistant/threads/${first.data.threadId}`);
  assert.deepEqual(detail.data.messages.map((m: { mode: string }) => m.mode), ['answer', 'answer', 'order']);
  assert.equal(detail.data.messages[0].memories[0].id, backup.id);

  assert.equal((await request(base, token, '/office/assistant/ask', { question: 'hola', threadId: randomUUID() })).status, 404);
  // Otro ámbito no ve ni continúa la conversación.
  assert.equal((await request(base, outsiderToken, `/office/assistant/threads/${first.data.threadId}`)).status, 404);
  assert.equal((await request(base, outsiderToken, '/office/assistant/ask', { question: 'hola', threadId: first.data.threadId })).status, 404);
 } finally { await close(server); await pool.end(); }
});

test('AssistantReply: "scene" acepta null y rechaza una escena fuera de los límites', () => {
 const base = { mode: 'answer' as const, answer: 'ok', objective: null, memoryIds: [] };
 assert.doesNotThrow(() => AssistantReply.parse({ ...base, scene: null }));
 const okScene = { label: 'Prueba', layers: [{ type: 'blob', cx: 0, cy: 0, sx: 0.3, sy: 0.3, weight: 0.8 }] };
 assert.doesNotThrow(() => AssistantReply.parse({ ...base, scene: okScene }));
 // Más de 8 capas: rechazado.
 const tooManyLayers = { layers: Array.from({ length: 9 }, () => ({ type: 'blob', cx: 0, cy: 0, sx: 0.3, sy: 0.3, weight: 0.5 })) };
 assert.throws(() => AssistantReply.parse({ ...base, scene: tooManyLayers }));
 // weight fuera del rango [-2,2]: rechazado.
 const outOfRangeWeight = { layers: [{ type: 'blob', cx: 0, cy: 0, sx: 0.3, sy: 0.3, weight: 999 }] };
 assert.throws(() => AssistantReply.parse({ ...base, scene: outOfRangeWeight }));
});
