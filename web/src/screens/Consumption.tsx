import { useUsage } from '../api/hooks';
import { ApiError } from '../api/client';
import { SessionExpired } from '../components/SessionExpired';
import { microsToDisplay } from '../format';
import type { UsageBreakdownEntry, UsageSummary } from '../api/types';

function UsageBlock({ title, entries, currency, totalCostMicros }: {
  title: string; entries: UsageBreakdownEntry[]; currency: string; totalCostMicros: number;
}) {
  return (
    <div className="usage-block">
      <p className="panel-title">{title}</p>
      {entries.length === 0 && <p className="muted">Sin llamadas registradas todavía.</p>}
      {entries.map((entry) => {
        const ratio = totalCostMicros > 0 ? Math.min(1, entry.costMicros / totalCostMicros) : 0;
        return (
          <div key={entry.key} className="usage-block__row">
            <div className="budget-gauge__row">
              <span>{entry.key}</span>
              <span>{microsToDisplay(entry.costMicros, currency)} · {entry.pricedCalls} llamada{entry.pricedCalls === 1 ? '' : 's'}</span>
            </div>
            <div className="budget-gauge__bar"><div className="budget-gauge__fill" style={{ width: `${ratio * 100}%` }} /></div>
            {entry.unpricedCalls > 0 && (
              <span className="badge badge--warn usage-block__unpriced">+{entry.unpricedCalls} sin costo conocido</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function Consumption() {
  const query = useUsage();

  if (query.isLoading) return <p className="muted">Cargando consumo…</p>;
  if (query.error instanceof ApiError && query.error.status === 401) return <SessionExpired />;
  if (query.error) return <p className="error">No se pudo cargar: {(query.error as Error).message}</p>;
  const usage = query.data as UsageSummary | undefined;
  if (!usage) return null;

  return (
    <div className="consumption">
      <p className="panel-title">CONSUMO</p>
      <p className="muted">
        Gasto acumulado de todo el ámbito (expedientes de oficina + chat ASISTENTE), agregado por agente,
        plataforma, credencial y modelo. "Sin costo conocido" cuenta llamadas sin precio configurado — nunca
        se les asume costo cero.
      </p>

      <div className="usage-summary">
        <div>
          <div className="usage-summary__value">{microsToDisplay(usage.totalCostMicros, usage.currency)}</div>
          <div className="usage-summary__label">Gasto total</div>
        </div>
        <div>
          <div className="usage-summary__value">{usage.pricedCalls}</div>
          <div className="usage-summary__label">Llamadas con costo conocido</div>
        </div>
        <div>
          <div className="usage-summary__value">{usage.unpricedCalls}</div>
          <div className="usage-summary__label">Llamadas sin costo conocido</div>
        </div>
      </div>

      <div className="usage-grid">
        <UsageBlock title="POR AGENTE" entries={usage.byAgent} currency={usage.currency} totalCostMicros={usage.totalCostMicros} />
        <UsageBlock title="POR PLATAFORMA" entries={usage.byPlatform} currency={usage.currency} totalCostMicros={usage.totalCostMicros} />
        <UsageBlock title="POR CREDENCIAL (API KEY)" entries={usage.byApiKeyEnv} currency={usage.currency} totalCostMicros={usage.totalCostMicros} />
        <UsageBlock title="POR MODELO" entries={usage.byModel} currency={usage.currency} totalCostMicros={usage.totalCostMicros} />
      </div>
    </div>
  );
}
