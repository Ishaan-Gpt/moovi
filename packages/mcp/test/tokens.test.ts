import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { BrainHub, brainApi, bridgeHttp, buildMcp, hashToken, isTokenShape, mcpHandler, memoryStore, sessionCookieAuth, webRoute, type BrainStore } from '../src/index';

/** a store that remembers every value written, to prove the token itself is never stored */
function recording(): { store: BrainStore; written: string[] } {
  const inner = memoryStore(), written: string[] = [];
  return { written, store: { ...inner, set: async (k, v, t) => { written.push(k, v); return inner.set(k, v, t); }, setNx: async (k, v, t) => { written.push(k, v); return inner.setNx(k, v, t); } } };
}

test('bridge 15: a token is shown once, stored only as its hash, and names its user', async () => {
  const rec = recording(); let t = 1_000;
  const hub = new BrainHub(rec.store, () => t);
  const { token, record } = await hub.tokens.mint('u1', 'laptop');
  assert.ok(isTokenShape(token), token.slice(0, 6));
  assert.equal(record.last4, token.slice(-4));
  assert.ok(!rec.written.some(v => v.includes(token)), 'the token never reaches the store');
  assert.ok(rec.written.some(v => v.includes(hashToken(token))), 'its sha256 does');
  assert.deepEqual(await hub.tokens.verify(token), { user: 'u1', tokenId: record.id });
  assert.equal(await hub.tokens.verify('mvk_' + 'A'.repeat(43)), null, 'unknown token');
  assert.equal(await hub.tokens.verify('not-a-token'), null, 'wrong shape');
  const s1 = await hub.tokens.status('u1');
  assert.equal(s1.linked, true); assert.equal(s1.token_last4, token.slice(-4)); assert.equal(s1.last_seen, 1_000); assert.equal(s1.label, 'laptop');
  t += 10_000; await hub.tokens.verify(token);
  assert.equal((await hub.tokens.status('u1')).last_seen, 1_000, 'last seen is written at most every 30 s');
  t += 30_000; await hub.tokens.verify(token);
  assert.equal((await hub.tokens.status('u1')).last_seen, 41_000);
});

test('bridge 15: minting again replaces the token; revoke cuts it off; users never cross', async () => {
  const hub = new BrainHub();
  const a = await hub.tokens.mint('u1'), b = await hub.tokens.mint('u1'), c = await hub.tokens.mint('u2');
  assert.equal(await hub.tokens.verify(a.token), null, 'the old token stops working');
  assert.equal((await hub.tokens.verify(b.token))?.user, 'u1');
  assert.equal((await hub.tokens.verify(c.token))?.user, 'u2');
  assert.equal(await hub.tokens.revoke('u1'), true);
  assert.equal(await hub.tokens.verify(b.token), null);
  assert.equal((await hub.tokens.status('u1')).linked, false);
  assert.equal((await hub.tokens.verify(c.token))?.user, 'u2', 'another user is untouched');
  assert.equal(await hub.tokens.revoke('u1'), false);
});

