# The one-hour film: speed plan for every video session

Written 2026-11-02 by the speed lab session. Every number here was measured on Ishaan's PC, either in the logs the film
sessions kept or in timed tests run today, and anything that was not measured says so. Read it with `PREFLIGHT.md`
(the gate every session runs) and `CHECKLIST-PC.md` (what Ishaan does on his PC).

## 0. What this PC really is (measured 2026-11-02)

This PC is not a render machine, and the plan is built around that. It has an AMD Ryzen 5 7520U (4 cores, 8 threads), a laptop
chip with **integrated Radeon graphics** that has 512 MB of dedicated memory, 15.2 GB of usable RAM and one 476 GB drive.
There is **no NVIDIA card, so NVENC is not available**. The hardware encoder here is AMD's `h264_amf`.

On this GPU one frame of a 3D Stickman Games page takes **about 220 ms of render**. The JPEG grab and the transfer add
only 9 ms, so the render is the cost and the export script is not.

## 1. Where the hours go (ranked by hours lost)

Sources: every `TIMINGS.md` under `docs/agents/story/`, `loop/LOOP.md`, `ai-disappeared/stick-games/ep1/RULES-8.md`, the
export logs in each film's `out/`, file times of the film folders, `film-in-an-hour.md` and the hours ledger
(claude.ai/artifact/V9NYr83JaoeSTuuL8iqE6h). "About" means the cause is clear but the minutes are added up from
several logs.

| # | Cause | Hours lost (evidence) | What it looks like |
|---|---|---|---|
| 1 | **Fix rounds after a first cut** (rework) | **15-20 h over 12 days**: AirPods 2.5 h of fixes after a 2 h v1; Fetaccino rounds 4-6 65 min, then rounds 7-13 not logged; screen-time 4 judge rounds stuck near 5/10; Stickman clip 3 took 6 judge rounds (5, 6, 6, 7, 7, 6.5) and clip 4 three; Gandhi long form v1 to v8 over 2 days; API vs MCP round 2 cost 35 min and scored lower | A whole film is built, then judged, then rebuilt. Stickman Games ep 1 (7.6 min) took 5 days, 27 Oct to 1 Nov |
| 2 | **Look, kit and reference work before any film** | **about 10 h**: the reel-style gate 4 h (2 h decode and skeptic, 1.5 h look); the 5-animal film 5 h because shots were redone each time a model improved; atom-channel kit and three character options 2-3 h | Models and shots built at the same time; a look changed mid-build |
| 3 | **Renders and exports, mostly repeats** | **about 7 h logged**: Stickman ep 1's logged exports 2.5 h (14 runs); Gandhi long form 9 full exports, 3.0 h, for a 6-min film; paper film 63 of 103 min; cstack 22 of 55 min | Every fix round re-exports the whole film, unchanged scenes included |
| 4 | **Rules known in advance but found after building** | counted inside #1: "every fix after v1 was a rule known in advance" (AirPods); the Draft C look board broke a rule written that morning; teaser Short v1 got 4/10 for known caption rules | No forced re-read of the newest rules before building |
| 5 | **Waits on a shared CPU and GPU** | **1-2 h**: the paper film rendered at 9.4 s per film second under load against 4.5 when quiet; `tsc` took 8 min under load; 8 stills took 25 min under load. Today the same export ran at **417 then 224 ms a frame** ten minutes apart | Several sessions export at once; nothing queues them |
| 6 | **Cold page loads for every check and export** | **about 1 h**: a page takes 23-144 s to load (measured today: 23-62 s); cstack spent 5 min 41 s on 15 stills that each started a browser | Checks that start Chrome each time instead of seeking a warm page |
| 7 | **Session restarts and the account limit** | **about 1.5 h**: screen-time lost two restarts that stopped every builder; 9 builders at once hit the usage limit (about 50 min) | Too many agents at once; long jobs not run in the background |
| 8 | **Disk full** | **0.3 h plus crashes**: the paper film hit 0 MB free twice (a 6 min retry, a chunk crash); C: had 0.16 GB free at the last check before today | Old bundles, renders and Docker data on one drive |
| 9 | **Context and token loss between sessions** | **not measured**: HANDOVER files exist in every big film, and the GEN loop was paused for tokens | A new session re-reads everything |
| 10 | **Voice credits** | **not measured**: clip 4 could not add lines because the ElevenLabs credits ran out | Fixes blocked by an external quota |

