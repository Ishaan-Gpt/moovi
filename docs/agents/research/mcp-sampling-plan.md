# Moovi over MCP: research and plan (zero Moovi API key)

Owner: Tab (worker) · 2026-10-17 · status: PLAN ONLY, nothing built or pushed yet.
Goal (Vignesh, 6:38 and 6:40 PM IST): someone adds Moovi to Claude Code (or Desktop, Cursor, VS Code) and Moovi works
exactly as it does today, but every model decision is made by THEIR client's model. No Moovi key, no reduced mode.

## 1. Which clients can do MCP sampling today (checked 2026-10-17)

| Client | sampling/createMessage | Source |
|---|---|---|
| Claude Code | No | Feature request still open: github.com/anthropics/claude-code/issues/1785 (since Jun 2025). The MCP docs (code.claude.com/docs/en/mcp) and the full CHANGELOG (to v2.1.302) never mention sampling; they do list elicitation and images in tool results. |
| Claude Desktop | No | Official client matrix (github.com/modelcontextprotocol/docs clients.mdx): Sampling ❌. Never shipped (see spec note). |
| Cursor | No | cursor.com/docs/mcp "Protocol and extension support": Tools, Prompts, Resources, Roots, Elicitation, Apps; no sampling. Open request: forum.cursor.com/t/mcp-sampling-support/149604 (Jan 2026). |
| VS Code (Copilot) | Yes (experimental) | code.visualstudio.com/updates/v1_101 and code.visualstudio.com/api/extension-guides/ai/mcp: uses the user's configured models; a consent prompt on first use; the user picks which models the server may use. Image input in sampling: unverified. |

The spec itself: Sampling is DEPRECATED in MCP 2026-07-28 (SEP-2577), "low adoption"; replacement named is "direct
integration with LLM provider APIs". It keeps working for at least 12 months, but new servers SHOULD NOT adopt it.
Sources: blog.modelcontextprotocol.io/posts/2026-07-28-release-candidate/ and
modelcontextprotocol.io/specification/draft/client/sampling.

Also ruled out: running the engine's existing Claude Code runtime (Agent SDK) on the user's claude.ai login. Anthropic's
Agent SDK docs: "Unless previously approved, Anthropic does not allow third party developers to offer claude.ai login or
rate limits for their products." (code.claude.com/docs/en/agent-sdk/overview)

**Conclusion:** sampling alone reaches only VS Code. The primary path must be "client as brain": the client's model
does the thinking inside its own conversation, through Moovi's tools. Sampling is an optional fast lane.

## 2. The design: one bridge runtime, zero edits to the engine's call sites

Every model call in the engine already goes through one door: `runtime()` in `packages/engine/src/runtime/index.ts`
(`ask()`, `runWithFallback()`, `rt.run()`, `rt.complete()`), and a job can carry its own model with
`withModel(scope, fn)` (AsyncLocalStorage, built for bring your own key). About 40 agents use it (edit:beats,
review:vision, director, router:director, s1-critic, s4/s5 briefs, voice:cast, ...). So:

