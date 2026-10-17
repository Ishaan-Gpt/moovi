# Talking-head and voice-led edits (learned 2026-10-16, reference R1)

Most Reels/Shorts are not music films. They are a person talking, with graphics doing the explaining. The
non-negotiables still hold, but the grid, the layouts and the review loop change. Studied on R1: an 88.6 s 9:16
explainer (speaker in a warm low-key room + crimson poster inserts), 27 scene changes (~0.3/s).

## The grid is the voice
- With no music bed, **word timestamps are the beat grid.** Get them from Whisper (or edge-tts WordBoundary for a
  scratch VO). Every event is `at(word)`, never a hand-typed second: `at('waste')`, `at('six', after=51)`.
- Look words up by normalised text (`lowercase, strip punctuation`) and an `after` time, so repeated words resolve.
- **Clean the stamps first.** Whisper gives out-of-order starts (`read 8.30 / for 8.18`) and missing ends. Force
  `t[i] >= t[i-1] + 0.01` and `end > t`, or captions flicker and lookups jump backwards.
- Whisper mishears names and terms ("Jinxer" for Ginseng, "Sphere" for PURE). Keep a `fixText` map for captions;
  never "correct" what the speaker actually said in big type without the owner's say.
- Cuts land on word starts (slightly before: −0.1 to −0.25 s), slams land exactly on the word.

## Layout vocabulary (one per segment, a segment table drives the edit)
| Layout | What it is | Notes |
|---|---|---|
| `full` | speaker full frame, captions at chest height (~y 1200 of 1920) | the default; jump cuts reframe it |
| `split` | a graphic panel on the top half (0–960), speaker reframed in the bottom half | captions sit on the seam (~y 990); a soft contact shadow under the panel edge |
| `poster` | a full-frame designed poster (the "key art" of the video) | built once, reused as the ground of chapter cards |
| `card` | chapter card: the poster defocused, one element lit, the chapter name | one per numbered point |
Write it as data: `{ t0, t1, k, p(panel), tr(entry transition), n, label }`.

## Camera on footage
- **Every jump cut gets a new framing** (scale from a set like 1.00 / 1.04 / 1.08 / 1.12 / 1.18 plus a seeded
  offset) and lands ~3.5% big, settling over ~0.16 s (cut in on motion), then drifts ~1%/s. Never two identical framings back to back.
- **Punch on slams:** a 6–8% log-space push in 0.18 s on the big word, held (still drifting) to the next cut.
- **Push into a world change:** an accelerating push (ease `in`, ~1.2× over 0.27 s) on the last frames before a cut to a poster.
- **Outro:** one continuous push (~1.16×) through the call to action.
- Without real footage, a stand-in speaker needs 3–5 parallax planes (wall + one big practical-lamp bloom, shelves,
  chair, figure, desk edge) moving by depth with the camera. Mouth and hands follow the word stamps (pure function of t).

## Footage spans: fetch, never freeze (learned 2026-10-16, reference R4)
At intake, mark every span where the reference shows real footage: b-roll behind words, a photo or clip on a card, a
video inside a tablet or phone, a plant or a hand. Fetch each one with `scripts/ref-footage.ts <id> name="query"`
(Mixkit, Commons, Pixabay, Pexels, NASA, Archive; ranked, judged, a still push-in when nothing moves; every clip lands in
the graph as an insert asset with its licence and credit). Draw it with `footage(t, name, x, y, w, h, {at, grade})`.
Grade footage that sits under white words (about brightness 0.6). Drawn stand-ins in these spans made R4 look paused.

## Captions (the base layer)
- Chunk the transcript: **≤ 3 words, ≤ 14 characters**, break on a pause > 0.28 s and after punctuation; a chunk
  lives until the next one starts, at most 1.6 s.
- Inside a chunk, **words arrive on their own stamps** (rise ~12 px, blur 9 → 0, grey → white, 0.26 s), and the
  centred line re-flows as each word grows in. White heavy sans (Inter Tight 800, ~66 px), soft dark shadow (blur ~26, 70%).
