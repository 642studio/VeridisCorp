import { useState } from 'react';
import { useOfficeOrders, useStartOfficeOrder } from '../api/hooks';
import { ApiError } from '../api/client';
import type { OfficeOrderStatus } from '../api/types';

const STATUS_TONE: Record<OfficeOrderStatus, string> = { active: 'progress', paused: 'attention', completed: 'done' };

export function OfficeOrders({ onSelect }: { onSelect: (id: string) => void }) {
  const query = useOfficeOrders();
  const start = useStartOfficeOrder();
  const [objective, setObjective] = useState('');

  if (query.error instanceof ApiError && query.error.status === 401) return <p className="error">Sesión inválida o vencida.</p>;

  return (
    <div className="office-orders">
      <div className="office-orders__start">
        <p className="panel-title">NUEVO_EXPEDIENTE</p>
        <p className="muted">
          Al iniciar, el CEO real decide de inmediato — puede encadenar varias llamadas reales de IA en un solo clic
          (tope: {' '}{start.isPending ? '…' : 'ver VERIDIS_OFFICE_MAX_TURNS en el servidor'}). No hay vuelta atrás una vez enviado.
        </p>
        <textarea
          value={objective}
          onChange={(event) => setObjective(event.target.value)}
          rows={2}
          placeholder="Objetivo del expediente…"
        />
        <button
          type="button"
          className="button button--primary"
          disabled={start.isPending || objective.trim().length === 0}
          onClick={() => {
            const text = objective.trim();
            start.mutate(text, { onSuccess: (data) => { setObjective(''); onSelect(data.id); } });
          }}
        >
          {start.isPending ? 'Iniciando…' : '[ INICIAR CON IA REAL ]'}
        </button>
        {start.isError && <p className="error">{(start.error as Error).message}</p>}
      </div>

      <p className="panel-title" style={{ marginTop: 24 }}>EXPEDIENTES</p>
      {query.isLoading && <p className="muted">Cargando…</p>}
      {query.error && !(query.error instanceof ApiError && query.error.status === 401) && (
        <p className="error">No se pudo cargar: {(query.error as Error).message}</p>
      )}
      {query.data && query.data.orders.length === 0 && <p className="muted">Todavía no hay expedientes de oficina.</p>}
      <ul className="runs-list__rows">
        {query.data?.orders.map((order) => (
          <li key={order.id} className="runs-list__row" onClick={() => onSelect(order.id)}>
            <span className="runs-list__id" title={order.id}>{order.id.slice(0, 8)}</span>
            <span className="runs-list__brief">{order.objective}</span>
            <span className={`status-pill status-pill--${STATUS_TONE[order.status]}`}>{order.status}</span>
            <span />
            <span className="muted">{new Date(order.created_at).toLocaleString()}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
