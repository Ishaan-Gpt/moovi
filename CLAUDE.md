# CLAUDE.md: Moovi

Moovi is an AI video employee you hire. A 3D Director character (Moovi) leads a visible crew of AI agents that make
and edit short videos, and remembers how you like them. Built for **Graph Hacks** (WeMakeDevs × FalkorDB); the
hackathon is live (preponed, 2026-10-12), so everything here is event work. Repo: https://github.com/Ishaan-Gpt/moovi
(branch `main`). Team: Ishaan (owner: styles, studio, deploy) and Vignesh (footage, research, voice casting, feedback
memory, 3D, maps, the visual renderer, the style router). Several AI agents work in this repo at once: check
`docs/agents/` (the agent board) before starting, and pull before you push.

**Read first:** `docs/ARCHITECTURE.md`, `docs/STUDIO.md`, `docs/STYLES.md` (styles, not templates),
`docs/MODELS.md` (any model, bring your own key), `docs/QUERIES.md` (every Cypher query), `docs/DEPLOY.md`,
`docs/LIBRARY.md` (the asset library in FalkorDB, kits, cloned references).
Vignesh's systems: `docs/VISUAL.md`, `docs/ROUTER.md`, `docs/VOICE.md`, `docs/3D.md`, `docs/MAPS.md`, `docs/SPEED.md`.
Brand and character: `docs/BRAND.md`, `docs/CHARACTER.md`.

## Hard rules

