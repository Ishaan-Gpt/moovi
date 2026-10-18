// R4 "Red Table": a red paper table where cut-out stickers are dropped and labelled by hand, hand-drawn boiling marker
// text that scribbles in and out, design-tool type cards with a selection box, condensed italic serif captions,
// an iPad with its app on the table, a black card with a cursor, a skeuomorphic plugin panel, flipbook-counting numbers.
'use strict';
const P4 = { red: '#c4262c', redDeep: '#7a1015', paper: '#f3eee4', ink: '#151515', white: '#f7f6f2', orange: '#ff8a2a' };
const MARK = 'Permanent Marker', MARK2 = 'Gochi Hand', HEAVY = 'Archivo Black', SERIF = F.serif;

function buildTextures4() {
  const c = makeCanvas(1080, 1920), g = c.getContext('2d');
  g.fillStyle = P4.red; g.fillRect(0, 0, 1080, 1920);
  const d = g.getImageData(0, 0, 1080, 1920), px = d.data; // paper fibre grain
  for (let i = 0, k = 0; i < px.length; i += 4, k++) { const v = (rand(k + 901) - 0.5) * 22; px[i] += v; px[i + 1] += v * 0.5; px[i + 2] += v * 0.5; }
  g.putImageData(d, 0, 0);
  const lt = g.createRadialGradient(300, 300, 50, 400, 600, 1500); lt.addColorStop(0, 'rgba(255,170,150,0.22)'); lt.addColorStop(1, 'rgba(60,0,0,0.5)'); g.fillStyle = lt; g.fillRect(0, 0, 1080, 1920);
  TEX.red = c;
}
function redTable(t) { const z = 1.03 + 0.02 * Math.sin(t * 0.2); ctx.drawImage(TEX.red, 540 - 540 * z + noise(t * 0.2, 91) * 10, 960 - 960 * z, 1080 * z, 1920 * z); }
function whiteCard(t, red = false) { ctx.fillStyle = red ? P4.red : P4.white; ctx.fillRect(0, 0, 1080, 1920); if (!red) { const v = ctx.createRadialGradient(540, 960, 400, 540, 960, 1300); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.08)'); ctx.fillStyle = v; ctx.fillRect(0, 0, 1080, 1920); } }

/* ───────────── design-tool selection box ───────────── */
function selBox(x, y, w, h, k = 1, col = '#111') {
  if (k <= 0) return; ctx.save(); ctx.globalAlpha *= k; ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.setLineDash([10, 8]); ctx.strokeRect(x, y, w, h); ctx.setLineDash([]);
  ctx.fillStyle = col; for (const [hx, hy] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]) ctx.fillRect(hx - 9, hy - 9, 18, 18); ctx.restore();
}
/** a word that sits in a selection box whose handles drag it to size (s0 → 1), like a design tool */
function boxWord(t, s, at, o) {
  if (t < at) return; const k = E.ramp(prog(t, at, o.dur ?? 0.5)), sc = lerp(o.s0 ?? 0.55, 1, k);
  ctx.save(); ctx.font = o.font; ctx.textAlign = 'center'; const m = ctx.measureText(s), w = m.width * sc, h = (o.h ?? o.px * 0.8) * sc;
  ctx.translate(o.x, o.y); ctx.scale(o.sx ?? 1, 1); ctx.save(); ctx.scale(sc, sc); ctx.fillStyle = o.fill ?? P4.ink; ctx.fillText(s, 0, 0); ctx.restore();
  if (o.box !== false) selBox(-w / 2 - 22, -h - 18, w + 44, h + 40, 1 - E.in(prog(t, at + (o.boxOff ?? 1.2), 0.25)), o.boxCol ?? P4.ink);
  ctx.restore();
}

/* ───────────── hand-drawn boiling marker text (the reel's own technique) ───────────── */
/**
 * Scribble in → word drawn stroke by stroke with a pen tip → boils on twos (12 fps) → scribble out. o = { x, y, px,
 * fill, outline, font, at, out, sx }. Deterministic: the boil seed is floor(t * 12).
 */
