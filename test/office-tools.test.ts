import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import {
  toolsFor, webSearchTool, pdfGenerateTool, gmailDraftTool, gmailReadTool, configureGmail, evaluateExpression,
  driveUploadTool, calendarCreateEventTool, sheetsCreateTool, meetCreateSpaceTool, slidesCreateTool,
  memoryWriteTool, memoryQueryTool, configureMemory, type MemoryAccess,
  facebookPublishTool, instagramPublishTool, configureMeta,
} from '../src/office/tools.js';
import type { AccessScope, CorporateMemoryRecord } from '../src/governance/contracts.js';

test('toolsFor solo expone herramientas presentes en allowedTools', () => {
  assert.deepEqual(toolsFor([]), []);
  assert.deepEqual(toolsFor(['algo.inexistente']), []);
  assert.deepEqual(toolsFor(['web.search']), [webSearchTool]);
  assert.deepEqual(toolsFor(['pdf.generate']), [pdfGenerateTool]);
  assert.deepEqual(toolsFor(['email.draft', 'email.read']), [gmailDraftTool, gmailReadTool]);
  assert.deepEqual(toolsFor(['memory.write', 'memory.query']), [memoryWriteTool, memoryQueryTool]);
  assert.deepEqual(toolsFor(['social.publish_facebook', 'social.publish_instagram']), [facebookPublishTool, instagramPublishTool]);
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

test('las herramientas de Meta fallan con un mensaje claro si no se autorizó ninguna cuenta (sin red)', async () => {
  configureMeta(null);
  await assert.rejects(facebookPublishTool.invoke({ message: 'hola' } as never), /cuenta de Meta .*no está configurada/);
  await assert.rejects(instagramPublishTool.invoke({ imageUrl: 'https://example.com/a.jpg' } as never), /cuenta de Meta .*no está configurada/);
});

test('publish_facebook_post publica como texto o como foto según haya imageUrl (Graph API real simulada)', async (t) => {
  configureMeta({ pageId: 'page_1', pageAccessToken: 'token_1', igUserId: null });
  const calls: { method: string; url: string }[] = [];
  t.mock.method(globalThis, 'fetch', async (url: string, init?: RequestInit) => {
    calls.push({ method: init?.method ?? 'GET', url: String(url) });
    if (String(url).includes('/page_1/feed')) return new Response(JSON.stringify({ id: 'page_1_111' }));
    if (String(url).includes('/page_1/photos')) return new Response(JSON.stringify({ id: 'photo_1', post_id: 'page_1_222' }));
    throw new Error(`fetch inesperado en el test: ${url}`);
  });

  const textResult = JSON.parse(await facebookPublishTool.invoke({ message: 'hola mundo' } as never) as string);
  assert.equal(textResult.postId, 'page_1_111');
  assert.equal(textResult.permalink, 'https://www.facebook.com/page_1_111');
  assert.equal(calls[0]!.method, 'POST');
  assert.match(calls[0]!.url, /\/page_1\/feed$/);

  const photoResult = JSON.parse(await facebookPublishTool.invoke({ imageUrl: 'https://example.com/a.jpg', message: 'leyenda' } as never) as string);
  assert.equal(photoResult.postId, 'page_1_222');
  assert.equal(photoResult.permalink, 'https://www.facebook.com/page_1_222');

  configureMeta(null);
});

test('publish_facebook_post propaga el error real de Graph API con su código', async (t) => {
  configureMeta({ pageId: 'page_1', pageAccessToken: 'token_1', igUserId: null });
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ error: { message: 'Invalid OAuth access token.', code: 190 } }), { status: 400 }));
  await assert.rejects(facebookPublishTool.invoke({ message: 'hola' } as never), /Meta Graph API \(190\): Invalid OAuth access token\./);
  configureMeta(null);
});

test('publish_instagram_post exige una cuenta de Instagram Business vinculada', async () => {
  configureMeta({ pageId: 'page_1', pageAccessToken: 'token_1', igUserId: null });
  await assert.rejects(
    instagramPublishTool.invoke({ imageUrl: 'https://example.com/a.jpg' } as never),
    /no tiene una cuenta de Instagram Business vinculada/,
  );
  configureMeta(null);
});

