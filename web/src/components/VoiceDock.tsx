import { useEffect, useRef, useState } from 'react';
import { AsciiAvatar } from './AsciiAvatar';
import { RichText } from './RichText';
import { useActiveSession } from '../context/ActiveSessionContext';
import type { VoiceDock as VoiceDockState } from '../hooks/useVoiceDock';
import type { SpeakProvider } from '../speak';

// UI compacta del dock de voz, montada dentro de un hilo de ASISTENTE (OfficeChat.tsx). El estado
// real vive en useVoiceDock (llamado ahí, no aquí) para que la cola de voz siga sonando aunque
// este componente se desmonte momentáneamente (p. ej. al abrir un expediente). Clic en el
// mini-avatar del sidebar (MiniAvatar.tsx) sube dockExpandRequestId, que este dock escucha para
// desplegarse solo.
export function VoiceDock({ dock }: { dock: VoiceDockState }) {
  const { dockExpandRequestId } = useActiveSession();
  const [expanded, setExpanded] = useState(false);
  // Compara contra el último id visto (no un booleano de "ya montó"): un booleano se confunde
  // con el doble montaje de efectos de StrictMode en desarrollo, que vuelve a correr este efecto
  // para el MISMO id y expandiría el dock solo con abrir la pantalla.
  const seenIdRef = useRef(dockExpandRequestId);
  useEffect(() => {
    if (dockExpandRequestId === seenIdRef.current) return;
    seenIdRef.current = dockExpandRequestId;
    setExpanded(true);
  }, [dockExpandRequestId]);

  const { stt, speak, provider, setProvider, autoListen, setAutoListen, avatarState, activeScene, caption, lastError, toggleListening } = dock;
  if (!stt.supported) return null;

  return (
    <div className={`voice-dock ${expanded ? 'voice-dock--expanded' : ''}`}>
      <div className="voice-dock__row">
        <button
          type="button"
          className={`button chat-input__mic voice-dock__mic ${stt.listening ? 'chat-input__mic--active' : ''}`}
          disabled={speak.speaking}
          title={speak.speaking ? 'Esperando a que termine de hablar, para no transcribirse a sí misma' : 'Hablar con VERIDIS'}
          onClick={toggleListening}
        >
          {speak.speaking ? '🔊' : stt.listening ? '🔴' : '🎤'}
        </button>
        <div className="voice-dock__avatar">
          <AsciiAvatar state={avatarState} scene={activeScene} className="voice-dock__canvas" />
        </div>
        <div className="voice-dock__caption">
          {caption && <RichText className="voice-dock__caption-text" text={caption} />}
        </div>
        {speak.speaking && (
          <button type="button" className="button button--link" onClick={speak.stop}>⏹</button>
        )}
        <button type="button" className="button button--link voice-dock__toggle" onClick={() => setExpanded((open) => !open)}>
          {expanded ? '▾' : '▸'}
        </button>
      </div>

      {lastError && <p className="error">{lastError}</p>}
      {speak.error && <p className="error">Voz: {speak.error}</p>}

      {expanded && (
        <div className="voice-dock__controls">
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
        </div>
      )}
    </div>
  );
}
