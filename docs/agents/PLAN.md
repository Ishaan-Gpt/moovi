# Moovi: the goal and the two-day plan

Owner: Claude 1. Status: **draft for approval (2026-10-16 14:15 IST).** **Ishaan approved at 13:44 IST.** Vignesh's yes is pending;
no code starts until it lands. Two agents build: Claude 1 (Ishaan) and Tab (Vignesh). Claude 2 is offline.

## What Moovi is

Lovable, for video. You type, or you give a video plus words, and you get a finished, polished film back. You never
open a timeline. Moovi creates and edits with AI and with **code**: every frame is rendered by code, so it is exact,
repeatable and editable by words.

Two jobs:
1. **Generate**: words (and a link) to a finished film: launch films, explainers, short-form hooks, and more.
   Several generation styles already exist; more will come later.
2. **Edit** (the focus now): the user's own video plus words to a finished edit, in one of **5 to 6
   deterministic editing styles**. Ishaan will post reference links for each style.

## The bar

- Quality: it should read as a senior After Effects editor with five years' experience made it. Every Opus video
  skill, workflow folder and copy-this-prompt site on the market should look weak next to it. A single prompt
  should not be able to reproduce it.
- Speed: a finished edit in **under 2 minutes**, measured, not guessed.
- Not the Higgsfield direction (generated footage). Moovi edits and composes with code.

## The omnipotent library

One library, stored in FalkorDB, that both generation and editing draw from. Target: 50+ of each.

voices · sfx · music beds · caption styles · video effects · camera moves and angles · UI components ·
three.js 3D styles · transitions · (more to be proposed in research).

The graph picks from it. A **research agent** reads the prompt or the source video. A **deciding agent** chooses
what to use, how, and what to keep, inside the rules of the chosen style. The style stays deterministic; the
choices inside it change per film.

## Decisions (Ishaan, 2026-10-16)

- Music bed `bed.mp3` is Kevin MacLeod, CC BY; CC BY music ships with a credit line in the film's description.
- Edge TTS is fine for the hackathon demo; Kokoro replaces it before a paid launch.
- The library's `Asset` node carries a `runtime` field (one node, an implementation per runtime).

## Research phase (now)

Topics and owners are on `BOARD.md`. Each topic lands as `research/<topic>.md`. When all are in, Claude 1 writes
the two-day plan below, both masters approve it, and building starts.

## The architecture we build (from R1, R3, R4)

```
upload ─▶ hear (word times, right language)      ─┐
       ─▶ look (shots, faces, person mask)        ─┼─▶ EDL (pure data) ─▶ preview player (browser, no encode)
brief  ─▶ beat tags (ONE model call)              ─┘        ▲           ─▶ ffmpeg + compositor (MP4 on request)
                                                         style laws (R4) + library cast (FalkorDB, R5/R7/R8)
```

- **The 6 edit styles (R4):** Atlas, Night Desk (A split / B story), Handmade, Crimson Cutout, Brand Promo, Studio
  Minimal. Shared laws in R4: pause trim to 0.18 s, cuts snapped to words, a new framing per sentence, -14 LUFS.
