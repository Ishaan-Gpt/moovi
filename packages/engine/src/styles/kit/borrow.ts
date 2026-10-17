/**
 * Borrowing from the library. A style casts every beat from its OWN set-ups (./library.ts cast()); where its best
 * match is weak (improvised, or a low score), it asks the shared library graph for a piece it can also play: the
 * craft graph's `assetsServing` (category `ui`, runtime `visual`: the visual renderer's 2D cards, charts and icon
 * badges, which any live player draws with the same canvas code, ./liblayer.ts). The piece is an INSERT on that
 * beat: it lands on the beat's first word, carries the beat's own words or numbers, and leaves before the cut. The
 * style's own set-up still plays; the insert adds what it could not show (a number counting, a checklist ticking).
 *
 * Rules: at most one insert in three beats, never two beats running, never on the end card, never the same piece
 * twice in a film; a piece that wants numbers or a list only goes where the line says them. The film's dir gets
 * library.json (the inserts and the palette); the style-reel job stores each one in the project graph as
 * (Scene)-[:USES_ARTIFACT {slot: 'library'}]->(Artifact), the visual renderer's own record.
 */
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { castSounds } from '../../audio/sounds';
import { config } from '../../config';
import { CRAFT, library as L, project as P, requireGraph, run } from '@moovi/graph';
import { byId, type Artifact } from '../../visual/artifacts';
import { contentFor, numbersOf } from '../../visual/plan';
import type { Content } from '../../visual/types';
import { kitInsertPalette } from './kits';
import { listItems, type Need } from './needs';

/** what the live players can draw (./liblayer.ts): the 2D artifacts; devices, clips and 3D need the visual renderer */
export const DRAWABLE_KINDS = ['card', 'chart', 'icon'] as const;
const ASPECT: Record<string, number> = {
  'card:stat': 1.15, 'card:list': 1.0, 'card:notif': 1.25, 'card:chat': 1.0, 'card:quote': 1.2, 'card:reviews': 1.4, 'card:chips': 2.2, 'card:toggles': 1.15, 'card:price': 0.92, 'card:timeline': 0.95,
  'chart:bars': 1.3, 'chart:line': 1.4, 'chart:donut': 1.0, 'chart:counter': 1.7, 'chart:versus': 1.2, 'chart:ring': 1.0,
};

export interface BorrowBeat {
  index: number; t0: number; t1: number; text: string; needs: Need[];
  /** the style's own cast was weak here (improvised, or a low score) */
  weak: boolean;
  /** the end card, a title card: never an insert */
  locked?: boolean;
  /** the style's own cast score (lower = weaker; the weakest beats choose first) */
  score?: number;
  /** where the style leaves room on this beat (the player places the insert there) */
  room?: 'top' | 'bottom';
}

export interface Borrowed {
  beat: number; at: number; end: number;
  /** the library asset (craft graph) and the visual artifact it draws */
  asset: string; art: string; kind: string; name: string;
  /** how many of the beat's needs it serves (graph) */
  hits: number; needs: Need[];
  aspect: number; room: 'top' | 'bottom'; side: 'left' | 'right'; tilt: number;
  /** an icon badge's glyph */
  glyph?: string;
  content: Content;
}

export interface BorrowResult { inserts: Borrowed[]; asked: number; ms: number; why?: string; /** per weak beat without an insert: why not */ skipped?: string[] }

interface Row { id: string; name: string; runtime: string[]; params: string | null; hits: number }
/** numbers a line says, in digits or in words ("twelve tabs" counts) */
const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
const TENS: Record<string, number> = { thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100, thousand: 1000 };
export const saidNumbers = (text: string): number[] => {
  const d = numbersOf(text); if (d.length) return d;
  return text.toLowerCase().split(/[^a-z]+/).flatMap(w => (w === 'one' ? [] : WORDS.includes(w) ? [WORDS.indexOf(w)] : TENS[w] ? [TENS[w]!] : [])); // "one place" is not a number
};
/** how many spoken numbers a numbers piece needs (one unless it compares) */
const NUMBERS: Record<string, number> = { 'chart:versus': 2, 'chart:bars': 2, 'chart:line': 2 };

