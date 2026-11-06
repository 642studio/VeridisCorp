import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crmInspectWorkspaceTool, crmUpdateContactTool, projectsCreateTaskTool } from '../src/office/core-api-tools.js';
import { toolsFor } from '../src/office/tools.js';
import { officeRegistry } from '../src/office/registry.js';

const id = '00000000-0000-4000-8000-000000000001';
test('Core: lectura no ofrece herramientas de edición y el modelo no puede escoger identidad', async (t) => {
  assert(toolsFor(['core.read']).some((tool) => tool.name === 'crm_inspect_workspace'));
  assert(!toolsFor(['core.read']).some((tool) => tool.name.startsWith('crm_update_')));
  const old = { url: process.env.CORE_API_URL, token: process.env.CORE_API_TOKEN };
  process.env.CORE_API_URL = 'http://127.0.0.1:3100';
  process.env.CORE_API_TOKEN = 'secret-only-in-server';
  try {
    let sent: Record<string, unknown> | undefined;
    t.mock.method(globalThis, 'fetch', async (_url: unknown, options: RequestInit) => {
      sent = JSON.parse(options.body as string);
      return Response.json({ updated: true });
    });
    await assert.rejects(crmInspectWorkspaceTool.invoke({ clientId: id }), /agente y expediente/);
    await crmUpdateContactTool.invoke({ clientId: id, recordId: id, expectedUpdatedAt: '2026-11-05T20:00:00Z', changes: { phone: '123' } }, { metadata: { veridisAgentId: 'pm', veridisOrderId: id } });
    assert.equal(sent?.agentId, 'pm');
    assert.equal(sent?.orderId, id);
    assert.equal(sent?.action, 'update_contact');
    assert(!JSON.stringify(sent).includes('secret-only-in-server'));
    await projectsCreateTaskTool.invoke({ clientId: id, operationKey: 'native-1', reason: 'Encargo explícito', task: { name: 'Tarea interna' } }, { metadata: { veridisAgentId: 'pm', veridisOrderId: id } });
    assert.equal(sent?.action, 'create_task');
    assert.equal(sent?.operationKey, 'native-1');
  } finally {
    if (old.url === undefined) delete process.env.CORE_API_URL; else process.env.CORE_API_URL = old.url;
    if (old.token === undefined) delete process.env.CORE_API_TOKEN; else process.env.CORE_API_TOKEN = old.token;
  }
});

test('proyectos internos: especialistas solo consultan, PM escribe y ningún perfil usa ClickUp', () => {
  assert.deepEqual(toolsFor(['projects.read']).map((t) => t.name), ['projects_list_tasks', 'projects_get_task']);
  assert.deepEqual(toolsFor(['projects.write']).map((t) => t.name), ['projects_create_task', 'projects_update_task']);
  const agents = officeRegistry.list();
  assert(!agents.some((a) => a.allowedTools.includes('clickup.read')));
  assert.deepEqual(agents.filter((a) => a.allowedTools.includes('projects.write')).map((a) => a.id), ['pm']);
  for (const id of ['project-planner', 'project-tracker', 'human-task-coordinator']) {
    assert(agents.find((a) => a.id === id)?.allowedTools.includes('projects.read'));
  }
});
