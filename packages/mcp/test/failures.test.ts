import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { directEdit, directFilm, EXAMPLE_DIRECTION, EXAMPLE_FILM, EXAMPLE_SOURCE } from '@moovi/engine/brain';
import { BrainNotPickedUp, BrainWaiting, DEFAULT_NOTE, NoModelForAgent, withModel, type CompleteRequest } from '@moovi/engine/runtime';
import { brainRun, scopeFor } from '@moovi/engine/keys';
import {
  BrainHub, BrainTimedOut, brainApi, brainScope, bridgeHttp, bridgeRuntime, buildMcp, capOf, errorNotice, IDLE_OTHER_WINDOW, jobNotice, jobNotices, KEY, LEASE_MS,
  MEMO_TTL_MS, mcpHandler, memoryStore, NOTICE, ONLINE_MS, runPrompt, STEP_RULE, stepView, USAGE_HINT_MS,
} from '../src/index';

/**
 * Bridge item 23: every failure case of plan section 17, plus the three the brain-only plan adds (an answer over its
 * token cap, numbers the source never said, the bridge process down). Each test drives the real queue, gate, checker
 * or endpoint into the failure and checks the plain sentence the user sees (notices.ts, the plan's own words).
 */
const W = (word: string, t: number, end: number) => ({ word, t, end });
const words = [W('This', 0.2, 0.4), W('chip', 0.45, 0.8), W('is', 0.85, 0.95), W('tiny.', 1.0, 1.4), W('It', 2.0, 2.1), W('has', 2.15, 2.3), W('19', 2.35, 2.6), W('billion', 2.65, 3.0), W('transistors.', 3.05, 3.8),
  W('Each', 4.5, 4.7), W('one', 4.75, 4.9), W('switches', 4.95, 5.4), W('fast.', 5.45, 5.9), W('Follow', 6.5, 6.8), W('for', 6.85, 6.95), W('more.', 7.0, 7.5)];
const good = JSON.stringify({ ...EXAMPLE_DIRECTION, model: 'claude-test' });
const tick = (ms = 5) => new Promise(res => setTimeout(res, ms));

/** fake clock rig: one hub (queue, gate, presence, board) on one store */
function rig(store = memoryStore(() => clockT.t)) {
  const now = () => clockT.t;
  const hub = new BrainHub(store, { now });
  const scope = (job = 'job-1') => brainScope({ user: 'u1', queue: hub.queue, presence: hub.presence, job: () => job, own: null, server: null, byok: 'required', bridge: { pollMs: 5, now } });
  const queued = async (n = 1) => { for (let i = 0; i < 400; i++) { if ((await store.range(KEY.queue('u1'))).length >= n) return; await tick(); } throw new Error('no step queued'); };
  const notices = () => jobNotices(hub, 'u1', true, hub.presence.state('u1'), false);
  return { hub, store, scope, queued, notices };
}
const clockT = { t: 1_800_000_000_000 };

/** a stand-in window: pulls each step with its own ticket and answers with the next of `answers`; records each step */
async function standIn(hub: BrainHub, session: string, answers: string[]) {
  const t = await hub.gate.mintTicket('u1'); const steps: { history: string; maxOut?: number }[] = [];
  let stop = false;
  const loop = (async () => { while (!stop) {
    const p = await hub.gate.pull('u1', session, t);
    if ('step' in p) {
      steps.push({ history: (p.step.history ?? []).map(h => h.text).join('\n'), ...(p.step.maxOut ? { maxOut: p.step.maxOut } : {}) });
      await hub.gate.submit('u1', session, p.lease, p.step.id, answers[Math.min(steps.length - 1, answers.length - 1)]!);
    }
    await tick();
  } })();
  return { steps, stop: async () => { stop = true; await loop; } };
}

