import { join } from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';
import { config } from '../src/config';
import { closeMaps, openMap, renderMap } from '../src/maps/capture';
import { geocodeAll, graphCache, type Cache, type Place } from '../src/maps/geocode';
import { closeMemory } from '@moovi/graph';

/**
 *   tsx scripts/map3.ts stills "Paris" "Tokyo" ...   frames at 0, 1/3, 2/3 and the end (tiles; globe with --globe)
 *   tsx scripts/map3.ts bench "Paris" "Tokyo" ...    render seconds per second of film, tiles and globe
 * Names are geocoded with Nominatim (one request a second); a name is cached in the graph when FalkorDB is up and
 * in a local file otherwise.
 */
const args = process.argv.slice(2), cmd = args.shift() ?? 'stills', globe = args.includes('--globe');
const names = args.filter(a => !a.startsWith('--'));
const dir = join(config.data, 'maps'); mkdirSync(dir, { recursive: true });
const mem = new Map<string, Place>();
const local: Cache = { get: async k => mem.get(k) ?? null, put: async p => { mem.set(p.key, p); } };
const places = await geocodeAll(names.length ? names : ['Paris', 'Tokyo', 'Sydney'], { cache: process.env.FALKORDB_URL ? graphCache : local });
console.log(places.map(p => `${p.name} (${p.lat.toFixed(2)}, ${p.lon.toFixed(2)}) ${p.cc} ${p.kind}`).join('\n'));
const base = { places, width: 540, height: 960, seconds: 4, fps: 30 };
if (cmd === 'stills') {
  const s = await openMap({ ...base, mode: globe ? 'globe' : 'auto' });
  console.log('mode', s.mode, s.fellBack ?? '');
  for (const [i, n] of [0, 0.34, 0.67, 0.99].entries()) writeFileSync(join(dir, `${s.mode}-${i}.png`), await s.frame(Math.floor(n * s.frames)));
  await s.close();
} else {
  for (const mode of ['tiles', 'globe'] as const) { for (const workers of [1, 4]) { const r = await renderMap({ ...base, mode, seconds: 3, workers }, join(dir, `bench-${mode}`)); console.log(mode, `${r.frames} frames, ${r.secPerSec.toFixed(2)} s per second of film`, r.fellBack ?? '', `(${workers} page${workers > 1 ? 's' : ''})`); } }
}
await closeMaps(); await closeMemory().catch(() => {});
