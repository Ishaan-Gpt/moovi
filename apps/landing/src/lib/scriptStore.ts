'use client';
import type { Script } from './script';

/**
 * The script depends on the viewport shape (portrait screens bring the cast closer), so it is built on the client,
 * and rebuilt when the screen turns between portrait and landscape: subscribers (the chapters) then rebuild their
 * stage timelines from it.
 *
 * The builder arrives with the lazily loaded world (WorldStage imports `./script` next to `MooviWorld`), so the
 * keyframes and the character package stay out of the first bundle. Only call `getScript()` inside `onWorld()`.
 */
let build: (() => Script) | null = null;
let script: Script | null = null;
let portrait: boolean | null = null;
let version = 0;
const listeners = new Set<() => void>();

const isPortrait = () => window.innerWidth / window.innerHeight < 1;

export function setScriptBuilder(fn: () => Script) { build = fn; }

export function getScript(): Script {
  if (!build) throw new Error('getScript() before the world loaded: call it inside onWorld()');
  if (!script) { script = build(); portrait = isPortrait(); }
  return script;
}

/** Bumps on every rebuild (portrait ↔ landscape); a dependency for effects that bake the script in. */
export const scriptVersion = () => version;

let timer = 0;
function onResize() {
  window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    if (!script || isPortrait() === portrait) return;
    script = null;   // rebuilt on the next getScript(), at the new shape
    version++;
    listeners.forEach(fn => fn());
  }, 150);
}

export function subscribeScript(fn: () => void) {
  if (!listeners.size) window.addEventListener('resize', onResize);
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
    if (!listeners.size) { window.removeEventListener('resize', onResize); window.clearTimeout(timer); }
  };
}
