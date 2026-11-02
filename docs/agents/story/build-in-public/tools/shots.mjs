// shots.mjs: one warm page, a list of times -> JPEG frames + a contact sheet with time stamps. Also prints the page's errors.
//   node shots.mjs <page.html> <out dir> <t1,t2,...> [cols=4]
import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';
const require = createRequire('C:/Ishaan GPT/hackthons/moovi/package.json');
const { chromium } = require('C:/Ishaan GPT/hackthons/moovi/node_modules/.pnpm/playwright-core@1.56.1/node_modules/playwright-core');
const [page, outDir, list, colsArg] = process.argv.slice(2), T = list.split(',').map(Number), cols = +(colsArg || 4);
mkdirSync(outDir, { recursive: true });
const T0 = Date.now();
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const p = await (await b.newContext({ viewport: { width: 1000, height: 600 }, deviceScaleFactor: 2 })).newPage();
const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 300))); p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
await p.goto(pathToFileURL(resolve(page)).href + '?embed=1', { waitUntil: 'load', timeout: 400000 });
await p.waitForFunction(() => window.__ready === true, null, { timeout: 400000 });
const info0 = await p.evaluate(() => window.__info);
console.log('loaded', ((Date.now() - T0) / 1000).toFixed(0), 's', JSON.stringify(info0).slice(0, 600));
const files = [];
for (const t of T) {
  const r = await p.evaluate(t => { window.seek(t); return { b64: document.getElementById('cv').toDataURL('image/jpeg', .9).slice(23), info: window.__info }; }, t);
  const f = join(outDir, `t${t.toFixed(2).padStart(6, '0')}.jpg`); writeFileSync(f, Buffer.from(r.b64, 'base64')); files.push(f);
  console.log(t, r.info.id, r.info.ms + ' ms', (r.info.errs || []).length ? 'ERR ' + r.info.errs.slice(-1) : '');
}
await b.close();
const rows = Math.ceil(files.length / cols);
execFileSync('ffmpeg', ['-v', 'error', '-y', ...files.flatMap(f => ['-i', f]), '-filter_complex',
  files.map((f, i) => `[${i}]scale=480:-2,drawtext=fontfile='C\\:/Windows/Fonts/arial.ttf':text='${T[i].toFixed(1)}s':x=6:y=6:fontsize=22:fontcolor=white:box=1:boxcolor=black@0.6[v${i}]`).join(';') + ';' +
  files.map((f, i) => `[v${i}]`).join('') + `xstack=inputs=${files.length}:layout=${files.map((f, i) => `${(i % cols) * 480}_${Math.floor(i / cols) * 270}`).join('|')}:fill=black[o]`,
  '-map', '[o]', '-q:v', '3', join(outDir, 'sheet.jpg')]);
console.log('sheet', join(outDir, 'sheet.jpg'), 'errors:', errs.length ? errs.join(' | ') : 'none', 'total', ((Date.now() - T0) / 1000).toFixed(0), 's');
