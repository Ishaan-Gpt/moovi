import { createHash } from 'node:crypto';
import { detectNeeds, isNeed, listItems, type Need } from '../styles/kit/needs';
import { ARTIFACTS, byId, type Artifact } from './artifacts';
import { LAYOUT_IDS, slotsOf, type FormatId, type LayoutId } from './layouts';
import { CAMERAS, ENTERS, IDLES, TRANSITIONS, TYPE_STYLES, type BeatIn, type CameraId, type Content, type Enter, type Idle, type TransitionId, type TypeLine, type VElement, type VPlan, type VScene } from './types';

/**
 * The art director's casting: one beat in, one scene out (a layout, the artifacts in its slots, ambient depth, camera,
 * the way it arrives, kinetic type). Deterministic for a seed, so a film can be re-planned and rendered the same; the
 * model only ever names ids from short lists (needs, a layout, artifacts), never coordinates. The words on screen are
 * the beat's own words; numbers are the ones the beat says.
 */
export interface PlanOptions {
  format: FormatId;
  fps?: number;
  theme?: 'light' | 'dark';
  seed?: number;
  /** a capture of the brand's site or a clip frame (a path in the data dir): browser mockups and brand tiles use it */
  image?: string | null;
  clip?: string | null;
  brand?: string | null;
  /** artifact id → times used in this project's earlier films (from the graph): the art director varies */
  used?: Record<string, number>;
  /** the art director's own picks per beat (layout and artifact ids), honoured when valid */
  picks?: ({ layout?: string | null; artifacts?: string[] | null } | null)[];
}

const h32 = (s: string) => parseInt(createHash('sha1').update(s).digest('hex').slice(0, 8), 16);
/** a stable pseudo-random number in [0,1) for a key under a seed */
const jit = (seed: number, key: string) => (h32(`${seed}:${key}`) % 10_000) / 10_000;
const pick = <T>(list: readonly T[], seed: number, key: string, avoid: T[] = []): T => {
  const pool = list.filter(x => !avoid.includes(x));
  const from = pool.length ? pool : list;
  return from[h32(`${seed}:${key}`) % from.length]!;
};

