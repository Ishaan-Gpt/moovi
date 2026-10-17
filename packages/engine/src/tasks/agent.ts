import { CRAFT, craft as C, MemoryDown, project as P, run as runQ, user as U } from '@moovi/graph';
import type { Role } from '@moovi/skills';
import type { TaskCtx } from '../ctx';
import { loadMemory, memoryBlock, NO_MEMORY, type FilmRef, type Memory, type MemoryRole } from '../memory';
import { AGENT_NAMES, agentOf } from '../events';
import { model, runWithFallback, type Tier, type Tool } from '../runtime';
import { resultText } from '../runtime/tool';

/**
 * What every agent thinks with, read from the graphs at the moment it works: its sections of the style's skill and
 * the laws it is checked against (craft graph), and the lessons this user taught (their own graph). Nothing about
 * the style is hard-coded into a prompt here.
 */
export async function knowledge(ctx: TaskCtx, role: Role, style: string) {
  const sections = await runQ<{ title: string; text: string }>(CRAFT, C.skillFor, { style, role });
  const laws = await runQ<{ n: number; title: string; text: string; checks: { id: string; about: string; blocking: boolean; params: string }[] }>(CRAFT, C.lawsAndChecks, { style });
  const lessons = await ctx.uq<{ id: string; text: string; law: string | null }>(U.lessonsFor, { role, style });
  return {
    sections, laws, lessons,
    text: [
      `# The style's rules for you (${style})`, sections.map(s => `## ${s.title}\n${s.text}`).join('\n\n') || '(none)',
      '# The laws your work is checked against', laws.map(l => `${l.n}. ${l.title}: ${l.text}`).join('\n'),
      '# What this user has taught the crew (follow these over the style where they differ)', lessons.length ? lessons.map(l => `- ${l.text}`).join('\n') : '(nothing yet)',
    ].join('\n\n'),
  };
}

/** What this user's earlier edits and rejections say (named queries on their own graph); a graph with no notes answers empty. */
export async function feedbackMemory(ctx: TaskCtx, role: MemoryRole): Promise<{ mem: Memory; block: string }> {
  const t0 = performance.now();
  // a user graph with no notes yet may not exist: that is an empty memory; a memory that is down still stops the film
  const mem = await loadMemory((query, params) => ctx.uq(query, params)).catch(e => { if (e instanceof MemoryDown) throw e; return NO_MEMORY; });
  const block = memoryBlock(mem, role);
  if (!mem.empty) void ctx.activity('tool', `graph · feedback memory: ${mem.rejectedStyles.length} styles turned down, ${mem.rewrittenLines.length} lines rewritten, ${mem.rejectedShots.length} shots sent back (${(performance.now() - t0).toFixed(0)} ms)`);
  return { mem, block };
}

/** The film (and the run of it) a note is about: this task's own run, or the run the user was looking at (`runId`). */
export async function filmRef(ctx: TaskCtx, runId: string = ctx.run.id, title: string | null = null): Promise<FilmRef> {
  const [r] = runId === ctx.run.id ? [{ n: ctx.run.n, skill: ctx.run.skill, brief: ctx.run.brief }] : await ctx.q<{ n: number; skill: string | null; brief: Record<string, unknown> | string | null }>(P.run, { id: runId });
  const brief = typeof r?.brief === 'string' ? (() => { try { return JSON.parse(r.brief) as { title?: string }; } catch { return null; } })() : (r?.brief as { title?: string } | null);
  return { user: ctx.user, project: ctx.pid, run: runId, runN: r?.n ?? 1, video: ctx.run.video, style: r?.skill ?? ctx.run.skill, title: title ?? brief?.title ?? null };
}

export const ROLE_LINE: Record<Role, string> = {
  moovi: 'the director: you read the brief, plan the video, talk to the user and keep the crew on course',
  researcher: 'the researcher: you find the facts the video may say, each with its source',
  scribe: 'the scribe: you write what the voice says, and every claim rests on a fact',
  director: 'the art director: you design the look and board every shot, never the first idea',
  hunter: 'the asset hunter: you find real assets (captures, logos, the user’s own media) and never one this user used before',
  builder: 'the shot builder: you build one scene on the kit, look at its frames and fix it until it is clean and premium',
  lens: 'the critic: you review the finished film against the laws and send scenes back to whoever owns the problem',
  keeper: 'the keeper: you turn the user’s notes into lessons the next videos follow',
};

export function systemFor(role: Role, job: string, know: string) {
  const name = AGENT_NAMES[agentOf(role)];
  return `You are ${name}, ${ROLE_LINE[role]}, in Moovi's crew (a video studio run by AI agents).
${job}
Work only through your tools. Never invent facts, numbers, URLs or asset ids. Be decisive; don't ask the user questions (Moovi does that).

${know}`;
}

/** Run an agent for this task: its tools, its model tier (escalated after failed attempts), the activity it shows. */
export async function agentRun(ctx: TaskCtx, o: { role: Role; tier: Tier; system: string; prompt: string; tools: Tool[]; maxTurns?: number; deadlineMs?: number; escalate?: boolean }) {
  const tier: Tier = o.escalate && (ctx.task.attempts > 1 || (ctx.task.reopened ?? 0) > 1) ? 'director' : o.tier;
  const r = await runWithFallback({
    agent: `${o.role}:${ctx.key}`, system: o.system, prompt: o.prompt, tools: o.tools, model: model(tier),
    maxTurns: o.maxTurns ?? 24, deadlineMs: o.deadlineMs ?? 8 * 60_000, signal: ctx.signal,
    onTool: (name, _args, result, ms) => { void ctx.activity('tool', `${name}${result.error ? ` ✗ ${result.error.slice(0, 120)}` : ` · ${resultText(result).slice(0, 110)}`} (${(ms / 1000).toFixed(1)} s)`); },
    onNote: n => ctx.note(n),
  }, tier);
  return { ...r, model: model(r.tier) };
}
