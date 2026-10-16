// Crimson Poster kit: every component as a pure canvas function of time. Plain ES module, so the browser preview
// imports it as is. Everything is drawn in design units (1080 x 1920); the caller scales the context to the real
// frame. Colours come ONLY from `K.pal` (palette roles) and faces from `K.type`, so a brand palette re-skins the kit.
//
//   import { kit, ground, chestWords, ... } from './draw.js';
//   const K = kit(kitJson, { accent: '#0a5cff' });   // optional palette override per brand
//
// Each component takes (c, K, p, t): the 2D context, the resolved kit, its params (texts and the times things
// happen, in seconds), and the current time.

export const W = 1080, H = 1920;
export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const lerp = (a, b, k) => a + (b - a) * k;
export const prog = (t, t0, d) => clamp((t - t0) / d);
export const E = {
  out3: k => 1 - Math.pow(1 - k, 3),
  out5: k => 1 - Math.pow(1 - k, 5),
  inOut3: k => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
  back: k => { const c = 1.70158; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); },
};

/** Resolve a kit (kit.json) with an optional palette override (a brand's colours). */
export function kit(json, palette = {}) { return { ...json, pal: { ...json.palette, ...palette } }; }

/* ───────────── type ───────────── */
const face = (K, role, px, weight) => { const f = K.type[role]; return `${weight ?? f.weight} ${px}px ${f.family}`; };
export function text(c, s, x, y, o = {}) {
  c.save();
  c.textAlign = o.align ?? 'center'; c.textBaseline = 'alphabetic';
  if (o.alpha != null) c.globalAlpha *= o.alpha;
  c.fillStyle = o.fill ?? '#fff';
  if (o.glow) { c.shadowColor = o.glow; c.shadowBlur = o.glowBlur ?? 30; c.fillText(s, x, y); }
  c.shadowColor = o.shadow ?? 'rgba(0,0,0,0.55)'; c.shadowBlur = o.shadowBlur ?? 18; c.shadowOffsetY = o.shadowY ?? 4;
  c.fillText(s, x, y);
  c.restore();
}
/** a word in the display face, fitted to maxW */
export function display(c, K, s, x, y, maxW, px, o = {}) {
  c.font = face(K, 'display', px); const w = c.measureText(s).width;
  if (w > maxW) { px *= maxW / w; c.font = face(K, 'display', px); }
  text(c, s, x, y, o); return px;
}
const label = (c, K, px, w) => { c.font = face(K, 'label', px, w); };
const body = (c, K, px, w) => { c.font = face(K, 'text', px, w); };
const scaleAt = (c, x, y, s) => { c.translate(x, y); c.scale(s, s); };

/* ───────────── grounds ───────────── */
let NOISE = null;
function noise() {
  if (NOISE) return NOISE;
  NOISE = document.createElement('canvas'); NOISE.width = 540; NOISE.height = 960;
  const n = NOISE.getContext('2d'), d = n.createImageData(540, 960);
  let s = 7; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < d.data.length; i += 4) { const v = 110 + rnd() * 60; d.data[i] = v; d.data[i + 1] = v * 0.9; d.data[i + 2] = v * 0.9; d.data[i + 3] = 26; }
  n.putImageData(d, 0, 0); return NOISE;
}
/** effect:crimson-ground: lit centre to near-black edges, paper noise, vignette */
export function ground(c, K, box, glowAt = [0.5, 0.3]) {
  const [x, y, w, h] = box, P = K.pal;
  c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
  const gx = x + w * glowAt[0], gy = y + h * glowAt[1], g = c.createRadialGradient(gx, gy, 20, gx, gy, Math.max(w, h) * 0.9);
  g.addColorStop(0, P.accent); g.addColorStop(0.45, P.accentMid); g.addColorStop(1, P.deep);
  c.fillStyle = g; c.fillRect(x, y, w, h);
  c.globalCompositeOperation = 'overlay'; c.drawImage(noise(), x, y, w, h); c.globalCompositeOperation = 'source-over';
  const v = c.createRadialGradient(x + w / 2, y + h / 2, Math.min(w, h) * 0.3, x + w / 2, y + h / 2, Math.max(w, h) * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.55)'); c.fillStyle = v; c.fillRect(x, y, w, h);
  c.restore();
}

