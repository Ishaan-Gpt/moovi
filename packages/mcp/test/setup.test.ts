import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { BrainHub, bridgeApp, childPrompt, memoryStore, SETUP_IDLE_MS, SETUP_MS, type BrainStore } from '../src/index';

// the one prompt setup (setup.ts): one pasted prompt, Claude Code runs one command, the script adds the server and starts a background Claude Code
let t = 1_000_000;
const written: string[] = [];
const inner = memoryStore(() => t);
const store: BrainStore = { ...inner, set: async (k, v, ttl) => { written.push(k, v); return inner.set(k, v, ttl); } };
const hub = new BrainHub(store, () => t);
const app = bridgeApp(hub, { userOf: async req => req.headers.get('x-test-user'), cors: o => o === 'http://site.test' });
await new Promise<void>(res => app.http.listen(0, '127.0.0.1', res));
const base = `http://127.0.0.1:${(app.http.address() as AddressInfo).port}`;
const dir = mkdtempSync(join(tmpdir(), 'moovi-setup-'));
after(async () => { await app.close(); rmSync(dir, { recursive: true, force: true }); });

async function makePrompt(user = 'u1') {
  const r = await fetch(`${base}/api/brain/setup`, { method: 'POST', headers: { 'x-test-user': user } });
  assert.equal(r.status, 200);
  const j = await r.json() as { prompt: string; expires_at: number };
  const code = /\/api\/brain\/setup\/(mvs_[0-9a-f]{32})\.sh/.exec(j.prompt)![1]!;
  return { ...j, code };
}
/** run a shell script without blocking this process (the server under test lives in it) */
function runSh(script: string, env: NodeJS.ProcessEnv): Promise<{ status: number | null; stdout: string; stderr: string }> {
  return new Promise(res => {
    const p = spawn('sh', ['-c', script], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    p.stdout.on('data', d => { stdout += d; }); p.stderr.on('data', d => { stderr += d; });
    const k = setTimeout(() => p.kill('SIGKILL'), 20_000);
    p.on('close', status => { clearTimeout(k); res({ status, stdout, stderr }); });
  });
}
const line = async (code: string) => (await fetch(`${base}/api/brain/setup/${code}/status`)).text();

test('setup: sign in first; the prompt names one command per shell and a status link; the code is stored only as a hash', async () => {
  assert.equal((await fetch(`${base}/api/brain/setup`, { method: 'POST' })).status, 401);
  const { prompt, code, expires_at } = await makePrompt();
  assert.equal(expires_at, t + SETUP_MS);
  assert.ok(prompt.includes(`curl -fsSL ${base}/api/brain/setup/${code}.sh | sh`));
  assert.ok(prompt.includes(`irm ${base}/api/brain/setup/${code}.ps1 | iex`));
  assert.ok(prompt.includes(`${base}/api/brain/setup/${code}/status`));
  assert.match(prompt, /do not ask me anything/);
  assert.doesNotMatch(prompt, /mvk_/, 'no token in the pasted text');
  assert.doesNotMatch(prompt, /[\u2013\u2014]/, 'no dashes');
  assert.ok(!written.some(v => v.includes(code)), 'the code itself never reaches the store');
  const pre = await fetch(`${base}/api/brain/setup`, { method: 'OPTIONS', headers: { origin: 'http://site.test' } });
  assert.equal(pre.status, 204, 'the Settings card on another port may ask');
  assert.equal(await line(code), 'MOOVI: not set up yet: run the command from the prompt first.');
});

test('setup: the scripts hold no secret, parse as sh, and an expired or unknown link says so', async () => {
  const { code } = await makePrompt();
  const sh = await (await fetch(`${base}/api/brain/setup/${code}.sh`)).text();
  const ps = await (await fetch(`${base}/api/brain/setup/${code}.ps1`)).text();
  for (const s of [sh, ps]) { assert.doesNotMatch(s, /mvk_/); assert.ok(s.includes(code)); assert.ok(s.includes(`${base}/mcp`)); assert.match(s, /mcp add --scope user --transport http moovi/); assert.match(s, /--allowedTools/); }
  writeFileSync(join(dir, 'a.sh'), sh);
  assert.equal(spawnSync('sh', ['-n', join(dir, 'a.sh')]).status, 0, 'valid POSIX sh');
  assert.match(ps, /Start-Process/); assert.match(ps, /\$env:CLAUDECODE = \$null/);
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
  assert.match(await line(code), /^MOOVI: connected \(Claude Code online\); waiting for a video/);
  await hub.board.start({ user: 'u2', job: 'j1', title: 'My clip' });
  assert.equal(await line(code), 'MOOVI: working on My clip (Claude Code online).');
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

test('setup: a run that never starts reads IDLE', async () => {
  const { code } = await makePrompt('u3');
  await fetch(`${base}/api/brain/setup/${code}/claim`, { method: 'POST' });
  t += SETUP_IDLE_MS + 1;
  assert.match(await line(code), /^MOOVI: IDLE/);
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
  assert.equal(got[0], 'C|mcp remove moovi -s user');
  const add = /^C\|mcp add --scope user --transport http moovi (\S+) --header Authorization: Bearer (mvk_\S+)$/.exec(got[1]!)!;
  assert.equal(add[1], `${base}/mcp`);
  assert.equal((await hub.tokens.verify(add[2]!))?.user, 'u4', 'the token claude mcp add got is the live one');
  const p = got.find(l => l.startsWith('P|'))!.split('|');
  assert.match(p[1]!, /^You are the Moovi brain for one video\. Call the moovi_next tool with ticket set to rt_/);
  assert.deepEqual([p[2], p[3], p[4]], ['--allowedTools', 'mcp__moovi', 'CC=unset'], 'only Moovi tools, and the nested session guard is cleared');
  const again = await runSh(sh, { ...process.env, PATH: `${bin}:${process.env.PATH}`, TMPDIR: dir });
  assert.match(again.stdout, /already used or has expired/, 'running it twice is harmless');
});
