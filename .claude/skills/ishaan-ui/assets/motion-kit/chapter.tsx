'use client';
/*
 * Ishaan UI motion kit · pinned chapters (CSS sticky, no pin-spacer) with a timeline normalised to 0..1.
 *
 *   <Chapter id="problem" vh={300} back={<h2 className="giant">…</h2>} front={<p>…</p>} build={build} />
 *
 * `build({ tl, q, el })` adds tweens at progress positions:
 *   tl.fromTo(q('.title'), { yPercent: 160 }, { yPercent: 0, duration: .12, ease: 'power3.out', immediateRender: false }, .2)
 * Rules: every tween is fromTo + immediateRender:false; give each element its whole story in its *first*
 * tween (primeDom only primes the first one); wrap `build` in useCallback so the effect doesn't re-run.
 * Optional: pass `onTimeline` to hand the paused/shared-state side to a director (director.ts).
 */
import { useEffect, useRef, type ReactNode } from 'react';
import { gsap, ScrollTrigger } from './gsap';

export type Build = (ctx: { tl: gsap.core.Timeline; el: HTMLElement; q: (sel: string) => Element[] }) => void;

/** A timeline scrubbed by a section's scroll, exactly 1 long, so positions read as progress. */
export function chapterTimeline(trigger: Element, start = 'top top', end = 'bottom bottom', scrub: number | boolean = .8) {
  const tl = gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger, start, end, scrub } });
  tl.to({}, { duration: 1 }, 0);
  return tl;
}

/** gsap.set each DOM element's first fromTo start state, so text meant to appear later isn't visible on load. */
const SPECIAL = new Set(['data', 'overwrite', 'parent', 'immediateRender', 'lazy', 'startAt', 'delay', 'stagger', 'duration', 'ease', 'onUpdate', 'onUpdateParams', 'callbackScope', 'runBackwards']);
export function primeDom(tl: gsap.core.Timeline) {
  const seen = new Set<Element>();
  const tweens = (tl.getChildren(true, true, false) as gsap.core.Tween[]).sort((a, b) => a.startTime() - b.startTime());
  for (const t of tweens) {
    const targets = t.targets() as unknown[];
    if (!targets.length || !targets.every(x => x instanceof Element)) continue;
    const fresh = (targets as Element[]).filter(x => !seen.has(x));
    if (fresh.length !== targets.length) continue;
    fresh.forEach(x => seen.add(x));
    const from = t.vars.startAt as gsap.TweenVars | undefined;
    if (!from) continue;
    const vars: gsap.TweenVars = {};
    for (const [k, v] of Object.entries(from)) if (!SPECIAL.has(k)) vars[k] = v;
    gsap.set(fresh, vars);
  }
}

export function Chapter({ id, vh = 300, className, back, front, build, flow = false, onTimeline }: {
  id?: string; vh?: number; className?: string; back?: ReactNode; front?: ReactNode; build?: Build;
  /** content taller than a screen: scrolls normally, its timeline runs from 'top 85%' to its end */
  flow?: boolean;
  onTimeline?: (tl: gsap.core.Timeline) => (() => void) | void;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let off: (() => void) | void;
    const ctx = gsap.context(() => {
      const tl = flow ? chapterTimeline(el, 'top 85%', 'bottom bottom') : chapterTimeline(el);
      build?.({ tl, el, q: gsap.utils.selector(el) });
      primeDom(tl);
      off = onTimeline?.(tl);
    }, el);
    ScrollTrigger.refresh();
    return () => { off?.(); ctx.revert(); };
  }, [build, flow, onTimeline]);

  if (flow) return <section id={id} ref={ref} className={`ch ch--flow ${className ?? ''}`}>{front}</section>;
  return (
    <section id={id} ref={ref} className={`ch ${className ?? ''}`} style={{ height: `${vh}svh` }}>
      <div className="ch__back">{back}</div>
      <div className="ch__front">{front}</div>
    </section>
  );
}
