import type { OfficeModelCall } from '../api/types';

// micros de USD (mismo entero que costMicros del motor) a un monto legible. 4 decimales: a este
// volumen de llamadas, dos decimales redondearían casi todo a $0.00.
function formatMicros(micros: number): string {
  return `$${(micros / 1_000_000).toFixed(4)}`;
}
const tokens = (n: number) => n.toLocaleString('es-MX');

export function InvolvedAgents({ modelCalls }: { modelCalls: OfficeModelCall[] }) {
  const distinctAgents = [...new Set(modelCalls.map((c) => c.agentId))].sort();
  // Nunca se trata "sin conteo" como cero: solo se suman llamadas con ambos valores reales, y se
  // dice explícitamente cuántas quedaron fuera — igual que priceTokens() nunca inventa un costo.
  const withTokens = modelCalls.filter((c) => c.inputTokens !== null && c.outputTokens !== null);
  const totalInputTokens = withTokens.reduce((sum, c) => sum + c.inputTokens!, 0);
  const totalOutputTokens = withTokens.reduce((sum, c) => sum + c.outputTokens!, 0);
  const withCost = modelCalls.filter((c) => c.costStatus === 'estimated');
  const totalCostMicros = withCost.reduce((sum, c) => sum + (c.costMicros ?? 0), 0);
  return (
    <div className="office-agents-involved">
      <p className="panel-title">AGENTES REALES INVOLUCRADOS</p>
      {distinctAgents.length === 0 && <p className="muted">Todavía ninguno.</p>}
      <div className="tag-row">
        {distinctAgents.map((agentId) => <span key={agentId} className="tag tag--real">{agentId}</span>)}
      </div>
      {modelCalls.length > 0 && (
        <div className="usage-summary">
          <span>
            <strong>{tokens(totalInputTokens)}</strong> tokens de entrada · <strong>{tokens(totalOutputTokens)}</strong> de salida
            {withTokens.length < modelCalls.length && <span className="muted"> ({modelCalls.length - withTokens.length} de {modelCalls.length} llamadas sin conteo, no incluidas)</span>}
          </span>
          <span>
            Costo estimado <strong>{formatMicros(totalCostMicros)}</strong>
            {withCost.length < modelCalls.length && <span className="muted"> ({modelCalls.length - withCost.length} de {modelCalls.length} llamadas sin precio configurado, no incluidas)</span>}
          </span>
        </div>
      )}
    </div>
  );
}
