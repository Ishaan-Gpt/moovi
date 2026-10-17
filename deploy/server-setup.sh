#!/usr/bin/env bash
# Sets up Moovi on a fresh Ubuntu server (e.g. AWS Lightsail, 4 GB): swap, Docker, the repo, a .env with a fresh
# MOOVI_SECRET, then starts everything. Safe to run again: it keeps an existing .env and just updates and restarts.
#   curl -fsSL https://raw.githubusercontent.com/Ishaan-Gpt/moovi/main/deploy/server-setup.sh | sudo bash -s -- <site-address>
# <site-address> is your domain, or <public-ip>.sslip.io for free HTTPS without a domain.
set -euo pipefail
SITE="${1:-}"
DIR=/opt/moovi

# swap: a safety net for the build and for Chromium spikes
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  grep -q /swapfile /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sh
fi

if [ -d "$DIR/.git" ]; then git -C "$DIR" pull --ff-only; else git clone https://github.com/Ishaan-Gpt/moovi.git "$DIR"; fi
cd "$DIR"

if [ ! -f .env ]; then
  {
    echo "MOOVI_SECRET=$(openssl rand -hex 32)"
    echo "MOOVI_BYOK=required"
    echo "MOOVI_RUNTIME=http"
    echo "MOOVI_CHROME_PATH=/usr/bin/chromium"
    [ -n "$SITE" ] && echo "SITE_ADDRESS=$SITE" && echo "MOOVI_ORIGINS=https://$SITE" && echo "PUBLIC_URL=https://$SITE"
  } > .env
  chmod 600 .env
fi

docker compose up -d --build
# the craft library (effects, styles) into the graph; safe to run again
docker compose run --rm seed || true
docker compose ps
