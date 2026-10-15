/**
 * Dark Vox film builder. The world (the reference night stage, or a brand's hue pushed into the same night), then the
 * STYLE's planner: every shot is cast from the library (./library.ts) by what its line needs, not rotated through a
 * fixed list.
 *   planLines   one short model call over the script's lines (any model: a flat list of plain strings per line:
 *               need tags, an optional set-up hint, the 1-3 spoken words that go on screen, one concrete prop), with a
 *               deterministic fallback (the needs detector, the longest word, the prop matcher)
 *   castFilm    lines → shots (pieces of the voice) → BeatIn[] → kit cast() (needs, slot fit, recent films, a per-film
 *               jitter) → the beats nothing serves are improvised (the caller runs kit improvise in parallel); then
 *               the Dark Vox staging: the set (from the set-up's sets, never the last one, the least used), the camera
 *               move, the transition (zoom; a portal into a frame-like set-up at most twice; a hard cut on a turn),
 *               the words and their look (about 45 % of shots, set-ups that carry words always), the props (no prop
 *               twice in a film), which shots get a model-drawn picture (at most four)
 *   compose     the film.json the player plays + the Style 1 SFX events
 * All numbers come from packages/library/src/dark-vox/tokens.ts.
 */
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { ask, modelName } from '../runtime';
import { within } from '../styles/common';
import { cast, catalog, type BeatIn, type Cast, type Role } from '../styles/kit/library';
import { detectNeeds, isNeed, listItems, mergeNeeds, spokenNumber, type Need } from '../styles/kit/needs';
import { keyWords, type Spec } from '../styles/kit/compose';
import type { PicLabel, Picture } from '../s4/picture';
import type { World } from '../s4/world';
import type { Piece, Word } from '../s4/compose';
import { CAMERA, DARK_VOX, HERO_TONES, PALETTE, SET_DEFAULTS, TYPE_SHARE, type CameraMove, type SetKind, type TypeLook } from '../../../library/src/dark-vox/tokens';
import { setupOf, type DvSetup } from './library';
import { PROP_NAMES, propFor, propNamed } from './props';

export interface DarkWorld { name: string; palette: Record<keyof typeof PALETTE, string>; hero: World }

const hsl = (h: number, s: number, l: number) => {
  s /= 100; l /= 100;
  const k = (n: number) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return '#' + [f(0), f(8), f(4)].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
};
const hsOf = (hex: string) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim()); if (!m) return { h: 0, s: 0 };
  const n = parseInt(m[1]!, 16), r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0; if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: Math.round((h * 60 + 360) % 360), s: mx ? d / mx : 0 };
};

/** The reference night stage (clone tests). */
export const STAGE: DarkWorld = {
  name: 'stage', palette: { ...PALETTE },
  hero: { name: 'stage', hue: HERO_TONES.hue, ink: HERO_TONES.ink, edge: HERO_TONES.edge, top: HERO_TONES.top, mid: HERO_TONES.mid, paper: HERO_TONES.paper, center: HERO_TONES.mid },
};

/** A brand's Dark Vox world: the same night, soot, cream and warm lamps; the brand's hue replaces the velvet red, the hero tritone and the end card. */
export function darkWorld(name: string, ...colours: string[]): DarkWorld {
  const c = colours.map(hsOf).find(x => x.s >= 0.18) ?? { h: 352, s: 0.6 }, h = c.h;
  const p = { ...PALETTE } as Record<keyof typeof PALETTE, string>;
  p.oxblood = hsl(h, 55, 20); p.scarlet = hsl(h, 62, 40); p.marker = hsl(h, 80, 52);
  p.acid = hsl(h, 85, 52); p.acidEdge = hsl(h, 80, 20);
  // the night stays blue-black (#0D121D): it is the style, not the brand
  // the waves / swirl blues take the brand hue only when the brand is itself blue-ish (keeps the cold/warm split)
  if (h >= 180 && h <= 260) { p.cobalt = hsl(h, 58, 42); p.navy = hsl(h, 58, 26); }
  const hero: World = { name, hue: h, ink: hsl(h, 30, 6), edge: hsl(h, 55, 24), top: hsl(h, 55, 46), mid: hsl((h + 15) % 360, 55, 76), paper: hsl(40, 45, 93), center: hsl(h, 55, 76) };
  return { name, palette: p, hero };
}

