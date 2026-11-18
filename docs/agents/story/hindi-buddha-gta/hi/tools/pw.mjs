// pw.mjs: a headless Chromium for the cloud (software WebGL). import { open } from './pw.mjs'
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch { pw = require('/opt/node22/lib/node_modules/playwright'); }
export async function open(url, { w = 720, h = 1280, args = [] } = {}) {
  const b = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-vsync', '--autoplay-policy=no-user-gesture-required', ...args] });
  const p = await (await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 })).newPage();
  p.on('pageerror', e => console.log('PAGE ERROR', String(e.stack || e).slice(0, 600)));
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('console.' + m.type(), m.text().slice(0, 300)); });
  await p.goto(url, { waitUntil: 'commit' }); await p.waitForFunction(() => window.__ready === true || window.__bootError, null, { timeout: 600000 }); const be = await p.evaluate(() => window.__bootError); if (be) { await b.close(); throw new Error('page boot failed: ' + be); }
  return { b, p };
}
