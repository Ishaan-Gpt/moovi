# R4b: the generation styles as material for edits

Owner: Claude 1 · 2026-10-16. Ishaan: the 5 generation styles can feed edits (images, drawn assets, UI components,
motion graphics). This maps what each one already has to what the edit styles in `R4-references.md` need. It's a
first pass from the docs and the R5 counts; **nothing was rendered as an overlay yet.** That's the open question at
the end.

## The idea

In an edit, the user's footage is the base. Every **insert** (a full-frame cut-in, a top panel, a card beside the
head, a word behind the head) is a small scene. We already have five styles full of designed scenes cast by needs
(`styles/kit/needs.ts`: `time`, `compare`, `list`, `number`, `people`, `flow`…). The edit's deciding agent tags each
line's need, as generation already does, then casts a set-up from the style that matches the edit style. **The same
`cast()`, the same memory, a different frame: a panel or an insert instead of the whole film.**

## What each generation style gives an edit

| Gen style | What it has (R5 / CLAUDE.md) | Best edit use | Feeds edit style |
|---|---|---|---|
| **Style 1** (`s1`) | ~99 owner-made scenes; drawn props: phone, lock-phone, laptop, NLE, caption UI, reel UI, chat, notification, receipt, crowd; 16 transitions | **UI inserts** (a phone or app screen on the noun said), checklist, notification stack, chart grow | Night Desk A (top panel), Atlas (phone mockups) |
| **Editorial** (`s4`) | 258 library-first pictures; serif editorial type | **Poster inserts** and title cards ("NEVER FORGET", "TODAY"), headline wall, cover story | Night Desk B (crimson posters), Handmade (white editorial cards) |
| **Clear Signal** (`s5`) | clean product explainer set-ups | **Explainer panels**: steps, compare, before/after, numbers | Night Desk A |
| **Dark Vox** | 53 set-ups on a paper-theatre stage, cut-paper props | **Paper cut, doodle boil**, cut-out stickers on a flat stage | Handmade |
| **Anatomy** | isometric technical figures | **Node graphs and "how it works" diagrams** (the glowing node panels in E4) | Night Desk A |
| **Visual renderer** (Vignesh) | 56 artifacts, 10 layouts, three.js objects, footage panels, kinetic captions | **3D objects, depth, orbit, couch/UI wall**, and the compositor for the MP4 overlay | all; it's the overlay runtime |
| **Maps / 3D looks** (Vignesh) | MapLibre, globe, 3D posters | **Map cards and pins** (E1's "Dubai" card on the parchment map) | Atlas |

## What's needed for this to work

1. **An insert frame.** Each player must draw one set-up into a given box (full frame, top half, a card), at a given
   palette, for a given number of seconds, transparent where the edit shows through. The live players draw whole
   films today.
2. **Palette per edit style.** Night Desk wants charcoal and crimson, Handmade wants red and white. Gen styles carry
   their own tokens; an insert takes the edit style's palette (the same role idea as R8).
3. **One cast across libraries.** The edit's planner asks for `need: list, frame: top-panel, style: night-desk`, and
   FalkorDB answers with set-ups from every library that serves it (R7's `Asset` with `SERVES` edges, plus a `frame`
   field). This is where the graph earns its place.
4. **Speed.** An insert is 2–4 s of a set-up the players already render live, so it adds little to the 2-minute budget
   in the preview. The MP4 needs it as frames. Tab's R10 (live preview) should measure one.

## Question for Tab (R10)

Can the live players (`styles/serve.ts`) render a single set-up into a box with a transparent background, over a
playing `<video>`, at 30 fps? If yes, inserts are almost free in the preview. If not, which player is closest?
