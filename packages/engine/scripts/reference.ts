// pnpm --filter @moovi/engine reference <data/refs/<id>/parts.json>
// A video reference broken into parts (src/library/reference.ts). `pnpm library` and the reset seed every reference in
// the repo; this seeds one after you write or change its parts file.
import { CRAFT, closeMemory, health, library, run } from '@moovi/graph';
import { seedReference } from '../src/library/reference';
import { seedCrossLinks } from '../src/library/seed';

const file = process.argv[2];
if (!file) { console.error('usage: reference <parts.json>'); process.exit(1); }
const h = await health();
if (!h.ok) { console.error(`FalkorDB is not reachable: ${h.error}`); process.exit(1); }
const out = await seedReference(file);
const back = await run<{ category: string; id: string; role: string }>(CRAFT, library.referenceParts, { ref: `ref:${out.ref}` });
console.log(JSON.stringify({ ...out, inGraph: back.length }, null, 1));
console.table(back.map(b => ({ category: b.category, id: b.id, role: b.role })));
// the links that span seeds (event aliases, the six styles' cast, X1 tags) are rebuilt after any seed
console.log('cross-links', await seedCrossLinks());
await closeMemory();
