import { useMemo, useState } from 'react';
import { useOrganization } from '../api/hooks';
import { ApiError } from '../api/client';
import { AgentDetailPanel } from '../components/AgentDetailPanel';
import { SessionExpired } from '../components/SessionExpired';
import type { AgentSummary, Department, OrganizationResponse } from '../api/types';

// content y review además corren en el pipeline de contenido de runtime/ (src/runtime/service.ts),
// separado de oficina/. Todo el resto del catálogo solo corre vía oficina/.
const RUNTIME_PIPELINE_IDS = new Set(['content', 'review']);

function matchesSearch(agent: AgentSummary, term: string): boolean {
  const q = term.toLowerCase();
  return agent.id.toLowerCase().includes(q) || agent.name.toLowerCase().includes(q)
    || agent.capabilities.some((c) => c.toLowerCase().includes(q));
}

function groupData(data: OrganizationResponse) {
  const byParent = new Map<string | undefined, Department[]>();
  for (const dept of data.organization.departments) {
    const key = dept.parentDepartmentId;
    byParent.set(key, [...(byParent.get(key) ?? []), dept]);
  }
  const byDept = new Map<string, AgentSummary[]>();
  for (const agent of data.agents) {
    const deptId = agent.organization?.departmentId;
    if (!deptId) continue;
    byDept.set(deptId, [...(byDept.get(deptId) ?? []), agent]);
  }
  const agentsById = new Map(data.agents.map((agent) => [agent.id, agent]));
  return { byParent, byDept, agentsById };
}

export function OrgChart() {
  const query = useOrganization();
  const [search, setSearch] = useState('');
  // Ids cuyo estado por defecto (abierto en el nivel superior, cerrado más abajo) el usuario invirtió.
  const [toggledIds, setToggledIds] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string | null>(null);

  const grouped = useMemo(() => (query.data ? groupData(query.data) : null), [query.data]);

  if (query.isLoading) return <p className="muted">Cargando organigrama…</p>;
  if (query.error instanceof ApiError && query.error.status === 401) return <SessionExpired />;
  if (query.error) return <p className="error">No se pudo cargar: {(query.error as Error).message}</p>;
  if (!query.data || !grouped) return null;

  const data = query.data;
  const activeSearch = search.trim();

  function subtreeMatches(deptId: string): boolean {
    if (!activeSearch) return false;
    const own = (grouped!.byDept.get(deptId) ?? []).some((agent) => matchesSearch(agent, activeSearch));
    if (own) return true;
    return (grouped!.byParent.get(deptId) ?? []).some((child) => subtreeMatches(child.id));
  }

  function flip(id: string) {
    setToggledIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function renderDepartment(dept: Department, depth: number) {
    const forcedOpen = subtreeMatches(dept.id);
    if (activeSearch && !forcedOpen) return null;
    const defaultOpen = depth === 0;
    const open = forcedOpen || (defaultOpen !== toggledIds.has(dept.id));
    const head = grouped!.agentsById.get(dept.headAgentId);
    const members = (grouped!.byDept.get(dept.id) ?? [])
      .filter((agent) => agent.id !== dept.headAgentId)
      .sort((a, b) => a.name.localeCompare(b.name));
    const children = grouped!.byParent.get(dept.id) ?? [];

    return (
      <div key={dept.id} className="org-dept" style={{ marginLeft: depth * 20 }}>
        <button type="button" className="org-dept__toggle" onClick={() => flip(dept.id)}>
          {open ? '▾' : '▸'} {dept.name} <span className="muted">— {head?.name ?? dept.headAgentId}</span>
        </button>
        {open && (
          <div className="org-dept__body">
            <p className="muted">{dept.mission}</p>
            <ul className="org-agents">
              {head && <AgentRow agent={head} role="responsable" onSelect={setSelected} />}
              {members.map((agent) => <AgentRow key={agent.id} agent={agent} onSelect={setSelected} />)}
            </ul>
            {children.map((child) => renderDepartment(child, depth + 1))}
          </div>
        )}
      </div>
    );
  }

  const executive = grouped.agentsById.get(data.organization.executiveAgentId);
  const topLevel = grouped.byParent.get(undefined) ?? [];

  return (
    <div className="org-chart">
      {executive && (
        <p className="org-chart__executive">
          Dirección general: <strong>{executive.name}</strong> <span className="muted">({executive.id})</span>
        </p>
      )}
      <input
        className="org-chart__search"
        placeholder="Buscar por id, nombre o capacidad…"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <p className="muted">
        {data.agents.length} perfiles de catálogo · todos ejecutan con IA real vía oficina/
        · content y review además corren en el pipeline de contenido de runtime/ (marcados abajo)
      </p>
      {topLevel.map((dept) => renderDepartment(dept, 0))}
      <AgentDetailPanel agentId={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function AgentRow({ agent, role, onSelect }: { agent: AgentSummary; role?: string; onSelect: (id: string) => void }) {
  const inRuntimePipeline = RUNTIME_PIPELINE_IDS.has(agent.id);
  return (
    <li className="org-agent" onClick={() => onSelect(agent.id)}>
      <span className="org-agent__id">{agent.id}</span>
      <span>{agent.name}</span>
      {role && <span className="org-agent__role">{role}</span>}
      {inRuntimePipeline && <span className="org-agent__real" title="También corre en el pipeline de contenido de runtime/">también en runtime/</span>}
      <span className="org-agent__caps muted">{agent.capabilities.join(', ')}</span>
    </li>
  );
}
