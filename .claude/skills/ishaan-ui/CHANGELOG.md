# Changelog
- 2.1.7 (2026-10-18): components.md logo lockup: word plus mark beside it, matching face, no plate; never forced into a letter (Ishaan, Moovi).
- 2.1.6 (2026-10-18): components.md waits, hand-offs and results: never ask twice, the brand mark as every loader (stepped, no spin), logo = favicon, no header plates over the hero, results alone in glass (Ishaan, Moovi).
- 2.1.5 (2026-10-18): components.md words on a live set: names at rest, a line only while working, never label a stand-in on screen (Ishaan, Moovi office).
- 2.1.4 (2026-10-18): 3d.md in a product UI: frame for the free area beside panels, ship the phone version in the same pass, gooey furniture (Ishaan, Moovi office).
- 2.1.3 (2026-10-18): components.md hero prompt box: a few distinct modes are visible chips on the box, never a menu; each says what it needs (Ishaan, Moovi landing).
- 2.1.2 (2026-10-18): motion.md soft fields, blur-in type, focus transitions (from the Launch films).
- 2.1.1 (2026-10-18): motion.md "smooth as butter": speed is a curve, never a step; no toggled filters; measure in rAF playback; camera by moment in ishaan-motion references/camera.md.

## 2.0.0 — 2026-10-13
Distilled from two more builds: the Moovi landing (a scroll-scrubbed film starring a WebGL character) and the Luna landing (an editorial night sky drawn from real star data).
- **Concept**: new `concept.md`, the fifth-idea method (write five concepts, build the fifth), concept tests, a derivation table that carries one concept through every surface, worked examples across very different worlds, and an explicit no-clones rule.
- **Story**: new `storytelling.md`: story beats, a persistent protagonist, features as scenes, pacing and spaciousness, two-voice copy vs eyebrow tags, domain language, mobile and reduced-motion versions.
- **Motion split into three**: `loaders.md` (intro decided before paint with long/short/none, iris exits, owner-based scroll lock, navigate-first page transitions), `scroll.md` (Lenis on GSAP's clock, triggered vs scrubbed, CSS-sticky chapters, 0..1 timelines, primeDom, the director, keyframe scripts with "through" keys, parallax, horizontal tracks, giant-shape transitions, tone-switching chrome), `motion.md` (named vocabulary, subtle in/out, declarative reveal kinds, text motion, micro-interactions, ambience, pitfalls).
- **New references**: `performance.md` (budgets, lazy-loading waves, resilience, measuring), `3d.md` (only when the concept needs it), `verify.md` (frame-by-frame review).
- **Updated**: taste (two majors + an accent with a reason, palette as chapters, variable font axes, screen-unit scale, space as the premium signal, expanded anti-slop list), intake (protagonist, story appetite, concept sheet), paths (Path C: beautify), components (hero prompt box, story chrome, circular CTA, working logo object, device frames, desktop gate, credits, real-data captions), assets (type as art, real-data canvas craft, layered silhouettes, swap-ready art), checklist (concept, story, performance sections).
- **Motion kit** (`assets/motion-kit/`): typechecked React/Next + GSAP + Lenis building blocks: intro gate and scroll lock, smooth scroll, reveals (CSS and GSAP kinds), pinned chapters with primeDom, director, page transitions, roll/fill/fit text, kit CSS. Fixes bugs found in the source sites (a scroll lock undone by another component, an uncleared fallback timer, stale print selectors).
- **Scripts**: `shoot.mjs`, headless Chrome/Edge screenshots at any size and scroll position over the DevTools protocol, with console errors and an fps readout.
- `SKILL.md` rewritten: lean workflow (intake → concept → story → path → premium layer → verify → ship), a routing table, ten non-negotiables, a stronger trigger description.

## 1.0.0 — 2026-10-06
- First release, distilled from the seowise rebuild: intake, two paths (from scratch / recreate), taste and anti-slop rules, motion system (lens intro, scan transition, soft-blur reveals, scroll-driven sections), glass components, custom icon and procedural art pipeline, ship checklist.

## 2.1.0 (2026-10-18)
- Colour: never the AI-default palette; the five-palette drill and OKLCH ramps (references/palette.md, shared with ishaan-motion).
