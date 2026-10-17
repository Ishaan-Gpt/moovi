# Cardboard (cardboard.ai): how it works, and what Moovi can take

Owner: Claude 1 · 2026-10-17. Ishaan will implement later. Source: the teardown `docs/archive/research/cardboard-ai.md` (their landing code
captured and analysed with REA, plus their public `llms.txt`, 45-release changelog, "hard problems" page, 82 recipes,
guides, job posts and the Launch HN thread). The editor itself needs a sign-in, so its internals are **inferred** from
what they publish; the landing-page parts were **observed** in shipped code.

## What it is

YC W26 (Bengaluru / SF). **A browser video editor with an agent on top**: a real multi-track timeline, a custom WebGL2
compositor and WebCodecs decoder in the browser, a cloud backend, and a **"Director" chat agent** (Claude or GPT, you
pick) that edits by **calling timeline tools**. Since 2026-09-28 a Mac app lets your own Claude Code or Codex drive the
edit. Your own footage is the input; the output is a cut, exported to MP4/MOV or to Premiere, Resolve, Avid, Final Cut.

## How it processes a video

1. **Upload:** proxies are made for 4K; what's near the playhead loads first.
2. **Understand** (cloud, "vision models + classic ML"): shots, faces and face grouping across clips, segmentation (a
   person matte), who is speaking, transcription with **one language locked per video**, and search over all of it
   ("hybrid + agentic RAG", closer to how Claude Code searches than a vector database).
3. **Plan:** the Director turns your request into **tool calls on the timeline**. No fixed workflow ("the bitter lesson").
4. **Cleanup:** retakes, false starts, fillers, stutters and repeats removed at **Light / Balanced / Tight**, each
   previewed before you commit; cuts snap to word edges; silence is closed in the same pass.
5. **Music:** a **beat grid** (tempo estimated, then a regular grid phase-locked, so beats exist even in quiet stretches);
   montage law: **every moment used once**, and shots are held longer if the music wants more cuts than there is footage.
6. **Picture:** speaker-aware reframe (follows whoever is talking; split, grid, hero, PIP layouts), captions (21 styles,
   9 of them **behind the subject**), **b-roll timed to the spoken idea** with its in-point chosen by watching the clip,
   no letterboxed clips, no duplicates, every clip credited.
7. **Verify, then say done:** it **looks at real frames** (a caption off screen, a cut a beat early) and fixes; it
   **audits the result against your request**; it **listens to the mix**; it checks overlaps and too-small text.
8. **Export:** chunks rendered in parallel, every export checked (frozen frames, clicks), cloud fallback, cached when
   nothing changed.

## How it processes a change

Every chat message is a **checkpoint**. A change is new tool calls on the same timeline, never a regenerate. Undo
restores the exact timeline. "Exposure +0.8, every clip" moves real sliders, and asking twice **replaces** the grade
instead of stacking. Graphics expose their words, numbers and colours for editing.

## Before sign-up (observed in their code)

One model call turns your prompt into a strict **plan card** (title, kind, ratio, length, 3–4 steps, palette, cover).
If that call fails, a **regex fallback** classifies the prompt (reel 15 s, explainer 60 s, launch 30 s…) so it never
fails. **Recipes** (82) are typed forms: named media and text inputs ("names to spell right"), ratio, length, a preview;
the real instructions stay on their server.

## Same as Moovi

- Both edit your own footage with an AI director, from words, without you touching a timeline (Moovi) or with an
  optional one (Cardboard).
- Both: word-level transcription with a locked language, cuts snapped to words, pause and filler cleanup, face
  tracking, caption styles, b-roll, MP4 export.
- Both let any of several models drive.

## Different

| | Cardboard | Moovi |
|---|---|---|
| Surface | A full timeline editor; the agent edits it | No timeline; the plan (EDL) is data, the preview plays live |
| Output | A cut (plus graphics they're adding) | A designed film: styles, motion graphics, kits, inserts |
| Brain | A frontier model calling tools each turn | Code first, one small model call; works on free models |
| Memory | Project checkpoints | FalkorDB: library, kits, style memory, feedback |
| Generation | Generative footage tiers (Kling, Veo, Seedance) | No generated footage; code-made films from a prompt or link |

## Where Moovi is better

- **Designed films, not just cuts.** Their own "hard problems" page lists **motion graphics, style references and
  memory as unsolved**: exactly our styles, kits and graph.
- **Any model, cheap:** code does most of the work; one small call. They need Claude or GPT each turn.
- **Generate from a prompt or link**, not only edit.
- **Styles not templates:** two films of one clip or site differ, steered by memory.

## Where Cardboard is better

- **It verifies its own work** (frames, request audit, the mix) before saying done. Moovi doesn't, on the default path.
- **Checkpoints:** every message is a restorable version.
- **Cleanup levels you preview**, a **real music beat grid**, **every moment used once**.
- **Speaker-aware reframe** with face grouping across clips and active-speaker detection.
- **Captions behind the subject** in 9 of 21 styles.
- **B-roll on the spoken idea**, in-point picked by watching, letterbox and duplicate checks.
- **Exact grade by number** with replace semantics.
- **Professional exports** (NLE interchange, ProRes, HDR) and an export check with caching.
- **Recipes** as typed forms, and a **plan card** before sign-up that never fails.

## What to take

Ranked by impact per hour (from `cardboard-ai.md`):
1. **Verify-then-fix:** an EDL linter in code (safe zones, caption off the face, min text size, no overlaps, no gap or
   black frame, LUFS in band), then one look at 4–6 frames, then a request-vs-plan audit.
2. **Chat checkpoints as graph versions:** `(:Message)-[:PRODUCED]->(:EdlVersion)`; "undo to here".
3. **Cleanup levels** Light / Balanced / Tight over our pause and retake rules, previewed live.
4. **Beat grid + montage law** (pure TypeScript tracker; never reuse a moment).
5. **Captions behind the subject + a silence rule** (hide captions in long gaps).
6. **B-roll on the spoken concept**, in-point by looking; `cropdetect` for letterbox; dedupe by source id.
7. **Recipe cards with typed inputs** ("names to spell right" feeds transcription) and a **landing plan card**.
8. **Reference → style parameters** (measure a reference's cut rate, shot lengths, pace, colour → nearest style).
9. Small ones: black-bar repair, grade by number, export check and cache, platform pacing bands.

Don't take: a full browser timeline editor (the user never opens a timeline), generated-footage tiers, frontier-only
per-turn models.
