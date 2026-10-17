/**
 * The bridge server assembled (bridge item 18): `/mcp` for Claude Code, `/api/brain/link` and `/api/brain/status` for
 * the website, `/connect` (a plain page that mints the token for the signed-in user until the studio's own Connect
 * card exists) and `/healthz`. `scripts/serve.ts` runs it; tests and the end to end proof build it the same way.
 */
import type { Server } from 'node:http';
import { createClient } from 'redis';
import { brainApi, sessionCookieAuth, type BrainApiOptions } from './api';
import { bridgeHttp, mcpHandler, webRoute, type McpHandler } from './http';
import type { BrainHub } from './hub';
import { buildMcp } from './server';
import { redisStore, type BrainStore, type RedisLike } from './store';

export interface BridgeApp { http: Server; mcp: McpHandler; close: () => Promise<void> }

export function bridgeApp(hub: BrainHub, o: { userOf: BrainApiOptions['userOf']; mcpUrl?: BrainApiOptions['mcpUrl']; hasKey?: (user: string) => boolean; cors?: BrainApiOptions['cors']; log?: (line: string) => void }): BridgeApp {
  const mcp = mcpHandler({ verify: t => hub.tokens.verify(t), build: ctx => buildMcp(hub, ctx), ...(o.log ? { log: o.log } : {}) });
  const api = brainApi({ hub, userOf: o.userOf, ...(o.mcpUrl ? { mcpUrl: o.mcpUrl } : {}), ...(o.hasKey ? { hasKey: o.hasKey } : {}), ...(o.cors ? { cors: o.cors } : {}) });
  const page = webRoute(async req => {
    const p = new URL(req.url).pathname.replace(/\/+$/, '');
    if (req.method !== 'GET' || (!p.endsWith('/connect') && !p.endsWith('/api/brain/connect'))) return null;
    return new Response(CONNECT_PAGE, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
  });
  const http = bridgeHttp({ mcp, routes: [webRoute(r => api.handle(r)), page] });
  return { http, mcp, close: async () => { await mcp.close(); await new Promise<void>(res => http.close(() => res())); } };
}

/** The store on FalkorDB's Redis side (DECISIONS.md 13: the bridge needs the graph up; no memory fallback here). */
export async function falkorStore(url = process.env.FALKORDB_URL ?? 'falkor://127.0.0.1:6380'): Promise<{ store: BrainStore; quit: () => Promise<void> }> {
  const c = createClient({ url: url.replace(/^falkors?:/, m => (m === 'falkors:' ? 'rediss:' : 'redis:')), socket: { connectTimeout: 3000, reconnectStrategy: n => Math.min(n * 200, 3000) } });
  c.on('error', () => undefined);
  await c.connect();
  return { store: redisStore(c as unknown as RedisLike), quit: async () => { await c.quit().catch(() => undefined); } };
}

export { sessionCookieAuth };

const CONNECT_PAGE = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Connect Claude Code to Moovi</title>
<style>body{font:16px/1.5 system-ui,sans-serif;max-width:720px;margin:40px auto;padding:0 16px;color:#111}code,pre{background:#f3f3f3;border-radius:6px}pre{padding:12px;white-space:pre-wrap;word-break:break-all}button{font:inherit;padding:8px 14px;border-radius:8px;border:1px solid #111;background:#111;color:#fff;cursor:pointer}.muted{color:#666}</style></head>
<body><h1>Connect Claude Code to Moovi</h1>
<p class="muted">Sign in to Moovi in this browser first. A new token replaces the old one.</p>
<p><button id="go">Make my connect command</button> <button id="off" style="background:#fff;color:#111">Disconnect</button></p>
<div id="out"></div><p id="st" class="muted"></p>
<script>
const out=document.getElementById('out'),st=document.getElementById('st'),base=location.pathname.replace(/\\/(api\\/brain\\/)?connect\\/?$/,'');
async function status(){const r=await fetch(base+'/api/brain/status');if(!r.ok){st.textContent='Not signed in to Moovi in this browser.';return}const s=await r.json();st.textContent=s.linked?('Linked (token ending '+s.token_last4+'), Claude Code '+(s.online?'online':'offline')):'Not linked yet.'}
document.getElementById('go').onclick=async()=>{const r=await fetch(base+'/api/brain/link',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});const j=await r.json();if(!r.ok){out.textContent=j.error||'Could not make a token';return}
out.innerHTML='<p>1. Run this once in a terminal (it works from every folder):</p><pre></pre><p>2. In Claude Code type <code>/mcp__moovi__run</code>, then start your video on the Moovi website.</p><p class="muted">This command is shown once. Keep it private: it lets a Claude Code work on your videos.</p>';out.querySelector('pre').textContent=j.command;status()};
document.getElementById('off').onclick=async()=>{await fetch(base+'/api/brain/link',{method:'DELETE'});out.textContent='Disconnected.';status()};
status();
</script></body></html>`;