test('publish_instagram_post crea el contenedor, espera a que termine y publica (Graph API real simulada)', async (t) => {
  configureMeta({ pageId: 'page_1', pageAccessToken: 'token_1', igUserId: 'ig_1' });
  const calls: string[] = [];
  t.mock.method(globalThis, 'fetch', async (url: string, init?: RequestInit) => {
    const u = String(url);
    calls.push(`${init?.method ?? 'GET'} ${u}`);
    if (u.includes('/ig_1/media') && !u.includes('media_publish')) return new Response(JSON.stringify({ id: 'container_1' }));
    if (u.includes('/container_1')) return new Response(JSON.stringify({ status_code: 'FINISHED' }));
    if (u.includes('/ig_1/media_publish')) return new Response(JSON.stringify({ id: 'media_1' }));
    if (u.includes('/media_1')) return new Response(JSON.stringify({ permalink: 'https://instagram.com/p/abc' }));
    throw new Error(`fetch inesperado en el test: ${u}`);
  });

  const result = JSON.parse(await instagramPublishTool.invoke({ imageUrl: 'https://example.com/a.jpg', caption: 'hola' } as never) as string);
  assert.equal(result.mediaId, 'media_1');
  assert.equal(result.permalink, 'https://instagram.com/p/abc');
  // Orden real exigido por el Content Publishing API: crear -> esperar -> publicar -> (opcional) leer.
  assert.equal(calls[0], 'POST https://graph.facebook.com/v26.0/ig_1/media');
  assert.match(calls[1]!, /^GET .*\/container_1\?/);
  assert.equal(calls[2], 'POST https://graph.facebook.com/v26.0/ig_1/media_publish');
  configureMeta(null);
});

test('publish_instagram_post falla con un mensaje claro si Instagram reporta ERROR en el contenedor', async (t) => {
  configureMeta({ pageId: 'page_1', pageAccessToken: 'token_1', igUserId: 'ig_1' });
  t.mock.method(globalThis, 'fetch', async (url: string) => {
    const u = String(url);
    if (u.includes('/ig_1/media')) return new Response(JSON.stringify({ id: 'container_1' }));
    if (u.includes('/container_1')) return new Response(JSON.stringify({ status_code: 'ERROR' }));
    throw new Error(`fetch inesperado en el test: ${u}`);
  });
  await assert.rejects(
    instagramPublishTool.invoke({ imageUrl: 'https://example.com/a.jpg' } as never),
    /Instagram no pudo procesar el archivo \(status ERROR\)/,
  );
  configureMeta(null);
});

test('publish_instagram_post exige exactamente uno de imageUrl/videoFileId', async () => {
  configureMeta({ pageId: 'page_1', pageAccessToken: 'token_1', igUserId: 'ig_1' });
  await assert.rejects(instagramPublishTool.invoke({} as never));
  await assert.rejects(instagramPublishTool.invoke({
    imageUrl: 'https://example.com/a.jpg', videoFileId: '11111111-1111-4111-8111-111111111111',
  } as never));
  configureMeta(null);
});

const VIDEO_FILE_ID = '11111111-1111-4111-8111-111111111111';
const TEST_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');

// videoFileId no viaja como bytes: ambas herramientas lo convierten en una URL firmada y temporal
// hacia GET /office/files/:id/signed (ver buildSignedFileUrl en tools.ts) — eso exige
// VERIDIS_PUBLIC_BASE_URL y VERIDIS_TOKEN_ENCRYPTION_KEY reales en el entorno del proceso, no un
// pool ni una sesión: por eso basta con fijarlos/borrarlos en process.env para probarlo sin red.
function withSignedUrlEnv<T>(run: () => Promise<T>): Promise<T> {
  const prevBase = process.env.VERIDIS_PUBLIC_BASE_URL;
  const prevKey = process.env.VERIDIS_TOKEN_ENCRYPTION_KEY;
  process.env.VERIDIS_PUBLIC_BASE_URL = 'https://oficina.example';
  process.env.VERIDIS_TOKEN_ENCRYPTION_KEY = TEST_ENCRYPTION_KEY;
  return run().finally(() => {
    if (prevBase === undefined) delete process.env.VERIDIS_PUBLIC_BASE_URL; else process.env.VERIDIS_PUBLIC_BASE_URL = prevBase;
    if (prevKey === undefined) delete process.env.VERIDIS_TOKEN_ENCRYPTION_KEY; else process.env.VERIDIS_TOKEN_ENCRYPTION_KEY = prevKey;
  });
}

