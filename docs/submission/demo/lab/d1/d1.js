// D1 "Card Sky" (instagram.com/p/DdUA650hdvS, 25.3 s, ~117 BPM): rebuilt at 16:9 for the Moovi demo, every part kept
// as a reusable piece. The reference's music-player cards become Moovi's own UI (film players, preset cards, crew
// lines, graph nodes); the people are drawn and animated in code for now (Ishaan sends his own clips later, each
// person sits in one slot: CAST.boy / CAST.girl / CAST.back).
// Parts: D1.1 card storm in 3D around a figure · D1.2 serif words in depth over water · D1.3 dive into a card's art
// (droste) · D1.4 backlit figure, sun bloom, hair in wind · D1.5 pull-out into a frame on a white wall · D1.6 white
// matte flash · D1.7 tall serif words behind the head, then the grade drains to grey.
// Every frame is a pure function of t (ishaan-motion §9): seeded random only.
'use strict';
const W = 1920, H = 1080;
const cv = document.getElementById('c'), out = cv.getContext('2d');
const buf = document.createElement('canvas'); buf.width = W; buf.height = H;
let ctx = buf.getContext('2d');
const video = document.getElementById('v');

/* ───────── core helpers (the canvas port of ishaan-motion's engine) ───────── */
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, k) => a + (b - a) * k;
const prog = (t, t0, d) => clamp((t - t0) / d);
function bez(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const X = s => ((ax * s + bx) * s + cx) * s, Y = s => ((ay * s + by) * s + cy) * s;
  return x => { x = clamp(x); let lo = 0, hi = 1; for (let i = 0; i < 28; i++) { const m = (lo + hi) / 2; X(m) < x ? lo = m : hi = m; } return Y((lo + hi) / 2); };
}
const E = { ramp: bez(0.86, 0, 0.07, 1), hard: bez(0.95, 0, 0.05, 1), out: bez(0.16, 1, 0.3, 1), outBack: bez(0.34, 1.32, 0.64, 1), in: bez(0.7, 0, 0.84, 0), settle: x => 1 - Math.pow(1 - clamp(x), 4) };
const logPull = (S0, k) => Math.pow(S0, Math.pow(1 - clamp(k), 4));
function rand(s) { const x = Math.sin(s * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
function noise(x, s = 0) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(rand(i + s * 57), rand(i + 1 + s * 57), u) * 2 - 1; }
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const SERIF = '"Instrument Serif", Georgia, serif', SANS = '"Inter Tight", system-ui, sans-serif';

/* ───────── the grid: measured onsets of the reference (beat ≈ 0.513 s) ───────── */
const CUT = { water: 6.63, dive: 10.95, sun: 12.4, wall: 16.6, matte: 18.7, dusk: 19.1, words: 20.94, grey: 23.0, end: 25.28 };
const PARTS = [
  [0, CUT.water, 'D1.1 card storm · 3D UI cards around a figure'],
  [CUT.water, CUT.dive, 'D1.2 serif words in depth over water'],
  [CUT.dive, CUT.sun, 'D1.3 dive into the card art (droste)'],
  [CUT.sun, CUT.wall, 'D1.4 backlit figure · sun bloom · hair in wind'],
  [CUT.wall, CUT.matte, 'D1.5 pull-out into a frame on a white wall'],
  [CUT.matte, CUT.dusk, 'D1.6 white matte flash'],
  [CUT.dusk, CUT.end, 'D1.7 tall serif words behind the head → grey'],
];

/* ───────── palette (lab only; the film's palette is Ishaan's pick) ───────── */
const P = {
  ice: '#F7FAFD', iceBlue: '#CFE6F7', // Moovi's mark (@moovi/brand)
  duskTop: '#59626e', duskMid: '#b9a596', duskGlow: '#f2a65a', duskHot: '#ffd27a', duskLow: '#2a2622',
  water: '#1d2b33', waterDeep: '#0e171c', waterLit: '#9fb2bb',
  wine: '#6b1420', ink: '#0f1215', figure: '#14110f',
};

/* ───────── textures, built once ───────── */
const TEX = {};
function cloudsInto(g, w, h, seed, tint, n = 70, yMin = 0, yMax = 0.6) {
  for (let i = 0; i < n; i++) {
    const x = rand(i * 3 + seed) * w, y = lerp(yMin, yMax, Math.pow(rand(i * 3 + 1 + seed), 1.3)) * h, r = 60 + rand(i * 3 + 2 + seed) * 240;
    const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, tint(0.32)); gr.addColorStop(1, tint(0));
    g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, r * 2.4, r * 0.55, 0, 0, 7); g.fill();
  }
}
function buildDusk() { // D1.1 / D1.7 sky: a grey cloud deck over a burning horizon band
  const c = mk(2400, 1350), g = c.getContext('2d');
  const s = g.createLinearGradient(0, 0, 0, 1350);
  s.addColorStop(0, P.duskTop); s.addColorStop(0.42, P.duskMid); s.addColorStop(0.66, P.duskGlow); s.addColorStop(0.73, P.duskHot); s.addColorStop(0.78, '#e2763c'); s.addColorStop(0.86, '#5b3a2c'); s.addColorStop(1, P.duskLow);
  g.fillStyle = s; g.fillRect(0, 0, 2400, 1350);
  g.filter = 'blur(18px)'; cloudsInto(g, 2400, 1350, 11, a => `rgba(70,74,84,${a})`, 90, 0, 0.55); cloudsInto(g, 2400, 1350, 29, a => `rgba(230,190,160,${a * 0.6})`, 40, 0.3, 0.62);
  cloudsInto(g, 2400, 1350, 47, a => `rgba(255,120,60,${a * 0.7})`, 26, 0.68, 0.76); g.filter = 'none';
  TEX.dusk = c;
}
function buildSun() { // D1.4 sky: pale gold, a low sun, a soft grey ceiling
  const c = mk(2400, 1350), g = c.getContext('2d');
  const s = g.createLinearGradient(0, 0, 0, 1350); s.addColorStop(0, '#7d7c78'); s.addColorStop(0.3, '#d9d2b0'); s.addColorStop(0.55, '#fbeeaa'); s.addColorStop(0.8, '#f4e08c'); s.addColorStop(1, '#c9b56e');
  g.fillStyle = s; g.fillRect(0, 0, 2400, 1350);
  g.filter = 'blur(22px)'; cloudsInto(g, 2400, 1350, 5, a => `rgba(110,108,100,${a})`, 60, 0, 0.32); cloudsInto(g, 2400, 1350, 77, a => `rgba(255,250,220,${a * 0.5})`, 30, 0.35, 0.7); g.filter = 'none';
  TEX.sun = c;
}
function buildBlueSky() { // D1.6: a cool, saturated sky behind the white matte
  const c = mk(2200, 1240), g = c.getContext('2d');
  const s = g.createLinearGradient(0, 0, 0, 1240); s.addColorStop(0, '#4f7fb3'); s.addColorStop(0.55, '#a9c6e2'); s.addColorStop(0.62, '#e9eef2'); s.addColorStop(0.7, '#5d86b0'); s.addColorStop(1, '#2d4f78');
  g.fillStyle = s; g.fillRect(0, 0, 2200, 1240); g.filter = 'blur(16px)'; cloudsInto(g, 2200, 1240, 91, a => `rgba(255,255,255,${a})`, 60, 0.05, 0.6); g.filter = 'none';
  TEX.blue = c;
}
function buildWater() { // D1.2: slate water, waves as stacked bright crests and dark troughs, rows tighten toward the horizon
  const c = mk(2600, 1500), g = c.getContext('2d');
  const s = g.createLinearGradient(0, 0, 0, 1500); s.addColorStop(0, '#2e3e47'); s.addColorStop(0.5, P.water); s.addColorStop(1, P.waterDeep);
  g.fillStyle = s; g.fillRect(0, 0, 2600, 1500);
  let y = 0, row = 0;
  while (y < 1500) {
    const gap = 6 + Math.pow(y / 1500, 1.6) * 46; // perspective: rows widen toward the viewer
    for (let i = 0; i < 2600 / (40 + gap * 3); i++) {
      const x = rand(row * 131 + i) * 2600, len = (40 + gap * 6) * (0.5 + rand(row * 7 + i)), th = gap * (0.18 + rand(i + row) * 0.25);
      const lit = rand(row * 3 + i * 5) > 0.55;
      g.fillStyle = lit ? `rgba(170,190,198,${0.10 + rand(i * 9 + row) * 0.22})` : `rgba(5,10,14,${0.25 + rand(i * 11 + row) * 0.3})`;
      g.beginPath(); g.ellipse(x, y + gap * 0.5, len, th, (rand(i * 13 + row) - 0.5) * 0.08, 0, 7); g.fill();
    }
    y += gap; row++;
  }
  TEX.water = c;
}

