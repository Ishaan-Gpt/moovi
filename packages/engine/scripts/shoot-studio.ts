// tsx scripts/shoot-studio.ts <path> <name> [WxH ...]: sign in with the local test account, open a studio page and
// save full-resolution screenshots (data/checks/ui/<name>-<W>.png). Local verification only.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { config } from '../src/config';

const [path = '/studio', name = 'page', ...sizes] = process.argv.slice(2);
const acct = readFileSync(join(config.data, 'checks', 'studio-test-account.txt'), 'utf8');
const email = acct.match(/email: (.+)/)![1]!.trim(), password = acct.match(/password: (.+)/)![1]!.trim();
const base = process.env.STUDIO_URL ?? 'http://localhost:3100';
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
for (const s of sizes.length ? sizes : ['1440x900']) {
  const [w, h] = s.split('x').map(Number) as [number, number];
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, ...(w < 760 ? { isMobile: true, hasTouch: true } : {}) });
  const r = await ctx.request.post(`${base}/studio/api/auth/signin`, { data: { email, password }, headers: { origin: base } });
  if (!r.ok()) throw new Error(`sign-in failed: ${r.status()} ${await r.text()}`);
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${base}${path}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForSelector(process.env.READY ?? 'body > *', { timeout: 60_000 }).catch(() => undefined);
  await page.waitForTimeout(Number(process.env.WAIT ?? 3500));
  const out = join(config.data, 'checks', 'ui', `${name}-${w}.png`);
  await page.screenshot({ path: out });
  console.log(`${page.url()} → ${out}${errors.length ? `\n  errors: ${errors.slice(0, 5).join(' | ')}` : ''}`);
  await ctx.close();
}
await browser.close();
