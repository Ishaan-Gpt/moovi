// "Meet Moovi" v4: an Apple-style launch beat from Moovi's own code (1920×1080, ~21.5 s on Ishaan's VO).
// Moovi is the morphing hero: the jelly wordmark streams out of him, he becomes a play button and a director's frame,
// splits into his seven agents, they merge back, the real preset bar flies out of him and assembles; each preset's
// segment grows into a window (the UI morph) that opens on Moovi becoming that preset's shape, then on the studio's
// own office (apps/studio office3d) with that preset's crew at work. Everything is real code and real UI: the
// @moovi/character MooviWorld renderer (driven frame by frame), the site's preset chooser (its own pixels), the
// studio's room layout. Camera: a keyed move on every line, slow drifts broken by speed-ramped whips, real motion blur
// (sub-frame renders) on the fast moves; type: big, tight, one hero word in the brand's ice gradient.
import { MooviWorld, defaultScene } from '/data/demo/lib/moovi-character.js';
const { PLACES, GRAPH, CREW_SLOTS, ORDER: SEATS, TINT, DESK_TOP, CREW_R, MOOVI_S, FLOOR: OF_FLOOR, NODE_OF, placeOf } = await import('/data/demo/lib/room3d.js');
const W = 1920, H = 1080, END = 21.5;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x)), lerp = (a, b, k) => a + (b - a) * k, prog = (t, t0, d) => clamp((t - t0) / d);
function bez(x1, y1, x2, y2) { const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by; const X = s => ((ax * s + bx) * s + cx) * s, Y = s => ((ay * s + by) * s + cy) * s; return x => { x = clamp(x); let lo = 0, hi = 1; for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; X(m) < x ? lo = m : hi = m; } return Y((lo + hi) / 2); }; }
const E = { io: bez(0.65, 0, 0.35, 1), out: bez(0.16, 1, 0.3, 1), in: bez(0.7, 0, 0.84, 0), hard: bez(0.95, 0, 0.05, 1), ramp: bez(0.86, 0, 0.07, 1) };
const spring = (t, w = 13, z = 0.45) => t <= 0 ? 0 : 1 - Math.exp(-z * w * t) * Math.cos(w * Math.sqrt(1 - z * z) * t);
function rand(s) { const x = Math.sin(s * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
const C = { iceWhite: '#F7FAFD', ice: '#CFE6F7', iceSoft: '#E6F2FB', deepIce: '#2B67C6', ink: '#0E1A2B', inkMuted: '#5B6B80', frostInk: '#3F6E9F', frostHi: '#A9D6F6', frostMid: '#7DB7EA', glacier: '#5394DA' };
const SANS = '"Inter Tight", sans-serif';
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

/* ───────── the worlds (his own renderer, our clock) ───────── */
const wc = document.getElementById('world'), oc = document.getElementById('office');
const world = new MooviWorld(wc, { quality: 'high', scale: 1 }), office = new MooviWorld(oc, { office: true, quality: 'high', scale: 1 });
for (const w of [world, office]) { cancelAnimationFrame(w.raf); w.loop = () => {}; }
const S = world.scene, D = defaultScene(), OS = office.scene;
const CREW = [['Editor', 'Your footage'], ['Researcher', 'Facts'], ['Writer', 'Script'], ['Sound', 'Voice & music'], ['Designer', 'Look'], ['Lens', 'Critic'], ['Keeper', 'Memory']];
const FLOOR = -1.04, crewY = r => FLOOR + r * 1.1, R = 0.42;
const ring = CREW.map((_, i) => { const u = i - 3; return [u * 1.05, 0.3 + 1.4 * (1 - (u / 3) ** 2)]; });
const T = { word: 0.2, morph: 2.45, dir: 4.45, split: 6.2, names: 8.4, merge: 12.55, bar: 12.8, click: 13.7, open: 13.9, launch: 14.25, show: 16.0, edit: 17.6 };
const NAME_AT = CREW.map((_, i) => T.names + i * 0.58);

/* ───────── the camera: keys with the ease INTO each key (hard = a speed-ramped whip, io = a drift) ───────── */
const KEYS = [
  [0.0, { x: -1.4, y: -0.25, z: 13.5, tx: 0, ty: 0.35, tz: 0 }, 'io'],
  [1.25, { x: -0.25, y: 0.3, z: 7.3, tx: 0, ty: 0.42, tz: 0 }, 'hard'],
  [2.3, { x: 0.3, y: 0.45, z: 6.9, tx: 0, ty: 0.42, tz: 0 }, 'io'],
  [2.65, { x: 3.3, y: 0.8, z: 6.0, tx: 0.15, ty: 0.3, tz: 0 }, 'hard'],
  [4.3, { x: 2.7, y: 0.65, z: 6.5, tx: 0.1, ty: 0.32, tz: 0 }, 'io'],
  [4.75, { x: 0.35, y: 2.4, z: 4.4, tx: 0, ty: 1.35, tz: 0 }, 'hard'],
  [6.1, { x: -0.1, y: 2.2, z: 4.8, tx: 0, ty: 1.3, tz: 0 }, 'io'],
  [6.75, { x: 0, y: 2.0, z: 12.8, tx: 0, ty: -0.15, tz: 0 }, 'hard'],
  [8.25, { x: -0.5, y: 1.7, z: 11.4, tx: 0, ty: -0.2, tz: 0 }, 'io'],
  ...NAME_AT.flatMap((a, i) => { const [x, z] = ring[i]; return [[a + 0.28, { x: x * 0.82, y: 0.55, z: z + 3.3, tx: x, ty: -0.45, tz: z }, 'hard'], [a + 0.56, { x: x * 0.82 + 0.15, y: 0.6, z: z + 3.2, tx: x + 0.05, ty: -0.45, tz: z }, 'io']]; }),
  [T.merge + 0.4, { x: 0, y: 0.9, z: 9.2, tx: 0, ty: 0, tz: 0 }, 'hard'],
  [13.4, { x: 0, y: 0.5, z: 6.4, tx: 0, ty: 0.15, tz: 0 }, 'io'],
  [14.0, { x: 0, y: 0.35, z: 5.4, tx: 0, ty: 0.05, tz: 0 }, 'in'],
];
function camAt(t) {
  let i = 0; while (i < KEYS.length - 2 && t > KEYS[i + 1][0]) i++;
  const [ta, a] = KEYS[i], [tb, b, ease] = KEYS[i + 1], k = E[ease](clamp((t - ta) / (tb - ta)));
  const o = {}; for (const key in a) o[key] = lerp(a[key], b[key], k); return o;
}
function setScene(t) {
  Object.assign(S.moovi, D.moovi); Object.assign(S.look, D.look); Object.assign(S.morph, D.morph); Object.assign(S.word, D.word); Object.assign(S.halo, D.halo);
  Object.assign(S.cam, D.cam, camAt(t)); S.cam.focal = 2.3;
  S.split = 0.9; S.crew.forEach(c => Object.assign(c, { x: 0, y: -0.1, z: 0, r: 0 }));
  Object.assign(S.word, { x: 0, y: 0.5, z: -1.7, s: 0.95, gap: 1.45, merge: E.io(prog(t, 2.2, 0.8)) });
  world.wordOut = E.io(prog(t, T.word, 1.6));
  S.moovi.wave = Math.sin(Math.PI * prog(t, 0.7, 1.2));
  S.moovi.squash = 0.5 * Math.sin(Math.PI * prog(t, 2.25, 0.4));
  // the morphing hero: a play button, a director's frame, himself
  S.morph.amount = E.out(prog(t, T.morph, 0.28)) * (1 - E.io(prog(t, 4.05, 0.3))); S.morph.play = 1 - E.hard(prog(t, 3.25, 0.25)); S.morph.frame = E.hard(prog(t, 3.25, 0.25));
  S.moovi.think = Math.sin(Math.PI * prog(t, T.dir, 1.6)); S.halo.spin = 0.5 + 2.5 * Math.sin(Math.PI * prog(t, T.dir, 1.6));
  // the split: a gulp, a cheer, seven of him; and back into one
  const sp = E.out(prog(t, T.split + 0.45, 0.9)), back = E.io(prog(t, T.merge, 0.6)), k = sp * (1 - back);
  S.moovi.squash = Math.max(S.moovi.squash, 0.55 * Math.sin(Math.PI * prog(t, T.split, 0.5)), 0.45 * Math.sin(Math.PI * prog(t, T.merge + 0.45, 0.4)));
  S.moovi.celebrate = Math.sin(Math.PI * prog(t, T.split + 0.15, 1.1));
  S.split = lerp(0.9, 0.06, k);
  CREW.forEach((_, i) => { const c = S.crew[i], hop = Math.sin(Math.PI * prog(t, NAME_AT[i] - 0.04, 0.38)) * 0.3; c.x = ring[i][0] * k; c.z = ring[i][1] * k; c.r = R * clamp(k * 1.6); c.y = crewY(c.r) + (1 - k) * 0.6 + hop; });
  S.moovi.z = -0.4 * k;
  const nm = NAME_AT.findIndex((a, i) => t >= a && t < (NAME_AT[i + 1] ?? T.merge)); if (nm >= 0) { S.moovi.direct = Math.sign(ring[nm][0]) || 1; S.look.x = clamp(ring[nm][0] / 3, -1, 1); S.look.follow = 0; }
  S.moovi.hold = 0;
}

/* ───────── drawing ───────── */
const cv = document.getElementById('c'), g = cv.getContext('2d');
const BOX = await new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = '/data/demo/refs/site/presets.png'; }); // the site's real preset chooser
const camDist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) + 0.6 * Math.hypot(a.tx - b.tx, a.ty - b.ty);
function worldFrame(t, into = g) { // motion blur: when the camera moves fast, average sub-frame renders over a 1/48 s shutter
  const v = camDist(camAt(t), camAt(t - 1 / 30)), n = v > 0.5 ? 7 : v > 0.22 ? 4 : 1;
  for (let i = 0; i < n; i++) { const ti = t - (i / Math.max(1, n - 1)) * (n > 1 ? 1 / 75 : 0); setScene(ti); world.render(ti, 1 / 30, ti * 1000); into.globalAlpha = 1 / (i + 1); into.drawImage(wc, 0, 0, W, H); }
  into.globalAlpha = 1; setScene(t);
}
function ground(into = g) { const bg = into.createRadialGradient(W / 2, H * 0.42, 100, W / 2, H * 0.5, 1300); bg.addColorStop(0, '#FFFFFF'); bg.addColorStop(0.55, C.iceWhite); bg.addColorStop(1, '#D9E9F6'); into.fillStyle = bg; into.fillRect(0, 0, W, H); }
function finish(t) { // vignette, a breathing bloom, grain
  const v = g.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 1.05); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(14,26,43,0.22)'); g.fillStyle = v; g.fillRect(0, 0, W, H);
  const s = Math.floor(t * 24); g.save(); g.globalAlpha = 0.035; for (let i = 0; i < 1200; i++) { g.fillStyle = rand(i + s * 977) > 0.5 ? '#fff' : '#000'; g.fillRect(rand(i * 2 + s) * W, rand(i * 3 + s * 7) * H, 2, 2); } g.restore();
}
const SWEEPS = [1.15, 2.65, 4.75, 6.75, T.merge + 0.4, T.launch + 0.1, T.show + 0.1, T.edit + 0.1];
function sweeps(t) { for (const a of SWEEPS) { const k = prog(t, a, 0.55); if (k <= 0 || k >= 1) continue; const x = lerp(-600, W + 600, E.io(k)); g.save(); g.globalCompositeOperation = 'screen'; const gr = g.createLinearGradient(x - 380, 0, x + 380, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, `rgba(255,255,255,${0.42 * Math.sin(k * Math.PI)})`); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.translate(x, H / 2); g.rotate(0.35); g.translate(-x, -H / 2); g.fillStyle = gr; g.fillRect(x - 400, -600, 800, H + 1200); g.restore(); } }
// Apple-style line: centred, big, tight; words rise and sharpen; the hero word in the ice gradient
function line(t, at, words, y, px, out) {
  g.save(); g.textAlign = 'left'; g.font = `800 ${px}px ${SANS}`; g.letterSpacing = `${-px * 0.025}px`;
  const ws = words.map(w => typeof w === 'string' ? { s: w } : w), widths = ws.map(w => g.measureText(w.s + ' ').width); let x = W / 2 - widths.reduce((a, b) => a + b, 0) / 2 + px * 0.12;
  ws.forEach((w, i) => { const k = E.out(prog(t, at + i * 0.07, 0.45)), o = out ? E.in(prog(t, out, 0.28)) : 0; if (k > 0 && o < 1) {
    g.save(); g.globalAlpha = k * (1 - o); g.filter = `blur(${((1 - k) * 12 + o * 14).toFixed(1)}px)`; const yy = y + (1 - k) * 26 - o * 22, sc = lerp(1.06, 1, k);
    g.translate(x, yy); g.scale(sc, sc);
    if (w.hero) { const gr = g.createLinearGradient(0, -px * 0.8, 0, px * 0.1); gr.addColorStop(0, C.frostHi); gr.addColorStop(0.5, C.glacier); gr.addColorStop(1, C.deepIce); g.fillStyle = gr; } else g.fillStyle = C.ink;
    g.fillText(w.s, 0, 0); g.restore(); } x += widths[i]; });
  g.restore();
}
function glassTag(x, y, name, role, k, accent = C.deepIce, sc = 1.3) {
  if (k <= 0) return; const s = (0.6 + 0.4 * Math.min(1.1, k)) * sc;
  g.save(); g.translate(x, y); g.scale(s, s); g.globalAlpha = clamp(k * 2);
  g.font = `800 34px ${SANS}`; const w1 = g.measureText(name).width; g.font = `500 22px ${SANS}`; const w2 = g.measureText(role).width; const w = Math.max(w1, w2) + 64, h = 92;
  g.shadowColor = 'rgba(14,26,43,0.22)'; g.shadowBlur = 30; g.shadowOffsetY = 12; g.fillStyle = 'rgba(247,250,253,0.88)'; g.beginPath(); g.roundRect(-w / 2, -h, w, h, 24); g.fill(); g.shadowColor = 'transparent';
  g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = 2; g.stroke(); g.beginPath(); g.moveTo(-12, 0); g.lineTo(0, 14); g.lineTo(12, 0); g.closePath(); g.fillStyle = 'rgba(247,250,253,0.88)'; g.fill();
  g.fillStyle = accent; g.beginPath(); g.arc(-w / 2 + 30, -h + 34, 7, 0, 7); g.fill();
  g.fillStyle = C.ink; g.textAlign = 'left'; g.font = `800 34px ${SANS}`; g.fillText(name, -w / 2 + 46, -h + 46); g.fillStyle = C.inkMuted; g.font = `500 22px ${SANS}`; g.fillText(role, -w / 2 + 46, -h + 76);
  g.restore();
}
/* the real preset bar, as three segments that can fly and grow */
const BAR = { x: 210, y: 760, w: 1500 }; BAR.h = BAR.w * BOX.height / BOX.width;
const segRect = (i, b = BAR) => ({ x: b.x + i * b.w / 3, y: b.y, w: b.w / 3, h: b.h });
function drawSeg(i, r, alpha = 1, lit = 0) {
  g.save(); g.globalAlpha = alpha; g.shadowColor = 'rgba(14,26,43,0.16)'; g.shadowBlur = 30; g.shadowOffsetY = 12; g.fillStyle = '#F7FAFD'; g.beginPath(); g.roundRect(r.x, r.y, r.w, r.h, r.h * 0.24); g.fill(); g.shadowColor = 'transparent';
  g.save(); g.beginPath(); g.roundRect(r.x, r.y, r.w, r.h, r.h * 0.24); g.clip(); g.drawImage(BOX, i * BOX.width / 3, 0, BOX.width / 3, BOX.height, r.x, r.y, r.w, r.h); g.restore();
  if (lit > 0) { g.strokeStyle = `rgba(43,103,198,${0.95 * lit})`; g.lineWidth = 4; g.beginPath(); g.roundRect(r.x + 4, r.y + 4, r.w - 8, r.h - 8, r.h * 0.2); g.stroke(); g.fillStyle = `rgba(207,230,247,${0.3 * lit})`; g.fill(); }
  g.restore();
}
function cursor(x, y, press) { g.save(); g.translate(x, y); g.scale(1.7 - press * 0.15, 1.7 - press * 0.15); g.shadowColor = 'rgba(0,0,0,0.25)'; g.shadowBlur = 8; g.shadowOffsetY = 3; g.fillStyle = '#fff'; g.strokeStyle = '#0E1A2B'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 30); g.lineTo(8, 23); g.lineTo(13, 34); g.lineTo(18, 32); g.lineTo(13, 21); g.lineTo(23, 21); g.closePath(); g.fill(); g.stroke(); g.restore(); }

