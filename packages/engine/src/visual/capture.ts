import { spawn } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { createRequire } from 'node:module';
import { cpus } from 'node:os';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type Page } from 'playwright-core';
import { config } from '../config';
import { ARTIFACTS } from './artifacts';
import { FORMATS, bands, slotsOf, type Rect } from './layouts';
import { paletteOf } from './theme';
import type { VPlan } from './types';

/**
 * The visual page in headless Chrome (software GL, like the 3D looks and the maps): the plan goes in once, then frames
 * are asked for by number and come back as JPEG/PNG. Several pages render different frame ranges at once.
 */
const here = dirname(fileURLToPath(import.meta.url));
const PAGE_DIR = join(here, 'page');
const MIME: Record<string, string> = { '.js': 'text/javascript', '.html': 'text/html', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json' };
const roots = (): [string, string][] => [['/three/', dirname(createRequire(import.meta.url).resolve('three'))], ['/vis/', PAGE_DIR], ['/fonts/', join(config.assets, 'renderer', 'fonts')], ['/data/', config.data]];

const PAGE_HTML = `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#fff}</style></head><body>
<script type="module">import '/vis/compose.js';</script></body></html>`;

const sinks = new Map<string, string>(); // token → directory frames are written into
let server: Server | null = null, starting: Promise<number> | null = null, browser: Promise<Browser> | null = null;
function listen(): Promise<number> {
  return (starting ??= new Promise(done => {
    server = createServer((req, res) => {
      const url = decodeURIComponent((req.url ?? '/').split('?')[0]!);
      if (req.method === 'POST' && url.startsWith('/__frame/')) {
        const dir = sinks.get(url.slice(9)), name = new URL(req.url ?? '', 'http://x').searchParams.get('name') ?? '';
        if (!dir || !/^f\d{5}\.(jpg|png)$/.test(name)) { res.writeHead(403).end(); return; }
        const chunks: Buffer[] = []; req.on('data', d => chunks.push(d as Buffer));
        req.on('end', () => { writeFileSync(join(dir, name), Buffer.concat(chunks)); res.writeHead(200).end('ok'); }); return;
      }
      if (url === '/page.html') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(PAGE_HTML); return; }
      for (const [prefix, root] of roots()) {
        if (!url.startsWith(prefix)) continue;
        const full = normalize(join(root, url.slice(prefix.length)));
        if (!full.startsWith(normalize(root) + sep) || !existsSync(full) || !statSync(full).isFile()) break;
        res.writeHead(200, { 'content-type': MIME[extname(full).toLowerCase()] ?? 'application/octet-stream', 'cache-control': 'no-store' });
        createReadStream(full).pipe(res); return;
      }
      res.writeHead(404).end();
    });
    server.listen(0, '127.0.0.1', () => done((server!.address() as { port: number }).port));
  }));
}

export const SOFTWARE_GL_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-sandbox', '--no-sandbox'];
const launch = () => (browser ??= chromium.launch({ headless: true, ...(config.chrome.path ? { executablePath: config.chrome.path } : { channel: config.chrome.channel }), args: [...(process.env.MOOVI_3D_GPU === '1' ? ['--ignore-gpu-blocklist'] : SOFTWARE_GL_ARGS), ...(process.env.MOOVI_CHROME_ARGS ?? '').split(' ').filter(Boolean)] }));
export async function canRenderVisual(): Promise<boolean> { try { await launch(); return true; } catch { browser = null; return false; } }

const FONTS = [
  { family: 'Inter Tight', url: '/fonts/inter-tight-latin-wght-normal.woff2', weight: '100 900' },
  { family: 'Fraunces', url: '/fonts/fraunces-latin-wght-italic.woff2', weight: '100 900', style: 'italic' },
  { family: 'Anton', url: '/fonts/anton-latin-400-normal.woff2', weight: '400' },
  { family: 'JetBrains Mono', url: '/fonts/jetbrains-mono-latin-wght-normal.woff2', weight: '100 800' },
];

/** a file path in the data dir → the URL the page loads it from */
export function dataUrl(p: string): string {
  const abs = resolve(p), root = resolve(config.data);
  if (!abs.startsWith(root + sep)) throw new Error(`The page only reads files inside the data dir: ${p}`);
  return `/data${abs.slice(root.length).replace(/\\/g, '/')}`;
}

