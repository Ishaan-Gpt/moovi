# Claude Code

(Newest entry on top: IST time, branch, sha, what was done, what is asked of Tab.)

## 2026-10-16 · vignesh/visual-system · e004c0b: ready to merge

**Done on the branch (all additive; typecheck clean; the visual tests pass, one skipped for FalkorDB):**
- `packages/engine/src/visual`: planner, 56-artifact library, 9 layouts, a deterministic 2D + three.js compositor, QA audits, `makeFilm`, and a crew path behind `MOOVI_RENDERER=visual` (the default renderer is unchanged).
- The library is in FalkorDB: `(Artifact)-[:SERVES]->(Need)` in craft, `(Scene)-[:USES_ARTIFACT]->(Artifact)` per film; 7 new queries in docs/QUERIES.md.
- Render time for the 26.6 s sample film: 110 s → 36 s capture (the table is in docs/VISUAL.md). A 16 s film took 9.6 s.
- Try it: `pnpm --filter @moovi/engine exec tsx scripts/visual.ts make script.json words.json voice.wav vertical light`. The mp4 needs ffmpeg; without it the frames stay in data/visual/frames.

**Failing on my machine, not because of this branch:** the audio "music bed" test and test/voice.test.ts both need ffmpeg (they fail the same with my changes stashed).

**Needs from Tab:**
1. Run the visual tests and a showcase film on a machine with ffmpeg and FalkorDB (the graph round-trip test is written and skipped here; the crew path was not run end to end, only its pieces are tested).
2. When your footage fetch lands, tell me the paths: a clip can go on the phone or browser screen (`Content.clip`), but the page plays images only so far. Say if you want video first.
3. tasks/director.ts has additive edits from vignesh/3d, vignesh/maps and this branch near the board schema (look3d, places, stage): expect a small conflict to resolve by keeping all three.

## 2026-10-15 20:55 IST · vignesh/visual-system · from agent-main e11d5b9

**Starting the visual system.** Read TAB.md: your split is clear (I own motion, depth, 3D, multi-element layouts and the artifact library; you own clips, recordings, voice, tests, merges, the speed table). No asks of me yet. I stay out of clips, recordings, voice and tests; I only read clip/image paths as inputs.

Plan (all additive, under packages/engine/src/visual, no UI touched):
1. **Compositor**: one deterministic page (a three.js world in pixel units plus a 2D overlay for type); a frame is a pure function of its number. Layouts (hero, split, PiP, triptych, card stack, callouts), a parallax camera, whip/push/zoom transitions, kinetic type, nothing static for more than 1 s.
2. **Artifact library** in FalkorDB (Artifact nodes tagged with the shared needs vocabulary: icons, 3D objects, device mockups, charts, particles, glows). The art director picks per scene; stored as (Scene)-[:USES_ARTIFACT]->(Artifact), like Look3D.
3. **QA**: no empty frames, nothing over the caption safe zone, a motion audit per second, length within 2 s of the ask.
4. **Timings** before/after in docs/VISUAL.md; AI_USAGE entry.

**Needs from Tab:** nothing yet. Later: the paths where your fetched clips and recordings land, so a layout slot can play them.
