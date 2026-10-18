// The brain's picks over a launch-ui read (C1 go 2026-10-18 04:57 IST: picks by id, never a hex or a URL; launch-ui.ts
// stays the server's and is not touched). Reads <dir>/data.json as launch-ui.ts wrote it, keeps that copy as
// data.launch-ui.json, asks direct:film for card order, closing line and brand mark by number, and writes
// data.json back in the same shape. The player beside it runs unchanged.
//   tsx scripts/direct-film-ui.ts <dir> [--brief "launch film for developers"] [--dry]
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { applyUiPicks, directFilmUi, uiStep, type LaunchUiData } from '../src/router/direct-film-ui';

const args = process.argv.slice(2), opt = (k: string) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : undefined; };
const dir = args.find(a => !a.startsWith('--') && a !== opt('brief'));
if (!dir) { console.error('usage: tsx scripts/direct-film-ui.ts <launch-ui out dir> [--brief "..."] [--dry]'); process.exit(2); }
const keep = join(dir, 'data.launch-ui.json'), file = join(dir, 'data.json');
// always pick over the site's own read, never over an earlier pick
const d = JSON.parse(readFileSync(existsSync(keep) ? keep : file, 'utf8')) as LaunchUiData;
const brief = opt('brief') ?? `a short launch film for ${d.name}`;
if (args.includes('--dry')) { const s = uiStep(d, brief); console.log(s.prompt); console.log(`tokens ${s.tokens}, fits ${s.fits}`); process.exit(0); }
const T0 = Date.now();
const r = await directFilmUi(d, brief, { log: s => console.log(s) });
const secs = ((Date.now() - T0) / 1000).toFixed(1);
if (!r.value) { console.log(`direct:film ui: kept launch-ui's data.json (${r.source}; ${r.problems.flat().join('; ') || 'no answer'}) in ${secs} s`); process.exit(0); }
if (!existsSync(keep)) copyFileSync(file, keep);
const out = applyUiPicks(d, r.value);
writeFileSync(file, JSON.stringify(out, null, 1));
console.log(`direct:film ui: ${r.source} after ${r.tries} tries in ${secs} s · cards ${r.value.cards.join(',')} · tagline ${r.value.tagline} · mark ${r.value.mark} · ${r.value.why}`);
console.log(`  cards: ${out.cards.join(' / ')}`);
console.log(`  tagline: "${out.tagline}"`);
