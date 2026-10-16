# Agent board

Three agents work on Moovi at once. This folder is where they talk, research and hand work to each other.

| Agent | Who it is | Master | Log file | Load |
|---|---|---|---|---|
| **Claude 1** | Ishaan's Claude Code | Ishaan | `CLAUDE1.md` | Main. Lead planner; owns the plan and the integration on `main`. |
| **Tab** | Vignesh's Tab agent | Vignesh | `TAB.md` | Main. Pipeline, editing engine, tests, merges, speed. |
| **Claude 2** | Vignesh's Claude Code | Vignesh | `CLAUDE2.md` | Light. Small, well-scoped tasks. (Its log from 2026-10-16 night was `CLAUDE.md`; renamed, history kept.) |

The product goal and the two-day plan live in `PLAN.md`. Open work lives in `BOARD.md`. Research lives in `research/`.

## Files

- `CLAUDE1.md`, `TAB.md`, `CLAUDE2.md`: **each agent edits only its own log.** Newest entry on top. One session per
  agent: if a master opens a second session, it reads the board but does not write to that agent's log.
- `BOARD.md`: the shared task board. Anyone may add a task. You change only the rows you own, or claim an
  unowned row by putting your name on it. Never change another agent's row; ask in your log instead.
- `research/<topic>.md`: one file per research topic, written by its owner. Others add questions under a
  `## Questions from <agent>` heading at the end, nothing else.
- `PLAN.md`: written by Claude 1. Others propose changes in their log; Claude 1 folds them in.

## An entry in your log

```
## 2026-10-16 09:30 IST · <branch> · <sha or "no code">
**Did:** what changed, with paths.
**Found:** anything another agent should know.
**Asks:** @Tab / @Claude1 / @Claude2: one request per line, each one doable.
**Answering:** @Agent's 09:10 ask: the answer.
```

Use real IST time. On Windows Git Bash `TZ=Asia/Kolkata` is ignored and prints UTC; use `date -u -d "+5 hours 30 minutes" "+%Y-%m-%d %H:%M IST"`. Address asks with `@Name`. An ask is answered in the asked agent's own
log, quoting the time of the ask.

## Rhythm

1. **Pull first, every time.** `git pull --rebase` before reading or writing the board.
2. Read the other two logs and `BOARD.md` at the start of every session and at least every 45 minutes.
3. Post when you start a task, when you finish it, and when you are blocked. Short entries, often.
4. Board-only commits (`docs/agents/**`) go straight to `main` with a `docs(agents):` message and are pushed at
   once, so the others see them. Pull again if the push is rejected; never force-push.

## Code

- Feature work on branches: `ishaan/<feature>` (Claude 1), `vignesh/<feature>` (Tab, Claude 2).
- Tab merges Vignesh-side branches into `vignesh/agent-main`. Claude 1 merges `vignesh/agent-main` and
  `ishaan/*` into `main` after `pnpm typecheck` and tests pass, and posts the sha.
- Two agents never edit the same files at once. Claim the files on `BOARD.md` before touching them.
- The hard rules in the root `CLAUDE.md` apply to everyone: FalkorDB stays load-bearing, colours only from
  `@moovi/brand`, no secrets committed, AI use logged in `AI_USAGE.md`, performance claims measured.
- A master's word beats the board. If Ishaan and Vignesh disagree, stop and ask both in your log.
