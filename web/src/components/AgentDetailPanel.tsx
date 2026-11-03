import { useState } from 'react';
import { useAgent, useModelPolicy, useSetAgentModelProfile, useUpdateAgentText, useUsage } from '../api/hooks';
import { ApiError } from '../api/client';
import { RichText } from './RichText';
import { microsToDisplay } from '../format';
import type { AgentTextField, ModelStage } from '../api/types';

const STAGES: { id: ModelStage; label: string }[] = [
  { id: 'coordinate', label: 'COORDINACIÓN' },
  { id: 'execute', label: 'EJECUCIÓN' },
  { id: 'review', label: 'REVISIÓN' },
];

// Selector de modelo por etapa para un solo agente. agents[agentId]?.[stage] (GET /office/settings/models)
// es el override explícito tal como está en config/models.active.json; "" en el <select> siempre
// significa "sin override, hereda el perfil de la etapa o el default" — nunca un profileId real.
function ModelProfilePicker({ agentId }: { agentId: string }) {
  const policy = useModelPolicy();
  const setProfile = useSetAgentModelProfile();
  const [pending, setPending] = useState<Partial<Record<ModelStage, string>>>({});

  if (policy.isLoading) return <p className="muted">Cargando política de modelos…</p>;
  if (policy.error) return <p className="error">No se pudo cargar la política de modelos: {(policy.error as Error).message}</p>;
  if (!policy.data) return null;
  if (!policy.data.editable) {
    return <p className="muted">Este servidor no tiene VERIDIS_MODELS_FILE configurado: el modelo de cada agente no es editable aquí.</p>;
  }

  const overrides = policy.data.agents[agentId] ?? {};
  return (
    <div className="agent-panel__models">
      {STAGES.map(({ id: stage, label }) => {
        const saved = overrides[stage] ?? '';
        const value = pending[stage] ?? saved;
        const dirty = value !== saved;
        const savingThis = setProfile.isPending && setProfile.variables?.agentId === agentId && setProfile.variables?.stage === stage;
        return (
          <div key={stage} className="agent-panel__model-row">
            <label>{label}</label>
            <select value={value} onChange={(event) => setPending((prev) => ({ ...prev, [stage]: event.target.value }))}>
              <option value="">(heredado de la etapa{policy.data.stages ? ` — ${policy.data.stages[stage]}` : ''})</option>
              {policy.data.profiles.map((p) => (
                <option key={p.profileId} value={p.profileId}>{p.profileId} · {p.provider}/{p.model}{p.configured ? '' : ' (sin credencial)'}</option>
              ))}
            </select>
            <button
              type="button" className="button button--small"
              disabled={!dirty || savingThis}
              onClick={() => setProfile.mutate({ agentId, stage, profileId: value || null }, {
                onSuccess: () => setPending((prev) => { const next = { ...prev }; delete next[stage]; return next; }),
              })}
            >
              {savingThis ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        );
      })}
      {setProfile.isError && <p className="error">{(setProfile.error as Error).message}</p>}
      <p className="muted">Aplica de inmediato, sin reiniciar el servidor — pero un expediente en curso con la política anterior no podrá reanudar silenciosamente (ver docs/model-routing.md).</p>
    </div>
  );
}

// Editor de instructions.md o context.md para un solo agente. Modo lectura por defecto (igual
// que antes); "Editar" pasa a un <textarea> con el texto actual — nada se manda al servidor hasta
// "Guardar". El límite de 16000 bytes es el mismo que valida runtime/service.ts (updateAgentText)
// y, antes que eso, agent-files.ts al cargar el catálogo al arrancar.
function EditableAgentText({ agentId, field, label, value }: { agentId: string; field: AgentTextField; label: string; value: string }) {
  const update = useUpdateAgentText();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const bytes = new TextEncoder().encode(draft).length;
  const tooLarge = bytes > 16000;

  if (!editing) {
    return (
      <>
        <pre className="agent-panel__prompt">{value}</pre>
        <button type="button" className="button button--small" onClick={() => { setDraft(value); setEditing(true); update.reset(); }}>
          Editar {label}
        </button>
      </>
    );
  }
  return (
    <div className="agent-panel__editor">
      <textarea
        className="agent-panel__textarea"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        rows={14}
      />
      <div className="agent-panel__editor-row">
        <span className={tooLarge ? 'error' : 'muted'}>{bytes.toLocaleString('es-MX')} / 16000 bytes</span>
        <button type="button" className="button button--link" onClick={() => { setEditing(false); update.reset(); }}>Cancelar</button>
        <button
          type="button" className="button button--primary button--small"
          disabled={!draft.trim() || tooLarge || draft === value || update.isPending}
          onClick={() => update.mutate({ agentId, field, text: draft }, { onSuccess: () => setEditing(false) })}
        >
          {update.isPending ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
      {update.isError && <p className="error">{(update.error as Error).message}</p>}
      <p className="muted">
        Aplica de inmediato a toda llamada siguiente de {label.toLowerCase()}, sin reiniciar el servidor — un expediente
        en curso con el texto anterior no podrá reanudar silenciosamente (ver docs/model-routing.md).
      </p>
    </div>
  );
}

// Consumo real de ESTE agente (GET /office/usage, mismo dato que la pantalla CONSUMO, agregado
// por agente ahí también) — nunca un costo estimado aparte: si no hay fila en byAgent, es que
// este agente todavía no tuvo ninguna llamada real registrada, no que cueste cero.
function AgentUsage({ agentId }: { agentId: string }) {
  const usage = useUsage();
  if (usage.isLoading) return <p className="muted">Cargando consumo…</p>;
  if (usage.error) return <p className="error">No se pudo cargar el consumo: {(usage.error as Error).message}</p>;
  if (!usage.data) return null;
  const entry = usage.data.byAgent.find((e) => e.key === agentId);
  if (!entry) return <p className="muted">Sin llamadas registradas todavía para este agente.</p>;
  return (
    <div className="agent-panel__usage">
      <span>{microsToDisplay(entry.costMicros, usage.data.currency)}</span>
      <span className="muted">{entry.pricedCalls} llamada{entry.pricedCalls === 1 ? '' : 's'} con costo conocido</span>
      {entry.unpricedCalls > 0 && <span className="badge badge--warn">+{entry.unpricedCalls} sin costo conocido</span>}
    </div>
  );
}

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

            <h3>MODELO POR ETAPA</h3>
            <ModelProfilePicker agentId={agentId} />

            <h3>CONSUMO REAL</h3>
            <AgentUsage agentId={agentId} />

            <h3>SYSTEM_PROMPT (instructions.md)</h3>
            <EditableAgentText agentId={agentId} field="instructions" label="SYSTEM_PROMPT" value={query.data.instructions} />

            <h3>CONTEXT (context.md)</h3>
            <EditableAgentText agentId={agentId} field="context" label="CONTEXT" value={query.data.context} />

            <h3>CONOCIMIENTO (knowledge/)</h3>
            {query.data.knowledge.length === 0 && <p className="muted">(sin documentos)</p>}
            {query.data.knowledge.length > 0 && (
              <>
                <p className="muted">
                  {query.data.knowledge.length} documento{query.data.knowledge.length === 1 ? '' : 's'} · {Math.round(query.data.knowledge.reduce((s, k) => s + new Blob([k.content]).size, 0) / 1024)} KB
                  que van completos en el prompt de cada llamada de este agente.
                </p>
                <ul className="agent-panel__knowledge">
                  {query.data.knowledge.map((k) => (
                    <li key={k.id}>
                      <details>
                        <summary><strong>{k.title}</strong> <span className="muted">{k.reference}</span></summary>
                        <RichText className="agent-panel__knowledge-body" text={k.content} />
                      </details>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <p className="muted agent-panel__footer">CONOCIMIENTO (knowledge/) sigue siendo de solo lectura desde aquí — solo SYSTEM_PROMPT y CONTEXT se pueden editar.</p>
          </div>
        )}
      </div>
    </div>
  );
}