/** "Every task knows its owner, its deadline" → title "Every task knows", items "its owner", "its deadline" */
function tidy(c: Content, said: string[] = []): Content {
  let it = said.length >= 2 ? said : c.items ?? []; if (it.length < 2) return c;
  // the last item ends where the sentence goes on ("chat threads never agree" → "chat threads")
  const lw = it.at(-1)!.split(/\s+/), keep = Math.max(2, it.at(-2)!.split(/\s+/).length + 1);
  if (lw.length > keep) it = [...it.slice(0, -1), lw.slice(0, keep).join(' ')];
  const w0 = it[0]!.split(/\s+/), n = it[1]!.split(/\s+/).length;
  if (w0.length >= n + 2) return { ...c, title: w0.slice(0, w0.length - n).join(' ').replace(/[,:;]$/, ''), items: [w0.slice(-n).join(' '), ...it.slice(1)] };
  return { ...c, items: it };
}
const h01 = (s: string) => createHash('sha1').update(s).digest().readUInt32BE(0) / 2 ** 32;
const artOf = (r: Row & { impl?: string | null }): Artifact | undefined => { try { const v = (JSON.parse(r.impl ?? '{}') as { visual?: string }).visual; return v ? byId(v) : undefined; } catch { return undefined; } };

/** Ask the library graph for an insert on each weak beat (one query per weak beat, in parallel). */
export async function borrow(beats: BorrowBeat[], o: { seed: string; share?: number; minHits?: number; timeoutMs?: number }): Promise<BorrowResult> {
  const t0 = performance.now(), cap = Math.max(1, Math.round(beats.length * (o.share ?? 0.34)));
  // the opening beat is the style's hook and stays its own
  const asks = beats.filter(b => b.weak && !b.locked && b.index > 0 && b.needs.length && b.t1 - b.t0 >= 1.6);
  if (!asks.length) return { inserts: [], asked: 0, ms: 0 };
  let rows: (Row & { impl?: string | null })[][];
  try {
    rows = await Promise.all(asks.map(b => run<Row & { impl?: string | null }>(CRAFT, L.assetsServing, { needs: b.needs.slice(0, 5), category: 'ui', runtime: 'visual', shipOnly: true, n: 24 }, o.timeoutMs ?? 4000)));
  } catch (e) {
    requireGraph(e, 'library inserts: borrowing'); // decision 13
    return { inserts: [], asked: asks.length, ms: Math.round(performance.now() - t0), why: `FalkorDB did not answer (${String(e instanceof Error ? e.message : e).slice(0, 100)})` };
  }
  // the graph ranks each beat's pieces; the weakest beats choose first; the film's seed breaks ties so two films borrow differently
  const order = asks.map((b, k) => ({ b, k })).sort((x, y) => (x.b.score ?? 0) - (y.b.score ?? 0) || x.b.index - y.b.index);
  const used = new Set<string>(), taken = new Set<number>(), out: Borrowed[] = [], skipped: string[] = [];
  for (const { b, k } of order) {
    if (out.length >= cap) { skipped.push(`beat ${b.index + 1}: the film has its ${cap} insert(s)`); continue; }
    if (taken.has(b.index - 1) || taken.has(b.index + 1)) { skipped.push(`beat ${b.index + 1}: next to an insert`); continue; }
    const nums = saidNumbers(b.text);
    const ok = rows[k]!.map(r => ({ r, a: artOf(r) })).filter(({ r, a }) => {
      if (!a || !(DRAWABLE_KINDS as readonly string[]).includes(a.kind) || used.has(a.id)) return false;
      // a piece is cast for what it is FOR: the beat must share one of its two main needs (chat bubbles are voices or a quote, not just people)
      if (!a.needs.slice(0, 2).some(n => b.needs.includes(n))) return false;
      if (a.kind !== 'icon' && !ASPECT[a.id]) return false;
      // one shared need is enough when the line itself carries what the piece shows (its numbers, its items);
      // an icon badge says nothing on its own: two shared needs, its own first meaning among them, one icon a film
      if (r.hits < (a.kind === 'icon' ? Math.min(2, b.needs.length) : o.minHits ?? 1)) return false;
      if (a.kind === 'icon' && (!b.needs.includes(a.needs[0]!) || out.some(x => x.kind === 'icon'))) return false;
      // never a made-up figure: a piece shows only what the line says (versus bars need both sides, a ring a percent)
      if (a.wants === 'numbers' && nums.length < (NUMBERS[a.id] ?? 1)) return false;
      if ((a.id === 'chart:ring' || a.id === 'chart:donut') && !/%|percent/i.test(b.text)) return false;
      if ((a.id === 'card:reviews' || a.id === 'card:quote') && !b.needs.includes('quote')) return false; // no praise nobody said
      if (a.id === 'card:price' && !/[$€£₹]|price|per (month|year)/i.test(b.text)) return false;
      // a list piece needs a spoken list (its items), never a sentence cut into fragments
      if ((a.wants === 'list' || a.id === 'card:chips') && listItems(b.text).length < (a.id === 'card:chips' ? 3 : 2)) return false;
      return !['image', 'clip', 'photo'].includes(a.wants);
    });
    if (!ok.length) { skipped.push(`beat ${b.index + 1} [${b.needs.join(',')}]: ${rows[k]!.length} served, none playable here (${rows[k]!.slice(0, 4).map(r => `${artOf(r)?.id ?? r.id}:${r.hits}`).join(' ') || 'none'})`); continue; }
    const top = ok.filter(x => x.r.hits === ok[0]!.r.hits);
    const { r, a } = top[Math.floor(h01(`${o.seed}:${b.index}`) * top.length)]!;
    used.add(a!.id); taken.add(b.index);
    const lead = Math.min(0.25, (b.t1 - b.t0) * 0.08);
    out.push({
      beat: b.index, at: +(b.t0 + lead).toFixed(3), end: +(b.t1 - 0.12).toFixed(3), asset: r.id, art: a!.id, kind: a!.kind, name: a!.name, hits: r.hits,
      needs: b.needs.filter(n => a!.needs.includes(n)), aspect: a!.kind === 'icon' ? 1 : ASPECT[a!.id]!, room: b.room ?? 'top',
      side: h01(`${o.seed}:side:${b.index}`) < 0.5 ? 'left' : 'right', tilt: +((h01(`${o.seed}:tilt:${b.index}`) - 0.5) * 5).toFixed(2),
      content: tidy(contentFor(a!, b.text, nums, {}, 'main', 0, null), a!.wants === 'list' || a!.id === 'card:chips' ? listItems(b.text) : []), ...(a!.glyph ? { glyph: a!.glyph } : {}),
    });
  }
  out.sort((x, y) => x.beat - y.beat);
  return { inserts: out, asked: asks.length, ms: Math.round(performance.now() - t0), ...(skipped.length ? { skipped } : {}) };
}


