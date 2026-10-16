import { createHash } from 'node:crypto';
import { CRAFT } from './client';
import { licenceTerms } from './licence';
import { library } from './queries';
import { run } from './run';
import { ensureCraftSchema } from './schema';

export const ASSET_CATEGORIES = ['voice', 'sfx', 'music', 'caption', 'transition', 'effect', 'camera', 'ui', '3d', 'insert',
  // Tab's R7 review, point 4: what the six edit styles reference that the first ten lacked
  'grade', 'overlay', 'font', 'texture', 'end_card'] as const;
export type AssetCategory = (typeof ASSET_CATEGORIES)[number];

/** One library asset as the seed writes it (see queries/library.ts for the graph shape). */
export interface AssetRow {
  /** `<category>:<slug>`; never changes once shipped (saved EDLs replay it). A replacement gets a new id and `replaces`. */
  id: string;
  category: AssetCategory;
  name: string;
  about: string;
  /** who can play it: `browser` (the live preview), `ffmpeg` (the MP4), `edl` (a contract both renderers read), or a style runtime */
  runtime: string[];
  /** licence text or code; stored as its code (licence.ts), and ship / attribution / redistributable derive from it */
  licence: string;
  /** the exact line to print when attribution is due */
  credit: string | null;
  /** ignored: derived from the licence (kept optional so older callers still type-check) */
  ship?: boolean;
  attribution?: boolean;
  /** media path relative to the repo root, if it is a file */
  file: string | null;
  /** the file is in the repo (else catalogued only) */
  vendored: boolean;
  energy: number | null;
  tags: string[];
  /** runtime → its own id for this asset there */
  impl: Record<string, string>;
  params: Record<string, unknown>;
  /** where in the code it lives */
  src: string;
  needs?: string[];
  events?: { event: string; gainDb: number | null; first: boolean; then?: boolean; rank?: number; align?: string; slices?: string | null; sliceLen?: number | null }[];
  /** edit styles it SUITS; a bare id is weight 1 */
  styles?: (string | { style: string; w: number })[];
  family?: string | null;
  /** provenance (point 2) */
  licenceUrl?: string | null;
  sourceUrl?: string | null;
  author?: string | null;
  title?: string | null;
  /** the exact bytes an EDL pins (point 1); for a vendored file, its sha256 */
  sha256?: string | null;
  /** old asset ids this one replaces: (old)-[:REPLACED_BY]->(this) */
  replaces?: string[];
  /** runtime → the asset to use there when this one does not run there: (this)-[:FALLBACK {runtime}]->(other) */
  fallback?: Record<string, string>;
}

export interface LibrarySeed { seed: string; rows: AssetRow[] }

const chunk = <T>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));
const rev = (r: AssetRow) => r.sha256 ? r.sha256.slice(0, 12) : createHash('sha256').update(JSON.stringify([r.impl, r.params, r.runtime])).digest('hex').slice(0, 12);

/** The node a row becomes: licence as a code and every derived flag (pure; the tests use it). */
export function assetNode(r: AssetRow & { seed: string }) {
  const L = licenceTerms(r.licence);
  return {
    id: r.id, category: r.category, name: r.name, about: r.about, runtime: r.runtime, licence: L.code,
    licenceUrl: r.licenceUrl ?? L.url, sourceUrl: r.sourceUrl ?? null, author: r.author ?? null, title: r.title ?? null,
    credit: r.credit, ship: L.ship, attribution: L.attribution, redistributable: L.redistributable,
    file: r.file, vendored: r.vendored, energy: r.energy, tags: r.tags, params: JSON.stringify(r.params), impl: JSON.stringify(r.impl),
    seed: r.seed, src: r.src, sha256: r.sha256 ?? null, rev: rev(r),
  };
}

/**
 * Write a catalogue into the craft graph. Idempotent: assets are merged by id and their edges rebuilt. An asset a seed
 * no longer lists is marked retired, never deleted, so an EDL that names it still resolves (and follows REPLACED_BY).
 */
export async function seedLibrary(seeds: LibrarySeed[]) {
  const g = CRAFT;
  await ensureCraftSchema(g);
  const all = seeds.flatMap(s => s.rows.map(r => ({ ...r, seed: s.seed })));
  const ids = new Set<string>();
  for (const r of all) { if (ids.has(r.id)) throw new Error(`library: duplicate asset id ${r.id}`); ids.add(r.id); }

  await run(g, library.clearAssetEdges, { seeds: seeds.map(s => s.seed) });
  for (const rows of chunk(all.map(assetNode), 200)) await run(g, library.seedAssets, { rows });
  const needs = all.flatMap(r => (r.needs ?? []).map((need, i) => ({ id: r.id, need, w: i + 1 })));
  for (const rows of chunk(needs, 500)) await run(g, library.linkAssetNeeds, { rows });
  const events = all.flatMap(r => (r.events ?? []).map(e => ({ id: r.id, ...e, then: e.then ?? false, rank: e.rank ?? null, align: e.align ?? null, slices: e.slices ?? null, sliceLen: e.sliceLen ?? null })));
  if (events.length) await run(g, library.linkAssetEvents, { rows: events });
  const styles = all.flatMap(r => (r.styles ?? []).map(s => typeof s === 'string' ? { id: r.id, style: s, w: 1, src: 'row' } : { id: r.id, style: s.style, w: s.w, src: 'row' }));
  for (const rows of chunk(styles, 500)) await run(g, library.linkAssetStyles, { rows });
  const fams = all.filter(r => r.family).map(r => ({ id: r.id, family: r.family }));
  if (fams.length) await run(g, library.linkAssetFamilies, { rows: fams });
  const repl = all.flatMap(r => (r.replaces ?? []).map(old => ({ old, id: r.id })));
  if (repl.length) await run(g, library.linkReplaced, { rows: repl });
  const fb = all.flatMap(r => Object.entries(r.fallback ?? {}).map(([runtime, to]) => ({ id: r.id, runtime, to })));
  for (const rows of chunk(fb, 500)) await run(g, library.linkFallbacks, { rows });
  let retired = 0;
  for (const s of seeds) retired += (await run<{ retired: number }>(g, library.retireAssets, { seed: s.seed, ids: s.rows.map(r => r.id) }))[0]?.retired ?? 0;
  return { assets: all.length, serves: needs.length, fits: events.length, suits: styles.length, families: fams.length, replaced: repl.length, fallbacks: fb.length, retired };
}
