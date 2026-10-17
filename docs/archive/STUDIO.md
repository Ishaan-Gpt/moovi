# The studio and the engine (v2, 2026-10-14)

Moovi is a video employee you hire. You give Moovi a brief (words, footage, a reference, or all three), and a crew
of real agents makes the video while you watch them work. Edits happen by talking to them. This document describes
what runs today; the approved design is the Engine Blueprint (`https://claude.ai/artifact/WZTtR6Jfqqrju3JU8Z6hM1`).

## The flow

1. **Landing** (`apps/landing`, `/`): type a prompt and/or drop footage in the brief box. The text goes to session
   storage and the files to IndexedDB (`ce-brief`), both on this origin, then the page opens `/studio/start`.
2. **Sign in or sign up** (`/studio/auth`): if you aren't signed in, the studio sends you here first and the brief
   waits ("Your brief is safe").
3. **Start** (`/studio/start`): a new project and its first chat, the files uploaded, the brief sent, then the office.
4. **The office** (`/studio/p/<project>/c/<chat>`): full screen. Every agent sits at its own desk with only its name
   and a few-word line above its head ("planning", "building scene 3", "building scenes ×4"). A monitor lights up while
   its owner works, and a bead of light travels between desks as work is handed on. Moovi is the real character
   (`@moovi/character`). On a phone the desks become a 3×3 grid seen from above.
5. **The chat** (left, glass, minimisable): your messages, the crew's replies, and the crew's work folded into one
   quiet row per stretch (open it for every step). `@` mentions Moovi, any agent, or `@video`. A question from Moovi
   comes with buttons.
6. **The video**: when it's finished it pops up over the office. Download, minimise (to a dock), or **Tweak in chat**,
   which puts `@video ` in the composer. Each chat makes one video; every edit is a new version of it.
7. **New chat**: the office blurs behind the same brief box. "Like the last one" reuses the previous video's style
   for a new script.
8. **Close project** goes to the dashboard (`/studio`): projects at the top of the sidebar, the profile at the
   bottom, and a card per project plus a "+" card.

## The shape

```
landing :3000 ──(rewrites /studio/*)──► studio :3100 (Next 16, basePath /studio: UI + a thin API)
                                          │ commands (Redis stream ce:cmd)     ▲ events (stream ce:chat:<id> → SSE)
                                          ▼                                    │
                                engine worker (packages/engine): scheduler + agents + workers
                                    │ tools                                   │ state
                       render pool (headless Chrome +                FalkorDB (graphs) + Redis (same server)
                       the bundled renderer) · audio (TypeScript:
                       edge-tts voice, SFX + bed mixer) + ffmpeg
```

- The studio never runs agents. It writes your message into the project graph, sends the engine a command, and
  streams the chat's events back to the browser. A reconnect resumes from the last stream id, so a restart loses
  nothing.
- **Graphs** (one FalkorDB server):

  | Graph | Holds |
  |---|---|
  | `craft` | Style knowledge only: skills, laws and checks, presets, flows, tracks, signatures. No client data |
  | `sys` | Users, sessions (token hashes), the project index |
  | `user_<id>` | What this user's videos used (assets, angles, presets), lessons, preferences |
  | `proj_<id>` | Chats, messages, uploads, videos, runs, tasks, facts, claims, scene programs, decisions, issues |

## A run

A brief starts a run. Its tasks live in the project graph; a task is ready when everything it depends on is done,
and is claimed with a lease by a worker slot for its resource (`llm`, `render`, `chrome`, `voice`, `audio`, `cpu`).
Fan-out stages spawn one task per item, so scenes, assets and render chunks run in parallel. A worker that dies
leaves expired leases, and those tasks go back to ready.

