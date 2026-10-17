import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { directEdit, EXAMPLE_DIRECTION } from '@moovi/engine/brain';
import { withModel } from '@moovi/engine/runtime';
import { brainRun, scopeFor } from '@moovi/engine/keys';
import { BrainHub, bridgeHttp, buildMcp, IDLE_NO_TICKET, IDLE_OTHER_WINDOW, mcpHandler, WAITING_OTHER_WINDOW, NOTHING_RUNNING, precheck, STEP_RULE } from '../src/index';

const W = (word: string, t: number, end: number) => ({ word, t, end });
const words = [W('This', 0.2, 0.4), W('chip', 0.45, 0.8), W('is', 0.85, 0.95), W('tiny.', 1.0, 1.4), W('It', 2.0, 2.1), W('has', 2.15, 2.3), W('19', 2.35, 2.6), W('billion', 2.65, 3.0), W('transistors.', 3.05, 3.8),
  W('Each', 4.5, 4.7), W('one', 4.75, 4.9), W('switches', 4.95, 5.4), W('fast.', 5.45, 5.9), W('Follow', 6.5, 6.8), W('for', 6.85, 6.95), W('more.', 7.0, 7.5)];

const hub = new BrainHub(undefined, { publicUrl: 'https://moovi.example' });
const unregister = hub.register({ server: null, bridge: { pollMs: 5 } });
const mcp = mcpHandler({ verify: t => hub.tokens.verify(t), build: ctx => buildMcp(hub, ctx) });
const http = bridgeHttp({ mcp });
await new Promise<void>(res => http.listen(0, '127.0.0.1', res));
const base = `http://127.0.0.1:${(http.address() as AddressInfo).port}`;
after(async () => { unregister(); await mcp.close(); await new Promise(res => http.close(res)); });

