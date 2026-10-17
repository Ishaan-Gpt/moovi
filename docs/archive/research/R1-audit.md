# R1: code audit and positioning

Owner: Claude 1 · 2026-10-16 · main at b5fef82. Read-only audit; nothing was run end to end for this note, so every
time quoted comes from `docs/SPEED.md` or the root `CLAUDE.md`, not from me.

> **Correction (13:15 IST):** this audit covers `main` only. `vignesh/router-r2` (347f30d, 0f2d224, c7bca9f, not
> merged) has a footage edit mode for the user's own raw clip (`router/footage-edit.ts`, `kinetic.ts`, light leaks, a
> wall of videos, a face label). The edit score is revised once Tab's R3 measures that branch.

## Verdict: 3 / 10 for the product we say we are

Moovi is an impressive **engine** (crew, task graph, FalkorDB memory, six generation styles, a fast visual
compositor). It is a weak **video editor**, and video editing is the product we are now pitching. Brutal version:

- **Generate** (words or a link to a film): about **6 / 10**. Real, live, varied, deployed. Previews in 13–48 s.
  Looks distinctive. But it competes on "explainer from a URL", where it is good, not unbeatable.
- **Edit** (your video plus words to a finished edit): about **2 / 10**. The path exists on paper and has never been
  measured. It has no real editing operations, no deterministic edit styles, and it runs on the slowest renderer.

## What happens to an uploaded video today

1. Studio: the composer and the brief overlay accept video, image and audio files (`apps/studio/.../Composer.tsx:78`).
2. `router/job.ts:28`: any brief **with uploads skips Auto and the live styles** and goes to the crew path.
3. `tasks/intake.ts`: measures each upload (length, size, cut rate, face ratio, speech rate). Good, deterministic.
   If it can't tell "edit this" from "copy this style", it asks the user.
4. `skills/match`: there is an `e1` row (edit, captions, reel, podcast, talking…), but **`PACKAGES` holds only `s1`
   and `unique`**. So `e1` is a name, not a style. An edit gets a **one-off invented style card** (`unique`).
5. `tasks/script.ts` `transcribe`: word timings of the clip's audio. Good, and it is the right foundation.
6. `tasks/director.ts` card: the clip's whole treatment is `footage.mode` = `none | full | framed`
   (`skills/src/unique/card.ts:39`): the clip fills the frame, or plays inside a phone or card. Plus captions.
7. Board → Shot Builders (a model writes a scene program per scene, with render QA loops) → MotionEasy render →
   sound → mux.

**Missing, all of it core to editing:** silence and filler-word cutting, retake removal, jump cuts on rhythm,
punch-in zooms on emphasis, face-aware reframing (16:9 → 9:16), b-roll inserted on the words it illustrates,
speaker layouts (split, PiP), sound design on cuts, colour grade, a music bed ducked under speech, a pacing law per
second. None of those exist as code for the user's footage. (`router/film.ts` and `footage/index.ts` have a slow
push-in and a zoompan for stock clips; that's all.)

**Speed:** the crew path on the default MotionEasy renderer took **1020–1355 s** in `SPEED.md` for a 30 s generated
film; the visual renderer took 203–381 s. No edit run has ever been timed. On the live 2 GB server, the crew path is
not realistic. **Target is 120 s.** We are roughly 10x off on the path editing uses.

## What is genuinely strong (keep, build on it)

| Asset | Where | Why it matters for editing |
|---|---|---|
| Word-level transcription | `audio/stt.ts`, `tasks/script.ts` | Every edit decision (cut, zoom, caption, b-roll, sfx) hangs off word times |
| Upload measurement | `tasks/intake.ts`, `bench.ts` | Cut rate, faces, speech rate: the inputs a style router needs |
| Styles-not-templates kit | `styles/kit/*` | Needs detector, `cast()`, memory against repeats: the same idea works for edit set-ups |
| Visual compositor | `visual/*` | 31–214 ms a frame, three.js, kinetic captions, footage panels: the overlay layer for edits |
| FalkorDB craft and style memory | `packages/graph` | The library graph the deciding agent picks from; feedback memory |
| Live preview players | `styles/serve.ts` | "Preview, don't render": an edit can play in the browser seconds after the plan |
| Voice library (63), router, maps, 3D | various | Generation breadth few competitors have |
| Any model, BYOK, fallback | `keys.ts`, runtime | Runs on free models; fits a deterministic-first edit engine |

