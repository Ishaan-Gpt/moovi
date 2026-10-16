// R2 inserts: photo stand-ins with hand labels, an article card, the paper world (reveal poster, orbit, CRUSH YOU that
// shatters), floating project cards, the neon level world (hands holding the level's orb, a coin flip between
// levels), white-grid UI boards with lime stickers, head icons, the black lime punch. Pure functions of t.
'use strict';
const P2 = {
  paper: '#efede8', paperInk: '#141414', red: '#d8262f', lime: '#d6ff3a', limeInk: '#121212',
  violet: '#7c3aed', violetHot: '#b57bff', night: '#090616', board: '#f7f7f8', grid: 'rgba(20,20,40,0.05)',
};
const LEVELS = ['Landing Page', 'Simple Web Apps', 'Full-Stack Web App', 'Interactive Game', 'AI-Powered SaaS'];

/* ───────────── textures for this edit ───────────── */
function buildTextures2() {
  const c = makeCanvas(1080, 1920), g = c.getContext('2d');
  g.fillStyle = P2.paper; g.fillRect(0, 0, 1080, 1920);
  const d = g.getImageData(0, 0, 1080, 1920), px = d.data;
  for (let i = 0, n = 0; i < px.length; i += 4, n++) { const v = (rand(n + 5) - 0.5) * 14; px[i] += v; px[i + 1] += v; px[i + 2] += v; }
  g.putImageData(d, 0, 0);
  const vg = g.createRadialGradient(540, 900, 300, 540, 960, 1250); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(60,50,40,0.28)');
  g.fillStyle = vg; g.fillRect(0, 0, 1080, 1920); TEX.paper = c;
  const b = makeCanvas(1080, 1920), q = b.getContext('2d');
  q.fillStyle = P2.board; q.fillRect(0, 0, 1080, 1920); q.strokeStyle = P2.grid; q.lineWidth = 2;
  for (let x = 0; x <= 1080; x += 54) { q.beginPath(); q.moveTo(x, 0); q.lineTo(x, 1920); q.stroke(); }
  for (let y = 0; y <= 1920; y += 54) { q.beginPath(); q.moveTo(0, y); q.lineTo(1080, y); q.stroke(); }
  const fade = q.createRadialGradient(540, 960, 200, 540, 960, 1100); fade.addColorStop(0, 'rgba(247,247,248,0)'); fade.addColorStop(1, 'rgba(247,247,248,0.9)');
  q.fillStyle = fade; q.fillRect(0, 0, 1080, 1920); TEX.board = b;
}
function ground(tex, t, z0 = 1.02) {
  const z = z0 + 0.025 * Math.sin(t * 0.2), dx = noise(t * 0.15, 71) * 14, dy = noise(t * 0.15, 72) * 14;
  ctx.drawImage(tex, 540 - 540 * z + dx, 960 - 960 * z + dy, 1080 * z, 1920 * z);
}

