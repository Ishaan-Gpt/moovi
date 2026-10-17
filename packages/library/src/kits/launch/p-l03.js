// Launch pack l03 (Folio Ink): one material threads the beat. A stipple of ink particles that dissolves to dither,
// streams as a cloud, re-forms as icons and returns as a reader's screen. Fig. plate captions, an editorial serif with
// an italic key word, numbered spaced-caps eyebrows, a dark-to-paper dither flip, a fanned page stack, e-readers.
// Speed rule for every particle part: dot positions are sampled ONCE per (string, font, size, pitch) and cached in
// MEMO; a frame only walks a Float32Array and calls fillRect (no arcs, no blur filters per dot).
'use strict';
(function (L) {
  const { clamp, lerp, prog, E, rgba, mix, lum, spring, rand, noise, logLerp } = L;
  const MEMO = new Map();
  const memo = (k, f) => { let v = MEMO.get(k); if (v === undefined) { v = f(); MEMO.set(k, v); } return v; };
  const cnv = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };
  const isWide = S => S.W / S.H > 1.3, isTall = S => S.H / S.W > 1.3;
  const pad2 = n => String(n).padStart(2, '0');
  const cn = (i, j, s = 0) => rand(((i * 73856093) ^ (j * 19349663) ^ (s * 83492791)) | 0);
  const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
  const bayer = (i, j) => BAY[((j & 3) << 2) | (i & 3)];
  const brand = () => (L.film && L.film.brand) || { name: 'Brand', host: 'brand.com', tagline: '' };
  const KP = S => S.look.palette;
  const toks = b => (b.text && b.text.tokens) || [];
  const itemsOf = (b, n = 6) => ((b.data && b.data.items) || []).slice(0, n);
  const T = (b, F, t0) => { const p = L.get(b.type) || L.get('effect:type-mask-rise'); return p.plan(b, F, t0); };
  const chapterNo = b => (b.data && b.data.chapter) || ((b.i || 0) % 9) + 1;
  const PAGES = [3, 9, 14, 20, 27, 33, 38, 44];
  const inkOf = S => KP(S).ink, paperOf = S => KP(S).paper;
  const eink = S => mix(KP(S).paper, KP(S).ink, 0.11);
  const sourceOf = (it, k) => (typeof it === 'object' && it.sub) || `${pad2(k + 1)} · ${(brand().host || '').toUpperCase()}`;
  const nameOf = it => (typeof it === 'object' ? it.name : it) || '';

  /* ───────── cached samplers: glyph dots, icon dots, sprites, masks ───────── */
  // dots of a string in a font, sampled on a lattice once: [x, y, alpha, hash] per dot, relative to the baseline origin
  function glyphDots(look, role, px, weight, s, pitch, trEm) {
    const font = L.font(look, role, px, weight), tr = trEm != null ? trEm * px : L.tracking(look, role, px);
    return memo(`gd|${font}|${tr.toFixed(2)}|${pitch.toFixed(2)}|${s}`, () => {
      const m = cnv(4, 4).getContext('2d'); m.font = font; try { m.letterSpacing = tr.toFixed(2) + 'px'; } catch (e) { /* */ }
      const tw = m.measureText(s).width, ox = px * 0.25, oy = px * 1.1, w = Math.ceil(tw + px * 0.5), h = Math.ceil(px * 1.5);
      const cv = cnv(w, h), g = cv.getContext('2d'); g.font = font; try { g.letterSpacing = tr.toFixed(2) + 'px'; } catch (e) { /* */ }
      g.fillStyle = '#fff'; g.textBaseline = 'alphabetic'; g.fillText(s, ox, oy);
      const d = g.getImageData(0, 0, w, h).data, out = []; let n = 0;
      for (let y = pitch / 2; y < h; y += pitch) for (let x = pitch / 2; x < w; x += pitch) { const a = d[((y | 0) * w + (x | 0)) * 4 + 3]; if (a > 90) out.push(x - ox, y - oy, a / 255, rand(++n * 31 + 7)); }
      return { p: new Float32Array(out), w: tw };
    });
  }
  // a line icon sampled on a lattice: [x, y, hash] relative to its centre
  function iconDots(name, size, pitch) {
    return memo(`id|${name}|${size}|${pitch.toFixed(2)}`, () => {
      const n = Math.ceil(size * 1.3), cv = cnv(n, n), g = cv.getContext('2d');
      L.icon(g, name, n / 2, n / 2, size, '#fff', 2.1);
      const d = g.getImageData(0, 0, n, n).data, out = []; let k = 0;
      for (let y = pitch / 2; y < n; y += pitch) for (let x = pitch / 2; x < n; x += pitch) if (d[((y | 0) * n + (x | 0)) * 4 + 3] > 70) out.push(x - n / 2, y - n / 2, rand(++k * 13 + 5));
      return new Float32Array(out);
    });
  }
  // a shaded sphere sprite (64 px), drawn scaled: pellets, flip-dot faces
  const ball = col => memo(`ball|${col}`, () => {
    const d = 64, cv = cnv(d, d), g = cv.getContext('2d'), gr = g.createRadialGradient(d * 0.36, d * 0.3, d * 0.03, d * 0.5, d * 0.5, d * 0.5);
    gr.addColorStop(0, mix(col, '#FFFFFF', 0.55)); gr.addColorStop(0.38, col); gr.addColorStop(0.86, mix(col, '#000000', 0.42)); gr.addColorStop(1, mix(col, '#000000', 0.6));
    g.fillStyle = gr; g.beginPath(); g.arc(d / 2, d / 2, d / 2 - 0.5, 0, Math.PI * 2); g.fill(); return cv;
  });
  // the frame's headline as a white mask + its alpha array (sampled by grid cells)
  function headMask(S, lay, key) {
    return memo(`hm|${S.W}x${S.H}|${key}|${lay.px.toFixed(1)}|${lay.words.map(w => w.s + '@' + w.x.toFixed(0) + ',' + w.y.toFixed(0)).join(' ')}`, () => {
      const cv = cnv(S.W, S.H), g = cv.getContext('2d');
      for (const w of lay.words) L.drawWord(g, S.look, S.P, w, { fill: '#FFFFFF' });
      const d = g.getImageData(0, 0, S.W, S.H).data, a = new Uint8Array(S.W * S.H);
      for (let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3];
      return { cv, a };
    });
  }
  const tinted = (cv, col, key) => memo(`tn|${key}|${col}`, () => { const o = cnv(cv.width, cv.height), g = o.getContext('2d'); g.drawImage(cv, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = col; g.fillRect(0, 0, o.width, o.height); return o; });
  // a dot-screen tile: opaque `col` with a transparent round (or square) hole: drawn over a picture, it turns it to dots
  const screenTile = (p, col, sq) => memo(`st|${p}|${col}|${sq ? 1 : 0}`, () => {
    const cv = cnv(p, p), g = cv.getContext('2d'); g.fillStyle = col; g.fillRect(0, 0, p, p); g.globalCompositeOperation = 'destination-out';
    if (sq) g.fillRect(p * 0.08, p * 0.08, p * 0.84, p * 0.84); else { g.beginPath(); g.arc(p / 2, p / 2, p * 0.4, 0, Math.PI * 2); g.fill(); }
    return cv;
  });
  function screenOver(c, W, H, p, col, ox, oy, sq) {
    const tile = screenTile(p, col, sq), pat = c.createPattern(tile, 'repeat');
    c.save(); const sx = ((ox % p) + p) % p - p, sy = ((oy % p) + p) % p - p; c.translate(sx, sy); c.fillStyle = pat; c.fillRect(0, 0, W + p * 2, H + p * 2); c.restore();
  }
  // a picture redrawn through an e-ink dot screen: downsample, upscale with hard pixels, punch round dots
  function dotScreen(S, src, p, gap, sq) {
    const c = S.ctx, sw = Math.max(1, Math.ceil(S.W / p)), sh = Math.max(1, Math.ceil(S.H / p)), sm = L.buffer('l03ds', sw, sh); if (!sm) return;
    const g = sm.getContext('2d'); g.imageSmoothingEnabled = true; g.clearRect(0, 0, sw, sh); g.drawImage(src, 0, 0, sw * p, sh * p, 0, 0, sw, sh);
    c.save(); c.imageSmoothingEnabled = false; c.drawImage(sm, 0, 0, sw, sh, 0, 0, sw * p, sh * p); c.restore();
    screenOver(c, S.W, S.H, p, gap, 0, 0, sq);
  }
  // run-length rects of a cell grid where fn(i, j) is true, added to the current path (one clip or fill per frame)
  function runs(c, x0, y0, w, h, cell, fn) {
    const nx = Math.ceil(w / cell), ny = Math.ceil(h / cell);
    for (let j = 0; j < ny; j++) { let r = -1; for (let i = 0; i <= nx; i++) { const on = i < nx && fn(i, j); if (on && r < 0) r = i; else if (!on && r >= 0) { c.rect(x0 + r * cell, y0 + j * cell, (i - r) * cell, cell); r = -1; } } }
  }
  // composite: `under` everywhere, `over` in the cells where fn says so (canvas or colour each)
  function cells(S, under, over, cell, fn) {
    const c = S.ctx;
    if (typeof under === 'string') { c.fillStyle = under; c.fillRect(0, 0, S.W, S.H); } else c.drawImage(under, 0, 0);
    c.save(); c.beginPath(); runs(c, 0, 0, S.W, S.H, cell, fn); c.clip();
    if (typeof over === 'string') { c.fillStyle = over; c.fillRect(0, 0, S.W, S.H); } else c.drawImage(over, 0, 0);
    c.restore();
  }

  /* ───────── dot drawing ───────── */
  // text printed as dots that thicken left to right into solid ink (k 0..1); returns the text width
  function dotText(S, s, x, y, o) {
    const c = S.ctx, px = o.px, k = o.k == null ? 1 : o.k, str = o.upper ? String(s || '').toUpperCase() : String(s || '');
    if (!str) return 0;
    const tw = L.textW(c, S.look, str, { role: o.role, px, weight: o.weight, tracking: o.tracking });
    if (k <= 0) return tw;
    const x0 = o.align === 'center' ? x - tw / 2 : o.align === 'right' ? x - tw : x, solid = clamp((k - 0.86) / 0.14);
    if (solid < 1) {
      const pitch = o.pitch || Math.max(2 * S.u, px / 15), D = glyphDots(S.look, o.role, px, o.weight, str, pitch, o.tracking), p = D.p, r = pitch * (o.dot || 0.36), soft = 0.32, front = k * (1 + soft);
      c.save(); c.fillStyle = o.color; c.globalAlpha *= 1 - solid * 0.7;
      for (let i = 0; i < p.length; i += 4) { const cov = clamp((front - p[i] / Math.max(1, D.w)) / soft); if (p[i + 3] < cov) c.fillRect(x0 + p[i] - r, y + p[i + 1] - r, r * 2, r * 2); }
      c.restore();
    }
    if (solid > 0) { c.save(); c.globalAlpha *= solid; L.text(c, S.look, str, x0, y, { role: o.role, px, weight: o.weight, color: o.color, tracking: o.tracking }); c.restore(); }
    return tw;
  }
  // an icon drawn as e-ink dots; k prints it (dots appear in hash order)
  function dotIcon(S, name, x, y, size, color, k = 1, pitch) {
    if (k <= 0) return;
    const pt = pitch || Math.max(2 * S.u, size / 26), p = iconDots(name, Math.round(size), pt), r = pt * 0.42, c = S.ctx;
    c.fillStyle = color;
    for (let i = 0; i < p.length; i += 3) if (p[i + 2] < k) c.fillRect(x + p[i] - r, y + p[i + 1] - r, r * 2, r * 2);
  }

  /* ───────── the microcapsule: pellets in a glass sphere, turning, flipping white ───────── */
  const PELLETS = (() => { const a = []; let t = 0; while (a.length < 900 && t < 40000) { t++; const x = rand(t * 3 + 1) * 2 - 1, y = rand(t * 3 + 2) * 2 - 1, z = rand(t * 3 + 3) * 2 - 1; if (x * x + y * y + z * z > 0.8) continue; a.push({ x, y, z, s: 0.034 + rand(t * 5 + 7) * 0.034, d: rand(t * 11 + 3) * 0.03 }); } return a; })();
  function capsule(S, cx, cy, R, o = {}) {
    const c = S.ctx, K = KP(S), dark = mix(K.ink, K.inkText || '#EEEEEE', 0.14), light = K.inkText || K.paper, u = S.u;
    c.save(); c.globalAlpha *= o.a == null ? 1 : o.a;
    const g = c.createRadialGradient(cx - R * 0.25, cy - R * 0.3, R * 0.1, cx, cy, R);
    g.addColorStop(0, rgba(light, 0.06)); g.addColorStop(0.82, rgba(light, 0.035)); g.addColorStop(1, rgba(light, 0.2));
    c.fillStyle = g; c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.fill();
    if (R > 9) {
      const a = o.spin || 0, ca = Math.cos(a), sa = Math.sin(a), list = new Array(PELLETS.length);
      PELLETS.forEach((p, i) => { list[i] = [p.x * ca + p.z * sa, p.y, -p.x * sa + p.z * ca, p]; });
      list.sort((A, B) => A[2] - B[2]);
      const sd = ball(dark), sl = ball(light);
      for (const [x, y, z, p] of list) {
        const dep = (z + 1) / 2, s = p.s * R * (0.78 + 0.4 * dep) * 2, px = cx + x * R, py = cy + y * R, wv = o.white ? o.white(p.d, x) : 0;
        c.globalAlpha = (o.a == null ? 1 : o.a) * (0.35 + 0.65 * dep);
        if (wv < 1) c.drawImage(sd, px - s / 2, py - s / 2, s, s);
        if (wv > 0) { c.globalAlpha *= wv; c.drawImage(sl, px - s / 2, py - s / 2, s, s); }
      }
      c.globalAlpha = o.a == null ? 1 : o.a;
    }
    c.lineWidth = Math.max(1, 1.5 * u); c.strokeStyle = rgba(light, 0.42); c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.stroke();
    c.lineCap = 'round'; c.lineWidth = Math.max(1, R * 0.022); c.strokeStyle = rgba(light, 0.5); c.beginPath(); c.arc(cx, cy, R * 0.9, Math.PI * 1.08, Math.PI * 1.42); c.stroke();
    c.strokeStyle = rgba(light, 0.22); c.beginPath(); c.arc(cx, cy, R * 0.9, Math.PI * 1.48, Math.PI * 1.56); c.stroke();
    const acc = S.P.accent; c.shadowColor = acc; c.shadowBlur = R * 0.06; c.strokeStyle = rgba(acc, 0.75); c.lineWidth = Math.max(1, R * 0.018); c.beginPath(); c.arc(cx, cy, R * 0.985, -0.42 * Math.PI, 0.32 * Math.PI); c.stroke();
    c.restore();
  }
  // out-of-focus neighbour discs (blurred once, cached per size and colour)
  function bokehField(S, pitch, col) {
    const p = Math.round(pitch), bl = Math.round(p * 0.07);
    return memo(`bk|${S.W}x${S.H}|${p}|${col}`, () => {
      const pad = p, cv = cnv(S.W + pad * 2, S.H + pad * 2), g = cv.getContext('2d'), t = cnv(cv.width, cv.height), tg = t.getContext('2d');
      tg.fillStyle = col; const cx = cv.width / 2, cy = cv.height / 2;
      for (let j = -6; j <= 6; j++) for (let i = -8; i <= 8; i++) { const x = cx + i * p, y = cy + j * p; if (x < -p || x > cv.width + p || y < -p || y > cv.height + p) continue; tg.beginPath(); tg.arc(x, y, p * 0.44, 0, Math.PI * 2); tg.fill(); }
      g.filter = `blur(${bl}px)`; g.drawImage(t, 0, 0); g.filter = 'none';
      return { cv, pad };
    });
  }

  /* ───────── editorial type pieces (shared by the set-ups and their ui parts) ───────── */
  function eyebrowNum(S, o) {
    const c = S.ctx, u = S.u, px = (o.px || 20) * u, str = `${pad2(o.n || 1)}  ·  ${String(o.label || '').toUpperCase()}`;
    const t = S.lt - (o.t0 || 0); if (t < 0) return;
    const shown = Math.min(str.length, Math.floor(t / 0.022) + 1), s = str.slice(0, shown);
    const full = L.textW(c, S.look, str, { role: 'micro', px, tracking: 0.25 }), align = o.align || 'center';
    const x0 = align === 'center' ? o.x - full / 2 : align === 'right' ? o.x - full : o.x;
    const w = L.text(c, S.look, s, x0, o.y, { role: 'micro', px, color: o.color || S.P.dim, tracking: 0.25 });
    if (shown < str.length) { c.fillStyle = o.color || S.P.dim; c.fillRect(x0 + w + px * 0.1, o.y - px * 0.72, px * 0.55, px * 0.72); }
  }
  function subline(S, o) {
    const c = S.ctx, u = S.u, px = (o.px || 17) * u, str = String(o.text || '').toUpperCase(), t = S.lt - (o.t0 || 0); if (t < 0 || !str) return;
    const n = Math.min(str.length, Math.floor(t / 0.012));
    L.text(c, S.look, str.slice(0, n), o.align === 'center' ? o.x - Math.min(o.maxW || 1e9, L.textW(c, S.look, str, { role: 'micro', px, tracking: 0.2 })) / 2 : o.x, o.y, { role: 'micro', px, color: o.color || S.P.dim, tracking: 0.2, maxW: o.maxW });
  }
  function figCaption(S, o) {
    const c = S.ctx, u = S.u, px = (o.px || 30) * u, k = E.out(prog(S.lt, o.t0 || 0, 0.45)); if (k <= 0) return;
    const lab = `Fig. ${o.n || 1}`, txt = o.text || '', gap = px * 0.7;
    const lw = L.textW(c, S.look, lab, { role: 'accent', px, weight: 400 }), tw = L.textW(c, S.look, txt, { role: 'display', px, weight: 400, tracking: -0.005 });
    const sc = Math.min(1, (o.maxW || S.W * 0.84) / (lw + gap + tw)), x0 = o.x - (lw + gap + tw) * sc / 2;
    c.save(); c.globalAlpha *= k; if (k < 0.98) c.filter = `blur(${((1 - k) * 6 * u).toFixed(2)}px)`;
    c.translate(x0, o.y); c.scale(sc, sc);
    L.text(c, S.look, lab, 0, 0, { role: 'accent', px, weight: 400, color: o.color || S.P.fg });
    L.text(c, S.look, txt, lw + gap, 0, { role: 'display', px, weight: 400, color: o.dim || S.P.dim, tracking: -0.005 });
    c.restore();
  }
  // the chapter block: numbered eyebrow, the cast headline, a middot sub-line
  const headPx = (S, b, base) => { const n = toks(b).length; return S.u * base * (n <= 3 ? 1.12 : n <= 5 ? 1 : n <= 8 ? 0.84 : 0.7); };
  function chapter(S, o) {
    const b = S.b, c = S.ctx, u = S.u, eb = b.text && b.text.eyebrow, align = o.align || 'left';
    const sub = (b.text && b.text.sub) || (o.subItems === false ? '' : itemsOf(b, 3).join('  ·  '));
    const slot = { px: o.px, maxW: o.maxW, x: o.x, align, maxLines: o.maxLines || 3, lineH: 1.04 };
    const lay0 = L.layout(c, S.look, toks(b), Object.assign({ y: 0 }, slot));
    const ebH = eb ? 64 * u : 0, subH = sub ? 74 * u : 0, H = ebH + lay0.H + subH, top = o.top != null ? o.top : o.y - H / 2;
    if (eb) eyebrowNum(S, { x: o.x, y: top + 18 * u, n: chapterNo(b), label: eb, align, t0: S.at('eyebrow') });
    const lay = toks(b).length ? L.headline(S, Object.assign({ y: top + ebH }, slot)) : null;
    if (sub) subline(S, { x: o.x, y: (lay ? lay.bottom : top + ebH) + 52 * u, text: sub, align, t0: S.at('sub'), maxW: o.maxW });
    return { lay, top, bottom: top + H };
  }
  // printer's crop marks: two ticks per corner that never touch, drawn on with k
  function cropMarks(S, x0, y0, x1, y1, k, col) {
    const c = S.ctx, u = S.u, l = 26 * u * k, g = 12 * u; if (k <= 0) return;
    c.save(); c.strokeStyle = col; c.lineWidth = Math.max(1, 1.2 * u); c.beginPath();
    for (const [x, y, sx, sy] of [[x0, y0, -1, -1], [x1, y0, 1, -1], [x0, y1, -1, 1], [x1, y1, 1, 1]]) {
      c.moveTo(x, y + sy * g); c.lineTo(x, y + sy * (g + l)); c.moveTo(x + sx * g, y); c.lineTo(x + sx * (g + l), y);
    }
    c.stroke(); c.restore();
  }

  /* ───────── page painters (sheets and reader screens share them) ───────── */
  function paintContents(S, x, y, w, h, o = {}) {
    const c = S.ctx, ink = o.ink || inkOf(S), dim = o.dim || mix(ink, paperOf(S), 0.45), rule = mix(ink, paperOf(S), 0.82), k = o.k == null ? 1 : o.k;
    const m = w * 0.085, s = w / 560, B = brand(), list = (o.entries || []).slice(0, 6);
    L.text(c, S.look, `${(B.host || '').toUpperCase()}   ·   NO. ${pad2(o.no || 12)}`, x + m, y + m * 0.9, { role: 'micro', px: 11 * s, color: dim, tracking: 0.22, maxW: w - m * 2 });
    const ty = y + m * 0.9 + 64 * s;
    dotText(S, o.title || B.name, x + m, ty, { role: 'accent', px: 54 * s, weight: 400, color: ink, k: clamp(k * 3), pitch: Math.max(1.5, 54 * s / 16) });
    c.fillStyle = ink; c.fillRect(x + m, ty + 20 * s, (w - m * 2) * E.out(clamp(k * 3 - 0.3)), Math.max(1, 2 * s));
    L.text(c, S.look, 'IN THIS ISSUE', x + m, ty + 54 * s, { role: 'micro', px: 10 * s, color: dim, tracking: 0.22 });
    const top = ty + 96 * s, pitch = Math.min(72 * s, (y + h - m - top) / Math.max(1, list.length));
    list.forEach((it, i) => {
      const yy = top + i * pitch, kk = clamp((k - 0.15 - i * 0.1) / 0.3); if (kk <= 0) return;
      dotText(S, String(PAGES[i]), x + m + 26 * s, yy + 20 * s, { role: 'display', px: 21 * s, weight: 400, color: ink, k: kk, align: 'right', pitch: 1.6 * s + 0.6 });
      dotText(S, nameOf(it), x + m + 46 * s, yy + 20 * s, { role: 'display', px: 24 * s, weight: 400, color: ink, k: kk, pitch: 1.6 * s + 0.6 });
      if (kk > 0.6) L.text(c, S.look, sourceOf(it, i).toUpperCase(), x + m + 46 * s, yy + 42 * s, { role: 'micro', px: 9.5 * s, color: dim, tracking: 0.16, maxW: w - m * 2 - 46 * s });
      c.fillStyle = rule; c.fillRect(x + m, yy + pitch - 12 * s, (w - m * 2) * E.out(kk), Math.max(1, s));
    });
  }
  function paintArticle(S, x, y, w, h, o = {}) {
    const c = S.ctx, ink = o.ink || inkOf(S), dim = mix(ink, paperOf(S), 0.5), s = w / 560, m = w * 0.09, title = o.title || brand().name;
    L.text(c, S.look, title, x + m, y + m + 30 * s, { role: 'display', px: 38 * s, weight: 400, color: ink, maxW: w - m * 2 });
    L.text(c, S.look, (o.source || brand().host || '').toUpperCase(), x + m, y + m + 62 * s, { role: 'micro', px: 10 * s, color: dim, tracking: 0.2 });
    const top = y + m + 104 * s, lh = 17 * s, capH = lh * 3, cap = (title.trim()[0] || 'A').toUpperCase();
    L.text(c, S.look, cap, x + m - 3 * s, top + capH - 4 * s, { role: 'display', px: capH * 1.32, weight: 400, color: ink });
    const capW = L.textW(c, S.look, cap, { role: 'display', px: capH * 1.32, weight: 400 }) + 10 * s;
    c.fillStyle = mix(ink, paperOf(S), 0.66);
    const lines = Math.floor((y + h - m - top) / lh);
    for (let i = 0; i < lines; i++) {
      const para = i % 9 === 8, last = i % 9 === 7, x0 = x + m + (i < 3 ? capW : 0) + (para ? 0 : 0), x1 = x + w - m - (last ? (w - m * 2) * (0.25 + rand(i * 7) * 0.35) : 0);
      if (para) continue;
      let xx = x0; let j = 0;
      while (xx < x1 - 6 * s) { const ww = Math.min(x1 - xx, (14 + rand(i * 131 + j * 17) * 46) * s); c.fillRect(xx, top + i * lh - 8 * s, ww, 5 * s); xx += ww + 5 * s; j++; }
    }
  }
  function paintCover(S, x, y, w, h, o = {}) {
    const ink = o.ink || inkOf(S), dim = mix(ink, paperOf(S), 0.45), s = w / 360, B = brand(), list = (o.entries || []).slice(0, 3), cx = x + w / 2;
    L.text(S.ctx, S.look, `NO. ${pad2(o.no || 12)}`, cx, y + h * 0.16, { role: 'micro', px: 9 * s, color: dim, tracking: 0.25, align: 'center' });
    L.text(S.ctx, S.look, o.title || B.name, cx, y + h * 0.3, { role: 'accent', px: 40 * s, weight: 400, color: ink, align: 'center', maxW: w * 0.8 });
    S.ctx.fillStyle = ink; S.ctx.fillRect(cx - w * 0.2, y + h * 0.35, w * 0.4, Math.max(1, s));
    list.forEach((it, i) => L.text(S.ctx, S.look, nameOf(it), cx, y + h * 0.47 + i * 30 * s, { role: 'display', px: 17 * s, weight: 400, color: ink, align: 'center', maxW: w * 0.78 }));
    L.text(S.ctx, S.look, (B.host || '').toUpperCase(), cx, y + h * 0.88, { role: 'micro', px: 8.5 * s, color: dim, tracking: 0.25, align: 'center' });
  }
  function banner(S, x, y, w, h, label, k) {
    if (k <= 0) return;
    const c = S.ctx, cell = Math.max(3, h / 5);
    c.save(); c.beginPath(); runs(c, x, y, w, h, cell, (i, j) => (i * cell) / w + cn(i, j, 41) * 0.18 < k * 1.18); c.clip();
    c.fillStyle = inkOf(S); c.fillRect(x, y, w, h);
    L.text(c, S.look, String(label).toUpperCase(), x + h * 0.6, y + h * 0.66, { role: 'micro', px: h * 0.38, color: paperOf(S), tracking: 0.22, maxW: w - h * 1.2 });
    c.restore();
  }

  /* ───────── devices ───────── */
  // the white slate reader with a dark spine; m morphs a plain sheet (0) into the device (1); returns the screen rect
  function slate(S, cx, cy, h, o = {}) {
    const c = S.ctx, u = S.u, w = h * 0.76, m = o.m == null ? 1 : o.m, K = KP(S); cy += Math.sin(S.lt * 1.2) * 4 * u;
    const x = cx - w / 2, y = cy - h / 2, body = mix('#FFFFFF', mix(K.paper, K.ink, 0.06), m), r = lerp(3 * u, h * 0.022, m);
    L.card(c, x, y, w, h, r, { fill: body, u, lift: o.lift == null ? 0.7 : o.lift });
    const sp = w * 0.055 * m;
    if (sp > 0.5) { c.save(); L.rr(c, x, y, w, h, r); c.clip(); c.fillStyle = mix(K.ink, K.paper, 0.12); c.fillRect(x, y, sp, h); c.fillStyle = rgba('#FFFFFF', 0.12); c.fillRect(x + sp - 1.5 * u, y, 1.5 * u, h); c.restore(); }
    const ins = w * 0.05 * m, sx = x + sp + ins, sy = y + ins * 1.1, sw = w - sp - ins * 2, sh = h - ins * 2.2;
    const scr = { x: sx, y: sy, w: sw, h: sh };
    const scan = o.scan == null ? 1 : o.scan, grey = eink(S);
    c.save(); c.beginPath(); c.rect(sx, sy, sw, sh); c.clip();
    c.fillStyle = scan >= 1 ? grey : '#FFFFFF'; c.fillRect(sx, sy, sw, sh);
    if (scan > 0 && scan < 1) { const cell = 6 * u, band = sw * 0.26, front = lerp(-band, sw + band, scan); c.beginPath(); runs(c, sx, sy, sw, sh, cell, (i, j) => i * cell < front - band || (i * cell < front && bayer(i, j) < (front - i * cell) / band)); c.fillStyle = grey; c.fill(); }
    if (m > 0.5) { c.fillStyle = rgba(K.ink, 0.06 * m); c.fillRect(sx, sy, sw, 2 * u); }
    if (o.paint) o.paint(scr);
    c.restore();
    return scr;
  }
  function pocket(S, cx, cy, h, o = {}) {
    const c = S.ctx, u = S.u, w = h * 0.72, K = KP(S), x = cx - w / 2, y = cy - h / 2, r = h * 0.055;
    L.card(c, x, y, w, h, r, { fill: mix(K.ink, '#000000', 0.2), u, lift: 0.9 });
    const g = c.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, rgba('#FFFFFF', 0.1)); g.addColorStop(0.4, rgba('#FFFFFF', 0)); L.rr(c, x, y, w, h, r); c.fillStyle = g; c.fill();
    const ins = w * 0.08, scr = { x: x + ins, y: y + ins * 1.05, w: w - ins * 2, h: h - ins * 2.4 };
    c.save(); c.beginPath(); c.rect(scr.x, scr.y, scr.w, scr.h); c.clip(); c.fillStyle = mix(eink(S), K.ink, 0.04); c.fillRect(scr.x, scr.y, scr.w, scr.h);
    if (o.paint) o.paint(scr);
    c.restore();
    c.fillStyle = rgba('#FFFFFF', 0.16); c.fillRect(cx - w * 0.08, y + h - ins * 0.7, w * 0.16, Math.max(1, 2 * u));
    return scr;
  }
  // e-ink full refresh inside a rect: black for 0.1 s, then a ragged dither band uncovers the new page
  function refresh(S, scr, t0, paintOld, paintNew) {
    const c = S.ctx, t = S.lt - t0;
    if (t < 0) { if (paintOld) paintOld(scr); return; }
    if (t < 0.1) { c.fillStyle = inkOf(S); c.fillRect(scr.x, scr.y, scr.w, scr.h); return; }
    paintNew(scr);
    const k = clamp((t - 0.1) / 0.18); if (k >= 1) return;
    const cell = Math.max(4, scr.w / 50), band = scr.h * 0.12, front = lerp(-band, scr.h + band, E.io(k));
    c.beginPath(); runs(c, scr.x, scr.y, scr.w, scr.h, cell, (i, j) => j * cell + cn(i, j, 9) * band > front); c.fillStyle = inkOf(S); c.fill();
  }
  // a page stack fanned about its lower-left: n sheets behind a hero, each a few degrees further, number + tab label
  function fan(S, cx, cy, w, h, n, k, labels) {
    const c = S.ctx, u = S.u, px = cx - w * 0.42, py = cy + h * 0.5, ink = inkOf(S);
    for (let i = n; i >= 1; i--) {
      const kk = typeof k === 'function' ? k(i) : k, a = (i * 3 * Math.PI / 180) * kk;
      c.save(); c.translate(px, py); c.rotate(a); c.translate(-px, -py);
      L.card(c, cx - w / 2, cy - h / 2, w, h, 3 * u, { fill: mix('#FFFFFF', paperOf(S), 0.25 + i * 0.05), u, lift: 0.28 });
      if (kk > 0.05) {
        c.globalAlpha *= clamp(kk * 2);
        L.text(c, S.look, String(PAGES[i % PAGES.length]), cx + w / 2 - 16 * u, cy - h / 2 + 34 * u, { role: 'display', px: 20 * u, weight: 400, color: ink, align: 'right' });
        const lab = labels && labels[(i - 1) % Math.max(1, labels.length)];
        if (lab) { c.save(); c.translate(cx + w / 2 - 14 * u, cy - h / 2 + 60 * u); c.rotate(Math.PI / 2); L.text(c, S.look, String(lab).toUpperCase(), 0, 0, { role: 'micro', px: 10 * u, color: mix(ink, paperOf(S), 0.4), tracking: 0.25, maxW: h * 0.5 }); c.restore(); }
      }
      c.restore();
    }
  }

  /* ───────── comets and clouds ───────── */
  const TAIL = (() => Array.from({ length: 420 }, (_, i) => ({ lag: Math.pow(rand(i * 3 + 11), 1.4) * 0.2, j: rand(i * 3 + 12) * 2 - 1, s: rand(i * 3 + 13) < 0.55 ? 2 : 3, a: 0.4 + rand(i * 5 + 1) * 0.6 })))();
  const bz = (P, t) => { const m = 1 - t; return [m * m * m * P[0][0] + 3 * m * m * t * P[1][0] + 3 * m * t * t * P[2][0] + t * t * t * P[3][0], m * m * m * P[0][1] + 3 * m * m * t * P[1][1] + 3 * m * t * t * P[2][1] + t * t * t * P[3][1]]; };
  // a dotted icon flying an S-curve into its slot, a tail of fine dots lagging and collapsing in; returns landed 0..1
  function comet(S, P, t0, dur, icon, size, col) {
    const c = S.ctx, u = S.u, t = S.lt - t0;
    if (t < 0) return 0;
    const head = E.io(clamp(t / dur));
    if (t < dur + 0.22) {
      c.fillStyle = col;
      for (const d of TAIL) {
        const tt = t - d.lag; if (tt <= 0) continue;
        const ui = E.io(clamp(tt / dur)); if (ui >= 1) continue;
        const [x, y] = bz(P, ui), [x2, y2] = bz(P, Math.min(1, ui + 0.01)), dx = x2 - x, dy = y2 - y, n = Math.hypot(dx, dy) || 1;
        const sp = d.j * 64 * u * (d.lag / 0.2 + 0.15) * (1 - ui), r = d.s * u * 0.5;
        c.globalAlpha = d.a * (1 - Math.pow(ui, 6));
        c.fillRect(x - dy / n * sp - r, y + dx / n * sp - r, r * 2, r * 2);
      }
      c.globalAlpha = 1;
    }
    const [hx, hy] = bz(P, head), sz = lerp(size * 1.9, size, E.out(clamp((t - dur * 0.6) / (dur * 0.5))));
    dotIcon(S, icon, hx, hy, sz, col, 1, Math.max(2 * u, sz / 18));
    return clamp((t - dur) / 0.15);
  }
  // a teardrop of fine dots hanging from a point; boils at 12 Hz, sways with the time
  const TEAR = (() => { const a = []; let t = 0; while (a.length < 820 && t < 30000) { t++; const x = rand(t * 2 + 3) * 0.8 - 0.4, y = rand(t * 2 + 4); const inside = y > 0.62 ? Math.hypot(x, y - 0.62) < 0.36 : Math.abs(x) < 0.36 * Math.sin(y / 0.62 * Math.PI / 2); if (!inside) continue; const edge = y > 0.62 ? Math.hypot(x, y - 0.62) / 0.36 : Math.abs(x) / Math.max(0.01, 0.36 * Math.sin(y / 0.62 * Math.PI / 2)); if (rand(t * 7 + 1) < edge * edge * 0.55) continue; a.push([x, y, rand(t * 9 + 5)]); } return a; })();
  const cloudPos = (S, i, d, x, y, H, sway) => { const f = Math.floor(S.lt * 12), j = 1.4 * S.u; const yy = d[1] * H; return [x + d[0] * H + sway * yy * yy / H + (rand(i * 31 + f) - 0.5) * j * 2, y + yy + (rand(i * 37 + f * 3) - 0.5) * j * 2]; };

  /* ═════════ SET-UPS ═════════ */

  /* Microcapsule specimen: one glass sphere of ink pellets on a plate, neighbours out of focus, a Fig. caption */
  L.def('insert:microcapsule-specimen', {
    kind: 'setup',
    plan(b) {
      const d = b.d || 3, flip = 0.45, back = flip + Math.max(0.5, (d - flip) * 0.45);
      return { cues: { fade: 0, cap: 0.3, flip, back, head: 0.3, headDone: 0.8 }, events: [{ at: 0.02, event: 'scene' }, { at: flip, event: 'pop' }, { at: back, event: 'pop' }], exit: { kind: 'circle', x: 0.5, y: 0.43, r: 0.26 }, entry: { kind: 'dot', x: 0.5, y: 0.43, r: 0.02 }, min: 2.2 };
    },
    draw(S) {
      const c = S.ctx, wide = isWide(S), R = Math.min(S.H * (wide ? 0.33 : 0.26), S.W * 0.38), cx = S.W / 2, cy = S.H * (wide ? 0.42 : 0.44), u = S.u;
      if (lum(S.P.bg) > 0.4) { S = Object.assign({}, S, { P: L.palette(S.look, 'ink') }); const g = c.createRadialGradient(cx, cy, 0, cx, cy, Math.hypot(S.W, S.H) * 0.6); g.addColorStop(0, S.P.bg2); g.addColorStop(1, S.P.bg); c.fillStyle = g; c.fillRect(-S.W, -S.H, S.W * 3, S.H * 3); }
      const fade = E.out(prog(S.lt, 0, 0.5)), bk = bokehField(S, R * 2.15, mix(S.P.bg, S.P.fg, 0.07));
      c.save(); c.globalAlpha *= fade * 0.9; c.drawImage(bk.cv, -bk.pad + noise(S.lt * 0.25, 2) * 14 * u + (cx - S.W / 2), -bk.pad + noise(S.lt * 0.22, 5) * 10 * u + (cy - S.H / 2)); c.restore();
      const sc = lerp(0.93, 1, E.out(prog(S.lt, 0, 1.2))), fl = S.at('flip'), bkT = S.at('back');
      capsule(S, cx, cy, R * sc, { a: fade, spin: 0.5 + S.lt * 0.22, white: (d, x) => clamp((S.lt - fl - d - (x + 1) * 0.012) / 0.08) - clamp((S.lt - bkT - d - (x + 1) * 0.012) / 0.08) });
      const txt = toks(S.b).map(t => t.s).join(' ');
      figCaption(S, { x: cx, y: cy + R + S.H * (wide ? 0.12 : 0.1), n: chapterNo(S.b), text: txt, t0: S.at('cap'), px: wide ? 40 : 42, maxW: S.W * 0.84 });
      if (S.b.text && S.b.text.eyebrow) eyebrowNum(S, { x: cx, y: S.H * (wide ? 0.07 : 0.08), n: chapterNo(S.b), label: S.b.text.eyebrow, t0: 0.2 });
    },
  });

  /* Capsule-to-pixel pull-back: the capsule becomes one cell of a disc grid, cells flip like coins as they shrink,
     the grid becomes the dot mesh of a page whose lit pixels ARE the headline; a 2x2 split on the drop, a snap to type */
  L.def('insert:capsule-pixel-pullback', {
    kind: 'setup',
    plan(b) { const pull = 0.35, split = pull + 1.35, snap = split + 0.42; return { cues: { pull, split, snap, eyebrow: snap + 0.08, sub: snap + 0.2, head: snap, headDone: snap + 0.05 }, events: [{ at: 0.02, event: 'scene' }, { at: pull, event: 'build' }, { at: split, event: 'hard-hit' }, { at: snap, event: 'key-word' }], exit: { kind: 'dot', x: 0.5, y: 0.5, r: 0.012 }, entry: { kind: 'circle', x: 0.5, y: 0.5, r: 0.26 }, min: snap + 1.1 }; },
    draw(S) {
      const c = S.ctx, u = S.u, lt = S.lt, b = S.b, wide = isWide(S), cx = S.W / 2, cy = S.H / 2;
      const R0 = Math.min(S.H * 0.26, S.W * 0.3), P0 = R0 * 2.25, P1 = 9 * u, pull = S.at('pull'), split = S.at('split'), snap = S.at('snap');
      const kp = prog(lt, pull, split - pull), pitch = lt < split ? logLerp(P0, P1, E.io(kp)) : P1 / 2;
      const px = Math.min(headPx(S, b, wide ? 150 : 128), S.W * 0.12), maxW = S.W * (wide ? 0.78 : 0.86);
      const lay = L.layout(c, S.look, toks(b), { px, maxW, x: cx, y: 0, align: 'center', maxLines: 3, lineH: 1.04 });
      const lay2 = L.layout(c, S.look, toks(b), { px: lay.px, maxW, x: cx, y: cy - lay.H / 2 - 10 * u, align: 'center', maxLines: 3, lineH: 1.04 });
      const unlit = mix(S.P.bg, S.P.fg, 0.1), lit = S.P.fg;
      if (lt >= snap + 0.05) { // crisp: the page is real now
        for (const w of lay2.words) L.drawWord(c, S.look, S.P, w, {});
        if (b.text.eyebrow) eyebrowNum(S, { x: cx, y: lay2.top - 44 * u, n: chapterNo(b), label: b.text.eyebrow, t0: S.at('eyebrow') });
        const sub = b.text.sub || itemsOf(b, 3).join('  ·  '); if (sub) subline(S, { x: cx, y: lay2.bottom + 56 * u, text: sub, align: 'center', t0: S.at('sub'), maxW });
        return;
      }
      const M = toks(b).length ? headMask(S, lay2, 'pull') : null, litK = clamp(1 - (pitch - 26 * u) / (70 * u));
      if (pitch >= 18 * u) {
        const nx = Math.ceil(cx / pitch) + 1, ny = Math.ceil(cy / pitch) + 1, r = pitch * 0.44, sdim = ball(unlit), slit = ball(lit), far = clamp((pitch - 140 * u) / (300 * u));
        for (let j = -ny; j <= ny; j++) for (let i = -nx; i <= nx; i++) {
          if (!i && !j) continue;
          const x = cx + i * pitch, y = cy + j * pitch; if (x < -r || x > S.W + r || y < -r || y > S.H + r) continue;
          const inText = M && x >= 0 && y >= 0 && x < S.W && y < S.H && M.a[(y | 0) * S.W + (x | 0)] > 120 && cn(i, j, 2) < litK;
          const spark = cn(i, j, 3) < 0.09, st = pull + cn(i, j, 5) * 1.25, p = spark ? clamp((lt - st) / 0.12) : 0;
          const xs = spark ? Math.max(0.08, Math.abs(Math.cos(Math.PI * p))) : 1, face = inText || (spark && p >= 0.5);
          c.globalAlpha = far > 0 ? 1 - far * 0.55 : 1;
          c.drawImage(face ? slit : sdim, x - r * xs, y - r, r * 2 * xs, r * 2);
        }
        c.globalAlpha = 1;
        capsule(S, cx, cy, r, { spin: 0.5 + lt * 0.22 });
      } else {
        const p = Math.max(3, Math.round(pitch)), sq = lt >= split && lt < split + 0.06;
        c.fillStyle = unlit; c.fillRect(0, 0, S.W, S.H);
        if (M) { c.save(); c.globalAlpha = litK; c.drawImage(tinted(M.cv, lit, `pull|${S.W}|${lay2.px.toFixed(1)}|${toks(b).map(t => t.s).join(' ')}`), 0, 0); c.restore(); }
        // a sparkle of lit cells snapped to the grid, fading as the page reads
        c.fillStyle = lit; const fade = 1 - clamp((lt - split) / 0.35);
        for (let i = 0; i < 520 * fade; i++) { const x = cx + Math.round((rand(i * 2 + 1) * S.W - cx) / p) * p, y = cy + Math.round((rand(i * 2 + 2) * S.H - cy) / p) * p; c.fillRect(x - p / 2, y - p / 2, p, p); }
        screenOver(c, S.W, S.H, p, S.P.bg, cx - p / 2, cy - p / 2, sq);
      }
    },
  });

  /* Stipple inbox: a chapter claim on the left, a crop-marked panel with an address field; dotted icons fly in on
     comets of fine dots, one a beat, and print each row (title + source) where they land */
  L.def('insert:stipple-inbox-collect', {
    kind: 'setup',
    plan(b, F) {
      const tp = T(b, F, 0.15), n = Math.max(1, Math.min(5, itemsOf(b).length || 3)), starts = [];
      for (let k = 0; k < n; k++) starts.push(0.55 + (k < 2 ? k * 0.62 : 1.24 + (k - 2) * 0.32));
      const ev = [...tp.events, { at: 0.3, event: 'ui-reveal' }];
      starts.forEach(s => { ev.push({ at: s, event: 'slide-out' }, { at: s + 0.65, event: 'list-item' }); });
      return { cues: { eyebrow: 0.05, head: 0.15, headDone: tp.done, sub: tp.done + 0.1, panel: 0.25, field: 0.35, comets: starts }, events: ev, exit: { kind: 'rect', x: 0.66, y: 0.5, w: 0.4, h: 0.7 }, entry: { kind: 'dot', x: 0.2, y: 0.5, r: 0.01 }, min: starts[n - 1] + 1.1 };
    },
    draw(S) {
      const c = S.ctx, u = S.u, b = S.b, wide = isWide(S), tall = isTall(S), its = itemsOf(b, 5);
      const starts = S.cues.comets || [0.55, 1.17, 1.79, 2.11, 2.43];
      const pr = wide ? { x0: S.W * 0.5, y0: S.H * 0.13, x1: S.W * 0.9, y1: S.H * 0.87 } : { x0: S.W * 0.08, y0: S.H * (tall ? 0.42 : 0.44), x1: S.W * 0.92, y1: S.H * 0.95 };
      chapter(S, wide ? { x: S.W * 0.075, y: S.H * 0.5, maxW: S.W * 0.36, px: headPx(S, b, 104) } : { x: S.W * 0.08, top: S.H * (tall ? 0.08 : 0.07), maxW: S.W * 0.84, px: headPx(S, b, 124) });
      const ink = S.P.fg, dim = S.P.dim, rule = S.P.rule, pk = E.out(prog(S.lt, S.at('panel'), 0.6));
      pr.y1 = Math.min(pr.y1, pr.y0 + 228 * u + Math.max(3, its.length) * 118 * u);
      if (pk > 0) { c.save(); c.globalAlpha *= pk; const lift = (1 - pk) * 30 * u; L.card(c, pr.x0, pr.y0 + lift, pr.x1 - pr.x0, pr.y1 - pr.y0, 6 * u, { fill: mix(S.P.bg, S.P.fg, 0.035), u, lift: 0.6, stroke: rgba(S.P.fg, 0.06) }); c.restore(); }
      cropMarks(S, pr.x0 - 10 * u, pr.y0 - 10 * u, pr.x1 + 10 * u, pr.y1 + 10 * u, pk, mix(S.P.bg, S.P.fg, 0.35));
      const ix = pr.x0 + (pr.x1 - pr.x0) * 0.08, iw = (pr.x1 - pr.x0) * 0.84, fk = E.out(prog(S.lt, S.at('field'), 0.5));
      // colophon field: label, the brand's address in italic serif, a hairline, the next label
      const fy = pr.y0 + 58 * u;
      c.save(); c.globalAlpha *= fk;
      L.text(c, S.look, 'SEND TO', ix, fy, { role: 'micro', px: 13 * u, color: dim, tracking: 0.25 });
      dotText(S, brand().host || brand().name, ix, fy + 66 * u, { role: 'accent', px: 60 * u, weight: 400, color: ink, k: E.out(prog(S.lt, S.at('field') + 0.1, 0.5)), pitch: 3 * u });
      c.fillStyle = rule; c.fillRect(ix, fy + 92 * u, iw * fk, Math.max(1, u));
      L.text(c, S.look, 'INBOX', ix, fy + 132 * u, { role: 'micro', px: 13 * u, color: dim, tracking: 0.25 });
      c.restore();
      const top = fy + 170 * u, pitch = Math.min(118 * u, (pr.y1 - 30 * u - top) / Math.max(1, its.length));
      its.forEach((it, k) => {
        const ry = top + k * pitch + pitch * 0.42, t0 = starts[k] || 0.5 + k * 0.4;
        const slotX = ix + 14 * u, slotY = ry - 9 * u;
        const P = wide ? [[S.W * 1.04, Math.min(S.H * 1.04, ry + S.H * 0.3)], [S.W * 0.95, ry + S.H * 0.34], [slotX + S.W * 0.22, ry - S.H * 0.06], [slotX, slotY]]
          : [[S.W * 0.86, S.H * 1.05], [S.W * 1.0, ry + S.H * 0.2], [slotX + S.W * 0.3, ry - S.H * 0.05], [slotX, slotY]];
        const land = comet(S, P, t0, 0.65, L.iconFor(nameOf(it), k), 36 * u, ink);
        if (land > 0) {
          dotText(S, nameOf(it), ix + 62 * u, ry, { role: 'display', px: Math.min(44 * u, pitch * 0.4), weight: 400, color: ink, k: E.out(land * 0.9 + clamp((S.lt - t0 - 0.8) / 0.4) * 0.1), pitch: 2.4 * u });
          if (pitch > 60 * u) L.text(c, S.look, sourceOf(it, k).toUpperCase().slice(0, Math.floor(clamp((S.lt - t0 - 0.7) / 0.3) * 40)), ix + 62 * u, ry + 32 * u, { role: 'micro', px: 14 * u, color: dim, tracking: 0.16, maxW: iw - 62 * u });
          c.fillStyle = rule; c.fillRect(ix, ry + pitch * 0.5, iw * E.out(land), Math.max(1, u));
        }
      });
    },
  });

  /* Ink-cloud sources: dotted source icons hang teardrops of ink; each cloud stretches into streaks that pour into a
     row of the list and settle as its title */
  L.def('insert:ink-cloud-sources', {
    kind: 'setup',
    plan(b, F) {
      const tp = T(b, F, 0.1), n = Math.max(1, Math.min(4, itemsOf(b).length || 4)), hang = 0.35, pour = Array.from({ length: n }, (_, k) => 1.1 + k * 0.31);
      const ev = [...tp.events]; for (let k = 0; k < n; k++) ev.push({ at: hang + k * 0.12, event: 'pop' }, { at: pour[k], event: 'build' }, { at: pour[k] + 0.32, event: 'list-item' });
      return { cues: { eyebrow: 0, head: 0.1, headDone: tp.done, sub: tp.done + 0.1, hang, pour }, events: ev, exit: { kind: 'rect', x: 0.6, y: 0.5, w: 0.3, h: 0.6 }, min: pour[n - 1] + 1.0 };
    },
    draw(S) {
      const c = S.ctx, u = S.u, b = S.b, wide = isWide(S), tall = isTall(S), its = itemsOf(b, 4), n = its.length || 1, pour = S.cues.pour || [1.1, 1.4, 1.7, 2.0];
      chapter(S, wide ? { x: S.W * 0.07, y: S.H * 0.5, maxW: S.W * 0.34, px: headPx(S, b, 100) } : { x: S.W * 0.08, top: S.H * 0.07, maxW: S.W * 0.84, px: headPx(S, b, 124) });
      const lx = wide ? S.W * 0.44 : S.W * 0.1, ly = wide ? S.H * 0.24 : S.H * (tall ? 0.38 : 0.4), lw = wide ? S.W * 0.3 : S.W * 0.8, pitch = (wide ? 0.15 : tall ? 0.065 : 0.07) * S.H;
      const ink = S.P.fg, H = S.H * (wide ? 0.3 : tall ? 0.12 : 0.13);
      const icons = wide ? [[0.79, 0.13], [0.92, 0.2], [0.8, 0.55], [0.93, 0.62]] : [[0.2, 0.71], [0.4, 0.75], [0.6, 0.71], [0.8, 0.75]];
      its.forEach((it, k) => {
        const ry = ly + k * pitch, [fx, fy] = icons[k % 4], ix = fx * S.W, iy = fy * S.H, t0 = S.at('hang') + k * 0.12, tp = pour[k];
        const drop = spring(S.lt - t0, 'soft'), yOff = (1 - drop) * -S.H * 0.25, ia = clamp((S.lt - t0) / 0.15);
        // rows: rule + icon slot always, title prints from the stream
        c.fillStyle = S.P.rule; c.fillRect(lx, ry + pitch * 0.45, lw * E.out(prog(S.lt, 0.2 + k * 0.08, 0.5)), Math.max(1, u));
        const name = nameOf(it), tpx = Math.min(44 * u, pitch * 0.36), D = glyphDots(S.look, 'display', tpx, 400, name, 2.6 * u), tx = lx + 62 * u, ty = ry + tpx * 0.35;
        const sweep = clamp((S.lt - tp) / 0.42), settled = clamp((S.lt - tp - 0.42) / 0.18);
        if (S.lt > tp + 0.3) dotIcon(S, L.iconFor(name, k), lx + 18 * u, ry, 34 * u, ink, clamp((S.lt - tp - 0.3) / 0.15));
        if (ia > 0) {
          const sway = Math.sin(S.lt * 1.7 + k) * 0.12 + (1 - drop) * 0.3, used = sweep;
          c.save(); c.globalAlpha *= ia; dotIcon(S, L.iconFor(name, k), ix, iy + yOff, 72 * u, ink, ia); c.restore();
          c.fillStyle = ink; const r = u * 1.1, nd = TEAR.length, np = D.p.length / 4;
          for (let i = 0; i < nd; i++) {
            const d = TEAR[i], [x0, y0] = cloudPos(S, i, d, ix, iy + yOff + 46 * u, H, sway);
            if (used <= 0 || d[2] > 0.72) { c.globalAlpha = ia * (0.5 + d[2] * 0.5); c.fillRect(x0 - r, y0 - r, r * 2, r * 2); continue; }
            const q = (i * 7) % Math.max(1, np), x1 = tx + (np ? D.p[q * 4] : 0), y1 = ty + (np ? D.p[q * 4 + 1] : 0);
            const p = clamp((S.lt - tp - d[2] * 0.12) / 0.3); if (p >= 1) continue;
            const ex = E.io(p), ey = E.out(clamp(p * 2.4)), x = lerp(x0, x1, ex), y = lerp(y0, y1, ey), fl = 1 + Math.sin(Math.PI * p) * 0.7;
            c.globalAlpha = 0.5 + d[2] * 0.5; c.fillRect(x - r * fl, y - r * fl * 0.8, r * 2 * fl * (1 + ex * 2 * (1 - p)), r * 1.6 * fl);
          }
          c.globalAlpha = 1;
        }
        if (sweep > 0.4) dotText(S, name, tx, ty, { role: 'display', px: tpx, weight: 400, color: ink, k: lerp(0.7, 1, settled) * clamp((sweep - 0.4) / 0.6), pitch: 2.6 * u });
        if (settled > 0.5 && pitch > 70 * u) L.text(c, S.look, sourceOf(it, k).toUpperCase(), tx, ty + 32 * u, { role: 'micro', px: 14 * u, color: S.P.dim, tracking: 0.16, maxW: lw - 50 * u });
      });
    },
  });

  /* Contents sheet: the issue as one typeset page (masthead, italic title, numbered entries), a stack fanning behind */
  L.def('insert:contents-sheet-issue', {
    kind: 'setup',
    plan(b, F) { const tp = T(b, F, 0.1); return { cues: { eyebrow: 0, head: 0.1, headDone: tp.done, sub: tp.done + 0.1, sheet: 0.12, print: 0.35, fan: 0.75 }, events: [...tp.events, { at: 0.12, event: 'card-in' }, { at: 0.35, event: 'cascade' }, { at: 0.75, event: 'riffle' }], exit: { kind: 'rect', x: 0.66, y: 0.5, w: 0.3, h: 0.75 }, entry: { kind: 'rect', x: 0.66, y: 0.5, w: 0.3, h: 0.75 }, min: 2.2 }; },
    draw(S) {
      const b = S.b, u = S.u, wide = isWide(S), tall = isTall(S), its = itemsOf(b, 6);
      chapter(S, wide ? { x: S.W * 0.075, y: S.H * 0.5, maxW: S.W * 0.38, px: headPx(S, b, 108) } : { x: S.W * 0.08, top: S.H * 0.06, maxW: S.W * 0.84, px: headPx(S, b, 124) });
      const h = wide ? S.H * 0.8 : S.H * (tall ? 0.56 : 0.58), w = h * 0.74, cx = wide ? S.W * 0.64 : S.W * 0.46, cy = wide ? S.H * 0.52 : S.H * (tall ? 0.66 : 0.68);
      const sp = spring(S.lt - S.at('sheet'), 'soft'), y = cy + (1 - sp) * S.H * 0.3, fk = i => E.quick(prog(S.lt, S.at('fan') + (6 - i) * 0.04, 0.55)) * (1 + Math.sin(S.lt * 1.3 + i) * 0.04);
      if (sp <= 0) return;
      fan(S, cx, y, w, h, 6, fk, its.length ? its.map(nameOf) : null);
      L.card(S.ctx, cx - w / 2, y - h / 2, w, h, 3 * u, { fill: '#FFFFFF', u, lift: 0.6 + sp * 0.3 });
      paintContents(S, cx - w / 2, y - h / 2, w, h, { entries: its, k: clamp((S.lt - S.at('print')) / 1.0) });
    },
  });

  /* Tabbed page fan: a hero page front and centre; six sheets swing out behind it, each showing its page number and a
     spaced-caps tab; it folds back at the end of the beat */
  L.def('insert:tabbed-page-fan', {
    kind: 'setup',
    plan(b, F) { const d = b.d || 3, tp = T(b, F, 0.1); return { cues: { eyebrow: 0, head: 0.1, headDone: tp.done, sub: tp.done + 0.1, page: 0.1, fan: 0.5, fold: Math.max(1.6, d - 0.45) }, events: [...tp.events, { at: 0.1, event: 'card-in' }, { at: 0.5, event: 'riffle' }, { at: Math.max(1.6, d - 0.45), event: 'page-turn' }], exit: { kind: 'rect', x: 0.62, y: 0.5, w: 0.26, h: 0.7 }, min: 2.4 }; },
    draw(S) {
      const b = S.b, c = S.ctx, u = S.u, wide = isWide(S), tall = isTall(S), its = itemsOf(b, 6), labels = its.length ? its.map(nameOf) : ['Chapter'];
      chapter(S, wide ? { x: S.W * 0.075, y: S.H * 0.5, maxW: S.W * 0.36, px: headPx(S, b, 108) } : { x: S.W * 0.08, top: S.H * 0.06, maxW: S.W * 0.84, px: headPx(S, b, 124) });
      const h = wide ? S.H * 0.74 : S.H * (tall ? 0.52 : 0.56), w = h * 0.72, cx = wide ? S.W * 0.6 : S.W * 0.42, cy = wide ? S.H * 0.53 : S.H * (tall ? 0.66 : 0.69);
      const sp = spring(S.lt - S.at('page'), 'soft'); if (sp <= 0) return;
      const fold = E.in(prog(S.lt, S.at('fold'), 0.25)), fk = i => E.quick(prog(S.lt, S.at('fan') + (6 - i) * 0.04, 0.55)) * 6 * (1 - fold) * (1 + i * 0.0);
      const y = cy + (1 - sp) * S.H * 0.3;
      fan(S, cx, y, w, h, 6, fk, labels);
      L.card(c, cx - w / 2, y - h / 2, w, h, 3 * u, { fill: '#FFFFFF', u, lift: 0.8 });
      const ink = inkOf(S), m = w * 0.1, it0 = labels[0];
      L.text(c, S.look, `${PAGES[0]}`, cx + w / 2 - m, y - h / 2 + m + 6 * u, { role: 'display', px: 22 * u, weight: 400, color: ink, align: 'right' });
      paintArticle(S, cx - w / 2, y - h / 2 + m * 0.4, w, h - m * 0.4, { title: it0, source: sourceOf(its[0] || '', 0) });
    },
  });

  /* Page to spine reader: a white page arrives, grows a bezel and a dark spine and becomes an e-reader; an e-ink scan
     turns the paper grey while the contents stay registered */
  L.def('insert:spine-reader-deliver', {
    kind: 'setup',
    plan(b, F) { const tp = T(b, F, 0.1); return { cues: { eyebrow: 0, head: 0.1, headDone: tp.done, sub: tp.done + 0.1, page: 0.05, morph: 0.6, scan: 0.92 }, events: [...tp.events, { at: 0.05, event: 'card-in' }, { at: 0.6, event: 'scene' }, { at: 0.92, event: 'build' }], exit: { kind: 'rect', x: 0.64, y: 0.5, w: 0.3, h: 0.78 }, entry: { kind: 'rect', x: 0.64, y: 0.5, w: 0.3, h: 0.78 }, min: 2.0 }; },
    draw(S) {
      const b = S.b, u = S.u, wide = isWide(S), tall = isTall(S), its = itemsOf(b, 6);
      chapter(S, wide ? { x: S.W * 0.075, y: S.H * 0.5, maxW: S.W * 0.38, px: headPx(S, b, 108) } : { x: S.W * 0.08, top: S.H * 0.06, maxW: S.W * 0.84, px: headPx(S, b, 124) });
      const h = wide ? S.H * 0.82 : S.H * (tall ? 0.56 : 0.58), cx = wide ? S.W * 0.65 : S.W / 2, cy = wide ? S.H * 0.52 : S.H * (tall ? 0.66 : 0.68);
      const sp = spring(S.lt - S.at('page'), 'soft'); if (sp <= 0) return;
      const m = E.io(prog(S.lt, S.at('morph'), 0.3)), sc = lerp(1, 0.96, m) * (1 + prog(S.lt, 0, S.d) * 0.012), scan = prog(S.lt, S.at('scan'), 0.32);
      slate(S, cx, cy + (1 - sp) * S.H * 0.3, h * sc, { m, scan, paint: r => paintContents(S, r.x, r.y, r.w, r.h, { entries: its, k: clamp((S.lt - 0.2) / 0.9) }) });
    },
  });

  /* Reader duo: the slate makes room, a black pocket reader slides in and refreshes (black flash, dither reveal) to the
     new issue's cover; a banner prints on the slate and its page turns to an article with a drop cap */
  L.def('insert:reader-duo-refresh', {
    kind: 'setup',
    plan(b, F) { const tp = T(b, F, 0.1), slide = 0.35, ref = 0.9, ban = 1.05, turn = 1.4; return { cues: { eyebrow: 0, head: 0.1, headDone: tp.done, sub: tp.done + 0.1, slide, refresh: ref, banner: ban, turn }, events: [...tp.events, { at: slide, event: 'slide-out' }, { at: slide + 0.3, event: 'card-in' }, { at: ref, event: 'pop' }, { at: ban, event: 'notify' }, { at: turn, event: 'page-turn' }], exit: { kind: 'rect', x: 0.8, y: 0.55, w: 0.16, h: 0.4 }, min: turn + 0.9 }; },
    draw(S) {
      const b = S.b, u = S.u, wide = isWide(S), tall = isTall(S), its = itemsOf(b, 6);
      chapter(S, wide ? { x: S.W * 0.07, y: S.H * 0.5, maxW: S.W * 0.32, px: headPx(S, b, 100) } : { x: S.W * 0.08, top: S.H * 0.06, maxW: S.W * 0.84, px: headPx(S, b, 124) });
      const sk = E.expo(prog(S.lt, S.at('slide'), 0.4));
      const h = wide ? S.H * 0.78 : S.H * (tall ? 0.5 : 0.56), base = wide ? { x: S.W * 0.55, y: S.H * 0.52 } : { x: S.W * (tall ? 0.42 : 0.4), y: S.H * (tall ? 0.62 : 0.69) };
      const sx = lerp(wide ? S.W * 0.62 : S.W / 2, base.x, sk), sh = h * lerp(1, 0.93, sk);
      const tTurn = S.at('turn');
      const scr = slate(S, sx, base.y, sh, { paint: r => {
        const t = S.lt - tTurn;
        if (t < 0) paintContents(S, r.x, r.y + r.h * 0.04, r.w, r.h * 0.96, { entries: its, k: 1 });
        else { paintArticle(S, r.x, r.y + r.h * 0.04, r.w, r.h * 0.96, { title: nameOf(its[0] || brand().name), source: sourceOf(its[0] || '', 0) }); if (t < 0.12) { const c = S.ctx, cell = Math.max(4, r.w / 40), f = t / 0.12; c.beginPath(); runs(c, r.x, r.y, r.w, r.h, cell, (i, j) => (j * cell) / r.h + cn(i, j, 3) * 0.2 > f * 1.2); c.fillStyle = eink(S); c.fill(); } }
        banner(S, r.x, r.y, r.w, Math.max(16 * u, r.h * 0.045), `New issue  ·  ${(b.text && b.text.eyebrow) || brand().name}`, clamp((S.lt - S.at('banner')) / 0.18));
      } });
      void scr;
      const ph = h * (wide ? 0.62 : tall ? 0.5 : 0.66), px = lerp(S.W + ph, wide ? S.W * 0.81 : tall ? S.W * 0.74 : S.W * 0.79, sk), py = base.y + h * (tall ? 0.36 : 0.12);
      if (sk > 0) pocket(S, px, py, ph, { paint: r => refresh(S, r, S.at('refresh'), null, rr2 => paintCover(S, rr2.x, rr2.y, rr2.w, rr2.h, { entries: its })) });
    },
  });

  /* Flip-dot board: a wall of coins; on the beat they turn over left to right to spell the key word in lit faces, a
     few keep flipping while the full line sits under it */
  L.def('insert:flip-dot-board', {
    kind: 'setup',
    plan(b, F) { return { cues: { flip: 0.2, head: 0.9, headDone: 1.5, sub: 1.4, eyebrow: 1.2 }, events: [{ at: 0.2, event: 'cascade' }, { at: 0.75, event: 'key-word' }, { at: 0.9, event: 'word' }], exit: { kind: 'dot', x: 0.5, y: 0.4, r: 0.02 }, min: 2.2 }; },
    draw(S) {
      const c = S.ctx, u = S.u, b = S.b, wide = isWide(S), tk = toks(b);
      const acc = tk.find(t => t.accent), joined = tk.map(t => t.s).join(' ');
      const word = (joined.length <= 12 ? joined : (acc ? acc.s : tk.reduce((a, t) => (t.s.length > a.length ? t.s : a), ''))).replace(/[.,!?;:]+$/, '');
      const pitch = S.H / (wide ? 30 : 44), cols = Math.ceil(S.W / pitch), rows = Math.ceil(S.H / pitch), ox = (S.W - (cols - 1) * pitch) / 2, oy = (S.H - (rows - 1) * pitch) / 2;
      const boardH = S.H * (wide ? 0.62 : 0.5), bpx = Math.min(boardH * 0.62, S.W * 0.86 / Math.max(2, word.length * 0.5));
      const lay = L.layout(c, S.look, [{ s: word }], { px: bpx, maxW: S.W * 0.9, x: S.W / 2, y: S.H * (wide ? 0.4 : 0.38) - bpx * 0.62, align: 'center', role: 'display', maxLines: 1 });
      lay.words.forEach(w => { w.tk = Object.assign({}, w.tk, { weight: 800 }); });
      const flat = [], M = headMask(S, lay, 'flip'), lit = ball(S.P.fg), dark = ball(mix(S.P.bg, S.P.fg, 0.07)), r = pitch * 0.42, f0 = S.at('flip');
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        const x = ox + i * pitch, y = oy + j * pitch, on = M.a[(Math.min(S.H - 1, y | 0)) * S.W + Math.min(S.W - 1, x | 0)] > 110;
        let p = 0, face = 0;
        if (on) { const st = f0 + (x / S.W) * 0.55 + cn(i, j, 4) * 0.12; p = clamp((S.lt - st) / 0.14); face = p >= 0.5 ? 1 : 0; }
        else if (cn(i, j, 6) < 0.04) { const per = 1.6 + cn(i, j, 7) * 1.6, ph = (S.lt + cn(i, j, 8) * per) % per; p = clamp(ph / 0.14); const on2 = Math.floor((S.lt + cn(i, j, 8) * per) / per) % 2 === 1; face = (p >= 0.5) === on2 ? 1 : 0; if (p >= 1) p = 0; }
        const xs = Math.max(0.07, Math.abs(Math.cos(Math.PI * p)));
        if (face) c.drawImage(lit, x - r * xs, y - r, r * 2 * xs, r * 2); else { flat.push(x, y, r * xs); }
      }
      c.fillStyle = mix(S.P.bg, S.P.fg, 0.075); c.beginPath(); for (let q = 0; q < flat.length; q += 3) { c.moveTo(flat[q] + flat[q + 2], flat[q + 1]); c.ellipse(flat[q], flat[q + 1], flat[q + 2], r, 0, 0, Math.PI * 2); } c.fill();
      const g = c.createLinearGradient(0, S.H * 0.68, 0, S.H); g.addColorStop(0, rgba(S.P.bg, 0)); g.addColorStop(0.35, rgba(S.P.bg, 0.92)); g.addColorStop(1, S.P.bg); c.fillStyle = g; c.fillRect(0, S.H * 0.68, S.W, S.H * 0.32);
      if (joined !== word || (b.text && b.text.sub)) { const hl = L.headline(S, { px: 54 * u, maxW: S.W * 0.8, x: S.W / 2, y: S.H * (wide ? 0.8 : 0.78), align: 'center', maxLines: 2 }); if (b.text && b.text.sub && hl) subline(S, { x: S.W / 2, y: hl.bottom + 40 * u, text: b.text.sub, align: 'center', t0: S.at('sub'), maxW: S.W * 0.8 }); }
      else if (b.text && b.text.eyebrow) eyebrowNum(S, { x: S.W / 2, y: S.H * 0.86, n: chapterNo(b), label: b.text.eyebrow, t0: S.at('eyebrow') });
    },
  });

  /* Dot-printed stat: one number printed as halftone dots that thicken into ink, landing grey and settling black,
     inside crop marks, with a numbered eyebrow and a middot label */
  L.def('insert:stat-dot-print', {
    kind: 'setup',
    plan(b) { return { cues: { eyebrow: 0, num: 0.15, settle: 1.05, label: 0.8, head: 0.3, headDone: 0.9, marks: 0.05 }, events: [{ at: 0.15, event: 'cascade' }, { at: 1.05, event: 'stat' }, { at: 0.8, event: 'word' }], exit: { kind: 'dot', x: 0.5, y: 0.5, r: 0.014 }, min: 2.0 }; },
    draw(S) {
      const c = S.ctx, u = S.u, b = S.b, wide = isWide(S), n = (b.data && b.data.number) || { value: 3, suffix: 'x', label: '' };
      const str = `${n.prefix || ''}${typeof n.value === 'number' ? String(n.value).replace(/\B(?=(\d{3})+(?!\d))/g, ',') : n.value}${n.suffix || ''}`;
      let px = Math.min(S.H * 0.5, S.W * 0.34) * (str.length > 5 ? 5 / str.length : 1);
      const y = S.H * 0.6, k = clamp((S.lt - S.at('num')) / 0.75), st = S.lt - S.at('settle'), set = st < 0 ? 0 : st < 0.05 ? 0.5 : 1;
      const col = mix(mix(S.P.bg, S.P.fg, 0.55), S.P.fg, set), tw = L.textW(c, S.look, str, { role: 'numeral', px, weight: 400, tracking: -0.03 });
      const mk = E.out(prog(S.lt, S.at('marks'), 0.6)), bx = Math.max(tw * 0.62, S.W * 0.22);
      cropMarks(S, S.W / 2 - bx, y - px * 0.92, S.W / 2 + bx, y + px * 0.2, mk, mix(S.P.bg, S.P.fg, 0.4));
      dotText(S, str, S.W / 2, y, { role: 'numeral', px, weight: 400, color: col, k, align: 'center', tracking: -0.03, pitch: Math.max(4 * u, px / 38), dot: 0.42 });
      if (b.text.eyebrow) eyebrowNum(S, { x: S.W / 2, y: y - px * 0.92 - 70 * u, n: chapterNo(b), label: b.text.eyebrow, t0: S.at('eyebrow') });
      const lab = n.label || toks(b).map(t => t.s).join(' ');
      subline(S, { x: S.W / 2, y: y + px * 0.2 + 70 * u, text: lab, align: 'center', t0: S.at('label'), px: 26, maxW: S.W * 0.8, color: S.P.dim });
      if (n.label && toks(b).length) L.headline(S, { px: 52 * u, maxW: S.W * 0.7, x: S.W / 2, y: S.H * 0.86 - 20 * u, align: 'center', maxLines: 1 });
    },
  });

  /* ═════════ END CARD ═════════ */
  /* Dot-printed wordmark: on paper the italic wordmark prints left to right in grey dots, the tagline and the address
     print under it, the mark settles to full ink, the address snaps bigger with the accent dot in it */
  L.def('end_card:dot-printed-wordmark', {
    kind: 'end',
    plan() { return { cues: { mark: 0.1, tag: 0.42, url: 0.55, settle: 0.8, swap: 1.35 }, events: [{ at: 0.1, event: 'cascade' }, { at: 0.8, event: 'key-word' }, { at: 1.35, event: 'cta' }], entry: { kind: 'dot', x: 0.5, y: 0.45, r: 0.02 }, min: 2.2 }; },
    draw(S) {
      const c = S.ctx, u = S.u, B = brand(), name = B.name || 'Brand';
      const px = Math.min(S.H * 0.21, S.W * 0.16) * (name.length > 7 ? 7 / name.length : 1), y = S.H * 0.5;
      const st = S.lt - S.at('settle'), set = st < 0 ? 0 : st < 0.05 ? 0.5 : 1, grey = mix(S.P.bg, S.P.fg, 0.55);
      dotText(S, name, S.W / 2, y, { role: 'wordmark', px, color: mix(grey, S.P.fg, set), k: clamp((S.lt - S.at('mark')) / 0.45), align: 'center', pitch: Math.max(3 * u, px / 34), dot: 0.42 });
      const tag = B.tagline || toks(S.b).map(t => t.s).join(' ');
      if (tag) dotText(S, tag, S.W / 2, y + px * 0.5, { role: 'accent', px: px * 0.17, weight: 400, color: S.P.dim, k: clamp((S.lt - S.at('tag')) / 0.3), align: 'center', pitch: 2 * u });
      const sw = spring(S.lt - S.at('swap'), 'firm'), host = B.host || '', upx = lerp(px * 0.13, px * 0.22, clamp(sw, 0, 1.2)), uk = clamp((S.lt - S.at('url')) / 0.3);
      if (host && uk > 0) {
        const uy = y + px * 0.5 + lerp(px * 0.36, px * 0.48, clamp(sw)), ucol = mix(S.P.dim.startsWith('rgba') ? grey : S.P.dim, S.P.fg, clamp(sw));
        const dot = host.indexOf('.'), a = dot > 0 ? host.slice(0, dot) : host, z = dot > 0 ? host.slice(dot + 1) : '';
        const wa = L.textW(c, S.look, a, { role: 'ui', px: upx, weight: 500 }), wz = L.textW(c, S.look, z, { role: 'ui', px: upx, weight: 500 }), gap = upx * 0.42, x0 = S.W / 2 - (wa + gap + wz) / 2;
        c.save(); c.globalAlpha *= uk;
        L.text(c, S.look, a, x0, uy, { role: 'ui', px: upx, weight: 500, color: ucol });
        if (z) { L.circle(c, x0 + wa + gap / 2, uy - upx * 0.08, upx * 0.11 * (1 + clamp(sw) * 0.3), sw > 0.05 ? S.look.accent : ucol); L.text(c, S.look, z, x0 + wa + gap, uy, { role: 'ui', px: upx, weight: 500, color: ucol }); }
        c.restore();
      }
    },
  });

  /* ═════════ TYPE TREATMENTS ═════════ */
  const charCount = b => toks(b).reduce((a, t) => a + t.s.length, 0);
  const wordStarts = lay => { let n = 0; return lay.words.map(w => { const s = n; n += w.s.length; return s; }); };

  /* glyph dither swap: letter by letter, each glyph dithers in through blocks while ghost blocks flicker ahead */
  L.def('effect:type-glyph-dither-swap', {
    kind: 'type',
    plan(b, F, t0 = 0) { const n = charCount(b), gap = Math.min(0.022, 0.55 / Math.max(1, n)); const a = toks(b).findIndex(t => t.accent); let cc = 0; const ws = toks(b).map(t => { const s = t0 + cc * gap; cc += t.s.length; return +s.toFixed(3); }); return { words: ws, done: t0 + n * gap + 0.26, events: [{ at: t0, event: 'word' }, ...(a >= 0 ? [{ at: ws[a] + 0.1, event: 'key-word' }] : [])] }; },
    draw(S, o) {
      const lay = o.lay, c = S.ctx, t0 = o.t0 || 0, n = lay.words.reduce((a, w) => a + w.s.length, 0), gap = Math.min(0.022, 0.55 / Math.max(1, n)), st = wordStarts(lay);
      if (S.lt < t0) return;
      const all = S.lt > t0 + n * gap + 0.26;
      for (const w of lay.words) {
        if (all) { L.drawWord(c, S.look, S.P, w, {}); continue; }
        L.setFont(c, S.look, w.role, w.px, w.tk.weight); try { c.letterSpacing = w.tr.toFixed(2) + 'px'; } catch (e) { /* */ }
        const cell = Math.max(4 * S.u, w.px / 13), top = w.y - w.px * 0.95, hh = w.px * 1.25, ghosts = [];
        c.save(); c.beginPath();
        let x0 = w.x, any = false;
        for (let ci = 0; ci < w.s.length; ci++) {
          const x1 = w.x + c.measureText(w.s.slice(0, ci + 1)).width, p = clamp((S.lt - t0 - (st[w.i] + ci) * gap) / 0.25), gi = st[w.i] + ci;
          if (p >= 1) { c.rect(x0 - 1, top, x1 - x0 + 2, hh); any = true; }
          else if (p > 0) {
            const nx = Math.ceil((x1 - x0) / cell), ny = Math.ceil(hh / cell);
            for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const v = cn(i, j, gi * 7 + 1); if (v < p) { c.rect(x0 + i * cell, top + j * cell, cell + 0.5, cell + 0.5); any = true; } else if (v < p + 0.12) ghosts.push(x0 + i * cell + cell * ((gi + j) % 2 ? 1 : -1), top + j * cell); }
          }
          x0 = x1;
        }
        if (any) { c.clip(); L.drawWord(c, S.look, S.P, w, {}); }
        c.restore();
        if (ghosts.length) { c.save(); c.fillStyle = w.tk.accent ? S.P.accent : S.P.fg; c.globalAlpha *= 0.55; for (let i = 0; i < ghosts.length; i += 2) c.fillRect(ghosts[i], ghosts[i + 1], cell, cell); c.restore(); }
      }
    },
  });

  /* dot print: each word lays down as a sparse halftone that thickens left to right into solid ink, glyph by glyph */
  L.def('effect:type-dot-print', {
    kind: 'type',
    plan(b, F, t0 = 0) { const tk = toks(b); let cc = 0; const ws = tk.map(t => { const s = t0 + cc * 0.03; cc += t.s.length; return +s.toFixed(3); }); const a = tk.findIndex(t => t.accent); return { words: ws, done: t0 + Math.min(1.2, cc * 0.03) + 0.3, events: [{ at: t0, event: 'cascade' }, ...(a >= 0 ? [{ at: ws[a] + 0.2, event: 'key-word' }] : [])] }; },
    draw(S, o) {
      const lay = o.lay, t0 = o.t0 || 0, st = wordStarts(lay), n = lay.words.reduce((a, w) => a + w.s.length, 0), rate = Math.min(0.03, 1.2 / Math.max(1, n));
      for (const w of lay.words) {
        const k = clamp((S.lt - t0 - st[w.i] * rate) / (0.14 + w.s.length * rate)); if (k <= 0) continue;
        dotText(S, w.s, w.x, w.y, { role: w.role, px: w.px, weight: w.tk.weight, tracking: w.tr / w.px, color: w.tk.accent ? S.P.accent : S.P.fg, k, pitch: Math.max(2.5 * S.u, w.px / 22), dot: 0.4 });
      }
    },
  });

  /* ink settle: the line lands in mid grey (a quick blur rise), holds, then steps to full ink in two frames like e-ink */
  L.def('effect:type-ink-settle', {
    kind: 'type',
    plan(b, F, t0 = 0) { const n = toks(b).length, last = t0 + Math.max(0, n - 1) * 0.05; return { words: toks(b).map((_, i) => +(t0 + i * 0.05).toFixed(3)), done: last + 0.85, events: [{ at: t0, event: 'word' }, { at: last + 0.75, event: 'key-word' }] }; },
    draw(S, o) {
      const lay = o.lay, c = S.ctx, t0 = o.t0 || 0, n = lay.words.length, settle = t0 + Math.max(0, n - 1) * 0.05 + 0.75, st = S.lt - settle, set = st < 0 ? 0 : st < 0.05 ? 0.5 : 1;
      for (const w of lay.words) {
        const k = E.out(prog(S.lt, t0 + w.i * 0.05, 0.35)); if (k <= 0) continue;
        const fill = w.tk.accent ? S.P.accent : S.P.fg, grey = mix(S.P.bg, fill, 0.5);
        c.save(); c.globalAlpha *= clamp(k * 2); if (k < 0.97) c.filter = `blur(${((1 - k) * 8 * S.u).toFixed(2)}px)`;
        L.drawWord(c, S.look, S.P, w, { y: w.y + (1 - k) * 14 * S.u, fill: mix(grey, fill, set) });
        c.restore();
      }
    },
  });

  /* screen-door snap: the line arrives as e-ink dots (a dissolve L→R), sits as dots on a faint lattice, then snaps
     to crisp type on the beat */
  L.def('effect:type-screen-door-snap', {
    kind: 'type',
    plan(b, F, t0 = 0) { return { words: toks(b).map(() => t0), done: t0 + 0.8, events: [{ at: t0, event: 'build' }, { at: t0 + 0.75, event: 'key-word' }] }; },
    draw(S, o) {
      const lay = o.lay, c = S.ctx, t0 = o.t0 || 0, t = S.lt - t0; if (t < 0) return;
      if (t >= 0.78) { for (const w of lay.words) L.drawWord(c, S.look, S.P, w, {}); return; }
      const pitch = Math.max(3 * S.u, lay.px / 20), r = pitch * 0.4, x0 = Math.min(...lay.words.map(w => w.x)), x1 = Math.max(...lay.words.map(w => w.x + w.w)), front = clamp(t / 0.3) * 1.3;
      // the unlit lattice under the line
      c.save(); c.fillStyle = rgba(S.P.fg, 0.03 * clamp(t / 0.2) * (1 - clamp((t - 0.6) / 0.18)));
      for (let y = lay.top; y < lay.bottom; y += pitch) for (let x = x0 - pitch * 4; x < x1 + pitch * 4; x += pitch) c.fillRect(x - r * 0.7, y - r * 0.7, r * 1.4, r * 1.4);
      c.restore();
      for (const w of lay.words) {
        const D = glyphDots(S.look, w.role, w.px, w.tk.weight, w.s, pitch, w.tr / w.px), p = D.p;
        c.fillStyle = w.tk.accent ? S.P.accent : S.P.fg;
        for (let i = 0; i < p.length; i += 4) { const fx = (w.x + p[i] - x0) / Math.max(1, x1 - x0); if (fx * 0.7 + p[i + 3] * 0.3 < front) c.fillRect(w.x + p[i] - r, w.y + p[i + 1] - r, r * 2, r * 2); }
      }
    },
  });

  /* ═════════ TRANSITIONS ═════════ */
  const before = (o, k) => { const span = (o.pre || 0) + (o.post || 0) || 1; return clamp(k * span / Math.max(1e-6, o.pre || 1e-6)); };
  const after = (o, k) => { const span = (o.pre || 0) + (o.post || 0) || 1; return clamp((k * span - (o.pre || 0)) / Math.max(1e-6, o.post || 1e-6)); };

  /* dither dissolve sweep: the old shot drops out cell by cell, a noisy front biased left to right */
  L.def('transition:dither-dissolve-sweep', {
    kind: 'transition', plan() { return { pre: 0.12, post: 0.2, events: [{ at: -0.1, event: 'scene' }] }; },
    tr(S, A, B, k) { const cell = 8 * S.u; cells(S, B, A, cell, (i, j) => (i * cell) / S.W * 0.62 + cn(i, j, 21) * 0.38 > k * 1.02); },
  });

  /* dither wipe world flip: a wide band of square cells sweeps across; inside it cells flicker between the two worlds,
     a few drawn as hollow squares */
  L.def('transition:dither-wipe-flip', {
    kind: 'transition', plan() { return { pre: 0.14, post: 0.2, events: [{ at: -0.04, event: 'slide-out' }, { at: 0, event: 'hard-hit' }] }; },
    tr(S, A, B, k) {
      const c = S.ctx, cell = 11 * S.u, band = S.W * 0.24, front = lerp(-band * 0.6, S.W + band * 1.1, k);
      const val = (i, j) => (i * cell - front) / band + (cn(i, j, 31) - 0.5) * 0.6;
      cells(S, B, A, cell, (i, j) => { const v = val(i, j); return v > 0.5 || (v > -0.5 && bayer(i, j) < v + 0.5); });
      c.save(); c.strokeStyle = rgba(L.lum(S.P.bg) > 0.4 ? S.P.fg : S.P.bg, 0.55); c.lineWidth = Math.max(1, S.u); c.beginPath();
      const i0 = Math.max(0, Math.floor((front - band * 0.8) / cell)), i1 = Math.min(Math.ceil(S.W / cell), Math.ceil((front + band * 0.8) / cell));
      for (let j = 0; j < Math.ceil(S.H / cell); j++) for (let i = i0; i < i1; i++) { const v = val(i, j); if (Math.abs(v) < 0.5 && cn(i, j, 33) < 0.1) c.rect(i * cell + 1.5, j * cell + 1.5, cell - 3, cell - 3); }
      c.stroke(); c.restore();
    },
  });

  /* dither ring iris: from A's last point a thick ring of ink cells expands past the frame; inside it, B already */
  L.def('transition:dither-ring-iris', {
    kind: 'transition', plan() { return { pre: 0.08, post: 0.34, events: [{ at: -0.06, event: 'accent' }, { at: 0.02, event: 'scene' }] }; },
    tr(S, A, B, k, o) {
      const c = S.ctx, cell = 10 * S.u, fx = ((o.from && o.from.x) != null ? o.from.x : 0.5) * S.W, fy = ((o.from && o.from.y) != null ? o.from.y : 0.5) * S.H;
      const far = Math.max(Math.hypot(fx, fy), Math.hypot(S.W - fx, fy), Math.hypot(fx, S.H - fy), Math.hypot(S.W - fx, S.H - fy)) + 140 * S.u;
      const w = 120 * S.u, R = lerp(0, far, E.in(k));
      const dist = (i, j) => Math.hypot(i * cell + cell / 2 - fx, j * cell + cell / 2 - fy);
      cells(S, A, B, cell, (i, j) => dist(i, j) < R - w * 0.5 - cn(i, j, 51) * w * 0.5);
      const ink = S.look.palette.ink, grey = mix(ink, S.look.palette.paper, 0.55);
      c.save();
      for (const [col, lim] of [[grey, 0.85], [ink, 0.55]]) {
        c.fillStyle = col; c.beginPath();
        runs(c, 0, 0, S.W, S.H, cell, (i, j) => { const d = dist(i, j) - (R - w / 2); if (Math.abs(d) > w / 2) return false; const tri = 1 - Math.abs(d) / (w / 2); return cn(i, j, 53) < tri * lim; });
        c.fill();
      }
      c.restore();
    },
  });

  /* screen-door resolve: the new shot first appears as a coarse e-ink dot screen, steps to a finer one, then snaps crisp */
  L.def('transition:screen-door-resolve', {
    kind: 'transition', plan() { return { pre: 0.02, post: 0.42, events: [{ at: 0, event: 'build' }, { at: 0.3, event: 'key-word' }] }; },
    tr(S, A, B, k, o) {
      const c = S.ctx; if (S.t < o.cut) { c.drawImage(A, 0, 0); return; }
      const a = after(o, k); if (a >= 0.72) { c.drawImage(B, 0, 0); return; }
      const p = Math.max(3, Math.round((a < 0.35 ? 12 : 6) * S.u)); dotScreen(S, B, p, mix(S.P.bg, '#000000', 0.32), a > 0.33 && a < 0.37);
    },
  });

  /* row-registered match: the frame hands over in horizontal strips, top to bottom, each strip printing left to right,
     so list rows and lines stay registered across the change */
  L.def('transition:row-registered-match', {
    kind: 'transition', plan() { return { pre: 0.16, post: 0.26, events: [{ at: -0.12, event: 'riffle' }, { at: 0, event: 'scene' }] }; },
    tr(S, A, B, k) {
      const cell = 9 * S.u, strip = 8, ns = Math.ceil(S.H / (cell * strip));
      cells(S, B, A, cell, (i, j) => { const s = Math.floor(j / strip), loc = clamp((k - s / ns * 0.5) / 0.5); return (i * cell) / S.W + (cn(i, j, 61) - 0.5) * 0.12 > loc * 1.14; });
      const c = S.ctx; c.save(); c.fillStyle = rgba(S.P.fg, 0.12);
      for (let s = 0; s < ns; s++) { const loc = clamp((k - s / ns * 0.5) / 0.5); if (loc > 0 && loc < 1) c.fillRect(0, s * strip * cell, S.W * loc, Math.max(1, S.u)); }
      c.restore();
    },
  });

  /* e-ink refresh cut: the old shot darkens through a dither to solid ink, holds a beat-fraction, then a ragged band
     uncovers the new shot from the top, a faint ghost of the old one fading under it */
  L.def('transition:eink-refresh-cut', {
    kind: 'transition', plan() { return { pre: 0.1, post: 0.34, events: [{ at: -0.08, event: 'click-ui' }, { at: 0.1, event: 'pop' }] }; },
    tr(S, A, B, k, o) {
      const c = S.ctx, ink = S.look.palette.ink, cell = 9 * S.u;
      if (S.t < o.cut) { const g = before(o, k); cells(S, A, ink, cell, (i, j) => bayer(i, j) < g * 1.05); return; }
      const a = after(o, k), t = a * (o.post || 0.34);
      if (t < 0.1) { c.fillStyle = ink; c.fillRect(0, 0, S.W, S.H); return; }
      const kk = clamp((t - 0.1) / 0.2), band = S.H * 0.14, front = lerp(-band, S.H + band, E.io(kk));
      c.drawImage(B, 0, 0); c.save(); c.globalAlpha = 0.08 * (1 - a); c.drawImage(A, 0, 0); c.restore();
      if (kk < 1) { c.fillStyle = ink; c.beginPath(); runs(c, 0, 0, S.W, S.H, cell, (i, j) => j * cell + cn(i, j, 71) * band > front); c.fill(); }
    },
  });

  /* page to reader morph: the old shot shrinks into a page that grows a bezel and a spine (an e-reader), an e-ink scan
     crosses its screen, the new shot fills the screen and the device opens out past the frame */
  L.def('transition:page-to-reader-morph', {
    kind: 'transition', plan() { return { pre: 0.34, post: 0.4, events: [{ at: -0.3, event: 'scene' }, { at: -0.08, event: 'build' }, { at: 0.05, event: 'card-in' }] }; },
    tr(S, A, B, k, o) {
      const c = S.ctx, u = S.u, pre = S.t < o.cut, g = pre ? E.io(before(o, k)) : 1 - E.io(after(o, k)), s = lerp(1, 0.58, g), K = S.look.palette;
      c.fillStyle = (pre ? (S.PA || S.P) : S.P).bg; c.fillRect(0, 0, S.W, S.H);
      const sw = S.W * s, sh = S.H * s, sx = (S.W - sw) / 2 + S.W * 0.015 * g, sy = (S.H - sh) / 2, bez = S.H * 0.04 * g, spine = S.W * 0.028 * g;
      const bx = sx - bez - spine, by = sy - bez, bw = sw + bez * 2 + spine, bh = sh + bez * 2;
      L.card(c, bx, by, bw, bh, 18 * u * g, { fill: mix('#FFFFFF', mix(K.paper, K.ink, 0.06), g), u, lift: 0.8 * g });
      if (spine > 0.5) { c.save(); L.rr(c, bx, by, bw, bh, 18 * u * g); c.clip(); c.fillStyle = mix(K.ink, K.paper, 0.12); c.fillRect(bx, by, spine, bh); c.restore(); }
      c.drawImage(pre ? A : B, sx, sy, sw, sh);
      if (pre) { const sc = clamp((before(o, k) - 0.55) / 0.45); if (sc > 0) { const cell = 7 * u, band = sw * 0.25, front = lerp(-band, sw + band, sc); c.save(); c.beginPath(); runs(c, sx, sy, sw, sh, cell, (i, j) => i * cell < front && (i * cell < front - band || bayer(i, j) < (front - i * cell) / band)); c.fillStyle = rgba(mix(K.paper, K.ink, 0.12), 0.45); c.fill(); c.restore(); } }
    },
  });

  /* ═════════ CAMERAS ═════════ */
  // powers of ten: a long log-space pull back (default 6x → 1x) with a cubic in-out, then a 1% creep (never still)
  L.def('camera:powers-of-ten-pull', {
    kind: 'camera',
    cam(lt, d, o, S) { const from = (o && o.from) || 6, dur = Math.min(d * 0.7, (o && o.dur) || 1.4), k = E.io(clamp(lt / Math.max(0.1, dur))), s = logLerp(from, 1, k) * (1 + clamp((lt - dur) / Math.max(0.1, d - dur)) * 0.012); const fx = ((o && o.fx) != null ? o.fx : 0.5) - 0.5, fy = ((o && o.fy) != null ? o.fy : 0.5) - 0.5, W = S ? S.W : 1920, H = S ? S.H : 1080; return { s, x: -fx * W * (s - 1), y: -fy * H * (s - 1), r: 0 }; },
  });
  // plate creep: a 1% push with a sub-pixel shimmer, for specimen holds (a held plate that still breathes)
  L.def('camera:plate-creep', {
    kind: 'camera',
    cam(lt, d, o, S) { const k = clamp(lt / Math.max(0.1, d)), u = (S && S.u) || 1; return { s: 1 + k * 0.012, x: noise(lt * 0.6, 11) * 1.6 * u, y: noise(lt * 0.5, 13) * 1.2 * u - k * 3 * u, r: 0 }; },
  });

  /* ═════════ UI ═════════ */
  L.def('ui:dot-lattice-icon', {
    kind: 'ui',
    draw(S, o) {
      const size = o.size || 110 * S.u, name = o.icon || L.iconFor(o.label || 'mail'), k = clamp((S.lt - (o.t0 || 0)) / 0.35);
      if (k <= 0) return;
      if (o.items && o.items.length > 1 && !o.icon) { const n = Math.min(4, o.items.length), gap = Math.min(S.W * 0.84 / n, size * 1.5); o.items.slice(0, n).forEach((it, i) => { const kk = clamp((S.lt - (o.t0 || 0) - i * 0.1) / 0.35), x = o.x + (i - (n - 1) / 2) * gap; dotIcon(S, L.iconFor(it, i), x, o.y + Math.sin(S.lt * 1.4 + i) * 4 * S.u, size * 0.8, o.color || S.P.fg, kk, Math.max(3 * S.u, size / 34)); subline(S, { x, y: o.y + size * 0.75, text: it, align: 'center', t0: (o.t0 || 0) + 0.3 + i * 0.1, maxW: gap * 0.9 }); }); return; }
      const bob = Math.sin(S.lt * 1.4) * 4 * S.u;
      dotIcon(S, name, o.x, o.y + bob, size, o.color || S.P.fg, k, Math.max(3 * S.u, size / 34));
      if (o.label && o.caption !== false) subline(S, { x: o.x, y: o.y + size * 0.8, text: o.label, align: 'center', t0: (o.t0 || 0) + 0.3 });
    },
  });
  L.def('ui:colophon-field', {
    kind: 'ui',
    draw(S, o) {
      const c = S.ctx, u = S.u, w = o.w || S.W * 0.4, x = o.x - w / 2, y = o.y - 40 * u, t0 = o.t0 || 0, k = E.out(prog(S.lt, t0, 0.5));
      if (k <= 0) return;
      const val = typeof o.value === 'string' ? o.value : (brand().host || brand().name), px = Math.min(110 * u, w / Math.max(5, val.length * 0.46));
      c.save(); c.globalAlpha *= k;
      L.text(c, S.look, (typeof o.label === 'string' ? o.label : 'Send to').toUpperCase(), x, y - px * 0.4, { role: 'micro', px: 19 * u, color: S.P.dim, tracking: 0.25 });
      const n = Math.floor(clamp((S.lt - t0 - 0.2) / 0.03 / Math.max(1, val.length)) * val.length), shown = val.slice(0, n);
      const tw = L.text(c, S.look, shown, x, y + px * 1.25, { role: 'accent', px, weight: 400, color: S.P.fg });
      if (n < val.length || Math.floor(S.lt * 2.2) % 2) { c.fillStyle = S.P.fg; c.fillRect(x + tw + 4 * u, y + px * 0.3, Math.max(2, 2 * u), px * 1.05); }
      c.fillStyle = S.P.rule; c.fillRect(x, y + px * 1.65, w * k, Math.max(1, u));
      L.text(c, S.look, (o.next || 'Delivery').toUpperCase(), x, y + px * 1.65 + 52 * u, { role: 'micro', px: 19 * u, color: S.P.dim, tracking: 0.25 });
      c.restore();
    },
  });
  L.def('ui:ruled-source-list', {
    kind: 'ui',
    draw(S, o) {
      const c = S.ctx, u = S.u, rows = (o.rows && o.rows.length ? o.rows : (o.items || []).map(s => ({ name: s }))).slice(0, 6), w = o.w || S.W * 0.4;
      const pitch = Math.min(130 * u, (o.h ? o.h * 2.2 : S.H * 0.7) / Math.max(1, rows.length)), tpx = Math.min(w / 16, pitch * 0.42), x = o.x - w / 2, y0 = o.y - (rows.length * pitch) / 2, t0 = o.t0 || 0;
      rows.forEach((r, k) => {
        const tk = t0 + (k < 2 ? k * 0.31 : 0.62 + (k - 2) * 0.16), kk = clamp((S.lt - tk) / 0.35); if (kk <= 0) return;
        const y = y0 + k * pitch + pitch * 0.45;
        dotIcon(S, L.iconFor(r.name, k), x + tpx * 0.6, y - tpx * 0.3, tpx * 1.1, S.P.fg, kk);
        dotText(S, r.name, x + tpx * 1.8, y, { role: 'display', px: tpx, weight: 400, color: S.P.fg, k: kk, pitch: Math.max(2.4 * u, tpx / 16) });
        if (kk > 0.6) L.text(c, S.look, sourceOf(r, k).toUpperCase(), x + tpx * 1.8, y + tpx * 0.75, { role: 'micro', px: Math.max(13 * u, tpx * 0.3), color: S.P.dim, tracking: 0.16, maxW: w - 60 * u });
        c.fillStyle = S.P.rule; c.fillRect(x, y + pitch * 0.5, w * E.out(kk), Math.max(1, u));
      });
    },
  });
  L.def('ui:magazine-contents-sheet', {
    kind: 'ui',
    draw(S, o) {
      const u = S.u, h = Math.min(S.H * 0.84, o.sh || (o.w || S.W * 0.4) * 1.3), w = h * 0.74, sp = spring(S.lt - (o.t0 || 0), 'soft'); if (sp <= 0) return;
      const y = o.y + (1 - sp) * S.H * 0.2, entries = o.items || (o.rows || []).map(r => r.name);
      L.card(S.ctx, o.x - w / 2, y - h / 2, w, h, 3 * u, { fill: '#FFFFFF', u, lift: 0.5 + sp * 0.4 });
      paintContents(S, o.x - w / 2, y - h / 2, w, h, { entries, title: typeof o.title === 'string' ? o.title : undefined, k: clamp((S.lt - (o.t0 || 0) - 0.2) / 0.9) });
    },
  });
  L.def('ui:spine-e-reader', {
    kind: 'ui',
    draw(S, o) {
      const h = Math.min(S.H * 0.84, o.dh || (o.w || S.W * 0.4) * 1.25), sp = spring(S.lt - (o.t0 || 0), 'soft'); if (sp <= 0) return;
      const entries = o.items || (o.rows || []).map(r => r.name);
      slate(S, o.x, o.y + (1 - sp) * S.H * 0.25, h, { m: E.io(prog(S.lt, (o.t0 || 0) + 0.3, 0.3)), scan: prog(S.lt, (o.t0 || 0) + 0.6, 0.3), paint: r => paintContents(S, r.x, r.y, r.w, r.h, { entries, k: clamp((S.lt - (o.t0 || 0) - 0.3) / 0.9) }) });
    },
  });
  L.def('ui:pocket-e-reader', {
    kind: 'ui',
    draw(S, o) {
      const h = Math.min(S.H * 0.74, o.dh || (o.w || S.W * 0.4) * 1.0), k = E.expo(prog(S.lt, o.t0 || 0, 0.4)); if (k <= 0) return;
      const entries = o.items || (o.rows || []).map(r => r.name), x = lerp(S.W + h, o.x, k);
      pocket(S, x, o.y, h, { paint: r => refresh(S, r, (o.t0 || 0) + 0.55, null, rr2 => paintCover(S, rr2.x, rr2.y, rr2.w, rr2.h, { entries })) });
    },
  });
  L.def('ui:dither-print-banner', {
    kind: 'ui',
    draw(S, o) {
      const w = o.w || S.W * 0.4, h = Math.max(30 * S.u, w * 0.065), k = clamp((S.lt - (o.t0 || 0) - 0.4) / 0.2);
      if (o.screen !== false) { const sh = Math.min(S.H * 0.84, w * 1.25); slate(S, o.x, o.y, sh, { paint: r => { paintContents(S, r.x, r.y + h, r.w, r.h - h, { entries: o.items || [], k: 1 }); banner(S, r.x, r.y, r.w, Math.max(18 * S.u, r.h * 0.05), typeof o.label === 'string' ? `New issue  ·  ${o.label}` : 'New issue', k); } }); return; }
      banner(S, o.x - w / 2, o.y - h / 2, w, h, typeof o.label === 'string' ? `New issue  ·  ${o.label}` : 'New issue', k);
    },
  });
  L.def('ui:drop-cap-article', {
    kind: 'ui',
    draw(S, o) {
      const u = S.u, h = Math.min(S.H * 0.84, (o.w || S.W * 0.4) * 1.3), w = h * 0.74, t0 = o.t0 || 0, sp = spring(S.lt - t0, 'soft'); if (sp <= 0) return;
      const x = o.x - w / 2, y = o.y - h / 2 + (1 - sp) * S.H * 0.2, c = S.ctx, first = (o.rows && o.rows[0] && o.rows[0].name) || (o.items && o.items[0]) || o.label || brand().name;
      L.card(c, x, y, w, h, 3 * u, { fill: mix('#FFFFFF', eink(S), 0.6), u, lift: 0.6 });
      paintArticle(S, x, y, w, h, { title: first, source: brand().host });
      const t = S.lt - t0 - 0.3; if (t < 0.15) { const cell = Math.max(4, w / 40); c.beginPath(); runs(c, x, y, w, h, cell, (i, j) => (j * cell) / h + cn(i, j, 3) * 0.2 > clamp(t / 0.15) * 1.2); c.fillStyle = mix('#FFFFFF', eink(S), 0.6); c.fill(); }
    },
  });
  L.def('ui:fig-plate-caption', {
    kind: 'ui',
    draw(S, o) { figCaption(S, { x: o.x, y: o.y, n: o.n || 1, text: typeof o.text === 'string' ? o.text : (o.label || ''), t0: o.t0 || 0, px: o.px ? o.px / S.u : 54, maxW: Math.max(o.w || 0, S.W * 0.84) }); },
  });
  L.def('ui:numbered-eyebrow', {
    kind: 'ui',
    draw(S, o) { eyebrowNum(S, { x: o.x, y: o.y, n: o.n || 1, label: o.label || 'Collect', t0: o.t0 || 0, align: o.align || 'center', px: o.px ? o.px / S.u : 40 }); },
  });
  L.def('ui:middot-subline', {
    kind: 'ui',
    draw(S, o) { const t = (o.items && o.items.length ? o.items.slice(0, 4).join('  ·  ') : o.text || o.label || ''); subline(S, { x: o.x, y: o.y, text: t, align: o.align || 'center', t0: o.t0 || 0, px: o.px ? o.px / S.u : 32, maxW: Math.max(o.w || 0, S.W * 0.84) }); },
  });

  /* ═════════ OVERLAYS + TEXTURES ═════════ */
  // the whole frame through an e-ink dot screen (we are looking at the display's pixels); o.until resolves it
  L.def('effect:screen-door-dots', {
    kind: 'overlay',
    draw(S, o) { if (o && o.until != null && S.lt > o.until) return; if (!S.src) return; dotScreen(S, S.src, Math.max(3, Math.round(((o && o.pitch) || 5) * S.u)), mix(S.P.bg, '#000000', 0.3)); },
  });
  // printer's crop marks around the content (never a box), drawn on as the beat opens
  L.def('effect:crop-mark-frame', {
    kind: 'overlay',
    draw(S, o) { const r = (o && o.rect) || (isWide(S) ? [0.06, 0.09, 0.94, 0.91] : [0.07, 0.06, 0.93, 0.94]); cropMarks(S, r[0] * S.W, r[1] * S.H, r[2] * S.W, r[3] * S.H, E.out(prog(S.lt, 0.08, 0.4)), mix(S.P.bg, S.P.fg, 0.38)); },
  });
  // warm charcoal: the dark world with a soft centre lift (the ink half of the film)
  L.def('texture:charcoal-centre-lift', {
    kind: 'texture',
    draw(S) { const c = S.ctx, g = c.createRadialGradient(S.W * 0.5, S.H * 0.46, 0, S.W * 0.5, S.H * 0.5, Math.hypot(S.W, S.H) * 0.6); g.addColorStop(0, mix(S.P.bg, S.P.fg, 0.045)); g.addColorStop(0.6, S.P.bg); g.addColorStop(1, mix(S.P.bg, '#000000', 0.22)); c.fillStyle = g; c.fillRect(0, 0, S.W, S.H); },
  });
  // out-of-focus discs of a neighbouring grid (the microscope plate), drifting very slowly
  L.def('texture:bokeh-disc-field', {
    kind: 'texture',
    draw(S) { const bk = bokehField(S, Math.min(S.W, S.H) * 0.55, mix(S.P.bg, S.P.fg, 0.07)); S.ctx.drawImage(bk.cv, -bk.pad + noise(S.t * 0.2, 4) * 16 * S.u, -bk.pad + noise(S.t * 0.17, 8) * 12 * S.u); },
  });
  // a quiet field of flip-dot coins; a few turn over now and then (the screen thinking)
  L.def('texture:flip-dot-coins', {
    kind: 'texture',
    draw(S) {
      const c = S.ctx, p = Math.round(30 * S.u), col = mix(S.P.bg, S.P.fg, 0.06), r = p * 0.42;
      const tile = memo(`coin|${p}|${col}|${S.P.bg}`, () => { const cv = cnv(p, p), g = cv.getContext('2d'); g.fillStyle = col; g.beginPath(); g.arc(p / 2, p / 2, r, 0, Math.PI * 2); g.fill(); return cv; });
      c.save(); c.fillStyle = c.createPattern(tile, 'repeat'); c.translate(((S.W / 2) % p) - p / 2, ((S.H / 2) % p) - p / 2); c.fillRect(-p, -p, S.W + p * 2, S.H + p * 2); c.restore();
      const cols = Math.ceil(S.W / p) + 1, rows = Math.ceil(S.H / p) + 1, ox = ((S.W / 2) % p), oy = ((S.H / 2) % p), lit = ball(mix(S.P.bg, S.P.fg, 0.5));
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        if (cn(i, j, 91) > 0.03) continue;
        const per = 2 + cn(i, j, 92) * 3, ph = (S.t + cn(i, j, 93) * per) % per, on = Math.floor((S.t + cn(i, j, 93) * per) / per) % 2 === 1, pp = clamp(ph / 0.14), face = (pp >= 0.5) === on, xs = Math.max(0.08, Math.abs(Math.cos(Math.PI * (pp >= 1 ? 0 : pp))));
        const x = ox + i * p, y = oy + j * p; c.fillStyle = S.P.bg; c.fillRect(x - r - 1, y - r - 1, r * 2 + 2, r * 2 + 2);
        if (face) c.drawImage(lit, x - r * xs, y - r, r * 2 * xs, r * 2); else { c.fillStyle = col; c.beginPath(); c.ellipse(x, y, r * xs, r, 0, 0, Math.PI * 2); c.fill(); }
      }
    },
  });
})(globalThis.LAUNCH);
