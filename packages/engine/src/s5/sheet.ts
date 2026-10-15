/**
 * Style 5 contact sheet from the LIVE player: one page load, then window.__render(t) per still (no reloads); with a
 * reference video, its frames at the same times come from ONE ffmpeg pass. Writes data/s5/<clone-sheet|id-sheet>.png.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { config } from '../config';

/**
 * How many things a viewer can see right now: drawn shapes and lettered boxes inside the visible beats, on the stage,
 * with an effective opacity (the product up the tree) above 0.15. 0 = an empty frame (the paper and its rings only).
 */
const VISIBLE = `(() => {
  const stage = document.getElementById('stage').getBoundingClientRect();
  const op = e => { let k = 1; for (let n = e; n && n.id !== 'cam'; n = n.parentElement) { const cs = getComputedStyle(n); if (cs.display === 'none' || cs.visibility === 'hidden') return 0; k *= Number(cs.opacity); } return k; };
  let n = 0;
  for (const b of document.querySelectorAll('#cam > .beat')) {
    if (b.style.display !== 'block') continue;
    for (const e of b.querySelectorAll('path,circle,rect,line,ellipse,text,.line .w,.lab,.pill,.num,.mid,.slam,.card,.bub,.ncard,.vcard,.btn,.sbox,.cap,.mark,.qmark,.qbig,.qq,.pre,.pay')) {
      const r = e.getBoundingClientRect(); if (r.width < 2 && r.height < 2) continue;
      if (r.right < stage.left || r.left > stage.right || r.bottom < stage.top || r.top > stage.bottom) continue;
      if (op(e) > 0.15) { n++; if (n > 3) return n; }
    }
  }
  return n;
})()`;

/** empty frames of the last sheet (the style's report records them) */
export let lastEmpty: number[] = [];

export async function contactSheet(o: { pv: string; dir: string; id: string; duration: number; refVideo?: string; step?: number }): Promise<string> {
  const step = o.step ?? 1.5, times: number[] = []; for (let t = 0.6; t < o.duration - 0.2; t += step) times.push(+t.toFixed(2));
  const sd = join(o.dir, 'sheet'); mkdirSync(sd, { recursive: true });
  if (o.refVideo) {
    // one pass: pick the frame nearest each time (select on t), scaled for the sheet
    const [a, b] = execFileSync(config.ffprobe, ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=r_frame_rate', '-of', 'csv=p=0', o.refVideo]).toString().trim().split('/').map(Number);
    const fps = a! / (b || 1), sel = times.map(t => `eq(n\,${Math.round(t * fps)})`).join('+');
    execFileSync(config.ffmpeg, ['-v', 'error', '-y', '-i', o.refVideo, '-vf', `select='${sel}',scale=270:480`, '-vsync', 'vfr', join(sd, 'r%03d.png')]);
  }
  const br = await chromium.launch({ headless: true, ...(config.chrome.path ? { executablePath: config.chrome.path } : { channel: config.chrome.channel }) });
  const page = await br.newPage({ viewport: { width: 270, height: 480 } });
  page.on('pageerror', e => console.log('pageerror:', String(e)));
  await page.goto(`${o.pv}?t=0`); await page.waitForFunction('window.__ready || window.__error', null, { timeout: 60_000 });
  const err = await page.evaluate('window.__error'); if (err) throw new Error(String(err));
  const img = (p: string) => `<img src="data:image/png;base64,${readFileSync(p).toString('base64')}">`, cells: string[] = [], empty: number[] = [];
  for (const [i, t] of times.entries()) {
    await page.evaluate(`window.__render(${t})`);
    if (Number(await page.evaluate(VISIBLE)) === 0) empty.push(t);
    const f = join(sd, `o${t}.png`); await page.screenshot({ path: f });
    let ref = ''; if (o.refVideo) { const r = join(sd, `r${String(i + 1).padStart(3, '0')}.png`); try { ref = img(r); } catch { ref = ''; } }
    cells.push(`<div class="c"><b${empty.includes(t) ? ' style="color:#f66"' : ''}>${t.toFixed(1)}s${empty.includes(t) ? ' EMPTY' : ''}</b><div>${ref}${img(f)}</div></div>`);
  }
  const per = o.refVideo ? 6 : 8;
  await page.setViewportSize({ width: per * (o.refVideo ? 548 : 274) + 20, height: 600 });
  await page.setContent(`<html><body style="margin:0;padding:10px;background:#111;color:#ddd;font:14px system-ui"><div style="margin-bottom:8px">${o.refVideo ? 'Reference (left) vs ours (right), same times' : o.id} · Style 5 Clear Signal, code-drawn devices</div><div style="display:grid;grid-template-columns:repeat(${per},auto);gap:4px">${cells.join('')}</div><style>.c img{width:270px;height:480px;display:inline-block;margin-right:2px}</style></body></html>`);
  const sheet = join(config.data, 's5', o.refVideo ? 'clone-sheet.png' : `${o.id}-sheet.png`);
  await page.screenshot({ path: sheet, fullPage: true });
  await br.close();
  // the frames live on in the sheet: the per-frame PNGs go (the disk is shared)
  rmSync(sd, { recursive: true, force: true });
  if (empty.length) console.warn(`sheet check: ${empty.length} empty frame(s) at ${empty.map(t => `${t}s`).join(', ')}`);
  lastEmpty = empty;
  return sheet;
}

// CLI: tsx src/s5/sheet.ts <preview url> <data/s5/<id> dir> [ref video]
if (process.argv[1]?.endsWith('sheet.ts') && process.argv[2]) {
  const [pv, dir, ref] = process.argv.slice(2) as [string, string, string?];
  const film = JSON.parse(readFileSync(join(dir, 'film.json'), 'utf8')) as { id: string; duration: number };
  const s = Date.now();
  console.log(await contactSheet({ pv, dir, id: film.id, duration: film.duration, refVideo: ref }), `${((Date.now() - s) / 1000).toFixed(1)}s`);
}
