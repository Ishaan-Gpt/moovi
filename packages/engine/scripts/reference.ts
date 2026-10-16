// pnpm --filter @moovi/engine reference <data/refs/<id>/parts.json>
// A video reference broken into parts: each new component becomes an (:Asset) (seed `ref:<id>`, so a re-run replaces
// it), existing library assets it used are linked as they are, and (:Reference)-[:HAS_PART {role, at}]->(:Asset)
// records what the reference is made of. The parts file stays local with the reference (data/ is never committed).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CRAFT, closeMemory, health, library, run, seedLibrary, type AssetRow } from '@moovi/graph';

interface Part extends Partial<AssetRow> { id: string; category: AssetRow['category']; name: string; about: string; role: string; at?: number }
interface KitFile { id: string; name: string; about: string; palette: Record<string, string>; type: unknown; motion: unknown; frame: unknown; styles?: string[] }
interface PartsFile { kit?: { file: string; draw?: string }; reference: { id: string; url: string; title: string; kind: string; seconds: number; notes?: string }; impl: string; styles?: string[]; parts: Part[]; uses?: { id: string; role: string; at?: number }[] }

const file = process.argv[2];
if (!file) { console.error('usage: reference <parts.json>'); process.exit(1); }
const P = JSON.parse(readFileSync(file, 'utf8')) as PartsFile;
const h = await health();
if (!h.ok) { console.error(`FalkorDB is not reachable: ${h.error}`); process.exit(1); }

const ROOT = join(import.meta.dirname, '../../..');
const KIT = P.kit ? JSON.parse(readFileSync(join(ROOT, P.kit.file), 'utf8')) as KitFile : null;
const runtime = KIT ? `kit:${KIT.id}` : `ref-${P.reference.id}`;
// a part's implementations: the kit's draw module (when it has one), plus any the part lists itself (e.g. `kit-motion`,
// the ishaan-motion build of the same component); a part with none falls back to the reference's own runtime
const implOf = (p: Part): Record<string, string> => {
  const own = { ...(P.kit?.draw ? { [runtime]: `${P.kit.draw}#${p.id}` } : {}), ...(p.impl ?? {}) };
  return Object.keys(own).length ? own : { [runtime]: p.id.split(':')[1]! };
};
const rows: AssetRow[] = P.parts.map(p => ({
  id: p.id, category: p.category, name: p.name, about: p.about,
  runtime: [...new Set([...(p.runtime ?? []), ...Object.keys(implOf(p))])], impl: implOf(p),
  licence: p.licence ?? 'own code (MIT), recreated from a reference', credit: p.credit ?? null, ship: p.ship ?? true, attribution: p.attribution ?? false,
  file: null, vendored: false, energy: p.energy ?? null, tags: [...(p.tags ?? []), 'from-reference'], params: p.params ?? {},
  src: P.kit?.draw ?? P.impl, needs: p.needs ?? [], events: p.events ?? [], styles: p.styles ?? P.styles ?? [], family: p.family ?? null,
}));
const seeded = await seedLibrary([{ seed: `ref:${P.reference.id}`, rows }]);
const r = P.reference;
await run(CRAFT, library.addReference, { id: `ref:${r.id}`, url: r.url, title: r.title, kind: r.kind, seconds: r.seconds, notes: r.notes ?? null });
const parts = [...P.parts.map(p => ({ id: p.id, role: p.role, at: p.at ?? null, note: null })), ...(P.uses ?? []).map(u => ({ id: u.id, role: u.role, at: u.at ?? null, note: 'existing library asset' }))];
const linked = await run<{ parts: number }>(CRAFT, library.addReferenceParts, { ref: `ref:${r.id}`, rows: parts });
if (KIT) {
  await run(CRAFT, library.seedKit, { id: KIT.id, name: KIT.name, about: KIT.about, palette: JSON.stringify(KIT.palette), type: JSON.stringify(KIT.type), motion: JSON.stringify(KIT.motion), frame: JSON.stringify(KIT.frame), src: P.kit!.draw ?? P.impl });
  await run(CRAFT, library.linkKitParts, { kit: KIT.id, rows: P.parts.map(p => ({ id: p.id, role: p.role })) });
  await run(CRAFT, library.linkKitStyles, { kit: KIT.id, styles: KIT.styles ?? P.styles ?? [] });
  await run(CRAFT, library.referenceTaught, { ref: `ref:${r.id}`, kit: KIT.id });
}
const back = await run<{ category: string; id: string; role: string }>(CRAFT, library.referenceParts, { ref: `ref:${r.id}` });
console.log(JSON.stringify({ kit: KIT?.id ?? null, seeded, linked: linked[0]?.parts ?? 0, inGraph: back.length }, null, 1));
console.table(back.map(b => ({ category: b.category, id: b.id, role: b.role })));
await closeMemory();
