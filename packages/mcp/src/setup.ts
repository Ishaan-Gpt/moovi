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
 *   POST /api/brain/setup/<code>/exit     the background Claude Code's wrapper says it stopped (?code=<exit code>)
 *   GET  /api/brain/setup/<code>/status   one plain line (DONE/FAILED/IDLE at the end), for the pasted window
 *
 * The background Claude Code runs in a temp folder (no project hooks or CLAUDE.md in its way), with only Moovi's tools
 * allowed. The code is stored only as its sha256, like the token. Pure apart from the hub's store.
 */
import { createHash, randomBytes } from 'node:crypto';
import { corsHeaders } from './api';
import type { BrainHub } from './hub';
import { ONLINE_MS } from './scope';
import { KEY } from './store';

export const SETUP_PREFIX = 'mvs_';
/** the pasted prompt can be used this long */
export const SETUP_MS = 30 * 60_000;
/** after the claim, the status line answers this long */
export const SETUP_STATUS_MS = 6 * 3600_000;
/** no video started this long after the claim: the status says IDLE */
export const SETUP_IDLE_MS = 20 * 60_000;
/** the background Claude Code has not called Moovi this long after the claim: FAILED (not signed in, crashed, blocked) */
export const SETUP_CONNECT_MS = 3 * 60_000;
/** a background Claude Code that was connected and has been silent this long while a video runs: FAILED, not hung */
export const SETUP_QUIET_MS = ONLINE_MS + 3 * 60_000;
/** a clean exit while the video still shows running: the finish is allowed this long to land before it reads FAILED */
export const SETUP_EXIT_GRACE_MS = 2 * 60_000;
const CODE_RE = /^mvs_[0-9a-f]{32}$/;
const key = (code: string) => `ce:brain:setup:${createHash('sha256').update(code, 'utf8').digest('hex')}`;
/** running: the videos already running at the claim (a clip uploaded before the paste); older finished ones never count.
 *  exit: what the background Claude Code's wrapper reported when it stopped. */
interface SetupRecord { user: string; createdAt: number; claimedAt: number | null; running?: string[]; exit?: { code: number; at: number } }

/** The one line the background Claude Code is started with: no quotes, apostrophes or shell signs, so every shell
 *  (sh, PowerShell, cmd behind a claude.cmd shim) carries it as is. */
export function childPrompt(ticket: string): string {
  return `You are the Moovi brain for one video. Call the moovi_next tool with ticket set to ${ticket}. Then do what each result says: on think, decide as its system and task ask and call moovi_answer; on working or waiting, call moovi_next again at once. Never ask anything and never stop early. At done, failed or idle print one line that starts with MOOVI and stop.`;
}

/** The text the website shows (one copy button). One line works everywhere Claude Code runs a POSIX shell (macOS,
 *  Linux, and Windows, where Claude Code's shell is Git Bash and the sh script hands over to PowerShell itself); the
 *  PowerShell line is only for a shell without sh. Said once in the card, not here: the code works once, for 30 min. */
export function setupPrompt(origin: string, code: string): string {
  const base = `${origin}/api/brain/setup/${code}`;
  return [
    'Connect Moovi and make my video. Do every step yourself and ask me nothing.',
    `1. Run: curl -fsSL ${base}.sh | sh`,
    `   If your shell has no sh, run instead: powershell -NoProfile -Command "irm ${base}.ps1 | iex"`,
    '2. Run the progress command it prints about once a minute. Tell me in one short line when it changes.',
    '3. Stop at DONE (give me the link), FAILED or IDLE.',
  ].join('\n');
}

const shQuote = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;
const psQuote = (s: string) => `'${s.replace(/'/g, "''")}'`;

/** POSIX sh (macOS, Linux, WSL; Git Bash hands over to the PowerShell script). Holds no secret: the token arrives from
 *  the claim straight into `claude mcp add` and is never printed. The background Claude Code runs under a small wrapper
 *  that tells the server when it stops, so a crash reads FAILED instead of hanging. */
