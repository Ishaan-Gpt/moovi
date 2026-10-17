import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memoryStore, ONLINE_MS, Presence } from '../src/index';

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