/* ───────────── small drawn pieces ───────────── */
function card(x, y, w, h, o = {}) { // a floating UI card: soft shadow, radius, fill
  ctx.save(); shade(true, o.blur ?? 46, o.a ?? 0.28, o.dy ?? 18); ctx.fillStyle = o.fill ?? '#fff';
  ctx.beginPath(); ctx.roundRect(x, y, w, h, o.r ?? 26); ctx.fill(); shade(false);
  if (o.stroke) { ctx.strokeStyle = o.stroke; ctx.lineWidth = 2; ctx.stroke(); }
  ctx.restore();
}
function txt(s, x, y, px, o = {}) { ctx.save(); ctx.font = `${o.w ?? 600} ${px}px ${o.fam ?? F.sans}`; ctx.textAlign = o.align ?? 'left'; ctx.fillStyle = o.fill ?? '#111'; if (o.italic) ctx.font = `italic ${px}px ${F.serif}`; ctx.fillText(s, x, y); ctx.restore(); }
/** a hand-drawn arrow that draws itself (k 0..1), a soft curve with a two-stroke head */
function handArrow(x0, y0, x1, y1, bend, k, col = '#fff', w = 6) {
  if (k <= 0) return;
  const cx = (x0 + x1) / 2 + bend[0], cy = (y0 + y1) / 2 + bend[1], N = 30, n = Math.ceil(N * k);
  const P = i => { const u = i / N; return [(1 - u) ** 2 * x0 + 2 * (1 - u) * u * cx + u * u * x1, (1 - u) ** 2 * y0 + 2 * (1 - u) * u * cy + u * u * y1]; };
  ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; shade(true, 10, 0.4, 2);
  ctx.beginPath(); for (let i = 0; i <= n; i++) { const [x, y] = P(i); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
  if (k >= 0.98) { const [ax, ay] = P(N), [bx, by] = P(N - 3), a = Math.atan2(ay - by, ax - bx); for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax - Math.cos(a + s * 0.5) * 34, ay - Math.sin(a + s * 0.5) * 34); ctx.stroke(); } }
  ctx.restore();
}
/** a lime sticker label (black condensed caps on a lime box), stamped on with a spring */
function sticker(t, s, x, y, at, o = {}) {
  if (t < at) return; const k = spring(t - at, 'pop'), px = o.px ?? 92;
  ctx.save(); ctx.translate(x, y); ctx.rotate((o.rot ?? -0.02) * (2 - k)); ctx.scale(k, k);
  font(px, 400, F.cond); const w = tw_(s) + px * 0.36, h = px * 1.04;
  shade(true, 18, 0.25, 6); ctx.fillStyle = P2.lime; ctx.fillRect(-w / 2, -h * 0.78, w, h); shade(false);
  ctx.fillStyle = P2.limeInk; ctx.textAlign = 'center'; ctx.fillText(s, 0, 0); ctx.restore();
}
/** a stand-in person: a code silhouette (a real photo cut-out would beat it; see the asset list) */
function person(x, y, s, o = {}) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  const body = o.body ?? '#2b2d33', skin = o.skin ?? '#a8754f', hair = o.hair ?? '#18120f';
  ctx.fillStyle = body; ctx.beginPath(); ctx.moveTo(-170, 900); ctx.lineTo(-160, 260); ctx.bezierCurveTo(-150, 150, -60, 120, 0, 118); ctx.bezierCurveTo(60, 120, 150, 150, 160, 260); ctx.lineTo(170, 900); ctx.fill();
  if (o.tank) { ctx.fillStyle = skin; ctx.fillRect(-160, 150, 40, 300); ctx.fillRect(120, 150, 40, 300); }
  ctx.fillStyle = skin; ctx.fillRect(-28, 70, 56, 70); ctx.beginPath(); ctx.ellipse(0, 10, 70, 88, 0, 0, 7); ctx.fill();
  ctx.fillStyle = hair; ctx.beginPath(); ctx.ellipse(0, -40, 78, o.bald ? 30 : 52, 0, Math.PI, Math.PI * 2.05); ctx.fill();
  if (!o.bald) for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.arc(-60 + i * 20, -70 + rand(i + (o.seed ?? 1)) * 14, 22, 0, 7); ctx.fill(); }
  if (o.letters) { ctx.fillStyle = '#d8c79a'; ctx.font = `700 34px ${F.serif}`; ctx.textAlign = 'center'; ctx.fillText(o.letters, 0, 260); }
  ctx.restore();
}
function face(x, y, s) { person(x, y, s, { body: '#1c1c22', skin: '#c08a62', seed: 9 }); }
/** stand-in tag: says plainly that a real photo goes here */
function standIn(x, y, s = 'photo stand-in') { ctx.save(); ctx.font = `600 22px ${F.sans}`; ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.textAlign = 'left'; ctx.fillText(s, x, y); ctx.restore(); }

/* ───────────── 1. photo inserts (two people in a gym), colour and black & white with a hand label ───────────── */
function photo(t, s) {
  const bw = s.bw, z = logLerp(1.0, 1.06, E.lin(prog(t, s.t0, s.t1 - s.t0 + 0.6)));
  ctx.save(); ctx.translate(540, 960); ctx.scale(z, z); ctx.translate(-540, -960);
  const g = ctx.createLinearGradient(0, 0, 0, 1920); g.addColorStop(0, bw ? '#5a5a5a' : '#6b6f78'); g.addColorStop(0.6, bw ? '#3a3a3a' : '#3e4048'); g.addColorStop(1, bw ? '#1d1d1d' : '#22232a');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 1080, 1920);
  // gym: racks and a wall graphic, out of focus
  ctx.save(); ctx.filter = 'blur(6px)'; ctx.fillStyle = bw ? 'rgba(20,20,20,0.6)' : 'rgba(18,20,26,0.6)';
  for (let i = 0; i < 6; i++) ctx.fillRect(40 + i * 180, 700 + rand(i) * 80, 26, 700); ctx.fillRect(0, 980, 1080, 22);
  ctx.fillStyle = bw ? 'rgba(230,230,230,0.25)' : 'rgba(220,230,255,0.22)'; ctx.font = `400 300px ${F.cond}`; ctx.fillText('GYM', 120, 420); ctx.restore();
  person(380, 760, 1.45, { body: bw ? '#2a2a2a' : '#3b4252', tank: true, bald: true, skin: bw ? '#9a9a9a' : '#b98a68', seed: 2 });
  person(720, 790, 1.4, { body: bw ? '#3a3a3a' : '#2d3446', skin: bw ? '#a5a5a5' : '#c08a62', seed: 5 });
  if (bw) { ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(0, 0, 1080, 1920); }
  ctx.restore();
  standIn(36, 1880);
  if (bw) {
    // the hand label: the name written on, an arrow drawing down to him
    const la = s.labelAt ?? s.t0 + 0.05, k = E.out(prog(t, la, 0.3));
    ctx.save(); ctx.globalAlpha = k; ctx.translate(640, 300 + (1 - k) * 20); ctx.rotate(-0.06); font(110, 400, F.cond); ctx.fillStyle = '#fff'; shade(true, 16, 0.5, 4); ctx.textAlign = 'center'; ctx.fillText('THE FOUNDER', 0, 0); ctx.restore();
    handArrow(860, 330, 760, 560, [120, 10], E.ramp(prog(t, la + 0.15, 0.45)));
    if (s.appAt && t >= s.appAt) { const a = spring(t - s.appAt, 'pop'); ctx.save(); ctx.translate(300, 1180); ctx.scale(a, a); card(-60, -60, 120, 120, { fill: '#2a2a30', r: 30, a: 0.5 }); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 6, 26, 0, 7); ctx.fill(); ctx.beginPath(); ctx.ellipse(10, -28, 8, 16, 0.6, 0, 7); ctx.fill(); ctx.restore(); }
  }
}

