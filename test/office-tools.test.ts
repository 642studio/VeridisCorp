import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import {
  toolsFor, webSearchTool, pdfGenerateTool, gmailDraftTool, gmailReadTool, configureGmail, evaluateExpression,
  driveUploadTool, calendarCreateEventTool, sheetsCreateTool, meetCreateSpaceTool, slidesCreateTool,
  memoryWriteTool, memoryQueryTool, configureMemory, type MemoryAccess,
} from '../src/office/tools.js';
import type { AccessScope, CorporateMemoryRecord } from '../src/governance/contracts.js';

test('toolsFor solo expone herramientas presentes en allowedTools', () => {
  assert.deepEqual(toolsFor([]), []);
  assert.deepEqual(toolsFor(['algo.inexistente']), []);
  assert.deepEqual(toolsFor(['web.search']), [webSearchTool]);
  assert.deepEqual(toolsFor(['pdf.generate']), [pdfGenerateTool]);
  assert.deepEqual(toolsFor(['email.draft', 'email.read']), [gmailDraftTool, gmailReadTool]);
  assert.deepEqual(toolsFor(['memory.write', 'memory.query']), [memoryWriteTool, memoryQueryTool]);
});

test('las herramientas de Google fallan con un mensaje claro si no se autorizó ninguna cuenta (sin red)', async () => {
  configureGmail(null);
  await assert.rejects(gmailDraftTool.invoke({ to: ['a@b.com'], subject: 'x', body: 'y' } as never), /cuenta de Google no está configurada/);
  await assert.rejects(gmailReadTool.invoke({ query: '', limit: 5 } as never), /cuenta de Google no está configurada/);
  await assert.rejects(driveUploadTool.invoke({ title: 'x', content: 'y' } as never), /cuenta de Google no está configurada/);
  await assert.rejects(calendarCreateEventTool.invoke({ summary: 'x', start: '2027-01-01T10:00:00Z', end: '2027-01-01T11:00:00Z' } as never), /cuenta de Google no está configurada/);
  await assert.rejects(sheetsCreateTool.invoke({ title: 'x' } as never), /cuenta de Google no está configurada/);
  await assert.rejects(meetCreateSpaceTool.invoke({} as never), /cuenta de Google no está configurada/);
  await assert.rejects(slidesCreateTool.invoke({ title: 'x', slides: [{ heading: 'h', bullets: ['b'] }] } as never), /cuenta de Google no está configurada/);
});

test('memory_write/memory_query fallan con un mensaje claro si no se configuró el acceso (sin Postgres)', async () => {
  configureMemory(null);
  await assert.rejects(
    memoryWriteTool.invoke({ entityType: 'project', entityId: 'x', content: 'y', sourceReference: 'z' } as never),
    /memoria corporativa no está configurada/,
  );
  await assert.rejects(memoryQueryTool.invoke({ question: 'x', limit: 5 } as never), /memoria corporativa no está configurada/);
});

