/**
 * Isolation (bridge item 9; plan section 21): one job, one Claude Code session, and nothing happens unless the user typed
 * /mcp__moovi__run in that session.
 *
 * - Run ticket: getting the /mcp__moovi__run prompt mints `rt_...` (10 min to first use, then bound to the session that used
 *   it). A pull without a valid ticket is idle and does nothing, so other sessions and projects that have Moovi added
 *   see the tools but cannot pull work.
 * - Lease: the first pull of a job by a session takes `ls_...` on that job (SET NX, 2 min, refreshed on every call). A
 *   second session never gets a step of a leased job; an answer must carry the lease of the step's job and session.
 *   When a lease lapses (2 min with no call), a fresh /mcp__moovi__run anywhere takes the job over; answered steps replay
 *   from the memo, so nothing is asked twice.
 * - Resume (item 20): the holder's last call is the lease's `at`. A window that is polling keeps it fresh
 *   (`keepAlive`); one that dropped (closed, network cut) stops, and 2 min after its last call another window with its
 *   own /mcp__moovi__run takes the job over, including a step the dropped window had picked and never answered (`repick`).
 *   A window that closes cleanly gives its leases back at once (`release`).
 */
import { randomBytes } from 'node:crypto';
import { KEY, type BrainStore } from './store';
import type { StepQueue, ThinkStep } from './queue';

export const LEASE_MS = 120_000;
export const TICKET_FIRST_USE_MS = 10 * 60_000;
export const TICKET_MS = 6 * 3600_000;
/** a picked step's answer window (bridge.ts ANSWER_MS) plus a little: the lease never lapses mid answer */
export const ANSWER_HOLD_MS = 5 * 60_000 + 15_000;

export const IDLE_NO_TICKET = 'Type /mcp__moovi__run to let this Claude Code work on your Moovi video.';
export const IDLE_OTHER_WINDOW = 'Another Claude Code window is already working on this video. You can close this one.';
export const IDLE_NOTHING = 'Nothing to do right now: Moovi will have the next step shortly.';

interface Ticket { user: string; createdAt: number; session: string | null }
interface Lease { lease: string; user: string; job: string; session: string; ticket: string; at: number }

const rnd = (p: string) => `${p}_${randomBytes(8).toString('hex')}`;

export class Gate {
  /** onPull: every authorised pull (a ticket checked), e.g. Presence.touch: the user's Claude Code is online */
  constructor(readonly store: BrainStore, readonly queue: StepQueue, readonly now: () => number = Date.now, readonly onPull?: (user: string) => void) {}

  /** A one-time run ticket for this user (embedded in the /mcp__moovi__run prompt). */
  async mintTicket(user: string): Promise<string> {
    const t = rnd('rt');
    await this.store.set(KEY.ticket(t), JSON.stringify({ user, createdAt: this.now(), session: null } satisfies Ticket), TICKET_FIRST_USE_MS);
    return t;
  }

  /** Valid for this user and session? The first use binds the ticket to the session. */
  async useTicket(user: string, session: string, ticket: string | undefined): Promise<boolean> {
    if (!ticket) return false;
    const raw = await this.store.get(KEY.ticket(ticket)); if (!raw) return false;
    const t = JSON.parse(raw) as Ticket;
    if (t.user !== user) return false;
    if (t.session === null) { t.session = session; await this.store.set(KEY.ticket(ticket), JSON.stringify(t), TICKET_MS); return true; }
    return t.session === session;
  }

  private async extend(job: string, ms: number) { const cur = await this.leaseOf(job); if (cur) await this.store.set(KEY.lease(job), JSON.stringify({ ...cur, at: this.now() }), ms); }

  private async leaseOf(job: string): Promise<Lease | null> { const v = await this.store.get(KEY.lease(job)); return v ? JSON.parse(v) as Lease : null; }

  /** a lease whose holder made no call for LEASE_MS: its window dropped, another window may take the job */
  private stale(l: Lease) { return this.now() - l.at >= LEASE_MS; }

