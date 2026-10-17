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
| 11 | [ ] Merge brain calls: 2 per edit, 1 per generate | `directEdit` fills `edit:beats` and the rule pickers' overrides; `directFilm` fills the style brief; BRAIN 2 optional | unit: same direction gives byte-identical EDL; only the allowed agents reach the bridge | |
| 11a | [ ] Hook in `edit/job.ts` for the direction | noted in Ishaan's log first; about 10 lines | engine suite green | |
| 12 | [ ] Tests: lane, lease, two sessions, bad answer, timeout | all in `packages/mcp/test` | test counts in LOG.md | |
| 13 | [ ] Pull Ishaan, tsc, full suite, push | main merged, every package typechecks, engine + mcp suites green | LOG.md line with sha | |

## Phase 2: connection

| # | Item | Done means | Proof | V |
|---|---|---|---|---|
| 14 | [ ] `/mcp` endpoint | streamable HTTP, bearer auth, 45 s long poll, progress every 10 s | SDK client over HTTP | |
| 15 | [ ] Connect Claude Code token per user, revocable | mint (shown once), sha256 stored, revoke, last seen; `/api/brain/link`, `/api/brain/status` | unit + curl | |
| 16 | [ ] `moovi_next` / `moovi_answer` | steps out, answers in, idempotent, isolation rules (plan 21) | SDK client tests | |
| 17 | [ ] `/moovi:run` served from the server | MCP prompt `run` with a one-time run ticket | SDK client lists and gets the prompt | |
| 18 | [ ] Real test client proof end to end on a short clip | SDK client as the brain edits the test clip; MP4 path, steps, tokens, lane in LOG.md | `test/e2e.test.ts` | |
| 19 | [ ] VIGNESH: connect + `/moovi:run` on his laptop | the copied command works; one video made through his Claude Code | manual sheet steps 1 to 8 | P |

## Phase 3: safety

| # | Item | Done means | Proof | V |
|---|---|---|---|---|
| 20 | [ ] Pause and resume across sessions | parked job resumes from a new session, nothing asked twice | e2e test | |
| 21 | [ ] Same plan from 2 folders | two sessions, same answers, byte-identical EDL | e2e test | |
| 22 | [ ] Junk CLAUDE.md has no effect | strict steps, server checks; manual check with the real `claude` | manual + schema test | P |
| 23 | [ ] All 12 failure cases | each row of plan section 17 has a test or a manual check | tests + LOG.md | |
| 24 | [ ] Online Claude Code first, key fallback after 120 s | lane switch mid job keeps the memo | unit + e2e | |
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
