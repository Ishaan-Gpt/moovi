/**
 * The bridge in one object (bridge items 14 to 17): the store, the step queue, the gate (tickets and leases), presence,
 * the Connect Claude Code tokens and the job board. The MCP endpoint (http.ts, server.ts), the website routes (api.ts)
 * and the engine side (scope.ts, `register`) share one hub per process; across processes they share the store
 * (FalkorDB's Redis side), so the endpoint can run in its own process beside the engine worker. The in-memory store is
 * for tests and MOOVI_GRAPH_OPTIONAL=1 only (DECISIONS.md 13: no silent graph-down fallback on the product path).
 */
import { byokMode, registerBrainHooks, registerBrainScope, serverModel } from '@moovi/engine/keys';
import { currentRun } from '@moovi/engine/brain';
import type { Runtime } from '@moovi/engine/runtime';
import { JobBoard } from './board';
import type { BridgeOptions } from './bridge';
import { Gate } from './lease';
import { StepQueue } from './queue';
import { brainScope, Presence } from './scope';
import { memoryStore, type BrainStore } from './store';
import { connectCommand, TokenStore } from './tokens';

export interface HubOptions {
  now?: () => number;
  /** the website's public origin, for the "your video is ready" link (MOOVI_PUBLIC_URL) */
  publicUrl?: string | null;
}

export class BrainHub {
  readonly queue: StepQueue;
  readonly presence: Presence;
  readonly gate: Gate;
  readonly tokens: TokenStore;
  readonly board: JobBoard;
  readonly now: () => number;
  constructor(readonly store: BrainStore = memoryStore(), o: HubOptions | (() => number) = {}) {
    const opts: HubOptions = typeof o === 'function' ? { now: o } : o;
    this.now = opts.now ?? Date.now;
    const base = (opts.publicUrl ?? '').replace(/\/+$/, '');
    this.queue = new StepQueue(store, this.now);
    this.presence = new Presence(this.now, store);
    this.gate = new Gate(store, this.queue, this.now, u => this.presence.touch(u));
    this.tokens = new TokenStore(store, this.now);
    this.board = new JobBoard(store, this.now, (p, c) => (base ? `${base}/studio/p/${p}/c/${c}` : null));
  }
  connectCommand(mcpUrl: string, token: string) { return connectCommand(mcpUrl, token); }

  /**
   * Plug the bridge into the engine in this process: brain calls of a user whose Claude Code is online go to their
   * queue (laneRuntime), detail calls to their key or Moovi's server model; run starts and ends reach the job board.
   * Returns the unregister function.
   */
  register(o: { server?: Runtime | null; bridge?: Partial<Omit<BridgeOptions, 'queue' | 'user' | 'job'>>; onLane?: (user: string, agent: string, lane: string, why: string) => void } = {}): () => void {
    registerBrainScope((user, own) => brainScope({
      user, own, queue: this.queue, presence: this.presence,
      job: () => currentRun() ?? `job-${user}`,
      server: o.server === undefined ? serverModel() : o.server, byok: byokMode(),
      ...(o.onLane ? { onLane: (agent: string, lane: string, why: string) => o.onLane!(user, agent, lane, why) } : {}),
      bridge: {
        ...(o.bridge ?? {}),
        onEvent: e => { o.bridge?.onEvent?.(e); if (e.type === 'queued') { const job = currentRun(); if (job) void this.board.start({ user, job }).catch(() => undefined); } },
      },
    }));
    registerBrainHooks({
      prime: u => this.presence.prime(u),
      linked: async u => (await this.tokens.status(u)).linked,
      run: async e => {
        if (e.type === 'start') await this.board.start({ user: e.user, job: e.run, project: e.project, chat: e.chat, title: e.title ?? null });
        else await this.board.finish({ job: e.run, ok: e.ok !== false, user: e.user, project: e.project, chat: e.chat, title: e.title ?? null });
      },
    });
    return () => { registerBrainScope(null); registerBrainHooks(null); };
  }
}
