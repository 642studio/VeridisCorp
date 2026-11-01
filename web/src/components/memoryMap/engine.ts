import type { MemoryGraph, MemoryKind } from '../../api/types';

// Motor de dibujo del mapa de memoria: Canvas 2D puro, sin WebGL ni dependencias. Cada memoria es
// una neurona dibujada una sola vez por combinación (tipo, estado, variante) y luego estampada.

export const SURFACE = '#070b14';
// Mismo umbral que LINK_THRESHOLD en src/runtime/memory-store.ts: bajo él no llega ningún enlace.
export const LINK_FLOOR = 0.72;

// Color por TIPO (identidad). Tres tonos validados con el validador del skill dataviz contra este
// fondo (--pairs all: un grafo es como un scatter, cualquier par puede quedar junto); "pregunta"
// va en neutro claro a propósito, porque un cuarto tono ya no separa bien. La FORMA de la neurona
// (ramas, alcance, bifurcaciones) es la segunda codificación: nunca solo el color.
export const KINDS: Record<MemoryKind, { label: string; color: string; branches: number; reach: number; fork: number }> = {
  decision: { label: 'Decisión', color: '#d95926', branches: 9, reach: 1.0, fork: 3 },
  fact: { label: 'Hecho', color: '#3987e5', branches: 7, reach: 0.85, fork: 2 },
  preference: { label: 'Preferencia', color: '#199e70', branches: 6, reach: 1.2, fork: 2 },
  question: { label: 'Pregunta', color: '#d9d8d2', branches: 4, reach: 0.7, fork: 1 },
};
// El ESTADO no usa tono (el rojo de estado chocaba con el naranja de "decisión"): lo confirmado
// lleva anillo blanco, lo que está en cuarentena se dibuja apagado y marchito en gris.
export const QUARANTINE_COLOR = '#80827b';
export type NeuronMode = 'unconfirmed' | 'confirmed' | 'quarantined';

export interface Vec3 { x: number; y: number; z: number }

