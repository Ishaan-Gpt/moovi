import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { brainRun } from '@moovi/engine/keys';
import { BrainHub, bridgeHttp, buildMcp, failedMessage, JobBoard, mcpHandler, memoryStore } from '../src/index';

/**
 * Live test, Oct 17: an edit failed on a fresh FalkorDB and Claude Code only said "the website says why". A failed job
 * now carries its short reason (the same words the studio chat shows) to moovi_next, so Claude Code can say it too.
 */
const REASON = 'edit your clip failed ([craft] assetOrigins failed: ERR Invalid graph operation on empty key)';

test('failure reason: the board keeps a failed job\'s reason and a done job has none', async () => {
  const board = new JobBoard(memoryStore());
  await board.start({ user: 'u', job: 'j1' });
  assert.equal((await board.finish({ job: 'j1', ok: false, error: `  ${REASON}  ` }))!.error, REASON);
  await board.start({ user: 'u', job: 'j2' });
  assert.equal((await board.finish({ job: 'j2', ok: true, error: 'ignored' }))!.error, null);
  await board.start({ user: 'u', job: 'j3' });
  assert.equal((await board.finish({ job: 'j3', ok: false }))!.error, null, 'no reason given: none invented');
  await board.start({ user: 'u', job: 'j4' });
  assert.equal((await board.finish({ job: 'j4', ok: false, error: 'x'.repeat(900) }))!.error!.length, 300, 'kept short');
});

test('failure reason: the message names the reason when there is one, else points at the website', () => {
  assert.match(failedMessage(REASON), /could not finish this video: edit your clip failed \(\[craft\] assetOrigins/);
  assert.match(failedMessage(REASON), /Tell the user this reason/);
  assert.equal(failedMessage(null), 'Moovi could not finish this video; the website says why. Tell the user and stop.');
});

const hub = new BrainHub(undefined, { publicUrl: 'https://moovi.example' });
const unregister = hub.register({ server: null, bridge: { pollMs: 5 } });
const mcp = mcpHandler({ verify: t => hub.tokens.verify(t), build: ctx => buildMcp(hub, ctx) });
const http = bridgeHttp({ mcp });
await new Promise<void>(res => http.listen(0, '127.0.0.1', res));
const base = `http://127.0.0.1:${(http.address() as AddressInfo).port}`;
after(async () => { unregister(); await mcp.close(); await new Promise(res => http.close(res)); });

test('failure reason: the worker\'s reason reaches Claude Code through moovi_next', async () => {
  const { token } = await hub.tokens.mint('u-fail');
  const client = new Client({ name: 'claude-code-standin', version: '1' });
  await client.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`), { requestInit: { headers: { Authorization: `Bearer ${token}` } } }));
  const next = async (args: Record<string, unknown>) => JSON.parse(((await client.callTool({ name: 'moovi_next', arguments: args })).content as { text: string }[])[0]!.text) as Record<string, any>;
  const ticket = await hub.gate.mintTicket('u-fail');
  await brainRun({ type: 'start', user: 'u-fail', project: 'p1', run: 'job-fail', chat: 'c1' });
  assert.equal((await next({ ticket, wait_s: 0.2 })).status, 'working');
  await brainRun({ type: 'end', user: 'u-fail', project: 'p1', run: 'job-fail', chat: 'c1', ok: false, error: REASON });
  const out = await next({ wait_s: 0.2 });
  assert.equal(out.status, 'failed');
  assert.equal(out.reason, REASON);
  assert.equal(out.url, 'https://moovi.example/studio/p/p1/c/c1');
  assert.match(out.message, /assetOrigins failed: ERR Invalid graph operation on empty key/);
  await client.close();
});
