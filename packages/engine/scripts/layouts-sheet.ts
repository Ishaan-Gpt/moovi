import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { config } from '../src/config';
import { closeVisual, openFilm } from '../src/visual/capture';
import { LAYOUT_IDS } from '../src/visual/layouts';
import { planFilm } from '../src/visual/plan';
/** every layout, forced, on the same beat: tsx scripts/layouts-sheet.ts [vertical|landscape] [light|dark] → data/visual/layout-N.jpg */
const format = (process.argv[2] ?? 'vertical') as 'vertical', theme = (process.argv[3] ?? 'light') as 'light';
const beats = LAYOUT_IDS.map((_, i) => ({ text: 'We grew 40% in 6 months, with 1,200 happy customers across the world.', start: i * 4, end: (i + 1) * 4 }));
const plan = planFilm(beats, { format, theme, seed: 11, picks: LAYOUT_IDS.map(l => ({ layout: l })) });
const s = await openFilm(plan, { scale: 0.45 });
for (const [i, sc] of plan.scenes.entries()) { writeFileSync(join(config.data, 'visual', `layout-${i}.jpg`), await s.frame(Math.round((sc.start + 2.4) * 30))); console.log(i, sc.layout.padEnd(12), sc.elements.map(e => e.art).join(' + ')); }
await s.close(); await closeVisual();
