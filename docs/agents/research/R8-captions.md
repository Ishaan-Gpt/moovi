# R8: 50 caption styles

Owner: Claude 1 · 2026-10-16. Took over from Claude 2 (light load). **Spec only.** This is data for the library
(`Asset {category: 'caption'}` in R7). The code that draws it comes in the build phase.

## Why 50 is cheap

Today's captions are the visual band, `caption-pop`/`caption-karaoke` (`router/captions-kit.ts`), one ASS style, and
4 `phoneCaption` props that don't apply to footage (R5 3.4). A caption style is a **parameter set, not code**. A
single caption renderer that reads this schema draws all 50. It runs in the browser (live preview) and the visual
compositor (MP4), with ASS as a fallback for the plain ones.

## Rules

- **No hex in a caption style.** Colours are **roles**: `ink`, `paper`, `accent`, `accent2`, `deep`, `pop`. The edit
  style's palette resolves them (the same idea as the style tokens in `packages/library`). One caption style works
  in every edit style and stays on-palette.
- **Fonts are OFL only** (Google Fonts or Fontsource), vendored into `engine/assets/renderer/fonts` when a style ships:
  Anton, Bebas Neue, Montserrat, Archivo Black, Oswald, Poppins, Inter, Instrument Serif, Playfair Display, DM Serif,
  Space Grotesk, JetBrains Mono, Permanent Marker, Caveat, Bangers, Lilita One, Fredoka, Barlow Condensed, Rubik.
- **All 50 are original.** "Like X" in `note` means the energy we studied, never a copy of a trademark look.
- **Placement is a rule, not a guess.** `face-safe` means a face or subject box per sampled frame (MediaPipe,
  Apache-2.0) keeps the text off the face. Every style respects the 9:16 and 16:9 platform safe zones
  (`render/qa.ts` already has `platformZone`).
- Every style needs **word-level timing** except the four marked `line` (they need only phrase times).

## Schema

```ts
interface CaptionStyle {
  id: string; name: string; family: Family; energy: 1 | 2 | 3 | 4 | 5;
  font: { family: string; weight: 400 | 500 | 600 | 700 | 800 | 900; case: 'upper' | 'title' | 'as-is' | 'lower'; tracking: number; italic?: boolean };
  size: 'S' | 'M' | 'L' | 'XL' | 'XXL';            // 4.5 / 6 / 7.5 / 9.5 / 12 % of frame width
  chunk: { mode: 'word' | '2w' | '3w' | 'phrase' | 'line'; maxChars: number; breakOnPause: number /* s */ };
  look: { fill: Role; stroke?: { px: number; role: Role }; shadow?: 'soft' | 'hard' | 'long' | '3d' | 'glow';
          box?: 'pill' | 'block' | 'per-word' | 'underline' | 'tape' | 'bracket' };
  highlight: { rule: 'current' | 'keyword' | 'number' | 'none'; treat: 'colour' | 'scale' | 'box' | 'underline' | 'wiggle' | 'weight'; role?: Role };
  entry: 'pop' | 'spring' | 'slide-up' | 'drop' | 'typewriter' | 'fade' | 'blur-in' | 'stamp' | 'wave' | 'scale-down' | 'mask-up' | 'flip' | 'glitch' | 'none';
  exit: 'cut' | 'fade' | 'slide-up' | 'shrink' | 'blur-out';
  position: 'lower' | 'center' | 'upper' | 'face-safe' | 'beside-subject' | 'behind-subject';
  emoji: 'none' | 'keyword';
  sfx?: 'pop' | 'tick' | 'whoosh' | 'type' | 'none';   // per-word or per-chunk hit, mixed by the edit style
  suits: EditStyle[];    // seeds from R2 until R4 replaces them
  runtime: ('browser' | 'visual' | 'ass')[];
}
type Role = 'ink' | 'paper' | 'accent' | 'accent2' | 'deep' | 'pop';
type Family = 'punch' | 'karaoke' | 'clean' | 'editorial' | 'boxed' | 'kinetic' | 'subtitle' | 'playful' | 'tech';
type EditStyle = 'hormozi' | 'gadzhi' | 'doc' | 'abdaal' | 'noske' | 'greenscreen' | 'brainrot' | 'launch' | 'podcast';
```

`behind-subject` (text behind the speaker) needs a person mask (MediaPipe selfie segmentation). That's a stretch goal;
the two styles that use it fall back to `face-safe`.

## The 50

Short form: **font / case / size** · **chunk** · **look** · **highlight** · **entry** · **position** · E = energy.

### Punch (8): loud, one idea per beat

