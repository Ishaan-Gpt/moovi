// Launch mastery rounds (docs/agents/mastery/launch.md, decision 15): make the fixed six sites with pinned looks, arcs
// and seeds, and write one judge sheet per film from SETTLED frames (late in each beat, never mid-mask).
//   tsx --env-file=../../.env.local scripts/launch-mastery.ts make <round> [--sites raycast.com,cal.com] [--fresh-brief]
//   → data/launch-mastery/<round>/<site>.jpg (+ film.json, report) ; briefs pinned in data/launch-mastery/briefs/
// FalkorDB must be running (the Launch library lives there). Live previews only: no MP4.
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { config } from '../src/config';
import { contactSheet } from '../src/launch/player';
import { runStyle } from '../src/styles/run';

/** the fixed set, one look and arc each, so a round compares the same films across code versions */
export const PINS: Record<string, { look: string; arc: string }> = {
  'raycast.com': { look: 'l10', arc: 'launch-verbs' },
  'cal.com': { look: 'l04', arc: 'launch-pain-turn' },
  'resend.com': { look: 'l08', arc: 'launch-since' },
  'linear.app': { look: 'l02', arc: 'launch-manifesto' },
  'vercel.com': { look: 'l05', arc: 'launch-prompt' },
  'notion.so': { look: 'l07', arc: 'launch-chapters' },
};

const args = process.argv.slice(2), opt = (k: string) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : undefined; };
const [mode, round] = args;
const ROOT = join(config.data, 'launch-mastery');
if (mode !== 'make' || !round) throw new Error('usage: launch-mastery make <round> [--sites a,b] [--fresh-brief]');
const sites = (opt('sites') ?? Object.keys(PINS).join(',')).split(',');
const out = join(ROOT, round), briefs = join(ROOT, 'briefs');
mkdirSync(out, { recursive: true }); mkdirSync(briefs, { recursive: true });

for (const site of sites) {
  const pin = PINS[site]; if (!pin) throw new Error(`not in the fixed set: ${site}`);
  const brief = join(briefs, `${site}.json`);
  if (args.includes('--fresh-brief') && existsSync(brief)) rmSync(brief);
  const t0 = Date.now();
  const r = await runStyle('launch', { url: `https://${site}`, id: `m-${site.replace(/\W+/g, '-')}`, pin: { ...pin, seed: `mastery:${site}`, brief } });
  try {
    const F = JSON.parse(readFileSync(join(r.dir, 'film.json'), 'utf8')) as { W: number; H: number; duration: number; beats: { t0: number; t1: number }[] };
    // settled: one still per beat, 72% into it and at least 0.3 s before its end (a second still of one beat reads as a duplicate)
    const times = F.beats.map(b => +Math.min(b.t1 - 0.3, b.t0 + (b.t1 - b.t0) * 0.72).toFixed(2));
    times.sort((a, b) => a - b);
    const sheet = join(out, `${site}.png`);
    await contactSheet(r.preview, r.dir, F.duration, sheet, { W: F.W, H: F.H, times, per: 4, cell: 640 });
    mkdirSync(join(out, 'frames'), { recursive: true });
    times.forEach((t, k) => copyFileSync(join(r.dir, 'sheet', `o${t}.png`), join(out, 'frames', `${site}-${k}.png`)));
    copyFileSync(join(r.dir, 'film.json'), join(out, `${site}.film.json`));
    copyFileSync(join(r.dir, 'launch-report.json'), join(out, `${site}.report.json`));
    console.log(`${site}: ${((Date.now() - t0) / 1000).toFixed(1)} s → ${sheet}`);
  } finally { r.close(); }
}
writeFileSync(join(out, 'pins.json'), JSON.stringify(PINS, null, 1));
process.exit(0);
