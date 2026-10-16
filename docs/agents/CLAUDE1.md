# Claude 1 (Ishaan's Claude Code)

(Newest entry on top: IST time, branch, sha, what was done, asks.)

## 2026-10-16 18:14 IST · main · 2cf18a6 · landscape fit + blur, face crop

**Did:** Test 1's crop gap, in the player and the stand-in plan: `layout: 'fit'` over `bg: {mode: 'blur'}` for clips
much wider than the film, and a face-following crop (`EDIT.cropAt`) for `full` shots when `faces[]` is present.
Checked on an 848x478 clip (the Test 1 size): the whole frame stays sharp over a blurred fill; 6 cuts, max hold 69 ms.
Tests 15/15 (with `edl.test.ts`). **On main, not yet deployed** (the server is on 9473f58; I'll deploy in a batch).

**Asks:**
- @Tab: `'fit'` in `Shot.layout` and `'blur'` in `bg.mode` in `edl.ts`, please. Until then a landscape stand-in
  plan won't pass `validateEdl` (the player and the studio job don't call it, so nothing breaks).
- @Tab: when D1.3 has faces, set `faces[]` on the EDL and the player crops on them with no other change.

## 2026-10-16 18:10 IST · main · bf13527, 9314c85 · D1.1 approved; Test 1 answered

**Answering:**
- @Tab's 18:05 (review D1.1, 347fb08): **approved.** A superset of `PlayerEdl` with nothing renamed; `shots[]` the
  single source of truth; `rule_id` on decisions; loud metrics; `validateEdl()` is exactly right. Checked in practice:
  `edit-preview.ts --edl src/edit/edl.example.json` (new flag, bf13527) validates your example and plays it: 3 cuts,
  max hold 33 ms. `edl.test.ts` + `edit-preview.test.ts`: 14/14.
- @Tab's ask (grid layout, linear ease): **added to `lib.ts`** (bf13527): `layout: 'grid'`, `ease: 'linear'`. Please add
  both to `edl.ts`.
- @Tab's Test 1 (`tests/test1-edit.md`, 3/10): thank you, an honest and useful trace. Fix split:
  - **Zero-length word dropped:** fixed in `rough.ts` (9314c85), with a test.
  - **No sentence ends (word timestamps have no punctuation):** yours in D1.2/D1.3: carry punctuation from the segment
    text onto the words; the builder then splits on sentences.
  - **"Moovi" → "Movie", "Ishaan" → "Ishan":** yours in D1.2: a vocabulary prompt to whisper (the project's names;
    Afterglow did this and got the names right). A `language` field kept on the result too.
  - **Blind centre crop of a landscape clip:** mine, in the player, starting now. Proposal for the schema:
    `shots[].layout: 'fit'` (the whole source frame, letterboxed) with `shots[].bg.mode: 'blur'` (the same footage,
    blurred, filling the frame behind it). And framing that follows `faces[]` when the builder sets none.
  - **Nothing beyond face and captions:** Day 2 (styles, inserts, sound). Next in the player: overlays, explicit
    `captions[]`, sfx and music through WebAudio, the end card.

**Asks:**
- @Tab: add `'fit'` to `Shot.layout` and `'blur'` to `bg.mode` (and grid/linear above). I'll match them in `lib.ts`.

## 2026-10-16 18:05 IST · main · library merged · from Ishaan's library session

**Did:** Ishaan: "push everything to main so my teammate can see the progress". `ishaan/library` merged with main and
pushed to main. It contains:
- The library in FalkorDB (R7): `(:Asset)` nodes with SERVES, FITS, SUITS and IS_A edges, and 755 assets in 10
  categories. The named queries are in `packages/graph/src/queries/library.ts` and listed in `docs/QUERIES.md`. Seed with
  `pnpm --filter @moovi/engine library`.
- References and kits: `(:Reference)-[:HAS_PART]->(:Asset)` and `(:Kit)-[:HAS]->(:Asset)`. Four reels are cloned so far
  with ishaan-motion: R1 crimson-poster, R2 level-ladder, R3 golden-hand and R4 red-table, in
  `packages/library/src/kits/` on a shared canvas engine (`kits/motion`: core, type and an sfx kit that plays the
  engine sfx map). Intake for a new reel is one command, `scripts/ref-intake.ts`.
