import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { buildEdl, directEdit, EXAMPLE_DIRECTION, overridesOf } from '@moovi/engine/brain';
import { withModel } from '@moovi/engine/runtime';
import { brainRun, scopeFor } from '@moovi/engine/keys';
import { BrainHub, bridgeHttp, brainScope, buildMcp, Gate, IDLE_OTHER_WINDOW, KEY, mcpHandler, memoryStore, Presence, StepQueue, stepView } from '../src/index';

/**
 * Bridge item 21: two windows, two folders. Two windows on two videos never cross; a second window on the same
 * video is told another window has it (between steps too); the same video from two folders gets the same step, the
 * same answers and a byte-identical EDL (the folder, its CLAUDE.md and its chat never reach Moovi).
 */
const W = (word: string, t: number, end: number) => ({ word, t, end });
const words = [W('This', 0.2, 0.4), W('chip', 0.45, 0.8), W('is', 0.85, 0.95), W('tiny.', 1.0, 1.4), W('It', 2.0, 2.1), W('has', 2.15, 2.3), W('19', 2.35, 2.6), W('billion', 2.65, 3.0), W('transistors.', 3.05, 3.8),
  W('Each', 4.5, 4.7), W('one', 4.75, 4.9), W('switches', 4.95, 5.4), W('fast.', 5.45, 5.9), W('Follow', 6.5, 6.8), W('for', 6.85, 6.95), W('more.', 7.0, 7.5)];
const answer = (model: string) => JSON.stringify({ ...EXAMPLE_DIRECTION, model });
const tick = (ms = 5) => new Promise(res => setTimeout(res, ms));
const palette = { ink: '#000', paper: '#fff', accent: '#f00', accent2: '#0f0', deep: '#000', pop: '#fff' };
const source = { file: 'src.mp4', duration: 8, w: 1080, h: 1920, fps: 30 };

function rig() {
  const store = memoryStore(), queue = new StepQueue(store), presence = new Presence();
  const gate = new Gate(store, queue, Date.now, u => presence.touch(u));
  presence.touch('u1');
  const scope = (job: string) => brainScope({ user: 'u1', queue, presence, job: () => job, own: null, server: null, byok: 'required', bridge: { pollMs: 5 } })!;
  const queued = async (n: number) => { for (let i = 0; i < 400; i++) { if ((await store.range(KEY.queue('u1'))).length >= n) return; await tick(); } throw new Error('steps not queued'); };
  return { store, queue, gate, scope, queued };
}
const edlOf = (d: typeof EXAMPLE_DIRECTION) => {
  const o = overridesOf(d);
  return JSON.stringify(buildEdl({ source, words, pauses: [], palette, ...(o.tags ? { tags: o.tags } : {}), ...(o.laws ? { laws: o.laws } : {}), style: { id: 'base' }, seed: 1 }));
};

test('bridge 21: two windows on two videos never cross', async () => {
  const r = rig();
  const v1 = withModel(r.scope('vid-1'), () => directEdit({ words }));
  await r.queued(1);
  const v2 = withModel(r.scope('vid-2'), () => directEdit({ words: words.map(w => (w.word === 'fast.' ? { ...w, word: 'quick.' } : w)) }));
  await r.queued(2);
  const tA = await r.gate.mintTicket('u1'), tB = await r.gate.mintTicket('u1');
  const a = await r.gate.pull('u1', 'win-A', tA); assert.ok('step' in a);
  const b = await r.gate.pull('u1', 'win-B', tB); assert.ok('step' in b);
  assert.equal(a.step.job, 'vid-1'); assert.equal(b.step.job, 'vid-2', 'B gets the other video, not A\'s');
  const cross = await r.gate.submit('u1', 'win-A', a.lease, b.step.id, answer('claude-A'));
  assert.deepEqual(cross, { ok: false, why: IDLE_OTHER_WINDOW }, 'A cannot answer B\'s video');
  assert.deepEqual(await r.gate.submit('u1', 'win-B', b.lease, b.step.id, answer('claude-B')), { ok: true });
  assert.deepEqual(await r.gate.submit('u1', 'win-A', a.lease, a.step.id, answer('claude-A')), { ok: true });
  assert.equal((await v1).value!.model, 'claude-A');
  assert.equal((await v2).value!.model, 'claude-B');
});

