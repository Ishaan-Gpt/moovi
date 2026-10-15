'use client';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { MooviRenderer, type MooviOptions, type MooviStats } from '../moovi/MooviRenderer';
import type { MooviState } from '../moovi/states';
import type { QualityName } from '../moovi/quality';

export interface MooviProps {
  state?: MooviState;
  quality?: 'auto' | QualityName;
  /** Point him at something (-1..1 relative to his box); omit to follow the pointer. */
  lookAt?: [number, number] | null;
  interactive?: boolean;
  className?: string;
  style?: CSSProperties;
  /** Accessible name; Moovi is decorative-but-meaningful, so he gets an img role. */
  label?: string;
  onStats?: (stats: MooviStats) => void;
}

/**
 * <Moovi state="think" /> — the same character on the landing page and in the studio.
 * Renders nothing (beyond an empty box) when WebGL2 is missing; give the parent a poster if you need one.
 */
export function Moovi({ state = 'idle', quality = 'auto', lookAt, interactive = true, className, style, label = 'Moovi, your AI video director', onStats }: MooviProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<MooviRenderer | null>(null);
  const statsRef = useRef(onStats);
  statsRef.current = onStats;
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!MooviRenderer.isSupported()) { setSupported(false); return; }
    const opts: MooviOptions = { quality, interactive, state, onStats: s => statsRef.current?.(s) };
    const r = new MooviRenderer(canvas, opts);
    rendererRef.current = r;
    return () => { r.dispose(); rendererRef.current = null; };
    // quality/interactive need a fresh renderer; state and lookAt are pushed below without remounting
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quality, interactive]);

  useEffect(() => { rendererRef.current?.setState(state); }, [state]);
  useEffect(() => { rendererRef.current?.lookAt(lookAt ?? null); }, [lookAt?.[0], lookAt?.[1]]);

  return (
    <div className={className} style={{ position: 'relative', ...style }} role="img" aria-label={label}>
      {supported && <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />}
    </div>
  );
}
