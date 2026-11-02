#!/usr/bin/env node
// export.mjs: the shared scene exporter for any code-made film page (three.js / canvas). It re-renders only what changed.
//
//   node docs/agents/speed/export.mjs page=<film>/long.html [audio=<film>/audio/mix.wav] [out=<film>/out/film.mp4]
//        [from=0] [to=<end>] [fps=30] [tabs=auto|1|3] [chunk=6] [preview=1] [force=1] [film=<dir>] [scenes=<scenes.json>]
//        [http=http://localhost:4351 root=docs/agents/story]   (for pages that must be served)
//
// - The page sets window.__ready and exposes window.frameB64(t) (a JPEG) or window.seek(t) plus a #cv canvas (both patterns in the repo).
// - The film is cut into chunks: the entries of scenes.json ([{id, from, to, page?}]) or fixed `chunk`-second pieces (default 10).
//   Each chunk starts with `preroll` seconds (default 1) of unwritten in-order frames, so a cut between chunks never pops. Each chunk is its
//   own MP4 in <out dir>/.chunks/<name>/, then joined with a stream copy and muxed with the audio.
// - A chunk is reused when (1) no source file of its page changed since it was made (free), or (2) its fingerprint, every 5th frame
//   hashed, is unchanged (about 1/5 of the render). Otherwise it renders. An interrupted export resumes from the chunks already on disk.
// - Takes the GPU lease (preflight.mjs gpu take) for its film and frees it at the end. A lease held by another film stops it.
// - Master: libx264 medium crf 18. preview=1: AMD h264_amf (faster, SSIM 0.982 vs 0.997 measured; previews only).
// - Gates after the join: no black frame, picture as long as asked. Writes a row to <film>/TIMINGS.md.
import { createRequire } from 'node:module';
import { spawn, execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, statSync, appendFileSync, unlinkSync } from 'node:fs';
import { join, dirname, resolve, basename, extname, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';

const kv = Object.fromEntries(process.argv.slice(2).filter(a => a.includes('=')).map(a => a.split(/=(.*)/s).slice(0, 2)));
if (!kv.page && !kv.scenes) { console.log(readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 16).join('\n')); process.exit(2); }
const T0 = Date.now(), FPS = +(kv.fps || 30), CH = +(kv.chunk || 10), PRE = +(kv.preroll ?? 1), SAMPLE = 5, PREVIEW = kv.preview === '1';
const scenesFile = kv.scenes && resolve(kv.scenes);
const scenesIn = scenesFile ? JSON.parse(readFileSync(scenesFile, 'utf8')) : null;
const PAGE0 = resolve(kv.page || join(dirname(scenesFile), scenesIn[0].page));
const FILM = resolve(kv.film || dirname(PAGE0));
const OUT = resolve(kv.out || join(FILM, 'out', basename(PAGE0, extname(PAGE0)) + (PREVIEW ? '-preview' : '') + '.mp4'));
const AUDIO = kv.audio ? resolve(kv.audio) : ['audio/mix.wav', 'mix.wav', 'audio/voice.mp3'].map(f => join(FILM, f)).find(existsSync);
const CACHE = join(dirname(OUT), '.chunks', basename(OUT, '.mp4')); mkdirSync(CACHE, { recursive: true });
const MAN = join(CACHE, 'manifest.json'), man = existsSync(MAN) ? JSON.parse(readFileSync(MAN, 'utf8')) : {};
const ENC = PREVIEW ? ['-c:v', 'h264_amf', '-quality', 'quality', '-rc', 'cqp', '-qp_i', '18', '-qp_p', '20'] : ['-c:v', 'libx264', '-preset', 'medium', '-crf', '18'];
const MODE = PREVIEW ? 'amf18' : 'x264crf18';
const log = m => console.log(`[${((Date.now() - T0) / 1000).toFixed(0).padStart(4)} s] ${m}`);

