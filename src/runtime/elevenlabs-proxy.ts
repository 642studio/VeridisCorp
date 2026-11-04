import { Pool } from 'pg';
import { RuntimeError } from './contracts.js';
import { tokenHash } from './database.js';

// La API key nunca viaja al navegador: vive solo aquí, leída de VERIDIS_ELEVENLABS_API_KEY. El
// proxy solo exige una sesión válida (no un permiso de workflow específico, como voicebox): hablar
// en voz alta no es una operación de negocio sobre un recurso, es una comodidad de la UI.
async function requireSession(pool: Pool, token: string): Promise<void> {
 if (!token || token.length > 200) throw new RuntimeError(401, 'Sesión inválida');
 const result = await pool.query('SELECT 1 FROM veridis_runtime_v1.sessions WHERE token_hash=$1 AND NOT revoked AND expires_at > clock_timestamp()', [tokenHash(token)]);
 if (!result.rows[0]) throw new RuntimeError(401, 'Sesión inválida o vencida');
}

const TEXT_MAX = 2000;
const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM'; // "Rachel", voz de catálogo multilingüe de ElevenLabs
const DEFAULT_MODEL_ID = 'eleven_multilingual_v2';
// Mismo patrón que el propio voice_id de catálogo: alfanumérico simple, nunca se interpola sin
// validar (va directo en la URL del proveedor).
export const VOICE_ID_PATTERN = /^[A-Za-z0-9]{1,64}$/;

// Núcleo real, sin sesión: lo usa tanto synthesizeElevenLabs (UI, exige sesión abajo) como
// voice.generate (herramienta de office/, src/office/tools.ts) — ese caller ya pasó por
// allowedTools antes de llegar aquí, no necesita otra capa de sesión de navegador.
export async function synthesizeElevenLabsForTool(env: NodeJS.ProcessEnv, text: string, voiceIdOverride?: string | null): Promise<{ contentType: string; body: Buffer }> {
 const apiKey = env.VERIDIS_ELEVENLABS_API_KEY;
 if (!apiKey) throw new RuntimeError(503, 'ElevenLabs no configurado en el servidor');
 if (typeof text !== 'string' || !text.trim() || text.length > TEXT_MAX) throw new RuntimeError(400, 'Texto inválido');
 const voiceId = (voiceIdOverride?.trim() && VOICE_ID_PATTERN.test(voiceIdOverride.trim()) ? voiceIdOverride.trim() : null)
  || env.VERIDIS_ELEVENLABS_VOICE_ID?.trim() || DEFAULT_VOICE_ID;
 const modelId = env.VERIDIS_ELEVENLABS_MODEL_ID?.trim() || DEFAULT_MODEL_ID;
 const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', accept: 'audio/mpeg', 'xi-api-key': apiKey },
  body: JSON.stringify({ text, model_id: modelId }),
 });
 if (!response.ok) {
  // El cuerpo de error de ElevenLabs puede traer detalle útil (texto demasiado largo, voice_id
  // inválido); se recorta porque puede ser HTML/JSON largo, nunca se reenvía la API key.
  const detail = await response.text().catch(() => '');
  throw new RuntimeError(response.status === 401 ? 503 : 502, `ElevenLabs respondió ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`);
 }
 const contentType = response.headers.get('content-type') ?? 'audio/mpeg';
 const audioBody = Buffer.from(await response.arrayBuffer());
 return { contentType, body: audioBody };
}

export async function synthesizeElevenLabs(pool: Pool, token: string, text: string, voiceIdOverride?: string | null): Promise<{ contentType: string; body: Buffer }> {
 await requireSession(pool, token);
 return synthesizeElevenLabsForTool(process.env, text, voiceIdOverride);
}

export type ElevenLabsVoice = { voiceId: string; name: string; category: string | null; previewUrl: string | null };

// Catálogo de voces de la cuenta configurada (para elegir una por defecto en CONFIGURACIONES).
// Misma exigencia de sesión que synthesizeElevenLabs; nunca expone la API key al navegador.
export async function listElevenLabsVoices(pool: Pool, token: string): Promise<ElevenLabsVoice[]> {
 await requireSession(pool, token);
 const apiKey = process.env.VERIDIS_ELEVENLABS_API_KEY;
 if (!apiKey) throw new RuntimeError(503, 'ElevenLabs no configurado en el servidor');
 const response = await fetch('https://api.elevenlabs.io/v1/voices', { headers: { accept: 'application/json', 'xi-api-key': apiKey } });
 if (!response.ok) {
  const detail = await response.text().catch(() => '');
  throw new RuntimeError(response.status === 401 ? 503 : 502, `ElevenLabs respondió ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`);
 }
 const data = await response.json() as { voices?: Array<Record<string, unknown>> };
 return (data.voices ?? [])
  .filter((v) => typeof v.voice_id === 'string' && typeof v.name === 'string')
  .map((v) => ({
   voiceId: v.voice_id as string, name: v.name as string,
   category: typeof v.category === 'string' ? v.category : null,
   previewUrl: typeof v.preview_url === 'string' ? v.preview_url : null,
  }));
}
