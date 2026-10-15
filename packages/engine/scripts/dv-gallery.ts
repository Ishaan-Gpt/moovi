// Dark Vox: every library set-up (and a few improvised specs) staged once on a sample line, as one contact sheet
// (data/darkvox/gallery-sheet.png). No model, no voice: word timings are synthesised. For looking at the library.
//   tsx scripts/dv-gallery.ts [--only id,id] [--color #hex] [--at 1.9]
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { config } from '../src/config';
import { compose, darkWorld, type ShotPlan } from '../src/darkvox/film';
import { DV_SETUPS, VOCAB } from '../src/darkvox/library';
import { propFor } from '../src/darkvox/props';
import { serveDarkVox } from '../src/darkvox/player';
import { sketch } from '../src/styles/kit/compose';
import { detectNeeds } from '../src/styles/kit/needs';
import type { Piece, Word } from '../src/s4/compose';

const args = process.argv.slice(2), opt = (k: string) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : undefined; };
const only = opt('only')?.split(','), at = Number(opt('at') ?? 1.9);
const LINES: Record<string, string> = {
  list: 'Calendars, payments, and reminders, in one place.',
  number: 'Over 40,000 teams book with it.',
  compare: 'The old inbox loses, the new desk wins.',
  quote: 'They said it felt like magic every morning.',
  time: 'Every hour you wait costs the night.',
  default: 'The lantern finally found the open door.',
};
const lineFor = (s: (typeof DV_SETUPS)[number]) => (s.items ? LINES.list! : s.number === 'required' ? LINES.number! : s.needs.includes('compare') ? LINES.compare! : s.wants === 'line' ? LINES.quote! : s.needs[0] === 'time' ? LINES.time! : LINES.default!);
const setups = DV_SETUPS.filter(s => !only || only.includes(s.id));
const extra = !only || only.includes('compose') ? ['solo', 'pair', 'procession', 'rain', 'orbit', 'stair', 'frame', 'pedestal'] : [];
const dur = 2.8;
let t = 0.2; const words: Word[] = [], ps: Piece[] = [], plan: ShotPlan[] = [];
const sets = ['velvet', 'night', 'checker', 'harlequin', 'wood', 'swirl', 'sunburst', 'grid', 'waves'] as const;
const all = [...setups.map(s => ({ id: s.id, s, text: lineFor(s) })), ...extra.map(l => ({ id: `compose:${l}`, s: null, text: l === 'pair' ? LINES.compare! : l === 'procession' ? LINES.list! : LINES.default! }))];
all.forEach((x, i) => {
  const ws = x.text.split(' ').map((w, j) => ({ word: w, t: +(t + j * (1.6 / x.text.split(' ').length)).toFixed(2), end: +(t + (j + 0.8) * (1.6 / x.text.split(' ').length)).toFixed(2) }));
  words.push(...ws); ps.push({ text: x.text, words: ws }); t += dur;
  const key = x.text.split(' ').map(w => w.replace(/[^\w,]/g, '')).filter(w => w.length > 3).sort((a, b) => b.length - a.length)[0]!.replace(/,/g, '');
  const show = x.s?.number === 'required' ? ['40,000'] : x.s?.items ? [] : [key];
  const props: string[] = []; for (let k = 0; k < 5; k++) props.push(propFor(`${x.text} ${k} ${i}`, props));
  const p: ShotPlan = { setup: x.s ? x.s.id : 'sketch', set: x.s ? x.s.sets[i % x.s.sets.length]! : sets[i % sets.length]!, move: 'hold', transition: 'cut', show, look: i % 3 === 0 ? 'label' : i % 3 === 1 ? 'title' : 'engraved', marker: i % 3 === 0, props, picture: false, pictureNoun: '', dress: x.s?.dress, why: '', line: i };
  if (!x.s) { const sp = sketch({ text: x.text, words: ws, needs: detectNeeds(x.text) }, VOCAB); sp.layout = x.id.split(':')[1]!; for (const e of sp.elements) if (e.kind === 'shape' && e.icon) e.kind = 'prop'; p.spec = sp; }
  plan.push(p);
});
const dir = join(config.data, 'darkvox', '_gallery'); mkdirSync(dir, { recursive: true });
const world = darkWorld('demo', opt('color') ?? '#A8282B');
const { film } = compose({ id: '_gallery', world, words, pieces: ps, plan, pics: ps.map(() => null), duration: t, audio: '', picUrl: f => f });
writeFileSync(join(dir, 'film.json'), JSON.stringify(film));
const { url, close } = await serveDarkVox(dir, 0);
const b = await chromium.launch({ headless: true, ...(config.chrome.path ? { executablePath: config.chrome.path } : { channel: config.chrome.channel }) });
const page = await b.newPage({ viewport: { width: 270, height: 480 } });
page.on('pageerror', e => console.log('pageerror:', String(e)));
page.on('console', m => { if (m.type() === 'error') console.log('console:', m.text().slice(0, 400)); });
await page.goto(`${url}?t=0`); await page.waitForFunction('window.__ready || window.__error', null, { timeout: 60_000 });
const err = await page.evaluate('window.__error'); if (err) throw new Error(String(err));
console.log('setup errors:', await page.evaluate('window.__setupErrors || []'));
const cells: string[] = [];
for (const [i, x] of all.entries()) {
  const tt = film.shots[i]!.t0 + at;
  await page.evaluate(`window.__render(${tt})`); await page.waitForTimeout(30);
  const buf = await page.screenshot({ type: 'jpeg', quality: 85 });
  cells.push(`<div class="c"><b>${x.id}</b><img src="data:image/jpeg;base64,${buf.toString('base64')}"></div>`);
}
const per = 9;
await page.setViewportSize({ width: per * 274 + 20, height: 600 });
await page.setContent(`<html><body style="margin:0;padding:10px;background:#111;color:#ddd;font:13px system-ui"><div style="display:grid;grid-template-columns:repeat(${per},270px);gap:4px">${cells.join('')}</div><style>.c img{width:270px;height:480px;display:block}</style></body></html>`);
const out = join(config.data, 'darkvox', only ? 'gallery-part.jpg' : 'gallery-sheet.jpg');
await page.screenshot({ path: out, fullPage: true, type: 'jpeg', quality: 80 }); await b.close(); close();
console.log(out, all.length);
