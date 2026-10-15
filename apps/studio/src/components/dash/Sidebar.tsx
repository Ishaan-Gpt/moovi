'use client';
import { useState } from 'react';
import { HaloMark } from '@contenteasy/ui';
import { post } from '@/lib/client';

/** The dashboard's left rail: the mark, Projects and Your model at the top, the profile at the bottom (with sign out). */
export function Sidebar({ user, current = 'projects' }: { user: { name: string; email: string }; current?: 'projects' | 'model' }) {
  const [open, setOpen] = useState(false);
  const out = async () => { await post('/auth/signout', {}).catch(() => undefined); window.location.href = '/studio/auth?mode=signin'; };
  return (
    <aside className="rail">
      <a className="rail__mark" href="/" aria-label="ContentEasy home"><HaloMark size={30} base="/studio" /><span>ContentEasy</span></a>
      <nav className="rail__nav" aria-label="Studio">
        <a className="rail__item" aria-current={current === 'projects' ? 'page' : undefined} href="/studio">
          <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><rect x="3" y="3.5" width="6" height="6" rx="1.8" fill="none" stroke="currentColor" strokeWidth="1.5" /><rect x="11" y="3.5" width="6" height="6" rx="1.8" fill="none" stroke="currentColor" strokeWidth="1.5" /><rect x="3" y="11.5" width="6" height="5" rx="1.8" fill="none" stroke="currentColor" strokeWidth="1.5" /><rect x="11" y="11.5" width="6" height="5" rx="1.8" fill="currentColor" opacity=".25" /></svg>
          Projects
        </a>
        <a className="rail__item" aria-current={current === 'model' ? 'page' : undefined} href="/studio/settings">
          <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><circle cx="7" cy="10" r="3.6" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M10.6 10H17M14.2 10v2.6M16.4 10v1.8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
          Your model
        </a>
      </nav>
      <div className="rail__me">
        {open && (
          <div className="rail__menu glass" role="menu">
            <p className="rail__who"><b>{user.name}</b><span className="muted">{user.email}</span></p>
            <button role="menuitem" className="rail__menuitem" onClick={out}>Sign out</button>
          </div>
        )}
        <button className="rail__profile" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(o => !o)}>
          <span className="rail__avatar" aria-hidden="true">{(user.name || user.email).slice(0, 1).toUpperCase()}</span>
          <span className="rail__name"><b>{user.name}</b><span className="muted">{user.email}</span></span>
        </button>
      </div>
    </aside>
  );
}
