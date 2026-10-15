// The compositor. A film is a plan (scenes of elements, ambient depth, type); a frame is a pure function of its number:
// frame(n) → t = n / fps → paint the live scene(s) onto a CPU canvas → JPEG.
//
// Why 2D: without a GPU, WebGL fills a full-screen layer at ~60 MP/s (16 ms for one layer of a 720×1280 frame), and
// every pixel of a scene is several layers. A CPU canvas fills the same layer in ~1 ms and, being one process per page,
// scales across parallel pages. So depth is built the way a motion designer builds it in 2D: every layer has a z, the
// camera moves, near layers slide more than far ones, cards tilt and flip with a skew, shadows fall away behind them;
// and the objects that truly are 3D (crystal, gyroscope, globe, coin…) are three.js, rendered into one small offscreen
// canvas and placed like any other layer.
import * as THREE from '/three/three.module.js';
import { CARDS, CHARTS, browserChrome, callout, iconBadge, laptopBody, phoneBody, tabletBody } from './draw.js';
import { ambientOf } from './ambient.js';
import { objectOf } from './objects.js';
import { TRANSITION_S, cameraFx, enterFx, idleFx, transitionFx } from './motion.js';
import { FONT, clamp, clamp01, col, ease, hash, lerp, rgba, roundRect } from './util.js';

let S = null;
const AMB = 0.5;
const PROF = { paint: 0, enc: 0, n: 0 };
const now = () => performance.now();
const SECT = {};
window.__prof = () => ({ ...PROF, sections: SECT });
/** time a section (forces the canvas to flush so the number is real; only in profiling runs) */
const T = (label, f) => { if (!S.cfg.prof) return f(); const a = now(); const r = f(); S.main.g.getImageData(0, 0, 1, 1); S.A.g.getImageData(0, 0, 1, 1); const d = now() - a; const s = SECT[label] ?? (SECT[label] = { ms: 0, n: 0 }); s.ms += d; s.n++; return r; };

const loadImage = async url => { const img = new Image(); img.crossOrigin = 'anonymous'; img.src = url; try { await img.decode(); return img; } catch { return null; } };
const cpu = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(2, Math.ceil(w)); c.height = Math.max(2, Math.ceil(h)); return { c, g: c.getContext('2d', { willReadFrequently: true }) }; };

window.__init = async cfg => {
  const { plan, W, H, rw, rh } = cfg;
  for (const f of cfg.fonts) { try { const ff = new FontFace(f.family, `url(${f.url})`, { weight: f.weight, style: f.style ?? 'normal' }); await ff.load(); document.fonts.add(ff); } catch (e) { /* the fallback font draws */ } }
  const images = {};
  for (const url of cfg.images) images[url] = await loadImage(url);
  const main = cpu(rw, rh), A = cpu(rw, rh), B = cpu(rw, rh), thumb = cpu(24, 24);
  S = { cfg, plan, W, H, rw, rh, k: rw / W, P: { ...cfg.palette }, images, built: new Map(), main, A, B, thumb, Z0: (H / 2) / Math.tan(16 * Math.PI / 180), obj: null };
  // the backdrop every scene starts from: the film's colour as a soft vertical gradient, painted once
  // the ambient layers (backdrop, light, particles) are soft by nature, so they are painted at half size and upscaled once:
  // a quarter of the pixels to fill, which is what a frame costs when memory bandwidth is the limit
  const hw = Math.round(rw * AMB), hh = Math.round(rh * AMB);
  S.bg = cpu(hw, hh); const gr = S.bg.g.createLinearGradient(0, 0, 0, hh); gr.addColorStop(0, S.P.bg); gr.addColorStop(1, S.P.bg2); S.bg.g.fillStyle = gr; S.bg.g.fillRect(0, 0, hw, hh);
  S.amb = cpu(hw, hh);
  window.__ready = true;
  return { renderer: 'canvas2d + three.js objects' };
};

/* ───────── the offscreen 3D renderer for the few real 3D objects ───────── */
/**
 * The picture of the last render as a 2D canvas. Copying a WebGL canvas with drawImage is not reliable here (the first copy
 * in a page can show an earlier picture), so the pixels are read back, flipped and un-premultiplied: synchronous and exact.
 */
