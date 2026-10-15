# Style 4 grammar: the editorial metaphor essay

Source: MotionEasy `.claude/skills/style-4*`, `styles/style-4/breakdowns/creative-inflation.md` and the three
@rit2raj_das references (`styles/style-4/references/Instagram-*`). The MotionEasy renderer is the Remotion
composition `S4Film` (`launch-remotion/src/style4/`). It is **not** in the vendored canvas bundle, so Moovi
plays Style 4 on its own small player (`packages/engine/src/s4/player.ts`).

## The ten laws

1. **One world.** One hue in four stops plus an ink of the same hue. Reference periwinkle: centre `#E3E7F8`,
   mid `#C6CDFA`, top `#7D89E2`, corners `#4652B5`, ink `#1F224A`, paper `#F4F5FF`. The stops sit at about
   L 92/82/58/38 and the ink at about L 13-15. The world is a vertical oval spotlight, brightest on a floor 55-80 %
   down the frame. Every picture is mapped into the hue (luminance becomes ink, edge, top, mid, paper).
2. **One sentence, one picture, made of that sentence's nouns.** The kinds are literal (30 %), fusion (25 %),
   replacement (15 %), scale shift (10 %) and collection (10 %). Never three literals in a row.
3. **The picture lands with the cut; the voice is typeset over it.** Every spoken word is on screen, typed
   letter by letter from its onset (0-4 frames late, at least 24 letters per second, done by 80 % of the word).
   The newest letter settles from scale 1.25 in 2 frames.
4. **Hierarchy is meaning.**
   - KEY words (nouns, verbs, numbers) are heavy condensed caps, about 124 px at 1080 w, leading 0.92.
   - Connectors are condensed italic lowercase at 0.31-0.36 of the key size. Before a key run they tuck in at
     the left, hanging from the cap line; after it they form a tail on the baseline.
   - ONE coined two-word term is set in heavy italic caps.
   - A lockup is 45-65 % of frame width, sits above and/or below the picture (clause 1 top, clause 2 bottom),
     and never covers the picture.
5. **Photographic truth.** Pictures are real things with real texture. Smooth clay or toy renders go flat in
   the hue. At most 2 natural-colour spot pictures a film.
6. **The antagonist has a language.** One visual dialect (scanline, halftone, pixel, melt) on 1 of every 3-4
   pictures, only on lines where the antagonist acts, never two beats in a row.
7. **An essay about the viewer's world.** It needs a disagreeable thesis, sourced specifics, a coined term, a
   turn and a quotable last line. No hype words, no lists, no CTA voice-over.
8. **Grounded, lit, alive.**
   - Shadows: a cast shadow plus a contact shadow in the ink hue, staying on the floor when the picture lifts.
   - Light: a top-left key, a rim and a sliding glint.
   - Entrances: push (scale 0.76 to 1 with focus, 4-6 frames), turn-in (from about 38° to face the camera, on
     1 hero in 3), fly or drop. Never the same entrance three times in a row.
   - After landing the picture never stops: float, a 6-16° turn, and a slow +6 % push.
   - Exits accelerate into a hard cut. The world stays, so a cut reads as a page turn.
   - Halftone, grain and edge burn sit over every frame.
   - The music bed sits 7-8 LU under the voice. The full Style 1 SFX kit runs under the events: typing on
     words, a whoosh on cuts, a thud on landings, a chime on numbers and a snap on the coined term.
9. **Something new every second.** A new picture every 2-5 s (mean 3.5 s; no beat over 7 s or under 1 s).
10. **Never the first idea, never self-graded.** A side-by-side with a reference decides.

## Devices

- **Orbit.** A dashed white ellipse, tilted, half behind and half in front of the hero. It draws on, then
  keeps circling. Use it 3-5 times a film, only on lines about turning or cycles.
- **Arrow, circle, beam, binary.** At most once each.

## What Moovi does differently (fast mode)

- Every picture is drawn in code: one model call per sentence writes a layered greyscale SVG.
- A fixed filter stack adds paper grain, relief light from the top left, an irregular cut edge, a white cut
  border, contact shadow and the tone map into the world. The player adds the floor shadow, halftone, glint and
  grain.

## Art direction pass (2026-10-15), against the three references

Gaps found beside the refs (contact sheet `data/studio-proof/art/s4-before-after.png`) and the rule each fix encodes:

1. **Pictures read as clip-art** (Haiku blobs, discs, slabs). Sonnet now draws every picture (Haiku is the fallback) and
   plans them (Sonnet, then Haiku): each line is a REAL, specific, photographable object made of its own nouns (a worn
   loafer, a brass compass, a stack of receipts), never an abstract shape or a symbol; at most two literals in a row, at
   least one fusion and one scale shift a film.
2. **No value range** (everything mid-blue). Auto-levels: each picture's lit luminance (2nd-98th percentile) is stretched
   to the full tone map before the cut filter, and the drawing prompt asks for photo value (near-black core shadows,
   near-white edges).
3. **Pictures melted into the field.** The refs' pictures are near-neutral B&W prints with the hue only as a cast; the
   tone map is now a print ramp (hue saturation 11-24 %, the field keeps its 46-78 %), so the print pops off the floor.
4. **Small pictures.** The picture box is 33-52 % of the frame height (hero 44-56 %), up to 92 % wide, and may tuck
   under a lockup's edge; the type always sits above the picture (z-order), never under it.
5. **Lockups always centred.** Blocks now alternate: centre, left margin, right margin (clause 2 on the side opposite
   clause 1), the picture leaning 5 % the other way; the coined-term hero stays centred.
6. **No devices.** The orbit now rides the hero and every ~4th picture (at most 4, never two in a row), drawn around
   the picture wherever it leans, its front half above the picture.
7. **Bot walls.** A site that answers with "Just a moment…" is read in a real browser (the JS check usually clears in
   seconds); still a wall, the run stops with a plain message instead of an essay about a verification screen.
8. **Still short of the refs:** the pictures are drawn, not photographed (law 5): material and texture are flatter, hands
   and people read as shapes, and collections are neat grids rather than the refs' taped photo walls.

## A style, not a template (2026-10-15)

The ten laws above never change. What changed is everything they used to fix in place:

- **Arcs.** A film picks one of 10 editorial arcs (myth-truth, contrarian, origin, zoom-out, fable, stakes-ladder,
  before-after, one-number, customer-voice, day-in-life) by the site's signals, away from this style's recent arcs.
  Lines breathe a little longer than the kit's, and every arc gets the NAME IT line for the coined term.
- **Compositions.** Every beat is cast from `packages/engine/src/s4/library.ts` (47 set-ups in 42 families, each with
  a renderer in `s4/client.js`), by what its line needs: needs + slot fit − set-ups of recent films + a per-film
  jitter, never one family twice in a row. The picture is still drawn per line; the set-up decides how many pictures
  it asks for (0 for pure type, 2 for a pair) and how they are framed (a close-up for the macro crop, a silhouette for
  the shadow).
- **Improvised set-ups.** A beat no set-up serves is improvised from the Editorial vocabulary (layouts hero, stack,
  row, grid, split, orbit, path, scatter, corner, frame; pictures, words, labels, numbers, paper and pen devices) and
  drawn by the player's composer under the same laws. A good improvisation joins the library (`data/library/s4`).
- **Devices** are no longer "at most once each": they are set-ups, and the cast's variety rules ration them.
- **Look at it:** `tsx scripts/s4lab.ts --from data/s4/<film> --setups all` plays every set-up over an existing film
  (no model call); `--setups layouts` shows the composer's layouts.
