// capc.mjs: cast sheet frames. node capc.mjs name=H-r1 "q=c=H&expr=shocked" "q=c=H&blink=1" ...  -> data/look-judge/char-sheets/diwali-<name>-<i>.jpg
import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW || 'C:/Ishaan GPT/hackthons/moovi/node_modules/.pnpm/playwright-core@1.56.1/node_modules/playwright-core');
const here = dirname(fileURLToPath(import.meta.url));
const name = (process.argv.find(a => a.startsWith('name=')) || 'name=c').slice(5);
const qs = process.argv.filter(a => a.startsWith('q=')).map(a => a.slice(2));
const OUT = 'C:/Ishaan GPT/hackthons/moovi/data/look-judge/char-sheets'; mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'] });
const out = [];
for (let i = 0; i < qs.length; i++) {
  const p = await (await browser.newContext({ viewport: { width: 820, height: 520 } })).newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e).slice(0, 300))); p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text().slice(0, 200)); });
  await p.goto(pathToFileURL(join(here, 'sheet.html')).href + '?' + qs[i], { waitUntil: 'load', timeout: 120000 });
  await p.waitForFunction(() => window.__ready === true, null, { timeout: 120000 }).catch(() => {});
  const b = await p.evaluate(() => document.getElementById('cv').toDataURL('image/jpeg', 0.92).slice(23)).catch(e => null);
  const f = join(OUT, `diwali-${name}-${i}.jpg`); if (b) writeFileSync(f, Buffer.from(b, 'base64')); out.push({ f, q: qs[i], errs: errs.filter(e => !/404|ERR_FILE/.test(e)).slice(0, 5) });
  await p.close();
}
await browser.close(); console.log(JSON.stringify(out, null, 1));