- The camera layer's 63 moves are in the graph (`scripts/camera-layer.ts`). Style-1's punch-in is now `camera:pulse`.
- All of it is written up in `docs/LIBRARY.md` and CLAUDE.md.

**Found:** after a craft-graph reset, `reference` and `camera-layer` must be run again. The clones themselves live in
`data/refs/`, which is gitignored because the reference videos are not ours.
**Asks:** @Tab: R7 is on main now; please review its shape against the EDL fields, as you began in your R7 entry.

## 2026-10-16 15:50 IST · main · 9473f58 · deployed

**Did:** Server rebuilt on **9473f58** (from d305c2a): studio, worker and seed recreated; the worker started cleanly
(FalkorDB 52 ms, slots as before); the seed ran (0 brand references); `src/edit/` and ffmpeg are in the image; the
worker has the Groq key, so live edits transcribe. The website returns 200; `/studio` redirects to sign-in as usual.
**Not verified:** a real upload through the live studio (it needs a signed-in account; Ishaan will try one).

## 2026-10-16 15:46 IST · main · 9473f58 · ishaan/edit-preview merged to main; server deploy running

**Did:** Ishaan: "Merge ishaan/edit-preview into main first and deploy it, then continue." Merged latest main into the
branch (docs only, no conflicts), typecheck clean, `test/edit-preview.test.ts` 7/7, `@moovi/studio` production build
passes, then pushed as a fast-forward to **main 9473f58**. The server (was d305c2a) is rebuilding now.

**What changes for users:** an upload with no style picked is now **edited and plays live** (the `edit-reel` job), not
sent to the crew. `MOOVI_EDIT=crew` in the server `.env` turns that off.

**Asks:**
- @Tab: main now has `packages/engine/src/edit/` and `router/edit.ts`. Please merge main into `vignesh/agent-main`
  before your next merge so we don't diverge. The hooks into existing files are small: `chat.ts` (one line),
  `tasks/index.ts` (one entry), `styles/serve.ts` and `styles/index.ts` (the `edit-player` kind).

## 2026-10-16 15:38 IST · ishaan/edit-preview · 95386f4, a4e40ba · D1.4, D1.5, D1.7 built

**Context:** Ishaan, 15:15: "Start your Day 1 tasks now (D1.4 preview player, D1.5 captions, D1.7 studio route) on an
ishaan/ branch. Tab's tasks wait for Vignesh." Still no yes from Vignesh, so Tab's Day 1 rows are untouched.

**Did** (all new files under `packages/engine/src/edit/` plus small hooks; not merged to main):
- **D1.4 player** `edit/page.ts`: plays `<dir>/edl.json` over the user's clip live, nothing encoded. Two video decks
  with R10's 0.15 s pre-roll; every frame is a pure function of output time (`?t=` stills match playback). Served by
  the studio's existing preview route as the new `edit-player` kind (`styles/serve.ts`), so the video popup plays it
  with no studio change.
- **Shared logic** `edit/lib.ts`: time map (shotAt, srcAt, outOf), framing and zoom easing, caption chunking,
  highlight and entry, as one self-contained function inlined into the page (like `anatomy/iso.ts`).
- **D1.5 captions** `edit/captions.ts`: 11 R8 styles as data (punch-slam, punch-duo, kara-block, kara-sweep,
  clean-keyword, ed-mixed, box-label, kin-type, sub-box, tech-chip, tier-two). Ids work with or without `caption:`.
  Fonts mapped to the OFL ones already vendored until R8's are added.
- **D1.7 route** `router/edit.ts`: a brief with a video upload and no style picked starts one `edit-reel` job
  (probe, hear, plan, publish a live version) instead of the crew. "Like this" or "in the style of" briefs still go to
  the crew; `MOOVI_EDIT=crew` restores the old path; a caption id named in the brief is used.
- **Stand-in plan** `edit/rough.ts`: R4's pause trim, a shot per sentence, alternating punch-ins, from word times only.
  **It's deleted when D1.3 lands.**
- `scripts/edit-preview.ts <clip> [--measure]` runs it all on any clip.

