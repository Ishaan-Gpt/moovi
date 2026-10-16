// Crimson-world shots: the hero key-ring poster, the five chapter cards (each dives into ITS key on the ring),
// and the top-half panels. Each panel draws into a 1080x960 space; edit.js composites it with its entry transition.
'use strict';
const at = (w, after = 0, nth = 0) => WT(w, after, nth).t;

/* ───────────── hero poster ───────────── */
const RING = { x: 540, y: 1335 };
const FAN = [-1.05, -0.52, 0, 0.52, 1.05];     // final key angles on the ring
const KEYLEN = 360;
function lockup(t, o) { // Never / FORGET / Anything: a lit sign. o: {y, s, never, forget, anything, sub}
  ctx.save(); ctx.translate(540, o.y); ctx.scale(o.s, o.s);
  // one soft bloom behind the sign, igniting with FORGET
  const ign = o.forget == null ? 1 : flicker(t, o.forget);
  bloom(0, 0, 520, 'rgba(255,70,20,0.55)', ign);
  if (o.never != null) wordLine(t, [{ s: 'Never', at: o.never, fill: '#ffd6ae' }], 0, -215, { px: 64, w: 800, rise: 10, shadow: false });
  // FORGET: condensed, vertical heat gradient; dim until it ignites
  const px = fitCond('FORGET', 330, 640);
  const g = ctx.createLinearGradient(0, 100 - px * 0.74, 0, 100);
  g.addColorStop(0, '#fff2dc'); g.addColorStop(0.35, '#ffb070'); g.addColorStop(0.7, '#ff5a26'); g.addColorStop(1, '#d01a1c');
  ctx.save(); ctx.textAlign = 'center'; ctx.scale(0.7, 1.22);
  ctx.globalAlpha = lerp(0.18, 1, ign); ctx.fillStyle = ign > 0.02 ? g : '#5a0a0e';
  ctx.shadowColor = 'rgba(40,0,0,0.6)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 10;
  ctx.fillText('FORGET', 0, 100); ctx.restore();
  if (o.anything != null) wordLine(t, o.sub.map((s, i) => ({ s, at: o.anything + i * 0.07, fill: '#ffd6ae' })), 0, 178, { px: o.subPx ?? 46, w: 800, rise: 8, shadow: false });
  ctx.restore();
}
// a sign igniting: two short deterministic flickers, then on (with a small overshoot in brightness)
function flicker(t, t0) {
  const d = t - t0; if (d < 0) return 0;
  if (d < 0.05) return 0.7; if (d < 0.09) return 0.15; if (d < 0.13) return 0.9; if (d < 0.16) return 0.4;
  return clamp(0.85 + 0.15 * E.out(prog(d, 0.16, 0.3)));
}
function keyFan(t, open, o = {}) { // open: per-key progress array (spring values, may overshoot)
  // dial arcs + ticks behind the fan (rotating very slowly: the poster is never still)
  ctx.save(); ctx.translate(RING.x, RING.y);
  ctx.strokeStyle = 'rgba(255,170,140,0.16)'; ctx.lineWidth = 3;
  const rot = t * 0.01;
  for (const r of [500, 360]) { ctx.beginPath(); ctx.arc(0, 0, r, Math.PI * 1.06 + rot, Math.PI * 1.94 + rot); ctx.stroke(); }
  for (let i = 0; i <= 24; i++) { const a = Math.PI * 1.06 + rot + i * (Math.PI * 0.88 / 24); ctx.beginPath(); ctx.moveTo(Math.cos(a) * 500, Math.sin(a) * 500); ctx.lineTo(Math.cos(a) * (i % 4 ? 486 : 476), Math.sin(a) * (i % 4 ? 486 : 476)); ctx.stroke(); }
  ctx.restore();
  // keys: back ones first; the ring is shared
  for (let i = 0; i < 5; i++) {
    const a = FAN[i] * open[i];
    ctx.save(); ctx.translate(RING.x, RING.y + 40); ctx.rotate(a); key(KEYLEN, { dim: o.dimExcept != null && o.dimExcept !== i, hot: o.hotKey === i ? o.hot : 0 }); ctx.restore();
  }
  ctx.save(); ctx.strokeStyle = '#d6d6dc'; ctx.lineWidth = 13; ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 12;
  ctx.beginPath(); ctx.ellipse(RING.x, RING.y + 50, 64, 54, 0.2, 0, 7); ctx.stroke(); ctx.restore();
}
function keyLabels(t, t0) {
  for (let i = 0; i < 5; i++) {
    const a = FAN[i] * 1.04, r = 455, x = RING.x + Math.sin(a) * r, y = RING.y + 40 - Math.cos(a) * r * 1.0;
    const st = stagger(t0, [2, 1, 0, 3, 4][i], 0.09, 5);
    wordLine(t, [{ s: `Secret ${i + 1}`, at: st, fill: i === 2 ? '#ffe7cf' : 'rgba(255,214,190,0.8)' }], x, y, { px: 34, w: 700, rise: 10, shadow: false });
  }
}
function heroPoster(t, s0) {
  // shot camera: cut in on motion as a log-space pull-out from the FORGET close-up, then a slow drift (never still)
  const p = prog(t, s0, 1.15), u = 1 - Math.pow(1 - p, 4);
  const z = logPull(2.6, p) * (1 + 0.012 * (t - s0));
  const fx = lerp(640, 540, u), fy = lerp(470, 960, u);
  ctx.save(); ctx.translate(540, 960); ctx.scale(z, z); ctx.translate(-fx, -fy);
  crimson(t, -400, -400, 1880, 2720, { z: 1 });
  const open = FAN.map((_, i) => spring(t - stagger(s0 + 0.2, [2, 1, 3, 0, 4][i], 0.07, 9), 'pop'));
  hand(RING.x - 10, RING.y + 30, 1.05);
  keyFan(t, open);
  lockup(t, { y: 500, s: 1, never: at('never', 3), forget: at('forget', 3), anything: at('anything', 3.5), sub: ['Anything'] });
  keyLabels(t, s0 + 1.25);
  const by = at('by', 4.8);
  wordLine(t, ['By', 'the', 'end', 'of', 'this', 'video'].map((s, i) => ({ s, at: at(s.toLowerCase(), by - 0.05) - 0.02 || by + i * 0.12 })), 540, 800, { px: 38, w: 700, rise: 8, shadow: false });
  ctx.restore();
}
/* the finished poster, cached sharp and blurred, for the chapter cards */
function cachePoster() {
  const sharp = makeCanvas(1080, 1920), keep = ctx; ctx = sharp.getContext('2d');
  crimson(9, 0, 0, 1080, 1920, { z: 1 });
  hand(RING.x - 10, RING.y + 30, 1.05);
  keyFan(9, [1, 1, 1, 1, 1], { dimExcept: -1 });
  lockup(9, { y: 500, s: 1, anything: 0, sub: ['Anything', 'in', 'Your', 'Life'], subPx: 46 });
  keyLabels(9, 0);
  const blur = makeCanvas(540, 960), b = blur.getContext('2d');
  b.filter = 'blur(4.5px)'; b.drawImage(sharp, -30, -30, 600, 1020);
  ctx = keep; TEX.poster = sharp; TEX.posterBlur = blur;
}

