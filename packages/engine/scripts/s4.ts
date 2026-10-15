// Style 4 "editorial metaphor essay", every picture drawn in code. Live preview only (never an MP4).
//   tsx scripts/s4.ts --clone <MotionEasy reference dir>   rebuild a reference from its own words.json + voice (clone test, never shipped)
//   tsx scripts/s4.ts --url <https://site>                site → facts-only essay script → edge-tts → reel in the brand's own hue
//   tsx scripts/s4.ts --script <file> --brand <name> --color <#hex> --coined "<term>" [--voice V --rate +4%]
//   --id <name>  the film's folder under data/s4 (two films of one site side by side); --no-keep  close the preview when done
// A thin wrapper over src/styles/s4.ts, the same code the studio's style-reel job runs. The preview server stays up.
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { runStyle, table } from '../src/styles/run';

const args = process.argv.slice(2), opt = (k: string) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : undefined; };
const clone = opt('clone'), url = opt('url'), file = opt('script');
if (!clone && !url && !file) throw new Error('usage: s4 --clone <ref-dir> | --url <https://site> | --script <file> --brand <name> --color <#hex> --coined "<term>"');
const r = await runStyle('s4', {
  clone, url, script: file ? readFileSync(file, 'utf8') : undefined, brand: opt('brand'), color: opt('color'), coined: opt('coined'), voice: opt('voice'), rate: opt('rate'),
  id: opt('id') ?? (file ? (opt('brand') ?? basename(file).replace(/\.[^.]+$/, '')).toLowerCase() : undefined), port: Number(opt('port') ?? 0),
});
console.log(`\nseconds ${JSON.stringify(r.timings)}\n${table({ cli: r.timings })}\nsheet ${r.sheet}\nPREVIEW ${r.preview} (server stays up; Ctrl+C to stop)`);
console.log(`TIMINGS ${JSON.stringify(r.timings)}`);
if (args.includes('--no-keep')) { r.close(); process.exit(0); }
