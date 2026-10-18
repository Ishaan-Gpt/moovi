/**
 * The bridge's storage: a few string keys with expiry and per-user lists, on FalkorDB's Redis side (the bus the engine
 * already uses, keys under `ce:brain:`), or in memory for tests and a single-process dev server. Only what the queue,
 * the memo and the leases need; values are JSON strings.
 */
export interface BrainStore {
  get(key: string): Promise<string | null>;
  /** ttlMs 0 = no expiry */
  set(key: string, value: string, ttlMs?: number): Promise<void>;
  /** set only when absent (a lease, a lock); true when this call set it */
  setNx(key: string, value: string, ttlMs: number): Promise<boolean>;
  del(key: string): Promise<void>;
  push(list: string, value: string): Promise<void>;
  /** take the oldest item, or null */
  shift(list: string): Promise<string | null>;
  /** drop every copy of a value from a list */
  remove(list: string, value: string): Promise<void>;
  range(list: string): Promise<string[]>;
}

export const KEY = {
  step: (id: string) => `ce:brain:step:${id}`,
  queue: (user: string) => `ce:brain:q:${user}`,
  memo: (user: string, fp: string) => `ce:brain:memo:${user}:${fp}`,
  lease: (job: string) => `ce:brain:lease:${job}`,
  seen: (user: string) => `ce:brain:seen:${user}`,
  ticket: (t: string) => `ce:brain:ticket:${t}`,
  pick: (step: string) => `ce:brain:pick:${step}`,
  token: (hash: string) => `ce:brain:token:${hash}`,
  link: (user: string) => `ce:brain:link:${user}`,
  job: (job: string) => `ce:brain:job:${job}`,
  jobs: (user: string) => `ce:brain:jobs:${user}`,
  /** the user's picked, not yet answered steps (a dropped window's step is handed to the window that takes over) */
  held: (user: string) => `ce:brain:held:${user}`,
  /** the last lane decision of the user's brain calls (hub.register onLane): which brain made the video's decisions */
  lane: (user: string) => `ce:brain:lane:${user}`,
  /** until when a background Claude Code that was just started (command 2) is expected to call in (scope.ts Presence) */
  expect: (user: string) => `ce:brain:expect:${user}`,
};

/** In memory (tests, one process). `now` is injectable so expiry is testable without waiting. */
export function memoryStore(now: () => number = Date.now): BrainStore {
  const kv = new Map<string, { v: string; until: number }>(), lists = new Map<string, string[]>();
  const live = (k: string) => { const e = kv.get(k); if (!e) return null; if (e.until && e.until <= now()) { kv.delete(k); return null; } return e; };
  return {
    async get(k) { return live(k)?.v ?? null; },
    async set(k, v, ttl = 0) { kv.set(k, { v, until: ttl ? now() + ttl : 0 }); },
    async setNx(k, v, ttl) { if (live(k)) return false; kv.set(k, { v, until: now() + ttl }); return true; },
    async del(k) { kv.delete(k); lists.delete(k); },
    async push(l, v) { (lists.get(l) ?? lists.set(l, []).get(l)!).push(v); },
    async shift(l) { return lists.get(l)?.shift() ?? null; },
    async remove(l, v) { const a = lists.get(l); if (a) lists.set(l, a.filter(x => x !== v)); },
    async range(l) { return [...(lists.get(l) ?? [])]; },
  };
}

/** The subset of a node-redis client the store uses (so tests need no server and the type stays narrow). */
export interface RedisLike {
  get(k: string): Promise<string | null>;
  set(k: string, v: string, o?: { PX?: number; NX?: boolean }): Promise<unknown>;
  del(k: string): Promise<unknown>;
  rPush(k: string, v: string): Promise<unknown>;
  lPop(k: string): Promise<string | null>;
  lRem(k: string, n: number, v: string): Promise<unknown>;
  lRange(k: string, a: number, b: number): Promise<string[]>;
}

export function redisStore(c: RedisLike): BrainStore {
  return {
    get: k => c.get(k),
    async set(k, v, ttl = 0) { await c.set(k, v, ttl ? { PX: ttl } : undefined); },
    async setNx(k, v, ttl) { return (await c.set(k, v, { PX: ttl, NX: true })) === 'OK'; },
    async del(k) { await c.del(k); },
    async push(l, v) { await c.rPush(l, v); },
    shift: l => c.lPop(l),
    async remove(l, v) { await c.lRem(l, 0, v); },
    range: l => c.lRange(l, 0, -1),
  };
}
