// The two worlds: the warm room (speaker stand-in, 5 parallax planes) and the crimson poster (paper, keys, props).
// Everything is drawn in code; textures are generated once from seeded noise so frames are deterministic.
'use strict';
/** the speaker's room and clothes, set per kit before buildTextures() (R2 olive room by default) */
let ROOM = { wall: ['#262816', '#34361d', '#13130b'], light: 'rgba(170,220,60,', torso: ['#3a2c22', '#56432f', '#6e5640'], collar: '#33261d', arms: ['#3a2c22', '#56432f'] };

/* ───────────── speech: mouth and hands follow the word timings, not the audio analyser (pure function of t) ───────────── */
let WORDS = [];
function speech(t) {
  let v = 0;
  for (const w of WORDS) {
    if (w.t > t + 0.05) break;
    if (t < w.end + 0.04 && t > w.t - 0.02) { const k = clamp((t - w.t) / Math.max(0.08, w.end - w.t)); v = Math.max(v, Math.sin(Math.PI * k) * (0.7 + 0.3 * Math.abs(Math.sin(t * 31 + w.t * 9)))); }
  }
  return v;
}
function energy(t) { // how much is being said around t (0..1), smooth
  let e = 0; for (let i = 0; i < 6; i++) e += speech(t - i * 0.07); return clamp(e / 4);
}

/* ───────────── generated textures ───────────── */
function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
const TEX = {};
function buildTextures() {
  // crimson paper: radial heat, big mottled clouds, fine grain, vignette
  const c = makeCanvas(1080, 1920), g = c.getContext('2d');
  const base = g.createRadialGradient(540, 700, 40, 540, 760, 1250);
  base.addColorStop(0, '#c3141c'); base.addColorStop(0.42, '#8d0b12'); base.addColorStop(1, '#2c0204');
  g.fillStyle = base; g.fillRect(0, 0, 1080, 1920);
  for (let i = 0; i < 70; i++) {
    const x = rand(i * 3 + 1) * 1080, y = rand(i * 3 + 2) * 1920, r = 80 + rand(i * 3 + 3) * 340, dark = rand(i + 99) > 0.5;
    const m = g.createRadialGradient(x, y, 0, x, y, r);
    m.addColorStop(0, dark ? 'rgba(30,0,2,0.16)' : 'rgba(255,90,80,0.08)'); m.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = m; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const d = g.getImageData(0, 0, 1080, 1920), px = d.data;
  for (let i = 0, n = 0; i < px.length; i += 4, n++) { const v = (rand(n) - 0.5) * 26; px[i] += v; px[i + 1] += v * 0.6; px[i + 2] += v * 0.6; }
  g.putImageData(d, 0, 0);
  const vg = g.createRadialGradient(540, 860, 380, 540, 960, 1300); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.62)');
  g.fillStyle = vg; g.fillRect(0, 0, 1080, 1920);
  TEX.crimson = c;
  // the room's back wall, once (a soft warm plaster with a lamp pool)
  const r = makeCanvas(1080, 1920), q = r.getContext('2d');
  const wall = q.createLinearGradient(0, 0, 0, 1920); wall.addColorStop(0, ROOM.wall[0]); wall.addColorStop(0.5, ROOM.wall[1]); wall.addColorStop(1, ROOM.wall[2]);
  q.fillStyle = wall; q.fillRect(0, 0, 1080, 1920);
  const rd = q.getImageData(0, 0, 1080, 1920), rp = rd.data;
  for (let i = 0, n = 0; i < rp.length; i += 4, n++) { const v = (rand(n + 77) - 0.5) * 9; rp[i] += v; rp[i + 1] += v; rp[i + 2] += v; }
  q.putImageData(rd, 0, 0);
  TEX.wall = r;
}

/* ───────────── the room (speaker stand-in) ─────────────
   cam = { s, ox, oy } in world px; planes move by depth (parallax), the figure is depth 1. */
