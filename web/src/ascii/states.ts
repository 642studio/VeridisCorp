// Port of veridis-console/app/states.py (the terminal avatar's procedural ASCII states) to the
// browser. Same formulas, scalar loops instead of numpy, so the "VOZ" page shows the same
// personality states as the TUI console avatar.

export type AvatarState =
  | 'IDLE'
  | 'BREATH'
  | 'FOCUS'
  | 'PROCESSING'
  | 'ALERT'
  | 'HAND'
  | 'SPECTER'
  | 'TUNNEL'
  | 'HALFTONE'
  | 'BOOT'
  | 'TRANSITION';

export const NON_TRANSITION_STATES: readonly AvatarState[] = [
  'IDLE', 'BREATH', 'FOCUS', 'PROCESSING', 'ALERT', 'HAND', 'SPECTER', 'TUNNEL', 'HALFTONE', 'BOOT',
];

export function normalizeState(name: string): AvatarState {
  const upper = name.trim().toUpperCase();
  if ((NON_TRANSITION_STATES as string[]).includes(upper) || upper === 'TRANSITION') {
    return upper as AvatarState;
  }
  throw new Error(`Unknown avatar state: ${name}`);
}

function sign(value: number): number {
  return value > 0 ? 1 : value < 0 ? -1 : 0;
}

function idleDensity(x: Float32Array, y: Float32Array, t: number, out: Float32Array): void {
  for (let i = 0; i < x.length; i++) {
    const xi = x[i]!;
    const yi = y[i]!;
    const radial = Math.sqrt((xi * 0.82) ** 2 + (yi * 1.18) ** 2);
    const core = Math.exp(-4.9 * radial ** 2);
    const innerRing = Math.exp(-64.0 * (radial - (0.33 + 0.01 * Math.sin(0.6 * t))) ** 2);
    const outerRing = Math.exp(-44.0 * (radial - (0.67 + 0.015 * Math.sin(0.35 * t + 1.3))) ** 2);
    const grain = 0.12 * Math.cos(12.0 * radial - 0.7 * t);
    const ribs = 0.12 * Math.cos(9.0 * xi) * Math.exp(-3.6 * Math.abs(yi));
    out[i] = 0.75 * core + 0.42 * innerRing + 0.35 * outerRing + grain + ribs;
  }
}

function breathDensity(x: Float32Array, y: Float32Array, t: number, out: Float32Array): void {
  const breathScale = 1.0 + 0.08 * Math.sin(1.05 * t);
  for (let i = 0; i < x.length; i++) {
    const xb = x[i]! / breathScale;
    const yb = (y[i]! + 0.06) / breathScale;

    const head = Math.exp(-((xb / 0.18) ** 2 + ((yb + 0.56) / 0.15) ** 2));
    const neck = Math.exp(-((xb / 0.13) ** 2 + ((yb + 0.36) / 0.08) ** 2));
    const torso = Math.exp(-((xb / 0.34) ** 2 + ((yb + 0.03) / 0.48) ** 2));
    const shoulders = Math.exp(-((xb / 0.56) ** 2 + ((yb + 0.22) / 0.14) ** 2));
    const aura = Math.exp(-((xb / 0.72) ** 2 + ((yb + 0.02) / 0.92) ** 2));

    const rain = 0.16 * Math.cos(50.0 * x[i]! + 1.8 * Math.sin(2.2 * t)) * Math.exp(-0.9 * (y[i]! + 0.15) ** 2);
    const spark = 0.12 * Math.sin(22.0 * (x[i]! + y[i]!) + 2.0 * t) * Math.exp(-2.1 * (x[i]! ** 2 + y[i]! ** 2));

    out[i] = 0.95 * head + 0.65 * neck + 0.82 * torso + 0.54 * shoulders + 0.28 * aura + rain + spark;
  }
}