- A named term (product, technique) switches that chunk to the condensed face in caps.
- **Hide captions while a big-word moment is on screen.** Two text layers fight.
- **Captions never show punctuation** (owner rule, 2026-10-18): only letters, digits and % $ # & + reach the screen;
  the words keep it for timing and key-word choice.
- **The premium two-tier glow caption** (Moovi preset 1.1 green / 1.2 red, `packages/library/src/captions/premium`):
  white lead tier, the spoken key word underneath larger in a lit colour. Russo One at 600 (one 400 cut: thicken with a
  ~4.5 % same-colour round stroke, never the browser's synthetic bold, which skips offscreen layers and ghosts the glow);
  the tiers sit tight (gap ≈ 0.016 of the short edge, no extra leading); a dark shadow bed under the key word and a
  restrained 4-layer bloom on top (wide hue halo → tight near-white core) so the word reads *highlighted*, not just
  glowy. Entry per word, decoded from the reference reel at 30 fps: pop in at 1.22x and blurred, snap to size on
  1 - exp(-11 s) cos(15 s) (a small undershoot bounce), glow flashes to 1.8x and eases over 0.3 s, the card drifts
  2.5 %/s smaller while it holds. Style 1's typing tick on every word. The red copy: sentence-case white lead
  (Poppins 800) over a slanted (shear 0.2) red key line.

## Big words (the punctuation of the edit)
Variants seen and rebuilt; each lands in log space (1.4–1.5× → 1) with a scale smear and a hit SFX:
- **low:** small connector words above, the key word large at the bottom third ("watching a / VIDEO").
- **top, behind the head:** small line at the top, key word large behind the speaker ("which is actually a complete / WASTE / of … time").
  Needs a person matte on real footage; on a stand-in, draw it between the room and the figure.
  **Place the head so it overlaps the word's lower third**; if the figure sits too low the effect vanishes.
- **left number:** "spend / 5-10" with the unit word ("MINUTES") behind the head.
- **stack:** "looking at / HEADINGS" top-left, then "CHAPTER" + "NAMES" + right-aligned "KEYWORDS" building at the bottom, one slam per word.
- **CTA:** small "comment", the keyword slams, its quote marks arrive a beat later from each side on springs, a small line under it word by word.
Never put another person's name or a real brand in the CTA keyword; use a neutral word and say so.

## Hook (first 3 s)
- A fake progress bar already moving on frame 1 (red fill + dot head + a small halo), the total ("1:06") arriving with
  the words that say it.
- The title rolls instead of cutting: digits and letters that change leave through the top of a slot band and enter
  from the bottom with a jittered stagger, shared letters stay ("66 SECONDS" → "5 SECRETS").
- Count dots pop on the counted noun with springs; on the last frames they are pulled to the centre (ease `in`), which motivates the cut.

## Panels (top half): make every one act out its sentence
| Line | Panel move |
|---|---|
| "names, numbers, anything you read" | icons pop on springs on each word; dashed connectors draw themselves with a moving dash offset |
| "sit for 5 minutes and draw a rough diagram" | a stopwatch sweeps its 5 minutes in ticks; the notebook draws its own diagram on "draw" |
| "these are my notes" | papers drop on firm springs, staggered, and write themselves line by line |
| "personal, useful, relevant, emotional" (an acronym) | each letter is pressed like a key (dips, springs back) and lights on its word, label underneath |
| "instead of saying X, say Y" | X is typed word by word (keystroke each), struck through on "say", steps back; Y typed in the accent colour |
| "like watering the plant" | the can tilts and pours (drops under gravity, seeded), the plant grows one stage per watering word; the label travels short-term → long-term |
| "improves working memory for up to six hours" | the lobe floods with colour across the phrase; a callout line draws; the number rolls 0 → 6 like an odometer |
| "it combines A, B and C" | product springs up and keeps floating; bullets typed one per keystroke with a dash that draws first |

## Chapter cards
- Make the card come **from the poster**: the hero poster has N objects (keys on a ring); card n dives into object n and lights it.
- Background = the poster pre-rendered once, blurred (depth of field), zoomed ~2× toward the lockup so the title reads as huge soft shapes.
- The lit object is drawn sharp and near (not at poster scale), lands with a log-space scale (1.3 → 1), keeps turning a little, one warm bloom.
- Vary the entry per card: flash on motion · rack focus · vertical whip with smear · dive (log zoom from the whole poster). Never the same three times running.

## Transitions that worked for split panels
- **Wipe down** entering at speed (ease `out`, 0.34 s) with 2–4 ghost copies along the velocity.
- **Pixel-block dissolve** in the brand colour: 54 px blocks, seeded order, ~7 frames, a fringe of solid-colour blocks at the reveal edge.
- **Bars** sliding in from alternating sides, each with its own jittered start.
- **Bridge:** the previous panel's lockup condensed into the next panel's header.
- **Under every incoming panel, keep drawing the outgoing shot** (the full-frame speaker clipped to the top half)
  until the panel covers it. Otherwise the reveal shows black.
- Exits back to the speaker are hard cuts with the speaker already moving.

## Sound on a voice edit
The voice is the bed: keep SFX sparse and quiet (gains 0.14–0.5). whoosh → poster/cards, swipe → panel wipes,
tick → dissolves, counts and dots, hit → slams, pop → icon and letter arrivals, one keystroke per typed word.
If the library has no keystroke/tick, a pitched-up pop (rate 1.7–2.4) works as a stand-in, but ask for recorded ones.

## A second grammar: the roadmap / levels edit (learned 2026-10-16, reference R2)
R2 (83.7 s, same creator, ~0.54 changes/s) is a "5 things in order" roadmap. Its devices generalise to any numbered list:
- **A physical marker on the desk.** Five poker chips sit on the desk for the whole list; numbers count down above them
  once ("5 4 3 2 1"); a chess knight hops to the chip of the level being talked about, and that chip lifts when its
  level is named. The list lives *in the speaker's world*, not only in graphics. Any prop row works (chips, blocks, cards).
- **A level world, entered by a coin flip.** Each level is a full-frame neon world: two glowing hands hold an orb; the
  level's number flips up out of a row of numbered discs (3 half-turns) and lands as the orb with the level's name;
  finished levels shrink to small labelled discs on the left. The frame itself turns over like a coin to enter it.
- **Two-tier captions** instead of chest words: the strongest word of the chunk big and heavy (numbers win, then the
  longest non-stop word), the words before it small above and after it small below.
- **Hand labels + self-drawing arrows** point at people, photos and project cards ("student", "PROJECT 3"); the label
  lands first, the arrow draws after (~0.45 s, ramp ease, two-stroke head).
- **White-grid boards** with UI cards rising on firm springs and **lime stickers** stamping the key words on.
- **Words that shatter** (seeded shards blowing one way) for a threat line; **a black card** with lime display type for
  the one technical claim; **a dive onto the desk prop** (log zoom + depth of field) on the line's low point ("give up").
- **Photo inserts need real photos.** Code silhouettes of people read as placeholders; ask for cut-outs (rule 0.1) and
  label stand-ins on screen. Never use real people's names or brands on screen: swap in neutral words.

## A third grammar: the chapter dial (learned 2026-10-16, reference R3)
R3 (88.1 s, ~0.4 changes/s): "5 skills" told through one recurring object.
- **One hero object holds the whole list.** A moss-stone hand holds a dial with a white star; each chapter the hand
  rises over the speaker (0.45 s), the camera dives into the dial (log zoom 0.55 → 1.05, `hard` ease), the dial turns to
  the next chapter and the star spins a little; the finale shows every chapter round it at once. One device, five uses.
- **A display face carries the look**: blackletter (UnifrakturCook, OFL) for the hook and the chapter names, with a gold
  heat gradient and one bloom. Fit wide display words to a width; blackletter caps run very wide.
- **Panels on a night ground** (warm near-black, grain, twinkling stars) instead of a coloured poster.
- **Sound design from the library, as an enhancement**: play the engine's sfx map by event (`kits/motion/sfx.js`) and
  skip any cue where the reference already has a hit (high-band envelope peak > 3.2× the local median). On R3, 31 of 56
  cues already had a native hit; the library added the other 25.
