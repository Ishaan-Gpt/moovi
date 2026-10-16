// R2: the timeline (from the voice's word stamps), desk state, camera, two-tier captions, big words, transitions,
// sfx, transport. frame(t) is a pure function of t. The voice track is the reference's audio.
'use strict';
const cv = document.getElementById('c'), main = cv.getContext('2d');
ctx = main;
const audio = document.getElementById('a'), vid = document.getElementById('v');
const norm = s => s.toLowerCase().replace(/[^a-z0-9-]/g, '');
function WT(w, after = 0, nth = 0) { const n = norm(w), hits = WORDS.filter(x => norm(x.word) === n && x.t >= after); return hits[nth] ?? { t: after, end: after + 0.4 }; }
const at = (w, after = 0, nth = 0) => WT(w, after, nth).t;
const DUR = 83.7;

/* ───────────── timeline ───────────── */
let SEG = [], CUTS = [], OVER = [], CHUNKS = [], EV = [], KNIGHT = [];
function buildEdit() {
  // k: full (speaker) | ins (a full-frame insert drawn by `d`). tr: how it enters (cut / flash / whip / coin / pixel / dive)
  SEG = [
    { t0: 0, t1: 3.44, k: 'full' },
    { t0: 3.44, t1: 4.72, k: 'ins', d: photo, tr: 'whip' },
    { t0: 4.72, t1: 5.96, k: 'ins', d: photo, bw: true, labelAt: 4.78, appAt: at('built', 5) },
    { t0: 5.96, t1: 12.2, k: 'full' },
    { t0: 12.2, t1: 13.3, k: 'ins', d: reveal, tr: 'flash', wordAt: [at('himself', 11.5), at('revealed', 11.8)] },
    { t0: 13.3, t1: 14.4, k: 'ins', d: orbit, tr: 'pixel', iconsAt: at('ai', 13.3) },
    { t0: 14.4, t1: 20.3, k: 'full' },
    { t0: 20.3, t1: 24.84, k: 'ins', d: crush, tr: 'whip', badgeAt: at('master', 21), crushAt: at('crush', 23), youAt: at('you', 24), shatterAt: at('future.', 24) },
    { t0: 24.84, t1: 33.4, k: 'full' },
    { t0: 33.4, t1: 35.36, k: 'ins', d: levelWorld, n: 0, tr: 'coin' },
    { t0: 35.36, t1: 36.04, k: 'full' },
    { t0: 36.04, t1: 38.0, k: 'ins', d: board, p: 'l1', tr: 'pixel', ats: [at('tweaking,', 36), at('hosting.', 36)] },
    { t0: 38.0, t1: 38.64, k: 'full' },
    { t0: 38.64, t1: 40.4, k: 'ins', d: levelWorld, n: 1, tr: 'coin' },
    { t0: 40.4, t1: 44.2, k: 'full' },
    { t0: 44.2, t1: 45.28, k: 'ins', d: levelWorld, n: 2, tr: 'coin' },
    { t0: 45.28, t1: 46.64, k: 'ins', d: punch, tr: 'cut', ats: [at('real', 45), at('backend', 45), at('deployment,', 45)] },
    { t0: 46.64, t1: 49.75, k: 'full' },
    { t0: 49.75, t1: 52.6, k: 'ins', d: board, p: 'cta', tr: 'whip', ats: [at('comment', 49.5)] },
    { t0: 52.6, t1: 53.4, k: 'ins', d: levelWorld, n: 3, tr: 'coin' },
    { t0: 53.4, t1: 57.84, k: 'ins', d: board, p: 'game', tr: 'pixel', ats: [at('tic-tac-toe', 53), at('flappy', 54)] },
    { t0: 57.84, t1: 59.08, k: 'full' },
    { t0: 59.08, t1: 61.2, k: 'ins', d: levelWorld, n: 4, tr: 'coin' },
    { t0: 61.2, t1: 70.0, k: 'full' },
    { t0: 70.0, t1: 71.2, k: 'dive' },
    { t0: 71.2, t1: 76.24, k: 'full' },
    { t0: 76.24, t1: 78.4, k: 'ins', d: board, p: 'tool', tr: 'whip', ats: [at('never', 76)] },
    { t0: 78.4, t1: 999, k: 'full' },
  ];
  CUTS = [0, 3.44, 4.72, 5.96, 7.96, 9.2, 10.68, 11.6, 12.2, 14.4, 15.68, 17.6, 20.3, 21.64, 24.84, 27.4, 29.0, 31.2, 33.4, 35.36, 38.0, 40.4, 42.2, 46.64, 48.4, 50.6, 57.84, 61.2, 63.4, 64.7, 67.6, 71.2, 73.3, 75.0, 78.4, 80.0, 82.24];
  // the knight: which chip marks the level being talked about (rightmost chip = level 1). [time, chip index]
  KNIGHT = [[at('learn', 35), 4], [at('web', 38), 3], [at('real', 45) + 1.5, 2], [at('conditions.', 57), 1], [at('ai', 60.5), 0], [at('level', 65), 0], [at('level', 66.8), 4], [at('follow', 71), 4]];

  const o = [];
  // hook: "the story of this" + 18 YO behind the head; "student" with a hand arrow down to the photo in his hand
  o.push({ t0: 0.05, t1: 3.44, k: 'hook' });
  o.push({ t0: 5.96, t1: 7.96, k: 'article', growAt: at('500', 6) - 0.05, hiAt: at('crores', 6) });
  o.push({ t0: at('in', 7.5) - 0.05, t1: 9.2, k: 'inJust', bigAt: at('18', 8) });
  o.push({ t0: at('18,', 15.5), t1: 17.6, k: 'years', ats: [at('18,', 15.5), at('19', 16), at('20', 16.5)], yearsAt: at('years', 16.8), oldAt: at('old', 17) });
  o.push({ t0: 26.0, t1: 28.7, k: 'projects', ats: [at('five', 26), at('build', 27), at('week', 27.5)] });
  o.push({ t0: at('user', 41) - 0.1, t1: 44.2, k: 'icons', ats: [at('user', 41), at('data', 42), at('simple', 43)] });
  o.push({ t0: 82.0, t1: 999, k: 'cta', at: at('come', 82) });
  OVER = o;
  buildCaptions();
  EV = sfxEvents();
}
// captions: two tiers. Chunk ≤ 3 words / ≤ 16 chars; the strongest word is big, the rest small above and below it.
const STOP = new Set(['the', 'a', 'an', 'of', 'to', 'in', 'and', 'or', 'is', 'it', 'it.', 'this', 'that', 'you', "you're", 'be', 'for', 'on', 'if', 'he', 'they', 'was', 'with', 'like', 'just', 'so', 'are', 'your', 'will', 'can']);
function buildCaptions() {
  CHUNKS = []; let cur = [];
  const flush = () => { if (cur.length) CHUNKS.push({ t0: cur[0].t, words: cur }); cur = []; };
  WORDS.forEach((w, i) => {
    const prev = WORDS[i - 1];
    if (cur.length && (cur.length >= 3 || cur.map(x => x.word).join(' ').length + w.word.length > 16 || (prev && w.t - prev.end > 0.28) || /[.,?!]$/.test(prev?.word ?? ''))) flush();
    cur.push(w);
  });
  flush();
  CHUNKS.forEach((c, i) => { c.t1 = Math.min(CHUNKS[i + 1]?.t0 ?? c.t0 + 1.2, c.t0 + 1.6);
    const score = w => (STOP.has(norm(w.word)) ? 0 : norm(w.word).length + (/\d/.test(w.word) ? 4 : 0));
    c.key = c.words.length > 1 ? c.words.reduce((b, w, j) => (score(w) > score(c.words[b]) ? j : b), 0) : 0; });
}
const fixText = s => s.replace(/\bzach\b/i, 'he').replace(/\btarun\b/i, 'GUIDE').replace(/\bemogen\b/i, 'it').replace(/\bemoji\.?/i, 'pro.').replace(/x-men snacker/i, 'habit tracker');

