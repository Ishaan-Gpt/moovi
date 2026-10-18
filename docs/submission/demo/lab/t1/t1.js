// T1: Ishaan's "think like an engineer" clip (59 s, his own phone footage), edited in the R1 crimson-poster grammar
// (data/refs/r1/clone-motion: core, type, world, posters) with his real video as the speaker. 1080×1920.
// Every event is a word anchor on the cut clock (the pauses removed by Moovi's planEdit + build-cut).
//   hook      "Everybody wants to learn CODING … but only few learn to be an ENGINEER": CODING slot-rolls into ENGINEER
//   poster    "Let me tell you how to think like an engineer": the crimson ring of three keys, ENGINEER igniting
//   key 1     dive into key 1 "1. Understand the Flow"; SYNTAX slams and is struck through, FLOW lands
//   key 2     rack to key 2 "2. Draw the Architecture"; a panel: FRONTEND · API · BACKEND wiring itself on its words
//   key 3     whip to key 3 "3. Debug the Code"; DEBUGGING, then WHAT and WHY
//   outro     ENGINEER slams; the three keys lit again on "three steps"; the last 0.35 s to black
// Words never cover his face (edl faces: x 0.33–0.72, y 0.24–0.50): big words sit below the face or above the head.
'use strict';
const cv = document.getElementById('c'), main = cv.getContext('2d');
ctx = main;
const vid = document.getElementById('v');
const norm = s => s.toLowerCase().replace(/[^a-z0-9-]/g, '');
function WT(w, after = 0, nth = 0) { const n = norm(w), hits = WORDS.filter(x => norm(x.word) === n && x.t >= after); return hits[nth] ?? { t: after, end: after + 0.4 }; }
let DUR = 60;

/* ───────── the speaker: his clip, a new framing on every cut, punches on the slams ───────── */
function speakerVideo(t, cam, box) {
  const [bx, by, bw, bh] = box; if (!vid.videoWidth) return;
  ctx.save(); ctx.beginPath(); ctx.rect(bx, by, bw, bh); ctx.clip();
  // auto-frame from planEdit's face boxes: the face fills ~24 % of the box height, centred, eyes near 0.36
  const f = faceAt(t), split = bh < H;
  const want = split ? 0.42 : 0.24, zf = f ? clamp(want / f.h, 1, 2.4) : 1;
  const vw = vid.videoWidth, vh = vid.videoHeight, cover = Math.max(bw / vw, bh / vh) * cam.s * zf;
  const dw = vw * cover, dh = vh * cover;
  const fcx = f ? f.x + f.w / 2 : 0.5, fcy = f ? f.y + f.h / 2 : 0.4;
  let dx = bx + bw / 2 - fcx * dw + cam.ox, dy = by + bh * (split ? 0.48 : 0.36) - fcy * dh + cam.oy;
  dx = Math.min(bx, Math.max(bx + bw - dw, dx)); dy = Math.min(by, Math.max(by + bh - dh, dy)); // never show past the picture
  ctx.drawImage(vid, dx, dy, dw, dh);
  const v = ctx.createRadialGradient(bx + bw / 2, by + bh * 0.45, bh * 0.35, bx + bw / 2, by + bh / 2, bh * 0.85); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(20,0,0,0.38)'); ctx.fillStyle = v; ctx.fillRect(bx, by, bw, bh);
  ctx.restore();
}

let FACES = []; // [{ t (cut clock), x, y, w, h }] smoothed
function faceAt(t) { if (!FACES.length) return null; let lo = 0, hi = FACES.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; FACES[m].t <= t ? lo = m : hi = m; } const a = FACES[lo], b = FACES[hi], k = b.t > a.t ? clamp((t - a.t) / (b.t - a.t)) : 0; return { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), w: lerp(a.w, b.w, k), h: lerp(a.h, b.h, k) }; }

