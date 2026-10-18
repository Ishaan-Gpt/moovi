---
name: ishaan-ui
description: Ishaan UI — a design brain for building, rebuilding or beautifying websites that feel art-directed, premium and alive, never generic or "AI-made". It finds an original concept (five ideas, build the fifth), tells the site as a theme-built story, and ships the premium layer — intro loader, page transitions, smooth scroll, GSAP scroll-triggered and scrubbed sections, parallax, subtle in/out reveals, micro-interactions, lazy loading — with spacious minimal copy, custom icons and art, and no AI tags. Use it whenever someone wants a new website, landing page, portfolio, dashboard, web app UI or design system, or wants an existing site redesigned, polished, made premium, animated or rebuilt like a reference site. Also use it for loaders, transitions, scroll storytelling, parallax, smooth scrolling, GSAP animations, 3D/canvas heroes, micro-interactions or custom icons. Trigger even on "make this look better", "make it premium", "redo my landing page", "make it feel like [site]" or "add animations".
---

# Ishaan UI

A way of thinking about websites, not a component kit. It produces sites that feel *authored*: one original concept carried through every surface, a story that unfolds as you scroll, generous space and few words, motion that is subtle and purposeful, custom icons and art, the product's real UI, and honest content. Every site is built by hand for the brand in front of you; nothing is copied from a previous project.

```
Intake ─> Concept (5 ideas, build the 5th) ─> Story ─┬─ Path A: from scratch ─┐
                                                     ├─ Path B: recreate      ├─> Premium layer ─> Verify ─> Ship
                                                     └─ Path C: beautify      ┘
```

## 1. Intake: ask first, briefly
Unless they've already said "just go", open with one short message offering to brainstorm, then ask one grouped round of questions with defaults (`references/intake.md`). Whatever they skip, decide yourself and say what you chose. If they say "just go", infer from the repo and references, state your assumptions in two or three lines, and start. Missing facts (prices, numbers, logos) become clearly marked placeholders, never inventions.

Leave intake with: path (new / recreate / beautify) and any reference sites · brand, audience and the one promise · palette and fonts if they exist · pages and stack (default: whatever the repo uses) · what's true (real numbers, logos, quotes) · how much story they want.

## 2. Concept: never the first idea
Read `references/concept.md`. Write **five** concepts (world, protagonist, signature move, motion personality, palette seed), knowing the first three will be the obvious ones. "Five" is a forcing function to get past the obvious, not magic: the concept that passes the tests best wins, usually the fifth or a fusion of the fourth and fifth, never one of the first three. Fill the derivation table so the loader, transitions, scroll device, icons, imagery, empty states and footer all come from the one concept. Post the concept sheet (format in `concept.md` §6) and proceed unless they object.

Never reuse a previous project's look: no default mascot, halo, jelly, star sky, glass-over-painting or palette unless *this* brand's fifth idea genuinely is that.

## 3. Story: the site unfolds
Read `references/storytelling.md`. Pick 5–9 beats (hook, hello, tension, turn, proof by doing, depth, range, trust, invitation + goodbye), give the page a protagonist that persists and changes state (a character, an object, a material, an environment, or the real UI), and keep one message per viewport. Calm editorial or utility sites still get an arc, just a quieter one.