// one real endpoint for the cases Claude Code sees over HTTP
const live = new BrainHub(undefined, { publicUrl: 'https://moovi.example' });
const unregister = live.register({ server: null, bridge: { pollMs: 5 } });
const mcp = mcpHandler({ verify: t => live.tokens.verify(t), build: ctx => buildMcp(live, ctx) });
const http = bridgeHttp({ mcp });
await new Promise<void>(res => http.listen(0, '127.0.0.1', res));
const base = `http://127.0.0.1:${(http.address() as AddressInfo).port}`;
after(async () => { unregister(); await mcp.close(); await new Promise(res => http.close(res)); });
async function window(token: string) {
  const client = new Client({ name: 'claude-code-standin', version: '1' });
  await client.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`), { requestInit: { headers: { Authorization: `Bearer ${token}` } } }));
  const call = async (name: string, args: Record<string, unknown>) => {
    const r = await client.callTool({ name, arguments: args }, undefined, { timeout: 60_000 });
    return { body: JSON.parse((r.content as { text: string }[])[0]!.text) as Record<string, any>, isError: !!r.isError };
  };
  return { client, call };
}

test('failure 1: Claude Code closed mid job: the row says Waiting with /mcp__moovi__run; a new /mcp__moovi__run picks the same step up', async () => {
  const r = rig(); r.hub.presence.touch('u1');
  await r.hub.board.start({ user: 'u1', job: 'job-1' });
  const job = withModel(r.scope()!, () => directEdit({ words }));
  await r.queued();
  const tA = await r.hub.gate.mintTicket('u1');
  const a = await r.hub.gate.pull('u1', 'win-A', tA); assert.ok('step' in a);
  await r.hub.gate.release('win-A', new Map([[a.step.job, a.lease]])); // the window closes (server.ts onclose)
  clockT.t += ONLINE_MS + 1000;
  const [n] = await r.notices();
  assert.deepEqual({ pill: n!.pill, row: n!.row, copy: n!.copy }, { pill: 'Claude Code offline', row: 'Waiting for Claude Code', copy: '/mcp__moovi__run' });
  const b = await r.hub.gate.pull('u1', 'win-B', await r.hub.gate.mintTicket('u1'));
  assert.ok('step' in b); assert.equal(b.step.id, a.step.id, 'the same step, not a new question');
  assert.deepEqual(await r.hub.gate.submit('u1', 'win-B', b.lease, b.step.id, good), { ok: true });
  assert.equal((await job).source, 'brain');
});

test('failure 2: token removed: Claude Code gets the plain 401, Settings says Not connected', async () => {
  const { token } = await live.tokens.mint('u-rev');
  const w = await window(token);
  assert.equal((await w.call('moovi_status', {})).body.connected, true);
  await live.tokens.revoke('u-rev');
  await assert.rejects(() => w.client.listTools(), (e: Error) => e.message.includes(NOTICE.tokenRemoved));
  assert.equal(NOTICE.tokenRemoved, 'This Moovi connection was removed. Copy a new one from Moovi Settings.');
  const api = brainApi({ hub: live, userOf: async () => 'u-rev' });
  const s = await (await api.status(new Request('http://x/api/brain/status'))).json() as { linked: boolean; notice: string };
  assert.deepEqual({ linked: s.linked, notice: s.notice }, { linked: false, notice: 'Not connected' });
  await w.client.close().catch(() => undefined);
});

test('failure 3: the long poll drops: the picked step is handed out again, a repeat answer is ignored, nothing on the site', async () => {
  const r = rig(); r.hub.presence.touch('u1');
  const job = withModel(r.scope()!, () => directEdit({ words }));
  await r.queued();
  const a = await r.hub.gate.pull('u1', 'win-A', await r.hub.gate.mintTicket('u1')); assert.ok('step' in a);
  clockT.t += LEASE_MS; // A's network blipped: no call for 2 min
  const b = await r.hub.gate.pull('u1', 'win-B', await r.hub.gate.mintTicket('u1'));
  assert.ok('step' in b); assert.equal(b.step.id, a.step.id, 'leased, not consumed');
  assert.deepEqual(await r.hub.gate.submit('u1', 'win-B', b.lease, b.step.id, good), { ok: true });
  assert.deepEqual(await r.hub.gate.submit('u1', 'win-B', b.lease, b.step.id, good), { ok: true }, 'idempotent');
  assert.equal((await job).source, 'brain');
});

test('failure 4: bad or partial JSON: refused at once with the problem; twice bad, the row says Used Moovi\'s default', async () => {
  const { token } = await live.tokens.mint('u-json');
  const w = await window(token);
  await w.call('moovi_next', { ticket: await live.gate.mintTicket('u-json'), wait_s: 0 });
  await brainRun({ type: 'start', user: 'u-json', project: 'p', run: 'job-json', chat: 'c' });
  const edit = withModel(scopeFor('u-json')!, () => directEdit({ words }));
  const step = (await w.call('moovi_next', { wait_s: 10 })).body;
  const partial = await w.call('moovi_answer', { step: step.step, answer: '{"style":"atlas",' });
  assert.deepEqual([partial.isError, partial.body.problems], [true, ['the answer is not valid JSON']]);
  await w.call('moovi_answer', { step: step.step, answer: { ...EXAMPLE_DIRECTION, model: 'claude-test' }, wait_s: 0 });
  assert.equal((await edit).source, 'brain', 'fixed in the same turn');
  await brainRun({ type: 'end', user: 'u-json', project: 'p', run: 'job-json', chat: 'c', ok: true });
  await w.client.close();

  // past the door, still wrong twice (prose that is valid JSON text but not the answer): the engine's one re-ask, then the default
  const r = rig(); r.hub.presence.touch('u1');
  const win = await standIn(r.hub, 'win-A', ['"I think atlas looks nice"', '{"style":"atlas"}']);
  const out = await withModel(r.scope()!, () => directEdit({ words }));
  await win.stop();
  assert.equal(out.source, 'default'); assert.equal(out.note, DEFAULT_NOTE); assert.equal(win.steps.length, 2, 'one re-ask, not more');
  assert.equal(jobNotice({ linked: true, claudeCode: 'online', hasKey: false, step: null, ahead: 0, job: 'done', usedDefault: true }).row, 'Used Moovi\'s default for this step');
  assert.equal(errorNotice(new NoModelForAgent('direct:film', 'no lane'))!.row, NOTICE.tryAgain, 'a stage with no default says Try again');
});

test('failure 5: /mcp__moovi__run in a second window: told another window has the video', async () => {
  const r = rig(); r.hub.presence.touch('u1');
  const job = withModel(r.scope()!, () => directEdit({ words }));
  await r.queued();
  const a = await r.hub.gate.pull('u1', 'win-A', await r.hub.gate.mintTicket('u1')); assert.ok('step' in a);
  assert.deepEqual(await r.hub.gate.pull('u1', 'win-B', await r.hub.gate.mintTicket('u1')), { idle: IDLE_OTHER_WINDOW });
  assert.equal(IDLE_OTHER_WINDOW, 'Another Claude Code window is already working on this video. You can close this one.');
  assert.equal((await r.hub.gate.submit('u1', 'win-B', 'ls_x', a.step.id, good)).ok, false, 'a non-owner answer is refused');
  await r.hub.gate.submit('u1', 'win-A', a.lease, a.step.id, good);
  await job;
});

test('failure 6: two browser tabs: both read the same state from the server', async () => {
  const r = rig(); r.hub.presence.touch('u1');
  await r.hub.board.start({ user: 'u1', job: 'job-1' });
  const job = withModel(r.scope()!, () => directEdit({ words }));
  await r.queued();
  const api = brainApi({ hub: r.hub, userOf: async () => 'u1' });
  const [t1, t2] = await Promise.all([1, 2].map(async () => (await api.status(new Request('http://x/api/brain/status'))).json()));
  assert.deepEqual(t1, t2);
  const a = await r.hub.gate.pull('u1', 'win-A', await r.hub.gate.mintTicket('u1')); assert.ok('step' in a);
  await r.hub.gate.submit('u1', 'win-A', a.lease, a.step.id, good); await job;
});

test('failure 7: a second video while one runs: Queued, Claude Code will take it next; one /mcp__moovi__run takes both in order', async () => {
  const r = rig(); r.hub.presence.touch('u1');
  await r.hub.board.start({ user: 'u1', job: 'job-1' }); clockT.t += 1;
  await r.hub.board.start({ user: 'u1', job: 'job-2' });
  const one = withModel(r.scope('job-1')!, () => directEdit({ words }));
  await r.queued(1);
  const two = withModel(r.scope('job-2')!, () => directEdit({ words: words.map(x => ({ ...x, word: x.word.toUpperCase() })) }));
  await r.queued(2);
  const rows = (await r.notices()).map(n => [n.job, n.row]);
  assert.deepEqual(rows[1], ['job-2', 'Queued, Claude Code will take it next']);
  const t = await r.hub.gate.mintTicket('u1'), order: string[] = [];
  for (let i = 0; i < 2; i++) { const p = await r.hub.gate.pull('u1', 'win-A', t); assert.ok('step' in p); order.push(p.step.job); await r.hub.gate.submit('u1', 'win-A', p.lease, p.step.id, good); }
  assert.deepEqual(order, ['job-1', 'job-2']);
  await Promise.all([one, two]);
});

test('failure 8: a job takes too long: no pickup or no answer parks it with Waiting; parked answers keep 24 h, then Expired', async () => {
  const r = rig();
  const req: CompleteRequest = { agent: 'direct:edit', system: 's', prompt: 'p', model: 'brain', deadlineMs: 1 };
  const br = bridgeRuntime({ queue: r.hub.queue, user: 'u1', job: () => 'job-1', pickupMs: 1000, answerMs: 2000, pollMs: 5, now: () => clockT.t });
  const unpicked = br.complete!(req); await r.queued(); clockT.t += 1000;
  const e1 = await unpicked.catch(e => e); assert.ok(e1 instanceof BrainNotPickedUp);
  assert.deepEqual(errorNotice(e1), { pill: 'Claude Code offline', row: 'Waiting for Claude Code', hint: null, copy: '/mcp__moovi__run' });
  assert.equal(errorNotice(new BrainWaiting('direct:edit'))!.row, NOTICE.waiting, 'the wait lane parks with the same words');
  const unanswered = br.complete!({ ...req, prompt: 'p2' }); await r.queued();
  assert.ok('step' in (await r.hub.gate.pull('u1', 'win-A', await r.hub.gate.mintTicket('u1'))));
  clockT.t += 2000;
  const e2 = await unanswered.catch(e => e); assert.ok(e2 instanceof BrainTimedOut);
  assert.equal(errorNotice(e2)!.row, NOTICE.waiting); assert.equal(errorNotice(e2)!.copy, NOTICE.run);
  // saved answers last 24 h (the upload and the answers are kept until then), then the video says Expired
  await r.hub.queue.remember('u1', 'fp1', good);
  clockT.t += MEMO_TTL_MS - 1000; assert.equal(await r.hub.queue.recall('u1', 'fp1'), good);
  clockT.t += 2000; assert.equal(await r.hub.queue.recall('u1', 'fp1'), null);
  assert.equal(jobNotice({ linked: true, claudeCode: 'off', hasKey: false, step: null, ahead: 0, job: 'expired' }).row, 'Expired, start again');
});

test('failure 9: Claude Code at its usage limit: after 2 min of waiting (no key) the panel adds the usage line', async () => {
  const r = rig(); r.hub.presence.touch('u1');
  await r.hub.board.start({ user: 'u1', job: 'job-1' });
  const job = withModel(r.scope()!, () => directEdit({ words }));
  await r.queued();
  clockT.t += USAGE_HINT_MS - 1000;
  assert.equal((await r.notices())[0]!.hint, null, 'at 1:59 nothing extra');
  clockT.t += 1000;
  assert.equal((await r.notices())[0]!.hint, 'Your Claude Code may have reached its usage limit. It resets at the time Claude Code shows, or add an API key to keep going.');
  assert.equal((await jobNotices(r.hub, 'u1', true, 'linked', true))[0]!.hint, null, 'with a key the step falls to it (item 24), no usage line');
  const a = await r.hub.gate.pull('u1', 'win-A', await r.hub.gate.mintTicket('u1')); assert.ok('step' in a);
  await r.hub.gate.submit('u1', 'win-A', a.lease, a.step.id, good); assert.equal((await job).source, 'brain', 'nothing lost');
});

test('failure 10: Claude starts editing files: every step and the run prompt say no files or commands are needed', () => {
  const view = stepView({ id: 'st_1', user: 'u1', job: 'j', agent: 'direct:edit', system: 's', prompt: 'p', schema: null, fp: 'f', attempt: 1, state: 'picked', createdAt: 0, pickedAt: 0, answeredAt: null, pickedBy: 's', answer: null } as never, 'ls_1');
  const body = JSON.parse((view.content[0] as { text: string }).text) as { rule: string };
  assert.equal(body.rule, STEP_RULE); assert.match(STEP_RULE, /No files or commands are needed/);
  assert.match(runPrompt('rt_1'), /Do not read or write files or run commands/);
});

test('failure 11: the Moovi server restarts mid job: the queue and memo live in the store; answered steps replay', async () => {
  const store = memoryStore(() => clockT.t);
  const r1 = rig(store); r1.hub.presence.touch('u1');
  const win = await standIn(r1.hub, 'win-A', [good]);
  assert.equal((await withModel(r1.scope()!, () => directEdit({ words }))).source, 'brain');
  await win.stop();
  const r2 = rig(store); r2.hub.presence.touch('u1'); // a new process on the same store
  const again = await withModel(r2.scope()!, () => directEdit({ words }));
  assert.equal(again.source, 'brain'); assert.equal(again.value!.model, 'claude-test');
  assert.deepEqual(await store.range(KEY.queue('u1')), [], 'replayed from the memo: Claude Code is asked nothing');
});

test('failure 12: the bridge process is down: the job keeps waiting with /mcp__moovi__run; a restarted bridge hands out the same step', async () => {
  const store = memoryStore(() => clockT.t);
  const r = rig(store); r.hub.presence.touch('u1');
  await r.hub.board.start({ user: 'u1', job: 'job-1' });
  const job = withModel(r.scope()!, () => directEdit({ words }));
  await r.queued();
  const down = bridgeHttp({ mcp: mcpHandler({ verify: async () => null, build: () => { throw new Error('unused'); } }) });
  await new Promise<void>(res => down.listen(0, '127.0.0.1', res));
  const url = `http://127.0.0.1:${(down.address() as AddressInfo).port}/mcp`;
  await new Promise(res => down.close(res));
  await assert.rejects(() => fetch(url, { method: 'POST' }), 'Claude Code cannot reach it (its own "failed to connect")');
  clockT.t += ONLINE_MS + 1000; // no window can call in
  const [n] = await r.notices();
  assert.deepEqual([n!.pill, n!.row, n!.copy], ['Claude Code offline', 'Waiting for Claude Code', '/mcp__moovi__run']);
  const back = new BrainHub(store, { now: () => clockT.t }); // the bridge comes back up
  const p = await back.gate.pull('u1', 'win-A', await back.gate.mintTicket('u1')); assert.ok('step' in p);
  await back.gate.submit('u1', 'win-A', p.lease, p.step.id, good);
  assert.equal((await job).source, 'brain');
});

