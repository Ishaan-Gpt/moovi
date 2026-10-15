import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { CRAFT, craft as C, project as P, run as runQ, SYS, sys as S, user as U } from '@contenteasy/graph';
import type { EngineSpec, Ev, SceneProgram } from '@contenteasy/skills';
import { artifacts, bed, benchStatus, concat, ensureDir, libraryTrack, loudness, mixMaster, mux as benchMux, ownerBed, poster, probe, readJson, sfxStem, writeJson } from '../bench';
import { config } from '../config';
import type { Handler } from '../ctx';
import { publish } from '../bus';
import { boxes, chunk } from '../render/host';
import { geometry, layerOf, platformZone } from '../render/qa';
import type { TaskSpec } from '../scheduler';
import { checkParams } from './builder';
import { filmKit } from './film';

/** The Editor's desk: plain code. Assemble the scenes into one film, render it in parallel chunks, mix and master
 * the sound, join them, deliver. */

export const assemble: Handler = async ctx => {
  const F = await filmKit(ctx);
  const k = F.kit;
  const progs = new Map((await ctx.outs<{ scene: number; program: string }>('build')).map(([, v]) => [v.scene, v.program]));
  const compiled = k.scenes.map((_, i) => {
    const f = progs.get(i) ?? join(ctx.dir, 'scenes', `${i}.json`);
    if (!existsSync(f)) throw new Error(`Scene ${i + 1} has no program`);
    return k.compile(i, readJson<SceneProgram>(f));
  });
  const a = k.assemble(compiled);
  writeJson(join(ctx.dir, 'film.json'), a.spec);
  writeJson(join(ctx.dir, 'events.json'), a.events);
  ctx.note('checking every frame');
  const every = 3;
  const bx = await boxes(a.spec, Array.from({ length: Math.ceil(k.frames / every) }, (_, n) => n * every), 30);
  // the platform zone comes from the same craft-graph check the Shot Builders were held to; qa.json records it for Lens
  const platform = F.format === 'vertical' ? platformZone((await checkParams(F.style)).get('safeZone')?.p) : null;
  const qa = geometry(bx, { fps: 30, every, format: F.format, entering: f => a.timeline.scenes.some(sc => sc.enter && f >= sc.f0 && f < sc.f0 + 24), platform, layer: layerOf(a.timeline) });
  writeJson(join(ctx.dir, 'qa.json'), { issues: qa, report: a.report, platform });
  // render chunks: one per render slot (at least ~4 s each), cut at scene boundaries where possible
  const existing = await ctx.q<{ id: string }>(P.tasksOf, { run: ctx.run.id, kinds: ['render'] });
  let spawn: TaskSpec[] = [];
  if (!existing.length) {
    const n = Math.max(1, Math.min(config.slots.render, Math.floor(k.frames / 120)));
    const cuts = a.timeline.scenes.map(s => s.f0).filter(f => f > 0);
    const bounds = [0];
    for (let j = 1; j < n; j++) { const ideal = Math.round((k.frames * j) / n); const near = cuts.reduce((b, c) => (Math.abs(c - ideal) < Math.abs(b - ideal) ? c : b), ideal); bounds.push(Math.abs(near - ideal) < k.frames / (n * 3) ? near : ideal); }
    bounds.push(k.frames);
    spawn = bounds.slice(0, -1).map((from, j) => ({ key: `render:${from}-${bounds[j + 1]}`, kind: 'render', agent: 'editor', resource: 'render' as const, title: `Render frames ${from}–${bounds[j + 1]}`, scope: `frames:${from}-${bounds[j + 1]}`, input: { from, to: bounds[j + 1] }, deps: ['assemble'], max: 2 }));
  }
  return { output: { spec: join(ctx.dir, 'film.json'), events: join(ctx.dir, 'events.json'), qaFile: join(ctx.dir, 'qa.json'), frames: k.frames, scenes: a.report.scenes, qa: qa.length, matched: a.report.matched, tokens: a.report.tokens }, spawn, note: `${(k.frames / 30).toFixed(1)} s, ${qa.length} QA issue${qa.length === 1 ? '' : 's'}` };
};

export const render: Handler = async ctx => {
  const { from, to } = ctx.input<{ from: number; to: number }>();
  const spec = readJson<EngineSpec>((await ctx.out<{ spec: string }>('assemble'))!.spec);
  const out = join(ensureDir(join(ctx.dir, 'chunks')), `${String(from).padStart(5, '0')}-${to}.mp4`);
  ctx.note(`rendering ${(from / 30).toFixed(0)}–${(to / 30).toFixed(0)} s`);
  const t0 = Date.now();
  const r = await chunk(spec, from, to, out);
  const ms = Date.now() - t0;
  return { output: { file: out, from, to, frames: r.frames, msPerFrame: Math.round(ms / Math.max(1, r.frames)) }, note: `${r.frames} frames, ${Math.round(ms / Math.max(1, r.frames))} ms/frame` };
};

