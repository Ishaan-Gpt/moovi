# Ishaan UI

A design brain for Claude that builds, rebuilds or beautifies websites to an art-directed, premium standard. It doesn't hand out a template: it finds an original concept for each brand (five ideas, build the fifth), tells the site as a theme-built story with a protagonist that persists, and ships the full premium layer: a branded intro loader, page transitions, smooth scroll, GSAP scroll-triggered and scroll-scrubbed chapters, parallax, subtle in/out reveals, micro-interactions and lazy loading. Copy stays spacious and minimal; icons and art are custom; the product's real UI replaces mockups; nothing is invented. No icon libraries, no prebuilt kits, no AI tags, no clones of earlier sites.

Author: Ishaan · Version: see `VERSION`

## What it does
1. **Asks first**: one friendly round of questions (brand, promise, palette, type, references, scope, what's true, how much story).
2. **Finds the concept**: writes five directions, discards the obvious ones, builds the fifth, and derives every surface (loader, transitions, scroll device, icons, empty states, footer) from it.
3. **Shapes the story**: 5–9 beats, a persistent protagonist, one message per viewport.
4. **Builds one of three paths**: from scratch, recreate (upgrade or reference-inspired rebuild), or beautify.
5. **Adds the premium layer** from the references and the typechecked motion kit.
6. **Verifies** real frames at desktop and phone sizes (headless screenshot script included) and **ships** with a checklist.

## Contents
```
ishaan-ui/
├── SKILL.md                     workflow, routing, non-negotiables (loads on every use; kept lean)
├── references/
│   ├── intake.md                the opening questions and the concept sheet
│   ├── concept.md               the fifth-idea method, concept tests, derivation table, worked examples
│   ├── storytelling.md          story beats, protagonist, show-don't-list, pacing, copy, mobile versions
│   ├── taste.md                 colour, type, space, copy, honesty, anti-slop list, premium signals
│   ├── from-scratch.md          Path A
│   ├── recreate.md              Paths B and C (recreate, beautify): audit, reference study, rebuild strategy
│   ├── loaders.md               intro loader, page transitions, route/component loading
│   ├── scroll.md                smooth scroll, pinned chapters, director, keyframe scripts, parallax, scroll devices
│   ├── motion.md                motion vocabulary, subtle in/out, text motion, micro-interactions, pitfalls
│   ├── components.md            surfaces, inputs, navigation and chrome, data visuals, objects, states, real UI
│   ├── assets.md                icons, marks, type as art, procedural and real-data art, textures, prompts
│   ├── performance.md           budgets, lazy loading, cheap animation, hydration, resilience, measuring
│   ├── 3d.md                    only when the concept needs it: WebGL/SDF/GLB patterns and guards
│   ├── verify.md                how to capture and review frames
│   └── checklist.md             ship checklist
├── assets/
│   ├── motion-kit/              React/Next + GSAP + Lenis building blocks (typechecked) + kit.css + README
│   ├── glass.css                surface + motion utilities
│   └── icon-template.tsx        custom icon base
├── scripts/
│   ├── render-art.mjs           procedural painted art → WebP (needs `sharp`)
│   └── shoot.mjs                headless Chrome/Edge screenshots at any size/scroll position (Node 22+)
├── VERSION · CHANGELOG.md · LICENSE.md
└── ishaan-ui.skill              packaged build for upload
```

## Use it
- **Claude Code**: put the folder in `~/.claude/skills/ishaan-ui/`. Invoke with `/ishaan-ui`, or just ask for a website and it triggers.
- **Claude.ai / other environments**: upload `ishaan-ui.skill` (or this folder zipped) as a custom skill.

## Update / upgrade it
Edit the markdown files directly; they are the skill. Keep `SKILL.md` short and put depth in `references/`. Keep the motion kit typechecked (drop it into any Next.js app with `gsap` and `lenis` installed and run `tsc`). Bump `VERSION`, add a line to `CHANGELOG.md`, then re-package.

## Package it
With Anthropic's skill-creator scripts:
```
python -m scripts.package_skill ~/.claude/skills/ishaan-ui
```
or zip the folder (the zip must contain the `ishaan-ui/` folder with `SKILL.md` at its top).

## Sell / distribute it
Package as above and list it on any marketplace that accepts Claude/Agent Skills, or sell the zip directly. Set your terms in `LICENSE.md`.
