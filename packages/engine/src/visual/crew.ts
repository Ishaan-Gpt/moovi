import { createHash } from 'node:crypto';
import { freemem } from 'node:os';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CRAFT, project as P, run as runQ } from '@moovi/graph';
import type { Handler, TaskCtx } from '../ctx';
import { config } from '../config';
import type { TaskSpec } from '../scheduler';
import { ensureDir, probe } from '../bench';
import { ensureArtifactLibrary, graphPrior, storePicks, artifactUsage, loadRatings, storeScores } from './graph';
import { failing, replanScenes, scoreScenes } from './critic';
import { openFilm, renderChunk } from './capture';
import { beatsFromVoice, eventsFor } from './film';
import { planFilm, needsFor, type PlanOptions } from './plan';
import { auditFilm, checkPlan } from './qa';
import type { BeatIn, VPlan } from './types';
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
  // the footage agent's clips and the researcher's scroll captures arrive as assets (kind footage / scroll): they go on screens and panels
  const clips = await Promise.all((await ctx.outs<AssetOut>('asset')).map(([, a]) => a).filter(a => a && !a.none && a.path && (a.kind === 'footage' || a.kind === 'scroll')).map(async a => ({ path: a.path, kind: a.kind as 'footage' | 'scroll', seconds: await probe(a.path).then(p => p.duration || 8).catch(() => 8) })));
  // the map and 3D posters the crew already made, and captures of the site, become poster panels
  const photos = (await ctx.outs<AssetOut>('asset')).map(([, a]) => a).filter(a => a && !a.none && a.path && ['map', 'look3d', 'capture'].includes(a.kind)).map(a => ({ path: a.path, kind: a.kind as 'map' | 'look3d' | 'capture' }));
  const beats = beatsFromVoice(S.beats.map(b => ({ say: b.say })), words, 30);
  ctx.note('casting the artifacts');
  await ensureArtifactLibrary();
  const prior = await graphPrior(beats.map((b, i) => needsFor(b, i, beats.length)));
  const rows = ((q: never, p: Record<string, unknown> = {}) => ctx.q(q, p)) as never;
  const used = await artifactUsage(rows).catch(() => ({}));
  const ratings = await loadRatings().catch(() => undefined);
  const opts: PlanOptions = { format: fmt, fps: 30, theme: card?.world === 'dark' ? 'dark' : 'light', seed: hashSeed(ctx.run.id), image: site, clips, photos, brand: B?.product ?? null, used, prior, ratings, picks: BD?.shots.map(s => s.stage ?? null) };
  const plan = planFilm(beats, opts);
  const stored = await storePicks(rows, ctx.run.id, plan);
  const dir = ensureDir(join(ctx.dir, 'visual')), file = join(dir, 'plan.json');
  writeFileSync(file, JSON.stringify(plan)); writeFileSync(join(dir, 'opts.json'), JSON.stringify({ ...opts, beats }));
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
    const n = Math.max(1, Math.min(config.slots.render, Math.floor(frames / 120), Math.floor(freemem() / 2 ** 30 / 0.9))), cuts = plan.scenes.map(s => Math.round(s.start * plan.fps)).filter(f => f > 0), bounds = [0];
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

/**
 * Lens in a visual run: the sampled frame audit, then the frame critic. Every scene is scored against the quality bar and the
 * scores go to FalkorDB (per scene, artifact and layout) for the next film's art director. Scenes below the bar are cast again
 * and only their frames are rendered again: one round, through the same send-back as the MotionEasy path (the chunks that
 * show those scenes, the sound events and the join are re-opened; nothing else is).
 */
export const visualReview: Handler = async ctx => {
  const { plan, file } = await planOf(ctx);
  ctx.note('auditing the frames');
  const s = await openFilm(plan, { scale: 0.5 });
  try {
    const audit = await auditFilm(s, plan), B = await ctx.out<{ seconds?: number }>('plan'), issues = [...checkPlan(plan, B?.seconds), ...audit.issues];
    const optsFile = join(ctx.dir, 'visual', 'opts.json'), opts = existsSync(optsFile) ? (JSON.parse(readFileSync(optsFile, 'utf8')) as PlanOptions & { beats: BeatIn[] }) : null;
    const scores = scoreScenes(plan, audit, { clipsAvailable: !!opts?.clips?.length });
    const rows = ((q: never, p: Record<string, unknown> = {}) => ctx.q(q, p)) as never, craftRows = ((q: never, p: Record<string, unknown> = {}) => runQ(CRAFT, q, p)) as never;
    await storeScores(rows, craftRows, ctx.run.id, plan, scores).catch(e => ctx.activity('note', `scores not kept: ${String(e).slice(0, 100)}`));
    const mean = scores.reduce((a, x) => a + x.score, 0) / Math.max(1, scores.length), round = (ctx.task.reopened ?? 0) + 1, bad = failing(scores);
    const notes = [...issues.slice(0, 4).map(i => i.detail), ...scores.filter(x => bad.includes(x.scene)).map(x => `scene ${x.scene + 1} scored ${x.score}/10`)].slice(0, 6);
    const summary = bad.length ? `${bad.length} scene${bad.length > 1 ? 's' : ''} below the bar` : 'every scene above the bar: footage, motion every second, depth, several elements, clean frames';
    if (bad.length && opts && round <= 1 && process.env.MOOVI_VISUAL_REDO !== '0') {
      const pool = { list: opts.clips ?? [], handed: (opts.clips ?? []).map(() => 0) }, re = replanScenes(plan, opts.beats, bad, opts, round, pool);
      writeFileSync(file, JSON.stringify(re.plan));
      for (const i of bad) await ctx.q(P.clearArtifacts, { scene: `${ctx.run.id}:scene:${i}` });
      await storePicks(rows, ctx.run.id, { ...re.plan, scenes: re.plan.scenes.filter(sc => bad.includes(sc.i)) });
      const renders = await ctx.q<{ id: string; scope: string }>(P.tasksOf, { run: ctx.run.id, kinds: ['render'] });
      const chunks = renders.filter(r => { const [a, b] = r.scope.replace('frames:', '').split('-').map(Number) as [number, number]; return re.ranges.some(([f0, f1]) => f0 < b && a < f1); }).map(r => r.id.slice(ctx.run.id.length + 1));
      await ctx.say(`Casting scene${bad.length > 1 ? 's' : ''} ${bad.map(i => i + 1).join(', ')} again (${scores.filter(x => bad.includes(x.scene)).map(x => x.score).join(', ')}/10): only those frames are rendered again.`, 'note');
      return { output: { score: +mean.toFixed(1), summary, notes, sentBack: bad, round, scores: scores.map(x => x.score) }, reopen: { keys: ['assemble', ...chunks, 'sound', 'mux', 'review'], feedback: {} }, note: `round ${round}: ${bad.length} scene${bad.length > 1 ? 's' : ''} recast` };
    }
    return { output: { score: +mean.toFixed(1), summary, notes, scores: scores.map(x => x.score) }, note: `${mean.toFixed(1)}/10${issues.length ? `, ${issues.length} issues` : ''}` };
  } finally { await s.close(); }
};
