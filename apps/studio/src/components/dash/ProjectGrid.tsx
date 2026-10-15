'use client';
import { useEffect, useState } from 'react';
import { ago, api, post } from '@/lib/client';

interface P { id: string; name: string; at: number; updated: number; chats: number; videos: number; poster: string | null }

/** The projects: a card each (its latest poster, name, what's in it, when), and the card that starts a new one. */
export function ProjectGrid({ projects }: { projects: P[] }) {
  const [now, setNow] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { setNow(Date.now()); }, []);
  const create = async () => {
    if (busy) return;
    setBusy(true); setErr('');
    try { const r = await post<{ project: { id: string }; chat: { id: string } }>('/projects', {}); window.location.href = `/studio/p/${r.project.id}/c/${r.chat.id}`; }
    catch (e) { setErr((e as Error).message); setBusy(false); }
  };
  return (
    <>
      <ul className="grid" role="list">
        <li>
          <button className="card card--new" onClick={create} disabled={busy} aria-label="New project">
            <span className="card__plus" aria-hidden="true">{busy ? <span className="spin" /> : <svg viewBox="0 0 24 24" width="26" height="26"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>}</span>
            <span className="card__newlabel">{busy ? 'Setting up the set' : 'New project'}</span>
          </button>
        </li>
        {projects.map((p, i) => (
          <li key={p.id} style={{ '--i': i } as React.CSSProperties}>
            <a className="card" href={`/studio/p/${p.id}`}>
              <span className="card__frame">
                {p.poster
                  // a landscape video shows whole on a dark ground instead of a cropped middle
                  ? <img src={api(`/projects/${p.id}/media/videos/${p.poster}`)} alt="" loading="lazy" onLoad={e => { const i = e.currentTarget; if (i.naturalWidth > i.naturalHeight) i.parentElement?.classList.add('is-wide'); }} />
                  : <span className="card__empty" aria-hidden="true"><span /><span /><span /></span>}
              </span>
              <span className="card__meta">
                <b className="card__name">{p.name}</b>
                <span className="card__sub muted">{p.videos ? `${p.videos} video${p.videos > 1 ? 's' : ''}` : 'No video yet'} · {p.chats} chat{p.chats === 1 ? '' : 's'}{now ? ` · ${ago(p.updated, now)}` : ''}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
      {!projects.length && <p className="grid__hint muted">Start a project and tell Moovi what the video is for. The crew takes it from there.</p>}
      <p className="err" role="alert">{err}</p>
    </>
  );
}
