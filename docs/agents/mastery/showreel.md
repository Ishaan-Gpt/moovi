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
| v2a | lighthouse | night-stage, with the arc | 166 s (4 films at once) | waiting |
| v2b | mechanical watch | blueprint, with the arc | 110 s | waiting |
| v2c | indigo dyeing | editorial, with the arc | 174 s | waiting (cta invented "Kyoto Indigo Studio": the check now catches it) |
| v2d | Sassoon dock | real-footage, with the arc | ~120 s, 5 of 8 beats found no free clip | waiting |

| v3 | moovi-three.vercel.app (a brand) | editorial, brand arc | 47.5 s to preview | **cool** (Ishaan): keep the brand arc + creative-director writer |

## Taste learned
- **Ishaan (2026-10-18): every Showreel script follows hook -> problem -> solution -> .. -> cta** (his writer-agent
  template, ISHAAN-VISION part 4). v1 used the old styles' voices with no arc. Now in the skill (1.15.2) and checked in code.
- A topic film's cta names nothing the brief does not give (v2 invented lighthouse.org, WatchLab, Indigo Studio). Skill 1.15.3.

- **Ishaan on v2 (0/10):** it is a BRAND showreel; he could not tell what any reel was about; the writer must be the
  creative director (understood, watched, brand promoted); black screens where clips failed must never happen. Skill 1.16.0.

## Seen before review (not taste, plumbing)
- The writer's colour is literal: "indigo" became #4B0082 (purple), the real dye is a deep blue. Lines run telegraphic on
  blueprint and editorial ("Quiet fermentation process."). Night stage casts props loosely (sun, bird, bell on a lens line).
