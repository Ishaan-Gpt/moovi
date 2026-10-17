// Launch look "Product UI" (L-UI-1) for any site, in under a minute: one browser pass reads the live site (area-weighted
// computed colours, rendered fonts, logo, real images, nav, headings, the call to action, a hero screenshot), writes
// data.json beside the look's player (packages/library/src/kits/launch-ui/player.html), serves it with byte ranges and
// writes a board of settled stills. The palette ramp is built in the player from the site's own colours (palette gate).
//   tsx scripts/launch-ui.ts <https://site> [--port 4377] [--out data/freeform/<host>] [--no-serve]
import { createReadStream, copyFileSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright-core';
import { config, REPO } from '../src/config';

const args = process.argv.slice(2), opt = (k: string) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : undefined; };
const url = args.find(a => /^https?:/.test(a)); if (!url) throw new Error('usage: launch-ui <https://site> [--port 4377]');
const host = new URL(url).hostname.replace(/^www\./, ''), slug = host.replace(/[^a-z0-9]+/gi, '-');
const out = opt('out') ?? join(config.data, 'freeform', slug), port = Number(opt('port') ?? 4377), T0 = Date.now();
mkdirSync(join(out, 'img'), { recursive: true });
const lap = (s: string) => console.log(`${((Date.now() - T0) / 1000).toFixed(1).padStart(5)} s  ${s}`);
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const HIDE = '#onetrust-consent-sdk,#onetrust-banner-sdk,#CybotCookiebotDialog,.cc-window,.osano-cm-window,#usercentrics-root,.fc-consent-root,[class*="cookie-banner" i],[id*="cookie" i][class*="banner" i]{display:none!important}';

const b = await chromium.launch({ headless: true, ...(config.chrome.path ? { executablePath: config.chrome.path } : { channel: config.chrome.channel }) });
const page = await (await b.newContext({ userAgent: UA, viewport: { width: 1440, height: 900 }, locale: 'en-US' })).newPage();
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => undefined);
await page.addStyleTag({ content: HIDE }).catch(() => undefined);
await page.waitForLoadState('networkidle', { timeout: 4000 }).catch(() => undefined);
await page.waitForTimeout(500);
// five shots down the page: the real product, wherever the site shows it (heroes are often dark or animated)
const shotFiles: string[] = [];
for (let k = 0; k < 5; k++) {
  await page.evaluate(`window.scrollTo(0, ${k * 860})`).catch(() => undefined); await page.waitForTimeout(k ? 450 : 0);
  const f = join(out, 'img', `s${k}.jpg`); if (await page.screenshot({ path: f, type: 'jpeg', quality: 86 }).then(() => true).catch(() => false)) shotFiles.push(f);
}
await page.evaluate('window.scrollTo(0, 0)').catch(() => undefined);
// the busiest shot (most detail = the biggest JPEG) is the one the camera dives into
const busy = shotFiles.map(f => ({ f, n: statSync(f).size })).sort((a, c) => c.n - a.n);
if (busy[0]) copyFileSync(busy[0].f, join(out, 'img', 'hero.jpg'));
lap(`site loaded, ${shotFiles.length} shots`);

