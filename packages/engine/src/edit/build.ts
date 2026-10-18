import { EDL_VERSION, metricsOf, type Edl, type EdlBeat, type EdlCut, type EdlRemoved } from './edl';
import { bare, CUES, FILLERS, OPENERS, keywordsOf, takeWindow, type Word } from './cut';
import { EDIT, type EdlShot, type EdlWord, type Palette } from './lib';
import { pickLook, type CaptionLook } from './looks';

/**
 * D1.3: the EDL builder, extracted from footage-edit (router/footage-edit.ts). Pure: the same words, pauses, faces,
 * style and laws give the same EDL (R4's determinism law), so it is unit-tested without media and runs in
 * milliseconds; the media work (probe, loudness, speech) happens before it (plan.ts). What it decides:
 *  1. the take: set-up talk before a slate cue or a long opening pause goes, and a ghost last word (footage-edit);
 *  2. jump cuts: every pause over `pause_max` is cut down to `pause_keep` of air (split before and after the words),
 *     every filler word goes with the air around it, a take that opens on "and"/"so" starts on the next word;
 *  3. snap: no cut lands inside a kept word, and every cut sits within `snap_ms` of a word edge;
 *  4. shots: a new framing at each jump cut, each new sentence, and before `hold_max`; framings alternate full and a
 *     punch-in centred on the face (`faces[]` from the look step goes into the EDL, so the player crops on it), with a
 *     slow push inside long shots; a landscape clip is shown whole over a blurred fill, alternating with the face
 *     close-up when a face is known;
 *  5. words with roles (key words, numbers, names), sentence ids, and beat tags (given by the one model call, else
 *     by rule); `removed[]`, `cuts[]` and `metrics` with the rule behind every decision.
 */
export interface Laws { pause_max: number; pause_keep: number; hold_max: number; snap_ms: number; punch: number; push: number; min_shot: number; /** a heard pause (the cleaned voice under the silence line) longer than this is trimmed to pause_keep: under pause_max, so the air left plus a word's soft edge stays under R9's 0.4 s hole */ quiet_max: number; /** air always kept before a kept word's start (s): no cut lands closer, so a soft onset is never chopped */ pad_in: number; /** air always kept after a kept word's end (s): a soft tail (an s, an f, a falling vowel) is never chopped */ pad_out: number }
export const DEFAULT_LAWS: Laws = { pause_max: 0.4, pause_keep: 0.18, hold_max: 2.6, snap_ms: 100, punch: 1.12, push: 1.04, min_shot: 0.6, quiet_max: 0.32, pad_in: 0.1, pad_out: 0.15 };
/** How far from a word edge a cut still counts as on the word (ms): a cut sits pad_in before a start or pad_out after an end on purpose, plus up to 0.1 s where the heard quiet trimmed a soft edge and the air guard gave it back, plus 20 ms. Pure. */
export const onWordMs = (L: Pick<Laws, 'snap_ms' | 'pad_in' | 'pad_out'> = DEFAULT_LAWS) => Math.max(L.snap_ms, Math.round(1000 * (Math.max(L.pad_in, L.pad_out) + 0.1)) + 20);
export const RULES_VERSION = 'r4-2026-10-16';

export interface Face { src_t: number; x: number; y: number; w: number; h: number; conf?: number }
export interface BuildInput {
  source: Edl['source'];
  /** timed words in source seconds, the final transcript (hear's output) */
  words: Word[];
  /** loudness pauses in source seconds (cut.ts `pauses`), relative to the clip's own noise floor; may be empty */
  pauses?: [number, number][];
  /** heard pauses in source seconds (voice.ts `quietPauses`: the cleaned voice under the R9 silence line); word edges
   *  are fitted to them (`fitWords`) and each one over quiet_max is trimmed; may be empty */
  quiet?: [number, number][];
  faces?: Face[];
  /** beat tags from the one model call, by sentence index; missing sentences are tagged by rule */
  tags?: Record<number, EdlBeat['tag']>;
  /** caption: a player caption style id; look: a captionseasy look number or id (else the style's own) */
  style?: { id?: string; variant?: string; caption?: string; look?: number | string; output?: Edl['output'] };
  /** the transcript's language (hear's `language`), stored in the caption look */
  language?: string;
  palette: Palette;
  laws?: Partial<Laws>;
  seed?: number;
  /** source spans said again better later (edit/takes.ts dropSpans): cut as `retake` holes, their words never kept */
  retakes?: { a: number; b: number; text?: string }[];
}

