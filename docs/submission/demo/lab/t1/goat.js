// T1 v2 ("goated"): the Edit pipeline's finish on top of the R1 base (t1.js). Loaded after t1.js; it wraps frame().
//  · Premium Caption 1 (packages/library/src/captions/premium via the edit player's premium.js), crimson-lit key word,
//    below the face, one text layer per frame (it steps aside for slams, panels, posters and key cards)
//  · b-roll from the footage finder where the picture had nothing to say (data/refs/demo-t1/footage), entering on a
//    log zoom with a whip smear, graded into the crimson world; one picture-in-picture card for "the architectures"
//  · burned glass: a STEP n / 3 chip with a three-segment progress bar through each step
//  · finish: warm light leaks on every section change, a zoom-blur kick on each jump cut, film grain
'use strict';
const GOAT = { cap: null, list: [], draw: null, ticks: [], inserts: [], leaks: [], steps: [] };
const FOOT = '/data/refs/demo-t1/footage/';
function mkVid(src) { const v = document.createElement('video'); v.src = src; v.muted = true; v.playsInline = true; v.preload = 'auto'; v.crossOrigin = 'anonymous'; return v; }
async function seekVid(v, t) { if (!v.duration) await new Promise(r => { v.onloadedmetadata = r; }); const tt = Math.max(0, Math.min(v.duration - 0.05, t)); if (Math.abs(v.currentTime - tt) < 0.004 && v.readyState >= 2) return; await new Promise(r => { const d = () => { v.removeEventListener('seeked', d); r(); }; v.addEventListener('seeked', d); v.currentTime = tt; }); }

function buildGoat() {
  const A = (w, after = 0) => at(w, after);
  const tFirst = A('first'), tSecond = A('second'), tMain = A('main', tSecond), tThings = A('things', tSecond), tYou = A('you', tThings);
  const DBG = WT('debugging', tMain), AG = WT('agents', tMain), WHAT = WT('what', AG.t), WHY = WT('why', AG.t);
  const ins = (name, t0, t1, mode = 'full') => ({ name, v: mkVid(FOOT + name + '.mp4'), t0, t1, mode });
  GOAT.inserts = [
    ins('code', 0.05, A('only') - 0.05),                              // "everybody wants to learn CODING"
    ins('typing', A("don't", tFirst) - 0.05, A('understand', tFirst)), // "don't just learn syntax and code" (SYNTAX over it)
    ins('laptop', A('rather', tSecond) - 0.05, A("that's", tSecond)),  // "rather than just starting, let me start with front end"
    ins('server', tYou, tMain - 0.15, 'card'),                         // "these are the architectures I have designed"
    ins('typing', A('writing', tMain) - 0.05, DBG.t - 0.35),           // "not anymore you will be writing most of the code"
    ins('team', AG.t - 0.2, AG.end + 0.9),                               // AI AGENTS
    ins('debug', WHAT.t - 0.3, WHY.end + 0.9),                         // WHAT & WHY
  ].filter(i => i.t1 > i.t0 + 0.3);
  // leaks on every section change and every insert entrance
  GOAT.leaks = [...SEG.slice(1).map(s => s.t0), ...GOAT.inserts.map(i => i.t0)].sort((a, b) => a - b);
  // the three steps: from the end of each key card to the start of the next section card
  const keys = SEG.filter(s => s.k === 'key'), endAt = [keys[1]?.t0, keys[2]?.t0, SEG.find(s => s.k === 'poster' && s.t0 > keys[2].t0)?.t0];
  GOAT.steps = keys.map((k, i) => ({ n: i, t0: k.t1, t1: endAt[i] ?? k.t1 + 6 }));
}