test('publish_facebook_post con videoFileId publica un video real de feed (file_url firmado)', async (t) => {
  configureMeta({ pageId: 'page_1', pageAccessToken: 'token_1', igUserId: null });
  const calls: { url: string; body: string }[] = [];
  t.mock.method(globalThis, 'fetch', async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), body: String(init?.body ?? '') });
    if (String(url).includes('/page_1/videos')) return new Response(JSON.stringify({ id: 'video_1' }));
    throw new Error(`fetch inesperado en el test: ${url}`);
  });

  const result = await withSignedUrlEnv(async () => JSON.parse(
    await facebookPublishTool.invoke({ videoFileId: VIDEO_FILE_ID, message: 'un video real' } as never) as string,
  ));
  assert.equal(result.postId, 'video_1');
  assert.equal(result.permalink, 'https://www.facebook.com/page_1/videos/video_1');
  assert.match(calls[0]!.url, /\/page_1\/videos$/);
  const body = new URLSearchParams(calls[0]!.body);
  assert.match(body.get('file_url') ?? '', new RegExp(`^https://oficina\\.example/office/files/${VIDEO_FILE_ID}/signed\\?exp=\\d+&sig=[0-9a-f]{64}$`));
  assert.equal(body.get('description'), 'un video real');

  configureMeta(null);
});

test('publish_facebook_post con videoFileId exige VERIDIS_PUBLIC_BASE_URL configurado', async () => {
  configureMeta({ pageId: 'page_1', pageAccessToken: 'token_1', igUserId: null });
  const prevBase = process.env.VERIDIS_PUBLIC_BASE_URL;
  delete process.env.VERIDIS_PUBLIC_BASE_URL;
  await assert.rejects(
    facebookPublishTool.invoke({ videoFileId: VIDEO_FILE_ID } as never),
    /Falta VERIDIS_PUBLIC_BASE_URL/,
  );
  if (prevBase !== undefined) process.env.VERIDIS_PUBLIC_BASE_URL = prevBase;
  configureMeta(null);
});

test('publish_instagram_post con videoFileId publica un Reel real (media_type REELS, video_url firmado)', async (t) => {
  configureMeta({ pageId: 'page_1', pageAccessToken: 'token_1', igUserId: 'ig_1' });
  const calls: { url: string; body: string }[] = [];
  t.mock.method(globalThis, 'fetch', async (url: string, init?: RequestInit) => {
    const u = String(url);
    calls.push({ url: u, body: String(init?.body ?? '') });
    if (u.includes('/ig_1/media') && !u.includes('media_publish')) return new Response(JSON.stringify({ id: 'container_1' }));
    if (u.includes('/container_1')) return new Response(JSON.stringify({ status_code: 'FINISHED' }));
    if (u.includes('/ig_1/media_publish')) return new Response(JSON.stringify({ id: 'media_1' }));
    if (u.includes('/media_1')) return new Response(JSON.stringify({ permalink: 'https://instagram.com/reel/abc' }));
    throw new Error(`fetch inesperado en el test: ${u}`);
  });

  const result = await withSignedUrlEnv(async () => JSON.parse(
    await instagramPublishTool.invoke({ videoFileId: VIDEO_FILE_ID, caption: 'un reel real' } as never) as string,
  ));
  assert.equal(result.mediaId, 'media_1');
  assert.equal(result.permalink, 'https://instagram.com/reel/abc');
  const containerBody = new URLSearchParams(calls[0]!.body);
  assert.equal(containerBody.get('media_type'), 'REELS');
  assert.match(containerBody.get('video_url') ?? '', new RegExp(`^https://oficina\\.example/office/files/${VIDEO_FILE_ID}/signed\\?exp=\\d+&sig=[0-9a-f]{64}$`));
  assert.equal(containerBody.get('caption'), 'un reel real');

  configureMeta(null);
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
