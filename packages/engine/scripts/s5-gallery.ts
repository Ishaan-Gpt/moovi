// Clear Signal library gallery: one beat per set-up (plus improvised specs through the composer), each on a line
// that suits it, rendered by the live player and captured late in its beat. A visual check of every renderer:
//   tsx scripts/s5-gallery.ts [--only id,id] [--accent #hex]  → data/s5/gallery/sheet-<n>.png
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { config } from '../src/config';
import { sketch, detectNeeds, type Spec } from '../src/styles/kit';
import { buildTheme } from '../src/s1fast/theme';
import { S5_LIBRARY, S5_VOCAB } from '../src/s5/library';
import { beatData, type Beat, type Film, type Word } from '../src/s5/plan';
import { servePlayer } from '../src/s5/player';

const LINES: Record<string, string> = {
  hero: 'Scheduling is the quiet tax on every team.', words: 'Calm, every single day.', serif: "It isn't louder. It's clearer.", quote: 'It finally feels like the calendar works for me.',
  question: 'Why does booking one call take ten emails?', circle: 'Less back and forth. More time.', underline: 'Your time, finally yours.', stamp: 'Booked, confirmed, done.',
  dial: 'Every minute spent waiting costs you.', stopwatch: 'Set up in 5 minutes.', calendar: 'Your week fills itself, day by day.', hourglass: 'Meanwhile, the deadline gets closer.',
  meter: 'Pages load faster than ever.', ruler: 'Founded in 2019, open source since day one.', crowd: 'Built for teams and their customers.', spotlight: 'One person runs the whole thing.',
  avatars: 'Thousands of people already use it.', pair: 'It connects you and your clients.', cards: 'Too many messages, too much noise.', chat: 'Your team talks in one place.',
  inbox: 'Your inbox fills with 40 requests.', notifs: 'Notifications pile up all day.', counter: 'Over 12,000 teams use it.', slam: '99% of calls start on time.',
  percent: 'It cuts no-shows by 40%.', dots: 'Only 3% of leads ever reply.', coins: 'Save money on every booking.', tag: 'Plans start at $15.',
  receipt: 'Hosting, seats, and add-ons add up.', bars: 'Bookings grow every month.', linechart: 'Revenue keeps rising.', donut: '60% of the work is admin.',
  versus: 'Old spreadsheets versus a live calendar.', wipe: 'From messy threads to one clean link.', xcheck: 'Not more meetings, better meetings.', balance: 'Compare the cost against the value.',
  toggle: 'One switch turns on routing.', nodes: 'Calendars, payments, and video calls.', pills: 'Fast, private, and free.', checklist: 'Pick a time, add details, and confirm.',
  steps: 'Connect, share, then get booked.', tiles: 'Zoom, Stripe, Slack, and Google.', podium: 'Rated the best scheduling tool.', pyramid: 'Teams, managers, and leaders all see it.',
  layers: 'Data, logic, and interface stack together.', flow: 'Requests flow from form to calendar.', funnel: 'It filters the noise into one answer.', cycle: 'It syncs again and again, automatically.',
  orbit: 'Everything connects around one core.', hub: 'One hub links every tool you use.', pins: 'Meet locally in any city.', globe: 'Teams across the world book in seconds.',
  magnifier: 'It finds the one slot that works.', target: 'Every invite lands exactly right.', lock: 'Your data stays private and secure.', warning: 'One double booking breaks trust.',
  slider: 'Scale up whenever you need.', cursor: 'One click to book.', browser: 'Your booking page builds itself.', phone: 'It works from your phone.',
  search: 'Find the right time instantly.', bulb: 'The idea is simple.', puzzle: 'It fits right into your stack.', rocket: 'Launch your page today.', emblem: 'Meet your new scheduling page.', mark: 'Meet Gallery.',
};
const args = process.argv.slice(2), opt = (k: string) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : undefined; };
const only = opt('only')?.split(',');
const ids = (only ?? S5_LIBRARY.map(s => s.id)).filter(id => LINES[id]);
const composeLines = only ? [] : ['Three tools become one.', 'From idea to launch in a week.', 'Your data, your rules, your servers.', 'Teams ship 3x faster.'];

