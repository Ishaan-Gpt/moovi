import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { chromium, type Browser, type Page } from 'playwright-core';
import { config } from '../config';

/**
 * The render pool: a local file server and headless Chrome pages that run the MotionEasy engine bundle.
 * - `still`: one frame as PNG, plus the boxes of everything the renderer drew (its QA hook), for a Shot Builder's
 *   eyes and the geometry QA;
 * - `chunk`: frames [from, to) encoded in the page with WebCodecs (H.264, every frame a keyframe), written to disk,
 *   so chunks render in parallel pages and join without re-encoding.
 * Media URLs in specs are paths on this server: /data/… (the engine's data dir) and /me/… (the MotionEasy repo).
 */
const MIME: Record<string, string> = { '.js': 'text/javascript', '.json': 'application/json', '.html': 'text/html', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf', '.css': 'text/css' };

const ENGINE_DIR = () => { const v = join(config.data, 'vendor', 'engine'); return existsSync(join(v, 'motioneasy.js')) ? v : join(config.motioneasy, 'apps', 'web', 'public', 'engine'); };
const ROOTS = () => [['/engine/', ENGINE_DIR()], ['/data/', config.data], ['/me/', config.motioneasy]] as const;

const HOST_HTML = `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#fff}</style></head><body>
<script src="/engine/motioneasy.js"></script>
<script>
(async () => {
  MotionEasy.configure({ assets: '/engine', media: '' });
  const b64 = async (blob) => { const buf = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000)); return btoa(s); };
  window.__still = async (spec, t, scale, withBoxes) => {
    if (withBoxes) window.__S1QA = [];
    const blob = await MotionEasy.still(spec, t, scale);
    const boxes = window.__S1QA || null; window.__S1QA = undefined;
    return { png: await b64(blob), boxes };
  };
  window.__boxes = async (spec, frames, fps) => {
    const out = [];
    for (const f of frames) { window.__S1QA = []; await MotionEasy.still(spec, (f + 0.5) / fps, 0.2); out.push({ f, boxes: window.__S1QA }); }
    window.__S1QA = undefined;
    return out;
  };
  // a drawn prop as a transparent PNG: rendered on black and on white, alpha from the difference (soft edges and
  // shadows survive), colour un-premultiplied from the black render, cropped to what was drawn
  window.__matte = async (onBlack, onWhite, t, scale, pad) => {
    const [a, b] = [await createImageBitmap(await MotionEasy.still(onBlack, t, scale)), await createImageBitmap(await MotionEasy.still(onWhite, t, scale))];
    const W = a.width, H = a.height, c = new OffscreenCanvas(W, H), x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(a, 0, 0); const A = x.getImageData(0, 0, W, H).data;
    x.clearRect(0, 0, W, H); x.drawImage(b, 0, 0); const B = x.getImageData(0, 0, W, H).data;
    const O = new ImageData(W, H), o = O.data; let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let i = 0, k = 0; i < W * H; i++, k += 4) {
      const al = 1 - ((B[k] - A[k]) + (B[k + 1] - A[k + 1]) + (B[k + 2] - A[k + 2])) / 765;
      if (al <= 0.012) continue;
      const q = Math.min(1, al);
      o[k] = Math.min(255, A[k] / q); o[k + 1] = Math.min(255, A[k + 1] / q); o[k + 2] = Math.min(255, A[k + 2] / q); o[k + 3] = Math.round(q * 255);
      const px = i % W, py = (i / W) | 0; if (px < x0) x0 = px; if (px > x1) x1 = px; if (py < y0) y0 = py; if (py > y1) y1 = py;
    }
    if (x1 < 0) return null;
    x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(W - 1, x1 + pad); y1 = Math.min(H - 1, y1 + pad);
    const out = new OffscreenCanvas(x1 - x0 + 1, y1 - y0 + 1); out.getContext('2d').putImageData(O, -x0, -y0);
    return { png: await b64(await out.convertToBlob({ type: 'image/png' })), w: out.width, h: out.height };
  };
  window.__chunk = async (spec, from, to, outPath, quality, scale) => {
    const r = MotionEasy.resolve(spec), E = MotionEasy.engine, fps = r.fps, off = from / fps, dur = (to - from) / fps;
    const comp = { ...r.comp, duration: () => dur, render(c, p) { return r.comp.render(new E.RC(c.ctx, c.s, c.W, c.H, c.t + off, c.env, c.safe), p); } };
    const res = await E.exportVideo({ comp, props: r.props, format: r.format, fps, audio: false, quality: quality || 'high', scale: scale || 1, container: 'mp4' });
    const up = await fetch('/__out?path=' + encodeURIComponent(outPath), { method: 'POST', body: res.blob });
    if (!up.ok) throw new Error('could not write ' + outPath);
    return { frames: res.frames, codec: res.codec, width: res.width, height: res.height, ext: res.ext };
  };
  window.__ready = true;
})().catch(e => { window.__error = String(e && e.stack || e); });
</script></body></html>`;

let server: Server | null = null, port = 0, starting: Promise<number> | null = null;

function resolvePath(url: string): string | null {
  const p = decodeURIComponent(url.split('?')[0]!);
  for (const [prefix, root] of ROOTS()) {
    if (!p.startsWith(prefix)) continue;
    const full = normalize(join(root, p.slice(prefix.length)));
    if (!full.startsWith(normalize(root) + sep) && full !== normalize(root)) return null;
    return full;
  }
  return null;
}

function startServer(): Promise<number> {
  // one start, shared: parallel pages asking at once must all get the real port (not 0 while it is still listening)
  return starting ??= listen();
}

async function listen(): Promise<number> {
  server = createServer((req, res) => {
    const url = req.url ?? '/';
    if (url === '/host.html') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(HOST_HTML); return; }
    if (req.method === 'POST' && url.startsWith('/__out?')) {
      const target = resolve(new URL(url, 'http://x').searchParams.get('path') ?? '');
      if (!target.startsWith(resolve(config.data) + sep)) { res.writeHead(403).end(); return; }
      const chunks: Buffer[] = [];
      req.on('data', c => chunks.push(c as Buffer));
      req.on('end', () => { mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, Buffer.concat(chunks)); res.writeHead(200).end('ok'); });
      return;
    }
    const file = resolvePath(url);
    if (!file || !existsSync(file) || !statSync(file).isFile()) { res.writeHead(404).end(); return; }
    const size = statSync(file).size, type = MIME[extname(file).toLowerCase()] ?? 'application/octet-stream';
    const range = req.headers.range?.match(/bytes=(\d*)-(\d*)/);
    if (range) {
      const start = range[1] ? Number(range[1]) : 0, end = range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
      res.writeHead(206, { 'content-type': type, 'content-length': end - start + 1, 'content-range': `bytes ${start}-${end}/${size}`, 'accept-ranges': 'bytes' });
      createReadStream(file, { start, end }).pipe(res);
    } else {
      res.writeHead(200, { 'content-type': type, 'content-length': size, 'accept-ranges': 'bytes' });
      createReadStream(file).pipe(res);
    }
  });
  await new Promise<void>(r => server!.listen(0, '127.0.0.1', () => r()));
  port = (server.address() as { port: number }).port;
  return port;
}

