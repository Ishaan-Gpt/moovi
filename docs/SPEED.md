# Speed: prompt to finished film

Measured on 2026-10-16 (IST night) on one Linux box: 4 CPUs, 8 GB, software GL (SwiftShader, no GPU), FalkorDB 4.x on localhost, models through an API proxy, Edge voices. The box was shared with other jobs (test suites, other renders), so absolute numbers carry some noise; the ratios hold.

Runs are `packages/engine/scripts/run.ts "<prompt>"` with the default crew. "MotionEasy" is the default renderer; "visual" is `MOOVI_RENDERER=visual` (docs/VISUAL.md).

## End to end

| Build | Renderer | Prompt | Prompt to first cut | Film length |
|---|---|---|---|---|
| main 318cd15 | MotionEasy | FalkorDB ad, 30 s | 1355 s | 40.5 s |
| agent-main 0df874e | MotionEasy | FalkorDB ad, 30 s | 1054 s | 45.7 s |
| agent-main 0df874e | MotionEasy | GPS explainer, 30 s | 1020 s | 28.6 s |
| agent-main 4425785 | visual | FalkorDB ad, 30 s | 203 s | 33.8 s |
| agent-main 4425785 | visual | GPS explainer, 30 s | 203 s | 30.2 s |
| agent-main 582ad86 | visual, with footage and one critic round | GPS explainer, 30 s | 368 s | 27.2 s |
| agent-main 87b2503 | visual, with footage and one critic round | Bangalore tech fest hype, 25 s | 381 s | 25.5 s |
| live studio (moovi-three.vercel.app) | Style 1 live preview | falkordb.com, Style 1 | 87.8 s to a live preview, no mp4 file | 22.4 s |

The two 368 s and 381 s visual runs overlapped full test suites on the same CPUs and include a critic round that re-renders the weakest scenes; the 203 s runs had the box mostly to themselves.

## Per stage (seconds)

| Stage | main, FalkorDB | agent-main MotionEasy, FalkorDB | agent-main MotionEasy, GPS | agent-main visual, FalkorDB | agent-main visual, GPS | live Style 1 |
|---|---|---|---|---|---|---|
| plan | 23 | 17 | 29 | 17 | 21 | 1.2 (brief) |
| research | 11 | 44 | 37 | 25 | 37 | 0.1 (fetch) |
| script | 15 | 5 | 13 | 9 | 13 | in brief |
| voice | 59 | 7 | 5 | 7 | 4 | 12.7 |
| board | 23 | 29 | 37 | 31 | 42 | in plan |
| assets | about 20 | 27 | 73 | 74 | 67 | 3.6 (media wait) |
| build | about 110 | 209 | about 190 | 0.1 | 0.1 | 66.5 (plan and checks) |
| render | 1119 (1 chunk) | 438 (3 chunks) | 573 (3 chunks) | 40 (3 chunks) | 20 (3 chunks) | none (plays live) |
| mux and sound | not logged | 4 | not logged | 6 | 3 | 3.2 |

## Render cost per frame

| Renderer | ms per frame | Notes |
|---|---|---|
| MotionEasy on main | 921 | one render slot |
| MotionEasy on agent-main | 471 to 2005 | three chunks in parallel; the high end is CPU contention |
| visual | 31 to 214 | three chunks in parallel; the high end is with footage decoding and concurrent test suites |

## What made it faster

1. Voice: lines are spoken in parallel and cached per line (59 s to 4 to 10 s).
2. Research: one shared browser reader per run, one capture per page instead of one per question.
3. Render slots sized from free memory, so chunks render in parallel on a 4 CPU, 8 GB box.
4. The visual renderer composes frames on a canvas in the page: about 15 times cheaper per frame than MotionEasy, and no per scene builder step.

## Where the time goes now

1. Assets: stock clip search and download, 60 to 144 s in the slowest runs (one Wikimedia Commons download took 144 s). Candidates: a per source time budget and starting downloads as soon as the board names a shot.
2. Board: one model call of 30 to 50 s.
3. Research: 16 to 64 s, mostly page capture and the scroll recording.

The live studio reaches a playable preview in under 90 s because it never encodes a file; the local visual path delivers a mastered mp4 in about 3.5 minutes on a quiet box.


## Upload edit bench (D1.6, R9 quick tier)

`packages/engine/scripts/edit-bench.ts --tier quick --mp4` runs each R9 clip (docs/agents/research/R9-benchmark-set.md)
through the same plan function the studio's edit job runs (`src/edit/job.ts` planEdit), opens the edit preview player in
headless Chrome for the first painted frame and the caption and face boxes, renders the MP4 from the EDL (D1.8,
`src/edit/render.ts`) and scores it (`src/edit/score.ts`). Style: base. 720x1280, 30 fps.