function focusDensity(x: Float32Array, y: Float32Array, t: number, out: Float32Array): void {
  for (let i = 0; i < x.length; i++) {
    const xi = x[i]!;
    const yi = y[i]!;
    const lidCurve = 0.5 - 0.82 * xi ** 2;
    const lidDistance = Math.abs(yi) - lidCurve;
    const eyelid = Math.exp(-20.0 * Math.max(lidDistance, 0.0));

    const irisRadius = Math.sqrt((xi / 0.72) ** 2 + (yi / 0.5) ** 2);
    const irisRing = Math.exp(-42.0 * (irisRadius - 0.62) ** 2);
    const fibers = 0.2 * Math.cos(46.0 * Math.atan2(yi, xi + 1e-4) + 2.8 * t) * Math.exp(-22.0 * (irisRadius - 0.63) ** 2);

    const pupilWidth = 0.028 + 0.012 * (0.5 + 0.5 * Math.sin(1.8 * t));
    const verticalPupil = Math.exp(-((xi / pupilWidth) ** 2)) * Math.exp(-2.5 * (yi / 0.56) ** 2);

    const coreGlow = Math.exp(-7.2 * ((xi * 0.72) ** 2 + (yi * 1.26) ** 2));
    const scanline = 0.11 * Math.cos((xi + 0.35 * Math.sin(0.7 * t)) * 26.0) * Math.exp(-20.0 * yi ** 2);

    out[i] = 0.56 * eyelid + 0.94 * irisRing + fibers + 0.28 * coreGlow + scanline - 1.5 * verticalPupil;
  }
}

function processingDensity(x: Float32Array, y: Float32Array, t: number, out: Float32Array): void {
  for (let i = 0; i < x.length; i++) {
    const xi = x[i]!;
    const yi = y[i]!;
    const radial = Math.sqrt((xi * 0.95) ** 2 + (yi * 1.05) ** 2);
    const rings = Math.cos(22.0 * radial - 3.0 * t);
    const spiral = Math.sin(7.0 * Math.atan2(yi, xi + 1e-4) + 11.0 * radial - 2.7 * t);
    const lattice = Math.cos(18.0 * xi + 2.2 * t) * Math.cos(18.0 * yi - 2.0 * t);
    const core = Math.exp(-7.0 * radial ** 2);
    const pulse = Math.exp(-58.0 * (radial - (0.42 + 0.02 * Math.sin(2.4 * t))) ** 2);
    out[i] = 0.28 * rings + 0.26 * spiral + 0.22 * lattice + 0.56 * core + 0.38 * pulse;
  }
}

function alertDensity(x: Float32Array, y: Float32Array, t: number, out: Float32Array): void {
  const jitter = 0.22 * Math.sin(8.4 * t) + 0.08 * Math.sin(16.8 * t + 1.1);
  for (let i = 0; i < x.length; i++) {
    const xi = x[i]!;
    const yi = y[i]!;
    const xShifted = xi + jitter * sign(yi + 0.001);

    const radial = Math.sqrt((xShifted * 0.98) ** 2 + (yi * 1.18) ** 2);
    const core = Math.exp(-6.7 * radial ** 2);

    const interference = Math.sin(28.0 * xi + 8.0 * Math.sin(9.0 * yi + 4.4 * t) + 13.0 * t) * Math.cos(23.0 * yi - 8.8 * t);
    const stripes = 0.2 * sign(Math.sin(38.0 * yi + 12.5 * t));
    const split = 0.15 * sign(Math.sin(22.0 * xi - 10.5 * t));
    const tear = Math.exp(-(((xi - 0.2 * Math.sin(3.2 * t)) / 0.045) ** 2)) * Math.exp(-((yi / 0.88) ** 2));
    const asymmetry = 0.24 * xi;

    out[i] = 0.44 * core + 0.34 * interference + stripes + split + 0.3 * tear + asymmetry;
  }
}

