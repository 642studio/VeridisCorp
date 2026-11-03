import { useEffect, useRef, useState } from 'react';
import { useAskAssistant } from '../api/hooks';
import { useSpeechToText } from '../useVoice';
import { useSpeakQueue } from '../useSpeakQueue';
import type { SpeakProvider } from '../speak';
import { RichText } from '../components/RichText';
import { AsciiAvatar } from '../components/AsciiAvatar';
import { detectResponseFlavor, resolveAvatarState, STATE_LABELS, type ResponseFlavor } from '../ascii/responseFlavor';

type Turn = { kind: 'user' | 'assistant'; text: string; objective?: string | null };

// Mainpage conversacional: micrófono nativo (ya es en vivo) para la entrada, respuesta rápida
// del asistente (ask(), 2-3 s) y la voz elegida habla frase por frase en cuanto cada una está
// lista (ver useSpeakQueue) — sin pasar por el flujo gobernado de oficina, que es para trabajo
// real, no para conversar. Comparar Voicebox/Dora vs ElevenLabs es el propósito de esta pantalla.
// Voicebox llama directo a 127.0.0.1:17493 desde el navegador (ver speak.ts): solo existe en la
// Mac donde corre el daemon, nunca en el panel servido remoto. Ahí ElevenLabs (proxy del backend)
// es la única opción que de verdad suena; evita que alguien en el celular tenga que descubrirlo
// a mano después de un "voz: load failed".
const DEFAULT_PROVIDER: SpeakProvider = ['localhost', '127.0.0.1'].includes(window.location.hostname) ? 'voicebox' : 'elevenlabs';

export function VoiceChat() {
  const [provider, setProvider] = useState<SpeakProvider>(DEFAULT_PROVIDER);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [lastError, setLastError] = useState<string | null>(null);
  const [autoListen, setAutoListen] = useState(true);
  const [showTranscript, setShowTranscript] = useState(false);
  const [speakFlavor, setSpeakFlavor] = useState<ResponseFlavor>('plain');
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
        setSpeakFlavor(detectResponseFlavor(message.answer));
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

  const avatarState = resolveAvatarState({
    hasStarted: turns.length > 0,
    listening: stt.listening,
    thinking: ask.isPending,
    speaking: speak.speaking,
    speakingFlavor: speakFlavor,
    errored: Boolean(lastError || speak.error),
  });

  const lastAssistantTurn = [...turns].reverse().find((turn) => turn.kind === 'assistant') ?? null;

  let caption: string | null = null;
  if (stt.listening) caption = stt.interimText ? `${stt.interimText}…` : 'Escuchando…';
  else if (ask.isPending) caption = 'Pensando…';
  else if (speak.speaking && lastAssistantTurn) caption = lastAssistantTurn.text;
  else if (turns.length === 0) caption = 'Toca el micrófono y habla con VERIDIS.';
  else if (lastAssistantTurn) caption = lastAssistantTurn.text;

  if (!stt.supported) {
    return <p className="error" style={{ padding: 20 }}>
      Este navegador no soporta dictado por voz (Web Speech API). Usa Chrome o Edge.
    </p>;
  }

  return (
    <div className="voice-stage">
      <div className="voice-stage__header">
        <span className={`voice-stage__state-label voice-stage__state-label--${avatarState.toLowerCase()}`}>
          {STATE_LABELS[avatarState]}
        </span>
      </div>

      <div className="voice-stage__canvas-wrap">
        <AsciiAvatar state={avatarState} className="voice-stage__canvas" />
      </div>

      <div className="voice-stage__caption">
        {caption && <RichText className="voice-stage__caption-text" text={caption} />}
      </div>

      {lastError && <p className="error voice-stage__error">{lastError}</p>}
      {speak.error && <p className="error voice-stage__error">Voz: {speak.error}</p>}

      <div className="voice-stage__mic-row">
        <button
          type="button"
          className={`button chat-input__mic voice-stage__mic ${stt.listening ? 'chat-input__mic--active' : ''}`}
          disabled={ask.isPending || speak.speaking}
          title={speak.speaking ? 'Esperando a que termine de hablar, para no transcribirse a sí misma' : undefined}
          onClick={toggleListening}
        >
          {speak.speaking ? '🔊 hablando…' : stt.listening ? '🔴 escuchando…' : '🎤 hablar'}
        </button>
        {speak.speaking && (
          <button type="button" className="button button--link" onClick={speak.stop}>⏹ detener voz</button>
        )}
      </div>

      <div className="voice-stage__controls">
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
        <button type="button" className="button button--link" onClick={() => setShowTranscript((open) => !open)}>
          {showTranscript ? 'Ocultar transcripción' : 'Ver transcripción completa'}
        </button>
      </div>

      {showTranscript && (
        <div className="voice-stage__transcript" ref={threadRef}>
          {turns.length === 0 && <p className="muted">Todavía no hay conversación.</p>}
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
        </div>
      )}
    </div>
  );
}
