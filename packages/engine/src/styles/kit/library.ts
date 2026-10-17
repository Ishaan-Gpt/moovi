/**
 * A style is a visual LANGUAGE, not a template. Its laws (world, type, motion, sound, rhythm) never change; what a
 * film shows is cast, beat by beat, from the style's LIBRARY: many set-ups, each tagged with the needs it serves
 * (./needs.ts). When nothing in the library serves a beat well, the style IMPROVISES a new set-up in its own grammar
 * (./compose.ts), and a good improvised set-up is saved back into the library, so the library grows with use.
 *
 * Casting is deterministic and model-free: needs overlap + slot fit (items, number, words, seconds) + role fit −
 * repeats (in this film, and in this style's recent films) + a small per-film jitter. A model may add HINTS (set-up
 * ids it would pick); a hint is a bonus, never a requirement, so a weak model can only help.
 */
import { createHash } from 'node:crypto';
import { ensureStylesSchema, graphOr, run, STYLES, styles as G } from '@moovi/graph';
import type { Need } from './needs';

export type Role = 'open' | 'middle' | 'close';

export interface Setup {
  /** unique inside the style, e.g. "dial", "split-compare", "gen-7f3a" */
  id: string;
  /** a short name for logs and the model's catalog */
  name: string;
  /** one line: what it pictures (the model reads this) */
  about: string;
  /** the needs it serves, strongest first */
  needs: Need[];
  /** set-ups of one family never stand back to back (e.g. every list device is family "list") */
  family: string;
  /** where in a film it belongs (default: anywhere but the end card) */
  roles?: Role[];
  /** how many spoken items it shows [min, max] (lists); absent = it shows none */
  items?: [number, number];
  /** a spoken number: it needs one, can use one, or never shows one */
  number?: 'required' | 'optional';
  /** the beat length it is good for, in seconds */
  seconds?: [number, number];
  /** how many spoken words it carries well */
  words?: [number, number];
  /** a base preference (1 = normal); signature set-ups of the style weigh a little more */
  weight?: number;
  /** pure type, no picture: a style caps how many of these a film has */
  typeOnly?: boolean;
  /** improvised and saved (./compose.ts): its spec plays through the style's composer */
  generated?: { spec: unknown; model: string; created: string; uses: number };
}

/** One beat as the matcher sees it. */
export interface BeatIn {
  index: number;
  text: string;
  words: number;
  seconds: number;
  needs: Need[];
  /** spoken list items in it */
  items: number;
  number: number | null;
  role: Role;
  /** set-up ids a model suggested (a bonus) */
  hints?: string[];
}

export interface Cast { setup: Setup | null; score: number; why: string }

export interface CastOptions {
  /** e.g. the film id: the same film casts the same way; another film differently */
  seed: string;
  /** set-up ids used by this style's recent films (penalised so two films never look alike) */
  recent?: string[];
  /** a beat whose best score is below this is improvised */
  floor?: number;
  /** max share of type-only set-ups (0..1) */
  typeShare?: number;
  /** how many times one set-up may appear in one film */
  maxUse?: number;
}

const rand = (seed: string) => { const h = createHash('sha1').update(seed).digest(); return h.readUInt32BE(0) / 2 ** 32; };

/** How well one set-up serves one beat (no history). */
export function fit(s: Setup, b: BeatIn): { score: number; why: string[] } {
  const why: string[] = [];
  let score = 0;
  // needs: the beat's first needs matter most; the set-up's first needs too
  b.needs.forEach((n, i) => { const k = s.needs.indexOf(n); if (k >= 0) { const w = (i < 2 ? 3 : 2) - Math.min(1.2, k * 0.3); score += w; why.push(n); } });
  if (s.roles) { if (s.roles.includes(b.role)) { score += 1.5; why.push(`role:${b.role}`); } else score -= 4; }
  if (s.items) { const [lo, hi] = s.items; if (b.items >= lo && b.items <= hi) { score += 2.5; why.push(`items:${b.items}`); } else if (b.items < lo) score -= 5; else score -= 1; }
  if (s.number === 'required') { if (b.number == null) score -= 8; else { score += 2.5; why.push('number'); } }
  else if (s.number === 'optional' && b.number != null) { score += 1; why.push('number'); }
  if (s.seconds) { const [lo, hi] = s.seconds; if (b.seconds < lo) score -= (lo - b.seconds) * 1.5; if (b.seconds > hi) score -= (b.seconds - hi) * 1.2; }
  if (s.words) { const [lo, hi] = s.words; if (b.words < lo) score -= (lo - b.words) * 0.5; if (b.words > hi) score -= (b.words - hi) * 0.4; }
  if (b.hints?.includes(s.id)) { score += 2; why.push('hint'); }
  score *= s.weight ?? 1;
  return { score, why };
}

