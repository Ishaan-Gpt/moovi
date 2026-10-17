/**
 * Premium caption gallery and stills (caption mastery). Builds docs/galleries/captions-premium.html: Premium Caption 1
 * (variations 1.1 and 1.2) playing on the Ishaan test clip, in the accent taken from the video or any accent picked,
 * painted by the same draw.ts the MP4 path uses, with Style 1's typing tick per word.
 *
 *   tsx scripts/caption-premium.ts                                          build the gallery
 *   tsx scripts/caption-premium.ts still <1.1|1.2> <t> <out.png> [ref.png] [accent|video]   one frame
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';
import { chromium } from 'playwright-core';
import { config } from '../src/config';
import { PREMIUM_PRESETS } from '../../library/src/captions/premium/presets';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const dir = resolve(root, 'packages/library/src/captions/premium');
const out = resolve(root, 'docs/galleries/captions-premium.html');
const WORDS = resolve(root, 'docs/galleries/captions-premium.words.json');

function js(file: string): string {
  const src = readFileSync(resolve(dir, file), 'utf8');
  const code = ts.transpileModule(src, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  return code.replace(/^import .*$/gm, '').replace(/^export /gm, '');
}

function build(): string {
  // the clip's own words (Whisper, from the edit round); kept beside the gallery so it opens without data/
  const words = JSON.parse(readFileSync(WORDS, 'utf8')) as { text: string; t: number; end: number }[];
  const families = [...new Set(PREMIUM_PRESETS.flatMap(p => p.fonts))].map(f => 'family=' + f).join('&');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Premium captions</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${families}&display=block">
<style>
:root{--bg:#0B0D10;--ink:#F7FAFD;--dim:#8A96A3;--line:#1F2630;--ice:#CFE6F7}
body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.4 system-ui,sans-serif}
main{max-width:1100px;margin:0 auto;padding:24px 16px}
h1{font-size:18px;font-weight:600;margin:0 0 4px}p{color:var(--dim);margin:0 0 16px}
nav{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
nav button{background:none;border:1px solid var(--line);color:var(--ink);padding:6px 12px;border-radius:999px;cursor:pointer}
nav button[aria-pressed=true]{border-color:var(--ice);color:var(--ice)}
.stage{position:relative;width:100%;aspect-ratio:848/478;background:#000;border-radius:8px;overflow:hidden}
.stage video,.stage canvas{position:absolute;inset:0;width:100%;height:100%}.stage canvas{pointer-events:none}
#still{display:none}
</style></head><body><main>
<h1>Premium Caption 1</h1><p>Two variations, one built-in look. The key line takes its colour from the video (or any accent), painted live by the code the MP4 uses.</p>
<nav id="nav"></nav>
<nav id="acc"><button id="fromVideo">Accent from video</button><input id="pick" type="color" aria-label="Accent"></nav>
<div class="stage" id="stage"><video id="v" src="../agents/ishaan-test/ishaan-test.mp4" playsinline loop controls></video><canvas id="c"></canvas></div>
<canvas id="still"></canvas>
</main><script type="module">
${js('theme.ts')}
${js('presets.ts')}
${js('draw.ts')}
const WORDS = ${JSON.stringify(words)};
const v = document.getElementById('v'), c = document.getElementById('c'), ctx = c.getContext('2d');
// ?clip=<url>: the same captions over another clip (a reference, to compare like for like)
const clipQ = new URLSearchParams(location.search).get('clip'); if (clipQ) v.src = clipQ;
const make = (vr, a) => vr === '3' ? premiumCaption3() : vr === '2' ? premiumCaption2(a) : premiumCaption1(vr, a);
const refAccent = vr => vr === '3' ? REF_ACCENT_3 : vr === '2' ? REF_ACCENT_2 : REF_ACCENTS[vr];
let variant = '1.1', accent = REF_ACCENTS['1.1'], preset = make(variant, accent), list = cards(WORDS, preset.maxWords, preset.tailMax);
const nav = document.getElementById('nav'), pick = document.getElementById('pick');
const set = () => { preset = make(variant, accent); list = cards(WORDS, preset.maxWords, preset.tailMax); pick.value = accent.toLowerCase(); };
for (const vr of ['1.1', '1.2', '2', '3']) {
  const b = document.createElement('button'); b.textContent = 'Premium Caption ' + vr; b.setAttribute('aria-pressed', String(vr === variant));
  b.onclick = () => { if ([REF_ACCENTS['1.1'], REF_ACCENTS['1.2'], REF_ACCENT_2, REF_ACCENT_3].includes(accent)) accent = refAccent(vr); variant = vr; set(); [...nav.querySelectorAll('.vr')].forEach(x => x.setAttribute('aria-pressed', String(x === b))); };
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
for (const [label, a] of [['Ref green', REF_ACCENTS['1.1']], ['Ref red', REF_ACCENTS['1.2']], ['Ref gold', REF_ACCENT_2], ['Ref ice', REF_ACCENT_3]]) {
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
let seg = null, faceDet = null;
const segReady = (async () => {
  try {
    const m = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs');
    const fs = await m.FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm');
    seg = await m.ImageSegmenter.createFromOptions(fs, { baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite', delegate: 'GPU' }, runningMode: 'VIDEO', outputConfidenceMasks: true, outputCategoryMask: false });
    const faceOpts = delegate => ({ baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite', delegate }, runningMode: 'VIDEO' });
    faceDet = await m.FaceDetector.createFromOptions(fs, faceOpts('GPU')).catch(() => m.FaceDetector.createFromOptions(fs, faceOpts('CPU')));
    window.faceState = () => ({ ready: !!faceDet, box: faceBox });
  } catch (e) { console.warn('person matte unavailable', e); }
})();
const maskC = document.createElement('canvas'), personC = document.createElement('canvas');
let lastSegT = -1, segClock = 0;
function personAt(W, H) {
  if (!seg || v.readyState < 2) return null;
  if (v.currentTime !== lastSegT) {
    lastSegT = v.currentTime;
    const r = seg.segmentForVideo(v, segClock = Math.max(segClock + 1, performance.now()));
    const mk = r.confidenceMasks[0], a = mk.getAsFloat32Array();
    maskC.width = mk.width; maskC.height = mk.height;
    const mc = maskC.getContext('2d'), id = mc.createImageData(mk.width, mk.height);
    for (let i = 0; i < a.length; i++) id.data[i * 4 + 3] = Math.max(0, Math.min(255, (a[i] - 0.35) * 3.3 * 255));
    mc.putImageData(id, 0, 0); r.close?.();
  }
  personC.width = W; personC.height = H;
  const pc = personC.getContext('2d');
  pc.drawImage(v, 0, 0, W, H);
  pc.globalCompositeOperation = 'destination-in'; pc.filter = 'blur(1px)';
  pc.drawImage(maskC, 0, 0, W, H);
  pc.filter = 'none'; pc.globalCompositeOperation = 'source-over';
  return personC;
}
const needsPerson = p => p.tiers.some(t => t && t.behind);
// the face box (MediaPipe face detector), grown to take in hair and chin: a stack card never covers it
let lastFaceT = -1, faceClock = 0, faceBox = null;
function faceAt() {
  if (!faceDet || v.readyState < 2) return faceBox;
  if (v.currentTime !== lastFaceT) {
    lastFaceT = v.currentTime;
    const d = faceDet.detectForVideo(v, faceClock = Math.max(faceClock + 1, performance.now())).detections[0];
    if (d) { const b = d.boundingBox, vw = v.videoWidth, vh = v.videoHeight; faceBox = { x: (b.originX - b.width * 0.15) / vw, y: (b.originY - b.height * 0.35) / vh, w: b.width * 1.3 / vw, h: b.height * 1.6 / vh }; }
  }
  return faceBox;
}
const sceneAt = (p, W, H) => ({ face: p.layout === 'stack' ? faceAt() : null, person: needsPerson(p) ? personAt(W, H) : null });
function frame() {
  const r = c.getBoundingClientRect(), d = devicePixelRatio || 1;
  if (c.width !== Math.round(r.width * d)) { c.width = Math.round(r.width * d); c.height = Math.round(r.height * d); }
  // the video is painted into the caption canvas, so blend modes (the difference face) see its pixels
  if (v.readyState >= 2) ctx.drawImage(v, 0, 0, c.width, c.height); else ctx.clearRect(0, 0, c.width, c.height);
  drawCaption(ctx, preset, list, v.currentTime, c.width, c.height, sceneAt(preset, c.width, c.height));
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
  const g = f.getContext('2d'); g.drawImage(v, 0, 0, W, H); drawCaption(g, p, l, t, W, H, sceneAt(p, W, H));
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

const [cmd, id, t, png, ref, accent] = process.argv.slice(2);
writeFileSync(out, build());
console.log('gallery', out);
if (cmd === 'still') {
  const b = await chromium.launch({ headless: true, args: ['--allow-file-access-from-files'], ...(config.chrome.path ? { executablePath: config.chrome.path } : { channel: config.chrome.channel }) });
  const page = await b.newPage({ viewport: { width: 1400, height: 900 } });
  await page.goto(pathToFileURL(out).href + (process.env.CLIP ? '?clip=' + encodeURIComponent(pathToFileURL(resolve(process.env.CLIP)).href) : ''));
  await page.evaluate(([i, tt, r, a]) => (window as unknown as { still: (a: string, b: number, c?: string, d?: string) => Promise<void> }).still(i!, Number(tt), r || undefined, a || undefined),
    [id, t, ref && existsSync(ref) ? pathToFileURL(resolve(ref)).href : '', accent ?? ''] as const);
  await page.locator('#still').screenshot({ path: resolve(png!) });
  await b.close();
  console.log('still', png);
}
