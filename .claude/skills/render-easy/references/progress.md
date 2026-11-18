# render-easy progress log

This file is the project's memory. Read it at the start of every render-easy session and append to it at the end.

## Current status

| Layer | Status | Best measured result |
|---|---|---|
| Baselines (Still Water showcase) | Done | See `benchmarking.md` |
| 1. World-space cache (as the hybrid pipeline) | Designed, see `hybrid.md` | – |
| 2. Exact motion vectors | Not started | – |
| 3. Predict, verify, redraw | Not started | – |
| 4. Code straight to MP4 | Not started | – |
| 5. Split across machines | Not started | – |

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
