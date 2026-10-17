# Claude Code bridge: log

> **Live progress is on branch `claude-code-bridge`:** https://github.com/Ishaan-Gpt/moovi/tree/claude-code-bridge/docs/agents/claude-code-bridge (this copy on main is a snapshot; the branch is updated after every item).

One line per finished item: date and time (IST), item, what, commit sha.

- 2026-10-17 19:10 IST · plan · bridge plan v1 · d26a0dd
- 2026-10-17 19:15 IST · plan · failure modes, UX, verified vs assumed, manual test · 95000ac
- 2026-10-17 19:35 IST · plan · isolation, works the same everywhere, lane order (Ishaan) · 91b111e
- 2026-10-17 19:42 IST · plan · brain only (BRAIN vs SERVER, batched calls, token caps) · 2e99402
- 2026-10-17 19:50 IST · setup · this folder: CHECKLIST.md, HANDOFF.md, LOG.md · (this push)
- 2026-10-17 19:54 IST · branch · `claude-code-bridge` from main 711b9d0 (Ishaan: PIPELINE.html single source of truth, docs archived); main banner 5bf0439
- 2026-10-17 19:54 IST · item 3, 3a · direct-edit contract, engine 430 tests (414 pass, 16 skip, 0 fail), tsc engine 0 · 2fc20cf
- 2026-10-17 19:58 IST · item 4 · direct-film contract (Launch first), engine 436 tests (420 pass, 16 skip, 0 fail), tsc engine 0 · 100f33c
- 2026-10-17 19:59 IST · sync · merged Ishaan's main 7e78abb, dc826d3 (DECISIONS.md: styles become looks of 7 types; one way in, the brain choice is Creative with Claude Code online, else Precise with a key). Docs only, no bridge file touched. `FILM_BRIEFS` keys move from styles to types when the type registry lands
- 2026-10-17 20:02 IST · sync · merged Ishaan's main 802b539 (DECISIONS.md 3: the Edit type's 5 looks are Base, Atlas, Handmade, Studio Minimal, Studio Cut; same as `liveMenus().looks`). Docs only
- 2026-10-17 20:02 IST · item 5 · token budget: caps, estimator, trimmer, ledger, engine 442 tests (426 pass, 16 skip, 0 fail), tsc 0 · 5e7001b
- 2026-10-17 20:06 IST · sync · merged Ishaan's main 2cd9af9 (DECISIONS.md 4: the old crew retires; Creative mode's "write a new piece" replaces the shot builders, see open question 2). Docs only
- 2026-10-17 20:06 IST · item 7 · lane switch: pickLane, BRAIN_AGENTS, laneRuntime, brainMode, registerBrainScope, engine 449 tests (433 pass, 16 skip, 0 fail), tsc 0 · 85e0168
- 2026-10-17 20:07 IST · sync · merged Ishaan's main 2b1949c (docs(agents): DECISIONS.md, decision 5 (one caption system)). Files: docs/agents/DECISIONS.md
- 2026-10-17 20:13 IST · sync · merged Ishaan's main 9f9d0c5, 09adf51 (DECISIONS.md 6, 7) and 90aeec7 (W4: eight pipeline agents, stage lines). 90aeec7 touches `router/edit.ts` and `router/job.ts` (stage lines and agent desks only; no lane, model or EDL change); suite green after the merge
- 2026-10-17 20:13 IST · item 8 · queue + memo + bridge runtime (packages/mcp), engine 452 tests (436 pass, 16 skip, 0 fail), tsc 0 · 4f7aee2
- 2026-10-17 20:14 IST · sync · merged Ishaan's main 2a41c0a (DECISIONS.md 8: voices). Docs only
- 2026-10-17 20:17 IST · sync · merged Ishaan's main 67d6222, 761ee21, f2b1f65 (DECISIONS.md 9 to 11; 11: one Lens, BRAIN 2 "final look" feeds its single repair). Docs only
- 2026-10-17 20:17 IST · item 9 · tickets + leases (Gate); mcp 13 tests (13 pass), engine 452 tests (436 pass, 16 skip, 0 fail), tsc 0 · a226084
- 2026-10-17 20:20 IST · sync · merged Ishaan's main 6305851 (DECISIONS.md 12: Settings gain the connect-Claude-Code card, online/offline pill and the "type /moovi:run" panel, i.e. Vignesh's 5 UI hooks are in the plan; all 12 decisions made). Docs only
- 2026-10-17 20:20 IST · item 10 · answer checker; mcp 14 tests (14 pass), engine 457 tests (441 pass, 16 skip, 0 fail), tsc 0 · 341ffdc
- 2026-10-17 20:26 IST · sync · merged Ishaan's main 6776fa4 (caption gallery for decision 5; scripts and docs only, no default changed)
- 2026-10-17 20:26 IST · item 11 · directEdit + planEdit hook, directFilm + Launch record; mcp 14 tests, engine 466 tests (450 pass, 16 skip, 0 fail), tsc 0 · bad6b6b
- 2026-10-17 20:38 IST · sync · origin/main 90881fa was our own item 11 merge; no new Ishaan commits (fast forward)
- 2026-10-17 20:38 IST · item 12 · full bridge tests (`bridge-e2e.test.ts` 5: end to end, second window, bad answer re-ask, no ticket to key, park without key, registered scope) with `scope.ts` and `@moovi/engine/brain`; mcp 19 tests (19 pass), engine 466 tests (450 pass, 16 skip, 0 fail) · c9e6768
- 2026-10-17 20:38 IST · item 13 · Phase 1 wrap-up: main synced, tsc 0 on all 8 packages (brand, character, graph, library, skills, ui, engine, mcp), engine 466 (450 pass, 16 skip, 0 fail), mcp 19/19, secret scan clean; branch pushed and merged into main · c9e6768
- 2026-10-17 20:50 IST · sync · merged Ishaan's main d167f1a (W10 step 1: versions and forks; touches `edit/job.ts` restore line only, no conflict)
- 2026-10-17 20:50 IST · item 14 · `/mcp` endpoint (`http.ts`, `server.ts`, `hub.ts`, `poll.ts`, SDK 1.32.1); mcp 24 tests (24 pass), engine 471 tests (455 pass, 16 skip, 0 fail), tsc 0 (engine, mcp) · 4e0f7ad
- 2026-10-17 20:52 IST · sync · merged Ishaan's main ef95004 (decision 13: FalkorDB required on the product path; the bridge serve script will refuse to start without it, memory store only under MOOVI_GRAPH_OPTIONAL=1 or tests)
- 2026-10-17 20:56 IST · item 15 · tokens + `/api/brain/link` and `/api/brain/status` (`tokens.ts`, `api.ts`, store-backed `Presence`); mcp 29 tests (29 pass), engine 471 tests (455 pass, 16 skip, 0 fail), tsc 0 (engine, mcp) · cf422d3
- 2026-10-17 20:56 IST · sync · merged Ishaan's main b4db8fe (galleries: engine scripts and docs/galleries only, none of our files); engine tsc 0 after the merge
- 2026-10-17 21:11 IST · item 16 · `moovi_next`/`moovi_answer`, job board, `hub.register()`, engine hooks (keys/worker/chat; chat.ts no longer refuses a keyless user who connected Claude Code); mcp 33 tests (33 pass), engine 471 tests (455 pass, 16 skip, 0 fail), tsc 0 (engine, mcp) · 10d52ea
- 2026-10-17 21:12 IST · sync · merged Ishaan's main 42f2e2c and ca1d419 (W9: review Lens and floor rules; touches `review/` runner, vision, lint, film; no conflict with the bridge); engine 481 tests (465 pass, 16 skip, 0 fail), mcp 33/33, tsc 0 after the merge
- 2026-10-17 21:15 IST · item 17 · `/moovi:run` as the MCP prompt `run` (ticket minted and bound on get); mcp 34 tests (34 pass), engine 481 tests (465 pass, 16 skip, 0 fail), tsc 0 (engine, mcp) · d7a7324
- 2026-10-17 21:42 IST · sync · merged Ishaan's main 30b7e6f and bdac120 (decision 14, docs), 483766f (type registry), 3e1bae9 and 3faab70 (decision 13 steps 1 and 2: FalkorDB required; touch `edit/cast.ts`, `edit/inserts.ts`, `edit/job.ts` and `edit/templates/clip-moment-run.ts`, only to stop a job when FalkorDB is down instead of falling back; our bridge lines in `job.ts` untouched); no conflict; engine 494 tests (478 pass, 16 skip, 0 fail) with his `test/graph-optional.env`, tsc 0 (engine, mcp, graph, library) · 1b7fec3
- 2026-10-17 21:52 IST · item 18 · end to end with the MCP SDK client as the only brain (`scripts/e2e.ts`): token, connect, `run` prompt, one `direct:edit` step on lane `claude-code` answered first try, 7 tool calls (2 for the decision, 5 polls during render), about 2,570 tokens read and 104 written by the client; live edit at 4 s (48 words captioned), effects version `videos/<chat>/v2.mp4` 1080x1920 19.0 s at 226 s, final `moovi_next` = done with the studio link. Also `app.ts`, `scripts/serve.ts` (`pnpm dev:bridge`), presence write throttle, `test/app.test.ts`; `TEST-WITH-CLAUDE-CODE.md` for Vignesh; mount request in TAB.md. mcp 37 tests (37 pass), tsc 0 · 30e8b96
- 2026-10-17 22:00 IST · sync · merged Ishaan's main 4fdbca1 (typeKit needs FalkorDB) and 36cfdb1 (W15 retakes: `edit/takes.ts` new, touches `edit/build.ts`, `job.ts`, `plan.ts`, `reedit.ts`); no conflict, our bridge lines in `job.ts` intact; engine 502 tests (486 pass, 16 skip, 0 fail), mcp 37/37, tsc 0 (engine, mcp) · 616f834
- 2026-10-17 22:05 IST · sync + main · merged Ishaan's main 101a7c6 (galleries docs and `engine/scripts/edit-round1.ts`, none of our files; engine tsc 0) · e48fd4c; item 18 merged into main · 5d549a0
- 2026-10-17 22:57 IST · item 20 · resume after a dropped window: keepAlive, 2 min takeover of the same picked step, release on close, heldElsewhere between steps, memo replay on rerun; mcp 42 tests (42 pass), engine 502 tests (486 pass, 16 skip, 0 fail), tsc 0 (engine, graph, library, mcp) · 017f1d3; main 5d549a0 synced (no new Ishaan commits) · 144d07d
- 2026-10-17 23:05 IST · item 24 · lane order with fake clocks (119 s no key call, 120 s the key; server only under MOOVI_BYOK=optional; else a 10 min wait lane for /moovi:run, then park; offline goes to the key at once; memo kept across a switch) and a token but never polled user is linked, not refused; mcp 50 tests (50 pass), engine 506 tests (490 pass, 16 skip, 0 fail), tsc 0 (engine, graph, library, mcp) · 2d47791; main 86d32a2 synced · 5bd3c64
