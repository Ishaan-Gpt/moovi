import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { config } from '../src/config';
import { closeVisual, openFilm, renderFilm } from '../src/visual/capture';
import { auditFilm, checkPlan } from '../src/visual/qa';
import { planFilm } from '../src/visual/plan';
import type { BeatIn } from '../src/visual/types';
import { beatsFromVoice, makeFilm } from '../src/visual/film';
import { readFileSync } from 'node:fs';
import { kit } from '@moovi/skills';

/**
 * The visual system, from the terminal (no model, no voice: the sample script is spoken at 2.6 words a second).
 *   tsx scripts/visual.ts stills  [vertical|landscape|square] [light|dark]   a still of every scene, mid-scene
 *   tsx scripts/visual.ts film    [vertical|landscape|square] [light|dark]   render the film (needs ffmpeg for the mp4)
 *   tsx scripts/visual.ts make <script.json> [words.json] [audio.wav] [vertical|landscape|square] [light|dark]
 *       a film from a script ({ beats: [{ say }] } or an array of lines) with the voice's word times ([{ word, t, end }]; reading pace
 *       when none) and the voice (muxed in), checked and audited; the mp4 goes to data/visual/film.mp4
 *   SITE=file-in-data-dir.png  uses that capture for the browser mockup and the brand tile
 */
const argv = process.argv.slice(2), cmd0 = argv[0] ?? 'stills';
const [cmd = 'stills', fmtArg = 'vertical', themeArg = 'light'] = cmd0 === 'make' ? ['make', argv[4] ?? 'vertical', argv[5] ?? 'light'] : argv;
const format = fmtArg as 'vertical' | 'landscape' | 'square', theme = themeArg as 'light' | 'dark';
const dir = join(config.data, 'visual'); mkdirSync(dir, { recursive: true });

const SCRIPT = [
  'Most small teams lose hours every week to messy spreadsheets.',
  'Meet Bluetoki: one place for your orders, stock and customers.',
  'We grew 40% in 6 months, with 1,200 happy customers.',
  'It connects your shop, your phone and your team, everywhere.',
  'Set it up in minutes, track every order, and never miss a sale.',
  'Try Bluetoki free today.',
];
const WPS = 2.6;
let t = 0;
const beats: BeatIn[] = SCRIPT.map(text => { const n = text.split(/\s+/).length, d = Math.max(3.2, n / WPS + 0.6), b = { text, start: t, end: t + d }; t += d; return b; });
if (cmd === 'make') {
  const raw = JSON.parse(readFileSync(argv[1]!, 'utf8')) as { beats?: { say: string }[] } | string[];
  const lines = (Array.isArray(raw) ? raw : raw.beats ?? []).map(b => (typeof b === 'string' ? { say: b } : b));
  const words = argv[2] && argv[2] !== '-' ? (JSON.parse(readFileSync(argv[2], 'utf8')) as { word: string; t: number; end: number }[]) : kit.readingPace(lines);
  const r = await makeFilm({ beats: beatsFromVoice(lines, words, 30), format, theme, seed: Number(process.env.SEED) || 7, brand: process.env.BRAND ?? null, image: process.env.SITE ? join(config.data, process.env.SITE) : null, askedSeconds: Number(process.env.ASKED) || undefined, dir, out: join(dir, 'film.mp4'), audio: argv[3] && argv[3] !== '-' ? argv[3] : undefined, audit: true });
  console.log('issues:', r.issues.length ? r.issues : 'none'); console.log(r.stats);
  await closeVisual(); process.exit(0);
}
const clipFiles = (process.env.CLIPS ?? '').split(',').filter(Boolean).map((f, i) => ({ path: join(config.data, f), kind: (i % 2 ? 'scroll' : 'footage') as 'footage' | 'scroll', seconds: Number(process.env.CLIP_SECONDS) || 8 }));
const plan = planFilm(beats, { clips: clipFiles, format, theme, seed: Number(process.env.SEED) || 7, brand: 'Bluetoki', image: process.env.SITE ? join(config.data, process.env.SITE) : null });
if (process.env.NO3D) for (const s of plan.scenes) s.elements = s.elements.filter(e => !e.art.startsWith('obj:'));
writeFileSync(join(dir, 'plan.json'), JSON.stringify(plan, null, 1));
console.log(`${plan.scenes.length} scenes, ${plan.seconds.toFixed(1)} s, ${format}/${theme}`);
for (const s of plan.scenes) console.log(`  ${s.i} ${s.layout.padEnd(12)} ${s.elements.map(e => e.art).join(' + ')}  | ${s.ambient.join(' ')} | ${s.camera} ${s.transition ?? '-'}`);