test('bridge 15: /api/brain/link and /api/brain/status (web handlers)', async () => {
  const hub = new BrainHub();
  const api = brainApi({ hub, userOf: async req => req.headers.get('x-user'), mcpUrl: () => 'https://moovi.example/mcp' });
  const call = (method: string, path: string, user?: string, body?: unknown) => api.handle(new Request(`http://h${path}`, { method, headers: user ? { 'x-user': user, 'content-type': 'application/json' } : {}, ...(body ? { body: JSON.stringify(body) } : {}) }));
  assert.equal((await call('POST', '/api/brain/link'))!.status, 401);
  assert.equal(await call('GET', '/api/other', 'u1'), null);
  const r = await call('POST', '/studio/api/brain/link', 'u1', { label: 'my laptop' });
  assert.equal(r!.status, 200); assert.equal(r!.headers.get('cache-control'), 'no-store');
  const j = await r!.json() as { command: string; token: string; token_last4: string; run: string };
  assert.equal(j.command, `claude mcp add --scope user --transport http moovi https://moovi.example/mcp --header "Authorization: Bearer ${j.token}"`);
  assert.equal(j.run, '/moovi:run');
  const s = await (await call('GET', '/api/brain/status', 'u1'))!.json() as Record<string, unknown>;
  assert.deepEqual({ linked: s.linked, online: s.online, lane: s.lane, last4: s.token_last4, label: s.label }, { linked: true, online: false, lane: 'waiting', last4: j.token_last4, label: 'my laptop' });
  assert.equal(JSON.stringify(s).includes(j.token), false, 'status never shows the token');
  hub.presence.touch('u1');
  assert.equal((await (await call('GET', '/api/brain/status', 'u1'))!.json() as { lane: string }).lane, 'bridge');
  assert.deepEqual(await (await call('DELETE', '/api/brain/link', 'u1'))!.json(), { linked: false });
  assert.equal(await hub.tokens.verify(j.token), null);
});

test('bridge 15: the session cookie decides the user; cross-site writes are refused', async () => {
  const auth = sessionCookieAuth({ lookup: async t => (t === 'sess-1' ? { id: 'u1' } : null) });
  const req = (h: Record<string, string>) => new Request('http://moovi.example/api/brain/link', { method: 'POST', headers: { host: 'moovi.example', ...h } });
  assert.equal(await auth(req({ cookie: 'a=b; moovi_session=sess-1' }), true), 'u1');
  assert.equal(await auth(req({ cookie: 'moovi_session=nope' }), false), null);
  assert.equal(await auth(req({}), false), null);
  assert.equal(await auth(req({ cookie: 'moovi_session=sess-1', origin: 'https://moovi.example' }), true), 'u1');
  const x = await auth(req({ cookie: 'moovi_session=sess-1', origin: 'https://evil.example' }), true);
  assert.ok(x && typeof x === 'object' && x.error.status === 403);
});

test('bridge 15: over HTTP, mint with curl, connect a real MCP client with the token, revoke, 401', async () => {
  const hub = new BrainHub();
  const mcp = mcpHandler({ verify: t => hub.tokens.verify(t), build: ctx => buildMcp(hub, ctx) });
  const api = brainApi({ hub, userOf: async req => req.headers.get('x-user') });
  const http = bridgeHttp({ mcp, routes: [webRoute(r => api.handle(r))] });
  await new Promise<void>(res => http.listen(0, '127.0.0.1', res));
  const base = `http://127.0.0.1:${(http.address() as AddressInfo).port}`;
  after(async () => { await mcp.close(); await new Promise(res => http.close(res)); });
  const minted = await (await fetch(`${base}/api/brain/link`, { method: 'POST', headers: { 'x-user': 'u7' } })).json() as { token: string; command: string; url: string };
  assert.equal(minted.url, `${base}/mcp`);
  assert.ok(minted.command.includes(`moovi ${base}/mcp --header "Authorization: Bearer ${minted.token}"`));
  const client = new Client({ name: 'test', version: '1' });
  const transport = new StreamableHTTPClientTransport(new URL(minted.url), { requestInit: { headers: { Authorization: `Bearer ${minted.token}` } } });
  await client.connect(transport);
  assert.ok((await client.listTools()).tools.length > 0);
  assert.equal(mcp.sessionsOf('u7').length, 1);
  await fetch(`${base}/api/brain/link`, { method: 'DELETE', headers: { 'x-user': 'u7' } });
  // item 23: a revoked token tells Claude Code in plain words what to do
  await assert.rejects(() => client.listTools(), /This Moovi connection was removed\. Copy a new one from Moovi Settings\./);
  assert.equal(mcp.sessionsOf('u7').length, 0);
  await client.close().catch(() => undefined);
});
