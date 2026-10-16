// R3 timeline: word-stamped segments, the chapter dial, split panels on the night ground, big words, captions, and the
// LIBRARY's sound design (kits/motion/sfx.js plays the engine's sfx map by event, only where the reference has no hit).
'use strict';
const cv = document.getElementById('c'), main = cv.getContext('2d');
ctx = main;
const audio = document.getElementById('a'), vid = document.getElementById('v');
const norm = s => s.toLowerCase().replace(/[^a-z0-9-]/g, '');
function WT(w, after = 0, nth = 0) { const n = norm(w), hits = WORDS.filter(x => norm(x.word) === n && x.t >= after); return hits[nth] ?? { t: after, end: after + 0.4 }; }
const at = (w, after = 0, nth = 0) => WT(w, after, nth).t;
const DUR = 88.12;

let SEG = [], CUTS = [], OVER = [], CHUNKS = [], CUES = [];
function buildEdit() {
  // k: full | split (panel p on the night ground, top half) | dial (chapter n: the hand rises, the camera dives in) | broll | cta
  SEG = [
    { t0: 0, t1: 7.84, k: 'full' },
    { t0: 7.84, t1: 12.0, k: 'split', p: 'master', ats: { folder: 7.9, click: at('resources', 8), docs: [at('detailed', 9), at('paying', 11)] } },
    { t0: 12.0, t1: 14.24, k: 'dial', n: 0 },
    { t0: 14.24, t1: 17.64, k: 'split', p: 'bullets', title: '1. Shortform Editing', items: [
      { s: 'Pick any Software', at: at('learn', 13.5) - 0.35, chips: [['Pr', '#2a1a6a'], ['Ae', '#2a1a6a'], ['Dv', '#1a3a6a']] }, { s: 'Basics of Design', at: at('design,', 14.5) - 0.35 },
      { s: 'Typography', at: at('typography,', 15) - 0.35 }, { s: 'Simple Editing', at: at('simple', 15.5) - 0.35 }, { s: 'Simple Motion Design', at: at('motion', 16.5) }] },
    { t0: 17.64, t1: 20.1, k: 'full' },
    { t0: 20.1, t1: 24.0, k: 'dial', n: 1, icons: [at('framework,', 21), at('webflow', 22), at('ai', 22.8)] },
    { t0: 24.0, t1: 27.08, k: 'full' },
    { t0: 27.08, t1: 30.6, k: 'split', p: 'sites', items: [{ s: 'Understanding Design', at: at('understanding', 27) }, { s: 'Human Psychology', at: at('human', 28) }, { s: 'Optimizing for Clicks', at: at('optimizing', 29) }] },
    { t0: 30.6, t1: 34.9, k: 'split', p: 'textCard', title: 'The Key to Charge Premium Amounts.' },
    { t0: 34.9, t1: 36.2, k: 'dial', n: 2 },
    { t0: 36.2, t1: 38.76, k: 'full' },
    { t0: 38.76, t1: 42.04, k: 'split', p: 'thumbs', ats: { good: at('clicks', 40.5) } },
    { t0: 42.04, t1: 43.1, k: 'full' },
    { t0: 43.1, t1: 44.5, k: 'dial', n: 3 },
    { t0: 44.5, t1: 46.56, k: 'full' },
    { t0: 46.56, t1: 49.4, k: 'broll', words: [{ s: 'SCRIPT', at: at('script,', 46) }, { s: 'SHOOT', at: at('shoot', 46.8) }, { s: 'EDIT', at: at('edit', 47.5) }, { s: 'BASIC VIDEOS', at: at('basic', 48) }] },
    { t0: 49.4, t1: 53.56, k: 'full' },
    { t0: 53.56, t1: 57.68, k: 'split', p: 'flow', items: [{ icon: 'clap', s: '10-15 vids', at: at('10', 53.4) }, { icon: 'social', s: 'Post them', at: at('post', 54.5) }, { icon: 'folder', s: 'List in this', at: at('reach', 55.8) }] },
    { t0: 57.68, t1: 59.84, k: 'dial', n: 4, short: true },
    { t0: 59.84, t1: 65.12, k: 'full' },
    { t0: 65.12, t1: 66.96, k: 'dial', n: 4 },
    { t0: 66.96, t1: 71.2, k: 'split', p: 'people', ats: { label: at('hire', 68), two: at('fresh', 69.8) } },
    { t0: 71.2, t1: 73.6, k: 'full' },
    { t0: 73.6, t1: 77.64, k: 'split', p: 'mindmap', ats: [at('learn,', 73.6), at('reach', 74.5), at('charge', 75.4), at('whom', 76)] },
    { t0: 77.64, t1: 78.6, k: 'full' },
    { t0: 78.6, t1: 81.68, k: 'split', p: 'folderOnly' },
    { t0: 81.68, t1: 82.28, k: 'full' },
    { t0: 82.28, t1: 86.08, k: 'split', p: 'dialPanel' },
    { t0: 86.08, t1: 87.08, k: 'full' },
    { t0: 87.08, t1: 999, k: 'cta' },
  ];
  CUTS = [0, 6.16, 7.84, 12, 14.24, 17.64, 20.1, 24, 27.08, 30.6, 34.9, 36.2, 37.36, 38.76, 42.04, 43.1, 44.5, 46.56, 49.4, 51.4, 53.56, 57.68, 59.84, 61.96, 62.92, 63.6, 65.12, 66.96, 71.2, 73.6, 77.64, 78.6, 81.68, 82.28, 86.08];
  OVER = [
    { t0: 0.3, t1: 6.16, k: 'hook' },
    { t0: at('three', 17.8), t1: at('easily', 19) - 0.05, k: 'big', small: [], big: '3 MONTHS', bigAt: at('three', 17.8), y: 660, maxW: 900, behind: true },
    { t0: at('one', 19.8) - 0.05, t1: 20.1, k: 'big', small: [], big: '1 - 2', bigAt: at('one', 19.8), y: 680, maxW: 520, behind: false, after: { s: 'clients', at: at('clients.', 20) } },
    { t0: at('it\'s', 25.5), t1: 27.08, k: 'split2', a: { s: "it's not in", at: at('it\'s', 25.5) }, b: { s: 'building', at: at('building', 26) } },
    { t0: at('become', 60.6), t1: 61.96, k: 'big', small: [{ s: 'become', at: at('become', 60.6) }], big: 'INFLUENCERS', bigAt: at('influencers.', 60.8), y: 640, maxW: 880, behind: true, smallY: 420, smallLeft: true },
    { t0: at('great.', 62.6), t1: 62.92 + 0.6, k: 'big', small: [], big: 'GREAT', bigAt: at('great.', 62.6), y: 640, maxW: 760, behind: true },
  ];
  buildCaptions();
  // sound design: event names from the library map; played only where the reference has no hit of its own
  const c = [];
  SEG.forEach(s => { if (s.k === 'split') c.push([s.t0, 'card-in']); if (s.k === 'dial') c.push([s.t0, 'scene'], [s.t0 + 0.55, 'stat']); if (s.k === 'broll') c.push([s.t0, 'slide-out']); if (s.k === 'cta') c.push([s.t0 + 0.2, 'cta']); });
  OVER.forEach(b => { if (b.bigAt) c.push([b.bigAt, 'key-word']); });
  c.push([3.92, 'cascade'], [4.0, 'cascade'], [4.08, 'cascade'], [4.16, 'cascade'], [4.24, 'cascade'], [0.74, 'hard-hit']);
  SEG.forEach(s => {
    if (s.p === 'bullets') s.items.forEach(i => c.push([i.at, 'list-item']));
    if (s.p === 'master') { c.push([s.ats.click, 'click-ui']); s.ats.docs.forEach(a => c.push([a, 'pop'])); }
    if (s.p === 'sites') s.items.forEach(i => c.push([i.at, 'pop']));
    if (s.p === 'flow' || s.p === 'mindmap') (s.items ?? s.ats).forEach(i => c.push([i.at ?? i, 'pop']));
    if (s.k === 'broll') s.words.forEach(w => c.push([w.at, 'key-word']));
  });
  CUES = c.sort((a, b) => a[0] - b[0]);
}
function buildCaptions() {
  CHUNKS = []; let cur = [];
  const flush = () => { if (cur.length) CHUNKS.push({ t0: cur[0].t, words: cur }); cur = []; };
  WORDS.forEach((w, i) => { const prev = WORDS[i - 1]; if (cur.length && (cur.length >= 4 || cur.map(x => x.word).join(' ').length + w.word.length > 20 || (prev && w.t - prev.end > 0.3) || /[.,?!]$/.test(prev?.word ?? ''))) flush(); cur.push(w); });
  flush(); CHUNKS.forEach((c, i) => { c.t1 = Math.min(CHUNKS[i + 1]?.t0 ?? c.t0 + 1.4, c.t0 + 1.8); });
}
const fixText = s => s.replace(/^1$/, '1').replace(/50,000/, '₹50,000').replace(/^5,000$/, '₹5,000').replace(/^15,000$/, '₹15,000');

