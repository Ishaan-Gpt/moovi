// "Meet Moovi" (script beat 3), a launch-style shot built from Moovi's own code and assets, 1920×1080:
//  the real Director (@moovi/character MooviWorld: the jelly SDF raymarch) driven frame by frame, the landing's own
//  choreography (the jelly wordmark streaming out of his back, the director's frame, the gooey split into the seven,
//  the camera visiting each), then he morphs into a screen and the camera flies into it: a keynote UI morph of the three
//  presets, each card growing to the frame with real Moovi output (Launch: the Resend v14 film; Showreel: the Blue
//  Bottle and Sassoon Dock plates; Edit: the engineer edit playing).
// VO (Ishaan, about 21 s): "This is Moovi, your video production team. A director, Moovi, and a crew of seven agents:
// Editor, Researcher, Writer, Sound, Designer, Lens and Keeper. Three presets. A Launch video to start your brand.
// A Showreel to promote it. And Edit, when you want to show your face, cut like a professional editor would."
import { MooviWorld, defaultScene } from '/data/demo/lib/moovi-character.js';
const W = 1920, H = 1080, END = 21.5;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x)), lerp = (a, b, k) => a + (b - a) * k, prog = (t, t0, d) => clamp((t - t0) / d);
function bez(x1, y1, x2, y2) { const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by; const X = s => ((ax * s + bx) * s + cx) * s, Y = s => ((ay * s + by) * s + cy) * s; return x => { x = clamp(x); let lo = 0, hi = 1; for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; X(m) < x ? lo = m : hi = m; } return Y((lo + hi) / 2); }; }
const E = { io: bez(0.65, 0, 0.35, 1), out: bez(0.16, 1, 0.3, 1), in: bez(0.7, 0, 0.84, 0), ramp: bez(0.86, 0, 0.07, 1), back: bez(0.34, 1.4, 0.64, 1) };
const spring = (t, w = 13, z = 0.45) => t <= 0 ? 0 : 1 - Math.exp(-z * w * t) * Math.cos(w * Math.sqrt(1 - z * z) * t);
const C = { iceWhite: '#F7FAFD', ice: '#CFE6F7', iceSoft: '#E6F2FB', deepIce: '#2B67C6', ink: '#0E1A2B', inkMuted: '#5B6B80', frostInk: '#3F6E9F', frostHi: '#A9D6F6', frostMid: '#7DB7EA', glacier: '#5394DA', mint: '#D2F5EC', lilac: '#E3DEFF' };
const SANS = '"Inter Tight", sans-serif', SERIF = '"Instrument Serif", serif';

/* ───────── the world (his own renderer, our clock) ───────── */
const wc = document.getElementById('world');
const world = new MooviWorld(wc, { quality: 'high', scale: 1 });
cancelAnimationFrame(world.raf); world.loop = () => {};      // we drive it: render(t) per frame
const S = world.scene, D = defaultScene();
const CREW = [['Editor', 'Your footage'], ['Researcher', 'Facts'], ['Writer', 'Script'], ['Sound', 'Voice & music'], ['Designer', 'Look'], ['Lens', 'Critic'], ['Keeper', 'Memory']];
const FLOOR = -1.04, crewY = r => FLOOR + r * 1.1, R = 0.42;
const ring = CREW.map((_, i) => { const u = i - 3; return [u * 1.05, 0.3 + 1.4 * (1 - (u / 3) ** 2)]; });
const T = { word: 0.15, merge: 2.3, frame: 2.5, dir: 4.4, split: 6.0, names: 8.3, back: 12.6, screen: 13.2, fill: 13.55, ui: 14.2, launch: 14.25, show: 16.0, edit: 17.6 };
const NAME_AT = CREW.map((_, i) => T.names + i * 0.6);
function setScene(t) {
  Object.assign(S.cam, D.cam); Object.assign(S.moovi, D.moovi); Object.assign(S.look, D.look); Object.assign(S.morph, D.morph); Object.assign(S.word, D.word); Object.assign(S.halo, D.halo);
  S.split = 0.9; S.crew.forEach(c => Object.assign(c, { x: 0, y: -0.1, z: 0, r: 0 }));
  // 1 · "This is Moovi": close and pulling back, the wordmark streams out of his back and parts around him; he waves
  const pull = E.io(prog(t, 0, 2.2));
  S.cam.z = lerp(6.4, 8.1, pull); S.cam.y = lerp(0.5, 0.7, pull); S.cam.ty = lerp(0.3, 0.42, pull);
  Object.assign(S.word, { x: 0, y: 0.5, z: -1.7, s: 0.95, gap: 1.45, merge: E.io(prog(t, T.merge, 0.9)) });
  world.wordOut = E.io(prog(t, T.word, 1.8));
  S.moovi.wave = Math.sin(Math.PI * prog(t, 0.55, 1.4));
  // 2 · "your video production team": the director's frame in front of his eyes; the letters flow back into him
  S.moovi.squash = 0.5 * Math.sin(Math.PI * prog(t, T.merge + 0.6, 0.5));
  // the morphing hero: he becomes a play button, then a director's frame, then himself again
  const mIn = E.io(prog(t, 2.6, 0.32)) * (1 - E.io(prog(t, 3.95, 0.35)));
  S.morph.amount = mIn; S.morph.play = 1 - E.io(prog(t, 3.2, 0.3)); S.morph.frame = E.io(prog(t, 3.2, 0.3)); S.morph.wave = 0;
  // 3 · "a director, Moovi": the halo thinks (spins, bridges)
  S.moovi.think = Math.sin(Math.PI * prog(t, T.dir, 1.6));
  // 4 · "and a crew of seven": a gulp, a cheer, the gooey split onto the arc; the camera rises to take them all in
  const sp = E.io(prog(t, T.split + 0.5, 1.1)), back = E.io(prog(t, T.back, 0.9));
  S.moovi.squash = Math.max(S.moovi.squash, 0.5 * Math.sin(Math.PI * prog(t, T.split, 0.6))); S.moovi.celebrate = Math.sin(Math.PI * prog(t, T.split + 0.2, 1.2));
  const k = sp * (1 - back);
  S.split = lerp(0.9, 0.06, k);
  CREW.forEach((_, i) => { const c = S.crew[i], hop = Math.sin(Math.PI * prog(t, NAME_AT[i] - 0.05, 0.4)) * 0.28;
    c.x = ring[i][0] * k; c.z = ring[i][1] * k; c.r = R * clamp(k * 1.6); c.y = crewY(c.r) + (1 - k) * 0.6 + hop; });
  const camK = sp * (1 - back);
  S.cam.y = lerp(S.cam.y, 1.7, camK); S.cam.z = lerp(S.cam.z, 11, camK); S.cam.ty = lerp(S.cam.ty, -0.2, camK);
  S.moovi.z = -0.4 * camK;
  // 5 · the names: the camera glides along the arc as each is named, Moovi points
  const glide = prog(t, T.names - 0.2, 4.6) * (1 - back);
  S.cam.x = lerp(-2.6, 2.6, E.io(glide)) * camK; S.cam.tx = S.cam.x * 0.85; S.moovi.direct = Math.sin(Math.PI * prog(t, T.names, 4.4)) * 0.8 * (S.cam.x >= 0 ? 1 : -1);
  S.look.x = clamp(S.cam.x / 2.6, -1, 1) * camK; S.look.follow = 1 - camK;
  // 6 · "three presets": back into one, he becomes the screen, the camera flies onto it
  // 6 · "three presets": back into one; he holds out the brief box (as on the site's hero); the camera pushes in
  const hold = E.io(prog(t, 12.85, 0.5)); S.moovi.hold = hold; const push = E.in(prog(t, 13.8, 0.5));
  if (t > T.back) { S.cam.z = lerp(S.cam.z, 7.0, E.io(prog(t, T.back, 1.0))) - push * 3.2; S.cam.y = lerp(S.cam.y, 0.55, E.io(prog(t, T.back, 1.0))); S.cam.ty = lerp(S.cam.ty, 0.1, E.io(prog(t, T.back, 1.0))) - push * 0.4; S.cam.x *= 1 - E.io(prog(t, T.back, 0.8)); S.cam.tx *= 1 - E.io(prog(t, T.back, 0.8)); }
}