/* ───────────── props ───────────── */
/** a classic bit key, metal shaded; `hot` lights it in the kit's glow colours. Origin = centre of the bow. */
export function key(c, K, x, y, len, ang, o = {}) {
  const P = K.pal, hot = !!o.hot;
  c.save(); c.translate(x, y); c.rotate(ang);
  const sh = (a, b, m) => { const g = c.createLinearGradient(-len * 0.06, 0, len * 0.06, 0); g.addColorStop(0, a); g.addColorStop(0.5, m); g.addColorStop(1, b); return g; };
  const metal = hot ? sh(P.glow, P.pop, P.gold) : sh('#7d7d85', '#5f5f66', P.metal);
  if (hot) { c.shadowColor = P.glow; c.shadowBlur = 60; } else { c.shadowColor = 'rgba(0,0,0,0.45)'; c.shadowBlur = 10; c.shadowOffsetY = 6; }
  // bow: a ring with a heart-cut hole look (two lobes)
  c.fillStyle = metal; c.beginPath();
  c.arc(-len * 0.055, -len * 0.1, len * 0.075, 0, Math.PI * 2); c.arc(len * 0.055, -len * 0.1, len * 0.075, 0, Math.PI * 2); c.arc(0, -len * 0.04, len * 0.08, 0, Math.PI * 2); c.fill();
  c.shadowColor = 'transparent';
  c.globalCompositeOperation = 'destination-out'; c.beginPath(); c.arc(0, -len * 0.09, len * 0.04, 0, Math.PI * 2); c.fill(); c.globalCompositeOperation = 'source-over';
  // collar, shaft and bit with three teeth
  c.fillStyle = metal;
  c.fillRect(-len * 0.04, -len * 0.21, len * 0.08, len * 0.035);
  c.fillRect(-len * 0.022, -len * 0.96, len * 0.044, len * 0.76);
  c.beginPath(); c.moveTo(len * 0.022, -len * 0.96); c.lineTo(len * 0.13, -len * 0.96); c.lineTo(len * 0.13, -len * 0.9); c.lineTo(len * 0.09, -len * 0.9); c.lineTo(len * 0.09, -len * 0.86); c.lineTo(len * 0.12, -len * 0.86); c.lineTo(len * 0.12, -len * 0.8); c.lineTo(len * 0.022, -len * 0.8); c.fill();
  // a specular line down the shaft
  c.strokeStyle = hot ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.6)'; c.lineWidth = len * 0.008;
  c.beginPath(); c.moveTo(-len * 0.008, -len * 0.94); c.lineTo(-len * 0.008, -len * 0.24); c.stroke();
  c.restore();
}
/** dark flat icons (people, keypad, doc, desk, stopwatch, notebook) with a soft drop shadow */
export function icon(c, K, kind, x, y, s) {
  const P = K.pal; c.save(); c.translate(x, y); c.fillStyle = P.ink;
  c.shadowColor = 'rgba(0,0,0,0.5)'; c.shadowBlur = 16; c.shadowOffsetY = 8;
  if (kind === 'person') { c.beginPath(); c.arc(0, -s * 0.28, s * 0.25, 0, 7); c.fill(); c.beginPath(); c.ellipse(0, s * 0.32, s * 0.45, s * 0.32, 0, Math.PI, 0); c.fill(); }
  if (kind === 'keypad') { c.fillStyle = P.metal; c.beginPath(); c.roundRect(-s * 0.45, -s * 0.45, s * 0.9, s * 0.9, s * 0.12); c.fill(); c.shadowColor = 'transparent'; c.fillStyle = P.ink; label(c, K, s * 0.3, 800); c.textAlign = 'center'; [['1', -1, -1], ['2', 1, -1], ['3', -1, 1], ['4', 1, 1]].forEach(([d, a, b]) => c.fillText(d, a * s * 0.2, b * s * 0.2 + s * 0.1)); }
  if (kind === 'doc') { c.beginPath(); c.roundRect(-s * 0.35, -s * 0.45, s * 0.7, s * 0.9, s * 0.08); c.fill(); c.shadowColor = 'transparent'; c.strokeStyle = '#ddd'; c.lineWidth = s * 0.05; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(-s * 0.18, -s * 0.1 + i * s * 0.16); c.lineTo(s * 0.18, -s * 0.1 + i * s * 0.16); c.stroke(); } }
  if (kind === 'desk') { c.beginPath(); c.arc(-s * 0.1, -s * 0.38, s * 0.15, 0, 7); c.fill(); c.fillRect(-s * 0.25, -s * 0.2, s * 0.28, s * 0.4); c.fillRect(-s * 0.05, -s * 0.05, s * 0.55, s * 0.08); c.fillRect(s * 0.4, -s * 0.05, s * 0.06, s * 0.5); c.fillRect(-s * 0.3, s * 0.2, s * 0.06, s * 0.3); }
  if (kind === 'stopwatch') { c.beginPath(); c.arc(0, 0, s * 0.42, 0, 7); c.fill(); c.shadowColor = 'transparent'; c.fillStyle = P.paper; c.beginPath(); c.arc(0, 0, s * 0.34, 0, 7); c.fill(); c.fillStyle = P.accent; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, s * 0.34, -Math.PI / 2, -Math.PI / 2 + 1.6); c.fill(); c.fillStyle = P.ink; c.fillRect(-s * 0.06, -s * 0.6, s * 0.12, s * 0.14); }
  if (kind === 'notebook') { c.fillStyle = '#2a2a2e'; c.beginPath(); c.roundRect(-s * 0.4, -s * 0.36, s * 0.8, s * 0.72, s * 0.06); c.fill(); c.shadowColor = 'transparent'; c.fillStyle = '#555'; for (let i = 0; i < 4; i++) c.fillRect(-s * 0.3, -s * 0.22 + i * s * 0.14, s * 0.6, s * 0.06); }
  c.restore();
}
function dashed(c, K, x0, y, len, k) { c.save(); c.setLineDash([14, 12]); c.strokeStyle = K.pal.paper; c.lineWidth = 4; c.beginPath(); c.moveTo(x0, y); c.lineTo(x0 + len * k, y); c.stroke(); c.restore(); }

