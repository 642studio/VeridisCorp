import { useAgent } from '../api/hooks';
import { ApiError } from '../api/client';

export function AgentDetailPanel({ agentId, onClose }: { agentId: string | null; onClose: () => void }) {
  const query = useAgent(agentId);
  if (!agentId) return null;

  return (
    <div className="agent-panel__overlay" onClick={onClose}>
      <div className="agent-panel" onClick={(event) => event.stopPropagation()}>
        <div className="agent-panel__header">
          <span className="panel-title">AGENT_PROFILE // {agentId}</span>
          <button type="button" className="button button--link" onClick={onClose}>[ X ]</button>
        </div>
        {query.isLoading && <p className="muted">Cargando…</p>}
        {query.error instanceof ApiError && query.error.status === 404 && <p className="error">No está en el catálogo.</p>}
        {query.error && !(query.error instanceof ApiError && query.error.status === 404) && (
          <p className="error">No se pudo cargar: {(query.error as Error).message}</p>
        )}
        {query.data && (
          <div className="agent-panel__body">
            <h2>{query.data.name}</h2>
            <p className="muted">v{query.data.version}{query.data.organization ? ` · ${query.data.organization.title}` : ''}</p>
            {query.data.organization && (
              <div className="agent-panel__meta">
                <span>DEPT: {query.data.organization.departmentId}</span>
                <span>LEVEL: {query.data.organization.level}</span>
                {query.data.organization.reportsToId && <span>REPORTS_TO: {query.data.organization.reportsToId}</span>}
              </div>
            )}

            <h3>CAPABILITIES</h3>
            <div className="tag-row">
              {query.data.capabilities.map((c) => <span key={c} className="tag">{c}</span>)}
            </div>

            <h3>ALLOWED_TOOLS</h3>
            <div className="tag-row">
              {query.data.allowedTools.length === 0 && <span className="muted">(ninguna declarada)</span>}
              {query.data.allowedTools.map((t) => <span key={t} className="tag tag--tool">{t}</span>)}
            </div>

            <h3>SYSTEM_PROMPT (instructions.md)</h3>
            <pre className="agent-panel__prompt">{query.data.instructions}</pre>

            <h3>CONTEXT (context.md)</h3>
            <pre className="agent-panel__prompt">{query.data.context}</pre>

            {query.data.knowledge.length > 0 && (
              <>
                <h3>KNOWLEDGE_REFS</h3>
                <ul className="agent-panel__knowledge">
                  {query.data.knowledge.map((k) => (
                    <li key={k.id}><strong>{k.title}</strong> <span className="muted">{k.reference}</span></li>
                  ))}
                </ul>
              </>
            )}
            <p className="muted agent-panel__footer">Solo lectura — la edición de prompts todavía no está habilitada en esta UI.</p>
          </div>
        )}
      </div>
    </div>
  );
}
