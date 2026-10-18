// Showreel (one of the three presets): a topic, brief or link → a theme-locked live film. Never an MP4.
//   tsx scripts/showreel.ts "<brief>" [--url <https://site>] [--theme night-stage|editorial|blueprint|real-footage] [--exit]
// A thin wrapper over src/showreel/index.ts, the same entry the studio's router calls.
import { showreel } from '../src/showreel';
import { table } from '../src/styles/run';

const args = process.argv.slice(2), opt = (k: string) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : undefined; };
const brief = args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
const r = await showreel({ brief, url: opt('url'), theme: opt('theme'), port: Number(opt('port') ?? 0) },
  { log: s => console.log(s), progress: s => console.log(`  · ${s}`), lap: (k, v) => console.log(`[${k}] ${v.toFixed(1)}s`) });
console.log(`\ntheme ${r.theme} (${r.style})\n${table({ cli: r.timings })}\nPREVIEW ${r.preview}`);
if (args.includes('--exit')) { r.close(); process.exit(0); }