| Step | Who | What |
|---|---|---|
| intake | Moovi (worker) | Reads the brief by rules (format, length, language, links, "like this", "edit") and probes uploads (duration, orientation, speech, faces, cut rate): footage to edit, or a reference |
| match | worker | **Deterministic first**: scores the brief against each style's signature. If an autonomous style fits (Style 1 today), its skill drives the run; otherwise the unique-style skill does |
| plan | Moovi | A typed brief: title, angle, hook form, length, facts the user stated |
| research | Researcher ×N | Only for links in the brief; writes Fact → Source |
| script | Scribe | Beats that pass the truth guard (a claim needs a path to a fact; numbers and proof words must come from one), or it is sent back |
| voice | Voice (worker) | Kokoro TTS, then Whisper word timings |
| card / study | Art Director | The unique path: a StyleCard (stage, type, motion, sound), from the skill or from studying the reference |
| board | Art Director | One shot per beat, asset requests, and two corner assets for Style 1 |
| asset | Asset Hunter ×K | A real capture, logo or upload, judged by its own eyes (7/10 or better) and never one this user already used; for corners, one of the style's own props drawn by the renderer when nothing real fits |
| build | Shot Builder ×scenes | Writes a typed scene program, looks at its stills, runs the scene's checks, fixes, finishes. The engine re-runs the checks itself; Sonnet escalates to Opus after failed rounds; a deterministic fallback keeps the run shipping |
| assemble | Editor (worker) | Word alignment, cut guards, polish, sound events, geometry QA over the whole film |
| render ×M · sound | workers | Chunks render in parallel Chrome pages; the mix is mastered to −14 LUFS with a 4× oversampled limiter, measured until the true peak is under −1.5 dBTP |
| review | Lens | Every law as a machine check, plus its eyes on a contact sheet and on scenes up close. Blocking problems go back to that scene's Shot Builder only (with its chunks, the mix and the mux), at most twice |
| deliver · keep | Editor · Keeper | The video pops up; Keeper records the angle, presets and real assets so the next video doesn't repeat them |

## Talking to the crew

- A message after the video starts an **edit**. Moovi turns it into a scoped plan (rebuild these scenes, keep the
  voice) and starts a new run that copies everything unchanged forward. If the change needs a new script, he says so.
- `@scribe …`, `@lens …`: that agent answers from its own outputs and decisions in the project graph.
- What you tell Moovi about your taste becomes a lesson in your user graph and binds the agents it applies to.

## Quality gates (who checks what)

Laws live in the craft graph with their checks. The **Shot Builder** cannot finish a scene with: overlapping or
clipped elements, words under the phone app's own UI, lines that are too long, more than one serif accent, a camera that never moves, shown words the
voice doesn't say, dead air over 1.6 s, or a stage that is bare text for more than 1.5 s. It also can't write a
prop that is an empty shell (a badge with no logo, a phone with nothing on its screen). **Lens** re-runs all of these
on the finished film, adds loudness and true peak (measured on the delivered AAC), the truth guard on the shipped
script, corners, the hook time, the CTA, and black or frozen frames. Lens may only call text spacing after looking
at that scene up close, because the contact sheet is too small to judge it.

**Platform safe zone (law 10).** On a 9:16 video, no words may sit where Instagram, TikTok and Shorts draw their own
UI. That means the bottom 270 px (14%: caption, handle, audio row, buttons) and the right 120 px from mid-height down
(x > 960 below y 960: the like/comment/share rail), in 1080×1920 units. "Words" are lines, ui layers that carry type
(CTA pills, comment and search fields, progress pills) and props that are words (`kit.TYPE_PROPS`: a drawn pill, a
stamp, a numeral, a split-flap word). Corner assets, phones and other props may sit there. The Shot Builder can't
finish a scene with words in the zone for 0.2 s or more, and the fix-it message names the layer and how many px to
move it. The Editor checks the assembled film against the same zone from the craft graph and records it in `qa.json`.
Lens's `safeZone` check reads that file, so both apply one rule. The bounds come from rendered boxes
(`packages/engine/scripts/safezone-check.ts`, output in `data/checks/safezone/`):

- **Presets.** All 16 presets, with short and longest-allowed lines (34 cases), keep their words above y 1547 (the
  lowest is the `icon_ring` footer). Two put words on the rail and were narrowed: the `cta_comment` reply bubble
  (x 994 at y 990–1132, now 932) and the `flip` board with long words ("EVERYTHING" reached x 1031 at y 912–1073,
  now 949).
- **Delivered films (8).** The rule finds 27 problems in 7 of the 8 films. 13 are in the bottom band: lines down to
  y 1862, and the drawn "quill.example" pill at y 1755 that Lens had flagged by eye. 14 are on the rail, for example
  "TAKE THE TWO MINUTES" out to x 1016 at y 1292–1452. Lens's eye estimates ran high: it called a line that ends at
  80% of the height "~88%".
