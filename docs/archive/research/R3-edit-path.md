# R3: the edit path today

Owner: Tab. Measured 2026-10-16, 13:07 to 13:35 IST. Status: done.

## Test set-up

- **Clip:** one real raw selfie take, `vignesh-raw-1.mp4`: 29.7 s, **474x850** H.264 30 fps, AAC, a noisy room. It opens
  with a slate ("Take one ... Start", about 9.8 s of pre-roll) and ends on the floor. About 60 English words after the slate.
- **Box:** 4 CPU, 8 GB, software GL (SwiftShader), no GPU, ffmpeg 7 without `drawtext`. The box was shared during the
  runs (an upload job and a Next.js build ran beside them), so the times are an upper bound for this hardware.
- **Models:** the engine's usual crew model from `.env.local`; speech by OpenAI `whisper-1` and `gpt-4o-transcribe`.
  Groq speech is not usable on this box (its account rejects calls), so `stt.ts` used OpenAI.
- **No product code changed.** Path (a) ran on `vignesh/router-r2` (c7bca9f) with `MOOVI_SLOTS_LLM=4` and
  `MOOVI_VOICE_CONCURRENCY=4`: those are main's defaults, and the upload path in `chat.ts`, `tasks/*` and
  `packages/skills` is identical on both (`git diff c7bca9f origin/main` touches only the combined/Auto job and
  footage-edit files). The only harness piece was a preload outside the repo that sends `api.openai.com` calls through
  this box's proxy.

## Path (a): main, an uploaded video through the studio

### The trace

1. **Upload:** `apps/studio/.../chats/[cid]/uploads/route.ts` streams the body to `projects/<p>/uploads/<id>.mp4`
   (1 GB cap), hashes it, records `P.addUpload` in the project graph.
2. **Message:** `.../messages/route.ts`, first message with `uploads` -> `sendCommand({ type: 'brief', uploads })`.
3. **Engine:** `chat.ts handleCommand`: `routeCombined` (`router/job.ts`) returns false whenever uploads exist, so the
   combined film is never used for footage; with no style picked it starts the crew run (`intake`, `match`).
4. **intake** (`tasks/intake.ts`): probe, `cutRate` (ffmpeg scene detect), `faceRatio`, `speechRate` (whisper on the
   first 45 s), then `features()` from `@moovi/skills`: the verb "edit" in the brief sets `footage: 'edit'`.
5. **match:** e1 (the premium reel edit) is `autonomous: false`, so every edit becomes the `unique` style with
   nearest `e1`, and the unique playbook is spawned (`packages/skills/src/unique/index.ts`).
6. **Unique playbook for footage:** plan, transcribe, card, script (splits the transcript into beats), board, asset
   (fan-out), build (one Shot Builder agent loop per scene), assemble, render (chunks), sound, mux, review (Lens, can
   send scenes back), deliver, keep. The director's "edit this footage" flag is one prompt line in `director.ts:47`
   ("set footage.mode and captions").

### Measured, one run (brief "Edit this footage into a reel with captions and b-roll", 9:16)

| Stage | Seconds | What it did on this clip |
|---|---|---|
| upload + message | not timed over HTTP | `scripts/run.ts` does the same file copy and `addUpload`; estimated under 1 s for 7 MB |
| intake | **61.4** | see the split below; the three measured calls add up to about 1.8 s, the other ~59 s are not in them (not yet profiled) |
| match | 0.0 | `unique`, nearest `e1` |
| transcribe | 1.1 | `whisper-1` on the whole clip: **6 words, in Urdu script** ("ہم بھی اپنا ایڈٹ کریں گے") |
| plan | 15.7 | "YOUR FOOTAGE, CUT TO HIT" |
| script | 7.5 | **2 beats**, hook in Urdu, built from the 6 wrong words |
| card | 19.5 | "Grease Pencil Proof" |
| board | 22.8 | 2 shots, 5 assets |
| asset x5 (parallel) | 1.5 / 4.1 / 6.0 / 25.7 / **97.3** | 1 stock clip used, 3 "drawn instead" |
| build x2 (parallel) | **220.2** / **748.4** | 16 and 11 agent turns |
| assemble | 81.8 | 30.7 s, 0 QA issues |
| sound | 2.9 | -14.1 LUFS, peak -1.9 dB |
| render x3 chunks | 9.5 / 12.9 / **134.7** | 31, 42 and 439 ms a frame |
| mux | 1.1 | 30.7 s, 41.7 MB |
| **first muxed film** | **1183 s (19.7 min)** | from the brief |
| review (Lens) | 35.1 | 4/10, sent both scenes back (missing-glyph box in the Urdu title) |
| rebuild round 2 | did not finish | the run was stopped by my 25 min limit at 1500 s |

