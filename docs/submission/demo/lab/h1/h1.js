// H1 "Dead" (instagram.com/p/DdocrlHOCNB, first 1.45 s, 1440×1080 at 24 fps), copied exactly and rebuilt at 16:9 for
// the hook's first line: "Building a SaaS is dead in 2026…". Measured at 12 and 24 fps:
//  0.00 cut in on the person (cream ground, red key light from frame left)
//  0.08–0.33 the right-hand words type on one by one at eye level, heavy condensed, the last word red
//  0.25–0.60 tall light condensed words wipe down, stacked full height on the left
//  0.50–0.70 a pistol slides in from the right edge, aimed at the temple
//  0.75 FIRE: the person is a black silhouette on grey-white, red glitch slices tear through the head, muzzle flash
//  0.83 one frame in colour negative · 0.875 one frame of black/red shards blasting left
//  0.96 a red comic burst erupts from the head (white scratch lines inside, boiling on twos), the stacked words are
//       blown off tumbling, the gun recoils; hold. Audio: the music dips at 0.85, the bang ~0.95, a hush 1.2–1.4.
// The person is drawn for now (Ishaan's own clip replaces it: same framing, head centre x 0.5, eyes at y 0.42).
import { clamp, lerp, prog, E, rand, noise, mk } from '../d1/cast.js';
const W = 1920, H = 1080, FPS_REF = 24;
const EMBED = !!window.H1_CANVAS, cv = window.H1_CANVAS ?? document.getElementById('c'), g = cv.getContext('2d'); // embedded: the hook page draws this canvas
const T = { words: 0.08, stack: 0.25, gun: 0.5, fire: 0.75, neg: 0.83, shard: 0.875, burst: 0.96, end: 2.6 };
const COPY = { right: ['BUILDING', 'A', 'SAAS', 'IS'], stack: ['DEAD', 'IN', '2026'], tiny: ['Moovi · Graph Hacks 2026', 'Your video production team.'], mark: 'moovi' };
const RED = '#b3121a', CREAM = '#eeeadf', GREYW = '#ecebe8', INK = '#141414';
const COND = '"Antonio", "Oswald", "Bebas Neue", sans-serif', HEAVY = '"Anton", "Oswald", sans-serif';

