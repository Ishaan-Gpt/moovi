/**
 * The long poll (bridge item 14). A Claude Code HTTP tool call needs its first byte within 60 s and is dropped after 5 min
 * with no response or progress (code.claude.com/docs/en/mcp). So a waiting tool call checks for work every `everyMs`,
 * reports progress every `progressMs` (10 s) while it waits, and returns by `waitMs` (45 s at most) with or without work.
 */
export const WAIT_MAX_MS = 45_000;
export const PROGRESS_MS = 10_000;
export const POLL_EVERY_MS = 500;

export interface LongPoll<T> {
  /** one look for work: a value ends the wait, null keeps waiting */
  attempt: () => Promise<T | null>;
  waitMs: number;
  everyMs?: number;
  progressMs?: number;
  /** called every progressMs while waiting, with the seconds waited so far (always increasing, as MCP progress must) */
  onProgress?: (waitedS: number) => Promise<void> | void;
  signal?: AbortSignal;
  now?: () => number;
}

const pause = (ms: number, signal?: AbortSignal) => new Promise<void>(res => {
  if (signal?.aborted) return res();
  const t = setTimeout(done, ms);
  function done() { clearTimeout(t); signal?.removeEventListener('abort', done); res(); }
  signal?.addEventListener('abort', done, { once: true });
});

/** Waits for work up to waitMs (capped at WAIT_MAX_MS); null when none came in time or the caller went away. */
export async function longPoll<T>(o: LongPoll<T>): Promise<T | null> {
  const now = o.now ?? Date.now;
  const waitMs = Math.max(0, Math.min(o.waitMs, WAIT_MAX_MS)), everyMs = o.everyMs ?? POLL_EVERY_MS, progressMs = o.progressMs ?? PROGRESS_MS;
  const t0 = now();
  let lastProgress = t0;
  for (;;) {
    const got = await o.attempt();
    if (got !== null) return got;
    const waited = now() - t0;
    if (waited >= waitMs || o.signal?.aborted) return null;
    if (o.onProgress && now() - lastProgress >= progressMs) {
      lastProgress = now();
      try { await o.onProgress(waited / 1000); } catch { /* a progress note that cannot be sent never ends the wait */ }
    }
    await pause(Math.min(everyMs, waitMs - waited), o.signal);
  }
}