/* ───────────── desk state + camera ───────────── */
function deskAt(t) {
  const five = at('five', 26) - 0.1, on = (t >= five && t < 40.4) || t >= 46.64;
  DESK.chips = on ? (t < five + 1 ? t - five : 5) : 0;
  DESK.nums = t >= at('exact', 28) && t < 29.2 ? t - at('exact', 28) : 0;
  let k = -1; for (const [a, i] of KNIGHT) if (t >= a) k = i; DESK.knight = k;
  DESK.lift = t >= at('level', 65) && t < 66.4 ? 0 : t >= at('level', 66.8) && t < 68 ? 4 : -1;
}
function camAt(t) {
  let i = 0; for (let j = 0; j < CUTS.length; j++) if (CUTS[j] <= t) i = j;
  const since = t - CUTS[i];
  const base = [1.0, 1.1, 1.04, 1.16, 1.07][i % 5], ox = (rand(i * 11 + 3) - 0.5) * 70, oy = (rand(i * 13 + 3) - 0.5) * 50;
  let s = base * (1 + 0.035 * Math.exp(-since / 0.16)) * (1 + 0.011 * since);
  for (const b of OVER) { const ba = b.bigAt ?? (b.ats ? b.ats[b.ats.length - 1] : null); if (ba && t >= ba && t < b.t1) s *= logLerp(1, 1.06, E.out(prog(t, ba, 0.18))); }
  if (t > 82.0) s *= logLerp(1, 1.14, E.ramp(prog(t, 82.0, DUR - 82)));
  return { s, ox: ox + noise(t * 0.3, i) * 10, oy: oy + noise(t * 0.3, i + 50) * 8, fy: 900 };
}

