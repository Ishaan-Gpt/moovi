import { test } from 'node:test';
import assert from 'node:assert/strict';
import { directEdit, EXAMPLE_DIRECTION, BRIDGE_PROVIDER } from '@moovi/engine/brain';
import { withModel, BrainWaiting, PICKUP_MS, WAIT_MS, type CompleteRequest, type ModelScope, type Runtime } from '@moovi/engine/runtime';
import { primeBrainScope, scopeFor } from '@moovi/engine/keys';
import { BrainHub, brainScope, Gate, KEY, memoryStore, ONLINE_MS, Presence, StepQueue } from '../src/index';

/**
 * Bridge item 24: the lane order with fake clocks. An online Claude Code goes first; a step nobody picks up within
 * 120 s goes to the user's key, else Moovi's server model where allowed (MOOVI_BYOK=optional), else it keeps waiting
 * for a /moovi:run (10 min) and then the job parks. The memo survives a lane switch.
 */
const W = (word: string, t: number, end: number) => ({ word, t, end });
const words = [W('This', 0.2, 0.4), W('chip', 0.45, 0.8), W('is', 0.85, 0.95), W('tiny.', 1.0, 1.4), W('It', 2.0, 2.1), W('has', 2.15, 2.3), W('19', 2.35, 2.6), W('billion', 2.65, 3.0), W('transistors.', 3.05, 3.8),
  W('Each', 4.5, 4.7), W('one', 4.75, 4.9), W('switches', 4.95, 5.4), W('fast.', 5.45, 5.9), W('Follow', 6.5, 6.8), W('for', 6.85, 6.95), W('more.', 7.0, 7.5)];
const good = JSON.stringify({ ...EXAMPLE_DIRECTION, model: 'claude-test' });
const tick = (ms = 5) => new Promise(res => setTimeout(res, ms));

function stub(name: string) {
  const saw: string[] = [];
  const rt: Runtime = { name, vision: false, run: async () => { throw new Error('no tool loop'); }, complete: async (q: CompleteRequest) => { saw.push(q.agent); return JSON.stringify({ ...EXAMPLE_DIRECTION, model: name }); } };
  return { rt, saw };
}

function rig(o: { key?: Runtime | null; server?: Runtime | null; byok?: 'required' | 'optional' } = {}) {
  const clock = { t: 1_800_000_000_000 };
  const now = () => clock.t;
  const store = memoryStore(now), queue = new StepQueue(store, now), presence = new Presence(now);
  const gate = new Gate(store, queue, now, u => presence.touch(u));
  const lanes: string[] = [];
  const own: ModelScope | null = o.key ? { runtime: o.key, models: { director: 'd', crew: 'c', fast: 'f' }, provider: 'test', deadlineScale: 1, drawsWell: true } : null;
  const scope = () => brainScope({ user: 'u1', queue, presence, job: () => 'job-1', own, server: o.server ?? null, byok: o.byok ?? 'required', bridge: { pollMs: 5, now }, onLane: (_a, l) => lanes.push(l) });
  const queued = async () => { for (let i = 0; i < 400; i++) { if ((await store.range(KEY.queue('u1'))).length) return; await tick(); } throw new Error('no step queued'); };
  const waiting = async () => { for (let i = 0; i < 400; i++) { if (lanes.at(-1) === 'wait' && (await store.range(KEY.queue('u1'))).length) return; await tick(); } throw new Error('no wait step'); };
  return { clock, store, queue, presence, gate, scope, lanes, queued, waiting };
}

test('bridge 24: online Claude Code first; nobody picks up for 120 s, the key takes the call (not a second sooner)', async () => {
  const key = stub('key');
  const r = rig({ key: key.rt }); r.presence.touch('u1');
  const job = withModel(r.scope()!, () => directEdit({ words }));
  await r.queued();
  r.clock.t += PICKUP_MS - 1000; await tick(40);
  assert.deepEqual(key.saw, [], 'at 119 s the step still waits for Claude Code');
  r.clock.t += 1000;
  const out = await job;
  assert.equal(out.value!.model, 'key'); assert.deepEqual(key.saw, ['direct:edit']);
  assert.deepEqual(r.lanes, ['claude-code', 'key']);
  assert.equal((await r.store.range(KEY.queue('u1'))).length, 0, 'the expired step left the queue: a late window cannot pick it');
});

