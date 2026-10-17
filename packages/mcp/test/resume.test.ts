import { test } from 'node:test';
import assert from 'node:assert/strict';
import { directEdit, EXAMPLE_DIRECTION } from '@moovi/engine/brain';
import { withModel, BrainWaiting, PICKUP_MS, WAIT_MS } from '@moovi/engine/runtime';
import { brainScope, Gate, IDLE_OTHER_WINDOW, KEY, LEASE_MS, MEMO_TTL_MS, memoryStore, Presence, StepQueue } from '../src/index';

/**
 * Bridge item 20: the Claude Code window drops mid video (closed, network cut) and a new /moovi:run in any window picks
 * the same video back up. Fake clock for every timer that decides (leases, tickets, memo, pickup); real timers only
 * for the few milliseconds of polling.
 */
const W = (word: string, t: number, end: number) => ({ word, t, end });
const words = [W('This', 0.2, 0.4), W('chip', 0.45, 0.8), W('is', 0.85, 0.95), W('tiny.', 1.0, 1.4), W('It', 2.0, 2.1), W('has', 2.15, 2.3), W('19', 2.35, 2.6), W('billion', 2.65, 3.0), W('transistors.', 3.05, 3.8),
  W('Each', 4.5, 4.7), W('one', 4.75, 4.9), W('switches', 4.95, 5.4), W('fast.', 5.45, 5.9), W('Follow', 6.5, 6.8), W('for', 6.85, 6.95), W('more.', 7.0, 7.5)];
const good = JSON.stringify({ ...EXAMPLE_DIRECTION, model: 'claude-test' });
const tick = (ms = 5) => new Promise(res => setTimeout(res, ms));

function rig() {
  const clock = { t: 1_800_000_000_000 };
  const now = () => clock.t;
  const store = memoryStore(now), queue = new StepQueue(store, now), presence = new Presence(now);
  const gate = new Gate(store, queue, now, u => presence.touch(u));
  const lanes: string[] = [];
  const scope = () => brainScope({ user: 'u1', queue, presence, job: () => 'job-1', own: null, server: null, byok: 'required', bridge: { pollMs: 5, now }, onLane: (a, l) => lanes.push(`${a}>${l}`) });
  const queued = async (n = 1) => { for (let i = 0; i < 400; i++) { if ((await store.range(KEY.queue('u1'))).length >= n) return; await tick(); } throw new Error('no step queued'); };
  /** the wait lane has queued its step (the lane decision is logged before the step is queued) */
  const waiting = async () => { for (let i = 0; i < 400; i++) { if (lanes.at(-1)?.endsWith('>wait') && (await store.range(KEY.queue('u1'))).length) return; await tick(); } throw new Error('no wait step'); };
  return { clock, store, queue, presence, gate, scope, lanes, queued, waiting };
}

test('bridge 20: a window drops holding a step; 2 min later a new /moovi:run takes the same step over and the video finishes', async () => {
  const r = rig(); r.presence.touch('u1');
  const tA = await r.gate.mintTicket('u1');
  const job = withModel(r.scope()!, () => directEdit({ words }));
  await r.queued();
  const a = await r.gate.pull('u1', 'sess-A', tA);
  assert.ok('step' in a); // window A has the step ... and is closed (or the network is cut) before it answers

  const tB = await r.gate.mintTicket('u1');
  r.clock.t += 60_000;
  assert.deepEqual(await r.gate.pull('u1', 'sess-B', tB), { idle: IDLE_OTHER_WINDOW }, 'inside 2 min the video is still A\'s');
  r.clock.t += LEASE_MS - 60_000;
  const b = await r.gate.pull('u1', 'sess-B', tB);
  assert.ok('step' in b, '2 min after A\'s last call B takes the video over');
  assert.equal(b.step.id, a.step.id, 'the same step, not a new question');
  assert.notEqual(b.lease, a.lease);

  const late = await r.gate.submit('u1', 'sess-A', a.lease, a.step.id, good);
  assert.deepEqual(late, { ok: false, why: IDLE_OTHER_WINDOW }, 'a late answer from the dropped window is refused');
  assert.deepEqual(await r.gate.submit('u1', 'sess-B', b.lease, b.step.id, good), { ok: true });
  const out = await job;
  assert.equal(out.source, 'brain'); assert.equal(out.value!.style, 'atlas');
  assert.deepEqual(r.lanes, ['direct:edit>claude-code'], 'no fallback to a key: the job stayed with Claude Code');
});

