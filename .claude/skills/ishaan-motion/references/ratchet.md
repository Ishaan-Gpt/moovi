# The quality ratchet: every new film must beat the best one so far

Owner rule (2026-10-16): "with every new video the final render must only look better than the previous ones, never
worse; quality grows." Speed pressure is not an excuse: R3 shipped worse than R1 because the 5-idea drill and the
side-by-side leap check were skipped to go faster, and a font was picked without trying alternatives.

## The gate (run before any preview link is called "done")
1. **Export stills**: our six key frames for the new film, stacked over the reference's frames at the same times
   (`data/refs/judge/<id>-pair.jpg`; render via `renderAt(t)` → POST to the local sink, stack with ffmpeg).
2. **Blind judge**: a fresh subagent that has not seen the build scores the sheets, labelled A, B, C… (key kept out of
   its reach), on the fixed rubric, 1–10 each: Typography · Composition · Craft & depth · Fidelity · Premium.
   The cartoon speaker stand-in is excluded. Include the previous best film's sheet in the same round.
3. **Ratchet**: the new film's mean must be **strictly above** the previous best film's sheet **scored in the same
   judge round** (judges calibrate differently: R3 shipped at 7.6 with one judge and its sheet scored 6.4 with another, so
   never compare across judges). Equal is not better. If not, apply the judge's
   concrete fixes and re-score (same judge, same rubric). Ship only when it passes; then record its score here.
4. Never skip the gate to save time. Faster cloning comes from reuse (shared engine, world, sfx, intake), never from
   dropping review.

## Scoreboard (blind judge, same rubric)
| Film | Kit | Mean | Type | Comp | Craft | Fidelity | Premium | Note |
|---|---|---|---|---|---|---|---|---|
| R1 (ishaan-motion) | crimson-poster/motion | 7.2 | 8 | 7 | 6 | 8 | 7 | the bar after round 1 |
| R2 (ishaan-motion) | level-ladder | 4.8 | 6 | 5 | 5 | 4 | 4 | shipped below R1 (no gate yet): wrong/missing content in 2 frames |
| R3 v1 | golden-hand | 5.0 | 5 | 6 | 5 | 5 | 4 | UnifrakturCook: crude, illegible; panels underfilled |
| R3 v2 | golden-hand | 5.6 | 6 | 6 | 5 | 6 | 5 | Grenze Gotisch helped; hook face still wrong |
| R3 v3 | golden-hand | 6.8 | 7 | 7 | 7 | 7 | 6 | Cinzel hook, textured hand, one big card per panel |
| R3 v4–v5 | golden-hand | 7.0 | 7 | 7 | 7 | 8 | 6 | full labels, no seam band; title still read as flat |
| **R3 v6 (shipped)** | golden-hand | **7.6** | 8 | 7 | 8 | 8 | 7 | **current bar**: lit metal title (additive halo), punchy thumbnail, panel vignette |
| R4 rounds 1–6 | red-table | 4.2 → 5.4 → 6.2 → 6.4 | | | | | | vs L (the R3 shipped sheet) = 6.4 in the same judge round; 6.4 = equal, not shipped |
| **R4 round 7 (shipped)** | red-table | **6.6** | 7 | 7 | 6 | 7 | 6 | above L 6.4 (same judge): tall word fills the frame, scribbles inside the margins, card group lower; then the caption moved under the card and the panel face filled |
| **R5 round 1 (shipped)** | night-glass | **7.0** | 8 | 7 | 6 | 7 | 7 | vs R4's shipped sheet 4.8 **in the same round** (that judge scored R4 lower than R4's own judge did: calibration differs, only same-round comparisons count) |
| **CaptionsEasy keynote (shipped)** | L-KEY-1 (launch) | **7.2** | 7 | 7 | 7 | 8 | 7 | vs the brand's earlier slide-style film 4.8 in the same round (7.0 before the judge's fixes); the first launch film on the board |

CaptionsEasy keynote debts (judge): the Studio page's UI text is illegible at full-window scale (zoom ~1.3x into the drop zone) and the cursor passes her face; look chips ~1.8x more; 10 px between the "words" pill and "to", serif "move" on the sans baseline; the cloud as a solid struck stroke or gone; the hook's lower-row phones fainter under the line.

R5 debts (judge): the settings scroll wants a hard vertical whip blur (40–60 px); the picker card ~20% larger with the crowd centred under its row; a ghost of the outgoing card at the frame edge on the first panel swap.

R4 debts (judge): the stickers (tablet, app icon) are still flat (want bezel highlight, inner shadow, soft drop, +15% scale); the top dashed guide on the tall word barely reads at thumbnail size.

R2 (4.8) is below the bar: raise it the next time it is touched.
Open debts found by the judge (fix when the film is next touched): R2 frame "AI tools" orbit badges and the Flappy
project card; R1 watering-can scale and key labels 1–5.
