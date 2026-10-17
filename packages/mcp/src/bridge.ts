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

export class BrainRefused extends Error { constructor(agent: string) { super(`${agent} is not a brain call; it never goes to Claude Code`); this.name = 'BrainRefused'; } }
export class BrainTimedOut extends Error { constructor(agent: string, ms: number) { super(`${agent}: Claude Code picked the step up but did not answer within ${Math.round(ms / 1000)} s`); this.name = 'BrainTimedOut'; } }

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
  now?: () => number;
}

const sleep = (ms: number, signal?: AbortSignal) => new Promise<void>((res, rej) => {
  if (signal?.aborted) return rej(new Error('aborted'));
  const t = setTimeout(() => { signal?.removeEventListener('abort', on); res(); }, ms);
  const on = () => { clearTimeout(t); rej(new Error('aborted')); };
  signal?.addEventListener('abort', on, { once: true });
});

/** the answer cap of a brain agent: direct:edit, direct:film, direct:look map to BRAIN_CAPS edit, film, look */
export const capOf = (agent: string): number | undefined => (BRAIN_CAPS as Record<string, { out: number } | undefined>)[agent.replace(/^direct:/, '')]?.out;

const jsonSchemaOf = (shape: z.ZodRawShape | undefined) => (shape ? z.toJSONSchema(z.object(shape), { unrepresentable: 'any' }) as Record<string, unknown> : null);

export function bridgeRuntime(o: BridgeOptions): Runtime {
  const now = o.now ?? Date.now;
  const pickupMs = o.pickupMs ?? PICKUP_MS, answerMs = o.answerMs ?? ANSWER_MS, pollMs = o.pollMs ?? 250;
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
      const memo = await o.queue.recall(o.user, fp);
      if (memo !== null) { o.onEvent?.({ type: 'replayed', step: null, agent: req.agent, fp }); return memo; }
      const s = await o.queue.push({ ...body, user: o.user, job: o.job() });
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
          if (cur.state === 'queued' && now() - cur.createdAt >= pickupMs) { await o.queue.cancel(s.id, 'expired'); o.onEvent?.({ type: 'expired', step: s.id, agent: req.agent, fp }); throw new BrainNotPickedUp(req.agent, pickupMs); }
          if (cur.state === 'picked' && now() - (cur.pickedAt ?? cur.createdAt) >= answerMs) { await o.queue.cancel(s.id, 'expired'); o.onEvent?.({ type: 'expired', step: s.id, agent: req.agent, fp }); throw new BrainTimedOut(req.agent, answerMs); }
        }
      } catch (e) {
        if (req.signal?.aborted) await o.queue.cancel(s.id, 'cancelled');
        throw e;
      }
    },
  };
}
