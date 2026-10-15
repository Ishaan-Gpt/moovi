// Anatomy: a brand's product or system as a detailed isometric technical drawing that builds itself on the voice.
// Live preview only (never an MP4).
//   tsx scripts/anatomy.ts --url <https://site> [--theme light|dark]                site → facts-only script → voice → reel
//   tsx scripts/anatomy.ts --script <file> --brand <name> [--color #hex] [--theme]  your own script, voiced
// A thin wrapper over src/styles/anatomy.ts, the same code the studio's style-reel job runs. The server stays up.
import { readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { runStyle, table } from '../src/styles/run';

const args = process.argv.slice(2), opt = (k: string) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : undefined; };
const url = opt('url'), file = opt('script'), brand = opt('brand'), theme = opt('theme') as 'light' | 'dark' | undefined;
if (!url && !file) throw new Error('usage: anatomy --url <https://site> | --script <file> --brand <name> [--color #hex] [--theme light|dark]');
const slug = (s: string) => s.replace(/^www\./, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase().replace(/^-|-$/g, '');
const r = await runStyle('anatomy', {
  url, script: file ? readFileSync(resolve(file), 'utf8') : undefined, brand, color: opt('color'), theme,
  id: file && !url ? slug(brand ?? basename(file, '.txt')) : undefined, port: Number(opt('port') ?? 0),
});
console.log(`\nseconds ${JSON.stringify(r.timings)}\n${table({ cli: r.timings })}\nsheet ${r.sheet}\nPREVIEW ${r.preview} (server stays up; Ctrl+C to stop)`);
console.log(`TIMINGS ${JSON.stringify(r.timings)}`);
if (args.includes('--exit')) { r.close(); process.exit(0); }
