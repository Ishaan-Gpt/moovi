# Demo lab: the pieces the demo film is built from

Live previews (one server for all of them; it supports byte ranges, so video seeks):

```bash
node docs/submission/demo/serve.mjs 4377
```

Open `http://localhost:4377/docs/submission/demo/lab/<id>/`. Reference media lives in `data/demo/refs/<id>/` (local
only, never committed). People in the references are drawn and animated in code for now; Ishaan's own clips replace
them later, one slot per person.

## D1 Card Sky — instagram.com/p/DdUA650hdvS (25.3 s, ~117 BPM, hard cuts at 6.63 s and 18.7 s)

Rebuilt at 16:9 with Moovi's own UI in place of the music cards. `lab/d1/` (`d1.js`, a pure function of t).

| Part | Time | What it is | Demo use |
|---|---|---|---|
| D1.1 card storm | 0–6.6 | ~64 UI cards tumbling in 3D around a figure, some behind and some in front, depth blur by distance, slow push | Moovi's films, preset cards, crew lines and graph cards orbiting the user: "everything Moovi makes" |
| D1.2 serif words in depth | 6.6–11 | water, a held card drifting down, italic serif words blurring in one by one, one giant word passing near the lens out of focus, the back of a head near the lens | the problem/promise lines |
| D1.3 dive into the card | 11–12.4 | log-space push into the card's cover; the cover is the next shot, with a smaller framed copy inside (droste); the shot spills past the card edges so the hand-over has no seam | from a film card into the real product |
| D1.4 backlit figure | 12.4–16.6 | low sun, one soft bloom wrapping the silhouette, hair as filled ribbons in gusts with gold fringe | the human moment (Ishaan's clip later) |
| D1.5 pull-out to a wall | 16.6–18.7 | the shot shrinks into a framed print on a white gallery wall, the name stacked above it, then a whip back to the card | "a film by Moovi" proof beat |
| D1.6 white matte flash | 18.7–19.1 | the figure as a pure white cut-out over a cool sky, 0.4 s | a rhythm punctuation before a big line |
| D1.7 words behind the head | 19.1–25.3 | tall condensed serif words in wine behind the head (the head cuts the type), then the whole grade drains to grey, a small handle with two sparkles | the closing line / CTA |

Sound: the owner's Style 1 pack (`packages/engine/assets/sfx-style1`) on the measured onsets. Copy on screen is a
placeholder from concept A; the words, palette and music are Ishaan's call.

## R4 Red Table — instagram.com/p/DZsVuGdx2cE (108 s, already cloned on 2026-10-16)

The existing clone (`data/refs/r4/clone-motion`, blind judge 6.6), copied to `lab/r4/` with its media paths pointed at
`data/demo/refs/r4/`. Its speaker is already a drawn stand-in. Parts (from `parts.json`): red paper table, cut-out
sticker drop, boiling marker words, word in a design-tool selection box, tall serif word with an eye for a dot,
flipbook numbers, tablet on the table, skeuomorphic plugin panel, black brush card with a cursor, boiling hand label,
tall condensed italic serif captions.