/** A data-dir file as the URL the renderer loads. */
export const mediaUrl = (abs: string) => {
  const rel = resolve(abs).slice(resolve(config.data).length).replace(/\\/g, '/');
  if (!resolve(abs).startsWith(resolve(config.data))) throw new Error(`Not a data file: ${abs}`);
  return `/data${rel.startsWith('/') ? rel : `/${rel}`}`;
};

let browser: Promise<Browser> | null = null;
const idle: Page[] = [];
const waiters: ((p: Page) => void)[] = [];
let pages = 0;

async function newPage(): Promise<Page> {
  const p = await startServer();
  if (!browser) browser = chromium.launch({ headless: true, ...(config.chrome.path ? { executablePath: config.chrome.path } : { channel: config.chrome.channel }), args: ['--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', ...(process.env.CE_CHROME_ARGS ?? '').split(' ').filter(Boolean)] });
  const b = await browser;
  const page = await b.newPage({ viewport: { width: 1200, height: 900 } });
  page.setDefaultTimeout(0);
  await page.goto(`http://127.0.0.1:${p}/host.html`);
  await page.waitForFunction('window.__ready === true || window.__error', null, { timeout: 60_000 });
  const err = await page.evaluate('window.__error');
  if (err) throw new Error(`The engine bundle failed to load: ${String(err).slice(0, 300)}`);
  return page;
}

