import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { metricsOf, validateEdl, type Edl, type EdlCut, type EdlRemoved, type EdlShotV0 } from './edl';
import { castInserts, openInserts, type InsertDraw, type InsertSource } from './inserts';
import { applyMove, castMoves, X1_MOVES } from './moves';
import { checkAndRepair, repairEdl } from '../review/runner';
import { reviewConfig } from '../review/config';
import { pixelCheckEdl } from '../review/pixels';
import type { PlayerEdl } from './lib';

/**
 * D2.8, edit by words: "tighter", "less zoom", "swap the card at 0:12" change a finished EDL and the player replays it.
 * No model call and no re-transcription: the EDL already holds every decision as data (shots on source time, words,
 * zoom keys, inserts with their beat), so an instruction is a small, exact change to that data, made in milliseconds.
 *
 * What it understands (one or more clauses, split on commas, "and", "then"):
 *  - **tighter** / snappier / faster / cut the pauses ("even tighter" goes further): every pause between two words
 *    inside a shot longer than the new pause cap is cut down to it (jump cuts on word edges, never inside a word);
 *  - **looser** / slower / let it breathe: trimmed pauses get a little air back on each side of a cut;
 *  - **less zoom** / softer zoom, **more zoom** / punchier, **no zoom**: punch-ins and zoom keys scale toward 1
 *    (half), away from it (one and a half, capped), or flat;
 *  - **swap the card at 0:12** (card, insert, graphic, poster): the insert on screen then is re-cast from the library
 *    with a different drawer (or a different picture), same beat, same rules (at most twice, never twice in a row,
 *    off the face); **drop the card at 0:12**; **add a card at 0:12** (casts the beat under that moment);
 *  - **add a paper cut at 0:04** (any playable X1 move by name: digital zoom, checklist, headline wall, zoom-through,
 *    chart grow, paper cut, doodle, cover story, glass type): the move at that moment; with no time, on the beat it suits;
 *  - **undo** puts the previous EDL back (reEditDir keeps one step in its folder; change/versions.ts walks every
 *    version, and **redo** walks forward again).
 *
 * Every output-timed event (captions, inserts, overlays, beats, cuts, sfx, the end card, zoom keys) follows its own
 * source moment through a retime, so nothing drifts off its word. A clause it cannot read is reported, never guessed.
 */

export type ReEditOp =
  | { op: 'tighter'; strength: number }
  | { op: 'looser'; strength: number }
  | { op: 'zoom'; k: number; said: 'less' | 'more' | 'none' }
  | { op: 'swap' | 'drop' | 'add'; t: number }
  | { op: 'move'; n: string; t: number | null }
  | { op: 'undo' }
  | { op: 'redo' };
export interface ReEditStep { said: string; op: ReEditOp; did: string }
export interface ReEditResult { edl: Edl; steps: ReEditStep[]; unknown: string[]; problems: string[]; ms: number; duration: { before: number; after: number };
  /** CHECK on the new EDL (review/): its score before and after the one repair, what the repair did, which version was kept */
  review?: { before: number; after: number | null; repaired: string | null; kept: 'original' | 'repaired'; issues: string[];
    /** reEditDir only: contrast on the footage under up to 3 caption boxes (no render), and the plate it added when no repair was spent yet */
    pixels?: { frames: { t: number; contrast?: number }[]; issues: string[]; repaired: string | null; ms: number; skipped?: string; error?: string } } }
export interface ReEditOpts { src?: InsertSource; /** quiet stretches in source seconds (the planner's quiet.json pauses) */ quiet?: [number, number][];
  /** CHECK on the edited EDL, on by default (false skips it); its repairs here move the caption, never drop a card the person asked for */
  review?: boolean }

