import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { project as P } from '@moovi/graph';
import type { Handler, TaskCtx } from '../ctx';
import { config } from '../config';
import type { TaskSpec } from '../scheduler';
import { ensureDir } from '../bench';
import { ensureArtifactLibrary, graphPrior, storePicks, artifactUsage } from './graph';
import { openFilm, renderChunk } from './capture';
import { beatsFromVoice, eventsFor } from './film';
import { planFilm, needsFor } from './plan';
import { auditFilm, checkPlan } from './qa';
import type { VPlan } from './types';
import type { FormatId } from './layouts';
import type { Script } from '../tasks/script';
import type { AssetOut, Board } from '../tasks/film';
import { formatOf, wordsOf } from '../tasks/film';

/**
 * The crew's visual renderer, switched on with MOOVI_RENDERER=visual (the default stays the MotionEasy renderer). The
 * Art Director's board picks a layout and artifacts per scene; instead of one Shot Builder per scene, one `build` task
 * plans the whole film from the script, the voice's word times, the board and the real assets (the site capture); the
 * Editor's `assemble` checks the plan and splits the frames into chunks, `render` renders a chunk, and the existing
 * sound mix, mux, delivery and memory steps run unchanged. Lens skips the MotionEasy contact sheet and reports the
 * visual audits (motion, empty frames, caption band, length).
 */
export const visualOn = () => (process.env.MOOVI_RENDERER ?? '').trim().toLowerCase() === 'visual';

const hashSeed = (s: string) => parseInt(createHash('sha1').update(s).digest('hex').slice(0, 7), 16);

/** the one `build` task of a visual run */
export const visualBuild: Handler = async ctx => {
  const S = (await ctx.out<Script>('script'))!, words = await wordsOf(ctx), format = (await formatOf(ctx)) as string;
  const fmt: FormatId = format === 'landscape' ? 'landscape' : 'vertical';
  const BD = await ctx.out<Board>('board'), B = await ctx.out<{ seconds?: number; product?: string | null }>('plan');
  const card = (ctx.run.card ?? (await ctx.out<{ world?: string }>('card'))) as { world?: string } | null;
  // the real picture of the brand's site, when the Asset Hunter found one: browser mockups and the brand tile use it
  const site = (await ctx.outs<AssetOut>('asset')).map(([, a]) => a).find(a => a && !a.none && a.path && a.kind === 'capture')?.path ?? null;
  const beats = beatsFromVoice(S.beats.map(b => ({ say: b.say })), words, 30);
  ctx.note('casting the artifacts');
  await ensureArtifactLibrary();
  const prior = await graphPrior(beats.map((b, i) => needsFor(b, i, beats.length)));
  const rows = ((q: never, p: Record<string, unknown> = {}) => ctx.q(q, p)) as never;
  const used = await artifactUsage(rows).catch(() => ({}));
  const plan = planFilm(beats, { format: fmt, fps: 30, theme: card?.world === 'dark' ? 'dark' : 'light', seed: hashSeed(ctx.run.id), image: site, brand: B?.product ?? null, used, prior, picks: BD?.shots.map(s => s.stage ?? null) });
  const stored = await storePicks(rows, ctx.run.id, plan);
  const dir = ensureDir(join(ctx.dir, 'visual')), file = join(dir, 'plan.json');
  writeFileSync(file, JSON.stringify(plan));
  const issues = checkPlan(plan, B?.seconds);
  return { output: { scene: -1, program: file, scenes: plan.scenes.length, seconds: plan.seconds, picks: stored, issues: issues.length }, note: `${plan.scenes.length} scenes, ${stored} artifacts picked${issues.length ? `, ${issues.length} plan issue${issues.length > 1 ? 's' : ''}` : ''}` };
};

const planOf = async (ctx: TaskCtx): Promise<{ plan: VPlan; file: string }> => {
  const b = (await ctx.out<{ program: string }>('build:visual')) ?? (await ctx.outs<{ program: string; scene: number }>('build')).map(([, v]) => v).find(v => v.scene === -1);
  if (!b || !existsSync(b.program)) throw new Error('The visual plan is missing');
  return { plan: JSON.parse(readFileSync(b.program, 'utf8')) as VPlan, file: b.program };
};

