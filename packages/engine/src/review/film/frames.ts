/**
 * Stills from a live preview, one per beat, each measured by code: does the player say something is on screen, does
 * any text box run off the frame, how much of the frame has visible edges. One page load for players that render a
 * time on request (window.__render, Dark Vox and Anatomy); a reload per still for the ones that read ?t= (Style 4, 5).
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { sh } from '../../bench';
import { config } from '../../config';
import type { Plan } from './plan';
import type { Frame } from './types';

/** When to look at a beat: after its entrance has landed (the contact sheets' rule), never past its end. */
export const sampleTimes = (p: Plan) => p.beats.map((b, i) => {
  const t1 = p.beats[i + 1]?.t0 ?? p.duration;
  return { beat: b.i, setup: b.setup, t: +(b.t0 + Math.min(1.6, Math.max(0.2, (t1 - b.t0) * 0.78))).toFixed(2) };
});

/** Text boxes past the frame edge, in the page: own text only, visible (effective opacity > 0.15), > 6 px outside. */
const OFF_FRAME = `(() => {
  const frame = (document.getElementById('stage') || document.documentElement).getBoundingClientRect();
  const W = Math.min(frame.right, innerWidth), H = Math.min(frame.bottom, innerHeight), L = Math.max(frame.left, 0), T = Math.max(frame.top, 0);
  const seen = e => { let k = 1; for (let n = e; n && n !== document.body; n = n.parentElement) { const cs = getComputedStyle(n); if (cs.display === 'none' || cs.visibility === 'hidden') return 0; k *= Number(cs.opacity); } return k; };
  const out = [];
  for (const e of document.querySelectorAll('body *')) {
    if (!/\\S/.test([...e.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join(''))) continue;
    if (e.closest('[data-chrome], .controls, #controls, button')) continue;
    const b = e.getBoundingClientRect();
    if (!b.width || !b.height || seen(e) <= 0.15) continue;
    // only the part its clipping ancestors let through can be cut by the frame (an odometer's rolling digits sit in a
    // window that hides the rest of the strip: hidden by design, not cut off)
    let r = { left: b.left, top: b.top, right: b.right, bottom: b.bottom };
    for (let n = e.parentElement; n && n !== document.body; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.overflow === 'visible' && cs.overflowX === 'visible' && cs.overflowY === 'visible' && cs.clipPath === 'none') continue;
      const c = n.getBoundingClientRect();
      r = { left: Math.max(r.left, c.left), top: Math.max(r.top, c.top), right: Math.min(r.right, c.right), bottom: Math.min(r.bottom, c.bottom) };
    }
    if (r.right - r.left < 1 || r.bottom - r.top < 1) continue;
    // fully outside = not on stage yet (an entrance), not a clip; only boxes that straddle the edge are cut off
    const inside = r.right > L && r.left < W && r.bottom > T && r.top < H;
    const over = Math.max(L - r.left, r.right - W, T - r.top, r.bottom - H);
    if (inside && over > 6) out.push({ text: e.textContent.trim().slice(0, 40), k: +seen(e).toFixed(2) });
  }
  return out.slice(0, 6);
})()`;

const SHOWN = `(() => {
  if (typeof window.__visible === 'function') return !!window.__visible();
  if (typeof window.__shown === 'function') { const s = window.__shown(); return !!(s && (s.pics || s.letters)); }
  return null;
})()`;

/** Share of the still with visible edges (ffmpeg edgedetect → mean luma / 255). */
async function detailOf(file: string): Promise<number> {
  const { stdout } = await sh(config.ffmpeg, ['-v', 'error', '-i', file, '-vf', 'edgedetect=low=0.08:high=0.25,signalstats,metadata=mode=print:key=lavfi.signalstats.YAVG:file=-', '-f', 'null', '-'], { timeout: 30_000 });
  const m = stdout.match(/YAVG=([\d.]+)/);
  return m ? +(Number(m[1]) / 255).toFixed(4) : 0;
}

export async function sampleFrames(o: { pv: string; plan: Plan; dir: string; signal?: AbortSignal; log?: (s: string) => void }): Promise<{ frames: Frame[]; error: string | null }> {
  const out = join(o.dir, 'review');
  mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ headless: true, ...(config.chrome.path ? { executablePath: config.chrome.path } : { channel: config.chrome.channel }) });
  const frames: Frame[] = [];
  try {
    const page = await b.newPage({ viewport: { width: 270, height: 480 } });
    const load = async (t: number) => {
      await page.goto(`${o.pv}${o.pv.includes('?') ? '&' : '?'}t=${t}`);
      await page.waitForFunction('window.__ready || window.__error', null, { timeout: 90_000 });
      return page.evaluate('window.__error || null') as Promise<string | null>;
    };
    const first = sampleTimes(o.plan);
    const tl = Date.now(); const err = await load(first[0]?.t ?? 0.1); o.log?.(`review first load ${((Date.now() - tl) / 1000).toFixed(1)} s`);
    if (err) return { frames, error: String(err) };
    const renders = await page.evaluate("typeof window.__render === 'function'");
    const ms: Record<string, number> = { load: 0, render: 0, shot: 0, dom: 0 };
    const lap = (k: string, t: number) => { ms[k]! += Date.now() - t; return Date.now(); };
    for (const [k, s] of first.entries()) {
      if (o.signal?.aborted) break;
      let c = Date.now();
      if (renders) { await page.evaluate(`window.__render(${s.t})`); c = lap('render', c); }
      else if (k) { await load(s.t); c = lap('load', c); }
      await page.waitForTimeout(60);
      const file = join(out, `b${s.beat}-${s.t}.jpg`);
      c = Date.now(); await page.screenshot({ path: file, type: 'jpeg', quality: 80 }); c = lap('shot', c);
      const shown = await page.evaluate(SHOWN) as boolean | null;
      const offFrame = await page.evaluate(OFF_FRAME) as { text: string; k: number }[]; lap('dom', c);
      frames.push({ t: s.t, beat: s.beat, setup: s.setup, file, shown, offFrame, detail: 0 });
    }
    // ffmpeg per still costs ~0.6 s to spawn on Windows: measure them side by side
    const td = Date.now(); await Promise.all(frames.map(async f => { f.detail = await detailOf(f.file); })); ms.detail = Date.now() - td;
    o.log?.(`review frames: ${Object.entries(ms).map(([k, v]) => `${k} ${(v / 1000).toFixed(1)} s`).join(' · ')}`);
    return { frames, error: null };
  } finally { await b.close(); }
}