/* ───────── Moovi UI cards (the reference's music players, made ours) ───────── */
const FILMS = [ // real Moovi films, named as the mastery logs name them
  { t: 'Resend · launch v14', a: 'Launch video', hue: ['#151515', '#3a3a3a', '#f2f2ee'] },
  { t: 'Linear · launch', a: 'Launch video', hue: ['#1b1d3a', '#5e6ad2', '#e8e9ff'] },
  { t: 'Lab vlog · v10', a: 'Edit', hue: ['#2b2117', '#c8955a', '#fff1dd'] },
  { t: 'Blue Bottle · showreel', a: 'Showreel', hue: ['#13324a', '#4c9bd6', '#e8f4ff'] },
  { t: 'moovi · brand film', a: 'Showreel', hue: ['#1c2630', P.iceBlue, P.ice] },
  { t: 'Premium captions 4', a: 'Edit', hue: ['#3b0d12', '#d8323c', '#ffe8e3'] },
];
function rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
function artInto(g, x, y, w, h, f, seed) { // a film's cover: its own hue, a horizon, a figure or a type mark
  const s = g.createLinearGradient(x, y, x + w, y + h); s.addColorStop(0, f.hue[1]); s.addColorStop(1, f.hue[0]);
  g.fillStyle = s; g.fillRect(x, y, w, h);
  g.fillStyle = f.hue[2]; g.globalAlpha = 0.85;
  const k = seed % 3;
  if (k === 0) { g.beginPath(); g.arc(x + w * 0.62, y + h * 0.42, w * 0.16, 0, 7); g.fill(); g.globalAlpha = 0.35; g.fillRect(x, y + h * 0.62, w, h * 0.38); }
  else if (k === 1) { g.font = `italic 400 ${w * 0.34}px ${SERIF}`; g.textAlign = 'center'; g.fillText(f.a.split(' ')[0].toLowerCase(), x + w / 2, y + h * 0.62); }
  else { for (let i = 0; i < 5; i++) { g.globalAlpha = 0.18 + i * 0.12; rr(g, x + w * 0.12, y + h * (0.16 + i * 0.14), w * (0.3 + rand(seed + i) * 0.5), h * 0.07, 6); g.fill(); } }
  g.globalAlpha = 1;
}
function playerCard(f, seed, dark = true) { // 300×470: cover, title, "Moovi", progress, controls
  const c = mk(300, 470), g = c.getContext('2d');
  g.fillStyle = dark ? '#16191c' : P.ice; rr(g, 0, 0, 300, 470, 22); g.fill();
  g.save(); rr(g, 18, 18, 264, 264, 12); g.clip(); artInto(g, 18, 18, 264, 264, f, seed); g.restore();
  const ink = dark ? '#eef2f4' : '#14181b', dim = dark ? 'rgba(238,242,244,0.5)' : 'rgba(20,24,27,0.5)';
  g.fillStyle = ink; g.font = `700 21px ${SANS}`; g.textAlign = 'left'; g.fillText(f.t, 20, 316);
  g.fillStyle = dim; g.font = `500 16px ${SANS}`; g.fillText(`Moovi · ${f.a}`, 20, 340);
  g.fillStyle = dim; rr(g, 20, 368, 260, 5, 3); g.fill(); g.fillStyle = ink; rr(g, 20, 368, 70 + rand(seed) * 150, 5, 3); g.fill();
  g.fillStyle = ink; g.beginPath(); g.arc(150, 420, 24, 0, 7); g.fill();
  g.fillStyle = dark ? '#16191c' : P.ice; g.fillRect(141, 409, 6, 22); g.fillRect(153, 409, 6, 22);
  for (const sx of [-1, 1]) { g.fillStyle = ink; g.beginPath(); g.moveTo(150 + sx * 62, 420); g.lineTo(150 + sx * 48, 410); g.lineTo(150 + sx * 48, 430); g.fill(); g.fillRect(150 + sx * 64 - (sx > 0 ? 0 : 3), 410, 3, 20); }
  g.fillStyle = '#4fd18b'; g.beginPath(); g.arc(266, 316, 9, 0, 7); g.fill();
  return c;
}
function presetCard(name, line) {
  const c = mk(300, 380), g = c.getContext('2d');
  g.fillStyle = P.ice; rr(g, 0, 0, 300, 380, 24); g.fill();
  g.fillStyle = P.iceBlue; rr(g, 18, 18, 264, 200, 14); g.fill();
  g.fillStyle = '#14181b'; g.font = `italic 400 64px ${SERIF}`; g.textAlign = 'left'; g.fillText(name, 26, 290);
  g.fillStyle = 'rgba(20,24,27,0.55)'; g.font = `500 17px ${SANS}`; g.fillText(line, 28, 326);
  g.fillStyle = '#14181b'; rr(g, 28, 340, 84, 24, 12); g.fill(); g.fillStyle = P.ice; g.font = `700 13px ${SANS}`; g.fillText('PRESET', 44, 357);
  return c;
}
function crewCard(agent, line, n) {
  const c = mk(380, 128), g = c.getContext('2d');
  g.fillStyle = 'rgba(22,25,28,0.94)'; rr(g, 0, 0, 380, 128, 20); g.fill();
  g.fillStyle = P.iceBlue; g.beginPath(); g.arc(46, 46, 24, 0, 7); g.fill();
  g.fillStyle = '#14181b'; g.font = `800 20px ${SANS}`; g.textAlign = 'center'; g.fillText(agent[0], 46, 53);
  g.textAlign = 'left'; g.fillStyle = '#eef2f4'; g.font = `700 19px ${SANS}`; g.fillText(agent, 84, 42);
  g.fillStyle = 'rgba(238,242,244,0.55)'; g.font = `500 14px ${SANS}`; g.fillText(`desk ${n} · working`, 84, 62);
  g.fillStyle = '#eef2f4'; g.font = `500 17px ${SANS}`; g.fillText(line, 22, 104);
  return c;
}
function graphCard(seed) {
  const c = mk(340, 260), g = c.getContext('2d');
  g.fillStyle = '#101417'; rr(g, 0, 0, 340, 260, 20); g.fill();
  g.fillStyle = 'rgba(238,242,244,0.55)'; g.font = `600 13px ${SANS}`; g.fillText('FalkorDB · why this edit?', 18, 30);
  const N = [[60, 120, 'Decision'], [170, 80, 'Rule'], [280, 130, 'Feedback'], [150, 200, 'Asset']];
  g.strokeStyle = 'rgba(207,230,247,0.6)'; g.lineWidth = 2;
  [[0, 1], [1, 2], [0, 3]].forEach(([a, b]) => { g.beginPath(); g.moveTo(N[a][0], N[a][1]); g.lineTo(N[b][0], N[b][1]); g.stroke(); });
  N.forEach(([x, y, s], i) => { g.fillStyle = i === 2 ? P.iceBlue : '#2a3238'; g.beginPath(); g.arc(x, y, 15, 0, 7); g.fill(); g.fillStyle = '#eef2f4'; g.font = `600 13px ${SANS}`; g.textAlign = 'center'; g.fillText(s, x, y + 34); });
  return c;
}
const CREW = [['Editor', 'cut 3 retakes, kept take 2'], ['Sound', 'riser lands on the cut'], ['Writer', 'hook: "every cut has a reason"'], ['Lens', 'checked · 0 to fix'], ['Keeper', 'remembered: bigger captions'], ['Designer', 'cast 4 moves from the library'], ['Researcher', 'read the site, 6 proof shots'], ['Moovi', 'picked Launch video']];
function blurred(c, px) { if (!px) return c; const pad = px * 3, o = mk(c.width + pad * 2, c.height + pad * 2), g = o.getContext('2d'); g.filter = `blur(${px}px)`; g.drawImage(c, pad, pad); o.pad = pad; return o; }
function buildCards() {
  const list = [];
  FILMS.forEach((f, i) => { list.push(playerCard(f, i * 7 + 1, true)); list.push(playerCard(f, i * 7 + 4, i % 2 === 0)); });
  list.push(presetCard('Edit', 'Upload, pick the part')); list.push(presetCard('Launch', 'From a site link')); list.push(presetCard('Showreel', 'A brand film, theme-locked'));
  CREW.forEach(([a, l], i) => list.push(crewCard(a, l, i + 1)));
  list.push(graphCard(1)); list.push(graphCard(2));
  TEX.cards = list.map(c => [c, blurred(c, 4), blurred(c, 10)]);
  TEX.hero = playerCard(FILMS[4], 3, false); // the card D1.2 holds and D1.3 dives into
}

