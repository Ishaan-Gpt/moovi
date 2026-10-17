# Taste: what the owner and the blind judge rewarded or rejected (grow this file every review)

## Type
- **Never full Fraktur (UnifrakturCook / Maguntia) for anything that must be read.** Rejected by the owner ("just bad")
  and the judge (illegible). For a blackletter look use **Grenze Gotisch** (OFL, modern, readable) for display sizes
  ≥ 44 px only, and its plain sibling **Grenze** for small labels.
- **Hook titles want weight and a flare**: a heavy display serif (**Cinzel 900**, OFL) or a condensed sans (Anton),
  in metal: dark bevel 4.5% below, a 5-stop gold heat gradient (near-white top → amber → burnt → warm rim), one soft
  bloom behind, a short deterministic ignition flicker. A thin book serif in flat gold "reads like a wedding invite".
- Fit every display word to a measured width; never let caps run off the frame.
- One display face + one text face per film. A third face only for a reason (a hook vs chapter heads).

- **The owner overrides the judge.** In R3 the judge kept asking for "a true blackletter with ornate capitals" for section heads; the owner had rejected Fraktur. Keep Grenze Gotisch and say why.
- **Lit metal titles need an additive halo**, not just a gradient: a lighter-composite pass of the text in orange with a blur of ~0.55 × size, then a dark outline, then the heat gradient, then a specular band on the upper third. Without the halo the judge read it as "printed ochre" three rounds running.
- **Never name a font family "Serif" (or "Sans", "Mono")** in @font-face: it collides with the generic family and the
  face silently falls back to the system serif. Use the real name (InstrumentSerif). The judge called R4's type "the wrong
  serif" for two rounds before this was found. Check `document.fonts.check('40px "<family>"')` on every new face.
- **A tall condensed serif hero word** (R4): an italic serif scaled ~0.78 × 2.0 so one word fills ~80% of the frame
  between two dashed guide lines; a playful mark (an eye) replaces the dot of the i (draw the dotless ı). Captions in the
  same face scaled 0.74 × 1.12 read as one family with the hero.
- **Marker hand-lettering**: Permanent Marker / Gochi Hand, boil on twos (12 fps), always fitted to a measured max width
  inside the safe area; the judge marks clipped scribbles down at once.

## Composition
- **Fill the panel like the reference does.** Props in a top panel should take 60–80% of its width. Small floating
  cards in empty space read as unfinished (judge: "dead space", "props ~half size").
- Prefer **one big card at a time**, swapped on its word, over several small ones side by side.
- Never let a caption sit on top of a hero device (the dial); captions hide while a device carries the beat.
- A caption must never touch a card: when a tall card owns the frame, move the caption under it (R4: card bottom 1565,
  caption 1795) rather than shrinking the card.
- A hardware/UI card needs density like the real thing: presets, labelled faders, LED keys. A big card with an empty
  middle reads as unfinished.

## Glass and UI (R5)
- **Glass panels blur what is really behind them**: draw the canvas into the panel's clip under a blur filter, then a
  dark tint, a top sheen and a 2 px light edge. A flat translucent box reads as a template.
- A screen-recording walkthrough can be drawn when the UI is generic: real line icons per row (never empty checkboxes),
  a touch dot with a halo that glides on an arc and rings on taps, screens that slide in on each tap.
- When a reference marks removed items, keep them visible in the warning colour (red) and let them sink back; fading them
  out loses the "half your audience" read.

## Craft
- Drawn props need material: texture at two scales (coarse mottling + fine grain in overlay), a light direction
  (gradient), edge occlusion (blurred dark inner stroke), a rim light, creases/details, a cast shadow.
- Hands: tapered fingers (wider at the base), knuckle creases, a palm that reads; never sausages.
- If a prop is a photo in the reference (people, thumbnails, b-roll), ask for a cut-out (rule 0.1); a code
  silhouette is a labelled stand-in, never the final.

## Editing a real person's video (owner, 2026-10-16)
- Never copy one reference wholesale; cast per beat from every reference and the catalogue, adapted to this video's palette and content.
- A component that isn't polished doesn't ship: a soft or haloed cut-out across the whole video reads worse than the original wall. Use background replacement only where its edge quality passes, and only for a span that earns it.
- Always grade: exposure, white balance, contrast curve, skin protected; low-res sources get a careful sharpen and grain, never a plastic upscale.
- **Upscale where it is seen:** a low-res source is cropped to the output frame first (9:16 on the face), then AI super-resolution to the output size, then the grade. Interpolation (lanczos/bicubic) is not an upscale; it only makes the blur bigger.

## Grading (owner's own grade, 2026-10-16; preset kits/motion/grade-presets.json "natural-punch")
- Never neutralise a room's colour: a warm wall stays warm (temp -4, not a full white balance). My auto-neutral grade was rejected as "very bad".
- Depth comes from the bottom end: shadows -34, blacks -35, contrast +23; highlights +28 but whites -22 so skin and wall never blow out.
- Colour: vibrance +10 with skin protect 100, saturation 0. Finish: sharpen 31, clarity 3, vignette 44, grain 11, exposure +0.24.
- The grade runs as one shared WebGL shader (kits/motion/grade.js) in the grader and every preview, so the owner's grade is reproduced exactly.
