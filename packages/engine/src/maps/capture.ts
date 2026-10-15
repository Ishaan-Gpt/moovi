import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { createRequire } from 'node:module';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { color } from '@moovi/brand';
import { chromium, type Browser, type Page } from 'playwright-core';
import { config } from '../config';
import { COUNTRIES_PAGE_URL, ensureCountries } from './countries';
import type { Place } from './geocode';
import { cameraAt, globeHeight, toStops, type Cam, type Stop } from './route';

/**
 * Real map shots in the engine's headless-Chrome capture. MapLibre GL JS draws free OpenFreeMap tiles (attribution
 * always on screen); Node computes the camera for each frame (route.ts) and the page applies it, then waits until every
 * tile is loaded before the screenshot, so a frame never shows half a map. If the tiles cannot load (no network, a
 * blocked style) the same flight is drawn on a three.js globe from Natural Earth outlines.
 */
const here = dirname(fileURLToPath(import.meta.url));
const MIME: Record<string, string> = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json', '.geojson': 'application/json', '.png': 'image/png' };
export const STYLE_URL = process.env.MOOVI_MAP_STYLE ?? 'https://tiles.openfreemap.org/styles/liberty';
export const ATTRIBUTION = '© OpenFreeMap  © OpenMapTiles  Data from OpenStreetMap';

const roots = (): [string, string][] => [
  ['/three/', join(dirname(createRequire(import.meta.url).resolve('three')))],
  ['/maplibre/', dirname(createRequire(import.meta.url).resolve('maplibre-gl'))],
  ['/maps/', join(here, 'page')],
  ['/data/', config.data],
];

const PAGE_HTML = `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/maplibre/maplibre-gl.css">
<style>html,body{margin:0;background:#F7FAFD;overflow:hidden}#view{position:relative}
#attr{position:fixed;left:10px;bottom:8px;font:600 12px/1 system-ui,sans-serif;color:#0E1A2B;background:rgba(247,250,253,.82);padding:5px 8px;border-radius:6px}
#name{position:fixed;left:0;right:0;top:9%;text-align:center;font:700 54px/1.1 system-ui,sans-serif;color:#0E1A2B;text-shadow:0 0 14px #F7FAFD,0 0 4px #F7FAFD;opacity:0}</style></head><body>
<div id="view"></div><div id="name"></div><div id="attr"></div>
<script src="/maplibre/maplibre-gl.js"></script>
<script type="module">import '/maps/maps.js';</script></body></html>`;

let server: Server | null = null, starting: Promise<number> | null = null, browser: Promise<Browser> | null = null;

function listen(): Promise<number> {
  return (starting ??= new Promise(done => {
    server = createServer((req, res) => {
      const url = decodeURIComponent((req.url ?? '/').split('?')[0]!);
      if (url === '/page.html') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(PAGE_HTML); return; }
      for (const [prefix, root] of roots()) {
        if (!url.startsWith(prefix)) continue;
        const full = normalize(join(root, url.slice(prefix.length)));
        if (!full.startsWith(normalize(root) + sep) || !existsSync(full) || !statSync(full).isFile()) break;
        res.writeHead(200, { 'content-type': MIME[extname(full).toLowerCase()] ?? 'application/octet-stream' });
        createReadStream(full).pipe(res); return;
      }
      res.writeHead(404).end();
    });
    server.listen(0, '127.0.0.1', () => done((server!.address() as { port: number }).port));
  }));
}

/** Chrome on ANGLE + SwiftShader: WebGL (MapLibre and three.js) with no GPU, as in the Docker image. */
export const SOFTWARE_GL_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-sandbox', '--no-sandbox'];
const launch = () => (browser ??= chromium.launch({ headless: true, ...(config.chrome.path ? { executablePath: config.chrome.path } : { channel: config.chrome.channel }), args: [...(process.env.MOOVI_MAP_GPU === '1' ? ['--ignore-gpu-blocklist'] : SOFTWARE_GL_ARGS), ...(process.env.MOOVI_CHROME_ARGS ?? '').split(' ').filter(Boolean)] }));

export async function canRenderMaps(): Promise<boolean> { try { await launch(); return true; } catch { browser = null; return false; } }

export class TilesFailed extends Error { constructor(why: string) { super(`The map tiles did not load: ${why}`); this.name = 'TilesFailed'; } }

export interface MapOptions {
  places: Place[]; width?: number; height?: number; fps?: number; seconds?: number;
  /** auto: tiles, and the globe if they fail; tiles: tiles or an error; globe: the globe only */
  mode?: 'auto' | 'tiles' | 'globe';
  tileTimeoutMs?: number; styleUrl?: string;
}
export interface MapSession { mode: 'tiles' | 'globe'; fellBack: string | null; frames: number; fps: number; seconds: number; stops: Stop[]; camera(n: number): Cam; frame(n: number): Promise<Buffer>; close(): Promise<void> }

