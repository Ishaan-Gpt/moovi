// R5 timeline (word-stamped): night-city speaker with glass people cards and audience bars, a white card that dives
// into a settings walkthrough (blue touch dot), a country picker, a keypad, a magnifier, a top-10 card that drops into
// a phone, a comment bar and a DM banner. Captions: heavy italic caps phrases built word by word at chest height.
// Sound: the library sfx map by event (kits/motion/sfx.js), only where the reference has no hit of its own.
'use strict';
const cv = document.getElementById('c'), main = cv.getContext('2d');
ctx = main;
const audio = document.getElementById('a'), vid = document.getElementById('v');
const norm = s => s.toLowerCase().replace(/[^a-z0-9-]/g, '');
function WT(w, after = 0, nth = 0) { const n = norm(w), hits = WORDS.filter(x => norm(x.word) === n && x.t >= after); return hits[nth] ?? { t: after, end: after + 0.4 }; }
const w = (s, after = 0) => WT(s, after).t;
const DUR = 42.0;
let SEG = [], CUES = [], CAPS = [], DOT = [];

/* ───────────── the speaker: stand-in figure over real night-city footage ───────────── */
function cityBackdrop(t, cam) {
  // the city sits far back: barely any parallax, defocused, cooled and darkened; a navy sofa band at the bottom
  ctx.save(); ctx.translate(cam.ox * 0.2, 0);
  if (!footage(t, 'city', -80, -60, 1240, 1300, { at: 0, zoom: 1.25, panY: -80, grade: 'blur(7px) brightness(0.55) saturate(1.25) contrast(1.05) hue-rotate(-8deg)' })) { ctx.fillStyle = '#0b1020'; ctx.fillRect(-80, -60, 1240, 1300); }
  ctx.restore();
  const top = ctx.createLinearGradient(0, 0, 0, 700); top.addColorStop(0, 'rgba(4,6,14,0.75)'); top.addColorStop(1, 'rgba(4,6,14,0)'); ctx.fillStyle = top; ctx.fillRect(-80, -60, 1240, 760);
  // the window mullions (the reference shoots in front of a glass wall)
  ctx.fillStyle = 'rgba(8,10,16,0.55)'; for (const x of [170, 610, 1000]) ctx.fillRect(x, -60, 22, 1300);
  const sofa = ctx.createLinearGradient(0, 1180, 0, 1920); sofa.addColorStop(0, '#0d1430'); sofa.addColorStop(1, '#05070f'); ctx.fillStyle = sofa; ctx.fillRect(-80, 1180, 1240, 800);
}
let BACKDROP = cityBackdrop;
const FRAMES = [ // [t, scale, focusY] framings per sentence (a jump cut lands ~3% big and settles)
  [0, 1.0, 960], [1.6, 1.16, 820], [3.44, 1.12, 840], [5.82, 1.0, 960], [9.18, 1.06, 900], [12.58, 1.0, 960], [26.6, 1.04, 920], [29.26, 1.0, 960],
  [34.96, 1.08, 900], [37.28, 1.14, 840], [38.26, 1.04, 920], [39.92, 1.12, 860]];
function framing(t) { let i = FRAMES.length - 1; while (i > 0 && FRAMES[i][0] > t) i--; const f = FRAMES[i], land = 1 + 0.03 * Math.exp(-(t - f[0]) / 0.18); return { s: f[1] * land + 0.008 * (t - f[0]), fy: f[2] }; }
function speaker(t, blur = 0) {
  const f = framing(t), cam = { s: f.s, ox: noise(t * 0.3, 3) * 8, oy: 0, fy: f.fy };
  ROOM.backdrop = BACKDROP;
  ctx.save(); ctx.translate(540, f.fy); ctx.scale(f.s, f.s); ctx.translate(-540, -f.fy);
  if (blur) ctx.filter = `blur(${blur}px)`;
  speakerScene(t, { s: 1, ox: cam.ox, oy: 0, fy: 900 }, [0, 0, W, H], null);
  ctx.restore();
}

