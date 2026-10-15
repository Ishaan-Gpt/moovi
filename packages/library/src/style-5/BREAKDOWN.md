# Style 5: "Clear Signal" (clean kinetic explainer)

Reference: one approved Instagram reel (`data/references/Da0DayIpsie/`, local only, never committed).
Measured with ffprobe, ffmpeg (2 fps frames and scene detection), faster-whisper (word timings) and ebur128.

## Measurements

| | Reference |
|---|---|
| Format | 1080x1920, 60 fps, 26.35 s, -14.2 LUFS integrated, 2.3 LU loudness range |
| VO | 1 calm male narrator, 5 sentences, 58 words in 23.9 s (2.4 words/s), then about 2.4 s of logo tail |
| Beats | 11 visual set-ups in 24 s, so a new set-up about every 2.2 s. Inside a set-up, a new element lands about every 0.5 s, on the spoken word. Scene detect (threshold 0.25) finds **no** hard cuts: every change is a blur or slide hand-off on white. |
| Hook (0 to 2.2 s) | One huge word alone, then the claim builds around it, with the payload word in the accent colour on a soft glow |
| Ending | The thesis line typed small, the camera slides left, and the 2-word payoff gets a hand-drawn accent ellipse. Then a creator mark plus handle on white, which fades. |

## Grammar (transfers to any topic)

1. **World.**
   - A white paper stage, with one saturated accent hue and near-black ink. Nothing else.
   - The reference's accent is green. Ours is the brand's colour, held at 3:1 or better on the paper.
   - 2 to 3 huge, very blurred accent rings drift at the frame edges at about 15% opacity. This is the only atmosphere.
2. **Type system.**
   - A grotesk sans (medium, tight tracking) for statements.
   - A high-contrast *italic serif* for the one emotional word of a line, in the accent colour, tucked under the grotesk line.
   - A tiny grey grotesk caption (about 26 px) that repeats the sentence under a picture, like a footnote.
   - Sizes: a hero single word at about 150 px, statements at 60 to 100 px, labels at 28 to 34 px. Text is centred, or sits low-centre under a device.
3. **Words follow the voice.**
   - Each word appears at its spoken onset, entering with a blur, a 30 to 60 px slide and a fade.
   - Single-word beats swap one word at a time.
4. **Devices (the picture vocabulary).** These are flat, vector, accent-filled pictograms, never photos.
   - **dial**: a giant clock or gauge arc cropped by the frame, with a sweeping hand. Used for time and urgency.
   - **crowd**: a row of 5 person icons, the centre one in ink, inside accent corner brackets. Used for an audience or people.
   - **cards**: floating mini review or message cards, with outlined "???" behind the line. Used for confusion and voices.
   - **counter**: a progress ring with a number counting up. Used for numbers and time.
   - **nodes**: accent hexagons with white line icons and leader lines to labels, one per listed item. Used for consequences, features and lists.
   - **pills**: a stack of rounded tags, alternating filled accent and outlined ink, one per item, appearing as spoken. Used for qualities and benefits.
   - **words**: one word at a time, centred, in the accent colour. Used for slow, emphatic phrases.
   - **serif**: a whole line in italic serif. Used for a contrarian aside.
   - **circle**: a typed thesis, a slide left, and a hand-drawn ellipse on the payoff. Used for the final line.
   - **end**: mark plus name.
5. **Motion grammar.**
   - No hard cuts. The outgoing set-up blurs and lifts away (about 0.2 s) as the next one blurs in.
   - Elements settle with an expo ease-out in about 0.3 s, then keep a slow drift, so there are no dead frames.
   - Lists build one item per spoken item.
   - The camera only slides sideways, and only on the ending.
6. **Rhythm.**
   - A set-up every 1.5 to 3 s, and an element every 0.4 to 0.7 s.
   - The last set-up holds about 1 s past the voice, then the end card runs about 2 s.
7. **Sound.**
   - The VO is calm, declarative and close-miked.
   - A soft bed sits under it. The mix is very even (2.3 LU loudness range).
   - Light whoosh and pop SFX land on set-up changes and item landings. These are inferred from the motion and were not isolated.
8. **Script shape.**
   - A 1 to 3 word hook noun, then the claim.
   - "Because..." gives the reason.
   - A list of 3 consequences or qualities.
   - A contrast ("aren't X, they're Y").
   - A 2-word payoff at the end.

## Reference content (never copy)

The reference's thesis (attention and clarity), its sentences, its creator mark and handle, and its review-card copy all belong to the reference. Only the clone proof (`s5 --clone`) replays the reference's own transcript and audio for timing, as a test. A shipped film uses the brand's facts, the brand's hue and our own end card.

## Code

- `packages/engine/src/s5/library.ts`: the LIBRARY (66 set-ups, each tagged with needs, family, items, number, roles),
  the composer's vocabulary, the 13 arcs Clear Signal allows and its voice rules.
- `packages/engine/src/s5/client.js`: the live player. One renderer per set-up (`P.<id>`), all in the laws above, plus
  `P.compose`, which draws any improvised `{layout, elements}` spec in the same world.
- `packages/engine/src/s5/plan.ts`: words → beats (deterministic phrase rules) → needs (kit detector, the arc's slot,
  the model's per-line tags via `mergeNeeds`) → `castFilm` (kit `cast` + a closing set-up on the last beat + one fresh
  improvised set-up per film) → improvise (parallel, capped; `sketch` when a model fails) → film.
- `packages/engine/src/s5/icons.ts`: the code-drawn line-icon set (83 icons, one 24x24 stroke grammar).
- `packages/engine/src/styles/s5.ts`: `--url` (arc + kit brief), `--script` and `--clone`; remembers each film so the
  next one is cast away from it. `scripts/s5-gallery.ts` renders every set-up once for a visual check.

The old ten devices (hero, words, serif, dial, crowd, cards, counter, nodes, pills, circle) are ten of the 66.

## Art direction pass (2026-10-15)

Side by side with the reference (`data/studio-proof/art/s5-before-after.png`), the first brand films failed on:

1. **Type-only films.** 5-6 of 9-11 set-ups were words/serif (the reference: 4 of 11, and its devices dominate). Now at
   most ~1 in 3 middle set-ups is type-only and never two in a row; one serif turn ("isn't …") is kept. The rest take
   the picture their line can carry (`pictureFor` in `s5/plan.ts`): a number → counter, people → crowd, time → dial,
   voices/confusion → cards, a spoken list → pills/nodes, else ONE big node (the beat's icon, its accent word as the
   label; one hexagon, then two, then three is the reference's own build). A long beat's split half gets a picture
   device too (it used to add another serif/words set-up).
2. **Devices on the wrong lines.** Cards with "???" on positive statements, a crowd with no people, list pills made of
   four-word chunks ("That matters because it"). Meaning gates: cards only for confusion or voices, crowd only for
   people, dial only for time, list devices only for a spoken list, its items cut at the commas and "and"s.
3. **The hook word sat on its own line.** The huge first word now blurs away just before the line builds, in its own
   layer (its blur-out was being overwritten by its entrance animation).
4. **Blank hand-offs.** The first pictogram / pill of a set-up blurs in with the set-up itself instead of waiting for
   its word, so a hand-off never shows an empty page.

Still short of the reference: the dial / crowd / cards devices only appear when the script talks about time, people or
voices; the reference's camera whips with motion blur between devices are reduced to the blur-lift hand-off.
