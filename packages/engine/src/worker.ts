import { hostname } from 'node:os';
import { byokMode, NeedsModelKey, scopeFor } from './keys';
import { withModel } from './runtime';
import { project as P, projectGraph, read } from '@contenteasy/graph';
import { group, head } from './heads';
import { activeProjects, blocking, consumeCommands, dequeue, enqueue, markActive, publish, type Ready } from './bus';
import type { Command } from './commands';
import { config, type Resource } from './config';
import { TaskCtx, desk, type Claimed, type Handler, type RunRow } from './ctx';
import { activity, attributeQueries, inScope, pq, say, status } from './live';
import { keyOf, promote, recover, reopen, runState, spawn, tid } from './scheduler';

/**
 * The worker: one long-running process. Per resource it runs as many loops as the resource has slots; each loop
 * takes a ready task off its queue, claims it in the project graph (with a lease it keeps renewing), runs its
 * handler, and records the outcome: done (+ spawned tasks, + newly ready tasks queued), failed (retried while it has
 * attempts; an optional task fails soft so the run goes on), or parked on a question. A restart re-queues everything.
 */
export interface WorkerOpts {
  handlers: Record<string, Handler>;
  onCommand?: (cmd: Command) => Promise<void>;
  onRunEnd?: (pid: string, run: RunRow, ok: boolean) => Promise<void>;
  consumer?: string;
  /** resources this worker serves (default: all) */
  resources?: Resource[];
}

const json = <T>(s: unknown): T | null => { if (s === null || s === undefined) return null; if (typeof s !== 'string') return s as T; try { return JSON.parse(s) as T; } catch { return null; } };

export async function loadRun(pid: string, runId: string): Promise<RunRow> {
  const [r] = await pq<Record<string, unknown>>(pid, P.run, { id: runId });
  if (!r) throw new Error(`No run ${runId} in project ${pid}`);
  return { id: String(r.id), n: Number(r.n), status: String(r.status), kind: String(r.kind ?? 'make'), parent: (r.parent as string) ?? null,
    request: json(r.request) ?? {}, brief: json(r.brief), skill: (r.skill as string) ?? null, card: json(r.card), match: json(r.match), video: String(r.video), chat: String(r.chat) };
}
const owners = new Map<string, string>();
export async function ownerOf(pid: string): Promise<string> {
  if (!owners.has(pid)) { const [r] = await read<{ owner: string }>(projectGraph(pid), 'owner', 'MATCH (p:Project) RETURN p.owner AS owner LIMIT 1'); if (!r?.owner) throw new Error(`Project ${pid} has no owner`); owners.set(pid, r.owner); }
  return owners.get(pid)!;
}

/** The tasks running in this process, by run: Stop aborts them (their child processes and model calls end with them). */
const live = new Map<string, Set<AbortController>>();
/** Abort every task of a run that runs in this process; returns how many were running. */
export function abortRun(runId: string): number {
  const set = live.get(runId);
  if (!set) return 0;
  for (const a of set) a.abort();
  return set.size;
}

export class Worker {
  private on = true;
  readonly id: string;
  private loops: Promise<void>[] = [];
  constructor(private o: WorkerOpts) { this.id = o.consumer ?? `w-${hostname()}-${process.pid}`; }

  async start() {
    attributeQueries();
    const n = await this.recoverAll();
    console.log(`[engine] worker ${this.id}: re-queued ${n} task(s); slots ${JSON.stringify(config.slots)}`);
    for (const res of this.o.resources ?? (Object.keys(config.slots) as Resource[])) for (let i = 0; i < config.slots[res]; i++) this.loops.push(this.loop(res));
    if (this.o.onCommand) this.loops.push(consumeCommands(this.id, this.o.onCommand, () => !this.on));
    // leases of a dead worker run out later than our start: sweep for them while we live
    this.sweeper = setInterval(() => { void this.recoverAll(false).catch(() => undefined); }, Math.max(2000, config.leaseMs / 2));
  }
  private sweeper: ReturnType<typeof setInterval> | null = null;
  async stop() { this.on = false; if (this.sweeper) clearInterval(this.sweeper); await Promise.allSettled(this.loops); }