function camAt(t) {
  let i = 0; for (let j = 0; j < CUTS.length; j++) if (CUTS[j] <= t) i = j;
  const since = t - CUTS[i], base = [1.0, 1.1, 1.04, 1.15, 1.07][i % 5], ox = (rand(i * 11 + 7) - 0.5) * 70, oy = (rand(i * 13 + 7) - 0.5) * 50;
  let s = base * (1 + 0.035 * Math.exp(-since / 0.16)) * (1 + 0.011 * since);
  for (const b of OVER) if (b.bigAt && t >= b.bigAt && t < b.t1) s *= logLerp(1, 1.07, E.out(prog(t, b.bigAt, 0.18)));
  return { s, ox: ox + noise(t * 0.3, i) * 10, oy: oy + noise(t * 0.3, i + 50) * 8, fy: 900 };
}
function caption(t, y) {
  const c = CHUNKS.find(c => t >= c.t0 && t < c.t1); if (!c) return;
  wordLine(t, c.words.map((w, i) => ({ s: fixText(w.word), at: Math.max(w.t - 0.03, c.t0 - 0.03 + i * 0.02) })), 540, y, { px: 56, w: 800, dur: 0.24, rise: 10, shadowBlur: 24, shadowA: 0.7 });
}
function overlay(t, b, phase) {
  const front = phase === 'front';
  if (b.k === 'hook' && front) { goldTitle(t, 0.3, at('before', 1.9)); skillTiles(t, at('five', 3.8), 5.95); if (t >= at('five', 3.8) && t < 5.95) wordLine(t, [{ s: '5', at: at('five', 3.8) }, { s: 'best', at: at('best', 3.9) }, { s: 'skills', at: at('best', 3.9) + 0.12 }], 540, 1020, { px: 64, w: 800 }); }
  if (b.k === 'big') {
    if (front && b.small.length) wordLine(t, b.small, b.smallLeft ? 110 : 540, b.smallY ?? b.y - 280, { px: 50, w: 800, align: b.smallLeft ? 'left' : 'center', reflow: false });
    if (phase === (b.behind ? 'behind' : 'front')) slam(t, b.big, 540, b.y, b.bigAt, { px: 340, maxW: b.maxW, S0: 1.45 });
    if (front && b.after) wordLine(t, [b.after], 820, b.y + 40, { px: 50, w: 800, align: 'left', reflow: false });
  }
  if (b.k === 'split2' && front) { wordLine(t, [b.a], 230, 300, { px: 46, w: 800, reflow: false }); wordLine(t, [b.b], 830, 300, { px: 46, w: 800, reflow: false }); }
}

