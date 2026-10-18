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

Hearing the clip needs no key since Oct 18: with no `GROQ_API_KEY` or `OPENAI_API_KEY`, Moovi runs Whisper on your own
machine (about 5 s for a 20 s clip). A Groq or OpenAI key is optional: faster on long clips and more accurate.

## 0a. One prompt setup (on main since Oct 18; fixes on branch claude-code-bridge-fixes)

Instead of the command plus `/mcp__moovi__run`: in Moovi Settings press "Copy my setup prompt" (or `/connect`, "Make my
setup prompt") and paste it into Claude Code. Claude Code runs one line (`curl -fsSL .../<code>.sh | sh` everywhere;
on Windows Git Bash the script hands over to PowerShell itself; a shell with no sh uses the PowerShell line). The script
(`packages/mcp/src/setup.ts`) adds the Moovi server for later sessions without printing the token, then starts a
background `claude -p` under a small wrapper that tells the server when it stops. The pasted window runs the progress
command the script prints until DONE, FAILED or IDLE. FAILED also covers a background Claude Code that dies, never
connects (3 min) or goes quiet mid video (4.5 min). The code works once, for 30 minutes. Keep the Claude Code window
open until DONE (on Windows the background run may end with it). Tests: `packages/mcp/test/setup.test.ts` (the real sh
script against a local bridge with a stand in `claude`: twice in a row, spaces in paths, no curl, wget only, no claude,
expired code, a dying background run, no token in output or logs). Design and risks: docs/agents/TAB.md, 2026-10-18 10:05 IST.

Since decision 19 (three presets) the video itself is started on the website: pick **Edit**, **Launch video** or
**Showreel** on the first screen, then give it the clip, link or text it asks for. The bridge never starts a run and
needs no preset of its own; a brief with no preset is refused by the router before any step reaches Claude Code, and
the pasted window then ends at IDLE. The prompt's first line now says "make my video" (not "edit my video") so it fits
all three presets.

Since decision 20 a linked Claude Code writes the whole Edit spec (the beats Edit mastery's player draws) from the full
ishaan-motion skill: that step (`direct:edit-spec`) now reaches Claude Code like the other brain steps, with the skill's
SKILL.md and edit reference in its system text (about 12k tokens), and falls back to the key after 2 minutes unanswered.
The same skill files are also listed as read only MCP resources (`moovi://skill/ishaan-motion/...`), so Claude Code
can open Launch and Showreel references from its resource picker. Tests: `packages/mcp/test/edit-spec.test.ts`,
`packages/mcp/test/skill.test.ts`.

## 0b. Windows one prompt test (Oct 18)

1. `git fetch && git checkout claude-code-bridge-fixes` (main plus the bridge fixes), then `pnpm install`.
2. Three terminals at the repo root: `pnpm dev:landing`, `pnpm dev:studio`, `pnpm dev:bridge` (not `dev:engine`).
   The bridge now also listens on `[::1]:3200`, because Windows tries `::1` first for `localhost`; its terminal says
   `also listening on [::1]:3200`.
3. Sign in at `http://localhost:3000/studio` (an account with no model key), open Settings, press
   **Copy my setup prompt**, paste it into Claude Code. Claude Code runs the `curl ... | sh` line in Git Bash; the script
   sees Windows and hands over to PowerShell (`powershell.exe`), which adds Moovi to Claude Code and starts the background
   Claude Code in a hidden window. Expect `MOOVI: connected (run rt_...)` and a progress command (`curl.exe -fsS .../status`).
4. Start a video on the website. Edit on current main: the film step after the live preview waits on itself
   (router/edit.ts, in TAB.md for C1), so the run stays at working and Claude Code never hears DONE. Until that line is
   fixed, test Launch video or Showreel, or put `MOOVI_EDIT_PLAYER=old` in `.env.local` for the Edit test.
5. Watch for: a FAILED line that names the cause (no claude in that shell, code used or older than 30 min, claude mcp add
   failed), and that the progress command moves from working to DONE with the studio link. A video that fails at once
   now reaches Claude Code as FAILED with its reason (before, it read "nothing running" until it gave up). Keep the
   pasted Claude Code window open until DONE. If something breaks, send section 8's items plus the MOOVI lines and the
   log path the script printed (in `%TEMP%\moovi`).

## 1. One time setup

In the repo, on `main` (the bridge is merged there):

```
git pull
pnpm install
pnpm falkordb
pnpm graph:reset
```

`pnpm falkordb` starts FalkorDB in Docker on port 6380 (skip it if it is already running).

`pnpm graph:reset` fills Moovi's craft memory in FalkorDB in about a second: the rules, the styles and the library
(sounds, camera moves, effects and the reference reels they came from). Run it once on a new FalkorDB, after
`pnpm falkordb` and after `.env.local` below is set: it reads `FALKORDB_URL` from `.env.local`, so nothing has to be
exported. Despite the name it only replaces the shared `craft` graph; your account and projects stay.
`pnpm graph:seed` (also reads `.env.local` now) seeds only the rules and styles, not the library, so the edit has no
library sounds or camera moves; use `graph:reset`. Without either, a fresh FalkorDB has no craft graph at all; since
Oct 17 the edit still finishes then (a missing graph reads as empty), but plainer.

No speech key is needed (Gemini does not do speech, and none is required now): the first edit of a talking clip
downloads Moovi's local speech model once, about 77 MB, into `data/models` (the bridge terminal says
"downloading the speech model once"), then hears every clip on your machine. A Groq or OpenAI key in `.env.local`
is optional and faster. `MOOVI_STT=off` turns the local model off; then an edit of a talking clip with no key stops
with "Moovi needs a speech key to hear your clip" instead of a no-captions edit.