| id | Font / case / size | Chunk | Look | Highlight | Entry | Pos | E | Suits |
|---|---|---|---|---|---|---|---|---|
| punch-slam | Anton / upper / XL | word | paper, ink stroke 8, hard shadow | current → accent colour + 1.15 scale | stamp | face-safe | 5 | hormozi, brainrot |
| punch-duo | Montserrat 900 / upper / L | 2w | paper, stroke 6 | current → accent | pop | face-safe | 5 | hormozi |
| punch-tri | Montserrat 900 / upper / L | 3w | paper, stroke 6 | keyword → accent, number → accent2 | pop | lower | 4 | hormozi, gadzhi |
| punch-yell | Archivo Black / upper / XXL | word | pop fill, deep 3d shadow | none (every word is loud) | drop | center | 5 | brainrot |
| punch-stack | Bebas Neue / upper / XL | 3w, stacked one per line | paper, long shadow | keyword → accent2 | slide-up per line | center | 4 | noske, gadzhi |
| punch-glow | Anton / upper / L | 2w | paper, glow in accent | current → accent fill | blur-in | face-safe | 4 | noske |
| punch-number | Archivo Black / upper / XXL | word | ink on accent block | number → 1.4 scale, counts up | scale-down | center | 5 | gadzhi, launch |
| punch-shake | Bangers / upper / XL | word | paper, ink stroke 10 | current → wiggle | stamp + 2 px shake | face-safe | 5 | brainrot |

### Karaoke (6): the whole line, the voice lights it

| id | Font / case / size | Chunk | Look | Highlight | Entry | Pos | E | Suits |
|---|---|---|---|---|---|---|---|---|
| kara-pill | Poppins 700 / as-is / M | phrase | ink on paper pill | current → accent box | fade | lower | 3 | podcast, abdaal |
| kara-sweep | Montserrat 800 / upper / L | 3w | paper 40% → paper 100% as spoken | current → full opacity + accent | none | face-safe | 3 | hormozi, podcast |
| kara-underline | Inter 700 / as-is / M | phrase | paper, soft shadow | current → accent underline that travels | fade | lower | 2 | abdaal, doc |
| kara-block | Archivo Black / upper / L | 3w | paper | current → deep text on accent per-word box | pop | face-safe | 4 | hormozi, gadzhi |
| kara-weight | Inter 400 → 800 / as-is / M | phrase | paper | current → weight 800 | none | lower | 2 | launch, abdaal |
| kara-dual | Poppins 700 / as-is / M | phrase | two speakers: ink / accent2 | current → scale 1.08 | fade | per speaker | 3 | podcast |

### Clean (6): quiet, readable, premium

| id | Font / case / size | Chunk | Look | Highlight | Entry | Pos | E | Suits |
|---|---|---|---|---|---|---|---|---|
| clean-inter | Inter 600 / as-is / M | phrase | paper, soft shadow | none | fade | lower | 1 | abdaal, doc |
| clean-lower | Inter 500 / lower / S | line | paper 90% | none | fade | lower | 1 | launch |
| clean-keyword | Inter 600 / as-is / M | phrase | paper | keyword → accent | fade | lower | 2 | abdaal |
| clean-mask | Space Grotesk 600 / as-is / M | 3w | paper | none | mask-up | face-safe | 2 | launch, noske |
| clean-scrim | Inter 600 / as-is / M | phrase | paper on deep 60% band | keyword → weight | fade | lower | 1 | doc, podcast |
| clean-center | Inter 700 / as-is / L | 2w | paper | current → accent | blur-in | center | 2 | launch |

### Editorial (5): serif, magazine, documentary

| id | Font / case / size | Chunk | Look | Highlight | Entry | Pos | E | Suits |
|---|---|---|---|---|---|---|---|---|
| ed-serif | Instrument Serif / as-is / L | phrase | paper | keyword → italic accent | fade | lower | 2 | doc, launch |
| ed-mixed | Inter 700 + Instrument Serif italic / as-is / L | 3w | paper | keyword → serif italic | blur-in | face-safe | 3 | gadzhi, noske |
| ed-quote | Playfair Display / as-is / L | line | ink on paper card | none | slide-up | upper | 2 | doc |
| ed-headline | DM Serif / title / XL | 2w | paper, hard shadow | number → accent | mask-up | center | 3 | doc, launch |
| ed-footnote | Instrument Serif / as-is / S | line | paper 80%, numbered | none | fade | lower | 1 | doc |

### Boxed (6): labels, tape and blocks

| id | Font / case / size | Chunk | Look | Highlight | Entry | Pos | E | Suits |
|---|---|---|---|---|---|---|---|---|
| box-block | Archivo Black / upper / L | 2w | ink on paper block | current → paper on accent block | pop | face-safe | 4 | gadzhi, hormozi |
| box-tape | Permanent Marker / upper / L | 3w | ink on accent2 tape, 2° tilt | none | stamp | upper | 4 | doc, brainrot |
| box-label | Space Grotesk 700 / upper / M | 3w | paper on deep pill, accent dot | keyword → accent pill | slide-up | beside-subject | 3 | greenscreen, podcast |
| box-stacked | Montserrat 900 / upper / L | 3w, a box per line | alternating paper / accent boxes | none | slide-up per line | center | 4 | noske |
| box-bracket | JetBrains Mono / upper / M | phrase | paper, accent brackets [ ] | keyword → accent | typewriter | lower | 3 | greenscreen, launch |
| box-highlighter | Poppins 700 / as-is / M | phrase | ink on paper | keyword → accent2 marker stroke that draws on | fade | lower | 3 | abdaal |

