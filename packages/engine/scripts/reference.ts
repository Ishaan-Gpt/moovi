// pnpm --filter @moovi/engine reference <data/refs/<id>/parts.json>
// A video reference broken into parts: each new component becomes an (:Asset) (seed `ref:<id>`, so a re-run replaces
// it), existing library assets it used are linked as they are, and (:Reference)-[:HAS_PART {role, at}]->(:Asset)
// records what the reference is made of. The parts file stays local with the reference (data/ is never committed).
import { readFileSync } from 'node:fs';
import { CRAFT, closeMemory, health, library, run, seedLibrary, type AssetRow } from '@moovi/graph';

interface Part extends Partial<AssetRow> { id: string; category: AssetRow['category']; name: string; about: string; role: string; at?: number }
interface PartsFile { reference: { id: string; url: string; title: string; kind: string; seconds: number; notes?: string }; impl: string; styles?: string[]; parts: Part[]; uses?: { id: string; role: string; at?: number }[] }

const file = process.argv[2];
if (!file) { console.error('usage: reference <parts.json>'); process.exit(1); }
const P = JSON.parse(readFileSync(file, 'utf8')) as PartsFile;
const h = await health();
if (!h.ok) { console.error(`FalkorDB is not reachable: ${h.error}`); process.exit(1); }

const runtime = `ref-${P.reference.id}`;
const rows: AssetRow[] = P.parts.map(p => ({
  id: p.id, category: p.category, name: p.name, about: p.about,
  runtime: p.runtime ?? [runtime], impl: p.impl ?? { [runtime]: p.id.split(':')[1]! },
  licence: p.licence ?? 'own code (MIT), recreated from a reference', credit: p.credit ?? null, ship: p.ship ?? true, attribution: p.attribution ?? false,
  file: null, vendored: false, energy: p.energy ?? null, tags: [...(p.tags ?? []), 'from-reference'], params: p.params ?? {},
  src: P.impl, needs: p.needs ?? [], events: p.events ?? [], styles: p.styles ?? P.styles ?? [], family: p.family ?? null,
}));
const seeded = await seedLibrary([{ seed: `ref:${P.reference.id}`, rows }]);
const r = P.reference;
await run(CRAFT, library.addReference, { id: `ref:${r.id}`, url: r.url, title: r.title, kind: r.kind, seconds: r.seconds, notes: r.notes ?? null });
const parts = [...P.parts.map(p => ({ id: p.id, role: p.role, at: p.at ?? null, note: null })), ...(P.uses ?? []).map(u => ({ id: u.id, role: u.role, at: u.at ?? null, note: 'existing library asset' }))];
const linked = await run<{ parts: number }>(CRAFT, library.addReferenceParts, { ref: `ref:${r.id}`, rows: parts });
const back = await run<{ category: string; id: string; role: string }>(CRAFT, library.referenceParts, { ref: `ref:${r.id}` });
console.log(JSON.stringify({ seeded, linked: linked[0]?.parts ?? 0, inGraph: back.length }, null, 1));
console.table(back.map(b => ({ category: b.category, id: b.id, role: b.role })));
await closeMemory();