function objectPicture() {
  const o = objectRenderer(), n = o.size, gl = o.r.getContext();
  o.buf ??= new Uint8Array(n * n * 4); o.img ??= new ImageData(n, n); o.sc ??= cpu(n, n);
  gl.readPixels(0, 0, n, n, gl.RGBA, gl.UNSIGNED_BYTE, o.buf);
  const src = o.buf, dst = o.img.data;
  for (let y = 0; y < n; y++) { let s = (n - 1 - y) * n * 4, d = y * n * 4; for (let x = 0; x < n; x++, s += 4, d += 4) { const a = src[s + 3]; if (a === 255) { dst[d] = src[s]; dst[d + 1] = src[s + 1]; dst[d + 2] = src[s + 2]; } else if (a === 0) { dst[d] = dst[d + 1] = dst[d + 2] = 0; } else { const k = 255 / a; dst[d] = Math.min(255, src[s] * k); dst[d + 1] = Math.min(255, src[s + 1] * k); dst[d + 2] = Math.min(255, src[s + 2] * k); } dst[d + 3] = a; } }
  o.sc.g.putImageData(o.img, 0, 0);
  return o.sc.c;
}
function objectRenderer() {
  if (S.obj) return S.obj;
  const size = Math.round(Math.min(768, Math.max(320, S.rw * 0.62)));
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: false });
  r.setPixelRatio(1); r.setSize(size, size, false); r.setClearColor(0x000000, 0);
  document.body.appendChild(r.domElement);
  S.obj = { r, size }; return S.obj;
}

/* ───────── elements ───────── */
const ASPECT = {
  'card:stat': 1.15, 'card:list': 1.0, 'card:notif': 1.25, 'card:chat': 1.0, 'card:quote': 1.2, 'card:reviews': 1.4, 'card:chips': 2.2, 'card:toggles': 1.15, 'card:price': 0.92, 'card:timeline': 0.95,
  'chart:bars': 1.3, 'chart:line': 1.4, 'chart:donut': 1.0, 'chart:counter': 1.7, 'chart:versus': 1.2, 'chart:ring': 1.0,
  'device:phone': 0.5, 'device:laptop': 1.55, 'device:browser': 1.45, 'device:tablet': 1.35,
};
const fit = (rect, aspect) => { const w = Math.min(rect.w, rect.h * aspect); return { w, h: w / aspect }; };

const shadows = new Map();
/** a soft contact shadow, blurred once per size and reused */
function shadowSprite(w, h, r) {
  const key = `${Math.round(w / 8)}:${Math.round(h / 8)}`;
  if (shadows.has(key)) return shadows.get(key);
  const m = Math.max(24, Math.min(w, h) * 0.12), sp = cpu((w + 2 * m) * S.k, (h + 2 * m) * S.k);
  sp.g.scale(S.k, S.k); sp.g.filter = `blur(${Math.round(m * 0.45 * S.k)}px)`; sp.g.fillStyle = 'rgba(0,0,0,1)'; roundRect(sp.g, m, m, w, h, r); sp.g.fill();
  const out = { c: sp.c, m }; shadows.set(key, out); return out;
}