**What the data cannot say:** films without logs (tardigrade, the coat films, Regrow Humanity, Last Girl, Diwali) are
missing. Wall-clock time includes Ishaan's review waits in some file-time spans. The 5-day span for Stickman ep 1
is calendar time, not work time.

**The one finding that matters most:** the slow part is not making a film once. It is making it two to six times.
Rework (#1, #4) and the repeat exports it causes (#3) are more than half of all logged hours.

## 2. Which engine is the fast path (measured, render seconds per film second)

| Engine | Measured render cost | Measured authoring | Use it for |
|---|---|---|---|
| **2D canvas in the page** (Fetaccino) | 2.5-3.6 s per film second at 30 fps (117-170 s for a 47 s cut); 60 fps 8.9 s | 25 min for 9 shots by one builder | Launch films, explainers, UI and type-led Shorts: the fastest export here |
| **Remotion** (paper films) | 3.1 s per film second at 1/3 size; **4.5-9.4 s at 1080x1920** (CPU, 4-6 workers; doubles under load); bundle 17-175 s | 7 min to write 10 scenes; **17 min to a first file with the kit reused** | A-vs-B explainers, cut-paper, motion graphics. CPU-bound, so it suffers most when sessions share the PC |
| **three.js, light scene** (Gandhi long form) | **170-536 ms a frame: 5-16 s per film second**; 3 tabs help (170 vs 381 ms) | days, because of rework | 3D story films with a few characters in one set |
| **three.js, heavy scene** (Stickman, 50 characters) | **210-770 ms a frame: 6-23 s per film second**; 2 tabs do NOT help (217 vs 230 ms: the GPU is full) | 5 days for ep 1 | Only when the story needs it; keep crowds out of most shots |
| **Blender (Eevee, iGPU)** | measured by the 3d-ishaan session on the robed figure (ishaan-motion 1.17.71, toolbox.md): **3-22 s a frame**. Render-time subdivision was about 80% of the frame: at 540x960, subdiv levels 1-2 took 15-22 s and body level 1 with garments at 0 took 3 s; at 720x1280 with 16 samples, ray tracing on took about 9 s and off about 5 s. Scene evaluation is about 0.1 s, so the render is the whole cost | cloth from a settled shape with a 10-frame lead-in instead of a 110-frame settle: 30 min down to 6 min per clip; skinned undergarments remove a 27k-vertex tunic sim | Realistic characters only, with subdivision off at render and ray tracing off unless a shot needs it. At 3-9 s a frame, a 10 s clip at 30 fps is 15-45 min, about 10x three.js. Time one frame before any batch |

So a 10-minute 3D film costs **51 min (light scene, 3 tabs) to 230 min (heavy scene)** of export alone on this PC. That
is physics, not process. Section 5 says what changes it.

## 3. The locked one-hour pipeline (60-90 s film)

The clock starts when Ishaan has approved the script. The script, its voice cast and the series kit come before the hour.
A new look or a new hero is a separate **kit day**, not part of a film's hour. The film-in-an-hour order
(`~/.claude/skills/ishaan-motion/references/film-in-an-hour.md`) still holds; this table adds the gates and the export plan.

| Min | Stage | Gate that ends it | Budget |
|---|---|---|---|
| 0-3 | `preflight.mjs check <film> stage=build`, read what it prints, `ack` | GO on disk, RAM, GPU lease, rules read, look locked, voice first | 3 |
| 3-8 | Voice: one read, word times, `timing.js`; sound cue list keyed to words | words.json exists | 5 |
| 8-13 | Contract: shot list from the **kit's fixed library** (cast, sets, props, camera moves, caption system), band and safe area, banned staging list (RULES-8 B), one row per scene with its owner | preflight shows no banned staging | 5 |
| 13-38 | **Scenes in parallel**: up to 3 builders in one session (subagents), one warm capture page each, seeking frames instead of loading. Each builder runs **its own blind judge on its scene's 0.5 s contact sheet** as soon as the scene is done; under 8 means **one** focused fix, then it ships or goes to Ishaan as "plateau" | each scene 8/10 blind, one fix round at most | 25 |
| 13-33 | Sound and captions in parallel (series player, mix to -14 LUFS) | measured mix | (parallel) |
| 25-50 | **Export each scene the moment it passes**, by the GPU lease holder, tab count chosen by `probe`, x264 for the master. Previews can use `h264_amf` (11-14 ms a frame against 48 for x264 medium) | per-scene MP4 + pop scan | (overlaps) |
| 38-48 | Whole-film check on the joined scene MP4s: 0.5 s contact sheet, a blind judge on the exported file, overlay probe, black and pop gates | 8/10 blind on the export | 10 |
| 48-55 | Re-export only the scenes the judge sent back (one round), join, mux, loudness | gates pass | 7 |
| 55-60 | Live preview link with sound to Ishaan, UPLOAD.md text, `tlog.mjs total` | | 5 |

**Export budget check:** a 75 s film has 2,250 frames. At the measured 170-770 ms a frame that is 6-29 min, and it overlaps
building because scenes are exported as they pass. A heavy 3D film (over 400 ms a frame) only fits the hour if most
of its export happens during building, which is why the per-scene export is a rule and not an option.

**Scaled to 10 minutes (600 s, about 80 shots).** A 10-minute film is eight 75-second units, each run through the table above.

| Path | Wall time on this PC | Why |
|---|---|---|
| Today | 3-5 days (Stickman ep 1: 5 days for 7.6 min; Gandhi: 2 days for 6 min) | whole-film rework, full re-exports |
| This plan, this PC, light 3D | **about 3 h** (estimate from the measured parts, not yet a measured run): units built 2 at a time (the account allows about 4 builders), export 51 min overlapping | the GPU and the account cap the parallelism |
| This plan, this PC, heavy 3D | **4-5 h** (estimate): the export alone is 63-230 min | the GPU is the limit |
| This plan plus a cloud GPU for exports (section 5) | **about 60-90 min** if the cloud render is about 10x faster: **unmeasured**, needs the one-hour trial in section 5 | the export leaves the laptop; building stays here |

So the honest answer: **60 minutes holds for a 60-90 s film on this PC. For a 10-minute film it needs either a faster GPU
or a lighter film.** "Lighter" means 2D canvas or Remotion, or a 3D film with few characters per shot. Choosing that is a
taste call for Ishaan; see the proposals below.

## 4. The rules every session follows (the enforcement)

1. **Preflight before building, again before exporting.** `node docs/agents/speed/preflight.mjs check <film>`. A FAIL stops
   the work: rules not re-read since the skill changed, no estimate in TIMINGS.md, no locked look or kit, no voice timing,
   no contract, under 10 GB of disk, under 1.5 GB of free RAM, or the GPU leased to another film at export time.
2. **Timings are logged by the tool, not from memory.** `tlog.mjs start <film> "<stage>" <est>` before each stage and `end`
   after it. An overrun of 25% or more asks for its cause on the spot.
3. **One GPU owner at a time.** `preflight.mjs gpu take <film>` before any export or batch capture, `gpu free` after.
   Measured: the same export ran at 224 ms a frame on a quiet PC and 417 ms with other work on it.
4. **Never load a page per check.** Seek a warm page (the capture server, `tools/capserver.cjs`) and pull 0.5 s contact
   sheets from it: 0.2 s a frame against 23-144 s for each cold load.
5. **Judge per scene as it is built, not per film after.** One focused fix round per scene. A scene still under 8 after
   that is shown to Ishaan as a plateau with the scores, never looped silently (the lesson from screen-time's 4 rounds).
   The judge sees contact sheets of the scene's **exported** MP4 (`sheet.mjs`, about 3 s), never page captures.
6. **Export with `export.mjs`, which re-renders only what changed.** It cuts the film into chunks (or the film's
   `scenes.json`), keeps each chunk's MP4, and reuses it when no source file changed (free) or when its picture
   fingerprint (every 5th frame) is unchanged. It resumes after a crash, takes the GPU lease itself, picks the tab count
   once per page, runs the black and length gates and writes its row in TIMINGS.md. Measured on the Gandhi page (24 s):
   **267 s full, 7 s with nothing changed**. One caption word changed 3 of 4 chunks, because the caption line runs for
   11 s and the layout shifted, and only the untouched chunk was reused.
7. **Every chunk, tab or segment starts with a 1 s pre-roll** of unwritten in-order frames. The film pages keep state
   from frame to frame: on a cold page the Gandhi page's paper slip lands in a different place than in an in-order render
   (SSIM 0.982 at 63 s). With 0.5 s or more of pre-roll the frames were identical to a continuous render, while 0 or
   0.1 s were not. In an exported MP4 with a split placed at 63 s, the seam frame scored **SSIM 0.974 without pre-roll**,
   with the slip visibly jumping, and **0.991 with it**, the same as encoding noise elsewhere (0.992). Splits that land on
   calm moments showed no difference, so the pop only appears where the page carries motion state. A film's own exporter
   that splits into tabs without pre-roll can pop at any split; switch it to `export.mjs`, or add the pre-roll. The cost is
   about 10% at 10 s chunks.
8. **Reuse first.** A film starts from its series kit (cast, sets, props, camera, captions, sound engine, export and
   mux scripts). Measured: 68 min to a first file without the kit, 17 min with it, same style and same PC.
9. **New things are a kit day, not a film.** A new hero, look or set is built and judged alone (8/10 in a close-up)
   before any film uses it (the 5-animal lesson).
10. **About 3 builders per session and 2 build sessions at once**, plus one GPU owner. More hits the account limit (9
    builders lost about 50 min) or the 16 GB RAM (1.8 GB was free with today's idle sessions).
11. **Long jobs run in the background** with `run_in_background`, so a session restart does not kill them.
12. **The export runs rules 3 and 7 by itself** and logs its own row for rule 2, when a session exports with `export.mjs`:
    it takes and frees the GPU lease, pre-rolls every chunk and writes its timing row.

## 5. The three biggest savings, with measured proof

Note on honesty: I did not write estimates before these tests, so the numbers below are actual times only.

**1. Gate before building, judge per scene, one fix round (attacks causes #1 and #4, about 15-20 h).**
- Before: Stickman clip 3 was built without a written gate and took **6 blind-judge rounds**. After RULES-8 was written
  and handed to the builder before building, clip 4 took **2-3 rounds** (6.5 after round 1, then one polish round). That
  halves the rounds, but it is still not 8/10 in one go.
- The preflight runs in **1.6-2.9 s** (measured on 3 real film folders and a test folder). On the real folders it caught that
  the Gandhi long form and Stickman clip 5 had no stage estimates and had not acknowledged the current rules, and that
  the RAG film had no contract and no estimate column. A judge round costs about 30-60 min of rebuild and re-export.

**2. Export per scene, on one GPU owner, with the tab count measured (attacks #3 and #5, about 7 h).**
Measured today on the real Gandhi long-form page, 240 frames:

| Setup | ms a frame (wall) |
|---|---|
| 1 tab, x264 medium | 536 |
| 3 tabs, x264 medium (the film's own setting), PC busy | 417 |
| 3 tabs, AMD hardware encoder, PC busy | 262 |
| 3 tabs, x264, PC quiet | 224 |
| 3 tabs, AMD hardware encoder, PC quiet | 204 |
| probe: 1 tab against 3 tabs | 381 against 170 |

The same setup ran 417 or 224 ms depending on what else was running, which is why the GPU lease exists. Tabs gave
2.2x on this page, but on the heavy Stickman page 2 workers gave nothing (230 against 217 ms), so the probe decides.
The hardware encoder saves 9-37%, but it scored lower on quality (SSIM 0.982 against x264's 0.997 at the settings tested), so
**the master stays on x264 and the hardware encoder is for previews only**. Using it for masters would need a matched-quality test and Ishaan's yes.
The probe predicted a 31.8 min export for the 6.15 min film. Its two most recent real exports took 24 and 49 min.

**3. Reuse the kit, and seek a warm page instead of loading one (attacks #2 and #6).**
- Kit reuse: **68 min** to a first playable file for API vs MCP without the kit, then **17 min** for RAG vs fine-tuning with it,
  same style and PC (both logs).
- Warm page: a cold load took **23-62 s** today (and 28-144 s in the Stickman export logs), while a warm seek took **0.17-0.22 s**.
  A 12-frame check costs about 5-12 min cold and about 65 s warm. The cstack log measured the same thing: 15 stills took
  5 min 41 s, and the whole film at 1/3 size took 7 min.

## 6. Proposals that need Ishaan's yes (taste, not mine to set)

- **Export at 24 fps instead of 30** for 3D story films. That is 20% fewer frames and 20% less export time. It changes motion feel.
- **A lighter render tier for long films**: half-resolution shadows and a cheaper depth of field on wide shots only.
  Not measured yet; it needs a blind side-by-side.
- **Fewer characters per shot by default** in long-form 3D (already close to his "simple, nailed" rule). This is the
  biggest render lever on the heavy page.
- **AMD hardware encoder for masters** at a lower qp, if a matched-quality test passes his eye.

## 7. If hardware is the limit (options, with costs; Ishaan decides)

| Option | Cost (approximate, Nov 2026) | Hours saved | Notes |
|---|---|---|---|
| **External 1-2 TB NVMe SSD over USB-C** for Downloads, renders, Docker data | about $70-130 | removes disk-full crashes (#8) and the cleanup hunts | Fastest, cheapest fix; see CHECKLIST-PC step 6 |
| **More RAM** | not possible | | Measured: two soldered 8 GB SK hynix LPDDR5 chips (HP Laptop 15-fc0xxx). Don't buy RAM |
| **Cloud GPU for exports only** (an L4 or RTX 4090 by the hour) | about $0.40-0.80 an hour | **unmeasured**. If it is 10x faster, a 10-min heavy film's export drops from about 1-4 h to about 6-25 min | Run one paid 1-hour trial first: copy one scene, run `probe` there, and compare it with the probe here. The film files leave the PC, so this needs his OK |
| **A desktop with an NVIDIA GPU** (for example an RTX 4060-class tower) | about $900-1,300 | **unmeasured**. It would make exports local and fast, give NVENC, and let 2-3 sessions render without fighting | Worth it only if he keeps 10-15 min of 3D film a day as the goal |
| **A second Claude account or a higher plan** | per plan | lifts the about-4-builder cap that limits parallel scenes | Only after the GPU limit is solved, or it just queues on the GPU |

## 8. Files

- `preflight.mjs`: the gate (check, ack, gpu take/free, probe). See `PREFLIGHT.md`.
- `export.mjs`: the shared exporter (chunks, reuse, pre-roll, resume, GPU lease, gates, timings row). Works with both
  page patterns in the repo (`window.frameB64(t)`, or `window.seek(t)` with a `#cv` canvas), from a file or an
  `http=` server.
- `sheet.mjs`: contact sheets of an exported MP4 for the per-scene judge, with time stamps, plus a hook sheet of the first 3 s at 4 fps.
- `tlog.mjs`: the automatic timings log.
- `CHECKLIST-PC.md`: Ishaan's own steps for disk, RAM, Defender, power and WSL.
