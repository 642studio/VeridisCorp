import type { OfficeOrderStatus, OfficeTaskStatus } from './api/types';

export const ORDER_STATUS: Record<OfficeOrderStatus, { label: string; tone: string }> = {
  active: { label: 'en curso', tone: 'progress' },
  paused: { label: 'pausado', tone: 'attention' },
  completed: { label: 'completado', tone: 'done' },
};

export const TASK_STATUS: Record<OfficeTaskStatus, { label: string; tone: string }> = {
  pending: { label: 'pendiente', tone: 'neutral' },
  running: { label: 'en curso', tone: 'progress' },
  blocked: { label: 'bloqueada', tone: 'attention' },
  in_review: { label: 'en revisión', tone: 'progress' },
  completed: { label: 'completada', tone: 'done' },
  failed: { label: 'falló', tone: 'attention' },
};