/* ───────────── the phone walkthrough (12.6 – 26.6) ───────────── */
function profileScreen(t) {
  ctx.fillStyle = P5.ui; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = P5.uiInk; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(60, 150); ctx.lineTo(100, 150); ctx.moveTo(80, 130); ctx.lineTo(80, 170); ctx.stroke();
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(960, 140 + i * 16); ctx.lineTo(1010, 140 + i * 16); ctx.stroke(); }
  ctx.fillStyle = '#c7cbd2'; ctx.beginPath(); ctx.arc(170, 360, 92, 0, 7); ctx.fill(); ctx.fillStyle = '#f0f1f4'; ctx.beginPath(); ctx.arc(170, 330, 34, 0, 7); ctx.fill(); ctx.beginPath(); ctx.ellipse(170, 420, 58, 40, 0, Math.PI, 0); ctx.fill();
  [['0', 'posts', 400], ['0', 'followers', 600], ['0', 'following', 820]].forEach(([n, l, x]) => { ctx.fillStyle = P5.uiInk; ctx.textAlign = 'left'; ctx.font = `700 38px ${UI}`; ctx.fillText(n, x, 350); ctx.font = `400 30px ${UI}`; ctx.fillText(l, x, 395); });
  [['Edit profile', 60], ['Share profile', 560]].forEach(([l, x]) => { ctx.fillStyle = '#e9ebef'; ctx.beginPath(); ctx.roundRect(x, 520, 460, 76, 14); ctx.fill(); ctx.fillStyle = P5.uiInk; ctx.font = `600 30px ${UI}`; ctx.textAlign = 'center'; ctx.fillText(l, x + 230, 568); });
  ctx.fillStyle = P5.uiInk; for (let i = 0; i < 9; i++) ctx.fillRect(250 + (i % 3) * 20, 680 + Math.floor(i / 3) * 20, 14, 14); ctx.fillRect(170, 744, 200, 4);
  ctx.strokeStyle = '#555'; ctx.lineWidth = 4; ctx.strokeRect(780, 676, 48, 48);
}
/** which UI screen is up, its own time, and how far into the swap from the last one */
const SCREENS = [[12.58, 'profile'], [13.62, 'settings'], [17.86, 'creator'], [19.36, 'minage'], [26.6, null]];
function drawScreen(name, t) {
  if (name === 'profile') return profileScreen(t);
  if (name === 'settings') { const sc = 360 * E.ramp(prog(t, 14.62, 1.3)); return settingsScreen(t, sc, t > 17.4 ? 'Creator tools and controls' : null); }
  if (name === 'creator') return creatorScreen(t, t > 18.9 ? 'Minimum age' : null);
  if (name === 'minage') {
    const v = t > w('25,', 26) ? '25' : t > w('to', 25.9) + 0.06 ? '2' : '';
    return minAgeScreen(t, { india: t > 24.42 ? 24.42 : 0, focus: t > 25.1, value: v });
  }
}
function phoneWalk(t) {
  let i = SCREENS.findIndex(s => s[0] > t) - 1; if (i < 0) i = 0;
  const [t0, name] = SCREENS[i], prev = SCREENS[i - 1]?.[1], k = E.out(prog(t, t0, 0.32));
  if (prev && k < 1) { ctx.save(); ctx.translate(-260 * k, 0); drawScreen(prev, t); ctx.restore(); }
  ctx.save(); if (prev && k < 1) { ctx.translate(W * (1 - k), 0); ctx.shadowColor = 'rgba(0,0,0,0.2)'; } drawScreen(name, t); ctx.restore();
  // scroll blur on the settings list while it moves
  const sv = Math.abs(vel(tt => 360 * E.ramp(prog(tt, 14.62, 1.3)), t)) * (name === 'settings' ? 1 : 0);
  if (sv > 2) { ctx.save(); ctx.filter = `blur(${Math.min(10, sv * 0.08)}px)`; ctx.globalAlpha = 0.6; ctx.drawImage(cv, 0, 0); ctx.restore(); }
  countryModal(t, 21.5, { crowd: 22.2, half: w('50%', 22.9), out: 24.42 });
  keypad(t, 25.2, n => n === '2' ? Math.max(0, 1 - Math.abs(t - (w('to', 25.9) + 0.06)) * 6) : n === '5' ? Math.max(0, 1 - Math.abs(t - w('25,', 26)) * 6) : 0);
  const d = dotAt(t, DOT), dotA = clamp((t - 12.8) * 4) * (1 - clamp((t - 26.45) * 6));
  touchDot(d.x, d.y, d.press, dotA);
}

