import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { CRAFT, craft as C, run as runQ, user as U, userGraph } from '@contenteasy/graph';
import { ROLES, type SceneProgram } from '@contenteasy/skills';
import { z } from 'zod';
import { readJson } from '../bench';
import type { Handler } from '../ctx';
import { newId } from '../ids';
import { ask } from '../runtime';
import type { AssetOut, Board } from './film';
import type { Script } from './script';

/**
 * Keeper remembers. After a video ships, what it used joins the user's own graph (its assets by content hash, its
 * angle and hook, its preset sequence and bed), so the next video never repeats them and the over-use PageRank
 * learns. And every note the user gives becomes a lesson bound to the agents (and the law) it changes; a newer
 * lesson about the same thing supersedes the old one.
 */
export const keep: Handler = async ctx => {
  const m = (await ctx.out<{ style: string }>('match'))!;
  const S = (await ctx.out<Script>('script'))!;
  const BD = await ctx.out<Board>('board');
  const snd = await ctx.out<{ bed: { id: string } | null }>('sound');
  const card = ctx.run.card ?? (await ctx.out('card'));
  const assets = (await ctx.outs<AssetOut>('asset')).map(([, a]) => a).filter(a => a && !a.none && a.sha);
  const progs = new Map((await ctx.outs<{ scene: number; program: string }>('build')).map(([, v]) => [v.scene, v.program]));
  const programs = S.beats.map((_, i) => { const f = progs.get(i) ?? join(ctx.dir, 'scenes', `${i}.json`); return existsSync(f) ? readJson<SceneProgram>(f) : null; });
  const presets = programs.map(p => (p?.preset ? `${m.style}:${p.preset.id}` : `${m.style}:custom`));
  await ctx.uq(U.recordVideo, { video: ctx.run.video, project: ctx.pid, style: m.style, angle: S.angle, hook: S.hook, title: S.title, at: Date.now(), bed: snd?.bed?.id ?? null, card: card ? JSON.stringify(card) : null, presets });
  if (presets.length > 1) await ctx.uq(U.recordSequence, { video: ctx.run.video, pairs: presets.slice(1).map((b, i) => ({ a: presets[i]!, b })) });
  // drawn props are the style's own; only real assets count against reuse
  const real = assets.filter(a => a.kind !== 'drawn');
  if (real.length) await ctx.uq(U.recordAssets, { video: ctx.run.video, project: ctx.pid, at: Date.now(), rows: real.map(a => ({ hash: a.sha, kind: a.kind })) });
  void BD;
  await ctx.say(`Filed: next time I won’t take this angle again${real.length ? ` or reuse these ${real.length} asset${real.length > 1 ? 's' : ''}` : ''}.`, 'note');
  return { output: { assets: real.length, presets }, note: `${real.length} assets, angle remembered` };
};

/** Does a message carry a standing preference or a correction (as opposed to a one-off request)? A cheap rule first. */
export const NOTE = /\b(i (like|love|hate|prefer|want|don'?t want)|don'?t|never|always|too (fast|slow|loud|quiet|long|short|busy|plain|dark|bright)|more|less|stop|keep|avoid|instead|from now on|next time|in future|every time)\b/i;

/** Turn one user note into a lesson (or say it isn't one). Runs on the fast tier. */
export async function learn(o: { user: string; chat: string; style: string | null; text: string; signal?: AbortSignal }) {
  const laws = o.style ? await runQ<{ id: string; n: number; title: string }>(CRAFT, C.lawsAndChecks, { style: o.style }) : [];
  const g = userGraph(o.user);
  const r = await ask({
    agent: 'keeper', tier: 'fast', signal: o.signal, maxTurns: 4,
    system: 'You are Keeper in Moovi\'s crew. Decide whether the user\'s message states a standing preference or correction that should change future videos, and if so write it as one short imperative lesson.',
    prompt: `The user's message: "${o.text}"\n\nAgents: ${ROLES.join(', ')} (scribe = words, director = look and storyboard, builder = scenes and motion, hunter = assets, lens = review).\nLaws of the style: ${laws.map(l => `${l.id}: ${l.title}`).join(' · ') || '(none)'}`,
    schema: { lesson: z.object({ text: z.string().min(4).max(200), topic: z.string().min(2).max(40).describe('a short stable topic key, e.g. "music level", "voice speed", "colour"'), roles: z.array(z.enum(ROLES as unknown as [string, ...string[]])).max(4), law: z.string().nullable(), styleOnly: z.boolean() }).nullable() },
  });
  if (!r.lesson) return null;
  const at = Date.now(), id = newId('l');
  const older = await runQ<{ id: string }>(g, U.lessonsOnTopic, { topic: r.lesson.topic });
  await runQ(g, U.writeLesson, { id, text: r.lesson.text, topic: r.lesson.topic, roles: r.lesson.roles, law: r.lesson.law, style: r.lesson.styleOnly ? o.style : null, at, source: 'chat', chat: o.chat });
  for (const old of older) await runQ(g, U.supersedeLesson, { id, old: old.id, at });
  return { id, ...r.lesson, superseded: older.map(x => x.id) };
}
