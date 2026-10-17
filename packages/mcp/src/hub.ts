/**
 * The bridge in one object (bridge items 14 to 17): the store, the step queue, the gate (tickets and leases), presence,
 * the Connect Claude Code tokens and the job board. The MCP endpoint (http.ts, server.ts), the website routes (api.ts)
 * and the engine side (scope.ts) share one hub per process; across processes they share the store (FalkorDB's Redis
 * side), so the endpoint can run in its own process beside the engine worker. The in-memory store is for tests and
 * MOOVI_GRAPH_OPTIONAL=1 only (DECISIONS.md 13: no silent graph-down fallback on the product path).
 */
import { Gate } from './lease';
import { StepQueue } from './queue';
import { Presence } from './scope';
import { memoryStore, type BrainStore } from './store';
import { connectCommand, TokenStore } from './tokens';

export class BrainHub {
  readonly queue: StepQueue;
  readonly presence: Presence;
  readonly gate: Gate;
  readonly tokens: TokenStore;
  constructor(readonly store: BrainStore = memoryStore(), readonly now: () => number = Date.now) {
    this.queue = new StepQueue(store, now);
    this.presence = new Presence(now, store);
    this.gate = new Gate(store, this.queue, now, u => this.presence.touch(u));
    this.tokens = new TokenStore(store, now);
  }
  connectCommand(mcpUrl: string, token: string) { return connectCommand(mcpUrl, token); }
}
