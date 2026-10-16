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
| D1.2 hear: right language, vocabulary, punctuation | Tab | **done** | 70ec3ee: Moovi and Ishaan right, language lock, sentences back |
| D1.2b voice clean-up without Python | Tab | **done** | 289fbc4: ffmpeg only, 1.8–2.8 s, -14 LUFS, speech over room 11 → 28 dB |
| D1.3 EDL builder from footage-edit | Tab | **done** | 70ec3ee: plan in 2.3–2.7 s, slate and pauses cut, cuts 100% on words, face crop. Test 1 v2: **4/10** (was 3/10) |
| D1.4 preview player | (was Claude 1) | **done, live** | on the server since 9473f58 |
| D1.5 captions (11 of 52) | (was Claude 1) | **done, live** | |
| D1.6 benchmark script | Tab | **not started** | R9 has the clip set and the score |
| D1.7 studio route | (was Claude 1) | **done, live** | |
| D1.8 MP4 from the EDL | Tab | next | target 20:30 IST |

**7 of 9 done (2026-10-16 18:55 IST).** Left: **D1.6** (the bench, which the gate needs) and **D1.8** (MP4). **Deployed 2026-10-16 19:16 IST: the server runs fb96cd6** (the builder, hearing, voice clean-up, library-wire). Checked before: typecheck clean, studio build passes, engine suite 212/221 pass with 1 load-timing failure (`voice-clean.test.ts`, passes alone in 5.3 s). After: worker up, seed loaded 628 Assets. **On the server there's no python3**, so face detection finds nothing and every edit uses fit + blur until look.ts moves to Node.

**Rule problem:** face detection (`edit/look.ts`) runs YuNet through `python3` + OpenCV, against the root rule "no dependency on Python". On the server it most likely finds no faces and falls back to fit + blur. Fix: run face detection without Python (ONNX in Node, or in the browser as Afterglow does with MediaPipe).

## What else is being built (not in Day 1)

| Work | Who | Where | On main? | Used by an edit? |
|---|---|---|---|---|
| Library in FalkorDB: ~947 assets with camera moves and references, 99 caption looks | Ishaan's library session | main | yes (7ed6b23, 2026-10-16 19:28 IST) | **ready**: all 8 of Tab's points done (ids with rev/sha256, licence codes, a transition per cut type, SUITS on R4's six styles, typed params). The edit path still has to call it (Tab's lane) |
| Camera layer: 63 moves, `toEdlZoom` | Ishaan's camera session | PR #1 | yes | **no**: nothing in `src/edit` calls it |
| Reference clones (R1–R4 = E3, …) with the ishaan-motion canvas engine | Ishaan's clone sessions | data/ (not in git) + b348efc | code yes, R1 A/B clone no | **no**: standalone canvas pages, their own timing tables |
| Generation styles and Auto cast sfx from the library | Ishaan's library-wire session | ishaan/library-wire, 1 local commit + 16 open files | no | n/a: **generation, which the plan put out of scope for these two days**; it touches `router/job.ts` (shared with Vignesh's combined film) |
| CaptionsEasy npm (99 caption looks) | Ishaan's CaptionsEasy session | separate repo | n/a | no; an option for Moovi's captions |
| Live server | | 65-2-223-240.sslip.io | next deploy: **once, after D1.6 and D1.8** (Ishaan), with the full library · runs **fb96cd6** (2026-10-16 19:16 IST) | up to date with main |

| **clip-moment** (Buckology Shorts look: stock clips, stat cards, 3D) | Tab, at Vignesh's ask (18:26–19:10) | main f1aad34 | yes | n/a: **a new generation style**, out of scope in PLAN.md; D1.6 and D1.8 still not started (2026-10-16 19:51 IST) |

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
