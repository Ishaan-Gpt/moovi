// Launch pack l10: the keynote sting. Haze blue clearing to white pages, one deep sky world with white line art, a
// near-black glowing close. Nothing is ever still: every shot enters already moving on an exponential ease-out (a
// fixed share of the remaining distance per frame) and leaves accelerating, and its blur follows its speed and
// direction. Glass refracts what is really behind it (sampled in device space, so it stays right under any camera),
// titles are cut out of frosted glass and sliced by card edges, the one dead-still hold is saved for the brand.
// Every part re-skins from the palette (the sky, the cyan and the mint are derived from the brand's accent).
'use strict';
(function (L) {
  const { clamp, lerp, prog, E, rgba, mix, lum, spring, rand, hex, toHex } = L;
  const T = (b, F, t0) => { const p = L.get(b.type) || L.get('effect:type-mask-rise'); return p.plan(b, F, t0); };
  const isWide = S => S.W / S.H > 1.3, isTall = S => S.H / S.W > 1.3;
  const dk = S => lum(S.P.bg) < 0.35;
  const M = S => Math.min(S.W, S.H);
  const toks = b => (b.text && b.text.tokens) || [];
  const nWords = b => toks(b).length;
  const itemsOf = (b, fb) => { const it = ((b.data && b.data.items) || []).filter(Boolean); return it.length ? it : (fb || ['Plan', 'Make', 'Ship', 'Learn']); };
  const brand = () => (L.film && L.film.brand) || { name: 'Brand', host: 'brand.com', tagline: '' };
  const initials = () => { const n = (brand().name || 'B').replace(/[^A-Za-z0-9 ]/g, '').trim(); const p = n.split(/\s+/); return (p.length > 1 ? p[0][0] + p[1][0] : n.slice(0, 2)).toUpperCase() || 'B'; };
  const firstWord = s => String(s || '').split(/\s+/)[0].replace(/[.,!?;:]+$/, '');
  const scaleAbout = (c, x, y, sx, sy) => { c.translate(x, y); c.scale(sx, sy == null ? sx : sy); c.translate(-x, -y); };
  const headPx = (S, b, base = 120) => { const n = nWords(b); return S.u * base * (n <= 2 ? 1.2 : n <= 4 ? 1 : n <= 7 ? 0.82 : 0.68) * (isTall(S) ? 0.92 : 1); };
  const withP = (S, P) => Object.assign({}, S, { P });
  const Pl = S => L.palette(S.look, 'paper'), Ps = S => L.palette(S.look, 'deep'), Pn = S => L.palette(S.look, 'ink');

  /* ───────── the motion grammar: enter moving, leave accelerating ───────── */
  // share of the way still to go after an exponential entry that covers (1 - dec) of the remaining distance per 30 fps frame
  const rest = (t, t0, dec = 0.86) => (t < t0 ? 1 : Math.pow(dec, (t - t0) * 30));
  // its speed (fraction of the distance per 30 fps frame), for blur from velocity
  const restV = (t, t0, dec = 0.86) => (t < t0 ? 0 : rest(t, t0, dec) * (1 - dec));
  // an accelerating exit 0..1 (quadratic: it is still gaining speed on the last frame)
  const leave = (t, t0, dur) => { const k = clamp((t - t0) / dur); return k * k; };
  const blurOf = (pxPerFrame, cap = 16) => Math.min(cap, Math.abs(pxPerFrame) * 0.25);

  /* ───────── colour: every tone is the palette or the accent turned on the colour wheel ───────── */
  function toHsl(c) { const [r, g, b] = hex(c).map(v => v / 255); const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; let h = 0, s = 0; if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; } return [h, s, l]; }
  function fromHsl(h, s, l) { const f = (p, q, t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; }; if (!s) return toHex([l * 255, l * 255, l * 255]); const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q; return toHex([f(p, q, h + 1 / 3) * 255, f(p, q, h) * 255, f(p, q, h - 1 / 3) * 255]); }
  const turn = (c, deg, sMul = 1, lAdd = 0) => { const [h, s, l] = toHsl(c); return fromHsl((h + deg / 360 + 1) % 1, clamp(s * sMul), clamp(l + lAdd)); };
  const acc = S => S.look.accent;
  const ink = S => S.look.palette.ink, paper = S => S.look.palette.paper;
  const navy = S => turn(mix(ink(S), acc(S), 0.42), 0, 0.62);
  const skyTop = S => turn(mix(ink(S), acc(S), 0.52), 0, 0.6);
  const skyBot = S => turn(mix(acc(S), paper(S), 0.46), 0, 0.42);
  const cyan = S => turn(acc(S), -32, 0.95, 0.08);
  const mint = S => turn(acc(S), -78, 0.7, 0.06);
  const haze = S => turn(mix(paper(S), acc(S), 0.26), 0, 0.55);
  const floorC = S => turn(mix(paper(S), acc(S), 0.16), 0, 0.8);
  const nightCore = S => mix(ink(S), '#FFFFFF', 0.14);
  const ICE = S => mix(paper(S), cyan(S), 0.32);

  /* ───────── device-space layers: smears, frost, frame blur ───────── */
  const ID = c => c.setTransform(1, 0, 0, 1, 0, 0);
  // draw fn into an offscreen copy of the frame (same transform), to smear or blur it as one object
  function layer(S, name, fn) {
    const c = S.ctx, W = c.canvas.width, H = c.canvas.height, B = L.buffer('l10-' + name, W, H);
    if (!B) { fn(S); return null; }
    const b = B.getContext('2d'); ID(b); b.globalAlpha = 1; b.filter = 'none'; b.globalCompositeOperation = 'source-over'; b.clearRect(0, 0, W, H);
    b.setTransform(c.getTransform()); fn(Object.assign({}, S, { ctx: b })); return B;
  }
  // composite a layer: n copies spread along (dx, dy) device px (directional motion blur), plus an optional blur
  function blit(S, B, o = {}) {
    if (!B) return; const c = S.ctx, n = Math.max(1, o.n || 1); c.save(); ID(c); c.globalAlpha *= o.a == null ? 1 : o.a;
    if (o.blur > 0.3) c.filter = `blur(${o.blur.toFixed(1)}px)`;
    const base = c.globalAlpha;
    for (let i = 0; i < n; i++) { const f = n === 1 ? 0 : i / (n - 1) - 0.5; c.globalAlpha = base / (i + 1) * (i ? 1 : 1); c.drawImage(B, (o.dx || 0) * f, (o.dy || 0) * f); }
    c.restore();
  }
  // the whole frame softens (copy of itself, blurred): exits and backdrops
  function frameBlur(S, px, a = 1) { if (px < 0.3 || typeof document === 'undefined') return; const c = S.ctx, W = c.canvas.width, H = c.canvas.height, B = L.buffer('l10-fb', W, H); if (!B) return; const b = B.getContext('2d'); ID(b); b.filter = 'none'; b.clearRect(0, 0, W, H); b.drawImage(c.canvas, 0, 0); c.save(); ID(c); c.globalAlpha = a; c.filter = `blur(${px.toFixed(1)}px)`; c.drawImage(B, 0, 0); c.restore(); }
  // a rounded rect as a sub-path (no beginPath), for even-odd clips
  function rrSub(c, x, y, w, h, r) { r = Math.max(0, Math.min(r, w / 2, h / 2)); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  // a shadow stack drawn only outside a rounded rect (so a translucent panel still casts a real shadow)
  function shadowOut(S, x, y, w, h, r, o = {}) {
    const c = S.ctx; c.save(); c.beginPath(); c.rect(x - w, y - h, w * 3, h * 3); rrSub(c, x, y, w, h, r); c.clip('evenodd');
    L.rr(c, x, y, w, h, r); c.fillStyle = '#000'; c.shadowColor = o.color || rgba(ink(S), 0.2); c.shadowBlur = (o.blur || 40) * S.u; c.shadowOffsetY = (o.y || 16) * S.u; c.fill();
    c.shadowColor = o.color2 || rgba(ink(S), 0.1); c.shadowBlur = 5 * S.u; c.shadowOffsetY = 2 * S.u; c.fill(); c.restore();
  }
  // frosted glass: blurs and lightens what is really behind it, magnified a touch about its centre (refraction),
  // a top sheen, a light rim top-left, a faint chromatic split; correct in device space under any camera
  function frost(S, x, y, w, h, r, o = {}) {
    const c = S.ctx, u = S.u, dark = !!o.dark;
    if (o.shadow !== false) shadowOut(S, x, y, w, h, r, { color: rgba(ink(S), dark ? 0.38 : 0.16), blur: o.sBlur || 36, y: o.sY || 14 });
    c.save(); L.rr(c, x, y, w, h, r); c.clip();
    if (S.src && typeof document !== 'undefined') {
      const m = c.getTransform(), sc = Math.hypot(m.a, m.b) || 1, bl = (o.blur == null ? 14 : o.blur) * u * sc, mag = o.mag || 1.06;
      const cx = m.a * (x + w / 2) + m.c * (y + h / 2) + m.e, cy = m.b * (x + w / 2) + m.d * (y + h / 2) + m.f, hw = w * sc / 2 + bl * 2, hh = h * sc / 2 + bl * 2;
      ID(c); c.filter = `blur(${bl.toFixed(1)}px) saturate(${o.sat || 1.35}) brightness(${dark ? 0.92 : 1.05})`;
      const sx = cx - hw / mag, sy = cy - hh / mag;
      try { c.drawImage(S.src, sx, sy, hw * 2 / mag, hh * 2 / mag, cx - hw, cy - hh, hw * 2, hh * 2); } catch (e) { /* off canvas */ }
      c.filter = 'none'; c.setTransform(m);
    }
    c.fillStyle = o.tint || (dark ? 'rgba(14,16,24,0.32)' : 'rgba(255,255,255,0.24)'); c.fillRect(x, y, w, h);
    const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, rgba('#FFFFFF', dark ? 0.12 : 0.36)); g.addColorStop(0.4, rgba('#FFFFFF', 0)); g.addColorStop(1, rgba('#FFFFFF', dark ? 0.03 : 0.1));
    c.fillStyle = g; c.fillRect(x, y, w, h); c.restore();
    c.save(); L.rr(c, x + 0.75 * u, y + 0.75 * u, w - 1.5 * u, h - 1.5 * u, Math.max(0, r - 0.75 * u));
    const rim = c.createLinearGradient(x, y, x + w * 0.35, y + h); rim.addColorStop(0, rgba('#FFFFFF', dark ? 0.4 : 0.9)); rim.addColorStop(0.5, rgba('#FFFFFF', dark ? 0.08 : 0.3)); rim.addColorStop(1, rgba('#FFFFFF', dark ? 0.18 : 0.55));
    c.strokeStyle = rim; c.lineWidth = 1.5 * u; c.stroke();
    c.globalCompositeOperation = 'screen'; L.rr(c, x + 2 * u, y + 1 * u, w - 4 * u, h - 2 * u, r); c.strokeStyle = rgba(cyan(S), 0.16); c.lineWidth = 1 * u; c.stroke();
    c.restore();
  }
  // frosted type: glyphs cut from a blurred, lightened copy of what is behind them; glyphs(ctx) fills the shapes in
  // the current transform; o.box = {x0, y0, x1, y1} (local) for the sheen; o.clip(ctx) clips them (a card edge)
  function frostType(S, glyphs, o = {}) {
    const c = S.ctx; if (typeof document === 'undefined') return null;
    const W = c.canvas.width, H = c.canvas.height, B = L.buffer('l10-ft', W, H); if (!B) return null;
    const b = B.getContext('2d'), m = c.getTransform(), sc = Math.hypot(m.a, m.b) || 1;
    ID(b); b.globalCompositeOperation = 'source-over'; b.filter = 'none'; b.globalAlpha = 1; b.clearRect(0, 0, W, H);
    b.setTransform(m); b.save(); if (o.clip) o.clip(b); b.fillStyle = '#FFFFFF'; glyphs(b); b.restore();
    ID(b); b.globalCompositeOperation = 'source-in'; b.filter = `blur(${((o.blur || 12) * S.u * sc).toFixed(1)}px) saturate(1.4) brightness(${o.dark ? 1.25 : 1.12})`;
    b.drawImage(S.src, 0, 0); b.filter = 'none';
    b.globalCompositeOperation = 'source-atop'; b.fillStyle = rgba('#FFFFFF', o.lighten == null ? 0.32 : o.lighten); b.fillRect(0, 0, W, H);
    if (o.box) { b.setTransform(m); const g = b.createLinearGradient(0, o.box.y0, 0, o.box.y1); g.addColorStop(0, rgba('#FFFFFF', 0.4)); g.addColorStop(0.5, rgba('#FFFFFF', 0)); g.addColorStop(1, rgba(o.tint || acc(S), o.tintA == null ? 0.16 : o.tintA)); b.fillStyle = g; b.fillRect(o.box.x0 - 10, o.box.y0 - 10, o.box.x1 - o.box.x0 + 20, o.box.y1 - o.box.y0 + 20); ID(b); }
    b.globalCompositeOperation = 'source-over';
    const put = () => { c.save(); ID(c); c.globalAlpha *= o.fa == null ? 1 : o.fa; c.drawImage(B, 0, 0); c.restore(); };
    if (o.defer) return put; put(); return null;
  }
  // set a glyph run's font + tracking on a context (frost and rims draw raw glyphs)
  const runFont = (cx, S, px, weight, tr = -0.04, role = 'display') => { L.setFont(cx, S.look, role, px, weight); try { cx.letterSpacing = (tr * px).toFixed(2) + 'px'; } catch (e) { /* */ } cx.textBaseline = 'alphabetic'; };
  const runW = (S, s, px, weight, tr = -0.04) => L.textW(S.ctx, S.look, s, { role: 'display', px, weight, tracking: tr });
  // the glass word in one call: contact shadow, the frost, a 1 px rim
  function glassWord(S, s, x, y, px, o = {}) {
    const c = S.ctx, wt = o.weight || 700, w = runW(S, s, px, wt), x0 = o.align === 'center' ? x - w / 2 : x;
    const glyph = cx => { runFont(cx, S, px, wt); cx.textAlign = 'left'; cx.fillText(s, x0, y); };
    const put = frostType(S, cx => { cx.globalAlpha = o.a == null ? 1 : o.a; glyph(cx); }, { defer: true, clip: o.clip, box: { x0, y0: y - px * 0.78, x1: x0 + w, y1: y + px * 0.1 }, blur: o.blur, lighten: o.lighten, dark: o.dark, tint: o.tint, tintA: o.tintA, fa: o.solid ? 0.38 : 1 });
    c.save(); if (o.clip) o.clip(c); c.globalAlpha *= o.a == null ? 1 : o.a;
    if (o.shadow !== false) { c.save(); c.shadowColor = rgba(ink(S), o.dark ? 0.4 : 0.07); c.shadowBlur = 26 * S.u; c.shadowOffsetY = 14 * S.u; c.fillStyle = o.base || (o.dark ? rgba('#FFFFFF', 0.08) : mix(S.P.bg, ink(S), 0.04)); glyph(c); c.shadowColor = rgba(ink(S), o.dark ? 0.3 : 0.16); c.shadowBlur = 4 * S.u; c.shadowOffsetY = 2 * S.u; glyph(c); c.restore(); }
    if (o.solid) { c.save(); const g = c.createLinearGradient(0, y - px * 0.78, 0, y + px * 0.1); g.addColorStop(0, mix(S.P.bg, acc(S), 0.2)); g.addColorStop(0.55, mix(S.P.bg, acc(S), 0.42)); g.addColorStop(1, mix(S.P.bg, acc(S), 0.74)); c.fillStyle = g; glyph(c); c.restore(); }
    c.restore();
    if (put) put();
    c.save(); if (o.clip) o.clip(c); c.globalAlpha *= (o.a == null ? 1 : o.a);
    runFont(c, S, px, wt); c.textAlign = 'left'; const g = c.createLinearGradient(0, y - px * 0.78, 0, y + px * 0.1); g.addColorStop(0, rgba('#FFFFFF', 0.95)); g.addColorStop(0.55, rgba('#FFFFFF', 0.25)); g.addColorStop(1, rgba('#FFFFFF', 0.6));
    c.lineWidth = Math.max(1, 1.3 * S.u); c.strokeStyle = g; c.strokeText(s, x0, y);
    if (!o.dark) { c.lineWidth = Math.max(0.8, 0.9 * S.u); c.strokeStyle = rgba(ink(S), o.solid ? 0.16 : 0.08); c.strokeText(s, x0, y + 0.8 * S.u); }
    try { c.letterSpacing = '0px'; } catch (e) { /* */ }
    c.restore();
    return w;
  }

  /* ───────── shared drawings ───────── */
  function sparkle(c, x, y, s, col) { c.save(); c.beginPath(); c.moveTo(x, y - s); c.quadraticCurveTo(x, y, x + s, y); c.quadraticCurveTo(x, y, x, y + s); c.quadraticCurveTo(x, y, x - s, y); c.quadraticCurveTo(x, y, x, y - s); c.fillStyle = col; c.shadowColor = col; c.shadowBlur = s * 1.4; c.fill(); c.restore(); }
  // the deep-sky wallpaper: a diagonal navy → sky gradient, a cyan glow in one corner, white line art (two big
  // circles, a cross of rules, a twinkling four-point sparkle where they meet); the art drifts a few px
  function skyArt(S, x, y, w, h, o = {}) {
    if (![x, y, w, h].every(Number.isFinite) || w <= 0 || h <= 0) return;
    const c = S.ctx, u = S.u, seed = o.seed || 0, t = S.t || 0, R = Math.max(w, h);
    const g = c.createLinearGradient(x, y, x + w * 0.55, y + h); g.addColorStop(0, o.top || skyTop(S)); g.addColorStop(1, o.bot || skyBot(S)); c.fillStyle = g; c.fillRect(x, y, w, h);
    const gx = x + w * (seed % 2 ? 0.1 : 0.94), gy = y + h * 0.06, gg = c.createRadialGradient(gx, gy, 0, gx, gy, R * 0.62);
    gg.addColorStop(0, rgba(o.glow || cyan(S), 0.5)); gg.addColorStop(0.5, rgba(o.glow || cyan(S), 0.14)); gg.addColorStop(1, rgba(o.glow || cyan(S), 0)); c.fillStyle = gg; c.fillRect(x, y, w, h);
    const gm = c.createRadialGradient(x + w * 0.15, y + h, 0, x + w * 0.15, y + h, R * 0.5); gm.addColorStop(0, rgba(mint(S), 0.16)); gm.addColorStop(1, rgba(mint(S), 0)); c.fillStyle = gm; c.fillRect(x, y, w, h);
    const LC = o.line || '#FFFFFF', LK = o.lineK || 1;
    const dr = Math.sin(t * 0.5 + seed) * 6 * u, lw = Math.max(1, 1.2 * u * (o.lw || 1));
    c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip(); c.lineWidth = lw;
    const cx = x + w * (0.12 + 0.3 * rand(seed + 1)) + dr, cy = y + h * (0.78 + 0.25 * rand(seed + 2));
    c.strokeStyle = rgba(LC, 0.34 * LK); c.beginPath(); c.arc(cx, cy, R * 0.62, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = rgba(LC, 0.16 * LK); c.beginPath(); c.arc(cx, cy, R * 0.38, 0, Math.PI * 2); c.stroke();
    const vx = x + w * (0.52 + 0.24 * rand(seed + 3)) - dr * 0.5, hy = y + h * (0.6 + 0.16 * rand(seed + 4));
    c.strokeStyle = rgba(LC, 0.26 * LK); c.beginPath(); c.moveTo(vx, y); c.lineTo(vx, y + h); c.stroke();
    c.strokeStyle = rgba(LC, 0.2 * LK); c.beginPath(); c.moveTo(x, hy); c.lineTo(x + w, hy); c.stroke();
    c.strokeStyle = rgba(LC, 0.1 * LK); c.beginPath(); c.moveTo(x, hy + h * 0.2); c.lineTo(x + w, hy + h * 0.2); c.stroke();
    sparkle(c, vx, hy, Math.max(5 * u, R * 0.022) * (1 + Math.sin(t * 3 + seed) * 0.15), rgba(LC, 0.95 * LK));
    if (o.small !== false) sparkle(c, x + w * 0.3, y + h * 0.3, Math.max(3 * u, R * 0.009), rgba(LC, 0.7 * LK));
    c.restore();
  }
  // the brand mark: the real logo when there is one, else the initials inside four corner brackets
  function markGlyph(S, x, y, s, col) {
    const c = S.ctx, logo = L.img('logo');
    if (logo) { const k = Math.min(s / logo.width, s / logo.height); c.drawImage(logo, x - logo.width * k / 2, y - logo.height * k / 2, logo.width * k, logo.height * k); return; }
    const h = s / 2, l = s * 0.24; c.save(); c.strokeStyle = col; c.lineWidth = Math.max(1.2, s * 0.06); c.lineCap = 'round';
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => { c.beginPath(); c.moveTo(x + sx * h, y + sy * (h - l)); c.lineTo(x + sx * h, y + sy * h); c.lineTo(x + sx * (h - l), y + sy * h); c.stroke(); });
    c.restore();
    const ini = initials(); L.text(c, S.look, ini, x, y + s * 0.15, { role: 'display', px: s * (ini.length > 1 ? 0.42 : 0.52), weight: 650, color: col, align: 'center', tracking: -0.02 });
  }
  // the white disc that carries the mark: hairline rim, a whisper of shadow
  function disc(S, x, y, r, o = {}) {
    const c = S.ctx; c.save();
    c.shadowColor = rgba(ink(S), 0.1); c.shadowBlur = 22 * S.u; c.shadowOffsetY = 6 * S.u; L.circle(c, x, y, r, o.fill || mix(paper(S), '#FFFFFF', 0.6)); c.restore();
    L.circle(c, x, y, r - 0.5, null, mix(paper(S), ink(S), 0.09), Math.max(1, S.u));
    const g = c.createLinearGradient(0, y - r, 0, y + r); g.addColorStop(0, rgba('#FFFFFF', 0.7)); g.addColorStop(1, rgba(ink(S), 0.03)); L.circle(c, x, y, r * 0.98, g);
    markGlyph(S, x, y, r * 0.95, o.mark || mix(navy(S), ink(S), 0.25));
  }
  // the ring of icy light under something about to be clicked
  function iceRing(S, x, y, r, k) {
    if (k <= 0) return; const c = S.ctx, ro = r * 1.62, g = c.createRadialGradient(x, y, r * 0.98, x, y, ro);
    g.addColorStop(0, rgba(ICE(S), 0)); g.addColorStop(0.08, rgba(ICE(S), 0.95 * k)); g.addColorStop(0.32, rgba(mix(ICE(S), '#FFFFFF', 0.5), 0.6 * k)); g.addColorStop(1, rgba(ICE(S), 0));
    c.save(); c.fillStyle = g; c.beginPath(); c.arc(x, y, ro, 0, Math.PI * 2); c.fill(); c.restore();
    L.circle(c, x, y, r * (1.05 + 0.02 * Math.sin((S.t || 0) * 5)), null, rgba(cyan(S), 0.45 * k), 1.5 * S.u);
  }
  // the macOS arrow that turns to its heading, grows on hover, shrinks when it presses
  function cursorHead(S, x, y, o = {}) {
    const c = S.ctx; c.save(); c.translate(x, y); c.rotate(o.rot || 0); c.globalAlpha *= o.a == null ? 1 : o.a;
    L.drawCursor(c, 0, 0, { u: S.u, scale: (o.scale || 1) * 1.35, press: o.press || 0, dark: o.dark, blur: o.blur || 0 });
    c.restore();
  }
  // a velocity-aware path follower: [[t, x, y]] in px, smooth (io) between keys
  const pathAt = (keys, t) => { if (t <= keys[0][0]) return { x: keys[0][1], y: keys[0][2] }; for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) { const a = keys[i - 1], b = keys[i], k = E.io(prog(t, a[0], b[0] - a[0])); return { x: lerp(a[1], b[1], k), y: lerp(a[2], b[2], k) }; } const z = keys[keys.length - 1]; return { x: z[1], y: z[2] }; };
  // an ink round-ended arrow button (the card's call to action)
  function arrowBtn(S, x, y, s) { const c = S.ctx; L.rr(c, x - s / 2, y - s / 2, s, s, s * 0.24); c.fillStyle = ink(S); c.fill(); L.icon(c, 'arrowUp', x, y, s * 0.62, '#FFFFFF', 2.4); }
  // a frosted pill chip (a tag on imagery) and a frosted round menu button
  function glassChip(S, s, x, y, h, o = {}) {
    const c = S.ctx, px = h * 0.46, w = L.textW(c, S.look, s, { role: 'ui', px, weight: 600 }) + h * 0.9;
    frost(S, x, y, w, h, h / 2, { dark: o.dark, blur: 8, shadow: false, tint: o.dark ? 'rgba(14,16,24,0.18)' : 'rgba(255,255,255,0.28)' });
    L.text(c, S.look, s, x + h * 0.45, y + h * 0.66, { role: 'ui', px, weight: 600, color: '#FFFFFF' }); return w;
  }
  function glassMenu(S, x, y, d) { frost(S, x - d / 2, y - d / 2, d, d, d / 2, { blur: 8, shadow: false, tint: 'rgba(255,255,255,0.26)' }); for (let i = -1; i <= 1; i++) L.circle(S.ctx, x + i * d * 0.2, y, d * 0.065, '#FFFFFF'); }

  /* ════════════════════════ UI widgets ════════════════════════ */

  /* disc lockup: the white disc holding the mark, the name in a calm sans, a small dark capsule tag; name and tag
     sharpen from blur a beat apart while sliding a few px */
  function lockup(S, x, y, o = {}) {
    const c = S.ctx, B = brand(), px = o.px || 54 * S.u, r = px * 0.98, t0 = o.t0 || 0, P = o.P || S.P;
    disc(S, x + r, y, r);
    const nx = x + r * 2 + px * 0.42, nk = E.out(prog(S.lt, t0 + 0.067, 0.22)), nb = (1 - nk) * 9 * S.u;
    c.save(); c.globalAlpha *= clamp(nk * 2); if (nb > 0.3) c.filter = `blur(${nb.toFixed(1)}px)`;
    const nw = L.text(c, S.look, B.name, nx + (1 - nk) * 15 * S.u, y + px * 0.36, { role: 'display', px, weight: 560, color: P.fg, tracking: -0.025 }); c.restore();
    const tag = o.tag; let tw = 0;
    if (tag) {
      const tk = E.out(prog(S.lt, t0 + 0.134, 0.22)), th = px * 0.54, tpx = th * 0.5; tw = L.textW(c, S.look, tag, { role: 'ui', px: tpx, weight: 600 }) + th * 0.9;
      const tx = nx + nw + px * 0.3 + (1 - tk) * 15 * S.u, ty = y + px * 0.36 - th * 0.82;
      c.save(); c.globalAlpha *= clamp(tk * 2); if (tk < 0.97) c.filter = `blur(${((1 - tk) * 7 * S.u).toFixed(1)}px)`;
      L.pill(c, tx, ty, tw, th, mix(ink(S), paper(S), 0.16)); L.text(c, S.look, tag, tx + th * 0.45, ty + th * 0.68, { role: 'ui', px: tpx, weight: 600, color: '#FFFFFF' }); c.restore();
    }
    return { discX: x + r, discY: y, r, w: r * 2 + px * 0.42 + nw + (tag ? px * 0.3 + tw : 0), nameX: nx };
  }
  L.def('ui:disc-capsule-lockup', {
    kind: 'ui',
    draw(S, o) { const px = (o.px || 104 * S.u), B = brand(); const w0 = px * 2.4 + runW(S, B.name, px, 560) + px * 3.2; const k = rest(S.lt, o.t0 || 0), x = o.x - w0 / 2; return lockup(S, x, o.y + k * 120 * S.u, { px, t0: o.t0, tag: o.tag || B.host }); },
  });

  /* hub window: a big light app window that gathers around a header and runs off the frame: a search pill with a
     shortcut chip, a faint icon column, a content card peeking in, a blue floor glow lifting it from below */
  function hubWindow(S, x, y, w, h, o = {}) {
    const c = S.ctx, m = M(S), r = 0.086 * m, a = o.a == null ? 1 : o.a; if (a <= 0) return;
    c.save(); c.globalAlpha *= a;
    L.card(c, x, y, w, h, r, { fill: mix(paper(S), '#FFFFFF', 0.7), u: S.u, shadow: rgba(navy(S), 0.12), shadow2: rgba(navy(S), 0.06), stroke: mix(paper(S), ink(S), 0.07) });
    c.save(); L.rr(c, x, y, w, h, r); c.clip();
    const band = c.createLinearGradient(0, y, 0, y + h * 0.4); band.addColorStop(0, mix(paper(S), acc(S), 0.07)); band.addColorStop(1, rgba(paper(S), 0)); c.fillStyle = band; c.fillRect(x, y, w, h * 0.4);
    const fg = c.createLinearGradient(0, y + h, 0, y + h * 0.45); fg.addColorStop(0, rgba(floorC(S), 0.95)); fg.addColorStop(1, rgba(floorC(S), 0)); c.fillStyle = fg; c.fillRect(x, y + h * 0.45, w, h * 0.55);
    const visW = Math.min(w, S.W - x), pw = Math.min(0.42 * visW, 0.4 * m), ph = 0.04 * m, px0 = x + visW * 0.5 - pw / 2 + (o.pillDx || 0), py0 = y + 0.035 * m;
    L.pill(c, px0, py0, pw, ph, mix(paper(S), ink(S), 0.035), mix(paper(S), ink(S), 0.06));
    L.icon(c, 'search', px0 + ph * 0.55, py0 + ph / 2, ph * 0.46, mix(paper(S), ink(S), 0.4), 2);
    L.text(c, S.look, 'Search ' + brand().name, px0 + ph * 1.0, py0 + ph * 0.66, { role: 'ui', px: ph * 0.4, color: mix(paper(S), ink(S), 0.42), maxW: pw - ph * 2.4 });
    L.pill(c, px0 + pw - ph * 1.3, py0 + ph * 0.2, ph * 1.05, ph * 0.6, mix(paper(S), ink(S), 0.08)); L.text(c, S.look, '⌘K', px0 + pw - ph * 0.78, py0 + ph * 0.64, { role: 'ui', px: ph * 0.3, color: mix(paper(S), ink(S), 0.5), align: 'center' });
    if (o.col) { const ic = ['home', 'layers', 'message', 'file']; ic.forEach((n, i) => { const yy = o.col.y + i * 0.11 * m; if (yy < y + h) L.icon(c, n, o.col.x, yy, 0.032 * m, mix(paper(S), ink(S), 0.3), 2); }); }
    c.restore(); c.restore();
  }
  L.def('ui:hub-window-floor-glow', {
    kind: 'ui',
    draw(S, o) { const w = Math.min(S.W * 0.9, (o.w || 0.5 * S.W) * 1.6), h = Math.min(S.H * 0.82, w * 0.56), a = E.out(prog(S.lt, o.t0 || 0, 0.35)), dy = rest(S.lt, o.t0 || 0, 0.84) * 60 * S.u;
      hubWindow(S, o.x - w / 2, o.y - h / 2 + dy, w, h, { a, col: { x: o.x - w / 2 + 0.07 * M(S), y: o.y - h / 2 + 0.17 * M(S) + dy } });
      if (a > 0) { const cw = w * 0.5, ch = h * 0.58; coverCard(S, o.x + w / 2 - cw - 0.04 * M(S), o.y - h / 2 + h * 0.3 + dy, cw, ch, { title: o.label || itemsOf(S.b)[0], chip: '01', seed: 3, a }); }
    },
  });

  /* cover card: a deep-sky line-art cover, a frosted tag chip, a frosted round menu, a white caption block with a
     short title and an ink arrow button; optionally a giant frosted word set along its bottom edge, cut by it */
  function coverCard(S, x, y, w, h, o = {}) {
    const c = S.ctx, m = Math.min(w, h), r = o.r || Math.min(w, h) * 0.12, a = o.a == null ? 1 : o.a; if (a <= 0) return;
    c.save(); c.globalAlpha *= a;
    shadowOut(S, x, y, w, h, r, { color: rgba(navy(S), 0.28), blur: 50, y: 22 });
    c.save(); L.rr(c, x, y, w, h, r); c.clip(); skyArt(S, x, y, w, h, { seed: o.seed || 0, lw: 0.9 }); c.restore();
    const ch = Math.max(16 * S.u, m * 0.1), pad = m * 0.07;
    if (o.chip) glassChip(S, o.chip, x + pad, y + pad, ch);
    glassMenu(S, x + w - pad - ch / 2, y + pad + ch / 2, ch);
    if (o.title) {
      const bw = w * (o.bw || 0.66), bh = h * (o.bh || 0.3), bx = x + pad, by = y + h * (o.by || 0.3), br = m * 0.035;
      L.text(c, S.look, (o.eyebrow || brand().name).toUpperCase(), bx + 2 * S.u, by - ch * 0.35, { role: 'micro', px: ch * 0.36, color: rgba('#FFFFFF', 0.7), tracking: 0.12, maxW: bw });
      L.card(c, bx, by, bw, bh, br, { fill: '#FFFFFF', u: S.u, lift: 0.5, shadow: rgba(navy(S), 0.2) });
      const lay = L.layout(c, S.look, String(o.title).split(/\s+/).map(s => ({ s })), { role: 'display', px: bh * 0.24, maxW: bw * 0.78, x: bx + bh * 0.16, y: by + bh * 0.13, align: 'left', maxLines: 2, lineH: 1.08 });
      for (const wd of lay.words) L.drawWord(c, S.look, Pl(S), wd, { color: ink(S) });
      arrowBtn(S, bx + bw - bh * 0.22, by + bh - bh * 0.22, bh * 0.2);
    }
    if (o.word) {
      const clip = cx => { L.rr(cx, x, y, w, h, r); cx.clip(); };
      let px = h * 0.42; const wd = runW(S, o.word, px, 750); if (wd > w * 0.9) px *= w * 0.9 / wd;
      const k = o.wordK == null ? 1 : o.wordK;
      glassWord(S, o.word, x + pad * 0.7, y + h + px * 0.2 + (1 - k) * px * 0.9, px, { weight: 750, clip, shadow: false, lighten: 0.3, blur: 10, a: clamp(k * 1.5), tint: cyan(S), tintA: 0.1, dark: false });
    }
    if (o.meta) L.text(c, S.look, o.meta, x + pad, y + h - pad * 0.7, { role: 'micro', px: ch * 0.36, color: rgba('#FFFFFF', 0.62), tracking: 0.1, upper: true });
    c.save(); L.rr(c, x + 0.5, y + 0.5, w - 1, h - 1, r); c.strokeStyle = rgba('#FFFFFF', 0.22); c.lineWidth = 1 * S.u; c.stroke(); c.restore();
    c.restore();
  }
  L.def('ui:sky-cover-caption-card', {
    kind: 'ui',
    draw(S, o) { const w = Math.min(o.w || 600 * S.u, S.W * 0.5), h = w * 0.66, k = rest(S.lt, o.t0 || 0, 0.84), s = 1 + 0.08 * k;
      const c = S.ctx; c.save(); scaleAbout(c, o.x, o.y, s); c.globalAlpha *= clamp((1 - k) * 3); if (k > 0.05) c.filter = `blur(${(12 * k * S.u).toFixed(1)}px)`;
      coverCard(S, o.x - w / 2, o.y - h / 2 - S.lt * 6 * S.u, w, h, { title: o.label || 'Ship in a day', chip: '01', seed: 1, word: firstWord(o.label || 'Launch') }); c.restore(); },
  });

  /* menu bar: a laptop's black bezel over a deep-sky wallpaper, a dark translucent bar with the brand's name and
     menus on the left and real status items on the right (wifi, battery, controls, the brand's mark, three dots in
     the accent family, the time); the mark highlights when pressed. Returns the mark's rect. */
  function laptop(S, x0, x1, barY, o = {}) {
    const c = S.ctx, m = M(S), bz = 0.024 * m, rr = 0.06 * m, barH = 0.052 * m, top = barY - bz, bottom = S.H * 2;
    c.save(); c.shadowColor = rgba(ink(S), 0.28); c.shadowBlur = 50 * S.u; c.shadowOffsetY = -6 * S.u; L.rr(c, x0 - bz, top, x1 - x0 + bz * 2, bottom - top, rr + bz); c.fillStyle = mix(ink(S), '#000000', 0.4); c.fill(); c.restore();
    c.save(); L.rr(c, x0 - bz + 1, top + 1, x1 - x0 + bz * 2 - 2, bottom - top, rr + bz); c.strokeStyle = rgba('#FFFFFF', 0.16); c.lineWidth = 1.2 * S.u; c.stroke(); c.restore();
    c.save(); L.rr(c, x0, barY, x1 - x0, bottom - barY, rr); c.clip();
    skyArt(S, x0, barY, x1 - x0, Math.max(S.H - barY, m * 0.6), { seed: 5 });
    if (o.inside) o.inside(barY + barH);
    c.fillStyle = rgba(navy(S), 0.72); c.fillRect(x0, barY, x1 - x0, barH);
    const ty = barY + barH * 0.66, ipx = barH * 0.42, ic = rgba('#FFFFFF', 0.95);
    let lx = x0 + rr * 0.9; L.icon(c, 'sparkle', lx, barY + barH / 2, ipx, ic, 2); lx += ipx * 1.4;
    lx += L.text(c, S.look, brand().name, lx, ty, { role: 'ui', px: ipx, weight: 700, color: ic }) + ipx;
    ['File', 'Edit', 'View', 'Window'].forEach(s => { lx += L.text(c, S.look, s, lx, ty, { role: 'ui', px: ipx, weight: 500, color: rgba('#FFFFFF', 0.82) }) + ipx * 1.1; });
    const right = Math.min(x1 - rr * 0.6, S.W - 0.04 * m);
    let rx = right - L.textW(c, S.look, 'Tue 9:41', { role: 'ui', px: ipx, weight: 500 });
    L.text(c, S.look, 'Tue 9:41', rx, ty, { role: 'ui', px: ipx, weight: 500, color: ic }); rx -= ipx * 1.3;
    const dots = [acc(S), cyan(S), mint(S)]; for (let i = 2; i >= 0; i--) { L.circle(c, rx - ipx * 0.4, barY + barH / 2, ipx * 0.42, dots[i]); rx -= ipx * 1.15; }
    const ms = ipx * 1.35, mx = rx - ms * 0.5 - ipx * 0.3, my = barY + barH / 2, pressed = o.press || 0;
    if (pressed > 0) { L.rr(c, mx - ms * 0.72, my - ms * 0.62, ms * 1.44, ms * 1.24, ms * 0.3); c.fillStyle = rgba('#FFFFFF', 0.28 * pressed); c.fill(); }
    L.rr(c, mx - ms / 2, my - ms / 2, ms, ms, ms * 0.24); c.strokeStyle = ic; c.lineWidth = 1.4 * S.u; c.stroke();
    L.text(c, S.look, initials().slice(0, 2), mx, my + ms * 0.17, { role: 'ui', px: ms * 0.44, weight: 700, color: ic, align: 'center' });
    rx = mx - ms * 0.5 - ipx * 1.2;
    ['sliders', 'battery', 'wifi'].forEach(n => { L.icon(c, n, rx - ipx * 0.5, my, ipx * 1.1, ic, 2); rx -= ipx * 1.9; });
    c.restore();
    return { mark: { x: mx, y: my, w: ms, h: ms }, barH };
  }
  L.def('ui:menubar-status-strip', {
    kind: 'ui',
    draw(S, o) { const w = Math.max(o.w || S.W * 0.5, S.W * 0.62), k = rest(S.lt, o.t0 || 0, 0.84), y = o.y - 0.1 * M(S) + k * 0.2 * S.H;
      const c = S.ctx; c.save(); if (k > 0.04) c.filter = `blur(${(k * 6 * S.u).toFixed(1)}px)`; c.beginPath(); c.rect(0, 0, S.W, o.y + 0.28 * M(S)); c.clip(); laptop(S, o.x - w / 2, o.x + w / 2, y, { press: L.pressAt([S.at('click')], S.lt).p }); c.restore(); },
  });

  /* frosted prompt popover: a glass box springs out of a menu-bar mark with a touch of overshoot and types a request
     (about a character a frame, a held beat every few), the caret always on, a mic, a clip and an image tool, the
     accent send button */
  function popover(S, ax, ay, w, h, o = {}) {
    const c = S.ctx, t0 = o.t0 || 0, sp = spring(S.lt - t0, [15, 210, 1]); if (sp <= 0.001) return null;
    const ww = lerp(o.from || 0.05 * M(S), w, sp), hh = lerp((o.from || 0.05 * M(S)) * 0.8, h, clamp(spring(S.lt - t0 - 0.03, [17, 220, 1])));
    const x = clamp(ax - ww / 2, 0.03 * S.W, S.W * 0.97 - ww), y = ay, r = Math.min(hh / 2, 0.055 * M(S));
    c.save(); c.globalAlpha *= clamp(sp * 3);
    frost(S, x, y, ww, hh, r, { blur: 16, tint: rgba(navy(S), 0.34), mag: 1.08, sBlur: 50, sY: 20 });
    const txt = o.text || 'Make it happen', cps = o.cps || 34, n = Math.max(0, Math.min(txt.length, Math.floor((S.lt - (o.typeAt || t0 + 0.2)) * cps - Math.floor((S.lt - (o.typeAt || t0)) * 11) * 0.6)));
    const px = hh * 0.17, tx = x + hh * 0.2, ty = y + hh * 0.32;
    if (sp > 0.6) {
      const shown = txt.slice(0, n), lay = L.layout(c, S.look, (shown || ' ').split(/\s+/).map(s => ({ s })), { role: 'ui', px, maxW: ww - hh * 0.4, x: tx, y: ty - px * 0.8, align: 'left', maxLines: 2, lineH: 1.25, min: px });
      if (shown) for (const wd of lay.words) L.drawWord(c, S.look, S.P, wd, { color: '#FFFFFF' });
      const last = lay.words[lay.words.length - 1], cx = shown && last ? last.x + last.w + px * 0.12 : tx, cy = shown && last ? last.y : ty;
      c.fillStyle = rgba('#FFFFFF', 0.95); c.fillRect(cx, cy - px * 0.82, Math.max(1.5, px * 0.07), px * 1.02);
      const iy = y + hh * 0.76, is = hh * 0.13; ['mic', 'link', 'image'].forEach((nm, i) => L.icon(c, nm, x + hh * 0.26 + i * is * 2.1, iy, is, rgba('#FFFFFF', 0.72), 2));
      const sx = x + ww - hh * 0.24, sr = hh * 0.11, pr = o.send ? L.pressAt([o.send], S.lt).p : 0;
      c.save(); c.shadowColor = rgba(acc(S), 0.6); c.shadowBlur = 16 * S.u; L.circle(c, sx, iy, sr * (1 - 0.12 * pr), acc(S)); c.restore(); L.icon(c, 'arrowUp', sx, iy, sr * 1.1, L.onColor(acc(S)), 2.4);
    }
    c.restore();
    return { x, y, w: ww, h: hh, n, done: n >= txt.length };
  }
  L.def('ui:frosted-prompt-popover', {
    kind: 'ui',
    draw(S, o) { const c = S.ctx, w = Math.min(o.w || 700 * S.u, S.W * 0.62), h = w * 0.31, bx = o.x - w * 0.62, by = o.y - h * 0.9;
      c.save(); L.rr(c, bx, by, w * 1.24, h * 1.9, 0.05 * M(S)); c.clip(); skyArt(S, bx, by, w * 1.24, h * 1.9, { seed: 2 }); c.restore();
      popover(S, o.x, o.y - h / 2, w, h, { t0: o.t0 || 0, text: o.text || S.b.data.prompt, typeAt: (o.t0 || 0) + 0.25 }); },
  });

  /* app icon with orbiting squares: a deep navy icon shrinks onto a pale halo while four rounded squares (white,
     the accent, a cyan and a mint turned from it) spin in counter-clockwise, slowing, and lock into a cross; each
     carries a feature's icon. o.collapse (0..1) slides them into a row and blurs everything out. */
  function orbit(S, x, y, size, o = {}) {
    const c = S.ctx, t0 = o.t0 || 0, lt = S.lt - t0, lockAt = o.lock || 0.48;
    const icoK = E.out(prog(lt, 0, lockAt)), icon = size * lerp(1.55, 1, icoK) * (1 + Math.sin(S.lt * 1.6) * 0.006);
    const col = clamp(o.collapse || 0), blurPx = lerp(0.3, 6, col * col) * S.u;
    const halo = size * lerp(1.36, 1.83, icoK) * (1 - col * 0.6);
    c.save(); if (col > 0.02) c.filter = `blur(${blurPx.toFixed(1)}px)`;
    L.circle(c, x, y, halo / 2, mix(paper(S), ink(S), 0.06)); L.circle(c, x, y, halo / 2, null, rgba('#FFFFFF', 0.8), 1.5 * S.u);
    const items = o.items || itemsOf(S.b), cols = [mix(paper(S), '#FFFFFF', 0.6), acc(S), cyan(S), mint(S)];
    const spin = (1 - E.out(prog(lt, 0, lockAt))) * (240 * Math.PI / 180), R = size * 1.21 * lerp(1.1, 1, icoK), sq = size * 0.52;
    const breathe = lt > lockAt ? Math.sin((lt - lockAt) * 1.4) * 0.02 : 0;
    for (let i = 0; i < 4; i++) {
      const a0 = -Math.PI / 2 + i * Math.PI / 2 + spin + breathe, ap = clamp(prog(lt, 0.02 * i, 0.22));
      let sx = x + Math.cos(a0) * R, sy = y + Math.sin(a0) * R; const rowX = x + (i - 1.5) * sq * 1.15 + size * 0.0, rowY = y;
      sx = lerp(sx, rowX, E.in(col)); sy = lerp(sy, rowY, E.in(col));
      const s = sq * lerp(0.6, 1, E.out(ap)) * (1 - col * 0.55);
      c.save(); c.globalAlpha *= ap; c.shadowColor = rgba(i ? cols[i] : ink(S), i ? 0.35 : 0.12); c.shadowBlur = 24 * S.u; c.shadowOffsetY = 8 * S.u;
      L.rr(c, sx - s / 2, sy - s / 2, s, s, s * 0.28); c.fillStyle = cols[i]; c.fill(); c.restore();
      const g = c.createLinearGradient(0, sy - s / 2, 0, sy + s / 2); g.addColorStop(0, rgba('#FFFFFF', 0.28)); g.addColorStop(1, rgba('#FFFFFF', 0)); L.rr(c, sx - s / 2, sy - s / 2, s, s, s * 0.28); c.fillStyle = g; c.fill();
      if (!i) { c.strokeStyle = mix(paper(S), ink(S), 0.1); c.lineWidth = 1 * S.u; c.stroke(); }
      if (ap > 0.5) L.icon(c, L.iconFor(items[i % items.length] || 'x', i), sx, sy, s * 0.46, i ? '#FFFFFF' : navy(S), 2.2);
    }
    const ic = icon * (1 - col * 0.78), ix = x - ic / 2, iy = y - ic / 2;
    c.save(); c.shadowColor = rgba(navy(S), 0.45); c.shadowBlur = 40 * S.u; c.shadowOffsetY = 16 * S.u; L.rr(c, ix, iy, ic, ic, ic * 0.27);
    const ig = c.createLinearGradient(0, iy, 0, iy + ic); ig.addColorStop(0, mix(navy(S), skyTop(S), 0.5)); ig.addColorStop(1, navy(S)); c.fillStyle = ig; c.fill(); c.restore();
    L.rr(c, ix + 1, iy + 1, ic - 2, ic - 2, ic * 0.27); c.strokeStyle = rgba('#FFFFFF', 0.16); c.lineWidth = 1.2 * S.u; c.stroke();
    markGlyph(S, x, y, ic * 0.5, '#FFFFFF');
    c.restore();
  }
  L.def('ui:app-icon-orbit-squares', { kind: 'ui', draw(S, o) { orbit(S, o.x, o.y, (o.size || 220 * S.u) * 0.9, { t0: o.t0 || 0 }); } });

  /* the cursor that turns to its heading: glides in, slows, turns to point where it is going, dives, grows by half on
     hover and shrinks as it presses (an ice ring blooms under the target) */
  L.def('ui:cursor-heading-dive', {
    kind: 'ui',
    draw(S, o) {
      const t0 = o.t0 || 0, x = o.x, y = o.y, m = M(S), click = t0 + 1.3;
      const keys = [[t0, x + 0.4 * m, y - 0.2 * m], [t0 + 0.55, x + 0.28 * m, y - 0.21 * m], [t0 + 0.95, x + 0.06 * m, y + 0.03 * m], [click, x + 0.02 * m, y + 0.005 * m]];
      iceRing(S, x, y, 0.07 * m, E.out(prog(S.lt, click - 0.4, 0.2)));
      disc(S, x, y, 0.07 * m * (1 - 0.04 * L.pressAt([click], S.lt).p));
      drawDiveCursor(S, keys, click, t0);
    },
  });
  function drawDiveCursor(S, keys, click, t0) {
    const p = pathAt(keys, S.lt), v = L.vel(t => pathAt(keys, t).x, S.lt) + L.vel(t => pathAt(keys, t).y, S.lt);
    const rot = -0.61 * E.io(prog(S.lt, keys[1][0] + 0.02, 0.16)) * (1 - E.io(prog(S.lt, click + 0.1, 0.3)));
    const hov = 1 + 0.55 * clamp(spring(S.lt - (click - 0.42), 'firm')), pr = L.pressAt([click], S.lt).p;
    cursorHead(S, p.x, p.y, { rot, scale: hov * (1 - 0.15 * pr), a: E.out(prog(S.lt, t0 - 0.1, 0.25)), blur: Math.min(4, Math.abs(v) * 0.15) });
  }

  /* ════════════════════════ set-ups ════════════════════════ */

  /* 1. the header rises out of haze: blue haze clears to a white page while the product's header (disc, name,
     capsule tag) rises hard from low in the frame and drifts on, a big app window gathers around it, the line lands,
     the cursor glides in, turns, dives onto the disc; push in, hold a frame, release while it clicks */
  L.def('insert:haze-header-rise', {
    kind: 'setup',
    plan(b, F) {
      const d = b.d || 4, head = 0.6, tp = T(b, F, head), click = Math.max(tp.done + 1.2, Math.min(d - 0.3, 3.2));
      return { cues: { lock: 0, win: 0.47, head, headDone: tp.done, cursor: click - 1.45, push: click - 0.8, click }, events: [{ at: 0.1, event: 'card-in' }, { at: 0.47, event: 'ui-reveal' }, ...tp.events, { at: click - 0.8, event: 'build' }, { at: click, event: 'click-ui' }], exit: { kind: 'circle', x: 0.22, y: 0.3, r: 0.05 }, entry: { kind: 'rect', x: 0.5, y: 0.5, w: 1, h: 1 }, min: tp.done + 1.6 };
    },
    draw(S) {
      const c = S.ctx, b = S.b, m = M(S), wide = isWide(S), tall = isTall(S), P = Pl(S), lt = S.lt;
      // the haze clears to the page
      const hk = E.out(prog(lt, 0, 0.93)), bg = c.createLinearGradient(0, 0, 0, S.H);
      bg.addColorStop(0, mix(haze(S), paper(S), hk * 0.92)); bg.addColorStop(1, mix(mix(haze(S), floorC(S), 0.4), paper(S), hk * 0.7)); c.fillStyle = bg; c.fillRect(-S.W, -S.H, S.W * 3, S.H * 3);
      const L0 = wide ? { wx: 0.1, wy: 0.15, lx: 0.155, ly: 0.29, hy: 0.4, hw: 0.5, cx: 0.64, cy: 0.5, cw: 0.36 } : tall ? { wx: 0.06, wy: 0.17, lx: 0.11, ly: 0.245, hy: 0.31, hw: 0.8, cx: 0.32, cy: 0.62, cw: 0.78 } : { wx: 0.07, wy: 0.13, lx: 0.12, ly: 0.245, hy: 0.33, hw: 0.72, cx: 0.5, cy: 0.62, cw: 0.56 };
      const drift = -lt * 14 * S.u, rise = rest(lt, 0, 0.86), lyy = L0.ly * S.H + rise * (0.86 - 0.5) * S.H + drift;
      const discR = 0.062 * m, click = S.at('click'), dpx = discR / 0.98;
      // push in, hold one frame, release accelerating into the click
      const zs = lt < S.at('push') ? 1 : L.kf(lt, [[S.at('push'), 1], [click - 0.34, 1.2, E.io], [click - 0.317, 1.2], [click + 0.05, 1.04, E.in]]);
      const fx = L0.lx * S.W + discR, fy = L0.ly * S.H + drift;
      c.save(); scaleAbout(c, lerp(S.W / 2, fx, 0.85), lerp(S.H / 2, fy, 0.85), zs);
      if (zs > 1.001) { /* blur from the zoom's speed */ const v = Math.abs(L.vel(t => (t < S.at('push') ? 1 : L.kf(t, [[S.at('push'), 1], [click - 0.34, 1.2, E.io], [click - 0.317, 1.2], [click + 0.05, 1.04, E.in]])), lt)); if (v > 0.004) c.filter = `blur(${Math.min(5, v * 260 * S.u).toFixed(1)}px)`; }
      const wa = L.kf(lt, [[0.467, 0], [0.5, 0.53], [0.634, 0.7], [0.8, 1]]), wx = L0.wx * S.W, wy = L0.wy * S.H + drift + rest(lt, 0.47, 0.88) * 40 * S.u;
      hubWindow(S, wx, wy, S.W * 1.2, S.H * 1.3, { a: wa, col: { x: L0.lx * S.W + discR, y: L0.ly * S.H + 0.2 * m + drift + 0.1 * m }, pillDx: wide ? -0.05 * S.W : 0 });
      if (wa > 0) coverCard(S, L0.cx * S.W, L0.cy * S.H + drift * 1.3 + rest(lt, 0.55, 0.86) * 0.25 * S.H, L0.cw * S.W, 0.5 * S.H, { a: wa, title: itemsOf(b)[0], chip: brand().name, seed: 2, by: 0.32, bw: 0.7, bh: tall ? 0.22 : 0.3 });
      // the lockup rises with velocity blur
      const vb = blurOf(restV(lt, 0, 0.86) * 0.36 * S.H);
      c.save(); if (vb > 0.4) c.filter = `blur(${vb.toFixed(1)}px)`; const lk = lockup(S, L0.lx * S.W, lyy, { px: dpx, t0: 0, tag: (b.text && b.text.eyebrow) || brand().host, P }); c.restore();
      iceRing(S, lk.discX, lk.discY, discR, E.out(prog(lt, click - 0.42, 0.2)) * (1 - E.out(prog(lt, click + 0.6, 0.5))));
      L.headline(withP(S, P), { px: headPx(S, b, wide ? 104 : 88), maxW: L0.hw * S.W, x: lk.nameX, y: L0.hy * S.H + drift, align: 'left', maxLines: 3, lineH: 1.04 });
      drawDiveCursor(S, [[S.at('cursor'), lk.discX + 0.42 * m, lk.discY - 0.16 * m], [S.at('cursor') + 0.55, lk.discX + 0.3 * m, lk.discY - 0.19 * m], [click - 0.45, lk.discX + 0.06 * m, lk.discY + 0.03 * m], [click, lk.discX + 0.02 * m, lk.discY + 0.004 * m]], click, S.at('cursor'));
      c.restore();
    },
  });

  /* 2. the drop: a navy app icon shrinks onto a pale halo while four squares spin in counter-clockwise and lock into
     a cross around it, each holding a feature's icon; the line lands beside it; at the end everything collapses into
     a row and blurs out (the exit is the transition) */
  L.def('insert:app-icon-orbit-cross', {
    kind: 'setup',
    plan(b, F) { const d = b.d || 3, tp = T(b, F, 0.55), out = Math.max(tp.done + 0.6, d - 0.42); return { cues: { icon: 0, lock: 0.48, head: 0.55, headDone: tp.done, out }, events: [{ at: 0, event: 'hard-hit' }, { at: 0.1, event: 'cascade' }, { at: 0.48, event: 'pop' }, ...tp.events, { at: out, event: 'slide-out' }], exit: { kind: 'dot', x: 0.5, y: 0.42, r: 0.02 }, entry: { kind: 'rect', x: 0.5, y: 0.42, w: 0.22, h: 0.22 }, min: tp.done + 1.1 }; },
    draw(S) {
      const c = S.ctx, b = S.b, m = M(S), wide = isWide(S), P = Pl(S);
      c.fillStyle = paper(S); c.fillRect(-S.W, -S.H, S.W * 3, S.H * 3);
      const fg = c.createLinearGradient(0, S.H, 0, S.H * 0.55); fg.addColorStop(0, rgba(floorC(S), 0.9)); fg.addColorStop(1, rgba(floorC(S), 0)); c.fillStyle = fg; c.fillRect(-S.W, S.H * 0.55, S.W * 3, S.H);
      const col = E.in(prog(S.lt, S.at('out'), Math.max(0.2, S.d - S.at('out'))));
      const ox = wide ? S.W * 0.3 : S.W / 2, oy = wide ? S.H * 0.5 : S.H * 0.38, size = (wide ? 0.25 : 0.2) * m;
      orbit(S, ox, oy - S.lt * 6 * S.u, size, { t0: 0, lock: 0.48, collapse: col });
      c.save(); c.globalAlpha *= 1 - col; if (col > 0.05) c.filter = `blur(${(col * 8 * S.u).toFixed(1)}px)`;
      if (wide) L.headline(withP(S, P), { px: headPx(S, b, 118), maxW: S.W * 0.42, x: S.W * 0.53, y: S.H * 0.5 - headPx(S, b, 118) * (nWords(b) > 4 ? 1.2 : 0.62), align: 'left', maxLines: 3 });
      else L.headline(withP(S, P), { px: headPx(S, b, 104), maxW: S.W * 0.84, x: S.W / 2, y: S.H * (isTall(S) ? 0.6 : 0.68), align: 'center', maxLines: 2 });
      c.restore();
    },
  });

  /* 3. the ask: a laptop's menu bar over a deep-sky wallpaper; the cursor rises and presses the product's mark, a
     frosted prompt springs out under it and types the request while the scene pans to keep it composed; the line
     sits large on the white above; at the end the whole scene drifts up into a whip with a vertical smear */
  L.def('insert:menubar-prompt-popover', {
    kind: 'setup',
    plan(b, F) {
      const pr = (b.data && b.data.prompt) || toks(b).map(t => t.s).join(' ') || 'Make it happen', d = b.d || 4, tp = T(b, F, 0.1);
      const click = 0.42, pop = 0.52, type = 0.75, typed = type + pr.length / 30 + 0.2, whip = Math.max(typed + 0.35, d - 0.5);
      return { cues: { head: 0.1, headDone: tp.done, click, pop, type, typed, whip }, events: [...tp.events, { at: click, event: 'click-ui' }, { at: pop, event: 'pop' }, { at: type, event: 'code' }, { at: whip, event: 'slide-out' }], exit: { kind: 'rect', x: 0.5, y: 0.2, w: 1, h: 0.4 }, entry: { kind: 'rect', x: 0.5, y: 0.45, w: 1, h: 0.06 }, min: typed + 0.9 };
    },
    draw(S) {
      const b = S.b, m = M(S), wide = isWide(S), tall = isTall(S), lt = S.lt, P = Pl(S), d = S.d;
      const scene = S2 => {
        const c = S2.ctx; c.fillStyle = paper(S); c.fillRect(-S.W, -S.H, S.W * 3, S.H * 3);
        const enter = rest(lt, 0, 0.84), barY = S.H * (wide ? 0.5 : tall ? 0.44 : 0.5) + enter * 0.18 * S.H;
        const pan = -E.io(prog(lt, S.at('click'), 0.5)) * 125 * S.u * (wide ? 1 : 0.8);
        c.save(); c.translate(pan, 0);
        const x0 = wide ? S.W * 0.1 : S.W * 0.07, x1 = S.W * 1.15;
        let mk = null;
        c.save(); if (enter > 0.05) c.filter = `blur(${(enter * 5 * S.u).toFixed(1)}px)`;
        const lp = laptop(S2, x0, x1, barY, { press: L.pressAt([S.at('click')], lt).p, inside: () => {} }); mk = lp.mark; c.restore();
        const pw = Math.min(0.69 * m, S.W * 0.8), ph = pw * 0.31;
        const bx = Math.min(mk.x - pw * 0.22, S.W - pan - pw * 0.5 - 0.05 * S.W);
        const box = popover(S2, bx, barY + lp.barH + 0.025 * m, pw, ph, { t0: S.at('pop'), from: mk.w, text: (b.data && b.data.prompt) || 'Make it happen', typeAt: S.at('type'), cps: 30, send: S.at('typed') + 0.1 });
        const cur = [[0.0, mk.x + 0.2 * m, barY + 0.36 * m], [S.at('click') - 0.04, mk.x + 0.004 * m, mk.y + 0.008 * m], [S.at('type'), mk.x + 0.02 * m, mk.y + 0.03 * m]];
        if (box) cur.push([S.at('typed'), box.x + box.w - ph * 0.24 + 0.006 * m, box.y + ph * 0.76 + 0.01 * m]);
        drawDiveCursor(S2, cur, S.at('click'), 0);
        c.restore();
        // the line on the white above the laptop
        const hp = Math.min(headPx(S, b, wide ? 124 : 104), 0.13 * S.H), top = S.H * (tall ? 0.12 : 0.11);
        L.headline(withP(S2, P), { px: hp, maxW: S.W * (wide ? 0.62 : 0.86), x: S.W / 2, y: top, align: 'center', maxLines: 2, lineH: 1.02 });
      };
      const wk = leave(lt, S.at('whip'), Math.max(0.2, d - S.at('whip')));
      if (wk <= 0) { scene(S); return; }
      const dy = -wk * 0.75 * S.H, v = L.vel(t => -leave(t, S.at('whip'), Math.max(0.2, d - S.at('whip'))) * 0.75 * S.H, lt);
      const Bf = layer(S, 'whip', S2 => { S2.ctx.translate(0, dy); scene(S2); });
      S.ctx.fillStyle = paper(S); S.ctx.fillRect(-S.W, -S.H, S.W * 3, S.H * 3);
      blit(S, Bf, { n: 8, dy: Math.min(S.H * 0.18, Math.abs(v) * 2.2), blur: Math.min(8, Math.abs(v) * 0.02) * S.u });
      const c = S.ctx; c.save(); ID(c); c.fillStyle = rgba(mix(paper(S), cyan(S), 0.25), 0.7 * clamp((wk - 0.4) / 0.6)); c.fillRect(0, 0, c.canvas.width, c.canvas.height); c.restore();
    },
  });

  /* 4. the answer: a white page scrolls into place (two fast frames, then a sixth of the remaining distance a frame,
     unblurring from heavy to sharp), a breadcrumb and a title, the line set large in grey with its key phrase in
     ink, the features as quiet bullets running off the page; a pointer rides the scroll and stops under the phrase */
  L.def('insert:answer-page-key-phrase', {
    kind: 'setup',
    plan(b, F) { const tp = L.get('effect:type-key-phrase-ink').plan(b, F, 0.05); return { cues: { page: 0, head: 0.05, headDone: tp.done, ink: tp.done - 0.1 }, events: [{ at: 0, event: 'scene' }, ...tp.events], exit: { kind: 'rect', x: 0.5, y: 0.55, w: 0.7, h: 0.5 }, entry: { kind: 'rect', x: 0.5, y: 0.5, w: 1, h: 1 }, min: tp.done + 1.1 }; },
    draw(S) {
      const c = S.ctx, b = S.b, m = M(S), wide = isWide(S), tall = isTall(S), P = Pl(S), lt = S.lt;
      c.fillStyle = paper(S); c.fillRect(-S.W, -S.H, S.W * 3, S.H * 3);
      const fg = c.createLinearGradient(0, S.H, 0, S.H * 0.6); fg.addColorStop(0, rgba(floorC(S), 0.8)); fg.addColorStop(1, rgba(floorC(S), 0)); c.fillStyle = fg; c.fillRect(-S.W, S.H * 0.6, S.W * 3, S.H);
      const f = Math.max(0, lt * 60), TBL = [420, 315, 210, 170, 140, 116, 96, 81], off = (f < 7 ? lerp(TBL[Math.floor(f)], TBL[Math.floor(f) + 1], f % 1) : 81 * Math.pow(0.83, f - 7)) * S.u - lt * 6 * S.u;
      const bl = f < 6 ? lerp(24, 1.5, f / 6) : f < 8 ? lerp(1.5, 0, (f - 6) / 2) : 0;
      const x0 = wide ? S.W * 0.12 : S.W * (tall ? 0.08 : 0.09), colW = wide ? S.W * 0.5 : S.W * (tall ? 0.84 : 0.82), top = S.H * (tall ? 0.16 : 0.1) + off;
      const B = brand(), it = itemsOf(b), dim = mix(paper(S), P.fg, 0.38), faint = mix(paper(S), P.fg, 0.5);
      c.save(); if (bl > 0.3) c.filter = `blur(${(bl * S.u).toFixed(1)}px)`;
      const mpx = 0.032 * m;
      L.text(c, S.look, B.name, x0, top, { role: 'ui', px: mpx, color: mix(paper(S), P.fg, 0.32) });
      let bx = x0 + L.text(c, S.look, 'Home', x0, top + mpx * 1.6, { role: 'ui', px: mpx * 1.15, color: faint }) + mpx * 0.5;
      L.text(c, S.look, '›', bx, top + mpx * 1.6, { role: 'ui', px: mpx * 1.15, color: faint }); bx += mpx * 1.0;
      L.text(c, S.look, it[0], bx, top + mpx * 1.6, { role: 'ui', px: mpx * 1.15, color: faint, maxW: colW * 0.7 });
      const tpx = 0.05 * m; L.text(c, S.look, (b.text && b.text.eyebrow) || it[0], x0, top + mpx * 1.6 + tpx * 1.9, { role: 'display', px: tpx, weight: 600, color: mix(paper(S), P.fg, 0.7), maxW: colW });
      L.text(c, S.look, `${B.host || B.name} · ${it.length} features`, x0, top + mpx * 1.6 + tpx * 3.0, { role: 'ui', px: mpx * 1.05, color: faint });
      const hy = top + mpx * 1.6 + tpx * 4.1, hp = Math.min(headPx(S, b, wide ? 140 : 104), 0.12 * S.H);
      c.restore();
      const lay = L.headline(withP(S, P), { px: hp, maxW: colW, x: x0, y: hy, align: 'left', maxLines: 4, lineH: 1.16 }, { type: 'effect:type-key-phrase-ink', blur: bl * S.u });
      const ly = (lay ? lay.bottom : hy + hp * 2) + hp * 0.7;
      c.save(); if (bl > 0.3) c.filter = `blur(${(bl * S.u).toFixed(1)}px)`;
      it.slice(0, 5).forEach((s, i) => { const y = ly + i * mpx * 2.3; if (y > S.H + 40) return; L.circle(c, x0 + mpx * 0.3, y - mpx * 0.35, mpx * 0.14, faint); L.text(c, S.look, s, x0 + mpx * 1.1, y, { role: 'ui', px: mpx * 1.3, color: i < 2 ? dim : faint, maxW: colW }); });
      if (wide) coverCard(S, S.W * 0.66, top + 0.02 * S.H, S.W * 0.27, S.H * 0.62, { title: it[1] || it[0], chip: B.name, seed: 6, by: 0.36, bw: 0.82, bh: 0.2, word: '0' + Math.min(9, it.length), meta: B.host });
      c.restore();
      if (lay) {
        const key = lay.words.filter(w => w.tk.accent); const kw = key.length ? key : lay.words.slice(-2);
        const kx = Math.max(...kw.map(w => w.x + w.w)) + 0.012 * m, ky = kw[kw.length - 1].y - hp * 0.18;
        const p = pathAt([[0, kx + 0.12 * m, ky + 0.3 * S.H], [0.62, kx, ky + 0.012 * m], [S.d, kx + 0.05 * m, ky + 0.02 * m]], lt);
        cursorHead(S, p.x, p.y, { a: E.out(prog(lt, 0.05, 0.3)), blur: bl * 0.15 });
      }
    },
  });

  /* 5. the result sheet: a page softens a couple of px while a white sheet rises over it like a phone sheet,
     unblurring as it lands and drifting on: a grabber, an inset line-art cover with a caption block, a title and a
     meta line; the line sits large beside it (or under it); at the end it shrinks 5%, rises and the frame blurs out */
  L.def('insert:sheet-card-rise', {
    kind: 'setup',
    plan(b, F) { const d = b.d || 4, tp = T(b, F, 0.32), out = Math.max(tp.done + 0.5, d - 0.26); return { cues: { sheet: 0, head: 0.32, headDone: tp.done, out }, events: [{ at: 0.02, event: 'card-in' }, ...tp.events, { at: out, event: 'slide-out' }], exit: { kind: 'rect', x: 0.4, y: 0.45, w: 0.4, h: 0.5 }, entry: { kind: 'rect', x: 0.5, y: 0.5, w: 1, h: 1 }, min: tp.done + 1.0 }; },
    draw(S) {
      const c = S.ctx, b = S.b, m = M(S), wide = isWide(S), tall = isTall(S), P = Pl(S), lt = S.lt, it = itemsOf(b), B = brand();
      c.fillStyle = paper(S); c.fillRect(-S.W, -S.H, S.W * 3, S.H * 3);
      // the page behind: real words, softened as the sheet rises
      const def = 2.5 * E.out(prog(lt, 0, 0.25)) * S.u;
      c.save(); if (def > 0.3) c.filter = `blur(${def.toFixed(1)}px)`; c.globalAlpha *= 0.55;
      const px0 = S.W * 0.08, mp = 0.034 * m; for (let i = 0; i < 12; i++) { const s = i % 3 === 0 ? (it[(i / 3) % it.length] || B.name) : (B.tagline || B.name) + ' · ' + (it[(i + 1) % it.length] || ''); L.text(c, S.look, s, px0, S.H * 0.1 + i * mp * 1.9 - lt * 4 * S.u, { role: i % 3 === 0 ? 'display' : 'ui', px: i % 3 === 0 ? mp * 1.15 : mp, color: mix(paper(S), P.fg, i % 3 === 0 ? 0.4 : 0.26), maxW: S.W * 0.84 }); }
      c.restore();
      const out = E.in(prog(lt, S.at('out'), Math.max(0.15, S.d - S.at('out'))));
      const cw = wide ? S.W * 0.34 : tall ? S.W * 0.78 : S.W * 0.58, chh = cw * 1.02, cx = wide ? S.W * 0.29 : S.W / 2, cyEnd = wide ? S.H * 0.5 : tall ? S.H * 0.36 : S.H * 0.4;
      const k = rest(lt, 0, 0.84), cy = cyEnd + k * 0.42 * S.H - lt * 10 * S.u - out * 0.05 * S.H, vb = blurOf(restV(lt, 0, 0.84) * 0.42 * S.H, 4) * S.u;
      c.save(); scaleAbout(c, cx, cy, 1 - out * 0.05); if (vb > 0.3) c.filter = `blur(${vb.toFixed(1)}px)`;
      const x = cx - cw / 2, y = cy - chh / 2, r = cw * 0.075;
      L.card(c, x, y, cw, chh, r, { fill: '#FFFFFF', u: S.u, lift: 1.4, shadow: rgba(navy(S), 0.18), shadow2: rgba(navy(S), 0.08) });
      const ins = cw * 0.045, coverH = chh * 0.7;
      coverCard(S, x + ins, y + ins, cw - ins * 2, coverH, { title: it[0], chip: B.name, seed: 4, by: 0.36, bw: 0.78, bh: 0.32, r: r - ins * 0.6 });
      L.rr(c, cx - cw * 0.06, y + ins + cw * 0.025, cw * 0.12, cw * 0.012, cw * 0.006); c.fillStyle = rgba('#FFFFFF', 0.85); c.fill();
      L.text(c, S.look, it[0], cx, y + ins + coverH + chh * 0.13, { role: 'display', px: cw * 0.052, weight: 600, color: P.fg, align: 'center', maxW: cw * 0.86 });
      L.text(c, S.look, `${B.name} · ${it.length} features`, cx, y + ins + coverH + chh * 0.2, { role: 'ui', px: cw * 0.033, color: P.dim, align: 'center', maxW: cw * 0.86 });
      c.restore();
      c.save(); c.globalAlpha *= 1 - out * 0.5;
      if (wide) L.headline(withP(S, P), { px: headPx(S, b, 104), maxW: S.W * 0.4, x: S.W * 0.53, y: S.H * 0.5 - headPx(S, b, 104) * 1.1, align: 'left', maxLines: 3 });
      else L.headline(withP(S, P), { px: headPx(S, b, 86), maxW: S.W * 0.86, x: S.W / 2, y: cyEnd + chh / 2 + 0.05 * S.H - lt * 10 * S.u, align: 'center', maxLines: 2 });
      c.restore();
      frameBlur(S, out > 0 ? lerp(1, 7, out) * S.u : 0);
    },
  });

  /* 6. two stacked cards with frosted titles: line-art cards, each with a frosted tag and menu, a caption block and a
     giant frosted word along its bottom edge, sliced by it; the top card lands from 108%, the lower one from far
     below, both sharpening from a 12 px blur, drifting up, leaving accelerating */
  L.def('insert:stacked-cards-frosted-titles', {
    kind: 'setup',
    plan(b, F) { const d = b.d || 4, tp = T(b, F, 0.3), out = Math.max(tp.done + 0.6, d - 0.3); return { cues: { cards: 0, head: 0.3, headDone: tp.done, words: 0.2, out }, events: [{ at: 0, event: 'card-in' }, { at: 0.08, event: 'list-item' }, { at: 0.25, event: 'key-word' }, ...tp.events, { at: out, event: 'slide-out' }], exit: { kind: 'rect', x: 0.5, y: 0.5, w: 0.5, h: 0.7 }, entry: { kind: 'rect', x: 0.5, y: 0.45, w: 0.5, h: 0.6 }, min: tp.done + 1.0 }; },
    draw(S) {
      const c = S.ctx, b = S.b, wide = isWide(S), tall = isTall(S), P = Pl(S), lt = S.lt, it = itemsOf(b);
      c.fillStyle = paper(S); c.fillRect(-S.W, -S.H, S.W * 3, S.H * 3);
      const fg = c.createLinearGradient(0, S.H, 0, S.H * 0.5); fg.addColorStop(0, rgba(floorC(S), 0.9)); fg.addColorStop(1, rgba(floorC(S), 0)); c.fillStyle = fg; c.fillRect(-S.W, S.H * 0.5, S.W * 3, S.H);
      const out = leave(lt, S.at('out'), Math.max(0.15, S.d - S.at('out')));
      const cw = wide ? S.W * 0.36 : tall ? S.W * 0.84 : S.W * 0.56, ch = cw * 0.647, cx = wide ? S.W * 0.69 : S.W / 2;
      const gap = ch * 0.1, y1 = wide ? S.H / 2 - ch - gap / 2 : tall ? S.H * 0.3 : S.H * 0.21, y2 = y1 + ch + gap;
      const words = [0, 1].map(i => firstWord(it[i] || it[0]));
      [[y1, 0, 0.09 * S.H, 1.08], [y2, 1, 0.42 * S.H, 1]].forEach(([y, i, from, s0]) => {
        const k = rest(lt, i * 0.06, 0.84), bl = 12 * E.in(clamp(1 - prog(lt, i * 0.06, 0.3))), yy = y + k * from - lt * 16 * S.u - out * (0.5 + i * 0.12) * S.H, s = lerp(1, s0, k);
        const ob = out * 9;
        c.save(); scaleAbout(c, cx, yy + ch / 2, s); if (bl + ob > 0.3) c.filter = `blur(${((bl + ob) * S.u).toFixed(1)}px)`;
        coverCard(S, cx - cw / 2, yy, cw, ch, { title: it[i] || it[0], chip: '0' + (i + 1), seed: 7 + i * 3, word: words[i], wordK: E.out(prog(lt, 0.18 + i * 0.08, 0.5)), by: 0.27, bw: 0.62, bh: 0.28 });
        c.restore();
      });
      c.save(); c.globalAlpha *= 1 - out;
      if (wide) L.headline(withP(S, P), { px: headPx(S, b, 104), maxW: S.W * 0.4, x: S.W * 0.08, y: S.H * 0.5 - headPx(S, b, 104) * 1.1, align: 'left', maxLines: 3 });
      else L.headline(withP(S, P), { px: headPx(S, b, 68), maxW: S.W * 0.86, x: S.W / 2, y: S.H * (tall ? 0.1 : 0.045), align: 'center', maxLines: 2 });
      c.restore();
    },
  });

  /* 7. the brand beat: the disc rises into place with a vertical smear, then holds DEAD still (the film's one freeze)
     while the line arrives under it; then it shrinks away accelerating and the line drifts up after it */
  L.def('insert:logo-disc-freeze', {
    kind: 'setup',
    plan(b, F) { const d = b.d || 3, hold = 0.42, tp = T(b, F, hold + 0.05), rel = Math.max(hold + 0.6, Math.min(tp.done + 0.35, d - 0.5)); return { cues: { rise: 0, hold, head: hold + 0.05, headDone: tp.done, release: rel }, events: [{ at: 0, event: 'hard-hit' }, ...tp.events, { at: rel, event: 'slide-out' }], exit: { kind: 'circle', x: 0.5, y: 0.4, r: 0.05 }, entry: { kind: 'circle', x: 0.5, y: 0.42, r: 0.08 }, min: rel + 0.6 }; },
    draw(S) {
      const c = S.ctx, b = S.b, m = M(S), P = Pl(S), lt = S.lt, tall = isTall(S);
      c.fillStyle = paper(S); c.fillRect(-S.W, -S.H, S.W * 3, S.H * 3);
      const fg = c.createRadialGradient(S.W / 2, S.H * 0.42, 0, S.W / 2, S.H * 0.42, m * 0.6); fg.addColorStop(0, rgba(floorC(S), 0.7)); fg.addColorStop(1, rgba(floorC(S), 0)); c.fillStyle = fg; c.fillRect(-S.W, -S.H, S.W * 3, S.H * 3);
      const r0 = 0.14 * m, cy0 = S.H * (tall ? 0.4 : 0.38), rel = S.at('release'), hold = S.at('hold');
      // rise (exponential, 0.82 a frame) → freeze → release (ease-in shrink)
      const rk = lt < hold ? rest(lt, 0, 0.8) : 0, sh = lt > rel ? E.in(prog(lt, rel, Math.max(0.3, S.d - rel))) : 0;
      const cy = cy0 + rk * 0.11 * S.H - sh * 0.04 * S.H, r = r0 * (1 - sh * 0.36);
      const v = lt < hold ? restV(lt, 0, 0.8) * 0.11 * S.H : 0;
      if (v > 1.5) { const Bf = layer(S, 'disc', S2 => disc(S2, S.W / 2, cy, r)); blit(S, Bf, { n: 8, dy: Math.min(0.12 * S.H, v * 3) }); }
      else { c.save(); if (sh > 0.05) c.filter = `blur(${(sh * 4 * S.u).toFixed(1)}px)`; disc(S, S.W / 2, cy, r); c.restore(); }
      const hp = headPx(S, b, 96), hy = cy0 + r0 + 0.07 * S.H - (lt > rel ? E.in(prog(lt, rel, 0.8)) * 0.05 * S.H : 0);
      L.headline(withP(S, P), { px: hp, maxW: S.W * (isWide(S) ? 0.7 : 0.86), x: S.W / 2, y: hy, align: 'center', maxLines: 2 });
    },
  });

  /* 8. frosted line on a sky card: a near full-frame deep-sky card lands from 108% out of a 12 px blur; the line is
     set huge in frosted glass along its bottom edge so the edge slices the last line; a frosted tag, a menu and a
     caption block sit at the top */
  L.def('insert:frosted-line-sky-card', {
    kind: 'setup',
    plan(b, F) { const n = nWords(b), done = 0.25 + Math.min(3, Math.ceil(n / 2)) * 0.1 + 0.5; return { cues: { card: 0, head: 0.25, headDone: done }, events: [{ at: 0, event: 'card-in' }, { at: 0.25, event: 'key-word' }, { at: 0.45, event: 'word' }], exit: { kind: 'rect', x: 0.5, y: 0.5, w: 0.9, h: 0.9 }, entry: { kind: 'rect', x: 0.5, y: 0.5, w: 0.9, h: 0.9 }, min: done + 1.0 }; },
    draw(S) {
      const c = S.ctx, b = S.b, m = M(S), lt = S.lt, B = brand();
      c.fillStyle = paper(S); c.fillRect(-S.W, -S.H, S.W * 3, S.H * 3);
      const mg = 0.045 * m, x = mg, y = mg, w = S.W - mg * 2, h = S.H - mg * 2, r = 0.06 * m;
      const k = rest(lt, 0, 0.84), s = 1 + 0.08 * k - lt * 0.006, bl = 12 * E.in(clamp(1 - prog(lt, 0, 0.32)));
      c.save(); scaleAbout(c, S.W / 2, S.H / 2, s); if (bl > 0.3) c.filter = `blur(${(bl * S.u).toFixed(1)}px)`;
      shadowOut(S, x, y, w, h, r, { color: rgba(navy(S), 0.3), blur: 60, y: 26 });
      c.save(); L.rr(c, x, y, w, h, r); c.clip(); skyArt(S, x, y, w, h, { seed: 11 }); c.restore();
      const ch = 0.05 * m, pad = 0.05 * m;
      glassChip(S, (b.text && b.text.eyebrow) || B.name, x + pad, y + pad, ch); glassMenu(S, x + w - pad - ch / 2, y + pad + ch / 2, ch);
      const sub = (b.text && b.text.sub) || B.tagline || itemsOf(b)[0];
      if (sub) { const bw = Math.min(w * 0.42, 0.5 * m), bh = 0.12 * m, by = y + pad + ch * 1.6; L.card(c, x + pad, by, bw, bh, 0.025 * m, { fill: '#FFFFFF', u: S.u, lift: 0.6, shadow: rgba(navy(S), 0.25) }); const lay = L.layout(c, S.look, sub.split(/\s+/).map(s => ({ s })), { role: 'display', px: bh * 0.24, maxW: bw * 0.74, x: x + pad + bh * 0.18, y: by + bh * 0.16, align: 'left', maxLines: 2, lineH: 1.1 }); for (const wd of lay.words) L.drawWord(c, S.look, Pl(S), wd, { color: ink(S) }); arrowBtn(S, x + pad + bw - bh * 0.24, by + bh - bh * 0.24, bh * 0.22); }
      c.restore();
      // the frosted line: lines rise from under the bottom edge, the last line is cut by it
      const tk = toks(b); if (!tk.length) return;
      let px = Math.min(0.3 * S.H, (isWide(S) ? 0.2 : 0.17) * m * (nWords(b) <= 2 ? 1.3 : 1));
      const lay = L.layout(c, S.look, tk.map(t => ({ s: t.s, weight: 750 })), { role: 'display', px, min: px * 0.35, maxW: w * 0.88, x: x + pad * 0.6, y: 0, align: 'left', maxLines: 3, lineH: 0.92 });
      px = lay.px; const base = y + h + px * 0.24 - (lay.lines - 1) * lay.lh;
      for (let li = 0; li < lay.lines; li++) {
        const wk = E.out(prog(lt, S.at('head') + li * 0.1, 0.55)); if (wk <= 0) continue;
        const ws = lay.words.filter(q => q.li === li), s0 = ws.map(q => q.s).join(' '), ly = base + li * lay.lh + (1 - wk) * px * 0.8 - lt * 5 * S.u;
        c.save(); scaleAbout(c, S.W / 2, S.H / 2, s);
        glassWord(S, s0, ws[0].x, ly, px, { weight: 750, clip: cx => { L.rr(cx, x, y, w, h, r); cx.clip(); }, shadow: false, lighten: 0.42, blur: 12, a: clamp(wk * 1.4), tint: cyan(S), tintA: 0.1 });
        c.restore();
      }
    },
  });

  /* 9. a frosted number on the sky: the stat counts up in huge frosted glass over the deep-sky world, rising into
     place already moving; a frosted label chip above, the line in white under it */
  L.def('insert:frosted-numeral-sky', {
    kind: 'setup',
    plan(b, F) { const tp = T(b, F, 0.75); return { cues: { num: 0, count: 0.05, head: 0.75, headDone: tp.done }, events: [{ at: 0, event: 'hard-hit' }, { at: 0.1, event: 'stat' }, ...tp.events], exit: { kind: 'dot', x: 0.5, y: 0.45, r: 0.02 }, entry: { kind: 'rect', x: 0.5, y: 0.5, w: 1, h: 1 }, min: tp.done + 1.0 }; },
    draw(S) {
      const c = S.ctx, b = S.b, m = M(S), lt = S.lt, Pd = Ps(S), wide = isWide(S);
      skyArt(S, -S.W * 0.05, -S.H * 0.05, S.W * 1.1, S.H * 1.1, { seed: 9 });
      const n = (b.data && b.data.number) || { value: itemsOf(b).length, suffix: '', label: 'features' }, to = typeof n.value === 'number' ? n.value : parseFloat(n.value) || 0;
      const dec = Number.isInteger(to) ? 0 : 1, tq = Math.floor(lt * 15) / 15, val = lerp(0, to, E.out(prog(tq, 0.05, 1.0)));
      const str = (n.prefix || '') + val.toFixed(dec).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (n.suffix || '');
      const k = rest(lt, 0, 0.84), cy = S.H * (wide ? 0.56 : 0.52) + k * 0.25 * S.H - lt * 8 * S.u;
      let px = (wide ? 0.5 : 0.42) * m; const full = (n.prefix || '') + to.toFixed(dec).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (n.suffix || ''), fw = runW(S, full, px, 750); if (fw > S.W * 0.86) px *= S.W * 0.86 / fw;
      const vb = blurOf(restV(lt, 0, 0.84) * 0.25 * S.H, 10);
      c.save(); if (vb > 0.4) c.filter = `blur(${(vb * S.u).toFixed(1)}px)`;
      glassWord(S, str, S.W / 2, cy, px, { weight: 750, align: 'center', lighten: 0.38, blur: 14, dark: false, tint: cyan(S), tintA: 0.14, base: rgba('#FFFFFF', 0.06) });
      c.restore();
      const lab = n.label || (b.text && b.text.eyebrow); if (lab) { const ck = E.out(prog(lt, 0.3, 0.4)), chh = 0.068 * m; c.save(); c.globalAlpha *= ck; const w = L.textW(c, S.look, lab, { role: 'ui', px: chh * 0.46, weight: 600 }) + chh * 0.9; glassChip(S, lab, S.W / 2 - w / 2, cy - px * 0.86 - chh * 1.4 + (1 - ck) * 10 * S.u, chh); c.restore(); }
      L.headline(withP(S, Object.assign({}, Pd, { accent: mix(cyan(S), '#FFFFFF', 0.55) })), { px: headPx(S, b, 76), maxW: S.W * 0.78, x: S.W / 2, y: cy + px * 0.2, align: 'center', maxLines: 2 });
    },
  });

  /* 10. three cover cards: the features as three line-art cards that enter already moving, one after another, then
     drift at different speeds; the middle one lifts as the focus; the line lands above them */
  L.def('insert:cover-card-trio', {
    kind: 'setup',
    plan(b, F) { const tp = T(b, F, 0.1); return { cues: { cards: 0.05, head: 0.1, headDone: tp.done, focus: Math.max(1.0, tp.done + 0.2) }, events: [...tp.events, ...[0, 1, 2].map(i => ({ at: 0.05 + i * 0.09, event: 'card-in' })), { at: Math.max(1.0, tp.done + 0.2), event: 'pop' }], exit: { kind: 'rect', x: 0.5, y: 0.6, w: 0.3, h: 0.45 }, entry: { kind: 'rect', x: 0.5, y: 0.6, w: 0.9, h: 0.5 }, min: Math.max(2.2, tp.done + 1.0) }; },
    draw(S) {
      const c = S.ctx, b = S.b, wide = isWide(S), tall = isTall(S), P = Pl(S), lt = S.lt, it = itemsOf(b);
      c.fillStyle = paper(S); c.fillRect(-S.W, -S.H, S.W * 3, S.H * 3);
      const fg = c.createLinearGradient(0, S.H, 0, S.H * 0.45); fg.addColorStop(0, rgba(floorC(S), 0.95)); fg.addColorStop(1, rgba(floorC(S), 0)); c.fillStyle = fg; c.fillRect(-S.W, S.H * 0.45, S.W * 3, S.H);
      const hp = headPx(S, b, wide ? 112 : 92);
      L.headline(withP(S, P), { px: hp, maxW: S.W * 0.84, x: S.W / 2, y: S.H * (tall ? 0.07 : 0.07) - lt * 6 * S.u, align: 'center', maxLines: 2 });
      const fk = E.out(prog(lt, S.at('focus'), 0.5));
      for (let i = 0; i < 3; i++) {
        const t0 = S.at('cards') + i * 0.09, k = rest(lt, t0, 0.85); if (lt < t0) continue;
        let x, y, w, h;
        if (tall) { w = S.W * 0.78; h = S.H * 0.2; x = S.W / 2 - w / 2; y = S.H * 0.33 + i * (h + S.H * 0.03); }
        else { w = S.W * (wide ? 0.27 : 0.29); h = Math.min(S.H * (wide ? 0.52 : 0.46), w * 1.25); x = S.W / 2 + (i - 1) * (w + S.W * 0.025) - w / 2; y = S.H * (wide ? 0.38 : 0.42); }
        const lift = i === 1 ? fk : 0, dy = k * 0.35 * S.H - lt * (6 + i * 4) * S.u - lift * 0.02 * S.H, s = 1 + lift * 0.04, bl = blurOf(restV(lt, t0, 0.85) * 0.35 * S.H, 12);
        c.save(); scaleAbout(c, x + w / 2, y + h / 2 + dy, s); c.globalAlpha *= clamp((lt - t0) * 8) * (i !== 1 ? 1 - fk * 0.15 : 1); if (bl > 0.4) c.filter = `blur(${(bl * S.u).toFixed(1)}px)`;
        coverCard(S, x, y + dy, w, h, { title: it[i % it.length], chip: '0' + (i + 1), seed: 13 + i * 5, by: tall ? 0.34 : 0.4, bw: tall ? 0.5 : 0.84, bh: tall ? 0.42 : 0.26, meta: brand().name, word: tall ? null : '0' + (i + 1), wordK: E.out(prog(lt, t0 + 0.15, 0.5)) });
        c.restore();
      }
    },
  });

  /* ════════════════════════ end cards ════════════════════════ */

  /* the glowing wordmark on black: a radial black field; the wordmark slams in as a horizontal zoom streak (copies
     collapsing onto it in a few frames), glows tight with a wide soft halo, creeps smaller a px a frame, the tagline
     rises dim beneath; the last half second it collapses inward with a growing blur and lands on the downbeat */
  L.def('end_card:glow-wordmark-night', {
    kind: 'end',
    plan(b) { const d = b.d || 3; return { cues: { mark: 0, tag: 0.75, collapse: Math.max(1.6, d - 0.5) }, events: [{ at: 0, event: 'hard-hit' }, { at: 0.04, event: 'key-word' }, { at: 0.75, event: 'word' }], entry: { kind: 'dot', x: 0.5, y: 0.5, r: 0.02 }, min: 2.4 }; },
    draw(S) {
      const c = S.ctx, B = brand(), m = M(S), lt = S.lt, fg = S.look.palette.inkText || '#F4F6FB';
      const g = c.createRadialGradient(S.W / 2, S.H * 0.47, 0, S.W / 2, S.H * 0.5, Math.hypot(S.W, S.H) * 0.55); g.addColorStop(0, nightCore(S)); g.addColorStop(0.55, mix(ink(S), '#000000', 0.3)); g.addColorStop(1, mix(ink(S), '#000000', 0.7));
      c.fillStyle = g; c.fillRect(-S.W, -S.H, S.W * 3, S.H * 3);
      let px = Math.min(0.14 * S.H, 0.13 * m * 1.2); const w0 = runW(S, B.name, px, 640, -0.035); if (w0 > S.W * 0.62) px *= S.W * 0.62 / w0;
      // width: 2.25x → 1 in 8 frames (zoom streak), then a creep, then the collapse
      const f = lt * 60, z = f < 8 ? lerp(2.25, 1.08, E.out(f / 8)) : 1.08 * Math.pow(0.986, (f - 8) / 6) - (lt - 0.14) * 0.012;
      const col = E.in(prog(lt, S.at('collapse'), Math.max(0.3, S.d - S.at('collapse')))), s = Math.max(0.3, z * (1 - col * 0.42)), v = Math.abs(L.vel(t => (t * 60 < 8 ? lerp(2.25, 1.08, E.out(t * 60 / 8)) : 1), lt));
      const cx = S.W / 2, cy = S.H * 0.5;
      const drawMark = (cx2, a, sx, sy, blur) => { c.save(); c.globalAlpha *= a; if (blur > 0.3) c.filter = `blur(${blur.toFixed(1)}px)`; c.translate(cx, cy); c.scale(sx, sy); L.text(c, S.look, B.name, 0, px * 0.36, { role: 'wordmark', px, weight: 640, color: fg, align: 'center', tracking: -0.035 }); c.restore(); };
      c.save(); c.globalCompositeOperation = 'lighter';
      L.bloom(c, cx, cy, Math.max(S.W * 0.28, px * 3.2) * s, mix(fg, cyan(S), 0.1), 0.2 * (1 - col * 0.5));
      if (v > 0.2) for (let i = 1; i <= 20; i++) drawMark(0, 0.24 * (1 - i / 21) * clamp(v / 8), s * (1 + i * 0.035 * Math.min(1, v / 6)), s, 0);
      drawMark(0, 0.5, s, s, 26 * S.u * s); drawMark(0, 0.65, s, s, 4 * S.u * s);
      c.restore();
      drawMark(0, 1, s, s, col * 3.5 * S.u);
      const tk = E.out(prog(lt, S.at('tag'), 0.6)) * (1 - col);
      if (B.tagline && tk > 0) { c.save(); c.globalAlpha *= tk; L.text(c, S.look, B.tagline, cx, cy + px * 1.05 + (1 - tk) * 14 * S.u, { role: 'ui', px: Math.max(26 * S.u, px * 0.24), color: rgba(fg, 0.66), align: 'center', maxW: S.W * 0.8 }); c.restore(); }
    },
  });

  /* the disc lockup on haze: the haze clears, the disc lockup rises hard and drifts, the tagline lands under it, the
     address sits in a frosted pill; the cursor glides in and presses the disc inside an ice ring */
  L.def('end_card:disc-lockup-haze', {
    kind: 'end',
    plan(b) { return { cues: { lock: 0, tag: 0.45, pill: 0.7, click: 1.75 }, events: [{ at: 0.05, event: 'card-in' }, { at: 0.45, event: 'word' }, { at: 0.7, event: 'cta' }, { at: 1.75, event: 'click-ui' }], entry: { kind: 'circle', x: 0.35, y: 0.42, r: 0.05 }, min: 2.6 }; },
    draw(S) {
      const c = S.ctx, B = brand(), m = M(S), lt = S.lt, P = Pl(S);
      const hk = E.out(prog(lt, 0, 0.93)), bg = c.createLinearGradient(0, 0, 0, S.H); bg.addColorStop(0, mix(haze(S), paper(S), hk * 0.85)); bg.addColorStop(1, mix(haze(S), paper(S), hk * 0.4)); c.fillStyle = bg; c.fillRect(-S.W, -S.H, S.W * 3, S.H * 3);
      const fg = c.createLinearGradient(0, S.H, 0, S.H * 0.5); fg.addColorStop(0, rgba(floorC(S), 1)); fg.addColorStop(1, rgba(floorC(S), 0)); c.fillStyle = fg; c.fillRect(-S.W, S.H * 0.5, S.W * 3, S.H);
      let px = 0.13 * m; const tag = B.host, tw0 = px * 2.4 + runW(S, B.name, px, 560) + px * 0.3 + L.textW(c, S.look, tag, { role: 'ui', px: px * 0.27, weight: 600 }) + px * 0.5; if (tw0 > S.W * 0.86) px *= S.W * 0.86 / tw0;
      const tw = px * 2.4 + runW(S, B.name, px, 560) + px * 0.3 + L.textW(c, S.look, tag, { role: 'ui', px: px * 0.27, weight: 600 }) + px * 0.5;
      const k = rest(lt, 0, 0.86), y = S.H * 0.44 + k * 0.38 * S.H - lt * 10 * S.u, vb = blurOf(restV(lt, 0, 0.86) * 0.38 * S.H, 12);
      c.save(); if (vb > 0.4) c.filter = `blur(${(vb * S.u).toFixed(1)}px)`; const lk = lockup(S, S.W / 2 - tw / 2, y, { px, t0: 0, tag, P }); c.restore();
      iceRing(S, lk.discX, lk.discY, lk.r, E.out(prog(lt, S.at('click') - 0.42, 0.2)));
      const tk = E.out(prog(lt, S.at('tag'), 0.55));
      if (B.tagline && tk > 0) { c.save(); c.globalAlpha *= tk; if (tk < 0.95) c.filter = `blur(${((1 - tk) * 8 * S.u).toFixed(1)}px)`; L.text(c, S.look, B.tagline, S.W / 2, y + px * 1.65 + (1 - tk) * 16 * S.u, { role: 'display', px: px * 0.46, weight: 500, color: mix(paper(S), P.fg, 0.6), align: 'center', maxW: S.W * 0.84 }); c.restore(); }
      drawDiveCursor(S, [[0.9, lk.discX + 0.4 * m, lk.discY + 0.22 * m], [1.25, lk.discX + 0.26 * m, lk.discY + 0.12 * m], [S.at('click') - 0.4, lk.discX + 0.05 * m, lk.discY + 0.03 * m], [S.at('click'), lk.discX + 0.02 * m, lk.discY + 0.004 * m]], S.at('click'), 0.9);
    },
  });

  /* ════════════════════════ type treatments ════════════════════════ */
  function wordAt(S, w, o) { const c = S.ctx; if (o.a <= 0.002) return; c.save(); c.globalAlpha *= clamp(o.a); if (o.blur > 0.35) c.filter = `blur(${o.blur.toFixed(2)}px)`; if (o.sx && o.sx !== 1) scaleAbout(c, o.cx, o.cy, o.sx, o.sy || 1); L.drawWord(c, S.look, S.P, w, { x: w.x + (o.dx || 0), y: w.y + (o.dy || 0), fill: o.fill }); c.restore(); }

  /* blur-slide sharpen: each word enters heavily blurred and slides a few px sideways into focus, a frame or two
     after its neighbour (labels, names, short lines) */
  L.def('effect:type-blur-slide-sharpen', {
    kind: 'type',
    plan(b, F, t0 = 0) { const n = nWords(b), ws = Array.from({ length: n }, (_, i) => +(t0 + i * 0.067).toFixed(3)); const a = toks(b).findIndex(t => t.accent); return { words: ws, done: (ws[n - 1] || t0) + 0.24, events: [{ at: t0, event: 'word' }, ...(a >= 0 ? [{ at: ws[a], event: 'key-word' }] : [])] }; },
    draw(S, o) { const lay = o.lay; for (const w of lay.words) { const k = E.out(prog(S.lt, (o.t0 || 0) + w.i * 0.067, 0.24)); wordAt(S, w, { a: clamp(k * 2.2), dx: (1 - k) * 18 * S.u, blur: (1 - k) * 10 * S.u }); } },
  });

  /* exponential rise: each line enters already moving from low in the frame, covering 14% of the remaining distance
     per frame, its blur following its speed, then drifts on a px a frame (never still) */
  L.def('effect:type-exponential-rise', {
    kind: 'type',
    plan(b, F, t0 = 0) { const n = nWords(b), lines = Math.min(3, Math.max(1, Math.ceil(n / 3))); return { words: Array(n).fill(t0), done: t0 + 0.42 + (lines - 1) * 0.06, events: [{ at: t0, event: 'card-in' }, { at: t0 + 0.12, event: 'word' }] }; },
    draw(S, o) {
      const lay = o.lay, t0 = o.t0 || 0, D = S.H * 0.3;
      for (const w of lay.words) { const st = t0 + w.li * 0.06; if (S.lt < st) continue; const r = rest(S.lt, st, 0.86), v = restV(S.lt, st, 0.86) * D; wordAt(S, w, { a: clamp((S.lt - st) * 10), dy: r * D - (S.lt - st) * 12 * S.u, blur: blurOf(v, 14) * S.u }); }
    },
  });

  /* zoom streak: the line slams in as a horizontal zoom streak (twenty faint scaled copies collapse onto it in a few
     frames), then creeps smaller */
  L.def('effect:type-zoom-smear-arrival', {
    kind: 'type',
    plan(b, F, t0 = 0) { const n = nWords(b); return { words: Array(n).fill(t0), done: t0 + 0.3, events: [{ at: t0, event: 'hard-hit' }, { at: t0 + 0.02, event: 'key-word' }] }; },
    draw(S, o) {
      const lay = o.lay, t0 = o.t0 || 0, lt = S.lt - t0; if (lt < 0) return;
      const f = lt * 60, z = f < 8 ? lerp(2.1, 1.04, E.out(f / 8)) : 1.04 - (lt - 0.133) * 0.02, v = f < 8 ? (1 - f / 8) : 0;
      const x0 = Math.min(...lay.words.map(w => w.x)), x1 = Math.max(...lay.words.map(w => w.x + w.w)), cx = (x0 + x1) / 2, cy = (lay.top + lay.bottom) / 2;
      for (let i = 16; i >= 1; i--) if (v > 0.02) for (const w of lay.words) wordAt(S, w, { a: 0.2 * v * (1 - i / 17), sx: z * (1 + i * 0.05 * v), sy: z, cx, cy });
      for (const w of lay.words) wordAt(S, w, { a: clamp(f / 2), sx: z, sy: z, cx, cy, blur: v * 3 * S.u });
    },
  });

  /* key phrase in ink: the line lands in a pale grey (a lesson's body copy) and its key phrase darkens to ink and
     semibold, the only black on the page; without an accent the last two words are the phrase */
  L.def('effect:type-key-phrase-ink', {
    kind: 'type',
    plan(b, F, t0 = 0) { const n = nWords(b), ws = L.wordTimes(n, t0, 0.025, 3); return { words: ws, done: t0 + 0.55, events: [{ at: t0, event: 'word' }, { at: t0 + 0.45, event: 'key-word' }] }; },
    draw(S, o) {
      const lay = o.lay, t0 = o.t0 || 0, has = lay.words.some(w => w.tk.accent), n = lay.words.length, grey = mix(S.P.bg, S.P.fg, 0.3), k = E.out(prog(S.lt, t0 + 0.42, 0.3));
      for (const w of lay.words) {
        const key = has ? w.tk.accent : w.i >= n - 2, a = E.out(prog(S.lt, t0 + w.i * 0.025, 0.3));
        const ww = Object.assign({}, w, { tk: Object.assign({}, w.tk, { accent: false, weight: key && k > 0.5 ? 650 : undefined }), role: 'display' });
        wordAt(S, ww, { a, dy: (1 - a) * 10 * S.u, blur: (o.blur || 0) + (1 - a) * 4 * S.u, fill: key ? mix(grey, S.P.fg, k) : grey });
      }
    },
  });

  /* frosted glass letters: the line is cut from frosted glass (a blurred, lightened copy of what is behind it with a
     top sheen, an accent caustic at the foot, a 1 px rim and a contact shadow); each line rises out of blur */
  L.def('effect:type-frosted-glass-letters', {
    kind: 'type',
    plan(b, F, t0 = 0) { const n = nWords(b), lines = Math.min(3, Math.max(1, Math.ceil(n / 3))); return { words: Array(n).fill(t0), done: t0 + 0.5 + (lines - 1) * 0.1, events: [{ at: t0, event: 'key-word' }] }; },
    draw(S, o) {
      const lay = o.lay, t0 = o.t0 || 0, dark = dk(S);
      for (let li = 0; li < lay.lines; li++) {
        const ws = lay.words.filter(w => w.li === li), k = E.out(prog(S.lt, t0 + li * 0.1, 0.5)); if (k <= 0 || !ws.length) continue;
        const s = ws.map(w => w.s).join(' '), px = ws[0].px;
        S.ctx.save(); if (k < 0.97) S.ctx.filter = `blur(${((1 - k) * 10 * S.u).toFixed(1)}px)`;
        glassWord(S, s, ws[0].x, ws[0].y + (1 - k) * px * 0.4, px, { weight: 750, a: clamp(k * 1.5), dark, solid: !dark, lighten: dark ? 0.2 : 0.12, tintA: dark ? 0.3 : 0.22 });
        S.ctx.restore();
      }
    },
  });

  /* ════════════════════════ transitions ════════════════════════ */
  const tsplit = (o, k) => { const span = (o.pre || 0) + (o.post || 0) || 1, kt = k * span; return { kt, a: clamp(kt / Math.max(1e-6, o.pre || 1e-6)), b: clamp((kt - (o.pre || 0)) / Math.max(1e-6, o.post || 1e-6)) }; };
  const drawAt = (c, A, W, H, s, x = 0, y = 0, ax = 0.5, ay = 0.5) => { c.save(); c.translate(W * ax + x, H * ay + y); c.scale(s, s); c.translate(-W * ax, -H * ay); c.drawImage(A, 0, 0); c.restore(); };
  const fillBg = (S, col) => { S.ctx.fillStyle = col; S.ctx.fillRect(0, 0, S.W, S.H); };

  /* hard cut before the kick: the outgoing shot accelerates (a push and a growing blur), the cut lands about 0.13 s
     before the beat and the new shot is already moving, settling from a 6% push out of a velocity blur */
  L.def('transition:pre-beat-hard-cut', {
    kind: 'transition', plan() { return { pre: 0.13, post: 0.24, events: [{ at: -0.1, event: 'slide-out' }, { at: 0, event: 'scene' }] }; },
    tr(S, A, B, k, o) {
      const c = S.ctx, p = tsplit(o, k);
      if (S.t < o.cut) { const g = p.a * p.a; fillBg(S, (S.PA || S.P).bg); c.save(); if (g > 0.05) c.filter = `blur(${(g * 6 * S.u).toFixed(1)}px)`; drawAt(c, A, S.W, S.H, 1 + 0.04 * g); c.restore(); }
      else { const r = Math.pow(0.84, p.kt * 30 - (o.pre || 0) * 30), s = 1 + 0.06 * r; fillBg(S, S.P.bg); c.save(); if (r > 0.08) c.filter = `blur(${(r * 8 * S.u).toFixed(1)}px)`; drawAt(c, B, S.W, S.H, s, 0, r * 30 * S.u); c.restore(); }
    },
  });

  /* whip tilt through a pale flash: the shot drifts up then whips away with a vertical streak as everything tints
     pale; the next shot arrives smeared from low and settles (420 px, a sixth of the rest a frame), sharpening */
  L.def('transition:whip-tilt-pale-flash', {
    kind: 'transition', plan() { return { pre: 0.3, post: 0.32, events: [{ at: -0.28, event: 'slide-out' }, { at: 0, event: 'scene' }] }; },
    tr(S, A, B, k, o) {
      const c = S.ctx, p = tsplit(o, k), tint = mix(S.look.palette.paper, cyan(S), 0.2);
      if (S.t < o.cut) {
        const g = p.a * p.a, dy = -g * 0.6 * S.H, v = 2 * p.a * 0.6 * S.H / Math.max(0.05, o.pre || 0.3) / 60;
        fillBg(S, tint); c.save(); c.filter = `blur(${Math.min(8, v * 0.3).toFixed(1)}px)`;
        for (let i = 0; i < 8; i++) { c.globalAlpha = 1 / (i + 1); c.drawImage(A, 0, dy + (i / 7 - 0.5) * v * 3); } c.restore();
        c.fillStyle = rgba(tint, 0.75 * clamp((p.a - 0.55) / 0.45)); c.fillRect(0, 0, S.W, S.H);
      } else {
        const f = (p.kt - (o.pre || 0)) * 60, off = (f < 7 ? lerp([420, 315, 210, 170, 140, 116, 96, 81][Math.floor(f)], [420, 315, 210, 170, 140, 116, 96, 81][Math.floor(f) + 1], f % 1) : 81 * Math.pow(0.83, f - 7)) * S.u, bl = f < 6 ? lerp(24, 1.5, f / 6) : Math.max(0, 1.5 - (f - 6) * 0.75);
        fillBg(S, S.P.bg); c.save(); if (bl > 0.3) c.filter = `blur(${(bl * S.u).toFixed(1)}px)`; c.drawImage(B, 0, off); c.restore();
        c.fillStyle = rgba(tint, (dk(S) ? 0.35 : 0.6) * clamp(1 - f / 6)); c.fillRect(0, 0, S.W, S.H);
      }
    },
  });

  /* sheet rises over a softened page: the next shot rises over the outgoing one as a rounded sheet (its corners
     square off as it fills the frame) while the page behind blurs a couple of px and sinks back 4% */
  L.def('transition:sheet-rise-defocus', {
    kind: 'transition', plan() { return { pre: 0.05, post: 0.42, events: [{ at: 0, event: 'card-in' }] }; },
    tr(S, A, B, k, o) {
      const c = S.ctx, p = tsplit(o, k);
      if (S.t < o.cut) { c.drawImage(A, 0, 0); return; }
      const f = p.b, r = Math.pow(0.84, f * (o.post || 0.42) * 30) * (1 - f * 0.1), y = r * S.H * 0.9, rad = (0.06 * M(S)) * clamp(r * 4), s = lerp(1, 0.96, E.out(f));
      fillBg(S, mix((S.PA || S.P).bg, '#000000', 0.06));
      c.save(); c.filter = `blur(${(E.out(f) * 2.5 * S.u).toFixed(1)}px) brightness(${(1 - 0.06 * E.out(f)).toFixed(3)})`; drawAt(c, A, S.W, S.H, s); c.restore();
      c.save(); c.shadowColor = rgba(ink(S), 0.25); c.shadowBlur = 60 * S.u; c.shadowOffsetY = -10 * S.u; L.rr(c, 0, y, S.W, S.H + rad, rad); c.fillStyle = S.P.bg; c.fill(); c.restore();
      c.save(); L.rr(c, 0, y, S.W, S.H + rad, rad); c.clip(); if (r > 0.05) c.filter = `blur(${(r * 3.8 * S.u).toFixed(1)}px)`; c.drawImage(B, 0, y * 0.35); c.restore();
      if (rad > 2) { L.rr(c, S.W / 2 - 0.05 * S.W, y + 0.012 * M(S), 0.1 * S.W, 0.008 * M(S), 0.004 * M(S)); c.fillStyle = rgba(S.P.fg, 0.18 * clamp(r * 4)); c.fill(); }
    },
  });

  /* shrink, rise, blur to the cut: the outgoing shot shrinks 5% and rises while the frame blurs from 1 to 7 px and
     the cut lands at the blur's peak; the next shot rises the last few px out of a blur */
  L.def('transition:shrink-rise-blur-cut', {
    kind: 'transition', plan() { return { pre: 0.22, post: 0.22, events: [{ at: -0.2, event: 'slide-out' }, { at: 0, event: 'card-in' }] }; },
    tr(S, A, B, k, o) {
      const c = S.ctx, p = tsplit(o, k);
      if (S.t < o.cut) { const g = E.in(p.a); fillBg(S, (S.PA || S.P).bg); c.save(); c.filter = `blur(${(lerp(1, 7, g) * S.u).toFixed(1)}px)`; drawAt(c, A, S.W, S.H, 1 - 0.05 * g, 0, -g * 0.05 * S.H); c.restore(); }
      else { const r = Math.pow(0.82, p.b * (o.post || 0.22) * 60); fillBg(S, S.P.bg); c.save(); if (r > 0.06) c.filter = `blur(${(r * 7 * S.u).toFixed(1)}px)`; drawAt(c, B, S.W, S.H, 1 + 0.03 * r, 0, r * 0.06 * S.H); c.restore(); }
    },
  });

  /* push, hold a frame, release into the cut: the outgoing shot pushes 20% toward its last object, holds one frame,
     then pulls back accelerating with a zoom blur; the cut lands mid-release and the next shot settles from 8% */
  L.def('transition:push-hold-release', {
    kind: 'transition', plan() { return { pre: 0.5, post: 0.3, events: [{ at: -0.5, event: 'build' }, { at: -0.04, event: 'click-ui' }, { at: 0, event: 'hard-hit' }] }; },
    tr(S, A, B, k, o) {
      const c = S.ctx, p = tsplit(o, k), f = o.from || {}, ax = f.x != null ? f.x : 0.5, ay = f.y != null ? f.y : 0.5, pre = o.pre || 0.5;
      if (S.t < o.cut) {
        const t = p.kt, inEnd = pre * 0.62, hold = inEnd + 1 / 30, s = t < inEnd ? lerp(1, 1.2, E.io(t / inEnd)) : t < hold ? 1.2 : lerp(1.2, 1.04, E.in(clamp((t - hold) / (pre - hold)))), rel = t > hold ? clamp((t - hold) / (pre - hold)) : 0;
        fillBg(S, (S.PA || S.P).bg); c.save(); if (rel > 0.1) c.filter = `blur(${(rel * rel * 6 * S.u).toFixed(1)}px)`; drawAt(c, A, S.W, S.H, s, 0, 0, ax, ay); c.restore();
      } else { const r = Math.pow(0.84, p.b * (o.post || 0.3) * 30); fillBg(S, S.P.bg); c.save(); if (r > 0.06) c.filter = `blur(${(r * 6 * S.u).toFixed(1)}px)`; drawAt(c, B, S.W, S.H, 1 + 0.08 * r); c.restore(); }
    },
  });

  /* four squares lock into a cross: rounded squares in the accent family spin in counter-clockwise over the outgoing
     shot (which blurs back) and lock into a cross around its last object; after the cut they fly outward and the
     next shot opens through a growing rounded window between them */
  L.def('transition:squares-lock-open', {
    kind: 'transition', plan() { return { pre: 0.36, post: 0.4, events: [{ at: -0.34, event: 'cascade' }, { at: -0.02, event: 'pop' }, { at: 0.02, event: 'hard-hit' }] }; },
    tr(S, A, B, k, o) {
      const c = S.ctx, p = tsplit(o, k), m = M(S), f = S.t < o.cut ? (o.from || {}) : (o.to || {}), cx = (f.x != null ? f.x : 0.5) * S.W, cy = (f.y != null ? f.y : 0.5) * S.H;
      const cols = [mix(S.look.palette.paper, '#FFFFFF', 0.6), acc(S), cyan(S), mint(S)], sq = 0.13 * m;
      const squares = (R, spin, s, a) => { for (let i = 0; i < 4; i++) { const an = -Math.PI / 2 + i * Math.PI / 2 + spin, x = cx + Math.cos(an) * R, y = cy + Math.sin(an) * R; c.save(); c.globalAlpha = a; c.shadowColor = rgba(ink(S), 0.25); c.shadowBlur = 24 * S.u; c.shadowOffsetY = 8 * S.u; L.rr(c, x - s / 2, y - s / 2, s, s, s * 0.28); c.fillStyle = cols[i]; c.fill(); c.restore(); } };
      if (S.t < o.cut) {
        const g = E.out(p.a); fillBg(S, (S.PA || S.P).bg); c.save(); c.filter = `blur(${(g * 10 * S.u).toFixed(1)}px)`; drawAt(c, A, S.W, S.H, 1 - g * 0.04); c.restore();
        c.fillStyle = rgba((S.PA || S.P).bg, 0.35 * g); c.fillRect(0, 0, S.W, S.H);
        squares(lerp(0.75 * m, 0.24 * m, g), (1 - g) * (240 * Math.PI / 180), sq * lerp(0.5, 1, g), clamp(p.a * 4));
      } else {
        const g = E.in(p.b), win = lerp(0.12 * m, Math.hypot(S.W, S.H) * 1.1, E.io(p.b));
        fillBg(S, (S.PA || S.P).bg);
        c.save(); L.rr(c, cx - win / 2, cy - win / 2, win, win, win * 0.27 * (1 - p.b)); c.clip(); c.drawImage(B, 0, 0); c.restore();
        squares(lerp(0.24 * m, 0.95 * m, g), -g * 0.6, sq * (1 + g * 0.6), 1 - g);
      }
    },
  });

  /* ════════════════════════ cameras ════════════════════════ */
  // push in 20% toward the set-up's focus (or the centre), hold one frame, release accelerating to 4% (the click)
  L.def('camera:push-hold-release', {
    kind: 'camera',
    cam(lt, d, o, S) {
      const f = (S && S.b && S.b.data && S.b.data.focus) || { x: 0.45, y: 0.45, w: 0.1, h: 0.1 }, W = S ? S.W : 1920, H = S ? S.H : 1080;
      const a = Math.max(0.2, d * 0.42), pk = a + 0.465, hold = pk + 1 / 30, end = Math.min(d, hold + 0.33);
      const s = lt < a ? 1 + lt * 0.01 : lt < pk ? lerp(1 + a * 0.01, 1.2, E.io(prog(lt, a, pk - a))) : lt < hold ? 1.2 : lerp(1.2, 1.04, E.in(prog(lt, hold, end - hold))) + Math.max(0, lt - end) * 0.01;
      const fx = (f.x + (f.w || 0) / 2 - 0.5) * W, fy = (f.y + (f.h || 0) / 2 - 0.5) * H;
      return { s, x: -fx * (s - 1), y: -fy * (s - 1), r: 0 };
    },
  });
  // enters already moving (a 10% rise and a 4% push covering 14% of the rest per frame), drifts, leaves accelerating
  L.def('camera:enter-moving-exit-accelerating', {
    kind: 'camera',
    cam(lt, d, o, S) { const H = S ? S.H : 1080, r = rest(lt, 0, 0.86), ex = leave(lt, Math.max(0, d - 0.35), 0.35); return { s: 1 + 0.04 * r + ex * 0.06, x: 0, y: r * 0.1 * H - lt * 10 * ((S && S.u) || 1) - ex * 0.08 * H, r: 0 }; },
  });
  // a lateral pan that keeps the action composed, then a drift up that keeps accelerating into the cut
  L.def('camera:pan-then-rise-accelerating', {
    kind: 'camera',
    cam(lt, d, o, S) { const u = (S && S.u) || 1, H = S ? S.H : 1080, pan = E.io(prog(lt, Math.min(0.4, d * 0.15), 0.5)) * 125 * u * ((o && o.dir) || 1), up = leave(lt, Math.max(0, d * 0.62), d * 0.38); return { s: 1.02 + lt * 0.006, x: -pan, y: -up * 0.12 * H, r: 0 }; },
  });

  /* ════════════════════════ textures and overlays ════════════════════════ */

  /* sky with line art: on a dark world the deep navy-to-sky wallpaper with white circles, rules and a sparkle; on a
     light world the same drawing at a whisper, pale sky into the page */
  L.def('texture:sky-line-art', {
    kind: 'texture',
    draw(S) {
      if (dk(S)) { skyArt(S, 0, 0, S.W, S.H, { seed: 21, top: mix(S.P.bg, skyTop(S), 0.7), bot: mix(S.P.bg, skyBot(S), 0.45) }); return; }
      skyArt(S, 0, 0, S.W, S.H, { seed: 21, top: mix(S.P.bg, skyBot(S), 0.5), bot: S.P.bg, glow: cyan(S), lw: 1.2, line: skyTop(S), lineK: 0.55 });
    },
  });
  /* haze clearing to the page: a pale blue haze that clears to the paper over the first second, a blue floor glow */
  L.def('texture:haze-clearing-floor', {
    kind: 'texture',
    draw(S) { const c = S.ctx, k = E.out(prog(S.lt || 0, 0, 0.93)), g = c.createLinearGradient(0, 0, 0, S.H); g.addColorStop(0, mix(haze(S), S.P.bg, lerp(0, 0.85, k))); g.addColorStop(0.6, mix(haze(S), S.P.bg, lerp(0.2, 0.95, k))); g.addColorStop(1, mix(floorC(S), S.P.bg, 0.15)); c.fillStyle = g; c.fillRect(0, 0, S.W, S.H); },
  });
  /* night radial field: a near-black field lifted to graphite around the centre, deep black in the corners */
  L.def('texture:night-vignette-radial', {
    kind: 'texture',
    draw(S) { const c = S.ctx, g = c.createRadialGradient(S.W / 2, S.H * 0.48, 0, S.W / 2, S.H / 2, Math.hypot(S.W, S.H) * 0.55); g.addColorStop(0, nightCore(S)); g.addColorStop(0.6, mix(ink(S), '#000000', 0.3)); g.addColorStop(1, mix(ink(S), '#000000', 0.7)); c.fillStyle = g; c.fillRect(0, 0, S.W, S.H); },
  });
  /* ice ring: a soft ring of icy light blooms around the thing about to be clicked (o.target in frame fractions) */
  L.def('effect:hover-ice-ring', {
    kind: 'overlay',
    draw(S, o) { const t = (o && o.target) || { x: 0.5, y: 0.5 - 0.0, r: 0.1 }, at = (o && o.at) || 0.3; const r = (t.r || 0.1) * M(S) * 1.2; iceRing(S, t.x * S.W, t.y * S.H, r, E.out(prog(S.lt, at, 0.25)) * (0.85 + 0.15 * Math.sin(S.lt * 4))); },
  });
  /* blue floor glow: a faint blue glow rising from the foot of the frame, white things feel lit from below */
  L.def('effect:blue-floor-glow', {
    kind: 'overlay',
    draw(S) { const c = S.ctx, h = S.H * (0.36 + Math.sin((S.t || 0) * 0.8) * 0.02), g = c.createLinearGradient(0, S.H, 0, S.H - h); g.addColorStop(0, rgba(dk(S) ? acc(S) : floorC(S), dk(S) ? 0.22 : 0.85)); g.addColorStop(1, rgba(dk(S) ? acc(S) : floorC(S), 0)); c.save(); c.globalCompositeOperation = dk(S) ? 'screen' : 'multiply'; c.fillStyle = g; c.fillRect(0, S.H - h, S.W, h); c.restore(); },
  });
  /* exit blur ramp: over the beat's last moments the whole frame blurs from 1 to 7 px, accelerating, so the cut
     lands at the blur's peak (the shot never stops) */
  L.def('effect:exit-blur-ramp', {
    kind: 'overlay',
    draw(S, o) { const dur = Math.min((o && o.dur) || 0.3, S.d * 0.25), g = E.in(prog(S.lt, S.d - dur, dur)); if (g > 0) frameBlur(S, lerp(1, 7, g) * S.u); },
  });
})(globalThis.LAUNCH);
