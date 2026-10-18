# The camera layer: recommendations

The code is `moves.ts` (64 moves), `core.ts` (eases), `parse.ts` (keywords) and `call.ts` (gen-AI prompts). Every move is a craft-graph asset `camera:<id>`; premium moves are tagged `premium`. The taste for using them (this copy is mirrored from the ishaan-motion skill, `references/camera.md`, which is the master):

## The law: smooth as butter
- **Speed is a curve, never a step.** A move eases out of rest, accelerates, travels, and settles. Where speed varies
  (the speed ramp), the velocity curve has **no corners**: fast → slow → fast is an easing (an After Effects speed
  graph), not plateaus of 2× and 0.5× glued together. Owner: "I meant easing; it must be smooth." Check the second
  difference of velocity. A corner shows as a jerk.
- **Start from rest, unless cutting in on motion.** A move that begins at full speed jerks. The one exception is a
  cut-in where the previous shot was already moving the same way.
- **Blur follows speed, continuously.** Motion blur grows and shrinks with velocity in steps the eye can't see (1 px
  levels at the low end), and never switches on at a threshold.
- **One move at a time per layer**, and the camera's push never stops: a 2–4 % drift over the whole film, plus each
  shot's own move.

## Recommendations by moment
| Moment | Move (`camera:<id>`) | Duration | Ease | Notes |
|---|---|---|---|---|
| Reveal, a hero out of a crowd, scene-to-scene travel | **speed-ramp** (premium) | 1.2–2.0 s | `speed-ramp`: rest → ≈2× → ≈0.5× → ≈2× → rest | Put the slow glide where the eye must read (a click, the key word); motion blur and a whoosh on the fast parts. Not under 0.8 s. |
| Every shot, underneath everything | slow-zoom-in / drift | the whole shot | linear or smooth | 2–6 % over the shot. Never still. |
| The drop, a logo landing, a number landing | pulse | 0.5–0.7 s | snap attack, smooth release | 3–6 % zoom; once per musical phrase, not every beat. |
| A lockup moving into a header (the anchor) | speed-ramp or smooth | 0.8–1.0 s | `speed-ramp` | Scale in log space (1 → 0.42), with the position on the same curve. |
| Changing world or level (tiles → field) | crane-down / crane-up | 0.8–1.2 s | `speed-ramp` | Downsample-blur the layer by its speed; both layers move together (one camera). |
| Into a tile or a screen (full bleed) | dive-in | 0.6–0.9 s | smooth, log-space scale | Lands on the real content (a site screenshot, a photo). |
| A hard topic change, high energy | whip pan | 0.3–0.45 s | whip | With a whoosh. At most twice a film. |
| Depth handover (busy layer to the next bridge element) | rack focus | 0.4–0.6 s | smooth | The old layer goes soft as the new one arrives. |
| Product object, 3D | orbit / arc | 2–4 s | smooth | Slow; never combine with a whip. |
| Cursor travel (a real hand) | (path, not a camera move) | 0.5–0.7 s | smooth in-out on an arc | Never the hard AE "ramp" bezier: it reads as a robot. |
| Into one real UI element (a sidebar item, a card) | speed-ramp dive | 1.2–1.4 s | `speed-ramp`, log-space scale to 3–3.5× | Land the focus on the element the cursor then clicks; pull back on the same curve. |
| The black was a screen | speed-ramp pull-back | 1.6–1.8 s | `speed-ramp`, log space (≈6× → 1×) | The plate behind scales with the camera; the bed's drop lands on it. |
| A 3D stack or object (three.js) | dolly + small orbit | the whole shot | smooth | 10–15 % closer and 5–8° around over 3–4 s; never a whip. |
| A calm still shot (ref 4) | slow push | the whole shot | smooth | 1–3 % only; the type and focus pulls carry it. |

## Bans
- Camera shake on text that must be read. A move at an even 1× for its whole length. A speed curve with corners.
- Two speed ramps back to back with no rest between them. A whip into a slow scene.
