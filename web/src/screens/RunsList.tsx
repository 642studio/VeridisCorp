import { useState } from 'react';
import { useRunsList } from '../api/hooks';
import { ApiError } from '../api/client';
import { StatusPill } from '../components/StatusPill';
import type { RunStatus } from '../api/types';

const ATTENTION_FILTER: RunStatus[] = ['awaiting_approval', 'failed', 'outcome_unknown'];

export function RunsList({ onSelect }: { onSelect: (id: string) => void }) {
  const [onlyAttention, setOnlyAttention] = useState(false);
  const query = useRunsList(onlyAttention ? ATTENTION_FILTER : undefined);
  const runs = query.data?.pages.flatMap((page) => page.runs) ?? [];

  if (query.error instanceof ApiError && query.error.status === 401) {
    return <SessionExpired />;
  }

  return (
    <div className="runs-list">
      <div className="runs-list__filters">
        <button type="button" className={`chip ${!onlyAttention ? 'chip--active' : ''}`} onClick={() => setOnlyAttention(false)}>Todos</button>
        <button type="button" className={`chip ${onlyAttention ? 'chip--active' : ''}`} onClick={() => setOnlyAttention(true)}>Necesitan atención</button>
      </div>
      {query.isLoading && <p className="muted">Cargando…</p>}
      {query.error && !(query.error instanceof ApiError && query.error.status === 401) && (
        <p className="error">No se pudo cargar: {(query.error as Error).message}</p>
      )}
      {!query.isLoading && runs.length === 0 && <p className="muted">No hay expedientes en este ámbito.</p>}
      <ul className="runs-list__rows">
        {runs.map((run) => (
          <li key={run.id} className="runs-list__row" onClick={() => onSelect(run.id)}>
            <span className="runs-list__id" title={run.id}>{run.id.slice(0, 8)}</span>
            <span className="runs-list__brief">{run.brief}</span>
            <StatusPill status={run.status} />
            {run.needsAttention && <span className="runs-list__attention">●</span>}
            <span className="muted">{new Date(run.createdAt).toLocaleString()}</span>
          </li>
        ))}
      </ul>
      {query.hasNextPage && (
        <button type="button" className="button" disabled={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>
          Cargar más
        </button>
      )}
    </div>
  );
}

function SessionExpired() {
  return (
    <div className="session-expired">
      <p>La sesión no es válida o venció.</p>
      <button type="button" className="button button--primary" onClick={() => window.location.reload()}>Volver a entrar</button>
    </div>
  );
}
