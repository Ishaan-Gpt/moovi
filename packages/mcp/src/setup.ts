/**
 * One prompt setup (Vignesh 2026-10-18: "rather than having 2 code can we have 1 prompt then claude code itself runs
 * and sets up?"). The website gives the user ONE prompt to paste into Claude Code. Claude Code runs the one command in
 * it, and that command (a script served here) does the two old steps itself: it adds the Moovi MCP server for later
 * sessions (`claude mcp add`, quiet, the token never printed) and, because a server added mid session is not usable in
 * the session that added it (Claude Code loads MCP servers at start), it starts a fresh headless Claude Code
 * (`claude -p`) in the background that loads the new server at its start and runs the usual moovi_next/moovi_answer
 * loop with a run ticket. The pasted window only watches a plain status line.
 *
 *   POST /api/brain/setup                 website (cookie): a one time setup code and the prompt text
 *   GET  /api/brain/setup/<code>.sh|.ps1  the script (no secret in it; safe to read before running)
 *   POST /api/brain/setup/<code>/claim    the script's call: first use only, mints the token and a run ticket
 *   GET  /api/brain/setup/<code>/status   one plain line (DONE/FAILED/IDLE at the end), for the pasted window
 *
 * The background Claude Code runs in a temp folder (no project hooks or CLAUDE.md in its way), with only Moovi's tools
 * allowed. The code is stored only as its sha256, like the token. Pure apart from the hub's store.
 */
import { createHash, randomBytes } from 'node:crypto';
import { corsHeaders } from './api';
import type { BrainHub } from './hub';

export const SETUP_PREFIX = 'mvs_';
/** the pasted prompt can be used this long */
export const SETUP_MS = 30 * 60_000;
/** after the claim, the status line answers this long */
export const SETUP_STATUS_MS = 6 * 3600_000;
/** no video started this long after the claim: the status says IDLE */
export const SETUP_IDLE_MS = 20 * 60_000;
const CODE_RE = /^mvs_[0-9a-f]{32}$/;
const key = (code: string) => `ce:brain:setup:${createHash('sha256').update(code, 'utf8').digest('hex')}`;
/** running: the videos already running at the claim (a clip uploaded before the paste); older finished ones never count */
interface SetupRecord { user: string; createdAt: number; claimedAt: number | null; running?: string[] }

/** The one line the background Claude Code is started with: no quotes or apostrophes, so every shell carries it as is. */
export function childPrompt(ticket: string): string {
  return `You are the Moovi brain for one video. Call the moovi_next tool with ticket set to ${ticket}. Then do what each result says: on think, decide as its system and task ask and call moovi_answer; on working or waiting, call moovi_next again at once. Never ask anything and never stop early. At done, failed or idle print one line that starts with MOOVI and stop.`;
}

/** The text the website shows (one copy button). Claude Code picks the line for its own shell. */
export function setupPrompt(origin: string, code: string): string {
  const base = `${origin}/api/brain/setup/${code}`;
  return [
    'Set up Moovi in this Claude Code and be the brain for my video. Do every step yourself and do not ask me anything.',
    '1. Run this one command. On Windows use the PowerShell line; anywhere else use the curl line. It adds the Moovi MCP server for later sessions and starts Moovi in the background. It prints no secret.',
    `   curl -fsSL ${base}.sh | sh`,
    `   irm ${base}.ps1 | iex`,
    `2. About once a minute check progress with: curl -fsS ${base}/status   (PowerShell: irm ${base}/status). Tell me one short line only when it changes.`,
    '3. Stop when it says DONE (give me the link), FAILED or IDLE.',
    'The code in these links works once, for 30 minutes.',
  ].join('\n');
}

const shQuote = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

