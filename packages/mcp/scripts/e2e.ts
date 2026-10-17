// pnpm --filter @moovi/mcp e2e [clip.mp4]: the bridge item 18 proof. A real MCP client (the SDK, standing in for
// Claude Code) connects to the bridge over HTTP with a minted token, gets /moovi:run, and is the ONLY brain for a real
// upload edit run by the real engine worker on FalkorDB, for a keyless user. Detail work uses this machine's server
// model if one is set (MOOVI_RUNTIME=http ...), hearing uses the server's speech key. Prints one JSON summary line.
import { copyFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { basename, extname, join, resolve } from 'node:path';
import type { AddressInfo } from 'node:net';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { closeMemory, health, project as P, projectGraph, run as runQ } from '../../graph/src/index';
import { loadModel } from '@moovi/engine/keys';
import { blocking, follow, history } from '../../engine/src/bus';
import { createChat, createProject, signIn, signUp } from '../../engine/src/accounts';
import { handleCommand } from '../../engine/src/chat';
import { ensureDir } from '../../engine/src/bench';
import { projectDir } from '../../engine/src/ctx';
import { newId } from '../../engine/src/ids';
import { say } from '../../engine/src/live';
import { closeRender } from '../../engine/src/render/host';
import { HANDLERS } from '../../engine/src/tasks';
import { Worker } from '../../engine/src/worker';
import { BrainHub, bridgeApp, falkorStore } from '../src/index';

const clip = resolve(process.argv[2] ?? join(import.meta.dirname, '../../../docs/agents/ishaan-test/ishaan-test.mp4'));
const LIMIT_MS = Number(process.env.E2E_LIMIT_MS ?? 20 * 60_000);
if (!(await health()).ok) { console.error('FalkorDB is down'); process.exit(1); }

// the bridge, exactly as scripts/serve.ts builds it, plugged into this process's engine
const { store, quit } = await falkorStore();
const hub = new BrainHub(store, { publicUrl: 'http://localhost:3000' });
const lanes: string[] = [], events: string[] = [];
const unregister = hub.register({ onLane: (_u, agent, lane) => lanes.push(`${agent}>${lane}`), bridge: { onEvent: e => events.push(`${e.type}:${e.agent}`) } });
const app = bridgeApp(hub, { userOf: async () => null });
await new Promise<void>(res => app.http.listen(0, '127.0.0.1', res));
const mcpUrl = `http://127.0.0.1:${(app.http.address() as AddressInfo).port}/mcp`;

// a keyless user (no model key of their own)
const email = 'bridge-e2e@moovi.local', password = 'bridge-e2e-local-only';
const me = await signIn({ email, password }).catch(() => signUp({ email, password, name: 'Bridge E2E' }));
if (loadModel(me.id)) { console.error('the e2e user has a model key; the proof needs a keyless user'); process.exit(1); }

// 1. token (what the Connect card shows), 2. Claude Code connects with it, 3. the user types /moovi:run
const { token } = await hub.tokens.mint(me.id, 'e2e');
const client = new Client({ name: 'claude-code-standin', version: '1' });
await client.connect(new StreamableHTTPClientTransport(new URL(mcpUrl), { requestInit: { headers: { Authorization: `Bearer ${token}` } } }));
const prompt = await client.getPrompt({ name: 'run' });
const promptText = (prompt.messages[0]!.content as { text: string }).text;
const ticket = /run ticket (rt_[0-9a-f]+)/.exec(promptText)![1]!;
let calls = 0, inChars = promptText.length, outChars = 0;
const call = async (name: string, args: Record<string, unknown>) => {
  calls++; outChars += JSON.stringify(args).length;
  const r = await client.callTool({ name, arguments: args }, undefined, { timeout: 120_000, resetTimeoutOnProgress: true, onprogress: () => undefined });
  const blocks = r.content as { type: string; text?: string }[];
  inChars += blocks.reduce((n, b) => n + (b.text?.length ?? 0), 0);
  return JSON.parse(blocks[0]!.text!) as Record<string, any>;
};

/** the stand-in brain: a valid answer built from the step's own schema and numbered sentence lines */
function answerFor(step: Record<string, any>): Record<string, unknown> {
  const props = (step.answer_schema?.properties ?? {}) as Record<string, any>;
  const enumOf = (p: any): unknown[] => p?.enum ?? p?.items?.properties?.tag?.enum ?? [];
  const nums = [...String(step.task).matchAll(/^\s*\[?(\d+)[\]).:]?\s/gm)].map(m => Number(m[1]));
  const n = nums.length ? Math.max(...nums) + 1 : 1;
  const tags = enumOf(props.beats) as string[];
  const tagFor = (i: number) => (i === 0 && tags.includes('hook') ? 'hook' : i === n - 1 && n > 1 && tags.includes('cta') ? 'cta' : tags.find(t => t !== 'hook' && t !== 'cta') ?? tags[0]);
  const a: Record<string, unknown> = {};
  for (const [k, p] of Object.entries(props)) {
    if (p.enum) a[k] = k === 'cleanup' && p.enum.includes('balanced') ? 'balanced' : p.enum[0];
    else if (k === 'beats') a[k] = Array.from({ length: n }, (_, i) => ({ i, tag: tagFor(i) }));
    else if (p.type === 'array') a[k] = [];
    else if (p.type === 'integer' || p.type === 'number') a[k] = 0;
    else if (k === 'model') a[k] = 'mcp-sdk-client (bridge e2e)';
    else if (k === 'title') a[k] = 'Bridge end to end test';
    else if (p.type === 'string') a[k] = 'chosen by the bridge e2e client';
  }
  return a;
}

