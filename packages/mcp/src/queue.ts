/**
 * The step queue and the memo (bridge item 8). A brain step waits here for the user's Claude Code; its answer comes back
 * here; an accepted answer is remembered for 24 h by the step's fingerprint, so running the same job again (a retry, a
 * resume from another session, a second folder) asks Claude Code nothing it has already answered.
 */
import { createHash, randomBytes } from 'node:crypto';
import { KEY, type BrainStore } from './store';

export const MEMO_TTL_MS = 24 * 3600_000;
export const STEP_TTL_MS = 3600_000;
export const MEMO_VERSION = 'brain-memo/1';

export type StepState = 'queued' | 'picked' | 'answered' | 'expired' | 'cancelled';
export interface ThinkStep {
  id: string; user: string; job: string;
  /** a BRAIN_AGENTS name: direct:edit, direct:film, direct:look */
  agent: string;
  system: string; prompt: string;
  /** the answer's JSON Schema */
  schema: Record<string, unknown> | null;
  images?: { mime: 'image/jpeg' | 'image/png'; data: string; label: string }[];
  /** the one re-ask: the last answer and what was wrong with it */
  history?: { role: 'user' | 'assistant'; text: string }[];
  /** the most output tokens the answer may use (runtime/budget.ts) */
  maxOut?: number;
  fp: string; attempt: number;
  state: StepState; createdAt: number; pickedAt: number | null; answeredAt: number | null;
  /** the session (lease holder) that picked it */
  pickedBy?: string | null;
  answer?: string | null;
}

/** The fingerprint of what a step asks: the same question gives the same key, any change in it a new one. */
export function fingerprint(s: Pick<ThinkStep, 'agent' | 'system' | 'prompt' | 'schema' | 'images' | 'history'>): string {
  const imgs = (s.images ?? []).map(i => createHash('sha256').update(i.data).digest('hex'));
  return createHash('sha256').update(JSON.stringify([MEMO_VERSION, s.agent, s.system, s.prompt, s.schema ?? null, imgs, s.history ?? []])).digest('hex').slice(0, 32);
}

export const newStepId = () => `st_${randomBytes(6).toString('hex')}`;

export class StepQueue {
  constructor(readonly store: BrainStore, readonly now: () => number = Date.now) {}

  async get(id: string): Promise<ThinkStep | null> { const v = await this.store.get(KEY.step(id)); return v ? JSON.parse(v) as ThinkStep : null; }
  private async put(s: ThinkStep) { await this.store.set(KEY.step(s.id), JSON.stringify(s), STEP_TTL_MS); }

  /** Queue a step for the user's Claude Code. */
  async push(o: Omit<ThinkStep, 'id' | 'fp' | 'state' | 'createdAt' | 'pickedAt' | 'answeredAt' | 'attempt'> & { attempt?: number }): Promise<ThinkStep> {
    const s: ThinkStep = { ...o, id: newStepId(), fp: fingerprint(o), attempt: o.attempt ?? 1, state: 'queued', createdAt: this.now(), pickedAt: null, answeredAt: null, pickedBy: null, answer: null };
    await this.put(s);
    await this.store.push(KEY.queue(s.user), s.id);
    return s;
  }

  /** The user's oldest queued step, marked picked by `session`; null when there is none. Expired ids are skipped. */
  async next(user: string, session: string, filter?: (s: ThinkStep) => boolean | Promise<boolean>): Promise<ThinkStep | null> {
    const ids = await this.store.range(KEY.queue(user));
    for (const id of ids) {
      const s = await this.get(id);
      if (!s || s.state !== 'queued') { await this.store.remove(KEY.queue(user), id); continue; }
      if (filter && !(await filter(s))) continue;
      // exactly once, even with two pollers at the same moment: the first to set the pick key owns the step
      if (!(await this.store.setNx(KEY.pick(id), session, STEP_TTL_MS))) continue;
      await this.store.remove(KEY.queue(user), id);
      s.state = 'picked'; s.pickedAt = this.now(); s.pickedBy = session;
      await this.put(s);
      await this.store.push(KEY.held(user), id);
      return s;
    }
    return null;
  }

  /** The user's picked steps that have no answer yet, oldest first (bridge item 20: resume after a dropped window). */
  async picked(user: string): Promise<ThinkStep[]> {
    const out: ThinkStep[] = [];
    for (const id of await this.store.range(KEY.held(user))) {
      const s = await this.get(id);
      if (!s || s.state !== 'picked') { await this.store.remove(KEY.held(user), id); continue; }
      out.push(s);
    }
    return out;
  }

  /** The user's open steps (queued and picked, unanswered), oldest first, for the site's notices (item 23). Read only. */
  async open(user: string): Promise<ThinkStep[]> {
    const out: ThinkStep[] = [];
    for (const key of [KEY.queue(user), KEY.held(user)]) for (const id of await this.store.range(key)) {
      const s = await this.get(id);
      if (s && (s.state === 'queued' || s.state === 'picked') && !out.some(o => o.id === s.id)) out.push(s);
    }
    return out.sort((a, b) => a.createdAt - b.createdAt);
  }

  /**
   * Hand a picked, unanswered step to `session` (the window that now holds its job, after the old one dropped, or the
   * same window asking again). The answer window starts again; an answer from the old session is refused from now on.
   */
  async repick(id: string, session: string): Promise<ThinkStep | null> {
    const s = await this.get(id);
    if (!s || s.state !== 'picked') return null;
    s.pickedBy = session; s.pickedAt = this.now();
    await this.store.set(KEY.pick(id), session, STEP_TTL_MS);
    await this.put(s);
    return s;
  }

  /** The answer for a picked step. Idempotent: the same answer twice is fine, a different second answer is refused. */
  async answer(id: string, text: string, session?: string): Promise<{ ok: true } | { ok: false; why: string }> {
    const s = await this.get(id);
    if (!s) return { ok: false, why: 'unknown or expired step' };
    if (s.state === 'answered') return s.answer === text ? { ok: true } : { ok: false, why: 'this step is already answered' };
    if (s.state !== 'picked') return { ok: false, why: `step is ${s.state}` };
    if (session !== undefined && s.pickedBy && s.pickedBy !== session) return { ok: false, why: 'this step belongs to another session' };
    s.state = 'answered'; s.answeredAt = this.now(); s.answer = text;
    await this.put(s);
    await this.store.remove(KEY.held(s.user), id);
    return { ok: true };
  }

  async cancel(id: string, state: 'expired' | 'cancelled' = 'cancelled') {
    const s = await this.get(id); if (!s) return;
    if (s.state === 'answered') return;
    s.state = state; await this.put(s);
    await this.store.remove(KEY.queue(s.user), id);
    await this.store.remove(KEY.held(s.user), id);
  }

  /** A remembered accepted answer for this fingerprint, or null. */
  recall(user: string, fp: string): Promise<string | null> { return this.store.get(KEY.memo(user, fp)); }
  /** Remember an accepted answer (only answers that passed the checks are remembered). */
  async remember(user: string, fp: string, text: string) { await this.store.set(KEY.memo(user, fp), text, MEMO_TTL_MS); }
}
