import { useEffect, useRef } from 'react';
import { AvatarEngine } from '../ascii/engine';
import type { AvatarState } from '../ascii/states';
import type { Scene } from '../ascii/scene';

// Palette tuned to this app's dark cyan terminal theme (see :root in styles.css), one tone per
// personality state — not the purple palette used by the TUI console avatar.
const STATE_COLORS: Record<AvatarState, string> = {
  IDLE: '#1b8f8f',
  BREATH: '#35e0e0',
  FOCUS: '#7df3f3',
  PROCESSING: '#35b8e0',
  ALERT: '#ff4d5e',
  HAND: '#35e08a',
  SPECTER: '#5f7a82',
  TUNNEL: '#1b8f8f',
  HALFTONE: '#ffb020',
  BOOT: '#cfe8e8',
  TRANSITION: '#35e0e0',
};

// Logical character grid resolution. Fixed regardless of pixel size; the <pre> font-size is
// scaled to fill the container (see ResizeObserver below), same idea as a terminal avatar whose
// detail depends on columns/rows, not screen DPI.
const COLS = 70;
const ROWS = 30;

export function AsciiAvatar({ state, scene, className }: { state: AvatarState; scene?: Scene | null; className?: string }) {
  const preRef = useRef<HTMLPreElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<AvatarEngine | null>(null);

  if (engineRef.current === null) {
    engineRef.current = new AvatarEngine(30, 1.1);
  }

  useEffect(() => {
    engineRef.current?.setState(state);
  }, [state]);

  useEffect(() => {
    engineRef.current?.setScene(scene ?? null);
  }, [scene]);

  useEffect(() => {
    const wrap = wrapRef.current;
    const pre = preRef.current;
    if (!wrap || !pre) return;

    const fit = () => {
      const width = wrap.clientWidth;
      const height = wrap.clientHeight;
      if (width <= 0 || height <= 0) return;
      const fontSizeFromWidth = width / (COLS * 0.6);
      const fontSizeFromHeight = height / (ROWS * 1.0);
      const fontSize = Math.max(6, Math.min(fontSizeFromWidth, fontSizeFromHeight));
      pre.style.fontSize = `${fontSize}px`;
      pre.style.lineHeight = '1';
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const pre = preRef.current;
    if (!pre) return;
    let frameId = 0;
    let lastFrameAt = 0;

    const tick = (nowMs: number) => {
      frameId = requestAnimationFrame(tick);
      const engine = engineRef.current!;
      const intervalMs = engine.frameIntervalSeconds() * 1000;
      if (nowMs - lastFrameAt < intervalMs) return;
      lastFrameAt = nowMs;

      const frame = engine.renderFrame(COLS, ROWS, nowMs / 1000);
      if (frame.changed) {
        pre.textContent = frame.lines.join('\n');
      }
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, []);

  useEffect(() => {
    const pre = preRef.current;
    if (!pre) return;
    const color = scene?.colorHex ?? STATE_COLORS[state];
    pre.style.color = color;
    pre.style.textShadow = `0 0 12px ${color}55`;
  }, [state, scene]);

  return (
    <div ref={wrapRef} className={className}>
      <pre ref={preRef} className="ascii-avatar__canvas" aria-hidden="true" />
    </div>
  );
}