/* ───────── the poster: three keys on the crimson ring, ENGINEER as the lit sign ───────── */
const FAN3 = [-0.6, 0, 0.6], RING3 = { x: 540, y: 1335 }, KL = 360;
function sign(t, o) { // "think like an" / ENGINEER (igniting) / "three steps"
  ctx.save(); ctx.translate(540, o.y); ctx.scale(o.s, o.s);
  const ign = o.lit == null ? 1 : flicker(t, o.lit);
  bloom(0, 0, 520, 'rgba(255,70,20,0.55)', ign);
  if (o.pre != null) wordLine(t, ['think', 'like', 'an'].map((s, i) => ({ s, at: o.pre + i * 0.12, fill: '#ffd6ae' })), 0, -215, { px: 64, w: 800, rise: 10, shadow: false });
  const px = fitCond('ENGINEER', 330, 760);
  const g = ctx.createLinearGradient(0, 100 - px * 0.74, 0, 100); g.addColorStop(0, '#fff2dc'); g.addColorStop(0.35, '#ffb070'); g.addColorStop(0.7, '#ff5a26'); g.addColorStop(1, '#d01a1c');
  ctx.save(); ctx.textAlign = 'center'; ctx.scale(0.7, 1.22); ctx.globalAlpha = lerp(0.18, 1, ign); ctx.fillStyle = ign > 0.02 ? g : '#5a0a0e';
  ctx.shadowColor = 'rgba(40,0,0,0.6)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 10; ctx.fillText('ENGINEER', 0, 100); ctx.restore();
  if (o.sub) wordLine(t, o.sub.map((s, i) => ({ s, at: o.subAt + i * 0.07, fill: '#ffd6ae' })), 0, 178, { px: 46, w: 800, rise: 8, shadow: false });
  ctx.restore();
}
function fan3(t, open, o = {}) {
  ctx.save(); ctx.translate(RING3.x, RING3.y); ctx.strokeStyle = 'rgba(255,170,140,0.16)'; ctx.lineWidth = 3; const rot = t * 0.01;
  for (const r of [500, 360]) { ctx.beginPath(); ctx.arc(0, 0, r, Math.PI * 1.06 + rot, Math.PI * 1.94 + rot); ctx.stroke(); }
  for (let i = 0; i <= 24; i++) { const a = Math.PI * 1.06 + rot + i * (Math.PI * 0.88 / 24); ctx.beginPath(); ctx.moveTo(Math.cos(a) * 500, Math.sin(a) * 500); ctx.lineTo(Math.cos(a) * (i % 4 ? 486 : 476), Math.sin(a) * (i % 4 ? 486 : 476)); ctx.stroke(); }
  ctx.restore();
  for (let i = 0; i < 3; i++) { ctx.save(); ctx.translate(RING3.x, RING3.y + 40); ctx.rotate(FAN3[i] * open[i]); key(KL, { hot: o.hot ? o.hot[i] : 0 }); ctx.restore(); }
  ctx.save(); ctx.strokeStyle = '#d6d6dc'; ctx.lineWidth = 13; ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 12; ctx.beginPath(); ctx.ellipse(RING3.x, RING3.y + 50, 64, 54, 0.2, 0, 7); ctx.stroke(); ctx.restore();
}
const STEPS = ['Understand the flow', 'Draw the architecture', 'Debug the code'];
function labels3(t, t0) { for (let i = 0; i < 3; i++) { const a = FAN3[i] * 1.06, r = 455, x = RING3.x + Math.sin(a) * r, y = RING3.y + 40 - Math.cos(a) * r; wordLine(t, [{ s: `Step ${i + 1}`, at: stagger(t0, [1, 0, 2][i], 0.09, 5), fill: i === 1 ? '#ffe7cf' : 'rgba(255,214,190,0.85)' }], x, y, { px: 36, w: 700, rise: 10, shadow: false }); } }
function poster(t, s) {
  const p = prog(t, s.t0, 1.15), u = 1 - Math.pow(1 - p, 4), z = logPull(2.6, p) * (1 + 0.012 * (t - s.t0));
  const fx = lerp(640, 540, u), fy = lerp(470, 960, u);
  ctx.save(); ctx.translate(540, 960); ctx.scale(z, z); ctx.translate(-fx, -fy);
  crimson(t, -400, -400, 1880, 2720, { z: 1 });
  const open = [0, 1, 2].map(i => spring(t - stagger(s.t0 + 0.2, [1, 0, 2][i], 0.08, 9), 'pop'));
  hand(RING3.x - 10, RING3.y + 30, 1.05); fan3(t, open, { hot: s.hot ? [1, 1, 1].map((_, i) => clamp(E.out(prog(t, s.t0 + 0.2 + i * 0.12, 0.3)))) : null });
  sign(t, { y: 500, s: 1, pre: s.pre, lit: s.lit, sub: s.sub, subAt: s.subAt });
  labels3(t, s.t0 + 0.9);
  ctx.restore();
}
function cachePoster3() {
  const sharp = makeCanvas(1080, 1920), keep = ctx; ctx = sharp.getContext('2d');
  crimson(9, 0, 0, 1080, 1920, { z: 1 }); hand(RING3.x - 10, RING3.y + 30, 1.05); fan3(9, [1, 1, 1]); sign(9, { y: 500, s: 1 }); labels3(9, 0);
  const blur = makeCanvas(540, 960), b = blur.getContext('2d'); b.filter = 'blur(4.5px)'; b.drawImage(sharp, -30, -30, 600, 1020);
  ctx = keep; TEX.poster3 = sharp; TEX.posterBlur3 = blur;
}
function keyCard(t, s) { // dive / rack / whip into key n of the ring; it lights; the step name lands above its bit
  const n = s.n, a = FAN3[n], P = { x: RING3.x + Math.sin(a) * KL * 0.55, y: RING3.y + 40 - Math.cos(a) * KL * 0.55 }, d = t - s.t0, kind = s.tr;
  let z = 2.0 * (1 + 0.02 * d), fy = 820, blurK = 1, smear = 0;
  if (kind === 'dive') { const k = E.hard(prog(t, s.t0, 0.6)); z = logLerp(1, 2.0, k) * (1 + 0.02 * d); fy = lerp(960, 820, k); blurK = k; }
  if (kind === 'rack') blurK = E.ramp(prog(t, s.t0, 0.5));
  if (kind === 'whip') { const k = E.hard(prog(t, s.t0, 0.42)); fy = lerp(1500, 820, k); smear = Math.abs(vel(tt => lerp(1500, 820, E.hard(prog(tt, s.t0, 0.42))), t)) * z; }
  const fx = kind === 'dive' ? lerp(540, P.x, E.hard(prog(t, s.t0, 0.6))) : P.x;
  ctx.save(); ctx.translate(540, 960); ctx.scale(z, z); ctx.translate(-fx, -fy);
  if (blurK < 1) { ctx.filter = `blur(${(blurK * 14 + 0.3).toFixed(1)}px)`; ctx.drawImage(TEX.poster3, 0, 0); ctx.filter = 'none'; }
  if (blurK > 0) { ctx.globalAlpha = Math.min(1, blurK); const gN = smear > 2 ? Math.min(5, Math.ceil(shutter(smear) / 6)) : 0; ctx.drawImage(TEX.posterBlur3, -60, -60, 1200, 2040); for (let i = 1; i <= gN; i++) { ctx.globalAlpha = 0.22; ctx.drawImage(TEX.posterBlur3, -60, -60 + i * smear * 0.12 / z, 1200, 2040); } ctx.globalAlpha = 1; }
  ctx.restore();
  const vg = ctx.createRadialGradient(540, 960, 200, 540, 960, 1250); vg.addColorStop(0, 'rgba(20,0,0,0.05)'); vg.addColorStop(1, 'rgba(10,0,0,0.6)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  const ANG = [-0.55, 0, 0.6], POS = [[620, 1440], [540, 1520], [460, 1450]];
  const kin = E.out(prog(t, s.t0 + (kind === 'dive' ? 0.38 : 0.03), 0.55)), heat = clamp(E.out(prog(t, s.t0 + (kind === 'dive' ? 0.4 : 0.1), 0.45))) * (0.94 + 0.06 * Math.sin(d * 4.2)), sway = noise(t * 0.6, n) * 0.035, kz = logLerp(1.3, 1, kin) * (1 + 0.014 * d);
  ctx.save(); ctx.globalAlpha = clamp(kin * 4); ctx.translate(POS[n][0], POS[n][1]); ctx.scale(kz, kz); ctx.rotate(ANG[n] + sway + 0.08 * (1 - kin)); key(560, { hot: heat, flat: true }); ctx.restore();
  s.label.forEach((line, li) => wordLine(t, line.split(' ').map((w, wi) => ({ s: w, at: s.t0 + 0.18 + li * 0.16 + wi * 0.07 + rand(wi + li * 9 + n) * 0.03, fill: '#ffe2a6' })), 540, 830 + li * 62, { px: 54, w: 800, rise: 12, shadow: true, shadowA: 0.5 }));
}

/* ───────── panel: the architecture, wiring itself on its words (top half, 1080×960) ───────── */
function boxNode(t, at, x, y, w, h, label, sub) {
  const k = spring(t - at, 'pop'); if (t < at) return;
  ctx.save(); ctx.translate(x, y + (1 - Math.min(1, k)) * 40); ctx.scale(k, k);
  ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 14;
  const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2); g.addColorStop(0, '#2a2a30'); g.addColorStop(1, '#141418'); ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 28); ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.strokeStyle = 'rgba(255,200,170,0.35)'; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = '#ffe2a6'; font(52, 800); ctx.textAlign = 'center'; ctx.fillText(label, 0, 10); ctx.fillStyle = 'rgba(255,214,190,0.7)'; font(28, 600); ctx.fillText(sub, 0, 54);
  ctx.restore();
}
function archPanel(t, s) {
  crimson(t, 0, 0, 1080, 960);
  wordLine(t, [{ s: 'architecture', at: s.t0 + 0.05, fill: '#ffd6ae' }, { s: 'diagram', at: s.t0 + 0.18, fill: '#ffd6ae' }], 540, 150, { px: 58, w: 800, rise: 10, shadow: false });
  const fe = Math.max(s.t0 + 0.2, s.fe), be = Math.max(s.t0 + 0.3, s.be), api = Math.max(s.t0 + 0.4, s.api);
  boxNode(t, fe, 230, 520, 340, 190, 'FRONTEND', 'what you see');
  boxNode(t, be, 850, 520, 340, 190, 'BACKEND', 'what it does');
  connector(t, 400, 680, 520, Math.max(fe, be) + 0.15, 0.4);
  boxNode(t, api, 540, 790, 300, 150, 'API', 'how they talk');
  if (t > api + 0.2) { ctx.save(); ctx.strokeStyle = 'rgba(255,240,230,0.85)'; ctx.lineWidth = 4; ctx.setLineDash([12, 10]); ctx.lineDashOffset = -t * 30; const k = E.out(prog(t, api + 0.2, 0.35)); ctx.beginPath(); ctx.moveTo(300, 615); ctx.lineTo(lerp(300, 420, k), lerp(615, 760, k)); ctx.moveTo(780, 615); ctx.lineTo(lerp(780, 660, k), lerp(615, 760, k)); ctx.stroke(); ctx.restore(); }
}
const PANEL = makeCanvas(1080, 960), pctx = PANEL.getContext('2d');
function drawPanel(t, s) {
  const keep = ctx; ctx = pctx; ctx.save(); ctx.clearRect(0, 0, 1080, 960); archPanel(t, s); ctx.restore(); ctx = keep;
  const Y = tt => -960 * (1 - E.out(prog(tt, s.t0 - 0.03, 0.34))), y = Y(t), v = Math.abs(vel(Y, t)), n = v > 3 ? Math.min(4, Math.ceil(shutter(v) / 4)) : 0;
  for (let i = n; i >= 1; i--) { ctx.globalAlpha = 0.18; ctx.drawImage(PANEL, 0, y - i * v * 0.25); } ctx.globalAlpha = 1; ctx.drawImage(PANEL, 0, y);
  const g = ctx.createLinearGradient(0, y + 960, 0, y + 986); g.addColorStop(0, 'rgba(0,0,0,0.45)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, y + 960, W, 26);
}

/* ───────── the timeline (word anchors) ───────── */
let SEG = [], CUTS = [], BIG = [], CHUNKS = [], EV = [];
// at(w, after, nth) comes from R1's posters.js
function buildEdit() {
  const tLet = at('let'), tFirst = at('first'), tSecond = at('second'), tYou = at('you', at('things', tSecond)), tMain = at('main', tSecond), tNow = at('now', at('written', tMain)), tFollow = at('follow', tNow), tThank = at('thank', tFollow);
  const card = 1.35;
  SEG = [
    { t0: 0, t1: tLet, k: 'full' },
    { t0: tLet, t1: tFirst, k: 'poster', pre: at('think', tLet), lit: at('engineer.', tLet), sub: null },
    { t0: tFirst, t1: tFirst + card, k: 'key', n: 0, tr: 'dive', label: ['1. Understand', 'the Flow'] },
    { t0: tFirst + card, t1: tSecond, k: 'full' },
    { t0: tSecond, t1: tSecond + card, k: 'key', n: 1, tr: 'rack', label: ['2. Draw the', 'Architecture'] },
    { t0: tSecond + card, t1: at('the', at('entire', tSecond)), k: 'full' },
    { t0: at('the', at('entire', tSecond)), t1: tYou, k: 'split', fe: at('front', tSecond + card), be: at('back', tSecond + card), api: at('api', tSecond + card) },
    { t0: tYou, t1: tMain, k: 'full' },
    { t0: tMain - 0.1, t1: tMain + card, k: 'key', n: 2, tr: 'whip', label: ['3. Debug', 'the Code'] },
    { t0: tMain + card, t1: tFollow + 0.4, k: 'full' },
    { t0: tFollow + 0.4, t1: tThank, k: 'poster', lit: tFollow + 0.4, sub: ['three', 'steps.'], subAt: at('three', tFollow), hot: true },
    { t0: tThank, t1: 999, k: 'full' },
  ];
  CUTS = [...new Set(SEG.map(s => s.t0).concat(CUTMAP.map(c => c[2])))].sort((a, b) => a - b);
  const W1 = WT('coding'), W2 = WT('engineer.'), SYN = WT('syntax', tFirst), FLOW = WT('flow.', tFirst), DBG = WT('debugging', tMain), AG = WT('agents', tMain), WHAT = WT('what', AG.t), WHY = WT('why', AG.t), ENG = WT('engineer.', tNow);
  BIG = [
    { t0: 0.2, t1: tLet, k: 'hook', coding: W1.t, only: at('only'), eng: W2.t },
    { t0: SYN.t - 0.25, t1: FLOW.end + 0.7, k: 'syntax', syn: SYN.t, strike: at('code.', SYN.t), flow: FLOW.t },
    { t0: DBG.t, t1: DBG.end + 0.9, k: 'low', small: [{ s: "you'll", at: DBG.t - 0.3 }, { s: 'be', at: DBG.t - 0.15 }], big: 'DEBUGGING', bigAt: DBG.t, y: 1500, smallY: 1260, maxW: 820 },
    { t0: AG.t - 0.1, t1: AG.end + 1.0, k: 'low', small: [{ s: 'AI', at: AG.t - 0.15 }], big: 'AGENTS', bigAt: AG.t, y: 1500, smallY: 1270, maxW: 700, smallPx: 70 },
    { t0: WHAT.t, t1: WHY.end + 1.0, k: 'whatwhy', what: WHAT.t, why: WHY.t },
    { t0: ENG.t - 0.4, t1: ENG.end + 0.9, k: 'low', small: [{ s: 'become', at: ENG.t - 0.4 }, { s: 'an', at: ENG.t - 0.15 }], big: 'ENGINEER', bigAt: ENG.t, y: 1500, smallY: 1260, maxW: 860 },
  ];
  buildCaptions(); EV = sfxEvents();
}
function buildCaptions() {
  CHUNKS = []; let cur = []; const flush = () => { if (cur.length) CHUNKS.push({ t0: cur[0].t, words: cur }); cur = []; };
  WORDS.forEach((w, i) => { const prev = WORDS[i - 1]; if (cur.length && (cur.length >= 3 || cur.map(x => x.word).join(' ').length + w.word.length > 14 || (prev && w.t - prev.end > 0.28) || /[.,?!]$/.test(prev?.word ?? ''))) flush(); cur.push(w); });
  flush(); CHUNKS.forEach((c, i) => { c.t1 = Math.min(CHUNKS[i + 1]?.t0 ?? c.t0 + 1.2, c.t0 + 1.6); });
}
function camAt(t) {
  let i = 0; for (let j = 0; j < CUTS.length; j++) if (CUTS[j] <= t) i = j;
  const since = t - CUTS[i], base = [1.0, 1.1, 1.04, 1.16, 1.07][i % 5], ox = (rand(i * 11) - 0.5) * 60, oy = (rand(i * 13) - 0.5) * 40;
  let s = base * (1 + 0.035 * Math.exp(-since / 0.16)) * (1 + 0.011 * since);
  for (const b of BIG) if (b.bigAt && t >= b.bigAt && t < b.t1) s *= logLerp(1, 1.07, E.out(prog(t, b.bigAt, 0.18)));
  const s1 = SEG[1].t0; if (t > s1 - 0.27 && t < s1) s *= logLerp(1, 1.22, E.in(prog(t, s1 - 0.27, 0.27)));
  return { s, ox: ox + noise(t * 0.3, i) * 10, oy: oy + noise(t * 0.3, i + 50) * 8 };
}
function caption(t, s) {
  const c = CHUNKS.find(c => t >= c.t0 && t < c.t1); if (!c) return;
  const y = s.k === 'split' ? 1720 : 1300; // below the face, always
  wordLine(t, c.words.map((w, i) => ({ s: w.word.replace(/^api$/i, 'API'), at: Math.max(w.t - 0.03, c.t0 - 0.03 + i * 0.02) })), 540, y, { px: 66, w: 800, dur: 0.26, rise: 12, shadowBlur: 26, shadowA: 0.7 });
}
function drawBig(t, b) {
  if (b.k === 'hook') return hook(t, b);
  if (b.k === 'low') { wordLine(t, b.small, 540, b.smallY, { px: b.smallPx ?? 58, w: 800, rise: 12 }); slam(t, b.big, 540, b.y, b.bigAt, { px: 320, maxW: b.maxW, S0: 1.5 }); }
  if (b.k === 'syntax') {
    slam(t, 'SYNTAX', 540, 1330, b.syn, { px: 260, maxW: 640, S0: 1.45 });
    const k = E.out(prog(t, b.strike, 0.25)); if (k > 0) { ctx.save(); ctx.strokeStyle = '#ff2b31'; ctx.lineWidth = 18; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(220, 1240); ctx.lineTo(lerp(220, 860, k), lerp(1240, 1215, k)); ctx.stroke(); ctx.restore(); }
    if (t >= b.flow) { wordLine(t, [{ s: 'understand', at: b.flow - 0.35 }, { s: 'the', at: b.flow - 0.2 }], 540, 1460, { px: 52, w: 800 }); slam(t, 'FLOW', 540, 1700, b.flow, { px: 300, maxW: 560, S0: 1.5 }); }
  }
  if (b.k === 'whatwhy') { slam(t, 'WHAT', 300, 1520, b.what, { px: 240, maxW: 420, S0: 1.45 }); slam(t, 'WHY', 790, 1520, b.why, { px: 240, maxW: 380, S0: 1.45 }); wordLine(t, [{ s: '&', at: b.why - 0.05 }], 540, 1480, { px: 90, w: 800 }); }
}
function hook(t, b) { // CODING slot-rolls into ENGINEER on the second word
  const y = 1420, px = 210; if (t < b.coding - 0.05) return;
  wordLine(t, ['everybody', 'wants', 'to', 'learn'].map((s, i) => ({ s, at: at(s.replace(/[.,]/g, '')) })), 540, 1180, { px: 52, w: 800 });
  const roll = E.ramp(prog(t, b.eng - 0.08, 0.34)), A = 'CODING', B = 'ENGINEER';
  font(px, 400, F.cond); const wA = tw_(A), wB = tw_(B), tot = lerp(wA, wB, roll), enter = logPull(1.25, E.out(prog(t, b.coding - 0.05, 0.3)));
  ctx.save(); ctx.translate(540, y - px * 0.36); ctx.scale(enter, enter); ctx.translate(-540, -(y - px * 0.36));
  bloom(540, y - 70, 420, 'rgba(255,255,255,0.14)');
  ctx.beginPath(); ctx.rect(0, y - px * 0.82, 1080, px * 0.92); ctx.clip(); shade(true, 30, 0.45, 6); ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
  if (roll <= 0) ctx.fillText(A, 540, y); else if (roll >= 1) { ctx.fillStyle = '#ff3a2f'; ctx.fillText(B, 540, y); }
  else { const off = roll * px * 0.9; ctx.globalAlpha = 1 - roll; ctx.filter = `blur(${(Math.sin(roll * Math.PI) * 6 + 0.3).toFixed(1)}px)`; ctx.fillText(A, 540, y - off); ctx.globalAlpha = roll; ctx.fillStyle = '#ff3a2f'; ctx.fillText(B, 540, y + px * 0.9 - off); }
  ctx.restore();
  if (t >= b.only) wordLine(t, ['only', 'few', 'learn', 'to', 'be', 'an'].map((s, i) => ({ s, at: at(s, b.only - 0.01) })), 540, 1560, { px: 46, w: 800 });
}

/* ───────── the frame ───────── */
function segAt(t) { return SEG.find(s => t >= s.t0 && t < s.t1) ?? SEG[SEG.length - 1]; }
function frame(t) {
  ctx = main; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.filter = 'none'; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  const s = segAt(t), bigs = BIG.filter(b => t >= b.t0 && t < b.t1), cam = camAt(t);
  if (s.k === 'full') speakerVideo(t, cam, [0, 0, W, H]);
  if (s.k === 'poster') poster(t, s);
  if (s.k === 'key') keyCard(t, s);
  if (s.k === 'split') { const box = [0, 960, W, 960]; box.focusY = 1310; speakerVideo(t, cam, box); drawPanel(t, s); }
  if (s.k === 'full' || s.k === 'split') { bigs.forEach(b => drawBig(t, b)); if (!bigs.length) caption(t, s); }
  if (s.k === 'key' && s.tr === 'dive') { const f = 1 - prog(t, s.t0, 0.06); if (f > 0) { ctx.fillStyle = `rgba(255,244,232,${0.85 * f})`; ctx.fillRect(0, 0, W, H); } }
  const end = prog(t, DUR - 0.35, 0.35); if (end > 0) { ctx.fillStyle = `rgba(0,0,0,${end})`; ctx.fillRect(0, 0, W, H); }
}

/* ───────── sound: the owner's Style 1 pack on the R1 event pattern ───────── */
function sfxEvents() {
  const ev = [];
  SEG.forEach(s => { if (s.k === 'poster' || s.k === 'key') ev.push([s.t0 - 0.06, 'woosh-short.wav', 0.45]); if (s.k === 'split') ev.push([s.t0 - 0.04, 'fs.whoosh.swosh-whoosh-air-cut.wav', 0.4]); });
  BIG.forEach(b => { if (b.bigAt) ev.push([b.bigAt, 'fs.impact.punch2.wav', 0.42]); });
  const h = BIG[0]; ev.push([h.coding, 'fs.impact.punch2.wav', 0.4], [h.eng - 0.08, 'woosh-tight.wav', 0.35], [h.eng + 0.2, 'fs.impact.soft-hit.wav', 0.45]);
  const sx = BIG[1]; ev.push([sx.syn, 'fs.impact.punch2.wav', 0.4], [sx.strike, 'fs.ui.mouse-2-button-fast-click.wav', 0.4], [sx.flow, 'fs.impact.soft-hit.wav', 0.45]);
  const ww = BIG[4]; ev.push([ww.what, 'fs.impact.punch2.wav', 0.4], [ww.why, 'fs.impact.punch2.wav', 0.42]);
  SEG.filter(s => s.k === 'poster').forEach(s => s.lit && ev.push([s.lit, 'tonal.chime.wav', 0.3]));
  const sp = SEG.find(s => s.k === 'split'); [sp.fe, sp.be, sp.api].forEach(a => ev.push([Math.max(sp.t0 + 0.2, a), 'fs.ui.pop-4.wav', 0.35]));
  return ev.sort((a, b) => a[0] - b[0]);
}

/* ───────── load: words on the cut clock, the cut file, transport ───────── */
let CUTMAP = [];
const toCut = s => { for (const [a, b, o] of CUTMAP) if (s >= a - 0.001 && s <= b + 0.001) return o + (s - a); const nxt = CUTMAP.find(c => c[0] > s); return nxt ? nxt[2] : DUR; };
async function seekTo(t) { if (Math.abs(vid.currentTime - t) < 0.004 && vid.readyState >= 2) return; await new Promise(r => { const done = () => { vid.removeEventListener('seeked', done); r(); }; vid.addEventListener('seeked', done); vid.currentTime = Math.min(t, vid.duration - 0.05); }); }
let playing = false; const playBtn = document.getElementById('play'), seek = document.getElementById('seek'), tEl = document.getElementById('t');
playBtn.onclick = async () => { if (playing) vid.pause(); else await vid.play(); playing = !playing; playBtn.textContent = playing ? 'Pause' : 'Play'; };
seek.oninput = () => { vid.currentTime = +seek.value; };
function loop() { const t = vid.currentTime; frame(t); seek.value = t; tEl.textContent = `${t.toFixed(2)} / ${DUR.toFixed(1)}`; requestAnimationFrame(loop); }
(async () => {
  const CLIP = '/data/demo/edit/t1/';
  await Promise.all([document.fonts.load('400 100px Anton'), document.fonts.load('800 100px InterTight'), document.fonts.load('700 100px InterTight')]);
  CUTMAP = (await (await fetch(CLIP + 'cut.json')).json()).map;
  const WJ = await (await fetch(CLIP + 'words.json')).json(), raw = Array.isArray(WJ) ? WJ : WJ.words;
  WORDS = raw.map(w => ({ word: w.word, t: toCut(w.t), end: toCut(w.end ?? w.t + 0.2) }));
  for (let i = 1; i < WORDS.length; i++) if (WORDS[i].t < WORDS[i - 1].t) WORDS[i].t = WORDS[i - 1].t + 0.01;
  WORDS.forEach(w => { if (!(w.end > w.t)) w.end = w.t + 0.2; });
  const EDL = await (await fetch(CLIP + 'edl.json')).json();
  const raw2 = (EDL.faces || []).filter(f => f.conf > 0.5).map(f => ({ t: toCut(f.src_t), x: f.x, y: f.y, w: f.w, h: f.h })).sort((a, b) => a.t - b.t);
  FACES = raw2.map((f, i) => { const win = raw2.slice(Math.max(0, i - 3), i + 4), avg = k => win.reduce((n, g) => n + g[k], 0) / win.length; return { t: f.t, x: avg('x'), y: avg('y'), w: avg('w'), h: avg('h') }; }); // a steady frame, not a jittery one
  await new Promise(r => { if (vid.readyState >= 1) r(); else vid.onloadedmetadata = r; });
  DUR = vid.duration; seek.max = DUR;
  buildTextures(); buildEdit(); cachePoster3();
  const CUES = EV.map(([a, f, g]) => [a, f, g]);
  window.T1 = { frame: async t => { await seekTo(t); frame(t); }, CUES, END: DUR, AUDIO: CLIP + 'cut.mp4' };
  loop();
})();
