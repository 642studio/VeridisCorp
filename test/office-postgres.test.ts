import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import { WorkOrder } from '../src/office/contracts.js';
import { createOfficeWorkflow } from '../src/office/workflow.js';
import { officeRegistry } from '../src/office/registry.js';
import { createDemoOfficeIntelligence, createDemoOrder } from '../src/office/workflow-demo.js';
import type { OfficeIntelligence } from '../src/office/runtime-contracts.js';

// Opt-in: crea tablas oficiales en una base de pruebas dedicada.
const connectionString = process.env.VERIDIS_TEST_DATABASE_URL;
test('PostgreSQL conserva el avance al cerrar y volver a abrir todas las conexiones', {
  skip: !connectionString, timeout: 30000,
}, async () => {
  const cfg = { configurable: { thread_id: `office-test:${randomUUID()}` }, recursionLimit: 500 };
  const demo = createDemoOfficeIntelligence();
  let fail = true;
  let researchExecutions = 0;
  const intelligence: OfficeIntelligence = {
    ...demo,
    async execute(context) {
      if (context.task.id === 'research') researchExecutions += 1;
      if (context.task.id === 'audit' && context.dependencies.length && fail) {
        fail = false;
        throw new Error('fallo posterior a investigación');
      }
      return demo.execute(context);
    },
  };
  const pool = new Pool({ connectionString, connectionTimeoutMillis: 5000 });
  try {
    const saver = new PostgresSaver(pool);
    await saver.setup();
    await assert.rejects(createOfficeWorkflow(intelligence, officeRegistry, saver)
      .invoke({ order: createDemoOrder() }, cfg), /fallo posterior/);
  } finally {
    await pool.end();
  }
  const restartedPool = new Pool({ connectionString, connectionTimeoutMillis: 5000 });
  const saver = new PostgresSaver(restartedPool);
  try {
    const graph = createOfficeWorkflow(intelligence, officeRegistry, saver);
    const snapshot = await graph.getState(cfg);
    assert.equal(WorkOrder.parse(snapshot.values.order).tasks.find((t) => t.id === 'research')!.status, 'completed');
    const output = await graph.invoke(null, cfg);
    assert.equal(output.order.status, 'completed');
    assert.equal(researchExecutions, 1);
    assert.equal(output.order.tasks.length, 2);
  } finally {
    try { await saver.deleteThread(cfg.configurable.thread_id); }
    finally { await restartedPool.end(); }
  }
});
