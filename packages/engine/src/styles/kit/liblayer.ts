/**
 * The library layer: the browser half of ./borrow.ts. One classic script, added to a live player's page, that plays
 * the film's library inserts (<film dir>/library.json) with the visual renderer's own 2D drawing code
 * (visual/page/util.js + clips.js + draw.js, bundled here without their module syntax; three.js only lent its Color,
 * a few lines below). No library.json = the script does nothing.
 *
 * Each insert is a canvas inside the player's camera layer (#cam), so it rides the style's push and grade. Its motion
 * is a pure function of the audio time (ishaan-motion): it is already moving when it lands on the beat's first word
 * (rises 60 px, scale 0.9 → 1 with a small overshoot, blur 16 → 0 px, a tilt that settles), drifts 2.5 % bigger while
 * it holds, and lifts away blurred in the last 0.32 s before the cut. The card's own content (a number counting, a
 * list ticking) runs on the same clock.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO } from '../../config';

const PAGE_DIR = () => join(REPO, 'packages', 'engine', 'src', 'visual', 'page');
const strip = (src: string) => src.replace(/^import[^\n]*\n/gm, '').replace(/^export (?=(const|function|let|class|async) )/gm, '');

/** three.js's Color as far as util.js uses it (hex in, lerp, getHexString, r/g/b) */
const COLOR_SHIM = `const THREE = { Color: class { constructor(h) { if (h && typeof h === 'object') { this.r = h.r; this.g = h.g; this.b = h.b; return; } const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(h || '#000').trim()); let s = m ? m[1] : '000'; if (s.length === 3) s = s.split('').map(c => c + c).join(''); const n = parseInt(s, 16); this.r = (n >> 16 & 255) / 255; this.g = (n >> 8 & 255) / 255; this.b = (n & 255) / 255; }
  lerp(c, k) { this.r += (c.r - this.r) * k; this.g += (c.g - this.g) * k; this.b += (c.b - this.b) * k; return this; }
  getHexString() { return [this.r, this.g, this.b].map(v => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0')).join(''); } } };`;

