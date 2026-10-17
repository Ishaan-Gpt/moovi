// Launch pack l09: one shape that never cuts. A single rounded shape morphs through product states under a cursor
// (button, loader, tick, island, player, volume, switch, tabs, chart, search, palette, toast) on a warm studio grey
// with a faint dot grid that scales with an invisible fit-to-state camera, so every state fills the frame. Width,
// height, radius and centre each ride their own spring; contents swap with a 0.1 s blur timed apart from the shape;
// a tab marker or a switch knob moves on two springs (leading edge fast, trailing edge slow). Black and white UI,
// one mesh-gradient art tile made from the brand accent is the only colour. Everything re-skins from the palette.
'use strict';
(function (L) {
  const { clamp, lerp, prog, E, rgba, mix, lum, spring, noise } = L;
  const isWide = S => S.W / S.H > 1.3, isTall = S => S.H / S.W > 1.3;
  const dk = S => lum(S.P.bg) < 0.35;
  const toks = b => (b && b.text && b.text.tokens) || [];
  const brand = F => (F && F.brand) || (L.film && L.film.brand) || { name: 'Brand', host: 'brand.com', tagline: '' };
  const itemsOf = b => ((b && b.data && b.data.items) || []).filter(Boolean).map(String);
  const numOf = b => { const n = b && b.data && b.data.number; return n && typeof n.value === 'number' && isFinite(n.value) && n.value > 0 ? n : null; };
  const ctaOf = (b, F) => (b && b.data && b.data.cta) || ('Try ' + brand(F).name);
  const beatOf = F => 60 / ((F && ((F.grid && F.grid.bpm) || F.bpm)) || 120);
  const Bs = S => beatOf(S.F);
  const headToks = (b, F) => { const t = toks(b); if (t.length) return t; const B = brand(F); return String(B.tagline || B.name).split(/\s+/).filter(Boolean).map(s => ({ s })); };
  const fmtNum = (v, dec = 0) => v.toFixed(dec).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const fmtTime = s => { s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const typePlan = (b, F, t0) => { const p = L.get(b && b.type) || L.get('effect:type-mask-rise'); return p && p.plan ? p.plan(b, F, t0) : { done: t0 + 0.6, events: [] }; };

  /* ───────── springs: closed form, one per change (omega, zeta) ───────── */
  const W0 = (w, z = 1) => [2 * z * w, w * w, 1];
  const SP = { morph: W0(24, 0.86), tall: W0(22, 0.7), cam: W0(10, 1), lead: W0(31), trail: W0(15), pop: W0(34, 0.42), soft: W0(16, 0.9), snap: W0(30, 0.62), band: W0(30, 0.45), row: W0(26, 0.92) };
  const sp = (t, kind) => (t <= 0 ? 0 : spring(t, kind));
  function trk(t, keys, kind) { let v = keys[0][1]; for (let i = 1; i < keys.length; i++) v += (keys[i][1] - keys[i - 1][1]) * sp(t - keys[i][0], keys[i][2] || kind || SP.morph); return v; }
  // two edges on separate springs: the leading edge snaps ahead, the trailing edge catches up (a liquid marker)
  function edges(lt, keys, posL, width) {
    let Lx = posL(keys[0][1]), Rx = Lx + width;
    for (let j = 1; j < keys.length; j++) {
      const a = posL(keys[j - 1][1]), b = posL(keys[j][1]), dt = lt - keys[j][0]; if (dt <= 0 || a === b) continue;
      const right = b > a; Lx += (b - a) * spring(dt, right ? SP.trail : SP.lead); Rx += (b - a) * spring(dt, right ? SP.lead : SP.trail);
    }
    return [Lx, Rx];
  }

  /* ───────── colour: ink and white states, a grey track, the accent only in the art tile ───────── */
  // on a dark world the roles swap: the 'ink' states turn white and the 'white' states become a lifted dark card
  const INK = S => (dk(S) ? (S.look.palette.card || '#FFFFFF') : S.look.palette.ink);
  const CARD = S => (dk(S) ? mix(S.look.palette.ink, '#FFFFFF', 0.11) : S.look.palette.card || '#FFFFFF');
  const GREY = S => (dk(S) ? mix(S.look.palette.ink, '#FFFFFF', 0.3) : mix(S.P.bg, S.look.palette.ink, 0.22));
  const fillOf = (S, f) => (f === 'white' ? CARD(S) : f === 'grey' ? GREY(S) : f === 'ink' ? INK(S) : f || INK(S));
  const ON = col => L.onColor(col);
  function hueShift(h, deg, dl = 0) {
    const [r, g, b] = L.hex(h).map(v => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    let hh = 0, s = 0, l = (mx + mn) / 2;
    if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); hh = (mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4) / 6; }
    hh = (((hh + deg / 360) % 1) + 1) % 1; l = clamp(l + dl, 0.12, 0.88); s = Math.max(s, 0.6);
    const f = (p, q, t) => { t = ((t % 1) + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
    const q2 = l < 0.5 ? l * (1 + s) : l + s - l * s, p2 = 2 * l - q2;
    return L.toHex([f(p2, q2, hh + 1 / 3), f(p2, q2, hh), f(p2, q2, hh - 1 / 3)].map(v => v * 255));
  }
  // the one spot of colour: a soft mesh-gradient tile made from the brand accent (warm above, cool below), drifting
  function artTile(S, c, x, y, s, r, t, o = {}) {
    const acc = S.look.accent, a = hueShift(acc, 30, 0.1), z = hueShift(acc, -80, -0.02), m2 = hueShift(acc, -25, 0.04);
    c.save(); L.rr(c, x, y, s, s, r); c.clip();
    const g = c.createLinearGradient(x, y, x + s * 0.4, y + s); g.addColorStop(0, a); g.addColorStop(0.5, acc); g.addColorStop(1, z); c.fillStyle = g; c.fillRect(x, y, s, s);
    const blob = (bx, by, br, col, al) => { const rg = c.createRadialGradient(bx, by, 0, bx, by, br); rg.addColorStop(0, rgba(col, al)); rg.addColorStop(1, rgba(col, 0)); c.fillStyle = rg; c.fillRect(x, y, s, s); };
    blob(x + s * (0.22 + 0.08 * Math.sin(t * 0.9)), y + s * (0.18 + 0.06 * Math.cos(t * 0.7)), s * 0.72, a, 0.95);
    blob(x + s * (0.82 + 0.06 * Math.cos(t * 0.8)), y + s * 0.98, s * 0.8, z, 0.9);
    blob(x + s * (0.5 + 0.05 * Math.sin(t * 1.1)), y + s * 0.55, s * 0.45, m2, 0.4);
    const sh = c.createLinearGradient(0, y, 0, y + s); sh.addColorStop(0, 'rgba(255,255,255,0.2)'); sh.addColorStop(0.45, 'rgba(255,255,255,0)'); c.fillStyle = sh; c.fillRect(x, y, s, s);
    if (o.letter) L.text(c, S.look, o.letter, x + s / 2, y + s * 0.69, { role: 'wordmark', px: s * 0.56, color: '#FFFFFF', align: 'center', weight: 700 });
    c.restore();
  }
  // a mark tile: the real logo on white when the site gave one, else the art tile with the brand's initial
  function markTile(S, c, x, y, s, r, t) {
    const logo = L.img && L.img('logo');
    if (logo) { L.rr(c, x, y, s, s, r); c.fillStyle = '#FFFFFF'; c.fill(); const m = s * 0.16, k = Math.min((s - 2 * m) / logo.width, (s - 2 * m) / logo.height); c.drawImage(logo, x + s / 2 - logo.width * k / 2, y + s / 2 - logo.height * k / 2, logo.width * k, logo.height * k); return; }
    artTile(S, c, x, y, s, r, t, { letter: (brand(S.F).name || 'B').slice(0, 1).toUpperCase() });
  }

  /* ───────── small drawing helpers (design units: the reference's 1440 px frame) ───────── */
  const T = (c, S, s, x, y, px, o = {}) => L.text(c, S.look, s, x, y, Object.assign({ role: 'ui', px, weight: 600, tracking: -0.01 }, o));
  const TW = (c, S, s, px, o = {}) => L.textW(c, S.look, s, Object.assign({ role: 'ui', px, weight: 600, tracking: -0.01 }, o));
  // an element arriving inside a shape: unblurs from 8 px, rises 6 px (start, duration in seconds of the state)
  function el(c, lt, t0, fn, dur = 0.14) {
    const k = prog(lt, t0, dur); if (k <= 0) return; const e = E.out(k);
    c.save(); c.globalAlpha *= clamp(k * 1.6); const bl = (1 - e) * 8; if (bl > 0.4) c.filter = `blur(${bl.toFixed(1)}px)`; c.translate(0, (1 - e) * 6); fn(); c.restore();
  }
  function fx(c, a, blur, s, fn) { if (a <= 0.003) return; c.save(); c.globalAlpha *= clamp(a); if (blur > 0.35) c.filter = `blur(${blur.toFixed(1)}px)`; if (s !== 1) c.scale(s, s); fn(); c.restore(); }
  function tick(c, x, y, s, k, col, lw) {
    k = E.out(clamp(k)); if (k <= 0) return;
    const p = [[x - s * 0.34, y + s * 0.02], [x - s * 0.1, y + s * 0.27], [x + s * 0.36, y - s * 0.24]];
    const l1 = Math.hypot(p[1][0] - p[0][0], p[1][1] - p[0][1]), l2 = Math.hypot(p[2][0] - p[1][0], p[2][1] - p[1][1]), d = (l1 + l2) * k;
    c.save(); c.strokeStyle = col; c.lineWidth = lw; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); c.moveTo(p[0][0], p[0][1]);
    if (d <= l1) c.lineTo(lerp(p[0][0], p[1][0], d / l1), lerp(p[0][1], p[1][1], d / l1));
    else { c.lineTo(p[1][0], p[1][1]); const f = (d - l1) / l2; c.lineTo(lerp(p[1][0], p[2][0], f), lerp(p[1][1], p[2][1], f)); }
    c.stroke(); c.restore();
  }
  function bars(c, xr, y, h, t, col, n = 5) {
    const bw = h * 0.055, gap = h * 0.05; c.fillStyle = col;
    for (let i = 0; i < n; i++) {
      const a = 0.5 + 0.5 * Math.sin(t * Math.PI * 2 * (1.5 + i * 0.45) + i * 1.7), b2 = 0.5 + 0.5 * Math.sin(t * Math.PI * 2 * (0.9 + i * 0.3) + i * 2.3);
      const bh = h * (0.14 + 0.32 * a * (0.55 + 0.45 * b2)), x = xr - (n - i) * (bw + gap) + gap;
      L.rr(c, x, y - bh / 2, bw, bh, bw / 2); c.fill();
    }
    return n * (bw + gap);
  }
  function keycap(c, S, x, y, s, ink, px = 24) {
    const tw = Math.max(px * 1.7, TW(c, S, s, px, { role: 'micro', weight: 500, tracking: 0 }) + px * 1.1);
    L.rr(c, x - tw / 2, y - px * 0.85, tw, px * 1.7, px * 0.42); c.fillStyle = rgba(ink, 0.05); c.fill(); c.strokeStyle = rgba(ink, 0.13); c.lineWidth = 2; c.stroke();
    T(c, S, s, x, y + px * 0.36, px, { role: 'micro', weight: 500, color: rgba(ink, 0.55), align: 'center', tracking: 0 });
    return tw;
  }
  function speaker(c, x, y, s, col, v) {
    c.save(); c.fillStyle = col; c.beginPath();
    c.moveTo(x - s * 0.42, y - s * 0.15); c.lineTo(x - s * 0.22, y - s * 0.15); c.lineTo(x + s * 0.04, y - s * 0.4); c.lineTo(x + s * 0.04, y + s * 0.4); c.lineTo(x - s * 0.22, y + s * 0.15); c.lineTo(x - s * 0.42, y + s * 0.15); c.closePath();
    c.lineJoin = 'round'; c.strokeStyle = col; c.lineWidth = s * 0.06; c.fill(); c.stroke();
    c.lineCap = 'round'; c.lineWidth = s * 0.085;
    [0.01, 0.34, 0.67].forEach((th, i) => { const a = clamp((v - th) / 0.07); if (a <= 0) return; c.globalAlpha = a; c.beginPath(); c.arc(x + s * 0.06, y, s * (0.22 + i * 0.19), -0.75, 0.75); c.stroke(); });
    if (v < 0.01) { c.globalAlpha = 1; c.beginPath(); c.moveTo(x + s * 0.2, y - s * 0.15); c.lineTo(x + s * 0.5, y + s * 0.15); c.moveTo(x + s * 0.5, y - s * 0.15); c.lineTo(x + s * 0.2, y + s * 0.15); c.stroke(); }
    c.restore();
  }
  // play ↔ pause as two quads whose vertices lerp
  function playPause(c, x, y, s, k, col) {
    const PL = [[[-0.36, -0.5], [0.07, -0.25], [0.07, 0.25], [-0.36, 0.5]], [[0.07, -0.25], [0.5, 0], [0.5, 0], [0.07, 0.25]]];
    const PA = [[[-0.42, -0.5], [-0.12, -0.5], [-0.12, 0.5], [-0.42, 0.5]], [[0.12, -0.5], [0.42, -0.5], [0.42, 0.5], [0.12, 0.5]]];
    c.save(); c.fillStyle = col; c.strokeStyle = col; c.lineJoin = 'round'; c.lineWidth = s * 0.08;
    for (let q = 0; q < 2; q++) { c.beginPath(); for (let i = 0; i < 4; i++) { const px = x + lerp(PL[q][i][0], PA[q][i][0], k) * s, py = y + lerp(PL[q][i][1], PA[q][i][1], k) * s; if (i) c.lineTo(px, py); else c.moveTo(px, py); } c.closePath(); c.fill(); c.stroke(); }
    c.restore();
  }
  function skip(c, x, y, s, dir, col) {
    c.save(); c.fillStyle = col; c.translate(x, y); c.scale(dir, 1);
    for (let i = 0; i < 2; i++) { c.beginPath(); c.moveTo(-s * 0.45 + i * s * 0.42, -s * 0.36); c.lineTo(-s * 0.03 + i * s * 0.42, 0); c.lineTo(-s * 0.45 + i * s * 0.42, s * 0.36); c.closePath(); c.fill(); }
    c.fillRect(s * 0.4, -s * 0.36, s * 0.1, s * 0.72); c.restore();
  }
  function smoothPath(c, pts) {
    c.moveTo(pts[0][0], pts[0][1]);
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      c.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
    }
  }
  function series(seed, kind, n = 24) {
    return Array.from({ length: n }, (_, i) => {
      const x = i / (n - 1);
      if (kind === 'up') return clamp(0.12 + 0.7 * Math.pow(x, 1.25) + 0.055 * Math.sin(i * 1.35 + seed) + 0.03 * noise(i * 0.7, seed), 0.04, 0.96);
      return clamp(0.44 + 0.1 * Math.sin(i * 0.95 + seed) + 0.07 * Math.sin(i * 0.37 + seed * 2) + 0.04 * noise(i * 0.8, seed + 3), 0.05, 0.95);
    });
  }
  // digits that roll like an odometer, in fixed (tabular) slots
  function odo(c, S, v, n, x, y, px, col, o = {}) {
    const dec = n.dec != null ? n.dec : Number.isInteger(n.value) ? 0 : 1, sc = Math.pow(10, dec), V = Math.max(0, v * sc), tgt = Math.max(1, Math.round(n.value * sc));
    const nd = Math.max(dec + 1, String(tgt).length), role = o.role || 'numeral';
    L.setFont(c, S.look, role, px, o.weight || 600); try { c.letterSpacing = '0px'; } catch (e) { /* */ }
    const dw = c.measureText('0').width * 0.9, cw = c.measureText(',').width, pw = c.measureText('.').width;
    const roll = i => (i === 0 ? V % 1 : clamp((V % Math.pow(10, i)) - (Math.pow(10, i) - 1)));
    let top = nd - 1; while (top > dec && Math.floor(V / Math.pow(10, top)) === 0 && !(roll(top) > 0)) top--;
    const pre = n.prefix || '', suf = n.suffix || '', spx = px * (suf.length > 2 ? 0.42 : 0.62);
    const preW = pre ? c.measureText(pre).width : 0; L.setFont(c, S.look, role, spx, o.weight || 600); const sufW = suf ? c.measureText(suf).width + px * 0.06 : 0; L.setFont(c, S.look, role, px, o.weight || 600);
    let total = preW + sufW; for (let i = top; i >= 0; i--) { total += dw; if (dec && i === dec) total += pw; else if (i > dec && (i - dec) % 3 === 0) total += cw; }
    let xx = o.align === 'center' ? x - total / 2 : o.align === 'right' ? x - total : x;
    c.fillStyle = col; c.textBaseline = 'alphabetic'; c.textAlign = 'left';
    if (pre) { c.fillText(pre, xx, y); xx += preW; }
    for (let i = top; i >= 0; i--) {
      const whole = Math.floor(V / Math.pow(10, i)), d = whole % 10, f = roll(i), lead = whole === 0 && i > dec;
      c.save(); c.beginPath(); c.rect(xx - 2, y - px * 0.95, dw + 4, px * 1.2); c.clip();
      c.textAlign = 'center'; if (!lead) c.fillText(String(d), xx + dw / 2, y - f * px * 1.05);
      if (f > 0) c.fillText(String((d + 1) % 10), xx + dw / 2, y + (1 - f) * px * 1.05);
      c.restore(); c.textAlign = 'left'; xx += dw;
      if (dec && i === dec) { c.fillText('.', xx, y); xx += pw; } else if (i > dec && (i - dec) % 3 === 0) { c.fillText(',', xx, y); xx += cw; }
    }
    if (suf) { L.setFont(c, S.look, role, spx, o.weight || 600); c.fillText(suf, xx + px * 0.06, y); }
    return total;
  }
  const onInk = (S, col) => { const dark = lum(col) < 0.4; const P = Object.assign({}, S.P, { fg: ON(col), dim: rgba(ON(col), 0.55), accent: L.palette(S.look, dark ? 'ink' : 'paper').accent }); return Object.assign({}, S, { P }); };

  /* ───────── the stage: one shape, its springs, the fit-to-state camera, the scaling dot grid, the cursor ───────── */
  function studio(S, cx, cy) {
    const c = S.ctx, R = Math.hypot(S.W, S.H) * 0.62, g = c.createRadialGradient(cx, cy, 0, cx, cy, R);
    g.addColorStop(0, dk(S) ? rgba(S.P.fg, 0.05) : 'rgba(255,255,255,0.34)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, S.W, S.H);
  }
  // a dot lattice whose pitch rides the camera; when it doubles, every other dot fades so the zoom is felt, never seen
  function grid(S, cx, cy, k) {
    const c = S.ctx, base = 30 * S.u; let g = 44 * k; if (!(g > 0)) return;
    while (g < base) g *= 2; while (g >= base * 2) g /= 2;
    const f = Math.log2(g / base), a0 = dk(S) ? 0.1 : 0.13, R = Math.hypot(S.W, S.H) * 0.5, rd = 1.5 * S.u;
    const nx0 = Math.ceil(cx / g) + 1, nx1 = Math.ceil((S.W - cx) / g) + 1, ny0 = Math.ceil(cy / g) + 1, ny1 = Math.ceil((S.H - cy) / g) + 1;
    c.save(); c.fillStyle = S.P.fg;
    for (let jy = -ny0; jy <= ny1; jy++) for (let ix = -nx0; ix <= nx1; ix++) {
      const x = cx + ix * g, y = cy + jy * g, even = ix % 2 === 0 && jy % 2 === 0, fall = 1 - L.smooth(Math.hypot(x - cx, y - cy) / R);
      const a = (even ? 1 : f) * a0 * (0.25 + 0.75 * fall); if (a < 0.006) continue;
      c.globalAlpha = a; c.beginPath(); c.arc(x, y, rd, 0, Math.PI * 2); c.fill();
    }
    c.restore();
  }
  const body = (S, c, x, y, w, h, r, col, lift = 1) => L.card(c, x, y, w, h, r, { fill: col, u: S.u, lift, shadow: rgba(S.look.palette.ink, lum(col) < 0.4 ? 0.2 : 0.12), shadow2: rgba(S.look.palette.ink, 0.08) });

  // M = { states: [{at, w, h, r?, ox?, oy?, fill, draw?, raw?, same?, delay?, sp?, sph?, fw?, fh?, zw?, zh?}], stage, clicks,
  //       cursor: [[t, x, y]] | fn(t)→{x,y}, mod(t)→{dw, dox}, t0, grid, noArrive }
  function run(S, M) {
    const c = S.ctx, st = M.states, lt = S.lt - (M.t0 || 0), q = Math.min(S.W, S.H) / 1440;
    if (lt < 0) return null;
    let i = 0; while (i < st.length - 1 && lt >= st[i + 1].at) i++;
    const tk = (f, kind, key) => trk(lt, st.map(s => [s.at, f(s), (key && s[key]) || s.sp || kind]), kind);
    let w = tk(s => s.w, SP.morph, 'spw'), h = tk(s => s.h, SP.morph, 'sph');
    const rr0 = tk(s => (s.r != null ? s.r : Math.min(s.w, s.h) / 2), SP.morph, 'sph');
    const camX = tk(s => s.ox || 0, SP.morph), camY = tk(s => s.oy || 0, SP.morph, 'sph');
    let ox = camX, oy = camY;
    const md = M.mod ? M.mod(lt) : null; if (md) { w += md.dw || 0; h += md.dh || 0; ox += md.dox || 0; oy += md.doy || 0; }
    w = Math.max(4, w); h = Math.max(4, h);
    const r = Math.max(0, Math.min(rr0, w / 2, h / 2));
    const stg = M.stage || { x: 0, y: 0, w: S.W, h: S.H }, cx = stg.x + stg.w / 2, cy = stg.y + stg.h / 2;
    const fm = M.fill || 1, zOf = s => clamp(Math.min(stg.w * Math.min(0.95, (s.fw || 0.8) * fm) / ((s.zw || s.w) * q), stg.h * Math.min(0.92, (s.fh || 0.72) * fm) / ((s.zh || s.h) * q)), 0.25, 6);
    const z = trk(lt, st.map(s => [s.at - 0.03, zOf(s), SP.cam])) * (1 + 0.03 * clamp(lt / Math.max(1, S.d)));
    const arr = M.noArrive ? 1 : lerp(0.84, 1, sp(lt + 0.02, SP.snap)), alpha = M.noArrive ? 1 : clamp((lt + 0.02) / 0.1);
    const pr = L.pressAt(M.clicks || [], lt).p, k = z * q * arr * (1 - 0.016 * pr);
    const fills = []; st.forEach((s, j) => fills.push(s.fill ? fillOf(S, s.fill) : fills[j - 1] || INK(S)));
    const col = i ? mix(fills[i - 1], fills[i], E.io(prog(lt, st[i].at, 0.22))) : fills[0];
    if (M.grid !== false) { studio(S, cx, cy); grid(S, cx, cy, z * q); }
    c.save(); c.globalAlpha *= alpha; c.translate(cx, cy); c.scale(k, k); c.translate(-camX, -camY);
    if (!M.bare) body(S, c, ox - w / 2, oy - h / 2, w, h, r, col, M.lift);
    // contents: a segment per non-'same' state; blur out 0.1 s at the next segment, blur in after its own delay
    const seg = []; st.forEach((s, j) => { if (!(j && s.same)) seg.push(j); });
    for (let si = 0; si < seg.length; si++) {
      const j = seg[si], s = st[j], nx = seg[si + 1] != null ? st[seg[si + 1]].at : 1e9;
      if (!s.draw || lt < s.at || lt > nx + 0.12) continue;
      const tin = s.at + (s.delay != null ? s.delay : 0.06);
      if (!s.raw && lt < tin) continue;
      const kin = s.raw ? 1 : E.out(prog(lt, tin, 0.12)), kout = E.in(prog(lt, nx - (s.lead != null ? s.lead : 0.02), 0.1));
      const a = kin * (1 - kout); if (a <= 0.003) continue;
      const bl = s.raw ? kout * 10 : (1 - kin) * 8 + kout * 10, scl = (s.raw ? 1 : lerp(0.96, 1, kin)) * lerp(1, 0.985, kout);
      c.save();
      if (!s.noClip) { L.rr(c, ox - w / 2, oy - h / 2, w, h, r); c.clip(); }
      c.translate(s.ox || 0, s.oy || 0);
      fx(c, a, bl, scl, () => s.draw({ c, S, w: s.w, h: s.h, cw: w, ch: h, dx: ox - (s.ox || 0), dy: oy - (s.oy || 0), lt: lt - s.at, LT: lt, col, k, at: s.at + (M.t0 || 0) }));
      c.restore();
    }
    c.restore();
    if (M.cursor) {
      const cf = typeof M.cursor === 'function' ? M.cursor : t => L.cursorAt(M.cursor, t);
      const t0c = M.cursorIn != null ? M.cursorIn : Array.isArray(M.cursor) ? M.cursor[0][0] : 0;
      const ca = clamp((lt - t0c + 0.25) / 0.25) * (M.cursorOut != null ? 1 - clamp((lt - M.cursorOut) / 0.25) : 1), p = cf(lt);
      if (p && ca > 0) {
        const sx = cx + (p.x - camX) * k, sy = cy + (p.y - camY) * k;
        const inside = Math.abs(p.x - ox) < w / 2 - 6 && Math.abs(p.y - oy) < h / 2 - 6, surfDark = inside ? lum(col) < 0.4 : dk(S);
        const v = L.vel(t => { const pp = cf(t); return pp ? pp.x * k : 0; }, lt);
        c.save(); c.globalAlpha *= ca * alpha; L.drawCursor(c, sx, sy, { u: S.u * 1.25, press: L.pressAt(M.clicks || [], lt).p, dark: surfDark, blur: L.shutter(v, 6) * 0.3 }); c.restore();
      }
    }
    return { k, cx, cy, ox, oy, w, h, col, lt };
  }

  /* ───────── state contents (centred on the state; sizes in the reference's px) ───────── */
  const D = {};
  D.label = (txt, px = 54) => d => T(d.c, d.S, txt, 0, px * 0.36, px, { color: ON(d.col), align: 'center', maxW: d.w * 0.84 });
  D.loader = (doneIn = 1e9) => d => {
    const { c, lt, h } = d, col = ON(d.col), R = h * 0.25, lw = h * 0.072, fin = E.out(prog(lt, 0, 0.1)), ret = E.in(prog(lt, doneIn, 0.1));
    if (ret < 1) {
      const rot = lt * 1.6 * Math.PI * 2, len = Math.PI * 1.5 * (1 - ret);
      c.save(); c.globalAlpha *= fin; c.strokeStyle = rgba(col, 0.16); c.lineWidth = lw; c.beginPath(); c.arc(0, 0, R, 0, Math.PI * 2); c.stroke();
      c.strokeStyle = col; c.lineCap = 'round'; c.beginPath(); c.arc(0, 0, R, rot + Math.PI * 1.5 * ret, rot + Math.PI * 1.5 * ret + Math.max(0.001, len)); c.stroke(); c.restore();
    }
    if (lt >= doneIn + 0.04) tick(c, 0, 0, h * 0.46, prog(lt, doneIn + 0.04, 0.12), col, h * 0.075);
  };
  D.island = (o = {}) => d => {
    const { c, S, w, h, lt } = d, col = ON(d.col), pad = h * 0.19, ts = h - pad * 2;
    el(c, lt, 0.02, () => (o.mark ? markTile(S, c, -w / 2 + pad, -ts / 2, ts, ts * 0.26, d.LT) : artTile(S, c, -w / 2 + pad, -ts / 2, ts, ts * 0.26, d.LT)));
    if (o.label) el(c, lt, 0.07, () => T(c, S, o.label, -w / 2 + pad + ts + h * 0.16, h * 0.072, h * 0.2, { color: rgba(col, 0.9), maxW: w - ts - pad * 2 - h * 1.1 }));
    if (o.word) el(c, lt, 0.07, () => T(c, S, o.word, -w / 2 + pad + ts + h * 0.2, o.wordPx * 0.36, o.wordPx, { role: 'wordmark', color: col, maxW: w - ts - pad * 2 - h * 1.1 }));
    if (o.num) el(c, lt, 0.07, () => { const x = -w / 2 + pad + ts + h * 0.2, v = o.num.value * lerp(0.78, 1, E.out(prog(d.LT, o.countAt, 0.75))); const nw = odo(c, S, v, o.num, x, h * 0.15, o.numPx, col); if (o.num.label) T(c, S, o.num.label, x + nw + h * 0.12, h * 0.15, h * 0.13, { weight: 500, color: rgba(col, 0.5), maxW: o.labelW }); });
    el(c, lt, 0.12, () => bars(c, w / 2 - pad * 1.1, 0, h, d.LT, col));
  };
  D.player = o => d => {
    const { c, S, w, h, lt } = d, col = ON(d.col), pad = 58, ts = 170, x0 = -w / 2 + pad, y0 = -h / 2 + pad, LT = d.LT;
    el(c, lt, 0.02, () => artTile(S, c, x0, y0, ts, 36, LT));
    el(c, lt, 0.07, () => {
      const tx = x0 + ts + 36, mw = w - pad * 2 - ts - 36, tk = String(o.title).split(/\s+/).map(s => ({ s }));
      const lay = L.layout(c, S.look, tk, { role: 'display', px: 48, maxW: mw, x: tx, y: y0 + 30, align: 'left', maxLines: 2, lineH: 1.08 });
      for (const wd of lay.words) L.drawWord(c, S.look, S.P, wd, { color: col });
      if (o.sub) T(c, S, o.sub, tx, lay.bottom + 34, 28, { weight: 500, color: rgba(col, 0.5), maxW: mw });
    });
    const p = clamp(o.prog ? o.prog(LT) : 0.3), ty = 72, tx0 = x0, tx1 = w / 2 - pad, kn = o.knob ? o.knob(LT) : 0;
    el(c, lt, 0.12, () => {
      L.rr(c, tx0, ty - 5, tx1 - tx0, 10, 5); c.fillStyle = rgba(col, 0.18); c.fill();
      L.rr(c, tx0, ty - 5, Math.max(10, (tx1 - tx0) * p), 10, 5); c.fillStyle = col; c.fill();
      if (kn > 0) L.circle(c, tx0 + (tx1 - tx0) * p, ty, 17 * kn, col);
      const dur = o.dur || 196;
      T(c, S, fmtTime(p * dur), tx0, ty + 50, 24, { role: 'micro', weight: 500, color: rgba(col, 0.48), tracking: 0.02 });
      T(c, S, '-' + fmtTime((1 - p) * dur), tx1, ty + 50, 24, { role: 'micro', weight: 500, color: rgba(col, 0.48), align: 'right', tracking: 0.02 });
    });
    el(c, lt, 0.17, () => { const cy = h / 2 - 96; skip(c, -150, cy, 40, -1, col); playPause(c, 0, cy, 50, o.play ? clamp(o.play(LT)) : 0, col); skip(c, 150, cy, 40, 1, col); });
  };
  // the volume pill: its far end stretches with the drag (rubber band) while the near end stays put
  D.volume = o => d => {
    const { c, lt } = d, col = ON(d.col), w = d.cw, v = clamp(o.val(d.LT));
    c.save(); c.translate(d.dx, 0);
    const tx0 = -w / 2 + 178, tx1 = w / 2 - 74, th = 22;
    el(c, lt, 0.02, () => speaker(c, -w / 2 + 96, 0, 66, col, v));
    el(c, lt, 0.06, () => { L.rr(c, tx0, -th / 2, tx1 - tx0, th, th / 2); c.fillStyle = rgba(col, 0.2); c.fill(); L.rr(c, tx0, -th / 2, Math.max(th, (tx1 - tx0) * v), th, th / 2); c.fillStyle = col; c.fill(); });
    c.restore();
  };
  D.sw = o => d => {
    const { c, S, w, h, lt } = d, kh = h * 0.76, pad = (h - kh) / 2, x0 = -w / 2 + pad, x1 = w / 2 - pad - kh;
    const [Lx, Rx] = edges(d.LT, o.flips, s => (s ? x1 : x0), kh), m = clamp(((Lx + Rx) / 2 - (x0 + kh / 2)) / (x1 - x0));
    c.fillStyle = mix(GREY(S), INK(S), m); c.fillRect(-w / 2 - 2, -h / 2 - 2, w + 4, h + 4);
    const bk = E.outBack(prog(lt, 0.06, 0.24)); if (bk <= 0) return;
    const kx = (Lx + Rx) / 2; c.save(); c.translate(kx, 0); c.scale(bk, bk); c.translate(-kx, 0);
    L.card(c, Lx, -kh / 2, Rx - Lx, kh, kh / 2, { fill: CARD(S), u: S.u, lift: 0.6, shadow: rgba(S.look.palette.ink, 0.22), stroke: false });
    c.restore();
  };
  function segTabs(c, S, cx, cy, w, h, labels, sel, LT, px, o = {}) {
    const n = labels.length, pad = o.pad != null ? o.pad : 14, sw = (w - pad * 2) / n, posL = i => cx - w / 2 + pad + i * sw;
    const [Lx, Rx] = edges(LT, sel, posL, sw), mh = h - pad * 2, ink = o.ink, ml = INK(S);
    const lab = colr => labels.forEach((s, i) => T(c, S, s, posL(i) + sw / 2, cy + px * 0.36, px, { color: colr, align: 'center', weight: 500, maxW: sw - px }));
    lab(rgba(ink, 0.45));
    L.card(c, Lx, cy - mh / 2, Rx - Lx, mh, mh / 2, { fill: ml, u: S.u, lift: 0.35, shadow: rgba(S.look.palette.ink, 0.18), stroke: false });
    c.save(); L.rr(c, Lx, cy - mh / 2, Rx - Lx, mh, mh / 2); c.clip(); lab(ON(ml)); c.restore();
  }
  D.tabs = o => d => { const { c, S, w, h, lt } = d; el(c, lt, 0.02, () => segTabs(c, S, 0, 0, w, h, o.labels, o.sel, d.LT, o.px || 40, { ink: ON(d.col) })); };
  D.chart = o => d => {
    const { c, S, w, h, lt } = d, ink = ON(d.col), pad = 66, LT = d.LT, top = -h / 2;
    const tw = Math.min(620, w * 0.56), thh = 84;
    el(c, lt, 0.02, () => segTabs(c, S, w / 2 - pad - tw / 2 + 14, top + 40 + thh / 2, tw, thh, o.labels, o.sel, LT, 31, { ink, pad: 10 }));
    el(c, lt, 0.07, () => {
      if (o.num) { const v = o.num.value * lerp(0.8, 1, E.out(prog(LT, o.countAt, 0.6))) * (o.numK ? o.numK(LT) : 1); odo(c, S, v, o.num, -w / 2 + pad, top + 236, 108, ink); }
      else T(c, S, o.title || '', -w / 2 + pad, top + 210, 60, { color: ink, maxW: w * 0.55, weight: 650 });
      const lab = (o.num && o.num.label) || o.sub || ''; if (lab) T(c, S, lab, -w / 2 + pad + 4, top + 288, 30, { weight: 500, color: rgba(ink, 0.5), maxW: w * 0.6 });
    });
    const ax0 = -w / 2 + pad, ax1 = w / 2 - pad, ay0 = top + 360, ay1 = h / 2 - 76;
    el(c, lt, 0.1, () => {
      for (let g = 0; g < 3; g++) { const y = lerp(ay0, ay1, g / 2); L.line(c, ax0, y, ax1, y, rgba(ink, 0.08), 2, [8, 10]); }
      const A = o.series[0], Bq = o.series[1] || A, mk = o.morphAt != null ? (t => t) : null;
      const pts = A.map((a, i) => { const m = o.morphAt != null ? sp(LT - o.morphAt - i * 0.008, SP.morph) : 0; const y = lerp(a, Bq[i], m); return [lerp(ax0, ax1, i / (A.length - 1)), lerp(ay1, ay0 + 10, y)]; }); void mk;
      const p = E.out(prog(LT, o.drawAt, 0.5)), xc = lerp(ax0, ax1, p); if (p <= 0) return;
      c.save(); c.beginPath(); c.rect(ax0 - 10, ay0 - 60, xc - ax0 + 10, ay1 - ay0 + 80); c.clip();
      const g2 = c.createLinearGradient(0, ay0, 0, ay1); g2.addColorStop(0, rgba(ink, 0.12)); g2.addColorStop(1, rgba(ink, 0)); c.beginPath(); smoothPath(c, pts); c.lineTo(ax1, ay1); c.lineTo(ax0, ay1); c.closePath(); c.fillStyle = g2; c.fill();
      c.beginPath(); smoothPath(c, pts); c.strokeStyle = ink; c.lineWidth = 6; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke(); c.restore();
      const yAt = x => { const f = clamp((x - ax0) / (ax1 - ax0)) * (pts.length - 1), i0 = Math.min(pts.length - 2, Math.floor(f)); return lerp(pts[i0][1], pts[i0 + 1][1], f - i0); };
      if (p < 1) L.circle(c, xc, yAt(xc), 9, ink);
      const tip = o.tip && o.tip(LT);
      if (tip && tip.a > 0.01) {
        const X = lerp(ax0, ax1, clamp(tip.x)), Y = yAt(X);
        c.save(); c.globalAlpha *= tip.a; L.line(c, X, Y, X, ay1, rgba(ink, 0.3), 2.5, [7, 7]);
        L.circle(c, X, Y, 15, CARD(S)); L.circle(c, X, Y, 10, ink);
        const val = o.num ? fmtNum(o.num.value * (lerp(ay1, ay0 + 10, 0) - Y) / Math.max(1, lerp(ay1, ay0 + 10, 0) - pts[pts.length - 1][1]), 0) : fmtTime(clamp(tip.x) * 600);
        const tpx = 28, tw2 = TW(c, S, val, tpx, { role: 'micro', weight: 500, tracking: 0 }) + 36, bx = clamp(X - tw2 / 2, ax0 - 20, ax1 + 20 - tw2), by = Y - 92;
        L.card(c, bx, by, tw2, 54, 16, { fill: INK(S), u: S.u, lift: 0.4, shadow: rgba(S.look.palette.ink, 0.2), stroke: false });
        T(c, S, val, bx + tw2 / 2, by + 37, tpx, { role: 'micro', weight: 500, color: ON(INK(S)), align: 'center', tracking: 0 });
        c.restore();
      }
    });
  };
  D.search = o => d => {
    const { c, S, w, lt } = d, ink = ON(d.col);
    el(c, lt, 0.02, () => L.icon(c, 'search', -w / 2 + 74, 0, 44, ink, 2.3));
    el(c, lt, 0.05, () => T(c, S, o.ph, -w / 2 + 124, 15, 40, { color: rgba(ink, 0.42), weight: 500, maxW: w - 300 }));
    el(c, lt, 0.08, () => keycap(c, S, w / 2 - 78, 0, 'K', ink, 26));
  };
  // the command palette model: characters typed at a steady pace filter the rows; rows spring to their new index
  function palModel(items, t0, query, enterAt, cps = 0.11) {
    const times = query.split('').map((_, i) => t0 + i * cps), match = (s, qq) => !qq || s.toLowerCase().includes(qq.toLowerCase());
    const idxK = items.map(() => []), visK = items.map(() => []), counts = [];
    for (let kq = 0; kq <= query.length; kq++) {
      const t = kq ? times[kq - 1] : -1, qq = query.slice(0, kq); let n = 0;
      items.forEach((s, i) => { const v = match(s, qq); const prev = idxK[i].length ? idxK[i][idxK[i].length - 1][1] : i; idxK[i].push([t, v ? n : prev, SP.row]); visK[i].push([t, v ? 1 : 0]); if (v) n++; });
      counts.push([t, Math.max(1, n)]);
    }
    const target = items.findIndex(s => match(s, query)), finalIdx = target >= 0 ? idxK[target][idxK[target].length - 1][1] : 0, last = times.length ? times[times.length - 1] : t0;
    const hlAt = enterAt != null ? Math.max(last + 0.15, enterAt - 0.35) : 1e9;
    return {
      times, counts, target, last,
      typed: lt => query.slice(0, times.filter(t => t <= lt).length),
      rows: lt => items.map((s, i) => { let a = visK[i][0][1]; for (let j = 1; j < visK[i].length; j++) a += (visK[i][j][1] - visK[i][j - 1][1]) * (visK[i][j][1] ? E.out(prog(lt, visK[i][j][0] + 0.06, 0.12)) : E.out(prog(lt, visK[i][j][0], 0.08))); return { s, i, y: trk(lt, idxK[i], SP.row), a: clamp(a), inv: i === target && enterAt != null ? E.out(prog(lt, enterAt, 0.06)) : 0 }; }),
      hl: lt => trk(lt, [[-1, 0], [hlAt, target >= 0 && enterAt != null ? finalIdx : 0, SP.row]]),
    };
  }
  const PAL = { field: 150, rh: 102 };
  const palH = n => PAL.field + 18 + n * PAL.rh + 22;
  D.palette = (m, o) => d => {
    const { c, S, w, lt } = d, ink = ON(d.col), top = d.dy - d.ch / 2, LT = d.LT, fy = top + PAL.field / 2;
    el(c, lt, 0.02, () => {
      L.icon(c, 'search', -w / 2 + 66, fy, 42, ink, 2.3);
      const qq = m.typed(LT), x = -w / 2 + 116;
      const tw = qq ? T(c, S, qq, x, fy + 15, 44, { color: ink, weight: 500 }) : T(c, S, o.ph, x, fy + 15, 40, { color: rgba(ink, 0.4), weight: 500, maxW: w - 240 });
      if (Math.floor(LT * 2.4) % 2 === 0 || (LT > m.times[0] - 0.1 && LT < m.last + 0.4)) { c.fillStyle = ink; c.fillRect(qq ? x + tw + 4 : x - 6, fy - 26, 3, 52); }
    });
    el(c, lt, 0.05, () => L.line(c, -w / 2, top + PAL.field, w / 2, top + PAL.field, rgba(ink, 0.08), 2));
    const rows = m.rows(LT), y0 = top + PAL.field + 14, hy = m.hl(LT);
    el(c, lt, 0.08, () => { if (rows.some(r => r.a > 0.5)) { L.rr(c, -w / 2 + 18, y0 + hy * PAL.rh, w - 36, PAL.rh - 10, 24); c.fillStyle = rgba(ink, 0.055); c.fill(); } });
    rows.forEach(r => {
      if (r.a <= 0.01) return;
      el(c, lt, 0.08 + r.i * 0.04, () => {
        c.globalAlpha *= r.a; const y = y0 + r.y * PAL.rh, cyr = y + (PAL.rh - 10) / 2;
        if (r.inv > 0) { L.rr(c, -w / 2 + 18, y, w - 36, PAL.rh - 10, 24); c.fillStyle = rgba(INK(S), r.inv); c.fill(); }
        const tc = mix(ink, ON(INK(S)), r.inv);
        L.rr(c, -w / 2 + 44, cyr - 28, 56, 56, 15); c.fillStyle = rgba(tc, 0.07); c.fill();
        L.icon(c, L.iconFor(r.s, r.i), -w / 2 + 72, cyr, 30, tc, 2);
        T(c, S, r.s, -w / 2 + 128, cyr + 12, 34, { color: tc, weight: 500, maxW: w - 300 });
        keycap(c, S, w / 2 - 70, cyr, String(r.i + 1), tc, 22);
      }, 0.12);
    });
  };
  // the headline set in a toast / pill (measured; the shape fits the words)
  function headBox(S, o = {}) {
    const tk = o.tokens || headToks(S.b, S.F), px = o.px || 66, maxW = o.maxW || 1180;
    const lay = L.layout(S.ctx, S.look, tk, { role: 'display', px, maxW, x: 0, y: 0, align: o.align || 'left', maxLines: o.lines || 2, lineH: 1.06 });
    const h = Math.max(o.minH || 184, lay.H + 100), pad = o.pad || 66, ts = o.tick === false ? 0 : h * 0.17 * 2 + 34;
    return { tk, px: lay.px, lay, maxW, w: Math.max(o.minW || 0, lay.W + pad * 2 + ts), h, r: Math.min(h / 2, 92), ts, pad, align: o.align || 'left' };
  }
  D.toast = (hb, headAt) => d => {
    const { c, S } = d, w = hb.w, h = hb.h, col = d.col;
    if (hb.ts) { const tx = -w / 2 + hb.pad + h * 0.17, kp = sp(d.lt - 0.08, SP.pop); if (kp > 0) { c.save(); c.translate(tx, 0); c.scale(kp, kp); L.circle(c, 0, 0, h * 0.17, ON(col)); tick(c, 0, 0, h * 0.19, prog(d.lt, 0.14, 0.14), col, h * 0.03); c.restore(); } }
    const x = hb.align === 'center' ? (hb.ts ? hb.ts / 2 : 0) : -w / 2 + hb.pad + hb.ts;
    L.headline(onInk(S, col), { px: hb.px, maxW: hb.maxW, x, y: -hb.lay.H / 2 - hb.px * 0.06, align: hb.align, maxLines: 2, lineH: 1.06, role: 'display' }, { tokens: hb.tk, t0: headAt });
  };

  /* ───────── state builders shared by the set-ups ───────── */
  const ST = {
    button: (S, at, label, o = {}) => Object.assign({ at, w: clamp(TW(S.ctx, S, label, 54) + 220, 560, 1250), h: 206, fill: 'ink', draw: D.label(label, 54), fw: 0.56, fh: 0.34 }, o),
    loader: (at, doneIn, o = {}) => Object.assign({ at, w: 222, h: 222, fill: 'ink', draw: D.loader(doneIn), fw: 0.26, fh: 0.3 }, o),
    pop: at => [{ at, w: 252, h: 252, same: true, sp: SP.pop, zw: 222, zh: 222, fw: 0.26, fh: 0.3 }, { at: at + 0.07, w: 222, h: 222, same: true, sp: SP.soft, fw: 0.26, fh: 0.3 }],
    island: (at, o = {}) => ({ at, w: o.w || 886, h: o.h || 222, fill: 'ink', draw: D.island(o), fw: 0.74, fh: 0.32, delay: 0.1 }),
    player: (at, o) => ({ at, w: 990, h: 629, r: 58, fill: 'ink', sph: SP.tall, draw: D.player(o), fw: 0.74, fh: 0.76, delay: 0.08 }),
    volume: (at, oy, o) => ({ at, w: 1084, h: 187, oy, fill: 'ink', draw: D.volume(o), fw: 0.7, fh: 0.28, delay: 0.1 }),
    sw: (at, o) => ({ at, w: 481, h: 264, fill: 'ink', draw: D.sw(o), fw: 0.42, fh: 0.42, delay: 0.04 }),
    tabs: (at, o) => ({ at, w: 1164, h: 168, fill: 'white', draw: D.tabs(o), fw: 0.88, fh: 0.26, delay: 0.1 }),
    chart: (at, oy, o) => ({ at, w: 1100, h: 843, r: 62, oy, fill: 'white', sph: SP.tall, draw: D.chart(o), fw: 0.84, fh: 0.84, delay: 0.08 }),
    search: (at, o) => ({ at, w: 866, h: 168, fill: 'white', draw: D.search(o), fw: 0.66, fh: 0.24 }),
    palette: (at, h, m, o) => ({ at, w: 1030, h, r: 40, fill: 'white', draw: D.palette(m, o), fw: 0.7, fh: 0.72, zh: Math.max(h, 600), delay: 0.05 }),
    toast: (at, hb, headAt, o = {}) => Object.assign({ at, w: hb.w, h: hb.h, r: hb.r, fill: 'ink', raw: true, draw: D.toast(hb, headAt), fw: 0.88, fh: 0.5 }, o),
  };
  const PERIODS = ['Day', 'Week', 'Month'];
  const tabLabels = b => { const it = itemsOf(b).filter(s => s.length <= 14); return it.length >= 3 ? it.slice(0, 3) : PERIODS; };
  const queryOf = s => (s.toLowerCase().split(/\s+/).find(w => w.length >= 3) || s.toLowerCase()).slice(0, 5);

  /* ───────── layouts: full stage, or the headline beside / above a stage ───────── */
  function split(S) {
    if (isWide(S)) return { head: { x: S.W * 0.07, w: S.W * 0.34, align: 'left' }, stage: { x: S.W * 0.42, y: S.H * 0.04, w: S.W * 0.56, h: S.H * 0.92 } };
    if (isTall(S)) return { head: { x: S.W / 2, y: S.H * 0.12, w: S.W * 0.84, align: 'center' }, stage: { x: 0, y: S.H * 0.36, w: S.W, h: S.H * 0.56 } };
    return { head: { x: S.W / 2, y: S.H * 0.075, w: S.W * 0.86, align: 'center' }, stage: { x: 0, y: S.H * 0.31, w: S.W, h: S.H * 0.66 } };
  }
  function splitHead(S, Lh) {
    const b = S.b, tk = toks(b); if (!tk.length) return;
    const c = S.ctx, n = tk.length, wide = isWide(S), px = S.u * (wide ? 100 : isTall(S) ? 96 : 84) * (n <= 3 ? 1.12 : n <= 6 ? 1 : 0.84);
    const eb = b.text && b.text.eyebrow, ek = E.out(prog(S.lt, 0, 0.4));
    if (wide) {
      const lay0 = L.layout(c, S.look, tk, { px, maxW: Lh.w, x: Lh.x, y: 0, align: 'left', maxLines: 4 }), y = S.H / 2 - lay0.H / 2 - (b.text.sub ? 30 * S.u : 0);
      if (eb) { c.save(); c.globalAlpha *= ek; L.circle(c, Lh.x + 7 * S.u, y - 40 * S.u, 6 * S.u, S.P.accent); T(c, S, eb, Lh.x + 24 * S.u, y - 32 * S.u, 22 * S.u, { role: 'micro', weight: 500, color: S.P.dim, upper: true, maxW: Lh.w }); c.restore(); }
      const lay = L.headline(S, { px, maxW: Lh.w, x: Lh.x, y, align: 'left', maxLines: 4 });
      if (lay && b.text.sub) { const k = E.out(prog(S.lt, S.at('sub'), 0.4)); c.save(); c.globalAlpha *= k; const sl = L.layout(c, S.look, b.text.sub.split(/\s+/).map(s => ({ s })), { role: 'ui', px: 30 * S.u, maxW: Lh.w * 0.9, x: Lh.x, y: lay.bottom + 28 * S.u, align: 'left', maxLines: 3, lineH: 1.3 }); for (const wd of sl.words) L.drawWord(c, S.look, S.P, wd, { color: S.P.dim }); c.restore(); }
    } else L.headline(S, { px, maxW: Lh.w, x: S.W / 2, y: Lh.y, align: 'center', maxLines: isTall(S) ? 3 : 2 });
  }
  const splitAnchor = (F, w, h) => { const wide = F && F.W && F.W / F.H > 1.3, tall = F && F.W && F.H / F.W > 1.3; return wide ? { kind: 'rect', x: 0.705, y: 0.5, w: w * 0.5, h } : { kind: 'rect', x: 0.5, y: tall ? 0.64 : 0.64, w, h: h * 0.7 }; };
  const headCues = (b, F, at) => { const tp = typePlan(b, F, at); return { cues: { head: at, headDone: tp.done, sub: tp.done + 0.1 }, events: tp.events || [] }; };

  /* ═════════════════════════ SET-UPS ═════════════════════════ */

  /* click → loader → tick → the headline toast: a black button is pressed, squashes into a spinner, resolves into a
     tick that swells 8%, then stretches into a toast carrying the line */
  L.def('insert:morph-click-to-done', {
    kind: 'setup', selfFit: true,
    plan(b, F) { const B = beatOf(F), hp = headCues(b, F, 3 * B + 0.1); return { cues: Object.assign({ click: B, done: 2 * B }, hp.cues), events: [{ at: B - 0.02, event: 'click-ui' }, { at: 2 * B + 0.04, event: 'pop' }, { at: 3 * B, event: 'build' }, { at: 3 * B + 0.12, event: 'notify' }, ...hp.events], min: 3 * B + 2.1, entry: { kind: 'pill', x: 0.5, y: 0.5, w: 0.4, h: 0.13 }, exit: { kind: 'pill', x: 0.5, y: 0.5, w: 0.82, h: 0.17 } }; },
    draw(S) {
      const B = Bs(S), label = ctaOf(S.b, S.F), bt = ST.button(S, 0, label), hb = headBox(S);
      run(S, { states: [bt, ST.loader(B, B), ...ST.pop(2 * B + 0.04), ST.toast(3 * B, hb, 3 * B + 0.1)], clicks: [B - 0.02], cursor: [[0.05, bt.w * 0.9, 420], [B - 0.1, bt.w * 0.22, 36], [B + 0.7, bt.w * 0.36, 300], [3 * B + 0.4, hb.w * 0.46, hb.h * 0.95]] });
    },
  });

  /* a live island blooms into a player: a spinner opens into an island with art and live bars, a click blooms it into a
     black player card, play morphs to pause, the cursor scrubs; the headline sits beside it */
  L.def('insert:morph-island-to-player', {
    kind: 'setup', selfFit: true,
    plan(b, F) { const B = beatOf(F), hp = headCues(b, F, 0.1); return { cues: hp.cues, events: [{ at: 0.02, event: 'pop' }, { at: B, event: 'ui-reveal' }, { at: 2 * B - 0.03, event: 'click-ui' }, { at: 2 * B, event: 'card-in' }, { at: 3 * B, event: 'click-ui' }, { at: 4 * B, event: 'click-ui' }, ...hp.events], min: 5.6 * B + 1.1, entry: splitAnchor(F, 0.16, 0.2), exit: splitAnchor(F, 0.5, 0.55) }; },
    draw(S) {
      const B = Bs(S), Lh = split(S), Bd = brand(S.F), tx0 = -495 + 58, tx1 = 495 - 58;
      const prog_ = t => 0.22 + 0.5 * E.io(prog(t, 4 * B, 1.4 * B)) + Math.max(0, t - 3 * B) * 0.006;
      const kx = t => tx0 + (tx1 - tx0) * prog_(t);
      splitHead(S, Lh.head);
      run(S, {
        stage: Lh.stage, fill: 1.2,
        states: [ST.loader(0, 1e9, { fw: 0.24, fh: 0.28 }), ST.island(B, { label: Bd.name }), ST.player(2 * B, { title: Bd.name, sub: Bd.tagline || Bd.host, prog: prog_, play: t => E.io(prog(t, 3 * B, 0.14)), knob: t => E.out(prog(t, 3.6 * B, 0.16)) })],
        clicks: [2 * B - 0.03, 3 * B, 4 * B - 0.02],
        cursor: t => (t < 4 * B - 0.2 ? L.cursorAt([[1.2 * B, 700, 420], [2 * B - 0.06, 260, 30], [3 * B - 0.06, 6, 222], [4 * B - 0.2, kx(4 * B), 86]], t) : { x: kx(t), y: 86 + Math.max(0, t - 5.5 * B) * 30 }),
        cursorIn: 1.2 * B,
      });
    },
  });

  /* the card collapses onto its own progress bar, which becomes a volume pill: dragged to mute, then past max where the
     whole pill rubber-bands, released it snaps back with a small undershoot */
  L.def('insert:morph-player-to-volume', {
    kind: 'setup', selfFit: true,
    plan(b, F) { const B = beatOf(F), hp = headCues(b, F, 0.1); return { cues: hp.cues, events: [{ at: 0.02, event: 'card-in' }, { at: 1.5 * B, event: 'slide-out' }, { at: 2.5 * B, event: 'click-ui' }, { at: 4.6 * B, event: 'build' }, { at: 6 * B, event: 'pop' }, ...hp.events], min: 6.6 * B + 0.9, entry: splitAnchor(F, 0.5, 0.55), exit: splitAnchor(F, 0.52, 0.12) }; },
    draw(S) {
      const B = Bs(S), Lh = split(S), Bd = brand(S.F), OY = 72;
      const val = t => kfv(t, [[0, 0.62], [2.5 * B, 0.62], [3 * B, 0.03], [4 * B, 0.03], [4.6 * B, 1]]);
      const pull = t => (t < 4.6 * B ? 0 : t < 6 * B ? 300 * E.out(prog(t, 4.6 * B, 0.6 * B)) : 0);
      const rub = p => 150 * (1 - 1 / (1 + 2.6 * p / 1084));
      const str = t => (t < 6 * B ? rub(pull(t)) : rub(300) * (1 - sp(t - 6 * B, SP.band)));
      const cx = t => -364 + val(t) * (832 + str(t));
      splitHead(S, Lh.head);
      run(S, {
        stage: Lh.stage, fill: 1.2,
        states: [ST.player(0, { title: Bd.name, sub: Bd.tagline || Bd.host, prog: () => 0.62, play: () => 1, knob: () => 0 }), ST.volume(1.5 * B, OY, { val })],
        mod: t => (t > 1.5 * B ? { dw: str(t), dox: str(t) / 2 } : null),
        clicks: [2.5 * B - 0.02],
        cursor: t => (t < 2.5 * B ? L.cursorAt([[1.2 * B, 640, 420], [2.5 * B - 0.05, cx(2.5 * B), OY + 12]], t) : t < 6 * B + 0.05 ? { x: cx(t), y: OY + 12 } : L.cursorAt([[6 * B + 0.05, cx(6 * B), OY + 12], [7 * B, cx(6 * B) + 60, OY + 220]], t)),
        cursorIn: 1.2 * B,
      });
    },
  });
  function kfv(t, keys) { if (t <= keys[0][0]) return keys[0][1]; for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) return lerp(keys[i - 1][1], keys[i][1], E.io(prog(t, keys[i - 1][0], keys[i][0] - keys[i - 1][0]))); return keys[keys.length - 1][1]; }

  /* a big liquid switch flips on eighth notes (its knob stretches as the leading edge races ahead), then the knob
     becomes the marker of a segmented control that unrolls with the brand's three items */
  L.def('insert:morph-switch-to-tabs', {
    kind: 'setup', selfFit: true,
    plan(b, F) { const B = beatOf(F), hp = headCues(b, F, 0.1), tabs = itemsOf(b).length >= 3; const ev = [{ at: 0.02, event: 'pop' }, { at: B, event: 'click-ui' }, { at: 1.5 * B, event: 'click-ui' }, { at: 2 * B, event: 'click-ui' }]; if (tabs) ev.push({ at: 3 * B, event: 'slide-out' }, { at: 4 * B, event: 'click-ui' }, { at: 4.5 * B, event: 'click-ui' }); return { cues: hp.cues, events: ev.concat(hp.events), min: (tabs ? 4.5 * B : 2 * B) + 1.3, entry: splitAnchor(F, 0.24, 0.2), exit: splitAnchor(F, tabs ? 0.5 : 0.24, 0.12) }; },
    draw(S) {
      const B = Bs(S), Lh = split(S), labels = itemsOf(S.b).filter(Boolean).slice(0, 3), tabs = labels.length >= 3;
      const flips = [[0, 0], [B, 1], [1.5 * B, 0], [2 * B, 1]], seg = (1164 - 28) / 3, tcx = i => -582 + 14 + seg * (i + 0.5);
      splitHead(S, Lh.head);
      const states = [ST.sw(0, { flips })];
      if (tabs) states.push(ST.tabs(3 * B, { labels, sel: [[3 * B, 2], [4 * B, 1], [4.5 * B, 0]], px: 38 }));
      const path = [[0.4 * B, 420, 330], [B - 0.06, 60, 30]];
      if (tabs) path.push([2 * B + 0.3, 60, 30], [4 * B - 0.06, tcx(1), 22], [4.5 * B - 0.06, tcx(0), 22], [5.5 * B, tcx(0) + 40, 140]);
      run(S, { stage: Lh.stage, fill: 1.2, states, clicks: [B, 1.5 * B, 2 * B].concat(tabs ? [4 * B, 4.5 * B] : []), cursor: path });
    },
  });

  /* tabs unfold into a chart card: the marker slides to the last period, the white surface unfolds down under the tab
     bar, the number counts with rolling digits while the line draws, a tooltip rides the line under the cursor */
  L.def('insert:morph-tabs-to-chart', {
    kind: 'setup', selfFit: true,
    plan(b, F) { const B = beatOf(F), hp = headCues(b, F, 0.1); return { cues: hp.cues, events: [{ at: 0.02, event: 'ui-reveal' }, { at: B, event: 'click-ui' }, { at: 2 * B, event: 'card-in' }, { at: 2.4 * B, event: 'stat' }, { at: 3.6 * B, event: 'list-item' }, ...hp.events], min: 6 * B + 0.8, entry: splitAnchor(F, 0.5, 0.12), exit: splitAnchor(F, 0.5, 0.62) }; },
    draw(S) {
      const B = Bs(S), Lh = split(S), labels = tabLabels(S.b), n = numOf(S.b), Bd = brand(S.F), seg = (1164 - 28) / 3, tcx = i => -582 + 14 + seg * (i + 0.5);
      const OY = (843 - 168) / 2, ax0 = -550 + 66, ax1 = 550 - 66;
      const tipX = t => 0.12 + 0.82 * E.io(prog(t, 3.6 * B, 2 * B));
      splitHead(S, Lh.head);
      run(S, {
        stage: Lh.stage, fill: 1.2,
        states: [ST.tabs(0, { labels, sel: [[0, 0], [B, 2]] }), ST.chart(2 * B, OY, { labels, sel: [[0, 2]], num: n, title: Bd.name, sub: n ? '' : (S.b.text && S.b.text.sub) || Bd.host, countAt: 2.4 * B, drawAt: 2.4 * B, series: [series(L.hash(Bd.name) % 7, 'up')], tip: t => ({ x: tipX(t), a: E.out(prog(t, 3.5 * B, 0.15)) * (1 - E.in(prog(t, 5.8 * B, 0.15))) }) })],
        clicks: [B],
        cursor: t => (t < 3.5 * B ? L.cursorAt([[0.3 * B, 520, 300], [B - 0.06, tcx(2), 20], [2.6 * B, 260, 420], [3.5 * B, lerp(ax0, ax1, tipX(3.5 * B)), OY + 160]], t) : { x: lerp(ax0, ax1, tipX(t)), y: OY + 160 - 120 * tipX(t) }),
        cursorIn: 0.3 * B,
      });
    },
  });

  /* a stat island: a spinner resolves into a tick, the circle stretches into an island whose number counts up with
     rolling tabular digits beside live bars */
  L.def('insert:morph-stat-island', {
    kind: 'setup', selfFit: true,
    plan(b, F) { const B = beatOf(F), hp = headCues(b, F, 0.1); return { cues: hp.cues, events: [{ at: 0.02, event: 'pop' }, { at: B + 0.04, event: 'pop' }, { at: 2 * B, event: 'build' }, { at: 2.3 * B, event: 'stat' }, ...hp.events], min: 2.3 * B + 2.2, entry: splitAnchor(F, 0.16, 0.2), exit: splitAnchor(F, 0.5, 0.2) }; },
    draw(S) {
      const B = Bs(S), Lh = split(S), n = numOf(S.b) || { value: 100, suffix: '%', label: '' }, c = S.ctx, h = 240, numPx = 112;
      const L0 = L.setFont(c, S.look, 'numeral', numPx, 600); void L0; const numW = c.measureText(fmtNum(n.value, Number.isInteger(n.value) ? 0 : 1) + (n.prefix || '') + (n.suffix || '')).width + numPx * 0.3;
      const labW = n.label ? Math.min(380, TW(c, S, n.label, h * 0.13, { weight: 500 })) : 0;
      const w = h * 0.19 * 2 + (h - h * 0.38) + h * 0.2 + numW + (labW ? h * 0.12 + labW : 0) + h * 0.9;
      splitHead(S, Lh.head);
      run(S, { stage: Lh.stage, fill: 1.2, states: [ST.loader(0, B, { fw: 0.24, fh: 0.28 }), ...ST.pop(B + 0.04), ST.island(2 * B, { w, h, num: n, countAt: 2.3 * B, numPx, labelW: labW + 4 })] });
    },
  });

  /* the search pill blooms into a command palette, typing filters the brand's rows, enter inverts the match and the
     palette collapses around it into a black toast carrying the line */
  L.def('insert:morph-palette-to-toast', {
    kind: 'setup', selfFit: true,
    plan(b, F) {
      const B = beatOf(F), it = itemsOf(b).slice(0, 5), tgt = it[Math.min(1, it.length - 1)] || '', qy = queryOf(tgt), typeAt = 2 * B, end = typeAt + qy.length * 0.11, enter = Math.ceil((end + 0.35) / B) * B, hp = headCues(b, F, enter + 0.32);
      const ev = [{ at: B - 0.02, event: 'click-ui' }, { at: B + 0.02, event: 'card-in' }, ...qy.split('').map((_, i) => ({ at: typeAt + i * 0.11, event: 'word' })), { at: end + 0.05, event: 'list-item' }, { at: enter, event: 'click-ui' }, { at: enter + 0.26, event: 'notify' }, ...hp.events];
      return { cues: Object.assign({ enter }, hp.cues), events: ev, min: enter + 2.1, entry: { kind: 'pill', x: 0.5, y: 0.5, w: 0.6, h: 0.12 }, exit: { kind: 'pill', x: 0.5, y: 0.5, w: 0.82, h: 0.17 } };
    },
    draw(S) {
      const B = Bs(S), it = itemsOf(S.b).slice(0, 5), items = it.length ? it : [brand(S.F).name], tgt = items[Math.min(1, items.length - 1)], qy = queryOf(tgt);
      const typeAt = 2 * B, end = typeAt + qy.length * 0.11, enter = Math.ceil((end + 0.35) / B) * B, m = palModel(items, typeAt, qy, enter), hb = headBox(S), ph = 'Search ' + brand(S.F).name;
      const states = [ST.search(0, { ph }), ST.palette(B, palH(items.length), m, { ph })];
      m.counts.slice(1).forEach(([t, n], i) => { if (n !== m.counts[i][1]) states.push({ at: t + 0.04, w: 1030, h: palH(n), r: 40, same: true, fw: 0.74, fh: 0.82, zh: Math.max(palH(n), 600) }); });
      states.push(ST.toast(enter + 0.24, hb, enter + 0.32));
      run(S, { states, clicks: [B - 0.02, enter], cursor: [[0.1, 560, 300], [B - 0.06, 120, 20], [B + 0.6, 560, 330]], cursorOut: B + 0.8 });
    },
  });

  /* a palette listing the brand's features: the request types into the field, the rows drop in 40 ms apart, the
     highlight glides down a row on every beat; the headline beside it */
  L.def('insert:morph-palette-rows', {
    kind: 'setup', selfFit: true,
    plan(b, F) { const B = beatOf(F), n = Math.max(1, Math.min(5, itemsOf(b).length)), hp = headCues(b, F, 0.1); const ev = [{ at: 0.02, event: 'ui-reveal' }, { at: B, event: 'card-in' }]; for (let i = 0; i < n; i++) ev.push({ at: 2 * B + i * B, event: 'list-item' }); return { cues: hp.cues, events: ev.concat(hp.events), min: 2 * B + n * B + 0.8, entry: splitAnchor(F, 0.4, 0.12), exit: splitAnchor(F, 0.46, 0.5) }; },
    draw(S) {
      const B = Bs(S), Lh = split(S), items = itemsOf(S.b).slice(0, 5), list = items.length ? items : [brand(S.F).name], pr = (S.b.data && S.b.data.prompt) || '';
      const m = palModel(list, 1e9, '', null), ph = pr || 'Search ' + brand(S.F).name;
      const typed = t => { const n = Math.floor(clamp((t - 1.5 * B) / 0.045, 0, pr.length)); return pr.slice(0, n); };
      const mm = Object.assign({}, m, { typed, times: [1.5 * B], last: 1.5 * B + pr.length * 0.045, hl: t => { let v = 0; for (let i = 1; i < list.length; i++) v += sp(t - (2 * B + i * B), SP.row); return v; } });
      splitHead(S, Lh.head);
      run(S, { stage: Lh.stage, fill: 1.2, states: [ST.search(0, { ph: 'Search ' + brand(S.F).name }), ST.palette(B, palH(list.length), mm, { ph })] });
    },
  });

  /* the headline grows its own pill: a dot opens, each word arrives and the black pill springs wider to hold it (the
     camera refits each time), then the cursor presses it and a tick pops in at its end */
  L.def('insert:morph-headline-pill-grow', {
    kind: 'setup', selfFit: true,
    plan(b, F) { const n = Math.max(1, toks(b).length), B = beatOf(F), gap = n > 5 ? 0.16 : 0.24, last = 0.3 + (n - 1) * gap, click = Math.ceil((last + 0.7) / B) * B; return { cues: { head: 0.3, headDone: last + 0.2, click }, events: [{ at: 0.02, event: 'pop' }, ...Array.from({ length: n }, (_, i) => ({ at: 0.3 + i * gap, event: i === n - 1 ? 'key-word' : 'word' })), { at: click, event: 'click-ui' }, { at: click + 0.1, event: 'pop' }], min: click + 1.3, entry: { kind: 'dot', x: 0.5, y: 0.5, r: 0.04 }, exit: { kind: 'pill', x: 0.5, y: 0.5, w: 0.84, h: 0.18 } }; },
    draw(S) {
      const tk = headToks(S.b, S.F), n = tk.length, B = Bs(S), gap = n > 5 ? 0.16 : 0.24, last = 0.3 + (n - 1) * gap, click = Math.ceil((last + 0.7) / B) * B, c = S.ctx;
      const px = 92, lay = L.layout(c, S.look, tk, { role: 'display', px, maxW: 1500, x: 0, y: 0, align: 'left', maxLines: 2, lineH: 1.06 }), padX = 72, padY = 50, tsz = 0;
      const at = i => 0.3 + i * gap, ext = j => { const ws = lay.words.filter(w => w.i <= j); let W = 0; const lines = new Set(); for (const w of ws) { W = Math.max(W, w.x + w.w); lines.add(w.li); } return { w: W, lines: lines.size }; };
      const states = [{ at: 0, w: 184, h: 184, fill: 'ink', fw: 0.3, fh: 0.4, draw: null }];
      const fullW = lay.W + padX * 2 + 150; for (let j = 0; j < n; j++) { const e = ext(j), wj = e.w + padX * 2 + tsz; states.push({ at: at(j) - 0.12, w: wj, h: e.lines * lay.lh + padY * 2 + 4, r: 92, fill: 'ink', same: j > 0, raw: true, fw: 0.86, fh: 0.5, zw: Math.max(wj, fullW * 0.9), draw: j === 0 ? drawWords : undefined }); }
      const fin = states[states.length - 1];
      states.push({ at: click + 0.06, w: fin.w + 150, h: fin.h, r: 92, same: true, fw: 0.86, fh: 0.5, zw: Math.max(fin.w + 150, fullW * 0.9) });
      function drawWords(d) {
        const left = d.dx - d.cw / 2 + padX, topY = d.dy - d.ch / 2 + padY, colr = ON(d.col);
        for (const w of lay.words) {
          const k = prog(d.LT, at(w.i) + 0.04, 0.2); if (k <= 0) continue; const e = E.out(k);
          c.save(); c.globalAlpha *= clamp(k * 1.8); const bl = (1 - e) * 9; if (bl > 0.4) c.filter = `blur(${bl.toFixed(1)}px)`;
          L.drawWord(c, S.look, S.P, w, { x: left + w.x, y: topY + w.y + (1 - e) * 10, fill: w.tk.accent ? onInk(S, d.col).P.accent : colr }); c.restore();
        }
        const kp = sp(d.LT - click - 0.1, SP.pop); if (kp > 0) { const tx = d.dx + d.cw / 2 - 100, r = 46; c.save(); c.translate(tx, d.dy); c.scale(kp, kp); L.circle(c, 0, 0, r, S.P.accentRaw ? L.palette(S.look, 'ink').accent : colr); tick(c, 0, 0, r * 1.1, prog(d.LT, click + 0.16, 0.14), ON(L.palette(S.look, 'ink').accent), 7); c.restore(); }
      }
      run(S, { states, clicks: [click], cursor: [[click - 0.7, fin.w * 0.7, 380], [click - 0.05, fin.w * 0.3, fin.h * 0.2], [click + 1, fin.w * 0.42, fin.h * 1.1]] });
    },
  });

  /* the relay: the whole product in one unbroken shape (button, loader, tick, island, player, volume, switch, tabs,
     chart, toast with the line), each change landing on a beat */
  L.def('insert:morph-ui-relay', {
    kind: 'setup', selfFit: true,
    plan(b, F) { const B = beatOf(F), hp = headCues(b, F, 15 * B + 0.1); const ev = [[B, 'click-ui'], [2 * B, 'pop'], [3 * B, 'ui-reveal'], [4 * B, 'card-in'], [5 * B, 'click-ui'], [7 * B, 'slide-out'], [8.6 * B, 'build'], [9.2 * B, 'pop'], [10 * B, 'ui-reveal'], [10.5 * B, 'click-ui'], [11 * B, 'click-ui'], [12 * B, 'slide-out'], [12.5 * B, 'click-ui'], [13 * B, 'card-in'], [13.4 * B, 'stat'], [15 * B, 'build'], [15 * B + 0.12, 'notify']].map(([at, event]) => ({ at, event })); return { cues: hp.cues, events: ev.concat(hp.events), min: 15 * B + 2, entry: { kind: 'pill', x: 0.5, y: 0.5, w: 0.4, h: 0.13 }, exit: { kind: 'pill', x: 0.5, y: 0.5, w: 0.82, h: 0.17 } }; },
    draw(S) {
      const B = Bs(S), Bd = brand(S.F), label = ctaOf(S.b, S.F), bt = ST.button(S, 0, label), hb = headBox(S), labels = tabLabels(S.b), n = numOf(S.b), OYv = 72, OYc = (843 - 168) / 2;
      const pprog = t => 0.2 + 0.45 * E.io(prog(t, 5.5 * B, B)), tx0 = -437, tx1 = 437;
      const val = t => kfv(t, [[0, pprog(7 * B)], [7.6 * B, pprog(7 * B)], [8.2 * B, 1]]);
      const pull = t => (t < 8.2 * B ? 0 : t < 9.2 * B ? 300 * E.out(prog(t, 8.2 * B, 0.8 * B)) : 0), rub = p => 150 * (1 - 1 / (1 + 2.6 * p / 1084));
      const str = t => (t < 9.2 * B ? rub(pull(t)) : rub(300) * (1 - sp(t - 9.2 * B, SP.band))), vx = t => -364 + val(t) * (832 + str(t));
      const sw = { at: 10 * B, w: 481, h: 264, oy: OYv, fill: 'ink', draw: D.sw({ flips: [[0, 0], [10.5 * B, 1], [11 * B, 0], [11.5 * B, 1]] }), fw: 0.42, fh: 0.42, delay: 0.04, ox: 0 };
      const tabsS = Object.assign(ST.tabs(12 * B, { labels, sel: [[12 * B, 2], [12.5 * B, 1]] }), { oy: OYv });
      const chartS = ST.chart(13 * B, OYv + OYc, { labels, sel: [[0, 1]], num: n, title: Bd.name, sub: n ? '' : Bd.host, countAt: 13.4 * B, drawAt: 13.4 * B, series: [series(L.hash(Bd.name) % 7, 'up')] });
      const toastS = ST.toast(15 * B, hb, 15 * B + 0.1, { oy: OYv + OYc });
      const states = [bt, ST.loader(B, B), ...ST.pop(2 * B + 0.04), ST.island(3 * B, { label: Bd.name }), ST.player(4 * B, { title: Bd.name, sub: Bd.tagline || Bd.host, prog: pprog, play: t => E.io(prog(t, 5 * B, 0.14)), knob: t => E.out(prog(t, 5.3 * B, 0.15)) }), ST.volume(7 * B, OYv, { val }), sw, tabsS, chartS, toastS];
      const seg = (1164 - 28) / 3, tcx = i => -582 + 14 + seg * (i + 0.5);
      run(S, {
        states, clicks: [B - 0.02, 4 * B - 0.03, 5 * B, 5.5 * B - 0.02, 7.6 * B, 10.5 * B, 11 * B, 11.5 * B, 12.5 * B],
        mod: t => (t > 7 * B && t < 10 * B ? { dw: str(t), dox: str(t) / 2 } : null),
        cursor: t => {
          if (t < 5.5 * B) return L.cursorAt([[0.05, bt.w * 0.9, 420], [B - 0.1, bt.w * 0.22, 36], [B + 0.7, bt.w * 0.36, 300], [4 * B - 0.08, 240, 30], [5 * B - 0.06, 6, 222], [5.5 * B - 0.05, tx0 + (tx1 - tx0) * pprog(5.5 * B), 86]], t);
          if (t < 6.5 * B) return { x: tx0 + (tx1 - tx0) * pprog(t), y: 86 };
          if (t < 7.6 * B) return L.cursorAt([[6.5 * B, tx0 + (tx1 - tx0) * pprog(6.5 * B), 86], [7.6 * B - 0.05, vx(7.6 * B), OYv + 12]], t);
          if (t < 9.2 * B + 0.05) return { x: vx(t), y: OYv + 12 };
          return L.cursorAt([[9.2 * B + 0.05, vx(9.2 * B), OYv + 12], [10.5 * B - 0.06, 60, OYv + 30], [12.5 * B - 0.06, tcx(1), OYv + 22], [13.6 * B, 200, OYv + OYc + 300], [15 * B + 0.6, hb.w * 0.46, OYv + OYc + hb.h]], t);
        },
      });
    },
  });

  /* ═════════════════════════ END CARDS ═════════════════════════ */

  /* back to the first state: the tagline toast swaps its words for the call to action and shrinks into the button; the
     cursor glides back in to hover it, so the film could loop */
  L.def('end_card:morph-loop-button', {
    kind: 'end', selfFit: true,
    plan(b, F) { const B = beatOf(F); return { cues: { cta: 2 * B }, events: [{ at: 0.04, event: 'notify' }, { at: 2 * B, event: 'cta' }, { at: 3 * B, event: 'pop' }], min: 2 * B + 2.4, entry: { kind: 'pill', x: 0.5, y: 0.5, w: 0.7, h: 0.15 } }; },
    draw(S) {
      const B = Bs(S), Bd = brand(S.F), tag = String(Bd.tagline || Bd.name).split(/\s+/).filter(Boolean).map(s => ({ s })), hb = headBox(S, { tokens: tag, px: 58 }), bt = ST.button(S, 2 * B, ctaOf(S.b, S.F), { fw: 0.5, fh: 0.3, sp: W0(22, 0.62) });
      const R = run(S, { states: [ST.toast(0, hb, 0.08), bt], cursor: [[2.6 * B, bt.w * 0.95, 460], [3.6 * B, bt.w * 0.24, 40]] });
      if (!R) return;
      const k = E.out(prog(S.lt, 2.8 * B, 0.5)); if (k <= 0) return;
      const c = S.ctx; c.save(); c.globalAlpha *= k; T(c, S, Bd.host || Bd.name, S.W / 2, R.cy + R.h * R.k / 2 + 92 * S.u - (1 - k) * 8 * S.u, 26 * S.u, { role: 'micro', weight: 500, color: S.P.dim, align: 'center', upper: true, tracking: 0.16 }); c.restore();
    },
  });

  /* the island wordmark: a dot opens into the mark, the circle stretches into an island carrying the logo tile, the
     brand name in the wordmark face and live bars; the host types below */
  L.def('end_card:morph-island-wordmark', {
    kind: 'end', selfFit: true,
    plan(b, F) { const B = beatOf(F); return { cues: { word: B }, events: [{ at: 0.04, event: 'pop' }, { at: B, event: 'build' }, { at: 2 * B, event: 'cta' }], min: 2 * B + 2.2, entry: { kind: 'dot', x: 0.5, y: 0.5, r: 0.08 } }; },
    draw(S) {
      const B = Bs(S), Bd = brand(S.F), c = S.ctx, h = 250, wpx = 104, ww = Math.min(1300, TW(c, S, Bd.name, wpx, { role: 'wordmark' }));
      const w = h * 0.19 * 2 + h * 0.62 + h * 0.2 + ww + h * 0.95;
      const mark = { at: 0, w: 230, h: 230, r: 60, fill: 'ink', fw: 0.24, fh: 0.3, draw: d => { el(d.c, d.lt, 0.02, () => markTile(S, d.c, -80, -80, 160, 42, d.LT)); } };
      const R = run(S, { states: [mark, ST.island(B, { w, h, r: h / 2, word: Bd.name, wordPx: wpx, mark: true })] });
      if (!R) return;
      const k = E.out(prog(S.lt, 2 * B, 0.5)); if (k <= 0) return;
      c.save(); c.globalAlpha *= k; T(c, S, Bd.host || '', S.W / 2, R.cy + R.h * R.k / 2 + 90 * S.u - (1 - k) * 8 * S.u, 26 * S.u, { role: 'micro', weight: 500, color: S.P.dim, align: 'center', upper: true, tracking: 0.16 }); c.restore();
    },
  });

  /* ═════════════════════════ UI WIDGETS (alone: a mini stage at o.x, o.y, o.w) ═════════════════════════ */
  const uiStage = (S, o, f = 0.8) => { const w = o.w || S.W * 0.5, h = w * f; return { x: o.x - w / 2, y: o.y - h / 2, w, h }; };
  const uiRun = (S, o, M) => run(S, Object.assign({ stage: uiStage(S, o), t0: o.t0 || 0, grid: o.grid === true }, M));
  L.def('ui:morph-loader-check', { kind: 'ui', draw(S, o) { return uiRun(S, o, { states: [ST.loader(0, 0.9, { fw: 0.4, fh: 0.5 }), ...ST.pop(0.94).map(s => Object.assign(s, { fw: 0.4, fh: 0.5 }))] }); } });
  L.def('ui:island-live-bars', { kind: 'ui', draw(S, o) { return uiRun(S, o, { states: [ST.loader(0, 1e9, { fw: 0.3, fh: 0.4 }), Object.assign(ST.island(0.6, { label: o.label || brand(S.F).name }), { fw: 0.9, fh: 0.4 })] }); } });
  L.def('ui:player-card-scrub', {
    kind: 'ui',
    draw(S, o) { const Bd = brand(S.F), pg = t => 0.2 + 0.55 * E.io(prog(t, 1.4, 1.2)), kx = t => -437 + 874 * pg(t); return uiRun(S, o, { states: [Object.assign(ST.player(0, { title: o.title || Bd.name, sub: Bd.tagline || Bd.host, prog: pg, play: t => E.io(prog(t, 0.7, 0.14)), knob: t => E.out(prog(t, 1.2, 0.15)) }), { fw: 0.92, fh: 0.9 })], clicks: [0.7, 1.38], cursor: t => (t < 1.3 ? L.cursorAt([[0.2, 500, 420], [0.68, 6, 222], [1.3, kx(1.3), 86]], t) : { x: kx(t), y: 86 }) }); },
  });
  L.def('ui:volume-rubber-slider', {
    kind: 'ui',
    draw(S, o) { const val = t => kfv(t, [[0, 0.55], [0.4, 0.55], [0.8, 0.05], [1.2, 1]]), pull = t => (t < 1.2 ? 0 : t < 2.2 ? 300 * E.out(prog(t, 1.2, 0.5)) : 0), rub = p => 150 * (1 - 1 / (1 + 2.6 * p / 1084)), str = t => (t < 2.2 ? rub(pull(t)) : rub(300) * (1 - sp(t - 2.2, SP.band))), cx = t => -364 + val(t) * (832 + str(t));
      return uiRun(S, o, { states: [Object.assign(ST.volume(0, 0, { val }), { fw: 0.84, fh: 0.4 })], mod: t => ({ dw: str(t), dox: str(t) / 2 }), clicks: [0.38], cursor: t => (t < 0.38 ? L.cursorAt([[0, 500, 300], [0.38, cx(0.38), 12]], t) : t < 2.25 ? { x: cx(t), y: 12 } : L.cursorAt([[2.25, cx(2.2), 12], [3, cx(2.2) + 60, 200]], t)) }); },
  });
  L.def('ui:liquid-switch-flip', { kind: 'ui', draw(S, o) { const fl = [[0, 0], [0.5, 1], [0.75, 0], [1.0, 1], [2.0, 0], [2.25, 1]]; return uiRun(S, o, { states: [Object.assign(ST.sw(0, { flips: fl }), { fw: 0.6, fh: 0.6 })], clicks: fl.slice(1).map(f => f[0]), cursor: [[0.1, 300, 260], [0.48, 60, 30]] }); } });
  L.def('ui:two-spring-tabs', { kind: 'ui', draw(S, o) { const labels = (o.items || []).length >= 3 ? o.items.slice(0, 3) : PERIODS, seg = (1164 - 28) / 3, tcx = i => -582 + 14 + seg * (i + 0.5), sel = [[0, 0], [0.6, 1], [1.0, 2], [2.0, 0], [2.6, 1]]; return uiRun(S, o, { states: [Object.assign(ST.tabs(0, { labels, sel }), { fw: 0.96, fh: 0.3 })], clicks: sel.slice(1).map(s => s[0]), cursor: t => L.cursorAt([[0.1, 300, 200], ...sel.slice(1).map(s => [s[0] - 0.05, tcx(s[1]), 24])], t) }); } });
  L.def('ui:chart-card-tooltip', {
    kind: 'ui',
    draw(S, o) { const n = o.number && o.number.value ? o.number : { value: 84320, label: 'total views' }, tipX = t => 0.1 + 0.85 * E.io(prog(t, 1.2, 1.6)), ax0 = -484, ax1 = 484;
      return uiRun(S, o, { states: [Object.assign(ST.chart(0, 0, { labels: PERIODS, sel: [[0, 2]], num: n, countAt: 0.2, drawAt: 0.2, series: [series(3, 'up')], tip: t => ({ x: tipX(t), a: E.out(prog(t, 1.1, 0.15)) }) }), { fw: 0.9, fh: 0.96 })], cursor: t => (t < 1.1 ? L.cursorAt([[0.4, 600, 500], [1.1, lerp(ax0, ax1, tipX(1.1)), 180]], t) : { x: lerp(ax0, ax1, tipX(t)), y: 180 - 120 * tipX(t) }) }); },
  });
  L.def('ui:chart-line-morph', {
    kind: 'ui',
    draw(S, o) { const n = o.number && o.number.value ? o.number : { value: 84320, label: 'total views' }, A = series(3, 'up'), Bq = series(5, 'flat'), ratio = Bq[Bq.length - 1] / A[A.length - 1];
      return uiRun(S, o, { states: [Object.assign(ST.chart(0, 0, { labels: PERIODS, sel: [[0, 2], [1.4, 1]], num: n, numK: t => lerp(1, ratio, E.out(prog(t, 1.45, 0.45))), countAt: 0.1, drawAt: 0.1, series: [A, Bq], morphAt: 1.45 }), { fw: 0.9, fh: 0.96 })], clicks: [1.4], cursor: [[0.6, 500, 400], [1.36, 0, -360], [2.4, 120, -200]] }); },
  });
  L.def('ui:command-palette-filter', {
    kind: 'ui',
    draw(S, o) { const items = (o.items || []).slice(0, 5).length ? o.items.slice(0, 5) : ['New project', 'Export video', 'Frame rate', 'Motion blur', 'Share link'], tgt = items[Math.min(1, items.length - 1)], qy = queryOf(tgt), m = palModel(items, 0.6, qy, 2.1);
      const states = [Object.assign(ST.palette(0, palH(items.length), m, { ph: 'Type a command' }), { fw: 0.84, fh: 0.96 })];
      m.counts.slice(1).forEach(([t, k], i) => { if (k !== m.counts[i][1]) states.push({ at: t + 0.04, w: 1030, h: palH(k), r: 40, same: true, fw: 0.84, fh: 0.96, zh: Math.max(palH(k), 600) }); });
      return uiRun(S, o, { states, clicks: [2.1] }); },
  });
  L.def('ui:toast-tick-pill', { kind: 'ui', draw(S, o) { const s = String(o.line || o.label || brand(S.F).tagline || brand(S.F).name), hb = headBox(S, { tokens: s.split(/\s+/).map(w => ({ s: w })), px: 56 }); return uiRun(S, o, { states: [{ at: 0, w: 222, h: 222, fill: 'ink', fw: 0.3, fh: 0.4, draw: D.loader(0.3) }, ST.toast(0.6, hb, (o.t0 || 0) + 0.66, { fw: 0.96, fh: 0.5 })] }); } });
  L.def('ui:cursor-invert-dark', {
    kind: 'ui',
    draw(S, o) { return uiRun(S, o, { states: [{ at: 0, w: 900, h: 220, fill: 'ink', fw: 0.8, fh: 0.4, draw: D.label(o.label || 'Get started', 58) }], clicks: [1.5], cursor: t => { const k = (t % 3) / 3; return { x: lerp(-700, 700, E.io(k < 0.5 ? k * 2 : 2 - k * 2)), y: 30 + Math.sin(t * 2) * 40 }; }, cursorIn: 0 }); },
  });

  /* ═════════════════════════ TRANSITIONS (shape-born, never a crossfade) ═════════════════════════ */
  const pre = (o, k) => { const s = (o.pre || 0) + (o.post || 0) || 1; return clamp(k * s / Math.max(1e-6, o.pre || 1e-6)); };
  const anc = (S, a, dw = 0.36, dh = 0.13) => {
    const x = (a && a.x != null ? a.x : 0.5) * S.W, y = (a && a.y != null ? a.y : 0.5) * S.H;
    let w = a && a.w != null ? a.w * S.W : a && a.r != null ? a.r * 2 * S.H : dw * S.W, h = a && a.h != null ? a.h * S.H : a && a.r != null ? a.r * 2 * S.H : dh * S.H;
    w = Math.max(w, 40 * S.u); h = Math.max(h, 40 * S.u);
    return { x, y, w, h, r: a && /pill|dot|circle/.test(a.kind || '') ? Math.min(w, h) / 2 : Math.min(w, h) * 0.1 };
  };
  const shapeOn = bg => (lum(bg) > 0.4 ? null : '#FFFFFF');
  const tInk = (S, bg) => (lum(bg) > 0.4 ? S.look.palette.ink : (S.look.palette.card || '#FFFFFF'));
  const blurDraw = (c, im, bl, s = 1, S) => { c.save(); if (bl > 0.35) c.filter = `blur(${bl.toFixed(1)}px)`; if (s !== 1) { c.translate(S.W / 2, S.H / 2); c.scale(s, s); c.translate(-S.W / 2, -S.H / 2); } c.drawImage(im, 0, 0); c.restore(); };
  const tshape = (S, c, x, y, w, h, r, col, a = 1) => { c.save(); c.globalAlpha *= a; L.card(c, x - w / 2, y - h / 2, w, h, Math.min(r, w / 2, h / 2), { fill: col, u: S.u, lift: 0.9, shadow: 'rgba(0,0,0,0.2)', shadow2: 'rgba(0,0,0,0.1)' }); c.restore(); };
  void shapeOn;

  /* the shape hands off: an ink shape covers A's last object, A blurs out, then the shape springs (per axis, the height
     with more overshoot) to B's first object and melts into it while B sharpens */
  L.def('transition:morph-shape-handoff', {
    kind: 'transition', plan() { return { pre: 0.2, post: 0.38, events: [{ at: -0.2, event: 'slide-out' }, { at: 0, event: 'pop' }] }; },
    tr(S, A, B, k, o) {
      const c = S.ctx, a = anc(S, o.from), b = anc(S, o.to), dt = S.t - o.cut, colA = tInk(S, (S.PA || S.P).bg), colB = tInk(S, S.P.bg);
      if (dt < 0) { const g = pre(o, k); blurDraw(c, A, E.in(g) * 9, 1, S); tshape(S, c, a.x, a.y, a.w * (1 + 0.04 * g), a.h * (1 + 0.04 * g), a.r, colA, E.out(clamp(g * 1.4))); return; }
      blurDraw(c, B, (1 - E.out(prog(dt, 0.05, 0.16))) * 9, 1, S);
      const m = sp(dt, SP.morph), mh = sp(dt, SP.tall), col = mix(colA, colB, E.io(prog(dt, 0, 0.2)));
      tshape(S, c, lerp(a.x, b.x, m), lerp(a.y, b.y, m), lerp(a.w, b.w, m), lerp(a.h, b.h, mh), lerp(a.r, b.r, m), col, 1 - E.in(prog(dt, 0.2, 0.16)));
    },
  });
  /* loader iris: A's object squashes into a spinning loader, the spinner resolves into a tick, and the circle opens
     as a window onto B */
  L.def('transition:loader-iris-bloom', {
    kind: 'transition', plan() { return { pre: 0.3, post: 0.46, events: [{ at: -0.3, event: 'click-ui' }, { at: 0, event: 'pop' }] }; },
    tr(S, A, B, k, o) {
      const c = S.ctx, a = anc(S, o.from), d0 = Math.min(S.W, S.H) * 0.2, dt = S.t - o.cut, col = tInk(S, (S.PA || S.P).bg), on = L.onColor(col);
      const cover = Math.hypot(S.W, S.H) * 0.52;
      if (dt < 0) {
        const g = E.ramp(pre(o, k)); blurDraw(c, A, g * 6, 1, S);
        const x = lerp(a.x, S.W / 2, g), y = lerp(a.y, S.H / 2, g), w = lerp(a.w, d0, g), h = lerp(a.h, d0, g);
        tshape(S, c, x, y, w, h, Math.min(w, h) / 2, col, E.out(clamp(pre(o, k) * 2)));
        if (g > 0.5) { const rot = S.t * 10; c.save(); c.globalAlpha = (g - 0.5) * 2; c.strokeStyle = on; c.lineWidth = d0 * 0.07; c.lineCap = 'round'; c.beginPath(); c.arc(x, y, d0 * 0.25, rot, rot + 4.7); c.stroke(); c.restore(); }
        return;
      }
      const grow = E.ramp(prog(dt, 0.14, 0.32)), pop = 1 + 0.08 * Math.sin(Math.PI * clamp(dt / 0.14)), R = lerp(d0 / 2 * pop, cover, grow);
      c.drawImage(A, 0, 0);
      c.save(); c.beginPath(); c.arc(S.W / 2, S.H / 2, R, 0, Math.PI * 2); c.clip(); c.drawImage(B, 0, 0); c.restore();
      const ring = (1 - grow) * d0 * 0.5; if (ring > 0.5) { c.save(); c.beginPath(); c.arc(S.W / 2, S.H / 2, R, 0, Math.PI * 2); c.lineWidth = ring * 2; c.strokeStyle = col; c.stroke(); c.restore(); }
      if (grow < 0.4) { c.save(); c.globalAlpha = 1 - grow * 2.5; L.circle(c, S.W / 2, S.H / 2, R, col); tick(c, S.W / 2, S.H / 2, d0 * 0.48, prog(dt, 0, 0.12), on, d0 * 0.075); c.restore(); }
    },
  });
  /* band: a dot pops at the centre, stretches into a band across the frame (an island), then the band opens top and
     bottom as a window onto B */
  L.def('transition:band-stretch-open', {
    kind: 'transition', plan() { return { pre: 0.24, post: 0.36, events: [{ at: -0.24, event: 'pop' }, { at: 0, event: 'build' }] }; },
    tr(S, A, B, k, o) {
      const c = S.ctx, dt = S.t - o.cut, col = tInk(S, (S.PA || S.P).bg), bh = S.H * 0.13;
      c.drawImage(A, 0, 0);
      if (dt < 0) { const g = pre(o, k), d = Math.min(S.W, S.H) * 0.13 * E.outBack(clamp(g / 0.4)), wv = lerp(d, S.W * 1.08, E.ramp(clamp((g - 0.35) / 0.65))); tshape(S, c, S.W / 2, S.H / 2, wv, Math.min(d, bh), bh / 2, col); return; }
      const m = sp(dt, SP.tall), h = lerp(bh, S.H * 1.06, m), r = lerp(bh / 2, 0, clamp(m));
      c.save(); L.rr(c, -S.W * 0.04, S.H / 2 - h / 2, S.W * 1.08, h, r); c.clip(); blurDraw(c, B, (1 - E.out(prog(dt, 0.04, 0.18))) * 8, 1, S); c.fillStyle = rgba(col, 1 - E.out(prog(dt, 0, 0.14))); c.fillRect(0, 0, S.W, S.H); c.restore();
    },
  });
  /* collapse onto a bar: A squeezes vertically into a slim pill (the card collapsing onto its own track), the pill
     turns ink, then B grows back out of it */
  L.def('transition:collapse-onto-bar', {
    kind: 'transition', plan() { return { pre: 0.26, post: 0.34, events: [{ at: -0.26, event: 'slide-out' }, { at: 0, event: 'pop' }] }; },
    tr(S, A, B, k, o) {
      const c = S.ctx, dt = S.t - o.cut, a = anc(S, o.from), y0 = a.y, col = tInk(S, (S.PA || S.P).bg), hb = S.H * 0.1, wb = S.W * 0.78, bgA = (S.PA || S.P).bg;
      c.fillStyle = bgA; c.fillRect(0, 0, S.W, S.H);
      if (dt < 0) {
        const g = E.ramp(pre(o, k)), w = lerp(S.W, wb, g), h = lerp(S.H, hb, g), cy = lerp(S.H / 2, y0, g);
        c.save(); L.rr(c, S.W / 2 - w / 2, cy - h / 2, w, h, lerp(0, hb / 2, g)); c.clip(); c.filter = `blur(${(g * 10).toFixed(1)}px)`; c.drawImage(A, S.W / 2 - w / 2, cy - h / 2, w, h); c.filter = 'none'; c.fillStyle = rgba(col, E.in(g)); c.fillRect(0, 0, S.W, S.H); c.restore();
        if (g > 0.6) tshape(S, c, S.W / 2, cy, w, h, h / 2, col, (g - 0.6) / 0.4);
        return;
      }
      const m = sp(dt, SP.morph), mh = sp(dt - 0.03, SP.tall), w = lerp(wb, S.W * 1.03, m), h = lerp(hb, S.H * 1.03, mh), cy = lerp(y0, S.H / 2, m);
      c.save(); L.rr(c, S.W / 2 - w / 2, cy - h / 2, w, h, lerp(hb / 2, 0, clamp(mh))); c.clip(); blurDraw(c, B, (1 - E.out(prog(dt, 0.04, 0.18))) * 9, 1, S); c.fillStyle = rgba(col, 1 - E.out(prog(dt, 0, 0.16))); c.fillRect(0, 0, S.W, S.H); c.restore();
    },
  });
  /* blur swap: the old content blurs out in a tenth of a second while it settles back, the new one sharpens in from
     96% (the swap the shape uses for its contents, as a cut) */
  L.def('transition:blur-swap-quick', {
    kind: 'transition', plan() { return { pre: 0.1, post: 0.16, events: [{ at: 0, event: 'accent' }] }; },
    tr(S, A, B, k, o) {
      const c = S.ctx, dt = S.t - o.cut;
      if (dt < 0) { const g = E.in(pre(o, k)); blurDraw(c, A, g * 10, lerp(1, 0.985, g), S); return; }
      const e = E.out(prog(dt, 0.02, 0.13)); c.fillStyle = S.P.bg; c.fillRect(0, 0, S.W, S.H); c.save(); c.globalAlpha = clamp(e * 1.4); blurDraw(c, B, (1 - e) * 10, lerp(0.96, 1, e), S); c.restore();
    },
  });
  /* enter: the frame turns ink like a chosen row and collapses into a toast with a tick, which then opens into B */
  L.def('transition:enter-invert-toast', {
    kind: 'transition', plan() { return { pre: 0.32, post: 0.38, events: [{ at: -0.32, event: 'click-ui' }, { at: 0, event: 'notify' }] }; },
    tr(S, A, B, k, o) {
      const c = S.ctx, dt = S.t - o.cut, ink = S.look.palette.ink, tw = S.W * (isTall(S) ? 0.84 : 0.56), th = Math.min(S.H * 0.12, tw * 0.2), bgA = (S.PA || S.P).bg;
      c.fillStyle = bgA; c.fillRect(0, 0, S.W, S.H);
      if (dt < 0) {
        const g = pre(o, k), inv = E.out(clamp(g / 0.3)), m = E.ramp(clamp((g - 0.2) / 0.8)), w = lerp(S.W, tw, m), h = lerp(S.H, th, m);
        c.save(); L.rr(c, S.W / 2 - w / 2, S.H / 2 - h / 2, w, h, lerp(0, th / 2, m)); c.clip(); c.filter = `blur(${(m * 10).toFixed(1)}px)`; c.drawImage(A, 0, 0); c.filter = 'none'; c.fillStyle = rgba(ink, inv * 0.94); c.fillRect(0, 0, S.W, S.H); c.restore();
        if (m > 0.85) { const kk = sp(g * 0.3 - 0.85 * 0.3, SP.pop); c.save(); c.translate(S.W / 2 - w / 2 + h * 0.6, S.H / 2); c.scale(kk, kk); L.circle(c, 0, 0, h * 0.2, '#FFFFFF'); c.restore(); }
        return;
      }
      const hold = 0.1, m = sp(dt - hold, SP.morph), mh = sp(dt - hold, SP.tall), w = lerp(tw, S.W * 1.03, m), h = lerp(th, S.H * 1.03, mh);
      c.save(); L.rr(c, S.W / 2 - w / 2, S.H / 2 - h / 2, w, h, lerp(th / 2, 0, clamp(mh))); c.clip(); c.drawImage(B, 0, 0); c.fillStyle = rgba(ink, 1 - E.out(prog(dt, hold, 0.2))); c.fillRect(0, 0, S.W, S.H); c.restore();
      if (dt < hold + 0.12) { c.save(); c.globalAlpha = 1 - clamp((dt - hold) / 0.12); L.circle(c, S.W / 2 - w / 2 + h * 0.6, S.H / 2, h * 0.2, '#FFFFFF'); tick(c, S.W / 2 - w / 2 + h * 0.6, S.H / 2, h * 0.22, prog(dt, 0, 0.1), ink, h * 0.035); c.restore(); }
    },
  });
  /* unfold: a white tab bar drops in at the top, then the surface under it unfolds down over the frame carrying B */
  L.def('transition:unfold-from-top-pill', {
    kind: 'transition', plan() { return { pre: 0.2, post: 0.42, events: [{ at: -0.2, event: 'ui-reveal' }, { at: 0, event: 'card-in' }] }; },
    tr(S, A, B, k, o) {
      const c = S.ctx, dt = S.t - o.cut, pw = S.W * (isWide(S) ? 0.6 : 0.82), ph = S.H * 0.09, py = S.H * 0.08, card = lum(S.P.bg) > 0.4 ? (S.look.palette.card || '#FFFFFF') : S.look.palette.ink;
      c.drawImage(A, 0, 0);
      if (dt < 0) { const g = pre(o, k), m = sp(g * 0.2, SP.snap); tshape(S, c, S.W / 2, lerp(-ph, py + ph / 2, m), pw, ph, ph / 2, card); return; }
      const m = sp(dt, SP.morph), mh = sp(dt - 0.02, SP.tall), w = lerp(pw, S.W * 1.04, m), h = lerp(ph, S.H * 1.08, mh);
      c.save(); L.rr(c, S.W / 2 - w / 2, py * (1 - clamp(mh)), w, h, lerp(ph / 2, 0, clamp(mh))); c.clip(); blurDraw(c, B, (1 - E.out(prog(dt, 0.06, 0.2))) * 8, 1, S); c.fillStyle = rgba(card, 1 - E.out(prog(dt, 0, 0.18))); c.fillRect(0, 0, S.W, S.H); c.restore();
    },
  });

  /* ═════════════════════════ TYPE ═════════════════════════ */
  const words = b => toks(b).length;
  function tword(S, w, a, blur, dy, s, o = {}) {
    if (a <= 0.003) return; const c = S.ctx; c.save(); c.globalAlpha *= clamp(a); if (blur > 0.35) c.filter = `blur(${blur.toFixed(1)}px)`;
    if (s !== 1) { const cx = w.x + w.w / 2, cy = w.y - w.px * 0.35; c.translate(cx, cy); c.scale(s, s); c.translate(-cx, -cy); }
    L.drawWord(c, S.look, S.P, w, { y: w.y + dy, fill: o.fill }); c.restore();
  }
  /* words arrive in reading order 50 ms apart, each unblurring from 8 px and rising 6 px (a card's contents arriving) */
  L.def('effect:type-stagger-unblur', {
    kind: 'type',
    plan(b, F, t0 = 0) { const n = words(b), ws = Array.from({ length: n }, (_, i) => +(t0 + i * 0.05).toFixed(3)), a = toks(b).findIndex(t => t.accent); return { words: ws, done: (ws[n - 1] || t0) + 0.2, events: [{ at: t0, event: 'ui-reveal' }].concat(a >= 0 ? [{ at: ws[a] + 0.05, event: 'key-word' }] : []) }; },
    draw(S, o) { const t0 = o.t0 || 0; for (const w of o.lay.words) { const k = prog(S.lt, t0 + w.i * 0.05, 0.18), e = E.out(k); tword(S, w, k * 1.6, (1 - e) * 8 * S.u, (1 - e) * 8 * S.u, lerp(0.96, 1, e)); } },
  });
  /* a short label (the eyebrow or the brand) holds, blurs out in a tenth of a second, and the line sharpens in where it
     was: the shape's content swap, applied to a headline */
  L.def('effect:type-label-blur-swap', {
    kind: 'type',
    plan(b, F, t0 = 0) { return { words: Array(words(b)).fill(t0 + 0.5), done: t0 + 0.75, events: [{ at: t0, event: 'word' }, { at: t0 + 0.48, event: 'key-word' }] }; },
    draw(S, o) {
      const lay = o.lay, t0 = o.t0 || 0, c = S.ctx, label = (S.b.text && S.b.text.eyebrow) || brand(S.F).name;
      const kin = E.out(prog(S.lt, t0, 0.14)), kout = E.in(prog(S.lt, t0 + 0.4, 0.1));
      if (kout < 1 && label) { const cx = lay.align === 'left' ? lay.x : lay.align === 'right' ? lay.x : lay.x, y = lay.top + lay.H / 2 + lay.px * 0.32; c.save(); c.globalAlpha *= kin * (1 - kout); const bl = (1 - kin) * 8 + kout * 10; if (bl > 0.4) c.filter = `blur(${(bl * S.u).toFixed(1)}px)`; T(c, S, label, cx, y, lay.px * 0.8, { role: 'display', weight: 600, color: S.P.dim, align: lay.align, maxW: S.W * 0.84 }); c.restore(); }
      const e = E.out(prog(S.lt, t0 + 0.5, 0.16)); if (e <= 0) return;
      for (const w of lay.words) tword(S, w, e * 1.4, (1 - e) * 8 * S.u, 0, lerp(0.96, 1, e));
    },
  });
  /* the line grows its own pill: words arrive one by one inside an ink shape that springs wider (and taller on a new
     line) to hold them */
  L.def('effect:type-pill-grow', {
    kind: 'type',
    plan(b, F, t0 = 0) { const n = words(b), gap = n > 6 ? 0.1 : 0.16, ws = Array.from({ length: n }, (_, i) => +(t0 + 0.12 + i * gap).toFixed(3)); return { words: ws, done: (ws[n - 1] || t0) + 0.3, events: [{ at: t0, event: 'pop' }].concat(ws.map((at, i) => ({ at, event: i === n - 1 ? 'key-word' : 'word' }))) }; },
    draw(S, o) {
      const lay = o.lay, t0 = o.t0 || 0, c = S.ctx, n = lay.words.length, gap = n > 6 ? 0.1 : 0.16, at = i => t0 + 0.12 + i * gap, pad = lay.px * 0.42;
      if (S.lt < t0) return;
      const ext = j => { const ws = lay.words.filter(w => w.i <= j); if (!ws.length) return null; let x0 = 1e9, x1 = -1e9, y1 = -1e9; for (const w of ws) { x0 = Math.min(x0, w.x); x1 = Math.max(x1, w.x + w.w); y1 = Math.max(y1, w.y); } return { x0, x1, y1 }; };
      const f0 = ext(0); if (!f0) return; const keys = [[t0, f0.x0 - pad, f0.x0 + pad, f0.y1]];
      for (let j = 0; j < n; j++) { const e = ext(j); keys.push([at(j) - 0.03, e.x0 - pad, e.x1 + pad, e.y1]); }
      const v = idx => trk(S.lt, keys.map(kk => [kk[0], kk[idx]]), SP.morph), x0 = v(1), x1 = v(2), yb = v(3), top = lay.top - pad * 0.55, bot = yb + lay.px * 0.3 + pad * 0.55;
      const ink = lum(S.P.bg) > 0.4 ? S.look.palette.ink : (S.look.palette.card || '#FFFFFF'), sc = sp(S.lt - t0, SP.snap);
      c.save(); const mx = (x0 + x1) / 2, my = (top + bot) / 2; c.translate(mx, my); c.scale(lerp(0.6, 1, sc), lerp(0.6, 1, sc)); c.translate(-mx, -my);
      L.card(c, x0, top, x1 - x0, bot - top, Math.min((bot - top) / 2, lay.px * 0.7), { fill: ink, u: S.u, lift: 0.8, shadow: rgba(S.look.palette.ink, 0.2) });
      const SP2 = onInk(S, ink); for (const w of lay.words) { const k = prog(S.lt, at(w.i), 0.2), e = E.out(k); tword(SP2, w, k * 1.8, (1 - e) * 9 * S.u, (1 - e) * 10 * S.u, 1, { fill: w.tk.accent ? SP2.P.accent : SP2.P.fg }); }
      c.restore();
    },
  });

  /* ═════════════════════════ CAMERAS ═════════════════════════ */
  /* fit to state: frames the object the beat ends on (its exit anchor or data.focus), riding a critically damped
     spring so the scale change follows the morph; set-ups that fit themselves only get a slow push */
  L.def('camera:fit-to-state', {
    kind: 'camera',
    cam(lt, d, o, S) {
      const base = { s: 1 + clamp(lt / Math.max(0.1, d)) * 0.025, x: 0, y: 0, r: 0 };
      if (!S) return base; const part = L.get(S.b.setup); if (part && part.selfFit) return base;
      const f = (S.b.data && S.b.data.focus) || S.b.exit; if (!f || f.kind === 'dot') return base;
      const fw = f.w || (f.r || 0) * 2, fh = f.h || (f.r || 0) * 2; if (!fw || !fh) return base;
      const rect = { x: (f.x - fw / 2) * S.W, y: (f.y - fh / 2) * S.H, w: fw * S.W, h: fh * S.H }, sT = Math.min(S.W * 0.8 / rect.w, S.H * 0.8 / rect.h);
      const fill = 0.8 * Math.min(1, 1.3 / Math.max(1, sT)), cm = L.focusCam(S.W, S.H, rect, sp(lt - d * 0.3, SP.cam), fill);
      return { s: Math.max(1, cm.s) * base.s, x: cm.x, y: cm.y, r: 0 };
    },
  });
  /* spring nudge: a slow push plus a small damped spring kick on each of the beat's cues (clicks, arrivals) */
  L.def('camera:cue-spring-nudge', {
    kind: 'camera',
    cam(lt, d, o, S) {
      let s = 1 + 0.03 * E.io(clamp(lt / Math.max(0.1, d)));
      const cues = (S && S.cues) || {}; let n = 0;
      for (const key of Object.keys(cues)) { const t = cues[key]; if (typeof t !== 'number' || t <= 0.05 || n > 6) continue; n++; const dt = lt - t; if (dt > 0 && dt < 1.4) s += 0.014 * Math.exp(-dt * 6) * Math.sin(dt * 15); }
      return { s, x: 0, y: noise(lt * 0.3, 4) * 4 * ((S && S.u) || 1), r: 0 };
    },
  });

  /* ═════════════════════════ TEXTURE / OVERLAY ═════════════════════════ */
  /* the studio: a warm light falling on the centre and a faint dot grid that slowly zooms (each dot doubling fades in) */
  L.def('texture:studio-scaling-dots', { kind: 'texture', draw(S) { studio(S, S.W / 2, S.H / 2); grid(S, S.W / 2, S.H / 2, (30 * S.u / 44) * Math.pow(2, (S.lt * 0.18) % 1) * 1.0001); } });
  /* the art tile: one mesh-gradient square in the brand's hues sits half off the corner, turning slowly on a long soft
     shadow (the film's only colour) */
  L.def('texture:mesh-art-tile-corner', {
    kind: 'texture',
    draw(S) { const c = S.ctx, s = Math.min(S.W, S.H) * 0.46, x = S.W - s * 0.62, y = -s * 0.32 + Math.sin(S.lt * 0.6) * 6 * S.u, rot = -0.14 + S.lt * 0.01; c.save(); c.translate(x + s / 2, y + s / 2); c.rotate(rot); c.shadowColor = rgba(S.look.palette.ink, 0.18); c.shadowBlur = 70 * S.u; c.shadowOffsetY = 30 * S.u; L.rr(c, -s / 2, -s / 2, s, s, s * 0.2); c.fillStyle = S.P.bg; c.fill(); c.shadowColor = 'transparent'; artTile(S, c, -s / 2, -s / 2, s, s * 0.2, S.t); c.restore(); },
  });
  /* the pointer: a cursor glides in on a decelerating arc, presses where the line lands and drifts; it is white with a
     dark outline on dark ground */
  L.def('effect:cursor-glide-press', {
    kind: 'overlay',
    draw(S) {
      const at = S.cues && S.cues.headDone != null ? S.at('headDone') : Math.min(1.2, S.d * 0.4), path = [[at - 0.7, S.W * 0.86, S.H * 0.92], [at - 0.04, S.W * 0.6, S.H * 0.62], [S.d, S.W * 0.64, S.H * 0.7]];
      const p = L.cursorAt(path, S.lt), a = clamp((S.lt - at + 0.95) / 0.25); if (a <= 0) return;
      S.ctx.save(); S.ctx.globalAlpha *= a; L.drawCursor(S.ctx, p.x, p.y, { u: S.u * 1.3, press: L.pressAt([at], S.lt).p, dark: dk(S) }); S.ctx.restore();
    },
  });
})(globalThis.LAUNCH);
