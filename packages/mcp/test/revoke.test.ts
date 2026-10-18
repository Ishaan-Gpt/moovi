import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { BrainHub, bridgeApp, TOKEN_REMOVED } from '../src/index';

// live test 2026-10-18 (D1): Disconnect on the website while a window's moovi_next was waiting let that wait run to its
// end on the old token. Now an open wait ends within TOKEN_CHECK_MS and never hands a step to a removed token.
const hub = new BrainHub();
const app = bridgeApp(hub, { userOf: async req => req.headers.get('x-test-user') });
await new Promise<void>(res => app.http.listen(0, '127.0.0.1', res));
const base = `http://127.0.0.1:${(app.http.address() as AddressInfo).port}`;
after(async () => { await app.close(); });

test('a token removed or replaced mid wait ends the wait within seconds, with no step handed out', async () => {
  for (const how of ['revoke', 'replace'] as const) {
    const u = `rv-${how}`;
    const { token } = await hub.tokens.mint(u, 'x');
    const c = new Client({ name: 'standin', version: '1' });
    await c.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`), { requestInit: { headers: { Authorization: `Bearer ${token}` } } }));
    const p = await c.getPrompt({ name: 'run' });
    const ticket = /run ticket (rt_[0-9a-f]+)/.exec((p.messages[0]!.content as { text: string }).text)![1]!;
    const t0 = Date.now();
    const waiting = c.callTool({ name: 'moovi_next', arguments: { ticket, wait_s: 30 } });
    await new Promise(r => setTimeout(r, 800));
    if (how === 'revoke') await hub.tokens.revoke(u); else await hub.tokens.mint(u, 'new');
    // a step arriving after the removal must not reach the old window
    await hub.board.start({ user: u, job: `j-${how}` });
    await hub.queue.push({ user: u, job: `j-${how}`, agent: 'direct:edit', system: 's', prompt: 'p', model: 'brain' } as never).catch(() => undefined);
    const out = JSON.parse(((await waiting).content as { text: string }[])[0]!.text);
    const s = (Date.now() - t0) / 1000;
    assert.equal(out.status, 'idle', `${how}: ${JSON.stringify(out).slice(0, 200)}`);
    assert.equal(out.message, TOKEN_REMOVED);
    assert.ok(s < 8, `${how}: ended after ${s} s, not at the 30 s wait`);
    await c.close().catch(() => undefined);
    await hub.board.finish({ job: `j-${how}`, ok: true });
  }
});
