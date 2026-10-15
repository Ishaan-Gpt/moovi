/**
 * The styles graph in FalkorDB: move the old file memory in, and look at what it knows.
 *   tsx scripts/styles-graph.ts migrate     data/library/<style>/{history,grown}.json + s4 sites.json → the graph (idempotent)
 *   tsx scripts/styles-graph.ts stats       films, set-ups and kept improvisations per style; PageRank's most-used set-ups
 *   tsx scripts/styles-graph.ts story <id>  why one film looks the way it does, beat by beat
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { closeMemory, ensureStylesSchema, run, STYLES, styles as G } from '@moovi/graph';
import { config } from '../src/config';

const [cmd = 'stats', arg] = process.argv.slice(2);
const read = <T>(f: string): T | null => { try { return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) as T : null; } catch { return null; } };
const STYLE_IDS = ['s5', 's4', 'darkvox', 'anatomy'];

if (cmd === 'migrate') {
  await ensureStylesSchema(STYLES);
  for (const style of STYLE_IDS) {
    const dir = join(config.data, 'library', style);
    const hist = read<{ id: string; setups: string[]; arc?: string; at?: string }[]>(join(dir, 'history.json')) ?? [];
    let films = 0, kept = 0;
    for (const [i, h] of hist.entries()) {
      const at = h.at ? Date.parse(h.at) : Date.now() - (hist.length - i) * 60_000, setups = (h.setups ?? []).filter(Boolean);
      // a film's site: the id's host part ("cal-com:1792…", "cal-com@…", "cal-com-2")
      const site = h.id.split(/[:@]/)[0]!.replace(/-\d+$/, '');
      await run(STYLES, G.rememberFilm, { style, id: h.id, at, project: null, setups });
      if (h.arc) await run(STYLES, G.filmArc, { id: h.id, arc: h.arc });
      if (site && !site.startsWith('script')) await run(STYLES, G.filmSite, { id: h.id, host: ['s4', 'anatomy'].includes(style) ? site : site.replace(/-(com|so|app|io|dev|ai|co|org)$/, '.$1') });
      if (setups.length > 1) await run(STYLES, G.coCast, { style, id: h.id, setups });
      films++;
    }
    for (const g of read<{ id: string; about: string; family: string }[]>(join(dir, 'grown.json')) ?? []) {
      await run(STYLES, G.growSetup, { style, id: g.id, data: JSON.stringify(g), about: g.about, family: g.family || 'generated', at: Date.now() });
      kept++;
    }
    console.log(`${style}: ${films} films, ${kept} kept improvisations moved into the graph`);
  }
}

if (cmd === 'migrate' || cmd === 'stats') {
  console.log('\nstyle      films  set-ups  kept');
  for (const r of await run<{ style: string; films: number; setups: number; kept: number }>(STYLES, G.styleStats)) console.log(`${r.style.padEnd(10)} ${String(r.films).padStart(5)}  ${String(r.setups).padStart(7)}  ${String(r.kept).padStart(4)}`);
  for (const style of STYLE_IDS) {
    const hot = await run<{ id: string; score: number }>(STYLES, G.overUsed, { style, n: 3 });
    if (hot.length) console.log(`${style} leans on (PageRank): ${hot.map(h => `${h.id} ${h.score.toFixed(3)}`).join(' · ')}`);
  }
}

if (cmd === 'story') {
  const rows = await run<{ style: string; arc: string; site: string; beat: number; setup: string; improvised: boolean; uses: number }>(STYLES, G.filmStory, { id: arg });
  if (!rows.length) console.log(`no film "${arg}" in the graph`);
  else { console.log(`${arg}: ${rows[0]!.style}, arc ${rows[0]!.arc ?? '-'}, site ${rows[0]!.site ?? '-'}`); for (const r of rows) console.log(`  beat ${r.beat}: ${r.setup}${r.improvised ? ' (improvised, kept)' : ''} · used ${r.uses}× by this style`); }
}
await closeMemory();