// everything brand-side, read from the rendered page (never from a default); tsx names functions with __name, so the page gets a no-op one
await page.evaluate('globalThis.__name = (f) => f').catch(() => undefined);
const site = await page.evaluate(() => {
  const vis = (el: Element) => { const r = el.getBoundingClientRect(); return r.width > 2 && r.height > 2 && r.top < innerHeight * 3; };
  const hex = (c: string) => { const m = c.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/); if (!m || (m[4] !== undefined && +m[4] < 0.5)) return null; return '#' + [m[1], m[2], m[3]].map(v => Math.round(+(v ?? 0)).toString(16).padStart(2, '0')).join(''); };
  const W: Record<string, { w: number; role: string }> = {}, add = (h: string | null, w: number, role: string) => { if (!h) return; const k = `${h}|${role}`; (W[k] ??= { w: 0, role }).w += w; };
  add(hex(getComputedStyle(document.body).backgroundColor) ?? hex(getComputedStyle(document.documentElement).backgroundColor) ?? '#ffffff', innerWidth * innerHeight * 2, 'bg');
  for (const el of Array.from(document.querySelectorAll('body *')).slice(0, 4000)) {
    if (!vis(el)) continue; const s = getComputedStyle(el), r = el.getBoundingClientRect(), area = Math.min(r.width * r.height, innerWidth * innerHeight);
    add(hex(s.backgroundColor), area, 'bg');
    const own = Array.from(el.childNodes).filter(n => n.nodeType === 3).map(n => n.textContent ?? '').join('').trim();
    if (own) add(hex(s.color), own.length * parseFloat(s.fontSize) ** 2 * 0.6, 'text');
  }
  const fam = (sel: string) => { const el = document.querySelector(sel); return el ? getComputedStyle(el).fontFamily : ''; };
  const words = (s: string) => s.replace(/\s+/g, ' ').trim();
  const navs = Array.from(document.querySelectorAll('header a, nav a, header button, nav button')).map(a => words((a as HTMLElement).innerText || a.textContent || '')).filter(s => s && s.split(' ').length <= 2 && s.length <= 14 && !/log ?in|sign ?in|sign ?up|get started|menu|skip/i.test(s));
  const heads = Array.from(document.querySelectorAll('h1,h2,h3,h4')).map(h => words((h as HTMLElement).innerText || h.textContent || '')).filter(s => s.length >= 3 && s.length <= 48);
  const ctas = Array.from(document.querySelectorAll('a,button')).map(a => words(a.textContent ?? '')).filter(s => /^(get started|start|start for free|sign up|try|try for free|book a demo|get .{1,12}|join|download|start building|deploy)/i.test(s) && s.length <= 22);
  const imgs = Array.from(document.querySelectorAll('img')).map(i => ({ src: (i as HTMLImageElement).currentSrc || (i as HTMLImageElement).src, w: (i as HTMLImageElement).naturalWidth, h: (i as HTMLImageElement).naturalHeight })).filter(i => i.src && i.w >= 220 && i.h >= 140 && !/logo|icon|avatar|badge/i.test(i.src));
  const meta = (n: string) => document.querySelector(`meta[property="${n}"],meta[name="${n}"]`)?.getAttribute('content') ?? '';
  const icons = Array.from(document.querySelectorAll('link[rel*="icon"]')).map(l => ({ href: (l as HTMLLinkElement).href, rel: l.getAttribute('rel') ?? '', sizes: l.getAttribute('sizes') ?? '', type: l.getAttribute('type') ?? '' }));
  return { colours: Object.entries(W).map(([k, v]) => ({ hex: k.split('|')[0], w: v.w, role: v.role })).sort((a, b) => b.w - a.w).slice(0, 60),
    fonts: { h1: fam('h1') || fam('h2'), body: getComputedStyle(document.body).fontFamily, button: fam('button') || fam('a') },
    name: meta('og:site_name') || document.title.split(/\s[|–—:·-]\s/)[0], title: document.title, desc: meta('description') || meta('og:description'),
    h1: words(document.querySelector('h1')?.textContent ?? ''), heads, nav: [...new Set(navs)], cta: ctas[0] ?? '', imgs, og: meta('og:image'), icons };
});
lap(`read: ${site.colours.length} colours, ${site.heads.length} headings, ${site.imgs.length} images, nav ${site.nav.slice(0, 4).join('/')}`);

