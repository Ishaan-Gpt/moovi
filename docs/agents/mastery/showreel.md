# Showreel mastery: taste log

Showreel is one of the three presets (Edit, Launch video, Showreel). Entry: `showreel(input)` in
`packages/engine/src/showreel/index.ts`; terminal `tsx scripts/showreel.ts "<brief>" [--url] [--theme]`. The writer reads
the skill's Showreel branch (`.claude/skills/ishaan-motion/references/showreel.md`) at runtime, one Groq call (~1.5–4 s)
picks the theme by id and writes the lines; one theme renderer draws every beat (the lock). References: `refs-showreel.md`.

## Films and verdicts
| # | Brief | Theme (renderer) | Measured locally | Ishaan's verdict |
|---|---|---|---|---|
| v1a | how a lighthouse keeps ships safe at night | night-stage (darkvox) | 40 s to preview | waiting |
| v1b | how a mechanical watch keeps time | blueprint (anatomy) | 131 s (voice retry, 4 improvisations timed out) | waiting |
| v1c | the slow craft of Japanese indigo dyeing | editorial (s4) | 207 s | waiting |
| v1d | a morning at Mumbai's Sassoon fish dock | real-footage (clip-moment) | ~90 s, 2 beats found no free clip | waiting |

## Seen before review (not taste, plumbing)
- The writer's colour is literal: "indigo" became #4B0082 (purple), the real dye is a deep blue. Lines run telegraphic on
  blueprint and editorial ("Quiet fermentation process."). Night stage casts props loosely (sun, bird, bell on a lens line).