/* ───────────── the card that rises from his hands and dives into the phone (10.7 – 12.9) ───────────── */
function handCard(t) {
  const k = E.out(prog(t, w('one', 10.5), 0.45)); if (k <= 0 || t >= 12.9) return;
  const dive = prog(t, 12.4, 0.45), z = dive > 0 ? logLerp(1, 2.8, E.hard(dive)) : 1;
  const cw = 440 * z, ch = 300 * z, cx = lerp(540, 540, dive), cy = lerp(1270, 960, E.hard(dive)) + (1 - k) * 80;
  ctx.save(); ctx.globalAlpha *= k;
  ctx.shadowColor = 'rgba(160,190,255,0.45)'; ctx.shadowBlur = 50 * (1 - dive); ctx.fillStyle = '#f7f8fb'; ctx.beginPath(); ctx.roundRect(cx - cw / 2, cy - ch / 2, cw, ch, 26 * z); ctx.fill(); ctx.shadowColor = 'transparent';
  ctx.save(); ctx.beginPath(); ctx.roundRect(cx - cw / 2, cy - ch / 2, cw, ch, 26 * z); ctx.clip(); ctx.translate(cx - cw / 2, cy - ch / 2); ctx.scale(cw / 1080, cw / 1080); ctx.translate(0, -700);
  settingsScreen(t, 0, 'Creator tools and controls'); ctx.restore();
  ctx.restore();
}

