import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { BrainHub, bridgeHttp, buildMcp, IDLE_NO_TICKET, mcpHandler, NOTHING_RUNNING } from '../src/index';

const hub = new BrainHub();
const mcp = mcpHandler({ verify: t => hub.tokens.verify(t), build: ctx => buildMcp(hub, ctx) });
const http = bridgeHttp({ mcp });
await new Promise<void>(res => http.listen(0, '127.0.0.1', res));
const base = `http://127.0.0.1:${(http.address() as AddressInfo).port}`;
after(async () => { await mcp.close(); await new Promise(res => http.close(res)); });

async function window(token: string) {
  const client = new Client({ name: 'claude-code-standin', version: '1' });
  await client.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`), { requestInit: { headers: { Authorization: `Bearer ${token}` } } }));
  const next = async (args: Record<string, unknown>) => JSON.parse(((await client.callTool({ name: 'moovi_next', arguments: { wait_s: 0.2, ...args } })).content as { text: string }[])[0]!.text);
  return { client, next };
}

test('bridge 17: /moovi:run is an MCP prompt served by the server; getting it is what lets this window work', async () => {
  const { token } = await hub.tokens.mint('u1');
  const a = await window(token), b = await window(token);
  const prompts = await a.client.listPrompts();
  const run = prompts.prompts.find(p => p.name === 'run');
  assert.ok(run, 'the server lists the run prompt (Claude Code shows it as /moovi:run or /mcp__moovi__run)');
  assert.equal(run!.arguments?.length ?? 0, 0, 'no arguments to type');
  assert.equal((await a.next({})).message, IDLE_NO_TICKET, 'before /moovi:run nothing happens');
  const got = await a.client.getPrompt({ name: 'run' });
  const text = (got.messages[0]!.content as { text: string }).text;
  const ticket = /run ticket (rt_[0-9a-f]+)/.exec(text)?.[1];
  assert.ok(ticket, 'the prompt carries a one-time run ticket');
  assert.match(text, /moovi_next/); assert.match(text, /moovi_answer/); assert.match(text, /Do not read or write files or run commands/);
  assert.ok(text.length < 1400, `the prompt stays short (${text.length} chars)`);
  assert.equal((await a.next({})).message, NOTHING_RUNNING, 'after /moovi:run this window may work, even without passing the ticket');
  assert.equal((await a.next({ ticket })).message, NOTHING_RUNNING);
  assert.equal((await b.next({})).message, IDLE_NO_TICKET, 'another window that did not type it stays inert');
  assert.equal((await b.next({ ticket })).message, IDLE_NO_TICKET, 'and cannot borrow the first window\'s ticket');
  const again = await a.client.getPrompt({ name: 'run' });
  assert.notEqual(/run ticket (rt_[0-9a-f]+)/.exec((again.messages[0]!.content as { text: string }).text)?.[1], ticket, 'each /moovi:run is a fresh ticket');
  await a.client.close(); await b.client.close();
});