/* ───────────── 2. article card over the speaker (the headline is the proof) ───────────── */
function article(t, b) {
  const k = spring(t - b.t0, 'firm'), grow = E.ramp(prog(t, b.growAt, 0.5));
  const x = lerp(30, 230, grow), y = lerp(420, 400, grow), w = lerp(400, 620, grow), sc = w / 400;
  ctx.save(); ctx.translate(x + w / 2, y + 260 * sc); ctx.rotate(lerp(-0.05, -0.01, grow) * (2 - k)); ctx.scale(k, k); ctx.translate(-(x + w / 2), -(y + 260 * sc));
  card(x, y, w, 520 * sc, { r: 6, a: 0.4 });
  ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
  txt('VOL. 18 · ISSUE 50', 22, 34, 12, { w: 600, fill: '#888' });
  ['how this 18', 'year old', 'built an AI app', 'to $50M and', 'sold it.'].forEach((l, i) => {
    if (i === 3 && t >= b.hiAt) { const hk = E.out(prog(t, b.hiAt, 0.3)); ctx.fillStyle = '#ffe83a'; ctx.fillRect(18, 96 + i * 38 - 30, 230 * hk, 38); }
    txt(l, 22, 96 + i * 38, 34, { w: 500, fam: F.sans, fill: '#111' });
  });
  ctx.fillStyle = '#2b2b30'; ctx.fillRect(250, 60, 130, 170); person(315, 120, 0.22, { body: '#111', skin: '#a8754f', seed: 4 });
  for (let i = 0; i < 6; i++) { ctx.fillStyle = '#d4d4d8'; ctx.fillRect(22, 300 + i * 22, 340 - (i % 3) * 40, 8); }
  ctx.restore(); ctx.restore();
}

