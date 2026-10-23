import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Command, MemorySaver } from '@langchain/langgraph';
import { createOfficeWorkflow } from '../src/office/workflow.js';
import { AgentRegistry, officeRegistry } from '../src/office/registry.js';
import { createDemoOfficeIntelligence, createDemoOrder } from '../src/office/workflow-demo.js';
import type { OfficeIntelligence } from '../src/office/runtime-contracts.js';
import { WorkOrder } from '../src/office/contracts.js';

const config = (threadId: string) => ({ configurable: { thread_id: threadId }, recursionLimit: 500 });

test('LangGraph coordina apoyo, contexto entre agentes, corrección y cierre', async () => {
  const graph = createOfficeWorkflow(createDemoOfficeIntelligence(), officeRegistry, new MemorySaver());
  const output = await graph.invoke({ order: createDemoOrder() }, config('office-complete'));
  assert.equal(output.order.status, 'completed');
  const audit = output.order.tasks.find((t) => t.id === 'audit')!;
  assert.equal(audit.revisions, 1);
  assert.match(audit.submission!.summary, /research/);
  assert(output.order.events.some((e) => e.command.type === 'request_support'));
  assert.equal(output.rejectedDecisions, 0);
});

test('el checkpoint permite continuar con un grafo nuevo sin repetir investigación completada', async () => {
  const saver = new MemorySaver();
  const demo = createDemoOfficeIntelligence();
  let fail = true;
  const executed: string[] = [];
  const intelligence: OfficeIntelligence = {
    ...demo,
    async execute(context) {
      executed.push(context.task.id);
      if (context.task.id === 'audit' && context.dependencies.length && fail) {
        fail = false;
        throw new Error('interrupción simulada');
      }
      return demo.execute(context);
    },
  };
  const cfg = config('office-recovery');
  await assert.rejects(createOfficeWorkflow(intelligence, officeRegistry, saver).invoke({ order: createDemoOrder() }, cfg), /interrupción simulada/);
  const restarted = createOfficeWorkflow(intelligence, officeRegistry, saver);
  const before = await restarted.getState(cfg);
  assert.equal(WorkOrder.parse(before.values.order).tasks.find((t) => t.id === 'research')!.status, 'completed');
  assert.deepEqual(before.next, ['execute']);
  const result = await restarted.invoke(null, cfg);
  assert.equal(result.order.status, 'completed');
  assert.equal(executed.filter((id) => id === 'research').length, 1);
  assert.equal(result.order.tasks.length, 2);
});

test('pregunta humana se guarda y continúa una sola vez con su respuesta', async () => {
  const saver = new MemorySaver();
  const demo = createDemoOfficeIntelligence({ askFirst: true });
  let asked = 0;
  const intelligence: OfficeIntelligence = {
    ...demo,
    async coordinate(context) {
      if (!context.exchanges.length) asked += 1;
      return demo.coordinate(context);
    },
  };
  const cfg = config('office-human');
  const graph = createOfficeWorkflow(intelligence, officeRegistry, saver);
  const waiting = await graph.invoke({ order: createDemoOrder() }, cfg);
  assert.equal((await graph.getState(cfg)).tasks.flatMap((task) => task.interrupts || []).length, 1);
  assert.equal(waiting.order.events.length, 0);
  const restarted = createOfficeWorkflow(intelligence, officeRegistry, saver);
  const result = await restarted.invoke(new Command({ resume: 'Informe de oficina' }), cfg);
  assert.equal(result.order.status, 'completed');
  assert.equal(result.exchanges.length, 1);
  assert.equal(result.exchanges[0]!.answer, 'Informe de oficina');
  assert.equal(asked, 1);
  assert.match(result.order.tasks[0]!.submission!.summary, /Informe de oficina/);
});

test('decisiones inválidas se informan al coordinador y su repetición pausa el expediente', async () => {
  const seenErrors: (string | null)[] = [];
  const intelligence: OfficeIntelligence = {
    ...createDemoOfficeIntelligence(),
    async coordinate(context) {
      seenErrors.push(context.lastError);
      return { type: 'dispatch', taskId: 'inexistente' };
    },
  };
  const graph = createOfficeWorkflow(intelligence, officeRegistry, new MemorySaver(), { maxRejectedDecisions: 2 });
  const result = await graph.invoke({ order: createDemoOrder() }, config('office-invalid'));
  assert.equal(result.order.status, 'paused');
  assert.equal(result.rejectedDecisions, 2);
  assert.equal(result.order.tasks.length, 0);
  assert.deepEqual(seenErrors, [null, 'Tarea inexistente']);
});

