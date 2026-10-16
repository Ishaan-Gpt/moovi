# The library: every reusable piece in one FalkorDB graph

Generation styles, Auto and the editor all draw from one library stored in the craft graph. Each piece is one node, with
one implementation per runtime. The spec is `docs/agents/research/R7-library-node.md`, and the queries are in
`docs/QUERIES.md` (section `library`).

## The shape

```
(:Asset {id:'<category>:<slug>', category, name, about, runtime[], licence (code), licenceUrl, sourceUrl, author, title,
         credit, ship, attribution, redistributable, file, vendored, sha256, rev, retired, energy, tags[],
         params(JSON, typed per category), impl(JSON runtime→code ref), seed, src})
  -[:SERVES {w}]->(:Need)          what a beat needs: hook, number, list, compare, cta, calm…
  -[:FITS {gainDb, first}]->(:Event {aliases[]})  sfx: the edit event it sounds on; aliases are the EDL's names
  -[:SUITS {w, src}]->(:EditStyle) R4's six styles (atlas, night-desk, handmade, crimson-cutout, brand-promo,
                                   studio-minimal), w 0..1; src 'cast' (the style's list) or 'row' (the asset's own)
  -[:IS_A]->(:Transition)          a transition's family
  -[:FALLBACK {runtime}]->(:Asset) what to play where this one does not run (a caption look → its browser style)
(:Asset)-[:REPLACED_BY]->(:Asset)  ids never change once shipped; dropped assets are retired, never deleted
(:Reference {id, url, title})-[:HAS_PART {role, at, note}]->(:Asset)   a video reference broken into parts
(:Kit {palette, type, motion, frame, src})-[:HAS {role}]->(:Asset)     a look as one re-skinnable unit
(:Reference)-[:TAUGHT]->(:Kit)
```

Categories: voice, sfx, music, caption, transition, effect, camera, ui, 3d, insert, and (for the six edit styles)
grade, overlay, font, texture, end_card. On 2026-10-16 (evening) the graph held **about 950 assets**, among them
123 captions (the preview's 11 R8 styles, the 99 numbered looks, the kits' own), 39 transitions (one
`transition:cut-<type>` per EDL cut type), 7 grades, 11 overlays, 5 end cards, 31 fonts and 5 textures.

**Tab's R7 review, how each point landed** (code: `packages/graph/src/{library,licence}.ts`,
`packages/engine/src/library/{catalog,edit-styles,params,seed}.ts`, tests: `engine/test/library.test.ts`):

| # | Point | What the library does now |
|---|---|---|
| 1 | one id everywhere | every id is a valid EDL `asset_ref`; vendored files carry `sha256`, every node a `rev`; a dropped asset is `retired` (kept), a replacement links `REPLACED_BY`; `resolveAsset` follows it |
| 2 | licence and credit | `licence` is a code (`CC0-1.0`, `CC-BY-4.0`, `MIT`, `OFL-1.1`, `mixkit`, `unverified`, …); `ship`, `attribution`, `redistributable` derive from it; `licenceUrl`, `sourceUrl`, `author`, `title`, `credit`. The bed is CC-BY-4.0 (style-1's "copyrighted-local-only" bed is a different file, not in the library). Edge voices are `unverified`, so they don't ship |
| 3 | fetched clips | the footage hunter writes every accepted clip as `insert:clip-<provider>-<ref>` (`upsertClipAssets`), as `ref-footage` does for clones |
| 4 | new categories | grade (ffmpeg + CSS filter per style), overlay (the EDL's 11 kinds), font (R8's 19 OFL + 12), texture, end_card; effects carry `params.kind` (move, overlay, type); all 17 X1 moves are findable (`assetsByX1`), unbuilt ones as spec rows tagged `unbuilt` |
| 5 | transitions | each of the EDL's 13 cut types is `transition:cut-<type>` with `dur`, `needs_overlap` and a craft family (`transitionForCut` returns it and the family's other implementations) |
| 6 | vocabularies | SUITS on the six style ids with a weight (`styleCast`); `paper-craft` is now `handmade`; Event names are kept, the EDL's sfx events are aliases (`assetsForEvent` takes either) |
| 7 | typed params | sfx `dur`, `peak_ms`, `lufs` (measured: `scripts/library-measure.ts` → `assets/library-measure.json`); music `bpm`, `beats`, `dur`, `loop`, `end_button_at`, `mood`; transition `dur`, `needs_overlap`; caption R8's CaptionStyle; voice `lang`, `engine`; zod schemas in `params.ts`, checked by the test |
| 8 | runtimes, determinism | `browser` (the preview draws it), `ffmpeg` (the MP4 path), `edl` (a contract both read); `FALLBACK` edges; every list query orders by weight or rank, then id |

## Commands (FalkorDB must be running: `pnpm falkordb`)

| Command | What it does |
|---|---|
| `pnpm --filter @moovi/engine library` | seeds the whole catalogue (`packages/engine/src/library/catalog.ts`) and prints counts; `--counts` only counts |
| `pnpm --filter @moovi/engine reference ../../data/refs/<id>/parts.json` | adds a reference, its parts and its kit |
| `pnpm --filter @moovi/engine exec tsx scripts/ref-intake.ts <id> <url>` | one-command intake of a new video reference into `data/refs/<id>/`: download, cuts, contact sheets, 2 fps frames, voice, Whisper word stamps, transcript (about 30 s) |
| `pnpm --filter @moovi/engine exec tsx scripts/ref-footage.ts <id> name="query" …` | real footage for a clone: wherever the reference cuts to b-roll or a photo, the engine footage finder (Mixkit, Commons, Pixabay, Pexels, NASA, Archive) fetches a clip into `data/refs/<id>/footage/` with its licence and credit, and seeds it as an insert asset linked to the reference. A drawn stand-in there reads as a paused video |
| `pnpm --filter @moovi/engine exec tsx scripts/camera-layer.ts <camera-moves.json>` | seeds the camera layer's moves (branch `ishaan/camera-layer`) |

`scripts/reset.ts` re-seeds the library. **After a craft-graph reset, run `reference` again for each reference and
`camera-layer` too**, because those are not part of the catalogue yet. Each of these scripts ends by rebuilding the
cross-seed links (`seedCrossLinks`: event aliases, the six styles' cast, X1 tags).
After adding a sound, run `scripts/library-measure.ts` so its typed params are measured.

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

## Still open

- `ishaan/library-wire`: generation styles and Auto casting from the library. Another session is working on it; it
  is not merged.
- The camera layer (`packages/library/src/camera`, 63 moves) is merged; its moves reach the graph via `camera-layer.ts`.
- The R2 clone is below the bar. The R1, R3 and R4 clones still use code stand-ins for the speaker and for photo
  props; real cut-outs would beat them.
