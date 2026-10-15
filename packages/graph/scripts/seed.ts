// pnpm --filter @moovi/graph seed [--reset]
// Seeds the craft graph only. The full reset (drop every brand-era graph, seed craft, seed the style packages,
// verify the brand scrub) is `pnpm graph:reset`, in packages/engine/scripts/reset.ts.
import { seedCraft, closeMemory, health } from '../src/index';

const reset = process.argv.includes('--reset');
const h = await health();
if (!h.ok) { console.error(`FalkorDB is not reachable at ${process.env.FALKORDB_URL ?? 'falkor://localhost:6379'}: ${h.error}`); process.exit(1); }
const t0 = performance.now();
const r = await seedCraft({ reset });
console.log(JSON.stringify(r, null, 2));
console.log(`seeded in ${((performance.now() - t0) / 1000).toFixed(1)} s${reset ? ' (reset first)' : ''}`);
await closeMemory();
