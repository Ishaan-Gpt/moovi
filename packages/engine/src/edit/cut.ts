import { execFile } from 'node:child_process';
import { config } from '../config';

/**
 * The cut laws, from footage-edit (router/footage-edit.ts, where they were proven on Vignesh's raw clip): the clip's
 * loudness envelope, pauses relative to its own noise floor, the take window (slate cues, set-up talk, a ghost last
 * word), jump-cut segments with a breath of air either side, and key words. Pure except `envelope` (one ffmpeg read).
 */
export interface Word { word: string; t: number; end: number; p?: number }
export interface Seg { a: number; b: number; zoom: number }

/** A word reduced to its letters and digits, any script (Devanagari, Tamil and Arabic words keep their letters). */
export const bare = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}']/gu, '');

export const CUES = new Set(['start', 'action', 'rolling', 'go', 'ready', 'okay', 'ok']);
export const FILLERS = new Set(['um', 'uh', 'erm', 'uhm', 'hmm', 'mm', 'ah', 'er']);
export const OPENERS = new Set(['and', 'so', 'okay', 'ok', 'alright', 'well']);

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
