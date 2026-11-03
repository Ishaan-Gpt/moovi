# Taste: what the owner and the blind judge rewarded or rejected (grow this file every review)

## Simple, nailed (Ishaan, 2026-10-27, 4/10 on "Regrow Humanity")
Reference channels win with LITTLE complication: one or two characters, simple movements and actions, few places, and every one of them nailed 10/10 with story, lighting and captions. Before building, strike every set-up that needs a crowd, a vast scale shot, a complex body action (climbing, running, carrying) or a new set that cannot reach 9/10 on its own, and tell the beat with the simplest staging instead (one face, one hand, one prop, one light). Fewer, better shots; the saved time goes into light, faces, timing and captions.
Ishaan (same day): "Making very complex animation and rigging it 3/10 is a bad choice; optimum animation, nailed, is 10/10. Simple but impactful >>> complex but error-y." The animation is **soothing** (slow eases, gentle camera, no jitter); nail the camera, the lighting, the contrast and the colour grade. **Bright themed worlds with pastel colours full of life are the first choice** for story films (dark/night only when the story truly needs it, and then still soft and readable). Use the saved camera moves in the craft graph (library camera layer) before inventing new ones.
**Never lifeless** (Ishaan, 2026-10-28, on "Regrow Humanity": "too many errors, render issues, feels lifeless"): every character on screen is alive in every frame: breathing, blinks, small head moves, eye darts and weight shifts on top of the beat's action, never a frozen pose; the rig deforms smoothly everywhere (no seams, no limbs through the body, no popping between set-ups); every frame is checked at full size for render errors before anything is shown.

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

## Characters from a reference (Ishaan, 2026-10-26, voice-cloning Short)
- **"My version of the character in the reference" means THAT character** (the reel's little orange pixel creature), redone in 3D: the same
  silhouette, proportions and face read at a glance, then improved (material, depth, expression). Not a logo, not a new creature: Ishaan
  rejected a starburst "spark" built from the Claude logo ("terrible") and asked for the reference's own character, "ditto but modded or better".
- **Never a worse version.** A 3D rebuild of a reference character must score the same or better than the reference's own frame in a blind
  side-by-side (crop of the reference character vs our render, same size), on silhouette read, appeal, material and expression. If it loses,
  it is not shown. Keep the source's design DNA (pixel blocks stay blocks: bevelled voxels, not a smoothed blob).
- **8/10 before anything reaches Ishaan**, judged blind on full-resolution frames; a lower score is a work in progress, never a delivery.

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
- **Never a black or empty frame** (Ishaan, 2026-10-18: "that must never happen"). A beat whose clip or picture failed takes a broader search, a still, or another beat's clip at a new moment; a dark plate under a card is a black screen.
- **Every promo film is understood by second 3** (Ishaan, 2026-10-18, Showreel v2 0/10): the viewer can say what the brand does; a film about a topic instead of the brand fails.
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

## 3D look craft, measured (three blind critics on the Draft C board, A 4/10, B 2/10, C 2/10; 2026-10-21)
- **Renderer before the first frame shown:** sRGB output, ACES filmic tone mapping, a PMREM environment, soft shadows or baked AO on every hero. Without them light worlds clip to white and dark worlds go to mud.
- **Post on every shot:** depth of field from depth (hero sharp, near and far soft), exactly one big soft bloom on a dark shot, grain 2-4%, a vignette, a grade into the palette ramps.
- **Never a black or empty frame, measured:** a dark world keeps mean luma 40-70 of 255; no flat region (16 px blocks with std < 2.5) over 25% of the frame; under 0.5% of pixels clipped to white or black. C had 95-98% of pixels below luma 30; A's top 30% was 99% flat.
- **A hole, void or cavity as hero gets geometry and material** (depth falloff, a lit rim, texture, light falling in), never an unlit flat disc: a dark ellipse reads as a missing texture.
- **Camera: one continuous spline through all keys with one speed envelope**; never smoothstep per segment (it stops the camera at every line start), never a constant-speed dolly, never still.
- **Act out mechanism verbs on their word** (paints, plugs, fills), within ±100 ms of the word; a static world under a mechanism line is a slideshow.
- **Real anatomy shows what people know** (wet catchlight, iris fibres, limbal ring, branching vessels, wall thickness in a cutaway); concentric flat discs read as clip art.
- **Blending two hues walks OKLCH** and the midpoints stay out of banned families (A's plum-to-straw lerp read as pink over 32-74% of the frame).
- **A risk the board itself names ("can feel like a textbook", "the structure is theirs") is fixed or the option dropped** before showing.
- **Placeholder captions still follow the caption rules** (off the hero with 40 px clearance, inside the safe zone, 1-4 words, no punctuation, one ink plus grey) or are hidden: Ishaan judges the whole frame.

## Ishaan's own 3D avatar is the HERO version of him (Ishaan, 2026-10-26: "still feels so bad... pick a much better hairstyle, a muscular build, make the face more handsome and manly")
- A literal copy of a casual selfie (slim build, the messy everyday cut, the stock face) reads as bad. His avatar keeps his identity (skin tone, colouring, facial-hair pattern, overall likeness) but is styled like a lead actor: an athletic muscular build (broad shoulders, V-taper, defined chest and arms, a strong neck), a handsome masculine face (strong square jaw, defined cheekbones, a firm brow, a straight nose, groomed stubble and moustache), and a deliberately chosen, groomed modern haircut, never his current messy one.
- Pick the hairstyle with intent (what suits a strong oval/square face: e.g. a textured quiff or side part with a skin fade) and say why; show alternatives only as the second step.

**Owner reference sheets win (Ishaan, 2026-10-28).** When he gives character, world, prop or graphics sheets for his own show, they are the spec: match silhouette, face, uniform, palette, world and graphic language in code, judged side by side against the sheet; never keep a palette or character I derived over them.

## A reference character is rebuilt as the reference shows it; face effects go on top in post (Ishaan, 2026-10-28, two corrections: "make his face like a human, a very good face, we will apply the blur on top as an overlay", then "stick to the reference: no eyes, nose or mouth, just the facial structure")
- Build what the reference actually shows, not a guess at what is hidden. A blurred or faceless reference face becomes a faceless head with real facial STRUCTURE (brow ridge, cheekbones, jaw, chin, skull), no eyes, nose or mouth; a reference with a visible face gets that face. Never invent features the sheet doesn't show.
- Blur, smear, glitch and similar face effects are compositing overlays on a head matte, never geometry (rotated copies, cut meshes): they look crude up close and lock the look in.
- Colours read as the sheet's swatches at full strength: "white" skin is proper white, "black" cloth is pitch black, not grey-washed.
- A reference figure keeps its presence: if the sheet shows a regal or imposing figure, the body and stance carry it (tall, shoulders back, chest lifted, chin up), never a plain shop mannequin.
