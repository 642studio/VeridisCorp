import { getToken } from './api/client';

export type SpeakProvider = 'voicebox' | 'elevenlabs';

const VOICEBOX_BASE = import.meta.env.VITE_VOICEBOX_API_BASE ?? 'http://127.0.0.1:17493';
const VOICEBOX_PROFILE = import.meta.env.VITE_VOICEBOX_PROFILE ?? 'Dora';

// Separa en frases conservando el orden, para sintetizar y reproducir cada una en cuanto esté
// lista en vez de esperar el texto completo. Frases muy cortas ("Sí.", "Claro.") se fusionan con
// la siguiente para no mandar fragmentos triviales a síntesis.
export function splitSentences(text: string): string[] {
  const raw = text.replace(/\s+/g, ' ').trim();
  if (!raw) return [];
  const parts = raw.split(/(?<=[.!?…:])\s+(?=[A-ZÁÉÍÓÚÑ¿¡0-9])/);
  const merged: string[] = [];
  for (const part of parts) {
    const prev = merged[merged.length - 1];
    if (prev && prev.length < 12) merged[merged.length - 1] = `${prev} ${part}`;
    else merged.push(part);
  }
  return merged;
}

async function synthesizeVoicebox(text: string, signal: AbortSignal): Promise<Blob> {
  const started = await fetch(`${VOICEBOX_BASE}/speak`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text, profile: VOICEBOX_PROFILE, language: 'es' }),
    signal,
  });
  if (!started.ok) throw new Error(`Voicebox /speak respondió ${started.status}`);
  const { id } = (await started.json()) as { id: string };
  for (;;) {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    const status = await fetch(`${VOICEBOX_BASE}/history/${id}`, { signal });
    const info = (await status.json()) as { status: string; error?: string | null };
    if (info.status === 'completed') break;
    if (info.status === 'failed' || info.error) throw new Error(info.error ?? 'Voicebox: la generación falló');
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  const audio = await fetch(`${VOICEBOX_BASE}/audio/${id}`, { signal });
  if (!audio.ok) throw new Error(`Voicebox /audio respondió ${audio.status}`);
  return audio.blob();
}

// El API key de ElevenLabs nunca llega al navegador: este endpoint vive en el runtime de
// VeridisCorp (proxy), igual patrón de auth que el resto de /api (token Bearer de sessionStorage).
async function synthesizeElevenLabs(text: string, signal: AbortSignal): Promise<Blob> {
  const token = getToken();
  const response = await fetch('/api/tts/elevenlabs', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ text }),
    signal,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error ?? `ElevenLabs respondió ${response.status}`);
  }
  return response.blob();
}

export function synthesize(provider: SpeakProvider, text: string, signal: AbortSignal): Promise<Blob> {
  return provider === 'elevenlabs' ? synthesizeElevenLabs(text, signal) : synthesizeVoicebox(text, signal);
}
