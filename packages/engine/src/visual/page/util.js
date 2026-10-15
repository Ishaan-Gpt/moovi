// Shared helpers for the visual page. Everything here is a pure function of its inputs: no clock, no Math.random.
import * as THREE from '/three/three.module.js';

/** mulberry32: the only source of "random" in the page, seeded per object */
export function rng(seed) {
  let a = (seed >>> 0) || 1;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const clamp01 = x => clamp(x, 0, 1);
export const lerp = (a, b, k) => a + (b - a) * k;
export const remap = (x, a, b) => clamp01((x - a) / (b - a));

/** easings, all 0..1 → 0..1 (outBack and outElastic overshoot) */
export const ease = {
  out3: x => 1 - Math.pow(1 - clamp01(x), 3),
  in3: x => Math.pow(clamp01(x), 3),
  inOut3: x => { x = clamp01(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; },
  inOut5: x => { x = clamp01(x); return x < 0.5 ? 16 * x ** 5 : 1 - Math.pow(-2 * x + 2, 5) / 2; },
  outBack: x => { x = clamp01(x); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
  outElastic: x => { x = clamp01(x); if (x === 0 || x === 1) return x; return Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * (2 * Math.PI) / 3) + 1; },
  out5: x => 1 - Math.pow(1 - clamp01(x), 5),
};

/** hex → THREE.Color, with a fallback */
export const col = (hex, fb = '#2B67C6') => new THREE.Color(hex || fb);
/** mix two hex colours (0 = a, 1 = b) into a css hex */
export function mix(a, b, k) {
  const A = new THREE.Color(a), B = new THREE.Color(b);
  return '#' + A.lerp(B, k).getHexString();
}
export const rgba = (hex, a) => { const c = new THREE.Color(hex); return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`; };

export const FONT = { ui: '"Inter Tight", system-ui, sans-serif', display: '"Anton", "Inter Tight", sans-serif', serif: '"Fraunces", Georgia, serif', mono: '"JetBrains Mono", ui-monospace, monospace' };

export function roundRect(g, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

/** shrink a font size until the text fits a width */
export function fitText(g, text, maxW, size, weight = 700, family = FONT.ui, min = 10) {
  let s = size;
  for (; s > min; s -= 2) { g.font = `${weight} ${s}px ${family}`; if (g.measureText(text).width <= maxW) break; }
  g.font = `${weight} ${s}px ${family}`;
  return s;
}

/** wrap text to a width: returns lines (at most `max`, the last one cut with an ellipsis) */
export function wrap(g, text, maxW, max = 4) {
  const words = text.split(/\s+/), lines = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (g.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  if (lines.length > max) { const keep = lines.slice(0, max); keep[max - 1] = keep[max - 1].replace(/\s*\S*$/, '') + '…'; return keep; }
  return lines;
}

/** a number as the screen shows it while it counts: 1200 → "1,200", 0.4 → "0.4", with a k/M suffix when big */
export function fmt(n, unit = '') {
  const a = Math.abs(n);
  let s;
  if (a >= 1e6) s = (n / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M';
  else if (a >= 1e4) s = Math.round(n / 1e3) + 'k';
  else if (Number.isInteger(n) || a >= 100) s = Math.round(n).toLocaleString('en-US');
  else s = n.toFixed(a < 10 ? 1 : 0).replace(/\.0$/, '');
  return s + unit;
}

/** a soft radial sprite texture (white centre → transparent), the building block of glows and bokeh */
let _dot = null;
export function dotTexture() {
  if (_dot) return _dot;
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  _dot = new THREE.CanvasTexture(c); return _dot;
}
export function discTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, '#fff'); gr.addColorStop(0.6, '#fff'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