/* ───────── the studio's office and the presets ───────── */
OS.floor = { y: OF_FLOOR, on: 1, strength: 1 }; OS.split = 0.02;
{ const me = placeOf('moovi'); Object.assign(OS.moovi, { x: me.seat.x, y: me.seat.y, z: me.seat.z, s: MOOVI_S }); }
CREW_SLOTS.forEach((id, i) => { const p = placeOf(id); OS.crew[i] = { x: p.seat.x, y: p.seat.y, z: p.seat.z, r: CREW_R, tint: TINT[id] ?? 0 }; });
OS.office = { desks: PLACES.map(p => ({ x: p.desk.x, y: DESK_TOP, z: p.desk.z, yaw: p.desk.yaw, w: p.desk.w, glow: 0, tone: 0, on: 1 })), graph: { ...GRAPH, activity: 0, stage: 4.55 }, hot: [] };
const MORPH_LEN = 0.85, OPEN_LEN = 0.45;
const RUNS = [
  { name: 'Launch video', at: T.launch, until: T.show, crew: ['researcher', 'writer', 'designer', 'sound', 'lens'], line: ['to', 'start', 'your', { s: 'brand.', hero: true }], seg: 1, shape: 'play' },
  { name: 'Showreel', at: T.show, until: T.edit, crew: ['writer', 'designer', 'sound', 'lens'], line: ['to', { s: 'promote', hero: true }, 'it.'], seg: 2, shape: 'frame' },
  { name: 'Edit', at: T.edit, until: 99, crew: ['editor', 'sound', 'designer', 'lens', 'keeper'], line: ['show', 'your', 'face,', 'cut', 'like', 'a', { s: 'pro.', hero: true }], seg: 0, shape: 'wave' },
];
const runAt = t => RUNS.find(r => t >= r.at && t < r.until) ?? RUNS[0];
const NAME = { moovi: 'Moovi', editor: 'Editor', researcher: 'Researcher', writer: 'Writer', sound: 'Sound', designer: 'Designer', lens: 'Lens', keeper: 'Keeper' };
const TOPBAR = { x: 56, y: 44, w: 820 }; TOPBAR.h = TOPBAR.w * BOX.height / BOX.width;
function officeRender(t, run, into) {
  const rt = t - run.at - MORPH_LEN;
  // camera: from close on Moovi at his seat, a crane out to the studio's three-quarter view, then a slow orbit
  const out = E.hard(prog(rt, 0, 0.7)), orbit = 0.28 * Math.sin((t - T.launch) * 0.35) + 0.1 * (RUNS.indexOf(run) - 1);
  const dist = lerp(5.0, 14.6, out), hgt = lerp(1.0, 6.4, out);
  Object.assign(OS.cam, { x: Math.sin(orbit) * dist, y: hgt, z: 0.2 + Math.cos(orbit) * dist, tx: 0, ty: lerp(-0.1, -0.55, out), tz: lerp(-1.6, 0.2, out), focal: 2.3 });
  OS.office.desks.forEach((d, i) => { const id = PLACES[i].id, j = run.crew.indexOf(id); d.glow = 0; d.tone = 0;
    if (j >= 0) { const st = rt - 0.25 - j * 0.3; if (st > 0) { d.glow = st < 0.65 ? 1 : 0.55; d.tone = st < 0.65 ? 1 : 2; } }
    if (id === 'moovi' && rt > -0.2 && rt < 0.35) { d.glow = 1; d.tone = 1; } });
  const working = run.crew.filter((id, j) => { const st = rt - 0.25 - j * 0.3; return st > 0 && st < 0.65; });
  OS.office.graph.activity = Math.min(1, working.length / 2 + 0.3);
  CREW_SLOTS.forEach((id, i) => { const p = placeOf(id), c = OS.crew[i], busy = working.includes(id) ? 1 : 0, j = run.crew.indexOf(id), st = rt - 0.25 - j * 0.3, pop = j >= 0 && st > 0.65 ? Math.exp(-(st - 0.65) * 4) : 0;
    c.x = p.seat.x; c.z = p.seat.z; c.y = p.seat.y + busy * 0.045 * Math.sin(t * 9 + i * 1.7) + 0.08 * pop; c.r = CREW_R * (1 + 0.12 * pop); });
  const cur = working[working.length - 1];
  if (cur) { const j = run.crew.indexOf(cur), u = clamp((rt - 0.25 - j * 0.3) / 0.55), a = placeOf('moovi').seat, b = placeOf(cur).desk, into1 = u < 0.5, v = E.io(into1 ? u / 0.5 : (u - 0.5) / 0.5);
    const p0 = into1 ? [a.x, a.y + 0.4, a.z] : [b.x, DESK_TOP + 0.2, b.z], p1 = into1 ? [b.x, DESK_TOP + 0.2, b.z] : [GRAPH.x, GRAPH.y, GRAPH.z];
    Object.assign(OS.orb, { x: lerp(p0[0], p1[0], v), y: lerp(p0[1], p1[1], v) + 0.9 * Math.sin(Math.PI * v), z: lerp(p0[2], p1[2], v), r: 0.1, glow: 1 }); } else OS.orb.r = 0;
  OS.office.hot = run.crew.map((id, j) => ({ node: NODE_OF[id], amount: clamp(1 - (rt - 0.5 - j * 0.3) / 1.2) })).filter(h => h.amount > 0 && h.amount < 1);
  const side = cur ? Math.sign(placeOf(cur).seat.x - placeOf('moovi').seat.x) || 1 : 0, doneAt = 0.25 + run.crew.length * 0.3 + 0.35;
  Object.assign(OS.moovi, { direct: cur ? side * 0.9 : 0, think: rt < 0.25 ? 1 : 0, celebrate: rt > doneAt && rt < doneAt + 0.9 ? 1 : 0 }); Object.assign(OS.look, { x: side * 0.7, y: -0.25, follow: 0.15 });
  office.render(t, 1 / 30, t * 1000);
  ground(into); into.drawImage(oc, 0, 0, W, H);
  if (into === g) SEATS.forEach(id => { const p = placeOf(id), head = id === 'moovi' ? [p.seat.x, p.seat.y + MOOVI_S * 2.15, p.seat.z] : [p.seat.x, p.seat.y + CREW_R * 1.25, p.seat.z], q = office.project(head);
    const j = run.crew.indexOf(id), on = id === 'moovi' ? clamp(out * 2) : j >= 0 ? spring(rt - 0.25 - j * 0.3, 13, 0.5) : 0.3 * out;
    if (on > 0.01) glassTag(q.x, q.y - 6, NAME[id], id === 'moovi' ? 'Director' : (CREW.find(c => c[0] === NAME[id])?.[1] ?? ''), on, j >= 0 || id === 'moovi' ? C.deepIce : C.frostMid, 1.05); });
}
const inner = mk(W, H), ig = inner.getContext('2d');
function shapeRender(t, run, into) { // Moovi becomes the preset's shape, close
  const lt = t - run.at; setScene(12.0); S.split = 0.9; S.crew.forEach(c => c.r = 0); S.moovi.z = 0; S.moovi.direct = 0; S.look.follow = 1;
  Object.assign(S.cam, { x: lerp(0.8, 0, E.out(prog(lt, 0, MORPH_LEN))), y: 0.5, z: lerp(7.6, 6.4, E.out(prog(lt, 0, MORPH_LEN + 0.4))), tx: 0, ty: 0.35, tz: 0 });
  S.moovi.squash = 0.45 * Math.exp(-lt * 7);
  Object.assign(S.morph, { amount: E.out(prog(lt, 0.05, 0.3)), play: run.shape === 'play' ? 1 : 0, frame: run.shape === 'frame' ? 1 : 0, wave: run.shape === 'wave' ? 1 : 0, screen: 0, fill: 0 });
  world.render(t, 1 / 30, t * 1000); ground(into); into.drawImage(wc, 0, 0, W, H);
}
function windowOpen(t, t0, from, content) { // the UI morph: a segment's rect grows into the full frame, its content inside
  const k = E.hard(prog(t, t0, OPEN_LEN)), r = { x: lerp(from.x, 0, k), y: lerp(from.y, 0, k), w: lerp(from.w, W, k), h: lerp(from.h, H, k) }, rad = lerp(from.h * 0.24, 0, k);
  g.save(); g.shadowColor = 'rgba(14,26,43,0.3)'; g.shadowBlur = 60 * (1 - k); g.shadowOffsetY = 20 * (1 - k); g.fillStyle = '#fff'; g.beginPath(); g.roundRect(r.x, r.y, r.w, r.h, rad); g.fill(); g.shadowColor = 'transparent';
  g.beginPath(); g.roundRect(r.x, r.y, r.w, r.h, rad); g.clip(); const s = Math.max(r.w / W, r.h / H); g.drawImage(content, r.x + (r.w - W * s) / 2, r.y + (r.h - H * s) / 2, W * s, H * s); g.restore();
  return k;
}

