/**
 * The tasks running in this process, by resource (worker.ts counts them). A background job that must never slow a user's
 * job (the Edit MP4, router/edit.ts) asks `othersBusy` between its steps and waits in `whenOthersIdle`.
 */
const running = new Map<string, number>();

export function taskRunning(resource: string, on: boolean): void {
  running.set(resource, Math.max(0, (running.get(resource) ?? 0) + (on ? 1 : -1)));
}

/** Is any task of another resource running? */
export const othersBusy = (mine: string): boolean => [...running].some(([r, n]) => r !== mine && n > 0);

/** Resolves once no task of another resource runs (checked every `everyMs`); rejects when `signal` aborts. */
export function whenOthersIdle(mine: string, signal?: AbortSignal, everyMs = 500): Promise<void> {
  return new Promise((res, rej) => {
    const tick = () => {
      if (signal?.aborted) return rej(new Error('stopped'));
      if (!othersBusy(mine)) return res();
      setTimeout(tick, everyMs);
    };
    tick();
  });
}
