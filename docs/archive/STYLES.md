# Styles, not templates

A **template** is one fixed sequence: the same script shape, the same set-ups in the same order, only the words
change. Two films from a template look like the same film.

A **style** is a visual language. Its laws never change: world, palette, type, motion grammar, sound and rhythm.
What a film shows is cast, beat by beat, from a large library written in that language. When the library has
nothing that serves a beat, the style improvises a new set-up in its own grammar, and a good improvisation joins
the library. Two films in one style are recognisably the same hand, but never the same film.

Style 1 already worked this way. It has about 99 owner-made scenes from 12+ real films, plus freeform. Clear
Signal, Dark Vox, Anatomy and Editorial were each copied from **one** reference reel, so each was really a template.
The style kit (`packages/engine/src/styles/kit/`) is the contract that turns each of them into a style.

## The contract

| Layer | File | What it does |
|---|---|---|
| Needs | `kit/needs.ts` | What a line needs on screen, in about 60 words shared by every style (`time`, `compare`, `list`, `number`, `people`, `flow`, …). A regex detector works with no model at all; a model's tags are merged on top. |
| Arcs | `kit/arcs.ts` | 17 script shapes (pain-turn, myth-truth, how-it-works, one-number, before-after, question-answer, three-things, day-in-life, contrarian, origin, inside-machine, versus, customer-voice, fable, stakes-ladder, zoom-out, checklist). Each style allows the ones that suit its voice. The site's signals and the style's recent films pick one. |
| Brief | `kit/script.ts` | One call, the same for every model. The arc becomes numbered slots, and the **script doctor** then fixes weak-model mistakes deterministically. |
| Library | `kit/library.ts` | The style's set-ups. Each is tagged with needs, family, roles, items, number, seconds and words. `cast()` picks per beat: needs and slot fit, minus repeats in this film and in the style's recent films, plus a per-film jitter. Any score below the floor means improvise. |
| Memory | FalkorDB `styles` graph | Every film is a node linked to the set-up on each beat (`CAST {i}`), its arc and its site. Kept improvisations are `Setup {generated: true}` nodes, and set-ups cast back to back are linked `NEXT_TO`. A run loads this before casting and writes its film back after. PageRank over `NEXT_TO` gives the style's most-used set-ups a rest, and a site seen again gets a different arc. FalkorDB down = the run stops loudly. |
| Improvise | `kit/compose.ts` | A new set-up from the style's own vocabulary: a layout plus elements, all enums, each landing on a spoken word. The model never gives coordinates or colours. `sketch()` composes one with no model. `grow()` keeps it. |

## What each style provides

1. **Laws**: its tokens (`packages/library/src/<style>/`). These are unchanged and invariant.
2. **Library**: at least 40 set-ups, each with a renderer in the style's player, tagged by needs. Variants (layout,
   motion, framing) count when they read as different pictures.
3. **Arcs it allows**: at least 6, plus its voice rules (tone, words per line, banned moves).
4. **Vocabulary for improvising**: layouts, element kinds, shapes, motions, tones and icons, and a composer in the
   player that draws any spec in the style's world.
5. **Planner**: beats → `BeatIn[]` (needs = detector ∪ model tags, items, number, role) → `cast()` → improvise the
   nulls → film. Then `remember()` stores the set-ups and the arc, so the next film is cast away from this one.

## Any model

The model does what every model does well: it extracts facts, fills numbered slots, picks from short lists and tags
needs. The engine does the rest deterministically: the script doctor, casting, layout, timing and checks. A weak
model can make a film a little less sharp, but it cannot break one. Every model call has a deterministic fallback.
