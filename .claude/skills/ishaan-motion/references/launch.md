# Launch films: the branch (taste from Ishaan's verdicts, 2026-10-18)

This is what Ishaan judged better on resend.com, version by version. The log and boards are in
`docs/agents/mastery/launch.md`, the films in `data/freeform/resend*`. The old Launch library (12 looks, 10 arcs,
~400 graph parts) scored about 2/10 and is not a taste source.

## What won, in order
1. **A bespoke film beats re-skinned parts.** One film written for this one product, from a strong prompt, beat the
   whole cast-from-the-graph pipeline (f1 > p0). The same prompt plus this skill did a little better again (f2 > f1).
2. **The product's own UI is the film** (ref 1, dump.cam; f3 > f2). There are no headline cards. The words on screen
   are the UI's own: a page title, the filter pills, the search box, the call to action.
   - The logo becomes the header bar, and the bar stays as the anchor across the film.
   - A dense, colourful pile of the product's real content (for an email API: designed emails) grows fast, every item
     popping in on a jittered stagger with its own sound.
   - **Chaos, then order:** the pile flies into the product's own grid, and a filter click re-flows it.
   - **Dive into one tile, full-bleed.** A bridge element (a frosted search bar) appears on it, types, and survives the
     tile shrinking away. Results fly in around the bar, and the bar becomes the end pill.
3. **Real photos, plus one beat only this product can have** (f4 > f3).
   - Emails carry real photos (from the footage finder, licence recorded), never drawn blocks.
   - The product's own mechanic, performed: the email splits into its React source, a cursor renames a prop, and the
     phone preview re-renders live. A Dark toggle recolours it.
   - Depth of field hands over from a busy split to the next bridge element, so there is one text layer.
4. **The brand's own look, from its live site** (f5, awaiting a verdict). Read the site capture first: palette, display
   face, logo, the hero's light. Resend is black, with one light beam, a serif display face and a sharp R. A
   reference's world (dump's light grey) is grammar to learn from, never a palette to copy.
5. **The content wears the brand too** (Ishaan on f5: "white and purple don't match Resend's theme"). The product's
   own content (emails, cards, buttons, status dots, code colours) is built from the site's ramp, never invented. For
   Resend: warm stone from black to bone, the Light/Dark toggle swapping the ramp's ends, and colour only from real
   photos. Run the palette gate in `palette.md` before the first frame.

## Checks that caught real bugs
- **A filter must show what it says.** After "Delivered", only delivered items remain; otherwise the viewer reads it as
  wrong.
- **An active pill's label must flip colour with the thumb that slides under it.** White text on the white thumb
  disappears.
- **Thumbnails never sit on a title.** Put a photo thumb beside the button, not beside the heading.
- **Items that fly out must clear the frame completely.** A white sliver at the edge reads as an error.

## Look L-UI-1 "Product UI" (Ishaan, 2026-10-18: "the first good generated reference/look for this style; absorb it")
Resend v6 became a reusable look: `packages/library/src/kits/launch-ui/` (player + README) and
`packages/engine/scripts/launch-ui.ts <site>`. The script reads a live site once and makes a playable film in under
a minute (linear.app: preview at 17 s, board at 24 s). The brand-specific beat stays open for the Director to write.
For a new launch, start from this look; a new look only when a reference teaches a new grammar.

## A new grammar never costs the craft (Ishaan on f7, 2026-10-18: "it nerfed all premiumness from 10/10 to 6/10:
## animations, transitions, sfx, effects")
Taking a new reference's grammar (ref 2: one material runs the film) must keep every premium layer of the best film so
far. f7 lost them: its scenes appeared and faded (a slideshow), the camera barely moved, there was no cursor, and the
sound was thin. The checklist that brought them back (f8):
- **Every scene is born from the last:** the lockup shrinks into the header, the row's cards morph into the tiles, the
  camera cranes from the tiles into the field, the pins' labels fly into the cloud, the cloud implodes to the dot that
  becomes the logo. Never a fade or a cut-to-empty between scenes.