export function setupSh(origin: string, code: string, mcpUrl = `${origin}/mcp`): string {
  return `#!/bin/sh
# Moovi one prompt setup: adds Moovi to Claude Code for later sessions and starts Moovi in the background.
# No secret is in this file and none is printed. Safe to read before running.
S=${shQuote(origin)}; C=${shQuote(code)}; M=${shQuote(mcpUrl)}
U="$S/api/brain/setup/$C"
case "$(uname -s 2>/dev/null)" in
  MINGW*|MSYS*|CYGWIN*)
    # Windows (Git Bash): the PowerShell script starts the background Claude Code the Windows way
    if command -v powershell.exe >/dev/null 2>&1; then exec powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor 3072; irm '$U.ps1' | iex"; fi;;
esac
if command -v curl >/dev/null 2>&1; then
  post() { curl -sS -X POST -w '\\n%{http_code}' "$1" 2>/dev/null; }
  PROGRESS="curl -fsS $U/status"
elif command -v wget >/dev/null 2>&1; then
  # wget has no status code switch: exit 8 is an error answer from the server (410: used or expired)
  post() { B=$(wget -q -O - --post-data= "$1" 2>/dev/null); rc=$?; if [ $rc -eq 0 ]; then printf '%s\\n200' "$B"; elif [ $rc -eq 8 ]; then printf '\\n410'; else printf '\\n000'; fi; }
  PROGRESS="wget -qO- $U/status"
else
  echo "MOOVI: FAILED: neither curl nor wget is installed here. Install curl, or use the connect command in Moovi Settings."; exit 1
fi
CL=$(command -v claude 2>/dev/null)
for p in "$HOME/.local/bin/claude" "$HOME/.claude/local/claude" /opt/homebrew/bin/claude /usr/local/bin/claude; do [ -n "$CL" ] && break; [ -x "$p" ] && CL="$p"; done
if [ -z "$CL" ]; then echo "MOOVI: FAILED: the claude command was not found in this shell. Use the connect command in Moovi Settings instead."; exit 1; fi
R=$(post "$U/claim")
H=$(printf '%s\\n' "$R" | tail -n 1)
case "$H" in
  200) ;;
  410|404) echo "MOOVI: FAILED: this setup code was already used or has expired. Copy a fresh prompt from Moovi Settings."; exit 1;;
  *) echo "MOOVI: FAILED: could not reach Moovi at $S (answer: \${H:-none}). Check the internet connection and run the same command again."; exit 1;;
esac
TICKET=$(printf '%s\\n' "$R" | sed -n 2p); PROMPT=$(printf '%s\\n' "$R" | sed -n 3p)
# a moovi entry in this folder's local scope would shadow the new user scope one in later sessions here
"$CL" mcp remove moovi -s local >/dev/null 2>&1
"$CL" mcp remove moovi -s user >/dev/null 2>&1
if ! "$CL" mcp add --scope user --transport http moovi "$M" --header "Authorization: Bearer $(printf '%s\\n' "$R" | sed -n 1p)" >/dev/null 2>&1; then
  R=; echo "MOOVI: FAILED: claude mcp add did not work. Update Claude Code (claude update) and run the same command again."; exit 1
fi
R=
unset CLAUDECODE CLAUDE_CODE_ENTRYPOINT
D="\${TMPDIR:-/tmp}"; D="\${D%/}/moovi"; mkdir -p "$D" || exit 1
LOG="$D/brain-$(date +%s).log"
export MOOVI_CL="$CL" MOOVI_P="$PROMPT" MOOVI_LOG="$LOG" MOOVI_X="$U/exit"
# a new session, so the background run outlives this shell's process group (setsid on Linux, perl on macOS)
if command -v setsid >/dev/null 2>&1; then SID=setsid; elif command -v perl >/dev/null 2>&1; then SID="perl -MPOSIX -e POSIX::setsid();exec(@ARGV)"; else SID=; fi
# the wrapper: the background Claude Code, then one call that says it stopped and how
cd "$D" && nohup $SID sh -c '"$MOOVI_CL" -p "$MOOVI_P" --allowedTools mcp__moovi >"$MOOVI_LOG" 2>&1 </dev/null; rc=$?; if command -v curl >/dev/null 2>&1; then curl -fsS -X POST "$MOOVI_X?code=$rc" >/dev/null 2>&1; else wget -q -O /dev/null --post-data= "$MOOVI_X?code=$rc" >/dev/null 2>&1; fi' >/dev/null 2>&1 </dev/null &
echo "MOOVI: connected (run $TICKET). Moovi now runs in the background. Log: $LOG"
echo "MOOVI: progress command: $PROGRESS"
`;
}

