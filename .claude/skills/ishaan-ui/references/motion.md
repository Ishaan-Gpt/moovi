# Motion: personality, subtle in/out, text, interaction

Motion is how a premium site breathes. It should explain, reveal and reward, never decorate for its own sake. Intro loaders and page transitions live in `loaders.md`; smooth scroll, pinning, scrubbing and parallax live in `scroll.md`. Drop-in code is in `assets/motion-kit/`.

## Contents
1. Motion personality
2. Subtle in, subtle out
3. Text motion
4. Sections that teach by doing
5. Micro-interactions
6. Ambient motion
7. Performance and pitfalls (read this)

---

## 1. Motion personality
Decide it once, from the concept, and write it down: e.g. "slow, eased, soft blur; jelly overshoot only on things you touch" or "precise and mechanical; no overshoot, hairline wipes".

| Token | Curve | Use |
|---|---|---|
| `--ease` | `cubic-bezier(.22,1,.36,1)` (≈ expo/quart out) | almost everything that enters |
| `--ease-sheet` | `cubic-bezier(.76,0,.24,1)` (in-out) | sheets, curtains, page transitions |
| `--ease-jelly` | `cubic-bezier(.34,1.56,.64,1)` (overshoot) | beads, menus, small buttons, pills |
| GSAP | `expo.out` / `expo.inOut` intro & transitions, `power3.out` text, `power2.inOut` cameras/scenes, `none` inside scrubbed containers | |

Durations: micro 150–300ms; reveals 600–900ms; sheets 450–700ms; intro ≤ 2.5s. Springs (stiffness ~500, damping 30–40) for small sliding indicators.

**Name the vocabulary and reuse it.** Register a handful of named eases (`CustomEase.create('InOut', '.75,0,.25,1')`, `Out` `.25,1,.5,1`, `In` `.5,0,.75,0`, `dive` `.6,0,0,1`), mirror them as CSS variables, and fix three durations (`s .4, m .8, l 1.2`), one stagger (`.1`) and one breakpoint for motion (e.g. 992px). A site with five eases used consistently feels designed; one with twenty feels assembled.

Everything respects `prefers-reduced-motion`: final states, no transforms, no loops, instant typing.

## 2. Subtle in, subtle out
The premium feel comes from *small* distances, soft blur and good easing, and from things also leaving.

**Enter** (once, as content reaches ~12% inside the viewport):
```css
[data-reveal] { opacity: 0; transform: translateY(18px); filter: blur(6px);
  transition: opacity .9s var(--ease), transform .9s var(--ease), filter .9s var(--ease); transition-delay: var(--d, 0ms); }
[data-reveal].is-in { opacity: 1; transform: none; filter: none; }
@media (prefers-reduced-motion: reduce) { [data-reveal] { opacity: 1; transform: none; filter: none; transition: none; } }
```
One `IntersectionObserver` for the page (`rootMargin: '0px 0px -12% 0px'`), add `.is-in`, unobserve; re-scan on route change. Stagger with a CSS variable (`style="--d:120ms"`), 60–120ms apart (`assets/motion-kit/reveal.tsx`).

**Declarative reveal kinds** (a richer GSAP variant): mark elements with `data-reveal="h|a|p|ctn|line"`, group them with `data-reveal-group`, and let one module animate each kind its own way:

| Kind | Split | From → to |
|---|---|---|
| `h` display headings | words, chars | `opacity 0, yPercent 50, rotateY 90` → 0, 1.2s Out, stagger .035 |
| `a` script/accent | chars | `opacity 0, rotateX 90, x 6rem`, origin bottom: letters swing in, stagger .06 |
| `p` body | lines (masked) | lines `yPercent 110 → 0`, stagger .1 |
| `ctn` blocks | none | `opacity 0, y 3.4rem` (2.4rem on phones) |
| `line` hairlines | none | `clipPath inset(0 0 100% 0) → inset(0)`: rules draw in |

Robustness: gate hidden states behind `html.js` (set by the head script) so no-JS visitors see content; add a **safety unhide** (`html.motion-fallback` after ~6s) in case motion never boots; fire the reveal on `onEnter`, `onLeave` *and* `onEnterBack` (once) so anchor jumps and mid-page reloads don't leave content hidden; cache the split on the element so it never re-splits; give split lines `padding-bottom:.06em; margin-bottom:-.06em` so descenders survive.

Values that read as premium: rise 14–24px (never 50+), blur 6–10px, opacity from 0, duration ~.9s. From the side only when it means something (a card entering from the side away from the protagonist, `x: ±60` + blur 10px).