/* ───────── draws ───────── */
function insertFull(t, I) {
  const v = I.v; if (!v.videoWidth) return;
  const d = t - I.t0, len = I.t1 - I.t0, enter = E.out(prog(t, I.t0, 0.28));
  const z = logLerp(1.28, 1, enter) * (1.03 + 0.05 * (d / len)), cover = Math.max(W / v.videoWidth, H / v.videoHeight) * z, dw = v.videoWidth * cover, dh = v.videoHeight * cover;
  const dx = (W - dw) / 2 + (1 - enter) * 120, dy = (H - dh) / 2;
  if (enter < 1) for (let k = 3; k >= 1; k--) { ctx.globalAlpha = 0.16 * (1 - enter); ctx.drawImage(v, dx + k * 60 * (1 - enter), dy, dw, dh); } // the whip smear in
  ctx.globalAlpha = 1; ctx.drawImage(v, dx, dy, dw, dh);
  // into the crimson world: a soft crimson multiply, lifted blacks, a dark edge
  ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = 'rgba(205,70,70,0.55)'; ctx.fillRect(0, 0, W, H); ctx.restore();
  const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.8); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(20,0,0,0.55)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
}
function insertCard(t, I) { // a printed card dropped over the speaker, below the face: it lands, presses, settles
  const v = I.v; if (!v.videoWidth) return;
  const k = E.out(prog(t, I.t0, 0.42)), out = E.in(prog(t, I.t1 - 0.3, 0.3)), press = Math.max(0, 1 - Math.abs(t - I.t0 - 0.36) * 8);
  const w = 860, h = 500, x = 540 + (1 - k) * -800 + out * 1100, y = 1450 + (1 - k) * 120;
  ctx.save(); ctx.translate(x, y); ctx.rotate(-0.05 + (1 - k) * -0.25); const s = 1 + 0.06 * (1 - k) - 0.02 * press; ctx.scale(s, s);
  ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = lerp(50, 22, k); ctx.shadowOffsetY = lerp(36, 12, k);
  ctx.fillStyle = '#f6f3ec'; ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 18); ctx.fill(); ctx.shadowColor = 'transparent';
  ctx.save(); ctx.beginPath(); ctx.roundRect(-w / 2 + 16, -h / 2 + 16, w - 32, h - 72, 10); ctx.clip();
  const cover = Math.max((w - 32) / v.videoWidth, (h - 72) / v.videoHeight); ctx.drawImage(v, -v.videoWidth * cover / 2, -h / 2 + 16 + (h - 72) / 2 - v.videoHeight * cover / 2, v.videoWidth * cover, v.videoHeight * cover); ctx.restore();
  ctx.fillStyle = '#151515'; ctx.font = `400 34px "Permanent Marker", cursive`; ctx.textAlign = 'left'; ctx.fillText('front end  <->  API  <->  back end', -w / 2 + 28, h / 2 - 18);
  ctx.restore();
}
function stepChip(t, S) {
  const k = E.out(prog(t, S.t0, 0.35)) * (1 - E.in(prog(t, S.t1 - 0.25, 0.25))); if (k <= 0) return;
  const y = 120 - (1 - k) * 60, w = 620, h = 96, x = 540;
  ctx.save(); ctx.globalAlpha = k;
  ctx.fillStyle = 'rgba(20,6,8,0.55)'; ctx.strokeStyle = 'rgba(255,220,200,0.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(x - w / 2, y - h / 2, w, h, h / 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ff3a2f'; ctx.beginPath(); ctx.arc(x - w / 2 + 52, y, 22, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = `800 28px InterTight`; ctx.textAlign = 'center'; ctx.fillText(String(S.n + 1), x - w / 2 + 52, y + 10);
  ctx.textAlign = 'left'; ctx.font = `800 30px InterTight`; ctx.fillText(['UNDERSTAND THE FLOW', 'DRAW THE ARCHITECTURE', 'DEBUG THE CODE'][S.n], x - w / 2 + 94, y + 4);
  for (let i = 0; i < 3; i++) { const bx = x - w / 2 + 94 + i * 150, fill = i < S.n ? 1 : i === S.n ? clamp((t - S.t0) / (S.t1 - S.t0)) : 0; ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(bx, y + 22, 136, 6); ctx.fillStyle = '#ff3a2f'; ctx.fillRect(bx, y + 22, 136 * fill, 6); }
  ctx.restore();
}
function leaks(t) {
  for (const a of GOAT.leaks) { const k = prog(t, a - 0.05, 0.6); if (k <= 0 || k >= 1) continue;
    const x = lerp(-300, W + 300, E.out(k)), g = ctx.createRadialGradient(x, H * 0.45, 0, x, H * 0.45, 700), a0 = Math.sin(k * Math.PI) * 0.55;
    g.addColorStop(0, `rgba(255,190,120,${a0})`); g.addColorStop(0.4, `rgba(255,90,40,${a0 * 0.5})`); g.addColorStop(1, 'rgba(255,60,20,0)');
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore(); }
}
const SNAP = makeCanvas(1080, 1920), sg = SNAP.getContext('2d');
function zoomKick(t) { // a radial zoom-blur on each jump cut (3 scaled copies fading over 0.14 s)
  let since = 9; for (const c of CUTS) if (c <= t) since = t - c; if (since > 0.14) return;
  const a = 1 - since / 0.14; sg.drawImage(cv, 0, 0);
  for (let i = 1; i <= 3; i++) { const s = 1 + 0.025 * i * a; ctx.save(); ctx.globalAlpha = 0.22 * a; ctx.translate(540, 900); ctx.scale(s, s); ctx.translate(-540, -900); ctx.drawImage(SNAP, 0, 0); ctx.restore(); }
}
function grain(t) { const s = Math.floor(t * 24); ctx.save(); ctx.globalAlpha = 0.05; for (let i = 0; i < 1400; i++) { ctx.fillStyle = rand(i + s * 977) > 0.5 ? '#fff' : '#000'; ctx.fillRect(rand(i * 2 + s) * W, rand(i * 3 + s * 7) * H, 2, 2); } ctx.restore(); }

/* ───────── the wrapped frame ───────── */
const baseFrame = frame;
frame = function (t) {
  const s = segAt(t), I = GOAT.inserts.find(i => t >= i.t0 && t < i.t1), bigs = BIG.filter(b => t >= b.t0 && t < b.t1);
  if (I && I.mode === 'full' && (s.k === 'full' || s.k === 'split')) { // b-roll replaces the speaker; R1's big words still land over it
    ctx = main; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.filter = 'none'; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    insertFull(t, I); bigs.forEach(b => drawBig(t, b));
  } else {
    const keepCap = caption; caption = () => {}; baseFrame(t); caption = keepCap; // R1 base without its caption
    if (I && I.mode === 'card') insertCard(t, I);
  }
  const textOn = bigs.length > 0 || s.k !== 'full' || (I && I.mode === 'card');
  if (!textOn && GOAT.cap) GOAT.draw(ctx, { ...GOAT.cap, y: 0.8 }, GOAT.list, t, 1080, 1920);
  GOAT.steps.forEach(S => { if (t >= S.t0 && t < S.t1 && s.k === 'full') stepChip(t, S); });
  zoomKick(t); leaks(t); grain(t);
};

/* ───────── sound: typing ticks on caption words, whooshes on b-roll entries, the bed ───────── */
function goatCues() {
  const quiet = t => BIG.some(b => t >= b.t0 && t < b.t1) || SEG.some(s => s.k !== 'full' && t >= s.t0 && t < s.t1);
  return [...GOAT.ticks.filter(t => !quiet(t)).map(t => [t, 'kenney.click.wav', 0.09]), ...GOAT.inserts.map(i => [i.t0, i.mode === 'card' ? 'fs.impact.soft-hit.wav' : 'woosh-tight.wav', i.mode === 'card' ? 0.35 : 0.3])];
}
async function goatReady() {
  const P = await import('/data/demo/me/src/premium.js');
  await document.fonts.load('80px "Russo One"').catch(() => {});
  GOAT.cap = P.premiumCaption1('1.1', '#ff3a2f'); GOAT.draw = P.drawCaption;
  GOAT.list = P.cards(WORDS.map(w => ({ text: w.word, t: w.t, end: w.end })), GOAT.cap.maxWords); GOAT.ticks = P.ticks(GOAT.list);
  buildGoat();
  await Promise.all(GOAT.inserts.map(i => new Promise(r => { if (i.v.readyState >= 1) r(); else { i.v.onloadedmetadata = r; i.v.onerror = r; } })));
  return goatCues();
}
