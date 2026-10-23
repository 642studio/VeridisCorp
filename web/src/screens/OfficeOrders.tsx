import { useMemo, useState } from 'react';
import { useOfficeOrders, useStartOfficeOrder } from '../api/hooks';
import { ApiError } from '../api/client';
import { SessionExpired } from '../components/SessionExpired';
import { useElapsedSeconds } from '../useElapsedSeconds';
import { ORDER_STATUS } from '../officeStatus';

const LIST_CAP = 50;

export function OfficeOrders({ onSelect }: { onSelect: (id: string) => void }) {
  const query = useOfficeOrders();
  const start = useStartOfficeOrder();
  const [objective, setObjective] = useState('');
  const [onlyAttention, setOnlyAttention] = useState(false);
  const startingSeconds = useElapsedSeconds(start.isPending);

  const orders = query.data?.orders ?? [];
  const visible = useMemo(
    () => (onlyAttention ? orders.filter((o) => o.status === 'paused') : orders),
    [orders, onlyAttention],
  );

  if (query.error instanceof ApiError && query.error.status === 401) return <SessionExpired />;

  return (
    <div className="office-orders">
      <div className="office-orders__start">
        <p className="panel-title">NUEVO_EXPEDIENTE</p>
        <p className="muted">
          Al iniciar, el CEO real decide de inmediato — puede encadenar varias llamadas reales de IA en un solo clic
          (tope: ver VERIDIS_OFFICE_MAX_TURNS en el servidor). No hay vuelta atrás una vez enviado.
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
          {start.isPending ? `Iniciando… (${startingSeconds}s)` : '[ INICIAR CON IA REAL ]'}
        </button>
        {start.isPending && (
          <p className="muted">Puede tardar uno o dos minutos: el CEO real coordina y despacha varias llamadas de IA seguidas antes de responder.</p>
        )}
        {start.isError && <p className="error">{(start.error as Error).message}</p>}
      </div>

      <div className="runs-list__filters" style={{ marginTop: 24 }}>
        <button type="button" className={`chip ${!onlyAttention ? 'chip--active' : ''}`} onClick={() => setOnlyAttention(false)}>Todos</button>
        <button type="button" className={`chip ${onlyAttention ? 'chip--active' : ''}`} onClick={() => setOnlyAttention(true)}>Necesitan atención</button>
      </div>
      {query.isLoading && <p className="muted">Cargando…</p>}
      {query.error && !(query.error instanceof ApiError && query.error.status === 401) && (
        <p className="error">No se pudo cargar: {(query.error as Error).message}</p>
      )}
      {!query.isLoading && visible.length === 0 && (
        <p className="muted">{onlyAttention ? 'Nada necesita atención ahora mismo.' : 'Todavía no hay expedientes de oficina.'}</p>
      )}
      <ul className="runs-list__rows">
        {visible.map((order) => {
          const status = ORDER_STATUS[order.status];
          return (
            <li key={order.id} className="runs-list__row" onClick={() => onSelect(order.id)}>
              <span className="runs-list__id" title={order.id}>{order.id.slice(0, 8)}</span>
              <span className="runs-list__brief">{order.objective}</span>
              <span className={`status-pill status-pill--${status.tone}`}>{status.label}</span>
              {order.status === 'paused' && <span className="runs-list__attention">●</span>}
              <span className="muted">{new Date(order.created_at).toLocaleString()}</span>
            </li>
          );
        })}
      </ul>
      {orders.length >= LIST_CAP && (
        <p className="muted" style={{ marginTop: 8 }}>Mostrando los {LIST_CAP} expedientes más recientes.</p>
      )}
    </div>
  );
}
