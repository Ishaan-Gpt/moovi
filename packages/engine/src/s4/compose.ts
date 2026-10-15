/**
 * Style 4 composition: word timings → beats (one sentence, one picture; long sentences split at a comma so no beat
 * runs past ~4 s) → each beat's CAST set-up (./library.ts) with its pictures, the film's earlier pictures (echo), its
 * lockups (clause 1 / clause 2; KEY / small / concept registers), its spoken list items, number and key word → the
 * film the player plays, plus the Style 1 SFX events (typing under every word, a cut whoosh, a landing sound, a chime
 * on numbers, a snap on the coined term, a tear / thud / paper pop where the set-up's devices land).
 */
import type { Spec } from '../styles/kit';
import { listItems, spokenNumber } from '../styles/kit';
import type { PicLabel, Picture } from './picture';
import type { World } from './world';
import { keysFor, type Enter } from './library';

export interface Word { word: string; t: number; end: number }
export interface Piece { text: string; words: Word[] }
export type Reg = 'key' | 'small' | 'concept';
export interface Tok { text: string; reg: Reg; t: number; end: number }
export interface PicRef { full: string; parts: { png: string; move: string }[]; label?: PicLabel | null; /** the drawing's content box [x0, y0, x1, y1] as fractions (objects stand on floors by it) */ bb?: [number, number, number, number] }
export interface Beat {
  /** the cast set-up (a renderer of that id in the player; grown / improvised beats carry `spec`) */
  setup: string; family: string; why: string; spec?: Spec;
  hero?: boolean; t0: number; t1: number; enter: Enter; from: number; orbit: boolean; scan: boolean;
  /** this line's pictures (0-2) and the film's earlier pictures, newest first */
  pics: PicRef[]; echo: PicRef[];
  locks: { pos: 'top' | 'bottom'; toks: Tok[] }[]; toks: Tok[];
  items: { text: string; t: number }[]; num: { text: string; value: number; t: number } | null; key: { text: string; t: number } | null;
  /** when clause 2 starts (pairs bring their second picture here) */
  half: number; coined: string;
}
export interface Film { id: string; world: World; duration: number; beats: Beat[]; audio: string; arc?: string }
export interface Cast { setup: string; family: string; why: string; pics: Picture[]; spec?: Spec; enter: Enter }

