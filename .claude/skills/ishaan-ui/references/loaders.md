# Loaders and transitions: first impression, continuity, waiting

Three moments where most sites feel cheap: the first paint, moving between pages, and waiting for data. Each should speak the concept's language (`concept.md` §4) and never cost the visitor time. Drop-in code is in `assets/motion-kit/`.

## Contents
1. The intro loader
2. Page transitions
3. Route and component loading
4. Pitfalls

---

## 1. The intro loader

**Job**: a branded first impression that tells the metaphor in 2–3 seconds, plays **once per session**, and never blocks a repeat visitor or a reduced-motion user.

### Decide before first paint
An inline script in `<head>` sets `html[data-intro]` before the body paints: `long` (first visit this session), `short` (repeat visit: play only the exit), or `none` (reduced motion, a `?shot=` QA mode, or storage blocked). It also adds `html.js` and, after ~6s, `html.motion-fallback` to unhide everything if motion never boots. CSS hides the overlay for `none`/`done`. No flash, no hydration mismatch. Code: `introGateScript` in `assets/motion-kit/intro-gate.ts`.
```tsx
<html lang="en" suppressHydrationWarning>
  <head><script dangerouslySetInnerHTML={{ __html: introGateScript }} /></head>
```
The script fails safe to `none` (private mode can throw on storage). `suppressHydrationWarning` is needed because the attribute changes before React hydrates. Server and client render the same overlay markup; CSS decides visibility.

### Choreograph the concept, not a spinner
Build it as one timeline (≈2–2.5s), drawing the brand mark like a construction drawing:
- guides/dashes fade and scale in (stagger ~.08s);
- the mark draws on (`pathLength={1}`, `stroke-dasharray:1; stroke-dashoffset:1` → 0, ~1.1s, in-out);
- details pop (scale .4 → 1; SVG children need `transform-box: fill-box`);
- a counter or caption that belongs to the world (a timecode, coordinates, a date, a percentage only if real progress);
- a two-line status that flips ("Getting ready" → "Action.") by moving a column `yPercent:-100` inside a one-line clip.

Examples by world: a lens opening, film leader with a timecode, a stamp pressed, ink pouring, a night sky fading up star by star, a dial sweeping.

### Exit: reveal the page *through* the mark
Mask the overlay with a radial hole driven by a CSS variable and tween the variable:
```css
.intro { --hole: 0vmax; mask-image: radial-gradient(circle at 50% 46%, transparent var(--hole), #000 calc(var(--hole) + 1px)); }
```
```ts
tl.to(el, { '--hole': '160vmax', duration: 1, ease: 'expo.inOut' }, 2.15)
  .add(revealIntro, 2.45)   // 'intro:reveal' before the hole finishes, so the hero entrance overlaps
  .add(finishIntro);        // session flag, data-intro="done", unlockScroll('intro'), 'intro:done'
```
**Variant: an iris that rises** (two variables): `radial-gradient(circle at 50% var(--y,118vh), transparent var(--r,0px), #000 calc(var(--r) + 1px))`. Start the hole small and below the fold, raise it to mid-screen (`--y: 52vh`, `--r: 17vw`) like a moon rising, then dive it open (`--r: 160vmax`, a steep in-out ease) while the hero art scales from .82 to 1 behind it (a camera push-in through the window). If the loader shows a "progress" shape (a moon filling), be honest that it's timed unless it reads real progress.

**Three lengths, decided before paint**: `long` on a first visit, `short` (just the exit) on repeat visits in the session, `none` for reduced motion or screenshot/QA modes (`?shot=`). Fire two events: `intro:reveal` when the page starts showing (start the hero text) and `intro:done` at the end (unlock scroll); listeners must be idempotent.

Other exits: the overlay splits like curtains, the mark scales up until its counter-space becomes the viewport, a sheet lifts with a curved edge.

### The contract other components rely on
Anything that should enter *after* the intro checks whether it already happened, so it works when the intro is skipped or short (`afterIntro(fn)` in the kit):
```ts
const d = document.documentElement.dataset.intro;
if (d === 'done' || d === 'none') enter();
else window.addEventListener('intro:reveal', enter, { once: true });   // make enter() idempotent
```
Hide first-screen extras until then with CSS: `html:not([data-intro="done"]) .scroll-cue { opacity: 0 }`.

### Lock scroll correctly
Lock only while the intro plays, with a **lock counter** (or separate classes per owner) so another component toggling its own lock (a mobile menu) can't undo it, and stop the smooth-scroll instance *after* it exists (create Lenis before the intro starts, or wait for a "scroll-ready" event). See `lockScroll/unlockScroll` in `assets/motion-kit/intro-gate.ts`. Hide the intro in print.

## 2. Page transitions

**Job**: continuity and a sense of place, **without slowing navigation**. Same vocabulary as the intro, different shape. Kit: `assets/motion-kit/page-transition.tsx`.

- Intercept internal link clicks in the capture phase; skip modified clicks, non-left buttons, `target=_blank`, downloads, other origins and same-path hash links. **Navigate immediately** (`router.push`); the animation dresses the wait, it never adds to it.
- A canvas-coloured sheet rises with a curved leading edge (animate an elliptical `border-radius` from `50% 50% 0 0 / 22vh 22vh 0 0` to 0), showing the destination's name in the display face (from `data-label` on the link or a route map).
- When the pathname changes, keep it up for a short minimum (~420ms from the click, so it never just flashes), then lift it with a curved trailing edge.
- If loading is slow (~900ms), switch to a looping "waiting" state (a bead travelling a hairline, "Loading…" in the world's voice): the transition becomes the loader.
- Treat "the route changed away from where the click happened" as arrival, so redirects also lift it. Add a long safety timeout and **clear it** when the sheet lifts.
- On arrival: scroll to top immediately (through the smooth-scroll instance too), then to the hash after layout (~450ms).
- **Prefetch on intent**: `pointerenter`, `focusin`, `touchstart` on internal links.
- Reduced motion: navigate with no sheet.

## 3. Route and component loading (never a blank screen)
- **Route skeletons in the page's own shape** (same panes, cards, list rows; shimmer) plus a small brand-object line ("Opening your studio…").
- **Async work in a tool**: a "working" checklist where steps go next → in progress → done, paced while the request runs; the protagonist can act it out.
- **Buttons**: spinner + present-tense verb ("Saving…"), disabled while busy; never a dead click.
- **Lazy sections**: placeholder of the final size; fade in when ready (`performance.md`).
- **Optimistic UI** where safe; graceful errors with retry, in the brand's voice.

## 4. Pitfalls
- Two components toggling one shared lock class: the second undoes the first. Use a counter or per-owner classes.
- Calling the smooth-scroll API before it's created is a silent no-op.
- Fallback timers that are never cleared fire during a later transition.
- An intro that plays on every navigation or every visit: gate it per session.
- Blocking the hero's content until the intro ends; let the hero entrance overlap the exit.
- Print: hide every overlay (intro, sheet, canvas, rails) by their actual class names.
