import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Command, MemorySaver } from '@langchain/langgraph';
import { ModelRouter, loadModelRouter, type ModelPolicyInput } from '../src/office/models.js';
import { createProfileModel, type StructuredInvoker, type StructuredRequest } from '../src/office/model-providers.js';
import { createOfficeIntelligence } from '../src/office/intelligence.js';
import { createOfficeWorkflow } from '../src/office/workflow.js';
import { officeRegistry } from '../src/office/registry.js';
import { createDemoOfficeIntelligence, createDemoOrder } from '../src/office/workflow-demo.js';
import type { CoordinatorContext, SpecialistContext } from '../src/office/runtime-contracts.js';

function policy(): ModelPolicyInput {
  return {
    version: 1, defaultProfile: 'base',
    profiles: {
      base: { provider: 'openai', model: 'test-base', apiKeyEnv: 'TEST_KEY' },
      planning: { provider: 'anthropic', model: 'test-planning', apiKeyEnv: 'TEST_KEY' },
      research: { provider: 'google', model: 'test-research', apiKeyEnv: 'TEST_KEY' },
      network: { provider: 'openai', model: 'test-network', apiKeyEnv: 'TEST_KEY' },
    },
    stages: { coordinate: 'planning', review: 'research' },
    agents: { network: { execute: 'network' }, research: { execute: 'research' } },
    rules: [
      { stage: 'execute', capability: 'network.audit', profile: 'base' },
      { stage: 'execute', agentId: 'network', capability: 'network.audit', profile: 'planning' },
    ],
  };
}

test('selección por agente y tarea precede capacidad, agente, etapa y valor general', () => {
  const router = new ModelRouter(policy());
  const resolve = (agentId: string, capability: string, stage: 'execute' | 'review' = 'execute') =>
    router.select({ agentId, capability, stage }).profileId;
  assert.equal(resolve('network', 'network.audit'), 'planning');
  assert.equal(resolve('other-agent', 'network.audit'), 'base');
  assert.equal(resolve('network', 'other-capability'), 'network');
  assert.equal(resolve('other-agent', 'other-capability', 'review'), 'research');
  assert.equal(resolve('other-agent', 'other-capability'), 'base');
});

test('coordinador, especialista y revisor pueden usar proveedores diferentes', () => {
  const router = new ModelRouter(policy());
  assert.equal(router.select({ stage: 'coordinate', agentId: 'coordinator', capability: 'office.coordinate' }).provider, 'anthropic');
  assert.equal(router.select({ stage: 'execute', agentId: 'development', capability: 'software.design' }).provider, 'openai');
  assert.equal(router.select({ stage: 'review', agentId: 'review', capability: 'software.design' }).provider, 'google');
});

test('la plantilla permite al mismo agente diseñar, implementar y documentar con tres perfiles', () => {
  const template = JSON.parse(readFileSync(new URL('../config/models.example.json', import.meta.url), 'utf8'));
  const router = new ModelRouter(template, {
    VERIDIS_MODEL_ROUTINE: 'test-routine', VERIDIS_MODEL_REASONING: 'test-reasoning',
    VERIDIS_MODEL_RESEARCH: 'test-research', VERIDIS_MODEL_CODE: 'test-code',
  });
  const model = (capability: string) => router.select({ stage: 'execute', agentId: 'development', capability }).model;
  assert.equal(model('software.design'), 'test-reasoning');
  assert.equal(model('software.implement'), 'test-code');
  assert.equal(model('software.document'), 'test-routine');
});

test('rechaza perfiles inexistentes y reglas duplicadas antes de invocar modelos', () => {
  assert.throws(() => new ModelRouter({ ...policy(), defaultProfile: 'missing' }), /inexistente/);
  const input = policy();
  input.rules!.push({ ...input.rules![0]! });
  assert.throws(() => new ModelRouter(input), /duplicadas/);
});

test('resuelve modelos por entorno, mantiene compatibilidad y no incluye secretos en la política', () => {
  const router = loadModelRouter({ OPENAI_MODEL: 'test-env', OPENAI_API_KEY: 'secret-sentinel' });
  assert.equal(router.select({ stage: 'execute', agentId: 'a', capability: 'b' }).model, 'test-env');
  assert(!JSON.stringify(router.snapshot()).includes('secret-sentinel'));
  assert.throws(() => loadModelRouter({}), /Falta el modelo/);
  assert.equal(router.fingerprint, loadModelRouter({ OPENAI_MODEL: 'test-env', OPENAI_API_KEY: 'rotated-sentinel' }).fingerprint);
});

