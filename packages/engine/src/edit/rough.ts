import type { Word } from '../audio/tts';
import { shotCamera } from './camera';
import type { EdlShot, EdlWord, Palette, PlayerEdl } from './lib';

/**
 * A STAND-IN edit plan, so the preview player and the studio route run before D1.3 lands (Tab extracts the real EDL
 * builder from footage-edit; this file goes when it does). It applies only R4's shared laws, from word times alone:
 * pauses over `pauseMax` trimmed to `pauseKeep`, a new shot at each sentence and at least every `holdMax`, an
 * alternating punch-in (named camera-layer moves, camera.ts), and key words by a crude rule (numbers, long words). No model call, no faces, no inserts.
 */
export type { Word };
export interface RoughOpts { pauseMax?: number; pauseKeep?: number; holdMax?: number; punch?: number; captionStyle?: string; palette: Palette; output?: { w: number; h: number; fps: number } }

const isStop = (w: string) => /[.!?]$/.test(w);
const isKey = (w: string) => /\d/.test(w) || w.replace(/[^\p{L}]/gu, '').length >= 8;

export function roughEdl(source: PlayerEdl['source'], words: Word[], o: RoughOpts): PlayerEdl {
  const pauseMax = o.pauseMax ?? 0.4, pauseKeep = o.pauseKeep ?? 0.18, holdMax = o.holdMax ?? 2.6, punch = o.punch ?? 1.12;
  // whisper sometimes returns a word with zero length (Test 1: "Movie" at 5.42 s); give it a short span up to the
  // next word instead of dropping it, so every spoken word is captioned
  const sorted = words.filter(w => w.t < source.duration && w.end >= w.t).sort((a, b) => a.t - b.t);
  const ws = sorted.map((w, i) => w.end > w.t ? w : { ...w, end: Math.min(w.t + 0.12, sorted[i + 1]?.t ?? w.t + 0.12, source.duration) }).filter(w => w.end > w.t);
  // keep ranges in source time: speech, with long pauses cut down to a breath (half the kept pause on each side)
  const keep: [number, number][] = [];
  if (!ws.length) keep.push([0, source.duration]);
  else {
    let a = Math.max(0, ws[0]!.t - pauseKeep / 2), b = ws[0]!.end;
    for (let i = 1; i < ws.length; i++) {
      const w = ws[i]!;
      if (w.t - b > pauseMax) { keep.push([a, Math.min(source.duration, b + pauseKeep / 2)]); a = Math.max(0, w.t - pauseKeep / 2); }
      b = Math.max(b, w.end);
    }
    keep.push([a, Math.min(source.duration, b + pauseKeep / 2)]);
  }
  // shot boundaries in source time: every keep range starts one; a sentence start or holdMax starts another
  const starts = new Set<number>(keep.map(k => k[0]));
  for (let i = 1; i < ws.length; i++) if (isStop(ws[i - 1]!.word)) starts.add(ws[i]!.t - 0.04);
  // a clip much wider than the film (landscape into vertical) is shown whole over a blurred fill, not centre-cropped
  // to a third of its width (Tab's Test 1); with faces, D1.3 can crop on the face instead
  const out = o.output ?? { w: 1080, h: 1920, fps: 30 }, fit = source.w / source.h > 1.6 * (out.w / out.h);
  const shots: EdlShot[] = []; let t = 0, n = 0;
  for (const [a, b] of keep) {
    const cuts = [...starts].filter(s => s > a + 0.3 && s < b - 0.3).sort((x, y) => x - y);
    const edges = [a, ...cuts, b];
    for (let i = 0; i + 1 < edges.length; i++) {
      // split anything longer than holdMax into equal parts (a punch change inside a long thought)
      const s0 = edges[i]!, s1 = edges[i + 1]!, parts = Math.max(1, Math.ceil((s1 - s0) / holdMax));
      for (let p = 0; p < parts; p++) {
        const src_in = s0 + (s1 - s0) * p / parts, src_out = s0 + (s1 - s0) * (p + 1) / parts, d = src_out - src_in;
        const c = shotCamera({ t_in: t, t_out: t + d, base: { scale: 1, cx: 0.5, cy: 0.4 }, punch: n % 2 === 1, afterPunch: n % 2 === 0 && n > 0, first: n === 0, punchScale: punch, push: 1.04, words: [], lastPulse: -9, lastDive: -9, aspect: out.w / out.h });
        shots.push({ t_in: +t.toFixed(4), t_out: +(t + d).toFixed(4), src_in: +src_in.toFixed(4), src_out: +src_out.toFixed(4), ...(fit ? { layout: 'fit', bg: { mode: 'blur' } } : { layout: 'full' }), framing: c.framing, ...(c.zoom ? { zoom: c.zoom } : {}), ...(c.camera ? { camera: c.camera } : {}) });
        t += d; n++;
      }
    }
  }
  // make the output times exactly contiguous after rounding
  for (let i = 1; i < shots.length; i++) shots[i]!.t_in = shots[i - 1]!.t_out;
  const edlWords: EdlWord[] = ws.map(w => ({ src_t0: w.t, src_t1: w.end, text: w.word, role: /\d/.test(w.word) ? 'number' : isKey(w.word) ? 'key' : 'connector' }));
  return {
    version: '0-rough', style_id: 'rough', seed: 0, source,
    output: out,
    palette: o.palette, caption_style_id: o.captionStyle ?? 'punch-duo',
    words: edlWords, shots, inserts: [],
  };
}
