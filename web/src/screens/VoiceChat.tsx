import { useEffect, useRef, useState } from 'react';
import { useAskAssistant } from '../api/hooks';
import { useSpeechToText } from '../useVoice';
import { useSpeakQueue } from '../useSpeakQueue';
import type { SpeakProvider } from '../speak';
import { RichText } from '../components/RichText';

type Turn = { kind: 'user' | 'assistant'; text: string; objective?: string | null };

// Mainpage conversacional: micrófono nativo (ya es en vivo) para la entrada, respuesta rápida
// del asistente (ask(), 2-3 s) y la voz elegida habla frase por frase en cuanto cada una está
// lista (ver useSpeakQueue) — sin pasar por el flujo gobernado de oficina, que es para trabajo
// real, no para conversar. Comparar Voicebox/Dora vs ElevenLabs es el propósito de esta pantalla.
export function VoiceChat() {
  const [provider, setProvider] = useState<SpeakProvider>('voicebox');
  const [threadId, setThreadId] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [lastError, setLastError] = useState<string | null>(null);
  const [autoListen, setAutoListen] = useState(true);
  const threadRef = useRef<HTMLDivElement>(null);

  const stt = useSpeechToText();
  const ask = useAskAssistant();
  const speak = useSpeakQueue(provider);

  // El micrófono nunca debe estar escuchando mientras Dora suena por los parlantes: sin esto,
  // se transcribe a sí misma y la siguiente pregunta llega con la respuesta anterior metida. Por
  // eso el reinicio automático espera a que speak.speaking vuelva a false (toda la cola de frases
  // terminó de sonar), nunca un timeout fijo justo cuando llega el texto de la respuesta.
  const autoListenRef = useRef(autoListen);
  useEffect(() => { autoListenRef.current = autoListen; }, [autoListen]);
  const sendRef = useRef<(text: string) => void>(() => {});
  const wasSpeakingRef = useRef(false);
  useEffect(() => {
    if (wasSpeakingRef.current && !speak.speaking && autoListenRef.current && !stt.listening && !ask.isPending) {
      stt.start((text) => sendRef.current(text));
    }
    wasSpeakingRef.current = speak.speaking;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speak.speaking]);

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || ask.isPending) return;
    setLastError(null);
    setTurns((prev) => [...prev, { kind: 'user', text: trimmed }]);
    ask.mutate({ question: trimmed, threadId }, {
      onSuccess: (message) => {
        setThreadId(message.threadId);
        setTurns((prev) => [...prev, { kind: 'assistant', text: message.answer, objective: message.objective }]);
        speak.speak(message.answer);
        setTimeout(() => threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' }), 50);
      },
      onError: (error) => setLastError(error instanceof Error ? error.message : 'Error al preguntar'),
    });
  };
  sendRef.current = send;

  const toggleListening = () => {
    if (stt.listening) stt.stop();
    else { speak.stop(); stt.start(send); }
  };

  if (!stt.supported) {
    return <p className="error" style={{ padding: 20 }}>
      Este navegador no soporta dictado por voz (Web Speech API). Usa Chrome o Edge.
    </p>;
  }

  return (
    <div className="chat-layout">
      <div className="chat-main">
        <div className="chat-thread" ref={threadRef}>
          {turns.length === 0 && (
            <div className="chat-empty">
              <p>Toca el micrófono y habla — el asistente responde en voz.</p>
              <p className="muted">Compara el motor de voz con el selector de abajo.</p>
            </div>
          )}
          {turns.map((turn, index) => (
            <div key={index} className={`chat-bubble chat-bubble--${turn.kind}`}>
              <RichText className="chat-bubble__text" text={turn.text} />
              {turn.kind === 'assistant' && turn.objective && (
                <p className="muted" style={{ marginTop: 6, fontSize: 12 }}>
                  Esto se pasó a la oficina como encargo — revísalo en ASISTENTE.
                </p>
              )}
            </div>
          ))}
          {stt.listening && stt.interimText && (
            <div className="chat-bubble chat-bubble--user chat-bubble--thinking">
              <p className="chat-bubble__text">{stt.interimText}…</p>
            </div>
          )}
          {ask.isPending && (
            <div className="chat-bubble chat-bubble--assistant chat-bubble--thinking">
              <p className="chat-bubble__text">Pensando…</p>
            </div>
          )}
        </div>

        {lastError && <p className="error chat-error">{lastError}</p>}
        {speak.error && <p className="error chat-error">Voz: {speak.error}</p>}

        <div className="chat-voice-bar">
          <label className="chat-voice-bar__toggle">
            Motor de voz:
            <select value={provider} onChange={(event) => setProvider(event.target.value as SpeakProvider)} style={{ marginLeft: 6 }}>
              <option value="voicebox">Voicebox (Dora)</option>
              <option value="elevenlabs">ElevenLabs</option>
            </select>
          </label>
          <label className="chat-voice-bar__toggle">
            <input type="checkbox" checked={autoListen} onChange={(event) => setAutoListen(event.target.checked)} />
            seguir escuchando tras cada respuesta
          </label>
          {speak.speaking && (
            <button type="button" className="button button--link" onClick={speak.stop}>⏹ detener voz</button>
          )}
        </div>

        <div className="chat-input" style={{ justifyContent: 'center', padding: '24px 20px' }}>
          <button
            type="button"
            className={`button chat-input__mic ${stt.listening ? 'chat-input__mic--active' : ''}`}
            style={{ fontSize: 32, padding: '18px 28px' }}
            disabled={ask.isPending || speak.speaking}
            title={speak.speaking ? 'Esperando a que termine de hablar, para no transcribirse a sí misma' : undefined}
            onClick={toggleListening}
          >
            {speak.speaking ? '🔊 hablando…' : stt.listening ? '🔴 escuchando…' : '🎤 hablar'}
          </button>
        </div>
      </div>
    </div>
  );
}