/* ───────── the frame ───────── */
function frame(t) {
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.filter = 'none';
  if (t < T.launch) {
    ground(); worldFrame(t);
    line(t, 0.55, ['This', 'is', { s: 'Moovi.', hero: true }], 960, 128, 2.2);
    line(t, 2.6, ['Your', 'video', 'production', { s: 'team.', hero: true }], 960, 112, 4.35);
    line(t, 4.8, ['A', { s: 'director.', hero: true }], 960, 128, 6.05);
    if (t > T.dir && t < T.split + 0.3) { const h = world.halo(); glassTag(h.x, h.y - h.r * 0.5 - 30, 'Director', 'Moovi', spring(t - T.dir - 0.3, 12, 0.5) * (1 - E.in(prog(t, T.split, 0.25)))); }
    line(t, 6.55, ['And', 'a', 'crew', 'of', { s: 'seven.', hero: true }], 190, 112, 8.2);
    CREW.forEach(([n, r], i) => { const c = S.crew[i]; if (c.r < 0.05 || t < NAME_AT[i] - 0.05) return; const p = world.project([c.x, c.y + c.r * 1.25, c.z]), out = E.in(prog(t, T.merge, 0.3)), later = NAME_AT.filter((a, j) => j > i && t >= a).length, old = later >= 2 ? E.in(prog(t, NAME_AT[i + 2], 0.2)) : 0;
      glassTag(p.x, p.y - 8, n, r, spring(t - NAME_AT[i], 14, 0.45) * (1 - out) * (1 - old), i % 2 ? C.glacier : C.deepIce, 1.45); });
    line(t, T.merge + 0.3, ['Three', { s: 'presets.', hero: true }], 190, 112, T.open);
    // the bar: three segments fly out of him and assemble; a cursor picks Launch video; that segment opens
    if (t > T.bar) { const o = world.project([0, 0, 0]);
      [1, 0, 2].forEach((i, n) => { const at = T.bar + n * 0.09, k = spring(t - at, 11, 0.5), r = segRect(i), sc = lerp(0.15, 1, clamp(k, 0, 1.15));
        if (t < at) return; const cx = lerp(o.x, r.x + r.w / 2, clamp(k)), cy = lerp(o.y, r.y + r.h / 2, clamp(k)), rr = { x: cx - r.w * sc / 2, y: cy - r.h * sc / 2, w: r.w * sc, h: r.h * sc };
        if (!(t > T.open && i === 1)) drawSeg(i, rr, (t > T.open ? 1 - E.in(prog(t, T.open, 0.3)) : 1) * clamp((t - at) * 6), i === 1 ? E.out(prog(t, T.click, 0.25)) : 0); });
      if (t > 13.15 && t < T.open + 0.1) { const m = E.io(prog(t, 13.15, 0.5)), r = segRect(1); cursor(lerp(1560, r.x + r.w * 0.55, m), lerp(1030, r.y + r.h * 0.6, m), Math.max(0, 1 - Math.abs(t - T.click) * 8)); }
      if (t > T.open) { shapeRender(T.launch, RUNS[0], ig); windowOpen(t, T.open, segRect(1), inner); }
    }
  } else {
    const run = runAt(t), lt = t - run.at, first = run === RUNS[0];
    if (lt < MORPH_LEN) {
      if (first) shapeRender(t, run, g);
      else { officeRender(run.at - 0.01, RUNS[RUNS.indexOf(run) - 1], g); drawSeg(run.seg, segRect(run.seg, TOPBAR), 1, 1); shapeRender(t, run, ig); windowOpen(t, run.at, segRect(run.seg, TOPBAR), inner); }
      line(t, run.at + 0.12, [{ s: run.name, hero: true }], 1000, 96, run.at + MORPH_LEN - 0.12);
    } else officeRender(t, run, g);
    // the top bar keeps the real chooser in view, its active segment lit (the lit frame slides between presets)
    const tb = E.out(prog(t, run.at + MORPH_LEN, 0.4)); if (tb > 0) [0, 1, 2].forEach(i => drawSeg(i, segRect(i, TOPBAR), tb, i === run.seg ? 1 : 0));
    if (lt >= MORPH_LEN) line(t, run.at + MORPH_LEN + 0.1, [run.name + ',', ...run.line], 1010, 64, run.until - 0.2);
  }
  sweeps(t); finish(t);
  const fo = prog(t, END - 0.3, 0.3); if (fo > 0) { g.fillStyle = `rgba(247,250,253,${fo})`; g.fillRect(0, 0, W, H); }
}

