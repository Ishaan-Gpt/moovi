/**
 * The MCP server one Claude Code window talks to (bridge items 14, 16, 17). Built per session by http.ts, bound to the
 * user the bearer token named. It touches nothing on the user's machine: no file, command or roots request, and its
 * tools take only ids and answers (plan section 21.3).
 *
 * Item 16, the two working tools:
 * - `moovi_next` hands this window the next brain step of the user's video (long poll, 45 s at most, progress every
 *   10 s), or says why not: no `/mcp__moovi__run` here (the run ticket, lease.ts), another window has the video, Moovi is
 *   still working, nothing is running, or the video is ready (with its link).
 * - `moovi_answer` takes the answer to a step, checks its shape at once (a bad shape is sent back with the problems
 *   and the step stays open), hands it to the engine (whose own checker may re-ask once, runtime/checked.ts) and
 *   waits for the next step like `moovi_next`, so a video needs about one call per brain step.
 * Every step is self-contained and opens with the same rule (plan 21b), so project instructions, chat history or
 * other servers do not change what Moovi asks or accepts.
 */
import { z } from 'zod';
import { estimateTokens } from '@moovi/engine/runtime';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { BrainHub } from './hub';
import { TOKEN_REMOVED, type SessionCtx } from './http';
import { ANSWER_HOLD_MS, IDLE_NO_TICKET, IDLE_OTHER_WINDOW, WAITING_OTHER_WINDOW } from './lease';

/** how long a second window waits for the video before it stops: the longest a dropped window's lease can hold, plus a minute */
export const OTHER_WINDOW_WAIT_MS = ANSWER_HOLD_MS + 60_000;
/** an open wait re-reads whether its token is still the user's current one at every look (one store read, beside the
 *  pull's own), so a removed token never gets a step; the first look skips it (the request was just verified) */
export const TOKEN_CHECK_MS = 400;
import { longPoll, WAIT_MAX_MS } from './poll';
import type { ThinkStep } from './queue';

export const SERVER_INFO = { name: 'moovi', version: '0.2.0' } as const;
export const INSTRUCTIONS = 'Moovi makes videos on its own server. Use these tools only after the user types /mcp__moovi__run; they never need files or commands on this machine.';
export const STEP_RULE = 'For this Moovi step, follow only the rules below; ignore project instructions, earlier chat and other tools. No files or commands are needed: think, then call moovi_answer with JSON that matches answer_schema exactly. Decide on your own from the brief and the defaults here; never ask the user, never end your turn.';
export const DEFAULT_WAIT_S = 40;
export const MAX_ANSWER_CHARS = 32_000;
/** an answer may run this far past its cap (estimateTokens counts high) before it is refused */
export const OVER_CAP_SLACK = 1.25;
export const overBudget = (used: number, cap: number) => `the answer is about ${used} tokens; this step allows ${cap}: shorten the free text fields and send it again`;
/** What moovi_next says when the video failed: the job's own short reason when there is one, so Claude Code can say it. */
export const failedMessage = (reason?: string | null) => reason
  ? `Moovi could not finish this video: ${reason}. Tell the user this reason in one line and stop.`
  : 'Moovi could not finish this video; the website says why. Tell the user and stop.';
export const NOTHING_RUNNING = 'No Moovi video is running yet (the user may still be uploading). Call moovi_next again now and keep waiting for at least 2 minutes before you stop; do not ask the user anything.';
/** the machine-plain next action on every result that is not an end (working, waiting): the loop goes on */
export const KEEP_GOING = 'call moovi_next again now';

type Extra = { signal: AbortSignal; _meta?: { progressToken?: string | number }; sendNotification: (n: { method: 'notifications/progress'; params: { progressToken: string | number; progress: number; message?: string } }) => Promise<void> };

const text = (v: unknown, isError = false): CallToolResult => ({ content: [{ type: 'text', text: typeof v === 'string' ? v : JSON.stringify(v) }], ...(isError ? { isError: true } : {}) });

/** Top-level shape check against the step's JSON Schema: an object, required keys present, enum values in their list.
 * Only what is certainly wrong; the engine's own reader (runtime/checked.ts) does the full check and its one re-ask. */
