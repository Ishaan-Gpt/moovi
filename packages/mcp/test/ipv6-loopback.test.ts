import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { createServer } from 'node:net';
import { alsoOnIpv6Loopback, BrainHub, bridgeHttp, buildMcp, mcpHandler } from '../src/index';

/**
 * Windows readiness, Oct 18: the bridge prints http://localhost:3200 but listened on 127.0.0.1 only, and Windows (like
 * Node 17+ and Bun clients) tries ::1 first for localhost. scripts/serve.ts now adds a ::1 listener with the same routes.
 */
const v6ok = await new Promise<boolean>(res => { const s = createServer(); s.once('error', () => res(false)); s.listen(0, '::1', () => s.close(() => res(true))); });

test('localhost on ::1: the same bridge answers on [::1] and on 127.0.0.1', { skip: !v6ok && 'no IPv6 loopback on this machine' }, async () => {
  const hub = new BrainHub(undefined, {});
  const mcp = mcpHandler({ verify: t => hub.tokens.verify(t), build: ctx => buildMcp(hub, ctx) });
  const http = bridgeHttp({ mcp });
  await new Promise<void>(res => http.listen(0, '127.0.0.1', res));
  const port = (http.address() as AddressInfo).port;
  const v6 = await alsoOnIpv6Loopback(http, port);
  assert.ok(v6, 'a ::1 listener started');
  try {
    for (const host of ['127.0.0.1', '[::1]']) {
      const r = await fetch(`http://${host}:${port}/healthz`);
      assert.equal(r.status, 200, host);
      assert.equal((await r.json() as { ok: boolean }).ok, true);
    }
    const u = await fetch(`http://[::1]:${port}/mcp`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    assert.equal(u.status, 401, 'the /mcp route and its token check are the same on ::1');
  } finally {
    await new Promise(res => v6!.close(res)); await mcp.close(); await new Promise(res => http.close(res));
  }
});

test('localhost on ::1: a port already taken on ::1 is not fatal (null, the IPv4 bridge keeps running)', { skip: !v6ok && 'no IPv6 loopback on this machine' }, async () => {
  const taken = createServer(); await new Promise<void>(res => taken.listen(0, '::1', res));
  const port = (taken.address() as AddressInfo).port;
  const hub = new BrainHub(undefined, {});
  const mcp = mcpHandler({ verify: t => hub.tokens.verify(t), build: ctx => buildMcp(hub, ctx) });
  const http = bridgeHttp({ mcp });
  await new Promise<void>(res => http.listen(port, '127.0.0.1', res));
  try {
    assert.equal(await alsoOnIpv6Loopback(http, port), null);
    assert.equal((await fetch(`http://127.0.0.1:${port}/healthz`)).status, 200);
  } finally {
    await mcp.close(); await new Promise(res => http.close(res)); await new Promise(res => taken.close(res));
  }
});