**One-off entrances** (hero after the intro): `gsap.fromTo(els, { opacity: 0, y: 30, filter: 'blur(8px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.2, ease: 'expo.out', stagger: .1, clearProps: 'filter' })`. Always clear `filter` afterwards: a lingering filter creates a containing block, costs GPU and breaks glass inside it.

**Exit** (scrubbed, as the story moves on): fade + rise out (`opacity 0, y: -40..-60`), blur out, roll lines up and out (`yPercent: -160`), scale down and drop (a held object falls away), or merge back into the protagonist. Exits are shorter than entrances (≈60%).

**Panels and art**: scale 1.04 → 1 crossfades when content changes; glass appears with its blur already applied (never animate `backdrop-filter`).

**Values** animate their number: dials sweep, numerals count up (tabular figures), gauges fill.

## 3. Text motion
- **Masked line/word/char rises** (SplitText with `mask`). Pad each mask and pull it back so italics and descenders aren't clipped, and hide letters at `yPercent: ±160` (±110 lets the padding show a sliver):
  ```ts
  const split = SplitText.create(el, { type: 'words,chars', mask: 'chars' });
  for (const m of split.masks) Object.assign(m.style, { padding: '0 .12em .14em', margin: '0 -.12em -.14em' });
  ```
  Stagger chars ~.012–.03s (or ~.003–.012 inside a 0..1 scrubbed timeline). Kit: `assets/motion-kit/gsap.ts`. Without SplitText: wrap each line in `display:block; overflow:clip` and rise an inner span.