function makeElement(el, slot, A) {
  const P = S.P, art = A[el.art] ?? { kind: 'card' }, c = { ...el.content };
  if (c.image) c._img = S.images[c.image] ?? null;
  const seed = hash(`${el.art}:${el.slot}:${slot.id}`), name = el.art.split(':')[1];
  let size, draw = null, radius = 28, three = null, shadow = true;
  const kind = art.kind;
  if (kind === 'icon') {
    if (slot.job === 'label') { size = fit(slot.rect, 3.4); draw = (g, w, h, t) => callout(g, w, h, t, c, P, art.glyph); }
    else { const s = Math.min(slot.rect.w, slot.rect.h); size = { w: s, h: s }; draw = (g, w, h, t) => iconBadge(g, w, h, t, c, P, art.glyph); shadow = false; }
  } else if (kind === 'card') { size = fit(slot.rect, ASPECT[el.art] ?? 1.2); draw = (g, w, h, t) => CARDS[name](g, w, h, t, c, P); shadow = !['notif', 'chat', 'chips'].includes(name); }
  else if (kind === 'chart') { size = fit(slot.rect, ASPECT[el.art] ?? 1.2); draw = (g, w, h, t) => CHARTS[name](g, w, h, t, c, P); shadow = !['counter', 'ring'].includes(name); }
  else if (kind === 'device') {
    size = fit(slot.rect, ASPECT[el.art] ?? 1.4);
    if (name === 'browser') draw = (g, w, h, t) => { g.save(); roundRect(g, 0, 0, w, h, 22); g.clip(); browserChrome(g, w, h, t, c, P); g.restore(); g.lineWidth = 3; g.strokeStyle = P.hair; roundRect(g, 0, 0, w, h, 22); g.stroke(); };
    else if (name === 'phone') { draw = (g, w, h, t) => phoneBody(g, w, h, t, c, P); radius = size.w * 0.16; }
    else if (name === 'tablet') { draw = (g, w, h, t) => tabletBody(g, w, h, t, c, P); radius = size.w * 0.05; }
    else { draw = (g, w, h, t) => laptopBody(g, w, h, t, c, P); radius = 20; }
  } else if (kind === 'object3d') {
    const s = Math.min(slot.rect.w, slot.rect.h) * 1.12; size = { w: s, h: s }; shadow = false;
    const tex = c._img ? (() => { const t = new THREE.Texture(c._img); t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; return t; })() : null;
    const o = objectOf(el.art)(P, c, seed, tex), scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(28, 1, 0.1, 20);
    scene.add(o.group); scene.add(new THREE.HemisphereLight(0xffffff, col(P.dark ? '#33445F' : '#9bb8d4').getHex(), P.dark ? 1.15 : 1.6));
    const key = new THREE.DirectionalLight(0xffffff, P.dark ? 1.8 : 2.4); key.position.set(-2, 4, 5); scene.add(key);
    const rim = new THREE.PointLight(col(P.accent2).getHex(), 2.2, 20, 1.2); rim.position.set(3, -1, 2.5); scene.add(rim);
    cam.position.set(0, 0, 2.8); cam.lookAt(0, 0, 0);
    three = { scene, cam, update: o.update };
  }
  if (!size) size = { w: slot.rect.w, h: slot.rect.h };
  let cv = null;
  if (draw) { const ts = Math.max(0.5, Math.min(1.6, S.k * 1.3)); cv = cpu(size.w * ts, size.h * ts); cv.ts = ts; }
  const base = { x: slot.rect.x + slot.rect.w / 2 - S.W / 2, y: S.H / 2 - (slot.rect.y + slot.rect.h / 2), z: slot.z };
  return { el, slot, art, size, draw, cv, three, radius, shadow, base, lean: clamp(-(base.x / S.W) * 0.55, -0.24, 0.24), ph: (seed % 628) / 100, seed, cur: null };
}

function buildScene(i) {
  if (S.built.has(i)) return S.built.get(i);
  const vs = S.plan.scenes[i], box = { W: S.W, H: S.H };
  const ambient = vs.ambient.map(id => { const f = ambientOf(id); return f ? f(S.P, box, hash(`${i}:${id}`)) : null; }).filter(Boolean).sort((a, b) => a.depth - b.depth);
  const els = vs.elements.map(e => { const slot = vs.slots.find(s => s.id === e.slot); return slot ? makeElement(e, slot, S.cfg.art) : null; }).filter(Boolean).sort((a, b) => a.base.z - b.base.z);
  const main = els.find(e => e.slot.job === 'main') ?? els[0];
  const sc = { vs, ambient, els, main };
  S.built.set(i, sc);
  return sc;
}

/** an element's pose at time t: where its centre and corners land on the frame (format px), and how it is drawn */
function pose(e, vs, t, cam) {
  const local = t - vs.start, tl = local - e.el.at, en = enterFx(e.el.enter, tl, S.W, S.H), id = idleFx(e.el.idle, local, e.ph);
  if (tl <= 0 || en.a < 0.002) return null;
  const z = e.base.z + en.dz, f = cam.z / Math.max(200, cam.z - z), sc = f * en.s * id.s;
  const cx = S.W / 2 + (e.base.x + en.dx + id.dx - cam.x) * f, cy = S.H / 2 - (e.base.y + en.dy + id.dy - cam.y) * f;
  const ry = e.lean + en.ry + id.ry, rx = en.rx + id.rx, rz = en.rz + id.rz;
  // a pseudo-perspective matrix: a turn about the vertical axis narrows the card and slants it; a tilt about the horizontal does the same the other way
  const a = Math.cos(ry), b = Math.sin(ry) * 0.12, c = -Math.sin(rx) * 0.12, d = Math.cos(rx);
  return { cx, cy, sc, a, b, c, d, rz, alpha: en.a, tl, ok: Math.abs(a) > 0.04 && Math.abs(d) > 0.04 };
}

