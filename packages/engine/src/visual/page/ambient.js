// Ambient layers in plain 2D (CPU canvas): the backdrop, particles and light that sit behind a scene's elements. They
// are the cheap half of "depth": every layer has a depth, so a moving camera slides the near ones more than the far ones.
// A layer is { depth, draw(g, t, cam) } with `t` seconds since its scene began; all of them move from their first frame.
import { clamp01, col, ease, hash, mix, rgba, rng } from './util.js';

const sprite = (size, stops) => {
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d', { willReadFrequently: true }), r = size / 2, gr = g.createRadialGradient(r, r, 0, r, r, r);
  for (const [o, a] of stops) gr.addColorStop(o, a); g.fillStyle = gr; g.fillRect(0, 0, size, size); return c;
};
const cache = new Map();
const tinted = (hex, key) => {
  const id = `${hex}:${key}`;
  if (!cache.has(id)) cache.set(id, sprite(128, [[0, rgba(hex, 1)], [0.35, rgba(hex, 0.5)], [1, rgba(hex, 0)]]));
  return cache.get(id);
};

/** parallax: how far a layer at `depth` (0 = the film plane, negative = far) slides when the camera moves */
const par = (cam, depth) => { const f = 1400 / (1400 - depth) * 0.6, c = v => Math.max(-70, Math.min(70, v)); return { x: c(-cam.x * f), y: c(-cam.y * f) }; };

export const BG = {
  dots(P, box, seed) {
    const gap = box.W / 15, cols = 18, rows = 34;
    return { depth: -500, draw(g, t, cam) { const o = par(cam, -500), off = (t * 22) % gap; g.fillStyle = rgba(P.accent2, P.dark ? 0.5 : 0.42); for (let j = -3; j < rows + 2; j++) for (let i = -3; i < cols + 2; i++) { const x = i * gap + (j % 2 ? gap / 2 : 0) + off * 0.5 + o.x, y = j * gap + off + o.y, s = 3.5 + Math.sin(i * 0.6 + j * 0.4 + t * 1.2) * 1.6; g.fillRect(x - s / 2, y - s / 2, s, s); } } };
  },
  floor(P, box, seed) {
    return { depth: -400, draw(g, t, cam) {
      const hy = box.H * 0.42 + cam.y * 0.1, o = par(cam, -400).x; g.strokeStyle = rgba(P.accent2, P.dark ? 0.42 : 0.34); g.lineWidth = 2;
      g.beginPath(); for (let i = -14; i <= 14; i++) { g.moveTo(box.W / 2 + i * 38 + o * 0.3, hy); g.lineTo(box.W / 2 + i * box.W * 0.34 + o, box.H); } g.stroke();
      const f = (t * 0.45) % 1; for (let q = 0; q < 3; q++) { g.globalAlpha = 0.3 + q * 0.28; g.beginPath(); for (let i = q; i < 16; i += 3) { const k = (i + f) / 16, y = hy + (box.H - hy) * k * k; g.moveTo(0, y); g.lineTo(box.W, y); } g.stroke(); } g.globalAlpha = 1;
    } };
  },
  waves(P, box, seed) {
    return { depth: -500, draw(g, t, cam) { const o = par(cam, -500); g.lineWidth = 3; for (let i = 0; i < 5; i++) { g.strokeStyle = rgba(i % 2 ? P.accent2 : P.accent, 0.3); g.beginPath(); for (let k = 0; k <= 48; k++) { const x = (k / 48) * box.W * 1.1 - box.W * 0.05 + o.x, y = box.H * (0.18 + i * 0.13) + Math.sin(k * 0.22 + t * (0.8 + i * 0.15) + i) * box.H * 0.045 + Math.sin(k * 0.09 - t * 0.5) * box.H * 0.025 + o.y; k ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); } } };
  },
  blueprint(P, box, seed) {
    const gap = box.W / 9;
    return { depth: -500, draw(g, t, cam) {
      const o = par(cam, -500), off = (t * 16) % gap; g.strokeStyle = rgba(P.accent2, 0.26); g.lineWidth = 1.5; g.beginPath();
      for (let x = -2 * gap + off + o.x; x < box.W + 2 * gap; x += gap) { g.moveTo(x, 0); g.lineTo(x, box.H); } for (let y = -2 * gap + off + o.y; y < box.H + 2 * gap; y += gap) { g.moveTo(0, y); g.lineTo(box.W, y); } g.stroke();
      g.strokeStyle = rgba(P.accent, 0.24); g.lineWidth = 3; for (let i = 0; i < 2; i++) { g.beginPath(); g.arc(box.W / 2 + Math.sin(t * 0.3 + i) * 40, box.H * 0.34 + Math.cos(t * 0.25) * 30, box.W * (0.3 + i * 0.22), t * (0.2 - i * 0.4), t * (0.2 - i * 0.4) + Math.PI * 1.55); g.stroke(); }
    } };
  },
  blobs(P, box, seed) {
    const r = rng(seed), items = [0, 1, 2].map(i => ({ hex: [P.soft, P.accent2, P.card][i], x: r() * box.W, y: r() * box.H * 0.8, s: box.W * (0.6 + r() * 0.4), sp: 0.15 + r() * 0.3, ph: r() * 6 }));
    for (const b of items) tinted(b.hex, 'blob');
    return { depth: -700, draw(g, t, cam) { const o = par(cam, -700); for (const b of items) { g.globalAlpha = P.dark ? 0.34 : 0.5; const x = b.x + Math.sin(t * b.sp + b.ph) * box.W * 0.18 + o.x, y = b.y + Math.cos(t * b.sp * 0.9 + b.ph) * box.H * 0.1 + o.y; g.drawImage(tinted(b.hex, 'blob'), x - b.s / 2, y - b.s / 2, b.s, b.s); } g.globalAlpha = 1; } };
  },
};