/** Where a beat leaves room: away from its type (a lock at the top → the insert goes low). */
export const roomOf = (locks?: { pos?: string }[]): 'top' | 'bottom' => (locks ?? []).some(l => /top|high|upper/.test(l.pos ?? '')) ? 'bottom' : 'top';

export const libraryFile = (dir: string) => join(dir, 'library.json');

/** library.json: what the player plays (inserts, the style's palette and type) and what the reel job records. */
export interface InsertLook { palette?: Record<string, string | boolean>; font?: Record<string, string>; kit?: string; sound?: { file: string; asset: string; gain: number } }

async function popSound(dir: string): Promise<InsertLook['sound'] | null> {
  const cast = await castSounds([{ t: 0, event: 'pop' }]), key = cast.map.events.pop?.sounds[0], spec = key ? cast.map.sounds[key] : undefined;
  if (!spec) return null;
  const src = resolve(join(config.assets, 'sfx'), spec.file);
  if (!existsSync(src)) return null;
  copyFileSync(src, join(dir, 'lib-pop.wav'));
  return { file: '/v/lib-pop.wav', asset: cast.asset[key!] ?? key!, gain: 0.42 };
}

/** The style's own look for its inserts, unless Auto matched a kit: then the kit's palette roles (the style's type stays). */
export const lookFor = (own: InsertLook, kit?: { id: string; palette: Record<string, string> }): InsertLook => (kit ? { ...own, palette: kitInsertPalette(kit.palette), kit: kit.id } : own);

