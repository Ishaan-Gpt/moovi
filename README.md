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

## Commands

```bash
pnpm install
pnpm dev:playground     # Moovi playground, http://localhost:5199
pnpm dev:landing        # landing page, http://localhost:3000
pnpm falkordb           # Moovi's memory: FalkorDB in Docker on :6379
pnpm dev:studio         # the studio, http://localhost:3100 (see docs/STUDIO.md)
pnpm dev:engine         # the engine worker (runs every reel the studio asks for)
pnpm graph:check        # p50 / p95 of every read query the crew depends on
pnpm typecheck
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
