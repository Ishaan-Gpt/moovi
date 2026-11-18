# Benchmarking render-easy changes

## Rules

- Same clip, same resolution, same frame count, same machine for baseline and candidate.
- Record the load average (`uptime`) during each run. Other renders on the same machine can slow frames by up to 3x, which invalidates a comparison. Run benchmarks alone when possible, and say so when they were not.
- Time the whole pipeline (scene setup, render, encode) and each stage separately.

## Quality

Compare each candidate against the full baseline render:

```bash
bash scripts/quality.sh baseline.mp4 candidate.mp4
```

It prints average PSNR and SSIM over all frames. As rough guides: PSNR above 40 dB and SSIM above 0.98 are usually invisible in motion; below 35 dB or 0.95, look carefully for smearing or shimmer. Numbers do not catch everything, so also play both clips side by side and inspect a few frames, especially around disocclusions and water.

## Report format

Use this table in the reply and in `references/progress.md`:

| Variant | Time / frame | Total | Speedup | Tiles redrawn | PSNR | SSIM | Notes |
|---|---|---|---|---|---|---|---|
| Baseline | 9.5 s | 19 min | 1.0x | 100% | – | – | three.js lake, 1.5x supersampled, load ~10 |

State what was not measured and which numbers are estimates.

## Reference baselines from the Still Water showcase

These were measured on a 4-core Xeon at 2.3 GHz with no GPU, often with several renders sharing the machine (load 5–12), so they are inflated:

| Engine | Setup | Per frame | Clip |
|---|---|---|---|
| Blender Cycles (bpy 5.3) | 800×450, 7 spp + OIDN, upscaled | 25.5 s | 96 frames, 41 min |
| GLSL raymarcher, SwiftShader | 1280×720, 1 spp | 22.4 s | 120 frames, 45 min |
| three.js, SwiftShader | 1.5x supersampled | 9.5 s | 120 frames, 19 min |
| three.js in Remotion | 1x | 5.8 s | 120 frames, 11.6 min |
| three.js in Hyperframes | 1x | 4.7 s | 120 frames, 9.4 min |
