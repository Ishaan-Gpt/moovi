// Launch transitions (transition:*): object-born, never a crossfade. tr(S, A, B, k, o) composites the outgoing shot A
// and the incoming shot B (offscreen canvases, both drawn at this t) over the window [cut - pre, cut + post], k 0..1.
// o.from is A's exit anchor and o.to B's entry anchor (frame fractions: {kind, x, y, w, h, r}), so a flood can grow out
// of the thing A ends on and contract INTO the thing B starts from. plan(o) gives the window and the sound cues.
'use strict';
(function (L) {
  const { clamp, lerp, prog, E, rgba, lum, rand } = L;
  const pt = (S, a, dx = 0.5, dy = 0.5) => ({ x: (a && a.x != null ? a.x : dx) * S.W, y: (a && a.y != null ? a.y : dy) * S.H });
  const cover = (S, x, y) => Math.max(Math.hypot(x, y), Math.hypot(S.W - x, y), Math.hypot(x, S.H - y), Math.hypot(S.W - x, S.H - y)) * 1.04;
  const split = (o, k) => { const span = (o.pre || 0) + (o.post || 0) || 1; return clamp(k * span / Math.max(1e-6, o.pre || 1e-6)); };
  const after = (o, k) => { const span = (o.pre || 0) + (o.post || 0) || 1; return clamp((k * span - (o.pre || 0)) / Math.max(1e-6, o.post || 1e-6)); };
  // the flood must read against the shot it covers: an ink flood over an ink shot becomes the accent
const floodColor = (S, o) => { const want = o.color === 'ink' ? S.look.palette.ink : o.color === 'paper' ? S.look.palette.paper : o.color || S.look.accent; const under = S.t < o.cut ? (S.PA || S.P).bg : S.P.bg; return L.contrast(want, under) < 1.6 ? (L.contrast(S.look.accent, under) >= 1.6 ? S.look.accent : (L.lum(under) > 0.4 ? S.look.palette.ink : S.look.palette.paper)) : want; };

  /* flood → contract (circle): a shape floods out of A's last object, holds a beat, contracts into B's first */
  L.def('transition:flood-contract-circle', {
    kind: 'transition', plan(o = {}) { return { pre: 0.32, post: 0.4, events: [{ at: -0.32, event: 'build' }, { at: 0, event: 'hard-hit' }] }; },
    tr(S, A, B, k, o) {
      const c = S.ctx, p0 = pt(S, o.from), p1 = pt(S, o.to), col = floodColor(S, o);
      if (S.t < o.cut) { // grow over A (overscale past the corners: never half the frame in one frame)
        const g = E.in(split(o, k)), r = lerp((o.from && o.from.r || 0.012) * S.H, cover(S, p0.x, p0.y), g);
        c.drawImage(A, 0, 0); L.circle(c, p0.x, p0.y, r, col);
      } else { // contract onto B's anchor
        const g = E.out(after(o, k)), r0 = cover(S, p1.x, p1.y), r1 = (o.to && o.to.r != null ? o.to.r : 0.012) * S.H;
        c.drawImage(B, 0, 0);
        const hold = after(o, k) < 0.12 ? 1 : 0;
        L.circle(c, lerp(S.W / 2, p1.x, g), lerp(S.H / 2, p1.y, g), hold ? r0 : lerp(r0, r1, E.ramp(clamp((after(o, k) - 0.12) / 0.88))), col);
      }
    },
  });

  /* flood → contract (pill): the flood shape is a rounded rect that ends as B's pill (a button, a label) */
  L.def('transition:flood-contract-pill', {
    kind: 'transition', plan() { return { pre: 0.3, post: 0.42, events: [{ at: -0.3, event: 'build' }, { at: 0, event: 'hard-hit' }] }; },
    tr(S, A, B, k, o) {
      const c = S.ctx, col = floodColor(S, o);
      if (S.t < o.cut) { const p = pt(S, o.from), g = E.in(split(o, k)); const w = lerp(0.12 * S.W, S.W * 2.2, g), h = lerp(0.06 * S.H, S.H * 2.2, g); c.drawImage(A, 0, 0); L.rr(c, p.x - w / 2, p.y - h / 2, w, h, Math.min(w, h) / 2 * (1 - g * 0.85)); c.fillStyle = col; c.fill(); }
      else {
        const g = E.ramp(after(o, k)), p = pt(S, o.to), tw = (o.to && o.to.w || 0.16) * S.W, th = (o.to && o.to.h || 0.07) * S.H;
        c.drawImage(B, 0, 0);
        const w = lerp(S.W * 1.15, tw, g), h = lerp(S.H * 1.15, th, g), x = lerp(S.W / 2, p.x, g), y = lerp(S.H / 2, p.y, g);
        c.save(); c.globalAlpha = 1 - E.in(clamp((after(o, k) - 0.8) / 0.2)); L.rr(c, x - w / 2, y - h / 2, w, h, lerp(0, th / 2, g)); c.fillStyle = col; c.fill(); c.restore();
      }
    },
  });

  /* iris: six blades close over A around a hexagonal aperture and snap open onto B */
  function blades(c, S, cx, cy, open, col, rot) {
    const R = cover(S, cx, cy) * 1.2, ap = Math.max(0.0001, open) * R;
    c.save(); c.fillStyle = col;
    for (let i = 0; i < 6; i++) {
      const a = rot + i * Math.PI / 3, a2 = a + Math.PI / 3;
      const v1 = [cx + Math.cos(a) * ap, cy + Math.sin(a) * ap], v2 = [cx + Math.cos(a2) * ap, cy + Math.sin(a2) * ap];
      c.beginPath(); c.moveTo(v1[0], v1[1]);
      c.lineTo(v1[0] + Math.cos(a + Math.PI / 2) * R * 2, v1[1] + Math.sin(a + Math.PI / 2) * R * 2);
      c.lineTo(v2[0] + Math.cos(a + Math.PI / 2) * R * 2, v2[1] + Math.sin(a + Math.PI / 2) * R * 2);
      c.lineTo(v2[0], v2[1]); c.closePath(); c.fill();
      c.strokeStyle = rgba('#FFFFFF', 0.08); c.lineWidth = 1.5 * S.u; c.beginPath(); c.moveTo(v1[0], v1[1]); c.lineTo(v1[0] + Math.cos(a + Math.PI / 2) * R * 2, v1[1] + Math.sin(a + Math.PI / 2) * R * 2); c.stroke();
    }
    c.restore();
  }
  L.def('transition:iris-six-blade', {
    kind: 'transition', plan() { return { pre: 0.28, post: 0.36, events: [{ at: -0.26, event: 'click-ui' }, { at: 0.02, event: 'key-word' }] }; },
    tr(S, A, B, k, o) {
      const c = S.ctx, p = S.t < o.cut ? pt(S, o.from) : pt(S, o.to), col = (o.color && floodColor(S, o)) || '#0B0B0C';
      if (S.t < o.cut) { const g = E.in(split(o, k)); c.drawImage(A, 0, 0); blades(c, S, p.x, p.y, 1 - g, col, g * 0.9); }
      else { const g = E.out(after(o, k)); c.drawImage(B, 0, 0); blades(c, S, p.x, p.y, g, col, 0.9 + g * 0.6); }
    },
  });

  /* mask wipe up: B rises from below behind a hard mask line and pushes A up (a page push with ghosts) */
  L.def('transition:mask-wipe-up', {
    kind: 'transition', plan() { return { pre: 0.18, post: 0.32, events: [{ at: -0.12, event: 'scene' }] }; },
    tr(S, A, B, k, o) {
      const c = S.ctx, g = E.hard(k), y = S.H * (1 - g);
      c.drawImage(A, 0, -S.H * 0.18 * g);
      c.save(); c.beginPath(); c.rect(0, y, S.W, S.H - y); c.clip(); c.drawImage(B, 0, y * 0.35); c.restore();
      const v = Math.sin(Math.PI * g); if (v > 0.2) { c.save(); c.globalAlpha = 0.12 * v; c.drawImage(B, 0, y * 0.35 + 30 * S.u * v); c.restore(); }
    },
  });

  /* whip pan: A smears out to one side, B smears in from the other (velocity ghosts, a hard ramp) */
  L.def('transition:whip-pan', {
    kind: 'transition', plan() { return { pre: 0.16, post: 0.2, events: [{ at: -0.05, event: 'scene' }] }; },
    tr(S, A, B, k, o) {
      const c = S.ctx, dir = o.dir || 1, g = E.hard(k), x = -g * S.W * dir, speed = Math.sin(Math.PI * k);
      const ghosts = Math.round(speed * 6);
      const draw = (img, ox) => { c.drawImage(img, ox, 0); for (let i = 1; i <= ghosts; i++) { c.save(); c.globalAlpha = 0.16; c.drawImage(img, ox + dir * i * 28 * S.u * speed, 0); c.restore(); } };
      draw(A, x); draw(B, x + S.W * dir);
    },
  });

  /* dot hand-off: A shrinks into its accent dot, the dot travels on an arc to B's entry and B opens out of it */
  L.def('transition:dot-handoff', {
    kind: 'transition', plan() { return { pre: 0.3, post: 0.38, events: [{ at: -0.3, event: 'slide-out' }, { at: 0.04, event: 'pop' }] }; },
    tr(S, A, B, k, o) {
      const c = S.ctx, p0 = pt(S, o.from), p1 = pt(S, o.to), r = (o.from && o.from.r || 0.014) * S.H, col = S.look.accent;
      if (S.t < o.cut) {
        const g = E.in(split(o, k));
        c.fillStyle = S.PA ? S.PA.bg : '#000'; c.fillRect(0, 0, S.W, S.H);
        c.save(); c.globalAlpha = 1 - g; c.translate(p0.x, p0.y); c.scale(1 - g * 0.9, 1 - g * 0.9); c.translate(-p0.x, -p0.y); c.drawImage(A, 0, 0); c.restore();
        const x = lerp(p0.x, (p0.x + p1.x) / 2, g), y = lerp(p0.y, Math.min(p0.y, p1.y) - S.H * 0.08, g); L.circle(c, x, y, r, col);
      } else {
        const g = E.out(after(o, k)), mid = { x: (p0.x + p1.x) / 2, y: Math.min(p0.y, p1.y) - S.H * 0.08 };
        const x = lerp(mid.x, p1.x, clamp(g * 1.6)), y = lerp(mid.y, p1.y, clamp(g * 1.6));
        c.fillStyle = S.P.bg; c.fillRect(0, 0, S.W, S.H);
        const R = lerp(r, cover(S, p1.x, p1.y), E.ramp(clamp((g - 0.35) / 0.65)));
        c.save(); c.beginPath(); c.arc(x, y, R, 0, Math.PI * 2); c.clip(); c.drawImage(B, 0, 0); c.restore();
        if (g < 0.7) L.circle(c, x, y, r * (1 - clamp((g - 0.4) / 0.3)), col);
      }
    },
  });

  /* liquid wave wipe: a band of B's world rises with a travelling sine edge, revealing B under it */
  L.def('transition:liquid-wave-wipe', {
    kind: 'transition', plan() { return { pre: 0.22, post: 0.38, events: [{ at: -0.2, event: 'scene' }] }; },
    tr(S, A, B, k, o) {
      const c = S.ctx, g = E.io(k), base = lerp(S.H * 1.12, -S.H * 0.25, g), amp = S.H * 0.09 * Math.sin(Math.PI * g), ph = k * 7;
      c.drawImage(A, 0, -S.H * 0.06 * g);
      c.save(); c.beginPath(); c.moveTo(0, S.H);
      for (let i = 0; i <= 48; i++) { const x = i / 48 * S.W, y = base + Math.sin(i / 48 * Math.PI * 2.2 + ph) * amp + Math.sin(i / 48 * Math.PI * 5 - ph * 1.4) * amp * 0.25; c.lineTo(x, y); }
      c.lineTo(S.W, S.H); c.closePath(); c.clip(); c.drawImage(B, 0, 0); c.restore();
    },
  });

  /* zoom through (dive): A grows in log space past the camera and burns out, B settles in from 92% */
  L.def('transition:zoom-through', {
    kind: 'transition', plan() { return { pre: 0.24, post: 0.32, events: [{ at: -0.24, event: 'build' }, { at: 0, event: 'scene' }] }; },
    tr(S, A, B, k, o) {
      const c = S.ctx, p = pt(S, o.from);
      if (S.t < o.cut) { const g = E.in(split(o, k)), s = L.logLerp(1, 3.2, g); c.save(); c.translate(p.x, p.y); c.scale(s, s); c.translate(-p.x, -p.y); if (g > 0.2) c.filter = `blur(${(g * 14 * S.u).toFixed(1)}px)`; c.drawImage(A, 0, 0); c.restore(); }
      else { const g = E.out(after(o, k)), s = lerp(0.9, 1, g); c.fillStyle = S.P.bg; c.fillRect(0, 0, S.W, S.H); c.save(); c.translate(S.W / 2, S.H / 2); c.scale(s, s); c.translate(-S.W / 2, -S.H / 2); if (g < 0.7) c.filter = `blur(${((1 - g / 0.7) * 10 * S.u).toFixed(1)}px)`; c.globalAlpha = clamp(g * 2.5); c.drawImage(B, 0, 0); c.restore(); }
    },
  });

  /* page push: B slides in from the right and pushes A out (iOS navigation), soft shadow on the seam */
  L.def('transition:page-push', {
    kind: 'transition', plan() { return { pre: 0.12, post: 0.38, events: [{ at: -0.1, event: 'card-in' }] }; },
    tr(S, A, B, k, o) {
      const c = S.ctx, g = E.out(k), x = S.W * (1 - g);
      c.drawImage(A, -S.W * 0.3 * g, 0);
      c.save(); c.globalAlpha = 0.35 * g; c.fillStyle = '#000'; c.fillRect(0, 0, x, S.H); c.restore();
      c.save(); c.shadowColor = 'rgba(0,0,0,0.25)'; c.shadowBlur = 40 * S.u; c.shadowOffsetX = -10 * S.u; c.fillStyle = S.P.bg; c.fillRect(x, 0, S.W, S.H); c.restore();
      c.drawImage(B, x, 0);
    },
  });

  /* bar wipe: six bands from alternating sides, jittered starts, close over A and open on B */
  L.def('transition:bar-wipe', {
    kind: 'transition', plan() { return { pre: 0.26, post: 0.26, events: [{ at: -0.2, event: 'cascade' }] }; },
    tr(S, A, B, k, o) {
      const c = S.ctx, n = 6, bh = S.H / n;
      c.drawImage(S.t < o.cut ? A : B, 0, 0);
      const col = floodColor(S, o);
      for (let i = 0; i < n; i++) {
        const st = L.stagger(0, i, 0.08, 5) / 0.6;
        const g = S.t < o.cut ? E.out(clamp((split(o, k) - st * 0.4) / 0.6)) : 1 - E.in(clamp((after(o, k) - st * 0.4) / 0.6));
        const w = S.W * g, x = i % 2 ? S.W - w : 0;
        c.fillStyle = col; c.fillRect(x, i * bh - 0.5, w, bh + 1);
      }
    },
  });

  /* rack swap: A racks out of focus while B racks in (a lens transition, for calm beats only) */
  L.def('transition:rack-focus-swap', {
    kind: 'transition', plan() { return { pre: 0.25, post: 0.35, events: [] }; },
    tr(S, A, B, k, o) {
      const c = S.ctx;
      if (S.t < o.cut) { const g = E.in(split(o, k)); c.filter = `blur(${(g * 18 * S.u).toFixed(1)}px)`; c.drawImage(A, 0, 0); c.filter = 'none'; }
      else { const g = E.out(after(o, k)); c.drawImage(A, 0, 0); c.filter = `blur(${((1 - g) * 18 * S.u).toFixed(1)}px)`; c.globalAlpha = clamp(g * 1.6); c.drawImage(B, 0, 0); c.filter = 'none'; c.globalAlpha = 1; }
    },
  });

  /* flash frame: a 3-frame light flash on the cut (paper white on light films, accent on dark) */
  L.def('transition:flash-cut', {
    kind: 'transition', plan() { return { pre: 0.04, post: 0.1, events: [{ at: 0, event: 'hard-hit' }] }; },
    tr(S, A, B, k, o) { const c = S.ctx; c.drawImage(S.t < o.cut ? A : B, 0, 0); const a = S.t < o.cut ? split(o, k) : 1 - after(o, k); c.save(); c.globalAlpha = 0.85 * a; c.fillStyle = lum(S.P.bg) > 0.4 ? '#FFFFFF' : S.look.accent; c.fillRect(0, 0, S.W, S.H); c.restore(); },
  });
})(globalThis.LAUNCH);
