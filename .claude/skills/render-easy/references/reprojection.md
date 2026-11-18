# Layers 2 and 3: exact motion, reprojection and tile redraw

## Prerequisites

- The scene renders deterministically from `t`. Check this by rendering the same `t` twice in fresh pages and comparing the PNG bytes; they must be identical.
- You can render extra buffers: depth and motion vectors. In three.js, add a pass that writes them to a float render target. In a raymarched shader, output the hit position and compute its previous-frame screen position in the same shader.

## Motion vectors in three.js

For each object, keep the previous frame's `modelViewProjection` matrix as a uniform. In the vertex shader, compute both the current and previous clip-space positions; the fragment shader writes `currNDC.xy - prevNDC.xy` to a float target (`RGBAFormat` with `HalfFloatType`). For a static world and a moving camera, only the camera matrices differ between the two. For `SkinnedMesh`, keep the previous bone matrices too. For water or other vertex-shader animation, evaluate the same displacement function at `t - dt`.

## Motion vectors in a raymarched shader

After finding the hit point `p` for the current camera, project `p` with the previous frame's camera to get its previous screen position. For moving procedural surfaces such as water, the previous position of the surface point is the analytic function at `t - dt`.

## Warping (prediction)

For each output pixel, read the motion vector, sample the previous frame at `uv - motion` with bilinear filtering, and write it. Mark a pixel as a disocclusion when the depth reprojected from the previous frame disagrees with the current depth by more than a small tolerance. Disoccluded pixels always fail verification.

## Verification

- Split the frame into 8×8 or 16×16 tiles.
- Render a sparse probe at full quality: a few pixels per tile, at positions that change every frame so no pixel is skipped forever.
- Compute the per-tile error between probe and prediction in a perceptual space (convert to linear luminance, or use a simple per-channel difference with a tolerance near 1–2 out of 255).
- A tile fails if any probe pixel exceeds the tolerance, or if it has disocclusions, or if it has not been fully redrawn for K frames (a refresh guarantee, typically every 8–16 frames, to stop slow error accumulation).

## Redraw

Redraw failed tiles at full quality using the scissor test (`gl.scissor`, or `renderer.setScissor` plus `setScissorTest(true)` in three.js) and composite them over the prediction. Batch neighbouring failed tiles into larger rectangles to reduce draw calls.

## Water and other view-dependent surfaces

Water reflections, glints and specular highlights move independently of the geometry. Render these surfaces as their own layer every frame (they are usually a small part of the image), and apply reprojection only to the opaque, diffuse world. This is simpler and safer than relying on verification to catch them.

## What to measure

- Percentage of tiles redrawn per frame (the main driver of speedup).
- Time per frame against the baseline.
- PSNR and SSIM against the full render (`scripts/quality.sh`); look for temporal shimmer by playing the clips side by side.