async function window(token: string) {
  const client = new Client({ name: 'claude-code-standin', version: '1' });
  await client.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`), { requestInit: { headers: { Authorization: `Bearer ${token}` } } }));
  const call = async (name: string, args: Record<string, unknown>, onprogress?: (p: { progress: number }) => void) => {
    const r = await client.callTool({ name, arguments: args }, undefined, { timeout: 120_000, ...(onprogress ? { onprogress, resetTimeoutOnProgress: true } : {}) });
    const blocks = r.content as { type: string; text?: string }[];
    return { body: JSON.parse(blocks[0]!.text!) as Record<string, any>, isError: !!r.isError, blocks };
  };
  return { client, call };
}

test('bridge 16: precheck catches only certain shape errors', () => {
  const schema = { type: 'object', required: ['style', 'hook'], properties: { style: { enum: ['atlas', 'pulse'] }, hook: { type: 'number' } } };
  assert.deepEqual(precheck(schema, [1]), ['the answer must be one JSON object']);
  assert.deepEqual(precheck(schema, { style: 'nope' }), ['missing "hook"', '"style" must be one of "atlas", "pulse"']);
  assert.deepEqual(precheck(schema, { style: 'atlas', hook: 1, extra: true }), []);
});

test('bridge 16: from /mcp__moovi__run to the brain answer to done, through moovi_next and moovi_answer over HTTP', async () => {
  const { token } = await hub.tokens.mint('u1');
  const w = await window(token);
  assert.equal((await w.call('moovi_next', { wait_s: 0 })).body.message, IDLE_NO_TICKET, 'nothing happens without /mcp__moovi__run');
  const ticket = await hub.gate.mintTicket('u1');
  assert.equal((await w.call('moovi_next', { ticket, wait_s: 0.2 })).body.message, NOTHING_RUNNING);
  assert.equal(hub.presence.state('u1'), 'online', 'pulling counts as online');

  // the website starts a video: the worker announces the run, the edit asks its one brain question
  await brainRun({ type: 'start', user: 'u1', project: 'p1', run: 'job-u1', chat: 'c1' });
  const scope = scopeFor('u1');
  assert.ok(scope, 'the registered bridge gives the connected user a scope');
  const edit = withModel(scope!, () => directEdit({ words }));

  const step = (await w.call('moovi_next', { wait_s: 10 })).body;
  assert.equal(step.status, 'think'); assert.equal(step.agent, 'direct:edit'); assert.equal(step.rule, STEP_RULE);
  assert.ok(step.answer_schema && step.task && step.system && step.lease);

  const bad = await w.call('moovi_answer', { step: step.step, answer: { style: 'not-a-style' } });
  assert.equal(bad.isError, true); assert.equal(bad.body.ok, false); assert.ok(bad.body.problems.length > 0, 'a bad shape comes back at once and the step stays open');

  const answering = w.call('moovi_answer', { step: step.step, answer: { ...EXAMPLE_DIRECTION, model: 'claude-test' } });
  const out = await edit;
  assert.equal(out.source, 'brain'); assert.equal(out.value!.model, 'claude-test');
  await brainRun({ type: 'end', user: 'u1', project: 'p1', run: 'job-u1', chat: 'c1', ok: true });
  const done = (await answering).body;
  assert.equal(done.ok, true); assert.equal(done.answered, step.step);
  assert.equal(done.next.status, 'done'); assert.equal(done.next.url, 'https://moovi.example/studio/p/p1/c/c1');

  const again = await w.call('moovi_answer', { step: step.step, answer: { ...EXAMPLE_DIRECTION, model: 'claude-test' }, wait_s: 0 });
  assert.equal(again.body.ok, true, 'the same answer twice is fine');
  const other = await w.call('moovi_answer', { step: step.step, answer: { ...EXAMPLE_DIRECTION, title: 'something else' } });
  assert.equal(other.body.ok, false, 'a different second answer is refused');
  const status = (await w.call('moovi_status', {})).body;
  assert.equal(status.jobs.at(-1).state, 'done'); assert.equal(status.this_window_has_run, true);
  await w.client.close();
});

test('bridge 16: a second window waits (and gets nothing) while the first holds the video; other users never see it', async () => {
  const { token } = await hub.tokens.mint('u2');
  const a = await window(token), b = await window(token);
  await a.call('moovi_next', { ticket: await hub.gate.mintTicket('u2'), wait_s: 0 });
  await brainRun({ type: 'start', user: 'u2', project: 'p2', run: 'job-u2', chat: 'c2' });
  const edit = withModel(scopeFor('u2')!, () => directEdit({ words }));
  const step = (await a.call('moovi_next', { wait_s: 10 })).body;
  assert.equal(step.status, 'think');
  const u3 = await window((await hub.tokens.mint('u3')).token);
  assert.equal((await u3.call('moovi_next', { ticket: await hub.gate.mintTicket('u3'), wait_s: 0.2 })).body.message, NOTHING_RUNNING, 'another user sees nothing of it');
  assert.equal((await u3.call('moovi_answer', { step: step.step, answer: EXAMPLE_DIRECTION })).body.ok, false, 'and cannot answer it');
  const edit2 = withModel(scopeFor('u2')!, () => directEdit({ words: words.map(x => ({ ...x, word: x.word.toUpperCase() })) }));
  const wait = (await b.call('moovi_next', { ticket: await hub.gate.mintTicket('u2'), wait_s: 2 })).body;
  assert.equal(wait.status, 'waiting', 'a second window waits for the video instead of stopping (bridge 21)'); assert.equal(wait.message, WAITING_OTHER_WINDOW);
  assert.equal((await b.call('moovi_answer', { step: step.step, answer: EXAMPLE_DIRECTION, lease: step.lease })).body.ok, false, 'the lease is per window');
  const r = await a.call('moovi_answer', { step: step.step, answer: EXAMPLE_DIRECTION });
  assert.equal(r.body.next.status, 'think', 'the holder gets the video\'s next step in the same call');
  await a.call('moovi_answer', { step: r.body.next.step, answer: EXAMPLE_DIRECTION, wait_s: 0 });
  assert.equal((await edit).source, 'brain'); assert.ok((await edit2).value);
  for (const w of [a, b, u3]) await w.client.close();
});

test('bridge 16: a waiting call sends progress every 10 s and returns by its deadline', async () => {
  const { token } = await hub.tokens.mint('u4');
  const w = await window(token);
  await brainRun({ type: 'start', user: 'u4', project: 'p4', run: 'job-u4', chat: 'c4' });
  const ticks: number[] = [];
  const t0 = Date.now();
  const r = await w.call('moovi_next', { ticket: await hub.gate.mintTicket('u4'), wait_s: 11.5 }, p => ticks.push(p.progress));
  assert.equal(r.body.status, 'working');
  assert.ok(Date.now() - t0 < 14_000);
  assert.equal(ticks.length, 1); assert.ok(ticks[0]! >= 10);
  await w.client.close();
});
