/**
 * The bridge runtime (bridge item 8): the `brain` lane of the engine's lane switch (engine runtime/lane.ts). A brain
 * call becomes one ThinkStep on the user's queue; their Claude Code picks it up (moovi_next, phase 2) and answers
 * (moovi_answer). Before queuing, the memo is asked: the same step answered in the last 24 h is replayed and Claude
 * Code is asked nothing. Only BRAIN_AGENTS may come through here; everything else is refused, so detail work can never
 * reach the user's Claude Code even by mistake.
 */
import { z } from 'zod';
import { BRAIN_CAPS, BrainNotPickedUp, isBrainAgent, PICKUP_MS, type CompleteRequest, type Runtime } from '@moovi/engine/runtime';
import { fingerprint, StepQueue, type ThinkStep } from './queue';

export const ANSWER_MS = 5 * 60_000;

/**
 * Steps with their own whole wait, from queued to answered (Claude 1, 2026-10-18 18:20 IST: direct:edit-spec was picked
 * up, then waited 300 s and was re-asked, so an edit could wait 10 minutes). Past it the step is expired, the call throws
 * BrainTimedOut (the lane switch does not move it to the wait lane) and the caller falls back on its own path (the
 * Edit menu step on a key or the server model, engine edit/mastery-direct.ts). Such a step has no separate pickup window,
 * so it never reaches the wait lane (a 10 min wait that parks the job). A second ask of the same agent in the same
 * job after such a timeout is refused at once: no re-ask.
 */
export const STEP_LIMIT_MS: Readonly<Record<string, number>> = { 'direct:edit-spec': 90_000 };

export class BrainRefused extends Error { constructor(agent: string) { super(`${agent} is not a brain call; it never goes to Claude Code`); this.name = 'BrainRefused'; } }
export class BrainTimedOut extends Error {
  constructor(agent: string, ms: number, picked = true) { super(`${agent}: Claude Code ${picked ? 'picked the step up but ' : ''}did not answer within ${Math.round(ms / 1000)} s`); this.name = 'BrainTimedOut'; }
}

export interface BridgeOptions {
  queue: StepQueue;
  user: string;
  /** the job (run id) the steps belong to */
  job: () => string;
  pickupMs?: number; answerMs?: number; pollMs?: number;
  /** the wait lane's pickup window (scope.ts builds a second bridge with it; default WAIT_MS, 10 min) */
  waitMs?: number;
  /** extra step fields for an agent (images, maxOut), from the caller that built the step */
  extras?: (req: CompleteRequest) => Pick<ThinkStep, 'images' | 'maxOut'> | undefined;
  /** the answer checks; problems = not remembered (item 10 re-asks); default: every answer is accepted */
  accept?: (agent: string, text: string) => string[];
  /** every step event (queued, replayed, picked, answered, expired), for the job's activity and the LOG proofs */
  onEvent?: (e: { type: 'queued' | 'replayed' | 'answered' | 'expired'; step: string | null; agent: string; fp: string }) => void;
  /** per agent whole waits (default STEP_LIMIT_MS) */
  stepLimits?: Readonly<Record<string, number>>;
  /** the bridge worker log (default console.log) */
  log?: (line: string) => void;
  now?: () => number;
}

const sleep = (ms: number, signal?: AbortSignal) => new Promise<void>((res, rej) => {
  if (signal?.aborted) return rej(new Error('aborted'));
  const t = setTimeout(() => { signal?.removeEventListener('abort', on); res(); }, ms);
  const on = () => { clearTimeout(t); rej(new Error('aborted')); };
  signal?.addEventListener('abort', on, { once: true });
});

/** the answer cap of a brain agent: direct:edit, direct:film, direct:look map to BRAIN_CAPS edit, film, look; direct:edit-spec
 *  (decision 20, the whole Edit spec) has no cap here, moovi_answer's MAX_ANSWER_CHARS still holds */
export const capOf = (agent: string): number | undefined => (BRAIN_CAPS as Record<string, { out: number } | undefined>)[agent.replace(/^direct:/, '')]?.out;

/** user + job + agent of a limited step that got no answer: that job asks it no second time (no re-ask). Module wide,
 *  because the bridge scope is built again per run lookup; bounded, the oldest entries go first. */
const gaveUp = new Set<string>();
const giveUp = (key: string) => { gaveUp.add(key); if (gaveUp.size > 500) gaveUp.delete(gaveUp.values().next().value!); };