function rng(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

const SPRITE = 256; // px del lienzo de cada neurona (se dibuja reducido, nítido en pantallas retina)
export const VARIANTS = 4;

// Una dendrita: un trazo que se adelgaza y serpentea, con espinas cortas a lo largo y bifurcaciones
// que repiten la misma regla más cortas y finas — de ahí el aspecto orgánico.
function branch(g: CanvasRenderingContext2D, x: number, y: number, angle: number, length: number, width: number, depth: number, rand: () => number) {
  const steps = 7;
  let px = x; let py = y; let a = angle;
  for (let i = 0; i < steps; i++) {
    a += (rand() - 0.5) * 0.55;
    const nx = px + Math.cos(a) * (length / steps);
    const ny = py + Math.sin(a) * (length / steps);
    g.lineWidth = Math.max(0.5, width * Math.pow(1 - i / steps, 1.3));
    g.beginPath(); g.moveTo(px, py); g.lineTo(nx, ny); g.stroke();
    if (i > 0 && rand() < 0.55) {
      const side = a + (rand() > 0.5 ? 1 : -1) * (0.9 + rand() * 0.6);
      const spine = length * (0.05 + rand() * 0.06);
      g.lineWidth = 0.6;
      g.beginPath(); g.moveTo(nx, ny); g.lineTo(nx + Math.cos(side) * spine, ny + Math.sin(side) * spine); g.stroke();
    }
    if (depth > 0 && (i === 2 || (i === 4 && rand() < 0.6))) {
      branch(g, nx, ny, a + (rand() > 0.5 ? 1 : -1) * (0.45 + rand() * 0.55), length * (0.45 + rand() * 0.2), width * 0.6, depth - 1, rand);
    }
    px = nx; py = ny;
  }
  g.beginPath(); g.arc(px, py, Math.max(1.1, width * 0.55), 0, Math.PI * 2); g.fill();
}

export function neuronSprite(kind: MemoryKind, mode: NeuronMode, variant: number): HTMLCanvasElement {
  const shape = KINDS[kind];
  const color = mode === 'quarantined' ? QUARANTINE_COLOR : shape.color;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SPRITE;
  const g = canvas.getContext('2d')!;
  const rand = rng(hash(`${kind}:${variant}`));
  const c = SPRITE / 2;
  if (mode !== 'quarantined') {
    const glow = g.createRadialGradient(c, c, 0, c, c, c * 0.95);
    glow.addColorStop(0, hexAlpha(color, 0.5));
    glow.addColorStop(0.18, hexAlpha(color, 0.22));
    glow.addColorStop(0.5, hexAlpha(color, 0.06));
    glow.addColorStop(1, hexAlpha(color, 0));
    g.fillStyle = glow; g.fillRect(0, 0, SPRITE, SPRITE);
  }
  g.globalCompositeOperation = 'lighter';
  g.lineCap = 'round';
  const alpha = mode === 'quarantined' ? 0.7 : 0.8;
  g.strokeStyle = hexAlpha(color, alpha); g.fillStyle = hexAlpha(color, alpha);
  const count = mode === 'quarantined' ? Math.max(3, shape.branches - 4) : shape.branches;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + (rand() - 0.5) * 0.9;
    const length = SPRITE * 0.32 * shape.reach * (0.7 + rand() * 0.5) * (mode === 'quarantined' ? 0.5 : 1);
    branch(g, c, c, angle, length, SPRITE * 0.03, mode === 'quarantined' ? 0 : shape.fork, rand);
  }
  const soma = g.createRadialGradient(c, c, 0, c, c, SPRITE * 0.085);
  soma.addColorStop(0, mode === 'quarantined' ? hexAlpha(color, 0.8) : '#ffffff');
  soma.addColorStop(0.45, hexAlpha(color, mode === 'quarantined' ? 0.6 : 0.95));
  soma.addColorStop(1, hexAlpha(color, 0));
  g.fillStyle = soma;
  g.beginPath(); g.arc(c, c, SPRITE * 0.085, 0, Math.PI * 2); g.fill();
  if (mode === 'confirmed') {
    g.globalCompositeOperation = 'source-over';
    g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = SPRITE * 0.012;
    g.beginPath(); g.arc(c, c, SPRITE * 0.115, 0, Math.PI * 2); g.stroke();
  }
  return canvas;
}

export function hexAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

