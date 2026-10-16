// The edit: timeline (from the voice's word timings), camera, captions, big words, transitions, sfx, transport.
// frame(t) is a pure function of t. The voice track is the reference's audio; the timing grid is its words.
'use strict';
const cv = document.getElementById('c'), main = cv.getContext('2d');
ctx = main;
const audio = document.getElementById('a'), vid = document.getElementById('v');
const norm = s => s.toLowerCase().replace(/[^a-z0-9-]/g, '');
function WT(w, after = 0, nth = 0) {
  const n = norm(w), hits = WORDS.filter(x => norm(x.word) === n && x.t >= after);
  return hits[nth] ?? { t: after, end: after + 0.4 };
}

/* ───────────── timeline ───────────── */
let SEG = [], CUTS = [], BIG = [], CHUNKS = [], CONDENSED = [], EV = [];
function buildEdit() {
  const k1 = at('number', 9) - 0.15, k1e = at('watching') - 0.25;
  // tr = how the segment enters. Panels: wipe / pixel / bars / bridge. Cards: flash / rack / whip / dive.
  // No transition three times in a row (§6).
  SEG = [
    { t0: 0, t1: 3.17, k: 'full' },
    { t0: 3.17, t1: 6.0, k: 'poster' },
    { t0: 6.0, t1: 6.57, k: 'full' },
    { t0: 6.57, t1: 8.97, k: 'split', p: 'icons3', tr: 'wipe' },
    { t0: 8.97, t1: k1, k: 'full' },
    { t0: k1, t1: k1e, k: 'key', n: 0, tr: 'flash', label: ['1. The Rough', 'Diagram Ritual'] },
    { t0: k1e, t1: 16.0, k: 'full' },
    { t0: 16.0, t1: 19.7, k: 'split', p: 'ritual', tr: 'pixel' },
    { t0: 19.7, t1: 21.5, k: 'full' },
    { t0: 21.5, t1: 23.87, k: 'split', p: 'notes', tr: 'wipe' },
    { t0: 23.87, t1: 25.8, k: 'key', n: 1, tr: 'rack', label: ['2. The PURE', 'Framework'] },
    { t0: 25.8, t1: 28.0, k: 'full' },
    { t0: 28.0, t1: 31.4, k: 'split', p: 'pure', tr: 'bars' },
    { t0: 31.4, t1: 32.23, k: 'full' },
    { t0: 32.23, t1: 36.9, k: 'split', p: 'berlin', tr: 'wipe' },
    { t0: 36.9, t1: 38.83, k: 'key', n: 2, tr: 'whip', label: ['3. Watering', 'the Garden'] },
    { t0: 38.83, t1: 42.57, k: 'full' },
    { t0: 42.57, t1: 45.9, k: 'split', p: 'garden', tr: 'pixel' },
    { t0: 45.9, t1: 48.33, k: 'key', n: 3, tr: 'dive', label: ['4. American', 'Ginseng'] },
    { t0: 48.33, t1: 49.37, k: 'full' },
    { t0: 49.37, t1: 52.63, k: 'split', p: 'brain', tr: 'wipe' },
    { t0: 52.63, t1: 57.07, k: 'full' },
    { t0: 57.07, t1: 61.57, k: 'split', p: 'product', tr: 'bars' },
    { t0: 61.57, t1: 63.63, k: 'key', n: 4, tr: 'rack', label: ['5. Pre-Learning'] },
    { t0: 63.63, t1: 999, k: 'full' },
  ];
  CUTS = [0, 3.17, 6, 6.57, 8.97, 16, 19.7, 21.5, 23.87, 25.8, 28, 31.4, 32.23, 34.2, 35, 36.9, 38.83, 42.57, 45.9, 48.33, 49.37, 52.63, 57.07, 61.57, 63.63, 69.57, 72.2, 76.4, 80.2, 84.1, k1, k1e].sort((a, b) => a - b);

  const vWatch = WT('watching'), vVid = WT('video,', vWatch.t);
  const wWaste = WT('waste', vVid.t), wOf = WT('of', wWaste.t);
  const spend = WT('spend'), look = WT('looking', spend.t), imag = WT('imaginary');
  const mem = WT('memorable.'), comm = WT('comment', 80);
  const words = (list, after) => list.map(s => ({ s, at: at(s, after) }));
  BIG = [
    { t0: 0.5, t1: 3.17, k: 'hook' },
    { t0: vWatch.t, t1: vVid.end + 0.3, k: 'low', small: words(['watching', 'a'], 12), big: 'VIDEO', bigAt: vVid.t, y: 1450, smallY: 1150, maxW: 600 },
    { t0: at('which', vVid.t), t1: 16.0, k: 'top', small: words(['which', 'is', 'actually', 'a', 'complete'], vVid.t), big: 'WASTE', bigAt: wWaste.t, y: 600, smallY: 290, maxW: 700, behind: true, after: { s: 'of', at: wOf.t, x: 200, y: 676 }, after2: { s: 'time', at: at('time.', wOf.t), x: 880, y: 676 } },
    { t0: at('neurogum', 55) - 0.08, t1: 57.07, k: 'top', small: [], big: 'NEUROGUM', bigAt: at('neurogum', 55), y: 525, maxW: 820, behind: true },
    { t0: spend.t, t1: look.t, k: 'left', small: [{ s: 'spend', at: spend.t }], big: '5-10', bigAt: at('five', spend.t), big2: 'MINUTES', big2At: at('minutes', spend.t), x: 150, y: 600, smallY: 390 },
    { t0: look.t, t1: imag.t - 0.05, k: 'headings', look: look.t, head: at('headings', 66), chap: at('chapter', 66), names: at('names', 67), keyw: at('keywords', 67) },
    { t0: imag.t - 0.12, t1: imag.end + 0.55, k: 'low', small: [{ s: 'with', at: imag.t - 0.12 }], big: 'IMAGINARY', bigAt: imag.t, y: 1430, smallY: 1160, maxW: 800 },
    { t0: at('makes', 77), t1: mem.end + 0.6, k: 'top', small: words(['&', 'that', 'makes', 'it', 'much', 'more'].map(s => s === '&' ? 'and' : s), 77).map(w => ({ ...w, s: w.s === 'and' ? '&' : w.s })), big: 'MEMORABLE', bigAt: mem.t, y: 495, smallY: 272, maxW: 850, behind: true, smallPx: 36 },
    { t0: comm.t, t1: 999, k: 'cta', at: comm.t },
  ];
  // "&" has no word of its own: it arrives with "that"
  BIG[7].small[0].at = BIG[7].small[1].at - 0.05;
  CONDENSED = [[at('american', 48) - 0.01, WT('jinxer,', 48).end + 0.1]];
  buildCaptions();
  EV = sfxEvents();
}
function buildCaptions() {
  CHUNKS = []; let cur = [];
  const flush = () => { if (cur.length) CHUNKS.push({ t0: cur[0].t, words: cur }); cur = []; };
  WORDS.forEach((w, i) => {
    const prev = WORDS[i - 1];
    if (cur.length && (cur.length >= 3 || cur.map(x => x.word).join(' ').length + w.word.length > 14 || (prev && w.t - prev.end > 0.28) || /[.,?!]$/.test(prev?.word ?? ''))) flush();
    cur.push(w);
  });
  flush();
  CHUNKS.forEach((c, i) => { c.t1 = Math.min(CHUNKS[i + 1]?.t0 ?? c.t0 + 1.2, c.t0 + 1.6); });
}
const fixText = s => s.replace(/\bjinxer\b/i, 'Ginseng').replace(/\bsphere\b/i, 'PURE').replace(/l-t-n-n/i, 'L-theanine').replace(/\bgap\b/i, 'gum').replace(/^and$/i, '&');