/* ───────── the line plan (one flat model call, deterministic fallback) ───────── */
export interface LinePlan { tags: Need[]; hint: string; show: string[]; prop: string; propName: string | null }
const norm = (w: string) => w.toLowerCase().replace(/[^a-z0-9']/g, '');
const STOPW = new Set('a an the of to and or in on is are was were be it its this that for with as at by from your you our we they their just only very so but not no then when what which who how now here there into onto over every each some more most much many also still yet'.split(' '));
/** The line's longest content word (the deterministic "word on screen"). */
const longest = (text: string) => text.split(/\s+/).map(w => w.replace(/[^\p{L}\p{N}'%$-]/gu, '')).filter(w => w.length > 3 && !STOPW.has(w.toLowerCase())).sort((a, b) => b.length - a.length)[0];

export function fallbackLines(lines: string[]): LinePlan[] {
  let shown = 0;
  return lines.map((l, i) => {
    const want = (i + 1) * TYPE_SHARE - shown >= 0.5 || i === lines.length - 1;
    const w = want ? longest(l) : undefined; if (w) shown++;
    return { tags: [], hint: '', show: w ? [w] : [], prop: '', propName: null };
  });
}

/** One short call plans every line: need tags, a set-up hint, the words on screen, a prop. Any model can fill it. */
export async function planLines(lines: string[], topic: string, lib: DvSetup[], o: { signal?: AbortSignal; log?: (s: string) => void; ms?: number } = {}): Promise<{ plans: LinePlan[]; model: string }> {
  const fb = fallbackLines(lines);
  try {
    const r = await within(o.ms ?? 30_000, o.signal, signal => ask({
      agent: 'darkvox-plan', tier: 'fast', deadlineMs: o.ms ?? 30_000, maxTurns: 3, quick: true, signal,
      system: 'You plan a Dark Vox reel: a fable told on a lit paper-theatre stage at night, one stage set-up per line. For each line give plain short strings only.',
      prompt: `Topic: ${topic}\n\nNeed words (use only these): ${['problem', 'stakes', 'question', 'answer', 'reveal', 'brand', 'claim', 'reason', 'benefit', 'payoff', 'list', 'steps', 'process', 'compare', 'contrast', 'before-after', 'choice', 'timeline', 'number', 'growth', 'decline', 'scale', 'money', 'time', 'speed', 'people', 'voices', 'quote', 'proof', 'location', 'global', 'network', 'flow', 'connect', 'product', 'tool', 'data', 'ai', 'security', 'warning', 'success', 'emotion', 'calm', 'chaos', 'idea', 'focus', 'hidden', 'build', 'simplify', 'home', 'travel', 'learn'].join(', ')}\n\nSet-ups (id: what it shows):\n${catalog(lib, 60)}\n\nLines:\n${lines.map((l, i) => `${i + 1}. ${l}`).join('\n')}\n\nFor EACH line, in order: tags = 2-4 need words, comma separated; setup = one set-up id that would stage it best (or empty); show = 1-3 words copied exactly from that line to show big on screen (the punch noun or name), empty on about half the lines; prop = one concrete old-fashioned object that shows the line (1-3 words, e.g. "pocket watch", "theatre ticket"; never a lightbulb, padlock, key, trophy, rocket or gear).`,
      schema: { lines: z.array(z.object({ tags: z.string(), setup: z.string(), show: z.string(), prop: z.string() })).describe(`exactly ${lines.length} entries, one per line`) },
    }));
    const ids = new Set(lib.map(s => s.id));
    const plans = lines.map((l, i) => {
      const a = r.lines[i]; if (!a) return fb[i]!;
      const said = new Set(l.split(/\s+/).map(norm));
      const tags = String(a.tags ?? '').toLowerCase().split(/[,;/\s]+/).map(t => t.trim()).filter(isNeed).slice(0, 4) as Need[];
      const show = String(a.show ?? '').split(/\s+/).filter(w => said.has(norm(w)) && !STOPW.has(norm(w))).slice(0, 3);
      const hint = String(a.setup ?? '').trim().toLowerCase();
      const prop = String(a.prop ?? '').trim().slice(0, 40);
      return { tags, hint: ids.has(hint) ? hint : '', show, prop, propName: prop ? propNamed(prop) : null };
    });
    // a model that tags at random (weak ones do) is ignored: the detector alone decides the needs
    const m = mergeNeeds(lines, plans.map((p, i) => ({ line: i, needs: p.tags })));
    if (!m.trusted) { o.log?.('plan: the model need tags look random; using the detector only'); plans.forEach(p => { p.tags = []; }); }
    return { plans, model: modelName('fast') };
  } catch (e) {
    if (o.signal?.aborted) throw e;
    o.log?.(`plan: model failed (${String(e instanceof Error ? e.message : e).slice(0, 80)}); deterministic plan`);
    return { plans: fb, model: 'fallback' };
  }
}

const UNITS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const SCALES: Record<string, number> = { hundred: 100, thousand: 1000, million: 1e6, billion: 1e9 };
/** A number said in words ("thirty minutes", "two thousand teams") as a value and the spoken words it spans; "one" alone is not a number. */
export function wordNumber(text: string): { value: number; from: number; to: number } | null {
  const ws = text.split(/\s+/).map(w => w.toLowerCase().replace(/[^a-z-]/g, ''));
  for (let i = 0; i < ws.length; i++) {
    let j = i, total = 0, cur = 0, seen = 0;
    while (j < ws.length) {
      const parts = ws[j]!.split('-'); if (!parts.every(p => p in UNITS || p in SCALES || p === 'and')) break;
      for (const p of parts) { if (p in UNITS) cur += UNITS[p]!; else if (p === 'hundred') cur = (cur || 1) * 100; else if (p in SCALES) { total += (cur || 1) * SCALES[p]!; cur = 0; } }
      seen++; j++;
    }
    const v = total + cur;
    if (seen && v > 1 && !(seen === 1 && ws[i] === 'one')) return { value: v, from: i, to: j - 1 };
  }
  return null;
}
const numberOf = (text: string) => spokenNumber(text) ?? wordNumber(text)?.value ?? null;

/** Which script line each voice piece belongs to (pieces are sentences or halves of them, in order). */
export function lineOf(ps: Piece[], lines: string[]): number[] {
  const lw = lines.map(l => new Set(l.split(/\s+/).map(norm).filter(Boolean)));
  let at = 0;
  return ps.map(p => {
    const pw = p.words.map(w => norm(w.word)).filter(Boolean);
    const score = (k: number) => (lw[k] ? pw.filter(w => lw[k]!.has(w)).length / Math.max(1, pw.length) : 0);
    // stay on this line while it fits; move on when the next fits better
    while (at + 1 < lines.length && score(at + 1) > score(at)) at++;
    return Math.min(at, Math.max(0, lines.length - 1));
  });
}

/* ───────── casting and staging ───────── */
export type Transition = 'zoom' | 'portal' | 'cut';
export interface ShotPlan {
  setup: string; set: SetKind; move: CameraMove; transition: Transition; show: string[]; look: TypeLook; marker: boolean;
  props: string[]; picture: boolean; pictureNoun: string; dress?: DvSetup['dress']; spec?: Spec; why: string; line: number;
  /** no words and a centred subject: the camera frames the stage tighter (no empty top half) */
  tight?: boolean;
}
/** the default moves; the whip (slide) and long pull-backs crop wide set-ups, so only set-ups that ask get the whip */
const MOVES: CameraMove[] = ['punch', 'pull', 'rise', 'hold'];
const rnd = (seed: string) => createHash('sha1').update(seed).digest().readUInt32BE(0) / 2 ** 32;

/** Pieces → BeatIn[] for the matcher: needs = role + the model's tags + the detector; items; number; seconds. */
export function beatsOf(ps: Piece[], lineIx: number[], plans: LinePlan[], end: number): BeatIn[] {
  const n = ps.length;
  return ps.map((p, i) => {
    const role: Role = i === 0 ? 'open' : i === n - 1 ? 'close' : 'middle';
    const lp = plans[lineIx[i]!];
    const firstOfLine = i === 0 || lineIx[i - 1] !== lineIx[i];
    const det = detectNeeds(p.text, { index: i, count: n });
    const needs = [...new Set<Need>([...(role === 'open' ? ['hook' as Need] : role === 'close' ? ['payoff' as Need] : []), ...(lp?.tags ?? []), ...det])].slice(0, 7);
    const t0 = p.words[0]!.t, t1 = i < n - 1 ? ps[i + 1]!.words[0]!.t : end;
    return { index: i, text: p.text, words: p.words.length, seconds: +(t1 - t0).toFixed(2), needs, items: listItems(p.text).length, number: numberOf(p.text), role, hints: firstOfLine && lp?.hint ? [lp.hint] : [] };
  });
}

/**
 * The film's cast and staging. `casts[i].setup === null` → the caller improvises beat i (and fills plan[i].spec).
 */
export function castFilm(o: { ps: Piece[]; lines: string[]; plans: LinePlan[]; lib: DvSetup[]; seed: string; recent: string[]; end: number }): { beats: BeatIn[]; casts: Cast[]; plan: ShotPlan[]; lineIx: number[] } {
  const lineIx = lineOf(o.ps, o.lines);
  const beats = beatsOf(o.ps, lineIx, o.plans, o.end);
  const casts = cast(beats, o.lib, { seed: o.seed, recent: o.recent, floor: 3.5, typeShare: 0.2 }); // a beat only one need of a set-up serves is improvised
  const R = (k: string) => rnd(`${o.seed}:${k}`);
  const usedSets = new Map<SetKind, number>(), usedProps = new Set<string>(), shownWords = new Set<string>(), usedNouns = new Set<string>();
  let prevSet = '' as SetKind | '', prevMove = '' as CameraMove | '', portals = 0, cuts = 0, pics = 0;
  const plan: ShotPlan[] = beats.map((b, i) => {
    const su = casts[i]!.setup as DvSetup | null, meta = su ? (setupOf(su.id, o.lib) ?? su) : null;
    const lp = o.plans[lineIx[i]!];
    // the set: one of the set-up's, never the last, the least used so far (jitter breaks ties)
    const sets = (meta?.sets?.length ? meta.sets : (['velvet', 'night', 'checker', 'harlequin', 'swirl', 'wood'] as SetKind[]));
    const pool = sets.filter(s => s !== prevSet).length ? sets.filter(s => s !== prevSet) : sets;
    const set = pool.reduce((m, s) => ((usedSets.get(s) ?? 0) + R(`set${i}${s}`) * 0.9 < (usedSets.get(m) ?? 0) + R(`set${i}${m}`) * 0.9 ? s : m), pool[0]!);
    usedSets.set(set, (usedSets.get(set) ?? 0) + 1); prevSet = set;
    // the camera: the set-up's moves, never the same twice running; the first shot punches in
    const mv = (meta?.moves ?? MOVES).filter(m => m !== prevMove);
    const move: CameraMove = i === 0 ? 'punch' : (mv.length ? mv : MOVES)[Math.floor(R(`mv${i}`) * (mv.length || MOVES.length))]!;
    prevMove = move;
    // words: the plan's (spoken) words; set-ups that carry words always get one
    // the line's words go on the FIRST of its pieces that says them (a line split in two never shows them twice)
    const earlier = beats.slice(0, i).filter((_, k) => lineIx[k] === lineIx[i]).map(x => x.text).join(' ').split(/\s+/).map(norm);
    let words = lp ? lp.show.filter(w => b.text.split(/\s+/).some(x => norm(x) === norm(w)) && !earlier.includes(norm(w))) : [];
    // a word the film already showed is not shown again (the last line may repeat the brand)
    if (i < beats.length - 1) words = words.filter(w => !shownWords.has(norm(w)));
    if (!words.length && meta?.wants === 'words') { const k = b.text.split(/\s+/).map(w => w.replace(/[^\p{L}\p{N}'%$.-]/gu, '').replace(/\.$/, '')).filter(w => w.length > 3 && !STOPW.has(w.toLowerCase()) && !shownWords.has(norm(w))).sort((x, y) => y.length - x.length)[0] ?? longest(b.text); if (k) words = [k]; }
    if (!words.length && meta?.wants === 'words') { const ws = b.text.split(/\s+/).map(w => w.replace(/[^\p{L}\p{N}'%$-]/gu, '')).filter(w => w.length > 1); const k = ws.filter(w => !STOPW.has(w.toLowerCase())).sort((x, y) => y.length - x.length)[0] ?? ws.sort((x, y) => y.length - x.length)[0]; if (k) words = [k]; }
    words.forEach(w => shownWords.add(norm(w)));
    if (meta?.number === 'required' && b.number != null) { const wn = wordNumber(b.text), toks = b.text.split(/\s+/); const numTok = toks.find(x => /\d/.test(x)) ?? (wn ? toks[wn.from] : undefined); if (numTok && !words.some(w => norm(w) === norm(numTok))) words = [numTok.replace(/[.,!?;:"]+$/g, ''), ...words].slice(0, 3); }
    // the props: the model's object, the line's meaning, each item's; never a prop the film already used
    const want = Math.max(1, meta?.props ?? 2, meta?.items ? b.items : 0);
    const props: string[] = [];
    const add = (p: string | null | undefined) => { if (props.length < want && p && PROP_NAMES.includes(p) && !props.includes(p) && !usedProps.has(p)) props.push(p); };
    if (i === lineIx.indexOf(lineIx[i]!) || !lp?.propName) add(lp?.propName);
    add(propFor(b.text, [...usedProps, ...props]));
    for (const it of listItems(b.text)) add(propFor(it, [...usedProps, ...props]));
    for (const k of keyWords(b.text.split(/\s+/).map((w, j) => ({ word: w, t: j, end: j })), 4)) add(propFor(k.word, [...usedProps, ...props]));
    while (props.length < want) { const p = propFor(`${b.text} ${props.length} ${i}`, [...usedProps, ...props]); if (props.includes(p)) break; props.push(p); }
    props.forEach(p => usedProps.add(p));
    // a model-drawn picture: only where the set-up's hero is the line's prop, at most four a film
    // the drawn object: the plan's, unless an earlier piece of this line already drew it
    const pictureNoun = lp?.prop && !usedNouns.has(lp.prop.toLowerCase()) ? lp.prop : props[0] ?? '';
    const picture = !!meta?.pic && pics < 4 && !!pictureNoun && (R(`pic${i}`) < 0.85 || b.role === 'open');
    if (picture) { pics++; usedNouns.add(pictureNoun.toLowerCase()); }
    // the transition in
    let transition: Transition = 'zoom';
    if (i > 0 && meta?.portal && portals < 2 && !words.length && R(`tr${i}`) < 0.5) { transition = 'portal'; portals++; }
    else if (i > 0 && cuts < 2 && (b.needs.includes('contrast') || b.needs.includes('warning')) && R(`cut${i}`) < 0.45) { transition = 'cut'; cuts++; }
    const look: TypeLook = words.length === 1 ? (R(`lk${i}`) < 0.62 ? 'title' : 'label') : words.length === 2 ? (R(`lk${i}`) < 0.5 ? 'title' : 'engraved') : 'engraved';
    return { setup: su?.id ?? 'improvised', set, move, transition, show: words, look, marker: look === 'label' && R(`mk${i}`) < 0.6, props, picture, pictureNoun, dress: meta?.dress, tight: !meta?.wide, why: casts[i]!.why, line: lineIx[i]! };
  });
  // words are rare and big: about 45 % of shots; set-ups that carry words keep theirs
  const carries = (p: ShotPlan) => { const m = setupOf(p.setup, o.lib); return m?.wants === 'words' || m?.number === 'required'; };
  const share = () => plan.filter(p => p.show.length).length / plan.length;
  for (let i = plan.length - 2; i >= 1 && share() > 0.55; i--) if (!carries(plan[i]!) && plan[i]!.show.length) plan[i]!.show = [];
  for (let i = 0; i < plan.length && share() < 0.35; i++) if (!plan[i]!.show.length && plan[i]!.transition !== 'portal') { const k = longest(beats[i]!.text); if (k) { plan[i]!.show = [k]; plan[i]!.look = 'title'; } }
  for (const p of plan) p.tight = !!p.tight && !p.show.length;
  return { beats, casts, plan, lineIx };
}

/* ───────── composition ───────── */
export interface Shot extends Omit<ShotPlan, 'why' | 'pictureNoun' | 'picture'> {
  t0: number; t1: number;
  pic: { full: string; parts: { png: string; move: string }[]; label?: PicLabel | null } | null;
  toks: { text: string; t: number }[];
  items: { text: string; t: number }[];
  number: { value: number; text: string; t: number } | null;
  /** the shot's spoken words (the telegram and quote set-ups set the whole line) */
  words: Word[];
  end?: { brand: string };
}
export interface DarkFilm { id: string; duration: number; audio: string; palette: DarkWorld['palette']; tokens: typeof DARK_VOX; shots: Shot[] }

/** Each spoken list item with the time its first word is said. */
function itemTimes(p: Piece): { text: string; t: number }[] {
  const its = listItems(p.text), ws = p.words; let at = 0; const out: { text: string; t: number }[] = [];
  for (const it of its) {
    const first = norm(it.split(/\s+/)[0] ?? ''); let k = at;
    while (k < ws.length && norm(ws[k]!.word) !== first) k++;
    if (k >= ws.length) k = Math.min(ws.length - 1, at);
    out.push({ text: it, t: ws[k]!.t }); at = k + 1;
  }
  return out;
}

export function compose(o: { id: string; world: DarkWorld; words: Word[]; pieces: Piece[]; plan: ShotPlan[]; pics: (Picture | null)[]; duration: number; audio: string; picUrl: (f: string) => string; endCard?: string }): { film: DarkFilm; events: Record<string, unknown>[] } {
  const lastWord = o.words.at(-1)!.end;
  const endT = o.endCard && o.duration - lastWord > 1.2 ? Math.max(lastWord + 0.25, o.duration - 2.6) : null;
  const shots: Shot[] = o.pieces.map((p, i) => {
    const plan = o.plan[i]!, pic = o.pics[i];
    const t0 = i === 0 ? 0 : Math.max(0, p.words[0]!.t - 0.08);
    const t1 = i === o.pieces.length - 1 ? (endT ?? o.duration) : Math.max(0, o.pieces[i + 1]!.words[0]!.t - 0.08);
    const want = new Set(plan.show.map(norm)), toks: Shot['toks'] = [];
    for (const w of p.words) if (want.has(norm(w.word)) && toks.length < 3 && !toks.some(k => norm(k.text) === norm(w.word))) toks.push({ text: w.word.replace(/[.,!?;:"]+$/g, ''), t: w.t });
    const wn = spokenNumber(p.text) == null ? wordNumber(p.text) : null;
    const nv = numberOf(p.text), nw = p.words.find(w => /\d/.test(w.word)) ?? (wn ? p.words[wn.from] : undefined);
    const { why: _w, pictureNoun: _n, picture: _p, ...rest } = plan;
    return {
      ...rest, t0, t1, toks, items: itemTimes(p),
      number: nv != null && nw ? { value: nv, text: wn ? nv.toLocaleString('en-US') : nw.word.replace(/[.,!?;:"]+$/g, '').replace(/^[^\d$€£₹]+/, ''), t: nw.t } : null,
      words: p.words,
      pic: pic ? { full: o.picUrl(pic.full), parts: pic.parts.map(x => ({ png: o.picUrl(x.png), move: x.move })), label: pic.labelAt ?? null } : null,
    };
  });
  if (endT != null) shots.push({ setup: 'end-card', set: 'grid', move: 'punch', transition: 'zoom', show: [o.endCard!], look: 'label', marker: true, props: [], line: -1, t0: endT, t1: o.duration, pic: null, toks: [{ text: o.endCard!, t: endT + 0.02 }], items: [], number: null, words: [], end: { brand: o.endCard! } });
  const events: Record<string, unknown>[] = [];
  shots.forEach((s, i) => {
    events.push({ t: +s.t0.toFixed(3), event: i ? (s.transition === 'portal' ? 'page-turn' : 'scene') : 'hard-hit' });
    if (!s.end) events.push({ t: +(s.t0 + CAMERA.moveSeconds.punch * 0.7).toFixed(3), event: s.move === 'slide' ? 'riffle' : 'card-in' });
    for (const it of s.items.slice(1, 4)) events.push({ t: +(it.t + 0.02).toFixed(3), event: 'card-in', gain_db: -3 });
    for (const k of s.toks) events.push({ t: +(k.t + 0.02).toFixed(3), event: 'key-word', text: k.text });
    if (s.marker && s.toks.length) events.push({ t: +(s.toks[0]!.t + 0.3).toFixed(3), event: 'accent' });
    if (s.t1 - s.t0 > CAMERA.reframe.after) events.push({ t: +((s.t0 + s.t1) / 2).toFixed(3), event: 'scene', gain_db: -4 });
    if (s.end) events.push({ t: +(s.t0 + 0.3).toFixed(3), event: 'cta' });
  });
  events.sort((a, b) => (a.t as number) - (b.t as number));
  return { film: { id: o.id, duration: o.duration, audio: o.audio, palette: o.world.palette, tokens: DARK_VOX, shots }, events };
}

/** Rebind a kept improvisation (grown set-up) to a new beat: same grammar, this line's words, times and props. */
export function rebind(spec: Spec & { n?: number }, words: Word[], props: string[]): Spec {
  const keys = keyWords(words.map(w => ({ word: w.word, t: w.t, end: w.end })), 3); let ki = 0, pk = 0;
  const n0 = Math.max(1, spec.n ?? words.length), n1 = words.length;
  return { ...spec, elements: spec.elements.map(e => {
    const word = Math.max(0, Math.min(n1 - 1, Math.round(e.word / n0 * n1)));
    if (e.kind === 'word' || e.kind === 'label') { const k = keys[ki++ % Math.max(1, keys.length)]; return k ? { ...e, text: k.word, word: k.index } : e; }
    if (e.kind === 'prop') return { ...e, icon: props[pk++ % Math.max(1, props.length)] ?? e.icon, word };
    return { ...e, word };
  }).filter(e => !((e.kind === 'word' || e.kind === 'label') && !e.text)) };
}

/** Set names for logs and the default needs of the old fixed plan (kept for the clone path's report). */
export const SET_NOTES = Object.fromEntries(Object.entries(SET_DEFAULTS).map(([k, v]) => [k, v.about]));
