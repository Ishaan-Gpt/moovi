# The visual system

Every second of a film moves, every scene has several things on screen at different depths, and the art director picks those things from a library stored in FalkorDB. It lives in `packages/engine/src/visual` and runs in the same headless Chrome (playwright-core) as the rest of the renderer, with no GPU.

![Light, vertical](img/visual-light.jpg)
![Dark, vertical](img/visual-dark.jpg)
![Light, landscape](img/visual-landscape.jpg)

## What a film is

`script lines + the voice's word times → beats → planFilm → a plan (JSON) → frames → mp4`

- **Plan** (`plan.ts`): one scene per beat. A scene has a **layout** (hero, split screen top/bottom, split screen side by side, picture in picture, three across, cascading cards, hero with callouts, orbit, wall), one **artifact** per slot, **ambient depth** (a backdrop, particles, light), a **camera** move, a **transition** in, an **enter** and an **idle** motion per element, and **kinetic type** timed on the voice. The planner is deterministic for a seed; a model only ever names ids from short lists.
- **Library** (`artifacts.ts`, 56 artifacts): 28 line icons, 10 UI cards (stat, checklist, notifications, chat, quote, reviews, chips, toggles, price, timeline), 4 devices (phone, laptop, tablet, browser with the real site capture), 6 charts that draw themselves (bars, line, donut, counter, versus, ring), 10 three.js objects (cubes, gyroscope, coin, crystal, knot, network, dot globe, data tower, orbiting brand tile, shield), 4 particle fields, 4 lights, 5 backdrops. Each is tagged with the shared needs vocabulary (`styles/kit/needs.ts`), so the detector that casts the style kit casts these.
- **FalkorDB**: `(:Artifact)-[:SERVES]->(:Need)` in the craft graph is the library; the planner's per-beat ranking comes from `artifactsServing`. Every film's picks are stored as `(Scene)-[:USES_ARTIFACT {slot}]->(Artifact)` in the project graph, and `artifactUsage` makes the next film vary. Queries are in QUERIES.md.
- **Motion** (`page/motion.js`): enter (pop, rise, left, right, drop, flip, zoom, unfold), idle (float, sway, spin, pulse, breathe, bob; never off), camera (push, pull, drift left/right, orbit, rise, tilt, with a hand-held wobble on top), transitions (whip left/right, push up, slide down, zoom through, each with a motion smear), kinetic type (slam, rise, slide, scale; landed words keep floating; the accent word breathes).
- **Depth** (`page/compose.js`): every layer has a z. The camera moves, near layers slide more than far ones, cards tilt and flip with a skew, contact shadows fall behind them, and the objects that are truly 3D are three.js rendered into one small offscreen canvas and placed like any other layer.

## Real footage

Stock clips (the footage agent: `AssetOut` kind `footage`) and scroll captures or screen recordings (kind `scroll`) are played on a footage panel, in a browser-style window (`clip:screen`), on the phone's screen and in the browser mockup. The planner hands the pool out round-robin, stock footage to panels and recordings to windows and phones, each time from a different moment of the clip, and favours footage in the main slot. The page seeks a video per element to a time computed from the frame number, waits for the seek and for the presented frame, and loops it, so footage is as deterministic as everything else and any chunk of a film can be rendered on any page. `recordTestClip` records a WebM in the browser, so footage is tested with no ffmpeg and no download.

## The frame critic (`critic.ts`)

After a render every scene is scored 0-10 on what the sampled frames and the plan show: footage (when there is some), motion (the audit's energy over the scene's seconds), depth (ambient layers, slots at different z, a real 3D object), layers (several elements at once), richness (different kinds together) and a clean frame (no cover, no frozen or empty frame). The scores are stored on the Scene, and as running means per artifact and per layout in the craft graph (`rateArtifacts`, `rateLayouts`, read back by `artifactRatings`, `layoutRatings`). The planner prefers what scored well and avoids what scored badly (shrunk toward 7 when little is known). Scenes below 7 are cast again with a different seed and the artifacts that scored badly marked worn out; only their frames, plus the half second of the next transition that still shows them, are rendered again over the frames on disk (`renderFilm({ ranges })`). In `makeFilm` that is `critic: { attempts, below, store }`; in the crew, Lens does it after the audit and re-opens only the chunks that show those scenes, the sound events and the join (one round; `MOOVI_VISUAL_REDO=0` turns the recast off and keeps the scoring).

## Clean output (`qa.ts`)

- `checkPlan` (pure): the length is within 2 s of the ask, scenes tile the timeline, every scene has elements, words, ambient depth and a transition, and no element's slot reaches into the caption band.
- `auditFilm` (sampled frames, about 4 s per film): nothing static for a second (motion energy per second), no empty frame, and nothing covers the caption band once it has arrived (the real projected box, camera and tilt included). The audit found one real problem while this was built (an icon drifting into the caption band during a camera push), so the visual area now stops a margin short of the band.
- Frames are a pure function of their number: the test renders frames in any order, in fresh pages, and compares hashes.

## Using it

```
pnpm --filter @moovi/engine exec tsx scripts/visual.ts stills [vertical|landscape|square] [light|dark]
pnpm --filter @moovi/engine exec tsx scripts/visual.ts audit
pnpm --filter @moovi/engine exec tsx scripts/visual.ts make script.json [words.json|-] [voice.wav|-] [format] [theme]   # SITE=capture.png BRAND=Name ASKED=20
```

In code: `makeFilm({ beats: beatsFromVoice(lines, words), format, dir, out, audio, askedSeconds, audit: true })` from `visual/film.ts`. In the crew, `MOOVI_RENDERER=visual` swaps the MotionEasy builders for it: the board asks the art director for a `stage` (layout and artifact ids) per shot, one `build` task plans the film, `assemble` checks it and splits the frames into chunks, `render` renders a chunk, and the sound mix, mux, delivery and memory steps are unchanged. Lens reports the frame audit. The default stays the MotionEasy renderer. The visual path has not been run end to end in the crew on the author's machine (no models, no ffmpeg, no FalkorDB there); its pieces are tested.

## Render time

One sample film: six scenes, 26.6 s, vertical 1080×1920 delivered, rendered at 720×1280, 30 fps, software GL, an 8-core Windows laptop, capture only (ffmpeg is not installed on that machine; the encode of 800 frames at `-preset veryfast` is a further few seconds on a normal server).

| version | what it does | capture | per film second |
|---|---|---|---|
| 1 | everything in WebGL, then a canvas copy per frame | 110.7 s | 4.2 s |
| 2 | composited inside WebGL (overlay textures, render targets) | 169.7 s | 6.4 s |
| 3 | 2D compositor, real 3D only for objects | 47.2 s | 1.8 s |
| 3b | frames encoded in the page and POSTed, not sent over devtools | 44.3 s | 1.7 s |
| 4 | ambient layers at half size, batched strokes | **36.2 s** | **1.4 s** |

Why: without a GPU a full-screen WebGL layer costs 16 ms at 720×1280 (about 60 MP/s), and a scene is several layers; and full-screen fills on a CPU are limited by memory bandwidth, so extra workers help little (one page 45 s, four pages 36 s). The lever was filling fewer pixels: soft layers at a quarter of the pixels, small WebGL for the few real 3D objects, no copies. A shorter film with lighter scenes (16.3 s, dark) captured in 9.6 s.
