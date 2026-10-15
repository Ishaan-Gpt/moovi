import { project as P } from '@moovi/graph';
import { enqueue, markActive, publish } from './bus';
import type { Resource } from './config';
import { pq } from './live';

/**
 * The scheduler's graph side (Vignesh's planner/executor, ported onto the project graph):
 * - a run's tasks live in its project graph; a task id is `<run>:<key>` (keys like "build:3", "render:0-180"), so
 *   dependencies are written by key and nothing is looked up;
 * - a task is ready when everything it depends on is done (`promote`), and is then queued on its resource;
 * - fan-out stages (one task per research question, asset request, scene, render chunk) are spawned by the task that
 *   knows the items; tasks that `waits` for a stage get a dependency on every task it spawns;
 * - a send-back re-opens exactly the tasks it names (`reopen`), so only the affected scene, its chunks and the mix redo.
 */
export interface TaskSpec {
  key: string; kind: string; agent: string; resource: Resource; title: string;
  scope?: string | null; input?: unknown; max?: number; optional?: boolean;
  /** keys (or full ids) of tasks in the same run this one waits on */
  deps?: string[];
  /** fan-out stage kinds this task waits for (it gets a dependency on each task they spawn) */
  waits?: string[];
  /** arrive done (an edit run copies unchanged work forward) */
  done?: { output: unknown };
}

export const tid = (run: string, key: string) => (key.includes(':') && key.startsWith(`${run}:`) ? key : `${run}:${key}`);
export const keyOf = (run: string, id: string) => id.slice(run.length + 1);

export async function addTasks(pid: string, run: string, specs: TaskSpec[], existing: Set<string> = new Set()) {
  if (!specs.length) return [];
  const at = Date.now();
  await pq(pid, P.createTasks, {
    run, at, tasks: specs.map(s => ({
      id: tid(run, s.key), kind: s.kind, agent: s.agent, resource: s.resource, scope: s.scope ?? null, title: s.title, max: s.max ?? 2,
      input: s.input === undefined ? null : JSON.stringify(s.input), waits: s.waits ?? [], optional: !!s.optional,
      status: s.done ? 'done' : null, output: s.done ? JSON.stringify(s.done.output ?? null) : null,
    })),
  });
  const keys = new Set([...existing, ...specs.map(s => s.key)]);
  const deps = specs.flatMap(s => (s.deps ?? []).filter(d => keys.has(d) || d.startsWith(`${run}:`)).map(d => ({ task: tid(run, s.key), on: tid(run, d) })));
  if (deps.length) await pq(pid, P.taskDeps, { deps });
  return specs.map(s => tid(run, s.key));
}

/** Spawn fan-out tasks: they join the run, and every task that waits for their stage now depends on them. */
export async function spawn(pid: string, run: string, specs: TaskSpec[], known: Set<string>) {
  await addTasks(pid, run, specs, known);
  for (const kind of new Set(specs.map(s => s.kind))) {
    const waiting = await pq<{ id: string }>(pid, P.waitingFor, { run, kind });
    const ids = specs.filter(s => s.kind === kind).map(s => tid(run, s.key));
    const deps = waiting.flatMap(w => ids.filter(i => i !== w.id).map(on => ({ task: w.id, on })));
    if (deps.length) await pq(pid, P.taskDeps, { deps });
  }
}

/** Every waiting task whose dependencies are done becomes ready and is queued on its resource. */
export async function promote(pid: string, run: string) {
  const ready = await pq<{ id: string; kind: string; resource: string }>(pid, P.promote, { run, at: Date.now() });
  for (const t of ready) await enqueue(t.resource, { project: pid, task: t.id });
  return ready;
}

/** After a restart: ready tasks are queued again; tasks whose worker died (lease ran out) go back to ready. */
export async function recover(pid: string, run: string, full = true) {
  const expired = await pq<{ id: string; resource: string }>(pid, P.expired, { run, now: Date.now() });
  const ready = full ? await pq<{ id: string; resource: string }>(pid, P.readyTasks, { run }) : [];
  for (const t of [...expired, ...ready]) await enqueue(t.resource, { project: pid, task: t.id });
  if (full) await promote(pid, run);
  return expired.length + ready.length;
}

/** Is the run over? (nothing waiting, ready, running or parked) */
export async function runState(pid: string, run: string) {
  const [r] = await pq<{ open: number; failed: number; total: number }>(pid, P.runOpen, { run });
  return r ?? { open: 0, failed: 0, total: 0 };
}

export async function reopen(pid: string, run: string, keys: string[], feedback: Record<string, string> = {}) {
  // a list of rows, not a map: task ids contain ':' and can't be map keys in a Cypher parameter
  const rows = keys.map(k => ({ id: tid(run, k), feedback: feedback[k] ?? null }));
  await pq(pid, P.reopenIds, { run, rows });
}

export async function setActive(pid: string, chat: string, on: boolean) {
  await markActive(pid, on);
  void chat; void publish;
}
