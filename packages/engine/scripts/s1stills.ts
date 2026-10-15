// pnpm --filter @moovi/engine exec tsx scripts/s1stills.ts <dir> [id] : one still per scene (at 70% of it) → <dir>/review/fill.png
import { readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { closeRender } from '../src/render/host';
import { sheet } from '../src/render/sheet';
import { meUrls } from '../src/s1fast/preview';

const dir = process.argv[2]!, id = process.argv[3] ?? basename(dir);
const spec = JSON.parse(readFileSync(join(dir, `${id}.json`), 'utf8')), T = JSON.parse(readFileSync(join(dir, 'timeline.json'), 'utf8'));
const times = (T.scenes as { f0: number; f1: number }[]).map(sc => +((sc.f0 + (sc.f1 - sc.f0) * 0.7) / 30).toFixed(2));
const r = await sheet(meUrls(spec), times, join(dir, 'review'), { scale: 0.3, cols: Math.min(5, times.length), name: 'fill' });
await closeRender();
console.log(r.sheet, times.join(' '), readdirSync(dir).length);
