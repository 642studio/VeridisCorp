import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MemorySaver } from '@langchain/langgraph';
import { budgetStatus, budgetBlockReason } from '../src/office/budget.js';
import type { ModelCallRecord, ModelSelection } from '../src/office/models.js';
import { ModelRouter } from '../src/office/models.js';
import type { PriceList } from '../src/office/prices.js';
import { createOfficeWorkflow } from '../src/office/workflow.js';
import { officeRegistry } from '../src/office/registry.js';
import { createDemoOfficeIntelligence, createDemoOrder } from '../src/office/workflow-demo.js';
import type { OfficeIntelligence } from '../src/office/runtime-contracts.js';

const selection: ModelSelection = { stage: 'execute', agentId: 'network', capability: 'network.audit', profileId: 'base', provider: 'openai', model: 'test-model' };
const priced = (costMicros: number): ModelCallRecord => ({ ...selection, inputTokens: 1, outputTokens: 1, costMicros, costStatus: 'estimated' });
const unpriced: ModelCallRecord = { ...selection, inputTokens: null, outputTokens: null, costMicros: null, costStatus: 'unknown' };
const priceList: PriceList = { version: 1, currency: 'USD', prices: {
  'openai:test-model': { inputMicrosPerMillionTokens: 1_000_000, outputMicrosPerMillionTokens: 0 },
} };

test('budgetStatus suma solo lo que tiene costo conocido y cuenta aparte lo que no', () => {
  const status = budgetStatus([priced(100), unpriced, priced(50)], null);
  assert.equal(status.level, 'none');
  assert.equal(status.spentMicros, 150);
  assert.equal(status.unpricedCalls, 1);
});

test('budgetStatus marca ok, warning (80%), critical (90%) y exceeded (100%)', () => {
  assert.equal(budgetStatus([priced(79)], 100).level, 'ok');
  assert.equal(budgetStatus([priced(80)], 100).level, 'warning');
  assert.equal(budgetStatus([priced(90)], 100).level, 'critical');
  assert.equal(budgetStatus([priced(100)], 100).level, 'exceeded');
});

test('la proyección es la llamada más cara de las últimas 5 con precio, no el promedio', () => {
  // La de 900 queda fuera de la ventana; entre las últimas 5 la más cara es 40.
  const calls = [priced(900), priced(10), priced(40), unpriced, priced(20), priced(5), priced(30)];
  assert.equal(budgetStatus(calls, null).projectedNextMicros, 40);
  assert.equal(budgetStatus([], null).projectedNextMicros, null);
});

test('budgetBlockReason nunca bloquea sin presupuesto configurado', () => {
  assert.equal(budgetBlockReason([priced(1_000_000)], null, null, selection), null);
  assert.equal(budgetBlockReason([priced(1_000_000)], undefined, null, selection), null);
});

test('budgetBlockReason bloquea si el próximo modelo no tiene precio: un gasto que no se puede medir', () => {
  assert.match(budgetBlockReason([], 1000, null, selection)!, /sin precio para openai:test-model/);
  assert.match(budgetBlockReason([], 1000, { ...priceList, prices: {} }, selection)!, /sin precio/);
});

test('budgetBlockReason bloquea si ya se agotó o si la próxima llamada proyectada lo rebasaría', () => {
  assert.match(budgetBlockReason([priced(1000)], 1000, priceList, selection)!, /agotado/);
  // 800 gastados + 400 proyectados = 1200: rebasa 1000, pero cabe exacto en 1200.
  assert.match(budgetBlockReason([priced(400), priced(400)], 1000, priceList, selection)!, /proyectado/);
  assert.equal(budgetBlockReason([priced(400), priced(400)], 1200, priceList, selection), null);
  // Primera llamada: sin historial no hay proyección, solo se exige el precio.
  assert.equal(budgetBlockReason([], 1000, priceList, selection), null);
});

// Cada llamada real del fake cuesta exactamente 100 micros (100 tokens de entrada a 1_000_000
// micros por millón, salida gratis), para que el punto de corte sea exacto.
function costedIntelligence(): OfficeIntelligence {
  const demo = createDemoOfficeIntelligence();
  const router = new ModelRouter({ version: 1, defaultProfile: 'base', profiles: {
    base: { provider: 'openai', model: 'test-model', apiKeyEnv: 'TEST_KEY' },
  } });
  const usage = { inputTokens: 100, outputTokens: 0 };
  return {
    ...demo,
    selectModel: (request) => router.select(request),
    async coordinate(context, onUsage) { onUsage?.(usage); return demo.coordinate(context); },
    async execute(context, onUsage) { onUsage?.(usage); return demo.execute(context); },
    async review(context, onUsage) { onUsage?.(usage); return demo.review(context); },
  };
}

test('el workflow pausa antes de la llamada que rebasaría el presupuesto, nunca después', async () => {
  const order = createDemoOrder();
  order.limits.maxCostMicros = 350;
  const graph = createOfficeWorkflow(costedIntelligence(), officeRegistry, new MemorySaver(), { priceList });
  const result = await graph.invoke({ order }, { configurable: { thread_id: 'budget-projection' }, recursionLimit: 200 });
  assert.equal(result.order.status, 'paused');
  assert.match(result.order.pauseReason!, /Presupuesto proyectado/);
  // 3 llamadas = 300; la cuarta (proyectada en 100) habría llegado a 400 > 350.
  assert.equal(result.modelCalls.length, 3);
  assert.equal(result.modelCalls.reduce((sum, c) => sum + c.costMicros!, 0), 300);
});

test('con presupuesto pero sin precio para el modelo, pausa antes de la primera llamada', async () => {
  const order = createDemoOrder();
  order.limits.maxCostMicros = 1_000_000;
  const graph = createOfficeWorkflow(costedIntelligence(), officeRegistry, new MemorySaver(), { priceList: null });
  const result = await graph.invoke({ order }, { configurable: { thread_id: 'budget-unpriced' }, recursionLimit: 200 });
  assert.equal(result.order.status, 'paused');
  assert.match(result.order.pauseReason!, /no se puede verificar/);
  assert.equal(result.modelCalls.length, 0);
});

test('sin presupuesto el workflow corre igual que antes, aunque haya costo', async () => {
  const graph = createOfficeWorkflow(costedIntelligence(), officeRegistry, new MemorySaver(), { priceList });
  const result = await graph.invoke({ order: createDemoOrder() }, { configurable: { thread_id: 'budget-none' }, recursionLimit: 500 });
  assert.equal(result.order.status, 'completed');
  assert(result.modelCalls.every((c) => c.costStatus === 'estimated' && c.costMicros === 100));
});
