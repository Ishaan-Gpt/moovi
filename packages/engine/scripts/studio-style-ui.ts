// tsx scripts/studio-style-ui.ts <s1|s4|s5|darkvox|anatomy> <https://site> : run ONE style reel through the studio's UI in a
// real (headless) Chrome, the way a person does it: sign in on the door, "+" New project on the dashboard, pick the
// style in the brief box, paste the URL, send; then watch the chat until the video pops up, press Play inside the popup's
// live player, and screenshot it into data/studio-proof/<style>.png. Prints the stage times the chat showed.
// Local verification only (the local test account in data/checks/studio-test-account.txt).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { config } from '../src/config';
import { styleOf, type StyleId } from '../src/styles';
import { table } from '../src/styles/run';

const argv = process.argv.slice(2), oi = argv.indexOf('--open'), openUrl = oi >= 0 ? argv.splice(oi, 2)[1] : undefined;
const [style, url] = argv as [StyleId, string];
const info = styleOf(style);
if (!info || !url) throw new Error('usage: studio-style-ui <s1|s4|s5|darkvox|anatomy> <https://site>');
const acct = readFileSync(join(config.data, 'checks', 'studio-test-account.txt'), 'utf8');
const email = acct.match(/email: (.+)/)![1]!.trim(), password = acct.match(/password: (.+)/)![1]!.trim();
const base = process.env.STUDIO_URL ?? 'http://localhost:3100';
const out = join(config.data, 'studio-proof'); mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
// reduced motion: the office's WebGL set (software-rendered here) would otherwise eat the CPU the pipeline needs
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
const page = await ctx.newPage();
const errors: string[] = [];
page.on('pageerror', e => errors.push(String(e)));

// the door
await page.goto(`${base}/studio/auth`, { waitUntil: 'networkidle', timeout: 120_000 });
await page.waitForTimeout(1000); // hydration: the form's inputs are React state
await page.fill('input[type=email]', email);
await page.fill('input[type=password]', password);
await page.click('button.door__go');
await page.waitForURL(u => !u.pathname.endsWith('/auth'), { timeout: 180_000, waitUntil: 'commit' });
let t0 = Date.now();
if (openUrl) { // --open <office url>: an office whose reel is already made; open its video from the dock
  await page.goto(openUrl, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.waitForSelector('.vdock, .vpop__frame', { timeout: 120_000 });
  if (await page.$('.vdock')) await page.click('.vdock');
} else {
// the dashboard's "+"
await page.goto(`${base}/studio`, { waitUntil: 'networkidle', timeout: 120_000 });
await page.waitForTimeout(800);
await page.click('button.card--new');
await page.waitForURL(/\/studio\/p\/[^/]+\/c\//, { timeout: 120_000 });
await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => undefined);
await page.waitForSelector('.nb__styles', { timeout: 120_000 });
await page.waitForTimeout(800);
// the brief box: the style, the URL, send
await page.getByRole('radio', { name: new RegExp(info.name) }).click();
await page.fill('input.nb__url', url);
await page.screenshot({ path: join(out, `${style}-brief.png`) });
t0 = Date.now();
await page.click('button.nb__send');
console.log(`sent ${info.name} for ${url} → ${page.url()}`);
}

// the chat until the popup's live player is up. While it waits, the set's WebGL and glass are switched off: in this
// headless Chrome they are software-rendered and would take the CPU the pipeline itself needs (a person's browser draws
// them on the GPU). The stage progress (desks, chat rows) is plain DOM and keeps updating; the set comes back for the shot.
const calm = await page.addStyleTag({ content: 'canvas{display:none!important}*{backdrop-filter:none!important;-webkit-backdrop-filter:none!important;animation-play-state:paused!important}' });
const frameEl = await page.waitForSelector('.vpop__frame.is-live iframe', { timeout: 15 * 60_000 });
await calm.evaluate(n => (n as Element).remove());
const previewReady = +((Date.now() - t0) / 1000).toFixed(1);
console.log(`popup with the live player after ${previewReady}s`);
const frame = (await frameEl.contentFrame())!;
// ready: the s4/s5/Dark Vox players set window.__ready; Style 1's engine page is ready when its audio can play
await frame.waitForFunction('window.__ready || window.__error || (window.MotionEasy && document.querySelector("audio") && document.querySelector("audio").readyState >= 3)', null, { timeout: 180_000 }).catch(e => errors.push(`ready: ${String(e).slice(0, 120)}`));
await frame.waitForFunction('document.querySelector("audio") && document.querySelector("audio").readyState >= 3', null, { timeout: 120_000 }).catch(() => undefined);
await page.waitForTimeout(1000);
const button = frame.locator('#p, button#p, main .bar button').first();
await button.click().catch(e => errors.push(`play: ${String(e).slice(0, 120)}`));
await frame.waitForFunction('document.querySelector("audio").currentTime > 3.5', null, { timeout: 60_000 }).catch(e => errors.push(`playing: ${String(e).slice(0, 120)}`));
await page.screenshot({ path: join(out, `${style}.png`) });
const played = await frame.evaluate('(() => { const a = document.querySelector("audio"); return a ? { t: a.currentTime, paused: a.paused, dur: a.duration } : null })()');
console.log(`player: ${JSON.stringify(played)}`);
// the stage times: they arrive in the popup once the job is done (after the contact sheet)
await page.waitForSelector('.vpop__times dd.is-sum', { timeout: 10 * 60_000 }).catch(() => undefined);
await page.waitForFunction(() => [...document.querySelectorAll('.vpop__times dt')].some(d => d.textContent === 'total'), null, { timeout: 10 * 60_000 }).catch(() => undefined);
const times = await page.$$eval('.vpop__times dt', dts => dts.map(d => [d.textContent ?? '', parseFloat(d.nextElementSibling?.textContent ?? 'NaN')] as [string, number]));
const timings = Object.fromEntries(times.map(([k, v]) => [k.replace(' ', '_'), v]));
await page.screenshot({ path: join(out, `${style}-times.png`) });
const wall = +((Date.now() - t0) / 1000).toFixed(1);
console.log(`\n${table({ studio_ui: timings })}\npreview in the popup ${previewReady}s after Send · job done ${wall}s${errors.length ? `\npage errors: ${errors.slice(0, 5).join(' | ')}` : ''}`);
writeFileSync(join(out, `${style}${openUrl ? '-open' : ''}.json`), JSON.stringify({ style, url, office: page.url(), previewReady, wall, timings, played, errors }, null, 1));
await browser.close();
