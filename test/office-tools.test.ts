import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toolsFor, webSearchTool } from '../src/office/tools.js';

test('toolsFor solo expone herramientas presentes en allowedTools', () => {
  assert.deepEqual(toolsFor([]), []);
  assert.deepEqual(toolsFor(['algo.inexistente']), []);
  assert.deepEqual(toolsFor(['web.search']), [webSearchTool]);
});
