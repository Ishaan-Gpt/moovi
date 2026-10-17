// temp (deleted before commit): the upload edit end to end on one clip as a Studio Cut, then serve it and measure
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { config } from '../src/config';
import { planEdit } from '../src/edit/job';
import { PAGE } from '../src/edit/page';
import { servePlayer } from '../src/s4/player';

const [clip, dir, port = '4330'] = process.argv.slice(2);
const t0 = Date.now();
if (!process.argv.includes('--measure-only')) {
const p = await planEdit({ path: clip!, dir: dir!, name: 'src.mp4', brand: { name: 'Moovi', url: 'moovi-three.vercel.app', tagline: 'The AI video editor' }, onDone: (s, n) => console.log(`  ${s} ${n}s`), onNote: t => console.log('  note:', t) });
console.log('preview ready', ((Date.now() - t0) / 1000).toFixed(1), 's; template', (p.edl as { template?: { id: string } }).template?.id, 'output', p.edl.output);
const [v, r, m] = await Promise.all([p.voice, p.restore, p.mix]);
console.log('voice', !!v, 'restore', r && { restored: r.restored, graded: r.graded, s: r.seconds }, 'mix', m, 'all done', ((Date.now() - t0) / 1000).toFixed(1), 's');
}
const e = JSON.parse(readFileSync(`${dir}/edl.json`, 'utf8'));
console.log('edl source', e.source.file, 'mix', e.mix, 'inserts', (e.inserts ?? []).filter((x: { asset_ref?: string }) => x.asset_ref?.startsWith('studio-cut:')).map((x: { asset_ref: string; t0: number }) => `${x.asset_ref.slice(11)}@${x.t0.toFixed(1)}`).join(' '));
const srv = await servePlayer(dir!, Number(port), PAGE);
console.log('serving', srv.url);
// the GPU measure: headless Chrome on the real GPU, play it end to end, rAF intervals and the player's own numbers
const b = await chromium.launch({ headless: true, ...(config.chrome.path ? { executablePath: config.chrome.path } : { channel: config.chrome.channel }), args: ['--autoplay-policy=no-user-gesture-required', '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const pg = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errs: string[] = []; pg.on('pageerror', x => errs.push(String(x))); pg.on('console', x => { if (x.type() === 'error') errs.push(x.text()); });
await pg.goto(srv.url); await pg.waitForFunction(() => (window as unknown as { __ready?: boolean; __error?: string }).__ready || (window as unknown as { __error?: string }).__error, null, { timeout: 60000 });
await pg.evaluate(() => { const w = window as unknown as { __iv: number[]; __play: () => void }; w.__iv = []; let last = performance.now(); const tick = (n: number) => { w.__iv.push(n - last); last = n; requestAnimationFrame(tick); }; requestAnimationFrame(tick); w.__play(); });
await pg.waitForFunction(() => (window as unknown as { __done?: boolean }).__done, null, { timeout: 120000 });
const out = await pg.evaluate(() => { const w = window as unknown as { __iv: number[]; __metrics: () => unknown }; const iv = w.__iv.slice(5).sort((a, b) => a - b), mean = iv.reduce((a, b) => a + b, 0) / iv.length; return { fps: +(1000 / mean).toFixed(1), p95ms: +iv[Math.floor(iv.length * 0.95)]!.toFixed(1), over50ms: iv.filter(x => x > 50).length, frames: iv.length, m: w.__metrics() }; });
console.log('measure', JSON.stringify(out)); console.log('errors', errs.slice(0, 5));
await b.close();
if (!process.argv.includes('--keep')) { srv.close?.(); process.exit(0); }
