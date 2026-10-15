import { spawn } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { createRequire } from 'node:module';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser } from 'playwright-core';
import { config } from '../config';
import { paletteFor, type LookId } from './looks';

/**
 * 3D scenes inside the headless-Chrome capture. A page loads three.js (served from node_modules, no CDN) and one of the
 * five looks; the engine asks it for frame N and gets a PNG. Time is the frame number over the fps and nothing else, so
 * a frame is the same pixels whenever and in whatever order it is asked for (test/render3d.test.ts proves it).
 *
 * No GPU needed: Chrome is started on ANGLE's SwiftShader (software Vulkan), the same path the Docker image takes. Set
 * MOOVI_3D_GPU=1 to use the machine's own GPU instead (faster on a desktop, not byte-identical to the software frames).
 */
const here = dirname(fileURLToPath(import.meta.url));
const PAGE_DIR = join(here, 'page');
const THREE_DIR = () => dirname(createRequire(import.meta.url).resolve('three'));
const MIME: Record<string, string> = { '.js': 'text/javascript', '.html': 'text/html', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };

export interface LookParams {
  width?: number; height?: number; fps?: number; seconds?: number; seed?: number;
  /** a file inside the engine's data dir: the site screenshot (turntable) or the logo (orbit) */
  texture?: string | null;
  /** the numbers for the data tower */
  values?: number[];
  bg?: string; accent?: string; accent2?: string;
}
export interface Resolved { width: number; height: number; fps: number; seconds: number; frames: number; seed: number }

export function resolveParams(p: LookParams = {}): Resolved {
  const width = Math.round(p.width ?? 1080), height = Math.round(p.height ?? 1920), fps = p.fps ?? 30, seconds = p.seconds ?? 3;
  return { width, height, fps, seconds, frames: Math.max(1, Math.round(seconds * fps)), seed: p.seed ?? 7 };
}

const PAGE_HTML = `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#fff}canvas{display:block}</style></head><body>
<script type="module">
import * as THREE from '/three/three.module.js';
import { build, loadTexture } from '/look/looks.js';
let renderer, look, fps = 30, dur = 3;
window.__load = async (id, p) => {
  if (renderer) renderer.dispose();
  document.querySelectorAll('canvas').forEach(c => c.remove());
  renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1); renderer.setSize(p.width, p.height, false);
  document.body.appendChild(renderer.domElement);
  fps = p.fps; dur = p.seconds;
  if (p.texture) { p.textureObj = await loadTexture(p.texture, id === 'orbit' ? p.accent : null); if (p.textureObj) p.textureAspect = (p.textureObj.image.naturalWidth || p.textureObj.image.width) / (p.textureObj.image.naturalHeight || p.textureObj.image.height); }
  look = build(id, p);
  const gl = renderer.getContext(), dbg = gl.getExtension('WEBGL_debug_renderer_info');
  return { renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'unknown' };
};
window.__frame = (n) => {
  look.update(n / fps, dur);
  renderer.render(look.scene, look.camera);
  return renderer.domElement.toDataURL('image/png').slice(22);
};
window.__ready = true;
</script></body></html>`;

let server: Server | null = null, port = 0, starting: Promise<number> | null = null;
let browser: Promise<Browser> | null = null;

function listen(): Promise<number> {
  return (starting ??= new Promise(done => {
    server = createServer((req, res) => {
      const url = decodeURIComponent((req.url ?? '/').split('?')[0]!);
      if (url === '/page.html') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(PAGE_HTML); return; }
      const roots: [string, string][] = [['/three/', THREE_DIR()], ['/look/', PAGE_DIR], ['/data/', config.data]];
      for (const [prefix, root] of roots) {
        if (!url.startsWith(prefix)) continue;
        const full = normalize(join(root, url.slice(prefix.length)));
        if (!full.startsWith(normalize(root) + sep) || !existsSync(full) || !statSync(full).isFile()) break;
        res.writeHead(200, { 'content-type': MIME[extname(full).toLowerCase()] ?? 'application/octet-stream' });
        createReadStream(full).pipe(res); return;
      }
      res.writeHead(404).end();
    });
    server.listen(0, '127.0.0.1', () => { port = (server!.address() as { port: number }).port; done(port); });
  }));
}

/** Chrome on ANGLE + SwiftShader: WebGL with no GPU. `--enable-unsafe-swiftshader` is needed since Chrome 137. */
export const SOFTWARE_GL_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-sandbox', '--no-sandbox'];

