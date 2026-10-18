// R4 timeline (word-stamped): design-tool hook cards, a red table where stickers are dropped and labelled, hand-drawn
// boiling words, an iPad on the table, flipbook numbers over a soft speaker, the plugin panel, a sticker CTA.
// Sound: the library sfx map by event (kits/motion/sfx.js), only where the reference has no hit of its own.
'use strict';
const cv = document.getElementById('c'), main = cv.getContext('2d');
ctx = main;
const audio = document.getElementById('a'), vid = document.getElementById('v');
const norm = s => s.toLowerCase().replace(/[^a-z0-9-]/g, '');
function WT(w, after = 0, nth = 0) { const n = norm(w), hits = WORDS.filter(x => norm(x.word) === n && x.t >= after); return hits[nth] ?? { t: after, end: after + 0.4 }; }
const at = (w, after = 0, nth = 0) => WT(w, after, nth).t;
const DUR = 110.4;
let SEG = [], CHUNKS = [], CUES = [], CUTS = [];

/* ───────────── speaker and plant stand-ins (footage in the original) ───────────── */
function speaker(t, blur = 0) {
  const cam = { s: 1.02 + 0.01 * Math.sin(t * 0.3), ox: noise(t * 0.3, 3) * 10, oy: 0, fy: 900 };
  if (blur) { ctx.save(); ctx.filter = `blur(${blur}px)`; }
  speakerScene(t, cam, [0, 0, W, H], null); if (blur) ctx.restore();
}
function plant(t) {
  if (footage(t, 'plant', 0, 0, W, H, { at: 6.67, zoom: 1.04 + 0.02 * prog(t, 6.67, 4.4), grade: 'brightness(0.62) saturate(0.85) contrast(1.08)' })) return;
  const g = ctx.createLinearGradient(0, 0, 1080, 1920); g.addColorStop(0, '#5d5a4e'); g.addColorStop(1, '#2a2722'); ctx.fillStyle = g; ctx.fillRect(0, 0, 1080, 1920);
  ctx.save(); ctx.translate(noise(t * 0.3, 5) * 12, 0);
  for (let i = 0; i < 16; i++) { ctx.save(); ctx.translate(300 + rand(i) * 500, 200 + rand(i + 3) * 700); ctx.rotate(rand(i + 5) * 3); const lg = ctx.createLinearGradient(0, -240, 0, 240); lg.addColorStop(0, '#0d1a0e'); lg.addColorStop(1, '#2c3b22'); ctx.fillStyle = lg; ctx.beginPath(); ctx.ellipse(0, 0, 60, 260, 0, 0, 7); ctx.fill(); ctx.restore(); }
  ctx.restore(); standIn(36, 1880, 'footage stand-in');
}