function plane(cam, d, fn) {
  const sd = 1 + (cam.s - 1) * d, fx = 540, fy = cam.fy ?? 900;
  ctx.save(); ctx.translate(fx, fy); ctx.scale(sd, sd); ctx.translate(-fx + cam.ox * d, -fy + cam.oy * d); fn(); ctx.restore();
}
function room(t, cam) {
  // plane 1: wall + the one big soft bloom (the practical lamp), breathing slowly
  plane(cam, 0.35, () => {
    ctx.drawImage(TEX.wall, -120, -200, 1320, 2340);
    const br = 1 + 0.03 * Math.sin(t * 0.7);
    const lamp = ctx.createRadialGradient(860, 420, 10, 860, 420, 820 * br);
    lamp.addColorStop(0, 'rgba(255,196,130,0.34)'); lamp.addColorStop(0.4, 'rgba(255,160,90,0.12)'); lamp.addColorStop(1, 'rgba(255,160,90,0)');
    ctx.fillStyle = lamp; ctx.fillRect(-200, -300, 1500, 1700);
    const gl = ctx.createRadialGradient(140, 300, 10, 140, 300, 900); gl.addColorStop(0, ROOM.light + '0.30)'); gl.addColorStop(1, ROOM.light + '0)'); ctx.fillStyle = gl; ctx.fillRect(-200, -300, 1500, 1700);
    // a dark framed print on the wall (stand-in for the reference's wall piece)
    ctx.fillStyle = 'rgba(10,6,4,0.55)'; ctx.fillRect(330, 560, 420, 120);
  });
  // plane 2: shelves right, monitor left
  plane(cam, 0.55, () => {
    ctx.fillStyle = '#1a120d';
    for (const y of [640, 800, 960]) { ctx.fillRect(760, y, 380, 16); }
    for (let i = 0; i < 14; i++) {
      const y = [640, 800, 960][i % 3], x = 780 + rand(i + 5) * 320, h = 30 + rand(i + 9) * 70, w = 18 + rand(i + 13) * 50;
      ctx.fillStyle = rand(i + 21) > 0.7 ? '#5a4232' : '#140d09'; ctx.fillRect(x, y - h, w, h);
    }
    ctx.fillStyle = '#0d0a08'; ctx.fillRect(-40, 840, 330, 200);
    const scr = ctx.createLinearGradient(0, 850, 0, 1030); scr.addColorStop(0, '#1d2a38'); scr.addColorStop(1, '#0f1720');
    ctx.fillStyle = scr; ctx.fillRect(-28, 852, 306, 176);
    ctx.fillStyle = 'rgba(140,180,220,0.06)'; ctx.fillRect(-28, 852, 306, 60);
  });
  // plane 3: the chair back behind the figure
  plane(cam, 0.8, () => {
    ctx.fillStyle = '#16110e'; ctx.beginPath(); ctx.roundRect(720, 820, 190, 520, 60); ctx.fill();
    ctx.strokeStyle = 'rgba(255,220,180,0.05)'; ctx.lineWidth = 3;
    for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.moveTo(735, 850 + i * 52); ctx.lineTo(895, 850 + i * 52); ctx.stroke(); }
  });
}
// R2's desk: a dark cutting mat with a grid, and (from "five things") five poker chips with a chess knight that marks
// the level being talked about. DESK is set by edit.js every frame (pure function of t).
let DESK = { chips: 0, knight: -1, knightK: 1, nums: 0, lift: -1 };
const CHIP = ['#e0409a', '#4a62e0', '#d8d4cc', '#2fae4a', '#ef6a2a'];
function chip(x, y, r, col, i, lift = 0) {
  ctx.save(); ctx.translate(x, y - lift);
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.ellipse(6, 14 + lift, r * 1.05, r * 0.42, 0, 0, 7); ctx.fill();
  for (let k = 3; k >= 0; k--) { ctx.fillStyle = k ? shadeCol(col, -0.35) : col; ctx.beginPath(); ctx.ellipse(0, k * 4, r, r * 0.4, 0, 0, 7); ctx.fill(); }
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = r * 0.12; ctx.setLineDash([r * 0.22, r * 0.2]);
  ctx.beginPath(); ctx.ellipse(0, 0, r * 0.86, r * 0.34, 0, 0, 7); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.ellipse(0, 0, r * 0.42, r * 0.16, 0, 0, 7); ctx.fill();
  ctx.fillStyle = shadeCol(col, -0.1); ctx.beginPath(); ctx.ellipse(0, 0, r * 0.32, r * 0.12, 0, 0, 7); ctx.fill();
  ctx.restore();
}
function shadeCol(hex, k) { const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255, f = v => Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k); return `rgb(${f(r)},${f(g)},${f(b)})`; }
function knight(x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  const g = ctx.createLinearGradient(-40, -170, 40, 0); g.addColorStop(0, '#ffc48a'); g.addColorStop(1, '#c4642a');
  ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(8, 4, 52, 16, 0, 0, 7); ctx.fill();
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, 48, 14, 0, 0, 7); ctx.fill(); ctx.fillRect(-40, -22, 80, 22);
  ctx.beginPath(); ctx.moveTo(-30, -22); ctx.lineTo(-26, -70); ctx.quadraticCurveTo(-46, -110, -20, -150); ctx.quadraticCurveTo(10, -190, 40, -150); ctx.lineTo(52, -118); ctx.lineTo(30, -110); ctx.quadraticCurveTo(26, -70, 30, -22); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,240,220,0.5)'; ctx.beginPath(); ctx.ellipse(-12, -120, 8, 26, -0.4, 0, 7); ctx.fill();
  ctx.restore();
}
function desk(cam) { // plane 5: the foreground desk (moves most)
  plane(cam, 1.15, () => {
    const g = ctx.createLinearGradient(0, 1500, 0, 1920); g.addColorStop(0, '#1b1a17'); g.addColorStop(1, '#070707');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-200, 1540); ctx.lineTo(1300, 1470); ctx.lineTo(1300, 2200); ctx.lineTo(-200, 2200); ctx.fill();
    // the cutting mat's grid, in perspective
    ctx.save(); ctx.clip(); ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 2;
    for (let i = -12; i <= 12; i++) { ctx.beginPath(); ctx.moveTo(540 + i * 60, 1500); ctx.lineTo(540 + i * 150, 2100); ctx.stroke(); }
    for (let j = 0; j < 10; j++) { const y = 1520 + Math.pow(j, 1.5) * 26; ctx.beginPath(); ctx.moveTo(-200, y); ctx.lineTo(1300, y - 40); ctx.stroke(); }
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,220,160,0.14)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-200, 1540); ctx.lineTo(1300, 1470); ctx.stroke();
    if (DESK.chips > 0) {
      for (let i = 0; i < 5; i++) {
        const k = spring(DESK.chips - i * 0.06, 'firm'); if (k <= 0) continue;
        const x = 200 + i * 170, y = 1640 - i * 6;
        chip(x, y + (1 - k) * 60, 66, CHIP[i], i, DESK.lift === i ? 14 : 0);
        if (DESK.nums > 0) { // 5 4 3 2 1 above the chips, counting down one by one
          const nk = E.out(prog(DESK.nums, (4 - i) * 0.09, 0.25)); if (nk > 0) { ctx.save(); ctx.globalAlpha = nk; font(64, 400, F.cond); ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; shade(true, 14, 0.6, 3); ctx.fillText(String(5 - i), x, y - 90 - (1 - nk) * 20); ctx.restore(); }
        }
      }
      if (DESK.knight >= 0) { const xk = 200 + DESK.knight * 170; knight(xk, 1640 - DESK.knight * 6 - 30, 0.66); }
    }
  });
}
function figure(t, cam) {
  const sp = speech(t), en = energy(t);
  const sway = noise(t * 0.45, 3) * 22 + noise(t * 1.3, 4) * 8 * en;
  const nod = noise(t * 2.2, 5) * 10 * en + sp * 4;
  plane(cam, 1, () => {
    // torso: olive knit, lit from the lamp side (right), rim light on the shoulders
    const tx = 540 + sway * 0.6;
    const tg = ctx.createLinearGradient(tx - 330, 0, tx + 330, 0); tg.addColorStop(0, ROOM.torso[0]); tg.addColorStop(0.65, ROOM.torso[1]); tg.addColorStop(1, ROOM.torso[2]);
    ctx.fillStyle = tg; ctx.beginPath();
    ctx.moveTo(tx - 420, 1920); ctx.lineTo(tx - 400, 1300); ctx.bezierCurveTo(tx - 380, 1080, tx - 220, 1000, tx, 995); ctx.bezierCurveTo(tx + 220, 1000, tx + 380, 1080, tx + 400, 1300); ctx.lineTo(tx + 420, 1920); ctx.closePath(); ctx.fill();
    // knit texture: faint vertical ribs
    ctx.save(); ctx.clip(); ctx.strokeStyle = 'rgba(0,0,0,0.07)'; ctx.lineWidth = 3;
    for (let x = tx - 420; x < tx + 420; x += 14) { ctx.beginPath(); ctx.moveTo(x, 990); ctx.lineTo(x + 6, 1920); ctx.stroke(); }
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,200,140,0.32)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(tx + 160, 1008); ctx.bezierCurveTo(tx + 300, 1040, tx + 390, 1130, tx + 400, 1300); ctx.stroke();
    // polo collar + pin
    ctx.fillStyle = ROOM.collar; ctx.beginPath(); ctx.moveTo(tx - 110, 1000); ctx.lineTo(tx - 20, 1110); ctx.lineTo(tx, 1090); ctx.lineTo(tx + 20, 1110); ctx.lineTo(tx + 110, 1000); ctx.lineTo(tx + 60, 992); ctx.lineTo(tx, 1060); ctx.lineTo(tx - 60, 992); ctx.fill();
    ctx.fillStyle = '#d9d4c8'; ctx.beginPath(); ctx.arc(tx + 40, 1180, 9, 0, 7); ctx.fill();
    // neck + head (head centre ~y 760 so the big words can sit behind it)
    const hx = 540 + sway, hy = 760 + nod;
    const nk = ctx.createLinearGradient(0, hy + 100, 0, hy + 260); nk.addColorStop(0, '#5e3a27'); nk.addColorStop(1, '#8a5a3e');
    ctx.fillStyle = nk; ctx.beginPath(); ctx.moveTo(hx - 52, hy + 100); ctx.lineTo(hx - 58, hy + 250); ctx.lineTo(hx + 58, hy + 250); ctx.lineTo(hx + 52, hy + 100); ctx.fill();
    const sk = ctx.createRadialGradient(hx + 40, hy - 30, 10, hx, hy, 190); sk.addColorStop(0, '#c08660'); sk.addColorStop(0.7, '#9a6443'); sk.addColorStop(1, '#6e432c');
    ctx.fillStyle = '#7a4c33'; ctx.beginPath(); ctx.ellipse(hx - 120, hy + 6, 18, 34, 0.1, 0, 7); ctx.ellipse(hx + 120, hy + 6, 18, 34, -0.1, 0, 7); ctx.fill();
    ctx.fillStyle = sk; ctx.beginPath();
    ctx.moveTo(hx, hy - 160); ctx.bezierCurveTo(hx + 95, hy - 160, hx + 122, hy - 80, hx + 120, hy + 10);
    ctx.bezierCurveTo(hx + 118, hy + 110, hx + 70, hy + 165, hx, hy + 168); ctx.bezierCurveTo(hx - 70, hy + 165, hx - 118, hy + 110, hx - 120, hy + 10);
    ctx.bezierCurveTo(hx - 122, hy - 80, hx - 95, hy - 160, hx, hy - 160); ctx.fill();
    // beard: a soft shadowed mass on the jaw
    const bd = ctx.createRadialGradient(hx, hy + 120, 10, hx, hy + 100, 120); bd.addColorStop(0, 'rgba(26,16,12,0.85)'); bd.addColorStop(1, 'rgba(26,16,12,0)');
    ctx.fillStyle = bd; ctx.beginPath(); ctx.ellipse(hx, hy + 92, 118, 82, 0, 0, Math.PI); ctx.fill();
    // hair: one curly mass, outline built from seeded bumps that breathe a little with the head
    ctx.fillStyle = '#15100d'; ctx.beginPath();
    for (let i = 0; i <= 28; i++) {
      const a = Math.PI * (0.93 + i / 28 * 1.14), r = 158 + rand(i * 7 + 3) * 18 + (i % 2 ? 9 : 0);
      const x = hx + Math.cos(a) * r * 1.02, y = hy - 70 + Math.sin(a) * r * 0.86;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.lineTo(hx + 112, hy - 40); ctx.quadraticCurveTo(hx + 40, hy - 120, hx - 20, hy - 104); ctx.quadraticCurveTo(hx - 80, hy - 96, hx - 114, hy - 40); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,190,140,0.14)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(hx + 40, hy - 150, 120, -1.2, -0.2); ctx.stroke();
    // eyes (blink on a fixed schedule), glasses
    const blink = (t % 3.7) > 3.58 ? 0.15 : 1;
    ctx.fillStyle = '#1b120e';
    for (const dx of [-48, 48]) { ctx.beginPath(); ctx.ellipse(hx + dx, hy - 8, 10, 8 * blink, 0, 0, 7); ctx.fill(); }
    ctx.strokeStyle = '#0c0807'; ctx.lineWidth = 9;
    for (const dx of [-50, 50]) { ctx.beginPath(); ctx.roundRect(hx + dx - 44, hy - 40, 88, 66, 16); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(hx - 8, hy - 14); ctx.lineTo(hx + 8, hy - 14); ctx.stroke();
    ctx.fillStyle = 'rgba(255,230,200,0.10)'; ctx.fillRect(hx + 18, hy - 34, 66, 14);
    // nose shade, mouth opening with the voice
    ctx.fillStyle = 'rgba(80,45,30,0.5)'; ctx.beginPath(); ctx.ellipse(hx + 4, hy + 44, 16, 10, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#2b130d'; ctx.beginPath(); ctx.ellipse(hx, hy + 92, 28 + sp * 5, 4 + sp * 18, 0, 0, Math.PI * 2); ctx.fill();
    // hands: gesture with the energy of the words
    for (const side of [-1, 1]) {
      const gx = 540 + side * (210 + noise(t * 0.9, side + 10) * 90 * (0.3 + en)) + sway * 0.5;
      const gy = 1480 - (0.25 + en * 0.75) * (120 + noise(t * 1.1, side + 20) * 110) - Math.max(0, noise(t * 1.7, side + 30)) * 80 * en;
      const ex = 540 + side * 330, ey = 1760;
      ctx.strokeStyle = side < 0 ? ROOM.arms[0] : ROOM.arms[1]; ctx.lineWidth = 120; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(ex, 1960); ctx.quadraticCurveTo(ex + side * 30, ey, gx, gy + 60); ctx.stroke();
      const hg = ctx.createRadialGradient(gx + 20, gy - 20, 10, gx, gy, 110); hg.addColorStop(0, '#b47c56'); hg.addColorStop(1, '#6f452e');
      const rot = side * 0.5 + noise(t * 0.8, side + 40) * 0.5, spread = 0.12 + en * 0.25;
      ctx.save(); ctx.translate(gx, gy); ctx.rotate(rot); ctx.fillStyle = hg;
      ctx.beginPath(); ctx.ellipse(0, 10, 62, 54, 0, 0, 7); ctx.fill();
      for (let f = 0; f < 4; f++) { ctx.save(); ctx.rotate(-0.35 + f * spread * 0.9 - 0.1); ctx.beginPath(); ctx.roundRect(-14 + (f - 1.5) * 26, -96, 26, 80, 13); ctx.fill(); ctx.restore(); }
      ctx.save(); ctx.rotate(side * 1.0); ctx.beginPath(); ctx.roundRect(-side * 48 - 14, -60, 28, 70, 14); ctx.fill(); ctx.restore();
      ctx.restore();
      ctx.fillStyle = '#121212'; ctx.fillRect(gx - 46, gy + 58, 92, 20);
    }
    ctx.lineCap = 'butt';
  });
}
/** the speaker scene inside a box; `behind` draws between the room and the figure (words behind the head) */
function speakerScene(t, cam, box, behind) {
  const [bx, by, bw, bh] = box;
  ctx.save(); ctx.beginPath(); ctx.rect(bx, by, bw, bh); ctx.clip();
  ctx.translate(bx + bw / 2, by + bh / 2); const k = box.scale ?? bh / H; ctx.scale(k, k); ctx.translate(-540, -(box.focusY ?? 960));
  room(t, cam);
  if (behind) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); behind(); ctx.restore(); }
  figure(t, cam);
  desk(cam);
  ctx.restore();
}