- **One EDL for every style** (fields: R4's last section): keep ranges, cuts, zoom keys, reframe path, caption events (R8 style id), insert slots
  (R4b: frame, need, set-up), sfx hits, music and ducking, grade.
- **Base:** Vignesh's footage-edit on `vignesh/router-r2` (44 s per edit, right words) split into `edl.ts` plus
  renderers, as R3 recommends. Not the crew path (19.7 min). Afterglow (E1) becomes the Atlas style over the EDL.
- **FalkorDB stays load-bearing:** every edit is a graph (`(:Edit)-[:KEEPS]->(:Range)`, `[:CASTS]->(:Asset)`, caption
  and insert picks); the deciding agent casts by need from the library graph; memory steers away from repeats and
  toward what the user kept. New queries go in docs/QUERIES.md.
- **Measured so far (29.7 s selfie clip):** footage-edit 36.6–44.3 s to an MP4 (R3). Afterglow 87 s: words 1.9 s,
  head track 9 s, plan 0.1 s, cut 5 s, mix 7 s, re-plan 6–9 s, and **voice clean-up 62 s (Python Demucs)**. Its grade,
  person matte, glow and parallax run **live in the browser on WebGL with no precompute**: the preview player's model.
- **Speed bar:** preview of a 30 s clip ≤ 60 s from upload; MP4 ≤ 120 s; measured on the R9 clip set, then on the server.

## Day 1: today, 16 Oct (14:30 IST → late night)

Goal by the end of Day 1: **upload a clip in the studio and watch an edit in the browser in ≤ 60 s**: cuts, punch-ins,
captions and one style, measured on the R9 clips.

| # | Task | Owner | Done when | Files |
|---|---|---|---|---|
| D1.1 | **EDL schema v0** (types + JSON schema + one example). Both agents review it before the next step. | Tab drafts, Claude 1 reviews | agreed in the logs by ~15:30 | `packages/engine/src/edit/edl.ts` |
| D1.2 | Merge footage-edit's **hear** into main's `transcribe`/`intake` (fixes the Urdu transcript); language lock + confidence gate | Tab | R3's selfie clip transcribes right on main | `audio/stt.ts`, `tasks/intake.ts`, `tasks/script.ts` |
| D1.2b | **Voice clean-up without Python**: ffmpeg `arnndn` (RNNoise model) + the broadcast chain, vs Demucs's 62 s; keep silence cuts working on street noise | Tab | ≤ 5 s on the 29.7 s clip; speech ≥ 15 dB over noise | `engine/src/audio/` |
| D1.3 | **Extract the EDL builder** from footage-edit: take window, filler and pause cuts, zoom alternation, faces, beat tags (one call) → EDL | Tab | unit tests on 3 R9 clips; < 20 s each | `engine/src/edit/` (new) |
| D1.4 | **R10 + preview player**: source `<video>` + EDL overlay (time map over cuts, zoom keys as transforms, caption layer, insert slots), in the studio | Claude 1 | plays an EDL JSON at 30 fps; first frame time measured | `engine/src/edit/player/` (new), `apps/studio` |
| D1.5 | **Caption renderer** for the R8 schema, the first 10 styles, face-safe placement | Claude 1 | 10 styles draw over a clip in the player | `engine/src/edit/captions/` (new) |
| D1.6 | **R9 benchmark set**: 8–10 raw clips + word truth + score script (cut rate, words right, safe zones, LUFS, seconds) | Tab | `scripts/edit-bench.ts` prints one table | `engine/scripts/`, `data/` (local) |
| D1.7 | **Studio route**: an upload with "edit" goes to the edit job, not the crew; an edit-style picker | Claude 1 | upload → preview in the studio | `router/job.ts`, `apps/studio` chat composer |
| D1.8 | **MP4 renderer reads the EDL** (footage-edit's final ffmpeg pass) | Tab | same EDL → MP4, ≤ 120 s for a 30 s clip | `engine/src/edit/render.ts` |

Order: D1.1 first (everything reads the EDL). Then D1.2/D1.3/D1.6 (Tab) in parallel with D1.4/D1.5 (Claude 1). D1.7 and
D1.8 last. **Gate at the end of Day 1:** a measured table on the R9 clips in `docs/SPEED.md`.

## Day 2: 17 Oct

Goal by the end of Day 2: **5–6 edit styles, each one recognisably its own hand, edit by words, deployed and measured.**

| # | Task | Owner | Done when |
|---|---|---|---|
| D2.1 | Style laws over the EDL (R4): **Night Desk** (layouts A and B), **Crimson Cutout**, **Brand Promo** | Tab | each matches its R4 bands (metrics block) on 2 R9 clips |
| D2.2 | Style laws: **Atlas** (Afterglow's breakdown, ported to TypeScript + ffmpeg, no Python), **Handmade**, **Studio Minimal** | Tab (was Claude 1; Ishaan, 18:45) | same bar |
| D2.3 | The R2 seeds (Punch, Documentary) as extra styles, only if D2.1 and D2.2 are done | whoever finishes first | |
| D2.4 | **Library in FalkorDB** (R7): vendor the 82 CC0 sfx and the CC BY tracks with credits; seed captions (R8), effects (X1), inserts; cast by need. **Built and on main** (`docs/LIBRARY.md`: 755 assets, named queries, reference kits); left: casting by need inside styles and Auto, on `ishaan/library-wire` | Tab | the deciding agent queries it; QUERIES.md updated |
| D2.5 | **Inserts from the generation styles** (R4b): Style 1 UI and Editorial posters drawn into insert frames in the player | Tab (was Claude 1) | at least 2 libraries cast into edits |
| D2.6 | **Sound pass**: sfx map per style (whoosh on moves, hits on key words, risers), bed with ducking, cuts on the beat | Tab | no edit ships silent under the voice |
| D2.7 | **X1 effects**: at least 8 of the 17 as library moves (5 exist in footage-edit) | Tab | each one usable by any style |
| D2.8 | **Edit by words**: "tighter", "less zoom", "swap the card at 0:12" re-plan the EDL and replay in seconds | Tab (was Claude 1) | 3 instructions work on a live edit |
| D2.9 | **Ship**: deploy to the server, measure on t3.small, a before/after reel per style, AI_USAGE.md, README | both | live link + numbers in SPEED.md |

## Risks

- **Server size.** t3.small (2 GB). The preview is fine; MP4 renders may need a queue of one, or a larger instance
  (the owner's call, it costs credits).
- **Unmerged work.** `vignesh/router-r2` (footage-edit) and Afterglow (`studio-styles`, uncommitted) must reach `main`
  before D1.3 and D2.2. Tab merges router-r2 first thing; Ishaan decides when Afterglow is committed.
- **Python** in Afterglow (Demucs, plate.py) conflicts with the root rule; D1.2b replaces Demucs, D2.2 ports the rest.
- **Model quota.** One model call per edit (beat tags) keeps us inside Groq's free tier; everything else is code.

## Not in these two days

New generation styles; Kokoro voices; XML export to Premiere/Resolve; GPU rendering.
