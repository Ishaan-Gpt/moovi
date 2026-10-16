# The library: every reusable piece in one FalkorDB graph

Generation styles, Auto and the editor all draw from one library stored in the craft graph. Each piece is one node, with
one implementation per runtime. The spec is `docs/agents/research/R7-library-node.md`, and the queries are in
`docs/QUERIES.md` (section `library`).

## The shape

```
(:Asset {id:'<category>:<slug>', category, name, about, runtime[], licence, credit, ship, attribution, file,
         vendored, energy, tags[], params(JSON), impl(JSON runtime→code ref), seed, src})
  -[:SERVES {w}]->(:Need)          what a beat needs: hook, number, list, compare, cta, calm…
  -[:FITS {gainDb, first}]->(:Event)  sfx: which edit event it sounds on (engine sfx map)
  -[:SUITS]->(:EditStyle)          the edit styles it belongs to
  -[:IS_A]->(:Transition)          a transition's family
(:Reference {id, url, title})-[:HAS_PART {role, at, note}]->(:Asset)   a video reference broken into parts
(:Kit {palette, type, motion, frame, src})-[:HAS {role}]->(:Asset)     a look as one re-skinnable unit
(:Reference)-[:TAUGHT]->(:Kit)
```

Categories: voice, sfx, music, caption, transition, effect, camera, ui, 3d, insert.
On 2026-10-16 the graph held **755 assets**: 263 insert, 138 ui, 109 effect, 76 camera, 63 voice, 30 music,
26 transition, 22 sfx, 15 3d and 13 caption. Voices are not shippable yet because they need their licence checked.

## Commands (FalkorDB must be running: `pnpm falkordb`)

| Command | What it does |
|---|---|
| `pnpm --filter @moovi/engine library` | seeds the whole catalogue (`packages/engine/src/library/catalog.ts`) and prints counts; `--counts` only counts |
| `pnpm --filter @moovi/engine reference ../../data/refs/<id>/parts.json` | adds a reference, its parts and its kit |
| `pnpm --filter @moovi/engine exec tsx scripts/ref-intake.ts <id> <url>` | one-command intake of a new video reference into `data/refs/<id>/`: download, cuts, contact sheets, 2 fps frames, voice, Whisper word stamps, transcript (about 30 s) |
| `pnpm --filter @moovi/engine exec tsx scripts/ref-footage.ts <id> name="query" …` | real footage for a clone: wherever the reference cuts to b-roll or a photo, the engine footage finder (Mixkit, Commons, Pixabay, Pexels, NASA, Archive) fetches a clip into `data/refs/<id>/footage/` with its licence and credit, and seeds it as an insert asset linked to the reference. A drawn stand-in there reads as a paused video |
| `pnpm --filter @moovi/engine exec tsx scripts/camera-layer.ts <camera-moves.json>` | seeds the camera layer's moves (branch `ishaan/camera-layer`) |

`scripts/reset.ts` re-seeds the library. **After a craft-graph reset, run `reference` again for each reference and
`camera-layer` too**, because those are not part of the catalogue yet.

## Kits (`packages/library/src/kits/`)

A kit is browser canvas code plus a `kit.json` that holds its palette, type, motion numbers and room. Every kit takes
a palette, so it can be re-skinned to any brand. Kits carry no brand words.

| Kit | Learned from | Look |
|---|---|---|
| `motion/` | shared engine | `core.js` (eases, springs, seeded noise, drift, shutter blur), `type.js` (word-by-word lines, slams), `footage.js` (plays fetched clips, deterministic by t), `sfx.js` (plays the engine sfx map, and only where the reference has no sound of its own) |
| `crimson-poster` | R1 | crimson paper posters, a hero ring, chapter cards that dive into the poster, metal keys and a hand |
| `level-ladder` | R2 | `world.js`, the shared speaker world (palette-driven `ROOM`, `ROOM.monitor`), neon level orbs, white-grid boards, paper posters |
| `golden-hand` | R3 | lit metal hook title (Cinzel), a stone hand holding a dial, Grenze Gotisch chapter heads, panels on a dark starry ground |
| `red-table` | R4 | stickers on a red paper table, boiling marker words, type cards in a selection box, a tall serif word with an eye for a dot, flipbook numbers, a plugin panel, condensed serif captions |

## References cloned so far

Each one is a live canvas clone. Its code is in git under `data/refs/<id>/clone-motion/` and its parts are in
`data/refs/<id>/parts.json`. The reference video, voice and frames are not ours, so they stay out of git. To fetch them,
run `scripts/ref-intake.ts <id> <reel url>` with the URL from the table below. Then serve the repo root (any static
server) and open `/data/refs/<id>/clone-motion/`.

| Ref | Reel | Kit | Blind-judge score |
|---|---|---|---|
| R1 | instagram.com/p/Ddtf1lUzljq | crimson-poster | 7.2 |
| R2 | instagram.com/p/DcbCMzoTwhS | level-ladder | 4.8 (below the bar; raise it when next touched) |
| R3 | instagram.com/p/Dd31rjBznGo | golden-hand | 7.6 (5.0 → 7.6 over six rounds) |
| R4 | instagram.com/p/DZsVuGdx2cE | red-table | 6.6, compared with R3's sheet at 6.4 by the same judge |

**The quality ratchet.** Every new clone must score above the best previous film. A blind subagent judge scores still
sheets on typography, composition, craft, fidelity and premium feel. The previous best film's sheet is scored in the
same round, because different judges calibrate differently. A tie does not ship. The process and the scoreboard live in
the `ishaan-motion` skill, which every video job uses. The skill is checked in at `.claude/skills/ishaan-motion/`
(see `references/ratchet.md` and `taste.md`), and it grows after every reference.

## Who reads it

- **Sound, every style.** The mixer casts each event's sfx with `assetsForEvent` (`engine/src/audio/sounds.ts`);
  map.json keeps only the rules (levels, gaps, follow-ups). Each film gets `sound.json`. FalkorDB down: map.json.
  Check a film: `pnpm --filter @moovi/engine sounds <film dir>` (compares with the map.json stem).
- **Inserts, Style 4 and Dark Vox.** On weak beats (improvised, or a low cast score) `assetsServing` (category `ui`,
  runtime `visual`) picks a 2D card, chart or icon badge; the player draws it with the visual renderer's own code
  (`styles/kit/borrow.ts`, `liblayer.ts`): an overlay where the beat leaves room, a rack-focus cutaway where it does
  not, never over the style's type, never a figure or praise the line does not say. Each insert is stored as
  `(Scene)-[:USES_ARTIFACT {slot: 'library'}]`. `MOOVI_LIBRARY_CAST=0` turns it off; `?nolib` plays a film without.
- **Auto.** `kitsServing` on the script's needs; a kit covering at least 3 and half of them dresses the inserts in its
  palette roles (`styles/kit/kits.ts`).

## Still open

- Library wiring, for the next pass: Anatomy and Clear Signal do not borrow inserts yet (only Style 4 and Dark Vox); icon
  badges read plain and the chips card is small inside a cutaway; Editorial frames rarely leave room for an overlay.
- The camera layer (`packages/library/src/camera`, 63 moves) is merged; its moves reach the graph via `camera-layer.ts`.
- The R2 clone is below the bar. The R1, R3 and R4 clones still use code stand-ins for the speaker and for photo
  props; real cut-outs would beat them.
