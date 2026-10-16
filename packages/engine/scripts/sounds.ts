// pnpm --filter @moovi/engine sounds <film dir> [<film dir> ...]
// Re-casts a film's SFX from the library graph and compares the stem with the map.json one (same events, same seed):
// which asset each event got, how long the graph took, and whether the two stems are sample-identical (they are while
// the graph mirrors map.json; a new FITS edge in the graph changes the film's sound without touching map.json).
// Writes <dir>/sfx.map.wav (map.json) and <dir>/sfx.wav + sound.json (graph) and prints one line per film.
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { closeMemory } from '@moovi/graph';
import { castStem, sfxStem, type Ev } from '../src/audio/mix';
import { readWav } from '../src/audio/wav';

const dirs = process.argv.slice(2).filter(a => !a.startsWith('--')).map(d => resolve(process.env.INIT_CWD ?? process.cwd(), d));
if (!dirs.length) { console.error('usage: sounds <film dir> [...]'); process.exit(1); }
for (const dir of dirs) {
  const events = JSON.parse(readFileSync(join(dir, 'events.json'), 'utf8')) as Ev[];
  sfxStem(events, join(dir, 'sfx.map.wav'));
  const t = performance.now(), { hits, cast } = await castStem(events, join(dir, 'sfx.wav'), dir), ms = performance.now() - t;
  const a = readWav(join(dir, 'sfx.map.wav')).ch[0]!, b = readWav(join(dir, 'sfx.wav')).ch[0]!;
  let diff = Math.abs(a.length - b.length); for (let i = 0; i < Math.min(a.length, b.length); i++) if (Math.abs(a[i]! - b[i]!) > 1e-4) diff++;
  console.log(JSON.stringify({ film: dir.split(/[\\/]/).slice(-2).join('/'), events: events.length, hits, source: cast.source, graphMs: cast.graphMs, stemMs: Math.round(ms), samplesDiffer: diff, sounded: cast.sounded, ...(cast.why ? { why: cast.why } : {}) }));
}
await closeMemory();
