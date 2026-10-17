import { test } from 'node:test';
import assert from 'node:assert/strict';
import { directEdit, EXAMPLE_DIRECTION, BRIDGE_PROVIDER } from '@moovi/engine/brain';
import { withModel, BrainWaiting, type CompleteRequest, type Runtime, type ModelScope } from '@moovi/engine/runtime';
import { registerBrainScope, scopeFor } from '@moovi/engine/keys';
import { brainScope, Gate, IDLE_NO_TICKET, IDLE_OTHER_WINDOW, memoryStore, Presence, StepQueue } from '../src/index';

const W = (word: string, t: number, end: number) => ({ word, t, end });
const words = [W('This', 0.2, 0.4), W('chip', 0.45, 0.8), W('is', 0.85, 0.95), W('tiny.', 1.0, 1.4), W('It', 2.0, 2.1), W('has', 2.15, 2.3), W('19', 2.35, 2.6), W('billion', 2.65, 3.0), W('transistors.', 3.05, 3.8),
  W('Each', 4.5, 4.7), W('one', 4.75, 4.9), W('switches', 4.95, 5.4), W('fast.', 5.45, 5.9), W('Follow', 6.5, 6.8), W('for', 6.85, 6.95), W('more.', 7.0, 7.5)];
const good = JSON.stringify({ ...EXAMPLE_DIRECTION, model: 'claude-test' });

function rig(o: { own?: Runtime | null; byok?: 'required' | 'optional'; pickupMs?: number } = {}) {
  const store = memoryStore(), queue = new StepQueue(store), presence = new Presence();
  const gate = new Gate(store, queue, Date.now, u => presence.touch(u));
  const lanes: string[] = [];
  const own: ModelScope | null = o.own ? { runtime: o.own, models: { director: 'd', crew: 'c', fast: 'f' }, provider: 'test', deadlineScale: 1, drawsWell: true } : null;
  const scope = () => brainScope({ user: 'u1', queue, presence, job: () => 'job-1', own, server: null, byok: o.byok ?? 'required', bridge: { pollMs: 5, ...(o.pickupMs ? { pickupMs: o.pickupMs, waitMs: o.pickupMs } : {}) }, onLane: (a, l) => lanes.push(`${a}>${l}`) });
  return { store, queue, presence, gate, scope, lanes };
}

/** a stand-in Claude Code session: types /mcp__moovi__run (a ticket), then pulls and answers through the gate */
async function claudeSession(r: ReturnType<typeof rig>, session: string, answer: (n: number) => string | Promise<string>, o: { ticket?: string | null; pause?: (asked: number) => Promise<void> } = {}) {
  const ticket = o.ticket === null ? undefined : o.ticket ?? await r.gate.mintTicket('u1');
  let stop = false, n = 0; const idles: string[] = [];
  const loop = (async () => { while (!stop) {
    await o.pause?.(n);
    const p = await r.gate.pull('u1', session, ticket);
    if ('step' in p) { const res = await r.gate.submit('u1', session, p.lease, p.step.id, await answer(++n)); assert.ok(res.ok, JSON.stringify(res)); }
    else idles.push(p.idle);
    await new Promise(res => setTimeout(res, 5));
  } })();
  return { stop: async () => { stop = true; await loop; }, get asked() { return n; }, idles };
}

test('bridge 12: end to end, a Claude Code session directs the edit through the gate', async () => {
  const r = rig();
  r.presence.touch('u1');
  const s = await claudeSession(r, 'sess-A', () => good);
  const out = await withModel(r.scope()!, () => directEdit({ words }));
  await s.stop();
  assert.equal(out.source, 'brain'); assert.equal(out.value!.style, 'atlas'); assert.equal(out.value!.model, 'claude-test');
  assert.equal(s.asked, 1);
  assert.deepEqual(r.lanes, ['direct:edit>claude-code']);
});

test('bridge 12: a second session never gets the job; a bad answer gets one re-ask', async () => {
  const r = rig(); r.presence.touch('u1');
  // A holds the job: its first answer is bad; it pulls the re-ask only after B has been turned away while A holds the job
  let b: Awaited<ReturnType<typeof claudeSession>> | null = null;
  const seenOther = async () => { for (let i = 0; i < 400 && !(b?.idles.includes(IDLE_OTHER_WINDOW)); i++) await new Promise(res => setTimeout(res, 5)); };
  const a = await claudeSession(r, 'sess-A', n => (n === 1 ? '{"style":"vaporwave"}' : good), { pause: async n => { if (n === 1) await seenOther(); } });
  const p = withModel(r.scope()!, () => directEdit({ words }));
  for (let i = 0; i < 400 && a.asked < 1; i++) await new Promise(res => setTimeout(res, 5));
  b = await claudeSession(r, 'sess-B', () => good);
  const out = await p;
  await a.stop(); await b.stop();
  assert.equal(out.source, 'reask'); assert.equal(a.asked, 2); assert.equal(b.asked, 0);
  assert.ok(b.idles.every(x => x === IDLE_OTHER_WINDOW || x.startsWith('Nothing')), b.idles.join(' | '));
  assert.ok(b.idles.includes(IDLE_OTHER_WINDOW));
});

test('bridge 12: no /mcp__moovi__run (no ticket) means no work; the step times out to the key', async () => {
  const keySaw: string[] = [];
  const key: Runtime = { name: 'key', vision: false, run: async () => { throw new Error('x'); }, complete: async (q: CompleteRequest) => { keySaw.push(q.agent); return good; } };
  const r = rig({ own: key, pickupMs: 60 }); r.presence.touch('u1');
  const s = await claudeSession(r, 'sess-A', () => good, { ticket: null });
  const out = await withModel(r.scope()!, () => directEdit({ words }));
  await s.stop();
  assert.equal(s.asked, 0); assert.ok(s.idles.every(x => x === IDLE_NO_TICKET));
  assert.equal(out.source, 'brain'); assert.deepEqual(keySaw, ['direct:edit']);
  assert.deepEqual(r.lanes, ['direct:edit>claude-code', 'direct:edit>key']);
});

test('bridge 12: no key and nobody picks up: the job waits for Claude Code (parks), it is not failed', async () => {
  const r = rig({ pickupMs: 40 }); r.presence.touch('u1');
  await assert.rejects(withModel(r.scope()!, () => directEdit({ words })), BrainWaiting);
});

test('bridge 12: registered as the brain scope, it goes first for a connected user and steps aside otherwise', () => {
  const r = rig();
  try {
    registerBrainScope((user, own) => (user === 'u1' ? r.scope() ?? own : own));
    assert.equal(scopeFor('u1'), null, 'never connected: no bridge scope');
    r.presence.touch('u1');
    assert.equal(scopeFor('u1')?.provider, BRIDGE_PROVIDER);
  } finally { registerBrainScope(null); }
});
