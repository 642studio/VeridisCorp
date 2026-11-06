// Ejecutar con: node --import tsx scripts/verify-native-projects.mjs --live-fixture
// Crea un cliente inactivo de prueba y lo elimina con sus tareas/auditoría al finalizar.
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { projectsListTasksTool, projectsGetTaskTool, projectsCreateTaskTool, projectsUpdateTaskTool } from '../src/office/core-api-tools.ts';

if (!process.argv.includes('--live-fixture')) throw new Error('Requiere --live-fixture: crea y elimina datos sintéticos en el Core configurado');
if (!['127.0.0.1', 'localhost'].includes(new URL(process.env.CORE_API_URL).hostname)) throw new Error('La prueba solo admite Core en loopback');
const root = process.env.CORE_SOURCE_PATH ?? '/home/seis/642-Core-main';
const { createClient } = createRequire(`${root}/package.json`)('@supabase/supabase-js');
const env = parseEnv(readFileSync(`${root}/.env.local`, 'utf8'));
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const clientId = randomUUID();
const config = { metadata: { veridisAgentId: 'pm', veridisOrderId: randomUUID() } }; // metadata de un expediente sintético, sin invocar modelos
const invoke = async (tool, args) => JSON.parse(await tool.invoke(args, config));
let attempted = false;
try {
  attempted = true;
  const r = await db.from('clients').insert({ id: clientId, slug: `veridis-native-probe-${clientId}`, legal_name: '[PRUEBA TEMPORAL] Integración de proyectos Corp', status: 'inactive' });
  if (r.error) throw new Error(`No se pudo preparar fixture (${r.error.code})`);
  assert.equal((await invoke(projectsListTasksTool, { clientId })).tasks.length, 0);
  const creation = { clientId, operationKey: 'native-root', reason: 'Verificación técnica con datos sintéticos', task: { name: '[PRUEBA] Tarea raíz', priority: 'normal' } };
  const first = await invoke(projectsCreateTaskTool, creation);
  assert.equal(first.created, true); assert.equal(first.task.status, 'pending');
  const again = await invoke(projectsCreateTaskTool, creation);
  assert.equal(again.task.id, first.task.id); assert.equal(again.replayed, true);
  await assert.rejects(invoke(projectsCreateTaskTool, { ...creation, task: { name: 'Contenido diferente con la misma clave' } }), /409/);
  const child = await invoke(projectsCreateTaskTool, { clientId, operationKey: 'native-child', reason: 'Verificación de subtarea', task: { name: '[PRUEBA] Subtarea', parent_id: first.task.id } });
  assert.equal(child.task.parent_id, first.task.id);
  const read = await invoke(projectsGetTaskTool, { clientId, taskId: first.task.id });
  const edit = { clientId, taskId: first.task.id, expectedUpdatedAt: read.task.updated_at, reason: 'Avance simulado en fixture de prueba', changes: { status: 'in_progress' } };
  const changed = await invoke(projectsUpdateTaskTool, edit);
  assert.equal(changed.task.status, 'in_progress'); assert.equal(changed.auditResultRecorded, true);
  await assert.rejects(invoke(projectsUpdateTaskTool, edit), /409/);
  const reviewed = await invoke(projectsUpdateTaskTool, { ...edit, expectedUpdatedAt: changed.task.updated_at, changes: { status: 'review' } });
  assert.equal(reviewed.task.status, 'review');
  const list = await invoke(projectsListTasksTool, { clientId, limit: 1 });
  assert.equal(list.tasks.length, 1); assert(list.nextAfterId);
  const page2 = await invoke(projectsListTasksTool, { clientId, limit: 1, afterId: list.nextAfterId });
  assert.equal(page2.tasks.length, 1); assert.notEqual(page2.tasks[0].id, list.tasks[0].id);
  const observer = { metadata: { veridisAgentId: 'project-tracker', veridisOrderId: config.metadata.veridisOrderId } };
  assert.equal(JSON.parse(await projectsListTasksTool.invoke({ clientId }, observer)).tasks.length, 2);
  await assert.rejects(projectsUpdateTaskTool.invoke({ ...edit, expectedUpdatedAt: reviewed.task.updated_at }, observer), /400/);
  const history = await db.from('client_activity_log').select('id', { count: 'exact', head: true }).eq('client_id', clientId);
  assert.equal(history.error, null); assert(history.count >= 8);
  console.log('OK: creación y subtarea, repetición sin duplicar, conflicto de clave/versión, estados, paginación, lector sin escritura y auditoría real. Sin llamadas de IA.');
} finally {
  if (attempted) {
    const failures = [];
    for (const table of ['tasks', 'client_activity_log', 'clients']) {
      const result = await db.from(table).delete().eq(table === 'clients' ? 'id' : 'client_id', clientId);
      if (result.error) failures.push(`${table} (${result.error.code})`);
    }
    if (failures.length) throw new Error(`Limpieza incompleta de fixture ${clientId}: ${failures.join(', ')}`);
    console.log('Fixture eliminado: cliente, tareas y auditoría temporal.');
  }
}