/** Check the plan, write the sound events, split the frames into chunks (cut at scene boundaries where they fall near). */
export const visualAssemble: Handler = async ctx => {
  const { plan, file } = await planOf(ctx), frames = Math.round(plan.seconds * plan.fps);
  const B = await ctx.out<{ seconds?: number }>('plan');
  const issues = checkPlan(plan, B?.seconds);
  const events = join(ctx.dir, 'events.json'), qaFile = join(ctx.dir, 'qa.json');
  writeFileSync(events, JSON.stringify(eventsFor(plan).map(e => ({ ...e }))));
  writeFileSync(qaFile, JSON.stringify({ issues, renderer: 'visual' }));
  const existing = await ctx.q<{ id: string }>(P.tasksOf, { run: ctx.run.id, kinds: ['render'] });
  let spawn: TaskSpec[] = [];
  if (!existing.length) {
    const n = Math.max(1, Math.min(config.slots.render, Math.floor(frames / 120))), cuts = plan.scenes.map(s => Math.round(s.start * plan.fps)).filter(f => f > 0), bounds = [0];
    for (let j = 1; j < n; j++) { const ideal = Math.round((frames * j) / n), near = cuts.reduce((b, c) => (Math.abs(c - ideal) < Math.abs(b - ideal) ? c : b), ideal); bounds.push(Math.abs(near - ideal) < frames / (n * 3) ? near : ideal); }
    bounds.push(frames);
    spawn = bounds.slice(0, -1).map((from, j) => ({ key: `render:${from}-${bounds[j + 1]}`, kind: 'render', agent: 'editor', resource: 'render' as const, title: `Render frames ${from}–${bounds[j + 1]}`, scope: `frames:${from}-${bounds[j + 1]}`, input: { from, to: bounds[j + 1], visual: true }, deps: ['assemble'], max: 2 }));
  }
  return { output: { spec: file, events, qaFile, frames, scenes: plan.scenes.length, qa: issues.length, matched: 1, tokens: 0 }, spawn, note: `${plan.seconds.toFixed(1)} s, ${issues.length} plan issue${issues.length === 1 ? '' : 's'}` };
};

/** One chunk of frames as a silent mp4 (the `mux` step joins the chunks and the sound). */
export const visualRender: Handler = async ctx => {
  const { from, to } = ctx.input<{ from: number; to: number }>();
  const { plan } = await planOf(ctx);
  const out = join(ensureDir(join(ctx.dir, 'chunks')), `${String(from).padStart(5, '0')}-${to}.mp4`);
  ctx.note(`rendering ${(from / plan.fps).toFixed(0)}–${(to / plan.fps).toFixed(0)} s`);
  const r = await renderChunk(plan, from, to, ctx.dir, out, { scale: Number(process.env.MOOVI_VISUAL_SCALE) || 0.6667 });
  return { output: { file: out, from, to, frames: r.frames, msPerFrame: Math.round(r.ms / Math.max(1, r.frames)) }, note: `${r.frames} frames, ${Math.round(r.ms / Math.max(1, r.frames))} ms/frame` };
};

/** Lens in a visual run: the sampled frame audit instead of the MotionEasy contact sheet. */
export const visualReview: Handler = async ctx => {
  const { plan } = await planOf(ctx);
  ctx.note('auditing the frames');
  const s = await openFilm(plan, { scale: 0.5 });
  try {
    const audit = await auditFilm(s, plan), B = await ctx.out<{ seconds?: number }>('plan'), issues = [...checkPlan(plan, B?.seconds), ...audit.issues];
    const notes = issues.slice(0, 6).map(i => i.detail);
    return { output: { score: issues.length ? Math.max(5, 9 - issues.length) : 9, summary: issues.length ? `${issues.length} visual issue${issues.length > 1 ? 's' : ''}` : 'motion every second, no empty frames, captions clear, length on the ask', notes }, note: issues.length ? `${issues.length} issues` : 'clean' };
  } finally { await s.close(); }
};