function buildEdit() {
  const w = (s, a = 0) => at(s, a);
  SEG = [
    { t0: 0, t1: 1.0, d: (t, s) => { whiteCard(t); boxWord(t, 'TODAY', 0.0, { font: `400 300px "${HEAVY}"`, px: 300, x: 540, y: 1060, s0: 0.5, dur: 0.6 }); } },
    { t0: 1.0, t1: 1.5, d: (t, s) => { whiteCard(t); boxWord(t, 'TODAY', 1.0, { font: `400 190px "${HEAVY}"`, px: 190, x: 520, y: 960, s0: 1, fill: P4.red }); handLabel(t, "I'm...", 1.05, 760, 1080, 90, P4.ink); } },
    { t0: 1.5, t1: 2.84, d: (t, s) => finallyCard(t, s), subAt: 1.72 },
    { t0: 2.84, t1: 4.13, d: (t, s) => { whiteCard(t); boxWord(t, 'MY', 2.9, { font: `400 360px "${HEAVY}"`, px: 360, x: 540, y: 1080, s0: 1.35, dur: 0.4, box: false }); } },
    { t0: 4.13, t1: 6.67, d: (t, s) => { speaker(t); sparkles(t, 4.4); } },
    { t0: 6.67, t1: 11.05, d: (t, s) => { plant(t); scribbleText(t, 'LONG WAY', { at: w('long', 6.8), out: w('short', 7.4) - 0.05, x: 540, y: 820, px: 120, font: MARK2 }); scribbleText(t, 'SHORT WAY', { at: w('short', 7.4), out: w('and', 8.3) - 0.05, x: 540, y: 820, px: 120, font: MARK2 }); scribbleText(t, "AND I'M GOING", { at: w('and', 8.3), out: 10.9, x: 540, y: 700, px: 96, font: MARK2 }); scribbleText(t, 'TO BE SHOWING', { at: w('to', 8.7) , out: 10.9, x: 540, y: 810, px: 96, font: MARK2 }); scribbleText(t, 'YOU BOTH.', { at: w('you', 9.0), out: 10.9, x: 540, y: 920, px: 96, font: MARK2 }); } },
    { t0: 11.05, t1: 16.43, k: 'table', d: (t, s) => { redTable(t);
        sticker(t, w('ipad,', 12.4) - 0.25, 210, 1000, 270, 400, -0.05, ART.ipad); handLabel(t, 'IPAD', w('ipad,', 12.4) + 0.2, 210, 1290, 76);
        plusSign(t, w('procreate', 13.5) - 0.2, 385, 1000); sticker(t, w('procreate', 13.5) - 0.25, 545, 1000, 270, 270, 0.04, ART.app); handLabel(t, 'PROCREATE', w('procreate', 13.5) + 0.2, 545, 1230, 66); handLabel(t, 'DREAMS', w('dreams,', 14), 545, 1300, 66);
        plusSign(t, w('animation.', 15.2) - 0.3, 705, 1000); sticker(t, w('understanding', 14.8) - 0.1, 875, 1000, 250, 310, 0.06, ART.glove); handLabel(t, 'ANIMATION', w('animation.', 15.2), 875, 1260, 66); } },
    { t0: 16.43, t1: 21.94, k: 'table', d: (t, s) => { redTable(t); sticker(t, 16.5, 540, 820, 560, 620, -0.03, ART.photo, { from: -900 }); } },
    { t0: 21.94, t1: 27.36, k: 'table', d: (t, s) => { redTable(t); ipad(t, 540, 860, 640, -0.08, (W2, H2) => SCREENS[t < 23.6 ? 'library' : 'newMovie'](W2, H2, t, t - 23.6)); pencil(800 + Math.sin(t * 1.5) * 30, 1100, 0.5); } },
    { t0: 27.36, t1: 28.65, d: (t, s) => { whiteCard(t); ctx.save(); ctx.font = `400 64px "${HEAVY}"`; ctx.textAlign = 'right'; ctx.fillStyle = P4.ink; ctx.globalAlpha = clamp((t - 27.36) * 6); ctx.fillText(t >= w('you', 27.5) ? 'BUT BEFORE YOU HIT' : 'BUT BEFORE', 640, 990); ctx.restore(); boxWord(t, 'Create', w('create,', 27.8), { font: `italic 400 170px ${SERIF}`, px: 170, x: 800, y: 1000, s0: 0.6, dur: 0.35, sx: 0.86 }); } },
    { t0: 28.65, t1: 32.95, k: 'table', d: (t, s) => { redTable(t); ipad(t, 600, 920, 700, 0.42, (W2, H2) => SCREENS.frameRate(W2, H2, t, t - 28.65)); } },
    { t0: 32.95, t1: 36.24, k: 'table', d: (t, s) => { redTable(t); sticker(t, 33.0, 540, 780, 640, 220, -0.02, ART.film); sticker(t, w('15', 34.5) - 0.2, 540, 1010, 260, 120, 0.03, ART.tag, { from: 700 }); handLabel(t, '15 FRAMES PER', w('15', 34.5) + 0.1, 540, 1005, 30, '#222'); handLabel(t, 'SECOND', w('15', 34.5) + 0.15, 540, 1040, 30, '#222'); } },
    { t0: 36.24, t1: 41.6, d: (t, s) => { speaker(t, 18); ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 5; ctx.setLineDash([22, 16]); ctx.beginPath(); ctx.moveTo(560, 0); ctx.lineTo(560, 1920 * E.out(prog(t, 36.3, 0.4))); ctx.stroke(); ctx.restore(); if (t < w('3', 39) - 0.05) { flipNumber(t, w('2', 36.5), 2, 300, 1100, 420, 'SECONDS'); flipNumber(t, w('30', 37.9), 30, 780, 1100, 420, 'FRAMES'); } else { flipNumber(t, w('3', 39), 3, 300, 1100, 420, 'SECONDS'); flipNumber(t, w('45.', 40.4), 45, 780, 1100, 420, 'FRAMES'); } } },
    { t0: 41.6, t1: 43.84, d: (t, s) => { speaker(t); } },
    { t0: 43.84, t1: 53.64, k: 'table', d: (t, s) => { redTable(t); ipad(t, 540, 900, 680, -0.06 + Math.sin(t * 0.2) * 0.03, (W2, H2) => SCREENS[t < 47.5 ? 'newMovie' : t < 50.8 ? 'canvas' : 'library'](W2, H2, t, t - 43.84)); pencil(820, 1180 + Math.sin(t * 2) * 20, 0.6); } },
    { t0: 53.64, t1: 55.6, d: (t, s) => brushCard(t, s), clickAt: w('ones', 54.4) },
    { t0: 55.6, t1: 57.0, d: (t, s) => { whiteCard(t); boxWord(t, 'Moment', w('moment.', 56), { font: `italic 400 330px ${SERIF}`, px: 330, x: 540, y: 1080, s0: 0.7, dur: 0.4, sx: 0.86 }); } },
    { t0: 57.0, t1: 59.28, k: 'table', d: (t, s) => { redTable(t); ipad(t, 540, 900, 680, -0.04, (W2, H2) => SCREENS.canvas(W2, H2, t, 0, { frame: tt => (tt > 57.6 ? 1 : 0) })); pencil(560, 900, 0.4); } },
    { t0: 59.28, t1: 61.6, d: (t, s) => speaker(t) },
    { t0: 61.6, t1: 80.71, k: 'table', d: (t, s) => { redTable(t);
        const frame = tt => (tt < w('bigger', 62.8) ? 1 : tt < w('next,', 64.2) ? 2 : tt < w('next.', 65) ? 3 : tt < w('hello', 66.9) ? 4 : Math.min(9, 4 + Math.floor((tt - w('hello', 66.9)) * 2.2) + 1));
        const tilt = t > 69 ? 0.5 : -0.05, z = t > 69 ? 1.25 : 1; ipad(t, 540, 900, 680 * z, tilt, (W2, H2) => SCREENS.canvas(W2, H2, t, 0, { frame })); pencil(700 + Math.sin(t * 2.2) * 40, 1050, 0.45); } },
    { t0: 80.71, t1: 86.88, d: (t, s) => { speaker(t);
        scribbleText(t, 'WORDS', { at: w('words,', 83), out: w('sentences,', 83.5) - 0.05, x: 540, y: 1180, px: 500, sx: 0.72, rot: -0.07, maxW: 1380 }); scribbleText(t, 'SENTENCES', { at: w('sentences,', 83.5), out: w('symbols,', 84.3) - 0.05, x: 540, y: 1180, px: 500, sx: 0.72, rot: -0.07, maxW: 1380 });
        scribbleText(t, 'SYMBOLS', { at: w('symbols,', 84.3), out: w('speeds', 85.4) - 0.05, x: 540, y: 1180, px: 500, sx: 0.72, rot: -0.07, maxW: 1380 }); scribbleText(t, 'SPEEDS', { at: w('speeds', 85.4), out: w('sizes.', 86.2) - 0.05, x: 540, y: 1180, px: 500, sx: 0.72, rot: -0.07, maxW: 1380 }); scribbleText(t, 'SIZES', { at: w('sizes.', 86.2), out: 86.85, x: 540, y: 1180, px: 520, sx: 0.72, rot: -0.07, maxW: 1380 }); } },
    { t0: 86.88, t1: 93.93, k: 'table', d: (t, s) => { redTable(t);
        sticker(t, 86.9, 230, 1080, 250, 250, -0.04, ART.app); sticker(t, 87.0, 540, 1080, 250, 360, 0.02, ART.ipad); sticker(t, 87.1, 850, 1080, 250, 300, 0.05, ART.glove);
        noStamp(t, w('procreate', 87.8), 230, 1080, 100); noStamp(t, w('ipad,', 89), 540, 1080, 100); noStamp(t, w('time', 90.1), 850, 1080, 100); } },
    { t0: 93.93, t1: 95.35, d: (t, s) => speaker(t) },
    { t0: 95.35, t1: 101.06, k: 'table', d: (t, s) => { redTable(t);
        sticker(t, 95.4, 540, 975, 540, 1180, 0, (W2, H2) => pluginPanel(W2, H2, t, {}), { r: 34 }); sticker(t, w('premiere', 98.8), 215, 1240, 290, 290, -0.14, ART.prL, { from: -700 }); sticker(t, w('premiere', 98.8) + 0.45, 840, 1270, 290, 290, 0.14, ART.aeL, { from: 700 }); } },
    { t0: 101.06, t1: 104.06, d: (t, s) => { ctx.fillStyle = '#d7d5ce'; ctx.fillRect(0, 0, 1080, 1920); const z = logLerp(1.6, 1.25, E.out(prog(t, 101.06, 3))); ctx.save(); ctx.translate(540, 900); ctx.scale(z, z); pluginPanel(560, 1040, t, { knob: tt => Math.floor((tt - 101) * 2) * 0.9, pad: (tt, i, j) => (i === 0 ? j === 0 : j === 4) && tt > 102.3, animateAt: w('make', 103) }); ctx.restore(); if (t > 102.6) cursorHand(lerp(760, 560, E.out(prog(t, 102.6, 0.5))), lerp(1500, 1350, E.out(prog(t, 102.6, 0.5))), Math.max(0, 1 - Math.abs(t - w('make', 103)) * 8)); } },
    { t0: 104.06, t1: 106.1, k: 'table', d: (t, s) => { redTable(t); scribbleText(t, 'HAND-DRAWN', { at: 104.06, out: w('animations', 104.5) - 0.05, x: 540, y: 960, px: 150 }); scribbleText(t, 'ANIMATIONS', { at: w('animations', 104.5), out: 106.0, x: 540, y: 960, px: 160, fill: P4.orange, outline: true, font: MARK2 }); } },
    { t0: 106.1, t1: 999, k: 'table', d: (t, s) => { redTable(t);
        sticker(t, w('comment', 107.6), 540, 900, 700, 210, -0.03, (W2, H2) => { ART.tag(W2, H2); ctx.font = `400 84px "${MARK2}"`; ctx.textAlign = 'center'; ctx.fillStyle = '#222'; ctx.textAlign = 'right'; ctx.fillText('COMMENT', -14, 26); ctx.fillStyle = '#e8432a'; ctx.textAlign = 'left'; ctx.fillText('"PLUGIN"', 14, 26); }, { r: 60 });
        sticker(t, w('send', 108.9), 540, 1100, 280, 110, 0.04, (W2, H2) => { ART.tag(W2, H2); ctx.font = `400 50px "${MARK2}"`; ctx.textAlign = 'center'; ctx.fillStyle = '#2a4ae0'; ctx.fillText('XOXO', 0, 16); }, { r: 50, from: 700 }); } },
  ];
  CUTS = SEG.map(s => s.t0);
  buildCaptions();
  const c = [];
  SEG.forEach((s, i) => { if (i) c.push([s.t0, s.k === 'table' ? 'card-in' : 'scene']); });
  [0.0, 1.0, 1.5, 2.9, w('create,', 27.8), w('moment.', 56)].forEach(a => c.push([a, 'key-word']));
  [w('ipad,', 12.4) - 0.25, w('procreate', 13.5) - 0.25, w('understanding', 14.8) - 0.1, 16.5, 33.0, w('15', 34.5) - 0.2, 86.9, 87.0, 87.1, 95.4, w('premiere', 98.8), w('after', 99.7)].forEach(a => c.push([a + 0.36, 'pop']));
  [w('procreate', 87.8), w('ipad,', 89), w('time', 90.1)].forEach(a => c.push([a, 'hard-hit']));
  [w('2', 36.5), w('30', 37.9)].forEach(a => c.push([a, 'stat']));
  [w('words,', 83), w('sentences,', 83.5), w('symbols,', 84.3), w('speeds', 85.4), w('sizes.', 86.2), w('long', 6.8), w('short', 7.4), 104.06, w('animations', 104.5)].forEach(a => c.push([a - 0.2, 'word']));
  c.push([w('ones', 54.4), 'click-ui'], [w('make', 103), 'click-ui'], [w('comment', 107.6) + 0.3, 'cta']);
  CUES = c.sort((a, b) => a[0] - b[0]);
}
function sparkles(t, t0) { // hand-drawn sparkle strokes that draw on around the speaker
  for (let i = 0; i < 9; i++) { const k = E.out(prog(t, t0 + i * 0.08, 0.3)); if (k <= 0) continue; const a = -1.2 + i * 0.3, r0 = 260, r1 = r0 + 160 * k, cx = 520, cy = 620;
    ctx.save(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.globalAlpha = 1 - prog(t, t0 + 1.6, 0.4); ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); ctx.stroke(); ctx.restore(); }
}
function eye(t, x, y, s) { const blink = (t % 2.2) > 2.08 ? 0.1 : 1; ctx.save(); ctx.translate(x, y); ctx.scale(s, s * blink); ctx.fillStyle = P4.white; ctx.beginPath(); ctx.ellipse(0, 0, 70, 46, 0, 0, 7); ctx.fill(); ctx.fillStyle = P4.ink; ctx.beginPath(); ctx.arc(noise(t * 0.8, 9) * 14, 0, 26, 0, 7); ctx.fill(); ctx.restore(); }
function plusSign(t, at, x, y) { if (t < at) return; const k = spring(t - at, 'pop'); ctx.save(); ctx.translate(x, y); ctx.scale(k, k); ctx.fillStyle = '#fff'; ctx.fillRect(-16, -4, 32, 8); ctx.fillRect(-4, -16, 8, 32); ctx.restore(); }

