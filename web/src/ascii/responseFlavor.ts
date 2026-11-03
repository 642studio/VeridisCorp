// Same heuristic as console-bridge/src/orchestrator/response_flavor.ts: infer whether a reply
// reads as a joke, a question thrown back, or a plain statement, so the avatar can show a
// distinct animation while it speaks.
import type { AvatarState } from './states';

export type ResponseFlavor = 'plain' | 'amused' | 'asking';

const LAUGH_PATTERN = /(?:ja){2,}|(?:je){2,}|(?:ji){2,}|(?:ha){2,}|\blol\b|[\u{1F602}\u{1F923}\u{1F606}]/iu;
const QUESTION_PATTERN = /[?¿][\s"')\]]*$/u;

export function detectResponseFlavor(replyText: string): ResponseFlavor {
  const trimmed = replyText.trim();
  if (!trimmed) return 'plain';
  if (LAUGH_PATTERN.test(trimmed)) return 'amused';
  if (QUESTION_PATTERN.test(trimmed)) return 'asking';
  return 'plain';
}

export const SPEAKING_STATE_BY_FLAVOR: Record<ResponseFlavor, AvatarState> = {
  plain: 'HAND',
  amused: 'HALFTONE',
  asking: 'FOCUS',
};

export interface VoiceInteractionSnapshot {
  hasStarted: boolean;
  listening: boolean;
  thinking: boolean;
  speaking: boolean;
  speakingFlavor: ResponseFlavor;
  errored: boolean;
}

/**
 * Same priority order as the voice agent's own state machine
 * (console-bridge/src/orchestrator/orchestrator.ts): error beats listening beats thinking
 * beats speaking beats idle.
 */
export function resolveAvatarState(snapshot: VoiceInteractionSnapshot): AvatarState {
  if (snapshot.errored) return 'ALERT';
  if (snapshot.listening) return 'FOCUS';
  if (snapshot.thinking) return 'PROCESSING';
  if (snapshot.speaking) return SPEAKING_STATE_BY_FLAVOR[snapshot.speakingFlavor];
  return snapshot.hasStarted ? 'BREATH' : 'IDLE';
}

export const STATE_LABELS: Record<AvatarState, string> = {
  IDLE: 'EN REPOSO',
  BREATH: 'EN ESPERA',
  FOCUS: 'ESCUCHANDO',
  PROCESSING: 'PENSANDO',
  ALERT: 'ERROR',
  HAND: 'HABLANDO',
  SPECTER: 'VIGILANDO',
  TUNNEL: 'INVESTIGANDO',
  HALFTONE: 'DIVERTIDO',
  BOOT: 'INICIANDO',
  TRANSITION: 'CAMBIANDO',
};