/* ───────── the person (front, mid shot), as shapes so the silhouette is exact ───────── */
const CX = 960, EYE = 455, S = 1.0; // head centre x, eye line y
function bodyPath() { g.beginPath(); g.moveTo(CX - 70, 600); g.bezierCurveTo(CX - 80, 650, CX - 200, 680, CX - 300, 720); g.bezierCurveTo(CX - 380, 760, CX - 410, 900, CX - 420, 1100); g.lineTo(CX + 420, 1100); g.bezierCurveTo(CX + 410, 900, CX + 380, 760, CX + 300, 720); g.bezierCurveTo(CX + 200, 680, CX + 80, 650, CX + 70, 600); g.closePath(); }
function neckPath() { g.beginPath(); g.moveTo(CX - 62, 540); g.lineTo(CX - 66, 660); g.quadraticCurveTo(CX, 690, CX + 66, 660); g.lineTo(CX + 62, 540); g.closePath(); }
function headPath(t) {
  g.beginPath(); g.ellipse(CX, EYE + 10, 112, 150, 0, 0, 7); // face
  g.moveTo(CX - 118, EYE + 5); g.ellipse(CX - 118, EYE + 18, 18, 36, 0, 0, 7); g.moveTo(CX + 136, EYE + 18); g.ellipse(CX + 118, EYE + 18, 18, 36, 0, 0, 7); // ears
}
function hairPath(t) { // a soft wavy crop, fuller on top, a fringe falling right
  g.beginPath(); const n = 40;
  for (let i = 0; i <= n; i++) { const a = Math.PI * (1.02 + i / n * 0.96), w = 1 + 0.06 * Math.sin(a * 11 + 1.3) + 0.03 * Math.sin(a * 23); const x = CX + Math.cos(a) * 132 * w, y = EYE - 40 + Math.sin(a) * 140 * w; i ? g.lineTo(x, y) : g.moveTo(x, y); }
  g.quadraticCurveTo(CX + 120, EYE - 60, CX + 60, EYE - 78); g.quadraticCurveTo(CX - 10, EYE - 60, CX - 70, EYE - 86); g.quadraticCurveTo(CX - 110, EYE - 60, CX - 126, EYE - 20); g.closePath();
}
function person(t, silhouette) {
  const dx = noise(t * 0.8, 3) * 3, dy = noise(t * 0.6, 7) * 2; g.save(); g.translate(dx, dy); g.translate(CX, EYE); g.scale(1.25, 1.25); g.translate(-CX, -EYE);
  if (silhouette) { g.fillStyle = INK; bodyPath(); g.fill(); neckPath(); g.fill(); headPath(t); g.fill(); hairPath(t); g.fill(); g.restore(); return; }
  // tee: slate, lit red from frame left
  bodyPath(); const tg = g.createLinearGradient(CX - 420, 0, CX + 420, 0); tg.addColorStop(0, '#b4302a'); tg.addColorStop(0.32, '#8a3a36'); tg.addColorStop(0.6, '#47494f'); tg.addColorStop(1, '#2c2e33'); g.fillStyle = tg; g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.22)'; g.lineWidth = 5; g.beginPath(); g.moveTo(CX - 120, 700); g.quadraticCurveTo(CX, 735, CX + 120, 700); g.stroke(); // collar
  // skin: warm, the left side keyed red, the right falling to shadow
  const sk = g.createLinearGradient(CX - 140, 0, CX + 140, 0); sk.addColorStop(0, '#c2392c'); sk.addColorStop(0.42, '#a8584a'); sk.addColorStop(0.7, '#6e4a40'); sk.addColorStop(1, '#3a2a26');
  neckPath(); g.fillStyle = sk; g.fill(); g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(CX - 70, 540, 140, 40);
  headPath(t); g.fillStyle = sk; g.fill();
  // features: brows, glasses, nose shadow, mouth
  g.fillStyle = '#1b1414'; g.beginPath(); g.ellipse(CX - 48, EYE - 34, 34, 7, 0.08, 0, 7); g.ellipse(CX + 48, EYE - 34, 34, 7, -0.08, 0, 7); g.fill();
  g.strokeStyle = '#141010'; g.lineWidth = 9; g.beginPath(); g.roundRect(CX - 98, EYE - 24, 84, 58, 16); g.roundRect(CX + 14, EYE - 24, 84, 58, 16); g.moveTo(CX - 14, EYE - 6); g.quadraticCurveTo(CX, EYE - 14, CX + 14, EYE - 6); g.moveTo(CX - 98, EYE - 10); g.lineTo(CX - 120, EYE - 4); g.moveTo(CX + 98, EYE - 10); g.lineTo(CX + 120, EYE - 4); g.stroke();
  const blink = (t % 2.6) > 2.5 ? 0.15 : 1; g.fillStyle = '#100c0c'; g.beginPath(); g.ellipse(CX - 56, EYE + 6, 9, 7 * blink, 0, 0, 7); g.ellipse(CX + 56, EYE + 6, 9, 7 * blink, 0, 0, 7); g.fill();
  g.fillStyle = 'rgba(40,16,14,0.45)'; g.beginPath(); g.moveTo(CX + 4, EYE + 20); g.quadraticCurveTo(CX + 22, EYE + 70, CX + 4, EYE + 80); g.lineTo(CX - 14, EYE + 78); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(30,12,12,0.7)'; g.lineWidth = 5; g.beginPath(); g.moveTo(CX - 30, EYE + 108); g.quadraticCurveTo(CX, EYE + 114, CX + 30, EYE + 106); g.stroke();
  hairPath(t); g.fillStyle = '#121010'; g.fill();
  g.restore();
}