const beats: Beat[] = []; let t = 0.2;
const add = (setup: string, text: string, spec?: Spec) => {
  const ws: Word[] = text.split(/\s+/).map((w, i) => ({ word: w, t: +(t + 0.25 + i * 0.3).toFixed(2), end: +(t + 0.25 + i * 0.3 + 0.26).toFixed(2) }));
  const t1 = ws.at(-1)!.end + 0.9, d = beatData(ws);
  beats.push({ setup, cast: setup, t0: +t.toFixed(2), t1: +t1.toFixed(2), ...d, needs: detectNeeds(text), down: false, spec, why: 'gallery' });
  t = t1;
};
for (const id of ids) add(id, LINES[id]!);
for (const l of composeLines) { const ws = l.split(/\s+/).map((w, i) => ({ word: w, t: i * 0.3, end: i * 0.3 + 0.26 })); add('compose', l, sketch({ text: l, words: ws, needs: detectNeeds(l) }, S5_VOCAB)); }
// two hand-written specs (what a model returns) through the composer, on two layouts sketch() never picks
const spec = (layout: string, els: Spec['elements']): Spec => ({ layout, about: 'gallery', needs: ['network'], elements: els });
add('compose', 'Notes, tasks, and docs live together.', spec('ring', [{ kind: 'icon', icon: 'doc', word: 0, size: 'm', tone: 'accent', motion: 'pop' }, { kind: 'icon', icon: 'list', word: 2, size: 'm', tone: 'ink', motion: 'pop' }, { kind: 'icon', icon: 'folder', word: 4, size: 'm', tone: 'paper', motion: 'pop' }, { kind: 'shape', shape: 'diamond', word: 5, size: 's', tone: 'muted', motion: 'spin' }, { kind: 'word', text: 'together', word: 5, size: 'l', tone: 'ink', motion: 'rise' }]));
add('compose', 'Plan it, build it, ship it.', spec('path', [{ kind: 'icon', icon: 'edit', word: 0, size: 'm', tone: 'paper', motion: 'pop' }, { kind: 'label', text: 'Plan', word: 0, size: 's', tone: 'ink', motion: 'rise' }, { kind: 'icon', icon: 'code', word: 2, size: 'm', tone: 'accent', motion: 'pop' }, { kind: 'label', text: 'build', word: 2, size: 's', tone: 'ink', motion: 'rise' }, { kind: 'icon', icon: 'rocket', word: 4, size: 'm', tone: 'ink', motion: 'grow' }, { kind: 'label', text: 'ship', word: 4, size: 's', tone: 'ink', motion: 'rise' }, { kind: 'arrow', word: 2, size: 'm', tone: 'ink', motion: 'draw' }, { kind: 'arrow', word: 4, size: 'm', tone: 'ink', motion: 'draw' }]));

const th = buildTheme({ name: 'Gallery', primary: opt('accent') ?? '#2B67C6' });
const film: Film = { id: 'gallery', duration: t + 2.2, colors: { paper: th.stage, ink: th.ink, accent: th.accent, grey: '#8A8F98' }, beats, end: { t0: t, name: 'Gallery', line: 'gallery.test' }, audio: '/v/none.wav', arc: 'gallery' };
const dir = join(config.data, 's5', 'gallery'); mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, 'film.json'), JSON.stringify(film, null, 1));
const { url, close } = await servePlayer(dir, 0);
const br = await chromium.launch({ headless: true, ...(config.chrome.path ? { executablePath: config.chrome.path } : { channel: config.chrome.channel }) });
const page = await br.newPage({ viewport: { width: 270, height: 480 } });
const errs: string[] = []; page.on('pageerror', e => errs.push(String(e))); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto(`${url}?t=0`); await page.waitForFunction('window.__ready || window.__error', null, { timeout: 60_000 });
const err = await page.evaluate('window.__error'); if (err) throw new Error(String(err));
const cells: string[] = [];
for (const b of beats) {
  const tt = b.t0 + (b.t1 - b.t0) * 0.86;
  await page.evaluate(`window.__render(${tt})`);
  const f = join(dir, `g-${cells.length}.png`); await page.screenshot({ path: f });
  cells.push(`<div class="c"><b>${b.setup === 'compose' ? `compose:${b.spec?.layout}` : b.setup}</b><img src="data:image/png;base64,${readFileSync(f).toString('base64')}"></div>`);
}
const per = 10, chunk = 30, out: string[] = [];
for (let k = 0; k < cells.length; k += chunk) {
  await page.setViewportSize({ width: per * 274 + 20, height: 600 });
  await page.setContent(`<html><body style="margin:0;padding:10px;background:#111;color:#ddd;font:13px system-ui"><div style="display:grid;grid-template-columns:repeat(${per},auto);gap:4px">${cells.slice(k, k + chunk).join('')}</div><style>.c img{width:270px;height:480px;display:block}.c b{display:block;padding:2px 0}</style></body></html>`);
  const p = join(dir, `sheet-${k / chunk + 1}.png`); await page.screenshot({ path: p, fullPage: true }); out.push(p);
}
await br.close(); close();
for (let k = 0; k < cells.length; k++) rmSync(join(dir, `g-${k}.png`), { force: true });
console.log(out.join('\n'));
if (errs.length) console.log('ERRORS:\n' + errs.join('\n'));