/* ───────────── 3. the paper world: reveal poster, orbit, CRUSH YOU (shatters) ───────────── */
function reveal(t, s) {
  ground(TEX.paper, t);
  const lines = [['THE FOUNDER', s.t0 + 0.02], ['HIMSELF', s.wordAt[0]], ['REVEALED', s.wordAt[1]]];
  lines.forEach(([w, a], i) => slam(t, w, 540, 820 + i * 230, a, { px: 260, maxW: 820, S0: 1.4, fill: P2.red, shadow: false }));
  const fa = s.wordAt[1] + 0.1; if (t >= fa) { const k = spring(t - fa, 'pop'); ctx.save(); ctx.translate(540, 930); ctx.scale(k, k); ctx.beginPath(); ctx.arc(0, 0, 170, 0, 7); ctx.clip(); ctx.fillStyle = '#e8dccb'; ctx.fillRect(-170, -170, 340, 340); face(0, -20, 1.0); ctx.restore(); }
}
function orbit(t, s) {
  ground(TEX.paper, t);
  const cx = 540, cy = 860, R = 290, k = E.out(prog(t, s.t0, 0.5));
  ctx.save(); ctx.strokeStyle = '#1b1b1b'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cx, cy, R * k, 0, 7); ctx.stroke(); ctx.restore();
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, 110, 0, 7); ctx.clip(); ctx.fillStyle = '#e8dccb'; ctx.fillRect(cx - 110, cy - 110, 220, 220); face(cx, cy - 10, 0.66); ctx.restore();
  const glyph = ['spark', 'knot', 'arrow', 'play'];
  for (let i = 0; i < 4; i++) {
    const at = stagger(s.iconsAt, i, 0.12, 21), a = spring(t - at, 'pop'); if (t < at) continue;
    const ang = -Math.PI / 2 + i * Math.PI / 2 + (t - s.t0) * 0.35;
    const x = cx + Math.cos(ang) * R, y = cy + Math.sin(ang) * R;
    ctx.save(); ctx.translate(x, y); ctx.scale(a, a); ctx.fillStyle = '#1b1b1b'; shade(true, 16, 0.35, 6); ctx.beginPath(); ctx.arc(0, 0, 50, 0, 7); ctx.fill(); shade(false);
    ctx.strokeStyle = '#fff'; ctx.fillStyle = '#fff'; ctx.lineWidth = 6; ctx.beginPath();
    if (glyph[i] === 'spark') { for (let j = 0; j < 4; j++) { ctx.moveTo(0, 0); ctx.lineTo(Math.cos(j * Math.PI / 2) * 24, Math.sin(j * Math.PI / 2) * 24); } ctx.stroke(); }
    if (glyph[i] === 'knot') { ctx.arc(-8, 0, 14, 0, 7); ctx.moveTo(22, 0); ctx.arc(8, 0, 14, 0, 7); ctx.stroke(); }
    if (glyph[i] === 'arrow') { ctx.moveTo(-18, 18); ctx.lineTo(18, -18); ctx.lineTo(18, 10); ctx.closePath(); ctx.fill(); }
    if (glyph[i] === 'play') { ctx.roundRect(-20, -16, 40, 32, 6); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-6, -8); ctx.lineTo(10, 0); ctx.lineTo(-6, 8); ctx.fill(); }
    ctx.restore();
  }
}
function crush(t, s) {
  ground(TEX.paper, t);
  // five dots fall in like a hand placing them, then the badge and the words; on "future" everything shatters right
  const sh = s.shatterAt, shk = E.in(prog(t, sh, 0.5));
  for (let i = 0; i < 5; i++) {
    const at = stagger(s.t0, i, 0.09, 31), k = spring(t - at, 'firm'); if (t < at || t > s.crushAt) continue;
    const x = 540 + [-60, 60, 70, -60, 0][i], y = 860 + [-70, -40, 60, 80, 170][i];
    ctx.fillStyle = '#1d1d1d'; ctx.beginPath(); ctx.arc(x, y - (1 - k) * 200, 22, 0, 7); ctx.fill();
  }
  if (t >= s.badgeAt && t < sh + 0.6) { const k = spring(t - s.badgeAt, 'pop'); ctx.save(); ctx.globalAlpha = 1 - shk; ctx.translate(540, 640); ctx.scale(k, k); ctx.fillStyle = '#1d1d1d'; ctx.beginPath(); ctx.arc(0, 0, 54, 0, 7); ctx.fill(); txt('AI', 0, 18, 48, { w: 800, align: 'center', fill: '#fff' }); ctx.restore(); }
  if (t < sh) {
    slam(t, 'CRUSH', 540, 980, s.crushAt, { px: 250, maxW: 520, S0: 1.4, fill: '#1d1d1d', shadow: false });
    slam(t, 'YOU', 540, 1180, s.youAt, { px: 250, maxW: 380, S0: 1.4, fill: '#1d1d1d', shadow: false });
  } else {
    // shards: the words break into seeded flakes that blow right and spin
    for (let i = 0; i < 260; i++) {
      const sx = 400 + rand(i * 3) * 300, sy = 800 + rand(i * 3 + 1) * 400, delay = (sx - 400) / 300 * 0.15;
      const k = E.in(prog(t, sh + delay, 0.7)), dx = k * (500 + rand(i + 7) * 600), dy = k * (rand(i + 9) - 0.6) * 500;
      ctx.save(); ctx.translate(sx + dx, sy + dy); ctx.rotate(k * (rand(i) * 8 - 4)); ctx.globalAlpha = 1 - k * 0.8; ctx.fillStyle = '#1d1d1d';
      const sz = 8 + rand(i + 11) * 22; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(sz, sz * 0.3); ctx.lineTo(sz * 0.4, sz); ctx.fill(); ctx.restore();
    }
    ctx.save(); ctx.globalAlpha = 1 - shk; ctx.beginPath(); ctx.rect(0, 0, 400 + 300 * (1 - shk), 1920); ctx.clip();
    slam(t, 'CRUSH', 540, 980, s.crushAt, { px: 250, maxW: 520, S0: 1.4, fill: '#1d1d1d', shadow: false }); slam(t, 'YOU', 540, 1180, s.youAt, { px: 250, maxW: 380, S0: 1.4, fill: '#1d1d1d', shadow: false });
    ctx.restore();
  }
}