/* ───────────── chapter cards: dive into the n-th key of the ring; that key lights ───────────── */
function keyTip(n) { const a = FAN[n]; return { x: RING.x + Math.sin(a) * KEYLEN * 0.55, y: RING.y + 40 - Math.cos(a) * KEYLEN * 0.55 }; }
function card(t, s) {
  const n = s.n, P = keyTip(n), d = t - s.t0, kind = s.tr;
  // camera: zoom on the key's middle, log-space; always drifting
  let z = 2.0 * (1 + 0.02 * d), fy = 820, blurK = 1, sharpA = 0, smear = 0;
  if (kind === 'dive') { const k = E.hard(prog(t, s.t0, 0.6)); z = logLerp(1, 2.0, k) * (1 + 0.02 * d); fy = lerp(960, 820, k); blurK = k; }
  if (kind === 'rack') { blurK = E.ramp(prog(t, s.t0, 0.5)); }
  if (kind === 'whip') { const k = E.hard(prog(t, s.t0, 0.42)); fy = lerp(1500, 820, k); smear = Math.abs(vel(tt => lerp(1500, 820, E.hard(prog(tt, s.t0, 0.42))), t)) * z; }
  if (kind === 'flash') { z *= logPull(1.18, E.out(prog(t, s.t0, 0.5))); }
  const fx = kind === 'dive' ? lerp(540, P.x, E.hard(prog(t, s.t0, 0.6))) : P.x;
  ctx.save(); ctx.translate(540, 960); ctx.scale(z, z); ctx.translate(-fx, -fy);
  // depth of field: the poster melts into the background, the chosen key stays sharp
  if (blurK < 1) { ctx.globalAlpha = 1; ctx.filter = `blur(${(blurK * 14 + 0.3).toFixed(1)}px)`; ctx.drawImage(TEX.poster, 0, 0); ctx.filter = 'none'; }
  if (blurK > 0) {
    ctx.globalAlpha = blurK < 1 ? blurK : 1;
    const g = smear > 2 ? Math.min(5, Math.ceil(shutter(smear) / 6)) : 0;
    ctx.drawImage(TEX.posterBlur, -60, -60, 1200, 2040);
    for (let i = 1; i <= g; i++) { ctx.globalAlpha = 0.22; ctx.drawImage(TEX.posterBlur, -60, -60 + i * smear * 0.12 / z, 1200, 2040); }
    ctx.globalAlpha = 1;
  }
  // darken the defocused world so the lit key reads (one bloom only: the key's)
  ctx.restore();
  const vg = ctx.createRadialGradient(540, 960, 200, 540, 960, 1250); vg.addColorStop(0, 'rgba(20,0,0,0.05)'); vg.addColorStop(1, 'rgba(10,0,0,0.6)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  // the chosen key, sharp and near (depth of field): it lands in log space and keeps turning a little
  const ANG = [-0.75, -0.35, 0, 0.45, 1.1], POS = [[640, 1430], [600, 1470], [540, 1520], [470, 1470], [430, 1330]];
  const kin = E.out(prog(t, s.t0 + (kind === 'dive' ? 0.38 : 0.03), 0.55));
  const heat = clamp(E.out(prog(t, s.t0 + (kind === 'dive' ? 0.4 : 0.1), 0.45))) * (0.94 + 0.06 * Math.sin(d * 4.2)), sway = noise(t * 0.6, n) * 0.035;
  const kz = logLerp(1.3, 1, kin) * (1 + 0.014 * d);
  ctx.save(); ctx.globalAlpha = clamp(kin * 4); ctx.translate(POS[n][0], POS[n][1]); ctx.scale(kz, kz); ctx.rotate(ANG[n] + sway + 0.08 * (1 - kin));
  key(560, { hot: heat, flat: true });
  ctx.restore();
  // the chapter name, word by word, above the key's bit
  const lx = 540, ly = n === 4 ? 880 : 830;
  s.label.forEach((line, li) => wordLine(t, line.split(' ').map((w, wi) => ({ s: w, at: s.t0 + 0.18 + li * 0.16 + wi * 0.07 + rand(wi + li * 9 + n) * 0.03, fill: '#ffe2a6' })), lx, ly + li * 62, { px: 54, w: 800, rise: 12, shadow: true, shadowA: 0.5 }));
}

/* ───────────── icons: dark enamel objects with a top light and a contact shadow ───────────── */
function enamel(fn, s) {
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 26 * s; ctx.shadowOffsetY = 14 * s;
  const g = ctx.createLinearGradient(0, -80 * s, 0, 80 * s); g.addColorStop(0, '#4a4a50'); g.addColorStop(0.35, '#151517'); g.addColorStop(1, '#050505');
  ctx.fillStyle = g; ctx.strokeStyle = g; fn(); ctx.restore();
}
const ICON = {
  person(s) { enamel(() => { ctx.beginPath(); ctx.arc(0, -40 * s, 34 * s, 0, 7); ctx.fill(); ctx.beginPath(); ctx.ellipse(0, 52 * s, 66 * s, 58 * s, 0, Math.PI, 0); ctx.fill(); }, s); },
  keypad(s, t, t0) {
    enamel(() => { ctx.beginPath(); ctx.roundRect(-58 * s, -58 * s, 116 * s, 116 * s, 18 * s); ctx.fill(); }, s);
    ctx.fillStyle = '#f2f2f2'; font(30 * s, 800); ctx.textAlign = 'center';
    ['1', '2', '3', '4'].forEach((c, i) => { const p = prog(t, t0 + 0.12 + i * 0.07, 0.12); ctx.globalAlpha = clamp(p * 3); ctx.fillText(c, (i % 2 ? 22 : -22) * s, (i < 2 ? -12 : 30) * s); });
    ctx.globalAlpha = 1;
  },
  doc(s, t, t0) {
    enamel(() => { ctx.beginPath(); ctx.moveTo(-44 * s, -60 * s); ctx.lineTo(24 * s, -60 * s); ctx.lineTo(48 * s, -36 * s); ctx.lineTo(48 * s, 60 * s); ctx.lineTo(-44 * s, 60 * s); ctx.closePath(); ctx.fill(); }, s);
    ctx.strokeStyle = '#d8d8dc'; ctx.lineWidth = 7 * s; ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) { const p = E.out(prog(t, t0 + 0.15 + i * 0.08, 0.25)); if (p <= 0) continue; ctx.beginPath(); ctx.moveTo(-24 * s, (-12 + i * 22) * s); ctx.lineTo((-24 + 52 * p) * s, (-12 + i * 22) * s); ctx.stroke(); }
    ctx.lineCap = 'butt';
  },
  desk(s) { enamel(() => { ctx.beginPath(); ctx.arc(-14 * s, -52 * s, 20 * s, 0, 7); ctx.fill(); ctx.beginPath(); ctx.roundRect(-36 * s, -30 * s, 36 * s, 58 * s, 10 * s); ctx.fill(); ctx.fillRect(-40 * s, 20 * s, 12 * s, 46 * s); ctx.fillRect(-6 * s, -6 * s, 72 * s, 12 * s); ctx.fillRect(56 * s, 0, 10 * s, 66 * s); ctx.fillRect(10 * s, 0, 8 * s, 66 * s); }, s); },
  stopwatch(s, t, t0) {
    enamel(() => { ctx.beginPath(); ctx.arc(0, 6 * s, 58 * s, 0, 7); ctx.fill(); ctx.fillRect(-12 * s, -70 * s, 24 * s, 20 * s); ctx.fillRect(34 * s, -50 * s, 14 * s, 14 * s); }, s);
    ctx.fillStyle = '#efefef'; ctx.beginPath(); ctx.arc(0, 6 * s, 46 * s, 0, 7); ctx.fill();
    // five minutes sweeping: a red sector grows, the hand ticks on the second (stepped like a real watch)
    const sweep = clamp((t - t0) / 1.9) * (Math.PI * 2 * 5 / 12), step = Math.floor(sweep / 0.1) * 0.1;
    ctx.fillStyle = '#e1262c'; ctx.beginPath(); ctx.moveTo(0, 6 * s); ctx.arc(0, 6 * s, 46 * s, -Math.PI / 2, -Math.PI / 2 + step); ctx.fill();
    ctx.strokeStyle = '#111'; ctx.lineWidth = 5 * s; ctx.beginPath(); ctx.moveTo(0, 6 * s); ctx.lineTo(Math.sin(step) * 40 * s, 6 * s - Math.cos(step) * 40 * s); ctx.stroke();
  },
  notebook(s, t, t0) {
    enamel(() => { ctx.beginPath(); ctx.roundRect(-56 * s, -62 * s, 112 * s, 124 * s, 12 * s); ctx.fill(); }, s);
    // the verb: "draw a rough diagram": boxes and an arrow sketch themselves on the page
    ctx.strokeStyle = '#d9d9de'; ctx.lineWidth = 5 * s; ctx.lineJoin = 'round';
    const segs = [[[-34, -36], [-4, -36], [-4, -12], [-34, -12], [-34, -36]], [[8, 10], [36, 10], [36, 36], [8, 36], [8, 10]], [[-18, -10], [-18, 22], [6, 22]]];
    segs.forEach((pts, i) => { const p = prog(t, t0 + 0.2 + i * 0.28, 0.32); if (p <= 0) return; drawPartial(pts.map(([x, y]) => [x * s, y * s]), E.out(p)); });
  },
};
function drawPartial(pts, k) {
  let L = 0; const seg = []; for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(l); L += l; }
  let left = L * k; ctx.beginPath(); ctx.moveTo(...pts[0]);
  for (let i = 1; i < pts.length && left > 0; i++) { const f = Math.min(1, left / seg[i - 1]); ctx.lineTo(lerp(pts[i - 1][0], pts[i][0], f), lerp(pts[i - 1][1], pts[i][1], f)); left -= seg[i - 1]; }
  ctx.stroke();
}
/** an icon popping in: spring with overshoot, rising, its shadow tightening as it lands */
function popIcon(t, kind, x, y, s, t0) {
  const k = spring(t - t0, 'pop'); if (t < t0) return 0;
  const fl = 1 + drift(t - t0 - 0.6, 0, 0, 1);
  ctx.save(); ctx.translate(x, y + (1 - Math.min(1, k)) * 40 + Math.sin((t - t0) * 1.6) * 3); ctx.scale(k * fl, k * fl); ctx.globalAlpha = clamp((t - t0) * 12);
  ICON[kind](s, t, t0); ctx.restore(); return k;
}
/** dashed connector drawing itself left to right with a soft lead dot */
function connector(t, x0, x1, y, t0, d = 0.35) {
  const k = E.out(prog(t, t0, d)); if (k <= 0) return;
  ctx.save(); ctx.strokeStyle = 'rgba(255,240,230,0.85)'; ctx.lineWidth = 4; ctx.setLineDash([12, 10]); ctx.lineDashOffset = -t * 30;
  ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(lerp(x0, x1, k), y); ctx.stroke(); ctx.restore();
}