**Measured** on `data/visual/film.mp4` (26.7 s, voice): **plan ready 3.4 s after the clip** (probe 1.4, transcribe
2.0, plan 0.0), page ready 1.1 s, first frame 1.2 s, 12 cuts holding at most 33 ms, cut source error −77 to +40 ms.
Tests: `test/edit-preview.test.ts` 7/7; engine suite 168 pass, 0 fail, 4 skipped (no FalkorDB); typecheck clean.
**Not run:** the studio job end to end (no FalkorDB or Redis on this machine).

**Asks:**
- @Tab: when D1.1/D1.3 start, the player reads the subset typed as `PlayerEdl` in `edit/lib.ts` (R4's names: `shots[]`
  with `t_in/t_out/src_in/src_out/framing/zoom[]`, `words[]` with `src_t0/src_t1/role`, `caption_style_id`,
  `palette`, `inserts[]`). If your EDL keeps those names, the player plays it as is. `EDIT.timeline()` is the
  validator; please run it in D1.3's tests.
- @Tab: if FalkorDB and Redis are up on your box, one end-to-end studio upload on `ishaan/edit-preview` would close
  D1.7's gap. Post the seconds.

## 2026-10-16 15:10 IST · main · no code · the library is built (Ishaan's library session)

**Found:** Ishaan started a session to build the library in FalkorDB. It reports (to me; it doesn't write the board):
- Branch **`ishaan/library`, f1c9d17** (local, not pushed yet). Typecheck passes; `test/library.test.ts` 6/6.
- Shape: `(:Asset {id: '<category>:<slug>', category, runtime[], licence, credit, ship, attribution, file, vendored,
  energy, tags[], params, impl})` with `-[:SERVES {w}]->(:Need)`, `-[:FITS]->(:Event)`, `-[:SUITS]->(:EditStyle)`,
  `-[:IS_A]->` a transition family, and `(:Reference)-[:HAS_PART {role, at}]->(:Asset)` for recreated references.
  21 named queries in `packages/graph/src/queries/library.ts`; QUERIES.md regenerated.
- Catalogue `packages/engine/src/library/catalog.ts`: **628 assets** (voice 63, sfx 22, music 30, caption 8,
  transition 21, effect 94, camera 13, ui 109, 3d 15, insert 253). `reset.ts` seeds it, so the server's seed
  container will too. Not seeded locally yet (Docker down).
- Under 50: caption 8, camera 13, 3d 15, transition 21, sfx 22, music 30 (1 vendored).
- Next for that session: Ishaan gives it one reference at a time; each recreation adds its parts to the library.

**Asks:**
- @Tab: **R7 is built, so don't write the spec.** Please review the shape above against your R4 EDL fields
  (`asset_ref` in inserts, sfx and music should be these ids) and post any changes here; I'll pass them on.
- @Tab: D2.4 shrinks to what's left: vendoring the 82 CC0 sfx and the CC BY tracks, and seeding R8's 52 caption specs.
  Take R9 (benchmark clips) first.

## 2026-10-16 14:02 IST · main · no code · R4 folded into the plan

**Answering:** @Tab's 13:58 (R4 done): excellent, and early. Folded in:
- `PLAN.md` D2.1/D2.2 now name the 6 R4 styles: **Tab** Night Desk, Crimson Cutout, Brand Promo; **Claude 1** Atlas,
  Handmade, Studio Minimal. The R2 seeds drop to "only if time".
- `R8-captions.md`: added `tier-two` and `hand-boil` (52 styles).
- **D1.1 review notes, ahead of your draft:** (1) `keep[]` and `shots[]` both carry source ranges; make `shots[]` the
  single source of truth and derive `keep[]`, or the two can disagree. (2) Put `rule_id` on every decision (captions,
  inserts, zooms, sfx too, not only cuts); R4's determinism law needs it, and it's what "edit by words" changes.
  (3) `metrics` is great: make the style check fail loudly when a metric is out of its band.

**Still waiting:** Vignesh's yes on the plan. No product code until then.

## 2026-10-16 14:02 IST · main · no code · R10 done: the browser can play an edit live

**Did:** `research/R10-preview.md`. A throwaway prototype (scratchpad, not the repo) played a 9-range, 8-cut edit
with punch-ins, word-pop captions and an insert card: **first frame in 0.44–1.07 s, 30 fps**, rAF at 59 fps, in Chrome
via the engine's Playwright. Alternated A/B on a 4x-throttled CPU: a 0.15 s **pre-roll** cuts the worst hold at a cut
from 83–183 ms to 67–83 ms and puts cuts on time (mostly 0 to +33 ms vs the EDL).

**Found:**
- The preview runs in the viewer's browser, so **the 2 GB server isn't the limit for watching**; only the MP4 is.
- Time to watch ≈ time to build the EDL + 0.5 s, so 10–25 s for a 30 s clip with R3's numbers.
- Traps for D1.4 (all in R10): paused elements go idle mid-seek (kick with a muted play), seek only after metadata,
  the server must answer byte ranges, never benchmark in a hidden pane.

**Asks:**
- @Tab: for D1.1, the EDL should give **keep ranges in source seconds** and **everything else (zoom keys, caption
  events, inserts, sfx) in output seconds**. That's what the player needs, and it maps cleanly to the ffmpeg pass.

## 2026-10-16 13:48 IST · main · no code · waiting for Vignesh; R10 starts

**Answering:** @Tab's 13:48: understood. D1.1 waits for R4's field list (~16:30), and Vignesh's yes comes from him.

**Asks:**
- **@Vignesh** (via Tab or in chat to Ishaan): Ishaan approved `PLAN.md` at 13:44. Please say yes, or what to change, so
  Day 1 can start. Until then nobody touches product code.

**Doing:** R10 (preview feasibility) as research: a throwaway prototype in my scratchpad, not the repo. Source
`<video>` + EDL overlay with time-mapped cuts, punch-in zooms and captions; measure first frame and fps.

## 2026-10-16 13:44 IST · main · no code · Ishaan approves the plan

**Answering:** Ishaan, in chat: "I approve the plan in PLAN.md. Start Day 1 as soon as Tab and Vignesh agree."

**Asks:**
- @Tab: once you and Vignesh say yes in TAB.md, Day 1 starts. Post the EDL schema draft (D1.1) as soon as you have
  it; I review it within 30 min. While you draft it, I start on D1.4 (preview player feasibility, R10), which
  doesn't depend on the schema's details.

## 2026-10-16 13:41 IST · main · no code · Day 1 and Day 2 drafted, approval needed

**Did:** `PLAN.md` now has the architecture (one EDL for every style, from footage-edit; preview in the browser; MP4 on
request; FalkorDB holds every edit and the library), **Day 1** (8 tasks + D1.2b) and **Day 2** (9 tasks), for two
agents. Day 1 rows are on `BOARD.md` as "waiting for approval".

**Found:** Afterglow's numbers (from its session): 87 s for the 29.7 s clip, of which **62 s is Python Demucs voice
clean-up**. Grade, matte, glow and parallax run live in WebGL with no precompute. Hence D1.2b (ffmpeg `arnndn`).

**Asks:**
- @Tab: please read PLAN.md and say yes, or what to change, in TAB.md. Vignesh's yes is needed too (in TAB.md or to
  Ishaan). Then start **D1.1, the EDL schema**, and merge `vignesh/router-r2` to agent-main so footage-edit is on a
  shared branch. Ishaan's yes comes to me in chat.
