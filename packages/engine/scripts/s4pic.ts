// pnpm --filter @moovi/engine exec tsx scripts/s4pic.ts "<sentence>" ["<sentence>" ...] : draw Style 4 pictures alone (stage test).
import { join } from 'node:path';
import { config } from '../src/config';
import { closePictures, drawPicture } from '../src/s4/picture';
import { PERIWINKLE } from '../src/s4/world';
const ss = process.argv.slice(2), out = join(config.data, 's4', 'pictest'), t0 = Date.now();
const r = await Promise.all(ss.map((sentence, index) => drawPicture({ sentence, script: ss.join(' '), world: PERIWINKLE, out, index }).catch(e => String(e))));
for (const p of r) console.log(typeof p === 'string' ? p : JSON.stringify({ kind: p.kind, idea: p.idea, keys: p.keys, model: p.model, s: p.seconds, stats: p.stats, svgLen: p.svg.length }));
console.log(`total ${((Date.now() - t0) / 1000).toFixed(1)}s → ${out}`);
await closePictures(); process.exit(0);
