# Caption mastery

Premium captions built reference by reference with Ishaan (decisions 14 to 16: short iterations, his answers are the
taste). Code: `packages/library/src/captions/premium/` (presets, `draw.ts` painter shared by the live preview and the
MP4 path, `theme.ts` accent ramp). Gallery: `docs/galleries/captions-premium.html`, rebuilt by
`pnpm --filter @moovi/engine exec tsx scripts/caption-premium.ts`; `... caption-premium.ts serve` plays it on localhost
(the repo root with byte ranges).
Not a product default yet: wiring into types comes later with Ishaan.

## Rules from Ishaan (every caption)

- **Never punctuation on screen** (2026-10-18). Only letters, digits and % $ # & +.
- **Readable time** (2026-10-18): a card stays up at least 1.2 s; a shorter card joins its neighbour when the voice
  runs on, and every card holds up to 1 s after its last word (`MIN_CARD`, `HOLD` in draw.ts). Before: some cards
  flashed for 0.24 to 0.6 s.
- **Text never covers the face** (2026-10-18): beside or below it with a decent margin (face detector).
- Every correction also lands in the `ishaan-motion` skill (lessons + talking-head.md) the same turn.
- **Hinglish is shown as spoken, in Latin letters**, never translated: English words keep their English spelling,
  Hinglish keeps the spelling people type (crore, yaar), no diacritics (`edit/romanize.ts`; relayed by Edit mastery).
- **One text layer per frame:** when a graphic carries words, the caption hides for that span (apply when the
  presets are wired into the player).

## Premium Caption 1 (approved 2026-10-18)

Refs: `data/refs/captions/c01.png` (still) and the reel https://www.instagram.com/p/DbS2vcfyQxx/ (green at 0 s, red at
4.9 s; local copy `data/refs/captions/c02/`, never committed). A white lead tier and the spoken key word lit underneath.

| | 1.1 | 1.2 |
|---|---|---|
| Lead | Russo One 600, caps, letters +0.02 em, words +0.04 em | Poppins 800, sentence case |
| Key | Russo One 600, caps, letters +0.02 em, words +0.04 em | Russo One 600, caps, slanted (shear 0.2) |
| Colour | any accent: the video's own (`accentFromPixels`) or one picked; refs were green `#52F42E` / red `#FF3434` | same |

- Russo One has one cut (400): 600 is a 4.5 % same-colour round stroke, identical on every layer.
- Key line (glow 25 % lower after the 1.1 fix): dark shadow bed, then a 4-layer bloom (hue-shifted halo → near-white core) and an inner sheen, all from one
  accent (`litKey`). Tiers tight: gap 0.016 of the short edge.
- Entry per word, read from the reel at 30 fps: pops in at 1.22x and blurred (sharp in 0.16 s), snaps to size on
  1 - exp(-11 s) cos(15 s) (a small undershoot bounce), glow flashes to 1.8x and eases over 0.3 s; the card drifts 2.5 %
  smaller a second while it holds. Style 1's typing tick on every word.
- Key word: the strongest word of a phrase (numbers, names, long words, the phrase end), at most 4 words a card.
- captionseasy equivalent: look 34 with the `--set` overrides in `premiumCaption1().captionseasy`.

### Ishaan's words, in order

1. v1 (Montserrat, stacked shadow glow): "40% match. reference has premium glow, i have cheap glow. Use better font,
   decode and improve it. My animation must be cinematic like my original style1 'rise in' entrance, and pair it with
   style 1's only typing sfx."
2. v2 (bloom, Archivo Expanded): "cool.. but improve font and glow premiumness a lil more.. line spacing is less.. and
   make it a rule for captions never to use punctuations." Then: "check font weights too.. make it 100% ditto same".
3. v3 (Montserrat 900): "no improvement.. can't u websearch which font it is or build this font from scratch? Also why
   did u not reduce line spacing and fix glow so text looks more clear.. less glow a lil more shadow behind so text is
   genuinely 'highlighted' not just glowy".
4. v4 (Saira expanded, tight lines): "cool.. but glow is totally gone, give it final finesse.. when it rises make it a
   lil more cinematic and it should bounce after coming to its position".
5. v5: "use Russo One 600 exact", sent the reel for the animation, "this reel also has a red version, keep that as its
   1.2 variation".
6. v6: "for green make the word spacing just a slight more.. and ship this as 2 variations of this caption preset, not
   as green and red forced, but adapts easily to the video theme and palette, just this built-in preset. This is
   premium caption 1." Shipped.
7. After shipping: "I told you to slightly increase LETTER spacing in the previous caption and a little less glow" (I had
   widened the word spacing). Fixed: tracking +0.02 em, bloom about 25 % lower. Shipped with Caption 2.

## Premium Caption 2 (approved 2026-10-18)

Ref: still `data/refs/captions/c03/still.png` and the reel https://www.instagram.com/p/DZsBWoCz04j/ (0 to 8 s).
Three tiers around the key words, hybrid type: a white lead in Plus Jakarta Sans SemiBold Italic, the key words big in
Antonio 500 (slanted 0.12) with a soft metallic gradient from one accent (`metalKey`, gold `#F2C94C` was the ref), a
lighter Medium Italic tail. Every tier sits in an After Effects glow (its own light blurred wide and tight, screened).
Each word fades in out of a heavy blur over about 7 frames, no bounce (read from the reel). Type is sized by each
face's measured cap height (`measureText("H")`), so any font lands at the same size.

