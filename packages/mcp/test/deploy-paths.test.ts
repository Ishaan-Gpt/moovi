import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { BrainHub, bridgeApp, sessionCookieAuth } from '../src/index';

// round 4 (deploy): the website reached through a proxy of /studio (a Vercel site rewriting /studio to the server). The
// Settings card calls /studio/api/brain/* and opens /studio/connect; Caddy sends both to the bridge (deploy/Caddyfile).
const hub = new BrainHub();
const users: Record<string, string> = { 'sess-aaaaaaaaaaaaaaaaaaaaaaaa': 'u1' };
const app = bridgeApp(hub, {
  userOf: sessionCookieAuth({ lookup: async t => (t && users[t] ? { id: users[t]! } : null), origins: ['https://moovi-three.vercel.app'] }),
  mcpUrl: () => 'https://server.example/mcp',
});
await new Promise<void>(res => app.http.listen(0, '127.0.0.1', res));
const base = `http://127.0.0.1:${(app.http.address() as AddressInfo).port}`;
after(async () => { await app.close(); });
const cookie = 'moovi_session=sess-aaaaaaaaaaaaaaaaaaaaaaaa';

test('the connect page and the card API answer under /studio too, and the page calls its own base path', async () => {
  const page = await fetch(`${base}/studio/connect`);
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, /base\+'\/api\/brain\/status'/, 'relative to where the page is served');
  const st = await fetch(`${base}/studio/api/brain/status`, { headers: { cookie } });
  assert.equal(st.status, 200);
  assert.equal(((await st.json()) as { linked: boolean }).linked, false);
});

test('a link from the proxied website (an allowed origin) mints a command for the server, not for the website', async () => {
  const r = await fetch(`${base}/studio/api/brain/link`, { method: 'POST', headers: { cookie, origin: 'https://moovi-three.vercel.app', host: 'server.example', 'content-type': 'application/json' }, body: '{}' });
  assert.equal(r.status, 200);
  const j = await r.json() as { command: string };
  assert.match(j.command, /https:\/\/server\.example\/mcp/);
  const bad = await fetch(`${base}/studio/api/brain/link`, { method: 'POST', headers: { cookie, origin: 'https://evil.example', 'content-type': 'application/json' }, body: '{}' });
  assert.equal(bad.status, 403);
});