function boxOf(e, p) {
  const hw = e.size.w / 2, hh = e.size.h / 2, cr = Math.cos(p.rz), sr = Math.sin(p.rz), pts = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([x, y]) => {
    const x1 = (p.a * x + p.c * y) * p.sc, y1 = (p.b * x + p.d * y) * p.sc, x2 = x1 * cr + y1 * sr, y2 = -x1 * sr + y1 * cr; return [p.cx + x2, p.cy + y2];
  });
  return { x0: Math.min(...pts.map(q => q[0])), y0: Math.min(...pts.map(q => q[1])), x1: Math.max(...pts.map(q => q[0])), y1: Math.max(...pts.map(q => q[1])) };
}

function paintElement(g, e, p) {
  if (!p.ok) return;
  const { w, h } = e.size;
  g.save(); g.translate(p.cx, p.cy); g.rotate(-p.rz); g.transform(p.a * p.sc, p.b * p.sc, p.c * p.sc, p.d * p.sc, 0, 0); g.globalAlpha = p.alpha;
  if (e.shadow) { const s = shadowSprite(w, h, e.radius); g.globalAlpha = p.alpha * (S.P.dark ? 0.55 : 0.24); g.drawImage(s.c, -w / 2 - s.m, -h / 2 - s.m + h * 0.05, w + 2 * s.m, h + 2 * s.m); g.globalAlpha = p.alpha; }
  if (e.draw) {
    // every draw starts from the default canvas state (text alignment, baseline, line widths…): a frame must not depend on the one before
    const cv = e.cv; cv.g.save(); cv.g.setTransform(1, 0, 0, 1, 0, 0); cv.g.clearRect(0, 0, cv.c.width, cv.c.height); cv.g.setTransform(cv.c.width / w, 0, 0, cv.c.height / h, 0, 0);
    e.draw(cv.g, w, h, Math.max(0, p.tl)); cv.g.restore();
    g.imageSmoothingQuality = 'medium'; g.drawImage(cv.c, -w / 2, -h / 2, w, h);
  } else if (e.three) {
    const o = objectRenderer(); e.three.update(Math.max(0, p.tl));
    o.r.render(e.three.scene, e.three.cam);
    g.drawImage(objectPicture(), -w / 2, -h / 2, w, h);
  }
  g.restore();
}

/* ───────── type and callouts ───────── */
function drawType(g, sc, local) {
  const vs = sc.vs, P = S.P, band = S.cfg.bands.caption;
  if (!vs.type.length) return;
  const pages = [...new Set(vs.type.map(l => l.page))];
  const startOf = p => Math.min(...vs.type.filter(l => l.page === p).flatMap(l => l.at));
  let page = pages[0];
  for (const p of pages) if (local >= startOf(p) - 0.02) page = p;
  const lines = vs.type.filter(l => l.page === page);
  const next = pages.find(p => p > page), outT = next !== undefined ? startOf(next) : Infinity, first = startOf(page);
  const fade = clamp01((outT - local) / 0.22 + 0.001);
  g.save();
  const bw = band.w, maxSize = Math.min(band.h / (lines.length * 1.12 + 0.2), S.W * 0.115);
  let size = maxSize;
  for (const l of lines) { g.font = `800 ${size}px ${FONT.ui}`; while (g.measureText(l.text).width > bw && size > 24) { size -= 2; g.font = `800 ${size}px ${FONT.ui}`; } }
  const lh = size * 1.1, y0 = band.y + (band.h - lines.length * lh) / 2 + lh * 0.82;
  // a soft scrim behind the words so whatever is behind them never fights them
  const sa = ease.out3((local - first + 0.1) / 0.3) * (P.dark ? 0.55 : 0.62) * fade;
  if (sa > 0.01) { const gr = g.createLinearGradient(0, band.y - band.h * 0.15, 0, band.y + band.h * 1.1); gr.addColorStop(0, rgba(P.bg, 0)); gr.addColorStop(0.2, rgba(P.bg, sa)); gr.addColorStop(0.8, rgba(P.bg, sa)); gr.addColorStop(1, rgba(P.bg, 0)); g.fillStyle = gr; g.fillRect(0, band.y - band.h * 0.15, S.W, band.h * 1.3); }
  lines.forEach((l, li) => {
    const words = l.text.split(' ');
    const widths = words.map((w, wi) => { g.font = wi === l.em ? `italic 700 ${size * 1.04}px ${FONT.serif}` : `800 ${size}px ${FONT.ui}`; return g.measureText(w).width; });
    const space = size * 0.26, total = widths.reduce((a, b) => a + b, 0) + space * (words.length - 1);
    let x = S.W / 2 - total / 2;
    words.forEach((w, wi) => {
      const t = local - l.at[wi], isEm = wi === l.em;
      if (t >= 0) {
        let dx = 0, dy = 0, sc2 = 1; const a = clamp01(t / 0.12), e = clamp01(t / 0.45);
        if (l.style === 'slam') { sc2 = lerp(1.7, 1, ease.outBack(e)); dy = Math.sin(t * 40) * (1 - e) * 6; }
        else if (l.style === 'rise') dy = (1 - ease.out5(e)) * size * 0.7;
        else if (l.style === 'slide') dx = -(1 - ease.out5(e)) * size * 1.4;
        else sc2 = ease.outElastic(e);
        // landed words keep moving: a slow float, and the accent word breathes
        dy += Math.sin(t * 1.6 + wi * 0.9 + li) * size * 0.018; if (isEm) sc2 *= 1 + Math.sin(t * 2.6) * 0.02;
        g.save(); g.globalAlpha = a * fade; g.translate(x + widths[wi] / 2 + dx, y0 + li * lh + dy); g.scale(sc2, sc2);
        g.font = isEm ? `italic 700 ${size * 1.04}px ${FONT.serif}` : `800 ${size}px ${FONT.ui}`; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
        g.lineJoin = 'round'; g.lineWidth = size * 0.16; g.strokeStyle = rgba(P.bg, 0.9); g.strokeText(w, 0, 0);
        g.fillStyle = isEm ? P.accent : P.ink; g.fillText(w, 0, 0); g.restore();
      }
      x += widths[wi] + space;
    });
  });
  g.restore();
}

