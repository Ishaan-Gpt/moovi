// Launch pack l07: warm editorial paper. Three voices (grotesk for the narrator, an italic serif for everything the
// product writes, mono for data), one accent used sparingly, off-white sheets on long faint shadows, and a small set
// of recurring objects: data chips at three depths that never stop ticking, a field of almond eyes that turn their
// gaze to the subject, a dot crowd on a golden-angle spiral, two dot streams merging on an accent thread, a document
// wired to its team. Every part re-skins from the palette; content comes from b.text, b.data and the brand.
'use strict';
(function (L) {
  const { clamp, lerp, prog, E, rgba, mix, lum, spring, rand } = L;
  const T = (b, F, t0) => { const p = L.get(b.type) || L.get('effect:type-mask-rise'); return p.plan(b, F, t0); };
  const isWide = S => S.W / S.H > 1.3, isTall = S => S.H / S.W > 1.3;
  const dk = S => lum(S.P.bg) < 0.35;
  const inkOf = S => S.look.palette.ink;
  const sheet = S => (dk(S) ? S.P.card : mix(S.P.bg, '#FFFFFF', 0.72));
  const shade = (S, a = 0.12) => rgba(inkOf(S), dk(S) ? Math.min(0.6, a * 4) : a);
  const muted = S => mix(S.P.fg, S.P.bg, 0.48);
  const skel = S => mix(S.P.bg, S.P.fg, dk(S) ? 0.14 : 0.07);
  const toks = b => (b.text && b.text.tokens) || [];
  const nWords = b => toks(b).length;
  const itemsOf = (b, fb) => { const it = ((b.data && b.data.items) || []).filter(Boolean); return it.length ? it : (fb || ['Product', 'Design', 'Engineering', 'Marketing', 'Sales', 'Support']); };
  const brand = () => (L.film && L.film.brand) || { name: 'Brand', host: 'brand.com', tagline: '' };
  const fmt = (v, dec = 0) => v.toFixed(dec).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const numParts = n => { if (!n) return null; const dec = typeof n.value === 'number' && !Number.isInteger(n.value) ? 1 : 0; return { v: n.value, dec, pre: n.prefix || '', suf: n.suffix || '', label: n.label || '' }; };
  const accentWords = b => { const a = toks(b).filter(t => t.accent).map(t => t.s.replace(/[.,!?;:]+$/, '')); return a.length ? a.join(' ') : (toks(b).length ? toks(b)[toks(b).length - 1].s.replace(/[.,!?;:]+$/, '') : ''); };
  const serifTokens = b => toks(b).map(t => Object.assign({}, t, { role: 'accent' }));
  const pop = (S, t0, kind = 'pop') => (S.lt < t0 ? 0 : spring(S.lt - t0, kind));
  const appear = (S, t0, d = 0.5) => E.out(prog(S.lt, t0 || 0, d));
  const scaleAbout = (c, x, y, s) => { c.translate(x, y); c.scale(s, s); c.translate(-x, -y); };
  const mono = (S, s, x, y, px, o = {}) => L.text(S.ctx, S.look, s, x, y, Object.assign({ role: 'micro', px, color: S.P.dim }, o));
  const serif = (S, s, x, y, px, o = {}) => L.text(S.ctx, S.look, s, x, y, Object.assign({ role: 'accent', px, color: S.P.fg }, o));
  const softCard = (S, x, y, w, h, r, o = {}) => L.card(S.ctx, x, y, w, h, r, Object.assign({ fill: sheet(S), u: S.u, shadow: shade(S, 0.11), shadow2: shade(S, 0.06), lift: 1 }, o));
  const headPx = (S, b, base = 120) => { const n = nWords(b); return S.u * base * (n <= 2 ? 1.2 : n <= 4 ? 1 : n <= 7 ? 0.82 : 0.68) * (isTall(S) ? 0.9 : 1); };
  const caret = (S, x, y, h, col, solid) => { if (solid || Math.floor(S.lt * 2) % 2 === 0) { S.ctx.fillStyle = col || S.P.accent; S.ctx.fillRect(x, y - h * 0.82, Math.max(2, h * 0.08), h); } };
  // a value that counts to its target, then keeps ticking slowly (quantised at 12 Hz: reads as a live counter)
  const tick = (S, t0, from, to, dur = 1.1, rate = 0) => { const tq = Math.floor(S.lt * 12) / 12; const k = E.out(prog(tq, t0, dur)); return lerp(from, to, k) + Math.max(0, tq - t0 - dur) * rate; };
  const hex7 = s => (L.hash(s) >>> 0).toString(16).padStart(8, '0').slice(0, 7);

  /* ───────── shared drawings: the almond eye, the eye field, the spiral crowd ───────── */
  // an almond lid pointing along its gaze, the pupil at the front: seen small it reads as a dot with a pale tail
  function eye(c, x, y, len, ang, open, lid, edge, pupil) {
    c.save(); c.translate(x, y); c.rotate(ang);
    const h = len * 0.3 * open, x0 = -len * 0.62, x1 = len * 0.38;
    c.beginPath(); c.moveTo(x0, 0); c.quadraticCurveTo((x0 + x1) / 2, -h, x1, 0); c.quadraticCurveTo((x0 + x1) / 2, h, x0, 0); c.closePath();
    c.fillStyle = lid; c.fill(); if (edge) { c.lineWidth = 1; c.strokeStyle = edge; c.stroke(); }
    L.circle(c, len * 0.17, 0, len * 0.15 * (0.35 + 0.65 * open), pupil);
    c.restore();
  }
  // a grid of eyes opening outward from a target (rings by distance) and turning their gaze onto it
  function eyeField(S, o) {
    const c = S.ctx, p = o.pitch || (isTall(S) ? 104 : 112) * S.u, cols = Math.ceil(S.W / p) + 1, rows = Math.ceil(S.H / p) + 1;
    const ox = (S.W - (cols - 1) * p) / 2, oy = (S.H - (rows - 1) * p) / 2, maxD = Math.hypot(S.W, S.H) / 2;
    const dark = dk(S), lid = dark ? rgba(S.P.fg, 0.24) : '#FFFFFF', edge = dark ? null : rgba(inkOf(S), 0.12), pupil = dark ? S.P.fg : inkOf(S);
    const spread = o.spread == null ? 0.75 : o.spread;
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const x = ox + i * p + (j % 2 ? p * 0.08 : -p * 0.08), y = oy + j * p, tx = o.tx(S.lt), ty = o.ty(S.lt);
      const d = Math.hypot(x - tx, y - ty), r = rand(i * 31 + j * 977 + 5);
      const st = o.t0 + spread * Math.pow(clamp(d / maxD), 0.7) + (r - 0.5) * 0.08;
      const open = E.out(prog(S.lt, st, 0.24)); if (open <= 0.01) continue;
      const a = o.mask ? o.mask(x, y) : 1; if (a <= 0.02) continue;
      const toT = Math.atan2(ty - y, tx - x), a0 = r * Math.PI * 2, gk = E.out(prog(S.lt, st + 0.12, 0.55));
      let dA = toT - a0; dA = Math.atan2(Math.sin(dA), Math.cos(dA));
      const len = p * 0.42 * lerp(1.25, 0.82, clamp(d / maxD)) * (o.scale || 1), blink = o.blink != null ? Math.max(0, 1 - Math.abs(S.lt - o.blink - d / maxD * 0.5) / 0.08) : 0;
      c.save(); c.globalAlpha *= a * clamp(open * 2);
      eye(c, x, y, len, a0 + dA * gk, open * (1 - blink * 0.9), lid, edge, pupil);
      c.restore();
    }
  }
  // a crowd on a golden-angle spiral: count grows from a few to hundreds, the field turns slowly
  function spiral(S, cx, cy, k, o = {}) {
    const c = S.ctx, N = o.n || 400, R = Math.hypot(S.W, S.H) * 0.58, cc = R / Math.sqrt(N), n = Math.max(3, Math.floor(E.expo(k) * N)), rot = S.lt * 0.05;
    c.save(); c.fillStyle = o.color || (dk(S) ? S.P.fg : inkOf(S));
    for (let i = 0; i < n; i++) {
      const a = i * 2.39996 + rot, r = cc * Math.sqrt(i + 0.5) * lerp(0.25, 1, E.expo(k)), x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * (o.squash || 1);
      if (x < -10 || y < -10 || x > S.W + 10 || y > S.H + 10) continue;
      const m = o.mask ? o.mask(x, y) : 1; if (m <= 0.02) continue;
      const birth = clamp((E.expo(k) * N - i) / 6), s = lerp(1.6, 4.6, clamp(r / (R * 0.7))) * S.u * birth;
      c.globalAlpha = m * (o.a || 1); c.beginPath(); c.arc(x, y, s, 0, Math.PI * 2); c.fill();
    }
    c.restore();
  }
  // a hairline crosshair through a point with a small plus at the centre
  function crosshair(S, cx, cy, k, o = {}) {
    const c = S.ctx, col = rgba(S.P.fg, o.a || 0.1), l = 12 * S.u;
    c.save(); c.globalAlpha *= k;
    L.line(c, cx - S.W * k, cy, cx + S.W * k, cy, col, 1);
    L.line(c, cx, cy - S.H * k, cx, cy + S.H * k, col, 1);
    if (o.plus !== false) { L.line(c, cx - l, cy, cx + l, cy, rgba(S.P.fg, 0.5), 1.5 * S.u); L.line(c, cx, cy - l, cx, cy + l, rgba(S.P.fg, 0.5), 1.5 * S.u); }
    c.restore();
  }
  // the brand's mark: the real logo when there is one, else a rounded tile with the initial in the serif voice
  function markPath(c, x, y, s) { L.rr(c, x - s / 2, y - s / 2, s, s, s * 0.24); }
  function drawMark(S, x, y, s, k, o = {}) {
    // k: 0..1 line draw, o.fill: 0..1 (grey → ink), o.letter: alpha
    const c = S.ctx, per = s * 4 - s * 0.24 * (8 - 2 * Math.PI), logo = L.img('logo'), ink = dk(S) ? S.P.fg : inkOf(S);
    c.save();
    if ((o.fill || 0) > 0) {
      c.save(); c.shadowColor = shade(S, 0.18 * o.fill); c.shadowBlur = 40 * S.u; c.shadowOffsetY = 20 * S.u;
      markPath(c, x, y, s); c.fillStyle = logo ? '#FFFFFF' : mix(mix(S.P.bg, ink, 0.32), ink, clamp(o.fill * 2 - 1)); c.globalAlpha *= clamp(o.fill * 3); c.fill(); c.restore();
    }
    if (k > 0 && k < 1.02 && (o.fill || 0) < 1) { c.save(); markPath(c, x, y, s); c.setLineDash([per * k, per]); c.lineWidth = 2 * S.u; c.strokeStyle = ink; c.globalAlpha *= 1 - clamp(o.fill || 0); c.stroke(); c.restore(); }
    if ((o.letter || 0) > 0) {
      c.save(); c.globalAlpha *= o.letter;
      if (logo) { c.save(); markPath(c, x, y, s); c.clip(); const m = s * 0.16; c.drawImage(logo, x - s / 2 + m, y - s / 2 + m, s - 2 * m, s - 2 * m); c.restore(); }
      else serif(S, (brand().name || 'B').slice(0, 1).toUpperCase(), x, y + s * 0.24, s * 0.72, { color: dk(S) ? S.P.bg : S.P.bg, align: 'center' });
      c.restore();
    }
    c.restore();
  }

  /* ════════════════════════ UI widgets ════════════════════════ */

  /* mono counter chip: a big monospaced number, its unit smaller, a tiny spaced caps label; depth blurs and greys it */
  L.def('ui:mono-counter-chip', {
    kind: 'ui',
    draw(S, o) {
      const c = S.ctx, depth = o.depth || 1, px = (o.px || 64 * S.u) * depth, k = o.t0 == null ? 1 : pop(S, o.t0, 'firm');
      if (k <= 0.01) return null;
      let val = o.valueText;
      if (val == null) {
        const n = o.number || {}, to = o.count ? o.count[1] : (o.value != null ? o.value : n.value != null ? n.value : 92), from = o.count ? o.count[0] : (typeof to === 'number' ? to * 0.7 : 0);
        const dec = o.dec != null ? o.dec : (typeof to === 'number' && !Number.isInteger(to) ? 1 : 0);
        val = typeof to === 'number' ? fmt(tick(S, (o.t0 || 0) + 0.05, from, to, o.dur || 1.2, o.rate || 0), dec) : String(to);
        val = (o.prefix || n.prefix || '') + val;
      }
      const unit = o.unit != null ? o.unit : (o.number && o.number.suffix) || '';
      const nw = L.textW(c, S.look, val, { role: 'micro', px, tracking: -0.02 }), uw = unit ? L.textW(c, S.look, unit, { role: 'micro', px: px * 0.42, tracking: 0 }) + px * 0.08 : 0;
      const label = o.label || '', lw = label ? L.textW(c, S.look, label, { role: 'micro', px: px * 0.22, upper: true }) : 0;
      const padX = px * 0.28, w = Math.max(nw + uw, lw) + padX * 2, h = px * (label ? 1.42 : 1.12), x = o.x - w / 2, y = o.y - h / 2;
      const ink = depth >= 0.99 ? S.P.fg : mix(S.P.fg, S.P.bg, depth > 0.8 ? 0.35 : 0.52);
      c.save(); scaleAbout(c, o.x, o.y, lerp(0.86, 1, clamp(k))); c.globalAlpha *= clamp(k * 1.6) * (depth < 0.8 ? 0.82 : 1);
      if (o.blur) c.filter = `blur(${o.blur.toFixed(1)}px)`;
      softCard(S, x, y, w, h, 10 * S.u * depth, { lift: 0.45 * depth, fill: dk(S) ? S.P.card : mix(S.P.bg, '#FFFFFF', 0.45) });
      L.text(c, S.look, val, x + padX, y + px * 0.92, { role: 'micro', px, color: ink, tracking: -0.02 });
      if (unit) L.text(c, S.look, unit, x + padX + nw + px * 0.06, y + px * 0.92, { role: 'micro', px: px * 0.42, color: mix(ink, S.P.bg, 0.3), tracking: 0 });
      if (label) L.text(c, S.look, label, x + padX, y + px * 1.26, { role: 'micro', px: px * 0.22, color: mix(ink, S.P.bg, 0.25), upper: true, maxW: w - padX * 2 });
      c.restore();
      return { w, h };
    },
  });

  /* people badge: the accent disc with a three-person glyph, popping with an 8% overshoot on a soft coloured shadow */
  L.def('ui:people-badge-disc', {
    kind: 'ui',
    draw(S, o) {
      const c = S.ctx, r = (o.size ? o.size / 2 : o.r || 120 * S.u), k = o.t0 == null ? 1 : pop(S, o.t0, [14, 230, 1]);
      if (k <= 0.01) return;
      const acc = S.look.accent, fg = L.onColor(acc), breathe = 1 + Math.sin(S.lt * 2.2) * 0.008;
      c.save(); scaleAbout(c, o.x, o.y, k * breathe);
      c.save(); c.shadowColor = rgba(acc, 0.32); c.shadowBlur = 50 * S.u; c.shadowOffsetY = 22 * S.u; L.circle(c, o.x, o.y, r, acc); c.restore();
      const g = c.createLinearGradient(0, o.y - r, 0, o.y + r); g.addColorStop(0, 'rgba(255,255,255,0.16)'); g.addColorStop(1, 'rgba(0,0,0,0.06)'); L.circle(c, o.x, o.y, r, g);
      if (o.icon) L.icon(c, o.icon, o.x, o.y, r * 0.95, fg, 2);
      else { // three heads and one rounded base
        const s = r * 0.62; c.fillStyle = fg;
        [[-0.52, -0.1, 0.17], [0.52, -0.1, 0.17], [0, -0.2, 0.22]].forEach(([dx, dy, rr]) => { c.beginPath(); c.arc(o.x + dx * s, o.y + dy * s, rr * s, 0, Math.PI * 2); c.fill(); });
        c.beginPath(); c.moveTo(o.x - s * 0.95, o.y + s * 0.5); c.quadraticCurveTo(o.x - s * 0.95, o.y + s * 0.08, o.x - s * 0.5, o.y + s * 0.12); c.lineTo(o.x + s * 0.5, o.y + s * 0.12); c.quadraticCurveTo(o.x + s * 0.95, o.y + s * 0.08, o.x + s * 0.95, o.y + s * 0.5); c.closePath(); c.fill();
      }
      c.restore();
    },
  });

  /* black box with a caret: a plain ink square on a heavy soft shadow, a thin accent caret blinking in its middle */
  L.def('ui:black-box-caret', {
    kind: 'ui',
    draw(S, o) {
      const c = S.ctx, s = o.side || o.size || Math.min(o.w || 400 * S.u, (o.h || 400 * S.u)) * 0.9, k = o.t0 == null ? 1 : appear(S, o.t0, 0.45);
      if (k <= 0) return;
      const ink = inkOf(S), x = o.x - s / 2, y = o.y - s / 2;
      c.save(); c.globalAlpha *= k;
      c.save(); c.shadowColor = rgba(ink, 0.38); c.shadowBlur = 70 * S.u; c.shadowOffsetY = 18 * S.u; c.fillStyle = mix(mix(S.P.bg, ink, 0.25), dk(S) ? mix(ink, '#000000', 0.55) : ink, k); c.fillRect(x, y, s, s); c.restore();
      if (dk(S)) { c.strokeStyle = rgba(S.P.fg, 0.14); c.lineWidth = 1.2 * S.u; c.strokeRect(x, y, s, s); }
      const cw = Math.max(3 * S.u, s * 0.022), ch = s * 0.14;
      if (Math.floor((S.lt - (o.t0 || 0)) * 2) % 2 === 0) { c.fillStyle = mix(S.look.accent, ink, 0.15); c.fillRect(o.x - cw / 2, o.y - ch / 2, cw, ch); }
      c.restore();
    },
  });

  /* glowing label tile: a small square that turns from ink to the accent, gains a soft glow, a serif word inside */
  L.def('ui:glow-label-tile', {
    kind: 'ui',
    draw(S, o) {
      const c = S.ctx, s = o.side || (o.size || 240 * S.u) * 0.8, t0 = o.t0 || 0, turn = E.io(prog(S.lt, t0, 0.5)), k = pop(S, t0 - 0.05, 'firm');
      if (k <= 0.01) return;
      const acc = S.look.accent, col = mix(inkOf(S), acc, turn), pulse = 0.75 + Math.sin(S.lt * 2 * Math.PI * 0.8) * 0.25;
      c.save(); scaleAbout(c, o.x, o.y, lerp(0.9, 1, clamp(k)));
      c.save(); c.shadowColor = rgba(acc, 0.55 * turn * pulse); c.shadowBlur = 46 * S.u * turn; c.fillStyle = col; c.fillRect(o.x - s / 2, o.y - s / 2, s, s); c.restore();
      const g = c.createRadialGradient(o.x, o.y - s * 0.2, 0, o.x, o.y, s * 0.8); g.addColorStop(0, rgba('#FFFFFF', 0.18 * turn)); g.addColorStop(1, rgba('#FFFFFF', 0)); c.fillStyle = g; c.fillRect(o.x - s / 2, o.y - s / 2, s, s);
      const lab = o.label || accentWords(S.b) || 'Building', lk = appear(S, t0 + 0.3, 0.4);
      if (lk > 0) { c.globalAlpha *= lk; serif(S, lab, o.x, o.y + s * 0.07, s * 0.2, { color: L.onColor(acc), align: 'center', maxW: s * 0.86 }); }
      c.restore();
    },
  });

  /* terminal command pill: a black rounded pill grows from its left edge, a mono command types after a chevron,
     a small status chip with an accent dot appears under it when the last character lands */
  L.def('ui:terminal-command-pill', {
    kind: 'ui',
    draw(S, o) {
      const c = S.ctx, w = o.w || 820 * S.u, h = o.h && o.h < w * 0.3 ? o.h : w * 0.12, x = o.x - w / 2, y = o.y - h / 2, t0 = o.t0 || 0;
      const g = E.out(prog(S.lt, t0, 0.3)); if (g <= 0) return null;
      const cmd = o.cmd || o.text || 'run', cps = o.cps || 25, t1 = t0 + 0.35, n = Math.max(0, Math.min(cmd.length, Math.floor((S.lt - t1) * cps))), px = h * 0.38;
      const ink = dk(S) ? mix(inkOf(S), '#FFFFFF', 0.1) : inkOf(S);
      c.save(); c.shadowColor = shade(S, 0.22); c.shadowBlur = 30 * S.u; c.shadowOffsetY = 12 * S.u; L.rr(c, x, y, w * g, h, h * 0.24); c.fillStyle = ink; c.fill(); c.restore();
      c.save(); L.rr(c, x, y, w * g, h, h * 0.24); c.clip();
      const tx = x + h * 0.42; mono(S, '>', tx, o.y + px * 0.36, px, { color: S.look.accent, tracking: 0 });
      const typed = cmd.slice(0, n), ww = mono(S, typed, tx + px * 1.1, o.y + px * 0.36, px, { color: S.look.palette.paper, tracking: 0, maxW: w - h * 1.4 });
      caret(S, tx + px * 1.1 + Math.min(ww, w - h * 1.4) + 3 * S.u, o.y + px * 0.5, px * 1.1, S.look.palette.paper, n < cmd.length);
      c.restore();
      const done = t1 + cmd.length / cps, sk = pop(S, done + 0.12, 'firm');
      if (sk > 0.01 && o.status !== false) {
        const st = o.status || `${brand().host} · live`, sp = h * 0.26, sw = L.textW(c, S.look, st, { role: 'micro', px: sp, upper: true }) + sp * 2.8, sx = x + w - sw, sy = y + h + h * 0.2;
        c.save(); c.globalAlpha *= clamp(sk * 1.5); scaleAbout(c, sx + sw, sy, clamp(sk, 0, 1.1));
        softCard(S, sx, sy, sw, sp * 2.1, sp * 0.5, { lift: 0.3 });
        L.circle(c, sx + sp * 1.0, sy + sp * 1.05, sp * 0.3, S.look.accent);
        mono(S, st, sx + sp * 1.7, sy + sp * 1.4, sp, { upper: true, color: S.P.fg });
        c.restore();
      }
      return { done };
    },
  });

  /* post draft card: an off-white card, a channel label in the serif voice, a mono count, the body, an accent ship pill */
  L.def('ui:post-draft-card', {
    kind: 'ui',
    draw(S, o) {
      const c = S.ctx, w = o.w, h = o.h || w * 0.42, x = o.x - w / 2, y = o.y - h / 2, pad = w * 0.06, px = Math.min(h * 0.11, w * 0.05);
      softCard(S, x, y, w, h, 18 * S.u);
      c.save(); L.rr(c, x, y, w, h, 18 * S.u); c.clip();
      const foot = h * 0.24; c.fillStyle = mix(sheet(S), S.P.fg, 0.05); c.fillRect(x, y + h - foot, w, foot);
      L.circle(c, x + pad + px * 0.7, y + pad + px * 0.55, px * 0.7, mix(S.P.bg, S.P.fg, 0.14));
      serif(S, o.label || brand().name, x + pad + px * 1.8, y + pad + px * 0.9, px * 1.5, { maxW: w * 0.5 });
      mono(S, typeof o.count === 'string' ? o.count : '0 / 280', x + w - pad, y + pad + px * 0.8, px * 0.62, { align: 'right', upper: true });
      const body = (o.body || o.text || '').split(/\s+/).filter(Boolean).map(s => ({ s }));
      if (body.length) { const lay = L.layout(c, S.look, body, { role: 'ui', px: px * 1.05, maxW: w - pad * 2, x: x + pad, y: y + pad + px * 2.1, align: 'left', maxLines: 3, lineH: 1.35, space: 0.28 }); for (const wd of lay.words) L.drawWord(c, S.look, S.P, wd, { color: mix(S.P.fg, S.P.bg, 0.12) }); }
      const pk = o.shipAt != null ? pop(S, o.shipAt, 'firm') : 1, pw = px * 5.2, ph = px * 1.9, ppx = x + w - pad - pw, ppy = y + h - foot / 2 - ph / 2;
      mono(S, o.when || 'draft', x + pad, y + h - foot / 2 + px * 0.24, px * 0.62, { upper: true });
      if (pk > 0.01) { c.save(); scaleAbout(c, ppx + pw / 2, ppy + ph / 2, clamp(pk, 0, 1.2)); L.pill(c, ppx, ppy, pw, ph, S.look.accent); L.icon(c, 'send', ppx + ph * 0.55, ppy + ph / 2, ph * 0.46, L.onColor(S.look.accent), 2); mono(S, o.ship || 'ship', ppx + ph * 0.95, ppy + ph * 0.66, px * 0.66, { upper: true, color: L.onColor(S.look.accent) }); c.restore(); }
      c.restore();
    },
  });

  /* serif suggestion card: mono meta + an accent outlined step pill, an italic serif title, the body, a reply box
     whose text types with an accent caret behind an ink bar */
  L.def('ui:serif-suggestion-card', {
    kind: 'ui',
    draw(S, o) {
      const c = S.ctx, w = o.w, h = o.h || w * 0.5, x = o.x - w / 2, y = o.y - h / 2, pad = Math.min(w * 0.045, 56 * S.u), k = o.t0 == null ? 1 : appear(S, o.t0, 0.55);
      if (k <= 0) return null;
      const mp = Math.max(13 * S.u, Math.min(18 * S.u, w * 0.016));
      c.save(); c.globalAlpha *= clamp(k * 1.5); c.translate(0, (1 - k) * 60 * S.u);
      softCard(S, x, y, w, h, 26 * S.u, { fill: dk(S) ? S.P.card : mix(S.P.bg, '#FFFFFF', 0.82) });
      c.save(); L.rr(c, x, y, w, h, 26 * S.u); c.clip();
      const meta = (o.meta || 'suggestion'), mw = mono(S, meta, x + pad, y + pad + mp, mp, { upper: true, color: S.P.fg });
      const stp = o.step || '1 / 7', sw = L.textW(c, S.look, stp, { role: 'micro', px: mp }) + mp * 1.6;
      L.pill(c, x + pad + mw + mp * 1.2, y + pad - mp * 0.2, sw, mp * 1.7, null, S.look.accent); mono(S, stp, x + pad + mw + mp * 1.2 + sw / 2, y + pad + mp * 0.95, mp, { color: S.look.accent, align: 'center' });
      mono(S, o.side || brand().host, x + w - pad, y + pad + mp, mp, { upper: true, align: 'right' });
      const tk = appear(S, (o.t0 || 0) + 0.25, 0.5);
      let yy = y + pad + mp * 3;
      const title = typeof o.title === 'string' ? o.title.split(/\s+/).map(s => ({ s, role: 'accent' })) : (o.title || []);
      if (title.length) {
        const lay = L.layout(c, S.look, title, { role: 'accent', px: o.titlePx || Math.min(64 * S.u, w * 0.06), maxW: w - pad * 2, x: x + pad, y: yy, align: 'left', maxLines: 2, lineH: 1.08 });
        c.save(); c.globalAlpha *= tk; c.translate(0, (1 - tk) * 14 * S.u); for (const wd of lay.words) L.drawWord(c, S.look, S.P, wd); c.restore();
        yy = lay.bottom + mp * 0.8;
      }
      const body = o.body != null ? o.body : (o.line || ''); if (body) { const bl = L.layout(c, S.look, body.split(/\s+/).map(s => ({ s })), { role: 'ui', px: Math.min(26 * S.u, w * 0.024), maxW: w - pad * 2, x: x + pad, y: yy, align: 'left', maxLines: 2, lineH: 1.4, space: 0.28 }); c.save(); c.globalAlpha *= appear(S, (o.t0 || 0) + 0.4, 0.5); for (const wd of bl.words) L.drawWord(c, S.look, S.P, wd, { color: mix(S.P.fg, S.P.bg, 0.25) }); c.restore(); yy = bl.bottom + mp; }
      // reply box
      const rb = { x: x + pad, y: Math.max(yy + mp * 0.5, y + h * 0.6), w: w - pad * 2 }; rb.h = Math.min(y + h - pad - rb.y, h * 0.32);
      if (rb.h > mp * 3) {
        const rk = appear(S, (o.t0 || 0) + 0.55, 0.45); c.save(); c.globalAlpha *= rk;
        L.rr(c, rb.x, rb.y, rb.w, rb.h, 10 * S.u); c.fillStyle = mix(S.P.bg, '#FFFFFF', dk(S) ? 0.05 : 0.5); c.fill(); c.strokeStyle = rgba(S.P.fg, 0.08); c.lineWidth = 1; c.stroke();
        c.fillStyle = dk(S) ? S.P.fg : inkOf(S); c.fillRect(rb.x, rb.y, 6 * S.u, rb.h);
        mono(S, o.replyLabel || 'reply', rb.x + 26 * S.u, rb.y + mp * 1.7, mp * 0.9, { upper: true });
        const rep = o.reply || o.text || '', cps = o.cps || 30, n = Math.max(0, Math.min(rep.length, Math.floor((S.lt - (o.typeAt != null ? o.typeAt : (o.t0 || 0) + 0.9)) * cps)));
        const rp = Math.min(26 * S.u, rb.h * 0.22), ww = L.text(c, S.look, rep.slice(0, n), rb.x + 26 * S.u, rb.y + rb.h * 0.62, { role: 'ui', px: rp, color: S.P.fg, maxW: rb.w - 120 * S.u });
        caret(S, rb.x + 28 * S.u + Math.min(ww, rb.w - 120 * S.u), rb.y + rb.h * 0.62 + rp * 0.1, rp * 1.1, S.look.accent, n < rep.length && n > 0);
        mono(S, `${n} / 280`, rb.x + rb.w - 20 * S.u, rb.y + rb.h - mp * 0.9, mp * 0.85, { align: 'right' });
        c.restore();
      }
      c.restore(); c.restore();
      return { x, y, w, h };
    },
  });

  /* approve action bar: a floating pill slides up with deny, a selected count and the accent confirm button,
     which collapses to a check when clicked */
  L.def('ui:approve-action-bar', {
    kind: 'ui',
    draw(S, o) {
      const c = S.ctx, w = o.w || 700 * S.u, h = Math.min(o.h && o.h < w * 0.3 ? o.h : w * 0.13, 96 * S.u), t0 = o.t0 || 0, k = E.out(prog(S.lt, t0, 0.32));
      if (k <= 0) return null;
      const x = o.x - w / 2, y = o.y - h / 2 + (1 - k) * h * 1.4, click = o.click != null ? o.click : (o.clicks && o.clicks[0]) != null ? o.clicks[0] : t0 + 1.2;
      const fill = dk(S) ? mix(inkOf(S), '#FFFFFF', 0.1) : mix(S.P.bg, '#FFFFFF', 0.85);
      c.save(); c.globalAlpha *= clamp(k * 1.4);
      softCard(S, x, y, w, h, h / 2, { fill, lift: 1.1 });
      const px = h * 0.24, cy = y + h / 2;
      L.icon(c, 'x', x + h * 0.55, cy, px * 1.2, S.P.dim, 2);
      mono(S, o.deny || 'skip', x + h * 0.9, cy + px * 0.36, px * 0.8, { upper: true });
      const done = S.lt >= click, n = (typeof o.count === 'number' ? o.count : 1) + (done ? 1 : 0);
      mono(S, `${n} ${o.selected || 'selected'}`, x + w * 0.42, cy + px * 0.36, px * 0.8, { upper: true, color: S.P.fg, align: 'center' });
      const press = L.pressAt([click], S.lt).p, bw = w * 0.34, bh = h * 0.66, bx = x + w - bw - h * 0.17, by = cy - bh / 2;
      const ck = E.out(prog(S.lt, click, 0.22)), cw = lerp(bw, bh, ck);
      c.save(); scaleAbout(c, bx + bw - cw / 2, cy, 1 - press * 0.06);
      c.save(); c.shadowColor = rgba(S.look.accent, 0.35); c.shadowBlur = 18 * S.u; c.shadowOffsetY = 6 * S.u; L.pill(c, bx + bw - cw, by, cw, bh, S.look.accent); c.restore();
      const on = L.onColor(S.look.accent);
      if (ck < 0.5) { c.save(); c.globalAlpha *= 1 - ck * 2; mono(S, o.label || 'approve', bx + bw / 2, cy + px * 0.36, px * 0.86, { upper: true, color: on, align: 'center', maxW: bw * 0.84 }); c.restore(); }
      else { c.save(); c.globalAlpha *= (ck - 0.5) * 2; L.icon(c, 'check', bx + bw - bh / 2, cy, bh * 0.5, on, 2.6); c.restore(); }
      c.restore(); c.restore();
      return { button: { x: bx + bw / 2, y: cy }, click };
    },
  });

  /* skeleton post composer: an empty post box made of soft skeleton shapes, a caret blinking where words should be */
  L.def('ui:skeleton-post-composer', {
    kind: 'ui',
    draw(S, o) {
      const c = S.ctx, w = o.w, h = o.h && o.h < w * 0.7 ? o.h : w * 0.44, x = o.x - w / 2, y = o.y - h / 2, k = o.t0 == null ? 1 : appear(S, o.t0, 0.5);
      if (k <= 0) return;
      const sk = skel(S), pad = w * 0.06;
      c.save(); c.globalAlpha *= k; c.translate(0, (1 - k) * 24 * S.u);
      softCard(S, x, y, w, h, 18 * S.u, { lift: 0.8 });
      L.circle(c, x + pad + h * 0.08, y + pad + h * 0.08, h * 0.08, sk);
      L.rr(c, x + pad + h * 0.22, y + pad + h * 0.02, w * 0.3, h * 0.05, h * 0.025); c.fillStyle = sk; c.fill();
      L.rr(c, x + pad + h * 0.22, y + pad + h * 0.1, w * 0.18, h * 0.04, h * 0.02); c.fillStyle = mix(sk, sheet(S), 0.4); c.fill();
      caret(S, x + pad, y + h * 0.56, h * 0.13, S.look.accent);
      L.line(c, x + pad, y + h * 0.76, x + w - pad, y + h * 0.76, rgba(S.P.fg, 0.06), 1);
      const bw = w * 0.13, bh = h * 0.11; L.pill(c, x + w - pad - bw, y + h * 0.82, bw, bh, sk);
      L.rr(c, x + w - pad - bw * 0.7, y + h * 0.82 + bh * 0.4, bw * 0.4, bh * 0.2, bh * 0.1); c.fillStyle = mix(sk, S.P.fg, 0.15); c.fill();
      c.restore();
    },
  });

  /* settings voice window: a wide window, a serif title, a numbered mono menu with one item marked by an accent bar,
     fields whose values fill in the accent, and a voice line that types itself */
  L.def('ui:settings-voice-window', {
    kind: 'ui',
    draw(S, o) {
      const c = S.ctx, w = o.w, h = o.h, x = o.x - w / 2, y = o.y - h / 2, t0 = o.t0 || 0, m = o.morph == null ? 1 : o.morph;
      const tall = h > w * 0.9, side = tall ? 0 : w * 0.24, pad = Math.min(w, h) * 0.06, mp = Math.max(12 * S.u, Math.min(18 * S.u, w * 0.014));
      softCard(S, x, y, w, h, 22 * S.u, { fill: dk(S) ? S.P.card : mix(S.P.bg, '#FFFFFF', 0.85), lift: 1.1 });
      if (m < 0.6) return;
      const ck = (m - 0.6) / 0.4;
      c.save(); L.rr(c, x, y, w, h, 22 * S.u); c.clip(); c.globalAlpha *= ck;
      const items = o.menu || itemsOf(S.b), act = o.active != null ? o.active : Math.min(3, items.length - 1);
      const title = o.title || (toks(S.b).length ? toks(S.b).map(t => t.s).join(' ') : 'Your setup.');
      const tp = Math.min(54 * S.u, (tall ? w : side) * 0.16), tlay = L.layout(c, S.look, title.split(/\s+/).map(s => ({ s, role: 'accent' })), { role: 'accent', px: tp, maxW: (tall ? w : side) - pad * 1.5, x: x + pad, y: y + pad * 0.8, align: 'left', maxLines: 2, lineH: 1.05 });
      for (const wd of tlay.words) L.drawWord(c, S.look, S.P, wd);
      // menu
      const my = tlay.bottom + pad * 0.8, mh = mp * 2.6;
      items.slice(0, tall ? 0 : 6).forEach((it, i) => {
        const yy = my + i * mh, a = appear(S, t0 + 0.1 + i * 0.05, 0.3), on = i === act ? appear(S, t0 + 0.5, 0.3) : 0;
        c.save(); c.globalAlpha *= a;
        if (on > 0) { L.rr(c, x + pad * 0.6, yy - mh * 0.62, side - pad * 0.9, mh * 0.9, 8 * S.u); c.fillStyle = rgba(S.P.fg, 0.05 * on); c.fill(); c.fillStyle = S.look.accent; c.fillRect(x + pad * 0.35, yy - mh * 0.5, 3 * S.u, mh * 0.62 * on); }
        mono(S, `${i + 1}  ${it}`, x + pad, yy, mp, { color: on > 0 ? S.P.fg : S.P.dim, maxW: side - pad * 1.6 });
        c.restore();
      });
      // panel
      const px0 = x + (tall ? pad : side), py0 = tall ? tlay.bottom + pad * 0.6 : y + pad * 0.7, pw = w - (tall ? pad * 2 : side + pad * 0.7), ph = y + h - pad * 0.7 - py0;
      L.rr(c, px0, py0, pw, ph, 14 * S.u); c.fillStyle = mix(S.P.bg, '#FFFFFF', dk(S) ? 0.04 : 0.35); c.fill();
      const ip = pw * 0.05, cols = tall ? 1 : 2, fw = (pw - ip * (cols + 1)) / cols, fh = Math.min(ph * 0.11, 64 * S.u);
      mono(S, o.section || (S.b.text && S.b.text.eyebrow) || 'voice & positioning', px0 + ip, py0 + ip * 0.9, mp, { upper: true });
      const vals = o.fields || [{ k: items[0], v: brand().name }, { k: items[1] || 'audience', v: (items[2] || '').toLowerCase() || 'everyone' }, { k: items[3] || 'tone', chips: items.slice(0, 3) }, { k: items[4] || 'model', v: items[5] || items[0], drop: true }];
      vals.forEach((f, i) => {
        const col = i % cols, row = Math.floor(i / cols), fx = px0 + ip + col * (fw + ip), fy = py0 + ip * 1.8 + row * (fh * 2.1);
        const a = appear(S, t0 + 0.6 + i * 0.2, 0.35); if (a <= 0) return;
        c.save(); c.globalAlpha *= a;
        mono(S, f.k || '', fx, fy + mp * 0.2, mp * 0.85, { maxW: fw });
        L.rr(c, fx, fy + mp * 0.7, fw, fh, 8 * S.u); c.fillStyle = dk(S) ? rgba(S.P.fg, 0.06) : '#FFFFFF'; c.fill(); c.strokeStyle = rgba(S.P.fg, 0.07); c.lineWidth = 1; c.stroke();
        const ty = fy + mp * 0.7 + fh * 0.62;
        if (f.chips) { let cx = fx + fh * 0.3; f.chips.forEach((s, j) => { const cw = L.textW(c, S.look, s, { role: 'micro', px: mp * 0.85 }) + mp * 1.4; if (cx + cw > fx + fw - 8 * S.u) return; L.pill(c, cx, fy + mp * 0.7 + fh * 0.22, cw, fh * 0.56, j === 0 ? rgba(S.look.accent, 0.1) : rgba(S.P.fg, 0.05)); mono(S, s, cx + cw / 2, ty - fh * 0.04, mp * 0.85, { align: 'center', color: j === 0 ? S.P.accent : S.P.dim }); cx += cw + 8 * S.u; }); }
        else { const n = Math.floor(clamp((S.lt - (t0 + 0.75 + i * 0.2)) / 0.4) * (f.v || '').length); mono(S, (f.v || '').slice(0, n), fx + fh * 0.3, ty, mp * 1.05, { color: f.drop ? S.P.fg : S.P.accent, maxW: fw - fh * 0.9, tracking: 0 }); if (f.drop) L.icon(c, 'arrowRight', fx + fw - fh * 0.4, fy + mp * 0.7 + fh / 2, fh * 0.32, S.P.dim, 2); }
        c.restore();
      });
      // the voice line types itself
      const vy = py0 + ip * 1.8 + Math.ceil(vals.length / cols) * fh * 2.1, vh = Math.min(fh * 1.7, py0 + ph - vy - ip * 0.6);
      if (vh > fh) {
        const a = appear(S, t0 + 1.3, 0.35); c.save(); c.globalAlpha *= a;
        mono(S, o.voiceLabel || 'one-liner', px0 + ip, vy + mp * 0.2, mp * 0.85);
        L.rr(c, px0 + ip, vy + mp * 0.7, pw - ip * 2, vh, 8 * S.u); c.fillStyle = dk(S) ? rgba(S.P.fg, 0.06) : '#FFFFFF'; c.fill(); c.strokeStyle = rgba(S.P.fg, 0.07); c.stroke();
        const line = o.voice || (S.b.data && S.b.data.prompt) || brand().tagline || brand().name, cps = 20, n = Math.max(0, Math.min(line.length, Math.floor((S.lt - (t0 + 1.5)) * cps)));
        const ww = mono(S, line.slice(0, n), px0 + ip + fh * 0.3, vy + mp * 0.7 + vh * 0.42, mp * 1.05, { color: S.P.fg, tracking: 0, maxW: pw - ip * 2 - fh });
        if (a > 0.5) { c.fillStyle = S.look.accent; c.fillRect(px0 + ip + fh * 0.3 + Math.min(ww, pw - ip * 2 - fh) + 3 * S.u, vy + mp * 0.7 + vh * 0.42 - mp, mp * 0.6, mp * 1.2); }
        c.restore();
      }
      c.restore();
    },
  });

  /* ════════════════════════ set-ups ════════════════════════ */

  // a tiny product frame for the flash montage (when the site gave no shots): each re-skins from the palette
  function miniScene(S, i, x, y, w, h) {
    const c = S.ctx, b = S.b, it = itemsOf(b), acc = S.look.accent, ink = inkOf(S), paper = S.look.palette.paper, n = numParts(b.data && b.data.number);
    const kind = i % 6, word = it[i % it.length];
    if (kind === 0) { c.fillStyle = acc; c.fillRect(x, y, w, h); L.text(c, S.look, n ? `${n.pre}${fmt(n.v, n.dec)}${n.suf}` : word, x + w / 2, y + h * 0.62, { role: 'micro', px: h * 0.34, color: L.onColor(acc), align: 'center', maxW: w * 0.8, tracking: -0.03 }); }
    else if (kind === 1) { c.fillStyle = ink; c.fillRect(x, y, w, h); for (let r = 0; r < 4; r++) { const yy = y + h * (0.2 + r * 0.18); L.circle(c, x + w * 0.12, yy, h * 0.045, r === 1 ? acc : rgba(paper, 0.35)); L.text(c, S.look, it[(i + r) % it.length], x + w * 0.19, yy + h * 0.03, { role: 'ui', px: h * 0.08, color: rgba(paper, r === 1 ? 0.95 : 0.55), maxW: w * 0.5 }); L.rr(c, x + w * 0.74, yy - h * 0.03, w * 0.14, h * 0.06, h * 0.03); c.fillStyle = rgba(paper, 0.12); c.fill(); } }
    else if (kind === 2) { c.fillStyle = mix(paper, '#FFFFFF', 0.6); c.fillRect(x, y, w, h); const vs = [0.3, 0.45, 0.38, 0.6, 0.52, 0.78, 0.92]; vs.forEach((v, j) => { L.rr(c, x + w * (0.12 + j * 0.11), y + h * 0.85 - h * 0.65 * v, w * 0.07, h * 0.65 * v, 4 * S.u); c.fillStyle = j === 6 ? acc : rgba(ink, 0.16); c.fill(); }); }
    else if (kind === 3) { c.fillStyle = mix(paper, ink, 0.04); c.fillRect(x, y, w, h); L.text(c, S.look, word, x + w / 2, y + h * 0.58, { role: 'accent', px: h * 0.2, color: ink, align: 'center', maxW: w * 0.8 }); }
    else if (kind === 4) { c.fillStyle = ink; c.fillRect(x, y, w, h); c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip(); L.dotGrid(c, x + w, y + h, h * 0.1, 1.6 * S.u, rgba(paper, 0.3), { ox: x, oy: y }); c.restore(); c.fillStyle = acc; c.fillRect(x + w * 0.58, y + h * 0.4, h * 0.12, h * 0.12); }
    else { c.fillStyle = mix(paper, acc, 0.22); c.fillRect(x, y, w, h); L.text(c, S.look, (brand().name || 'B').slice(0, 1), x + w / 2, y + h * 0.72, { role: 'accent', px: h * 0.66, color: mix(acc, ink, 0.35), align: 'center' }); }
  }

  /* flash-card montage: a centred card flicks through frames every three film frames while the hook builds, holds,
     then shrinks to a point */
  L.def('insert:flash-card-montage', {
    kind: 'setup',
    plan(b, F) {
      const tp = T(b, F, 0.2), hold = Math.max(1.0, tp.done), shrink = hold + 0.65;
      const ev = [{ at: 0, event: 'riffle' }, ...tp.events, { at: shrink, event: 'slide-out' }];
      return { cues: { flash: 0, head: 0.2, headDone: tp.done, hold, shrink }, events: ev, exit: { kind: 'dot', x: 0.5, y: 0.4, r: 0.01 }, entry: { kind: 'rect', x: 0.5, y: 0.4, w: 0.4, h: 0.4 }, min: shrink + 0.45 };
    },
    draw(S) {
      const c = S.ctx, b = S.b, wide = isWide(S), tall = isTall(S);
      const cw = S.W * (wide ? 0.5 : tall ? 0.86 : 0.74), ch = cw * (tall ? 1.05 : 9 / 16), cx = S.W / 2, cy = S.H * (tall ? 0.36 : 0.4);
      const sk = 1 - E.in(prog(S.lt, S.at('shrink'), 0.2)), pk = E.out(prog(S.lt, 0, 0.35)), s = sk * lerp(0.94, 1, pk) * (1 + S.lt * 0.008);
      if (sk > 0.002) {
        const imgs = ['hero', 'mobile'].map(n => L.img(n)).filter(Boolean);
        const fi = S.lt < S.at('hold') ? Math.floor(S.lt * 8) : 99, x = cx - cw / 2, y = cy - ch / 2;
        c.save(); scaleAbout(c, cx, cy, s); c.globalAlpha *= clamp(pk * 2);
        softCard(S, x, y, cw, ch, 16 * S.u, { lift: 1.2, stroke: rgba(S.P.fg, 0.14) });
        c.save(); L.rr(c, x, y, cw, ch, 16 * S.u); c.clip();
        const pool = imgs.length + 6, idx = fi === 99 ? (imgs.length ? 0 : 3) : fi % pool;
        if (idx < imgs.length) { const im = imgs[idx], k = Math.max(cw / im.width, ch / im.height); c.drawImage(im, cx - im.width * k / 2, cy - im.height * k / 2, im.width * k, im.height * k); }
        else miniScene(S, idx - imgs.length + (fi === 99 ? 0 : 0), x, y, cw, ch);
        c.restore(); c.restore();
      } else L.circle(c, cx, cy, 6 * S.u * (1 - E.out(prog(S.lt, S.at('shrink') + 0.2, 0.25))), S.P.accent);
      // the hook: one bold line under the card, left on the card's edge, its key phrase in the accent
      // after the card is gone the line takes the centre, a size up (no dead frame)
      const mv = E.io(prog(S.lt, S.at('shrink') + 0.1, 0.6)), px = headPx(S, b, wide ? 92 : 84) * lerp(1, 1.3, mv), left = wide ? cx - cw / 2 : S.W * 0.08;
      const lay0 = L.layout(c, S.look, toks(b), { px, maxW: S.W * 0.84, x: 0, y: 0, align: 'left', maxLines: 2 });
      L.headline(S, { px, maxW: wide ? S.W * 0.78 : S.W * 0.84, x: lerp(left, S.W / 2 - lay0.W / 2, mv), y: lerp(cy + ch / 2 + 56 * S.u, S.H / 2 - lay0.H / 2, mv), align: 'left', maxLines: 2 });
    },
  });

  /* mono chip cloud: an accent people badge at the hub, fourteen data chips at three depths around it, every number
     ticking, the whole field rising slowly; the line sits under it */
  L.def('insert:mono-chip-cloud-hub', {
    kind: 'setup',
    plan(b, F) {
      const tp = T(b, F, 0.85), ev = [{ at: 0.05, event: 'pop' }, ...Array.from({ length: 6 }, (_, i) => ({ at: 0.25 + i * 0.09, event: 'stat' })), ...tp.events];
      return { cues: { badge: 0.05, chips: 0.2, head: 0.85, headDone: tp.done }, events: ev, exit: { kind: 'circle', x: 0.5, y: 0.4, r: 0.11 }, entry: { kind: 'dot', x: 0.5, y: 0.4, r: 0.012 }, min: 3 };
    },
    draw(S) {
      const c = S.ctx, b = S.b, wide = isWide(S), tall = isTall(S), cx = S.W / 2, cy = S.H * (tall ? 0.4 : 0.4), br = Math.min(S.W, S.H) * 0.105;
      const it = itemsOf(b), num = numParts(b.data && b.data.number), N = tall ? 12 : 14, headTop = S.H * (tall ? 0.74 : 0.72);
      // seeded positions: spread over the frame, off the hub and off the headline band; three depths
      const pts = []; let tries = 0;
      while (pts.length < N && tries < 600) {
        const r1 = rand(S.seed % 997 + tries * 13 + 1), r2 = rand(S.seed % 991 + tries * 29 + 7); tries++;
        const x = S.W * lerp(0.07, 0.93, r1), y = S.H * lerp(0.08, tall ? 0.66 : 0.62, r2);
        if (Math.hypot((x - cx) / 1.25, y - cy) < br * 1.9) continue;
        if (pts.some(p => Math.abs(p.x - x) < S.W * (wide ? 0.11 : 0.2) && Math.abs(p.y - y) < S.H * (tall ? 0.07 : 0.11))) continue;
        pts.push({ x, y });
      }
      pts.forEach((p, i) => {
        const depth = [1, 0.85, 0.7][i % 3], t0 = L.stagger(S.at('chips'), i, 0.06, 5), rise = (S.lt - t0) * 18 * S.u * depth - 30 * S.u;
        const kind = i === 0 && num ? 'num' : ['int', 'pct', 'k', 'plus', 'int', 'ms'][i % 6], r = rand(i * 7 + 3);
        const spec = kind === 'num' ? { to: num.v, from: typeof num.v === 'number' ? num.v * 0.6 : 0, unit: num.suf, prefix: num.pre, dec: num.dec, label: num.label || it[0], rate: 0 }
          : kind === 'pct' ? { to: 90 + r * 9, from: 80, unit: '%', dec: 1, rate: 0.4 } : kind === 'k' ? { to: 4000 + Math.round(r * 16000), from: 1000, unit: '', rate: 37 }
          : kind === 'plus' ? { to: 100 + Math.round(r * 40), from: 60, prefix: '+', unit: '', rate: 3 } : kind === 'ms' ? { to: 200 + Math.round(r * 300), from: 900, unit: 'ms', rate: -4 } : { to: 10 + Math.round(r * 30), from: 2, unit: '', rate: 1.5 };
        L.get('ui:mono-counter-chip').draw(S, { x: p.x, y: p.y - rise, t0, depth, blur: depth < 0.8 ? 2.4 * S.u : 0, px: 84 * S.u, count: [spec.from, spec.to], unit: spec.unit, prefix: spec.prefix, dec: spec.dec != null ? spec.dec : 0, rate: spec.rate, label: spec.label || it[(i + 1) % it.length] });
      });
      [[0.12, 0.9, 1], [0.86, 0.15, 2], [0.93, 0.78, 3]].forEach(([fx, fy, j]) => { const t0 = S.at('chips') + j * 0.1; if (S.lt < t0) return; c.save(); c.globalAlpha *= 0.5; L.get('ui:mono-counter-chip').draw(S, { x: S.W * fx + Math.sin(S.lt * 0.6 + j) * 10 * S.u, y: S.H * fy - (S.lt - t0) * 70 * S.u, t0, depth: 1.6, blur: 9 * S.u, px: 84 * S.u, count: [10 * j, 40 * j + 7], label: it[j % it.length] }); c.restore(); });
      L.get('ui:people-badge-disc').draw(S, { x: cx, y: cy, r: br, t0: S.at('badge') });
      L.headline(S, { px: headPx(S, b, wide ? 88 : 80), maxW: S.W * (wide ? 0.7 : 0.86), x: cx, y: headTop, align: 'center', maxLines: 2 });
    },
  });

  /* week crosshair: a hairline crosshair, a mono week counter stepping up above the centre, accent version tags
     sliding along the line past a red dot; the line builds at the bottom left, then one word takes the centre */
  L.def('insert:week-crosshair-tags', {
    kind: 'setup',
    plan(b, F) {
      const tp = T(b, F, 0.3), word = Math.max(1.6, tp.done + 0.55), n = 7;
      const ev = [{ at: 0.05, event: 'ui-reveal' }, ...tp.events, ...Array.from({ length: n }, (_, i) => ({ at: 0.35 + i * 0.35, event: 'list-item' })), { at: word, event: 'key-word' }];
      return { cues: { cross: 0, head: 0.3, headDone: tp.done, word, tags: 0.35 }, events: ev, exit: { kind: 'dot', x: 0.5, y: 0.5, r: 0.006 }, entry: { kind: 'dot', x: 0.5, y: 0.5, r: 0.006 }, min: word + 1.2 };
    },
    draw(S) {
      const c = S.ctx, b = S.b, wide = isWide(S), cx = S.W / 2, cy = S.H * 0.5, it = itemsOf(b);
      crosshair(S, cx, cy, E.out(prog(S.lt, 0, 0.8)), { plus: false, a: 0.12 });
      const wk = Math.min(52, 1 + Math.floor(Math.max(0, S.lt - 0.2) * 6.5));
      mono(S, `week ${String(wk).padStart(2, '0')}`, cx, cy - S.H * 0.2, 34 * S.u, { upper: true, align: 'center', color: S.P.fg, tracking: 0.12 });
      L.circle(c, cx, cy, 6 * S.u, S.P.accent);
      // tags: spawn at the right edge every 0.35 s and slide left along the line (the newest is solid, older ones outline)
      const speed = S.W * 0.3, px = 22 * S.u;
      for (let i = 0; i < 18; i++) {
        const sp = S.at('tags') + (i - 5) * 0.35; if (S.lt < sp) break;
        const x = S.W + 20 * S.u - (S.lt - sp) * speed, lab = `v${1 + Math.floor(i / 4)}.${i % 4} · ${it[i % it.length]}`;
        const tw = L.textW(c, S.look, lab, { role: 'micro', px, upper: true }) + px * 1.6, below = i % 2 === 1, y = below ? cy + 24 * S.u : cy - 24 * S.u - px * 1.8;
        if (x + tw < -10 || x > S.W + tw) continue;
        const near = clamp(1 - Math.abs(x + tw / 2 - cx) / (S.W * 0.5));
        c.save(); c.globalAlpha *= 0.55 + near * 0.45;
        if (!below) { L.rr(c, x, y, tw, px * 1.8, 5 * S.u); c.fillStyle = S.look.accent; c.fill(); c.strokeStyle = mix(S.look.accent, '#000000', 0.2); c.lineWidth = 1; c.stroke(); mono(S, lab, x + px * 0.8, y + px * 1.26, px, { upper: true, color: L.onColor(S.look.accent) }); }
        else { L.rr(c, x, y, tw, px * 1.8, 5 * S.u); c.fillStyle = sheet(S); c.fill(); c.strokeStyle = rgba(S.P.fg, 0.14); c.lineWidth = 1; c.stroke(); mono(S, lab, x + px * 0.8, y + px * 1.26, px, { upper: true, color: S.P.fg }); }
        c.restore();
      }
      // the line at the bottom left, then the one word at the centre
      const wk2 = E.out(prog(S.lt, S.at('word'), 0.45)), out = 1 - E.in(prog(S.lt, S.at('word') - 0.1, 0.25));
      if (out > 0) { c.save(); c.globalAlpha *= out; L.headline(S, { px: headPx(S, b, wide ? 84 : 76), maxW: S.W * 0.84, x: S.W * 0.08, y: S.H * 0.8, align: 'left', maxLines: 2 }); c.restore(); }
      if (wk2 > 0) {
        const wd = accentWords(b), wpx = Math.min(150 * S.u * (isTall(S) ? 0.85 : 1), S.W * 0.8 / Math.max(3, wd.length * 0.55));
        c.save(); c.globalAlpha *= wk2; scaleAbout(c, cx, cy, lerp(1.04, 1, wk2));
        const tw = L.textW(c, S.look, wd, { role: 'display', px: wpx });
        c.fillStyle = S.P.bg; c.fillRect(cx - tw / 2 - 50 * S.u, cy - wpx * 0.85, tw + 100 * S.u, wpx * 1.2);
        L.text(c, S.look, wd, cx, cy + wpx * 0.24, { role: 'display', px: wpx, color: S.P.fg, align: 'center', maxW: S.W * 0.86 });
        c.restore();
      }
    },
  });

  /* watched black box: an ink square with a blinking caret; eyes open around it and multiply into a field, all
     turning to look; the box shrinks and turns into a glowing accent tile with the key word */
  L.def('insert:watched-black-box', {
    kind: 'setup',
    plan(b, F) {
      const eyes = 0.75, shrink = 2.1, tp = T(b, F, 0.15);
      return { cues: { box: 0, eyes, shrink, tile: shrink + 0.5, head: 0.15, headDone: tp.done }, events: [{ at: 0, event: 'ui-reveal' }, ...tp.events, { at: eyes, event: 'build' }, { at: eyes + 0.4, event: 'cascade' }, { at: shrink + 0.5, event: 'key-word' }], exit: { kind: 'rect', x: 0.5, y: 0.45, w: 0.07, h: 0.12 }, entry: { kind: 'rect', x: 0.5, y: 0.45, w: 0.25, h: 0.44 }, min: shrink + 1.6 };
    },
    draw(S) {
      const c = S.ctx, b = S.b, cx = S.W / 2, cy = S.H * 0.45, big = Math.min(S.H * 0.44, S.W * 0.6), small = Math.min(S.H, S.W) * 0.13;
      const sk = E.io(prog(S.lt, S.at('shrink'), 0.6)), side = lerp(big, small, sk), capY = S.H * 0.86;
      eyeField(S, { tx: () => cx, ty: () => cy, t0: S.at('eyes'), spread: 0.8, mask: (x, y) => { const dx = Math.abs(x - cx) - side * 0.5, dy = Math.abs(y - cy) - side * 0.5, d = Math.max(dx, dy); const cap = Math.abs(y - capY) < 70 * S.u && Math.abs(x - cx) < S.W * 0.4 ? 0 : 1; return clamp(d / (60 * S.u)) * cap; } });
      if (S.lt < S.at('tile')) L.get('ui:black-box-caret').draw(S, { x: cx, y: cy, side, t0: S.at('box') });
      else L.get('ui:glow-label-tile').draw(S, { x: cx, y: cy, side: small, t0: S.at('tile') - 0.02, label: accentWords(b) });
      L.headline(S, { px: headPx(S, b, 64), maxW: S.W * 0.78, x: cx, y: capY - 46 * S.u, align: 'center', maxLines: 1 });
    },
  });

  /* mark line-draw: the brand's mark draws itself as one thin line, fills grey then ink, and the serif wordmark rises */
  L.def('insert:mark-line-draw-reveal', {
    kind: 'setup',
    plan(b) { return { cues: { draw: 0.05, fill: 0.6, word: 0.95, sub: 1.35, head: 1.35, headDone: 1.8 }, events: [{ at: 0.05, event: 'build' }, { at: 0.6, event: 'accent' }, { at: 0.95, event: 'cta' }], exit: { kind: 'rect', x: 0.5, y: 0.42, w: 0.12, h: 0.2 }, entry: { kind: 'dot', x: 0.5, y: 0.42, r: 0.012 }, min: 2.6 }; },
    draw(S) {
      const c = S.ctx, b = S.b, B = brand(), cx = S.W / 2, s = Math.min(S.W, S.H) * 0.3, cy = S.H * 0.4 - s * 0.1;
      const k = E.io(prog(S.lt, S.at('draw'), 0.5)), f = E.out(prog(S.lt, S.at('fill'), 0.32)), push = 1 + S.lt * 0.012;
      c.save(); scaleAbout(c, cx, cy, push);
      for (let i = 0; i < 6; i++) { const rr0 = s * 0.8 + ((S.lt * 60 * S.u + i * 90 * S.u) % (540 * S.u)), a = clamp(f) * (1 - (rr0 - s * 0.8) / (540 * S.u)) * 0.5; const n = Math.floor(rr0 / (14 * S.u)); c.fillStyle = rgba(S.P.fg, a); for (let j = 0; j < n; j++) { const an = j / n * Math.PI * 2 + i; c.beginPath(); c.arc(cx + Math.cos(an) * rr0, cy + Math.sin(an) * rr0, 1.6 * S.u, 0, Math.PI * 2); c.fill(); } }
      drawMark(S, cx, cy, s, k, { fill: f, letter: E.out(prog(S.lt, S.at('fill') + 0.18, 0.3)) });
      const wk = E.out(prog(S.lt, S.at('word'), 0.6)), wpx = Math.min(s * 0.5, S.W * 0.6 / Math.max(4, B.name.length * 0.48));
      if (wk > 0) { c.save(); c.globalAlpha *= wk; serif(S, B.name, cx, cy + s * 0.5 + wpx * 1.25 + (1 - wk) * 16 * S.u, wpx, { color: mix(mix(S.P.bg, S.P.fg, 0.5), S.P.fg, wk), align: 'center', maxW: S.W * 0.8 }); c.restore(); }
      c.restore();
      const line = (b.text && b.text.sub) || B.tagline;
      if (line) L.subDraw && L.subDraw(S, line, cx, cy + s * 0.5 + wpx * 1.85, S.W * 0.6, 'center', 34);
    },
  });

  /* CLI pill → serif answer: a black command pill types a request, a status chip lands, and the product's answer
     rises below in the italic serif voice, line by line */
  L.def('insert:cli-pill-serif-answer', {
    kind: 'setup',
    plan(b, F) {
      const cmd = (b.data && b.data.prompt) || 'ship the release notes', typed = 0.35 + cmd.length / 25, ans = typed + 0.6, tp = L.get('effect:type-serif-output-lines').plan(b, F, ans);
      return { cues: { pill: 0, typed, head: ans, headDone: tp.done }, events: [{ at: 0, event: 'click-ui' }, { at: 0.35, event: 'code' }, { at: typed + 0.12, event: 'notify' }, ...tp.events], exit: { kind: 'rect', x: 0.5, y: 0.6, w: 0.74, h: 0.6 }, entry: { kind: 'pill', x: 0.5, y: 0.46, w: 0.46, h: 0.06 }, min: tp.done + 1.0 };
    },
    draw(S) {
      const b = S.b, wide = isWide(S), tall = isTall(S), cx = S.W / 2;
      const c = S.ctx, it = itemsOf(b), dock = E.io(prog(S.lt, S.at('pill') + 0.25, 0.7));
      const sw = S.W * (wide ? 0.74 : 0.88), sh = S.H * (tall ? 0.5 : 0.6), sx = cx - sw / 2, sy = lerp(S.H * 1.05, S.H * (tall ? 0.3 : 0.3), dock);
      const pw = Math.min(S.W * (wide ? 0.46 : 0.86), 980 * S.u), py = lerp(S.H * 0.46, sy, dock);
      if (dock > 0) { // the sheet: header row (mono), the serif answer, a footer of the brand's features as mono tags
        c.save(); if (dock < 0.98) c.filter = `blur(${((1 - dock) * 10 * S.u).toFixed(1)}px)`;
        softCard(S, sx, sy, sw, sh + 40 * S.u, 22 * S.u, { fill: dk(S) ? S.P.card : mix(S.P.bg, '#FFFFFF', 0.82), lift: 1.2 });
        const pad = sw * 0.05, mp = 19 * S.u;
        mono(S, `draft · ${hex7(brand().name)}`, sx + pad, sy + pad + 36 * S.u, mp, { upper: true });
        L.line(c, sx + pad, sy + pad + 62 * S.u, sx + sw - pad, sy + pad + 62 * S.u, rgba(S.P.fg, 0.08), 1);
        { const sa = 1 - E.out(prog(S.lt, S.at('head') - 0.1, 0.3)); if (sa > 0) for (let i = 0; i < 4; i++) { const sh2 = 1 - Math.abs(((S.lt * 0.9 + i * 0.13) % 1.4) - 0.7); L.rr(c, sx + pad, sy + sh * (0.28 + i * 0.13), (sw - pad * 2) * [0.82, 0.94, 0.7, 0.5][i], sh * 0.07, sh * 0.02); c.fillStyle = rgba(S.P.fg, (0.04 + sh2 * 0.04) * sa); c.fill(); } }
        let tx = sx + pad; it.slice(0, 4).forEach((s2, i) => { const k = pop(S, S.at('headDone') + 0.1 + i * 0.08, 'firm'); if (k <= 0.01) return; const w2 = L.textW(c, S.look, s2, { role: 'micro', px: mp, upper: true }) + mp * 1.6; if (tx + w2 > sx + sw - pad) return; c.save(); c.globalAlpha *= clamp(k); L.pill(c, tx, sy + sh - mp * 3.2, w2, mp * 2, i === 0 ? rgba(S.look.accent, 0.12) : rgba(S.P.fg, 0.05)); mono(S, s2, tx + w2 / 2, sy + sh - mp * 1.82, mp, { upper: true, align: 'center', color: i === 0 ? S.P.accent : S.P.dim }); c.restore(); tx += w2 + 12 * S.u; });
        c.restore();
      }
      L.get('ui:terminal-command-pill').draw(S, { x: cx, y: py, w: pw, t0: S.at('pill'), cmd: (b.data && b.data.prompt) || 'ship the release notes' });
      if (dock > 0.6) L.headline(S, { px: headPx(S, b, wide ? 116 : tall ? 140 : 110), maxW: sw * 0.88, x: sx + sw * 0.05, y: sy + sh * 0.22, align: 'left', maxLines: 3, lineH: 1.12 }, { tokens: serifTokens(b), type: 'effect:type-serif-output-lines' });
    },
  });

  /* focus-pull post pair: two draft cards rise out of a heavy blur and settle sharp, the second a beat later */
  L.def('insert:focus-pull-post-pair', {
    kind: 'setup',
    plan(b, F) { const tp = T(b, F, 0.05); return { cues: { head: 0.05, headDone: tp.done, cards: 0.35 }, events: [...tp.events, { at: 0.35, event: 'card-in' }, { at: 0.55, event: 'card-in' }, { at: 1.3, event: 'pop' }], exit: { kind: 'rect', x: 0.5, y: 0.62, w: 0.6, h: 0.4 }, min: 2.6 }; },
    draw(S) {
      const c = S.ctx, b = S.b, wide = isWide(S), tall = isTall(S), it = itemsOf(b), cx = S.W / 2;
      const lay = L.headline(S, { px: headPx(S, b, wide ? 80 : 74), maxW: S.W * (wide ? 0.72 : 0.86), x: cx, y: S.H * (tall ? 0.08 : 0.1), align: 'center', maxLines: 2 });
      const top = (lay ? lay.bottom : S.H * 0.2) + 50 * S.u;
      const cw = wide ? Math.min(S.W * 0.43, 880 * S.u) : S.W * 0.84, ch = Math.min(wide ? cw * 0.66 : cw * 0.5, (S.H - top) * (wide ? 0.88 : 0.42));
      { const k = E.out(prog(S.lt, S.at('cards') - 0.15, 0.8)); if (k > 0) { c.save(); c.globalAlpha *= 0.55 * k; c.filter = `blur(${(7 * S.u).toFixed(1)}px)`; c.translate(cx, top + ch * 0.55); c.rotate(-0.05); c.scale(0.9, 0.9); L.get('ui:post-draft-card').draw(S, { x: 0, y: -ch * 0.12 + (1 - k) * 120 * S.u - S.lt * 6 * S.u, w: cw * 1.1, h: ch, label: it[2 % it.length], body: it.join(' · '), count: '212 / 280' }); c.restore(); } }
      const sub = (b.text && b.text.sub) || toks(b).map(t => t.s).join(' ');
      [0, 1].forEach(i => {
        const t0 = S.at('cards') + i * 0.2, k = E.out(prog(S.lt, t0, 0.6)); if (k <= 0) return;
        const x = wide ? cx + (i ? 1 : -1) * (cw / 2 + 18 * S.u) : cx, y = (wide ? top + ch / 2 + 10 * S.u : top + ch / 2 + i * (ch + 30 * S.u)) + (1 - k) * 220 * S.u + Math.sin(S.lt * 1.4 + i) * 3 * S.u;
        c.save(); c.globalAlpha *= clamp(k * 1.6); if (k < 0.98) c.filter = `blur(${((1 - k) * 12 * S.u).toFixed(1)}px)`;
        L.get('ui:post-draft-card').draw(S, { x, y, w: cw, h: ch, label: it[i % it.length], body: i === 0 ? sub : it.slice(1, 4).join(' · '), count: `${80 + (L.hash(it[i % it.length]) % 160)} / 280`, shipAt: S.at('cards') + 0.95 + i * 0.15 });
        c.restore();
      });
    },
  });

  /* spiral crowd compare: a few dots in the centre become hundreds on a golden-angle spiral while one small number,
     a connector and a big number land on the left, centre and right of the frame */
  L.def('insert:spiral-crowd-compare', {
    kind: 'setup',
    plan(b) { return { cues: { spiral: 0.3, a: 0.55, b: 0.9, c: 1.25, head: 1.6, headDone: 2.1 }, events: [{ at: 0.3, event: 'build' }, { at: 0.55, event: 'stat' }, { at: 0.9, event: 'word' }, { at: 1.25, event: 'key-word' }], exit: { kind: 'dot', x: 0.5, y: 0.5, r: 0.008 }, entry: { kind: 'dot', x: 0.5, y: 0.5, r: 0.006 }, min: 2.6 }; },
    draw(S) {
      const c = S.ctx, b = S.b, tall = isTall(S), cx = S.W / 2, cy = S.H / 2, tk = toks(b), n = numParts(b.data && b.data.number);
      spiral(S, cx, cy, prog(S.lt, S.at('spiral'), 1.0), { squash: tall ? 1 : 0.92 });
      // the trio: the line's own three words when it has three, else 1 → the number
      let trio = null;
      if (tk.length === 3) trio = tk.map(t => t.s);
      else if (n) trio = ['1', '→', `${n.pre}${typeof n.v === 'number' ? fmt(n.v, n.dec) : n.v}${n.suf}`];
      else trio = [tk[0] ? tk[0].s : '1', '→', accentWords(b) || 'all'];
      const px = Math.min(200 * S.u, S.W * (tall ? 0.17 : 0.12)), y = cy + px * 0.34, m = S.W * (tall ? 0.07 : 0.08);
      const pos = [[m, 'left'], [cx, 'center'], [S.W - m, 'right']];
      trio.forEach((s, i) => {
        const at = S.at(['a', 'b', 'c'][i]), k = E.out(prog(S.lt, at, 0.4)); if (k <= 0) return;
        const col = i === 2 ? mix(mix(S.P.bg, S.look.accent, 0.35), S.P.accent, E.out(prog(S.lt, at + 0.25, 0.4))) : S.P.fg;
        c.save(); c.globalAlpha *= k;
        const tw = L.textW(c, S.look, s, { role: 'display', px }); const x0 = pos[i][1] === 'left' ? pos[i][0] : pos[i][1] === 'right' ? pos[i][0] - tw : pos[i][0] - tw / 2;
        const g = c.createRadialGradient(x0 + tw / 2, y - px * 0.35, 0, x0 + tw / 2, y - px * 0.35, Math.max(tw, px) * 0.9); g.addColorStop(0, rgba(S.P.bg, 0.95)); g.addColorStop(1, rgba(S.P.bg, 0)); c.fillStyle = g; c.fillRect(x0 - px, y - px * 1.6, tw + px * 2, px * 2.4);
        if (s === '→') L.icon(c, 'arrowRight', cx, y - px * 0.34, px * 0.8, S.P.fg, 1.6);
        else L.text(c, S.look, s, pos[i][0], y + (1 - k) * 20 * S.u, { role: 'display', px, color: col, align: pos[i][1], maxW: S.W * 0.36 });
        c.restore();
      });
      if (n && n.label) { const k = E.out(prog(S.lt, S.at('head'), 0.5)); if (k > 0) { c.save(); c.globalAlpha *= k; mono(S, n.label, S.W - m, y + px * 0.55, 20 * S.u, { upper: true, align: 'right', color: S.P.fg }); c.restore(); } }
      if (tk.length !== 3 && tk.length) { const k = E.out(prog(S.lt, S.at('head'), 0.5)); if (k > 0) L.headline(S, { px: 56 * S.u, maxW: S.W * 0.7, x: cx, y: S.H * (tall ? 0.18 : 0.12), align: 'center', maxLines: 2 }); }
    },
  });

  /* peach-sky dashboard: a calm product dashboard under a soft accent-tinted sky: mono tabs, big ticking counters,
     thin meters, the AI's suggestion card typing a reply, and an approve bar the cursor confirms */
  L.def('insert:peach-sky-dashboard', {
    kind: 'setup',
    plan(b) {
      const reply = (b.data && b.data.prompt) || '', card = 0.3, typeAt = card + 0.9, approve = Math.max(2.4, typeAt + Math.min(reply.length, 60) / 30 + 0.3), click = approve + 0.75;
      return { cues: { tabs: 0.05, counters: 0.25, card, typeAt, approve, click, head: card + 0.25, headDone: card + 0.8, focusIn: approve - 0.2 }, events: [{ at: 0.05, event: 'ui-reveal' }, { at: 0.25, event: 'stat' }, { at: card, event: 'card-in' }, { at: typeAt, event: 'code' }, { at: approve, event: 'slide-out' }, { at: click, event: 'click-ui' }, { at: click + 0.1, event: 'cta' }], exit: { kind: 'pill', x: 0.5, y: 0.86, w: 0.44, h: 0.08 }, min: click + 0.9 };
    },
    draw(S) {
      const c = S.ctx, b = S.b, d = b.data || {}, it = itemsOf(b), tall = isTall(S), wide = isWide(S), num = numParts(d.number);
      const g = c.createLinearGradient(0, 0, 0, S.H * 0.5); g.addColorStop(0, mix(S.P.bg, S.look.accent, dk(S) ? 0.22 : 0.16)); g.addColorStop(1, rgba(S.P.bg, 0)); c.fillStyle = g; c.fillRect(0, 0, S.W, S.H * 0.5);
      const m = S.W * (tall ? 0.07 : 0.06), top = S.H * (tall ? 0.06 : 0.08), mp = 24 * S.u;
      const tk = appear(S, S.at('tabs'), 0.4);
      c.save(); c.globalAlpha *= tk;
      const w0 = mono(S, it[0], m, top, mp, { upper: true, color: S.P.fg, weight: 700 }); mono(S, it[1] || '', m + w0 + mp * 2, top, mp, { upper: true });
      L.line(c, m, top + mp * 0.8, m + w0 * E.out(prog(S.lt, S.at('tabs') + 0.2, 0.4)), top + mp * 0.8, S.P.fg, 2 * S.u);
      c.restore();
      // counters
      const click = S.at('click'), bump = S.lt >= click ? 1 : 0, cy = top + S.H * (tall ? 0.09 : 0.13), cpx = 84 * S.u * (tall ? 0.85 : 1);
      const counters = [{ label: (num && num.label) || it[2] || 'done', v: num && typeof num.v === 'number' ? num.v : 7, suf: num ? num.suf : '', dec: num ? num.dec : 0 }, { label: it[3] || it[1] || 'queued', v: 15, suf: '', dec: 0 }];
      let cxp = m;
      counters.forEach((ct, i) => {
        const k = appear(S, S.at('counters') + i * 0.12, 0.45); if (k <= 0) return;
        c.save(); c.globalAlpha *= k;
        const lw = mono(S, ct.label, cxp, cy, mp * 0.85, { upper: true, maxW: S.W * 0.2 });
        const v = tick(S, S.at('counters') + i * 0.12, 0, ct.v, 0.9) + (i === 0 ? bump * (ct.dec ? 0.1 : 1) : 0);
        const s = fmt(v, ct.dec) + ct.suf, pk = i === 0 && bump ? 1 + Math.exp(-(S.lt - click) * 9) * 0.12 : 1;
        c.save(); scaleAbout(c, cxp + lw + mp, cy, pk); const nw = L.text(c, S.look, s, cxp + lw + mp, cy + cpx * 0.08, { role: 'micro', px: cpx, color: S.P.fg, tracking: -0.03 }); c.restore();
        cxp += lw + mp + nw + mp * 3; c.restore();
      });
      // meters on the right (wide) / under the counters (tall)
      const mx = !wide ? m : S.W * 0.6, my = !wide ? cy + cpx * 0.9 : cy - mp * 0.6, mw = !wide ? S.W - 2 * m : S.W * 0.34;
      [0, 1].forEach(i => {
        const k = appear(S, S.at('counters') + 0.3 + i * 0.12, 0.5); if (k <= 0) return;
        const yy = my + i * mp * 2.4, fill = [0.66, 0.4][i] * E.out(prog(S.lt, S.at('counters') + 0.4 + i * 0.12, 0.9));
        c.save(); c.globalAlpha *= k;
        mono(S, it[(i + 4) % it.length], mx, yy, mp * 0.8, { upper: true, maxW: mw * 0.45 }); mono(S, `${Math.round(fill * 12)} / 12`, mx + mw, yy, mp * 0.8, { align: 'right' });
        L.line(c, mx, yy + mp * 0.7, mx + mw, yy + mp * 0.7, rgba(S.P.fg, 0.12), 1); L.line(c, mx, yy + mp * 0.7, mx + mw * fill, yy + mp * 0.7, S.P.fg, 2 * S.u);
        c.restore();
      });
      // the suggestion card (bleeds off the bottom) and the approve bar
      const cw = S.W * (wide ? 0.8 : 0.88), cardTop = S.H * (tall ? 0.34 : wide ? 0.38 : 0.42), chh = S.H * 1.04 - cardTop;
      L.get('ui:serif-suggestion-card').draw(S, { x: S.W / 2, y: cardTop + chh / 2, w: cw, h: chh, t0: S.at('card'), meta: it[0], step: '1 / 7', title: serifTokens(b), body: (b.text && b.text.sub) || '', reply: d.prompt || '', typeAt: S.at('typeAt'), replyLabel: it[1] || 'reply', titlePx: tall ? 84 * S.u : Math.min(68 * S.u, cw * 0.055) });
      const bar = L.get('ui:approve-action-bar').draw(S, { x: S.W / 2, y: S.H * 0.86, w: Math.min(S.W * (wide ? 0.42 : 0.84), 820 * S.u), t0: S.at('approve'), click });
      if (bar) L.cursorDraw(S, [[S.at('approve') + 0.1, 0.72, 0.98], [click - 0.04, bar.button.x / S.W + 0.01, bar.button.y / S.H + 0.01], [S.d + 1, bar.button.x / S.W + 0.05, bar.button.y / S.H + 0.08]], [click]);
    },
  });

  /* blank composer → settings: an empty skeleton post with a blinking caret; the box grows into a wide settings
     window whose serif title is the line, fields fill in the accent and the voice line types itself */
  L.def('insert:blank-composer-to-settings', {
    kind: 'setup',
    plan(b) { return { cues: { box: 0.05, grow: 1.2, win: 1.6, head: 1.6, headDone: 2.0 }, events: [{ at: 0.05, event: 'card-in' }, { at: 1.2, event: 'build' }, { at: 2.2, event: 'click-ui' }, { at: 2.4, event: 'word' }, { at: 3.1, event: 'code' }], entry: { kind: 'rect', x: 0.5, y: 0.5, w: 0.36, h: 0.16 }, exit: { kind: 'rect', x: 0.5, y: 0.5, w: 0.86, h: 0.82 }, min: 4.2 }; },
    draw(S) {
      const c = S.ctx, tall = isTall(S), wide = isWide(S), cx = S.W / 2, cy = S.H / 2;
      const g = E.io(prog(S.lt, S.at('grow'), 0.45));
      const w0 = S.W * (wide ? 0.36 : 0.72), h0 = w0 * 0.44, w1 = S.W * (wide ? 0.88 : 0.9), h1 = S.H * (tall ? 0.72 : 0.84);
      const w = lerp(w0, w1, g), h = lerp(h0, h1, g);
      if (g < 0.05) L.get('ui:skeleton-post-composer').draw(S, { x: cx, y: cy, w: w0, h: h0, t0: S.at('box') });
      else L.get('ui:settings-voice-window').draw(S, { x: cx, y: cy, w, h, t0: S.at('win'), morph: g });
    },
  });

  /* dot streams in sync: two vertical streams of dots, each labelled with a team in vertical mono, drift apart,
     then slide together onto one accent thread threaded with ink beads, an italic serif pill at its middle */
  L.def('insert:dot-streams-in-sync', {
    kind: 'setup',
    plan(b, F) { const tp = T(b, F, 0.1), merge = 1.5; return { cues: { head: 0.1, headDone: tp.done, apart: 0.3, merge, pill: merge + 0.45 }, events: [...tp.events, { at: 0.3, event: 'slide-out' }, { at: merge + 0.3, event: 'build' }, { at: merge + 0.45, event: 'pop' }], exit: { kind: 'pill', x: 0.62, y: 0.5, w: 0.16, h: 0.08 }, min: merge + 1.6 }; },
    draw(S) {
      const c = S.ctx, b = S.b, wide = isWide(S), tall = isTall(S), it = itemsOf(b);
      const lx = wide ? S.W * 0.62 : S.W / 2, pitch = 46 * S.u, dot = 5.5 * S.u, v = 300 * S.u;
      const apart = E.io(prog(S.lt, S.at('apart'), 0.9)), merge = E.io(prog(S.lt, S.at('merge'), 0.6));
      const sep = lerp(lerp(40, 240, apart), 0, merge) * S.u * (wide ? 1 : 0.8);
      const y0 = tall ? S.H * 0.3 : wide ? 0 : S.H * 0.26, y1 = S.H;
      const lineK = E.out(prog(S.lt, S.at('merge') + 0.3, 0.45));
      [[wide ? 0.86 : 0.1, 0.5, 0.2], [wide ? 0.94 : 0.9, 0.36, 0.14], [wide ? 0.42 : 0.04, 0.42, 0.1]].forEach(([fx, sp, a], j) => { const x = S.W * fx + Math.sin(S.lt * 0.5 + j) * 6 * S.u, off = (S.lt * v * sp + j * 17 * S.u) % (pitch * 0.7); c.save(); c.globalAlpha *= a * appear(S, 0.1 + j * 0.1, 0.6); c.filter = `blur(${(2 + j) * S.u}px)`; c.fillStyle = dk(S) ? S.P.fg : inkOf(S); for (let y = -pitch + off; y < S.H + pitch; y += pitch * 0.7) { c.beginPath(); c.arc(x, y, dot * 0.7, 0, Math.PI * 2); c.fill(); } c.restore(); });
      if (lineK > 0) { c.save(); c.shadowColor = rgba(S.look.accent, 0.3); c.shadowBlur = 12 * S.u; L.line(c, lx, lerp(S.H / 2, y0, lineK), lx, lerp(S.H / 2, y1, lineK), S.look.accent, 4 * S.u); c.restore(); }
      [-1, 1].forEach((side, si) => {
        const x = lx + side * sep / 2, off = (S.lt * v * (si ? 1 : 1.0) + si * pitch / 2) % pitch;
        for (let y = y0 - pitch + off; y < y1 + pitch; y += pitch) {
          if (lineK > 0.5 && si === 1) { // after the merge: beads ride the thread
            const bw = 22 * S.u, bh = 16 * S.u, idx = Math.round((y - off) / pitch);
            if (idx % 3 === 0) { L.rr(c, x - bw / 2, y - bh / 2, bw, bh, bh * 0.4); c.fillStyle = dk(S) ? S.P.fg : inkOf(S); c.fill(); }
            continue;
          }
          L.circle(c, x, y, dot, dk(S) ? S.P.fg : inkOf(S));
        }
        const lab = it[si % it.length], la = (1 - merge) * appear(S, 0.2, 0.5);
        if (la > 0.02) { c.save(); c.globalAlpha *= la; c.translate(x + side * 40 * S.u, S.H * (tall ? 0.62 : 0.52)); c.rotate(side < 0 ? -Math.PI / 2 : Math.PI / 2); mono(S, lab, 0, 0, 24 * S.u, { align: 'center', color: S.P.fg, upper: true }); c.restore(); }
      });
      // the in-sync pill
      const pk = pop(S, S.at('pill'));
      if (pk > 0.01) {
        const lab = accentWords(b) || 'in sync', ppx = 46 * S.u, tw = L.textW(c, S.look, lab, { role: 'accent', px: ppx }), pw = tw + ppx * 1.4, ph = ppx * 1.6, py = S.H * (tall ? 0.62 : 0.5);
        c.save(); scaleAbout(c, lx, py, clamp(pk, 0, 1.15));
        softCard(S, lx - pw / 2, py - ph / 2, pw, ph, ph / 2, { lift: 0.9 });
        serif(S, lab, lx, py + ppx * 0.32, ppx, { color: S.P.accent, align: 'center' });
        c.restore();
      }
      // the line
      if (wide) L.headline(S, { px: headPx(S, b, 92), maxW: S.W * 0.4, x: S.W * 0.07, y: S.H * 0.36, align: 'left', maxLines: 3 });
      else L.headline(S, { px: headPx(S, b, 84), maxW: S.W * 0.86, x: S.W / 2, y: S.H * (tall ? 0.08 : 0.06), align: 'center', maxLines: 2 });
    },
  });

  /* crosshair commit ticker: dots step down one side of a hairline crosshair while mono commit cards slide in on
     the other, an accent arm flicking out to each new card */
  L.def('insert:crosshair-commit-ticker', {
    kind: 'setup',
    plan(b, F) { const tp = T(b, F, 0.1), n = 5; return { cues: { head: 0.1, headDone: tp.done, cross: 0, ticks: 0.4 }, events: [...tp.events, ...Array.from({ length: n }, (_, i) => ({ at: 0.4 + i * 0.5, event: 'list-item' }))], exit: { kind: 'dot', x: 0.5, y: 0.5, r: 0.008 }, min: 0.4 + n * 0.5 + 0.4 }; },
    draw(S) {
      const c = S.ctx, b = S.b, wide = isWide(S), tall = isTall(S), it = itemsOf(b);
      const cx = wide ? S.W * 0.5 : S.W * 0.14, cy = wide ? S.H * 0.5 : S.H * (tall ? 0.55 : 0.6);
      crosshair(S, cx, cy, E.out(prog(S.lt, 0, 0.8)), { a: 0.12 });
      const step = Math.max(0, Math.floor((S.lt - S.at('ticks')) / 0.5) + 3), sub = clamp(((S.lt - S.at('ticks')) % 0.5) / 0.18);
      // dots stepping down beside the line
      for (let i = 0; i < 9; i++) { const yy = cy - 4 * 46 * S.u + (i + E.out(sub) - 1) * 46 * S.u + (step % 2) * 0; L.circle(c, cx - 30 * S.u, yy, 7 * S.u, rgba(dk(S) ? S.P.fg : inkOf(S), clamp(1 - Math.abs(i - 4) / 5))); }
      // the cards: the newest arrives at the top slot, the older ones step down
      const cw = wide ? S.W * 0.38 : S.W * 0.72, chh = 128 * S.u, gap = 20 * S.u, x0 = cx + 60 * S.u, top = cy - (chh + gap) * 1.5 - chh / 2;
      for (let j = 0; j < Math.min(step, 5); j++) {
        const i = step - 1 - j, born = S.at('ticks') + (i - 2) * 0.5, k = E.out(prog(S.lt, born, 0.25));
        const slot = j - (1 - k) * 0.5, y = top + slot * (chh + gap), a = clamp(1 - j * 0.22) * clamp(k * 2);
        if (y > S.H) continue;
        c.save(); c.globalAlpha *= a; c.translate((1 - k) * 60 * S.u, 0);
        L.rr(c, x0, y, cw, chh, 8 * S.u); c.fillStyle = dk(S) ? S.P.card : mix(S.P.bg, '#FFFFFF', 0.85); c.fill(); c.lineWidth = 1.2 * S.u; c.strokeStyle = rgba(S.P.fg, j === 0 ? 0.85 : 0.25); c.stroke();
        const name = it[i % it.length], mp = 19 * S.u;
        mono(S, hex7(name + i), x0 + 26 * S.u, y + 40 * S.u, mp, {});
        mono(S, `+${12 + (L.hash(name) % 90)} −${3 + (L.hash(name + 'x') % 30)}`, x0 + cw - 26 * S.u, y + 40 * S.u, mp, { align: 'right' });
        L.text(c, S.look, name, x0 + 26 * S.u, y + 92 * S.u, { role: 'ui', px: 36 * S.u, weight: 650, color: S.P.fg, maxW: cw - 44 * S.u });
        c.restore();
        if (j === 0) { const ak = E.out(prog(S.lt, born, 0.15)), ay = y + chh / 2; L.line(c, cx, ay, cx + (x0 - cx) * ak, ay, S.look.accent, 2 * S.u); L.circle(c, cx, ay, 4 * S.u, S.look.accent); }
      }
      if (wide) L.headline(S, { px: headPx(S, b, 84), maxW: S.W * 0.36, x: S.W * 0.06, y: S.H * 0.16, align: 'left', maxLines: 3 });
      else L.headline(S, { px: headPx(S, b, 80), maxW: S.W * 0.86, x: S.W / 2, y: S.H * 0.08, align: 'center', maxLines: 2 });
    },
  });

  /* document team hub: one titled sheet in the middle, six labelled team nodes on hairline connectors around it;
     the nodes light in the accent one by one while the sheet's grey lines turn to ink */
  L.def('insert:doc-team-hub', {
    kind: 'setup',
    plan(b, F) { const tp = T(b, F, 2.0); return { cues: { doc: 0.05, wires: 0.35, light: 0.8, head: 2.0, headDone: tp.done }, events: [{ at: 0.05, event: 'card-in' }, { at: 0.35, event: 'build' }, ...Array.from({ length: 6 }, (_, i) => ({ at: 0.8 + i * 0.25, event: 'list-item' })), ...tp.events], exit: { kind: 'rect', x: 0.5, y: 0.42, w: 0.16, h: 0.4 }, entry: { kind: 'rect', x: 0.5, y: 0.42, w: 0.16, h: 0.4 }, min: 3.4 }; },
    draw(S) {
      const c = S.ctx, b = S.b, tall = isTall(S), wide = isWide(S), it = itemsOf(b), cx = S.W / 2, cy = S.H * (tall ? 0.44 : 0.42);
      const dh = S.H * (tall ? 0.3 : 0.46), dw = dh * 0.74, dx = cx - dw / 2, dy = cy - dh / 2;
      const rx = Math.min(S.W * (wide ? 0.36 : 0.27), dw * (wide ? 2.4 : 1.25)), ry = dh * 0.66;
      const nodes = [[-1, 0], [1, 0], [-0.55, -1], [0.55, -1], [-0.55, 1], [0.55, 1]].map(([a, bb]) => ({ x: cx + a * rx, y: cy + bb * ry }));
      const order = [2, 3, 0, 1, 4, 5], lit = i => E.out(prog(S.lt, S.at('light') + order.indexOf(i) * 0.25, 0.25));
      nodes.forEach((n, i) => {
        const wk = E.out(prog(S.lt, S.at('wires') + i * 0.05, 0.4)); if (wk <= 0) return;
        const ex = clamp(n.x, dx, dx + dw), ey = clamp(n.y, dy, dy + dh), l = lit(i);
        L.line(c, ex, ey, lerp(ex, n.x, wk), lerp(ey, n.y, wk), l > 0.5 ? rgba(S.look.accent, 0.8) : rgba(S.P.fg, 0.5), 1.2 * S.u);
        const nk = pop(S, S.at('wires') + 0.3 + i * 0.05, 'firm'); if (nk <= 0.01) return;
        c.save(); if (l > 0) { c.shadowColor = rgba(S.look.accent, 0.4 * l); c.shadowBlur = 16 * S.u; }
        L.circle(c, n.x, n.y, 12 * S.u * clamp(nk, 0, 1.2), mix(dk(S) ? S.P.fg : inkOf(S), S.look.accent, l)); c.restore();
        const lab = it[i % it.length], below = n.y > cy + 1, side = Math.abs(n.x - cx) > rx * 0.9;
        mono(S, lab, side ? n.x + (n.x < cx ? -24 : 24) * S.u : n.x, side ? n.y + 6 * S.u : n.y + (below ? 44 : -28) * S.u, 18 * S.u, { upper: true, align: side ? (n.x < cx ? 'right' : 'left') : 'center', color: l > 0.5 ? S.P.accent : S.P.fg, maxW: side ? (n.x < cx ? n.x - 30 * S.u : S.W - n.x - 30 * S.u) : S.W * 0.3 });
      });
      // the sheet
      const k = E.out(prog(S.lt, S.at('doc'), 0.5));
      c.save(); c.globalAlpha *= clamp(k * 1.6); scaleAbout(c, cx, cy, lerp(0.92, 1, k));
      softCard(S, dx, dy, dw, dh, 8 * S.u, { fill: dk(S) ? S.P.card : '#FFFFFF', lift: 1.2 });
      const title = (b.text && b.text.eyebrow) || accentWords(b) || brand().name, pad = dw * 0.12;
      serif(S, title, dx + pad, dy + pad + dh * 0.05, Math.min(dh * 0.08, dw * 0.13), { maxW: dw - pad * 2 });
      const lights = order.map((_, j) => E.out(prog(S.lt, S.at('light') + j * 0.25, 0.25))).reduce((a, v) => a + v, 0);
      for (let i = 0; i < 9; i++) {
        const ly = dy + pad + dh * 0.15 + i * dh * 0.065, lw = (dw - pad * 2) * [1, 0.86, 0.94, 0.7, 0.9, 0.8, 0.62, 0.88, 0.5][i], on = clamp(lights * 1.5 - i);
        L.rr(c, dx + pad, ly, lw, dh * 0.026, dh * 0.006); c.fillStyle = mix(skel(S), dk(S) ? S.P.fg : inkOf(S), on); c.fill();
      }
      c.restore();
      L.headline(S, { px: headPx(S, b, 60), maxW: S.W * 0.8, x: cx, y: S.H * (tall ? 0.8 : 0.86), align: 'center', maxLines: 1 });
    },
  });

  /* gaze converge: a black disc with a softly glowing accent core shrinks to the centre while a field of eyes turns
     to look at it; its exit is the disc itself (a flood can swell out of it) */
  L.def('insert:gaze-converge-disc', {
    kind: 'setup',
    plan(b, F) { const tp = T(b, F, 1.3); return { cues: { disc: 0, shrink: 0.2, eyes: 0.15, head: 1.3, headDone: tp.done }, events: [{ at: 0, event: 'build' }, { at: 0.2, event: 'slide-out' }, { at: 0.5, event: 'cascade' }, ...tp.events], exit: { kind: 'circle', x: 0.5, y: 0.47, r: 0.09 }, entry: { kind: 'circle', x: 0.5, y: 0.47, r: 0.18 }, min: 2.8 }; },
    draw(S) {
      const c = S.ctx, b = S.b, cx = S.W / 2, cy = S.H * 0.47, r0 = Math.min(S.W, S.H) * 0.19, r1 = Math.min(S.W, S.H) * 0.085;
      const k = E.io(prog(S.lt, S.at('shrink'), 0.7)), r = lerp(r0, r1, k), capY = S.H * 0.88;
      eyeField(S, { tx: () => cx, ty: () => cy, t0: S.at('eyes'), spread: 0.55, mask: (x, y) => { const d = Math.hypot(x - cx, y - cy) - r - 30 * S.u; const cap = Math.abs(y - capY) < 64 * S.u && Math.abs(x - cx) < S.W * 0.36 ? 0 : 1; return clamp(d / (50 * S.u)) * cap; } });
      const ink = dk(S) ? mix(inkOf(S), '#000000', 0.5) : inkOf(S);
      c.save(); c.shadowColor = rgba(inkOf(S), 0.35); c.shadowBlur = 50 * S.u; c.shadowOffsetY = 16 * S.u; L.circle(c, cx, cy, r, ink); c.restore();
      const pulse = 0.7 + Math.sin(S.lt * Math.PI * 2 * 1.2) * 0.3, core = Math.max(9 * S.u, r * 0.09);
      L.bloom(c, cx, cy, core * 4, S.look.accent, 0.35 * pulse); L.circle(c, cx, cy, core, S.look.accent);
      L.headline(S, { px: headPx(S, b, 60), maxW: S.W * 0.7, x: cx, y: capY - 46 * S.u, align: 'center', maxLines: 1 });
    },
  });

  /* ════════════════════════ end card ════════════════════════ */

  /* mark + serif lockup: the mark draws and fills (one accent flash frame on the fill), the serif wordmark, the
     tagline, the address typing in mono; the last frames cut to ink */
  L.def('end_card:mark-serif-url-lockup', {
    kind: 'end',
    plan(b) { const B = brand(); const url = 1.6 + 0.0, done = url + Math.max(0.3, (B.host || '').length / 40); return { cues: { draw: 0.05, flash: 0.55, fill: 0.62, word: 0.95, tag: 1.3, url }, events: [{ at: 0.05, event: 'build' }, { at: 0.55, event: 'hard-hit' }, { at: 0.95, event: 'cta' }, { at: url, event: 'code' }], entry: { kind: 'dot', x: 0.5, y: 0.4, r: 0.012 }, min: done + 1.2 }; },
    draw(S) {
      const c = S.ctx, B = brand(), cx = S.W / 2, s = Math.min(S.W, S.H) * 0.22, cy = S.H * 0.36;
      const fl = S.lt >= S.at('flash') && S.lt < S.at('flash') + 0.07;
      if (fl) { c.fillStyle = S.look.accent; c.fillRect(-S.W, -S.H, S.W * 3, S.H * 3); c.save(); markPath(c, cx, cy, s); c.lineWidth = 2 * S.u; c.strokeStyle = mix(S.look.accent, '#FFFFFF', 0.45); c.stroke(); c.restore(); return; }
      const k = E.io(prog(S.lt, S.at('draw'), 0.5)), f = E.out(prog(S.lt, S.at('fill'), 0.3));
      drawMark(S, cx, cy, s, k, { fill: f, letter: E.out(prog(S.lt, S.at('fill') + 0.15, 0.3)) });
      const wpx = Math.min(s * 0.55, S.W * 0.6 / Math.max(4, B.name.length * 0.48)), wy = cy + s * 0.5 + wpx * 1.3, wk = E.out(prog(S.lt, S.at('word'), 0.55));
      if (wk > 0) { c.save(); c.globalAlpha *= wk; serif(S, B.name, cx, wy + (1 - wk) * 14 * S.u, wpx, { align: 'center', maxW: S.W * 0.8 }); c.restore(); }
      const tk = E.out(prog(S.lt, S.at('tag'), 0.5));
      if (B.tagline && tk > 0) { c.save(); c.globalAlpha *= tk; L.text(c, S.look, B.tagline, cx, wy + wpx * 0.85, { role: 'ui', px: 30 * S.u, color: S.P.fg, align: 'center', maxW: S.W * 0.8 }); c.restore(); }
      const host = B.host || '', n = Math.max(0, Math.min(host.length, Math.floor((S.lt - S.at('url')) * 40)));
      if (n > 0) { const uy = wy + wpx * 0.85 + 62 * S.u, ww = mono(S, host.slice(0, n), cx, uy, 26 * S.u, { align: 'center', color: S.P.dim, tracking: 0.08 }); if (n < host.length || Math.floor(S.lt * 2) % 2 === 0) { c.fillStyle = S.look.accent; c.fillRect(cx + ww / 2 + 4 * S.u, uy - 18 * S.u, 10 * S.u, 22 * S.u); } }
      if (S.d - S.lt < 0.15 && S.d > 3) { c.fillStyle = inkOf(S); c.fillRect(-S.W, -S.H, S.W * 3, S.H * 3); }
    },
  });

  /* ════════════════════════ type treatments ════════════════════════ */

  // shared: draw a word (alpha, offset, optional per-letter alpha)
  function wordAt(S, w, o) { const c = S.ctx; if (o.a <= 0.002) return; c.save(); c.globalAlpha *= clamp(o.a); if (o.blur > 0.35) c.filter = `blur(${o.blur.toFixed(2)}px)`; L.drawWord(c, S.look, S.P, w, { x: w.x + (o.dx || 0), y: w.y + (o.dy || 0), fill: o.fill }); c.restore(); }
  const lineBox = (lay, li) => { const ws = lay.words.filter(w => w.li === li); return { x0: Math.min(...ws.map(w => w.x)), x1: Math.max(...ws.map(w => w.x + w.w)), y: ws[0].y }; };

  /* letter fade: a quiet statement appears letter by letter, each fading up from nothing, 40 ms apart */
  L.def('effect:type-letter-fade-light', {
    kind: 'type',
    plan(b, F, t0 = 0) { const tk = toks(b), ws = []; let ch = 0; for (const t of tk) { ws.push(+(t0 + ch * 0.04).toFixed(3)); ch += t.s.length + 1; } const a = tk.findIndex(t => t.accent); return { words: ws, done: t0 + ch * 0.04 + 0.15, events: [{ at: t0, event: 'word' }, ...(a >= 0 ? [{ at: ws[a] + 0.1, event: 'key-word' }] : [])] }; },
    draw(S, o) {
      const lay = o.lay, c = S.ctx, t0 = o.t0 || 0; let ch = 0;
      for (const w of lay.words) {
        L.setFont(c, S.look, w.role, w.px, w.tk.weight); try { c.letterSpacing = w.tr.toFixed(2) + 'px'; } catch (e) { /* */ }
        const fill = w.tk.accent ? S.P.accent : S.P.fg;
        for (let i = 0; i < w.s.length; i++) {
          const a = clamp((S.lt - t0 - (ch + i) * 0.04) / 0.15); if (a <= 0) break;
          const xx = w.x + c.measureText(w.s.slice(0, i)).width;
          c.save(); c.globalAlpha *= a; c.fillStyle = fill; c.textBaseline = 'alphabetic'; c.textAlign = 'left'; c.fillText(w.s[i], xx, w.y); c.restore();
        }
        ch += w.s.length + 1;
      }
      try { c.letterSpacing = '0px'; } catch (e) { /* */ }
    },
  });

  /* serif output lines: what the product writes; each line rises from behind its own mask 120 ms after the last,
     ink drying from grey, and a fine accent caret waits at the end */
  L.def('effect:type-serif-output-lines', {
    kind: 'type',
    plan(b, F, t0 = 0) { const n = toks(b).length, lines = Math.min(3, Math.max(1, Math.ceil(n / 4))); return { words: Array(n).fill(t0), done: t0 + 0.32 + (lines - 1) * 0.12 + 0.1, events: [{ at: t0, event: 'word' }, { at: t0 + 0.12, event: 'word' }] }; },
    draw(S, o) {
      const lay = o.lay, c = S.ctx, t0 = o.t0 || 0;
      for (let li = 0; li < lay.lines; li++) {
        const bx = lineBox(lay, li), k = E.out(prog(S.lt, t0 + li * 0.12, 0.34)); if (k <= 0) continue;
        c.save(); c.beginPath(); c.rect(bx.x0 - lay.px, bx.y - lay.px * 1.15, bx.x1 - bx.x0 + lay.px * 2, lay.px * 1.5); c.clip();
        const dry = E.out(prog(S.lt, t0 + li * 0.12 + 0.15, 0.5));
        for (const w of lay.words.filter(w => w.li === li)) wordAt(S, w, { a: 1, dy: (1 - k) * lay.px * 0.9, fill: w.tk.accent ? S.P.accent : mix(mix(S.P.bg, S.P.fg, 0.45), S.P.fg, dry) });
        c.restore();
      }
      const last = lay.words[lay.words.length - 1], end = t0 + (lay.lines - 1) * 0.12 + 0.34;
      if (last && S.lt > end && Math.floor((S.lt - end) * 2) % 2 === 0) { c.fillStyle = S.P.accent; c.fillRect(last.x + last.w + lay.px * 0.08, last.y - lay.px * 0.72, Math.max(2, lay.px * 0.035), lay.px * 0.86); }
    },
  });

  /* word step caption: words land one at a time on the beat of a voice (fade + 8 px rise in 0.12 s, no blur),
     the key phrase in the accent, crisp like a subtitle that means it */
  L.def('effect:type-word-step-caption', {
    kind: 'type',
    plan(b, F, t0 = 0) { const n = toks(b).length, ws = L.wordTimes(n, t0, 0.16, 11), a = toks(b).findIndex(t => t.accent); return { words: ws, done: (ws[n - 1] || t0) + 0.14, events: ws.map((w, i) => ({ at: w, event: i === a ? 'key-word' : 'word' })) }; },
    draw(S, o) {
      const lay = o.lay, ws = L.wordTimes(lay.words.length, o.t0 || 0, 0.16, 11);
      for (const w of lay.words) { const k = E.out(prog(S.lt, ws[w.i], 0.12)); wordAt(S, w, { a: k, dy: (1 - k) * 8 * S.u }); }
    },
  });

  /* VO chunk swap: the line arrives one to three words at a time, each chunk swapped in place at the line's centre,
     then the whole line settles in its slot */
  L.def('effect:type-vo-chunk-swap', {
    kind: 'type',
    plan(b, F, t0 = 0) { const n = toks(b).length, chunks = Math.ceil(n / 3); return { words: toks(b).map((_, i) => t0 + Math.floor(i / 3) * 0.32), done: t0 + chunks * 0.32 + 0.35, events: Array.from({ length: chunks }, (_, i) => ({ at: t0 + i * 0.32, event: 'word' })) }; },
    draw(S, o) {
      const lay = o.lay, c = S.ctx, t0 = o.t0 || 0, n = lay.words.length, chunks = Math.ceil(n / 3), all = t0 + chunks * 0.32;
      if (S.lt < t0) return;
      if (S.lt < all) {
        const ci = Math.min(chunks - 1, Math.floor((S.lt - t0) / 0.32)), ws = lay.words.slice(ci * 3, ci * 3 + 3), sp = lay.px * 0.26;
        const tw = ws.reduce((a, w) => a + w.w, 0) + sp * (ws.length - 1), cyL = (lay.top + lay.bottom) / 2 + lay.px * 0.32;
        let x = lay.align === 'left' ? lay.x : lay.align === 'right' ? lay.x - tw : lay.x - tw / 2;
        for (const w of ws) { wordAt(S, w, { a: 1, dx: x - w.x, dy: cyL - w.y }); x += w.w + sp; }
      } else {
        const k = E.out(prog(S.lt, all, 0.35));
        for (const w of lay.words) wordAt(S, w, { a: k, dy: (1 - k) * 10 * S.u });
      }
    },
  });

  /* ════════════════════════ transitions ════════════════════════ */

  /* horizontal blur smear: the whole shot smears sideways in a heavy motion blur and is gone; the next arrives
     out of a lighter smear from the other side */
  L.def('transition:horizontal-blur-smear', {
    kind: 'transition', plan() { return { pre: 0.35, post: 0.22, events: [{ at: -0.3, event: 'slide-out' }, { at: 0, event: 'scene' }] }; },
    tr(S, A, B, k, o) {
      const c = S.ctx, span = (o.pre || 0) + (o.post || 0), kt = k * span;
      if (S.t < o.cut) {
        const g = E.in(clamp(kt / (o.pre || 0.35))), dx = -g * S.W * 0.12;
        c.fillStyle = (S.PA || S.P).bg; c.fillRect(0, 0, S.W, S.H);
        for (let i = 0; i < 6; i++) { c.save(); c.globalAlpha = (1 - g) * (i ? 0.22 : 1) * (1 - i * 0.12); c.filter = `blur(${(g * 40 * S.u * (0.4 + i * 0.2)).toFixed(1)}px)`; c.drawImage(A, dx - i * g * 40 * S.u, 0); c.restore(); }
      } else {
        const g = E.out(clamp((kt - (o.pre || 0.35)) / (o.post || 0.22)));
        c.fillStyle = S.P.bg; c.fillRect(0, 0, S.W, S.H);
        c.save(); c.globalAlpha = clamp(g * 1.6); if (g < 0.98) c.filter = `blur(${((1 - g) * 18 * S.u).toFixed(1)}px)`; c.drawImage(B, (1 - g) * S.W * 0.05, 0); c.restore();
      }
    },
  });

  /* ink disc swell: an ink disc with an accent core swells out of the outgoing shot's last object past every corner,
     then opens from the centre as a ring with an accent rim onto the next shot */
  L.def('transition:ink-disc-swell', {
    kind: 'transition', plan() { return { pre: 0.22, post: 0.4, events: [{ at: -0.22, event: 'build' }, { at: 0, event: 'hard-hit' }] }; },
    tr(S, A, B, k, o) {
      const c = S.ctx, span = (o.pre || 0) + (o.post || 0), kt = k * span, f = o.from || {}, x = (f.x != null ? f.x : 0.5) * S.W, y = (f.y != null ? f.y : 0.5) * S.H;
      const cover = Math.hypot(Math.max(x, S.W - x), Math.max(y, S.H - y)) * 1.1, ink = S.look.palette.ink;
      if (S.t < o.cut) {
        const g = E.in(clamp(kt / (o.pre || 0.22))), r = lerp((f.r || 0.02) * S.H, cover, g);
        c.drawImage(A, 0, 0); L.circle(c, x, y, r, ink); L.bloom(c, x, y, r * 0.18, S.look.accent, 0.5 * (1 - g)); L.circle(c, x, y, Math.max(6 * S.u, r * 0.05) * (1 - g * 0.5), S.look.accent);
      } else {
        const g = E.out(clamp((kt - (o.pre || 0.22)) / (o.post || 0.4))), t = o.to || {}, tx = (t.x != null ? t.x : 0.5) * S.W, ty = (t.y != null ? t.y : 0.5) * S.H;
        const R = Math.hypot(Math.max(tx, S.W - tx), Math.max(ty, S.H - ty)) * 1.05, hole = R * g;
        c.drawImage(B, 0, 0);
        c.save(); c.beginPath(); c.rect(0, 0, S.W, S.H); c.arc(tx, ty, hole, 0, Math.PI * 2, true); c.fillStyle = ink; c.fill('evenodd'); c.restore();
        if (g < 1) L.circle(c, tx, ty, hole, null, rgba(S.look.accent, 1 - g), 4 * S.u);
      }
    },
  });

  /* placeholder sheet morph: a blank sheet marked with a faint cross scales up over the outgoing shot; the cross
     dissolves and the sheet opens to the full frame with the next shot inside it */
  L.def('transition:placeholder-sheet-morph', {
    kind: 'transition', plan() { return { pre: 0.2, post: 0.48, events: [{ at: -0.2, event: 'card-in' }, { at: 0.1, event: 'page-turn' }] }; },
    tr(S, A, B, k, o) {
      const c = S.ctx, span = (o.pre || 0) + (o.post || 0), kt = k * span, pre = o.pre || 0.2, t = o.to || {};
      const sw0 = Math.min(S.W, S.H) * 0.34, sh0 = sw0 * 1.3, cx = (t.x != null ? t.x : 0.5) * S.W, cy = (t.y != null ? t.y : 0.5) * S.H;
      const P = S.P, fill = lum(P.bg) < 0.35 ? P.card : mix(P.bg, '#FFFFFF', 0.85);
      if (S.t < o.cut) {
        const g = E.out(clamp(kt / pre)), s = lerp(0.7, 1, g);
        c.drawImage(A, 0, 0); c.fillStyle = rgba(S.look.palette.ink, 0.06 * g); c.fillRect(0, 0, S.W, S.H);
        const w = sw0 * s, h = sh0 * s; c.save(); c.globalAlpha = clamp(g * 2); L.card(c, cx - w / 2, cy - h / 2, w, h, 10 * S.u, { fill, u: S.u, lift: 1 });
        L.line(c, cx - w / 2 + 14 * S.u, cy - h / 2 + 14 * S.u, cx + w / 2 - 14 * S.u, cy + h / 2 - 14 * S.u, rgba(P.fg, 0.12), 1); L.line(c, cx + w / 2 - 14 * S.u, cy - h / 2 + 14 * S.u, cx - w / 2 + 14 * S.u, cy + h / 2 - 14 * S.u, rgba(P.fg, 0.12), 1); c.restore();
      } else {
        const g = E.io(clamp((kt - pre) / (o.post || 0.48))), w = lerp(sw0, S.W, g), h = lerp(sh0, S.H, g), x = lerp(cx, S.W / 2, g) - w / 2, y = lerp(cy, S.H / 2, g) - h / 2, r = lerp(10 * S.u, 0, g);
        c.drawImage(A, 0, 0); c.fillStyle = rgba(S.look.palette.ink, 0.06 * (1 - g)); c.fillRect(0, 0, S.W, S.H);
        L.card(c, x, y, w, h, r, { fill, u: S.u, lift: 1 - g });
        c.save(); L.rr(c, x, y, w, h, r); c.clip(); c.globalAlpha = clamp(g * 2.5); c.drawImage(B, 0, 0); c.restore();
        if (g < 0.4) { c.save(); c.globalAlpha = 1 - g / 0.4; L.line(c, x + 14 * S.u, y + 14 * S.u, x + w - 14 * S.u, y + h - 14 * S.u, rgba(P.fg, 0.12), 1); L.line(c, x + w - 14 * S.u, y + 14 * S.u, x + 14 * S.u, y + h - 14 * S.u, rgba(P.fg, 0.12), 1); c.restore(); }
      }
    },
  });

  /* card shrink to a point: the outgoing shot becomes a rounded card on the next shot's ground and shrinks into a
     point at its last object; the next shot settles in from a 3% push */
  L.def('transition:card-shrink-to-point', {
    kind: 'transition', plan() { return { pre: 0.36, post: 0.3, events: [{ at: -0.32, event: 'slide-out' }, { at: 0, event: 'pop' }] }; },
    tr(S, A, B, k, o) {
      const c = S.ctx, span = (o.pre || 0) + (o.post || 0), kt = k * span, pre = o.pre || 0.36, f = o.from || {}, fx = (f.x != null ? f.x : 0.5) * S.W, fy = (f.y != null ? f.y : 0.5) * S.H;
      if (S.t < o.cut) {
        const g = clamp(kt / pre), a = E.out(clamp(g / 0.45)), z = E.in(clamp((g - 0.4) / 0.6)), s = lerp(1, 0.62, a) * (1 - z);
        c.fillStyle = (S.PA || S.P).bg; c.fillRect(0, 0, S.W, S.H);
        if (s > 0.004) { const w = S.W * s, h = S.H * s, x = lerp(S.W / 2, fx, z) - w / 2, y = lerp(S.H / 2, fy, z) - h / 2, r = 24 * S.u * a;
          L.card(c, x, y, w, h, r, { fill: (S.PA || S.P).bg, u: S.u, lift: a, shadow: rgba(S.look.palette.ink, 0.18) });
          c.save(); L.rr(c, x, y, w, h, r); c.clip(); c.drawImage(A, x, y, w, h); c.restore(); }
        else L.circle(c, fx, fy, 6 * S.u, S.look.accent);
      } else {
        const g = E.out(clamp((kt - pre) / (o.post || 0.3))), s = lerp(1.03, 1, g);
        c.save(); scaleAbout(c, S.W / 2, S.H / 2, s); c.globalAlpha = clamp(g * 3); c.drawImage(B, 0, 0); c.restore();
      }
    },
  });

  /* accent flash frame: two frames of the whole screen in the accent with the mark's outline in a lighter tint,
     the one loud colour hit before a reveal */
  L.def('transition:accent-flash-frame', {
    kind: 'transition', plan() { return { pre: 0.02, post: 0.1, events: [{ at: 0, event: 'hard-hit' }] }; },
    tr(S, A, B, k, o) {
      const c = S.ctx;
      if (S.t < o.cut) { c.drawImage(A, 0, 0); return; }
      if (S.t < o.cut + 0.084) { const acc = S.look.accent, s = Math.min(S.W, S.H) * 0.16; c.fillStyle = acc; c.fillRect(0, 0, S.W, S.H); c.save(); markPath(c, S.W / 2, S.H * 0.4, s); c.lineWidth = 2 * S.u; c.strokeStyle = mix(acc, '#FFFFFF', 0.45); c.stroke(); c.restore(); }
      else c.drawImage(B, 0, 0);
    },
  });

  /* ════════════════════════ cameras ════════════════════════ */

  // the field rises: a slow upward drift with a gentle push (the data cloud, the chips; parallax comes from depth)
  L.def('camera:rise-drift-parallax', { kind: 'camera', cam(lt, d, o, S) { const k = clamp(lt / Math.max(0.1, d)), u = (S && S.u) || 1; return { s: 1.02 + k * 0.025, x: Math.sin(lt * 0.7) * 4 * u, y: lerp(26, -34, E.io(k)) * u, r: 0 }; } });
  // settle then push: lands from 5% in on an ease-out, then keeps pushing 2.5% to the last frame
  L.def('camera:settle-push', { kind: 'camera', cam(lt, d) { const a = E.out(prog(lt, 0, 0.8)), k = clamp(lt / Math.max(0.1, d)); return { s: lerp(1.05, 1, a) + k * 0.025, x: 0, y: lerp(-8, 0, a), r: 0 }; } });

  /* ════════════════════════ overlays and textures ════════════════════════ */

  /* almond eye field: eyes open outward from the centre and turn their gaze to it; the headline band stays clear */
  L.def('effect:almond-eye-field', {
    kind: 'overlay',
    draw(S, o) {
      const t = (o && o.target) || { x: 0.5, y: 0.5 }, tx = t.x * S.W, ty = t.y * S.H, cw = S.W * ((o && o.clearW) || 0.42), ch = S.H * ((o && o.clearH) || 0.2);
      eyeField(S, { tx: () => tx, ty: () => ty, t0: (o && o.at) || 0.2, spread: 0.7, scale: 0.9, blink: (o && o.blink) || 1.8, mask: (x, y) => clamp(Math.max(Math.abs(x - tx) - cw, (Math.abs(y - ty) - ch) * 2.2) / (70 * S.u)) });
    },
  });

  /* spiral dot vortex: a calm golden-angle crowd spreading from the centre behind the beat, thinned where type sits */
  L.def('effect:spiral-dot-vortex', {
    kind: 'overlay',
    draw(S, o) {
      const cw = S.W * ((o && o.clearW) || 0.4), ch = S.H * ((o && o.clearH) || 0.16);
      spiral(S, S.W / 2, S.H / 2, prog(S.lt, (o && o.at) || 0, 1.0), { a: 0.8, mask: (x, y) => 0.25 + 0.75 * clamp(Math.max(Math.abs(x - S.W / 2) - cw, (Math.abs(y - S.H / 2) - ch) * 2) / (80 * S.u)) });
    },
  });

  /* peach sky wash: a soft accent-tinted sky at the top fading into the paper by the middle, a 4% vignette */
  L.def('texture:peach-sky-wash', {
    kind: 'texture',
    draw(S) {
      const c = S.ctx, g = c.createLinearGradient(0, 0, 0, S.H * 0.55); g.addColorStop(0, mix(S.P.bg, S.look.accent, dk(S) ? 0.24 : 0.17)); g.addColorStop(1, rgba(S.P.bg, 0));
      c.fillStyle = g; c.fillRect(0, 0, S.W, S.H * 0.55); L.vignette(c, S.W, S.H, 0.05, inkOf(S));
    },
  });

  /* dot lattice with one black square: a strict quiet dot grid, one cell holding a small ink square that breathes */
  L.def('texture:dot-lattice-black-square', {
    kind: 'texture',
    draw(S, o) {
      const c = S.ctx, s = ((o && o.spacing) || 54) * S.u, ox = (S.W / 2) % s, oy = (S.H / 2) % s;
      L.dotGrid(c, S.W, S.H, s, 2 * S.u, rgba(S.P.fg, 0.32), { ox, oy });
      const gx = ox + Math.round((S.W * ((o && o.x) || (isTall(S) ? 0.78 : 0.82)) - ox) / s) * s, gy = oy + Math.round((S.H * ((o && o.y) || 0.22) - oy) / s) * s;
      const q = s * 0.62 * (1 + Math.sin(S.t * 1.4) * 0.03);
      c.save(); c.shadowColor = rgba(inkOf(S), 0.3); c.shadowBlur = 16 * S.u; c.shadowOffsetY = 6 * S.u; c.fillStyle = dk(S) ? S.P.fg : inkOf(S); c.fillRect(gx - q / 2, gy - q / 2, q, q); c.restore();
    },
  });
})(globalThis.LAUNCH);