function scribbleText(t, s, o) {
  const at = o.at - 0.2, end = o.out ?? at + 2, boil = Math.floor(t * 12), px = o.px ?? 120, font = o.font ?? MARK;
  if (t < at - 0.25 || t > end + 0.3) return;
  ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(o.rot ?? 0); ctx.font = `400 ${px}px "${font}"`; const fit = Math.min(1, (o.maxW ?? 960) / ctx.measureText(s).width); ctx.scale((o.sx ?? 1) * fit, fit); ctx.textAlign = 'left'; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const W = ctx.measureText(s).width, x0 = -W / 2;
  // scribble in (the 0.25 s before) and out (0.3 s after): a loop that grows from a dot, then shrinks
  const sin = prog(t, at - 0.25, 0.25), sout = prog(t, end, 0.3);
  if (t < at || t > end) {
    const grow = t < at ? sin : 1 - sout, n = 6 + Math.floor(grow * 14);
    ctx.strokeStyle = o.fill ?? '#fff'; ctx.lineWidth = px * 0.06; ctx.beginPath();
    for (let i = 0; i < n; i++) { const a = i * 2.4 + rand(boil + i) * 0.6, r = grow * W * 0.45 * (0.3 + rand(i * 7 + boil) * 0.7); const x = Math.cos(a) * r, y = -px * 0.35 + Math.sin(a) * r * 0.35; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke(); ctx.restore(); return;
  }
  // the word, letter by letter, each drawn on (dash offset) and boiling (seeded jitter per 1/12 s)
  let x = x0; const chars = [...s], per = Math.min(0.035, 0.3 / chars.length);
  chars.forEach((ch, i) => {
    const cw = ctx.measureText(ch).width, k = prog(t, at + i * per, 0.14);
    if (k > 0 && ch !== ' ') {
      const jx = (rand(boil * 31 + i) - 0.5) * px * 0.035, jy = (rand(boil * 17 + i) - 0.5) * px * 0.035, jr = (rand(boil * 13 + i) - 0.5) * 0.05;
      ctx.save(); ctx.translate(x + cw / 2 + jx, jy); ctx.rotate(jr);
      if (o.outline) { ctx.strokeStyle = o.fill; ctx.lineWidth = px * 0.03; ctx.setLineDash([px * 3 * k, px * 3]); ctx.strokeText(ch, -cw / 2, 0); }
      else { ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 3; ctx.globalAlpha = clamp(k * 2.5); ctx.fillStyle = o.fill ?? '#fff'; ctx.fillText(ch, -cw / 2, (1 - E.out(k)) * 6); }
      ctx.restore();
    }
    x += cw;
  });
  if (o.dry) { ctx.save(); ctx.globalCompositeOperation = 'destination-out'; for (let i = 0; i < 260; i++) { const sx = x0 + rand(i * 3 + 5) * W, sy = -px * 0.85 + rand(i * 3 + 6) * px, r = 1 + rand(i * 3 + 7) * px * 0.025; ctx.beginPath(); ctx.ellipse(sx, sy, r * 3, r, 0.2, 0, 7); ctx.fill(); } ctx.restore(); }
  // the pen tip riding the newest letter
  const live = chars.findIndex((_, i) => prog(t, at + i * per, 0.14) < 1);
  if (live >= 0 && !o.outline) { let lx = x0; for (let i = 0; i < live; i++) lx += ctx.measureText(chars[i]).width; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(lx + ctx.measureText(chars[live]).width * prog(t, at + live * per, 0.14), -px * 0.3, px * 0.04, 0, 7); ctx.fill(); }
  ctx.restore();
}

/* ───────────── cut-out paper stickers dropped on the table ───────────── */
/** drop-in: slides from off-table, presses (1.04 → 1), settles with a top-down shadow that tightens */
function sticker(t, at, x, y, w, h, rot, art, o = {}) {
  if (t < at) return; const k = E.out(prog(t, at, 0.42)), press = Math.max(0, 1 - Math.abs(t - at - 0.36) * 8), out = o.out ? E.in(prog(t, o.out, 0.35)) : 0;
  const dx = (1 - k) * (o.from ?? -700) + out * 1200, dy = (1 - k) * 120;
  ctx.save(); ctx.translate(x + dx, y + dy); ctx.rotate(rot + (1 - k) * -0.25); const sc = 1 + 0.06 * (1 - k) - 0.02 * press; ctx.scale(sc, sc);
  ctx.shadowColor = 'rgba(40,0,0,0.5)'; ctx.shadowBlur = lerp(40, 14, k); ctx.shadowOffsetY = lerp(30, 8, k); ctx.shadowOffsetX = lerp(16, 4, k);
  ctx.fillStyle = o.paper ?? P4.paper; ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, o.r ?? 18); ctx.fill(); ctx.shadowColor = 'transparent';
  ctx.save(); ctx.beginPath(); ctx.roundRect(-w / 2 + 10, -h / 2 + 10, w - 20, h - 20, (o.r ?? 18) - 6); ctx.clip(); art(w - 20, h - 20); ctx.restore();
  const sheen = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2); sheen.addColorStop(0, 'rgba(255,255,255,0.18)'); sheen.addColorStop(0.5, 'rgba(255,255,255,0)'); ctx.fillStyle = sheen; ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, o.r ?? 18); ctx.fill();
  ctx.restore();
}
const ART = {
  ipad(w, h) { ART.ipadBase(w, h); ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(-w / 2 + 2, -h / 2 + 2, w - 4, h - 4, 15); ctx.stroke(); },
  ipadBase(w, h) { const g = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2); g.addColorStop(0, '#5b4bd8'); g.addColorStop(1, '#e05aa8'); ctx.fillStyle = '#1a1a22'; ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 16); ctx.fill(); ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(-w / 2 + 8, -h / 2 + 8, w - 16, h - 16, 10); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 10; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-w / 2 + 10 + i * 34, h / 2 - 10); ctx.lineTo(-w / 2 + 70 + i * 34, -h / 2 + 10); ctx.stroke(); } },
  app(w, h) { ctx.fillStyle = '#202024'; ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 22); ctx.fill(); ['#ffd166', '#ef8fb1', '#7fd1ff', '#9be29b'].forEach((c, i) => { ctx.fillStyle = c; ctx.beginPath(); ctx.roundRect(-w * 0.28, -h * 0.28 + i * h * 0.15, w * (0.5 - i * 0.06), h * 0.09, 6); ctx.fill(); }); },
  glove(w, h) { ctx.fillStyle = '#fbfaf6'; ctx.fillRect(-w / 2, -h / 2, w, h); ctx.strokeStyle = '#222'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(0, 10, w * 0.28, h * 0.22, 0, 0, 7); ctx.stroke(); for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(-w * 0.2 + i * w * 0.13, -h * 0.2, w * 0.06, h * 0.14, 0, 0, 7); ctx.stroke(); } ctx.beginPath(); ctx.ellipse(w * 0.3, 0, w * 0.06, h * 0.1, 0.8, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-w * 0.2, h * 0.28); ctx.lineTo(w * 0.2, h * 0.28); ctx.stroke(); },
  photo(w, h) { if (footage(TNOW, 'palms', -w / 2, -h / 2, w, h, { at: 16.5 })) return; const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2); g.addColorStop(0, '#2a2a40'); g.addColorStop(0.45, '#f39a3a'); g.addColorStop(0.6, '#f6c35a'); g.addColorStop(1, '#151515'); ctx.fillStyle = g; ctx.fillRect(-w / 2, -h / 2, w, h); ctx.fillStyle = '#0d0d0d'; for (const [x, s] of [[-0.32, 1], [0.3, 0.8], [0.4, 0.6]]) { ctx.fillRect(w * x - 4, -h * 0.4 * s, 8, h); for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.ellipse(w * x + Math.cos(i) * 40, -h * 0.4 * s, 60, 12, i, 0, 7); ctx.fill(); } } ctx.fillRect(-w / 2, h * 0.25, w, h * 0.25); },
  film(w, h) { ctx.fillStyle = '#fbfaf6'; ctx.fillRect(-w / 2, -h / 2, w, h); ctx.strokeStyle = '#222'; ctx.lineWidth = 3.5; for (let i = 0; i < 6; i++) { const x = -w / 2 + 40 + i * (w - 80) / 5, ph = i * 1.05; ctx.beginPath(); ctx.arc(x, -h * 0.25, 9, 0, 7); ctx.moveTo(x, -h * 0.18); ctx.lineTo(x + 4, h * 0.05); ctx.moveTo(x + 4, h * 0.05); ctx.lineTo(x + Math.sin(ph) * 22, h * 0.3); ctx.moveTo(x + 4, h * 0.05); ctx.lineTo(x - Math.sin(ph) * 22, h * 0.3); ctx.moveTo(x, -h * 0.1); ctx.lineTo(x + Math.cos(ph) * 20, h * 0.0); ctx.moveTo(x, -h * 0.1); ctx.lineTo(x - Math.cos(ph) * 20, h * 0.0); ctx.stroke(); } },
  prL(w, h) { ctx.fillStyle = '#00005b'; ctx.fillRect(-w / 2, -h / 2, w, h); ctx.fillStyle = '#9999ff'; ctx.font = `700 ${h * 0.46}px ${F.sans}`; ctx.textAlign = 'center'; ctx.fillText('Pr', 0, h * 0.16); },
  aeL(w, h) { ctx.fillStyle = '#00005b'; ctx.fillRect(-w / 2, -h / 2, w, h); ctx.fillStyle = '#d291ff'; ctx.font = `700 ${h * 0.46}px ${F.sans}`; ctx.textAlign = 'center'; ctx.fillText('Ae', 0, h * 0.16); },
  tag(w, h) { ctx.fillStyle = '#fbfaf6'; ctx.fillRect(-w / 2, -h / 2, w, h); },
  pr(w, h) { ctx.fillStyle = '#4b2bb8'; ctx.fillRect(-w / 2, -h / 2, w, h); ctx.fillStyle = '#e9e2ff'; ctx.beginPath(); ctx.moveTo(-w * 0.14, -h * 0.2); ctx.lineTo(w * 0.22, 0); ctx.lineTo(-w * 0.14, h * 0.2); ctx.fill(); },
  ae(w, h) { ctx.fillStyle = '#1d5fd1'; ctx.fillRect(-w / 2, -h / 2, w, h); ctx.fillStyle = '#e2ecff'; ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? w * 0.1 : w * 0.24; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.fill(); },
};
/** a red "no" stamp pressed onto a sticker */
function noStamp(t, at, x, y, r) { if (t < at) return; const k = spring(t - at, 'pop'); ctx.save(); ctx.translate(x, y); ctx.scale(k, k); ctx.rotate(-0.2); ctx.strokeStyle = '#d4232b'; ctx.lineWidth = r * 0.16; ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 10; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-r * 0.7, -r * 0.7); ctx.lineTo(r * 0.7, r * 0.7); ctx.stroke(); ctx.restore(); }
/** a handwritten label that boils, under a sticker */
function handLabel(t, s, at, x, y, px = 54, col = '#fff') { if (t < at) return; const boil = Math.floor(t * 12); ctx.save(); ctx.font = `400 ${px}px "${MARK2}"`; ctx.textAlign = 'center'; ctx.fillStyle = col; ctx.globalAlpha = clamp((t - at) * 6); ctx.translate(x + (rand(boil) - 0.5) * 3, y + (rand(boil + 9) - 0.5) * 3); ctx.rotate((rand(boil + 4) - 0.5) * 0.02); ctx.fillText(s, 0, 0); ctx.restore(); }

