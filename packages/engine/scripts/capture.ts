// pnpm --filter @moovi/engine exec tsx scripts/capture.ts https://example.com [--landscape] [--quote "a sentence on the page"]
// The Researcher's browser on its own: reads the page, shoots the hero and sections, makes the smooth scroll capture
// and (with --quote) the highlighted proof shot. Prints the files and the time each step took. No FalkorDB needed.
import { join } from 'node:path';
import { config } from '../src/config';
import { Reader } from '../src/research/capture';

const args = process.argv.slice(2);
const flag = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args.splice(i, 2)[1] : undefined; };
const quote = flag('--quote');
const landscape = args.includes('--landscape');
const url = args.find(a => !a.startsWith('--')) ?? 'https://falkordb.com';
const reader = new Reader(join(config.data, 'capture-test'), landscape ? 'landscape' : 'vertical');
try {
  const t0 = Date.now();
  const p = await reader.read(url);
  const t1 = Date.now();
  console.log(`${p.title} | HTTP ${p.status} | ${p.text.split(' ').length} words | wall ${p.wall} | ${((t1 - t0) / 1000).toFixed(1)} s ${JSON.stringify(p.ms)}`);
  for (const s of p.shots) console.log(`  ${s.kind.padEnd(8)} ${s.video ? `${s.seconds?.toFixed(1)} s video` : 'png'} ${s.w}×${s.h} ${s.path}`);
  if (quote) { const pr = await reader.proof(p.url, quote); console.log(pr ? `  proof    ${pr.path} (${((Date.now() - t1) / 1000).toFixed(1)} s)` : '  proof    quote not found on screen'); }
} finally { await reader.close(); }
