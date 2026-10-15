# Tab

## 2026-10-16 04:55 IST · vignesh/agent-main · 4e12ca7

Merged `vignesh/visual-system` through 8b43d22 (footage on panels, phones, browser windows and full bleed backdrops; frame critic; poster panels; no ffmpeg mp4). Tests on agent-main: engine 130 pass, 17 skip; skills 39 pass, 1 skip; library 3 pass; Chromium visual, render3d and maps tests 22 pass, 1 skip.

Held: a51d122 (scenes away from the current frame are dropped) is merged locally but not pushed yet. One test is load sensitive: "real footage (H.264 mp4 ...) plays on a panel, a phone and a browser window: frame-accurate, looped, and the same pixels whenever it is asked for" fails at the "a fresh page agrees" assertion (different frame hash) when the machine is under heavy load (load average 7 to 9 on 4 cores while a film renders), on 4e12ca7 as well as on the merge, and passes when the machine is quiet. It looks like the seek can present a neighbouring frame under load. Request: make the footage frame wait strict enough to give the same pixels under load (for example, confirm the presented frame time with requestVideoFrameCallback mediaTime before capture). a51d122 will be pushed as soon as the suite passes.

The `MOOVI_RENDERER=visual` end to end film is running on this machine with ffmpeg and FalkorDB; results will be posted here.

## 2026-10-16 03:44 IST · vignesh/agent-main · bf2f823

Merged `vignesh/visual-system` b42f5be (artifact library in FalkorDB, graph prior for casting) and 67b559f (crew path behind `MOOVI_RENDERER=visual`, `makeFilm`, docs/VISUAL.md). One conflict in `packages/engine/src/tasks/editor.ts` (imports) resolved by keeping both the video backdrop and the visual crew. Tests on agent-main: engine 122 pass, 11 skip; skills 39 pass, 1 skip; library 3 pass; render3d, maps and visual render tests 18 pass, 1 skip against a local Chromium; 0 failures.

Answers to the CLAUDE.md requests:
1. Visual tests and an end to end film: Tab is running the visual tests and a `MOOVI_RENDERER=visual` showcase film on a machine with ffmpeg and FalkorDB, and will post the results here.
2. Clip paths, video first, please. Real moving video is the top item on the quality bar. Where files land (`ctx.dir` is the run directory):
   - Stock clips: the Asset Hunter downloads candidates to `<run dir>/assets/footage/<provider>-<ref>.mp4` (for example `mixkit-47399.mp4`); the accepted clip for a request is copied to `<run dir>/assets/<asset id>.mp4` and returned as an `AssetOut` with `kind: 'footage'`.
   - Scroll recordings of the product site: `<run dir>/research/q<n>/<name>.mp4` (`Shot.video: true`, `kind: 'scroll'`); screenshots are `.png` next to them. Query `runShots` lists them with `seconds`, `w` and `h`.
   - Request: make `Content.clip` play these mp4 files on the phone and browser screen slots (and as a full bleed or split layout backdrop where a scene has footage), with the frame seeked deterministically from the frame number so renders stay reproducible.

## 2026-10-16 02:35 IST · vignesh/agent-main

Merged `vignesh/visual-system` b94b1ac (CLAUDE.md entry).

Answer to the CLAUDE.md note on clip and recording paths, for layout slots:
- Stock clips: the Asset Hunter (`packages/engine/src/tasks/hunter.ts`) downloads accepted clips to `<task dir>/footage/<provider>-<ref>.mp4`, cut to at most `MOOVI_CLIP_SECONDS` (12 s), scaled for the film format. Each lands as an `AssetOut` with `kind: 'footage'` and `path`, the output of the `asset:<id>` task; the graph keeps `(:Clip)-[:USED_IN]->(:Scene)`.
- Scroll captures and screenshots: the Researcher (`packages/engine/src/research/capture.ts`, `Reader`) writes them under `<run dir>/research/q<n>/`: `<name>.mp4` for a scroll capture (`Shot.video: true`, `kind: 'scroll'`), `.png` for hero, section and proof shots. Query `runShots` (media queries) returns every one for a run with `path`, `video`, `seconds`, `w`, `h` and the facts it proves. A scroll capture used in a scene arrives as an `AssetOut` with `kind: 'scroll'`.

## 2026-10-16 02:30 IST

Schedule: Claude Code session ends 06:00 IST. By 05:45 IST, push the final branch and add a closing CLAUDE.md entry: changes shipped, branch shas, open work and next steps.

Priority queue:
1. Visual system (motion every second, depth and 3D, multiple elements per scene, artifact library stored in FalkorDB), as posted.
2. Frame critic: after a render, sample frames and score them against the quality bar (real footage, motion, depth, multi element layout, artifacts, clean output: covered text, empty frames, static stretches over 1 s). Store scores per look, artifact and layout in FalkorDB, have the art director prefer high scoring choices, and re-render only failing scenes.
3. Render speed: parallel chunk rendering sized from available memory. Target about 60 s for a 30 s film.

## 2026-10-16 02:20 IST · vignesh/agent-main · e11d5b9

Integration status. `vignesh/agent-main` is built from `main` 318cd15. Merged, each with typecheck and tests passing:
- `vignesh/voice-3d-maps` f270362: voice library (63 voices) and Voice Director.
- `vignesh/clips-research` 606d581: footage agent and research capture.
- `vignesh/graph-memory` c1f45a9: feedback memory loop. In the voice step, feedback memory overrides the Voice Director's pick (`withFeedback` in `packages/engine/src/tasks/script.ts`).
- `vignesh/3d` 20a9ce2: render3d looks, art director selection, 3D poster assets.
- `vignesh/maps` 6213613: geocoding, MapLibre with globe fallback, map poster assets.

Fix applied during integration: `packages/engine/scripts/memory-bench.ts` failed typecheck because `kind` widened to `string`; typed with `satisfies Feedback[]` (be626d8).

Test status on agent-main: engine 96 pass, 7 skip; skills 39 pass, 1 skip; library 3 pass; 0 failures. render3d and maps tests pass against a local Chromium.

Quality bar for films:
1. Real moving footage: stock clips (Mixkit and similar) and screen recordings of the product site.
2. Motion in every second.
3. Depth and 3D.
4. Multiple elements per scene.
5. Rich artifacts: icons, 3D objects, device mockups, charts, particles.
6. Clean output.

Ownership:
- Tab: footage fetch, screen recordings, research capture, voice, tests, merges, speed measurements, showcase films.
- Claude Code: motion and animation system, parallax and depth layers, 3D scenes, multi element layouts, artifact library in the director and renderer.

Process: work on `vignesh/<feature>` branches only. Tab merges into `vignesh/agent-main` after typecheck and tests pass, then deletes the feature branch; later pushes to the same branch name are merged again. `main` and the studio UI are not modified. Target render time stays near 1 minute.

Requests for Claude Code: when a branch is ready, add an entry here in CLAUDE.md with its sha.
