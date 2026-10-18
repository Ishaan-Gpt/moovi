// The hook (Ishaan, 2026-10-18), 1920×1080, motion graphics only (the drawn person in H1 is a stand-in for his clip):
//  0.00–1.90   "Building a SaaS is dead…"  H1, the kill (type on, gun, negative, shards, the red burst)
//  1.90–2.40   "…in 2026"                 the pinned calendar note, half a second
//  2.40–4.60   "…if you can't get it seen" the reel's red walker: a hunched figure pulled back to tiny, words round him, SEEN typed big
//  4.60–14.0   the rest of the hook in R4's motion-graphics grammar (red paper table, sticker drops, boiling marker
//              words, flipbook numbers, a word in a design-tool selection box, the no-stamp, hand labels)
import { clamp, lerp, prog, E as E2, mk } from '../d1/cast.js'; // E, rand, noise, spring and R4's pieces come from the classic kit scripts
const W = 1920, H = 1080;
const SEG = { h1: [0, 1.9], cal: [1.9, 2.4], seen: [2.4, 4.6], r4: [4.6, 14.0] }, END = 14.0;

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

/* ───────── "…if you can't get it seen": the red walker (the reel's 2.9–4.2 s, rebuilt at 16:9) ───────── */
const INK = '#0d0d0d', REDW = '#c4131c';
function walker(t, x, y, s) { // a hunched man in a suit walking right, tie streaming back
  const ph = t * 7.5, sw = Math.sin(ph), sw2 = Math.sin(ph + Math.PI);
  g.save(); g.translate(x, y); g.scale(s, s); g.fillStyle = INK; g.strokeStyle = INK; g.lineCap = 'round'; g.lineJoin = 'round';
  const hip = [0, -230], neck = [70, -470];
  const leg = p => { const kx = hip[0] + 30 * p, fx = hip[0] + 110 * p, fy = -Math.max(0, -p) * 25; g.lineWidth = 46; g.beginPath(); g.moveTo(hip[0], hip[1]); g.lineTo(kx + 10, -120); g.lineTo(fx, fy - 10); g.stroke(); g.beginPath(); g.ellipse(fx + 22, fy - 6, 34, 14, 0, 0, 7); g.fill(); };
  leg(sw2);
  g.beginPath(); g.moveTo(hip[0] - 40, hip[1] + 10); g.bezierCurveTo(-60, -380, 0, -470, neck[0] - 10, neck[1] + 20); g.lineTo(neck[0] + 40, neck[1] + 40); g.bezierCurveTo(60, -380, 50, -300, hip[0] + 40, hip[1] + 20); g.closePath(); g.fill();
  g.beginPath(); g.ellipse(neck[0] + 46, neck[1] - 26, 42, 50, 0.5, 0, 7); g.fill();
  const arm = p => { g.lineWidth = 34; g.beginPath(); g.moveTo(neck[0], neck[1] + 40); g.lineTo(neck[0] + 20 + p * 40, -300); g.lineTo(neck[0] + 30 + p * 70, -200); g.stroke(); };
  arm(-sw); leg(sw); arm(sw * 0.8);
  g.lineWidth = 12; g.beginPath(); g.moveTo(neck[0] + 30, neck[1] + 30); for (let i = 1; i <= 6; i++) { const u = i / 6; g.lineTo(neck[0] + 30 - u * 160, neck[1] + 30 + u * 20 + Math.sin(ph * 1.6 - u * 4) * 14 * u); } g.stroke();
  g.restore();
  g.save(); g.globalAlpha = 0.3; g.fillStyle = '#3a0003'; g.beginPath(); g.ellipse(x - 60 * s, y + 4 * s, 260 * s, 26 * s, -0.08, 0, 7); g.fill(); g.restore();
}
// the cluster (the reference: heavy rounded sans, tilted, overlapping, each word bigger than the last as he shrinks)
const CLUSTER = [ // [word, at, x, y, px, rot]
  ['if', 0.12, 0.505, 0.47, 44, -0.08], ['you', 0.32, 0.47, 0.42, 78, -0.06], ["can't", 0.55, 0.56, 0.33, 120, -0.07], ['get it', 0.82, 0.33, 0.24, 150, -0.06],
];
function clusterWord(w, at, t, x, y, px, rot) {
  const k = E.out(prog(t, at, 0.2)); if (k <= 0) return;
  g.save(); g.translate(x, y); g.rotate(rot); g.font = `800 ${px}px "Poppins", sans-serif`; g.textAlign = 'center'; g.fillStyle = INK;
  if (k < 1) { g.filter = `blur(${(1 - k) * 12}px)`; for (let i = 1; i < 4; i++) { g.globalAlpha = 0.16 * (1 - k); g.fillText(w, -i * 40 * (1 - k), 0); } } // a motion smear as it lands
  g.globalAlpha = k; g.fillText(w, (1 - k) * -30, 0); g.restore();
}
function seen(t) {
  g.fillStyle = REDW; g.fillRect(0, 0, W, H);
  const v = g.createRadialGradient(W / 2, H * 0.5, H * 0.3, W / 2, H * 0.5, H); v.addColorStop(0, 'rgba(255,60,60,0.08)'); v.addColorStop(1, 'rgba(60,0,0,0.3)'); g.fillStyle = v; g.fillRect(0, 0, W, H);
  const pull = E.out(prog(t, 0, 0.6)), s = 1.55 * Math.pow(0.16 / 1.55, pull), x = lerp(W * 0.4, W * 0.55, pull) + t * 14, y = lerp(H * 1.12, H * 0.58, pull);
  if (t < 0.55) { const p0 = E.out(prog(t - 0.03, 0, 0.6)); g.save(); g.globalAlpha = 0.3; walker(t, lerp(W * 0.4, W * 0.55, p0) - 40, lerp(H * 1.12, H * 0.58, p0), 1.55 * Math.pow(0.16 / 1.55, p0)); g.restore(); }
  walker(t, x, y, s);
  CLUSTER.forEach(([w, at, cx, cy, px, rot]) => clusterWord(w, at, t, W * cx, H * cy, px, rot));
  // SEEN, typed huge at the bottom; the newest letter lands dark and blurred, as the reference's "SHORT"
  const L = 'SEEN'; g.save(); g.font = `400 330px "Anton", sans-serif`; g.textAlign = 'left'; let lx = W * 0.3;
  for (let i = 0; i < L.length; i++) { const at = 1.15 + i * 0.13, k = E.out(prog(t, at, 0.16)), cw = g.measureText(L[i]).width; if (k > 0) { g.save(); g.fillStyle = k < 1 ? '#5a060b' : INK; g.globalAlpha = 0.4 + 0.6 * k; g.filter = k < 1 ? `blur(${(1 - k) * 6}px)` : 'none'; g.fillText(L[i], lx, H * 0.985 - (1 - k) * 30); g.restore(); } lx += cw; }
  g.restore();
  g.save(); g.font = `500 15px "Inter Tight", sans-serif`; g.fillStyle = 'rgba(30,0,0,0.75)'; g.fillText('Moovi · Graph Hacks 2026', 70, 52); g.fillText('Your video production team.', 70, 72); g.font = `800 22px "Inter Tight", sans-serif`; g.textAlign = 'right'; g.fillStyle = INK; g.fillText('moovi', W - 60, H - 40); g.restore();
}
const SEEN_CUES = [[0.0, 'fs.whoosh.swosh-whoosh-air-cut.wav', 0.45], ...CLUSTER.map(c => [c[1], 'fs.ui.pop-4.wav', 0.3]), ...[0, 1, 2, 3].map(i => [1.15 + i * 0.13, 'kenney.click.wav', 0.4]), [1.6, 'fs.impact.soft-hit.wav', 0.55]];

