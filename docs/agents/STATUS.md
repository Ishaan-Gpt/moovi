# Status (product manager's view)

Owner: Claude 1, now acting as product manager (Ishaan, 18:25 IST: "your only task is to communicate with Vignesh's
Claude and Tab, see what is going on in my repo, in my sessions and in his, be the main product manager, and see
everything is at par with our plan"). Claude 1 builds nothing from now on. Updated: **2026-10-16 18:34 IST** (decisions); first written **2026-10-16 18:31 IST**.

> **@Tab @Vignesh, from Ishaan via Claude 1 (2026-10-16 21:06 IST):** from now on, **new styles go to a `vignesh/<style>` branch and are
> posted here for review before main** (clip-moment's next versions included); Ishaan's yes, relayed by Claude 1, merges
> them. **Edit-engine fixes still go straight to main.** The rule is in README.md under Code. Tab: please confirm in
> TAB.md, and pass it to Vignesh.

> **Deploy hold (2026-10-16 22:39 IST):** clip-moment's music picker defaults to scope 'creator', which allows NCS tracks in product
> runs. NCS terms forbid bundling in a product. No deploy until the product path passes scope 'product' (asked of Tab).

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
| D1.6 benchmark script | Tab | **done** | 0f184b4: R9 quick tier, table in docs/SPEED.md; found and fixed 2 hearing bugs |
| D1.7 studio route | (was Claude 1) | **done, live** | |
| D1.8 MP4 from the EDL | Tab | **done** | d4239fd: deterministic (framemd5 equal), same geometry as the player |

**Day 1: 9 of 9 done (2026-10-16 20:38 IST).** Gate, measured by D1.6 on R9's quick tier:

| Clip | Preview ready | MP4 | Quality |
|---|---|---|---|
| B1 Vignesh's selfie, 29.7 s | 4.75 s | 17.2 s | **pass** |
| B2 two-person selfie, 34.1 s | 3.78 s | 34.3 s | **pass** since e86baf7 (2026-10-16 21:22 IST): holes 0, captions 99.3% off the face |
| B4 Hindi, 101.1 s | 26.92 s | 54.3 s | fail: words right 72.9% (gate 80%); holes now 0 |

**Speed passes on all three** (preview under 60 s, MP4 under 120 s, -14 LUFS). **Quality passes on 2 of 3** (was 1 before e86baf7). Vignesh
confirmed at 20:04 that D1.6 and D1.8 came before new styles; clip-moment carries on after. **Deployed 2026-10-16 20:51 IST: the server runs c4f7658** (Day 1 + e806e4d: library casting in edits, Node face detection, no black first frames). Checked before: typecheck clean; edit, face and render tests 50 pass, 0 fail. After: worker up, 960 Assets, 0 brand references, the YuNet model reachable from the worker (downloaded at run time, MIT). **Disk: 15 GB free** after clearing 8.1 GB of build cache (Ishaan, 2026-10-16 20:56 IST); clear it again every few deploys.

**Rule problem:** face detection (`edit/look.ts`) runs YuNet through `python3` + OpenCV, against the root rule "no dependency on Python". On the server it most likely finds no faces and falls back to fit + blur. Fix: run face detection without Python (ONNX in Node, or in the browser as Afterglow does with MediaPipe).

## What else is being built (not in Day 1)

| Work | Who | Where | On main? | Used by an edit? |
|---|---|---|---|---|
| Library in FalkorDB: ~947 assets with camera moves and references, 99 caption looks | Ishaan's library session | main | yes (7ed6b23, 2026-10-16 19:28 IST) | **ready**: all 8 of Tab's points done (ids with rev/sha256, licence codes, a transition per cut type, SUITS on R4's six styles, typed params). The edit path still has to call it (Tab's lane) |
| Camera layer: 63 moves, `toEdlZoom` | Ishaan's camera session | PR #1 | yes | **no**: nothing in `src/edit` calls it |
| Reference clones (R1–R4 = E3, …) with the ishaan-motion canvas engine | Ishaan's clone sessions | data/ (not in git) + b348efc | code yes, R1 A/B clone no | **no**: standalone canvas pages, their own timing tables |
| Generation styles and Auto cast sfx from the library | Ishaan's library-wire session | ishaan/library-wire, 1 local commit + 16 open files | no | n/a: **generation, which the plan put out of scope for these two days**; it touches `router/job.ts` (shared with Vignesh's combined film) |
| CaptionsEasy npm (99 caption looks) | Ishaan's CaptionsEasy session | separate repo | n/a | no; an option for Moovi's captions |
| Live server | | 65-2-223-240.sslip.io | runs **c4f7658** (2026-10-16 20:51 IST), Day 1 + library casting + faces (2026-10-16 19:16 IST) | up to date with main |

| **clip-moment** (Buckology Shorts look: stock clips, stat cards, 3D) | Tab, at Vignesh's ask (18:26–19:10) | main f1aad34 | yes | n/a: **a new generation style**, out of scope in PLAN.md; D1.6 and D1.8 still not started (2026-10-16 19:51 IST) |

## Day 2 to track (owners per PLAN.md after Ishaan's decisions)

| # | Task | Owner |
|---|---|---|
| D2.1 + D2.2 | the six R4 styles as laws over the EDL | Tab |
| D2.4 | library in the edit path (camera, sfx, transitions per beat, captionseasy draw) | Tab · **done** e806e4d (2026-10-16 20:42 IST): B1 cast 10 moves, 5 sfx, 1 transition in 75 ms; player and MP4 draw them |
| — | face detection in Node (rule fix) | Tab · **done** e806e4d, **live** |
| — | the silence-hole fix B2/B4 fail on | Tab · **done** e86baf7 (not deployed) |
| D2.5 | inserts from the gen styles | Tab |
| D2.6 | sound pass | Tab |
| D2.8 | edit by words | Tab |
| D2.9 | ship: before/after reel per style, SPEED.md, README | both sides |

Tab carries almost all of Day 2 alone. **That's the risk to watch.**

**2026-10-16 20:56 IST:** Tab's last two code pushes since Day 1 closed were clip-moment (v3, at Vignesh's 20:14 asks; next: Mixkit
music for it). **Not started yet:** the silence-hole fix (B2, B4 fail), hand word times, and D2.1/D2.2 (the six edit
styles). Server disk: build cache cleared, 15 GB free.

## Two tracks (Ishaan, 2026-10-16 21:13 IST: keep both)

- **Edit your clip** (`src/edit`, Tab): what the studio runs on an upload. Base style only; the library gives it camera
  moves, sfx and transitions, no inserts or b-roll yet. Tab still builds the six R4 styles here (D2.1/D2.2).
- **Reference clones and kits** (`packages/library/src/kits`, `data/refs`, Ishaan's library session): R1–R5 rebuilt as
  live canvas clones with real b-roll, inserts and sfx, blind-judge scores 4.8–7.6 (R3 golden-hand best). The kits are
  used by the generation styles (Auto, Style 4, Dark Vox) but **not by the edit path**: nothing under `src/edit` loads a
  kit. Ishaan chose to keep the two tracks separate for now.

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
