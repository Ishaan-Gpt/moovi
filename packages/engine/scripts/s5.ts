// Style 5 "Clear Signal": a clean kinetic explainer. Live preview only (never an MP4).
//   tsx scripts/s5.ts --url <https://site>   site → arc + facts-only script → edge-tts → cast from the library → reel
//   tsx scripts/s5.ts --script <file> [--brand <name>] [--color <#hex>]   a pasted script (one sentence per line)
//   tsx scripts/s5.ts --clone <ref-dir>      rebuild a reference from its own transcript + audio (clone test, never shipped)
//   --id <name> gives the film its own folder (e.g. a second film of one site)
// A thin wrapper over src/styles/s5.ts, the same code the studio's style-reel job runs. The preview server stays up
// unless --close is given.
import { readFileSync } from 'node:fs';
import { runStyle, table } from '../src/styles/run';

const args = process.argv.slice(2), opt = (k: string) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : undefined; };
const clone = opt('clone'), url = opt('url'), scriptFile = opt('script');
if (!clone && !url && !scriptFile) throw new Error('usage: s5 --url <https://site> | --script <file> [--brand <name>] [--color <#hex>] | --clone <ref-dir> [--id <name>] [--close]');
const r = await runStyle('s5', { clone, url, script: scriptFile ? readFileSync(scriptFile, 'utf8') : undefined, brand: opt('brand'), color: opt('color'), id: opt('id'), port: Number(opt('port') ?? 0) });
console.log(`\nseconds ${JSON.stringify(r.timings)}\n${table({ cli: r.timings })}\nsheet ${r.sheet}\nPREVIEW ${r.preview}${args.includes('--close') ? '' : ' (server stays up; Ctrl+C to stop)'}`);
console.log(`TIMINGS ${JSON.stringify(r.timings)}`);
if (args.includes('--close')) { r.close(); process.exit(0); }