/* ───────────── captions ───────────── */
function caption(t, y = 1230) {
  const c = CHUNKS.find(c => t >= c.t0 && t < c.t1); if (!c) return;
  const ws = c.words.map((w, i) => ({ s: fixText(w.word), at: Math.max(w.t - 0.03, c.t0 - 0.03 + i * 0.02) }));
  if (ws.length === 1) return wordLine(t, ws, 540, y, { px: 76, w: 800, dur: 0.26, rise: 12, shadowBlur: 26, shadowA: 0.7 });
  const before = ws.slice(0, c.key), key = ws[c.key], after = ws.slice(c.key + 1);
  if (before.length) wordLine(t, before, 540, y - 92, { px: 44, w: 800, dur: 0.24, rise: 8, shadowBlur: 20, shadowA: 0.7 });
  wordLine(t, [key], 540, y, { px: 104, w: 900, dur: 0.28, rise: 14, shadowBlur: 30, shadowA: 0.7 });
  if (after.length) wordLine(t, after, 540, y + 56, { px: 44, w: 800, dur: 0.24, rise: 8, shadowBlur: 20, shadowA: 0.7 });
}

/* ───────────── overlays on the speaker ───────────── */
function overlay(t, b, phase) {
  const front = phase === 'front';
  if (b.k === 'hook') {
    if (front) wordLine(t, ['the', 'story', 'of', 'this'].map(w => ({ s: w, at: at(w) })), 60, 340, { px: 38, w: 700, align: 'left', reflow: false });
    if (phase === 'behind') { slam(t, '18', 250, 820, at('18'), { px: 470, maxW: 380, S0: 1.4 }); slam(t, 'YO', 800, 820, at('year'), { px: 470, maxW: 420, S0: 1.4 }); }
    if (front && t >= at('student')) { wordLine(t, [{ s: 'student', at: at('student') }], 880, 880, { px: 34, w: 700, reflow: false }); handArrow(900, 910, 600, 1230, [140, 60], E.ramp(prog(t, at('student') + 0.1, 0.5))); }
    if (front) polaroid(t);
  }
  if (b.k === 'article' && front) article(t, b);
  if (b.k === 'inJust' && front) { wordLine(t, [{ s: 'in', at: b.t0 }, { s: 'just', at: b.t0 + 0.1 }], 70, 300, { px: 34, w: 700, align: 'left', reflow: false }); slam(t, '18', 70, 490, b.bigAt, { px: 220, maxW: 200, S0: 1.4, align: 'left' }); }
  if (b.k === 'years' && front) {
    // the ages count up across the top, then "Years … old" tuck under them
    b.ats.forEach((a, i) => slam(t, ['18', '19', '20'][i], 240 + i * 300, 520, a, { px: 280, maxW: 260, S0: 1.4 }));
    wordLine(t, [{ s: 'Years', at: b.yearsAt }], 120, 600, { px: 46, w: 800, align: 'left', reflow: false });
    wordLine(t, [{ s: 'old', at: b.oldAt }], 960, 600, { px: 46, w: 800, align: 'right', reflow: false });
  }
  if (b.k === 'projects' && front) projects(t, b);
  if (b.k === 'icons' && front) headIcons(t, b);
  if (b.k === 'cta' && front) {
    wordLine(t, [{ s: 'Comment', at: b.at }], 540, 1120, { px: 60, w: 800 });
    slam(t, '“GUIDE”', 540, 1330, b.at + 0.25, { px: 260, maxW: 760, S0: 1.45 });
    wordLine(t, ['the', 'entire', 'guide'].map(w => ({ s: w, at: at(w, 82.5) })), 540, 1460, { px: 58, w: 800 });
  }
}
// the photo in his hand at the start (a polaroid stand-in), tossed onto the desk on "this guy's"
function polaroid(t) {
  const toss = E.in(prog(t, 3.1, 0.34)), x = lerp(370, 300, toss), y = lerp(1330, 1720, toss), r = lerp(-0.08, 0.5, toss);
  ctx.save(); ctx.translate(x, y); ctx.rotate(r + Math.sin(t * 1.3) * 0.02);
  card(-110, -130, 220, 260, { r: 4, a: 0.45, fill: '#f3f1ea' }); ctx.fillStyle = '#c8b46a'; ctx.fillRect(-92, -112, 184, 184); person(0, -60, 0.22, { body: '#4a3b2a', skin: '#b98a68', seed: 3 });
  ctx.restore();
}

