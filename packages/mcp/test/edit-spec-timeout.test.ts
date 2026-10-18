import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { z } from 'zod';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { withModel, type CompleteRequest, type ModelScope, type Runtime } from '@moovi/engine/runtime';
import { brainRun, scopeFor } from '@moovi/engine/keys';
import { DIRECT_SPEC_AGENT, directMasterySpec } from '../../engine/src/edit/mastery-direct';
import { BrainHub, BrainTimedOut, bridgeHttp, bridgeRuntime, brainScope, buildMcp, Gate, MAX_ANSWER_CHARS, mcpHandler, memoryStore, Presence, STEP_LIMIT_MS, StepQueue } from '../src/index';

/**
 * Claude 1, 2026-10-18 18:20 IST (server 4a26683): direct:edit-spec went to the background Claude Code, was picked up,
 * waited 300 s, was re-asked once, and only then fell back. Now the step's whole wait is 90 s, a no-answer is not
 * re-asked, and a refused answer is a tool error for Claude Code plus a `[bridge] submit rejected` log line.
 */
const W = (word: string, t: number, end: number) => ({ word, t, end });
const words = [W('This', 0.2, 0.4), W('chip', 0.45, 0.8), W('is', 0.85, 0.95), W('tiny.', 1.0, 1.4), W('It', 2.0, 2.1), W('has', 2.15, 2.3), W('19', 2.35, 2.6), W('billion', 2.65, 3.0), W('transistors.', 3.05, 3.8)];
const Spec = { beats: z.array(z.object({ from: z.unknown(), layers: z.array(z.object({ t: z.string() }).passthrough()) }).passthrough()) };
const specReq = (prompt = 'write the spec'): CompleteRequest => ({ agent: DIRECT_SPEC_AGENT, system: 'the recipe', prompt, schema: Spec, model: 'brain', deadlineMs: 90_000, skipLanes: ['key', 'server'] });

/** console.log lines while fn runs */
async function logsOf<T>(fn: () => Promise<T>): Promise<{ out: T | Error; lines: string[] }> {
  const lines: string[] = [], orig = console.log;
  console.log = (...a: unknown[]) => { lines.push(a.map(String).join(' ')); };
  try { return { out: await fn().catch(e => e as Error), lines }; } finally { console.log = orig; }
}

test('edit-spec: the whole wait is 90 s by default; any other brain step keeps the 2 min pickup and 5 min answer', () => {
  assert.equal(STEP_LIMIT_MS[DIRECT_SPEC_AGENT], 90_000);
  assert.equal(STEP_LIMIT_MS['direct:edit'], undefined);
});

test('edit-spec: picked up and never answered: expired at the limit, logged, BrainTimedOut, and no re-ask in the same job', async () => {
  const queue = new StepQueue(memoryStore()), lines: string[] = [];
  // answerMs 60 s: if the limit did not hold, this test would hang far past it
  const rt = bridgeRuntime({ queue, user: 'u1', job: () => 'job-1', pollMs: 5, answerMs: 60_000, pickupMs: 60_000, stepLimits: { [DIRECT_SPEC_AGENT]: 300 }, log: l => lines.push(l) });
  let picked: string | null = null, stop = false;
  const claude = (async () => { while (!stop) { const s = await queue.next('u1', 'sess-A'); if (s) picked = s.id; await new Promise(r => setTimeout(r, 5)); } })();
  const t0 = Date.now();
  const e1 = await rt.complete!(specReq()).catch(e => e as Error);
  const took = Date.now() - t0;
  assert.ok(e1 instanceof BrainTimedOut, String(e1));
  assert.match(e1.message, /picked the step up but did not answer within 0 s/);
  assert.ok(took >= 290 && took < 5_000, `fell back at the limit (${took} ms)`);
  assert.ok(picked, 'Claude Code had picked the step up');
  assert.equal((await queue.get(picked!))?.state, 'expired', 'the step is closed, a late answer cannot land');
  assert.ok(lines.some(l => l.startsWith('[bridge] no answer u1 job-1 direct:edit-spec') && l.includes('picked, never answered') && l.includes('no re-ask')), lines.join('\n'));

  // the engine's checker would re-ask with the problems as history: a different step; refused at once, nothing queued
  const before = picked;
  const t1 = Date.now();
  const e2 = await rt.complete!({ ...specReq(), history: [{ role: 'user', text: 'again' }] }).catch(e => e as Error);
  assert.ok(e2 instanceof BrainTimedOut, String(e2));
  assert.ok(Date.now() - t1 < 200, 'no second wait');
  await new Promise(r => setTimeout(r, 30));
  stop = true; await claude;
  assert.equal(picked, before, 'no second step reached Claude Code');
  assert.ok(lines.some(l => l.startsWith('[bridge] no re-ask u1 job-1 direct:edit-spec')), lines.join('\n'));

  // a new job asks again (the no re-ask rule is per job)
  const rt2 = bridgeRuntime({ queue, user: 'u1', job: () => 'job-2', pollMs: 5, stepLimits: { [DIRECT_SPEC_AGENT]: 100 }, log: l => lines.push(l) });
  const e3 = await rt2.complete!(specReq()).catch(e => e as Error);
  assert.ok(e3 instanceof BrainTimedOut && /did not answer within 0 s/.test(e3.message) && !/picked/.test(e3.message), String(e3));
});

