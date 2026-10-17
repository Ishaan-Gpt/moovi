# Bridge item 27: measured tokens and seconds per video

Measured 2026-10-17 on Tab's box (8 GB, 4 CPUs, shared with other work) with the item 18 harness:
`pnpm --filter @moovi/mcp e2e [clip]` with `E2E_BRAIN=model E2E_COUNT=exact`. A real MCP client connects over HTTP
with a minted token and is the only brain; each step is answered by a real Claude model (claude-sonnet-4-5 through the
machine's model door) from the exact tool text Claude Code would read. Hearing used the server's OpenAI speech key
(real transcripts, nothing faked). Tokens are the provider's own `count_tokens` on every text the client read and
wrote (message wrapper removed), not chars/4.

What this is not: it is not Claude Code itself. Claude Code adds its own system prompt and re-reads its whole context
on every tool turn; that is the user's Pro quota, outside Moovi's budget, and not measured here. Vignesh's own run
(items 19, 25) gives the real Claude Code think time.

## Runs

| Run | Clip | Brain steps | Tool calls | First step | Model think | Live edit | Final render |
|---|---|---|---|---|---|---|---|
| 1 | ishaan-test.mp4, 19.0 s | 1 (`direct:edit`, first try) | 7 (1 step, 1 answer, 5 polls) | 3.9 s | 4.4 s | 8.6 s | 231.9 s |
| 2 | same clip, same user again | 0 (the saved answer replayed, item 20 memo) | 6 (all polls) | none | none | 3.3 s | 232.7 s |
| 3 | vignesh-raw-1.mp4, 29.7 s | 1 (`direct:edit`, first try) | 9 (1 step, 1 answer, 7 polls) | 4.3 s | 4.9 s | 9.7 s | 345.2 s |

Times are seconds from the brief (upload already in place, as on the site). "Live edit" is the first `video` event
with `live: true`; "final render" is the effects version (v2, 1080x1920).

## Tokens per video vs plan 23.3 (exact counts)

| | Run 1 (19 s) | Run 3 (30 s) | Cap | Plan "typical" |
|---|---|---|---|---|
| Edit step read (`moovi_next` think) | 2,778 | 2,745 | 6,000 | about 2,500 |
| Answer written (`moovi_answer`) | 199 | 184 | 1,200 | about 500 |
| Run prompt | 248 | 254 | | |
| Tool descriptions (Moovi's 3 tools) | 506 (see note) | 506 | | |
| Fixed per `/moovi:run` | about 750 | 760 | RUN_OVERHEAD 1,000 | about 1,000 |
| Polls while rendering | 193 in, 30 out (5) | 249 in, 42 out (7) | | |
| **Per video in** | **about 3,770** | **3,803** | **10,000** | about 4,000 |
| **Per video out** | **248** | **248** | **2,500** | about 700 |

Run 1 counted the tool descriptions as 1,002 including the provider's own tool-use preamble (about 500 tokens that any
tool-using client already pays; Claude Code always has tools); run 3 counts only Moovi's share (506). Run 1's per
video in with the preamble was 4,268. The real model's own usage matched: 2,836 in / 282 out (run 1), 2,803 in / 258
out (run 3), including a one-line system prompt of ours.

Nothing is over budget. Every number is under its cap with room: per video in at 38 percent, out at 10 percent.

## Seconds vs plan 23.4

| Stage | Plan estimate | Measured |
|---|---|---|
| Hear, faces, shots before the brain step | 20 to 40 s | 3.9 to 4.3 s to the first step |
| BRAIN 1 | 10 to 30 s | 4.4 to 4.9 s for a model answering the raw step (Claude Code's own think time: not measured, Vignesh's test) |
| Live edit | (not in the plan) | 8.6 s (19 s clip), 9.7 s (30 s clip); 3.3 s when the answer is replayed |
| Build, captions, CHECK, render | 40 to 90 s | the effects version took 223 s and 335 s after the live edit |
| Total to final | about 1.5 to 3 min | 3.9 min (19 s clip), 5.8 min (30 s clip): **over the estimate** |

## Flags

1. **Final render is over the 23.4 estimate** (3.9 and 5.8 min against 1.5 to 3). The time is the server's effects
   render (frames, masks, Chrome capture, encode), not the brain: Claude Code's share is one step of about 5 s. The
   box was shared with other work, so a dedicated machine may be faster (estimated, not measured). Not a bridge fix;
   the live edit already plays at under 10 s. Raised for Ishaan in `docs/agents/TAB.md`.
2. **The server's token estimate ran low; fixed.** `estimateTokens` (budget.ts) promised to estimate high but came in
   11 to 22 percent under the provider's count on what a step carries (the edit step 2,348 estimated vs 2,624 counted;
   its JSON schema 667 vs 770; Hinglish 32 vs 41). Near a cap that would let a real step go over. Now 2.8 characters per
   token for ASCII and 1.3 for the rest: at or above the count on every sample (2 to 28 percent high). Test:
   `engine/test/budget.test.ts` "budget 27" with the counted samples. A 30 s clip still goes out whole (about 3,000
   estimated against 6,000). The film step (`router/direct-film.ts`) cut its source at a fixed 3 characters per token,
   which overshot the cap under the higher estimate (`direct-film 11` failed at 5,173); it now cuts by the same
   estimate. A film step filled to its cap: 4,953 estimated, 3,827 counted (cap 5,000); with the sample source alone:
   1,926 estimated, 1,612 counted. No `direct:film` run was measured end to end (the e2e is an upload edit).
3. **Polls cost a little and scale with render time**: one `moovi_next` per 45 s while rendering (5 to 7 per video,
   about 35 tokens each in Moovi's terms). In Claude Code each poll is a whole tool turn that re-reads its context, so
   a 6 min render is about 8 turns of the user's quota. A longer wait per poll would cut that; left as is (Claude Code's
   tool timeout is not verified yet, plan 19).
4. **Known gaps still apply**: no keyframes go out with the edit step yet and BRAIN 2 (final look) is not wired, so
   these numbers are one brain call per video. With 3 keyframes at 256 px (about 450 tokens) and BRAIN 2 (cap 2,000)
   the per video in would be about 6,300 (estimated), still under 10,000.

## How to rerun

```
cd packages/mcp
FALKORDB_URL=falkor://127.0.0.1:6380 OPENAI_API_KEY=... E2E_BRAIN=model E2E_COUNT=exact E2E_OUT=/tmp/m.json \
  pnpm e2e [clip.mp4]
```
`E2E_BRAIN=model` needs ANTHROPIC_API_KEY (and MOOVI_BASE_URL if it goes through a proxy). The same clip twice for
the same user replays the saved answer (run 2); use another clip or user for a fresh step.
