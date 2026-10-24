import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { migrate, provisionSession, scopeKey } from '../src/runtime/database.js';
import { OfficeRuntime, scheduler } from '../src/runtime/office-runtime.js';
import { fireOnce } from '../src/runtime/scheduler.js';
import type { AccessScope, Principal } from '../src/governance/contracts.js';
import type { OfficeIntelligence } from '../src/office/runtime-contracts.js';

// Determinista: crea una tarea, la despacha, la revisa y cierra — igual que la de
// runtime-postgres.test.ts, duplicada aquí a propósito (cada archivo de prueba Postgres de
// este proyecto es autocontenido, no comparten un módulo de utilidades de prueba).
function officeTestIntelligence(options: { alwaysFail?: boolean } = {}): OfficeIntelligence {
 return {
  async coordinate({ order }) {
   const task = order.tasks[0];
   if (!task) return { type: 'command', command: { type: 'add_task', task: {
    id: 'task-1', title: 'Prueba programada', assignedAgentId: 'content', capability: 'content.draft',
    dependsOn: [], criteria: [{ id: 'c1', description: 'Responde al objetivo' }],
   } } };
   if (options.alwaysFail) return { type: 'command', command: { type: 'pause_order', reason: 'Fallo forzado de prueba' } };
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

async function makeScope(): Promise<AccessScope> {
 return { workspaceId: randomUUID(), companyId: '642', divisionId: 'studio', clientId: randomUUID(), projectId: 'office-pilot' };
}

async function grantScheduler(pool: Pool, scope: AccessScope) {
 const human: Principal = { kind: 'human', id: randomUUID() };
 await provisionSession(pool, { principal: human, scope, expiresAt: new Date(Date.now() + 3600000).toISOString(), permissions: [
  { principal: scheduler, operations: ['draft.create'], resourceType: 'workflow', resourceIds: ['office-pilot'] },
 ] });
}

async function insertSchedule(pool: Pool, scope: AccessScope, overrides: Partial<{ objective: string }> = {}) {
 const id = randomUUID();
 await pool.query(
  `INSERT INTO veridis_runtime_v1.scheduled_tasks(id, scope_key, scope, name, objective_template, cron_expression, timezone)
   VALUES($1,$2,$3,$4,$5,$6,$7)`,
  [id, scopeKey(scope), scope, 'Prueba programada', overrides.objective ?? 'Preparar un expediente de prueba programada', '0 9 * * 1', 'America/Hermosillo'],
 );
 return id;
}

async function readSchedule(pool: Pool, id: string) {
 const row = await pool.query('SELECT * FROM veridis_runtime_v1.scheduled_tasks WHERE id=$1', [id]);
 return row.rows[0] as {
  current_order_id: string | null; consecutive_failures: number; enabled: boolean;
  last_run_at: Date | null; last_fired_order_id: string | null;
 };
}

test('fireOnce dispara un expediente real y actualiza la tarea programada', { skip: !connectionString, timeout: 30000 }, async (t) => {
 const pool = new Pool({ connectionString, max: 8 }); await migrate(pool);
 const office = new OfficeRuntime(pool, officeTestIntelligence(), { maxTurns: 10, maxRejectedDecisions: 3, maxQuestions: 2 });
 await office.setup();
 try {
  await t.test('un disparo normal crea un expediente real marcado como automático', async () => {
   const scope = await makeScope();
   await grantScheduler(pool, scope);
   const scheduleId = await insertSchedule(pool, scope);

   const result = await fireOnce(pool, office, scheduleId);
   assert.equal(result, 'fired');

   const row = await readSchedule(pool, scheduleId);
   assert.equal(row.current_order_id, null, 'el candado debe liberarse al terminar');
   assert.equal(row.consecutive_failures, 0);
   assert(row.last_run_at);
   assert(row.last_fired_order_id);

   const order = await pool.query('SELECT status, created_by_schedule_id FROM veridis_runtime_v1.office_orders WHERE id=$1', [row.last_fired_order_id]);
   assert.equal(order.rows[0].status, 'completed');
   assert.equal(order.rows[0].created_by_schedule_id, scheduleId);
  });

  await t.test('un segundo disparo mientras el candado sigue puesto se salta', async () => {
   const scope = await makeScope();
   await grantScheduler(pool, scope);
   const scheduleId = await insertSchedule(pool, scope);
   // Simula un disparo todavía en curso, sin esperar a que fireOnce lo libere.
   await pool.query('UPDATE veridis_runtime_v1.scheduled_tasks SET current_order_id=$2 WHERE id=$1', [scheduleId, randomUUID()]);

   const result = await fireOnce(pool, office, scheduleId);
   assert.equal(result, 'skipped-overlap');
  });

  await t.test('el límite de tasa por scope se respeta y no cuenta como fallo', async () => {
   const scope = await makeScope();
   await grantScheduler(pool, scope);
   const scheduleId = await insertSchedule(pool, scope);

   const first = await fireOnce(pool, office, scheduleId, { maxPerHour: 1 });
   assert.equal(first, 'fired');
   const second = await fireOnce(pool, office, scheduleId, { maxPerHour: 1 });
   assert.equal(second, 'skipped-rate-limit');

   const row = await readSchedule(pool, scheduleId);
   assert.equal(row.consecutive_failures, 0, 'un salto por límite de tasa no es un fallo');
   assert.equal(row.enabled, true);
  });

  await t.test('se apaga sola tras alcanzar el umbral de fallos consecutivos', async () => {
   const scope = await makeScope();
   await grantScheduler(pool, scope);
   const scheduleId = await insertSchedule(pool, scope);
   const failingOffice = new OfficeRuntime(pool, officeTestIntelligence({ alwaysFail: true }), { maxTurns: 10, maxRejectedDecisions: 3, maxQuestions: 2 });
   await failingOffice.setup();

   const result = await fireOnce(pool, failingOffice, scheduleId, { failureThreshold: 1 });
   assert.equal(result, 'skipped-disabled');

   const row = await readSchedule(pool, scheduleId);
   assert.equal(row.consecutive_failures, 1);
   assert.equal(row.enabled, false);

   // Una tarea deshabilitada no puede reclamarse: el candado del UPDATE exige enabled=true.
   const again = await fireOnce(pool, failingOffice, scheduleId, { failureThreshold: 1 });
   assert.equal(again, 'skipped-overlap');
  });
 } finally { await pool.end(); }
});
