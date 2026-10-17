// temp (deleted before commit): where the Studio Cut frame time goes, per second of the film, on the GPU
import { chromium } from 'playwright-core';
import { config } from '../src/config';
import { PAGE } from '../src/edit/page';
import { servePlayer } from '../src/s4/player';

const srv = await servePlayer(process.argv[2]!, 0, PAGE);
const b = await chromium.launch({ headless: true, ...(config.chrome.path ? { executablePath: config.chrome.path } : { channel: config.chrome.channel }), args: ['--autoplay-policy=no-user-gesture-required', '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const pg = await b.newPage({ viewport: { width: 1280, height: 800 } });
const bad: string[] = []; pg.on('response', r => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url()); });
await pg.goto(srv.url); await pg.waitForFunction(() => (window as any).__ready, null, { timeout: 60000 });
const gpu = await pg.evaluate(() => { const c = document.createElement('canvas').getContext('webgl'); const d = c && c.getExtension('WEBGL_debug_renderer_info'); return d ? c!.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'none'; });
await pg.evaluate(() => {
  const w = window as any, T = w.MOOVI_TEMPLATES['studio-cut'], d0 = T.draw.bind(T); w.__prof = [] as number[][];
  T.draw = (t: number, c: any, s: any) => { const a = performance.now(); d0(t, c, s); w.__prof.push([t, performance.now() - a]); };
  w.__iv = []; let last = performance.now(); const tick = (n: number) => { w.__iv.push([n, n - last]); last = n; requestAnimationFrame(tick); }; requestAnimationFrame(tick); w.__play();
});
await pg.waitForFunction(() => (window as any).__done, null, { timeout: 120000 });
const r = await pg.evaluate(() => { const w = window as any, by: Record<number, number[]> = {}; for (const [t, ms] of w.__prof) (by[Math.floor(t)] ??= []).push(ms);
  return Object.entries(by).map(([s, a]) => `${s}s n${a.length} draw ${(a.reduce((x, y) => x + y, 0) / a.length).toFixed(1)}ms max ${Math.max(...a).toFixed(0)}`); });
console.log('gpu', gpu); console.log(r.join('\n')); console.log('404', bad);
await b.close(); srv.close(); process.exit(0);