/* ───────── the rest of the hook in R4's motion graphics (its own functions, drawn landscape) ───────── */
let TABLE = null;
function table() { // the red paper table at 16:9: fibre grain, a warm light top-left, darker edges
  const c = mk(Math.round(W * 1.1), Math.round(H * 1.1)), x = c.getContext('2d'); x.fillStyle = '#c4262c'; x.fillRect(0, 0, c.width, c.height);
  const d = x.getImageData(0, 0, c.width, c.height), px = d.data; for (let i = 0, k = 0; i < px.length; i += 4, k++) { const v = (rand(k % 99991 + 901) - 0.5) * 22; px[i] += v; px[i + 1] += v * 0.5; px[i + 2] += v * 0.5; } x.putImageData(d, 0, 0);
  const lt = x.createRadialGradient(400, 250, 50, 700, 500, 1700); lt.addColorStop(0, 'rgba(255,170,150,0.22)'); lt.addColorStop(1, 'rgba(60,0,0,0.5)'); x.fillStyle = lt; x.fillRect(0, 0, c.width, c.height); return c;
}
function redTable16(t) { if (!TABLE) TABLE = table(); const z = 1.0 + 0.02 * Math.sin(t * 0.25); g.drawImage(TABLE, W / 2 - TABLE.width * z / 2 + noise(t * 0.2, 91) * 10, H / 2 - TABLE.height * z / 2, TABLE.width * z, TABLE.height * z); }
function paper16() { g.fillStyle = '#f7f6f2'; g.fillRect(0, 0, W, H); const v = g.createRadialGradient(W / 2, H / 2, 300, W / 2, H / 2, 1200); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.08)'); g.fillStyle = v; g.fillRect(0, 0, W, H); }
const C4 = { // the beats on their own clock from 4.6 s (the spoken lines are the script's)
  commodity: [0, 2.0],   // "The product is a commodity now."
  twenty: [2.0, 3.8],    // "Building it is twenty percent."
  eighty: [3.8, 5.6],    // "Getting it seen is the other eighty."
  content: [5.6, 7.3],   // "And getting seen means content."
  founders: [7.3, 9.4],  // "Most founders can't make it. Or just don't want to."
};
function carry(t) {
  ctx = g; g.save();
  if (t < C4.twenty[0]) { // identical app stickers drop in a grid (a commodity), the marker word boils in over them
    redTable16(t);
    for (let i = 0; i < 8; i++) { const col = i % 4, row = Math.floor(i / 4); sticker(t, 0.05 + i * 0.09, 420 + col * 360, 330 + row * 380, 260, 260, (rand(i) - 0.5) * 0.25, ART.app, { from: i % 2 ? 900 : -900 }); }
    scribbleText(t, 'COMMODITY', { at: 0.95, out: 2.2, x: 960, y: 640, px: 230, maxW: 1500, rot: -0.06, sx: 0.9 });
  } else if (t < C4.eighty[0]) { // building it: a flipbook 20%
    const lt = t - C4.twenty[0]; redTable16(lt + 2);
    flipNumber(lt, 0.15, 20, 760, 760, 620, 'PERCENT');
    handLabel(lt, 'building it', 0.55, 1350, 420, 90, '#fff');
    boxWord(lt, '%', 0.35, { font: `400 300px "Archivo Black"`, px: 300, x: 1220, y: 720, s0: 0.6, dur: 0.4, fill: '#fff', boxCol: '#fff' });
  } else if (t < C4.content[0]) { // getting it seen: the 80, the 20 shrinking away left
    const lt = t - C4.eighty[0]; redTable16(lt);
    g.save(); g.globalAlpha = 1 - E.in(prog(lt, 0, 0.4)); flipNumber(9, 0, 20, lerp(760, 300, E.ramp(prog(lt, 0, 0.4))), 760, lerp(620, 260, E.ramp(prog(lt, 0, 0.4))), ''); g.restore();
    flipNumber(lt, 0.2, 80, 980, 800, 680, 'PERCENT');
    scribbleText(lt, 'getting it seen', { at: 0.75, out: 1.9, x: 1500, y: 330, px: 110, font: 'Gochi Hand', rot: -0.08, maxW: 700 });
  } else if (t < C4.founders[0]) { // content: a word in a design-tool selection box, dragged to size
    const lt = t - C4.content[0]; paper16();
    boxWord(lt, 'CONTENT', 0.1, { font: `400 250px "Archivo Black"`, px: 250, x: 960, y: 700, s0: 0.45, dur: 0.55, boxOff: 1.25 });
    handLabel(lt, '= getting seen', 0.7, 1300, 860, 84, '#c4262c');
  } else { // most founders can't make it (a film sticker, stamped NO), or just don't want to (the marker boils)
    const lt = t - C4.founders[0]; redTable16(lt);
    sticker(lt, 0.05, 700, 540, 520, 380, -0.08, ART.film);
    handLabel(lt, 'most founders', 0.3, 700, 830, 70);
    noStamp(lt, 0.75, 700, 520, 190);
    scribbleText(lt, "DON'T WANT TO", { at: 1.2, out: 2.3, x: 1350, y: 430, px: 150, rot: -0.07, maxW: 820 });
  }
  g.restore();
}
const CARRY_CUES = [
  ...[...Array(8)].map((_, i) => [0.05 + i * 0.09 + 0.36, 'fs.impact.soft-hit.wav', 0.22]), [0.75, 'typing.mp3', 0.3],
  [C4.twenty[0] + 0.15, 'ui-animations.mp3', 0.25], [C4.twenty[0] + 0.35, 'fs.ui.mouse-2-button-fast-click.wav', 0.4], [C4.twenty[0] + 0.55, 'kenney.click.wav', 0.3],
  [C4.eighty[0], 'woosh-short.wav', 0.35], [C4.eighty[0] + 0.2, 'ui-animations.mp3', 0.3], [C4.eighty[0] + 0.55, 'typing.mp3', 0.25],
  [C4.content[0] + 0.1, 'fs.ui.mouse-2-button-fast-click.wav', 0.45], [C4.content[0] + 0.7, 'kenney.click.wav', 0.3],
  [C4.founders[0], 'woosh-short.wav', 0.3], [C4.founders[0] + 0.41, 'fs.impact.soft-hit.wav', 0.4], [C4.founders[0] + 0.75, 'fs.impact.punch2.wav', 0.6], [C4.founders[0] + 1.0, 'typing.mp3', 0.25],
];