/* ───────────── transitions into inserts ───────────── */
function enter(t, s, draw) {
  const d = t - s.t0;
  if (s.tr === 'whip' && d < 0.3) {
    // vertical whip: the insert arrives from below at speed with a velocity smear
    const Y = tt => 1920 * (1 - E.out(prog(tt, s.t0 - 0.02, 0.3))), y = Y(t), v = Math.abs(vel(Y, t)), n = v > 3 ? Math.min(4, Math.ceil(shutter(v) / 5)) : 0;
    for (let i = n; i >= 1; i--) { ctx.save(); ctx.globalAlpha = 0.2; ctx.translate(0, y + i * v * 0.3); draw(); ctx.restore(); }
    ctx.save(); ctx.translate(0, y); draw(); ctx.restore(); return;
  }
  if (s.tr === 'pixel' && d < 0.16) {
    const k = prog(t, s.t0, 0.14), B = 60; ctx.save(); ctx.beginPath();
    for (let by = 0; by < 33; by++) for (let bx = 0; bx < 18; bx++) if (rand(bx * 97 + by * 13 + 9) < k * 1.15) ctx.rect(bx * B, by * B, B, B);
    ctx.clip(); draw(); ctx.restore(); return;
  }
  if (s.tr === 'coin' && d < 0.22) { // the frame turns over like a coin: squeeze to an edge, the new side opens
    const k = prog(t, s.t0, 0.22); ctx.save(); ctx.translate(540, 960); ctx.scale(Math.max(0.02, Math.sin(k * Math.PI / 2)), 1); ctx.translate(-540, -960); draw(); ctx.restore(); return;
  }
  draw();
  if (s.tr === 'flash') { const f = 1 - prog(t, s.t0, 0.07); if (f > 0) { ctx.fillStyle = `rgba(255,250,240,${0.85 * f})`; ctx.fillRect(0, 0, W, H); } }
}

