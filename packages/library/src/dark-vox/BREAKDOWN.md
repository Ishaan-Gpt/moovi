# Dark Vox: breakdown of the reference

Reference: Instagram reel `DdI5hwFuoI6` (downloaded once with owner approval to `data/references/DdI5hwFuoI6/`, gitignored).
This file keeps the transferable grammar with numbers. The reference's content (its subject, characters, artwork and
words) is never copied into a shipped film. Every number below lives in `tokens.ts`, which is the file to edit.

How it was measured: ffmpeg frames at 4 fps plus scene-change frames (`select=gt(scene,0.2)`); full-res crops; per-frame
luma, vignette (corner/centre luma), percentiles and median-cut colour clusters (PIL, 115 frames); camera motion from ORB
features + RANSAC similarity per frame pair at 15 fps (scale, roll, translation); voice transcribed with faster-whisper
(small, word timings); loudness with ffmpeg ebur128.

## 1. Format and structure

| | |
|---|---|
| Format | 1080x1920, **15 fps** as delivered, H.264 + AAC 44.1 kHz |
| Duration | 28.8 s (voice 0.0-23.2 s, then a 5.6 s product tag) |
| Shots | 12 (scene cuts at 1.73, 4.0, 7.4, 9.67, 11.27, 14.6, 17.3, 19.27, 21.5, 23.6, 26.73 s) |
| Shot length | median 2.4 s, min 1.6 s, max 5.1 s; a cut lands on nearly every voice sentence or comma clause |
| Beats | hook question (0-3.4 s) → three status nouns (4.0-6.7) → the flaw (7.3-9.1) → belief (9.8-13.9) → the antagonist's three negations (14.6-19.0) → the turn and the punchline (19.4-23.2) → tag on a lit paper desk → acid-yellow end card with the wordmark |
| Voice | one male narrator, deep and slow (about 2.3 words/s), documentary calm, no music swells under the punchline |
| Loudness | -14.1 LUFS integrated, RMS per second -11 to -21 dB; a dark ambient bed under the voice; whooshes on the zoom-through cuts, paper/card foley on prop entries |

## 2. Camera (measured frame to frame at 15 fps)

- **Zoom-through cut** (the signature). The 4-5 frames before a cut ramp in: per-frame scale ×1.0017, ×1.0042, ×1.0185, ×1.10
  (expo-in, about +13 % in the last 0.33 s). The new shot lands still zoomed and settles: ×1.136-1.161 on the cut frame, then
  ×1.067, ×1.035, ×1.016, ×1.003: the per-frame zoom halves every frame, an **expo-out of about 0.42 s** from +13 % to rest.
  Motion blur rides the ramp and the landing.
- **Hold.** Between moves the camera is dead still for 0.5-1.5 s (scale 1.0000, translation under 0.02 % of frame). No handheld
  shake anywhere. During long holds a slow push of about **+1.5 %/s** (12.3-14.5 s).
- **Pull-back.** 6.9-9.6 s: sustained ×0.98-0.99 per frame (about -20 %/s easing out), roughly 1.55x → 1.0. Used to reveal a set.
- **Portal (frame-within-frame).** 9.67 s: the whole previous shot drops to **0.30 of its size in one frame**: it has become a
  framed picture on the next set, and the camera keeps pulling back (×0.77, 0.91, 0.95, 0.97, 0.98, 0.99: expo-out over ~0.9 s).
- **Rise / tilt.** 15.67 s: vertical move of -8.7 % of frame height per frame decaying (-5.4, -3.5, -2.25, -1.6, -0.9): about
  **23 % of frame height in 0.8 s**, with a 1° roll that settles to 0.
- **Whip / slide.** 5.27 s and 6.33 s: 8.5-9.5 % of the frame per frame, about 28 % of the frame in 0.4 s; cards cross the lens.
- **Roll.** Below 0.2° almost always; 1-4° only while an object enters (14.73 s: -4° for one frame).
- **Depth.** Every set is 4-6 flat planes (backdrop, floor, booth/frames, hero cut-out, wings/curtains, hanging stars and clouds
  in front). Planes nearer the lens slide and scale more (clear 2.5D parallax on every push). Focal feel: a long lens on a model
  stage, no fisheye; DOF only as soft drop shadows behind cards, no real bokeh.