/* ───────────── the iPad on the table and its app screens ───────────── */
function ipad(t, x, y, w, rot, screen) {
  const h = w * 1.38; ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.shadowColor = 'rgba(30,0,0,0.6)'; ctx.shadowBlur = 50; ctx.shadowOffsetY = 26; ctx.fillStyle = '#0e0e10'; ctx.beginPath(); ctx.roundRect(-w / 2 - 22, -h / 2 - 22, w + 44, h + 44, 46); ctx.fill(); ctx.shadowColor = 'transparent';
  ctx.strokeStyle = '#2a2a2e'; ctx.lineWidth = 4; ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 22); ctx.clip(); ctx.fillStyle = '#111114'; ctx.fillRect(-w / 2, -h / 2, w, h); screen(w, h); ctx.restore();
  const gl = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2); gl.addColorStop(0, 'rgba(255,255,255,0.10)'); gl.addColorStop(0.4, 'rgba(255,255,255,0)'); ctx.fillStyle = gl; ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 22); ctx.fill();
  ctx.restore();
}
function pencil(x, y, rot) { ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 10; const g = ctx.createLinearGradient(-14, 0, 14, 0); g.addColorStop(0, '#d9d9dd'); g.addColorStop(0.5, '#ffffff'); g.addColorStop(1, '#bdbdc2'); ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(-14, -420, 28, 420, 12); ctx.fill(); ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(0, 46); ctx.lineTo(14, 0); ctx.fill(); ctx.restore(); }
const SCREENS = {
  newMovie(w, h, t, k) { ctx.fillStyle = '#e9ecef'; ctx.fillRect(-w / 2, -h / 2, w, h); ctx.fillStyle = '#111'; ctx.font = `700 ${w * 0.04}px ${F.sans}`; ctx.textAlign = 'left'; ctx.fillText('Create new movie', -w / 2 + 30, -h / 2 + 50); const c = spring(k, 'firm'); ctx.save(); ctx.scale(c, c); ctx.fillStyle = '#cfe7e4'; ctx.beginPath(); ctx.roundRect(-w * 0.25, -h * 0.18, w * 0.5, h * 0.36, 18); ctx.fill(); ctx.fillStyle = '#111'; ctx.font = `700 ${w * 0.045}px ${F.sans}`; ctx.textAlign = 'center'; ctx.fillText('Screen size', 0, -h * 0.04); ctx.fillStyle = '#e94b4b'; ctx.beginPath(); ctx.arc(w * 0.07, h * 0.1, 12, 0, 7); ctx.fill(); ctx.restore(); },
  frameRate(w, h, t, k) { ctx.fillStyle = '#16161a'; ctx.fillRect(-w / 2, -h / 2, w, h); ctx.fillStyle = '#fff'; ctx.font = `700 ${w * 0.05}px ${F.sans}`; ctx.textAlign = 'left'; ctx.fillText('Frames per second', -w / 2 + 40, -h / 2 + 80); ['Custom', 'Frame by frame', 'Anime', 'Cinema', 'Television', 'PAL', 'NTSC'].forEach((l, i) => { const on = i === 1; ctx.fillStyle = on ? '#e94b4b' : 'rgba(255,255,255,0.75)'; ctx.font = `600 ${w * 0.04}px ${F.sans}`; ctx.fillText(l, -w / 2 + 40, -h / 2 + 170 + i * 70); ctx.fillText(['20', '15', '12', '24', '25', '50', '30'][i], w / 2 - 110, -h / 2 + 170 + i * 70); }); },
  library(w, h, t, k) { ctx.fillStyle = '#121214'; ctx.fillRect(-w / 2, -h / 2, w, h); ctx.fillStyle = '#fff'; ctx.font = `700 ${w * 0.045}px ${F.sans}`; ctx.textAlign = 'left'; ctx.fillText('Procreate Dreams', -w / 2 + 30, -h / 2 + 60); for (let i = 0; i < 8; i++) { const x = -w / 2 + 40 + (i % 4) * w * 0.23, y = -h / 2 + 120 + Math.floor(i / 4) * h * 0.3; ctx.fillStyle = '#26262b'; ctx.beginPath(); ctx.roundRect(x, y, w * 0.19, h * 0.24, 10); ctx.fill(); ctx.fillStyle = ['#f6c35a', '#e94b4b', '#7fd1ff', '#9be29b'][i % 4]; ctx.fillRect(x + w * 0.07, y + 30, w * 0.05, h * 0.12); } },
  canvas(w, h, t, k, s) { // the drawing canvas: footage, scribbles that grow frame by frame, "hello" written, the frame strip
    ctx.fillStyle = '#e9ecef'; ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.save(); ctx.translate(0, -h * 0.08); ART.photo(w * 0.7, h * 0.62);
    const frame = s ? s.frame(t) : 0;
    if (frame > 0) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); const n = Math.min(frame, 4); for (let i = 0; i <= 10 * n; i++) { const a = i * 0.9, r = 8 + i * 2.4; const x = Math.cos(a) * r, y = Math.sin(a * 1.3) * r * 0.5; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); }
    if (frame >= 5) { ctx.fillStyle = '#ff6fa8'; ctx.font = `400 ${w * 0.12}px "${MARK2}"`; ctx.textAlign = 'center'; const chars = Math.min(5, frame - 4); ctx.fillText('Hello'.slice(0, chars), 0, 20); }
    ctx.restore();
    ctx.fillStyle = '#1a1a1e'; ctx.beginPath(); ctx.roundRect(-w * 0.45, h * 0.32, w * 0.9, h * 0.12, 14); ctx.fill();
    for (let i = 0; i < 10; i++) { ctx.fillStyle = i < frame ? '#fff' : '#3a3a40'; ctx.strokeStyle = i === frame - 1 ? '#e94b4b' : 'transparent'; ctx.lineWidth = 4; ctx.beginPath(); ctx.roundRect(-w * 0.4 + i * w * 0.075, h * 0.35, w * 0.06, h * 0.06, 4); ctx.fill(); ctx.stroke(); }
  },
};