- **The camera never stops:** a slow push all film, a punch on the drop, whips and cranes with motion blur from speed.
- **The cursor drives:** hover lifts (photo zoom, growing shadow), clicks with a ripple, a flare on hover.
- **Every arrival:** a spring, a blur-in, a shadow that grows; a hero flies out of the material toward the lens in log scale.
- **Sound:** a tick on every word (render and score read one line list), a whoosh on every move, a riser that ends
  exactly on the drop, a granular shimmer for particles, a short room on the sfx, a breakdown before the end.
- Check every transition at sub-steps (±0.15 s): no empty frame, nothing drawn on top of a line still on screen.

## Smooth, filled, and ramped (Ishaan on f8, 2026-10-18: "why does it hang so much; make it smooth; why are some cards
## empty; add Vignesh's pic/clip fetching and Claude's image generation as tools; A→2x→0.5x→2x→B is an advanced camera
## effect, add it to the camera graph tagged premium")
- **Never `ctx.filter` blur or `shadowBlur` per draw, per frame.** f8 measured a 165 s stall on one frame. Bake every
  card, word, email and shadow ONCE into a sprite, with pre-blurred variants (0, 2, 4, 7, 11, 16 px). Each frame only
  `drawImage`s them, picking the blur level from speed. Whole-layer motion blur is a downsample-and-upscale, not a
  filter. Dot colours come from a lookup table. Warm every sprite at load (render the film once in 0.25 s steps), so
  nothing is built mid-playback. Measure it: render every frame at 30 fps and count frames over 33 ms. f9: 896 of 900
  were under 33 ms, worst 30 ms after a re-run (the 4 slow frames in the first pass were one-off pauses in the
  headless browser).
- **No empty card, ever.** Each item asks `src/launch/media.ts`. `realMedia` uses Vignesh's footage finder (clips and
  photos with licences); `drawnArt` has the brain draw an SVG in the palette's tokens only, rasterised by Chrome.
  CLI: `scripts/launch-media.ts <dir> name="query|what to draw" …`. Resend: 14 of 14 in 37 s (12 clips, 1 photo,
  1 drawn). Look at every result: the finder returned a stone coin for "team welcome" (a relevance miss), so re-map
  or re-query.
- **The premium speed ramp** (`camera:speed-ramp`, tagged `premium` in the craft graph; ease `speed-ramp` in
  `@moovi/library/camera`): A → 2× → 0.5× → 2× → B. Velocity is 2× for the first and last sixth and 0.5× for the middle
  two thirds. Use it on travels and reveals: the row (slow while the cursor clicks), the crane, the swarm gathering,
  the lockup moving to the header. Put the slow middle where the eye must read, and the fast ends with blur and a
  whoosh.

## Look L-UI-2 "One material" (from f7–f10, ref 2 grammar with v6 craft; `data/freeform/resend-v10`)
The recipe: one material is the product's own content (for an email API, emails). It runs the whole film:
1. Real items scatter at three depths, with depth of field.
2. One sentence carries across beats, word by word, each verb with a hero item flying out of the swarm toward the lens.
3. The swarm gathers into a rotating sphere on a speed ramp, then collapses to one dot, and the dot becomes the logo.
4. The lockup shrinks into the header (the anchor).
5. A row of the product's kinds travels on a speed ramp, slow while the cursor clicks, and morphs into feature tiles.
6. A dot-matrix word assembles from flying dots over halftone tiles, and a hover flares one tile.
7. The camera cranes into a halftone field, where signal pins rise; their labels fly into a cloud of chores around the
   payoff line.
8. The cloud implodes to a point that becomes the logo again (a bookend), then a rule and the end line.
Rendered with sprites (never per-draw filters), real media on every item (`media.ts`), one tick per word, a whoosh per
move, a riser ending on the drop. To make it data-driven like L-UI-1: the material, the kinds, the features, the
events and the chores come from the site; the sentence comes from the Director.

## Lessons from f7–f10 (owner)
- "It nerfed all premiumness" (f7): a new grammar must keep every craft layer (see above).
- "Why does it hang" (f8): sprites, not filters. Measure with rAF playback (v8 11 fps → v10 138 fps).
- "Some cards are empty" (f8): every item gets real media, else drawn art (`media.ts`). Look at every result before
  using it.
- "Camera looks off; I meant easing; smooth as butter" (f9): speed curves without corners, start and end at rest,
  continuous blur, soft in-out on travel and cursor paths. `references/camera.md` holds the recommendations by moment.