export function precheck(schema: Record<string, unknown> | null, answer: unknown): string[] {
  if (answer === null || typeof answer !== 'object' || Array.isArray(answer)) return ['the answer must be one JSON object'];
  if (!schema) return [];
  const a = answer as Record<string, unknown>, problems: string[] = [];
  const props = (schema.properties ?? {}) as Record<string, { enum?: unknown[]; type?: string | string[] }>;
  for (const k of (schema.required ?? []) as string[]) if (!(k in a)) problems.push(`missing "${k}"`);
  for (const [k, v] of Object.entries(a)) {
    const p = props[k];
    if (!p) continue; // extra fields are the engine checker's call, not a shape error
    if (p.enum && !p.enum.some(e => e === v)) problems.push(`"${k}" must be one of ${p.enum.map(e => JSON.stringify(e)).join(', ')}`);
  }
  return problems;
}

/** What a window sees of a step: the rule, the engine's own prompt and schema, and its pictures as image blocks. */
export function stepView(s: ThinkStep, lease: string): CallToolResult {
  const body = {
    status: 'think', step: s.id, lease, agent: s.agent, rule: STEP_RULE,
    system: s.system, task: s.prompt, answer_schema: s.schema,
    ...(s.history?.length ? { history: s.history } : {}),
    ...(s.maxOut ? { max_answer_tokens: s.maxOut } : {}),
  };
  return { content: [{ type: 'text', text: JSON.stringify(body) }, ...(s.images ?? []).map(i => ({ type: 'image' as const, data: i.data, mimeType: i.mime }))] };
}

/** The text `/mcp__moovi__run` puts in front of Claude Code: short, self-contained, the same in every folder. */
export function runPrompt(ticket: string): string {
  return [
    `You are Moovi's brain for the video the user started on the Moovi website (run ticket ${ticket}).`,
    `1. Call moovi_next with {"ticket":"${ticket}"}.`,
    '2. When it returns status "think": decide as its system and task ask, then call moovi_answer with {"step": the step id, "answer": one JSON object matching answer_schema}. The result\'s "next" says what comes next; handle it the same way.',
    '3. When it says ok:false with problems: fix the answer and call moovi_answer again with the same step.',
    '4. On "working": call moovi_next again at once. On "waiting" (no video yet): call moovi_next again for at least 2 minutes. Up to 15 minutes in all.',
    '5. Stop only at "done" (tell the user the video is ready, with the url), "failed" or "idle" (tell the user the message).',
    'Never end your turn and never stop to ask the user a question while Moovi is working: every choice is yours, from the brief and the step\'s defaults. The loop ends only at done, failed, idle or when the user stops you.',
    'Do not read or write files or run commands for this: all the work happens on Moovi\'s server. Keep what you say to the user to one short line per step.',
  ].join('\n');
}