- **FalkorDB stays load-bearing** (the hackathon's core): accounts, the task board, style memory, the craft graph,
  feedback memory, footage licences, voices, scenes. Every query is a named Cypher query in `packages/graph`.
  Log AI use in `AI_USAGE.md` as you go.
- **Moovi everywhere.** Packages `@moovi/*`, settings `MOOVI_*`. Never reintroduce "ContentEasy" or `CE_*`.
  **No dependency on MotionEasy or Python:** everything a film needs is in `packages/engine/assets` (renderer bundle,
  fonts, CC0 sound kit, CC-BY music bed; see its CREDITS.md). User-facing text says "Moovi", not people's names.
- **Styles, not templates.** A style is a visual language with a large library of set-ups, cast per beat for the
  content, plus improvisation; two films from one site must differ.
- **Any model, equal quality.** Every user can bring their own key (Gemini, Groq, OpenAI, Anthropic, OpenRouter, …);
  the crew must work on small/free models too. Keys are sealed with AES-256-GCM (`packages/engine/src/keys.ts`).
- **Preview, don't render.** Prefer live browser previews; don't run slow MP4 renders unless asked.
- **Moovi (the Director) is one character everywhere** (`@moovi/character`, pure-code WebGL2 SDF, no GLB).
  Palette: icy white `#F7FAFD` and ice blue `#CFE6F7`; colours only from `@moovi/brand` tokens.
- **Performance claims are measured,** never assumed (playground Benchmark / `moovi.benchmark()`, A/B runs).
- **Taste:** `ishaan-ui` skill for site work, `ishaan-motion` for motion. No generic AI-site look.
- **Secrets:** never commit keys. `.env`, `.env.local` and `data/` stay local or on the server.
- **Platform:** Windows host with spaces in paths: quote them. pnpm workspace (Node 24, pnpm 11).

## Layout and checks

- `apps/landing` (Next.js, on Vercel), `apps/studio` (Next.js, basePath `/studio`), `apps/playground` (Vite).
- `packages/engine` (crew, worker, styles, runtime, audio, visual, router, footage, research, maps, render3d),
  `packages/graph` (FalkorDB client, schema, queries), `packages/library`, `packages/skills`, `packages/brand`,
  `packages/character`, `packages/ui`. Dependency direction `brand ← character ← apps`; packages export TS source.
- After changes: `pnpm typecheck`; engine tests `pnpm --filter @moovi/engine test` (165 tests, some need FalkorDB);
  local FalkorDB: `pnpm falkordb` (port 6380); local settings in `.env.local` (see `.env.example`).

## Styles and pipelines

| Id | Name | Output | Notes |
|---|---|---|---|
| `s1` | Style 1 | live preview | URL in; on Groq a shortlisted template menu (fits 8k TPM) |
| `s4` | Editorial | live preview | URL or script; library-first pictures (258 shipped) |
| `s5` | Clear Signal | live preview | URL in |
| `darkvox` | Dark Vox | live preview | URL or script; 53 set-ups on a paper-theatre stage |
| `anatomy` | Anatomy | live preview | URL or script; isometric technical figures |
| `combined` | Auto | live preview (default) | a link → the style that suits the brief; plain words → the director writes a script → Anatomy or Dark Vox. `MOOVI_AUTO_RENDER=mp4` = Vignesh's mixed MP4 film (needs ~8 GB) |

- A plain brief (no style, no uploads) goes to Auto; `MOOVI_DEFAULT_STYLE=crew` restores the crew path.
- **Vignesh's visual renderer** (`MOOVI_RENDERER=visual`; terminal: `scripts/visual.ts make <script.json>
  <words.json> <audio.wav>`) is its own style: 56 artifacts, 10 layouts, three.js objects, footage panels, kinetic
  captions. About 1.2 s of render per film second on an 8-core PC, about 2 s on the server. Not yet a studio style.
- Measured on the live 2 GB server: live styles 13–48 s to a preview; Auto (live) 27.7 s; visual MP4 112 s;
  the combined MP4 film >12 min with style segments timing out (too heavy for 2 GB).
- See films on disk: `pnpm --filter @moovi/engine exec tsx scripts/films.ts --port 4200`.

## The library and reference clones

- **One library in the craft graph** (`docs/LIBRARY.md`): 755 `(:Asset)` nodes in 10 categories (voice, sfx, music,
  caption, transition, effect, camera, ui, 3d, insert). Each node has SERVES need edges, runtime implementations and a
  licence. Named queries are in `packages/graph/src/queries/library.ts`. Seed the catalogue with
  `pnpm --filter @moovi/engine library`.
- **References → kits.** Each Instagram reel Ishaan sends is cloned as a live canvas preview with the `ishaan-motion`
  skill, broken into parts (`(:Reference)-[:HAS_PART]->(:Asset)`), and saved as a re-skinnable kit in
  `packages/library/src/kits/`. So far: R1 crimson-poster, R2 level-ladder, R3 golden-hand, R4 red-table, all on
  the shared engine `kits/motion`. Intake for a new reel is one command, `scripts/ref-intake.ts <id> <url>`. Where the
  reference cuts to real footage, `scripts/ref-footage.ts <id> name="query"` fetches it through the footage finder (no
  drawn stand-ins there; they read as paused video).
- **Quality ratchet:** a new clone ships only when a blind subagent judge scores it strictly above the best previous
  film, with both scored in the same round. R3 scored 7.6. R4 scored 6.6 against R3's 6.4 in its round.
- The camera layer (63 moves callable by keyword, `packages/library/src/camera`) is merged.
- The styles read the library: every style's sfx comes from `assetsForEvent`; Style 4 and Dark Vox borrow `ui` pieces
  (runtime `visual`) on weak beats; Auto passes a matched kit's palette (docs/LIBRARY.md, "Who reads it").
- The clones' code is in git (`data/refs/<id>/clone-motion/`, `parts.json`). The reference media is not; fetch it with
  `ref-intake`. The `ishaan-motion` skill is checked in at `.claude/skills/ishaan-motion/` (mirror of Ishaan's copy).
- **Live edit preview** (main 9473f58, live on the server): an uploaded clip is edited and plays live in the studio,
  with 11 caption styles from R8 (`engine/src/edit/`). See `docs/agents/BOARD.md` D1.4, D1.5 and D1.7.

## Models and keys

- Server runs `MOOVI_BYOK=optional`: users may skip their key and run on the server's model.
- **Fallback:** a user key that is refused or out of quota mid-job retries that request on the server's model
  (`withServerFallback`, `keyFailure` in `keys.ts`; `MOOVI_FALLBACK=0` turns it off). The server model is Groq
  (`MOOVI_PROVIDER=groq`, Ishaan's key in the server `.env`). Groq free tier: 8k TPM, 200k tokens a day for
  gpt-oss-120b, shared by every fallback user (it then drops to gpt-oss-20b).
- Ollama is offered only where `OLLAMA_HOST` is set. Defaults: 4 model calls and 4 voice lines at once.
- **Bedrock is blocked** ("Operation not allowed"): the AWS account is on the Free plan. Upgrading to Paid is the
  owner's decision; after that Bedrock could be the server model via the instance's IAM role.

## Live deployment

- **Website:** https://moovi-three.vercel.app (Vercel project `moovi`, root `apps/landing`, auto-deploys on every
  push to `main`). Its `STUDIO_URL=https://65-2-223-240.sslip.io` makes `/studio` proxy to the server.
- **Server:** AWS EC2 `t3.small` (2 vCPU, 2 GB + 4 GB swap, 30 GB), Mumbai `ap-south-1`, instance
  `i-0a058c751e56a9c30`, Elastic IP `65.2.223.240`, HTTPS by Caddy on `65-2-223-240.sslip.io`.
  Docker Compose in `/opt/moovi`: falkordb 6.0.2, studio, worker, a one-shot `seed` (graphs on every deploy), caddy.
  Settings in `/opt/moovi/.env` (never in git). SSH key `~/.ssh/moovi-ec2.pem` on Ishaan's PC.
- **Server updates are manual** (about 10 min to rebuild):
  `ssh -i ~/.ssh/moovi-ec2.pem ubuntu@65.2.223.240 "cd /opt/moovi && sudo git pull && sudo docker compose up -d --build"`.
  Logs: `sudo docker compose logs -f worker`. Never `pkill -f` a pattern that matches your own ssh command.
- The image ships static ffmpeg 8.0 (Debian's 5.1 is too old for the mixer) and Chromium; dev dependencies are
  installed because the worker runs TypeScript through tsx.
- **AWS money:** Free plan, about $85 of credits (2026-10-15), expiring 2027-03-19; the server costs about $22 a
  month. The wasteful oped compute stack was deleted. No budget alert yet (needs an email).

## Open items

- After a craft-graph reset, re-run `reference` for each `data/refs/<id>/parts.json` and `camera-layer`.
- Add the visual renderer as a studio style ("Visual", MP4 in about 2 min on the server).
- On-screen credits: OpenStreetMap/OpenFreeMap for maps, CC-BY footage, the Kevin MacLeod music bed.
- Rotate the server's Groq key (it was visible in a process list during testing).
- Optional: Dark Vox repeated props, Anatomy near-empty frames, a "built before vs during the event" README note.
