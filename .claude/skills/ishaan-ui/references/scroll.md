# Scroll: smooth scroll, triggered and scrubbed sections, parallax, chapters

The mechanics behind story sites (`storytelling.md` is the narrative). GSAP (ScrollTrigger, SplitText) + Lenis is the default stack; Motion's `useScroll` works for simpler React pages. Use one scroll engine, not several. Drop-in code is in `assets/motion-kit/`.

## Contents
1. Smooth scroll (Lenis + GSAP on one clock)
2. Triggered vs scrubbed
3. Pinned chapters with CSS sticky
4. A chapter's timeline, normalised to 0..1
5. Shared state across chapters: the director
6. Keyframe scripts and "through" keys
7. Derived state, page colour, CSS-variable driven components
8. Parallax
9. Other scroll devices
10. Responsiveness, resize and rotation
11. Pitfalls

---

## 1. Smooth scroll (Lenis + GSAP on one clock)
```ts
if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;   // native scroll for reduced motion
const lenis = new Lenis({ duration: 1.15, easing: t => 1 - Math.pow(1 - t, 4), smoothWheel: true });
window.__lenis = lenis;
lenis.on('scroll', ScrollTrigger.update);
const tick = (time: number) => lenis.raf(time * 1000);   // gsap ticker is in seconds
gsap.ticker.add(tick);
gsap.ticker.lagSmoothing(0);                              // no catch-up jumps after a stalled frame
return () => { gsap.ticker.remove(tick); lenis.destroy(); delete window.__lenis; };
```
Required CSS: `html.lenis, html.lenis body { height: auto } .lenis.lenis-smooth { scroll-behavior: auto !important } .lenis.lenis-stopped { overflow: clip }`.
- Lenis, ScrollTrigger and any custom per-frame code share `gsap.ticker`: one rAF.
- Anchor scrolling goes through Lenis (`lenis.scrollTo(el, { duration: 1.6 })`) with a native fallback.
- Stop Lenis while a modal/menu/intro is open; restart after. Keep keyboard scrolling and focus scrolling working.
- Touch devices keep native touch scrolling (Lenis default); don't hijack momentum.

## 2. Triggered vs scrubbed
- **Triggered** (plays once when it enters): reveals, counters, small sequences. Use `IntersectionObserver` + CSS (`[data-reveal]`, see `motion.md`) or `ScrollTrigger` with `toggleActions: 'play none none none'`. Cheapest and calmest.
- **Scrubbed** (progress tied to scroll position): chapters, camera moves, morphs, text that inks in. `scrub: .6–1` adds a smoothing lag that feels expensive; `scrub: true` feels mechanical.
- A premium page mixes both: scrubbed chapters for the story, triggered reveals for flowing content.

## 3. Pinned chapters with CSS sticky
Sticky pinning (no `pin: true`, no pin-spacer, no layout jumps):
```css
.ch { position: relative; }                                  /* height inline, e.g. style="height:300svh" */
.ch__back, .ch__front { position: sticky; top: 0; height: 100svh; overflow: clip; }
.ch__back  { z-index: 1; }                                   /* giant type, environments */
.ch__front { z-index: 3; margin-top: -100svh; pointer-events: none; }   /* copy, UI */
.ch__front :is(a, button, input, textarea, select, label, form) { pointer-events: auto; }
.ch--flow { position: relative; z-index: 3; }                /* long content scrolls normally */
```
- `overflow: clip`, never `hidden` (hidden creates a scroll container and breaks sticky). Use `overflow-x: clip` on body for the same reason.
- If a persistent protagonist exists, a fixed canvas at z-index 2 sits between back and front (`3d.md` §2).
- Heights in `svh` (stable with mobile URL bars). 200–350svh per chapter; long, step-heavy chapters up to ~600svh.

