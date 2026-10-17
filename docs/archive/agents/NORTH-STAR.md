# Moovi: where we are, and the one pipeline

Owner: Claude 1 (PM) · 2026-10-17 · written because Ishaan asked for "extreme clarity". Read this before starting any
session. If it disagrees with an older doc, this one wins until Ishaan changes it.

## 1. What Moovi is (one paragraph)

You type a prompt (or give a link, or your own clip) and get a finished, polished short video back. You never open a
timeline. It runs on any model (Opus, Groq, Gemini, your key or ours). What we are building is **the brain**: a
director that knows what good looks like (from real references), picks from a large library of parts, and makes good
videos by itself, fast and cheaply. Everything is drawn by code, so every video is exact, repeatable and editable by
words.

## 2. Why it feels scattered: the honest picture

### Ten ways to make a video exist today

| # | Pipeline | Input | Where | Status |
|---|---|---|---|---|
| 1 | **Auto** (combined) | prompt or link | `router/job.ts` → picks one of the styles below | live, the default for a plain prompt |
| 2 | **Style reels**: Style 1, Editorial, Clear Signal, Dark Vox, Anatomy | link or script | `styles/run.ts`, each with **its own player** | live |
| 3 | **Clip Moment** (stock clips + gold cards) | prompt | `edit/templates/` | on main, not deployed |
| 4 | **Edit your clip** (EDL builder + live player + MP4) | your video | `router/edit.ts` → `edit/job.ts` | live; Atlas, Handmade, Studio Minimal styles on main |
| 5 | **footage-edit** (Vignesh's first edit engine) | your video | `router/footage-edit.ts` | CLI only, superseded by #4 |
| 6 | **The crew** (intake → director → shot builders → render) | prompt + uploads | `tasks/*` | legacy; still reachable ("like this video") |
| 7 | **Visual renderer** | script | `visual/` (`MOOVI_RENDERER=visual`) | flag only, not a studio style |
| 8 | **Mixed MP4 film** | prompt | `router/film.ts` (`MOOVI_AUTO_RENDER=mp4`) | flag only, too heavy for the server |
| 9 | **Reference clones + kits** (R1–R5, blind-judge ratchet) | a reference reel | `data/refs/`, `packages/library/src/kits` | separate canvas pages; kits feed #1–#2, not #4 |
| 10 | **Afterglow** | your video | ContentEasy `studio-styles` worktree | uncommitted, Python, off-repo |

Plus work happening right now **outside any branch**: the OpenDesign session's review layer (`engine/src/review/`),
`scripts/review.ts` and both teardown docs are uncommitted in the shared `moovi` folder, and it has edited
`tasks/reel.ts` and the studio chat there too.

### What this costs us

- **Taste lives in one place only.** The blind-judge ratchet and the `ishaan-motion` laws apply to the reference
  clones (#9). Nothing checks taste on what users actually get (#1–#4). Tab's styles are tuned by eye on benchmark clips.
- **The same thing is built three times.** Captions: R8 styles, captionseasy looks, kit captions. Camera: the camera
  layer, the edit player's zoom keys, the clones' `core.js`. Sound: library sfx, the clones' sfx, Style 1's pack.
- **Seven players.** Each generation style has its own player, so a fix in one (a review, a caption rule, an MP4
  export) doesn't reach the others.
- **Sessions invent their own pipeline** because there is no written rule that says where new work plugs in.

## 3. The one pipeline (the target)

```
            ┌──────────────── one front door: router (prompt | link | clip | reference) ────────────────┐
 1 UNDERSTAND  hear (words, language)  ·  look (shots, faces)  ·  read (the site, the brief)        [edit/hear, look, research]
 2 DIRECT      one director: style + premise + motif + beat map, chosen from the style library     [one model call, regex fallback]
 3 PLAN        one plan format for everything: the EDL                                            [edit/edl.ts]
 4 CAST        parts from the library graph: kits, captions, camera moves, sfx, music, inserts      [FalkorDB, edit/cast.ts]
 5 PLAY        one live player, no encode                                                          [edit/page.ts]
 6 CHECK       code lints first, then ≤ 3 frames to a model, ≤ 1 repair, never blocks the preview   [review/]
 7 RENDER      one MP4 from the same plan                                                          [edit/render.ts]
 8 REMEMBER    what the user kept or changed → rules checked next time                             [feedback memory]
            └──────────── styles are DATA plugged into 2, 4 and 6: laws, palette, kit, bands ────────────┘
```

**The rules that keep it single:**
1. **A style is data, not a pipeline.** A new style is laws + a palette + a kit + metric bands, plugged into stages 2,
   4 and 6. Nobody writes a new runner, player or renderer.
2. **A reference becomes a kit, a kit becomes a style.** The clone track (#9) is how we learn taste. Its output must
   land in the library as a kit the director can cast, not stay a standalone page.
3. **Taste is a gate, not an opinion.** Every style that ships to users passes the same blind-judge ratchet the
   clones use, on the R9 benchmark clips.
4. **One player, one renderer, one review.** The edit player (#4) is the most complete spine, so it is the target. The
   generation styles (#2) move onto it one at a time, after the hackathon unless a style is cheap to move.
5. **Frozen until the demo:** no new pipelines, no new players. #5–#8 stay as they are (no new work); #10 is not part of Moovi.

## 4. What we reverse-engineered, and what to take

Not their looks: **their workings.** For each site: what runs behind the scenes, how a video is processed, how a
change is processed, and what Moovi lacks.

### Cardboard (cardboard.ai) · full notes: `research/cardboard-ai.md`

- **What it is:** a browser video editor (a real multi-track timeline) with a chat "Director" agent on top.
- **Agents and services behind it:** a Director agent (Claude or GPT, user-picked) that **calls timeline tools**, not a
  fixed workflow; cloud analysis workers ("cloud vision models + classic ML": shots, faces and face grouping,
  segmentation, who is speaking, transcription with one locked language, search over footage); a proxy transcoder; a
  **parallel chunked export**; an eval team (production failures become test cases).
- **How a video is processed:** upload → proxies + analysis → the Director plans edits as tool calls on the timeline →
  **it looks at real frames and fixes** (captions off screen, a cut a beat early) → it **audits the result against
  the request** and listens to the mix → then it says done.
- **How a change is processed:** every chat message is a **checkpoint**; a change is new tool calls on the same
  timeline; undo restores the exact timeline.
- **Before sign-up:** one model call turns the prompt into a strict plan card (title, length, steps, palette), with a
  **regex fallback** so it never fails.
- **What Moovi lacks and should take:** (1) a verify-then-fix loop, (2) chat checkpoints as versions in FalkorDB,
  (3) cleanup levels Light/Balanced/Tight previewed live, (4) a music **beat grid** with "never reuse a moment",
  (5) captions behind the subject, (6) b-roll timed to the spoken idea, (7) styles shown as **recipes with typed
  inputs** ("names to spell right").
- **Where we already win:** they make a cut; motion graphics, style references and memory are on their own "hard
  problems" page as unsolved. That's exactly our library, kits and graph memory.

### OpenDesign (open-design.ai) · full notes: `research/R11-open-design.md`, `research/open-design-notes/`

- **What it is:** an open-source design-agent workspace; its videos come from **HyperFrames** (one HTML file, one paused
  clock, seek every frame, encode with FFmpeg). Very close to how our live previews work.
- **The brain:** layered prompts with fixed order (house rules → design system → scenario → user memory last);
  the task type is **inferred**, and the chosen direction is **stated in one line** so you can redirect cheaply;
  **direction before motion**: a premise, one motif, and a beat map in seconds.
- **Taste as numbers and bans, not adjectives:** timing bands (accents 120–220 ms, arrivals 350–650 ms), one main
  transition for 60–70 % of cuts, frame-fill rules, a banned-pattern list, measured "grammar cards".
- **Quality control:** **code checks first** (anti-slop lint, contrast on real pixels, dead-zone and collision map),
  then **one review of at most 3 frames and at most 1 repair**, ship the best, never block. They **retired** their
  five-persona self-judging jury: it cost money and wasn't independent.
- **Brand:** measured from the site's CSS (no model), stored as a contract, linted after render.
- **Memory:** feedback stored as **checkable rules** (assertion / check / verified by), scored every run.
- **How a change is processed:** comments pinned on the preview become structured edits; three next-step suggestions
  after each delivery.
- **What Moovi lacks and should take:** (1) the bounded check-then-fix on the default path (started: `review/`,
  uncommitted), (2) the director **states its choice from the style library** instead of regex routing, (3) beat maps
  as lints (hook by 2–2.5 s, end card 15–25 %), (4) one transition grammar per style, (5) brand measured from the URL
  into a `(:Brand)` node, (6) memory as checkable rules, (7) one clock contract so every preview renders to MP4.

### promptmotion.com · **in progress**

The session "Launch video style from promptmotion.com research" is still running. Its findings go here when done.

### What both teardowns agree on (the strongest signal)

1. **Check your own work before saying done.** Both do it; Moovi's default path doesn't. #1 gap.
2. **State the direction, from a library.** Pick the style, say why in one line, let the user redirect.
3. **Taste is written as numbers and bans**, enforced by code, not by a bigger prompt.
4. **A change is a small edit to a saved plan**, never a regenerate.

## 5. The reset

Ishaan's call, posted on the board; proposed:

1. **Close the scatter today.** Commit or park everything in flight: the review layer (OpenDesign session), Afterglow
   (commit or drop; it's Python and off-repo), promptmotion (finish the write-up only). Archive every other session.
2. **Work one thing at a time on the spine,** in this order, each one measured on the R9 clips and judged blind:
   1. CHECK on the default path (finish `review/`, hook it into edits too).
   2. DIRECT: the director states style + premise + beat map from the library.
   3. One taste gate: the blind-judge ratchet on every user-facing style before it ships.
   4. Kits as styles: the best clones (R3 golden-hand 7.6, R1 crimson-poster 7.2, R5 night-glass 7.0) become castable
      parts in the edit player.
   5. Checkpoints + edit-by-words on saved plans.
3. **Owners:** Tab owns the spine (`src/edit`, router, render). Ishaan's sessions own references → kits (taste) and
   the studio/site. Claude 1 runs the board and the gates. **No session starts without a row on BOARD.md.**
