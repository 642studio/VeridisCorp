import { useMemo, useRef, useState } from 'react';
import { hierarchy, tree, type HierarchyPointNode } from 'd3-hierarchy';
import { linkRadial } from 'd3-shape';
import { useOrganization } from '../api/hooks';
import { ApiError } from '../api/client';
import { AgentDetailPanel } from '../components/AgentDetailPanel';
import { SessionExpired } from '../components/SessionExpired';
import type { AgentSummary, Department, OrganizationResponse } from '../api/types';

// Paleta categórica validada (skill dataviz, references/palette.md), pasos de modo oscuro,
// orden fijo, validada contra el fondo real de esta app (#05070a) — ver node
// scripts/validate_palette.js con --surface #05070a --mode dark: las 8 pasan todos los checks.
// Hay 9 áreas de primer nivel (docs/company-organization.md); la 9ª usa un gris neutro en vez de
// una 9ª tonalidad "generada" (la regla del skill: nunca ciclar colores categóricos). El color
// aquí es una codificación secundaria — la etiqueta de texto, siempre visible, es la primaria.
const DEPT_COLORS = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'];
const DEPT_FALLBACK_COLOR = '#8a95a0';
const ROOT_COLOR = '#35e0e0'; // --accent de la app: la empresa como conjunto, no un departamento más.

function colorFor(index: number | null): string {
  if (index === null) return ROOT_COLOR;
  return DEPT_COLORS[index] ?? DEPT_FALLBACK_COLOR;
}

type NodeKind = 'root' | 'department' | 'agent' | 'tool';
interface GraphNode {
  id: string;
  label: string;
  kind: NodeKind;
  colorIndex: number | null;
  agentId?: string;
  children?: GraphNode[];
}

function buildTree(data: OrganizationResponse): GraphNode {
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
  const agentsById = new Map(data.agents.map((a) => [a.id, a]));

  const toolNode = (toolId: string, agentId: string, colorIndex: number): GraphNode => ({
    id: `tool:${agentId}:${toolId}`, label: toolId, kind: 'tool', colorIndex,
  });
  const agentNode = (agent: AgentSummary, colorIndex: number): GraphNode => ({
    id: `agent:${agent.id}`, label: agent.name, kind: 'agent', agentId: agent.id, colorIndex,
    children: agent.allowedTools.length ? agent.allowedTools.map((t) => toolNode(t, agent.id, colorIndex)) : undefined,
  });
  const deptNode = (dept: Department, colorIndex: number): GraphNode => {
    const head = agentsById.get(dept.headAgentId);
    const members = (byDept.get(dept.id) ?? []).filter((a) => a.id !== dept.headAgentId).sort((a, b) => a.name.localeCompare(b.name));
    const children: GraphNode[] = [];
    if (head) children.push(agentNode(head, colorIndex));
    for (const member of members) children.push(agentNode(member, colorIndex));
    for (const child of byParent.get(dept.id) ?? []) children.push(deptNode(child, colorIndex));
    return { id: `dept:${dept.id}`, label: dept.name, kind: 'department', colorIndex, children: children.length ? children : undefined };
  };

  const topLevel = byParent.get(undefined) ?? [];
  return {
    id: 'root', label: 'VERIDISCORP', kind: 'root', colorIndex: null,
    children: topLevel.map((dept, index) => deptNode(dept, index)),
  };
}

const RADIUS = 620;
const VIEWBOX = RADIUS * 2 + 260;