const r3 = (x: number) => Math.round(x * 1000) / 1000;
/** The words people use for each playable X1 move (edit/moves.ts), most specific first. */
export const MOVE_WORDS: [string, RegExp][] = [
  ['13', /\b(paper ?cut|paper[- ]?(tear|rip)|torn paper|tear(ing)? (transition|cut))\b/],
  ['09', /\bzoom[- ]?through\b/],
  ['08', /\bheadline ?wall\b/],
  ['16', /\b(cover story|magazine (header|strip|cover))\b/],
  ['17', /\bglass( type| card| slab)?\b/],
  ['14', /\b(doodle( boil)?|marker (ring|circle)|hand[- ]?drawn circle)\b/],
  ['10', /\b(chart( grow)?|bar chart|growth chart|stat counter)\b/],
  ['07', /\b(check ?list|tick ?list)\b/],
  ['05', /\b(digital zoom|punch[- ]?in)\b/],
];
export const moveIn = (c: string): string | null => MOVE_WORDS.find(([, re]) => re.test(c))?.[0] ?? null;
const CARD = '(?:card|insert|graphic|poster|overlay|pop[- ]?up|b-?roll|title)';

/** Seconds from "0:12", "1:05.5", "12s", "12 sec", "at 12". */
export function timeOf(s: string): number | null {
  const m = s.match(/(\d+):(\d{1,2}(?:\.\d+)?)/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  const n = s.match(/(\d+(?:\.\d+)?)\s*(?:s\b|sec|secs|second|seconds)/) ?? s.match(/\bat\s+(\d+(?:\.\d+)?)\b/);
  return n ? Number(n[1]) : null;
}

/** Read an instruction into operations; clauses it cannot read come back in `unknown`. */
export function parseEdit(words: string): { ops: { said: string; op: ReEditOp }[]; unknown: string[] } {
  const ops: { said: string; op: ReEditOp }[] = [], unknown: string[] = [];
  const clauses = words.toLowerCase().replace(/[’']/g, "'").split(/\s*(?:[,;.!]\s+|[;!]|\band then\b|\bthen\b|\band\b|\bplus\b|\balso\b)\s*/).map(c => c.trim()).filter(Boolean);
  for (const c of clauses) {
    const more = /\b(even|much|way|a lot|super|really|more and more)\b/.test(c) ? 2 : 1;
    const t = timeOf(c);
    let op: ReEditOp | null = null;
    if (/^(redo|undo (the|that|my) undo|put it back again)\b/.test(c)) op = { op: 'redo' };
    else if (/^(undo|revert|go back|put it back)\b/.test(c)) op = { op: 'undo' };
    else if (/\b(add|put|use|give|insert|throw in|do|place|want)\b/.test(c) && moveIn(c)) op = { op: 'move', n: moveIn(c)!, t };
    else if (t !== null && new RegExp(`\\b(swap|change|replace|switch|different|another|new)\\b`).test(c) && (new RegExp(`\\b${CARD}s?\\b`).test(c) || /\b(swap|replace)\b/.test(c))) op = { op: 'swap', t };
    else if (t !== null && /\b(drop|remove|delete|kill|lose|cut|get rid of|no)\b/.test(c) && new RegExp(`\\b${CARD}s?\\b`).test(c)) op = { op: 'drop', t };
    else if (t !== null && /\b(add|put|show|give|need)\b/.test(c) && new RegExp(`\\b${CARD}s?\\b`).test(c)) op = { op: 'add', t };
    else if (/\b(no|zero|without|remove|kill|stop|off|drop)\b.*\b(zoom|zooms|zooming|punch[- ]?ins?)\b|\b(zoom|zooms|zooming)\b.*\b(off|none)\b/.test(c)) op = { op: 'zoom', k: 0, said: 'none' };
    else if (/\b(less|fewer|smaller|softer|gentler|subtler|lighter|calmer|tone down|too much|reduce|lower)\b.*\b(zoom|zooms|zooming|punch[- ]?ins?|punch)\b|\b(zoom|zooms|zooming|punch[- ]?ins?)\b.*\b(less|softer|smaller|too much|down)\b/.test(c)) op = { op: 'zoom', k: more > 1 ? 0.25 : 0.5, said: 'less' };
    else if (/\b(more|bigger|stronger|harder|punchier)\b.*\b(zoom|zooms|zooming|punch[- ]?ins?|punch)\b|\b(zoom|zooms|zooming|punch[- ]?ins?)\b.*\b(more|harder|in)\b|^punchier$/.test(c)) op = { op: 'zoom', k: more > 1 ? 2 : 1.5, said: 'more' };
    else if (/\b(tight|tighter|tighten|snappier|snappy|faster|quicker|shorter|less pauses|fewer pauses|cut (the )?(pauses|gaps|silences?)|trim (the )?(pauses|gaps)|pacier|speed (it )?up)\b/.test(c)) op = { op: 'tighter', strength: more };
    else if (/\b(looser|loosen|slower|breathe|breathing|more pauses|longer pauses|less rushed|too fast|too tight|relax|room)\b/.test(c)) op = { op: 'looser', strength: more };
    if (op) ops.push({ said: c, op }); else unknown.push(c);
  }
  return { ops, unknown };
}

interface Piece { from: number; src_in: number; src_out: number }

/**
 * Rebuild the shots from new source pieces (each carrying the index of the old shot it came from) and move every
 * output-timed event to where its source moment now plays. A moment that was cut snaps to the next kept moment.
 */
export function retime(e: Edl, pieces: Piece[], ruleId: string, newHoles: { a: number; b: number }[] = []): Edl {
  const old = e.shots;
  const shots: EdlShotV0[] = [];
  let t = 0;
  const placed: (Piece & { t_in: number; t_out: number })[] = [];
  for (const p of pieces) {
    if (p.src_out - p.src_in < 0.04) continue;
    const t_in = r3(t), t_out = r3(t + (p.src_out - p.src_in));
    placed.push({ ...p, t_in, t_out }); t = t_out;
  }
  const map = (x: number, end = false): number => {
    const i = Math.max(0, old.findIndex((s, k) => x < s.t_out || k === old.length - 1));
    const s = old[i]!, src = s.src_in + Math.min(Math.max(0, x - s.t_in), s.src_out - s.src_in);
    const mine = placed.filter(p => p.from === i);
    const inside = mine.find(p => src >= p.src_in - 1e-6 && src <= p.src_out + 1e-6);
    if (inside) return r3(inside.t_in + (src - inside.src_in));
    // the moment was cut: a start snaps forward to the next kept moment, an end back to the last one
    const next = placed.find(p => p.from > i || (p.from === i && p.src_in > src));
    const prev = [...placed].reverse().find(p => p.from < i || (p.from === i && p.src_out < src));
    if (end) return prev ? prev.t_out : (next?.t_in ?? 0);
    return next ? next.t_in : (prev?.t_out ?? 0);
  };
  const dur = placed.at(-1)?.t_out ?? 0;
  for (let k = 0; k < placed.length; k++) {
    const p = placed[k]!, s = old[p.from]!;
    const { zoom: _z, camera, ...rest } = s;
    const shot: EdlShotV0 = { ...rest, t_in: p.t_in, t_out: p.t_out, src_in: r3(p.src_in), src_out: r3(p.src_out) };
    const keys = (s.zoom ?? []).map(z => ({ ...z, t: map(z.t) })).filter(z => z.t >= p.t_in - 1e-6 && z.t < p.t_out - 0.02)
      .map(z => ({ ...z, ...(z.dur !== undefined ? { dur: r3(Math.max(0.1, Math.min(z.dur, p.t_out - z.t))) } : {}) }));
    if (keys.length) shot.zoom = keys;
    if (camera && placed.findIndex(q => q.from === p.from) === k) shot.camera = { ...camera, ...(camera.t !== undefined ? { t: map(camera.t) } : {}) };
    // a new piece of an old shot after a cut is a new jump cut: say so in its rule
    if (k > 0 && placed[k - 1]!.from === p.from) shot.rule_id = ruleId;
    shots.push(shot);
  }
  const span = <T extends { t0: number; t1: number }>(xs: T[] | undefined, min: number): T[] | undefined => xs && xs
    .map(x => ({ ...x, t0: map(x.t0), t1: Math.min(map(x.t1, true), dur) }))
    // a span the cut shortened a lot is gone; one that was short to begin with (a transition card) stays
    .filter((x, i) => x.t1 - x.t0 >= Math.min(min, 0.7 * (xs[i]!.t1 - xs[i]!.t0)) && x.t1 - x.t0 > 0.04);
  const out: Edl = { ...e, shots };
  out.captions = span(e.captions, 0.05);
  out.beats = span(e.beats, 0.05);
  out.inserts = span(e.inserts, 0.8);
  out.overlays = span(e.overlays, 0.3);
  if (e.sfx) out.sfx = e.sfx.map(x => ({ ...x, t: map(x.t) })).filter(x => x.t <= dur);
  const cuts: EdlCut[] = (e.cuts ?? []).map(c => ({ ...c, t: map(c.t) })).filter(c => c.t > 0 && c.t < dur);
  for (let k = 1; k < placed.length; k++) if (placed[k]!.from === placed[k - 1]!.from && !cuts.some(c => Math.abs(c.t - placed[k]!.t_in) < 0.05)) cuts.push({ t: placed[k]!.t_in, type: 'jump', trigger: 'pause', rule_id: ruleId });
  if (e.cuts || cuts.length) out.cuts = cuts.sort((a, b) => a.t - b.t);
  if (e.end) out.end = { ...e.end, t0: Math.min(map(e.end.t0), Math.max(0, dur - 0.5)) };
  if (e.music?.beats) out.music = { ...e.music, beats: e.music.beats.filter(b => b <= dur) };
  // the source that is no longer played joins removed[] (merged with what was already there)
  const removed: EdlRemoved[] = [...(e.removed ?? []).map(r => ({ ...r }))];
  for (const h of newHoles) removed.push({ src_in: r3(h.a), src_out: r3(h.b), reason: 'pause_trim', rule_id: ruleId });
  // what was removed but is played again is no longer removed
  const keep = shots.map(s => [s.src_in, s.src_out] as const);
  out.removed = removed.flatMap(r => {
    let parts: [number, number][] = [[r.src_in, r.src_out]];
    for (const [a, b] of keep) parts = parts.flatMap(([x, y]) => (b <= x + 0.002 || a >= y - 0.002) ? [[x, y] as [number, number]] : [[x, a] as [number, number], [b, y] as [number, number]].filter(([u, v]) => v - u > 0.01));
    return parts.map(([a, b]) => ({ ...r, src_in: r3(a), src_out: r3(b) }));
  }).sort((a, b) => a.src_in - b.src_in);
  return out;
}

/**
 * Speech in source seconds: each word's span minus the measured quiet stretches (the planner's envelope, quiet.json),
 * since transcribers often stretch a word over the pause after it. Without quiet data the word spans are the speech.
 */
export function speechOf(words: Edl['words'], quiet: [number, number][] = []): { a: number; b: number }[] {
  const out: { a: number; b: number }[] = [];
  for (const w of [...words].sort((x, y) => x.src_t0 - y.src_t0)) {
    let parts = [{ a: w.src_t0, b: w.src_t1 }];
    for (const [qa, qb] of quiet) parts = parts.flatMap(p => (qb <= p.a || qa >= p.b) ? [p] : [{ a: p.a, b: qa }, { a: qb, b: p.b }].filter(x => x.b - x.a > 0.04));
    out.push(...(parts.length ? parts : [{ a: w.src_t0, b: w.src_t1 }]));
  }
  return out;
}

/**
 * Tighten: every silence inside a shot longer than `cap` is cut down to it (half kept on each side, jump cuts on
 * speech edges, never inside a word), and the air left at each jump cut is trimmed to the same half. Words whose
 * timing ran into a cut silence are clamped to the speech that stays.
 */
export function tighten(e: Edl, cap: number, quiet: [number, number][] = [], ruleId = 'reedit.tighter'): { edl: Edl; holes: { a: number; b: number }[] } {
  const side = cap / 2, sp = speechOf(e.words, quiet);
  const pieces: Piece[] = [], holes: { a: number; b: number }[] = [];
  const jumpBefore = (i: number) => i === 0 || Math.abs(e.shots[i - 1]!.src_out - e.shots[i]!.src_in) > 0.002;
  const jumpAfter = (i: number) => i === e.shots.length - 1 || Math.abs(e.shots[i + 1]!.src_in - e.shots[i]!.src_out) > 0.002;
  e.shots.forEach((s, i) => {
    const inShot = sp.filter(x => x.b > s.src_in + 0.01 && x.a < s.src_out - 0.01).map(x => ({ a: Math.max(x.a, s.src_in), b: Math.min(x.b, s.src_out) }));
    if (!inShot.length) { pieces.push({ from: i, src_in: s.src_in, src_out: s.src_out }); return; }
    let start = s.src_in, end = s.src_out;
    // the air at a jump cut: trimmed to the half-cap (never into speech)
    if (jumpBefore(i) && inShot[0]!.a - side > start + 0.04) { holes.push({ a: start, b: inShot[0]!.a - side }); start = inShot[0]!.a - side; }
    if (jumpAfter(i) && inShot.at(-1)!.b + side < end - 0.04) { holes.push({ a: inShot.at(-1)!.b + side, b: end }); end = inShot.at(-1)!.b + side; }
    let at = start;
    for (let k = 1; k < inShot.length; k++) {
      const a = inShot[k - 1]!.b + side, b = inShot[k]!.a - side;
      if (b - a >= 0.06 && a > at && b < end) { pieces.push({ from: i, src_in: at, src_out: a }); holes.push({ a, b }); at = b; }
    }
    pieces.push({ from: i, src_in: at, src_out: end });
  });
  if (!holes.length) return { edl: e, holes };
  const out = retime(e, pieces, ruleId, holes);
  // a word whose timing ran into a cut silence keeps the part that still plays
  out.words = e.words.map(w => {
    let { src_t0: a, src_t1: b } = w;
    for (const h of holes) {
      if (h.b <= a || h.a >= b) continue;
      if (h.a <= a && h.b >= b) continue; // all inside a cut silence: a mistimed word, left as it was
      if (h.a > a && h.b < b) { if (h.a - a >= b - h.b) b = h.a; else a = h.b; }
      else if (h.a <= a) a = h.b; else b = h.a;
    }
    return a === w.src_t0 && b === w.src_t1 ? w : { ...w, src_t0: r3(a), src_t1: r3(b) };
  });
  return { edl: out, holes };
}

/** Give trimmed pauses some air back: each jump cut opens by up to `add` seconds on each side, into removed pauses only. */
export function loosen(e: Edl, add: number, ruleId = 'reedit.looser'): { edl: Edl; opened: number } {
  const open = (e.removed ?? []).filter(r => r.reason === 'pause_trim' || r.reason === 'silence');
  const words = e.words;
  const pieces: Piece[] = e.shots.map((s, i) => ({ from: i, src_in: s.src_in, src_out: s.src_out }));
  let opened = 0;
  for (let i = 0; i < pieces.length; i++) {
    const p = pieces[i]!, next = pieces[i + 1];
    // after this shot: a removed pause starting at its out-point
    const after = open.find(r => Math.abs(r.src_in - p.src_out) < 0.01);
    if (after) {
      const room = (next && Math.abs(after.src_out - next.src_in) < 0.01 ? (after.src_out - after.src_in) / 2 : after.src_out - after.src_in);
      const wordIn = words.find(w => w.src_t0 >= p.src_out && w.src_t0 < p.src_out + room);
      const d = Math.min(add, room, wordIn ? wordIn.src_t0 - p.src_out - 0.02 : add);
      if (d > 0.02) { p.src_out += d; opened += d; }
    }
    const before = open.find(r => Math.abs(r.src_out - p.src_in) < 0.01);
    if (before) {
      const prevEnd = i > 0 ? pieces[i - 1]!.src_out : -Infinity;
      const room = Math.max(0, p.src_in - Math.max(before.src_in, prevEnd));
      const wordOut = [...words].reverse().find(w => w.src_t1 <= p.src_in && w.src_t1 > p.src_in - room);
      const d = Math.min(add, room, wordOut ? p.src_in - wordOut.src_t1 - 0.02 : add);
      if (d > 0.02) { p.src_in -= d; opened += d; }
    }
  }
  return { edl: opened > 0 ? retime(e, pieces, ruleId) : e, opened: r3(opened) };
}

/** Scale every punch-in and zoom key toward 1 (k < 1), away from it (k > 1, capped at `cap`), or flat (k = 0). */
export function scaleZoom(e: Edl, k: number, cap = 1.6): { edl: Edl; changed: number } {
  let changed = 0;
  const f = (s: number) => { const v = Math.min(cap, Math.max(1, 1 + (s - 1) * k)); if (Math.abs(v - s) > 1e-4) changed++; return r3(v); };
  const shots = e.shots.map(s => {
    const out: EdlShotV0 = { ...s };
    if (s.framing) out.framing = { ...s.framing, scale: s.framing.scale >= 1 ? f(s.framing.scale) : s.framing.scale };
    if (s.zoom) { if (k === 0) { changed += s.zoom.length; delete out.zoom; } else out.zoom = s.zoom.map(z => ({ ...z, scale: f(z.scale) })); }
    return out;
  });
  const cuts = k === 0 && e.cuts ? e.cuts.map(c => (c.type === 'zoom_through' || c.type === 'blur_zoom') ? (changed++, { ...c, type: 'hard' as const }) : c) : e.cuts;
  return { edl: { ...e, shots, ...(cuts ? { cuts } : {}) }, changed };
}

const clone = (e: Edl): Edl => JSON.parse(JSON.stringify(e)) as Edl;
const drawOf = (x: { params?: Record<string, unknown> }) => String(x.params?.draw ?? '') as InsertDraw | '';
const clock = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;

/** The insert on screen at t (or the nearest within 1.5 s). */
function insertAt(e: Edl, t: number): number {
  const xs = e.inserts ?? [];
  let best = -1, d = Infinity;
  xs.forEach((x, i) => { const g = t >= x.t0 && t <= x.t1 ? 0 : Math.min(Math.abs(t - x.t0), Math.abs(t - x.t1)); if (g < d) { d = g; best = i; } });
  return d <= 1.5 ? best : -1;
}
/** The beat a card at [t0, t1] serves: the one it overlaps most, else a claim made of the words it covers. */
function beatFor(e: Edl, t0: number, t1: number): NonNullable<Edl['beats']>[number] | null {
  let best: NonNullable<Edl['beats']>[number] | null = null, o = 0;
  for (const b of e.beats ?? []) { const v = Math.min(b.t1, t1) - Math.max(b.t0, t0); if (v > o) { o = v; best = b; } }
  if (best) return best;
  const idx = e.words.map((w, i) => ({ w, i })).filter(({ w }) => { const s = e.shots.find(x => w.src_t0 >= x.src_in - 0.02 && w.src_t0 < x.src_out); if (!s) return false; const tt = s.t_in + (w.src_t0 - s.src_in); return tt >= t0 - 0.3 && tt <= t1 + 0.3; }).map(({ i }) => i);
  return idx.length ? { t0, t1, word_idx: idx, tag: 'claim' } : null;
}

/** Apply an instruction to an EDL. `prev` is the EDL before the last edit (for "undo"). */
export async function reEdit(e0: Edl, words: string, o: ReEditOpts & { prev?: Edl | null } = {}): Promise<ReEditResult> {
  const t0 = performance.now();
  const before = e0.shots.at(-1)!.t_out;
  const parsed = parseEdit(words), unknown = parsed.unknown;
  // times the person names are read on the edit they watched: undo first, then the card edits, then what retimes
  const rank = (x: ReEditOp) => x.op === 'undo' || x.op === 'redo' ? 0 : x.op === 'swap' || x.op === 'drop' || x.op === 'add' || x.op === 'move' ? 1 : 2;
  const ops = parsed.ops.map((x, i) => ({ ...x, i })).sort((x, y) => rank(x.op) - rank(y.op) || x.i - y.i);
  let e = clone(e0);
  const steps: ReEditStep[] = [];
  let src: InsertSource | undefined = o.src;
  const lib = async () => (src ??= await openInserts());
  for (const { said, op } of ops) {
    let did = '';
    if (op.op === 'undo') {
      if (o.prev) { e = clone(o.prev); did = 'put the previous edit back'; } else did = 'nothing to undo';
    } else if (op.op === 'redo') {
      did = 'nothing to redo'; // one folder keeps one step: redo walks the versions (change/versions.ts)
    } else if (op.op === 'tighter') {
      const L = e.laws ?? { pause_max: 0.4, pause_keep: 0.18, hold_max: 2.6, snap_ms: 100 };
      const cap = r3(Math.max(0.1, Math.min(L.pause_max, 0.4) * (op.strength > 1 ? 0.35 : 0.55)));
      const d0 = e.shots.at(-1)!.t_out, r = tighten(e, cap, o.quiet);
      e = r.edl; e.laws = { ...L, pause_max: cap, pause_keep: r3(Math.min(L.pause_keep, cap / 2)) };
      did = r.holes.length ? `cut ${r.holes.length} pauses and cut tails down to ${cap} s, ${r3(d0 - e.shots.at(-1)!.t_out)} s shorter` : `no pause left longer than ${cap} s`;
    } else if (op.op === 'looser') {
      const L = e.laws ?? { pause_max: 0.4, pause_keep: 0.18, hold_max: 2.6, snap_ms: 100 };
      const d0 = e.shots.at(-1)!.t_out, r = loosen(e, op.strength > 1 ? 0.3 : 0.15);
      e = r.edl; e.laws = { ...L, pause_max: r3(L.pause_max + (op.strength > 1 ? 0.3 : 0.15)) };
      did = r.opened ? `gave the cuts ${r.opened} s of air back, ${r3(e.shots.at(-1)!.t_out - d0)} s longer` : 'no trimmed pause to open';
    } else if (op.op === 'zoom') {
      const r = scaleZoom(e, op.k);
      e = r.edl; did = r.changed ? `${op.said === 'none' ? 'flattened' : op.said === 'less' ? 'softened' : 'pushed'} ${r.changed} zoom keys and punch-ins` : 'no zoom to change';
    } else if (op.op === 'move') {
      const m = X1_MOVES[op.n]!;
      if (op.t === null) { const [r] = castMoves(e, [op.n]); did = r?.ok ? `added a ${m.name} (${r.why})` : `no beat suits a ${m.name}${r ? `: ${r.why}` : ''}`; }
      else { const r = applyMove(e, op.n, { t: op.t }); did = r.ok ? `added a ${m.name} at ${clock(op.t)}` : `could not add a ${m.name} at ${clock(op.t)}: ${r.why}`; }
    } else if (op.op === 'drop') {
      const i = insertAt(e, op.t);
      if (i < 0) did = `no card near ${clock(op.t)}`;
      else { const [x] = e.inserts!.splice(i, 1); did = `dropped the ${drawOf(x!) || x!.kind} at ${clock(x!.t0)}`; }
    } else if (op.op === 'swap' || op.op === 'add') {
      const i = op.op === 'swap' ? insertAt(e, op.t) : -1;
      if (op.op === 'swap' && i < 0) { did = `no card near ${clock(op.t)} to swap`; steps.push({ said, op, did }); continue; }
      const x = i >= 0 ? e.inserts![i]! : null;
      const win = x ? [x.t0, x.t1] : [op.t - 0.3, op.t + 2];
      const beat = beatFor(e, win[0]!, win[1]!);
      if (!beat) { did = `no line under ${clock(op.t)} to make a card from`; steps.push({ said, op, did }); continue; }
      const old = x ? drawOf(x) : '';
      const pic = x ? (x.params as { pic?: string } | undefined)?.pic : undefined;
      const work = clone(e);
      if (i >= 0) work.inserts!.splice(i, 1);
      const others = (work.inserts ?? []).length;
      work.beats = [{ ...beat, t0: Math.max(0, Math.min(beat.t0, win[0]! - 0.12)), t1: Math.max(beat.t1, win[1]! - 0.2) }];
      const avoid: InsertDraw[] = old && old !== 'poster' ? [old] : [];
      const tr = await castInserts(work, { src: await lib(), max: 99, avoid, avoidPics: pic ? [pic] : [], ...(x ? { window: [x.t0, Math.max(x.t1, Math.min(x.t0 + 1.6, ...(work.inserts ?? []).filter(y => y.t0 > x.t0).map(y => y.t0 - 0.4), e.shots.at(-1)!.t_out - 1))] as [number, number] } : {}) });
      const pick = tr.picks[0];
      if (!pick || (work.inserts ?? []).length === others) did = `no other card fits ${clock(op.t)}${tr.skipped[0] ? ` (${tr.skipped[0].why})` : ''}; left it as it was`;
      else { work.beats = e.beats; e = work; did = `${x ? `swapped the ${old || x.kind} at ${clock(x.t0)} for a` : 'added a'} ${pick.draw} card (${pick.asset}, ${pick.frame}) at ${clock(pick.t0)}`; }
    }
    steps.push({ said, op, did });
  }
  // measured again only when the edit changed; an undo puts the old EDL back exactly as it was
  const same = (a: Edl, b: Edl) => JSON.stringify({ ...a, metrics: null }) === JSON.stringify({ ...b, metrics: null });
  if (e.metrics && !same(e, e0) && !(o.prev && JSON.stringify(e) === JSON.stringify(o.prev))) e.metrics = metricsOf(e, e.laws?.snap_ms);
  let review: ReEditResult['review'];
  const restored = !!o.prev && JSON.stringify(e) === JSON.stringify(o.prev);
  if (o.review !== false && !same(e, e0) && !restored) {
    const c = checkAndRepair(e, { config: { repairs: { dropDuplicate: false } } });
    if (c.kept === 'repaired' && validateEdl(c.edl).problems.length === 0) e = c.edl;
    const now = c.kept === 'repaired' ? c.after! : c.before;
    review = { before: c.before.score, after: c.after ? c.after.score : null, repaired: c.repaired, kept: e === c.edl && c.kept === 'repaired' ? 'repaired' : 'original', issues: now.issues.slice(0, 8).map(i => i.msg) };
  }
  const problems = validateEdl(e).problems;
  return { ...(review ? { review } : {}), edl: e, steps, unknown, problems, ms: Math.round(performance.now() - t0), duration: { before: r3(before), after: r3(e.shots.at(-1)!.t_out) } };
}

/**
 * Edit a planned edit in its folder by words: reads edl.json, keeps the old one as edl.prev.json (one step of undo),
 * writes the new edl.json (the preview player and the MP4 renderer read it as it is) and appends to reedit.json.
 * An edit with problems is not written.
 */
export async function reEditDir(dir: string, words: string, o: ReEditOpts = {}): Promise<ReEditResult & { written: boolean }> {
  const file = join(dir, 'edl.json'), prevFile = join(dir, 'edl.prev.json'), log = join(dir, 'reedit.json');
  const cur = JSON.parse(readFileSync(file, 'utf8')) as Edl;
  const prev = existsSync(prevFile) ? JSON.parse(readFileSync(prevFile, 'utf8')) as Edl : null;
  const qf = join(dir, 'quiet.json');
  const quiet = o.quiet ?? (existsSync(qf) ? ((JSON.parse(readFileSync(qf, 'utf8')) as { pauses?: [number, number][] }).pauses ?? []) : []);
  const r = await reEdit(cur, words, { ...o, prev, quiet });
  // CHECK part 2: the pixels under the captions of the edited EDL (source footage placed as the render places it);
  // a low read gets the backing plate only when the code check spent no repair (at most one repair per edit)
  if (r.review && o.review !== false) {
    const pe = r.edl as unknown as PlayerEdl, cfg = reviewConfig(pe, { repairs: { dropDuplicate: false } });
    const pc = await pixelCheckEdl(pe, dir, { cfg });
    let repaired: string | null = null;
    if (pc.issues.length && r.review.kept !== 'repaired') {
      const fix = repairEdl(pe, pc.issues, { ...cfg, repairs: { move: false, plate: true, dropDuplicate: false } });
      if (fix && validateEdl(fix.edl as unknown as Edl).problems.length === 0) { r.edl = fix.edl as unknown as Edl; repaired = fix.did; r.review = { ...r.review, repaired: fix.did, kept: 'repaired' }; }
    }
    r.review.pixels = { frames: pc.frames, issues: pc.issues.map(i => i.msg), repaired, ms: pc.ms, ...(pc.skipped ? { skipped: pc.skipped } : {}), ...(pc.error ? { error: pc.error } : {}) };
  }
  const changed = JSON.stringify(r.edl) !== JSON.stringify(cur);
  const written = changed && r.problems.length === 0;
  if (written) {
    // the edit replaced is the one "undo" brings back (so undo after undo is redo)
    writeFileSync(prevFile, JSON.stringify(cur, null, 1));
    writeFileSync(file, JSON.stringify(r.edl, null, 1));
  }
  const hist = existsSync(log) ? JSON.parse(readFileSync(log, 'utf8')) as unknown[] : [];
  hist.push({ at: new Date().toISOString(), words, steps: r.steps, unknown: r.unknown, problems: r.problems, ms: r.ms, duration: r.duration, written, ...(r.review ? { review: r.review } : {}) });
  writeFileSync(log, JSON.stringify(hist, null, 1));
  return { ...r, written };
}