function segAt(t) { return SEG.find(s => t >= s.t0 && t < s.t1) ?? SEG[SEG.length - 1]; }
function frame(t) {
  ctx = main; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.filter = 'none';
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  deskAt(t);
  const s = segAt(t), overs = OVER.filter(b => t >= b.t0 && t < b.t1), cam = camAt(t);
  const full = () => speakerScene(t, cam, [0, 0, W, H], () => overs.forEach(b => overlay(t, b, 'behind')));
  if (s.k === 'full') full();
  if (s.k === 'ins') { if (t - s.t0 < 0.32) full(); enter(t, s, () => s.d(t, s)); }
  if (s.k === 'dive') {
    // the camera dives onto the chips on "give up": a log zoom toward the desk, depth of field on everything else
    const k = E.hard(prog(t, s.t0, 0.5)), z = logLerp(1, 2.6, k);
    ctx.save(); ctx.translate(380, 1660); ctx.scale(z, z); ctx.translate(-380, -1660); ctx.filter = `blur(${(k * 5).toFixed(1)}px)`; full(); ctx.restore(); ctx.filter = 'none';
  }
  if (s.k === 'full' || s.k === 'dive' || (s.k === 'ins' && (s.d === photo || s.d === board))) {
    overs.forEach(b => overlay(t, b, 'front'));
    const bigOn = overs.some(b => ['hook', 'inJust', 'years', 'cta'].includes(b.k) && (b.k !== 'hook' || t >= at('18')));
    const boardText = s.d === board && (s.p === 'cta' || s.p === 'l1');
    if (!bigOn && !boardText) caption(t, s.k === 'ins' ? 1500 : 1230);
  }
  const end = prog(t, DUR - 0.3, 0.3); if (end > 0) { ctx.fillStyle = `rgba(0,0,0,${end})`; ctx.fillRect(0, 0, W, H); }
}

/* ───────────── sound ───────────── */
let AC = null, master = null; const SFXBUF = {}, fired = new Set();
const SFXGAIN = { whoosh: 0.45, swipe: 0.4, hit: 0.38, pop: 0.3, key: 0.14, tick: 0.14 };
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
  SEG.forEach(s => { if (s.k === 'ins') ev.push([s.t0 - 0.05, s.tr === 'pixel' ? 'tick' : s.tr === 'coin' ? 'swipe' : 'whoosh']); if (s.k === 'dive') ev.push([s.t0, 'whoosh']); });
  OVER.forEach(b => { if (b.bigAt) ev.push([b.bigAt, 'hit']); if (b.ats) b.ats.forEach(a => ev.push([a, b.k === 'years' ? 'hit' : 'pop'])); });
  SEG.forEach(s => { if (s.ats) s.ats.forEach(a => ev.push([a, s.d === punch ? 'hit' : 'pop'])); if (s.wordAt) s.wordAt.forEach(a => ev.push([a, 'hit'])); });
  ev.push([at('18'), 'hit'], [at('year'), 'hit'], [at('crush', 23), 'hit'], [at('you', 24), 'hit'], [at('future.', 24), 'whoosh'], [at('come', 82) + 0.25, 'hit']);
  KNIGHT.forEach(([a]) => ev.push([a, 'tick']));
  const l1 = SEG.find(s => s.p === 'l1'); for (let i = 0; i < 12; i++) ev.push([l1.t0 + 0.3 + i * 0.12, 'key']);
  const gm = SEG.find(s => s.p === 'game'); for (let i = 0; i < 3; i++) ev.push([gm.ats[1] + i * 0.5, 'pop']);
  return ev.sort((a, b) => a[0] - b[0]);
}

/* ───────────── transport + check mode ───────────── */
let playing = false;
const playBtn = document.getElementById('play'), seek = document.getElementById('seek'), tEl = document.getElementById('t'), cmp = document.getElementById('cmp');
function ensureAudio() { if (AC) return; AC = new AudioContext(); master = AC.createGain(); master.gain.value = 0.9; master.connect(AC.destination); loadSfx(); }
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
  if (!window.HOLD) frame(t); seek.value = t; tEl.textContent = `${t.toFixed(2)} / ${DUR}`;
  requestAnimationFrame(loop);
}
window.renderAt = t => frame(t);
(async () => {
  await Promise.all([document.fonts.load('400 100px Anton'), document.fonts.load('800 100px InterTight'), document.fonts.load('900 100px InterTight'), document.fonts.load('italic 40px Serif')]);
  WORDS = await (await fetch('../words.json')).json();
  for (let i = 1; i < WORDS.length; i++) if (WORDS[i].t < WORDS[i - 1].t) WORDS[i].t = WORDS[i - 1].t + 0.01;
  WORDS.forEach(w => { if (!(w.end > w.t)) w.end = w.t + 0.2; });
  buildTextures(); buildTextures2(); buildEdit();
  const q = new URLSearchParams(location.search);
  if (q.has('t')) audio.currentTime = +q.get('t');
  loop();
})();
