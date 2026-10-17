/**
 * The bridge in one object (bridge items 14 to 17): the store, the step queue, the gate (tickets and leases), presence,
 * and later the tokens and the job board. The MCP endpoint (http.ts, server.ts) and the engine side (scope.ts) share
 * one hub per process; across processes they share the store (FalkorDB's Redis side), so the endpoint can run in its
 * own process beside the engine worker.
 */
import { Gate } from './lease';
import { StepQueue } from './queue';
import { Presence } from './scope';
import { memoryStore, type BrainStore } from './store';

export class BrainHub {
  readonly queue: StepQueue;
  readonly presence: Presence;
  readonly gate: Gate;
  constructor(readonly store: BrainStore = memoryStore(), readonly now: () => number = Date.now) {
    this.queue = new StepQueue(store, now);
    this.presence = new Presence(now);
    this.gate = new Gate(store, this.queue, now, u => this.presence.touch(u));
  }
}