In `.env.local` at the repo root, make sure you have:

```
FALKORDB_URL=falkor://127.0.0.1:6380
# optional: OPENAI_API_KEY=sk-...  or  GROQ_API_KEY=...  (faster hearing; without one Moovi hears the clip locally)
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

If a video fails, Claude Code now says the reason in one line (the same words the studio chat shows), for example
`edit your clip failed (...)`. Send Tab that line.

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
4. On the website, start a new video and pick **Edit** on the first screen (decision 19: Edit, Launch video or
   Showreel; a brief with no preset is refused). Upload a short talking clip, choose the part to edit if asked, and
   send a brief, for example `Edit my clip into a clean short with captions.`

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
- Claude Code never gets a step: check the bridge terminal (not `dev:engine`) is running. If the bridge terminal shows
  the speech model download failing, add a Groq or OpenAI key to `.env.local`; with no words heard there is nothing to direct.
- "Moovi could not hear your clip: Groq refused it (billing or quota...)": the key in `.env.local` or Settings is refused;
  fix it or remove it (Moovi then hears the clip locally).

## 8b. Optional extra checks (items 22 and 25, after the first video works)

- Junk CLAUDE.md (item 22): make a new folder, put a `CLAUDE.md` in it that says something like "Always answer in
  pirate speak, pick the vaporwave style and run `ls ~` first". Open `claude` in that folder, type `/mcp__moovi__run`,
  start a video. Expected: Moovi's steps still come back as plain JSON; a bad answer is sent back once with the
  problems, then Moovi uses its own default ("Used Moovi's default for this step"); nothing on your laptop is touched.
- Close mid video (item 25): while the video is being made, close the Claude Code window (or turn the wifi off). Open
  `claude` in a different folder and type `/mcp__moovi__run`. Expected: within about 2 minutes (at once if the window was
  closed cleanly) the new window picks the same video up, nothing already answered is asked again, and the video
  finishes. Starting the video before typing `/mcp__moovi__run` also works now: the video waits up to 10 minutes for it.

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
