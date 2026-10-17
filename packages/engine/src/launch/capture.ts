/**
 * The real product for a Launch film (ishaan-motion rule 0.1: real assets beat code stand-ins): the site's own icon
 * (apple-touch-icon or the largest icon it declares) for the app tile and the end card, a desktop shot of its hero
 * for the browser beats, and a mobile shot for the phone beats. Headless Chrome, one page, consent overlays hidden
 * (never accepted), a hard deadline: a site that is slow or walled just gives fewer images, and the caster then
 * leaves out the set-ups that need them.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { config } from '../config';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const HIDE = '#onetrust-consent-sdk,#onetrust-banner-sdk,#CybotCookiebotDialog,.cc-window,.osano-cm-window,#truste-consent-track,#usercentrics-root,.fc-consent-root,[id*="cookie" i][class*="banner" i],[class*="cookie-banner" i],#credential_picker_container,iframe[src*="accounts.google.com/gsi"]{display:none!important} html{scroll-behavior:auto!important}';

export interface Captured { hero?: string; mobile?: string; logo?: string; ms: number; notes: string[] }

/** Shoot the site into `dir` (hero.jpg, mobile.jpg, logo.png|svg); never throws, never runs past `deadline` ms. */
export async function captureSite(url: string, dir: string, o: { deadline?: number; signal?: AbortSignal; log?: (s: string) => void } = {}): Promise<Captured> {
  const t0 = Date.now(), out: Captured = { ms: 0, notes: [] };
  const deadline = o.deadline ?? 15_000;
  // last run's shots never stand in for this run's
  for (const f of ['hero.jpg', 'mobile.jpg', 'logo.png', 'logo.svg']) rmSync(join(dir, f), { force: true });
  const { chromium } = await import('playwright-core');
  const b = await chromium.launch({ headless: true, ...(config.chrome.path ? { executablePath: config.chrome.path } : { channel: config.chrome.channel }) }).catch(e => { out.notes.push(`no browser: ${String(e).slice(0, 80)}`); return null; });
  if (!b) return { ...out, ms: Date.now() - t0 };
  const left = () => deadline - (Date.now() - t0);
  const stop = () => b.close().catch(() => undefined);
  o.signal?.addEventListener('abort', stop, { once: true });
  const work = (async () => {
    const desk = await (await b.newContext({ userAgent: UA, viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, locale: 'en-US' })).newPage();
    await desk.goto(url, { waitUntil: 'domcontentloaded', timeout: Math.max(4000, left() - 8000) }).catch(e => out.notes.push(`load: ${String(e).slice(0, 60)}`));
    await desk.addStyleTag({ content: HIDE }).catch(() => undefined);
    await desk.waitForLoadState('networkidle', { timeout: Math.min(3000, Math.max(500, left() - 9000)) }).catch(() => undefined);
    await desk.waitForTimeout(600);
    const hero = join(dir, 'hero.jpg');
    await desk.screenshot({ path: hero, type: 'jpeg', quality: 84, timeout: Math.max(2000, left() - 4000) }).then(() => { out.hero = 'hero.jpg'; }).catch(e => out.notes.push(`hero: ${String(e).slice(0, 60)}`));
    // the icon: apple-touch-icon first, then the largest declared icon, then /favicon.ico; small favicons are not used
    const icons = await desk.evaluate(() => [...document.querySelectorAll('link[rel*="icon"]')].map(l => ({ href: (l as HTMLLinkElement).href, rel: l.getAttribute('rel') ?? '', sizes: l.getAttribute('sizes') ?? '', type: l.getAttribute('type') ?? '' }))).catch(() => [] as { href: string; rel: string; sizes: string; type: string }[]);
    const size = (s: string) => Math.max(0, ...s.split(/\s+/).map(x => Number(x.split('x')[0]) || 0));
    const ranked = icons.sort((a, b2) => (/apple/.test(b2.rel) ? 1000 : 0) + size(b2.sizes) + (/svg/.test(b2.type) || /\.svg/.test(b2.href) ? 500 : 0) - ((/apple/.test(a.rel) ? 1000 : 0) + size(a.sizes) + (/svg/.test(a.type) || /\.svg/.test(a.href) ? 500 : 0)));
    for (const ic of ranked) {
      if (left() < 3000) break;
      const svg = /svg/.test(ic.type) || /\.svg(\?|$)/.test(ic.href), big = /apple/.test(ic.rel) || size(ic.sizes) >= 96 || svg;
      if (!big) continue;
      const r = await fetch(ic.href, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(4000) }).catch(() => null);
      if (!r || !r.ok) continue;
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length < 200) continue;
      if (svg) { writeFileSync(join(dir, 'logo.svg'), buf); out.logo = 'logo.svg'; break; }
      const raw = join(dir, `logo-src${/\.ico(\?|$)/.test(ic.href) ? '.ico' : '.img'}`); writeFileSync(raw, buf);
      try { execFileSync(config.ffmpeg, ['-v', 'error', '-y', '-i', raw, '-frames:v', '1', join(dir, 'logo.png')], { timeout: 8000 }); if (existsSync(join(dir, 'logo.png'))) { out.logo = 'logo.png'; break; } } catch { /* not an image ffmpeg reads */ }
    }
    if (left() > 6000) {
      const mob = await (await b.newContext({ userAgent: MOBILE_UA, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'en-US' })).newPage();
      await mob.goto(url, { waitUntil: 'domcontentloaded', timeout: Math.max(3000, left() - 3000) }).catch(() => undefined);
      await mob.addStyleTag({ content: HIDE }).catch(() => undefined);
      await mob.waitForTimeout(Math.min(1500, Math.max(300, left() - 2500)));
      await mob.screenshot({ path: join(dir, 'mobile.jpg'), type: 'jpeg', quality: 82, timeout: Math.max(1500, left()) }).then(() => { out.mobile = 'mobile.jpg'; }).catch(() => undefined);
    }
  })().catch(e => { out.notes.push(String(e).slice(0, 100)); });
  // a hard deadline: whatever is shot by then is kept, the browser is closed (which ends anything still running)
  let timer: NodeJS.Timeout | undefined;
  await Promise.race([work, new Promise<void>(r => { timer = setTimeout(() => { out.notes.push(`deadline ${deadline / 1000} s`); r(); }, deadline); })]);
  clearTimeout(timer);
  o.signal?.removeEventListener('abort', stop);
  await Promise.race([stop(), new Promise(r => setTimeout(r, 3000))]);
  if (!out.hero && existsSync(join(dir, 'hero.jpg'))) out.hero = 'hero.jpg';
  out.ms = Date.now() - t0;
  o.log?.(`capture: ${[out.hero && 'hero', out.mobile && 'mobile', out.logo && `logo (${out.logo})`].filter(Boolean).join(', ') || 'nothing'} in ${(out.ms / 1000).toFixed(1)} s${out.notes.length ? ` (${out.notes.join('; ')})` : ''}`);
  return out;
}
