# Editing a talking head (owner-approved: v7 to v10, 2026-10-18)

**Only what the owner approved is here** (owner, 2026-10-18: everything from the v1–v6 boards and the retired looks is
scrapped; only his rules and the lessons of v7–v10 stay). The best edits so far: v9 (8/10, graphics invented from what
that clip says) and v10 (9/10, em5's grammar). Starting reference: em1 (https://www.instagram.com/p/DbS2vcfyQxx/) with
Premium Caption 1. Never copy a device from a past film; derive each one from this film's words and footage.

## 1. Colours from the brand, else the footage (owner)
- With a brand: its live site and logo (CSS tokens, fonts, real assets) are the palette (palette.md). An invented colour
  next to a brand that has its own reads as cheap.
- Without one: the footage's own colours (sample the walls, clothes, light), as OKLCH ramps. Every built-in device is
  re-skinned in them; a device never arrives in its last film's colours.

## 2. Read each sentence, then invent its graphic (v9, 8/10)
For every sentence: what it says, the thing or number or person it names, its one hero word. The graphic acts that out
on this clip (v9: "8 crore, half, 4 crore" became a number that splits; "no filter" a filter carousel; "Bollywood
filter" the speaker's own frame raw beside the look). If you cannot say what the graphic does for this sentence, it is
not designed yet.

## 3. Captions (owner)
- In the spoken language as spoken: Hinglish in Latin letters the way people type it (kya hota hai, yaar, crore), never
  translated; English words in English spelling; Hindi numbers stay Hindi; no diacritics.
- One text layer per frame: the caption hides under any text graphic.
- Text never covers a face (captions, titles, stickers): placed by the projected face box with a margin.

## 4. Show it (owner)
A playable preview with voice, SFX and the music bed, served with byte ranges so it seeks, smooth (no hang). Stills
alone hide timing.

## 5. One player, many specs (engineering)
Every time is a word anchor, never a typed second; every device is a reusable component; one generic player renders any
spec (`docs/agents/mastery/edit-player/player.html`; the spec format in docs/agents/mastery/edit.md). Devices: cam
(punch, push, looks, forms full / split / card / corner that morph), mg, burn, stat, filters, compare, desk, leak, tag,
cascade, letters, input, sides, pill, wipe. Never the `window` form (1/10).
**A capable model designs new graphics itself (owner, 2026-10-18):** when no built-in device acts a sentence out as
well as a new one would, write an `art` layer: SVG or HTML with CSS, in the video's palette variables, animated only
through `--t` / `--p` / `--e` (the edit's own clock, so the preview and the MP4 match). Premium means the motion laws
still hold: eased from rest, staggered arrivals, lines that draw, one hero element, a sound on its arrival.

## 6. Sound (owner's Style 1 rules)
One SFX stem by events (a sound on every arrival, min gap by priority, at most two punches), the typing tick under
caption words, voice -18 LUFS, the bed 3 LU under it, the master -14 LUFS through a limiter.

## 10. The three picture layers beyond captions and sound (owner, 2026-10-18; decoded from e3, e4, em1, em2, em4)
**One text layer per frame (owner rule).** When any graphic carries words (a big letter, a headline, a tag, a card),
the caption is hidden for that span. Two texts in one frame is bad taste.

**A. The speaker's frame has forms, and it morphs between them on a spring (never a hard swap):**
- `full` (default) · `split` 50:50 (graphic panel top, speaker bottom half, a soft contact shadow on the seam) ·
  `card` (a rounded rectangle at bottom centre, about 60% of the width, over the theme world or a dimmed blurred copy
  of the room) · `corner` (a small window, about 28% of the width, top or bottom corner, ringed in the theme) ·
  `grid` (the speaker's own takes tiled, the live one lit).
- The form follows the sentence: the speaker owns the frame for who/feeling; shrinks to a card or corner when a
  graphic must explain; returns full for the punchline. Continuity comes from the morph: the rect, corner radius and
  ring animate from the previous beat's form over about 0.35 s.


**B. Burned-in premium UI over the picture (speaker still on screen):**
- Glass or theme-material widgets placed in the frame's empty space (desk plane, beside the head, above the
  shoulder), never on the face: a number badge, a glass icon tile, a node graph with connectors that draw, a 3-step
  line, a glass input field, the speaker's own reel cards.
- Each enters on its word with a spring and a small SFX, has depth (shadow, a sheen, the room's light on it) and
  leaves before the next idea; at most two on screen.

**C. Full-screen motion graphics in the film's world:**
- A world built once per film from the theme (the brand's, else the footage's own): ground, a texture (grid, dust),
  one bloom; kinetic type and one hero object acting out the sentence; the speaker in a corner window so the voice
  keeps a face.
- The world is reused as the ground of every full-screen beat (chapter cards come from it), so the film has one look.

## 11. What an editor adds to a raw clip (before/after reference em5, 2026-10-18; analysis in docs/agents/mastery/edit-ref-em5.md)
- Grade first: highlights down, blue pulled out, saturation up about 20 %, a soft dark fall-off where captions sit.
- Reframe tighter than the raw (about 1.25x), every shot moving; the closest angle saved for the payoff.
- One full-screen world, once, for the abstract middle: a physical surface with real light, photoreal objects
  acting out each noun or verb, a hand-drawn layer on top (arrows that draw, handwritten labels).
- Objects land (motion blur in, a contact shadow), framing props slide in from the corners; light is the transition
  (the world's light sweeps in, a light leak wipes out).
- Photoreal objects need real cut-outs (rule 0.1): fetch or generate them, never flat stand-ins.

## 12. The recipe: a top-tier talking-head edit, every time (owner: v10 "better", 2026-10-18)
Run these in order on every clip; each step is a rule above, not a taste of one video.
**Tailored, never a fixed set (owner, 2026-10-18).** v9 was 8/10; what lifted it was adding motion graphics, real
clips and UI components to enhance the video, but chosen for *this* video: what its sentences say, the things and
people it names, its own footage and colours. A device, clip or widget that would sit the same in any video (a stock
set, a house layout, one form for the whole film) is not editing. Each pick answers "what does this sentence need?"
on this clip, and two different clips never get the same film.
**Every edit shows the owner's checklist (owner, 2026-10-18), at least 80-90% of it, each piece visible and
complementing the others:** burned-in motion graphics or UI over the speaker; the speaker's frame shortened into another
form (50:50 split, a card, a small corner) and morphing back; a full-screen animation or real clip away from the speaker;
camera moves (punch-ins on stressed words, a slow push on long holds); transitions and flares (a light leak back to the
speaker after every away beat); colour grading (v10's grade after the owner's LUT); a palette and ground from the
brand or the footage that every built-in device is re-skinned in; a sound on every arrival (not only the typing tick),
punch hits and an end chime; an audible music bed; smooth playback with no hang. A film with only captions is a
failed edit.

**Two tiers by model (owner, 2026-10-18).** A capable model (Claude) pushes creativity: it writes the whole spec
from this skill and invents each graphic for the video. A small free model (Groq, 8k TPM) only directs: it picks per
sentence from the library of graphics capable models already made and the owner approved
(`docs/agents/mastery/edit-player/menu.json`: device, hero word, caption preset), and code fills the slots from the
clip and the graph (the speaker's own words, the clip's stills, real footage, sfx and music per video). It never builds
a graphic from scratch, so its films stay good.
1. **Prepare through the pipeline** (planEdit): hear in the spoken language (Hinglish stays Hinglish in Latin
   letters), faces, takes, cuts; then bake the cuts and the grade into one file (`build-cut.mjs --grade`), so the
   preview plays straight and the grade costs nothing at play time.
2. **Grade first** (§11): highlights down, blue out, saturation up about 20 %, a dark fall-off under the captions.
3. **Theme**: the brand's own site and logo; with no brand, the footage's own colours (palette.md). One material for
   every graphic.
4. **Start where the speaker's line starts** (a misheard or off-topic opening is cut, never captioned wrong).
5. **Write the beat spec** sentence by sentence (§2): what it says, its hero word → the graphic that acts it out; the abstract
   middle goes to one full-screen world used once (§11), the payoff back to the speaker, tighter.
6. **Real material only** where a thing is shown: fetch licensed footage (ref-footage.ts) and print it into the
   world; ask for cut-outs the code cannot fake (rule 0.1).
7. **Captions**: Premium Caption 1, accent from the brand or the footage; one text layer per frame; text never covers
   a face (the player projects the face box and moves text clear).
7b. **Camera speed is a curve, never a step** (owner, 2026-10-18; camera.md): every push, drift and pan starts and ends at
   rest (an in-out ease over the beat), blur follows speed continuously; a speed ramp is EASES['speed-ramp'].
8. **Transitions from light and objects**: the world's light sweeps in, prints land with a contact shadow, a warm
   light leak wipes back to the speaker (owner approved the leak, 2026-10-18; a leak on a cut is not the banned
   "lens flare on everything").
9. **Sound**: Style 1's typing tick under caption words, a whoosh per world change, a drop per landing, a hit per
   punch, the bed under it all.
10. **Check it plays**: `perf.ts` paired runs (no frozen clock over 100 ms), then send the playable link and ask
    "better or worse, what is off?".

## 13. Known gap: the full-screen motion graphics (owner: "1/10 compared to the reference", 2026-10-18)
The tabletop world lands the idea but not the craft. What em5's has and ours lacks: photoreal 3D objects with real
light and contact shadows, depth of field and two or three parallax planes, physical drops that bounce and settle,
props entering from the corners, light that moves across the surface, a hand-drawn layer that interacts with the
objects. This is its own discipline (a motion-graphics mastery); until then, keep the world short and prefer real
footage prints over drawn objects.
