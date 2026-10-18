/**
 * The one switch every model call goes through (Claude Code bridge, docs/agents/claude-code-bridge item 7).
 *
 * Lanes, in order (Ishaan 2026-10-17, DECISIONS.md 2): the user's own Claude Code when it is connected and online
 * (Creative), else the user's own key (Precise), else Moovi's server model where that is allowed. Claude Code is only
 * the brain (plan section 23): just the batched decision calls in BRAIN_AGENTS ever reach it; every other call in the
 * same job (detail work) runs on the user's key or the server model, never on the user's Claude Code.
 *
 * A brain call Claude Code does not pick up within PICKUP_MS moves to the key (or the server) for that call; with no
 * other lane the step stays queued for Claude Code up to WAIT_MS (a /mcp__moovi__run in any window picks it up), then the
 * job waits for Claude Code (BrainWaiting, the job parks; nothing is lost). `pickLane` is pure and
 * never throws; `laneRuntime` throws only the typed errors below. No I/O here: the bridge itself (packages/mcp) is the
 * `brain` runtime passed in.
 */
import { config } from '../config';
import type { AgentRequest, AgentResult, CompleteRequest, Runtime } from './types';

export type Lane = 'claude-code' | 'key' | 'server' | 'wait' | 'none';
/** the order lanes are tried in */
export const LANE_ORDER = ['claude-code', 'key', 'server'] as const;
/** a brain step not picked up by the user's Claude Code within this long goes to the next lane (Ishaan: 120 s) */
export const PICKUP_MS = 120_000;
/**
 * The wait lane (no key, no server model allowed, Claude Code linked): the step stays queued this long for a
 * /mcp__moovi__run in any window before the job parks (plan sections 16 and 17: pickup 10 min, then park).
 */
export const WAIT_MS = 10 * 60_000;

/**
 * The only agents that may reach the user's Claude Code: the batched decision calls (plan 23.2), and since decision 20
 * the Edit spec Edit mastery's player draws (edit/mastery-direct.ts, `direct:edit-spec`): a linked Claude Code writes it
 * from the full ishaan-motion skill. Without it here that step went to the key or server lane even with Claude Code
 * online. The menu step (`direct:edit-menu`) stays off: it is the compact tier for keys and the server model.
 */
export const BRAIN_AGENTS: ReadonlySet<string> = new Set(['direct:edit', 'direct:edit-spec', 'direct:film', 'direct:look']);
export const isBrainAgent = (agent: string) => BRAIN_AGENTS.has(agent);

export interface LaneFacts {
  /** online: connected and polling now; linked: connected before but not polling; off: never connected or revoked */
  claudeCode: 'online' | 'linked' | 'off';
  /** the user saved their own model key */
  hasKey: boolean;
  /** this machine has its own model configured (MOOVI_RUNTIME=http with a key) */
  server: boolean;
  /** MOOVI_BYOK: may a keyless user's brain calls run on the server model */
  byok: 'required' | 'optional';
}

/**
 * Which lane one call takes. Brain calls: Claude Code online, else the key, else the server (only under
 * MOOVI_BYOK=optional), else wait for Claude Code when it is linked, else none. Detail calls: the key, else the server
 * (in a Claude Code job the server model is Moovi's own cost for detail work, plan 23), else none.
 */
export function pickLane(agent: string, f: LaneFacts): { lane: Lane; why: string } {
  try {
    if (isBrainAgent(agent)) {
      if (f.claudeCode === 'online') return { lane: 'claude-code', why: 'your Claude Code is connected and online' };
      if (f.hasKey) return { lane: 'key', why: f.claudeCode === 'linked' ? 'your Claude Code is offline; using your key' : 'using your key' };
      if (f.server && f.byok === 'optional') return { lane: 'server', why: 'no Claude Code online and no key; using Moovi\'s model' };
      if (f.claudeCode === 'linked') return { lane: 'wait', why: 'waiting for your Claude Code: type /mcp__moovi__run' };
      return { lane: 'none', why: 'connect Claude Code or add a model key' };
    }
    if (f.hasKey) return { lane: 'key', why: 'detail work on your key' };
    if (f.server && (f.byok === 'optional' || f.claudeCode !== 'off')) return { lane: 'server', why: 'detail work on Moovi\'s model' };
    return { lane: 'none', why: 'no model for detail work' };
  } catch {
    return { lane: 'none', why: 'lane facts unreadable' };
  }
}

/** The job's mode as the site shows it (DECISIONS.md 2): Creative with Claude Code online, Precise on a key. */
export function brainMode(f: LaneFacts): 'creative' | 'precise' | 'server' | 'waiting' | 'none' {
  const l = pickLane('direct:edit', f).lane;
  return l === 'claude-code' ? 'creative' : l === 'key' ? 'precise' : l === 'server' ? 'server' : l === 'wait' ? 'waiting' : 'none';
}

