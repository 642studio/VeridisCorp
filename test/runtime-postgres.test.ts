import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { Pool } from 'pg';
import { ContentRuntime } from '../src/runtime/service.js';
import { createRuntimeServer } from '../src/runtime/http.js';
import { migrate, provisionSession, scopeKey, tokenHash } from '../src/runtime/database.js';
import { executor, orchestrator, reviewer, worker, Defaults } from '../src/runtime/contracts.js';
import type { AccessScope, Principal } from '../src/governance/contracts.js';
import type { ModelGateway, DeliveryConnector } from '../src/runtime/providers.js';

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
   assert.ok(content && review, 'content y review deben estar en el catálogo de 56 perfiles');
   assert.equal(response.data.agents.length, 56);
   assert.equal('instructions' in content, false);
   assert.equal('knowledge' in content, false);
   const revoked = await identity(pool);
   await pool.query('UPDATE veridis_runtime_v1.sessions SET revoked=true WHERE token_hash=$1', [tokenHash(revoked.token)]);
   assert.equal((await request(base, revoked.token, '/organization')).status, 401);
   assert.equal((await request(base, 'y'.repeat(43), '/organization')).status, 401);
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
