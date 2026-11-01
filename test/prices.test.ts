import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadPriceList, priceTokens, type PriceList } from '../src/office/prices.js';

function list(): PriceList {
  return {
    version: 1, currency: 'USD',
    prices: { 'openai:test-model': { inputMicrosPerMillionTokens: 1_000_000, outputMicrosPerMillionTokens: 4_000_000 } },
  };
}

test('priceTokens calcula el costo en micros a partir de los dos conteos de tokens', () => {
  const result = priceTokens(list(), 'openai', 'test-model', { inputTokens: 500_000, outputTokens: 250_000 });
  // 500000/1e6 * 1_000_000 + 250000/1e6 * 4_000_000 = 500000 + 1000000 = 1500000
  assert.deepEqual(result, { costMicros: 1_500_000, costStatus: 'estimated', currency: 'USD' });
});

test('priceTokens nunca inventa un costo: falta la lista de precios', () => {
  const result = priceTokens(null, 'openai', 'test-model', { inputTokens: 100, outputTokens: 100 });
  assert.deepEqual(result, { costMicros: null, costStatus: 'unknown', currency: 'USD' });
});

test('priceTokens nunca inventa un costo: el par provider:model no está en la lista', () => {
  const result = priceTokens(list(), 'anthropic', 'otro-modelo', { inputTokens: 100, outputTokens: 100 });
  assert.equal(result.costStatus, 'unknown');
  assert.equal(result.costMicros, null);
});

test('priceTokens nunca inventa un costo: falta un solo lado del conteo de tokens', () => {
  const soloEntrada = priceTokens(list(), 'openai', 'test-model', { inputTokens: 100, outputTokens: null });
  const soloSalida = priceTokens(list(), 'openai', 'test-model', { inputTokens: null, outputTokens: 100 });
  assert.equal(soloEntrada.costStatus, 'unknown');
  assert.equal(soloSalida.costStatus, 'unknown');
});

test('loadPriceList devuelve null sin VERIDIS_PRICES_FILE, y no toca el proceso global', () => {
  assert.equal(loadPriceList({} as NodeJS.ProcessEnv), null);
});

test('loadPriceList lee y valida un archivo real con Zod (version, currency, formato de precios)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'veridis-prices-'));
  const file = join(dir, 'prices.json');
  writeFileSync(file, JSON.stringify(list()));
  const loaded = loadPriceList({ VERIDIS_PRICES_FILE: file } as unknown as NodeJS.ProcessEnv);
  assert.deepEqual(loaded, list());
});

test('loadPriceList rechaza un archivo que no cumple el esquema (nunca un precio silenciosamente mal formado)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'veridis-prices-'));
  const file = join(dir, 'prices.json');
  writeFileSync(file, JSON.stringify({ version: 1, currency: 'USD', prices: { x: { inputMicrosPerMillionTokens: -1, outputMicrosPerMillionTokens: 0 } } }));
  assert.throws(() => loadPriceList({ VERIDIS_PRICES_FILE: file } as unknown as NodeJS.ProcessEnv));
});
