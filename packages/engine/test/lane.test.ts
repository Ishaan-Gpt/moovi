import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BRAIN_AGENTS, BrainNotPickedUp, BrainWaiting, brainMode, LANE_ORDER, laneRuntime, NoModelForAgent, pickLane, PICKUP_MS, WAIT_MS, type LaneFacts, type Runtime,
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
  assert.deepEqual([...BRAIN_AGENTS].sort(), ['direct:edit', 'direct:edit-spec', 'direct:film', 'direct:look']);
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

test('lane 24: the wait lane queues on the long-pickup bridge and parks only when nobody picks it up', async () => {
  assert.ok(WAIT_MS > PICKUP_MS);
  const log: string[] = [];
  const brain = fake('brain', log, { fail: new BrainNotPickedUp('direct:edit', PICKUP_MS) });
  const answers = laneRuntime({ facts: () => F({ claudeCode: 'online' }), brain, waitBrain: fake('wait', log) });
  assert.equal(await answers.complete!(creq('direct:edit') as never), '{"from":"wait"}');
  assert.deepEqual(log, ['brain:direct:edit', 'wait:direct:edit']);
  const nobody = laneRuntime({ facts: () => F({ claudeCode: 'linked' }), brain, waitBrain: fake('wait', [], { fail: new BrainNotPickedUp('direct:edit', WAIT_MS) }) });
  await assert.rejects(nobody.complete!(creq('direct:edit') as never), BrainWaiting);
  const none = laneRuntime({ facts: () => F({ claudeCode: 'linked' }), brain });
  await assert.rejects(none.complete!(creq('direct:edit') as never), BrainWaiting, 'without a wait bridge it parks at once, as before');
});

test('lane 7: a step\'s "brain" reaches the key and server lanes as their own model id, Claude Code keeps the name', async () => {
  // live server log, 2026-10-18 04:33 IST: groq: model "brain" is gone; using "openai/gpt-oss-120b" for the crew tier
  const seen: string[] = [];
  const spy = (name: string): Runtime => ({ name, vision: false,
    run: async req => { seen.push(`${name}:${req.model}`); return { text: name, turns: 1, calls: 0, stopped: 'end', ms: 1 }; },
    complete: async req => { seen.push(`${name}:${req.model}`); return '{}'; } });
  const models = { key: { director: 'own-big', crew: 'own-mid', fast: 'own-small' }, server: { director: 'srv-big', crew: 'srv-mid', fast: 'srv-small' } };
  const req = (model: string) => ({ agent: 'direct:edit', system: 's', prompt: 'p', model, deadlineMs: 1000 });
  await laneRuntime({ facts: () => F({ claudeCode: 'online', hasKey: true }), brain: spy('brain'), key: spy('key'), models }).complete!(req('brain'));
  await laneRuntime({ facts: () => F({ hasKey: true }), key: spy('key'), models }).complete!(req('brain'));
  await laneRuntime({ facts: () => F({ server: true, byok: 'optional' }), server: spy('server'), models }).complete!(req('brain'));
  await laneRuntime({ facts: () => F({ hasKey: true }), key: spy('key'), models }).run({ ...req('fast'), agent: 'edit:romanize', tools: [], maxTurns: 1 } as never);
  await laneRuntime({ facts: () => F({ hasKey: true }), key: spy('key'), models }).complete!(req('claude-sonnet-x'));
  // a scope with placeholder models ('server') keeps the name rather than sending a placeholder
  await laneRuntime({ facts: () => F({ hasKey: true }), key: spy('key'), models: { key: { director: 'server', crew: 'server', fast: 'server' } } }).complete!(req('brain'));
  assert.deepEqual(seen, ['brain:brain', 'key:own-big', 'server:srv-big', 'key:own-small', 'key:claude-sonnet-x', 'key:brain']);
});

test('lane 7: decision 20, the Edit spec reaches a linked Claude Code; the menu step never does', () => {
  const on = F({ claudeCode: 'online', hasKey: true, server: true, byok: 'optional' });
  assert.equal(pickLane('direct:edit-spec', on).lane, 'claude-code');
  assert.notEqual(pickLane('direct:edit-menu', on).lane, 'claude-code');
  assert.equal(pickLane('direct:edit-spec', F({ claudeCode: 'linked', hasKey: false, server: false, byok: 'required' })).lane, 'wait');
  assert.equal(pickLane('direct:edit-spec', F({ claudeCode: 'off', hasKey: true, server: false, byok: 'required' })).lane, 'key');
});
