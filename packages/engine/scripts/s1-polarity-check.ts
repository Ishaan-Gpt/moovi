// tsx scripts/s1-polarity-check.ts <s1url run dir>: the polarity lint on a finished run's picks (fill.json + words.json):
// prints every ✓-on-a-problem-line issue and which templates the repair would cross out.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadTemplates } from '@moovi/library/style-1/templates';
import { crossTicks, lintPicks, PROBLEM, ticks } from '../src/s1fast/fill';

const dir = process.argv[2]!, fill = JSON.parse(readFileSync(join(dir, 'fill.json'), 'utf8')), W = JSON.parse(readFileSync(join(dir, 'words.json'), 'utf8'));
const byId = new Map(loadTemplates().map(t => [t.id, t]));
const picks = fill.answer.scenes as { from: number; template: string; text: { id: string; value: string }[]; content: { id: string; value: string }[] }[];
const issues = lintPicks(picks as never, W, byId, '').filter(x => /✓/.test(x));
console.log(issues.length ? issues.map(x => `LINT ${x}`).join('\n') : 'LINT no ✓-on-a-problem-line issue');
picks.forEach((p, i) => {
  const t = byId.get(p.template); if (!t || !ticks(t)) return;
  const to = i + 1 < picks.length ? picks[i + 1]!.from - 1 : W.length - 1, said = W.slice(p.from, to + 1).map((w: { word: string }) => w.word).join(' ');
  const x = crossTicks(t, PROBLEM.test(said), Object.fromEntries(p.content.map(c => [c.id, c.value])));
  const killed = JSON.stringify(x.ops).match(/"kill"/g)?.length ?? 0;
  console.log(`scene ${i} ${p.template} "${said}": ${PROBLEM.test(said) ? 'problem line' : 'positive line'}, ${killed} row(s) crossed`);
});
