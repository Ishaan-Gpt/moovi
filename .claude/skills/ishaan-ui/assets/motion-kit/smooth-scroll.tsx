'use client';
/*
 * Ishaan UI motion kit · smooth scroll on GSAP's clock.
 * Mount <SmoothScroll /> once, high in the layout (before any intro, so the intro can stop it).
 * Lenis, ScrollTrigger and any per-frame code share gsap.ticker: one rAF for the whole page.
 * Reduced motion keeps native scrolling. Touch keeps native momentum.
 */
import { useEffect } from 'react';
import Lenis from 'lenis';
import { gsap, ScrollTrigger, prefersReducedMotion } from './gsap';
import { isScrollLocked } from './intro-gate';

declare global { interface Window { __lenis?: Lenis } }

export function SmoothScroll() {
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const lenis = new Lenis({ duration: 1.15, easing: t => 1 - Math.pow(1 - t, 4), smoothWheel: true, touchMultiplier: 2, anchors: true });
    window.__lenis = lenis;
    if (isScrollLocked()) lenis.stop();                 // an intro or menu locked before we existed
    lenis.on('scroll', ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);   // ticker time is in seconds
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);                         // no catch-up jumps after a stalled frame
    // fonts change heights: re-measure every trigger once they're in
    document.fonts?.ready.then(() => ScrollTrigger.refresh());
    return () => { gsap.ticker.remove(tick); lenis.destroy(); delete window.__lenis; };
  }, []);
  return null;
}

/** Scroll to an element or y position through Lenis when it's running, natively otherwise. */
export function scrollToTarget(target: string | HTMLElement | number, duration = 1.6) {
  const el = typeof target === 'string' ? document.querySelector<HTMLElement>(target) : target;
  if (el === null) return;
  if (window.__lenis) { window.__lenis.scrollTo(el, { duration }); return; }
  const behavior: ScrollBehavior = prefersReducedMotion() ? 'auto' : 'smooth';
  if (typeof el === 'number') window.scrollTo({ top: el, behavior });
  else el.scrollIntoView({ behavior });
}
