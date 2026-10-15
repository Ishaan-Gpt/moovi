'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { gsap, prefersReducedMotion } from '@/lib/gsap';
import { HaloMark } from '@/components/brand/Logo';
import { scrollToId } from './SmoothScroll';

const LABELS: Record<string, string> = { '/': 'Home' };
/** the studio is another app on this origin: its links load as full pages (no client routing into it) */
const ZONE = /^\/studio(\/|$)/;
const MIN_COVER = 420;

/**
 * Page changes: a sheet rises with a curved leading edge, names the destination, and the halo bead travels a
 * hairline. Navigation starts on click (never delayed); the sheet lifts once the new route has rendered.
 * Slow loads keep the sheet up and the bead loops: the transition becomes the loader.
 */
export function PageTransition() {
  const router = useRouter();
  const pathname = usePathname();
  const sheet = useRef<HTMLDivElement>(null);
  const [label, setLabel] = useState('');
  const state = useRef<{ from: string; at: number; active: boolean }>({ from: '', at: 0, active: false });
  // every pending timer of the current transition (the "waiting" cue, the safety lift): cleared on lift, on a new
  // click and on unmount, so a stale one can never touch a later transition
  const timers = useRef<number[]>([]);
  const clearTimers = () => { timers.current.forEach(t => window.clearTimeout(t)); timers.current = []; };

  // prefetch on intent
  useEffect(() => {
    const intent = (e: Event) => {
      const a = (e.target as Element)?.closest?.('a[href^="/"]') as HTMLAnchorElement | null;
      if (a && !a.hash && !ZONE.test(a.pathname)) router.prefetch(a.pathname);
    };
    document.addEventListener('pointerenter', intent, true);
    document.addEventListener('focusin', intent, true);
    document.addEventListener('touchstart', intent, { capture: true, passive: true });
    return () => {
      document.removeEventListener('pointerenter', intent, true);
      document.removeEventListener('focusin', intent, true);
      document.removeEventListener('touchstart', intent, true);
    };
  }, [router]);

  // intercept internal navigations
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element)?.closest?.('a') as HTMLAnchorElement | null;
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || url.pathname === location.pathname || ZONE.test(url.pathname)) return;
      e.preventDefault();
      clearTimers();
      router.push(url.pathname + url.search + url.hash);
      if (prefersReducedMotion() || !sheet.current) return;
      state.current = { from: location.pathname, at: performance.now(), active: true };
      setLabel(a.dataset.label ?? LABELS[url.pathname] ?? 'Next scene');
      const s = sheet.current;
      gsap.killTweensOf(s);
      gsap.set(s, { display: 'flex', yPercent: 100, borderRadius: '50% 50% 0 0 / 22vh 22vh 0 0' });
      gsap.to(s, { yPercent: 0, borderRadius: '0% 0% 0 0 / 0vh 0vh 0 0', duration: .55, ease: 'expo.inOut' });
      s.classList.remove('is-waiting');
      timers.current.push(
        window.setTimeout(() => s.classList.add('is-waiting'), 900),
        window.setTimeout(() => lift(true), 9000), // fallback
      );
    };
    document.addEventListener('click', onClick, true);
    return () => { document.removeEventListener('click', onClick, true); clearTimers(); };
  }, [router]);

  function lift(force = false) {
    const s = sheet.current;
    if (!s || !state.current.active) return;
    if (!force && location.pathname === state.current.from) return;
    state.current.active = false;
    clearTimers();
    const wait = Math.max(0, MIN_COVER - (performance.now() - state.current.at));
    gsap.to(s, {
      yPercent: -100, borderRadius: '0 0 50% 50% / 0 0 22vh 22vh', duration: .7, ease: 'expo.inOut', delay: wait / 1000,
      onComplete: () => { gsap.set(s, { display: 'none' }); s.classList.remove('is-waiting'); },
    });
  }

  // arrival: the route changed away from where the click happened (not on first load)
  const prevPath = useRef(pathname);
  useEffect(() => {
    if (prevPath.current === pathname) return;
    prevPath.current = pathname;
    lift();
    const hash = location.hash.slice(1);
    window.__lenis?.scrollTo(0, { immediate: true });
    window.scrollTo(0, 0);
    if (hash) window.setTimeout(() => scrollToId(hash), 450);
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="sheet" ref={sheet} aria-hidden="true">
      <div className="sheet__inner">
        <span className="sheet__label">{label}</span>
        <span className="sheet__track"><span className="sheet__bead"><HaloMark size={34} spin /></span></span>
        <span className="sheet__wait t-mono">Rolling…</span>
      </div>
    </div>
  );
}