/* ───────────── top-half panels (1080 x 960) ───────────── */
const PANELS = {
  icons3(t, s) {
    crimson(t, 0, 0, 1080, 960);
    lockup(t, { y: 372, s: 0.8, sub: ['Anything', 'in', 'Your', 'Life'], anything: s.t0 + 0.1, never: s.t0 - 1, forget: null, subPx: 46 });
    const items = [['names,', 'names', 'person', 300], ['numbers,', 'numbers', 'keypad', 540], ['read', 'anything you read', 'doc', 780]];
    items.forEach(([w, label, ic, x], i) => {
      const t0 = Math.max(s.t0 + 0.05, at(w, 6) - 0.12);
      if (i) connector(t, items[i - 1][3] + 90, x - 90, 730, t0 - 0.18, 0.3);
      if (popIcon(t, ic, x, 730, 1.3, t0)) wordLine(t, [{ s: label, at: t0 + 0.1 }], x, 860, { px: 30, w: 700, rise: 8, shadow: false });
    });
  },
  ritual(t, s) {
    crimson(t, 0, 0, 1080, 960);
    const items = [['after', 'desk', 250], ['5', 'stopwatch', 540], ['draw', 'notebook', 830]];
    items.forEach(([w, ic, x], i) => {
      const t0 = Math.max(s.t0 + 0.04, at(w, 16) - 0.1);
      if (i) connector(t, items[i - 1][2] + 100, x - 100, 560, t0 - 0.22, 0.3);
      popIcon(t, ic, x, 560, 1.55, t0);
    });
  },
  notes(t, s) {
    crimson(t, 0, 0, 1080, 960);
    [[-0.13, 330, 560, 0], [0.09, 760, 590, 1], [0.02, 545, 500, 2]].forEach(([r, x, y, i]) => {
      const t0 = stagger(s.t0 - 0.05, i, 0.16, 3), k = spring(t - t0, 'firm'); if (t < t0) return;
      const fall = (1 - k) * -700, rr = r + (1 - k) * (i % 2 ? 0.5 : -0.4);
      ctx.save(); ctx.translate(x + noise(t * 0.4, i) * 4, y + fall); ctx.rotate(rr + noise(t * 0.3, i + 5) * 0.01); paper(t, 0, 0, 430, 560, t0, i); ctx.restore();
    });
  },
  pure(t, s) {
    crimson(t, 0, 0, 1080, 960);
    wordLine(t, [{ s: 'The', at: s.t0 + 0.02 }], 540, 236, { px: 40, w: 800, shadow: false });
    const words = ['personal,', 'useful,', 'relevant,', 'emotional.'], lab = ['personal', 'useful', 'relevant', 'emotional'];
    const ats = words.map(w => at(w, 27)), xs = [228, 432, 642, 852];
    'PURE'.split('').forEach((c, i) => {
      const on = prog(t, ats[i] - 0.06, 0.18), next = i < 3 ? prog(t, ats[i + 1] - 0.06, 0.25) : 0;
      const lit = clamp(on - next * 0.55);
      // pressed like a key: the letter dips and springs back as it lights
      const press = t > ats[i] - 0.06 ? (1 - spring(t - ats[i] + 0.06, 'pop')) * 26 : 0;
      ctx.save(); ctx.translate(xs[i], 560 + press);
      if (lit > 0.01) bloom(0, -110, 260, 'rgba(255,255,255,0.28)', lit);
      font(300, 400, F.cond); ctx.textAlign = 'center';
      const g = ctx.createLinearGradient(0, -220, 0, 0); g.addColorStop(0, mixInk(lit, [214, 150, 156], [255, 255, 255])); g.addColorStop(1, mixInk(lit, [150, 92, 98], [235, 235, 240]));
      ctx.fillStyle = g; ctx.shadowColor = 'rgba(30,0,0,0.5)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 10; ctx.fillText(c, 0, 0);
      ctx.restore();
      wordLine(t, [{ s: lab[i], at: ats[i] }], xs[i], 790, { px: 34, w: 700, rise: 10, shadow: false });
    });
    wordLine(t, [{ s: 'Framework', at: s.t0 + 0.12 }], 540, 640, { px: 38, w: 800, shadow: false });
  },
  berlin(t, s) {
    crimson(t, 0, 0, 1080, 960);
    // leftover-element bridge: the header is the PURE lockup condensed into one line
    const hk = E.out(prog(t, s.t0, 0.45));
    ctx.save(); ctx.translate(540, 300); ctx.scale(lerp(1.5, 1, hk), lerp(1.5, 1, hk)); ctx.globalAlpha = clamp(hk * 3);
    bloom(0, -40, 380, 'rgba(255,120,40,0.35)');
    const px = fitCond('THE PURE FRAMEWORK', 120, 760); const g = ctx.createLinearGradient(0, -px * 0.75, 0, 0); g.addColorStop(0, '#fff1c8'); g.addColorStop(1, '#ffb25a');
    ctx.fillStyle = g; ctx.textAlign = 'center'; ctx.shadowColor = 'rgba(40,0,0,0.6)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 8; ctx.fillText('THE PURE FRAMEWORK', 0, 0); ctx.restore();
    const L = 150, say = at('say', 33), ex1 = ['The', 'Berlin', 'wall', 'fell', 'in', '1989'];
    wordLine(t, [{ s: 'Example 1:', at: s.t0 + 0.12 }], L, 476, { px: 40, w: 600, align: 'left', shadow: false, reflow: false });
    const t1 = [s.t0 + 0.2, at('berlin', 31.5), at('wall', 31.5), at('fell', 31.5), at('in', 32.5), at('1989,', 32.5)].map((x, i) => Math.max(x, s.t0 + 0.2 + i * 0.06));
    // instead of saying X: once "say" lands, example 1 is struck through and steps back
    const strike = E.out(prog(t, say + 0.05, 0.35));
    ctx.save(); ctx.globalAlpha = lerp(1, 0.55, strike);
    typedLine(t, ex1.map((w, i) => ({ s: w, at: t1[i] })), L, 548, { px: 60, caret: true, caretEnd: say });
    if (strike > 0) { font(60, 700); const ww = tw_(ex1.join(' ')); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(L - 6, 528); ctx.lineTo(L - 6 + (ww + 12) * strike, 526); ctx.stroke(); }
    ctx.restore();
    if (t >= say - 0.1) {
      wordLine(t, [{ s: 'Example 2:', at: say - 0.08 }], L, 690, { px: 40, w: 600, align: 'left', shadow: false, reflow: false });
      typedLine(t, ['The', 'Berlin', 'wall', 'fell'].map((w, i) => ({ s: w, at: [say, at('the', say), at('wall', say), at('fell', say)][i] })), L, 762, { px: 60 });
      typedLine(t, ['11', 'years', 'before', 'my', 'birthday'].map(w => ({ s: w, at: at(w === 'birthday' ? 'birthday.' : w, say) })), L, 840, { px: 60, fill: C.gold, caret: true });
    }
  },
  garden(t, s) {
    crimson(t, 0, 0, 1080, 960);
    const lbl = (txt, x, y, t0) => { ctx.save(); ctx.globalAlpha = clamp((t - t0) * 5); font(64, 400, F.cond); ctx.textAlign = 'center'; ctx.fillStyle = '#ffb8ae'; ctx.shadowColor = 'rgba(30,0,0,0.5)'; ctx.shadowBlur = 16; ctx.fillText(txt[0], x, y); ctx.fillText(txt[1], x, y + 64); ctx.restore(); };
    lbl(['SHORT-TERM', 'MEMORY'], 270, 410, s.t0); lbl(['LONG-TERM', 'MEMORY'], 820, 410, s.t0 + 0.08);
    // the verb: information travels from short-term to long-term while it is watered
    const inf = at('information', 42), mv = E.ramp(prog(t, at('watering', 44), 0.9));
    const ix = lerp(270, 820, mv), iy = 560 - Math.sin(mv * Math.PI) * 70;
    wordLine(t, [{ s: 'Information', at: inf }], ix, iy, { px: 36, w: 800, shadow: false });
    // the can, held from the top right, tilting to pour; drops fall under gravity (seeded, not random)
    const tilt = lerp(-0.15, -0.62, E.out(prog(t, s.t0 + 0.1, 0.6))) + noise(t * 0.8, 4) * 0.03;
    const cx = 790, cy = 150;
    for (let i = 0; i < 9; i++) {
      const per = 0.62, ph = ((t - s.t0 - 0.35) / per + i / 9); if (t - s.t0 < 0.35 + i * per / 9) continue;
      const f = ph - Math.floor(ph), fall = f * f * 520, sx = cx - 175 + rand(i * 3 + Math.floor(ph)) * 18;
      ctx.save(); ctx.globalAlpha = 1 - Math.pow(f, 6); const dg = ctx.createLinearGradient(0, -18, 0, 18); dg.addColorStop(0, '#9fd2ff'); dg.addColorStop(1, '#2a7fe0');
      ctx.fillStyle = dg; ctx.translate(sx - f * 30, cy + 70 + fall); ctx.beginPath(); ctx.moveTo(0, -20); ctx.bezierCurveTo(12, -2, 14, 14, 0, 16); ctx.bezierCurveTo(-14, 14, -12, -2, 0, -20); ctx.fill(); ctx.restore();
    }
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(tilt); can(170); ctx.restore();
    // the plant grows with each watering beat: stem first, then leaves unfurl on springs
    plant(t, 540, 905, [s.t0 + 0.2, at('watered', 40) > s.t0 ? at('watered', 40) : s.t0 + 0.9, at('watering', 44), at('plant.', 45)]);
  },
  brain(t, s) {
    crimson(t, 0, 0, 1080, 960);
    const rise = 1 - E.out(prog(t, s.t0, 0.7));
    ctx.save(); ctx.translate(450, 600 + rise * 420 + noise(t * 0.4, 7) * 4); ctx.scale(0.86, 0.86); brainHead(t, at('improve', 49), at('memory', 50.4));
    ctx.restore();
    const up = at('up', 51);
    // callout: a hairline from the lit lobe, then the number rolls 0 -> 6
    const lk = E.out(prog(t, up - 0.1, 0.4));
    if (lk > 0) { ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 3; drawPartial([[560, 500], [700, 250], [960, 250]], lk); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(560, 500, 8 * lk, 0, 7); ctx.fill(); ctx.restore(); }
    wordLine(t, [{ s: 'upto', at: up }], 680, 200, { px: 40, w: 600, align: 'left', shadow: false, reflow: false });
    const six = at('six', 51);
    if (t >= six - 0.05) {
      const roll = E.out(prog(t, six - 0.05, 0.42)) * 6; ctx.save(); font(92, 800); ctx.textAlign = 'left';
      ctx.beginPath(); ctx.rect(670, 230, 80, 110); ctx.clip();
      for (let d = Math.floor(roll); d <= Math.ceil(roll); d++) { const off = (d - roll) * 100; ctx.fillStyle = '#fff'; ctx.globalAlpha = 1 - Math.min(1, Math.abs(off) / 100); ctx.fillText(String(d), 680, 320 + off); }
      ctx.restore();
      wordLine(t, [{ s: 'hours', at: at('hours', 51) }], 762, 320, { px: 92, w: 800, align: 'left', shadow: false, reflow: false });
    }
  },
  product(t, s) {
    crimson(t, 0, 0, 1080, 960);
    const k = spring(t - s.t0 - 0.02, 'firm');
    ctx.save(); ctx.translate(330, 520 + (1 - k) * 520 + Math.sin((t - s.t0) * 1.3) * 6); ctx.rotate(-0.04 + noise(t * 0.5, 2) * 0.03 + (1 - k) * 0.2); pack(t, 380, 470); ctx.restore();
    [['ginseng,', 'Ginseng'], ['l-t-n-n', 'L-theanine'], ['b-vitamins.', 'B Vitamins']].forEach(([w, l], i) => {
      const t0 = at(w, 57); if (t < t0 - 0.05) return;
      const y = 410 + i * 86, dk = E.out(prog(t, t0 - 0.05, 0.2));
      ctx.save(); ctx.fillStyle = C.ice; ctx.fillRect(600, y - 22, 26 * dk, 6); ctx.restore();
      bloom(720, y - 18, 160, 'rgba(120,220,255,0.12)', dk);
      wordLine(t, [{ s: l, at: t0 }], 642, y, { px: 50, w: 700, align: 'left', shadow: false, reflow: false, fill: C.ice });
    });
  },
};

