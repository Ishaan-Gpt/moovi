import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { BrainHub, bridgeHttp, buildMcp, KEEP_GOING, mcpHandler, NOTHING_RUNNING, runPrompt, STEP_RULE } from '../src/index';

// Vignesh, Oct 18: after /mcp__moovi__run, Claude Code asked a question and stopped. The run prompt and every result
// that is not an end must keep the window looping on moovi_next until done, failed or idle.
const hub = new BrainHub(undefined, { publicUrl: 'https://moovi.example' });
const unregister = hub.register({ server: null, bridge: { pollMs: 5 } });
const mcp = mcpHandler({ verify: t => hub.tokens.verify(t), build: ctx => buildMcp(hub, ctx) });
const http = bridgeHttp({ mcp });
await new Promise<void>(res => http.listen(0, '127.0.0.1', res));
const base = `http://127.0.0.1:${(http.address() as AddressInfo).port}`;
after(async () => { unregister(); await mcp.close(); await new Promise(res => http.close(res)); });

test('run loop: the prompt says never stop or ask while Moovi works, and to wait at least 2 minutes for a video', () => {
  const p = runPrompt('rt_1');
  assert.match(p, /Never end your turn and never stop to ask the user a question while Moovi is working/);
  assert.match(p, /Stop only at "done"/);
  assert.match(p, /at least 2 minutes/);
  assert.match(STEP_RULE, /never ask the user, never end your turn/);
});

test('run loop: a waiting window is told to call moovi_next again, and it can, over and over', async () => {
  const { token } = await hub.tokens.mint('loop-u1');
  const client = new Client({ name: 'claude-code-standin', version: '1' });
  await client.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`), { requestInit: { headers: { Authorization: `Bearer ${token}` } } }));
  const ticket = await hub.gate.mintTicket('loop-u1');
  for (let i = 0; i < 3; i++) {
    const r = await client.callTool({ name: 'moovi_next', arguments: { ticket, wait_s: 0.1 } });
    const body = JSON.parse((r.content as { text: string }[])[0]!.text) as Record<string, unknown>;
    assert.equal(body.status, 'waiting');
    assert.equal(body.next, KEEP_GOING);
    assert.equal(body.message, NOTHING_RUNNING);
    assert.ok(!r.isError);
  }
  await client.close();
});