/* ───────── the overlay (keynote UI, tags) ───────── */
const cv = document.getElementById('c'), g = cv.getContext('2d');
function glassTag(x, y, name, role, k, accent = C.deepIce) {
  if (k <= 0) return; const s = (0.6 + 0.4 * Math.min(1.1, k)) * 1.35;
  g.save(); g.translate(x, y); g.scale(s, s); g.globalAlpha = clamp(k * 2);
  g.font = `800 34px ${SANS}`; const w1 = g.measureText(name).width; g.font = `500 22px ${SANS}`; const w2 = g.measureText(role).width; const w = Math.max(w1, w2) + 64, h = 92;
  g.shadowColor = 'rgba(14,26,43,0.22)'; g.shadowBlur = 30; g.shadowOffsetY = 12;
  g.fillStyle = 'rgba(247,250,253,0.86)'; g.beginPath(); g.roundRect(-w / 2, -h, w, h, 24); g.fill(); g.shadowColor = 'transparent';
  g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = 2; g.stroke();
  g.beginPath(); g.moveTo(-12, 0); g.lineTo(0, 14); g.lineTo(12, 0); g.closePath(); g.fillStyle = 'rgba(247,250,253,0.86)'; g.fill(); // the pointer
  g.fillStyle = accent; g.beginPath(); g.arc(-w / 2 + 30, -h + 34, 7, 0, 7); g.fill();
  g.fillStyle = C.ink; g.textAlign = 'left'; g.font = `800 34px ${SANS}`; g.fillText(name, -w / 2 + 46, -h + 46); g.fillStyle = C.inkMuted; g.font = `500 22px ${SANS}`; g.fillText(role, -w / 2 + 46, -h + 76);
  g.restore();
}
function headline(t, at, words, x, y, px, o = {}) { // word-by-word: rise, blur → sharp, muted → ink; the hero word in serif italic
  g.save(); g.textAlign = 'left'; let cx = x; const widths = words.map(w => { g.font = w.hero ? `italic 400 ${px * 1.12}px ${SERIF}` : `${o.w ?? 800} ${px}px ${SANS}`; return g.measureText(w.s + ' ').width; });
  if (o.center) cx = x - widths.reduce((a, b) => a + b, 0) / 2;
  words.forEach((w, i) => { const k = E.out(prog(t, at + i * 0.08 + (o.jit ? (i % 3) * 0.012 : 0), 0.4)), out = o.out ? E.in(prog(t, o.out, 0.3)) : 0;
    if (k > 0 && out < 1) { g.font = w.hero ? `italic 400 ${px * 1.12}px ${SERIF}` : `${o.w ?? 800} ${px}px ${SANS}`; g.globalAlpha = k * (1 - out); g.filter = `blur(${((1 - k) * 8 + out * 10).toFixed(1)}px)`;
      g.fillStyle = w.hero ? (o.heroCol ?? C.deepIce) : (o.col ?? C.ink); g.fillText(w.s, cx, y + (1 - k) * 18 - out * 20); g.filter = 'none'; }
    cx += widths[i]; });
  g.restore();
}
function imgCover(img, x, y, w, h, z = 1, ox = 0) { if (!img) return; const s = Math.max(w / img.width, h / img.height) * z; g.drawImage(img, x + (w - img.width * s) / 2 + ox, y + (h - img.height * s) / 2, img.width * s, img.height * s); }
function slideshow(list, t, t0, x, y, w, h, per = 0.55) { const i = Math.floor(Math.max(0, t - t0) / per) % list.length, f = (Math.max(0, t - t0) % per) / per; imgCover(list[i], x, y, w, h, 1.04 + 0.05 * f, -20 * f); if (f > 0.82) { g.globalAlpha = (f - 0.82) / 0.18; imgCover(list[(i + 1) % list.length], x, y, w, h, 1.04, 0); g.globalAlpha = 1; } }