test('el endpoint compatible rechaza credenciales embebidas y no se admite en otros adaptadores', () => {
  const base = { provider: 'openai' as const, model: 'test', apiKeyEnv: 'TEST_KEY' };
  for (const baseURL of ['https://user:pass@example.com/v1', 'https://example.com/v1?key=secret', 'file:///tmp/api']) {
    assert.throws(() => new ModelRouter({ version: 1, defaultProfile: 'a', profiles: { a: { ...base, baseURL } } }));
  }
  assert.throws(() => new ModelRouter({ version: 1, defaultProfile: 'a', profiles: {
    a: { ...base, provider: 'anthropic', baseURL: 'https://example.com/v1' },
  } }));
});

test('crea los tres adaptadores sin enviar solicitudes y exige la credencial seleccionada', () => {
  const router = new ModelRouter(policy());
  for (const id of ['base', 'planning', 'research']) {
    assert.throws(() => createProfileModel(router.profile(id), {}), /Falta la credencial/);
    const client = createProfileModel(router.profile(id), { TEST_KEY: 'test-key-without-network' });
    assert.equal(typeof client.invoke, 'function');
  }
});

function fakeInvoker(calls: StructuredRequest[], askFirst = false): StructuredInvoker {
  const demo = createDemoOfficeIntelligence({ askFirst });
  return async (request) => {
    calls.push(request);
    const context = JSON.parse(request.messages[1]!.content);
    if (request.schemaName === 'office_decision') return { decision: await demo.coordinate(context as CoordinatorContext) };
    if (request.schemaName === 'office_worker') return { reply: await demo.execute(context as SpecialistContext) };
    return demo.review(context as SpecialistContext);
  };
}

test('el workflow usa el modelo seleccionado para cada rol y conserva su registro', async () => {
  const calls: StructuredRequest[] = [];
  const intelligence = createOfficeIntelligence({ router: new ModelRouter(policy()), invoker: fakeInvoker(calls) });
  const graph = createOfficeWorkflow(intelligence, officeRegistry, new MemorySaver());
  const result = await graph.invoke({ order: createDemoOrder() }, { configurable: { thread_id: 'routed' }, recursionLimit: 500 });
  assert.equal(result.order.status, 'completed');
  assert.equal(result.modelCalls.length, calls.length);
  assert.deepEqual(result.modelCalls, calls.map((c) => c.selection));
  assert(calls.some((c) => c.selection.agentId === 'network' && c.selection.model === 'test-planning'));
  assert(calls.some((c) => c.selection.agentId === 'research' && c.selection.model === 'test-research'));
  assert(calls.some((c) => c.selection.stage === 'review' && c.selection.provider === 'google'));
});

test('cambiar la política impide reanudar silenciosamente con otro modelo', async () => {
  const saver = new MemorySaver();
  const cfg = { configurable: { thread_id: 'model-change' }, recursionLimit: 500 };
  const first = createOfficeIntelligence({ router: new ModelRouter(policy()), invoker: fakeInvoker([], true) });
  await createOfficeWorkflow(first, officeRegistry, saver).invoke({ order: createDemoOrder() }, cfg);
  const updated = policy();
  updated.profiles.planning!.model = 'test-planning-v2';
  const second = createOfficeIntelligence({ router: new ModelRouter(updated), invoker: fakeInvoker([], true) });
  const restarted = createOfficeWorkflow(second, officeRegistry, saver);
  await assert.rejects(restarted.invoke(new Command({ resume: 'Contexto' }), cfg), /política de modelos/);
});

test('corrige una decisión del coordinador anidada por error dentro de command antes de validar', async () => {
  // Patrón real observado con llamadas reales a OpenAI (functionCalling): el modelo anida
  // delegate/dispatch/review/ask_user dentro de 'command', que solo admite add_task,
  // resolve_block, close_order o pause_order.
  const invoker: StructuredInvoker = async () => ({
    decision: { type: 'command', command: { type: 'delegate', managerId: 'cto', request: 'Prueba', dependsOn: [] } },
  });
  const intelligence = createOfficeIntelligence({ router: new ModelRouter(policy()), invoker });
  const { events, ...order } = createDemoOrder();
  const decision = await intelligence.coordinate({ order, recentEvents: events, agents: [], exchanges: [], lastError: null });
  assert.deepEqual(decision, { type: 'delegate', managerId: 'cto', request: 'Prueba', dependsOn: [] });
});

