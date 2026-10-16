import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { config } from '../config';
import { probe, sh } from '../bench';
import { ask } from '../runtime';
import { commonsPhoto, findClips, stillPush, type ClipCandidate } from '../footage';
import { castFootage, fetchPicked } from './cast';
import { words as stems } from '../footage/rank';
import { geocodeAll } from '../maps/geocode';
import { closeMaps, renderMap } from '../maps/capture';
import { tts } from '../styles/common';
import { runStyle } from '../styles/run';
import { buildTheme } from '../s1fast/theme';
import { fillPlan } from '../s1fast/fill';
import { closeRender } from '../render/host';
import { captionOver, closeCaptions, drawCaptions, type CapWord } from './captions-kit';
import { capturePlayer, closeCapture, captureMode, encodeFrames, type CaptureStats } from './capture';
import { BEAT_KINDS, DEFAULT_FAMILIES, FAMILIES, type FamilyId } from './palette';
import { footageShareOf, route, type Beat, type Segment, type VoiceRole } from './route';
import { serveS1 } from './s1live';
import { cleanS1Props } from './s1props';
import { model3dSegment, closeModel3d, modelObjects } from './model3d';

/**
 * One film from the whole palette. The director (one model call) writes the beats; the router gives each beat the
 * family that serves it: Ishaan's Style 1 templates (MotionEasy), Dark Vox, Anatomy; the agent's real footage
 * (Mixkit first), the globe map and a real 3D prop (a Poly Haven model, HDRI lit). Every line is voiced first (all at
 * once), so the film's clock is known before a single frame is drawn; then every segment is made at once on its own
 * fast path, while Ishaan's caption kit draws the captions for the whole film beside them. The cut joins the picture,
 * lays the captions over it, and mixes the voice with Style 1's own music bed and whooshes, in one encode. A segment
 * that fails becomes real footage, so a film always lands.
 */

export interface CombinedOptions {
  brief: string;
  seconds?: number;
  id?: string;
  families?: FamilyId[];
  footageShare?: number;
  narrator?: string;
  second?: string;
  log?: (s: string) => void;
  /** a stage starts / ends (the studio's status line) */
  stage?: (name: string, state: 'start' | 'done', seconds?: number) => void;
  signal?: AbortSignal;
}

export interface Component { side: 'ishaan' | 'vignesh'; what: string }
export interface SegmentOut extends Segment { file: string; voiceFile: string; duration: number; made: FamilyId; detail: string; ms: number; words: CapWord[]; components: Component[]; capture?: CaptureStats }
export interface CombinedResult { id: string; dir: string; out: string; seconds: number; title: string; segments: SegmentOut[]; footageShare: number; voices: Record<VoiceRole, string>; timings: Record<string, number>; captions: { look: string; drawn: number; ms: number } | null; captureMode: string }

const FPS = 30, W = 1080, H = 1920;
const ff = (args: string[], timeout = 300_000) => sh(config.ffmpeg, ['-v', 'error', '-y', ...args], { timeout });
export const secsOf = (brief: string) => Math.max(10, Math.min(90, Number(brief.match(/(\d{1,3})\s*(?:s\b|sec|second)/i)?.[1] ?? 30)));
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'film';

/** A small gate: at most `n` heavy (CPU) jobs at once, so captures do not starve each other on a 4 core box. */
function gate(n: number) {
  let on = 0; const q: (() => void)[] = [];
  return async <T>(f: () => Promise<T>): Promise<T> => {
    if (on >= n) await new Promise<void>(r => q.push(r));
    on++;
    try { return await f(); } finally { on--; q.shift()?.(); }
  };
}

