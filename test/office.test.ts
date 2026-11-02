import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createOrder, type OfficeCommand, type Actor } from '../src/office/contracts.js';
import { applyCommand } from '../src/office/engine.js';
import { AgentRegistry, officeRegistry } from '../src/office/registry.js';
import { coordinator, specialist, runOfficeDemo } from '../src/office/demo.js';

function fixture(limits = { maxTasks: 10, maxSteps: 100, maxRevisionsPerTask: 1 }) {
  let order = createOrder({
    id: 'test-order', workspaceId: '642-studio', objective: 'Prueba de colaboración',
    criteria: [{ id: 'goal', description: 'Entregable revisado' }], limits,
  });
  const send = (actor: Actor, command: OfficeCommand) => {
    order = applyCommand(order, actor, command, officeRegistry);
    return order;
  };
  const add = (id = 'a', dependsOn: string[] = []) => send(coordinator, { type: 'add_task', task: {
    id, title: id, assignedAgentId: 'network', capability: 'network.audit', dependsOn,
    criteria: [{ id: 'criterion', description: 'Evidencia revisada' }],
  } });
  const submit = () => send(specialist('network'), { type: 'submit_result', taskId: 'a', submission: {
    summary: 'Resultado', evidence: [{ id: 'evidence', kind: 'observation', reference: 'demo://test', summary: 'Observación simulada' }],
  } });
  return { send, add, submit, get: () => order };
}

test('cada nivel de rigor resuelve sus propios límites cuando no se pasan límites explícitos', () => {
  const minimal = createOrder({
    id: 'rigor-minimal', workspaceId: '642-studio', objective: 'Prueba de rigor',
    criteria: [{ id: 'goal', description: 'Entregable revisado' }], rigor: 'minimal',
  });
  assert.equal(minimal.rigor, 'minimal');
  assert.deepEqual(minimal.limits, { maxTasks: 10, maxSteps: 200, maxRevisionsPerTask: 2 });

  const full = createOrder({
    id: 'rigor-full', workspaceId: '642-studio', objective: 'Prueba de rigor',
    criteria: [{ id: 'goal', description: 'Entregable revisado' }], rigor: 'full',
  });
  assert.equal(full.rigor, 'full');
  assert.deepEqual(full.limits, { maxTasks: 100, maxSteps: 10000, maxRevisionsPerTask: 20 });

  const sinRigor = createOrder({
    id: 'rigor-default', workspaceId: '642-studio', objective: 'Prueba de rigor',
    criteria: [{ id: 'goal', description: 'Entregable revisado' }],
  });
  assert.equal(sinRigor.rigor, 'standard');
  assert.deepEqual(sinRigor.limits, { maxTasks: 40, maxSteps: 2000, maxRevisionsPerTask: 5 });
});

test('un límite explícito siempre gana sobre el preajuste del nivel de rigor', () => {
  const order = createOrder({
    id: 'rigor-explicit', workspaceId: '642-studio', objective: 'Prueba de rigor',
    criteria: [{ id: 'goal', description: 'Entregable revisado' }],
    rigor: 'minimal', limits: { maxTasks: 99, maxSteps: 99, maxRevisionsPerTask: 9 },
  });
  assert.equal(order.rigor, 'minimal');
  assert.deepEqual(order.limits, { maxTasks: 99, maxSteps: 99, maxRevisionsPerTask: 9 });
});

test('oficina completa apoyo entre agentes, corrección, revisión y cierre', () => {
  const order = runOfficeDemo();
  assert.equal(order.status, 'completed');
  assert.equal(order.tasks.find((t) => t.id === 'audit')!.revisions, 1);
  assert(order.tasks.every((t) => t.status === 'completed'));
  assert(order.events.some((e) => e.command.type === 'request_support'));
  assert.equal(order.revision, order.events.length);
});

test('registro admite agentes nuevos sin cambiar el enum del motor', () => {
  const registry = new AgentRegistry([{
    id: 'legal-documents', version: '1.0.0', name: 'Documentos',
    capabilities: ['documents.classify'], allowedTools: [],
  }]);
  assert.equal(registry.find('documents.classify')[0]!.id, 'legal-documents');
  assert.throws(() => registry.requireCapability('legal-documents', 'network.audit'));
  assert.throws(() => new AgentRegistry([registry.get('legal-documents'), registry.get('legal-documents')]), /duplicado/);
});

