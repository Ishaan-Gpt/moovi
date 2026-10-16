import { EDL_VERSION, metricsOf, type Edl, type EdlBeat, type EdlCut, type EdlRemoved } from './edl';
import { bare, CUES, FILLERS, OPENERS, keywordsOf, takeWindow, type Word } from './cut';
import type { EdlShot, EdlWord, Palette } from './lib';

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
export interface Laws { pause_max: number; pause_keep: number; hold_max: number; snap_ms: number; punch: number; push: number; min_shot: number }
export const DEFAULT_LAWS: Laws = { pause_max: 0.4, pause_keep: 0.18, hold_max: 2.6, snap_ms: 100, punch: 1.12, push: 1.04, min_shot: 0.6 };
export const RULES_VERSION = 'r4-2026-10-16';

export interface Face { src_t: number; x: number; y: number; w: number; h: number; conf?: number }
export interface BuildInput {
  source: Edl['source'];
  /** timed words in source seconds, the final transcript (hear's output) */
  words: Word[];
  /** loudness pauses in source seconds (cut.ts `pauses`), relative to the clip's own noise floor; may be empty */
  pauses?: [number, number][];
  faces?: Face[];
  /** beat tags from the one model call, by sentence index; missing sentences are tagged by rule */
  tags?: Record<number, EdlBeat['tag']>;
  style?: { id?: string; variant?: string; caption?: string; output?: Edl['output'] };
  palette: Palette;
  laws?: Partial<Laws>;
  seed?: number;
}

const r4 = (x: number) => Math.round(x * 10000) / 10000;
const isStop = (w: string) => /[.!?]["')\]]*$/.test(w);
const CTA = /^(comment|follow|subscribe|link|bio|try|download|sign|join|dm|share|save)$/;

/** Sentence index per word (a word ending in . ! or ? closes its sentence). */
export function sentences(ws: Word[]): number[] {
  let k = 0; return ws.map(w => { const id = k; if (isStop(w.word)) k++; return id; });
}

/** Holes to cut, in source seconds, each with its reason; merged and sorted. */
export function holesOf(ws: Word[], ps: [number, number][], take: { a: number; b: number }, L: Laws): { a: number; b: number; reason: EdlRemoved['reason']; text?: string; rule: string }[] {
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
  // fillers, with the air around them down to a breath
  ws.forEach((w, i) => {
    if (!isFill(w)) return;
    const prev = ws.slice(0, i).reverse().find(x => !isFill(x)), next = ws.slice(i + 1).find(x => !isFill(x));
    const a = prev ? Math.max(prev.end + Math.min(airOut, Math.max(0, w.t - prev.end)), Math.min(w.t, prev.end + airOut)) : w.t;
    const b = next ? Math.min(next.t - Math.min(airIn, Math.max(0, next.t - w.end)), Math.max(w.end, next.t - airIn)) : w.end;
    out.push({ a: Math.min(a, w.t), b: Math.max(b, w.end), reason: 'filler', text: w.word, rule: 'law.filler' });
  });
  // clip to the take, merge overlaps (a merged hole keeps the strongest reason: filler over pause)
  const xs = out.map(h => ({ ...h, a: Math.max(h.a, take.a), b: Math.min(h.b, take.b) })).filter(h => h.b - h.a > 0.04).sort((x, y) => x.a - y.a);
  const merged: typeof out = [];
  for (const h of xs) {
    const last = merged.at(-1);
    if (last && h.a <= last.b + 0.02) {
      last.b = Math.max(last.b, h.b);
      if (h.reason === 'filler') { last.reason = 'filler'; last.rule = 'law.filler'; last.text = [last.text, h.text].filter(Boolean).join(' '); }
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
  const ws = i.words.filter(w => w.end > w.t && w.t < dur && w.word.trim()).map(w => ({ ...w, end: Math.min(w.end, dur) })).sort((a, b) => a.t - b.t);
  const ps = (i.pauses ?? []).filter(([a, b]) => b > a);
  const removed: EdlRemoved[] = [];

  // 1. the take
  const take = ws.length ? takeWindow(ws, ps, dur) : { a: 0, b: dur, why: 'no words' };
  // a take that opens on "and" / "so" starts on the next word
  const first = ws.filter(w => w.t >= take.a - 0.01 && !FILLERS.has(bare(w.word)));
  let openerCut: Word | null = null;
  if (first.length > 3 && OPENERS.has(bare(first[0]!.word)) && first[1]!.t - first[0]!.t < 0.8) { openerCut = first[0]!; take.a = Math.max(take.a, first[1]!.t - L.pause_keep / 2); }
  // the take opens a breath before its first word (R4's pause trim at the head too)
  if (first[0] && !openerCut) take.a = Math.max(take.a, first[0].t - L.pause_keep / 2);
  const preEnd = openerCut ? Math.max(0, openerCut.t - L.pause_keep / 2) : take.a;
  if (preEnd > 0.02) {
    const slate = /slate/.test(take.why) || ws.some(w => w.end <= preEnd && CUES.has(bare(w.word)));
    const text = ws.filter(w => w.t < preEnd).map(w => w.word).join(' ');
    removed.push({ src_in: 0, src_out: r4(preEnd), reason: slate ? 'slate' : 'pre_roll', ...(text ? { text } : {}), rule_id: 'law.take_window' });
  }
  if (openerCut && take.a > preEnd + 0.02) removed.push({ src_in: r4(preEnd), src_out: r4(take.a), reason: 'filler', text: openerCut.word, rule_id: 'law.take_opener' });

  // 2 + 3. holes, snapped out of words
  const keptWords = ws.filter(w => w.t >= take.a - 0.01 && w.end <= take.b + 0.01 && !FILLERS.has(bare(w.word)));
  const holes = holesOf(ws, ps, take, L);
  snapHoles(holes, keptWords);
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
      if (wide && !(punch && face)) {
        // a landscape clip in a vertical film: shown whole over its own blurred fill (2cf18a6); with a face, every
        // other shot is the close-up the face crop gives, so wide and close alternate
        Object.assign(shot, { layout: 'fit', bg: { mode: 'blur' } });
        scale = punch ? L.punch : 1; cx = 0.5; cy = 0.5;
      } else {
        shot.layout = 'full';
        scale = punch && !wide ? L.punch : 1;
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
  };
  edl.metrics = metricsOf(edl, L.snap_ms);
  return edl;
}
