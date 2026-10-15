# Anatomy

A voice-led 9:16 explainer: the brand's product or system as a detailed isometric technical illustration that builds
itself on the voice. Parts land and settle, lids lift to show insides, callouts draw out on the spoken word, particles
run through the pipes, and the camera orbits and pushes. Everything is drawn in code.

- `GRAMMAR.md`: the method (projection, shading, tones, line weights, detail, explode, callouts, flow, timing).
- `tokens.ts`: every editable number, and the light / dark blueprint palette from one brand colour.
- Engine: `packages/engine/src/anatomy/`: `iso.ts` (projection, solids, the frame model and SVG, shared by Node and the
  browser), `prims.ts` (the solids as data), `parts.ts` + `parts-more.ts` (83 part kinds), `improv.ts` (parts composed
  from primitives when the library lacks one), `library.ts` (22 figure types, 46 set-ups, the improvising vocabulary),
  `figures.ts` (one layout per figure + the composer for improvised set-ups), `plan.ts` (sections → cast → one model
  call → layout, timing, camera, checks), `player.ts` (live player + contact sheet); `packages/engine/src/styles/anatomy.ts`
  is the pipeline.

## A style, not a template

A film is a run of FIGURES, one per section of the script, each cast from the library by what the section needs
(the kit's `cast()`; never one family twice in a row; away from the style's and the site's recent films). The laws
never change: projection, the four-tone shading, one brand ink, line weights, springs, callouts on the word, the
camera grammar, paper or blueprint. Between figures the old one lifts away and the next drops in (FIG. 01, 02...).
When nothing in the library serves a section, the style improvises one (a layout and elements from enums, drawn by
the composer); a part nobody has drawn is composed from primitives (box, cylinder, slab, cone, ring, panel, sphere,
pipe). Both are kept (`data/library/anatomy/grown.json`) and later films can cast them.
- Run: `pnpm --filter @contenteasy/engine anatomy --url https://site` or `--script file.txt --brand Name --color #hex`.
  Tune the look without new voice or model calls: `tsx scripts/anatomy-try.ts <data/anatomy/<id>>`, `--demo [--setups a,b]`
  or `--all` (every set-up once). Safe-area check of a made film: `tsx scripts/anatomy-safe.ts data/anatomy/<id>`.

## Credits and notice

The isometric method (camera, extruded solids with facing-shaded sides, tone hierarchy, parts vocabulary, exploded
views on staggered springs) is adapted from **anatomy** by wheresryan22, https://github.com/wheresryan22/anatomy,
used under the MIT License. We read its SKILL.md, README, references and kit as reference and re-implemented the
techniques we needed in our own TypeScript; none of its code or scripts were executed or copied verbatim.

> MIT License. Copyright (c) 2026 Ryan (wheresryan22). Permission is hereby granted, free of charge, to any person obtaining a
> copy of this software and associated documentation files (the "Software"), to deal in the Software without
> restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense,
> and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the
> following conditions: The above copyright notice and this permission notice shall be included in all copies or
> substantial portions of the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.