/* ───────── the drawn cast (stand-ins for Ishaan's clips) ───────── */
function spline(pts, closed = true) { // Catmull-Rom through points
  const n = pts.length; ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    ctx.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
  }
}
const HEAD = [[-38, -6], [-70, -60], [-96, -138], [-88, -214], [-40, -266], [30, -268], [70, -232], [82, -194], [79, -176], [108, -142], [86, -128], [91, -114], [84, -102], [89, -92], [80, -64], [52, -46], [36, -10]];
function headPath(look) { // profile facing right; look < 0 tilts the chin up, pivoting at the neck
  ctx.save(); ctx.translate(0, -24); ctx.rotate(look); ctx.translate(0, 24);
  ctx.beginPath(); spline(HEAD); ctx.closePath();
  for (let i = 0; i < 9; i++) { const a = lerp(3.5, 5.55, i / 8), r = 104 + (i % 2) * 6; ctx.moveTo(Math.cos(a) * r - 8 + 26, Math.sin(a) * r - 150 + 23); ctx.arc(Math.cos(a) * r - 8, Math.sin(a) * r - 150, 26, 0, 7); }
  ctx.restore();
}
function torsoPath(t) {
  const b = 1 + 0.006 * Math.sin(t * 1.7);
  ctx.beginPath(); spline([[-46, -8], [-60, 30], [-200, 96 * b], [-262, 180], [-290, 700], [250, 700], [232, 170], [176, 92 * b], [44, 30], [40, -8]], true); ctx.closePath();
}
/** CAST.boy: a young man in profile, looking up; rim-lit on the sky side. o = { x, y, s, look, rim, fill, tee } */
function boy(t, o) {
  ctx.save(); ctx.translate(o.x, o.y); ctx.scale(o.s, o.s);
  const look = o.look ?? (-0.12 + 0.05 * Math.sin(t * 0.6) + noise(t * 0.4, 3) * 0.03);
  // torso first (a tee that catches a little sky), then the head over it
  torsoPath(t); const tg = ctx.createLinearGradient(-200, 0, 240, 0); tg.addColorStop(0, o.tee ?? '#3a3532'); tg.addColorStop(1, o.teeLit ?? '#6d635c'); ctx.fillStyle = o.fill ?? tg; ctx.fill();
  if (o.rim) { ctx.save(); torsoPath(t); ctx.clip(); ctx.translate(-7, 0); torsoPath(t); ctx.fillStyle = o.fill ?? (o.tee ?? '#3a3532'); ctx.restore(); }
  headPath(look); ctx.fillStyle = o.fill ?? P.figure; ctx.fill();
  if (o.rim) { // a warm rim along the face: draw the head in light, then the head again nudged back in dark
    ctx.save(); headPath(look); ctx.clip(); ctx.fillStyle = o.rim; ctx.fillRect(-200, -400, 400, 500); ctx.translate(-6, 2); headPath(look); ctx.fillStyle = o.fill ?? P.figure; ctx.fill(); ctx.restore();
  }
  ctx.restore();
}
/** CAST.girl: profile facing left, long hair streaming in the wind, backlit (D1.4) */
function girl(t, o) {
  ctx.save(); ctx.translate(o.x, o.y); ctx.scale(-o.s, o.s); // mirrored: faces left
  const look = -0.05 + noise(t * 0.5, 9) * 0.04;
  torsoPath(t); ctx.fillStyle = '#1b1612'; ctx.fill();
  headPath(look); ctx.fillStyle = '#1b1612'; ctx.fill();
  // hair: a mass behind the head plus strands lifted by gusts (noise in time, phase along the strand)
  ctx.save(); ctx.translate(0, -24); ctx.rotate(look); ctx.translate(0, 24);
  ctx.fillStyle = '#1b1612'; ctx.beginPath(); spline([[-20, -270], [-96, -226], [-120, -120], [-130, 20], [-90, 160], [-40, 120], [-50, -10], [-30, -150]]); ctx.fill();
  // hair in wind: tapered ribbons (filled, not lines) whose spines wave on a travelling sine, lifted by gusts; the
  // outermost few catch the sun as thin gold edges (backlit hair glows at its fringe)
  const gust = 0.5 + 0.5 * noise(t * 0.7, 21);
  const ribbon = (i, lit) => {
    const sy = -238 + i * 17 + rand(i) * 8, len = 210 + rand(i * 3) * 170, wid = lit ? 2.5 : 16 + rand(i * 5) * 14, ph = rand(i * 7) * 6, n = 14, top = [], bot = [];
    for (let k = 0; k <= n; k++) {
      const u = k / n, x = -70 - u * len * (0.55 + gust * 0.55), wave = Math.sin(t * 2.6 - u * 5 + ph) * 22 * u * (0.5 + gust), y = sy + u * u * 150 * (1 - gust * 0.65) + wave, hw = wid * (1 - u * 0.92) / 2;
      top.push([x, y - hw]); bot.push([x, y + hw]);
    }
    ctx.beginPath(); top.forEach(([x, y], k) => k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); bot.reverse().forEach(([x, y]) => ctx.lineTo(x, y)); ctx.closePath();
    ctx.fillStyle = lit ? 'rgba(255,214,150,0.6)' : '#1b1612'; ctx.fill();
  };
  for (let i = 0; i < 14; i++) ribbon(i, false);
  for (let i = 0; i < 5; i++) ribbon(i * 3 + 1, true);
  ctx.restore(); ctx.restore();
}
/** CAST.back: the back of a head and a shoulder, near the lens, out of focus (D1.2) */
function backOfHead(t, x, y, s, blur) {
  ctx.save(); ctx.filter = `blur(${blur}px)`; ctx.translate(x + noise(t * 0.3, 4) * 6, y); ctx.scale(s, s); ctx.fillStyle = '#0b0f12';
  ctx.beginPath(); ctx.ellipse(0, -150, 120, 150, 0.08, 0, 7); ctx.fill();
  ctx.beginPath(); spline([[-60, -20], [-300, 60], [-420, 400], [380, 400], [260, 40], [60, -20]]); ctx.fill();
  ctx.restore();
}