// Reparte las memorias por una esfera (espiral de ángulo áureo: sin zonas calvas ni amontonadas),
// en un orden que deja juntas a las memorias enlazadas, y luego las relaja unas cuantas vueltas
// sobre la superficie: lo parecido se acerca, todo se repele un poco.
export function layout(graph: MemoryGraph): Map<string, Vec3> {
  const ids = graph.nodes.map((n) => n.record.id);
  const neighbours = new Map<string, Set<string>>(ids.map((id) => [id, new Set()]));
  for (const link of graph.links) {
    neighbours.get(link.source)?.add(link.target);
    neighbours.get(link.target)?.add(link.source);
  }
  const order: string[] = [];
  const seen = new Set<string>();
  const byDegree = [...ids].sort((a, b) => (neighbours.get(b)!.size - neighbours.get(a)!.size) || a.localeCompare(b));
  for (const start of byDegree) {
    if (seen.has(start)) continue;
    const queue = [start]; seen.add(start);
    while (queue.length) {
      const id = queue.shift()!;
      order.push(id);
      for (const next of [...neighbours.get(id)!].sort()) if (!seen.has(next)) { seen.add(next); queue.push(next); }
    }
  }
  const n = order.length;
  const golden = Math.PI * (3 - Math.sqrt(5));
  const points = order.map((id, i): [string, Vec3] => {
    const y = n === 1 ? 0 : 1 - ((i + 0.5) / n) * 2;
    const r = Math.sqrt(1 - y * y);
    const theta = i * golden;
    return [id, { x: Math.cos(theta) * r, y, z: Math.sin(theta) * r }];
  });
  const pos = new Map(points);
  const iterations = n <= 150 ? 120 : n <= 300 ? 60 : 25;
  const list = [...pos.values()];
  for (let it = 0; it < iterations; it++) {
    const forces = list.map(() => ({ x: 0, y: 0, z: 0 }));
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i]!; const b = list[j]!;
        const dx = a.x - b.x; const dy = a.y - b.y; const dz = a.z - b.z;
        const d2 = dx * dx + dy * dy + dz * dz + 0.01;
        const f = 0.0025 / d2;
        forces[i]!.x += dx * f; forces[i]!.y += dy * f; forces[i]!.z += dz * f;
        forces[j]!.x -= dx * f; forces[j]!.y -= dy * f; forces[j]!.z -= dz * f;
      }
    }
    const index = new Map(order.map((id, i) => [id, i]));
    for (const link of graph.links) {
      if (link.kind !== 'similar') continue;
      const i = index.get(link.source); const j = index.get(link.target);
      if (i === undefined || j === undefined) continue;
      const a = list[i]!; const b = list[j]!;
      const pull = 0.04 * (link.similarity ?? LINK_FLOOR);
      forces[i]!.x += (b.x - a.x) * pull; forces[i]!.y += (b.y - a.y) * pull; forces[i]!.z += (b.z - a.z) * pull;
      forces[j]!.x += (a.x - b.x) * pull; forces[j]!.y += (a.y - b.y) * pull; forces[j]!.z += (a.z - b.z) * pull;
    }
    list.forEach((p, i) => {
      p.x += forces[i]!.x; p.y += forces[i]!.y; p.z += forces[i]!.z;
      const len = Math.hypot(p.x, p.y, p.z) || 1;
      p.x /= len; p.y /= len; p.z /= len;
    });
  }
  // Los enlaces juntan a las memorias parecidas en un lado de la esfera: se recentra la nube en su
  // propio centro y se reescala a radio 1, para que gire sobre sí misma y no orbite descentrada.
  if (list.length > 1) {
    const c = list.reduce((acc, p) => ({ x: acc.x + p.x / list.length, y: acc.y + p.y / list.length, z: acc.z + p.z / list.length }), { x: 0, y: 0, z: 0 });
    for (const p of list) { p.x -= c.x; p.y -= c.y; p.z -= c.z; }
    const radius = Math.max(...list.map((p) => Math.hypot(p.x, p.y, p.z))) || 1;
    for (const p of list) { p.x /= radius; p.y /= radius; p.z /= radius; }
  }
  return pos;
}

// Forma de cerebro: un poco más ancho que alto.
export const BRAIN = { x: 1.25, y: 0.92, z: 1.0 };
export const CAMERA_DISTANCE = 3.4;

export function rotate(p: Vec3, yaw: number, pitch: number): Vec3 {
  const x = p.x * BRAIN.x; const y = p.y * BRAIN.y; const z = p.z * BRAIN.z;
  const x1 = x * Math.cos(yaw) + z * Math.sin(yaw);
  const z1 = -x * Math.sin(yaw) + z * Math.cos(yaw);
  return { x: x1, y: y * Math.cos(pitch) - z1 * Math.sin(pitch), z: y * Math.sin(pitch) + z1 * Math.cos(pitch) };
}

// Ángulos que dejan un punto de frente a la cámara (para enfocar la memoria seleccionada).
export function facing(p: Vec3): { yaw: number; pitch: number } {
  const x = p.x * BRAIN.x; const y = p.y * BRAIN.y; const z = p.z * BRAIN.z;
  const yaw = Math.atan2(-x, z);
  return { yaw, pitch: Math.atan2(y, Math.hypot(x, z)) };
}