/* ───────────── camera: a new framing on every jump cut; lands slightly big and settles (cut in on motion),
   then drifts; punches on the slams. Parallax planes inherit it by depth. ───────────── */
function camAt(t) {
  let i = 0; for (let j = 0; j < CUTS.length; j++) if (CUTS[j] <= t) i = j;
  const since = t - CUTS[i];
  const base = [1.0, 1.12, 1.04, 1.18, 1.08][i % 5], ox = (rand(i * 11) - 0.5) * 70, oy = (rand(i * 13) - 0.5) * 50;
  let s = base * (1 + 0.035 * Math.exp(-since / 0.16)) * (1 + 0.011 * since);
  // punch on a slam: log push of 7% in 0.18 s that holds (and keeps drifting)
  for (const b of BIG) if (b.bigAt && t >= b.bigAt && t < b.t1) s *= logLerp(1, 1.07, E.out(prog(t, b.bigAt, 0.18)));
  // the outro: one continuous push to the end
  if (t > 86.0) s *= logLerp(1, 1.16, E.ramp(prog(t, 86.0, 2.6)));
  // the hook: accelerating push into the poster cut (push-in cut on motion)
  if (t > 2.9 && t < 3.17) s *= logLerp(1, 1.22, E.in(prog(t, 2.9, 0.27)));
  return { s, ox: ox + noise(t * 0.3, i) * 10, oy: oy + noise(t * 0.3, i + 50) * 8, fy: 900 };
}