test('el adaptador valida la respuesta aunque el proveedor entregue un formato incorrecto', async () => {
  const intelligence = createOfficeIntelligence({ router: new ModelRouter(policy()), invoker: async () => ({ actor: 'inventado' }) });
  const graph = createOfficeWorkflow(intelligence, officeRegistry, new MemorySaver());
  // Una respuesta que ni siquiera tiene la forma esperada no tumba la ejecución (antes sí):
  // se trata como una decisión rechazada más, igual que una regla de negocio inválida, y tres
  // rechazos acumulados pausan el expediente — el mismo límite documentado para el resto de casos.
  const result = await graph.invoke({ order: createDemoOrder() }, { configurable: { thread_id: 'bad-provider' }, recursionLimit: 500 });
  assert.equal(result.order.status, 'paused');
  assert.equal(result.order.pauseReason, 'Demasiadas decisiones rechazadas');
  assert.equal(result.rejectedDecisions, 3);
  assert(result.lastError && result.lastError.length > 0);
});

test('la política OpenAI/DeepSeek separa credenciales y selecciona proveedor compatible por etapa', async () => {
  const { readFileSync } = await import('node:fs');
  const policy = JSON.parse(readFileSync(new URL('../config/models.openai-deepseek.example.json', import.meta.url), 'utf8'));
  const router = new ModelRouter(policy, { OPENAI_MODEL: 'test-openai-model', DEEPSEEK_MODEL: 'test-deepseek-model' });
  const generation = router.select({ stage: 'execute', agentId: 'content', capability: 'content.draft' });
  const review = router.select({ stage: 'review', agentId: 'review', capability: 'content.draft' });
  assert.equal(generation.profileId, 'deepseek');
  assert.equal(router.profile(generation.profileId).baseURL, 'https://api.deepseek.com');
  assert.equal(router.profile(generation.profileId).apiKeyEnv, 'DEEPSEEK_API_KEY');
  assert.equal(review.profileId, 'openai');
  assert.equal(router.profile(review.profileId).baseURL, undefined);
  assert.equal(router.profile(review.profileId).apiKeyEnv, 'OPENAI_API_KEY');
});

test('la política activa elige versiones y complejidad sin acoplarlas al puesto', () => {
  const input = JSON.parse(readFileSync(new URL('../config/models.active.json', import.meta.url), 'utf8'));
  const router = new ModelRouter(input, {
    OPENAI_MODEL: 'gpt-5.4-mini-2026-03-17', OPENAI_COMPLEX_MODEL: 'gpt-5.4-2026-03-05',
    DEEPSEEK_MODEL: 'deepseek-flash', DEEPSEEK_REASONING_MODEL: 'deepseek-v4-pro',
    OLLAMA_MODEL: 'huihui_ai/qwen3-coder-abliterated:30b', OLLAMA_API_KEY: 'ollama',
    GEMINI_MODEL: 'gemini-3.8-flash',
  });
  assert.equal(router.select({ agentId: 'content', stage: 'execute', capability: 'content.draft' }).model, 'deepseek-flash');
  assert.equal(router.select({ agentId: 'review', stage: 'review', capability: 'content.draft' }).model, 'gpt-5.4-mini-2026-03-17');
  assert.equal(router.select({ agentId: 'ceo', stage: 'coordinate', capability: 'company.strategy' }).profileId, 'complex');
  assert.equal(router.select({ agentId: 'investment-research', stage: 'execute', capability: 'finance.investment-research' }).model, 'deepseek-v4-pro');
  assert.equal(router.select({ agentId: 'development', stage: 'execute', capability: 'software.document' }).profileId, 'routine');
  assert.equal(router.select({ agentId: 'development', stage: 'execute', capability: 'software.implement' }).profileId, 'local-code');
  assert.equal(router.select({ agentId: 'review', stage: 'review', capability: 'finance.budget' }).profileId, 'complex');
  assert.equal(router.select({ agentId: 'development', stage: 'execute', capability: 'software.design' }).profileId, 'complex');
  assert.equal(router.profile('local-code').baseURL, 'http://127.0.0.1:11434/v1');
  assert.equal(router.profile('local-code').apiKeyEnv, 'OLLAMA_API_KEY');
  const profile = router.profile('routine');
  const model = createProfileModel(profile, { DEEPSEEK_API_KEY: 'test-only-placeholder' });
  assert.equal((model as any).modelKwargs.thinking.type, 'disabled');
  assert.equal(profile.structuredOutputMethod, 'jsonMode');
});
