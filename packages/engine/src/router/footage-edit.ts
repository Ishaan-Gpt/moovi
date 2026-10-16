import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { z } from 'zod';
import { config } from '../config';
import { sh, probe } from '../bench';
import { ask } from '../runtime';
import { transcribeWords, sttAvailable } from '../audio/stt';
import { searchAll, fetchPicked } from './cast';
import { drawCaptionsS1, closeCaptionsS1, warmCaptionsS1 } from './captions-s1';
import { drawCaptions, closeCaptions, type CapWord, type Captions } from './captions-kit';
import { drawKinetic, closeKinetic, warmKinetic, fontCss, type Kinetic } from './kinetic';
import { wallFilter } from './wall';

/**
 * Footage edit: Moovi edits the user's own raw clip (a talking-head or walk-and-talk take) into a short reel. His own
 * voice stays the soundtrack. Stages:
 *  1. hear: every word with its time (a local Whisper when the box has one, else the engine's speech-to-text), and in
 *     parallel an accurate transcript (a stronger model without timings) whose words are laid onto the timed ones;
 *  2. cut: the set-up talk before the take (a slate cue, or the last long pause of the opening), ums and uhs and every
 *     pause longer than a breath go (pauses read from the loudness, relative to the clip's own noise floor); jump
 *     cuts keep a little air either side;
 *  3. frame: the take is scaled to 1080x1920 and every jump cut alternates a punch-in, with a slow push inside each cut;
 *  4. captions: Ishaan's "I'm your caption" look (Style 1 chip + serif gold key word) on the cut word timings, in the
 *     lower third, never over the face; the CaptionsEasy pop look is the fallback;
 *  5. cards: a model picks 3 or 4 key words for a small card in the top corner beside the face (a stock clip, a
 *     title card for the product name, a running timer for a duration), clips fetched at render time;
 *  6. mix and encode: voice cleaned and levelled to about -14 LUFS, the repo's music bed low under it; each cut is
 *     rendered by its own ffmpeg at the same time, then one final pass lays the overlays and encodes.
 * Shots (round 2, built against creator reels): a shot change on every cut and every ~1.5 s inside long ones (whip
 * pan, zoom through, orbit, frame break, punch-ins with light flashes), a wall of videos fly-through (wall.ts), the
 * phone pull-back with a list, the product name behind the speaker's head, a face-tracking label, an animated end card.
 */
export interface Word { word: string; t: number; end: number; p?: number }
export interface Seg { a: number; b: number; zoom: number }
export interface FootageEditReport {
  input: string; out: string; duration: number; sourceDuration: number; transcript: string; heard: string;
  removed: { words: string[]; why: string }[]; words: Word[]; segs: Seg[]; cards: Card[]; captions: string; keywords: string[];
  stages: Record<string, number>; total: number;
}