/* ───────────── 4. project cards floating beside the head, each with its hand label and arrow ───────────── */
function projects(t, b) {
  const items = [
    { at: b.ats[0], label: 'PROJECT 2', draw: tasksUI },
    { at: b.ats[1], label: 'PROJECT 3', draw: linksUI },
    { at: b.ats[2], label: 'PROJECT 5??', draw: (x, y, w, h) => { ctx.save(); ctx.filter = 'blur(10px)'; linksUI(x, y, w, h); ctx.restore(); } },
  ];
  const cur = items.filter(i => t >= i.at).pop(); if (!cur) return;
  const i = items.indexOf(cur), k = spring(t - cur.at, 'firm'), x = 30, y = 130 - (1 - k) * 80;
  ctx.save(); ctx.globalAlpha = clamp((t - cur.at) * 8); ctx.translate(x + 200, y + 260); ctx.rotate((1 - k) * -0.08); ctx.translate(-(x + 200), -(y + 260));
  card(x, y, 400, 520, { r: 22 }); ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, 400, 520, 22); ctx.clip(); cur.draw(x, y, 400, 520); ctx.restore();
  ctx.restore();
  const lk = E.out(prog(t, cur.at + 0.1, 0.25));
  ctx.save(); ctx.globalAlpha = lk; font(64, 400, F.cond); ctx.fillStyle = '#fff'; shade(true, 14, 0.5, 3); ctx.textAlign = 'left'; ctx.fillText(cur.label, 560, 230); ctx.restore();
  handArrow(700, 260, 450, 330, [-20, 70], E.ramp(prog(t, cur.at + 0.2, 0.4)));
}
function tasksUI(x, y) {
  txt('My Tasks', x + 24, y + 54, 34, { w: 700 }); txt('Stay focused. Get things done.', x + 24, y + 84, 16, { w: 500, fill: '#777' });
  [['3', 'TASKS'], ['3', 'REMAINING'], ['0', 'COMPLETED']].forEach(([n, l], i) => { ctx.strokeStyle = '#e4e4e7'; ctx.lineWidth = 2; ctx.strokeRect(x + 24 + i * 120, y + 110, 108, 80); txt(n, x + 36 + i * 120, y + 150, 28, { w: 700 }); txt(l, x + 36 + i * 120, y + 176, 11, { w: 600, fill: '#999' }); });
  ctx.strokeStyle = '#e4e4e7'; ctx.strokeRect(x + 24, y + 220, 352, 260); txt('What do you need to get done?', x + 40, y + 256, 15, { w: 500, fill: '#aaa' });
  ['Personal', 'Medium', 'Due date'].forEach((l, i) => { ctx.fillStyle = '#f4f4f5'; ctx.fillRect(x + 40, y + 290 + i * 50, 320, 36); txt(l, x + 52, y + 314 + i * 50, 15, { w: 500, fill: '#555' }); });
  ctx.fillStyle = '#18181b'; ctx.beginPath(); ctx.roundRect(x + 40, y + 440, 120, 30, 8); ctx.fill(); txt('+ Add Task', x + 56, y + 461, 14, { w: 600, fill: '#fff' });
}
function linksUI(x, y) {
  ctx.fillStyle = '#111'; ctx.beginPath(); ctx.roundRect(x + 24, y + 26, 36, 36, 8); ctx.fill(); txt('LinkPage', x + 70, y + 52, 18, { w: 700 });
  ctx.fillStyle = '#111'; ctx.beginPath(); ctx.roundRect(x + 300, y + 30, 76, 30, 15); ctx.fill(); txt('Sign in', x + 312, y + 51, 13, { w: 600, fill: '#fff' });
  txt('ONE LINK FOR EVERYTHING', x + 24, y + 130, 12, { w: 600, fill: '#888' });
  txt('All your links.', x + 24, y + 175, 36, { w: 700 }); txt('One clean page.', x + 24, y + 218, 36, { w: 700 });
  for (let i = 0; i < 3; i++) { ctx.fillStyle = '#d4d4d8'; ctx.fillRect(x + 24, y + 250 + i * 22, 330 - i * 50, 8); }
  ctx.fillStyle = '#111'; ctx.beginPath(); ctx.roundRect(x + 24, y + 340, 352, 50, 25); ctx.fill(); txt('Continue with Google', x + 120, y + 372, 17, { w: 600, fill: '#fff' });
}