/* ───────── sound (the owner's Style 1 pack): a whoosh on every whip, pops on arrivals, bubbles on morphs ───────── */
const WHIPS = KEYS.filter(k => k[2] === 'hard').map(k => k[0] - 0.22);
const CUES = [
  [0.05, 'riser-short.wav', 0.25], ...WHIPS.map(a => [a, 'woosh-tight.wav', 0.28]),
  ...[0, 1, 2, 3, 4].map(i => [T.word + 0.3 + i * 0.2, 'fs.ui.the-best-bubble-pop-sound-fo.wav', 0.26]),
  [T.morph, 'fs.ui.the-best-bubble-pop-sound-fo.wav', 0.4], [3.25, 'fs.ui.pop-9.wav', 0.35], [4.05, 'fs.ui.the-best-bubble-pop-sound-fo.wav', 0.3], [T.dir + 0.3, 'tonal.chime.wav', 0.3],
  [T.split, 'fs.ui.the-best-bubble-pop-sound-fo.wav', 0.45], ...[0, 1, 2, 3, 4, 5, 6].map(i => [T.split + 0.5 + i * 0.06, 'fs.ui.pop-9.wav', 0.16]),
  ...NAME_AT.map((a, i) => [a, i % 2 ? 'fs.ui.pop-4.wav' : 'ui.pop.wav', 0.34]), [T.merge + 0.45, 'fs.ui.the-best-bubble-pop-sound-fo.wav', 0.4],
  ...[0, 1, 2].map(n => [T.bar + n * 0.09, 'fs.ui.pop-4.wav', 0.3]), [T.click, 'fs.ui.mouse-2-button-fast-click.wav', 0.5], [T.open, 'fs.whoosh.swosh-whoosh-air-cut.wav', 0.42], [T.open + OPEN_LEN, 'fs.impact.soft-hit.wav', 0.45],
  ...RUNS.flatMap(r => [[r.at + 0.05, 'fs.ui.the-best-bubble-pop-sound-fo.wav', 0.38], ...(r === RUNS[0] ? [] : [[r.at, 'fs.whoosh.swosh-whoosh-air-cut.wav', 0.38], [r.at + OPEN_LEN, 'fs.impact.soft-hit.wav', 0.4]]), [r.at + MORPH_LEN, 'woosh-short.wav', 0.3],
    ...r.crew.map((_, j) => [r.at + MORPH_LEN + 0.25 + j * 0.3, j % 2 ? 'fs.ui.pop-9.wav' : 'kenney.click.wav', 0.24])]),
  [T.edit + MORPH_LEN + 0.25 + 5 * 0.3 + 0.35, 'tonal.chime.wav', 0.32],
].sort((a, b) => a[0] - b[0]);
const pk = setInterval(() => { world.poll(); office.poll(); }, 40);
await world.ready; await office.ready; await Promise.race([Promise.all([world.shapeReady('word'), world.shapeReady('morph')]), new Promise(r => setTimeout(r, 30000))]);
clearInterval(pk);
await Promise.all([document.fonts.load(`800 40px "Inter Tight"`), document.fonts.load(`500 40px "Inter Tight"`)]);
window.MEET = { END, CUES, MUSIC: { file: '/data/demo/music/mixkit-motivating-mornings.m4a', gain: 0.18, start: 0 }, frame: async t => { frame(t); } };
let t0 = performance.now(); const live = () => { if (!window.__render) { frame(((performance.now() - t0) / 1000) % END); requestAnimationFrame(live); } }; live();
