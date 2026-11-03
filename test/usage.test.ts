import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeUsage, type UsageRow } from '../src/office/usage.js';

const profiles: Record<string, { provider: string; apiKeyEnv: string; baseURL?: string }> = {
  routine: { provider: 'openai', apiKeyEnv: 'DEEPSEEK_API_KEY', baseURL: 'https://api.deepseek.com' },
  review: { provider: 'openai', apiKeyEnv: 'OPENAI_API_KEY' },
  'local-general': { provider: 'openai', apiKeyEnv: 'OLLAMA_API_KEY', baseURL: 'http://127.0.0.1:11434/v1' },
};
const resolve = (profileId: string) => profiles[profileId] ?? null;

test('summarizeUsage distingue plataforma por baseURL, no por provider crudo', () => {
  const rows: UsageRow[] = [
    { agentId: 'cm', profileId: 'routine', model: 'deepseek-flash', costMicros: 100 },
    { agentId: 'devops', profileId: 'local-general', model: 'qwen3-coder', costMicros: 0 },
    { agentId: 'assistant', profileId: 'review', model: 'gpt-5.4-mini', costMicros: 200 },
  ];
  const summary = summarizeUsage(rows, 'USD', resolve);
  assert.equal(summary.totalCostMicros, 300);
  assert.equal(summary.pricedCalls, 3);
  assert.equal(summary.unpricedCalls, 0);
  const platforms = new Map(summary.byPlatform.map((e) => [e.key, e.costMicros]));
  assert.equal(platforms.get('deepseek'), 100);
  assert.equal(platforms.get('local'), 0);
  assert.equal(platforms.get('openai'), 200);
});

test('summarizeUsage agrupa por apiKeyEnv sin exponer el valor de la credencial', () => {
  const rows: UsageRow[] = [
    { agentId: 'cm', profileId: 'routine', model: 'deepseek-flash', costMicros: 10 },
    { agentId: 'campaigns', profileId: 'routine', model: 'deepseek-flash', costMicros: 20 },
  ];
  const summary = summarizeUsage(rows, 'USD', resolve);
  assert.equal(summary.byApiKeyEnv.length, 1);
  assert.equal(summary.byApiKeyEnv[0]!.key, 'DEEPSEEK_API_KEY');
  assert.equal(summary.byApiKeyEnv[0]!.costMicros, 30);
});

test('summarizeUsage cuenta aparte las llamadas sin costo conocido, sin asumir cero', () => {
  const rows: UsageRow[] = [
    { agentId: 'cm', profileId: 'routine', model: 'deepseek-flash', costMicros: 100 },
    { agentId: 'cm', profileId: 'routine', model: 'deepseek-flash', costMicros: null },
  ];
  const summary = summarizeUsage(rows, 'USD', resolve);
  assert.equal(summary.totalCostMicros, 100);
  assert.equal(summary.pricedCalls, 1);
  assert.equal(summary.unpricedCalls, 1);
  const agent = summary.byAgent.find((e) => e.key === 'cm')!;
  assert.equal(agent.pricedCalls, 1);
  assert.equal(agent.unpricedCalls, 1);
});

test('summarizeUsage no trona con un profileId que ya no existe en la configuración vigente', () => {
  const rows: UsageRow[] = [{ agentId: 'cm', profileId: 'perfil-borrado', model: 'algo', costMicros: 50 }];
  const summary = summarizeUsage(rows, 'USD', resolve);
  assert.equal(summary.totalCostMicros, 50);
  assert.equal(summary.byPlatform[0]!.key, 'perfil desconocido');
  assert.equal(summary.byApiKeyEnv[0]!.key, 'perfil desconocido');
});

test('summarizeUsage ordena cada desglose por gasto descendente', () => {
  const rows: UsageRow[] = [
    { agentId: 'low', profileId: 'review', model: 'm', costMicros: 10 },
    { agentId: 'high', profileId: 'review', model: 'm', costMicros: 90 },
  ];
  const summary = summarizeUsage(rows, 'USD', resolve);
  assert.deepEqual(summary.byAgent.map((e) => e.key), ['high', 'low']);
});
