# render-easy progress log

This file is the project's memory. Read it at the start of every render-easy session and append to it at the end.

## Current status

| Layer | Status | Best measured result |
|---|---|---|
| Baselines (Still Water showcase) | Done | See `benchmarking.md` |
| 1. World-space cache (as the hybrid pipeline) | Designed, see `hybrid.md` | – |
| 2. Exact motion vectors | Not started | – |
| 3. Predict, verify, redraw | Not started | – |
| 4. Code straight to MP4 | Working (first real film) | Encode 11.6 ms/frame (WebCodecs H.264 + mp4-muxer in the page); the draw was 2,162 ms/frame, so it removed the screenshot cost but not the bottleneck |
| 5. Split across machines | Working: one cloud session per 4 s chunk, pushed to its own branch, joined with a stream copy | 11 chunks (1,215 frames) back in about 8 min on 11 sessions, against about 42 min on one machine (about 5x wall time) |

## Next milestone

Prototype on the three.js lake from the Still Water showcase (`threejs/src/scene.js`, deterministic `createScene({ canvas, width, height }).renderFrame(t)`):

1. Re-measure the baseline alone on an idle machine.
2. Add layer 4 (WebCodecs output) and measure.
3. Add layer 1 as the hybrid pipeline (`hybrid.md`): bake the lake's terrain, rock and forest light in Blender, export glTF, load it in three.js with the GLSL sky and water, then measure per-frame time and compare a still against full Cycles.
4. Add layers 2 and 3 (camera reprojection, water re-rendered every frame, tile verification) and measure tiles redrawn, PSNR and SSIM.
5. Split the best variant across separate cloud sessions and measure wall-clock time.

The showcase code was delivered to the user as `still-water-render-easy.zip`. If it is not in the current workspace, ask the user to upload it or push it to a repo.

## Log

Add newest entries at the top, in this format:

```
### YYYY-MM-DD: short title
- What was done:
- Measured: (table or numbers, with machine and load)
- Decision or finding:
- Next:
```

### 2026-11-19: Layer 5 across cloud sessions (the English dub of "GTA 6 Mein Buddha")
- What was done: 11 child sessions (create_session, same environment, the film branch as source, one outcome branch each) each ran `render.mjs worker=F0-F1` for one 4 s chunk and pushed its MP4; the parent fetched each branch, took the local machine's first 4 chunks, and joined all 15 with an ffmpeg stream copy plus the mix.
- Measured: sessions created 04:52:26 to 04:53:28 UTC; all 11 chunks fetched by 05:00:35 (about 8 min, including clone and browser boot). The same 1,215 frames at the local rate (about 228 s a chunk) would have taken about 42 min. 1,695 frames, 56.5 s, no black frame, frame count exact.
- Decision or finding: the split is the lever that works on CPU-only machines; cost is 11 sessions of usage. Pixels could not be reused from the Hindi render: its captions are burned in and the dub runs on a different clock. A clean (no overlay) plate saved at render time would make a same-clock caption variant a cheap composite.
- Next: build the session split into render.mjs (plan, spawn, collect, join) and add a clean-plate option.

### 2026-11-18: First real film through layer 4 ("GTA 6 Mein Buddha", three.js r128, 720x1280)
- What was done: `docs/agents/story/hindi-buddha-gta/hi/tools/render.mjs` encodes each frame from the page canvas with WebCodecs H.264 (`avc1.640028`, 6 Mbps) into mp4-muxer inside headless Chromium, in 4 s chunks with an 8-frame pre-roll, joined with an ffmpeg stream copy and muxed with the mix.
- Measured (cloud container, 4 CPU cores, no GPU, software WebGL via SwiftShader): 1,574 frames in 3,741 s; draw 2,162 ms/frame, encode 11.6 ms/frame. Supersampling 1.5x / 1.25x / 1.0x drew a frame in 2.51 / 1.89 / 1.45 s (5 sample frames). The JPEG-per-frame path (`frameB64`) on the same page ran about 2.5 s/frame at 1.5x, so layer 4 saved little here. Three parallel workers on the same machine took 8.1 s/frame each against 1.7 s alone.
- Decision or finding: on a CPU-only machine the rasteriser is the whole cost (Amdahl); layer 4 and same-machine chunks cannot help. A GPU, or layer 5 on separate sessions, is what moves it. Layers 1 to 3 were not used: the camera moves in every frame of this film.
- Next: run the same page on a GPU machine and record ms/frame; add a session split to render.mjs and measure wall time.

### 2026-11-15: Hybrid pipeline chosen for heavy video
- What was done: Decided, from the showcase results, to combine engines rather than pick one. Wrote `hybrid.md`.
- Measured: Nothing new yet; per-frame and bake times in `hybrid.md` are estimates.
- Decision or finding: Blender bakes static light once, GLSL draws sky, haze and water analytically, three.js assembles each frame and feeds layers 2–5, Remotion or Hyperframes finish. Static sun and geometry are assumed; moving objects use baked probes.
- Next: Build the hybrid lake and measure it against the three.js and Blender baselines.

### 2026-11-15: Project defined and baselines measured
- What was done: Rendered one alpine-lake scene with Blender Cycles, a pure GLSL shader and three.js, then through Remotion and Hyperframes. Defined the five render-easy layers.
- Measured: Blender 25.5 s/frame, GLSL 22.4 s/frame, three.js 9.5 s/frame (shared 4-core CPU, no GPU, load 5–12).
- Decision or finding: Almost all render time went to recomputing unchanged light. Parallel renders on one machine slowed each other, so layer 5 must use separate cloud sessions, not agents on one machine.
- Next: Build the lake prototype, starting with a clean baseline and layer 4.

## Saving changes

Installed skills may be read-only. To save an updated log, copy the skill folder somewhere writable, edit `references/progress.md` there, package it with the skill-creator's `package_skill.py`, and send the `.skill` file to the user so they can save it over the old version.