/* ───────── shared drawing ───────── */
function sky(tex, t, z = 1.04, dx = 0, dy = 0) { const w = W * z * 1.25, h = H * z * 1.25; ctx.drawImage(tex, (W - w) / 2 + dx - t * 6, (H - h) / 2 + dy, w, h); }
function vignette(a = 0.35) { const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, H * 1.05); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, `rgba(0,0,0,${a})`); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H); }
function grain(t, a = 0.05) { const s = Math.floor(t * 24); ctx.save(); ctx.globalAlpha = a; for (let i = 0; i < 900; i++) { ctx.fillStyle = rand(i + s * 977) > 0.5 ? '#fff' : '#000'; ctx.fillRect(rand(i * 2 + s) * W, rand(i * 3 + s * 7) * H, 2, 2); } ctx.restore(); }

/* ───────── D1.1 card storm ───────── */
const STORM = Array.from({ length: 64 }, (_, i) => ({
  tex: i % 24, x: (rand(i * 5) - 0.5) * 2600, y: (rand(i * 5 + 1) - 0.5) * 1500, z: (rand(i * 5 + 2) - 0.42) * 1700,
  rx: rand(i * 5 + 3) * 6, ry: rand(i * 5 + 4) * 6, rz: (rand(i * 7) - 0.5) * 0.9, vr: 0.25 + rand(i * 9) * 0.7, fall: 30 + rand(i * 11) * 70, sw: rand(i * 13) * 6,
}));
function stormCards(t, camZ, layer) { // layer 'back' (z ≥ 0, behind the figure) or 'front'
  const F = 1100, cx = W / 2, cy = H / 2;
  const items = STORM.map(c => {
    const a = c.sw + t * 0.12, x = c.x * Math.cos(a * 0.15) + c.z * Math.sin(a * 0.15) * 0.4, z = c.z * Math.cos(a * 0.15) - c.x * Math.sin(a * 0.15) * 0.15 - camZ;
    const y = ((c.y + t * c.fall + 750) % 1500) - 750; return { c, x, y, z };
  }).filter(o => (layer === 'back' ? o.z >= 0 : o.z < 0) && o.z > -F * 0.8).sort((a, b) => b.z - a.z);
  for (const { c, x, y, z } of items) {
    const s = F / (F + z), sx = cx + x * s, sy = cy + y * s;
    const ry = c.ry + t * c.vr, rx = c.rx + t * c.vr * 0.6, rz = c.rz + Math.sin(t * 0.5 + c.sw) * 0.2;
    const dof = Math.abs(z - 120); const lvl = dof > 700 ? 2 : dof > 330 ? 1 : 0, img = TEX.cards[c.tex][lvl], pad = img.pad ?? 0;
    const fx = Math.cos(ry), fy = Math.cos(rx); if (Math.abs(fx) < 0.06) continue;
    ctx.save(); ctx.translate(sx, sy); ctx.rotate(rz); ctx.transform(fx, Math.sin(ry) * 0.18, Math.sin(rx) * 0.12, fy, 0, 0); ctx.scale(s * 0.95, s * 0.95);
    ctx.globalAlpha = clamp(1.4 - z / 1500); if (fx < 0) ctx.filter = 'brightness(0.55)'; // the back of a card reads darker
    ctx.drawImage(img, -img.width / 2, -img.height / 2); ctx.restore();
  }
}
function d1Storm(t) {
  const k = t / CUT.water, camZ = lerp(0, 260, E.settle(k)); // a slow push through the storm
  ctx.save(); const z = 1 + k * 0.05; ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.translate(-W / 2, -H / 2);
  sky(TEX.dusk, t, 1.02);
  stormCards(t, camZ, 'back');
  boy(t, { x: 930 - k * 30, y: 840, s: 0.98 + k * 0.05, rim: 'rgba(255,170,100,0.9)' });
  stormCards(t, camZ, 'front');
  ctx.restore(); vignette(0.32);
}

