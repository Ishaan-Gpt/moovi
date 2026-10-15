# Deploying Moovi

Moovi is three processes and one shared folder:

| Part | What it is | Needs |
|---|---|---|
| **FalkorDB** | the memory: accounts, the task board, every style's films, the craft graph | a persistent volume |
| **Studio** | Next.js app (`apps/studio`): sign-in, your model key, the Office, chat, live previews | the data folder |
| **Worker** | the engine (`packages/engine`): reads sites, writes scripts, voices, mixes sound, makes the films | ffmpeg, Chromium, the data folder |
| **Landing** (optional) | the marketing page (`apps/landing`), which forwards `/studio` to the studio | nothing |

The studio serves each preview from files the worker writes, so **studio and worker must share one disk**: run them
on the same machine, or the same container platform with a shared volume. The landing page is static and can live
anywhere.

## Recommended: one small VM with Docker Compose

The simplest setup that runs everything, and the one the repo is built for (`Dockerfile`, `docker-compose.yml`).

1. A VM with **2 vCPU / 4 GB RAM** at least (Chromium and ffmpeg are the heavy parts). For example Hetzner CX22,
   DigitalOcean 4 GB or Lightsail 4 GB (roughly $5–24 a month).
2. Install Docker, clone the repo, then:
   ```bash
   cp .env.example .env    # set CE_SECRET to a long random string
   docker compose up -d --build
   ```
3. Put HTTPS in front with Caddy (one line: `your-domain.com { reverse_proxy localhost:3100 }`), and set
   `CE_ORIGINS=https://your-domain.com` in `.env`.
4. Open `https://your-domain.com/studio`, sign up, and paste a model key (Gemini or Groq are free).

FalkorDB's volume and the data volume persist across restarts and redeploys. Back up both.

## Managed alternative: Railway (or Render)

1. **FalkorDB:** add Railway's FalkorDB template (it has a persistent volume). Don't use FalkorDB Cloud's free tier for
   judging: it stops after a day idle and is deleted after a week.
2. **App:** one Railway service from this repo's `Dockerfile`, with a volume mounted at `/data`. Run the studio
   and the worker in that **one** service so they share `/data`: set the start command to
   `sh -c "pnpm --filter @contenteasy/engine exec tsx scripts/worker.ts & pnpm --filter @contenteasy/studio start"`.
3. Variables: `FALKORDB_URL` (from the template, `falkor://…`), `CE_SECRET`, `CE_DATA_DIR=/data`,
   `CE_ORIGINS=https://<your app domain>`, `CE_BYOK=required`.
4. Size: at least 2 GB RAM.

## The landing page on Vercel

`apps/landing` deploys to Vercel as a plain Next.js app (root directory `apps/landing`). Set `STUDIO_URL` to the
studio's address (e.g. `https://studio.your-domain.com`): `/studio` on the landing domain is then proxied to the
studio. The studio itself does **not** belong on Vercel: it needs the shared disk and long-running jobs.

## Settings that matter in production

| Variable | Why |
|---|---|
| `CE_SECRET` | encrypts every user's stored model key. Set it once and keep it: changing it makes saved keys unreadable. |
| `CE_BYOK` | `required` (default): every user brings their own key. `optional`: keyless users run on the server's model (`CE_RUNTIME`, `CE_PROVIDER` and a key). |
| `CE_ORIGINS` | your public origin(s), comma-separated: the studio refuses cross-site writes from anything else. |
| `FALKORDB_URL` | FalkorDB's address. Use a password in production (`falkor://default:<password>@host:6379`). |
| `CE_CHROME_PATH` | `/usr/bin/chromium` in the Docker image (already set there). |

## What runs where, per film

All model calls go to the user's own provider. The voice uses Microsoft Edge's free online text-to-speech (no key).
ffmpeg and Chromium run on the worker. Nothing calls any other service. Films are live previews played in the
browser; nothing is rendered to MP4 unless asked.
