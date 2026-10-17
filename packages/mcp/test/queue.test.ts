import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from 'redis';
import { BrainNotPickedUp } from '@moovi/engine/runtime';
import { BrainRefused, BrainTimedOut, bridgeRuntime, fingerprint, KEY, memoryStore, redisStore, StepQueue, type BrainStore } from '../src/index';

const req = (agent = 'direct:edit', prompt = 'sentences: 0 [0.0s] hello') => ({ agent, system: 'You direct the edit.', prompt, model: 'client', deadlineMs: 1000 });

/** a stand-in for the user's Claude Code: picks every queued step of `user` and answers it */
function fakeClaude(q: StepQueue, user: string, answer: (prompt: string) => string, session = 'sess-A') {
  let stop = false, answered = 0;
  const loop = (async () => { while (!stop) { const s = await q.next(user, session); if (s) { await q.answer(s.id, answer(s.prompt), session); answered++; } await new Promise(r => setTimeout(r, 5)); } })();
  return { stop: async () => { stop = true; await loop; }, get answered() { return answered; } };
}

test('queue 8: memory store keys expire', async () => {
  let t = 1000; const s = memoryStore(() => t);
  await s.set('a', '1', 100); assert.equal(await s.get('a'), '1');
  t += 101; assert.equal(await s.get('a'), null);
  assert.equal(await s.setNx('l', 'x', 50), true); assert.equal(await s.setNx('l', 'y', 50), false);
  t += 51; assert.equal(await s.setNx('l', 'y', 50), true);
});

test('queue 8: push, next, answer; idempotent answers; another session refused', async () => {
  const q = new StepQueue(memoryStore());
  const s = await q.push({ user: 'u1', job: 'j1', agent: 'direct:edit', system: 's', prompt: 'p', schema: null });
  assert.equal(s.fp, fingerprint({ agent: 'direct:edit', system: 's', prompt: 'p', schema: null }));
  assert.equal(await q.next('u2', 'x'), null, 'another user sees nothing');
  const got = await q.next('u1', 'sess-A'); assert.equal(got?.id, s.id); assert.equal(got?.state, 'picked');
  assert.equal(await q.next('u1', 'sess-B'), null, 'picked once only');
  assert.deepEqual(await q.answer(s.id, '{"a":1}', 'sess-B'), { ok: false, why: 'this step belongs to another session' });
  assert.deepEqual(await q.answer(s.id, '{"a":1}', 'sess-A'), { ok: true });
  assert.deepEqual(await q.answer(s.id, '{"a":1}', 'sess-A'), { ok: true }, 'same answer twice is fine');
  assert.equal((await q.answer(s.id, '{"a":2}', 'sess-A')).ok, false, 'a different second answer is refused');
});

test('queue 8: a second run of the same step asks Claude Code nothing (memo replay)', async () => {
  const q = new StepQueue(memoryStore()); const events: string[] = [];
  const claude = fakeClaude(q, 'u1', () => '{"style":"atlas"}');
  const rt = bridgeRuntime({ queue: q, user: 'u1', job: () => 'run-1', pollMs: 5, onEvent: e => events.push(e.type) });
  assert.equal(await rt.complete!(req()), '{"style":"atlas"}');
  assert.equal(await rt.complete!(req()), '{"style":"atlas"}');
  await claude.stop();
  assert.equal(claude.answered, 1, 'asked once');
  assert.deepEqual(events, ['queued', 'answered', 'replayed']);
  // a different question is a new step
  const c2 = fakeClaude(q, 'u1', () => '{"style":"handmade"}');
  assert.equal(await rt.complete!(req('direct:edit', 'sentences: 0 [0.0s] bye')), '{"style":"handmade"}');
  await c2.stop();
  // another user never sees this user's memo
  const other = bridgeRuntime({ queue: q, user: 'u2', job: () => 'run-9', pollMs: 5, pickupMs: 30 });
  await assert.rejects(other.complete!(req()), BrainNotPickedUp);
});

test('queue 8: a rejected answer is not remembered', async () => {
  const q = new StepQueue(memoryStore());
  const claude = fakeClaude(q, 'u1', () => 'not json');
  const rt = bridgeRuntime({ queue: q, user: 'u1', job: () => 'r', pollMs: 5, accept: (_a, t) => (t.startsWith('{') ? [] : ['not JSON']) });
  await rt.complete!(req()); await rt.complete!(req());
  await claude.stop();
  assert.equal(claude.answered, 2);
});

test('queue 8: not picked up in time, or picked and never answered, are typed errors', async () => {
  const q = new StepQueue(memoryStore());
  const rt = bridgeRuntime({ queue: q, user: 'u1', job: () => 'r', pollMs: 5, pickupMs: 40 });
  await assert.rejects(rt.complete!(req()), BrainNotPickedUp);
  assert.deepEqual(await q.store.range(KEY.queue('u1')), [], 'an expired step leaves the queue');
  const rt2 = bridgeRuntime({ queue: q, user: 'u1', job: () => 'r', pollMs: 5, pickupMs: 1000, answerMs: 40 });
  const silent = (async () => { for (let i = 0; i < 20; i++) { if (await q.next('u1', 'sess-A')) return; await new Promise(r => setTimeout(r, 5)); } })();
  await assert.rejects(rt2.complete!(req('direct:film')), BrainTimedOut);
  await silent;
});

test('queue 8: only brain agents reach the bridge; an abort cancels the step', async () => {
  const q = new StepQueue(memoryStore());
  const rt = bridgeRuntime({ queue: q, user: 'u1', job: () => 'r', pollMs: 5 });
  await assert.rejects(rt.complete!(req('edit:beats')), BrainRefused);
  await assert.rejects(rt.run({ ...req('director'), tools: [], maxTurns: 1 }), BrainRefused);
  const ac = new AbortController();
  const p = rt.complete!({ ...req(), signal: ac.signal });
  setTimeout(() => ac.abort(), 20);
  await assert.rejects(p, /aborted/);
  assert.deepEqual(await q.store.range(KEY.queue('u1')), []);
});

const url = process.env.FALKORDB_URL?.replace(/^falkor:/, 'redis:');
test('queue 8: the same queue on FalkorDB (Redis side)', { skip: !url && 'FALKORDB_URL not set' }, async () => {
  const c = createClient({ url, socket: { connectTimeout: 3000 } }); await c.connect();
  try {
    const store: BrainStore = redisStore(c);
    const user = `test-${Date.now()}`;
    const q = new StepQueue(store);
    const claude = fakeClaude(q, user, () => '{"ok":true}');
    const rt = bridgeRuntime({ queue: q, user, job: () => 'r', pollMs: 10 });
    assert.equal(await rt.complete!(req()), '{"ok":true}');
    assert.equal(await rt.complete!(req()), '{"ok":true}');
    await claude.stop();
    assert.equal(claude.answered, 1);
    assert.equal(await store.setNx(`ce:brain:test:${user}`, '1', 1000), true);
    assert.equal(await store.setNx(`ce:brain:test:${user}`, '1', 1000), false);
    await store.del(`ce:brain:test:${user}`);
  } finally { await c.quit(); }
});
