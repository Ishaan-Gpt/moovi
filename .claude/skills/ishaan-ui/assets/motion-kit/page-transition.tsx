'use client';
/*
 * Ishaan UI motion kit · page transitions that never slow navigation.
 * Mount <PageTransition labels={{ '/pricing': 'Pricing' }} /> once in the layout. Links may set
 * data-label="…" for the destination name. Style .sheet in kit.css; dress it in the concept's language.
 *
 * Click → router.push immediately → the sheet rises (curved leading edge) → the pathname changes → after a
 * short minimum the sheet lifts (curved trailing edge). Slow loads switch the sheet into a looping
 * "waiting" state, so the transition becomes the loader. Prefetches on intent.
 */
import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { gsap, prefersReducedMotion } from './gsap';

const MIN_COVER = 420;     // ms the sheet stays up at least, so it never just flashes
const WAITING_AFTER = 900; // ms before the sheet admits it's loading
const SAFETY = 9000;       // ms: lift anyway (and this timer is always cleared)

export function PageTransition({ labels = {} }: { labels?: Record<string, string> }) {
  const router = useRouter();
  const path = usePathname();
  const sheet = useRef<HTMLDivElement>(null);
  const [label, setLabel] = useState('');
  const st = useRef({ at: 0, from: '', up: false, timers: [] as number[] });
  const prev = useRef(path);

  const clearTimers = () => { st.current.timers.forEach(t => clearTimeout(t)); st.current.timers = []; };

  const lift = () => {
    const s = sheet.current;
    if (!s || !st.current.up) return;
    st.current.up = false;
    clearTimers();
    const wait = Math.max(0, MIN_COVER - (performance.now() - st.current.at));
    gsap.to(s, {
      yPercent: -100, borderRadius: '0 0 50% 50% / 0 0 22vh 22vh', duration: .7, ease: 'expo.inOut', delay: wait / 1000,
      onComplete: () => { gsap.set(s, { display: 'none' }); s.classList.remove('is-waiting'); },
    });
  };

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element).closest?.('a');
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || url.pathname === location.pathname) return;   // same-page hashes stay native
      e.preventDefault();
      router.push(url.pathname + url.search + url.hash);                                   // navigate first, always
      const s = sheet.current;
      if (prefersReducedMotion() || !s) return;
      clearTimers();
      setLabel(a.dataset.label ?? labels[url.pathname] ?? '');
      Object.assign(st.current, { at: performance.now(), from: location.pathname, up: true });
      gsap.set(s, { display: 'flex', yPercent: 100, borderRadius: '50% 50% 0 0 / 22vh 22vh 0 0' });
      gsap.to(s, { yPercent: 0, borderRadius: '0% 0% 0 0 / 0vh 0vh 0 0', duration: .55, ease: 'expo.inOut' });
      st.current.timers.push(window.setTimeout(() => s.classList.add('is-waiting'), WAITING_AFTER));
      st.current.timers.push(window.setTimeout(lift, SAFETY));
    };
    const prefetch = (e: Event) => {
      const a = (e.target as Element).closest?.('a[href^="/"]') as HTMLAnchorElement | null;
      if (a && !a.hash) router.prefetch(a.pathname);
    };
    document.addEventListener('click', onClick, true);
    document.addEventListener('pointerenter', prefetch, true);
    document.addEventListener('focusin', prefetch, true);
    document.addEventListener('touchstart', prefetch, { capture: true, passive: true });
    return () => {
      clearTimers();
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('pointerenter', prefetch, true);
      document.removeEventListener('focusin', prefetch, true);
      document.removeEventListener('touchstart', prefetch, true);
    };
  }, [router, labels]);

  // arrival: any change away from where the click happened (redirects included) lifts the sheet
  useEffect(() => {
    if (prev.current === path) return;
    prev.current = path;
    window.__lenis?.scrollTo(0, { immediate: true });
    window.scrollTo(0, 0);
    lift();
    if (location.hash) setTimeout(() => document.querySelector(location.hash)?.scrollIntoView(), 450);
  }, [path]);

  return (
    <div ref={sheet} className="sheet" aria-hidden="true">
      <span className="sheet__label">{label}</span>
      <span className="sheet__track"><span className="sheet__bead" /></span>
    </div>
  );
}
