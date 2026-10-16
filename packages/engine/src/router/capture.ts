import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Browser, type Page } from 'playwright-core';
import { config } from '../config';
import { sh } from '../bench';

/**
 * Frames from one of Ishaan's live players (Dark Vox, Anatomy, Editorial, Clear Signal). Each player draws any moment
 * on demand through window.__render(t) (the hook its contact sheet uses), so a segment is taken without touching the
 * player's look. Two ways, both measured on a 4 CPU box:
 *
 *  exact     every frame asked for by number and screenshotted, on several pages at once (deterministic; the default).
 *            Chrome runs with --disable-gpu: these players are DOM/SVG/CSS, and software compositing is 3 to 5 times
 *            faster than SwiftShader GL for them (Anatomy 147 vs 452 ms/frame, Dark Vox 266 vs 1240) with the same pixels.
 *  recorder  the player plays in real time (its clock driven from performance.now()) while the page's own screencast
 *            records it; frames are then resampled to 30 fps by their timestamps. As fast as the film is long, but
 *            frames drop when the box is busy. MOOVI_CAPTURE=recorder.
 */
let browser: Promise<Browser> | null = null;
const gl = () => process.env.MOOVI_CAPTURE_GL === '1';
const launch = () => (browser ??= chromium.launch({ headless: true, ...(config.chrome.path ? { executablePath: config.chrome.path } : { channel: config.chrome.channel }), args: ['--no-sandbox', '--disable-dev-shm-usage', ...(gl() ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--disable-gpu'])] }));
export async function closeCapture() { if (browser) { const b = await browser; browser = null; await b.close().catch(() => undefined); } }

export type CaptureMode = 'exact' | 'recorder';
export const captureMode = (): CaptureMode => (process.env.MOOVI_CAPTURE === 'recorder' ? 'recorder' : 'exact');
export interface CaptureStats { mode: CaptureMode; frames: number; ms: number; msPerFrame: number; pages: number; unique?: number; duplicated?: number }

async function open(b: Browser, url: string, from: number): Promise<{ page: Page; close: () => Promise<void> }> {
  const ctx = await b.newContext({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(`${url}?t=${from}`, { timeout: 60_000 });
  await page.waitForFunction('window.__ready || window.__error', null, { timeout: 60_000 });
  const err = await page.evaluate('window.__error'); if (err) { await ctx.close(); throw new Error(`player error: ${String(err).slice(0, 200)}`); }
  return { page, close: () => ctx.close().catch(() => undefined) };
}

/** Frames [from, to) seconds of the player at `url` into an H.264 mp4 at 1080x1920, 30 fps, no audio. */
export async function capturePlayer(url: string, out: string, o: { from?: number; to: number; fps?: number; pages?: number; quality?: number; mode?: CaptureMode }): Promise<CaptureStats> {
  const mode = o.mode ?? captureMode();
  return mode === 'recorder' ? recordPlayer(url, out, o) : exactPlayer(url, out, o);
}

async function exactPlayer(url: string, out: string, o: { from?: number; to: number; fps?: number; pages?: number; quality?: number }): Promise<CaptureStats> {
  const fps = o.fps ?? 30, from = o.from ?? 0, n = Math.max(1, Math.round((o.to - from) * fps)), pages = Math.max(1, Math.min(o.pages ?? 2, n));
  const dir = `${out}.frames`; rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
  const t0 = Date.now(), b = await launch();
  await Promise.all(Array.from({ length: pages }, async (_, w) => {
    const { page, close } = await open(b, url, from);
    try {
      const a = Math.floor((w * n) / pages), z = Math.floor(((w + 1) * n) / pages);
      for (let f = a; f < z; f++) {
        await page.evaluate(`window.__render(${(from + f / fps).toFixed(4)})`);
        writeFileSync(join(dir, `f${String(f).padStart(5, '0')}.jpg`), await page.screenshot({ type: 'jpeg', quality: o.quality ?? 90 }));
      }
    } finally { await close(); }
  }));
  await encodeFrames(dir, out, fps);
  rmSync(dir, { recursive: true, force: true });
  const ms = Date.now() - t0;
  return { mode: 'exact', frames: n, ms, msPerFrame: +(ms / n).toFixed(1), pages };
}

async function recordPlayer(url: string, out: string, o: { from?: number; to: number; fps?: number; quality?: number }): Promise<CaptureStats> {
  const fps = o.fps ?? 30, from = o.from ?? 0, secs = o.to - from, n = Math.max(1, Math.round(secs * fps));
  const dir = `${out}.frames`; rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
  const t0 = Date.now(), b = await launch();
  const { page, close } = await open(b, url, from);
  const got: { ts: number; data: string }[] = [];
  try {
    const cdp = await page.context().newCDPSession(page);
    cdp.on('Page.screencastFrame', (e: { metadata: { timestamp?: number }; data: string; sessionId: number }) => { got.push({ ts: e.metadata.timestamp ?? Date.now() / 1000, data: e.data }); void cdp.send('Page.screencastFrameAck', { sessionId: e.sessionId }).catch(() => undefined); });
    await page.evaluate(`window.__render(${from})`);
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: o.quality ?? 90, everyNthFrame: 1 });
    // the player's clock is the wall clock from here; the page records the epoch it started at
    const epoch = await page.evaluate(`new Promise(res => { const s = performance.now(), wall = Date.now(); const loop = () => { const t = (performance.now() - s) / 1000; window.__render(${from} + Math.min(t, ${secs})); if (t < ${secs} + 0.1) requestAnimationFrame(loop); else res(wall); }; requestAnimationFrame(loop); })`) as number;
    await cdp.send('Page.stopScreencast');
    // resample: output frame k shows the newest captured frame at or before epoch + k/fps
    const start = epoch / 1000; let j = 0, unique = 0, last = -1;
    for (let k = 0; k < n; k++) {
      const at = start + k / fps + 0.5 / fps;
      while (j + 1 < got.length && got[j + 1]!.ts <= at) j++;
      if (j !== last) { unique++; last = j; }
      writeFileSync(join(dir, `f${String(k).padStart(5, '0')}.jpg`), Buffer.from(got[j]!.data, 'base64'));
    }
    await encodeFrames(dir, out, fps);
    rmSync(dir, { recursive: true, force: true });
    const ms = Date.now() - t0;
    return { mode: 'recorder', frames: n, ms, msPerFrame: +(ms / n).toFixed(1), pages: 1, unique, duplicated: n - unique };
  } finally { await close(); }
}

/** A numbered JPEG sequence into the film's intermediate format (H.264 high, yuv420p, every 15th frame a keyframe). */
export async function encodeFrames(dir: string, out: string, fps = 30) {
  await sh(config.ffmpeg, ['-v', 'error', '-y', '-framerate', String(fps), '-i', join(dir, 'f%05d.jpg'), '-vf', 'scale=1080:1920:flags=lanczos,format=yuv420p', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '16', '-g', '15', out], { timeout: 300_000 });
}