/** Borrow a page (at most `config.slots.chrome + render` at once), run `fn`, give it back. */
export async function withPage<T>(fn: (page: Page) => Promise<T>): Promise<T> {
  let page = idle.pop();
  if (!page) {
    if (pages < config.slots.chrome + config.slots.render) { pages++; try { page = await newPage(); } catch (e) { pages--; throw e; } }
    else page = await new Promise<Page>(r => waiters.push(r));
  }
  try { return await fn(page); }
  catch (e) { await page.close().catch(() => undefined); pages--; page = undefined; throw e; }
  finally { if (page) { const w = waiters.shift(); if (w) w(page); else idle.push(page); } }
}

export interface Box { id: string; kind: string; x0: number; y0: number; x1: number; y1: number; alpha: number; text?: string; chip?: boolean; contain?: boolean }

export function still(spec: unknown, t: number, scale = 0.4): Promise<{ png: string; boxes: Box[] | null }> {
  return withPage(p => p.evaluate(([s, tt, sc]) => (window as unknown as { __still: (a: unknown, b: number, c: number, d: boolean) => Promise<{ png: string; boxes: Box[] | null }> }).__still(s, tt as number, sc as number, true), [spec, t, scale] as const));
}

export function boxes(spec: unknown, frames: number[], fps: number): Promise<{ f: number; boxes: Box[] }[]> {
  return withPage(p => p.evaluate(([s, fr, fp]) => (window as unknown as { __boxes: (a: unknown, b: number[], c: number) => Promise<{ f: number; boxes: Box[] }[]> }).__boxes(s, fr as number[], fp as number), [spec, frames, fps] as const));
}

/** Two renders of the same frame (on black, on white) → a cropped transparent PNG of what was drawn. */
export function matte(onBlack: unknown, onWhite: unknown, t: number, scale = 1, pad = 6): Promise<{ png: string; w: number; h: number } | null> {
  return withPage(p => p.evaluate(([a, b, tt, sc, pd]) => (window as unknown as { __matte: (...x: unknown[]) => Promise<{ png: string; w: number; h: number } | null> }).__matte(a, b, tt, sc, pd), [onBlack, onWhite, t, scale, pad] as const));
}

export function chunk(spec: unknown, from: number, to: number, out: string, quality: 'high' | 'balanced' = 'high', scale = 1): Promise<{ frames: number; codec: string; width: number; height: number }> {
  return withPage(p => p.evaluate(([s, a, b, o, q, sc]) => (window as unknown as { __chunk: (...x: unknown[]) => Promise<{ frames: number; codec: string; width: number; height: number }> }).__chunk(s, a, b, o, q, sc), [spec, from, to, resolve(out), quality, scale] as const));
}