export interface RenderOpts {
  /** pixel scale of the render against the format (1080x1920 at 1): 0.667 renders 720x1280, the encoder scales it up */
  scale?: number;
  workers?: number;
  /** frames to render (default: all) */
  frames?: number[];
  format?: 'jpeg' | 'png';
}
export interface Session { range(from: number, to: number, dir: string): Promise<number>; info: { renderer: string; rw: number; rh: number }; frame(n: number): Promise<Buffer>; thumb(n: number): Promise<{ w: number; h: number; px: number[] }>; boxes(n: number): Promise<{ art: string; job: string; x0: number; y0: number; x1: number; y1: number }[]>; prof(): Promise<Record<string, number> & { sections?: Record<string, { ms: number; n: number }> }>; close(): Promise<void> }

/** The plan as the page needs it: slots per scene, image urls, palette, the caption band. */
export function payload(plan: VPlan, o: { scale?: number } = {}) {
  const { W, H } = FORMATS[plan.format], scale = o.scale ?? 0.6667;
  const rw = Math.round((W * scale) / 2) * 2, rh = Math.round((H * scale) / 2) * 2;
  const images = new Set<string>();
  const scenes = plan.scenes.map(s => ({
    ...s, slots: slotsOf(s.layout, plan.format),
    elements: s.elements.map(e => { const c = { ...e.content }; if (c.image) { c.image = dataUrl(c.image); images.add(c.image); } return { ...e, content: c }; }),
  }));
  return { cfg: { plan: { ...plan, scenes }, W, H, rw, rh, palette: paletteOf(plan.theme), fonts: FONTS, prof: !!process.env.VIS_PROF, images: [...images], art: Object.fromEntries(ARTIFACTS.map(a => [a.id, { kind: a.kind, glyph: a.glyph }])), bands: { caption: bands(plan.format).caption as Rect } }, rw, rh };
}

export async function openFilm(plan: VPlan, o: RenderOpts = {}): Promise<Session> {
  const [b, port] = await Promise.all([launch(), listen()]);
  const { cfg, rw, rh } = payload(plan, o);
  // one browser context per page: same-site pages in one context share a renderer process (one main thread), contexts do not
  const context = await b.newContext({ viewport: { width: rw, height: rh } });
  const page: Page = await context.newPage();
  page.setDefaultTimeout(0);
  page.on('pageerror', e => console.error('[visual page]', e.message));
  await page.goto(`http://127.0.0.1:${port}/page.html`);
  await page.waitForFunction('typeof window.__init === "function"', null, { timeout: 30_000 });
  const info = await page.evaluate(c => (window as unknown as { __init: (x: unknown) => Promise<{ renderer: string }> }).__init(c), cfg);
  const fmt = o.format ?? 'jpeg';
  type W = { __frame: (n: number, f: string) => string; __thumb: (n: number) => { w: number; h: number; px: number[] }; __boxes: (n: number) => { art: string; job: string; x0: number; y0: number; x1: number; y1: number }[] };
  return {
    async range(from, to, dir) { const token = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`; sinks.set(token, dir); mkdirSync(dir, { recursive: true }); try { return await page.evaluate(([a, b, f, s]) => (window as unknown as { __range: (a: number, b: number, f: string, s: string) => Promise<number> }).__range(a as number, b as number, f as string, s as string), [from, to, fmt, `http://127.0.0.1:${port}/__frame/${token}`] as const); } finally { sinks.delete(token); } }, info: { renderer: info.renderer, rw, rh },
    async frame(n) { return Buffer.from(await page.evaluate(([k, f]) => (window as unknown as W).__frame(k as number, f as string), [n, fmt] as const), 'base64'); },
    thumb: n => page.evaluate(k => (window as unknown as W).__thumb(k), n),
    boxes: n => page.evaluate(k => (window as unknown as W).__boxes(k), n),
    prof: () => page.evaluate(() => (window as unknown as { __prof: () => Record<string, number> }).__prof()),
    async close() { await context.close().catch(() => undefined); },
  };
}

export const defaultWorkers = () => Math.max(1, Math.min(4, Math.floor(cpus().length / 2)));

export interface FilmStats { frames: number; seconds: number; workers: number; captureMs: number; encodeMs: number; totalMs: number; /** wall seconds per second of film */ secPerSec: number; msPerFrame: number; renderer: string; out: string | null; framesDir: string; encodeError: string | null }

/**
 * Render a whole plan: pages render contiguous frame ranges in parallel into `dir/frames`, then ffmpeg encodes them (with
 * the audio, when given) at the format's full size. Without ffmpeg the frames stay on disk and `out` is null.
 */
export async function renderFilm(plan: VPlan, dir: string, o: RenderOpts & { out?: string; audio?: string; keepFrames?: boolean } = {}): Promise<FilmStats> {
  const framesDir = join(dir, 'frames'); rmSync(framesDir, { recursive: true, force: true }); mkdirSync(framesDir, { recursive: true });
  const ext = (o.format ?? 'jpeg') === 'png' ? 'png' : 'jpg', total = Math.max(1, Math.round(plan.seconds * plan.fps));
  const n = Math.max(1, Math.min(o.workers ?? defaultWorkers(), total));
  const t0 = performance.now();
  const sessions = await Promise.all(Array.from({ length: n }, () => openFilm(plan, o)));
  const tOpen = performance.now() - t0;
  try {
    await Promise.all(sessions.map(async (s, w) => {
      const from = Math.floor((w * total) / n), to = Math.floor(((w + 1) * total) / n);
      await s.range(from, to, framesDir);
    }));
  } finally { await Promise.all(sessions.map(s => s.close())); }
  const captureMs = performance.now() - t0;
  let encodeMs = 0, out: string | null = null, encodeError: string | null = null;
  if (o.out) {
    const { W, H } = FORMATS[plan.format], t1 = performance.now();
    mkdirSync(dirname(o.out), { recursive: true });
    const args = ['-y', '-loglevel', 'error', '-framerate', String(plan.fps), '-i', join(framesDir, `f%05d.${ext}`), ...(o.audio ? ['-i', o.audio] : []), '-vf', `scale=${W}:${H}:flags=lanczos`, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '19', '-pix_fmt', 'yuv420p', ...(o.audio ? ['-c:a', 'aac', '-b:a', '192k', '-shortest'] : []), '-movflags', '+faststart', o.out];
    // no ffmpeg (a dev laptop): the frames stay on disk and the stats say so; with it, the frames are encoded and removed
    try {
      await new Promise<void>((res, rej) => { const p = spawn(config.ffmpeg, args, { stdio: ['ignore', 'ignore', 'inherit'] }); p.on('error', rej); p.on('close', c => (c === 0 ? res() : rej(new Error(`ffmpeg exited ${c}`)))); });
      encodeMs = performance.now() - t1; out = o.out;
      if (!o.keepFrames) rmSync(framesDir, { recursive: true, force: true });
    } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; encodeError = 'ffmpeg is not installed: the frames are in framesDir'; }
  }
  const totalMs = performance.now() - t0;
  void tOpen;
  return { frames: total, seconds: plan.seconds, workers: n, captureMs, encodeMs, totalMs, secPerSec: totalMs / 1000 / Math.max(0.001, plan.seconds), msPerFrame: captureMs / total, renderer: sessions[0]!.info.renderer, out, framesDir, encodeError };
}

