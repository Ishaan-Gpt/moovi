import { createReadStream, existsSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { createRequire } from 'node:module';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { chromium, type Browser } from 'playwright-core';
import { config } from '../config';
import { phAssets, phHdri, phModel, phRank, POLYHAVEN_CREDIT } from '../footage/polyhaven';
import { encodeFrames } from './capture';

/**
 * A real 3D prop: a Poly Haven model (PBR textures) on a slow orbit, lit and backed by a Poly Haven HDRI (blurred, so
 * the object reads first), drawn by three.js in headless Chrome (software GL) frame by frame. The camera eases in as
 * it turns, so the beat has depth and motion every frame. The engine picks the model by the nouns the beat must show,
 * and the HDRI by the film's topic (a studio when nothing fits).
 */
const MIME: Record<string, string> = { '.js': 'text/javascript', '.html': 'text/html', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream', '.jpg': 'image/jpeg', '.png': 'image/png', '.hdr': 'application/octet-stream' };
const THREE_ROOT = () => resolve(dirname(createRequire(import.meta.url).resolve('three')), '..');

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#000;overflow:hidden}canvas{display:block}</style>
<script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script></head><body>
<script type="module">
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
window.__load = async (p) => {
  const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  r.setPixelRatio(1); r.setSize(p.w, p.h, false); r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05; r.outputColorSpace = THREE.SRGBColorSpace;
  document.body.appendChild(r.domElement);
  const scene = new THREE.Scene();
  const hdr = await new RGBELoader().loadAsync(p.hdri); hdr.mapping = THREE.EquirectangularReflectionMapping;
  scene.environment = hdr; scene.background = hdr; scene.backgroundBlurriness = 0.2; scene.backgroundIntensity = 0.8;
  const gltf = await new GLTFLoader().loadAsync(p.model);
  const obj = gltf.scene, box = new THREE.Box3().setFromObject(obj), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  const k = 1 / Math.max(size.x, size.y, size.z); obj.scale.setScalar(k); obj.position.set(-c.x * k, -box.min.y * k - size.y * k / 2, -c.z * k);
  scene.add(obj);
  const key = new THREE.DirectionalLight(p.accent, 1.2); key.position.set(-2, 3, 2); scene.add(key);
  const cam = new THREE.PerspectiveCamera(32, p.w / p.h, 0.01, 100);
  const ease = x => x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
  window.__frame = (n) => {
    const u = n / Math.max(1, p.frames - 1), a = 0.7 + 1.1 * ease(u), d = 3.7 - 0.7 * ease(u), el = 0.3 - 0.1 * u;
    cam.position.set(Math.sin(a) * d * Math.cos(el), Math.sin(el) * d + 0.05, Math.cos(a) * d * Math.cos(el)); cam.lookAt(0, 0.02, 0);
    r.render(scene, cam);
    return r.domElement.toDataURL('image/jpeg', 0.93).slice(23);
  };
  return true;
};
window.__ready = true;
</script></body></html>`;

let server: Server | null = null, port = 0, browser: Promise<Browser> | null = null;
async function serve(): Promise<number> {
  if (server) return port;
  const roots: [string, string][] = [['/three/', THREE_ROOT()], ['/ph/', join(config.data, 'cache', 'polyhaven')]];
  server = createServer((req, res) => {
    const u = decodeURIComponent((req.url ?? '/').split('?')[0]!);
    if (u === '/' || u === '/index.html') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(PAGE); return; }
    let file: string | null = null;
    for (const [pre, root] of roots) if (u.startsWith(pre)) { const f = normalize(join(root, u.slice(pre.length))); if (f.startsWith(normalize(root) + sep)) file = f; break; }
    if (!file || !existsSync(file) || !statSync(file).isFile()) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'content-type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream' }); createReadStream(file).pipe(res);
  });
  await new Promise<void>(r => server!.listen(0, '127.0.0.1', () => r()));
  port = (server.address() as { port: number }).port;
  return port;
}
const launch = () => (browser ??= chromium.launch({ headless: true, ...(config.chrome.path ? { executablePath: config.chrome.path } : { channel: config.chrome.channel }), args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--disable-dev-shm-usage'] }));
export async function closeModel3d() { if (browser) { const b = await browser; browser = null; await b.close().catch(() => undefined); } if (server) { server.close(); server = null; } }

/** Objects the director may show as a real 3D model: Poly Haven's hand-sized props (food, dishes, containers, tools), the topic's own first. */
export async function modelObjects(topic: string, n = 36): Promise<string[]> {
  const all = await phAssets();
  const props = all.filter(a => a.type === 'model' && a.categories.some(c => ['food', 'dishes', 'containers', 'props', 'tools', 'decorative', 'plants'].includes(c)) && !a.categories.includes('furniture'));
  const first = new Set(phRank(props, 'model', topic.split(/\W+/)).map(x => x.a.id));
  const name = (id: string) => all.find(a => a.id === id)!.name.toLowerCase().replace(/_/g, ' ').replace(/\s*\d+$/, '');
  return [...new Set([...[...first, ...props.map(a => a.id)].slice(0, n).map(name)])];
}

/** The Poly Haven model and HDRI a beat gets, by its nouns and the film's topic; null when no model names them. */
export async function pickModel(see: string[], topic: string[]): Promise<{ model: string; hdri: string } | null> {
  const all = await phAssets();
  const m = phRank(all, 'model', see)[0] ?? null;
  if (!m) return null;
  // a calm, warm light: no derelict, industrial or night sets behind an everyday object
  const calm = all.filter(a => a.type === 'hdri' && !a.tags.concat(a.categories, a.id).some(t => /abandon|industr|night|tank|ruin|urban|road|parking|construct|derelict/.test(t)));
  const h = phRank(calm, 'hdri', topic)[0]?.a.id ?? phRank(calm, 'hdri', ['studio'])[0]?.a.id ?? 'studio_small_09';
  return { model: m.a.id, hdri: h };
}

export async function model3dSegment(o: { see: string[]; queries: string[]; text: string; topic?: string[]; accent: string; frames: number; fps: number; out: string; dir: string }): Promise<{ model: string; hdri: string; detail: string; msPerFrame: number }> {
  const pick = await pickModel(o.see, o.topic ?? o.queries);
  if (!pick) throw new Error(`no Poly Haven model names ${o.see.join('/')}`);
  const [gltf, hdr] = await Promise.all([phModel(pick.model), phHdri(pick.hdri)]);
  const base = join(config.data, 'cache', 'polyhaven');
  const rel = (f: string) => `/ph/${f.slice(base.length + 1).split(sep).join('/')}`;
  const p0 = await serve(), b = await launch();
  const W = Number(process.env.MOOVI_MODEL3D_W ?? 540), H = Math.round(W * 16 / 9), pages = Math.max(1, Math.min(Number(process.env.MOOVI_MODEL3D_PAGES ?? 2), o.frames));
  const t0 = Date.now(), fdir = join(o.dir, 'm3d-frames');
  rmSync(fdir, { recursive: true, force: true }); mkdirSync(fdir, { recursive: true });
  await Promise.all(Array.from({ length: pages }, async (_, k) => {
    const ctx = await b.newContext({ viewport: { width: W, height: H } }), page = await ctx.newPage();
    try {
      await page.goto(`http://127.0.0.1:${p0}/`, { timeout: 60_000 });
      await page.waitForFunction('window.__ready', null, { timeout: 30_000 });
      await page.evaluate(`window.__load(${JSON.stringify({ w: W, h: H, frames: o.frames, model: rel(gltf), hdri: rel(hdr), accent: o.accent })})`);
      const a = Math.floor((k * o.frames) / pages), z = Math.floor(((k + 1) * o.frames) / pages);
      for (let n = a; n < z; n++) writeFileSync(join(fdir, `f${String(n).padStart(5, '0')}.jpg`), Buffer.from(await page.evaluate(`window.__frame(${n})`) as string, 'base64'));
    } finally { await ctx.close().catch(() => undefined); }
  }));
  await encodeFrames(fdir, o.out, o.fps);
  rmSync(fdir, { recursive: true, force: true });
  const ms = Date.now() - t0;
  return { ...pick, msPerFrame: Math.round(ms / o.frames), detail: `Poly Haven model ${pick.model} lit by HDRI ${pick.hdri} (${POLYHAVEN_CREDIT}), three.js orbit, ${o.frames} frames at ${Math.round(ms / o.frames)} ms/frame` };
}
