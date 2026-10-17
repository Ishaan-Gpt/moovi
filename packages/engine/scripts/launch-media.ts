// Pictures for a Launch film, never an empty card: real footage/photos through the footage finder, else art drawn by the
// brain in the film's palette (src/launch/media.ts).
//   tsx scripts/launch-media.ts <out-dir> --palette '{"bg":"#0B0A09",...}' name="query" [name="query|what to draw"] …
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { mediaFor } from '../src/launch/media';

const args = process.argv.slice(2), out = args[0]!, pi = args.indexOf('--palette');
const palette = pi >= 0 ? JSON.parse(args[pi + 1]!) as Record<string, string> : { dark: '#0B0A09', light: '#EFEBE5' };
const items = args.slice(1).filter((a, i) => a.includes('=') && args[i] !== '--palette').map(a => { const k = a.indexOf('='), [query, draw] = a.slice(k + 1).split('|'); return { name: a.slice(0, k), query: query!, draw }; });
const t0 = Date.now();
const got = await mediaFor(items, palette, out, { log: s => console.log(s) });
writeFileSync(join(out, 'media.json'), JSON.stringify(got, null, 1));
for (const m of got) console.log(`✓ ${m.name}: ${m.kind} · ${m.credit}`);
console.log(`${got.length}/${items.length} in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
process.exit(0);