test('bridge 24: no key, server model allowed (MOOVI_BYOK=optional): the server takes it after 120 s', async () => {
  const server = stub('server');
  const r = rig({ server: server.rt, byok: 'optional' }); r.presence.touch('u1');
  const job = withModel(r.scope()!, () => directEdit({ words }));
  await r.queued();
  r.clock.t += PICKUP_MS;
  const out = await job;
  assert.equal(out.value!.model, 'server'); assert.deepEqual(r.lanes, ['claude-code', 'server']);
});

test('bridge 24: no key and the server model not allowed (MOOVI_BYOK=required): it waits, and a /moovi:run picks it up', async () => {
  const server = stub('server');
  const r = rig({ server: server.rt, byok: 'required' }); r.presence.touch('u1');
  const job = withModel(r.scope()!, () => directEdit({ words }));
  await r.queued();
  r.clock.t += PICKUP_MS;
  await r.waiting();
  r.clock.t += WAIT_MS - 1000;
  const t = await r.gate.mintTicket('u1');
  const p = await r.gate.pull('u1', 'sess-A', t); assert.ok('step' in p);
  assert.deepEqual(await r.gate.submit('u1', 'sess-A', p.lease, p.step.id, good), { ok: true });
  const out = await job;
  assert.equal(out.value!.model, 'claude-test'); assert.deepEqual(server.saw, [], 'the server model never ran a keyless user\'s brain call');
  assert.deepEqual(r.lanes, ['claude-code', 'wait']);
});

test('bridge 24: waiting and nobody comes for 10 min: the job parks (BrainWaiting), it does not fail', async () => {
  const r = rig(); r.presence.touch('u1');
  const job = withModel(r.scope()!, () => directEdit({ words }));
  await r.queued();
  r.clock.t += PICKUP_MS;
  await r.waiting();
  r.clock.t += WAIT_MS;
  await assert.rejects(job, BrainWaiting);
});

test('bridge 24: Claude Code offline (no poll for 90 s) and a key: the key at once, nothing queued, no 120 s wait', async () => {
  const key = stub('key');
  const r = rig({ key: key.rt }); r.presence.touch('u1');
  r.clock.t += ONLINE_MS + 1;
  const out = await withModel(r.scope()!, () => directEdit({ words }));
  assert.equal(out.value!.model, 'key'); assert.deepEqual(r.lanes, ['key']);
  assert.equal((await r.store.range(KEY.queue('u1'))).length, 0);
});

test('bridge 24: a lane switch mid job keeps the memo; back online, the answered step replays and is not asked again', async () => {
  const key = stub('key');
  const r = rig({ key: key.rt }); r.presence.touch('u1');
  // the first decision: Claude Code answers it (remembered 24 h)
  const one = withModel(r.scope()!, () => directEdit({ words }));
  await r.queued();
  const t = await r.gate.mintTicket('u1');
  const p = await r.gate.pull('u1', 'sess-A', t); assert.ok('step' in p);
  await r.gate.submit('u1', 'sess-A', p.lease, p.step.id, good);
  const first = await one;
  // the window goes away; the same user's next decision (another video's) goes to the key after 120 s
  const two = withModel(r.scope()!, () => directEdit({ words: words.map(w => (w.word === 'tiny.' ? { ...w, word: 'small.' } : w)) }));
  await r.queued();
  r.clock.t += PICKUP_MS;
  assert.equal((await two).value!.model, 'key');
  assert.equal(await r.queue.recall('u1', p.step.fp), good, 'the memo is intact after the switch');
  // Claude Code back (a poll): the first video's rerun replays its answer and asks nothing
  r.presence.touch('u1');
  const again = await withModel(r.scope()!, () => directEdit({ words }));
  assert.equal(JSON.stringify(again), JSON.stringify(first));
  assert.equal((await r.store.range(KEY.queue('u1'))).length, 0);
});

test('bridge 24: connected (a token) but never polled, keyless under MOOVI_BYOK=required: the job gets the bridge, not a refusal', async () => {
  const hub = new BrainHub(memoryStore());
  const unregister = hub.register({ server: null });
  try {
    assert.equal(scopeFor('u9'), null, 'no token: no bridge scope (the studio asks for a key or a connection)');
    await hub.tokens.mint('u9');
    await primeBrainScope('u9');
    assert.equal(hub.presence.state('u9'), 'linked');
    assert.equal(scopeFor('u9')?.provider, BRIDGE_PROVIDER, 'the worker gets a scope: the video waits for /moovi:run');
  } finally { unregister(); }
});