/* ───────────── 5. the neon level world: two hands hold the current level's orb; the row of levels below ───────────── */
function neonHand(side, t) {
  ctx.save(); ctx.translate(540 + side * 330, 760); ctx.scale(side, 1); ctx.rotate(-0.2 + Math.sin(t * 0.9) * 0.03);
  const g = ctx.createLinearGradient(0, -260, 0, 360); g.addColorStop(0, 'rgba(150,90,255,0.95)'); g.addColorStop(1, 'rgba(70,30,180,0.4)');
  ctx.strokeStyle = g; ctx.lineWidth = 16; ctx.lineCap = 'round'; ctx.shadowColor = P2.violetHot; ctx.shadowBlur = 40;
  ctx.beginPath(); ctx.moveTo(210, 420); ctx.quadraticCurveTo(160, 220, 150, 120); // wrist
  for (let f = 0; f < 4; f++) { ctx.moveTo(150 - f * 6, 120 - f * 10); ctx.quadraticCurveTo(120 - f * 22, -40 - f * 40, 40 - f * 18, -120 - f * 30 + f * f * 8); }
  ctx.moveTo(140, 140); ctx.quadraticCurveTo(60, 150, 30, 60); ctx.stroke();
  ctx.restore();
}
function levelWorld(t, s) {
  const g = ctx.createRadialGradient(540, 860, 40, 540, 860, 1300); g.addColorStop(0, '#2a1260'); g.addColorStop(0.45, '#120a35'); g.addColorStop(1, P2.night);
  ctx.fillStyle = g; ctx.fillRect(0, 0, 1080, 1920);
  bloom(540, 760, 620, 'rgba(140,80,255,0.35)');
  // concentric rings of light behind the orb
  ctx.save(); ctx.strokeStyle = 'rgba(160,110,255,0.18)'; ctx.lineWidth = 3; for (let r = 260; r < 900; r += 110) { ctx.beginPath(); ctx.arc(540, 860, r + Math.sin(t + r) * 6, 0, 7); ctx.stroke(); } ctx.restore();
  const n = s.n, d = t - s.t0;
  // the hands close in on the orb
  const hk = E.out(prog(t, s.t0, 0.5));
  ctx.save(); ctx.globalAlpha = hk; ctx.translate((1 - hk) * 0, 0); neonHand(-1, t); neonHand(1, t); ctx.restore();
  // the coin: this level's number flips up out of the row and turns into the orb
  const flip = prog(t, s.t0 + 0.05, 0.55), fx = lerp(rowX(n, n), 540, E.ramp(flip)), fy = lerp(1300, 760, E.ramp(flip));
  const turn = Math.cos(E.ramp(flip) * Math.PI * 3), R = lerp(56, 150, E.ramp(flip));
  ctx.save(); ctx.translate(fx, fy); ctx.scale(Math.max(0.06, Math.abs(turn)), 1);
  const og = ctx.createRadialGradient(-R * 0.3, -R * 0.4, 4, 0, 0, R); og.addColorStop(0, '#c49bff'); og.addColorStop(0.55, P2.violet); og.addColorStop(1, '#3b1490');
  ctx.shadowColor = P2.violetHot; ctx.shadowBlur = 60 * flip; ctx.fillStyle = og; ctx.beginPath(); ctx.arc(0, 0, R, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, R - 6, 0, 7); ctx.stroke();
  if (flip < 0.6) { font(lerp(70, 150, flip), 800); ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.fillText(String(n + 1), 0, lerp(24, 50, flip)); }
  else { ctx.globalAlpha = E.out(prog(flip, 0.6, 0.4)); LEVELS[n].split(' ').reduce((rows, w) => { const r = rows[rows.length - 1]; if (r && (r + ' ' + w).length <= 11) rows[rows.length - 1] = r + ' ' + w; else rows.push(w); return rows; }, []).forEach((l, i, a) => txt(l, 0, 14 + (i - (a.length - 1) / 2) * 46, 40, { w: 800, align: 'center', fill: '#fff' })); }
  ctx.restore();
  // the row: done levels shrink to small labelled discs on the left, the rest wait as numbered discs
  for (let i = 0; i < 5; i++) {
    if (i === n) continue;
    const x = rowX(i, n), done = i < n, r = done ? 46 : 56;
    ctx.save(); ctx.translate(x, 1300); const pk = spring(d - 0.1 - i * 0.04, 'firm'); ctx.scale(pk, pk);
    ctx.fillStyle = done ? '#3a1a7a' : P2.violet; ctx.shadowColor = P2.violetHot; ctx.shadowBlur = done ? 10 : 24; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
    if (done) LEVELS[i].split(' ').forEach((w, j, a) => txt(w, 0, 6 + (j - (a.length - 1) / 2) * 16, 13, { w: 700, align: 'center', fill: '#e9ddff' }));
    else txt(String(i + 1), 0, 20, 52, { w: 800, align: 'center', fill: '#fff' });
    ctx.restore();
  }
}
const rowX = (i, n) => (i < n ? 110 + i * 120 : 540 + (i - n) * 150 + (n === 0 ? -150 : 0) + (i > n ? 60 : 0));

