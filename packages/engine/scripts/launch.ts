// Launch: a premium product-launch film from a site or a script, cut to the music, played live (never an MP4).
//   tsx scripts/launch.ts --url <https://site> [--ratio …] [--look lNN --arc id --seed s --brief f.json]  site → copy → cast → film
//   tsx scripts/launch.ts --script <file> --brand <name> [--color #hex] [--ratio …]       your own lines (*key word*)
// A thin wrapper over src/styles/launch.ts, the same code the studio's style-reel job runs. The server stays up
// unless --exit. FalkorDB must be running (the Launch library lives there).
import { readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { runStyle, table } from '../src/styles/run';

const args = process.argv.slice(2), opt = (k: string) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : undefined; };
const url = opt('url'), file = opt('script'), brand = opt('brand');
if (!url && !file) throw new Error('usage: launch --url <https://site> | --script <file> --brand <name> [--color #hex] [--ratio 16:9|1:1|9:16|4:5]');
const slug = (s: string) => s.replace(/^www\./, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase().replace(/^-|-$/g, '');
const r = await runStyle('launch', {
  url, script: file ? readFileSync(resolve(file), 'utf8') : undefined, brand, color: opt('color'), ratio: opt('ratio') as '16:9' | '1:1' | '9:16' | '4:5' | undefined,
  pin: opt('look') || opt('arc') || opt('seed') || opt('brief') ? { look: opt('look'), arc: opt('arc'), seed: opt('seed'), brief: opt('brief') ? resolve(opt('brief')!) : undefined } : undefined,
  id: opt('id') ?? (file && !url ? slug(brand ?? basename(file, '.txt')) : undefined), port: Number(opt('port') ?? 0),
});
console.log(`\nseconds ${JSON.stringify(r.timings)}\n${table({ cli: r.timings })}\nsheet ${r.sheet}\nPREVIEW ${r.preview}?mute (server stays up; Ctrl+C to stop)`);
console.log(`TIMINGS ${JSON.stringify(r.timings)}`);
if (args.includes('--exit')) { r.close(); process.exit(0); }