/* ───────────── captions: 1-3 words, word by word, the line re-flowing as it grows ───────────── */
function caption(t, s) {
  const c = CHUNKS.find(c => t >= c.t0 && t < c.t1); if (!c) return;
  const cond = CONDENSED.some(([a, b]) => t >= a && t < b);
  const y = s.k === 'split' ? 990 : 1205;
  const ws = c.words.map((w, i) => ({ s: fixText(cond ? w.word.toUpperCase().replace(/,$/, '') : w.word), at: Math.max(w.t - 0.03, c.t0 - 0.03 + i * 0.02) }));
  if (cond) {
    wordLine(t, ws.map(w => ({ ...w, s: fixText(w.s).toUpperCase() })), 540, y + 10, { px: 96, w: 400, fam: F.cond, gap: 22, dur: 0.24, rise: 16, shadowBlur: 28 });
  } else {
    wordLine(t, ws, 540, y, { px: 66, w: 800, dur: 0.26, rise: 12, shadowBlur: 26, shadowA: 0.7 });
  }
}

/* ───────────── big words ───────────── */
function drawBig(t, b, phase) {
  const front = phase === 'front';
  if (b.k === 'hook' && front) return hook(t);
  if (b.k === 'low' && front) {
    wordLine(t, b.small, 540, b.smallY ?? b.y - 230, { px: 58, w: 800, rise: 12 });
    slam(t, b.big, 540, b.y, b.bigAt, { px: 340, maxW: b.maxW, S0: 1.5 });
  }
  if (b.k === 'top') {
    if (front && b.small.length) wordLine(t, b.small, 540, b.smallY ?? 290, { px: b.smallPx ?? 34, w: 700, gap: b.smallPx ? 10 : 30, rise: 8, shadowBlur: 16 });
    if (phase === (b.behind ? 'behind' : 'front')) slam(t, b.big, 540, b.y, b.bigAt, { px: 360, maxW: b.maxW, S0: 1.4, shadow: !b.behind, shadowA: 0.35 });
    if (front && b.after) wordLine(t, [b.after], b.after.x, b.after.y, { px: 42, w: 800, align: 'left', reflow: false });
    if (front && b.after2) wordLine(t, [b.after2], b.after2.x, b.after2.y, { px: 42, w: 800, align: 'right', reflow: false });
  }
  if (b.k === 'left' && front) {
    wordLine(t, b.small, b.x, b.smallY, { px: 58, w: 800, align: 'left', reflow: false });
    ctx.save(); ctx.translate(b.x, 0); slam(t, b.big, 0, b.y, b.bigAt, { px: 220, maxW: 300, S0: 1.45, align: 'left' }); ctx.restore();
  }
  if (b.k === 'left' && phase === 'behind' && b.big2) {
    slam(t, b.big2, b.x + 310, b.y, b.big2At, { px: 220, maxW: 560, S0: 1.4, align: 'left', shadow: false });
  }
  if (b.k === 'headings' && front) {
    wordLine(t, [{ s: 'looking', at: b.look }, { s: 'at', at: at('at', b.look) }], 80, 300, { px: 60, w: 800, align: 'left', reflow: false });
    slam(t, 'HEADINGS', 80, 540, b.head, { px: 300, maxW: 740, S0: 1.35, align: 'left' });
    // the stack builds from the bottom: CHAPTER, NAMES joins it, KEYWORDS right-aligned under
    slam(t, 'CHAPTER', 160, 1340, b.chap, { px: 190, maxW: 420, S0: 1.35, align: 'left' });
    slam(t, 'NAMES', 600, 1340, b.names, { px: 190, maxW: 330, S0: 1.35, align: 'left' });
    slam(t, 'KEYWORDS', 990, 1530, b.keyw, { px: 190, maxW: 640, S0: 1.35, align: 'right' });
  }
  if (b.k === 'cta' && front) cta(t, b.at);
}
// the hook: a fake progress timer, then 66 SECONDS rolls into 5 SECRETS like a slot counter, count dots on "secrets"
function hook(t) {
  // progress bar: it is already moving on frame 1
  const bx0 = 150, bx1 = 930, by = 232, p = 0.03 + 0.05 * t;
  const out = E.in(prog(t, 2.95, 0.22));
  ctx.save(); ctx.globalAlpha = 1 - out; ctx.translate(0, -out * 30);
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(bx0, by); ctx.lineTo(bx1, by); ctx.stroke();
  const hx = bx0 + (bx1 - bx0) * p;
  ctx.strokeStyle = '#e8242a'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(bx0, by); ctx.lineTo(hx, by); ctx.stroke();
  bloom(hx, by, 44, 'rgba(255,60,60,0.45)'); ctx.fillStyle = '#ff2b31'; ctx.beginPath(); ctx.arc(hx, by, 13, 0, 7); ctx.fill();
  font(28, 600); ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; shade(true, 10, 0.5, 2); ctx.fillText(`0:0${Math.min(9, Math.floor(t))}`, bx0, by + 50);
  // "1:06" arrives with the words "66 seconds" (the verb of the line)
  const s66 = at('66');
  if (t >= s66) { ctx.globalAlpha *= clamp((t - s66) * 6); ctx.textAlign = 'right'; ctx.fillText('1:06', bx1, by + 50 + (1 - E.out(prog(t, s66, 0.3))) * 10); }
  ctx.restore();
  // 66 SECONDS -> 5 SECRETS
  const tNum = at('66'), tSec = at('seconds,'), t5 = at('5', 1.5), tSecrets = at('secrets');
  const y = 520;
  if (t < tNum) return;
  const roll = E.ramp(prog(t, t5 - 0.06, 0.3)), rollW = E.ramp(prog(t, tSecrets - 0.12, 0.32));
  const A = ['66', 'SECONDS'], B = ['5', 'SECRETS'];
  const px = 200; font(px, 400, F.cond);
  const sp = px * 0.22;
  const numW = lerp(tw_(A[0]), tw_(B[0]), roll);
  const charsA = A[1].split(''), charsB = B[1].split('');
  const cws = charsA.map((c, i) => lerp(tw_(c), tw_(charsB[i]), E.ramp(prog(t, stagger(tSecrets - 0.12, i, 0.025, 4), 0.3))));
  const wordW = t >= tSec ? cws.reduce((a, b) => a + b, 0) : 0;
  const tot = numW + (wordW ? sp + wordW : 0) * E.out(prog(t, tSec, 0.3));
  let x = 540 - tot / 2;
  const enter = logPull(1.25, E.out(prog(t, tNum, 0.3)));
  ctx.save(); ctx.translate(540, y - px * 0.36); ctx.scale(enter, enter); ctx.translate(-540, -(y - px * 0.36));
  bloom(540, y - 70, 420, 'rgba(255,255,255,0.16)');
  // slot band clip so rolling glyphs leave through the top and enter from the bottom
  const slotDraw = (a, b, k, cx) => {
    ctx.save(); ctx.beginPath(); ctx.rect(cx - 10, y - px * 0.82, 1200, px * 0.92); ctx.clip();
    shade(true, 30, 0.45, 6); ctx.fillStyle = '#fff'; ctx.textAlign = 'left';
    if (a === b || k <= 0) ctx.fillText(k >= 1 ? b : a, cx, y);
    else {
      const off = E.ramp(k) * px * 0.9;
      ctx.globalAlpha = 1 - k; ctx.filter = `blur(${(Math.sin(k * Math.PI) * 6 + 0.3).toFixed(1)}px)`; ctx.fillText(a, cx, y - off);
      ctx.globalAlpha = k; ctx.fillText(b, cx, y + px * 0.9 - off);
    }
    ctx.restore();
  };
  slotDraw(A[0], B[0], roll, x); x += numW;
  if (t >= tSec) {
    x += sp;
    const wk = E.out(prog(t, tSec, 0.3));
    charsA.forEach((c, i) => {
      const k = prog(t, stagger(tSecrets - 0.12, i, 0.025, 4), 0.3);
      ctx.save(); ctx.globalAlpha = wk; slotDraw(c, charsB[i], k, x + (1 - wk) * 30); ctx.restore(); x += cws[i];
    });
  }
  ctx.restore();
  // count dots: five, on "secrets", popped with springs and jitter; they rush to the centre before the cut
  for (let i = 0; i < 5; i++) {
    const st = stagger(tSecrets + 0.02, i, 0.07, 8), k = spring(t - st, 'pop'); if (t < st) continue;
    const suck = E.in(prog(t, 2.86 + i * 0.015, 0.28));
    const dx = 300 + i * 120, dy = 1180 + Math.sin(i * 1.9) * 26 + Math.sin((t - st) * 2 + i) * 4;
    ctx.save(); ctx.translate(lerp(dx, 540, suck), lerp(dy, 900, suck)); ctx.scale(k * (1 - suck * 0.6), k * (1 - suck * 0.6));
    ctx.fillStyle = '#fff'; shade(true, 14, 0.5, 3); ctx.beginPath(); ctx.arc(0, 0, 15, 0, 7); ctx.fill(); ctx.restore();
  }
}
function cta(t, t0) {
  wordLine(t, [{ s: 'comment', at: t0 }], 540, 1120, { px: 46, w: 800 });
  const q = t0 + 0.32;
  // the word slams, its quotes arrive a beat later from either side
  slam(t, 'MEMORY', 540, 1375, q, { px: 300, maxW: 640, S0: 1.5 });
  for (const side of [-1, 1]) {
    const qt = q + 0.09 + (side > 0 ? 0.05 : 0), k = spring(t - qt, 'pop'); if (t < qt) continue;
    ctx.save(); ctx.translate(540 + side * (360 + (1 - k) * 80), 1300); ctx.globalAlpha = clamp((t - qt) * 10);
    font(260, 400, F.cond); ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; shade(true, 24, 0.4, 6); ctx.fillText(side < 0 ? '“' : '”', 0, 110); ctx.restore();
  }
  wordLine(t, ['&', 'I', 'will', 'share', 'them'].map((s, i) => ({ s, at: q + 0.35 + i * 0.07 + rand(i + 3) * 0.03 })), 540, 1450, { px: 42, w: 800 });
}