/* ───────────── 6. white-grid boards: UI cards and lime stickers ───────────── */
function board(t, s) {
  ground(TEX.board, t, 1.0);
  const B = BOARDS[s.p]; if (B) B(t, s);
}
const BOARDS = {
  l1(t, s) {
    const a = spring(t - s.t0, 'firm'), b = spring(t - s.t0 - 0.12, 'firm');
    ctx.save(); ctx.translate(0, (1 - a) * 300); card(60, 760, 430, 420, { fill: '#121318', r: 22 });
    txt('Where ideas become reality', 275, 830, 22, { w: 600, align: 'center', fill: '#fff' });
    ['Web App', 'Mobile App', 'Website'].forEach((l, i) => { ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(84 + i * 130, 858, 118, 34, 17); ctx.stroke(); txt(l, 143 + i * 130, 881, 15, { w: 600, align: 'center', fill: '#cfd0d8' }); });
    ctx.fillStyle = '#1d1f27'; ctx.beginPath(); ctx.roundRect(84, 912, 382, 170, 14); ctx.fill();
    const prompt = 'Build a landing page: a clean modern hero, product cards, pricing, benefits, testimonials';
    const n = Math.floor(clamp((t - s.t0 - 0.3) / 1.4) * prompt.length); const lines = wrap(prompt.slice(0, n), 34);
    lines.forEach((l, i) => txt(l, 100, 946 + i * 26, 17, { w: 500, fill: '#e6e6ee' }));
    ctx.restore();
    ctx.save(); ctx.translate(0, (1 - b) * 300); card(560, 720, 460, 520, { r: 18 });
    txt('AQUA', 592, 774, 20, { w: 500, fam: F.serif, fill: '#333', italic: true }); ctx.fillStyle = '#111'; ctx.beginPath(); ctx.roundRect(900, 752, 96, 32, 16); ctx.fill(); txt('Buy Now', 948, 774, 14, { w: 600, align: 'center', fill: '#fff' });
    txt('Your body is', 592, 880, 46, { italic: true }); txt('70% water.', 592, 932, 46, { italic: true });
    txt('Start acting like', 592, 990, 46, { italic: true, fill: '#3b5bdb' }); txt('it.', 592, 1042, 46, { italic: true, fill: '#3b5bdb' });
    ctx.restore();
    sticker(t, 'TWEAKING,', 260, 1290, s.ats[0], { px: 96 }); sticker(t, 'HOSTING', 800, 1290, s.ats[1], { px: 96, rot: 0.02 });
  },
  cta(t, s) {
    const a = spring(t - s.t0, 'firm'), b = spring(t - s.t0 - 0.14, 'firm');
    ctx.save(); ctx.translate(0, (1 - a) * 260); card(50, 720, 470, 300, { fill: '#121318', r: 18 });
    wrap('Should I create the two test accounts with sample links so you can try it right away?', 38).forEach((l, i) => txt(l, 80, 776 + i * 30, 19, { w: 500, fill: '#e6e6ee' }));
    txt('Yes', 80, 900, 19, { w: 700, fill: '#fff' }); ctx.fillStyle = '#3b5bdb'; ctx.beginPath(); ctx.roundRect(80, 950, 160, 36, 8); ctx.fill(); txt('Design Agent', 160, 974, 16, { w: 600, align: 'center', fill: '#fff' });
    ctx.restore();
    ctx.save(); ctx.translate(0, (1 - b) * 260); card(560, 640, 470, 620, { r: 18 }); ctx.save(); ctx.beginPath(); ctx.roundRect(560, 640, 470, 620, 18); ctx.clip(); ctx.translate(560 + 35, 640 + 30); ctx.scale(1.0, 1.0); linksUI(0, 0); ctx.restore(); ctx.restore();
    const ca = s.ats[0];
    if (t >= ca) { wordLine(t, [{ s: 'Comment', at: ca }], 540, 1330, { px: 64, w: 800, fill: '#111', shadow: false }); sticker(t, '“GUIDE”', 540, 1500, ca + 0.18, { px: 170, rot: 0 }); }
  },
  game(t, s) {
    // tic-tac-toe on "Tic-Tac-Toe", then three Flappy frames: the score ticks, then game over
    const tt = s.ats[0], fb = s.ats[1];
    if (t < fb) {
      const a = spring(t - s.t0, 'firm'); ctx.save(); ctx.translate(540, 960); ctx.scale(a, a); card(-280, -200, 560, 400, { fill: '#050505', r: 18 }); ctx.strokeStyle = '#fff'; ctx.lineWidth = 6;
      for (const v of [-60, 60]) { ctx.beginPath(); ctx.moveTo(v, -150); ctx.lineTo(v, 150); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-180, v); ctx.lineTo(180, v); ctx.stroke(); }
      const xk = E.out(prog(t, tt + 0.2, 0.25)); ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(-40, 80); ctx.lineTo(-40 + 80 * xk, 80 + 80 * xk); ctx.moveTo(40, 80); ctx.lineTo(40 - 80 * xk, 80 + 80 * xk); ctx.stroke(); ctx.restore();
      return;
    }
    for (let i = 0; i < 3; i++) {
      const at = fb + i * 0.5, a = spring(t - at, 'firm'); if (t < at) continue;
      const x = 70 + i * 330, y = 640;
      ctx.save(); ctx.translate(x + 150, y + 330); ctx.scale(a, a); ctx.translate(-(x + 150), -(y + 330));
      card(x, y, 300, 660, { fill: '#55c3f0', r: 18, a: 0.35 }); ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, 300, 660, 18); ctx.clip();
      ctx.fillStyle = '#e6d48a'; ctx.fillRect(x, y + 580, 300, 80); ctx.fillStyle = '#7ccb4a'; ctx.fillRect(x, y + 560, 300, 24);
      for (const [px, gap] of [[x + 70, 220], [x + 230, 300]]) { ctx.fillStyle = '#5cbf3a'; ctx.fillRect(px, y, 50, gap); ctx.fillRect(px, y + gap + 190, 50, 560 - gap - 190); ctx.fillStyle = '#3f9a28'; ctx.fillRect(px - 6, y + gap - 24, 62, 24); ctx.fillRect(px - 6, y + gap + 190, 62, 24); }
      const by = y + 300 + Math.sin((t - at) * 6) * 20; ctx.fillStyle = '#ffd23a'; ctx.beginPath(); ctx.ellipse(x + 130, by, 20, 16, 0, 0, 7); ctx.fill();
      if (i < 2) txt(String(i), x + 150, y + 80, 64, { w: 800, align: 'center', fill: '#fff' });
      else { card(x + 30, y + 220, 240, 200, { r: 16 }); txt('Game Over', x + 150, y + 270, 30, { w: 800, align: 'center', fill: '#e2453a' }); txt('1   1', x + 150, y + 330, 34, { w: 800, align: 'center' }); ctx.fillStyle = '#2fb35a'; ctx.beginPath(); ctx.roundRect(x + 60, y + 360, 180, 40, 20); ctx.fill(); txt('Play Again', x + 150, y + 387, 18, { w: 700, align: 'center', fill: '#fff' }); }
      ctx.restore(); ctx.restore();
    }
  },
  tool(t, s) {
    const a = spring(t - s.t0, 'firm'), b = spring(t - s.ats[0], 'firm');
    ctx.save(); ctx.translate(0, (1 - a) * 200); card(50, 760, 460, 260, { fill: '#08080a', r: 14 }); const sp = (t * 4) % (Math.PI * 2);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(280, 890, 18, sp, sp + 4.5); ctx.stroke(); ctx.restore();
    if (t >= s.ats[0]) { ctx.save(); ctx.translate(0, (1 - b) * 200); card(570, 760, 460, 260, { fill: '#08080a', r: 14 }); txt('Start with one prompt. You can change everything later.', 800, 810, 15, { w: 600, align: 'center', fill: '#fff' }); ctx.fillStyle = '#1b1c22'; ctx.beginPath(); ctx.roundRect(610, 840, 380, 110, 10); ctx.fill(); ctx.restore(); }
  },
};
function wrap(s, n) { const out = []; let cur = ''; for (const w of s.split(' ')) { if ((cur + ' ' + w).trim().length > n) { out.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); } if (cur) out.push(cur); return out; }