- **Why these bounds.** A 12% band catches 6 of those 13 bottom-band problems. A 20% band breaks the `icon_ring`
  footer. A rail that starts at y 864, or runs the full height, breaks the `cta_comment` comment field (its send
  button) and flags headlines in the top half, where no app draws buttons. 14% is also the line Lens already used by
  eye, and the owner's Style 3 skills ask for a 12–20% bottom band and a 12% rail on the right.

## The four live-preview styles (2026-10-15)

The brief box (a new chat, or the dashboard's "+") has a style strip: **Moovi picks** (the crew pipeline above) or one
of four styles that end in a LIVE browser preview, never an MP4: **Style 1** (templates), **Editorial** (Style 4),
**Clear Signal** (Style 5) and **Dark Vox**. Pick one, paste the site (Editorial and Dark Vox can also start from your
own script), send.

- **One code path.** Each style's pipeline is a function in `packages/engine/src/styles/{s1,s4,s5,darkvox}.ts`
  (`runStyle()` in `run.ts`; the registry is `styles/index.ts`). The terminal scripts (`scripts/s1url.ts`, `s4.ts`,
  `s5.ts`, `darkvox.ts`) are thin wrappers over the same functions, so the studio and the terminal give the same
  results and the same timing table by construction. Child processes (edge-tts, s1make audio) now run async so the
  worker's heartbeats and events keep flowing.
- **The job.** A brief with a style becomes one `style-reel` task (`src/tasks/reel.ts`). Every stage (`site`,
  `brief`, `voice`, `plan`, `pictures`, `compose`, `audio`, `sheet`, …) lights the desk that does it, and lands in
  the chat as a row with its seconds; picture styles stream "drawing pictures 7/12". The timings are the task's
  output and `job-report.json` in the film's dir.
- **The popup.** When the preview is up the video pops up and plays in that style's own player, with the mixed
  audio, through `/studio/api/projects/<p>/preview/<chat>/<version>/` (`src/styles/serve.ts` serves the players
  under that prefix; the film stays in `data/<style>/<id>`). The stage times sit beside the player.
- **Proof.** `packages/engine/scripts/studio-style-ui.ts <style> <url>` drives the real UI in headless Chrome (door,
  "+", style, URL, send, Play) and writes `data/studio-proof/<style>.png`. `scripts/style-bench.ts <style> <url>`
  runs the terminal script and the studio job on the same URL and prints both tables side by side.

- **Never a stall.** The brief has a hard 45 s per model attempt (Sonnet, then Haiku), then a brief written from the
  site itself (title, description, its own prose sentences; `fallbackBrief` in `styles/common.ts`), so one stuck call
  costs at most 90 s. edge-tts gets three tries (35 s, 45 s, 60 s) and then another voice (60 s); if all four fail the
  chat says so in plain words ("the voice service did not answer after 4 tries…"), never a silent hang.
- **Stop.** The composer's Stop cancels the run and aborts the running `style-reel` task in the worker (`abortRun` in
  `worker.ts`): the next stage never starts, the voice/audio child processes are killed with their whole tree
  (`taskkill /T`), model calls are cancelled, the task is marked cancelled (not failed) and the chat says "Stopped".
- **The popup's Play.** Every player wires Play only once its film, fonts and audio have loaded. The route now adds a
  small script that shows "Loading…" until then, keeps a press made meanwhile, and plays the moment it can (Style 1's
  engine page also sets `window.__ready`). Before, a press during a slow load was lost and the Style 1 popup sat at
  0.0 / 0.0. The engine bundle and its fonts are served cacheable, so a second popup opens at once.

Measured through the real UI (2026-10-15, `studio-style-ui.ts`, one run at a time), seconds:

| style | site | stage times | preview in the popup after Send |
| --- | --- | --- | --- |
| Style 1 | cal.com | fetch 4.7, brief 20.8, voice 10.3, plan+qa 35.3, audio 3.6 (total 75.4) | 82.0 |
| Editorial | allbirds.com | site 1.0, brief 21.8, voice 12.0, plan 27.0, pictures 84.4, audio 4.6 (to preview 123.9, sheet 100.2) | 125.5 |
| Clear Signal | deno.com | site 1.7, brief 19.3, voice 12.5, plan 23.8, audio 3.9 (to preview 62.3, sheet 14.2) | 64.2 |
| Dark Vox | duolingo.com | site 1.6, brief 19.9, voice 15.9, plan+pictures 52.8, audio 4.4 (to preview 94.8, sheet 38.0) | 95.8 |

