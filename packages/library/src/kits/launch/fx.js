// Launch effects drawn over a beat after its set-up (effect:* kind overlay/move): finishes that a beat can be cast
// with. Never random particles, flares or glow on everything (look.md): each effect has a reason on its beat.
'use strict';
(function (L) {
  const { clamp, lerp, prog, E, rgba, lum, rand } = L;

  // a CRT / archival bezel: the shot sits in a rounded inset frame with scanlines and a soft vignette (footage beats)
  L.def('effect:crt-bezel', {
    kind: 'overlay',
    draw(S) {
      const c = S.ctx, m = 40 * S.u, r = 46 * S.u;
      c.save(); c.fillStyle = '#060606'; c.beginPath(); c.rect(0, 0, S.W, S.H); L.rr(c, m, m, S.W - 2 * m, S.H - 2 * m, r); c.fill('evenodd'); c.restore();
      c.save(); L.rr(c, m, m, S.W - 2 * m, S.H - 2 * m, r); c.clip(); c.globalAlpha = 0.08; c.fillStyle = '#000'; for (let y = m; y < S.H - m; y += 4 * S.u) c.fillRect(m, y, S.W - 2 * m, 1.4 * S.u);
      c.globalAlpha = 1; const g = c.createRadialGradient(S.W / 2, S.H / 2, S.H * 0.3, S.W / 2, S.H / 2, S.H * 0.85); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.45)'); c.fillStyle = g; c.fillRect(0, 0, S.W, S.H); c.restore();
    },
  });

  // a HUD tracking box that locks onto a target: corners close in, a label types beside it
  L.def('effect:hud-target-lock', {
    kind: 'overlay',
    draw(S, o) {
      const c = S.ctx, t = (o && o.target) || { x: 0.5, y: 0.5, w: 0.08, h: 0.1 }, at = (o && o.at) || 0.4, k = E.out(prog(S.lt, at, 0.5));
      if (k <= 0) return;
      const cx = t.x * S.W, cy = t.y * S.H, w = t.w * S.W * lerp(2.2, 1, k), h = t.h * S.H * lerp(2.2, 1, k), l = Math.min(w, h) * 0.28;
      const col = (o && o.color) || '#FF3B30'; c.save(); c.strokeStyle = col; c.lineWidth = 2.5 * S.u; c.globalAlpha = clamp(k * 2);
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => { const x = cx + sx * w / 2, y = cy + sy * h / 2; c.beginPath(); c.moveTo(x, y - sy * l); c.lineTo(x, y); c.lineTo(x - sx * l, y); c.stroke(); });
      if (k > 0.9) L.text(c, S.look, (o && o.label) || 'LOCK', cx + w / 2 + 12 * S.u, cy - h / 2 + 14 * S.u, { role: 'micro', px: 14 * S.u, color: col, upper: true });
      c.restore();
    },
  });

  // speed lines: a burst of thin radial streaks behind the subject on a hit (a hype beat, once a film at most)
  L.def('effect:radial-streaks', {
    kind: 'overlay',
    draw(S, o) {
      const c = S.ctx, at = (o && o.at) || 0, k = prog(S.lt, at, 0.7); if (k <= 0 || k >= 1) return;
      const cx = S.W / 2, cy = S.H / 2, n = 48; c.save(); c.globalAlpha = Math.sin(Math.PI * k) * 0.6; c.lineCap = 'round';
      for (let i = 0; i < n; i++) { const a = rand(i + 3) * Math.PI * 2, r0 = S.H * (0.25 + rand(i + 9) * 0.3 + k * 0.4), len = S.H * (0.08 + rand(i + 21) * 0.18); c.strokeStyle = i % 5 ? rgba(S.P.fg, 0.5) : S.P.accent; c.lineWidth = (1 + rand(i) * 2) * S.u; c.beginPath(); c.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); c.lineTo(cx + Math.cos(a) * (r0 + len), cy + Math.sin(a) * (r0 + len)); c.stroke(); }
      c.restore();
    },
  });

  // a fine film grain on this beat only (the look's own grain runs over the whole film)
  L.def('effect:grain-fine', { kind: 'overlay', draw(S, o) { L.grain(S.ctx, S.W, S.H, S.t, (o && o.a) || 0.08); } });
  // a soft vignette on this beat (dark beats; pulls the eye to the centre)
  L.def('effect:vignette-soft', { kind: 'overlay', draw(S, o) { L.vignette(S.ctx, S.W, S.H, (o && o.a) || 0.32); } });
})(globalThis.LAUNCH);