const FAMILY_ENUM = ['footage', 'map', 's1', 'darkvox', 'anatomy', 's4', 's5', 'model3d', 'none'] as const;
const DirectorOut = {
  title: z.string(),
  accent: z.string().describe('one hex colour that suits the topic, e.g. #C8102E'),
  keyWords: z.array(z.string()).describe('3 to 6 single words to land in the caption accent'),
  beats: z.array(z.object({
    say: z.string(),
    kind: z.enum(BEAT_KINDS as [string, ...string[]]),
    footage: z.array(z.string()).describe('2 or 3 stock video searches for what is SEEN in this beat, most specific first, each 2 or 3 plain words a stock site titles clips with ("coffee cherries", "coffee harvest", "coffee plantation"); no place or brand names'),
    see: z.array(z.string()).describe('1 to 3 single nouns a matching clip MUST show (e.g. "cherries", "harvest", "plantation"): a clip whose title has none of them is the wrong clip'),
    places: z.array(z.string()).describe('real place names this beat names, or []'),
    voice: z.enum(['narrator', 'second']),
    family: z.enum(FAMILY_ENUM).describe('the family you want, or none'),
  })),
};

/** The director: the beats, each labelled with its kind, its footage, its places and its voice. One model call. */
export async function direct(brief: string, seconds: number, families: FamilyId[], o: { signal?: AbortSignal; log?: (s: string) => void; objects?: string[] } = {}) {
  const words = Math.round(seconds * 2.55);
  const palette = families.map(f => `- ${f}: ${FAMILIES[f].name} (${FAMILIES[f].from === 'ishaan' ? 'a house style' : 'the visual engine'}): ${FAMILIES[f].look}. Best for: ${FAMILIES[f].fits.join(', ')}.`).join('\n');
  return ask({
    agent: 'router:director', tier: 'crew', signal: o.signal, maxTurns: 4, deadlineMs: 60_000,
    system: 'You are the director of Moovi, a short video maker. You write a tight voice-over script as beats and label each beat so the right look draws it. Plain words, concrete nouns, true facts only (round numbers you are sure of), no hype, no exclamation marks, no em dashes or en dashes.',
    prompt: [
      `BRIEF: ${brief}`,
      `LENGTH: ${seconds} s of voice, about ${words} words in total (stay within 8 percent). 6 to 8 beats, each one or two short sentences.`,
      `THE PALETTE (one film should mix both: the house styles and the visual engine):\n${palette}`,
      'RULES:',
      '1. Beat 1 is the hook (kind hook): one surprising, concrete line, shown as real footage.',
      '2. Exactly one beat is a quote or line of dialogue from a person in the story (kind quote, voice second). Write it in first person, as that person would say it, without quote marks or a "said" tag; the narrator may set it up in the beat before.',
      '3. If the topic involves real places, one beat (kind place) names 2 to 4 of them in travel order and lists them in places. Otherwise no places anywhere.',
      '4. One beat explains how something works step by step (kind process), if the topic has a mechanism.',
      '5. One beat carries the key number (kind stat), short (under 9 words).',
      '6. Every beat has 2 or 3 footage searches and the nouns it must show (see), even styled beats, so any beat can fall back to footage. Searches name what a camera would film: people, objects, actions.',
      o.objects?.length && families.includes('model3d') ? `7. Real 3D models you can show (Poly Haven): ${o.objects.join(', ')}. Give one beat (not the hook, not the quote) family model3d when an object here belongs in the story (for example the basket pickers fill, the crate beans travel in), write that line around the object, and put the object's name first in see: the real model turns in soft light. Only an object from this list, and only where it is what the line is about.` : '7. (no 3D models for this topic)',
      '8. A stat or a short list beat gets family s1 (Style 1 kinetic type); the process beat gets anatomy; the quote gets darkvox.',
      '9. The last beat lands the payoff (kind cta or scene) and is short.',
    ].join('\n'),
    schema: DirectorOut,
    validate: d => {
      const n = d.beats.reduce((a, b) => a + b.say.trim().split(/\s+/).length, 0);
      if (n < words * 0.88 || n > words * 1.1) return `The beats have ${n} words; ${seconds} s needs ${Math.round(words * 0.9)} to ${Math.round(words * 1.08)}.`;
      if (d.beats.length < 5 || d.beats.length > 9) return `Write 5 to 9 beats (you wrote ${d.beats.length}).`;
      if (d.beats.filter(b => b.kind === 'quote').length !== 1) return 'Exactly one beat must be kind quote.';
      if (d.beats.some(b => /[\u2013\u2014]/.test(b.say))) return 'No em or en dashes in the lines.';
      if (d.beats.some(b => b.kind !== 'place' && b.places.length)) return 'Only the place beat lists places.';
      if (d.beats.some(b => !b.footage.length || !b.see.length)) return 'Every beat needs footage searches and see nouns.';
      return null;
    },
  });
}

