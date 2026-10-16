// pnpm combined "<brief>" [--seconds 30] [--id name] [--families footage,map,s1,darkvox,anatomy] [--share 0.45]
// One film from the whole palette (src/router): the director writes beats, the router picks the family per beat,
// every segment renders at once on its own fast path, the cut is joined and mastered. Prints the report.
import { combinedFilm } from '../src/router/film';
import { inventory } from '../src/router/palette';
import type { FamilyId } from '../src/router/palette';

const args = process.argv.slice(2), opt = (k: string) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : undefined; };
const brief = args.find((a, i) => !a.startsWith('--') && !(args[i - 1] ?? '').startsWith('--'));
if (!brief) { console.error('usage: combined "<brief>" [--seconds 30] [--id name] [--families a,b] [--share 0.45]'); process.exit(1); }
console.log('palette', JSON.stringify(await inventory()));
const r = await combinedFilm({ brief, seconds: opt('seconds') ? Number(opt('seconds')) : undefined, id: opt('id'), families: opt('families')?.split(',') as FamilyId[] | undefined, footageShare: opt('share') ? Number(opt('share')) : undefined });
console.log(`\nDONE ${r.out}\n${r.seconds}s · footage ${(r.footageShare * 100).toFixed(0)}% · voices ${r.voices.narrator} + ${r.voices.second}\n${r.segments.map((m, i) => `${i + 1}. ${m.made} ${m.duration.toFixed(2)}s ${m.voice}: ${m.detail}`).join('\n')}\nTIMINGS ${JSON.stringify(r.timings)}`);
process.exit(0);
