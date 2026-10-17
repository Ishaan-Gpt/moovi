import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { BrainHub, bridgeHttp, buildMcp, IDLE_OTHER_WINDOW, LEASE_MS, mcpHandler, OTHER_WINDOW_WAIT_MS, WAITING_OTHER_WINDOW } from '../src/index';

// a second Claude Code window opened while another window holds the video (or held it and was closed without saying
// so) keeps waiting, takes the video over when that window's lease lapses, and stops only when the other window is
// really alive for longer than OTHER_WINDOW_WAIT_MS
let t = 5_000_000;
const hub = new BrainHub(undefined, { publicUrl: 'https://moovi.example', now: () => t });
const mcp = mcpHandler({ verify: tok => hub.tokens.verify(tok), build: ctx => buildMcp(hub, ctx) });
const http = bridgeHttp({ mcp });
await new Promise<void>(res => http.listen(0, '127.0.0.1', res));
const base = `http://127.0.0.1:${(http.address() as AddressInfo).port}`;
after(async () => { await mcp.close(); await new Promise(res => http.close(res)); });

async function window(token: string) {
  const client = new Client({ name: 'claude-code-standin', version: '1' });
  await client.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`), { requestInit: { headers: { Authorization: `Bearer ${token}` } } }));
  const call = async (name: string, args: Record<string, unknown>) => {
    const r = await client.callTool({ name, arguments: args }, undefined, { timeout: 60_000 });
    return JSON.parse((r.content as { type: string; text?: string }[])[0]!.text!) as Record<string, any>;
  };
  return { client, call };
}
const push = (user: string, job: string) => hub.queue.push({ user, job, agent: 'direct:edit', system: 's', prompt: `p-${job}-${Math.random()}`, schema: null });

test('bridge 21: a second window waits while another holds the video, then takes it over when that lease lapses', async () => {
  const { token } = await hub.tokens.mint('w1');
  const first = await push('w1', 'job-w1');
  // the first window (session X) picked the step and was then closed without a goodbye: its lease is still on
  const tx = await hub.gate.mintTicket('w1');
  const x = await hub.gate.pull('w1', 'X', tx); assert.ok('step' in x && x.step.id === first.id);
  const b = await window(token);
  const r1 = await b.call('moovi_next', { ticket: await hub.gate.mintTicket('w1'), wait_s: 0.3 });
  assert.equal(r1.status, 'waiting', JSON.stringify(r1)); assert.equal(r1.message, WAITING_OTHER_WINDOW);
  t += LEASE_MS - 5000;
  assert.equal((await b.call('moovi_next', { wait_s: 0.3 })).status, 'waiting', 'the first window\'s lease still holds');
  t += 10_000; // 2 min after the first window's last call: its lease lapses
  const r2 = await b.call('moovi_next', { wait_s: 2 });
  assert.equal(r2.status, 'think', JSON.stringify(r2)); assert.equal(r2.step, first.id, 'the open step is handed to the waiting window');
  const ok = await b.call('moovi_answer', { step: r2.step, answer: '{}', wait_s: 0 });
  assert.equal(ok.ok, true, JSON.stringify(ok));
  await b.client.close();
});

test('bridge 21: a second window stops once the other window has stayed alive for the whole wait', async () => {
  const { token } = await hub.tokens.mint('w2');
  await push('w2', 'job-w2');
  const tx = await hub.gate.mintTicket('w2');
  const x = await hub.gate.pull('w2', 'X2', tx); assert.ok('step' in x);
  const held = new Map([[x.step.job, x.lease]]);
  const b = await window(token);
  assert.equal((await b.call('moovi_next', { ticket: await hub.gate.mintTicket('w2'), wait_s: 0.2 })).status, 'waiting');
  let last: Record<string, any> = {};
  for (let waited = 0; waited < OTHER_WINDOW_WAIT_MS; waited += 60_000) {
    t += 60_000; await hub.gate.keepAlive('X2', held); // X2 is alive: it keeps calling
    last = await b.call('moovi_next', { wait_s: 0.2 });
    if (last.status === 'idle') break;
    assert.equal(last.status, 'waiting');
  }
  assert.equal(last.status, 'idle'); assert.equal(last.message, IDLE_OTHER_WINDOW);
  await b.client.close();
});
