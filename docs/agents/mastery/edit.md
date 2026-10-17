# Edit mastery: the log (decision 15, 16)

Every kept change to the "Edit my video" type: what changed, where, the blind score before and after (same judge
round), and which reference it moves toward. Ishaan can veto any line; say "veto E-n" and it is reverted.

Clips: `docs/agents/ishaan-test/ishaan-test.mp4` (848x478 landscape WhatsApp clip, 19 s) and `ishaan-retakes` (the same
footage spliced with a false start and a repeated last line). References E1–E6 (R4-references.md). Made with
`packages/engine/scripts/edit-round1.ts make --out edit-r<n>` through planEdit, FalkorDB up; judged blind with
`judge --out edit-r<n> --with <previous round>` (the previous best and the references in the same round).

## Scores (blind judge, mean of Typography, Composition, Craft, Fidelity, Premium)

Each pair of columns is one judge round: the previous best re-scored beside the new outputs.

| Look | clip | r1 → r2 (round A) | r2 → r3 (round B) |
|---|---|---|---|
| Base | test | 5.5 → 5.8 | 5.1 → 5.1 |
| Base | retakes | 5.5 → 5.7 | 4.8 → 4.8 |
| Atlas | test | 5.9 → 5.9 | 5.3 → 5.4 |
| Atlas | retakes | 5.9 → 5.8 | 5.1 → 5.2 |
| Handmade | test | 5.1 → 5.4 | 5.1 → 5.2 |
| Handmade | retakes | 4.7 → 5.0 | 4.2 → 4.5 |
| Studio Minimal | test | 5.0 → 5.5 | 4.9 → 5.0 |
| Studio Minimal | retakes | 4.6 → 5.4 | 4.5 → 4.6 |
| Studio Cut | test | 6.0 → 6.0 | 5.7 → 5.7 |
| Studio Cut | retakes | 5.9 → 6.0 | 5.2 → 5.2 |
| Auto-pick (= Base) | test | 5.5 → 5.8 | 5.1 → 5.1 |
| Auto-pick (= Base) | retakes | 5.5 → 5.7 | 4.8 → 4.8 |
| References E1–E6 | | 8.9 – 9.1 | 7.9 – 8.6 |

Round B's judge was stricter overall (the references dropped too); only same-round pairs count.

## Kept changes

| # | Change | File | Before → after | Toward |
|---|---|---|---|---|
| E-1 | A landscape clip with a face is cropped full-frame on the face, every shot (punch-ins alternate); the blurred-fill fit only when no face is found (P1 A) | `edit/build.ts` | round A: Base 5.5 → 5.8, Studio Minimal 5.0 → 5.5, Handmade 5.1 → 5.4 | E4, E5, E6 (always a full-frame speaker) |
| E-2 | X1 16 "cover story" is no longer an auto move (only when asked by name) (P2 A) | `edit/moves.ts` AUTO_MOVE_ORDER | round A (with E-1): the clipped masthead and "MOOVI MOOVI MOOVI" tabs gone from every look | all |
| E-3 | Bug: the caption was drawn over a full-frame card (the logo-end line reset the insert layer's hide) | `edit/page.ts` draw() | round A | E5 (a card alone on screen) |
| E-4 | Bug: in Atlas, Handmade and Studio Minimal a library insert was drawn by the style's card with the whole 80-character line (a tall card of 15 words over the face, a red wall of text); now its headline, at most 5 words, sized to fit | `edit/page.ts` styleInsert | round A: Studio Minimal retakes 4.6 → 5.4, Handmade retakes 4.7 → 5.0 | E3, E6 |
| E-5 | A card's headline ends where a phrase ends ("Now MOOVI is an agentic" → "AGENTIC video editor"); "now" counts as padding | `edit/inserts.ts` headlineOf | round A | E5 |
| E-6 | Bug: a cut word overlapping a kept word's edge by a few ms was still captioned ("now now, Moovi is") | `edit/lib.ts` outWords | round B: Handmade retakes 4.2 → 4.5 | all |
| E-7 | Atlas sunburst only around a boxed (fit) shot, never across a full-frame face (P4 B) | `edit/styles.ts` | round B: Atlas 5.3 → 5.4, 5.1 → 5.2 | E1 |
| E-8 | Handmade term card and Studio Minimal hero card move clear of the face (lower third when a full-frame face leaves no room above) | `edit/page.ts` styleInsert | round B: Studio Minimal 4.9 → 5.0, 4.5 → 4.6 | E2, E4 |
| E-9 | The `soft` caption shadow gets a tight dark edge (white connector words read on a bright wall). Was `0 4px 22px rgba(0,0,0,.5)` | `edit/page.ts` SHADOW | round B (with E-6 to E-8) | E1, E4 |

Also confirmed: the takes bug from round 1 (a trailing "..." read as a full stop) is fixed on main; the retake clip now
keeps take 2 in every look.

## Open misses (what the judge still names)

- "locken" for "lock in" (the hearing), shown as the hero word: for the hearing, not taste.
- Base / Auto: one frame fully blurred mid-transition; single-word green chips read small and template-like.
- Studio Cut: a landscape clip stays a 16:9 film (a Studio Cut rule, b70cfd3); the judge marks every frame "not 9:16".
- Atlas: the "MOOVI" card sits on the hairline; an "IN" card half off the right edge.
- Handmade: the caption drops the name while the term card shows it ("hello guys, i am and"); stray dash and arrow doodles.
- The source itself (848x478, soft): Fidelity cannot pass about 5.5 on this clip, whatever the edit does.

## Ishaan's verdict, 2026-10-18 (binding for this session)

- The pipeline's edits scored 0/10 by Ishaan: no SFX on captions, no music bed, no continuity, abrupt cuts, no motion
  graphics, no clips, no camera moves, no effects, no polish.
- Board v2 (`edit-master-prompt.md` alone, no Moovi styles or templates) was better than the pipeline. Board v3 (the
  same prompt plus the ishaan-motion skill) was a little better again, still about 2/10 of the way.
- So the saved looks, templates, kits and rule tables are themselves weak. Do not use them blindly. Expect to scrap
  about 90% of them; keep only what earns its place against fresh, prompt-led designs.
- Method from here: design each edit from the prompt and the ishaan-motion laws, one storyboard image board per
  iteration (under 2 minutes), Ishaan's references as the taste. Boards and their source: `data/master-edit/`
  (git-ignored): `board.jpg` (v2), `board-v3.jpg` (v3), `src/board-v3.html`.

## 2026-10-18: Ref 1 is the starting point; the six looks are retired

- Ishaan: "don't refer to the previous 6 styles anymore, just ensure their good parts are in the skill". Their good
  parts are fundamentals now (ishaan-motion `edit-fundamentals.md` §8). The starting point of this style is reference 1
  (https://www.instagram.com/p/DbS2vcfyQxx/) with Premium Caption 1.
- v7 (playable): em1's devices in Moovi's brand, Premium Caption 1 with its typing tick, the pauses cut.
- Generality test: the same player, fed only a spec, edits the first 15 s of a two-person podcast Ishaan sent
  (360x640, through planEdit with FalkorDB up): name tags on the right speaker, the question card, letters on their
  words, the caption accent read from the footage. Player and spec: `docs/agents/mastery/edit-player/`.