/* ───────────── captions ───────────── */
/** caption:chest-words: 1-3 words, heavy white sans, soft shadow, pops in. p = { text, t0, y } */
export function chestWords(c, K, p, t) {
  const m = K.motion.pop, k = E.back(prog(t, p.t0, m.seconds)), s = lerp(m.from, 1, k);
  c.save(); scaleAt(c, W / 2, p.y, s); body(c, K, 64); c.letterSpacing = '-1px';
  text(c, p.text, 0, 0, { fill: K.pal.paper, shadowBlur: 22, shadow: 'rgba(0,0,0,0.75)' }); c.restore();
}
/** caption:condensed-term: the chunk that names a thing, in the display face. p = { text, t0, y } */
export function condensedTerm(c, K, p, t) {
  const m = K.motion.pop, k = E.back(prog(t, p.t0, m.seconds));
  c.save(); scaleAt(c, W / 2, p.y, lerp(m.from, 1, k)); display(c, K, p.text.toUpperCase(), 0, 0, 820, 92, { fill: K.pal.paper, shadowBlur: 20 }); c.restore();
}

/* ───────────── kinetic type ───────────── */
const land = (K, t, at) => { const m = K.motion.land, k = E.out5(prog(t, at, m.seconds)); return { k, s: lerp(m.from, 1, k) }; };
/**
 * effect:connector-big-word. Variants by p.v:
 *  'low'  { small, big, at, bigAt, y }                         small line, the big word below it
 *  'top'  { words:[{w,at}], big, bigAt, after?, afterAt? }      words one by one at the top, big word under them
 *  'left' { small, big, at, bigAt }                             a number on the left
 *  'stack'{ small, head, headAt, lines:[{s,at,x,y}] }           a heading word, then stacked lines lower down
 * p.layer: 'behind' draws only the big word (between room and speaker, see effect:word-behind-head), 'front' the rest.
 */
export function connectorBigWord(c, K, p, t, layer = 'front') {
  const P = K.pal, behind = !!p.behind;
  if (p.v === 'low' && layer === 'front') {
    label(c, K, 56); text(c, p.small, W / 2, p.y - 190, { alpha: E.out3(prog(t, p.at, 0.15)) });
    if (t >= p.bigAt) { const { k, s } = land(K, t, p.bigAt); c.save(); scaleAt(c, W / 2, p.y, s); display(c, K, p.big, 0, 0, 760, 260, { alpha: k, fill: P.paper }); c.restore(); }
  }
  if (p.v === 'top') {
    if (layer === 'front' && p.words) {
      label(c, K, 34); const ws = p.words.map(x => x.w), widths = ws.map(w => c.measureText(w).width + 26); let x = W / 2 - widths.reduce((a, b) => a + b, 0) / 2;
      p.words.forEach((w, i) => { if (t >= w.at) text(c, w.w, x + widths[i] / 2, 360, { alpha: E.out3(prog(t, w.at, 0.12)) }); x += widths[i]; });
    }
    if (layer === (behind ? 'behind' : 'front') && t >= p.bigAt) { const { k, s } = land(K, t, p.bigAt); c.save(); scaleAt(c, W / 2, 660, s); display(c, K, p.big, 0, 0, 900, 340, { alpha: k, fill: P.paper, glow: behind ? null : 'rgba(255,255,255,0.6)' }); c.restore(); }
    if (layer === 'front' && p.after && t >= p.afterAt) { label(c, K, 40); text(c, p.after, 170, 720); }
  }
  if (p.v === 'left' && layer === 'front') {
    label(c, K, 48); text(c, p.small, 200, 760, { alpha: E.out3(prog(t, p.at, 0.15)) });
    if (t >= p.bigAt) display(c, K, p.big, 200, 900, 300, 150, { alpha: E.out3(prog(t, p.bigAt, 0.15)), fill: P.paper });
  }
  if (p.v === 'stack' && layer === 'front') {
    label(c, K, 56); text(c, p.small, 140, 300, { align: 'left' });
    if (t >= p.headAt) { c.font = face(K, 'display', 200); text(c, p.head, 140, 500, { align: 'left', alpha: E.out5(prog(t, p.headAt, 0.2)), fill: P.paper }); }
    p.lines.forEach(l => { if (t >= l.at) display(c, K, typeof l.s === 'function' ? l.s(t) : l.s, l.x, l.y, l.maxW ?? 900, 150, { alpha: E.out3(prog(t, l.at, 0.15)), fill: P.paper }); });
  }
}
/** effect:glow-title-count. p = { lines:[{s,at}], dots?: at, n?: 5 } */
export function glowTitle(c, K, p, t) {
  const m = K.motion.title;
  p.lines.forEach(l => { const k = E.out5(prog(t, l.at, m.seconds)); c.save(); scaleAt(c, W / 2, 260, lerp(m.from, 1, k)); display(c, K, l.s, 0, 0, 760, 190, { alpha: k, fill: K.pal.paper, glow: 'rgba(255,255,255,0.9)', glowBlur: 40 }); c.restore(); });
  if (p.dots != null) for (let i = 0; i < (p.n ?? 5); i++) { const k = E.back(prog(t, p.dots + i * 0.08, 0.2)); if (k > 0) { c.fillStyle = K.pal.paper; c.beginPath(); c.arc(330 + i * 105, 980 + Math.sin(i * 1.3) * 30, 16 * k, 0, 7); c.fill(); } }
}
/** ui:fake-progress-timer. p = { until: 2.6, total: 66, label: '1:06' } */
export function progressTimer(c, K, p, t) {
  if (t > p.until) return; const a = 1 - prog(t, p.until - 0.4, 0.4), P = K.pal, x = 150 + 780 * clamp(t / p.total);
  c.save(); c.globalAlpha = a; c.lineWidth = 6;
  c.strokeStyle = 'rgba(255,255,255,0.85)'; c.beginPath(); c.moveTo(150, 230); c.lineTo(930, 230); c.stroke();
  c.strokeStyle = P.accent; c.beginPath(); c.moveTo(150, 230); c.lineTo(x, 230); c.stroke();
  c.fillStyle = P.accent; c.beginPath(); c.arc(x, 230, 14, 0, 7); c.fill();
  label(c, K, 30, 600); text(c, '0:00', 150, 280, { align: 'left' }); text(c, p.label, 930, 280, { align: 'right' });
  c.restore();
}
/** effect:comment-cta. p = { at, keyword } */
export function commentCta(c, K, p, t) {
  label(c, K, 48); text(c, 'comment', W / 2, 1260);
  const k = E.back(prog(t, p.at + 0.4, 0.3)); if (k <= 0) return;
  c.save(); scaleAt(c, W / 2, 1460, k); display(c, K, `“${p.keyword}”`, 0, 0, 900, 240, { fill: K.pal.paper, glow: 'rgba(255,255,255,0.5)' }); c.restore();
  label(c, K, 40); text(c, '& I will share them', W / 2, 1530, { alpha: k });
}

