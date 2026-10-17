import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { BrainHub, bridgeHttp, buildMcp, longPoll, mcpHandler, UNAUTHORIZED } from '../src/index';

const TOKENS: Record<string, { user: string; tokenId: string }> = { 'tok-u1': { user: 'u1', tokenId: 't1' }, 'tok-u2': { user: 'u2', tokenId: 't2' } };
const hub = new BrainHub();
const mcp = mcpHandler({ verify: async t => TOKENS[t] ?? null, build: ctx => buildMcp(hub, ctx) });
const http = bridgeHttp({ mcp });
await new Promise<void>(res => http.listen(0, '127.0.0.1', res));
const base = `http://127.0.0.1:${(http.address() as AddressInfo).port}`;
after(async () => { await mcp.close(); await new Promise(res => http.close(res)); });

async function connect(token: string) {
  const client = new Client({ name: 'test', version: '1' });
  const transport = new StreamableHTTPClientTransport(new URL(`${base}/mcp`), { requestInit: { headers: { Authorization: `Bearer ${token}` } } });
  await client.connect(transport);
  return { client, transport };
}
const post = (headers: Record<string, string>, body: unknown) => fetch(`${base}/mcp`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', ...headers }, body: JSON.stringify(body) });
const init = { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'curl', version: '1' } } };

test('bridge 14: no token or a wrong token is a 401 with a plain message', async () => {
  for (const h of [{}, { authorization: 'Bearer nope' }, { authorization: 'Basic tok-u1' }] as Record<string, string>[]) {
    const r = await post(h, init);
    assert.equal(r.status, 401);
    assert.match(r.headers.get('www-authenticate') ?? '', /Bearer/);
    assert.equal((await r.json()).error.message, UNAUTHORIZED);
  }
});

test('bridge 14: a real MCP client connects over streamable HTTP with its bearer token', async () => {
  const { client, transport } = await connect('tok-u1');
  assert.ok(transport.sessionId, 'the server hands out a session id');
  const tools = await client.listTools();
  assert.ok(tools.tools.some(t => t.name === 'moovi_status'));
  const r = await client.callTool({ name: 'moovi_status', arguments: {} });
  assert.deepEqual(JSON.parse((r.content as { text: string }[])[0]!.text), { connected: true, claude_code: 'off' });
  assert.equal(mcp.sessionsOf('u1').length, 1);
  await transport.terminateSession(); await client.close();
  assert.equal(mcp.sessionsOf('u1').length, 0);
});

test('bridge 14: a session belongs to its user; unknown sessions are 404, no session must start with initialize', async () => {
  const { client, transport } = await connect('tok-u1');
  const list = { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} };
  const other = await post({ authorization: 'Bearer tok-u2', 'mcp-session-id': transport.sessionId!, 'mcp-protocol-version': '2025-06-18' }, list);
  assert.equal(other.status, 403);
  const gone = await post({ authorization: 'Bearer tok-u1', 'mcp-session-id': 'no-such-session', 'mcp-protocol-version': '2025-06-18' }, list);
  assert.equal(gone.status, 404);
  const noInit = await post({ authorization: 'Bearer tok-u1' }, list);
  assert.equal(noInit.status, 400);
  await client.close();
});

test('bridge 14: a revoked token closes its session on the next request', async () => {
  TOKENS['tok-tmp'] = { user: 'u3', tokenId: 't3' };
  const { client, transport } = await connect('tok-tmp');
  assert.equal(mcp.sessionsOf('u3').length, 1);
  delete TOKENS['tok-tmp'];
  const r = await post({ authorization: 'Bearer tok-tmp', 'mcp-session-id': transport.sessionId!, 'mcp-protocol-version': '2025-06-18' }, { jsonrpc: '2.0', id: 3, method: 'tools/list', params: {} });
  assert.equal(r.status, 401);
  assert.equal(mcp.sessionsOf('u3').length, 0);
  await client.close().catch(() => undefined);
});

test('bridge 14: long poll reports progress while it waits and returns by its deadline', async () => {
  const notes: number[] = [];
  const t0 = Date.now();
  const none = await longPoll({ attempt: async () => null, waitMs: 260, everyMs: 20, progressMs: 80, onProgress: s => { notes.push(s); } });
  assert.equal(none, null);
  assert.ok(Date.now() - t0 < 600, 'returns near waitMs');
  assert.ok(notes.length >= 2, `progress notes: ${notes.join(',')}`);
  assert.ok(notes.every((s, i) => i === 0 || s > notes[i - 1]!), 'progress always increases');
  let n = 0;
  assert.equal(await longPoll({ attempt: async () => (++n === 3 ? 'step' : null), waitMs: 5000, everyMs: 10 }), 'step');
  const ac = new AbortController(); setTimeout(() => ac.abort(), 50);
  assert.equal(await longPoll({ attempt: async () => null, waitMs: 5000, everyMs: 10, signal: ac.signal }), null);
});
