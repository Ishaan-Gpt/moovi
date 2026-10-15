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
