/**
 * The bridge scope (bridge item 12): what `keys.registerBrainScope` gets from the bridge. For a user whose Claude Code
 * is connected, a ModelScope whose runtime is the engine's lane switch: brain calls to `bridgeRuntime` (this package),
 * detail calls to the user's own key or Moovi's server model. Presence: a session that pulled in the last 90 s is
 * online (`seen`), one that pulled before is linked.
 */
import { laneRuntime, type LaneFacts, type ModelScope, type Runtime } from '@moovi/engine/runtime';
import { BRIDGE_PROVIDER } from '@moovi/engine/brain';
import { bridgeRuntime, type BridgeOptions } from './bridge';
import type { StepQueue } from './queue';

export const ONLINE_MS = 90_000;

/** Last pull time per user, kept in memory beside the store (lane facts are read synchronously at every call). */
export class Presence {
  private seen = new Map<string, number>();
  constructor(readonly now: () => number = Date.now) {}
  touch(user: string) { this.seen.set(user, this.now()); }
  forget(user: string) { this.seen.delete(user); }
  state(user: string): LaneFacts['claudeCode'] {
    const t = this.seen.get(user); if (t === undefined) return 'off';
    return this.now() - t <= ONLINE_MS ? 'online' : 'linked';
  }
}

export function brainScope(o: {
  user: string; queue: StepQueue; presence: Presence; job: () => string;
  own: ModelScope | null; server: Runtime | null; byok: LaneFacts['byok'];
  bridge?: Partial<Omit<BridgeOptions, 'queue' | 'user' | 'job'>>;
  onLane?: Parameters<typeof laneRuntime>[0]['onLane'];
}): ModelScope | null {
  if (o.presence.state(o.user) === 'off') return null;
  const brain = bridgeRuntime({ queue: o.queue, user: o.user, job: o.job, ...(o.bridge ?? {}) });
  const runtime = laneRuntime({
    facts: () => ({ claudeCode: o.presence.state(o.user), hasKey: !!o.own, server: !!o.server, byok: o.byok }),
    brain, key: o.own?.runtime ?? null, server: o.server, ...(o.onLane ? { onLane: o.onLane } : {}),
  });
  const base = o.own ?? { models: { director: 'server', crew: 'server', fast: 'server' }, deadlineScale: 1, drawsWell: true };
  return { ...base, runtime, provider: BRIDGE_PROVIDER, ...(o.own?.audio ? { audio: o.own.audio } : {}) } as ModelScope;
}
