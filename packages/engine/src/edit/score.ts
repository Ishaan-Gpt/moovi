import { EDIT, type PlayerEdl } from './lib';
import { keepOf } from './edl';

/**
 * The R9 edit score (docs/agents/research/R9-benchmark-set.md), the pure part: every number here is read from the EDL,
 * the word truth and the caption/face boxes the bench samples from the player. scripts/edit-bench.ts runs the clips,
 * this file scores them, test/edit-score.test.ts pins it.
 */
export interface TruthWord { t0: number; t1: number; text: string; speaker?: string; lang?: string; aligned?: boolean }
export interface Truth { id: string; lang: string; source: string; checked_by: string; checked_at: string; words: TruthWord[] }

/** Lowercase, punctuation off; letters, marks (Devanagari vowel signs) and digits kept. */
export const norm = (s: string) => s.toLowerCase().normalize('NFC').replace(/[^\p{L}\p{M}\p{N}']/gu, '').replace(/^'+|'+$/g, '');
export const tokens = (s: string) => s.split(/\s+/).map(norm).filter(Boolean);

/** Word error rate: (substitutions + deletions + insertions) / reference words. */
export function wer(ref: string[], hyp: string[]): number {
  if (!ref.length) return hyp.length ? 1 : 0;
  let prev = Array.from({ length: hyp.length + 1 }, (_, j) => j);
  for (let i = 1; i <= ref.length; i++) {
    const cur = [i];
    for (let j = 1; j <= hyp.length; j++) cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (ref[i - 1] === hyp[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[hyp.length]! / ref.length;
}

/** Truth words inside [a, b) of source time (by their centre). */
const inside = (ws: TruthWord[], a: number, b: number) => ws.filter(w => (w.t0 + w.t1) / 2 >= a && (w.t0 + w.t1) / 2 < b);

/**
 * Words right: 1 - WER of the EDL's words against the truth over the same source span the EDL heard (the whole
 * clip; words the edit cut are still in `words[]`, so this scores the hearing, not the cut).
 */
export function wordsRight(e: PlayerEdl, truth: Truth): number {
  return Math.max(0, 1 - wer(truth.words.flatMap(w => tokens(w.text)), e.words.flatMap(w => tokens(w.text))));
}

const SCRIPTS: Record<string, RegExp> = { hi: /\p{Script=Devanagari}/u, mr: /\p{Script=Devanagari}/u, en: /\p{Script=Latin}/u, as: /\p{Script=Bengali}/u, bn: /\p{Script=Bengali}/u };
/** Share of letters in the language's own script; and whether any Arabic script (R3's Urdu misread) is in the words. */
export function scriptCheck(e: PlayerEdl, lang: string): { pct: number; arabic: boolean } {
  const letters = [...e.words.map(w => w.text).join('')].filter(c => /\p{L}/u.test(c));
  const re = SCRIPTS[lang] ?? /\p{L}/u, own = letters.filter(c => re.test(c) || (lang !== 'en' && /\p{Script=Latin}/u.test(c)));
  return { pct: letters.length ? Math.round(1000 * own.length / letters.length) / 10 : 100, arabic: letters.some(c => /\p{Script=Arabic}/u.test(c)) };
}

/** Gaps between kept words in the output over `pauseMax` (count and the longest); and truth pauses over pauseMax that were trimmed. */
export function pausesLeft(e: PlayerEdl, pauseMax: number, truth?: Truth): { left: number; max: number; trimmed: number | null } {
  const ow = EDIT.outWords(e);
  let left = 0, max = 0;
  for (let i = 1; i < ow.length; i++) { const g = ow[i]!.t0 - ow[i - 1]!.t1; if (g > pauseMax + 1e-6) left++; max = Math.max(max, g); }
  let trimmed: number | null = null;
  if (truth) {
    trimmed = 0;
    const keep = keepOf(e), kept = (a: number, b: number) => keep.reduce((s, k) => s + Math.max(0, Math.min(b, k.src_out) - Math.max(a, k.src_in)), 0);
    for (let i = 1; i < truth.words.length; i++) {
      const a = truth.words[i - 1]!.t1, b = truth.words[i]!.t0;
      if (b - a > pauseMax && kept(a, b) < b - a - 0.02 && kept(a, b) <= pauseMax + 0.02) trimmed++;
    }
  }
  return { left, max: Math.round(max * 1000) / 1000, trimmed };
}

/** Kept source seconds inside the slate: the run up to the first cue word ("start", "action") in the first 15 s. */
export function slateKept(e: PlayerEdl, truth: Truth): { slate: [number, number] | null; kept: number } {
  const cue = truth.words.find(w => w.t0 < 15 && /^(start|action|rolling)$/.test(norm(w.text)));
  if (!cue) return { slate: null, kept: 0 };
  const keep = keepOf(e), kept = keep.reduce((s, k) => s + Math.max(0, Math.min(cue.t1, k.src_out) - Math.max(0, k.src_in)), 0);
  return { slate: [0, cue.t1], kept: Math.round(kept * 100) / 100 };
}

/**
 * Cut on word: every jump in the source between two shots (a speaker cut) is checked on both sides against the word
 * edges (truth words when given, else the EDL's own): on word when within `snapMs` of an edge; inside a word when it
 * lies inside a word more than snapMs from both its edges.
 */
export function cutOnWord(e: PlayerEdl, words: { t0: number; t1: number }[], snapMs = 100): { cuts: number; on: number; pct: number; insideWord: number } {
  const s = snapMs / 1000, edges = words.flatMap(w => [w.t0, w.t1]);
  const near = (x: number) => edges.some(y => Math.abs(x - y) <= s);
  const inWord = (x: number) => words.some(w => x > w.t0 + s && x < w.t1 - s);
  let cuts = 0, on = 0, insideWord = 0;
  for (let i = 1; i < e.shots.length; i++) {
    const a = e.shots[i - 1]!, b = e.shots[i]!;
    if (Math.abs(b.src_in - a.src_out) < 0.002) continue;
    cuts++;
    if (near(a.src_out) && near(b.src_in)) on++;
    if (inWord(a.src_out) || inWord(b.src_in)) insideWord++;
  }
  return { cuts, on, pct: cuts ? Math.round(1000 * on / cuts) / 10 : 100, insideWord };
}

export interface Box { x: number; y: number; w: number; h: number }
const overlap = (a: Box, b: Box) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
/** One sampled frame: the caption box and the face box, as fractions of the output frame (null when not on screen). */
export interface FrameBoxes { t: number; cap: Box | null; face: Box | null }
/** Share of caption frames whose box overlaps the face box; caption frames touching the top 8% or bottom 15%. */
export function zones(frames: FrameBoxes[]): { capFrames: number; offFacePct: number; onFace: number; platform: number } {
  const cf = frames.filter(f => f.cap && f.cap.w > 0 && f.cap.h > 0);
  const onFace = cf.filter(f => f.face && overlap(f.cap!, f.face) > 0).length;
  const platform = cf.filter(f => f.cap!.y < 0.08 || f.cap!.y + f.cap!.h > 0.85).length;
  return { capFrames: cf.length, offFacePct: cf.length ? Math.round(1000 * (cf.length - onFace) / cf.length) / 10 : 100, onFace, platform };
}

/** Deep key-sorted JSON, for the determinism check (the same inputs must give byte-equal EDLs). */
export function stable(x: unknown): string {
  const sort = (v: unknown): unknown => Array.isArray(v) ? v.map(sort) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v as object).sort().map(k => [k, sort((v as Record<string, unknown>)[k])])) : v;
  return JSON.stringify(sort(x));
}
