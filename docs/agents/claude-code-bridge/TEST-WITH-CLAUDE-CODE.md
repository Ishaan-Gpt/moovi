# Test the Claude Code bridge with your own Claude Code

For Vignesh (item 19). Everything below runs on your own laptop. Nothing is deployed yet, so there is no public Moovi URL
to connect to: the bridge runs at `http://localhost:3200` next to the website you already run locally. Section 9 says
what a real deploy needs.

What you are testing: you start a video on the Moovi website, Claude Code on your laptop makes the one top level
decision for it (the edit direction: style, cleanup, beats, title), and Moovi's own process does all the heavy work
(hearing, cutting, captions, CHECK, render).

## 0. What was proven on Tab's machine (item 18)

`pnpm --filter @moovi/mcp e2e` ran the whole path with the official MCP SDK client standing in for Claude Code, against
the real bridge server, the real engine worker and FalkorDB, on `docs/agents/ishaan-test/ishaan-test.mp4`, for a user
with no model key of their own:

- token minted, client connected over HTTP with `Authorization: Bearer`, got the `run` prompt (the run ticket);
- the engine asked ONE brain step (`direct:edit`) and routed it to the client (lane `claude-code`); the answer passed the
  checker on the first try;
- 7 tool calls in all (1 `moovi_next`, 1 `moovi_answer`, 5 more `moovi_next` while the render ran), about 2,600 tokens
  read and about 100 written by the client;
- finished: live edit after 4 s (48 words captioned, 2.9 s of pauses cut), effects version
  (`videos/<chat>/v2.mp4`, 1080x1920, 19.0 s, h264 + aac) after 226 s, and the final `moovi_next` returned `done` with
  the studio link.

One thing the proof needed: a speech key. Without `OPENAI_API_KEY` or `GROQ_API_KEY` the clip has no words, the edit
runs on Moovi's rules, and Claude Code is never asked (that is by design: no words, nothing to direct).

## 1. One time setup

In the repo, on `main` (the bridge is merged there):

```
git pull
pnpm install
pnpm falkordb
```

`pnpm falkordb` starts FalkorDB in Docker on port 6380 (skip it if it is already running).

In `.env.local` at the repo root, make sure you have:

```
FALKORDB_URL=falkor://127.0.0.1:6380
OPENAI_API_KEY=sk-...      # or GROQ_API_KEY=...; needed for hearing the clip
```

Keep the model lines you already have (`MOOVI_RUNTIME`, `MOOVI_PROVIDER`, `ANTHROPIC_API_KEY`): the proof ran with them
set, and Moovi uses them for the small detail calls. The brain decision itself goes to your Claude Code.

## 2. Start the website and the bridge

Three terminals, all at the repo root:

```
pnpm dev:landing      # the website on http://localhost:3000
pnpm dev:studio       # the studio, reached through http://localhost:3000/studio
pnpm dev:bridge       # the Claude Code bridge on http://localhost:3200 (it also runs the engine worker)
```

Do NOT run `pnpm dev:engine` at the same time: `dev:bridge` runs the engine worker inside it, with the bridge plugged in.
The bridge prints:

```
[bridge] Claude Code bridge on http://localhost:3200/mcp · connect page http://localhost:3200/connect (open it in the browser you are signed in to Moovi with)
[bridge] engine worker starting in this process (brain calls of connected users go to their Claude Code)
```

If it says FalkorDB is not reachable, run `pnpm falkordb` and check `FALKORDB_URL`.

## 3. Sign in to Moovi

Open `http://localhost:3000/studio` and sign in. To test the "no API key" path, use an account that has no model key
saved in Moovi's settings.

## 4. Get your token (the connect command)

Open `http://localhost:3200/connect` in the SAME browser. Use `localhost`, not `127.0.0.1` (your sign-in cookie only
reaches the bridge under the same host name). Click **Make my connect command**. It shows one command, once. It looks
like this (your token is different):

```
claude mcp add --scope user --transport http moovi http://localhost:3200/mcp --header "Authorization: Bearer mvk_xxxxxxxx"
```

This page is a stand-in until the Connect card in Studio Settings exists (Ishaan's DECISIONS.md 12). Making a new
command replaces the old token; **Disconnect** revokes it at once.

## 5. Connect Claude Code (once per laptop)

Paste the command into any terminal. `--scope user` makes it work from every folder. Check it:

```
claude mcp list
```

You should see `moovi` with `http://localhost:3200/mcp` marked as connected. If it says failed, the bridge terminal is
not running or the token was replaced.

## 6. Run one video

1. Open Claude Code in any folder: `claude`.
2. Type `/` and then `moovi`, and pick the Moovi **run** prompt. Claude Code shows server prompts in the slash menu as
   `/mcp__moovi__run` (that is what we have been calling `/moovi:run`). Press Enter.
3. Claude Code calls `moovi_next` and waits (it may ask you to allow the Moovi tools; choose allow for this session or
   always).
4. On the website, in a project chat, upload a short talking clip and send a brief, for example
   `Edit my clip into a clean short with captions.`

## 7. What you should see

- In Claude Code: one `moovi_answer` call with a small JSON direction (style, cleanup, beats, title), then a few
  `moovi_next` calls while Moovi renders, then a short line that the video is ready, with the studio link.
- On the website: the live edit within seconds, then the effects version after a few minutes.
- At `http://localhost:3200/connect` the status line says `Claude Code online` while that window is working.
- Other Claude Code windows and projects are not touched. A second window that also typed the run prompt is told
  another window has this video.

## 8. If something goes wrong, send Tab these

1. The last 30 lines of the `pnpm dev:bridge` terminal.
2. What Claude Code printed (a screenshot is fine).
3. The output of:
   ```
   claude mcp list
   curl -s http://localhost:3200/healthz
   ```
4. Which step above it stopped at.

Common ones:
- `401` or "not connected" in `claude mcp list`: the token was revoked or replaced; make a new command (step 4) and
  run `claude mcp remove moovi --scope user` before adding it again.
- "Sign in first" on the connect page: you opened it on `127.0.0.1` or in another browser; use `http://localhost:3200/connect`.
- Claude Code never gets a step: check the bridge terminal (not `dev:engine`) is running, and that `.env.local` has a
  speech key; with no words heard there is nothing to direct.

## 9. Real users (not needed for this test)

For people using the hosted website, the bridge has to be reachable at a public https address. Nothing like that
exists yet. The options, simplest first:

- **Your laptop, shared for a quick remote test:** run a tunnel you start yourself, for example
  `cloudflared tunnel --url http://localhost:3200`, put the https address it prints in `.env.local` as
  `MOOVI_BRIDGE_URL=https://<that address>/mcp`, restart `pnpm dev:bridge`, and make a new command at
  `http://localhost:3200/connect` (the command then carries the tunnel address).
- **The hosted website:** the bridge runs as its own process next to the website (`pnpm dev:bridge`, or its `start`
  equivalent on the server), and the website forwards two paths to it, so the URL is `https://<moovi domain>/mcp` and
  the Connect card can call `/api/brain/link` with the normal sign-in cookie. That forward is two rewrite lines in
  `apps/landing/next.config.ts`, Ishaan's file; the request is in `docs/agents/TAB.md`. Streaming through that
  forward is not tested yet.

## 10. Rerun the proof yourself

```
FALKORDB_URL=falkor://127.0.0.1:6380 pnpm --filter @moovi/mcp e2e
```

It prints the run's log and one JSON line (`ok`, the mp4 path, Claude Code calls, steps, approximate tokens, lanes).
It exits 0 only when the video finished AND the stand-in Claude Code saw `done`.