## What drags the score down

1. **No edit engine.** The headline feature is a mode of the generation crew.
2. **The slowest path.** Edits go through model-written scenes plus MotionEasy. It's hard to get under 2 min there.
3. **The library is thin for editing.** 1 music bed, 24 sfx, no caption-style library, no transition library, no
   camera-move library for real footage. (Claude 2 is counting precisely in R5.)
4. **Unproven end to end.** The visual crew path was never run end to end on Vignesh's side. Edits never were.
   Footage panels go blank under parallel render (Tab, `TAB.md` 05:10), and edits are 100% footage.
5. **Server:** t3.small, 2 GB. The combined MP4 times out there. Heavy MP4 edits will too.
6. **Story:** the 3D Director and the visible crew are charming. A judge or buyer judges the output video first.

## What 10 / 10 looks like (the gaps, in order)

1. **An edit engine, deterministic first.** Input: the clip, word timings, shot cuts, faces. Output: an edit decision
   list (EDL): keep ranges, cuts, zoom keys, reframe path, b-roll slots, caption events, sfx hits, music, grade. The
   model does one job: read the transcript and tag beats (hook, point, proof, punchline, emphasis words). Code does
   the rest, the same on every model.
2. **5–6 edit styles as code, not prompts.** Each one is a set of laws over the EDL: cut rhythm, zoom grammar, caption
   look and motion, b-roll density, sfx map, grade, music energy curve. Same contract as `docs/STYLES.md`: a library
   of set-ups per style, cast per beat, never the same edit twice. (R4 turns Ishaan's references into these specs.)
3. **Preview in under 60 s, MP4 under 2 min.** The preview is the source `<video>` plus a live overlay layer (captions,
   zooms as CSS/WebGL transforms, b-roll, graphics) driven by the EDL. No render is needed to watch. The MP4 is ffmpeg
   for the base cut, reframe and grade, plus the visual compositor for the overlay, rendered once.
4. **The omnipotent library in FalkorDB.** Captions, sfx, music, transitions, camera moves, effects, UI pieces, each a
   node tagged with needs, energy and style. The deciding agent picks by graph query; memory steers away from repeats
   and toward what the user kept.
5. **Edit by words, after the edit.** "Tighter", "less zoom", "swap the b-roll at 0:12": changes the EDL and replays
   in seconds. That's the "Lovable" loop, and code-rendered video is the only kind that can do it exactly.
6. **Proof.** A before/after reel for each style, a measured time for each, on the live server.

## Proposed time budget for one 60 s edit (to verify in R3)

| Stage | Target | How |
|---|---|---|
| Upload probe, shot cuts, faces | 5 s | existing `intake` measures, sampled |
| Transcribe with word times | 10 s | Groq Whisper or the user's key; local fallback |
| Beat tags (one model call) | 8 s | transcript in, tags out, small schema |
| EDL from style laws + library cast | < 1 s | pure code |
| Live preview ready | **≈ 25–35 s** | browser player over the source video |
| MP4 (on request) | ≤ 120 s total | ffmpeg base + compositor overlay |

## Questions for the others

- @Tab (R3): please measure an actual edit run today (upload → first cut) on the crew path so the 2 / 10 is backed by a
  number, and say whether the visual renderer can take a user clip as a full-frame base today.
- @Claude2 (R5): for captions, transitions and camera moves, count what could apply to real footage (not only to
  generated scenes).