/* ───────────── props ───────────── */
function paper(t, x, y, w, h, t0, seed) {
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 34; ctx.shadowOffsetY = 18;
  const pg = ctx.createLinearGradient(0, -h / 2, 0, h / 2); pg.addColorStop(0, '#f4f2ec'); pg.addColorStop(1, '#dcd8ce');
  ctx.fillStyle = pg; ctx.fillRect(x - w / 2, y - h / 2, w, h); ctx.shadowColor = 'transparent';
  // handwriting writes itself, line by line, in blue-black ink
  ctx.strokeStyle = 'rgba(30,34,70,0.7)'; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
  for (let i = 0; i < 15; i++) {
    const p = prog(t, t0 + 0.25 + i * 0.07, 0.22); if (p <= 0) break;
    const yy = y - h / 2 + 46 + i * 33, len = (0.55 + rand(i + seed * 40) * 0.4) * (w - 70), ind = rand(i * 5 + seed) > 0.8 ? 30 : 0;
    ctx.beginPath(); ctx.moveTo(x - w / 2 + 34 + ind, yy);
    const n = 14; for (let j = 1; j <= n * p; j++) ctx.lineTo(x - w / 2 + 34 + ind + (len - ind) * j / n, yy + Math.sin(j * 2.1 + i + seed) * 4 + (j % 3 === 0 ? -6 : 0));
    ctx.stroke();
    if (i % 5 === 2 && p >= 1) { ctx.strokeRect(x + w / 2 - 150, yy - 18, 90, 40); }
  }
  ctx.restore();
}
function can(sz) {
  const s = sz / 170;
  ctx.save(); ctx.scale(s, s);
  // the hand + sleeve coming from the top-right edge
  ctx.fillStyle = '#121214'; ctx.beginPath(); ctx.moveTo(40, -100); ctx.lineTo(260, -330); ctx.lineTo(380, -250); ctx.lineTo(120, -20); ctx.fill();
  ctx.fillStyle = '#7b4a30'; ctx.beginPath(); ctx.ellipse(40, -70, 50, 36, -0.7, 0, 7); ctx.fill();
  const g = ctx.createLinearGradient(-80, 0, 80, 0); g.addColorStop(0, '#1b2330'); g.addColorStop(0.5, '#3b4a60'); g.addColorStop(1, '#141a24');
  ctx.fillStyle = g; ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 12;
  ctx.beginPath(); ctx.roundRect(-75, -60, 150, 130, 22); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-70, 10); ctx.lineTo(-170, 70); ctx.lineTo(-160, 86); ctx.lineTo(-60, 40); ctx.fill();
  ctx.beginPath(); ctx.ellipse(-172, 78, 18, 10, -0.6, 0, 7); ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.strokeStyle = '#2a3446'; ctx.lineWidth = 14; ctx.beginPath(); ctx.arc(10, -60, 46, Math.PI, 0); ctx.stroke();
  ctx.fillStyle = '#eef0f4'; ctx.textAlign = 'center'; font(20, 900); ctx.save(); ctx.rotate(0.12); ctx.fillText('SPACED', 0, 0); ctx.fillText('REPETITION', 0, 24); ctx.restore();
  ctx.restore();
}
function plant(t, x, y, beats) {
  const g = E.settle(prog(t, beats[0], 0.6)) * 0.3 + E.settle(prog(t, beats[1], 0.6)) * 0.25 + E.settle(prog(t, beats[2], 0.7)) * 0.25 + E.settle(prog(t, beats[3], 0.7)) * 0.2;
  if (g <= 0) return;
  ctx.save(); ctx.translate(x, y);
  // soil mound
  ctx.fillStyle = '#2a0f0a'; ctx.beginPath(); ctx.ellipse(0, 0, 130, 30, 0, Math.PI, 0); ctx.fill();
  const H_ = 300 * g, sw = noise(t * 0.7, 9) * 0.04;
  ctx.strokeStyle = '#2f7a2a'; ctx.lineWidth = 12; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(sw * 400, -H_ * 0.5, sw * 600, -H_); ctx.stroke();
  const leaves = 10;
  for (let i = 0; i < leaves; i++) {
    const at_ = (i + 1) / (leaves + 1), born = g - at_ * 0.9; if (born <= 0) continue;
    const k = spring(born * 3, 'pop'), side = i % 2 ? 1 : -1, ly = -H_ * at_ * 0.95;
    ctx.save(); ctx.translate(sw * 600 * at_, ly); ctx.rotate(side * (0.75 + 0.1 * Math.sin(t * 1.3 + i)) - 0.1);
    const L = (80 + (leaves - i) * 6) * Math.min(1.08, k);
    const lg = ctx.createLinearGradient(0, 0, side * L, 0); lg.addColorStop(0, '#2b7a24'); lg.addColorStop(1, '#5cbf3e');
    ctx.fillStyle = lg; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(side * L * 0.5, -L * 0.42, side * L, 0); ctx.quadraticCurveTo(side * L * 0.5, L * 0.32, 0, 0); ctx.fill();
    ctx.strokeStyle = 'rgba(20,60,20,0.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(side * L * 0.9, 0); ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}
function brainHead(t, tImprove, tMem) {
  // the head in profile, dark, rim lit; the brain inside; the front lobe floods blue as "improve ... memory" is said
  ctx.save();
  ctx.fillStyle = '#0d0d10'; ctx.beginPath(); ctx.moveTo(-210, 420); ctx.bezierCurveTo(-250, 200, -260, -120, -60, -230); ctx.bezierCurveTo(140, -320, 330, -160, 300, 40); ctx.bezierCurveTo(300, 120, 330, 150, 350, 200); ctx.lineTo(300, 230); ctx.bezierCurveTo(300, 300, 270, 330, 220, 330); ctx.lineTo(200, 420); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(120,150,255,0.25)'; ctx.lineWidth = 4; ctx.stroke();
  ctx.save(); brainPath(); ctx.clip();
  const bg = ctx.createRadialGradient(-30, -110, 20, 10, -60, 260); bg.addColorStop(0, '#e6e6ea'); bg.addColorStop(1, '#8a8a92'); ctx.fillStyle = bg; ctx.fillRect(-240, -240, 480, 360);
  const fill = E.ramp(prog(t, tImprove, Math.max(0.5, tMem - tImprove + 0.3)));
  if (fill > 0) {
    const bx = lerp(260, -10, fill);
    const bl = ctx.createLinearGradient(bx, 0, bx + 60, 0); bl.addColorStop(0, 'rgba(70,110,255,1)'); bl.addColorStop(1, 'rgba(70,110,255,0)');
    ctx.fillStyle = bl; ctx.fillRect(bx, -240, 60, 400); ctx.fillStyle = '#4a6cff'; ctx.fillRect(bx + 1, -240, 300, 400);
  }
  ctx.strokeStyle = 'rgba(30,30,50,0.45)'; ctx.lineWidth = 5;
  // gyri: seeded meanders (a dark fold line with a light ridge beside it), then a soft inner shade for volume
  for (let i = 0; i < 46; i++) {
    let x = -230 + rand(i * 3 + 1) * 470, y = -230 + rand(i * 3 + 2) * 340, a = rand(i * 3 + 3) * 6.28;
    const pts = [[x, y]];
    for (let j = 0; j < 9; j++) { a += (rand(i * 31 + j) - 0.5) * 2.6; x += Math.cos(a) * 20; y += Math.sin(a) * 20; pts.push([x, y]); }
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 7; ctx.beginPath(); pts.forEach(([px, py], k) => k ? ctx.lineTo(px - 3, py - 4) : ctx.moveTo(px - 3, py - 4)); ctx.stroke();
    ctx.strokeStyle = 'rgba(20,20,40,0.5)'; ctx.lineWidth = 5; ctx.beginPath(); pts.forEach(([px, py], k) => k ? ctx.lineTo(px, py) : ctx.moveTo(px, py)); ctx.stroke();
  }
  const sh = ctx.createRadialGradient(-40, -120, 60, 10, -60, 260); sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,20,0.45)'); ctx.fillStyle = sh; ctx.fillRect(-260, -260, 520, 400);
  ctx.restore();
  if (fill > 0) bloom(120, -60, 300, 'rgba(80,120,255,0.35)', fill);
  ctx.restore();
}
function pack(t, w, h) {
  // a stand-in mint tin: brand-neutral (no real logo), pale cyan, soft studio light
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 20;
  const g = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2); g.addColorStop(0, '#e7f8fc'); g.addColorStop(1, '#a6d8e6');
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 44); ctx.fill(); ctx.shadowColor = 'transparent';
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.roundRect(-w / 2 + 10, -h / 2 + 10, w - 20, 60, 34); ctx.fill();
  ctx.fillStyle = '#1d4a5a'; ctx.textAlign = 'left';
  font(54, 650); ['Memory', '& Focus'].forEach((l, i) => ctx.fillText(l, -w / 2 + 38, -h / 2 + 150 + i * 60));
  font(54, 800); ctx.fillText('mints', -w / 2 + 38, -h / 2 + 270);
  ctx.fillStyle = '#2ab0d0'; ctx.beginPath(); ctx.roundRect(-w / 2 + 38, -h / 2 + 300, 200, 38, 19); ctx.fill();
  ctx.fillStyle = '#e8fbff'; font(20, 800); ctx.fillText('PEPPERMINT', -w / 2 + 62, -h / 2 + 326);
  ctx.fillStyle = 'rgba(29,74,90,0.5)'; for (let i = 0; i < 4; i++) ctx.fillRect(w / 2 - 110, -h / 2 + 170 + i * 30, 72, 6);
  ctx.strokeStyle = '#1d4a5a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(w / 2 - 74, -h / 2 + 100, 18, 0, 7); ctx.stroke();
  ctx.restore();
}

// a cerebrum silhouette in profile (front to the right) with the cerebellum tucked under the back
function brainPath() {
  ctx.beginPath();
  ctx.moveTo(-200, 40); ctx.bezierCurveTo(-270, -20, -250, -170, -150, -205); ctx.bezierCurveTo(-90, -250, 10, -250, 70, -225);
  ctx.bezierCurveTo(170, -215, 245, -150, 240, -50); ctx.bezierCurveTo(250, 10, 220, 50, 160, 60); ctx.bezierCurveTo(120, 70, 90, 50, 60, 70);
  ctx.bezierCurveTo(20, 100, -40, 90, -80, 70); ctx.bezierCurveTo(-120, 110, -190, 110, -200, 40); ctx.closePath();
}