const steps: { agent: string; ms: number; ok: boolean }[] = [];
let final = null as Record<string, any> | null;
const t0 = Date.now();
const brain = (async () => {
  let r = await call('moovi_next', { ticket, wait_s: 45 });
  while (Date.now() - t0 < LIMIT_MS) {
    if (r.status === 'think') {
      const s0 = Date.now();
      let res = await call('moovi_answer', { step: r.step, answer: answerFor(r) });
      steps.push({ agent: r.agent, ms: Date.now() - s0, ok: res.ok === true });
      if (res.ok !== true) { console.error('answer refused:', JSON.stringify(res.problems)); res = { next: await call('moovi_next', { wait_s: 45 }) }; }
      r = res.next;
    } else if (r.status === 'working' || r.status === 'waiting') r = await call('moovi_next', { wait_s: 45 });
    else { final = r; return; }
  }
})();

// 4. the user starts a video on the website: an upload with a plain brief, run by the real worker
const proj = await createProject(me.id, 'Bridge e2e');
const chat = await createChat(proj.id);
const id = newId('f'), dest = join(ensureDir(join(projectDir(me.id, proj.id), 'uploads')), `${id}${extname(clip)}`);
copyFileSync(clip, dest);
await runQ(projectGraph(proj.id), P.addUpload, { chat: chat.id, id, name: basename(clip), path: dest, mime: 'video/mp4', size: statSync(dest).size, sha: createHash('sha256').update(dest).digest('hex'), at: Date.now() });
const brief = 'Edit my clip into a clean short with captions.';
await say(proj.id, chat.id, null, brief);
const w = new Worker({ handlers: HANDLERS, onCommand: handleCommand });
await w.start();
await handleCommand({ type: 'brief', user: me.id, project: proj.id, chat: chat.id, text: brief, ratio: 'auto', uploads: [id], message: newId('m') });

const conn = await blocking();
let last = '0', done = false, ok = false;
for (const e of await history(chat.id)) last = e.seq;
const log: string[] = [];
while (!done && Date.now() - t0 < LIMIT_MS) {
  for (const e of await follow(conn, chat.id, last, 5000)) {
    last = e.seq;
    const s = ((Date.now() - t0) / 1000).toFixed(0);
    if (e.type === 'message') log.push(`${s}s ${e.message.agent ?? 'you'}: ${e.message.text.slice(0, 160)}`);
    else if (e.type === 'activity' && (e.kind === 'done' || e.kind === 'fail')) log.push(`${s}s ${e.kind} [${e.agent}] ${e.text.slice(0, 120)}`);
    else if (e.type === 'run' && (e.run.status === 'done' || e.run.status === 'failed')) { done = true; ok = e.run.status === 'done'; }
  }
}
await Promise.race([brain, new Promise(res => setTimeout(res, 60_000))]);
const [c] = await runQ<{ path: string; duration: number }>(projectGraph(proj.id), P.chat, { id: chat.id });
for (const l of log.slice(-25)) console.log(l);
console.log(JSON.stringify({
  ok, seconds: Math.round((Date.now() - t0) / 1000), mp4: c?.path ?? null, duration: c?.duration ?? 0,
  claude_code: { calls, steps, approx_tokens_in: Math.round(inChars / 4), approx_tokens_out: Math.round(outChars / 4), final },
  lanes: [...new Set(lanes)], bridge_events: events, user: me.id, project: proj.id, chat: chat.id,
}));
await w.stop(); await conn.quit(); await client.close(); await app.close(); unregister(); await quit(); await closeRender(); await closeMemory();
process.exit(ok && final?.status === 'done' ? 0 : 1);
