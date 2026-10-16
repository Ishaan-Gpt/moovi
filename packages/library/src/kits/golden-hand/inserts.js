// R3 "Golden Hand": a moss-stone hand holding a dial with a white star (the chapter dial, labelled in blackletter),
// a dark starry ground for the top panels, the Master File and its mind-map, bullet lists with software chips,
// website and thumbnail cards with hand labels, an icon flow, a phone b-roll stand-in, the gold hook title.
'use strict';
const P3 = { night: '#16100c', gold: '#e8b04a', goldHot: '#fff0c8', moss: '#6b6a3a', mossDark: '#3a3a1e', cream: '#f2ede0', folder: '#e8b84a' };
const BL = 'UnifrakturCook';
const CHAPTERS = ['Shortform Editing', 'Web Design', 'Thumbnail Design', 'UGC Videos', 'Social Media Manager'];

function buildTextures3() {
  // night ground: warm black with grain; stars are drawn live (they twinkle)
  const n = makeCanvas(1080, 1920), g = n.getContext('2d');
  const base = g.createRadialGradient(540, 700, 60, 540, 900, 1300); base.addColorStop(0, '#2a1d15'); base.addColorStop(1, '#0b0705');
  g.fillStyle = base; g.fillRect(0, 0, 1080, 1920);
  const d = g.getImageData(0, 0, 1080, 1920), px = d.data;
  for (let i = 0, k = 0; i < px.length; i += 4, k++) { const v = (rand(k + 301) - 0.5) * 18; px[i] += v; px[i + 1] += v * 0.9; px[i + 2] += v * 0.8; }
  g.putImageData(d, 0, 0); TEX.night = n;
  // moss stone: olive mottling, khaki flecks, dark pits (the hand's material)
  const m = makeCanvas(1024, 1024), q = m.getContext('2d');
  q.fillStyle = P3.moss; q.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 900; i++) {
    const x = rand(i * 3 + 11) * 1024, y = rand(i * 3 + 12) * 1024, r = 6 + rand(i * 3 + 13) * 60, v = rand(i + 900);
    q.fillStyle = v > 0.66 ? 'rgba(200,190,120,0.18)' : v > 0.33 ? 'rgba(40,40,15,0.22)' : 'rgba(150,150,80,0.16)';
    q.beginPath(); q.ellipse(x, y, r, r * (0.5 + rand(i) * 0.6), rand(i + 5) * 3, 0, 7); q.fill();
  }
  const md = q.getImageData(0, 0, 1024, 1024), mp = md.data;
  for (let i = 0, k = 0; i < mp.length; i += 4, k++) { const v = (rand(k + 77) - 0.5) * 40; mp[i] += v; mp[i + 1] += v; mp[i + 2] += v * 0.6; }
  q.putImageData(md, 0, 0); TEX.moss = m;
}
function night(t, box = [0, 0, 1080, 1920]) {
  const [x, y, w, h] = box; ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.drawImage(TEX.night, x, y - (1920 - h) / 2, 1080, 1920);
  for (let i = 0; i < 40; i++) { // stars: a few twinkle with a four-point glint
    const sx = x + rand(i * 7 + 1) * w, sy = y + rand(i * 7 + 2) * h, tw = 0.4 + 0.6 * Math.max(0, Math.sin(t * (1 + rand(i) * 2) + i));
    ctx.fillStyle = `rgba(255,248,230,${0.35 + 0.5 * tw})`; ctx.beginPath(); ctx.arc(sx, sy, 1.5 + rand(i + 3) * 2, 0, 7); ctx.fill();
    if (i % 6 === 0) { ctx.strokeStyle = `rgba(255,248,230,${0.5 * tw})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(sx - 12 * tw, sy); ctx.lineTo(sx + 12 * tw, sy); ctx.moveTo(sx, sy - 12 * tw); ctx.lineTo(sx, sy + 12 * tw); ctx.stroke(); }
  }
  ctx.restore();
}
const bl = (px, w = 400) => { ctx.font = `${w} ${px}px ${BL}, serif`; };

/* ───────────── the stone hand + dial ───────────── */
function stoneHand(s) { // palm up, fingers spread, in the hand's own space (palm centre at 0,0)
  ctx.save(); ctx.scale(s, s);
  const path = new Path2D();
  path.ellipse(0, 60, 330, 360, 0, 0, Math.PI * 2);
  [[-250, -330, -0.32, 90, 330], [-95, -470, -0.1, 92, 380], [70, -470, 0.08, 92, 380], [225, -360, 0.28, 86, 320]].forEach(([fx, fy, r, fw, fh]) => {
    const p = new Path2D(); p.roundRect(-fw / 2, -fh / 2, fw, fh, fw / 2);
    const m = new DOMMatrix().translate(fx, fy).rotate(r * 57.3); path.addPath(p, m);
  });
  const th = new Path2D(); th.roundRect(-55, -150, 110, 300, 55); path.addPath(th, new DOMMatrix().translate(-330, 150).rotate(-48));
  ctx.save(); ctx.clip(path); ctx.drawImage(TEX.moss, -560, -720, 1120, 1300);
  const sh = ctx.createRadialGradient(-80, -120, 50, 0, 60, 640); sh.addColorStop(0, 'rgba(255,240,200,0.18)'); sh.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = sh; ctx.fillRect(-700, -800, 1400, 1600); ctx.restore();
  ctx.restore();
}
function star5(R, glow = 0.5) { // a bevelled white star: lit and shaded facets
  ctx.save(); ctx.shadowColor = `rgba(255,250,235,${glow})`; ctx.shadowBlur = 40;
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + i * 2 * Math.PI / 5, b = a + Math.PI / 5, c = a - Math.PI / 5, r2 = R * 0.38;
    for (const [side, ang] of [[0, b], [1, c]]) {
      ctx.fillStyle = side ? '#c9c2b2' : P3.cream; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R); ctx.lineTo(Math.cos(ang) * r2, Math.sin(ang) * r2); ctx.closePath(); ctx.fill();
    }
  }
  ctx.restore();
}
/**
 * The chapter dial. n = chapter index lit (0..4); shown = how many labels exist; rot = the dial's turn so the lit label
 * sits to the right of the star. z = camera zoom into the dial (1 = whole hand in frame).
 */
function dial(t, o) {
  const { n, shown, cx = 540, cy = 1010, z = 1, rise = 1, all = false } = o;
  ctx.save(); ctx.translate(cx, cy + (1 - rise) * 1300); ctx.scale(z, z);
  stoneHand(1.15);
  const R = 400; // the disc in the palm
  ctx.fillStyle = 'rgba(20,16,10,0.88)'; ctx.beginPath(); ctx.arc(0, 60, R, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(255,240,210,0.22)'; ctx.lineWidth = 2;
  for (const r of [R * 0.48, R * 0.72, R * 0.95]) { ctx.beginPath(); ctx.arc(0, 60, r, 0, 7); ctx.stroke(); }
  const target = all ? 0 : -(n * 2 * Math.PI / 5), turn = o.turn ?? target;
  for (let i = 0; i < shown; i++) {
    const a = -Math.PI / 2 + i * 2 * Math.PI / 5 + turn + (all ? 0 : -0.32);
    const lx = Math.cos(a) * R * 0.74, ly = 60 + Math.sin(a) * R * 0.74, lit = all || i === n;
    ctx.save(); ctx.translate(lx, ly); bl(all ? 30 : lit ? 42 : 30); ctx.textAlign = 'center';
    ctx.fillStyle = lit ? P3.cream : 'rgba(242,237,224,0.45)'; if (lit && !all) { ctx.shadowColor = 'rgba(255,240,200,0.6)'; ctx.shadowBlur = 18; }
    ctx.fillText(`${i + 1}. ${CHAPTERS[i]}`, 0, 0); ctx.restore();
  }
  ctx.save(); ctx.translate(0, 60); ctx.rotate(o.spin ?? 0); star5(R * 0.42, 0.6); ctx.restore();
  ctx.restore();
}

/* ───────────── top panels on the night ground ───────────── */
function folder(x, y, s, open = 0) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); shade(true, 24, 0.5, 10);
  ctx.fillStyle = '#c99a32'; ctx.beginPath(); ctx.roundRect(-90, -60, 80, 30, 8); ctx.fill(); ctx.fillRect(-90, -45, 180, 20);
  ctx.fillStyle = '#f2f2ee'; for (let i = 0; i < 2; i++) { ctx.save(); ctx.rotate(-0.08 + i * 0.12 + open * (i ? 0.25 : -0.2)); ctx.fillRect(-60 + i * 20, -60 - open * 30, 110, 90); ctx.restore(); }
  const g = ctx.createLinearGradient(0, -40, 0, 60); g.addColorStop(0, '#f6c95a'); g.addColorStop(1, P3.folder); ctx.fillStyle = g;
  ctx.beginPath(); ctx.roundRect(-90, -35, 180, 100, 10); ctx.fill(); shade(false);
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = `600 20px ${F.sans}`; ctx.textAlign = 'center'; ctx.fillText('Master File', 0, 20); ctx.restore();
}
function doc(x, y, s, label) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); shade(true, 12, 0.4, 4); ctx.fillStyle = '#f4f4f2';
  ctx.beginPath(); ctx.moveTo(-34, -44); ctx.lineTo(18, -44); ctx.lineTo(34, -28); ctx.lineTo(34, 44); ctx.lineTo(-34, 44); ctx.closePath(); ctx.fill(); shade(false);
  ctx.strokeStyle = '#bbb'; ctx.lineWidth = 3; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-20, -18 + i * 14); ctx.lineTo(20, -18 + i * 14); ctx.stroke(); }
  ctx.fillStyle = '#e8e2d6'; ctx.font = `600 20px ${F.sans}`; ctx.textAlign = 'center'; ctx.fillText(label, 0, 76); ctx.restore();
}
function cursorAt(x, y, press) { ctx.save(); ctx.translate(x, y); ctx.scale(1 - press * 0.15, 1 - press * 0.15); ctx.fillStyle = '#fff'; ctx.strokeStyle = '#111'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 46); ctx.lineTo(12, 34); ctx.lineTo(22, 54); ctx.lineTo(30, 50); ctx.lineTo(20, 30); ctx.lineTo(36, 30); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); }
const PANELS3 = {
  master(t, s) {
    const fa = s.ats.folder, k = spring(t - fa, 'pop'), click = s.ats.click;
    const lift = E.out(prog(t, s.ats.docs[0], 0.4));
    if (t >= fa) folder(540, 420 - lift * 120, 1.4 * k, lift);
    if (t >= click - 0.5 && t < click + 0.4) { const p = clamp((t - click + 0.5) / 0.5), press = Math.max(0, 1 - Math.abs(t - click) * 8); cursorAt(lerp(760, 560, E.out(p)), lerp(640, 440, E.out(p)), press); }
    s.ats.docs.forEach((a, i) => { if (t < a) return; const dk = spring(t - a, 'pop'); doc(lerp(540, [380, 700][i], dk), lerp(420, 640, dk), 1.2 * dk, ['How to Learn', 'Get More Clients'][i]); });
  },
  bullets(t, s) {
    bl(70); ctx.fillStyle = P3.cream; ctx.textAlign = 'left'; const tk = E.out(prog(t, s.t0, 0.3)); ctx.globalAlpha = tk; ctx.fillText(s.title, 120, 230); ctx.globalAlpha = 1;
    s.items.forEach((it, i) => {
      if (t < it.at) return; const k = E.out(prog(t, it.at, 0.3)), y = 330 + i * 70;
      ctx.save(); ctx.globalAlpha = k; ctx.translate((1 - k) * -20, 0); ctx.fillStyle = '#e8e2d6'; ctx.font = `600 36px ${F.sans}`; ctx.textAlign = 'left'; ctx.fillText('•  ' + it.s, 120, y);
      if (it.chips) it.chips.forEach(([lab, col], j) => { const ck = spring(t - it.at - 0.1 - j * 0.08, 'pop'); ctx.save(); ctx.translate(470 + j * 76, y - 13); ctx.scale(ck, ck); ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(-30, -26, 60, 52, 10); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = `800 26px ${F.sans}`; ctx.textAlign = 'center'; ctx.fillText(lab, 0, 9); ctx.restore(); });
      ctx.restore();
    });
  },
  sites(t, s) {
    s.items.forEach((it, i) => {
      if (t < it.at) return; const k = spring(t - it.at, 'firm'), x = 80 + i * 320, y = 280;
      ctx.save(); ctx.translate(x + 140, y + 100); ctx.scale(k, k); ctx.translate(-(x + 140), -(y + 100));
      shade(true, 30, 0.5, 10); ctx.fillStyle = '#0d1020'; ctx.beginPath(); ctx.roundRect(x, y, 280, 200, 14); ctx.fill(); shade(false);
      const g = ctx.createRadialGradient(x + 140, y + 120, 10, x + 140, y + 120, 140); g.addColorStop(0, ['#3b5bdb', '#7c3aed', '#d4a017'][i]); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(x, y, 280, 200);
      ctx.fillStyle = '#fff'; ctx.font = `700 16px ${F.sans}`; ctx.textAlign = 'center'; ctx.fillText(['6 YEARS of experience in 3 months', 'What you\'ll learn', 'WHY THIS COHORT?'][i], x + 140, y + 34);
      for (let j = 0; j < 3; j++) { ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(x + 40, y + 70 + j * 30, 200 - j * 40, 10); }
      bl(30); ctx.fillStyle = P3.cream; ctx.fillText(it.s, x + 140, y + 250); ctx.restore();
    });
  },
  textCard(t, s) {
    const k = E.out(prog(t, s.t0, 0.4)); ctx.save(); ctx.globalAlpha = k; ctx.translate(0, (1 - k) * 30);
    ctx.fillStyle = '#fff'; ctx.font = `800 34px ${F.sans}`; ctx.textAlign = 'left'; ctx.fillText(s.title, 100, 170);
    const lines = ['1. Understand the purpose of the website: leads, sales, showcase?', '2. Good aesthetics are fine; the user journey is the key.', '3. Time premium: most clients pay 20-50% more for speed.', '4. Cut long-term maintenance costs; every 1% compounds.', '5. Plain sites sometimes sell a lot more than pretty ones.'];
    lines.forEach((l, i) => { const lk = E.out(prog(t, s.t0 + 0.2 + i * 0.25, 0.3)); ctx.globalAlpha = k * lk; wrap(l, 48).forEach((w, j) => { ctx.fillStyle = '#e8e2d6'; ctx.font = `500 26px ${F.sans}`; ctx.fillText(w, 100, 230 + i * 120 + j * 34); }); });
    ctx.restore();
  },
  thumbs(t, s) {
    const card = (x, y, good, k) => {
      ctx.save(); ctx.translate(x + 200, y + 150); ctx.scale(k, k); ctx.translate(-(x + 200), -(y + 150));
      shade(true, 30, 0.5, 10); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(x, y, 400, 330, 10); ctx.fill(); shade(false);
      const g = ctx.createLinearGradient(x, y, x + 400, y + 230); g.addColorStop(0, good ? '#3a8a3a' : '#1a2a8a'); g.addColorStop(1, good ? '#9ac46a' : '#c0281e'); ctx.fillStyle = g; ctx.fillRect(x + 10, y + 10, 380, 220);
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x + (good ? 150 : 200), y + 120, 50, 0, 7); ctx.fill(); ctx.strokeStyle = '#d33'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x + (good ? 150 : 200), y + 120, 36, 0.4, 2.6); ctx.stroke();
      if (!good) { ctx.fillStyle = '#fff'; ctx.font = `400 46px ${F.cond}`; ctx.textAlign = 'left'; ctx.fillText('AERO BALL', x + 30, y + 64); } else person(x + 300, y + 60, 0.3, { body: '#222', skin: '#c08a62', seed: 6 });
      ctx.fillStyle = '#111'; ctx.font = `600 24px ${F.sans}`; ctx.textAlign = 'left'; ctx.fillText(good ? 'This ball is impossible to hit' : 'Aero ball physics', x + 14, y + 270); ctx.fillStyle = '#888'; ctx.font = `500 18px ${F.sans}`; ctx.fillText(good ? '41M views' : '2 views', x + 14, y + 300);
      ctx.restore();
    };
    const good = t >= s.ats.good, at = good ? s.ats.good : s.t0, k = spring(t - at, 'firm');
    card(340, 270, good, k);
    const lk = E.out(prog(t, at + 0.15, 0.3)); ctx.save(); ctx.globalAlpha = lk; ctx.fillStyle = '#fff'; ctx.font = `600 26px ${F.sans}`; ctx.textAlign = 'left';
    ctx.fillText(good ? '• Good Thumbnail' : '• Bad Thumbnail', 330, 240); ctx.fillText(good ? 'Good Title' : 'Weak Title', 690, 660); ctx.restore();
    handArrow(560, 225, 640, 268, [20, -30], E.ramp(prog(t, at + 0.2, 0.35)), '#fff', 4); handArrow(680, 650, 640, 610, [-30, 10], E.ramp(prog(t, at + 0.3, 0.35)), '#fff', 4);
  },
  flow(t, s) {
    s.items.forEach((it, i) => {
      if (t < it.at) return; const k = spring(t - it.at, 'pop'), x = 260 + i * 280, y = 460;
      ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
      if (it.icon === 'clap') { ctx.fillStyle = '#f2f2ee'; ctx.fillRect(-40, -20, 80, 56); ctx.save(); ctx.rotate(-0.25); ctx.fillRect(-40, -44, 80, 18); ctx.restore(); ctx.fillStyle = '#111'; for (let j = 0; j < 4; j++) ctx.fillRect(-34 + j * 20, -40, 8, 14); }
      if (it.icon === 'social') { const g = ctx.createLinearGradient(-40, 40, 40, -40); g.addColorStop(0, '#f9a23a'); g.addColorStop(0.5, '#e1306c'); g.addColorStop(1, '#833ab4'); ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(-44, -44, 88, 88, 22); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 7; ctx.beginPath(); ctx.roundRect(-26, -26, 52, 52, 14); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, 12, 0, 7); ctx.stroke(); }
      if (it.icon === 'folder') { ctx.restore(); folder(x, y + 10, 0.7 * k); ctx.save(); ctx.translate(x, y); }
      ctx.fillStyle = '#e8e2d6'; ctx.font = `600 22px ${F.sans}`; ctx.textAlign = 'center'; ctx.fillText(it.s, 0, 90); ctx.restore();
      if (i) { ctx.save(); ctx.setLineDash([8, 8]); ctx.lineDashOffset = -t * 30; ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - 220, y); ctx.lineTo(x - 220 + 160 * E.out(prog(t, it.at - 0.1, 0.3)), y); ctx.stroke(); ctx.restore(); }
    });
  },
  people(t, s) {
    const one = spring(t - s.t0, 'pop');
    const pers = (x, y, k, many) => { ctx.save(); ctx.translate(x, y); ctx.scale(k, k); ctx.fillStyle = '#f2f2ee'; const draw = (dx, sc) => { ctx.beginPath(); ctx.arc(dx, -30 * sc, 24 * sc, 0, 7); ctx.fill(); ctx.beginPath(); ctx.ellipse(dx, 34 * sc, 46 * sc, 34 * sc, 0, Math.PI, 0); ctx.fill(); }; if (many) { draw(-50, 0.75); draw(50, 0.75); draw(0, 0.9); } else draw(0, 1); ctx.restore(); };
    pers(s.ats.two ? lerp(540, 330, E.out(prog(t, s.ats.two, 0.4))) : 540, 440, one, false);
    if (t >= s.ats.label) { ctx.fillStyle = '#e8e2d6'; ctx.font = `600 24px ${F.sans}`; ctx.textAlign = 'center'; ctx.fillText('Tried Content Creation', s.ats.two && t >= s.ats.two ? lerp(540, 330, E.out(prog(t, s.ats.two, 0.4))) : 540, 540); }
    if (t >= s.ats.two) { const k = spring(t - s.ats.two - 0.15, 'pop'); pers(760, 440, k, true); ctx.save(); ctx.globalAlpha = k; ctx.fillStyle = '#fff'; ctx.font = `800 40px ${F.sans}`; ctx.textAlign = 'center'; ctx.fillText('>', 545, 450); ctx.font = `600 24px ${F.sans}`; ctx.fillText('Freshers', 760, 540); ctx.restore(); }
  },
  mindmap(t, s) {
    folder(540, 470, 1.0, 0);
    const pts = [[260, 250], [820, 250], [260, 700], [820, 700]], labels = ['How to Learn?', 'How to Reach out?', 'How much to charge?', 'Whom to Reach out?'];
    s.ats.forEach((a, i) => {
      if (t < a) return; const k = E.out(prog(t, a, 0.35)), [x, y] = pts[i];
      ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(540, 470); ctx.lineTo(lerp(540, x, k), lerp(470, y, k)); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(lerp(540, x, k), lerp(470, y, k), 7, 0, 7); ctx.fill();
      ctx.globalAlpha = E.out(prog(t, a + 0.2, 0.25)); ctx.font = `600 28px ${F.sans}`; ctx.textAlign = 'center'; ctx.fillText(labels[i], x, y + (y < 470 ? -24 : 46)); ctx.restore();
    });
  },
  folderOnly(t, s) { const k = spring(t - s.t0, 'pop'); folder(540, 480, 1.7 * k, 0.4 + 0.2 * Math.sin(t * 2)); },
  dialPanel(t, s) { dial(t, { n: 4, shown: 5, cx: 540, cy: 540, z: 0.62, all: true, spin: t * 0.05 }); },
};
function wrap(s, n) { const out = []; let cur = ''; for (const w of s.split(' ')) { if ((cur + ' ' + w).trim().length > n) { out.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); } if (cur) out.push(cur); return out; }

/* ───────────── the gold hook title and skill tiles ───────────── */
/** the gold hook lockup; o = { over, word, under } (the reference's words are passed in, never baked) */
function goldTitle(t, at, sub, o = { over: 'MAKE YOUR', word: 'FIRST WIN', under: 'BEFORE THE YEAR ENDS' }) {
  const k = E.out(prog(t, at, 0.4)), flick = t - at < 0.25 ? (Math.sin((t - at) * 90) > 0 ? 1 : 0.4) : 1;
  ctx.save(); ctx.globalAlpha = k * flick; ctx.textAlign = 'center';
  bloom(540, 250, 420, 'rgba(255,170,60,0.22)');
  const g = ctx.createLinearGradient(0, 120, 0, 330); g.addColorStop(0, P3.goldHot); g.addColorStop(0.5, P3.gold); g.addColorStop(1, '#9a5a14');
  bl(64); { const w = ctx.measureText(o.over).width; if (w > 560) bl(64 * 560 / w); } ctx.fillStyle = '#f3dcae'; shade(true, 20, 0.6, 4); ctx.fillText(o.over, 540, 190);
  bl(140); { const w = ctx.measureText(o.word).width; if (w > 900) bl(140 * 900 / w); } ctx.fillStyle = g; ctx.fillText(o.word, 540, 320);
  if (sub && t >= sub) { ctx.globalAlpha = k * E.out(prog(t, sub, 0.3)); bl(30); ctx.fillStyle = '#e8c78a'; ctx.fillText(o.under, 540, 370); }
  ctx.restore();
}
function skillTiles(t, at, goneAt) {
  const pos = [[330, 1150], [540, 1150], [750, 1150], [430, 1340], [650, 1340]], icons = ['play', 'code', 'image', 'phone', 'people'];
  for (let i = 0; i < 5; i++) {
    const a = stagger(at, i, 0.07, 41), k = spring(t - a, 'pop'); if (t < a) continue;
    const out = E.in(prog(t, goneAt, 0.25)); const [x, y] = pos[i];
    ctx.save(); ctx.translate(x, y + Math.sin(t * 1.5 + i) * 5); ctx.scale(k * (1 - out), k * (1 - out));
    bloom(0, 0, 130, 'rgba(255,170,60,0.3)'); ctx.fillStyle = 'rgba(30,20,8,0.82)'; ctx.strokeStyle = P3.gold; ctx.lineWidth = 5; ctx.shadowColor = P3.gold; ctx.shadowBlur = 18;
    ctx.beginPath(); ctx.roundRect(-78, -78, 156, 156, 24); ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0;
    ctx.strokeStyle = P3.goldHot; ctx.fillStyle = P3.goldHot; ctx.lineWidth = 6; ctx.beginPath();
    if (icons[i] === 'play') { ctx.roundRect(-32, -26, 64, 46, 8); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-8, -12); ctx.lineTo(12, -2); ctx.lineTo(-8, 8); ctx.fill(); }
    if (icons[i] === 'code') { ctx.moveTo(-14, -24); ctx.lineTo(-34, -2); ctx.lineTo(-14, 20); ctx.moveTo(14, -24); ctx.lineTo(34, -2); ctx.lineTo(14, 20); ctx.moveTo(6, -28); ctx.lineTo(-6, 24); ctx.stroke(); }
    if (icons[i] === 'image') { ctx.roundRect(-32, -26, 64, 50, 8); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-24, 16); ctx.lineTo(-4, -6); ctx.lineTo(10, 8); ctx.lineTo(20, -2); ctx.lineTo(28, 16); ctx.fill(); }
    if (icons[i] === 'phone') { ctx.roundRect(-18, -32, 36, 62, 8); ctx.stroke(); }
    if (icons[i] === 'people') { ctx.arc(0, -12, 12, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(-24, -6, 9, 0, 7); ctx.arc(24, -6, 9, 0, 7); ctx.fill(); ctx.beginPath(); ctx.ellipse(0, 22, 26, 14, 0, Math.PI, 0); ctx.fill(); }
    ctx.fillStyle = '#f3dcae'; ctx.font = `700 20px ${F.sans}`; ctx.textAlign = 'center'; ctx.fillText(`Skill ${i + 1}`, 0, 56);
    ctx.restore();
  }
}
/* ───────────── b-roll stand-in: hands holding a phone, filming a subject (a real clip would beat this) ───────────── */
function phoneBroll(t, s) {
  const z = logLerp(1, 1.08, prog(t, s.t0, s.t1 - s.t0));
  ctx.save(); ctx.translate(540, 960); ctx.scale(z, z); ctx.translate(-540, -960);
  const g = ctx.createLinearGradient(0, 0, 1080, 1920); g.addColorStop(0, '#3a4a5a'); g.addColorStop(1, '#1a1410'); ctx.fillStyle = g; ctx.fillRect(0, 0, 1080, 1920);
  ctx.save(); ctx.filter = 'blur(14px)'; person(700, 700, 1.6, { body: '#8a5a8a', skin: '#c99a72', hair: '#3a2a20', seed: 8 }); ctx.restore();
  ctx.save(); ctx.translate(640, 1150); ctx.rotate(0.08); shade(true, 40, 0.6, 20); ctx.fillStyle = '#111'; ctx.beginPath(); ctx.roundRect(-210, -420, 420, 840, 50); ctx.fill(); shade(false);
  ctx.save(); ctx.beginPath(); ctx.roundRect(-190, -400, 380, 800, 38); ctx.clip(); ctx.fillStyle = '#5a6a7a'; ctx.fillRect(-190, -400, 380, 800); person(0, -150, 0.8, { body: '#8a5a8a', skin: '#c99a72', hair: '#3a2a20', seed: 8 });
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(0, 330, 36, 0, 7); ctx.stroke(); ctx.fillStyle = (t * 2) % 1 < 0.5 ? '#e33' : '#a22'; ctx.beginPath(); ctx.arc(0, 330, 26, 0, 7); ctx.fill(); ctx.restore();
  ctx.fillStyle = '#b07a52'; ctx.beginPath(); ctx.ellipse(-230, 100, 70, 150, 0.2, 0, 7); ctx.ellipse(230, 160, 70, 150, -0.2, 0, 7); ctx.fill(); ctx.restore();
  ctx.restore();
  standIn(36, 1880, 'b-roll stand-in');
  s.words.forEach((w, i) => slam(t, w.s, 70, 640 + i * 190, w.at, { px: 200, maxW: 700, S0: 1.4, align: 'left' }));
}