/* ───────── D1.2 serif words in depth over water ───────── */
const LYRIC = [ // placeholder copy (on-screen words are Ishaan's): concept A's line
  { s: 'If you could', at: 6.8, x: 760, y: 600, px: 140 }, { s: 'see every cut', at: 7.85, x: 800, y: 760, px: 140 },
  { s: 'you would', at: 8.89, x: 780, y: 560, px: 156 }, { s: 'know why', at: 9.36, x: 820, y: 730, px: 156 },
];
function serifWords(t, w, outAt) {
  const words = w.s.split(' '); ctx.font = `italic 400 ${w.px}px ${SERIF}`; ctx.textAlign = 'left';
  const total = ctx.measureText(w.s).width; let x = w.x - total / 2;
  words.forEach((word, i) => {
    const at = w.at + i * 0.13 + (rand(i + w.at) - 0.5) * 0.05, k = E.out(prog(t, at, 0.55)), o = 1 - E.in(prog(t, outAt, 0.4)), ww = ctx.measureText(word + ' ').width;
    if (k > 0 && o > 0) {
      ctx.save(); ctx.globalAlpha = k * o; ctx.filter = `blur(${(1 - k) * 10 + (1 - o) * 14}px)`; ctx.fillStyle = `rgb(${lerp(150, 240, k)},${lerp(160, 244, k)},${lerp(166, 246, k)})`;
      ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 24; ctx.fillText(word, x, w.y + (1 - k) * 14 - (1 - o) * 20); ctx.restore();
    }
    x += ww;
  });
}
function heroCard(t, x, y, s, rot = 0, blur = 0) { const c = TEX.hero; ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s); if (blur) ctx.filter = `blur(${blur}px)`; ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 60; ctx.shadowOffsetY = 30; ctx.drawImage(c, -c.width / 2, -c.height / 2); ctx.restore(); }
function d1Water(t) {
  const lt = t - CUT.water, k = lt / (CUT.dive - CUT.water);
  ctx.save(); ctx.filter = 'blur(1.5px)'; const z = 1.06 + k * 0.05; ctx.drawImage(TEX.water, -300 - lt * 26, -260 + Math.sin(lt * 0.9) * 10, 2600 * z, 1500 * z); ctx.restore();
  ctx.save(); ctx.globalAlpha = 0.5; ctx.drawImage(TEX.water, -500 + lt * 14, -120, 2900, 1700); ctx.restore(); // a second swell for parallax
  // the held card: drifts down from above, settles slightly left of centre, then floats (D1.3 takes it from here)
  const ck = E.settle(prog(lt, 0, 1.8)); heroCard(t, lerp(1420, 1460, k), lerp(-300, 400, ck) + Math.sin(lt * 1.3) * 8, 1.25, -0.04 + Math.sin(lt * 0.7) * 0.02, (1 - ck) * 6);
  serifWords(t, LYRIC[0], 8.6); serifWords(t, LYRIC[1], 8.6); serifWords(t, LYRIC[2], 10.7); serifWords(t, LYRIC[3], 10.7);
  // one giant word passes near the lens, defocused (the reference's "If you")
  { const gk = prog(t, 7.2, 1.9); if (gk > 0 && gk < 1) { ctx.save(); ctx.globalAlpha = Math.sin(gk * Math.PI) * 0.9; ctx.filter = 'blur(7px)'; ctx.font = `italic 400 300px ${SERIF}`; ctx.fillStyle = '#f2f5f6'; ctx.fillText('every', lerp(1500, 1050, gk), 1000); ctx.restore(); } }
  backOfHead(t, 1830, 1020, 1.6, 10);
  vignette(0.45);
}

