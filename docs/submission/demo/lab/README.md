# Demo lab: the pieces the demo film is built from

Live previews (one server for all of them; it supports byte ranges, so video seeks):

```bash
node docs/submission/demo/serve.mjs 4377
```

Open `http://localhost:4377/docs/submission/demo/lab/<id>/`. Reference media lives in `data/demo/refs/<id>/` (local
only, never committed). People in the references are drawn and animated in code for now; Ishaan's own clips replace
them later, one slot per person.

## D1 Card Sky — instagram.com/p/DdUA650hdvS (live picture 1080×756 inside 9:16, 25.28 s)

v2 (2026-10-18, after Ishaan's 2/10 on v1: "copy it exactly … the sphere became a weird idk what"): an exact copy in
three.js, measured at 10 fps, in the reference's own frame, with "original beside" for side-by-side checking.
Re-skinned only: Moovi cards, placeholder copy, a drawn cast (Ishaan's clips replace the people later).

| Part | Time | Measured from the reference | Ours |
|---|---|---|---|
| D1.1 card sphere | 0–6.63 | ~60 cards on a sphere round the head, tangent (edge-on at the sides, mirrored on the far half); cards sweep in past the lens 0–0.5 s; jump cuts every 0.1 s between profile and rear 3/4 for 0.8 s; the spin dies to ~0 at 1.35 s then cruises; whoosh + low boom at 0.1–0.4 s | Fibonacci sphere, 64 cards, R 0.9, 6-sample motion blur through the open |
| D1.2 words in depth | 6.63–10.45 | over the shoulder above the sea, camera trucks left and forward; Times-italic lines standing in 3D, each word fades in grey → white; lines pass the lens big ("If" exits lower right at 8.0); the card rides top-centre → left edge → glides in with a light streak (9.8) and turns to face us | 3D word planes (sharp + blurred copies), a shaded sea, card in camera space |
| D1.3 droste dive | 10.45–12.6 | the cover photo sinks, revealing nested cover frames (each ~0.7×), joined by white walls; the camera flies the tunnel, the last window opens on the girl | 5 nested frames + box walls, geometric (log) pacing |
| D1.4 backlit girl | 12.6–16.4 | girl in profile, sun just left of her face with a vertical streak, hair gusts at ~13.4 and ~15.4 | drawn, hair as soft locks |
| D1.5 tunnel out | 16.4–18.7 | the same tunnel in reverse to the card over the sea; a riser 17.1 → 18.7 | reverse path, riser-short ends on 18.7 |
| D1.6 negative flash | 18.7–18.83 | two frames of the next shot colour-inverted (blue sky, white figure) | invert of D1.7's first frame |
| D1.7 words behind the head | 18.83–25.28 | the boy at dusk, camera tilts up (he sinks); tall crimson condensed Didone in two rows round the head, each word cuts on whole (20.9 / 21.8 / 22.6 / 23.0); the i-dots are four-point stars; a small handle at 23.1; the grade drains to grey 23.3–24.6; near-silence 19.8–20.8 before the first word | Bodoni Moda stretched, crimson #a8131d |

Sound: the reference is a song with three designed moves (the open's whoosh + boom, the riser into the negative, the
hush before the words). Ours places the owner's Style 1 files on those moves; "original audio" plays the song for
timing checks only (it is not ours to ship). The demo film's music bed is Ishaan's pick.

## R4 Red Table — instagram.com/p/DZsVuGdx2cE (108 s, already cloned on 2026-10-16)

The existing clone (`data/refs/r4/clone-motion`, blind judge 6.6), copied to `lab/r4/` with its media paths pointed at
`data/demo/refs/r4/`. Its speaker is already a drawn stand-in. Parts (from `parts.json`): red paper table, cut-out
sticker drop, boiling marker words, word in a design-tool selection box, tall serif word with an eye for a dot,
flipbook numbers, tablet on the table, skeuomorphic plugin panel, black brush card with a cursor, boiling hand label,
tall condensed italic serif captions.