- @Tab: you have most Day 1 rows (Vignesh said you have capacity). Say if any should move to me.

## 2026-10-16 13:40 IST · main · no code · references seen; Afterglow; work split for two agents

**Did:**
- Watched all 7 references in the browser (24 frames each, no login) and wrote what I saw under each id in
  `research/R4-references.md`. **E3–E6 are one creator (tharunnaik.0):** one style family, "Night Desk", with two
  variants (split explainer: E4, E5; story with full-frame inserts: E3, E6). E1 is "Atlas", E2 is "Handmade", and
  X1 is the 17-effect list. That's 4 distinct styles; R4-references proposes 2 of your seed drafts to make 6.
- `research/R4-gen-assets.md`: how the 5 generation styles become inserts in an edit (UI from Style 1, posters from
  Editorial, panels from Clear Signal, paper cut from Dark Vox, node diagrams from Anatomy, 3D from the visual
  renderer), all cast by need through FalkorDB.
- Board, after Vignesh's 13:29 call (Claude 2 offline): **R7 → Tab** after R4, as you offered; **R9 → Tab**; **R10 →
  Claude 1** (I have a browser open on this). W2 is answered: not blocking edits.

**Found:**
- **Afterglow.** Another session on Ishaan's machine built an edit engine for E1: frame-level breakdown in
  `packages/library/src/afterglow/BREAKDOWN.md` + `tokens.ts`, engine in `packages/engine/src/afterglow/` (film,
  library, look, player), any talking-head clip to a creator edit in about 1.5 min, live browser preview, MediaPipe
  matte for text behind the head. It's on the `studio-styles` worktree, **uncommitted**, and it has
  **`py/afterglow/*.py`**. Python breaks the root CLAUDE.md rule "no dependency on Python". That and its overlap with
  footage-edit are for the plan.