/* ───────────── 7. icons that pop around the head, the black lime punch, the desk dive ───────────── */
function headIcons(t, b) {
  const pos = [[150, 520], [540, 330], [930, 470]], kinds = ['user', 'data', 'idea'];
  b.ats.forEach((at, i) => {
    if (t < at) return; const k = spring(t - at, 'pop'), [x, y] = pos[i], fl = Math.sin((t - at) * 1.6 + i) * 8;
    ctx.save(); ctx.translate(x, y + fl); ctx.scale(k, k); ctx.fillStyle = '#f4f4f6'; shade(true, 20, 0.4, 6); ctx.beginPath(); ctx.arc(0, 0, 62, 0, 7); ctx.fill(); shade(false);
    ctx.strokeStyle = '#1b1b1f'; ctx.fillStyle = '#1b1b1f'; ctx.lineWidth = 6;
    if (kinds[i] === 'user') { ctx.beginPath(); ctx.arc(0, -10, 16, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 30, 28, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, 40, 0, 7); ctx.stroke(); }
    if (kinds[i] === 'data') { for (let j = 0; j < 3; j++) { ctx.beginPath(); ctx.ellipse(0, -20 + j * 18, 30, 10, 0, 0, 7); ctx.fill(); } }
    if (kinds[i] === 'idea') { ctx.beginPath(); ctx.arc(0, -8, 22, 0, 7); ctx.stroke(); ctx.fillRect(-10, 18, 20, 12); }
    ctx.restore();
  });
}
function punch(t, s) {
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 1080, 1920);
  const [r, b, d] = s.ats;
  if (t < b) { slam(t, 'REAL', 300, 880, r, { px: 230, maxW: 400, S0: 1.4, fill: P2.lime, shadow: false }); return; }
  slam(t, 'REAL BACKEND', 540, 880, r, { px: 230, maxW: 900, S0: 1.0, fill: P2.lime, shadow: false });
  wordLine(t, [{ s: 'and', at: b + 0.05 }], 540, 960, { px: 54, w: 800, fill: P2.lime, shadow: false });
  slam(t, 'DEPLOYMENT', 540, 1160, d, { px: 230, maxW: 900, S0: 1.4, fill: P2.lime, shadow: false });
}