/* ───────── D1.3 dive into the card art (droste), D1.4 backlit figure ───────── */
const sceneB = mk(W, H), gB = sceneB.getContext('2d');
function d1Sun(t, into = ctx) {
  const prev = ctx; ctx = into; const lt = t - CUT.sun, z = 1.05 + Math.max(0, lt) * 0.012;
  sky(TEX.sun, t, z, -60, 40);
  const sx = 760, sy = 600; // the sun sits just behind the head's edge
  girl(t, { x: 960, y: 1090, s: 1.5 });
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const b = ctx.createRadialGradient(sx, sy, 0, sx, sy, 520); b.addColorStop(0, 'rgba(255,250,225,1)'); b.addColorStop(0.08, 'rgba(255,240,190,0.95)'); b.addColorStop(0.25, 'rgba(255,214,120,0.35)'); b.addColorStop(1, 'rgba(255,200,90,0)');
  ctx.fillStyle = b; ctx.fillRect(0, 0, W, H); ctx.restore(); // one soft bloom; it wraps the silhouette's edge
  vignette(0.25); ctx = prev;
}
function d1Dive(t) { // the held card grows; its cover is live scene B; inside the cover sits a smaller copy (droste); push in
  const lt = t - CUT.dive, k = prog(lt, 0, CUT.sun - CUT.dive);
  d1Sun(t, gB);
  d1WaterBackdrop(t);
  const c = TEX.hero, art = { x: 18, y: 18, w: 264, h: 264 }; // cover rect inside the card
  // log-space push (scale is exponential in the eased time) until the cover is exactly the frame's height: the cover
  // shows scene B's centre square, so at k = 1 the cover IS the middle of scene B
  const s0 = 1.25, e = E.hard(k), sc = s0 * Math.pow(H / art.h / s0, e);
  const cx = lerp(1460, W / 2, e), cy = lerp(400, H / 2, e);
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(lerp(-0.04, 0, E.hard(k))); ctx.scale(sc, sc);
  const ox = -c.width / 2, oy = -c.height / 2, ax = ox + art.x + art.w / 2, ay = oy + art.y + art.h / 2;
  ctx.translate(-(ax) * E.hard(k), -(ay) * E.hard(k)); // move the cover's centre to the frame centre as we push
  ctx.drawImage(c, ox, oy);
  ctx.restore();
  // past 60 % of the push, scene B spills out beyond the card's edges, so the hand-over at k = 1 has no seam
  const spill = E.in(prog(k, 0.6, 0.4)); if (spill) { ctx.save(); ctx.globalAlpha = spill; ctx.drawImage(sceneB, 0, 0); ctx.restore(); }
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(lerp(-0.04, 0, e)); ctx.scale(sc, sc); ctx.translate(-ax * e, -ay * e);
  // live cover: scene B cropped to a square, then a white frame with scene B again inside (two levels)
  ctx.save(); ctx.beginPath(); ctx.rect(ox + art.x, oy + art.y, art.w, art.h); ctx.clip();
  ctx.drawImage(sceneB, (W - H) / 2, 0, H, H, ox + art.x, oy + art.y, art.w, art.h);
  const fw = art.w * 0.34; ctx.globalAlpha = 1 - E.hard(prog(k, 0.55, 0.35)); ctx.fillStyle = P.ice; ctx.fillRect(ax - fw / 2 - 5, ay - fw / 2 - 5, fw + 10, fw + 10); ctx.drawImage(sceneB, (W - H) / 2, 0, H, H, ax - fw / 2, ay - fw / 2, fw, fw);
  ctx.globalAlpha = 1; ctx.fillStyle = '#14181b'; ctx.font = `800 ${art.w * 0.07}px ${SANS}`; ctx.textAlign = 'center'; ctx.globalAlpha = 1 - k; ctx.fillText('moovi', ax, oy + art.y + 22); ctx.globalAlpha = 1;
  ctx.restore(); ctx.restore();
  // the cover now fills the frame exactly: hand over to scene B (a match cut, not a dissolve)
  if (k >= 0.999) ctx.drawImage(sceneB, 0, 0);
}
function d1WaterBackdrop(t) { const lt = t - CUT.water; ctx.drawImage(TEX.water, -300 - lt * 26, -260, 2600 * 1.11, 1500 * 1.11); vignette(0.5); }