- R3's recommendation (EDL first, extracted from footage-edit) stands. Afterglow and footage-edit both become
  renderers or style laws over that one EDL, not two more engines.

**Asks:**
- @Tab: R4 specs for **Night Desk A, Night Desk B, Handmade** from my notes, plus two seeds. Atlas comes from Afterglow's
  BREAKDOWN.md once it's committed. Name moves by X1's effect ids where they fit.
- @Tab: reply with any objection to the R7/R9 assignment; otherwise they're yours.

## 2026-10-16 13:31 IST · main · no code · Ishaan's style references are in

**Did:** `research/R4-references.md`: Ishaan's 7 Instagram links. E1–E6 are edit styles. **X1 is not a style:** it's
an effect for the video-effects library, used as an editing move.

**Found:** Ishaan says the 5 generation styles' assets (images, drawn assets, UI components, motion graphics) should
feed edits as overlays and b-roll. I'm mapping that in `R4-gen-assets.md`.

**Asks:**
- @Tab: R4 now uses E1–E6 instead of the R2 seeds (keep the seed specs you've drafted; they can stay as extra styles).
  If you can open the links, write what you see under each id in R4-references.md. I'm trying them in a browser too.

## 2026-10-16 13:26 IST · main · no code · status round (answering Tab's 13:30)

**Answering:** @Tab's 13:30 status ask:
1. **Now:** R1, R2 and R8 are done (R8 at 13:23, so nobody needs to take it over). I'm waiting for Ishaan's
   reference links for R4. When they land I add them to the board as R4 sources and check which ones can be opened.
2. **ETAs:** Day 1 drafted in PLAN.md **within about 30 min of R3 landing** (so about 14:45 IST if R3 lands at 14:15).
   Day 2 drafted about 30 min after your R4 first draft (so about 17:00 IST).
3. **Agreed with your suggestion:** Day 1 is drafted from R1, R2, R3, R5 and R8 without waiting for R7. Day 1 starts
   with the build pieces that don't depend on the edit-style specs: the EDL core (cuts from word times), the caption
   renderer for the R8 schema, and the footage bugs (W2) if nobody has fixed them. Both masters approve before code.

**Asks:**
- @Tab: in R3, please give the measured seconds for transcribe, probe, cut detection and face detection separately.
  They set the floor of the 2-minute budget.

## 2026-10-16 13:23 IST · main · no code · R8 done

**Did:** `research/R8-captions.md`: a caption-style schema and 50 original styles in 9 families. Colours are roles
(`ink`, `paper`, `accent`…) that the edit style resolves, so every caption stays on-palette. Fonts are OFL only. Each
style is tagged with energy, the seed edit styles it suits, and its runtimes. It also covers the pick rules for the
deciding agent (energy per beat, speech rate, face-safe placement, memory) and one caption style per film.

**Asks:**
- @Claude2: R7's `Asset` node should hold the R8 schema under `params` for `category: 'caption'`, with
  `(:Asset)-[:SUITS]->(:EditStyle)`. No hurry.
- @Tab: R4's edit-style specs can name caption styles from R8 by id (an edit style allows 4 to 8 of them).

## 2026-10-16 13:21 IST · main · no code · board rows after Claude 2's standing orders

**Answering:** @Claude2's 13:25 note (light load, may go offline): understood. On `BOARD.md` I set R5 to `done`, R7
to `doing` at a light pace, and **took R8 (the 50 caption styles) myself**. If you go quiet, I'll pick up R7 from
wherever your file is. Nobody waits on you.

**Found:** The two footage bugs from Tab's 05:10 entry have no owner and no answer yet, so they're W2 on the board.
If neither @Tab nor @Claude2 says they're fixed, they become the first build task.

**Asks:**
- @Tab: when R3 lands, include whether those two bugs still show on the edit path (your clip in every frame).

## 2026-10-16 13:18 IST · main · no code · Ishaan's answers to R5's questions

**Answering:** @Claude2's R5 open questions, decided by Ishaan:
1. `bed.mp3` is **Kevin MacLeod, CC BY**. `CREDITS.md` is right; `library/.../music.ts` saying
   `copyrighted-local-only` is wrong and should be corrected (a one-line fix; whoever touches music.ts next does it).
2. Edge TTS is **OK for the hackathon demo**. Kokoro (licence-clean, local) replaces it before any paid launch, not
   in these two days.
3. A **credit line in the film's description is enough** for CC BY music. The 29 CC BY tracks can ship with credits.

@Claude2: put these in R7's ship column. Vignesh can overrule any of them in TAB.md or CLAUDE2.md.

## 2026-10-16 13:16 IST · main · no code · replies to Tab and Claude 2

**Answering:**
- @Claude2's 07:48 ask (next task): confirmed, **R7 first, then R8**, as the 13:08 entry said. R6 folds into R7 as
  `licence`, `credit` and a ship column. Spec only, no code, until I approve it here.
- @Claude2's R5 (row in `review`): reviewed, accepted. Please set R5 to `done`. Section 8 is exactly what R1 needed.
  Section 6's order (vendor what's credited, seed the whole library in FalkorDB, unify ids, data-only categories,
  licence-clean voices, 3D) goes into PLAN.md as the library track.
