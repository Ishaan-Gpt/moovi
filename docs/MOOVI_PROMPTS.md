# Moovi: generation prompts and Meshy settings

Pipeline: **GPT image (concept)** → **GPT image (model sheet)** → **Meshy (multi-view to 3D)** → **Claude in Blender** (analyse, clean, add the halo, visor and eyes, rig, animate, export GLB).

Save every image you keep into `assets/character/concept/` and every Meshy export into `assets/character/source/`.

---

## Prompt 1: hero concept (to lock the look; also a landing-page reference)

Generate this first and iterate until you love him. Everything later copies this image.

```
3D character design of "Moovi", the god of video editing — a small, stylised designer-vinyl-toy character,
simple yet extremely appealing and cool, Pop Mart / premium collectible figure quality, Pixar-level appeal.

Proportions: chibi, about 3 heads tall. Big, soft, rounded head shaped like a smooth rounded capsule-helmet,
compact bean-shaped body, short sturdy limbs, chunky rounded mitten-style gloved hands (thumb + three fingers),
small rounded boots. Clean, smooth surfaces, no clutter, no seams, no tiny details.

Face: no human face — a large wraparound glossy visor of dark navy glass (#0E1A2B) covering the front of the head,
with two soft glowing ice-blue pill-shaped eyes (#CFE6F7) shining through it, friendly and confident.

Halo: a thin, perfectly circular floating ring hovering above his head, ice blue with an iridescent
mint-to-lilac sheen, with small evenly spaced tick marks like a video-editing timeline and one brighter playhead notch.

Materials and colours: body and head in matte-satin icy white (#F7FAFD) with a soft clear-coat like vinyl;
a soft rolled collar, gloves and boot soles in pale ice blue (#CFE6F7); one tiny deep-blue (#2B67C6) circular
badge on the chest. Only these colours.

Pose: confident and charismatic, making the film director's framing gesture with both hands
(thumbs and index fingers forming a rectangle) in front of his visor, slight head tilt.

Render: soft, bright studio lighting, gentle rim light, subtle soft contact shadow, clean seamless background
in icy white (#F7FAFD), front three-quarter view, full body in frame, high-end 3D render, no text, no logo.
```

**To try variations**, change one thing per run:
- the head shape ("rounded cube helmet" or "egg-shaped helmet")
- the collar ("soft scarf" or "turtleneck")
- the gloves ("glossy" or "matte")

## Prompt 2: model sheet for Meshy (the most important image)

Ask for this **in the same chat, right after you've picked the concept**, so GPT keeps the same character.

```
Using exactly this character (same proportions, shapes and colours), create a 3D-modelling turnaround reference sheet:
three full-body views side by side on one image — FRONT view, LEFT SIDE profile view, BACK view —
strictly orthographic, same scale, feet aligned on the same ground line, evenly spaced, generous margin around each.

Pose: neutral A-pose — arms straight and angled about 45° down and away from the body (not touching the body),
legs straight and slightly apart, hands open and relaxed with fingers slightly separated, head facing straight ahead.

IMPORTANT for 3D: NO halo, NO glowing eyes — the visor is a plain, uniform, glossy dark navy surface with nothing on it.
No props, no badge, no gesture. Flat, even, shadowless lighting; no reflections, no rim light, no ambient occlusion,
no floor shadow. Solid flat colour zones only: icy white body and head, pale ice blue collar, gloves and soles,
dark navy visor. Pure white background. No text, no labels, no arrows, no grid.
```

If any view drifts (different proportions or a different collar), re-roll just that view with: *"Same sheet, but make the side view match the front view exactly."*

**Optional, for a single-image Meshy run:** the same prompt, with the first line changed to *"…create a single FRONT view only, centred…"*

You don't need to crop anything. Drop the sheet into `assets/character/concept/` and I'll cut out the front, side and back views exactly.

## Meshy settings

| Setting | Value | Why |
|---|---|---|
| Mode | **Multi-image to 3D** (front, side, back), or Image to 3D with the front view | More views means a more accurate back and sides |
| Topology | **Quad** | Bends cleanly at the joints when rigged |
| Target polycount | **about 20–30k** | Leaves room under the 3 MB web budget |
| Symmetry | **On** | A clean mirrored rig |
| Pose | **A-pose** (if offered) | Matches the sheet and the rig |
| Texture | **On** (base colour is enough) | I use the colour zones to split the materials, then replace them with clean web materials |
| Rigging / animation in Meshy | **Skip** (optional fallback) | I build the rig myself, so the halo, visor and eye controls fit our state machine |
| Export | **GLB** (and FBX if it's free) | Into `assets/character/source/` |

Generate 2 or 3 Meshy variants if your credits allow, and send them all. I'll pick the cleanest mesh.

---

## What Claude does once the mesh arrives

1. **Analyse** with `tools/character/inspect.py`, run headless in Blender. It reports:
   - face and triangle count, plus quads vs triangles
   - non-manifold edges and loose parts
   - dimensions and symmetry error
   - UVs and textures

   It also renders front, side and back turnaround PNGs so we can both review the mesh.
2. **Clean up:**
   - real-world scale (about 1 m tall), feet at the origin, transforms applied
   - merge duplicate vertices, fix normals, mirror for symmetry, decimate to budget if needed
   - split the colour zones into separate materials
3. **Rebuild the parts that make Moovi Moovi, as separate meshes** (Meshy can't do these well):
   - the visor surface, with UVs for the **eye shader** (expressions in code)
   - the **timeline halo** ring with ticks and a playhead
4. **Rig** with a scripted armature using Mixamo bone names, so library animations can be reused:
   - **Spine and limbs:** hips, 3 spine bones, neck and head, shoulders, arms, forearms, hands, a thumb and a mitten finger chain, legs, feet and toes.
   - **Extras:** a halo bone and a visor bone.
   - **Weights:** automatic weights, then by hand:
     - the head and helmet are 100% rigid, because a vinyl toy doesn't squish
     - the gloves are bound rigidly to the hands
     - shoulders, elbows, hips and knees get smooth falloff
5. **Animate:** idle, greet, think, direct (point), frame (director's frame), review, celebrate, listen and walk-in. They're keyframed in Blender; Mixamo clips can be added later.
6. **Export** a GLB with all the clips, then optimise it with `gltf-transform` (meshopt + KTX2/WebP, 3 MB or less). Verify it in a three.js test page with screenshots before it goes into `packages/character`.

---

## Direction change (2026-10-12): Moovi becomes a round, furry "snow puff" creature

Concept prompts below use realistic fur. For the **Meshy model sheet**, always say "short, smooth, tight velvet plush" (see the chat prompt / section above): long strands become spiky geometry. The real fur is added in three.js with shell layers, white at the roots and ice-blue at the tips.

### Shared tail (already included in every variation)
Soft bright studio key light, gentle blue-white rim light catching the fur edges, soft contact shadow, seamless icy-white (#F7FAFD) background, front three-quarter view, full body, shallow depth of field, high-end 3D render, photoreal fur, no text, no logo.

### Halo line (already included in every variation)
A thin floating halo ring above his head: ice blue with an iridescent mint-to-lilac sheen, tick marks like a video-editing timeline and one brighter playhead notch.

The full prompts for variations V1 to V10 are in `docs/MOOVI_VARIATIONS.md`.