const norm = (w: string) => w.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Sentences from the word timings; a sentence longer than `max` s splits at its comma nearest the middle. */
export function pieces(words: Word[], max = 4): Piece[] {
  const out: Word[][] = []; let cur: Word[] = [];
  for (const w of words) { cur.push(w); if (/[.!?]["')]?$/.test(w.word)) { out.push(cur); cur = []; } }
  if (cur.length) out.push(cur);
  const split = (ws: Word[]): Word[][] => {
    if (ws.length < 4 || ws.at(-1)!.end - ws[0]!.t <= max) return [ws];
    const mid = (ws[0]!.t + ws.at(-1)!.end) / 2;
    let best = -1, bd = 1e9;
    ws.forEach((w, i) => { if (i >= 1 && i < ws.length - 2 && /[,;:]$/.test(w.word) && Math.abs(w.end - mid) < bd) { bd = Math.abs(w.end - mid); best = i; } });
    if (best < 0) { // no comma: split at the word boundary nearest the middle
      ws.forEach((w, i) => { if (i >= 1 && i < ws.length - 2 && Math.abs(w.end - mid) < bd) { bd = Math.abs(w.end - mid); best = i; } });
    }
    return [...split(ws.slice(0, best + 1)), ...split(ws.slice(best + 1))];
  };
  return out.flatMap(split).map(ws => ({ words: ws, text: ws.map(w => w.word).join(' ') }));
}

/** Registers for a piece's words from the picture call's key list and the coined term. */
function tokens(p: Piece, keys: string[], coined: string): Tok[] {
  const keyset = new Set(keys.flatMap(k => k.split(/[\s-]+/)).map(norm).filter(Boolean));
  const cset = new Set(coined.split(/\s+/).map(norm).filter(Boolean));
  return p.words.map(w => {
    const n = norm(w.word);
    const reg: Reg = cset.size && cset.has(n) ? 'concept' : /\d/.test(w.word) || (keyset.has(n) && n.length > 1) ? 'key' : 'small';
    return { text: w.word, reg, t: w.t, end: w.end };
  });
}

/** Clause 1 top, clause 2 bottom: split at the comma nearest the middle, else the middle word (short lines stay one lockup). */
function locks(toks: Tok[]): Beat['locks'] {
  if (toks.length <= 5) return [{ pos: 'top', toks }];
  let best = Math.floor(toks.length / 2) - 1, bd = 1e9;
  toks.forEach((t, i) => { if (i >= 1 && i < toks.length - 2 && /[,;:]$/.test(t.text) && Math.abs(i - toks.length / 2) < bd) { bd = Math.abs(i - toks.length / 2); best = i; } });
  return [{ pos: 'top', toks: toks.slice(0, best + 1) }, { pos: 'bottom', toks: toks.slice(best + 1) }];
}

const clean = (w: string) => w.replace(/[^\p{L}\p{N}'%$€£₹.-]/gu, '').replace(/[.]$/, '');

export function compose(o: { id: string; world: World; words: Word[]; pieces: Piece[]; cast: Cast[]; coined: string; duration: number; audio: string; picUrl: (f: string) => string; arc?: string }): { film: Film; events: Record<string, unknown>[] } {
  let orbits = 0, lastScan = -9, lastOrbit = -9;
  const ref = (pic: Picture): PicRef => ({ full: o.picUrl(pic.full), parts: pic.parts.map(x => ({ png: o.picUrl(x.png), move: x.move })), label: pic.labelAt ?? null, bb: pic.stats?.bbox?.length === 4 && pic.stats.bbox[3] > 0 ? pic.stats.bbox : undefined });
  const shown: PicRef[] = [];
  const beats: Beat[] = o.pieces.map((p, i) => {
    const c = o.cast[i]!, pics = c.pics, pic = pics[0];
    const t0 = i === 0 ? 0 : Math.max(0, p.words[0]!.t - 0.06), t1 = i === o.pieces.length - 1 ? o.duration : Math.max(0, o.pieces[i + 1]!.words[0]!.t - 0.06);
    const hero = !!o.coined && p.text.toLowerCase().includes(o.coined.toLowerCase());
    const wantOrbit = c.setup === 'orbit' || c.setup === 'coined-hero' || (c.setup === 'hero-stack' && (!!pic?.orbit || hero));
    const orbit = wantOrbit && orbits < 5 && i - lastOrbit >= 2 && (orbits++, lastOrbit = i, true);
    const scan = !!pic?.antagonist && i - lastScan >= 3 && (lastScan = i, true);
    const specKeys = (c.spec?.elements ?? []).filter(e => e.kind === 'word' || e.kind === 'line').map(e => e.text ?? '');
    const keys = [...(pic?.keys?.length ? pic.keys : keysFor(p.text)), ...specKeys];
    const toks = tokens(p, keys, o.coined);
    const lw = p.words.map(w => norm(w.word));
    const items = listItems(p.text).map(it => { const f = norm(it.split(/\s+/)[0] ?? ''); const k = lw.indexOf(f); return { text: it, t: p.words[Math.max(0, k)]!.t }; });
    const nv = spokenNumber(p.text), nw = p.words.find(w => /\d/.test(w.word));
    // the beat's key word (stamps, tags, cover words land on it): the coined term, else the longest key word said in the
    // first 60 % of the line (a device waiting for the last word leaves its card blank most of the beat)
    const early = toks.filter((t, k) => k <= Math.max(1, Math.floor(toks.length * 0.6)));
    const longest = (ts: Tok[]) => [...ts].sort((a, b) => clean(b.text).length - clean(a.text).length)[0];
    const keyTok = toks.find(t => t.reg === 'concept') ?? longest(early.filter(t => t.reg !== 'small')) ?? longest(toks.filter(t => t.reg !== 'small')) ?? longest(toks);
    const L = locks(toks);
    const beat: Beat = {
      setup: c.setup, family: c.family, why: c.why, spec: c.spec, hero, t0, t1, enter: c.enter, from: i % 2 ? 1 : -1, orbit, scan,
      pics: pics.map(ref), echo: shown.slice(-4).reverse(), locks: L, toks, items,
      num: nv != null && nw ? { text: clean(nw.word), value: nv, t: nw.t } : null,
      key: keyTok ? { text: clean(keyTok.text), t: keyTok.t } : null,
      half: L[1]?.toks[0]?.t ?? (p.words[Math.floor(p.words.length / 2)]?.t ?? t0), coined: o.coined,
    };
    if (pic) shown.push(beat.pics[0]!);
    return beat;
  });
  const events: Record<string, unknown>[] = [];
  const E = (t: number, event: string, extra: Record<string, unknown> = {}) => events.push({ t: +t.toFixed(3), event, ...extra });
  beats.forEach((b, i) => {
    E(b.t0, i ? 'scene' : 'hard-hit');
    if (b.pics.length) { const land = b.t0 + (b.enter === 'drop' ? 0.28 : b.enter === 'turn' ? 0.3 : 0.18); E(land, b.enter === 'drop' ? 'thud' : b.enter === 'fly' ? 'card-in' : 'paper-pop'); }
    if (b.scan) E(b.t0 + 0.5, 'tear');
    // the set-up's own devices land on the voice (the player uses the same times)
    const k = b.key?.t ?? b.t0 + 0.5;
    switch (b.setup) {
      case 'stamp': E(k + 0.12, 'thud'); break;
      case 'torn-reveal': E(Math.max(b.t0 + 0.25, k - 0.1), 'tear'); break;
      case 'before-after': E(b.half, 'tear'); break;
      case 'map-pin': E(b.t0 + 0.55, 'thud'); break;
      case 'taped-wall': case 'polaroid-stack': (b.items.length ? b.items.map(x => x.t) : [b.t0 + 0.2, b.t0 + 0.5, b.t0 + 0.8]).forEach(t => E(t + 0.05, 'paper-pop')); break;
      case 'pile': for (let j = 0; j < 4; j++) E(b.t0 + 0.12 + j * 0.16, 'card-in'); break;
      case 'diptych': case 'pair-stacked': case 'binary': case 'arrow-flow': case 'scale-shift': E(b.half, 'paper-pop'); break;
      case 'strike-swap': case 'circled': case 'arrow-point': E(k, 'card-in'); break;
    }
    for (const l of b.locks) for (const tk of l.toks) {
      E(tk.t + 0.03, 'word', { text: tk.text });
      if (/\d/.test(tk.text)) E(tk.t + 0.05, 'stat');
      if (tk.reg === 'concept') E(tk.t + 0.03, 'key-word');
    }
  });
  events.sort((a, b) => (a.t as number) - (b.t as number));
  return { film: { id: o.id, world: o.world, duration: o.duration, beats, audio: o.audio, arc: o.arc }, events };
}
