// pnpm dev:bridge (or: pnpm --filter @moovi/mcp serve): the Claude Code bridge on MOOVI_BRIDGE_PORT (3200):
//   /mcp               Claude Code connects here (claude mcp add --transport http ... --header "Authorization: Bearer ...")
//   /connect           a plain page that makes the connect command for the user signed in to Moovi in this browser
//   /api/brain/link    POST mints the token (shown once), DELETE disconnects;  /api/brain/status  the online pill
// By default the engine worker runs in this same process with the bridge plugged in, so run this INSTEAD of
// `pnpm dev:engine` (MOOVI_BRIDGE_WORKER=0 serves the bridge alone). FalkorDB is required (DECISIONS.md 13).
import { sessionUser } from '@moovi/engine';
import { loadModel } from '@moovi/engine/keys';
import { BrainHub, bridgeApp, falkorStore, memoryStore, sessionCookieAuth, type BrainStore } from '../src/index';

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
const hub = new BrainHub(store, { publicUrl: process.env.MOOVI_PUBLIC_URL ?? 'http://localhost:3000' });
const fixed = process.env.MOOVI_BRIDGE_URL?.trim();
const app = bridgeApp(hub, {
  userOf: sessionCookieAuth({ lookup: t => sessionUser(t), origins: (process.env.MOOVI_ORIGINS ?? '').split(',').map(s => s.trim()).filter(Boolean) }),
  ...(fixed ? { mcpUrl: () => fixed } : {}),
  hasKey: u => !!loadModel(u),
  log: line => console.log(line),
});
await new Promise<void>(res => app.http.listen(port, host, res));
// the sign-in cookie of the website on localhost reaches this port only under the same host name, so print localhost
const shown = host === '0.0.0.0' || host === '127.0.0.1' || host === '::1' ? 'localhost' : host;
console.log(`[bridge] Claude Code bridge on http://${shown}:${port}/mcp · connect page http://${shown}:${port}/connect (open it in the browser you are signed in to Moovi with)`);
if (process.env.MOOVI_BRIDGE_WORKER !== '0') {
  hub.register();
  console.log('[bridge] engine worker starting in this process (brain calls of connected users go to their Claude Code)');
  await import('../../engine/scripts/worker');
}