/* ───────── D1.5 pull-out into a frame on a white wall ───────── */
function d1Wall(t) {
  const lt = t - CUT.wall, k = E.hard(prog(lt, 0, 1.5)), back = E.in(prog(lt, 1.6, 0.45));
  d1Sun(t, gB);
  // the white gallery: two walls meeting in a soft corner, light falling from the left
  const g = ctx.createLinearGradient(0, 0, W, 0); g.addColorStop(0, '#e9eaea'); g.addColorStop(0.5, '#f6f7f7'); g.addColorStop(1, '#dcdede'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(0,0,0,0.05)'; ctx.fillRect(W * 0.78, 0, 4, H);
  const fw = lerp(W, 560, k), fh = fw * H / W, fx = W / 2 - fw / 2, fy = lerp(0, 330, k);
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.18)'; ctx.shadowBlur = 40 * k; ctx.shadowOffsetY = 18 * k; ctx.fillStyle = '#fff'; ctx.fillRect(fx - 26 * k, fy - 26 * k, fw + 52 * k, fh + 52 * k); ctx.restore();
  ctx.drawImage(sceneB, fx, fy, fw, fh);
  // the stacked name above the frame (the reference's "blond / blond"), each line a beat apart
  ['moovi', 'moovi', 'moovi'].forEach((s, i) => { const a = prog(lt, 0.55 + i * 0.12, 0.3); if (!a) return; ctx.save(); ctx.globalAlpha = a * (1 - i * 0.3); ctx.fillStyle = '#121416'; ctx.font = `800 ${86 - i * 18}px ${SANS}`; ctx.textAlign = 'center'; ctx.fillText(s, W / 2, fy - 50 - i * 0 + i * 64 - 120 + (1 - E.out(a)) * 14); ctx.restore(); });
  ctx.fillStyle = '#121416'; ctx.globalAlpha = k; ctx.font = `600 18px ${SANS}`; ctx.textAlign = 'center'; ctx.fillText('a film by Moovi', W / 2, fy + fh + 70); ctx.globalAlpha = 1;
  if (back > 0) { // whip back to the card over water, accelerating into the cut
    ctx.save(); ctx.globalAlpha = back; d1WaterBackdrop(t); heroCard(t, W / 2 + (1 - back) * 400, H / 2, 1.1); ctx.restore();
  }
}

/* ───────── D1.6 white matte flash ───────── */
function d1Matte(t) { sky(TEX.blue, t, 1.05); ctx.save(); ctx.shadowColor = 'rgba(255,255,255,0.9)'; ctx.shadowBlur = 30; boy(t, { x: 900, y: 800, s: 1.2, fill: '#ffffff', look: -0.15 }); ctx.restore(); }

/* ───────── D1.7 tall serif words behind the head, then the grade drains to grey ───────── */
const BIG = [ // placeholder copy (Ishaan's words): one line, two rows, behind the head
  { s: 'Every cut', at: 20.94, x: 640, y: 470 }, { s: 'has a', at: 21.95, x: 1330, y: 470 }, { s: 'reason', at: 22.45, x: 1240, y: 880 },
];
function tallWord(t, w) {
  const k = E.out(prog(t, w.at - 0.06, 0.5)); if (!k) return;
  ctx.save(); ctx.translate(w.x, w.y); ctx.scale(0.6, 1.38 * lerp(1.06, 1, k)); ctx.font = `400 300px ${SERIF}`; ctx.textAlign = 'center'; ctx.letterSpacing = '-6px';
  ctx.globalAlpha = k; ctx.filter = `blur(${(1 - k) * 8}px)`; ctx.fillStyle = P.wine; ctx.fillText(w.s, 0, 0); ctx.restore();
}
function d1Dusk(t) {
  const lt = t - CUT.dusk, z = 1.04 + lt * 0.008;
  ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.translate(-W / 2, -H / 2);
  sky(TEX.dusk, t, 1.0, 0, 60);
  BIG.forEach(w => tallWord(t, w)); // behind the figure: the head cuts the type
  boy(t, { x: 980, y: 850, s: 1.35, look: lerp(-0.02, -0.2, E.settle(prog(lt, 0.4, 3))), rim: 'rgba(255,170,100,0.85)' });
  ctx.restore();
  // a small handle with two sparkles, after the last word (the reference's signature)
  const h = prog(t, 23.4, 0.4); if (h) { ctx.save(); ctx.globalAlpha = h; ctx.fillStyle = P.wine; ctx.font = `italic 400 34px ${SERIF}`; ctx.textAlign = 'center'; ctx.fillText('moovi', 980, 700); for (const sx of [-80, 80]) { const r = 10 * (0.8 + 0.2 * Math.sin(t * 6 + sx)); ctx.beginPath(); ctx.moveTo(980 + sx, 690 - r); ctx.lineTo(980 + sx + r * 0.25, 690); ctx.lineTo(980 + sx, 690 + r); ctx.lineTo(980 + sx - r * 0.25, 690); ctx.fill(); } ctx.restore(); }
  vignette(0.3);
}

