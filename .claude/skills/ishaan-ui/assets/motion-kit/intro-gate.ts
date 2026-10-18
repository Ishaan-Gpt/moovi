/*
 * Ishaan UI motion kit · intro gate and scroll lock.
 *
 * 1. Put `introGateScript` in <head> (before the body paints):
 *      <html lang="en" suppressHydrationWarning>
 *        <head><script dangerouslySetInnerHTML={{ __html: introGateScript }} /></head>
 *    It sets html[data-intro] to "long" (first visit this session), "short" (repeat visit) or "none"
 *    (reduced motion, ?shot= QA mode, or storage blocked), adds html.js, and unhides everything after 6s
 *    if motion never boots (html.motion-fallback). CSS in kit.css hides the intro when data-intro="none".
 * 2. The intro component plays its timeline, then calls `finishIntro()`.
 * 3. Anything that enters after the intro uses `afterIntro(fn)`.
 */

export const INTRO_KEY = 'intro-seen';

export const introGateScript = `(function(){var d=document.documentElement;d.classList.add('js');try{var q=location.search.indexOf('shot=')>-1;var r=matchMedia('(prefers-reduced-motion: reduce)').matches;d.dataset.intro=(q||r)?'none':(sessionStorage.getItem('${INTRO_KEY}')?'short':'long')}catch(e){d.dataset.intro='none'}setTimeout(function(){d.classList.add('motion-fallback')},6000)})();`;

/** Run `fn` once the intro has revealed the page (immediately if it already has, or never played). */
export function afterIntro(fn: () => void, event: 'intro:reveal' | 'intro:done' = 'intro:reveal') {
  const d = document.documentElement;
  if (d.dataset.intro === 'none' || d.dataset.intro === 'done') { fn(); return () => {}; }
  let ran = false;
  const once = () => { if (!ran) { ran = true; fn(); } };
  window.addEventListener(event, once, { once: true });
  window.addEventListener('intro:done', once, { once: true });   // safety: done always implies revealed
  return () => { window.removeEventListener(event, once); window.removeEventListener('intro:done', once); };
}

/** Call when the page starts showing through the intro (hero text can begin). */
export function revealIntro() { window.dispatchEvent(new Event('intro:reveal')); }

/** Call at the very end of the intro. */
export function finishIntro() {
  try { sessionStorage.setItem(INTRO_KEY, '1'); } catch { /* private mode */ }
  document.documentElement.dataset.intro = 'done';
  unlockScroll('intro');
  window.dispatchEvent(new Event('intro:done'));
}

/*
 * Scroll lock with owners. Two components toggling one shared class undo each other (an intro locks, a
 * menu's effect runs with "closed" and unlocks). Each owner adds/removes its own name; the page is locked
 * while any owner holds it. Smooth scroll is stopped too, if it exists yet (smooth-scroll.tsx re-applies
 * the lock when it is created).
 */
const owners = new Set<string>();
type LenisLike = { stop: () => void; start: () => void };
const lenis = () => (window as unknown as { __lenis?: LenisLike }).__lenis;

export function lockScroll(owner: string) {
  owners.add(owner);
  document.documentElement.classList.add('is-locked');
  lenis()?.stop();
}
export function unlockScroll(owner: string) {
  owners.delete(owner);
  if (owners.size) return;
  document.documentElement.classList.remove('is-locked');
  lenis()?.start();
}
export const isScrollLocked = () => owners.size > 0;
