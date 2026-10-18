import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { brainRun } from '@moovi/engine/keys';
import { BrainHub, bridgeHttp, buildMcp, JobBoard, mcpHandler, memoryStore, STOPPED } from '../src/index';

/**
 * Local e2e, Oct 18: the user pressed Stop on an Edit. The engine's stop command cancels the run but never reports an
 * end to the bridge, so the job board kept it "running" for 24 h and every later video of that user read "working"
 * to Claude Code even after it was done (moovi_next never said done). The board now settles a running row from the
 * engine's own Run.status (serve.ts reads the graph).
 */
test('stopped run: the board settles a running row from the engine\'s run status', async () => {
  const status = new Map<string, string>([['j1', 'running'], ['j2', 'running']]);
  const board = new JobBoard(memoryStore(), Date.now, () => null, async (_p, run) => status.get(run) ?? null);
  await board.start({ user: 'u', job: 'j1', project: 'p1', chat: 'c1' });
  await board.start({ user: 'u', job: 'j2', project: 'p1', chat: 'c2' });
  assert.deepEqual((await board.running('u')).map(j => j.job), ['j1', 'j2']);
  status.set('j1', 'cancelled');
  assert.deepEqual((await board.running('u')).map(j => j.job), ['j2'], 'the stopped run no longer counts as running');
  const j1 = await board.get('j1');
  assert.equal(j1!.state, 'failed'); assert.equal(j1!.error, STOPPED);
  status.set('j2', 'done');
  assert.deepEqual(await board.running('u'), []);
  assert.equal((await board.get('j2'))!.state, 'done');
});

test('stopped run: without a status reader, or when it cannot answer, the row stands as before', async () => {
  const plain = new JobBoard(memoryStore());
  await plain.start({ user: 'u', job: 'j', project: 'p', chat: 'c' });
  assert.equal((await plain.running('u')).length, 1);
  const broken = new JobBoard(memoryStore(), Date.now, () => null, async () => { throw new Error('graph down'); });
  await broken.start({ user: 'u', job: 'j', project: 'p', chat: 'c' });
  assert.equal((await broken.running('u')).length, 1, 'a failing reader never ends a job');
  const noProject = new JobBoard(memoryStore(), Date.now, () => null, async () => 'cancelled');
  await noProject.start({ user: 'u', job: 'j' });
  assert.equal((await noProject.running('u')).length, 1, 'a row with no project is not looked up');
});

const status = new Map<string, string>();
const hub = new BrainHub(undefined, { publicUrl: 'https://moovi.example', runStatus: async (_p, run) => status.get(run) ?? null });
const unregister = hub.register({ server: null, bridge: { pollMs: 5 } });
const mcp = mcpHandler({ verify: t => hub.tokens.verify(t), build: ctx => buildMcp(hub, ctx) });
const http = bridgeHttp({ mcp });
await new Promise<void>(res => http.listen(0, '127.0.0.1', res));
const base = `http://127.0.0.1:${(http.address() as AddressInfo).port}`;
after(async () => { unregister(); await mcp.close(); await new Promise(res => http.close(res)); });

test('stopped run: after a Stop, the next video still ends with done for Claude Code', async () => {
  const { token } = await hub.tokens.mint('u-stop');
  const client = new Client({ name: 'claude-code-standin', version: '1' });
  await client.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`), { requestInit: { headers: { Authorization: `Bearer ${token}` } } }));
  const next = async (args: Record<string, unknown>) => JSON.parse(((await client.callTool({ name: 'moovi_next', arguments: args })).content as { text: string }[])[0]!.text) as Record<string, any>;
  const ticket = await hub.gate.mintTicket('u-stop');
  // the first video is stopped on the website: the run is cancelled in the graph, no end reaches the bridge
  status.set('job-stopped', 'running');
  await brainRun({ type: 'start', user: 'u-stop', project: 'p1', run: 'job-stopped', chat: 'c1' });
  assert.equal((await next({ ticket, wait_s: 0.2 })).status, 'working');
  status.set('job-stopped', 'cancelled');
  const stopped = await next({ wait_s: 0.2 });
  assert.equal(stopped.status, 'failed'); assert.equal(stopped.reason, STOPPED);
  // the second video runs and finishes: Claude Code hears done, not "working" until its 15 minutes run out
  const t2 = await hub.gate.mintTicket('u-stop');
  status.set('job-2', 'running');
  await brainRun({ type: 'start', user: 'u-stop', project: 'p1', run: 'job-2', chat: 'c2' });
  assert.equal((await next({ ticket: t2, wait_s: 0.2 })).status, 'working');
  status.set('job-2', 'done');
  await brainRun({ type: 'end', user: 'u-stop', project: 'p1', run: 'job-2', chat: 'c2', ok: true });
  const done = await next({ wait_s: 0.2 });
  assert.equal(done.status, 'done', JSON.stringify(done));
  await client.close();
});
