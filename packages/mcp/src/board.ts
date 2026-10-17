/**
 * The job board (bridge item 16): what `/mcp__moovi__run` needs to know about the user's videos besides their steps, written
 * by the engine side (keys.brainRun from the worker: a run starts, a run ends) and read by the MCP side, so
 * `moovi_next` can say "Moovi is working on it" between steps and "your video is ready" with its link at the end.
 */
import { KEY, type BrainStore } from './store';

export const JOB_TTL_MS = 24 * 3600_000;
export const JOBS_KEPT = 20;

export interface JobInfo {
  job: string; user: string; project: string | null; chat: string | null;
  state: 'running' | 'done' | 'failed';
  title: string | null; url: string | null;
  startedAt: number; endedAt: number | null;
  /** a failed job's short reason, the same words the studio chat shows (absent on older rows) */
  error?: string | null;
}

export class JobBoard {
  constructor(readonly store: BrainStore, readonly now: () => number = Date.now, readonly urlOf: (project: string, chat: string) => string | null = () => null) {}

  async get(job: string): Promise<JobInfo | null> { const v = await this.store.get(KEY.job(job)); return v ? JSON.parse(v) as JobInfo : null; }
  private async put(j: JobInfo) { await this.store.set(KEY.job(j.job), JSON.stringify(j), JOB_TTL_MS); }

  async start(o: { user: string; job: string; project?: string | null; chat?: string | null; title?: string | null }): Promise<JobInfo> {
    const cur = await this.get(o.job);
    if (cur && cur.state === 'running') return cur;
    const project = o.project ?? null, chat = o.chat ?? null;
    const j: JobInfo = { job: o.job, user: o.user, project, chat, state: 'running', title: o.title ?? null, url: project && chat ? this.urlOf(project, chat) : null, startedAt: this.now(), endedAt: null };
    await this.put(j);
    await this.store.remove(KEY.jobs(o.user), o.job);
    await this.store.push(KEY.jobs(o.user), o.job);
    const all = await this.store.range(KEY.jobs(o.user));
    for (const old of all.slice(0, Math.max(0, all.length - JOBS_KEPT))) await this.store.remove(KEY.jobs(o.user), old);
    return j;
  }

  async finish(o: { job: string; ok: boolean; user?: string; project?: string | null; chat?: string | null; title?: string | null; error?: string | null }): Promise<JobInfo | null> {
    const cur = await this.get(o.job) ?? (o.user ? await this.start({ user: o.user, job: o.job, project: o.project ?? null, chat: o.chat ?? null }) : null);
    if (!cur) return null;
    const j: JobInfo = { ...cur, state: o.ok ? 'done' : 'failed', title: o.title ?? cur.title, endedAt: this.now(), error: o.ok ? null : (o.error ?? '').trim().slice(0, 300) || null };
    await this.put(j);
    return j;
  }

  /** the user's recent jobs, newest last */
  async recent(user: string): Promise<JobInfo[]> {
    const ids = await this.store.range(KEY.jobs(user));
    const out: JobInfo[] = [];
    for (const id of ids) { const j = await this.get(id); if (j) out.push(j); else await this.store.remove(KEY.jobs(user), id); }
    return out;
  }
  async running(user: string): Promise<JobInfo[]> { return (await this.recent(user)).filter(j => j.state === 'running'); }
}