/* ───────────── compositing ───────────── */
const PANEL = makeCanvas(1080, 960), pctx = PANEL.getContext('2d');
function drawPanel(t, s) {
  const keep = ctx; ctx = pctx; ctx.save(); ctx.clearRect(0, 0, 1080, 960); PANELS[s.p](t, s); ctx.restore(); ctx = keep;
  const d = t - s.t0;
  ctx.save();
  if (s.tr === 'wipe') {
    // wipe down, entering at speed; ghosts trail along the velocity (directional motion blur)
    const Y = tt => -960 * (1 - E.out(prog(tt, s.t0 - 0.03, 0.34)));
    const y = Y(t), v = Math.abs(vel(Y, t)), n = v > 3 ? Math.min(4, Math.ceil(shutter(v) / 4)) : 0;
    for (let i = n; i >= 1; i--) { ctx.globalAlpha = 0.18; ctx.drawImage(PANEL, 0, y - i * v * 0.25); }
    ctx.globalAlpha = 1; ctx.drawImage(PANEL, 0, y);
    seam(y + 960);
  } else if (s.tr === 'pixel') {
    // pixel-block dissolve in brand crimson: 54px blocks, seeded order, 7 frames
    const k = prog(t, s.t0, 0.12);
    if (k >= 1) ctx.drawImage(PANEL, 0, 0);
    else {
      ctx.beginPath(); const B = 54;
      for (let by = 0; by < 960 / B + 1; by++) for (let bx = 0; bx < 20; bx++) if (rand(bx * 97 + by * 13 + 5) < k * 1.15) ctx.rect(bx * B, by * B, B, B);
      ctx.save(); ctx.clip(); ctx.drawImage(PANEL, 0, 0); ctx.restore();
      ctx.beginPath(); for (let by = 0; by < 18; by++) for (let bx = 0; bx < 20; bx++) { const r = rand(bx * 97 + by * 13 + 5); if (r >= k * 1.15 && r < k * 1.15 + 0.12) ctx.rect(bx * B, by * B, B, B); }
      ctx.fillStyle = C.crimsonHot; ctx.fill();
    }
    seam(960);
  } else if (s.tr === 'bars') {
    // six bars slide in from alternating sides, jittered, each landing with the out ramp
    ctx.beginPath(); const bh = 160;
    for (let i = 0; i < 6; i++) { const k = E.out(prog(t, stagger(s.t0 - 0.02, i, 0.035, 12), 0.3)), dir = i % 2 ? 1 : -1; ctx.rect(dir * (1 - k) * 1080, i * bh, 1080, bh + 1); }
    ctx.save(); ctx.clip(); ctx.drawImage(PANEL, 0, 0); ctx.restore();
    seam(960);
  } else { ctx.drawImage(PANEL, 0, 0); seam(960); }
  ctx.restore();
}
function seam(y) { const g = ctx.createLinearGradient(0, y, 0, y + 26); g.addColorStop(0, 'rgba(0,0,0,0.45)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, y, W, 26); }

function segAt(t) { return SEG.find(s => t >= s.t0 && t < s.t1) ?? SEG[SEG.length - 1]; }
function frame(t) {
  ctx = main; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.filter = 'none';
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  const s = segAt(t), bigs = BIG.filter(b => t >= b.t0 && t < b.t1), cam = camAt(t);
  if (s.k === 'full') speakerScene(t, cam, [0, 0, W, H], () => bigs.forEach(b => drawBig(t, b, 'behind')));
  if (s.k === 'poster') heroPoster(t, s.t0);
  if (s.k === 'key') card(t, s);
  if (s.k === 'split') {
    const box = [0, 960, W, 960]; box.scale = 1; box.focusY = 1000;
    // under the incoming panel: the outgoing full-frame shot keeps playing until the panel covers it
    if (t - s.t0 < 0.45) { const top = [0, 0, W, 960]; top.scale = 1; top.focusY = 480; speakerScene(t, camAt(s.t0 - 0.01), top, null); }
    speakerScene(t, cam, box, null);
    drawPanel(t, s);
  }
  if (s.k === 'full' || s.k === 'split') {
    bigs.forEach(b => drawBig(t, b, 'front'));
    if (!bigs.some(b => b.k !== 'cta' || t >= b.at)) caption(t, s);
  }
  // flash on motion: 2 frames of warm white as the card is already zooming
  if (s.k === 'key' && s.tr === 'flash') { const f = 1 - prog(t, s.t0, 0.06); if (f > 0) { ctx.fillStyle = `rgba(255,244,232,${0.85 * f})`; ctx.fillRect(0, 0, W, H); } }
  // the only fade: the last 0.35 s to black
  const end = prog(t, 88.25, 0.35); if (end > 0) { ctx.fillStyle = `rgba(0,0,0,${end})`; ctx.fillRect(0, 0, W, H); }
}

/* ───────────── sound: sparse library sfx on events; one keystroke per typed word ───────────── */
let AC = null, master = null; const SFXBUF = {}, fired = new Set();
const SFXGAIN = { whoosh: 0.5, swipe: 0.42, hit: 0.4, pop: 0.32, key: 0.16, tick: 0.14 };
async function loadSfx() { for (const k of ['whoosh', 'hit', 'pop', 'swipe']) { try { SFXBUF[k] = await AC.decodeAudioData(await (await fetch(`sfx/${k}.wav`)).arrayBuffer()); } catch (e) { console.warn('sfx', k, e); } } }
function sfx(kind) {
  if (!AC || !document.getElementById('sfx').checked) return;
  const src = { key: 'pop', tick: 'pop' }[kind] ?? kind; if (!SFXBUF[src]) return;
  const n = AC.createBufferSource(), g = AC.createGain(); n.buffer = SFXBUF[src];
  if (kind === 'key') n.playbackRate.value = 2.4; if (kind === 'tick') n.playbackRate.value = 1.7;
  g.gain.value = SFXGAIN[kind]; n.connect(g); g.connect(master); n.start();
}
function sfxEvents() {
  const ev = [];
  SEG.forEach(s => { if (s.k === 'poster' || s.k === 'key') ev.push([s.t0 - 0.06, 'whoosh']); if (s.k === 'split') ev.push([s.t0 - 0.04, s.tr === 'pixel' ? 'tick' : 'swipe']); });
  BIG.forEach(b => { if (b.bigAt) ev.push([b.bigAt, 'hit']); if (b.big2At) ev.push([b.big2At, 'pop']); });
  ev.push([at('66'), 'hit'], [at('5', 1.5), 'tick'], [at('forget', 3), 'hit']);
  for (let i = 0; i < 5; i++) ev.push([stagger(at('secrets') + 0.02, i, 0.07, 8), 'tick']);
  const hb = BIG.find(b => b.k === 'headings'); ev.push([hb.head, 'hit'], [hb.chap, 'hit'], [hb.names, 'pop'], [hb.keyw, 'hit']);
  const cb = BIG.find(b => b.k === 'cta'); ev.push([cb.at + 0.32, 'hit']);
  // icon pops and PURE letters
  ['names,', 'numbers,', 'read'].forEach(w => ev.push([Math.max(6.62, at(w, 6) - 0.12), 'pop']));
  ['after', '5', 'draw'].forEach(w => ev.push([Math.max(16.04, at(w, 16) - 0.1), 'pop']));
  ['personal,', 'useful,', 'relevant,', 'emotional.'].forEach(w => ev.push([at(w, 27) - 0.06, 'pop']));
  // keystrokes: one per typed word (berlin examples, product bullets)
  ['berlin', 'wall', 'fell', 'in', '1989,'].forEach(w => ev.push([at(w, 31.5), 'key']));
  ['say', 'the', 'wall', 'fell', '11', 'years', 'before', 'my', 'birthday.'].forEach(w => ev.push([at(w, 34), 'key']));
  ['ginseng,', 'l-t-n-n', 'b-vitamins.'].forEach(w => ev.push([at(w, 57), 'key']));
  ev.push([at('six', 51), 'tick']);
  return ev.sort((a, b) => a[0] - b[0]);
}

/* ───────────── transport ───────────── */
let playing = false;
const playBtn = document.getElementById('play'), seek = document.getElementById('seek'), tEl = document.getElementById('t'), cmp = document.getElementById('cmp');
function ensureAudio() {
  if (AC) return; AC = new AudioContext(); master = AC.createGain(); master.gain.value = 0.9; master.connect(AC.destination); loadSfx();
}
playBtn.onclick = async () => {
  ensureAudio(); await AC.resume();
  if (playing) { audio.pause(); vid.pause(); } else { await audio.play(); if (cmp.checked) { vid.currentTime = audio.currentTime; vid.play(); } }
  playing = !playing; playBtn.textContent = playing ? 'Pause' : 'Play';
};
seek.oninput = () => { audio.currentTime = +seek.value; vid.currentTime = +seek.value; fired.clear(); EV.forEach(([a], i) => { if (a < +seek.value) fired.add(i); }); };
cmp.onchange = () => { document.body.classList.toggle('cmp', cmp.checked); vid.currentTime = audio.currentTime; if (playing && cmp.checked) vid.play(); };
audio.onended = () => { playing = false; playBtn.textContent = 'Play'; };
function loop() {
  const t = audio.currentTime;
  if (playing) EV.forEach(([a, k], i) => { if (!fired.has(i) && t >= a && t - a < 0.15) { fired.add(i); sfx(k); } });
  if (playing && cmp.checked && Math.abs(vid.currentTime - t) > 0.15) vid.currentTime = t;
  frame(t); seek.value = t; tEl.textContent = `${t.toFixed(2)} / 88.6`;
  requestAnimationFrame(loop);
}

/* ───────────── check mode: ?grid=t1,t2,... renders our frames above the reference frames (../f, 2 fps) ───────────── */
async function grid(times) {
  const cols = Math.min(6, times.length), rows = Math.ceil(times.length / cols), tw = 270, th = 480;
  const out = makeCanvas(cols * tw, rows * th * 2 + rows * 8), o = out.getContext('2d'); o.fillStyle = '#111'; o.fillRect(0, 0, out.width, out.height);
  for (let i = 0; i < times.length; i++) {
    const t = times[i], cx = (i % cols) * tw, cy = Math.floor(i / cols) * (th * 2 + 8);
    frame(t); o.drawImage(cv, cx, cy, tw, th);
    const img = new Image(); img.src = `../f/${String(Math.round(t * 2) + 1).padStart(3, '0')}.jpg`;
    await img.decode().catch(() => {}); if (img.width) o.drawImage(img, cx, cy + th, tw, th);
    o.fillStyle = '#ff0'; o.font = '600 18px sans-serif'; o.fillText(t.toFixed(2), cx + 6, cy + 20);
  }
  document.body.innerHTML = ''; document.body.style.background = '#111'; out.style.width = '100%'; document.body.appendChild(out);
  const save = new URLSearchParams(location.search).get('save'); // dev only: hand the sheet to a local sink
  if (save) await fetch(`http://127.0.0.1:4329/${save}`, { method: 'POST', body: out.toDataURL('image/jpeg', 0.8) }).catch(() => {});
  window.__gridDone = true;
}

(async () => {
  await Promise.all([document.fonts.load('400 100px Anton'), document.fonts.load('800 100px InterTight'), document.fonts.load('700 100px InterTight')]);
  WORDS = await (await fetch('../words.json')).json();
  for (let i = 1; i < WORDS.length; i++) if (WORDS[i].t < WORDS[i - 1].t) WORDS[i].t = WORDS[i - 1].t + 0.01; // Whisper has a few out-of-order stamps
  WORDS.forEach(w => { if (!(w.end > w.t)) w.end = w.t + 0.2; });
  buildTextures(); buildEdit(); cachePoster();
  const q = new URLSearchParams(location.search);
  if (q.has('grid')) return grid(q.get('grid').split(',').map(Number));
  if (q.has('t')) audio.currentTime = +q.get('t');
  loop();
})();