/* ───────────── posters ───────────── */
/** insert:keys-poster. p = { t0, title:{over, word, under}, byAt?, byText?, items: 5 } */
export function keysPoster(c, K, p, t) {
  const P = K.pal, k = prog(t, p.t0, 0.5), push = lerp(1, 1.04, prog(t, p.t0, 3));
  ground(c, K, [0, 0, W, H], [0.5, 0.3]);
  c.save(); c.translate(W / 2, H / 2); c.scale(push, push); c.translate(-W / 2, -H / 2);
  label(c, K, 62, 800); text(c, p.title.over, W / 2, 300, { fill: P.warm, alpha: E.out3(k), glow: P.pop, glowBlur: 22 });
  const g = c.createLinearGradient(0, 360, 0, 600); g.addColorStop(0, P.warm); g.addColorStop(0.45, P.pop); g.addColorStop(1, P.accent);
  c.save(); c.globalAlpha = E.out3(k); c.translate(W / 2, 600); const z = lerp(1.12, 1, E.out5(k)); c.scale(z * 0.82, z);
  display(c, K, p.title.word, 0, 0, 560, 330, { fill: g, glow: P.pop, glowBlur: 70 }); c.restore();
  label(c, K, 40); text(c, p.title.under, W / 2, 660, { fill: P.warm, alpha: E.out3(prog(t, p.t0 + 0.25, 0.4)) });
  if (p.byAt != null && t >= p.byAt) { label(c, K, 36); text(c, p.byText, W / 2, 740, { alpha: E.out3(prog(t, p.byAt, 0.2)) }); }
  const R = [540, 1370], n = p.items ?? 5;
  c.strokeStyle = 'rgba(255,180,150,0.22)'; c.lineWidth = 3;
  for (const r of [470, 330]) { c.beginPath(); c.arc(R[0], R[1], r, Math.PI * 1.08, Math.PI * 1.92); c.stroke(); }
  const fan = E.back(prog(t, p.t0 + 0.15, 0.7));
  for (let i = 0; i < n; i++) {
    const a = lerp(0, -1.0 + i * (2 / (n - 1)), fan);
    key(c, K, R[0], R[1] + 30, 380, a);
    const lab = prog(t, p.t0 + 0.6 + i * K.motion.stagger, 0.3);
    if (lab > 0) { label(c, K, 30); text(c, `Secret ${i + 1}`, R[0] + Math.sin(a) * 470, R[1] - Math.cos(a) * 470, { fill: P.warm, alpha: lab * (i === (n >> 1) ? 1 : 0.75), glow: P.glow, glowBlur: 14 }); }
  }
  c.strokeStyle = P.metal; c.lineWidth = 12; c.beginPath(); c.arc(R[0], R[1] + 40, 54, 0, Math.PI * 2); c.stroke();
  // the hand: fingers wrapped round the ring, a wrist into a dark sleeve
  c.fillStyle = '#1a1414'; c.beginPath(); c.moveTo(560, 1640); c.lineTo(700, 1640); c.lineTo(780, H); c.lineTo(600, H); c.fill();
  const sk = c.createLinearGradient(480, 0, 700, 0); sk.addColorStop(0, P.skin); sk.addColorStop(1, '#5a3220'); c.fillStyle = sk;
  c.beginPath(); c.moveTo(520, 1440); c.quadraticCurveTo(640, 1430, 690, 1650); c.lineTo(570, 1660); c.quadraticCurveTo(515, 1560, 495, 1470); c.fill();
  for (let i = 0; i < 4; i++) { c.beginPath(); c.ellipse(512 + i * 26, 1438 + i * 6, 24, 34, -0.2, 0, Math.PI * 2); c.fill(); }
  c.beginPath(); c.ellipse(590, 1452, 26, 44, 0.5, 0, Math.PI * 2); c.fill();
  c.restore();
}
/** transition:key-chapter-card. p = { t0, t1, n, label:[...], poster: canvas of keysPoster } */
export function keyChapterCard(c, K, p, t) {
  const P = K.pal, m = K.motion.cardIn, k = prog(t, p.t0, m.seconds), pp = E.out3(prog(t, p.t0, p.t1 - p.t0)), z = lerp(2.5, 2.3, pp);
  c.save(); c.filter = `blur(${lerp(m.blurFrom, m.blurTo, E.out3(k))}px) brightness(0.85)`;
  c.drawImage(p.poster, 760 - 540 * z, 140 - 600 * z, W * z, H * z); c.filter = 'none'; c.restore();
  const v = c.createRadialGradient(540, 960, 300, 540, 960, 1200); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.5)'); c.fillStyle = v; c.fillRect(0, 0, W, H);
  const a = (p.n % 2 ? -0.35 : -0.8) + lerp(0.12, 0, pp);
  c.save(); c.globalAlpha = E.out3(k); c.translate(lerp(860, 800, pp), lerp(1420, 1380, pp)); const zk = lerp(1.35, 1, E.out5(k)); c.scale(zk, zk); key(c, K, 0, 0, 600, a, { hot: true }); c.restore();
  label(c, K, 46, 800); p.label.forEach((l, i) => text(c, l, 560, 840 + i * 52, { fill: P.gold, alpha: E.out3(prog(t, p.t0 + 0.15, 0.3)), glow: P.glow, glowBlur: 20 }));
  const f = 1 - prog(t, p.t0, m.flashSeconds); if (f > 0) { c.fillStyle = `rgba(255,240,230,${f * 0.6})`; c.fillRect(0, 0, W, H); }
}
/** a poster rendered once at half size: the blurred ground of every chapter card */
export function posterCache(K, p) {
  const big = document.createElement('canvas'); big.width = W; big.height = H; keysPoster(big.getContext('2d'), K, p, p.t0 + 3);
  const small = document.createElement('canvas'); small.width = 540; small.height = 960; small.getContext('2d').drawImage(big, 0, 0, 540, 960); return small;
}