function drawLeaders(g, sc, local) {
  const labels = sc.els.filter(e => e.slot.job === 'label' && e.cur), main = sc.main; if (!labels.length || !main?.cur) return;
  const P = S.P;
  g.save();
  for (const l of labels) {
    const t = local - l.el.at - 0.25; if (t <= 0) continue;
    const left = l.cur.cx < main.cur.cx, a = { x: l.cur.cx + (left ? 1 : -1) * l.size.w * 0.3 * l.cur.sc, y: l.cur.cy }, b = { x: main.cur.cx + (left ? -1 : 1) * main.size.w * 0.16 * main.cur.sc, y: main.cur.cy + (l.cur.cy > main.cur.cy ? 1 : -1) * main.size.h * 0.1 * main.cur.sc };
    const f = ease.out5(t / 0.5);
    g.strokeStyle = P.accent; g.lineWidth = 4; g.lineCap = 'round'; g.setLineDash([14, 10]); g.lineDashOffset = -local * 30; g.globalAlpha = 0.85;
    g.beginPath(); g.moveTo(a.x, a.y); g.quadraticCurveTo(lerp(a.x, b.x, 0.5), a.y, lerp(a.x, b.x, f), lerp(a.y, b.y, f)); g.stroke(); g.setLineDash([]);
    if (f > 0.95) { g.beginPath(); g.arc(b.x, b.y, 11 + Math.sin(local * 5) * 2, 0, Math.PI * 2); g.fillStyle = P.accent; g.fill(); g.lineWidth = 4; g.strokeStyle = P.card; g.stroke(); }
    g.globalAlpha = 1;
  }
  g.restore();
}

/* ───────── a scene, a transition, a frame ───────── */
function paintScene(cv, i, t) {
  const sc = buildScene(i), vs = sc.vs, local = t - vs.start, g = cv.g, k = S.k;
  g.save();
  const cam = cameraFx(vs.camera, local, vs.end - vs.start + TRANSITION_S, S.W, S.H, S.Z0);
  const ag = S.amb.g; ag.setTransform(1, 0, 0, 1, 0, 0); ag.globalAlpha = 1; ag.drawImage(S.bg.c, 0, 0); ag.setTransform(k * AMB, 0, 0, k * AMB, 0, 0);
  sc.ambient.forEach((a, j) => T('ambient:' + vs.ambient[j], () => { ag.save(); a.draw(ag, local, cam); ag.restore(); }));
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'low'; g.drawImage(S.amb.c, 0, 0, S.rw, S.rh);
  g.setTransform(k, 0, 0, k, 0, 0);
  for (const e of sc.els) { const p = pose(e, vs, t, cam); e.cur = p; if (p) T('el:' + e.el.art, () => paintElement(g, e, p)); }
  T('leaders+type', () => { drawLeaders(g, sc, local); drawType(g, sc, local); });
  g.restore();
  return sc;
}