**Intake split (Claude 1's 13:26 ask), each measured alone on the same clip:**

| Piece | Seconds | Note |
|---|---|---|
| probe (ffprobe) | 0.09 | |
| cut detection (`cutRate`, ffmpeg scene > 0.35, whole clip decoded) | 0.75 | 0 cuts found (raw take) |
| face detection (`faceRatio`) | 0.00 | **a stub: returns -1**, "face detection is not bundled" (`bench.ts:68`) |
| transcribe (`whisper-1`, first 45 s, word times) | 0.94 | same 6 Urdu words |

**What came out (contact sheet, 1 fps):** the raw take plays almost uncut for 26 s, slate and walk-up included, then
one stock insert and the floor at the end. No dead air removed, no punch-ins, no captions except one broken caption
chip with a missing-glyph box. `card.footage.punch` and `card.footage.insertEvery` are set by the director but **no
code on main reads them** (`git grep` finds no reader). The user's clip is visible in every frame until the insert, so
the two 05:10 renderer bugs (W2) do not show on this path: they live in the visual renderer, which is off unless
`MOOVI_RENDERER=visual`.

## Path (b): footage-edit mode (`vignesh/router-r2`, c7bca9f, not merged)

`router/footage-edit.ts` (1006 lines), `router/kinetic.ts`, `router/wall.ts`, CLI `scripts/footage-edit.ts`. One
function, no agent loops, one model call (the card planner). Run: hint names "Moovi, AI video editor, After Effects,
social media", face label "THE BUILDER", kinetic captions.

### The trace and the measured seconds (`report.json`)

| Stage | Seconds | What it does |
|---|---|---|
| setup | about 0.7 (derived: total minus the timed stages) | probe, audio to 16 kHz mp3, loudness envelope, pauses, split into ~10 s pieces |
| **hear** | **1.9** | `whisper-1` per piece for word times, `gpt-4o-transcribe` on the whole clip 3 times for the words, best answer by word timing agreement, hint names matched by sound ("Moviez" to Moovi); a second round (`hear2`) only when agreement is low (not needed today) |
| cut (pure code) | under 0.1 | take window after the slate cue, fillers and pauses cut to a breath, 6 pieces, 29.7 s to 16.2 s, alternate zoom 1.0 / 1.12 |
| prep, all in parallel (started after hear): | longest **23.5** | |
| . cards | 23.5 | one model call plans 3 cards, clips fetched from Mixkit and others (network bound) |
| . behind (person mask) | 16.6 | U2-Net-p ONNX per frame for a 1.7 s window, word drawn behind the head |
| . captions | 13.3 | kinetic words drawn in the browser to PNG frames, 3 pages |
| . stock (wall of videos) | 12.1 | 12 s cap per source |
| . end card | 6.0 | |
| . face label (YuNet face detect + tag) | 4.2 | per frame on one cut |
| . light leak | 4.1 | |
| cuts (4 at once) | 8.9 | each shot rendered with its move: whip, zoom-through, orbit, 3D wall, frame break, phone pull-back |
| final pass | 9.3 | one ffmpeg graph: overlays, masks, captions, voice clean-up, music bed, loudnorm |
| **total** | **44.3** | 17.8 s, 1080x1920, 13.6 MB, -14.0 LUFS, true peak -2.5 dB, no silence inside |

The same command took **36.6 s** on an earlier run today (prep 16.4, cuts 8.8, final 8.8); today the cards stage
(network) was the long pole while the box was busy. Either way it is **27 to 32 times faster** than path (a) and the
words are right.

## Where the 2 minutes go (measured floor per piece, this clip)

| Piece | Floor | Source |
|---|---|---|
| probe + cut detect | 0.8 s | measured alone |
| face detect | 0 s on main (none), ~4 s on (b) for one window | measured |
| transcribe, reliable | 1.9 s | (b) hear; main's 0.9 s answer is wrong on this clip |
| decide the edit (take, cuts, shot plan) | under 0.1 s code + one model call (~5 to 20 s) | (b) |
| assets (masks, captions, stock, cards) | 13 to 24 s, in parallel | (b) |
| render cuts + final pass | ~18 s for 17.8 s out | (b) |

A 30 s edit with (b)'s engine fits in about 45 s here; a 60 s source is about twice that, still under 2 minutes.
The crew path cannot meet the bar: two Shot Builder loops alone took 220 and 748 s.

## What is missing for a pro edit (judged against ref2)

Ref2 is a 44.9 s creator intro reel (Zache Seno, instagram.com/p/DehkOI3qX6d), which is also Ishaan's **E1** in `R4-references.md`. Measured: 18 hard scene changes at scene score 0.3
(median gap 2.0 s), plus a graphic event inside almost every second (cards, UI, maps, text flying in), several
locations and outfits, two-tier captions (small white connector over a big yellow key word, words behind the head),
full-frame b-roll and UI mock-ups tied to the words, a warm consistent grade, -14.2 LUFS with no gap under -35 dB.
Ours (b): 4 hard changes at 0.3 in 17.8 s (13 at 0.15), one location. Ours (a): 0.

| Area | Path (a) main | Path (b) footage-edit | Missing for ref2 level |
|---|---|---|---|
| Transcript | **broken**: 6 Urdu words for about 60 English | right every word, no hand fixes | language lock and the (b) method on main; a confidence gate before planning |
| Cuts | none: slate, pauses and floor kept | take window, pauses, fillers; 6 pieces | a cut every 1 to 2 s on beats, multi-take selection, J and L cuts, head locked across cuts |
| Punch-in zooms | none (card fields unread) | alternate 1.0 / 1.12, inner beats on long cuts | eased punch on key words, face-centred reframe path, zoom grammar per style |
| Captions | one broken chip | kinetic words, key word big, behind-head once | caption styles as data (R8), active-word highlight, safe zones that dodge faces and UI |
| B-roll | one stock insert at the end | 3 corner cards, wall of videos, phone pull-back | full-frame b-roll and UI mock-ups per noun or claim, maps and pins, own-footage callbacks |
| SFX | sfx stem from builder events | **none** in code | whoosh on every move, hit on key words, risers into reveals, a sfx map per style |
| Music | bundled bed | same bed looped low | 50+ beds, beat grid, cuts on the beat, ducking under voice, energy curve |
| Colour | none | light eq gamma | per-style grade (LUT), skin-safe, consistent across shots; denoise and sharpen for low-res phone clips (474x850 here) |
| Speed | 19.7 min to the first file | 36.6 to 44.3 s | a live preview (source video plus an overlay layer) in seconds |
| Styles | one generated card per run | one hard-coded style | 5 to 6 deterministic styles over one edit description |

**Top 5 gaps, in order:**
1. The main path's transcript is wrong on a normal noisy selfie (6 Urdu words), and everything after it is planned
   on it. (b)'s hear stage fixes this in 1.9 s.
2. The main path makes no cut at all, and its punch and insert settings are read by no code.
3. Shot rhythm: ref2 changes picture about every 2 s with a graphic event inside each second; (b) is half that,
   and there is only one take and one location.
4. No sound design on (b): no sfx and a single looped bed with no beat sync. Ref2 has no gap under -35 dB anywhere, so something runs under the whole voice (a bed or room tone; not judged by ear).
5. Speed on main: 19.7 min to a first file, driven by agent loops (Shot Builder 220 s and 748 s, Lens round trips).
   (b) is under 45 s.

## Recommendation

**Build the EDL first, by extracting it from footage-edit, not from scratch, and not on the crew path.**

- The crew path cannot be the base: 1183 s to a first file against a 120 s bar, a broken transcript, no cuts.
- footage-edit has the parts that already work and are fast: hear (1.9 s, right words), the take window and pause
  cuts (pure code, under 0.1 s), the card planner (one model call), the person mask, face tracking, kinetic captions.
  But it is one 1006-line function where the decisions and the ffmpeg graph are mixed, so it is one hard-coded style.
- So: split footage-edit into (1) **`edl.ts`**: clip + words + cuts + faces in, an edit decision list out (keep
  ranges, cuts, zoom keys, reframe path, b-roll slots, caption events, sfx hits, music, grade), pure data, about 3 to
  20 s including the one model call; (2) **renderers of the EDL**: the existing ffmpeg final pass (about 18 s for a
  30 s source here) and a browser preview over the source video (no encode, seconds); (3) **styles as laws over the
  EDL** (R4), each a set of rules and a library cast.
- Measured basis: in (b) the decisions cost under 0.1 s of code; the time is in assets (13 to 24 s, parallel) and the
  encode (18 s). An EDL in the middle costs nothing and lets 5 to 6 styles and "edit by words" share one engine.
- Day 1 order suggestion: (1) move (b)'s hear into main's `transcribe` and `intake` (the floor), (2) `edl.ts` with
  the take, cut and zoom rules and a JSON schema, (3) the ffmpeg renderer reading it, (4) the preview player.

## Reproduce

- (a): from `packages/engine`, `tsx --env-file-if-exists=../../.env.local scripts/run.ts "Edit this footage into a
  reel with captions and b-roll" --upload <clip> --ratio 9:16` (needs FalkorDB and a speech key).
- (b): from `packages/engine` on `vignesh/router-r2`, `tsx --env-file-if-exists=../../.env.local
  scripts/footage-edit.ts <clip> <out.mp4> <workdir> "Moovi, AI video editor, After Effects, social media" "" kinetic
  "THE BUILDER"` with `OPENAI_API_KEY` (and `MOOVI_OPENAI_BASE` for a proxy) and `MOOVI_VISION_PY`. Stage times are in
  `<workdir>/report.json`.