export const sound: Handler = async ctx => {
  const m = (await ctx.out<{ style: string }>('match'))!;
  const A = (await ctx.out<{ events: string; frames: number }>('assemble'))!;
  const v = (await ctx.out<{ wav: string | null }>('voice')) ?? (await ctx.out<{ wav: string | null }>('transcribe'));
  const seconds = A.frames / 30;
  const dir = ensureDir(join(ctx.dir, 'sound'));
  const bench = await benchStatus();
  const events = readJson<Ev[]>(A.events);
  let sfx: string | undefined;
  if (bench.sfx) { ctx.note('placing the sound effects'); sfx = await sfxStem(dir, events); }
  // the bed: Style 1 uses the owner's bed from its strong beat; a unique style takes a library bed by its card
  const card = (ctx.run.card ?? (await ctx.out<{ sound?: { bedMood: string; bpm: number } }>('card'))) as { sound?: { bedMood: string; bpm: number } } | null;
  const recent = (await ctx.uq<{ bed: string }>(U.recentBeds, { n: 3 })).map(b => b.bed);
  let bedInfo: { id: string; file: string; start: number; bpm: number; credit: string } | null = null;
  const own = m.style === 's1' ? ownerBed() : null;
  if (own && !recent.includes('owner:style-1')) bedInfo = { id: 'owner:style-1', ...own, credit: '' };
  else {
    const mood = card?.sound?.bedMood ?? 'uplifting';
    const [t] = await runQ<{ id: string; src: string; offset: number; bpm: number; credit: string }>(CRAFT, C.tracks, { moods: [mood, 'uplifting', 'driving'], avoid: recent, energy: 0.65, bpm: card?.sound?.bpm ?? 120 });
    if (t && existsSync(libraryTrack(t.src))) bedInfo = { id: t.id, file: libraryTrack(t.src), start: t.offset, bpm: t.bpm, credit: t.credit };
    else if (own) bedInfo = { id: 'owner:style-1', ...own, credit: '' };
  }
  let music: string | undefined;
  if (bedInfo) { ctx.note('cutting the music'); music = await bed(dir, { file: bedInfo.file, start: bedInfo.start, bpm: bedInfo.bpm, seconds }); }
  const voice = v?.wav && existsSync(v.wav) ? v.wav : undefined;
  if (!voice && !music && !sfx) return { output: { master: null, bed: null }, note: 'no sound bench' };
  ctx.note('mastering');
  const adj = ctx.input<{ bedLu?: number | null; sfxDb?: number | null }>();
  const mx = await mixMaster(dir, { seconds, voice, music, sfx, bedLu: adj.bedLu ?? 3, sfxDb: adj.sfxDb ?? 6 });
  return { output: { master: mx.file, lufs: mx.lufs, peak: mx.peak, bed: bedInfo ? { id: bedInfo.id, credit: bedInfo.credit } : null, events: events.length }, note: `${mx.lufs.toFixed(1)} LUFS, peak ${mx.peak.toFixed(1)} dB` };
};

export const mux: Handler = async ctx => {
  const chunks = (await ctx.outs<{ file: string; from: number }>('render')).map(([, v]) => v).filter(Boolean).sort((a, b) => a.from - b.from);
  if (!chunks.length) throw new Error('No rendered chunks');
  const snd = await ctx.out<{ master: string | null }>('sound');
  const [vid] = await ctx.q<{ version: number }>(P.chat, { id: ctx.chat });
  const version = (vid?.version ?? 0) + 1;
  const vdir = ensureDir(join(ctx.projectDir, 'videos', ctx.chat));
  const picture = await concat(chunks.map(c => c.file), join(ctx.dir, 'picture.mp4'));
  const final = await benchMux(picture, snd?.master ?? null, join(vdir, `v${version}.mp4`));
  const pr = await probe(final);
  const post = await poster(final, Math.min(pr.duration * 0.35, 6), join(vdir, `v${version}.jpg`));
  return { output: { file: final, poster: post, version, duration: +pr.duration.toFixed(2), size: statSync(final).size, width: pr.width, height: pr.height }, note: `${pr.duration.toFixed(1)} s, ${(statSync(final).size / 2 ** 20).toFixed(1)} MB` };
};

export const deliver: Handler = async ctx => {
  const mx = (await ctx.out<{ file: string; poster: string; version: number; duration: number; width: number; height: number }>('mux'))!;
  const rv = await ctx.out<{ score: number | null; summary: string; notes: string[] }>('review');
  const m = (await ctx.out<{ style: string }>('match'))!;
  const fmt = (mx.height ?? 1920) >= (mx.width ?? 1080) ? 'vertical' : 'landscape';
  await ctx.q(P.setVideo, { id: ctx.run.video, status: 'ready', path: mx.file, poster: mx.poster, duration: mx.duration, version: mx.version, style: m.style, format: fmt, at: Date.now() });
  await ctx.q(P.setChat, { id: ctx.chat, title: null, status: 'ready', at: Date.now() });
  const vids = await ctx.q<{ video: string }>(P.videos);
  const chats = await ctx.q<{ id: string }>(P.chats);
  await runQ(SYS, S.touchProject, { id: ctx.pid, name: null, chats: chats.length, videos: vids.length, poster: `${ctx.chat}/v${mx.version}.jpg`, at: Date.now() });
  const lufs = (await ctx.out<{ lufs: number }>('sound'))?.lufs;
  await publish(ctx.chat, { type: 'video', video: { id: ctx.run.video, status: 'ready', version: mx.version, duration: mx.duration, format: fmt } });
  const text = `Here it is: ${mx.duration.toFixed(1)} s${lufs !== undefined ? `, mastered at ${lufs.toFixed(1)} LUFS` : ''}.${rv?.score ? ` Lens gives it ${rv.score}/10.` : ''}${rv?.notes?.length ? ` Notes: ${rv.notes.slice(0, 2).join(' ')}` : ''} Ask me for any change.`;
  await ctx.say(text, 'video', { video: ctx.run.video, version: mx.version, duration: mx.duration, format: fmt, run: ctx.run.id }, 'moovi');
  return { output: { version: mx.version }, note: `v${mx.version} delivered` };
};

export { artifacts, loudness };
