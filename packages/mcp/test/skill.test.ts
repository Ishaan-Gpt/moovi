import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { skillPrompt } from '@moovi/engine/brain';
import { BrainHub, bridgeHttp, buildMcp, mcpHandler, SKILL_URI, skillFiles } from '../src/index';

const hub = new BrainHub(undefined, { publicUrl: 'https://moovi.example' });
const unregister = hub.register({ server: null, bridge: { pollMs: 5 } });
const mcp = mcpHandler({ verify: t => hub.tokens.verify(t), build: ctx => buildMcp(hub, ctx) });
const http = bridgeHttp({ mcp });
await new Promise<void>(res => http.listen(0, '127.0.0.1', res));
const base = `http://127.0.0.1:${(http.address() as AddressInfo).port}`;
after(async () => { unregister(); await mcp.close(); await new Promise(res => http.close(res)); });

test('decision 20: the repo\'s ishaan-motion skill is served read only as MCP resources, the same text the Edit spec step carries', async () => {
  const { token } = await hub.tokens.mint('u-skill');
  const client = new Client({ name: 'claude-code-standin', version: '1' });
  await client.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`), { requestInit: { headers: { Authorization: `Bearer ${token}` } } }));
  const list = await client.listResources();
  const uris = list.resources.map(r => r.uri);
  assert.equal(uris[0], `${SKILL_URI}SKILL.md`, uris.join(' '));
  for (const f of ['references/edit-fundamentals.md', 'references/launch.md', 'references/showreel.md']) assert.ok(uris.includes(SKILL_URI + f), f);
  const skill = await client.readResource({ uri: `${SKILL_URI}SKILL.md` });
  const text = (skill.contents[0] as { text: string }).text;
  assert.ok(skillPrompt('edit', 'full').text.startsWith(text.trim()), 'the resource is the skill the full tier reads');
  await assert.rejects(client.readResource({ uri: `${SKILL_URI}../../package.json` }), 'nothing outside the listed files');
  // the tools are unchanged beside it
  assert.deepEqual((await client.listTools()).tools.map(t => t.name).sort(), ['moovi_answer', 'moovi_next', 'moovi_status']);
  await client.close();
});

test('decision 20: skillFiles lists only the skill\'s text files, SKILL.md first, and an empty list for a missing folder', () => {
  const d = mkdtempSync(join(tmpdir(), 'skill-'));
  try {
    mkdirSync(join(d, 'references')); mkdirSync(join(d, '.git'));
    writeFileSync(join(d, 'SKILL.md'), '# s'); writeFileSync(join(d, 'VERSION'), '1'); writeFileSync(join(d, 'references', 'a.md'), 'a');
    writeFileSync(join(d, 'run.sh'), 'echo'); writeFileSync(join(d, '.git', 'x.md'), 'x');
    assert.deepEqual(skillFiles(d), ['SKILL.md', 'references/a.md', 'VERSION']);
    assert.deepEqual(skillFiles(join(d, 'nope')), []);
  } finally { rmSync(d, { recursive: true, force: true }); }
});