const STOP = new Set('a an the and or but of to in on at for with is are was were be been it its this that these those you your we our they their i me my as by from so if not no do does did can will just more most very than then there here what which who how why when where'.split(' '));
const words = (t: string) => t.replace(/[^\p{L}\p{N}%$€£.,'’\- ]/gu, ' ').split(/\s+/).filter(Boolean);

export function numbersOf(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(/\d[\d,]*(?:\.\d+)?/g)) { const v = Number(m[0].replace(/,/g, '')); if (Number.isFinite(v) && v > 0) out.push(v); }
  return out.slice(0, 6);
}

/** the phrase a card or device shows as its title: the first few meaningful words of the beat */
export function titleOf(text: string, max = 4): string {
  const w = words(text), keep: string[] = [];
  for (const x of w) { if (keep.length >= max) break; if (keep.length || !STOP.has(x.toLowerCase())) keep.push(x); }
  return keep.join(' ').replace(/[,.]$/, '');
}

/** short phrases for a list-like element: the beat's own list, else its clauses, else its words in threes */
export function itemsOf(text: string): string[] {
  const li = listItems(text);
  if (li.length >= 2) return li;
  const clauses = text.split(/[,;:.!?]|\s[-–—]\s/).map(s => s.trim()).filter(s => s.split(/\s+/).length >= 1 && s.length > 1);
  if (clauses.length >= 2) return clauses.slice(0, 4).map(c => words(c).slice(0, 4).join(' '));
  const w = words(text).filter(x => !STOP.has(x.toLowerCase()) || x.length > 3);
  const out: string[] = [];
  for (let i = 0; i < w.length && out.length < 4; i += 2) out.push(w.slice(i, i + 2).join(' '));
  return out.length >= 2 ? out : [titleOf(text, 2), 'and more'];
}

/* ───────── kinetic type ───────── */

/** Lines of 2-3 words (about 16 characters), grouped in pages of up to 3 lines; each word lands on the voice. */
export function typeLines(b: BeatIn, seed: number, i: number): TypeLine[] {
  const ws = words(b.text);
  if (!ws.length) return [];
  const dur = Math.max(0.5, b.end - b.start);
  const times = ws.map((w, k) => {
    const t = b.words?.[k] ? b.words[k]!.start - b.start : (k / ws.length) * dur * 0.82;
    return Math.max(0, +t.toFixed(3));
  });
  const lines: { ws: string[]; at: number[] }[] = [];
  let cur: { ws: string[]; at: number[] } = { ws: [], at: [] };
  for (const [k, w] of ws.entries()) {
    const len = cur.ws.join(' ').length + w.length + 1;
    if (cur.ws.length && (len > 17 || cur.ws.length >= 3)) { lines.push(cur); cur = { ws: [], at: [] }; }
    cur.ws.push(w); cur.at.push(times[k]!);
  }
  if (cur.ws.length) lines.push(cur);
  // an accent word per line: a number, else the longest meaningful word
  const em = (l: { ws: string[] }) => {
    const n = l.ws.findIndex(w => /\d/.test(w)); if (n >= 0) return n;
    let best = -1, len = 3; l.ws.forEach((w, k) => { if (!STOP.has(w.toLowerCase()) && w.length > len) { best = k; len = w.length; } });
    return best >= 0 ? best : null;
  };
  return lines.map((l, k) => ({ text: l.ws.join(' '), at: l.at, style: TYPE_STYLES[(h32(`${seed}:type:${i}:${k}`) + k) % TYPE_STYLES.length]!, em: em(l), page: Math.floor(k / 3) }));
}

/* ───────── casting ───────── */

interface Ctx { needs: Set<Need>; nums: number[]; hasImage: boolean; hasBrand: boolean; seed: number; i: number; prev: Set<string>; used: Record<string, number>; chosen: Set<string> }

function score(a: Artifact, c: Ctx, role: string): number {
  if (a.wants === 'image' && !c.hasImage) return -99;
  if (a.wants === 'numbers' && !c.nums.length && !c.needs.has('growth') && !c.needs.has('number') && !c.needs.has('percent') && !c.needs.has('money') && !c.needs.has('compare') && !c.needs.has('data')) return -50;
  const overlap = a.needs.filter(n => c.needs.has(n)).length;
  // light and particles only where the beat asks for them; two number-led artifacts in one scene say the same thing twice
  if (role === 'ambient' && overlap === 0 && a.kind !== 'bg') return -3 + jit(c.seed, `${c.i}:${a.id}`) * 1.6;
  if (a.wants === 'numbers' && c.chosen.size && [...c.chosen].some(id => byId(id)?.wants === 'numbers')) return -6;
  let s = overlap * 3 + (a.role.includes(role as never) ? 1 : -4);
  if (a.wants === 'numbers' && c.nums.length) s += 2.5;
  if (c.prev.has(a.id)) s -= 4;
  s -= (c.used[a.id] ?? 0) * 0.7;
  if (c.chosen.has(a.id)) s -= 99;
  s -= (a.cost - 1) * 0.3;
  return s + jit(c.seed, `${c.i}:${a.id}`) * 1.6;
}

const best = (pool: readonly Artifact[], c: Ctx, role: string, kindsNot: string[] = []): Artifact | null => {
  let top: Artifact | null = null, topS = -20;
  for (const a of pool) { if (kindsNot.includes(a.kind)) continue; const s = score(a, c, role); if (s > topS) { top = a; topS = s; } }
  return top;
};

function layoutFor(needs: Set<Need>, seed: number, i: number, recent: LayoutId[]): LayoutId {
  const has = (...n: Need[]) => n.some(x => needs.has(x));
  let pool: LayoutId[];
  if (has('compare', 'contrast', 'before-after', 'choice')) pool = ['split-side', 'split-stack'];
  else if (has('list', 'steps', 'ranking', 'timeline')) pool = ['triptych', 'cascade'];
  else if (has('ui', 'product', 'reveal', 'tool')) pool = ['pip', 'callouts', 'hero'];
  else if (has('network', 'global', 'people', 'connect')) pool = ['orbit', 'wall'];
  else if (has('number', 'growth', 'proof', 'percent', 'money')) pool = ['callouts', 'hero', 'pip'];
  else pool = ['hero', 'cascade', 'pip', 'callouts', 'orbit', 'wall', 'split-stack'];
  const fresh = pool.filter(l => !recent.includes(l));
  return pick(fresh.length ? fresh : pool, seed, `layout:${i}`);
}

function contentFor(a: Artifact, text: string, nums: number[], c: { image?: string | null; clip?: string | null; brand?: string | null }, role: 'main' | 'other', _variant: number): Content {
  const title = titleOf(text, 4);
  switch (a.kind) {
    case 'chart': return { title, numbers: nums.length ? nums : undefined, label: nums.length ? undefined : 'growth' };
    case 'device': return { title, items: itemsOf(text), image: a.wants === 'image' ? c.image ?? undefined : role === 'main' ? c.image ?? undefined : undefined, clip: a.id === 'device:phone' || a.id === 'device:browser' ? c.clip ?? undefined : undefined, numbers: nums.length ? nums : undefined };
    case 'card': return { title, items: itemsOf(text).slice(0, 4), numbers: nums.length ? nums : undefined };
    case 'object3d': return { title: c.brand ?? title, image: a.wants === 'image' ? c.image ?? undefined : undefined, numbers: nums.length ? nums : undefined };
    case 'icon': return { label: titleOf(text, 2) };
    default: return {};
  }
}

/** One scene from one beat. */
export function castScene(b: BeatIn, i: number, count: number, o: PlanOptions, prev: VScene | null, recentLayouts: LayoutId[], usedHere: Record<string, number>): VScene {
  const seed = o.seed ?? 7;
  const needs = new Set<Need>([...detectNeeds(b.text, { index: i, count }), ...(b.needs ?? []).filter(isNeed)]);
  const nums = numbersOf(b.text);
  const c: Ctx = { needs, nums, hasImage: !!o.image, hasBrand: !!o.brand, seed, i, prev: new Set(prev ? [...prev.elements.map(e => e.art), ...prev.ambient] : []), used: usedHere, chosen: new Set() };
  const given = o.picks?.[i] ?? null;
  const layout: LayoutId = given?.layout && (LAYOUT_IDS as readonly string[]).includes(given.layout) ? (given.layout as LayoutId) : layoutFor(needs, seed, i, recentLayouts);
  const slots = slotsOf(layout, o.format);
  const elements: VElement[] = [];
  const main = ARTIFACTS.filter(a => a.kind !== 'particles' && a.kind !== 'glow' && a.kind !== 'bg' && a.kind !== 'icon');
  const side = ARTIFACTS.filter(a => a.kind !== 'particles' && a.kind !== 'glow' && a.kind !== 'bg');
  const forced = (given?.artifacts ?? []).map(id => byId(id)).filter((a): a is Artifact => !!a && !['particles', 'glow', 'bg'].includes(a.kind));
  const kinds: string[] = [];
  for (const [k, s] of slots.entries()) {
    let a: Artifact | null = forced[k] ?? null;
    if (!a) {
      if (s.job === 'main') a = best(main.filter(x => x.role.includes('hero')), c, 'hero');
      else if (s.job === 'satellite' || s.job === 'label') a = best(ARTIFACTS.filter(x => x.kind === 'icon'), c, 'accent');
      else if (s.job === 'pip') a = best(side.filter(x => x.kind === 'device' || x.kind === 'card' || x.kind === 'chart'), c, 'support', kinds.slice(0, 1));
      else a = best(side, c, 'support', k === 1 && kinds[0] === 'chart' ? ['chart'] : []);
    }
    if (!a) a = byId('card:stat')!;
    c.chosen.add(a.id); kinds.push(a.kind);
    const enter: Enter = pick(ENTERS, seed, `enter:${i}:${k}`, elements.map(e => e.enter));
    const idle: Idle = pick(IDLES, seed, `idle:${i}:${k}`, elements.map(e => e.idle));
    elements.push({ slot: s.id, art: a.id, content: contentFor(a, b.text, nums, o, s.job === 'main' ? 'main' : 'other', k), enter, idle, at: +(0.08 + k * 0.16).toFixed(2) });
    usedHere[a.id] = (usedHere[a.id] ?? 0) + 1;
  }
  // ambient depth: a backdrop, then particles or light, then (sometimes) a second light
  c.chosen = new Set();
  const bg = best(ARTIFACTS.filter(a => a.kind === 'bg'), c, 'ambient'), fx = best(ARTIFACTS.filter(a => a.kind === 'particles'), c, 'ambient'), glow = best(ARTIFACTS.filter(a => a.kind === 'glow'), c, 'ambient');
  const ambient = [bg, fx, glow].filter((a): a is Artifact => !!a).map(a => a.id);
  for (const id of ambient) usedHere[id] = (usedHere[id] ?? 0) + 1;
  const cam: CameraId = pick(CAMERAS, seed, `camera:${i}`, prev ? [prev.camera] : []);
  const transition: TransitionId | null = i === 0 ? null : pick(TRANSITIONS, seed, `transition:${i}`, prev?.transition ? [prev.transition] : []);
  return { i, start: b.start, end: b.end, layout, elements, ambient, camera: cam, transition, type: typeLines(b, seed, i) };
}

/** The whole film's plan. Scenes tile the timeline (each starts where the last ended). */
export function planFilm(beats: BeatIn[], o: PlanOptions): VPlan {
  const scenes: VScene[] = [];
  const used: Record<string, number> = { ...(o.used ?? {}) };
  const recent: LayoutId[] = [];
  for (const [i, b] of beats.entries()) {
    const s = castScene(b, i, beats.length, o, scenes[i - 1] ?? null, recent.slice(-2), used);
    recent.push(s.layout); scenes.push(s);
  }
  // scenes tile the timeline: a gap between spoken beats goes to the earlier scene
  for (let i = 0; i < scenes.length; i++) { scenes[i]!.end = scenes[i + 1] ? scenes[i + 1]!.start : scenes[i]!.end; }
  if (scenes[0]) scenes[0].start = 0;
  return { format: o.format, fps: o.fps ?? 30, seconds: scenes.at(-1)?.end ?? 0, theme: o.theme ?? 'light', seed: o.seed ?? 7, scenes };
}
