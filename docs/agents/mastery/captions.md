# Caption mastery

Premium captions built reference by reference with Ishaan (decisions 14 to 16: short iterations, his answers are the
taste). Code: `packages/library/src/captions/premium/` (presets, `draw.ts` painter shared by the live preview and the
MP4 path, `theme.ts` accent ramp). Gallery: `docs/galleries/captions-premium.html`, rebuilt by
`pnpm --filter @moovi/engine exec tsx scripts/caption-premium.ts` (serve the repo root with byte ranges to play it).
Not a product default yet: wiring into types comes later with Ishaan.

## Rules from Ishaan (every caption)

- **Never punctuation on screen** (2026-10-18). Only letters, digits and % $ # & +.
- Every correction also lands in the `ishaan-motion` skill (lessons + talking-head.md) the same turn.

## Premium Caption 1 (approved 2026-10-18)

Refs: `data/refs/captions/c01.png` (still) and the reel https://www.instagram.com/p/DbS2vcfyQxx/ (green at 0 s, red at
4.9 s; local copy `data/refs/captions/c02/`, never committed). A white lead tier and the spoken key word lit underneath.

| | 1.1 | 1.2 |
|---|---|---|
| Lead | Russo One 600, caps, extra word space 0.08 em | Poppins 800, sentence case |
| Key | Russo One 600, caps, extra word space 0.08 em | Russo One 600, caps, slanted (shear 0.2) |
| Colour | any accent: the video's own (`accentFromPixels`) or one picked; refs were green `#52F42E` / red `#FF3434` | same |

- Russo One has one cut (400): 600 is a 4.5 % same-colour round stroke, identical on every layer.
- Key line: dark shadow bed, then a 4-layer bloom (hue-shifted halo → near-white core) and an inner sheen, all from one
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