if (cmd === 'audit') {
  const issues = checkPlan(plan, Number(process.env.ASKED) || undefined); console.log('plan checks:', issues.length ? issues : 'clean');
  const sess = await openFilm(plan, { scale: 0.5 }), t0 = performance.now(); const a = await auditFilm(sess, plan); await sess.close();
  console.log(`frame audit (${a.framesRendered} frames, ${((performance.now() - t0) / 1000).toFixed(1)} s):`, a.issues.length ? a.issues : 'clean');
  console.log('motion per second:', a.perSecond.map(s => `${s.second}:${s.energy}`).join(' '));
} else if (cmd === 'prof') {
  // every 10th frame of the whole film on one page: the per-scene cost (transitions included) and the average
  const sess = await openFilm(plan, { scale: Number(process.env.SCALE) || 0.6667 });
  const per = new Map<number, number[]>(); const total = Math.round(plan.seconds * plan.fps); let sum = 0, cnt = 0;
  for (let n = 3; n < total; n += 10) { const t0 = performance.now(); await sess.frame(n); const ms = performance.now() - t0; const sc = [...plan.scenes].reverse().find(s => n / plan.fps >= s.start)!.i; (per.get(sc) ?? per.set(sc, []).get(sc)!).push(ms); sum += ms; cnt++; }
  console.log(`avg ${(sum / cnt).toFixed(0)} ms/frame over ${cnt} frames; per scene: ${[...per].map(([i, a]) => `${i}: ${(a.reduce((x, y) => x + y, 0) / a.length).toFixed(0)}`).join('  ')}`);
  const pr = await sess.prof(); console.log(`in page: paint ${((pr.paint ?? 0) / (pr.n ?? 1)).toFixed(1)} ms, jpeg encode ${((pr.enc ?? 0) / (pr.n ?? 1)).toFixed(1)} ms per frame`);
  if (pr.sections) console.log(Object.entries(pr.sections).sort((a, b) => b[1].ms / b[1].n - a[1].ms / a[1].n).map(([k, s]) => `${k.padEnd(22)} ${(s.ms / s.n).toFixed(1).padStart(6)} ms  x${s.n}`).join(String.fromCharCode(10)));
  await sess.close();
} else if (cmd === 'stills') {
  const sess = await openFilm(plan, { scale: 0.5 });
  console.log('renderer:', sess.info.renderer, `${sess.info.rw}x${sess.info.rh}`);
  for (const s of plan.scenes) { const n = Math.round((s.start + Math.min(2.6, (s.end - s.start) * 0.62)) * plan.fps); const t0 = performance.now(); writeFileSync(join(dir, `scene-${s.i}.jpg`), await sess.frame(n)); console.log(`scene ${s.i} frame ${n}: ${(performance.now() - t0).toFixed(0)} ms`); }
  await sess.close();
} else {
  const out = join(dir, `film-${format}-${theme}.mp4`);
  const r = await renderFilm(plan, dir, { scale: Number(process.env.SCALE) || 0.6667, out: process.env.NOENC ? undefined : out, keepFrames: !!process.env.KEEP, workers: Number(process.env.WORKERS) || undefined });
  console.log(r);
}
await closeVisual();