/** The bridge throws this when nobody picked the step up in time; the switch then tries the next lane. */
export class BrainNotPickedUp extends Error { constructor(agent: string, ms: number) { super(`${agent}: Claude Code did not pick the step up within ${Math.round(ms / 1000)} s`); this.name = 'BrainNotPickedUp'; } }
/** No lane can take a brain call now, but Claude Code is linked: the job parks until it is online. */
export class BrainWaiting extends Error { constructor(agent: string) { super(`${agent}: waiting for your Claude Code (type /mcp__moovi__run)`); this.name = 'BrainWaiting'; } }
/** No lane at all: the caller's own fallback (rules) runs, or the job asks the user to connect. */
export class NoModelForAgent extends Error { constructor(agent: string, why: string) { super(`${agent}: ${why}`); this.name = 'NoModelForAgent'; } }

export interface LaneRuntimeOptions {
  /** read at every call (Claude Code can go online or offline mid job) */
  facts: () => LaneFacts;
  /** the bridge to the user's Claude Code (packages/mcp) */
  brain?: Runtime | null;
  /** the user's own key */
  key?: Runtime | null;
  /** this machine's model */
  server?: Runtime | null;
  /** the same bridge with the long pickup window (WAIT_MS): the wait lane queues the step here and parks only when
   * nobody picks it up; without it the wait lane parks at once */
  waitBrain?: Runtime | null;
  /** every lane decision, for the job's activity and LOG proofs */
  onLane?: (agent: string, lane: Lane, why: string) => void;
  /** the concrete model per tier on the key and server lanes (server default: this machine's config.models) */
  models?: { key?: Partial<Record<ModelTier, string>>; server?: Partial<Record<ModelTier, string>> };
}

type ModelTier = 'director' | 'crew' | 'fast';
/** the names a step may ask for instead of a model id: 'brain' is the strongest tier, the tiers by name */
export const LOGICAL_MODELS: Readonly<Record<string, ModelTier>> = { brain: 'director', director: 'director', crew: 'crew', fast: 'fast' };
/**
 * A logical name to the lane's own model id (Claude Code keeps the name: it answers with its own model). On the server
 * lane 'brain' went to the provider as a model id and came back "model is gone" (live server log, 2026-10-18 04:33 IST),
 * so the first step of every job paid a failed call and ran on whatever the provider's list put first.
 */
export function concreteModel(lane: Lane, m: string, models: LaneRuntimeOptions['models'] = {}): string {
  const tier = LOGICAL_MODELS[m];
  if (!tier || (lane !== 'key' && lane !== 'server')) return m;
  const ms = lane === 'key' ? models.key : (models.server ?? config.models);
  return ms?.[tier] && !LOGICAL_MODELS[ms[tier]!] && ms[tier] !== 'server' ? ms[tier]! : m;
}

/** A Runtime that sends each call down the lane `pickLane` names, moving on when Claude Code does not pick a step up. */
export function laneRuntime(o: LaneRuntimeOptions): Runtime {
  const of = (lane: Lane) => (lane === 'claude-code' ? o.brain : lane === 'key' ? o.key : lane === 'server' ? o.server : null) ?? null;
  const route = async <T>(agent: string, go: (rt: Runtime, lane: Lane) => Promise<T>): Promise<T> => {
    let f = o.facts();
    for (let hop = 0; hop < LANE_ORDER.length + 1; hop++) {
      let { lane, why } = pickLane(agent, f);
      if ((lane === 'claude-code' || lane === 'key' || lane === 'server') && !of(lane)) {
        // a lane the facts allow but this job has no runtime for: treat it as absent and pick again
        f = lane === 'claude-code' ? { ...f, claudeCode: 'off' } : lane === 'key' ? { ...f, hasKey: false } : { ...f, server: false };
        continue;
      }
      o.onLane?.(agent, lane, why);
      if (lane === 'wait') {
        if (!o.waitBrain) throw new BrainWaiting(agent);
        try { return await go(o.waitBrain, lane); } catch (e) { if (e instanceof BrainNotPickedUp) throw new BrainWaiting(agent); throw e; }
      }
      if (lane === 'none') throw new NoModelForAgent(agent, why);
      try { return await go(of(lane)!, lane); }
      catch (e) {
        // not picked up in time: this call moves on (key, server), or waits for Claude Code when nothing else can take it
        if (lane === 'claude-code' && e instanceof BrainNotPickedUp) { f = { ...f, claudeCode: 'linked' }; continue; }
        throw e;
      }
    }
    throw new NoModelForAgent(agent, 'no lane left');
  };
  return {
    name: 'lanes',
    vision: !!(o.brain?.vision || o.key?.vision || o.server?.vision),
    run: (req: AgentRequest): Promise<AgentResult> => route(req.agent, (rt, lane) => rt.run({ ...req, model: concreteModel(lane, req.model, o.models) })),
    complete: (req: CompleteRequest): Promise<string> => route(req.agent, (rt, lane) => (rt.complete ? rt.complete({ ...req, model: concreteModel(lane, req.model, o.models) }) : Promise.reject(new Error(`${rt.name} has no single-answer call`)))),
  };
}