## 4. Build the path
- **Path A, from scratch**: `references/from-scratch.md`.
- **Path B, recreate** (upgrade a client's site, or a 90–95% rebuild inspired by a reference): `references/recreate.md`.
- **Path C, beautify** an existing site: `references/recreate.md` → Beautify. Still run the concept step; a polish without a concept stays generic.

## 5. The premium layer (read what the site needs)

| Read | For |
|---|---|
| `references/taste.md` | always: colour (two majors + one accent), type (giant, variable axes, italic turns), space, copy, honesty, the anti-slop list |
| `references/loaders.md` | intro loader decided before paint, page transitions that never slow navigation, route/component loading |
| `references/scroll.md` | Lenis smooth scroll, triggered vs scrubbed, pinned chapters, the director, keyframe scripts, parallax, horizontal tracks, tone-switching chrome |
| `references/motion.md` | motion vocabulary, subtle in/out reveals, text motion, sections that teach by doing, micro-interactions, ambience, pitfalls |
| `references/components.md` | surfaces, buttons, hero inputs, navigation and position chrome, data visuals, objects from the metaphor, states, real UI in marketing |
| `references/assets.md` | custom icons, marks, type as art, procedural and real-data art, silhouettes, textures, image prompts |
| `references/performance.md` | budgets, lazy loading waves, images/video/fonts, cheap animation, hydration, resilience, measuring |
| `references/3d.md` | **only if the concept needs real-time 3D**: technique choice, canvas between DOM layers, pinning DOM to 3D, characters, guards |
| `references/verify.md` | capturing and reviewing frames at desktop and phone sizes, every chapter, every state |
| `references/checklist.md` | before showing work and before shipping |

Tools in the skill:
- `assets/motion-kit/`: typechecked React/Next + GSAP + Lenis building blocks (intro gate and scroll lock, smooth scroll, reveals, pinned chapters, director, page transitions, roll/fill/fit text, kit CSS). Copy what you need and restyle it to the brand.
- `assets/glass.css`, `assets/icon-template.tsx`: surface utilities and the custom-icon base.
- `scripts/render-art.mjs`: procedural painted art rendered to small static WebP (needs `sharp`).
- `scripts/shoot.mjs`: headless Chrome/Edge screenshots at any size and scroll position, with console errors and an fps readout (Node 22+, no installs).

**Default premium layer** for a marketing site, scaled to the brand (a calm utility page gets less): a branded intro that plays once per session; page transitions; smooth scroll; at least one scroll-told or interactive section with the real UI; subtle soft-blur reveals *and* quiet exits; position chrome (active-section bead, a rail that belongs to the world); one characterful micro-interaction per control; heavy things lazy-loaded; everything respecting reduced motion.

## 6. Non-negotiables
These come from real feedback; the reasons are in `references/taste.md` and `references/concept.md`.
1. **Never the first idea.** Five concepts, build the fifth; one concept carries every surface.
2. **No clones.** Derive everything from this brand; never paste a previous project's mascot, palette, hero or effects.
3. **No AI tags or slop.** No eyebrows/kickers above headings, no badges and sparkles, no emoji, no hype words ("unlock", "seamless", "AI-powered"), no purple gradients or glowing orbs. A small lead-in is allowed only when it reads as one sentence with the heading.
4. **Spacious and minimal.** One message per viewport, big type, lots of canvas, few words. Remove before you shrink.
5. **Subtle motion with a purpose.** Small distances, soft blur, named eases; things enter *and* leave; springs only on things you touch.
6. **No icon libraries, no prebuilt kits.** Every icon drawn in one hand; every component written for the brand.
7. **Derived palette, never the AI default.** Two majors from the world, one accent with a reason; no framework defaults and no AI-default colours (blue, orange, cream, navy + ice blue, neon on black). Five-palette drill and OKLCH tint ramps for contrast: `references/palette.md`. No silent defaults anywhere: ask *can something be better?*
8. **Real UI and honest content.** Real components with fictional `.example` sample data; never invented testimonials, logos or metrics; decorative data is real.
9. **Fast and resilient.** Hero text first; 3D/video after LCP; transforms and opacity only; nothing jumps; reduced-motion and no-JS paths. 3D only when the concept needs it.
10. **Verified, not assumed.** Look at real frames on desktop and phone; measure performance claims.

## 7. How to work
- Build in vertical slices: concept sheet → tokens and type → motion kit wired → the hero done properly (verify) → each chapter (verify) → the rest → states → performance pass → checklist.
- Keep content in one module and choreography in components, so copy edits don't touch motion.
- Keep functionality real: forms submit, links go somewhere, every state exists.
- Verify visually after each slice (`references/verify.md`): browser tools if available, otherwise `node <this skill's folder>/scripts/shoot.mjs <url> <dir> --size 1440x900` and `--size 390x844`.
- End with `references/checklist.md`, then a short plain summary: what was built, what was verified and how, what still needs the human.

## Updating this skill
This folder is the whole skill. `SKILL.md` holds the workflow (keep it lean; it loads on every use); depth lives in `references/`; reusable code in `assets/` and `scripts/`. Bump `VERSION`, note changes in `CHANGELOG.md`, and see `README.md` for packaging and distribution.
