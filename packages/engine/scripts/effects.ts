/**
 * Effects film from the terminal: a clip + a plan (effect cues on words, or events on the clock) -> MP4.
 *   tsx scripts/effects.ts --video clip.mp4 --plan plan.json --out film.mp4 [--remix: keep the rendered picture, redo the sound]
 *   [--music bed.mp3] [--under 6] [--duck 3] [--music-from 0]
 * plan.json: { words: [{word,t,end}], cues?: [{fx, at, hold?, params?}], events?: [{fx,t0,t1,params?}],
 *   titles?: [{text,t0,t1}], voice?: 'clip' | {file, at}, duration?: number, segments?: [{t0, t1, from}] }
 * `segments` maps output time to clip time (a demo that jumps through the clip): output [t0,t1) plays the clip from `from`.
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { checkFx, placeFx, remixFxFilm, renderFxFilm, type FxCue, type FxEvent, type FxWord } from '../src/edit/effects';

const arg = (k: string) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : undefined; };
const video = resolve(arg('video') ?? ''), out = resolve(arg('out') ?? 'effects.mp4'), planFile = resolve(arg('plan') ?? '');
const plan = JSON.parse(readFileSync(planFile, 'utf8')) as { words: FxWord[]; cues?: FxCue[]; events?: FxEvent[]; titles?: { text: string; t0: number; t1: number }[]; voice?: 'clip' | { file: string; at?: number }; duration?: number; segments?: { t0: number; t1: number; from: number }[] };
let events: FxEvent[] = plan.events ?? [];
if (plan.cues) { const p = placeFx(plan.words, plan.cues, plan.duration); events = [...events, ...p.events]; if (p.missed.length) console.error('cues not placed:', p.missed.join(', ')); }
events.sort((a, b) => a.t0 - b.t0);
const problems = checkFx(events);
if (problems.length) console.error('rule problems:', JSON.stringify(problems));
const music = arg('music');
const segs = plan.segments;
const holdAfter = (plan as { holdAfter?: number }).holdAfter;
const clipTime0 = segs ? (t: number) => { const s = segs.find(x => t >= x.t0 && t < x.t1) ?? segs[segs.length - 1]!; return s.from + (t - s.t0); } : undefined;
// holdAfter: the picture holds its frame from this output time on (an outro after the take ends, no blurry last frames)
const clipTime = holdAfter !== undefined ? (t: number) => Math.min(clipTime0 ? clipTime0(t) : t, clipTime0 ? clipTime0(holdAfter) : holdAfter) : clipTime0;
const t0 = Date.now();
const r = await (process.argv.includes('--remix') ? remixFxFilm : renderFxFilm)({
  video, out, work: arg('work') ?? join(dirname(out), '.fx-work'), events, words: plan.words, ...(plan.titles ? { titles: plan.titles } : {}),
  voice: plan.voice ?? 'clip', music: music ? { file: resolve(music), under: Number(arg('under') ?? 6), duck: Number(arg('duck') ?? 3), from: Number(arg('music-from') ?? 0) } : null,
  ...(plan.duration ? { duration: plan.duration } : {}), ...(clipTime ? { clipTime } : {}),
  onFrame: (i, n) => { if (i % 60 === 0) console.error(`frame ${i}/${n} ${((Date.now() - t0) / 1000).toFixed(0)}s`); },
});
console.log(JSON.stringify({ ...r, events: events.map(e => `${e.fx}@${e.t0.toFixed(2)}-${e.t1.toFixed(2)}`), problems }));
