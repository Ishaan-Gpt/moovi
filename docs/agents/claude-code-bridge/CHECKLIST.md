# Claude Code bridge: the checklist

> **Live progress is on branch `claude-code-bridge`:** https://github.com/Ishaan-Gpt/moovi/tree/claude-code-bridge/docs/agents/claude-code-bridge (this copy on main is a snapshot; the branch is updated after every item).

Same numbering Vignesh has on WhatsApp (items 1 to 29). Sub-items (3a, 8b, ...) are the steps inside an item.
Plan: `../research/mcp-claude-code-bridge-plan.md` (sections 16 to 23 win over earlier ones). Owner: Tab.
Rules: pull main before every item; study before code; tests per item; `tsc` per package and the full engine suite green
before each push; merge commits to main, never force; never touch `styles/`, `packages/library/src/kits/`, `apps/`,
`packages/ui`, `packages/brand`, `packages/character`, BOARD/PLAN/CLAUDE1/STATUS/README.
Status: `[ ]` open, `[~]` in progress, `[x]` done (the commit is in LOG.md). **V** = a test for Vignesh (P = needs his Pro Claude Code).

## Phase 0: study

| # | Item | Done means | Proof | V |
|---|---|---|---|---|
| 1 | [x] Map the ~45 AI calls: Claude Code vs Moovi | every `ask()`/`run`/`complete` call site tagged BRAIN or SERVER | plan section 23.1 | |
| 2 | [x] Read the STAGE-1 split | owner map and W3 (two brains) folded into the plan | plan section 22, HANDOFF | |
| 3 | [x] Freeze the "direct the edit" JSON shape | zod schema + JSON Schema with enums read from the live menus (looks, cleanup, moves, cards, caption looks); one example answer | `edit/direct.schema.ts` (`EXAMPLE_DIRECTION`, `readDirection`, `directEditJsonSchema`); `test/direct-edit.test.ts` 5 tests | |
| 3a | [x] Read the menus at call time | style ids, cleanup levels, move ids, card kinds, caption looks come from the engine's own registries | unit: menu lists match the registries | |
| 4 | [x] Freeze the "direct the film" JSON shape | the chosen style's own brief schema (Launch first), wrapped with style pick + why + model | `router/direct-film.schema.ts` (`FILM_BRIEFS`, `EXAMPLE_FILM`, `readFilmDirection`); `test/direct-film.test.ts` 6 tests | |
| 5 | [x] Token budget per video | 10k in / 2.5k out max per video, per-call caps (plan 23.3), an estimator and a trimmer | `runtime/budget.ts` (`BRAIN_CAPS`, `VIDEO_CAP`, `estimateTokens`, `trimTranscript`, `VideoBudget`); `test/budget.test.ts` 6 tests | |
| 6 | [x] CHECKLIST, HANDOFF and LOG in the repo | this folder on main | LOG.md | |

## Phase 1: bridge

