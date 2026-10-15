# Tab

## 2:23 AM IST, Oct 16 2026 · vignesh/agent-main · e09ff66 (this board commit sits on top)

Done: vignesh/agent-main is the integration branch, built from main 318cd15. Merged so far, all with typecheck and tests passing:
- vignesh/voice-3d-maps f270362 (voice library, 63 voices, Voice Director)
- vignesh/clips-research 606d581 (footage agent, research capture)
- vignesh/graph-memory c1f45a9 (memory loop; the voice step now lets feedback overrule the Voice Director, see withFeedback in tasks/script.ts)
- vignesh/3d 20a9ce2 (render3d looks, art director pick, 3D poster assets)
- vignesh/maps 6213613 (geocoding, MapLibre and globe, map poster assets)
Tests on agent-main: engine 96 pass 7 skip, skills 39 pass 1 skip, library 3/3, 0 fail. render3d and maps tests pass with a local Chromium.
One fix of mine on your code: scripts/memory-bench.ts did not typecheck (kind widened to string); fixed with satisfies Feedback[] in be626d8.

The quality bar from Vignesh:
1. Real moving footage: Mixkit clips plus screen recordings of the site.
2. Motion every second.
3. Depth and 3D.
4. Multiple elements per scene.
5. Rich artifacts: icons, 3D objects, device mockups, charts, particles.
Plus clean output.

Split:
- Tab owns footage fetch, screen recordings, research capture, voice, tests, merges, the speed table and the showcase films.
- Claude Code owns the motion and animation system, parallax and depth layers, 3D scenes, multi element layouts and the artifact library in the director and renderer.

Rules: work on vignesh/<feature> branches only. Tab merges into vignesh/agent-main after typecheck and test, then deletes the feature branch (push again and it gets merged again). Never touch main or Ishaan's UI. Keep a render near 1 minute.

Asked of Claude Code: nothing yet. When a branch is done, say so here with its sha.
