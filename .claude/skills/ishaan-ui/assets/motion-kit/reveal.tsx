'use client';
/*
 * Ishaan UI motion kit · reveals.
 *
 * <Reveals /> (mount once): one IntersectionObserver adds .is-in to every [data-reveal] (CSS variant in
 * kit.css: soft blur rise, stagger with style="--d:120ms"). Cheap, works without GSAP.
 *
 * initKindReveals(root) (optional, GSAP): richer per-kind entrances for [data-reveal-kind="h|a|p|ctn|line"],
 * grouped by the closest [data-reveal-group]. Fires on enter, leave and enter-back (once), so anchor jumps
 * and mid-page reloads never leave content hidden.
 */
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { gsap, ScrollTrigger, SplitText, DUR, STAGGER, MOTION_BP, prefersReducedMotion } from './gsap';

export function Reveals() {
  const path = usePathname();
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>('[data-reveal]:not(.is-in)');
    if (prefersReducedMotion() || !('IntersectionObserver' in window)) { els.forEach(e => e.classList.add('is-in')); return; }
    const io = new IntersectionObserver(entries => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
    }, { rootMargin: '0px 0px -12% 0px', threshold: .01 });
    els.forEach(e => io.observe(e));
    return () => io.disconnect();
  }, [path]);
  return null;
}

type Kind = 'h' | 'a' | 'p' | 'ctn' | 'line';
type Splittable = HTMLElement & { _split?: SplitText };

/** Initial (hidden) state for one element of a kind. */
function hide(el: Splittable, kind: Kind) {
  gsap.set(el, { visibility: 'visible' });
  const phone = innerWidth < MOTION_BP;
  if (kind === 'h') { el._split ??= SplitText.create(el, { type: 'words,chars', smartWrap: true }); gsap.set(el._split.chars, { opacity: 0, yPercent: 50, rotateY: 90 }); }
  else if (kind === 'a') { el._split ??= SplitText.create(el, { type: 'chars' }); gsap.set(el._split.chars, { opacity: 0, rotateX: 90, x: '6rem', transformOrigin: 'center bottom' }); }
  else if (kind === 'p') { el._split ??= SplitText.create(el, { type: 'lines', mask: 'lines', linesClass: 'split-line' }); gsap.set(el._split.lines, { yPercent: 110 }); }
  else if (kind === 'ctn') gsap.set(el, { opacity: 0, y: phone ? '2.4rem' : '3.4rem' });
  else gsap.set(el, { clipPath: 'inset(0 0 100% 0)' });
}

/** The entrance for one element of a kind, as a tween to add to a timeline. */
function show(el: Splittable, kind: Kind) {
  if (kind === 'h') return gsap.to(el._split!.chars, { opacity: 1, yPercent: 0, rotateY: 0, duration: DUR.l, ease: 'Out', stagger: .035 });
  if (kind === 'a') return gsap.to(el._split!.chars, { opacity: 1, rotateX: 0, x: 0, duration: DUR.l, ease: 'Out', stagger: .06 });
  if (kind === 'p') return gsap.to(el._split!.lines, { yPercent: 0, duration: DUR.l, ease: 'Out', stagger: STAGGER });
  if (kind === 'ctn') return gsap.to(el, { opacity: 1, y: 0, duration: DUR.l, ease: 'Out' });
  return gsap.to(el, { clipPath: 'inset(0 0 0% 0)', duration: DUR.l, ease: 'InOut' });
}

export function initKindReveals(root: ParentNode = document, containerAnimation?: gsap.core.Animation) {
  const els = [...root.querySelectorAll<Splittable>('[data-reveal-kind]')].filter(e => !e.dataset.revealDone);
  if (prefersReducedMotion()) { els.forEach(e => gsap.set(e, { visibility: 'visible' })); return () => {}; }
  const groups = new Map<Element, Splittable[]>();
  for (const el of els) {
    const g = el.closest('[data-reveal-group]') ?? el;
    groups.set(g, [...(groups.get(g) ?? []), el]);
  }
  const triggers: ScrollTrigger[] = [];
  groups.forEach((items, group) => {
    items.forEach(el => { el.dataset.revealDone = '1'; hide(el, el.dataset.revealKind as Kind); });
    let played = false;
    const play = () => {
      if (played) return; played = true;
      const tl = gsap.timeline();
      items.forEach((el, i) => tl.add(show(el, el.dataset.revealKind as Kind), Number(el.dataset.revealDelay ?? i * .1)));
    };
    triggers.push(ScrollTrigger.create({
      trigger: group, start: containerAnimation ? 'left 85%' : 'top 88%', containerAnimation,
      onEnter: play, onLeave: play, onEnterBack: play,   // never leave content hidden after a jump
    }));
  });
  return () => triggers.forEach(t => t.kill());
}
