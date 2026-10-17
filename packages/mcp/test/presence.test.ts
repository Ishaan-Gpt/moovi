import { test } from 'node:test';
import assert from 'node:assert/strict';
import { brainPresence } from '@moovi/engine/keys';
import { BrainHub, memoryStore, ONLINE_MS, Presence } from '../src/index';
import { brainFor } from '../../engine/src/router/pipeline';

test('bridge 16: presence crosses processes through the store (the /mcp process writes, the worker primes)', async () => {
  let t = 1_000_000;
  const store = memoryStore(() => t);
  const mcpSide = new Presence(() => t, store), worker = new Presence(() => t, store);
  assert.equal(worker.state('u1'), 'off');
  mcpSide.touch('u1');
  assert.equal(worker.state('u1'), 'off', 'nothing is shared until the worker primes');
  await worker.prime('u1');
  assert.equal(worker.state('u1'), 'online');
  t += ONLINE_MS + 1;
  assert.equal(worker.state('u1'), 'linked', 'online only while pulls are recent');
  t += 2_000; mcpSide.touch('u1'); t += 1_000; mcpSide.touch('u1');
  await worker.prime('u1');
  assert.equal(worker.state('u1'), 'online');
  await new Presence(() => t).prime('u1');
});

test('router W1: a linked, online Claude Code is Creative (the bridge hands the router its presence, not only "linked")', async () => {
  const hub = new BrainHub(memoryStore());
  const unregister = hub.register({ server: null });
  try {
    assert.equal(await brainPresence('w1-off'), 'off');
    await hub.tokens.mint('w1-linked');
    assert.equal(await brainPresence('w1-linked'), 'linked', 'connected, no window polling yet');
    await hub.tokens.mint('w1-online'); hub.presence.touch('w1-online');
    assert.equal(await brainPresence('w1-online'), 'online');
    assert.equal(await brainFor('w1-online'), 'creative', 'Ishaan\'s order: a linked, online Claude Code first');
  } finally { unregister(); }
  assert.equal(await brainPresence('w1-online'), 'off', 'no bridge in the process: the token alone, and no hooks');
});