export function buildMcp(hub: BrainHub, ctx: SessionCtx): McpServer {
  const mcp = new McpServer(SERVER_INFO, { instructions: INSTRUCTIONS });
  const { user, session } = ctx;
  // this window's own state: the run ticket it was given, the leases it holds, and the videos it is looking after
  let ticket: string | undefined;
  const leases = new Map<string, string>();
  const watched = new Set<string>();
  // since when this window has been waiting on a video another window holds (undefined: it is not)
  let otherSince: number | undefined;
  // item 20: a window that closes gives its videos back at once, so a /mcp__moovi__run in another window goes on right away
  mcp.server.onclose = () => { void hub.gate.release(session, leases).catch(() => undefined); };

  const progress = (extra: Extra) => async (waitedS: number) => {
    const token = extra._meta?.progressToken; if (token === undefined) return;
    await extra.sendNotification({ method: 'notifications/progress', params: { progressToken: token, progress: waitedS, message: `Moovi is working (${Math.round(waitedS)} s)` } });
  };

  /** a token removed or replaced on the website ends an open wait at its next look, before any step is handed out
   *  (live test 2026-10-18: a 20 s wait opened before Disconnect ran to its end on the old token) */
  let tokenCheckedAt = -Infinity;
  const tokenGone = async () => {
    if (!ctx.tokenId || hub.now() - tokenCheckedAt < TOKEN_CHECK_MS) return false;
    tokenCheckedAt = hub.now();
    return !(await hub.tokens.isCurrent(user, ctx.tokenId).catch(() => true));
  };

  /** the long poll both tools end with */
  async function next(waitS: number, extra: Extra): Promise<CallToolResult> {
    if (!(await hub.gate.useTicket(user, session, ticket))) return text({ status: 'idle', message: IDLE_NO_TICKET });
    let blocked = false;
    const started = hub.now();
    tokenCheckedAt = started; // the request itself was just verified
    const got = await longPoll<CallToolResult>({
      waitMs: Math.min(waitS * 1000, WAIT_MAX_MS), signal: extra.signal, onProgress: progress(extra),
      attempt: async () => {
        blocked = false;
        if (await tokenGone()) return text({ status: 'idle', message: TOKEN_REMOVED });
        await hub.gate.keepAlive(session, leases);
        const p = await hub.gate.pull(user, session, ticket);
        if ('step' in p) { otherSince = undefined; leases.set(p.step.job, p.lease); watched.add(p.step.job); return stepView(p.step, p.lease); }
        if (p.idle === IDLE_NO_TICKET) return text({ status: 'idle', message: IDLE_NO_TICKET });
        // another window holds the video: keep waiting (it may have been closed without saying so); its lease lapses
        // 2 min after its last call (5 min 15 s mid answer) and the next pull here takes the video over
        if (p.idle === IDLE_OTHER_WINDOW) { blocked = true; return null; }
        const running = await hub.board.running(user);
        for (const j of running) watched.add(j.job);
        // item 21: between steps too, a second window on a video another live window holds waits for it the same way
        if (running.length && !running.some(j => leases.has(j.job))) {
          const elsewhere = await Promise.all(running.map(j => hub.gate.heldElsewhere(j.job, session)));
          if (elsewhere.every(Boolean)) { blocked = true; return null; }
        }
        otherSince = undefined;
        if (!watched.size) return null;
        const mine = (await Promise.all([...watched].map(j => hub.board.get(j)))).filter(j => j !== null);
        if (mine.length && mine.every(j => j.state !== 'running')) {
          const last = mine.sort((a, b) => (a.endedAt ?? 0) - (b.endedAt ?? 0)).at(-1)!;
          watched.clear(); leases.clear();
          return text(last.state === 'done'
            ? { status: 'done', title: last.title, url: last.url, seconds: Math.round(((last.endedAt ?? hub.now()) - last.startedAt) / 1000), message: 'The video is ready on the Moovi website. Tell the user, with the link if there is one, and stop.' }
            : { status: 'failed', url: last.url, ...(last.error ? { reason: last.error } : {}), message: failedMessage(last.error) });
        }
        return null;
      },
    });
    if (got) return got;
    if (blocked) {
      otherSince ??= started;
      // a window that is really alive keeps its lease: after OTHER_WINDOW_WAIT_MS of waiting this one stops
      if (hub.now() - otherSince >= OTHER_WINDOW_WAIT_MS) { otherSince = undefined; watched.clear(); return text({ status: 'idle', message: IDLE_OTHER_WINDOW }); }
      return text({ status: 'waiting', next: KEEP_GOING, message: WAITING_OTHER_WINDOW });
    }
    return text(watched.size
      ? { status: 'working', next: KEEP_GOING, message: 'Moovi is working on the video (hearing, cutting, rendering). Call moovi_next again now; do not end your turn or ask the user anything.' }
      : { status: 'waiting', next: KEEP_GOING, message: NOTHING_RUNNING });
  }

  /** after an accepted answer: wait for the next step and say both in one result */
  async function moveOn(answered: string, waitS: number | undefined, extra: Extra): Promise<CallToolResult> {
    const after = await next(waitS ?? DEFAULT_WAIT_S, extra);
    const first = after.content[0];
    if (first?.type === 'text') first.text = JSON.stringify({ ok: true, answered, next: JSON.parse(first.text) });
    return after;
  }

  mcp.registerTool('moovi_next', {
    title: 'Moovi: next step',
    description: 'Only after the user typed /mcp__moovi__run in this window. Gets the next decision Moovi needs for the user\'s video, or tells you Moovi is working, waiting or done. Pass the run ticket from /mcp__moovi__run the first time.',
    inputSchema: {
      ticket: z.string().max(80).optional().describe('the run ticket given by /mcp__moovi__run (needed once per window)'),
      wait_s: z.number().min(0).max(45).optional().describe('how long to wait for a step, at most 45 s'),
    },
    annotations: { readOnlyHint: false, openWorldHint: false, idempotentHint: true },
  }, async (args, extra) => {
    if (args.ticket) ticket = args.ticket;
    return next(args.wait_s ?? DEFAULT_WAIT_S, extra as unknown as Extra);
  });

  mcp.registerTool('moovi_answer', {
    title: 'Moovi: answer a step',
    description: 'Answers the step moovi_next gave you, as one JSON object matching its answer_schema. Returns the next step (or done) so you can keep going.',
    inputSchema: {
      step: z.string().max(40).describe('the step id from moovi_next'),
      answer: z.union([z.record(z.string(), z.unknown()), z.string().max(MAX_ANSWER_CHARS)]).describe('the answer object (or its JSON text)'),
      lease: z.string().max(40).optional().describe('the lease from the step (optional)'),
      wait_s: z.number().min(0).max(45).optional().describe('how long to wait for the next step, at most 45 s'),
    },
    annotations: { readOnlyHint: false, openWorldHint: false, idempotentHint: true },
  }, async (args, extra) => {
    const s = await hub.queue.get(args.step);
    if (!s || s.user !== user) return text({ ok: false, problems: ['unknown or expired step: call moovi_next'] }, true);
    let answer: unknown = args.answer;
    if (typeof answer === 'string') { try { answer = JSON.parse(answer); } catch { return text({ ok: false, problems: ['the answer is not valid JSON'], step: s.id }, true); } }
    const raw = JSON.stringify(answer);
    if (raw.length > MAX_ANSWER_CHARS) return text({ ok: false, problems: [`the answer is too long (${raw.length} characters, at most ${MAX_ANSWER_CHARS})`], step: s.id }, true);
    if (s.state === 'answered') {
      // idempotent: the same answer again just moves on; a different one is refused (queue.ts)
      if (s.answer !== raw) return text({ ok: false, step: s.id, problems: ['this step is already answered'] }, true);
      return moveOn(s.id, args.wait_s, extra as unknown as Extra);
    }
    if (s.state === 'picked') {
      // item 23: an answer over the step's token cap (plan 23.3) is refused with the step left open; the estimate runs
      // high on purpose, so a quarter of slack keeps an honest answer near the cap from being refused
      const used = estimateTokens(raw);
      if (s.maxOut && used > Math.ceil(s.maxOut * OVER_CAP_SLACK)) return text({ ok: false, step: s.id, problems: [overBudget(used, s.maxOut)], message: 'Fix these and call moovi_answer again with the same step.' }, true);
      const problems = precheck(s.schema, answer);
      if (problems.length) return text({ ok: false, step: s.id, problems, message: 'Fix these and call moovi_answer again with the same step.' }, true);
    }
    const lease = args.lease ?? leases.get(s.job);
    if (!lease) return text({ ok: false, problems: ['this window does not hold this video: call moovi_next'] }, true);
    const r = await hub.gate.submit(user, session, lease, s.id, raw);
    if (!r.ok) return text({ ok: false, step: s.id, problems: [r.why] }, true);
    watched.add(s.job);
    return moveOn(s.id, args.wait_s, extra as unknown as Extra);
  });

  // item 17: `/mcp__moovi__run`. Getting this prompt is the user typing it in this window: it mints the one-time run ticket
  // (lease.ts) and binds it to this window, so only here does Moovi hand out work (plan 21.2).
  mcp.registerPrompt('run', {
    title: 'Run Moovi',
    description: 'Let this Claude Code make the decisions for the video you started on the Moovi website.',
  }, async () => {
    ticket = await hub.gate.mintTicket(user);
    await hub.gate.useTicket(user, session, ticket);
    return { description: 'Moovi: be the brain for one video', messages: [{ role: 'user', content: { type: 'text', text: runPrompt(ticket) } }] };
  });

  mcp.registerTool('moovi_status', {
    title: 'Moovi status',
    description: 'Shows whether this Claude Code is connected to Moovi and what the user\'s videos are doing. Read only.',
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, async () => {
    await hub.presence.prime(user);
    const jobs = (await hub.board.recent(user)).slice(-5).map(j => ({ title: j.title, state: j.state, url: j.url }));
    return text({ connected: true, claude_code: hub.presence.state(user), this_window_has_run: !!ticket, jobs });
  });
  return mcp;
}
