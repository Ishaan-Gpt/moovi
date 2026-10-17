import { FX, FX_IDS, holdsSlot, isFx, type FxId } from './catalog';

/** One effect on the timeline, in output seconds. */
export interface FxEvent { fx: FxId; t0: number; t1: number; params?: Record<string, unknown> }
export interface FxWord { word: string; t: number; end: number }
export interface FxProblem { rule: 'unknown' | 'length' | 'one-overlay' | 'max-per-type' | 'back-to-back'; at: number; detail: string }

/** The house rules every effects film keeps (the same as clip-moment's calm rules). */
export const FX_RULES = {
  /** at most this many of one effect type in a film */
  maxPerType: 2,
  /** seconds of plain picture wanted between two overlays (a soft target, fitFx keeps at least `minGap`) */
  breathe: 0.5,
  minGap: 0.12,
} as const;

const r3 = (x: number) => Math.round(x * 1000) / 1000;
const byStart = (a: FxEvent, b: FxEvent) => a.t0 - b.t0 || a.t1 - b.t1;

/**
 * The rules, read back: every id known, every length inside its effect's range, never two overlays up at once (an
 * overlay = any `kind: overlay` effect or a camera effect that frames the picture), no type more than `maxPerType`
 * times, and the same type never twice in a row.
 */
export function checkFx(events: FxEvent[], maxPerType: number = FX_RULES.maxPerType): FxProblem[] {
  const out: FxProblem[] = [];
  const ev = [...events].sort(byStart);
  const count = new Map<string, number>();
  let prevSlot: FxEvent | null = null, prev: FxEvent | null = null;
  for (const e of ev) {
    if (!isFx(e.fx)) { out.push({ rule: 'unknown', at: e.t0, detail: `unknown effect ${e.fx}` }); continue; }
    const s = FX[e.fx], d = e.t1 - e.t0;
    if (!(d > 0) || d < s.min - 0.05 || d > s.max + 0.05) out.push({ rule: 'length', at: e.t0, detail: `${e.fx} holds ${r3(d)} s (${s.min} to ${s.max})` });
    const n = (count.get(e.fx) ?? 0) + 1; count.set(e.fx, n);
    if (n > maxPerType) out.push({ rule: 'max-per-type', at: e.t0, detail: `${e.fx} used ${n} times (max ${maxPerType})` });
    if (prev && prev.fx === e.fx) out.push({ rule: 'back-to-back', at: e.t0, detail: `${e.fx} twice in a row` });
    if (holdsSlot(e.fx)) {
      if (prevSlot && e.t0 < prevSlot.t1 - 0.02) out.push({ rule: 'one-overlay', at: e.t0, detail: `${e.fx} starts while ${prevSlot.fx} is still up` });
      if (!prevSlot || e.t1 > prevSlot.t1) prevSlot = e;
    }
    prev = e;
  }
  return out;
}

/**
 * Make a timeline keep the rules, changing as little as it can: lengths clamped to each effect's range, a type past
 * its cap or repeating the one before it dropped, and an overlay that starts while another is up either moved to
 * just after it (when it still fits before the next one) or the earlier one cut short.
 */
export function fitFx(events: FxEvent[], maxPerType: number = FX_RULES.maxPerType): FxEvent[] {
  const ev = events.filter(e => isFx(e.fx)).map(e => {
    const s = FX[e.fx]; const d = Math.min(s.max, Math.max(s.min, e.t1 - e.t0));
    return { ...e, t0: r3(Math.max(0, e.t0)), t1: r3(Math.max(0, e.t0) + d) };
  }).sort(byStart);
  const count = new Map<string, number>(), out: FxEvent[] = [];
  for (const e of ev) {
    if ((count.get(e.fx) ?? 0) >= maxPerType) continue;
    if (out.length && out[out.length - 1]!.fx === e.fx) continue;
    if (holdsSlot(e.fx)) {
      const last = [...out].reverse().find(x => holdsSlot(x.fx));
      if (last && e.t0 < last.t1 + FX_RULES.minGap) {
        const cut = e.t0 - FX_RULES.minGap;
        if (cut - last.t0 >= FX[last.fx].min) last.t1 = r3(cut);
        else {
          const d = e.t1 - e.t0, t0 = r3(last.t1 + FX_RULES.minGap);
          if (d < FX[e.fx].min) continue;
          e.t0 = t0; e.t1 = r3(t0 + d);
        }
      }
    }
    count.set(e.fx, (count.get(e.fx) ?? 0) + 1);
    out.push(e);
  }
  return out.sort(byStart);
}

/** A cue: put effect `fx` on the spoken word `at` (the first match after the previous cue's word) or at a time. */
export interface FxCue { fx: FxId; at: string | number; hold?: number; lead?: number; params?: Record<string, unknown> }
const key = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

