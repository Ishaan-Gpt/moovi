import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BRAIN_AGENTS, BrainNotPickedUp, BrainWaiting, brainMode, LANE_ORDER, laneRuntime, NoModelForAgent, pickLane, PICKUP_MS, type LaneFacts, type Runtime,
} from '../src/runtime';
import { registerBrainScope, scopeFor } from '../src/keys';

const F = (o: Partial<LaneFacts> = {}): LaneFacts => ({ claudeCode: 'off', hasKey: false, server: false, byok: 'required', ...o });
const fake = (name: string, log: string[], o: { fail?: Error } = {}): Runtime => ({
  name, vision: false,
  run: async req => { log.push(`${name}:${req.agent}`); if (o.fail) throw o.fail; return { text: name, turns: 1, calls: 0, stopped: 'end', ms: 1 }; },
  complete: async req => { log.push(`${name}:${req.agent}`); if (o.fail) throw o.fail; return `{"from":"${name}"}`; },
});
const creq = (agent: string) => ({ agent, system: 's', prompt: 'p', model: 'm', deadlineMs: 1000 });

test('lane 7: order and constants', () => {
  assert.deepEqual([...LANE_ORDER], ['claude-code', 'key', 'server']);
  assert.equal(PICKUP_MS, 120_000);
  assert.deepEqual([...BRAIN_AGENTS].sort(), ['direct:edit', 'direct:film', 'direct:look']);
});

test('lane 7: every combination picks a lane and never throws', () => {
  const states = ['online', 'linked', 'off'] as const;
  for (const claudeCode of states) for (const hasKey of [true, false]) for (const server of [true, false]) for (const byok of ['required', 'optional'] as const) {
    const f = F({ claudeCode, hasKey, server, byok });
    const b = pickLane('direct:edit', f).lane, d = pickLane('edit:romanize', f).lane;
    // brain: Claude Code online always wins (Ishaan: online beats a key)
    if (claudeCode === 'online') assert.equal(b, 'claude-code');
    else if (hasKey) assert.equal(b, 'key');
    else if (server && byok === 'optional') assert.equal(b, 'server');
    else assert.equal(b, claudeCode === 'linked' ? 'wait' : 'none');
    // detail work never reaches Claude Code
    assert.notEqual(d, 'claude-code'); assert.notEqual(d, 'wait');
    if (hasKey) assert.equal(d, 'key');
    else if (server && (byok === 'optional' || claudeCode !== 'off')) assert.equal(d, 'server');
    else assert.equal(d, 'none');
  }
  assert.equal(pickLane('direct:film', null as unknown as LaneFacts).lane, 'none', 'junk facts do not throw');
});

test('lane 7: brainMode names the mode the site shows', () => {
  assert.equal(brainMode(F({ claudeCode: 'online', hasKey: true })), 'creative');
  assert.equal(brainMode(F({ hasKey: true })), 'precise');
  assert.equal(brainMode(F({ server: true, byok: 'optional' })), 'server');
  assert.equal(brainMode(F({ claudeCode: 'linked' })), 'waiting');
  assert.equal(brainMode(F()), 'none');
});

test('lane 7: the switch sends brain calls to Claude Code and detail calls to the key', async () => {
  const log: string[] = [], lanes: string[] = [];
  const rt = laneRuntime({ facts: () => F({ claudeCode: 'online', hasKey: true, server: true }), brain: fake('brain', log), key: fake('key', log), server: fake('server', log), onLane: (a, l) => lanes.push(`${a}>${l}`) });
  assert.equal(await rt.complete!(creq('direct:edit')), '{"from":"brain"}');
  await rt.run({ ...creq('router:footage'), tools: [], maxTurns: 1 });
  await rt.complete!(creq('edit:beats'));
  assert.deepEqual(log, ['brain:direct:edit', 'key:router:footage', 'key:edit:beats']);
  assert.deepEqual(lanes, ['direct:edit>claude-code', 'router:footage>key', 'edit:beats>key']);
});

test('lane 7: a step not picked up in time moves to the key, else waits for Claude Code', async () => {
  const log: string[] = [];
  const slow = fake('brain', log, { fail: new BrainNotPickedUp('direct:edit', PICKUP_MS) });
  const withKey = laneRuntime({ facts: () => F({ claudeCode: 'online', hasKey: true }), brain: slow, key: fake('key', log) });
  assert.equal(await withKey.complete!(creq('direct:edit')), '{"from":"key"}');
  assert.deepEqual(log, ['brain:direct:edit', 'key:direct:edit']);
  const noKey = laneRuntime({ facts: () => F({ claudeCode: 'online', server: true }), brain: slow, server: fake('server', log) });
  await assert.rejects(noKey.complete!(creq('direct:edit')), BrainWaiting);
  const optional = laneRuntime({ facts: () => F({ claudeCode: 'online', server: true, byok: 'optional' }), brain: slow, server: fake('server', log) });
  assert.equal(await optional.complete!(creq('direct:edit')), '{"from":"server"}');
});

test('lane 7: other brain errors are not swallowed; missing runtimes are skipped; no lane is a typed error', async () => {
  const log: string[] = [];
  const bad = laneRuntime({ facts: () => F({ claudeCode: 'online', hasKey: true }), brain: fake('brain', log, { fail: new Error('bad json') }), key: fake('key', log) });
  await assert.rejects(bad.complete!(creq('direct:edit')), /bad json/);
  const noBrainRt = laneRuntime({ facts: () => F({ claudeCode: 'online', hasKey: true }), key: fake('key', log) });
  assert.equal(await noBrainRt.complete!(creq('direct:film')), '{"from":"key"}');
  const none = laneRuntime({ facts: () => F() });
  await assert.rejects(none.complete!(creq('edit:beats')), NoModelForAgent);
});

test('lane 7: keys.scopeFor asks the registered brain scope first and survives its faults', () => {
  const brainScope = { runtime: fake('lanes', []), models: { director: 'd', crew: 'c', fast: 'f' }, provider: 'claude-code-bridge', deadlineScale: 1, drawsWell: true };
  try {
    registerBrainScope((user, own) => (user === 'u-bridge' ? brainScope : own));
    assert.equal(scopeFor('u-bridge'), brainScope);
    assert.equal(scopeFor('u-nobody'), null);
    registerBrainScope(() => { throw new Error('bridge down'); });
    assert.equal(scopeFor('u-bridge'), null, 'a bridge fault falls back to the own key scope (none here)');
  } finally { registerBrainScope(null); }
  assert.equal(scopeFor('u-bridge'), null);
});
