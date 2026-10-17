/**
 * The type registry in the craft graph (Stage 1 W2). The specs (packages/library/src/types) say which looks and
 * references each type has; this file turns them into the type's library slice, seeds it as
 * `(:Asset)-[:IN_TYPE {w, when}]->(:Type)`, and reads it back with `typeKit`, one graph read per film.
 *
 * The slice is computed here, in code, from the same rows the graph is seeded from, so the graph and the catalogue
 * give the same kit: a look's assets (by runtime, by the edit style they SUIT, or by id) and every part a type's
 * references are made of (HAS_PART and their uses). w is today's weight (1 for what a look owns or a reference taught,
 * the cast weight for an edit style's pick); `when` stays null until Ishaan ticks each part's WHEN rule (decision 9).
 *
 * Nothing reads `typeKit` yet except the tests; the router reads it later (W1).
 */
import { readFileSync } from 'node:fs';
import { CRAFT, health, licenceTerms, run, types as T, type AssetRow } from '@moovi/graph';
import { TYPES, typeOf, type SliceRule, type TypeId, type TypeSpec } from '@moovi/library/types';
import { catalogue } from './catalog';
import { styleCast } from './edit-styles';
import { referenceFiles, type PartsFile } from './reference';

export interface TypeAsset { id: string; type: TypeId; w: number; when: string | null }
export interface KitAsset { id: string; category: string; w: number; when: string | null; ship: boolean }
export interface TypeKit {
  source: 'graph' | 'catalogue';
  id: TypeId;
  name: string;
  status: TypeSpec['status'];
  /** the whole spec: arcs, beat map, caption preset, grade, music energy, sfx marks, tool rules, floor overrides, motion branch */
  spec: TypeSpec;
  looks: { id: string; name: string; role: string; kind: string }[];
  references: { id: string; role: string; title: string | null }[];
  /** the library slice per category, strongest first, then id */
  slice: Record<string, KitAsset[]>;
  assets: number;
}

/** Every reference part in the repo, per reference id (`ref:<id>`): its own parts and the library assets it uses. */
export function referenceParts(files = referenceFiles()): { parts: Map<string, string[]>; rows: AssetRow[] } {
  const parts = new Map<string, string[]>(), rows: AssetRow[] = [];
  for (const f of files) {
    const P = JSON.parse(readFileSync(f, 'utf8')) as PartsFile;
    parts.set(`ref:${P.reference.id}`, [...new Set([...P.parts.map(p => p.id), ...(P.uses ?? []).map(u => u.id)])]);
    for (const p of P.parts) rows.push({ id: p.id, category: p.category, name: p.name, about: p.about, runtime: [], licence: p.licence ?? 'MIT', credit: p.credit ?? null, file: null, vendored: false, energy: p.energy ?? null, tags: [], impl: {}, params: {}, src: P.impl });
  }
  return { parts, rows };
}

/**
 * The IN_TYPE rows for every type: pure, from the catalogue rows, the edit styles' cast and the reference parts.
 * An asset two looks share keeps its strongest weight.
 */
export function typeAssets(rows: AssetRow[] = catalogue().flatMap(s => s.rows), parts: Map<string, string[]> = referenceParts().parts, specs: readonly TypeSpec[] = TYPES): TypeAsset[] {
  // the edit styles' weights, as the graph's SUITS edges hold them (seedCrossLinks' cast, plus each row's own styles)
  const suits = new Map<string, Map<string, number>>();
  const suit = (style: string, id: string, w: number) => { const m = suits.get(style) ?? new Map<string, number>(); m.set(id, Math.max(m.get(id) ?? 0, w)); suits.set(style, m); };
  for (const c of styleCast(rows)) suit(c.style, c.id, c.w);
  for (const r of rows) for (const s of r.styles ?? []) typeof s === 'string' ? suit(s, r.id, 1) : suit(s.style, r.id, s.w);
  const known = new Set(rows.map(r => r.id));
  const match = (rule: SliceRule): [string, number][] =>
    'runtime' in rule ? rows.filter(r => r.runtime.includes(rule.runtime) && (!rule.category || r.category === rule.category)).map(r => [r.id, 1])
      : 'editStyle' in rule ? [...(suits.get(rule.editStyle) ?? new Map()).entries()].filter(([id]) => known.has(id))
        : rule.ids.filter(id => known.has(id)).map(id => [id, 1]);
  const out: TypeAsset[] = [];
  for (const t of specs) {
    const w = new Map<string, number>();
    const add = (id: string, x: number) => w.set(id, Math.max(w.get(id) ?? 0, x));
    for (const l of t.looks) for (const rule of l.slice) for (const [id, x] of match(rule)) add(id, x);
    for (const r of t.references) for (const id of parts.get(r.id) ?? []) add(id, 1);
    for (const [id, x] of [...w.entries()].sort((a, b) => a[0].localeCompare(b[0]))) out.push({ id, type: t.id, w: Math.round(x * 100) / 100, when: null });
  }
  return out;
}

