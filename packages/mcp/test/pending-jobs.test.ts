import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { directEdit, EXAMPLE_DIRECTION } from '@moovi/engine/brain';
import { withModel, PICKUP_MS, type CompleteRequest, type Runtime } from '@moovi/engine/runtime';
import { BrainHub, brainScope, bridgeApp, Gate, IDLE_NO_TICKET, INSTRUCTIONS, KEY, memoryStore, NOTHING_RUNNING, ONLINE_MS, Presence, SETUP_CONNECT_MS, SETUP_QUIET_MS, StepQueue } from '../src/index';

/**
 * Vignesh's live Windows test, 2026-10-18 17:28 to 17:47 IST: command 1, a clip uploaded, command 2. The website showed
 * the video stuck at "Editor planning the cuts" and later "Waiting for Claude Code", while the setup status line said
 * "connected; waiting for a video". Three things are proven here:
 * 1. a clip uploaded before command 2 offers its next decision to the background Claude Code command 2 starts (it was
 *    sent to Moovi's server model because the new Claude Code had not called in yet), and never hangs if it never comes;
 * 2. the status line tells the truth: it counts a video that started before the setup, says which brain took its last
 *    decision, says "connected" only while Claude Code is really calling, and names the account;
 * 3. no slash command is asked of the user anywhere a session reads.
 */
const W = (word: string, t: number, end: number) => ({ word, t, end });
const words = [W('This', 0.2, 0.4), W('chip', 0.45, 0.8), W('is', 0.85, 0.95), W('tiny.', 1.0, 1.4), W('It', 2.0, 2.1), W('has', 2.15, 2.3), W('19', 2.35, 2.6), W('billion', 2.65, 3.0), W('transistors.', 3.05, 3.8),
  W('Each', 4.5, 4.7), W('one', 4.75, 4.9), W('switches', 4.95, 5.4), W('fast.', 5.45, 5.9), W('Follow', 6.5, 6.8), W('for', 6.85, 6.95), W('more.', 7.0, 7.5)];
const tick = (ms = 5) => new Promise(res => setTimeout(res, ms));
function stub(name: string) {
  const saw: string[] = [];
  const rt: Runtime = { name, vision: false, run: async () => { throw new Error('no tool loop'); }, complete: async (q: CompleteRequest) => { saw.push(q.agent); return JSON.stringify({ ...EXAMPLE_DIRECTION, model: name }); } };
  return { rt, saw };
}
function rig() {
  const clock = { t: 1_800_000_000_000 };
  const now = () => clock.t;
  const store = memoryStore(now), queue = new StepQueue(store, now), presence = new Presence(now, store);
  const gate = new Gate(store, queue, now, u => presence.touch(u));
  const lanes: string[] = [];
  const server = stub('server');
  presence.link('u1'); // command 1 ran: a live token, Claude Code linked but not calling
  const scope = () => brainScope({ user: 'u1', queue, presence, job: () => 'job-1', own: null, server: server.rt, byok: 'optional', bridge: { pollMs: 5, now }, onLane: (_a, l) => lanes.push(l) });
  const queued = async () => { for (let i = 0; i < 400; i++) { if ((await store.range(KEY.queue('u1'))).length) return; await tick(); } throw new Error('no step queued'); };
  return { clock, store, queue, presence, gate, scope, lanes, server, queued };
}

test('pending video: linked only, no background Claude Code expected: the brain step goes to the server model (unchanged)', async () => {
  const r = rig();
  const out = await withModel(r.scope()!, () => directEdit({ words }));
  assert.equal(out.value!.model, 'server'); assert.deepEqual(r.lanes, ['server']);
});

