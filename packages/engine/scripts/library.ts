// pnpm --filter @moovi/engine library [--counts]
// Seeds the omnipotent library (voices, sfx, music, captions, transitions, effects, camera, ui, 3d, inserts) into
// the craft graph as (:Asset) nodes, then prints what FalkorDB now holds per category.
import { CRAFT, closeMemory, health, library, run } from '@moovi/graph';
import { seedLibraryGraph } from '../src/library/seed';

const h = await health();
if (!h.ok) { console.error(`FalkorDB is not reachable at ${process.env.FALKORDB_URL ?? 'falkor://localhost:6379'}: ${h.error}`); process.exit(1); }
const t0 = performance.now();
if (!process.argv.includes('--counts')) console.log(JSON.stringify(await seedLibraryGraph(), null, 1));
const counts = await run<{ category: string; n: number; shippable: number; vendored: number }>(CRAFT, library.libraryCounts);
console.table(counts);
console.log(`total ${counts.reduce((a, c) => a + c.n, 0)} assets in ${((performance.now() - t0) / 1000).toFixed(1)} s`);
await closeMemory();
