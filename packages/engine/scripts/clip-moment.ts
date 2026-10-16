/**
 * Clip Moment from the terminal: plain lines (or a planned script JSON) → the live-playable edit (plate + EDL), and with
 * --out an MP4 captured through the edit player's own draw path (window.__render(t), frame by frame) plus a 1 fps sheet.
 *   npx tsx scripts/clip-moment.ts --lines lines.txt --brand BUCKOLOGY --dir data/clip-moment/bus --out bus.mp4
 */
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { config } from '../src/config';
import { EDIT } from '../src/edit/lib';
import { PAGE } from '../src/edit/page';
import { servePlayer } from '../src/s4/player';
import { makeClipMoment } from '../src/edit/templates/clip-moment-run';
import type { CmScript } from '../src/edit/templates/clip-moment';

const arg = (k: string) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : undefined; };
const dir = arg('dir') ?? join(config.data, 'clip-moment', String(Date.now()));
const brand = arg('brand');
const lines = arg('lines') ? readFileSync(arg('lines')!, 'utf8').split('\n').map(s => s.trim()).filter(Boolean) : undefined;
const script = arg('script') ? (JSON.parse(readFileSync(arg('script')!, 'utf8')) as CmScript) : undefined;
const out = arg('out');

const r = await makeClipMoment({ dir, ...(brand ? { brand } : {}), ...(lines ? { lines } : {}), ...(script ? { script } : {}), ...(arg('voice') ? { voice: arg('voice')! } : {}), log: s => console.log(s) });
for (const w of r.why) console.log('plan:', w);
console.log('clips:', r.clips.map(c => `${c.beat}:${c.ref} ${c.licence}`).join(', '), '| rejected:', r.rejected.length, '| graph:', r.graph);

if (out) {
  const t0 = Date.now(), e = r.edl, D = EDIT.timeline(e).duration, fps = 30, n = Math.round(D * fps);
  const ff = spawn(config.ffmpeg, ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-', '-i', join(dir, 'master.m4a'),
    '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-shortest', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  let closed = false;
  const done = new Promise<number>(res => ff.on('close', c => { closed = true; res(c ?? 1); }));
  ff.stdin.on('error', () => { closed = true; });
  const srv = await servePlayer(dir, 0, PAGE);
  const b = await chromium.launch({ headless: true, ...(config.chrome.path ? { executablePath: config.chrome.path } : { channel: config.chrome.channel }), args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    const page = await b.newPage({ viewport: { width: e.output.w, height: e.output.h } });
    page.on('pageerror', x => console.log('pageerror:', String(x)));
    await page.goto(srv.url + (srv.url.includes('?') ? '&' : '?') + 't=0');
    await page.waitForFunction('window.__ready || window.__error', null, { timeout: 60_000 });
    for (let k = 0; k < n && !closed; k++) {
      await page.evaluate(`window.__render(${(k / fps).toFixed(4)})`);
      const jpg = await page.screenshot({ type: 'jpeg', quality: 90 });
      if (!ff.stdin.write(jpg)) await new Promise(res => { ff.stdin.once('drain', res); ff.once('close', res); });
    }
  } finally { ff.stdin.end(); await b.close(); srv.close(); }
  const code = await done;
  if (code) throw new Error(`ffmpeg exited ${code}`);
  r.timings.render = Math.round((Date.now() - t0) / 100) / 10;
  const sheet = out.replace(/\.mp4$/, '-sheet.jpg');
  await new Promise(res => spawn(config.ffmpeg, ['-v', 'error', '-y', '-i', out, '-vf', 'fps=1,scale=270:-1,tile=6x6', '-frames:v', '1', '-q:v', '3', sheet], { stdio: 'inherit' }).on('close', res));
  console.log(JSON.stringify({ out, sheet, frames: n, duration: D }));
}
writeFileSync(join(dir, 'timings.json'), JSON.stringify(r.timings, null, 1));
console.log('timings:', JSON.stringify(r.timings));
if (process.argv.includes('--clean')) rmSync(join(dir, 'voice'), { recursive: true, force: true });
process.exit(0);
