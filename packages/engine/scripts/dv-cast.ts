// Dark Vox: print how a script would be cast (no model, no voice), for two seeds side by side.
import { readFileSync } from 'node:fs';
import { castFilm, fallbackLines } from '../src/darkvox/film';
import { DV_SETUPS } from '../src/darkvox/library';
import type { Piece } from '../src/s4/compose';
const lines = readFileSync(process.argv[2]!, 'utf8').split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));
let t = 0.1; const ps: Piece[] = lines.map(l => { const ws = l.split(' ').map(w => { const x = { word: w, t: +t.toFixed(2), end: +(t + 0.3).toFixed(2) }; t += 0.4; return x; }); t += 0.3; return { text: l, words: ws }; });
const a = castFilm({ ps, lines, plans: fallbackLines(lines), lib: DV_SETUPS, seed: 'one', recent: [], end: t });
const b = castFilm({ ps, lines, plans: fallbackLines(lines), lib: DV_SETUPS, seed: 'two', recent: a.plan.map(p => p.setup), end: t });
a.plan.forEach((p, i) => console.log(`${String(i).padStart(2)} ${p.setup.padEnd(18)} ${p.set.padEnd(9)} | ${b.plan[i]!.setup.padEnd(18)} ${b.plan[i]!.set.padEnd(9)} | ${lines[p.line]}  [${p.why}]`));
