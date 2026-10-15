# Anatomy: the grammar

A 20-35 s 9:16 voice-led explainer. The brand's product or system (an app, a service flow, a device, a business
process) is drawn as a run of detailed isometric technical FIGURES (an exploded stack, a process line, a cutaway, a
detail circle, a readout... one per section of the script, see README.md), each building itself while the voice
explains it. Every number lives in `tokens.ts`; the engine is `packages/engine/src/anatomy`.

The method is distilled from the MIT-licensed [anatomy](https://github.com/wheresryan22/anatomy) agent skill (see
README.md for the notice). Its core idea carries over unchanged: **the object is the explanation**. We don't draw
boxes, arrows and labels; we draw a recognisable machine made of many small, precise, purposeful parts, and the reader
understands the idea because they recognise the machine.

## 1. Projection (the skill's camera)

World units are about 1 px of the real thing: x and y on the floor, z up. A point projects as

```
a = azimuth, e = elevation, k = scale
screen.x = ox + (x·sin a − y·cos a)·k
screen.y = oy + ((x·cos a + y·sin a)·sin e − z·cos e)·k
depth    = (x·cos a + y·sin a)·cos e + z·sin e        (painter's key: draw ascending)
```

- Azimuth 45° (x runs down-right, y down-left, the +x and +y faces look at the viewer); elevation 32° (the skill's 30°,
  a touch higher so the plate's top reads in portrait).
- The camera never cuts. It **orbits** (azimuth drifts ±9° over the film on one slow sine, +5° more while pushed in)
  and **pushes** (scale + origin eased over 0.95 s between keys: the overview fit, or a push-in that makes one part's
  box fill ≤ 760 px). Keys are at least 1.5 s apart. Everything is re-projected every frame, so line weights stay crisp
  at any zoom (strokes are in screen px, never scaled).

## 2. Solids and shading (four tones + a lighter top)

Every part is a stack of extruded solids (`box`: a rounded-rectangle plan; `cyl`: a circle; `gear`: a toothed ring;
`ball`: a sphere as a shaded disc). For each solid:

1. **fill** the silhouette in the darkest side tone (so nothing behind shows through: solids, never wireframes);
2. **sides** that face the viewer, each shaded by how it faces the light. The light comes from the camera's back-left
   (`[−sin a, cos a]` in plan, as in the skill), so a turning camera keeps the same lighting logic. Facing maps
   continuously onto the four side tones in 12 bands, so a slow orbit never pops a whole face;
3. **top** in the lightest tone (white on paper);
4. **crease** where top meets visible sides, faint;
5. **decorations** in the plane of their face (below);
6. **outline**: the silhouette, last.

## 3. Tone hierarchy (one accent)

| Element | Tone |
|---|---|
| Plate, feet, a part's base tray | `lo` (outline mid grey) |
| Structure: frames, chassis, stands | `mid` |
| The subject of each part (its lid, body, screen frame) | `hi` (darker outline) |
| The part the camera is watching | `lit`: its subject gets a brand-tinted top and the darkest ink outline. One at a time. |
| Glass, rubber, chip packages, screens | `dark` |
| ONE small brand-coloured element per part (an LED, a die, a cell, a motor winding) | `acc` |

Colour is the brand's, once. Greys carry the brand hue at a whisper. Particles, callout dots, caption accents and
the end line are the brand ink; nothing else is coloured. An achromatic brand (black, white) keeps the skill's own
world: ice-blue whisper, black lit part on paper, white on blueprint.

Themes: **light** (paper `#F7FAFD`-like card on a slightly darker page, white tops, grey sides, near-black ink) and
**dark** (a blueprint: deep brand-hue navy, faces a few points lighter, pale ink). The brief picks the one the site
itself uses; `--theme` overrides.

## 4. Line weights

Outline 2.1 px (subject 2.6), crease 1.1, detail 1.3, leader 2.2, at zoom 1 on the 1080-wide stage (the skill's 0.6 px
at 600 wide, scaled for a phone). Outlines thicken slightly with the push-in (×0.75 + 0.25·zoom) so a close-up still
reads as the same drawing.

## 5. Detail (never a bare slab)

Every region has something true to find, and every detail belongs to a part:

- screws as dots with a ring at the corners of plates, bevels and seams;
- the plate: rounded slab on four feet, inset groove, dot grid, a ruler strip with a major tick every 5th, corner
  screws, and a label plate with the brand engraved in the plane of the top plus three rule lines;
- vents as rows of slots on a side face, ports as dark quads, LEDs as accent dots;
- screens drawn **in the plane of their face**, with an interface (header bar, rows, one accent block);
- rings, spokes, knurls and seams on round parts, following the cylinder (front half only).

## 6. Exploded views (insides on the word)

Every solid has an explode layer `ex` 0-3. On the spoken word, layer n lifts `n × 64` units on a spring (ζ 0.74,
ω 13: one soft overshoot, settled in ~0.6 s), staggered 35 ms per layer going out and in reverse coming back, held
3.2 s. The lid is the top layer, so the part opens like a real teardown and shows its insides (boards, chips, cells,
platters, a motor, a filter). Vertical only: nothing passes through anything. At most three explodes per film.

## 7. Callouts and leaders

The skill bans floating labels inside a figure. A reel needs names on the word, so callouts live **outside** the
drawing, in two columns at the frame's sides, and every leader resolves on both ends:

- a terminal dot on the part's anchor (brand ink, paper ring, soft halo);
- a two-leg leader (a short diagonal, then level) drawn out over 0.4 s;
- a brand-ink bar where the leader lands, then the name (mono, uppercase, tracked) and a 2-5 word note (a true fact).

Placement: the side away from the anchor's own column, sorted by height, at least 96 px apart, clamped to the scene
band (y 260-1460) and the safe area; the engine renders frames with the player's own code and drops a note, shortens
a name or ends an earlier callout when two would meet.

## 8. Flow

Links between parts are low pipes routed L-shaped across the plate (axis-aligned legs, collars where they leave and
land), drawn out over 0.7 s once both ends are on. On the spoken word, particles stream through them: brand-ink beads
with a soft halo, 300 units/s, every 80 units, fading at both ends (they disappear into the machine).

## 9. Timing (on the voice)

| Beat | Rule |
|---|---|
| Open | the plate with every slot's dashed plan line and centre mark, the first part landing at 0.15 s (never a bare frame) |
| Land | a part falls 320 units on the spring, solids staggered 50 ms base → lid, fading in over 0.14 s, 0.1 s before its word |
| Explode | on its word, at least 1.1 s after landing |
| Callout | on its name, at least 0.9 s after the previous, held 3.4 s |
| Flow | on the word that says what moves |
| Camera | overview → push-in for an explode or a callout → overview for a new part or a flow; end on the overview |
| Caption | the spoken phrase (≤ 2.8 s, ≤ 9 words) in Inter Tight 600 / 58 px, each word rising 14 px over 0.16 s on its word; part names in the brand ink |
| End | captions out, the brand in 96 px and the domain in tracked mono |

## 10. The frame

The skill's card: `FIG. 01` top left, the figure's title top right (tracked mono), the hint bottom left
(`BRAND · PART n / N`) and a live readout bottom right (the watched part and how many solids are on the plate), corner
registration ticks. Words stay out of the drawing apart from the engraved label plate.

## 11. Figures and the window

Each section is one figure from the library, with its own ground (bench plate, twin plates, turntable, grid paper),
camera (azimuth/elevation/orbit/sweep) and furniture (rails, levels, cabinets, dials, columns, ghost housings,
dimension lines, trails, hatched cuts, tags). The figure lifts away over its last 0.5 s and the next drops in; the
header reads `FIG. 0n` and the figure's title. The drawing lives in a window between the header and the caption that
fades out over 64 px at its edges: a push-in keeps its subject (with the room its explode needs) inside the scene band
and anything else melts into the paper instead of being cut. The engine checks every 0.1 s with the player's code.
