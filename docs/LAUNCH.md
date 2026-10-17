# Launch: premium product-launch films

`launch` is a live-preview style: a site (or your own lines) in, a 18–30 s product-launch film out, cut to music,
playing in the browser (never an MP4). Pick it in the studio, or let Auto route a link whose brief says launch /
announce / release / promo. Terminal: `pnpm --filter @moovi/engine launch --url <site> [--ratio 16:9|1:1|9:16|4:5]`
or `--script <file> --brand <name>` (one on-screen line per beat, the key word marked `*like this*`).

## Where it was learned

The research source was **promptsmotion.com** (a public gallery of 251 Claude-made motion films, each with its build
prompt; read from the page's own public bundle, no account) plus **motion.so**'s public "Made with Motion" launch
films. 47 candidates were triaged from contact sheets by three blind scorers; twelve made the cut. Each was broken
down frame by frame (beats on the music grid, camera, transitions, type, UI, 3D, effects, grade, sound, measured
timings) and is stored as a `(:Reference {id: 'ref:lNN'})` with `HAS_PART` edges to every component it taught
(`data/refs/lNN/parts.json`), plus the look it taught as a `(:Kit)` (`packages/library/src/kits/launch/looks/`).
Nothing of theirs is in the repo: no code, footage, fonts, audio, logos or copy. Every part is rebuilt in our code.

| Ref | Film | Why it made the cut |
|---|---|---|
| l01 | Photo print app launch (promptsmotion) | one continuous take, every scene made from the last; liquid glass, iris, bento, floods that contract |
| l02 | French SaaS launch (promptsmotion) | type as the hero; one dot becomes radar, rings and logo; serif anaphora; dark→cream turn |
| l03 | E-reader intro (promptsmotion) | one material (ink stipple) runs the film; Fig. plates; serif italic; dither world flip |
| l04 | Health-app launch (promptsmotion) | the best script; black/cream pacing; one green accent; slot verdict; wave wipe |
| l05 | Mac utility promo (promptsmotion) | a 3D object tells the story; cobalt journey; frosted live status cards |
| l06 | Orange dot motion system (promptsmotion) | one dot threads every scene; spring graph; halftone ripples; three colours |
| l07 | Memoir demo (motion.so) | editorial restraint that still moves; data-chip constellations; italic serif voice |
| l08 | Email tool promo (promptsmotion) | sharpest copy; bracket captions; dot-matrix stat; slot price; terminals |
| l09 | UI morph study (promptsmotion) | one shape never cuts through ten UI states under a cursor; edge-stretch springs |
| l10 | Launch sting (promptsmotion) | Apple-sting grammar: haze, whip tilt, glass prompt, icon orbit, frosted titles |
| l11 | Ornadyne O1 (motion.so) | cinematic hardware: typed question, CRT bezel footage, HUD locks, product turntable |
| l12 | Database client launch (promptsmotion) | editorial serif with italic accents beside dark windows; the recolour is the proof |

## The laws (never change)

Music carries the film: one product-safe track, its grid measured, every beat on a bar or half bar, the drop on the
reveal. One idea per beat, big confident type, the brand's colour as the one accent, two worlds (light, dark) that
alternate as chapter breaks, transitions made of objects (no crossfades), the camera never still, a cursor that
drives the product, real product assets where the site gives them (its icon, a desktop and a mobile shot), every
arrival with micro-motion and a sound.

## What varies (why two films of one site differ)

- **Look**: one of twelve learned looks (palette roles, type pairing, world rhythm, background layers, preferred
  moves), chosen by the site's signals, away from the style's recent looks and this site's last one.
- **Arc**: one of ten launch arcs (`src/launch/arcs.ts`: pain-turn, manifesto, question, since, verbs, day-night,
  one-number, chapters, verdict, prompt), away from recent arcs.
- **Cast**: per beat a set-up, type treatment, world, camera, transition and background, all read from FalkorDB
  (`launchParts`), scored by need fit, slot kind, what the brand really has, the look's preferences, minus repeats in
  this film and recent films (`recentSetups`, `launchPartUse`), plus a per-film jitter.
- **Music**: picked by the look's energy, its grid measured and cached.

## Pipeline (`src/styles/launch.ts`)

site ∥ capture (`src/launch/capture.ts`: icon, hero and mobile shots, hard 15 s deadline) ∥ brief (one model call,
`src/launch/brief.ts`: headlines with marked accents, features, a product request, a number, a tagline; a
deterministic doctor; a site-only fallback) ∥ music (`src/launch/audio.ts`) → cast (`src/launch/cast.ts`) → timing
(`src/launch/plan.ts`, the kit's own `plan()` hooks in a vm) → audio (library-cast SFX stem + the track, drop on the
reveal, -14 LUFS) → live player (`src/launch/player.ts`, the kit inlined) → contact sheet. Memory: the film in the
styles graph (`remember`), the parts it used in the craft graph (`launchFilmParts`).

## The kit and the library

`packages/library/src/kits/launch/` (README.md there is the authoring contract): `runtime.js` (motion, colour, text
layout, glass, icons, cursor, camera), part packs (`worlds type trans cam ui fx setups end` + one pack per reference
`p-lNN.js`), `player.js`. Part ids are library asset ids. `scripts/launch-gallery.ts --pack <file>` renders any pack's
parts on sample content with a labelled contact sheet; `scripts/launch-try.ts` a hand-made film. Tests:
`test/launch.test.ts` (kit ↔ library parity, pure plans, real sound events, timing, honesty helpers).

Queries (`packages/graph/src/queries/launch.ts`, docs/QUERIES.md): `launchParts`, `launchPartStory` (where a part came
from), `launchReferences`, `launchServing`, `launchFilmParts`, `launchRecentLooks`, `launchPartUse`.
