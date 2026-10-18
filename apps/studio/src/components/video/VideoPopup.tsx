'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { mediaUrl, previewUrl } from '@/lib/client';

/**
 * The finished video, over the set: the film alone in a clear jelly-glass frame, the office blurred behind it, and one
 * floating glass bar of icons under it (versions, download, tweak in chat, minimise, close). No words on screen; each
 * icon says what it does to a screen reader and on hover. A live-preview version plays in its own player, as before.
 */
export function VideoPopup({ pid, cid, title, version, versions, minimised, live, format, onVersion, onClose, onMinimise, onTweak }: {
  pid: string; cid: string; title: string; version: number; versions: number; duration?: number; format?: string; minimised: boolean; live: boolean;
  onVersion: (v: number) => void; onClose: () => void; onMinimise: () => void; onTweak: () => void;
}) {
  const vid = useRef<HTMLVideoElement>(null);
  const [posterOk, setPosterOk] = useState(true);
  useEffect(() => {
    if (minimised) { vid.current?.pause(); return; }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onMinimise(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [minimised, onMinimise]);
  useEffect(() => { setPosterOk(true); }, [version]);
  // a live Launch film is 16:9 too (the reel task marks it landscape)
  const landscape = format === 'landscape';

  if (minimised) return (
    <button className="vd" onClick={onMinimise} aria-label={`Open ${title}, version ${version}`} title="Open the video">
      {posterOk ? <img src={mediaUrl(pid, cid, version, 'jpg')} alt="" onError={() => setPosterOk(false)} /> : <span className="vd__blank" />}
      <span className="vd__play" aria-hidden="true"><svg viewBox="0 0 20 20" width="14" height="14"><path d="M7.2 5.2c0-.7.8-1.1 1.4-.7l6.3 4.6c.5.4.5 1.1 0 1.5l-6.3 4.6c-.6.4-1.4 0-1.4-.7z" fill="currentColor" /></svg></span>
    </button>
  );

  return (
    <div className="vp" role="dialog" aria-modal="true" aria-label={`${title}, version ${version}`}>
      <button className="vp__scrim" aria-label="Minimise the video" onClick={onMinimise} />
      <div className={`vp__stage ${landscape ? 'is-wide' : ''}`}>
        <div className={`vp__frame ${live ? 'is-live' : ''}`}>
          {live
            ? <iframe key={version} src={previewUrl(pid, cid, version)} title={`${title}, version ${version}`} allow="autoplay" />
            : <video key={version} ref={vid} src={mediaUrl(pid, cid, version)} poster={mediaUrl(pid, cid, version, 'jpg')} controls autoPlay playsInline preload="metadata" />}
        </div>
        <div className="vp__bar" role="toolbar" aria-label="Video">
          {versions > 1 && (
            <div className="vp__vers" role="tablist" aria-label="Versions">
              {Array.from({ length: versions }, (_, i) => i + 1).map(v => (
                <button key={v} role="tab" aria-selected={v === version} aria-label={`Version ${v}`} title={`Version ${v}`} onClick={() => onVersion(v)}>{v}</button>
              ))}
            </div>
          )}
          {!live && <Icon href={mediaUrl(pid, cid, version, 'mp4', true)} label="Download" primary><path d="M10 4v8M6.5 8.5L10 12l3.5-3.5M4.5 15.5h11" /></Icon>}
          {!live && <Icon onClick={onTweak} label="Change something in the chat"><path d="M13.6 4.4l2 2-8.4 8.4-2.8.8.8-2.8z" /></Icon>}
          <Icon onClick={onMinimise} label="Minimise"><path d="M5 13.5h10" /></Icon>
          <Icon onClick={onClose} label="Close"><path d="M5.5 5.5l9 9M14.5 5.5l-9 9" /></Icon>
        </div>
      </div>
    </div>
  );
}

/** One round glass button in the bar: an icon, with its words only for screen readers and the hover hint. */
function Icon({ label, onClick, href, primary, children }: { label: string; onClick?: () => void; href?: string; primary?: boolean; children: ReactNode }) {
  const svg = <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{children}</svg>;
  const cls = `vp__btn ${primary ? 'is-primary' : ''}`;
  return href
    ? <a className={cls} href={href} download aria-label={label} title={label}>{svg}</a>
    : <button className={cls} onClick={onClick} aria-label={label} title={label}>{svg}</button>;
}
