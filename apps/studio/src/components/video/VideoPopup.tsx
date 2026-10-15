'use client';
import { useEffect, useRef, useState } from 'react';
import { styleOf } from '@moovi/engine/styles';
import { mediaUrl, previewUrl } from '@/lib/client';

interface Ref { style: string; duration: number; timings: Record<string, number> }

/**
 * The finished video, over the set: play it, download it, minimise it to a corner, or tweak it (the chat opens with
 * "@video" ready for what to change). Versions sit side by side once there are several. A live-preview version (the
 * four styles) plays in its own style's player with the mixed audio, nothing encoded; its stage times sit beside it.
 */
export function VideoPopup({ pid, cid, title, version, versions, duration, format, minimised, live, onVersion, onClose, onMinimise, onTweak }: {
  pid: string; cid: string; title: string; version: number; versions: number; duration?: number; format?: string; minimised: boolean; live: boolean;
  onVersion: (v: number) => void; onClose: () => void; onMinimise: () => void; onTweak: () => void;
}) {
  const vid = useRef<HTMLVideoElement>(null);
  const [ref, setRef] = useState<Ref | null>(null);
  const [posterOk, setPosterOk] = useState(true);
  useEffect(() => {
    if (minimised) { vid.current?.pause(); return; }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onMinimise(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [minimised, onMinimise]);
  useEffect(() => { setPosterOk(true); }, [version]);
  // the stage times come with the film (they fill in once the contact sheet is done)
  useEffect(() => {
    if (!live || minimised) return;
    let stop = false;
    const load = () => fetch(`${previewUrl(pid, cid, version)}ref.json`, { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).then((j: Ref | null) => { if (!stop) setRef(j); }).catch(() => undefined);
    void load();
    const t = setInterval(load, 8000);
    return () => { stop = true; clearInterval(t); };
  }, [live, minimised, pid, cid, version]);
  const landscape = !live && format === 'landscape';
  const info = ref ? styleOf(ref.style) : null;
  const times = ref ? Object.entries(ref.timings) : [];

  if (minimised) return (
    <button className="vdock glass" onClick={onMinimise} aria-label={`Open the video, version ${version}`}>
      {posterOk ? <img src={mediaUrl(pid, cid, version, 'jpg')} alt="" onError={() => setPosterOk(false)} /> : <img alt="" />}
      <span><b>{title}</b><span className="muted">Version {version}{duration ? ` · ${duration.toFixed(1)} s` : ''}{live ? ' · live' : ''}</span></span>
      <span className="vdock__play" aria-hidden="true"><svg viewBox="0 0 20 20" width="14" height="14"><path d="M7 5l8 5-8 5z" fill="currentColor" /></svg></span>
    </button>
  );

  return (
    <div className="vpop" role="dialog" aria-modal="true" aria-label={`${title}, version ${version}`}>
      <button className="vpop__scrim" aria-label="Minimise the video" onClick={onMinimise} />
      <div className={`vpop__card glass ${landscape ? 'is-wide' : ''}`}>
        <div className={`vpop__frame ${live ? 'is-live' : ''}`}>
          {live
            ? <iframe key={version} src={previewUrl(pid, cid, version)} title={`${title}, version ${version}, live preview`} allow="autoplay" />
            : <video key={version} ref={vid} src={mediaUrl(pid, cid, version)} poster={mediaUrl(pid, cid, version, 'jpg')} controls autoPlay playsInline preload="metadata" />}
        </div>
        <div className="vpop__side">
          <div className="vpop__head">
            <h2 className="vpop__title">{title}</h2>
            <p className="muted">{duration ? `${duration.toFixed(1)} s · ` : ''}{landscape ? '16:9' : '9:16'}{info ? ` · ${info.name}` : ''}</p>
            {live && <span className="vpop__live"><i aria-hidden="true" />Playing live, nothing rendered</span>}
          </div>
          {versions > 1 && (
            <div className="vpop__versions" role="tablist" aria-label="Versions">
              {Array.from({ length: versions }, (_, i) => i + 1).map(v => <button key={v} role="tab" aria-selected={v === version} onClick={() => onVersion(v)}>v{v}</button>)}
            </div>
          )}
          {live && times.length > 0 && (
            <dl className="vpop__times" aria-label="Seconds per stage">
              {times.map(([k, s]) => <div key={k} style={{ display: 'contents' }}><dt className={k === 'to_preview' || k === 'total' ? 'is-sum' : ''}>{k.replace('_', ' ')}</dt><dd className={k === 'to_preview' || k === 'total' ? 'is-sum' : ''}>{s.toFixed(1)} s</dd></div>)}
            </dl>
          )}
          <div className="vpop__actions">
            {!live && (
              <a className="btn btn--go" href={mediaUrl(pid, cid, version, 'mp4', true)} download>
                <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M10 4v8M6.5 8.5L10 12l3.5-3.5M4.5 15.5h11" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>Download
              </a>
            )}
            {!live && (
              <button className="btn btn--soft" onClick={onTweak}>
                <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M13.6 4.4l2 2-8.4 8.4-2.8.8.8-2.8z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>Tweak in chat
              </button>
            )}
            <button className="btn btn--ghost" onClick={onMinimise}>Minimise</button>
          </div>
        </div>
        <button className="btn btn--icon vpop__x" onClick={onClose} aria-label="Close the video"><svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M5.5 5.5l9 9M14.5 5.5l-9 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg></button>
      </div>
    </div>
  );
}
