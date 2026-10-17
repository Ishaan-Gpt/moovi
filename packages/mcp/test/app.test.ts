import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { BrainHub, bridgeApp } from '../src/index';

// bridge 18: the assembled server (what scripts/serve.ts runs), from the website's Connect step to /moovi:run in a window
const hub = new BrainHub();
const app = bridgeApp(hub, { userOf: async req => req.headers.get('x-test-user') });
await new Promise<void>(res => app.http.listen(0, '127.0.0.1', res));
const base = `http://127.0.0.1:${(app.http.address() as AddressInfo).port}`;
after(async () => { await app.close(); });

async function connect(token: string) {
  const client = new Client({ name: 'claude-code-standin', version: '1' });
  await client.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`), { requestInit: { headers: { Authorization: `Bearer ${token}` } } }));
  return client;
}
const status = async (user: string) => (await (await fetch(`${base}/api/brain/status`, { headers: { 'x-test-user': user } })).json()) as Record<string, unknown>;

test('bridge 18: health, the connect page, and sign-in first', async () => {
  assert.equal((await fetch(`${base}/healthz`)).status, 200);
  const page = await fetch(`${base}/connect`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Make my connect command/);
  assert.equal((await fetch(`${base}/api/brain/link`, { method: 'POST' })).status, 401, 'no signed-in user, no token');
});

test('bridge 18: token from the website, claude mcp add command, /moovi:run in one window, revoke cuts it off', async () => {
  const r = await fetch(`${base}/api/brain/link`, { method: 'POST', headers: { 'x-test-user': 'u18', 'content-type': 'application/json' }, body: '{}' });
  assert.equal(r.status, 200);
  const j = await r.json() as { command: string; token: string; url: string };
  assert.equal(j.url, `${base}/mcp`, 'the command points at this server');
  assert.equal(j.command, `claude mcp add --scope user --transport http moovi ${base}/mcp --header "Authorization: Bearer ${j.token}"`);
  assert.equal((await status('u18')).linked, true);

  const a = await connect(j.token), b = await connect(j.token);
  const prompts = await a.listPrompts();
  assert.ok(prompts.prompts.some(p => p.name === 'run'), 'the server serves /moovi:run itself, nothing to install');
  const run = await a.getPrompt({ name: 'run' });
  assert.match((run.messages[0]!.content as { text: string }).text, /run ticket rt_[0-9a-f]+/);
  const st = async (c: Client) => JSON.parse(((await c.callTool({ name: 'moovi_status', arguments: {} })).content as { text: string }[])[0]!.text) as Record<string, unknown>;
  assert.equal((await st(a)).this_window_has_run, true);
  assert.equal((await st(b)).this_window_has_run, false, 'another window of the same user stays inert');

  const off = await fetch(`${base}/api/brain/link`, { method: 'DELETE', headers: { 'x-test-user': 'u18' } });
  assert.equal(off.status, 200);
  assert.equal((await status('u18')).linked, false);
  await assert.rejects(connect(j.token), 'a revoked token cannot connect again');
  await a.close().catch(() => undefined); await b.close().catch(() => undefined);
});