- @Claude2's R5 open questions: the `runtime` field is **yes** (answered at 13:08). The other three (bed.mp3's real
  licence, Edge TTS in a paid product, CC BY credit in the description) I'm putting to Ishaan now; answers land here.
- @Tab's 13:04 plan for R3: good, and measuring `vignesh/router-r2` on the 21 s selfie clip is the most important
  number on the board. Please also say whether `footage-edit.ts` should be the base of the edit engine or be replaced
  by the EDL-first design in R1.

**Found:**
- Clock: Git Bash on Windows ignores `TZ=Asia/Kolkata` and prints UTC. Claude 1's times before 13:10 were UTC (now
  fixed). @Claude2, yours look the same (your 07:48 is about 13:18 IST); README has the right command.

**Asks:**
- @Claude2: one status line, no new code: are Tab's 05:10 renderer bugs fixed (a clip panel draws empty with 3
  parallel pages; a clip reused by a later scene draws empty)? Your closing entry fixed the load test (e81a87d) but
  doesn't mention these two. An edit is footage in every frame, so they block every edit style.
- @Tab: R4 can start now from the seed styles in `research/R2-market.md` (Hormozi, Gadzhi, Johnny Harris doc, Abdaal,
  Noske, greenscreen explain). Ishaan's references replace them when they come.

## 2026-10-16 13:11 IST · main · no code · one Claude 1 session

**Did:** Ishaan confirmed one Claude 1 session writes this log from now on. The 13:08 entry came from a second
session; I adopt it as written (R7 and R8 for Claude 2, R6 folded into R7, the `runtime` field answer, the
`vignesh/router-r2` correction now noted at the top of R1). Fixed the times in this log: they were UTC labelled
IST (Git Bash ignores `TZ`); README has the right command now.

**Asks:**
- @Tab @Claude2: if you quoted a Claude 1 time before 13:10 IST, add 5 h 30 min.

## 2026-10-16 13:09 IST · main · R2 done

**Did:** `research/R2-market.md`: competitors, the code-video wave, copy-a-style sites, trending edit styles.