/* ───────────── crimson world ───────────── */
function crimson(t, x, y, w, h, o = {}) {
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  const z = o.z ?? (1.02 + 0.03 * Math.sin(t * 0.21)), dx = noise(t * 0.15, 61) * 18, dy = noise(t * 0.15, 62) * 18;
  const cx = x + w / 2, cy = y + h / 2, sw = 1080 * z * Math.max(w / 1080, h / 1920), sh = 1920 * z * Math.max(w / 1080, h / 1920);
  ctx.drawImage(TEX.crimson, cx - sw / 2 + dx, cy - sh / 2 + dy - (o.lift ?? 0), sw, sh);
  ctx.restore();
}
/** soft bloom sprite (the one glow in a shot) */
function bloom(x, y, r, col, a = 1) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save(); ctx.globalAlpha *= a; ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.restore();
}

/* a vintage skeleton key, drawn bow at the origin, pointing up (-y). len = overall length */
function key(len, o = {}) {
  const hot = o.hot ?? 0, s = len / 600;
  ctx.save(); ctx.scale(s, s);
  if (hot > 0) { bloom(0, -280, 360, `rgba(255,120,30,${0.42 * hot})`); bloom(0, 0, 200, `rgba(255,200,130,${0.55 * hot})`); }
  const metal = ctx.createLinearGradient(-30, 0, 30, 0);
  if (hot > 0.5) { metal.addColorStop(0, '#ffbe80'); metal.addColorStop(0.5, '#fffdf6'); metal.addColorStop(1, '#ff9a4a'); }
  else { metal.addColorStop(0, o.dim ? '#55555c' : '#7c7c84'); metal.addColorStop(0.45, o.dim ? '#a8a8ae' : '#f1f1f4'); metal.addColorStop(1, o.dim ? '#3e3e44' : '#6a6a72'); }
  ctx.strokeStyle = metal; ctx.fillStyle = metal; ctx.lineJoin = 'round';
  if (!o.flat) { ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 10; }
  // bow: a trefoil of three rings round a centre ring
  ctx.lineWidth = 22;
  for (const [cx, cy] of [[-52, 6], [52, 6], [0, 60]]) { ctx.beginPath(); ctx.arc(cx, cy, 44, 0, Math.PI * 2); ctx.stroke(); }
  ctx.lineWidth = 12; ctx.beginPath(); ctx.arc(0, 18, 18, 0, Math.PI * 2); ctx.stroke();
  // collars + shaft
  ctx.fillRect(-22, -74, 44, 30); ctx.fillRect(-28, -90, 56, 16); ctx.fillRect(-16, -560, 32, 490);
  ctx.fillRect(-24, -400, 48, 14); ctx.fillRect(-24, -160, 48, 14);
  // bit with wards
  ctx.beginPath(); ctx.moveTo(12, -566); ctx.lineTo(118, -566); ctx.lineTo(118, -540); ctx.lineTo(84, -540); ctx.lineTo(84, -518); ctx.lineTo(118, -518); ctx.lineTo(118, -492); ctx.lineTo(96, -492); ctx.lineTo(96, -470); ctx.lineTo(12, -470); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.arc(0, -566, 14, 0, 7); ctx.fill();
  ctx.restore();
}