Ishaan's words: "check font weight, italics, subtle gradient, glow and hybrid typography"; then "check the After
Effects type glow, my text doesn't have that; his font is also more premium, use a more premium font". Matched after
the glow and the Antonio / Plus Jakarta faces.

## Premium Caption 3 (approved 2026-10-18)

Ref: the reel https://www.instagram.com/p/Dd76h-2RpSv/ (local copy `data/refs/captions/c04/`). A stack card whose
highlight is the card: 1 or 2 highlighted words in Montserrat Bold, scaled to span past the shoulders (about 3.2 face
widths), centred on the body at neck height, behind the speaker (person matte), as a shiny negative of the frame: the
video under the letters inverted, then saturation and brightness pushed to the bright side, so the background decides
the colour (light blue over the beige wall, orange or green over others). The words before it sit above from its left
edge, never into the face; the words after it sit below, right-aligned. Plain words in white Montserrat (content
Medium, connectors Regular and smaller). Words slide up out of a blur. No accent.

The gallery reads the face box and the person matte with MediaPipe, with no CDN (2026-10-18): the runtime is the npm
package `@mediapipe/tasks-vision@0.10.14` (an engine dependency, so the Docker image has it), the two models are in
`packages/engine/assets/vision/`, Montserrat in `assets/renderer/fonts/`. Proof: `OFFLINE=1 tsx scripts/caption-premium.ts
still 3 6.4 out.png` aborts every non-local request and still renders the matte and the face box, pixel-identical to the
old CDN still. Both models fall back to the CPU delegate where there is no GPU.

Ishaan's words, in order (it took eight rounds):
1. "Caption 3, difference style" (v1 Sora kinetic stack, gradient): "you neither got 3D nor the difference style,
   check captionseasy how to do that, and even the font was wrong".
2. v2 (extruded 3D, difference face): "0% match".
3. v3 (person matte, words behind): "still 0/10 for difference captions.. you are just adding depth, not applying the
   negative difference blend".
4. v4 (perspective planes): "2/10, study the video better, it's some advanced difference styling".
5. v5 (measured tint): his breakdown: "a stacked caption style, 2-5 words in 2-5 lines; 1 or 2 words highlighted,
   behind the person; the non-highlight a very clean thin weight; the highlight has no 3D or perspective, just the
   negative effect with hue/saturation on the bright side: shiny transparent light blue, light orange, light green".
6. v6: "you took what I said as rules.. the effect has to be negative/difference so the background dictates the colour
   of the highlight; common sense: no text must ever appear on the face, always left, right, down with a decent
   margin; stacked didn't mean 3 thin, 1 highlight, 3 thin; check how the video handles words".
7. v7: "the main highlighted text has the potential to be twice bigger; it usually covers the entire shoulder span,
   centre aligned, and everything else is arranged accordingly".
8. v8: "Caption 3 matches." Shipped.

## Smoothness (measured 2026-10-18, rAF playback in Chrome on the GPU, 300 frames)

| Preset | before | after |
|---|---|---|
| 1.1 | 44.7 fps, 24 frames over 33 ms | 52.4 fps, 8 |
| 2 | 35 fps, 71 | 57.9 fps, 4 |
| 3 | 14.5 fps (matte on the render thread, 69 ms a frame) | 47.8 fps, 24 (matte 2.4 ms) |

Words are drawn from cached sprites (shadow, bloom, face), not re-rasterised with live blur filters. Caption 3's person
matte runs in a Web Worker on a 256 px copy of the frame (CPU delegate; the GPU path stalls inside a worker), the
renderer composites the latest mask, and until the first mask arrives it segments on the page so a highlight is never
drawn over the speaker. The face detector runs a few times a second, since a card's place is fixed when it starts.
Entries leave rest and land at rest (`fromRest`: 1 - (1 - x^1.3)^3), per the owner rule "speed is a curve, never a step".

## Premium Caption 4 (approved 2026-10-18)

Ref: the reel https://www.instagram.com/p/Dd1Mf7xzsbm/ ("3 different COUNTRIES", "Here's what NOBODY about working tells
you"; local copy `data/refs/captions/c05/`). A poster card: one key word giant in League Gothic narrowed to a very tall
set, a deep glossy accent (`glossKey`, red `#D42020` was the ref) with bevel rims, a solid 3D block and a firm drop
shadow, standing behind the speaker on the free side of the face (tucked behind by a quarter face width at most, so
every letter reads), its letters rising one after another out of a motion trail. The words before it a white
Sacramento script on its top-left corner, written on; after it a white Poppins line under the face, then the closing
words in script, right-aligned.

Ishaan's words: v1 (key centred on the face): "improve the latest font's style, effects and visibility". v2: "push;
it feels you are forgetting old rules, I was not able to see and read all captions" → the key moved beside the face,
one key word per card, the gallery now plays every preset at once on the same clip. Ishaan: "you made it worse, get
 back to previous; when I said I am unable to read, I meant the minimum appear time: appearing too fast and leaving too
 fast". Back to v2 placement (key centred behind the speaker); the timing fix applies to every preset.
Then: "you made it worse, get back to previous; when I said I am unable to read, I meant the minimum appear time:
appearing too fast and leaving too fast". Back to v2 placement (key centred behind the speaker); the readable-time fix
applies to every preset.
Then: "very bad, the text behind the background is the worst yet; check how Caption 3 placed text behind the subject
smoothly, learn it and put it in the skill". v4: the key is wider than the shoulders (3.2 face widths), centred at the
neck, its height capped at about a face, so only the neck and shoulders pass in front of it; the person matte is more
solid (confidence 0.18 to 0.56) so small holes close. "Caption 4 v4 is good. Ship it."