function buildCaptions() {
  CHUNKS = []; let cur = [];
  const flush = () => { if (cur.length) CHUNKS.push({ t0: cur[0].t, words: cur }); cur = []; };
  WORDS.forEach((w, i) => { const prev = WORDS[i - 1]; if (cur.length && (/^(and|but)$/i.test(w.word) || cur.length >= 3 || cur.map(x => x.word).join(' ').length + w.word.length > 18 || (prev && w.t - prev.end > 0.3) || /[.,?!]$/.test(prev?.word ?? ''))) flush(); cur.push(w); });
  flush(); CHUNKS.forEach((c, i) => { c.t1 = Math.min(CHUNKS[i + 1]?.t0 ?? c.t0 + 1.4, c.t0 + 1.8); });
}
// the reel's caption: a tall condensed italic serif, white, with a soft shadow
function caption(t, y) {
  const c = CHUNKS.find(c => t >= c.t0 && t < c.t1); if (!c) return;
  ctx.save(); ctx.translate(540, y); ctx.scale(0.74, 1.12); // the reel's tall condensed italic
  wordLine(t, c.words.map((w, i) => ({ s: w.word.replace(/^dre(ams)?/i, m => m), at: Math.max(w.t - 0.03, c.t0 - 0.03 + i * 0.02) })), 0, 0, { px: 140, w: 'italic 400', fam: SERIF, dur: 0.24, rise: 10, gap: 20, shadowBlur: 22, shadowA: 0.55, fill: '#fff' });
  ctx.restore();
}
const NOCAP = [[0, 4.13], [6.67, 11.05], [27.36, 28.65], [55.6, 57.0], [80.71, 86.88], [104.06, 999], [36.24, 41.6]];

