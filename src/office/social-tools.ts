import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { clip } from './repo-tools.js';
import { buildSignedFileUrl } from './signed-file-url.js';

// Postiz autoalojado (deploy/postiz, AGPL): se usa solo como servicio por su API pública HTTP,
// nunca importando su código ni su SDK. Los agentes solo crean BORRADORES; una persona los revisa
// y los programa desde la interfaz de Postiz. Ninguna herramienta de aquí publica ni programa.
// POSTIZ_URL apunta a la raíz pública de Postiz (p. ej. http://127.0.0.1:4007); la API vive en
// /api/public/v1 y se autentica con la llave cruda en Authorization (sin "Bearer").

type PostizError = { msg?: string; message?: string | string[] };

async function callPostiz<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const base = process.env.POSTIZ_URL?.trim();
  const key = process.env.POSTIZ_API_KEY?.trim();
  if (!base || !key) throw new Error('Postiz no está configurado (POSTIZ_URL/POSTIZ_API_KEY)');
  const response = await fetch(`${base.replace(/\/$/, '')}/api/public/v1${path}`, {
    method, redirect: 'error', signal: AbortSignal.timeout(60000),
    headers: { authorization: key, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (!response.ok) {
    const error = (data ?? {}) as PostizError;
    const detail = error.msg ?? (Array.isArray(error.message) ? error.message.join('; ') : error.message) ?? text.slice(0, 300);
    throw new Error(`Postiz (${response.status}): ${detail || 'operación rechazada'}`);
  }
  return data as T;
}

type PostizChannel = { id: string; name: string; identifier: string; disabled: boolean; profile?: string };
type PostizMedia = { id: string; path: string };

export const socialListChannelsTool = tool(
  async () => {
    const channels = await callPostiz<PostizChannel[]>('GET', '/integrations');
    return clip(JSON.stringify(channels.map(({ id, name, identifier, disabled, profile }) => ({ id, name, identifier, disabled, profile }))));
  },
  {
    name: 'list_social_channels',
    description: 'Lista los canales de redes conectados en Postiz (id, nombre, red y si está desactivado). '
      + 'Úsalo antes de crear un borrador para tener los id exactos. Solo lectura.',
    schema: z.object({}).strict(),
  },
);

const scheduleDraftSchema = z.object({
  channels: z.array(z.object({
    channelId: z.string().trim().min(1).max(100).describe('El "id" exacto que devolvió list_social_channels'),
    settings: z.record(z.string(), z.unknown()).optional()
      .describe('Ajustes propios de la red, si los pide (p. ej. título en YouTube). Postiz los valida al guardar.'),
  }).strict()).min(1).max(10),
  content: z.string().trim().min(1).max(5000).describe('Texto de la publicación, tal como se propone a Adrián'),
  proposedAt: z.iso.datetime({ offset: true }).describe('Fecha y hora propuestas (ISO 8601 con zona). Es solo una propuesta: una persona la confirma en Postiz.'),
  videoFileId: z.uuid().optional().describe('El "fileId" exacto que devolvió render_video, para adjuntar ese video'),
  imageUrls: z.array(z.url()).max(10).optional().describe('URLs públicas de imágenes ya alojadas (JPEG/PNG)'),
}).strict();

// Postiz baja cada archivo por su cuenta (upload-from-url) y devuelve su propia ruta; el borrador
// debe apuntar a esa copia, no a la URL original, que en el caso del video expira en 15 minutos.
async function uploadMedia(url: string): Promise<PostizMedia> {
  const media = await callPostiz<PostizMedia>('POST', '/upload-from-url', { url });
  if (!media?.id || !media?.path) throw new Error('Postiz no devolvió el archivo subido');
  return { id: media.id, path: media.path };
}

export const socialScheduleDraftTool = tool(
  async ({ channels, content, proposedAt, videoFileId, imageUrls }: z.infer<typeof scheduleDraftSchema>) => {
    const sources = [...(videoFileId ? [buildSignedFileUrl(videoFileId)] : []), ...(imageUrls ?? [])];
    const image: PostizMedia[] = [];
    for (const url of sources) image.push(await uploadMedia(url));
    const created = await callPostiz<{ postId?: string; integration?: string }[]>('POST', '/posts', {
      type: 'draft', shortLink: false, date: new Date(proposedAt).toISOString(), tags: [],
      posts: channels.map(({ channelId, settings }) => ({
        integration: { id: channelId }, value: [{ content, image }], ...(settings ? { settings } : {}),
      })),
    });
    return JSON.stringify({
      status: 'draft',
      drafts: (created ?? []).map((post) => ({ postId: post.postId ?? null, channelId: post.integration ?? null })),
      media: image.length,
      next: 'Borrador creado en Postiz. Una persona debe revisarlo y programarlo desde Postiz; nada se publicó.',
    });
  },
  {
    name: 'create_social_draft',
    description: 'Crea un BORRADOR de publicación en Postiz para uno o varios canales conectados, con texto y, '
      + 'opcionalmente, el video de render_video o imágenes públicas. No publica ni programa: Adrián lo '
      + 'revisa y lo programa en Postiz. Devuelve los id de los borradores.',
    schema: scheduleDraftSchema,
  },
);

export const SOCIAL_SCHEDULE_TOOLS = [socialListChannelsTool, socialScheduleDraftTool];