## 4. A chapter's timeline, normalised to 0..1
```ts
function chapterTimeline(trigger: Element, start = 'top top', end = 'bottom bottom') {
  const tl = gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger, start, end, scrub: .8 } });
  tl.to({}, { duration: 1 }, 0);   // exactly 1 long: every position reads as progress
  return tl;
}
tl.fromTo(title, { yPercent: 160 }, { yPercent: 0, duration: .12, ease: 'power3.out', immediateRender: false }, .46);
tl.fromTo(title, { opacity: 1, y: 0 }, { opacity: 0, y: -60, duration: .08, immediateRender: false }, .92);  // the exit
```
- **Every tween is `fromTo` with `immediateRender: false`**: scrubbing backwards and loading mid-page land on exact values, and later tweens don't stamp their start state at build time.
- **Prime the DOM**: scrubbed `fromTo` doesn't apply its from-state until the scroll reaches it, so text meant to appear later is visible on load. After building, walk the timeline's tweens in start order and `gsap.set` each element's *first* tween's from-values (`primeDom` in `assets/motion-kit/chapter.tsx`). Give each element its whole story in its first tween, or start later tweens from where the first left it.
- Build inside `gsap.context(() => …, el)` and `ctx.revert()` on cleanup (React StrictMode mounts twice).
- Choreography spacing: hold ~5–10% at the start and end of each chapter; busiest part in the middle.

## 5. Shared state across chapters: the director
If several chapters animate the same thing (a canvas scene, a protagonist, a page colour), letting each chapter's scrubbed timeline write to it causes fights: after a fast scroll, a chapter still catching up overwrites the next one. Instead:
- Each chapter builds two timelines: `tl` (scrubbed, its own DOM only) and `stage` (paused, shared state).
- One ticker function, the **director**, renders exactly one chapter's `stage` per frame: the chapter under a smoothed scroll position (`smoothY += (y - smoothY) * (1 - exp(-dt / .1))`, snapping on big jumps). When the active chapter changes, it settles every chapter in between in order (`progress(1)` going forward, `progress(0)` going back), so state a later chapter never touches is still right.
- Kit: `assets/motion-kit/director.ts`. Only add it when shared state exists; simple pages don't need it.

## 6. Keyframe scripts and "through" keys
For a protagonist with many parameters (camera, pose, morph), write choreography as data:
- Each key is `[progress, snapshot]`; each snapshot is the previous one merged with a small diff, so each chapter starts exactly where the last ended.
- One tween per parameter group per segment (`fromTo` between consecutive keys, `power2.inOut`).
- A normal key holds every group at that moment. A **through key** only keys the groups named in its diff, so a gesture can change mid-chapter while the camera keeps gliding between its own keys. Naming a group in a through key holds it still until then.
- Generate repetitive choreography with helpers (visit each of five items, hop an object along a line) instead of hand-typing keys; share timing constants between the script and the DOM so text lands with the action.
- Build the script on the client (it may depend on the viewport) and **rebuild on orientation/aspect change**.

## 7. Derived state, page colour, CSS-variable driven components
- Derive UI values from a chapter's progress in `onUpdate` with small `ramp(a, b, p)` helpers (labels fade while the camera visits something); write them to one shared `ui` object the frame loop reads.
- Discrete flags as tiny tweens (`stage.fromTo(ui, { hover: 0 }, { hover: 1, duration: .01 }, .05)`).
- **Page colour**: `html, body { background: var(--page) }` and tween `--page` per chapter. Fade any hero gradient into the page colour before the next chapter so no seam shows.
- **Components driven by one variable**: tween `--on` 0→1 and derive several properties in CSS (`background: rgb(255 255 255 / calc(.5 + .5 * var(--on)))`, `box-shadow: 0 0 0 calc(var(--on) * 2px) var(--accent)`).

## 8. Parallax
- **Layered depth**: 3–5 layers (sky, far ridge, near ridge, foreground, copy) with different scroll speeds: `gsap.to(layer, { yPercent: -k * 20, ease: 'none', scrollTrigger: { trigger: section, start: 'top bottom', end: 'bottom top', scrub: true } })`, k growing toward the viewer. Copy moves least or not at all.
- **Pointer parallax** on hero layers: ±6–12px translate per layer from the pointer, smoothed (lerp ~.08 per frame); desktop only; off for reduced motion.
- **Scale parallax**: art panels scale 1.08 → 1 as they enter; images inside a clipped frame move opposite to the scroll.
- Keep parallax subtle; large offsets read as gimmicky and cause overlaps on phones.

