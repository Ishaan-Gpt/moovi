import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Gate, IDLE_NO_TICKET, IDLE_NOTHING, IDLE_OTHER_WINDOW, LEASE_MS, ANSWER_HOLD_MS, memoryStore, StepQueue, TICKET_FIRST_USE_MS } from '../src/index';

function setup() {
  let t = 1_000_000; const now = () => t;
  const store = memoryStore(now), q = new StepQueue(store, now), g = new Gate(store, q, now);
  const step = (job: string, user = 'u1') => q.push({ user, job, agent: 'direct:edit', system: 's', prompt: `p-${job}-${Math.random()}`, schema: null });
  return { q, g, step, tick: (ms: number) => { t += ms; } };
}

test('lease 9: no run ticket means idle, and a ticket is bound to the session and user that used it', async () => {
  const { g, step, tick } = setup();
  await step('job1');
  assert.deepEqual(await g.pull('u1', 'A', undefined), { idle: IDLE_NO_TICKET });
  assert.deepEqual(await g.pull('u1', 'A', 'rt_forged'), { idle: IDLE_NO_TICKET });
  const t = await g.mintTicket('u1');
  assert.deepEqual(await g.pull('u2', 'A', t), { idle: IDLE_NO_TICKET }, 'another user cannot use it');
  const r = await g.pull('u1', 'A', t); assert.ok('step' in r && r.lease.startsWith('ls_'));
  assert.deepEqual(await g.pull('u1', 'B', t), { idle: IDLE_NO_TICKET }, 'another session cannot reuse it');
  const late = await g.mintTicket('u1'); tick(TICKET_FIRST_USE_MS + 1);
  assert.deepEqual(await g.pull('u1', 'A', late), { idle: IDLE_NO_TICKET }, 'unused tickets expire');
});

test('lease 9: one job, one session: a second session gets nothing of a leased job', async () => {
  const { g, step } = setup();
  await step('job1'); await step('job1');
  const ta = await g.mintTicket('u1'), tb = await g.mintTicket('u1');
  const a = await g.pull('u1', 'A', ta); assert.ok('step' in a);
  assert.deepEqual(await g.pull('u1', 'B', tb), { idle: IDLE_OTHER_WINDOW });
  const a2 = await g.pull('u1', 'A', ta); assert.ok('step' in a2 && a2.lease === (a as { lease: string }).lease, 'same session keeps its lease');
  assert.deepEqual(await g.pull('u1', 'A', ta), { idle: IDLE_NOTHING });
});

test('lease 9: two jobs, two sessions: each works its own and never mixes', async () => {
  const { g, step } = setup();
  await step('job1'); await step('job2'); await step('job1'); await step('job2');
  const ta = await g.mintTicket('u1'), tb = await g.mintTicket('u1');
  const seen: Record<string, Set<string>> = { A: new Set(), B: new Set() };
  for (let i = 0; i < 4; i++) for (const [sess, tk] of [['A', ta], ['B', tb]] as const) {
    const r = await g.pull('u1', sess, tk); if ('step' in r) seen[sess]!.add(r.step.job);
  }
  assert.equal(seen.A!.size, 1); assert.equal(seen.B!.size, 1);
  assert.notDeepEqual([...seen.A!], [...seen.B!]);
});

test('lease 9: answers need the live lease of the step\'s job from its own session', async () => {
  const { g, step, tick } = setup();
  await step('job1');
  const ta = await g.mintTicket('u1');
  const r = await g.pull('u1', 'A', ta); assert.ok('step' in r);
  const { step: s, lease } = r as { step: { id: string }; lease: string };
  assert.equal((await g.submit('u1', 'A', 'ls_wrong', s.id, '{}')).ok, false, 'wrong lease');
  assert.deepEqual(await g.submit('u1', 'B', lease, s.id, '{}'), { ok: false, why: IDLE_OTHER_WINDOW }, 'foreign session');
  assert.equal((await g.submit('u2', 'A', lease, s.id, '{}')).ok, false, 'another user');
  tick(ANSWER_HOLD_MS - 1000);
  assert.deepEqual(await g.submit('u1', 'A', lease, s.id, '{"ok":1}'), { ok: true }, 'the lease holds for the whole answer window');
  tick(LEASE_MS + 1);
  const late = await g.submit('u1', 'A', lease, s.id, '{"ok":1}');
  assert.ok(!late.ok && late.why.includes('expired'), 'an expired lease is refused');
});

test('lease 9: a lapsed lease lets a new session (another folder or laptop) take the job over', async () => {
  const { g, step, tick } = setup();
  await step('job1'); await step('job1');
  const ta = await g.mintTicket('u1');
  assert.ok('step' in (await g.pull('u1', 'A', ta)));
  const tb = await g.mintTicket('u1');
  assert.deepEqual(await g.pull('u1', 'B', tb), { idle: IDLE_OTHER_WINDOW });
  tick(ANSWER_HOLD_MS + 1);
  const b = await g.pull('u1', 'B', tb); assert.ok('step' in b, 'B continues after A lapsed');
});

test('lease 9: a step is handed out exactly once when two pulls race', async () => {
  const { q, step } = setup();
  await step('job1');
  const [x, y] = await Promise.all([q.next('u1', 'A'), q.next('u1', 'A')]);
  assert.equal([x, y].filter(Boolean).length, 1);
});