| # | Item | Done means | Proof | V |
|---|---|---|---|---|
| 7 | [x] One switch for every AI call (Claude Code / key / wait) | `LANE_ORDER`, `pickLane`, `BRAIN_AGENTS`, `laneRuntime`, `brainMode()` in `engine/src/runtime/lane.ts`; `registerBrainScope` in `keys.ts` (asked before the own key) | `test/lane.test.ts` 7 tests: every lane combination, never throws, 120 s pickup moves on | |
| 8 | [x] Job queue saving every step and answer | `packages/mcp`: `StepQueue` (steps on FalkorDB's Redis side under `ce:brain:`, or in memory), memo 24 h by `fingerprint`, `bridgeRuntime` (brain agents only, memo first, 120 s pickup, 5 min answer) | `packages/mcp/test/queue.test.ts` 7 tests incl. FalkorDB: second run asks nothing | |
| 9 | [x] Session lease per job | `packages/mcp/src/lease.ts` `Gate`: run tickets (`rt_`, 10 min to first use, bound to session and user), leases (`ls_`, SET NX, 2 min, refreshed per call, held for the answer window), `pull`/`submit`; exactly-once pickup key | `packages/mcp/test/lease.test.ts` 6 tests: wrong, foreign, expired lease refused; no ticket is idle; two sessions never mix; lapse then take over | |
| 10 | [x] Answer checker | `engine/src/runtime/checked.ts` `askChecked` (any lane): strict read (`readDirection`/`readFilmDirection`), one re-ask with the exact problems as history, then the rules default with "Moovi's default used for this step"; `BrainWaiting` never swallowed | `test/checked.test.ts` 5 tests; `packages/mcp/test/checked-memo.test.ts`: bad then good, the re-run asks nothing | |
| 11 | [x] Merge brain calls: 2 per edit, 1 per generate | `edit/direct.ts` `directEdit` (budget-trimmed step, `askChecked`, `overridesOf` to `BuildInput.tags`/`laws`/`style.look`, moves, template); `router/direct-film.ts` `directFilm` + `launchRecord`; BRAIN 2 (final look) still open | `test/direct-run.test.ts` 6, `test/direct-film-run.test.ts` 3: same direction gives a byte-identical EDL; only `direct:edit` reaches the bridge | |
| 11a | [~] Hook in `edit/job.ts` for the direction | `PlanInput.direction` done (noted in TAB.md); the Launch hook in `launch/brief.ts` is proposed in TAB.md and waits for Ishaan | engine suite green | |
| 12 | [x] Tests: lane, lease, two sessions, bad answer, timeout | all in `packages/mcp/test`; end to end in `bridge-e2e.test.ts` with `scope.ts` (`Presence`, `brainScope`) | test counts in LOG.md | `bridge-e2e.test.ts` 5 |
| 13 | [x] Pull Ishaan, tsc, full suite, push | main merged, every package typechecks, engine + mcp suites green | LOG.md line with sha | |

## Phase 2: connection

| # | Item | Done means | Proof | V |
|---|---|---|---|---|
| 14 | [x] `/mcp` endpoint | `packages/mcp/src/http.ts` `mcpHandler`/`bridgeHttp`: streamable HTTP at `/mcp`, bearer on every request, one MCP session per Claude Code window bound to the token's user (403 for another user, 401 closes a revoked one, 404 means reconnect), idle sweep; `poll.ts` `longPoll` (45 s cap, progress every 10 s); `server.ts` `buildMcp`, `hub.ts` `BrainHub` | `test/http.test.ts` (5): SDK client over HTTP | |
| 15 | [x] Connect Claude Code token per user, revocable | `packages/mcp/src/tokens.ts` `TokenStore` (mint shown once inside the command, sha256 stored, re-mint replaces, revoke, last seen); `api.ts` `brainApi` (`POST`/`DELETE /api/brain/link`, `GET /api/brain/status`, web standard handlers) and `sessionCookieAuth` (the studio cookie, same-site writes) | `test/tokens.test.ts` (5): unit + HTTP with a real client | |
| 16 | [x] `moovi_next` / `moovi_answer` | `server.ts` `moovi_next` (long poll; idle without ticket or when another window holds the video; working, waiting, done with link, failed) and `moovi_answer` (shape precheck, lease, idempotent, next step in the same call); `board.ts` `JobBoard`; `hub.register()` with engine hooks in `keys.ts` (`primeBrainScope`, `brainRun`, `brainLinked`) called from `worker.ts` and `chat.ts` | `test/tools.test.ts` (4): SDK client over HTTP | |
| 17 | [x] `/moovi:run` served from the server | MCP prompt `run` in `server.ts` (`runPrompt`): getting it mints and binds the run ticket to that window; nothing to install (it comes with the server, added once with `--scope user`) | `test/prompt.test.ts`: SDK client lists and gets the prompt | |
| 18 | [x] Real test client proof end to end on a short clip | `src/app.ts` `bridgeApp` (`/mcp`, `/api/brain/*`, `/connect` stand-in page, `/healthz`) and `falkorStore`; `scripts/serve.ts` (`pnpm dev:bridge`, hosts the engine worker); `scripts/e2e.ts` (`pnpm --filter @moovi/mcp e2e`): SDK client is the only brain of a real upload edit of `ishaan-test.mp4` for a keyless user on FalkorDB; one `direct:edit` step on lane `claude-code`, 7 calls, about 2.7k tokens, mp4 1080x1920 19 s (LOG.md); presence writes throttled to one per 10 s | `test/app.test.ts` (2), `test/presence.test.ts` (1), and the e2e script (needs a speech key) | |
| 19 | [ ] VIGNESH: connect + `/moovi:run` on his laptop | the copied command works; one video made through his Claude Code | `TEST-WITH-CLAUDE-CODE.md` steps 1 to 8 | P |

## Phase 3: safety

| # | Item | Done means | Proof | V |
|---|---|---|---|---|
| 20 | [x] Pause and resume across sessions | parked job resumes from a new session, nothing asked twice; a dropped window's open step is taken over 2 min after its last call (at once after a clean close); a polling window keeps its video | `packages/mcp/test/resume.test.ts` (5): takeover of the same step, late answer refused, park then rerun replays from the memo and asks only the new step, clean close, keep alive, memo 24 h | |
| 21 | [ ] Same plan from 2 folders | two sessions, same answers, byte-identical EDL | e2e test | |
| 22 | [ ] Junk CLAUDE.md has no effect | strict steps, server checks; manual check with the real `claude` | manual + schema test | P |
| 23 | [ ] All 12 failure cases | each row of plan section 17 has a test or a manual check | tests + LOG.md | |
| 24 | [x] Online Claude Code first, key fallback after 120 s | lane switch mid job keeps the memo; no key and no server model allowed: the step waits 10 min (`WAIT_MS`) for a `/moovi:run` in any window, then the job parks; a connected but never polled keyless user is linked, not refused | `packages/mcp/test/lanes.test.ts` (7, fake clocks), `engine/test/lane.test.ts` (wait lane) | |
| 25 | [ ] VIGNESH: close mid job, reopen in another folder | the video finishes, nothing asked twice | manual sheet steps 9, 10, 11b | P |

## Phase 4: finish

| # | Item | Done means | Proof | V |
|---|---|---|---|---|
| 26 | [ ] Live steps with timings | one row per agent, details folded; needs Ishaan's 5 UI pieces (`UI-HOOKS.md`) | studio shows it | V |
| 27 | [ ] Measure real tokens and seconds | per video vs plan 23.4 | LOG.md | P |
| 28 | [ ] VIGNESH: the 13-step Pro sheet | plan section 20, all boxes ticked | his notes | P |
| 29 | [ ] Final HANDOFF, docs and merge | README in `packages/mcp`, HANDOFF exact, merged to main | LOG.md | |

Server-side no-key work that sits under these items (needed for a keyless account): local Whisper in `hear.ts`
(with 18), Kokoro voice for generation (with 4/11), Hinglish from a table (with 11).
