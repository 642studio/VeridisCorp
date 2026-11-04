import { useSessionsList, type SessionItem } from '../hooks/useSessionsList';
import { useActiveSession } from '../context/ActiveSessionContext';

const DOT_COLOR_VAR: Record<SessionItem['tone'], string> = {
  neutral: 'var(--muted)',
  progress: 'var(--accent)',
  attention: 'var(--warn)',
  done: 'var(--done)',
};

function SessionRow({ item, active, onClick }: { item: SessionItem; active: boolean; onClick: () => void }) {
  return (
    <li className={`session-row ${active ? 'session-row--active' : ''}`} onClick={onClick}>
      <span className="session-row__dot" style={{ color: DOT_COLOR_VAR[item.tone] }} aria-hidden="true">●</span>
      <span className="session-row__title" title={item.title}>{item.title}</span>
    </li>
  );
}

// Sidebar global de sesiones: la misma mezcla de hilos + expedientes que antes vivía solo dentro
// de OfficeChat.tsx, ahora visible y navegable desde cualquier pantalla. Un click siempre lleva a
// ASISTENTE con esa sesión enfocada — las órdenes de oficina ya se conversan ahí mismo (ver
// OfficeChat.tsx), "ver detalle técnico" es una pantalla aparte (OFICINA) para profundizar.
export function SessionList({ onOpenSession }: { onOpenSession: () => void }) {
  const { items, isLoading } = useSessionsList();
  const { focusedKind, focusedId, setFocus } = useActiveSession();

  const openSession = (item: SessionItem) => {
    if (item.id === 'new') { setFocus(null, null); } else { setFocus(item.kind, item.id); }
    onOpenSession();
  };

  return (
    <div className="shell__sessions">
      <button type="button" className="button button--primary shell__sessions-new" onClick={() => { setFocus(null, null); onOpenSession(); }}>
        + nueva conversación
      </button>
      {isLoading && <p className="muted">Cargando…</p>}
      <ul className="session-row__list">
        {items.map((item) => {
          const active = item.id === 'new' ? focusedKind === null : item.kind === focusedKind && item.id === focusedId;
          return (
            <SessionRow key={`${item.kind}:${item.id}`} item={item} active={active} onClick={() => openSession(item)} />
          );
        })}
      </ul>
    </div>
  );
}
