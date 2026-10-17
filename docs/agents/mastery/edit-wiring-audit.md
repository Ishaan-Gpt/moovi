# Edit pipeline ↔ effects / camera / UI libraries: wiring audit (2026-10-18)

Asked by Ishaan with two reels whose effects should already be saved: em6 (https://www.instagram.com/p/Def9pj5TWtA/,
"17 video effects Claude can create") and em7 (https://www.instagram.com/p/Dej8homsIzp/, "18 effects, all made by
Claude"). Evidence is file:line at main 67a33ac.

## The three outputs of an edit, and what each one shows

| Output | Where | What it draws |
|---|---|---|
| Live preview (the studio player) | `edit/page.ts` | captions, the EDL's zoom keys and cut types, D2.5 inserts, X1 moves, `E.sfx`; **never the reel effects** (it never loads `effects/runtime.ts` or `effects.json`) |
| EDL MP4 | `edit/render.ts` `renderEdl` | the same as the preview, but **the studio never calls it** (only `scripts/edit-bench.ts:208` and tests) |
| Delivered "edit+fx" MP4 (version v2) | `router/edit.ts:156-181` → `effects/onedit.ts` → `effects/render.ts` | **only** the reel effects and its own captions over a plain trim of the shots (`onedit.ts:55-64`): no zoom keys, no cut types, no inserts, no X1 moves, no `E.sfx` |

**The main problem:** what the user previews and what the user gets are two different films. The reel effects only exist in the
delivered MP4. Everything else (camera, inserts, X1, sound) only exists in the preview.

## Library by library

| Library | Size | Reaches the edit? | How well |
|---|---|---|---|
| Reel effects (`edit/effects`, runtime `fx`) | 16 | picked for every clip by `autoFx` (job.ts:306-313; e.g. take 3 got orbit, before-after, checklist, stat-counter) | drawn **only in the edit+fx MP4**; invisible in the preview |
| X1 moves (`edit/moves.ts`) | 9 of 17 built | `autoMoves` casts at most 3 (moves.ts:130-149) | preview: yes. Delivered MP4: no. 07, 10, 16 are never auto-cast; 13's `paper_tear` cut plays as a hard cut (lib.ts:297-305) |
| Camera library (`packages/library/src/camera`) | 64 moves (33 for footage) | `castEdl` (cast.ts, job.ts:260-267) on the base edit only | 14 of the 33 footage moves can land. Crash zooms, whip pans, trucks and handheld always fail the fit check; roll is dropped (`EdlZoomKey` has no roll); pulse, roll-settle and speed-ramp are never candidates; no keyword path (`parseCamera` unused, re-edits have no camera ops); D2.2 looks skip it; **not in the delivered MP4** |
| UI library (category `ui`) | 109 rows (58 style1 + 51 visual) | **never cast into an edit** (only Style 4 / Dark Vox borrow them, styles/kit/borrow.ts:91) | the edit uses its own 6 insert drawers instead |
| Other unused | effect/style1 67, effect/visual 27, 3d, overlay rows, kits' drawers | not cast by the edit | light_leak, title_behind and face_label exist only in the old ffmpeg footage-edit |

## em6's 17 effects (these ARE the X1 list)

| # | Effect | In the library? | In an edit today |
|---|---|---|---|
| 05, 07, 08, 09, 10, 13, 14, 16, 17 | digital zoom, checklist, headline wall, zoom-through cut, chart grow, paper cut, doodle boil, cover story, glass type | built as X1 moves | preview only (07, 10, 16 never auto) |
| 01 orbit, 06 phone mockup, 11 pull-back reveal | | built as reel effects (FX) | delivered MP4 only, not linked to their X1 numbers |
| 15 vertigo | | camera `dolly-zoom-in/out` (scope `coded`, not for footage) | no |
| 02 couch wall, 03 ui world, 04 frame break, 12 green screen | | **not built** (spec rows only) | no |

## em7's 18 effects (mostly not saved)

| Effect | Closest thing in the library | Status |
|---|---|---|
| Comment CTA | FX `comment-cta` | saved (delivered MP4 only) |
| Title card | insert drawer `title` | saved |
| Giant captions | FX `giant-word` (one word, not captions) | partial |
| Icon strike | FX `strike-tags` (name tags, not icons) | partial |
| NLE timeline | FX `timeline-ui` | partial |
| Grade slider | FX `before-after` (a wipe, not a slider) | partial |
| Film look | the owner's LUT grade presets (not an on-screen effect) | partial |
| Video card | a golden-hand kit card, not reachable from the edit | partial |
| Prompt bar | the edit player's `input` device (mastery player, not the product) | partial |
| Kinetic hook, Gravity drop, Storyboard deck, File drop, Jiggle delete, Eyedropper grade, Playing grid, Reel feed (+ the 18th) | none | **not saved** |

## What to fix, in order
1. **One film:** the delivered MP4 must be the preview's film plus the effects. Either the effects draw in the preview
   (load `effects/runtime.ts` in page.ts, read effects.json) and `renderEdl` becomes the delivered render, or
   `renderEditFx` renders from the EDL (zoom keys, cuts, inserts, `E.sfx`) instead of a plain trim.
2. **One effects list:** merge X1 and FX (X1 01/06/11 = FX orbit/phone-mockup/pull-back; X1 05/07 vs FX
   digital-zoom/checklist), cast from the graph, with a brief or chat keyword path.
3. **Camera reach:** add roll to `EdlZoomKey`, give pulse / roll-settle / speed-ramp needs, let whip and truck moves
   end off-centre on a cut, use `parseCamera` for "add a crash zoom on X" re-edits, and let D2.2 looks take moves.
4. **Cast the UI library** (109 rows) through the insert step instead of 6 fixed drawers.
5. **Build em7's missing set** (kinetic hook, gravity drop, prompt bar, storyboard deck, file drop, jiggle delete,
   eyedropper grade, playing grid, reel feed) and X1 02/03/04/12, each as a library asset with needs.
