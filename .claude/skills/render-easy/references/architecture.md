# render-easy architecture

## Why rendering is slow

A realistic frame at 1280×720 has 921,600 pixels. For each pixel a renderer answers "what light reaches the camera here?" by marching rays through terrain, bouncing reflection rays off water, casting shadow rays to the sun, accumulating fog and computing sky scattering, often several times per pixel for anti-aliasing. That is roughly 10,000–100,000 operations per pixel, or about 50 billion per frame. A GPU does this in milliseconds; a 4-core CPU without a GPU takes seconds.

Most of that work repeats. In a slow camera move over a landscape, the light on the mountains, forest and sky is identical in every frame; only the water, mist and camera change. Renderers recompute it anyway, every frame.

The Still Water showcase measured this. On a 4-core CPU with no GPU:
- Blender Cycles: 25.5 s per frame.
- A pure GLSL raymarcher: 22.4 s per frame.
- three.js through SwiftShader: 9.5 s per frame.

In every case nearly all of that was recomputing unchanged light.

## Layer 1: world-space cache

Caching on the screen ("pixel 512,300 is orange") fails as soon as the camera moves, because every pixel's key changes. Caching in world space ("this point on the mountain, lit by this sun, is orange") stays valid for the whole clip.

What to cache:
- View-independent light: diffuse lighting, ambient occlusion, soft shadows from a fixed sun, sky colour, aerial haze. Bake it into textures on the geometry (lightmaps), into probes, or into a 3D grid.
- Smooth functions sampled densely enough that interpolation is accurate, such as terrain height and sky as a function of direction.

What cannot be cached:
- View-dependent light: reflections, specular highlights and Fresnel change when the camera moves.
- Anything animated: water ripples, a moving character, its shadow.

Make the cache automatic by tracking dependencies. Tag each part of the scene with the inputs it depends on (`t`, camera, sun, object transforms). Recompute a part only when one of its inputs changes, the way React re-renders only components whose props changed. Doing this automatically for arbitrary scene code is the novel part of render-easy; each individual technique (lightmaps, irradiance caching, neural radiance caches) already exists in games and film.

## Layer 2: exact motion

For every pixel, compute where its surface point was in the previous frame:
- Camera and rigid objects: multiply by the previous frame's model-view-projection matrix.
- Skinned characters: evaluate the skeleton at `t-1` for the same vertex.
- Procedural motion (water, mist): evaluate the analytic function at `t-1`.

This gives a motion-vector buffer that is exact, not estimated the way optical-flow interpolators such as RIFE, FILM or ffmpeg `minterpolate` estimate it.

## Layer 3: predict, verify, redraw

1. Warp the previous frame with the motion vectors (the prediction).
2. Render a cheap probe, about one pixel per 8×8 tile, at full quality.
3. Compare the probe to the prediction per tile.
4. Fully redraw only the tiles whose error exceeds a threshold. This is typically newly revealed areas, reflections, highlights and moving characters.

This works for any content because the verify step decides per tile and per frame. Scenes with lots of change redraw more tiles and get less speedup, never worse quality.

## Layer 4: code straight to MP4

The usual pipeline is: draw the frame, screenshot it, PNG-compress it, write it to disk, then decode every PNG in ffmpeg and encode H.264. Encoding from the canvas with WebCodecs and muxing in the page removes the screenshot, PNG and disk steps. A later step can hand the known motion vectors to the encoder so it skips motion search, the most expensive part of encoding. That needs an encoder that accepts external motion hints, such as NVENC's external motion estimation API.

## Layer 5: split across machines

Rendering is deterministic, so any chunk can start at an exact `t`. Give each cloud session its own 5–10 s chunk, render all chunks in parallel, and join them with ffmpeg's concat demuxer without re-encoding. With N machines, wall-clock time drops by close to N, minus setup and transfer.

## Expected gains (estimates until measured)

| Scene | Layers 1–4 | With layer 5 on N machines |
|---|---|---|
| Calm scene, slow camera (the lake) | 10–30x | about N times more |
| Character on a static background | 2–4x | about N times more |
| Chaotic full-screen motion | about 1x | about N times more |

The theoretical cap from Amdahl's law: recompute 10% and the best speedup is 10x; 1% for 100x; 0.1% for 1000x.