export async function closeVisual() {
  if (browser) { const b = await browser; await b.close().catch(() => undefined); browser = null; }
  if (server) { await new Promise(r => server!.close(() => r(null))); server = null; starting = null; }
}

/**
 * One chunk of a film as a silent mp4: frames [from, to) rendered on one page, encoded at the format's size. The crew's
 * render tasks each take a chunk, the join and the sound are the Editor's (mux).
 */
export async function renderChunk(plan: VPlan, from: number, to: number, dir: string, out: string, o: RenderOpts = {}): Promise<{ frames: number; ms: number; encodeMs: number }> {
  const framesDir = join(dir, `frames-${from}-${to}`); rmSync(framesDir, { recursive: true, force: true }); mkdirSync(framesDir, { recursive: true });
  const t0 = performance.now(), s = await openFilm(plan, o);
  try { await s.range(from, to, framesDir); } finally { await s.close(); }
  const t1 = performance.now(), { W, H } = FORMATS[plan.format], ext = (o.format ?? 'jpeg') === 'png' ? 'png' : 'jpg';
  mkdirSync(dirname(out), { recursive: true });
  const args = ['-y', '-loglevel', 'error', '-framerate', String(plan.fps), '-start_number', String(from), '-i', join(framesDir, `f%05d.${ext}`), '-frames:v', String(to - from), '-vf', `scale=${W}:${H}:flags=lanczos`, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '19', '-pix_fmt', 'yuv420p', '-g', '30', '-an', out];
  await new Promise<void>((res, rej) => { const p = spawn(config.ffmpeg, args, { stdio: ['ignore', 'ignore', 'inherit'] }); p.on('error', rej); p.on('close', code => (code === 0 ? res() : rej(new Error(`ffmpeg exited ${code}`)))); });
  rmSync(framesDir, { recursive: true, force: true });
  return { frames: to - from, ms: t1 - t0, encodeMs: performance.now() - t1 };
}
