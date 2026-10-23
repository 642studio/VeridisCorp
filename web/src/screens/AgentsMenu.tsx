import { useMemo, useState } from 'react';
import { useOrganization } from '../api/hooks';
import { ApiError } from '../api/client';
import { AgentDetailPanel } from '../components/AgentDetailPanel';

const REAL_EXECUTION_IDS = new Set(['content', 'review']);

export function AgentsMenu() {
  const query = useOrganization();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  const agents = useMemo(() => {
    if (!query.data) return [];
    const term = search.trim().toLowerCase();
    return [...query.data.agents]
      .filter((a) => !term || a.id.toLowerCase().includes(term) || a.name.toLowerCase().includes(term)
        || a.capabilities.some((c) => c.toLowerCase().includes(term)) || a.organization?.departmentId.toLowerCase().includes(term))
      .sort((a, b) => a.id.localeCompare(b.id));
  }, [query.data, search]);

  if (query.isLoading) return <p className="muted">Cargando agentes…</p>;
  if (query.error instanceof ApiError && query.error.status === 401) return <p className="error">Sesión inválida o vencida.</p>;
  if (query.error) return <p className="error">No se pudo cargar: {(query.error as Error).message}</p>;
  if (!query.data) return null;

  return (
    <div className="agents-menu">
      <input
        className="org-chart__search"
        placeholder="Buscar por id, nombre, departamento o capacidad…"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <p className="muted">{agents.length} de {query.data.agents.length} perfiles</p>
      <table className="agents-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>NOMBRE</th>
            <th>DEPARTAMENTO</th>
            <th>NIVEL</th>
            <th>CAPACIDADES</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {agents.map((agent) => (
            <tr key={agent.id} onClick={() => setSelected(agent.id)}>
              <td className="agents-table__id">{agent.id}</td>
              <td>{agent.name}</td>
              <td className="muted">{agent.organization?.departmentId ?? '—'}</td>
              <td className="muted">{agent.organization?.level ?? '—'}</td>
              <td className="muted">{agent.capabilities.slice(0, 3).join(', ')}{agent.capabilities.length > 3 ? '…' : ''}</td>
              <td>{REAL_EXECUTION_IDS.has(agent.id) && <span className="tag tag--real">EN EJECUCIÓN REAL</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <AgentDetailPanel agentId={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