### Kinetic (7): words that move as a design

| id | Font / case / size | Chunk | Look | Highlight | Entry | Pos | E | Suits |
|---|---|---|---|---|---|---|---|---|
| kin-wave | Montserrat 800 / upper / L | 3w | paper | current → lift 8 px | wave | face-safe | 4 | brainrot |
| kin-flip | Bebas Neue / upper / XL | word | paper, 3d shadow | none | flip (x-axis) | center | 4 | gadzhi |
| kin-scatter | Anton / upper / L | 3w, each word at its own angle and scale | paper / accent alternating | keyword → biggest | spring from off-frame | center | 5 | brainrot, noske |
| kin-zoom-word | Archivo Black / upper / XXL | word | paper | the keyword fills the frame for 0.4 s | scale-down | center | 5 | gadzhi, launch |
| kin-type | JetBrains Mono / as-is / M | phrase | paper, blinking caret | none | typewriter + type sfx | lower | 3 | greenscreen, launch |
| kin-behind | Anton / upper / XXL | 2w | paper, behind the subject (mask) | none | mask-up | behind-subject | 5 | noske, launch |
| kin-split | Bebas Neue / upper / XL | 2w, words fly in from opposite sides | paper | none | slide (in from both sides) | center | 4 | gadzhi |

### Subtitle (4): film and documentary

| id | Font / case / size | Chunk | Look | Highlight | Entry | Pos | E | Suits |
|---|---|---|---|---|---|---|---|---|
| sub-film | Inter 500 / as-is / S | line | paper, soft shadow | none | cut | lower | 1 | doc |
| sub-box | Inter 600 / as-is / S | line | paper on deep 75% box | none | cut | lower | 1 | doc, podcast |
| sub-yellow | Inter 600 / as-is / S | line | accent2 fill, ink stroke 2 | none | cut | lower | 1 | doc |
| sub-speaker | Inter 600 / as-is / S | phrase | paper, speaker name chip in accent | none | fade | lower | 2 | podcast |

### Playful (4)

| id | Font / case / size | Chunk | Look | Highlight | Entry | Pos | E | Suits |
|---|---|---|---|---|---|---|---|---|
| play-bubble | Fredoka 700 / as-is / L | 2w | ink on paper bubble with a tail toward the face | keyword → accent | pop | beside-subject | 4 | brainrot, podcast |
| play-marker | Caveat / as-is / L | phrase | accent hand-drawn, an underline that scribbles on | keyword → circled | wave | upper | 3 | abdaal |
| play-sticker | Lilita One / upper / L | word | paper, ink stroke 8, white sticker border | current → 1.2 scale + tilt | stamp | face-safe | 5 | brainrot |
| play-emoji | Poppins 800 / upper / L | 2w | paper, stroke 6 | keyword → Twemoji beside it | pop | face-safe | 4 | brainrot, hormozi |

### Tech (4): product and UI

| id | Font / case / size | Chunk | Look | Highlight | Entry | Pos | E | Suits |
|---|---|---|---|---|---|---|---|---|
| tech-terminal | JetBrains Mono / lower / M | phrase | accent on deep, `>` prompt | none | typewriter | lower | 2 | greenscreen, launch |
| tech-glitch | Space Grotesk 700 / upper / L | 2w | paper, RGB split 2 px on entry | none | glitch (3 frames) | face-safe | 4 | brainrot, launch |
| tech-chip | Space Grotesk 600 / as-is / M | 3w | paper on deep chip, 1 px accent border | number → accent | slide-up | beside-subject | 3 | greenscreen, podcast |
| tech-hud | Barlow Condensed 600 / upper / M | phrase | accent, corner ticks, a scanline | keyword → paper | mask-up | upper | 3 | launch |

## How the deciding agent picks one

Within the edit style's allowed set (an edit style allows 4–8 caption styles), pick by:
1. **Energy** matched to the beat (hook and punchline high, explanation low).
2. **Speech rate** from `intake`: above 3.2 words/s → `word` or `2w` chunks only.
3. **Face position**: `face-safe` styles need the subject box; with no face, `center` is allowed.
4. **Memory**: FalkorDB steers away from the captions in this user's last films and toward the ones they kept.

**One caption style per film** (two only for `podcast` speaker splits). Changing caption style mid-film looks
amateur, so the beat changes the *highlight and entry intensity*, not the style.

## Build notes (for the plan)

- One renderer, two runtimes: a DOM/canvas drawer for the live preview, and the same drawer inside the visual
  compositor for MP4 (its page already draws captions; generalise it to read this schema).
- `chunks()` in `captions-kit.ts` already does the chunking; extend it with `mode` and `maxChars` from the schema.
- Seed as `(:Asset {category: 'caption', id, energy, runtime, …})-[:SUITS]->(:EditStyle)` per R7.
- About 10 of these should ship in the first build pass: punch-slam, punch-duo, kara-block, kara-sweep, clean-keyword,
  ed-mixed, box-label, kin-type, sub-box, tech-chip. That covers every seed edit style.