test('edit-spec: through the lane switch the timeout falls straight back (no wait lane, no key), and the edit gets its default with one step asked', async () => {
  const keySaw: string[] = [];
  const key: Runtime = { name: 'key', vision: false, run: async () => { throw new Error('x'); }, complete: async (q: CompleteRequest) => { keySaw.push(q.agent); return '{"beats":[]}'; } };
  const store = memoryStore(), queue = new StepQueue(store), presence = new Presence(), gate = new Gate(store, queue, Date.now, u => presence.touch(u));
  presence.touch('u1');
  const lanes: string[] = [], lines: string[] = [];
  const own: ModelScope = { runtime: key, models: { director: 'd', crew: 'c', fast: 'f' }, provider: 'test', deadlineScale: 1, drawsWell: true };
  const scope = brainScope({ user: 'u1', queue, presence, job: () => 'job-lanes', own, server: null, byok: 'required', bridge: { pollMs: 5, stepLimits: { [DIRECT_SPEC_AGENT]: 300 }, log: l => lines.push(l) }, onLane: (agent, lane) => lanes.push(`${agent}>${lane}`) })!;
  const ticket = await gate.mintTicket('u1');
  let asked = 0, stop = false;
  // Claude Code takes the step and goes quiet (the live run)
  const claude = (async () => { while (!stop) { const p = await gate.pull('u1', 'sess-A', ticket); if ('step' in p && p.step.state === 'picked' && p.step.attempt === 1) asked++; presence.touch('u1'); await new Promise(r => setTimeout(r, 20)); } })();
  const t0 = Date.now();
  const out = await withModel(scope, () => directMasterySpec({ words, duration: 4, brief: 'Edit my video', waitMs: 60_000 }));
  const took = Date.now() - t0;
  stop = true; await claude;
  assert.equal(out.value, null, 'the edit moves on with its own default (the menu step runs next in the router)');
  assert.ok(took < 5_000, `no 300 s answer wait, no 10 min wait lane (${took} ms)`);
  assert.deepEqual(lanes, [`${DIRECT_SPEC_AGENT}>claude-code`], 'only Claude Code was tried for the full spec');
  assert.deepEqual(keySaw, [], 'the full tier never went to the key');
  assert.equal((await queue.picked('u1')).length, 0, 'nothing left open');
  assert.equal(lines.filter(l => l.startsWith('[bridge] no answer')).length, 1, lines.join('\n'));
  assert.ok(asked >= 1);
});

const hub = new BrainHub(undefined, { publicUrl: 'https://moovi.example' });
const unregister = hub.register({ server: null, bridge: { pollMs: 5 } });
const mcp = mcpHandler({ verify: t => hub.tokens.verify(t), build: ctx => buildMcp(hub, ctx) });
const http = bridgeHttp({ mcp });
await new Promise<void>(res => http.listen(0, '127.0.0.1', res));
const base = `http://127.0.0.1:${(http.address() as AddressInfo).port}`;
after(async () => { unregister(); await mcp.close(); await new Promise(res => http.close(res)); });

