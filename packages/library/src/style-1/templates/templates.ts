import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Style 1 scene TEMPLATES: the owner's own proven scenes, cut mechanically from his kit-built gold plans
 * (plans/*.plan.json, one template per scene block = one preset call + its `set S[-1]…` + `sfx` ops), with the parts
 * that change per video turned into named slots. Every layout number, camera key, effect and sound stays exactly his.
 *
 * Placeholders inside `ops` (fill() replaces them):
 *   {"$W": id, "add": n}  → a frame: {"$F": <word>, "after": <that word's frame>, "add": n} (exact occurrence)
 *   {"$Ws": id}           → the spoken word itself (preset `at`, a layer `_at`/`_until`, a preset word arg)
 *   {"$Wf": id, "add": n} → "@f:<frame + n>" (a sound cue)
 *   {"$S": n}             → the scene's first frame + n (a numeric frame the owner wrote for this scene)
 *   {"$T": id}            → a title line's text          {"$Tw": id} → the same text as a raw line's words list
 *   {"$C": id}            → a prop's content (label, number, name, message)
 *   {"$M": id}            → a media path (brand screenshot/logo)
 *   {"$N": 1}             → the scene's name in this video
 * Word slots are positions in the scene (`pos` 0..1 of its words) or the next scene's first word (`next`), so a
 * template drops onto any scene: by default each anchor lands at the same relative point of the new scene's words.
 */

export type Op = Record<string, unknown>;
export interface WordSlot { id: string; orig: string; pos?: number; next?: number; str?: boolean }
export interface TextSlot { id: string; orig: string; max: number }
export interface ContentSlot { id: string; orig: string; max: number; prop: string; key: string }
export interface MediaSlot { id: string; orig: string; as: string }
export interface Template {
  id: string;
  source: { video: string; scene: string; index: number; brand: string };
  preset: string;
  /** what it SHOWS, one line (the hero visual) */
  shows: string;
  role: string;
  /** spoken words the owner's scene had, and the range of word counts it fits */
  words: number;
  fits: [number, number];
  seconds: number;
  needs: { logo: boolean; media: number };
  props: string[];
  slots: { words: WordSlot[]; text: TextSlot[]; content: ContentSlot[]; media: MediaSlot[] };
  ops: Op[];
  /** validation result written by the cutter */
  ok?: boolean;
  note?: string;
}
export interface Word { word: string; t: number; end?: number }
export interface SlotValues {
  /** word slot → word index in the reel (optional; default = the slot's relative position in the scene) */
  words?: Record<string, number>;
  text?: Record<string, string>;
  content?: Record<string, string>;
  media?: Record<string, string>;
}
export interface FillCtx {
  /** first and last word index of this scene (inclusive) */
  from: number;
  to: number;
  /** first word index of the next scene (null for the last scene) */
  next: number | null;
  /** true for the reel's first scene (its f0 is 0) */
  first: boolean;
  name: string;
}

const here = dirname(fileURLToPath(import.meta.url));
let cache: Template[] | null = null;
/** Every template JSON in this folder (one file per source video). */
export function loadTemplates(dir = here): Template[] {
  if (cache && dir === here) return cache;
  const out: Template[] = [];
  if (existsSync(dir)) for (const f of readdirSync(dir).filter(f => f.endsWith('.templates.json')).sort()) out.push(...(JSON.parse(readFileSync(join(dir, f), 'utf8')) as Template[]));
  if (dir === here) cache = out;
  return out;
}

const norm = (w: string) => w.toLowerCase().replace(/[^a-z0-9]/g, '');
/** Python round(): half to even (the kit's frame of a word is round(t * 30)). */
const pyRound = (x: number) => { const f = Math.abs(x - Math.trunc(x)); const r = f === 0.5 ? 2 * Math.round(x / 2) : Math.round(x); return r === 0 ? 0 : r; };
export const frameOf = (w: Word) => pyRound(w.t * 30);

/** Resolve every word slot to a word index of the reel. */
export function resolveWords(t: Template, words: Word[], ctx: FillCtx, given: Record<string, number> = {}, exact = false): Record<string, number> {
  if (exact) return Object.fromEntries(t.slots.words.map(s => [s.id, given[s.id]!]));
  const span = Math.max(0, ctx.to - ctx.from), f0 = ctx.first ? 0 : frameOf(words[ctx.from]!) - 4;
  const dflt = (s: WordSlot) => s.next !== undefined ? (ctx.next !== null ? Math.min(words.length - 1, ctx.next + s.next) : ctx.to) : ctx.from + Math.round((s.pos ?? 0) * span);
  const rank = (s: WordSlot) => s.next !== undefined ? 1e6 + s.next : s.pos ?? 0;
  const out: Record<string, number> = {};
  // the model's picks are used only when they stay inside the scene and keep the owner's order
  const picks = t.slots.words.map(s => ({ s, i: given[s.id] }));
  const okPick = picks.every(({ s, i }) => i === undefined || s.next !== undefined || (Number.isInteger(i) && i >= ctx.from && i <= ctx.to));
  const sorted = [...picks].sort((a, b) => rank(a.s) - rank(b.s));
  let order = true, last = -1;
  for (const { s, i } of sorted) { const v = s.next === undefined && i !== undefined && okPick ? i : dflt(s); if (v < last) order = false; last = v; }
  for (const s of t.slots.words) out[s.id] = order && okPick && given[s.id] !== undefined && s.next === undefined ? given[s.id]! : dflt(s);
  // the scene's own first word is always its anchor (pos 0)
  for (const s of t.slots.words) if (s.pos === 0) out[s.id] = ctx.from;
  // a word given as a STRING is found by the kit as the first match at/after the scene start: move to a word that is
  for (const s of t.slots.words) if (s.str && s.pos !== 0) out[s.id] = firstMatch(words, out[s.id]!, f0, ctx);
  return out;
}
function firstMatch(words: Word[], i: number, f0: number, ctx: FillCtx): number {
  const isFirst = (j: number) => { const n = norm(words[j]!.word); if (!n) return false; for (let k = 0; k < j; k++) if (frameOf(words[k]!) >= f0 && norm(words[k]!.word) === n) return false; return true; };
  for (let d = 0; d < words.length; d++) for (const j of [i + d, i - d]) if (j >= ctx.from && j < words.length && isFirst(j)) return j;
  return ctx.from;
}

/** A template's ops for one scene of a new reel: slots filled, words anchored to this reel's voice. */
export function fill(t: Template, values: SlotValues, words: Word[], ctx: FillCtx, o: { exact?: boolean } = {}): Op[] {
  // exact: word slots are taken as given (the cutter's check that a template rebuilds the owner's scene)
  const idx = resolveWords(t, words, ctx, values.words, o.exact);
  const f0 = ctx.first ? 0 : frameOf(words[ctx.from]!) - 4;
  const w = (id: string) => { const i = idx[id]; if (i === undefined) throw new Error(`template ${t.id}: no word slot ${id}`); return i; };
  const text = (id: string) => values.text?.[id] ?? t.slots.text.find(s => s.id === id)?.orig ?? '';
  const content = (id: string) => values.content?.[id] ?? t.slots.content.find(s => s.id === id)?.orig ?? '';
  const media = (id: string) => values.media?.[id] ?? t.slots.media.find(s => s.id === id)?.orig ?? '';
  const sub = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(sub);
    if (!v || typeof v !== 'object') return v;
    const o = v as Record<string, any>;
    if ('$W' in o) { const i = w(o.$W); return { $F: words[i]!.word, after: frameOf(words[i]!), add: o.add ?? 0 }; }
    if ('$Ws' in o) return words[w(o.$Ws)]!.word;
    if ('$Wf' in o) return `@f:${frameOf(words[w(o.$Wf)]!) + (o.add ?? 0)}`;
    if ('$S' in o) return f0 + o.$S;
    if ('$T' in o) return text(o.$T);
    if ('$Tw' in o) return text(o.$Tw).split(/\s+/).filter(Boolean).map(x => ({ w: x, f: 0 }));
    if ('$C' in o) return content(o.$C);
    if ('$M' in o) return media(o.$M);
    if ('$N' in o) return ctx.name;
    return Object.fromEntries(Object.entries(o).map(([k, x]) => [k, sub(x)]));
  };
  // the kit finds the scene's first word from here on (the cursor), so a word said earlier never moves the cut
  return [{ set: ['_cursor'], value: ctx.first ? 0 : frameOf(words[ctx.from]!) }, ...(sub(t.ops) as Op[])];
}

/** The compact index the one-call filler sees: id, what it shows, role, the words it fits, and its slots. */
export function templateIndex(ts: Template[]) {
  return ts.map(t => ({
    id: t.id, shows: t.shows, role: t.role, fits: t.fits,
    text: t.slots.text.map(s => `${s.id}≤${s.max} "${s.orig}"`),
    content: t.slots.content.map(s => `${s.id}≤${s.max} ${s.prop}.${s.key} "${s.orig}"`),
  }));
}
