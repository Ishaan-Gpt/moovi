# Claude Code bridge: handoff

> **Live progress is on branch `claude-code-bridge`:** https://github.com/Ishaan-Gpt/moovi/tree/claude-code-bridge/docs/agents/claude-code-bridge (this copy on main is a snapshot; the branch is updated after every item).

Read this first if you are picking the work up. Updated by Tab after every item.

- **Goal:** users on the Moovi website with no API key connect their Claude Code; per video they type `/moovi:run` and
  Claude Code makes only the top-level decisions (1 to 3 calls per video); Moovi's server does everything else.
- **Plan:** `docs/agents/research/mcp-claude-code-bridge-plan.md` (sections 16 to 23 win over earlier ones).
- **Checklist:** `CHECKLIST.md` (this folder). **Log:** `LOG.md`.
- **Branch:** `claude-code-bridge`. Before every item: `git fetch` and merge `origin/main` into it (additive merge
  commit, Ishaan's shas in LOG.md). After every green item (tsc per package, full engine suite, secret scan): push the
  branch, then merge it into `main` with an additive merge commit and push main too (Vignesh 2026-10-17 19:52 IST: "keep
  pushing in main as well as in this new branch"; matches Ishaan's CLAUDE.md). Red code goes to the branch only.
- **Push:** through the GitHub API (git data: blobs, trees, commits, then the ref with `force: false`), never force.
- **Last sha:** see the newest line in `LOG.md`.
- **Current state:** Phases 0, 1 and 2 done (items 1 to 18); Phase 3 items 20 to 24 done (resume, two windows, hostile CLAUDE.md, the failure cases, the 120 s fallback); item 27 (measure) done. Live-test round 3 (Oct 18): effects render with no Python (Node face + U2-Net-p cutout), cuts keep air around every kept word, the preview clock follows the playing video, Claude Code keeps looping on moovi_next, Settings card "Use Claude Code", AWS compose + `DEPLOY-AWS.md`. Round 4 (deploy): compose fixed (duplicate key), `deploy/server-setup.sh` safe as an update and on an existing server, `MOOVI_BYOK=optional` until the studio gate reads the bridge link, Settings card through a `/studio` proxy, `pnpm --filter @moovi/mcp check`, a 2 GB server works (`DEPLOY-AWS.md`, Small server). Waiting on Vignesh's next test on Windows and Ishaan's server update. See the newest LOG lines.
  - Contracts: `engine/src/edit/direct.schema.ts`, `engine/src/router/direct-film.schema.ts`, `engine/src/runtime/budget.ts`.
  - Lane switch `engine/src/runtime/lane.ts`; checker `engine/src/runtime/checked.ts`; `keys.registerBrainScope`.
  - Brain calls: `engine/src/edit/direct.ts` (`directEditStep`, `directEdit`, `overridesOf`; `planEdit` asks for a
    direction when `PlanInput.direction` is 'ask' or the scope's provider is `claude-code-bridge`; null = today's rules)
    and `engine/src/router/direct-film.ts` (`directFilmStep`, `directFilm`, `launchRecord`).
  - `packages/mcp`: `store.ts`, `queue.ts`, `bridge.ts`, `lease.ts` (`Gate`, `onPull` hook), `scope.ts` (`Presence`: a
    session that pulled in the last 90 s is online; `brainScope`: the ModelScope for `keys.registerBrainScope`, brain
    calls to `bridgeRuntime` inside `laneRuntime`, provider `claude-code-bridge`).
  - `@moovi/engine/brain` (`engine/src/brain.ts`): the two brain calls and their contracts in one import.
  - Known gaps: Direction `cards` are recorded but not yet placed (inserts.ts casts cards from the graph by tag); the
    edit step sends no keyframes yet (the step supports images, `CompleteRequest` has no image field); BRAIN 2 (final
    look) not wired; `chat.ts` line 20 still checks `loadModel` under MOOVI_BYOK=required.
- **Phase 3 (items 20 to 24), in progress.** Item 20 done: `lease.ts` (`Gate`): the lease's `at` is the holder's
  last call; `keepAlive` (every `moovi_next` look) keeps a polling window's videos; a lease with no call for
  `LEASE_MS` (2 min) is taken over by another window with its own `/moovi:run` (read back, one owner); `release` on
  MCP session close (`server.ts` `mcp.server.onclose`) gives the video back at once; `heldElsewhere` lets
  `moovi_next` tell a second window "another window" between steps too. `queue.ts`: `held:<user>` list of picked
  steps, `picked()`, `repick()`: a dropped window's open step goes to the window that takes over (same step id, fresh
  answer window); the same window asking again gets its open step back. Tests: `packages/mcp/test/resume.test.ts`.
- **Item 24 done:** `runtime/lane.ts` `WAIT_MS` (10 min) and `LaneRuntimeOptions.waitBrain`: the wait lane (Claude
  Code linked, no key, no server model allowed) queues the step on a second bridge with the long pickup window and
  throws `BrainWaiting` (the job parks) only when nobody picks it up; `scope.ts` builds it (`bridge.waitMs`).
  `Presence.link` + `hub.ts` prime hook: a user with a live token whose Claude Code never polled is `linked`, so a
  keyless video started before `/moovi:run` waits instead of "add your API key" (MOOVI_BYOK=required). Tests:
  `packages/mcp/test/lanes.test.ts` (fake clocks: 119 s no key call, 120 s key; server only under optional; wait then
  pick up; park at 10 min; offline goes to the key at once; memo kept across a switch; token but never polled).
- **Item 21 done:** `packages/mcp/test/windows.test.ts`: two windows on two videos never cross (a cross answer is
  refused); the same video from two folders gets a byte-identical step view, the same answer and a byte-identical EDL
  (`buildEdl` is re-exported from `@moovi/engine/brain` for this); over HTTP a second window is told "another window"
  between steps and gets the video when the first window closes.
- **Item 22 done (server side):** `packages/mcp/test/hostile.test.ts`: hostile answers (an extra key, an off-menu
  look, a sentence that does not exist) get one re-ask then the default; hostile free text gives the same overrides and
  EDL as a clean answer; at the door (HTTP) prose, oversize and off-menu answers are refused and the step stays open.
  The manual check with a real junk CLAUDE.md is in `TEST-WITH-CLAUDE-CODE.md` section 8b for Vignesh.
- **Live-test fix (Oct 17, Vignesh, fresh unseeded FalkorDB):** the edit failed with `[craft] assetOrigins failed: ERR
  Invalid graph operation on empty key`. FalkorDB refuses a read-only query on a graph that does not exist yet; the graph
  client now reads that as no rows (`isEmptyKey` in `graph/src/client.ts`), an outage still stops the job. A failed job's
  reason now reaches Claude Code (`JobInfo.error`, `moovi_next` failed result has `reason` and says it). `pnpm graph:seed`
  reads `.env.local`; the test guide setup is `pnpm falkordb` then `pnpm graph:reset` (craft + library, keeps accounts).
  Tests: `mcp/test/failure-reason.test.ts` (3), `engine/test/graph-empty-key.test.ts` (2, one needs a live FalkorDB).
- **Item 27 done (measure):** `MEASURE.md` in this folder. `scripts/e2e.ts` takes `E2E_BRAIN=model` (a real Claude
  model answers each step from the exact tool text), `E2E_COUNT=exact` (the provider's `count_tokens` on every text
  read and written; Moovi's tool share counted on top of a client that already has tools) and `E2E_OUT=<file>`.
  Per video: one `direct:edit` step, about 3,800 tokens in and 250 out (caps 10,000 and 2,500), first step at 4 s,
  live edit at 9 to 10 s, effects version at 3.9 to 5.8 min (over plan 23.4; the render, not the brain). Fixes:
  `estimateTokens` now 2.8 / 1.3 characters per token (the old 3.6 / 1.5 ran 11 to 22 percent low; budget 27 test),
  `directFilmStep` cuts its source by that estimate (it overshot the film cap), `mcp/test/measure.test.ts` keeps
  RUN_OVERHEAD above the run prompt and tool text.
- **Run command is `/mcp__moovi__run`** (Claude Code's name for an MCP prompt; Vignesh hit `/moovi:run` not working):
  every bridge string, the connect page (`app.ts`, asserted in `test/app.test.ts`), `NOTICE.run`, `IDLE_NO_TICKET`,
  `/api/brain/link` `run` and the lane messages say it. Docs and comments that still say `/moovi:run` mean the same.
- **Studio key gate (open, Ishaan):** `apps/studio/src/lib/session.ts` sends a keyless user to Settings under
  `MOOVI_BYOK=required` even when Claude Code is linked: it reads `modelInfo` only, and the studio process does not
  register the bridge hooks. Request with the exact two lines in `docs/agents/TAB.md` (register `linked` once, then
  `&& !(await brainLinked(u.id))`).
- **Item 23 done:** `packages/mcp/src/notices.ts`: `NOTICE` holds every user-facing sentence in the plan's own words
  (section 17), `jobNotice(facts)` says what a video's pill, row, hint and Copy command show, `errorNotice(e)` maps the
  bridge errors (`BrainNotPickedUp`, `BrainWaiting`, `BrainTimedOut`, `NoModelForAgent`) to the same words.
  `/api/brain/status` now returns `notice` and `jobs` (one notice per running video, from `queue.open(user)`); the UI
  request is in `docs/agents/TAB.md`. Wording changes: a bearer that does not verify (revoked, replaced, unknown) gets
  `TOKEN_REMOVED` ("This Moovi connection was removed. Copy a new one from Moovi Settings."; no bearer still gets
  `UNAUTHORIZED`); `IDLE_OTHER_WINDOW` and `DEFAULT_NOTE` are the plan 17 sentences. New guard: every brain step
  carries `maxOut` from `BRAIN_CAPS` (`capOf` in bridge.ts) and `moovi_answer` refuses an answer over it (25 percent
  slack, `OVER_CAP_SLACK`) with the step left open. Tests: `test/failures.test.ts` (14: the 11 rows of plan 17, plus
  over-budget, numbers not in the source, bridge process down), all on fake clocks except the HTTP ones.
- **Next item:** 25 (Vignesh's second test). Item 19 (his first test) runs in parallel.
- **Item 12 tests** (`packages/mcp/test/bridge-e2e.test.ts`, 5): a stand-in Claude Code session (ticket, then pull and
  answer through the `Gate`) directs `directEdit` end to end inside `withModel(brainScope(...))`; a second window is
  turned away while the first holds the job, and a bad answer gets exactly one re-ask; no `/moovi:run` ticket means no
  work and the step falls to the key after the pickup window; no key and nobody picking up parks the job
  (`BrainWaiting`); registered through `registerBrainScope` it goes first only for a connected user.

## How to run things

- Engine tests: `cd packages/engine && FALKORDB_URL=falkor://127.0.0.1:6394 npx tsx --env-file=test/graph-optional.env --test test/*.test.ts` (the env file is Ishaan's decision 13: without it the three "FalkorDB down" tests fail).
- End to end proof: `FALKORDB_URL=... pnpm --filter @moovi/mcp e2e` (needs `OPENAI_API_KEY` or `GROQ_API_KEY` for hearing; with no words the edit runs on rules and no brain step is asked). On Tab's box the speech key came through Tab's own proxy with a preload kept outside the repo.
- Typecheck one package at a time: `cd packages/<pkg> && npx tsc -p tsconfig.json --noEmit`
  (`pnpm -r typecheck` fails in a non-interactive shell).
- Bridge tests (from phase 1): `cd packages/mcp && npx tsx --test test/*.test.ts`.
- FalkorDB/Redis for queue tests: `FALKORDB_URL=falkor://127.0.0.1:6394` on Tab's box; elsewhere run the repo's
  `pnpm falkordb` (docker) and use port 6380.

## Rules

- Commits: author `VIGNESH B S <vigneshbs33@gmail.com>`, no em or en dashes in docs or messages, secret scan before push.
- Never commit node_modules, media, binaries, `runenv.json`, `rt/cache/clips-*.json`, `_*.ts`.
- Owner map (STAGE-1.md): Tab owns `chat.ts`, `router/`, `edit/`, `review/`, `keys.ts`, `worker.ts`, `runtime/`,
  `packages/mcp`. Ishaan's sessions own `styles/`, `packages/library/src/kits/`, `apps/`, `packages/brand`,
  `packages/character`. A change in someone else's area goes through their log first.
- Anthropic terms: per job, user triggered only (`/moovi:run`). No background loop, no `claude -p` daemon.

## Open questions

1. `edit/job.ts` hook for the direction (style, cleanup, moves, cards): Tab's area per STAGE-1, but Ishaan's final
   merge changed it; note in his log before editing.
2. Creative mode doing more per stage (STAGE-1 W3) vs few calls (Vignesh 7:34 PM): proposal is to fold it into the one
   "direct" call (e.g. write and rank hooks inside it).
3. SERVER-LLM stages need Moovi's own server key (a cheap fast model). Which provider and budget?

## Gotchas

- Speech needs no key since Oct 18: with no Groq/OpenAI key (or when the provider refuses) `hear()` runs Whisper locally
  (`audio/local-stt.ts`, transformers.js, whisper-large-v3-turbo at 4 bit, about 760 MB downloaded once to
  `data/models`; a 30 s clip heard in about 26 s on 4 CPU cores). `MOOVI_STT_LOCAL_MODEL=onnx-community/whisper-small_timestamped`
  is the lighter one (250 MB, 3x faster, more misheard words on accented speech). `MOOVI_STT=off` turns it off;
  then an edit of a talking clip stops with "Moovi needs a speech key to hear your clip" (no more silent 0-word edits).
- Effects are inside the edit since Oct 18: an edit job (`router/edit.ts`) plays the live preview, then delivers ONE
  finished video: the plan's cut with 3 to 5 library effects (`edit/effects`, picked from the kept words) and the captions
  (white, keyword yellow, dark outline) drawn over it (`edit/effects/onedit.ts`). `MOOVI_FX=off` skips it (preview only).
- A fresh FalkorDB has no `craft` graph until `pnpm graph:reset`; reads on it are empty (no error since Oct 17), so the
  edit runs plainer (no library sounds, camera moves, why links). Seed it.
- Claude Code HTTP tool calls: first byte within 60 s, abort after 5 min idle without progress. Long poll 45 s max.
- Claude Code warns past 10k tokens of tool output; keep every step small.
- The engine's own deadlines assume an API; the bridge scope sets `deadlineScale` high and the bridge enforces its own
  pickup and answer timeouts.
- `review/config.ts` caps the vision timeout at 120 s; scale it by `deadlineScale()` (one line).
- Claude Code cannot see which model it runs to us; the answer schema carries a self-reported `model` field.