/* ───────────── top-half panels (insert:split-top-panel holds one of these) ───────────── */
/** insert:split-top-panel: the crimson panel on the top half, dropping in. `inner` draws the panel's content. */
export function splitTopPanel(c, K, p, t, inner) {
  const pin = E.out5(prog(t, p.t0, K.motion.panelDrop.seconds));
  c.save(); c.translate(0, (pin - 1) * 960); ground(c, K, [0, 0, W, 960], [0.5, 0.35]);
  c.beginPath(); c.rect(0, 0, W, 960); c.clip(); inner(); c.restore();
  c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(0, 956, W, 8);
}
/** a small lit title (over / WORD / under) for the top of a panel */
export function panelTitle(c, K, p) {
  const P = K.pal; label(c, K, 54); text(c, p.over, W / 2, 140, { fill: P.warm, glow: P.pop, glowBlur: 18 });
  const g = c.createLinearGradient(0, 160, 0, 330); g.addColorStop(0, P.warm); g.addColorStop(1, P.accent);
  c.save(); c.translate(W / 2, 330); c.scale(0.82, 1); display(c, K, p.word, 0, 0, 640, 190, { fill: g, glow: P.pop, glowBlur: 40 }); c.restore();
  label(c, K, 36); text(c, p.under, W / 2, 385, { fill: P.warm });
}
/** ui:icon-chain. p = { items:[{icon, label, at}], y, size, title? } */
export function iconChain(c, K, p, t) {
  if (p.title) panelTitle(c, K, p.title);
  const n = p.items.length, gap = 900 / n, x0 = W / 2 - gap * (n - 1) / 2;
  p.items.forEach((it, i) => {
    const k = E.back(prog(t, it.at, 0.35)); if (k <= 0) return;
    const x = x0 + i * gap; c.save(); scaleAt(c, x, p.y, k); icon(c, K, it.icon, 0, 0, p.size); c.restore();
    if (it.label) { label(c, K, 30, 600); text(c, it.label, x, p.y + p.size * 0.95, { alpha: k }); }
    if (i) dashed(c, K, x - gap + p.size * 0.6, p.y, gap - p.size * 1.2, E.out3(prog(t, it.at - 0.2, 0.3)));
  });
}
/** ui:papers-drop. p = { t0, count } */
export function papersDrop(c, K, p, t) {
  [[-0.12, 330, 520], [0.06, 560, 470], [0.18, 760, 560]].slice(0, p.count ?? 3).forEach(([r, x, y], i) => {
    const k = E.out5(prog(t, p.t0 + i * 0.15, 0.4)); if (k <= 0) return;
    c.save(); c.translate(x, y + (1 - k) * -500); c.rotate(r); paper(c, 0, 0, 420, 560, i); c.restore();
  });
}
function paper(c, x, y, w, h, seed) {
  c.save(); c.shadowColor = 'rgba(0,0,0,0.45)'; c.shadowBlur = 30; c.shadowOffsetY = 14;
  c.fillStyle = '#eceae4'; c.fillRect(x - w / 2, y - h / 2, w, h); c.shadowColor = 'transparent';
  c.strokeStyle = 'rgba(40,40,60,0.55)'; c.lineWidth = 3;
  for (let i = 0; i < 16; i++) { c.beginPath(); const yy = y - h / 2 + 40 + i * 31; c.moveTo(x - w / 2 + 30, yy); for (let j = 0; j < 8; j++) c.lineTo(x - w / 2 + 30 + j * 45, yy + Math.sin(i * 3 + j * 2.3 + seed) * 6); c.stroke(); }
  c.restore();
}
/** ui:acronym-letters. p = { letters:'PURE', over:'The', under:'Framework', words:[{label, at}] } */
export function acronymLetters(c, K, p, t) {
  const P = K.pal; label(c, K, 40); text(c, p.over, W / 2, 150);
  const L = p.letters.split(''), gap = 640 / Math.max(1, L.length - 1);
  L.forEach((ch, i) => { const on = p.words[i] && t >= p.words[i].at - 0.05; c.font = face(K, 'display', 260); text(c, ch, 220 + i * gap, 450, { fill: on ? P.paper : P.warm, alpha: on ? 1 : 0.45, glow: on ? 'rgba(255,255,255,0.7)' : null, glowBlur: 30 }); });
  label(c, K, 40); text(c, p.under, W / 2, 520);
  p.words.forEach((w, i) => { if (t >= w.at) { label(c, K, 36); text(c, w.label, 210 + i * 220, 690, { alpha: E.out3(prog(t, w.at, 0.25)) }); } });
}
/** ui:typed-examples. p = { title, examples:[{label, at, lines:[{s, at, hi?}]}] } */
export function typedExamples(c, K, p, t) {
  const P = K.pal, sec = K.motion.type.secondsPerLine;
  display(c, K, p.title, W / 2, 190, 680, 120, { fill: P.gold, glow: P.glow, glowBlur: 30 });
  let y = 330;
  p.examples.forEach(ex => {
    if (t < ex.at) return;
    label(c, K, 34, 600); text(c, ex.label, 140, y, { align: 'left', alpha: E.out3(prog(t, ex.at, 0.3)) }); y += 65;
    ex.lines.forEach(l => { if (t >= l.at) { const n = Math.round(clamp((t - l.at) / sec) * l.s.length); label(c, K, 50); text(c, l.s.slice(0, n), 140, y, { align: 'left', fill: l.hi ? P.accent2 : P.paper }); } y += 60; });
    y += 60;
  });
}
/** ui:garden-metaphor. p = { t0, from, to, tool, infoAt } */
export function gardenMetaphor(c, K, p, t) {
  const P = K.pal; c.font = face(K, 'display', 64);
  const pk = P.warm;
  p.from.forEach((l, i) => text(c, l, 250, 400 + i * 70, { fill: pk })); p.to.forEach((l, i) => text(c, l, 830, 400 + i * 70, { fill: pk }));
  if (p.infoAt != null) { label(c, K, 34); text(c, 'Information', W / 2, 540, { alpha: E.out3(prog(t, p.infoAt, 0.3)) }); }
  c.save(); c.translate(720, 190); c.rotate(-0.5); can(c, K, 0, 0, 170, p.tool); c.restore();
  for (let i = 0; i < 6; i++) { const ph = (t * 1.6 + i / 6) % 1; c.fillStyle = P.lobe; c.globalAlpha = 0.9; c.beginPath(); c.ellipse(610 - ph * 40, 300 + ph * 260, 10, 16, 0, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1; }
  plant(c, 540, 940, E.out3(prog(t, p.t0 + 0.3, 2.6)));
}
function can(c, K, x, y, s, words) {
  c.save(); c.translate(x, y); const g = c.createLinearGradient(-s * 0.4, 0, s * 0.4, 0); g.addColorStop(0, '#2b3a50'); g.addColorStop(0.5, '#3d5270'); g.addColorStop(1, '#1a2333');
  c.fillStyle = g; c.beginPath(); c.roundRect(-s * 0.4, -s * 0.3, s * 0.8, s * 0.7, s * 0.1); c.fill();
  c.beginPath(); c.moveTo(-s * 0.35, 0); c.lineTo(-s * 0.9, s * 0.45); c.lineTo(-s * 0.82, s * 0.52); c.lineTo(-s * 0.3, s * 0.15); c.fill();
  c.strokeStyle = '#1e2a3a'; c.lineWidth = s * 0.08; c.beginPath(); c.arc(s * 0.1, -s * 0.3, s * 0.3, Math.PI, 0); c.stroke();
  c.fillStyle = '#e8e8e8'; c.font = `800 ${s * 0.12}px ${K.type.label.family}`; c.textAlign = 'center'; (words ?? []).forEach((w, i) => c.fillText(w, 0, s * (0.02 + i * 0.16)));
  c.restore();
}
function plant(c, x, y, g) {
  if (g <= 0) return;
  c.save(); c.translate(x, y);
  c.strokeStyle = '#2f7a2a'; c.lineWidth = 12; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(10, -130 * g, 0, -260 * g); c.stroke();
  const leaves = Math.floor(g * 8);
  for (let i = 0; i < leaves; i++) {
    const side = i % 2 ? 1 : -1, ly = -40 - i * 28 * g, len = 70 * g + 24;
    c.save(); c.translate(0, ly); c.rotate(side * 0.8);
    const lg = c.createLinearGradient(0, -20, side * len * 2, 20); lg.addColorStop(0, '#2e7f27'); lg.addColorStop(1, '#5cc24a'); c.fillStyle = lg;
    c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(side * len, -32, side * len * 2, 0); c.quadraticCurveTo(side * len, 32, 0, 0); c.fill();
    c.strokeStyle = 'rgba(20,60,20,0.5)'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, 0); c.lineTo(side * len * 1.8, 0); c.stroke(); c.restore();
  }
  c.restore();
}
/** ui:brain-callout. p = { t0, upAt, valueAt, small:'upto', value:'6 hours' } */
export function brainCallout(c, K, p, t) {
  const P = K.pal, k = E.out5(prog(t, p.t0, 0.5));
  c.save(); c.translate(500, 600 + (1 - k) * 260); brain(c, K, 0.95); c.restore();
  if (t < p.upAt) return;
  const d = E.out3(prog(t, p.upAt, 0.35)); c.strokeStyle = P.paper; c.lineWidth = 4;
  c.beginPath(); c.moveTo(430, 470); c.lineTo(430 + 320 * d, 470 - 100 * d); c.lineTo(430 + 520 * d, 470 - 100 * d); c.stroke();
  c.fillStyle = P.paper; c.beginPath(); c.arc(430, 470, 10, 0, 7); c.fill();
  label(c, K, 40, 600); text(c, p.small, 760, 300, { align: 'left', alpha: d });
  if (t >= p.valueAt) { label(c, K, 86, 800); text(c, p.value, 760, 360 + 30, { align: 'left', alpha: E.out3(prog(t, p.valueAt, 0.2)), glow: P.lobe, glowBlur: 18 }); }
}
function brain(c, K, s) {
  const P = K.pal; c.save(); c.scale(s, s);
  const hg = c.createLinearGradient(-200, 0, 260, 0); hg.addColorStop(0, '#0d0d0f'); hg.addColorStop(1, '#2a2a30');
  c.fillStyle = hg; c.beginPath(); c.moveTo(-210, 60); c.bezierCurveTo(-240, -260, 220, -300, 250, -40); c.bezierCurveTo(270, 60, 230, 130, 250, 200); c.lineTo(280, 260); c.lineTo(240, 280); c.lineTo(230, 380); c.lineTo(-120, 380); c.lineTo(-90, 200); c.closePath(); c.fill();
  c.save(); c.beginPath(); c.ellipse(10, -50, 200, 150, -0.08, 0, Math.PI * 2); c.clip();
  const gg = c.createRadialGradient(40, -80, 20, 10, -50, 220); gg.addColorStop(0, '#e2e2e8'); gg.addColorStop(1, '#9a9aa4'); c.fillStyle = gg; c.fillRect(-200, -210, 420, 320);
  const lg = c.createRadialGradient(-110, -60, 10, -110, -60, 200); lg.addColorStop(0, '#9cc0ff'); lg.addColorStop(0.6, P.lobe); lg.addColorStop(1, '#1d3cb0'); c.fillStyle = lg;
  c.beginPath(); c.moveTo(-210, -220); c.bezierCurveTo(0, -230, 30, 0, -20, 120); c.lineTo(-210, 120); c.fill();
  // gyri: wandering folds
  c.strokeStyle = 'rgba(30,30,50,0.45)'; c.lineWidth = 7; c.lineCap = 'round';
  let s0 = 3; const rnd = () => ((s0 = (s0 * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 26; i++) { let x = -190 + rnd() * 380, y = -190 + rnd() * 290; c.beginPath(); c.moveTo(x, y); for (let j = 0; j < 4; j++) { x += (rnd() - 0.5) * 90; y += (rnd() - 0.5) * 70; c.quadraticCurveTo(x + (rnd() - 0.5) * 40, y + (rnd() - 0.5) * 40, x, y); } c.stroke(); }
  c.restore();
  c.shadowColor = P.lobe; c.shadowBlur = 50; c.strokeStyle = 'rgba(110,150,255,0.35)'; c.lineWidth = 4; c.beginPath(); c.ellipse(-90, -60, 120, 140, 0, 0, Math.PI * 2); c.stroke();
  c.restore();
}
/** ui:product-bullets. p = { t0, brand, lines:['Memory','& Focus','mints'], bullets:[{s, at}] } */
export function productBullets(c, K, p, t) {
  const P = K.pal, k = E.back(prog(t, p.t0, 0.45));
  c.save(); c.translate(330, 500); c.scale(k, k); c.rotate(Math.sin(t * 1.2) * 0.03); pack(c, K, p, 380, 480); c.restore();
  p.bullets.forEach((b, i) => { if (t >= b.at) { label(c, K, 52); text(c, `- ${b.s}`, 590, 380 + i * 80, { align: 'left', fill: P.cool, alpha: E.out3(prog(t, b.at, 0.25)), glow: 'rgba(120,230,255,0.6)', glowBlur: 16 }); } });
}
function pack(c, K, p, w, h) {
  const P = K.pal; c.save(); c.shadowColor = 'rgba(0,0,0,0.5)'; c.shadowBlur = 40; c.shadowOffsetY = 18;
  const g = c.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2); g.addColorStop(0, '#e6f7fc'); g.addColorStop(1, '#a3d6e4');
  c.fillStyle = g; c.beginPath(); c.roundRect(-w / 2, -h / 2, w, h, 44); c.fill(); c.shadowColor = 'transparent';
  const sh = c.createLinearGradient(-w / 2, -h / 2, w / 2, -h / 4); sh.addColorStop(0, 'rgba(255,255,255,0.55)'); sh.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = sh; c.beginPath(); c.roundRect(-w / 2 + 10, -h / 2 + 10, w - 20, h * 0.4, 36); c.fill();
  c.fillStyle = '#1d4a5a'; c.textAlign = 'left'; c.font = `600 30px ${K.type.label.family}`; c.fillText(p.brand, -w / 2 + 40, -h / 2 + 80);
  c.font = `600 52px ${K.type.label.family}`; p.lines.forEach((l, i) => c.fillText(l, -w / 2 + 40, -h / 2 + 160 + i * 58));
  c.fillStyle = '#2ab0d0'; c.beginPath(); c.roundRect(-w / 2 + 40, h / 2 - 120, 220, 40, 20); c.fill();
  c.restore();
}

/* ───────────── camera ───────────── */
/** camera:jump-punch: the framing of the speaker at time t, given the cut times */
export function jumpPunch(cuts, t, o = { scales: [1.0, 1.14], offsets: [0, 30, -30], push: 0.02 }) {
  let i = 0; for (let j = 0; j < cuts.length; j++) if (cuts[j] <= t) i = j;
  const since = t - cuts[i];
  return { s: o.scales[i % o.scales.length] * (1 + o.push * E.out3(clamp(since / 2))), cx: o.offsets[i % o.offsets.length], since };
}

/** The components of this kit, by library asset id (the graph's `impl` points here). */
export const COMPONENTS = {
  'caption:chest-words': chestWords, 'caption:condensed-term': condensedTerm,
  'effect:connector-big-word': connectorBigWord, 'effect:word-behind-head': connectorBigWord, 'effect:glow-title-count': glowTitle,
  'effect:crimson-ground': ground, 'effect:comment-cta': commentCta, 'ui:fake-progress-timer': progressTimer,
  'insert:keys-poster': keysPoster, 'transition:key-chapter-card': keyChapterCard, 'insert:split-top-panel': splitTopPanel,
  'ui:icon-chain': iconChain, 'ui:papers-drop': papersDrop, 'ui:acronym-letters': acronymLetters, 'ui:typed-examples': typedExamples,
  'ui:garden-metaphor': gardenMetaphor, 'ui:brain-callout': brainCallout, 'ui:product-bullets': productBullets, 'camera:jump-punch': jumpPunch,
};