  /** full: re-queue ready tasks too (at start); a sweep only takes back the tasks of workers that died */
  async recoverAll(full = true) {
    let n = 0;
    for (const pid of await activeProjects()) {
      try {
        const runs = await pq<{ id: string }>(pid, P.activeRuns);
        if (!runs.length) { await markActive(pid, false); continue; }
        for (const r of runs) n += await recover(pid, r.id, full);
      } catch (e) { console.error(`[engine] recover ${pid}:`, e); }
    }
    return n;
  }

  private async loop(res: Resource) {
    const conn = await blocking();
    while (this.on) {
      let item: Ready | null = null;
      try { item = await dequeue(conn, res, 2); } catch { await new Promise(r => setTimeout(r, 1000)); continue; }
      if (item) await this.execute(item).catch(e => console.error('[engine] task crashed', item, e));
    }
    await conn.quit().catch(() => undefined);
  }

  async execute(item: Ready) {
    const { project: pid, task: id } = item;
    const lease = () => Date.now() + config.leaseMs;
    const [t] = await pq<Claimed>(pid, P.claim, { id, worker: this.id, lease: lease(), at: Date.now() });
    if (!t) return; // someone else has it, or it was cancelled
    const runId = id.slice(0, id.indexOf(':'));
    const run = await loadRun(pid, runId);
    const user = await ownerOf(pid);
    const abort = new AbortController();
    if (!live.has(runId)) live.set(runId, new Set());
    live.get(runId)!.add(abort);
    const ctx = new TaskCtx(pid, user, run, t, abort.signal);
    const agent = desk(t.agent);
    const beat = setInterval(() => { void pq(pid, P.heartbeat, { id, worker: this.id, lease: lease(), note: null }).catch(() => undefined); }, Math.max(5000, config.leaseMs / 3));
    const t0 = Date.now();
    await status(run.chat, agent, id, 'working', head(t.kind, t.scope), group(t.kind));
    await activity(run.chat, agent, id, 'start', t.title, { scope: t.scope ?? undefined });
    await publish(run.chat, { type: 'task', task: { id, kind: t.kind, agent: t.agent, scope: t.scope, title: t.title, status: 'running', attempts: t.attempts } });
    try {
      const handler = this.o.handlers[t.kind];
      if (!handler) throw new Error(`No handler for task kind "${t.kind}"`);
      if (run.status === 'planned') await pq(pid, P.setRun, { id: runId, status: 'running', at: Date.now(), brief: null, skill: null, card: null, match: null, error: null });
      // the task thinks on its owner's own model (bring your own key); CE_BYOK=optional lets a keyless user use this machine's
      const ms = scopeFor(user);
      if (!ms && byokMode() === 'required') throw new NeedsModelKey();
      const go = () => inScope({ project: pid, chat: run.chat, agent, task: id }, () => handler(ctx));
      const out = ms ? await withModel(ms, go) : await go();
      if (out.park) {
        await pq(pid, P.park, { id, question: out.park.question, at: Date.now() });
        await say(pid, run.chat, agent, out.park.text, 'question', { question: out.park.question, choices: out.park.choices, run: runId });
        await status(run.chat, agent, id, 'waiting', 'waiting for your answer');
        await publish(run.chat, { type: 'task', task: { id, kind: t.kind, agent: t.agent, scope: t.scope, title: t.title, status: 'parked', attempts: t.attempts } });
        return;
      }
      if (out.spawn?.length) {
        const known = new Set((await pq<{ id: string }>(pid, P.board, { run: runId })).map(x => keyOf(runId, x.id)));
        await spawn(pid, runId, out.spawn, known);
      }
      await pq(pid, P.finish, { id, output: out.output === undefined ? null : JSON.stringify(out.output), at: Date.now(), note: out.note ?? null });
      if (out.reopen) await reopen(pid, runId, out.reopen.keys, out.reopen.feedback);
      await status(run.chat, agent, id, 'done', 'done');
      await activity(run.chat, agent, id, 'done', out.note ?? t.title, { ms: Date.now() - t0, scope: t.scope ?? undefined });
      await publish(run.chat, { type: 'task', task: { id, kind: t.kind, agent: t.agent, scope: t.scope, title: t.title, status: 'done', attempts: t.attempts } });
      await promote(pid, runId);
      await this.maybeEnd(pid, runId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (abort.signal.aborted) { // Stop: the run is already cancelled (chat.ts); this task just ends, no retry, no failure
        console.log(`[engine] ${id} (${t.kind}) cancelled`);
        await status(run.chat, agent, id, 'done', 'stopped');
        await activity(run.chat, agent, id, 'fail', `${t.title}: stopped`, { ms: Date.now() - t0, scope: t.scope ?? undefined });
        await publish(run.chat, { type: 'task', task: { id, kind: t.kind, agent: t.agent, scope: t.scope, title: t.title, status: 'cancelled', attempts: t.attempts } });
        return;
      }
      console.error(`[engine] ${id} (${t.kind}) failed:`, msg);
      const [f] = await pq<{ status: string }>(pid, P.fail, { id, error: msg.slice(0, 2000), at: Date.now() });
      await status(run.chat, agent, id, f?.status === 'ready' ? 'working' : 'error', f?.status === 'ready' ? 'retrying' : 'failed');
      await activity(run.chat, agent, id, 'fail', `${t.title}: ${msg}`, { ms: Date.now() - t0, scope: t.scope ?? undefined });
      if (f?.status === 'ready') { setTimeout(() => { void enqueue(t.resource, { project: pid, task: id }); }, 3000); return; }
      const [row] = await pq<{ optional: boolean }>(pid, { name: 'taskOptional', ro: true, about: '', cypher: 'MATCH (t:Task {id: $id}) RETURN t.optional AS optional' }, { id });
      if (row?.optional) { // fail soft: the run goes on without it
        await pq(pid, P.finish, { id, output: JSON.stringify({ failed: true, error: msg.slice(0, 400) }), at: Date.now(), note: 'skipped' });
        await promote(pid, runId);
        await this.maybeEnd(pid, runId);
        return;
      }
      await publish(run.chat, { type: 'task', task: { id, kind: t.kind, agent: t.agent, scope: t.scope, title: t.title, status: 'failed', attempts: t.attempts } });
      await pq(pid, P.cancelRun, { run: runId });
      await pq(pid, P.setRun, { id: runId, status: 'failed', error: msg.slice(0, 500), at: Date.now(), brief: null, skill: null, card: null, match: null });
      await say(pid, run.chat, 'moovi', `I couldn’t finish this one: ${t.title.toLowerCase()} failed (${msg.slice(0, 220)}). Ask me to try again, or change the brief.`, 'error');
      await publish(run.chat, { type: 'run', run: { id: runId, n: run.n, status: 'failed' } });
      await this.o.onRunEnd?.(pid, run, false);
    } finally {
      clearInterval(beat);
      live.get(runId)?.delete(abort);
      if (!live.get(runId)?.size) live.delete(runId);
    }
  }

  private async maybeEnd(pid: string, runId: string) {
    const s = await runState(pid, runId);
    if (s.open > 0) return;
    const run = await loadRun(pid, runId);
    if (run.status === 'done' || run.status === 'failed' || run.status === 'cancelled') return;
    await pq(pid, P.setRun, { id: runId, status: s.failed ? 'failed' : 'done', at: Date.now(), brief: null, skill: null, card: null, match: null, error: null });
    await publish(run.chat, { type: 'run', run: { id: runId, n: run.n, status: s.failed ? 'failed' : 'done' } });
    const still = await pq<{ id: string }>(pid, P.activeRuns);
    if (!still.length) await markActive(pid, false);
    await this.o.onRunEnd?.(pid, run, !s.failed);
  }
}

export { tid };