/* ───────── type ───────── */
function rightWords(t, dark) { // heavy condensed, eye line, one word per ~0.08 s, the last word red
  g.save(); g.font = `400 86px ${HEAVY}`; g.textBaseline = 'alphabetic'; let x = CX + 230;
  COPY.right.forEach((w, i) => { const at = T.words + i * 0.083; if (t >= at) { g.fillStyle = dark ? '#2b2b2b' : (i === COPY.right.length - 1 ? '#c8464a' : RED); g.fillText(w, x, EYE + 30); } x += g.measureText(w + ' ').width; });
  g.restore();
}
function stackWords(t, blown) { // tall light condensed, wiping down; after the burst they tumble away up-left
  g.save(); g.font = `300 260px ${COND}`;
  COPY.stack.forEach((w, i) => {
    const at = T.stack + i * 0.1, k = E.out(prog(t, at, 0.12)); if (k <= 0) return;
    const y0 = 300 + i * 270, bx = 60;
    g.save();
    if (blown) { const b = t - T.burst, r = (i === 0 ? -1.1 : i === 1 ? -0.9 : -0.6), sp = 900 + i * 200; g.translate(bx + 160 - b * sp * (0.6 + i * 0.1), y0 - 100 - b * sp * 0.25 * (1 - i)); g.rotate(r * clamp(b * 6)); g.translate(-160, 100); g.fillStyle = INK; }
    else { g.translate(bx, y0); g.beginPath(); g.rect(-20, -250 + (1 - k) * -10, 900, 260 * k + 10); g.clip(); g.translate(0, (1 - k) * -120); g.fillStyle = RED; }
    g.save(); g.scale(0.82, 1.18); g.fillText(w, 0, 0); g.restore(); g.restore();
  });
  g.restore();
}
function tinyAndMark(dark) {
  g.save(); g.fillStyle = dark ? '#555' : '#4a4640'; g.font = `500 15px "Inter Tight", sans-serif`; g.fillText(COPY.tiny[0], 80, 62); g.fillText(COPY.tiny[1], 80, 82);
  g.font = `800 24px "Inter Tight", sans-serif`; g.fillStyle = INK; g.textAlign = 'right'; g.fillText(COPY.mark, W - 70, H - 46); g.restore();
}