## 9. Other scroll devices
- **Sticky hero that dives**: a 220–300vh hero with a sticky 100svh stage; words rise faster than the sky (`yPercent -90` vs `-8`) for depth, captions fade early, then the sky scales up toward the horizon (`scale 2`, origin at the horizon) and the foreground ridge drops away.
- **Giant shapes as transitions**: a disc 170–260vw wide (a moon, a planet, a drop) rides in over the end of the previous section (negative top margin so it overlaps), scrubbed `yPercent 18 → 0`; the next section's surface is that shape's colour. Also: a sheet of paper sliding up, a horizon line rising.
- **Image parallax in a clipped frame**: wrapper `overflow:hidden`; the image is ~118% tall, offset `-8%`, and scrubbed `yPercent -9 → 9` from `top bottom` to `bottom top` (`scrub .5`).
- **Drifting ornaments**: `[data-drift="70"]` elements float `y: 70 → -70` across their parent's scroll; negative values drift the other way.
- **Chrome that changes tone with the section under it**: sections carry `data-bg="dark|light|…"`; each fixed piece of chrome gets its own triggers at *its own* vertical centre (`start: () => 'top top+=' + cy`) and sets `data-tone` on enter/enterBack/refresh, so the logo and the nav flip exactly as each boundary crosses them, with a 700ms colour transition.
- **Phone chrome hides on scroll down and returns on scroll up** (with ~4px hysteresis so it doesn't jitter), always visible near the top.
- **Horizontal track** (desktop only; a vertical stack on phones):
  ```ts
  const dist = () => track.scrollWidth - innerWidth;
  const tween = gsap.to(track, { x: () => -dist(), ease: 'none', scrollTrigger: { trigger: el, start: 'top top', end: () => `+=${dist()}`,
    pin: true, scrub: true, invalidateOnRefresh: true, anticipatePin: 1 } });
  // reveals and path draws inside use { containerAnimation: tween, start: 'left 85%' }
  ```
  A route line drawn across the track: an SVG path with `preserveAspectRatio="none"` and `vector-effect: non-scaling-stroke`, `strokeDashoffset` scrubbed to 0.
- **Image-sequence scrub**: frames drawn to a canvas by progress; preload progressively; cap DPR.
- **Masked text reveals by scroll**: line masks that rise as the section enters; ink-fill on words (`motion.md`).
- **Sticky step story**: list of steps on one side (active expands, others dim), a stage on the other that changes per step; auto-advance while in view if not scrubbed.
- **Scroll to a point inside a pinned chapter** (e.g. clicking a pill): `y = el.offsetTop + p * (el.offsetHeight - innerHeight)`, then `lenis.scrollTo(y)`.
- **Position chrome**: an active-section bead in the nav, a progress rail/timecode driven by `scrollY / (scrollHeight - innerHeight)` (use container-query units, `cqh`, for a rail's playhead).

## 10. Responsiveness, resize and rotation
- Re-block, don't squash: one portrait block per chapter repositions DOM (bottom-anchored cards, hidden extras, vw sizes), and the script re-blocks the 3D/camera for portrait.
- `ScrollTrigger.refresh()` after fonts load and after async content changes heights.
- Rebuild viewport-dependent scripts on orientation change (or on aspect crossing 1).
- Mobile can drop stickiness for very dense chapters; keep the interactivity.

## 11. Pitfalls
- `overflow: hidden` on an ancestor of a sticky element breaks the pin.
- Scrubbed `from()` / `to()` without `fromTo` + `immediateRender:false` give wrong states when loading mid-page or scrubbing back.
- Two timelines writing one property: use the director, or give each property one owner.
- CSS transitions on properties GSAP drives fight it (remove the transition, or use it only on the resting state).
- Leaving `filter: blur()` on elements after an entrance: `clearProps: 'filter'`.
- Tall full-page screenshots distort vh-based scenes; verify at real viewport sizes (`verify.md`).
- Reduced motion: final states, no scrub transforms, content and interactivity intact.