test('solo el coordinador crea tareas y el agente asignado las ejecuta', () => {
  const f = fixture();
  f.add();
  assert.throws(() => f.send(specialist('research'), { type: 'start_task', taskId: 'a' }), /asignado/);
  assert.throws(() => f.send(specialist('network'), { type: 'add_task', task: {
    id: 'b', title: 'x', assignedAgentId: 'network', capability: 'network.audit', dependsOn: [],
    criteria: [{ id: 'c', description: 'x' }],
  } }), /coordinador/);
  assert.throws(() => f.send(coordinator, { type: 'add_task', task: {
    id: 'bad', title: 'x', assignedAgentId: 'research', capability: 'network.audit', dependsOn: [],
    criteria: [{ id: 'c', description: 'x' }],
  } }), /capacidad/);
});

test('dependencias pendientes impiden ejecutar y los ciclos se rechazan sin mutar estado', () => {
  const f = fixture();
  f.add();
  f.add('b', ['a']);
  assert.throws(() => f.send(specialist('network'), { type: 'start_task', taskId: 'b' }), /Dependencias/);
  f.send(specialist('network'), { type: 'start_task', taskId: 'a' });
  f.send(specialist('network'), { type: 'request_support', taskId: 'a', capability: 'news.research', question: 'Falta contexto' });
  const before = structuredClone(f.get());
  assert.throws(() => f.send(coordinator, { type: 'resolve_block', taskId: 'a', dependsOn: ['b'], resolution: 'Apoyo' }), /circulares/);
  assert.deepEqual(f.get(), before);
});

test('bloqueos requieren decisión del coordinador y un resultado no completa la tarea', () => {
  const f = fixture();
  f.add();
  f.send(specialist('network'), { type: 'start_task', taskId: 'a' });
  f.send(specialist('network'), { type: 'request_support', taskId: 'a', capability: 'news.research', question: 'Falta contexto' });
  assert.throws(() => f.submit(), /ejecución/);
  assert.throws(() => f.send(specialist('network'), { type: 'resolve_block', taskId: 'a', dependsOn: [], resolution: 'Listo' }), /coordinador/);
  f.send(coordinator, { type: 'resolve_block', taskId: 'a', dependsOn: [], resolution: 'Contexto recibido del usuario' });
  f.send(specialist('network'), { type: 'start_task', taskId: 'a' });
  f.submit();
  assert.equal(f.get().tasks[0]!.status, 'in_review');
});

test('la revisión exige capacidad, independencia, criterios completos y evidencia existente', () => {
  const f = fixture();
  f.add();
  f.send(specialist('network'), { type: 'start_task', taskId: 'a' });
  f.submit();
  const review: OfficeCommand = { type: 'review_task', taskId: 'a', assessments: [
    { criterionId: 'criterion', accepted: true, evidenceIds: ['evidence'], explanation: 'Correcto' },
  ] };
  assert.throws(() => f.send(specialist('network'), review), /capacidad/);
  assert.throws(() => f.send(specialist('review'), { ...review, assessments: [] }));
  assert.throws(() => f.send(specialist('review'), { ...review, assessments: [
    { criterionId: 'criterion', accepted: true, evidenceIds: ['inventada'], explanation: 'x' },
  ] }), /desconocida/);
  assert.throws(() => f.send(specialist('review'), { ...review, assessments: [
    { criterionId: 'criterion', accepted: true, evidenceIds: [], explanation: 'x' },
  ] }), /evidencia/);
  f.send(specialist('review'), review);
  assert.equal(f.get().tasks[0]!.status, 'completed');
});

test('revisión independiente también si el autor tiene capacidad de revisión', () => {
  const f = fixture();
  const registry = new AgentRegistry([{ ...officeRegistry.get('network'), capabilities: ['network.audit', 'work.review'] }]);
  f.add();
  f.send(specialist('network'), { type: 'start_task', taskId: 'a' });
  f.submit();
  assert.throws(() => applyCommand(f.get(), specialist('network'), {
    type: 'review_task', taskId: 'a', assessments: [
      { criterionId: 'criterion', accepted: true, evidenceIds: ['evidence'], explanation: 'x' },
    ],
  }, registry), /propio/);
});

