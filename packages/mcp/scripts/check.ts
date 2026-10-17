// pnpm --filter @moovi/mcp check "<the claude mcp add command from Moovi Settings>"   (or: check <https://site/mcp> <token>)
// Checks a deployed Moovi bridge the way Claude Code will use it, and says in plain words what is wrong:
// the address answers, /healthz is the bridge (not the website), the token is accepted, the tools and /mcp__moovi__run
// are there, and one moovi_next round trip works (a few seconds, no video needed). Nothing is changed on the server
// except one run ticket for a throwaway session. Exit code 0 = ready for Claude Code.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { parseConnect } from '../src/check';

const ok = (s: string) => console.log(`ok    ${s}`);
let failed = 0;
const bad = (s: string, fix?: string) => { failed++; console.log(`FAIL  ${s}`); if (fix) console.log(`      fix: ${fix}`); };

async function main() {
  const c = parseConnect(process.argv.slice(2));
  if (!c) { console.log('Usage: pnpm --filter @moovi/mcp check "<the claude mcp add command from Moovi Settings>"'); process.exit(2); }
  const u = new URL(c.url);
  const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(u.hostname);
  if (!u.pathname.replace(/\/+$/, '').endsWith('/mcp')) bad(`the address ${c.url} does not end in /mcp`, 'copy the command again from Moovi Settings, Use Claude Code');
  if (u.protocol !== 'https:' && !local) bad(`the address is plain http (${u.origin})`, 'set PUBLIC_URL=https://<your domain> in .env and run docker compose up -d again');
  else ok(`address ${c.url}`);

  // 1. the bridge answers at /healthz (Caddy routes it to the worker, not to the website)
  try {
    const r = await fetch(new URL('/healthz', u.origin), { signal: AbortSignal.timeout(10_000) });
    const t = await r.text();
    let j: { ok?: boolean; sessions?: number } | null = null; try { j = JSON.parse(t); } catch { j = null; }
    if (r.ok && j?.ok) ok(`bridge is up (${j.sessions ?? 0} Claude Code windows connected)`);
    else if (/<html/i.test(t)) bad(`${u.origin}/healthz is the website, not the bridge`, 'the proxy must send /mcp, /healthz, /connect and /api/brain/* to the worker (deploy/Caddyfile)');
    else bad(`${u.origin}/healthz answered ${r.status}`, 'docker compose ps; docker compose logs --tail 50 worker');
  } catch (e) {
    const m = e instanceof Error ? (e.cause instanceof Error ? e.cause.message : e.message) : String(e);
    bad(`cannot reach ${u.origin} (${m})`, /certificate|CERT/i.test(m) ? 'HTTPS certificate problem: SITE_ADDRESS must be the domain that points at this server' : 'check the server is on, ports 80 and 443 are open, and the domain points at it');
    process.exit(1);
  }

  // 2. Claude Code's own connection: initialize with the bearer token
  const client = new Client({ name: 'moovi-check', version: '1' });
  const transport = new StreamableHTTPClientTransport(u, { requestInit: { headers: { Authorization: `Bearer ${c.token}` } } });
  try {
    await client.connect(transport, { timeout: 15_000 });
    ok('token accepted, MCP session opened');
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    if (/401|removed|valid token/i.test(m)) bad(`the token was refused (${m.slice(0, 160)})`, 'open Moovi Settings, Use Claude Code, make a new command, then: claude mcp remove moovi -s user and paste the new command');
    else bad(`MCP connect failed (${m.slice(0, 200)})`, 'docker compose logs --tail 50 worker caddy');
    process.exit(1);
  }
  try {
    const tools = (await client.listTools()).tools.map(t => t.name);
    const need = ['moovi_next', 'moovi_answer'];
    if (need.every(n => tools.includes(n))) ok(`tools: ${tools.join(', ')}`); else bad(`tools missing (${tools.join(', ')})`);
    const prompts = (await client.listPrompts()).prompts.map(p => p.name);
    if (prompts.includes('run')) ok('the /mcp__moovi__run prompt is there'); else bad('no run prompt on the server');
    // 3. what /mcp__moovi__run does, then one short moovi_next (a long poll through the proxy, unbuffered)
    const p = await client.getPrompt({ name: 'run' });
    const ticket = /run ticket (rt_[0-9a-f]+)/.exec((p.messages[0]!.content as { text: string }).text)?.[1];
    if (!ticket) bad('the run prompt carried no ticket');
    const t0 = Date.now();
    const r = await client.callTool({ name: 'moovi_next', arguments: { ticket, wait_s: 3 } }, undefined, { timeout: 30_000 });
    const out = JSON.parse(((r.content as { text?: string }[])[0]?.text) ?? '{}') as { status?: string; message?: string };
    const s = ((Date.now() - t0) / 1000).toFixed(1);
    if (out.status === 'think') ok(`moovi_next handed out a step in ${s} s (a video is waiting: run /mcp__moovi__run in Claude Code to answer it)`);
    else if (out.status) ok(`moovi_next answered "${out.status}" in ${s} s`);
    else bad(`moovi_next gave an unexpected answer: ${JSON.stringify(out).slice(0, 200)}`);
  } catch (e) {
    bad(`a tool call failed (${e instanceof Error ? e.message.slice(0, 200) : e})`, 'docker compose logs --tail 50 worker');
  } finally {
    await client.close().catch(() => undefined);
  }
  console.log(failed ? `${failed} problem(s): fix them, then run this again.` : 'Ready: in Claude Code type /mcp__moovi__run, then start a video on the Moovi website.');
  process.exit(failed ? 1 : 0);
}

await main();