function compose(n) {
  const t = n / S.plan.fps, scenes = S.plan.scenes, g = S.main.g;
  let cur = 0; for (let i = 0; i < scenes.length; i++) if (t >= scenes[i].start - 1e-6) cur = i;
  const vs = scenes[cur], p = vs.transition ? (t - vs.start) / TRANSITION_S : 1;
  if (cur > 0 && p < 1) {
    // two scenes handing over: each is painted on its own and the two images are slid, scaled and smeared over each other
    const f = transitionFx(vs.transition, clamp01(p), S.W, S.H), k = S.k;
    paintScene(S.A, cur - 1, t); paintScene(S.B, cur, t);
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.drawImage(S.bg.c, 0, 0, S.rw, S.rh);
    const lay = (cv, x, blurScale) => {
      const taps = Math.abs(f.blur.x) + Math.abs(f.blur.y) > 6 ? 5 : 1;
      for (let q = 0; q < taps; q++) {
        const u = taps === 1 ? 0 : (q / (taps - 1) - 0.5) * blurScale;
        g.save(); g.globalAlpha = x.a * (taps === 1 ? 1 : (q === 0 ? 1 : 1 / (q + 1)));
        g.translate(S.rw / 2 + (x.dx + f.blur.x * u) * k, S.rh / 2 + (x.dy + f.blur.y * u) * k); g.scale(x.s, x.s); g.translate(-S.rw / 2, -S.rh / 2);
        g.drawImage(cv.c, 0, 0); g.restore();
      }
    };
    lay(S.A, f.out, 0.6); lay(S.B, f.inn, 1);
    g.globalAlpha = 1;
  } else { paintScene(S.main, cur, t); }
}

window.__frame = (n, fmt) => {
  const a = now(); compose(n); if (S.cfg.prof) S.main.g.getImageData(0, 0, 1, 1); const b = now();
  const out = fmt === 'png' ? S.main.c.toDataURL('image/png').slice(22) : S.main.c.toDataURL('image/jpeg', 0.92).slice(23);
  PROF.paint += b - a; PROF.enc += now() - b; PROF.n++; return out;
};

/** a tiny grayscale picture of frame n (for the audits: motion, emptiness) */
window.__thumb = n => {
  compose(n);
  const w = 24, h = Math.max(12, Math.round(24 * S.rh / S.rw)); S.thumb.c.width = w; S.thumb.c.height = h;
  const g = S.thumb.g; g.drawImage(S.main.c, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h).data, out = [];
  for (let i = 0; i < d.length; i += 4) out.push(Math.round(0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]));
  return { w, h, px: out };
};

/** the frame-space boxes of every element of the live scene at frame n (for the layout audit) */
window.__boxes = n => {
  const t = n / S.plan.fps, scenes = S.plan.scenes; let cur = 0; for (let i = 0; i < scenes.length; i++) if (t >= scenes[i].start - 1e-6) cur = i;
  const sc = buildScene(cur), vs = sc.vs, cam = cameraFx(vs.camera, t - vs.start, vs.end - vs.start + TRANSITION_S, S.W, S.H, S.Z0), out = [];
  for (const e of sc.els) { const p = pose(e, vs, t, cam); if (!p) continue; out.push({ art: e.el.art, job: e.slot.job, ...boxOf(e, p) }); }
  return out;
};

/**
 * Render frames [from, to) and POST each straight to the local server as a JPEG/PNG file. The browser encodes in the
 * background (canvas.toBlob snapshots the canvas at once and encodes off the main thread) while the next frame paints,
 * and nothing goes through the devtools connection, so parallel pages do not queue behind one another.
 */
window.__range = async (from, to, fmt, sink) => {
  const pending = new Set(), type = fmt === 'png' ? 'image/png' : 'image/jpeg', ext = fmt === 'png' ? 'png' : 'jpg';
  let failed = null;
  for (let n = from; n < to; n++) {
    const a = now(); compose(n); PROF.paint += now() - a; PROF.n++;
    const name = 'f' + String(n).padStart(5, '0') + '.' + ext;
    const job = new Promise(res => S.main.c.toBlob(b => res(b), type, 0.92)).then(b => fetch(sink + '?name=' + name, { method: 'POST', body: b })).then(r => { if (!r.ok) failed = 'could not store ' + name; }).catch(e => { failed = String(e); }).finally(() => pending.delete(job));
    pending.add(job);
    if (pending.size >= 3) await Promise.race(pending);
    if (failed) throw new Error(failed);
  }
  await Promise.all(pending);
  if (failed) throw new Error(failed);
  return to - from;
};