/* ───────── the three presets, drawn in code (design space 1100×840 inside each card) ───────── */
const CREWCOL = { Editor: '#5394DA', Researcher: '#7DB7EA', Writer: '#A9D6F6', Sound: '#D2F5EC', Designer: '#E3DEFF', Lens: '#CFE6F7', Keeper: '#2B67C6' };
function inCard(r, draw) { g.save(); g.translate(r.x, r.y); g.scale(r.w / 1100, r.h / 840); draw(); g.restore(); }
const rr = (x, y, w, h, rad) => { g.beginPath(); g.roundRect(x, y, w, h, rad); };
function chip(name, x, y, k, done) { // a crew member at work: a jelly dot, the name, a tick when done
  if (k <= 0) return; const s = 0.7 + 0.3 * Math.min(1, spring(k * 0.6, 14, 0.5));
  g.save(); g.translate(x, y); g.scale(s, s); g.globalAlpha = clamp(k * 3);
  g.fillStyle = 'rgba(247,250,253,0.12)'; rr(-8, -26, 230, 52, 26); g.fill(); g.strokeStyle = 'rgba(247,250,253,0.25)'; g.lineWidth = 2; g.stroke();
  const gr = g.createRadialGradient(10, -6, 2, 18, 0, 22); gr.addColorStop(0, '#fff'); gr.addColorStop(0.4, CREWCOL[name]); gr.addColorStop(1, '#2B67C6'); g.fillStyle = gr; g.beginPath(); g.arc(18, 0, 17 + Math.sin(k * 9) * 1.2, 0, 7); g.fill();
  g.fillStyle = '#F7FAFD'; g.font = `700 24px ${SANS}`; g.textAlign = 'left'; g.fillText(name, 46, 9);
  if (done) { g.strokeStyle = '#D2F5EC'; g.lineWidth = 4; g.beginPath(); g.moveTo(186, 0); g.lineTo(195, 9); g.lineTo(210, -8); g.stroke(); }
  g.restore();
}
// Launch: a site address types in, the page's own blocks lift off and morph into film frames, the frames line up into
// a strip with a play head; the crew lights in pipeline order
function launchUI(lt) {
  g.fillStyle = '#0E1A2B'; g.fillRect(0, 0, 1100, 840);
  const url = 'yourbrand.com', n = Math.floor(clamp((lt - 0.1) / 0.5) * url.length);
  g.fillStyle = 'rgba(247,250,253,0.08)'; rr(60, 50, 980, 64, 32); g.fill(); g.fillStyle = 'rgba(247,250,253,0.5)'; g.font = `500 28px ${SANS}`; g.textAlign = 'left'; g.fillText('🔒 ' + url.slice(0, n) + (lt % 0.5 < 0.25 && n < url.length ? '|' : ''), 96, 92);
  // the page: hero block + three feature cards
  const m = E.io(prog(lt, 0.75, 0.8)); // the morph: page blocks → 16:9 film frames in a row
  const blocks = [[80, 150, 940, 230], [80, 410, 290, 170], [405, 410, 290, 170], [730, 410, 290, 170]];
  blocks.forEach(([x, y, w, h], i) => {
    const fx = 80 + i * 240, fy = 470, fw = 220, fh = 124, X = lerp(x, fx, m), Y = lerp(y, fy, m) - Math.sin(m * Math.PI) * 40, Wd = lerp(w, fw, m), Hd = lerp(h, fh, m);
    g.fillStyle = i === 0 ? '#2B67C6' : ['#5394DA', '#7DB7EA', '#A9D6F6'][i - 1]; rr(X, Y, Wd, Hd, lerp(18, 10, m)); g.fill();
    g.fillStyle = 'rgba(14,26,43,0.35)'; rr(X + Wd * 0.08, Y + Hd * 0.62, Wd * (0.5 - 0.1 * i), Hd * 0.12, 6); g.fill(); // a line of copy inside each block
    if (i === 0) { g.fillStyle = '#F7FAFD'; g.font = `800 ${lerp(64, 22, m)}px ${SANS}`; g.fillText('Your product, live.', X + Wd * 0.06, Y + Hd * 0.42); }
  });
  // the strip: sprocket band, the play head sweeping
  const sk = E.out(prog(lt, 1.5, 0.4)); if (sk > 0) { g.globalAlpha = sk; g.fillStyle = 'rgba(247,250,253,0.08)'; rr(60, 440, 980, 184, 18); g.fill();
    for (let i = 0; i < 24; i++) { g.fillStyle = 'rgba(247,250,253,0.25)'; g.fillRect(74 + i * 40, 452, 18, 8); g.fillRect(74 + i * 40, 604, 18, 8); }
    const ph = 70 + 960 * prog(lt, 1.7, 1.3); g.fillStyle = '#D2F5EC'; g.fillRect(ph, 432, 4, 200); g.beginPath(); g.moveTo(ph - 12, 424); g.lineTo(ph + 16, 424); g.lineTo(ph + 2, 440); g.fill(); g.globalAlpha = 1; }
  ['Researcher', 'Writer', 'Designer', 'Sound'].forEach((c, i) => chip(c, 70 + i * 250, 700, lt - (0.3 + i * 0.35), lt > 1.6 + i * 0.25));
}
// Showreel: four looks; one is picked, opens into the frame; a title builds in it; the reel's frames slide under
function showUI(lt) {
  g.fillStyle = '#16233a'; g.fillRect(0, 0, 1100, 840);
  const looks = [['Night stage', '#0B1020', '#7DB7EA'], ['Editorial', '#F7FAFD', '#0E1A2B'], ['Blueprint', '#2B67C6', '#F7FAFD'], ['Real footage', '#3F6E9F', '#D2F5EC']];
  const pick = 2, open = E.ramp(prog(lt, 0.6, 0.6));
  looks.forEach(([name, bg, ink], i) => {
    const sx = 70 + i * 250, sy = 70, sw = 220, sh = 150, sel = i === pick;
    const x = sel ? lerp(sx, 70, open) : sx, y = sel ? lerp(sy, 70, open) : sy + open * 20, w = sel ? lerp(sw, 960, open) : sw, h = sel ? lerp(sh, 520, open) : sh;
    g.globalAlpha = sel ? 1 : 1 - open * 0.75; g.fillStyle = bg; rr(x, y, w, h, 16); g.fill();
    if (sel && open > 0.05) { // the blueprint look: grid, a brand title building word by word
      g.save(); rr(x, y, w, h, 16); g.clip(); g.strokeStyle = 'rgba(247,250,253,0.15)'; g.lineWidth = 2; for (let gx = x; gx < x + w; gx += 48) { g.beginPath(); g.moveTo(gx, y); g.lineTo(gx, y + h); g.stroke(); } for (let gy = y; gy < y + h; gy += 48) { g.beginPath(); g.moveTo(x, gy); g.lineTo(x + w, gy); g.stroke(); }
      ['Your', 'brand,'].forEach((wd, j) => { const k = E.out(prog(lt, 1.1 + j * 0.15, 0.35)); g.globalAlpha = k; g.fillStyle = ink; g.font = `800 ${86 * open}px ${SANS}`; g.fillText(wd, x + 60 + j * 230 * open, y + 200 * open + (1 - k) * 20); });
      const k3 = E.out(prog(lt, 1.45, 0.35)); g.globalAlpha = k3; g.font = `italic 400 ${100 * open}px ${SERIF}`; g.fillText('told well.', x + 60, y + 320 * open + (1 - k3) * 20); g.restore(); g.globalAlpha = 1;
    }
    if (!sel || open < 0.3) { g.fillStyle = ink; g.font = `700 24px ${SANS}`; g.fillText(name, x + 18, y + h - 20); }
    g.globalAlpha = 1;
  });
  for (let i = 0; i < 6; i++) { const k = E.out(prog(lt, 1.2 + i * 0.08, 0.4)), x = 70 + i * 162 - (lt * 40) % 162; g.globalAlpha = k * 0.9; g.fillStyle = ['#0B1020', '#2B67C6', '#5394DA', '#3F6E9F', '#7DB7EA', '#2B67C6'][i]; rr(x, 610 + (1 - k) * 30, 150, 84, 10); g.fill(); }
  g.globalAlpha = 1; ['Writer', 'Designer', 'Sound'].forEach((c, i) => chip(c, 70 + i * 250, 760, lt - (0.4 + i * 0.3), lt > 1.6 + i * 0.2));
}
// Edit: your face in the frame, captions popping on the words, the timeline below closing its gaps (the jump cuts)
function editUI(lt) {
  g.fillStyle = '#0f1d2c'; g.fillRect(0, 0, 1100, 840);
  const fx = 300, fy = 50, fw = 500, fh = 420; // the shot
  const bg = g.createLinearGradient(fx, fy, fx + fw, fy + fh); bg.addColorStop(0, '#3F6E9F'); bg.addColorStop(1, '#0E1A2B'); g.fillStyle = bg; rr(fx, fy, fw, fh, 18); g.fill();
  g.save(); rr(fx, fy, fw, fh, 18); g.clip(); const z = 1 + 0.06 * E.out(prog(lt, 1.0, 0.25)) + 0.01 * lt; g.translate(fx + fw / 2, fy + fh * 0.6); g.scale(z, z);
  g.fillStyle = '#CFE6F7'; g.beginPath(); g.ellipse(0, -80, 70, 86, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(0, 150, 190, 130, 0, Math.PI, 0); g.fill(); // a speaker, drawn
  g.fillStyle = '#0E1A2B'; const talk = 4 + 6 * Math.abs(Math.sin(lt * 14)); g.beginPath(); g.ellipse(0, -48, 18, talk, 0, 0, 7); g.fill(); g.beginPath(); g.arc(-24, -92, 6, 0, 7); g.arc(24, -92, 6, 0, 7); g.fill();
  g.restore();
  // captions: two-tier card, the key word lit (the Premium Caption 1 rhythm)
  const caps = [['SHOW', 'YOUR FACE'], ['CUT LIKE', 'A PRO']], ci = lt < 1.3 ? 0 : 1, ck = E.out(prog(lt, ci ? 1.3 : 0.3, 0.25));
  g.save(); g.globalAlpha = ck; g.textAlign = 'center'; g.fillStyle = '#F7FAFD'; g.font = `800 34px ${SANS}`; g.fillText(caps[ci][0], fx + fw / 2, fy + fh - 96 + (1 - ck) * 12);
  g.shadowColor = 'rgba(169,214,246,0.9)'; g.shadowBlur = 24; g.fillStyle = '#A9D6F6'; g.font = `900 ${52 * lerp(1.3, 1, ck)}px ${SANS}`; g.fillText(caps[ci][1], fx + fw / 2, fy + fh - 44); g.restore();
  // the timeline: clips with gaps (pauses, retakes) that close; the caption lane fills; the play head
  const close = E.io(prog(lt, 0.7, 0.6)), clips = [[0, 160], [200, 120], [370, 210], [640, 100], [790, 190]];
  let x = 70; g.fillStyle = 'rgba(247,250,253,0.06)'; rr(60, 520, 980, 200, 14); g.fill();
  clips.forEach(([gx, w], i) => { const X = lerp(70 + gx, x, close); g.fillStyle = '#5394DA'; rr(X, 540, w, 70, 8); g.fill();
    g.strokeStyle = 'rgba(247,250,253,0.5)'; g.lineWidth = 2; g.beginPath(); for (let k = 0; k < w; k += 6) { const a = 6 + 18 * Math.abs(Math.sin(k * 0.21 + i)); g.moveTo(X + k, 575 - a); g.lineTo(X + k, 575 + a); } g.stroke();
    const cap = E.out(prog(lt, 1.1 + i * 0.08, 0.3)); g.fillStyle = `rgba(210,245,236,${0.9 * cap})`; rr(X + 6, 630, (w - 12) * cap, 30, 8); g.fill(); x += w + 4; });
  const ph = 70 + 900 * prog(lt, 1.2, 1.6); g.fillStyle = '#D2F5EC'; g.fillRect(ph, 512, 4, 216);
  ['Editor', 'Sound', 'Lens'].forEach((c, i) => chip(c, 70 + i * 250, 780, lt - (0.3 + i * 0.35), lt > 1.4 + i * 0.25));
}

/* the keynote: three cards in a row; the named one grows to the hero rect (magic move: one rect tweened, corners and
   all), the others slide aside and dim; the copy lands word by word beside it */
const ROW = [{ x: 210, y: 300, w: 460, h: 560 }, { x: 730, y: 300, w: 460, h: 560 }, { x: 1250, y: 300, w: 460, h: 560 }];
const HERO = { x: 120, y: 120, w: 1100, h: 840 };
const PRESETS = [
  { name: 'Launch video', line: ['to', 'start', 'your', { s: 'brand.', hero: true }], at: T.launch, until: T.show, media: (t, r) => inCard(r, () => launchUI(t < T.launch ? 3 : t - T.launch)), tint: C.ink },
  { name: 'Showreel', line: ['to', { s: 'promote', hero: true }, 'it.'], at: T.show, until: T.edit, media: (t, r) => inCard(r, () => showUI(t < T.show ? 3 : t - T.show)), tint: '#16233a' },
  { name: 'Edit', line: ['show', 'your', 'face,', 'cut', 'like', 'a', { s: 'pro.', hero: true }], at: T.edit, until: 99, media: (t, r) => inCard(r, () => editUI(t < T.edit ? 3 : t - T.edit)), tint: '#0f1d2c' },
];
const ORDER = [1, 0, 2]; // row slots: Edit left, Launch middle, Showreel right (Launch is named first)
function cardRect(t, i) {
  const p = PRESETS[i], slot = ROW[ORDER.indexOf(i) >= 0 ? [1, 2, 0][i] : 0];
  const grow = E.ramp(prog(t, p.at, 0.6)) * (1 - E.ramp(prog(t, p.until, 0.55)));
  const r = { x: lerp(slot.x, HERO.x, grow), y: lerp(slot.y, HERO.y, grow), w: lerp(slot.w, HERO.w, grow), h: lerp(slot.h, HERO.h, grow), grow };
  const someoneElse = PRESETS.some((q, j) => j !== i && t >= q.at && t < q.until + 0.3);
  if (someoneElse && grow < 0.02) { const o = E.io(prog(t, PRESETS.find((q, j) => j !== i && t >= q.at)?.at ?? 0, 0.5)); const idx = [0, 1, 2].filter(j => j !== PRESETS.findIndex((q, jj) => jj !== i && t >= q.at && t < q.until + 0.3)).indexOf(i); r.x = lerp(r.x, 1300 + idx * 24, o); r.y = lerp(r.y, 150 + idx * 230, o); r.w = lerp(r.w, 520, o); r.h = lerp(r.h, 190, o); r.dim = o; }
  return r;
}
function keynote(t) {
  const enter = E.out(prog(t, T.ui - 0.05, 0.5));
  g.fillStyle = C.iceWhite; g.fillRect(0, 0, W, H);
  const bloom = g.createRadialGradient(1500, 200, 50, 1500, 200, 1200); bloom.addColorStop(0, 'rgba(207,230,247,0.85)'); bloom.addColorStop(1, 'rgba(207,230,247,0)'); g.fillStyle = bloom; g.fillRect(0, 0, W, H);
  if (t < T.launch + 0.15) headline(t, T.ui - 0.1, [{ s: 'Three' }, { s: 'presets.', hero: true }], 960, 200, 84, { center: true, out: T.launch + 0.05 });
  [0, 1, 2].forEach(i => {
    const p = PRESETS[i], r = cardRect(t, i), pop = spring(t - (T.ui + [1, 2, 0][i] * 0.08)), s = lerp(0.85, 1, clamp(pop, 0, 1.1));
    g.save(); g.translate(r.x + r.w / 2, r.y + r.h / 2); g.scale(s, s); g.translate(-(r.x + r.w / 2), -(r.y + r.h / 2)); g.globalAlpha = enter * (1 - 0.35 * (r.dim ?? 0));
    g.shadowColor = 'rgba(14,26,43,0.22)'; g.shadowBlur = 50; g.shadowOffsetY = 24; g.fillStyle = p.tint; g.beginPath(); g.roundRect(r.x, r.y, r.w, r.h, lerp(36, 28, r.grow)); g.fill(); g.shadowColor = 'transparent';
    g.save(); g.beginPath(); g.roundRect(r.x, r.y, r.w, r.h, lerp(36, 28, r.grow)); g.clip(); p.media(t, r);
    const sh = g.createLinearGradient(0, r.y + r.h * 0.55, 0, r.y + r.h); sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.6)'); g.fillStyle = sh; g.fillRect(r.x, r.y, r.w, r.h); g.restore();
    g.fillStyle = '#fff'; g.font = `800 ${lerp(44, 64, r.grow)}px ${SANS}`; g.textAlign = 'left'; g.fillText(p.name, r.x + 34, r.y + r.h - 40);
    g.restore();
    if (t >= p.at && t < p.until) headline(t, p.at + 0.35, p.line.map(w => typeof w === 'string' ? { s: w } : w), 1290, 860, 64, { out: p.until - 0.2, jit: true });
  });
  g.save(); g.fillStyle = C.frostInk; g.font = `800 30px ${SANS}`; g.textAlign = 'right'; g.globalAlpha = enter; g.fillText('moovi', W - 70, H - 50); g.restore();
}