/* ───────── the gun, the shot, the burst ───────── */
function gun(t) {
  if (t < T.gun) return;
  const k = E.out(prog(t, T.gun, 0.2)), recoil = t > T.burst ? Math.exp(-(t - T.burst) * 9) : 0, kick = t > T.fire ? Math.exp(-(t - T.fire) * 12) : 0;
  const x = lerp(W + 260, CX + 410, k) + (kick + recoil) * 40, y = EYE - 20 - (kick * 30 + recoil * 60);
  g.save(); g.translate(x, y); g.rotate(-(kick * 0.25 + recoil * 0.4)); g.fillStyle = INK; g.beginPath(); // a pistol facing left
  g.moveTo(-170, -26); g.lineTo(60, -26); g.lineTo(70, -40); g.lineTo(150, -40); g.lineTo(156, -14); g.lineTo(150, 6); g.lineTo(96, 8); g.lineTo(120, 150); g.lineTo(60, 158); g.lineTo(40, 40); g.lineTo(10, 40);
  g.quadraticCurveTo(-4, 70, -40, 64); g.quadraticCurveTo(-18, 40, -20, 14); g.lineTo(-170, 14); g.closePath(); g.fill();
  g.fillStyle = GREYW; g.beginPath(); g.arc(-2, 30, 14, 0, 7); g.fill();
  if (t > T.fire && t < T.fire + 0.08) { g.fillStyle = RED; g.beginPath(); for (let i = 0; i < 10; i++) { const a = Math.PI + (i - 4.5) * 0.18, r = i % 2 ? 40 : 110; g.lineTo(-170 + Math.cos(a) * r, -6 + Math.sin(a) * r * 0.6); } g.fill(); }
  g.restore();
}
function headSlices(t) { // red glitch strips through the head at the moment of the shot
  const f = Math.floor(t * FPS_REF); g.save(); g.fillStyle = RED;
  for (let i = 0; i < 9; i++) { const y = EYE - 150 + i * 30 + rand(f * 7 + i) * 10, h = 10 + rand(i * 5 + f) * 22, off = (rand(i * 3 + f) - 0.4) * 160; g.fillRect(CX - 130 + off, y, 230 + rand(i + f) * 120, h); }
  g.beginPath(); g.ellipse(CX - 10, EYE, 100, 130, 0, 0, 7); g.fill(); g.restore();
}
function shards(t) { // one frame: black and red blades blasting left out of the head, with white glints
  g.save();
  for (let i = 0; i < 16; i++) { const y = 260 + i * 40 + rand(i) * 20, len = 400 + rand(i * 3) * 900, h = 14 + rand(i * 5) * 40; g.fillStyle = i % 3 === 0 ? RED : INK; g.beginPath(); g.moveTo(CX - 60, y); g.lineTo(CX - 60 - len, y - h * 0.5); g.lineTo(CX - 60 - len * 0.9, y + h); g.closePath(); g.fill(); }
  g.fillStyle = '#fff'; for (let i = 0; i < 8; i++) g.fillRect(200 + rand(i * 9) * 500, 300 + rand(i * 4) * 400, 40 + rand(i) * 70, 8);
  g.restore();
}
function burst(t) { // the comic blast from the head's left side: spikes that grow fast, then boil on twos with scratch lines
  const b = t - T.burst, grow = E.out(clamp(b / 0.16)), boil = Math.floor(t * 12), ox = CX - 60, oy = EYE + 10;
  g.save(); g.fillStyle = '#9c0f17'; g.beginPath();
  const n = 22;
  for (let i = 0; i <= n; i++) {
    const a = Math.PI * (0.55 + i / n * 0.9), spike = i % 2 === 0, r = (spike ? 560 + rand(i * 7) * 480 : 300 + rand(i * 3) * 150) * grow;
    const jit = (rand(i * 11 + boil) - 0.5) * 18; g.lineTo(ox + Math.cos(a) * (r + jit) * 1.25, oy + Math.sin(a) * (r + jit) * 0.95);
  }
  g.lineTo(ox + 40, oy + 40); g.lineTo(ox + 40, oy - 60); g.closePath(); g.fill();
  if (grow > 0.6) { g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 3; // scratch lines inside the blast
    for (let i = 0; i < 14; i++) { const sx = ox - 120 - rand(i * 5) * 520, sy = oy - 200 + rand(i * 9) * 400, a = rand(i * 13 + boil) * 6.28, l = 60 + rand(i * 3) * 120; g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + Math.cos(a) * l, sy + Math.sin(a) * l); g.lineTo(sx + Math.cos(a + 1.2) * l * 0.6, sy + Math.sin(a + 1.2) * l * 0.6); g.stroke(); } }
  g.restore();
}
function corners() { // the striped corner marks of the blast frame
  g.save(); g.fillStyle = '#2a2a2a'; for (let i = 0; i < 5; i++) { g.save(); g.translate(40 + i * 22, 40); g.rotate(-0.7); g.fillRect(0, 0, 10, 90); g.restore(); } g.restore();
}

