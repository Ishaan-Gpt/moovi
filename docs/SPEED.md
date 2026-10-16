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

Commit c4f7658 plus the silence-hole fix (this change) · box 4 CPU, 8 GB, no GPU (software GL) · shared (another
engineer's clip-moment work and test suites ran beside it) · 16/10/2026, 21:15 IST · tier quick

| Clip | Source s | Style | Preview s | MP4 s | Words right | Lang | Pauses left (max) | Cut on word | LUFS / TP | Captions off face | Band | Result |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| B1 | 29.69 | base | 18.64 | 19.23 | 57.75% (machine truth, not gated) | en ok | 0 (0.24 s) | 100% of 3; vs machine truth times 0% | -14 / -3 (mp4) | 100% | in | pass |
| B2 | 34.08 | base | 6.91 | 31.21 | 89.15% (machine truth, not gated) | en ok | 0 (0.36 s) | 100% of 5; vs machine truth times 40% | -13.9 / -4.5 (mp4) | 99.3% | in | pass |
| B4 | 101.1 | base | 29.58 | 67.51 | 72.92% | hi ok | 0 (0.18 s) | 100% of 20; vs machine truth times 20% | -13.9 / -2.2 (mp4) | 100% | in | FAIL: words 72.92% |

Stages (s):

- B1 stages (s): probe 0.04 · hear 17.51 · plan 0.25 · to plan 17.81 · deterministic true · faces 19 · library graph 120 ms: 10 camera moves, 6 sfx (6 mixed), 1 transitions · slate kept 0 · truth: machine: gpt-4o-transcribe on whisper-1 word times, in pieces; checked by none (machine) · caption styles 12
- B2 stages (s): probe 0.05 · hear 5.46 · plan 0.68 · to plan 6.2 · deterministic true · faces 27 · library graph 98 ms: 19 camera moves, 12 sfx (12 mixed), 9 transitions · slate kept 0 · truth: machine: gpt-4o-transcribe on whisper-1 word times, in pieces; checked by none (machine) · caption styles 12
- B4 stages (s): probe 0.09 · hear 27.31 · plan 0.26 · to plan 27.68 · deterministic true · faces 28 · library graph 71 ms: 37 camera moves, 14 sfx (14 mixed), 0 transitions · slate kept 0 · truth: commons-timedtext-hi on whisper-1 word times, in pieces; checked by Commons subtitle authors (text); times machine · caption styles 12

The 19:57 IST run before this fix, for comparison: silence holes B1 0, B2 2, B4 2; B2 found no face then (captions
judged without one); preview 4.75 / 3.78 / 26.92 s; MP4 17.17 / 34.33 / 54.27 s.

How to read it, honestly:

- **Preview s** is upload accepted to the first painted frame of the edit preview (plan plus the player). B4 is a
  101 s clip; its hearing takes 27.3 s in this run because the default English lock translated the Hindi speaker and the clip is
  heard a second time, locked to Hindi (below).
- **MP4 s** is the D1.8 render, on a box shared with another render. Budget: 120 s for a 30 s clip.
- **Words right** has no hand truth yet. B1 and B2 are scored against a machine transcript (gpt-4o-transcribe text on
  whisper-1 word times), so they are printed and not gated; B1's machine text is worse than the edit's own hearing
  (it heard "Ishaan" as "Vishal" and "Moovi" as "movies"), which is why B1 shows 57.75%. B4 is scored against the
  Commons Hindi subtitles and gated: **72.92%, failing** the 80% line. The subtitles carry the speaker's English words
  with Hindi glosses in brackets ("university (विश्वविद्यालय)"), which costs some of that, not all.
- **Cut on word** is the R9 snap law (within 100 ms of a word edge, none inside a word). No quick tier clip has hand
  word times: every truth's times are whisper-1's, no better than the hearing they would check (B1: whisper-1 stretched
  "and" from 22.78 to 23.52 s across the pause the edit trims). So the gate is against the EDL's own word edges, and
  the figure against the truth's machine times is printed beside it (0%, 40%, 20%). That second figure is the open
  question, not a pass: it needs hand word times on B1 and B2.
- **Silence holes: 0 on all three** (were 2 on B2 and 2 on B4). Whisper's word times ran across real pauses (B2: "visit"
  22.05 to 22.44 s and "striking" 22.44 to 23.03 s over a pause heard from 22.24 to 22.76 s), so the builder saw no gap.
  Now the source goes once through the film's own voice chain (`voice.ts quietPauses`, beside the hearing: 1.3 s on B1,
  1.4 s on B2, 4.1 s on B4), every stretch whose sample peak at the loudness pass's gain stays under the R9 line
  (-35 dB, 3 dB margin; a blip under 0.1 s between two quiet stretches is bridged) is a heard pause, word edges are
  fitted to them (`build.ts fitWords`), and a heard pause over 0.32 s is cut to the usual breath of air
  (`law.quiet_trim`). Cut on word stays 100% against the EDL's (fitted) word edges. The films got shorter: B2 32.6 s and B4
  67.5 s, against 33.4 s and 70.7 s rebuilt from the same heard words without the fix.
- **Captions off face: B2 99.3%** (one run earlier today it read 0%: once Node face detection found B2's low selfie
  face, y 0.50 to 0.82 of the frame, the "face-safe" place was still a fixed chest band right on it). Captions now move
  per shot just below or above the face when the style's place would cover it, out of the platform zones
  (`lib.ts capYAt`); the player and the MP4 overlay share it.
- **Words right: B4 still failing** at 72.92% (gate 80%), unchanged by this fix. B1's preview is 18.6 s this run
  because its hearing took 17.5 s (the speech API was slow; 3.6 to 5 s in the runs before).
- **Hand word times on B1 and B2: not made.** Every truth's times are still whisper-1's, so the "vs machine truth
  times" figures (0%, 40%, 20%) remain the open question; a person has to mark them against the audio.
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
