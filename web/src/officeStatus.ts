import type { OfficeOrderStatus, OfficeTaskStatus } from './api/types';
import type { AvatarState } from './ascii/states';

// Mismo set de tonos que .status-pill--* en styles.css — ahora también el vocabulario de color
// para los puntos de sesión del sidebar global (ver hooks/useSessionsList.ts).
export type SessionTone = 'neutral' | 'progress' | 'attention' | 'done';

export const ORDER_STATUS: Record<OfficeOrderStatus, { label: string; tone: SessionTone }> = {
  active: { label: 'en curso', tone: 'progress' },
  paused: { label: 'pausado', tone: 'attention' },
  completed: { label: 'completado', tone: 'done' },
};

export const TASK_STATUS: Record<OfficeTaskStatus, { label: string; tone: SessionTone }> = {
  pending: { label: 'pendiente', tone: 'neutral' },
  running: { label: 'en curso', tone: 'progress' },
  blocked: { label: 'bloqueada', tone: 'attention' },
  in_review: { label: 'en revisión', tone: 'progress' },
  completed: { label: 'completada', tone: 'done' },
  failed: { label: 'falló', tone: 'attention' },
  cancelled: { label: 'cancelada', tone: 'neutral' },
};

// El mini-avatar del sidebar (App.tsx) toma el tono de la sesión enfocada y lo traduce a una de
// las 11 personalidades de ascii/states.ts — mismo vocabulario de color que status-pill/el punto
// de SessionRow, para que el avatar y el punto de la fila nunca se contradigan.
export const TONE_TO_AVATAR_STATE: Record<SessionTone, AvatarState> = {
  progress: 'PROCESSING',
  attention: 'ALERT',
  done: 'BREATH',
  neutral: 'IDLE',
};
