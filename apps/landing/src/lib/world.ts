'use client';
import type { MooviWorld, WorldScene } from '@moovi/character';
import { gsap, type ScrollTrigger } from './gsap';

/**
 * One world for the whole page. Chapters never talk to the renderer directly: they tween `world.scene`
 * (3D) and `ui` (DOM-side values the stage reads every frame, e.g. label opacity, aurora).
 */
let world: MooviWorld | null = null;
const waiting: Array<(w: MooviWorld) => void> = [];

export function setWorld(w: MooviWorld | null) {
  world = w;
  if (w) waiting.splice(0).forEach(fn => fn(w));
}
export function onWorld(fn: (w: MooviWorld) => void) { if (world) fn(world); else waiting.push(fn); }
export function getWorld() { return world; }

export const ui = {
  labels: 0,                       // crew name tags visible (0..1)
  sub: ['', '', '', '', ''],       // a line under each name tag (role, or the event it just handled)
  aurora: 0,                       // edge glow (0..1)
  hover: 0,                        // can Moovi be hovered to wave (only where the page invites it)
  halo: null as HTMLElement | null, // an element kept centred on Moovi's halo ring, sized to it (memory chapter)
  only: -1,                        // on narrow screens, show just this crew member's tag (-1: all, names only)
  grip: null as HTMLElement | null, // a box Moovi holds out front (hero): docked under his eyes, his hands on its ends
  screen: null as HTMLElement | null, // what plays on him while he is a screen (problem): pinned to the screen's face
};

export const CREW = ['Scribe', 'Cutter', 'Beat', 'Lens', 'Keeper'] as const;

/* ───────────── the film script: keyframes as diffs, merged into full snapshots ───────────── */

type DeepPartial<T> = { [K in keyof T]?: T[K] extends (infer U)[] ? Partial<U>[] : T[K] extends object ? DeepPartial<T[K]> : T[K] };
export type SceneDiff = DeepPartial<WorldScene>;

export function clone(s: WorldScene): WorldScene { return JSON.parse(JSON.stringify(s)); }

export function merge(base: WorldScene, d: SceneDiff): WorldScene {
  const out = clone(base);
  for (const k of Object.keys(d) as (keyof WorldScene)[]) {
    const v = d[k] as unknown;
    if (k === 'crew' && Array.isArray(v)) v.forEach((c, i) => { if (c) Object.assign(out.crew[i]!, c); });
    else if (typeof v === 'object' && v !== null) Object.assign(out[k] as object, v);
    else (out as unknown as Record<string, unknown>)[k] = v;
  }
  return out;
}

/** Lateral scale for narrow (portrait) screens: the cast stands closer together. */
export const xs = () => (typeof window !== 'undefined' && window.innerWidth / window.innerHeight < 1 ? .5 : 1);

/**
 * Add tweens to a (scrubbed) timeline that move the whole scene from keyframe to keyframe.
 * `keys` are [progress 0..1, full snapshot, groups?]. Each group (camera, Moovi, …) moves between the keys that
 * name it: every key, except "through" keys, which only name the groups in their diff. Every tween is
 * fromTo + immediateRender:false so scrubbing backwards and loading mid-page both land on exact values.
 */
export function animateScene(tl: gsap.core.Timeline, scene: WorldScene, keys: [number, WorldScene, Set<string>?][], ease = 'power2.inOut') {
  const track = (g: string, add: (a: WorldScene, b: WorldScene, t0: number, dur: number) => void) => {
    const ks = keys.filter((k, i) => i === 0 || !k[2] || k[2].has(g));
    for (let i = 0; i < ks.length - 1; i++) {
      const [t0, a] = ks[i]!, [t1, b] = ks[i + 1]!;
      add(a, b, t0, Math.max(.0001, t1 - t0));
    }
  };
  const groups: (keyof WorldScene)[] = ['cam', 'moovi', 'look', 'halo', 'morph', 'orb', 'floor', 'word'];
  for (const g of groups) track(g, (a, b, t0, duration) => tl.fromTo(scene[g] as object, { ...(a[g] as object) }, { ...(b[g] as object), duration, ease, immediateRender: false }, t0));
  track('crew', (a, b, t0, duration) => a.crew.forEach((c, j) => tl.fromTo(scene.crew[j]!, { ...c }, { ...b.crew[j]!, duration, ease, immediateRender: false }, t0)));
  track('split', (a, b, t0, duration) => tl.fromTo(scene, { split: a.split }, { split: b.split, duration, ease, immediateRender: false }, t0));
  return tl;
}

/** A timeline scrubbed by a pinned chapter (the section is tall; its layers are sticky). DOM only. */
export function chapterTimeline(trigger: Element, start = 'top top', end = 'bottom bottom') {
  const tl = gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger, start, end, scrub: .8 } });
  tl.to({}, { duration: 1 }, 0); // the chapter's timeline is exactly 1 long, so positions read as progress
  return tl;
}

/** A chapter's paused timeline for shared state (the 3D scene, `ui`, page colour). Only the director plays it. */
export function stageTimeline() {
  const tl = gsap.timeline({ paused: true, defaults: { ease: 'none' } });
  tl.to({}, { duration: 1 }, 0);
  return tl;
}

/* ───────────── the director ─────────────
 * Every chapter animates the same scene. If each chapter's scrubbed timeline wrote to it, a chapter still
 * catching up after a fast scroll could overwrite the next one. So one director renders exactly one chapter's
 * stage per frame: the chapter under the (smoothed) scroll position. When the active chapter changes, every
 * chapter in between is settled in order, so state that a later chapter never touches is still right. */
interface Reel { range: ScrollTrigger; stage: gsap.core.Timeline }
const reels: Reel[] = [];
let active: Reel | null = null;
let smoothY = -1;
let running = false;

export function addReel(range: ScrollTrigger, stage: gsap.core.Timeline) {
  const reel = { range, stage };
  reels.push(reel);
  if (!running) { running = true; gsap.ticker.add(tick); }
  return () => {
    reels.splice(reels.indexOf(reel), 1);
    if (active === reel) active = null;
    if (!reels.length) { running = false; gsap.ticker.remove(tick); }
  };
}

function tick() {
  const y = window.scrollY;
  const dt = gsap.ticker.deltaRatio(60) / 60;
  // ~0.3s ease-out behind the scroll, like the DOM's scrub; big jumps (anchor loads) cut straight there
  if (smoothY < 0 || Math.abs(y - smoothY) > window.innerHeight * 6) smoothY = y;
  else smoothY += (y - smoothY) * (1 - Math.exp(-dt / .1));
  if (Math.abs(y - smoothY) < .5) smoothY = y;
  direct(smoothY);
}

function direct(y: number) {
  if (!reels.length) return;
  reels.sort((a, b) => a.range.start - b.range.start);
  let i = 0;
  reels.forEach((r, k) => { if (r.range.start <= y) i = k; });
  const was = active ? reels.indexOf(active) : -1;
  if (was !== i) {
    if (was < i) for (let k = Math.max(0, was); k < i; k++) reels[k]!.stage.progress(1);
    else for (let k = was; k > i; k--) reels[k]!.stage.progress(0);
    active = reels[i]!;
  }
  const { start, end } = active!.range;
  active!.stage.progress(gsap.utils.clamp(0, 1, end > start ? (y - start) / (end - start) : 1));
}
