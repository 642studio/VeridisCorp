// Escenas ASCII compuestas en tiempo real: el agente (ask()) puede, además de elegir uno de los
// 10 "estados" de states.ts, describir una composición pequeña de primitivas propias. Cada
// primitiva generaliza una fórmula que ya aparece repetida a mano en states.ts (manchas gaussianas,
// anillos, ondas, espirales, franjas) — misma composición ADITIVA (suma ponderada), nunca booleana
// tipo SDF, para quedar visualmente consistente con los 10 estados ya afinados.
import { z } from 'zod';

const num = (lo: number, hi: number) => z.number().finite().min(lo).max(hi);

export const ScenePrimitive = z.discriminatedUnion('type', [
  // Mancha gaussiana suave — generaliza head/torso/palm/core en states.ts.
  z.object({
    type: z.literal('blob'),
    cx: num(-2, 2), cy: num(-2, 2), sx: num(0.02, 2), sy: num(0.02, 2), weight: num(-2, 2),
  }).strict(),
  // Anillo gaussiano a un radio dado — generaliza innerRing/outerRing/irisRing.
  z.object({
    type: z.literal('ring'),
    cx: num(-2, 2), cy: num(-2, 2), radius: num(0, 2), k: num(1, 200), weight: num(-2, 2),
  }).strict(),
  // Textura ondulada — generaliza rain/grain/lattice (freqY=0 da una onda 1D; ambas no-cero da reja).
  z.object({
    type: z.literal('wave'),
    freqX: num(-60, 60), freqY: num(-60, 60), phase: num(-10, 10), speed: num(-10, 10), weight: num(-2, 2),
  }).strict(),
  // Espiral — igual al término spiral de processingDensity.
  z.object({
    type: z.literal('spiral'),
    arms: num(1, 12), pitch: num(-30, 30), speed: num(-10, 10), weight: num(-2, 2),
  }).strict(),
  // Franjas con signo — igual a stripes/split de alertDensity.
  z.object({
    type: z.literal('stripes'),
    axis: z.enum(['x', 'y']), freq: num(1, 80), speed: num(-10, 10), weight: num(-2, 2),
  }).strict(),
]);
export type ScenePrimitive = z.infer<typeof ScenePrimitive>;

export const Scene = z.object({
  label: z.string().trim().max(60).optional(),
  colorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  layers: z.array(ScenePrimitive).min(1).max(8),
}).strict();
export type Scene = z.infer<typeof Scene>;

function sign(value: number): number {
  return value > 0 ? 1 : value < 0 ? -1 : 0;
}

function primitiveDensity(primitive: ScenePrimitive, xi: number, yi: number, t: number): number {
  switch (primitive.type) {
    case 'blob': {
      const dx = (xi - primitive.cx) / primitive.sx;
      const dy = (yi - primitive.cy) / primitive.sy;
      return primitive.weight * Math.exp(-(dx * dx + dy * dy));
    }
    case 'ring': {
      const radial = Math.sqrt((xi - primitive.cx) ** 2 + (yi - primitive.cy) ** 2);
      return primitive.weight * Math.exp(-primitive.k * (radial - primitive.radius) ** 2);
    }
    case 'wave':
      return primitive.weight * Math.cos(primitive.freqX * xi + primitive.freqY * yi + primitive.phase + primitive.speed * t);
    case 'spiral': {
      const radial = Math.sqrt(xi * xi + yi * yi);
      return primitive.weight * Math.sin(primitive.arms * Math.atan2(yi, xi + 1e-4) + primitive.pitch * radial - primitive.speed * t);
    }
    case 'stripes': {
      const axisValue = primitive.axis === 'x' ? xi : yi;
      return primitive.weight * sign(Math.sin(primitive.freq * axisValue + primitive.speed * t));
    }
    default:
      return 0;
  }
}

/** Llena `out` con la densidad compuesta de `scene` en el instante `t`. `out.length` debe igualar `x.length`. */
export function densityForScene(scene: Scene, x: Float32Array, y: Float32Array, t: number, out: Float32Array): void {
  const layers = scene.layers;
  for (let i = 0; i < x.length; i++) {
    const xi = x[i]!;
    const yi = y[i]!;
    let sum = 0;
    for (let layerIndex = 0; layerIndex < layers.length; layerIndex++) {
      sum += primitiveDensity(layers[layerIndex]!, xi, yi, t);
    }
    out[i] = sum;
  }
}