// ---- GPU lease (same file as preflight.mjs) ----
const LOCK = join(tmpdir(), 'moovi-gpu.lock');
const lease = (() => { try { const l = JSON.parse(readFileSync(LOCK, 'utf8')); return Date.now() - Date.parse(l.at) > 4 * 3600e3 ? null : l; } catch { return null; } })();
if (lease && lease.film !== FILM && kv.force_gpu !== '1') { console.log(`BUSY: the GPU is leased to ${lease.film} since ${lease.at}. Queue behind it (or force_gpu=1).`); process.exit(1); }
const hadLease = !!lease;
writeFileSync(LOCK, JSON.stringify({ film: FILM, at: new Date().toISOString(), by: 'export.mjs' }));
const freeLease = () => { if (!hadLease) try { unlinkSync(LOCK); } catch {} };
process.on('exit', freeLease); process.on('SIGINT', () => process.exit(130));

// ---- source hash of a page: the html, every local script/style it loads, and timing/cues next to it ----
const srcCache = {};
function srcHash(page) {
  if (srcCache[page]) return srcCache[page];
  const h = createHash('sha1'), html = readFileSync(page, 'utf8'), dir = dirname(page), seen = new Set();
  const add = f => { if (seen.has(f) || !existsSync(f)) return; seen.add(f); h.update(f + statSync(f).size); h.update(readFileSync(f)); };
  add(page);
  for (const m of html.matchAll(/(?:src|href)=["']([^"':?#]+\.(?:js|mjs|css|json|glsl))/g)) add(resolve(dir, m[1]));
  for (const m of html.matchAll(/(?:import|from)\s*\(?\s*["'](\.{1,2}\/[^"']+)["']/g)) add(resolve(dir, m[1]));
  for (const f of ['timing.js', 'cues.js', 'lines.json', 'clock.json']) add(join(dir, f));
  return (srcCache[page] = h.digest('hex').slice(0, 16));
}

// ---- chunks ----
const pw = (() => { const r = createRequire(resolve('package.json')); try { return r('playwright-core'); } catch { return r(join(process.cwd(), 'node_modules/.pnpm/playwright-core@1.56.1/node_modules/playwright-core')); } })();
const browser = await pw.chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] });
// http=<base url> root=<dir>: pages that must be served (the Stickman pages on tools/serve.cjs 4351) map file path -> url
const HTTP = kv.http, ROOT = resolve(kv.root || 'docs/agents/story');
const url = p => (HTTP ? HTTP.replace(/\/$/, '') + '/' + relative(ROOT, p).split('\\').join('/') : pathToFileURL(p).href) + '?embed=1';
const grab = (p, t) => p.evaluate(t => window.frameB64 ? window.frameB64(t) : (window.seek(t), document.getElementById('cv').toDataURL('image/jpeg', 0.94).slice(23)), t);
async function openPage(page) {
  const p = await (await browser.newContext({ viewport: { width: 1000, height: 600 }, deviceScaleFactor: 2 })).newPage();
  p.on('pageerror', e => log('page error: ' + String(e).slice(0, 160)));
  const r = await p.goto(url(page), { waitUntil: 'load', timeout: 400000 });
  if (r && !r.ok() && r.status() !== 0) throw new Error(`page ${url(page)} answered ${r.status()} (check http= and root=)`);
  await p.waitForFunction(() => window.__ready === true, null, { timeout: 400000 });
  // warm-up: the first frame after load can differ from later renders of the same moment (measured on the Gandhi page), so two throwaway frames
  await grab(p, 0); await grab(p, 0.5);
  p.page = page; return p;
}

let END = +kv.to || 0;
if (!END && !scenesIn) { try { END = +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', AUDIO]).toString(); } catch {} }
if (!END && !scenesIn) { const tj = join(FILM, 'timing.js'); if (existsSync(tj)) { global.window = {}; eval(readFileSync(tj, 'utf8')); END = window.TIMING.duration; } }
if (!END && !scenesIn) { console.log('no end time: pass to=<seconds> or audio=<file>'); process.exit(2); }
const FROM = +(kv.from || 0);
const chunks = [];
if (scenesIn) for (const s of scenesIn) chunks.push({ id: s.id, page: resolve(dirname(scenesFile), s.page || basename(PAGE0)), a: Math.round(s.from * FPS), b: Math.round(s.to * FPS) });
else for (let a = Math.round(FROM * FPS), E = Math.round(END * FPS), i = 0; a < E; a += CH * FPS, i++) chunks.push({ id: 'c' + String(i).padStart(3, '0'), page: PAGE0, a, b: Math.min(E, a + CH * FPS) });
for (const c of chunks) { c.key = `${c.id}_${c.a}_${c.b}_${FPS}_${MODE}_pre${PRE}`; c.file = join(CACHE, c.key + '.mp4'); c.src = srcHash(c.page); }

// stage 1: free reuse (no source change)
const todo = chunks.filter(c => !(man[c.key] && man[c.key].src === c.src && existsSync(c.file)));
const TODO_N = todo.length;
log(`${chunks.length} chunks, ${chunks.length - todo.length} reused (sources unchanged), ${todo.length} to check`);

// tabs: auto = 1 vs 3 on 20 frames of the first chunk to do (the stick page gained nothing from tabs, the Gandhi page 2.2x)
let TABS = kv.tabs && kv.tabs !== 'auto' ? +kv.tabs : 1;
const pool = [];
if (todo.length) {
  pool.push(await openPage(todo[0].page)); log('page loaded');
  const todoFrames = todo.reduce((a, c) => a + c.b - c.a, 0), known = (man.__tabs || {})[todo[0].page];
  if ((!kv.tabs || kv.tabs === 'auto') && known) { TABS = known; while (pool.length < TABS) pool.push(await openPage(todo[0].page)); log(`tabs: ${TABS} (measured on an earlier run)`); }
  else if ((!kv.tabs || kv.tabs === 'auto') && todoFrames < 600) log('tabs: 1 (under 600 frames to render, a tab test would cost more than it saves)');
  else if ((!kv.tabs || kv.tabs === 'auto') && todo.length > 1) {
    const t = async (ps) => { const s = Date.now(); await Promise.all(ps.map(async (p, i) => { for (let f = 0; f < 20; f++) await grab(p, (todo[0].a + i * 20 + f) / FPS); })); return (Date.now() - s) / (20 * ps.length); };
    const one = await t(pool); pool.push(await openPage(todo[0].page), await openPage(todo[0].page)); const three = await t(pool);
    TABS = three < one * 0.85 ? 3 : 1; man.__tabs = { ...(man.__tabs || {}), [todo[0].page]: TABS }; if (TABS === 1) for (const p of pool.splice(1)) await p.context().close();
    log(`tabs: ${Math.round(one)} ms a frame with 1, ${Math.round(three)} with 3 -> ${TABS}`);
  } else while (pool.length < TABS) pool.push(await openPage(todo[0].page));
}

let rendered = 0, sampled = 0, framesRendered = 0, renderMs = 0;
async function work(p) {
  for (let c; (c = todo.shift());) {
    if (p.page !== c.page) { await p.goto(url(c.page), { waitUntil: 'load', timeout: 400000 }); await p.waitForFunction(() => window.__ready === true, null, { timeout: 400000 }); await grab(p, 0); await grab(p, 0.5); p.page = c.page; }
    const prev = man[c.key];
    // pre-roll: these pages keep state from frame to frame (the Gandhi page's slip lands elsewhere on a cold seek); 0.5 s of
    // in-order frames before a chunk made its frames identical to a continuous render (measured), so every chunk starts 1 s early
    const preroll = async () => { for (let f = Math.max(0, c.a - Math.round(PRE * FPS)); f < c.a; f++) await grab(p, f / FPS); };
    if (prev && prev.fp && existsSync(c.file) && kv.force !== '1') {     // stage 2: fingerprint every 5th frame
      await preroll(); const h = createHash('sha1'); for (let f = c.a; f < c.b; f += SAMPLE) h.update(await grab(p, f / FPS)); sampled++;
      if (h.digest('hex') === prev.fp) { man[c.key] = { ...prev, src: c.src }; log(`${c.id} unchanged (fingerprint), reused`); continue; }
    }
    const tmp = c.file + '.part.mp4', s = Date.now(), h = createHash('sha1'); await preroll();
    const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', ...ENC, '-pix_fmt', 'yuv420p', '-r', String(FPS), tmp], { stdio: ['pipe', 'ignore', 'inherit'] });
    for (let f = c.a; f < c.b; f++) {
      const b64 = await grab(p, f / FPS); if ((f - c.a) % SAMPLE === 0) h.update(b64);
      if (!ff.stdin.write(Buffer.from(b64, 'base64'))) await new Promise(r => ff.stdin.once('drain', r));
    }
    ff.stdin.end(); const code = await new Promise(r => ff.on('close', r));
    if (code !== 0) throw new Error(`ffmpeg failed on ${c.id}`);
    renameSync(tmp, c.file); rendered++; framesRendered += c.b - c.a; renderMs += Date.now() - s;
    man[c.key] = { src: c.src, fp: h.digest('hex'), at: new Date().toISOString() };
    writeFileSync(MAN, JSON.stringify(man, null, 1));                    // resume point after every chunk
    log(`${c.id} rendered: ${c.b - c.a} frames, ${Math.round((Date.now() - s) / (c.b - c.a))} ms a frame`);
  }
}
try { await Promise.all(pool.map(work)); } finally { writeFileSync(MAN, JSON.stringify(man, null, 1)); await browser.close(); }

// join + audio + gates
const list = join(CACHE, 'list.txt');
writeFileSync(list, chunks.map(c => `file '${c.file.replace(/\\/g, '/')}'`).join('\n'));
const dur = (chunks.at(-1).b - chunks[0].a) / FPS, start = chunks[0].a / FPS;
mkdirSync(dirname(OUT), { recursive: true });
execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list,
  ...(AUDIO ? ['-ss', String(start), '-t', String(dur), '-i', AUDIO, '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '256k'] : []),
  '-c:v', 'copy', '-t', String(dur), '-movflags', '+faststart', OUT]);
// blackdetect reports on stderr
const { spawnSync } = await import('node:child_process');
const blackLog = spawnSync('ffmpeg', ['-nostdin', '-i', OUT, '-vf', 'blackdetect=d=0.1:pix_th=0.06', '-an', '-f', 'null', '-'], { encoding: 'utf8' }).stderr || '';
const vd = +execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v', '-show_entries', 'stream=duration', '-of', 'default=nw=1:nk=1', OUT]).toString().trim();
const wall = (Date.now() - T0) / 1000;
const res = { out: OUT, chunks: chunks.length, rendered, reusedNoSourceChange: chunks.length - TODO_N, fingerprintChecks: sampled, reusedByFingerprint: TODO_N - rendered,
  framesRendered, msPerFrame: framesRendered ? Math.round(renderMs / framesRendered) : 0, tabs: TABS, wallS: Math.round(wall), picture: vd, wanted: +dur.toFixed(2),
  black: /black_start/.test(blackLog), short: vd < dur - 0.5 };
console.log(JSON.stringify(res));
const tm = join(FILM, 'TIMINGS.md');
if (!existsSync(tm)) writeFileSync(tm, `# TIMINGS: ${basename(FILM)} (estimate before, actual after; machine clock)\n\n| Stage | Estimate | Start | End | Actual | Note |\n|---|---|---|---|---|---|\n`);
const hm = t => new Date(t).toTimeString().slice(0, 5);
appendFileSync(tm, `| Export ${basename(OUT)} (speed/export.mjs${PREVIEW ? ', preview' : ''}) | - | ${hm(T0)} | ${hm(Date.now())} | ${(wall / 60).toFixed(1)} min | ${rendered}/${chunks.length} chunks rendered, ${framesRendered} frames at ${res.msPerFrame} ms, ${TABS} tab(s)${res.black ? ', BLACK FRAMES' : ''}${res.short ? ', SHORT' : ''} |\n`);
if (res.black || res.short) { console.log(res.black ? 'GATE: black frames found' : 'GATE: picture shorter than asked'); process.exit(3); }
