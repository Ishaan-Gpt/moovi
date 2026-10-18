import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withModel, type CompleteRequest, type ModelScope, type Runtime } from '@moovi/engine/runtime';
import { DIRECT_SPEC_AGENT, directMasterySpec, masteryText } from '../../engine/src/edit/mastery-direct';
import { tierFor } from '../../engine/src/skill-prompt';
import { brainScope, Gate, memoryStore, Presence, StepQueue } from '../src/index';

/**
 * Decision 20 through the bridge: a linked Claude Code writes the Edit spec (direct:edit-spec) from the full
 * ishaan-motion skill. Before the lane fix that step never reached Claude Code: it was not a brain agent, so it went to
 * the key or the server model even with Claude Code online.
 */
const W = (word: string, t: number, end: number) => ({ word, t, end });
const words = [W('This', 0.2, 0.4), W('chip', 0.45, 0.8), W('is', 0.85, 0.95), W('tiny.', 1.0, 1.4), W('It', 2.0, 2.1), W('has', 2.15, 2.3), W('19', 2.35, 2.6), W('billion', 2.65, 3.0), W('transistors.', 3.05, 3.8)];

function rig(own: Runtime | null = null, pickupMs?: number) {
  const store = memoryStore(), queue = new StepQueue(store), presence = new Presence();
  const gate = new Gate(store, queue, Date.now, u => presence.touch(u));
  const lanes: string[] = [];
  const o: ModelScope | null = own ? { runtime: own, models: { director: 'd', crew: 'c', fast: 'f' }, provider: 'test', deadlineScale: 1, drawsWell: true } : null;
  const scope = () => brainScope({ user: 'u1', queue, presence, job: () => 'job-1', own: o, server: null, byok: 'required', bridge: { pollMs: 5, ...(pickupMs ? { pickupMs, waitMs: pickupMs } : {}) }, onLane: (agent, lane) => lanes.push(`${agent}>${lane}`) });
  return { gate, presence, scope, lanes };
}

test('decision 20: a linked Claude Code gets the Edit spec step with the full skill and its answer is the spec', async () => {
  const r = rig(); r.presence.touch('u1');
  const scope = r.scope()!;
  assert.equal(tierFor(scope.provider), 'full', 'a linked Claude Code is the full tier');
  const dev = masteryText().devices;
  assert.ok(dev.includes('cam'), dev.join(','));
  const spec = { beats: [{ from: { w: 'this' }, layers: [{ t: 'cam', form: 'full' }] }, { from: { w: 'billion' }, layers: [{ t: 'cam', form: 'tight', z: 1.2 }] }] };
  const ticket = await r.gate.mintTicket('u1');
  let seen: { agent: string; system: string; schema: unknown; maxOut?: number } | null = null, stop = false;
  const loop = (async () => { while (!stop) {
    const p = await r.gate.pull('u1', 'sess-A', ticket);
    if ('step' in p) { seen = p.step as never; const res = await r.gate.submit('u1', 'sess-A', p.lease, p.step.id, JSON.stringify(spec)); assert.ok(res.ok, JSON.stringify(res)); }
    await new Promise(res => setTimeout(res, 5));
  } })();
  const out = await withModel(scope, () => directMasterySpec({ words, duration: 4, brief: 'Edit my video' }));
  stop = true; await loop;
  assert.ok(seen, 'Claude Code was asked');
  const s = seen as unknown as { agent: string; system: string; schema: unknown; maxOut?: number };
  assert.equal(s.agent, DIRECT_SPEC_AGENT);
  assert.ok(s.system.length > 20_000, `the full skill rides the step (${s.system.length} chars)`);
  assert.ok(s.schema && typeof s.schema === 'object', 'the step carries a JSON schema');
  assert.equal(s.maxOut, undefined, 'no 1200 token cap on the spec');
  assert.deepEqual(out.value, spec);
  assert.deepEqual(r.lanes, [`${DIRECT_SPEC_AGENT}>claude-code`]);
});

test('decision 20: nobody picks the spec step up: it moves to the key, as every brain step does', async () => {
  const keySaw: string[] = [];
  const key: Runtime = { name: 'key', vision: false, run: async () => { throw new Error('x'); }, complete: async (q: CompleteRequest) => { keySaw.push(q.agent); return '{"beats":[]}'; } };
  const r = rig(key, 60); r.presence.touch('u1');
  const out = await withModel(r.scope()!, () => directMasterySpec({ words, duration: 4 }));
  assert.equal(out.value, null, 'an empty answer is the skeleton');
  assert.ok(keySaw.length >= 1 && keySaw.every(a => a === DIRECT_SPEC_AGENT), keySaw.join(','));
  assert.equal(r.lanes[0], `${DIRECT_SPEC_AGENT}>claude-code`);
  assert.ok(r.lanes.includes(`${DIRECT_SPEC_AGENT}>key`), r.lanes.join(' '));
});