test('bridge 20: dropped between steps, the job parks; the rerun from another window replays answers and asks only the new step', async () => {
  const r = rig(); r.presence.touch('u1');
  const tA = await r.gate.mintTicket('u1');
  const first = withModel(r.scope()!, () => directEdit({ words }));
  await r.queued();
  const a = await r.gate.pull('u1', 'sess-A', tA); assert.ok('step' in a);
  assert.deepEqual(await r.gate.submit('u1', 'sess-A', a.lease, a.step.id, '{"style":"vaporwave"}'), { ok: true });
  await r.queued(); // the engine's one re-ask is queued ... and window A is gone
  r.clock.t += PICKUP_MS;
  await r.waiting(); // no key: the step waits for a /moovi:run (the wait lane, 10 min) ...
  r.clock.t += WAIT_MS;
  await assert.rejects(first, BrainWaiting, '... then, with nobody picking up, the job parks; it does not fail');
  assert.deepEqual(r.lanes, ['direct:edit>claude-code', 'direct:edit>claude-code', 'direct:edit>wait']);

  // later, a /moovi:run in a window in another folder; the worker runs the job again
  const tB = await r.gate.mintTicket('u1');
  assert.ok('idle' in await r.gate.pull('u1', 'sess-B', tB));
  const again = withModel(r.scope()!, () => directEdit({ words }));
  await r.queued();
  const b = await r.gate.pull('u1', 'sess-B', tB); assert.ok('step' in b);
  assert.ok(b.step.history?.length, 'the first question is not asked again: its answer replays from the memo, B gets only the re-ask');
  assert.deepEqual(await r.gate.submit('u1', 'sess-B', b.lease, b.step.id, good), { ok: true });
  const out = await again;
  assert.equal(out.source, 'reask'); assert.equal(out.value!.style, 'atlas');

  // a third run (a retry, a third folder) asks nothing at all
  const third = await withModel(r.scope()!, () => directEdit({ words }));
  assert.equal(JSON.stringify(third), JSON.stringify(out), 'byte for byte the same direction');
  assert.equal((await r.store.range(KEY.queue('u1'))).length, 0);
});

test('bridge 20: dropped between steps, a /moovi:run within 10 min picks the waiting step up, no rerun needed', async () => {
  const r = rig(); r.presence.touch('u1');
  const job = withModel(r.scope()!, () => directEdit({ words }));
  await r.queued();
  r.clock.t += PICKUP_MS; // nobody (window A is gone), no key: the step waits in the wait lane
  await r.waiting();
  r.clock.t += WAIT_MS - 60_000;
  const tB = await r.gate.mintTicket('u1');
  const b = await r.gate.pull('u1', 'sess-B', tB); assert.ok('step' in b);
  assert.deepEqual(await r.gate.submit('u1', 'sess-B', b.lease, b.step.id, good), { ok: true });
  const out = await job;
  assert.equal(out.source, 'brain');
  assert.deepEqual(r.lanes, ['direct:edit>claude-code', 'direct:edit>wait']);
});

test('bridge 20: a window that closes cleanly gives the video back at once', async () => {
  const r = rig();
  await r.queue.push({ user: 'u1', job: 'job-1', agent: 'direct:edit', system: 's', prompt: 'p', schema: null });
  const tA = await r.gate.mintTicket('u1'), tB = await r.gate.mintTicket('u1');
  const a = await r.gate.pull('u1', 'sess-A', tA); assert.ok('step' in a);
  assert.deepEqual(await r.gate.pull('u1', 'sess-B', tB), { idle: IDLE_OTHER_WINDOW });
  await r.gate.release('sess-A', new Map([['job-1', a.lease]]));
  const b = await r.gate.pull('u1', 'sess-B', tB);
  assert.ok('step' in b && b.step.id === a.step.id, 'no 2 min wait after a clean close');
});

test('bridge 20: a live window keeps its video while it polls; the same window asking again gets its open step back', async () => {
  const r = rig();
  await r.queue.push({ user: 'u1', job: 'job-1', agent: 'direct:edit', system: 's', prompt: 'p', schema: null });
  const tA = await r.gate.mintTicket('u1'), tB = await r.gate.mintTicket('u1');
  const a = await r.gate.pull('u1', 'sess-A', tA); assert.ok('step' in a);
  const again = await r.gate.pull('u1', 'sess-A', tA);
  assert.ok('step' in again && again.step.id === a.step.id && again.lease === a.lease);
  for (let i = 0; i < 5; i++) { r.clock.t += 60_000; await r.gate.keepAlive('sess-A', new Map([['job-1', a.lease]])); }
  assert.equal(await r.gate.heldElsewhere('job-1', 'sess-B'), true, '5 min of polling: still A\'s');
  assert.deepEqual(await r.gate.pull('u1', 'sess-B', tB), { idle: IDLE_OTHER_WINDOW });
});

test('bridge 20: saved answers last 24 h, then the question is asked again', async () => {
  const r = rig();
  await r.queue.remember('u1', 'fp1', '{"a":1}');
  r.clock.t += MEMO_TTL_MS - 1000;
  assert.equal(await r.queue.recall('u1', 'fp1'), '{"a":1}');
  r.clock.t += 2000;
  assert.equal(await r.queue.recall('u1', 'fp1'), null);
});