test('edit-spec: a refused answer is a tool error with the reason for Claude Code and a [bridge] submit rejected log line', async () => {
  const { token } = await hub.tokens.mint('u7');
  const client = new Client({ name: 'claude-code-standin', version: '1' });
  await client.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`), { requestInit: { headers: { Authorization: `Bearer ${token}` } } }));
  const call = async (name: string, args: Record<string, unknown>) => {
    const r = await client.callTool({ name, arguments: args }, undefined, { timeout: 60_000 });
    return { body: JSON.parse((r.content as { text: string }[])[0]!.text) as Record<string, any>, isError: !!r.isError };
  };
  const ticket = await hub.gate.mintTicket('u7');
  await call('moovi_next', { ticket, wait_s: 0 });
  await brainRun({ type: 'start', user: 'u7', project: 'p7', run: 'job-u7', chat: 'c7' });
  const scope = scopeFor('u7')!;
  const answer = withModel(scope, () => scope.runtime.complete!(specReq()));

  const step = (await call('moovi_next', { wait_s: 10 })).body;
  assert.equal(step.status, 'think'); assert.equal(step.agent, DIRECT_SPEC_AGENT);

  const bad = await logsOf(() => call('moovi_answer', { step: step.step, answer: { nope: 1 } }));
  assert.ok(!(bad.out instanceof Error), String(bad.out));
  const b = bad.out as Awaited<ReturnType<typeof call>>;
  assert.equal(b.isError, true); assert.equal(b.body.ok, false); assert.deepEqual(b.body.problems, ['missing "beats"']);
  assert.ok(bad.lines.some(l => l.startsWith('[bridge] submit rejected job-u7 missing "beats"') && l.includes(DIRECT_SPEC_AGENT)), bad.lines.join('\n'));

  // too long: once refused by the input schema before any log, now refused here with its size, and logged
  const long = await logsOf(() => call('moovi_answer', { step: step.step, answer: JSON.stringify({ beats: [], pad: 'x'.repeat(MAX_ANSWER_CHARS) }) }));
  const l = long.out as Awaited<ReturnType<typeof call>>;
  assert.equal(l.isError, true); assert.match(l.body.problems[0], /too long \(\d+ characters, at most 32000\)/);
  assert.ok(long.lines.some(x => x.startsWith('[bridge] submit rejected job-u7 the answer is too long')), long.lines.join('\n'));

  const notJson = await logsOf(() => call('moovi_answer', { step: step.step, answer: '```json\n{"beats":[]}\n```' }));
  assert.equal((notJson.out as Awaited<ReturnType<typeof call>>).isError, true);
  assert.ok(notJson.lines.some(x => x.startsWith('[bridge] submit rejected job-u7 the answer is not valid JSON')), notJson.lines.join('\n'));

  // the step stayed open through all of it; a good answer lands
  const good = await call('moovi_answer', { step: step.step, answer: { beats: [] }, wait_s: 0 });
  assert.equal(good.isError, false, JSON.stringify(good.body)); assert.equal(good.body.ok, true);
  assert.equal(await answer, '{"beats":[]}');

  // a late answer to a step Moovi stopped waiting for says so (and is logged), instead of a quiet nothing
  const s2 = await hub.queue.push({ agent: DIRECT_SPEC_AGENT, system: 's', prompt: 'p2', schema: null, user: 'u7', job: 'job-u7' });
  await hub.queue.cancel(s2.id, 'expired');
  const late = await logsOf(() => call('moovi_answer', { step: s2.id, answer: { beats: [] } }));
  const lt = late.out as Awaited<ReturnType<typeof call>>;
  assert.equal(lt.isError, true); assert.match(lt.body.problems[0], /expired/);
  assert.ok(late.lines.some(x => x.startsWith('[bridge] submit rejected job-u7') && x.includes('expired')), late.lines.join('\n'));
  await brainRun({ type: 'end', user: 'u7', project: 'p7', run: 'job-u7', chat: 'c7', ok: true });
  await client.close();
});