/** Windows PowerShell 5.1 and PowerShell 7 (also pwsh on macOS/Linux). Same steps. The background Claude Code runs
 *  under a wrapper passed as -EncodedCommand (no quoting at all, spaces in paths and user names are fine), started with
 *  Start-Process: on Windows a hidden window through the shell, which hands none of this console's handles on, so the
 *  Claude Code that ran this script is never kept waiting by the background one. */
export function setupPs1(origin: string, code: string, mcpUrl = `${origin}/mcp`): string {
  return `# Moovi one prompt setup: adds Moovi to Claude Code for later sessions and starts Moovi in the background.
# No secret is in this file and none is printed. Safe to read before running.
& {
$S = ${psQuote(origin)}; $C = ${psQuote(code)}; $M = ${psQuote(mcpUrl)}
$U = "$S/api/brain/setup/$C"
$win = ($PSVersionTable.PSEdition -eq 'Desktop') -or $IsWindows
try { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor 3072 } catch {}
$cl = Get-Command claude -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Path
if (-not $cl) {
  $try = @((Join-Path $HOME '.local/bin/claude.exe'), (Join-Path $HOME '.local/bin/claude'), (Join-Path $HOME '.claude/local/claude'))
  if ($env:APPDATA) { $try += (Join-Path $env:APPDATA 'npm/claude.cmd') }
  foreach ($p in $try) { if (Test-Path -LiteralPath $p -PathType Leaf) { $cl = $p; break } }
}
if (-not $cl) { 'MOOVI: FAILED: the claude command was not found in this shell. Use the connect command in Moovi Settings instead.'; return }
try { $r = (Invoke-WebRequest -UseBasicParsing -Method Post -Uri "$U/claim").Content } catch {
  if ($_.Exception.Response) { 'MOOVI: FAILED: this setup code was already used or has expired. Copy a fresh prompt from Moovi Settings.' }
  else { "MOOVI: FAILED: could not reach Moovi at $S. Check the internet connection and run the same command again." }
  return
}
if ($r -is [byte[]]) { $r = [Text.Encoding]::UTF8.GetString($r) }
$l = ([string]$r) -split "\\r?\\n"
if ($l.Count -lt 3) { 'MOOVI: FAILED: the setup answer was not understood.'; return }
$ticket = $l[1].Trim(); $prompt = $l[2].Trim()
# a moovi entry in this folder's local scope would shadow the new user scope one in later sessions here
& $cl mcp remove moovi -s local *> $null
& $cl mcp remove moovi -s user *> $null
& $cl mcp add --scope user --transport http moovi $M --header ('Authorization: Bearer ' + $l[0].Trim()) *> $null
$ok = $LASTEXITCODE -eq 0
$r = $null; $l = $null
if (-not $ok) { 'MOOVI: FAILED: claude mcp add did not work. Update Claude Code (claude update) and run the same command again.'; return }
$env:CLAUDECODE = $null; $env:CLAUDE_CODE_ENTRYPOINT = $null
$d = Join-Path ([IO.Path]::GetTempPath()) 'moovi'; New-Item -ItemType Directory -Force -Path $d | Out-Null
$log = Join-Path $d ('brain-' + [DateTimeOffset]::UtcNow.ToUnixTimeSeconds() + '.log')
$q = { param($s) "'" + ($s -replace "'", "''") + "'" }
$w = "Set-Location -LiteralPath $(& $q $d)" + [Environment]::NewLine +
  "& $(& $q $cl) -p $(& $q $prompt) --allowedTools mcp__moovi 2>&1 | Out-File -LiteralPath $(& $q $log) -Encoding utf8" + [Environment]::NewLine +
  "\`$c = \`$LASTEXITCODE; try { Invoke-WebRequest -UseBasicParsing -Method Post -Uri ($(& $q "$U/exit?code=") + \`$c) | Out-Null } catch {}"
$enc = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($w))
$sp = @{ FilePath = (Get-Process -Id $PID).Path; ArgumentList = @('-NoProfile', '-NonInteractive', '-EncodedCommand', $enc); WorkingDirectory = $d }
if ($win) { $sp.WindowStyle = 'Hidden' }
else { $sp.RedirectStandardOutput = "$log.out"; $sp.RedirectStandardError = "$log.err"; $sp.RedirectStandardInput = '/dev/null' }
try { Start-Process @sp } catch { 'MOOVI: FAILED: could not start the background Claude Code: ' + $_.Exception.Message; return }
"MOOVI: connected (run $ticket). Moovi now runs in the background. Log: $log"
$pc = if ($win) { 'curl.exe' } else { 'curl' }
"MOOVI: progress command: $pc -fsS $U/status"
}
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

  /** first use only: the token (replacing any old one, like Make a new command) and a run ticket for the background window.
   *  Two scripts racing on one code: the setNx lock lets exactly one through. */
  async function claim(code: string): Promise<Response> {
    const used = () => plain('MOOVI: this setup code was already used or has expired.', 410);
    const r = await read(code);
    if (!r || r.claimedAt !== null) return used();
    if (!(await hub.store.setNx(`${key(code)}:claim`, '1', SETUP_STATUS_MS))) return used();
    r.claimedAt = hub.now();
    r.running = (await hub.board.running(r.user)).map(j => j.job);
    await hub.store.set(key(code), JSON.stringify(r), SETUP_STATUS_MS);
    const { token } = await hub.tokens.mint(r.user, 'Claude Code (one prompt)');
    const ticket = await hub.gate.mintTicket(r.user);
    return plain(`${token}\n${ticket}\n${childPrompt(ticket)}\n`);
  }

  /** the wrapper's last word: the background Claude Code stopped with this exit code (first report wins) */
  async function exit(code: string, req: Request): Promise<Response> {
    const r = await read(code);
    if (!r || r.claimedAt === null) return plain('MOOVI: unknown or expired setup code.', 404);
    const n = Number(new URL(req.url).searchParams.get('code'));
    if (!r.exit) { r.exit = { code: Number.isInteger(n) ? n : -1, at: hub.now() }; await hub.store.set(key(code), JSON.stringify(r), SETUP_STATUS_MS); }
    return plain('ok');
  }

  /** when the user's Claude Code last called Moovi (the shared presence reading, written by real calls only) */
  async function lastSeen(user: string): Promise<number | null> {
    const v = await hub.store.get(KEY.seen(user)).catch(() => null);
    const n = v === null ? NaN : Number(v);
    return Number.isFinite(n) ? n : null;
  }

  async function status(code: string): Promise<Response> {
    const r = await read(code);
    if (!r) return plain('MOOVI: unknown or expired setup code.', 404);
    if (r.claimedAt === null) return plain('MOOVI: not set up yet: run the command from the prompt first.');
    const now = hub.now(), claimed = r.claimedAt;
    const jobs = (await hub.board.recent(r.user)).filter(j => j.startedAt >= claimed || (r.running ?? []).includes(j.job)).sort((a, b) => a.startedAt - b.startedAt);
    const last = jobs.at(-1);
    if (last?.state === 'done') return plain(`MOOVI: DONE ${last.title ?? 'your video'} ${last.url ?? ''}`.trim());
    if (last?.state === 'failed') return plain(`MOOVI: FAILED ${last.error ?? 'the website says why'}`);
    const seen = await lastSeen(r.user);
    const connected = seen !== null && seen >= claimed;
    const pickUp = 'Open Claude Code and type /mcp__moovi__run to pick the video up.';
    // the wrapper said the background Claude Code stopped
    if (r.exit) {
      if (!last) return plain(r.exit.code === 0 ? 'MOOVI: IDLE: the background Claude Code stopped before a video started. Start one on the Moovi website, then type /mcp__moovi__run in Claude Code.'
        : `MOOVI: FAILED: the background Claude Code stopped (exit ${r.exit.code})${connected ? '' : ' before it connected; is Claude Code signed in?'}. Its log is in the moovi folder the setup printed.`);
      if (r.exit.code !== 0 || now - r.exit.at > SETUP_EXIT_GRACE_MS) return plain(`MOOVI: FAILED: the background Claude Code stopped (exit ${r.exit.code}) while ${last.title ?? 'your video'} was still running. ${pickUp}`);
    }
    // no word from the wrapper (a killed process, a sleeping computer): judge by when it last called Moovi
    if (!connected && now - claimed > SETUP_CONNECT_MS) return plain('MOOVI: FAILED: the background Claude Code never connected. Is Claude Code signed in (run claude once)? Its log is in the moovi folder the setup printed.');
    if (connected && last && now - seen! > SETUP_QUIET_MS) return plain(`MOOVI: FAILED: the background Claude Code went quiet while ${last.title ?? 'your video'} was running. ${pickUp}`);
    if (!last) return plain(now - claimed > SETUP_IDLE_MS ? 'MOOVI: IDLE: no video was started. Start one on the Moovi website, then type /mcp__moovi__run in Claude Code.'
      : `MOOVI: ${connected ? 'connected' : 'connecting'}; waiting for a video: upload a clip on the Moovi website.`);
    return plain(`MOOVI: working on ${last.title ?? 'your video'}.`);
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
    const m = /\/api\/brain\/setup\/(mvs_[0-9a-f]{32})(\.sh|\.ps1|\/claim|\/exit|\/status)$/.exec(p);
    if (!m) return /\/api\/brain\/setup\//.test(p) ? plain('MOOVI: unknown setup link.', 404) : null;
    const [, code, what] = m as unknown as [string, string, string];
    if (what === '/claim') return req.method === 'POST' ? claim(code) : plain('POST', 405);
    if (what === '/exit') return req.method === 'POST' ? exit(code, req) : plain('POST', 405);
    if (req.method !== 'GET') return plain('GET', 405);
    if (what === '/status') return status(code);
    // an expired link still answers 200 with a one line script, so `curl -f ... | sh` and `irm | iex` say why. The
    // PowerShell line is a command, not a bare 'string': irm reads a bare quoted line as JSON and iex then runs its words
    // (found running pwsh 7.4.6, 2026-10-18)
    if (!(await read(code))) return plain(what === '.ps1' ? "Write-Output 'MOOVI: this setup link has expired. Copy a fresh prompt from Moovi Settings.'\n" : 'echo "MOOVI: this setup link has expired. Copy a fresh prompt from Moovi Settings."\n');
    const origin = o.origin(req), mcp = o.mcpUrl(req);
    return what === '.sh' ? plain(setupSh(origin, code, mcp), 200, 'text/x-shellscript; charset=utf-8') : plain(setupPs1(origin, code, mcp));
  }
  return { mint, claim, exit, status, handle };
}
