/**
 * Premium caption gallery and stills (caption mastery). Builds docs/galleries/captions-premium.html: Premium Caption 1
 * (variations 1.1 and 1.2) playing on the Ishaan test clip, in the accent taken from the video or any accent picked,
 * painted by the same draw.ts the MP4 path uses, with Style 1's typing tick per word.
 *
 *   tsx scripts/caption-premium.ts                                          build the gallery
 *   tsx scripts/caption-premium.ts still <1.1|1.2|2|3> <t> <out.png> [ref.png] [accent|video]   one frame
 *   tsx scripts/caption-premium.ts serve [port]                             the gallery on localhost (byte ranges)
 *
 * The person matte and face box (Caption 3) run on MediaPipe from this repo, never a CDN: the runtime is the npm
 * package @mediapipe/tasks-vision (engine dependency), the two models are in packages/engine/assets/vision, Montserrat
 * is in assets/renderer/fonts. OFFLINE=1 aborts every request that is not to the local server (the server proof).
 */
import { readFileSync, writeFileSync, existsSync, statSync, createReadStream } from 'node:fs';
import { createServer } from 'node:http';
import { resolve, dirname, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { chromium } from 'playwright-core';
import { config } from '../src/config';
import { PREMIUM_PRESETS } from '../../library/src/captions/premium/presets';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const dir = resolve(root, 'packages/library/src/captions/premium');
const out = resolve(root, 'docs/galleries/captions-premium.html');
const WORDS = resolve(root, 'docs/galleries/captions-premium.words.json');
const LOCAL_FONTS = ['Montserrat'];

function js(file: string): string {
  const src = readFileSync(resolve(dir, file), 'utf8');
  const code = ts.transpileModule(src, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  return code.replace(/^import .*$/gm, '').replace(/^export /gm, '');
}

function build(): string {
  // the clip's own words (Whisper, from the edit round); kept beside the gallery so it opens without data/
  const words = JSON.parse(readFileSync(WORDS, 'utf8')) as { text: string; t: number; end: number }[];
  // fonts bundled in the repo are served locally (the same Google family, as a Fontsource variable woff2)
  const families = [...new Set(PREMIUM_PRESETS.flatMap(p => p.fonts))].filter(f => !LOCAL_FONTS.some(l => f.startsWith(l))).map(f => 'family=' + f).join('&');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Premium captions</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${families}&display=block">
<style>
@font-face{font-family:'Montserrat';font-style:normal;font-weight:100 900;font-display:block;src:url(../../packages/engine/assets/renderer/fonts/montserrat-latin-wght-normal.woff2) format('woff2')}
:root{--bg:#0B0D10;--ink:#F7FAFD;--dim:#8A96A3;--line:#1F2630;--ice:#CFE6F7}
body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.4 system-ui,sans-serif}
main{max-width:1100px;margin:0 auto;padding:24px 16px}
h1{font-size:18px;font-weight:600;margin:0 0 4px}p{color:var(--dim);margin:0 0 16px}
nav{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
nav button{background:none;border:1px solid var(--line);color:var(--ink);padding:6px 12px;border-radius:999px;cursor:pointer}
nav button[aria-pressed=true]{border-color:var(--ice);color:var(--ice)}
.stage{position:relative;width:100%;aspect-ratio:848/478;background:#000;border-radius:8px;overflow:hidden}
#grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:12px;margin-top:20px}
#grid figure{margin:0}#grid canvas{width:100%;aspect-ratio:848/478;display:block;border-radius:6px;background:#000}
#grid figcaption{color:var(--dim);font-size:13px;padding:6px 2px}h2{font-size:15px;font-weight:600;margin:28px 0 0}
.stage video,.stage canvas{position:absolute;inset:0;width:100%;height:100%}.stage canvas{pointer-events:none}
#still{display:none}
</style></head><body><main>
<h1>Premium Caption 1</h1><p>Two variations, one built-in look. The key line takes its colour from the video (or any accent), painted live by the code the MP4 uses.</p>
<nav id="nav"></nav>
<nav id="acc"><button id="fromVideo">Accent from video</button><input id="pick" type="color" aria-label="Accent"></nav>
<div class="stage" id="stage"><video id="v" src="../agents/ishaan-test/ishaan-test.mp4" playsinline loop controls></video><canvas id="c"></canvas></div>
<h2>Every preset at once (the same clip, in sync)</h2><div id="grid"></div>
<canvas id="still"></canvas>
</main><script type="module">
${js('theme.ts')}
${js('presets.ts')}
${js('draw.ts')}
const WORDS = ${JSON.stringify(words)};
const v = document.getElementById('v'), c = document.getElementById('c'), ctx = c.getContext('2d');
// ?clip=<url>: the same captions over another clip (a reference, to compare like for like)
const clipQ = new URLSearchParams(location.search).get('clip'); if (clipQ) v.src = clipQ;
const make = (vr, a) => vr === '4' ? premiumCaption4(a) : vr === '3' ? premiumCaption3() : vr === '2' ? premiumCaption2(a) : premiumCaption1(vr, a);
const refAccent = vr => vr === '4' ? REF_ACCENT_4 : vr === '3' ? REF_ACCENT_3 : vr === '2' ? REF_ACCENT_2 : REF_ACCENTS[vr];
let variant = '1.1', accent = REF_ACCENTS['1.1'], preset = make(variant, accent), list = cards(WORDS, preset.maxWords, preset.tailMax);
const nav = document.getElementById('nav'), pick = document.getElementById('pick');
const set = () => { preset = make(variant, accent); list = cards(WORDS, preset.maxWords, preset.tailMax); pick.value = accent.toLowerCase(); };
for (const vr of ['1.1', '1.2', '2', '3', '4']) {
  const b = document.createElement('button'); b.textContent = 'Premium Caption ' + vr; b.setAttribute('aria-pressed', String(vr === variant));
  b.onclick = () => { if ([REF_ACCENTS['1.1'], REF_ACCENTS['1.2'], REF_ACCENT_2, REF_ACCENT_3, REF_ACCENT_4].includes(accent)) accent = refAccent(vr); variant = vr; set(); [...nav.querySelectorAll('.vr')].forEach(x => x.setAttribute('aria-pressed', String(x === b))); };
  b.className = 'vr'; nav.append(b);
}
// the video's own accent: the strongest saturated hue across a few frames
async function videoAccent(at = [2, 6, 10, 14]) {
  const k = document.createElement('canvas'); k.width = 160; k.height = 90; const g = k.getContext('2d', { willReadFrequently: true });
  const back = v.currentTime, all = [];
  for (const t of at) { v.currentTime = t; await new Promise(r => v.addEventListener('seeked', r, { once: true })); g.drawImage(v, 0, 0, 160, 90); all.push(...g.getImageData(0, 0, 160, 90).data); }
  v.currentTime = back;
  return accentFromPixels(new Uint8ClampedArray(all));
}
document.getElementById('fromVideo').onclick = async () => { accent = (await videoAccent()) || accent; set(); };
pick.oninput = () => { accent = pick.value.toUpperCase(); set(); };
const acc = document.getElementById('acc');
for (const [label, a] of [['Ref green', REF_ACCENTS['1.1']], ['Ref red', REF_ACCENTS['1.2']], ['Ref gold', REF_ACCENT_2], ['Ref ice', REF_ACCENT_3], ['Ref red 4', REF_ACCENT_4]]) {
  const b = document.createElement('button'); b.textContent = label; b.onclick = () => { accent = a; set(); }; acc.append(b);
}
set();
const pb = document.createElement('button'); pb.textContent = 'Play / pause'; pb.onclick = () => v.paused ? v.play() : v.pause(); nav.append(pb);
// Style 1 typing: one onset slice of typing.mp3 per word (sfx-style1/map.json: slices onsets, 60 ms, align start)
const ac = new AudioContext(); let buf = null, onsets = [];
fetch('../../packages/engine/assets/sfx-style1/typing.mp3').then(r => r.arrayBuffer()).then(b => ac.decodeAudioData(b)).then(b => {
  buf = b; const d = b.getChannelData(0), hop = Math.round(b.sampleRate * 0.005); let prev = 0, last = -1;
  for (let i = 0; i + hop < d.length; i += hop) { let e = 0; for (let j = i; j < i + hop; j++) e += d[j] * d[j]; e = Math.sqrt(e / hop);
    if (e > 0.05 && e > prev * 2.5 && i / b.sampleRate - last > 0.08) { onsets.push(i / b.sampleRate); last = i / b.sampleRate; } prev = e; }
});
let lastT = 0, tick = 0;
function typeTick() {
  if (!buf || !onsets.length) return; ac.resume();
  const s = ac.createBufferSource(), g = ac.createGain(); s.buffer = buf; s.connect(g); g.connect(ac.destination);
  const at = onsets[tick++ % onsets.length], now = ac.currentTime;
  g.gain.setValueAtTime(0.9, now); g.gain.setValueAtTime(0.9, now + 0.05); g.gain.linearRampToValueAtTime(0, now + 0.06);
  s.start(now, at, 0.06);
}
function sfx() {
  const now = v.currentTime;
  if (!v.paused && now > lastT && now - lastT < 1) for (const w of ticks(list)) if (w > lastT && w <= now) typeTick();
  lastT = now;
}
setInterval(sfx, 15);
// the person matte (MediaPipe selfie segmenter, in the browser): the speaker cut out of each frame, so words of a
// a behind tier sit in depth behind them
// MediaPipe from this repo (no CDN): the npm runtime and the vendored models, as absolute URLs so the worker resolves them too
const repo = p => new URL(p, location.href).href;
const VISION = repo('../../packages/engine/node_modules/@mediapipe/tasks-vision/vision_bundle.mjs');
const WASM = repo('../../packages/engine/node_modules/@mediapipe/tasks-vision/wasm');
const SEG_MODEL = repo('../../packages/engine/assets/vision/selfie_segmenter.tflite');
const FACE_MODEL = repo('../../packages/engine/assets/vision/blaze_face_short_range.tflite');
let seg = null, faceDet = null;
const segReady = (async () => {
  try {
    const m = await import(VISION);
    const fs = await m.FilesetResolver.forVisionTasks(WASM);
    // GPU where there is one, CPU on a headless server
    const segOpts = delegate => ({ baseOptions: { modelAssetPath: SEG_MODEL, delegate }, runningMode: 'VIDEO', outputConfidenceMasks: true, outputCategoryMask: false });
    seg = await m.ImageSegmenter.createFromOptions(fs, segOpts('GPU')).catch(() => m.ImageSegmenter.createFromOptions(fs, segOpts('CPU')));
    const faceOpts = delegate => ({ baseOptions: { modelAssetPath: FACE_MODEL, delegate }, runningMode: 'VIDEO' });
    faceDet = await m.FaceDetector.createFromOptions(fs, faceOpts('GPU')).catch(() => m.FaceDetector.createFromOptions(fs, faceOpts('CPU')));
    window.faceState = () => ({ ready: !!faceDet, box: faceBox });
  } catch (e) { console.warn('person matte unavailable', e); }
})();
window.visionState = () => ({ matte: !!seg, face: !!faceDet, box: faceBox });
const maskC = document.createElement('canvas'), personC = document.createElement('canvas'), segIn = document.createElement('canvas');
// during playback the matte runs in a worker on a small copy of the frame, so the frame loop never waits on the model;
// the renderer composites the latest mask (stills segment their exact frame on the page, synchronously)
const workerSrc = [
  "let seg = null;",
  "self.onmessage = async e => {",
  "  if (e.data.init) {",
  "    const m = await import(e.data.vision);",
  "    const fs = await m.FilesetResolver.forVisionTasks(e.data.wasm);",
  "    const opts = d => ({ baseOptions: { modelAssetPath: e.data.model, delegate: d }, runningMode: 'VIDEO', outputConfidenceMasks: true, outputCategoryMask: false });",
  "    seg = await m.ImageSegmenter.createFromOptions(fs, opts('CPU'));",
  "    self.postMessage({ ready: true }); return;",
  "  }",
  "  let r; try { r = seg.segmentForVideo(e.data.bmp, e.data.ts); } catch (err) { self.postMessage({ error: String(err) }); return; } finally { e.data.bmp.close(); }",
  "  const mk = r.confidenceMasks[0], a = mk.getAsFloat32Array(), out = new Uint8ClampedArray(a.length * 4);",
  "  for (let i = 0; i < a.length; i++) out[i * 4 + 3] = Math.max(0, Math.min(255, (a[i] - 0.18) * 2.6 * 255));",
  "  self.postMessage({ w: mk.width, h: mk.height, data: out }, [out.buffer]); if (r.close) r.close();",
  "};",
].join(String.fromCharCode(10));
const matteWorker = new Worker(URL.createObjectURL(new Blob([workerSrc], { type: 'text/javascript' }))); // classic: MediaPipe's loader uses importScripts
let wReady = false, wBusy = false, wClock = 0, wSent = -1, wError = '', maskReady = false;
matteWorker.onerror = e => { wError = String(e.message || e); console.warn('matte worker', e); };
window.matteState = () => ({ wReady, wBusy, wError, maskReady });
matteWorker.onmessage = e => {
  if (e.data.ready) { wReady = true; return; }
  if (e.data.error) { wBusy = false; wError = e.data.error; return; }
  wBusy = false;
  maskC.width = e.data.w; maskC.height = e.data.h;
  maskC.getContext('2d').putImageData(new ImageData(e.data.data, e.data.w, e.data.h), 0, 0);
  maskReady = true;
};
matteWorker.postMessage({ init: true, vision: VISION, wasm: WASM, model: SEG_MODEL });
function pumpMatte() {
  if (!wReady || wBusy || v.readyState < 2 || v.currentTime === wSent) return;
  wSent = v.currentTime; wBusy = true;
  segIn.width = 256; segIn.height = Math.round(256 * v.videoHeight / v.videoWidth);
  segIn.getContext('2d').drawImage(v, 0, 0, segIn.width, segIn.height);
  createImageBitmap(segIn).then(bmp => matteWorker.postMessage({ bmp, ts: wClock = Math.max(wClock + 1, performance.now()) }, [bmp]));
}
let lastSegT = -1, segClock = 0;
function personAt(W, H, sync) {
  if (v.readyState < 2) return null;
  // until the worker's first mask arrives, segment on the page: a highlight is never drawn over the speaker
  if (!sync) { pumpMatte(); if (!maskReady) sync = true; }
  if (sync && !seg) return null;
  if (sync && v.currentTime !== lastSegT) {
    lastSegT = v.currentTime;
    // segment a small copy of the frame (256 px wide): the mask is soft anyway, and a full-size read-back cost ~60 ms
    segIn.width = 256; segIn.height = Math.round(256 * v.videoHeight / v.videoWidth); segIn.getContext('2d').drawImage(v, 0, 0, segIn.width, segIn.height);
    const r = seg.segmentForVideo(segIn, segClock = Math.max(segClock + 1, performance.now()));
    const mk = r.confidenceMasks[0], a = mk.getAsFloat32Array();
    maskC.width = mk.width; maskC.height = mk.height;
    const mc = maskC.getContext('2d'), id = mc.createImageData(mk.width, mk.height);
    for (let i = 0; i < a.length; i++) id.data[i * 4 + 3] = Math.max(0, Math.min(255, (a[i] - 0.18) * 2.6 * 255));
    mc.putImageData(id, 0, 0); r.close?.();
  }
  if (personC.width !== W || personC.height !== H) { personC.width = W; personC.height = H; }
  const pc = personC.getContext('2d');
  pc.globalCompositeOperation = 'copy'; pc.drawImage(v, 0, 0, W, H);
  pc.globalCompositeOperation = 'destination-in'; pc.imageSmoothingQuality = 'high'; // the small soft mask scaled up: smooth edges, no blur pass
  pc.drawImage(maskC, 0, 0, W, H);
  pc.globalCompositeOperation = 'source-over';
  return personC;
}
const needsPerson = p => p.tiers.some(t => t && t.behind);
// the face box (MediaPipe face detector), grown to take in hair and chin: a stack card never covers it
let lastFaceT = -1, faceClock = 0, faceBox = null;
function faceAt() {
  if (!faceDet || v.readyState < 2) return faceBox;
  // the face box only steers where a card starts, so it is read a few times a second, not every frame
  if (Math.abs(v.currentTime - lastFaceT) > 0.4) {
    lastFaceT = v.currentTime;
    const d = faceDet.detectForVideo(v, faceClock = Math.max(faceClock + 1, performance.now())).detections[0];
    if (d) { const b = d.boundingBox, vw = v.videoWidth, vh = v.videoHeight; faceBox = { x: (b.originX - b.width * 0.15) / vw, y: (b.originY - b.height * 0.35) / vh, w: b.width * 1.3 / vw, h: b.height * 1.6 / vh }; }
  }
  return faceBox;
}
const sceneAt = (p, W, H, sync = false) => ({ face: p.layout === 'stack' || p.layout === 'poster' ? faceAt() : null, person: needsPerson(p) ? personAt(W, H, sync) : null });
// every preset at once, each on its own canvas from the same playing video, so all of them can be seen and read
const grid = document.getElementById('grid');
const cells = ['1.1', '1.2', '2', '3', '4'].map(vr => {
  const fig = document.createElement('figure'), cv = document.createElement('canvas'), cap = document.createElement('figcaption');
  cap.textContent = 'Premium Caption ' + vr; fig.append(cv, cap); grid.append(fig);
  const p = make(vr, refAccent(vr));
  return { vr, cv, g: cv.getContext('2d'), p, l: cards(WORDS, p.maxWords, p.tailMax) };
});
function drawGrid(t) {
  if (navigator.webdriver) return; // stills and measurements drive the page headless: the grid is for people
  if (v.readyState < 2) return;
  const face = faceAt(), person = personAt(c.width, c.height, false);
  for (const cell of cells) {
    const rr = cell.cv.getBoundingClientRect(), d = devicePixelRatio || 1;
    if (!rr.width) continue;
    if (cell.cv.width !== Math.round(rr.width * d)) { cell.cv.width = Math.round(rr.width * d); cell.cv.height = Math.round(rr.height * d); }
    cell.g.drawImage(v, 0, 0, cell.cv.width, cell.cv.height);
    drawCaption(cell.g, cell.p, cell.l, t, cell.cv.width, cell.cv.height, { face: cell.p.layout === 'stack' || cell.p.layout === 'poster' ? face : null, person: needsPerson(cell.p) ? person : null });
  }
}
function frame() {
  const r = c.getBoundingClientRect(), d = devicePixelRatio || 1;
  if (c.width !== Math.round(r.width * d)) { c.width = Math.round(r.width * d); c.height = Math.round(r.height * d); }
  // the video is painted into the caption canvas, so blend modes (the difference face) see its pixels
  if (v.readyState >= 2) ctx.drawImage(v, 0, 0, c.width, c.height); else ctx.clearRect(0, 0, c.width, c.height);
  const t0 = performance.now(), sc = sceneAt(preset, c.width, c.height), t1 = performance.now();
  drawCaption(ctx, preset, list, v.currentTime, c.width, c.height, sc);
  const t2 = performance.now(); const pf = (window.capProf ??= { scene: 0, draw: 0, n: 0 }); pf.scene += t1 - t0; pf.draw += t2 - t1; pf.n++;
  drawGrid(v.currentTime);
  requestAnimationFrame(frame);
}
Promise.all(PREMIUM_PRESETS.flatMap(p => p.tiers.filter(Boolean).map(t => document.fonts.load((t.italic ? 'italic ' : '') + t.weight + ' ' + (t.stretch || 'normal') + ' 40px "' + t.font + '"')))).finally(() => requestAnimationFrame(frame));
// still: the frame at t (video + caption) at 2x, beside the reference when one is given
window.still = async (vr, t, refUrl, acc) => {
  const a = acc === 'video' ? (await videoAccent()) || refAccent(vr) : acc || refAccent(vr);
  const p = make(vr, a); const l = cards(WORDS, p.maxWords, p.tailMax);
  await Promise.all(p.tiers.filter(Boolean).map(t => document.fonts.load((t.italic ? 'italic ' : '') + t.weight + ' ' + (t.stretch || 'normal') + ' 40px "' + t.font + '"')));
  v.currentTime = t; await new Promise(r => v.addEventListener('seeked', r, { once: true }));
  const W = 1696, H = 956, f = document.createElement('canvas'); f.width = W; f.height = H;
  await segReady;
  const g = f.getContext('2d'); g.drawImage(v, 0, 0, W, H); drawCaption(g, p, l, t, W, H, sceneAt(p, W, H, true));
  const s = document.getElementById('still'); s.style.display = 'block';
  if (!refUrl) { s.width = W; s.height = H; s.getContext('2d').drawImage(f, 0, 0); return; }
  const ref = new Image(); ref.src = refUrl; await ref.decode();
  const h = 600, rw = Math.round(ref.width * h / ref.height), sh = Math.round(W * ref.height / ref.width);
  s.width = rw * 2 + 24; s.height = h; const k = s.getContext('2d'); k.fillStyle = '#0B0D10'; k.fillRect(0, 0, s.width, h);
  k.drawImage(ref, 0, 0, rw, h);
  k.drawImage(f, 0, H - sh, W, sh, rw + 24, 0, rw, h);
};
</script></body></html>`;
  return html;
}

// the repo root over http with byte ranges (video seeks; MediaPipe fetches its wasm and models, which file:// refuses)
const MIME: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.wasm': 'application/wasm', '.tflite': 'application/octet-stream', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.png': 'image/png', '.jpg': 'image/jpeg' };
// a still may also read one file outside the repo (a reference, a clip) through /@fs/<absolute path>
function serve(port = 0, extra: string[] = []): Promise<number> {
  const srv = createServer((req, res) => {
    const p = decodeURIComponent(new URL(req.url!, 'http://x').pathname);
    const file = p.startsWith('/@fs/') && extra.includes(p.slice(5)) ? p.slice(5) : resolve(root, '.' + p);
    if (!(file.startsWith(root + sep) || extra.includes(file)) || !existsSync(file) || !statSync(file).isFile()) { res.writeHead(404).end(); return; }
    const size = statSync(file).size, type = MIME[extname(file).toLowerCase()] ?? 'application/octet-stream';
    const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? '');
    if (!m) { res.writeHead(200, { 'content-type': type, 'content-length': size, 'accept-ranges': 'bytes' }); createReadStream(file).pipe(res); return; }
    const a = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2])), z = m[1] && m[2] ? Math.min(size - 1, Number(m[2])) : size - 1;
    res.writeHead(206, { 'content-type': type, 'content-length': z - a + 1, 'content-range': `bytes ${a}-${z}/${size}`, 'accept-ranges': 'bytes' });
    createReadStream(file, { start: a, end: z }).pipe(res);
  });
  return new Promise(ok => srv.listen(port, '127.0.0.1', () => ok((srv.address() as { port: number }).port)));
}

const [cmd, id, t, png, ref, accent] = process.argv.slice(2);
writeFileSync(out, build());
console.log('gallery', out);
if (cmd === 'serve') {
  const port = await serve(Number(id) || 4310);
  console.log(`http://127.0.0.1:${port}/docs/galleries/captions-premium.html`);
}
if (cmd === 'still') {
  const outside = [process.env.CLIP, ref].filter((f): f is string => !!f && existsSync(f)).map(f => resolve(f)).filter(f => !f.startsWith(root + sep));
  const port = await serve(0, outside), origin = `http://127.0.0.1:${port}`;
  const url = (f: string) => outside.includes(resolve(f)) ? origin + '/@fs/' + encodeURIComponent(resolve(f)) : origin + '/' + resolve(f).slice(root.length + 1).split(sep).map(encodeURIComponent).join('/');
  const b = await chromium.launch({ headless: true, ...(config.chrome.path ? { executablePath: config.chrome.path } : { channel: config.chrome.channel }) });
  const page = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const blocked: string[] = [];
  if (process.env.OFFLINE === '1') await page.context().route('**/*', r => r.request().url().startsWith(origin + '/') ? r.continue() : (blocked.push(r.request().url()), r.abort()));
  page.on('console', m => { if (m.type() === 'warning' || m.type() === 'error') console.log('page', m.type(), m.text()); });
  await page.goto(url(out) + (process.env.CLIP ? '?clip=' + encodeURIComponent(url(process.env.CLIP)) : ''));
  await page.evaluate(([i, tt, r, a]) => (window as unknown as { still: (a: string, b: number, c?: string, d?: string) => Promise<void> }).still(i!, Number(tt), r || undefined, a || undefined),
    [id, t, ref && existsSync(ref) ? url(ref) : '', accent ?? ''] as const);
  await page.locator('#still').screenshot({ path: resolve(png!) });
  const vs = await page.evaluate(() => (window as unknown as { visionState: () => { matte: boolean; face: boolean; box: unknown } }).visionState());
  await b.close();
  console.log('still', png, '| matte', vs.matte, '| face', vs.face, JSON.stringify(vs.box));
  if (blocked.length) console.log('blocked (OFFLINE=1):', [...new Set(blocked.map(u => new URL(u).host))].join(', '));
  // Caption 3 places its highlight behind the speaker and its cards off the face: without either it is not Caption 3
  if (id === '3' && !(vs.matte && vs.face)) { console.error('Caption 3 needs the person matte and the face detector'); process.exit(1); }
  process.exit(0);
}