export const FX = {
  galaxy(P, box, seed) {
    const r = rng(seed), N = 2600, R = box.W * 0.62, pts = [];
    for (let i = 0; i < N; i++) { const rad = (0.06 + Math.pow(r(), 0.7) * 0.94) * R, arm = Math.floor(r() * 3) * 2.094, th = arm + rad / R * 4.4 + (r() - 0.5) * 0.7; pts.push({ rad, th, y: (r() - 0.5) * R * 0.06, bucket: r() < 0.5 ? 0 : r() < 0.7 ? 1 : 2, s: 1.5 + r() * 2.4 }); }
    const colors = [P.soft, P.accent2, P.accent];
    return { depth: -900, draw(g, t, cam) {
      const o = par(cam, -900), cx = box.W / 2 + o.x, cy = box.H * 0.3 + o.y, tilt = 0.42, spin = t * 0.14;
      g.globalCompositeOperation = P.dark ? 'lighter' : 'source-over';
      for (let b = 0; b < 3; b++) { g.fillStyle = rgba(colors[b], P.dark ? 0.8 : 0.62); g.beginPath(); for (const p of pts) { if (p.bucket !== b) continue; const a = p.th + spin, x = cx + Math.cos(a) * p.rad, y = cy + Math.sin(a) * p.rad * tilt + p.y; g.rect(x, y, p.s, p.s); } g.fill(); }
      g.globalCompositeOperation = 'source-over';
    } };
  },
  confetti(P, box, seed) {
    const r = rng(seed), N = 64, parts = Array.from({ length: N }, () => ({ x: r() * box.W, y0: r(), sp: 0.1 + r() * 0.16, rot: r() * 6, rs: 1 + r() * 4, w: 10 + r() * 14, sway: r() * 6, c: r() }));
    const colors = [P.accent, P.accent2, P.soft, P.good, '#F5B73B'];
    return { depth: -300, draw(g, t, cam) { const o = par(cam, -300); for (const p of parts) { const f = (p.y0 + t * p.sp) % 1, x = p.x + Math.sin(t * 1.4 + p.sway) * 38 + o.x, y = -40 + f * (box.H + 80); g.save(); g.translate(x, y); g.rotate(p.rot + t * p.rs); g.scale(Math.cos(t * p.rs * 1.3 + p.sway), 1); g.fillStyle = colors[Math.floor(p.c * colors.length)]; g.fillRect(-p.w / 2, -p.w * 0.8, p.w, p.w * 1.6); g.restore(); } } };
  },
  bokeh(P, box, seed) {
    const r = rng(seed), items = Array.from({ length: 11 }, (_, i) => ({ hex: [P.soft, P.accent2, P.accent][i % 3], x: r() * box.W, y: r() * box.H, s: 90 + r() * 240, sp: 0.2 + r() * 0.5, ph: r() * 6.28, rad: 30 + r() * 110, a: 0.2 + r() * 0.25 }));
    for (const b of items) tinted(b.hex, 'bokeh');
    return { depth: -600, draw(g, t, cam) { const o = par(cam, -600); for (const b of items) { g.globalAlpha = b.a; const x = b.x + Math.cos(t * b.sp + b.ph) * b.rad + o.x, y = (b.y + Math.sin(t * b.sp * 0.8 + b.ph) * b.rad - t * 12 + box.H * 4) % (box.H + b.s) - b.s / 2 + o.y; g.drawImage(tinted(b.hex, 'bokeh'), x - b.s / 2, y - b.s / 2, b.s, b.s); } g.globalAlpha = 1; } };
  },
  rain(P, box, seed) {
    const r = rng(seed), lines = Array.from({ length: 48 }, () => ({ x: r() * box.W, y0: r(), len: 90 + r() * 240, sp: 0.35 + r() * 0.8, b: Math.floor(r() * 3) }));
    return { depth: -400, draw(g, t, cam) { const o = par(cam, -400); g.lineWidth = 3; g.strokeStyle = rgba(P.accent2, 1); for (let b = 0; b < 3; b++) { g.globalAlpha = 0.18 + b * 0.14; g.beginPath(); for (const l of lines) { if (l.b !== b) continue; const f = (l.y0 + t * l.sp * 0.5) % 1, y = -l.len + f * (box.H + l.len); g.moveTo(l.x + o.x, y + o.y); g.lineTo(l.x + o.x, y + l.len + o.y); } g.stroke(); } g.globalAlpha = 1; } };
  },
  aurora(P, box, seed) {
    const blobs = [[P.accent2, 0], [P.soft, 2.1]];
    for (const [hex] of blobs) tinted(hex, 'aurora');
    return { depth: -1000, draw(g, t, cam) { const o = par(cam, -1000); if (P.dark) g.globalCompositeOperation = 'lighter'; blobs.forEach(([hex, ph], i) => { g.globalAlpha = (P.dark ? 0.46 : 0.4) + Math.sin(t * 0.9 + ph) * 0.1; const w = box.W * 1.2, h = box.H * 0.5, x = box.W / 2 + Math.sin(t * 0.35 + ph) * box.W * 0.3 + o.x, y = box.H * (0.3 + i * 0.22) + Math.cos(t * 0.27 + ph * 1.3) * box.H * 0.1 + o.y; g.save(); g.translate(x, y); g.rotate(Math.sin(t * 0.2 + ph) * 0.4); g.drawImage(tinted(hex, 'aurora'), -w / 2, -h / 2, w, h); g.restore(); }); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; } };
  },
  spot(P, box, seed) {
    return { depth: -800, draw(g, t, cam) { const o = par(cam, -800), ang = Math.sin(t * 0.55) * 0.5, ox = box.W / 2 + Math.sin(t * 0.4) * box.W * 0.25 + o.x; g.save(); g.translate(ox, -box.H * 0.05); g.rotate(ang); const gr = g.createLinearGradient(0, 0, 0, box.H * 1.2); gr.addColorStop(0, rgba(P.dark ? P.soft : '#ffffff', 0.55)); gr.addColorStop(1, rgba(P.dark ? P.soft : '#ffffff', 0)); g.fillStyle = gr; g.globalCompositeOperation = P.dark ? 'lighter' : 'source-over'; g.beginPath(); g.moveTo(-box.W * 0.05, 0); g.lineTo(box.W * 0.05, 0); g.lineTo(box.W * 0.5, box.H * 1.2); g.lineTo(-box.W * 0.5, box.H * 1.2); g.closePath(); g.fill(); g.restore(); g.globalCompositeOperation = 'source-over'; } };
  },
  halo(P, box, seed) {
    return { depth: -700, draw(g, t, cam) { const o = par(cam, -700); g.lineWidth = 4; for (let i = 0; i < 3; i++) { const f = (t * 0.28 + i / 3) % 1; g.strokeStyle = rgba(P.accent2, 0.5 * (1 - f)); g.beginPath(); g.arc(box.W / 2 + o.x, box.H * 0.32 + o.y, box.W * (0.18 + f * 0.6), 0, Math.PI * 2); g.stroke(); } } };
  },
  sun(P, box, seed) {
    tinted('#F5B73B', 'sun'); tinted(P.accent2, 'sun2');
    return { depth: -900, draw(g, t, cam) { const o = par(cam, -900); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.5 + Math.sin(t * 1.1) * 0.08; const s = box.W * 1.1; g.drawImage(tinted('#F5B73B', 'sun'), box.W * 0.72 + Math.sin(t * 0.3) * box.W * 0.25 - s / 2 + o.x, box.H * 0.18 + Math.cos(t * 0.4) * 50 - s / 2 + o.y, s, s); g.globalAlpha = 0.35; const s2 = box.W * 0.7; g.drawImage(tinted(P.accent2, 'sun2'), box.W * 0.2 - Math.sin(t * 0.25) * box.W * 0.2 - s2 / 2 + o.x, box.H * 0.4 - s2 / 2 + o.y, s2, s2); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; } };
  },
};

export function ambientOf(id) {
  const [kind, name] = id.split(':');
  return kind === 'bg' ? BG[name] : kind === 'fx' || kind === 'glow' ? FX[name] : null;
}
