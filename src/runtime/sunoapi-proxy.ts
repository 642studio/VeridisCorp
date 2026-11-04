import { RuntimeError } from './contracts.js';

// La API key nunca sale de este servidor: vive solo en VERIDIS_SUNOAPI_API_KEY. A diferencia de
// elevenlabs-proxy.ts (que sirve a la pantalla de chat, por eso exige sesión de navegador), esto lo
// llama solo el motor desde una herramienta real de office/ — quien ya pasó por allowedTools no
// necesita otra capa de sesión aquí.
const API_BASE = 'https://apibox.erweima.ai/api/v1';

// sunoapi.org exige callBackUrl aunque su propia guía diga que es opcional (probado en vivo el
// 2026-11-05: sin él, la API responde 400 "Please enter callBackUrl."). No tenemos un servidor con
// URL pública alcanzable desde ellos en este entorno, así que se manda un dominio real e inerte y se
// seguimos el resultado por consulta (record-info), como la propia documentación recomienda en vez
// de depender del callback.
const PLACEHOLDER_CALLBACK_URL = 'https://example.com/veridiscorp-sunoapi-callback';

const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 4 * 60 * 1000; // una generación real tardó ~20s en la prueba del 2026-11-05;
// 4 minutos deja margen real sin dejar la llamada colgada para siempre si el proveedor se atora.

export type MusicGenerationParams = {
 prompt: string;
 style: string;
 instrumental: boolean;
 model?: 'V6' | 'V6_MINI' | 'V6_WILD';
};

export type GeneratedTrack = {
 title: string;
 tags: string;
 durationSeconds: number;
 contentType: string;
 body: Buffer;
};

function apiKey(env: NodeJS.ProcessEnv): string {
 const key = env.VERIDIS_SUNOAPI_API_KEY?.trim();
 if (!key) throw new RuntimeError(503, 'sunoapi.org no está configurado en el servidor');
 return key;
}

async function sunoFetch(env: NodeJS.ProcessEnv, path: string, init?: RequestInit): Promise<unknown> {
 const response = await fetch(`${API_BASE}${path}`, {
  ...init,
  signal: AbortSignal.timeout(20000),
  headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${apiKey(env)}` },
 });
 if (!response.ok) {
  const detail = await response.text().catch(() => '');
  throw new RuntimeError(502, `sunoapi.org respondió ${response.status}${detail ? `: ${detail.slice(0, 300)}` : ''}`);
 }
 const data = await response.json() as { code: number; msg: string; data: unknown };
 if (data.code !== 200) throw new RuntimeError(502, `sunoapi.org: ${data.msg || 'error sin detalle'}`);
 return data.data;
}

// Modo no-custom (más simple, sin letra propia): basta con un prompt y/o un style. Para una cama de
// fondo de un video — el caso de uso de video-production — esto es justo lo que hace falta; el modo
// custom (letra, título, persona de voz) no está expuesto aquí porque hoy no hay caso de uso real.
export async function generateMusic(env: NodeJS.ProcessEnv, params: MusicGenerationParams): Promise<GeneratedTrack> {
 const submitted = await sunoFetch(env, '/generate', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
   customMode: false,
   instrumental: params.instrumental,
   model: params.model ?? 'V6',
   callBackUrl: PLACEHOLDER_CALLBACK_URL,
   prompt: params.prompt.slice(0, 3000),
   style: params.style.slice(0, 1000),
  }),
 }) as { taskId?: string };
 const taskId = submitted.taskId;
 if (!taskId) throw new RuntimeError(502, 'sunoapi.org no devolvió taskId');

 const deadline = Date.now() + POLL_TIMEOUT_MS;
 for (;;) {
  const record = await sunoFetch(env, `/generate/record-info?taskId=${encodeURIComponent(taskId)}`) as {
   status: string; errorMessage?: string | null;
   response?: { sunoData?: { title: string; tags: string; duration: number; audio_url: string }[] } | null;
  };
  if (record.status === 'SUCCESS') {
   const track = record.response?.sunoData?.[0];
   if (!track) throw new RuntimeError(502, 'sunoapi.org marcó la tarea exitosa sin ninguna pista');
   const audio = await fetch(track.audio_url, { signal: AbortSignal.timeout(30000) });
   if (!audio.ok) throw new RuntimeError(502, `No se pudo descargar la pista generada (${audio.status})`);
   const body = Buffer.from(await audio.arrayBuffer());
   return {
    title: track.title, tags: track.tags, durationSeconds: track.duration,
    contentType: audio.headers.get('content-type') ?? 'audio/mpeg', body,
   };
  }
  if (record.status.includes('ERROR') || record.status.includes('FAIL')) {
   throw new RuntimeError(502, `sunoapi.org falló la generación: ${record.errorMessage || record.status}`);
  }
  if (Date.now() > deadline) throw new RuntimeError(504, 'sunoapi.org no terminó la generación a tiempo');
  await new Promise((resolve) => { setTimeout(resolve, POLL_INTERVAL_MS); });
 }
}

export async function remainingCredits(env: NodeJS.ProcessEnv): Promise<number> {
 return Number(await sunoFetch(env, '/generate/credit'));
}
