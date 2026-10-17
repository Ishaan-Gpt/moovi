# Deploy Moovi with the Claude Code bridge on AWS

For a friend deploying Moovi so people can connect their own Claude Code (no API key needed). The simple path is one
EC2 machine running `docker compose`: FalkorDB, the studio, the worker with the bridge, and Caddy for HTTPS. Nothing
else to install on the machine; Python is not needed.

## What runs

| service  | what it is | port (inside) | public path |
|----------|------------|---------------|-------------|
| caddy    | HTTPS (free certificate) and routing | 80, 443 (public) | everything |
| studio   | the website (Next.js) | 3100 | `/studio/*` |
| worker   | the engine worker AND the Claude Code bridge, one process (they must not run apart) | 3200 | `/mcp`, `/connect`, `/healthz`, `/api/brain/*` |
| falkordb | the graph (accounts, projects, the craft library, bridge tokens and steps) | 6379 | none |
| seed     | one shot: loads the craft library and style packages into FalkorDB | none | none |

Studio and bridge share one address, so the sign-in cookie of the website also signs the user in on `/connect`.

## 1. The machine

- EC2 **t3.xlarge** (4 vCPU, 16 GB) or bigger. The speech model and the effects render are CPU heavy; t3.large (8 GB)
  works for one video at a time but is slow. Ubuntu 24.04 LTS, x86_64.
- Disk: **40 GB gp3** at least (image about 4 GB, the speech model 760 MB, videos grow over time).
- Security group: inbound 22 (your IP only), 80 and 443 (anywhere). Nothing else.
- An Elastic IP, and a DNS A record (for example `moovi.example.com`) pointing at it. No domain? Use
  `<elastic-ip>.sslip.io` as the address; it still gets a real certificate.

## 2. Install Docker and get the code

```
sudo apt-get update && sudo apt-get install -y docker.io docker-compose-v2 git
sudo usermod -aG docker $USER && newgrp docker
git clone https://github.com/Ishaan-Gpt/moovi.git && cd moovi
cp .env.example .env
```

(or, on a fresh Ubuntu box, `sudo bash deploy/server-setup.sh moovi.example.com` does steps 2 to 4: swap, Docker, a `.env`
with a fresh secret, `SITE_ADDRESS` and `PUBLIC_URL`, the build, the start and the seed)

## 3. Environment (.env)

| variable | value | why |
|----------|-------|-----|
| `MOOVI_SECRET` | a long random string (`openssl rand -hex 32`) | signs sessions; keep it, changing it signs everyone out |
| `SITE_ADDRESS` | `moovi.example.com` (or `<ip>.sslip.io`) | Caddy fetches the certificate for it |
| `PUBLIC_URL` | `https://moovi.example.com` | the address in the Claude Code connect command (`/mcp`) and allowed origin |
| `MOOVI_GRAPH_OPTIONAL` | `0` (or delete the line) | in production FalkorDB is required |
| `MOOVI_BYOK` | `optional` to let people use Claude Code with no key; `required` forces a key | |
| `FALKORDB_URL` | leave it; compose sets `falkor://falkordb:6379` | |

Optional: `MOOVI_STT_LOCAL_MODEL=onnx-community/whisper-small_timestamped` (smaller, faster speech model),
`MOOVI_FX=off` (no effects pass), any provider key you want as the server's own model.

## 4. First boot

```
docker compose build                 # about 10 minutes the first time
docker compose up -d falkordb studio worker caddy
docker compose run --rm seed         # loads the craft library (the effects come from it); safe to run again
docker compose ps                    # worker shows "healthy" after about a minute
curl -s https://moovi.example.com/healthz
```

The first edit downloads the speech model (about 760 MB) onto the `data` volume, once. The face, person cutout and
denoise models (a few MB) land there too (`HOME=/data/home`). Nothing is downloaded again when containers restart.

## 5. Connect Claude Code (each user)

1. Sign in at `https://moovi.example.com/studio`.
2. Open `https://moovi.example.com/connect`, click **Make my connect command**, and paste it in a terminal:
   `claude mcp add --scope user --transport http moovi https://moovi.example.com/mcp --header "Authorization: Bearer mvk_..."`
3. Upload a clip in the studio, then in Claude Code type `/mcp__moovi__run`. Claude Code keeps working until the
   video is done.

## Volumes (back these up)

- `data`: uploads, videos, the speech model, accounts' files (`/data`)
- `falkordb`: the graph (accounts, projects, tokens)
- `caddy`: certificates

`docker run --rm -v moovi_data:/d -v $PWD:/b alpine tar czf /b/data.tgz -C /d .` makes a copy; an EBS snapshot of the
whole disk is simpler.

## Load balancer instead of Caddy (optional)

Caddy on the machine is enough. If you put an ALB in front instead: target the studio on 3100 for `/studio*`, the
worker on 3200 for `/mcp*`, `/connect`, `/healthz` and `/api/brain/*`, health check `GET /healthz` on 3200, and set
the ALB **idle timeout to 120 s** (the bridge holds a request up to 45 s while Claude Code waits for the next step; the
default 60 s works but leaves little margin). Streaming responses must not be buffered. Keep both on one host name.

## FalkorDB on a managed service

The compose FalkorDB is the tested path. FalkorDB Cloud works with `FALKORDB_URL=falkor://user:pass@host:port`;
ElastiCache does not (it has no graph module). Run `seed` once against a new database.

## Updating

```
git pull && docker compose build && docker compose up -d && docker compose run --rm seed
```

## Checks when something is off

- `docker compose logs -f worker`: every edit logs its stages; an effects problem says the reason in one line
  (`[edit] effects edit: ...`) and the studio shows it.
- `claude mcp list` shows `moovi` failed: wrong `PUBLIC_URL`, or the token was replaced (make a new command).
- The effects render uses the Chromium inside the image (`MOOVI_CHROME_PATH=/usr/bin/chromium`); `shm_size: 1gb` is
  required for it.
