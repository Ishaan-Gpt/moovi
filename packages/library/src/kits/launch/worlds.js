// Launch worlds: the background layers a beat stands on (texture:*, grade:*, effect:bloom-*). The world's colours
// come from the palette (L.palette(look, world)), so every layer re-skins to any brand. One big soft bloom per dark
// shot at most (look.md); light shots get paper, haze or a quiet grid.
'use strict';
(function (L) {
  const { rgba, mix, lum, rand, noise, E, prog, clamp, lerp } = L;
  const TILE = {};
  const tile = (key, size, paint) => { if (typeof document === 'undefined') return null; let t = TILE[key]; if (!t) { t = TILE[key] = document.createElement('canvas'); t.width = t.height = size; paint(t.getContext('2d'), size); } return t; };

  // paper fibre: two scales of mottling + fine fibres, multiplied in very lightly (a printed sheet, not a flat fill)
  L.def('texture:paper-fibre', {
    kind: 'texture',
    draw(S, o) {
      const c = S.ctx, dark = lum(S.P.bg) < 0.3;
      const t = tile('fibre', 512, (g, n) => {
        const im = g.createImageData(n, n);
        for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
          const i = (y * n + x) * 4, a = noise(x / 37 + noise(y / 61, 3) * 2, 7) * 0.5 + noise(x / 9, y % 7) * 0.2 + (rand(x * 7919 + y * 104729) - 0.5) * 0.6;
          const v = 128 + a * 60; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255;
        }
        g.putImageData(im, 0, 0);
        g.globalAlpha = 0.12; g.strokeStyle = '#000'; g.lineWidth = 0.6;
        for (let k = 0; k < 220; k++) { const x = rand(k) * n, y = rand(k + 500) * n, a = rand(k + 900) * Math.PI, l = 6 + rand(k + 77) * 18; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + 3, y + Math.sin(a) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
      });
      if (!t) return;
      c.save(); c.globalAlpha = (o && o.a) || (dark ? 0.05 : 0.07); c.globalCompositeOperation = dark ? 'screen' : 'multiply';
      c.fillStyle = c.createPattern(t, 'repeat'); c.fillRect(0, 0, S.W, S.H); c.restore();
      // a warm light from the top left, falling off: the sheet has a light direction
      const g = c.createRadialGradient(S.W * 0.25, -S.H * 0.2, 0, S.W * 0.25, -S.H * 0.2, Math.hypot(S.W, S.H));
      g.addColorStop(0, rgba('#FFFFFF', dark ? 0.05 : 0.22)); g.addColorStop(1, rgba('#000000', dark ? 0.18 : 0.05));
      c.fillStyle = g; c.fillRect(0, 0, S.W, S.H);
    },
  });

  // editorial dot grid: tiny dots on a strict grid, the paper's quiet structure (very low contrast)
  L.def('texture:dot-grid-editorial', {
    kind: 'texture',
    draw(S, o) { const s = (o && o.spacing || 42) * S.u; L.dotGrid(S.ctx, S.W, S.H, s, 1.25 * S.u, rgba(S.P.fg, 0.16), { ox: S.W / 2 % s, oy: S.H / 2 % s }); },
  });

  // hairline grid: a faint architect's grid with a slightly stronger centre cross
  L.def('texture:hairline-grid', {
    kind: 'texture',
    draw(S, o) {
      const c = S.ctx, s = (o && o.spacing || 96) * S.u; c.save(); c.strokeStyle = rgba(S.P.fg, 0.055); c.lineWidth = 1;
      for (let x = (S.W / 2) % s; x < S.W; x += s) { c.beginPath(); c.moveTo(x + 0.5, 0); c.lineTo(x + 0.5, S.H); c.stroke(); }
      for (let y = (S.H / 2) % s; y < S.H; y += s) { c.beginPath(); c.moveTo(0, y + 0.5); c.lineTo(S.W, y + 0.5); c.stroke(); }
      c.strokeStyle = rgba(S.P.fg, 0.09); c.beginPath(); c.moveTo(S.W / 2, 0); c.lineTo(S.W / 2, S.H); c.moveTo(0, S.H / 2); c.lineTo(S.W, S.H / 2); c.stroke(); c.restore();
    },
  });

  // concentric rings around a point (the radar world): very faint, slowly breathing outward
  L.def('texture:rings-concentric', {
    kind: 'texture',
    draw(S, o) {
      const c = S.ctx, cx = (o && o.x != null ? o.x : 0.5) * S.W, cy = (o && o.y != null ? o.y : 0.55) * S.H, step = 150 * S.u, off = (S.t * 18 * S.u) % step;
      c.save(); c.lineWidth = 1.2 * S.u;
      for (let r = off; r < Math.hypot(S.W, S.H); r += step) { c.strokeStyle = rgba(S.P.fg, 0.07 * (1 - r / Math.hypot(S.W, S.H))); c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.stroke(); }
      c.restore();
    },
  });

  // one big soft bloom off-centre that breathes (dark shots only; never a glow on everything)
  L.def('effect:bloom-soft-corner', {
    kind: 'overlay',
    draw(S, o) {
      const c = S.ctx, side = (o && o.side) || ((S.b.i % 2) ? 1 : -1);
      const x = S.W * (0.5 + side * 0.32) + Math.sin(S.t * 0.4) * 30 * S.u, y = S.H * (0.82 + Math.cos(S.t * 0.33) * 0.03), r = S.H * 0.85;
      c.save(); c.globalCompositeOperation = lum(S.P.bg) < 0.3 ? 'screen' : 'multiply';
      L.bloom(c, x, y, r, (o && o.color) || S.P.accent, lum(S.P.bg) < 0.3 ? 0.32 : 0.12); c.restore();
    },
  });

  // haze: a cool sky gradient (light blue top → paper bottom) with one fine light streak (the Apple-sting world)
  L.def('texture:haze-gradient', {
    kind: 'texture',
    draw(S) {
      const c = S.ctx, g = c.createLinearGradient(0, 0, 0, S.H);
      g.addColorStop(0, mix(S.P.bg, '#BCD3EE', 0.55)); g.addColorStop(0.6, S.P.bg); g.addColorStop(1, mix(S.P.bg, '#FFFFFF', 0.6));
      c.fillStyle = g; c.fillRect(0, 0, S.W, S.H);
      const r = c.createRadialGradient(S.W * 0.72, S.H * 0.18, 0, S.W * 0.72, S.H * 0.18, S.W * 0.6);
      r.addColorStop(0, 'rgba(255,255,255,0.55)'); r.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = r; c.fillRect(0, 0, S.W, S.H);
    },
  });

  // warm mesh: two or three soft colour fields (peach, the accent's tint) drifting very slowly (warm SaaS)
  L.def('texture:mesh-warm', {
    kind: 'texture',
    draw(S) {
      const c = S.ctx, dark = lum(S.P.bg) < 0.3, a = dark ? 0.22 : 0.42;
      const fields = [[0.15, 0.2, '#F6C9A8'], [0.85, 0.15, mix(S.P.accentRaw, '#FFFFFF', 0.55)], [0.6, 0.95, '#E9D8F2']];
      c.save(); c.globalCompositeOperation = dark ? 'screen' : 'multiply';
      fields.forEach(([x, y, col], i) => { const px = (x + Math.sin(S.t * 0.12 + i) * 0.03) * S.W, py = (y + Math.cos(S.t * 0.1 + i * 2) * 0.03) * S.H; L.bloom(c, px, py, S.W * 0.55, col, a); });
      c.restore();
    },
  });

  // saturated gradient from the accent (a cobalt world): deep at the top, light at the bottom
  L.def('texture:accent-gradient', {
    kind: 'texture',
    draw(S) {
      const c = S.ctx, a = S.P.accentRaw, g = c.createLinearGradient(0, 0, 0, S.H);
      g.addColorStop(0, mix(a, '#000000', 0.25)); g.addColorStop(0.55, a); g.addColorStop(1, mix(a, '#FFFFFF', 0.62));
      c.fillStyle = g; c.fillRect(0, 0, S.W, S.H);
    },
  });

  // halftone field at the frame's edges: dots grow toward the borders (a print world), centre stays clean
  L.def('texture:halftone-edge', {
    kind: 'texture',
    draw(S, o) {
      const s = 22 * S.u, cx = S.W / 2, cy = S.H / 2, R = Math.hypot(cx, cy);
      L.dotGrid(S.ctx, S.W, S.H, s, s * 0.5, rgba(S.P.fg, 0.9), { fn: (x, y, r) => { const d = Math.hypot((x - cx) / (S.W / S.H), y - cy) / (R * 0.75); return r * clamp((d - 0.55) * 2.2) * 0.95; } });
    },
  });

  // HUD corners: four thin corner ticks and a mono time code (editorial camera-frame chrome, used sparingly)
  L.def('texture:corner-ticks', {
    kind: 'texture',
    draw(S, o) {
      const c = S.ctx, m = 42 * S.u, l = 22 * S.u; c.save(); c.strokeStyle = rgba(S.P.fg, 0.35); c.lineWidth = 1.5 * S.u;
      [[m, m, 1, 1], [S.W - m, m, -1, 1], [m, S.H - m, 1, -1], [S.W - m, S.H - m, -1, -1]].forEach(([x, y, sx, sy]) => { c.beginPath(); c.moveTo(x, y + sy * l); c.lineTo(x, y); c.lineTo(x + sx * l, y); c.stroke(); });
      c.restore();
      const tc = (o && o.label) || (L.film && L.film.brand && L.film.brand.host) || '';
      const sec = Math.floor(S.t), fr = Math.floor((S.t % 1) * 24);
      L.text(c, S.look, `● ${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}:${String(fr).padStart(2, '0')}`, S.W - m - 6 * S.u, m + 30 * S.u, { role: 'micro', px: 15 * S.u, color: rgba(S.P.fg, 0.45), align: 'right' });
      if (tc) L.text(c, S.look, tc, m + 6 * S.u, m + 30 * S.u, { role: 'micro', px: 15 * S.u, color: rgba(S.P.fg, 0.45), upper: true });
    },
  });

  // ink-to-paper split world: the frame divided by a soft vertical seam (two worlds in one shot)
  L.def('texture:split-worlds', {
    kind: 'texture',
    draw(S, o) { const c = S.ctx, x = S.W * ((o && o.at) || 0.5); c.fillStyle = S.P.bg2; c.fillRect(x, 0, S.W - x, S.H); },
  });
})(globalThis.LAUNCH);