export function writeLibrary(dir: string, style: string, r: BorrowResult, look: InsertLook = {}) {
  writeFileSync(libraryFile(dir), JSON.stringify({ style, ...look, asked: r.asked, ms: r.ms, ...(r.why ? { why: r.why } : {}), inserts: r.inserts }, null, 1));
}

/**
 * A style's whole borrowing step: ask, write library.json (or remove a stale one), log one line per insert.
 * MOOVI_LIBRARY_CAST=0 turns it off (the style plays only its own set-ups, as before).
 */
export async function borrowFor(style: string, dir: string, beats: BorrowBeat[], seed: string, look: Parameters<typeof writeLibrary>[3], log: (s: string) => void = () => {}): Promise<BorrowResult> {
  if (process.env.MOOVI_LIBRARY_CAST === '0') { rmSync(libraryFile(dir), { force: true }); return { inserts: [], asked: 0, ms: 0, why: 'off (MOOVI_LIBRARY_CAST=0)' }; }
  const r = await borrow(beats, { seed });
  // the arrival sound: the graph's first choice for `pop`, copied beside the film; the layer plays it only when an insert
  // really lands (one with no clear room sits out, silently), so it is not in the mixed stem
  const sound = r.inserts.length ? await popSound(dir) : null;
  writeLibrary(dir, style, r, { ...look, ...(sound ? { sound } : {}) });
  log(`library: ${r.asked} weak beat(s) asked the graph, ${r.inserts.length} insert(s) in ${r.ms} ms${r.why ? ` (${r.why})` : ''}`);
  for (const x of r.inserts) log(`  beat ${x.beat + 1}: ${x.asset} (${x.art}, serves ${x.needs.join(', ')}) ${x.at.toFixed(1)}-${x.end.toFixed(1)}s ${x.room}`);
  for (const s of r.skipped ?? []) log(`  ${s}`);
  return r;
}

/**
 * Store a film's inserts in its project graph: (Run)-[:HAS_SCENE]->(Scene {id: <run>:scene:<beat>})-[:USES_ARTIFACT
 * {slot: 'library', layout: <style>}]->(Artifact), the visual renderer's own record, so `artifactUsage` sees what the
 * live styles borrowed too. `q` runs a named query on the project's graph (the job's ctx.q). Returns how many.
 */
export async function recordInserts(q: (query: typeof P.useArtifact, params: Record<string, unknown>) => Promise<unknown>, runId: string, style: string, dir: string): Promise<number> {
  if (!existsSync(libraryFile(dir))) return 0;
  const { inserts } = JSON.parse(readFileSync(libraryFile(dir), 'utf8')) as { inserts: Borrowed[] };
  const at = Date.now();
  for (const x of inserts) await q(P.useArtifact, { run: runId, scene: `${runId}:scene:${x.beat}`, i: x.beat, art: x.art, kind: x.kind, name: x.name, slot: 'library', layout: style, at });
  return inserts.length;
}
