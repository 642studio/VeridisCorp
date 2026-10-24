import type { OfficeModelCall } from '../api/types';

export function InvolvedAgents({ modelCalls }: { modelCalls: OfficeModelCall[] }) {
  const distinctAgents = [...new Set(modelCalls.map((c) => c.agentId))].sort();
  return (
    <div className="office-agents-involved">
      <p className="panel-title">AGENTES REALES INVOLUCRADOS</p>
      {distinctAgents.length === 0 && <p className="muted">Todavía ninguno.</p>}
      <div className="tag-row">
        {distinctAgents.map((agentId) => <span key={agentId} className="tag tag--real">{agentId}</span>)}
      </div>
    </div>
  );
}