/* ───────── the frame ───────── */
function frame(t) {
  g.setTransform(1, 0, 0, 1, 0, 0); g.filter = 'none';
  const lit = t < T.fire, push = 1 + 0.03 * E.io(prog(t, 0, T.fire)); // a slow push into the line, then the hard frame holds
  if (lit) {
    g.fillStyle = CREAM; g.fillRect(0, 0, W, H);
    g.save(); g.translate(W / 2, H / 2); g.scale(push, push); g.translate(-W / 2, -H / 2);
    const cutIn = t < 0.08 ? (1 - t / 0.08) * 380 : 0; g.translate(-cutIn, 0); // the cut lands on a whip from the left
    stackWords(t, false); person(t, false); rightWords(t, false); gun(t); g.restore(); tinyAndMark(false);
    return;
  }
  g.fillStyle = GREYW; g.fillRect(0, 0, W, H);
  if (t < T.burst) {
    person(t, true); if (t < T.neg) headSlices(t); gun(t); rightWords(t, true); tinyAndMark(true);
    if (t >= T.shard) shards(t);
    if (t >= T.neg && t < T.shard) { frame(T.fire - 0.01); const c = mk(W, H), cg = c.getContext('2d'); cg.drawImage(cv, 0, 0); g.filter = 'invert(1)'; g.drawImage(c, 0, 0); g.filter = 'none'; } // the lit shot in negative
    return;
  }
  corners(); stackWords(t, true); burst(t); person(t, true); g.fillStyle = GREYW; g.beginPath(); g.ellipse(CX + 40, EYE + 2, 22, 9, -0.2, 0, 7); g.fill(); // the glasses glint left in the silhouette
  gun(t); rightWords(t, true); tinyAndMark(true);
}

/* ───────── sound (the owner's Style 1 files on the reference's moves) ───────── */
const SFX = '/packages/engine/assets/sfx-style1/';
const CUES = [[0.0, 'woosh-tight.wav', 0.4], ...COPY.right.map((_, i) => [T.words + i * 0.083, 'kenney.click.wav', 0.25]), ...COPY.stack.map((_, i) => [T.stack + i * 0.1, 'fs.ui.pop-4.wav', 0.2]),
  [T.gun, 'fs.whoosh.swosh-whoosh-air-cut.wav', 0.35], [T.fire, 'finger-snap-tight.wav', 0.6], [T.burst - 0.01, 'fs.impact.punch2.wav', 0.8], [T.burst, 'fs.impact.soft-hit.wav', 0.6]];
let AC, BUF = {}, fired = new Set(), t0 = 0, playing = false, held = 0;
async function ensureAudio() { if (AC) return; AC = new AudioContext(); await Promise.all([...new Set(CUES.map(c => c[1]))].map(async f => { BUF[f] = await AC.decodeAudioData(await (await fetch(SFX + f)).arrayBuffer()); })); }
const now = () => playing ? (performance.now() - t0) / 1000 * rate() : held;
const rate = () => +document.getElementById('rate').value;
const seek = document.getElementById('seek'), tl = document.getElementById('t'), btn = document.getElementById('play');
if (EMBED) { window.H1 = { frame, T, CUES }; } else {
btn.onclick = async () => { await ensureAudio(); AC.resume(); if (playing) { held = now(); playing = false; btn.textContent = 'Play'; return; } if (held >= T.end - 0.02) held = 0; t0 = performance.now() - held * 1000 / rate(); fired = new Set(CUES.map((c, i) => c[0] < held - 0.02 ? i : -1)); playing = true; btn.textContent = 'Pause'; };
seek.oninput = () => { playing = false; btn.textContent = 'Play'; held = +seek.value; };
function loop() {
  let t = now(); if (playing && t >= T.end) { playing = false; held = T.end; btn.textContent = 'Play'; t = T.end; }
  if (playing && document.getElementById('sfx').checked) CUES.forEach(([a, f, gn], i) => { if (!fired.has(i) && t >= a && t - a < 0.12) { fired.add(i); const s = AC.createBufferSource(), v = AC.createGain(); s.buffer = BUF[f]; v.gain.value = gn; s.connect(v).connect(AC.destination); s.start(); } });
  frame(t); seek.value = t; tl.textContent = `${t.toFixed(2)} / ${T.end}`; requestAnimationFrame(loop);
}
window.H1 = { frame, T, CUES };
Promise.all([`400 80px "Anton"`, `300 80px "Antonio"`, `800 20px "Inter Tight"`].map(f => document.fonts.load(f))).finally(loop);
}
