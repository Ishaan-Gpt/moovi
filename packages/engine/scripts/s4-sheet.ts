// tsx scripts/s4-sheet.ts <s4 film dir>: re-shoots a Style 4 film's contact sheet with the current player (no model calls)
import { mkdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { config } from '../src/config';
import { servePlayer } from '../src/s4/player';
const dir = resolve(process.argv[2]!), film = JSON.parse(readFileSync(join(dir, 'film.json'), 'utf8'));
const { url, close } = await servePlayer(dir, 0);
const b = await chromium.launch({ headless: true, ...(config.chrome.path ? { executablePath: config.chrome.path } : { channel: config.chrome.channel }) });
const page = await b.newPage({ viewport: { width: 270, height: 480 } });
page.on('pageerror', e => console.log('pageerror:', String(e)));
const times: number[] = []; for (let t = 0.6; t < film.duration - 0.3; t += 1.5) times.push(+t.toFixed(2));
mkdirSync(join(dir, 'sheet'), { recursive: true });
const cells: string[] = [];
for (const t of times) {
  await page.goto(`${url}?t=${t}`); await page.waitForFunction('window.__ready || window.__error', null, { timeout: 90_000 });
  const f = join(dir, 'sheet', `o${t}.png`); await page.screenshot({ path: f });
  cells.push(`<div class="c"><b>${t.toFixed(1)}s</b><div><img src="data:image/png;base64,${readFileSync(f).toString('base64')}"></div></div>`);
}
await page.setViewportSize({ width: 8 * 274 + 20, height: 600 });
await page.setContent(`<html><body style="margin:0;padding:10px;background:#111;color:#ddd;font:14px system-ui"><div style="margin-bottom:8px">${basename(dir)} · Style 4 code-drawn pictures</div><div style="display:grid;grid-template-columns:repeat(8,auto);gap:4px">${cells.join('')}</div><style>.c img{width:270px;height:480px;display:inline-block;margin-right:2px}</style></body></html>`);
const out = join(dirname(dir), `${basename(dir)}-sheet.png`); await page.screenshot({ path: out, fullPage: true });
await b.close(); close(); console.log(out);
