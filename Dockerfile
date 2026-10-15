# Moovi: one image for the studio (Next.js) and the engine worker. ffmpeg mixes the sound, Chromium reads sites,
# rasterises drawings and makes contact sheets. No Python, nothing else to install.
FROM node:24-bookworm-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg chromium fonts-dejavu-core ca-certificates \
 && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    CE_CHROME_PATH=/usr/bin/chromium \
    CE_DATA_DIR=/data \
    NEXT_TELEMETRY_DISABLED=1

RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile \
 && pnpm --filter @contenteasy/studio build

VOLUME ["/data"]
EXPOSE 3100
# the studio by default; the worker runs the same image with: pnpm --filter @contenteasy/engine exec tsx scripts/worker.ts
CMD ["pnpm", "--filter", "@contenteasy/studio", "start"]
