#!/usr/bin/env bash
# Sets up Moovi on an Ubuntu server (a fresh AWS EC2 t3.xlarge with Ubuntu 24.04, or an existing server): Docker, the
# repo, a .env with a fresh MOOVI_SECRET and the public address, then builds and starts everything (FalkorDB, studio,
# worker + Claude Code bridge, and Caddy for HTTPS). Safe to run again: it keeps MOOVI_SECRET and the rest of .env.
#
#   git clone https://github.com/Ishaan-Gpt/moovi.git && cd moovi && sudo bash deploy/server-setup.sh [site-address]
#   or: curl -fsSL https://raw.githubusercontent.com/Ishaan-Gpt/moovi/main/deploy/server-setup.sh | sudo bash -s -- [site-address]
#
# [site-address]: your domain (its DNS A record points at this server). Leave it out to use <public-ip>.sslip.io (free
# HTTPS, no domain). HTTPS is required: the sign-in cookie is secure-only.
# --website https://your-site.vercel.app: people open Moovi on another address that proxies /studio to this server.
#   The Settings card then works from there; Claude Code still connects to https://<site-address>/mcp directly.
# --no-caddy: the server already runs a web server on ports 80/443 (nginx, Caddy, ...). Moovi then listens only on
# 127.0.0.1:3100 (website) and 127.0.0.1:3200 (Claude Code bridge) and the script prints the routes to add to it.
# Nothing on the server outside the repo folder is changed except: Docker (installed only if missing) and a 4 GB
# /swapfile-moovi with its /etc/fstab line (only when the server has no swap at all, or has under 3.5 GB of RAM and
# under 3 GB of swap; swap you added yourself, e.g. /swapfile2, counts). A 2 GB server works: it is never refused.
set -euo pipefail

SITE=""; CADDY=1; WEBSITE=""; NEXT_IS_WEBSITE=0
for a in "$@"; do
  if [ "$NEXT_IS_WEBSITE" -eq 1 ]; then WEBSITE="$a"; NEXT_IS_WEBSITE=0; continue; fi
  case "$a" in
    --no-caddy) CADDY=0 ;;
    --website) NEXT_IS_WEBSITE=1 ;;
    --website=*) WEBSITE="${a#--website=}" ;;
    -h|--help) sed -n '2,16p' "$0" 2>/dev/null || true; exit 0 ;;
    -*) echo "[moovi] unknown option: $a"; exit 1 ;;
    *) SITE="$a" ;;
  esac
done
die() { echo "[moovi] STOPPED: $*" >&2; exit 1; }
say() { echo "[moovi] $*"; }

[ "$(id -u)" -eq 0 ] || die "run it with sudo: sudo bash deploy/server-setup.sh ${SITE}"
command -v curl >/dev/null || die "curl is missing: apt-get install -y curl"
command -v git >/dev/null || die "git is missing: apt-get install -y git"

# the repo: the checkout this script file sits in (bash deploy/server-setup.sh), else /opt/moovi (curl | bash)
DIR=""
if [ -n "${BASH_SOURCE[0]:-}" ] && [ -f "${BASH_SOURCE[0]}" ]; then
  HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  if [ -f "$HERE/../docker-compose.yml" ] && [ -f "$HERE/Caddyfile" ]; then DIR="$(cd "$HERE/.." && pwd)"; fi
fi
if [ -z "$DIR" ]; then
  DIR=/opt/moovi
  if [ -d "$DIR/.git" ]; then
    git -C "$DIR" pull --ff-only || die "$DIR has local changes or another branch, so it was not updated. Fix it there (git -C $DIR status) and run again."
  elif [ -e "$DIR" ]; then
    die "$DIR already exists and is not a Moovi checkout. Move it away, or clone Moovi somewhere and run deploy/server-setup.sh from that folder."
  else
    git clone https://github.com/Ishaan-Gpt/moovi.git "$DIR"
  fi
fi
cd "$DIR"
say "repo: $DIR"

# ports: 80/443 for Caddy (unless --no-caddy), 3100/3200 on 127.0.0.1 for the website and the bridge. A port held by
# another program stops the script here, before anything is started.
busy() { ss -Hltn "sport = :$1" 2>/dev/null | grep -q . ; }
mine() { # mine PORT SERVICE: true when that port is this Moovi's own running container (a re-run)
  command -v docker >/dev/null && docker compose port "$2" "$1" >/dev/null 2>&1 ; }
for p in 3100 3200; do
  svc=studio; [ "$p" = 3200 ] && svc=worker
  if busy "$p" && ! mine "$p" "$svc"; then die "port $p is already used by another program on this server ($(ss -Hltnp "sport = :$p" | awk '{print $NF}' | head -1)). Free it and run again."; fi
