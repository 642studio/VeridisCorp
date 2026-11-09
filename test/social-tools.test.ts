import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toolsFor } from '../src/office/tools.js';
import { socialListChannelsTool, socialScheduleDraftTool, SOCIAL_SCHEDULE_TOOLS } from '../src/office/social-tools.js';

const VIDEO_FILE_ID = '3f1c2b4a-5d6e-4f70-8a91-b2c3d4e5f607';

function withEnv(values: Record<string, string | undefined>): () => void {
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  return () => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  };
}

test('social.schedule_post abre la lista de canales y el borrador', () => {
  assert.deepEqual(toolsFor(['social.schedule_post']), SOCIAL_SCHEDULE_TOOLS);
});

test('sin POSTIZ_URL/POSTIZ_API_KEY falla como "no configurado" sin llamar a la red', async (t) => {
  const restore = withEnv({ POSTIZ_URL: undefined, POSTIZ_API_KEY: undefined });
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => { throw new Error('no debía llamar'); });
  await assert.rejects(socialListChannelsTool.invoke({}), /Postiz no está configurado/);
  assert.equal(fetchMock.mock.callCount(), 0);
  restore();
});

test('list_social_channels manda la llave cruda y devuelve solo campos útiles', async (t) => {
  const restore = withEnv({ POSTIZ_URL: 'http://postiz.test/', POSTIZ_API_KEY: 'llave_1' });
  const calls: { url: string; init?: RequestInit }[] = [];
  t.mock.method(globalThis, 'fetch', async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify([{ id: 'ch_1', name: 'El Mismo Sazón', identifier: 'instagram', disabled: false, picture: 'x', customer: null }]));
  });
  const result = JSON.parse(await socialListChannelsTool.invoke({}) as string);
  assert.equal(calls[0]!.url, 'http://postiz.test/api/public/v1/integrations');
  assert.equal((calls[0]!.init!.headers as Record<string, string>).authorization, 'llave_1');
  assert.deepEqual(result, [{ id: 'ch_1', name: 'El Mismo Sazón', identifier: 'instagram', disabled: false }]);
  restore();
});

test('create_social_draft sube el video firmado y crea siempre un borrador, nunca schedule ni now', async (t) => {
  const restore = withEnv({
    POSTIZ_URL: 'http://postiz.test', POSTIZ_API_KEY: 'llave_1',
    VERIDIS_PUBLIC_BASE_URL: 'https://oficina.test', VERIDIS_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
  });
  const bodies: { url: string; body: Record<string, unknown> }[] = [];
  t.mock.method(globalThis, 'fetch', async (url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
    bodies.push({ url: String(url), body });
    if (String(url).endsWith('/upload-from-url')) return new Response(JSON.stringify({ id: 'm_1', path: 'http://postiz.test/uploads/v.mp4' }));
    if (String(url).endsWith('/posts')) return new Response(JSON.stringify([{ postId: 'p_1', integration: 'ch_1' }]));
    throw new Error(`fetch inesperado: ${url}`);
  });
  const result = JSON.parse(await socialScheduleDraftTool.invoke({
    channels: [{ channelId: 'ch_1' }], content: 'Nuevo platillo', proposedAt: '2026-11-10T18:00:00-06:00', videoFileId: VIDEO_FILE_ID,
  }) as string);

  assert.match(String(bodies[0]!.body.url), new RegExp(`^https://oficina\\.test/office/files/${VIDEO_FILE_ID}/signed\\?exp=\\d+&sig=`));
  const post = bodies[1]!.body;
  assert.equal(post.type, 'draft');
  assert.equal(post.date, '2026-11-11T00:00:00.000Z');
  assert.deepEqual(post.posts, [{ integration: { id: 'ch_1' }, value: [{ content: 'Nuevo platillo', image: [{ id: 'm_1', path: 'http://postiz.test/uploads/v.mp4' }] }] }]);
  assert.equal(result.status, 'draft');
  assert.deepEqual(result.drafts, [{ postId: 'p_1', channelId: 'ch_1' }]);
  restore();
});

test('create_social_draft rechaza un tipo distinto de borrador desde el esquema', async () => {
  await assert.rejects(socialScheduleDraftTool.invoke({
    channels: [{ channelId: 'ch_1' }], content: 'x', proposedAt: '2026-11-10T18:00:00Z', type: 'now',
  } as never));
});

test('create_social_draft propaga el error legible de Postiz', async (t) => {
  const restore = withEnv({ POSTIZ_URL: 'http://postiz.test', POSTIZ_API_KEY: 'llave_1' });
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ msg: 'Integration with id ch_x not found' }), { status: 400 }));
  await assert.rejects(
    socialScheduleDraftTool.invoke({ channels: [{ channelId: 'ch_x' }], content: 'x', proposedAt: '2026-11-10T18:00:00Z' }),
    /Postiz \(400\): Integration with id ch_x not found/,
  );
  restore();
});
