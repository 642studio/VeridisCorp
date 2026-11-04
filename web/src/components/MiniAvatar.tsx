import { AsciiAvatar } from './AsciiAvatar';
import { useActiveSession } from '../context/ActiveSessionContext';
import { useSessionsList } from '../hooks/useSessionsList';
import { TONE_TO_AVATAR_STATE } from '../officeStatus';

// El "personaje" persistente del sidebar: una sola instancia (no una por fila) que refleja el
// estado de la sesión enfocada (tono de status -> estado del avatar) y, mientras el dock de voz
// de esa sesión está en vivo, el estado real de escucha/habla que VoiceDock escribe en el
// contexto — la voz, cuando está activa, gana sobre el estado derivado del status.
export function MiniAvatar({ onActivate, className }: { onActivate: () => void; className?: string }) {
  const { focusedKind, focusedId, voiceAvatarState, voiceScene, requestDockExpand } = useActiveSession();
  const { items } = useSessionsList();
  const focused = items.find((item) => item.kind === focusedKind && item.id === focusedId);
  const baseState = focused ? TONE_TO_AVATAR_STATE[focused.tone] : 'IDLE';
  const state = voiceAvatarState ?? baseState;
  const scene = voiceAvatarState ? voiceScene : null;

  return (
    <button
      type="button"
      className={className}
      title="Abrir voz de la conversación activa"
      aria-label="Abrir voz"
      onClick={() => { onActivate(); requestDockExpand(); }}
    >
      <AsciiAvatar state={state} scene={scene} className="shell__mini-avatar-canvas" />
    </button>
  );
}
