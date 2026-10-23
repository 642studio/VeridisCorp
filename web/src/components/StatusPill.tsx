import type { RunStatus } from '../api/types';

// Los tres estados que requieren decisión humana se marcan en rojo/ámbar;
// el resto es informativo. No hay un estado "bloqueado": runtime/ no lo tiene.
const STYLES: Record<RunStatus, { label: string; tone: 'neutral' | 'progress' | 'attention' | 'done' }> = {
  queued: { label: 'en cola', tone: 'neutral' },
  generating: { label: 'generando', tone: 'progress' },
  awaiting_review: { label: 'esperando revisión', tone: 'progress' },
  reviewing: { label: 'revisando', tone: 'progress' },
  awaiting_approval: { label: 'esperando aprobación', tone: 'attention' },
  approved: { label: 'aprobado', tone: 'progress' },
  dispatching: { label: 'entregando', tone: 'progress' },
  outcome_unknown: { label: 'resultado desconocido', tone: 'attention' },
  completed: { label: 'completado', tone: 'done' },
  failed: { label: 'falló', tone: 'attention' },
};

export function StatusPill({ status }: { status: RunStatus }) {
  const info = STYLES[status];
  return <span className={`status-pill status-pill--${info.tone}`}>{info.label}</span>;
}
