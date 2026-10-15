// tsx scripts/s1refill.ts <data/s1url/<id>> : re-run ONLY the template fill (+ QA) of a finished Style 1 site reel on its
// saved script, voice words and pictures (site.png, mobile.png, logo.png), then its per-scene stills sheet. A dev loop for
// the fill's rules: the same fillPlan the reel runs, without the brief, voice and audio (seconds instead of minutes).
import { existsSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { closeRender } from '../src/render/host';
import { sheet } from '../src/render/sheet';
import { fillPlan } from '../src/s1fast/fill';
import { meUrls } from '../src/s1fast/preview';

const dir = process.argv[2]!, id = basename(dir);
const rep = JSON.parse(readFileSync(join(dir, 'url-report.json'), 'utf8')) as { url: string; brand: string; facts: string[] };
const words = JSON.parse(readFileSync(join(dir, 'words.json'), 'utf8'));
const pic = (f: string) => (existsSync(join(dir, f)) ? `/data/s1url/${id}/${f}` : null);
const t0 = Date.now();
await fillPlan({ dir, id, brand: `site-${id}`, words, site: pic('site.png'), mobile: pic('mobile.png'), logo: pic('logo.png'), name: rep.brand, brief: `Brand: ${rep.brand} (${rep.url}). Facts (the only claims allowed): ${rep.facts.join(' | ')}.` });
console.log(`fill ${((Date.now() - t0) / 1000).toFixed(1)} s`);
const spec = JSON.parse(readFileSync(join(dir, `${id}.json`), 'utf8')), T = JSON.parse(readFileSync(join(dir, 'timeline.json'), 'utf8'));
const times = (T.scenes as { f0: number; f1: number }[]).map(sc => +((sc.f0 + (sc.f1 - sc.f0) * 0.7) / 30).toFixed(2));
const r = await sheet(meUrls(spec), times, join(dir, 'review'), { scale: 0.3, cols: Math.min(5, times.length), name: 'fill' });
await closeRender();
console.log(r.sheet);
process.exit(0);
