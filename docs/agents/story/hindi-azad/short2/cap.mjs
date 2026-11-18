// cap.mjs: full-size 1080x1920 review frames of short.html (WebGL + overlay composited), on the real GPU.
//   node cap.mjs name=r1 t=0.5,2,6.6   [grid=1]  -> data/look-judge/char-sheets/dandi-<name>-t<t>.jpg (+ a contact grid)
import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW || 'C:/Ishaan GPT/hackthons/moovi/node_modules/.pnpm/playwright-core@1.56.1/node_modules/playwright-core');
const here = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => (process.argv.find(a => a.startsWith(k + '=')) || '').split('=')[1] || d;
const OUT = 'C:/Ishaan GPT/hackthons/moovi/data/look-judge/char-sheets'; mkdirSync(OUT, { recursive: true });
const name = arg('name', 'r'); let times = arg('t', '1') === 'mid' ? null : arg('t', '1').split(',').map(Number);
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const p = await (await browser.newContext({ viewport: { width: 600, height: 1000 } })).newPage();
const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 300))); p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text().slice(0, 200)); });
const T = Date.now();
await p.goto(pathToFileURL(join(here, 'short.html')).href + '?embed=1' + (process.env.QS || ''), { waitUntil: 'load', timeout: 300000 });
await p.waitForFunction(() => window.__ready === true, null, { timeout: 300000 });
if (!times) times = await p.evaluate(() => { const st = window.SHOTS.map(s => s.at()), D = filmDuration(); return st.map((a, i) => +((a + (st[i + 1] || D)) / 2).toFixed(2)); });
const files = [], infos = [];
for (const t of times) {
  const r = await p.evaluate(t => ({ b: window.frameB64(t), i: window.__info }), t);
  const f = join(OUT, `gandhi-${name}-t${t}.jpg`); writeFileSync(f, Buffer.from(r.b, 'base64')); files.push(f);
  infos.push({ t, shot: r.i.shot, tr: r.i.tr, faces: (r.i.faces || []).map(x => [x.who, x.x0 | 0, x.y0 | 0, x.x1 | 0, x.y1 | 0].join(' ')), ov: r.i.overlay });
}
await browser.close();
if (arg('grid', '1') === '1' && files.length > 1) {
  const n = files.length, cols = Math.min(+arg('cols', 6), n), rows = Math.ceil(n / cols);
  const fc = files.map((_, i) => `[${i}:v]scale=360:640,setsar=1[v${i}]`).join(';') + ';' + files.map((_, i) => `[v${i}]`).join('') + `concat=n=${n}:v=1:a=0,tile=${cols}x${rows}[o]`;
  execFileSync('ffmpeg', ['-v', 'error', '-y', ...files.flatMap(f => ['-i', f]), '-filter_complex', fc, '-map', '[o]', '-frames:v', '1', '-q:v', '3', join(OUT, `gandhi-${name}-grid.jpg`)]);
}
console.log(JSON.stringify({ secs: (Date.now() - T) / 1000, errs: errs.slice(0, 12), infos }, null, 0));