- **Ink-fill on scroll**: each word starts pale (`--ink-3`) and fills to the text colour as the line scrolls from ~85% to ~40% of the viewport (`scrub: .6`). Read both colours with `getComputedStyle` (GSAP needs real values); keep real text in the DOM.
- **Word swap**: stack words in one grid cell (`grid-area: 1/1`); the outgoing word rolls up and out as the next rolls in.
- **Typewriter on scroll**: split into words *and* chars (words keep lines from breaking mid-word), reveal chars with a tiny stagger, move a caret along.
- **Headline breathing**: across a whole chapter, a giant word scales 1.18 → .96 while tracking tightens .02em → −.05em.
- **Roll text on hover** (nav, buttons): each char in a clipped cell with a copy below; on hover the column shifts `-100%` with a 16ms per-char delay; label on the wrapper, cells `aria-hidden` (`assets/motion-kit/text.tsx`).
- **Counters** count up once on enter; for real numbers only.
- **Fit-to-width titles**: for giant single-line words, measure and scale `font-size` so the word spans the container exactly (`fontSize *= parentWidth / ownWidth` with `white-space:nowrap; width:max-content`); re-run on resize and when the word changes.
- **Title swaps** in carousels: outgoing chars `opacity 0, yPercent -50, rotateY -90` (.4s In, stagger .02); incoming from `yPercent 50, rotateY 90` (1.2s Out, stagger .035) starting just before the outgoing ends; a `busy` lock prevents overlapping swaps.
- **Text on a curve**: SVG `textPath` along an arc (a moon's rim, a ring around a logo); scrub `word-spacing` so the words spread as you scroll, or rotate the ring on the ticker and let scroll velocity speed it up (and reverse with direction).

## 4. Sections that teach by doing
Use 2–3 per landing page. Each lets the visitor *do* the product's core action, ideally with the real UI:
- **Live re-scoring**: scrolling applies improvements one by one and the real score re-computes and animates; clicking takes manual control ("Back to scroll mode").
- **Typed playground**: lines of a config/brief appear as you scroll; real logic re-evaluates the result per line; lines are clickable.
- **Auto-advancing accordion** while in view, pausing on hover, with a hairline progress bar on the active item.
- **Pass-the-task**: a glowing bead travels between parts of a system (agents, steps), each part reacting as it catches it.
- **Before/after**: a generic output shown failing, then this product's output (keep it honest).
- **Transformations**: the protagonist/object morphs into each format the product makes.
Mobile: drop stickiness if needed, keep interactivity. Reduced motion: show the final state, keep clicks.

## 5. Micro-interactions
Each interactive thing gets one small, characterful behaviour:
- Magnetic primary buttons: the outer shell follows the pointer (~26px max, `power4.out` 1.6s) and the inner label follows less (~14px, 2s), so the layers separate with depth; on leave both return with `elastic.out(1,.3)`. Desktop only. 1px press on `:active`.
- **Circular CTA**: a faint full ring plus two short arcs spinning slowly (24s); on hover each arc's dash grows to half the circumference so together they close the ring.
- **Underlines that collapse** instead of grow on hover (`scaleX(0)` from the right): a quieter, more editorial gesture.
- **Hotspots** on art or canvas: two pulse rings (scale 1 → 2.4, fading, the second delayed), a hand-drawn plus that turns 90° on hover, a glass tooltip that rises in.
- **Auto-advance with the timer visible**: a hairline progress bar that *is* the carousel timer (`scaleX 0→1` over ~6.5s, `onComplete: next`), paused offscreen (IntersectionObserver) and on hover.
- A sliding **bead** behind the active nav item / segmented control / dock item (jelly ease or shared-layout animation).
- Icon medallions that tilt −8deg and scale on card hover; a delete icon whose lid lifts; a compass that turns when its menu opens.
- Cursor-following light inside cards (`radial-gradient` at the pointer).
- Pointer-driven 3D tilt (±2–3deg) on a hero object; mouse only.
- Toggles that pop (scale .8 → 1, jelly); menus that open from their corner (`transform-origin`) with the jelly ease.
- Inputs: focus rings that grow in; an empty submit shakes gently (−8/7/−4px) and focuses instead of doing nothing; drag-over states on drop targets.
- Name tags/tooltips that slide out of glass.
Don't add a custom cursor unless the concept asks for one (a lens, a torch, a brush), and never hide the system cursor on interactive elements.

## 6. Ambient motion
Small, slow, optional:
- Edge glow (an "aurora" conic gradient masked to the screen edges, rotated by animating a registered `@property` angle) faded in for one chapter only.
- Slow Ken Burns on art, floating objects (±6px, 6–9s loops), twinkling stars, drifting clouds; one or two per screen, paused offscreen, off for reduced motion.
- A protagonist's idle (breathing, blinking, gaze following the pointer softly).

## 7. Performance and pitfalls (read this)
- Animate `transform` and `opacity`; blur only briefly. Never animate layout properties, large `box-shadow`s, or `backdrop-filter`.
- **Never animate live SVG filters** (turbulence/displacement/lighting) on large areas; pre-render (`assets.md`).
- **Glass breaks under some ancestors**: an ancestor with `filter`, `opacity < 1`, `mask`, or `backdrop-filter` becomes the backdrop root and the glass inside blurs nothing. Animate the glass element itself, or only transforms on its containers; clear filters after entrances.
- **Body background paints above negative z-index**: a `fixed -z-10` backdrop disappears; use `z-0` for the backdrop and `relative z-10` for content.
- **CSS transitions fight GSAP** on the same property; give each property one owner.
- **Hydration**: values that differ on server and client (floating SVG coordinates, `Date.now()`, locale dates) cause mismatches; round, seed, or compute after mount (`setTimeout(…, 0)` rather than rAF, which pauses in background tabs).
- **Decorative layers must not cover UI**: put overlapping art behind panels and clip/fade it so it never trails into the next section.
- Per-frame code writes transforms/CSS variables only, writes text only when it changes, skips invisible elements, and uses `toFixed` on px strings.
- `will-change` only while animating, on a few elements.
- Reduced motion everywhere.

## Smooth as butter (owner, 2026-10-18, from the motion skill)
- Speed is a curve, never a step. Every move eases out of rest and settles. A "fast → slow → fast" move is one smooth
  speed curve, never plateaus glued together (`v ∝ sin²(πu)·(0.15 + 0.85·sin²(2πu))`, the motion skill's speed-ramp
  ease). A scroll-scrubbed reveal can use the same curve on its progress.
- Blur and shadows must not jump: animate them continuously, or bake them into images. Never toggle a filter at a
  threshold.
- Measure smoothness the way it plays (rAF frame gaps over the whole sequence), not in a synchronous loop.
- Camera and parallax by moment: ishaan-motion `references/camera.md`.

## Soft fields and blur-in type (from the Launch films, 2026-10-18)
- A premium calm background is a few big radial blobs drawn into a tiny canvas (160×90) and scaled up, drifting
  slowly. No CSS blur filter on a full-screen layer, no video. On the web the same look is a small `<canvas>` scaled up
  with `image-rendering: auto`, or 3–4 absolutely positioned radial gradients animated with transforms only.
- Small type can carry a hero when each word drifts in from the right (12–16 px) out of a short blur (opacity and a
  pre-blurred layer, not a live `filter: blur()` on many nodes), one word every 0.25–0.3 s.
- A transition by focus: the next layer sharpens in while the old one softens away; motivated by light or focus,
  never a plain cross-dissolve of two pictures.
