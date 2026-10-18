'use client';
import { useEffect, useState } from 'react';
import { HaloMark } from '@/components/brand/Logo';

const ZONE = /^\/studio(\/|$)/;
/** a tiny static file of the studio's, through the same proxy: if it answers, the studio is up */
const PROBE = '/studio/icon.svg';

/**
 * Into the studio (another app behind a proxy on this origin): the halo covers the page at once, then the hop waits
 * until the studio answers, so a slow or restarting studio shows the halo instead of a bare proxy error. Links into
 * /studio are caught here; code that navigates there itself calls `goStudio(url)`.
 */
export function goStudio(url: string) { window.dispatchEvent(new CustomEvent('moovi:studio', { detail: url })); }

export function StudioHop() {
  const [on, setOn] = useState(false);

  useEffect(() => {
    let alive = true;
    const go = async (url: string) => {
      setOn(true);
      for (let i = 0; alive; i++) {
        try {
          const ctl = new AbortController(); const t = window.setTimeout(() => ctl.abort(), 8000);
          const r = await fetch(`${PROBE}?t=${Date.now()}`, { cache: 'no-store', signal: ctl.signal });
          window.clearTimeout(t);
          if (r.ok) break;
        } catch { /* not up yet */ }
        await new Promise(r => window.setTimeout(r, Math.min(4000, 1000 + i * 500)));
      }
      if (alive) window.location.assign(url);
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element)?.closest?.('a') as HTMLAnchorElement | null;
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
      const u = new URL(a.href, location.href);
      if (u.origin !== location.origin || !ZONE.test(u.pathname)) return;
      e.preventDefault();
      void go(u.pathname + u.search + u.hash);
    };
    const onEvent = (e: Event) => void go((e as CustomEvent<string>).detail);
    // coming back with the back button (page restored from the cache): no cover
    const onShow = (e: PageTransitionEvent) => { if (e.persisted) setOn(false); };
    document.addEventListener('click', onClick, true);
    window.addEventListener('moovi:studio', onEvent);
    window.addEventListener('pageshow', onShow);
    return () => { alive = false; document.removeEventListener('click', onClick, true); window.removeEventListener('moovi:studio', onEvent); window.removeEventListener('pageshow', onShow); };
  }, []);

  if (!on) return null;
  return <div className="hop" role="status" aria-label="Opening the studio"><span className="hop__glow"><HaloMark size={84} spin /></span></div>;
}
