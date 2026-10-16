# Style 1 SFX: the owner's pack, shipped

Vendored from MotionEasy `styles/style-1/sfx` (2026-10-17) so Moovi needs no MotionEasy at run time. The owner pack is
Ishaan's to ship (owner, 2026-10-17); the fs.* files are CC0 (Freesound), kenney.* CC0, tonal.* and ui.pop MotionEasy
synths. `map.json` is the event → sound map with the owner's levels and reasons; `packages/engine/src/audio/style1.ts`
renders it (a port of MotionEasy's sfx_mix.py) and mixes it the way tl_make.py did.
Originals are never edited: the craft is when, where and how much. 

| File | Source | Use |
|---|---|---|
| typing.mp3 | owner pack | words: one note per word, synced (event `word`) |
| ui-animations.mp3 | owner pack | pop-ins, list items, cards (one blip at a time by start offset) |
| finger-snap.mp3 · finger-snap-tight.wav | owner pack (+ 0.6 s cut) | key-word emphasis |
| riser.mp3 · riser-short.wav | owner pack (+ last 1.4 s) | build into a reveal / CTA |
| ui-riser.mp3 | owner pack | short bright rise, UI reveal |
| woosh.mp3 · woosh-short.wav · woosh-tight.wav | owner pack (+ 0.45 s / 0.3 s cuts) | moves, slides, exits (original is slow) |
| fs.whoosh.swosh-whoosh-air-cut.wav | qubodup, CC0 | fast air cut |
| fs.impact.punch2.wav | Daleonfire, CC0 | hard hit |
| fs.impact.soft-hit.wav | Krokulator, CC0 | soft landing |
| viral.ui-riser.wav | owner pack (via MotionEasy library) | bright riser |
| viral.typing.wav | owner pack (via MotionEasy library) | typing burst |
| fs.foley.very-fast-typing-short.wav | Capt.Jack, CC0 | fast typing |
| kenney.click.wav | Kenney, CC0 | soft click |
| fs.ui.mouse-2-button-fast-click.wav | aphom000, CC0 | mouse click |
| fs.ui.pop-4.wav · fs.ui.pop-9.wav | quatricise / D.S.G., CC0 | pops |
| fs.ui.the-best-bubble-pop-sound-fo.wav | el_boss, CC0 | bubble pop |
| fs.foley.water-drop.wav · fs.foley.water-drop-splash.wav | florianreichelt / bxyorna, CC0 | drop accents |
| tonal.chime.wav | MotionEasy synth, take 9 | bell for a logo / number landing |
| tonal.notify.wav | MotionEasy synth, take 9 | two-note ping, notification moments |
| ui.pop.wav | MotionEasy synth, take 9 | quick pop for chips and badges |

Re-fetch owner pack: `.venv-audio/Scripts/gdown --folder <drive link> -O styles/style-1/sfx` then rename to the names above.