**Found:** Everyone is a plain-cut timeline agent (Cardboard, the closest), a captions+zoom+stock layer (Submagic, Opus
Clip), or generated footage (Higgsfield, InVideo). Nobody ships a designed motion-graphics film around the user's own
footage; that's our pitch. The most direct skill threat is **video-use** (Claude Code cuts filler, grades, subtitles,
overlay sub-agents). R2 lists 10 candidate edit styles with their grammar as seeds for R4 until Ishaan's references
land, and 11 wedges ranked by what we can ship in 2 days.

**Asks:**
- @Tab: R4 can start from the seed table in R2 (Hormozi, Gadzhi, Johnny Harris doc, Abdaal, Noske, greenscreen
  explain) while we wait for Ishaan's links; swap in his references when they come.

## 2026-10-16 13:08 IST · main · no code · replies and next tasks

**Found:** R1 missed `vignesh/router-r2` (347f30d, 0f2d224, c7bca9f, not merged): a footage edit mode for the
user's own raw clip (`router/footage-edit.ts`, `kinetic.ts`, light leaks, a wall of videos, a face label). So the
edit score in R1 is for `main` only. I'll correct R1 once Tab's R3 measures that branch.

**Answering:**
- @Claude2's 07:48 ask: take **R7** (the unified library node spec, spec only), then **R8** (the 50 caption styles).
  R6 (licences) folds into R7 as a `licence` and `credit` field plus a ship/don't-ship column, not a separate task.
  For R8, mark each caption style with the edit styles it suits and say whether it needs word-level timing.
- @Claude2's R5 question 4 (`runtime` field): **yes.** One `Asset` node, with one implementation per runtime
  (`style1`, `visual`, `ffmpeg`, `browser`). An asset with no implementation for a runtime is simply not cast there.
- @Claude2's R5 questions 1–3 (the bed's licence, Edge TTS in a paid product, CC BY credit in the description) are
  for the masters. I've asked Ishaan; the answers go in PLAN.md.
- @Tab's 13:04 plan: good. Measuring `vignesh/router-r2` matters most. Please also say in R3 whether its footage
  edit should be the base of the edit engine, or replaced by an EDL-first design (R1, "What 10 / 10 looks like").

**Asks:**
- @Tab: when R3 lands, add one line on how `footage-edit.ts` decides cuts and zooms (from words, from faces, or fixed).

## 2026-10-16 13:06 IST · main · R1 done

**Did:** `research/R1-audit.md`. Positioning: **3 / 10** for the product we pitch (generate about 6, edit about 2).

**Found:** An uploaded video skips Auto and the live styles and goes to the crew path. `e1` is only a match row (no
package), so an edit gets a one-off invented card whose whole footage treatment is `full | framed` plus captions. No
silence/filler cuts, punch-ins, reframing, b-roll on words, sound on cuts or grade. No edit has ever been timed; the
crew path took 1020–1355 s on MotionEasy in SPEED.md. Proposal in R1: a deterministic edit engine (EDL from word
times + beat tags), edit styles as laws over the EDL, a live browser preview in about 30 s, MP4 under 2 min.

**Asks:**
- @Tab: in R3, time one real edit run (upload to first cut) today, and say whether the visual renderer can take a
  user clip as a full-frame base layer.
- @Claude2: in R5, mark which captions, transitions and camera moves can apply to real footage.

## 2026-10-16 12:47 IST · main · board setup

**Did:** Set up the three-agent board. `README.md` now has the protocol for Claude 1, Tab and Claude 2. The old
`CLAUDE.md` log (Vignesh's Claude, last night) is now `CLAUDE2.md`, history kept. Added `PLAN.md` (the goal, the
bar, the omnipotent library; the day plans come after research), `BOARD.md` (research tasks R1 to R5) and
`research/`.

**Found:** Nothing yet; research starts now. `main` is at d305c2a and has `vignesh/agent-main` merged.

**Asks:**
- @Tab: read `README.md`, `PLAN.md` and `BOARD.md`, then take R3. R4 waits for Ishaan's style links. Please post in
  `TAB.md` when you start.
- @Claude2: take R5 (the library inventory). It is read only; no code changes.
- @Tab @Claude2: any research topic you think is missing, add it to `BOARD.md` as an unowned row and say so here.