done
if [ "$CADDY" -eq 1 ]; then
  for p in 80 443; do
    if busy "$p" && ! mine "$p" caddy; then
      die "port $p is already used by another web server ($(ss -Hltnp "sport = :$p" | awk '{print $NF}' | head -1)).
  Either stop it, or keep it and run: sudo bash deploy/server-setup.sh ${SITE:-<your-domain>} --no-caddy
  (Moovi then listens on 127.0.0.1 only and this script prints the routes to add to your web server.)"
    fi
  done
fi

# no address given: the one this server already uses (a re-run or an update keeps it), else its public IP as
# <ip>.sslip.io (EC2 metadata first, then a public echo)
if [ -z "$SITE" ] && [ -f .env ]; then
  SITE="$(grep -E '^SITE_ADDRESS=' .env | tail -1 | cut -d= -f2- | tr -d '"' || true)"
  [ "$SITE" = ":80" ] && SITE=""
  [ -n "$SITE" ] && say "keeping the address in .env: $SITE"
fi
if [ -z "$SITE" ]; then
  IMDS_TOKEN="$(curl -fsS -m 3 -X PUT http://169.254.169.254/latest/api/token -H 'X-aws-ec2-metadata-token-ttl-seconds: 60' 2>/dev/null || true)"
  IP="$(curl -fsS -m 3 -H "X-aws-ec2-metadata-token: ${IMDS_TOKEN}" http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || true)"
  if ! [[ "$IP" =~ ^[0-9]+(\.[0-9]+){3}$ ]]; then IP="$(curl -fsS -m 5 https://checkip.amazonaws.com 2>/dev/null | tr -d '[:space:]' || true)"; fi
  [[ "$IP" =~ ^[0-9]+(\.[0-9]+){3}$ ]] || die "could not find this server's public IP. Run again with your domain: sudo bash deploy/server-setup.sh moovi.example.com"
  SITE="${IP}.sslip.io"
fi
SITE="${SITE#https://}"; SITE="${SITE#http://}"; SITE="${SITE%%/*}"
say "site address: https://$SITE"

# memory: 2 GB servers work (slower) with swap. Under 3.5 GB of RAM the total swap is brought to at least 3 GB with a
# 4 GB /swapfile-moovi (once; an fstab line keeps it); a server with no swap at all gets it too. Never refuses on low RAM.
MEMINFO="${MOOVI_MEMINFO:-/proc/meminfo}"; SWAPFILE="${MOOVI_SWAPFILE:-/swapfile-moovi}"; FSTAB="${MOOVI_FSTAB:-/etc/fstab}"
MEM_MB=$(awk '/^MemTotal:/ {print int($2/1024)}' "$MEMINFO")
SWAP_MB=$(awk '/^SwapTotal:/ {print int($2/1024)}' "$MEMINFO")
LOW_MEM=0; [ "$MEM_MB" -lt 3500 ] && LOW_MEM=1
say "memory: ${MEM_MB} MB RAM, ${SWAP_MB} MB swap"
if { [ "$LOW_MEM" -eq 1 ] && [ "$SWAP_MB" -lt 3000 ]; } || [ "$SWAP_MB" -eq 0 ]; then
  if swapon --show=NAME --noheadings 2>/dev/null | grep -qx "$SWAPFILE"; then
    : # already on
  elif [ -f "$SWAPFILE" ] && swapon "$SWAPFILE" 2>/dev/null; then
    say "turned on the existing $SWAPFILE"
  else
    FREE_MB=$(df -Pm / | awk 'NR==2 {print $4}')
    if [ "$FREE_MB" -lt 5000 ]; then
      say "note: only ${FREE_MB} MB free on disk, so no swap was added (a build on low memory may fail; free disk or add swap, then run again)"
    elif { fallocate -l 4G "$SWAPFILE" 2>/dev/null || dd if=/dev/zero of="$SWAPFILE" bs=1M count=4096 status=none; } \
        && chmod 600 "$SWAPFILE" && mkswap "$SWAPFILE" >/dev/null && swapon "$SWAPFILE"; then
      say "added a 4 GB $SWAPFILE"
    else
      rm -f "$SWAPFILE"; say "note: could not add swap on this disk; continuing"
    fi
  fi
  if [ -f "$SWAPFILE" ] && ! grep -q "^$SWAPFILE " "$FSTAB" 2>/dev/null; then echo "$SWAPFILE none swap sw 0 0" >> "$FSTAB"; fi
fi

if ! command -v docker >/dev/null; then
  say "installing Docker"
  curl -fsSL https://get.docker.com | sh
fi
docker compose version >/dev/null 2>&1 || die "Docker is installed but 'docker compose' (v2) is not. Install it: apt-get install -y docker-compose-plugin (or see docs.docker.com/compose/install), then run again."
docker info >/dev/null 2>&1 || die "Docker is installed but not running: systemctl start docker, then run again."