export function OrgGraph() {
  const query = useOrganization();
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [selected, setSelected] = useState<string | null>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 0.85 });
  const drag = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);

  const treeData = useMemo(() => (query.data ? buildTree(query.data) : null), [query.data]);
  const root = useMemo(() => {
    if (!treeData) return null;
    // root y agente siempre muestran sus hijos (un agente no se colapsa, solo se abre su ficha);
    // solo un departamento necesita el clic de expandir/colapsar.
    const h = hierarchy(treeData, (d) => (d.kind === 'root' || d.kind === 'agent' || expanded.has(d.id) ? d.children : undefined));
    return tree<GraphNode>().size([2 * Math.PI, RADIUS]).separation((a, b) => (a.parent === b.parent ? 1 : 2) / Math.max(a.depth, 1))(h);
  }, [treeData, expanded]);

  if (query.isLoading) return <p className="muted">Cargando…</p>;
  if (query.error instanceof ApiError && query.error.status === 401) return <SessionExpired />;
  if (query.error) return <p className="error">No se pudo cargar: {(query.error as Error).message}</p>;
  if (!root) return null;

  const toggle = (node: GraphNode) => {
    if (!node.children && node.kind !== 'department') return;
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(node.id)) next.delete(node.id); else next.add(node.id);
      return next;
    });
  };

  const linkPath = linkRadial<unknown, HierarchyPointNode<GraphNode>>()
    .angle((d) => d.x).radius((d) => d.y);

  const onPointerDown = (event: React.PointerEvent) => {
    drag.current = { startX: event.clientX, startY: event.clientY, originX: transform.x, originY: transform.y };
    (event.target as Element).setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: React.PointerEvent) => {
    if (!drag.current) return;
    setTransform((t) => ({ ...t, x: drag.current!.originX + (event.clientX - drag.current!.startX), y: drag.current!.originY + (event.clientY - drag.current!.startY) }));
  };
  const onPointerUp = () => { drag.current = null; };
  const onWheel = (event: React.WheelEvent) => {
    const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
    setTransform((t) => ({ ...t, k: Math.min(2.5, Math.max(0.25, t.k * factor)) }));
  };

  const departments = query.data!.organization.departments.filter((d) => !d.parentDepartmentId);

  return (
    <div className="org-graph">
      <p className="muted">
        Clic en un punto de departamento (grande) para expandir o colapsar su rama. Clic en un agente abre su ficha.
        Arrastra para mover, rueda del mouse para acercar.
      </p>
      <div className="org-graph__legend">
        {departments.map((dept, index) => (
          <span key={dept.id} className="org-graph__legend-item">
            <span className="org-graph__swatch" style={{ background: colorFor(index) }} />
            {dept.name}
          </span>
        ))}
      </div>
      <svg
        className="org-graph__canvas"
        viewBox={`${-VIEWBOX / 2} ${-VIEWBOX / 2} ${VIEWBOX} ${VIEWBOX}`}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={onPointerUp}
        onWheel={onWheel}
      >
        <g transform={`translate(${transform.x} ${transform.y}) scale(${transform.k})`}>
          <g className="org-graph__links">
            {root.links().map((link, i) => (
              <path key={i} d={linkPath(link as never) ?? undefined} style={{ stroke: colorFor(link.target.data.colorIndex), opacity: link.target.data.kind === 'tool' ? 0.25 : 0.45 }} />
            ))}
          </g>
          <g className="org-graph__nodes">
            {root.descendants().map((node) => {
              const angleDeg = (node.x * 180) / Math.PI - 90;
              const flip = node.x >= Math.PI;
              const color = colorFor(node.data.colorIndex);
              const isExpandable = node.data.kind === 'department' || node.data.kind === 'root';
              const open = node.data.kind === 'root' || expanded.has(node.data.id);
              return (
                <g key={node.data.id} transform={`rotate(${angleDeg}) translate(${node.y},0)`}>
                  {node.data.kind === 'tool' ? (
                    <rect
                      x={-3} y={-3} width={6} height={6} transform="rotate(45)"
                      style={{ fill: 'var(--bg)', stroke: color }}
                    />
                  ) : (
                    <>
                      {/* Objetivo de clic ampliado e invisible: el círculo visible (r=5–9) es
                          demasiado pequeño para apuntarle con precisión, sobre todo con el grafo
                          completo alejado. */}
                      <circle
                        r={16} style={{ fill: 'transparent', cursor: isExpandable || node.data.kind === 'agent' ? 'pointer' : 'default' }}
                        onClick={() => (node.data.kind === 'agent' ? setSelected(node.data.agentId!) : toggle(node.data))}
                      />
                      <circle
                        r={node.data.kind === 'root' ? 9 : node.data.kind === 'department' ? 7 : 5}
                        style={{ fill: node.data.kind === 'agent' ? 'var(--panel-raised)' : open ? color : 'var(--bg)', stroke: color, pointerEvents: 'none' }}
                      />
                    </>
                  )}
                  <text
                    transform={`translate(${flip ? -12 : 12},0) rotate(${flip ? 180 : 0})`}
                    textAnchor={flip ? 'end' : 'start'}
                    className={`org-graph__label org-graph__label--${node.data.kind}`}
                    onClick={() => (node.data.kind === 'agent' ? setSelected(node.data.agentId!) : toggle(node.data))}
                  >
                    {node.data.label}
                  </text>
                </g>
              );
            })}
          </g>
        </g>
      </svg>
      <AgentDetailPanel agentId={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