// fonts: the site's own family when Google Fonts serves it, else the nearest honest stand-in (said in the notes)
const first = (f: string) => (f.split(',')[0] ?? '').replace(/["']/g, '').trim();
const serifish = (f: string) => /serif|domaine|garamond|playfair|tiempos|freight|canela|editorial|fraunces|newsreader|instrument|lora|georgia|times/i.test(f) && !/sans/i.test(f);
async function google(fam: string, wght: string) { if (!fam || /system|apple|segoe|helvetica|arial|sans-serif|^serif|^var|inter var/i.test(fam)) return null; const u = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fam)}:wght@${wght}&display=block`; const r = await fetch(u, { signal: AbortSignal.timeout(4000) }).catch(() => null); return r?.ok ? u : null; }
const dispFam = first(site.fonts.h1), uiFam = first(site.fonts.body);
const [gDisp, gUi] = await Promise.all([google(dispFam, '400;600;700'), google(uiFam, '400;500;600;700;800')]);
const display = gDisp ? dispFam : serifish(site.fonts.h1) ? 'Instrument Serif' : (gUi ? uiFam : 'Inter'), ui = gUi ? uiFam : 'Inter';
const fams = [...new Set([display, ui, 'Inter', 'Instrument Serif'])].map(f => `family=${encodeURIComponent(f)}${f === 'Instrument Serif' ? ':ital@0;1' : ':wght@400;500;600;700;800'}`).join('&');
const fonts = { display, displayWeight: display === 'Instrument Serif' ? 400 : 700, ui, cssUrl: `https://fonts.googleapis.com/css2?${fams}&display=block`, site: { h1: dispFam, body: uiFam } };

// the site's own images, and its logo (apple-touch first, then the largest icon)
const save = async (src: string, file: string) => { try { const r = await fetch(src, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(5000) }); if (!r.ok) return null; const buf = Buffer.from(await r.arrayBuffer()); if (buf.length < 400) return null; writeFileSync(join(out, 'img', file), buf); return `img/${file}`; } catch { return null; } };
const srcs = [...new Set([site.og, ...site.imgs.sort((a, c) => c.w * c.h - a.w * a.h).map(i => i.src)].filter(Boolean))].slice(0, 16);
const files = (await Promise.all(srcs.map((s, i) => save(s, `p${i}${(extname(new URL(s).pathname) || '.jpg').slice(0, 5)}`)))).filter(Boolean) as string[];
const crops: string[] = [];
busy.slice(0, 4).forEach((s, k) => [0, 1].forEach(h => { const f = `c${k}${h}.jpg`; try { execFileSync(config.ffmpeg, ['-v', 'error', '-y', '-i', s.f, '-vf', `crop=720:450:${h ? 720 : 0}:${h ? 450 : 120}`, join(out, 'img', f)], { timeout: 8000 }); crops.push(`img/${f}`); } catch { /* skip */ } }));
// the first card is a crop of the shot the camera dives into, so the dive lands where the tile promised
const images = [...crops.slice(0, 1), ...files.slice(0, 5), ...crops.slice(1)].slice(0, 14);
const size = (s: string) => Math.max(0, ...s.split(/\s+/).map(x => Number(x.split('x')[0]) || 0));
const icons = site.icons.sort((a, c) => ((/apple/.test(c.rel) ? 1000 : 0) + size(c.sizes) + (/svg/.test(c.type + c.href) ? 500 : 0)) - ((/apple/.test(a.rel) ? 1000 : 0) + size(a.sizes) + (/svg/.test(a.type + a.href) ? 500 : 0)));
let logo: string | null = null;
for (const ic of icons) { const svg = /svg/.test(ic.type + ic.href); const f = await save(ic.href, svg ? 'logo.svg' : 'logo-src'); if (!f) continue; if (svg) { logo = f; break; } try { execFileSync(config.ffmpeg, ['-v', 'error', '-y', '-i', join(out, f), '-frames:v', '1', join(out, 'img', 'logo.png')], { timeout: 8000 }); logo = 'img/logo.png'; break; } catch { /* not an image */ } }
await b.close();
lap(`saved ${images.length} images, logo ${logo ?? 'none'}, fonts ${display} / ${ui} (site: ${dispFam} / ${uiFam})`);

// the words: all the site's own (headings as card titles, the h1 as the end line, nav as the pills)
const short = (s: string, n: number) => s.split(' ').slice(0, n).join(' ').replace(/[,.;:]$/, '');
const name = (site.name || host.split('.')[0]!).trim().slice(0, 24);
const cards = [...new Set(site.heads.map(h => short(h, 5)))].filter(h => h.toLowerCase() !== name.toLowerCase()).slice(0, 12);
const nav = (site.nav.length >= 3 ? site.nav : ['All', ...cards.slice(0, 3).map(c => short(c, 1))]).slice(0, 4);
const tagline = (() => { const h = site.h1 && site.h1.split(' ').length <= 7 ? site.h1 : short(site.desc || site.h1 || name, 6); return h.replace(/\.$/, ''); })();
const gridTitle = cards.find(c => c.split(' ').length <= 4) ?? `${name}.`;
const data = { name, host, url, tagline, gridTitle, sub: (site.desc || '').split(/(?<=\.)\s/)[0]!.slice(0, 110), cta: site.cta || 'Get started', nav, cards: cards.length ? cards : [name], query: short(cards[0] ?? name, 1).toLowerCase(), colours: site.colours, fonts, images, logo, hero: 'img/hero.jpg', made: new Date().toISOString() };
writeFileSync(join(out, 'data.json'), JSON.stringify(data, null, 1));
copyFileSync(join(REPO, 'packages/library/src/kits/launch-ui/player.html'), join(out, 'index.html'));
lap(`data.json written: "${tagline}" · cards ${cards.slice(0, 4).join(' / ')}`);