# .env: a fresh secret once; the address keys are (re)written on every run
setkey() { # setkey KEY VALUE: replace or append KEY=VALUE in .env
  if grep -q "^$1=" .env; then sed -i "s|^$1=.*|$1=$2|" .env; else echo "$1=$2" >> .env; fi
}
if [ ! -f .env ]; then
  {
    echo "MOOVI_SECRET=$(openssl rand -hex 32)"
    echo "MOOVI_RUNTIME=http"
    echo "MOOVI_CHROME_PATH=/usr/bin/chromium"
  } > .env
  chmod 600 .env
fi
setkey SITE_ADDRESS "$SITE"
setkey PUBLIC_URL "https://$SITE"
setkey MOOVI_ORIGINS "https://$SITE"
if [ -n "$WEBSITE" ]; then setkey WEBSITE_URL "${WEBSITE%/}"; fi
# no API key needed: users who connect Claude Code (Settings, Use Claude Code) have their brain there. Under
# MOOVI_BYOK=required the website still sends a keyless user to Settings (apps/studio/src/lib/session.ts reads only the
# saved key), so the server runs with optional: a user with neither a key nor Claude Code is told so when a video starts.
if grep -q '^MOOVI_BYOK=required' .env; then say "MOOVI_BYOK=required changed to optional (Claude Code users have no key)"; fi
setkey MOOVI_BYOK optional
# a small server: one video at a time, the small speech model (77 MB, about 300 MB of memory) instead of the large one
# (760 MB download, about 1.5 GB of memory), and a heap cap for the website build. Values already in .env are kept.
addkey() { grep -q "^$1=" .env || echo "$1=$2" >> .env; }
if [ "$LOW_MEM" -eq 1 ]; then
  addkey MOOVI_STT_LOCAL_MODEL onnx-community/whisper-base_timestamped
  addkey MOOVI_SLOTS_RENDER 1
  addkey MOOVI_SLOTS_CHROME 1
  addkey MOOVI_SLOTS_CPU 1
  addkey MOOVI_SLOTS_LLM 2
  addkey BUILD_NODE_OPTIONS --max-old-space-size=2560
  say "small server: one video at a time, small speech model, build heap capped (see .env)"
fi

# one image (studio, worker and seed share it), built on its own; on a small server the worker (Chromium, the speech
# model) and the old website are stopped during the build so the build has the memory; both come back right after
export COMPOSE_PARALLEL_LIMIT=1
if [ "$LOW_MEM" -eq 1 ]; then docker compose stop worker studio >/dev/null 2>&1 || true; fi
docker compose build studio
if [ "$CADDY" -eq 1 ]; then
  docker compose up -d
else
  docker compose up -d falkordb studio worker
fi
# the craft library (effects, styles) into the graph; safe to run again
docker compose run --rm seed || say "seeding failed; run again: docker compose run --rm seed"
docker compose ps

if [ "$CADDY" -eq 0 ]; then
  cat <<EOF
[moovi] Moovi runs on 127.0.0.1 only. Add this to your web server for https://$SITE, then reload it:
  Caddy:  $SITE {
            @bridge path /mcp /mcp/* /connect /healthz /api/brain/* /studio/connect /studio/api/brain/*
            handle @bridge { reverse_proxy 127.0.0.1:3200 { flush_interval -1 } }
            handle { redir / /studio 302
                     reverse_proxy 127.0.0.1:3100 }
          }
  nginx (inside the server block for $SITE, with its certificate):
          location ~ ^/(mcp|connect|healthz|api/brain/|studio/connect|studio/api/brain/) { proxy_pass http://127.0.0.1:3200; proxy_http_version 1.1;
            proxy_set_header Host \$host; proxy_set_header X-Forwarded-Proto https; proxy_buffering off; proxy_read_timeout 120s; }
          location / { proxy_pass http://127.0.0.1:3100; proxy_set_header Host \$host; proxy_set_header X-Forwarded-Proto https; }
          location = / { return 302 /studio; }
EOF
fi

if [ "$CADDY" -eq 0 ]; then
  for _ in $(seq 1 30); do
    if curl -fsS -m 5 http://127.0.0.1:3200/healthz >/dev/null 2>&1; then say "bridge is up on 127.0.0.1:3200; once your web server has the routes above, open https://$SITE/studio"; exit 0; fi
    sleep 5
  done
  die "the bridge is not answering on 127.0.0.1:3200: docker compose logs --tail 50 worker"
fi

# wait for HTTPS (the certificate takes a few seconds on the first start)
for _ in $(seq 1 30); do
  if curl -fsS -m 5 "https://$SITE/healthz" >/dev/null 2>&1; then
    say "up: https://$SITE/studio  (health: https://$SITE/healthz)"
    say "Claude Code users: sign in, open Settings, Use Claude Code, copy the command. No API key needed."
    exit 0
  fi
  sleep 5
done
say "https://$SITE/healthz is not answering yet. Check that ports 80 and 443 are open in the security group, that the"
say "domain points at this server, and: docker compose logs --tail 50 caddy worker"
