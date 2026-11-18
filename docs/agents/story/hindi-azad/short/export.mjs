// export.mjs: the Short as a 1080x1920 MP4, rendered on the GPU from short.html (WebGL + overlay composited per frame).
//   node export.mjs [fps=30] [tabs=3] [from=0] [to=end]   then   bash mux.sh
// The film is split into `tabs` equal time ranges; each tab seeks frame by frame and pipes JPEGs into its own ffmpeg
// segment (out/seg-<i>.mp4). mux.sh joins them, adds audio/voice.mp3 when it exists, and runs the black/length gates.
import { createRequire } from 'node:module';
import { spawn, execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW || 'C:/Ishaan GPT/hackthons/moovi/node_modules/.pnpm/playwright-core@1.56.1/node_modules/playwright-core');
const here = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => (process.argv.find(a => a.startsWith(k + '=')) || '').split('=')[1] || d;
const FPS = +arg('fps', 30), TABS = +arg('tabs', 3);
global.window = {}; eval(readFileSync(join(here, 'timing.js'), 'utf8'));
// the picture runs to the end of the sound: audio/mix.wav when present (its music tail), else the timing duration
let AUD = 0; for (const f of ['mix.wav', 'voice.mp3']) { try { AUD = +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', join(here, 'audio', f)]).toString().trim(); break; } catch (x) {} }
const DUR = Math.max(window.TIMING.duration, AUD || 0), FROM = +arg('from', 0), TO = +arg('to', DUR);
const OUT = join(here, 'out'); mkdirSync(OUT, { recursive: true });
const TAG = arg('tag', '');   // tag=<x>: render an extra range as out/seg-<x><i>.mp4 without clearing the others
if (!TAG) readdirSync(OUT).filter(f => /^seg-\d+\.mp4$/.test(f)).forEach(f => unlinkSync(join(OUT, f)));
const F0 = Math.round(FROM * FPS), F1 = Math.round(TO * FPS), per = Math.ceil((F1 - F0) / TABS);
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] });
const T0 = Date.now();
async function part(i) {
  const a = F0 + i * per, b = Math.min(F1, a + per); if (b <= a) return null;
  const p = await (await browser.newContext({ viewport: { width: 600, height: 1000 } })).newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await p.goto(pathToFileURL(join(here, 'short.html')).href + '?embed=1', { waitUntil: 'load', timeout: 300000 });
  await p.waitForFunction(() => window.__ready === true, null, { timeout: 300000 });
  const seg = join(OUT, `seg-${TAG}${i}.mp4`);
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(FPS), seg], { stdio: ['pipe', 'ignore', 'inherit'] });
  for (let f = a; f < b; f++) { const b64 = await p.evaluate(t => window.frameB64(t), f / FPS);
    if (!ff.stdin.write(Buffer.from(b64, 'base64'))) await new Promise(r => ff.stdin.once('drain', r));
    if ((f - a) % 150 === 0) console.log(`part ${i}: frame ${f - a}/${b - a} (${((Date.now() - T0) / 1000).toFixed(0)} s)`); }
  ff.stdin.end(); await new Promise(r => ff.on('close', r));
  console.log(`part ${i}: ${b - a} frames done${errs.length ? ' errors: ' + errs.join(' | ') : ''}`);
  return seg;
}
const segs = (await Promise.all(Array.from({ length: TABS }, (_, i) => part(i)))).filter(Boolean);
await browser.close();
if (!TAG) writeFileSync(join(OUT, 'segs.txt'), segs.map(s => `file '${s.replace(/\\/g, '/')}'`).join('\n'));
console.log('segments', segs.length, 'wall', ((Date.now() - T0) / 1000).toFixed(0), 's; now run: bash mux.sh');
