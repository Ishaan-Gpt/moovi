// tsx scripts/preview-check.ts <studio preview url> [shot.png] : sign in with the local test account, open one
// live-preview page (/studio/api/projects/<p>/preview/<c>/<v>/), list EVERY request it makes with its status, its
// console errors, press Play, and screenshot it mid-play. Local verification only.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { config } from '../src/config';

const [target, shot] = process.argv.slice(2) as [string, string | undefined];
if (!target) throw new Error('usage: preview-check <preview url> [shot.png]');
const acct = readFileSync(join(config.data, 'checks', 'studio-test-account.txt'), 'utf8');
const email = acct.match(/email: (.+)/)![1]!.trim(), password = acct.match(/password: (.+)/)![1]!.trim();
const base = new URL(target).origin;
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await page.goto(`${base}/studio/auth`, { waitUntil: 'networkidle', timeout: 120_000 });
await page.waitForTimeout(1000);
await page.fill('input[type=email]', email);
await page.fill('input[type=password]', password);
await page.click('button.door__go');
await page.waitForURL(u => !u.pathname.endsWith('/auth'), { timeout: 180_000, waitUntil: 'commit' }).catch(async e => { await page.screenshot({ path: join(config.data, 'studio-proof', 'preview-check-door.png') }); throw e; });
const T0 = Date.now();
const pending = new Set<string>();
page.on('request', r => pending.add(r.url().replace(base, '')));
page.on('requestfinished', r => pending.delete(r.url().replace(base, '')));
page.on('requestfailed', r => pending.delete(r.url().replace(base, '')));
const reqs: string[] = [], bad: string[] = [], logs: string[] = [];
page.on('response', r => { const l = `${r.status()} +${Date.now() - T0}ms ${r.url().replace(base, '')}`; reqs.push(l); if (r.status() >= 400) bad.push(l); });
page.on('request', r => { if (/fonts|motioneasy|.json|.wav|.png/.test(r.url())) reqs.push(`REQ +${Date.now() - T0}ms ${r.url().replace(base, '')}`); });
page.on('requestfailed', r => bad.push(`FAILED ${r.url().replace(base, '')} ${r.failure()?.errorText}`));
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`${m.type()}: ${m.text().slice(0, 300)}`); });
page.on('pageerror', e => logs.push(`pageerror: ${String(e).slice(0, 300)}`));
// an office URL (/studio/p/<p>/c/<c>): open its video popup and check the player inside the iframe, as a person sees it
let f: import('playwright-core').Page | import('playwright-core').Frame = page;
if (/\/studio\/p\//.test(target)) {
  await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.waitForSelector('.vdock, .vpop__frame', { timeout: 120_000 });
  if (process.env.DBG) console.log('DBG lag', await page.evaluate(`(async () => { const r = []; for (let i = 0; i < 5; i++) { const t = performance.now(); await new Promise(x => setTimeout(x, 0)); r.push(Math.round(performance.now() - t)); } return r.join(',') + ' canvases ' + document.querySelectorAll('canvas').length })()`));
  if (process.env.DBG) console.log('DBG fetch before popup', await page.evaluate(async (pre: string) => { const r: string[] = []; for (const u of ['ref.json', 'engine/fonts/anton-latin-400-normal.woff2', 'ref.json']) { const t = performance.now(); await (await fetch(pre + u, { cache: 'no-store' })).arrayBuffer(); r.push(`${u.slice(-12)} ${Math.round(performance.now() - t)}`); } return r.join(', '); }, target.replace(/\/studio\/p\/(p[0-9a-f]+)\/c\/(c[0-9a-f]+).*/, '/studio/api/projects/$1/preview/$2/1/')));
  if (process.env.HIDE) await page.addStyleTag({ content: '*{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}' + (process.env.HIDE === '2' ? 'canvas{display:none!important}' : '') });
  if (await page.$('.vdock')) await page.click('.vdock');
  f = (await (await page.waitForSelector('.vpop__frame.is-live iframe', { timeout: 60_000 })).contentFrame())!;
  page.on('frameattached', () => undefined);
} else await page.goto(target, { waitUntil: process.env.DBG ? 'commit' : 'networkidle', timeout: 120_000 });
if (process.env.DBG) {
  const t = Date.now();
  const lagOf = (x: typeof f) => x.evaluate(`(async () => { const r = []; for (let i = 0; i < 5; i++) { const t = performance.now(); await new Promise(z => setTimeout(z, 0)); r.push(Math.round(performance.now() - t)); } const t2 = performance.now(); await new Promise(z => requestAnimationFrame(() => requestAnimationFrame(z))); r.push('raf2=' + Math.round(performance.now() - t2)); return r.join(',') })()`);
  const pre = target.replace(/\/studio\/p\/(p[0-9a-f]+)\/c\/(c[0-9a-f]+).*/, '/studio/api/projects/$1/preview/$2/1/');
  console.log('DBG parent fetch in popup', await page.evaluate(async (pre: string) => { const t = performance.now(); await Promise.all(['anton-latin-400-normal', 'pacifico-latin-400-normal', 'inter-latin-wght-normal'].map(async u => (await fetch(`${pre}engine/fonts/${u}.woff2?x=${Math.random()}`, { cache: 'no-store' })).arrayBuffer())); const t2 = performance.now(); await (await fetch('/studio/icon.svg?x=' + Math.random(), { cache: 'no-store' })).text(); return `3 fonts ${Math.round(t2 - t)} ms, icon ${Math.round(performance.now() - t2)} ms`; }, pre));
  console.log('DBG lag in popup: frame', await lagOf(f), 'parent', await lagOf(page));
  setTimeout(() => console.log('DBG pending at +10s: ' + [...pending].join(' | ')), 10_000);
  await f.waitForFunction('document.getElementById("t") && document.getElementById("t").textContent !== "0.0 / 0.0"', null, { timeout: 240_000, polling: 250 }).catch(() => undefined);
  console.log(`DBG loaded after ${Date.now() - t} ms`);
}
await f.waitForFunction('window.__ready || window.__error || (document.querySelector("audio") && document.querySelector("audio").readyState >= 3)', null, { timeout: 90_000 }).catch(e => logs.push(`ready: ${String(e).slice(0, 120)}`));
await page.waitForTimeout(800);
await f.locator('#p, main .bar button').first().click().catch(e => logs.push(`play: ${String(e).slice(0, 120)}`));
await f.waitForFunction(`document.querySelector("audio").currentTime > ${Number(process.env.AT ?? 4)}`, null, { timeout: 120_000 }).catch(e => logs.push(`playing: ${String(e).slice(0, 120)}`));
if (shot) await page.screenshot({ path: shot });
const st = await f.evaluate('(() => { const a = document.querySelector("audio"); return { t: a && a.currentTime, dur: a && a.duration, paused: a && a.paused, label: (document.querySelector("#t") || {}).textContent, err: (document.querySelector("pre") || {}).textContent } })()');
console.log(reqs.join('\n'));
console.log(`\nbad: ${bad.length ? `\n${bad.join('\n')}` : 'none'}\nconsole: ${logs.length ? `\n${logs.join('\n')}` : 'none'}\nstate: ${JSON.stringify(st)}`);
await browser.close();