/**
 * Cast every beat. Greedy in order with variety rules: never the same family twice in a row, one set-up at most
 * `maxUse` times, type-only set-ups capped, recent films' set-ups penalised, a per-film jitter so two films with
 * similar scripts still differ. A beat below `floor` gets setup = null: the caller improvises it.
 */
export function cast(beats: BeatIn[], lib: Setup[], o: CastOptions): Cast[] {
  const floor = o.floor ?? 2.5, maxUse = o.maxUse ?? 1, typeCap = Math.max(1, Math.round(beats.length * (o.typeShare ?? 0.3)));
  const used = new Map<string, number>(), recent = new Map<string, number>();
  (o.recent ?? []).forEach((id, i, a) => recent.set(id, Math.max(recent.get(id) ?? 0, 1 - i / Math.max(1, a.length))));
  let typeN = 0, prevFam = '';
  return beats.map(b => {
    let best: Cast = { setup: null, score: -Infinity, why: 'nothing fits' };
    for (const s of lib) {
      if (s.family === prevFam) continue;
      if ((used.get(s.id) ?? 0) >= maxUse) continue;
      if (s.typeOnly && typeN >= typeCap) continue;
      const f = fit(s, b);
      let score = f.score;
      score -= (recent.get(s.id) ?? 0) * 2.5; // a set-up a recent film used gives way
      score -= (used.get(s.id) ?? 0) * 3;
      score += rand(`${o.seed}:${b.index}:${s.id}`) * 1.6; // per-film jitter: two films never cast identically
      if (score > best.score) best = { setup: s, score, why: f.why.join(' ') || 'filler' };
    }
    if (!best.setup || best.score < floor) return { setup: null, score: best.score, why: `improvise (best ${best.setup?.id ?? '-'} ${best.score.toFixed(1)})` };
    used.set(best.setup.id, (used.get(best.setup.id) ?? 0) + 1);
    if (best.setup.typeOnly) typeN++;
    prevFam = best.setup.family;
    return best;
  });
}

/* ───────── per-style memory, in FalkorDB (the `styles` graph, packages/graph/src/queries/styles.ts) ─────────
 * A style run loads its memory from the graph when it starts (loadMemory: the latest films with their set-ups, arcs
 * and sites; the kept improvisations; PageRank over set-ups cast back to back) and writes its film back when it ends
 * (flushMemory). Readers in between are synchronous and read that snapshot. FalkorDB down = the run stops loudly
 * (MemoryDown): a style never silently forgets what it made.
 */
export interface FilmMemory { id: string; at: number; arc: string | null; site: string | null; setups: string[] }
interface Snapshot { films: FilmMemory[]; grown: Setup[]; hot: string[] }
const snaps = new Map<string, Snapshot>();
const pending: Promise<unknown>[] = [];
const snap = (style: string): Snapshot => snaps.get(style) ?? { films: [], grown: [], hot: [] };

/** Read a style's memory from FalkorDB (call at the start of every run). */
export async function loadMemory(style: string, n = 40): Promise<Snapshot> {
  await ensureStyles();
  const [films, kept, hot] = await Promise.all([
    run<FilmMemory>(STYLES, G.recentFilms, { style, n }),
    run<{ id: string; data: string; uses: number }>(STYLES, G.grownSetups, { style }),
    run<{ id: string; score: number }>(STYLES, G.overUsed, { style, n: 6 }).catch(graphOr([], 'style memory: PageRank')), // an empty graph has no ranks yet
  ]);
  const s: Snapshot = {
    films: films.map(f => ({ ...f, setups: (f.setups ?? []).filter(Boolean) })),
    grown: kept.flatMap(k => { try { const x = JSON.parse(k.data) as Setup; return [{ ...x, id: k.id, generated: x.generated ? { ...x.generated, uses: k.uses ?? 0 } : x.generated }]; } catch { return []; } }),
    hot: hot.map(h => h.id),
  };
  snaps.set(style, s);
  return s;
}
/** Wait for every write this process queued (call at the end of a run; throws if FalkorDB refused one). */
export async function flushMemory() { const all = pending.splice(0); await Promise.all(all); }
let ensured: Promise<void> | null = null;
const ensureStyles = () => (ensured ??= ensureStylesSchema(STYLES).catch(e => { ensured = null; throw e; }));