test('failure 13: an over-budget answer is refused at the door with the step left open', async () => {
  assert.equal(capOf('direct:edit'), 1200); assert.equal(capOf('direct:look'), 300); assert.equal(capOf('edit:beats'), undefined);
  const { token } = await live.tokens.mint('u-big');
  const w = await window(token);
  await w.call('moovi_next', { ticket: await live.gate.mintTicket('u-big'), wait_s: 0 });
  await brainRun({ type: 'start', user: 'u-big', project: 'p', run: 'job-big', chat: 'c' });
  const edit = withModel(scopeFor('u-big')!, () => directEdit({ words }));
  const step = (await w.call('moovi_next', { wait_s: 10 })).body;
  assert.equal(step.max_answer_tokens, 1200, 'Claude Code sees the cap');
  const big = await w.call('moovi_answer', { step: step.step, answer: { ...EXAMPLE_DIRECTION, model: 'claude-test', why: 'very long reasoning '.repeat(400) } });
  assert.equal(big.isError, true); assert.match(big.body.problems[0], /^the answer is about \d+ tokens; this step allows 1200/);
  assert.equal((await live.queue.get(step.step))!.state, 'picked', 'still open');
  await w.call('moovi_answer', { step: step.step, answer: { ...EXAMPLE_DIRECTION, model: 'claude-test' }, wait_s: 0 });
  assert.equal((await edit).source, 'brain');
  await brainRun({ type: 'end', user: 'u-big', project: 'p', run: 'job-big', chat: 'c', ok: true });
  await w.client.close();
});

test('failure 14: numbers not in the source: one re-ask naming them, then Moovi\'s default', async () => {
  const ctx = { styles: ['launch' as const], sourceText: EXAMPLE_SOURCE, launchArc: 'launch-pain-turn', brief: 'a launch film for Linear', title: 'Linear' };
  const invented = JSON.stringify({ ...EXAMPLE_FILM, number: '40 hours saved' });
  const r = rig(); r.hub.presence.touch('u1');
  const win = await standIn(r.hub, 'win-A', [invented, invented]);
  const out = await withModel(r.scope()!, () => directFilm(ctx));
  await win.stop();
  assert.equal(win.steps.length, 2);
  assert.match(win.steps[1]!.history, /the numbers 40 are not in the source: use only numbers it says/);
  assert.equal(out.source, 'default'); assert.equal(out.note, DEFAULT_NOTE);
});
