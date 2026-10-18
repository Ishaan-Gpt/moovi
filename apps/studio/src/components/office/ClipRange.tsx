'use client';
import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * The part of the clip to edit (decision 19: picked right at upload). The clip plays in a small player; two handles on
 * its timeline set where the edit starts and ends, and "start here" / "end here" take the playhead. Plain on purpose:
 * the Frontend session styles it later. The range is in seconds of the original clip.
 */
export function ClipRange({ file, value, onChange, disabled }: {
  file: File; value: { in: number; out: number } | null; onChange: (r: { in: number; out: number } | null) => void; disabled?: boolean;
}) {
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  const video = useRef<HTMLVideoElement>(null);
  const [dur, setDur] = useState(0);
  const a = value?.in ?? 0, b = value?.out ?? dur;
  const set = (x: number, y: number) => {
    const lo = Math.max(0, Math.min(x, dur)), hi = Math.max(0, Math.min(y, dur));
    onChange(lo <= 0.05 && hi >= dur - 0.05 ? null : { in: +lo.toFixed(2), out: +hi.toFixed(2) });
  };
  const at = () => video.current?.currentTime ?? 0;
  const t = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;
  // the preview stays inside the chosen part
  const onTime = () => { const v = video.current; if (v && value && v.currentTime > value.out) { v.pause(); v.currentTime = value.in; } };

  return (
    <div className="nb__range">
      <video ref={video} src={url} controls playsInline preload="metadata" onLoadedMetadata={e => setDur(e.currentTarget.duration || 0)} onTimeUpdate={onTime} />
      {dur > 0 && <>
        <label className="nb__range-row"><span>Start {t(a)}</span>
          <input type="range" min={0} max={dur} step={0.1} value={a} disabled={disabled} onChange={e => { const x = Math.min(+e.target.value, b - 0.5); set(x, b); if (video.current) video.current.currentTime = x; }} />
        </label>
        <label className="nb__range-row"><span>End {t(b)}</span>
          <input type="range" min={0} max={dur} step={0.1} value={b} disabled={disabled} onChange={e => { const y = Math.max(+e.target.value, a + 0.5); set(a, y); if (video.current) video.current.currentTime = y; }} />
        </label>
        <div className="nb__range-acts">
          <button type="button" className="nb__chip" disabled={disabled} onClick={() => set(Math.min(at(), b - 0.5), b)}>Start here</button>
          <button type="button" className="nb__chip" disabled={disabled} onClick={() => set(a, Math.max(at(), a + 0.5))}>End here</button>
          <button type="button" className="nb__chip" disabled={disabled || !value} onClick={() => onChange(null)}>Whole clip</button>
          <em className="muted">{t(b - a)} of {t(dur)}</em>
        </div>
      </>}
    </div>
  );
}
