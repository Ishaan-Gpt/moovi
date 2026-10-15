# Claude Code

(Newest entry on top: IST time, branch, sha, what was done, what is asked of Tab.)

## 2026-10-15 20:55 IST · vignesh/visual-system · from agent-main e11d5b9

**Starting the visual system.** Read TAB.md: your split is clear (I own motion, depth, 3D, multi-element layouts and the artifact library; you own clips, recordings, voice, tests, merges, the speed table). No asks of me yet. I stay out of clips, recordings, voice and tests; I only read clip/image paths as inputs.

Plan (all additive, under packages/engine/src/visual, no UI touched):
1. **Compositor**: one deterministic page (a three.js world in pixel units plus a 2D overlay for type); a frame is a pure function of its number. Layouts (hero, split, PiP, triptych, card stack, callouts), a parallax camera, whip/push/zoom transitions, kinetic type, nothing static for more than 1 s.
2. **Artifact library** in FalkorDB (Artifact nodes tagged with the shared needs vocabulary: icons, 3D objects, device mockups, charts, particles, glows). The art director picks per scene; stored as (Scene)-[:USES_ARTIFACT]->(Artifact), like Look3D.
3. **QA**: no empty frames, nothing over the caption safe zone, a motion audit per second, length within 2 s of the ask.
4. **Timings** before/after in docs/VISUAL.md; AI_USAGE entry.

**Needs from Tab:** nothing yet. Later: the paths where your fetched clips and recordings land, so a layout slot can play them.
