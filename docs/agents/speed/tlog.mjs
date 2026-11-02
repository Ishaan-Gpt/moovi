#!/usr/bin/env node
// tlog.mjs: the automatic timings log. Every stage gets an estimate BEFORE it starts and the machine clock after.
//   node docs/agents/speed/tlog.mjs start <filmDir> "<stage>" <estimate min>
//   node docs/agents/speed/tlog.mjs end   <filmDir> "<stage>" ["note: cause of any overrun"]
//   node docs/agents/speed/tlog.mjs total <filmDir>
// Writes <filmDir>/TIMINGS.md (a table) and <filmDir>/.timings.json (the raw clock). Over-runs of 25%+ are flagged
// so the cause is written while it is fresh: rework, rule found late, GPU wait, render, disk, restart, context loss.
import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
const [cmd, d, stage, x] = process.argv.slice(2);
if (!cmd || !d) { console.log(readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 7).join('\n')); process.exit(2); }
const dir = resolve(d), J = join(dir, '.timings.json'), MD = join(dir, 'TIMINGS.md');
const db = existsSync(J) ? JSON.parse(readFileSync(J, 'utf8')) : { stages: [] };
const hm = t => new Date(t).toTimeString().slice(0, 5), min = ms => Math.round(ms / 60000);
if (!existsSync(MD)) writeFileSync(MD, `# TIMINGS: ${basename(dir)} (estimate before, actual after; machine clock; written by docs/agents/speed/tlog.mjs)\n\n| Stage | Estimate | Start | End | Actual | Note |\n|---|---|---|---|---|---|\n`);
if (cmd === 'start') {
  db.stages.push({ stage, est: +x || 0, start: Date.now() });
  console.log(`started "${stage}" at ${hm(Date.now())}, estimate ${+x || '?'} min`);
} else if (cmd === 'end') {
  const s = [...db.stages].reverse().find(s => s.stage === stage && !s.end);
  if (!s) { console.log(`no open stage "${stage}"`); process.exit(1); }
  s.end = Date.now(); s.note = x || '';
  const act = min(s.end - s.start), over = s.est && act > s.est * 1.25;
  appendFileSync(MD, `| ${stage} | ${s.est || '?'} min | ${hm(s.start)} | ${hm(s.end)} | ${act} min${over ? ' **OVER**' : ''} | ${s.note} |\n`);
  console.log(`"${stage}": ${act} min against ${s.est} min${over ? ' -- OVER by ' + Math.round((act / s.est - 1) * 100) + '%: write the cause in the note (rework / late rule / GPU wait / render / disk / restart / context)' : ''}`);
} else if (cmd === 'total') {
  const done = db.stages.filter(s => s.end), first = Math.min(...db.stages.map(s => s.start)), last = Math.max(...done.map(s => s.end));
  const est = done.reduce((a, s) => a + s.est, 0), wall = min(last - first);
  const line = `| **TOTAL** | ${est} min (sum) | ${hm(first)} | ${hm(last)} | ${wall} min wall | ${wall <= 60 ? 'inside the hour' : 'over the hour by ' + (wall - 60) + ' min'} |`;
  appendFileSync(MD, line + '\n'); console.log(line);
}
writeFileSync(J, JSON.stringify(db, null, 1));