/* ───────────── captions: heavy italic caps phrases, each word lands on its stamp ───────────── */
function buildCaps() {
  const P = (text, from, until) => { const ws = text.split(' '); let after = from - 0.2; const words = ws.map(s => { if (s === '/') return { br: true }; const x = WT(s.replace(/[^A-Za-z0-9'%]/g, ''), after); after = x.t; return { s, at: x.t }; }); return { words, t1: until }; };
  CAPS = [
    P('BUSINESS OWNER', 6.1, w('i', 6.8)), P("I DON'T HAVE TO", 6.8, w('explain', 7.0)), P('EXPLAIN TO YOU', 7.0, w('why', 7.6)), P('WHY YOU NEED', 7.6, w('to', 8.0)),
    P('TO LOOK LIKE', 8.0, w('person', 8.3)), P('PERSON B', 8.3, 9.18), P('MAKE IT HAPPEN', 9.3, w('all', 9.9)), P('ALL WITH JUST', 9.9, w('one', 10.6)), P('ONE SIMPLE / SETTING', 10.6, 12.45),
    P('THAT SAID', 29.2, 29.95), P('NOW', 37.2, 38.0), P('EVERY SINGLE / ONE OF THEM', 38.2, 39.5), P('TO 25', 39.5, 39.9), P("AND I'LL SHOW / YOU WHY", 39.9, 42.5),
  ];
  CAPS.forEach(c => { c.t0 = c.words.find(x => !x.br).at - 0.03; });
}
function captions(t) {
  const c = CAPS.find(c => t >= c.t0 && t < c.t1); if (!c) return;
  const lines = [[]]; c.words.forEach(x => x.br ? lines.push([]) : lines[lines.length - 1].push(x));
  const px = 96, y0 = 1010 - (lines.length - 1) * px * 0.5, out = E.in(prog(t, c.t1 - 0.08, 0.08));
  ctx.save(); ctx.globalAlpha *= 1 - out;
  lines.forEach((ln, li) => {
    const shown = ln.filter(x => t >= x.at - 0.02); if (!shown.length) return;
    ctx.font = `italic 900 ${px}px ${CAP}`; ctx.letterSpacing = '1px';
    const widths = shown.map(x => ctx.measureText(x.s).width), gap = 24, total = widths.reduce((a, b) => a + b, 0) + gap * (shown.length - 1);
    // the line re-centres as words arrive (the slide is part of the motion)
    let x = 540 - total / 2; const y = y0 + li * px * 1.0;
    shown.forEach((wd, i) => {
      const k = E.out(prog(t, wd.at - 0.02, 0.16)), s = lerp(1.35, 1, k);
      ctx.save(); ctx.translate(x + widths[i] / 2, y); ctx.scale(s, s); ctx.globalAlpha *= clamp(k * 1.6);
      ctx.shadowColor = 'rgba(0,0,0,0.75)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 6;
      if (k < 1) ctx.filter = `blur(${((1 - k) * 6).toFixed(1)}px)`;
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(wd.s, 0, 0); ctx.restore();
      x += widths[i] + gap;
    });
  });
  ctx.restore();
}

/* ───────────── the timeline ───────────── */
function buildEdit() {
  const crowdTap = 24.2;
  DOT = [[12.6, 700, 1000], [13.3, 985, 156, 1], [13.8, 760, 820], [14.4, 760, 820], [16.2, 600, 900], [w('tap', 17.4), 300, 885, 1], [18.1, 640, 980], [w('minimum', 18.7), 260, 1096, 1],
    [19.7, 600, 980], [w('add', 20.7), 985, 595, 1], [21.9, 760, 910], [23.3, 330, 950], [crowdTap, 230, 940, 1], [24.7, 500, 930], [w('setting', 24.9), 500, 905, 1],
    [25.7, 539, 1280], [w('to', 25.9) + 0.06, 539, 1278, 1], [w('25,', 26), 539, 1444, 1], [26.45, 539, 1444]];
  SEG = [
    { t0: 0, t1: 12.4, d: t => {
      speaker(t);
      // 0 – 1.6: two people cards over the head, counters roll 36K → 100K on "100,000"
      const cnt = 36000 + 64000 * E.ramp(prog(t, 0.18, 0.32));
      arrive(t, 0.02, 1.62, () => { personHeaders(t, 0.05, 250, { vLen: 330 }); personCard(t, 140, 300, 300, 380, 'personb', cnt, { zoom: 2.3, panX: 60, panY: 160 }); personCard(t, 640, 300, 300, 380, 'persona', cnt, { zoom: 1.7, panY: 120 }); }, { cy: 450, lift: 160, outScale: 0.85 });
      // 1.6 – 5.8: each audience on its word, on the side his finger points
      arrive(t, w('audience', 2.2) - 0.1, w('and', 3.3), () => audiencePanel(t, 560, 330, 440, [['India', 57], ['Pakistan', 18], ['Bangladesh', 12]], w('audience', 2.2) - 0.45), { cx: 780, cy: 450 });
      arrive(t, w('audience', 4.2) - 0.1, w('now,', 5.7), () => audiencePanel(t, 80, 330, 440, [['United States', 61], ['United Kingdom', 19], ['Canada', 11]], w('audience', 4.2) - 0.45), { cx: 300, cy: 450 });
      // 5.8 – 12.4: the two side by side, small and high, under the headers (A dimmer: the one to avoid)
      arrive(t, w('now,', 5.7), 12.2, () => { personHeaders(t, w('now,', 5.7), 230, { vLen: 300 });
        ctx.save(); ctx.translate(60, 290); ctx.scale(0.8, 0.8); audiencePanel(t, 0, 0, 440, [['United States', 61], ['United Kingdom', 19], ['Canada', 11]], 5.9); ctx.restore();
        ctx.save(); ctx.translate(670, 290); ctx.scale(0.8, 0.8); ctx.globalAlpha *= 0.75; audiencePanel(t, 0, 0, 440, [['India', 57], ['Pakistan', 18], ['Bangladesh', 12]], 6.0); ctx.restore();
        // "look like person B": B's side glows
        const hot = E.out(prog(t, w('person', 8.3), 0.3)) * (1 - E.in(prog(t, 9.6, 0.4)));
        if (hot > 0) { ctx.save(); ctx.globalAlpha *= hot; ctx.strokeStyle = 'rgba(255,90,190,0.9)'; ctx.lineWidth = 4; ctx.shadowColor = 'rgba(255,60,170,0.9)'; ctx.shadowBlur = 24; ctx.beginPath(); ctx.roundRect(58, 288, 356, 291, 20); ctx.stroke(); ctx.restore(); }
      }, { cy: 400 });
    } },
    { t0: 12.4, t1: 12.9, d: t => { speaker(t); } },
    { t0: 12.9, t1: 26.6, d: t => phoneWalk(t) },
    { t0: 26.6, t1: 29.2, d: t => {
      // he steps back in front of the page he just set: the UI is his wall now, dimmed; the setting pops out in a bubble
      BACKDROP = (tt, cam) => { ctx.save(); ctx.translate(cam.ox * 0.3, 0); minAgeScreen(tt, { india: 1, value: '25' }); ctx.fillStyle = 'rgba(30,32,38,0.5)'; ctx.fillRect(-100, -100, 1300, 2200); ctx.restore(); };
      speaker(t); BACKDROP = cityBackdrop;
      magnifier(t, 26.75, 250, 470, 200);
    } },
    { t0: 29.2, t1: 30.5, d: t => speaker(t) },
    { t0: 30.5, t1: 34.95, d: t => {
      speaker(t, 10 * E.out(prog(t, 30.5, 0.4))); ctx.fillStyle = `rgba(4,6,14,${0.35 * E.out(prog(t, 30.5, 0.4))})`; ctx.fillRect(0, 0, W, H);
      const enter = spring(t - 30.5, 'firm'), shot = w('screenshot', 33.8), sk = E.ramp(prog(t, shot + 0.12, 0.55));
      const s = lerp(1.3, 0.42, sk), x = lerp(540, 470, sk), y = lerp(1060, 1180, sk);
      // the screenshot: a phone body grows around the card as it shrinks into it
      if (sk > 0) { const pw = 560 * s + 70, ph = 820 * s + 170; phoneFrame(x - pw / 2, y - ph / 2, pw, ph, E.out(prog(t, shot + 0.15, 0.3)) * (1 - E.in(prog(t, 34.75, 0.2)))); }
      ctx.save(); ctx.translate(x, y + (1 - enter) * 700); ctx.rotate((1 - enter) * 0.12); ctx.scale(s, s); ctx.globalAlpha *= 1 - E.in(prog(t, 34.75, 0.2));
      top10Card(t, 30.5); ctx.restore();
      const fl = Math.max(0, 1 - Math.abs(t - shot - 0.05) * 10); if (fl > 0) { ctx.fillStyle = `rgba(255,255,255,${0.75 * fl})`; ctx.fillRect(0, 0, W, H); }
    } },
    { t0: 34.95, t1: 42.5, d: t => {
      speaker(t);
      commentBar(t, 34.95, 'Guerrilla', { y: 1170, out: w("i'll", 36.0) });
      dmBanner(t, w("i'll", 36.0), 37.25, { y: 1190, from: 'Your creator', line: 'Here’s your list! (see more)' });
    } },
  ];
  const c = [];
  c.push([0.05, 'pop'], [0.12, 'pop'], [w('100,000', 0.3), 'stat'], [w('audience', 2.2), 'card-in'], [w('audience', 4.2), 'card-in'], [w('now,', 5.7), 'slide-out']);
  CAPS.forEach(cp => c.push([cp.t0, 'word']));
  c.push([12.4, 'slide-out'], [w('person', 8.3), 'accent']);
  DOT.filter(d => d[3]).forEach(d => c.push([d[0], 'click-ui']));
  SCREENS.slice(1, 4).forEach(([t0]) => c.push([t0, 'scene']));
  c.push([21.5, 'card-in'], [22.2, 'cascade'], [w('50%', 22.9), 'accent'], [25.2, 'ui-reveal'], [26.75, 'pop'], [30.5, 'card-in'], [w('screenshot', 33.8) + 0.05, 'hard-hit'], [34.95, 'pop'], [35.9, 'cta'], [w("i'll", 36.0), 'notify'], [w('why.', 40.8), 'key-word']);
  CUES = c.sort((a, b) => a[0] - b[0]);
}

function segAt(t) { return SEG.find(s => t >= s.t0 && t < s.t1) ?? SEG[SEG.length - 1]; }
let TNOW = 0;
function frame(t) {
  TNOW = t;
  ctx = main; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.filter = 'none'; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  const s = segAt(t); ctx.save(); s.d(t, s); ctx.restore();
  handCard(t);
  captions(t);
  const end = prog(t, DUR - 0.3, 0.3); if (end > 0) { ctx.fillStyle = `rgba(0,0,0,${end})`; ctx.fillRect(0, 0, W, H); }
}

/* ───────────── sound + transport ───────────── */
let AC = null, SK = null, NATIVE = 0, ADDED = 0; const fired = new Set();
async function ensureAudio() { if (AC) return; AC = new AudioContext(); const src = AC.createMediaElementSource(audio); src.connect(AC.destination); SK = await sfxKit(AC, { base: '/packages/engine/assets/sfx/' }); await SK.analyse('../voice.mp3'); CUES.forEach(([a]) => { if (SK.nativeHas(a)) NATIVE++; }); }
let playing = false;
const playBtn = document.getElementById('play'), seek = document.getElementById('seek'), tEl = document.getElementById('t'), cmp = document.getElementById('cmp');
playBtn.onclick = async () => { await ensureAudio(); await AC.resume(); if (playing) { audio.pause(); vid.pause(); } else { await audio.play(); if (cmp.checked) { vid.currentTime = audio.currentTime; vid.play(); } } playing = !playing; FOOT_LIVE = playing; playBtn.textContent = playing ? 'Pause' : 'Play'; };
seek.oninput = () => { audio.currentTime = +seek.value; vid.currentTime = +seek.value; fired.clear(); CUES.forEach(([a], i) => { if (a < +seek.value) fired.add(i); }); };
cmp.onchange = () => { document.body.classList.toggle('cmp', cmp.checked); vid.currentTime = audio.currentTime; if (playing && cmp.checked) vid.play(); };
audio.onended = () => { playing = false; FOOT_LIVE = false; playBtn.textContent = 'Play'; };
function loop() {
  const t = audio.currentTime;
  if (playing && SK && document.getElementById('sfx').checked) CUES.forEach(([a, ev], i) => { if (!fired.has(i) && t >= a - 0.02 && t - a < 0.15) { fired.add(i); if (SK.cue(ev, a)) ADDED++; } });
  if (playing && cmp.checked && Math.abs(vid.currentTime - t) > 0.15) vid.currentTime = t;
  frame(t); seek.value = t; tEl.textContent = `${t.toFixed(2)} / ${DUR}`;
  requestAnimationFrame(loop);
}
window.renderAt = t => frame(t);
(async () => {
  await Promise.all([document.fonts.load('400 100px Anton'), document.fonts.load('800 100px InterTight'), document.fonts.load('italic 900 100px "Exo 2"'), document.fonts.load('900 100px "Exo 2"'), document.fonts.load('800 100px Poppins'), document.fonts.load('500 100px Poppins')]);
  WORDS = await (await fetch('../words.json')).json();
  for (let i = 1; i < WORDS.length; i++) if (WORDS[i].t < WORDS[i - 1].t) WORDS[i].t = WORDS[i - 1].t + 0.01;
  WORDS.forEach(x => { if (!(x.end > x.t)) x.end = x.t + 0.2; });
  // R5's speaker: a black tank top, bare arms, in front of a night city
  ROOM = { monitor: false, wall: ['#101422', '#0b0e18', '#05070d'], light: 'rgba(120,150,255,', torso: ['#121316', '#1d1e22', '#2a2b30'], collar: '#0e0f12', arms: ['#8c5a3c', '#a66c48'], backdrop: cityBackdrop };
  await loadFootage('../footage/');
  buildTextures(); buildTextures2(); buildCaps(); buildEdit();
  const q = new URLSearchParams(location.search); if (q.has('t')) audio.currentTime = +q.get('t');
  loop();
})();
