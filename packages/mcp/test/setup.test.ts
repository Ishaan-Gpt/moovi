import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { BrainHub, bridgeApp, childPrompt, memoryStore, SETUP_CONNECT_MS, SETUP_EXIT_GRACE_MS, SETUP_IDLE_MS, SETUP_MS, SETUP_QUIET_MS, type BrainStore } from '../src/index';

// the one prompt setup (setup.ts): one pasted prompt, Claude Code runs one command, the script adds the server and starts a background Claude Code
let t = 1_000_000;
const written: string[] = [];
const inner = memoryStore(() => t);
const store: BrainStore = { ...inner, set: async (k, v, ttl) => { written.push(k, v); return inner.set(k, v, ttl); } };
const hub = new BrainHub(store, () => t);
const logs: string[] = [];
const app = bridgeApp(hub, { userOf: async req => req.headers.get('x-test-user'), cors: o => o === 'http://site.test', log: l => { logs.push(l); } });
await new Promise<void>(res => app.http.listen(0, '127.0.0.1', res));
const base = `http://127.0.0.1:${(app.http.address() as AddressInfo).port}`;
const dir = mkdtempSync(join(tmpdir(), 'moovi-setup-'));
after(async () => { await app.close(); rmSync(dir, { recursive: true, force: true }); });