test('memory_write/memory_query delegan en el acceso configurado, con el mismo scope fijo', async () => {
  const scope: AccessScope = { workspaceId: 'ws', companyId: 'co', divisionId: 'div', clientId: null, projectId: null };
  const proposeCalls: [AccessScope, Parameters<MemoryAccess['propose']>[1]][] = [];
  const queryCalls: [AccessScope, string, { limit?: number } | undefined][] = [];
  const fakeRecord: CorporateMemoryRecord = {
    schemaVersion: 1, id: 'mem-1', scope, entityType: 'project', entityId: 'veridiscorp', version: 1,
    content: 'contenido de prueba', status: 'proposed', provenance: [{ reference: 'test://1', observedAt: new Date().toISOString() }],
    updatedAt: new Date().toISOString(), validUntil: null, trust: 'internal_unverified',
  };
  const fakeAccess: MemoryAccess = {
    async propose(usedScope, input) { proposeCalls.push([usedScope, input]); return fakeRecord; },
    async query(usedScope, question, options) { queryCalls.push([usedScope, question, options]); return [{ record: fakeRecord, distance: 0 }]; },
  };
  configureMemory(fakeAccess, scope);

  const writeResult = JSON.parse(await memoryWriteTool.invoke({
    entityType: 'project', entityId: 'veridiscorp', content: 'contenido de prueba', sourceReference: 'test://1',
  } as never) as string);
  assert.equal(writeResult.status, 'proposed');
  assert.equal(proposeCalls.length, 1);
  assert.equal(proposeCalls[0]![0], scope);
  assert.equal(proposeCalls[0]![1].entityId, 'veridiscorp');
  assert.equal(proposeCalls[0]![1].provenance[0]!.reference, 'test://1');
  assert.equal(proposeCalls[0]![1].trust, 'internal_unverified');
  assert.equal(proposeCalls[0]![1].contradicts, null);

  await memoryWriteTool.invoke({
    entityType: 'project', entityId: 'veridiscorp', content: 'corrección', sourceReference: 'test://2',
    contradictsMemoryId: 'mem-vieja',
  } as never);
  assert.equal(proposeCalls[1]![1].contradicts, 'mem-vieja');

  const queryResult = JSON.parse(await memoryQueryTool.invoke({ question: '¿qué sabemos?', limit: 3 } as never) as string);
  assert.equal(queryResult[0].content, 'contenido de prueba');
  // Sin el id, un agente no puede llenar contradictsMemoryId de memory_write (bug encontrado en
  // una prueba en vivo: el agente solo veía entityId y no tenía cómo referenciar la memoria).
  assert.equal(queryResult[0].id, 'mem-1');
  assert.equal(queryCalls.length, 1);
  assert.deepEqual(queryCalls[0], [scope, '¿qué sabemos?', { limit: 3 }]);

  configureMemory(null);
});

// Igual que code.sandbox, esta prueba depende de Docker real (la misma imagen que
// docker/pdf-renderer/Dockerfile construye) — se salta sola si Docker no está disponible en vez
// de exigir una variable de entorno nueva, consistente con cómo este proyecto ya trata "Docker
// no disponible" como un modo de fallo esperado, nunca un requisito duro de CI.
function dockerAvailable(): boolean {
  try { execSync('docker info', { stdio: 'ignore', timeout: 5000 }); return true; }
  catch { return false; }
}
const hasDocker = dockerAvailable();

test('pdfGenerateTool produce un PDF real con tipografía y maquetación, a partir de bloques tipados', { skip: !hasDocker, timeout: 30000 }, async () => {
  const raw = await pdfGenerateTool.invoke({
    title: 'Reporte de prueba', subtitle: 'Suite automatizada', accentColor: 'teal',
    blocks: [
      { type: 'heading', level: '1', text: 'Sección' },
      { type: 'paragraph', text: 'Párrafo de prueba.' },
      { type: 'bullet_list', items: ['Uno', 'Dos'] },
      { type: 'callout', tone: 'info', text: 'Aviso de prueba.' },
      { type: 'table', headers: ['A', 'B'], rows: [['1', '2']] },
      { type: 'quote', text: 'Una cita.', attribution: 'Autor' },
      { type: 'divider' },
    ],
  } as never);
  const parsed = JSON.parse(raw as string) as { filename: string; contentType: string; pages: number; base64: string };
  assert.equal(parsed.filename, 'reporte-de-prueba.pdf');
  assert.equal(parsed.contentType, 'application/pdf');
  assert.equal(parsed.pages, 1);
  const bytes = Buffer.from(parsed.base64, 'base64');
  assert.equal(bytes.subarray(0, 5).toString('latin1'), '%PDF-');
});

test('pdfGenerateTool rechaza una entrada sin bloques (el modelo no puede entregar un documento vacío)', { skip: !hasDocker }, async () => {
  await assert.rejects(pdfGenerateTool.invoke({ title: 'Vacío', blocks: [] } as never));
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