/* ───────── the frame ───────── */
function frame(t) {
  g.setTransform(1, 0, 0, 1, 0, 0); g.filter = 'none'; g.globalAlpha = 1;
  if (t < SEG.cal[0]) { H1.frame(t); g.drawImage(window.H1_CANVAS, 0, 0); }
  else if (t < SEG.seen[0]) cal(t - SEG.cal[0]);
  else if (t < SEG.r4[0]) seen(t - SEG.seen[0]);
  else carry(t - SEG.r4[0]);
}
const SFX = '/packages/engine/assets/sfx-style1/';
const CUES = [
  ...H1.CUES.filter(c => c[0] < SEG.cal[0]),
  [SEG.cal[0], 'fs.whoosh.swosh-whoosh-air-cut.wav', 0.3], [SEG.cal[0] + SLAM, 'fs.impact.soft-hit.wav', 0.75], [SEG.cal[0] + SLAM + 0.01, 'fs.impact.punch2.wav', 0.4],
  ...SEEN_CUES.map(([a, f, v]) => [a + SEG.seen[0], f, v]), ...CARRY_CUES.map(([a, f, v]) => [a + SEG.r4[0], f, v]),
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
window.HOOK = { frame, CUES, END };
await Promise.all([`400 80px "Poppins"`, `800 80px "Poppins"`, `400 80px "Permanent Marker"`, `400 80px "Gochi Hand"`, `300 80px "Barlow Condensed"`, `italic 400 80px InstrumentSerif`, `400 80px "Archivo Black"`, `400 80px "Anton"`, `300 80px "Antonio"`, `800 20px "Inter Tight"`, `italic 400 80px "Times New Roman"`].map(f => document.fonts.load(f)));
loop();
