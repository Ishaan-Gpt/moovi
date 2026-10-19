'use client';
import { useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { gsap, ScrollTrigger } from '@/lib/gsap';
import { chapterTimeline, stageTimeline, addReel, onWorld, animateScene } from '@/lib/world';
import { getScript, scriptVersion, subscribeScript } from '@/lib/scriptStore';
import type { Script } from '@/lib/script';
import type { MooviWorld } from '@moovi/character';

/**
 * Scrubbed tweens only apply their start state once the scroll reaches them, so text meant to appear later would
 * be visible on load. Prime DOM elements only (never the shared 3D scene, which several chapters tween): render
 * the first tween of each element at its start.
 * Mind that a later tween on an element is not primed: give each element its whole story in its first tween,
 * or start the later ones from the state the first one leaves.
 */
const SPECIAL = new Set(['data', 'overwrite', 'parent', 'immediateRender', 'lazy', 'startAt', 'delay', 'stagger', 'duration', 'ease', 'onUpdate', 'onUpdateParams', 'callbackScope', 'runBackwards']);

function primeDom(tl: gsap.core.Timeline) {
  const seen = new Set<Element>();
  const tweens = (tl.getChildren(true, true, false) as gsap.core.Tween[]).sort((a, b) => a.startTime() - b.startTime());
  for (const t of tweens) {
    const targets = t.targets() as unknown[];
    if (!targets.length || !targets.every(x => x instanceof Element && x !== document.documentElement)) continue;
    const fresh = (targets as Element[]).filter(x => !seen.has(x));
    if (fresh.length !== targets.length) continue;
    fresh.forEach(x => seen.add(x));
    // set the fromTo's start values directly: rendering a scrubbed tween before its start reverts it instead
    const from = t.vars.startAt as gsap.TweenVars | undefined;
    if (!from) continue;
    const vars: gsap.TweenVars = {};
    for (const [k, v] of Object.entries(from)) if (!SPECIAL.has(k)) vars[k] = v;
    gsap.set(fresh, vars);
  }
}

/**
 * Every chapter builds when the world arrives, all in the same moment: one refresh for all of them, not one each
 * (each refresh re-measures every trigger on the page; measured: a 1.4 s long task at 4x CPU with one per chapter).
 */
let refreshing = 0;
function refreshSoon() {
  if (refreshing) return;
  refreshing = requestAnimationFrame(() => { refreshing = 0; ScrollTrigger.refresh(); });
}

/**
 * `tl` is scrubbed by this chapter's scroll and holds the DOM. `stage` holds shared state (the scene, `ui`,
 * page colour) and is played by the director, so chapters never fight over it.
 */
export type Build = (ctx: { tl: gsap.core.Timeline; stage: gsap.core.Timeline; el: HTMLElement; q: (sel: string) => Element[]; world: MooviWorld }) => void;

/**
 * A pinned chapter of the film. The section is `vh` tall; its two layers stick to the viewport:
 * `back` paints behind Moovi's world (giant type, environments), `front` paints over it (copy, UI).
 * Scrolling through the section scrubs one timeline that moves the 3D scene (from the script) and the DOM.
 */
export function Chapter({ id, name, vh, className, back, front, build, flow = false }: {
  id?: string; name: keyof Script; vh?: number; className?: string; back?: ReactNode; front?: ReactNode; build?: Build;
  /** content taller than the screen: scrolls normally over the world instead of pinning */
  flow?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  // turning a phone rebuilds the script (portrait and landscape block the scene differently): rebuild with it
  const rev = useSyncExternalStore(subscribeScript, scriptVersion, () => 0);
  useEffect(() => {
    let ctx: gsap.Context | undefined;
    let off: (() => void) | undefined;
    let alive = true;
    // the world loads lazily, so this can run long after mounting: skip it if this effect was cleaned up meanwhile
    onWorld(world => {
      const el = ref.current;
      if (!alive || !el) return;
      ctx = gsap.context(() => {
        const tl = flow ? chapterTimeline(el, 'top 85%', 'bottom bottom') : chapterTimeline(el);
        const stage = stageTimeline();
        animateScene(stage, world.scene, getScript()[name]);
        build?.({ tl, stage, el, q: gsap.utils.selector(el), world });
        primeDom(tl);
        off = addReel(tl.scrollTrigger!, stage);
      }, el);
      refreshSoon();
    });
    return () => { alive = false; off?.(); ctx?.revert(); };
  }, [name, build, flow, rev]);

  if (flow) return <section id={id} ref={ref} className={`ch ch--flow ch--${name} ${className ?? ''}`}>{front}</section>;
  return (
    <section id={id} ref={ref} className={`ch ch--${name} ${className ?? ''}`} style={{ height: `${vh}svh` }}>
      <div className="ch__back">{back}</div>
      <div className="ch__front">{front}</div>
    </section>
  );
}
