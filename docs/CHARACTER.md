# The Director: character plan (draft v1, 2026-10-12)

> **Superseded (2026-10-12).** The Director is now **Moovi**, a jelly creature built entirely in code (`packages/character`, see its README).
> The Meshy/Blender pipeline below is kept only for possible future props. Current look and prompts: `docs/MOOVI_JELLY.md`.

## Design brief

**Simple, very attractive, cool. The god of video editing.** He should read in silhouette at 40 px, as a favicon, and at full screen.

| Element | Decision | Why |
|---|---|---|
| Style | Stylised vinyl-toy figure, about 3 heads tall, soft chunky forms, matte porcelain body with clear-coat | Simple shapes generate and rig cleanly, look premium in WebGL, and avoid the uncanny valley |
| Face | A smooth glossy **visor** (dark glass) with **emissive eyes drawn in a shader** | Unlimited expressions with no facial rig. Blinks, glances and moods are just uniforms. He feels alive and costs almost nothing. |
| Signature | A floating **jelly wheel halo**: a ring, eight spokes from a hub running past it, a ball on every tip (one shared SDF, `packages/character/src/halo.ts`). Its spokes melt away when it swells into the memory ring | "God" plus "director at the helm" in one shape. **It turns in steps, never a constant spin** (Ishaan, 2026-10-18): one spoke (1/8 turn) a second with a small jelly overshoot, faster steps when thinking (`HaloTick` in halo.ts; `@keyframes halo-tick` in @moovi/brand for the 2D mark). The same halo is the logo (the dot on the i of "moovı"), the favicon and every loader |
| Colour | Body in white (major 1). Accents (collar or scarf, gloves, soles) in the pastel tint (major 2). The halo is iridescent tint. The eyes glow tint. | The character *is* the palette |
| Hands | 4-finger cartoon gloves. Signature gesture: the **director's frame** (thumbs and index fingers making a rectangle) | Instantly says "director". Gives the hero section its pose. |
| Crew | Smaller (about 2 heads tall), the same visor family, **one shared rig**. Each has one prop and one minor colour: Scribe (pen), Cutter (blade or scissors), Beat (headphones), Lens (loupe), Keeper (memory orb) | One rig and one animation set reused 5×. Visually a team. |

**Name:** TBD. The Director's name could be the brand voice (for example "Hire ___").

## Pipeline

This machine has Blender 5.2 and **no NVIDIA GPU**.

1. **Concept sheet (lock the look first).**
   - Generate a **turnaround**: front, side, back and ¾, in an **A-pose**, on a plain background. Also an expression sheet for the visor eyes, and the crew line-up.
   - Tools: Muse (`styles/tools/muse.py` in MotionEasy), or any image model. Iterate until the owner loves it.
2. **Model.**
   - **A (recommended).** Build it in **Blender with Python (bpy) scripts written by Claude**: primitives plus subdivision, clean quads, symmetric. It's simple by design, so it's controllable, re-runnable and easy to rig. Then hand-tweak in Blender.
   - **B.** AI image → 3D from the front concept (Tripo / Meshy / Rodin / Hunyuan3D 2.1 on Hugging Face), then retopology (Blender QuadriFlow or MeshEasy remesh). Use this for organic details if A looks too plain.
   - **C.** MeshEasy on the CPU (TripoSR). Draft quality only; fine for crew blockouts.
3. **Rig.**
   - Rigify (built into Blender), or the Mixamo auto-rigger on an FBX export, with Mixamo-style bone names so library animations can be reused.
   - Halo and visor are separate meshes, driven in code.
4. **Animate.**
   - Mixamo clips (idle, wave, clap, cheer, point) plus custom Blender actions: director frame, think, direct.
   - Head look-at is done live in code.
5. **Export and optimise.**
   - GLB → `gltf-transform` (meshopt, KTX2 or WebP, prune).
   - Targets: Director ≤ 3 MB and ≤ 30k triangles; crew ≤ 1 MB each.
6. **Integrate.**
   - `packages/character`: `<Director state="direct" lookAt={target} />` using drei `useGLTF` and `useAnimations`, with the state machine from ARCHITECTURE.md.
   - Materials:
     - body: `MeshPhysicalMaterial` with clear-coat
     - halo: iridescence
     - visor: a custom shader for the eyes

## Animation list (v1)

`idle` (breathe and float), `greet` (wave), `think` (halo spins, eyes look up), `direct` (point at a target; negative values use the left hand, as does a negative `wave`), `frame` (director's frame), `review` (squint), `celebrate` (jump and halo flash), `listen` (lean in), `hold` (both hands grip the ends of a box out front, e.g. the landing brief box; `MooviWorld.grip` sets where), `walkIn`. In the landing world he can also become a jelly 16:9 **screen** (`morph.screen`, with `MooviWorld.screen()` giving the video area's corners) and pour the **"moovi" wordmark** out of his back as jelly letters (`scene.word`, `MooviWorld.wordOut`).