/**
 * Set-up ids to give a rest, newest first: those of this style's last `films` films, then the ones PageRank says the
 * style leans on most (the graph's over-use penalty).
 */
export function recentSetups(style: string, films = 3): string[] {
  const s = snap(style);
  return [...new Set([...s.films.slice(0, films).flatMap(x => x.setups), ...s.hot])];
}
/** Arcs this style used lately, newest first (films without an arc, e.g. own scripts, don't take a slot). */
export function recentArcs(style: string, films = 4): string[] {
  return snap(style).films.filter(x => x.arc).slice(0, films).map(x => x.arc!);
}
/** This site's own earlier films in this style, newest first: a site seen again never gets the same film. */
export function siteFilms(style: string, host: string, films = 3): FilmMemory[] {
  const h = siteHost(host);
  return snap(style).films.filter(x => x.site === h).slice(0, films);
}
/** "https://www.cal.com/pricing" → "cal.com" (a site is its host, without www) */
export const siteHost = (s: string) => s.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[/?#].*$/, '');
/** Remember what a film used: its set-ups beat by beat, its arc, its site (the next film is cast away from it). */
export function remember(style: string, film: { id: string; setups: string[]; arc?: string; site?: string; project?: string }) {
  const setups = film.setups.filter(Boolean), at = Date.now(), host = film.site ? siteHost(film.site) : undefined;
  snap(style).films.unshift({ id: film.id, at, arc: film.arc ?? null, site: host ?? null, setups });
  if (!snaps.has(style)) snaps.set(style, snap(style));
  pending.push((async () => {
    await ensureStyles();
    await run(STYLES, G.rememberFilm, { style, id: film.id, at, project: film.project ?? null, setups });
    if (film.arc) await run(STYLES, G.filmArc, { id: film.id, arc: film.arc });
    if (host) await run(STYLES, G.filmSite, { id: film.id, host });
    if (setups.length > 1) await run(STYLES, G.coCast, { style, id: film.id, setups });
  })());
}

/** The style's improvised set-ups that were kept (they join the library for every later film). */
export function grown(style: string): Setup[] { return snap(style).grown; }
/** Keep an improvised set-up in the graph (deduped by its spec); returns its id. */
export function grow(style: string, s: Omit<Setup, 'id'> & { id?: string }): string {
  const sig = createHash('sha1').update(JSON.stringify(s.generated?.spec ?? s.about)).digest('hex').slice(0, 8), id = `gen-${sig}`;
  const mine = snap(style); if (!snaps.has(style)) snaps.set(style, mine);
  const hit = mine.grown.find(x => x.id === id);
  if (hit) { if (hit.generated) hit.generated.uses++; return id; }
  const setup = { ...s, id, family: s.family || 'generated' } as Setup;
  mine.grown.push(setup);
  pending.push((async () => { await ensureStyles(); await run(STYLES, G.growSetup, { style, id, data: JSON.stringify(setup), about: setup.about, family: setup.family, at: Date.now() }); })());
  return id;
}

/** The catalog a model reads: one line per set-up (id: name, needs, what it is). Short on purpose. */
export function catalog(lib: Setup[], max = 80): string {
  return lib.slice(0, max).map(s => `${s.id}: ${s.about} [${s.needs.slice(0, 4).join(', ')}]${s.items ? ` (${s.items[0]}-${s.items[1]} items)` : ''}${s.number === 'required' ? ' (needs a spoken number)' : ''}`).join('\n');
}

/** Library sanity for tests and the style's own check: unique ids, every need real, families set. */
export function libraryErrors(lib: Setup[]): string[] {
  const errs: string[] = [], seen = new Set<string>();
  for (const s of lib) {
    if (seen.has(s.id)) errs.push(`duplicate id ${s.id}`); seen.add(s.id);
    if (!s.needs.length) errs.push(`${s.id}: no needs`);
    if (!s.family) errs.push(`${s.id}: no family`);
  }
  return errs;
}