/* ───────── "Three presets": Moovi holds out the real brief box; then the studio's own office (apps/studio office3d) ───────── */
const { PLACES, GRAPH, CREW_SLOTS, ORDER: SEATS, TINT, DESK_TOP, CREW_R, MOOVI_S, FLOOR: OF_FLOOR, NODE_OF, placeOf } = await import('/data/demo/lib/room3d.js');
const BOX = await new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = '/data/demo/refs/site/presets.png'; }); // the site's real preset chooser (1128×104)
const oc = document.getElementById('office');
const office = new MooviWorld(oc, { office: true, quality: 'high', scale: 1 });
cancelAnimationFrame(office.raf); office.loop = () => {};
const OS = office.scene;
OS.floor = { y: OF_FLOOR, on: 1, strength: 1 }; OS.split = 0.02; OS.halo.spin = 0.5;
{ const me = placeOf('moovi'); Object.assign(OS.moovi, { x: me.seat.x, y: me.seat.y, z: me.seat.z, s: MOOVI_S }); }
CREW_SLOTS.forEach((id, i) => { const p = placeOf(id); OS.crew[i] = { x: p.seat.x, y: p.seat.y, z: p.seat.z, r: CREW_R, tint: TINT[id] ?? 0 }; });
OS.office = { desks: PLACES.map(p => ({ x: p.desk.x, y: DESK_TOP, z: p.desk.z, yaw: p.desk.yaw, w: p.desk.w, glow: 0, tone: 0, on: 1 })), graph: { ...GRAPH, activity: 0, stage: 4.55 }, hot: [] };
const OT = { box: 12.9, click: 13.75, dive: 14.0, office: 14.3 };
// which desks each preset puts to work, in order (the pipeline: brief → footage/facts → script → sound → look → review → remember)
const RUNS = [
  { name: 'Launch video', at: T.launch, until: T.show, crew: ['researcher', 'writer', 'designer', 'sound', 'lens'], line: ['to', 'start', 'your', { s: 'brand.', hero: true }], seg: 1 },
  { name: 'Showreel', at: T.show, until: T.edit, crew: ['writer', 'designer', 'sound', 'lens'], line: ['to', { s: 'promote', hero: true }, 'it.'], seg: 2 },
  { name: 'Edit', at: T.edit, until: 99, crew: ['editor', 'sound', 'designer', 'lens', 'keeper'], line: ['show', 'your', 'face,', 'cut', 'like', 'a', { s: 'pro.', hero: true }], seg: 0 },
];
const runAt = t => RUNS.find(r => t >= r.at && t < r.until) ?? RUNS[0];
const MORPH_LEN = 0.85; // each preset opens on Moovi becoming its shape, then the studio takes over
const SHAPE = { 'Launch video': 'play', Showreel: 'frame', Edit: 'wave' };
function morphInsert(t, run) {
  const lt = t - run.at; setScene(12.6); Object.assign(S.cam, { x: 0, y: 0.6, z: lerp(7.4, 6.6, E.out(prog(lt, 0, MORPH_LEN))), tx: 0, ty: 0.35, tz: 0 }); S.moovi.hold = 0; S.moovi.squash = 0.4 * Math.exp(-lt * 8);
  const sh = SHAPE[run.name]; Object.assign(S.morph, { amount: E.out(prog(lt, 0, 0.3)), play: sh === 'play' ? 1 : 0, frame: sh === 'frame' ? 1 : 0, wave: sh === 'wave' ? 1 : 0, screen: 0, fill: 0 });
  world.render(t, 1 / 30, t * 1000);
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, C.iceWhite); bg.addColorStop(1, C.iceSoft); g.fillStyle = bg; g.fillRect(0, 0, W, H); g.drawImage(wc, 0, 0, W, H);
  presetBar(t, 56, 48, 820, run.seg, run.at);
  headline(t, run.at + 0.05, [{ s: run.name, hero: true }], 960, 1000, 72, { center: true });
}
function setOffice(t) {
  const lt = t - OT.office, run = runAt(t), rt = t - run.at - MORPH_LEN;
  // camera: the studio's three-quarter view from the open side of the horseshoe, landing from a dive and drifting
  const land = E.out(prog(t - (runAt(t).at - T.launch), OT.dive + MORPH_LEN, 0.9)), k = lerp(0.62, 1, land);
  Object.assign(OS.cam, { x: 0.25 * Math.sin(t * 0.25) + lerp(0, 0.6, prog(t, T.show, 5)) - 0.3, y: -0.55 + (5.6 + 0.55) * k * 1.18, z: 0.2 + (12.6 - 0.2) * k * 1.18, tx: 0, ty: -0.55, tz: 0.2, focal: 2.3 });
  // desks: the run's crew work one after another (0.3 s apart, 0.7 s each), then sit done in their colour
  OS.office.desks.forEach((d, i) => { const id = PLACES[i].id, j = run.crew.indexOf(id); d.glow = 0; d.tone = 0;
    if (j >= 0) { const st = rt - 0.25 - j * 0.32; if (st > 0) { d.glow = st < 0.7 ? 1 : 0.55; d.tone = st < 0.7 ? 1 : 2; } }
    if (id === 'moovi' && rt > 0 && rt < 0.4) { d.glow = 1; d.tone = 1; } });
  const working = run.crew.filter((id, j) => { const st = rt - 0.25 - j * 0.32; return st > 0 && st < 0.7; });
  OS.office.graph.activity = Math.min(1, working.length / 2 + 0.25);
  CREW_SLOTS.forEach((id, i) => { const p = placeOf(id), c = OS.crew[i], busy = working.includes(id) ? 1 : 0, j = run.crew.indexOf(id), st = rt - 0.25 - j * 0.32, pop = j >= 0 && st > 0.7 ? Math.exp(-(st - 0.7) * 4) : 0;
    c.x = p.seat.x; c.z = p.seat.z; c.y = p.seat.y + busy * 0.04 * Math.sin(t * 9 + i * 1.7) + 0.07 * pop; c.r = CREW_R * (1 + 0.1 * pop); });
  // the bead: Moovi → the working desk → the graph (the node flares)
  const cur = working[working.length - 1];
  if (cur) { const j = run.crew.indexOf(cur), u = clamp((rt - 0.25 - j * 0.32) / 0.6), a = placeOf('moovi').seat, gp = [GRAPH.x, GRAPH.y, GRAPH.z], b = placeOf(cur).desk;
    const into = u < 0.5, v = E.io(into ? u / 0.5 : (u - 0.5) / 0.5), p0 = into ? [a.x, a.y + 0.4, a.z] : [b.x, DESK_TOP + 0.2, b.z], p1 = into ? [b.x, DESK_TOP + 0.2, b.z] : gp;
    Object.assign(OS.orb, { x: lerp(p0[0], p1[0], v), y: lerp(p0[1], p1[1], v) + 0.9 * Math.sin(Math.PI * v), z: lerp(p0[2], p1[2], v), r: 0.1, glow: 1 }); }
  else OS.orb.r = 0;
  OS.office.hot = run.crew.map((id, j) => ({ node: NODE_OF[id], amount: clamp(1 - (rt - 0.55 - j * 0.32) / 1.2) })).filter(h => h.amount > 0 && h.amount < 1);
  const side = cur ? Math.sign(placeOf(cur).seat.x - placeOf('moovi').seat.x) || 1 : 0;
  Object.assign(OS.moovi, { direct: cur ? side * 0.9 : 0, think: rt < 0.3 ? 1 : 0, celebrate: rt > 0.25 + run.crew.length * 0.32 + 0.4 && rt < 0.25 + run.crew.length * 0.32 + 1.2 ? 1 : 0 });
  Object.assign(OS.look, { x: side * 0.7, y: -0.25, follow: 0.15 });
}
const NAME = { moovi: 'Moovi', editor: 'Editor', researcher: 'Researcher', writer: 'Writer', sound: 'Sound', designer: 'Designer', lens: 'Lens', keeper: 'Keeper' };
function presetBar(t, x, y, w, active, clickAt) { // the real chooser, drawn from the live site's pixels; the active preset lit
  const h = w * BOX.height / BOX.width;
  g.save(); g.shadowColor = 'rgba(14,26,43,0.18)'; g.shadowBlur = 40; g.shadowOffsetY = 16; g.fillStyle = '#F7FAFD'; g.beginPath(); g.roundRect(x, y, w, h, h * 0.22); g.fill(); g.shadowColor = 'transparent';
  g.drawImage(BOX, x, y, w, h);
  if (active >= 0) { const seg = w / 3, k = E.out(prog(t, clickAt, 0.3)); g.strokeStyle = `rgba(43,103,198,${0.9 * k})`; g.lineWidth = 4; g.beginPath(); g.roundRect(x + seg * active + 8, y + 6, seg - 16, h - 12, h * 0.18); g.stroke();
    g.fillStyle = `rgba(207,230,247,${0.35 * k})`; g.fill(); }
  g.restore();
}
function cursor(x, y, press) { g.save(); g.translate(x, y); g.scale(1.6 - press * 0.15, 1.6 - press * 0.15); g.fillStyle = '#fff'; g.strokeStyle = '#0E1A2B'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 30); g.lineTo(8, 23); g.lineTo(13, 34); g.lineTo(18, 32); g.lineTo(13, 21); g.lineTo(23, 21); g.closePath(); g.fill(); g.stroke(); g.restore(); }
function officeShot(t) {
  setOffice(t); office.render(t, 1 / 30, t * 1000);
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, C.iceWhite); bg.addColorStop(1, C.iceSoft); g.fillStyle = bg; g.fillRect(0, 0, W, H);
  const land = E.out(prog(t, OT.dive, 0.9)); g.save(); const z = lerp(1.25, 1, land); g.translate(W / 2, H / 2); g.scale(z, z); g.translate(-W / 2, -H / 2); g.drawImage(oc, 0, 0, W, H); g.restore();
  const run = runAt(t);
  // the studio's name tags over the agents that work in this run
  SEATS.forEach(id => { const p = placeOf(id), head = id === 'moovi' ? [p.seat.x, p.seat.y + MOOVI_S * 2.15, p.seat.z] : [p.seat.x, p.seat.y + CREW_R * 1.25, p.seat.z], q = office.project(head);
    const j = run.crew.indexOf(id), on = id === 'moovi' ? 1 : j >= 0 ? spring(t - run.at - MORPH_LEN - 0.25 - j * 0.32, 13, 0.5) : 0.35;
    if (on > 0.01) glassTag(q.x, q.y - 6, NAME[id], id === 'moovi' ? 'Director' : (CREW.find(c => c[0] === NAME[id])?.[1] ?? ''), on * 0.8, j >= 0 ? C.deepIce : C.frostMid); });
  presetBar(t, 56, 48, 820, run.seg, run.at);
  headline(t, run.at + MORPH_LEN + 0.1, [{ s: run.name + ',' }, ...run.line.map(w => typeof w === 'string' ? { s: w } : w)], 960, 1010, 58, { center: true, out: run.until - 0.2, jit: true });
}

