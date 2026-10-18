'use client';
import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { HaloLoader } from '@moovi/ui';
import { post, readHandoff } from '@/lib/client';

const Moovi = dynamic(() => import('@moovi/character/react').then(m => m.Moovi), { ssr: false });
const TARGET = 'moovi:brief:target';

/**
 * The brief from the landing page becomes a project: a new project and its first chat, then the office with the brief
 * box open, where the user picks a preset first (decision 19) and the landing page's words and files fill the box.
 * A reload halfway resumes into the same chat instead of making a second project.
 */
export function Starter() {
  const [err, setErr] = useState('');
  const [attempt, setAttempt] = useState(0);
  const ran = useRef(-1);

  useEffect(() => {
    if (ran.current === attempt) return; // React runs effects twice in development; the work must run once
    ran.current = attempt;
    void (async () => {
      try {
        const h = await readHandoff();
        if (!h) { window.location.replace('/studio'); return; }
        let target: { pid: string; cid: string } | null = null;
        try { target = JSON.parse(sessionStorage.getItem(TARGET) ?? 'null'); } catch { target = null; }
        if (!target) {
          const r = await post<{ project: { id: string }; chat: { id: string } }>('/projects', {});
          target = { pid: r.project.id, cid: r.chat.id };
          try { sessionStorage.setItem(TARGET, JSON.stringify(target)); } catch { /* private mode */ }
        }
        // decision 19: no brief without a preset. The landing page's words and files stay handed over; the brief box in
        // the new chat asks for the preset first and fills itself with them (BriefOverlay reads the hand-off)
        try { sessionStorage.removeItem(TARGET); } catch { /* private mode */ }
        window.location.replace(`/studio/p/${target.pid}/c/${target.cid}?new=1`);
      } catch (e) { setErr((e as Error).message); }
    })();
  }, [attempt]);

  return (
    <main className="start">
      <div className="start__light" aria-hidden="true" />
      {/* waiting is the halo and nothing else; only a failure gets words */}
      {err ? <>
        <div className="start__moovi" aria-hidden="true"><Moovi state="review" className="start__canvas" interactive={false} /></div>
        <p className="start__line" role="status">That didn’t go through.</p>
      </> : <HaloLoader size={84} base="/studio" className="start__halo" />}
      {err && (
        <div className="start__err">
          <p className="err">{err}</p>
          <div className="start__acts">
            <button className="btn btn--go" onClick={() => { setErr(''); setAttempt(a => a + 1); }}>Try again</button>
            <a className="btn btn--ghost" href="/studio">Go to your projects</a>
          </div>
        </div>
      )}
    </main>
  );
}