test('el coordinador puede corregir una decisión rechazada y continuar', async () => {
  const demo = createDemoOfficeIntelligence();
  const intelligence: OfficeIntelligence = {
    ...demo,
    async coordinate(context) {
      if (!context.lastError && !context.order.tasks.length) return { type: 'dispatch', taskId: 'unknown' };
      return demo.coordinate(context);
    },
  };
  const graph = createOfficeWorkflow(intelligence, officeRegistry, new MemorySaver());
  const result = await graph.invoke({ order: createDemoOrder() }, config('office-correct'));
  assert.equal(result.order.status, 'completed');
  assert.equal(result.rejectedDecisions, 1);
});

test('no se aceptan actores inventados dentro de una decisión del modelo', async () => {
  const intelligence: OfficeIntelligence = {
    ...createDemoOfficeIntelligence(),
    async coordinate() {
      return { type: 'command', actor: { role: 'coordinator' }, command: { type: 'pause_order', reason: 'x' } };
    },
  };
  const result = await createOfficeWorkflow(intelligence, officeRegistry, new MemorySaver(), { maxRejectedDecisions: 1 })
    .invoke({ order: createDemoOrder() }, config('office-actor'));
  assert.equal(result.order.pauseReason, 'Demasiadas decisiones rechazadas');
});

test('el límite de turnos pausa aunque el coordinador no produzca avances', async () => {
  const graph = createOfficeWorkflow(createDemoOfficeIntelligence(), officeRegistry, new MemorySaver(), { maxTurns: 1 });
  const result = await graph.invoke({ order: createDemoOrder() }, config('office-budget'));
  assert.equal(result.order.status, 'paused');
  assert.equal(result.turns, 1);
  assert.match(result.order.pauseReason!, /Límite/);
});

test('cambiar la versión de un agente impide reinterpretar un checkpoint pendiente', async () => {
  const saver = new MemorySaver();
  const intelligence = createDemoOfficeIntelligence({ askFirst: true });
  const cfg = config('office-version');
  await createOfficeWorkflow(intelligence, officeRegistry, saver).invoke({ order: createDemoOrder() }, cfg);
  const changedRegistry = new AgentRegistry(officeRegistry.list().map((agent) => ({ ...agent, version: '3.0.0' })), officeRegistry.organization!.snapshot());
  const changed = createOfficeWorkflow(intelligence, changedRegistry, saver);
  await assert.rejects(changed.invoke(new Command({ resume: 'Continuar' }), cfg), /versión/);
});

test('una entrega sin evidencias no se registra como resultado válido', async () => {
  const saver = new MemorySaver();
  const demo = createDemoOfficeIntelligence();
  const intelligence: OfficeIntelligence = {
    ...demo,
    async execute() { return { type: 'result', submission: { summary: 'Inventado', evidence: [] } }; },
  };
  const graph = createOfficeWorkflow(intelligence, officeRegistry, saver);
  const cfg = config('office-evidence');
  // Una entrega con forma inválida (Zod la rechaza) ya no tumba la ejecución: se trata como
  // una decisión rechazada y, al repetirse siempre igual, termina pausando el expediente.
  const result = await graph.invoke({ order: createDemoOrder() }, cfg);
  assert.equal(result.order.status, 'paused');
  assert.equal(result.order.tasks[0]!.status, 'running');
  assert.equal(result.order.tasks[0]!.submission, undefined);
});

test('reserva los pasos de inicio y entrega antes de asignar trabajo', async () => {
  const order = createDemoOrder();
  order.limits.maxSteps = 2;
  const graph = createOfficeWorkflow(createDemoOfficeIntelligence(), officeRegistry, new MemorySaver());
  const result = await graph.invoke({ order }, config('office-reserve'));
  assert.equal(result.order.status, 'paused');
  assert.equal(result.order.tasks[0]!.status, 'pending');
  assert.match(result.order.pauseReason!, /Pasos insuficientes/);
});

test('los adaptadores reciben copias y no pueden modificar el expediente por referencia', async () => {
  const demo = createDemoOfficeIntelligence();
  const intelligence: OfficeIntelligence = {
    ...demo,
    async execute(context) {
      const result = await demo.execute(context);
      context.task.title = 'Mutación de prueba';
      context.exchanges.push({ question: 'Inyectada', answer: 'x' });
      return result;
    },
  };
  const graph = createOfficeWorkflow(intelligence, officeRegistry, new MemorySaver());
  const result = await graph.invoke({ order: createDemoOrder() }, config('office-copies'));
  assert.equal(result.order.status, 'completed');
  assert(!result.order.tasks.some((t) => t.title === 'Mutación de prueba'));
  assert.equal(result.exchanges.length, 0);
});
