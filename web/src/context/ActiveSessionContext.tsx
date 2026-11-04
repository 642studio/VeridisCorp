import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { AvatarState } from '../ascii/states';
import type { Scene } from '../ascii/scene';

export type FocusKind = 'thread' | 'order' | null;

// Estado de "qué sesión está enfocada" y el estado en vivo de la voz, compartidos entre el
// sidebar global (SessionList + MiniAvatar) y la pantalla ASISTENTE (OfficeChat + VoiceDock),
// que antes vivían como useState locales repartidos en OfficeChat.tsx. pendingAnswerIds /
// startingObjectives / pendingQuestions son el mismo estado de "pensando" que ya existía ahí —
// se mueven aquí para que el punto de color de una fila se actualice aunque esa fila no sea la
// enfocada ahora mismo.
interface ActiveSessionState {
  focusedKind: FocusKind;
  focusedId: string | null;
  pendingAnswerIds: Set<string>;
  startingObjectives: Set<string>;
  pendingQuestions: Record<string, string>;
  voiceAvatarState: AvatarState | null;
  voiceScene: Scene | null;
  dockExpandRequestId: number;
}

interface ActiveSessionApi extends ActiveSessionState {
  setFocus: (kind: FocusKind, id: string | null) => void;
  setPendingAnswerIds: (updater: (prev: Set<string>) => Set<string>) => void;
  setStartingObjectives: (updater: (prev: Set<string>) => Set<string>) => void;
  setPendingQuestions: (updater: (prev: Record<string, string>) => Record<string, string>) => void;
  setVoiceAvatar: (state: AvatarState | null, scene: Scene | null) => void;
  requestDockExpand: () => void;
}

const ActiveSessionContext = createContext<ActiveSessionApi | null>(null);

export function ActiveSessionProvider({ children }: { children: ReactNode }) {
  const [focusedKind, setFocusedKind] = useState<FocusKind>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [pendingAnswerIds, setPendingAnswerIds] = useState<Set<string>>(new Set());
  const [startingObjectives, setStartingObjectives] = useState<Set<string>>(new Set());
  const [pendingQuestions, setPendingQuestions] = useState<Record<string, string>>({});
  const [voiceAvatarState, setVoiceAvatarState] = useState<AvatarState | null>(null);
  const [voiceScene, setVoiceSceneState] = useState<Scene | null>(null);
  const [dockExpandRequestId, setDockExpandRequestId] = useState(0);

  const setFocus = useCallback((kind: FocusKind, id: string | null) => {
    setFocusedKind(kind);
    setFocusedId(id);
  }, []);

  const setVoiceAvatar = useCallback((state: AvatarState | null, scene: Scene | null) => {
    setVoiceAvatarState(state);
    setVoiceSceneState(scene);
  }, []);

  const requestDockExpand = useCallback(() => {
    setDockExpandRequestId((id) => id + 1);
  }, []);

  const value = useMemo<ActiveSessionApi>(() => ({
    focusedKind, focusedId, pendingAnswerIds, startingObjectives, pendingQuestions,
    voiceAvatarState, voiceScene, dockExpandRequestId,
    setFocus, setPendingAnswerIds, setStartingObjectives, setPendingQuestions, setVoiceAvatar, requestDockExpand,
  }), [
    focusedKind, focusedId, pendingAnswerIds, startingObjectives, pendingQuestions,
    voiceAvatarState, voiceScene, dockExpandRequestId,
    setFocus, setVoiceAvatar, requestDockExpand,
  ]);

  return <ActiveSessionContext.Provider value={value}>{children}</ActiveSessionContext.Provider>;
}

export function useActiveSession(): ActiveSessionApi {
  const ctx = useContext(ActiveSessionContext);
  if (!ctx) throw new Error('useActiveSession debe usarse dentro de <ActiveSessionProvider>');
  return ctx;
}