function handDensity(x: Float32Array, y: Float32Array, t: number, out: Float32Array): void {
  for (let i = 0; i < x.length; i++) {
    const xi = x[i]!;
    const yi = y[i]!;
    const forearm = Math.exp(-(((xi + 0.42) / 0.44) ** 2 + ((yi - 0.0) / 0.13) ** 2));
    const palm = Math.exp(-(((xi - 0.02) / 0.25) ** 2 + ((yi + 0.04) / 0.19) ** 2));

    const indexFinger = Math.exp(-(((xi - 0.18) / 0.06) ** 2 + ((yi - 0.26) / 0.3) ** 2));
    const middleFinger = Math.exp(-(((xi - 0.07) / 0.06) ** 2 + ((yi - 0.31) / 0.34) ** 2));
    const ringFinger = Math.exp(-(((xi + 0.03) / 0.06) ** 2 + ((yi - 0.29) / 0.31) ** 2));
    const pinkyFinger = Math.exp(-(((xi + 0.13) / 0.06) ** 2 + ((yi - 0.24) / 0.27) ** 2));
    const thumb = Math.exp(-(((xi - 0.26) / 0.14) ** 2 + ((yi - 0.02) / 0.09) ** 2));

    const knuckles = Math.exp(-(((xi - 0.02) / 0.3) ** 2 + ((yi - 0.14) / 0.07) ** 2));
    const traces = 0.16 * Math.cos(88.0 * (xi + 0.02) + 2.3 * t) * Math.exp(-(((yi + 0.02) / 0.42) ** 2));
    const glow = 0.18 * Math.exp(-2.2 * ((xi - 0.03) ** 2 + (yi - 0.1) ** 2));

    out[i] =
      0.42 * forearm +
      0.92 * palm +
      0.5 * indexFinger +
      0.56 * middleFinger +
      0.52 * ringFinger +
      0.45 * pinkyFinger +
      0.48 * thumb +
      0.22 * knuckles +
      traces +
      glow;
  }
}

function specterDensity(x: Float32Array, y: Float32Array, t: number, out: Float32Array): void {
  for (let i = 0; i < x.length; i++) {
    const xi = x[i]!;
    const yi = y[i]!;
    const head = Math.exp(-((xi / 0.17) ** 2 + ((yi + 0.56) / 0.16) ** 2));
    const hoodOuter = Math.exp(-((xi / 0.34) ** 2 + ((yi + 0.48) / 0.28) ** 2));
    const hoodInner = Math.exp(-((xi / 0.19) ** 2 + ((yi + 0.48) / 0.17) ** 2));
    const hood = Math.max(hoodOuter - 0.72 * hoodInner, 0.0);

    const torso = Math.exp(-((xi / 0.34) ** 2 + ((yi + 0.03) / 0.5) ** 2));
    const shoulders = Math.exp(-((xi / 0.58) ** 2 + ((yi + 0.22) / 0.15) ** 2));
    const haze = Math.exp(-((xi / 0.78) ** 2 + ((yi + 0.1) / 0.95) ** 2));

    const rain = 0.15 * Math.cos(92.0 * xi + 1.2 * Math.sin(2.8 * t)) * Math.exp(-0.55 * (yi + 0.18) ** 2);
    const flicker = 0.1 * Math.sin(26.0 * (xi - yi) + 2.2 * t) * Math.exp(-1.2 * (xi ** 2 + yi ** 2));

    out[i] = 0.78 * head + 0.62 * hood + 0.82 * torso + 0.46 * shoulders + 0.22 * haze + rain + flicker;
  }
}

function tunnelDensity(x: Float32Array, y: Float32Array, t: number, out: Float32Array): void {
  for (let i = 0; i < x.length; i++) {
    const xi = x[i]!;
    const yi = y[i]!;
    const depth = Math.max(yi + 1.14, 0.12);
    const invDepth = 1.0 / depth;

    const vertical = Math.cos(18.0 * xi * invDepth - 2.8 * t);
    const horizontal = Math.cos(16.0 * invDepth + 2.1 * t);
    const grid = 0.36 * vertical + 0.28 * horizontal;

    const rails = Math.exp(-(((Math.abs(xi) - (0.16 + 0.38 * depth)) / 0.035) ** 2)) * Math.exp(-1.3 * (yi + 0.25) ** 2);
    const vanish = Math.exp(-26.0 * xi ** 2 - 30.0 * (yi + 0.92) ** 2);
    const fog = 0.1 * Math.cos(11.0 * (xi + yi) - 1.6 * t) * Math.exp(-0.8 * (xi ** 2 + (yi + 0.2) ** 2));

    out[i] = grid + 0.4 * rails + 0.62 * vanish + fog;
  }
}

