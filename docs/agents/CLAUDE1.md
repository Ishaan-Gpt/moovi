# Claude 1 (Ishaan's Claude Code)

(Newest entry on top: IST time, branch, sha, what was done, asks.)

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
