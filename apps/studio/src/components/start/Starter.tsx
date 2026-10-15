'use client';
import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { clearHandoff, post, readHandoff, upload } from '@/lib/client';

const Moovi = dynamic(() => import('@moovi/character/react').then(m => m.Moovi), { ssr: false });
const TARGET = 'moovi:brief:target';

/**
 * The brief from the landing page becomes a project: a new project and its first chat, the files handed over, the
 * brief sent, then the office. A reload halfway resumes into the same chat instead of making a second project.
 */
export function Starter() {
  const [line, setLine] = useState('Setting up your set');
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
        const ids: string[] = [];
        for (const [i, f] of h.files.entries()) {
          setLine(h.files.length > 1 ? `Handing over ${f.name} (${i + 1} of ${h.files.length})` : `Handing over ${f.name}`);
          ids.push((await upload(target.pid, target.cid, f)).id);
        }
        setLine('Giving Moovi your brief');
        await post(`/projects/${target.pid}/chats/${target.cid}/messages`, { kind: 'brief', text: h.prompt, uploads: ids, ratio: h.ratio });
        await clearHandoff();
        try { sessionStorage.removeItem(TARGET); } catch { /* private mode */ }
        window.location.replace(`/studio/p/${target.pid}/c/${target.cid}`);
      } catch (e) { setErr((e as Error).message); }
    })();
  }, [attempt]);

  return (
    <main className="start">
      <div className="start__light" aria-hidden="true" />
      <div className="start__moovi" aria-hidden="true"><Moovi state={err ? 'review' : 'think'} className="start__canvas" interactive={false} /></div>
      <p className="start__line" role="status">{err ? 'That didn’t go through.' : <>{line}<span className="start__dots" aria-hidden="true"><i /><i /><i /></span></>}</p>
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