/* ───────────── the black brush-pack card + cursor, the plugin panel ───────────── */
function brushCard(t, s) {
  ctx.fillStyle = '#050505'; ctx.fillRect(0, 0, 1080, 1920);
  const k = spring(t - s.t0, 'firm'); ctx.save(); ctx.translate(540, 900); ctx.scale(k * 1.25, k * 1.25);
  ctx.fillStyle = '#121214'; ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(-380, -170, 760, 340, 22); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#2f7ff0'; ctx.beginPath(); ctx.roundRect(-340, -130, 110, 90, 12); ctx.fill(); ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.font = `800 34px ${F.sans}`; ctx.fillText('FREE Brush Pack', -200, -100); ctx.font = `500 22px ${F.sans}`; ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillText('6 textured brushes for animated type', -200, -62);
  const press = Math.max(0, 1 - Math.abs(t - s.clickAt) * 7); ctx.fillStyle = `rgb(${255 - press * 40},${255 - press * 40},${255 - press * 40})`; ctx.beginPath(); ctx.roundRect(-340, 30, 680, 90, 14); ctx.fill(); ctx.fillStyle = '#111'; ctx.textAlign = 'center'; ctx.font = `700 30px ${F.sans}`; ctx.fillText('Get the Pack!', 0, 86);
  ctx.restore();
  if (t > s.clickAt - 0.6) { const p = E.out(prog(t, s.clickAt - 0.6, 0.55)); cursorHand(lerp(860, 560, p), lerp(1100, 860, p), Math.max(0, 1 - Math.abs(t - s.clickAt) * 8)); }
}
function cursorHand(x, y, press) { ctx.save(); ctx.translate(x, y); ctx.scale(1.6 - press * 0.2, 1.6 - press * 0.2); ctx.fillStyle = '#fff'; ctx.strokeStyle = '#111'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 46); ctx.lineTo(12, 34); ctx.lineTo(22, 54); ctx.lineTo(30, 50); ctx.lineTo(20, 30); ctx.lineTo(36, 30); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); }
function pluginPanel(w, h, t, s) { // a skeuomorphic hardware-like panel: a knob, a text field, style arrows, transition pads, an ANIMATE key
  const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2); g.addColorStop(0, '#f2e9d6'); g.addColorStop(1, '#d9ccb2'); ctx.fillStyle = g; ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.fillStyle = '#111'; ctx.font = `800 ${w * 0.07}px ${F.sans}`; ctx.textAlign = 'center'; ctx.fillText('ANIMATOR', 0, -h / 2 + w * 0.12);
  const kr = w * 0.16, ky = -h / 2 + w * 0.36, spin = s?.knob ? s.knob(t) : 0; ctx.save(); ctx.translate(0, ky); ctx.fillStyle = '#1b1b1e'; ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 8; ctx.beginPath(); ctx.arc(0, 0, kr, 0, 7); ctx.fill(); ctx.shadowColor = 'transparent'; ctx.rotate(spin); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); for (let i = 0; i < 30; i++) { const a = i * 0.7, r = kr * 0.5 * (0.4 + rand(i) * 0.6); i ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.stroke(); ctx.restore();
  ctx.strokeStyle = '#333'; ctx.lineWidth = 3; for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(Math.cos(a) * kr * 1.12, ky + Math.sin(a) * kr * 1.12); ctx.lineTo(Math.cos(a) * kr * (i % 6 ? 1.2 : 1.28), ky + Math.sin(a) * kr * (i % 6 ? 1.2 : 1.28)); ctx.stroke(); }
  for (const [sx, v] of [[-w * 0.42, 0.3], [w * 0.38, 0.7]]) { ctx.fillStyle = '#bdbab2'; ctx.beginPath(); ctx.roundRect(sx, ky - kr, w * 0.04, kr * 2, 6); ctx.fill(); ctx.fillStyle = '#1b1b1e'; ctx.beginPath(); ctx.roundRect(sx - w * 0.015, ky - kr + kr * 2 * v, w * 0.07, w * 0.04, 6); ctx.fill(); }
  ctx.fillStyle = '#121214'; ctx.beginPath(); ctx.roundRect(-w * 0.4, ky + kr + 30, w * 0.8, w * 0.12, 10); ctx.fill(); ctx.fillStyle = '#ddd'; ctx.font = `600 ${w * 0.04}px ${F.sans}`; ctx.fillText('TEXT HERE', 0, ky + kr + 30 + w * 0.075);
  for (let i = 0; i < 2; i++) { const px = -w * 0.2 + i * w * 0.4, py = ky + kr + w * 0.32; ctx.fillStyle = '#d9d7d0'; ctx.beginPath(); ctx.roundRect(px - w * 0.17, py - w * 0.12, w * 0.34, w * 0.3, 10); ctx.fill(); [[0, -1], [-1, 0], [0, 0], [1, 0], [0, 1]].forEach(([a, b], j) => { const on = s?.pad?.(t, i, j); ctx.fillStyle = on ? '#ff4a1a' : '#1b1b1e'; ctx.beginPath(); ctx.roundRect(px + a * w * 0.08 - w * 0.03, py + b * w * 0.08 - w * 0.03, w * 0.06, w * 0.06, 6); ctx.fill(); }); }
  { // the dense middle: preset keys, two labelled faders, a row of LED keys (the judge: "the face is sparse")
    const y0 = ky + kr + w * 0.6; ctx.textAlign = 'center';
    ['EASE', 'BOUNCE', 'BOIL'].forEach((lab, i) => { const bx = -w * 0.28 + i * w * 0.28, on = i === 2;
      ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.roundRect(bx - w * 0.12, y0 + 4, w * 0.24, w * 0.1, 8); ctx.fill();
      ctx.fillStyle = on ? '#1b1b1e' : '#f7f3ea'; ctx.beginPath(); ctx.roundRect(bx - w * 0.12, y0, w * 0.24, w * 0.1, 8); ctx.fill();
      ctx.fillStyle = on ? '#fff' : '#1b1b1e'; ctx.font = `700 ${w * 0.036}px ${F.sans}`; ctx.fillText(lab, bx, y0 + w * 0.064); });
    [['DURATION', 0.42, '0.8s'], ['SMOOTH', 0.68, '68%']].forEach(([lab, v, val], i) => { const fy = y0 + w * 0.26 + i * w * 0.2;
      ctx.textAlign = 'left'; ctx.fillStyle = '#4a463e'; ctx.font = `700 ${w * 0.032}px ${F.sans}`; ctx.fillText(lab, -w * 0.4, fy - w * 0.035);
      ctx.textAlign = 'right'; ctx.fillText(val, w * 0.4, fy - w * 0.035);
      ctx.fillStyle = '#bdbab2'; ctx.beginPath(); ctx.roundRect(-w * 0.4, fy, w * 0.8, w * 0.025, 5); ctx.fill();
      ctx.fillStyle = '#ff4a1a'; ctx.beginPath(); ctx.roundRect(-w * 0.4, fy, w * 0.8 * v, w * 0.025, 5); ctx.fill();
      ctx.fillStyle = '#1b1b1e'; ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 3; ctx.beginPath(); ctx.roundRect(-w * 0.4 + w * 0.8 * v - w * 0.03, fy - w * 0.022, w * 0.06, w * 0.07, 6); ctx.fill(); ctx.shadowColor = 'transparent'; });
    ctx.textAlign = 'center';
    for (let i = 0; i < 5; i++) { const lx = -w * 0.32 + i * w * 0.16, ly = y0 + w * 0.7, lit = i === Math.floor(t * 3) % 5;
      ctx.fillStyle = '#1b1b1e'; ctx.beginPath(); ctx.arc(lx, ly, w * 0.045, 0, 7); ctx.fill();
      ctx.fillStyle = lit ? '#ff4a1a' : '#5a564e'; ctx.beginPath(); ctx.arc(lx, ly, w * 0.016, 0, 7); ctx.fill(); }
  }
  const press = s?.animateAt ? Math.max(0, 1 - Math.abs(t - s.animateAt) * 6) : 0; ctx.fillStyle = press ? '#ff6a2a' : '#ff4a1a'; ctx.beginPath(); ctx.roundRect(-w * 0.4, h / 2 - w * 0.2, w * 0.8, w * 0.11 * (1 - press * 0.1), 10); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = `800 ${w * 0.045}px ${F.sans}`; ctx.fillText('ANIMATE', 0, h / 2 - w * 0.13);
}