test('pending video: command 2 just ran (its Claude Code is starting): the step waits for it and that Claude Code takes it', async () => {
  const r = rig();
  r.presence.expect('u1', SETUP_CONNECT_MS);
  assert.equal(r.presence.state('u1'), 'linked', 'the pill still says linked: nothing called yet');
  assert.equal(r.presence.laneState('u1'), 'online', 'the lane switch offers it to the starting Claude Code');
  const job = withModel(r.scope()!, () => directEdit({ words }));
  await r.queued();
  // the background Claude Code connects 30 s later with its run ticket and pulls: the step queued before it is there
  r.clock.t += 30_000;
  const ticket = await r.gate.mintTicket('u1');
  const p = await r.gate.pull('u1', 'bg', ticket);
  assert.ok('step' in p, 'a step queued before the brain connected is handed to it');
  const s = (p as { step: { id: string; agent: string } }).step;
  assert.equal(s.agent, 'direct:edit');
  assert.deepEqual(await r.gate.submit('u1', 'bg', (p as { lease: string }).lease, s.id, JSON.stringify({ ...EXAMPLE_DIRECTION, model: 'claude-code' })), { ok: true });
  const out = await job;
  assert.equal(out.value!.model, 'claude-code');
  assert.deepEqual(r.lanes, ['claude-code']); assert.deepEqual(r.server.saw, [], 'the server model was never asked');
});

test('pending video: the expected Claude Code never comes: after 120 s the server model takes it, nothing hangs', async () => {
  const r = rig();
  r.presence.expect('u1', SETUP_CONNECT_MS);
  const job = withModel(r.scope()!, () => directEdit({ words }));
  await r.queued();
  r.clock.t += PICKUP_MS;
  const out = await job;
  assert.equal(out.value!.model, 'server'); assert.deepEqual(r.lanes, ['claude-code', 'server']);
  r.clock.t += SETUP_CONNECT_MS;
  assert.equal(r.presence.laneState('u1'), 'linked', 'the expectation ends with its window');
});

test('pending video: the expectation is shared through the store (the worker primes it like presence)', async () => {
  const clock = { t: 5_000_000 }; const now = () => clock.t;
  const store = memoryStore(now);
  const web = new Presence(now, store), worker = new Presence(now, store);
  web.expect('u1', SETUP_CONNECT_MS); await tick();
  worker.link('u1');
  assert.equal(worker.laneState('u1'), 'linked');
  await worker.prime('u1');
  assert.equal(worker.laneState('u1'), 'online');
});

// ---- the status line and the website's status, through the real server
let t = 2_000_000_000;
const hub = new BrainHub(memoryStore(() => t), () => t);
const app = bridgeApp(hub, { userOf: async req => req.headers.get('x-test-user') });
await new Promise<void>(res => app.http.listen(0, '127.0.0.1', res));
const base = `http://127.0.0.1:${(app.http.address() as AddressInfo).port}`;
after(async () => { await app.close(); });
async function codeFor(user: string) {
  const r = await fetch(`${base}/api/brain/setup`, { method: 'POST', headers: { 'x-test-user': user } });
  const j = await r.json() as { prompt: string };
  return /\/api\/brain\/setup\/(mvs_[0-9a-f]{32})\//.exec(j.prompt)![1]!;
}
const line = async (code: string) => (await fetch(`${base}/api/brain/setup/${code}/status`)).text();

