import { AsciiAvatar } from './AsciiAvatar';
import type { AvatarState } from '../ascii/states';
import type { Scene } from '../ascii/scene';

// El "personaje" con presencia real: de fondo en la conversación, no metido en una caja de
// nav de 40px (ver MiniAvatar.tsx, que sigue siendo solo un ícono de estado). Vive detrás de
// las burbujas (.chat-thread tiene position:relative, este backdrop z-index:-1 — ver
// styles.css), así que nunca tapa el texto ni intercepta clics (pointer-events:none).
export function AvatarBackdrop({ state, scene }: { state: AvatarState; scene: Scene | null }) {
  return (
    <div className="avatar-backdrop" aria-hidden="true">
      <AsciiAvatar state={state} scene={scene} className="avatar-backdrop__canvas" />
    </div>
  );
}