/* the hand holding the key ring (code stand-in; a real photo cut-out would beat it: see the asset list) */
function hand(x, y, s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = '#16100e'; ctx.beginPath(); ctx.moveTo(40, 300); ctx.bezierCurveTo(90, 420, 140, 560, 170, 760); ctx.lineTo(380, 760); ctx.bezierCurveTo(330, 560, 250, 400, 170, 260); ctx.closePath(); ctx.fill();
  const sk = ctx.createLinearGradient(-60, 0, 160, 0); sk.addColorStop(0, '#5b3622'); sk.addColorStop(0.5, '#8a5638'); sk.addColorStop(1, '#4a2b1b');
  ctx.fillStyle = sk;
  ctx.beginPath(); ctx.moveTo(-40, 40); ctx.bezierCurveTo(-60, 140, -10, 250, 40, 320); ctx.lineTo(180, 280); ctx.bezierCurveTo(150, 190, 120, 90, 80, 10); ctx.closePath(); ctx.fill();
  for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(-30 + i * 34, 30 - i * 6, 26, 40, -0.3, 0, 7); ctx.fill(); }
  ctx.beginPath(); ctx.ellipse(92, 40, 22, 52, 0.5, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(255,190,140,0.25)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(100, 30); ctx.bezierCurveTo(140, 120, 160, 200, 176, 280); ctx.stroke();
  ctx.restore();
}
