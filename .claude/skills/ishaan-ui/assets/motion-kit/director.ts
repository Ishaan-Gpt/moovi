/*
 * Ishaan UI motion kit · the director: one owner for state that several chapters animate.
 *
 * Use it only when chapters share something (a canvas scene, a protagonist's pose, a page colour).
 * Each chapter builds a paused `stage` timeline (exactly 1 long) for the shared state and registers it with
 * its ScrollTrigger. Every frame the director renders exactly one stage: the chapter under a smoothed scroll
 * position. When the active chapter changes, every chapter in between is settled in order, so state a later
 * chapter never touches is still right, and a chapter still catching up after a fast scroll can't overwrite
 * the next one.
 *
 *   const stage = stageTimeline();
 *   stage.fromTo(document.documentElement, { '--page': '#f7fafd' }, { '--page': '#ddedf9', duration: .2, immediateRender: false }, .2);
 *   const off = addReel(tl.scrollTrigger!, stage);   // in the Chapter's onTimeline; return off for cleanup
 */
import { gsap } from './gsap';

/** A paused timeline exactly 1 long, for shared state. Only the director plays it. */
export function stageTimeline() {
  const tl = gsap.timeline({ paused: true, defaults: { ease: 'none' } });
  tl.to({}, { duration: 1 }, 0);
  return tl;
}

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
    if (!reels.length) { running = false; gsap.ticker.remove(tick); smoothY = -1; }
  };
}

function tick() {
  const y = window.scrollY;
  const dt = gsap.ticker.deltaRatio(60) / 60;
  // ~0.3s frame-rate-independent ease behind the scroll (like the DOM's scrub); big jumps cut straight there
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