/* ───────────── the dial segment: the hand rises over the speaker, the camera dives into the dial ───────────── */
function dialSeg(t, s, cam) {
  const d = t - s.t0, rise = E.out(prog(t, s.t0, 0.45)), dive = E.hard(prog(t, s.t0 + 0.35, 0.5)), z = logLerp(0.55, 1.08, dive);
  if (d < 0.9) { ctx.save(); ctx.globalAlpha = 1; speakerScene(t, cam, [0, 0, W, H], null); ctx.restore(); }
  ctx.save(); ctx.globalAlpha = clamp(dive * 3); night(t); ctx.restore();
  // the dial turns from the last chapter to this one as it lands; the star spins a little with it
  const turn = -lerp(Math.max(0, s.n - 1), s.n, E.ramp(prog(t, s.t0 + 0.4, 0.6))) * 2 * Math.PI / 5;
  dial(t, { n: s.n, shown: s.n + 1, cx: 560, cy: lerp(1300, 1330, dive), z, rise, turn, spin: (t - s.t0) * 0.25 });
  if (s.icons) s.icons.forEach((a, i) => { if (t < a) return; const k = spring(t - a, 'pop'); ctx.save(); ctx.translate(760 + i * 110, 1180); ctx.scale(k, k); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(-40, -40, 80, 80, 16); ctx.fill(); ctx.fillStyle = ['#2a6af0', '#2a4af0', '#e8572a'][i]; ctx.beginPath(); ctx.arc(0, 0, 22, 0, 7); ctx.fill(); ctx.restore(); });
}

