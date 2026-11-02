# Long form #1 for the new channel: plan to 10/10 before any build

Status: **plan, waiting for Ishaan's picks** (concept, channel, voice, public repo). Nothing is built until he says yes.
The why is in `WHY-omi-claude-shorts.md`. The rules this must pass are ishaan-motion 1.17.70, the global CLAUDE.md, and the speed gate
(`docs/agents/speed/`).

## Three concepts, ranked

| | Concept | Proof in the first 5 s | Why it can win | Risk |
|---|---|---|---|---|
| **1 (pick)** | **"I gave Claude one hour to make a 3D animated film"**: a real, timed run of the one-hour pipeline that makes a 60-90 s stickman short, told with the measured story of why it used to take 5 days | the finished stickman short on one side, a running clock stopping at its real time on the other | Proof plus a clock gives a built-in suspense line (will it make the hour?). It showcases the newest skill (the speed gate), every number is real and from this week, and it ends with a free skill | The run must be real. If it takes 1 h 40 min, the film says so, and that becomes the fall beat (the why allows an honest failure) |
| 2 | "I taught Claude my taste: 70 corrections later, it makes my films": the rulebook that grows from every correction | the same shot at 2/10 beside 8/10 | Unique (nobody shows a taste loop) and evergreen | Weaker suspense; there is no clock and no single run to follow |
| 3 | "Claude made a MrBeast-style game show with 50 stickmen" | the 50-cast wide and a hero intro | Strong visuals, and the cast already exists | It belongs to the Ordinary Odd format; on a new channel it reads as a rerun of the episode |

**Pick: concept 1**, with concept 2's taste loop as one chapter (it explains why the one-hour film still reaches 8/10).

## Beat sheet (concept 1, 16:9, about 10 min; script written later in author's English, only after the pick)

| Time | Beat | The why it serves |
|---|---|---|
| 0:00-0:20 | The finished stickman short plays; a clock beside it stops at the real run time. The number that hurts: "the last one took five days" | proof first; the clock is the hook |
| 0:20-0:40 | Promise: how the hour was spent, where it nearly broke, and the free skill | three-part promise with the failure in it |
| 0:40-2:00 | Five days, measured: where the hours went (a ranked bar chart: rework over half, look and kit work, repeat exports, waits) | a number every 10-20 s |
| 2:00-3:00 | The machine twist: a laptop with a tiny built-in GPU, 220 ms a frame, the same export at 224 or 417 ms depending on what else runs. Tip: "time the frame before you blame the code" | the tool and the machine as characters; quotable rule |
| 3:00-4:15 | The taste loop: 70 corrections became rules; the preflight fails before a build starts. Tip: "every correction becomes a rule, or you pay for it twice" | Ishaan's edge (concept 2 folded in) |
| 4:15-6:15 | The run, against the clock: script, one voice, kit reuse, three builders, a blind judge per scene, export as scenes pass | the partnership on screen; the suspense line |
| 6:15-7:15 | **The fall (about 60%)**: whatever really went wrong in the run, measured. If nothing broke, the paper slip that jumped at an export split (SSIM 0.974, fixed with a 1 s pre-roll) | the fall at about 57% |
| 7:15-8:00 | The self-correction: a note or estimate of ours that was wrong, said plainly | a twist that costs the narrator something |
| 8:00-9:00 | The result in full, the short played clean | payoff |
| 9:00-9:40 | Free: the `ishaan-3d-stickmen` skill on GitHub (cast rig, kit, speed gate, exporter) | reciprocity |
| 9:40-10:00 | Open loop: the next video already working | a reason to subscribe |

## How it looks (100% in code; options for Ishaan, nothing chosen silently)
- **Screens rebuilt in code, not recorded:** a terminal and editor kit in canvas that types the session's real commands and
  prints the real numbers from the logs, so every frame is sharp, on-palette and free of private paths or keys.
- **Data as motion:** ranked hour bars, the frame-time meter, the SSIM seam split, all animated from the measured numbers.
- **The stickman short itself** in its own bright pastel world, with the existing cast kit.
- **Palette:** derived from the subject per the global rule, offered as 2-3 rendered options. Not decided here.
- **Voice:** one voice, one continuous read. The options are in the questions below.
- **Captions:** a system chosen from 2-3 rendered options, inside the face and safe-area rules (no faces on screen except the stickmen).

## The 10/10 gate (all of these before Ishaan sees anything)
1. Preflight GO at plan, build and export (`docs/agents/speed/preflight.mjs`), and tlog rows for every stage.
2. Script: a blind cold-reader scores 8.5 or more; author's English; a number every 10-20 s; two quotable tips; the fall at
   about 60%; every claim traced to a log or a measurement in this repo.
3. The in-video one-hour run is real and timed by `tlog.mjs`; the film shows the true time, even if it is over the hour.
4. Every scene passes a blind judge at 8 or more on `sheet.mjs` sheets of its export, with one fix round at most.
5. The whole film passes a blind judge at 8 or more against the reference's frames, in the same round (the ratchet).
6. Sound: one voice; the bed about 7.5-8.5 LU under it; master at -14 LUFS; peaks under -1 dBTP.
7. Gates: no black frame, no pop at a split, no text on a face, a visible change every 1.2-2 s.
8. The upload pack (title, description, chapters, tags, thumbnail options), with nothing published without Ishaan's yes.

## The `ishaan-3d-stickmen` skill
A packaged copy of what already exists, written as a skill:
- `SKILL.md`: the order (preflight, script, voice, kit, contract, scenes, per-scene judge, export), the staging rules
  (RULES-8: only actions the rig can nail), and the look bible numbers (LOOK.md).
- `kit/`: the cast rig and wardrobe (`cast.js`), studio, sets (arena, sky), palettes, graphics, the look stats tool.
- `tools/`: `preflight.mjs`, `tlog.mjs`, `export.mjs` (with the pre-roll), `sheet.mjs`, the capture server.
- `examples/`: the one-hour short from the video, with its TIMINGS.md.
- **Public on GitHub only with Ishaan's yes** (repo name, licence, what is included). The reference media is never included.

## Honest time estimate (from the speed plan's measured numbers, not a guess at "an hour")
| Work | Estimate |
|---|---|
| Kit day: the screen/terminal kit, the chart kit, the clock HUD (new, so it is not part of a film's hour) | 2-2.5 h |
| The real one-hour run (the stickman short inside the video) | 1-1.5 h, timed |
| Long form: script and voice | 40 min |
| Long form: about 45 scenes from the kits, 3 builders, judge per scene | 2.5-3 h |
| Export: a 10-min 2D/canvas film at a measured 2.5-3.6 s of render per film second, overlapping the builds | 25-40 min |
| Whole-film judge and one fix round | 45 min |
| The skill packaged and checked | 45 min |
| **Total** | **about 8.5-10 h of work, over 1-2 days** |

This is not the one-hour target. The video is 10 minutes and needs a new screen kit. The next film on this channel reuses the
kit, and that is where the hour applies (PLAN.md, speed: 68 min to 17 min with a kit reused).
