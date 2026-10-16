# Board

Status: `todo` · `doing` · `blocked` · `done` · `review`. Change only your own rows. Claim a row by writing your name.
Files you are editing go in the Files column so nobody else touches them.

## Research (phase 1)

| ID | Task | Owner | Status | Output | Files |
|---|---|---|---|---|---|
| R1 | Code audit: what actually works end to end today, for generate and for edit. Rate the current positioning 1 to 10, brutally, with the gaps to 10. | Claude 1 | done | `research/R1-audit.md` | read only |
| R2 | Market scan: Cardboard, InVideo, Higgsfield, HeyGen, CapCut, Descript, Opus Clip, Submagic; the Opus 5.5 video skills and workflow folders YouTubers publish; the copy-a-prompt edit sites. What each does best, where Moovi must beat them, and how. | Claude 1 | done | `research/R2-market.md` | read only |
| R3 | The edit path today: what happens to an uploaded video, stage by stage, with measured seconds per stage, and where the 2-minute budget goes. What is missing for a pro edit (cuts, zooms, captions, b-roll, sound, colour). | Tab | done | `research/R3-edit-path.md` | read only |
| R4 | The 5 to 6 editing styles: break down each reference Ishaan posts into a deterministic spec (cut rhythm, captions, zooms and camera, transitions, sfx, music, colour, overlays, pacing per second). Sources: E1 to E6 in `research/R4-references.md` (R2 seeds kept as extra styles). | Tab | doing (from Ishaan's references) | `research/R4-edit-styles.md` | read only |
| R5 | Library inventory: what exists now per category (voices, sfx, music, captions, effects, camera, UI, 3D, transitions) against the 50+ target, where each lives in code and in FalkorDB, and free, licence-safe sources to fill the gaps. | Claude 2 | done | `research/R5-library.md` | read only |
| R7 | Unified library node spec: `(:Asset {id, category, runtime[], licence, credit, ship})`, `SERVES` need edges, energy and style tags, the named queries for docs/QUERIES.md, how style-1 and visual ids map in. Includes the licence ship/don't-ship list (was R6). Spec only, no code. | Claude 2 | doing (light pace; Claude 1 takes it over if Claude 2 goes quiet) | `research/R7-library-node.md` | read only |
| R8 | 50 caption styles as JSON-shaped specs (font, case, chunking, highlight rule, entry motion, position), each tagged with the edit styles it suits, whether it needs word timing, original or reference-inspired. | Claude 1 | done | `research/R8-captions.md` | read only |
| R9 | Benchmark footage set and edit score: 8 to 10 raw clips (selfie, noisy room, slate, landscape, 60 s+, two speakers, non-English) with their word truth, and a scoring sheet per style (cut rate, words right, caption safe zones, loudness, seconds). Every build is measured on it. | (unowned) | todo | `research/R9-bench-set.md` | read only |
| R10 | Live edit preview: can the browser player show the source clip plus an EDL overlay (captions, zoom keys, b-roll, cards) at 30 fps on the deploy server, how long until first frame, and what must stay an encode. | (unowned) | todo | `research/R10-preview.md` | read only |

## Waiting on someone outside the agents

| ID | What | Who | Status |
|---|---|---|---|
| W1 | Reference links for the 5 to 6 editing styles (unblocks R4) | Ishaan | done: `research/R4-references.md` |
| W2 | Are Tab's 05:10 footage bugs fixed (a clip panel draws empty with 3 parallel pages; a reused clip draws empty)? They block every edit style. If nobody answers, it becomes the first build task. | Claude 2 or Tab | asked 13:16 |

## Build (phase 2)

Filled from `PLAN.md` once research is done.

| ID | Task | Owner | Status | Branch | Files |
|---|---|---|---|---|---|
