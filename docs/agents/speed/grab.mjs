#!/usr/bin/env node
// grab.mjs: judge and check a film WITHOUT exporting it. Seeks the live page (window.seek(t) + #cv, or window.frameB64(t)) and
// writes stills and 6x5 contact sheets (0.5 s apart by default) for the blind judge. Ishaan, 2026-11-03: "only one final export
// must happen at the end, when I say ok done previewed now export". Checks and judges run on the page; export.mjs runs once.
//
//   node docs/agents/speed/grab.mjs page=<film>/film.html [url=http://localhost:<port>/<film>/film.html] out=<dir> [from=0] [to=<end>] [step=0.5] [times=1,2.5,8] [w=384]
import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
const kv = Object.fromEntries(process.argv.slice(2).filter(a => a.includes('=')).map(a => a.split(/=(.*)/s).slice(0, 2)));
if ((!kv.page && !kv.url) || !kv.out) { console.log('usage: node grab.mjs page=<film.html> out=<dir> [from=0] [to=<end>] [step=0.5] [times=...] [w=384]'); process.exit(2); }
const r = createRequire(resolve('package.json')); let pw; try { pw = r('playwright-core'); } catch { pw = r(join(process.cwd(), 'node_modules/.pnpm/playwright-core@1.56.1/node_modules/playwright-core')); }
const out = resolve(kv.out); mkdirSync(join(out, 'frames'), { recursive: true });
const b = await pw.chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'] });
const p = await (await b.newContext({ viewport: { width: 960, height: 540 } })).newPage();
p.on('pageerror', e => console.log('PAGE ERROR', String(e).slice(0, 300)));
// pages with video or images must be served (file:// taints the canvas): url=http://localhost:<port>/<path>
await p.goto((kv.url || pathToFileURL(resolve(kv.page)).href) + '?embed=1'); await p.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
const dur = await p.evaluate(() => window.DUR || 0), from = +(kv.from || 0), to = +(kv.to || dur), step = +(kv.step || .5);
const times = kv.times ? kv.times.split(',').map(Number) : Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => +(from + i * step).toFixed(3));
const t0 = Date.now();
for (const t of times) { const d = await p.evaluate(t => window.frameB64 ? window.frameB64(t) : (window.seek(t), document.getElementById('cv').toDataURL('image/jpeg', .9).slice(23)), t);
  writeFileSync(join(out, 'frames', `t${t.toFixed(2).padStart(7, '0')}.jpg`), Buffer.from(d, 'base64')); }
await b.close();
// contact sheets, 6 x 5 (15 s a sheet at 0.5 s steps)
const files = readdirSync(join(out, 'frames')).filter(f => f.endsWith('.jpg')).sort();
writeFileSync(join(out, 'list.txt'), files.map(f => `file '${join(out, 'frames', f).split('\\').join('/')}'`).join('\n'));
execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', join(out, 'list.txt'), '-vf', `scale=${kv.w || 384}:-2,tile=6x5`, join(out, 'sheet-%d.jpg')]);
console.log(JSON.stringify({ frames: files.length, sheets: Math.ceil(files.length / 30), msPerFrame: Math.round((Date.now() - t0) / files.length), out }));
