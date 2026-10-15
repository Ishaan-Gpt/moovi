// pnpm --filter @moovi/engine exec tsx scripts/footage.ts "rocket launch" [--want 2] [--out dir]
// The clip fetcher on its own: every source asked at once, ranked, downloaded, judged; prints what passed, what did
// not and why, and the time each step took. No FalkorDB needed.
import { join } from 'node:path';
import { config } from '../src/config';
import { activeSources, findClipsOrStill } from '../src/footage';

const args = process.argv.slice(2);
const flag = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args.splice(i, 2)[1] : undefined; };
const want = Number(flag('--want') ?? 2);
const out = flag('--out') ?? join(config.data, 'footage-test');
const query = args.join(' ') || 'rocket launch';
console.log(`searching "${query}" on ${activeSources().join(', ')}`);
const r = await findClipsOrStill(query, { dir: out, want, log: s => console.log(`  ${s}`) });
for (const c of r.accepted) console.log(`KEPT  ${c.provider.padEnd(8)} ${c.relevance.toFixed(2)} ${c.title.slice(0, 60)} | ${c.licence} | ${c.path}`);
for (const c of r.rejected) console.log(`NO    ${c.provider.padEnd(8)} ${c.relevance.toFixed(2)} ${c.title.slice(0, 60)} | ${c.why.join(', ')}`);
console.log(JSON.stringify({ found: r.found, kept: r.accepted.length, timings: r.timings }));