/* ───────── the frame ───────── */
function frame(t) {
  if (t < OT.office) { setScene(t); world.render(t, 1 / 30, t * 1000); }
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.filter = 'none';
  if (t < OT.office) {
    // the world on the brand's icy ground (it draws with alpha)
    const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, C.iceWhite); bg.addColorStop(1, C.iceSoft); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.drawImage(wc, 0, 0, W, H);
    // copy beside him
    headline(t, 0.35, [{ s: 'This' }, { s: 'is' }, { s: 'Moovi.', hero: true }], 960, 150, 76, { center: true, out: 2.1 });
    headline(t, 2.35, [{ s: 'your' }, { s: 'video' }, { s: 'production' }, { s: 'team.', hero: true }], 960, 150, 76, { center: true, out: 4.2 });
    if (t >= T.dir - 0.1 && t < T.split + 0.6) { const h = world.halo(); glassTag(h.x, h.y - h.r * 0.6 - 24, 'Director', 'Moovi', spring(t - T.dir, 12, 0.5) * (1 - E.in(prog(t, T.split + 0.3, 0.3)))); }
    if (t >= T.split && t < T.names) headline(t, T.split + 0.15, [{ s: 'a' }, { s: 'crew' }, { s: 'of' }, { s: 'seven', hero: true }, { s: 'agents' }], 960, 150, 72, { center: true, out: T.names - 0.15 });
    CREW.forEach(([n, r], i) => { const c = S.crew[i]; if (c.r < 0.05 || t < NAME_AT[i] - 0.05) return; const p = world.project([c.x, c.y + c.r * 1.25, c.z]); const out = E.in(prog(t, T.back, 0.35));
      const later = NAME_AT.filter((a, j) => j > i && t >= a).length; const old = later >= 2 ? E.in(prog(t, NAME_AT[i + 2], 0.25)) : 0; glassTag(p.x, p.y - 8, n, r, spring(t - NAME_AT[i], 13, 0.45) * (1 - out) * (1 - old), i % 2 ? C.glacier : C.deepIce); });
    // the real brief box between his hands; a cursor clicks Launch video; we dive through it into the studio
    if (t > 12.85) { const hk = E.out(prog(t, 12.85, 0.5)), push = E.in(prog(t, 13.8, 0.5)), bw = lerp(900, 1500, hk) * (1 + push * 1.6), bx = 960 - bw / 2 - push * bw * 0.0, by = lerp(760, 700, hk) + push * 80;
      g.save(); g.globalAlpha = hk; presetBar(t, bx, by, bw, t > OT.click ? 1 : -1, OT.click); g.restore();
      if (t > 13.2) { const m = E.io(prog(t, 13.2, 0.5)); cursor(lerp(1500, bx + bw * 0.5, m), lerp(1000, by + bw * 0.045, m), Math.max(0, 1 - Math.abs(t - OT.click) * 8)); }
      headline(t, 12.9, [{ s: 'Three' }, { s: 'presets.', hero: true }], 960, 150, 76, { center: true, out: 13.9 }); }
    const fl = prog(t, 14.0, 0.25) * (1 - prog(t, 14.25, 0.2)); if (fl > 0) { g.fillStyle = `rgba(247,250,253,${fl})`; g.fillRect(0, 0, W, H); }
  } else { const run = runAt(t); if (t - run.at < MORPH_LEN) morphInsert(t, run); else officeShot(t); }
}