/** Cues on words -> a timeline that keeps the rules. A word that is never said is skipped (and reported). */
export function placeFx(words: FxWord[], cues: FxCue[], total?: number): { events: FxEvent[]; missed: string[] } {
  const raw: FxEvent[] = [], missed: string[] = [];
  let from = 0;
  for (const c of cues) {
    let t: number | null = null;
    if (typeof c.at === 'number') t = c.at;
    else {
      const want = c.at.split(/\s+/).map(key).filter(Boolean);
      for (let i = from; i < words.length && t === null; i++) {
        if (want.every((w, j) => words[i + j] && key(words[i + j]!.word) === w)) { t = words[i]!.t; from = i + 1; }
      }
    }
    if (t === null) { missed.push(`${c.fx}@${String(c.at)}`); continue; }
    const s = FX[c.fx], t0 = Math.max(0, t - (c.lead ?? 0.06));
    let t1 = t0 + (c.hold ?? (s.min + s.max) / 3);
    if (total !== undefined) t1 = Math.min(t1, total);
    raw.push({ fx: c.fx, t0, t1, ...(c.params ? { params: c.params } : {}) });
  }
  return { events: fitFx(raw), missed };
}

/** The picture's own time for output time t: a freeze holds the frame it started on (the voice carries on). */
export function sourceTime(t: number, events: FxEvent[]): number {
  for (const e of events) if (e.fx === 'freeze-label' && t >= e.t0 && t < e.t1) return e.t0;
  return t;
}

export const active = (events: FxEvent[], t: number) => events.filter(e => t >= e.t0 && t < e.t1);

/* ── captions: 2 to 4 words, one key word lit, kept off the face and off the effect that is up ── */
export interface CapChunk { words: string[]; key: number; t0: number; t1: number }
const STOP = new Set('a an the and or but so to of in on at for with is are was were be been am i im you your we our it its this that these those my me he she they them his her as by from just now then very really can will do did does have has had not no yes okay ok guys hello hey like basically'.split(' '));

/**
 * Words -> caption chunks of 2 to 4 words: a chunk closes at a pause (gap over `gap` s), at punctuation once it has
 * 2 words, or at 4 words. The key word is the one marked *like this*, else the longest word that is not a stop word.
 */
export function captionChunks(words: FxWord[], o: { min?: number; max?: number; gap?: number } = {}): CapChunk[] {
  const min = o.min ?? 2, max = o.max ?? 4, gap = o.gap ?? 0.35;
  const out: CapChunk[] = [];
  let cur: FxWord[] = [];
  const close = () => {
    if (!cur.length) return;
    const ws = cur.map(w => w.word.replace(/\*/g, ''));
    let k = cur.findIndex(w => /\*/.test(w.word));
    if (k < 0) { let best = -1; ws.forEach((w, i) => { const kw = key(w); if (!STOP.has(kw) && (best < 0 || kw.length > key(ws[best]!).length)) best = i; }); k = best >= 0 ? best : ws.length - 1; }
    out.push({ words: ws, key: k, t0: cur[0]!.t, t1: cur[cur.length - 1]!.end });
    cur = [];
  };
  for (let i = 0; i < words.length; i++) {
    const w = words[i]!, next = words[i + 1];
    cur.push(w);
    const clean = w.word.replace(/\*/g, ''), pause = next ? next.t - w.end > gap : true, punct = /[.,!?;:]$/.test(clean);
    // a sentence end always closes the chunk: a caption never runs across two sentences ("pro. First,")
    if (cur.length >= max || /[.!?]$/.test(clean) || (cur.length >= min && (pause || punct))) close();
  }
  close();
  // a lone last word joins the chunk before it when that stays within max
  // (or, when that would pass max, takes the last word of the chunk before it)
  const endsSentence = (c: CapChunk) => /[.!?]$/.test(c.words[c.words.length - 1]!);
  for (let i = out.length - 1; i > 0; i--) if (out[i]!.words.length < min) {
    const a = out[i - 1]!, b = out[i]!;
    // a one-word sentence ("Spotlight.") stands alone: it is its own beat
    if (endsSentence(a) && endsSentence(b)) continue;
    if (a.words.length + b.words.length <= max) out.splice(i - 1, 2, { words: [...a.words, ...b.words], key: a.key, t0: a.t0, t1: b.t1 });
    else if (a.words.length > min) {
      const moved = a.words.pop()!; b.words.unshift(moved); b.key += 1;
      if (a.key >= a.words.length) a.key = a.words.length - 1;
    }
  }
  // each chunk stays on screen until the next one starts (no flicker in short pauses)
  for (let i = 0; i < out.length - 1; i++) if (out[i + 1]!.t0 - out[i]!.t1 < 0.6) out[i]!.t1 = out[i + 1]!.t0;
  return out;
}

/**
 * Where the caption sits at t (centre, as a fraction of the frame height): chest height by default, moved out of the
 * face band and out of the zone of the effect that is up, staying inside the platform safe area (8% to 84%).
 */