## 3. Lighting

- **One spotlight + deep vignette** on every dark set: corner/centre luma ratio **0.23-0.45** (median about 0.36). Bright sets
  (sunburst, graph-paper desk) still darken the corners (0.87-0.55).
- **Black and white points:** 2nd-percentile luma 6-17 (shadows crushed but never pure black, except the lamps set at 1),
  98th percentile 220-246 (highlights never clip).
- **Practicals with bloom:** two street lamps (warm core about #FFF2C8 → #FFB347 → rust) throw a soft halo that lights the
  floor and the type below them; the title is lit top-down (white at its top edge, warm grey at its foot).
- **Top light / volumetric:** the desk and wood shots are lit from above with a soft falloff; a faint haze cone on the stage
  shots.
- **Light reacts to type and objects:** words sit inside the scene's light (gradient fill top → bottom, dark drop shadow
  0 10 px 30 px), cards and props cast soft contact shadows on the set.
- **Grain / print feel:** fine grain and an engraved/painted print texture on everything; no glossy CG.

## 4. Gradients and colour (sampled cluster centres)

| Role | Hex |
|---|---|
| night backdrop | `#0D121D` (with a lighter centre `#1C2740`) |
| warm black (velvet folds, wood shadow) | `#231A18` |
| velvet / harlequin red, shadow → lit | `#5E2222` → `#A8282B` |
| card stock / harlequin white | `#F0EEE7`, aged paper `#D8D0BC` |
| paper waves lit → shadow | `#2C67AD` → `#1E3F73` |
| wood → lit wood | `#45291C` → `#7A4A2E` |
| brass / gilt | `#A8743A` / `#E2B456` |
| lamp core bloom | `#FFB347` |
| marker annotation | `#D62B2B` |
| end card radial | `#DCDB09` centre → `#797905` corners |

Gradient types: radial spotlight on every set (ellipse centred at about 50 %/52 %); conic sun-ray backdrop (alternating
cream/parchment 7° wedges, slowly turning); linear velvet folds; radial lamp halos; the end card is a pure radial. Grade:
warm (sepia push), contrast up, mean saturation 23-38 (the paper waves 70, the end card 162: one loud colour per shot).

## 5. Type

- **Rare and big:** words appear in only 5 of 12 shots, 1-3 words each, always the punch noun of the line.
- **Title:** condensed heavy grotesque, cap height about 13.5 % of frame height (the line box about 18 %), about 75 % of
  frame width, centred at about 40 % height, **set behind the hero** (the subject stands in front of the letters); a second line
  at about 36 % of its size ("subject + verb" under the hero word).
- **Engraved:** heavy old-style serif, about 3.4 % of frame height, tracked +8 %, letterpress white with a hard 4 px shadow.
- **Label:** heavy rounded grotesque, about 4.5 % of frame height, white with a dark halo, circled by a hand-drawn red marker
  ellipse that draws on in about 0.4 s, 0.25 s after the word.
- **Timing vs voice:** each word appears on its spoken onset; a 2-frame pop (scale 1.15 → 1, blur → 0); letters are never
  typed one by one.

## 6. Objects and visuals

Vintage paper-theatre collage: playing cards, tarot cards, a ticket booth, gilt frames, paper clouds, hanging brass stars,
paper waves, a globe on a stick, a newspaper desk. Engraved / painted print look, every piece a flat cut-out plane with a soft
drop shadow, stacked in depth. In Dark Vox every one of these is drawn in code: the sets (harlequin, sunburst, night, waves,
wood, swirl, graph paper, checker floor, velvet booth stage) are CSS/SVG in the token palette; the hero is a model-drawn
layered SVG (greys) mapped through the brass/oxblood tritone and lit by the stage.

## 7. Motion grammar

