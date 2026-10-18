import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ask, concreteModel, model, withModel, type CompleteRequest, type Runtime } from '@moovi/engine/runtime';
import { z } from 'zod';
import { brainScope, memoryStore, Presence, StepQueue } from '../src/index';

/**
 * Local e2e, Oct 18 (Launch preset, keyless user, Claude Code linked): the Launch writer (launch:film, detail work) went
 * to Moovi's server model with the model id "server" and the provider answered 404 "model: server", so every Launch
 * video of such a user failed at the writer. The scope's tiers are logical names the server lane maps to real ids.
 */
function rig() {
  const store = memoryStore(), queue = new StepQueue(store), presence = new Presence();
  const seen: string[] = [];
  const server: Runtime = { name: 'server', vision: false, run: async () => { throw new Error('no tool loop here'); }, complete: async (q: CompleteRequest) => { seen.push(q.model); return '{"line":"ok"}'; } };
  presence.touch('u1');
  const scope = brainScope({ user: 'u1', queue, presence, job: () => 'job-1', own: null, server, byok: 'optional' })!;
  return { scope, seen };
}

test('keyless + Claude Code linked: a detail call on the server lane carries a real model id, never "server"', async () => {
  const { scope, seen } = rig();
  for (const tier of ['director', 'crew', 'fast'] as const) assert.notEqual(scope.models[tier], 'server');
  const out = await withModel(scope, () => ask({ agent: 'launch:film', tier: 'crew', system: 's', prompt: 'p', schema: { line: z.string() }, deadlineMs: 5_000 }));
  assert.deepEqual(out, { line: 'ok' });
  assert.ok(seen.length >= 1);
  for (const m of seen) { assert.notEqual(m, 'server'); assert.equal(m, concreteModel('server', 'crew')); }
});

test('keyless + Claude Code linked: model(tier) inside the scope is a logical name the lanes understand', async () => {
  const { scope } = rig();
  await withModel(scope, async () => { assert.equal(model('crew'), 'crew'); assert.equal(model('director'), 'director'); });
});
