import { cameraTrack, frame2d, parseCamera, resolveCall } from '@moovi/library/camera';
import { CRAFT, graphOptional, library as L, needGraph, run } from '@moovi/graph';
import { listItems } from '../styles/kit/needs';
import { fxLines } from './effects/auto';
import type { Word } from './cut';
import { numberOf } from './inserts';
import { assetIdOf, editRegistry, findEntry, type EditEntry, type EditFn, type EditLayer, type FaceRule, type SfxKey } from './registry';

/**
 * The director writes the beat spec (edit wiring, step 2): per sentence its function, verb and hero word
 * (edit-fundamentals §3) → a cast from the edit registry (the graph's `editCast`) → the beat spec format of
 * docs/agents/mastery/edit.md, which the one player draws (edit/beats-draw.ts) the same in the preview and the MP4.
 *
 * Three pure steps and one graph call, so the Claude Code bridge can fill any of them (docs/agents/mastery/edit.md,
 * "The director's interface"):
 *   readSentences(words)            the rules' read: function, verbs, hero word per sentence
 *   castBeats(reads, cast, opts)    one registry pick per sentence that needs one (async: the cast is the graph)
 *   beatSpecOf(reads, picks, opts)  the beat spec, pure
 * A chat keyword ("add a crash zoom on 'crore'", "orbit on the hook") is an Ask: it overrides that sentence's pick.
 */

export interface SentenceRead {
  i: number; t0: number; t1: number; text: string; words: Word[];
  fn: EditFn;
  /** registry verbs the sentence says, in spoken order */
  verbs: string[];
  /** the one word the frame is about, and when it is said (source seconds) */
  hero: string; heroT: number;
}

