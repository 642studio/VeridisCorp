import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import {
  toolsFor, webSearchTool, pdfGenerateTool, gmailDraftTool, gmailReadTool, configureGmail, evaluateExpression,
  driveUploadTool, calendarCreateEventTool, sheetsCreateTool, meetCreateSpaceTool, slidesCreateTool,
} from '../src/office/tools.js';

test('toolsFor solo expone herramientas presentes en allowedTools', () => {
  assert.deepEqual(toolsFor([]), []);
  assert.deepEqual(toolsFor(['algo.inexistente']), []);
  assert.deepEqual(toolsFor(['web.search']), [webSearchTool]);
  assert.deepEqual(toolsFor(['pdf.generate']), [pdfGenerateTool]);
  assert.deepEqual(toolsFor(['email.draft', 'email.read']), [gmailDraftTool, gmailReadTool]);
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