  /** Take or refresh the lease on a job for this session; null when another live session holds it. */
  async acquire(user: string, job: string, session: string, ticket: string, depth = 0): Promise<string | null> {
    const cur = await this.leaseOf(job);
    if (cur) {
      if (cur.user !== user) return null;
      if (cur.session !== session) {
        if (!this.stale(cur) || depth > 2) return null;
        // take over from a dropped window; read back so two windows taking over at once end with one owner
        const l: Lease = { lease: rnd('ls'), user, job, session, ticket, at: this.now() };
        await this.store.set(KEY.lease(job), JSON.stringify(l), LEASE_MS);
        return (await this.leaseOf(job))?.lease === l.lease ? l.lease : null;
      }
      await this.store.set(KEY.lease(job), JSON.stringify({ ...cur, at: this.now(), ticket }), LEASE_MS);
      return cur.lease;
    }
    const l: Lease = { lease: rnd('ls'), user, job, session, ticket, at: this.now() };
    return (await this.store.setNx(KEY.lease(job), JSON.stringify(l), LEASE_MS)) ? l.lease : (await this.acquire(user, job, session, ticket, depth + 1));
  }

  /** A polling window keeps the jobs it holds (moovi_next calls this on every look), so a second window is turned away. */
  async keepAlive(session: string, held: ReadonlyMap<string, string>): Promise<void> {
    for (const [job, lease] of held) {
      const cur = await this.leaseOf(job);
      if (cur && cur.lease === lease && cur.session === session) await this.store.set(KEY.lease(job), JSON.stringify({ ...cur, at: this.now() }), LEASE_MS);
    }
  }

  /** A window that closed gives its leases back at once: the next /mcp__moovi__run anywhere takes the job without waiting. */
  async release(session: string, held: ReadonlyMap<string, string>): Promise<void> {
    for (const [job, lease] of held) {
      const cur = await this.leaseOf(job);
      if (cur && cur.lease === lease && cur.session === session) await this.store.del(KEY.lease(job));
    }
  }

  /** Is `job` held by a live window other than `session`? (moovi_next tells a second window so, even between steps) */
  async heldElsewhere(job: string, session: string): Promise<boolean> {
    const cur = await this.leaseOf(job);
    return !!cur && cur.session !== session && !this.stale(cur);
  }

  /** Is this the live lease of `job` for `session`? Refreshes it when it is. */
  async check(job: string, session: string, lease: string): Promise<{ ok: true } | { ok: false; why: string }> {
    const cur = await this.leaseOf(job);
    if (!cur) return { ok: false, why: 'Your turn expired, call moovi_next.' };
    if (cur.lease !== lease) return { ok: false, why: cur.session === session ? 'Your turn expired, call moovi_next.' : IDLE_OTHER_WINDOW };
    if (cur.session !== session) return { ok: false, why: IDLE_OTHER_WINDOW };
    await this.store.set(KEY.lease(job), JSON.stringify({ ...cur, at: this.now() }), LEASE_MS);
    return { ok: true };
  }

  /** moovi_next: the next step this session may work on, with its lease, or why it is idle. */
  async pull(user: string, session: string, ticket: string | undefined): Promise<{ step: ThinkStep; lease: string } | { idle: string }> {
    if (!(await this.useTicket(user, session, ticket))) return { idle: IDLE_NO_TICKET };
    this.onPull?.(user);
    // a step is handed out only for a job this session holds (or can take); jobs leased elsewhere are skipped
    let blocked = false;
    const leases = new Map<string, string>();
    // first, a picked step nobody answered: this window asking again, or the window that took over from a dropped one
    for (const s of await this.queue.picked(user)) {
      const l = leases.get(s.job) ?? await this.acquire(user, s.job, session, ticket!);
      if (!l) { blocked = true; continue; }
      leases.set(s.job, l);
      const again = await this.queue.repick(s.id, session);
      if (!again) continue;
      await this.extend(s.job, ANSWER_HOLD_MS);
      return { step: again, lease: l };
    }
    const step = await this.queue.next(user, session, async s => {
      const l = leases.get(s.job) ?? await this.acquire(user, s.job, session, ticket!);
      if (!l) { blocked = true; return false; }
      leases.set(s.job, l); return true;
    });
    if (!step) return { idle: blocked ? IDLE_OTHER_WINDOW : IDLE_NOTHING };
    // thinking on a step makes no calls: the lease holds for the whole answer window, then lapses to 2 min again
    await this.extend(step.job, ANSWER_HOLD_MS);
    return { step, lease: leases.get(step.job)! };
  }

  /** moovi_answer: accepted only with the live lease of the step's job, from the session that picked it. */
  async submit(user: string, session: string, lease: string, stepId: string, answer: string): Promise<{ ok: true } | { ok: false; why: string }> {
    const s = await this.queue.get(stepId);
    if (!s || s.user !== user) return { ok: false, why: 'unknown or expired step' };
    const c = await this.check(s.job, session, lease); if (!c.ok) return c;
    return this.queue.answer(stepId, answer, session);
  }
}