async function openOne(page: Page, o: MapOptions, mode: 'tiles' | 'globe', cfgBase: Record<string, unknown>) {
  await page.waitForFunction('window.__ready === true', null, { timeout: 30_000 });
  try { return await page.evaluate(c => (window as unknown as { __open: (x: unknown) => Promise<{ mode: string }> }).__open(c), { ...cfgBase, mode }); }
  catch (e) { throw mode === 'tiles' ? new TilesFailed(String((e as Error).message).slice(0, 200)) : e; }
}

export async function openMap(o: MapOptions): Promise<MapSession> {
  if (!o.places.length) throw new Error('A map shot needs at least one place');
  await ensureCountries();
  const width = Math.round(o.width ?? 1080), height = Math.round(o.height ?? 1920), fps = o.fps ?? 30, seconds = o.seconds ?? 4;
  const stops = toStops(o.places), frames = Math.max(1, Math.round(seconds * fps));
  const cfg = {
    stops, width, height, fps, seconds, styleUrl: o.styleUrl ?? STYLE_URL, countriesUrl: COUNTRIES_PAGE_URL, attribution: ATTRIBUTION,
    loadTimeoutMs: 25_000, tileTimeoutMs: o.tileTimeoutMs ?? 20_000, globeHeight: globeHeight(0),
    colors: { ice: color.ice, deepIce: color.deepIce, white: color.surface, iceWhite: color.iceWhite, inkMuted: color.inkMuted },
  };
  const [b, port] = await Promise.all([launch(), listen()]);
  const mk = async (mode: 'tiles' | 'globe') => {
    const page = await b.newPage({ viewport: { width, height } });
    page.setDefaultTimeout(0);
    await page.goto(`http://127.0.0.1:${port}/page.html`);
    try { await openOne(page, o, mode, cfg); return page; } catch (e) { await page.close().catch(() => undefined); throw e; }
  };
  let page: Page, mode: 'tiles' | 'globe' = o.mode === 'globe' ? 'globe' : 'tiles', fellBack: string | null = null;
  try { page = await mk(mode); }
  catch (e) {
    if (mode === 'globe' || o.mode === 'tiles') throw e;
    fellBack = (e as Error).message; mode = 'globe'; page = await mk('globe');
  }
  const camera = (n: number) => cameraAt(stops, n / fps, seconds);
  // the globe's camera height follows the map zoom; the page gets it per frame through cam.zoom
  return {
    get mode() { return mode; }, fellBack, frames, fps, seconds, stops, camera,
    async frame(n) {
      const cam = camera(n);
      const r = await page.evaluate(([c, h, m]) => (window as unknown as { __frame: (x: unknown) => Promise<{ ok: boolean }> }).__frame({ ...(c as object), globeH: h, mode: m }), [cam, globeHeight(cam.zoom), mode] as const);
      if (!r.ok) throw new TilesFailed(`frame ${n} still had tiles loading after ${cfg.tileTimeoutMs} ms`);
      return page.screenshot({ type: 'png' });
    },
    async close() { await page.close().catch(() => undefined); },
  } as MapSession;
}

export interface MapStats { frames: number; seconds: number; mode: 'tiles' | 'globe'; fellBack: string | null; totalMs: number; secPerSec: number }

/** Render the whole flight to PNG frames (the tiles mode retried as a globe if a frame cannot be completed). */
export async function renderMap(o: MapOptions, framesDir: string): Promise<MapStats> {
  mkdirSync(framesDir, { recursive: true });
  const t0 = performance.now();
  const run = async (m: MapOptions) => {
    const s = await openMap(m);
    try { for (let n = 0; n < s.frames; n++) writeFileSync(join(framesDir, `f${String(n).padStart(5, '0')}.png`), await s.frame(n)); }
    finally { await s.close(); }
    return s;
  };
  let s: MapSession, fell: string | null = null;
  try { s = await run(o); fell = s.fellBack; }
  catch (e) { if (!(e instanceof TilesFailed) || o.mode === 'tiles') throw e; fell = (e as Error).message; s = await run({ ...o, mode: 'globe' }); }
  const totalMs = performance.now() - t0;
  return { frames: s.frames, seconds: s.seconds, mode: s.mode, fellBack: fell, totalMs, secPerSec: totalMs / 1000 / s.seconds };
}

export async function closeMaps() {
  if (browser) { const b = await browser; await b.close().catch(() => undefined); browser = null; }
  if (server) { await new Promise(r => server!.close(() => r(null))); server = null; starting = null; }
}