Stop (`scripts/studio-stop-ui.ts s5 https://www.figma.com voice`): pressed 37.9 s in, during the voice; the chat said
"Stopped" 1.1 s later, the task ended cancelled, and the voice's python processes were gone (stop.json).
`scripts/preview-check.ts <office or preview url>` lists every request a popup makes (no 4xx/5xx on all four styles).

Harness note: in the headless proof Chrome the office's WebGL and glass are software-rendered and took the CPU the
pipeline needed (briefs then ran past 45 s and fell back to the site brief; the first proof runs took 300-360 s to
preview). The UI driver now hides the set's canvas and glass while it waits for the popup and restores them for the
shot; a person's browser draws them on the GPU. Limits: a live-preview video still has no Download or "Tweak in chat".

## Art direction pass (2026-10-15): each style against its gold

Each style was laid beside its references (contact sheets in `data/studio-proof/art/`), its biggest gaps listed, and
fixed in the pipeline (code, prompts, deterministic lints), never by hand on one video.

**Style 1 (website reels; gold = the owner's eg-01 / nb-01 / ce-06 / ce-12 films).**
- *The brand's own pieces.* The run now gets the site's mark (`s1fast/logo.ts`: SVG icon → apple-touch-icon → large
  icon → manifest; judged in the browser, a white mark gets a brand tile) and its PHONE layout (390×844, mobile UA,
  re-shot until the page shows something). With a mark: the owner's corner rule (the mark half off the left edge up top
  and the right edge at the bottom, still), and the logo templates unlock (`eg-01.meet` "MEET <brand>", `eg-01.cta` /
  `nb-01.cta` lockups). A phone shows the phone layout, a laptop/browser/card the desktop page, a small image the mark.
- *Script.* The brief writes in the owner's rhythm: a ≤ 8-word hook (contrarian reframe, pain question or bold true
  claim), one stakes line, "Meet <Brand>." alone, a staccato proof run, a two-beat climax, the CTA with the domain;
  the reel's angle is logged in `script.txt`.
- *Fill lint* (`lintPicks`, one bounce to the model, then repaired in code): a title is the scene's own spoken key
  words (≥ 50 % said in that scene), never ends on a dangling word, fits its box; a short scene shows its payoff word;
  every hero prop at most once; the site's page at most twice and never in adjacent scenes; a shattering "no X"
  template never on a positive line; the last scene is a CTA.
- *Type scale kept.* A title line's width is scaled by new/old text width (the owner's size stays), capped at 940 px,
  600 px in the top band (clear of the corner mark), 800 px for a slam (overshoot room). Each line keeps the owner's
  case for it; the serif accent is never caps; no wrapping quotes; a clipped value never cuts a word.
- *Another brand's look out.* CaptionsEasy lavender bursts, its teal CTA green, purple accents and OPED's teal serif map
  to this brand's theme; the phone's burnt-in WATERMARK gag is removed. The burst is a tint of the brand's hue.
- *QA.* An overlap under 0.15 s (a slam passing) is not a collision; a failing scene is first re-set with tighter
  titles; only then a plain title, whose picture is one the reel does not already show (page, phone, mark, key-word
  pill in that order), never two alike.

## Studio-proof fixes (2026-10-15): four bugs fixed at the system level

The studio proofs (`data/studio-proof/{s1,s4,darkvox}.png`) showed four bugs; each is now a rule with a deterministic
check, not a hand fix.
- *No lettering inside a picture* (Dark Vox masterclass: a tombstone reading "NERZ"). Every SVG picture maker
  (`s4/picture.ts`, both the Editorial greyscale and the Dark Vox colour mode) is told: no `<text>`, no letters drawn as
  shapes; words the object carries (a sign, a ticket title, a carved name) come back as `label` + `labelBox` (the
  planners can ask for one too). In the browser the checker strips every `<text>` and finds letters drawn as paths:
  each sub-path's box is measured live (transforms applied), touching letter-sized marks merge into glyph clusters, and
  a run of ≥ 3 clusters in drawing order, letter-sized, one baseline, letter-gapped and NOT identical (stitches, teeth
  and hatching repeat exactly; letters vary) is lettering: removed from the picture, and the model redraws once. A
  cached or `--reuse`d picture with lettering is drawn again. The label is kept only if every word is in the voice-over
  (never an invented name), and the players set it as a real text layer on the picture's blank panel: Dark Vox in the
  tokens' engraved type (Fraunces 900, carved ink with a light/dark bevel), Editorial in the print type (Archivo
  condensed, ink, multiply). `scripts/letter-check.ts` runs the check on saved SVGs (85 earlier pictures: 1 hit, the
  NERZ tombstone; 0 false positives).
