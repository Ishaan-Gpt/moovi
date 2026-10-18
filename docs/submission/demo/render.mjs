// Render a demo lab page to an MP4 with its sound cues, headless (Chrome via playwright-core).
// Usage: node docs/submission/demo/render.mjs <page path under the repo> <global with frame/CUES/END> <out.mp4> [fps]
// e.g.   node docs/submission/demo/render.mjs docs/submission/demo/lab/hook/ HOOK data/demo/out/hook-v2.mp4 30
// Needs the preview server (serve.mjs) on PORT. Frames are pure functions of t, so the render is exact.
import { chromium } from '../../../node_modules/.pnpm/playwright-core@1.56.1/node_modules/playwright-core/index.mjs';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const [page = 'docs/submission/demo/lab/hook/', glob = 'HOOK', out = 'data/demo/out/hook.mp4', fpsArg = '30'] = process.argv.slice(2);
const PORT = process.env.PORT ?? 4388, FPS = +fpsArg, frames = join(ROOT, 'data/demo/out/.frames');
rmSync(frames, { recursive: true, force: true }); mkdirSync(frames, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const p = await browser.newPage({ viewport: { width: 1920, height: 1200 } });
p.on('pageerror', e => console.error('page error:', e.message));
await p.goto(`http://localhost:${PORT}/${page}`);
await p.waitForFunction(g => !!window[g], glob, { timeout: 120000 });
const { END, CUES, AUDIO } = await p.evaluate(g => ({ END: window[g].END, CUES: window[g].CUES, AUDIO: window[g].AUDIO ?? null }), glob);
const N = Math.round(END * FPS);
const t0 = Date.now();
for (let i = 0; i <= N; i++) {
  const b64 = await p.evaluate(async ([g, t]) => { await window[g].frame(t); return document.getElementById('c').toDataURL('image/jpeg', 0.93).split(',')[1]; }, [glob, i / FPS]);
  writeFileSync(join(frames, `f${String(i).padStart(4, '0')}.jpg`), Buffer.from(b64, 'base64'));
  if (i % 30 === 0) process.stdout.write(`${i}/${N} `);
}
await browser.close();
console.log(`\nframes in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
// sound: every cue placed with adelay, summed, limited
const sfx = join(ROOT, 'packages/engine/assets/sfx-style1');
const args = ['-v', 'error', '-y', '-framerate', String(FPS), '-i', join(frames, 'f%04d.jpg')];
let fc = '', mix = '';
const first = AUDIO ? 2 : 1; if (AUDIO) { args.push('-i', join(ROOT, AUDIO.replace(/^\//, ''))); fc += '[1:a]aresample=48000,aformat=channel_layouts=stereo,volume=1[voice];'; mix += '[voice]'; } // the clip's own voice under the cues
CUES.forEach(([t, f, v], i) => { args.push('-i', join(sfx, f)); const ms = Math.max(0, Math.round(t * 1000)); fc += `[${i + first}:a]aresample=48000,aformat=channel_layouts=stereo,volume=${v},adelay=${ms}|${ms}[a${i}];`; mix += `[a${i}]`; });
fc += `${mix}amix=inputs=${CUES.length + (AUDIO ? 1 : 0)}:normalize=0,apad,atrim=0:${(N / FPS).toFixed(3)},alimiter=limit=0.89[aout]`;
args.push('-filter_complex', fc, '-map', '0:v', '-map', '[aout]', '-c:v', 'libx264', '-crf', '17', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', join(ROOT, out));
execFileSync('ffmpeg', args, { stdio: 'inherit' });
rmSync(frames, { recursive: true, force: true });
console.log('wrote', out);
