/**
 * One contact sheet from the live preview: stills at fixed times (or one per beat), each labelled with the beat's
 * set-up, so a reader can SEE what each film cast. Clone runs put the reference's frame beside ours.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { config } from '../config';

/** The sheet's path and the times that showed nothing (no print and no typed word: an empty frame is a bug). */
export async function contactSheet(o: { pv: string; dir: string; out: string; title: string; duration: number; step?: number; perBeat?: boolean; refVideo?: string; per?: number; keepFrames?: boolean }): Promise<{ path: string; empty: number[] }> {
  const b = await chromium.launch({ headless: true, ...(config.chrome.path ? { executablePath: config.chrome.path } : { channel: config.chrome.channel }) });
  try {
    const page = await b.newPage({ viewport: { width: 270, height: 480 } });
    await page.goto(`${o.pv}?t=0.1`); await page.waitForFunction('window.__ready || window.__error', null, { timeout: 90_000 });
    const beats = await page.evaluate('window.__beats || []') as { t0: number; setup: string }[];
    const times: number[] = [];
    if (o.perBeat) beats.forEach((x, i) => { const t1 = beats[i + 1]?.t0 ?? o.duration; times.push(+(x.t0 + Math.min(1.6, (t1 - x.t0) * 0.78)).toFixed(2)); });
    else for (let t = 0.6; t < o.duration - 0.3; t += o.step ?? 1.5) times.push(+t.toFixed(2));
    const setupAt = (t: number) => { let s = ''; for (const x of beats) if (t >= x.t0) s = x.setup; return s; };
    const cells: string[] = [], empty: number[] = [];
    mkdirSync(join(o.dir, 'sheet'), { recursive: true });
    const img = (p: string) => `<img src="data:image/png;base64,${readFileSync(p).toString('base64')}">`;
    for (const t of times) {
      await page.goto(`${o.pv}?t=${t}`); await page.waitForFunction('window.__ready || window.__error', null, { timeout: 90_000 });
      const f = join(o.dir, 'sheet', `o${t}.png`); await page.screenshot({ path: f });
      const sh = await page.evaluate('window.__shown ? window.__shown() : null') as { pics: number; letters: number } | null;
      if (sh && !sh.pics && !sh.letters) empty.push(t);
      let ref = '';
      if (o.refVideo) { ref = join(o.dir, 'sheet', `r${t}.png`); execFileSync(config.ffmpeg, ['-v', 'error', '-y', '-ss', String(t), '-i', o.refVideo, '-frames:v', '1', '-vf', 'scale=270:480', ref]); }
      cells.push(`<div class="c"><b>${t.toFixed(1)}s</b> <i>${setupAt(t)}</i>${empty.includes(t) ? ' <u style="color:#f66">EMPTY</u>' : ''}<div>${ref ? img(ref) : ''}${img(f)}</div></div>`);
    }
    const per = o.per ?? (o.refVideo ? 6 : 8);
    await page.setViewportSize({ width: per * (o.refVideo ? 548 : 274) + 20, height: 600 });
    await page.setContent(`<html><body style="margin:0;padding:10px;background:#111;color:#ddd;font:14px system-ui"><div style="margin-bottom:8px">${o.title}</div><div style="display:grid;grid-template-columns:repeat(${per},auto);gap:4px">${cells.join('')}</div><style>.c img{width:270px;height:480px;display:inline-block;margin-right:2px}.c i{color:#9cf;font-style:normal}</style></body></html>`);
    await page.screenshot({ path: o.out, fullPage: true });
    // the frames live on in the sheet: keep the disk lean
    if (!o.keepFrames) rmSync(join(o.dir, 'sheet'), { recursive: true, force: true });
    return { path: o.out, empty };
  } finally { await b.close(); }
}