const clean = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}%₹$]/gu, '');
const STOP = new Set('a an the and or but so to of in on at for with is are was were be been it this that you your i we our my me us they its from by as if then than there here what when how who why which just like really very can will do does did have has had not no yes all me hai ki ka ke ko se main mein toh bhi aur ye wo yeh woh na'.split(' '));
const NUM = /\d|\b(two|three|four|five|six|seven|eight|nine|ten|twenty|thirty|fifty|hundred|thousand|million|billion|lakh|lakhs|crore|crores)\b/i;
const FN_RULES: [EditFn, RegExp][] = [
  ['cta', /\b(comment|follow|subscribe|link in (my |the )?bio|dm me|sign up|try it|download|join|click|save this|share this)\b/i],
  ['who', /\b(i am|i'm|my name is|mera naam|main hoon|this is me|we are|we're)\b/i],
  ['list', /\b(first(ly)?|second(ly)?|third(ly)?|finally|step one|number one)\b|,.*,/i],
  ['compare', /\b(vs|versus|instead of|better than|compared|before and after|unlike|rather than)\b/i],
  ['number', NUM],
  ['how', /\b(how|step|upload|type|drop|you just|all you|it will|it can|works|use it|turns? .* into)\b/i],
  ['proof', /\b(results?|clients?|views|followers|already|proof|helped|grew|made me|we made|i made|customers)\b/i],
  ['what', /\b(is an?|it's an?|called|introducing|meet|agentic|tool|app|platform|software|studio|editor)\b/i],
  ['show', /\b(look at|see this|watch|here is|here's|check this|this one)\b/i],
];

/** words too common to be a verb the frame acts out (they stay in the registry for an explicit director pick) */
const GENERIC = new Set('is so now with has this here back today all one two both into after before up down over across but not no this is'.split(' '));
const CLAUSE = new Set(['and', 'which', 'because', 'so', 'but', 'then', 'while', 'where', 'into', 'aur', 'toh', 'kyunki']);
/** a line still longer than 4 s (fxLines keeps a line with a comma whole, for lists) splits at clause words once a part runs 2.6 s */
function clauses(ws: Word[]): Word[][] {
  if (ws.length < 8 || ws.at(-1)!.end - ws[0]!.t <= 4 || listItems(ws.map(w => w.word).join(' ')).length >= 3) return [ws];
  const out: Word[][] = []; let cur: Word[] = [];
  ws.forEach((w, i) => { const nx = ws[i + 1]; cur.push(w); if (nx && cur.length > 3 && w.end - cur[0]!.t >= 2.6 && ws.length - i > 3 && CLAUSE.has(clean(nx.word))) { out.push(cur); cur = []; } });
  if (cur.length) out.push(cur);
  return out;
}
/** a spoken word → the registry verb it says (a light stem: -ing, -ed, -s, -es) */
function verbOf(w: string, verbs: Set<string>): string | null {
  const k = clean(w); if (!k) return null;
  for (const c of [k, k.replace(/ing$/, ''), k.replace(/ing$/, 'e'), k.replace(/ed$/, ''), k.replace(/d$/, ''), k.replace(/es$/, ''), k.replace(/s$/, '')]) if (verbs.has(c)) return c;
  return null;
}

/**
 * Words → numbered lines with their function, verbs and hero word (the rules; a model may replace any field). A line is
 * a sentence, closed early at a pause over 0.6 s or, once it runs 2.6 s, at a clause word (the effects picker's fxLines),
 * so a 10 s run-on sentence gets a device per clause, not one for all of it.
 */
export function readSentences(words: Word[], r: EditEntry[] = editRegistry()): SentenceRead[] {
  const by = new Map<number, Word[]>(), parts: Word[][] = [];
  let k = 0; for (const l of fxLines(words)) { parts.push(...clauses(words.slice(k, k + l.words.length))); k += l.words.length; }
  parts.forEach((p, i) => by.set(i, p));
  const vocab = new Set(r.flatMap(e => e.verbs).filter(v => !GENERIC.has(v))), out: SentenceRead[] = [];
  [...by.entries()].forEach(([i, ws], n) => {
    const text = ws.map(w => w.word).join(' ');
    let fn: EditFn = FN_RULES.find(([, re]) => re.test(text))?.[0] ?? 'claim';
    if (n === 0 && fn !== 'who' && fn !== 'number') fn = 'hook';
    const verbs = [...new Set(ws.map(w => verbOf(w.word, vocab)).filter((v): v is string => !!v))];
    // the hero: a number, else a named thing (a capital mid-sentence, an acronym), else the longest content word
    const num = ws.find(w => NUM.test(w.word)), named = ws.find((w, k) => k > 0 && (/^[A-Z][a-z]{2,}/.test(w.word) || /^[A-Z]{2,}\W*$/.test(w.word)) && w.word !== 'I');
    const content = ws.filter(w => clean(w.word).length > 2 && !STOP.has(clean(w.word)));
    const h = num ?? named ?? [...content].sort((a, b) => clean(b.word).length - clean(a.word).length)[0] ?? ws[0]!;
    out.push({ i, t0: ws[0]!.t, t1: ws.at(-1)!.end, text, words: ws, fn, verbs, hero: h.word.replace(/[^\p{L}\p{N}%₹$'-]/gu, ''), heroT: h.t });
  });
  return out;
}

/* ───── the cast: the graph's editCast, or the registry in code when the graph is optional ───── */
export interface EditMeta { device: string; layer: EditLayer; face: FaceRule; sfx: SfxKey | null; min: number; max: number; aka: string[]; needs: string[] }
export interface CastRow { id: string; score: number; edit: EditMeta }
export interface CastQuery { fn: EditFn; verbs: string[]; recent: string[]; n: number }
export interface Caster { source: 'graph' | 'registry'; cast: (q: CastQuery) => Promise<CastRow[]> }
const metaOf = (e: EditEntry): EditMeta => ({ device: e.device, layer: e.layer, face: e.face, sfx: e.sfx, min: e.min, max: e.max, aka: e.aka, needs: e.needs ?? [] });

/** The registry in code, ranked exactly like `editCast` (verb hit 3, function hit 2, then the strongest edge, then id). */
export function registryCaster(r: EditEntry[] = editRegistry()): Caster {
  return {
    source: 'registry',
    cast: async q => r.filter(e => e.built && e.auto && !q.recent.includes(assetIdOf(e))).map(e => {
      const fw = e.fns.indexOf(q.fn), vs = q.verbs.map(v => e.verbs.indexOf(v)).filter(x => x >= 0);
      const k = e.rank ?? 0;
      return { e, score: (fw >= 0 ? 2 : 0) + 3 * vs.length, w: Math.min(fw >= 0 ? fw + 1 + k : 99, ...vs.map(x => x + 1 + k)) };
    }).filter(x => x.score > 0).sort((a, b) => b.score - a.score || a.w - b.w || (assetIdOf(a.e) < assetIdOf(b.e) ? -1 : 1)).slice(0, q.n)
      .map(x => ({ id: assetIdOf(x.e), score: x.score, edit: metaOf(x.e) })),
  };
}
/** The craft graph's named query `editCast` (packages/graph queries/library.ts). */
export function graphCaster(timeoutMs = 4000): Caster {
  return {
    source: 'graph',
    cast: async q => (await run<{ id: string; score: number; edit: string }>(CRAFT, L.editCast, { fn: q.fn, verbs: q.verbs, recent: q.recent, built: true, auto: true, n: q.n }, timeoutMs))
      .map(x => ({ id: x.id, score: x.score, edit: JSON.parse(x.edit) as EditMeta })),
  };
}
/** The graph (decision 13: down stops the job); the registry in code only with MOOVI_GRAPH_OPTIONAL=1. */
export async function openCaster(): Promise<Caster> {
  if (graphOptional() && process.env.MOOVI_LIBRARY === 'catalogue') return registryCaster();
  if (await needGraph('edit director: the registry')) return graphCaster();
  return registryCaster();
}

/* ───── chat keywords ───── */
/** A person's ask: put this registry entry on this sentence (a quoted word, a sentence function, or a sentence number). */
export interface Ask { entry: string; on?: string; fn?: EditFn; sentence?: number }
/**
 * "add a crash zoom on 'crore'", "orbit on the hook", "put a checklist on sentence 3", "comment pill at the end":
 * every clause that names a registry entry (or a camera move parseCamera knows) becomes an Ask. Pure.
 */
export function parseAsks(text: string, r: EditEntry[] = editRegistry()): Ask[] {
  const out: Ask[] = [];
  for (const raw of text.split(/[.;\n]|\band then\b|\balso\b/i)) {
    const s = raw.trim(); if (!s) continue;
    const m = s.match(/^(?:please\s+)?(?:add|put|use|give|do|i want|make)?\s*(?:an?\s+|the\s+|some\s+)?(.+?)\s+(?:on|at|for|over|when (?:i|he|she|they) says?)\s+(.+)$/i);
    // a brief's plain words are not asks: a clause asks only with a verb (add / put / use ...) or a quoted word to land on
    // or a place in the edit ('crore', the hook, the end, sentence 3)
    if (!/^(please\s+)?(add|put|use|give|i want)\b/i.test(s) && !/["'“‘][^"'”’]+["'”’]|^(the\s+)?(hook|start|beginning|opening|end|ending|cta|intro|outro)$|^sentence\s+\d+$/i.test(m?.[2]?.trim() ?? '')) continue;
    const what = (m?.[1] ?? s).replace(/^(please\s+)?(add|put|use|give|i want)\s+(an?\s+|the\s+|some\s+)?/i, '').replace(/\b(effect|move|please)\b/gi, '').trim(), where = m?.[2]?.trim() ?? '';
    const e = findEntry(what, r) ?? (() => { const c = parseCamera(what, { scope: 'edit' }); return c.calls[0] ? findEntry(`camera:${c.calls[0].move}`, r) : null; })();
    if (!e) continue;
    const ask: Ask = { entry: e.id };
    const q = where.match(/["'“‘]([^"'”’]+)["'”’]/)?.[1], num = where.match(/sentence\s+(\d+)/i)?.[1];
    if (q) ask.on = q;
    else if (num) ask.sentence = +num - 1;
    else if (/\b(the )?(start|beginning|opening)\b/i.test(where)) ask.fn = 'hook';
    else if (/\b(the )?end(ing)?\b/i.test(where)) ask.sentence = -1;
    else { const fn = where.replace(/^the\s+/i, '').toLowerCase().replace(/[^a-z]/g, ''); if (fn) { if (['hook', 'who', 'what', 'how', 'proof', 'number', 'list', 'name', 'compare', 'cta', 'show', 'claim'].includes(fn)) ask.fn = fn as EditFn; else ask.on = where; } }
    out.push(ask);
  }
  return out;
}

/* ───── one pick per sentence that needs one ───── */
export interface BeatPick { i: number; id: string; meta: EditMeta; why: string; forced?: boolean }
export interface CastOpts {
  asks?: Ask[];
  /** a pick is not reused within this many beats (default 3) */
  recentN?: number;
  /** the brand's own mark (an image url) for the world and the object wipe */
  brandMark?: string | null;
  /** real footage prints are ready (ref-footage) for the desk */
  footage?: boolean;
  /** shortest sentence that may carry a device, seconds (default 0.8) */
  minLen?: number;
  /** the registry (asks resolve against it) */
  registry?: EditEntry[];
}
/** functions strong enough to carry a device without a verb match (a plain claim with no acted verb stays the speaker) */
const STRONG: ReadonlySet<EditFn> = new Set(['hook', 'who', 'number', 'list', 'compare', 'cta', 'what', 'how', 'show', 'proof']);

function feasible(meta: EditMeta, s: SentenceRead, o: CastOpts): string | null {
  for (const n of meta.needs) {
    if (n === 'number' && !numberOf(s.words.map(w => w.word))) return 'no number in the line';
    if (n === 'items' && listItems(s.text).length < 2) return 'not a list';
    if (n === 'brand-object' && !o.brandMark) return 'no brand mark';
    if (n === 'footage' && !o.footage) return 'no footage prints';
    if (n === 'person-mask') return 'needs a person mask';
  }
  if (s.t1 - s.t0 < meta.min * 0.6 && meta.layer !== 'cam' && meta.layer !== 'cut') return 'the sentence is shorter than the device';
  return null;
}

/** Cast every sentence (asks first, then the registry's best feasible match). Deterministic for a deterministic cast. */
export async function castBeats(reads: SentenceRead[], caster: Caster, o: CastOpts = {}): Promise<{ picks: BeatPick[]; missed: { i: number; why: string }[] }> {
  const r = o.registry ?? editRegistry(), picks: BeatPick[] = [], missed: { i: number; why: string }[] = [], recentN = o.recentN ?? 3, minLen = o.minLen ?? 0.8;
  const forced = new Map<number, Ask>();
  for (const a of o.asks ?? []) {
    const i = a.sentence !== undefined ? reads.at(a.sentence)?.i
      : a.on ? reads.find(s => s.words.some(w => clean(w.word) === clean(a.on!)) || s.text.toLowerCase().includes(a.on!.toLowerCase()))?.i
      // "the hook" is the opening line whatever its function (it may read as who, number, ...)
      : a.fn ? (reads.find(s => s.fn === a.fn) ?? (a.fn === 'hook' ? reads[0] : undefined))?.i : reads[0]?.i;
    if (i === undefined) { missed.push({ i: -1, why: `${a.entry}: no sentence matches "${a.on ?? a.fn ?? a.sentence}"` }); continue; }
    forced.set(i, a);
  }
  let lastWorld = -9;
  for (const [n, s] of reads.entries()) {
    const recent = picks.slice(-recentN).map(p => p.id);
    const ask = forced.get(s.i);
    if (ask) {
      const e = r.find(x => x.id === ask.entry || assetIdOf(x) === ask.entry);
      if (!e) { missed.push({ i: s.i, why: `${ask.entry} is not in the registry` }); continue; }
      if (!e.built) { missed.push({ i: s.i, why: `${e.name} is not drawn by the player yet` }); continue; }
      picks.push({ i: s.i, id: assetIdOf(e), meta: metaOf(e), why: `asked${ask.on ? ` on "${ask.on}"` : ''}`, forced: true });
      continue;
    }
    if (s.t1 - s.t0 < minLen) continue;
    const rows = await caster.cast({ fn: s.fn, verbs: s.verbs, recent, n: 8 });
    const verbHit = (x: CastRow) => x.score >= 3;
    let pick: CastRow | null = null, why = '';
    for (const x of rows) {
      if (x.edit.layer === 'cut') continue;   // cuts go between beats (below), never on a sentence
      if (picks.slice(-recentN).some(p => p.meta.device === x.edit.device)) continue;   // a UI row on a recent device is the same look again
      if (!STRONG.has(s.fn) && !verbHit(x)) continue;
      if (x.edit.layer === 'world' && n - lastWorld < 3) continue;   // one full-screen world at a time, never back to back
      const no = feasible(x.edit, s, o); if (no) { why ||= `${x.id}: ${no}`; continue; }
      pick = x; break;
    }
    if (!pick) { if (why) missed.push({ i: s.i, why }); continue; }
    if (pick.edit.layer === 'world') lastWorld = n;
    picks.push({ i: s.i, id: pick.id, meta: pick.edit, why: `${s.fn}${s.verbs.length ? ` / ${s.verbs.join(', ')}` : ''} (score ${pick.score})` });
  }
  // a cut device between two beats where the picture changes world (a world or a framed speaker back to full frame)
  const byI = new Map(picks.map(p => [p.i, p]));
  for (const [n, s] of reads.entries()) {
    if (!n || byI.has(s.i)) continue;
    const prev = byI.get(reads[n - 1]!.i);
    if (!prev || !(prev.meta.layer === 'world' || /^cam\.(form|phone|pullback)/.test(prev.meta.device))) continue;
    const rows = await caster.cast({ fn: 'transition', verbs: s.verbs, recent: picks.slice(-recentN).map(p => p.id), n: 8 });
    const x = rows.find(c => (c.edit.layer === 'light' || c.edit.layer === 'cut') && !feasible(c.edit, s, o));
    if (x) picks.push({ i: s.i, id: x.id, meta: x.edit, why: 'back to the speaker after a world' });
  }
  picks.sort((a, b) => a.i - b.i);
  return { picks, missed };
}

/* ───── the beat spec (docs/agents/mastery/edit.md) ───── */
export interface Anchor { w: string; after?: number; n?: number; dt?: number; end?: boolean }
export interface SpecLayer { t: string; [k: string]: unknown }
export interface SpecBeat { from: Anchor; i: number; fn: EditFn; hero: string; pick: string | null; layers: SpecLayer[] }
export interface BeatSpec { version: 1; beats: SpecBeat[]; sfx: { at: Anchor; k: SfxKey; g: number }[]; picks: { i: number; id: string; why: string }[] }
export interface SpecOpts { brandMark?: string | null; /** source seconds of two contrasting stills for `sides` and `compare` */ stills?: number[]; /** the clip's spoken span (source seconds), for stills across it */ span?: [number, number] }

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
/** a word anchor: the first match of the word at or after the sentence's start (source seconds) */
const anchor = (w: Word, s: SentenceRead, dt = 0): Anchor => ({ w: norm(w.word) || w.word, after: +(s.t0 - 0.01).toFixed(3), ...(dt ? { dt } : {}) });
const heroWord = (s: SentenceRead) => s.words.find(w => Math.abs(w.t - s.heroT) < 1e-6) ?? s.words[0]!;
const r3 = (x: number) => +x.toFixed(3);

/** a footage camera move sampled into relative keys [dt, scale, cx, cy, roll] (the camera layer's own curve) */
export function camKeys(move: string, dur?: number, rate = 15): number[][] {
  const call = { move, ...(dur ? { duration: dur } : {}) }, d = resolveCall(call).duration, n = Math.max(2, Math.ceil(d * rate));
  return Array.from({ length: n + 1 }, (_, k) => { const t = d * k / n, f = frame2d(cameraTrack([call], t)); return [r3(t), r3(f.scale || 1), r3(f.cx), r3(f.cy), r3(f.roll)]; });
}

/** n stills spread across the spoken span (the clip's own moments, for orbit and the timeline) */
const across = (o: SpecOpts, n: number) => { const [a, b] = o.span ?? [0, 10]; return Array.from({ length: n }, (_, k) => r3(a + (b - a) * (0.08 + 0.84 * k / Math.max(1, n - 1)))); };

/** One pick → its layers and sounds. Positions are the mastery player's (1080 x 1920 design px); text moves clear of faces at draw time. */
function layersOf(p: BeatPick, s: SentenceRead, o: SpecOpts): { layers: SpecLayer[]; sfx: { at: Anchor; k: SfxKey }[] } {
  const h = heroWord(s), hA = anchor(h, s), first = anchor(s.words[0]!, s), last = anchor(s.words.at(-1)!, s, 0);
  const dev = p.meta.device, snd = (at: Anchor, k: SfxKey | null = p.meta.sfx) => (k ? [{ at, k }] : []);
  const HERO = s.hero.toUpperCase();
  if (dev === 'cam.punch') return { layers: [{ t: 'cam', z: 1.04, Y: 0.36, punch: hA, by: 1.08 }], sfx: snd(hA) };
  if (dev === 'cam.dim') return { layers: [{ t: 'cam', z: 1.06, Y: 0.36, dim: 0.45, focus: true }], sfx: snd(first) };
  if (dev === 'cam.form') return { layers: [{ t: 'cam', form: 'card', z: 1.04 }], sfx: snd(first) };
  if (dev === 'cam.phone') return { layers: [{ t: 'cam', form: 'phone', z: 1.04 }], sfx: snd(first) };
  if (dev === 'cam.pullback') return { layers: [{ t: 'cam', form: 'window', z: 1.04 }], sfx: snd(first) };
  if (dev.startsWith('cam.move:')) { const move = dev.slice(9), dur = Math.min(p.meta.max, Math.max(p.meta.min, s.t1 - h.t)); return { layers: [{ t: 'cam', z: 1.04, Y: 0.36, move, at: hA, keys: camKeys(move, dur) }], sfx: snd(hA) }; }
  if (dev.startsWith('cut.')) return { layers: [{ t: 'cut', type: dev.slice(4), at: first, dur: p.meta.min }], sfx: snd(first) };
  // a UI row drawn as one of the insert step's cards (notify, comment, title): lowered onto the EDL's inserts
  if (dev.startsWith('ui.')) return { layers: [{ t: 'ui', draw: dev.slice(3), asset: p.id, at: first, dur: Math.min(p.meta.max, Math.max(p.meta.min, s.t1 - s.t0)) }], sfx: snd(first) };
  if (dev.startsWith('x1.')) return { layers: [{ t: 'x1', n: dev.slice(3), at: first, dur: Math.min(p.meta.max, Math.max(p.meta.min, s.t1 - s.t0)) }], sfx: [] };
  switch (dev) {
    case 'orbit': return { layers: [{ t: 'orbit', stills: across(o, 5), at: first }], sfx: snd(first) };
    case 'freeze': {
      const keys = s.words.filter(w => clean(w.word).length > 3 && !STOP.has(clean(w.word)) && w !== h).slice(0, 1);
      return { layers: [{ t: 'freeze', still: r3(h.t), at: hA, labels: [{ text: s.hero }, ...keys.map(w => ({ text: w.word.replace(/[^\p{L}\p{N}%₹$'-]/gu, '') }))] }], sfx: snd(hA) };
    }
    case 'strike': {
      const items = listItems(s.text).slice(0, 3), tags = items.length >= 2 ? items : s.words.filter((w, k) => k > 0 && /^[A-Z]/.test(w.word) && w.word !== 'I').slice(0, 3).map(w => w.word.replace(/[^\p{L}\p{N}'-]/gu, ''));
      return { layers: [{ t: 'strike', tags, at: first, y: 300 }], sfx: tags.map(() => ({ at: first, k: 'pop' as SfxKey })) };
    }
    case 'timeline': return { layers: [{ t: 'timeline', stills: across(o, 4), at: first, y: 1480 }], sfx: snd(first) };
    case 'leak': return { layers: [{ t: 'leak', at: first }], sfx: snd(first) };
    case 'wipe': return { layers: [{ t: 'wipe', src: o.brandMark, at: first, dur: 0.45 }], sfx: snd(first) };
    case 'stat': {
      const v = numberOf(s.words.map(w => w.word)), to = Number(String(v?.value ?? '').replace(/[^\d.]/g, '')) || 0;
      return { layers: [{ t: 'stat', from: 0, to, label: v?.unit ?? '', splitAt: hA, toAt: anchor(h, s, 0.6), y: 300 }], sfx: [...snd(hA), { at: anchor(h, s, 0.6), k: 'drop' }] };
    }
    case 'cascade': {
      const items = listItems(s.text).slice(0, 4);
      const at = (it: string) => { const fw = norm(it.split(/\s+/)[0] ?? ''); const w = s.words.find(x => norm(x.word) === fw) ?? s.words[0]!; return anchor(w, s); };
      return { layers: [{ t: 'cascade', items: items.map(it => ({ title: it, at: at(it) })), y: 260 }], sfx: items.map(it => ({ at: at(it), k: 'pop' as SfxKey })) };
    }
    case 'tag': {
      const k = s.words.findIndex(w => /^[A-Z]/.test(w.word) && w.word !== 'I' && s.words.indexOf(w) > 0);
      const name = k >= 0 ? s.words.slice(k, k + 2).filter(w => /^[A-Z]/.test(w.word)).map(w => w.word.replace(/[^\p{L}'-]/gu, '')).join(' ') : HERO;
      return { layers: [{ t: 'tag', name, role: '', at: k >= 0 ? anchor(s.words[k]!, s) : first, hold: Math.min(3, Math.max(1.4, s.t1 - s.t0)), y: 1160 }], sfx: snd(k >= 0 ? anchor(s.words[k]!, s) : first) };
    }
    case 'letters': return { layers: [{ t: 'letters', items: [{ ch: HERO, at: hA, x: 90, y: 260, size: Math.min(420, Math.round(1500 / Math.max(2, HERO.length))), r: 6 }] }], sfx: snd(hA) };
    case 'pill': return { layers: [{ t: 'pill', keyword: HERO, at: hA, y: 1180 }], sfx: snd(first) };
    case 'input': return { layers: [{ t: 'input', typed: s.words.slice(0, 9).map(w => w.word).join(' ').replace(/[.!?]$/, ''), from: first, to: last, y: 860 }], sfx: snd(first) };
    case 'burn': {
      const ws = s.words.filter(w => clean(w.word).length > 3 && !STOP.has(clean(w.word))).slice(0, 3);
      return { layers: [{ t: 'burn', items: ws.map((w, k) => ({ kind: 'glass', text: w.word.replace(/[^\p{L}\p{N}%₹$'-]/gu, ''), at: anchor(w, s), x: 120 + k * 260, y: 1380 + (k % 2) * 60, r: [-6, 4, 8][k] })) }], sfx: ws.map(w => ({ at: anchor(w, s), k: 'pop' as SfxKey })) };
    }
    case 'filters': return { layers: [{ t: 'filters', at: hA, y: 1560 }], sfx: snd(hA) };
    case 'compare': return { layers: [{ t: 'cam', form: 'split', z: 1.04 }, { t: 'compare', still: r3(o.stills?.[0] ?? s.t0 + 0.2), labels: ['before', 'after'], look: 'saturate(1.25) contrast(1.08)', at: first, at2: hA, y: 120 }], sfx: [...snd(first), ...snd(hA)] };
    case 'sides': return { layers: [{ t: 'sides', stills: (o.stills ?? [s.t0, s.t1]).slice(0, 2).map(r3), at: hA, y: 300 }], sfx: snd(hA) };
    case 'mg': {
      const chars = HERO.replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'A';
      return { layers: [{ t: 'cam', form: 'corner-br', z: 1.04 }, { t: 'mg', chars, gap: Math.min(250, Math.round(960 / chars.length)), area: [0, 0, 1080, 960], row: 0.52, dimOthers: true, lit: [...chars].map((ch, k) => ({ ch, at: anchor(h, s, +(k * 0.08).toFixed(2)) })) }], sfx: snd(first) };
    }
    default: return { layers: [], sfx: [] };
  }
}

/** The beat spec from the reads and the picks. Pure: the same reads and picks give the same spec. */
export function beatSpecOf(reads: SentenceRead[], picks: BeatPick[], o: SpecOpts = {}): BeatSpec {
  const byI = new Map(picks.map(p => [p.i, p])), beats: SpecBeat[] = [], sfx: BeatSpec['sfx'] = [];
  if (!o.span && reads.length) o = { ...o, span: [reads[0]!.t0, reads.at(-1)!.t1] };
  for (const s of reads) {
    const p = byI.get(s.i), l = p ? layersOf(p, s, o) : { layers: [], sfx: [] };
    beats.push({ from: anchor(s.words[0]!, s), i: s.i, fn: s.fn, hero: s.hero, pick: p?.id ?? null, layers: l.layers });
    for (const x of l.sfx) sfx.push({ at: x.at, k: x.k, g: 0.4 });
  }
  return { version: 1, beats, sfx, picks: picks.map(p => ({ i: p.i, id: p.id, why: p.why })) };
}

/** The director in one call: read, cast (graph), write. */
export async function directBeats(words: Word[], o: CastOpts & SpecOpts & { caster?: Caster; askText?: string } = {}) {
  const r = o.registry ?? editRegistry(), reads = readSentences(words, r), caster = o.caster ?? await openCaster();
  const asks = [...(o.asks ?? []), ...(o.askText ? parseAsks(o.askText, r) : [])];
  const { picks, missed } = await castBeats(reads, caster, { ...o, asks, registry: r });
  return { spec: beatSpecOf(reads, picks, o), reads, picks, missed, source: caster.source };
}