function segAt(t) { return SEG.find(s => t >= s.t0 && t < s.t1) ?? SEG[SEG.length - 1]; }
const PANEL = makeCanvas(1080, 960), pctx = PANEL.getContext('2d');
function frame(t) {
  ctx = main; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.filter = 'none';
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  DESK.chips = 0;
  const s = segAt(t), overs = OVER.filter(b => t >= b.t0 && t < b.t1), cam = camAt(t);
  if (s.k === 'full') speakerScene(t, cam, [0, 0, W, H], () => overs.forEach(b => overlay(t, b, 'behind')));
  if (s.k === 'split') {
    const box = [0, 960, W, 960]; box.scale = 1; box.focusY = 1000;
    if (t - s.t0 < 0.4) { const top = [0, 0, W, 960]; top.scale = 1; top.focusY = 480; speakerScene(t, camAt(s.t0 - 0.01), top, null); }
    speakerScene(t, cam, box, null);
    const keep = ctx; ctx = pctx; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, 1080, 960); night(t, [0, 0, 1080, 960]); PANELS3[s.p](t, s); ctx = keep;
    // the panel wipes down at speed with velocity ghosts (motion blur)
    const Y = tt => -960 * (1 - E.out(prog(tt, s.t0 - 0.03, 0.32))), y = Y(t), v = Math.abs(vel(Y, t)), n = v > 3 ? Math.min(4, Math.ceil(shutter(v) / 4)) : 0;
    for (let i = n; i >= 1; i--) { ctx.globalAlpha = 0.18; ctx.drawImage(PANEL, 0, y - i * v * 0.25); }
    ctx.globalAlpha = 1; ctx.drawImage(PANEL, 0, y);
    const g = ctx.createLinearGradient(0, y + 960, 0, y + 986); g.addColorStop(0, 'rgba(0,0,0,0.5)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, y + 960, W, 26);
  }
  if (s.k === 'dial') dialSeg(t, s, cam);
  if (s.k === 'broll') phoneBroll(t, s);
  if (s.k === 'cta') { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); wordLine(t, [{ s: 'comment', at: s.t0 }], 300, 860, { px: 46, w: 700, align: 'left', reflow: false }); slam(t, 'GUIDE', 540, 1050, s.t0 + 0.15, { px: 260, maxW: 560, S0: 1.4 }); wordLine(t, [{ s: 'for', at: s.t0 + 0.35 }, { s: 'resources', at: s.t0 + 0.42 }], 790, 1110, { px: 40, w: 700, align: 'right', reflow: false }); }
  if (s.k === 'full' || s.k === 'split') {
    overs.forEach(b => overlay(t, b, 'front'));
    if (!overs.some(b => b.k === 'big' || b.k === 'split2' || (b.k === 'hook' && t < 6.0))) caption(t, s.k === 'split' ? 1000 : 1230);
  }
  const end = prog(t, DUR - 0.3, 0.3); if (end > 0) { ctx.fillStyle = `rgba(0,0,0,${end})`; ctx.fillRect(0, 0, W, H); }
}

