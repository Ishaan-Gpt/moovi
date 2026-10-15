// tsx scripts/s4serve.ts <data/s4/<id> dir> [--port N] [--sheet] [--ref <reference dir>] : serve a built Style 4 film on the live player
// (stays up) and, with --sheet, write its contact sheet (side by side with the reference's frames when --ref is given).
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { config } from '../src/config';
import { servePlayer } from '../src/s4/player';
const args = process.argv.slice(2), opt = (k: string) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : undefined; };
const dir = resolve(args[0]!), ref = opt('ref'), id = basename(dir);
const { url } = await servePlayer(dir, Number(opt('port') ?? 0));
console.log(`PREVIEW ${url}`);
if (args.includes('--sheet')) {
  const s = Date.now(), film = JSON.parse(readFileSync(join(dir, 'film.json'), 'utf8')) as { duration: number };
  const b = await chromium.launch({ headless: true, ...(config.chrome.path ? { executablePath: config.chrome.path } : { channel: config.chrome.channel }) });
  const page = await b.newPage({ viewport: { width: 270, height: 480 } });
  page.on('console', m => { if (m.type() === 'error') console.log('page:', m.text()); });
  page.on('pageerror', e => console.log('pageerror:', String(e)));
  const step = ref ? 2 : 1.5, times: number[] = []; for (let t = 0.6; t < film.duration - 0.3; t += step) times.push(+t.toFixed(2));
  mkdirSync(join(dir, 'sheet'), { recursive: true });
  const img = (p: string) => `<img src="data:image/png;base64,${readFileSync(p).toString('base64')}">`, cells: string[] = [];
  for (const t of times) {
    await page.goto(`${url}?t=${t}`); await page.waitForFunction('window.__ready || window.__error', null, { timeout: 60_000 });
    const err = await page.evaluate('window.__error'); if (err) throw new Error(String(err));
    const f = join(dir, 'sheet', `o${t}.png`); await page.screenshot({ path: f });
    let r = '';
    if (ref) { r = join(dir, 'sheet', `r${t}.png`); execFileSync(config.ffmpeg, ['-v', 'error', '-y', '-ss', String(t), '-i', join(ref, 'video.mp4'), '-frames:v', '1', '-vf', 'scale=270:480', r]); }
    cells.push(`<div class="c"><b>${t.toFixed(1)}s</b><div>${r ? img(r) : ''}${img(f)}</div></div>`);
  }
  const per = ref ? 6 : 8;
  await page.setViewportSize({ width: per * (ref ? 548 : 274) + 20, height: 600 });
  await page.setContent(`<html><body style="margin:0;padding:10px;background:#111;color:#ddd;font:14px system-ui"><div style="margin-bottom:8px">${ref ? 'Reference (left) vs ours (right), same times' : id} · Style 4, code-drawn pictures</div><div style="display:grid;grid-template-columns:repeat(${per},auto);gap:4px">${cells.join('')}</div><style>.c img{width:270px;height:480px;display:inline-block;margin-right:2px}</style></body></html>`);
  const sheet = join(config.data, 's4', ref ? 'clone-sheet.png' : `${id}-sheet.png`);
  await page.screenshot({ path: sheet, fullPage: true }); await b.close();
  console.log(`sheet ${((Date.now() - s) / 1000).toFixed(1)}s ${sheet}`);
}