function launch(): Promise<Browser> {
  const gpu = process.env.MOOVI_3D_GPU === '1';
  return (browser ??= chromium.launch({ headless: true, ...(config.chrome.path ? { executablePath: config.chrome.path } : { channel: config.chrome.channel }), args: [...(gpu ? ['--ignore-gpu-blocklist'] : SOFTWARE_GL_ARGS), ...(process.env.MOOVI_CHROME_ARGS ?? '').split(' ').filter(Boolean)] }));
}

/** Is a browser here that can run these looks at all? (Tests skip when not.) */
export async function canRender3d(): Promise<boolean> {
  try { await launch(); return true; } catch { browser = null; return false; }
}

export interface Session { renderer: string; info: Resolved; frame(n: number): Promise<Buffer>; close(): Promise<void> }

const stripUndef = <T extends object>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null)) as T;

/** Open one look: loads the page, the texture and builds the scene. Frames are then asked for by number. */
export async function openLook(id: LookId, params: LookParams = {}): Promise<Session> {
  const info = resolveParams(params), pal = paletteFor(id);
  if (params.texture && !resolve(params.texture).startsWith(resolve(config.data))) throw new Error(`The texture must be inside the data dir: ${params.texture}`);
  const [b, p] = await Promise.all([launch(), listen()]);
  const page = await b.newPage({ viewport: { width: info.width, height: info.height } });
  page.setDefaultTimeout(0);
  await page.goto(`http://127.0.0.1:${p}/page.html`);
  await page.waitForFunction('window.__ready === true', null, { timeout: 30_000 });
  const tex = params.texture ? `/data${resolve(params.texture).slice(resolve(config.data).length).replace(/\\/g, '/')}` : null;
  const loaded = await page.evaluate(([i, q]) => (window as unknown as { __load: (a: string, b: unknown) => Promise<{ renderer: string }> }).__load(i as string, q), [id, { ...pal, ...stripUndef(params), ...info, texture: tex }] as const);
  return {
    renderer: loaded.renderer, info,
    async frame(n) { return Buffer.from(await page.evaluate(k => (window as unknown as { __frame: (x: number) => string }).__frame(k), n), 'base64'); },
    async close() { await page.close().catch(() => undefined); },
  };
}

export interface RenderStats { frames: number; seconds: number; captureMs: number; encodeMs: number; /** wall seconds of rendering per second of film */ secPerSec: number; renderer: string; out: string | null }

/** Render a whole look to PNG frames in `framesDir` and, when `out` is given, an H.264 file (needs ffmpeg). */
export async function renderLook(id: LookId, params: LookParams, o: { out?: string; framesDir?: string } = {}): Promise<RenderStats> {
  const s = await openLook(id, params);
  if (o.out) mkdirSync(dirname(o.out), { recursive: true });
  if (o.framesDir) mkdirSync(o.framesDir, { recursive: true });
  const enc = o.out ? spawn(config.ffmpeg, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(s.info.fps), '-i', '-', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-movflags', '+faststart', o.out], { stdio: ['pipe', 'ignore', 'inherit'] }) : null;
  const encDone = enc ? new Promise<void>((res, rej) => { enc.on('error', rej); enc.on('close', c => (c === 0 ? res() : rej(new Error(`ffmpeg exited ${c}`)))); }) : null;
  encDone?.catch(() => undefined);
  let captureMs = 0;
  const t0 = performance.now();
  try {
    for (let n = 0; n < s.info.frames; n++) {
      const t = performance.now(); const png = await s.frame(n); captureMs += performance.now() - t;
      if (o.framesDir) writeFileSync(join(o.framesDir, `f${String(n).padStart(5, '0')}.png`), png);
      if (enc && !enc.stdin!.write(png)) await new Promise(r => enc.stdin!.once('drain', r));
    }
    enc?.stdin!.end(); await encDone;
  } finally { await s.close(); }
  const total = performance.now() - t0;
  return { frames: s.info.frames, seconds: s.info.seconds, captureMs, encodeMs: Math.max(0, total - captureMs), secPerSec: total / 1000 / s.info.seconds, renderer: s.renderer, out: o.out ?? null };
}

export async function close3d() {
  if (browser) { const b = await browser; await b.close().catch(() => undefined); browser = null; }
  if (server) { await new Promise(r => server!.close(() => r(null))); server = null; starting = null; }
}

/** One frame of a look as a PNG file: the poster a scene's board asked for (fast: one frame, not a clip). */
export async function renderPoster(id: LookId, params: LookParams, out: string, at = 0.6): Promise<{ path: string; width: number; height: number; renderer: string }> {
  const s = await openLook(id, params);
  try {
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, await s.frame(Math.min(s.info.frames - 1, Math.round(s.info.frames * at))));
    return { path: out, width: s.info.width, height: s.info.height, renderer: s.renderer };
  } finally { await s.close(); }
}