const RUNTIME = `
const ART = { CARDS, CHARTS, iconBadge, FONT, mix, rgba };
const bez = (x1, y1, x2, y2) => t => { if (t <= 0) return 0; if (t >= 1) return 1; let u = t; for (let i = 0; i < 8; i++) { const x = 3 * x1 * u * (1 - u) ** 2 + 3 * x2 * u * u * (1 - u) + u ** 3 - t, d = 3 * x1 * (1 - u) ** 2 + 6 * (x2 - x1) * u * (1 - u) + 3 * (1 - x2) * u * u; if (Math.abs(d) < 1e-6) break; u = Math.max(0, Math.min(1, u - x / d)); } return 3 * y1 * u * (1 - u) ** 2 + 3 * y2 * u * u * (1 - u) + u ** 3; };
const OUT = bez(0.16, 1, 0.3, 1), BACK = bez(0.34, 1.32, 0.64, 1), IN = bez(0.7, 0, 0.84, 0);
const c01 = x => Math.max(0, Math.min(1, x));
function paletteOf(j) {
  const cs = getComputedStyle(document.getElementById('stage')), v = k => cs.getPropertyValue(k).trim();
  const p = j.palette || {}, ink = p.ink || v('--ink') || '#1B2230', card = p.card || v('--paper') || '#FFFFFF', accent = p.accent || v('--edge') || v('--top') || '#2B67C6';
  return { bg: card, bg2: card, ink, card, accent, accent2: p.accent2 || accent, soft: p.soft || mix(card, accent, 0.18), muted: p.muted || mix(ink, card, 0.45), hair: p.hair || mix(ink, card, 0.84), onAccent: p.onAccent || card, good: accent, warn: accent, dark: !!p.dark };
}
function boot(j) {
  const cam = document.getElementById('cam'), a = document.getElementById('a'); if (!cam || !a) return;
  if (j.font) Object.assign(FONT, j.font);
  const P = paletteOf(j), W = 1080, H = 1920, M = 76;
  const items = j.inserts.map(x => {
    const w = x.kind === 'icon' ? 300 : x.aspect >= 1.35 ? 620 : x.aspect >= 1.05 ? 540 : 460, h = Math.round(w / x.aspect);
    const el = document.createElement('canvas'); el.width = W; el.height = H; el.className = 'libins';
    el.style.cssText = 'position:absolute;left:0;top:0;width:1080px;height:1920px;pointer-events:none;z-index:9;display:none';
    cam.appendChild(el);
    const off = document.createElement('canvas'); off.width = w; off.height = h;
    return { x, w, h, cx: 0, cy: 0, placed: false, el, g: el.getContext('2d'), off, og: off.getContext('2d') };
  });
  // where the insert goes: of six phone-safe slots, the one the beat's type (weight 3) and pictures (weight 1) cover
  // least, measured over the beat (letters still hidden already hold their place;
  // the other beats are display:none, so they have no boxes); the engine's room / side hint breaks ties
  function measure(obs) {
    const sr = document.getElementById('stage').getBoundingClientRect(), k = sr.width / W;
    const box = (r, wt, max = 0.5) => { const x0 = (r.left - sr.left) / k, y0 = (r.top - sr.top) / k, x1 = (r.right - sr.left) / k, y1 = (r.bottom - sr.top) / k; if (x1 - x0 >= 4 && y1 - y0 >= 4 && (x1 - x0) * (y1 - y0) <= W * H * max) obs.push([x0, y0, x1, y1, wt]); };
    // type: the glyphs themselves (a range per text node: a label in a zero-width box still has its letters' boxes)
    const tw = document.createTreeWalker(cam, NodeFilter.SHOW_TEXT), rg = document.createRange();
    for (let n = tw.nextNode(); n; n = tw.nextNode()) { if (!n.textContent.trim()) continue; rg.selectNodeContents(n); for (const r of rg.getClientRects()) box(r, 3, 1); }
    // pictures and painted panels (a backdrop bigger than half the frame is the set, not an obstacle)
    for (const e of cam.querySelectorAll('*')) {
      if (e.classList.contains('libins') || (!(e instanceof HTMLElement) && e.tagName.toLowerCase() !== 'svg') || e.closest('svg') !== null && e.tagName.toLowerCase() !== 'svg' || !e.getClientRects().length) continue; // an svg is one picture, its paths are not panels
      const cs = getComputedStyle(e), painted = cs.backgroundImage !== 'none' || !/rgba\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor);
      if (/^(IMG|CANVAS|SVG)$/i.test(e.tagName) || e.classList.contains('pic') || painted) box(e.getBoundingClientRect(), 1);
    }
  }
  function place(it, now) {
    // the whole beat, not just its first frame: type and pictures that arrive later in the beat count too. A player
    // that exposes its renderer (window.__render) is laid out at the insert's arrival, middle and exit, then put back.
    const obs = [], R = window.__render, at = it.x.at, end = it.x.end, ts = R ? [at + 0.3, (at + end) / 2, end - 0.15] : [now];
    for (const t of ts) { if (R) R(t); measure(obs); }
    if (R) R(now);
    // slots: three columns × five rows inside the phone-safe frame, at full size or 80 %. Type is a hard obstacle
    // (never covered); pictures and painted panels are soft (at most 35 % of the insert may sit over them). Cover is
    // the share of a 16 × 16 grid of points over the slot that falls on an obstacle at any of the measured moments.
    const hardR = obs.filter(o => o[4] === 3), softR = obs.filter(o => o[4] !== 3), inAny = (rs, x, y) => rs.some(([a, b, c, d]) => x >= a && x <= c && y >= b && y <= d);
    let best = null;
    for (const z of [1, 0.8]) {
      const w = it.w * 1.06 * z, h = it.h * 1.06 * z, x0 = M + w / 2, x1 = W - M - w / 2, y0 = 170 + h / 2, y1 = H - 250 - h / 2;
      for (const fx of [0, 0.5, 1]) for (const fy of [0, 0.25, 0.5, 0.75, 1]) {
        const cx = x0 + (x1 - x0) * fx, cy = y0 + (y1 - y0) * fy;
        let hard = 0, soft = 0;
        for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) { const x = cx - w / 2 + (i + 0.5) * w / 16, y = cy - h / 2 + (j + 0.5) * h / 16; if (inAny(hardR, x, y)) hard++; else if (inAny(softR, x, y)) soft++; }
        hard /= 256; soft /= 256;
        if (hard > 0 || soft > 0.35) continue;
        // prefer: less over pictures, full size, the engine's side / room hint, the frame's edges over its middle
        const cost = soft + (z === 1 ? 0 : 0.06) + ((fx === 0 ? 'left' : fx === 1 ? 'right' : '') === it.x.side ? 0 : 0.02) + (fy === 0.5 ? 0.05 : 0) + ((it.x.room === 'top') === (fy < 0.5) ? 0 : 0.03);
        if (!best || cost < best.cost) best = { cost, cx, cy, z, soft };
      }
    }
    it.placed = true; it.obs = obs.length; it.off_ = false;
    if (best) { it.mode = 'overlay'; it.cx = best.cx; it.cy = best.cy; it.z = best.z; it.cover = +best.soft.toFixed(3); it.fa = at; it.fb = end; return; }
    // no clear room anywhere on this beat (a composition that fills the frame): a rack-focus cutaway instead. In the
    // middle of the beat the style's frame racks out of focus and dims, the piece comes forward in the centre, then the
    // frame racks back; the beat's start and end stay the style's own. Never on top of its sharp type.
    it.mode = 'focus'; it.cx = W / 2; it.cy = H * 0.47; it.z = Math.min(it.x.art === 'card:chips' ? 1.7 : 1.4, 900 / it.w); it.cover = null;
    it.fa = at + (end - at) * 0.3; it.fb = at + (end - at) * 0.84;
    document.getElementById('stage').insertBefore(it.el, document.getElementById('grain'));
  }
  window.__libMeasure = () => { const o = []; measure(o); return o; };
  window.__libPlaces = () => items.map(i => ({ art: i.x.art, at: i.x.at, cx: Math.round(i.cx), cy: Math.round(i.cy), cover: i.cover, z: i.z, obs: i.obs, mode: i.mode, window: i.fa ? [+i.fa.toFixed(2), +i.fb.toFixed(2)] : null, shown: i.placed ? !i.off_ : null }));
  const baseFilter = cam.style.filter || '';
  let racked = false;
  function frame(t) {
    let focus = 0;
    for (const it of items) {
      const x = it.x;
      if (t < x.at - 0.02 || t > x.end) { if (it.el.style.display !== 'none') it.el.style.display = 'none'; continue; }
      if (!it.placed) { if (!window.__ready) continue; place(it, t); } // the player builds its beats first
      const u = t - it.fa, life = it.fb - it.fa;
      if (u < -0.02 || u > life) { if (it.el.style.display !== 'none') it.el.style.display = 'none'; continue; }
      if (it.el.style.display !== 'block') it.el.style.display = 'block';
      if (it.mode === 'focus') focus = Math.max(focus, OUT(c01(u / 0.45)) * (1 - IN(c01((u - (life - 0.4)) / 0.4))));
      const k = c01(u / 0.5), out = c01((u - (life - 0.32)) / 0.32);
      const s = (0.9 + 0.1 * BACK(k)) * (1 + 0.025 * c01(u / life)) * (1 - 0.04 * IN(out));
      const dy = 60 * (1 - OUT(k)) - 34 * IN(out), rot = (x.tilt * (it.mode === 'focus' ? 0.4 : 1) + 4 * (1 - OUT(c01(u / 0.8)))) * Math.PI / 180;
      const blur = 16 * (1 - OUT(c01(u / 0.35))) + 12 * IN(out), alpha = c01(u / 0.18) * (1 - IN(out));
      const og = it.og; og.setTransform(1, 0, 0, 1, 0, 0); og.clearRect(0, 0, it.w, it.h);
      const cu = Math.max(0, u - 0.12);
      try { if (x.kind === 'icon') iconBadge(og, it.w, it.h, cu, x.content || {}, P, x.glyph || 'star'); else if (x.kind === 'chart') CHARTS[x.art.split(':')[1]](og, it.w, it.h, cu, x.content || {}, P); else CARDS[x.art.split(':')[1]](og, it.w, it.h, cu, x.content || {}, P); } catch (e) { console.warn('library insert', x.art, e); }
      const g = it.g; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H);
      g.save(); g.globalAlpha = alpha; g.translate(it.cx, it.cy + dy); g.rotate(rot); g.scale(s * (it.z || 1), s * (it.z || 1));
      g.filter = blur > 0.3 ? 'blur(' + blur.toFixed(1) + 'px)' : 'none';
      g.shadowColor = rgba(P.ink, 0.34 * alpha); g.shadowBlur = 46; g.shadowOffsetY = 26;
      g.drawImage(it.off, -it.w / 2, -it.h / 2); g.restore();
    }
    // the rack: the camera layer (the style's whole frame) defocuses and dims under a cutaway, then comes back sharp
    if (focus > 0.002) { cam.style.filter = (baseFilter + ' blur(' + (11 * focus).toFixed(2) + 'px) brightness(' + (1 - 0.2 * focus).toFixed(3) + ')').trim(); racked = true; }
    else if (racked) { cam.style.filter = baseFilter; racked = false; }
  }
  // the arrival sound (library.json "sound": the graph's pop, beside the film), only for an insert that really lands,
  // only while playing, never on a seek past it
  let ac = null, buf = null, prevT = -1;
  if (j.sound) fetch(j.sound.file).then(r => (r.ok ? r.arrayBuffer() : null)).then(b => { if (!b) return; ac = new (window.AudioContext || window.webkitAudioContext)(); return ac.decodeAudioData(b).then(d => { buf = d; }); }).catch(() => {});
  function sound(t) {
    if (buf && !a.paused && t >= prevT && t - prevT < 0.25) for (const it of items) {
      const hit = (it.fa ?? it.x.at) + 0.04;
      if (prevT < hit && hit <= t && it.placed && !it.off_) { if (ac.state === 'suspended') ac.resume(); const s = ac.createBufferSource(), gn = ac.createGain(); gn.gain.value = j.sound.gain ?? 0.4; s.buffer = buf; s.connect(gn).connect(ac.destination); s.start(); }
    }
    prevT = t;
  }
  window.__libFrame = frame;
  // a still (?t=, the contact sheets) holds that time; otherwise the audio is the clock
  const q = new URLSearchParams(location.search), still = q.has('t') ? Number(q.get('t')) : null;
  (function loop() { const t = still ?? a.currentTime; frame(t); if (still === null) sound(t); requestAnimationFrame(loop); })();
}
// ?nolib: the same film without its inserts (the A/B's "before")
if (!new URLSearchParams(location.search).has('nolib')) fetch('/v/library.json').then(r => (r.ok ? r.json() : null)).then(j => { if (j && j.inserts && j.inserts.length) boot(j); }).catch(() => {});
`;

let cached: string | null = null;
/** The script (cached once per process): the visual page's 2D code + the insert runtime, in one IIFE. */
export function libLayer(): string {
  if (cached) return cached;
  const src = ['util.js', 'clips.js', 'draw.js'].map(f => strip(readFileSync(join(PAGE_DIR(), f), 'utf8'))).join('\n');
  cached = `(function () {\n${COLOR_SHIM}\n${src}\n${RUNTIME}\n})();`;
  return cached;
}
