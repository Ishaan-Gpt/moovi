/**
 * The bridge scope (bridge item 12): what `keys.registerBrainScope` gets from the bridge. For a user whose Claude Code
 * is connected, a ModelScope whose runtime is the engine's lane switch: brain calls to `bridgeRuntime` (this package),
 * detail calls to the user's own key or Moovi's server model. Presence: a session that pulled in the last 90 s is
 * online (`seen`), one that pulled before is linked.
 */
import { laneRuntime, WAIT_MS, type LaneFacts, type ModelScope, type Runtime } from '@moovi/engine/runtime';
import { BRIDGE_PROVIDER } from '@moovi/engine/brain';
import { bridgeRuntime, type BridgeOptions } from './bridge';
import type { StepQueue } from './queue';
import { KEY, type BrainStore } from './store';

export const ONLINE_MS = 90_000;

/**
 * Last pull time per user. Lane facts are read synchronously at every call, so the reading lives in memory; with a
 * store it is also written there (`ce:brain:seen:<user>`), so a process that does not serve /mcp itself (the engine
 * worker) learns it with `prime(user)` before a job picks its scope (keys.primeBrainScope).
 */
export const SEEN_TTL_MS = 30 * 24 * 3600_000;
export const WRITE_EVERY_MS = 10_000;
export class Presence {
  private seen = new Map<string, number>();
  constructor(readonly now: () => number = Date.now, readonly store?: BrainStore) {}
  private written = new Map<string, number>();
  touch(user: string) {
    const t = this.now();
    this.seen.set(user, t);
    // a waiting window pulls every half second; the shared reading only needs to be fresh well inside ONLINE_MS
    if (this.store && t - (this.written.get(user) ?? -Infinity) >= WRITE_EVERY_MS) {
      this.written.set(user, t);
      void this.store.set(KEY.seen(user), String(t), SEEN_TTL_MS).catch(() => undefined);
    }
  }
  /** a user who connected Claude Code (a live token) but whose Claude Code has not pulled yet counts as linked, so a
   * keyless user's video waits for their /mcp__moovi__run instead of being refused (MOOVI_BYOK=required) */
  link(user: string) { if (!this.seen.has(user)) this.seen.set(user, this.now() - ONLINE_MS - 1); }
  forget(user: string) { this.seen.delete(user); this.written.delete(user); void this.store?.del(KEY.seen(user)).catch(() => undefined); }
  /** read the shared reading (newest wins); a store that cannot be read leaves the local reading as it is */
  async prime(user: string): Promise<void> {
    if (!this.store) return;
    const v = await this.store.get(KEY.seen(user)).catch(() => null);
    const t = v === null ? NaN : Number(v);
    if (Number.isFinite(t) && t > (this.seen.get(user) ?? -Infinity)) this.seen.set(user, t);
  }
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
  // the wait lane: the same queue and memo, a longer pickup window (no key and no server model may take the call)
  const waitBrain = bridgeRuntime({ queue: o.queue, user: o.user, job: o.job, ...(o.bridge ?? {}), pickupMs: o.bridge?.waitMs ?? WAIT_MS });
  const runtime = laneRuntime({
    facts: () => ({ claudeCode: o.presence.state(o.user), hasKey: !!o.own, server: !!o.server, byok: o.byok }),
    brain, waitBrain, key: o.own?.runtime ?? null, server: o.server, ...(o.onLane ? { onLane: o.onLane } : {}),
    // a step's 'brain' (and the tier names) become the lane's own model ids; the server lane uses this machine's config
    ...(o.own?.models ? { models: { key: o.own.models } } : {}),
  });
  // no key of their own: the tiers keep their logical names, which the lane turns into the server's model ids (the
  // literal 'server' went to the provider as a model id: "model: server" 404, the Launch writer on a keyless user with
  // Claude Code linked, local e2e 2026-10-18). Claude Code ignores the model; it answers with its own.
  const base = o.own ?? { models: { director: 'director', crew: 'crew', fast: 'fast' }, deadlineScale: 1, drawsWell: true };
  return { ...base, runtime, provider: BRIDGE_PROVIDER, ...(o.own?.audio ? { audio: o.own.audio } : {}) } as ModelScope;
}
