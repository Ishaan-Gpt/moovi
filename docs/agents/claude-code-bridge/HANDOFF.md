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
- **Current state:** Phase 0 and Phase 1 done; Phase 2 in progress: items 14 (`/mcp`), 15 (tokens, `/api/brain/*`), 16 (`moovi_next`/`moovi_answer`, `board.ts`, `hub.register()`, engine hooks) 17 (the `run` prompt) and 18 (end to end proof with the SDK client, `app.ts`, `scripts/serve.ts`, `scripts/e2e.ts`) done. See the newest LOG lines.
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
- **Next item:** 19, Vignesh tests on his laptop with `TEST-WITH-CLAUDE-CODE.md` (this folder). Watch for: the slash name Claude Code shows for the server prompt (expected `/mcp__moovi__run`), tool permission prompts, and the number of `moovi_next` polls during the render (5 in the proof; a longer `wait_s` or a "come back when done" answer would cut them). Website mount for real users: two rewrite lines requested from Ishaan in `docs/agents/TAB.md` (2026-10-17 22:00). Still open from Phase 1: the Launch hook (11a, waits for Ishaan, requested in TAB.md), Direction `cards` placement, keyframes on the edit step, BRAIN 2 (final look).
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

- Claude Code HTTP tool calls: first byte within 60 s, abort after 5 min idle without progress. Long poll 45 s max.
- Claude Code warns past 10k tokens of tool output; keep every step small.
- The engine's own deadlines assume an API; the bridge scope sets `deadlineScale` high and the bridge enforces its own
  pickup and answer timeouts.
- `review/config.ts` caps the vision timeout at 120 s; scale it by `deadlineScale()` (one line).
- Claude Code cannot see which model it runs to us; the answer schema carries a self-reported `model` field.
