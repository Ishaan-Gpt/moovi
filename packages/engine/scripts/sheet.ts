// tsx scripts/sheet.ts <spec.json> [t1,t2,…]: a contact sheet of a spec (data/checks/sheet.png)
import { readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { closeRender } from '../src/render/host';
import { sheet } from '../src/render/sheet';
const spec = JSON.parse(readFileSync(process.argv[2]!, 'utf8'));
const T = spec.props.timeline, dur = T.frames / T.fps;
const times = process.argv[3] ? process.argv[3].split(',').map(Number) : Array.from({ length: 8 }, (_, i) => +((i + 0.5) * dur / 8).toFixed(2));
const r = await sheet(spec, times, dirname(process.argv[2]!), { scale: 0.3 });
console.log(r.sheet);
await closeRender();