- Entries: cards and props rise or slide in with a small back-out overshoot and a roll that settles (about 0.45 s).
- Exits: none on their own; every shot leaves through the camera (zoom-through, portal or whip).
- Set life during a hold: sun rays turn about 3°/s, waves bob, hanging stars sway ±4°, clouds drift.
- Easings: expo-in into a cut, expo-out out of it, a long in-out glide for pulls and rises, back-out for prop landings.

## 8. Gaps of the code version vs the reference

- The reference's art is dense, painterly illustration; ours is code-drawn (CSS/SVG sets + model-drawn SVG heroes), so it reads
  simpler and flatter up close.
- No real photographic live-action shots (the reference cuts to two dark film stills). Dark Vox never uses stock footage.
- The end tag (paper desk with app icons) is reduced to the acid radial + wordmark card.

## 9. Art direction pass (2026-10-15)

Side by side with the reference (`data/studio-proof/art/darkvox-before-after.png`), the first brand films failed on:

1. **Every prop in the brand's hue.** A brand tritone made every hero the same green: the reference's cards, booths and
   frames are full-colour engraved prints. Heroes are now drawn in COLOUR from the set's own inks (cream, parchment,
   brass, gilt, wood, cobalt, navy, oxblood) with the brand's hue as the ONE loud ink on one part of the prop, as a
   vintage engraved and hand-tinted print (`SYSTEM_COLOUR` in `s4/picture.ts`; no tone map, the relief light, cut
   edge and shadows stay).
2. **Stock symbols, repeated.** The Duolingo film showed a padlock four times and a lightbulb. The props are now planned
   together first (`planDarkVox`): one specific vintage object per line made of its nouns (a ticket, a tarot card, a
   pocket watch, a gramophone, a globe on a stand), never the same object twice in a row or more than twice a film, and
   no stock symbols (lightbulb, padlock, key, trophy, handshake, chess, rocket, gears, target, magnifier): the plan is
   rejected and redone if it has one.
3. **Small heroes.** The hero box is 80 % of the frame width (was 72 %).
4. **Bot walls** are read in a browser or stop the run with a plain message (`pageHtml` in `styles/common.ts`).

Still short of the reference: one prop per shot (the reference layers 2-4: a card, a pocket watch, a moon), no
characters or live-action stills, and the props are code-drawn engravings, flatter than its painted collage.

## 10. A style, not a template (2026-10-15)

The first Dark Vox was one reel's shape: one script form, nine sets rotated in near-fixed order, one framing (a drawn
prop centred on a set). Now only the laws above are fixed; what stands on the stage is cast per line:

- **Arcs.** Eleven night-fable arcs (fable, before-after, origin, stakes-ladder, myth-truth, day-in-life, zoom-out,
  contrarian, question-answer, one-number, customer-voice), picked from the site's signals, away from the last films.
- **Library.** 53 stage set-ups (`packages/engine/src/darkvox/library.ts`, renderers in `stage.ts`): spotlight,
  pedestal + marquee, curtain reveal, top-hat reveal, shadow play, marionette, diorama, pop-up book, versus, balance,
  mirror, moon/sun, masks, carousel, lantern procession, gallery wall, conveyor, toy train, three doors, marquee word,
  ticket, telegram, playbill, newspaper, megaphone, title card, quote card, window, door, map, constellation, orbit,
  bridge, letters in flight, paper boat, staircase, tightrope, searchlight, fog, clock tower, hourglass, candle,
  storm, treasure chest, telescope, audience, confetti, curtain call, odometer, giant number, coin stacks, growing plant.
- **Props.** 53 code-drawn engraved paper props (`props.ts`) in the set's inks, the brand hue on one part; a
  model-drawn picture is the hero of at most four shots. No prop twice in a film; no stock symbols.
- **Improvising.** A line nothing serves is staged by the composer from the Dark Vox grammar (layouts solo / pair /
  procession / pedestal / frame / rain / orbit / stair; kinds prop / word / label / number / shape / lamp / arrow);
  a model-made one joins the library.
- **Safe type.** Words sit in a zone the set-up leaves empty (top, mid, low) or on the object that carries them (a
  sign, a ticket, a headline), never behind a prop; the spotlight rises to a top title; white type turns to letterpress
  ink on the bright sets; lines inside velvet drapes keep inside them.
