# Launch looks rebuilt from Ishaan's references

Each file is a whole live film (one HTML page, canvas 2D, the audio is the clock), made for Resend and kept as the
starting point for the next brand. The taste behind them is in the ishaan-motion skill, `references/launch.md`
(looks L-REF-3 and L-REF-4, and the reference-intake procedure).

| File | Reference | Length | What it is |
|---|---|---|---|
| `l-ref3-tour.html` | ref 3, Commas Studios (instagram.com/p/Dd_YP9Wo8c-) | 30 s | "Product tour": the black was a screen, real screens the camera dives into, glass over night → day, a light world with the sky under the type, the 3D mark composited on light. Owner on f12: "better, push it further"; f14 adds the finish layers. |
| `l-ref4-calm.html` | ref 4, Notely (instagram.com/p/DeO1Rh7x5Qm) | 21 s | "Calm one-hue": a three.js stack of the brand's emails, a three.js desk whose screen asks the question, tiny drift-in type on soft fields, focus pulls, a word cycler, the name out of scrambled letters. |

## Running one
The pages read their media from `./assets/` (the `<base href>`), which is not in git: it holds the brand's own
screenshots and renders (`real/`), plates from the footage finder (`plates/`), photos (`media/`), the logo
(`img/logo.png`) and the sound folder `snd/` (the owner's Style 1 pack from `packages/engine/assets/sfx-style1` plus the
bed: `bed.m4a` = Mixkit "Golden Storm", `bed2.m4a` = Mixkit "Close Up", both Mixkit free licence, fetched by
`fetchMusic`). The Resend set lives at `data/freeform/resend-v12/`; serve the folder with byte ranges (the films play
video) and open the page. `window.__render(t)` renders a still at `t`; `window.__ready` is set once warmed.

## Re-skinning for another brand
Swap the palette ramp `ST` (from the brand's CSS, the palette gate), the words in each scene, the image and video
lists (`imgs`, `vids`) for the brand's real screens and plates, and the `CUES` list if a scene's timing changes.
Keep the engine parts as they are: sprites with pre-blurred bitmaps, the beat warp (`KN`/`AK`), the owner's sound map,
glass, soft fields, and (L-REF-4) the three.js scenes rendered at 3/4 size.