/* ───────────── sound: the library's sfx kit ───────────── */
let AC = null, SK = null, NATIVE = 0, ADDED = 0; const fired = new Set();
async function ensureAudio() {
  if (AC) return; AC = new AudioContext(); const src = AC.createMediaElementSource(audio); src.connect(AC.destination);
  SK = await sfxKit(AC, { base: '/packages/engine/assets/sfx/' }); await SK.analyse('../voice.mp3');
  CUES.forEach(([a]) => { if (SK.nativeHas(a)) NATIVE++; });
  console.log(`sfx: ${CUES.length} cues; the reference already has a hit at ${NATIVE}; the library adds the rest`);
}
let playing = false;
const playBtn = document.getElementById('play'), seek = document.getElementById('seek'), tEl = document.getElementById('t'), cmp = document.getElementById('cmp');
playBtn.onclick = async () => {
  await ensureAudio(); await AC.resume();
  if (playing) { audio.pause(); vid.pause(); } else { await audio.play(); if (cmp.checked) { vid.currentTime = audio.currentTime; vid.play(); } }
  playing = !playing; playBtn.textContent = playing ? 'Pause' : 'Play';
};
seek.oninput = () => { audio.currentTime = +seek.value; vid.currentTime = +seek.value; fired.clear(); CUES.forEach(([a], i) => { if (a < +seek.value) fired.add(i); }); };
cmp.onchange = () => { document.body.classList.toggle('cmp', cmp.checked); vid.currentTime = audio.currentTime; if (playing && cmp.checked) vid.play(); };
audio.onended = () => { playing = false; playBtn.textContent = 'Play'; };
function loop() {
  const t = audio.currentTime;
  if (playing && SK && document.getElementById('sfx').checked) CUES.forEach(([a, ev], i) => { if (!fired.has(i) && t >= a - 0.02 && t - a < 0.15) { fired.add(i); if (SK.cue(ev, a)) ADDED++; } });
  if (playing && cmp.checked && Math.abs(vid.currentTime - t) > 0.15) vid.currentTime = t;
  if (!window.HOLD) frame(t); seek.value = t; tEl.textContent = `${t.toFixed(2)} / ${DUR}`;
  requestAnimationFrame(loop);
}
window.renderAt = t => frame(t);
(async () => {
  await Promise.all([document.fonts.load('400 100px Anton'), document.fonts.load('800 100px InterTight'), document.fonts.load('800 60px "Grenze Gotisch"'), document.fonts.load('600 30px Grenze'), document.fonts.load('900 60px Cinzel')]).catch(() => {});
  WORDS = await (await fetch('../words.json')).json();
  for (let i = 1; i < WORDS.length; i++) if (WORDS[i].t < WORDS[i - 1].t) WORDS[i].t = WORDS[i - 1].t + 0.01;
  WORDS.forEach(w => { if (!(w.end > w.t)) w.end = w.t + 0.2; });
  // R3's room: grey wall, a white window light, a black tee
  ROOM = { wall: ['#5a544e', '#46403a', '#1e1a16'], light: 'rgba(255,244,225,', torso: ['#0f0f11', '#1d1d21', '#2c2c31'], collar: '#0f0f11', arms: ['#0f0f11', '#1d1d21'] };
  buildTextures(); buildTextures2(); buildTextures3(); buildEdit();
  const q = new URLSearchParams(location.search); if (q.has('t')) audio.currentTime = +q.get('t');
  loop();
})();