/** Sentences on their own lines: the same lines (and so the same cached voice) the players speak. */
const lines = (text: string) => text.replace(/([.?!])\s+/g, '$1\n');

async function voiceInto(dir: string, text: string, voice: string, signal?: AbortSignal) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'script.txt'), lines(text) + '\n');
  const used = await tts(dir, voice, '+0%', { signal });
  const ws = JSON.parse(readFileSync(join(dir, 'words.json'), 'utf8')) as { word: string; t: number; end: number }[];
  return { used, words: ws, cap: ws.map(w => ({ word: w.word, start: w.t, end: w.end })) as CapWord[] };
}

/** Any video to the film's segment format: 1080x1920, 30 fps, exactly `frames` frames. */
async function fit(src: string, out: string, frames: number, vf = '') {
  await ff(['-i', src, '-an', '-vf', `${vf ? vf + ',' : ''}fps=${FPS},scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},tpad=stop_mode=clone:stop_duration=4,format=yuv420p`, '-frames:v', String(frames), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '16', '-g', '15', out]);
}

/** A clip shows the beat when its title or tags name one of the nouns the beat must show. */
export function shows(see: string[], c: { title: string; tags?: string[] }): boolean {
  const want = new Set(see.flatMap(s => stems(s)));
  if (!want.size) return true;
  return [...stems(c.title), ...(c.tags ?? []).flatMap(t => stems(t))].some(w => want.has(w));
}

/**
 * Real footage for a beat: the clips the footage editor picked for it (castFootage), downloaded in order until one
 * passes the quality check; then a Commons photo of the subject as a slow push-in; only then the closest clip.
 */
async function pickClip(seg: Segment, picked: ClipCandidate[], dir: string, seconds: number, used: Set<string>, o: CombinedOptions): Promise<{ clip: { provider: string; title: string; path: string }; how: string }> {
  const queries = (seg.queries?.length ? seg.queries : [seg.footage]).slice(0, 3), see = seg.see ?? [];
  const got = await fetchPicked(picked, join(dir, 'clips'), seconds, used);
  if (got) return { clip: got, how: 'picked by the footage editor' };
  for (const q of [...see.map(s => `${s} ${queries[0]!.split(/\s+/)[0]}`), ...queries]) {
    const photo = await commonsPhoto(q).catch(() => null);
    if (!photo || used.has(photo.ref)) continue;
    const out = join(dir, 'clips', 'still.mp4'); mkdirSync(join(dir, 'clips'), { recursive: true });
    try { await stillPush(photo.url, out, { seconds: Math.min(8, seconds), w: W, h: H }); used.add(photo.ref); return { clip: { provider: 'commons photo', title: photo.title, path: out }, how: `no clip showed it; a photo of "${q}"` }; } catch { /* next */ }
  }
  const any = await findClips(queries[0]!, { dir: join(dir, 'clips'), want: 1, tries: 3, seconds, skip: c => used.has(c.ref) || !shows(see, c), signal: o.signal });
  const c = any.accepted[0];
  if (!c?.path) throw new Error(`no footage for "${queries.join(' / ')}"`);
  used.add(c.ref);
  return { clip: { provider: c.provider, title: c.title, path: c.path }, how: 'closest clip naming the subject' };
}

