# ContentEasy

**Hire Moovi.** Moovi is an AI video director who leads a visible crew of agents to make and edit your videos, and remembers how you like them.

From the makers of MotionEasy and CaptionsEasy.

## Repository

```
ContentEasy/
├─ apps/
│  ├─ playground/     Moovi playground: every state, quality tier and benchmark (Vite)
│  ├─ landing/        marketing site: Next.js + GSAP + Lenis, Moovi as the travelling hero
│  └─ studio/         the studio: brief → the Office (the crew at work, live) → the editor; agents + FalkorDB, :3100
├─ packages/
│  ├─ brand/          design tokens: palette, radii, easing (TS + CSS)
│  ├─ character/      Moovi: code-generated jelly character (WebGL2 SDF) + React wrapper
│  ├─ ui/             brand marks shared by landing and studio (halo logo, icons, crew blobs)
│  ├─ crew/           the six agents, the brains, the orchestrator, the event bus (studio)
│  └─ graph/          FalkorDB client, schema, seeds, the named query library (studio)
├─ tools/             scripts (character/inspect.py: mesh inspector)
├─ docs/              context, architecture, brand, Moovi prompts, hackathon plan
└─ assets/            source art and reference images
```

Packages are TypeScript sources consumed by the apps' bundlers, so there's no build step. The dependency direction is `brand ← character ← apps` and `graph ← crew ← studio`; nothing imports upward. How the studio works, its graph model and its setup: [docs/STUDIO.md](docs/STUDIO.md). Every Cypher query: [docs/QUERIES.md](docs/QUERIES.md).

## Run it

Self-contained: everything a film needs (renderer, fonts, sound kit, music bed) is in the repo, openly licensed
(`packages/engine/assets/CREDITS.md`). You need **Node 20+** (24 tested), **pnpm**, **Docker** (for FalkorDB),
**ffmpeg** on the PATH and **Google Chrome** (or Chromium, via `CE_CHROME_PATH`). No Python.

```bash
pnpm install
cp .env.example .env.local      # set CE_SECRET; the rest is optional
pnpm falkordb                   # FalkorDB 6.0.2 in Docker on :6380
pnpm dev:engine                 # the engine worker: makes every film the studio asks for
pnpm dev:studio                 # the studio, http://localhost:3100/studio: sign up, add your model key, brief
```

Or everything at once in Docker (FalkorDB + studio + worker): `cp .env.example .env`, then `docker compose up -d --build`.
Deploying it: [docs/DEPLOY.md](docs/DEPLOY.md).

From the terminal (no studio), any style straight from a site:

```bash
cd packages/engine
pnpm exec tsx --env-file-if-exists=../../.env.local scripts/anatomy.ts --url https://www.figma.com --exit
```

Other commands:

```bash
pnpm dev:playground     # Moovi playground, http://localhost:5199
pnpm dev:landing        # landing page, http://localhost:3000
pnpm graph:check        # p50 / p95 of every read query the crew depends on
pnpm typecheck
pnpm test
```

## Bring your own model

Every user thinks on their own model. After signing up, the studio asks for one API key: Google Gemini or Groq (both
give free keys in a minute), or OpenAI, Anthropic, OpenRouter, DeepSeek, Mistral, Together, xAI, Cerebras, any
OpenAI-compatible API, or a local Ollama. The server checks the key with the provider, picks working models for the
crew's three tiers from what the key can use, and stores the key encrypted. Every job of that user runs on that key.

The crew is built so a model's strength changes how sharp a film is, never whether it works. Models only fill slots
and pick from lists; casting, layout, timing, the script doctor and all checks are deterministic. Picture styles go
library-first on models that don't draw as well as Claude. How it works: [docs/MODELS.md](docs/MODELS.md). The five
reel styles and how each is a language rather than a template: [docs/STYLES.md](docs/STYLES.md).

Server settings (in `.env.local`, see `.env.example`): `CE_SECRET` encrypts stored keys. `CE_BYOK=optional` lets a
user without a key run on the server's own model (`CE_RUNTIME`).