/** POSIX sh (macOS, Linux, WSL, Git Bash). Holds no secret: the token arrives from the claim straight into `claude mcp add`. */
export function setupSh(origin: string, code: string, mcpUrl = `${origin}/mcp`): string {
  return `#!/bin/sh
# Moovi one prompt setup: adds Moovi to Claude Code for later sessions and starts Moovi in the background.
# No secret is in this file and none is printed.
S=${shQuote(origin)}; C=${shQuote(code)}; M=${shQuote(mcpUrl)}
if ! command -v claude >/dev/null 2>&1; then echo "MOOVI: the claude command is not on PATH in this shell. Use the connect command in Moovi Settings instead."; exit 1; fi
D="\${TMPDIR:-/tmp}/moovi"; mkdir -p "$D"; LOG="$D/brain-$(date +%s).log"
curl -fsS -X POST "$S/api/brain/setup/$C/claim" 2>/dev/null | {
  if ! read -r TOK || ! read -r TICKET || ! read -r PROMPT; then echo "MOOVI: this setup code was already used or has expired. Copy a fresh prompt from Moovi Settings."; exit 1; fi
  claude mcp remove moovi -s user >/dev/null 2>&1
  if ! claude mcp add --scope user --transport http moovi "$M" --header "Authorization: Bearer $TOK" >/dev/null 2>&1; then echo "MOOVI: claude mcp add failed."; exit 1; fi
  unset TOK CLAUDECODE CLAUDE_CODE_ENTRYPOINT
  cd "$D" || exit 1
  nohup claude -p "$PROMPT" --allowedTools mcp__moovi >"$LOG" 2>&1 </dev/null &
  echo "MOOVI: connected (run $TICKET). Moovi is running in the background; log: $LOG"
  echo "MOOVI: progress: curl -fsS $S/api/brain/setup/$C/status"
}
`;
}

/** Windows PowerShell 5.1 and PowerShell 7. Same steps; the background Claude Code is a hidden process. */
export function setupPs1(origin: string, code: string, mcpUrl = `${origin}/mcp`): string {
  const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
  return `# Moovi one prompt setup: adds Moovi to Claude Code for later sessions and starts Moovi in the background.
# No secret is in this file and none is printed.
$S = ${q(origin)}; $C = ${q(code)}; $M = ${q(mcpUrl)}
$cl = Get-Command claude -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $cl) { 'MOOVI: the claude command is not on PATH in this shell. Use the connect command in Moovi Settings instead.'; return }
try { $r = [string](Invoke-RestMethod -Method Post -Uri "$S/api/brain/setup/$C/claim") } catch { 'MOOVI: this setup code was already used or has expired. Copy a fresh prompt from Moovi Settings.'; return }
$l = $r -split "\\r?\\n"
if ($l.Count -lt 3) { 'MOOVI: the setup answer was not understood.'; return }
$tok = $l[0].Trim(); $ticket = $l[1].Trim(); $prompt = $l[2].Trim()
& $cl.Source mcp remove moovi -s user *> $null
& $cl.Source mcp add --scope user --transport http moovi $M --header "Authorization: Bearer $tok" *> $null
if ($LASTEXITCODE -ne 0) { 'MOOVI: claude mcp add failed.'; return }
Remove-Variable tok
$env:CLAUDECODE = $null; $env:CLAUDE_CODE_ENTRYPOINT = $null
$d = Join-Path $env:TEMP 'moovi'; New-Item -ItemType Directory -Force -Path $d | Out-Null
$log = Join-Path $d ('brain-' + [DateTimeOffset]::UtcNow.ToUnixTimeSeconds() + '.log')
Start-Process -FilePath $cl.Source -WorkingDirectory $d -ArgumentList @('-p', ('"' + $prompt + '"'), '--allowedTools', 'mcp__moovi') -WindowStyle Hidden -RedirectStandardOutput $log -RedirectStandardError ($log + '.err') | Out-Null
"MOOVI: connected (run $ticket). Moovi is running in the background; log: $log"
"MOOVI: progress: irm $S/api/brain/setup/$C/status"
`;
}

export interface SetupApiOptions {
  hub: BrainHub;
  /** the signed in user, or null (same contract as brainApi's userOf) */
  userOf: (req: Request, write: boolean) => Promise<string | null | { error: Response }>;
  origin: (req: Request) => string;
  mcpUrl: (req: Request) => string;
  /** origins whose pages may ask for a prompt with the user's cookie (the studio's Settings card), as brainApi */
  cors?: (origin: string) => boolean;
}

const plain = (body: string, status = 200, type = 'text/plain; charset=utf-8') => new Response(body, { status, headers: { 'content-type': type, 'cache-control': 'no-store' } });

