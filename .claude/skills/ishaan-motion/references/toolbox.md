# Toolbox: the best hybrid path

Choose the engine per shot, not per project. If something would make the frame better or the work faster, install it,
integrate it and use it. Check licences (MIT/Apache/CC0/CC-BY are fine; credit CC-BY) and record each addition in the log below.

## What each tool is best at
| Tool | Use it for |
|---|---|
| **Remotion** (+ @remotion/transitions, motion-blur, google-fonts, three, lottie, media-parser) | React-composed films, precise frame timing, video-in-video, many layers, deterministic render. Skill: `remotion-best-practices`. |
| **HyperFrames** | HTML/CSS/GSAP-authored compositions rendered to video; fast for UI-heavy and typographic scenes. |
| **MotionEasy canvas engine** | Reusable components, JSON post specs, multi-format social cuts, built-in sound kit and audit. |
| **Three.js / React Three Fiber** (@remotion/three) | Real 3D: tilted card walls, depth of field, glass, camera fly-throughs, extruded type. |
| **GLSL shaders** | Blooms, grain, blur-to-blob melts, liquid/iris reveals, chromatic gradients: anything per-pixel. |
| **GSAP** (incl. SplitText, MorphSVG, CustomEase) | Text splitting, SVG morphs and custom ease curves inside HyperFrames/HTML. |
| **Lottie / Rive** | Icon micro-animations, line-icon draw-ons, character rigs. |
| **Spline / Blender renders** | Hero 3D objects as PNG sequences or alpha video when code-3D would look cheap. |
| **ffmpeg** | Probe, cut detection, loudness, frames and contact sheets, compositing alpha clips, final loudnorm. |
| **Python: numpy, librosa/essentia, OpenCV** | BPM/onsets/downbeats, optical-flow motion measurement, curve fitting against a reference. |
| **Plain canvas 2D in the browser** | Fast live previews played against a voice track: no build step, `frame(t)` pure, `?grid=` check sheets. Tested helpers in `canvas-engine.md`. Weak at real 3D and per-pixel blur; use three.js or shaders for those. |
| **Freesound / Kenney / Sonniss (CC0)** | Recorded SFX: whooshes, clicks, pops, risers, paper, glass. |

## Hybrid recipes
- **Type-led film with product UI:** Remotion for the master timeline. UI cards as React components; real screen
  recordings inside them. Shader layer for bloom + grain. Depth of field via a per-layer CSS/SVG blur driven by z.
- **3D card wall / pull-out reveal:** R3F inside Remotion (@remotion/three) so the camera is real 3D and DOF is physical.
- **Icon micro-motion:** Lottie or hand-built SVG stroke draw-ons. Every icon arrival gets a draw-on + a soft pop + a tick SFX.
- **Hero object that code can't sell:** ask for a Blender/Spline render or an AI still with alpha, then do all motion, light and transitions in code.

## Install-and-integrate log
Add a line each time something is added: `date · package · why · where it is used`.
- 2026-10-07 · (none yet) · start of log
- 2026-10-07 · @remotion/layout-utils 4.0.532 · measured text widths for camera tracking on type and the iris born in a full stop · launch-remotion/src/ad30
- 2026-10-07 · @types/react 19 (dev) · real typechecking for the Remotion project (it had none) · launch-remotion
- 2026-10-07 · three + @react-three/fiber 9 + drei 10 + @remotion/three · real 3D one-take (glass, strings, liquid floor, rig) · launch-remotion/src/ad30/v2
- 2026-10-07 · edge-tts (python) · scratch neural VO with WordBoundary timings (en-IN-NeerjaExpressive, hi-IN-Swara for Hinglish) · films/captionseasy-30s/vo/make_vo.py

## 3D in Remotion: what actually works (Windows, integrated AMD, --gl=angle)
- @react-three/postprocessing EffectComposer renders BLACK (half float) or WHITE (8-bit) here. Write your own post: scene → MSAA
  HalfFloat target with DepthTexture → gaussian chains → composite shader (DOF from depth, bloom, motion/zoom blur, grain, sRGB).
- troika/drei <Text> is async (worker sync) → frames captured before text exists. Use canvas-texture glyph planes instead
  (one texture per glyph + a pre-blurred twin), fonts loaded with FontFace + delayRender.
- Anything loaded async inside the canvas (textures, SVGs, video frames): set it, then call useThree().advance(performance.now())
  BEFORE continueRender, or the frame is screenshotted without it. Clip on a 3D screen = JPG sequence + swap texture.image.
- Set the camera in useFrame(priority -1); render the post in useFrame(priority 1). Bloom threshold > 1.0 in light scenes so
  only HDR emissive blooms. Clamp camera motion blur on cut frames.
- 2026-10-26 · Blender 5.2 + MPFB 2.0.18 (GPL-3) + MakeHuman CC0 assets · a rigged realistic human from numbers (Rigify, 930 bones), 60k-strand hair grown in Python with head collision, a Verlet + shape-matching hair solver (the XPBD node's "Animation" mode ignores rigid motion; "Physics" ignored stiffness), Guide Follow GN for strands; 5.x modifier inputs are `mod.properties.inputs.<id>.value`; Eevee crashes on the 512 MB iGPU with full hair, Cycles CPU ~2 min/still · Moovi docs/agents/story/avatar-ishaan

## Blender character clips: the measured fast path (Ishaan, 2026-11-03: "30 minutes for 10 seconds... did you not take the learnings from speed lab")
Measured on this PC (Ryzen 5 7520U, 512 MB iGPU) on the robed figure, a 10 s clip:
- **Cloth starts settled.** Dump the settled cloth shape once (`robed-figure/dump_cloak.py`) and start every clip from it with a ~10-frame lead-in (`fastsim.py`), never a 110-frame settle per clip: 30 min -> 6 min.
- **Only the cloth that moves is simulated.** Undergarments in a standing clip are skinned (no cloth): the 27k-vertex tunic sim is gone.
- **Render-time subdivision was 80% of the frame.** Eevee at 540x960: 15-22 s a frame with subdiv render levels 1-2, 3 s with body 1 and garments 0. Ray tracing off and light shadows on black cloth cost little to the eye.
- **Time one frame before any batch** (and log every stage with tlog.mjs, preflight + GPU lease first). Never start a bake or render without a measured per-frame cost and a total.
