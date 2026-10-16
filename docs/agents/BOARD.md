# Board

Status: `todo` · `doing` · `blocked` · `done` · `review`. Change only your own rows. Claim a row by writing your name.
Files you are editing go in the Files column so nobody else touches them.

## Research (phase 1)

| ID | Task | Owner | Status | Output | Files |
|---|---|---|---|---|---|
| R1 | Code audit: what actually works end to end today, for generate and for edit. Rate the current positioning 1 to 10, brutally, with the gaps to 10. | Claude 1 | done | `research/R1-audit.md` | read only |
| R2 | Market scan: Cardboard, InVideo, Higgsfield, HeyGen, CapCut, Descript, Opus Clip, Submagic; the Opus 5.5 video skills and workflow folders YouTubers publish; the copy-a-prompt edit sites. What each does best, where Moovi must beat them, and how. | Claude 1 | done | `research/R2-market.md` | read only |
| R3 | The edit path today: what happens to an uploaded video, stage by stage, with measured seconds per stage, and where the 2-minute budget goes. What is missing for a pro edit (cuts, zooms, captions, b-roll, sound, colour). | Tab | done | `research/R3-edit-path.md` | read only |
| R4 | The 5 to 6 editing styles: break down each reference Ishaan posts into a deterministic spec (cut rhythm, captions, zooms and camera, transitions, sfx, music, colour, overlays, pacing per second). Sources: E1 to E6 in `research/R4-references.md` and Ishaan's I1 to I6 (R2 seeds kept as extra styles). | Tab | done | `research/R4-edit-styles.md` | read only |
| R5 | Library inventory: what exists now per category (voices, sfx, music, captions, effects, camera, UI, 3D, transitions) against the 50+ target, where each lives in code and in FalkorDB, and free, licence-safe sources to fill the gaps. | Claude 2 | done | `research/R5-library.md` | read only |
| R7 | Unified library node spec: `(:Asset {id, category, runtime[], licence, credit, ship})`, `SERVES` need edges, energy and style tags, the named queries for docs/QUERIES.md, how style-1 and visual ids map in. Includes the licence ship/don't-ship list (was R6). Spec only, no code. | Ishaan's library session (built); Tab reviews | review: code on `ishaan/library` f1c9d17, not pushed yet | `research/R7-library-node.md` | read only |
| R8 | 50 caption styles as JSON-shaped specs (font, case, chunking, highlight rule, entry motion, position), each tagged with the edit styles it suits, whether it needs word timing, original or reference-inspired. | Claude 1 | done | `research/R8-captions.md` | read only |
| R9 | Benchmark footage set and edit score: 8 to 10 raw clips (selfie, noisy room, slate, landscape, 60 s+, two speakers, non-English) with their word truth, and a scoring sheet per style (cut rate, words right, caption safe zones, loudness, seconds). Every build is measured on it. | Tab | done | [`research/R9-benchmark-set.md`](research/R9-benchmark-set.md): 9 clips (B1 local, B2 to B9 openly licensed, fetched at run time), metrics, score script outline, SPEED.md gate table | read only |
| R10 | Live edit preview: can the browser player show the source clip plus an EDL overlay (captions, zoom keys, b-roll, cards) at 30 fps on the deploy server, how long until first frame, and what must stay an encode. | Claude 1 | done | `research/R10-preview.md` | read only |

## Waiting on someone outside the agents

| ID | What | Who | Status |
|---|---|---|---|
| W1 | Reference links for the 5 to 6 editing styles (unblocks R4) | Ishaan | done: `research/R4-references.md` |
| W2 | Are Tab's 05:10 footage bugs fixed (a clip panel draws empty with 3 parallel pages; a reused clip draws empty)? They block every edit style. If nobody answers, it becomes the first build task. | Claude 2 or Tab | answered by Tab in R3: the bugs are in the visual renderer only; neither edit path uses it. Not blocking edits. |

## Build (phase 2)

Day 1 from `PLAN.md`. Day 2 rows are added when Day 1's gate passes.

| ID | Task | Owner | Status | Branch | Files |
|---|---|---|---|---|---|
| D1.1 | EDL schema v0 | Tab drafts, Claude 1 reviews | waiting for approval | | `engine/src/edit/edl.ts` |
| D1.2 | footage-edit's hear into main's transcribe/intake | Tab | waiting for approval | | `audio/stt.ts`, `tasks/intake.ts`, `tasks/script.ts` |
| D1.2b | Voice clean-up without Python (ffmpeg arnndn) | Tab | waiting for approval | | `engine/src/audio/` |
| D1.3 | Extract the EDL builder from footage-edit | Tab | waiting for approval | | `engine/src/edit/` |
| D1.4 | R10 + preview player | Claude 1 | done: merged to main 9473f58 (Ishaan asked), deploying | `ishaan/edit-preview` a4e40ba | `engine/src/edit/player/`, `apps/studio` |
| D1.5 | Caption renderer for R8 | Claude 1 | done: merged to main 9473f58 (Ishaan asked), deploying | `ishaan/edit-preview` a4e40ba | `engine/src/edit/captions/` |
| D1.6 | R9 benchmark set and score script | Tab | waiting for approval | | `engine/scripts/` |
| D1.7 | Studio route: upload → edit job; edit-style picker | Claude 1 | done: merged to main 9473f58 (Ishaan asked), deploying | `ishaan/edit-preview` a4e40ba | `router/job.ts`, `apps/studio` |
| D1.8 | MP4 renderer reads the EDL | Tab | waiting for approval | | `engine/src/edit/render.ts` |