/** Real footage, full screen: a slow push-in, a light grade; the captions come later, over the whole film. */
async function footageSegment(seg: Segment, picked: ClipCandidate[], dir: string, frames: number, used: Set<string>, o: CombinedOptions) {
  const dur = frames / FPS;
  const { clip, how } = await pickClip(seg, picked, dir, Math.max(6, dur + 1), used, o);
  const push = `scale=w='2*trunc(540*(1+0.08*t/${dur.toFixed(2)}))':h=-2:eval=frame,crop=${W}:${H}`;
  await ff(['-stream_loop', '-1', '-i', clip.path, '-an', '-vf', `fps=${FPS},scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},${push},eq=contrast=1.05:saturation=1.1,format=yuv420p`, '-frames:v', String(frames), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '16', '-g', '15', join(dir, 'seg.mp4')]);
  return { detail: `${clip.provider} "${clip.title}" (${how})`, provider: clip.provider };
}

async function mapSegment(seg: Segment, dir: string, frames: number) {
  const places = await geocodeAll(seg.places);
  if (places.length < 1) throw new Error(`no place found for ${seg.places.join(', ')}`);
  const fdir = join(dir, 'frames');
  // the globe: the flight over Natural Earth outlines (three.js); a third of the flat tiles' cost and it reads as 3D.
  // Drawn at half size and scaled up (its lines and labels hold up; a quarter of the pixels to draw)
  const st = await renderMap({ places, seconds: frames / FPS, fps: FPS, width: W / 2, height: H / 2, workers: 2, mode: (process.env.MOOVI_ROUTER_MAP as 'globe' | 'tiles' | undefined) ?? 'globe' }, fdir);
  const raw = join(dir, 'raw.mp4'); await encodeFrames(fdir, raw, FPS); rmSync(fdir, { recursive: true, force: true });
  await fit(raw, join(dir, 'seg.mp4'), frames);
  return `${st.mode} map ${places.map(p => p.name).join(' > ')} (${Math.round(st.totalMs / st.frames)} ms/frame)`;
}

async function playerSegment(style: 'darkvox' | 'anatomy', seg: Segment, dir: string, id: string, voice: string, accent: string, title: string, frames: number, heavy: ReturnType<typeof gate>, o: CombinedOptions) {
  const r = await runStyle(style, { script: lines(seg.text), brand: title, color: accent, voice, id: `${id}-${style}`, port: 0 }, { signal: o.signal });
  try {
    const cap = await heavy(() => capturePlayer(r.preview, join(dir, 'raw.mp4'), { to: frames / FPS, pages: 2 }));
    await fit(join(dir, 'raw.mp4'), join(dir, 'seg.mp4'), frames);
    return { cap, plan: r.timings };
  } finally { r.close(); }
}

async function s1Segment(seg: Segment, dir: string, id: string, words: { word: string; t: number; end: number }[], accent: string, title: string, brief: string, frames: number, heavy: ReturnType<typeof gate>) {
  // Style 1's fill runs in the data dir (its media paths are data-relative); the brand theme is made from the film's accent
  const sdir = join(config.data, 's1seg', id); mkdirSync(sdir, { recursive: true }); mkdirSync(join(config.data, 'brands'), { recursive: true });
  const brand = `film-${slug(id)}`;
  writeFileSync(join(config.data, 'brands', `${brand}.json`), JSON.stringify(buildTheme({ name: title, primary: accent, secondary: '#1F6F4A', tertiary: '#E0A33A', font: 'inter-std' }), null, 1));
  for (const f of ['vo.wav', 'words.json', 'script.txt']) copyFileSync(join(dir, f), join(sdir, f));
  await fillPlan({ dir: sdir, id, brand, words: words as never, site: null, name: title, brief: `Topic: ${brief}. This part of the film says: "${seg.text}". Facts: only what the line says. This film is not about an app or a phone: prefer templates that show numbers, bursts, stat badges and kinetic titles.`, log: () => undefined });
  await closeRender();
  const removed = cleanS1Props(join(sdir, `${id}.json`), `${brief} ${seg.text}`);
  const live = await serveS1(sdir, id);
  try {
    const cap = await heavy(() => capturePlayer(live.url, join(dir, 'raw.mp4'), { to: frames / FPS, pages: 2, mode: 'exact' }));
    await fit(join(dir, 'raw.mp4'), join(dir, 'seg.mp4'), frames);
    const spec = JSON.parse(readFileSync(join(sdir, `${id}.json`), 'utf8'));
    const fill = existsSync(join(sdir, 'fill.json')) ? JSON.parse(readFileSync(join(sdir, 'fill.json'), 'utf8')) : null;
    const templates = (fill?.answer?.scenes ?? []).map((s: { template: string }) => s.template);
    const props = [...new Set(JSON.stringify(spec).match(/"draw":"[a-z0-9]+"/g) ?? [])].map(s => s.slice(8, -1));
    return { cap, templates, props, removed };
  } finally { live.close(); }
}

