import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { BRAIN_CAPS, estimateTokens, RUN_OVERHEAD, VIDEO_CAP } from '@moovi/engine/runtime';
import { BrainHub, bridgeHttp, buildMcp, mcpHandler } from '../src/index';

// Item 27 (measure): the fixed cost of one /mcp__moovi__run is what Claude Code reads before any step: the run prompt and
// the three tool descriptions. Measured with the provider's count_tokens on 2026-10-17: prompt 246, tool definitions
// 506 on top of a client that already has tools (Claude Code always does; the provider's own tool-use preamble, about
// 500 more, is paid by any tool-using client, not by Moovi), so about 750 against RUN_OVERHEAD 1,000. RUN_OVERHEAD
// is what every video's budget starts at, so it must keep covering that text; the server's (high) estimate is the guard.
const hub = new BrainHub();
const mcp = mcpHandler({ verify: t => hub.tokens.verify(t), build: ctx => buildMcp(hub, ctx) });
const http = bridgeHttp({ mcp });
await new Promise<void>(res => http.listen(0, '127.0.0.1', res));
const base = `http://127.0.0.1:${(http.address() as AddressInfo).port}`;
after(async () => { await mcp.close(); await new Promise(res => http.close(res)); });

test('bridge 27: RUN_OVERHEAD covers the run prompt and the tool descriptions Claude Code reads', async () => {
  const { token } = await hub.tokens.mint('u-measure');
  const client = new Client({ name: 'claude-code-standin', version: '1' });
  await client.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`), { requestInit: { headers: { Authorization: `Bearer ${token}` } } }));
  const tools = (await client.listTools()).tools.map(t => ({ name: t.name, description: t.description ?? '', input_schema: t.inputSchema }));
  const prompt = ((await client.getPrompt({ name: 'run' })).messages[0]!.content as { text: string }).text;
  const fixed = estimateTokens(JSON.stringify(tools)) + estimateTokens(prompt);
  assert.ok(fixed <= RUN_OVERHEAD, `the fixed text is about ${fixed} tokens by the server's estimate; RUN_OVERHEAD is ${RUN_OVERHEAD}`);
  await client.close();
});

test('bridge 27: one edit and one final look still fit the per video cap after the fixed cost', () => {
  assert.ok(RUN_OVERHEAD + BRAIN_CAPS.edit.in + BRAIN_CAPS.look.in <= VIDEO_CAP.in);
  assert.ok(RUN_OVERHEAD + BRAIN_CAPS.film.in + BRAIN_CAPS.look.in <= VIDEO_CAP.in);
});
