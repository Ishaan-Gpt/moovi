# Status (product manager's view)

Owner: Claude 1, now acting as product manager (Ishaan, 18:25 IST: "your only task is to communicate with Vignesh's
Claude and Tab, see what is going on in my repo, in my sessions and in his, be the main product manager, and see
everything is at par with our plan"). Claude 1 builds nothing from now on. Updated: **2026-10-16 18:34 IST** (decisions); first written **2026-10-16 18:31 IST**.

## Day 1 against the plan

Day 1 gate (PLAN.md): **upload a clip in the studio and watch an edit in under 60 s, with cuts, punch-ins, captions and
one style, measured on the R9 clips.**

| Task | Owner | State | Note |
|---|---|---|---|
| D1.1 EDL schema | Tab | **done** | 347fb08, approved; d00ede8 adds fit, grid, linear, blur |
| D1.2 hear: right language, vocabulary, punctuation | Tab | **not started** | Test 1: "Moovi" heard as "Movie"; no sentence ends |
| D1.2b voice clean-up without Python | Tab | **not started** | |
| D1.3 EDL builder from footage-edit | Tab | **not started** | **The critical path.** Every edit runs on the stand-in plan until it lands (Test 1: 3/10) |
| D1.4 preview player | (was Claude 1) | **done, live** | on the server since 9473f58 |
| D1.5 captions (11 of 52) | (was Claude 1) | **done, live** | |
| D1.6 benchmark script | Tab | **not started** | R9 has the clip set and the score |
| D1.7 studio route | (was Claude 1) | **done, live** | |
| D1.8 MP4 from the EDL | Tab | **not started** | |

**4 of 9 done; 0 of the 4 critical-path tasks (D1.2, D1.3, D1.6, D1.8) started.** The gate is at risk tonight.

## What else is being built (not in Day 1)

| Work | Who | Where | On main? | Used by an edit? |
|---|---|---|---|---|
| Library in FalkorDB: 755 assets, references r1–r4 broken into kits | Ishaan's library session | ishaan/library | yes (d7f8ab3) | **no**: ids, licences and events don't match the EDL yet (Tab's 8 review points: 0 fully done) |
| Camera layer: 63 moves, `toEdlZoom` | Ishaan's camera session | PR #1 | yes | **no**: nothing in `src/edit` calls it |
| Reference clones (R1–R4 = E3, …) with the ishaan-motion canvas engine | Ishaan's clone sessions | data/ (not in git) + b348efc | code yes, R1 A/B clone no | **no**: standalone canvas pages, their own timing tables |
| Generation styles and Auto cast sfx from the library | Ishaan's library-wire session | ishaan/library-wire, 1 local commit + 16 open files | no | n/a: **generation, which the plan put out of scope for these two days**; it touches `router/job.ts` (shared with Vignesh's combined film) |
| CaptionsEasy npm (99 caption looks) | Ishaan's CaptionsEasy session | separate repo | n/a | no; an option for Moovi's captions |
| Live server | | 65-2-223-240.sslip.io | runs **9473f58** | main is ahead (fit/blur, zero-length words, library, camera) |

## The pattern

A lot is being built and very little of it reaches an edit. The library, the camera layer and the clone kits each
stop one wire short of the EDL. The edit itself still runs on a stand-in plan, because D1.3 hasn't started. The plan
works only if **everything flows through the EDL**: the builder (D1.3) writes it, the library answers its
`asset_ref`s, the camera layer writes its zoom keys, kits become inserts and overlays, and the player and the MP4
read it.

## Decisions (Ishaan, 2026-10-16 18:34 IST)

1. **Claude 1's build lane goes to Tab**: D2.2 (Atlas, Handmade, Studio Minimal), D2.5 (inserts from the gen styles),
   D2.8 (edit by words), plus wiring the camera layer (\`toEdlZoom\`) and the kits into the EDL. Tab now owns all of
   \`packages/engine/src/edit\`.
2. **The library session does Tab's 8 points before R5** (ids and revs, licence codes, a transition per cut type, SUITS
   on R4's six styles, EDL event names, typed params). \`paper-craft\` is renamed \`handmade\`.
3. **library-wire merges now** (Ishaan overrode the PM's park suggestion): rebased on main, full suite green, shared files
   named.
4. **Captions come from \`captionseasy\`** (99 looks) mapped onto the player's caption schema, instead of hand-building
   R8's remaining 41. Owner: Tab (part of the edit lane).
5. Open: one reference id map (the board's E/I ids win over the clone sessions' R1–R4).

## Asks of Tab (also in CLAUDE1.md)

- An ETA for D1.3, D1.2 and D1.8 tonight. D1.3 first.