export async function combinedFilm(o: CombinedOptions): Promise<CombinedResult> {
  const t0 = Date.now(), T: Record<string, number> = {}, log = o.log ?? (s => console.log(s));
  const lap = (k: string, s: number) => { T[k] = +((Date.now() - s) / 1000).toFixed(1); log(`${k} ${T[k]}s`); o.stage?.(k, 'done', T[k]); };
  const begin = (k: string) => { o.stage?.(k, 'start'); return Date.now(); };
  const seconds = o.seconds ?? secsOf(o.brief), families = o.families ?? DEFAULT_FAMILIES;
  const narrator = o.narrator ?? 'en-US-AndrewMultilingualNeural', second = o.second ?? 'en-US-AvaMultilingualNeural';
  const id = o.id ?? `${slug(o.brief)}-${Date.now().toString(36)}`;
  const dir = join(config.data, 'combined', id); mkdirSync(dir, { recursive: true });
  const heavy = gate(Number(process.env.MOOVI_ROUTER_HEAVY ?? 2));

  let s = begin('director');
  const objects = families.includes('model3d') ? await modelObjects(o.brief).catch(() => [] as string[]) : [];
  const d = await direct(o.brief, seconds, families, { ...o, objects });
  lap('director', s);
  const accent = /^#[0-9a-f]{6}$/i.test(d.accent.trim()) ? d.accent.trim() : '#C8102E';
  const beats: Beat[] = d.beats.map(b => ({ say: b.say, kind: b.kind as Beat['kind'], footage: b.footage[0] ?? b.see[0] ?? 'city', queries: b.footage, see: b.see, places: b.places, voice: b.voice as VoiceRole, family: b.family === 'none' ? undefined : (b.family as FamilyId) }));
  const segs = route(beats, { families, footageShare: o.footageShare ?? 0.35 });
  writeFileSync(join(dir, 'route.json'), JSON.stringify({ brief: o.brief, title: d.title, accent, keyWords: d.keyWords, beats, segments: segs }, null, 1));
  log(segs.map((g, i) => `  ${i + 1}. ${g.family.padEnd(8)} ${g.voice.padEnd(8)} ${g.seconds}s  "${g.text}"  [${g.why}]`).join('\n'));

  // the footage editor casts clips for every segment (any can fall back to footage) while the lines are voiced
  const sc = Date.now(); o.stage?.('footage', 'start');
  const castP = castFootage(segs.map((g, i) => ({ i, text: g.text, queries: g.queries ?? [g.footage], see: g.see ?? [] })), { signal: o.signal, log })
    .then(c => { T.footage_cast = +((Date.now() - sc) / 1000).toFixed(1); o.stage?.('footage', 'done', T.footage_cast); log(`footage cast: ${c.candidates} candidates, ${[...c.picks.values()].filter(p => p.length).length}/${segs.length} beats with a pick (${T.footage_cast}s)`); return c; })
    .catch(e => { log(`footage cast failed: ${(e as Error).message.slice(0, 160)}`); return null; });

  // every line voiced at once: the film's clock (each segment is its voice plus a breath) is known before any frame
  s = begin('voice');
  const voiceOf = (r: VoiceRole) => (r === 'second' ? second : narrator);
  const voices = await Promise.all(segs.map((seg, i) => voiceInto(join(dir, `seg${i + 1}`), seg.text, voiceOf(seg.voice), o.signal)));
  const framesOf = segs.map((_, i) => Math.round((voices[i]!.words.at(-1)!.end + (i === segs.length - 1 ? 0.7 : 0.3)) * FPS));
  const starts = framesOf.reduce<number[]>((a, f, i) => [...a, i ? a[i - 1]! + framesOf[i - 1]! : 0], []);
  const total = framesOf.reduce((a, b) => a + b, 0);
  lap('voice', s);

  // Ishaan's captions for the whole film, drawn beside the segments (they only need the words and the clock). A beat
  // whose family writes its own words on screen (Style 1's kinetic type, Anatomy's labels) keeps them and gets none.
  s = Date.now(); o.stage?.('captions', 'start');
  const ownWords = (f: FamilyId) => f === 's1' || f === 'anatomy';
  const capWords: CapWord[] = segs.flatMap((seg, i) => ownWords(seg.family) ? [] : voices[i]!.cap.map(w => ({ ...w, start: +(w.start + starts[i]! / FPS).toFixed(3), end: +(w.end + starts[i]! / FPS).toFixed(3) })));
  const capKeys = [...new Set([...d.keyWords, ...segs.flatMap(g => g.see ?? [])].map(k => k.toLowerCase()))];
  const capP = drawCaptions(capWords, total, { dir: join(dir, 'captions'), keywords: capKeys, pages: 2, mute: segs.map((g, i) => ownWords(g.family) ? [starts[i]!, starts[i]! + framesOf[i]!] as [number, number] : null).filter((x): x is [number, number] => !!x) })
    .then(c => { T.captions = +((Date.now() - s) / 1000).toFixed(1); o.stage?.('captions', 'done', T.captions); return c; })
    .catch(e => { log(`captions failed: ${(e as Error).message.slice(0, 200)}`); return null; });

  // every segment at once, each on its own fast path; one that fails becomes footage
  s = begin('segments');
  const used = new Set<string>();
  const made: SegmentOut[] = await Promise.all(segs.map(async (seg, i): Promise<SegmentOut> => {
    const sdir = join(dir, `seg${i + 1}`), st = Date.now(), frames = framesOf[i]!, v = voices[i]!;
    const asFootage = async (why: string) => {
      const cast = await castP;
      // the editor's picks for this beat, then unused picks of other beats that must show one of the same nouns
      const mine = cast?.picks.get(i) ?? [], see = new Set(seg.see ?? []);
      const near = [...(cast?.picks.entries() ?? [])].filter(([k]) => k !== i && (segs[k]!.see ?? []).some(n => see.has(n))).flatMap(([, v]) => v.slice(1));
      const f = await footageSegment(seg, [...mine, ...near], sdir, frames, used, o);
      return { made: 'footage' as FamilyId, detail: why ? `${f.detail} (fell back: ${why})` : f.detail, components: [{ side: 'vignesh' as const, what: `${f.provider} footage, full screen push-in` }] };
    };
    let res: { made: FamilyId; detail: string; components: Component[]; capture?: CaptureStats };
    try {
      if (seg.family === 'darkvox' || seg.family === 'anatomy') {
        const p = await playerSegment(seg.family, seg, sdir, id, voiceOf(seg.voice), accent, d.title, frames, heavy, o);
        res = { made: seg.family, capture: p.cap, detail: `${FAMILIES[seg.family].name}: plan ${JSON.stringify(p.plan)}; ${p.cap.mode} capture ${p.cap.frames} frames at ${p.cap.msPerFrame} ms/frame on ${p.cap.pages} pages`, components: [{ side: 'ishaan', what: `${FAMILIES[seg.family].name} style pipeline (plan, pictures, player)` }] };
      } else if (seg.family === 'map') {
        res = { made: 'map', detail: await heavy(() => mapSegment(seg, sdir, frames)), components: [{ side: 'vignesh', what: 'globe map flight (maps engine)' }] };
      } else if (seg.family === 's1') {
        const r = await s1Segment(seg, sdir, `${id}-s1`, v.words, accent, d.title, o.brief, frames, heavy);
        res = { made: 's1', capture: r.cap, detail: `Style 1 templates ${r.templates.join(', ')}; props ${r.props.join(', ') || 'none'}${r.removed.length ? ` (off-topic props removed: ${r.removed.join(', ')})` : ''}; capture ${r.cap.frames} frames at ${r.cap.msPerFrame} ms/frame`, components: [{ side: 'ishaan', what: `Style 1 templates ${r.templates.join(', ')} on MotionEasy (kinetic type, effects, camera keys${r.props.length ? `, props ${r.props.join('/')}` : ''})` }] };
      } else if (seg.family === 'model3d') {
        // real footage the editor picked for the beat first, then the object itself as a real 3D model; with no picked
        // clip the model holds the whole beat (a stock photo of some other basket is worse than none)
        const cast = await castP, picked = cast?.picks.get(i) ?? [];
        const half = picked.length ? Math.round(frames / 2) : 0;
        const m3 = (n: number, dir: string) => heavy(() => model3dSegment({ see: seg.see ?? [], queries: seg.queries ?? [seg.footage], text: seg.text, topic: `${seg.text} ${o.brief}`.toLowerCase().split(/\W+/).filter(w => w.length > 3), accent, frames: n, fps: FPS, out: join(dir, 'seg.mp4'), dir }));
        const ftP = half ? fetchPicked(picked, join(sdir, 'a', 'clips'), Math.max(6, half / FPS + 1), used) : Promise.resolve(null);
        const [clip, m] = await Promise.all([ftP, m3(frames - (half ? half : 0), half ? join(sdir, 'b') : sdir)]);
        if (half && clip) {
          const dur = half / FPS, push = `scale=w='2*trunc(540*(1+0.08*t/${dur.toFixed(2)}))':h=-2:eval=frame,crop=${W}:${H}`;
          await ff(['-stream_loop', '-1', '-i', clip.path, '-an', '-vf', `fps=${FPS},scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},${push},eq=contrast=1.05:saturation=1.1,format=yuv420p`, '-frames:v', String(half), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '16', '-g', '15', join(sdir, 'a', 'seg.mp4')]);
          writeFileSync(join(sdir, 'parts.txt'), `file '${join(sdir, 'a', 'seg.mp4')}'\nfile '${join(sdir, 'b', 'seg.mp4')}'\n`);
          await ff(['-f', 'concat', '-safe', '0', '-i', join(sdir, 'parts.txt'), '-c', 'copy', join(sdir, 'seg.mp4')]);
          res = { made: 'model3d', detail: `${clip.provider} "${clip.title}" (picked by the footage editor), then ${m.detail}`, components: [{ side: 'vignesh', what: `${clip.provider} footage (first half)` }, { side: 'vignesh', what: `3D render (three.js) of Poly Haven model ${m.model} lit by Poly Haven HDRI ${m.hdri} (second half)` }] };
        } else {
          if (half) { const all = await m3(frames, join(sdir, 'full')); copyFileSync(join(sdir, 'full', 'seg.mp4'), join(sdir, 'seg.mp4')); res = { made: 'model3d', detail: all.detail, components: [{ side: 'vignesh', what: `3D render (three.js) of Poly Haven model ${all.model} lit by Poly Haven HDRI ${all.hdri}` }] }; }
          else res = { made: 'model3d', detail: m.detail, components: [{ side: 'vignesh', what: `3D render (three.js) of Poly Haven model ${m.model} lit by Poly Haven HDRI ${m.hdri}` }] };
        }
      } else if (seg.family === 'footage') res = await asFootage('');
      else throw new Error(`${seg.family} is not wired into the combined film`);
    } catch (e) {
      if (seg.family === 'footage') throw e;
      log(`segment ${i + 1} (${seg.family}) failed: ${(e as Error).message.slice(0, 300)}`);
      res = await asFootage(`${seg.family} failed: ${(e as Error).message.slice(0, 80)}`);
    }
    const out: SegmentOut = { ...seg, file: join(sdir, 'seg.mp4'), voiceFile: join(sdir, 'vo.wav'), duration: frames / FPS, made: res.made, detail: res.detail, ms: Date.now() - st, words: v.cap, components: res.components, capture: res.capture };
    log(`  segment ${i + 1} ${res.made} ${out.duration.toFixed(2)}s in ${(out.ms / 1000).toFixed(1)}s: ${res.detail}`);
    return out;
  }));
  lap('segments', s);
  await Promise.all([closeCapture(), closeMaps(), closeRender(), closeModel3d()]).catch(() => undefined);
  const caps = await capP;
  await closeCaptions();

  // the cut: picture joined; one voice track (each segment's voice padded to its picture); Style 1's bed and whooshes;
  // the captions laid over; one encode
  s = begin('cut');
  const list = join(dir, 'list.txt'); writeFileSync(list, made.map(m => `file '${m.file}'`).join('\n') + '\n');
  const pic = join(dir, 'picture.mp4');
  await ff(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', pic]);
  const vparts: string[] = [];
  for (const [i, m] of made.entries()) { const f = join(dir, `v${i}.wav`); await ff(['-i', m.voiceFile, '-af', `aresample=48000,apad,atrim=0:${m.duration.toFixed(3)}`, '-ac', '1', f]); vparts.push(f); }
  const voice = join(dir, 'voice.wav');
  await ff([...vparts.flatMap(f => ['-i', f]), '-filter_complex', `${vparts.map((_, i) => `[${i}:a]`).join('')}concat=n=${vparts.length}:v=0:a=1[a]`, '-map', '[a]', voice]);
  const secs = total / FPS;
  const cuts = starts.slice(1).map(f => f / FPS);
  const bed = join(config.assets, 'music', 'bed.mp3'), whoosh = join(config.assets, 'sfx', 'fs.whoosh.swosh-whoosh-air-cut.wav');
  const mixIn = ['-i', voice, '-stream_loop', '-1', '-i', bed, ...cuts.flatMap(() => ['-i', whoosh])];
  const wh = cuts.map((c, k) => `[${k + 2}:a]adelay=${Math.max(0, Math.round((c - 0.18) * 1000))}:all=1,volume=0.45[w${k}]`).join(';');
  const graph = `[1:a]atrim=0:${secs.toFixed(3)},volume=0.16,afade=t=in:d=0.4,afade=t=out:st=${Math.max(0, secs - 1).toFixed(2)}:d=1[b];${wh}${wh ? ';' : ''}[0:a][b]${cuts.map((_, k) => `[w${k}]`).join('')}amix=inputs=${2 + cuts.length}:normalize=0:duration=first,loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000[m]`;
  const master = join(dir, 'master.wav');
  await ff([...mixIn, '-filter_complex', graph, '-map', '[m]', '-t', secs.toFixed(3), master]);
  const out = join(dir, `${id}.mp4`);
  const enc = ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-maxrate', '3800k', '-bufsize', '7600k', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart'];
  if (caps) await captionOver(pic, master, out, caps, total, enc);
  else await ff(['-i', pic, '-i', master, '-map', '0:v', '-map', '1:a', ...enc, '-shortest', out], 600_000);
  lap('cut', s);
  T.total = +((Date.now() - t0) / 1000).toFixed(1);
  const pr = await probe(out);
  // real footage seconds as cut: footage segments whole, a 3D prop beat's first half when it opened on a clip
  const share = made.reduce((a, m) => a + (m.made === 'footage' ? m.duration : m.made === 'model3d' && m.components.length > 1 ? Math.round((m.duration * FPS) / 2) / FPS : 0), 0) / Math.max(0.001, made.reduce((a, m) => a + m.duration, 0));
  for (const m of made) if (!ownWords(m.made) && caps) m.components.push({ side: 'ishaan', what: `captions: CaptionsEasy ${caps.look} (MotionEasy) on our word timings` });
  const res: CombinedResult = { id, dir, out, seconds: +pr.duration.toFixed(2), title: d.title, segments: made, footageShare: +share.toFixed(3), voices: { narrator, second }, timings: T, captions: caps ? { look: caps.look, drawn: caps.drawn, ms: caps.ms } : null, captureMode: captureMode() };
  writeFileSync(join(dir, 'report.json'), JSON.stringify({ ...res, segments: made.map(({ words: _w, ...m }) => m), bytes: existsSync(out) ? statSync(out).size : 0 }, null, 1));
  return res;
}
