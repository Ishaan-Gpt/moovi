// pnpm dev:bridge (or: pnpm --filter @moovi/mcp serve): the Claude Code bridge on MOOVI_BRIDGE_PORT (3200):
//   /mcp               Claude Code connects here (claude mcp add --transport http ... --header "Authorization: Bearer ...")
//   /connect           a plain page that makes the connect command for the user signed in to Moovi in this browser
//   /api/brain/link    POST mints the token (shown once), DELETE disconnects;  /api/brain/status  the online pill
// By default the engine worker runs in this same process with the bridge plugged in, so run this INSTEAD of
// `pnpm dev:engine` (MOOVI_BRIDGE_WORKER=0 serves the bridge alone). FalkorDB is required (DECISIONS.md 13).
import { sessionUser } from '@moovi/engine';
import { loadModel } from '@moovi/engine/keys';
import { project as P, projectGraph, run as runQ } from '../../graph/src/index';
import { alsoOnIpv6Loopback, BrainHub, bridgeApp, corsOrigins, falkorStore, memoryStore, sessionCookieAuth, type BrainStore } from '../src/index';

const port = Number(process.env.MOOVI_BRIDGE_PORT ?? 3200), host = process.env.MOOVI_BRIDGE_HOST ?? '127.0.0.1';
let store: BrainStore;
try {
  store = (await falkorStore()).store;
} catch (e) {
  if (process.env.MOOVI_GRAPH_OPTIONAL !== '1') {
    console.error(`[bridge] FalkorDB is not reachable (${e instanceof Error ? e.message : e}). Start it (pnpm falkordb) and set FALKORDB_URL.`);
    process.exit(1);
  }
  console.warn('[bridge] MOOVI_GRAPH_OPTIONAL=1: steps and tokens live in memory and are lost on restart (local dev only)');
  store = memoryStore();
}
// the board asks the graph for a run's status, so a video stopped on the website ends for Claude Code too
const runStatus = async (project: string, run: string) => (await runQ<{ status: string }>(projectGraph(project), P.run, { id: run }))[0]?.status ?? null;
const hub = new BrainHub(store, { publicUrl: process.env.MOOVI_PUBLIC_URL ?? 'http://localhost:3000', runStatus });
const fixed = process.env.MOOVI_BRIDGE_URL?.trim();
// pages that may call /api/brain/* with the user's cookie: MOOVI_ORIGINS, and in local dev the studio on another
// localhost port (its Settings card "Use Claude Code")
const origins = (process.env.MOOVI_ORIGINS ?? '').split(',').map(s => s.trim()).filter(Boolean);
const devSite = process.env.NODE_ENV === 'production' ? [] : ['http://localhost:3000', 'http://localhost:3100'];
const app = bridgeApp(hub, {
  userOf: sessionCookieAuth({ lookup: t => sessionUser(t), origins: [...origins, ...devSite] }),
  cors: corsOrigins(origins),
  ...(fixed ? { mcpUrl: () => fixed } : {}),
  hasKey: u => !!loadModel(u),
  log: line => console.log(line),
});
await new Promise<void>(res => app.http.listen(port, host, res));
// the default loopback also answers on ::1, where Windows resolves the printed localhost first (alsoOnIpv6Loopback)
if (host === '127.0.0.1' && await alsoOnIpv6Loopback(app.http, port)) console.log(`[bridge] also listening on [::1]:${port} (localhost on Windows)`);
// the sign-in cookie of the website on localhost reaches this port only under the same host name, so print localhost
const shown = host === '0.0.0.0' || host === '127.0.0.1' || host === '::1' ? 'localhost' : host;
console.log(`[bridge] Claude Code bridge on http://${shown}:${port}/mcp · connect page http://${shown}:${port}/connect (open it in the browser you are signed in to Moovi with)`);
if (process.env.MOOVI_BRIDGE_WORKER !== '0') {
  hub.register();
  console.log('[bridge] engine worker starting in this process (brain calls of connected users go to their Claude Code)');
  await import('../../engine/scripts/worker');
}
