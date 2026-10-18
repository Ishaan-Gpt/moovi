import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { brainRun } from '@moovi/engine/keys';
import { BrainHub, bridgeHttp, buildMcp, mcpHandler } from '../src/index';

/**
 * Local Showreel e2e, Oct 18: the run failed 0.4 s after the brief (its writer had no model), between two looks of the
 * window, so it was never seen running and Claude Code read "No Moovi video is running yet" until it gave up, without
 * telling the user the video failed. A video that starts and ends between two looks now ends the wait the same way.
 */
const hub = new BrainHub(undefined, { publicUrl: 'https://moovi.example' });
const unregister = hub.register({ server: null, bridge: { pollMs: 5 } });
const mcp = mcpHandler({ verify: t => hub.tokens.verify(t), build: ctx => buildMcp(hub, ctx) });
const http = bridgeHttp({ mcp });
await new Promise<void>(res => http.listen(0, '127.0.0.1', res));
const base = `http://127.0.0.1:${(http.address() as AddressInfo).port}`;
after(async () => { unregister(); await mcp.close(); await new Promise(res => http.close(res)); });

async function window(user: string) {
  const { token } = await hub.tokens.mint(user);
  const client = new Client({ name: 'claude-code-standin', version: '1' });
  await client.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`), { requestInit: { headers: { Authorization: `Bearer ${token}` } } }));
  return async (args: Record<string, unknown>) => JSON.parse(((await client.callTool({ name: 'moovi_next', arguments: args })).content as { text: string }[])[0]!.text) as Record<string, any>;
}

test('quick run: a video that fails between two looks ends the wait with failed and its reason, once', async () => {
  const next = await window('u-quick');
  const ticket = await hub.gate.mintTicket('u-quick');
  assert.equal((await next({ ticket, wait_s: 0.2 })).status, 'waiting');
  await brainRun({ type: 'start', user: 'u-quick', project: 'p1', run: 'job-fast', chat: 'c1' });
  await brainRun({ type: 'end', user: 'u-quick', project: 'p1', run: 'job-fast', chat: 'c1', ok: false, error: 'make the film failed (no model for detail work)' });
  const r = await next({ wait_s: 0.2 });
  assert.equal(r.status, 'failed');
  assert.match(String(r.reason), /no model for detail work/);
  assert.equal((await next({ wait_s: 0.2 })).status, 'waiting', 'the same video is not reported twice');
  // and a quick one that succeeds says done
  await brainRun({ type: 'start', user: 'u-quick', project: 'p1', run: 'job-fast-2', chat: 'c2' });
  await brainRun({ type: 'end', user: 'u-quick', project: 'p1', run: 'job-fast-2', chat: 'c2', ok: true });
  assert.equal((await next({ wait_s: 0.2 })).status, 'done');
});

test('quick run: a video that ended before this window started looking is not reported as this window\'s', async () => {
  await brainRun({ type: 'start', user: 'u-old', project: 'p1', run: 'job-old', chat: 'c1' });
  await brainRun({ type: 'end', user: 'u-old', project: 'p1', run: 'job-old', chat: 'c1', ok: false, error: 'old failure' });
  await new Promise(res => setTimeout(res, 5));
  const next = await window('u-old');
  const ticket = await hub.gate.mintTicket('u-old');
  assert.equal((await next({ ticket, wait_s: 0.2 })).status, 'waiting');
});