function segAt(t) { return SEG.find(s => t >= s.t0 && t < s.t1) ?? SEG[SEG.length - 1]; }
let TNOW = 0;
function frame(t) {
  TNOW = t;
  ctx = main; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.filter = 'none'; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  const s = segAt(t); ctx.save(); s.d(t, s); ctx.restore();
  // cut in on motion: the first 0.12 s of a table shot settles a 3% push
  if (!NOCAP.some(([a, b]) => t >= a && t < b)) caption(t, t >= 95.35 && t < 101.06 ? 1795 : s.k === 'table' ? 1720 : 1700);
  const end = prog(t, DUR - 0.3, 0.3); if (end > 0) { ctx.fillStyle = `rgba(0,0,0,${end})`; ctx.fillRect(0, 0, W, H); }
}

/* ───────────── sound + transport ───────────── */
let AC = null, SK = null, NATIVE = 0, ADDED = 0; const fired = new Set();
async function ensureAudio() { if (AC) return; AC = new AudioContext(); const src = AC.createMediaElementSource(audio); src.connect(AC.destination); SK = await sfxKit(AC, { base: '/packages/engine/assets/sfx/' }); await SK.analyse('../voice.mp3'); CUES.forEach(([a]) => { if (SK.nativeHas(a)) NATIVE++; }); console.log(`sfx: ${CUES.length} cues; the reference already has a hit at ${NATIVE}; the library adds the rest`); }
let playing = false;
const playBtn = document.getElementById('play'), seek = document.getElementById('seek'), tEl = document.getElementById('t'), cmp = document.getElementById('cmp');
playBtn.onclick = async () => { await ensureAudio(); await AC.resume(); if (playing) { audio.pause(); vid.pause(); } else { await audio.play(); if (cmp.checked) { vid.currentTime = audio.currentTime; vid.play(); } } playing = !playing; FOOT_LIVE = playing; playBtn.textContent = playing ? 'Pause' : 'Play'; };
seek.oninput = () => { audio.currentTime = +seek.value; vid.currentTime = +seek.value; fired.clear(); CUES.forEach(([a], i) => { if (a < +seek.value) fired.add(i); }); };
cmp.onchange = () => { document.body.classList.toggle('cmp', cmp.checked); vid.currentTime = audio.currentTime; if (playing && cmp.checked) vid.play(); };
audio.onended = () => { playing = false; playBtn.textContent = 'Play'; };
function loop() { const t = audio.currentTime; if (playing && SK && document.getElementById('sfx').checked) CUES.forEach(([a, ev], i) => { if (!fired.has(i) && t >= a - 0.02 && t - a < 0.15) { fired.add(i); if (SK.cue(ev, a)) ADDED++; } }); if (playing && cmp.checked && Math.abs(vid.currentTime - t) > 0.15) vid.currentTime = t; if (!window.HOLD) frame(t); seek.value = t; tEl.textContent = `${t.toFixed(2)} / ${DUR}`; requestAnimationFrame(loop); }
window.renderAt = t => frame(t);
(async () => {
  await Promise.all([document.fonts.load('400 100px Anton'), document.fonts.load('800 100px InterTight'), document.fonts.load('italic 100px InstrumentSerif'), document.fonts.load('400 100px "Archivo Black"'), document.fonts.load('400 100px "Permanent Marker"'), document.fonts.load('400 100px "Gochi Hand"'), document.fonts.load('300 60px "Barlow Condensed"')]).catch(() => {});
  WORDS = await (await fetch('/data/demo/refs/r4/words.json')).json();
  for (let i = 1; i < WORDS.length; i++) if (WORDS[i].t < WORDS[i - 1].t) WORDS[i].t = WORDS[i - 1].t + 0.01;
  WORDS.forEach(w => { if (!(w.end > w.t)) w.end = w.t + 0.2; });
  // R4's room: a bright apartment, a mustard tee
  ROOM = { monitor: false, wall: ['#d8d2c8', '#c4bdb2', '#8a8378'], light: 'rgba(255,248,235,', torso: ['#b8892a', '#d4a63a', '#e8bf5a'], collar: '#a07420', arms: ['#b8892a', '#d4a63a'] };
  await loadFootage('/data/demo/refs/r4/footage/'); // real b-roll (scripts/ref-footage.ts) where the reference cuts to footage
  buildTextures(); buildTextures2(); buildTextures4(); buildEdit();
  const q = new URLSearchParams(location.search); if (q.has('t')) audio.currentTime = +q.get('t');
  loop();
})();
