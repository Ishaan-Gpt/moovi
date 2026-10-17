// Launch pack l04 (the "Verdict" film): black hype frames and warm paper proof frames, one accent on the key word,
// a seed dot that survives every cut (crowd -> dot -> mark -> tap -> node -> dust -> glyph), chips sealed by a lock,
// a phone habit grid feeding a streak bar, a slot drum verdict, a match cut into the app, a chart that leaves the
// phone, a branch picker whose ring hops before it commits, and dust that re-forms a glyph. All drawn from the palette.
'use strict';
(function (L) {
  const { clamp, lerp, prog, E, rgba, mix, lum, spring, rand, noise } = L;
  const isWide = S => S.W / S.H > 1.3, isTall = S => S.H / S.W > 1.3;
  const ratioOf = F => (F && F.W && F.H ? F.W / F.H : 16 / 9);
  const toks = b => (b.text && b.text.tokens) || [];
  const plain = b => toks(b).map(t => t.s).join(' ');
  const brandOf = S => (S.F && S.F.brand) || (L.film && L.film.brand) || { name: 'Brand', host: '', tagline: '' };
  const itemsOf = (b, max) => { const it = ((b.data && b.data.items) || []).filter(Boolean).slice(0, max); return it.length ? it : [plain(b) || 'Ready']; };
  const Tp = (b, F, t0) => { const p = L.get(b.type) || L.get('effect:type-mask-rise'); return p && p.plan ? p.plan(b, F, t0) : { done: t0 + 0.6, events: [] }; };
  const hp = (S, b, base) => { const n = toks(b).length; return S.u * base * (n <= 2 ? 1.2 : n <= 4 ? 1 : n <= 7 ? 0.84 : 0.7) * (isTall(S) ? 0.92 : 1); };
  const greyOf = P => mix(P.bg, P.fg, 0.42);
  const darkW = P => lum(P.bg) < 0.3;
  const lightBase = P => (darkW(P) ? mix(P.fg, P.bg, 0.06) : mix(P.bg, '#FFFFFF', 0.55));
  const mintOf = P => mix(lightBase(P), P.accentRaw, 0.2);
  const deepOf = P => mix(P.accentRaw, '#000000', 0.32);
  const numStr = (n, k = 1) => { if (!n) return ''; const v = typeof n.value === 'number' ? n.value * k : n.value; const dec = typeof n.value === 'number' && !Number.isInteger(n.value) ? 1 : 0; return `${n.prefix || ''}${typeof v === 'number' ? v.toFixed(dec) : v}${n.suffix || ''}`; };
  // the phone screens are always a light app, whatever world the beat is in
  const scr = S => { const k = S.look.palette, bg = mix(k.paper, '#FFFFFF', 0.5); return { bg, fg: k.text, dim: mix(k.text, bg, 0.5), line: mix(k.text, bg, 0.9), acc: L.readable(S.look.accent, bg, 3), mint: mix(bg, S.look.accent, 0.16), card: mix(k.paper, '#FFFFFF', 0.15), deep: mix(S.look.accent, '#000000', 0.3) }; };
  const pt = (S, a, dx = 0.5, dy = 0.5) => ({ x: (a && a.x != null ? a.x : dx) * S.W, y: (a && a.y != null ? a.y : dy) * S.H });
  const cover = (S, x, y) => Math.max(Math.hypot(x, y), Math.hypot(S.W - x, y), Math.hypot(x, S.H - y), Math.hypot(S.W - x, S.H - y)) * 1.04;
  const split = (o, k) => { const span = (o.pre || 0) + (o.post || 0) || 1; return clamp(k * span / Math.max(1e-6, o.pre || 1e-6)); };
  const after = (o, k) => { const span = (o.pre || 0) + (o.post || 0) || 1; return clamp((k * span - (o.pre || 0)) / Math.max(1e-6, o.post || 1e-6)); };
  const SERIF = (px, w = 400) => `${w} ${Math.max(1, px).toFixed(1)}px ${L.FAM.fraunces}`;
  const reset = c => { try { c.letterSpacing = '0px'; } catch (e) { /* */ } };

  /* ───────── shared drawing ───────── */
  // a word with alpha, blur, offset, scale, rotation and a grey mix (type treatments)
  function wd(S, w, o) {
    const c = S.ctx; if (o.a <= 0.002) return;
    c.save(); c.globalAlpha *= clamp(o.a);
    if (o.blur > 0.35) c.filter = `blur(${o.blur.toFixed(2)}px)`;
    const fill = o.fill || (w.tk.accent ? S.P.accent : S.P.fg), col = o.grey > 0 ? mix(fill, greyOf(S.P), clamp(o.grey)) : fill;
    const dx = o.dx || 0, dy = o.dy || 0;
    if (o.s != null && o.s !== 1) { const cx = w.x + w.w / 2 + dx, cy = w.y - w.px * 0.35 + dy; c.translate(cx, cy); c.scale(o.s, o.s); c.translate(-cx, -cy); }
    if (o.rot) { c.translate(w.x + dx, w.y + dy); c.rotate(o.rot); c.translate(-(w.x + dx), -(w.y + dy)); }
    L.drawWord(c, S.look, S.P, w, { x: w.x + dx, y: w.y + dy, fill: col });
    reset(c); c.restore();
  }
  // a hand-drawn marker underline (a slight smile, a wobble, drawn left to right)
  function underline(c, x0, x1, y, px, k, col, seed = 1) {
    if (k <= 0) return; const n = 30, m = Math.max(1, Math.round(n * clamp(k)));
    c.save(); c.strokeStyle = col; c.lineCap = 'round'; c.lineJoin = 'round'; c.lineWidth = Math.max(3, px * 0.07);
    c.beginPath();
    for (let i = 0; i <= m; i++) { const f = i / n, x = lerp(x0, x1, f), yy = y + px * 0.05 * (1 - Math.pow(2 * f - 1, 2)) * 0.9 - f * px * 0.03 + noise(f * 5, seed) * px * 0.012; if (i) c.lineTo(x, yy); else c.moveTo(x, yy); }
    c.stroke(); c.restore();
  }
  // the mark: the site's logo when there is one, else a disc that splits into two halves (the gap the camera flies through)
  function mark(c, S, x, y, R, o = {}) {
    if (R <= 0.5) return;
    const img = !o.noImg && L.img && L.img('logo');
    if (img) {
      const s = Math.min(R * 2 / img.width, R * 2 / img.height), m = clamp(o.morph == null ? 1 : o.morph);
      c.save(); c.globalAlpha *= 1 - m; L.circle(c, x, y, R * 0.9, o.col); c.restore();
      c.save(); c.globalAlpha *= m; c.drawImage(img, x - img.width * s / 2, y - img.height * s / 2, img.width * s, img.height * s); c.restore();
      return;
    }
    const g = (o.split || 0) * R * 0.3;
    c.save(); c.fillStyle = o.col;
    if (g < 0.3) { c.beginPath(); c.arc(x, y, R, 0, Math.PI * 2); c.fill(); }
    else {
      c.beginPath(); c.arc(x - g, y, R, Math.PI / 2, Math.PI * 1.5); c.closePath(); c.fill();
      c.beginPath(); c.arc(x + g, y, R, -Math.PI / 2, Math.PI / 2); c.closePath(); c.fill();
    }
    c.restore();
  }
  // a padlock: body + shackle (the shackle snaps down on landing)
  function padlock(c, x, y, s, col, hole, snap) {
    const bw = s, bh = s * 0.78, sh = s * 0.34 * (1 - snap * 0.28);
    c.save(); c.strokeStyle = col; c.lineWidth = s * 0.14; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x - bw * 0.28, y - bh * 0.1); c.lineTo(x - bw * 0.28, y - bh * 0.1 - sh); c.arc(x, y - bh * 0.1 - sh, bw * 0.28, Math.PI, 0); c.lineTo(x + bw * 0.28, y - bh * 0.1 - sh * 0.5); c.stroke();
    L.rr(c, x - bw / 2, y - bh * 0.15, bw, bh, s * 0.16); c.fillStyle = col; c.fill();
    L.circle(c, x, y + bh * 0.22, s * 0.08, hole); c.fillStyle = hole; c.fillRect(x - s * 0.03, y + bh * 0.24, s * 0.06, s * 0.16);
    c.restore();
  }
  // a five-point star path
  function star(c, x, y, r) { c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } c.closePath(); }

  /* the crowd: capsules, scored tablets, crosses and star rows streaming out of a vanishing point toward the lens */
  function swarm(c, S, t, o = {}) {
    const n = o.n || 150, cx = o.cx != null ? o.cx : S.W / 2, cy = o.cy != null ? o.cy : S.H / 2, R = Math.hypot(S.W, S.H) * 0.5;
    const im = E.in(clamp(o.implode || 0)), P = S.P;
    const cols = [P.fg, P.accent, mix(P.fg, P.accentRaw, 0.45), mix(P.fg, P.bg, 0.3)];
    const list = [];
    for (let i = 0; i < n; i++) {
      const a = rand(i * 3 + 1) * Math.PI * 2, rr = 0.18 + rand(i * 3 + 2) * 0.82, z = (((rand(i * 3 + 3) - t * 0.16 * (0.8 + rand(i + 71) * 0.4)) % 1) + 1) % 1;
      const d = 0.09 + z * 1.15, sc = 1 / d;
      const aa = a + im * 2.2 * (1 - rr * 0.4);
      let x = cx + Math.cos(aa) * rr * R * 0.32 * sc, y = cy + Math.sin(aa) * rr * R * 0.26 * sc;
      x = lerp(x, cx, im); y = lerp(y, cy, im);
      const size = S.u * 13 * sc * (0.6 + rand(i * 5) * 0.8) * (1 - im * 0.92);
      const alpha = clamp((1 - z) * 5) * clamp((d - 0.09) * 8) * lerp(1, 0.55, clamp(z * 1.2)) * (o.a == null ? 1 : o.a);
      if (alpha <= 0.01 || x < -size * 3 || y < -size * 3 || x > S.W + size * 3 || y > S.H + size * 3) continue;
      list.push({ i, x, y, size, alpha, d, rot: rand(i * 11) * 6.28 + t * (0.7 + rand(i * 13) * 1.7) * (rand(i * 17) > 0.5 ? 1 : -1) });
    }
    list.sort((p, q) => q.d - p.d);
    for (const p of list) {
      const s = p.size, kind = p.i % 7, ca = cols[p.i % 4], cb = cols[(p.i + 1 + (p.i % 3)) % 4];
      c.save(); c.globalAlpha *= p.alpha; c.translate(p.x, p.y); c.rotate(p.rot);
      if (s > 70 * S.u) c.filter = `blur(${Math.min(10, s / 18).toFixed(1)}px)`;
      if (kind <= 2) { const l = s * 2.5; L.rr(c, -l / 2, -s / 2, l, s, s / 2); c.fillStyle = ca; c.fill(); c.save(); c.beginPath(); c.rect(0, -s, l, s * 2); c.clip(); L.rr(c, -l / 2, -s / 2, l, s, s / 2); c.fillStyle = cb === ca ? cols[0] : cb; c.fill(); c.restore(); }
      else if (kind === 3) { L.circle(c, 0, 0, s * 0.7, mix(P.fg, P.accentRaw, 0.25)); c.strokeStyle = rgba(P.bg, 0.35); c.lineWidth = s * 0.08; c.beginPath(); c.moveTo(-s * 0.5, 0); c.lineTo(s * 0.5, 0); c.stroke(); }
      else if (kind === 4 || kind === 5) { c.strokeStyle = ca; c.lineWidth = s * 0.22; c.lineCap = 'round'; c.beginPath(); if (kind === 4) { c.moveTo(-s * 0.4, -s * 0.4); c.lineTo(s * 0.4, s * 0.4); c.moveTo(s * 0.4, -s * 0.4); c.lineTo(-s * 0.4, s * 0.4); } else { c.moveTo(-s * 0.45, 0); c.lineTo(s * 0.45, 0); c.moveTo(0, -s * 0.45); c.lineTo(0, s * 0.45); } c.stroke(); }
      else { c.fillStyle = mix(P.fg, P.accentRaw, 0.2); for (let k = 0; k < 5; k++) { star(c, (k - 2) * s * 0.55, 0, s * 0.24); c.fill(); } }
      c.restore();
    }
  }

  /* a light app screen: a habit ring, a 7x4 grid of days (done = accent), two actions, a trend card, a tab bar */
  function habitScreen(c, S, sx, sy, sw, sh, o = {}) {
    const Q = scr(S), u = sw / 400, p = 26 * u, total = 28, fill = clamp(o.fill == null ? 13 : o.fill, 0, total);
    c.fillStyle = Q.bg; c.fillRect(sx, sy, sw, sh);
    let y = sy + sh * 0.095;
    c.save(); c.strokeStyle = Q.fg; c.lineWidth = 2.4 * u; c.lineCap = 'round'; c.beginPath(); c.moveTo(sx + p + 8 * u, y - 8 * u); c.lineTo(sx + p, y); c.lineTo(sx + p + 8 * u, y + 8 * u); c.stroke(); c.restore();
    L.text(c, S.look, o.title || brandOf(S).name, sx + p + 22 * u, y + 6 * u, { role: 'ui', px: 17 * u, weight: 650, color: Q.fg, maxW: sw * 0.5 });
    L.pill(c, sx + sw - p - 78 * u, y - 14 * u, 78 * u, 28 * u, Q.mint); L.text(c, S.look, `Day ${Math.floor(fill)}`, sx + sw - p - 39 * u, y + 5 * u, { role: 'ui', px: 13 * u, weight: 650, color: Q.deep, align: 'center' });
    y += 38 * u;
    const rx = sx + p + 36 * u, ry = y + 36 * u, rr = 30 * u, pct = fill / total;
    L.circle(c, rx, ry, rr, null, Q.line, 7 * u);
    c.save(); c.strokeStyle = Q.acc; c.lineWidth = 7 * u; c.lineCap = 'round'; c.beginPath(); c.arc(rx, ry, rr, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct); c.stroke(); c.restore();
    L.text(c, S.look, `${Math.round(pct * 100)}%`, rx, ry + 5 * u, { role: 'ui', px: 14 * u, weight: 700, color: Q.fg, align: 'center' });
    L.text(c, S.look, `${Math.floor(fill)} of ${total} days`, rx + rr + 20 * u, ry - 2 * u, { role: 'ui', px: 21 * u, weight: 700, color: Q.fg });
    for (let i = 0; i < 7; i++) L.circle(c, rx + rr + 26 * u + i * 16 * u, ry + 18 * u, 4 * u, i < Math.min(7, Math.floor(fill / 4)) ? Q.acc : Q.line);
    y += 92 * u;
    const g = 8 * u, cs = (sw - 2 * p - 6 * g) / 7, cells = [];
    for (let r = 0; r < 4; r++) for (let col = 0; col < 7; col++) {
      const idx = r * 7 + col, x = sx + p + col * (cs + g), yy = y + r * (cs + g); cells.push({ x: x + cs / 2, y: yy + cs / 2, s: cs });
      const done = idx < Math.floor(fill), pop = idx === Math.floor(fill) ? fill - Math.floor(fill) : 0;
      if (done) { L.rr(c, x, yy, cs, cs, cs * 0.18); c.fillStyle = Q.acc; c.fill(); }
      else if (pop > 0) { const s = cs * E.outBack(pop); L.rr(c, x + (cs - s) / 2, yy + (cs - s) / 2, s, s, s * 0.18); c.fillStyle = Q.acc; c.fill(); }
      else if (idx === Math.floor(fill)) { L.rr(c, x + 1.5 * u, yy + 1.5 * u, cs - 3 * u, cs - 3 * u, cs * 0.18); c.strokeStyle = Q.acc; c.lineWidth = 2.5 * u; c.stroke(); }
      else { L.rr(c, x, yy, cs, cs, cs * 0.18); c.fillStyle = Q.line; c.fill(); }
    }
    y += 4 * (cs + g) + 14 * u;
    const bw = (sw - 2 * p - 12 * u) / 2, bh = 44 * u, press = o.press || 0;
    c.save(); const bx = sx + p, bs = 1 - press * 0.05; c.translate(bx + bw / 2, y + bh / 2); c.scale(bs, bs); c.translate(-(bx + bw / 2), -(y + bh / 2));
    L.pill(c, bx, y, bw, bh, Q.acc); L.icon(c, 'check', bx + 26 * u, y + bh / 2, 20 * u, '#FFFFFF', 2.4);
    L.text(c, S.look, o.action || 'Log today', bx + 44 * u, y + bh / 2 + 5 * u, { role: 'ui', px: 15 * u, weight: 650, color: '#FFFFFF', maxW: bw - 54 * u }); c.restore();
    L.pill(c, sx + p + bw + 12 * u, y, bw, bh, null, Q.line); c.lineWidth = 1.5 * u; L.icon(c, 'clock', sx + p + bw + 38 * u, y + bh / 2, 19 * u, Q.dim, 2);
    L.text(c, S.look, 'Remind me', sx + p + bw + 56 * u, y + bh / 2 + 5 * u, { role: 'ui', px: 15 * u, weight: 600, color: Q.dim, maxW: bw - 64 * u });
    y += bh + 16 * u;
    const ch = Math.min(110 * u, sy + sh - 74 * u - y);
    if (ch > 40 * u) {
      L.rr(c, sx + p, y, sw - 2 * p, ch, 16 * u); c.fillStyle = Q.card; c.fill();
      stepChart(c, { x: sx + p + 14 * u, y: y + 14 * u, w: sw - 2 * p - 28 * u, h: ch - 28 * u }, { col: Q.acc, lw: 2 * u, draw: 1, band: 1, guide: Q.dim, bandCol: mix(Q.card, Q.fg, 0.06), seed: 4, n: 50 });
    }
    const ty = sy + sh - 40 * u; c.fillStyle = Q.line; c.fillRect(sx, ty - 24 * u, sw, 1);
    ['home', 'calendar', 'chart', 'user'].forEach((ic, i) => L.icon(c, ic, sx + sw * (0.14 + i * 0.24), ty, 22 * u, i === 1 ? Q.acc : Q.dim, 2));
    return { cells };
  }

  /* the result screen: a caps label, a serif headline, an outcome card with a mint badge, a chart card, a details row */
  function resultScreen(c, S, sx, sy, sw, sh, o = {}) {
    const Q = scr(S), u = sw / 400, p = 26 * u;
    c.fillStyle = Q.bg; c.fillRect(sx, sy, sw, sh);
    let y = sy + sh * 0.1;
    L.text(c, S.look, (o.label || brandOf(S).name) + '  ·  result', sx + p, y, { role: 'micro', px: 11 * u, color: Q.dim, upper: true, maxW: sw - 2 * p });
    y += 14 * u;
    const words = String(o.title || 'Your result is in').split(/\s+/), half = Math.ceil(words.length / 2);
    const lines = words.length > 3 ? [words.slice(0, half).join(' '), words.slice(half).join(' ')] : [words.join(' ')];
    c.font = SERIF(31 * u); c.fillStyle = Q.fg; c.textAlign = 'left'; c.textBaseline = 'alphabetic';
    lines.forEach((ln, i) => { let px = 31 * u; c.font = SERIF(px); const w = c.measureText(ln).width; if (w > sw - 2 * p) { px *= (sw - 2 * p) / w; c.font = SERIF(px); } c.fillText(ln, sx + p, y + 34 * u + i * 36 * u); });
    y += 34 * u + lines.length * 36 * u;
    const ch = 150 * u; L.rr(c, sx + p, y, sw - 2 * p, ch, 18 * u); c.fillStyle = Q.card; c.fill();
    const lab = String(o.verdict || 'Worked').toUpperCase();
    L.setFont(c, S.look, 'ui', 13 * u, 700); try { c.letterSpacing = (0.12 * 13 * u).toFixed(2) + 'px'; } catch (e) { /* */ }
    const bw = c.measureText(lab).width + 34 * u, bh = 30 * u, bx = sx + p + 18 * u, by = y + 18 * u; reset(c);
    L.pill(c, bx, by, bw, bh, Q.mint);
    L.text(c, S.look, lab, bx + bw / 2, by + bh / 2 + 4.5 * u, { role: 'ui', px: 13 * u, weight: 700, color: Q.deep, align: 'center', tracking: 0.12 });
    c.font = SERIF(23 * u); c.fillStyle = Q.fg; c.textAlign = 'left'; c.textBaseline = 'alphabetic'; const sent = o.line || 'A clear change'; let spx = 23 * u; const sw2 = c.measureText(sent).width; if (sw2 > sw - 2 * p - 36 * u) { spx *= (sw - 2 * p - 36 * u) / sw2; c.font = SERIF(spx); } c.fillText(sent, sx + p + 18 * u, by + bh + 38 * u);
    L.text(c, S.look, o.sub || '', sx + p + 18 * u, by + bh + 64 * u, { role: 'ui', px: 13 * u, color: Q.dim, maxW: sw - 2 * p - 36 * u });
    y += ch + 14 * u;
    const kh = Math.min(170 * u, sy + sh - 110 * u - y), chart = { x: sx + p + 16 * u, y: y + 40 * u, w: sw - 2 * p - 32 * u, h: kh - 56 * u };
    if (kh > 60 * u) {
      L.rr(c, sx + p, y, sw - 2 * p, kh, 18 * u); c.fillStyle = Q.card; c.fill();
      L.icon(c, 'trend', sx + p + 26 * u, y + 22 * u, 16 * u, Q.acc, 2); L.text(c, S.look, o.metric || 'What changed', sx + p + 42 * u, y + 27 * u, { role: 'ui', px: 13 * u, weight: 600, color: Q.fg, maxW: sw - 2 * p - 60 * u });
      if (!o.hideChart) stepChart(c, chart, { col: Q.acc, lw: 2.2 * u, draw: 1, band: 1, guide: Q.dim, bandCol: mix(Q.card, Q.fg, 0.07), seed: 7, n: 60 });
    }
    y += kh + 14 * u;
    if (y + 46 * u < sy + sh - 20 * u) { L.rr(c, sx + p, y, sw - 2 * p, 46 * u, 14 * u); c.fillStyle = Q.card; c.fill(); L.text(c, S.look, 'Full result', sx + p + 16 * u, y + 28 * u, { role: 'ui', px: 14 * u, weight: 600, color: Q.fg }); L.icon(c, 'arrowRight', sx + sw - p - 22 * u, y + 23 * u, 16 * u, Q.dim, 2); }
    return { badge: { x: bx + bw / 2, y: by + bh / 2, w: bw, h: bh }, chart };
  }

  /* a before/after step chart: jittery high line, a wash band, a step down, dashed before and dotted after guides */
  function seriesOf(seed, n) { const out = []; for (let i = 0; i < n; i++) { const x = i / (n - 1), lvl = lerp(0.66, 0.3, L.smooth((x - 0.56) / 0.1)); out.push([x, clamp(lvl + (rand(seed * 977 + i) - 0.5) * 0.26 + noise(i * 0.35, seed) * 0.1, 0.04, 0.96)]); } return out; }
  function stepChart(c, R, o = {}) {
    const pts = seriesOf(o.seed || 3, o.n || 90), draw = clamp(o.draw == null ? 1 : o.draw), X = x => R.x + x * R.w, Y = v => R.y + (1 - v) * R.h;
    const bk = clamp(o.band || 0);
    if (bk > 0) { const bx = X(0.55), bw = R.w * 0.11, h = R.h * bk; c.fillStyle = o.bandCol || 'rgba(0,0,0,0.06)'; c.fillRect(bx, R.y + (R.h - h) / 2, bw, h); }
    if (o.guide) {
      c.save(); c.globalAlpha *= clamp(o.guideA == null ? 1 : o.guideA) * 0.75; c.strokeStyle = o.guide; c.lineWidth = Math.max(1, (o.lw || 2) * 0.55);
      c.setLineDash([R.w * 0.012, R.w * 0.01]); c.beginPath(); c.moveTo(X(0), Y(0.66)); c.lineTo(X(1), Y(0.66)); c.stroke();
      c.setLineDash([1, R.w * 0.012]); c.lineCap = 'round'; c.beginPath(); c.moveTo(X(0.5), Y(0.3)); c.lineTo(X(1), Y(0.3)); c.stroke(); c.restore();
    }
    if (draw <= 0) return pts.map(p => ({ x: X(p[0]), y: Y(p[1]) }));
    c.save(); c.strokeStyle = o.col; c.lineWidth = o.lw || 3; c.lineJoin = 'round'; c.lineCap = 'round';
    if (o.rev) { c.beginPath(); c.rect(X(1 - draw) - 2, R.y - R.h, R.w * draw + 4, R.h * 3); c.clip(); }
    c.beginPath(); const last = o.rev ? pts.length - 1 : Math.max(1, Math.floor(draw * (pts.length - 1)));
    for (let i = 0; i <= last; i++) { const p = pts[i]; if (i) c.lineTo(X(p[0]), Y(p[1])); else c.moveTo(X(p[0]), Y(p[1])); }
    if (!o.rev && last < pts.length - 1) { const f = draw * (pts.length - 1) - last, a = pts[last], b = pts[last + 1]; c.lineTo(X(lerp(a[0], b[0], f)), Y(lerp(a[1], b[1], f))); }
    c.stroke(); c.restore();
    return pts.map(p => ({ x: X(p[0]), y: Y(p[1]) }));
  }

  /* the streak bar: small rounded squares built left to right, ending in an outlined goal box; filled ones are accent */
  function streakBar(c, S, x0, y, w, o = {}) {
    const n = o.n || 18, g = w / (n + 1) * 0.22, cs = (w - g * n) / (n + 1), P = S.P, slots = [];
    const emptyC = darkW(P) ? mix(P.bg, P.fg, 0.16) : mix(P.bg, P.fg, 0.1);
    for (let i = 0; i <= n; i++) {
      const x = x0 + i * (cs + g), bk = o.build == null ? 1 : E.outBack(clamp((o.build * (n + 1) - i) / 1.5));
      slots.push({ x: x + cs / 2, y, s: cs });
      if (bk <= 0) continue;
      const s = cs * bk;
      if (i === n) { L.rr(c, x + (cs - s) / 2 + 1, y - s / 2 + 1, s - 2, s - 2, s * 0.22); c.strokeStyle = mix(P.bg, P.fg, 0.35); c.lineWidth = 2 * S.u; c.stroke(); continue; }
      const f = clamp((o.fill || 0) - i);
      L.rr(c, x + (cs - s) / 2, y - s / 2, s, s, s * 0.22); c.fillStyle = f >= 1 ? P.accent : emptyC; c.fill();
      if (f > 0 && f < 1) { const q = s * E.outBack(f); L.rr(c, x + (cs - q) / 2, y - q / 2, q, q, q * 0.22); c.fillStyle = P.accent; c.fill(); }
    }
    return slots;
  }

  /* skew-in chips: off-white rule chips with a tinted icon badge, sliding in sheared and soft, one per beat */
  function chipStack(S, o) {
    const c = S.ctx, P = S.P, list = o.items, n = list.length, h = o.h || 96 * S.u, gap = o.gap || 22 * S.u, w = o.w;
    const times = list.map((_, i) => o.t0 + i * (o.every || 0.5));
    const m = L.springTrack(S.lt, [[-1, 1], ...times.slice(1).map((t, i) => [t, i + 2])], 'ui');
    const shown = Math.max(1, m), cy = o.y;
    list.forEach((s, i) => {
      const k = E.out(prog(S.lt, times[i], 0.34)); if (k <= 0) return;
      const y = cy + (i - (shown - 1) / 2) * (h + gap) - h / 2, x = o.x - w / 2 - (1 - k) * 90 * S.u, sk = (1 - k) * -0.26;
      c.save(); c.globalAlpha *= clamp(k * 2) * (o.alpha == null ? 1 : o.alpha);
      if (k < 0.97) c.filter = `blur(${((1 - k) * 8 * S.u).toFixed(1)}px)`;
      c.translate(x, y + h / 2); c.transform(1, 0, sk, 1, 0, 0); c.translate(-x, -(y + h / 2));
      if (o.glass === false) L.card(c, x, y, w, h, h * 0.28, { fill: lightBase(P), lift: 0.35, u: S.u }); else glassCard(S, x, y, w, h, h * 0.28);
      if (!o.noText) {
        L.circle(c, x + h * 0.52, y + h / 2, h * 0.27, mintOf(P)); L.icon(c, L.iconFor(s, i), x + h * 0.52, y + h / 2, h * 0.3, i === n - 1 ? P.accent : deepOf(P), 2);
        L.text(c, S.look, s, x + h * 0.98, y + h / 2 + h * 0.12, { role: 'ui', px: h * 0.37, weight: 620, color: i === n - 1 ? P.accent : (darkW(P) ? P.bg : P.fg), maxW: w - h * 1.2 });
      }
      c.restore();
    });
    const H = n * h + (n - 1) * gap; return { x: o.x - w / 2, y: cy - H / 2, w, h: H, last: times[n - 1] };
  }
  // the seal: an accent outline drawn from the top centre both ways around a rect, a padlock pops into the gap
  function seal(S, R, t0, o = {}) {
    const c = S.ctx, P = S.P, pad = 26 * S.u, x = R.x - pad, y = R.y - pad, w = R.w + pad * 2, h = R.h + pad * 2, r = 34 * S.u;
    const dk = E.io(prog(S.lt, t0, 0.32)), retract = o.out != null ? E.in(prog(S.lt, o.out, 0.16)) : 0, k = dk * (1 - retract);
    if (k <= 0) return;
    // sample the rounded rect from the top centre clockwise
    const pts = [], N = 220, per = 2 * (w + h) - 8 * r + 2 * Math.PI * r;
    const at = d => { d = ((d % per) + per) % per; const segs = [[w / 2 - r, (s) => [x + w / 2 + s, y]], [Math.PI * r / 2, (s) => { const a = -Math.PI / 2 + s / r; return [x + w - r + Math.cos(a) * r, y + r + Math.sin(a) * r]; }], [h - 2 * r, (s) => [x + w, y + r + s]], [Math.PI * r / 2, (s) => { const a = s / r; return [x + w - r + Math.cos(a) * r, y + h - r + Math.sin(a) * r]; }], [w - 2 * r, (s) => [x + w - r - s, y + h]], [Math.PI * r / 2, (s) => { const a = Math.PI / 2 + s / r; return [x + r + Math.cos(a) * r, y + h - r + Math.sin(a) * r]; }], [h - 2 * r, (s) => [x, y + h - r - s]], [Math.PI * r / 2, (s) => { const a = Math.PI + s / r; return [x + r + Math.cos(a) * r, y + r + Math.sin(a) * r]; }], [w / 2 - r, (s) => [x + r + s, y]]]; for (const [len, f] of segs) { if (d <= len) return f(d); d -= len; } return [x + w / 2, y]; };
    for (let i = 0; i <= N; i++) pts.push(at(i / N * per));
    const gapN = Math.round(N * (34 * S.u) / per), half = N / 2, m = Math.round(gapN + (half - gapN) * k);
    c.save(); c.strokeStyle = P.accent; c.lineWidth = 4 * S.u; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); for (let i = gapN; i <= m; i++) { const p = pts[i]; if (i === gapN) c.moveTo(p[0], p[1]); else c.lineTo(p[0], p[1]); } c.stroke();
    c.beginPath(); for (let i = gapN; i <= m; i++) { const p = pts[N - i]; if (i === gapN) c.moveTo(p[0], p[1]); else c.lineTo(p[0], p[1]); } c.stroke();
    c.restore();
    const lt = S.lt - (t0 + 0.32); if (lt > 0 && retract < 1) { const sp = spring(lt, 'pop'), s = 40 * S.u * sp * (1 - retract); if (s > 0.5) { c.save(); L.circle(c, x + w / 2, y, s * 0.95, S.P.bg); padlock(c, x + w / 2, y + s * 0.12, s, P.accent, S.P.bg, clamp((lt - 0.14) / 0.06)); c.restore(); } }
  }

  /* a slot drum of outcome pills: decelerating spin, ghost smear, dimmed narrower neighbours, lands with a settle */
  function drumS(lt, t0, n, target, spin = 1.3) { const total = n * 3 + target, k = prog(lt, t0, spin), base = total * (1 - Math.pow(1 - k, 3.2)); const dt = lt - t0 - spin; return base + (dt > 0 ? -Math.sin(dt * 16) * Math.exp(-dt * 8) * 0.07 : 0); }
  function drum(S, o) {
    const c = S.ctx, P = S.P, labels = o.labels, n = labels.length, target = o.target || 0, x = o.x, y = o.y, w = o.w, h = o.h;
    const k0 = E.out(prog(S.lt, o.t0 - 0.35, 0.4)); if (k0 <= 0) return;
    const wx = x - w / 2, wy = y - h / 2, winC = darkW(P) ? mix(P.bg, P.fg, 0.04) : mix(P.bg, '#000000', 0.82);
    c.save(); c.globalAlpha *= k0; c.translate(0, (1 - k0) * 30 * S.u);
    L.card(c, wx, wy, w, h, 40 * S.u, { fill: winC, lift: 0.6, u: S.u, stroke: rgba('#FFFFFF', 0.1) });
    c.save(); L.rr(c, wx, wy, w, h, 40 * S.u); c.clip();
    const s = drumS(S.lt, o.t0, n, target, o.spin), v = Math.abs(L.vel(t => drumS(t, o.t0, n, target, o.spin), S.lt)) * 60, pitch = h * 0.42, ph = h * 0.32, pw = w * 0.56;
    const base = lightBase(P), tones = [mix(base, P.accentRaw, 0.22), mix(base, '#000000', 0.12), mix(base, P.accentRaw, 0.06), mix(base, '#000000', 0.22)];
    const landed = S.lt > o.t0 + (o.spin || 1.3);
    for (let j = Math.floor(s) - 2; j <= Math.floor(s) + 3; j++) {
      const off = j - s, d = Math.abs(off); if (d > 2.2) continue;
      const idx = ((j % n) + n) % n, isT = idx === target, sc = 1 - 0.12 * Math.min(d, 2), a = 1 - 0.5 * Math.min(d, 1.4);
      const fill = isT ? tones[0] : tones[1 + (idx % 3)], txt = isT ? deepOf(P) : mix(fill, '#000000', 0.55);
      const ghosts = v > 2 ? Math.min(5, Math.floor(v / 3)) : 0;
      for (let gI = ghosts; gI >= 0; gI--) {
        const yy = y + off * pitch - gI * Math.sign(1) * pitch * 0.07, gw = pw * sc, gh = ph * sc;
        c.save(); c.globalAlpha *= gI ? 0.12 : a * (landed && !isT ? 0.55 : 1);
        if (gI === 0 && v > 6) c.filter = `blur(${Math.min(5, v / 6).toFixed(1)}px)`;
        L.pill(c, x - gw / 2, yy - gh / 2, gw, gh, fill);
        L.text(c, S.look, String(labels[idx]).toUpperCase(), x, yy + gh * 0.15, { role: 'ui', px: gh * 0.36, weight: 700, color: txt, align: 'center', tracking: 0.12, maxW: gw * 0.84 });
        c.restore();
      }
    }
    const fg = c.createLinearGradient(0, wy, 0, wy + h); fg.addColorStop(0, rgba(winC, 0.95)); fg.addColorStop(0.24, rgba(winC, 0)); fg.addColorStop(0.76, rgba(winC, 0)); fg.addColorStop(1, rgba(winC, 0.95)); c.fillStyle = fg; c.fillRect(wx, wy, w, h);
    c.restore();
    if (landed) { const dt = S.lt - o.t0 - (o.spin || 1.3), rk = clamp(dt / 0.6); if (rk < 1) { c.save(); c.globalAlpha *= (1 - rk) * 0.7; L.rr(c, x - pw / 2 - rk * 40 * S.u, y - ph / 2 - rk * 40 * S.u, pw + rk * 80 * S.u, ph + rk * 80 * S.u, ph / 2 + rk * 40 * S.u); c.strokeStyle = tones[0]; c.lineWidth = 3 * S.u; c.stroke(); c.restore(); } }
    c.restore();
  }
  const drumTicks = (t0, n, target, spin = 1.3) => { const ev = []; let last = Math.floor(drumS(t0, t0, n, target, spin)), lastAt = -1; for (let t = t0; t <= t0 + spin; t += 1 / 60) { const f = Math.floor(drumS(t, t0, n, target, spin)); if (f !== last && t - lastAt > 0.075) { ev.push({ at: +t.toFixed(3), event: 'click-ui' }); lastAt = t; } last = f; } return ev.slice(0, 14); };

  /* the hop ring: an outline pill hops from option to option, then commits on the target */
  function hopSeq(n, target, hops, seed) { const s = []; let prev = -1; for (let i = 0; i < hops - 1; i++) { let j = Math.floor(rand(seed + i * 13) * n); if (j === prev) j = (j + 1) % n; if (i === hops - 2 && j === target) j = (j + 1) % n; if (j === prev) j = (j + 1) % n; s.push(j); prev = j; } s.push(target); return s; }
  function hopRing(S, rects, t0, seq, every, col) {
    const c = S.ctx, lt = S.lt - t0; if (lt < 0) return;
    const h = Math.min(seq.length - 1, Math.floor(lt / every)), k = E.quick(prog(lt - h * every, 0, 0.11));
    const a = rects[seq[Math.max(0, h - 1)]], b = rects[seq[h]], f = h === 0 ? 1 : k, pad = 10 * S.u;
    const x = lerp(a.x, b.x, f) - pad, y = lerp(a.y, b.y, f) - pad, w = lerp(a.w, b.w, f) + pad * 2, hh = lerp(a.h, b.h, f) + pad * 2;
    const fade = 1 - clamp((lt - seq.length * every - 0.3) / 0.3);
    if (fade <= 0) return; c.save(); c.globalAlpha *= (h === 0 ? clamp(k * 2) : 1) * fade; L.rr(c, x, y, w, hh, hh / 2); c.strokeStyle = col; c.lineWidth = 3.5 * S.u; c.stroke(); c.restore();
  }
  function optPill(S, x, y, label, o = {}) {
    const c = S.ctx, P = S.P, px = (o.px || 30) * S.u, w = L.textW(c, S.look, label, { role: 'ui', px, weight: 600 }) + px * 1.7, h = px * 2.05;
    const k = o.pop == null ? 1 : o.pop; if (k <= 0) return { x: x - w / 2, y: y - h / 2, w, h };
    const fillK = clamp(o.fill || 0);
    c.save(); c.globalAlpha *= clamp(k * 2) * (o.alpha == null ? 1 : o.alpha); c.translate(x, y); c.scale(k, k); c.translate(-x, -y);
    L.card(c, x - w / 2, y - h / 2, w, h, h / 2, { fill: fillK > 0 ? mix(mix(lightBase(P), P.accentRaw, 0.35), P.accent, clamp((fillK - 0.4) / 0.6)) : lightBase(P), lift: 0.4, u: S.u });
    L.text(c, S.look, label, x, y + px * 0.35, { role: 'ui', px, weight: 600, color: fillK > 0.6 ? L.onColor(P.accent) : (darkW(P) ? P.bg : P.fg), align: 'center' });
    c.restore();
    return { x: x - w / 2, y: y - h / 2, w, h };
  }


  /* the depth field: the product itself, out of focus, behind every set-up. Big slabs (a phone with the habit grid,
     a chart card, a chip stack, a tile board) sit partly off-frame at three depths and drift with parallax against
     the foreground, so a line of type is never on a flat colour. Drawn into a quarter-size buffer and blurred there
     (cheap, and soft like a real lens). */
  const SLOTS = [[-0.04, 0.72, 0.62], [0.9, 0.2, 0.8], [0.93, 0.82, 0.55], [0.08, 0.1, 0.9], [0.55, 1.02, 0.7], [0.5, -0.06, 0.5]];
  function slab(g, Sg, kind, x, y, sz, i) {
    const P = Sg.P, dark = darkW(P), u = Sg.u, w = sz, fillC = dark ? mix(P.bg, P.fg, 0.15) : mix(P.bg, '#FFFFFF', 0.6);
    if (kind === 'phone') { const PF = L.get('ui:phone-frame'); if (PF) PF.draw(Sg, { x, y, h: sz * 1.5, rot: (i % 2 ? 0.08 : -0.06), content: (cc, sx, sy, sw, sh) => habitScreen(cc, Sg, sx, sy, sw, sh, { fill: 9 + (i % 5) * 3 }) }); return; }
    const h = kind === 'chart' ? w * 0.56 : kind === 'chips' ? w * 0.62 : w * 0.72;
    g.save(); g.translate(x, y); g.rotate((i % 2 ? 1 : -1) * 0.04); g.translate(-x, -y);
    L.card(g, x - w / 2, y - h / 2, w, h, 34 * u, { fill: fillC, lift: 1, u });
    if (kind === 'chart') { g.fillStyle = rgba(P.fg, 0.4); g.fillRect(x - w * 0.42, y - h * 0.36, w * 0.3, h * 0.05); stepChart(g, { x: x - w * 0.42, y: y - h * 0.22, w: w * 0.84, h: h * 0.6 }, { col: P.accent, lw: 7 * u, draw: 1, band: 1, bandCol: mix(fillC, P.accentRaw, 0.12), seed: 20 + i, n: 50 }); }
    else if (kind === 'chips') { for (let k = 0; k < 3; k++) { const yy = y - h * 0.32 + k * h * 0.3; L.pill(g, x - w * 0.42, yy - h * 0.1, w * 0.84, h * 0.2, dark ? mix(fillC, P.fg, 0.06) : mix(fillC, P.bg, 0.5)); L.circle(g, x - w * 0.42 + h * 0.1, yy, h * 0.06, mix(fillC, P.accentRaw, 0.35)); g.fillStyle = rgba(P.fg, 0.35); g.fillRect(x - w * 0.42 + h * 0.22, yy - h * 0.015, w * (0.3 + k * 0.1), h * 0.03); } }
    else { const n = 6, cs = w * 0.8 / n; for (let r = 0; r < 4; r++) for (let q = 0; q < n; q++) { const idx = r * n + q; L.rr(g, x - w * 0.4 + q * cs + cs * 0.1, y - h * 0.36 + r * cs + cs * 0.1, cs * 0.8, cs * 0.8, cs * 0.16); g.fillStyle = idx < 14 + i ? P.accent : (dark ? mix(fillC, P.fg, 0.1) : mix(fillC, P.fg, 0.08)); g.fill(); } }
    g.restore();
  }
  function field(S, o = {}) {
    const q = 4, bw = Math.ceil(S.W / q), bh = Math.ceil(S.H / q), A = L.buffer('l04-fieldA', bw, bh), B = L.buffer('l04-fieldB', bw, bh);
    if (!A || !B) return;
    const g = A.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, bw, bh); g.scale(1 / q, 1 / q);
    const Sg = Object.assign({}, S, { ctx: g }), seed = o.seed != null ? o.seed : S.seed, t = S.t, kinds = o.kinds || ['phone', 'chart', 'chips', 'grid'];
    const n = o.n || 4, skip = o.skip || [];
    for (let i = 0, j = 0; i < SLOTS.length && j < n; i++) {
      const si = (seed + i) % SLOTS.length; if (skip.includes(si)) continue;
      const [fx, fy, z] = SLOTS[si], kind = kinds[(seed + j) % kinds.length];
      const sz = Math.min(S.W, S.H) * (0.38 + z * 0.3) * (kind === 'phone' ? 0.62 : 1);
      const x = fx * S.W - t * 26 * S.u * z * (o.dir || 1) + Math.sin(t * 0.35 + i) * 14 * S.u, y = fy * S.H + Math.cos(t * 0.3 + i * 2) * 12 * S.u;
      slab(g, Sg, kind, x, y, sz, j); j++;
    }
    const g2 = B.getContext('2d'); g2.setTransform(1, 0, 0, 1, 0, 0); g2.clearRect(0, 0, bw, bh); g2.filter = `blur(${(o.blur || 2.2).toFixed(1)}px)`; g2.drawImage(A, 0, 0); g2.filter = 'none';
    const c = S.ctx; c.save(); c.globalAlpha *= (o.a != null ? o.a : 0.6) * (darkW(S.P) ? 1.3 : 1); c.drawImage(B, -S.W * 0.04, -S.H * 0.04, S.W * 1.08, S.H * 1.08); c.restore();
    if (o.scrim !== false) { const sc = o.scrim || { x: 0.5, y: 0.5, r: 0.5 }, gr = c.createRadialGradient(sc.x * S.W, sc.y * S.H, 0, sc.x * S.W, sc.y * S.H, Math.max(S.W, S.H) * sc.r); gr.addColorStop(0, rgba(S.P.bg, 0.85)); gr.addColorStop(0.55, rgba(S.P.bg, 0.45)); gr.addColorStop(1, rgba(S.P.bg, 0)); c.fillStyle = gr; c.fillRect(-S.W * 0.1, -S.H * 0.1, S.W * 1.2, S.H * 1.2); }
  }
  // a glass card (samples the field behind it) with the kit's stacked shadow
  const glassCard = (S, x, y, w, h, r) => L.glass(S.ctx, S.src, x, y, w, h, r, { u: S.u, dark: darkW(S.P), tint: darkW(S.P) ? 'rgba(20,20,22,0.55)' : 'rgba(255,255,255,0.62)', blur: 22 * S.u, chroma: false });

  /* ═════════ SET-UPS ═════════ */

  /* the crowd claim: a stream of capsules and star rows flies past the lens, the claim sits in the middle, then
     everything implodes into one accent dot (the seed dot the next shot opens from) */
  L.def('insert:capsule-swarm-claim', {
    kind: 'setup',
    plan(b, F) { const d = b.d || 4, tp = Tp(b, F, 0.1), imp = Math.max(tp.done + 0.7, d - 0.34); return { cues: { head: 0.1, headDone: tp.done, implode: imp }, events: [{ at: 0, event: 'hard-hit' }, ...tp.events, { at: imp, event: 'slide-out' }], exit: { kind: 'dot', x: 0.5, y: 0.5, r: 0.008 }, entry: { kind: 'dot', x: 0.5, y: 0.5, r: 0.008 }, min: tp.done + 1.1 }; },
    draw(S) {
      const c = S.ctx, b = S.b, k = prog(S.lt, S.at('implode'), 0.28), cx = S.W / 2, cy = S.H / 2;
      swarm(c, S, S.lt + 3, { implode: k, n: isTall(S) ? 190 : 230 });
      const g = c.createRadialGradient(cx, cy, 0, cx, cy, Math.min(S.W, S.H) * 0.55); g.addColorStop(0, rgba(S.P.bg, 0.72)); g.addColorStop(1, rgba(S.P.bg, 0)); c.fillStyle = g; c.fillRect(0, 0, S.W, S.H);
      const px = hp(S, b, 118), maxW = S.W * (isWide(S) ? 0.66 : 0.84), lay0 = L.layout(c, S.look, toks(b), { px, maxW, x: cx, y: 0, align: 'center', maxLines: 3 });
      const e = E.in(k);
      c.save(); c.globalAlpha *= 1 - E.in(clamp(k * 1.3)); c.translate(cx, cy); c.scale(1 - e * 0.94, 1 - e * 0.97); c.translate(-cx, -cy);
      L.headline(S, { px, maxW, x: cx, y: cy - lay0.H / 2, align: 'center', maxLines: 3 });
      c.restore();
      if (k > 0.55) L.circle(c, cx, cy, 0.008 * S.H * E.outBack(clamp((k - 0.55) / 0.45)), S.P.accent);
    },
  });

  /* the still question: a centred line with the accent on the viewer's word; the accent dot pops out of that word
     and travels to the centre while the lines pinch shut into their masks */
  L.def('insert:seed-dot-question', {
    kind: 'setup',
    plan(b, F) { const d = b.d || 4, tp = Tp(b, F, 0.08), pop = Math.max(tp.done + 0.9, d - 0.6); return { cues: { head: 0.08, headDone: tp.done, pop, eyebrow: 0 }, events: [...tp.events, { at: pop, event: 'pop' }, { at: pop + 0.3, event: 'accent' }], entry: { kind: 'dot', x: 0.5, y: 0.5, r: 0.01 }, exit: { kind: 'dot', x: 0.5, y: 0.5, r: 0.012 }, min: tp.done + 1.5 }; },
    draw(S) {
      const c = S.ctx, b = S.b, px = hp(S, b, 128), maxW = S.W * (isWide(S) ? 0.62 : 0.84), cx = S.W / 2;
      field(S, { scrim: { x: 0.5, y: 0.5, r: 0.32 }, a: 0.75 });
      const lay0 = L.layout(c, S.look, toks(b), { px, maxW, x: cx, y: 0, align: 'center', maxLines: 3 }), top = S.H / 2 - lay0.H / 2;
      const pop = S.at('pop'), pk = E.in(prog(S.lt, pop + 0.08, 0.22));
      if (b.text && b.text.eyebrow && L.eyebrowDraw) L.eyebrowDraw(S, b.text.eyebrow, cx, top - 50 * S.u);
      c.save(); const mid = top + lay0.H / 2, half = lay0.H / 2 + px * 0.4; c.beginPath(); c.rect(0, mid - half * (1 - pk), S.W, half * 2 * (1 - pk)); c.clip();
      const lay = L.headline(S, { px, maxW, x: cx, y: top, align: 'center', maxLines: 3 });
      c.restore();
      if (!lay) return;
      const aw = lay.words.find(w => w.tk.accent) || lay.words[lay.words.length - 1], dt = S.lt - pop;
      if (dt > 0) {
        const x0 = aw.x + aw.w / 2, y0 = aw.y + px * 0.28, m = E.io(prog(dt, 0.1, 0.42)), r = 0.012 * S.H * spring(dt, 'pop');
        const x = lerp(x0, S.W / 2, m), y = lerp(y0, S.H / 2, m) - Math.sin(Math.PI * m) * px * 0.5;
        L.circle(c, x, y, r, S.P.accent);
      }
    },
  });

  /* the mark beside the statement: the dot slides over, swells into the mark (accent to ink), the statement lands
     beside it, its last word gets a hand-drawn underline, and the mark splits open (the gap to fly through) */
  const markPos = (r, W, H) => (r > 1.3 ? { x: 0.27, y: 0.5 } : r < 0.77 ? { x: 0.5, y: 0.4 } : { x: 0.5, y: 0.36 });
  L.def('insert:mark-beside-statement', {
    kind: 'setup',
    plan(b, F) { const tp = Tp(b, F, 0.5), mp = markPos(ratioOf(F)); const ul = tp.done + 0.1, sp = tp.done + 0.55; return { cues: { dot: 0, head: 0.5, headDone: tp.done, underline: ul, split: sp }, events: [{ at: 0.3, event: 'pop' }, ...tp.events, { at: ul, event: 'accent' }, { at: sp, event: 'paper-pop' }], entry: { kind: 'dot', x: 0.5, y: 0.5, r: 0.012 }, exit: { kind: 'dot', x: mp.x, y: mp.y, r: 0.01 }, min: sp + 1.0 }; },
    draw(S) {
      const c = S.ctx, b = S.b, wide = isWide(S), mp = markPos(S.W / S.H), mx = mp.x * S.W, my = mp.y * S.H;
      const px = hp(S, b, wide ? 104 : 110), R = px * (wide ? 1.0 : 1.25);
      field(S, { scrim: { x: wide ? 0.45 : 0.5, y: 0.5, r: 0.48 }, a: 0.5 });
      const slide = E.io(prog(S.lt, 0, 0.3)), grow = spring(S.lt - 0.28, 'pop'), col = mix(S.P.accent, S.P.fg, E.out(prog(S.lt, 0.32, 0.3)));
      const x = lerp(S.W / 2, mx, slide), y = lerp(S.H / 2, my, slide), r = lerp(0.012 * S.H, R, clamp(grow, 0, 1.15));
      const sk = spring(S.lt - S.at('split'), 'pop');
      if (S.lt < 0.28) L.circle(c, x, y, 0.012 * S.H, S.P.accent);
      else mark(c, S, x, y, r, { col, split: sk, morph: E.out(prog(S.lt, 0.4, 0.4)) });
      const slot = wide ? { px, maxW: S.W * 0.9 - (mx + R * 1.5), x: mx + R * 1.5, y: my - px * 1.05, align: 'left', maxLines: 2 } : { px, maxW: S.W * 0.84, x: S.W / 2, y: my + R * 1.45, align: 'center', maxLines: 3 };
      const lay = L.headline(S, slot);
      if (lay && lay.words.length) { const lw = lay.words[lay.words.length - 1]; underline(c, lw.x - px * 0.02, lw.x + lw.w, lw.y + px * 0.2, px, E.out(prog(S.lt, S.at('underline'), 0.32)), S.P.accent, S.seed % 97); }
    },
  });

  /* the rules, locked: the headline on top, rule chips slide in sheared one per beat, an accent outline draws around
     them from the top centre and a padlock snaps into the gap */
  L.def('insert:locked-rule-chips', {
    kind: 'setup',
    plan(b, F) { const n = itemsOf(b, 4).length, tp = Tp(b, F, 0.05), c0 = Math.max(0.5, tp.done - 0.1), last = c0 + (n - 1) * 0.5, sl = last + 0.55; const r = ratioOf(F); return { cues: { head: 0.05, headDone: tp.done, chips: c0, seal: sl }, events: [...tp.events, ...Array.from({ length: n }, (_, i) => ({ at: c0 + i * 0.5, event: 'list-item' })), { at: sl, event: 'build' }, { at: sl + 0.36, event: 'click-ui' }], exit: { kind: 'rect', x: 0.5, y: r > 1.3 ? 0.6 : 0.58, w: r > 1.3 ? 0.42 : 0.8, h: 0.36 }, min: sl + 1.3 }; },
    draw(S) {
      const b = S.b, wide = isWide(S), list = itemsOf(b, 4);
      field(S, { scrim: { x: 0.5, y: 0.45, r: 0.5 }, a: 0.55, kinds: ['chips', 'grid', 'phone', 'chart'] });
      L.headline(S, { px: hp(S, b, wide ? 124 : 104), maxW: S.W * (wide ? 0.66 : 0.86), x: S.W / 2, y: S.H * (wide ? 0.06 : isTall(S) ? 0.14 : 0.06), align: 'center', maxLines: 2 });
      const w = wide ? Math.min(S.W * 0.52, 1000 * S.u) : S.W * 0.78, h = (list.length > 3 ? 104 : 120) * S.u;
      const R = chipStack(S, { x: S.W / 2, y: S.H * (wide ? 0.64 : 0.6), w, h, items: list, t0: S.at('chips') });
      seal(S, R, S.at('seal'));
    },
  });

  /* one tap a day: the line and an accent action pill on the left; the tap sends a ring across the frame that
     reveals a phone with a habit grid; day tiles fly out of the grid into a streak bar, one after another */
  const tapLayout = (r, W, H, u) => r > 1.3 ? { hx: 0.08, hy: 0.16, pill: { x: 0.08, y: 0.55 }, phone: { x: 0.73, y: 0.54, h: 0.98 }, bar: { x: 0.08, y: 0.76, w: 0.5 } } : r < 0.77 ? { hx: 0.08, hy: 0.08, pill: { x: 0.08, y: 0.25 }, phone: { x: 0.5, y: 0.6, h: 0.5 }, bar: { x: 0.08, y: 0.92, w: 0.84 } } : { hx: 0.08, hy: 0.1, pill: { x: 0.08, y: 0.4 }, phone: { x: 0.75, y: 0.6, h: 0.62 }, bar: { x: 0.08, y: 0.86, w: 0.46 } };
  L.def('insert:tap-to-streak', {
    kind: 'setup',
    plan(b, F) {
      const tp = Tp(b, F, 0.05), tap = Math.max(tp.done + 0.25, 0.9), n = 14, tiles = tap + 0.85, ev = [...tp.events, { at: tap, event: 'click-ui' }, { at: tap + 0.12, event: 'card-in' }, { at: tap + 0.45, event: 'build' }];
      for (let i = 0; i < n; i += 2) ev.push({ at: +(tiles + i * 0.09 + 0.38).toFixed(3), event: 'list-item' });
      const Ly = tapLayout(ratioOf(F)); return { cues: { head: 0.05, headDone: tp.done, pill: 0.3, tap, bar: tap + 0.45, tiles }, events: ev, entry: { kind: 'pill', x: Ly.pill.x + 0.06, y: Ly.pill.y, w: 0.12, h: 0.07 }, exit: { kind: 'rect', x: Ly.phone.x, y: Ly.phone.y, w: 0.25, h: Ly.phone.h }, min: tiles + n * 0.09 + 1.0 };
    },
    draw(S) {
      const c = S.ctx, b = S.b, Ly = tapLayout(S.W / S.H), wide = isWide(S), P = S.P;
      field(S, { scrim: { x: 0.25, y: 0.45, r: 0.5 }, a: 0.5, kinds: ['grid', 'chart', 'chips', 'phone'] });
      L.headline(S, { px: hp(S, b, wide ? 124 : 100), maxW: S.W * (wide ? 0.5 : 0.84), x: Ly.hx * S.W, y: Ly.hy * S.H, align: 'left', maxLines: 2 });
      const label = (b.data && b.data.action) || itemsOf(b, 1)[0], tap = S.at('tap');
      const ppx = 34 * S.u, pw = Math.max(160 * S.u, L.textW(c, S.look, label, { role: 'ui', px: ppx, weight: 650 }) + ppx * 2.2), ph = 84 * S.u, px0 = Ly.pill.x * S.W, py = Ly.pill.y * S.H;
      const pk = spring(S.lt - S.at('pill'), 'pop'), press = L.pressAt([tap], S.lt).p;
      if (pk > 0) { const s = clamp(pk, 0, 1.2) * (1 - press * 0.06); c.save(); c.translate(px0 + pw / 2, py); c.scale(s, s); c.translate(-(px0 + pw / 2), -py); L.card(c, px0, py - ph / 2, pw, ph, ph / 2, { fill: P.accent, lift: 0.5, u: S.u }); L.text(c, S.look, label, px0 + pw / 2, py + ppx * 0.36, { role: 'ui', px: ppx, weight: 650, color: L.onColor(P.accent), align: 'center', maxW: pw - ppx }); c.restore(); }
      // the touch: a soft grey fingertip that presses the pill
      const tk = prog(S.lt, tap - 0.3, 0.3), tout = prog(S.lt, tap + 0.15, 0.2);
      if (tk > 0 && tout < 1) { c.save(); c.globalAlpha *= E.out(tk) * (1 - tout) * 0.5; L.circle(c, px0 + pw * 0.62, py + (1 - E.out(tk)) * 40 * S.u, (26 - press * 5) * S.u, mix(P.bg, P.fg, 0.5)); c.restore(); }
      // the ring that reveals the phone
      const rk = prog(S.lt, tap + 0.02, 0.38), R = lerp(30 * S.u, cover(S, px0 + pw / 2, py), bezRing(rk));
      const ph2 = Ly.phone.h * S.H, pxp = Ly.phone.x * S.W, pyp = Ly.phone.y * S.H;
      let cells = null;
      if (rk > 0) {
        c.save(); c.beginPath(); c.arc(px0 + pw / 2, py, R, 0, Math.PI * 2); c.clip();
        const fill = 13 + clamp((S.lt - S.at('tiles')) / 1.2) * 0;
        const PF = L.get('ui:phone-frame');
        if (PF) PF.draw(S, { x: pxp, y: pyp + (1 - E.out(prog(S.lt, tap + 0.1, 0.4))) * 30 * S.u, h: ph2, content: (cc, sx, sy, sw, sh) => { cells = habitScreen(cc, S, sx, sy, sw, sh, { fill, action: label }).cells; } });
        c.restore();
        if (rk < 1) { c.save(); c.globalAlpha *= 1 - rk; c.strokeStyle = mix(P.accent, P.bg, 0.45); c.lineWidth = 6 * S.u; c.beginPath(); c.arc(px0 + pw / 2, py, R, 0, Math.PI * 2); c.stroke(); c.restore(); }
      }
      // the streak bar and the tiles flying into it
      const n = 18, tiles = 14, t0 = S.at('tiles'), landed = Array.from({ length: tiles }, (_, i) => clamp((S.lt - (t0 + i * 0.09 + 0.38)) / 0.12)).reduce((a, v) => a + v, 0);
      const slots = streakBar(c, S, Ly.bar.x * S.W, Ly.bar.y * S.H, Ly.bar.w * S.W, { n, build: prog(S.lt, S.at('bar'), 0.35), fill: landed });
      if (cells) for (let i = 0; i < tiles; i++) {
        const k = prog(S.lt, t0 + i * 0.09, 0.4); if (k <= 0 || k >= 1) continue;
        const src = cells[i % cells.length], dst = slots[i], e = E.io(k), mxp = (src.x + dst.x) / 2, myp = Math.min(src.y, dst.y) - S.H * 0.14;
        const x = (1 - e) * (1 - e) * src.x + 2 * (1 - e) * e * mxp + e * e * dst.x, y = (1 - e) * (1 - e) * src.y + 2 * (1 - e) * e * myp + e * e * dst.y, s = lerp(src.s, dst.s, e);
        c.save(); c.translate(x, y); c.rotate((1 - e) * (1.6 + rand(i + 3) * 2.2) * (i % 2 ? 1 : -1)); L.rr(c, -s / 2, -s / 2, s, s, s * 0.22); c.fillStyle = P.accent; c.shadowColor = 'rgba(0,0,0,0.15)'; c.shadowBlur = 8 * S.u; c.shadowOffsetY = 4 * S.u; c.fill(); c.restore();
      }
    },
  });
  const bezRing = L.bez(0.3, 0, 0.1, 1);

  /* the verdict: black stage, the line condenses into place, a dark window spins a drum of outcomes and lands on one */
  L.def('insert:verdict-drum-stage', {
    kind: 'setup',
    plan(b, F) { const tp = Tp(b, F, 0.05), list = itemsOf(b, 5), t0 = Math.max(tp.done + 0.15, 0.6), tg = (b.data && b.data.pick) || 0; const r = ratioOf(F); return { cues: { head: 0.05, headDone: tp.done, drum: t0, land: t0 + 1.3 }, events: [{ at: 0, event: 'scene' }, ...tp.events, ...drumTicks(t0, Math.max(3, list.length), tg % Math.max(3, list.length)), { at: t0 + 1.3, event: 'stat' }], exit: { kind: 'pill', x: 0.5, y: r > 1.3 ? 0.6 : 0.56, w: r > 1.3 ? 0.3 : 0.5, h: 0.08 }, min: t0 + 2.2 }; },
    draw(S) {
      const b = S.b, wide = isWide(S); let list = itemsOf(b, 5); while (list.length < 3) list = list.concat(list);
      field(S, { scrim: { x: 0.5, y: 0.4, r: 0.55 }, a: 0.5, kinds: ['chart', 'phone', 'grid', 'chips'] });
      L.headline(S, { px: hp(S, b, wide ? 120 : 100), maxW: S.W * (wide ? 0.66 : 0.86), x: S.W / 2, y: S.H * (wide ? 0.07 : 0.12), align: 'center', maxLines: 2 });
      const w = wide ? Math.min(S.W * 0.62, 1180 * S.u) : S.W * 0.88, h = w * (wide ? 0.42 : 0.5);
      drum(S, { x: S.W / 2, y: S.H * (wide ? 0.6 : 0.56), w, h, labels: list, target: ((b.data && b.data.pick) || 0) % list.length, t0: S.at('drum') });
    },
  });

  /* the match cut into the app: the phone's outcome badge at 5x close-up on the cut, a focus ring blooms off it,
     the camera pulls all the way back to the phone, and the line lands beside it */
  const closeLayout = r => (r > 1.3 ? { x: 0.7, y: 0.52, h: 0.86, hx: 0.08, hy: 0.36 } : r < 0.77 ? { x: 0.5, y: 0.64, h: 0.6, hx: 0.08, hy: 0.08 } : { x: 0.72, y: 0.54, h: 0.76, hx: 0.08, hy: 0.3 });
  L.def('insert:verdict-phone-closeup', {
    kind: 'setup',
    plan(b, F) { const tp = Tp(b, F, 0.95); return { cues: { pull: 0.5, head: 0.95, headDone: tp.done }, events: [{ at: 0, event: 'hard-hit' }, { at: 0.5, event: 'slide-out' }, ...tp.events], entry: { kind: 'pill', x: 0.5, y: 0.5, w: 0.3, h: 0.08 }, exit: { kind: 'rect', x: closeLayout(ratioOf(F)).x, y: 0.52, w: 0.26, h: 0.8 }, min: tp.done + 1.2 }; },
    draw(S) {
      const c = S.ctx, b = S.b, Lc = closeLayout(S.W / S.H), d = b.data || {}, P = S.P;
      const PF = L.get('ui:phone-frame'); if (!PF) return;
      const ph = Lc.h * S.H, x = Lc.x * S.W, y = Lc.y * S.H, w = ph * 0.49, bz = 0.035 * w;
      const sw = w - 2 * bz, sh = ph - 2 * bz, sx = x - w / 2 + bz, sy = y - ph / 2 + bz;
      // the badge position on screen (resultScreen geometry: measured once without drawing)
      const u = sw / 400, lines = String(plain(b) || 'Your result').split(/\s+/).length > 3 ? 2 : 1;
      const lab = String((d.verdict || itemsOf(b, 1)[0])).toUpperCase(); L.setFont(c, S.look, 'ui', 13 * u, 700);
      const bwid = c.measureText(lab).width + 34 * u + lab.length * 0.12 * 13 * u;
      const f = { x: sx + 26 * u + 18 * u + bwid / 2, y: sy + sh * 0.1 + 14 * u + 34 * u + lines * 36 * u + 18 * u + 15 * u };
      const z0 = 5, z = S.lt < S.at('pull') ? lerp(z0, z0 * 0.94, S.lt / S.at('pull')) : L.logLerp(z0 * 0.94, 1, E.hard(prog(S.lt, S.at('pull'), 0.36)));
      const m = (z - 1) / (z0 - 1), dr = noise(S.lt * 0.8, 5) * 8 * S.u * m;
      c.save(); c.translate(lerp(f.x, S.W / 2, m) + dr, lerp(f.y, S.H / 2, m)); c.scale(z, z); c.translate(-f.x, -f.y);
      field(S, { scrim: { x: Lc.hx + 0.15, y: 0.45, r: 0.45 }, a: 0.5, kinds: ['chart', 'grid', 'chips', 'phone'] });
      PF.draw(S, { x, y, h: ph, content: (cc, a, bb, ww, hh) => resultScreen(cc, S, a, bb, ww, hh, { title: plain(b) || 'Your result is in', verdict: lab, line: d.number ? `${numStr(d.number)} ${d.number.label || ''}` : (b.text && b.text.sub) || '', metric: (d.number && d.number.label) || '' }) });
      c.restore();
      const rk = prog(S.lt, 0, 0.3); if (rk < 1) { c.save(); c.globalAlpha *= (1 - rk) * 0.8; L.circle(c, S.W / 2, S.H / 2, lerp(80, 1000, E.out(rk)) * S.u, null, mix(P.accent, P.bg, 0.4), 4 * S.u); c.restore(); }
      const hk = prog(S.lt, S.at('head') - 0.1, 0.1);
      if (hk > 0 && toks(b).length) L.headline(S, { px: hp(S, b, isWide(S) ? 84 : 104), maxW: isWide(S) ? S.W * 0.44 : isTall(S) ? S.W * 0.84 : S.W * 0.43, x: Lc.hx * S.W, y: Lc.hy * S.H, align: 'left', maxLines: 3 });
    },
  });

  /* the result as one number: the label line and a huge accent number counting up on the left, the phone with the
     result screen on the right; the phone's chart then lifts out of the device and re-settles big under the number */
  const statLayout = r => (r > 1.3 ? { tx: 0.08, ty: 0.12, numY: 0.5, phone: { x: 0.77, y: 0.52, h: 0.88 }, chart: { x: 0.08, y: 0.63, w: 0.52, h: 0.25 } } : r < 0.77 ? { tx: 0.08, ty: 0.06, numY: 0.27, phone: { x: 0.5, y: 0.72, h: 0.46 }, chart: { x: 0.08, y: 0.33, w: 0.84, h: 0.12 } } : { tx: 0.08, ty: 0.08, numY: 0.4, phone: { x: 0.78, y: 0.6, h: 0.66 }, chart: { x: 0.08, y: 0.54, w: 0.5, h: 0.28 } });
  L.def('insert:stat-beside-phone', {
    kind: 'setup',
    plan(b, F) { const tp = Tp(b, F, 0.05), num = tp.done * 0.6 + 0.1, lift = Math.max(num + 0.9, 1.3); return { cues: { head: 0.05, headDone: tp.done, num, lift, band: lift + 0.75 }, events: [...tp.events, { at: num, event: 'riffle' }, { at: num + 0.7, event: 'stat' }, { at: lift, event: 'build' }], exit: { kind: 'dot', x: 0.3, y: 0.72, r: 0.012 }, min: lift + 1.8 }; },
    draw(S) {
      const c = S.ctx, b = S.b, d = b.data || {}, P = S.P, Ls = statLayout(S.W / S.H), wide = isWide(S);
      const n = d.number || { value: 3, suffix: 'x', label: '' };
      field(S, { scrim: { x: 0.3, y: 0.45, r: 0.55 }, a: 0.4, kinds: ['grid', 'chips', 'chart', 'phone'] });
      const colW = (wide ? 0.5 : isTall(S) ? 0.84 : 0.52) * S.W;
      L.headline(S, { px: hp(S, b, wide ? 80 : isTall(S) ? 100 : 76), maxW: colW, x: Ls.tx * S.W, y: Ls.ty * S.H, align: 'left', maxLines: 2 });
      const nk = E.out(prog(S.lt, S.at('num'), 0.7)), str = numStr(n, nk), nx = Ls.tx * S.W;
      let npx = Math.min(S.H * (wide ? 0.2 : 0.14), S.W * 0.18); L.setFont(c, S.look, 'numeral', npx, 700); const nw = L.textW(c, S.look, numStr(n, 1), { role: 'numeral', px: npx, weight: 700, tracking: -0.04 }); if (nw > colW) npx *= colW / nw;
      const rise = E.out(prog(S.lt, S.at('num'), 0.4));
      c.save(); c.beginPath(); c.rect(nx - 20, Ls.numY * S.H - npx * 0.95, colW + 40, npx * 1.25); c.clip();
      L.text(c, S.look, str, nx, Ls.numY * S.H + (1 - rise) * npx, { role: 'numeral', px: npx, weight: 700, color: P.accent, tracking: -0.04 });
      c.restore();
      if (n.label) { const lk = E.out(prog(S.lt, S.at('num') + 0.25, 0.4)); c.save(); c.globalAlpha *= lk; L.text(c, S.look, n.label, nx + 4 * S.u, Ls.numY * S.H + npx * 0.32 + 10 * S.u, { role: 'micro', px: 20 * S.u, color: P.dim, upper: true, maxW: colW }); c.restore(); }
      const PF = L.get('ui:phone-frame'); let chartR = null;
      if (PF) PF.draw(S, { x: Ls.phone.x * S.W, y: Ls.phone.y * S.H, h: Ls.phone.h * S.H, t0: 0, content: (cc, a, bb, ww, hh) => { chartR = resultScreen(cc, S, a, bb, ww, hh, { title: plain(b), verdict: itemsOf(b, 1)[0], line: `${numStr(n)} ${n.label || ''}`, metric: n.label || '', hideChart: S.lt > S.at('lift') }).chart; } });
      // the chart leaves the phone: its rect flies from the phone to the big slot while the line draws right to left
      const lk = prog(S.lt, S.at('lift'), 0.5), sk = E.io(lk), big = { x: Ls.chart.x * S.W, y: Ls.chart.y * S.H, w: Ls.chart.w * S.W, h: Ls.chart.h * S.H };
      if (lk > 0 && chartR) {
        const R = { x: lerp(chartR.x, big.x, sk), y: lerp(chartR.y, big.y, sk), w: lerp(chartR.w, big.w, sk), h: lerp(chartR.h, big.h, sk) };
        const settle = spring(S.lt - S.at('lift') - 0.5, 'soft');
        stepChart(c, R, { col: P.accent, lw: lerp(2, 5, sk) * S.u, draw: lerp(0.35, 1, E.out(lk)), rev: true, band: E.out(prog(S.lt, S.at('band'), 0.3)), bandCol: mix(P.bg, P.accentRaw, 0.1), guide: P.fg, guideA: clamp(settle) * 0.6, seed: 7, n: 90 });
      }
    },
  });

  /* the chart as the hero: the line across the frame, high, through a wash band, then stepping down and staying there;
     the change sits on the step as an accent pill */
  L.def('insert:step-chart-proof', {
    kind: 'setup',
    plan(b, F) { const tp = Tp(b, F, 0.05); return { cues: { head: 0.05, headDone: tp.done, draw: 0.1, band: 0.75, delta: 1.15 }, events: [...tp.events, { at: 0.1, event: 'build' }, { at: 1.15, event: 'stat' }], exit: { kind: 'dot', x: 0.5, y: 0.7, r: 0.012 }, min: 2.6 }; },
    draw(S) {
      const c = S.ctx, b = S.b, P = S.P, wide = isWide(S), n = (b.data || {}).number;
      field(S, { scrim: { x: 0.5, y: 0.55, r: 0.75 }, a: 0.45, kinds: ['phone', 'chips', 'grid', 'chart'] });
      L.headline(S, { px: hp(S, b, wide ? 116 : 96), maxW: S.W * (wide ? 0.62 : 0.84), x: S.W * 0.08, y: S.H * (wide ? 0.07 : 0.06), align: 'left', maxLines: 2 });
      const R = { x: S.W * 0.08, y: S.H * (wide ? 0.36 : 0.34), w: S.W * 0.84, h: S.H * (wide ? 0.48 : 0.42) };
      // axis: baseline and ticks
      c.save(); c.strokeStyle = rgba(P.fg, 0.14); c.lineWidth = 1.5 * S.u; c.beginPath(); c.moveTo(R.x, R.y + R.h + 24 * S.u); c.lineTo(R.x + R.w * E.out(prog(S.lt, 0.2, 0.6)), R.y + R.h + 24 * S.u); c.stroke(); c.restore();
      for (let i = 0; i <= 12; i++) { const k = E.out(prog(S.lt, 0.25 + i * 0.03, 0.3)); if (k > 0) L.circle(c, R.x + R.w * i / 12, R.y + R.h + 24 * S.u, 3 * S.u * k, rgba(P.fg, 0.3)); }
      const pts = stepChart(c, R, { col: P.accent, lw: 6 * S.u, draw: E.io(prog(S.lt, S.at('draw'), 1.1)), band: E.out(prog(S.lt, S.at('band'), 0.35)), bandCol: mix(P.bg, P.accentRaw, 0.1), guide: P.fg, guideA: E.out(prog(S.lt, S.at('band'), 0.4)), seed: 11, n: 110 });
      if (n) { const k = spring(S.lt - S.at('delta'), 'pop'); if (k > 0) { const x = R.x + R.w * 0.8, y = R.y - R.h * 0.02; const lab = numStr(n) + (n.label ? '  ' + n.label : ''), px = 34 * S.u; const w = L.textW(c, S.look, lab, { role: 'ui', px, weight: 650 }) + px * 1.6; c.save(); c.translate(x, y); c.scale(k, k); c.translate(-x, -y); L.card(c, x - w / 2, y - px, w, px * 2, px, { fill: P.accent, lift: 0.5, u: S.u }); L.text(c, S.look, lab, x, y + px * 0.36, { role: 'ui', px, weight: 650, color: L.onColor(P.accent), align: 'center' }); c.restore(); L.line(c, x, y + px, x, R.y + R.h * 0.62, rgba(P.accent, 0.5 * clamp(k)), 2 * S.u, [4 * S.u, 5 * S.u]); } }
      void pts;
    },
  });

  /* the branch picker: a done root node with a check fans thin edges out to candidate pills; dots flow along the
     edges, a selection ring hops between candidates on the eighths and commits on one */
  const graphLayout = (r, n) => { const tallR = r < 0.77, sq = !tallR && r <= 1.3; const root = tallR ? { x: 0.14, y: 0.6 } : { x: 0.14, y: sq ? 0.62 : 0.64 }; const cols = tallR ? [0.5, 0.72] : sq ? [0.48, 0.74] : [0.46, 0.72]; const y0 = tallR ? 0.4 : 0.4, y1 = tallR ? 0.84 : 0.9; return { root, c: Array.from({ length: n }, (_, i) => ({ x: cols[i % 2], y: n > 1 ? lerp(y0, y1, i / (n - 1)) : (y0 + y1) / 2 })) }; };
  L.def('insert:branch-picker-graph', {
    kind: 'setup',
    plan(b, F) {
      const n = Math.max(2, itemsOf(b, 5).length), tp = Tp(b, F, 0.05), root = 0.15, pills = Math.max(0.3, tp.done * 0.45), hop0 = pills + n * 0.075 + 0.35, hops = 8, commit = hop0 + hops * 0.2, pick = ((b.data && b.data.pick) != null ? b.data.pick : Math.min(2, n - 1)) % n;
      const g = graphLayout(ratioOf(F), n), ev = [{ at: root, event: 'pop' }, ...tp.events, { at: pills, event: 'cascade' }];
      for (let i = 0; i < hops; i++) ev.push({ at: +(hop0 + i * 0.2).toFixed(3), event: 'click-ui' });
      ev.push({ at: commit, event: 'accent' });
      return { cues: { head: 0.05, headDone: tp.done, root, pills, hop0, commit }, events: ev, entry: { kind: 'dot', x: g.root.x, y: g.root.y, r: 0.02 }, exit: { kind: 'dot', x: g.c[pick].x, y: g.c[pick].y, r: 0.02 }, min: commit + 1.1 };
    },
    draw(S) {
      const c = S.ctx, b = S.b, P = S.P, list = itemsOf(b, 5), n = list.length, g = graphLayout(S.W / S.H, Math.max(n, 1)), wide = isWide(S);
      field(S, { scrim: { x: 0.45, y: 0.55, r: 0.7 }, a: 0.42, kinds: ['chart', 'phone', 'grid', 'chips'] });
      L.headline(S, { px: hp(S, b, wide ? 112 : 92), maxW: S.W * (wide ? 0.6 : 0.84), x: S.W * 0.08, y: S.H * (wide ? 0.07 : 0.06), align: 'left', maxLines: 2 });
      const pick = ((b.data && b.data.pick) != null ? b.data.pick : Math.min(2, n - 1)) % n, commit = S.at('commit'), ck = E.out(prog(S.lt, commit, 0.3));
      const rx = g.root.x * S.W, ry = g.root.y * S.H, rr = 58 * S.u * clamp(spring(S.lt - S.at('root'), 'pop'), 0, 1.2);
      const pills = list.map((s, i) => { const p = g.c[i]; return { s, x: p.x * S.W, y: p.y * S.H, pop: E.outBack(prog(S.lt, S.at('pills') + i * 0.075, 0.3)) }; });
      // edges (cubic), drawn out from the root; the chosen edge thickens in the accent on commit
      pills.forEach((p, i) => {
        const w = L.textW(c, S.look, p.s, { role: 'ui', px: 40 * S.u, weight: 600 }) + 40 * S.u * 1.7, ex = p.x - w / 2, ek = E.out(prog(S.lt, S.at('pills') - 0.15 + i * 0.05, 0.4));
        if (ek <= 0) return;
        const isP = i === pick, cA = ck > 0 ? (isP ? 1 : 1 - ck * 0.6) : 1;
        const bx = t => { const m = 1 - t; return [m * m * m * rx + 3 * m * m * t * (rx + (ex - rx) * 0.45) + 3 * m * t * t * (rx + (ex - rx) * 0.55) + t * t * t * ex, m * m * m * ry + 3 * m * m * t * ry + 3 * m * t * t * p.y + t * t * t * p.y]; };
        c.save(); c.globalAlpha *= cA; c.strokeStyle = isP && ck > 0 ? P.accent : rgba(P.fg, 0.3); c.lineWidth = (isP ? lerp(2, 5, ck) : 2) * S.u; c.beginPath();
        for (let k = 0; k <= 30 * ek; k++) { const q = bx(k / 30); if (k) c.lineTo(q[0], q[1]); else c.moveTo(q[0], q[1]); } c.stroke();
        if (ek >= 1) for (let j = 0; j < 2; j++) { const tt = ((rand(i * 7 + j) + S.lt * 0.42 + j * 0.5) % 1), q = bx(tt); L.circle(c, q[0], q[1], 3.2 * S.u * Math.sin(Math.PI * tt), isP && ck > 0 ? P.accent : rgba(P.fg, 0.45)); }
        c.restore();
      });
      const rects = pills.map((p, i) => optPill(S, p.x, p.y, p.s, { pop: p.pop, px: 40, fill: i === pick ? ck : 0, alpha: i !== pick ? 1 - ck * 0.55 : 1 }));
      hopRing(S, rects, S.at('hop0'), hopSeq(n, pick, 8, S.seed % 1000), 0.2, deepOf(P));
      if (ck > 0 && ck < 1) { const r = rects[pick]; c.save(); c.globalAlpha *= 1 - ck; L.rr(c, r.x - ck * 26 * S.u, r.y - ck * 26 * S.u, r.w + ck * 52 * S.u, r.h + ck * 52 * S.u, r.h / 2 + ck * 26 * S.u); c.strokeStyle = P.accent; c.lineWidth = 2 * S.u; c.stroke(); c.restore(); }
      if (rr > 0) { L.circle(c, rx, ry, rr, P.accent); L.icon(c, 'check', rx, ry, rr * 0.95, L.onColor(P.accent), 2.6); const lab = (b.text && b.text.eyebrow) || brandOf(S).name; L.text(c, S.look, lab, rx, ry + 58 * S.u + 44 * S.u, { role: 'ui', px: 32 * S.u, weight: 600, color: P.fg, align: 'center', maxW: S.W * 0.2 }); }
    },
  });

  /* dust re-forms a glyph: square dust swirls across the black frame, balls up, opens into a ring, settles into the
     outline of the line's first letter, fills in solid and shrinks into the line itself */
  const GLY = {};
  function glyphPts(S, ch, px, n) {
    const key = ch + '|' + Math.round(px) + '|' + n + '|' + (S.look.id || ''); if (GLY[key]) return GLY[key];
    if (typeof document === 'undefined') return [];
    const s = Math.ceil(px * 1.5), cv = L.buffer('l04-glyph', s, s); if (!cv) return [];
    const g = cv.getContext('2d', { willReadFrequently: true }); g.clearRect(0, 0, s, s); g.fillStyle = '#000'; g.font = L.font(S.look, 'display', px, 700); g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillText(ch, s / 2, s / 2 + px * 0.36);
    const d = g.getImageData(0, 0, s, s).data, all = [], st = Math.max(2, Math.round(px / 90));
    for (let y = 0; y < s; y += st) for (let x = 0; x < s; x += st) if (d[(y * s + x) * 4 + 3] > 128) all.push([x - s / 2, y - s / 2]);
    const out = []; for (let i = 0; i < n && all.length; i++) out.push(all[Math.floor(rand(i * 31 + 7) * all.length)]);
    return (GLY[key] = out);
  }
  function dustField(S, t, o) {
    const c = S.ctx, P = S.P, N = o.n || 1500, cx = S.W / 2, cy = S.H / 2, gp = o.glyph, gx = o.gx || cx, gy = o.gy || cy;
    const Rb = Math.min(S.W, S.H) * 0.15, Rr = Math.min(S.W, S.H) * 0.2;
    const k1 = E.io(prog(t, 0.55, 0.25)), k2 = E.io(prog(t, 0.82, 0.16)), k3 = E.io(prog(t, 1.0, 0.2)), fade = 1 - clamp((t - 1.2) / 0.15);
    const after = clamp((t - 1.15) / 0.5);
    if (after > 0) { // what is left of the dust keeps orbiting the line, far out and faint
      c.save(); c.globalAlpha *= after * 0.5;
      for (let i = 0; i < 420; i++) { const r1 = rand(i * 5 + 11), r3 = rand(i * 5 + 13), a = r1 * 6.28 + t * (0.12 + r3 * 0.1), rr = Math.min(S.W, S.H) * (0.34 + r3 * 0.5); const s = (2 + r1 * 3) * S.u; c.fillStyle = i % 11 === 0 ? P.accent : rgba(P.fg, 0.3 + r3 * 0.5); c.fillRect(cx + Math.cos(a) * rr * (S.W > S.H ? 1.5 : 1) - s / 2, cy + Math.sin(a) * rr * 0.75 - s / 2, s, s); }
      c.restore();
    }
    if (fade <= 0) return;
    c.save(); c.globalAlpha *= fade;
    for (let i = 0; i < N; i++) {
      const r1 = rand(i * 3 + 1), r2 = rand(i * 3 + 2), r3 = rand(i * 3 + 3);
      // swirl: a wide band that winds in toward the centre
      const a = r1 * 6.28 + t * (1.1 + r2 * 0.8), rad = lerp(Math.hypot(S.W, S.H) * 0.48, Math.min(S.W, S.H) * 0.25, E.out(clamp(t / 0.7))) * (0.35 + r3 * 0.75);
      let x = cx + Math.cos(a) * rad * (S.W > S.H ? 1.25 : 0.9), y = cy + Math.sin(a) * rad * 0.62;
      const ba = r2 * 6.28, br = Math.sqrt(r3) * Rb; x = lerp(x, cx + Math.cos(ba) * br, k1); y = lerp(y, cy + Math.sin(ba) * br, k1);
      const ra = r1 * 6.28 + t * 0.6, rj = Rr * (0.92 + r3 * 0.16); x = lerp(x, cx + Math.cos(ra) * rj, k2 * (1 - k3)); y = lerp(y, cy + Math.sin(ra) * rj, k2 * (1 - k3));
      if (gp && gp.length && k3 > 0) { const q = gp[i % gp.length]; x = lerp(x, gx + q[0], k3); y = lerp(y, gy + q[1], k3); }
      const j = (1 - k3) * 2.5 * S.u; x += noise(t * 3 + i, 1) * j; y += noise(t * 3 + i, 2) * j;
      const s = (3.2 + r2 * 2.4) * S.u * (1 - k3 * 0.3);
      c.fillStyle = i % 9 === 0 ? P.accent : rgba(P.fg, 0.55 + r3 * 0.45); c.fillRect(x - s / 2, y - s / 2, s, s);
    }
    c.restore();
  }
  L.def('insert:dust-glyph-reform', {
    kind: 'setup',
    plan(b, F) { return { cues: { dust: 0.05, solid: 1.18, shrink: 1.4, head: 1.62, headDone: 2.1 }, events: [{ at: 0.05, event: 'scene' }, { at: 0.6, event: 'build' }, { at: 1.18, event: 'hard-hit' }, { at: 1.62, event: 'key-word' }], entry: { kind: 'dot', x: 0.5, y: 0.5, r: 0.03 }, exit: { kind: 'dot', x: 0.5, y: 0.5, r: 0.012 }, min: 2.9 }; },
    draw(S) {
      const c = S.ctx, b = S.b, P = S.P, tk = toks(b), first = (tk[0] && tk[0].s) || brandOf(S).name || 'A', ch = first[0];
      const fpx = Math.min(S.H * 0.44, S.W * 0.4), t = S.lt - S.at('dust');
      const px = hp(S, b, 96), lay = L.layout(c, S.look, tk.length ? tk : [{ s: ch }], { px, maxW: S.W * 0.8, x: S.W / 2, y: S.H / 2 - px * 0.55, align: 'center', maxLines: 2 });
      const w0 = lay.words[0]; L.setFont(c, S.look, w0.role, w0.px); try { c.letterSpacing = w0.tr.toFixed(2) + 'px'; } catch (e) { /* */ }
      const chW = c.measureText(ch).width; reset(c);
      const gp = glyphPts(S, ch, fpx, 1500);
      dustField(S, t, { glyph: gp, gx: S.W / 2, gy: S.H / 2 });
      const sk = E.io(prog(S.lt, S.at('shrink'), 0.3)), solid = clamp((S.lt - S.at('solid') + 0.05) / 0.12);
      if (solid > 0) {
        const tx = lerp(S.W / 2, w0.x + chW / 2, sk), ty = lerp(S.H / 2, w0.y - w0.px * 0.36, sk), s = lerp(1, w0.px / fpx, sk);
        c.save(); c.globalAlpha *= solid; c.translate(tx, ty); c.scale(s, s);
        L.text(c, S.look, ch, 0, fpx * 0.36, { role: 'display', px: fpx, weight: 700, color: P.fg, align: 'center' }); c.restore();
      }
      const hk = E.out(prog(S.lt, S.at('head'), 0.45));
      if (hk > 0) for (const w of lay.words) {
        const part = w.i === 0 ? Object.assign({}, w, { s: w.s.slice(1), x: w.x + chW }) : w; if (!part.s) continue;
        c.save(); c.beginPath(); c.rect(part.x - 4, w.y - w.px * 1.05, S.W, w.px * 1.4); c.clip(); wd(S, part, { a: 1, dy: (1 - hk) * w.px * 1.1 }); c.restore();
      }
    },
  });

  /* ═════════ END CARDS ═════════ */

  /* the seed dot pops in, swells into the mark (accent to the world's ink), splits open; the wordmark rises under it
     and the address fades in last */
  L.def('end_card:split-mark-lockup', {
    kind: 'end',
    plan(b) { return { cues: { dot: 0.0, grow: 0.22, split: 0.6, mark: 0.9, host: 1.25 }, events: [{ at: 0.02, event: 'pop' }, { at: 0.6, event: 'paper-pop' }, { at: 0.9, event: 'key-word' }, { at: 1.25, event: 'cta' }], entry: { kind: 'dot', x: 0.5, y: 0.5, r: 0.012 } }; },
    draw(S) {
      const c = S.ctx, B = brandOf(S), P = S.P, cx = S.W / 2;
      field(S, { scrim: { x: 0.5, y: 0.5, r: 0.45 }, a: 0.4 });
      const R = Math.min(S.H, S.W) * 0.085, lift = E.io(prog(S.lt, S.at('mark') - 0.1, 0.5)), my = S.H * lerp(0.5, 0.4, lift);
      const g = spring(S.lt - S.at('grow'), 'pop'), r = S.lt < S.at('grow') ? 0.012 * S.H * spring(S.lt, 'pop') : lerp(0.012 * S.H, R, clamp(g, 0, 1.12));
      mark(c, S, cx, my, r, { col: mix(P.accent, P.fg, E.out(prog(S.lt, S.at('grow') + 0.1, 0.35))), split: spring(S.lt - S.at('split'), 'pop'), morph: E.out(prog(S.lt, S.at('grow'), 0.4)) });
      const px = Math.min(S.H * 0.13, S.W * 0.1) * (B.name.length > 9 ? 9 / B.name.length : 1), wy = my + R + px * 1.15, k = E.out(prog(S.lt, S.at('mark'), 0.6));
      c.save(); c.beginPath(); c.rect(0, wy - px * 1.05, S.W, px * 1.35); c.clip();
      L.text(c, S.look, B.name, cx, wy + (1 - k) * px * 1.1, { role: 'wordmark', px, weight: 700, color: P.fg, align: 'center', tracking: -0.04, maxW: S.W * 0.8 }); c.restore();
      const hk = E.out(prog(S.lt, S.at('host'), 0.5)); if (hk > 0 && (B.host || B.tagline)) { c.save(); c.globalAlpha *= hk; L.text(c, S.look, B.host || B.tagline, cx, wy + px * 0.62 + (1 - hk) * 8 * S.u, { role: 'ui', px: px * 0.24, color: P.dim, align: 'center', maxW: S.W * 0.8 }); c.restore(); }
    },
  });

  /* the wordmark squeezes into its first letter, the letter collapses to the dot, the dot swells into the mark;
     then the wordmark returns small under the mark with the address */
  L.def('end_card:wordmark-squeeze-mark', {
    kind: 'end',
    plan(b) { return { cues: { word: 0.05, squeeze: 0.95, mark: 1.25, split: 1.5, lock: 1.75, host: 2.0 }, events: [{ at: 0.05, event: 'key-word' }, { at: 0.95, event: 'slide-out' }, { at: 1.25, event: 'pop' }, { at: 1.75, event: 'cta' }], min: 3.0 }; },
    draw(S) {
      const c = S.ctx, B = brandOf(S), P = S.P, cx = S.W / 2, name = B.name || 'Brand';
      const px = Math.min(S.H * 0.2, S.W * 0.15) * (name.length > 7 ? 7 / name.length : 1);
      field(S, { scrim: { x: 0.5, y: 0.5, r: 0.45 }, a: 0.4 });
      const ws = [...name].map(ch => L.textW(c, S.look, ch, { role: 'wordmark', px, weight: 700, tracking: -0.04 })), total = ws.reduce((a, w) => a + w, 0);
      const sq = E.in(prog(S.lt, S.at('squeeze'), 0.3)), rise = E.out(prog(S.lt, S.at('word'), 0.5)), y = S.H / 2 + px * 0.34;
      if (sq < 1) {
        let x = cx - total / 2; const x0 = x + ws[0] / 2;
        c.save(); c.beginPath(); c.rect(0, y - px * 1.0, S.W, px * 1.3); c.clip();
        [...name].forEach((ch, i) => { const xi = x + ws[i] / 2, tx = lerp(xi, x0 + (i ? ws[0] * 0.2 : 0), sq); const a = i === 0 ? 1 - clamp((sq - 0.75) / 0.25) : 1 - clamp(sq * 1.4); c.save(); c.globalAlpha *= a; c.translate(tx, y + (1 - rise) * px * 1.1); c.scale(i ? 1 - sq * 0.8 : 1 - sq * 0.85, i ? 1 : 1 - sq * 0.85); L.text(c, S.look, ch, 0, 0, { role: 'wordmark', px, weight: 700, color: P.fg, align: 'center', tracking: 0 }); c.restore(); x += ws[i]; });
        c.restore();
      }
      const mk = S.lt - S.at('mark'), lock = E.io(prog(S.lt, S.at('lock'), 0.45));
      const x0 = lerp(cx - total / 2 + ws[0] / 2, cx, clamp(mk / 0.25)), R = Math.min(S.H, S.W) * 0.08, my = lerp(S.H / 2, S.H * 0.42, lock);
      if (sq > 0.85) { const r = mk < 0 ? 0.012 * S.H : lerp(0.012 * S.H, R, clamp(spring(mk, 'pop'), 0, 1.12)); mark(c, S, mk < 0 ? x0 : lerp(x0, cx, E.io(clamp(mk / 0.25))), mk < 0 ? S.H / 2 : my, r, { col: mk < 0.1 ? P.accent : mix(P.accent, P.fg, clamp((mk - 0.1) / 0.3)), split: spring(S.lt - S.at('split'), 'pop'), morph: clamp(mk / 0.4) }); }
      if (lock > 0) { const spx = px * 0.42, wy = S.H * 0.42 + R + spx * 1.2; c.save(); c.beginPath(); c.rect(0, wy - spx * 1.05, S.W, spx * 1.35); c.clip(); L.text(c, S.look, name, cx, wy + (1 - lock) * spx * 1.1, { role: 'wordmark', px: spx, weight: 700, color: P.fg, align: 'center', tracking: -0.04 }); c.restore(); }
      const hk = E.out(prog(S.lt, S.at('host'), 0.5)); if (hk > 0 && B.host) { c.save(); c.globalAlpha *= hk; L.text(c, S.look, B.host, cx, S.H * 0.42 + R + px * 0.42 * 1.2 + px * 0.3, { role: 'ui', px: px * 0.12, color: P.dim, align: 'center' }); c.restore(); }
    },
  });

  /* ═════════ TYPE TREATMENTS ═════════ */

  /* depth stack: words arrive ten a second from in front of the lens (bigger, grey, soft) and snap into place;
     a centred line re-centres as it grows */
  const depthGap = n => (n > 8 ? 0.075 : 0.1);
  L.def('effect:type-depth-stack', {
    kind: 'type',
    plan(b, F, t0 = 0) { const n = toks(b).length, g = depthGap(n), ws = Array.from({ length: n }, (_, i) => +(t0 + i * g).toFixed(3)), a = toks(b).findIndex(t => t.accent); return { words: ws, done: (ws[n - 1] || t0) + 0.2, events: [...ws.filter((_, i) => i % 2 === 0).map(at => ({ at, event: 'word' })), ...(a >= 0 ? [{ at: ws[a] + 0.03, event: 'key-word' }] : [])] }; },
    draw(S, o) {
      const lay = o.lay, t0 = o.t0 || 0, g = depthGap(lay.words.length), sp = lay.px * 0.26;
      const e = w => E.quick(prog(S.lt, t0 + w.i * g, 0.12));
      for (let li = 0; li < lay.lines; li++) {
        const ws = lay.words.filter(w => w.li === li); if (!ws.length) continue;
        const full = ws.reduce((a, w) => a + w.w, 0) + sp * (ws.length - 1), part = ws.reduce((a, w, i) => a + (w.w + (i ? sp : 0)) * e(w), 0);
        const shift = lay.align === 'center' ? (full - part) / 2 : lay.align === 'right' ? full - part : 0;
        for (const w of ws) { const k = e(w); if (S.lt < t0 + w.i * g) continue; wd(S, w, { a: lerp(0.45, 1, k), s: lerp(1.25, 1, k), grey: 1 - k, blur: (1 - k) * 4 * S.u, dx: shift }); }
      }
    },
  });

  /* tumble drop: each word drops in from below-right, tilted and half transparent, and springs flat; the accent
     word lands last */
  const tumbleTimes = (b, t0) => { const tk = toks(b), n = tk.length, g = n > 7 ? 0.05 : 0.07; let k = 0; const plainIdx = tk.map((t, i) => (t.accent ? -1 : k++)); const last = t0 + Math.max(0, k - 1) * g; return tk.map((t, i) => +(t.accent ? last + 0.14 + 0.05 * tk.slice(0, i).filter(x => x.accent).length : t0 + plainIdx[i] * g).toFixed(3)); };
  L.def('effect:type-tumble-drop', {
    kind: 'type',
    plan(b, F, t0 = 0) { const ws = tumbleTimes(b, t0), a = toks(b).findIndex(t => t.accent); return { words: ws, done: Math.max(t0, ...ws) + 0.35, events: [{ at: t0, event: 'word' }, ...(a >= 0 ? [{ at: ws[a] + 0.05, event: 'key-word' }] : [])] }; },
    draw(S, o) {
      const lay = o.lay, ws = tumbleTimes(S.b, o.t0 || 0), K = [14, 260, 1];
      for (const w of lay.words) {
        const dt = S.lt - (ws[w.i] != null ? ws[w.i] : o.t0 || 0); if (dt < 0) continue;
        const sp = spring(dt, K), e = clamp(sp);
        wd(S, w, { a: clamp(dt / 0.08) * lerp(0.4, 1, e), dx: (1 - sp) * lay.px * 0.15, dy: (1 - sp) * lay.px * 0.35, rot: (1 - sp) * 0.17, grey: 1 - E.out(clamp(dt / 0.25)) });
      }
    },
  });

  /* tracking collapse: the line appears spaced wide and condenses to tight tracking, like a held breath */
  L.def('effect:type-tracking-collapse', {
    kind: 'type',
    plan(b, F, t0 = 0) { return { words: toks(b).map(() => t0), done: t0 + 0.45, events: [{ at: t0, event: 'ui-reveal' }] }; },
    draw(S, o) {
      const lay = o.lay, c = S.ctx, k = E.out(prog(S.lt, o.t0 || 0, 0.45)); if (S.lt < (o.t0 || 0)) return;
      const ex = (1 - k) * 0.35;
      for (let li = 0; li < lay.lines; li++) {
        const ws = lay.words.filter(w => w.li === li); if (!ws.length) continue;
        const x0 = ws[0].x, x1 = ws[ws.length - 1].x + ws[ws.length - 1].w, cx = lay.align === 'left' ? x0 : lay.align === 'right' ? x1 : (x0 + x1) / 2;
        const chars = ws.reduce((a, w) => a + w.s.length, 0), f = 1 + ex * lay.px * chars / Math.max(1, x1 - x0);
        for (const w of ws) {
          c.save(); c.globalAlpha *= lerp(0.55, 1, k); if (k < 0.95) c.filter = `blur(${((1 - k) * 3 * S.u).toFixed(1)}px)`;
          L.setFont(c, S.look, w.role, w.px); try { c.letterSpacing = (w.tr + ex * w.px).toFixed(2) + 'px'; } catch (e) { /* */ }
          c.textAlign = 'left'; c.textBaseline = 'alphabetic'; c.fillStyle = w.tk.accent ? S.P.accent : S.P.fg; c.fillText(w.s, cx + (w.x - cx) * f, w.y);
          reset(c); c.restore();
        }
      }
    },
  });

  /* pinch-in: alternate lines close in from opposite sides of their masks, then the accent word floods into colour */
  L.def('effect:type-pinch-in-accent', {
    kind: 'type',
    plan(b, F, t0 = 0) { const a = toks(b).findIndex(t => t.accent); return { words: toks(b).map(() => t0), done: t0 + 0.7, events: [{ at: t0, event: 'word' }, ...(a >= 0 ? [{ at: t0 + 0.45, event: 'key-word' }] : [])] }; },
    draw(S, o) {
      const lay = o.lay, c = S.ctx, t0 = o.t0 || 0, ak = E.out(prog(S.lt, t0 + 0.42, 0.3));
      for (let li = 0; li < lay.lines; li++) {
        const ws = lay.words.filter(w => w.li === li); if (!ws.length) continue;
        const k = E.out(prog(S.lt, t0 + li * 0.06, 0.42)); if (k <= 0) continue;
        const x0 = Math.min(...ws.map(w => w.x)), x1 = Math.max(...ws.map(w => w.x + w.w)), y = ws[0].y, top = y - lay.px * 1.02, bot = y + lay.px * 0.3;
        c.save(); c.beginPath(); c.rect(x0 - lay.px, top - lay.px * 0.2, x1 - x0 + lay.px * 2, bot - top + lay.px * 0.3); c.clip();
        const dy = (1 - k) * lay.px * 1.15 * (li % 2 ? -1 : 1);
        for (const w of ws) wd(S, w, { a: 1, dy, fill: w.tk.accent ? mix(S.P.fg, S.P.accent, ak) : S.P.fg, s: w.tk.accent ? 1 + Math.sin(Math.PI * ak) * 0.04 : 1 });
        c.restore();
      }
    },
  });

  /* grey settle: words rise in grey one by one and settle to ink a beat later (the accent settles to the accent) */
  L.def('effect:type-grey-settle', {
    kind: 'type',
    plan(b, F, t0 = 0) { const n = toks(b).length, ws = Array.from({ length: n }, (_, i) => +(t0 + i * 0.055).toFixed(3)), a = toks(b).findIndex(t => t.accent); return { words: ws, done: (ws[n - 1] || t0) + 0.7, events: [{ at: t0, event: 'word' }, ...(a >= 0 ? [{ at: ws[a] + 0.35, event: 'key-word' }] : [])] }; },
    draw(S, o) {
      const lay = o.lay, t0 = o.t0 || 0;
      for (const w of lay.words) { const at = t0 + w.i * 0.055, k = E.out(prog(S.lt, at, 0.35)); if (k <= 0) continue; wd(S, w, { a: clamp(k * 2), dy: (1 - k) * lay.px * 0.25, grey: 1 - E.io(prog(S.lt, at + 0.32, 0.3)) }); }
    },
  });

  /* ═════════ TRANSITIONS ═════════ */

  /* implode + iris: A swirls and shrinks into its exit point until only the accent dot is left; B's world opens out
     of that dot in an accelerating circle */
  L.def('transition:crowd-implode-iris', {
    kind: 'transition', plan() { return { pre: 0.3, post: 0.22, events: [{ at: -0.3, event: 'slide-out' }, { at: 0.02, event: 'scene' }] }; },
    tr(S, A, B, k, o) {
      const c = S.ctx, p = pt(S, o.from), r0 = ((o.from && o.from.r) || 0.008) * S.H, PA = S.PA || S.P;
      if (S.t < o.cut) {
        const g = E.in(split(o, k)); c.fillStyle = PA.bg; c.fillRect(0, 0, S.W, S.H);
        c.save(); c.globalAlpha = 1 - g * 0.6; c.translate(p.x, p.y); c.rotate(g * 0.5); c.scale(1 - g * 0.97, 1 - g * 0.97); c.translate(-p.x, -p.y); c.drawImage(A, 0, 0); c.restore();
        if (g > 0.5) L.circle(c, p.x, p.y, r0 * E.outBack(clamp((g - 0.5) / 0.5)), S.look.accent);
      } else {
        const g = after(o, k), R = lerp(r0, cover(S, p.x, p.y), E.in(g));
        c.fillStyle = PA.bg; c.fillRect(0, 0, S.W, S.H);
        c.save(); c.beginPath(); c.arc(p.x, p.y, R, 0, Math.PI * 2); c.clip(); c.drawImage(B, 0, 0); c.restore();
        if (g < 0.3) L.circle(c, p.x, p.y, r0 * (1 - g / 0.3), S.look.accent);
      }
    },
  });

  /* fly through the gap: A creeps in, then the camera rushes (log space, ~9x) into its exit point (the gap in the
     mark) and lands on B settling from 106% */
  L.def('transition:split-gap-flythrough', {
    kind: 'transition', plan() { return { pre: 0.32, post: 0.18, events: [{ at: -0.3, event: 'build' }, { at: 0, event: 'scene' }] }; },
    tr(S, A, B, k, o) {
      const c = S.ctx, p = pt(S, o.from);
      if (S.t < o.cut) {
        const g = split(o, k), s = g < 0.5 ? lerp(1, 1.1, E.io(g / 0.5)) : L.logLerp(1.1, 9, E.in((g - 0.5) / 0.5));
        const m = clamp((s - 1) / 2); c.save(); c.translate(lerp(p.x, S.W / 2, m), lerp(p.y, S.H / 2, m)); c.scale(s, s); c.translate(-p.x, -p.y); if (s > 3) c.filter = `blur(${Math.min(8, (s - 3)).toFixed(1)}px)`; c.drawImage(A, 0, 0); c.restore();
      } else { const g = E.out(after(o, k)), s = lerp(1.06, 1, g); c.save(); c.translate(S.W / 2, S.H / 2); c.scale(s, s); c.translate(-S.W / 2, -S.H / 2); c.drawImage(B, 0, 0); c.restore(); }
    },
  });

  /* stack merges into a pill: A's group of cards loses its text, tints to the accent and cascades up-left into one
     pill that lands on B's button */
  L.def('transition:chips-merge-pill', {
    kind: 'transition', plan() { return { pre: 0.34, post: 0.3, events: [{ at: -0.32, event: 'slide-out' }, { at: 0.02, event: 'pop' }] }; },
    tr(S, A, B, k, o) {
      const c = S.ctx, PA = S.PA || S.P, f = o.from && o.from.w ? o.from : { x: 0.5, y: 0.6, w: 0.42, h: 0.36 }, tt = o.to && o.to.w ? o.to : { x: 0.15, y: 0.5, w: 0.12, h: 0.07 };
      const r0 = { x: (f.x - f.w / 2) * S.W, y: (f.y - f.h / 2) * S.H, w: f.w * S.W, h: f.h * S.H }, r1 = { x: (tt.x - tt.w / 2) * S.W, y: (tt.y - tt.h / 2) * S.H, w: tt.w * S.W, h: tt.h * S.H };
      const acc = S.look.accent, cardC = lightBase(PA);
      const g = S.t < o.cut ? split(o, k) * 0.78 : 0.78 + after(o, k) * 0.22;
      c.drawImage(S.t < o.cut ? A : B, 0, 0);
      if (S.t < o.cut) { c.save(); c.globalAlpha = clamp(g * 8); c.fillStyle = PA.bg; c.fillRect(r0.x - 50 * S.u, r0.y - 60 * S.u, r0.w + 100 * S.u, r0.h + 120 * S.u); c.restore(); }
      const n = 3, rh = r0.h / n * 0.7;
      for (let i = n - 1; i >= 0; i--) {
        const ki = E.io(clamp((g - i * 0.1) / 0.75)), y0 = r0.y + (i + 0.5) * r0.h / n - rh / 2;
        const x = lerp(r0.x, r1.x, ki), y = lerp(y0, r1.y, ki) - Math.sin(Math.PI * ki) * S.H * 0.06, w = lerp(r0.w, r1.w, ki), h = lerp(rh, r1.h, ki);
        c.save(); c.globalAlpha = S.t < o.cut ? 1 : 1 - E.in(clamp((after(o, k) - 0.5) / 0.5)); L.rr(c, x, y, w, h, lerp(rh * 0.28, h / 2, ki)); c.fillStyle = mix(cardC, acc, clamp(ki * 1.6)); c.fill(); c.restore();
      }
    },
  });

  /* tap ring reveal: a press at the hand-off point, then a thin ring races out past the frame edge; B is inside it */
  L.def('transition:tap-ring-reveal', {
    kind: 'transition', plan() { return { pre: 0.1, post: 0.32, events: [{ at: -0.06, event: 'click-ui' }, { at: 0.02, event: 'card-in' }] }; },
    tr(S, A, B, k, o) {
      const c = S.ctx, p = pt(S, o.from || o.to), PA = S.PA || S.P;
      c.drawImage(A, 0, 0);
      if (S.t < o.cut) { const g = split(o, k); c.save(); c.globalAlpha = 0.45 * E.out(g); L.circle(c, p.x, p.y, (30 - g * 6) * S.u, mix(PA.bg, PA.fg, 0.5)); c.restore(); return; }
      const g = after(o, k), R = lerp(30 * S.u, cover(S, p.x, p.y), bezRing(g));
      c.save(); c.beginPath(); c.arc(p.x, p.y, R, 0, Math.PI * 2); c.clip(); c.drawImage(B, 0, 0); c.restore();
      c.save(); c.globalAlpha = 1 - g; c.strokeStyle = mix(S.look.accent, S.P.bg, 0.4); c.lineWidth = 6 * S.u; c.beginPath(); c.arc(p.x, p.y, R, 0, Math.PI * 2); c.stroke(); c.restore();
    },
  });

  /* ink pour: a sheet of B's world pours down over A with a slow two-lobe liquid edge, like poured ink */
  L.def('transition:ink-pour-curtain', {
    kind: 'transition', plan() { return { pre: 0.4, post: 0.14, events: [{ at: -0.38, event: 'slide-out' }, { at: 0, event: 'scene' }] }; },
    tr(S, A, B, k, o) {
      const c = S.ctx;
      if (S.t >= o.cut) { const g = E.out(after(o, k)), s = lerp(1.03, 1, g); c.save(); c.translate(S.W / 2, S.H / 2); c.scale(s, s); c.translate(-S.W / 2, -S.H / 2); c.drawImage(B, 0, 0); c.restore(); return; }
      const g = E.io(split(o, k)), base = lerp(-S.H * 0.12, S.H * 1.14, g), amp = S.H * 0.07 * Math.sin(Math.PI * clamp(g * 1.1)), ph = g * 3.2;
      c.drawImage(A, 0, S.H * 0.03 * g);
      c.save(); c.beginPath(); c.moveTo(0, 0);
      for (let i = 0; i <= 64; i++) { const x = i / 64 * S.W; c.lineTo(x, base + Math.sin(i / 64 * Math.PI * 2 * 1.0 + ph) * amp + Math.sin(i / 64 * Math.PI * 4 - ph * 0.7) * amp * 0.18); }
      c.lineTo(S.W, 0); c.closePath(); c.fillStyle = S.P.bg; c.shadowColor = 'rgba(0,0,0,0.25)'; c.shadowBlur = 30 * S.u; c.shadowOffsetY = 10 * S.u; c.fill(); c.restore();
    },
  });

  /* match zoom: B opens at 6x on its entry token (the same token A ended on), a focus ring blooms, the camera holds
     with a drift and then pulls back to the whole shot */
  L.def('transition:token-match-zoom', {
    kind: 'transition', plan() { return { pre: 0.04, post: 0.6, events: [{ at: 0, event: 'hard-hit' }, { at: 0.3, event: 'slide-out' }] }; },
    tr(S, A, B, k, o) {
      const c = S.ctx; if (S.t < o.cut) { c.drawImage(A, 0, 0); return; }
      const g = after(o, k), f = pt(S, o.to), z0 = 6, z = g < 0.5 ? lerp(z0, z0 * 0.95, g / 0.5) : L.logLerp(z0 * 0.95, 1, E.hard((g - 0.5) / 0.5)), m = (z - 1) / (z0 - 1);
      c.fillStyle = S.P.bg; c.fillRect(0, 0, S.W, S.H);
      c.save(); c.translate(lerp(f.x, S.W / 2, m) + noise(g * 3, 4) * 10 * S.u * m, lerp(f.y, S.H / 2, m)); c.scale(z, z); c.translate(-f.x, -f.y); c.drawImage(B, 0, 0); c.restore();
      const rk = clamp(g / 0.3); if (rk < 1) { c.save(); c.globalAlpha = (1 - rk) * 0.8; L.circle(c, S.W / 2, S.H / 2, lerp(80, 1000, E.out(rk)) * S.u, null, mix(S.look.accent, S.P.bg, 0.4), 4 * S.u); c.restore(); }
    },
  });

  /* chart squeeze: A is squeezed from both sides into a squiggle at its exit point, then a dot; the dot travels to
     B's entry and B opens out of it */
  L.def('transition:chart-squeeze-dot', {
    kind: 'transition', plan() { return { pre: 0.34, post: 0.34, events: [{ at: -0.32, event: 'slide-out' }, { at: 0.02, event: 'pop' }] }; },
    tr(S, A, B, k, o) {
      const c = S.ctx, PA = S.PA || S.P, p0 = pt(S, o.from), p1 = pt(S, o.to), r = 0.014 * S.H;
      c.fillStyle = PA.bg; c.fillRect(0, 0, S.W, S.H);
      if (S.t < o.cut) {
        const g = E.in(split(o, k)); c.save(); c.globalAlpha = 1 - clamp((g - 0.8) / 0.2); c.translate(p0.x, p0.y); c.scale(lerp(1, 0.015, g), lerp(1, 0.3, g)); c.translate(-p0.x, -p0.y); c.drawImage(A, 0, 0); c.restore();
        if (g > 0.75) L.circle(c, p0.x, p0.y, r * E.outBack(clamp((g - 0.75) / 0.25)), S.look.accent);
      } else {
        const g = after(o, k), m = E.io(clamp(g / 0.45)), x = lerp(p0.x, p1.x, m), y = lerp(p0.y, p1.y, m) - Math.sin(Math.PI * m) * S.H * 0.06;
        const R = lerp(r, cover(S, x, y), E.in(clamp((g - 0.45) / 0.55)));
        if (g > 0.45) { c.save(); c.beginPath(); c.arc(x, y, R, 0, Math.PI * 2); c.clip(); c.drawImage(B, 0, 0); c.restore(); }
        L.circle(c, x, y, r * (1 + Math.sin(Math.PI * clamp(g / 0.45)) * 0.4) * (1 - clamp((g - 0.6) / 0.2)), S.look.accent);
      }
    },
  });

  /* dust black hole: A breaks into square dust that drifts outward and swirls; a disc opens from A's exit point,
     swallows the frame and B is inside it */
  function dustOf(c, S, img, g, p, drift) {
    const cell = Math.round(20 * S.u), cols = Math.ceil(S.W / cell), rows = Math.ceil(S.H / cell);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const r = rand(i * 7919 + j * 131), x = i * cell, y = j * cell, local = clamp(g * 1.5 - r * 0.5);
      if (local <= 0) { c.drawImage(img, x, y, cell, cell, x, y, cell, cell); continue; }
      const ang = Math.atan2(y - p.y, x - p.x) + local * 1.2 + drift * 0.8, d = (local * local * (120 + 360 * r) + drift * 200 * r) * S.u, s = cell * (1 - local * 0.72);
      c.save(); c.globalAlpha = 1 - clamp(drift * 0.8); c.drawImage(img, x, y, cell, cell, x + Math.cos(ang) * d + (cell - s) / 2, y + Math.sin(ang) * d + (cell - s) / 2, s, s); c.restore();
    }
  }
  L.def('transition:dust-blackhole', {
    kind: 'transition', plan() { return { pre: 0.22, post: 0.36, events: [{ at: -0.2, event: 'tear' }, { at: 0.02, event: 'hard-hit' }] }; },
    tr(S, A, B, k, o) {
      const c = S.ctx, PA = S.PA || S.P, p = pt(S, o.from);
      c.fillStyle = PA.bg; c.fillRect(0, 0, S.W, S.H);
      if (S.t < o.cut) { dustOf(c, S, A, E.out(split(o, k)), p, 0); return; }
      const g = after(o, k); dustOf(c, S, A, 1, p, g);
      const R = lerp(0.07 * S.H, cover(S, p.x, p.y), E.in(g));
      c.save(); c.beginPath(); c.arc(p.x, p.y, R, 0, Math.PI * 2); c.clip(); c.drawImage(B, 0, 0); c.restore();
    },
  });

  /* ═════════ CAMERAS ═════════ */

  /* creep then rush: a slow creep for most of the beat, then an exponential push into the beat's exit point */
  L.def('camera:creep-expo-push', {
    kind: 'camera',
    cam(lt, d, o, S) {
      const k = clamp(lt / Math.max(0.1, d)), rush = E.in(prog(lt, d - 0.32, 0.32)), s = lerp(1, 1.035, k) * L.logLerp(1, 1.7, rush);
      const ex = (S && S.b.exit) || { x: 0.5, y: 0.5 }, W = S ? S.W : 1920, H = S ? S.H : 1080, fx = ex.x * W - W / 2, fy = ex.y * H - H / 2;
      return { s, x: (1 - s) * fx, y: (1 - s) * fy, r: 0 };
    },
  });
  /* close-up pull-back: the beat opens tight (3x) on its entry token with a drift, then pulls all the way back */
  L.def('camera:closeup-pullback', {
    kind: 'camera',
    cam(lt, d, o, S) {
      const z0 = (o && o.from) || 3, at = (o && o.at) || 0.45, z = lt < at ? lerp(z0, z0 * 0.96, lt / at) : L.logLerp(z0 * 0.96, 1, E.hard(prog(lt, at, 0.4))), s = z * (1 + clamp(lt / Math.max(0.1, d)) * 0.02);
      const en = (S && S.b.entry) || { x: 0.5, y: 0.5 }, W = S ? S.W : 1920, H = S ? S.H : 1080, m = (z - 1) / (z0 - 1);
      return { s, x: -m * s * (en.x * W - W / 2) + noise(lt * 0.7, 2) * 6 * m, y: -m * s * (en.y * H - H / 2), r: 0 };
    },
  });

  /* ═════════ UI WIDGETS ═════════ */

  L.def('ui:habit-week-grid', {
    kind: 'ui',
    draw(S, o) { const PF = L.get('ui:phone-frame'); if (!PF) return null; const h = o.ph || Math.min(S.H * 0.84, (o.w || S.W * 0.4) * 1.6); const fill = 6 + clamp((S.lt - (o.t0 || 0)) / 1.6) * ((o.fill || 13) - 6); return PF.draw(S, { x: o.x, y: o.y, h, t0: o.t0, content: (c, sx, sy, sw, sh) => habitScreen(c, S, sx, sy, sw, sh, { fill, action: (o.items && o.items[0]) || o.label }) }); },
  });
  L.def('ui:streak-tile-bar', {
    kind: 'ui',
    draw(S, o) { const w = Math.min(S.W * 0.86, (o.w || S.W * 0.5) * 1.6), t0 = o.t0 || 0, n = o.n || 18; const fill = clamp((S.lt - t0 - 0.4) / 1.2) * (o.fill || 13); return streakBar(S.ctx, S, o.x - w / 2, o.y, w, { n, build: prog(S.lt, t0, 0.35), fill }); },
  });
  L.def('ui:skew-rule-chips', {
    kind: 'ui',
    draw(S, o) { const list = (o.items || ['One', 'Two', 'Three']).slice(0, 4); const w = o.w || S.W * 0.42; return chipStack(S, { x: o.x, y: o.y, w, h: Math.max(80 * S.u, w * 0.13), gap: w * 0.03, items: list, t0: o.t0 || 0, every: o.every || 0.4 }); },
  });
  L.def('ui:lock-seal-outline', {
    kind: 'ui',
    draw(S, o) { const list = (o.items || ['One', 'Two', 'Three']).slice(0, 3), t0 = o.t0 || 0; const w = o.w || S.W * 0.42, R = o.rect || chipStack(S, { x: o.x, y: o.y, w, h: Math.max(80 * S.u, w * 0.13), gap: w * 0.03, items: list, t0: -5 }); seal(S, R, t0 + 0.3, { out: o.out }); return R; },
  });
  L.def('ui:verdict-drum', {
    kind: 'ui',
    draw(S, o) { let list = (o.labels || o.items || ['Worked', 'Unclear', 'No change']).slice(0, 5); while (list.length < 3) list = list.concat(list); const w = o.w || S.W * 0.5; drum(S, { x: o.x, y: o.y, w, h: o.h || w * 0.42, labels: list, target: o.target || 0, t0: (o.t0 || 0) + 0.3 }); },
  });
  L.def('ui:result-serif-screen', {
    kind: 'ui',
    draw(S, o) { const PF = L.get('ui:phone-frame'); if (!PF) return null; const n = o.number; const h = o.ph || Math.min(S.H * 0.84, (o.w || S.W * 0.4) * 1.6); return PF.draw(S, { x: o.x, y: o.y, h, t0: o.t0, content: (c, sx, sy, sw, sh) => resultScreen(c, S, sx, sy, sw, sh, { title: o.title || o.text || 'Your result is in', verdict: (o.items && o.items[0]) || 'Worked', line: n ? `${numStr(n)} ${n.label || ''}` : '', metric: (n && n.label) || '' }) }); },
  });
  L.def('ui:step-chart-band', {
    kind: 'ui',
    draw(S, o) { const w = Math.min(S.W * 0.86, (o.w || S.W * 0.5) * 1.5), h = Math.min(S.H * 0.6, w * 0.45), t0 = o.t0 || 0, P = S.P; const R = { x: o.x - w / 2, y: o.y - h / 2, w, h }; return stepChart(S.ctx, R, { col: P.accent, lw: 5 * S.u, draw: E.io(prog(S.lt, t0, 1.1)), band: E.out(prog(S.lt, t0 + 0.6, 0.35)), bandCol: mix(P.bg, P.accentRaw, 0.1), guide: P.fg, guideA: E.out(prog(S.lt, t0 + 0.7, 0.4)), seed: 5, n: 100 }); },
  });
  L.def('ui:option-hop-ring', {
    kind: 'ui',
    draw(S, o) {
      const list = (o.items || ['One', 'Two', 'Three']).slice(0, 4), n = list.length, t0 = o.t0 || 0, gap = Math.min(130 * S.u, S.H * 0.7 / Math.max(1, n)), target = (o.target != null ? o.target : Math.min(1, n - 1)) % n;
      const hop0 = t0 + n * 0.08 + 0.3, commit = hop0 + 6 * 0.2, ck = E.out(prog(S.lt, commit, 0.3));
      const rects = list.map((s, i) => optPill(S, o.x, o.y + (i - (n - 1) / 2) * gap, s, { px: 42, pop: E.outBack(prog(S.lt, t0 + i * 0.08, 0.3)), fill: i === target ? ck : 0, alpha: i !== target ? 1 - ck * 0.55 : 1 }));
      hopRing(S, rects, hop0, hopSeq(n, target, 6, 17), 0.2, deepOf(S.P));
      return rects[target];
    },
  });

  /* ═════════ TEXTURE / OVERLAY ═════════ */

  /* a quiet 80-unit grid on paper (the board the rules are set on): soft lines, slightly stronger every fourth */
  L.def('texture:paper-grid-80', {
    kind: 'texture',
    draw(S, o) {
      const c = S.ctx, s = ((o && o.spacing) || 80) * S.u, dark = darkW(S.P); c.save(); c.lineWidth = 2.4 * S.u;
      const ox = (S.W / 2) % s, oy = (S.H / 2) % s;
      for (let i = 0, x = ox; x < S.W; x += s, i++) { c.strokeStyle = rgba(S.P.fg, (dark ? 0.04 : 0.035) * (i % 4 === 0 ? 1.6 : 1)); c.beginPath(); c.moveTo(x, 0); c.lineTo(x, S.H); c.stroke(); }
      for (let i = 0, y = oy; y < S.H; y += s, i++) { c.strokeStyle = rgba(S.P.fg, (dark ? 0.04 : 0.035) * (i % 4 === 0 ? 1.6 : 1)); c.beginPath(); c.moveTo(0, y); c.lineTo(S.W, y); c.stroke(); }
      const g = c.createRadialGradient(S.W / 2, S.H / 2, Math.min(S.W, S.H) * 0.3, S.W / 2, S.H / 2, Math.hypot(S.W, S.H) * 0.6); g.addColorStop(0, rgba(S.P.bg, 0)); g.addColorStop(1, rgba(S.P.bg, 0.7)); c.fillStyle = g; c.fillRect(0, 0, S.W, S.H);
      c.restore();
    },
  });
  /* the crowd as a finish: a lighter stream of capsules and star rows flying past the lens over a dark hype beat */
  L.def('effect:capsule-confetti-stream', {
    kind: 'overlay',
    draw(S, o) { swarm(S.ctx, S, S.t + 5, { n: (o && o.n) || 70, a: (o && o.a) || 0.85 }); },
  });
})(globalThis.LAUNCH);
