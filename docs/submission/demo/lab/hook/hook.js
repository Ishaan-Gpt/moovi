// The hook (Ishaan, 2026-10-18): "Building a SaaS is dead in 2026… if you can't get it seen."
//  0.00–1.90  H1, the kill: type on, gun, negative, shards, the red burst on "dead"
//  1.90–2.40  "2026": the pinned calendar note, last page torn, slammed in for half a second
//  2.40–5.20  "if you can't get it seen": D1's words standing in 3D over the sea, the camera flying past them
//  5.20–8.40  D1's card sphere round the boy, every card a real picture from the footage finder
// 1920×1080. The drawn people are stand-ins for Ishaan's own clips.
import { clamp, lerp, prog, E, mk } from '../d1/cast.js';
const W = 1920, H = 1080;
const SEG = { h1: [0, 1.9], cal: [1.9, 2.4], sea: [2.4, 5.2], sph: [5.2, 8.4] }, END = 8.4;
const D1_SEA0 = 6.633, D1_SPH0 = 0; // where each 3D segment starts on D1's own clock

// real pictures: the footage finder's clips for this hook (data/refs/demo-hook/footage) + Moovi's Showreel plates
const load = src => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = src; });
const man = await fetch('/data/refs/demo-hook/footage/footage.json').then(r => r.ok ? r.json() : {}).catch(() => ({}));
const pics = await fetch('/data/demo/refs/hookpics/index.json').then(r => r.json()).catch(() => []);
const posters = pics.map(p => '/data/demo/refs/hookpics/' + p);
const stills = ['blue-bottle-coffee-speci-10', 'blue-bottle-coffee-speci-14', 'a-morning-at-mumbai-s-sa-1', 'why-bees-dance-to-share--21'].map(s => `/data/demo/refs/real/sr-${s}.jpg`);
const imgs = (await Promise.all([...posters, ...stills].map(load))).filter(Boolean);
window.HOOK_CREDITS = Object.values(man).map(e => e.credit);

// the 3D world (D1), embedded at 16:9 with the hook's words and real cards
const glCanvas = document.createElement('canvas'); glCanvas.width = W; glCanvas.height = H;
window.D1_OPTS = { canvas: glCanvas, size: [W, H], noHero: true, real: imgs.map(img => ({ img })), lines: [
  { words: ['If', 'you'], at: [6.75, 6.86], pos: [0.02, 1.2, 0.62], out: 9.8 },
  { words: ["can't", 'get', 'it'], at: [7.35, 7.48, 7.6], pos: [-0.16, 1.18, 1.5], out: 9.8 },
  { words: ['seen.'], at: [8.2], pos: [-0.46, 1.12, 1.95], out: 9.8 },
] };
await import('../d1/d1.js');
const D1 = window.D1;

// the H1 shot (2D)
window.H1_CANVAS = mk(W, H);
await import('../h1/h1.js');
const H1 = window.H1;

const cv = document.getElementById('c'), g = cv.getContext('2d');

