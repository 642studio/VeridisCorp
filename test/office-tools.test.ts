import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toolsFor, webSearchTool, evaluateExpression } from '../src/office/tools.js';

test('toolsFor solo expone herramientas presentes en allowedTools', () => {
  assert.deepEqual(toolsFor([]), []);
  assert.deepEqual(toolsFor(['algo.inexistente']), []);
  assert.deepEqual(toolsFor(['web.search']), [webSearchTool]);
});

test('evaluateExpression calcula con la precedencia aritmética estándar', () => {
  assert.equal(evaluateExpression('2 + 3 * 4'), 14);
  assert.equal(evaluateExpression('(2 + 3) * 4'), 20);
  assert.equal(evaluateExpression('(1200 - 850) * 1.16'), 406);
  assert.equal(evaluateExpression('2 ^ 3 ^ 2'), 512); // asociativo a la derecha: 2^(3^2)
  assert.equal(evaluateExpression('2 ^ -2'), 0.25);
  assert.equal(evaluateExpression('10 % 3'), 1);
  assert.equal(evaluateExpression('-5 + 2'), -3);
  assert.equal(evaluateExpression('3 - -2'), 5);
});

test('evaluateExpression rechaza cualquier cosa que no sea aritmética pura', () => {
  assert.throws(() => evaluateExpression('1; console.log(1)'));
  assert.throws(() => evaluateExpression('process.exit()'));
  assert.throws(() => evaluateExpression('1 / 0'), /división/i);
  assert.throws(() => evaluateExpression('1 % 0'), /módulo/i);
  assert.throws(() => evaluateExpression('(1 + 2'));
  assert.throws(() => evaluateExpression('1 +'));
  assert.throws(() => evaluateExpression(''));
});
