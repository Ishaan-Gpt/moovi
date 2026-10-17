# Moovi: one image for the studio (Next.js) and the engine worker. ffmpeg mixes the sound, Chromium reads sites,
# rasterises drawings and makes contact sheets. No Python, nothing else to install.
FROM node:24-bookworm-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends chromium fonts-dejavu-core ca-certificates git \
 && rm -rf /var/lib/apt/lists/*
# a current static ffmpeg: Debian's 5.1 lacks filter options the sound mixer uses (ebur128 framelog=quiet, ...)
COPY --from=mwader/static-ffmpeg:8.0 /ffmpeg /ffprobe /usr/local/bin/

ENV MOOVI_CHROME_PATH=/usr/bin/chromium \
    MOOVI_DATA_DIR=/data \
    NEXT_TELEMETRY_DISABLED=1

RUN corepack enable
WORKDIR /app
COPY . .
# dev dependencies too: the worker runs TypeScript through tsx, and the build needs the compilers
ARG BUILD_NODE_OPTIONS=""
RUN pnpm install --frozen-lockfile --prod=false \
 && NODE_OPTIONS="$BUILD_NODE_OPTIONS" pnpm --filter @moovi/studio build
ENV NODE_ENV=production

VOLUME ["/data"]
EXPOSE 3100
# the studio by default; the worker runs the same image with: pnpm --filter @moovi/engine exec tsx scripts/worker.ts
CMD ["pnpm", "--filter", "@moovi/studio", "start"]
