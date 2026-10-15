# Tab

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
