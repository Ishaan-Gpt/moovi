import { CRAFT } from './client';
import { library } from './queries';
import { run } from './run';
import { ensureCraftSchema } from './schema';

/** One library asset as the seed writes it (see queries/library.ts for the graph shape). */
export interface AssetRow {
  /** `<category>:<slug>` */
  id: string;
  category: 'voice' | 'sfx' | 'music' | 'caption' | 'transition' | 'effect' | 'camera' | 'ui' | '3d' | 'insert';
  name: string;
  about: string;
  runtime: string[];
  licence: string;
  credit: string | null;
  /** the licence is safe for a paid product */
  ship: boolean;
  /** a published film must print `credit` */
  attribution: boolean;
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
  events?: { event: string; gainDb: number | null; first: boolean }[];
  styles?: string[];
  family?: string | null;
}

export interface LibrarySeed { seed: string; rows: AssetRow[] }

const chunk = <T>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

/**
 * Write a catalogue into the craft graph. Idempotent: assets are merged by id, their edges are rebuilt, and assets a
 * seed no longer lists are retired. Assets from a reference breakdown carry their own seed and are never retired here.
 */
export async function seedLibrary(seeds: LibrarySeed[]) {
  const g = CRAFT;
  await ensureCraftSchema(g);
  const all = seeds.flatMap(s => s.rows.map(r => ({ ...r, seed: s.seed })));
  const ids = new Set<string>();
  for (const r of all) { if (ids.has(r.id)) throw new Error(`library: duplicate asset id ${r.id}`); ids.add(r.id); }

  await run(g, library.clearAssetEdges, { seeds: seeds.map(s => s.seed) });
  const node = (r: (typeof all)[number]) => ({
    id: r.id, category: r.category, name: r.name, about: r.about, runtime: r.runtime, licence: r.licence, credit: r.credit,
    ship: r.ship, attribution: r.attribution, file: r.file, vendored: r.vendored, energy: r.energy, tags: r.tags,
    params: JSON.stringify(r.params), impl: JSON.stringify(r.impl), seed: r.seed, src: r.src,
  });
  for (const rows of chunk(all.map(node), 200)) await run(g, library.seedAssets, { rows });
  const needs = all.flatMap(r => (r.needs ?? []).map((need, i) => ({ id: r.id, need, w: i + 1 })));
  for (const rows of chunk(needs, 500)) await run(g, library.linkAssetNeeds, { rows });
  const events = all.flatMap(r => (r.events ?? []).map(e => ({ id: r.id, ...e })));
  if (events.length) await run(g, library.linkAssetEvents, { rows: events });
  const styles = all.flatMap(r => (r.styles ?? []).map(style => ({ id: r.id, style })));
  if (styles.length) await run(g, library.linkAssetStyles, { rows: styles });
  const fams = all.filter(r => r.family).map(r => ({ id: r.id, family: r.family }));
  if (fams.length) await run(g, library.linkAssetFamilies, { rows: fams });
  let retired = 0;
  for (const s of seeds) retired += (await run<{ retired: number }>(g, library.retireAssets, { seed: s.seed, ids: s.rows.map(r => r.id) }))[0]?.retired ?? 0;
  return { assets: all.length, serves: needs.length, fits: events.length, suits: styles.length, families: fams.length, retired };
}