/* ───────── "2026": the calendar note, half a second ───────── */
let WALL = null;
function wall() {
  const c = mk(W * 1.3, H * 1.3), w = c.width, h = c.height, x = c.getContext('2d');
  const bg = x.createRadialGradient(w * 0.5, h * 0.5, 50, w * 0.5, h * 0.5, w * 0.62); bg.addColorStop(0, '#a3060f'); bg.addColorStop(0.6, '#6a040a'); bg.addColorStop(1, '#2a0104');
  x.fillStyle = bg; x.fillRect(0, 0, w, h); x.strokeStyle = 'rgba(255,90,90,0.18)'; x.lineWidth = 2;
  for (let i = 0; i < 9; i++) { x.beginPath(); x.moveTo(i * w / 8 + 60, 0); x.lineTo(i * w / 8 + 60, h); x.stroke(); }
  for (let j = 0; j < 5; j++) { x.beginPath(); x.moveTo(0, j * h / 4 + 120); x.lineTo(w, j * h / 4 + 120); x.stroke(); }
  x.font = `400 300px "Archivo Black", "Anton", sans-serif`; x.textAlign = 'center';
  const ghost = (s, gx, gy) => { x.save(); x.fillStyle = 'rgba(190,150,150,0.30)'; x.fillText(s, gx, gy); x.globalCompositeOperation = 'destination-out';
    for (let yy = gy - 300; yy < gy + 20; yy += 9) for (let xx = gx - 330; xx < gx + 330; xx += 9) { x.beginPath(); x.arc(xx + ((yy / 9) % 2) * 4, yy, 2.6, 0, 7); x.fill(); } x.restore(); };
  ghost('12', w * 0.5, h * 0.25); ghost('01', w * 0.5, h * 1.02); ghost('31', w * 0.06, h * 0.62); ghost('14', w * 0.97, h * 0.62);
  return c;
}
function note(x, y, w, rot, year, glow = 0) {
  g.save(); g.translate(x, y); g.rotate(rot); g.shadowColor = 'rgba(30,0,0,0.55)'; g.shadowBlur = 40; g.shadowOffsetY = 20; g.shadowOffsetX = 10;
  g.beginPath(); g.moveTo(-w / 2, -w / 2); g.lineTo(w / 2, -w / 2); g.lineTo(w / 2, w / 2 - 70); g.quadraticCurveTo(w / 2 - 20, w / 2 - 10, w / 2 - 80, w / 2); g.lineTo(-w / 2, w / 2); g.closePath();
  const pg = g.createRadialGradient(-w * 0.1, -w * 0.15, 20, 0, 0, w * 0.85); pg.addColorStop(0, '#ffffff'); pg.addColorStop(0.7, '#e6e6e6'); pg.addColorStop(1, '#bdbdbd'); g.fillStyle = pg; g.fill(); g.shadowColor = 'transparent';
  g.fillStyle = '#cfcfcf'; g.beginPath(); g.moveTo(w / 2, w / 2 - 70); g.quadraticCurveTo(w / 2 - 40, w / 2 - 50, w / 2 - 80, w / 2); g.quadraticCurveTo(w / 2 - 20, w / 2 - 10, w / 2, w / 2 - 70); g.fill();
  if (year) { g.fillStyle = '#0b0b0b'; g.font = `400 ${w * 0.27}px "Archivo Black", "Anton", sans-serif`; g.textAlign = 'center'; g.save(); g.rotate(-0.05); g.fillText(year, 0, w * 0.1); g.restore(); }
  if (glow) { g.globalAlpha = glow; g.fillStyle = '#fff'; g.fillRect(-w / 2, -w / 2, w, w); g.globalAlpha = 1; }
  g.restore();
}
function pin(x, y, press) { g.save(); g.translate(x, y + press * 4); g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = 14; g.shadowOffsetX = 6; g.shadowOffsetY = 8;
  const pg = g.createRadialGradient(-8, -8, 2, 0, 0, 30); pg.addColorStop(0, '#ff6a5a'); pg.addColorStop(0.5, '#d4140f'); pg.addColorStop(1, '#7a0605'); g.fillStyle = pg; g.beginPath(); g.ellipse(0, 0, 30, 26 - press * 3, 0, 0, 7); g.fill(); g.restore(); }
const SLAM = 0.1;
function cal(t) { // the 2025 page rips off in the first 0.1 s, 2026 slams with a punch-in, the wall drifts
  if (!WALL) WALL = wall();
  const slam = t > SLAM ? Math.exp(-(t - SLAM) * 9) : 0, z = 1.04 + 0.03 * t + slam * 0.08;
  g.save(); g.translate(W / 2, H / 2); g.scale(z, z); g.rotate(-0.01); g.translate(-W / 2, -H / 2);
  g.drawImage(WALL, -(WALL.width - W) / 2, -(WALL.height - H) / 2 + lerp(-40, 0, E.out(prog(t, 0, 0.3))));
  const NX = W / 2, NY = H / 2 + 10, NW = 470;
  note(NX - 40, NY + 28, NW, -0.2, null); note(NX, NY, NW, -0.1, '2026', slam * 0.45);
  const a = prog(t, 0, SLAM), l = E.in(a); if (a < 1) for (let s = 0; s < 3; s++) { const q = clamp(l - s * 0.08); g.save(); g.globalAlpha = s ? 0.25 : 1; g.translate(NX - q * 900, NY - q * 520); g.rotate(-q * 1.6); note(0, 0, NW, -0.1, '2025'); g.restore(); }
  pin(NX - 10, NY - NW / 2 + 52, slam); g.restore();
  const v = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.55)'); g.fillStyle = v; g.fillRect(0, 0, W, H);
}

