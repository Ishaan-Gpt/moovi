// "Taste" (script beat 8), same grammar as Meet Moovi: Moovi's halo opens into his memory ring, the camera dives
// through it into FalkorDB: the real craft library (948 assets in 15 categories, dumped from packages/engine/src/library
// catalog.ts) as a living graph: category clusters, IS_A spokes to each hub, synapses between assets that share a
// tag, pulses firing along them. Each category lights on its word; the count rolls to the real total; a real
// reference (R1, its 19 parts from data/refs/r1/parts.json) splits into its fundamentals that wire into the graph;
// the skill tree (the real ishaan-motion files, today's real versions) grows and sharpens; out through the ring.
// VO (~17.5 s): "So how are we different? We go deep on the one thing that matters most right now: taste. An
// ever-growing library in the graph: captions, effects, music beds, voices, camera moves, clips, about nine hundred
// and fifty pieces. We feed it references, and it breaks them into fundamentals. One global skill, a skill per style,
// both getting sharper with every reference."
import { MooviWorld, defaultScene } from '/data/demo/lib/moovi-character.js';
const W = 1920, H = 1080, END = 17.6;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x)), lerp = (a, b, k) => a + (b - a) * k, prog = (t, t0, d) => clamp((t - t0) / d);
function bez(x1, y1, x2, y2) { const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by; const X = s => ((ax * s + bx) * s + cx) * s, Y = s => ((ay * s + by) * s + cy) * s; return x => { x = clamp(x); let lo = 0, hi = 1; for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; X(m) < x ? lo = m : hi = m; } return Y((lo + hi) / 2); }; }
const E = { io: bez(0.65, 0, 0.35, 1), out: bez(0.16, 1, 0.3, 1), in: bez(0.7, 0, 0.84, 0), hard: bez(0.95, 0, 0.05, 1) };
const spring = (t, w = 13, z = 0.45) => t <= 0 ? 0 : 1 - Math.exp(-z * w * t) * Math.cos(w * Math.sqrt(1 - z * z) * t);
function rand(s) { const x = Math.sin(s * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
const C = { iceWhite: '#F7FAFD', ice: '#CFE6F7', iceSoft: '#E6F2FB', deepIce: '#2B67C6', ink: '#0E1A2B', inkMuted: '#5B6B80', frostHi: '#A9D6F6', frostMid: '#7DB7EA', glacier: '#5394DA', mint: '#D2F5EC' };
const SANS = '"Inter Tight", sans-serif';
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const cv = document.getElementById('c'), g = cv.getContext('2d');
const T = { ring: 1.55, taste: 3.3, dive: 3.9, graph: 4.5, cap: 5.5, fx: 6.1, music: 6.7, voice: 7.4, cam: 7.9, clips: 8.5, all: 9.2, ref: 10.8, split: 11.9, skill: 13.6, out: 16.5 };

/* ───────── Moovi (the light world) ───────── */
const wc = document.getElementById('world');
const world = new MooviWorld(wc, { quality: 'high', scale: 1 }); cancelAnimationFrame(world.raf); world.loop = () => {};
const S = world.scene, D = defaultScene();
function setMoovi(t) {
  Object.assign(S.moovi, D.moovi); Object.assign(S.halo, D.halo); Object.assign(S.look, D.look); S.split = 0.9; S.crew.forEach(c => c.r = 0); world.wordOut = 0;
  const end = t > T.out; const m = 0.55 * (end ? 1 - E.io(prog(t, T.out, 0.8)) : E.io(prog(t, T.ring, 1.4)));   // the memory ring: the halo opens wide
  Object.assign(S.halo, { r: 0.62 + m * 2.2, tilt: 0.36 + m * 1.05, bubble: 1 + m * 7, y: 1.2 + m * 0.9, spin: 0.5 + m * 1.5 });
  const dive = end ? 1 - E.io(prog(t, T.out, 0.8)) : E.in(prog(t, T.dive - 0.25, 0.85));
  Object.assign(S.cam, D.cam, { x: lerp(-0.6, 0, E.io(prog(t, 0, 1.5))), y: 0.55 + m * 2.6 + dive * 1.2, z: 7.6 + m * 1.2 - dive * 5.2, tx: 0, ty: 0.22 + m * 2.0 + dive * 0.9, tz: 0, focal: 2.3 });
  if (end) { S.cam.x = 0; }
  S.moovi.squint = Math.sin(Math.PI * prog(t, 0.2, 1.4)); S.moovi.lean = 0.4 * Math.sin(Math.PI * prog(t, 0.2, 1.4));
  S.moovi.think = m * (end ? 0 : 1); S.moovi.celebrate = end ? Math.sin(Math.PI * prog(t, T.out + 0.5, 0.8)) : 0;
  S.look.follow = 1;
}

/* ───────── the graph (the dark world): the real library ───────── */
const LIB = await (await fetch('/data/demo/refs/library.json')).json();
const REF = await (await fetch('/data/demo/refs/r1-parts.json')).json();
const CATS = [...new Set(LIB.map(r => r.c))];
const LABEL = { voice: 'Voices', sfx: 'Sound effects', music: 'Music beds', caption: 'Captions', transition: 'Transitions', effect: 'Effects', camera: 'Camera moves', ui: 'UI pieces', '3d': '3D objects', insert: 'Clips', grade: 'Grades', overlay: 'Overlays', end_card: 'End cards', font: 'Fonts', texture: 'Textures' };
const count = c => LIB.filter(r => r.c === c).length;
// clusters on a sphere (Fibonacci), nodes in a soft cloud round each hub, sized by how many the category holds
const HUB = {}; CATS.forEach((c, i) => { const y = 1 - 2 * (i + 0.5) / CATS.length, r = Math.sqrt(1 - y * y), a = i * 2.39996; HUB[c] = [Math.cos(a) * r * 10, y * 6.5, Math.sin(a) * r * 10]; });
const NODES = LIB.map((r, i) => { const h = HUB[r.c], s = 0.9 + Math.sqrt(count(r.c)) * 0.18, u = rand(i * 3), v = rand(i * 3 + 1), w = rand(i * 3 + 2), th = u * 6.283, ph = Math.acos(2 * v - 1), rad = s * Math.cbrt(w);
  return { r, p: [h[0] + rad * Math.sin(ph) * Math.cos(th), h[1] + rad * Math.cos(ph) * 0.8, h[2] + rad * Math.sin(ph) * Math.sin(th)] }; });
const EDGES = []; // [a, b, kind]: 0 spoke to the hub, 1 a synapse (a shared tag across categories)
const byTag = {}; NODES.forEach((n, i) => n.r.tags.forEach(tag => { (byTag[tag] ??= []).push(i); }));
NODES.forEach((n, i) => { EDGES.push([i, -1 - CATS.indexOf(n.r.c), 0]);
  const tags = n.r.tags.filter(tag => byTag[tag].length > 1 && byTag[tag].length < 120); if (!tags.length || rand(i * 7) > 0.55) return;
  const pool = byTag[tags[Math.floor(rand(i * 11) * tags.length)]], j = pool[Math.floor(rand(i * 13) * pool.length)]; if (j !== i) EDGES.push([i, j, 1]); });
const posOf = k => k >= 0 ? NODES[k].p : HUB[CATS[-1 - k]];
const ACTIVE = [[T.cap, 'caption'], [T.fx, 'effect'], [T.music, 'music'], [T.voice, 'voice'], [T.cam, 'camera'], [T.clips, 'insert']];
const activeAt = t => { let a = null; for (const [at, c] of ACTIVE) if (t >= at) a = [at, c]; return t < T.all ? a : null; };
// camera keys in the graph (eye, target), hard into each category hub, a pull-back to the whole constellation
const hubCam = (c, d = 5.2, side = 0) => { const h = HUB[c], n = Math.hypot(...h) || 1; return { e: [h[0] * (1 + d / n) + side, h[1] * (1 + d / n) + 1.2, h[2] * (1 + d / n)], tg: h }; };
const GK = [[T.graph - 0.3, { e: [0, 0.5, 4], tg: [0, 0, -10] }, 'io'], [T.graph + 0.6, { e: [0, 2, 26], tg: [0, 0, 0] }, 'hard'],
  ...ACTIVE.map(([at, c], i) => [at + 0.3, hubCam(c, 5.5, i % 2 ? 1.5 : -1.5), 'hard']),
  [T.all + 0.7, { e: [0, 6, 34], tg: [0, 0, 0] }, 'hard'], [T.ref + 0.3, { e: [3, 3, 27], tg: [0, 0, 0] }, 'io'], [T.split + 0.4, { e: [-2, 2, 22], tg: [0, 0, 0] }, 'io'], [T.skill + 0.5, { e: [0, 4, 30], tg: [0, 0, 0] }, 'hard'], [T.out, { e: [0, 3, 26], tg: [0, 0, 0] }, 'io']];
function gcam(t) { let i = 0; while (i < GK.length - 2 && t > GK[i + 1][0]) i++; const [ta, a] = GK[i], [tb, b, ease] = GK[i + 1], k = E[ease](clamp((t - ta) / (tb - ta)));
  const orbit = (t - T.graph) * 0.06; const e = a.e.map((v, j) => lerp(v, b.e[j], k)), tg = a.tg.map((v, j) => lerp(v, b.tg[j], k));
  const cx = e[0] * Math.cos(orbit) - e[2] * Math.sin(orbit), cz = e[0] * Math.sin(orbit) + e[2] * Math.cos(orbit); return { e: [cx, e[1], cz], tg }; }
function projector(cam) { const [ex, ey, ez] = cam.e, f = [cam.tg[0] - ex, cam.tg[1] - ey, cam.tg[2] - ez], fl = Math.hypot(...f); const fw = f.map(v => v / fl); let rt = [fw[2], 0, -fw[0]]; const rl = Math.hypot(...rt) || 1; rt = rt.map(v => v / rl); const up = [rt[1] * fw[2] - rt[2] * fw[1], rt[2] * fw[0] - rt[0] * fw[2], rt[0] * fw[1] - rt[1] * fw[0]];
  return p => { const d = [p[0] - ex, p[1] - ey, p[2] - ez], z = d[0] * fw[0] + d[1] * fw[1] + d[2] * fw[2]; if (z < 0.2) return null; const x = d[0] * rt[0] + d[1] * rt[1] + d[2] * rt[2], y = d[0] * up[0] + d[1] * up[1] + d[2] * up[2], s = 1150 / z; return { x: W / 2 - x * s, y: H / 2 - y * s, s, z }; }; }
const DOT = (() => { const c = mk(64, 64), x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.18, 'rgba(207,230,247,0.95)'); gr.addColorStop(0.45, 'rgba(83,148,218,0.35)'); gr.addColorStop(1, 'rgba(43,103,198,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return c; })();
function pill(x, y, text, sub, k, big = false) { if (k <= 0) return; const s = (0.7 + 0.3 * Math.min(1.1, k)) * (big ? 1.25 : 1); g.save(); g.translate(x, y); g.scale(s, s); g.globalAlpha = clamp(k * 2);
  g.font = `800 34px ${SANS}`; const w1 = g.measureText(text).width; g.font = `600 22px ${SANS}`; const w2 = sub ? g.measureText(sub).width : 0; const w = Math.max(w1, w2) + 56, h = sub ? 86 : 58;
  g.fillStyle = 'rgba(14,26,43,0.7)'; g.strokeStyle = 'rgba(169,214,246,0.55)'; g.lineWidth = 2; g.beginPath(); g.roundRect(-w / 2, -h / 2, w, h, 20); g.fill(); g.stroke();
  g.fillStyle = '#F7FAFD'; g.textAlign = 'center'; g.font = `800 34px ${SANS}`; g.fillText(text, 0, sub ? -4 : 12); if (sub) { g.fillStyle = C.frostHi; g.font = `600 22px ${SANS}`; g.fillText(sub, 0, 26); } g.restore(); }
function graphShot(t) {
  const bg = g.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, 1300); bg.addColorStop(0, '#13223a'); bg.addColorStop(1, '#070d18'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
  const cam = gcam(t), P = projector(cam), act = activeAt(t), born = E.out(prog(t, T.graph - 0.2, 0.9));
  const proj = NODES.map(n => P(n.p)), hubP = CATS.map(c => P(HUB[c])), pp = k => k >= 0 ? proj[k] : hubP[-1 - k];
  // edges: spokes faint, synapses brighter; the active cluster's light up; pulses travel along a seeded subset
  g.save(); g.globalCompositeOperation = 'lighter';
  EDGES.forEach(([a, b, kind], i) => { const A = pp(a), B = pp(b); if (!A || !B) return; const cat = NODES[a].r.c, hot = act && (cat === act[1] || (b >= 0 && NODES[b].r.c === act[1])) ? E.out(prog(t, act[0], 0.3)) : 0;
    const al = (kind ? 0.14 : 0.05) * born + hot * (kind ? 0.5 : 0.22); if (al < 0.01) return; g.strokeStyle = `rgba(125,183,234,${al.toFixed(3)})`; g.lineWidth = kind ? 1.4 : 0.8; g.beginPath(); g.moveTo(A.x, A.y); g.lineTo(B.x, B.y); g.stroke();
    if (kind && (rand(i) < 0.35 || hot)) { const u = ((t * (0.5 + rand(i * 3))) + rand(i * 5)) % 1, x = lerp(A.x, B.x, u), y = lerp(A.y, B.y, u), s = 3 + hot * 3; g.fillStyle = `rgba(210,245,236,${(0.5 + hot * 0.5) * born})`; g.beginPath(); g.arc(x, y, s, 0, 7); g.fill(); } });
  // nodes: depth-sized glows; the active cluster flares
  NODES.forEach((n, i) => { const q = proj[i]; if (!q) return; const hot = act && n.r.c === act[1] ? E.out(prog(t, act[0], 0.25)) : 0, pulse = 0.85 + 0.15 * Math.sin(t * 3 + i), s = Math.min(70, q.s * (0.16 + hot * 0.14) * pulse) * born;
    g.globalAlpha = clamp(0.35 + 0.65 * Math.min(1, 14 / q.z)) * (act && !hot ? 0.55 : 1); g.drawImage(DOT, q.x - s, q.y - s, s * 2, s * 2); });
  hubP.forEach((q, i) => { if (!q) return; const s = Math.min(120, q.s * 0.5) * born; g.globalAlpha = 0.9; g.drawImage(DOT, q.x - s, q.y - s, s * 2, s * 2); });
  g.restore();
  // labels: the active category with its real count, and real asset names near it
  if (act) { const [at, c] = act, q = hubP[CATS.indexOf(c)]; if (q) { pill(q.x, q.y - 70, LABEL[c], `${count(c)} in the graph`, spring(t - at, 13, 0.5), true);
    NODES.filter(n => n.r.c === c).slice(0, 40).filter((_, j) => j % 9 === 0).slice(0, 4).forEach((n, j) => { const p = proj[NODES.indexOf(n)]; if (p) pill(p.x, p.y - 26, n.r.n, null, spring(t - at - 0.12 - j * 0.07, 14, 0.5) * 0.75); }); } }
}

/* ───────── references → fundamentals; the skill tree ───────── */
function refShot(t) { // a reference card arrives, splits into its real parts, each a new node wired into the graph (HAS_PART)
  const k = spring(t - T.ref, 10, 0.6), sp = E.out(prog(t, T.split, 0.7)), out = E.in(prog(t, T.skill - 0.2, 0.3));
  g.save(); g.globalAlpha = (1 - out) * clamp(k);
  const cw = 640, ch = 380, cx = W / 2, cy = H / 2 - 20;
  if (sp < 1) { g.save(); g.translate(cx, cy); const s = lerp(0.6, 1, clamp(k)) * (1 - sp * 0.6); g.scale(s, s); g.globalAlpha *= 1 - sp;
    g.fillStyle = 'rgba(247,250,253,0.96)'; g.beginPath(); g.roundRect(-cw / 2, -ch / 2, cw, ch, 28); g.fill();
    g.fillStyle = C.deepIce; g.font = `700 26px ${SANS}`; g.textAlign = 'left'; g.fillText('REFERENCE · R1', -cw / 2 + 40, -ch / 2 + 60);
    g.fillStyle = C.ink; g.font = `800 44px ${SANS}`; const words = REF.title.split(' '); let line = '', y = -ch / 2 + 130; for (const w of words) { if (g.measureText(line + w).width > cw - 80) { g.fillText(line, -cw / 2 + 40, y); line = ''; y += 54; } line += w + ' '; } g.fillText(line, -cw / 2 + 40, y);
    g.fillStyle = C.inkMuted; g.font = `600 24px ${SANS}`; g.fillText(`${REF.parts.length} parts`, -cw / 2 + 40, ch / 2 - 40); g.restore(); }
  REF.parts.forEach((p, i) => { const a = i / REF.parts.length * 6.283 + 0.3, rr = 330 + (i % 3) * 70, x = cx + Math.cos(a) * rr * 1.45 * sp, y = cy + Math.sin(a) * rr * 0.8 * sp, kk = clamp(sp * 1.2 - i * 0.015);
    if (kk <= 0) return; g.strokeStyle = `rgba(125,183,234,${0.45 * kk})`; g.lineWidth = 1.5; g.beginPath(); g.moveTo(cx, cy); g.lineTo(x, y); g.stroke();
    g.drawImage(DOT, x - 14, y - 14, 28, 28); g.globalAlpha = (1 - out) * kk; g.fillStyle = '#F7FAFD'; g.font = `600 22px ${SANS}`; g.textAlign = x > cx ? 'left' : 'right'; g.fillText(p, x + (x > cx ? 20 : -20), y + 7); g.globalAlpha = 1 - out; });
  g.restore();
}
const BRANCHES = [['Edit', 'talking-head.md'], ['Launch', 'launch.md'], ['Showreel', 'showreel.md']], ROOTFILES = ['taste.md', 'motion-feel.md', 'camera.md', 'music-and-sound.md', 'look.md', 'palette.md'];
const VERSIONS = ['1.16.0', '1.16.1', '1.16.2', '1.16.3', '1.16.4', '1.16.5', '1.16.6'];
function skillShot(t) { // the global skill and a skill per style: the tree grows, every reference sharpens it (the real version log)
  const k = E.out(prog(t, T.skill, 0.5)), out = E.in(prog(t, T.out - 0.1, 0.4)); if (k <= 0) return;
  g.save(); g.globalAlpha = k * (1 - out); const cx = W / 2, cy = 470;
  const vi = Math.min(VERSIONS.length - 1, Math.floor(prog(t, T.skill + 0.6, 2.0) * VERSIONS.length)), sharp = vi / (VERSIONS.length - 1);
  ROOTFILES.forEach((f, i) => { const a = Math.PI + (i + 0.5) / ROOTFILES.length * Math.PI, x = cx + Math.cos(a) * 330, y = cy + Math.sin(a) * 200 - 40, kk = E.out(prog(t, T.skill + 0.25 + i * 0.06, 0.4));
    g.strokeStyle = `rgba(125,183,234,${0.4 * kk})`; g.lineWidth = 2; g.beginPath(); g.moveTo(cx, cy); g.lineTo(x, y); g.stroke(); g.globalAlpha = k * (1 - out) * kk; g.fillStyle = C.frostHi; g.font = `600 22px ${SANS}`; g.textAlign = 'center'; g.fillText(f, x, y - 14); g.drawImage(DOT, x - 10, y - 10, 20, 20); g.globalAlpha = k * (1 - out); });
  BRANCHES.forEach(([name, file], i) => { const x = cx + (i - 1) * 470, y = cy + 300, kk = spring(t - T.skill - 0.9 - i * 0.18, 11, 0.55);
    g.strokeStyle = `rgba(169,214,246,${0.6 * clamp(kk)})`; g.lineWidth = 3; g.beginPath(); g.moveTo(cx, cy + 50); g.bezierCurveTo(cx, cy + 180, x, cy + 150, x, y - 50); g.stroke();
    pill(x, y, name, file, kk); });
  pill(cx, cy, 'ishaan-motion', `global skill · v${VERSIONS[vi]}`, spring(t - T.skill, 12, 0.5), true);
  const glow = g.createRadialGradient(cx, cy, 10, cx, cy, 260 + sharp * 120); glow.addColorStop(0, `rgba(169,214,246,${0.12 + 0.2 * sharp})`); glow.addColorStop(1, 'rgba(169,214,246,0)'); g.globalCompositeOperation = 'lighter'; g.fillStyle = glow; g.fillRect(0, 0, W, H);
  g.restore();
}

/* ───────── type and finish ───────── */
function line(t, at, words, y, px, out, dark = false) {
  g.save(); g.textAlign = 'left'; g.font = `800 ${px}px ${SANS}`; g.letterSpacing = `${-px * 0.025}px`;
  const ws = words.map(w => typeof w === 'string' ? { s: w } : w), widths = ws.map(w => g.measureText(w.s + ' ').width); let x = W / 2 - widths.reduce((a, b) => a + b, 0) / 2 + px * 0.12;
  ws.forEach((w, i) => { const k = E.out(prog(t, at + i * 0.07, 0.45)), o = out ? E.in(prog(t, out, 0.28)) : 0; if (k > 0 && o < 1) {
    g.save(); g.globalAlpha = k * (1 - o); g.filter = `blur(${((1 - k) * 12 + o * 14).toFixed(1)}px)`; g.translate(x, y + (1 - k) * 26 - o * 22); const sc = lerp(1.06, 1, k); g.scale(sc, sc);
    if (w.hero) { const gr = g.createLinearGradient(0, -px * 0.8, 0, px * 0.1); gr.addColorStop(0, C.frostHi); gr.addColorStop(0.5, C.glacier); gr.addColorStop(1, dark ? C.frostMid : C.deepIce); g.fillStyle = gr; } else g.fillStyle = dark ? '#F7FAFD' : C.ink;
    g.fillText(w.s, 0, 0); g.restore(); } x += widths[i]; });
  g.restore();
}
function finish(t, dark) {
  const v = g.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 1.05); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, dark ? 'rgba(0,0,0,0.45)' : 'rgba(14,26,43,0.22)'); g.fillStyle = v; g.fillRect(0, 0, W, H);
  const s = Math.floor(t * 24); g.save(); g.globalAlpha = 0.035; for (let i = 0; i < 1200; i++) { g.fillStyle = rand(i + s * 977) > 0.5 ? '#fff' : '#000'; g.fillRect(rand(i * 2 + s) * W, rand(i * 3 + s * 7) * H, 2, 2); } g.restore();
}
function moovi(t) { const bg = g.createRadialGradient(W / 2, H * 0.42, 100, W / 2, H * 0.5, 1300); bg.addColorStop(0, '#FFFFFF'); bg.addColorStop(0.55, C.iceWhite); bg.addColorStop(1, '#D9E9F6'); g.fillStyle = bg; g.fillRect(0, 0, W, H); setMoovi(t); world.render(t, 1 / 30, t * 1000); g.drawImage(wc, 0, 0, W, H); }

function frame(t) {
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.filter = 'none';
  if (t < T.graph) { // the light world: Moovi, the question, his halo opens, we dive through the ring
    moovi(t);
    line(t, 0.25, ['How', 'are', 'we', { s: 'different?', hero: true }], 960, 112, 1.6);
    line(t, T.taste, [{ s: 'Taste.', hero: true }], 400, 220, T.dive + 0.2); // inside the open ring, clear of his face
    const fl = prog(t, T.dive + 0.3, 0.3); if (fl > 0) { g.fillStyle = `rgba(7,13,24,${fl})`; g.fillRect(0, 0, W, H); } finish(t, false);
  } else if (t < T.out + 0.4) { // the dark world: FalkorDB
    graphShot(t); if (t > T.ref - 0.1) refShot(t); if (t > T.skill - 0.1) skillShot(t);
    line(t, T.graph + 0.3, ['An', 'ever-growing', { s: 'library', hero: true }, 'in', 'the', 'graph.'], 140, 76, T.cap - 0.1, true);
    // the count rolls to the real total as the constellation pulls back
    if (t > T.all - 0.1 && t < T.ref + 0.2) { const k = E.out(prog(t, T.all, 1.0)), n = Math.round(948 * k), o = E.in(prog(t, T.ref - 0.1, 0.3)); g.save(); g.globalAlpha = 1 - o; g.textAlign = 'center'; g.font = `800 220px ${SANS}`; g.letterSpacing = '-6px';
      const gr = g.createLinearGradient(0, 400, 0, 640); gr.addColorStop(0, '#F7FAFD'); gr.addColorStop(1, C.frostMid); g.fillStyle = gr; g.fillText(String(n), W / 2, 620); g.font = `600 40px ${SANS}`; g.letterSpacing = '0px'; g.fillStyle = C.frostHi; g.fillText('pieces of taste, all in FalkorDB', W / 2, 690); g.restore(); }
    line(t, T.ref + 0.1, ['We', 'feed', 'it', { s: 'references.', hero: true }], 140, 76, T.split + 0.3, true);
    line(t, T.split + 0.3, ['It', 'breaks', 'them', 'into', { s: 'fundamentals.', hero: true }], 140, 76, T.skill - 0.2, true);
    line(t, T.skill + 0.2, ['One', 'global', 'skill.', 'A', 'skill', 'per', { s: 'style.', hero: true }], 140, 76, T.skill + 1.6, true);
    line(t, T.skill + 1.8, ['Sharper', 'with', 'every', { s: 'reference.', hero: true }], 140, 76, T.out + 0.1, true);
    const fi = 1 - prog(t, T.graph, 0.3); if (fi > 0) { g.fillStyle = `rgba(7,13,24,${fi})`; g.fillRect(0, 0, W, H); }
    finish(t, true);
  } else { moovi(t); finish(t, false); } // out through the ring: back to him
  const fo = prog(t, END - 0.25, 0.25); if (fo > 0) { g.fillStyle = `rgba(247,250,253,${fo})`; g.fillRect(0, 0, W, H); }
}

const CUES = [
  [0.2, 'fs.ui.pop-9.wav', 0.25], [T.ring, 'tonal.chime.wav', 0.3], [T.taste, 'fs.impact.soft-hit.wav', 0.5], [T.dive - 1.56 + 0.6, 'riser-short.wav', 0.35], [T.graph, 'fs.impact.punch2.wav', 0.45],
  ...ACTIVE.map(([a], i) => [a, i % 2 ? 'fs.ui.pop-4.wav' : 'ui.pop.wav', 0.35]), ...ACTIVE.map(([a]) => [a + 0.05, 'woosh-tight.wav', 0.22]),
  [T.all, 'woosh-short.wav', 0.35], ...[0, 1, 2, 3, 4, 5].map(i => [T.all + 0.1 + i * 0.12, 'kenney.click.wav', 0.2]), [T.all + 1.0, 'fs.impact.soft-hit.wav', 0.4],
  [T.ref, 'fs.whoosh.swosh-whoosh-air-cut.wav', 0.35], [T.split, 'fs.ui.the-best-bubble-pop-sound-fo.wav', 0.45], ...[0, 1, 2, 3, 4, 5, 6, 7].map(i => [T.split + 0.1 + i * 0.05, 'fs.ui.pop-9.wav', 0.14]),
  [T.skill, 'woosh-short.wav', 0.3], ...[0, 1, 2].map(i => [T.skill + 0.9 + i * 0.18, 'fs.ui.pop-4.wav', 0.3]), ...[0, 1, 2, 3, 4, 5].map(i => [T.skill + 0.6 + i * 0.33, 'kenney.click.wav', 0.18]), [T.out, 'fs.whoosh.swosh-whoosh-air-cut.wav', 0.35], [T.out + 0.6, 'tonal.chime.wav', 0.32],
].sort((a, b) => a[0] - b[0]);
const pk = setInterval(() => world.poll(), 40); await world.ready; await Promise.race([world.shapeReady('memory'), new Promise(r => setTimeout(r, 30000))]); clearInterval(pk);
await Promise.all([document.fonts.load(`800 40px "Inter Tight"`), document.fonts.load(`600 40px "Inter Tight"`)]);
window.TASTE = { END, CUES, MUSIC: { file: '/data/demo/music/mixkit-motivating-mornings.m4a', gain: 0.18, start: 20 }, frame: async t => { frame(t); } };
let t0 = performance.now(); const live = () => { if (!window.__render) { frame(((performance.now() - t0) / 1000) % END); requestAnimationFrame(live); } }; live();