const jsonSchemaOf = (shape: z.ZodRawShape | undefined) => (shape ? z.toJSONSchema(z.object(shape), { unrepresentable: 'any' }) as Record<string, unknown> : null);

export function bridgeRuntime(o: BridgeOptions): Runtime {
  const now = o.now ?? Date.now;
  const pickupMs = o.pickupMs ?? PICKUP_MS, answerMs = o.answerMs ?? ANSWER_MS, pollMs = o.pollMs ?? 250;
  const limits = o.stepLimits ?? STEP_LIMIT_MS, log = o.log ?? ((l: string) => console.log(l));
  return {
    name: 'claude-code-bridge',
    vision: true,
    run: async req => { throw new BrainRefused(`${req.agent} (tool loop)`); },
    async complete(req: CompleteRequest): Promise<string> {
      if (!isBrainAgent(req.agent)) throw new BrainRefused(req.agent);
      // item 23: every brain step carries its hard answer cap (plan 23.3), so moovi_answer can refuse an over-budget answer
      const extra = o.extras?.(req) ?? {}, cap = capOf(req.agent);
      const body = { agent: req.agent, system: req.system, prompt: req.prompt, schema: jsonSchemaOf(req.schema), history: req.history, ...(cap && extra.maxOut === undefined ? { maxOut: cap } : {}), ...extra };
      const fp = fingerprint(body);
      const limit = limits[req.agent], job = o.job(), key = `${o.user}\u0000${job}\u0000${req.agent}`;
      if (limit !== undefined && gaveUp.has(key)) {
        log(`[bridge] no re-ask ${o.user} ${job} ${req.agent}: no answer the first time, the server lane takes over`);
        throw new BrainTimedOut(req.agent, limit);
      }
      const memo = await o.queue.recall(o.user, fp);
      if (memo !== null) { o.onEvent?.({ type: 'replayed', step: null, agent: req.agent, fp }); return memo; }
      const s = await o.queue.push({ ...body, user: o.user, job });
      o.onEvent?.({ type: 'queued', step: s.id, agent: req.agent, fp });
      try {
        for (;;) {
          await sleep(pollMs, req.signal);
          const cur = await o.queue.get(s.id);
          if (!cur || cur.state === 'expired' || cur.state === 'cancelled') throw new BrainNotPickedUp(req.agent, pickupMs);
          if (cur.state === 'answered') {
            const text = cur.answer ?? '';
            o.onEvent?.({ type: 'answered', step: s.id, agent: req.agent, fp });
            if (!(o.accept?.(req.agent, text) ?? []).length) await o.queue.remember(o.user, fp, text);
            return text;
          }
          if (limit !== undefined && (cur.state === 'queued' || cur.state === 'picked') && now() - cur.createdAt >= limit) {
            const picked = cur.state === 'picked';
            await o.queue.cancel(s.id, 'expired'); o.onEvent?.({ type: 'expired', step: s.id, agent: req.agent, fp });
            giveUp(key);
            log(`[bridge] no answer ${o.user} ${job} ${req.agent} ${s.id} within ${Math.round(limit / 1000)} s (${picked ? 'picked, never answered' : 'never picked up'}): falling back, no re-ask`);
            throw new BrainTimedOut(req.agent, limit, picked);
          }
          if (limit === undefined && cur.state === 'queued' && now() - cur.createdAt >= pickupMs) { await o.queue.cancel(s.id, 'expired'); o.onEvent?.({ type: 'expired', step: s.id, agent: req.agent, fp }); throw new BrainNotPickedUp(req.agent, pickupMs); }
          if (cur.state === 'picked' && now() - (cur.pickedAt ?? cur.createdAt) >= answerMs) { await o.queue.cancel(s.id, 'expired'); o.onEvent?.({ type: 'expired', step: s.id, agent: req.agent, fp }); throw new BrainTimedOut(req.agent, answerMs); }
        }
      } catch (e) {
        if (req.signal?.aborted) {
          await o.queue.cancel(s.id, 'cancelled');
          // the caller stopped waiting (mastery-direct's own 90 s clock can fire before this loop's): same fallback, logged
          if (limit !== undefined && !gaveUp.has(key)) {
            giveUp(key);
            log(`[bridge] no answer ${o.user} ${job} ${req.agent} ${s.id} after ${Math.round((now() - s.createdAt) / 1000)} s (the caller stopped waiting): falling back, no re-ask`);
          }
        }
        throw e;
      }
    },
  };
}