/* ───────────── big serif numbers that count like flipbook pages ───────────── */
function flipNumber(t, at, to, x, y, px, label) {
  if (t < at) return; const k = prog(t, at, 0.5), n = Math.max(1, Math.round(to * E.out(k))), flip = (t * 30) % 1;
  ctx.save(); ctx.translate(x, y); ctx.font = `400 ${px}px ${SERIF}`; ctx.textAlign = 'center'; ctx.scale(0.66, 1.25); ctx.fillStyle = '#fff'; ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 20;
  if (k < 1) { ctx.save(); ctx.globalAlpha = 0.35; ctx.transform(1, 0, -0.12 * flip, 1, 0, 0); ctx.fillText(String(Math.max(1, n - 1)), 0, 0); ctx.restore(); } // the page underneath, flipping
  ctx.fillText(String(n), 0, 0); ctx.restore();
  ctx.save(); ctx.font = `300 ${px * 0.2}px "Barlow Condensed"`; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 12; ctx.globalAlpha = clamp((t - at) * 4); ctx.fillText(label, x, y + px * 0.22); ctx.restore();
}

function finallyCard(t, s) {
  // the reel's tall condensed display serif: one word ~80% of the frame height, the eye IS the dot of the i (a dotless
  // ı is drawn and the eye sits where its dot would be), dashed guides edge to edge, a thin condensed subtitle
  whiteCard(t, true);
  const k = E.out(prog(t, s.t0, 0.45)), sx = 0.78, sy = 2.02 * lerp(1.18, 1, k), px = 470, word = 'F\u0131nally', track = -10;
  ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2; ctx.setLineDash([12, 10]);
  for (const y of [560, 1330]) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1080 * k, y); ctx.stroke(); } ctx.restore();
  ctx.save(); ctx.font = `italic 400 ${px}px ${SERIF}`; ctx.letterSpacing = `${track}px`;
  const full = ctx.measureText(word).width, wF = ctx.measureText('F').width + track, wi = ctx.measureText('\u0131').width;
  ctx.restore();
  ctx.save(); ctx.translate(540, 1330); ctx.scale(sx, sy); ctx.font = `italic 400 ${px}px ${SERIF}`; ctx.letterSpacing = `${track}px`; ctx.textAlign = 'center'; ctx.fillStyle = P4.white;
  ctx.shadowColor = 'rgba(80,0,0,0.35)'; ctx.shadowBlur = 20; ctx.fillText(word, 0, 0); ctx.restore();
  // the dot of an italic i sits up the slant: x-height ~0.47 em above the baseline, the slant ~0.2 per unit of height
  const dotY = px * 0.66, ex = 540 + (-full / 2 + wF + wi * 0.5 + dotY * 0.2) * sx + 26, ey = 1330 - dotY * sy;
  eye(t, ex, ey, 2.0);
  ctx.save(); ctx.font = `300 72px "Barlow Condensed"`; ctx.textAlign = 'left'; ctx.fillStyle = P4.white; ctx.globalAlpha = clamp((t - s.subAt) * 5); ctx.fillText('GOING TO BE SHOWING YOU', 70, 1430); ctx.restore();
}
