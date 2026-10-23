import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MemorySaver } from '@langchain/langgraph';
import { createWorkflow } from '../src/graph.js';
import { demoIntelligence } from '../src/intelligence.js';
import type { Intelligence } from '../src/contracts.js';

test('delega a especialistas y comparte resultados previos en orden', async () => {
  const graph = createWorkflow(demoIntelligence, new MemorySaver());
  const output = await graph.invoke({ request: 'Preparar un proyecto' }, {
    configurable: { thread_id: 'ordered' },
  });
  assert.deepEqual(output.results.map((r) => r.agent), ['operations', 'content', 'development']);
  assert.match(output.results[2]!.output, /Contexto recibido: 2/);
  assert.match(output.answer, /DEMO SIN IA/);
});

test('reanuda tras fallo sin repetir especialistas ya completados', async () => {
  const saver = new MemorySaver();
  const calls: string[] = [];
  let shouldFail = true;
  const intelligence: Intelligence = {
    ...demoIntelligence,
    async execute(request, task, previous) {
      calls.push(task.agent);
      if (task.agent === 'content' && shouldFail) {
        shouldFail = false;
        throw new Error('fallo simulado');
      }
      return demoIntelligence.execute(request, task, previous);
    },
  };
  const config = { configurable: { thread_id: 'recoverable' } };
  await assert.rejects(createWorkflow(intelligence, saver).invoke({ request: 'Prueba' }, config), /fallo simulado/);
  // Recrear el grafo comprueba que la continuación depende del checkpoint.
  const result = await createWorkflow(intelligence, saver).invoke(null, config);
  assert.equal(result.results.length, 3);
  assert.deepEqual(calls, ['operations', 'content', 'content', 'development']);
});

test('rechaza planes con agentes desconocidos o más de seis tareas', async () => {
  for (const tasks of [
    [{ agent: 'unknown', instruction: 'x' }],
    Array.from({ length: 7 }, () => ({ agent: 'operations', instruction: 'x' })),
  ]) {
    const intelligence = { ...demoIntelligence, plan: async () => ({ tasks }) } as unknown as Intelligence;
    await assert.rejects(createWorkflow(intelligence, new MemorySaver()).invoke(
      { request: 'Prueba' }, { configurable: { thread_id: 'invalid' } },
    ));
  }
});

test('mantiene aislados los estados de hilos distintos', async () => {
  const graph = createWorkflow(demoIntelligence, new MemorySaver());
  await graph.invoke({ request: 'Cliente A' }, { configurable: { thread_id: 'a' } });
  await graph.invoke({ request: 'Cliente B' }, { configurable: { thread_id: 'b' } });
  assert.equal((await graph.getState({ configurable: { thread_id: 'a' } })).values.request, 'Cliente A');
});