test('bridge 21: the same video from two folders: the same step, the same answer, a byte-identical EDL', async () => {
  // folder 1, window A answers the step
  const r1 = rig();
  const one = withModel(r1.scope('vid-1'), () => directEdit({ words }));
  await r1.queued(1);
  const a = await r1.gate.pull('u1', 'win-folder-1', await r1.gate.mintTicket('u1')); assert.ok('step' in a);
  const viewA = JSON.parse((stepView(a.step, a.lease).content[0] as { text: string }).text);
  await r1.gate.submit('u1', 'win-folder-1', a.lease, a.step.id, answer('claude-test'));
  const out1 = await one;
  // folder 2, a new window with no saved answer anywhere (a fresh store): it is shown exactly the same step
  const r2 = rig();
  const two = withModel(r2.scope('vid-1'), () => directEdit({ words }));
  await r2.queued(1);
  const b = await r2.gate.pull('u1', 'win-folder-2', await r2.gate.mintTicket('u1')); assert.ok('step' in b);
  const viewB = JSON.parse((stepView(b.step, b.lease).content[0] as { text: string }).text);
  for (const v of [viewA, viewB]) { delete v.step; delete v.lease; }
  assert.equal(JSON.stringify(viewB), JSON.stringify(viewA), 'what Claude Code is asked does not depend on the window or folder');
  await r2.gate.submit('u1', 'win-folder-2', b.lease, b.step.id, answer('claude-test'));
  const out2 = await two;
  // folder 2 on the first store (a rerun of the same video): asked nothing, the answer replays
  const three = await withModel(r1.scope('vid-1'), () => directEdit({ words }));
  assert.equal((await r1.store.range(KEY.queue('u1'))).length, 0);
  const edl1 = edlOf(out1.value!), edl2 = edlOf(out2.value!), edl3 = edlOf(three.value!);
  assert.ok(edl1.length > 200);
  assert.equal(edl2, edl1); assert.equal(edl3, edl1, 'byte-identical EDL');
});

test('bridge 21: over HTTP, a second window on the same video is told another window has it, between steps too', async () => {
  const hub = new BrainHub();
  const unregister = hub.register({ server: null, bridge: { pollMs: 5 } });
  const mcp = mcpHandler({ verify: t => hub.tokens.verify(t), build: ctx => buildMcp(hub, ctx) });
  const http = bridgeHttp({ mcp });
  await new Promise<void>(res => http.listen(0, '127.0.0.1', res));
  const base = `http://127.0.0.1:${(http.address() as AddressInfo).port}`;
  after(async () => { unregister(); await mcp.close(); await new Promise(res => http.close(res)); });
  const { token } = await hub.tokens.mint('u7');
  const open = async () => {
    const transport = new StreamableHTTPClientTransport(new URL(`${base}/mcp`), { requestInit: { headers: { Authorization: `Bearer ${token}` } } });
    const client = new Client({ name: 'claude-code-standin', version: '1' });
    await client.connect(transport);
    await client.getPrompt({ name: 'run' }); // the user typed /moovi:run in this window
    const call = async (name: string, args: Record<string, unknown>) => {
      const res = await client.callTool({ name, arguments: args }, undefined, { timeout: 60_000 });
      return JSON.parse((res.content as { text: string }[])[0]!.text) as Record<string, any>;
    };
    return { transport, client, call };
  };
  const A = await open();
  await A.call('moovi_next', { wait_s: 0 }); // the window polls: Claude Code is online
  await brainRun({ type: 'start', user: 'u7', project: 'p7', run: 'job-u7', chat: 'c7' });
  const edit = withModel(scopeFor('u7')!, () => directEdit({ words }));
  const step = await A.call('moovi_next', { wait_s: 10 });
  assert.equal(step.status, 'think');
  const done = await A.call('moovi_answer', { step: step.step, answer: JSON.parse(answer('claude-A')), wait_s: 0.2 });
  assert.equal(done.ok, true);
  assert.equal((await edit).value!.model, 'claude-A');

  const B = await open();
  const turnedAway = await B.call('moovi_next', { wait_s: 0.5 });
  assert.equal(turnedAway.status, 'idle'); assert.equal(turnedAway.message, IDLE_OTHER_WINDOW, 'between steps, B is told at once');
  await A.transport.terminateSession(); await A.client.close();
  for (let i = 0; i < 100 && await hub.gate.heldElsewhere('job-u7', 'x'); i++) await tick(10);
  const free = await B.call('moovi_next', { wait_s: 0.3 });
  assert.equal(free.status, 'working', 'A closed: the video is free, B looks after it');
  await brainRun({ type: 'end', user: 'u7', project: 'p7', run: 'job-u7', chat: 'c7', ok: true });
  await B.transport.terminateSession(); await B.client.close();
});
