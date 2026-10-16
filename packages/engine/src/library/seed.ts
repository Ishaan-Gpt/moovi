import { seedLibrary } from '@moovi/graph';
import { catalogue } from './catalog';

/** Put the whole library (./catalog.ts) into the craft graph. Idempotent; the reset runs it after the craft seed. */
export async function seedLibraryGraph() {
  const seeds = catalogue();
  const r = await seedLibrary(seeds);
  return { ...r, perCategory: Object.fromEntries(seeds.map(s => [s.seed.replace(/^repo:/, ''), s.rows.length])) };
}