async function makePrompt(user = 'u1') {
  const r = await fetch(`${base}/api/brain/setup`, { method: 'POST', headers: { 'x-test-user': user } });
  assert.equal(r.status, 200);
  const j = await r.json() as { prompt: string; expires_at: number };
  const code = /\/api\/brain\/setup\/(mvs_[0-9a-f]{32})\//.exec(j.prompt)![1]!;
  return { ...j, code };
}
/** run a shell script without blocking this process (the server under test lives in it) */
function runSh(script: string, env: NodeJS.ProcessEnv): Promise<{ status: number | null; stdout: string; stderr: string }> {
  return new Promise(res => {
    const p = spawn('/bin/sh', ['-c', script], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    p.stdout.on('data', d => { stdout += d; }); p.stderr.on('data', d => { stderr += d; });
    const k = setTimeout(() => p.kill('SIGKILL'), 20_000);
    p.on('close', status => { clearTimeout(k); res({ status, stdout, stderr }); });
  });
}
const line = async (code: string) => (await fetch(`${base}/api/brain/setup/${code}/status`)).text();

test('setup: sign in first; the prompt is plain commands only (no piped remote script); the code is stored only as a hash', async () => {
  assert.equal((await fetch(`${base}/api/brain/setup`, { method: 'POST' })).status, 401);
  const { prompt, code, expires_at } = await makePrompt();
  assert.equal(expires_at, t + SETUP_MS);
  const u = `${base}/api/brain/setup/${code}`;
  // Claude Code's permission classifier blocks `curl ... | sh` and `irm ... | iex` (Vignesh on Windows, 2026-10-18 15:25 IST)
  assert.doesNotMatch(prompt, /\|\s*(sh|bash|iex)\b/, 'nothing fetched is piped into a shell');
  assert.doesNotMatch(prompt, /\.sh\b|\.ps1\b|Invoke-Expression/, 'the scripts are a manual fallback, not in the prompt');
  assert.ok(prompt.includes(`curl -sS -X POST ${u}/claim.json`), 'step 1: a plain claim call');
  assert.ok(prompt.includes(`Invoke-RestMethod -Method Post -Uri ${u}/claim.json`));
  assert.ok(prompt.includes(`claude mcp add --scope user --transport http moovi ${base}/mcp --header "Authorization: Bearer TOKEN"`), 'step 2: literal URL and header');
  assert.ok(prompt.includes(`claude -p "${childPrompt('TICKET')}" --allowedTools mcp__moovi`), 'step 3: the same background run the scripts start');
  assert.ok(prompt.includes(`curl -sS -X POST "${u}/exit?code=$?"`), 'the exit is reported, so a crash reads FAILED');
  assert.ok(prompt.includes(`curl -sS ${u}/status`));
  assert.match(prompt, /ask me nothing/);
  assert.match(prompt, /Do not show me the token/);
  assert.match(prompt, /DONE \(give me the link\), FAILED or IDLE/);
  assert.doesNotMatch(prompt, /mvk_|rt_[0-9a-f]/, 'no token or ticket in the pasted text');
  assert.doesNotMatch(prompt, /[\u2013\u2014]/, 'no dashes');
  assert.ok(!written.some(v => v.includes(code)), 'the code itself never reaches the store');
  const pre = await fetch(`${base}/api/brain/setup`, { method: 'OPTIONS', headers: { origin: 'http://site.test' } });
  assert.equal(pre.status, 204, 'the Settings card on another port may ask');
  assert.equal(await line(code), 'MOOVI: not set up yet: run the command from the prompt first.');
});

test('claim.json: works once, answers the fields the prompt names, and a used code answers ok false with a reason', async () => {
  const { code } = await makePrompt('j1');
  const u = `${base}/api/brain/setup/${code}`;
  assert.equal((await fetch(`${u}/claim.json`)).status, 405, 'POST only');
  const r = await fetch(`${u}/claim.json`, { method: 'POST' });
  assert.equal(r.status, 200); assert.match(r.headers.get('content-type') ?? '', /application\/json/);
  const j = await r.json() as Record<string, unknown>;
  assert.equal(j.ok, true);
  assert.equal((await hub.tokens.verify(String(j.token)))?.user, 'j1');
  assert.match(String(j.ticket), /^rt_[0-9a-f]+$/);
  assert.equal(j.header, `Authorization: Bearer ${j.token}`);
  assert.equal(j.mcp_url, `${base}/mcp`);
  assert.equal(j.prompt, childPrompt(String(j.ticket)));
  assert.equal(j.status_url, `${u}/status`);
  assert.equal(j.exit_url, `${u}/exit`);
  const again = await fetch(`${u}/claim.json`, { method: 'POST' });
  assert.equal(again.status, 410);
  assert.deepEqual(await again.json(), { ok: false, error: 'MOOVI: this setup code was already used or has expired. Copy a fresh prompt from Moovi Settings.' });
  assert.equal((await fetch(`${u}/claim`, { method: 'POST' })).status, 410, 'one code, one claim, whichever door');
  assert.equal((await fetch(`${base}/api/brain/setup/mvs_${'0'.repeat(32)}/claim.json`, { method: 'POST' })).status, 410);
});

test('setup: the scripts hold no secret, parse as sh, and an expired or unknown link says so', async () => {
  const { code } = await makePrompt();
  const sh = await (await fetch(`${base}/api/brain/setup/${code}.sh`)).text();
  const ps = await (await fetch(`${base}/api/brain/setup/${code}.ps1`)).text();
  for (const s of [sh, ps]) { assert.doesNotMatch(s, /mvk_/); assert.ok(s.includes(code)); assert.ok(s.includes(`${base}/mcp`)); assert.match(s, /mcp add --scope user --transport http moovi/); assert.match(s, /--allowedTools/); }
  writeFileSync(join(dir, 'a.sh'), sh);
  assert.equal(spawnSync('sh', ['-n', join(dir, 'a.sh')]).status, 0, 'valid POSIX sh');
  assert.match(ps, /Start-Process/); assert.match(ps, /\$env:CLAUDECODE = \$null/); assert.match(ps, /-EncodedCommand/); assert.match(sh, /MINGW\*\|MSYS\*\|CYGWIN\*\) *$/m);
  assert.equal((await fetch(`${base}/api/brain/setup/mvs_${'0'.repeat(32)}.sh`)).status, 200);
  assert.match(await (await fetch(`${base}/api/brain/setup/mvs_${'0'.repeat(32)}.sh`)).text(), /^echo "MOOVI: this setup link has expired/);
  assert.equal((await fetch(`${base}/api/brain/setup/nope.sh`)).status, 404);
  t += SETUP_MS + 1;
  assert.equal((await fetch(`${base}/api/brain/setup/${code}/claim`, { method: 'POST' })).status, 410, 'a 30 minute old prompt no longer works');
});

test('setup: claim works once, the token is the user\'s, and the ticket starts a run in a fresh window', async () => {
  const { code } = await makePrompt('u2');
  const r = await fetch(`${base}/api/brain/setup/${code}/claim`, { method: 'POST' });
  assert.equal(r.status, 200);
  const [token, ticket, child] = (await r.text()).trim().split('\n');
  assert.equal((await hub.tokens.verify(token!))?.user, 'u2');
  assert.match(ticket!, /^rt_[0-9a-f]+$/);
  assert.equal(child, childPrompt(ticket!));
  assert.doesNotMatch(child!, /["'`$]/, 'the child prompt needs no quoting in any shell');
  assert.equal((await fetch(`${base}/api/brain/setup/${code}/claim`, { method: 'POST' })).status, 410, 'second use refused');
  assert.equal((await fetch(`${base}/api/brain/setup/${code}/claim`)).status, 405);
  const c = new Client({ name: 'headless-claude-standin', version: '1' });
  await c.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`), { requestInit: { headers: { Authorization: `Bearer ${token}` } } }));
  const out = JSON.parse(((await c.callTool({ name: 'moovi_next', arguments: { ticket, wait_s: 0 } })).content as { text: string }[])[0]!.text);
  assert.equal(out.status, 'waiting', 'the ticket is good: waiting for a video, not idle');
  await c.close();
  assert.match(await line(code), /^MOOVI: connected; waiting for a video/);
  await hub.board.start({ user: 'u2', job: 'j1', title: 'My clip' });
  assert.equal(await line(code), 'MOOVI: working on My clip.');
  await hub.board.finish({ job: 'j1', ok: true });
  assert.equal(await line(code), 'MOOVI: DONE My clip');
});

test('setup: an older finished video never reads as DONE; a clip already running at the paste counts', async () => {
  await hub.board.start({ user: 'u5', job: 'old', title: 'Old clip' }); await hub.board.finish({ job: 'old', ok: true });
  t += 1000;
  await hub.board.start({ user: 'u5', job: 'up', title: 'Uploaded first' });
  t += 1000;
  const { code } = await makePrompt('u5');
  await fetch(`${base}/api/brain/setup/${code}/claim`, { method: 'POST' });
  assert.match(await line(code), /^MOOVI: working on Uploaded first/);
  await hub.board.finish({ job: 'up', ok: false, error: 'the clip has no sound' });
  assert.equal(await line(code), 'MOOVI: FAILED the clip has no sound');
});

test('setup: connected but no video started reads IDLE', async () => {
  const { code } = await makePrompt('u3');
  await fetch(`${base}/api/brain/setup/${code}/claim`, { method: 'POST' });
  assert.match(await line(code), /^MOOVI: connecting; waiting for a video/);
  hub.presence.touch('u3');
  t += SETUP_IDLE_MS + 1;
  hub.presence.touch('u3');
  assert.match(await line(code), /^MOOVI: IDLE: no video was started/);
});

test('setup: the real sh script against this server, with a stand in claude on PATH: add, then a background claude -p; no token printed', async () => {
  const { code } = await makePrompt('u4');
  const bin = join(dir, 'bin'); execFileSync('mkdir', ['-p', bin]);
  const calls = join(dir, 'calls.txt');
  // the stand in records each call; the -p one records its prompt and whether CLAUDECODE leaked through
  writeFileSync(join(bin, 'claude'), `#!/bin/sh\nif [ "$1" = "-p" ]; then echo "P|$2|$3|$4|CC=\${CLAUDECODE:-unset}" >> ${calls}; else echo "C|$*" >> ${calls}; fi\n`);
  chmodSync(join(bin, 'claude'), 0o755);
  const sh = await (await fetch(`${base}/api/brain/setup/${code}.sh`)).text();
  const r = await runSh(sh, { ...process.env, PATH: `${bin}:${process.env.PATH}`, TMPDIR: dir, CLAUDECODE: '1' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /MOOVI: connected \(run rt_[0-9a-f]+\)/);
  assert.doesNotMatch(r.stdout + r.stderr, /mvk_/, 'the token is never printed');
  await new Promise(res => setTimeout(res, 300)); // the background child
  const got = readFileSync(calls, 'utf8').trim().split('\n');
  assert.deepEqual(got.slice(0, 2), ['C|mcp remove moovi -s local', 'C|mcp remove moovi -s user'], 'an old local entry cannot shadow the new one');
  const add = /^C\|mcp add --scope user --transport http moovi (\S+) --header Authorization: Bearer (mvk_\S+)$/.exec(got[2]!)!;
  assert.equal(add[1], `${base}/mcp`);
  assert.equal((await hub.tokens.verify(add[2]!))?.user, 'u4', 'the token claude mcp add got is the live one');
  const p = got.find(l => l.startsWith('P|'))!.split('|');
  assert.match(p[1]!, /^You are the Moovi brain for one video\. Call the moovi_next tool with ticket set to rt_/);
  assert.deepEqual([p[2], p[3], p[4]], ['--allowedTools', 'mcp__moovi', 'CC=unset'], 'only Moovi tools, and the nested session guard is cleared');
  const again = await runSh(sh, { ...process.env, PATH: `${bin}:${process.env.PATH}`, TMPDIR: dir });
  assert.match(again.stdout, /already used or has expired/, 'running it twice is harmless');
});

// ---- round 2 hardening (2026-10-18): every state of the status line, the wrapper's exit report, and the script's edges

/** a stand in claude that keeps real state: `mcp add` refuses a name that exists in that scope (as claude does),
 *  `mcp remove` drops it, `-p` records its call and exits with $FAKE_EXIT after $FAKE_SLEEP seconds */
function fakeClaude(where: string): { bin: string; state: string; calls: string } {
  const bin = join(where, 'bin dir'); mkdirSync(bin, { recursive: true });
  const state = join(where, 'state'), calls = join(where, 'calls.txt');
  writeFileSync(join(bin, 'claude'), `#!/bin/sh
ST='${state}'; touch "$ST"
if [ "$1" = "-p" ]; then echo "P|$2|$3|$4|CC=\${CLAUDECODE:-none}|PWD=$(pwd)" >> '${calls}'; sleep \${FAKE_SLEEP:-0}; exit \${FAKE_EXIT:-0}; fi
echo "C|$*" >> '${calls}'
if [ "$1 $2" = "mcp add" ]; then grep -q "^user moovi " "$ST" && { echo "MCP server moovi already exists in user config" >&2; exit 1; }; echo "user moovi $*" >> "$ST"; exit 0; fi
if [ "$1 $2 $3" = "mcp remove moovi" ]; then grep -v "^$5 moovi " "$ST" > "$ST.n"; mv "$ST.n" "$ST"; exit 0; fi
exit 0
`);
  chmodSync(join(bin, 'claude'), 0o755);
  return { bin, state, calls };
}
const until = async (f: () => boolean | Promise<boolean>, ms = 5000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await f()) return true; await new Promise(r => setTimeout(r, 50)); } return false; };
const shOf = async (code: string) => (await fetch(`${base}/api/brain/setup/${code}.sh`)).text();

test('status: every state, from the wrapper report and from silence (FAILED, not hung forever)', async () => {
  const claim = async (u: string) => { const { code } = await makePrompt(u); await fetch(`${base}/api/brain/setup/${code}/claim`, { method: 'POST' }); return code; };
  const exit = (code: string, n: number) => fetch(`${base}/api/brain/setup/${code}/exit?code=${n}`, { method: 'POST' });
  // never connected: FAILED after SETUP_CONNECT_MS, not "waiting" for 20 minutes
  let c = await claim('s1');
  t += SETUP_CONNECT_MS + 1;
  assert.match(await line(c), /^MOOVI: FAILED: the background Claude Code never connected\. Is Claude Code signed in/);
  // died before connecting (not signed in): the wrapper's exit code
  c = await claim('s2'); await exit(c, 1);
  assert.match(await line(c), /^MOOVI: FAILED: the background Claude Code stopped \(exit 1\) before it connected/);
  // stopped cleanly without a video (it was told idle): IDLE
  c = await claim('s3'); hub.presence.touch('s3'); await exit(c, 0);
  assert.match(await line(c), /^MOOVI: IDLE: the background Claude Code stopped before a video started/);
  // crashed mid video: FAILED at once, with the way to pick it up
  c = await claim('s4'); hub.presence.touch('s4'); await hub.board.start({ user: 's4', job: 'k4', title: 'Clip four' }); await exit(c, 137);
  assert.equal(await line(c), 'MOOVI: FAILED: the background Claude Code stopped (exit 137) while Clip four was still running. Open Claude Code and type /mcp__moovi__run to pick the video up.');
  assert.equal((await exit(c, 0)).status, 200); assert.match(await line(c), /exit 137/, 'the first report wins');
  // clean exit as the video finishes: a grace, then DONE (or FAILED if the finish never lands)
  c = await claim('s5'); hub.presence.touch('s5'); await hub.board.start({ user: 's5', job: 'k5', title: 'Clip five' }); await exit(c, 0);
  assert.equal(await line(c), 'MOOVI: working on Clip five.');
  await hub.board.finish({ job: 'k5', ok: true }); assert.equal(await line(c), 'MOOVI: DONE Clip five');
  c = await claim('s6'); hub.presence.touch('s6'); await hub.board.start({ user: 's6', job: 'k6', title: 'Clip six' }); await exit(c, 0);
  t += SETUP_EXIT_GRACE_MS + 1;
  assert.match(await line(c), /^MOOVI: FAILED: the background Claude Code stopped \(exit 0\) while Clip six/);
  // killed with no report (closed laptop, killed process): quiet past SETUP_QUIET_MS while the video runs
  c = await claim('s7'); hub.presence.touch('s7'); await hub.board.start({ user: 's7', job: 'k7', title: 'Clip seven' });
  t += SETUP_QUIET_MS - 1000; assert.equal(await line(c), 'MOOVI: working on Clip seven.');
  t += 2000; assert.match(await line(c), /^MOOVI: FAILED: the background Claude Code went quiet while Clip seven was running/);
  // the exit report is for a claimed code only, POST only
  const { code: fresh } = await makePrompt('s8');
  assert.equal((await exit(fresh, 1)).status, 404);
  assert.equal((await fetch(`${base}/api/brain/setup/${c}/exit`)).status, 405);
});

test('claim: two scripts racing on one code, exactly one wins', async () => {
  const { code } = await makePrompt('r1');
  const rs = await Promise.all([1, 2, 3].map(() => fetch(`${base}/api/brain/setup/${code}/claim`, { method: 'POST' })));
  assert.deepEqual(rs.map(r => r.status).sort(), [200, 410, 410]);
});

test('script: setup twice (moovi already in claude mcp), spaces in every path, and the token stays out of output, logs and files', async () => {
  const home = join(dir, 'John Smith'); mkdirSync(home, { recursive: true });
  const tmp = join(home, 'Temp Files'); mkdirSync(tmp, { recursive: true });
  const f = fakeClaude(home);
  const env = { ...process.env, HOME: home, TMPDIR: tmp, PATH: `${f.bin}:${process.env.PATH}` };
  const tokens: string[] = [];
  for (const round of [1, 2]) {
    const { code } = await makePrompt('sp');
    const r = await runSh(await shOf(code), env);
    assert.equal(r.status, 0, `round ${round}: ${r.stdout}${r.stderr}`);
    assert.match(r.stdout, /MOOVI: connected .*Log: .*John Smith\/Temp Files\/moovi\/brain-\d+\.log/);
    assert.match(r.stdout, new RegExp(`progress command: curl -fsS ${base}/api/brain/setup/${code}/status`));
    const st = readFileSync(f.state, 'utf8').trim().split('\n');
    assert.equal(st.length, 1, 'exactly one moovi entry after each run');
    tokens.push(/Bearer (mvk_\S+)/.exec(st[0]!)![1]!);
    assert.ok(await until(() => readFileSync(f.calls, 'utf8').split('\n').filter(l => l.startsWith('P|')).length === round), 'the background claude -p started');
  }
  assert.equal(await hub.tokens.verify(tokens[0]!), null, 'the first token was replaced');
  assert.equal((await hub.tokens.verify(tokens[1]!))?.user, 'sp', 'claude mcp holds the live one');
  const p = readFileSync(f.calls, 'utf8').split('\n').find(l => l.startsWith('P|'))!;
  assert.match(p, /PWD=.*John Smith\/Temp Files\/moovi$/, 'the background run works in a folder with spaces');
  // nothing the user or a log can see holds a token
  const seen = [readdirSync(join(tmp, 'moovi')).map(n => readFileSync(join(tmp, 'moovi', n), 'utf8')).join('\n'), logs.join('\n')].join('\n');
  for (const tk of tokens) assert.ok(!seen.includes(tk) && !seen.includes(tk.slice(4)), 'no token in the logs');
});

test('script: an expired code, no curl or wget, no claude: one clear FAILED line each, nothing started', async () => {
  const w = join(dir, 'edges'); mkdirSync(w, { recursive: true });
  const f = fakeClaude(w);
  // expired: the script was fetched in time but run late (a slow paste)
  const { code } = await makePrompt('e1');
  const sh = await shOf(code);
  t += SETUP_MS + 1;
  let r = await runSh(sh, { ...process.env, PATH: `${f.bin}:${process.env.PATH}`, TMPDIR: w });
  assert.equal(r.status, 1); assert.equal(r.stdout.trim(), 'MOOVI: FAILED: this setup code was already used or has expired. Copy a fresh prompt from Moovi Settings.');
  // an expired link fetched late still says why (curl -f | sh)
  assert.match(await shOf(code), /^echo "MOOVI: this setup link has expired/);
  // no curl and no wget on PATH
  const bare = join(w, 'bare'); mkdirSync(bare, { recursive: true });
  for (const b of ['uname', 'sed', 'tail']) symlinkSync(execFileSync('sh', ['-c', `command -v ${b}`]).toString().trim(), join(bare, b));
  const { code: c2 } = await makePrompt('e2');
  r = await runSh(await shOf(c2), { PATH: `${bare}:${f.bin}`, HOME: w });
  assert.equal(r.status, 1); assert.match(r.stdout, /^MOOVI: FAILED: neither curl nor wget is installed here/);
  // no claude anywhere (PATH or the usual install folders)
  r = await runSh(await shOf(c2), { ...process.env, PATH: process.env.PATH!.split(':').filter(d => !existsSync(join(d, 'claude'))).join(':'), HOME: join(w, 'nohome') });
  assert.equal(r.status, 1); assert.match(r.stdout, /^MOOVI: FAILED: the claude command was not found in this shell/);
  assert.match(await line(c2), /^MOOVI: not set up yet/, 'a failed check uses nothing up: the same prompt works once fixed');
  assert.ok(!existsSync(f.calls), 'claude was never called');
});

test('script: the background Claude Code dies (not signed in): the wrapper reports it and the status says FAILED', async () => {
  const w = join(dir, 'dies'); mkdirSync(w, { recursive: true });
  const f = fakeClaude(w);
  const { code } = await makePrompt('d1');
  const r = await runSh(await shOf(code), { ...process.env, PATH: `${f.bin}:${process.env.PATH}`, TMPDIR: w, FAKE_EXIT: '1' });
  assert.equal(r.status, 0);
  assert.ok(await until(async () => /^MOOVI: FAILED/.test(await line(code))), 'FAILED within seconds');
  assert.match(await line(code), /stopped \(exit 1\) before it connected; is Claude Code signed in\?/);
});

test('script: with wget only (no curl) the same flow works', { skip: !spawnSync('sh', ['-c', 'command -v wget']).stdout.length && 'wget is not installed on this machine' }, async () => {
  const w = join(dir, 'wget'); mkdirSync(w, { recursive: true });
  const f = fakeClaude(w);
  const bins = join(w, 'tools'); mkdirSync(bins, { recursive: true });
  for (const b of ['uname', 'sed', 'tail', 'wget', 'mkdir', 'date', 'nohup', 'setsid', 'sleep', 'grep', 'mv', 'touch', 'sh']) { const p = spawnSync('sh', ['-c', `command -v ${b}`]).stdout.toString().trim(); if (p) symlinkSync(p, join(bins, b)); }
  const { code } = await makePrompt('w1');
  const r = await runSh(await shOf(code), { PATH: `${bins}:${f.bin}`, HOME: w, TMPDIR: w, FAKE_EXIT: '2' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /progress command: wget -qO- /);
  assert.ok(await until(async () => /exit 2/.test(await line(code))), 'the wrapper reported through wget too');
});

// ---- the PowerShell script, run for real by pwsh when one is on this machine (MOOVI_PWSH names it). Linux pwsh takes
// the non Windows branch of Start-Process (redirected, no window style); the Windows branch is the same call with
// -WindowStyle Hidden and no redirects, which pwsh on Linux cannot run.
const PWSH = process.env.MOOVI_PWSH || (spawnSync('sh', ['-c', 'command -v pwsh']).stdout.toString().trim() || '');
function runPs(cmd: string, env: NodeJS.ProcessEnv): Promise<{ status: number | null; stdout: string; stderr: string }> {
  return new Promise(res => {
    const p = spawn(PWSH, ['-NoProfile', '-NonInteractive', '-Command', cmd], { env: { ...env, POWERSHELL_TELEMETRY_OPTOUT: '1', POWERSHELL_UPDATECHECK: 'Off' }, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    p.stdout.on('data', d => { stdout += d; }); p.stderr.on('data', d => { stderr += d; });
    const k = setTimeout(() => p.kill('SIGKILL'), 60_000);
    p.on('close', status => { clearTimeout(k); res({ status, stdout, stderr }); });
  });
}

test('ps1: the real PowerShell script under pwsh, exactly as the prompt runs it (irm | iex): twice, spaces, a dying run, expired, no claude', { skip: !PWSH && 'no pwsh on this machine (set MOOVI_PWSH)' }, async () => {
  const home = join(dir, 'Jane Doe ps'); mkdirSync(home, { recursive: true });
  const tmp = join(home, 'Temp Files'); mkdirSync(tmp, { recursive: true });
  const f = fakeClaude(home);
  const env = { ...process.env, HOME: home, TMPDIR: tmp, PATH: `${f.bin}:${process.env.PATH}` };
  const tokens: string[] = [];
  for (const round of [1, 2]) {
    const { code } = await makePrompt('ps');
    const r = await runPs(`irm ${base}/api/brain/setup/${code}.ps1 | iex`, env);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.equal(r.stderr.trim(), '', 'no PowerShell errors');
    assert.match(r.stdout, /^MOOVI: connected \(run rt_[0-9a-f]+\)\. Moovi now runs in the background\. Log: .*Jane Doe ps\/Temp Files\/moovi\/brain-\d+\.log$/m);
    assert.match(r.stdout, new RegExp(`^MOOVI: progress command: curl -fsS ${base}/api/brain/setup/${code}/status$`, 'm'));
    assert.doesNotMatch(r.stdout + r.stderr, /mvk_/, 'the token is never printed');
    const st = readFileSync(f.state, 'utf8').trim().split('\n');
    assert.equal(st.length, 1, 'one moovi entry after each run (the old one removed first)');
    tokens.push(/Bearer (mvk_\S+)/.exec(st[0]!)![1]!);
    assert.ok(await until(() => readFileSync(f.calls, 'utf8').split('\n').filter(l => l.startsWith('P|')).length === round, 15_000), 'the background claude -p started');
    assert.ok(await until(async () => /^MOOVI: (IDLE|connecting)/.test(await line(code)) && (await fetch(`${base}/api/brain/setup/${code}/exit?code=9`, { method: 'POST' })).ok, 15_000));
  }
  assert.equal(await hub.tokens.verify(tokens[0]!), null);
  assert.equal((await hub.tokens.verify(tokens[1]!))?.user, 'ps');
  const calls = readFileSync(f.calls, 'utf8').split('\n');
  assert.deepEqual(calls.slice(0, 2), ['C|mcp remove moovi -s local', 'C|mcp remove moovi -s user']);
  const p = calls.find(l => l.startsWith('P|'))!.split('|');
  assert.match(p[1]!, /^You are the Moovi brain for one video\. Call the moovi_next tool with ticket set to rt_/, 'the prompt arrives as one argument through -EncodedCommand');
  assert.deepEqual([p[2], p[3]], ['--allowedTools', 'mcp__moovi']);
  assert.match(p.at(-1)!, /PWD=.*Jane Doe ps\/Temp Files\/moovi$/);
  const logs2 = readdirSync(join(tmp, 'moovi')).map(n => readFileSync(join(tmp, 'moovi', n), 'utf8')).join('\n');
  for (const tk of tokens) assert.ok(!logs2.includes(tk.slice(4)), 'no token in the log files');
  // the background run dies at once: the wrapper's exit report turns the status FAILED
  const { code: dc } = await makePrompt('ps2');
  const r = await runPs(`irm ${base}/api/brain/setup/${dc}.ps1 | iex`, { ...env, FAKE_EXIT: '3' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.ok(await until(async () => /^MOOVI: FAILED: the background Claude Code stopped \(exit 3\)/.test(await line(dc)), 20_000), await line(dc));
  // used twice, expired, no claude: one clear line each
  assert.match((await runPs(`irm ${base}/api/brain/setup/${dc}.ps1 | iex`, env)).stdout, /^MOOVI: FAILED: this setup code was already used or has expired/);
  const { code: ec } = await makePrompt('ps3');
  const late = await (await fetch(`${base}/api/brain/setup/${ec}.ps1`)).text();
  t += SETUP_MS + 1;
  writeFileSync(join(home, 'late.ps1'), late);
  assert.match((await runPs(`& '${join(home, 'late.ps1')}'`, env)).stdout, /^MOOVI: FAILED: this setup code was already used or has expired/);
  const ex = await runPs(`irm ${base}/api/brain/setup/${ec}.ps1 | iex`, env);
  assert.match(ex.stdout, /^MOOVI: this setup link has expired/, ex.stdout + ex.stderr);
  const { code: nc } = await makePrompt('ps4');
  const none = await runPs(`irm ${base}/api/brain/setup/${nc}.ps1 | iex`, { ...env, PATH: process.env.PATH!.split(':').filter(d => !existsSync(join(d, 'claude'))).join(':'), HOME: join(dir, 'nobody') });
  assert.match(none.stdout, /^MOOVI: FAILED: the claude command was not found in this shell/);
  assert.match(await line(nc), /^MOOVI: not set up yet/);
});

/** what Claude Code does with the pasted prompt, done literally: run each POSIX command as written, with TOKEN and
 *  TICKET filled in from the claim's JSON (the only blanks). Run through bash and zsh when they are installed. */
test('prompt: its POSIX commands, run as written in sh, connect Moovi and start the background run; the exit is reported', async () => {
  const shells = ['/bin/sh', ...['bash', 'zsh'].filter(s => spawnSync('sh', ['-c', `command -v ${s}`]).stdout.length)];
  for (const shell of shells) {
    const w = join(dir, `prompt ${shell.replace(/\W/g, '')}`); mkdirSync(w, { recursive: true });
    const tmp = join(w, 'Temp Files'); mkdirSync(tmp, { recursive: true });
    const f = fakeClaude(w);
    const env = { ...process.env, HOME: w, TMPDIR: tmp, PATH: `${f.bin}:${process.env.PATH}`, CLAUDECODE: '1', CLAUDE_CODE_ENTRYPOINT: 'cli', FAKE_EXIT: '0' };
    const { prompt, code } = await makePrompt(`pr-${shell}`);
    const cmds = prompt.split('\n').map(l => l.trim()).filter(l => /^(curl |claude |cd )/.test(l));
    cmds.push(/run: (curl -sS \S+\/status)/.exec(prompt)![1]!);
    assert.equal(cmds.length, 6, `claim, two removes, add, start, status:\n${cmds.join('\n')}`);
    const run = (c: string) => new Promise<{ status: number | null; stdout: string }>(res => {
      const p = spawn(shell, ['-c', c], { env, stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = ''; p.stdout.on('data', d => { stdout += d; });
      const k = setTimeout(() => p.kill('SIGKILL'), 20_000);
      p.on('close', status => { clearTimeout(k); res({ status, stdout }); });
    });
    const claimed = await run(cmds[0]!);
    assert.equal(claimed.status, 0);
    const j = JSON.parse(claimed.stdout) as { ok: boolean; token: string; ticket: string };
    assert.equal(j.ok, true);
    for (const c of cmds.slice(1, 4)) await run(c.replace('TOKEN', j.token));
    const st = readFileSync(f.state, 'utf8').trim().split('\n');
    assert.equal(st.length, 1); assert.ok(st[0]!.includes(`moovi ${base}/mcp --header Authorization: Bearer ${j.token}`), st[0]);
    const started = await run(cmds[4]!.replace('TICKET', j.ticket));
    assert.equal(started.status, 0, 'the start line exits cleanly after the background run ends');
    const p = readFileSync(f.calls, 'utf8').split('\n').find(l => l.startsWith('P|'))!;
    assert.equal(p.split('|')[1], childPrompt(j.ticket), 'the background run got the ticket, as one argument');
    assert.equal(p.split('|')[2], '--allowedTools'); assert.equal(p.split('|')[3], 'mcp__moovi');
    assert.match(p, /PWD=.*Temp Files$/, 'it ran in the temp folder, spaces and all');
    assert.ok(existsSync(join(tmp, 'moovi-brain.log')));
    assert.match(p, /\|CC=none\|/, 'started outside the pasting Claude Code session (CLAUDECODE unset)');
    assert.match(await line(code), /^MOOVI: IDLE: the background Claude Code stopped before a video started/, 'the exit report reached the server');
    const rec = JSON.parse((await store.get(`ce:brain:setup:${createHash('sha256').update(code, 'utf8').digest('hex')}`))!) as { exit?: { code: number } };
    assert.equal(rec.exit?.code, 0, 'the exit report reached the server with the real exit code');
    const status = await run(cmds[5]!);
    assert.match(status.stdout, /^MOOVI: /);
  }
});
