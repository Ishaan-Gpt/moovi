---
name: "render-easy"
description: render-easy is the user's own project for a much faster code-to-video renderer. It turns code-native video (three.js, GLSL shaders, Remotion, Hyperframes, canvas) into MP4 several times faster by reusing work the code already knows about instead of redrawing every frame. Use this skill whenever the user mentions render-easy, wants a faster render of a code-based or 3D video, complains that Remotion, Hyperframes, three.js, Blender or shader renders are slow, asks about splitting a render across machines or cloud sessions, asks about frame reuse, reprojection, motion vectors, caching lighting, interpolating frames or encoding straight to MP4, or wants to benchmark render speed and quality. Use it even when they don't say "render-easy" but are clearly trying to make code-native video render faster.
---

# render-easy

render-easy is a renderer design (and, over time, a working tool) for code-native video. The core idea: in code-based video nothing has to be guessed. Every position, colour and motion at time `t` is a known function, so recomputing every pixel of every frame from scratch, then screenshotting it and stitching PNGs, wastes most of the render time.

The project is built step by step. Before doing anything, read `references/progress.md` to see what has already been built and measured, and update it at the end of your work (see "Keep the progress log" below). That file is what makes this skill progressive: each session continues where the last one stopped.

## The five layers

Each layer is independent and stacks with the others. Read the reference for a layer only when you work on it.

| Layer | What it does | Reference |
|---|---|---|
| 1. World-space cache | Compute static, expensive light (terrain, shadows, sky, haze) once per clip, store it on the objects, then look it up | `references/architecture.md` |
| 2. Exact motion | Get every pixel's motion from the code (camera matrices, skinned vertices, analytic water) instead of estimating it | `references/reprojection.md` |
| 3. Predict, verify, redraw | Warp the previous frame, check it with a cheap probe, fully redraw only tiles that fail | `references/reprojection.md` |
| 4. Code straight to MP4 | Encode from the canvas with WebCodecs; no screenshots, no PNG files | `references/direct-encode.md` |
| 5. Split across machines | One cloud session per 5–10 s chunk, rendered in parallel, joined with ffmpeg without re-encoding | `references/distributed.md` |

`references/architecture.md` explains how the layers fit together and the reasoning behind each. Read it first if the user asks how render-easy works or wants the design explained.

## The hybrid pipeline (default for heavy 3D video)

For heavy, realistic 3D video, combine engines so each does only what it is best at: Blender bakes static light once, GLSL shaders draw the sky, haze and water analytically, and three.js assembles every frame cheaply and feeds layers 2–5. Remotion or Hyperframes handle the timeline and titles. This is the concrete form of layer 1. Read `references/hybrid.md` before building or planning a heavy 3D video, and suggest it when the user is choosing between Blender, shaders and three.js.

## How to work on a render-easy task

1. **Read `references/progress.md`.** Find the current milestone and what is already measured.
2. **Get a baseline before optimizing.** Render the same clip the normal way and record time per frame and total. Every speedup claim is relative to this baseline on the same machine and load. `references/benchmarking.md` has the commands and the report format.
3. **Add one layer at a time** and re-measure after each. Stacking several untested changes makes it impossible to tell which one helped or broke quality.
4. **Check quality, not just speed.** Compare against the full render with PSNR and SSIM (`scripts/quality.sh`) and look at a few frames yourself. A faster render that visibly shimmers or smears is a failed result, and it should be reported as one.
5. **Report honestly.** Give measured numbers, the machine and its load, and what was not tested. Mark estimates as estimates.
6. **Update `references/progress.md`.**

For engine setup problems (headless WebGL, Blender without a GPU, Remotion's browser, Hyperframes' seek protocol, proxy blocks), read `references/engines.md` before debugging. It records fixes that already cost time once.

## Ground rules that keep results trustworthy

- **Determinism first.** Every layer depends on a frame being a pure function of `t`: no `Math.random` without a seed, no clocks, no `requestAnimationFrame` loops. Without it, reuse and parallel chunks produce seams and flicker.
- **The speedup is capped by what really changes (Amdahl's law).** If 10% of the work must be recomputed every frame, the best possible speedup is 10x. Say this when users expect 100x or 1000x, and explain which parts of their scene truly change.
- **Never slower than the baseline.** On camera cuts, explosions or full-screen motion, fall back to a full redraw rather than forcing reuse.
- **Exact reuse is lossless; interpolation is an approximation.** Be clear about which one a technique uses.
- **Separate machines cost Claude usage.** Each parallel session burns the user's plan, so suggest splitting only for renders long enough to benefit, and say so.

## Keep the progress log

At the end of any session that changed render-easy (new code, a measurement, a decision, a failed experiment), append an entry to `references/progress.md` in the format that file describes, and update its "Current status" table. Then tell the user that the skill's progress log changed. If the skill files are read-only where they are installed, copy the skill to a writable folder, update it there, and package it again so the user can re-save it (see "Saving changes" in `references/progress.md`).