- *Dark Vox titles fit the frame at every camera position* ("CARVED" cut at the left on a 1.55× pull). The player
  samples the shot's camera (`camOf`, from the first word on: punch, pull, rise roll, whip, reframe, portal; the
  outgoing zoom-through ramp excluded) at the words plane's depth and scales each line, measured in its real font, to
  the narrowest width that keeps every word ≥ 6 % from both edges and, on a curtained set, 3 % inside the drapes' inner
  edge (a nearer plane: "TWO HUNDRED" hid behind them). `scripts/dv-fit-check.ts <film dir>` measures the frame margin;
  `scripts/dv-sheet.ts <film dir>` re-shoots a film's sheet with the current player (no model calls).
- *Style 1 polarity* (Notion: "Tasks lost" shown ✓ ticked). Templates carry a polarity (`polarity()`: NEGATION props
  shatter / are struck out, TICKS show ✓, else neutral); the model sees the tag in the index, and `lintPicks` flags a
  ✓ template on a problem line (negation or a pain word: lost, buried, scattered, stuck, missed…) or a ✓ on a row whose
  own label is a problem. What survives the bounce is repaired in code (`crossTicks`): the rows are killed as they
  enter, so the kit draws them crossed ✗ from their first frame and strikes them off; note items stay unticked.
  `scripts/s1-polarity-check.ts <run dir>` replays the lint on a finished run.
- *Editorial picture ideas* ("Patagonia treats…" came out as a pile of boxes). The plan step asks for ONE specific,
  recognisable hero object per beat that SHOWS the sentence's key noun (returned as `key`, copied from the sentence),
  the brand's real product category first (it now gets the brand and its facts), and a deterministic check
  (`ideaErrors`) bans generic shapes (box, cube, crate, container, blob, disc, slab, cylinder, tile, tin, token,
  icon…) unless the sentence names them, with one re-ask. The drawing prompt asks for the object's real outline, never
  a pile of cuboids. Connectors (the small italic words) never print under 46 px on the 1080 frame, and a one-word tuck
  or small row joins its neighbour (never a lone fragment).

## Run it

```bash
pnpm install
pnpm falkordb          # FalkorDB on :6380 (Docker)
pnpm graph:reset       # drop and re-seed the style-only craft graph
pnpm dev:engine        # the engine worker
pnpm --dir apps/studio dev     # the studio on :3100 (also reachable through the landing's /studio rewrite)
```

The engine needs FalkorDB and refuses to start without it. Claude runs through this machine's Claude Code login
(`MOOVI_RUNTIME=claude-code`, the default). `MOOVI_RUNTIME=http` plus one API key runs the same crew on any model API
(Anthropic, OpenAI, Gemini, Groq, OpenRouter, a local Ollama and more): see [MODELS.md](MODELS.md). The scripts in `packages/engine/scripts` run a brief from the CLI (`engine:run`), follow a chat
(`follow.ts`), resume a failed run (`resume.ts`), drive the studio's API (`brief.ts`) and screenshot studio pages
(`shoot-studio.ts`).

## Measured

- Chunked renders match a full render (SSIM 0.995, PSNR 49.6 dB). Rendering runs at about 730–850 ms a frame per
  Chrome page, four pages at once.
- A 31 s Style 1 film, from brief to the first MP4: plan 45 s, script 21 s, voice 180 s, six Shot Builders four at a
  time, render 171 s.
- Master: −14.1 LUFS and −1.4 dBTP on the delivered file (the first delivery measured +0.2 dBTP, before the
  oversampled limiter).

## Honest limits

- The HTTP runtimes are contract-tested with a scripted model only; no API key has been run on this machine.
- Footage-to-edit mode (a talking-head clip) has not been run end to end yet: there is no raw footage here.
- Lens scores have run 4.5–7.5/10 over seven films; the 7.5 is the first film built with all the checks above in
  place. Lens's notes drove those checks.
- The platform safe zone is one set of bounds for Instagram, TikTok and Shorts. Its app layouts are approximate (no app
  screenshots were measured), a long caption rises above 14%, and the top bar is not checked. A film assembled before
  law 10 shows "not measured" on that check.