/* ───────── the frame ───────── */
function frame(t) {
  g.setTransform(1, 0, 0, 1, 0, 0); g.filter = 'none'; g.globalAlpha = 1;
  if (t < SEG.cal[0]) { H1.frame(t); g.drawImage(window.H1_CANVAS, 0, 0); }
  else if (t < SEG.sea[0]) cal(t - SEG.cal[0]);
  else if (t < SEG.sph[0]) { D1.render(D1_SEA0 + (t - SEG.sea[0])); g.drawImage(glCanvas, 0, 0); }
  else { D1.render(D1_SPH0 + (t - SEG.sph[0])); g.drawImage(glCanvas, 0, 0); }
}
const SFX = '/packages/engine/assets/sfx-style1/';
const CUES = [
  ...H1.CUES.filter(c => c[0] < SEG.cal[0]),
  [SEG.cal[0], 'fs.whoosh.swosh-whoosh-air-cut.wav', 0.3], [SEG.cal[0] + SLAM, 'fs.impact.soft-hit.wav', 0.75], [SEG.cal[0] + SLAM + 0.01, 'fs.impact.punch2.wav', 0.4],
  [SEG.sea[0], 'woosh-short.wav', 0.35],
  [SEG.sph[0] + 0.04, 'woosh-tight.wav', 0.5], [SEG.sph[0] + 0.22, 'fs.impact.punch2.wav', 0.55],
];
let AC, BUF = {}, fired = new Set(), t0 = 0, playing = false, held = 0;
async function ensureAudio() { if (AC) return; AC = new AudioContext(); await Promise.all([...new Set(CUES.map(c => c[1]))].map(async f => { BUF[f] = await AC.decodeAudioData(await (await fetch(SFX + f)).arrayBuffer()); })); }
const rate = () => +document.getElementById('rate').value, now = () => playing ? (performance.now() - t0) / 1000 * rate() : held;
const seek = document.getElementById('seek'), tl = document.getElementById('t'), btn = document.getElementById('play');
seek.max = END;
btn.onclick = async () => { await ensureAudio(); AC.resume(); if (playing) { held = now(); playing = false; btn.textContent = 'Play'; return; } if (held >= END - 0.02) held = 0; t0 = performance.now() - held * 1000 / rate(); fired = new Set(CUES.map((c, i) => c[0] < held - 0.02 ? i : -1)); playing = true; btn.textContent = 'Pause'; };
seek.oninput = () => { playing = false; btn.textContent = 'Play'; held = +seek.value; };
function loop() {
  let t = now(); if (playing && t >= END) { playing = false; held = END; btn.textContent = 'Play'; t = END; }
  if (playing) CUES.forEach(([a, f, v], i) => { if (!fired.has(i) && t >= a && t - a < 0.12) { fired.add(i); const s = AC.createBufferSource(), gn = AC.createGain(); s.buffer = BUF[f]; gn.gain.value = v; s.connect(gn).connect(AC.destination); s.start(); } });
  frame(t); seek.value = t; tl.textContent = `${t.toFixed(2)} / ${END}`; requestAnimationFrame(loop);
}
window.HOOK = { frame, CUES, END, imgs: imgs.length };
await Promise.all([`400 80px "Archivo Black"`, `400 80px "Anton"`, `300 80px "Antonio"`, `800 20px "Inter Tight"`, `italic 400 80px "Times New Roman"`].map(f => document.fonts.load(f)));
loop();
