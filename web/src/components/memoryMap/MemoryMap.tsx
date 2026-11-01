import { useEffect, useMemo, useRef, useState } from 'react';
import type { MemoryGraph, MemoryGraphNode, MemoryKind } from '../../api/types';
import {
  CAMERA_DISTANCE, KINDS, LINK_FLOOR, QUARANTINE_COLOR, SURFACE, VARIANTS, facing, hash, hexAlpha, layout, neuronSprite, rotate,
  type NeuronMode,
} from './engine';

const DAY = 24 * 60 * 60 * 1000;
// "En uso": la memoria salió en una consulta de algún agente en los últimos 7 días. Es lo que hace
// que una neurona brille y palpite: solo se enciende lo que de verdad viaja.
const LIT_WINDOW = 7 * DAY;

const kindOf = (node: MemoryGraphNode): MemoryKind => node.record.kind ?? 'fact';
const modeOf = (node: MemoryGraphNode): NeuronMode =>
  node.record.status === 'quarantined' ? 'quarantined' : node.record.status === 'validated' ? 'confirmed' : 'unconfirmed';

function ago(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (minutes < 1) return 'hace un momento';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.round(hours / 24)} d`;
}

// "expediente://<uuid> (archivista)" -> "Expediente 1a2b3c4d · archivista": legible, el id corto basta para buscarlo.
function origin(reference: string): string {
  const match = /^expediente:\/\/([0-9a-f-]{8})[0-9a-f-]*(?:\s*\((.+)\))?/.exec(reference);
  return match ? `Expediente ${match[1]}${match[2] ? ` · ${match[2]}` : ''}` : reference;
}

const TRUST: Record<string, string> = {
  external_untrusted: 'externa sin verificar', internal_unverified: 'interna sin verificar', verified: 'verificada',
};

interface Projected { id: string; x: number; y: number; z: number; size: number }

export function MemoryMap({ graph, onConfirm, onQuarantine, busyId, actionError }: {
  graph: MemoryGraph;
  onConfirm: (id: string) => void;
  onQuarantine: (id: string, reason: string) => void;
  busyId: string | null;
  actionError: string | null;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [quarantining, setQuarantining] = useState(false);

  const nodesById = useMemo(() => new Map(graph.nodes.map((n) => [n.record.id, n])), [graph]);
  // La disposición solo cambia si cambian las memorias o sus enlaces, no por una confirmación.
  const layoutKey = useMemo(() => graph.nodes.map((n) => n.record.id).sort().join('|') + '#' + graph.links.length, [graph]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const positions = useMemo(() => layout(graph), [layoutKey]);
  const linksOf = useMemo(() => {
    const map = new Map<string, MemoryGraph['links']>();
    for (const link of graph.links) {
      for (const end of [link.source, link.target]) map.set(end, [...(map.get(end) ?? []), link]);
    }
    return map;
  }, [graph]);

  // Estado de cámara y de cuadro fuera de React: cambia 60 veces por segundo.
  const view = useRef({ yaw: 0.6, pitch: -0.25, zoom: 1, panX: 0, panY: 0, shift: 0, tween: null as null | { from: { yaw: number; pitch: number }; to: { yaw: number; pitch: number }; start: number } });
  const projected = useRef<Projected[]>([]);
  const dragging = useRef(false);
  // Con el puntero encima el mapa se queda quieto: apuntar a una neurona que se mueve es imposible.
  const hovering = useRef(false);
  const pointer = useRef<{ x: number; y: number; moved: boolean; pan: boolean } | null>(null);
  const live = useRef({ graph, positions, nodesById, linksOf, selectedId, hoverId });
  live.current = { graph, positions, nodesById, linksOf, selectedId, hoverId };
  const sprites = useRef(new Map<string, HTMLCanvasElement>());
  const stars = useMemo(() => Array.from({ length: 160 }, (_, i) => {
    const h = hash(`star-${i}`);
    return { x: (h % 10000) / 10000, y: ((h >>> 8) % 10000) / 10000, a: 0.08 + ((h >>> 16) % 100) / 400 };
  }), []);
  const reducedMotion = useMemo(() => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches, []);

  const sprite = (kind: MemoryKind, mode: NeuronMode, variant: number) => {
    const key = `${kind}|${mode}|${variant}`;
    let canvas = sprites.current.get(key);
    if (!canvas) { canvas = neuronSprite(kind, mode, variant); sprites.current.set(key, canvas); }
    return canvas;
  };

  const focus = (id: string) => {
    const p = live.current.positions.get(id);
    if (!p) return;
    const to = facing(p);
    const v = view.current;
    // Por el camino corto: nunca dar la vuelta completa para llegar a un ángulo vecino.
    let yaw = to.yaw;
    while (yaw - v.yaw > Math.PI) yaw -= Math.PI * 2;
    while (yaw - v.yaw < -Math.PI) yaw += Math.PI * 2;
    if (reducedMotion) { v.yaw = yaw; v.pitch = to.pitch; return; }
    v.tween = { from: { yaw: v.yaw, pitch: v.pitch }, to: { yaw, pitch: to.pitch }, start: performance.now() };
  };
  const select = (id: string | null) => {
    setSelectedId(id); setQuarantining(false); setReason('');
    if (id) focus(id);
  };

  useEffect(() => {
    const canvas = canvasRef.current!; const wrap = wrapRef.current!;
    const g = canvas.getContext('2d')!;
    let frame = 0;
    let width = 0; let height = 0; let dpr = 1;
    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      width = wrap.clientWidth; height = wrap.clientHeight;
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`; canvas.style.height = `${height}px`;
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(wrap);

    const draw = (time: number) => {
      const { graph: gr, positions: pos, nodesById: byId, linksOf: lof, selectedId: sel, hoverId: hov } = live.current;
      const v = view.current;
      if (v.tween) {
        const t = Math.min(1, (time - v.tween.start) / 700);
        const e = 1 - Math.pow(1 - t, 3);
        v.yaw = v.tween.from.yaw + (v.tween.to.yaw - v.tween.from.yaw) * e;
        v.pitch = v.tween.from.pitch + (v.tween.to.pitch - v.tween.from.pitch) * e;
        if (t >= 1) v.tween = null;
      } else if (!sel && !dragging.current && !hovering.current && !reducedMotion) {
        v.yaw += 0.0012;
      }
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.globalCompositeOperation = 'source-over';
      const bg = g.createRadialGradient(width * 0.55, height * 0.45, 0, width * 0.55, height * 0.45, Math.max(width, height) * 0.75);
      bg.addColorStop(0, '#0f1a2e'); bg.addColorStop(1, SURFACE);
      g.fillStyle = bg; g.fillRect(0, 0, width, height);
      for (const s of stars) { g.fillStyle = `rgba(190,210,255,${s.a})`; g.fillRect(s.x * width, s.y * height, 1, 1); }

      // Con el panel abierto (a la derecha) el centro útil del mapa se corre a la izquierda.
      const shiftTarget = sel ? -Math.min(200, Math.max(0, width - 420) / 2) : 0;
      v.shift = Number.isFinite(v.shift) ? v.shift + (shiftTarget - v.shift) * (reducedMotion ? 1 : 0.12) : shiftTarget;
      const cx = width / 2 + v.panX + v.shift; const cy = height / 2 + v.panY;
      const R = Math.min(width, height) * 0.34 * v.zoom;
      const sizeFactor = Math.max(0.5, Math.min(1.7, Math.sqrt(70 / Math.max(1, gr.nodes.length))));
      const points = new Map<string, Projected>();
      for (const node of gr.nodes) {
        const base = pos.get(node.record.id); if (!base) continue;
        const r = rotate(base, v.yaw, v.pitch);
        const f = CAMERA_DISTANCE / (CAMERA_DISTANCE - r.z);
        const grow = 1 + Math.min(node.recalls, 25) * 0.025;
        points.set(node.record.id, { id: node.record.id, x: cx + r.x * R * f, y: cy - r.y * R * f, z: r.z, size: R * 0.3 * f * sizeFactor * grow });
      }
      const depth = (z: number) => 0.3 + 0.7 * ((z + 1.25) / 2.5);
      const neighbours = new Set<string>();
      if (sel) for (const link of lof.get(sel) ?? []) { neighbours.add(link.source); neighbours.add(link.target); }

      // Enlaces: brillo aditivo, más tenues al fondo; con una memoria seleccionada, solo los suyos.
      g.globalCompositeOperation = 'lighter';
      for (const link of gr.links) {
        const a = points.get(link.source); const b = points.get(link.target); if (!a || !b) continue;
        const own = sel !== null && (link.source === sel || link.target === sel);
        if (sel && !own) { g.strokeStyle = 'rgba(140,170,220,0.025)'; g.lineWidth = 0.6; }
        else if (link.kind === 'contradicts') { g.strokeStyle = hexAlpha('#e8e8e2', own ? 0.7 : 0.25); g.lineWidth = own ? 1.4 : 0.8; }
        else {
          const source = byId.get(link.source)!;
          const color = source.record.status === 'quarantined' ? QUARANTINE_COLOR : KINDS[kindOf(source)].color;
          const strength = 0.12 + Math.max(0, ((link.similarity ?? LINK_FLOOR) - LINK_FLOOR) / (1 - LINK_FLOOR)) * 0.5;
          g.strokeStyle = hexAlpha(color, own ? 0.75 : strength * Math.min(depth(a.z), depth(b.z)));
          g.lineWidth = own ? 1.6 : 0.8;
        }
        g.setLineDash(link.kind === 'contradicts' ? [4, 4] : []);
        g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
        // Lo que viaja por un enlace de la memoria seleccionada: un punto que lo recorre.
        if (own && !reducedMotion) {
          const t = ((time / 1600) + (hash(link.source + link.target) % 100) / 100) % 1;
          g.fillStyle = 'rgba(255,255,255,0.85)';
          g.beginPath(); g.arc(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, 1.8, 0, Math.PI * 2); g.fill();
        }
      }
      g.setLineDash([]);

      const ordered = [...points.values()].sort((p, q) => p.z - q.z);
      for (const p of ordered) {
        const node = byId.get(p.id)!;
        const mode = modeOf(node);
        const lit = node.lastRecalledAt !== null && Date.now() - Date.parse(node.lastRecalledAt) < LIT_WINDOW && mode !== 'quarantined';
        const pulse = lit && !reducedMotion ? 1 + 0.07 * Math.sin(time / 420 + (hash(p.id) % 628) / 100) : 1;
        const dim = sel && p.id !== sel && !neighbours.has(p.id) ? 0.18 : 1;
        g.globalAlpha = Math.min(1, depth(p.z) * dim * (mode === 'quarantined' ? 0.85 : 1));
        const size = p.size * pulse;
        if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(size) || size <= 0) continue;
        if (lit) {
          const halo = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, size * 0.7);
          halo.addColorStop(0, hexAlpha(KINDS[kindOf(node)].color, 0.35)); halo.addColorStop(1, hexAlpha(KINDS[kindOf(node)].color, 0));
          g.fillStyle = halo; g.beginPath(); g.arc(p.x, p.y, size * 0.7, 0, Math.PI * 2); g.fill();
        }
        g.drawImage(sprite(kindOf(node), mode, hash(p.id) % VARIANTS), p.x - size / 2, p.y - size / 2, size, size);
      }
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';

      // Retícula de la memoria seleccionada y etiqueta de la que está bajo el puntero.
      const label = (p: Projected, text: string, accent: boolean) => {
        g.font = '11px "JetBrains Mono", ui-monospace, monospace';
        const w = g.measureText(text).width + 12;
        // El panel (abierto a la derecha) tapa ese borde: si la etiqueta no cabe a la derecha del
        // punto, va a su izquierda.
        const right = width - (sel ? Math.min(360, width - 24) + 24 : 0) - 8;
        const x = p.x + 14 + w <= right ? p.x + 14 : Math.max(8, p.x - 14 - w); const y = Math.max(16, p.y - 14);
        g.fillStyle = 'rgba(7,11,20,0.82)'; g.fillRect(x, y - 13, w, 18);
        g.fillStyle = accent ? '#35e0e0' : '#e8e8e2'; g.fillText(text, x + 6, y);
      };
      if (sel && points.get(sel)) {
        const p = points.get(sel)!; const r = Math.max(14, p.size * 0.22);
        g.strokeStyle = '#35e0e0'; g.lineWidth = 1.2;
        g.beginPath(); g.arc(p.x, p.y, r, 0, Math.PI * 2); g.stroke();
        for (let i = 0; i < 4; i++) {
          const a = (i * Math.PI) / 2;
          g.beginPath(); g.moveTo(p.x + Math.cos(a) * r * 0.75, p.y + Math.sin(a) * r * 0.75); g.lineTo(p.x + Math.cos(a) * r * 1.35, p.y + Math.sin(a) * r * 1.35); g.stroke();
        }
        label(p, `SELECCIONADA · ${byId.get(sel)!.record.entityId}`, true);
      }
      if (hov && hov !== sel && points.get(hov)) {
        const node = byId.get(hov)!;
        label(points.get(hov)!, `${KINDS[kindOf(node)].label} · ${node.record.entityId}`, false);
      }
      projected.current = ordered;
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [stars, reducedMotion]);

  // Interacción: arrastrar gira, ⇧+arrastrar mueve, rueda o pellizco acerca, clic lee una memoria.
  const pick = (clientX: number, clientY: number): string | null => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = clientX - rect.left; const y = clientY - rect.top;
    let best: string | null = null; let bestScore = Infinity;
    for (const p of projected.current) {
      const d = Math.hypot(p.x - x, p.y - y);
      const reach = Math.max(10, p.size * 0.22);
      if (d < reach && d - p.z * 4 < bestScore) { best = p.id; bestScore = d - p.z * 4; }
    }
    return best;
  };
  useEffect(() => {
    const canvas = canvasRef.current!;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const v = view.current;
      v.zoom = Math.max(0.45, Math.min(4, v.zoom * Math.exp(-event.deltaY * (event.ctrlKey ? 0.01 : 0.0015))));
    };
    canvas.addEventListener('wheel', wheel, { passive: false });
    return () => canvas.removeEventListener('wheel', wheel);
  }, []);

  const selected = selectedId ? nodesById.get(selectedId) ?? null : null;
  const counts = useMemo(() => ({
    total: graph.nodes.length,
    confirmed: graph.nodes.filter((n) => n.record.status === 'validated').length,
    unconfirmed: graph.nodes.filter((n) => n.record.status === 'proposed').length,
    lit: graph.nodes.filter((n) => n.lastRecalledAt && Date.now() - Date.parse(n.lastRecalledAt) < LIT_WINDOW).length,
    links: graph.links.filter((l) => l.kind === 'similar').length,
  }), [graph]);
  const connections = selected ? (linksOf.get(selected.record.id) ?? [])
    .map((link) => ({ link, other: nodesById.get(link.source === selected.record.id ? link.target : link.source)! }))
    .filter((c) => c.other)
    .sort((a, b) => (b.link.similarity ?? 2) - (a.link.similarity ?? 2)) : [];

  return (
    <div className="memory-map">
      <div className="memory-map__head">
        <div>
          <p className="memory-map__title">MAPA DE MEMORIA</p>
          <p className="memory-map__stats">
            {counts.total} memorias · {counts.confirmed} confirmadas · {counts.unconfirmed} sin confirmar · {counts.lit} en uso · {counts.links} enlaces
          </p>
        </div>
        <div className="memory-map__head-actions">
          <button type="button" className="button" onClick={() => { view.current = { ...view.current, yaw: 0.6, pitch: -0.25, zoom: 1, panX: 0, panY: 0, tween: null }; select(null); }}>Centrar</button>
        </div>
      </div>
      <ul className="memory-map__legend" aria-label="Leyenda del mapa">
        {(Object.keys(KINDS) as MemoryKind[]).map((kind) => (
          <li key={kind}><span className="memory-map__dot" style={{ background: KINDS[kind].color }} />{KINDS[kind].label}</li>
        ))}
        <li><span className="memory-map__dot memory-map__dot--ring" />Confirmada</li>
        <li><span className="memory-map__dot memory-map__dot--lit" />En uso (brilla)</li>
        <li><span className="memory-map__dot" style={{ background: QUARANTINE_COLOR }} />En cuarentena (apagada)</li>
        <li><span className="memory-map__dash" />Refuta a</li>
      </ul>
      <div className="memory-map__stage" ref={wrapRef}>
        <canvas
          ref={canvasRef}
          role="img"
          tabIndex={0}
          aria-label={`Mapa de ${counts.total} memorias corporativas como neuronas: ${counts.confirmed} confirmadas, ${counts.unconfirmed} sin confirmar, ${counts.links} enlaces por similitud. La vista LISTA tiene el mismo contenido como texto.`}
          className="memory-map__canvas"
          onPointerDown={(event) => {
            (event.target as HTMLElement).setPointerCapture(event.pointerId);
            pointer.current = { x: event.clientX, y: event.clientY, moved: false, pan: event.shiftKey };
            dragging.current = true;
          }}
          onPointerMove={(event) => {
            const start = pointer.current;
            if (!start) { setHoverId(pick(event.clientX, event.clientY)); return; }
            const dx = event.clientX - start.x; const dy = event.clientY - start.y;
            if (Math.abs(dx) + Math.abs(dy) > 3) start.moved = true;
            const v = view.current; v.tween = null;
            if (start.pan) { v.panX += dx; v.panY += dy; }
            else { v.yaw += dx * 0.006; v.pitch = Math.max(-1.3, Math.min(1.3, v.pitch + dy * 0.006)); }
            start.x = event.clientX; start.y = event.clientY;
          }}
          onPointerUp={(event) => {
            const start = pointer.current; pointer.current = null; dragging.current = false;
            if (start && !start.moved) select(pick(event.clientX, event.clientY));
          }}
          onPointerEnter={() => { hovering.current = true; }}
          onPointerLeave={() => { hovering.current = false; setHoverId(null); }}
          onKeyDown={(event) => {
            const v = view.current;
            if (event.key === 'ArrowLeft') v.yaw -= 0.15;
            else if (event.key === 'ArrowRight') v.yaw += 0.15;
            else if (event.key === 'ArrowUp') v.pitch = Math.max(-1.3, v.pitch - 0.15);
            else if (event.key === 'ArrowDown') v.pitch = Math.min(1.3, v.pitch + 0.15);
            else if (event.key === '+' || event.key === '=') v.zoom = Math.min(4, v.zoom * 1.15);
            else if (event.key === '-') v.zoom = Math.max(0.45, v.zoom / 1.15);
            else if (event.key === 'Escape') select(null);
            else return;
            event.preventDefault();
          }}
        />
        {graph.nodes.length === 0 && (
          <p className="memory-map__empty">Todavía no hay memorias. El archivista guarda lo que vale la pena al cerrar cada expediente.</p>
        )}
        {selected && (
          <aside className="memory-map__panel">
            <div className="memory-map__panel-head">
              <span><span className="memory-map__dot" style={{ background: selected.record.status === 'quarantined' ? QUARANTINE_COLOR : KINDS[kindOf(selected)].color }} />{KINDS[kindOf(selected)].label}</span>
              <button type="button" className="memory-map__close" aria-label="Cerrar" onClick={() => select(null)}>×</button>
            </div>
            <p className="memory-map__content">{selected.record.content}</p>
            <dl className="memory-map__meta">
              <dt>Entidad</dt><dd>{selected.record.entityType} / {selected.record.entityId} v{selected.record.version}</dd>
              <dt>Origen</dt><dd>{selected.record.provenance.map((p) => origin(p.reference)).join(' · ')}</dd>
              <dt>Confianza</dt><dd>{TRUST[selected.record.trust]}</dd>
              <dt>Actualizada</dt><dd>{new Date(selected.record.updatedAt).toLocaleString()}</dd>
              <dt>Estado</dt>
              <dd>
                <span className={`memory-map__status memory-map__status--${modeOf(selected)}`}>
                  {selected.record.status === 'validated' ? 'CONFIRMADA' : selected.record.status === 'quarantined' ? 'EN CUARENTENA' : 'SIN CONFIRMAR'}
                </span>
                <span className="memory-map__status-note">
                  {selected.record.status === 'validated' ? 'Un humano la confirmó.'
                    : selected.record.status === 'quarantined' ? (selected.record.quarantineReason ?? 'Descartada.')
                    : 'Los agentes ya la usan. Confírmala si es correcta o mándala a cuarentena si no.'}
                </span>
              </dd>
            </dl>
            <p className="memory-map__section">Uso</p>
            <p className="memory-map__usage">
              {selected.recalls === 0 ? 'Todavía no la usa ningún agente.'
                : `La usaron los agentes ${selected.recalls} ${selected.recalls === 1 ? 'vez' : 'veces'} · la última ${ago(selected.lastRecalledAt!)}`}
            </p>
            <p className="memory-map__section">Conexiones {connections.length}</p>
            {connections.length === 0 && <p className="muted">Ninguna memoria parecida todavía.</p>}
            <ul className="memory-map__connections">
              {connections.map(({ link, other }) => (
                <li key={`${link.source}-${link.target}-${link.kind}`}>
                  <button type="button" onClick={() => select(other.record.id)}>
                    <span className="memory-map__dot" style={{ background: other.record.status === 'quarantined' ? QUARANTINE_COLOR : KINDS[kindOf(other)].color }} />
                    <span className="memory-map__connection-text">
                      {link.kind === 'contradicts' ? (link.source === selected.record.id ? 'Refuta a: ' : 'Refutada por: ') : ''}{other.record.content}
                    </span>
                    <span className="memory-map__pct">{link.similarity === null ? '' : `${Math.round(link.similarity * 100)}%`}</span>
                  </button>
                </li>
              ))}
            </ul>
            {selected.record.status !== 'quarantined' && (
              <div className="memory-map__actions">
                {quarantining ? (
                  <>
                    <label className="approval-panel__reason">
                      Por qué ya no es confiable
                      <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={2} />
                    </label>
                    <div className="memory-map__buttons">
                      <button type="button" className="button button--primary" disabled={busyId === selected.record.id || !reason.trim()}
                        onClick={() => { onQuarantine(selected.record.id, reason.trim()); setQuarantining(false); setReason(''); }}>
                        Confirmar cuarentena
                      </button>
                      <button type="button" className="button" onClick={() => { setQuarantining(false); setReason(''); }}>Cancelar</button>
                    </div>
                  </>
                ) : (
                  <div className="memory-map__buttons">
                    {selected.record.status === 'proposed' && (
                      <button type="button" className="button button--primary" disabled={busyId === selected.record.id} onClick={() => onConfirm(selected.record.id)}>
                        {busyId === selected.record.id ? 'Confirmando…' : '✓ Confirmar'}
                      </button>
                    )}
                    <button type="button" className="button" onClick={() => setQuarantining(true)}>✕ Cuarentena</button>
                  </div>
                )}
                {actionError && <p className="error">{actionError}</p>}
              </div>
            )}
          </aside>
        )}
        <p className="memory-map__keys">
          <kbd>Arrastrar</kbd> girar · <kbd>⇧</kbd>+<kbd>Arrastrar</kbd> mover · <kbd>Rueda</kbd> acercar · <kbd>Clic</kbd> leer una memoria · <kbd>Esc</kbd> soltar
        </p>
      </div>
    </div>
  );
}