/* ───────── sound (the owner's Style 1 pack) ───────── */
const CUES = [
  ...[0, 1, 2, 3, 4].map(i => [T.word + 0.3 + i * 0.22, 'fs.ui.the-best-bubble-pop-sound-fo.wav', 0.3]), [0.6, 'fs.ui.pop-9.wav', 0.25],
  [T.frame + 0.3, 'finger-snap-tight.wav', 0.35], [T.merge + 0.5, 'woosh-short.wav', 0.25], [T.dir, 'tonal.chime.wav', 0.3], [T.dir + 0.05, 'fs.ui.pop-4.wav', 0.3],
  [T.split, 'fs.ui.the-best-bubble-pop-sound-fo.wav', 0.4], [T.split + 0.5, 'woosh-tight.wav', 0.35], ...[0, 1, 2, 3, 4, 5, 6].map(i => [T.split + 0.7 + i * 0.07, 'fs.ui.pop-9.wav', 0.18]),
  ...NAME_AT.map((a, i) => [a, i % 2 ? 'fs.ui.pop-4.wav' : 'ui.pop.wav', 0.32]),
  [T.back, 'woosh-short.wav', 0.3], [12.9, 'fs.ui.pop-4.wav', 0.35], [13.75, 'fs.ui.mouse-2-button-fast-click.wav', 0.5], [14.25 - 1.56, 'riser-short.wav', 0.35], [14.25, 'fs.impact.soft-hit.wav', 0.55],
  [T.launch, 'fs.whoosh.swosh-whoosh-air-cut.wav', 0.35], [T.show, 'fs.whoosh.swosh-whoosh-air-cut.wav', 0.35], [T.edit, 'fs.whoosh.swosh-whoosh-air-cut.wav', 0.35],
  [2.6, 'fs.ui.the-best-bubble-pop-sound-fo.wav', 0.35], [3.2, 'fs.ui.pop-9.wav', 0.3], [3.95, 'fs.ui.the-best-bubble-pop-sound-fo.wav', 0.3], ...[T.launch, T.show, T.edit].map(a => [a + 0.02, 'fs.ui.the-best-bubble-pop-sound-fo.wav', 0.4]), ...[T.launch, T.show, T.edit].map(a => [a + 0.85, 'woosh-tight.wav', 0.3]),
  ...[[T.launch, 5], [T.show, 4], [T.edit, 5]].flatMap(([a, n]) => Array.from({ length: n }, (_, j) => [a + 0.85 + 0.25 + j * 0.32, j % 2 ? 'fs.ui.pop-9.wav' : 'kenney.click.wav', 0.25])), [T.edit + 0.85 + 0.25 + 5 * 0.32 + 0.4, 'tonal.chime.wav', 0.3],
].sort((a, b) => a[0] - b[0]);
const pk = setInterval(() => { world.poll(); office.poll(); }, 40); // its own loop polls the compiling shaders; we stopped that loop
await world.ready; await office.ready; await Promise.race([Promise.all([world.shapeReady('word'), world.shapeReady('morph')]), new Promise(r => setTimeout(r, 30000))]);
await Promise.all([document.fonts.load(`800 40px "Inter Tight"`), document.fonts.load(`italic 400 40px "Instrument Serif"`)]);
clearInterval(pk);
window.MEET = { END, CUES, MUSIC: { file: '/data/demo/music/mixkit-motivating-mornings.m4a', gain: 0.16, start: 0 }, frame: async t => { frame(t); } };
let t0 = performance.now(); const live = () => { if (!window.__render) { frame(((performance.now() - t0) / 1000) % END); requestAnimationFrame(live); } }; live();