const r4 = (x: number) => Math.round(x * 10000) / 10000;
const isStop = (w: string) => /[.!?]["')\]]*$/.test(w);
const CTA = /^(comment|follow|subscribe|link|bio|try|download|sign|join|dm|share|save)$/;

/** Sentence index per word (a word ending in . ! or ? closes its sentence). */
export function sentences(ws: Word[]): number[] {
  let k = 0; return ws.map(w => { const id = k; if (isStop(w.word)) k++; return id; });
}

/**
 * Word edges fitted to heard pauses: Whisper's word times run across real pauses (B2: "visit" 22.05 to 22.44 and
 * "striking" 22.44 to 23.03 s over a pause heard from 22.24 to 22.76 s), so the builder sees no gap to trim and the
 * film keeps a silence hole. A pause over a word's head moves its start to the pause's end; over its tail, its end to
 * the pause's start; inside it (longer than quiet_max), the word keeps its longer side. A word a pause covers whole,
 * or one that would shrink under `minWord`, keeps its times. Pure; returns new words in the same order.
 */
/**
 * Words the hearing gave no length (t === end: the accurate text laid onto a coarse timing collapses a word onto its
 * neighbour's edge) get a share of the time around them instead of being dropped: a run of them and its two
 * neighbours split the span from the word before to the word after by letter count (2 letters at least each). Before
 * this, "it will edit your videos in 5 minutes" captioned as "it will your in 5 minutes" (B1, Atlas and Handmade).
 * Pure; words already with a length keep their order and their outer edges.
 */
export function spreadZeroWords(ws: Word[]): Word[] {
  const out = ws.map(w => ({ ...w }));
  const zero = (w: Word) => !(w.end > w.t) && !!w.word.trim();
  for (let i = 0; i < out.length; i++) {
    if (!zero(out[i]!)) continue;
    let j = i; while (j + 1 < out.length && zero(out[j + 1]!)) j++;
    const a = i > 0 && !zero(out[i - 1]!) ? i - 1 : i, b = j + 1 < out.length ? j + 1 : j;
    const t0 = out[a]!.t, t1 = Math.max(out[b]!.end, out[b]!.t);
    if (t1 - t0 > 0.02) {
      const span = out.slice(a, b + 1), wt = span.map(w => Math.max(2, w.word.replace(/[^\p{L}\p{N}]/gu, '').length)), tot = wt.reduce((x, y) => x + y, 0);
      let t = t0;
      span.forEach((w, k) => { const d = (t1 - t0) * wt[k]! / tot; w.t = +t.toFixed(3); w.end = +(t + d).toFixed(3); t += d; });
      span[span.length - 1]!.end = +t1.toFixed(3);
    }
    i = j;
  }
  return out;
}

export function fitWords(ws: Word[], quiet: [number, number][], quietMax = DEFAULT_LAWS.quiet_max, minWord = 0.06): Word[] {
  const tol = 0.05;
  return ws.map(w0 => {
    let w = { ...w0 };
    for (const [p0, p1] of quiet) {
      if (p1 <= w.t + 1e-3 || p0 >= w.end - 1e-3) continue;
      const head = p0 <= w.t + tol, tail = p1 >= w.end - tol;
      if (head && tail) continue;
      let next = w;
      if (head) next = { ...w, t: p1 };
      else if (tail) next = { ...w, end: p0 };
      else if (p1 - p0 > quietMax) next = p0 - w.t >= w.end - p1 ? { ...w, end: p0 } : { ...w, t: p1 };
      if (next.end - next.t >= minWord) w = next;
    }
    return w;
  });
}

/** Holes to cut, in source seconds, each with its reason; merged and sorted. */
export function holesOf(ws: Word[], ps: [number, number][], take: { a: number; b: number }, L: Laws, quiet: [number, number][] = [], retakes: { a: number; b: number; text?: string }[] = []): { a: number; b: number; reason: EdlRemoved['reason']; text?: string; rule: string }[] {
  const airOut = L.pause_keep / 2, airIn = L.pause_keep / 2, out: { a: number; b: number; reason: EdlRemoved['reason']; text?: string; rule: string }[] = [];
  const isFill = (w: Word) => FILLERS.has(bare(w.word));
  const speech = ws.filter(w => !isFill(w));
  // pauses between spoken words (word timings), over pause_max
  for (let i = 1; i < speech.length; i++) {
    const a = speech[i - 1]!.end, b = speech[i]!.t;
    if (b - a > L.pause_max) out.push({ a: a + airOut, b: b - airIn, reason: 'pause_trim', rule: 'law.pause_trim' });
  }
  // pauses the loudness hears inside a word span the recogniser stretched (a long "uh" gap, a breath): only where no word is
  for (const [p0, p1] of ps) {
    if (p1 - p0 <= L.pause_max) continue;
    const inside = speech.filter(w => w.end > p0 + 0.05 && w.t < p1 - 0.05);
    if (inside.length) continue;
    out.push({ a: p0 + airOut, b: p1 - airIn, reason: 'pause_trim', rule: 'law.pause_trim' });
  }
  // heard pauses (the cleaned voice under the silence line) over quiet_max, where no word is: a breath of air kept
  for (const [p0, p1] of quiet) {
    if (p1 - p0 <= L.quiet_max) continue;
    if (speech.some(w => w.end > p0 + 0.02 && w.t < p1 - 0.02)) continue;
    out.push({ a: p0 + airOut, b: p1 - airIn, reason: 'pause_trim', rule: 'law.quiet_trim' });
  }
  // fillers, with the air around them down to a breath
  ws.forEach((w, i) => {
    if (!isFill(w)) return;
    const prev = ws.slice(0, i).reverse().find(x => !isFill(x)), next = ws.slice(i + 1).find(x => !isFill(x));
    const a = prev ? Math.max(prev.end + Math.min(airOut, Math.max(0, w.t - prev.end)), Math.min(w.t, prev.end + airOut)) : w.t;
    const b = next ? Math.min(next.t - Math.min(airIn, Math.max(0, next.t - w.end)), Math.max(w.end, next.t - airIn)) : w.end;
    out.push({ a: Math.min(a, w.t), b: Math.max(b, w.end), reason: 'filler', text: w.word, rule: 'law.filler' });
  });
  // retakes (edit/takes.ts): the take said again better is cut whole, with the air around it down to a breath (to the
  // take's edge when nothing is kept before or after it)
  const inRetake = (w: Word) => retakes.some(r => w.t >= r.a - 0.01 && w.end <= r.b + 0.01);
  for (const r of retakes) {
    const prev = [...speech].reverse().find(w => w.end <= r.a + 0.01 && !inRetake(w)), next = speech.find(w => w.t >= r.b - 0.01 && !inRetake(w));
    out.push({ a: prev ? Math.min(r.a, prev.end + airOut) : -Infinity, b: next ? Math.max(r.b, next.t - airIn) : Infinity, reason: 'retake', ...(r.text ? { text: r.text } : {}), rule: 'law.retake' });
  }
  // clip to the take, merge overlaps (a merged hole keeps the strongest reason: retake over filler over pause)
  const rank = (x: EdlRemoved['reason']) => x === 'retake' ? 2 : x === 'filler' ? 1 : 0;
  const xs = out.map(h => ({ ...h, a: Math.max(h.a, take.a), b: Math.min(h.b, take.b) })).filter(h => h.b - h.a > 0.04).sort((x, y) => x.a - y.a);
  const merged: typeof out = [];
  for (const h of xs) {
    const last = merged.at(-1);
    if (last && h.a <= last.b + 0.02) {
      last.b = Math.max(last.b, h.b);
      if (rank(h.reason) > rank(last.reason)) { last.reason = h.reason; last.rule = h.rule; last.text = h.text; }
      else if (h.reason === 'filler' && last.reason === 'filler') last.text = [last.text, h.text].filter(Boolean).join(' ');
    } else merged.push({ ...h });
  }
  return merged;
}

/** Move cut edges out of kept words: a hole never starts or ends inside a spoken word. */
export function snapHoles(holes: { a: number; b: number }[], kept: Word[]): void {
  for (const h of holes) {
    for (const w of kept) {
      if (h.a > w.t + 1e-3 && h.a < w.end - 1e-3) h.a = w.end;
      if (h.b > w.t + 1e-3 && h.b < w.end - 1e-3) h.b = w.t;
    }
  }
}

/**
 * Keep air around every kept word (Vignesh, Oct 18: "cut off voice"): a hole may not come within `padIn` s of a kept
 * word's start or `padOut` s of its end. A hole after a word starts at end + padOut at the earliest, one before a word
 * ends at start - padIn at the latest; a hole squeezed to nothing is left for the caller to drop. Word timings run
 * tens of ms off the real sound (a soft onset before the start, a tail after the end), and a cut exactly on the edge
 * chopped them. Runs after snapHoles, so no edge is inside a word. Mutates `holes`.
 */
export function padHoles(holes: { a: number; b: number }[], kept: Word[], padIn = DEFAULT_LAWS.pad_in, padOut = DEFAULT_LAWS.pad_out): void {
  for (const h of holes) {
    for (const w of kept) {
      const lo = w.t - padIn, hi = w.end + padOut;
      if (h.b <= lo + 1e-6 || h.a >= hi - 1e-6) continue;
      if ((h.a + h.b) / 2 >= (w.t + w.end) / 2) h.a = Math.max(h.a, hi); else h.b = Math.min(h.b, lo);
    }
  }
}

/**
 * A word's span widened to the sound around it: the recogniser often starts a word late and ends it early (Ishaan's
 * clip, Oct 18: "Hello" heard from 1.16 s, its sound from 1.00 s, so the take opened on a chopped "H"). Where a pause
 * (the loudness or the heard silence) ends at most `reach` s before the word's start, the sound starts there; where
 * one starts at most `reach` s after the word's end, the sound ends there. Pure.
 */
export function soundGuard(w: Word, pauses: [number, number][], reach = 0.35): Word {
  let t = w.t, end = w.end;
  const ends = pauses.map(p => p[1]).filter(p1 => p1 <= w.t + 1e-3 && p1 >= w.t - reach);
  if (ends.length) t = Math.min(t, Math.max(...ends));
  const starts = pauses.map(p => p[0]).filter(p0 => p0 >= w.end - 1e-3 && p0 <= w.end + reach);
  if (starts.length) end = Math.max(end, Math.min(...starts));
  return t === w.t && end === w.end ? w : { ...w, t, end };
}

/** Kept words that a set of kept source ranges clips: any part of the word, padded by `padIn` before and `padOut` after, falls outside every range (the check the tests and the e2e run). Pure. */
export function clippedWords(kept: Word[], ranges: { a: number; b: number }[], padIn = 0, padOut = 0): Word[] {
  const rs = [...ranges].sort((x, y) => x.a - y.a), merged: { a: number; b: number }[] = [];
  for (const r of rs) { const l = merged.at(-1); if (l && r.a <= l.b + 1e-3) l.b = Math.max(l.b, r.b); else merged.push({ ...r }); }
  return kept.filter(w => !merged.some(r => r.a <= w.t - padIn + 1e-3 && r.b >= w.end + padOut - 1e-3));
}

/**
 * Where the face sits in the OUTPUT frame once the player has cropped on it (the same sums as Claude 1's
 * EDIT.cropAt: object-fit cover, object-position on the face centre, the face a little above the middle), so a
 * punch-in scales around the face and not around the frame centre.
 */
export function faceCentre(f: Face | undefined, src: Edl['source'], out: Edl['output']): { cx: number; cy: number } {
  if (!f) return { cx: 0.5, cy: 0.42 };
  const clamp = (x: number) => Math.min(1, Math.max(0, x));
  const sa = src.w / src.h, oa = out.w / out.h, vw = sa > oa ? oa / sa : 1, vh = sa > oa ? 1 : sa / oa;
  const fx = f.x + f.w / 2, fy = f.y + f.h / 2;
  const off = (centre: number, visible: number) => visible >= 1 ? 0 : (1 - visible) * clamp((centre - visible / 2) / (1 - visible));
  const cx = (fx - off(fx, vw)) / vw, cy = (fy - off(fy + 0.08, vh)) / vh;
  return { cx: Math.min(0.85, Math.max(0.15, cx)), cy: Math.min(0.75, Math.max(0.15, cy)) };
}

export function buildEdl(i: BuildInput): Edl {
  const L: Laws = { ...DEFAULT_LAWS, ...(i.laws ?? {}) }, src = i.source, dur = src.duration;
  const out = i.style?.output ?? { w: 1080, h: 1920, fps: 30, aspect: '9:16' };
  const qs = (i.quiet ?? []).filter(([a, b]) => b > a);
  const pre = spreadZeroWords(i.words).filter(w => w.end > w.t && w.t < dur && w.word.trim()).map(w => ({ ...w, end: Math.min(w.end, dur) }));
  const fitted = fitWords(pre, qs, L.quiet_max);
  // the air guard (padHoles) trusts a fitted edge only so far: a word the heard quiet trimmed keeps up to 0.1 s of its
  // heard span back (a soft tail or onset sits under the silence line), never more than the hearing gave it
  const loud = [...(i.pauses ?? []), ...qs].filter(([a, b]) => b > a);
  const guardOf = new Map(fitted.map((w, k) => [w, soundGuard({ ...w, t: Math.max(Math.min(pre[k]!.t, w.t), w.t - 0.1), end: Math.min(Math.max(pre[k]!.end, w.end), w.end + 0.1) }, loud)] as const));
  const ws = [...fitted].sort((a, b) => a.t - b.t);
  const ps = (i.pauses ?? []).filter(([a, b]) => b > a);
  const removed: EdlRemoved[] = [];

  // 1. the take
  const take = ws.length ? takeWindow(ws, ps, dur) : { a: 0, b: dur, why: 'no words' };
  // a take that opens on "and" / "so" starts on the next word
  const first = ws.filter(w => w.t >= take.a - 0.01 && !FILLERS.has(bare(w.word)));
  let openerCut: Word | null = null;
  if (first.length > 3 && OPENERS.has(bare(first[0]!.word)) && first[1]!.t - first[0]!.t < 0.8) { openerCut = first[0]!; take.a = Math.max(take.a, first[1]!.t - Math.max(L.pause_keep / 2, L.pad_in)); }
  // the take opens a breath before its first word (R4's pause trim at the head too)
  if (first[0] && !openerCut) {
    // pad_in of air before the first word's real onset, never reaching back into the set-up talk before it
    const prevEnd = ws.filter(w => w.end <= first[0]!.t + 1e-3 && w !== first[0]).at(-1)?.end;
    take.a = Math.max(prevEnd !== undefined ? prevEnd + 0.05 : 0, (guardOf.get(first[0])?.t ?? first[0].t) - Math.max(L.pause_keep / 2, L.pad_in));
  }
  // and never closes on a word's tail
  const lastKept = ws.filter(w => w.t < take.b && !FILLERS.has(bare(w.word))).at(-1);
  if (lastKept && lastKept.end - lastKept.t <= 1.2) take.b = Math.min(dur, Math.max(take.b, lastKept.end + L.pad_out));
  const preEnd = openerCut ? Math.max(0, openerCut.t - L.pause_keep / 2) : take.a;
  if (preEnd > 0.02) {
    const slate = /slate/.test(take.why) || ws.some(w => w.end <= preEnd && CUES.has(bare(w.word)));
    const text = ws.filter(w => w.t < preEnd).map(w => w.word).join(' ');
    removed.push({ src_in: 0, src_out: r4(preEnd), reason: slate ? 'slate' : 'pre_roll', ...(text ? { text } : {}), rule_id: 'law.take_window' });
  }
  if (openerCut && take.a > preEnd + 0.02) removed.push({ src_in: r4(preEnd), src_out: r4(take.a), reason: 'filler', text: openerCut.word, rule_id: 'law.take_opener' });

  // 2 + 3. holes, snapped out of words
  const retakes = (i.retakes ?? []).filter(r => r.b > r.a);
  const keptWords = ws.filter(w => w.t >= take.a - 0.01 && w.end <= take.b + 0.01 && !FILLERS.has(bare(w.word)) && !retakes.some(r => w.t >= r.a - 0.01 && w.end <= r.b + 0.01));
  // no words heard (b-roll, music, ambience, a sign-language clip): there is no talk to tighten, so its quiet is not a
  // pause to cut. A real 8 s clip with a tone that the clean-up voice pass read as quiet after 3.8 s came out 3.89 s.
  const holes = ws.length ? holesOf(ws, ps, take, L, qs, retakes) : [];
  snapHoles(holes, keptWords);
  padHoles(holes, keptWords.map(w => guardOf.get(w) ?? w), L.pad_in, L.pad_out);
  const segs: { a: number; b: number }[] = []; let cur = take.a;
  for (const h of holes) { if (h.b - h.a <= 0.04) continue; if (h.a > cur) segs.push({ a: cur, b: h.a }); cur = Math.max(cur, h.b); }
  if (take.b > cur) segs.push({ a: cur, b: take.b });
  // a sliver of a piece (under 0.12 s) is cut too, unless it carries a word
  const pieces = segs.filter(s => s.b - s.a >= 0.12 || keptWords.some(w => w.t < s.b && w.end > s.a));
  // removed[]: every gap between pieces (in the take), named by the hole that made it
  for (let k = 0; k + 1 < pieces.length; k++) {
    const a = pieces[k]!.b, b = pieces[k + 1]!.a, h = holes.find(x => x.a < b && x.b > a);
    removed.push({ src_in: r4(a), src_out: r4(b), reason: h?.reason ?? 'silence', ...(h?.text ? { text: h.text } : {}), rule_id: h?.rule ?? 'law.sliver' });
  }
  // a retake at the very start or end of the take is cut before the first piece (after the last) too
  for (const [a, b] of [[take.a, pieces[0]?.a ?? take.a], [pieces.at(-1)?.b ?? take.b, take.b]] as const) {
    const h = holes.find(x => x.reason === 'retake' && x.a < b && x.b > a);
    if (b - a > 0.02 && h) removed.push({ src_in: r4(a), src_out: r4(b), reason: 'retake', ...(h.text ? { text: h.text } : {}), rule_id: h.rule });
  }
  if (take.b < dur - 0.02) removed.push({ src_in: r4(take.b), src_out: r4(dur), reason: 'tail', rule_id: 'law.take_window' });

  // 4. shots: each piece, split at sentence starts and before hold_max, on word gaps
  const sent = sentences(ws), sentOf = new Map(ws.map((w, k) => [w, sent[k]!]));
  const shots: EdlShot[] = [], cuts: EdlCut[] = [], why: string[] = [];
  let t = 0, n = 0;
  const faces = [...(i.faces ?? [])].sort((a, b) => a.src_t - b.src_t);
  const wide = src.w / src.h > 1.6 * (out.w / out.h);
  const faceAt = (s: number) => faces.length ? faces.reduce((b, f) => Math.abs(f.src_t - s) < Math.abs(b.src_t - s) ? f : b) : undefined;
  pieces.forEach((p, pk) => {
    const inWords = keptWords.filter(w => w.t >= p.a - 0.01 && w.end <= p.b + 0.01);
    // candidate split points: the gap before each word that starts a sentence
    const edges: { s: number; trig: EdlCut['trigger'] }[] = [];
    for (let k = 1; k < inWords.length; k++) if (sentOf.get(inWords[k]!) !== sentOf.get(inWords[k - 1]!)) {
      const s = (inWords[k - 1]!.end + inWords[k]!.t) / 2;
      if (s - p.a >= L.min_shot && p.b - s >= L.min_shot) edges.push({ s, trig: 'sentence' });
    }
    // hold_max: split any run longer than hold_max at the word gap nearest its middle (an even split where no gap fits),
    // until every run fits
    const gapsIn = inWords.slice(1).map((w, j) => (inWords[j]!.end + w.t) / 2);
    for (let guard = 0; guard < 64; guard++) {
      const b0 = [p.a, ...edges.map(e => e.s).sort((x, y) => x - y), p.b];
      const k = b0.findIndex((x, j) => j + 1 < b0.length && b0[j + 1]! - x > L.hold_max + 1e-6);
      if (k < 0) break;
      const a = b0[k]!, b = b0[k + 1]!, mid = (a + b) / 2, room = Math.min(L.min_shot, (b - a) / 3);
      const ok = gapsIn.filter(g => g > a + room && g < b - room);
      edges.push({ s: ok.length ? ok.reduce((x, y) => Math.abs(y - mid) < Math.abs(x - mid) ? y : x) : mid, trig: 'hold_max' });
    }
    edges.sort((x, y) => x.s - y.s);
    const cutsIn = [p.a, ...edges.map(e => e.s), p.b];
    for (let k = 0; k + 1 < cutsIn.length; k++) {
      const a = cutsIn[k]!, b = cutsIn[k + 1]!, d = b - a;
      const punch = n % 2 === 1, face = faceAt((a + b) / 2), f = faceCentre(face, src, out);
      const shot: EdlShot & { rule_id?: string } = { t_in: r4(t), t_out: r4(t + d), src_in: r4(a), src_out: r4(b) };
      let scale: number, cx = r4(f.cx), cy = r4(f.cy);
      if (wide && !faces.length) {
        // a landscape clip with no face found, in a vertical film: shown whole over its own blurred fill (2cf18a6)
        Object.assign(shot, { layout: 'fit', bg: { mode: 'blur' } });
        scale = punch ? L.punch : 1; cx = 0.5; cy = 0.5;
      } else {
        // with a face, a landscape clip is cropped full-frame on the face like a vertical one (edit mastery round 2:
        // the blurred fill strip read as "a tiny subject in mush" on every look; the references never show it)
        shot.layout = 'full';
        scale = punch ? L.punch : 1;
      }
      shot.framing = { scale, cx, cy };
      if (d >= 1.6) (shot as { zoom?: unknown }).zoom = [{ t: r4(t), scale: r4(scale * L.push), cx, cy, ease: 'inout', dur: r4(d), rule_id: 'law.slow_push' }];
      const trig: EdlCut['trigger'] | null = k > 0 ? edges[k - 1]!.trig : pk > 0 ? (removed.find(r => Math.abs(r.src_out - a) < 1e-3)?.reason === 'filler' ? 'filler' : 'pause') : null;
      shot.rule_id = trig === null ? 'law.take_start' : trig === 'sentence' ? 'law.sentence_new_framing' : trig === 'hold_max' ? 'law.hold_max' : trig === 'filler' ? 'law.filler' : 'law.pause_trim';
      if (trig) cuts.push({ t: r4(t), type: k > 0 ? 'punch' : 'jump', trigger: trig, rule_id: shot.rule_id });
      shots.push(shot); why.push(shot.rule_id); t += d; n++;
    }
  });
  for (let k = 1; k < shots.length; k++) shots[k]!.t_in = shots[k - 1]!.t_out;
  if (!shots.length) shots.push({ t_in: 0, t_out: r4(dur), src_in: 0, src_out: r4(dur), ...(wide ? { layout: 'fit' as const, bg: { mode: 'blur' as const } } : { layout: 'full' as const }), framing: { scale: 1, cx: 0.5, cy: 0.42 } });

  // 5. words, roles, beats
  const keys = new Set(keywordsOf(keptWords));
  const words: (EdlWord & { conf?: number })[] = ws.map((w, k) => {
    const b = bare(w.word);
    const role: EdlWord['role'] = /\d/.test(b) ? 'number' : keys.has(b) ? (/^[A-Z]/.test(w.word) && k > 0 && !isStop(ws[k - 1]!.word) ? 'title' : 'key') : 'connector';
    return { src_t0: r4(w.t), src_t1: r4(w.end), text: w.word, role, line_id: sent[k]!, ...(w.p !== undefined ? { conf: Math.max(0, Math.min(1, w.p)) } : {}) };
  });
  const tmp: Edl = { version: EDL_VERSION, style_id: i.style?.id ?? 'base', source: src, output: out, palette: i.palette, caption_style_id: i.style?.caption ?? 'punch-duo', words, shots };
  // the captionseasy look: picked per style (or asked for), validated for the words as shown; the player draws its
  // nearest style unless a caption style was asked for
  let look: CaptionLook | null = null;
  try { look = pickLook(EDIT.outWords(tmp), { style: i.style?.id, ...(i.style?.look !== undefined ? { look: i.style.look } : {}), ...(i.language ? { language: i.language } : {}) }); } catch { look = null; }
  if (look && !i.style?.caption) tmp.caption_style_id = look.player_style;
  const beats: EdlBeat[] = [];
  const outOf = (s: number) => { for (const g of shots) if (s >= g.src_in - 1e-6 && s <= g.src_out + 1e-6) return g.t_in + (s - g.src_in); return null; };
  const ids = [...new Set(sent)];
  let k = 0;
  ids.forEach(id => {
    const idx = ws.map((w, j) => sent[j] === id && keptWords.includes(w) ? j : -1).filter(j => j >= 0);
    if (!idx.length) return;
    const t0 = outOf(ws[idx[0]!]!.t), t1 = outOf(ws[idx.at(-1)!]!.end);
    if (t0 === null || t1 === null) return;
    const text = idx.map(j => bare(ws[j]!.word));
    const last = id === ids.at(-1);
    const tag: EdlBeat['tag'] = i.tags?.[id] ?? (k === 0 ? 'hook' : text.some(x => /\d/.test(x)) ? 'number' : last && text.some(x => CTA.test(x)) ? 'cta' : 'claim');
    k++;
    beats.push({ t0: r4(t0), t1: r4(Math.max(t0, t1)), word_idx: idx, tag });
  });

  const edl: Edl = {
    ...tmp, style_id: i.style?.id ?? 'base', ...(i.style?.variant ? { style_variant: i.style.variant } : {}), seed: i.seed ?? 0, rules_version: RULES_VERSION,
    laws: { pause_max: L.pause_max, pause_keep: L.pause_keep, hold_max: L.hold_max, snap_ms: L.snap_ms },
    removed: removed.sort((a, b) => a.src_in - b.src_in), cuts, beats, inserts: [],
    voice: { clean: 'arnndn', target_lufs: -14, true_peak: -1 },
    ...(faces.length ? { faces } : {}),
    ...(look ? { caption_look: look } : {}),
  };
  // a cut sits pad_out after a word's end (or pad_in before its start) on purpose, so on-word means within that air plus 20 ms
  edl.metrics = metricsOf(edl, onWordMs(L));
  return edl;
}