- `packages/mcp` adds a **BridgeRuntime** (implements the engine's `Runtime`: `run`, `complete`, `vision: true`) and runs
  every MCP job inside `withModel({ runtime: bridge, deadlineScale: 20, ... })`.
- When the engine asks a model anything, the bridge **parks that call** and hands it to the client as the result of the
  tool call in flight: `{ status: "think", call_id, agent, system, prompt, answer_schema (JSON Schema), images[] }`.
  Images (the 3 review frames, shot thumbnails) go as MCP image content blocks, which Claude Code, Desktop and Cursor show
  to their model.
- The client's model answers with `moovi_answer({ call_id, answer })`. The bridge returns it to the engine, the engine's
  own checks run (schema, coerce, validate); a bad answer comes back as the next `think` step quoting the problem (the
  engine's existing repair turns), then the job runs on to its next model call or to the finished file.
- Engine tool loops (e.g. the vision `look` tool): the bridge sends the tool list with the step; the client answers with
  `{ tool, args }` or the final submit; Moovi runs the tool server-side and returns its result (with images) as the next step.
- Same router picks the lane per run, never throws: (1) client advertises `sampling` (VS Code) → SamplingRuntime calls
  `sampling/createMessage` directly, no round trips; (2) else a Moovi or user key in env → existing httpRuntime;
  (3) else → BridgeRuntime (Claude Code, Desktop, Cursor). A failed sampling call falls to the next lane.

Result: full parity. The edit, generate, CHECK and re-edit paths are untouched; they just get their answers from the
client. When Ishaan's new templates land, they inherit it for free because they call the same `ask()`.

## 3. Tools (stdio first, streamable HTTP later)

| Tool | In | Out |
|---|---|---|
| `edit_video` | path or URL, request (plain words), style? | job_id + first `think` step or result |
| `generate_video` | type (showreel, launch, explainer, ...), brief, style? | same |
| `moovi_answer` | call_id, answer (JSON) | next `think` step, `running`, or `done` |
| `revise` | job_id, words ("tighter", "captions lower") | runs `reEdit`, then render; same stepping |
| `review` | job_id or mp4 path | CHECK report + frame paths |
| `list_styles` | none | edit styles + generation types, one line each |
| `get_status` / `get_result` | job_id | stage, last step; mp4 path, thumbnail, summary |

Every step returns within about 25 s (long poll); a job that is still rendering says `running` and the client calls
`get_status`. Output is short: paths and a 3 line summary, never the whole EDL.
Prompts (MCP prompts) `/moovi-edit` and `/moovi-generate` give users a one-line start in Claude Code.

## 4. The two things a client model cannot do, and the zero-key answer

1. **Hearing (speech to text).** Today `edit/hear.ts` and `audio/stt.ts` call Whisper on Groq or OpenAI. Claude cannot
   transcribe audio. Zero-key plan: local Whisper (whisper.cpp via a small npm binding or faster-whisper, base/small
   model, about 75 to 470 MB, downloaded on first use), used when no STT key exists; a user's Groq/OpenAI key still wins.
   The client model then only fixes names/spelling from the transcript (a normal `think` step).
2. **Speaking (voice-over for generate_video).** Today OpenAI/ElevenLabs TTS. Zero-key plan: a local TTS (Kokoro or
   Piper) as the default; a user key upgrades it. Edits of the user's own clip need no TTS.
Everything else (face finding, cuts, render, CHECK pixels) is already local code.

## 5. Phases (estimates for one worker)

1. **Bridge + router + tests** (2 to 3 h): `packages/mcp` with the SDK server, BridgeRuntime, SamplingRuntime, the lane
   picker; unit tests: sampling picked when advertised, http when keyed, bridge otherwise, never throws, a parked call
   round-trips with an image.
2. **edit_video end to end** (2 h): local STT fallback, `edit_video` / `moovi_answer` / `get_result`, one short proof
   with the SDK client acting as the brain, then with the real `claude` CLI if installed.
3. **generate_video + revise + review** (2 to 3 h), local TTS default.
4. **README + setup** (1 h): `claude mcp add moovi -- npx -y @moovi/mcp` (or `node packages/mcp/dist/index.js`),
   Claude Desktop and Cursor JSON, VS Code `.vscode/mcp.json`; which lane each client gets.
5. **Later:** streamable HTTP so the hosted studio can be a remote MCP server; MCP Apps (Claude Code, Cursor and VS Code
   render UI) to show the live preview player inside the client.

## 6. No overlap with Ishaan's rework

Ishaan's sessions are restructuring templates, styles and kits for deterministic output (NORTH-STAR §5, owners line;
his recent work: `packages/library/src/kits`, `data/refs`, camera layer, style/kit docs). None of it is pushed as a
branch yet, so the seam must not depend on file layout.

- **We add:** `packages/mcp/**` (new), one line in `docs/agents/TAB.md`, this doc. The engine already exports `withModel` and `Runtime`,
  so the bridge can live wholly in `packages/mcp`; if needed later, one new file `packages/engine/src/runtime/bridge.ts`
  (additive, the spine Tab owns). Local STT/TTS as new files under `src/audio/` behind the existing key check.
- **We never touch:** `packages/library/src/kits`, `edit/templates`, `src/styles`, `edit/styles.ts`, `apps/*`,
  `packages/ui`, brand files, BOARD/PLAN/CLAUDE1/STATUS/README.
- **How his templates plug in:** `list_styles` reads the style registry at call time; a new template is a style the
  engine already knows, and its model calls go through `ask()`, so the bridge serves them with no MCP change.

## 7. Risks

- Round trips: an edit makes about 2 to 5 model calls (beat tags, director/style pick, vision review, plus repairs), so
  2 to 5 extra tool calls in Claude Code. Fine for edits; heavier for generation styles with many calls (S1 scenes).
  Mitigation: batch independent calls into one `think` step.
- Engine deadlines (12 s beat tags, review vision timeout) assume an API: the bridge scope raises `deadlineScale`, and
  the review's own timeout needs the same scale (one config read, no logic change).
- Context cost in the client: steps stay small (transcript lines, 3 frames at 360 px), never the full EDL.
- Users must approve each Moovi tool call unless they allow it once (Claude Code permission prompt).
- Spec churn: sampling is deprecated, so the bridge (plain tools) is also the future-proof path.

## 8. Recommendation

Build the bridge first (phase 1 and 2): it is the only path that serves Claude Code, Desktop and Cursor with zero key,
it reuses the engine's single model door so nothing in Ishaan's area moves, and sampling becomes a small extra lane for
VS Code. First proof: `edit_video` on a 15 s clip from Claude Code, with every decision made by Claude Code's model.

## 9. Client facts that shape the bridge (Claude Code docs, code.claude.com/docs/en/mcp, read 2026-10-17)

- Tool timeout: stdio tool calls default to about 28 hours (MCP_TOOL_TIMEOUT, or a per-server "timeout" in .mcp.json),
  so a render step can block; we still long-poll at about 25 s so the user sees progress.
- Output size: a warning past 10,000 tokens, a cap of 25,000 (MAX_MCP_OUTPUT_TOKENS); text past 50,000 chars is saved to
  a file. Steps must stay small.
- Images: a PNG, JPEG, GIF or WebP in a tool result is seen inline by Claude (scaled down to fit), so review frames and
  shot thumbnails reach the client model directly.
- Elicitation is supported (forms and URL mode), useful for "which style?" questions without a model turn.
- MCP Apps UI resources are skipped in Claude Code's terminal (it does not render them); Cursor and VS Code render them.
- npm: @modelcontextprotocol/sdk latest 1.32.1. The claude CLI is not installed on Tab's box (a proof from it needs an
  install or Vignesh's machine). Local STT/TTS candidates: smart-whisper 0.8.1, nodejs-whisper 0.3.1 (whisper.cpp),
  kokoro-js 1.2.1.


# REVISION 2 (Vignesh 6:46 PM IST): website-first, Claude Code as the brain

Spec: users stay on the Moovi website. A user with no API key but with Claude Code connects Claude Code to the site,
and Claude Code acts as the website's model ("Claude Code is the API key"). The engine, renders, STT and TTS all run on
our server, so section 4's gaps are ours to cover server side (hosted Whisper/TTS, or a local model on the server).

## R1. Shape

- **Remote MCP endpoint** on the Moovi server: `https://<moovi>/mcp` (streamable HTTP, `@modelcontextprotocol/sdk` 1.32.1).
- **Connect Claude Code** button on the site mints a pairing token tied to the account and shows one line (syntax from
  code.claude.com/docs/en/mcp): `claude mcp add --transport http moovi https://<moovi>/mcp --header "Authorization: Bearer <token>"`
- **Per job lane** (server side, never throws): account API key (BYOK, exists in `keys.ts`) → httpRuntime; else client
  connected with sampling (VS Code) → sampling; else linked Claude Code online → BridgeRuntime queue; else the job waits
  with a clear "connect Claude Code or add a key" message.
- The BridgeRuntime is the one from section 2: each engine model call becomes a queued "think" item for that account.

## R2. The brain loop and how reliable it is (facts from code.claude.com/docs/en/mcp)

Claude Code only acts when prompted. Options, most reliable first:

1. **User-triggered per job (recommended).** The site shows "Run in Claude Code: type /moovi:run". MCP prompts appear
   as `/moovi:<prompt>` slash commands. The prompt tells Claude to call `moovi_next` (long poll), answer each step with
   `moovi_answer`, and stop when the job is done. Website shows progress live. One job = 2 to 6 steps; context grows by a
   few thousand tokens per job (3 review frames are the biggest part), so it holds for many jobs in one session.
2. **Always-on loop** (`/moovi:connect`, Claude keeps polling forever). Works, but: HTTP tool calls need a first byte
   within 60 s and abort after 5 min idle with no progress notification, so `moovi_next` must return about every 45 s
   ("no job yet, call again"); every empty poll costs tokens forever; on auto-compaction the loop instruction can be
   summarized away (we repeat it in every tool result to survive that). It also turns Claude Code into a background
   worker for our site (see the terms below). Not recommended as the default.
3. **Channels** (an MCP server pushes events into a running session). Research preview, local stdio plugin only, needs
   `claude --channels` at startup and an allowlist (custom channels need the development flag), Team/Enterprise must
   enable it, and a channel that negotiates MCP 2026-07-28 cannot deliver. Too fragile for users today.
4. **Local `npx moovi-link` running `claude -p` per job.** Technically easy, but see the terms below: this is the clearest
   case of a third party routing its requests through a user's Claude plan. Do not ship.

## R3. Anthropic's terms (the honest risk, read 2026-10-17)

code.claude.com/docs/en/legal-and-compliance, "Authentication and credential use": OAuth (claude.ai login) "is designed
to support ordinary use of Claude Code"; "Anthropic does not permit third-party developers to offer Claude.ai login into
their own applications, or to route requests through Free, Pro, or Max plan credentials on behalf of their users." Also:
"Advertised usage limits for Pro and Max plans assume ordinary, individual usage". Consumer terms ban automated access
"except ... via an Anthropic API Key or where we otherwise explicitly permit it".

What that means for us:
- A background queue that makes a user's Pro/Max Claude Code answer our website's model calls (options 2 and 4) is very
  close to "routing requests through plan credentials on behalf of users". Risk: the user's account gets limited, and
  Moovi looks like it is reselling Claude usage.
- Option 1 is closest to ordinary use: the user, in their own Claude Code, runs a Moovi command and Claude uses Moovi's
  tools, like any MCP server (Notion, GitHub). Each job starts from the user's own prompt in Claude Code.
- If the user's Claude Code runs on a Console API key, none of this applies, but then BYOK on the site is simpler.
- Recommendation: ship option 1 + BYOK, word it as "run your Moovi edits from Claude Code", never as "Claude Code is our
  API key", and ask Anthropic (developer relations) before any always-on mode.

## R4. Website UX and the hooks we need from Ishaan (apps/* is his; we do not edit it)

Server side (ours, in `packages/mcp` + engine router): pairing tokens, `/mcp` endpoint, the per-account think queue,
connection presence (last poll time), per-step latency, a JSON API for the site.

UI hooks to ask Ishaan for in the studio:
1. Settings: a "Connect Claude Code" card (button → shows the one-line command with token, copy button, revoke).
2. A brain badge on the job: "Thinking in your Claude Code" / "Using your API key" / "Waiting for Claude Code".
3. Status pill: Claude Code online (polled in the last 60 s) / offline, from `GET /api/brain/status`.
4. Offline fallback panel on a queued job: "Open Claude Code and type /moovi:run" or "Add an API key".
5. Per-job timeline rows for each think step (agent name, seconds), from the existing event bus.
Everything else (engine, MCP, queue, STT/TTS on the server) stays out of his files.

## R5. Phases (revised)

1. BridgeRuntime + think queue + lane picker + tests (3 h).
2. Remote `/mcp` with pairing tokens, `moovi_next` / `moovi_answer`, the `/moovi:run` prompt; proof: a website edit job
   whose every model call is answered by an MCP client in a test script (Claude CLI not on Tab's box) (3 h).
3. Server STT/TTS without Moovi model keys (server-side Whisper/TTS model) so a keyless account works end to end (2 h).
4. API for Ishaan's UI hooks + README/setup (1 to 2 h).