/* ───────── the frame ───────── */
function frame(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.filter = 'none'; ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  if (t < CUT.water) d1Storm(t);
  else if (t < CUT.dive) d1Water(t);
  else if (t < CUT.sun) d1Dive(t);
  else if (t < CUT.wall) d1Sun(t);
  else if (t < CUT.matte) d1Wall(t);
  else if (t < CUT.dusk) d1Matte(t);
  else d1Dusk(t);
  grain(t, 0.045);
  // the grade: from 23.0 s everything drains to a cool grey (the reference's ending)
  const grey = E.settle(prog(t, CUT.grey, 1.6));
  out.filter = grey ? `grayscale(${grey}) contrast(${1 + grey * 0.08}) brightness(${1 - grey * 0.04})` : 'none';
  out.drawImage(buf, 0, 0); out.filter = 'none';
  if (document.getElementById('lab').checked) { const p = PARTS.find(p => t >= p[0] && t < p[1]) ?? PARTS[PARTS.length - 1]; out.fillStyle = 'rgba(0,0,0,0.55)'; out.fillRect(24, H - 70, out.measureText(p[2]).width + 40, 46); out.font = `600 22px ${SANS}`; out.fillStyle = '#fff'; out.fillText(p[2], 44, H - 39); }
}

/* ───────── sound: the owner's Style 1 pack, placed on the measured grid ───────── */
const SFX_BASE = '/packages/engine/assets/sfx-style1/';
const CUES = [ // [time, file, gain]
  [0.02, 'woosh-short.wav', 0.35], [2.41, 'fs.ui.pop-9.wav', 0.18], [4.25, 'fs.ui.pop-4.wav', 0.16],
  [CUT.water - 0.02, 'fs.whoosh.swosh-whoosh-air-cut.wav', 0.45], [6.8, 'ui.pop.wav', 0.14], [7.85, 'ui.pop.wav', 0.14], [8.89, 'ui.pop.wav', 0.14], [9.36, 'ui.pop.wav', 0.14],
  [CUT.sun - 1.3, 'riser-short.wav', 0.45], [CUT.sun, 'fs.impact.soft-hit.wav', 0.4], [CUT.wall, 'woosh-tight.wav', 0.4], [17.2, 'fs.ui.pop-9.wav', 0.2],
  [CUT.matte - 0.4, 'woosh-short.wav', 0.35], [CUT.matte, 'finger-snap-tight.wav', 0.5], [CUT.dusk, 'fs.impact.soft-hit.wav', 0.35],
  [20.94, 'fs.impact.punch2.wav', 0.28], [21.95, 'fs.impact.soft-hit.wav', 0.3], [22.45, 'fs.impact.punch2.wav', 0.32], [23.4, 'tonal.chime.wav', 0.3],
];
let AC, BUF = {}, fired = new Set();
async function ensureAudio() {
  if (AC) return; AC = new AudioContext();
  await Promise.all([...new Set(CUES.map(c => c[1]))].map(async f => { try { BUF[f] = await AC.decodeAudioData(await (await fetch(SFX_BASE + f)).arrayBuffer()); } catch (e) { console.warn('sfx', f, e); } }));
}
function hit(f, gain) { const b = BUF[f]; if (!b || !AC) return; const s = AC.createBufferSource(), g = AC.createGain(); s.buffer = b; g.gain.value = gain; s.connect(g).connect(AC.destination); s.start(); }

/* ───────── transport: the reference video is the clock (muted unless "original audio") ───────── */
let playing = false;
const seek = document.getElementById('seek'), tl = document.getElementById('t'), playBtn = document.getElementById('play');
function now() { return video.currentTime; }
function setT(t) { video.currentTime = t; fired = new Set(CUES.map((c, i) => c[0] < t - 0.05 ? i : -1)); }
playBtn.onclick = async () => {
  await ensureAudio(); AC.resume();
  if (playing) { video.pause(); playing = false; playBtn.textContent = 'Play'; return; }
  if (video.ended || now() >= CUT.end - 0.05) setT(0);
  video.muted = !document.getElementById('oa').checked; await video.play(); playing = true; playBtn.textContent = 'Pause';
};
video.onended = () => { playing = false; playBtn.textContent = 'Play'; };
seek.oninput = () => setT(+seek.value);
document.getElementById('cmp').onchange = e => document.body.classList.toggle('cmp', e.target.checked);
document.getElementById('oa').onchange = e => { video.muted = !e.target.checked; };
function loop() {
  const t = now();
  if (playing && document.getElementById('sfx').checked) CUES.forEach(([a, f, g], i) => { if (!fired.has(i) && t >= a && t - a < 0.15) { fired.add(i); hit(f, g); } });
  frame(t); seek.value = t; tl.textContent = `${t.toFixed(2)} / ${CUT.end}`;
  requestAnimationFrame(loop);
}
window.D1 = { frame, CUT, PARTS }; // for sweeps and stills
document.fonts.load(`italic 400 80px "Instrument Serif"`).then(() => document.fonts.load(`400 80px "Instrument Serif"`)).then(() => document.fonts.load(`700 20px "Inter Tight"`)).finally(() => {
  buildDusk(); buildSun(); buildBlueSky(); buildWater(); buildCards(); video.muted = true; loop();
});