Commit 743bbdd plus this change · box 4 CPU, 8 GB, no GPU (software GL) · shared (another engineer's clip-moment
renders ran beside it) · 16/10/2026, 19:57 IST · tier quick

| Clip | Source s | Style | Preview s | MP4 s | Words right | Lang | Pauses left (max) | Cut on word | LUFS / TP | Captions off face | Band | Result |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| B1 | 29.69 | base | 4.75 | 17.17 | 57.75% (machine truth, not gated) | en ok | 0 (0.24 s) | 100% of 3; vs machine truth times 0% | -14.1 / -1.8 (mp4) | 100% | in | pass |
| B2 | 34.08 | base | 3.78 | 34.33 | 90.7% (machine truth, not gated) | en ok | 0 (0.38 s) | 100% of 2; vs machine truth times 50% | -13.9 / -2.1 (mp4) | 100% (no faces found) | in | FAIL: 2 silence holes in the MP4 |
| B4 | 101.1 | base | 26.92 | 54.27 | 72.4% | hi ok | 0 (0.36 s) | 100% of 11; vs machine truth times 18.2% | -13.9 / -2.1 (mp4) | 100% | in | FAIL: words 72.4%; 2 silence holes in the MP4 |

Stages (s):

- B1 stages (s): probe 0.12 · hear 3.61 · plan 0.18 · to plan 3.91 · deterministic true · slate kept 0 · truth: machine: gpt-4o-transcribe on whisper-1 word times, in pieces; checked by none (machine) · caption styles 11
- B2 stages (s): probe 0.11 · hear 2.89 · plan 0.26 · to plan 3.27 · deterministic true · slate kept 0 · truth: machine: gpt-4o-transcribe on whisper-1 word times, in pieces; checked by none (machine) · caption styles 11
- B4 stages (s): probe 0.13 · hear 24.51 · plan 0.29 · to plan 24.94 · deterministic true · slate kept 0 · truth: commons-timedtext-hi on whisper-1 word times, in pieces; checked by Commons subtitle authors (text); times machine · caption styles 11

How to read it, honestly:

- **Preview s** is upload accepted to the first painted frame of the edit preview (plan plus the player). B4 is a
  101 s clip; its hearing takes 24.5 s because the default English lock translated the Hindi speaker and the clip is
  heard a second time, locked to Hindi (below).
- **MP4 s** is the D1.8 render, on a box shared with another render. Budget: 120 s for a 30 s clip.
- **Words right** has no hand truth yet. B1 and B2 are scored against a machine transcript (gpt-4o-transcribe text on
  whisper-1 word times), so they are printed and not gated; B1's machine text is worse than the edit's own hearing
  (it heard "Ishaan" as "Vishal" and "Moovi" as "movies"), which is why B1 shows 57.75%. B4 is scored against the
  Commons Hindi subtitles and gated: **72.4%, failing** the 80% line. The subtitles carry the speaker's English words
  with Hindi glosses in brackets ("university (विश्वविद्यालय)"), which costs some of that, not all.
- **Cut on word** is the R9 snap law (within 100 ms of a word edge, none inside a word). No quick tier clip has hand
  word times: every truth's times are whisper-1's, no better than the hearing they would check (B1: whisper-1 stretched
  "and" from 22.78 to 23.52 s across the pause the edit trims). So the gate is against the EDL's own word edges, and
  the figure against the truth's machine times is printed beside it (0%, 50%, 18.2%). That second figure is the open
  question, not a pass: it needs hand word times on B1 and B2.
- **Silence holes: failing on B2 and B4** (2 each): stretches under -35 dB longer than 0.4 s inside one shot, where
  Whisper's word times run across a real pause, so the builder sees no gap to trim. Next: trim from the audio's own
  pauses as well as the word gaps.
- Loudness is -14 LUFS plus or minus 0.1 on all three; true peak at or under -1.8 dBTP. Every EDL is byte equal when
  built twice (deterministic). B2 found no face (the second speaker turns), so its captions are judged without one.

Fixed on the way (both made B2 and B4 skip or mis-hear in the first runs):

1. Speech pieces shared one file name per process: the locked and the unlocked hearing pass (and two clips in one
   process) cut pieces at once, so one ffmpeg truncated a piece another request was uploading, and the speech API
   answered 400 "Invalid file format". Each run now names its own pieces.
2. Unlocked Whisper starts a Hindi speaker in Devanagari and drifts into Urdu script piece by piece (B4: 172 Devanagari
   letters, 296 Arabic, reported "hindi"), so the Hindi relock refused it and the edit captioned an English
   translation (1% words right). Hindi now counts both scripts (and needs some Devanagari), and the clip is heard
   again locked to Hindi: 100% Devanagari, 88% agreement with the accurate transcript.