// serve with byte ranges (reuse a server already on the port), then the stills board from the live page
const root = join(out, '..'), TYPES: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.wav': 'audio/wav' };
const up = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(800) }).then(() => true).catch(() => false);
if (!up && !args.includes('--no-serve')) createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
  const f = normalize(join(root, p)); if (!f.startsWith(normalize(root))) { res.writeHead(403).end(); return; }
  let st; try { st = statSync(f); } catch { res.writeHead(404).end(); return; }
  if (st.isDirectory()) { res.writeHead(302, { Location: p + '/' }).end(); return; }
  const type = TYPES[extname(f).toLowerCase()] ?? 'application/octet-stream', m = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? '');
  if (m) { const a = m[1] ? +m[1] : 0, z = m[2] ? +m[2] : st.size - 1; res.writeHead(206, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${a}-${z}/${st.size}`, 'Content-Length': z - a + 1 }); createReadStream(f, { start: a, end: z }).pipe(res); }
  else { res.writeHead(200, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': st.size }); createReadStream(f).pipe(res); }
}).listen(port, '127.0.0.1');
const live = `http://127.0.0.1:${port}/${slug}/`;
const b2 = await chromium.launch({ headless: true, ...(config.chrome.path ? { executablePath: config.chrome.path } : { channel: config.chrome.channel }) });
const pg = await b2.newPage({ viewport: { width: 1920, height: 1132 } });
pg.on('pageerror', e => console.log('pageerror', String(e)));
await pg.goto(live); await pg.waitForFunction('window.__ready', null, { timeout: 30000 });
const times = [1.3, 3.6, 5.6, 7.9, 9.2, 10.8, 12.2, 13.9, 15.8, 18.5], shots: string[] = [];
for (const t of times) { await pg.evaluate(`window.__render(${t})`); shots.push((await pg.locator('#cv').screenshot({ type: 'jpeg', quality: 82 })).toString('base64')); }
const pal = await pg.evaluate('window.__palette') as Record<string, string | boolean | null>;
await pg.setViewportSize({ width: 2440, height: 900 });
await pg.setContent(`<head><link rel="stylesheet" href="${fonts.cssUrl}"></head><body style="margin:0;padding:30px;background:${pal.bg};color:${pal.fg};font:500 22px '${ui}',system-ui"><div style="font:700 40px '${ui}';margin-bottom:6px">${name} · Launch look Product UI</div><div style="opacity:.6;margin-bottom:18px">${host} · palette from its CSS (${pal.dark ? 'dark' : 'light'} world${pal.accent ? `, brand mark ${pal.accent}` : ', monochrome'}) · type ${display} / ${ui} · ${((Date.now() - T0) / 1000).toFixed(0)} s to make</div><div style="display:flex;gap:8px;margin-bottom:20px">${['bg', 'card', 'surface', 'raised', 'rule', 'dim', 'muted', 'soft', 'fg', 'accent'].filter(k => pal[k]).map(k => `<div><div style="width:110px;height:44px;border-radius:10px;background:${pal[k]};border:1px solid rgba(128,128,128,.3)"></div><div style="font-size:16px;opacity:.6">${k} ${pal[k]}</div></div>`).join('')}</div><div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px">${shots.map((s, i) => `<div><div style="font-size:16px;opacity:.55">${times[i]} s</div><img style="width:100%;border-radius:8px" src="data:image/jpeg;base64,${s}"></div>`).join('')}</div></body>`);
await pg.evaluate('document.fonts.ready'); await pg.waitForTimeout(300);
await pg.screenshot({ path: join(out, 'board.jpg'), fullPage: true, type: 'jpeg', quality: 86 });
await b2.close();
lap(`board ${join(out, 'board.jpg')}`);
console.log(`\nPREVIEW ${live}  (made in ${((Date.now() - T0) / 1000).toFixed(1)} s)${up ? ' [server already running]' : ' (this process keeps serving; Ctrl+C to stop)'}`);
if (up || args.includes('--no-serve')) process.exit(0);