test('límites de tareas, pasos y revisiones detienen crecimiento indefinido', () => {
  const f = fixture({ maxTasks: 1, maxSteps: 100, maxRevisionsPerTask: 0 });
  f.add();
  assert.throws(() => f.add('b'), /Límite/);
  f.send(specialist('network'), { type: 'start_task', taskId: 'a' });
  f.submit();
  f.send(specialist('review'), { type: 'review_task', taskId: 'a', assessments: [
    { criterionId: 'criterion', accepted: false, evidenceIds: [], explanation: 'Insuficiente' },
  ] });
  assert.equal(f.get().tasks[0]!.status, 'failed');
  const limited = fixture({ maxTasks: 10, maxSteps: 1, maxRevisionsPerTask: 1 });
  limited.add();
  assert.throws(() => limited.send(specialist('network'), { type: 'start_task', taskId: 'a' }), /pasos/);
  limited.send(coordinator, { type: 'pause_order', reason: 'Presupuesto de pasos agotado' });
  assert.equal(limited.get().status, 'paused');
});

test('cancel_task retira tareas huérfanas: exige que nada activo dependa de ella, nunca cuenta sola para cerrar', () => {
  const f = fixture();
  f.add('a');
  f.add('b', ['a']);
  f.send(specialist('network'), { type: 'start_task', taskId: 'a' });
  f.send(specialist('network'), { type: 'request_support', taskId: 'a', capability: 'network.audit', question: '¿confirmas alcance?' });
  assert.equal(f.get().tasks.find((t) => t.id === 'a')!.status, 'blocked');
  // b (pendiente) todavía depende de a: no se puede cancelar a primero.
  assert.throws(() => f.send(coordinator, { type: 'cancel_task', taskId: 'a', reason: 'resuelto de otra forma' }), /depende/);
  f.send(coordinator, { type: 'cancel_task', taskId: 'b', reason: 'redundante' });
  f.send(coordinator, { type: 'cancel_task', taskId: 'a', reason: 'resuelto de otra forma' });
  assert.equal(f.get().tasks.find((t) => t.id === 'a')!.status, 'cancelled');
  assert.equal(f.get().tasks.find((t) => t.id === 'b')!.status, 'cancelled');
  // Solo canceladas, ninguna completada: cerrar sigue rechazado.
  assert.throws(() => f.send(coordinator, { type: 'close_order', assessments: [
    { criterionId: 'goal', accepted: true, evidenceIds: [], explanation: 'x' },
  ] }), /completar/);
  // Ya cancelada: no se puede volver a cancelar.
  assert.throws(() => f.send(coordinator, { type: 'cancel_task', taskId: 'a', reason: 'x' }), /pendiente o bloqueada/);
  // Con una tarea real completada aparte, cerrar funciona aunque queden canceladas.
  f.add('c');
  f.send(specialist('network'), { type: 'start_task', taskId: 'c' });
  f.send(specialist('network'), { type: 'submit_result', taskId: 'c', submission: {
    summary: 'Resultado real', evidence: [{ id: 'evidence-c', kind: 'observation', reference: 'demo://c', summary: 'Observación' }],
  } });
  f.send(specialist('review'), { type: 'review_task', taskId: 'c', assessments: [
    { criterionId: 'criterion', accepted: true, evidenceIds: ['evidence-c'], explanation: 'ok' },
  ] });
  f.send(coordinator, { type: 'close_order', assessments: [
    { criterionId: 'goal', accepted: true, evidenceIds: ['evidence-c'], explanation: 'Cumplido con la tarea c; a y b se cancelaron.' },
  ] });
  assert.equal(f.get().status, 'completed');
});

test('no permite cerrar con tareas pendientes ni modificar un expediente cerrado', () => {
  const f = fixture();
  f.add();
  assert.throws(() => f.send(coordinator, { type: 'close_order', assessments: [
    { criterionId: 'goal', accepted: true, evidenceIds: [], explanation: 'x' },
  ] }), /sin completar/);
  assert.throws(() => applyCommand(runOfficeDemo(), coordinator, { type: 'pause_order', reason: 'x' }, officeRegistry), /activo/);
});
