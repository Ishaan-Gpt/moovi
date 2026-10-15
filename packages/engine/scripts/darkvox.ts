// Dark Vox: a lit paper-theatre stage at night. Live preview only (never an MP4).
//   tsx scripts/darkvox.ts --clone <ref dir> [--end TEXT]                 rebuild a reference (clone test, never shipped)
//   tsx scripts/darkvox.ts --url <https://site> [--reuse]                 site → facts-only script → edge-tts → reel
//   tsx scripts/darkvox.ts --script <file> --brand <name> [--color #hex]  your own script, voiced
//   --id <name>  the film's folder (two films of one site side by side)
// A thin wrapper over src/styles/darkvox.ts, the same code the studio's style-reel job runs. The server stays up.
import { readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { runStyle, table } from '../src/styles/run';

const args = process.argv.slice(2), opt = (k: string) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : undefined; };
const clone = opt('clone'), url = opt('url'), file = opt('script'), brand = opt('brand');
if (!clone && !url && !file) throw new Error('usage: darkvox --clone <ref-dir> | --url <https://site> | --script <file> --brand <name> [--color #hex]');
const slug = (s: string) => s.replace(/^www\./, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase().replace(/^-|-$/g, '');
const r = await runStyle('darkvox', {
  clone, url, script: file ? readFileSync(resolve(file), 'utf8') : undefined, brand, color: opt('color'), end: opt('end'), reuse: args.includes('--reuse'),
  id: opt('id') ?? (file && !url ? slug(brand ?? basename(file, '.txt')) : undefined), port: Number(opt('port') ?? 0),
});
console.log(`\nseconds ${JSON.stringify(r.timings)}\n${table({ cli: r.timings })}\nsheet ${r.sheet}\nPREVIEW ${r.preview} (server stays up; Ctrl+C to stop)`);
console.log(`TIMINGS ${JSON.stringify(r.timings)}`);
if (args.includes('--exit')) { r.close(); process.exit(0); }