const bare = (w: string) => w.toLowerCase().replace(/[^a-z0-9']/g, '');
const clean = (w: string) => w.replace(/[“”"]/g, '').replace(/[,;:.!?]+$/, '');
const run = (cmd: string, args: string[], timeout = 120_000, env?: NodeJS.ProcessEnv) => new Promise<string>((res, rej) =>
  execFile(cmd, args, { timeout, killSignal: 'SIGKILL', maxBuffer: 64e6, env: env ?? process.env }, (e, out, err) => e ? rej(new Error(`${e.message.slice(0, 200)} ${String(err).slice(-400)}`)) : res(out)));

// ---------- 1. hear ----------
const WHISPER_PY = `
import json, sys
from faster_whisper import WhisperModel
m = WhisperModel(sys.argv[2], device="cpu", compute_type="int8", cpu_threads=4)
segs, _ = m.transcribe(sys.argv[1], word_timestamps=True, beam_size=1, language="en", condition_on_previous_text=False, initial_prompt=sys.argv[3] or None)
print(json.dumps([{"word": w.word.strip(), "t": round(w.start, 3), "end": round(w.end, 3), "p": round(w.probability, 3)} for s in segs for w in s.words]))
`;

/**
 * Timed words. OpenAI's whisper-1 with word timings answers a 30 s clip in about 2 s; a local faster-whisper
 * (MOOVI_WHISPER_PY names its python) is used when no OpenAI key is set, then the engine's own speech-to-text.
 */
export async function timedWords(audio: string, dir: string, prompt = ''): Promise<{ words: Word[]; by: string }> {
  if (process.env.OPENAI_API_KEY) {
    // whisper-1 sometimes stops after the opening of a noisy take; two asks at once (with and without the prompt),
    // the one that heard more of the clip wins. Same wall time as one.
    const asks = await Promise.all([prompt, ''].map(p => openaiTranscribe(audio, 'whisper-1', p, true).catch(() => null)));
    const reach = (ws: Word[]) => ws.length + 4 * ws.filter(w => w.t > (ws.at(-1)?.end ?? 0) * 0.5).length + (ws.at(-1)?.end ?? 0);
    const best = asks.filter((a): a is { text: string; words: Word[] } => !!a?.words.length).sort((a, b) => reach(b.words) - reach(a.words))[0];
    if (best) return { words: best.words, by: 'whisper-1' };
  }
  const py = process.env.MOOVI_WHISPER_PY;
  if (py && existsSync(py)) {
    try {
      const model = process.env.MOOVI_WHISPER_MODEL ?? 'base.en';
      const out = await run(py, ['-c', WHISPER_PY, audio, model, prompt], 120_000);
      const ws = (JSON.parse(out.trim().split('\n').at(-1)!) as Word[]).filter(w => w.word);
      if (ws.length) return { words: ws, by: `faster-whisper ${model}` };
    } catch { /* next */ }
  }
  return { words: (await transcribeWords(audio, dir)).map(w => ({ word: w.word, t: w.t, end: w.end ?? w.t })), by: 'engine stt' };
}

/** OpenAI's transcription endpoint (MOOVI_OPENAI_BASE may point at a proxy); `timed` asks for word timings. */
async function openaiTranscribe(file: string, model: string, prompt: string, timed: boolean): Promise<{ text: string; words: Word[] }> {
  const key = process.env.OPENAI_API_KEY; if (!key) throw new Error('no OpenAI key');
  const base = (process.env.MOOVI_OPENAI_BASE ?? 'https://api.openai.com').replace(/\/$/, '');
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(readFileSync(file))], { type: 'audio/mpeg' }), 'audio.mp3');
  form.append('model', model); form.append('language', 'en');
  if (prompt) form.append('prompt', prompt);
  form.append('response_format', timed ? 'verbose_json' : 'json');
  if (timed) form.append('timestamp_granularities[]', 'word');
  const r = await fetch(`${base}/v1/audio/transcriptions`, { method: 'POST', headers: { authorization: `Bearer ${key}` }, body: form, signal: AbortSignal.timeout(90_000) });
  if (!r.ok) throw new Error(`transcription answered ${r.status}`);
  const j = await r.json() as { text?: string; words?: { word: string; start: number; end: number }[] };
  return { text: j.text ?? '', words: (j.words ?? []).map(w => ({ word: w.word.trim(), t: w.start, end: w.end })) };
}

/** The accurate transcript (no timings), or null when no such model is reachable. */
export async function cleanText(audio: string, prompt: string, alt?: string): Promise<string | null> {
  return (await cleanTexts(audio, prompt, alt)).sort((a, b) => b.length - a.length)[0] || null;
}

/**
 * Every accurate-text answer (the whole clip with and without the names prompt, and the clip after its opening): on a
 * noisy take one answer sometimes stops early, answers the set-up talk in another script, or drifts. Non-Latin runs are
 * dropped; empty answers are left out.
 */
export async function cleanTexts(audio: string, prompt: string, alt?: string, model = process.env.MOOVI_TEXT_MODEL ?? 'gpt-4o-transcribe'): Promise<string[]> {
  if (!process.env.OPENAI_API_KEY) return [];
  const asks: [string, string][] = [[audio, prompt], [audio, ''], ...(alt ? [[alt, prompt] as [string, string], [alt, ''] as [string, string]] : [])];
  const got = await Promise.all(asks.map(([f, p]) => openaiTranscribe(f, model, p, false).then(r => r.text.replace(/[^\u0000-\u024F\u2018-\u201D\s]+[^.?!]*[.?!]?/g, ' ').replace(/\s+/g, ' ').trim()).catch(() => '')));
  return got.filter(Boolean);
}

/** How many words of `text` agree with the timed words, in order (longest common subsequence on bare words). */
export function agreement(text: string, timed: Word[]): number {
  const A = text.split(/\s+/).map(bare).filter(Boolean), T = timed.map(w => bare(w.word));
  let prev = new Int16Array(T.length + 1);
  for (const a of A) { const cur = new Int16Array(T.length + 1); for (let j = 0; j < T.length; j++) cur[j + 1] = a === T[j] ? prev[j]! + 1 : Math.max(prev[j + 1]!, cur[j]!); prev = cur; }
  return prev[T.length]!;
}

/**
 * The accurate text to trust: the answer that agrees with the most timed words (a wrong-language or drifting answer
 * agrees with few), longer on a tie; none when even the best agrees with under a third of what was timed.
 */
export function pickText(cands: string[], timed: Word[]): string | null {
  const scored = cands.map(c => ({ c, a: agreement(c, timed) })).sort((x, y) => y.a - x.a || y.c.length - x.c.length);
  return scored[0] && scored[0].a >= Math.max(3, timed.length / 3) ? scored[0].c : null;
}

/**
 * The brief's own names (the hint), heard any near way ("Moviez", "Movies", "Moovie" for "Moovi"): a word whose sound
 * key (lower case, doubled letters collapsed, a trailing s, z or e dropped) matches the name's is written as the name.
 */
export function nameFix(ws: Word[], names: string[]): Word[] {
  const key = (w: string) => bare(w).replace(/(.)\1+/g, '$1').replace(/[sz]$/, '').replace(/e$/, '');
  const ks = names.filter(n => /^[A-Za-z][\w']{2,}$/.test(n)).map(n => ({ n, k: key(n) })).filter(x => x.k.length >= 3);
  const out = ws.map(w => { const hit = ks.find(x => key(w.word) === x.k && bare(w.word) !== bare(x.n)); return hit ? { ...w, word: hit.n + (w.word.match(/[.,!?;:]+$/)?.[0] ?? '') } : w; });
  // a two-word term heard with its first word wrong ("software media" for "social media"): the second word matches, the
  // first starts with the same letter and is about as long
  for (const t of names.map(n => n.split(/\s+/)).filter(t => t.length === 2)) {
    const [a, b] = t.map(bare) as [string, string];
    for (let i = 0; i + 1 < out.length; i++) {
      const x = bare(out[i]!.word), y = bare(out[i + 1]!.word);
      if (y === b && x !== a && x[0] === a[0] && Math.abs(x.length - a.length) <= 3 && !/[.,!?;:]$/.test(out[i]!.word)) out[i] = { ...out[i]!, word: t[0]! };
    }
  }
  return out;
}

/** Apply the brief's corrections ("movies" -> "Moovi", "software media" -> "social media"), keeping each word's punctuation and timing. */
export function fixWords(ws: Word[], fixes: Record<string, string>): Word[] {
  const out = ws.map(w => ({ ...w }));
  for (const [from, to] of Object.entries(fixes)) {
    const f = from.toLowerCase().split(/\s+/).map(bare), t = to.split(/\s+/);
    for (let i = 0; i + f.length <= out.length; i++) {
      if (!f.every((x, k) => bare(out[i + k]!.word) === x)) continue;
      const tail = out[i + f.length - 1]!.word.match(/[.,!?;:]+$/)?.[0] ?? '';
      t.forEach((x, k) => { if (k < f.length) out[i + k]!.word = x + (k === t.length - 1 ? tail : ''); });
      if (t.length < f.length) { out[i + t.length - 1]!.end = out[i + f.length - 1]!.end; out.splice(i + t.length, f.length - t.length); }
    }
  }
  return out;
}

/**
 * Lay the accurate words onto the timed ones: a longest-common-subsequence match on bare words anchors the shared
 * words; each run of accurate words between two anchors takes the time span of the timed words between them (or of the
 * gap), split by length. Timed words with no counterpart are kept (they are said; the accurate model may skip a slate).
 */
export function align(timed: Word[], text: string): Word[] {
  const acc = text.split(/\s+/).filter(Boolean);
  const A = acc.map(bare), T = timed.map(w => bare(w.word));
  const n = A.length, m = T.length, L = Array.from({ length: n + 1 }, () => new Int16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i]![j] = A[i] === T[j] && A[i] ? L[i + 1]![j + 1]! + 1 : Math.max(L[i + 1]![j]!, L[i]![j + 1]!);
  const pairs: [number, number][] = [];
  for (let i = 0, j = 0; i < n && j < m;) { if (A[i] === T[j] && A[i]) { pairs.push([i, j]); i++; j++; } else if (L[i + 1]![j]! >= L[i]![j + 1]!) i++; else j++; }
  if (pairs.length < Math.max(2, acc.length * 0.3) || acc.length < timed.length * 0.6) return timed; // too different, or the text stopped early
  const out: Word[] = [];
  const anchors: [number, number][] = [[-1, -1], ...pairs, [n, m]];
  for (let k = 0; k < anchors.length - 1; k++) {
    const [i0, j0] = anchors[k]!, [i1, j1] = anchors[k + 1]!;
    if (i0 >= 0) out.push({ ...timed[j0]!, word: acc[i0]! });
    const accRun = acc.slice(i0 + 1, i1), tRun = timed.slice(j0 + 1, j1);
    if (!accRun.length) {
      // timed-only words the accurate text skipped: a run longer than a stray word is speech, keep it
      if (k === 0 || k === anchors.length - 2 || tRun.length > 2) out.push(...tRun);
      continue;
    }
    const s = tRun.length ? tRun[0]!.t : (j0 >= 0 ? timed[j0]!.end : Math.max(0, (timed[j1]?.t ?? 0) - 0.3 * accRun.length));
    const e = tRun.length ? tRun.at(-1)!.end : (j1 < m ? timed[j1]!.t : s + 0.3 * accRun.length);
    if (k === 0 && tRun.length > accRun.length + 2) { out.push(...tRun); continue; } // a pre-roll the accurate model skipped
    const tot = accRun.reduce((a, w) => a + w.length + 1, 0); let c = s;
    for (const w of accRun) { const d = (e - s) * (w.length + 1) / tot; out.push({ word: w, t: +c.toFixed(3), end: +(c + d).toFixed(3) }); c += d; }
  }
  return out;
}

// ---------- 2. cut ----------
const CUES = new Set(['start', 'action', 'rolling', 'go', 'ready', 'okay', 'ok']);
const FILLERS = new Set(['um', 'uh', 'erm', 'uhm', 'hmm', 'mm', 'ah', 'er']);
const OPENERS = new Set(['and', 'so', 'okay', 'ok', 'alright', 'well']);

/** Loudness every 20 ms (dBFS) from 8 kHz mono PCM. */
export async function envelope(audio: string): Promise<{ db: Float32Array; hop: number }> {
  const buf = await new Promise<Buffer>((res, rej) => execFile(config.ffmpeg, ['-nostdin', '-v', 'error', '-i', audio, '-ac', '1', '-ar', '8000', '-f', 's16le', '-'], { encoding: 'buffer', maxBuffer: 256e6, timeout: 60_000 }, (e, out) => e ? rej(e) : res(out)));
  const x = new Int16Array(buf.buffer, buf.byteOffset, Math.floor(buf.length / 2)), hop = 160, n = Math.floor(x.length / hop), db = new Float32Array(n);
  for (let i = 0; i < n; i++) { let s = 0; for (let k = 0; k < hop; k++) { const v = x[i * hop + k]! / 32768; s += v * v; } db[i] = 10 * Math.log10(s / hop + 1e-10); }
  return { db, hop: hop / 8000 };
}

/**
 * Pauses: stretches quieter than the clip's own floor-to-speech range allows (outdoor takes never fall silent, so
 * the threshold is relative: 30% of the way from the 15th to the 90th loudness percentile), at least `min` long.
 */
export function pauses(env: { db: Float32Array; hop: number }, min = 0.3, k = 0.3): [number, number][] {
  const sorted = Float32Array.from(env.db).sort(), q = (p: number) => sorted[Math.floor(p * (sorted.length - 1))]!;
  const th = q(0.15) + k * (q(0.9) - q(0.15)), out: [number, number][] = [];
  for (let i = 0; i < env.db.length;) {
    if (env.db[i]! >= th) { i++; continue; }
    let j = i; while (j < env.db.length && env.db[j]! < th) j++;
    if ((j - i) * env.hop >= min) out.push([i * env.hop, j * env.hop]);
    i = j;
  }
  return out;
}

/** Pieces of about `target` seconds, cut in the middle of pauses (never shorter than 3 s, never longer than 16 s if a pause allows). */
export function splitAt(ps: [number, number][], duration: number, target = 10): [number, number][] {
  const out: [number, number][] = []; let a = 0;
  const mids = ps.filter(([x, y]) => y - x >= 0.35).map(([x, y]) => (x + y) / 2);
  while (duration - a > target * 1.5) {
    const ok = mids.filter(m => m - a >= 3 && m - a <= 16 && duration - m >= 3);
    if (!ok.length) break;
    const m = ok.sort((x, y) => Math.abs(x - a - target) - Math.abs(y - a - target))[0]!;
    out.push([a, m]); a = m;
  }
  out.push([a, duration]);
  return out;
}

/**
 * The take: a raw clip often opens with set-up talk and a slate ("start?", "start!"). The take begins after the last
 * slate cue followed by a pause, or after the last long pause (over 1 s) in the first 40% of the clip; it ends after
 * the last real word (a stretched, unsure last word is a transcription ghost).
 */
export function takeWindow(ws: Word[], ps: [number, number][], duration: number): { a: number; b: number; why: string } {
  let a = 0, why = 'no pre-roll';
  ws.forEach((w, i) => { const nx = ws[i + 1]; if (CUES.has(bare(w.word)) && w.t < duration * 0.5 && (!nx || nx.t - w.end > 0.7)) { a = Math.max(a, w.end); why = `after the slate cue "${w.word}"`; } });
  for (const [p0, p1] of ps) if (p0 < duration * 0.4 && p1 - p0 >= 1.0 && p1 > a) { a = p1; why = 'after the set-up talk (last long pause in the opening)'; }
  // the take starts on the first speech after that point
  a = Math.max(0, a - 0.06);
  const real = ws.filter(w => !(w.end - w.t > 1.2 && (w.p ?? 1) < 0.2));
  const last = real.filter(w => w.t >= a).at(-1);
  const b = Math.min(duration, (last?.end ?? duration) + 0.3);
  return { a, b, why };
}

/** Jump cuts: the take minus every pause (cut down to a breath of air either side) and every filler word. */
export function segments(take: { a: number; b: number }, ps: [number, number][], fillers: [number, number][], airIn = 0.08, airOut = 0.1): Seg[] {
  const holes = [...ps.map(([p0, p1]) => [p0 + airOut, p1 - airIn] as [number, number]), ...fillers].filter(([x, y]) => y - x > 0.06).sort((x, y) => x[0] - y[0]);
  const segs: Seg[] = []; let cur = take.a;
  for (const [h0, h1] of holes) {
    if (h1 <= cur || h0 >= take.b) continue;
    if (h0 > cur) segs.push({ a: cur, b: Math.min(h0, take.b), zoom: 1 });
    cur = Math.max(cur, h1);
  }
  if (cur < take.b) segs.push({ a: cur, b: take.b, zoom: 1 });
  const out = segs.filter(s => s.b - s.a > 0.12);
  // alternate the punch-in so every jump cut reads as a cut
  out.forEach((s, i) => { s.zoom = i % 2 ? 1.12 : 1.0; });
  return out;
}

/** A source time mapped to the edited film's time; a time inside a cut snaps to the next kept piece (null outside the take). */
export function mapTime(segs: Seg[], t: number): number | null {
  let off = 0;
  for (const s of segs) {
    if (t < s.a - 1e-3) return off; // inside a cut: the start of the next piece
    if (t <= s.b + 1e-3) return off + Math.min(t, s.b) - s.a;
    off += s.b - s.a;
  }
  return null;
}

/** Key words for the gold accent: names, numbers and the longest word of each sentence. */
export function keywordsOf(ws: Word[]): string[] {
  const keys = new Set<string>(); let sent: Word[] = [];
  const flush = () => { const long = sent.filter(w => bare(w.word).length >= 7).sort((a, b) => bare(b.word).length - bare(a.word).length)[0]; if (long) keys.add(bare(long.word)); sent = []; };
  const STOP = new Set(['we', 'i', 'you', 'it', 'the', 'and', 'this', 'that', 'a', 'so', 'thank']);
  ws.forEach((w, i) => {
    const b = bare(w.word);
    if (STOP.has(b)) { sent.push(w); if (/[.!?]$/.test(w.word)) flush(); return; }
    if (/\d/.test(b) || (i > 0 && /^[A-Z][a-z]/.test(w.word) && !/[.!?]$/.test(ws[i - 1]!.word) && b !== 'i')) keys.add(b);
    sent.push(w); if (/[.!?]$/.test(w.word)) flush();
  });
  flush();
  return [...keys].filter(Boolean);
}

// ---------- 5. cards ----------
/**
 * Overlays on key words, as cards in the top corner beside the face (never over it): a stock clip that shows the
 * idea, a title card for a name (the product), or a running timer for a duration ("five minutes"). One model call
 * picks them from the cut transcript; the clips are searched across the free sources and downloaded at render time.
 */
const Picks = { cards: z.array(z.object({
  word: z.number().int().describe('index of the word the card appears on'),
  kind: z.enum(['clip', 'title', 'timer']).describe('clip: stock footage that literally shows the idea; title: a name or product said aloud, shown as text; timer: a duration said aloud, shown as a running clock'),
  query: z.string().describe('clip: a 2 to 4 word stock footage search; title: the text to show (1 to 3 words); timer: the duration in seconds as digits'),
  sub: z.string().describe('a short second line for a title card (2 to 4 words), else empty'),
  why: z.string(),
})).max(4),
  list: z.array(z.string().describe('2 to 4 words, a claim or feature the speaker states, e.g. "edits in 5 minutes"')).describe('three short labels summing up what the speaker promises, in the order said'),
};

export interface Card { at: number; dur: number; kind: 'clip' | 'title' | 'timer'; query: string; sub: string; why: string; side: 'left' | 'right'; file?: string; title?: string; provider?: string }

async function planCards(ws: Word[], at: (i: number) => number | null, total: number, log: (s: string) => void, busy: [number, number][] = []): Promise<{ cards: Omit<Card, 'side' | 'dur'>[]; list: string[] }> {
  try {
    const a = await ask({
      agent: 'router:footage-edit', tier: 'crew', maxTurns: 2, deadlineMs: 20_000,
      system: 'You edit a short vertical reel of a person talking to camera. Pick 3 or 4 moments for a small overlay card shown for about 1.5 seconds beside their face while they keep talking: the product or a name they say (title card, with a short second line), a duration they say (timer card), and concrete visual ideas (clip card with a stock footage search that literally shows the idea, e.g. "motion graphics animation", "social media phone scrolling", "video editing software"). Never in the first 1.5 seconds, never on the last word, at least 2 seconds apart, and only on words said in the free stretches named under the transcript (other shots fill the rest). Also write a list of three short labels (2 to 4 words each) of what the speaker promises, for a list graphic.',
      prompt: ws.map((w, i) => `${i}: ${w.word} @${(at(i) ?? 0).toFixed(2)}s`).join('\n') + `\n(film length ${total.toFixed(1)} s)` + `\nfree stretches for cards: ${freeOf(busy, 1.5, total - 1.2).map(([a, b]) => `${a.toFixed(1)}-${b.toFixed(1)} s`).join(', ') || 'none'}`, schema: Picks,
    });
    return { cards: a.cards.flatMap(c => { const t = at(c.word); return t == null ? [] : [{ at: t, kind: c.kind, query: c.query, sub: c.sub, why: c.why }]; }), list: a.list.slice(0, 3) };
  } catch (e) { log(`cards skipped: ${(e as Error).message.slice(0, 120)}`); return { cards: [], list: [] }; }
}

/** The stretches of [from, to] outside the busy windows, 1 s or longer. */
export function freeOf(busy: [number, number][], from: number, to: number): [number, number][] {
  const out: [number, number][] = []; let c = from;
  for (const [a, b] of [...busy].sort((x, y) => x[0] - y[0])) { if (a - c >= 1) out.push([c, Math.min(a, to)]); c = Math.max(c, b); }
  if (to - c >= 1) out.push([c, to]);
  return out.filter(([a, b]) => b - a >= 1);
}

export const CARD = { w: 460, h: 460, y: 140, margin: 36 };
const html = (inner: string) => `<html><head><style>
${fontCss()}
html,body { margin:0; background:transparent; }
.c { box-sizing:border-box; width:${CARD.w}px; height:${CARD.h}px; margin:8px; border-radius:36px; background:#fff; box-shadow:0 6px 18px rgba(0,0,0,.28);
  display:flex; flex-direction:column; align-items:center; justify-content:center; font-family:B, sans-serif; color:#14110F; text-align:center; padding:24px; }
.big { font-weight:800; letter-spacing:-0.035em; line-height:.95; }
.sub { margin-top:18px; font-weight:700; font-size:34px; color:#E0A400; letter-spacing:-0.01em; }
.bar { margin-top:22px; width:300px; height:14px; border-radius:7px; background:#eee; overflow:hidden; } .bar i { display:block; height:100%; background:#E0A400; }
</style></head><body><div class="c">${inner}</div></body></html>`;

/**
 * Title and timer cards drawn once in the browser as transparent PNGs (rounded white card, Bricolage ink, gold second
 * line): a title is one picture, a timer 8 pictures of a clock running down. The ffmpeg on a studio server may have
 * no text filter, so no text is drawn in ffmpeg.
 */
async function drawCards(cards: Card[], dir: string): Promise<void> {
  const need = cards.filter(c => c.kind !== 'clip'); if (!need.length) return;
  const { chromium } = await import('playwright-core');
  const b = await chromium.launch({ headless: true, ...(config.chrome.path ? { executablePath: config.chrome.path } : { channel: config.chrome.channel }), args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
  try {
    const p = await b.newPage({ viewport: { width: CARD.w + 16, height: CARD.h + 16 } });
    for (const [k, c] of need.entries()) {
      const d = join(dir, `card-${cards.indexOf(c)}`); mkdirSync(d, { recursive: true });
      const shots: string[] = [];
      if (c.kind === 'title') {
        const size = Math.max(64, Math.min(130, Math.floor(760 / Math.max(4, c.query.length))));
        shots.push(`<div class="big" style="font-size:${size}px">${c.query.slice(0, 22)}</div>${c.sub ? `<div class="sub">${c.sub.slice(0, 28)}</div>` : ''}`);
      } else {
        const secs = Math.max(10, Math.min(3600, parseInt(c.query, 10) || 300));
        for (let f = 0; f < 8; f++) { const r = Math.round(secs * (1 - f / 7)); shots.push(`<div class="big" style="font-size:132px">${Math.floor(r / 60)}:${String(r % 60).padStart(2, '0')}</div><div class="sub">${secs >= 120 ? `${Math.round(secs / 60)} MINUTES` : `${secs} SECONDS`}</div><div class="bar"><i style="width:${Math.round(100 * f / 7)}%"></i></div>`); }
      }
      for (const [n, inner] of shots.entries()) {
        await p.setContent(html(inner)); await p.evaluate('document.fonts.load("800 40px B").then(() => document.fonts.load("40px A"))');
        await p.screenshot({ path: join(d, `f${String(n).padStart(2, '0')}.png`), omitBackground: true });
      }
      c.file = d;
    }
  } finally { await b.close().catch(() => undefined); }
}

/** The filter that turns input `inp` into card `[k]`, timed at `c.at`. */
function cardFilter(c: Card, inp: string, k: number): string {
  const { w, h } = CARD;
  const fade = `fade=t=in:st=0:d=0.15:alpha=1,fade=t=out:st=${(c.dur - 0.15).toFixed(2)}:d=0.15:alpha=1,setpts=PTS-STARTPTS+${c.at.toFixed(3)}/TB[k${k}]`;
  if (c.kind === 'clip') return `[${inp}]fps=30,scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},setsar=1,trim=0:${c.dur},setpts=PTS-STARTPTS,pad=${w + 16}:${h + 16}:8:8:color=white,format=yuva420p,${fade}`;
  return `[${inp}]fps=30,trim=0:${c.dur},setpts=PTS-STARTPTS,format=yuva420p,${fade}`;
}

/** The ffmpeg inputs for card `c`. */
function cardInput(c: Card): string[] {
  if (c.kind === 'clip') return ['-i', c.file!];
  if (c.kind === 'title') return ['-loop', '1', '-t', (c.dur + 0.1).toFixed(2), '-framerate', '30', '-i', join(c.file!, 'f00.png')];
  return ['-framerate', (8 / (c.dur * 0.85)).toFixed(3), '-i', join(c.file!, 'f%02d.png')];
}

/** The end card: the product name huge in the key-word yellow over a dark warm plate, its line under it. */
async function drawEnd(e: { title: string; line?: string }, dir: string): Promise<EndCard> {
  mkdirSync(dir, { recursive: true });
  const out = join(dir, 'end.png'), bg = join(dir, 'bg.png'), title = join(dir, 'title.png'), line = join(dir, 'line.png');
  const { chromium } = await import('playwright-core');
  const b = await chromium.launch({ headless: true, ...(config.chrome.path ? { executablePath: config.chrome.path } : { channel: config.chrome.channel }), args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
  try {
    const p = await b.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 });
    await p.setContent(`<html><head><style>
${fontCss()}
body { margin:0; width:540px; height:960px; display:flex; flex-direction:column; align-items:center; justify-content:center;
  background: radial-gradient(circle at 50% 42%, #3a2a12 0%, #17120c 55%, #0b0907 100%); }
.t { font-family:A; color:#FFD60A; font-size:${Math.min(170, Math.floor(900 / Math.max(3, e.title.length)))}px; letter-spacing:.01em; text-transform:uppercase; text-shadow:0 6px 30px rgba(255,214,10,.35); padding:0 24px; }
.l { margin-top:10px; font-family:B; font-weight:700; color:#fff; font-size:30px; letter-spacing:-.02em; opacity:.92; padding:4px 12px; }
</style></head><body><div class="t">${e.title}</div>${e.line ? `<div class="l">${e.line}</div>` : ''}</body></html>`);
    await p.evaluate('document.fonts.load("40px A").then(() => document.fonts.load("700 30px B"))');
    await p.screenshot({ path: out });
    // the layers for the animated card: the plate alone, then the title and the line each cut out where they sit
    const tb = await p.locator('.t').boundingBox(), lb = e.line ? await p.locator('.l').boundingBox() : null;
    await p.locator('.t').screenshot({ path: title, omitBackground: true });
    if (lb) await p.locator('.l').screenshot({ path: line, omitBackground: true });
    await p.addStyleTag({ content: '.t,.l{visibility:hidden}' });
    await p.screenshot({ path: bg });
    return { still: out, bg, title, titleY: Math.round(((tb?.y ?? 400) + (tb?.height ?? 0) / 2) * 2), line: lb ? line : undefined, lineY: lb ? Math.round(lb.y * 2) : 0 };
  } finally { await b.close().catch(() => undefined); }
}
export interface EndCard { still: string; bg: string; title: string; titleY: number; line?: string; lineY: number }

// ---------- the phone pull-back with a list ----------
/**
 * One shot change in the middle of the reel (the creator-reel "pull-back reveal"): the speaker's picture shrinks into a
 * phone on a paper plate, three short cards (what he claims, written by the card planner) float in beside it one by one
 * joined by a red line, then the picture zooms back to full screen. All drawn once in the browser (plate, phone bezel,
 * card states as transparent frames); ffmpeg only scales and lays them per frame.
 */
export interface PullBack { seg: number; d: number; list: string[]; plate?: string; bezel?: string; cards?: string[] }
export const PHONE = { s: 0.84, border: 26, shift: 80 };

async function drawPullBack(pb: PullBack, dir: string): Promise<void> {
  mkdirSync(dir, { recursive: true });
  const { chromium } = await import('playwright-core');
  const b = await chromium.launch({ headless: true, ...(config.chrome.path ? { executablePath: config.chrome.path } : { channel: config.chrome.channel }), args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
  try {
    const p = await b.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 });
    const css = `${fontCss()} html,body{margin:0;width:540px;height:960px;overflow:hidden;}`;
    // the plate: warm paper with a faint map grid
    await p.setContent(`<html><head><style>${css} body{background:radial-gradient(circle at 50% 45%,#f6ecd9 0%,#e9dcc2 60%,#d9c8a6 100%);}
      .g{position:absolute;inset:0;background-image:linear-gradient(rgba(120,90,50,.09) 1px,transparent 1px),linear-gradient(90deg,rgba(120,90,50,.09) 1px,transparent 1px);background-size:36px 36px;}
      .r{position:absolute;inset:0;background:repeating-radial-gradient(circle at 30% 70%,rgba(150,110,60,.06) 0 2px,transparent 2px 22px);}</style></head><body><div class="g"></div><div class="r"></div></body></html>`);
    pb.plate = join(dir, 'plate.png'); await p.screenshot({ path: pb.plate });
    // the bezel: a black phone body with a rounded screen hole the size of the full frame (scaled with it)
    const bw = PHONE.border / 2;
    await p.setViewportSize({ width: 540 + 2 * bw, height: 960 + 2 * bw });
    await p.setContent(`<html><head><style>html,body{margin:0;background:transparent;} .ph{position:absolute;left:0;top:0;width:${540 + 2 * bw}px;height:${960 + 2 * bw}px;border-radius:${46 + bw}px;box-sizing:border-box;border:${bw}px solid #111;box-shadow:0 0 0 2px #333 inset;}
      .ph:before{content:'';position:absolute;inset:-${bw}px;border-radius:${46 + bw}px;box-shadow:0 0 0 ${bw}px #111;} .c{position:absolute;left:${bw}px;top:${bw}px;width:540px;height:960px;border-radius:46px;box-shadow:0 0 0 60px #111;}
      .n{position:absolute;left:50%;top:${bw + 14}px;width:120px;height:26px;margin-left:-60px;border-radius:14px;background:#111;}</style></head>
      <body><div style="position:absolute;inset:0;overflow:hidden;border-radius:${46 + bw}px"><div class="c"></div></div><div class="ph"></div><div class="n"></div></body></html>`);
    pb.bezel = join(dir, 'bezel.png'); await p.screenshot({ path: pb.bezel, omitBackground: true });
    // the list: cards on the right of the phone, appearing one by one, joined by a red line
    await p.setViewportSize({ width: 540, height: 960 });
    pb.cards = [];
    for (let n = 1; n <= pb.list.length; n++) {
      const items = pb.list.slice(0, n).map((t, k) => `<div class="k" style="top:${280 + k * 140}px;left:${k % 2 ? 276 : 262}px;transform:rotate(${k % 2 ? 2.5 : -2.5}deg)">${t}</div>`).join('');
      const pts = pb.list.slice(0, n).map((_, k) => `${(k % 2 ? 276 : 262) + 8},${280 + k * 140 + 34}`).join(' ');
      await p.setContent(`<html><head><style>${css} body{background:transparent;}
        .k{position:absolute;width:268px;padding:16px 18px;box-sizing:border-box;border-radius:20px;background:#fff;font-family:B;font-weight:800;font-size:35px;line-height:1.05;letter-spacing:-.02em;color:#14110F;box-shadow:0 8px 20px rgba(60,40,10,.25);}
        svg{position:absolute;inset:0}</style></head><body><svg width="540" height="960"><polyline points="${pts}" fill="none" stroke="#E5322D" stroke-width="5" stroke-dasharray="2 10" stroke-linecap="round"/>
        ${pb.list.slice(0, n).map((_, k) => `<circle cx="${(k % 2 ? 276 : 262) + 8}" cy="${280 + k * 140 + 34}" r="8" fill="#E5322D"/>`).join('')}</svg>${items}</body></html>`);
      await p.evaluate('document.fonts.load("800 25px B")');
      const f = join(dir, `list-${n}.png`); await p.screenshot({ path: f, omitBackground: true }); pb.cards.push(f);
    }
  } finally { await b.close().catch(() => undefined); }
}

// ---------- text behind the speaker ----------
/**
 * The product name set huge behind the speaker's head (the creator-reel "text behind subject" shot): the word is laid
 * over the picture and the speaker, cut out by a person mask, is laid back on top. The mask comes from a small
 * salient-object model (U2-Net-p, 4.6 MB, fetched once into ~/.cache/moovi at render time) run on the source frames
 * of that moment only (every 2nd frame, about 2 s of CPU), through MOOVI_VISION_PY (a python with onnxruntime and
 * opencv). Without it the word stays on the chest with the others.
 */
const SEG_URL = 'https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx';
const VISION_PY = `
import sys, numpy as np, cv2, onnxruntime as ort
o = ort.SessionOptions(); o.intra_op_num_threads = 4
s = ort.InferenceSession(sys.argv[1], o, providers=["CPUExecutionProvider"])
cap = cv2.VideoCapture(sys.argv[2]); cap.set(cv2.CAP_PROP_POS_MSEC, float(sys.argv[3]) * 1000)
n, out, step = int(sys.argv[4]), sys.argv[5], int(sys.argv[6])
m = None
for i in range(n):
    ok, f = cap.read()
    if not ok: break
    if i % step == 0:
        x = cv2.resize(cv2.cvtColor(f, cv2.COLOR_BGR2RGB), (320, 320)).astype(np.float32) / 255.
        x = (x - [0.485, 0.456, 0.406]) / [0.229, 0.224, 0.225]
        y = s.run(None, {s.get_inputs()[0].name: x.transpose(2, 0, 1)[None].astype(np.float32)})[0][0, 0]
        y = np.clip((y - y.min()) / (y.max() - y.min() + 1e-6) * 1.4 - 0.2, 0, 1)
        m = cv2.GaussianBlur(cv2.resize((y * 255).astype(np.uint8), (f.shape[1], f.shape[0])), (5, 5), 0)
    cv2.imwrite(f"{out}/m{i:04d}.png", m)
    if i == 0:
        rows = np.where((m[:, m.shape[1] // 4: 3 * m.shape[1] // 4] > 128).any(axis=1))[0]
        top = float(rows[0]) / m.shape[0] if len(rows) else 0.3
print(top)
`;

async function segModel(): Promise<string> {
  const dir = join(homedir(), '.cache', 'moovi'), f = join(dir, 'u2netp.onnx');
  if (existsSync(f) && statSync(f).size > 4e6) return f;
  mkdirSync(dir, { recursive: true });
  const r = await fetch(SEG_URL, { signal: AbortSignal.timeout(60_000) });
  if (!r.ok) throw new Error(`person mask model: HTTP ${r.status}`);
  writeFileSync(f, Buffer.from(await r.arrayBuffer()));
  return f;
}

/** Person masks for `n` source frames from `start` (s), written as m0000.png...; returns the folder. */
export async function personMasks(video: string, start: number, n: number, dir: string): Promise<{ dir: string; top: number }> {
  const py = process.env.MOOVI_VISION_PY; if (!py || !existsSync(py)) throw new Error('no vision python (MOOVI_VISION_PY)');
  mkdirSync(dir, { recursive: true });
  const out = await run(py, ['-c', VISION_PY, await segModel(), video, start.toFixed(3), String(n), dir, '2'], 120_000);
  if (!existsSync(join(dir, 'm0000.png'))) throw new Error('no masks came out');
  return { dir, top: parseFloat(out.trim().split('\n').at(-1)!) || 0.3 };
}

/** The behind-word picture: a 1080x1920 transparent frame with the word huge at head height. */
/** A warm light-leak flash (transparent PNG), laid over a few jump cuts for 0.3 s. */
async function drawLeak(dir: string): Promise<string> {
  mkdirSync(dir, { recursive: true });
  const out = join(dir, 'leak.png');
  const { chromium } = await import('playwright-core');
  const b = await chromium.launch({ headless: true, ...(config.chrome.path ? { executablePath: config.chrome.path } : { channel: config.chrome.channel }), args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
  try {
    const p = await b.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 });
    await p.setContent(`<html><body style="margin:0;width:540px;height:960px;background:radial-gradient(ellipse at 85% 20%,rgba(255,170,60,.85) 0%,rgba(255,120,40,.45) 28%,rgba(255,80,40,0) 60%),radial-gradient(ellipse at 10% 90%,rgba(255,210,120,.55) 0%,rgba(255,210,120,0) 45%);"></body></html>`);
    await p.screenshot({ path: out, omitBackground: true });
  } finally { await b.close().catch(() => undefined); }
  return out;
}

async function drawBehind(word: string, dir: string, y = 560): Promise<string> {
  mkdirSync(dir, { recursive: true });
  const out = join(dir, 'behind.png');
  const { chromium } = await import('playwright-core');
  const b = await chromium.launch({ headless: true, ...(config.chrome.path ? { executablePath: config.chrome.path } : { channel: config.chrome.channel }), args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
  try {
    const p = await b.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 });
    await p.setContent(`<html><head><style>${fontCss()}
html,body { margin:0; width:540px; height:960px; background:transparent; overflow:hidden; }
.t { position:absolute; left:0; width:540px; top:${y / 2}px; transform:translateY(-50%); text-align:center; font-family:A; text-transform:uppercase; color:#FFD60A;
  font-size:${Math.min(200, Math.floor(1000 / Math.max(3, word.length)))}px; line-height:1; letter-spacing:.01em; text-shadow:0 4px 24px rgba(0,0,0,.35); }
</style></head><body><div class="t">${word}</div></body></html>`);
    await p.evaluate('document.fonts.load("40px A")');
    await p.screenshot({ path: out, omitBackground: true });
  } finally { await b.close().catch(() => undefined); }
  return out;
}

/** One stock clip per term from the free sources, each fetch bounded by `ms`; the paths that arrived in time. */
async function fetchStock(terms: string[], dir: string, seconds: number, ms: number): Promise<string[]> {
  const used = new Set<string>();
  const got = await Promise.all(terms.map((q, k) => Promise.race([
    (async () => {
      const list = await searchAll({ i: 100 + k, text: q, queries: [q], see: [] }, 6).catch(() => []);
      return (await fetchPicked(list.slice(0, 3), join(dir, String(k)), seconds, used).catch(() => null))?.path ?? null;
    })(),
    new Promise<null>(res => setTimeout(() => res(null), ms).unref()),
  ])));
  return got.filter((f): f is string => !!f && existsSync(f));
}

/** Run the jobs `n` at a time. */
async function pool(jobs: (() => Promise<unknown>)[], n: number): Promise<void> {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, jobs.length) }, async () => { while (next < jobs.length) await jobs[next++]!(); }));
}

// ---------- shot changes and the face label ----------
type Fx = 'none' | 'zoom' | 'whip' | 'orbit' | 'break';
const FX_CYCLE: Fx[] = ['whip', 'break', 'zoom', 'orbit'];

/** A piecewise-linear ffmpeg expression of t through the keys (held flat past the last). */
export function pw(ks: { t: number; v: number }[]): string {
  if (ks.length < 2) return (ks[0]?.v ?? 0).toFixed(1);
  return ks.slice(0, -1).map((a, k) => {
    const b = ks[k + 1]!, last = k === ks.length - 2, slope = b.t > a.t ? (b.v - a.v) / (b.t - a.t) : 0;
    return `${k ? `gte(t,${a.t.toFixed(3)})*` : ''}${last ? '' : `lt(t,${b.t.toFixed(3)})*`}(${a.v.toFixed(1)}+${slope.toFixed(3)}*(${last ? `min(t,${b.t.toFixed(3)})` : 't'}-${a.t.toFixed(3)}))`;
  }).join('+');
}

const FACE_URL = 'https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx';
const FACE_PY = `
import sys, json, cv2
cap = cv2.VideoCapture(sys.argv[2]); cap.set(cv2.CAP_PROP_POS_MSEC, float(sys.argv[3]) * 1000)
n, out, W, H, det = int(sys.argv[4]), [], 0, 0, None
for i in range(n):
    ok, f = cap.read()
    if not ok: break
    H, W = f.shape[:2]
    if i % 2: continue
    if det is None: det = cv2.FaceDetectorYN.create(sys.argv[1], "", (W, H), 0.6)
    _, fs = det.detect(f)
    if fs is not None and len(fs):
        x, y, w, h = max(fs, key=lambda r: r[2] * r[3])[:4]
        out.append([i, float(x + w / 2) / W, float(y + h / 2) / H, float(w) / W, float(h) / H])
print(json.dumps({"W": W, "H": H, "faces": out}))
`;

async function faceModel(): Promise<string> {
  const dir = join(homedir(), '.cache', 'moovi'), f = join(dir, 'face_yunet.onnx');
  if (existsSync(f) && statSync(f).size > 1e5) return f;
  mkdirSync(dir, { recursive: true });
  const r = await fetch(FACE_URL, { signal: AbortSignal.timeout(30_000) });
  if (!r.ok) throw new Error(`face model: HTTP ${r.status}`);
  writeFileSync(f, Buffer.from(await r.arrayBuffer()));
  return f;
}

/** The tag picture: a yellow box the size of the face with a label on its top edge (transparent PNG). */
async function drawTag(tag: string, bw: number, bh: number, dir: string): Promise<{ file: string; tagH: number }> {
  mkdirSync(dir, { recursive: true });
  const file = join(dir, 'tag.png'), tagH = 108, w = Math.max(bw, 100 + tag.length * 46);
  const { chromium } = await import('playwright-core');
  const b = await chromium.launch({ headless: true, ...(config.chrome.path ? { executablePath: config.chrome.path } : { channel: config.chrome.channel }), args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
  try {
    const p = await b.newPage({ viewport: { width: w, height: bh + tagH }, deviceScaleFactor: 1 });
    await p.setContent(`<html><head><style>${fontCss()}
html,body { margin:0; background:transparent; overflow:hidden; }
.box { position:absolute; left:0; top:${tagH - 6}px; width:${bw}px; height:${bh}px; box-sizing:border-box; border:9px solid #FFD60A; border-radius:26px; box-shadow:0 0 0 2px rgba(0,0,0,.22), inset 0 0 0 2px rgba(0,0,0,.18); }
.tag { position:absolute; left:0; top:0; height:${tagH}px; padding:0 22px; background:#FFD60A; border-radius:16px 16px 16px 4px; font-family:A; font-size:74px; line-height:${tagH}px; color:#111; text-transform:uppercase; letter-spacing:.02em; white-space:nowrap; }
</style></head><body><div class="box"></div><div class="tag">${tag.replace(/[<>&]/g, '')}</div></body></html>`);
    await p.evaluate('document.fonts.load("40px A")');
    await p.screenshot({ path: file, omitBackground: true });
  } finally { await b.close().catch(() => undefined); }
  return { file, tagH };
}

/**
 * The face label gag: his face found on the source frames of one cut (OpenCV's YuNet face detector, a 230 KB model
 * fetched once into ~/.cache/moovi, through MOOVI_VISION_PY, every 2nd frame), smoothed, mapped through that cut's scale and crop into the frame; the tag picture
 * follows it for about 1.5 s.
 */
async function faceLabel(input: string, sg: Seg, seg: number, tag: string, pr: { width?: number; height?: number }, dir: string):
  Promise<{ seg: number; t0: number; d: number; png: string; x: string; y: string }> {
  const py = process.env.MOOVI_VISION_PY; if (!py || !existsSync(py)) throw new Error('no vision python (MOOVI_VISION_PY)');
  const segD = sg.b - sg.a, t0 = 0.08, d = Math.min(1.6, segD - t0 - 0.05), n = Math.round((t0 + d) * 30) + 2;
  const out = await run(py, ['-c', FACE_PY, await faceModel(), input, sg.a.toFixed(3), String(n)], 60_000);
  const r = JSON.parse(out.trim().split('\n').at(-1)!) as { W: number; H: number; faces: number[][] };
  if (r.faces.length < 4) throw new Error(`a face in only ${r.faces.length} frames`);
  const med = (xs: number[]) => [...xs].sort((a, b) => a - b)[xs.length >> 1]!;
  const fw = med(r.faces.map(f => f[3]!)), fh = med(r.faces.map(f => f[4]!));
  const W = r.W || pr.width || 1080, H = r.H || pr.height || 1920, cover = Math.max(1080 / W, 1920 / H);
  const at = (t: number) => { const k = cover * (sg.zoom + 0.035 * t / segD); return { k, ox: (W * k - 1080) / 2, oy: (H * k - 1920) * 0.3 }; };
  const km = at(t0 + d / 2).k, bw = Math.max(250, Math.round(fw * W * km * 1.45)), bh = Math.max(300, Math.round(fh * H * km * 1.65));
  const { file, tagH } = await drawTag(tag, bw, bh, dir);
  const keys = r.faces.map((f, j, a) => {
    const nb = a.slice(Math.max(0, j - 1), j + 2), t = f[0]! / 30, m = at(t);
    return { t, x: med(nb.map(z => z[1]!)) * W * m.k - m.ox - bw / 2, y: med(nb.map(z => z[2]!)) * H * m.k - m.oy - bh / 2 - tagH + 6 };
  });
  return { seg, t0, d, png: file, x: pw(keys.map(k => ({ t: k.t, v: k.x }))), y: pw(keys.map(k => ({ t: k.t, v: k.y }))) };
}

// ---------- the mode ----------
export async function footageEdit(o: { input: string; out: string; dir: string; prompt?: string; cards?: boolean; music?: boolean; log?: (s: string) => void;
  /** 'kinetic' (big words over the chest, creator-reel style, default) or 'ce04' (Ishaan's I'm your caption chips) */
  captions?: 'kinetic' | 'ce04';
  /** corrections for names the speech models mishear, from the brief ("movies" -> "Moovi") */
  fixes?: Record<string, string>;
  /** the end card's title and line (none when title is empty) */
  end?: { title: string; line?: string };
  /** the face label gag's words (a box that follows his face for about 1.5 s on an early cut); none without */
  tag?: string;
}): Promise<FootageEditReport> {
  const log = o.log ?? (() => undefined), t0 = Date.now(), stages: Record<string, number> = {};
  const lap = async <T>(k: string, f: () => Promise<T>) => { const s = Date.now(); try { return await f(); } finally { stages[k] = (Date.now() - s) / 1000; } };
  rmSync(o.dir, { recursive: true, force: true }); mkdirSync(o.dir, { recursive: true });
  if (o.captions === 'ce04') warmCaptionsS1(); else warmKinetic();
  const pr = await probe(o.input), duration = pr.duration;
  const audio = join(o.dir, 'voice.mp3');
  await sh(config.ffmpeg, ['-nostdin', '-v', 'error', '-y', '-i', o.input, '-vn', '-ac', '1', '-ar', '16000', '-b:a', '64k', audio]);

  // 1. hear: the clip is split at its pauses into pieces of about 10 s, each piece transcribed at once (timed words
  // and the accurate text); a 30 s noisy take in one ask often comes back with only its opening
  const prompt = o.prompt ?? '';
  // stock clips for the wall of videos, fetched from the start (the brief's terms are known before a word is heard), each
  // given at most 12 s: a slow source is skipped, the wall then uses more of his own clip
  const stockTerms = [...new Set([...(prompt ? prompt.split(/[,.;]/).map(x => x.trim()).filter(x => x && x.split(/\s+/).length <= 3).slice(1, 4) : []), 'video editing'])];
  const stockP = lap('stock', () => fetchStock(stockTerms, join(o.dir, 'stock'), 4, 12_000)).catch(() => [] as string[]);
  const env = await envelope(audio), ps = pauses(env);
  const pieces = splitAt(ps, duration);
  let cands: string[] = []; const alts: string[] = [];
  const heard = await lap('hear', () => Promise.all(pieces.map(async ([a, b], k) => {
    const f = join(o.dir, `piece-${k}.mp3`);
    await sh(config.ffmpeg, ['-nostdin', '-v', 'error', '-y', '-ss', a.toFixed(3), '-t', (b - a).toFixed(3), '-i', audio, '-c:a', 'libmp3lame', '-b:a', '64k', f]);
    const timed = await timedWords(f, o.dir, prompt);
    return { timed: timed.words.map(w => ({ ...w, t: +(w.t + a).toFixed(3), end: +(w.end + a).toFixed(3) })), by: timed.by };
  }).concat([(async () => {
    let alt: string | undefined;
    if (pieces.length > 1) { alt = join(o.dir, 'after-opening.mp3'); await sh(config.ffmpeg, ['-nostdin', '-v', 'error', '-y', '-ss', pieces[1]![0].toFixed(3), '-i', audio, '-c:a', 'libmp3lame', '-b:a', '64k', alt]).catch(() => { alt = undefined; }); }
    if (alt) alts.push(alt);
    cands = await cleanTexts(audio, prompt, alt);
    return { timed: [] as Word[], by: '' };
  })()])));
  // the accurate text is asked of the whole clip (on short pieces it answers worse: truncated, or the wrong language)
  heard.pop();
  const timed = { words: heard.flatMap(h => h.timed), by: heard[0]?.by ?? 'none' };
  let text = pickText(cands, timed.words);
  if (!text || agreement(text, timed.words) < timed.words.length * 0.55) {
    // every accurate answer drifted (another language, cut short): ask again, the smaller model too; costs one round trip
    const more = await lap('hear2', () => Promise.all([cleanTexts(audio, prompt, alts[0]), cleanTexts(audio, prompt, alts[0], 'gpt-4o-mini-transcribe')]));
    cands.push(...more.flat()); text = pickText(cands, timed.words);
  }
  log(`accurate text: ${cands.length} answers, agreement ${cands.map(c => agreement(c, timed.words)).join('/')} of ${timed.words.length} timed words${text ? '' : ', none trusted (timed words kept)'}`);
  const words = nameFix(fixWords(text ? align(timed.words, text) : timed.words, o.fixes ?? {}), prompt.split(/[,.;]/).map(x => x.trim()));
  log(`heard in ${pieces.length} pieces (${timed.by}${text && words !== timed.words ? ' + accurate text' : ''}): ${words.map(w => w.word).join(' ')}`);

  // 2. cut
  const take = takeWindow(timed.words, ps, duration);
  const fillers = timed.words.filter(w => FILLERS.has(bare(w.word))).map(w => [w.t, w.end] as [number, number]);
  const segs = segments(take, ps, fillers);
  const removed: { words: string[]; why: string }[] = [];
  const before = words.filter(w => w.end <= take.a + 0.1); if (before.length) removed.push({ words: before.map(w => w.word), why: `pre-roll, take starts ${take.why}` });
  if (fillers.length) removed.push({ words: timed.words.filter(w => FILLERS.has(bare(w.word))).map(w => w.word), why: 'filler' });
  const keep = words.filter(w => w.end > take.a + 0.1 && w.t < take.b && !FILLERS.has(bare(w.word)));
  // a take that opens on "And" / "So" reads better starting on the next word
  if (keep.length > 3 && OPENERS.has(bare(keep[0]!.word)) && keep[1]!.t - keep[0]!.t < 0.8) {
    removed.push({ words: [keep[0]!.word], why: 'take opener' });
    take.a = Math.max(take.a, keep[1]!.t - 0.06); keep.shift();
    while (segs.length && segs[0]!.b <= take.a) segs.shift();
    if (segs[0]) segs[0].a = Math.max(segs[0].a, take.a);
  }
  segs.forEach((s, i) => { s.zoom = i % 2 ? 1.12 : 1.0; });
  const outDur = segs.reduce((a, s) => a + s.b - s.a, 0), frames = Math.round(outDur * 30);
  removed.push({ words: [`${ps.filter(([a, b]) => a > take.a && b < take.b).length} pauses`], why: `dead air cut to a breath (${(take.b - take.a - outDur).toFixed(2)} s inside the take)` });
  const capWords: CapWord[] = keep.map(w => { const s = mapTime(segs, w.t) ?? 0, e = mapTime(segs, w.end) ?? outDur; return { word: w.word, start: +s.toFixed(3), end: +Math.max(e, s + 0.12).toFixed(3) }; });
  for (let i = 1; i < capWords.length; i++) if (capWords[i]!.start < capWords[i - 1]!.start) capWords[i]!.start = capWords[i - 1]!.start;
  if (capWords.length) capWords.at(-1)!.end = +(outDur - 0.03).toFixed(3); // the last caption holds to the end
  // the brief's own terms ("AI video editor", "After Effects") are key phrases; names, numbers and long words are key words
  const keywords = [...new Set([...(prompt ? prompt.split(/[,.;]/).map(x => x.trim()).filter(x => x && x.split(/\s+/).length <= 3) : []), ...keywordsOf(keep)])];
  log(`take ${take.a.toFixed(2)}..${take.b.toFixed(2)} (${take.why}); cut to ${outDur.toFixed(2)} s in ${segs.length} pieces; keywords ${keywords.join(', ')}`);

  // the product name (the brief's first term) behind his head, when it is said inside one cut and a vision python exists
  const name = prompt.split(/[,.;]/)[0]?.trim() ?? '';
  let behind: { wa: number; wb: number; seg: number; segOut: number; word: number; masks?: string; png?: string } | null = null;
  const bw = name ? keep.findIndex(w => bare(w.word) === bare(name)) : -1;
  if (bw >= 0 && process.env.MOOVI_VISION_PY) {
    const wa0 = mapTime(segs, keep[bw]!.t) ?? -1; let off = 0;
    for (const [i, sg] of segs.entries()) {
      const d = sg.b - sg.a;
      if (wa0 >= off && wa0 < off + d - 0.4) { const wa = Math.max(off, wa0 - 0.05), wb = Math.min(off + d - 0.05, wa + 1.7, outDur - 0.3); behind = { wa, wb, seg: i, segOut: off, word: bw }; break; }
      off += d;
    }
  }
  const behindP = behind ? lap('behind', async () => {
    const b = behind!, sa = segs[b.seg]!.a + (b.wa - b.segOut);
    const m = await personMasks(o.input, sa, Math.round((b.wb - b.wa) * 30), join(o.dir, 'masks'));
    // where his head top lands in the 1080x1920 frame (the segment's scale and crop), the word centred a little below it
    const H = (pr.height ?? 1920) * Math.max(1080 / (pr.width ?? 1080), 1920 / (pr.height ?? 1920)) * segs[b.seg]!.zoom;
    const headTop = m.top * H - (H - 1920) * 0.3;
    b.masks = m.dir; b.png = await drawBehind(clean(keep[b.word]!.word), join(o.dir, 'behind'), Math.round(Math.max(260, Math.min(1100, headTop + 120))));
  }).catch(e => { log(`text behind skipped: ${(e as Error).message.slice(0, 160)}`); behind = null; }) : Promise.resolve();
  const kinWords = behind ? capWords.filter((_, i) => i !== behind!.word) : capWords;

  // 4 + 5 at once: captions drawn while the cards are planned and fetched
  const capDir = join(o.dir, 'captions');
  const capsP = lap('captions', async (): Promise<{ c: Captions | Kinetic; look: string; kinetic: boolean } | null> => {
    if (o.captions !== 'ce04') {
      try { const c = await drawKinetic(kinWords, frames, { dir: capDir, keywords, pages: 3 }); return { c, look: 'kinetic words (Anton key word, Bricolage bold, Instrument Serif connectors), popped per word', kinetic: true }; }
      catch (e) { log(`kinetic words failed (${(e as Error).message.slice(0, 120)}), I'm your caption instead`); }
      finally { await closeKinetic().catch(() => undefined); }
    }
    try { const c = await drawCaptionsS1(capWords, frames, { dir: capDir, keywords, pages: 4, top: 1430, allAtOnce: true }); return { c, look: "Ishaan's I'm your caption (Style 1 film-ink chip + serif gold key word), whole phrase per chip", kinetic: false }; }
    catch (e) {
      log(`I'm your caption failed (${(e as Error).message.slice(0, 120)}), CaptionsEasy pop fallback`);
      try { const c = await drawCaptions(capWords, frames, { dir: capDir, keywords, look: 'caption-pop' }); return { c, look: 'CaptionsEasy caption-pop (fallback)', kinetic: false }; } catch { return null; }
    } finally { await closeCaptionsS1().catch(() => undefined); await closeCaptions().catch(() => undefined); }
  });
  const leakP = lap('leak', () => drawLeak(join(o.dir, 'leak'))).catch(() => null);
  const endP = o.end?.title ? lap('endcard', () => drawEnd(o.end!, join(o.dir, 'end'))).catch(() => null) : Promise.resolve(null);
  // the pull-back: the longest cut after the first (not the one with the word behind him), 2.2 s or more
  const pbSeg = segs.map((sg, i) => ({ i, d: sg.b - sg.a })).filter(x => x.i > 0 && x.d >= 2.2 && x.d <= 4.5 && x.i !== behind?.seg).sort((a, b) => b.d - a.d)[0];
  const segOut = (i: number) => segs.slice(0, i).reduce((a, sg) => a + sg.b - sg.a, 0);
  const pbWin: [number, number] | null = pbSeg ? [segOut(pbSeg.i), segOut(pbSeg.i) + pbSeg.d] : null;
  let pull: PullBack | null = null;
  // the wall of videos: the longest cut left in the middle (not the pull-back's, not the word behind him), 1.8 s or more;
  // its other tiles are his own clip at other moments and stock clips for the brief's terms, fetched at render time
  const wallSeg = segs.map((sg, i) => ({ i, d: sg.b - sg.a })).filter(x => x.i > 0 && x.i < segs.length - 1 && x.d >= 1.8 && x.d <= 3.5 && x.i !== behind?.seg && x.i !== pbSeg?.i).sort((a, b) => b.d - a.d)[0];
  const wallWin: [number, number] | null = wallSeg ? [segOut(wallSeg.i), segOut(wallSeg.i) + wallSeg.d] : null;
  // a shot change on every cut and every 1.5 s or so inside a long one: each regular cut enters with a whip pan, a zoom
  // through, an orbit or a frame break in turn, and a long cut alternates a punch-in at its inner beats; the special
  // shots (the wall, the phone, the word behind him, the face label) keep their own motion
  const special = (i: number) => i === pbSeg?.i || i === wallSeg?.i;
  const gagSeg = o.tag ? segs.findIndex((sg, i) => sg.b - sg.a >= 1.1 && !special(i) && i !== behind?.seg) : -1;
  let cyc = 0;
  const fx: Fx[] = segs.map((_, i) => i === 0 || special(i) || i === gagSeg ? 'none' : i === behind?.seg ? 'zoom' : FX_CYCLE[cyc++ % FX_CYCLE.length]!);
  const subOf = (i: number): { len: number; from: number } => {
    const d = segs[i]!.b - segs[i]!.a, from = i === behind?.seg ? behind.wb - behind.segOut + 0.05 : i === gagSeg ? 1.7 : 0, rest = d - from;
    return special(i) || rest <= 2.2 ? { len: 0, from: 0 } : { len: rest / Math.ceil(rest / 1.5), from };
  };
  const gagP = gagSeg >= 0 && process.env.MOOVI_VISION_PY ? lap('label', () => faceLabel(o.input, segs[gagSeg]!, gagSeg, o.tag!, pr, join(o.dir, 'label'))).catch(e => { log(`face label skipped: ${(e as Error).message.slice(0, 160)}`); return null; }) : Promise.resolve(null);
  const wallP = wallSeg ? stockP : Promise.resolve([] as string[]);
  const cardsP = o.cards === false ? Promise.resolve([] as Card[]) : lap('cards', async () => {
    const gagWin: [number, number][] = gagSeg >= 0 ? [[segOut(gagSeg), segOut(gagSeg) + 1.75]] : [];
    const busy: [number, number][] = [...(behind ? [[behind.wa - 0.1, behind.wb + 0.2] as [number, number]] : []), ...(pbWin ? [pbWin] : []), ...(wallWin ? [wallWin] : []), ...gagWin];
    const planned = await planCards(keep, i => { const t = keep[i] ? mapTime(segs, keep[i]!.t) : null; return t; }, outDur, log, busy);
    if (pbSeg && planned.list.length >= 2) {
      pull = { seg: pbSeg.i, d: pbSeg.d, list: planned.list };
      await drawPullBack(pull, join(o.dir, 'pullback')).catch(e => { log(`pull-back skipped: ${(e as Error).message.slice(0, 120)}`); pull = null; });
    }
    const plan = planned.cards.filter(c => c.at >= 1.5 && c.at <= outDur - 1.2).sort((a, b) => a.at - b.at);
    // never over the word behind him, the phone shot or the wall: a card that would run into one is shortened to end
    // before it (0.8 s at least), one that starts inside one is dropped
    const blocks: [number, number][] = [...(behind ? [[behind.wa - 0.1, behind.wb + 0.2] as [number, number]] : []), ...(pull && pbWin ? [pbWin] : []), ...(wallWin ? [wallWin] : []), ...gagWin].sort((a, b) => a[0] - b[0]);
    const fitted = plan.map(c => {
      if (blocks.some(([a, b]) => c.at >= a - 0.1 && c.at <= b + 0.1)) return null;
      const nb = blocks.find(([a]) => a > c.at), pb0 = [...blocks].reverse().find(([, b]) => b < c.at);
      let at = c.at, dur = Math.min(1.6, outDur - c.at - 0.2, nb ? nb[0] - 0.1 - c.at : 9);
      // too short before the next special shot: start up to 0.7 s earlier (while the word's sentence is on) if that is free
      if (dur < 1.2 && nb) { const a2 = Math.max(c.at - 0.7, (pb0?.[1] ?? 0) + 0.1, nb[0] - 0.1 - 1.3); if (a2 < at) { at = a2; dur = nb[0] - 0.1 - at; } }
      return dur >= 0.8 ? { ...c, at, dur } : null;
    }).filter((c): c is NonNullable<typeof c> => !!c);
    const spaced = fitted.filter((c, i) => i === 0 || c.at - fitted[i - 1]!.at >= 1.7);
    log(`cards: ${planned.cards.length} planned (${planned.cards.map(c => `${c.kind} ${c.query} @${c.at.toFixed(2)}`).join(', ')}), ${spaced.length} placed; blocks ${blocks.map(([a, b]) => `${a.toFixed(1)}-${b.toFixed(1)}`).join(' ')}`);
    const used = new Set<string>();
    const cards = await Promise.all(spaced.map(async (c, k): Promise<Card | null> => {
      const card: Card = { ...c, side: k % 2 ? 'right' : 'left' };
      if (c.kind !== 'clip') { await drawCards([card], join(o.dir, 'cards', String(k))); return card.file ? card : null; }
      const list = await searchAll({ i: k, text: c.query, queries: [c.query], see: [] }, 6).catch(() => []);
      const got = await fetchPicked(list.slice(0, 3), join(o.dir, 'cards', String(k)), 3, used).catch(() => null);
      return got ? { ...card, file: got.path, title: got.title, provider: got.provider } : null;
    }));
    return cards.filter((c): c is Card => !!c);
  });
  const [caps, cards, endPng, , leak, wallClips, gag] = await Promise.all([capsP, cardsP, endP, behindP, leakP, wallP, gagP]);
  log(`shots: ${fx.map((f, i) => `${i}:${i === wallSeg?.i ? 'wall' : i === pbSeg?.i ? 'phone' : i === gagSeg && gag ? 'label' : f}${subOf(i).len ? `+${Math.round((segs[i]!.b - segs[i]!.a - subOf(i).from) / subOf(i).len) - (subOf(i).from ? 0 : 1)} beats` : ''}`).join(' ')}`);
  if (wallSeg) log(`wall of videos on cut ${wallSeg.i} (${wallSeg.d.toFixed(2)} s): ${wallClips.length} stock clips + his own clip`);
  const END = endPng ? 1.6 : 0, total = outDur + END;

  // 3 + 6: frame, cut, overlay and mix in one encode
  await lap('encode', async () => {
    let ins: string[] = ['-i', o.input];
    let parts: string[] = [];
    // each cut is rendered by its own ffmpeg at the same time (4 at once, a near-lossless intermediate), then one final
    // pass lays the overlays and encodes; MOOVI_SERIAL_ENCODE=1 keeps everything in one graph
    const parallel = process.env.MOOVI_SERIAL_ENCODE !== '1';
    const grade = 'eq=contrast=1.06:saturation=1.18:gamma=0.98:gamma_r=1.03:gamma_b=0.96';
    if (!parallel) parts.push(`[0:v]fps=30,${grade},split=${segs.length}${segs.map((_, i) => `[v${i}]`).join('')}`);
    const cutJobs: (() => Promise<unknown>)[] = [];
    parts.push(`[0:a]aresample=48000,asplit=${segs.length}${segs.map((_, i) => `[a${i}]`).join('')}`);
    // cover 1080x1920 from the source once per piece (trimmed first, so only kept frames are scaled)
    const cover = Math.max(1080 / (pr.width ?? 1080), 1920 / (pr.height ?? 1920));
    let idx = 1; const nextIn = () => idx++;
    // a still picture is decoded once and repeated in the graph (an image input looped by the demuxer is decoded again on every frame)
    const loopF = (sec: number) => `loop=loop=${Math.max(0, Math.round(sec * 30) - 1)}:size=1:start=0,setpts=N/30/TB`;
    const Wc = ((pr.width ?? 1080) * cover).toFixed(1);
    const frameOf = (i: number) => {
      const s = segs[i]!, d = s.b - s.a, f = fx[i] ?? 'none', q = (u: string, k: number) => `pow(max(0,1-(${u})/${k}),2)`, sub = subOf(i);
      let z = `${s.zoom}+0.035*t/${d.toFixed(3)}`, a = '', cx = '(iw-1080)/2', blur = '';
      if (f === 'zoom') z += `+0.3*${q('t', 0.18)}`;
      if (f === 'whip') { z += `+0.3*${q('t', 0.16)}`; cx = `(iw-1080)*(0.5+0.5*${q('t', 0.16)})`; blur += `,gblur=sigma=34:sigmaV=0:enable='lt(t,0.13)'`; }
      if (f === 'orbit') { z += `+0.34*${q('t', 0.6)}`; a = `${i % 2 ? '' : '-'}0.17*${q('t', 0.6)}`; }
      if (sub.len) {
        // the inner beats of a long cut: from \`from\` on, every \`len\` s a new framing (punched in or out) that enters
        // with a whip, a zoom through or an orbit in turn
        const T = `max(0,t-${sub.from.toFixed(3)})`, k = `(floor(${T}/${sub.len.toFixed(3)})+${sub.from > 0 ? 1 : 0})`, u = `(${T}-${sub.len.toFixed(3)}*floor(${T}/${sub.len.toFixed(3)}))`;
        const g = sub.from > 0 ? `gte(t,${sub.from.toFixed(3)})*` : `gte(${k},1)*`;
        z += `+${g}0.13*mod(${k},2)+${g}eq(mod(${k},3),1)*0.3*${q(u, 0.16)}+${g}eq(mod(${k},3),2)*0.3*${q(u, 0.18)}+${g}eq(mod(${k},3),0)*0.34*${q(u, 0.5)}`;
        cx = `(iw-1080)*(0.5+${g}eq(mod(${k},3),1)*0.5*${q(u, 0.16)})`;
        a = `${a || '0'}+${g}eq(mod(${k},3),0)*0.15*${q(u, 0.5)}`;
        blur += `,gblur=sigma=34:sigmaV=0:enable='${g}eq(mod(${k},3),1)*lt(${u},0.13)'`;
      }
      if (fx[i + 1] === 'whip') blur += `,gblur=sigma=34:sigmaV=0:enable='gt(t,${(d - 0.07).toFixed(3)})'`;
      const rot = a ? `rotate=a='${a}':c=black,` : '';
      return `${rot}scale=w='trunc(${Wc}*(${z})/2)*2+2':h=-2:eval=frame:flags=bicubic,crop=w=1080:h=1920:x='${cx}':y='(ih-1920)*0.3'${blur},setsar=1`;
    };
    segs.forEach((s, i) => {
      const d = s.b - s.a;
      const pb = pull as PullBack | null;
      const main = { ins, parts, idx };
      if (parallel) { ins = ['-ss', s.a.toFixed(3), '-t', (d + 0.1).toFixed(3), '-i', o.input]; parts = [`[0:v]setpts=PTS-STARTPTS+${s.a.toFixed(3)}/TB,fps=30,${grade}[v${i}]`]; idx = 1; }
      if (pb && pb.seg === i && pb.plate && pb.bezel && pb.cards?.length) {
        // shrink into the phone (0.15 s in, 0.35 s ramp), hold with the list, zoom back out over the last 0.4 s
        const e0 = `clip((t-0.15)/0.35,0,1)*clip((${(d - 0.05).toFixed(3)}-t)/0.4,0,1)`, e = `(${e0})*(${e0})*(3-2*(${e0}))`, S = `(1-${(1 - PHONE.s).toFixed(2)}*${e})`;
        const X = `(W-w)/2-${PHONE.shift}*${e}`;
        parts.push(`[v${i}]trim=${s.a.toFixed(3)}:${s.b.toFixed(3)},setpts=PTS-STARTPTS,${frameOf(i)},scale=w='trunc(1080*${S}/2)*2':h=-2:eval=frame[pf${i}]`);
        ins.push('-i', pb.plate); const pl = nextIn();
        ins.push('-i', pb.bezel); const bz = nextIn();
        parts.push(`[${bz}:v]${loopF(d)},format=yuva420p,scale=w='trunc(${1080 + 2 * PHONE.border}*${S}/2)*2':h=-2:eval=frame[pz${i}]`);
        parts.push(`[${pl}:v]${loopF(d)},format=yuv420p,setsar=1[pp${i}];[pp${i}][pf${i}]overlay=x='${X}':y='(H-h)/2'[pa${i}];[pa${i}][pz${i}]overlay=x='${X}':y='(H-h)/2':enable='between(t,0.26,${(d - 0.16).toFixed(3)})'[pb${i}]`);
        let last = `pb${i}`; const hold0 = 0.55, step = (d - 0.5 - hold0) / pb.cards.length;
        pb.cards.forEach((f, n) => {
          ins.push('-i', f); const li = nextIn();
          const t0 = hold0 + n * step, t1 = n + 1 < pb.cards!.length ? hold0 + (n + 1) * step : d - 0.45;
          parts.push(`[${li}:v]${loopF(d)},format=yuva420p[pl${i}_${n}];[${last}][pl${i}_${n}]overlay=0:0:enable='between(t,${t0.toFixed(3)},${t1.toFixed(3)})'[pq${i}_${n}]`); last = `pq${i}_${n}`;
        });
        parts.push(`[${last}]format=yuv420p,setsar=1[c${i}]`);
      } else if (wallSeg && wallSeg.i === i) {
        // the wall: his live picture is the middle tile; the others are his clip at other cuts and the stock clips
        parts.push(`[v${i}]trim=${s.a.toFixed(3)}:${s.b.toFixed(3)},setpts=PTS-STARTPTS,${frameOf(i)}[wl${i}]`);
        const srcs: string[] = [];
        const offs = segs.map((sg, j) => j === i ? -1 : sg.a + 0.15).filter(x => x >= 0).slice(0, 6);
        for (const a of offs) { ins.push('-ss', a.toFixed(3), '-t', (d + 0.3).toFixed(3), '-i', o.input); srcs.push(`${nextIn()}:v`); }
        for (const f of wallClips) { ins.push('-stream_loop', '-1', '-t', (d + 0.3).toFixed(3), '-i', f); srcs.push(`${nextIn()}:v`); }
        // stock clips interleaved with his own, so neighbours differ
        const mixed = srcs.slice(offs.length).flatMap((x, k) => [x, srcs[k]!]).concat(srcs.slice(Math.min(offs.length, wallClips.length), offs.length));
        parts.push(...wallFilter(`wl${i}`, mixed.length ? mixed : [`wl${i}`], d, `c${i}`, `w${i}_`));
      } else if (fx[i] === 'break' && d > 0.7) {
        // the frame breaks: for 0.3 s the picture splits into three bands that slide apart with a colour split, and snap back
        const q = 'pow(max(0,1-t/0.28),2)';
        parts.push(`[v${i}]trim=${s.a.toFixed(3)}:${s.b.toFixed(3)},setpts=PTS-STARTPTS,${frameOf(i)},split[bka${i}][bkb${i}]`);
        parts.push(`[bka${i}]trim=end=0.3,setpts=PTS-STARTPTS,rgbashift=rh=-14:bh=14,split=4[bk0_${i}][bk1_${i}][bk2_${i}][bk3_${i}]`);
        parts.push(`[bk0_${i}]eq=brightness=-0.4[bkg${i}];[bk1_${i}]crop=1080:640:0:0[bs1_${i}];[bk2_${i}]crop=1080:640:0:640[bs2_${i}];[bk3_${i}]crop=1080:640:0:1280[bs3_${i}]`);
        parts.push(`[bkg${i}][bs1_${i}]overlay=x='-120*${q}':y=0[bo1_${i}];[bo1_${i}][bs2_${i}]overlay=x='150*${q}':y=640[bo2_${i}];[bo2_${i}][bs3_${i}]overlay=x='-90*${q}':y=1280,format=yuv420p,setsar=1[bx${i}]`);
        parts.push(`[bkb${i}]trim=start=0.3,setpts=PTS-STARTPTS,format=yuv420p,setsar=1[by${i}];[bx${i}][by${i}]concat=n=2:v=1:a=0[c${i}]`);
      } else if (gag && gag.seg === i) {
        // the face label: a yellow box that follows his face with a tag on it, for about 1.5 s
        parts.push(`[v${i}]trim=${s.a.toFixed(3)}:${s.b.toFixed(3)},setpts=PTS-STARTPTS,${frameOf(i)}[gb${i}]`);
        ins.push('-i', gag.png); const gi = nextIn();
        parts.push(`[${gi}:v]${loopF(gag.d)},format=yuva420p,fade=t=in:st=0:d=0.1:alpha=1,fade=t=out:st=${(gag.d - 0.12).toFixed(2)}:d=0.12:alpha=1,setpts=PTS-STARTPTS+${gag.t0.toFixed(3)}/TB[gt${i}]`);
        parts.push(`[gb${i}][gt${i}]overlay=x='${gag.x}':y='${gag.y}':eof_action=pass:enable='between(t,${gag.t0.toFixed(3)},${(gag.t0 + gag.d).toFixed(3)})',format=yuv420p,setsar=1[c${i}]`);
      } else parts.push(`[v${i}]trim=${s.a.toFixed(3)}:${s.b.toFixed(3)},setpts=PTS-STARTPTS,${frameOf(i)}[c${i}]`);
      if (parallel) {
        const f = join(o.dir, `cut-${i}.mp4`), g = join(o.dir, `cut-${i}.txt`), cutIns = ins, n = Math.round(d * 30);
        writeFileSync(g, parts.join(';\n'));
        cutJobs.push(() => sh(config.ffmpeg, ['-nostdin', '-v', 'error', '-y', ...cutIns, '-filter_complex_script', g, '-map', `[c${i}]`, '-an', '-frames:v', String(n),
          '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '10', '-pix_fmt', 'yuv420p', '-r', '30', f], { timeout: 180_000 }));
        ({ ins, parts, idx } = main);
        ins.push('-i', f); const k = nextIn();
        parts.push(`[${k}:v]setpts=PTS-STARTPTS,setsar=1,format=yuv420p[c${i}]`);
      }
      parts.push(`[a${i}]atrim=${s.a.toFixed(3)}:${s.b.toFixed(3)},asetpts=PTS-STARTPTS,afade=t=in:d=0.012,afade=t=out:st=${Math.max(0, d - 0.018).toFixed(3)}:d=0.018[d${i}]`);
    });
    if (endPng) {
      // the end card, animated: a white flash, the title slams in from 2.4x with a small bounce, the line rises in under
      // it, the plate drifts closer; the voice is silent under it
      const E = END.toFixed(2);
      ins.push('-i', endPng.bg); const eb = nextIn();
      ins.push('-i', endPng.title); const et = nextIn();
      const S = `(1+1.4*pow(max(0,1-t/0.3),3)-0.07*sin(PI*min(1,max(0,(t-0.3)/0.3))))`;
      parts.push(`[${eb}:v]${loopF(END)},scale=w='trunc(1080*(1+0.07*t/${E})/2)*2':h=-2:eval=frame,crop=1080:1920,setsar=1,format=yuv420p[eb0]`);
      parts.push(`[${et}:v]${loopF(END)},format=yuva420p,scale=w='trunc(iw*${S}/2)*2':h=-2:eval=frame,fade=t=in:st=0:d=0.08:alpha=1[et0]`);
      parts.push(`[eb0][et0]overlay=x='(W-w)/2':y='${endPng.titleY}-h/2':eval=frame[eb1]`);
      let ecur = 'eb1';
      if (endPng.line) {
        ins.push('-i', endPng.line); const el = nextIn();
        parts.push(`[${el}:v]${loopF(END)},format=yuva420p,fade=t=in:st=0.35:d=0.22:alpha=1[el0]`);
        parts.push(`[eb1][el0]overlay=x='(W-w)/2':y='${endPng.lineY}+70*pow(1-min(1,max(0,(t-0.35)/0.3)),2)':eval=frame[eb2]`); ecur = 'eb2';
      }
      parts.push(`[${ecur}]fade=t=in:st=0:d=0.14:color=white,format=yuv420p,setsar=1,fps=30[endv]`);
      parts.push(`anullsrc=r=48000:cl=stereo,atrim=0:${E}[enda]`);
    }
    parts.push(`${segs.map((_, i) => `[c${i}][d${i}]`).join('')}${endPng ? '[endv][enda]' : ''}concat=n=${segs.length + (endPng ? 1 : 0)}:v=1:a=1[base][voice]`);
    let cur = 'base';
    if (behind?.masks && behind.png) {
      // the word over the picture, then the speaker (the same picture through the person mask) back on top
      const { wa, wb, seg, segOut } = behind, n = Math.round((wb - wa) * 30);
      ins.push('-i', behind.png); const bi = idx++;
      ins.push('-framerate', '30', '-i', join(behind.masks, 'm%04d.png')); const mi = idx++;
      parts.push(`[${cur}]split[bt0][bt1]`);
      parts.push(`[${bi}:v]${loopF(wb - wa + 0.1)},format=yuva420p,scale=w='trunc(1080*(1.18-0.18*min(1,t/0.25))/2)*2':h=-2:eval=frame,crop=1080:1920,fade=t=in:st=0:d=0.12:alpha=1,fade=t=out:st=${(wb - wa - 0.15).toFixed(2)}:d=0.15:alpha=1,setpts=PTS-STARTPTS+${wa.toFixed(3)}/TB[bw]`);
      parts.push(`[bt0][bw]overlay=0:0:eof_action=pass:enable='between(t,${wa.toFixed(3)},${wb.toFixed(3)})'[tb]`);
      parts.push(`[${mi}:v]format=gray,trim=end_frame=${n},setpts=PTS-STARTPTS+${(wa - segOut).toFixed(3)}/TB,${frameOf(seg)},format=gray,setpts=PTS-STARTPTS[mk]`);
      parts.push(`[bt1]trim=start=${wa.toFixed(3)}:end=${wb.toFixed(3)},setpts=PTS-STARTPTS,format=yuv420p[bc]`);
      parts.push(`[bc][mk]alphamerge,setpts=PTS-STARTPTS+${wa.toFixed(3)}/TB[pp]`);
      parts.push(`[tb][pp]overlay=0:0:eof_action=pass[bh]`); cur = 'bh';
    }
    for (const [k, c] of cards.entries()) {
      ins.push(...cardInput(c));
      parts.push(cardFilter(c, `${idx}:v`, k));
      const xIn = c.side === 'left' ? CARD.margin - 8 : 1080 - CARD.margin - CARD.w - 8;
      const from = c.side === 'left' ? -CARD.w : 1080;
      // slides in from its side over 0.2 s, then holds
      parts.push(`[${cur}][k${k}]overlay=x='${from}+(${xIn}-(${from}))*min(1,(t-${c.at.toFixed(3)})/0.2)':y=${CARD.y}:eof_action=pass:enable='between(t,${c.at.toFixed(3)},${(c.at + c.dur).toFixed(3)})'[o${k}]`);
      cur = `o${k}`; idx++;
    }
    // light leaks on the odd cuts (the even ones zoom through)
    const beatAt = segs.flatMap((sg, i) => { const s = subOf(i); if (!s.len) return []; const out: number[] = []; for (let u = s.from + (s.from ? 0 : s.len); u < sg.b - sg.a - 0.3; u += s.len) out.push(segOut(i) + u); return out; });
    const leakAt = [...segs.map((_, i) => i).filter(i => i > 0 && (fx[i] === 'orbit' || (fx[i] === 'none' && !special(i)))).map(i => segOut(i)), ...beatAt].sort((a, b) => a - b);
    for (const [n, t] of (leak ? leakAt : []).entries()) {
      ins.push('-i', leak!); const li = nextIn();
      parts.push(`[${li}:v]${loopF(0.45)},format=yuva420p,fade=t=in:st=0:d=0.1:alpha=1,fade=t=out:st=0.12:d=0.3:alpha=1,setpts=PTS-STARTPTS+${Math.max(0, t - 0.08).toFixed(3)}/TB[lk${n}]`);
      parts.push(`[${cur}][lk${n}]overlay=0:0:eof_action=pass[lv${n}]`); cur = `lv${n}`;
    }
    if (caps) {
      if (caps.kinetic) ins.push(...((caps.c as Kinetic).list ? ['-f', 'concat', '-safe', '0', '-i', (caps.c as Kinetic).list!] : ['-framerate', '30', '-i', (caps.c as Kinetic).pattern])); else ins.push('-i', join(caps.c.dir, 'captions.mkv'));
      // never over the phone screen: the words step aside while the picture is in the phone
      const off = pull && pbWin ? `:enable='not(between(t,${(pbWin[0] + 0.2).toFixed(3)},${(pbWin[1] - 0.3).toFixed(3)}))'` : '';
      parts.push(`[${cur}][${idx}:v]overlay=0:${caps.c.top}:eof_action=pass${off},format=yuv420p[vf]`); cur = 'vf'; idx++;
    }
    // voice: rumble out, a gentle denoise, levelled; the bed low under it
    const bed = join(config.assets, 'music', 'bed.mp3');
    parts.push(`[voice]highpass=f=90,afftdn=nf=-30,acompressor=threshold=-20dB:ratio=3:attack=5:release=120,loudnorm=I=-15:TP=-2:LRA=7[vx]`);
    if (o.music !== false && existsSync(bed)) {
      ins.push('-stream_loop', '-1', '-i', bed);
      parts.push(`[${idx}:a]atrim=0:${total.toFixed(3)},volume=0.09,afade=t=in:d=0.5,afade=t=out:st=${Math.max(0, total - 1).toFixed(2)}:d=1[bed]`);
      parts.push(`[vx][bed]amix=inputs=2:normalize=0:duration=first,loudnorm=I=-14:TP=-1.5:LRA=9,aresample=48000[mix]`);
    } else parts.push(`[vx]loudnorm=I=-14:TP=-1.5:LRA=9,aresample=48000[mix]`);
    if (cutJobs.length) { const s0 = Date.now(); await pool(cutJobs, 4); stages.cuts = (Date.now() - s0) / 1000; }
    writeFileSync(join(o.dir, 'graph.txt'), parts.join(';\n'));
    writeFileSync(join(o.dir, 'inputs.json'), JSON.stringify(ins));
    await sh(config.ffmpeg, ['-nostdin', '-v', 'error', '-y', ...ins, '-filter_complex_script', join(o.dir, 'graph.txt'), '-map', `[${cur}]`, '-map', '[mix]',
      '-t', total.toFixed(3), '-c:v', 'libx264', '-preset', 'superfast', '-crf', '23', '-maxrate', '6M', '-bufsize', '12M', '-pix_fmt', 'yuv420p', '-r', '30', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', o.out], { timeout: 300_000 });
  });
  if (!existsSync(o.out) || statSync(o.out).size < 10_000) throw new Error('the edit came out empty');
  const wall = (Date.now() - t0) / 1000;
  const report: FootageEditReport = {
    input: o.input, out: o.out, duration: +total.toFixed(3), sourceDuration: duration, transcript: keep.map(w => w.word).join(' '), heard: words.map(w => w.word).join(' '),
    removed, words: keep, segs, cards: cards.map(c => ({ ...c, file: undefined })), captions: caps?.look ?? 'none', keywords, stages, total: wall,
  };
  writeFileSync(join(o.dir, 'report.json'), JSON.stringify(report, null, 1));
  return report;
}
