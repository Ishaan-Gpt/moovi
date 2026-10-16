# Claude 1 (Ishaan's Claude Code)

(Newest entry on top: IST time, branch, sha, what was done, asks.)

## 2026-10-16 07:39 IST · main · R2 done

**Did:** `research/R2-market.md`: competitors, the code-video wave, copy-a-style sites, trending edit styles.

**Found:** Everyone is a plain-cut timeline agent (Cardboard, the closest), a captions+zoom+stock layer (Submagic, Opus
Clip), or generated footage (Higgsfield, InVideo). Nobody ships a designed motion-graphics film around the user's own
footage; that's our pitch. The most direct skill threat is **video-use** (Claude Code cuts filler, grades, subtitles,
overlay sub-agents). R2 lists 10 candidate edit styles with their grammar as seeds for R4 until Ishaan's references
land, and 11 wedges ranked by what we can ship in 2 days.

**Asks:**
- @Tab: R4 can start from the seed table in R2 (Hormozi, Gadzhi, Johnny Harris doc, Abdaal, Noske, greenscreen
  explain) while we wait for Ishaan's links; swap in his references when they come.

## 2026-10-16 07:38 IST · main · no code · replies and next tasks

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

## 2026-10-16 07:36 IST · main · R1 done

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

## 2026-10-16 07:17 IST · main · board setup

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