export function setupApi(o: SetupApiOptions) {
  const { hub } = o;
  const read = async (code: string): Promise<SetupRecord | null> => {
    if (!CODE_RE.test(code)) return null;
    const v = await hub.store.get(key(code));
    return v ? JSON.parse(v) as SetupRecord : null;
  };

  async function mint(req: Request): Promise<Response> {
    if (req.method !== 'POST') return Response.json({ error: 'POST' }, { status: 405 });
    const u = await o.userOf(req, true).catch(() => null);
    if (u && typeof u === 'object') return u.error;
    if (!u) return Response.json({ error: 'Sign in first.' }, { status: 401 });
    const code = SETUP_PREFIX + randomBytes(16).toString('hex');
    const now = hub.now();
    await hub.store.set(key(code), JSON.stringify({ user: u, createdAt: now, claimedAt: null } satisfies SetupRecord), SETUP_MS);
    return Response.json({ prompt: setupPrompt(o.origin(req), code), expires_at: now + SETUP_MS }, { headers: { 'cache-control': 'no-store' } });
  }

  /** first use only: the token (replacing any old one, like Make a new command) and a run ticket for the background window */
  async function claim(code: string): Promise<Response> {
    const r = await read(code);
    if (!r || r.claimedAt !== null) return plain('MOOVI: this setup code was already used or has expired.', 410);
    r.claimedAt = hub.now();
    r.running = (await hub.board.running(r.user)).map(j => j.job);
    await hub.store.set(key(code), JSON.stringify(r), SETUP_STATUS_MS);
    const { token } = await hub.tokens.mint(r.user, 'Claude Code (one prompt)');
    const ticket = await hub.gate.mintTicket(r.user);
    return plain(`${token}\n${ticket}\n${childPrompt(ticket)}\n`);
  }

  async function status(code: string): Promise<Response> {
    const r = await read(code);
    if (!r) return plain('MOOVI: unknown or expired setup code.', 404);
    if (r.claimedAt === null) return plain('MOOVI: not set up yet: run the command from the prompt first.');
    const jobs = (await hub.board.recent(r.user)).filter(j => j.startedAt >= r.claimedAt! || (r.running ?? []).includes(j.job)).sort((a, b) => a.startedAt - b.startedAt);
    await hub.presence.prime(r.user);
    const cc = hub.presence.state(r.user);
    const last = jobs.at(-1);
    if (!last) return plain(hub.now() - r.claimedAt > SETUP_IDLE_MS ? 'MOOVI: IDLE: no video was started. Start one on the Moovi website, then type /mcp__moovi__run in Claude Code.' : `MOOVI: connected (Claude Code ${cc}); waiting for a video: upload a clip on the Moovi website.`);
    if (last.state === 'done') return plain(`MOOVI: DONE ${last.title ?? 'your video'} ${last.url ?? ''}`.trim());
    if (last.state === 'failed') return plain(`MOOVI: FAILED ${last.error ?? 'the website says why'}`);
    return plain(`MOOVI: working on ${last.title ?? 'your video'} (Claude Code ${cc}).`);
  }

  /** route by path under .../api/brain/setup (any base path), null for anything else */
  async function handle(req: Request): Promise<Response | null> {
    const p = new URL(req.url).pathname.replace(/\/+$/, '');
    if (p.endsWith('/api/brain/setup')) {
      const origin = req.headers.get('origin'), allow = !!origin && !!o.cors?.(origin);
      if (req.method === 'OPTIONS') return allow ? new Response(null, { status: 204, headers: corsHeaders(origin!) }) : Response.json({ error: 'not allowed' }, { status: 403 });
      const r = await mint(req);
      if (!allow) return r;
      const h = new Headers(r.headers); for (const [k, v] of Object.entries(corsHeaders(origin!))) h.set(k, v);
      return new Response(r.body, { status: r.status, headers: h });
    }
    const m = /\/api\/brain\/setup\/(mvs_[0-9a-f]{32})(\.sh|\.ps1|\/claim|\/status)$/.exec(p);
    if (!m) return /\/api\/brain\/setup\//.test(p) ? plain('MOOVI: unknown setup link.', 404) : null;
    const [, code, what] = m as unknown as [string, string, string];
    if (what === '/claim') return req.method === 'POST' ? claim(code) : plain('POST', 405);
    if (req.method !== 'GET') return plain('GET', 405);
    if (what === '/status') return status(code);
    // an expired link still answers 200 with a one line script, so `curl -f ... | sh` and `irm | iex` say why
    if (!(await read(code))) return plain(what === '.ps1' ? "'MOOVI: this setup link has expired. Copy a fresh prompt from Moovi Settings.'\n" : 'echo "MOOVI: this setup link has expired. Copy a fresh prompt from Moovi Settings."\n');
    const origin = o.origin(req), mcp = o.mcpUrl(req);
    return what === '.sh' ? plain(setupSh(origin, code, mcp), 200, 'text/x-shellscript; charset=utf-8') : plain(setupPs1(origin, code, mcp));
  }
  return { mint, claim, status, handle };
}
