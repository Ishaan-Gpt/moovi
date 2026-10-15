// Speed check for the footage search: every source asked one after another vs all at once, per scene query,
// then one full find (search, rank, download, frame checks) with its own timings. No FalkorDB needed.
// pnpm --filter @moovi/engine exec tsx scripts/footage-bench.ts "server racks" "rocket launch"
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ADAPTERS } from '../src/footage/sources';
import { activeSources, findClips } from '../src/footage';

const queries = process.argv.slice(2).length ? process.argv.slice(2) : ['data center servers', 'city traffic at night', 'rocket launch'];
const sources = activeSources();
const ask = async (p: (typeof sources)[number], q: string) => { const t = Date.now(); const r = await ADAPTERS[p](q, 8).catch(() => []); return { p, n: r.length, ms: Date.now() - t }; };
const rows: string[] = [];
for (const q of queries) {
  let t = Date.now();
  const serial = [];
  for (const p of sources) serial.push(await ask(p, q));
  const serialMs = Date.now() - t;
  t = Date.now();
  const par = await Promise.all(sources.map(p => ask(p, q)));
  const parMs = Date.now() - t;
  rows.push(`${q.padEnd(24)} serial ${(serialMs / 1000).toFixed(1)} s  parallel ${(parMs / 1000).toFixed(1)} s  (${par.map(x => `${x.p} ${x.n} in ${(x.ms / 1000).toFixed(1)} s`).join(', ')})`);
  console.log(rows.at(-1));
}
const q = queries[0]!;
const r = await findClips(q, { dir: join(tmpdir(), 'moovi-footage-bench'), want: 2, tries: 4 });
console.log(`full find "${q}": ${r.accepted.length} passed, ${r.rejected.length} turned down, search ${((r.timings?.searchMs ?? 0) / 1000).toFixed(1)} s, total ${((r.timings?.totalMs ?? 0) / 1000).toFixed(1)} s, downloads ${JSON.stringify(r.timings?.downloads.map(d => `${d.provider} ${(d.ms / 1000).toFixed(1)}s ${d.ok ? 'ok' : 'fail'}`))}`);
for (const c of r.accepted) console.log(`  ${c.provider} ${c.licence} ${c.title.slice(0, 60)}`);
process.exit(0);
