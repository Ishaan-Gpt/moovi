// probe.mjs: walks the film every `step` s and reports any caption or card that leaves the frame, sits on a face, or is clipped.
//   node probe.mjs [step=0.25]
import { createRequire } from 'node:module'; import { pathToFileURL, fileURLToPath } from 'node:url'; import { dirname, join } from 'node:path';
const require = createRequire(import.meta.url); const { chromium } = require(process.env.PW);
const here = dirname(fileURLToPath(import.meta.url)), step = +((process.argv.find(a => a.startsWith('step=')) || 'step=0.25').slice(5));
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const p = await (await b.newContext({ viewport: { width: 1000, height: 600 } })).newPage(); p.on('pageerror', e => console.log('PAGEERR', String(e).slice(0, 300))); await p.goto(pathToFileURL(join(here, 'short.html')).href + '?embed=1', { waitUntil: 'load', timeout: 300000 });
await p.waitForFunction(() => window.__ready === true, null, { timeout: 300000 });
const res = await p.evaluate((step) => { const out = [], D = filmDuration(); window.__probe = true;
  for (let t = 0; t < D; t += step) { const i = window.seek(t), o = i.overlay || {}; const bad = [];
    (o.rects || []).forEach(r => { if (r.x0 < 70 || r.x1 > 905 || r.y0 < 230 || r.y1 > 1480) bad.push('out:' + r.g + ' ' + [r.x0, r.y0, r.x1, r.y1].map(Math.round).join(',')); });
    (o.clash || []).forEach(c => bad.push('clash:' + c)); if (bad.length) out.push(t.toFixed(2) + ' ' + i.shot + ' ' + bad.join(' | ')); }
  return out; }, step);
console.log(res.length + ' problems'); res.forEach(r => console.log(r)); await b.close();