/** A real site, captured: its own page in the pool's browser (2× device scale, so 1440 CSS px = 2880 px). */
export async function capturePage(url: string, out: string, o: { width?: number; height?: number; scrollTo?: number; fullPage?: boolean; dark?: boolean; waitUntil?: 'networkidle' | 'domcontentloaded' | 'load'; settleMs?: number; timeoutMs?: number; scale?: number; mobile?: boolean; minDetail?: number } = {}) {
  await startServer();
  if (!browser) browser = chromium.launch({ headless: true, ...(config.chrome.path ? { executablePath: config.chrome.path } : { channel: config.chrome.channel }) });
  const b = await browser;
  // mobile: the site's own phone layout (a phone prop shows this, never a desktop page squeezed into a portrait screen)
  const ctx = await b.newContext({ viewport: { width: o.width ?? 1440, height: o.height ?? 900 }, deviceScaleFactor: o.scale ?? 2, colorScheme: o.dark ? 'dark' : 'light', ...(o.mobile ? { isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' } : {}) });
  const page = await ctx.newPage();
  try {
    await page.goto(/^https?:\/\//.test(url) ? url : `https://${url}`, { waitUntil: o.waitUntil ?? 'networkidle', timeout: o.timeoutMs ?? 45_000 }).catch(() => page.waitForLoadState('domcontentloaded'));
    // dismiss the usual cookie banners without accepting anything
    for (const t of ['Reject all', 'Decline', 'Only necessary', 'Necessary only', 'Reject']) { const btn = page.getByRole('button', { name: t }).first(); if (await btn.isVisible().catch(() => false)) { await btn.click().catch(() => undefined); break; } }
    // overlays that are not the page: Google one-tap and the common consent managers are hidden (never accepted)
    await page.addStyleTag({ content: '#credential_picker_container,#credential_picker_iframe,iframe[src*="accounts.google.com/gsi"],#onetrust-consent-sdk,#onetrust-banner-sdk,#CybotCookiebotDialog,.cc-window,.osano-cm-window,#truste-consent-track,#usercentrics-root,.fc-consent-root{display:none!important}' }).catch(() => undefined);
    if (o.scrollTo) await page.evaluate(y => window.scrollTo(0, y), o.scrollTo);
    await page.waitForTimeout(o.settleMs ?? 1200);
    mkdirSync(dirname(out), { recursive: true });
    // detail = the share of the page's cells that show something (text, image, edge); a hero that fades in late or a
    // page still painting reads as a flat colour: wait and shoot again (twice at most), and report what was got
    let detail = 1;
    for (let k = 0; k < 3; k++) {
      const png = await page.screenshot({ path: out, fullPage: !!o.fullPage, type: 'png' });
      if (!o.minDetail) break;
      detail = await page.evaluate(async (b64) => {
        const img = new Image(); img.src = `data:image/png;base64,${b64}`; await img.decode();
        const W = 60, H = Math.max(1, Math.round(W * img.naturalHeight / img.naturalWidth)), c = document.createElement('canvas'); c.width = W; c.height = H;
        const x = c.getContext('2d', { willReadFrequently: true })!; x.drawImage(img, 0, 0, W, H);
        const d = x.getImageData(0, 0, W, H).data; let busy = 0, cells = 0;
        for (let cy = 0; cy + 5 <= H; cy += 5) for (let cx = 0; cx + 5 <= W; cx += 5) {
          let lo = 1, hi = 0;
          for (let yy = cy; yy < cy + 5; yy++) for (let xx = cx; xx < cx + 5; xx++) { const i = (yy * W + xx) * 4, l = (0.2126 * d[i]! + 0.7152 * d[i + 1]! + 0.0722 * d[i + 2]!) / 255; if (l < lo) lo = l; if (l > hi) hi = l; }
          cells++; if (hi - lo > 0.06) busy++;
        }
        return cells ? busy / cells : 0;
      }, png.toString('base64'));
      if (detail >= o.minDetail) break;
      await page.waitForTimeout(2500);
    }
    return { title: await page.title(), detail };
  } finally { await ctx.close().catch(() => undefined); }
}

/**
 * A brand's icon as a clean 512 px PNG (base64), from candidate images given as data URLs (best first): the first that
 * decodes, is sharp enough (a raster ≥ 96 px; an SVG always) and is not blank wins. A mark on transparent is cropped to
 * what is drawn and centred with air; a white mark gets a rounded tile in `tile` (it would vanish on a light stage); an
 * opaque square (apple-touch-icon) is clipped to an app-icon rounded square. Pure canvas in the pool's browser.
 */
export async function logoPng(cands: string[], tile = '#1A1A1A'): Promise<{ png: string; index: number; kind: string } | null> {
  if (!cands.length) return null;
  if (!browser) browser = chromium.launch({ headless: true, ...(config.chrome.path ? { executablePath: config.chrome.path } : { channel: config.chrome.channel }) });
  const b = await browser;
  const ctx = await b.newContext({ viewport: { width: 600, height: 600 } });
  try {
    const page = await ctx.newPage();
    return await page.evaluate(async ([list, tileColor]) => {
      const S = 512;
      for (const [index, src] of (list as string[]).entries()) {
        try {
          const img = new Image(); img.src = src; await img.decode();
          const svg = src.startsWith('data:image/svg');
          let w = img.naturalWidth || S, h = img.naturalHeight || S;
          if (!svg && Math.min(w, h) < 96) continue;
          const k = Math.min(S / w, S / h); w *= k; h *= k;
          const c = document.createElement('canvas'); c.width = S; c.height = S;
          const x = c.getContext('2d', { willReadFrequently: true })!;
          x.imageSmoothingQuality = 'high'; x.drawImage(img, (S - w) / 2, (S - h) / 2, w, h);
          const d = x.getImageData(0, 0, S, S).data;
          let clear = 0, n = 0, lum = 0, lum2 = 0, x0 = S, y0 = S, x1 = -1, y1 = -1;
          for (let i = 0; i < S * S; i++) {
            const a = d[i * 4 + 3]!;
            if (a < 16) { clear++; continue; }
            const l = (0.2126 * d[i * 4]! + 0.7152 * d[i * 4 + 1]! + 0.0722 * d[i * 4 + 2]!) / 255;
            n++; lum += l; lum2 += l * l;
            const px = i % S, py = (i / S) | 0; if (px < x0) x0 = px; if (px > x1) x1 = px; if (py < y0) y0 = py; if (py > y1) y1 = py;
          }
          if (n < S * S * 0.02) continue; // nothing drawn
          const mean = lum / n, sd = Math.sqrt(Math.max(0, lum2 / n - mean * mean));
          const transparent = clear / (S * S) > 0.08;
          if (!transparent && sd < 0.03) continue; // a flat square: no mark in it
          const o = document.createElement('canvas'); o.width = S; o.height = S; const y = o.getContext('2d')!;
          y.imageSmoothingQuality = 'high';
          // (no named helpers in here: tsx's keepNames would wrap them in a __name() the page does not have)
          let kind = 'mark';
          if (transparent) {
            const bw = x1 - x0 + 1, bh = y1 - y0 + 1, white = mean > 0.82;
            const room = white ? S * 0.62 : S * 0.9, f = Math.min(room / bw, room / bh);
            if (white) { y.beginPath(); y.roundRect(4, 4, S - 8, S - 8, S * 0.22); y.fillStyle = tileColor as string; y.fill(); kind = 'mark on tile'; }
            y.drawImage(c, x0, y0, bw, bh, (S - bw * f) / 2, (S - bh * f) / 2, bw * f, bh * f);
          } else { y.beginPath(); y.roundRect(4, 4, S - 8, S - 8, S * 0.22); y.clip(); y.drawImage(c, 0, 0); kind = 'app icon'; }
          return { png: o.toDataURL('image/png').split(',')[1]!, index, kind };
        } catch { /* next candidate */ }
      }
      return null;
    }, [cands, tile] as const);
  } finally { await ctx.close().catch(() => undefined); }
}

export async function closeRender() {
  for (const p of idle.splice(0)) await p.close().catch(() => undefined);
  if (browser) { const b = await browser; await b.close().catch(() => undefined); browser = null; }
  pages = 0;
  if (server) { await new Promise(r => server!.close(() => r(null))); server = null; starting = null; }
}
