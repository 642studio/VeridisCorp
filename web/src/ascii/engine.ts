// Port of veridis-console/app/avatar_engine.py: smooth crossfade between procedural ASCII
// states. Same ramp/compression math, adapted to run per animation frame in the browser.
import { generateDensity, normalizeState, type AvatarState } from './states';

const ASCII_RAMP = ' .:-=+*#%@';

const FPS_BY_STATE: Record<AvatarState, number> = {
  IDLE: 12,
  BREATH: 14,
  FOCUS: 22,
  PROCESSING: 28,
  ALERT: 30,
  HAND: 24,
  SPECTER: 20,
  TUNNEL: 30,
  HALFTONE: 18,
  BOOT: 24,
  TRANSITION: 30,
};

export interface AvatarFrame {
  lines: string[];
  changed: boolean;
  visibleState: AvatarState;
}

function smoothstep(alpha: number): number {
  return alpha * alpha * (3.0 - 2.0 * alpha);
}

export class AvatarEngine {
  private readonly maxFps: number;
  private readonly transitionSeconds: number;

  private state: AvatarState = 'IDLE';
  private targetState: AvatarState = 'IDLE';
  private requestedState: AvatarState | null = null;

  private transitionStart = 0;
  private frozenSourceDensity: Float32Array | null = null;

  private gridWidth = 0;
  private gridHeight = 0;
  private x: Float32Array | null = null;
  private y: Float32Array | null = null;

  private lastDensity: Float32Array | null = null;
  private previousChars: string[] | null = null;
  private lastLines: string[] = [];
  private scratchA: Float32Array | null = null;
  private scratchB: Float32Array | null = null;

  constructor(maxFps = 30, transitionSeconds = 1.1) {
    this.maxFps = Math.max(1, Math.min(maxFps, 30));
    this.transitionSeconds = Math.max(0.1, transitionSeconds);
  }

  get visibleState(): AvatarState {
    return this.frozenSourceDensity !== null ? 'TRANSITION' : this.state;
  }

  frameIntervalSeconds(): number {
    const effectiveFps = Math.min(this.maxFps, FPS_BY_STATE[this.visibleState] ?? this.maxFps);
    return 1.0 / Math.max(1, effectiveFps);
  }

  setState(stateName: string | AvatarState): void {
    const state = normalizeState(stateName);
    if (state === 'TRANSITION') return;
    if (state === this.targetState && this.frozenSourceDensity === null) return;
    this.requestedState = state;
  }

  renderFrame(width: number, height: number, now: number): AvatarFrame {
    if (width < 2 || height < 2) {
      return { lines: [''], changed: false, visibleState: this.visibleState };
    }

    this.ensureGrid(width, height);

    if (this.requestedState !== null && this.requestedState !== this.targetState) {
      if (this.lastDensity !== null && this.lastDensity.length === width * height) {
        this.frozenSourceDensity = this.lastDensity.slice();
      } else {
        this.frozenSourceDensity = this.densityFor(this.targetState, now).slice();
      }
      this.targetState = this.requestedState;
      this.requestedState = null;
      this.transitionStart = now;
    }

    const targetDensity = this.densityFor(this.targetState, now);
    let composed = targetDensity;

    if (this.frozenSourceDensity !== null) {
      const rawAlpha = (now - this.transitionStart) / this.transitionSeconds;
      const alpha = Math.min(1, Math.max(0, rawAlpha));
      const smoothAlpha = smoothstep(alpha);
      const blended = this.scratchB!;
      for (let i = 0; i < blended.length; i++) {
        blended[i] = (1 - smoothAlpha) * this.frozenSourceDensity[i]! + smoothAlpha * targetDensity[i]!;
      }
      composed = blended;
      if (alpha >= 1.0) {
        this.state = this.targetState;
        this.frozenSourceDensity = null;
      }
    } else {
      this.state = this.targetState;
    }

    this.lastDensity = composed.slice();
    const chars = this.densityToChars(composed);

    const changed = this.previousChars === null || !arraysEqual(this.previousChars, chars);
    if (changed) {
      this.previousChars = chars;
      this.lastLines = chars;
    }

    return { lines: this.lastLines, changed, visibleState: this.visibleState };
  }

  private ensureGrid(width: number, height: number): void {
    if (this.x !== null && this.y !== null && width === this.gridWidth && height === this.gridHeight) {
      return;
    }

    this.gridWidth = width;
    this.gridHeight = height;

    const size = width * height;
    const x = new Float32Array(size);
    const y = new Float32Array(size);
    const aspect = (width / Math.max(height, 1)) * 0.55;

    for (let row = 0; row < height; row++) {
      const yv = height === 1 ? -1 : -1 + (2 * row) / (height - 1);
      for (let col = 0; col < width; col++) {
        const xv = width === 1 ? -1 : -1 + (2 * col) / (width - 1);
        const idx = row * width + col;
        x[idx] = xv * aspect;
        y[idx] = yv;
      }
    }

    this.x = x;
    this.y = y;
    this.previousChars = null;
    this.lastLines = [];
    this.lastDensity = null;
    this.scratchA = new Float32Array(size);
    this.scratchB = new Float32Array(size);
  }

  private densityFor(state: AvatarState, now: number): Float32Array {
    const out = this.scratchA!;
    generateDensity(state, this.x!, this.y!, now, out);
    return out;
  }

  private densityToChars(density: Float32Array): string[] {
    const lines: string[] = [];
    const rampLen = ASCII_RAMP.length;
    for (let row = 0; row < this.gridHeight; row++) {
      let line = '';
      for (let col = 0; col < this.gridWidth; col++) {
        const value = density[row * this.gridWidth + col]!;
        const compressed = Math.tanh(value * 1.25);
        const normalized = (compressed + 1.0) * 0.5;
        const index = Math.min(rampLen - 1, Math.max(0, Math.floor(normalized * (rampLen - 1))));
        line += ASCII_RAMP[index];
      }
      lines.push(line);
    }
    return lines;
  }
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