const chunk = <X>(xs: X[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

/** Seed the seven types, their looks and references, and every IN_TYPE edge (idempotent; run after the references). */
export async function seedTypes(specs: readonly TypeSpec[] = TYPES) {
  await run(CRAFT, T.seedTypes, { rows: specs.map((t, i) => ({ id: t.id, i, name: t.name, status: t.status, spec: JSON.stringify(t), src: `packages/library/src/types/${t.id}.ts` })) });
  await run(CRAFT, T.clearTypeLinks, {});
  const looks = specs.flatMap(t => t.looks.map((l, i) => ({ type: t.id, look: l.id, name: l.name, role: l.role, i, kind: l.kind })));
  const styles = (await run<{ looks: number }>(CRAFT, T.linkTypeStyles, { rows: looks.filter(l => l.kind === 'style') }))[0]?.looks ?? 0;
  const edits = (await run<{ looks: number }>(CRAFT, T.linkTypeEditLooks, { rows: looks.filter(l => l.kind === 'edit-look') }))[0]?.looks ?? 0;
  const refs = (await run<{ refs: number }>(CRAFT, T.linkTypeReferences, { rows: specs.flatMap(t => t.references.map(r => ({ type: t.id, ref: r.id, role: r.role }))) }))[0]?.refs ?? 0;
  await run(CRAFT, T.clearTypeAssets, {});
  let inType = 0;
  for (const rows of chunk(typeAssets(undefined, undefined, specs), 500)) inType += (await run<{ edges: number }>(CRAFT, T.linkAssetTypes, { rows }))[0]?.edges ?? 0;
  return { types: specs.length, looks: styles + edits, typeRefs: refs, inType };
}

const group = (xs: KitAsset[]) => {
  const out: Record<string, KitAsset[]> = {};
  for (const a of [...xs].sort((a, b) => b.w - a.w || a.id.localeCompare(b.id))) (out[a.category] ??= []).push(a);
  return out;
};

// the catalogue is code and files in the repo: read once per process (about 3 s), like a seed would
let cached: { rows: AssetRow[]; ref: ReturnType<typeof referenceParts> } | null = null;
const source = () => (cached ??= { rows: catalogue().flatMap(s => s.rows), ref: referenceParts() });

/** The kit from the catalogue the graph is seeded from (FalkorDB down): the same slice, the same order. */
export function catalogueKit(id: TypeId): TypeKit {
  const spec = typeOf(id);
  const { rows, ref } = source();
  const byId = new Map([...ref.rows, ...rows].map(r => [r.id, r]));
  const assets = typeAssets(rows, ref.parts, [spec]).flatMap(a => {
    const r = byId.get(a.id); if (!r) return [];
    return [{ id: a.id, category: r.category, w: a.w, when: a.when, ship: r.ship ?? licenceTerms(r.licence).ship }];
  });
  return {
    source: 'catalogue', id, name: spec.name, status: spec.status, spec,
    looks: spec.looks.map(l => ({ id: l.id, name: l.name, role: l.role, kind: l.kind })),
    references: spec.references.map(r => ({ id: r.id, role: r.role, title: null })).sort((a, b) => a.id.localeCompare(b.id)),
    slice: group(assets), assets: assets.length,
  };
}

interface KitRow { id: string; name: string; status: TypeSpec['status']; spec: string; looks: TypeKit['looks']; refs: TypeKit['references']; assets: KitAsset[] }

/** The kit from FalkorDB, one read (`typeKit`); null when the type is not seeded. */
export async function graphKit(id: TypeId): Promise<TypeKit | null> {
  const [r] = await run<KitRow>(CRAFT, T.typeKit, { id });
  if (!r) return null;
  const assets = r.assets.filter(Boolean);
  return { source: 'graph', id, name: r.name, status: r.status, spec: JSON.parse(r.spec) as TypeSpec, looks: r.looks.filter(Boolean), references: r.refs.filter(Boolean), slice: group(assets), assets: assets.length };
}

/**
 * Everything a film of this type needs: FalkorDB when it answers (one health read, then one query), else the
 * catalogue, so a film never waits on the graph (like edit/cast.ts openLibrary).
 */
export async function typeKit(id: TypeId, o: { graph?: boolean } = {}): Promise<TypeKit> {
  if (o.graph === false || process.env.MOOVI_LIBRARY === 'catalogue') return catalogueKit(id);
  try { if ((await health()).ok) { const k = await graphKit(id); if (k) return k; } } catch { /* down */ }
  return catalogueKit(id);
}