test('status: a video uploaded before the setup is counted, its brain is named, and command 2 makes it wait for Claude Code', async () => {
  const user = 'u0000000000beef';
  // the clip went up first: its run is on the board before command 1
  await hub.board.start({ user, job: 'r_early', project: 'p1', chat: 'c1', title: 'Launch edit' });
  // and its first decision went to Moovi's server model (what the worker log line and the lane record now say)
  await hub.store.set(KEY.lane(user), JSON.stringify({ job: 'r_early', agent: 'direct:edit', lane: 'server', why: "no Claude Code online and no key; using Moovi's model", at: t }));
  t += 60_000;
  const code = await codeFor(user);
  assert.equal((await fetch(`${base}/api/brain/setup/${code}/claim?part=connect`, { method: 'POST' })).status, 200);
  assert.match(await line(code), /not started yet: run command 2.*\(account \.\.\.beef\)/);
  // command 2: a fresh ticket, and the background Claude Code is expected from now on
  const ticket = (await (await fetch(`${base}/api/brain/setup/${code}/ticket`, { method: 'POST' })).text()).split('\n')[1]!;
  assert.match(ticket, /^rt_/);
  assert.equal(hub.presence.laneState(user), 'online', 'the next decision of the early video is offered to the starting Claude Code');
  assert.match(await line(code), /^MOOVI: connecting; working on Launch edit; its last decision ran on Moovi's server model/);
  // it calls in
  await hub.gate.pull(user, 'bg', ticket); await tick(20);
  assert.match(await line(code), /^MOOVI: connected; working on Launch edit.*\(account \.\.\.beef\)$/, 'not "waiting for a video" while a video runs');
  // a decision queued for it now
  await hub.queue.push({ user, job: 'r_early', agent: 'direct:edit', system: 's', prompt: 'p', schema: null });
  assert.match(await line(code), /a decision is waiting for your Claude Code/);
  // the website's status names the same account and the last brain
  const s = await (await fetch(`${base}/api/brain/status`, { headers: { 'x-test-user': user } })).json() as { account: string; last_lane: { lane: string } | null };
  assert.equal(s.account, 'beef'); assert.equal(s.last_lane?.lane, 'server');
});

test('status: "connected" means calling now; a background Claude Code that went quiet is reported, video or not', async () => {
  const user = 'u00000000000c0d';
  const code = await codeFor(user);
  await fetch(`${base}/api/brain/setup/${code}/claim?part=connect`, { method: 'POST' });
  const ticket = (await (await fetch(`${base}/api/brain/setup/${code}/ticket`, { method: 'POST' })).text()).split('\n')[1]!;
  await hub.gate.pull(user, 'bg', ticket); await tick(20);
  assert.match(await line(code), /^MOOVI: connected; waiting for a video/);
  t += ONLINE_MS + 5_000;
  assert.match(await line(code), /^MOOVI: quiet for \d+ s; waiting for a video/, 'no longer "connected" once it stopped calling');
  t += SETUP_QUIET_MS;
  assert.match(await line(code), /^MOOVI: FAILED: the background Claude Code stopped calling Moovi \d+ s ago\. Run command 2/, 'before: "connected; waiting for a video" forever');
});

test('no slash command: what a session reads never asks the user to type /mcp__moovi__run', () => {
  for (const s of [INSTRUCTIONS, IDLE_NO_TICKET, NOTHING_RUNNING]) assert.doesNotMatch(s, /mcp__moovi__run|type \//i);
  assert.match(INSTRUCTIONS, /moovi_status/);
  assert.doesNotMatch(NOTHING_RUNNING, /before you stop/, 'a background Claude Code is not invited to stop after 2 minutes');
});

test('lane record: hub.register keeps the last brain decision (not detail calls) and logs it', async () => {
  const h = new BrainHub(memoryStore());
  const logged: string[] = []; const orig = console.log; console.log = (...a: unknown[]) => { logged.push(a.join(' ')); };
  const was = process.env.MOOVI_BYOK; process.env.MOOVI_BYOK = 'optional'; // the server's setting (deploy/server-setup.sh)
  const un = h.register({ server: stub('server').rt });
  try {
    const { scopeFor, primeBrainScope } = await import('@moovi/engine/keys');
    await h.tokens.mint('u7'); await primeBrainScope('u7');
    const sc = scopeFor('u7')!;
    await withModel(sc, () => directEdit({ words }));
    const rec = await h.lastLane('u7');
    assert.equal(rec?.lane, 'server'); assert.equal(rec?.agent, 'direct:edit');
    assert.ok(logged.some(l => /^\[bridge\] lane u7 .* direct:edit > server/.test(l)), logged.join('\n'));
  } finally { console.log = orig; un(); if (was === undefined) delete process.env.MOOVI_BYOK; else process.env.MOOVI_BYOK = was; }
});