function halftoneDensity(x: Float32Array, y: Float32Array, t: number, out: Float32Array): void {
  for (let i = 0; i < x.length; i++) {
    const xi = x[i]!;
    const yi = y[i]!;
    const face = Math.exp(-((((xi + 0.08) / 0.72) ** 2) + (((yi + 0.03) / 0.92) ** 2)));
    const cheekShadow = Math.exp(-((((xi + 0.18) / 0.48) ** 2) + (((yi - 0.1) / 0.34) ** 2)));

    const eyeWhite = Math.exp(-((((xi + 0.02) / 0.23) ** 2) + (((yi + 0.03) / 0.1) ** 2)));
    const pupil = Math.exp(-((((xi + 0.03) / 0.07) ** 2) + (((yi + 0.03) / 0.055) ** 2)));
    const brow = Math.exp(-((((xi + 0.04) / 0.31) ** 2) + (((yi + 0.19) / 0.08) ** 2)));
    const lid = Math.exp(-((((xi + 0.02) / 0.27) ** 2) + (((yi + 0.01) / 0.14) ** 2)));

    const dots = Math.sin((xi + 0.5) * 118.0) ** 2 * Math.sin((yi + 0.55) * 86.0) ** 2;
    const dotGate = Math.min(Math.max((dots - 0.3) * 1.8, 0.0), 1.0);

    const structure = 0.54 * face + 0.24 * cheekShadow + 0.88 * eyeWhite + 0.42 * brow + 0.24 * lid - 1.08 * pupil;
    const neonNoise = 0.08 * Math.sin(21.0 * xi - 13.0 * yi - 1.4 * t) * face;

    out[i] = structure * (0.35 + 0.75 * dotGate) + neonNoise;
  }
}

function bootDensity(x: Float32Array, y: Float32Array, t: number, out: Float32Array): void {
  for (let i = 0; i < x.length; i++) {
    const xi = x[i]!;
    const yi = y[i]!;
    const jitter = 0.04 * Math.sin(30.0 * yi + 12.0 * t);
    const xj = xi + jitter;

    const scan = 0.12 * sign(Math.sin(90.0 * (yi + 1.0) - 8.0 * t));
    const header = Math.exp(-(((yi + 0.76) / 0.12) ** 2)) * Math.exp(-(((xj + 0.02) / 0.95) ** 2));
    const body = Math.exp(-(((yi + 0.12) / 0.55) ** 2)) * Math.exp(-(((xj + 0.12) / 0.95) ** 2));

    const glyph = Math.max(Math.cos((xj + 0.8) * 42.0) + Math.cos((yi + 1.0) * 120.0), 0.0);
    const columns =
      Math.exp(-(((xj + 0.45) / 0.08) ** 2)) +
      Math.exp(-(((xj + 0.05) / 0.08) ** 2)) +
      Math.exp(-(((xj - 0.35) / 0.08) ** 2));
    const noise = 0.18 * Math.sin(60.0 * xj + 37.0 * yi - 9.0 * t);

    out[i] = 0.38 * header + 0.34 * body * glyph + 0.2 * columns * Math.exp(-0.7 * (yi + 0.1) ** 2) + scan + 0.1 * noise;
  }
}

/** Fills `out` with the density field for `state` at time `t`. `out.length` must equal `x.length`. */
export function generateDensity(state: AvatarState, x: Float32Array, y: Float32Array, t: number, out: Float32Array): void {
  switch (state) {
    case 'IDLE':
      return idleDensity(x, y, t, out);
    case 'BREATH':
      return breathDensity(x, y, t, out);
    case 'FOCUS':
      return focusDensity(x, y, t, out);
    case 'PROCESSING':
      return processingDensity(x, y, t, out);
    case 'ALERT':
      return alertDensity(x, y, t, out);
    case 'HAND':
      return handDensity(x, y, t, out);
    case 'SPECTER':
      return specterDensity(x, y, t, out);
    case 'TUNNEL':
      return tunnelDensity(x, y, t, out);
    case 'HALFTONE':
      return halftoneDensity(x, y, t, out);
    case 'BOOT':
      return bootDensity(x, y, t, out);
    default:
      out.fill(0);
  }
}
