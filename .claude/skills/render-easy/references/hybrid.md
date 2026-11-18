# Hybrid pipeline: bake in Blender, paint with GLSL, play in three.js

The Still Water showcase showed that each engine wins at something different:
- Blender Cycles had the most realistic light and detail, but cost 25.5 s per frame on CPU.
- The pure GLSL shader had the best sky, atmosphere and water glitter from 501 lines.
- three.js had the fastest and steadiest frames, and runs in real time on any GPU.

The hybrid gives each engine only the job it is best at, so the expensive work happens once and the per-frame work is cheap. It is the concrete form of layer 1 (world-space cache).

## Roles

| Engine | Job | Runs | Output |
|---|---|---|---|
| Blender (bpy, Cycles) | Bake static light: diffuse bounce light, ambient occlusion, soft sun shadows on terrain, rocks and static props. Bake light probes for anything that moves | Once per scene, or whenever the sun or static layout changes | glTF (`.glb`) with baked lightmap textures; a probe file (spherical harmonics or a small cube map) |
| GLSL | Analytic, view-dependent or animated layers: sky (Rayleigh/Mie), sun disc, clouds, aerial perspective and height fog, water normals, Fresnel and glitter | Every frame, cheap | `ShaderMaterial`s and post passes inside three.js |
| three.js | Assemble each frame: draw baked geometry (texture lookups), run the GLSL layers, real-time reflections (`Reflector`), moving objects lit from the baked probes; write depth and motion vectors | Every frame | Canvas frames, depth and motion buffers for layers 2–4 |
| Remotion or Hyperframes | Timeline, titles, grade, edits, audio | Every frame, trivial | Final composition |

Layers 2–5 then apply on top: reprojection and tile redraw use three.js's motion vectors, WebCodecs encodes from its canvas, and chunks split across machines all load the same bake.

## Build steps

1. **Model and lay out the scene once** (procedurally in bpy, or loaded). Keep static and moving things in separate collections.
2. **UV-unwrap static meshes for lightmaps** (`bpy.ops.uv.smart_project` or lightmap pack into a second UV channel). Large terrain needs several tiles, or one texture of 4096² or more.
3. **Bake** with Cycles (`bpy.ops.object.bake(type='COMBINED')` or `DIFFUSE` with direct and indirect passes) at enough samples to be noise-free, with OIDN denoising. Bake ambient occlusion per tree variant once and reuse it across all instances.
4. **Bake probes** at a few points for moving objects (render small cube maps from Cycles, or project to spherical harmonics).
5. **Export** `.glb` with the lightmaps attached (`bpy.ops.export_scene.gltf`), and the probes as a small JSON or image file.
6. **In three.js:** load the `.glb`, apply lightmaps through `material.lightMap` on the second UV channel, use unlit or lightly lit materials for baked surfaces, add the GLSL sky, fog and water, reflect with `Reflector`, and light moving objects from the probes.
7. **Check the match:** render one frame of the hybrid and the same frame in full Cycles, compare with `scripts/quality.sh` style PSNR/SSIM on stills, and look at both. Expect differences mainly in reflections and specular highlights.

## Where it falls short

- **Baked light assumes a static sun and static geometry.** A moving sun means re-baking per keyframe and blending, or live lighting for those parts.
- **Moving objects** get approximate light from probes and real-time shadows, not path-traced light.
- **Reflections and glossy surfaces** are real-time approximations. That is fine for water, weaker for chrome and glass close-ups.
- **Hero shots** that must be perfect can still be rendered fully in Blender and finished in Remotion or Hyperframes.

## Expected result (estimates until measured)

- Static-world look close to Cycles at roughly three.js cost per frame. On the 4-core CPU that is an estimated 5–10 s per frame, against Blender's measured 25.5 s; on a desktop GPU it is real time.
- The one-time bake is an estimated 10–30 minutes on CPU for the lake scene.