export function captionY(t: number, events: FxEvent[], face: { y0: number; y1: number } | null, half = 0.035, base = 0.7): number {
  // a framing effect that keeps the caption (the phone) puts it in its own clear band, above the frame
  const framed = active(events, t).find(e => isFx(e.fx) && FX[e.fx].framesPicture && FX[e.fx].capAt !== undefined);
  if (framed) return FX[framed.fx].capAt!;
  const bands: [number, number][] = [];
  if (face) bands.push([face.y0, face.y1]);
  for (const e of active(events, t)) { const z = FX[e.fx].zone; if (z) bands.push(z); }
  const lo = 0.08 + half, hi = 0.84 - half;
  const clear = (y: number) => bands.every(([a, b]) => y + half < a || y - half > b);
  if (clear(base)) return base;
  const cands: number[] = [];
  for (const [a, b] of bands) cands.push(b + half + 0.015, a - half - 0.015);
  const ok = cands.filter(y => y >= lo && y <= hi && clear(y)).sort((x, y) => Math.abs(x - base) - Math.abs(y - base));
  return ok[0] ?? Math.min(hi, Math.max(lo, base));
}

/** the effects a timeline uses, in first-use order (the demo's checklist and the report) */
export const used = (events: FxEvent[]) => [...new Set([...events].sort(byStart).map(e => e.fx))];
export const allFx = () => [...FX_IDS];

/**
 * is the caption off at t: while an effect is its own text (giant word) or frames the picture with no room left for it
 * (the app window of pull-back). The phone keeps the caption, above the phone (FX capAt): every spoken word stays on screen.
 */
export function captionHidden(events: FxEvent[], t: number): boolean {
  return active(events, t).some(e => isFx(e.fx) && ((!!FX[e.fx].framesPicture && FX[e.fx].capAt === undefined) || !!FX[e.fx].ownsText));
}

/**
 * The giant word's font size (px) so the whole word fits the 1080 frame with a margin: heavy uppercase runs about
 * 0.9 em per letter, the word then grows about 6% while it holds, so it is sized for 900 px.
 */
export function giantWordSize(word: string, max = 520): number {
  // a short word ("16", "AI") still has to be wider than the head it sits behind, so it peeks out both sides
  const n = Math.max(2, [...word].length);
  return Math.max(90, Math.min(max, Math.floor(900 / (n * 0.9 * 1.06))));
}

/**
 * Numbers the library knows itself: a stat counter whose `to` is the word 'effects' counts the effects in this library
 * (FX_IDS.length), so a demo never ships a stale hand-typed count. Also fixes how long the number rolls (`roll`): it
 * lands by 45% of the hold (at most 0.9 s) and then stays up, so the final value is what a viewer, or a contact sheet,
 * actually sees.
 */
export const fxCount = () => FX_IDS.length;
export const statRoll = (dur: number) => r3(Math.min(0.9, dur * 0.45));
export function resolveFxParams(e: FxEvent): FxEvent {
  if (e.fx !== 'stat-counter') return e;
  const p = { ...(e.params ?? {}) };
  if (p.to === 'effects') p.to = fxCount();
  if (p.roll === undefined) p.roll = statRoll(e.t1 - e.t0);
  return { ...e, params: p };
}

/**
 * Where the stat counter card sits (design px, its top edge): its home spot near the top (260) unless that covers
 * the face, then under the face, then over it, staying above the caption band. The card is about 360 px tall.
 */
export function statCardTop(face: { y0: number; y1: number } | null | undefined, cardH = 360, H = 1920): number {
  const home = 260, gap = 40, floor = Math.round(H * 0.7), ceil = 150;
  if (!face || home + cardH <= face.y0 || home >= face.y1) return home;
  if (face.y1 + gap + cardH <= floor) return Math.round(face.y1 + gap);
  if (face.y0 - gap - cardH >= ceil) return Math.round(face.y0 - gap - cardH);
  return home;
}

/**
 * Phrases of speech for the music duck: words closer than `join` s are one phrase. Returned on the film clock.
 */
export function speechPhrases(words: FxWord[], join = 0.35): { t0: number; t1: number }[] {
  const out: { t0: number; t1: number }[] = [];
  for (const w of [...words].sort((a, b) => a.t - b.t)) {
    const last = out[out.length - 1];
    if (last && w.t - last.t1 <= join) last.t1 = Math.max(last.t1, w.end);
    else out.push({ t0: w.t, t1: Math.max(w.end, w.t + 0.05) });
  }
  return out.map(p => ({ t0: r3(p.t0), t1: r3(p.t1) }));
}

/**
 * The music's gain over time as an ffmpeg `volume` expression (eval=frame): full between lines and in the intro and
 * outro, down `duckDb` (a light 3 dB by default, Vignesh 2026-10-16: the bed must stay clearly audible) while someone
 * speaks, with a 0.12 s ramp down before a phrase and a 0.3 s ramp back up after it. No speech = '1'.
 */
export function duckExpr(words: FxWord[], duckDb = 3): string {
  const ph = speechPhrases(words);
  if (!ph.length || duckDb <= 0) return '1';
  const depth = r3(1 - Math.pow(10, -duckDb / 20));
  const terms = ph.map(p => `min(clip((t-${r3(p.t0 - 0.12)})/0.12,0,1),clip((${r3(p.t1 + 0.3)}-t)/0.3,0,1))`);
  return `1-${depth}*clip(${terms.join('+')},0,1)`;
}
