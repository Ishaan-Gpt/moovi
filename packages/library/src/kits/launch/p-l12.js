// Pack l12: the editorial serif launch (learned from a database client launch film). Warm paper with a centre glow,
// a high-contrast serif whose last key word is italic in the product colour, and near-black product windows as the only
// dark objects: they soak into being out of the paper. The accent itself is a story device: a swatch ring recolours the
// app and the italic word live, and it turns alarm red for a safety beat. Everything re-skins from S.P / S.look.
'use strict';
(function (L) {
  const { clamp, lerp, prog, E, rgba, mix, lum, spring, springTrack, rand, hash } = L;
  const isWide = S => S.W / S.H > 1.3, isTall = S => S.H / S.W > 1.3;
  const toks = b => (b && b.text && b.text.tokens) || [];
  const T = (b, F, t0) => { const p = L.get(b.type) || L.get('effect:type-mask-rise'); return p.plan(b, F, t0); };
  const brand = () => (L.film && L.film.brand) || { name: 'Brand', host: 'brand.com', tagline: '' };
  const slugOf = n => String(n || 'app').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'app';
  const beatLen = F => { const g = (F && F.grid) || (L.film && L.film.grid) || {}; return 60 / (g.bpm || 120); };
  // semantic UI colours (chrome, like the success tick): alarm red, amber, success green
  const WARN = '#E5484D', AMBER = '#E0A43A', OK = '#3FD17A';
  const inkSet = S => { const k = S.look.palette, ink0 = k.ink || '#111113', ink = lum(S.P.bg) < 0.2 ? mix(S.P.bg, '#FFFFFF', 0.075) : ink0, fg = k.inkText || '#F1EFE9'; return { ink, panel: mix(ink, '#FFFFFF', 0.03), raised: mix(ink, '#FFFFFF', 0.08), hi: mix(ink, '#FFFFFF', 0.13), line: rgba(fg, 0.075), fg, dim: rgba(fg, 0.55), faint: rgba(fg, 0.32) }; };
  const withAccent = (S, col) => Object.assign({}, S, { P: Object.assign({}, S.P, { accent: col }) });

  /* ───────── colour: the swatch set is the brand accent walked round the hue wheel ───────── */
  function toHsl(h) { const [r, g, b] = L.hex(h).map(v => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; let hh = 0, s = 0; if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); hh = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; hh *= 60; } return [hh, s, l]; }
  function fromHsl(h, s, l) { h = (((h % 360) + 360) % 360) / 360; const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q; const f = t => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; }; return L.toHex([f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255]); }
  const swatches = acc => { const [h, s, l] = toHsl(acc), ss = clamp(Math.max(s, 0.62), 0.55, 0.86), ll = clamp(l, 0.47, 0.6); return [acc, ...[-45, -95, -135, 115, 68].map(d => fromHsl(h + d, ss, ll))]; };
  L.l12Swatches = swatches;

  /* ───────── shared drawing ───────── */
  // a word with alpha, blur, rise, scale and a grey mix (type treatments)
  function wd(S, w, o) {
    const c = S.ctx; if (o.a <= 0.002) return;
    c.save(); c.globalAlpha *= clamp(o.a);
    if (o.blur > 0.35) c.filter = `blur(${o.blur.toFixed(2)}px)`;
    if (o.s && o.s !== 1) { const cx = w.x + w.w / 2, cy = w.y - w.px * 0.35; c.translate(cx, cy); c.scale(o.s, o.s); c.translate(-cx, -cy); }
    const base = w.tk.accent ? (o.accent || S.P.accent) : S.P.fg;
    L.drawWord(c, S.look, S.P, w, { x: w.x + (o.dx || 0), y: w.y + (o.dy || 0), fill: o.fill || (o.grey ? mix(base, S.P.bg, clamp(o.grey) * 0.6) : base) });
    c.restore();
  }
  // spaced micro caps (OUT NOW / WORKS WITH)
  function caps(S, txt, x, y, k, o = {}) {
    if (!txt || k <= 0) return; const c = S.ctx;
    c.save(); c.globalAlpha *= clamp(k); L.text(c, S.look, txt, x, y + (1 - k) * 6 * S.u, { role: 'micro', px: (o.px || 17) * S.u, color: o.color || S.P.dim, align: o.align || 'center', upper: true, tracking: 0.3, maxW: o.maxW || S.W * 0.8 }); c.restore();
  }
  // a dark surface that soaks in out of the paper: fill paper → grey → ink while scaling 0.94 → 1, the shadow growing
  const inkFill = (S, k) => { const ink = inkSet(S).ink, mid = mix(S.P.bg, ink, 0.4); return k < 0.5 ? mix(S.P.bg, mid, k * 2) : mix(mid, ink, (k - 0.5) * 2); };
  function materialise(S, x, y, w, h, r, k, content) {
    if (k <= 0) return; const c = S.ctx, s = lerp(0.94, 1, k), cx = x + w / 2, cy = y + h / 2;
    c.save(); c.translate(cx, cy); c.scale(s, s); c.translate(-cx, -cy);
    c.globalAlpha *= clamp(k * 4);
    L.card(c, x, y, w, h, r, { fill: inkFill(S, k), u: S.u, lift: 1.25 * k, shadow: 'rgba(24,18,10,0.17)', shadow2: 'rgba(24,18,10,0.10)', stroke: k > 0.7 ? 'rgba(255,255,255,0.07)' : false, grad: false });
    const ca = clamp((k - 0.72) / 0.28);
    if (ca > 0 && content) { c.save(); L.rr(c, x, y, w, h, r); c.clip(); c.globalAlpha *= ca; content(c); c.restore(); }
    if (k > 0.7) { // the glass: a faint diagonal sheen that drifts and a light top rim (the window is an object, not a flat box)
      c.save(); L.rr(c, x, y, w, h, r); c.clip(); const sx = x + w * (0.1 + 0.08 * Math.sin(S.t * 0.35)), sh = c.createLinearGradient(sx, y, sx + w * 0.5, y + h);
      sh.addColorStop(0, 'rgba(255,255,255,0.055)'); sh.addColorStop(0.35, 'rgba(255,255,255,0.0)'); sh.addColorStop(1, 'rgba(255,255,255,0.0)'); c.fillStyle = sh; c.fillRect(x, y, w, h);
      L.rr(c, x + 0.75, y + 0.75, w - 1.5, h - 1.5, r); const rim = c.createLinearGradient(0, y, 0, y + h * 0.3); rim.addColorStop(0, 'rgba(255,255,255,0.16)'); rim.addColorStop(1, 'rgba(255,255,255,0)'); c.strokeStyle = rim; c.lineWidth = 1.5 * S.u; c.stroke(); c.restore();
    }
    c.restore();
  }
  const winK = (S, t0, dur = 0.42) => E.out(prog(S.lt, t0 || 0, dur));
  function envTag(S, x, y, env, f) { // x = left, y = centre
    const c = S.ctx, col = env === 'prod' ? WARN : env === 'stg' ? AMBER : OK, w = L.textW(c, S.look, env, { role: 'micro', px: f * 0.7, tracking: 0.04 }) + f * 0.9, h = f * 1.25;
    L.rr(c, x, y - h / 2, w, h, f * 0.28); c.fillStyle = rgba(col, 0.16); c.fill();
    L.text(c, S.look, env, x + f * 0.45, y + f * 0.25, { role: 'micro', px: f * 0.7, color: col, tracking: 0.04 });
    return w;
  }
  function chevron(c, x, y, s, col) { c.save(); c.strokeStyle = col; c.lineWidth = Math.max(1, s * 0.18); c.lineCap = 'round'; c.beginPath(); c.moveTo(x - s * 0.4, y - s * 0.2); c.lineTo(x, y + s * 0.2); c.lineTo(x + s * 0.4, y - s * 0.2); c.stroke(); c.restore(); }
  function triangle(c, x, y, s, col) { c.save(); c.strokeStyle = col; c.lineWidth = Math.max(1.2, s * 0.11); c.lineJoin = 'round'; c.beginPath(); c.moveTo(x, y - s * 0.48); c.lineTo(x + s * 0.52, y + s * 0.42); c.lineTo(x - s * 0.52, y + s * 0.42); c.closePath(); c.stroke(); c.beginPath(); c.moveTo(x, y - s * 0.12); c.lineTo(x, y + s * 0.12); c.stroke(); c.fillStyle = col; c.beginPath(); c.arc(x, y + s * 0.26, s * 0.06, 0, Math.PI * 2); c.fill(); c.restore(); }

  /* ───────── the data app (three panes, env tags, a mono grid), drawn into a rect; recolours with o.acc ───────── */
  const TABLES = ['users', 'orders', 'events', 'invoices', 'sessions', 'audit_log', 'products', 'payments'];
  const tablesFor = b => { const it = ((b && b.data && b.data.items) || []).slice(0, 3).map(s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')).filter(Boolean); const out = [...it]; for (const t of TABLES) if (out.length < 8 && !out.includes(t)) out.push(t); return out; };
  const pad2 = n => String(n).padStart(2, '0');
  function drawApp(S, x, y, w, h, o = {}) {
    const c = S.ctx, I = inkSet(S), acc = L.readable(o.acc || S.look.accent, I.ink, 3.2), f = Math.max(7, w / 74), seed = o.seed || 11, B = brand(), sl = slugOf(B.name);
    const tabs = o.tables || tablesFor(S.b), sel = o.sel || 0;
    c.fillStyle = I.ink; c.fillRect(x, y, w, h);
    const th = f * 2.9;
    c.fillStyle = I.panel; c.fillRect(x, y, w, th); L.line(c, x, y + th, x + w, y + th, I.line, 1);
    L.rr(c, x + f * 1.1, y + th / 2 - f * 0.8, f * 1.6, f * 1.6, f * 0.4); c.fillStyle = acc; c.fill();
    L.icon(c, 'layers', x + f * 1.9, y + th / 2, f * 1.1, L.onColor(acc), 2.2);
    L.text(c, S.look, B.name, x + f * 3.4, y + th / 2 + f * 0.36, { role: 'ui', px: f * 1.02, weight: 600, color: I.fg, maxW: w * 0.13 });
    ['Data', 'Query', 'Schema', 'History'].forEach((s, i) => {
      const tx = x + w * 0.21 + i * f * 5.6, on = i === (o.tab || 0);
      L.text(c, S.look, s, tx, y + th / 2 + f * 0.33, { role: 'ui', px: f * 0.9, weight: on ? 600 : 500, color: on ? I.fg : I.dim });
      if (on) { c.fillStyle = acc; c.fillRect(tx, y + th - 2 * S.u, L.textW(c, S.look, s, { role: 'ui', px: f * 0.9, weight: 600 }), 2 * S.u); }
    });
    envTag(S, x + w - f * 6.4, y + th / 2, 'prod', f); L.circle(c, x + w - f * 1.6, y + th / 2, f * 0.75, mix(acc, I.ink, 0.35));
    // left pane: connections with environment tags
    const lw = w * 0.2, mw = w * 0.145, top = y + th, rh = f * 2.25;
    c.fillStyle = I.panel; c.fillRect(x, top, lw, h - th); L.line(c, x + lw, top, x + lw, y + h, I.line, 1);
    L.text(c, S.look, 'Connections', x + f * 1.1, top + f * 1.9, { role: 'micro', px: f * 0.68, color: I.faint, upper: true, tracking: 0.14 });
    [[sl + '-main', 'prod'], [sl + '-replica', 'prod'], ['staging', 'stg'], ['analytics', 'stg'], ['local', 'dev'], ['preview', 'dev']].forEach(([n, env], i) => {
      const ry = top + f * 2.8 + i * rh; if (ry + rh > y + h - f) return;
      if (i === 0) { L.rr(c, x + f * 0.5, ry, lw - f, rh * 0.86, f * 0.4); c.fillStyle = rgba(I.fg, 0.06); c.fill(); }
      L.icon(c, 'layers', x + f * 1.6, ry + rh * 0.43, f * 0.95, i === 0 ? acc : I.faint, 2);
      L.text(c, S.look, n, x + f * 2.7, ry + rh * 0.43 + f * 0.32, { role: 'ui', px: f * 0.86, color: i === 0 ? I.fg : I.dim, maxW: lw - f * 6.6 });
      envTag(S, x + lw - f * 3.6, ry + rh * 0.43, env, f * 0.9);
    });
    // middle pane: tables
    const mx = x + lw;
    L.line(c, mx + mw, top, mx + mw, y + h, I.line, 1);
    L.text(c, S.look, 'Tables', mx + f * 1.1, top + f * 1.9, { role: 'micro', px: f * 0.68, color: I.faint, upper: true, tracking: 0.14 });
    tabs.forEach((n, i) => {
      const ry = top + f * 2.8 + i * rh; if (ry + rh > y + h - f) return;
      if (i === sel) { L.rr(c, mx + f * 0.5, ry, mw - f, rh * 0.86, f * 0.4); c.fillStyle = rgba(acc, 0.18); c.fill(); }
      L.icon(c, 'grid', mx + f * 1.5, ry + rh * 0.43, f * 0.85, i === sel ? acc : I.faint, 2);
      L.text(c, S.look, n, mx + f * 2.5, ry + rh * 0.43 + f * 0.32, { role: 'micro', px: f * 0.8, color: i === sel ? acc : I.dim, tracking: 0, maxW: mw - f * 3.2 });
    });
    // grid
    const gx = mx + mw, gw = w - lw - mw, tb = f * 3.1;
    L.text(c, S.look, tabs[sel], gx + f * 1.2, top + tb / 2 + f * 0.36, { role: 'micro', px: f * 0.98, weight: 600, color: I.fg, tracking: 0, maxW: gw * 0.3 });
    const btn = (label, bx, fill, col) => { const bw = L.textW(c, S.look, label, { role: 'ui', px: f * 0.82, weight: 600 }) + f * 1.8; L.rr(c, bx - bw, top + tb / 2 - f * 0.8, bw, f * 1.6, f * 0.4); if (fill) { c.fillStyle = fill; c.fill(); } else { c.strokeStyle = I.line; c.lineWidth = 1; c.stroke(); } L.text(c, S.look, label, bx - bw / 2, top + tb / 2 + f * 0.3, { role: 'ui', px: f * 0.82, weight: 600, color: col, align: 'center' }); return bw; };
    let bx = gx + gw - f * 1;
    bx -= btn(o.primary || '+ New row', bx, acc, L.onColor(acc)) + f * 0.6; bx -= btn('Sort', bx, null, I.dim) + f * 0.6; btn('Filter', bx, null, I.dim);
    let gy = top + tb;
    if (o.query != null) { // a query bar: SQL typed in mono, an accent Run button
      const qh = f * 2.6; L.rr(c, gx + f, gy, gw - f * 2, qh, f * 0.5); c.fillStyle = I.raised; c.fill();
      L.text(c, S.look, o.query, gx + f * 1.8, gy + qh / 2 + f * 0.32, { role: 'micro', px: f * 0.86, color: I.fg, tracking: 0, maxW: gw - f * 9 });
      if (o.caret) { const tw_ = Math.min(L.textW(c, S.look, o.query, { role: 'micro', px: f * 0.86, tracking: 0 }), gw - f * 9); c.fillStyle = acc; c.fillRect(gx + f * 1.9 + tw_, gy + qh / 2 - f * 0.55, Math.max(1.5, f * 0.1), f * 1.1); }
      const rp = o.press || 0, rw = f * 4.2; c.save(); const rcx = gx + gw - f * 1.4 - rw / 2, rcy = gy + qh / 2; c.translate(rcx, rcy); c.scale(1 - rp * 0.06, 1 - rp * 0.06); c.translate(-rcx, -rcy);
      L.rr(c, rcx - rw / 2, rcy - f * 0.8, rw, f * 1.6, f * 0.4); c.fillStyle = acc; c.fill(); L.icon(c, 'play', rcx - f * 0.9, rcy, f * 0.8, L.onColor(acc), 2); L.text(c, S.look, 'Run', rcx + f * 0.3, rcy + f * 0.3, { role: 'ui', px: f * 0.82, weight: 600, color: L.onColor(acc), align: 'center' }); c.restore();
      o.runAt = { x: rcx, y: rcy };
      gy += qh + f * 0.8;
    }
    const cols = [['', 0.05], ['id', 0.11], ['key', 0.21], ['status', 0.17], ['amount', 0.17], ['updated_at', 0.29]], hh = f * 2.1;
    c.fillStyle = I.panel; c.fillRect(gx, gy, gw, hh); L.line(c, gx, gy + hh, gx + gw, gy + hh, I.line, 1);
    let cx_ = gx + f;
    const colX = cols.map(([n, p]) => { const v = cx_; cx_ += (gw - f * 2) * p; return v; });
    cols.forEach(([n], i) => { if (!n) return; const tw2 = L.text(c, S.look, n, colX[i], gy + hh / 2 + f * 0.3, { role: 'micro', px: f * 0.74, color: I.faint, tracking: 0.02 }); if (n === 'id') { const pw = f * 1.9; L.rr(c, colX[i] + tw2 + f * 0.5, gy + hh / 2 - f * 0.55, pw, f * 1.1, f * 0.3); c.fillStyle = rgba(acc, 0.2); c.fill(); L.text(c, S.look, 'PK', colX[i] + tw2 + f * 0.5 + pw / 2, gy + hh / 2 + f * 0.24, { role: 'micro', px: f * 0.6, color: acc, align: 'center', tracking: 0 }); } });
    gy += hh;
    const rowH = f * 2.05, n = Math.max(0, Math.floor((y + h - f * 2 - gy) / rowH));
    const shownRows = o.rows != null ? Math.min(n, o.rows) : n;
    for (let i = 0; i < shownRows; i++) {
      const a = o.rowsAt != null ? clamp((S.lt - (o.rowsAt + i * 0.028)) / 0.14) : 1; if (a <= 0) continue;
      const ry = gy + i * rowH; c.save(); c.globalAlpha *= a;
      if (i === o.hi) { c.fillStyle = rgba(acc, 0.14); c.fillRect(gx, ry, gw, rowH); c.fillStyle = acc; c.fillRect(gx, ry, 2 * S.u, rowH); }
      L.line(c, gx, ry + rowH, gx + gw, ry + rowH, rgba(I.fg, 0.04), 1);
      L.rr(c, colX[0] + f * 0.1, ry + rowH / 2 - f * 0.45, f * 0.9, f * 0.9, f * 0.2); c.strokeStyle = I.faint; c.lineWidth = 1; c.stroke();
      const yy = ry + rowH / 2 + f * 0.3, r1 = rand(seed + i * 13), r2 = rand(seed + i * 31);
      L.text(c, S.look, String(1040 + i * 7 + (seed % 5)), colX[1], yy, { role: 'micro', px: f * 0.82, color: I.fg, tracking: 0 });
      L.text(c, S.look, (hash(seed + ':' + i) >>> 0).toString(16).padStart(8, '0').slice(0, 8) + '…', colX[2], yy, { role: 'micro', px: f * 0.82, color: I.dim, tracking: 0 });
      const st = r1 > 0.3 ? 'active' : r1 > 0.12 ? 'paused' : 'failed', sc = st === 'active' ? acc : st === 'failed' ? WARN : I.dim;
      const sw = L.textW(c, S.look, st, { role: 'micro', px: f * 0.72, tracking: 0 }) + f * 1.1;
      L.rr(c, colX[3], ry + rowH / 2 - f * 0.62, sw, f * 1.24, f * 0.62); c.fillStyle = st === 'paused' ? rgba(I.fg, 0.07) : rgba(sc, 0.16); c.fill();
      L.text(c, S.look, st, colX[3] + f * 0.55, yy - f * 0.02, { role: 'micro', px: f * 0.72, color: sc, tracking: 0 });
      L.text(c, S.look, (r2 * 2400 + 12).toFixed(2), colX[4], yy, { role: 'micro', px: f * 0.82, color: I.fg, tracking: 0 });
      L.text(c, S.look, `2026-${pad2(1 + (i * 5 + seed) % 12)}-${pad2(1 + (i * 7 + seed) % 28)} ${pad2((i * 3 + 9) % 24)}:${pad2((i * 17) % 60)}`, colX[5], yy, { role: 'micro', px: f * 0.82, color: I.dim, tracking: 0, maxW: gw * 0.27 });
      c.restore();
    }
    // status bar
    const sy = y + h - f * 1.9; c.fillStyle = I.panel; c.fillRect(gx, sy, gw, f * 1.9); L.line(c, gx, sy, gx + gw, sy, I.line, 1);
    L.text(c, S.look, `${tabs[sel]} · ${shownRows} rows`, gx + f, sy + f * 1.25, { role: 'micro', px: f * 0.72, color: I.faint, tracking: 0 });
    L.circle(c, gx + gw - f * 1.3, sy + f * 0.95, f * 0.32, OK);
    return o;
  }
  L.l12App = drawApp;

  // the dark browser chrome: traffic lights and a centred URL pill that types its address; returns the content rect
  function chrome(S, x, y, w, h, o = {}) {
    const c = S.ctx, I = inkSet(S), bar = Math.max(26 * S.u, Math.min(56 * S.u, h * 0.065));
    c.fillStyle = mix(I.ink, '#FFFFFF', 0.045); c.fillRect(x, y, w, bar); L.line(c, x, y + bar, x + w, y + bar, I.line, 1);
    ['#FF5F57', '#FEBC2E', '#28C840'].forEach((col, i) => L.circle(c, x + bar * 0.55 + i * bar * 0.42, y + bar / 2, bar * 0.12, mix(col, I.ink, 0.25)));
    const host = o.host || brand().host, n = o.typed == null ? host.length : o.typed, uw = Math.min(w * 0.42, 600 * S.u), ux = x + w / 2 - uw / 2, ph = bar * 0.6;
    L.pill(c, ux, y + bar / 2 - ph / 2, uw, ph, I.raised);
    const fpx = ph * 0.52, txt = host.slice(0, n), tw = L.textW(c, S.look, host, { role: 'micro', px: fpx, tracking: 0 }), tx = x + w / 2 - tw / 2 + fpx * 0.6;
    L.icon(c, 'lock', tx - fpx * 1.3, y + bar / 2, fpx * 1.0, I.dim, 2);
    const ww = L.text(c, S.look, txt, tx, y + bar / 2 + fpx * 0.36, { role: 'micro', px: fpx, color: I.fg, tracking: 0 });
    if (o.caret) { c.fillStyle = I.fg; c.fillRect(tx + ww + 1.5 * S.u, y + bar / 2 - fpx * 0.6, Math.max(1, 1.4 * S.u), fpx * 1.2); }
    return { x, y: y + bar, w, h: h - bar, bar };
  }
  // the window's inner picture: the brand's real site shot when the film has one, else the drawn data app
  function inner(S, r, o = {}) {
    const img = !o.drawn && L.img('hero');
    if (img) { const c = S.ctx, s = r.w / img.width; c.fillStyle = inkSet(S).ink; c.fillRect(r.x, r.y, r.w, r.h); c.drawImage(img, 0, 0, img.width, Math.min(img.height, r.h / s), r.x, r.y, r.w, Math.min(r.h, img.height * s)); return; }
    drawApp(S, r.x, r.y, r.w, r.h, o);
  }

  /* ───────── the dark preferences sheet (rows, segmented controls, swatches, toggles; one scroll jump) ───────── */
  const PREFS = [['Theme', 'Light, dark or follow the system', 'seg', ['Light', 'Dark', 'System'], 1], ['Accent colour', 'Buttons, links and highlights', 'dots'], ['Start page', 'What opens first', 'seg', ['Tables', 'Query'], 0], ['Rows per page', 'In the data grid', 'seg', ['25', '50', '100'], 1], ['Time zone', 'Used for every timestamp', 'sel', 'UTC'], ['Date format', 'How dates are shown', 'sel', 'YYYY-MM-DD'], ['Keyboard shortcuts', 'Preset or your own', 'sel', 'Default'], ['Confirm on production', 'Ask before a write runs', 'tog', true], ['Auto refresh', 'Reload open tables', 'seg', ['Off', '30s', '1m'], 0], ['NULL display', 'How empty values look', 'sel', 'NULL'], ['Sidebar', 'On open', 'seg', ['Expanded', 'Collapsed'], 0], ['Font size', 'Grid and editor', 'seg', ['S', 'M', 'L'], 1], ['Line numbers', 'In the query editor', 'tog', true], ['Clear cache', 'Saved queries stay', 'sel', 'Clear']];
  function prefsSheet(S, x, y, w, h, o = {}) {
    const k = winK(S, o.t0); if (k <= 0) return;
    const I = inkSet(S), acc = L.readable(o.acc || S.look.accent, I.ink, 3.2), f = Math.max(7, w / 26);
    const extra = ((o.items || []).slice(0, 2)).map(s => [s, '', 'tog', true]);
    const rows = [...extra, ...PREFS], rh = f * 3.5, head = f * 4.6;
    materialise(S, x, y, w, h, 14 * S.u, k, c => {
      c.fillStyle = I.ink; c.fillRect(x, y, w, h);
      L.rr(c, x + f * 1.2, y + head / 2 - f * 0.9, f * 1.8, f * 1.8, f * 0.45); c.fillStyle = rgba(acc, 0.22); c.fill(); L.icon(c, 'settings', x + f * 2.1, y + head / 2, f * 1.15, acc, 2);
      L.text(c, S.look, 'Preferences', x + f * 3.6, y + head / 2 - f * 0.05, { role: 'ui', px: f * 1.08, weight: 600, color: I.fg });
      L.text(c, S.look, brand().name, x + f * 3.6, y + head / 2 + f * 1.15, { role: 'ui', px: f * 0.78, color: I.faint, maxW: w * 0.5 });
      L.icon(c, 'x', x + w - f * 1.8, y + head / 2, f * 1.0, I.dim, 2);
      L.line(c, x, y + head, x + w, y + head, I.line, 1);
      const jump = o.scrollAt != null ? E.io(prog(S.lt, o.scrollAt, 0.22)) : 0, span = clamp(rows.length - Math.floor((h - head - f * 1.5) / rh), 0, 6) * rh;
      const drawRows = off => {
        rows.forEach(([lab, desc, kind, v, s], i) => {
          const ry = y + head + f * 0.6 + i * rh - off; if (ry + rh < y + head || ry > y + h) return;
          const ra = o.t0 != null ? clamp((S.lt - (o.t0 + 0.35 + i * 0.03)) / 0.2) : 1; if (ra <= 0) return;
          c.save(); c.globalAlpha *= ra;
          L.text(c, S.look, lab, x + f * 1.3, ry + rh * 0.42, { role: 'ui', px: f * 0.9, weight: 550, color: I.fg, maxW: w * 0.46 });
          if (desc) L.text(c, S.look, desc, x + f * 1.3, ry + rh * 0.42 + f * 1.15, { role: 'ui', px: f * 0.72, color: I.faint, maxW: w * 0.46 });
          const rx = x + w - f * 1.3, cy = ry + rh * 0.42;
          if (kind === 'seg') { const pw = v.map(t => L.textW(c, S.look, t, { role: 'ui', px: f * 0.72, weight: 600 }) + f * 1.1), tot = pw.reduce((a, b) => a + b, 0) + f * 0.3; let sx = rx - tot; L.rr(c, sx, cy - f * 0.85, tot, f * 1.7, f * 0.45); c.fillStyle = I.raised; c.fill(); sx += f * 0.15; v.forEach((t, j) => { if (j === s) { L.rr(c, sx, cy - f * 0.7, pw[j], f * 1.4, f * 0.35); c.fillStyle = I.hi; c.fill(); } L.text(c, S.look, t, sx + pw[j] / 2, cy + f * 0.26, { role: 'ui', px: f * 0.72, weight: 600, color: j === s ? I.fg : I.dim, align: 'center' }); sx += pw[j]; }); }
          else if (kind === 'dots') { const cols = swatches(o.base || S.look.accent), d = f * 0.95, g = f * 0.42; cols.forEach((col, j) => { const dx = rx - (cols.length - j) * (d + g) + g + d / 2; L.circle(c, dx, cy, d / 2, col); if (L.hex(col).join() === L.hex(o.acc || S.look.accent).join()) L.circle(c, dx, cy, d / 2 + f * 0.3, null, I.fg, 1.4 * S.u); }); }
          else if (kind === 'tog') { const tw_ = f * 2.3, th_ = f * 1.3; L.pill(c, rx - tw_, cy - th_ / 2, tw_, th_, v ? acc : I.hi); L.circle(c, v ? rx - th_ / 2 : rx - tw_ + th_ / 2, cy, th_ * 0.38, '#FFFFFF'); }
          else { const tw_ = L.textW(c, S.look, v, { role: 'micro', px: f * 0.74, tracking: 0 }) + f * 2.6; L.rr(c, rx - tw_, cy - f * 0.85, tw_, f * 1.7, f * 0.45); c.fillStyle = I.raised; c.fill(); L.text(c, S.look, v, rx - tw_ + f * 0.7, cy + f * 0.27, { role: 'micro', px: f * 0.74, color: I.fg, tracking: 0 }); chevron(c, rx - f * 0.9, cy, f * 0.6, I.dim); }
          L.line(c, x + f * 1.3, ry + rh - f * 0.2, x + w - f * 1.3, ry + rh - f * 0.2, rgba(I.fg, 0.05), 1);
          c.restore();
        });
      };
      c.save(); c.beginPath(); c.rect(x, y + head, w, h - head); c.clip();
      const moving = jump > 0 && jump < 1;
      if (moving) { for (let g = 0; g < 4; g++) { c.save(); c.globalAlpha *= 0.3; drawRows(span * E.io(prog(S.lt - g * 0.018, o.scrollAt, 0.22))); c.restore(); } c.fillStyle = rgba(I.ink, 0.35 * Math.sin(Math.PI * jump)); c.fillRect(x, y + head, w, h - head); }
      else drawRows(span * jump);
      // a soft fade at the bottom edge (more below)
      const gfade = c.createLinearGradient(0, y + h - f * 3, 0, y + h); gfade.addColorStop(0, rgba(I.ink, 0)); gfade.addColorStop(1, rgba(I.ink, 0.95)); c.fillStyle = gfade; c.fillRect(x, y + h - f * 3, w, f * 3);
      c.restore();
    });
  }

  /* ───────── terminal: types a one-word update, streams a dim log, lands on a green line ───────── */
  const termLines = (F, o) => { const n = ((F && F.brand) || brand()).name || 'App', s = slugOf(n); return (o && o.lines) || [{ s: `backing up ${s}…` }, { s: 'downloading release', bar: true }, { s: 'verifying checksum' }, { s: 'migrating settings' }, { s: 'restarting service' }, { s: `${n} is up to date`, ok: true }]; };
  const termTimes = (t0, cmd, lines) => { const typeAt = t0 + 0.45, typed = typeAt + cmd.length / 18, out = typed + 0.35; return { typeAt, typed, ts: lines.map((_, i) => out + i * 0.25 + (i > 1 ? 0.35 : 0)) }; };
  function terminal(S, x, y, w, h, o = {}) {
    const k = winK(S, o.t0); if (k <= 0) return;
    const I = inkSet(S), f = Math.max(8, w / 46), B = brand(), cmd = o.cmd || `${slugOf(B.name)} update`, lines = o.lines || termLines(null), tm = termTimes(o.t0 || 0, cmd, lines);
    materialise(S, x, y, w, h, 12 * S.u, k, c => {
      c.fillStyle = I.ink; c.fillRect(x, y, w, h);
      const bar = f * 2.4; c.fillStyle = mix(I.ink, '#FFFFFF', 0.04); c.fillRect(x, y, w, bar);
      ['#FF5F57', '#FEBC2E', '#28C840'].forEach((col, i) => L.circle(c, x + f * 1.3 + i * f * 1.15, y + bar / 2, f * 0.36, mix(col, I.ink, 0.25)));
      L.text(c, S.look, `deploy@server — ~/${slugOf(B.name)}`, x + w / 2, y + bar / 2 + f * 0.3, { role: 'micro', px: f * 0.78, color: I.faint, align: 'center', tracking: 0, maxW: w * 0.6 });
      const px = f * 0.98, lh = px * 1.75, x0 = x + f * 1.4; let yy = y + bar + lh * 1.1;
      L.text(c, S.look, '$', x0, yy, { role: 'micro', px, color: L.readable(S.look.accent, I.ink, 3.2), tracking: 0 });
      const n = Math.max(0, Math.floor((S.lt - tm.typeAt) * 18)), typed = cmd.slice(0, n);
      const ww = L.text(c, S.look, typed, x0 + px * 1.4, yy, { role: 'micro', px, color: I.fg, tracking: 0 });
      const done = S.lt >= tm.ts[0] - 0.2;
      if (!done || Math.floor(S.lt * 2.4) % 2 === 0) { if (!done) { c.fillStyle = I.fg; c.fillRect(x0 + px * 1.4 + ww + 2 * S.u, yy - px * 0.82, px * 0.56, px * 1.02); } }
      lines.forEach((ln, i) => {
        const kk = clamp((S.lt - tm.ts[i]) / 0.1); if (kk <= 0) return; yy += lh;
        c.save(); c.globalAlpha *= kk;
        if (ln.ok) { L.icon(c, 'check', x0 + px * 0.45, yy - px * 0.33, px * 1.1, OK, 2.4); L.text(c, S.look, ln.s, x0 + px * 1.6, yy, { role: 'micro', px, color: OK, tracking: 0, maxW: w - f * 4 }); }
        else {
          const tw_ = L.text(c, S.look, ln.s, x0, yy, { role: 'micro', px, color: I.dim, tracking: 0, maxW: w * 0.5 });
          if (ln.bar) { const bp = E.io(clamp((S.lt - tm.ts[i]) / 0.55)), bw = Math.min(w * 0.3, w - tw_ - f * 9), bx = x0 + tw_ + px * 1.2; L.rr(c, bx, yy - px * 0.62, bw, px * 0.5, px * 0.25); c.fillStyle = I.raised; c.fill(); if (bp > 0) { L.rr(c, bx, yy - px * 0.62, bw * bp, px * 0.5, px * 0.25); c.fillStyle = I.fg; c.fill(); } L.text(c, S.look, `${Math.round(bp * 100)}%`, bx + bw + px * 0.8, yy, { role: 'micro', px, color: I.dim, tracking: 0 }); }
          else if (kk >= 1 && i < lines.length - 1) L.text(c, S.look, 'done', x + w - f * 1.4, yy, { role: 'micro', px: px * 0.9, color: I.faint, tracking: 0, align: 'right' });
        }
        c.restore();
      });
      const last = tm.ts[tm.ts.length - 1];
      if (S.lt > last + 0.3) { yy += lh; L.text(c, S.look, '$', x0, yy, { role: 'micro', px, color: L.readable(S.look.accent, I.ink, 3.2), tracking: 0 }); if (Math.floor(S.lt * 2.4) % 2 === 0) { c.fillStyle = I.fg; c.fillRect(x0 + px * 1.4, yy - px * 0.82, px * 0.56, px * 1.02); } }
    });
  }

  /* ───────── the production guard: a dark modal, red-tinted header, the risky statement, a red primary ───────── */
  function guardModal(S, x, y, w, o = {}) {
    const I = inkSet(S), f = Math.max(8, w / 30), head = f * 4.4, code = f * 6.4, h = head + code + f * 7.4, k = winK(S, o.t0, 0.32);
    if (k <= 0) return h;
    const tbl = tablesFor(S.b)[1] || 'orders', wr = L.readable(WARN, I.ink, 4);
    materialise(S, x, y, w, h, 14 * S.u, k, c => {
      c.fillStyle = mix(I.ink, '#FFFFFF', 0.02); c.fillRect(x, y, w, h);
      const hg = c.createLinearGradient(0, y, 0, y + head); hg.addColorStop(0, mix(I.ink, WARN, 0.24)); hg.addColorStop(1, mix(I.ink, WARN, 0.12)); c.fillStyle = hg; c.fillRect(x, y, w, head);
      L.line(c, x, y + head, x + w, y + head, rgba(WARN, 0.3), 1);
      const pulse = 0.5 + 0.5 * Math.sin(S.lt * 5);
      L.circle(c, x + f * 2.3, y + head / 2, f * 1.25, rgba(WARN, 0.18 + 0.1 * pulse)); triangle(c, x + f * 2.3, y + head / 2, f * 1.15, wr);
      L.text(c, S.look, 'Run on production?', x + f * 4.3, y + head / 2 - f * 0.12, { role: 'ui', px: f * 1.05, weight: 650, color: mix(wr, '#FFFFFF', 0.25), maxW: w - f * 6 });
      L.text(c, S.look, `This statement writes to ${slugOf(brand().name)}-main, a production connection.`, x + f * 4.3, y + head / 2 + f * 1.15, { role: 'ui', px: f * 0.74, color: rgba(mix(wr, '#FFFFFF', 0.4), 0.7), maxW: w - f * 6 });
      const cy0 = y + head + f * 1.2; L.rr(c, x + f * 1.2, cy0, w - f * 2.4, code, f * 0.5); c.fillStyle = I.raised; c.fill();
      [[['UPDATE', 1], [' ' + tbl, 0]], [['SET', 1], [" status = 'refunded'", 0]], [['WHERE', 1], [' id = 4120;', 0]]].forEach((ln, i) => {
        let lx = x + f * 2; const ly = cy0 + f * 1.7 + i * f * 1.5;
        ln.forEach(([s, kw]) => { lx += L.text(c, S.look, s, lx, ly, { role: 'micro', px: f * 0.86, color: kw ? L.readable(S.look.accent, I.raised, 3) : I.fg, tracking: 0 }); });
      });
      L.text(c, S.look, 'You can turn this off in Preferences.', x + f * 1.2, cy0 + code + f * 1.7, { role: 'ui', px: f * 0.74, color: I.faint, maxW: w * 0.9 });
      const by = y + h - f * 2.4, pb = spring(S.lt - ((o.t0 || 0) + 0.3), 'firm'), press = o.press || 0;
      const pl = 'Run on production', pw = L.textW(c, S.look, pl, { role: 'ui', px: f * 0.82, weight: 650 }) + f * 2.2, px0 = x + w - f * 1.2 - pw;
      c.save(); const bcx = px0 + pw / 2; c.translate(bcx, by); c.scale(clamp(pb, 0, 1.2) * (1 - press * 0.05), clamp(pb, 0, 1.2) * (1 - press * 0.05)); c.translate(-bcx, -by);
      L.rr(c, px0, by - f * 0.95, pw, f * 1.9, f * 0.45); c.fillStyle = mix(WARN, '#000000', 0.12); c.fill();
      L.text(c, S.look, pl, bcx, by + f * 0.3, { role: 'ui', px: f * 0.82, weight: 650, color: '#FFFFFF', align: 'center' }); c.restore();
      const cw = L.textW(c, S.look, 'Cancel', { role: 'ui', px: f * 0.82, weight: 600 }) + f * 2; L.rr(c, px0 - f * 0.7 - cw, by - f * 0.95, cw, f * 1.9, f * 0.45); c.strokeStyle = I.line; c.lineWidth = 1; c.stroke();
      L.text(c, S.look, 'Cancel', px0 - f * 0.7 - cw / 2, by + f * 0.3, { role: 'ui', px: f * 0.82, weight: 600, color: I.fg, align: 'center' });
      o.button = { x: bcx, y: by };
    });
    return h;
  }

  /* ───────── swatch ring row (bare, on paper): dots pop in, a thin ink ring hops dot to dot ───────── */
  function swatchRow(S, x, y, d, cols, keys, t0, o = {}) {
    const c = S.ctx, g = d * 0.45;
    cols.forEach((col, j) => { const s = S.lt < t0 + j * 0.05 ? 0 : spring(S.lt - t0 - j * 0.05, 'pop'); if (s <= 0) return; L.circle(c, x + j * (d + g) + d / 2, y, d / 2 * clamp(s, 0, 1.3), col); });
    const ra = clamp((S.lt - t0 - 0.3) / 0.2); if (ra <= 0) return;
    const pos = springTrack(S.lt, keys.map(([t, i]) => [t, i]), 'pop'), rx = x + pos * (d + g) + d / 2;
    c.save(); c.globalAlpha *= ra; L.circle(c, rx, y, d / 2 + d * 0.2, null, o.ring || S.P.fg, Math.max(1.5, d * 0.06)); c.restore();
  }

  /* ════════════════════════ UI widgets ════════════════════════ */
  L.def('ui:ink-data-grid-app', {
    kind: 'ui',
    draw(S, o) { const w = o.w, h = o.h || o.w * 0.62, x = o.x - w / 2, y = o.y - h / 2, k = winK(S, o.t0); materialise(S, x, y, w, h, 14 * S.u, k, () => drawApp(S, x, y, w, h, { acc: o.acc, rowsAt: (o.t0 || 0) + 0.35, hi: 3, sel: o.sel || 0 })); return { x, y, w, h }; },
  });
  L.def('ui:ink-browser-url-typer', {
    kind: 'ui',
    draw(S, o) {
      const w = o.w, h = o.h || w * 0.62, x = o.x - w / 2, y = o.y - h / 2, t0 = o.t0 || 0, k = winK(S, t0), host = o.host || brand().host;
      const typeAt = t0 + 0.45, n = Math.floor(clamp((S.lt - typeAt) * 26, 0, host.length)), appAt = typeAt + host.length / 26 + 0.15;
      materialise(S, x, y, w, h, 14 * S.u, k, c => {
        c.fillStyle = inkSet(S).ink; c.fillRect(x, y, w, h);
        const r = chrome(S, x, y, w, h, { host, typed: n, caret: S.lt < appAt && Math.floor(S.lt * 2.4) % 2 === 0 });
        const a = E.out(prog(S.lt, appAt, 0.35)); if (a > 0 && o.content !== false) { c.save(); c.globalAlpha *= a; c.translate(0, (1 - a) * 10 * S.u); inner(S, r, { acc: o.acc, rowsAt: appAt + 0.1, hi: 2 }); c.restore(); }
      });
    },
  });
  L.def('ui:connection-env-list', {
    kind: 'ui',
    draw(S, o) {
      const I = inkSet(S), w = Math.max(o.w, 420 * S.u), f = w / 26, B = brand(), sl = slugOf(B.name);
      const rows = [[sl + '-main', 'db-1.eu-west', 'prod'], [sl + '-replica', 'db-2.eu-west', 'prod'], ['staging', 'stg.internal', 'stg'], ['analytics', 'warehouse.internal', 'stg'], ['local', 'localhost:5432', 'dev']];
      const rh = f * 3.2, head = f * 3.8, h = head + rows.length * rh + f * 0.8, x = o.x - w / 2, y = o.y - h / 2, k = winK(S, o.t0);
      materialise(S, x, y, w, h, 14 * S.u, k, c => {
        c.fillStyle = I.ink; c.fillRect(x, y, w, h);
        L.text(c, S.look, 'Connections', x + f * 1.3, y + head / 2 + f * 0.38, { role: 'ui', px: f * 1.05, weight: 600, color: I.fg });
        L.rr(c, x + w - f * 3.2, y + head / 2 - f * 0.9, f * 1.8, f * 1.8, f * 0.4); c.fillStyle = I.raised; c.fill(); L.icon(c, 'plus', x + w - f * 2.3, y + head / 2, f * 1.0, I.fg, 2);
        L.line(c, x, y + head, x + w, y + head, I.line, 1);
        rows.forEach(([n, host, env], i) => {
          const a = clamp((S.lt - ((o.t0 || 0) + 0.35 + i * 0.09)) / 0.25); if (a <= 0) return;
          const ry = y + head + f * 0.4 + i * rh; c.save(); c.globalAlpha *= a; c.translate((1 - E.out(a)) * 14 * S.u, 0);
          const col = env === 'prod' ? WARN : env === 'stg' ? AMBER : OK;
          L.rr(c, x + f * 1.1, ry + rh / 2 - f * 1.05, f * 2.1, f * 2.1, f * 0.5); c.fillStyle = rgba(col, 0.13); c.fill(); L.icon(c, 'layers', x + f * 2.15, ry + rh / 2, f * 1.15, col, 2);
          L.text(c, S.look, n, x + f * 4, ry + rh / 2 - f * 0.12, { role: 'ui', px: f * 0.95, weight: 550, color: I.fg, maxW: w * 0.5 });
          L.text(c, S.look, host, x + f * 4, ry + rh / 2 + f * 1.05, { role: 'micro', px: f * 0.72, color: I.faint, tracking: 0, maxW: w * 0.5 });
          const tw_ = L.textW(c, S.look, env, { role: 'micro', px: f * 0.75, tracking: 0.04 }) + f * 1.0; envTag(S, x + w - f * 1.3 - tw_, ry + rh / 2, env, f * 1.07);
          if (env === 'prod') { const p = 0.5 + 0.5 * Math.sin(S.lt * 4 + i); L.circle(c, x + w - f * 2.6 - tw_, ry + rh / 2, f * 0.28, rgba(WARN, 0.5 + 0.5 * p)); }
          if (i < rows.length - 1) L.line(c, x + f * 1.1, ry + rh, x + w - f * 1.1, ry + rh, rgba(I.fg, 0.05), 1);
          c.restore();
        });
      });
    },
  });
  L.def('ui:accent-swatch-card', {
    kind: 'ui',
    draw(S, o) {
      const I = inkSet(S), w = Math.max(o.w, 420 * S.u), f = w / 24, h = f * 15, x = o.x - w / 2, y = o.y - h / 2, t0 = o.t0 || 0, k = winK(S, t0);
      const cols = swatches(S.look.accent), gap = 0.88, ts = cols.map((_, i) => t0 + 0.9 + i * gap), idx = ts.filter(t => S.lt >= t).length, cur = Math.max(0, idx - 1) % cols.length;
      const prevC = cols[(cur + cols.length - 1) % cols.length], col = idx ? mix(prevC, cols[cur], clamp((S.lt - ts[idx - 1]) / 0.1)) : cols[0];
      materialise(S, x, y, w, h, 16 * S.u, k, c => {
        c.fillStyle = I.ink; c.fillRect(x, y, w, h);
        L.text(c, S.look, 'Accent colour', x + f * 1.4, y + f * 2.4, { role: 'ui', px: f * 1.0, weight: 600, color: I.fg });
        L.text(c, S.look, 'Buttons, links and highlights', x + f * 1.4, y + f * 3.7, { role: 'ui', px: f * 0.75, color: I.faint });
        const d = f * 2.1, g = d * 0.45;
        swatchRow(S, x + f * 1.4, y + f * 6.6, d, cols, [[0, 0], ...ts.map((t, i) => [t, i % cols.length])], t0 + 0.2, { ring: I.fg });
        L.line(c, x + f * 1.4, y + f * 9.0, x + w - f * 1.4, y + f * 9.0, I.line, 1);
        // live preview: a primary button and the italic word in the current accent
        const acc = L.readable(col, I.ink, 3.2), by = y + f * 11.9;
        L.rr(c, x + f * 1.4, by - f * 1.05, f * 7.2, f * 2.1, f * 0.5); c.fillStyle = acc; c.fill();
        L.text(c, S.look, '+ New row', x + f * 5, by + f * 0.33, { role: 'ui', px: f * 0.85, weight: 600, color: L.onColor(acc), align: 'center' });
        L.text(c, S.look, 'yours.', x + f * 9.6, by + f * 0.7, { role: 'accent', px: f * 2.4, color: acc });
        L.text(c, S.look, acc.toUpperCase(), x + w - f * 1.4, by + f * 0.3, { role: 'micro', px: f * 0.75, color: I.faint, align: 'right', tracking: 0.06 });
      });
    },
  });
  L.def('ui:ink-preferences-sheet', {
    kind: 'ui',
    draw(S, o) { const h = Math.min(S.H * 0.84, (o.h || o.w * 0.6) * 1.6), w = Math.min(o.w, h * 0.62); prefsSheet(S, o.x - w / 2, o.y - h / 2, w, h, { t0: o.t0, scrollAt: (o.t0 || 0) + 2.0, items: o.items }); },
  });
  L.def('ui:terminal-update-stream', {
    kind: 'ui',
    draw(S, o) { const w = o.w, h = o.h || w * 0.6; terminal(S, o.x - w / 2, o.y - h / 2, w, h, { t0: o.t0, lines: termLines(L.film) }); },
  });
  L.def('ui:production-guard-modal', {
    kind: 'ui',
    draw(S, o) { const w = Math.min(o.w, S.W * 0.8), f = w / 30, h = f * 4.4 + f * 6.4 + f * 7.4; guardModal(S, o.x - w / 2, o.y - h / 2, w, { t0: o.t0, press: o.press }); },
  });

  /* ════════════════════════ type treatments ════════════════════════ */
  const accentFirst = tk => tk.findIndex(t => t.accent);
  // serif words focus in: blur 12 → 0 with a small rise, 80 ms apart; the accent word a touch later and slower
  L.def('effect:type-serif-focus-rise', {
    kind: 'type',
    plan(b, F, t0 = 0) { const tk = toks(b), ws = tk.map((t, i) => +(t0 + i * 0.08 + (t.accent ? 0.05 : 0)).toFixed(3)), a = accentFirst(tk); return { words: ws, done: (ws[ws.length - 1] || t0) + 0.5, events: [{ at: t0, event: 'word' }, ...(a >= 0 ? [{ at: ws[a] + 0.2, event: 'key-word' }] : [])] }; },
    draw(S, o) {
      const t0 = o.t0 || 0;
      for (const w of o.lay.words) { const at = t0 + w.i * 0.08 + (w.tk.accent ? 0.05 : 0), k = prog(S.lt, at, w.tk.accent ? 0.52 : 0.42), e = E.out(k); wd(S, w, { a: clamp(k * 1.7), blur: (1 - e) * 12 * S.u, dy: (1 - e) * 12 * S.u, grey: (1 - e) * 0.8 }); }
    },
  });
  // the italic accent arrives last: roman words land together, a held breath, then the italic word racks into focus
  L.def('effect:type-italic-accent-late', {
    kind: 'type',
    plan(b, F, t0 = 0) { const tk = toks(b), nr = tk.filter(t => !t.accent).length, at = t0 + nr * 0.05 + 0.34; return { words: tk.map((t, i) => (t.accent ? at : t0 + i * 0.05)), done: at + 0.62, events: [{ at: t0, event: 'word' }, { at: at + 0.12, event: 'key-word' }] }; },
    draw(S, o) {
      const t0 = o.t0 || 0, ws = o.lay.words, nr = ws.filter(w => !w.tk.accent).length, at = t0 + nr * 0.05 + 0.34; let r = 0;
      for (const w of ws) {
        if (w.tk.accent) { const k = prog(S.lt, at + (w.i - ws.findIndex(x => x.tk.accent)) * 0.06, 0.62), e = E.out(k); wd(S, w, { a: clamp(k * 1.5), blur: (1 - e) * 16 * S.u, s: lerp(1.07, 1, e), dy: (1 - e) * 6 * S.u }); }
        else { const k = prog(S.lt, t0 + (r++) * 0.05, 0.45), e = E.out(k); wd(S, w, { a: clamp(k * 1.8), blur: (1 - e) * 8 * S.u, dy: (1 - e) * 14 * S.u, grey: 1 - e }); }
      }
    },
  });
  // the accent phrase takes the last line by itself (Updates in / one command.)
  L.def('effect:type-accent-own-line', {
    kind: 'type',
    plan(b, F, t0 = 0) { const tk = toks(b), a = Math.max(0, accentFirst(tk)), at = t0 + a * 0.07 + 0.3; return { words: tk.map((_, i) => (i < a ? t0 + i * 0.07 : at)), done: at + 0.6, events: [{ at: t0, event: 'word' }, { at: at + 0.1, event: 'key-word' }] }; },
    draw(S, o) {
      const lay = o.lay, t0 = o.t0 || 0, tk = lay.words.map(w => w.tk), a = accentFirst(tk);
      let ws1 = lay.words, ws2 = [];
      if (a > 0 && lay.lines >= 2 && o.slot) {
        const sl = Object.assign({}, o.slot, { px: lay.px, min: lay.px * 0.6 });
        const l1 = L.layout(S.ctx, S.look, tk.slice(0, a), Object.assign({}, sl, { maxLines: Math.max(1, lay.lines - 1) }));
        const l2 = L.layout(S.ctx, S.look, tk.slice(a), Object.assign({}, sl, { y: l1.top + l1.H, maxLines: 1, px: l1.px }));
        ws1 = l1.words; ws2 = l2.words;
      } else { ws1 = lay.words.filter(w => !w.tk.accent); ws2 = lay.words.filter(w => w.tk.accent); }
      const at = t0 + Math.max(0, a) * 0.07 + 0.3;
      ws1.forEach((w, i) => { const k = prog(S.lt, t0 + i * 0.07, 0.42), e = E.out(k); wd(S, w, { a: clamp(k * 1.7), blur: (1 - e) * 10 * S.u, dy: (1 - e) * 12 * S.u, grey: 1 - e }); });
      ws2.forEach((w, i) => { const k = prog(S.lt, at + i * 0.07, 0.55), e = E.out(k); wd(S, w, { a: clamp(k * 1.6), blur: (1 - e) * 14 * S.u, dy: (1 - e) * 18 * S.u }); });
    },
  });
  // phrase by phrase: the line arrives in its sentences (Self-hosted. / $79 once. / Source included.)
  const phraseOf = tk => { let g = 0; return tk.map(t => { const v = g; if (/[.!?;:,]$/.test(t.s)) g++; return v; }); };
  L.def('effect:type-phrase-blur-in', {
    kind: 'type',
    plan(b, F, t0 = 0) { const tk = toks(b), ph = phraseOf(tk), n = (ph[ph.length - 1] || 0) + 1, ev = []; for (let g = 0; g < n; g++) ev.push({ at: t0 + g * 0.27, event: tk.some((t, i) => ph[i] === g && t.accent) ? 'key-word' : 'word' }); return { words: ph.map(g => t0 + g * 0.27), done: t0 + (n - 1) * 0.27 + 0.45, events: ev }; },
    draw(S, o) { const t0 = o.t0 || 0, ph = phraseOf(o.lay.words.map(w => w.tk)); for (const w of o.lay.words) { const k = prog(S.lt, t0 + ph[w.i] * 0.27 + (w.i % 3) * 0.02, 0.34), e = E.out(k); wd(S, w, { a: clamp(k * 1.6), blur: (1 - e) * 10 * S.u, dy: (1 - e) * 7 * S.u }); } },
  });
  // the accent word lands in the brand colour, then turns alarm red (a safety beat)
  L.def('effect:type-warning-red-flip', {
    kind: 'type',
    plan(b, F, t0 = 0) { const tk = toks(b), a = accentFirst(tk), ws = tk.map((_, i) => t0 + i * 0.07), at = a >= 0 ? ws[a] : ws[ws.length - 1] || t0; return { words: ws, done: at + 0.95, events: [{ at: t0, event: 'word' }, { at: at + 0.15, event: 'key-word' }, { at: at + 0.55, event: 'notify' }] }; },
    draw(S, o) {
      const t0 = o.t0 || 0, ws = o.lay.words, a = ws.findIndex(w => w.tk.accent), at = t0 + (a >= 0 ? a : ws.length - 1) * 0.07, red = L.readable(WARN, S.P.bg, 3.2);
      const fk = E.out(prog(S.lt, at + 0.55, 0.22)), pop = 1 + 0.07 * Math.sin(Math.PI * clamp(prog(S.lt, at + 0.55, 0.3)));
      for (const w of ws) { const k = prog(S.lt, t0 + w.i * 0.07, 0.45), e = E.out(k); wd(S, w, { a: clamp(k * 1.7), blur: (1 - e) * 10 * S.u, dy: (1 - e) * 12 * S.u, grey: w.tk.accent ? 0 : (1 - e), accent: w.tk.accent ? mix(S.P.accent, red, fk) : null, s: w.tk.accent ? pop : 1 }); }
    },
  });
  // each character rises out of its own mask one after another (the version numerals), dots ride with their digit
  function glyphs(S, w) { const s = w.s, out = []; L.setFont(S.ctx, S.look, w.role, w.px, w.tk.weight); try { S.ctx.letterSpacing = w.tr.toFixed(2) + 'px'; } catch (e) { /* */ } for (let j = 0; j < s.length; j++) { const x = S.ctx.measureText(s.slice(0, j)).width; if (/[.,:;!?]/.test(s[j]) && out.length) out[out.length - 1].s += s[j]; else out.push({ s: s[j], x: w.x + x }); } return out; }
  const glyphCount = tk => tk.reduce((n, t) => n + t.s.replace(/[.,:;!?]/g, '').length, 0);
  L.def('effect:type-char-mask-rise', {
    kind: 'type',
    plan(b, F, t0 = 0) { const n = Math.max(1, glyphCount(toks(b))), gap = Math.min(0.133, 0.9 / n); return { words: toks(b).map(() => t0), done: t0 + gap * (n - 1) + 0.42, events: [{ at: t0, event: 'riffle' }, { at: t0 + gap * (n - 1) + 0.3, event: 'stat' }] }; },
    draw(S, o) {
      const c = S.ctx, t0 = o.t0 || 0, lay = o.lay, n = Math.max(1, glyphCount(lay.words.map(w => w.tk))), gap = Math.min(0.133, 0.9 / n); let gi = 0;
      for (const w of lay.words) {
        for (const g of glyphs(S, w)) {
          const k = prog(S.lt, t0 + gi * gap, 0.37), e = E.settle(k); gi++; if (k <= 0) continue;
          c.save(); c.beginPath(); c.rect(g.x - w.px * 0.2, w.y - w.px * 1.05, w.px * 1.4, w.px * 1.35); c.clip();
          if (k < 1) c.filter = `blur(${((1 - e) * 6 * S.u).toFixed(2)}px)`;
          L.drawWord(c, S.look, S.P, Object.assign({}, w, { s: g.s }), { x: g.x, y: w.y + (1 - e) * Math.max(85 * S.u, w.px * 0.62) });
          c.restore();
        }
      }
    },
  });
  // the line focuses in, then a short accent rule is drawn outward from its centre beneath it
  L.def('effect:type-centre-rule-settle', {
    kind: 'type',
    plan(b, F, t0 = 0) { const n = toks(b).length, ra = t0 + n * 0.05 + 0.32; return { words: toks(b).map((_, i) => t0 + i * 0.05), done: ra + 0.36, events: [{ at: t0, event: 'word' }, { at: ra, event: 'accent' }] }; },
    draw(S, o) {
      const c = S.ctx, t0 = o.t0 || 0, lay = o.lay, ra = t0 + lay.words.length * 0.05 + 0.32;
      for (const w of lay.words) { const k = prog(S.lt, t0 + w.i * 0.05, 0.45), e = E.out(k); wd(S, w, { a: clamp(k * 1.7), blur: (1 - e) * 10 * S.u, dy: (1 - e) * 10 * S.u }); }
      const k = E.out(prog(S.lt, ra, 0.36)); if (k <= 0) return;
      const last = lay.words.filter(w => w.li === lay.lines - 1), x0 = Math.min(...last.map(w => w.x)), x1 = Math.max(...last.map(w => w.x + w.w)), cx = (x0 + x1) / 2;
      const rw = Math.min((x1 - x0) * 0.4, 280 * S.u) * k, rh = Math.max(3 * S.u, lay.px * 0.036), y = last[0].y + lay.px * 0.3;
      L.rr(c, cx - rw / 2, y, rw, rh, rh / 2); c.fillStyle = S.P.accent; c.fill();
    },
  });

  /* ════════════════════════ set-ups ════════════════════════ */
  const headPx = (S, b, base) => { const n = toks(b).length; return S.u * base * (n <= 2 ? 1.2 : n <= 4 ? 1 : n <= 7 ? 0.82 : 0.68) * (isTall(S) ? 0.92 : 1); };
  // split: type in a left column (wide) or on top (square/tall), a dark product rect beside or under it
  function split(S, o = {}) {
    if (isWide(S)) return { wide: true, tx: S.W * 0.055, tw: S.W * (o.tw || 0.33), px: (o.px || 104) * S.u, cy: S.H * 0.5, win: o.win || { x: S.W * 0.415, y: S.H * 0.14, w: S.W * 0.55, h: S.H * 0.72 } };
    const tall = isTall(S), ty = S.H * (tall ? 0.09 : 0.08), wy = S.H * (tall ? 0.4 : 0.44);
    return { wide: false, tx: S.W * 0.08, tw: S.W * 0.84, px: (o.px || 104) * S.u * (tall ? 1.22 : 1.02), ty, win: o.winT || { x: S.W * 0.06, y: wy, w: S.W * 0.88, h: S.H - wy - S.H * (tall ? 0.07 : 0.05) } };
  }
  // the left (or top) text block: headline + grey body copy, vertically centred in wide frames; returns the layout
  function textBlock(S, L_, o = {}) {
    const b = S.b, c = S.ctx, toks_ = o.tokens || toks(b);
    const lay0 = L.layout(c, S.look, toks_, { px: L_.px, maxW: L_.tw, x: 0, y: 0, align: 'left', maxLines: o.maxLines || 4, lineH: 1.02, min: L_.px * 0.75 });
    const extra = (o.below || 0) * S.u, top = L_.wide ? L_.cy - (lay0.H + extra) / 2 : L_.ty;
    const S2 = o.acc ? withAccent(S, o.acc) : S;
    const lay = L.headline(S2, { px: L_.px, maxW: L_.tw, x: L_.tx, y: top, align: 'left', maxLines: o.maxLines || 4, lineH: 1.02, min: L_.px * 0.75 }, { tokens: toks_, type: o.type });
    if (o.sub && lay) L.subDraw(S, o.sub, L_.tx, lay.bottom + 22 * S.u, L_.tw * 0.95, 'left', o.subPx || 26);
    return lay || lay0;
  }

  /* 1. line relay: a short line focuses in, greys out, and the second line replaces it in place with its italic word */
  const splitRelay = tk => { let i = tk.findIndex((t, j) => j < tk.length - 1 && /[.?!,;:]$/.test(t.s)); if (i < 0) i = Math.ceil(tk.length / 2) - 1; return [tk.slice(0, i + 1), tk.slice(i + 1)]; };
  const withToks = (b, tokens) => Object.assign({}, b, { text: Object.assign({}, b.text, { tokens }) });
  L.def('insert:serif-line-relay', {
    kind: 'setup',
    plan(b, F) {
      const [p1, p2] = splitRelay(toks(b)), t1 = T(withToks(b, p1), F, 0.08), swap = Math.max(t1.done + 0.45, 1.25), head2 = swap + 0.1, t2 = T(withToks(b, p2.length ? p2 : p1), F, head2);
      return { cues: { head: 0.08, swap, head2, headDone: t2.done, sub: t2.done + 0.1 }, events: [...t1.events, ...t2.events.map(e => Object.assign({}, e))], min: t2.done + 1.0, exit: { kind: 'dot', x: 0.5, y: 0.5, r: 0.01 }, entry: { kind: 'dot', x: 0.5, y: 0.5, r: 0.01 } };
    },
    draw(S) {
      const b = S.b, c = S.ctx, [p1, p2] = splitRelay(toks(b)), maxW = S.W * (isWide(S) ? 0.74 : 0.86);
      const px1 = headPx(S, withToks(b, p1), 150), px2 = headPx(S, withToks(b, p2), 150);
      const out = prog(S.lt, S.at('swap'), 0.2);
      if (out < 1) {
        const l0 = L.layout(c, S.look, p1, { px: px1, maxW, x: S.W / 2, y: 0, align: 'center', maxLines: 2 });
        const S1 = Object.assign({}, S, { P: Object.assign({}, S.P, { fg: mix(S.P.fg, S.P.bg, clamp(prog(S.lt, S.at('swap') - 0.06, 0.12)) * 0.6) }) });
        c.save(); c.globalAlpha *= 1 - E.in(out); L.headline(S1, { px: px1, maxW, x: S.W / 2, y: S.H * 0.5 - l0.H / 2, align: 'center', maxLines: 2 }, { tokens: p1, t0: S.at('head') }); c.restore();
      }
      if (p2.length && S.lt >= S.at('head2')) {
        const l0 = L.layout(c, S.look, p2, { px: px2, maxW, x: S.W / 2, y: 0, align: 'center', maxLines: 2 });
        const lay = L.headline(S, { px: px2, maxW, x: S.W / 2, y: S.H * 0.5 - l0.H / 2, align: 'center', maxLines: 2 }, { tokens: p2, t0: S.at('head2') });
        if (b.text.sub && lay) L.subDraw(S, b.text.sub, S.W / 2, lay.bottom + 30 * S.u, maxW * 0.7, 'center', 30);
      }
    },
  });

  /* 2. the window soaks into being out of the paper, its address types, the product fills it, a grey caption under it */
  const revealRect = S => isWide(S) ? { x: 0.146, y: 0.045, w: 0.708, h: 0.8 } : isTall(S) ? { x: 0.05, y: 0.16, w: 0.9, h: 0.6 } : { x: 0.06, y: 0.07, w: 0.88, h: 0.74 };
  L.def('insert:ink-window-url-reveal', {
    kind: 'setup',
    plan(b, F) {
      const host = (F && F.brand && F.brand.host) || 'brand.com', win = 0.08, url = 0.55, app = url + host.length / 26 + 0.2, cap = app + 0.55;
      return { cues: { win, url, app, sub: cap, head: cap, focusIn: app + 0.4 }, events: [{ at: win, event: 'card-in' }, { at: url, event: 'code' }, { at: app, event: 'ui-reveal' }, { at: cap, event: 'word' }], min: cap + 1.4, entry: { kind: 'rect', x: 0.5, y: 0.45, w: 0.71, h: 0.8 }, exit: { kind: 'rect', x: 0.5, y: 0.45, w: 0.71, h: 0.8 } };
    },
    draw(S) {
      const b = S.b, c = S.ctx, R = revealRect(S), x = R.x * S.W, y = R.y * S.H, w = R.w * S.W, h = R.h * S.H, host = brand().host;
      const n = Math.floor(clamp((S.lt - S.at('url')) * 26, 0, host.length));
      materialise(S, x, y, w, h, 16 * S.u, winK(S, S.at('win')), cc => {
        cc.fillStyle = inkSet(S).ink; cc.fillRect(x, y, w, h);
        const r = chrome(S, x, y, w, h, { host, typed: n, caret: S.lt < S.at('app') && Math.floor(S.lt * 2.4) % 2 === 0 });
        const a = E.out(prog(S.lt, S.at('app'), 0.4)); if (a > 0) { cc.save(); cc.globalAlpha *= a; inner(S, r, { rowsAt: S.at('app') + 0.05, hi: 2 }); cc.restore(); }
      });
      // the caption: the beat's line in quiet grey grotesk under the window (the accent word keeps its colour)
      const k = E.out(prog(S.lt, S.at('sub'), 0.45)); if (k <= 0 || !toks(b).length) return;
      const cy = y + h + (S.H - y - h) * 0.42;
      c.save(); c.globalAlpha *= k; c.translate(0, (1 - k) * 8 * S.u);
      const lay = L.layout(c, S.look, toks(b).map(t => ({ s: t.s, accent: t.accent, role: 'ui' })), { role: 'ui', px: (isWide(S) ? 30 : 36) * S.u, maxW: S.W * 0.8, x: S.W / 2, y: cy - 20 * S.u, align: 'center', maxLines: 2, lineH: 1.3, space: 0.28 });
      for (const w of lay.words) L.drawWord(c, S.look, S.P, w, { color: S.P.dim });
      c.restore();
    },
  });

  /* 3. query run: a serif line over the app; SQL types into the editor, the cursor hits Run, the rows stream in */
  const sqlFor = (b, F) => `select * from ${tablesFor(b)[0]} where status = 'active' order by updated_at desc;`;
  L.def('insert:ink-query-run', {
    kind: 'setup',
    plan(b, F) {
      const tp = T(b, F, 0.05), win = 0.15, type = 0.7, q = sqlFor(b, F), typed = type + q.length / 34, click = typed + 0.3;
      return { cues: { head: 0.05, headDone: tp.done, win, type, click, rows: click + 0.15, focusIn: click + 0.4 }, events: [...tp.events, { at: win, event: 'card-in' }, { at: type, event: 'code' }, { at: click, event: 'click-ui' }, { at: click + 0.15, event: 'cascade' }], min: click + 1.6, exit: { kind: 'rect', x: 0.5, y: 0.6, w: 0.78, h: 0.7 }, entry: { kind: 'rect', x: 0.5, y: 0.6, w: 0.78, h: 0.7 } };
    },
    draw(S) {
      const b = S.b, c = S.ctx, wide = isWide(S), q = sqlFor(b), nq = Math.floor(clamp((S.lt - S.at('type')) * 34, 0, q.length));
      const px = (wide ? 70 : 76) * S.u, top = S.H * (wide ? 0.07 : 0.06);
      const lay = L.headline(S, { px, maxW: S.W * (wide ? 0.7 : 0.86), x: S.W / 2, y: top, align: 'center', maxLines: 2 });
      const wy = (lay ? lay.bottom : top + px) + S.H * 0.045, w = S.W * (wide ? 0.78 : 0.9), x = S.W / 2 - w / 2, h = S.H * (wide ? 0.95 : 0.94) - wy;
      const press = L.pressAt([S.at('click')], S.lt).p, oo = { query: q.slice(0, nq), caret: nq < q.length || Math.floor(S.lt * 2.4) % 2 === 0, press, rowsAt: S.lt >= S.at('rows') ? S.at('rows') : 1e9, rows: S.lt >= S.at('rows') ? 99 : 0, hi: 1, tab: 1, primary: 'Save query' };
      materialise(S, x, wy, w, h, 14 * S.u, winK(S, S.at('win')), () => drawApp(S, x, wy, w, h, oo));
      if (oo.runAt) L.cursorDraw(S, [[S.at('type') + 0.2, 0.7, 0.98], [S.at('click') - 0.06, oo.runAt.x / S.W + 0.004, oo.runAt.y / S.H + 0.01], [S.at('click') + 1.2, oo.runAt.x / S.W - 0.04, oo.runAt.y / S.H + 0.16]], [S.at('click')]);
    },
  });

  /* 4. the release lockup: logo, the version rising digit by digit, an accent rule drawn from the centre, OUT NOW */
  const versionOf = b => { const d = b.data || {}; if (d.version) return String(d.version); const t = toks(b).find(t => /\d/.test(t.s)); if (t) return t.s.replace(/[^\w.$%+]/g, ''); const n = d.number; if (n && n.value != null) return `${n.prefix || ''}${n.value}${n.suffix || ''}`; return '1.0'; };
  L.def('insert:release-version-lockup', {
    kind: 'setup',
    plan(b, F) { const v = versionOf(b), n = v.replace(/[.,]/g, '').length, dig = 0.22, last = dig + 0.133 * (n - 1) + 0.37, rule = dig + 0.133 * Math.min(n - 1, 2) + 0.3; return { cues: { logo: 0.05, dig, rule, caps: rule + 0.33, sub: rule + 0.6, headDone: last }, events: [{ at: 0, event: 'hard-hit' }, ...Array.from({ length: n }, (_, i) => ({ at: dig + i * 0.133, event: 'list-item' })), { at: last - 0.05, event: 'stat' }], min: rule + 1.6, entry: { kind: 'dot', x: 0.5, y: 0.5, r: 0.01 }, exit: { kind: 'dot', x: 0.5, y: 0.64, r: 0.01 } }; },
    draw(S) {
      const b = S.b, c = S.ctx, v = versionOf(b), B = brand(), cx = S.W / 2;
      let px = Math.min(S.H * 0.28, S.W * 0.3); const nw = L.textW(c, S.look, v, { role: 'numeral', px }); if (nw > S.W * 0.8) px *= S.W * 0.8 / nw;
      const vw = L.textW(c, S.look, v, { role: 'numeral', px }), base = S.H * 0.5 + px * 0.3, x0 = cx - vw / 2;
      // logo row
      const lk = E.out(prog(S.lt, S.at('logo'), 0.3)), ly = base - px * 0.95 - 30 * S.u, lpx = Math.max(26 * S.u, px * 0.13);
      if (lk > 0) {
        c.save(); c.globalAlpha *= lk; const logo = L.img('logo');
        const nmW = L.textW(c, S.look, B.name, { role: 'ui', px: lpx, weight: 650 }), mark = lpx * 1.25, tot = mark + lpx * 0.4 + nmW, lx = cx - tot / 2;
        if (logo) { const s = mark / Math.max(logo.width, logo.height); c.drawImage(logo, lx, ly - mark * 0.5 - lpx * 0.36 + mark * 0.0, logo.width * s, logo.height * s); }
        else { L.rr(c, lx, ly - lpx * 0.36 - mark / 2, mark, mark, mark * 0.26); c.fillStyle = S.P.accent; c.fill(); L.icon(c, 'layers', lx + mark / 2, ly - lpx * 0.36, mark * 0.62, L.onColor(S.P.accent), 2.2); }
        L.text(c, S.look, B.name, lx + mark + lpx * 0.4, ly, { role: 'ui', px: lpx, weight: 650, color: S.P.accent });
        c.restore();
      }
      // digits: each group rises out of its own mask
      const groups = []; for (let j = 0; j < v.length; j++) { const gx = x0 + L.textW(c, S.look, v.slice(0, j), { role: 'numeral', px }); if (/[.,]/.test(v[j]) && groups.length) groups[groups.length - 1].s += v[j]; else groups.push({ s: v[j], x: gx }); }
      groups.forEach((g, i) => {
        const k = prog(S.lt, S.at('dig') + i * 0.133, 0.37), e = E.settle(k); if (k <= 0) return;
        c.save(); c.beginPath(); c.rect(g.x - px * 0.1, base - px * 1.0, px * 1.2, px * 1.25); c.clip();
        if (k < 1) c.filter = `blur(${((1 - e) * 6 * S.u).toFixed(2)}px)`;
        L.text(c, S.look, g.s, g.x, base + (1 - e) * Math.max(85 * S.u, px * 0.42), { role: 'numeral', px, color: S.P.fg });
        c.restore();
      });
      // the rule from the centre, then the caps
      const rk = E.out(prog(S.lt, S.at('rule'), 0.36)), ry = base + px * 0.2, rw = Math.min(vw * 0.62, 280 * S.u) * rk, rh = Math.max(4 * S.u, px * 0.018);
      if (rk > 0) { L.rr(c, cx - rw / 2, ry, rw, rh, rh / 2); c.fillStyle = S.P.accent; c.fill(); }
      caps(S, b.text.eyebrow || 'Out now', cx, ry + 54 * S.u, E.out(prog(S.lt, S.at('caps'), 0.2)), { px: 18 });
      if (b.text.sub) { const sk = E.out(prog(S.lt, S.at('sub'), 0.4)); if (sk > 0) { c.save(); c.globalAlpha *= sk; L.text(c, S.look, b.text.sub, cx, ry + 104 * S.u, { role: 'ui', px: 26 * S.u, color: S.P.dim, align: 'center', maxW: S.W * 0.7 }); c.restore(); } }
    },
  });

  /* 5. make it yours: left line with the swatch row; the ring hops on the beat and the app + the italic word recolour */
  const swapTimes = (b, F) => { const gap = clamp(2 * beatLen(F), 0.7, 1.1), d = b.d || 6, n = clamp(Math.floor((d - 1.0 - 0.4) / gap) + 1, 1, 6); return Array.from({ length: n }, (_, i) => +(1.0 + i * gap).toFixed(3)); };
  L.def('insert:accent-picker-recolour', {
    kind: 'setup',
    plan(b, F) { const tp = T(b, F, 0.1), ts = swapTimes(b, F); return { cues: { head: 0.1, headDone: tp.done, win: 0.15, dots: 0.5, sub: tp.done + 0.1 }, events: [...tp.events, { at: 0.15, event: 'card-in' }, { at: 0.5, event: 'cascade' }, ...ts.map(t => ({ at: t, event: 'click-ui' }))], min: 1.0 + 5 * clamp(2 * beatLen(F), 0.7, 1.1) + 0.6, exit: { kind: 'rect', x: 0.69, y: 0.5, w: 0.55, h: 0.72 }, entry: { kind: 'rect', x: 0.69, y: 0.5, w: 0.55, h: 0.72 } }; },
    draw(S) {
      const b = S.b, c = S.ctx, ts = swapTimes(b, L.film), cols = swatches(S.look.accent), idx = ts.filter(t => S.lt >= t).length;
      const cur = idx % cols.length, prev = (idx + cols.length - 1) % cols.length, col = idx ? mix(cols[prev], cols[cur], clamp((S.lt - ts[idx - 1]) / 0.1)) : cols[0];
      const acc = L.readable(col, S.P.bg, 3), Lx = split(S);
      const lay = textBlock(S, Lx, { acc, sub: b.text.sub, below: 150 });
      const d = (Lx.wide ? 40 : 46) * S.u, dy = (lay ? lay.bottom : S.H * 0.5) + (b.text.sub ? 130 : 60) * S.u;
      swatchRow(S, Lx.tx + d * 0.1, dy, d, cols, [[0, 0], ...ts.map((t, i) => [t, (i + 1) % cols.length])], S.at('dots'));
      const W_ = Lx.win, k = winK(S, S.at('win'));
      materialise(S, W_.x, W_.y, W_.w, W_.h, 14 * S.u, k, () => drawApp(S, W_.x, W_.y, W_.w, W_.h, { acc: col, rowsAt: S.at('win') + 0.3, hi: 2 }));
    },
  });

  /* 6. settings: short lines stack one per beat, each ending in its italic word, beside a tall preferences sheet */
  const prefLines = b => { const it = ((b.data && b.data.items) || []).slice(0, 3), op = b.data && b.data.opener; if (it.length >= 2) return it.map(s => { const w = String(s).split(/\s+/).filter(Boolean); if (op) w.unshift(op); return w.map((x, i) => ({ s: i === w.length - 1 ? x.replace(/[.]*$/, '.') : x, accent: i === w.length - 1 })); }); return [toks(b)]; };
  L.def('insert:prefs-sheet-lines', {
    kind: 'setup',
    plan(b, F) { const n = prefLines(b).length, st = Math.max(0.28, beatLen(F) * 0.6), ls = Array.from({ length: n }, (_, i) => +(0.3 + i * st).toFixed(3)), foot = ls[n - 1] + 0.55; return { cues: { sheet: 0.05, foot, scroll: Math.max(foot + 0.8, 2.0), headDone: foot, ...Object.fromEntries(ls.map((t, i) => ['l' + i, t])) }, events: [{ at: 0.05, event: 'card-in' }, ...ls.map(t => ({ at: t, event: 'list-item' })), { at: Math.max(foot + 0.8, 2.0), event: 'slide-out' }], min: Math.max(foot + 0.8, 2.0) + 1.3, exit: { kind: 'rect', x: 0.775, y: 0.5, w: 0.27, h: 0.86 }, entry: { kind: 'rect', x: 0.775, y: 0.5, w: 0.27, h: 0.86 } }; },
    draw(S) {
      const b = S.b, c = S.ctx, lines = prefLines(b), wide = isWide(S), tall = isTall(S);
      const sheet = wide ? { x: S.W * 0.64, y: S.H * 0.07, w: S.W * 0.27, h: S.H * 0.86 } : tall ? { x: S.W * 0.16, y: S.H * 0.4, w: S.W * 0.68, h: S.H * 0.54 } : { x: S.W * 0.56, y: S.H * 0.08, w: S.W * 0.38, h: S.H * 0.84 };
      prefsSheet(S, sheet.x, sheet.y, sheet.w, sheet.h, { t0: S.at('sheet'), scrollAt: S.at('scroll'), items: [] });
      const tx = S.W * (wide ? 0.061 : 0.07), tw = wide ? S.W * 0.52 : tall ? S.W * 0.86 : S.W * 0.44, px = (wide ? 92 : tall ? 110 : 92) * S.u;
      const lays = lines.map(tk => L.layout(c, S.look, tk, { px, maxW: tw, x: tx, y: 0, align: 'left', maxLines: 2, lineH: 1.0 }));
      const pxMin = Math.min(...lays.map(l => l.px)), pitch = pxMin * 1.08, totH = lines.length * pitch + 70 * S.u;
      let y = wide || !tall ? S.H * 0.5 - totH / 2 : S.H * 0.08;
      lines.forEach((tk, i) => { L.headline(S, { px: pxMin, maxW: tw, x: tx, y, align: 'left', maxLines: 1, lineH: 1.0, min: pxMin * 0.5 }, { tokens: tk, t0: S.at('l' + i), type: 'effect:type-serif-focus-rise' }); y += pitch; });
      const foot = b.text.sub || (lines.length > 1 ? toks(b).map(t => t.s).join(' ') : '');
      const fk = E.out(prog(S.lt, S.at('foot'), 0.5));
      if (foot && fk > 0) { c.save(); c.globalAlpha *= fk; const fl = L.layout(c, S.look, foot.split(/\s+/).map(s => ({ s })), { role: 'ui', px: 26 * S.u, maxW: tw * 0.95, x: tx, y: y + 16 * S.u + (1 - fk) * 8 * S.u, align: 'left', maxLines: 2, lineH: 1.3, space: 0.28 }); for (const w of fl.words) L.drawWord(c, S.look, S.P, w, { color: S.P.dim }); c.restore(); }
    },
  });

  /* 7. one command: the claim in a left column, a terminal types its update and the log ends in green */
  L.def('insert:terminal-one-command', {
    kind: 'setup',
    plan(b, F) { const tp = T(b, F, 0.08), n = (F && F.brand && F.brand.name) || 'App', cmd = `${slugOf(n)} update`, lines = termLines(F), tm = termTimes(0.2, cmd, lines), okAt = tm.ts[tm.ts.length - 1]; return { cues: { head: 0.08, headDone: tp.done, sub: tp.done + 0.4, term: 0.2, ok: okAt, focusIn: tm.typed }, events: [...tp.events, { at: 0.2, event: 'card-in' }, { at: tm.typeAt, event: 'code' }, ...tm.ts.slice(0, -1).map(t => ({ at: t, event: 'list-item' })), { at: okAt, event: 'pop' }], min: okAt + 1.0, exit: { kind: 'rect', x: 0.69, y: 0.5, w: 0.55, h: 0.6 }, entry: { kind: 'rect', x: 0.69, y: 0.5, w: 0.55, h: 0.6 } }; },
    draw(S) {
      const b = S.b, Lx = split(S, { win: { x: S.W * 0.415, y: S.H * 0.2, w: S.W * 0.55, h: S.H * 0.6 } });
      textBlock(S, Lx, { sub: b.text.sub, below: b.text.sub ? 90 : 0 });
      const W_ = Lx.win, th = isWide(S) ? W_.h : Math.min(W_.h * 0.82, W_.w * 0.95); terminal(S, W_.x, W_.y + (W_.h - th) / 2, W_.w, th, { t0: S.at('term'), lines: termLines(L.film) });
    },
  });

  /* 8. the production guard: the italic word turns alarm red; a confirm modal rises over the dimmed app */
  L.def('insert:production-guard', {
    kind: 'setup',
    plan(b, F) { const tp = T(b, F, 0.08), red = Math.max(tp.done - 0.1, 0.5); return { cues: { head: 0.08, headDone: tp.done, red, app: 0.0, modal: 0.32, sub: tp.done + 0.35, focusIn: 1.2 }, events: [{ at: 0, event: 'hard-hit' }, ...tp.events, { at: 0.32, event: 'card-in' }, { at: red, event: 'notify' }], min: 2.6, exit: { kind: 'rect', x: 0.69, y: 0.5, w: 0.39, h: 0.42 }, entry: { kind: 'rect', x: 0.69, y: 0.5, w: 0.55, h: 0.72 } }; },
    draw(S) {
      const b = S.b, c = S.ctx, Lx = split(S), red = L.readable(WARN, S.P.bg, 3.2), rk = E.out(prog(S.lt, S.at('red'), 0.25));
      textBlock(S, Lx, { acc: mix(S.P.accent, red, rk), sub: b.text.sub, below: b.text.sub ? 90 : 0 });
      const W_ = Lx.win, k = winK(S, S.at('app'), 0.3);
      materialise(S, W_.x, W_.y, W_.w, W_.h, 14 * S.u, k, cc => { drawApp(S, W_.x, W_.y, W_.w, W_.h, { hi: 4, tab: 1 }); const dk = E.out(prog(S.lt, S.at('modal'), 0.3)); cc.fillStyle = rgba('#000000', 0.55 * dk); cc.fillRect(W_.x, W_.y, W_.w, W_.h); });
      const mw = Math.min(W_.w * 0.7, S.W * 0.8), f = mw / 30, mh = f * 18.2;
      guardModal(S, W_.x + W_.w / 2 - mw / 2, W_.y + W_.h / 2 - mh / 2, mw, { t0: S.at('modal') });
    },
  });

  /* 9. works with: spaced caps over one giant serif name that hard-swaps on every beat (a one-frame blank, a blur-in) */
  const namesOf = b => { const it = (b.data && (b.data.names || b.data.items)) || []; return it.length >= 2 ? it.slice(0, 8) : toks(b).map(t => t.s.replace(/[.,]$/, '')); };
  const swapLen = F => clamp(beatLen(F), 0.36, 0.62);
  L.def('insert:works-with-name-swap', {
    kind: 'setup',
    plan(b, F) { const n = namesOf(b).length, sw = swapLen(F), t0 = 0.3; return { cues: { label: 0.05, names: t0, swap: sw }, events: Array.from({ length: n }, (_, i) => ({ at: t0 + i * sw, event: i ? 'word' : 'key-word' })), min: t0 + n * sw + 0.6, entry: { kind: 'dot', x: 0.5, y: 0.5, r: 0.01 }, exit: { kind: 'dot', x: 0.5, y: 0.5, r: 0.01 } }; },
    draw(S) {
      const b = S.b, c = S.ctx, names = namesOf(b), sw = S.at('swap') || 0.45, t0 = S.at('names'), dt = S.lt - t0;
      const lab = (b.data && b.data.label) || b.text.eyebrow || 'Works with';
      let px = Math.min(S.H * 0.2, S.W * 0.16);
      const widest = Math.max(...names.map(s => L.textW(c, S.look, s, { role: 'display', px })));
      if (widest > S.W * 0.84) px *= S.W * 0.84 / widest;
      const y = S.H * 0.46 + px * 0.32;
      caps(S, lab, S.W / 2, y - px * 0.98, E.out(prog(S.lt, S.at('label'), 0.3)), { px: 17 });
      if (dt < 0) return;
      const i = Math.min(names.length - 1, Math.floor(dt / sw)), loc = dt - i * sw;
      if (i > 0 && loc < 1 / 60) return; // the one-frame blank
      const k = clamp(loc / (i ? 0.07 : 0.3)), hold = i === names.length - 1 ? clamp((loc - sw) / 2) : 0;
      c.save(); if (k < 1) c.filter = `blur(${((1 - E.out(k)) * (i ? 6 : 12) * S.u).toFixed(2)}px)`;
      c.globalAlpha *= i ? 1 : clamp(k * 1.5);
      const s = 1 + hold * 0.03 + (1 - k) * 0.015; c.translate(S.W / 2, y - px * 0.35); c.scale(s, s); c.translate(-S.W / 2, -(y - px * 0.35));
      L.text(c, S.look, names[i], S.W / 2, y, { role: 'display', px, color: S.P.fg, align: 'center' });
      c.restore();
      // under it, the connection itself: a dark chip with a live dot and the mono address of that engine
      const I = inkSet(S), ck = E.out(prog(dt, 0.15, 0.4)); if (ck <= 0) return;
      const nm = slugOf(names[i]), addr = `${nm}://${slugOf(brand().name)}-main:${5400 + (hash(nm) % 600)}`, cpx = 22 * S.u;
      const cw = L.textW(c, S.look, addr, { role: 'micro', px: cpx, tracking: 0 }) + cpx * 4.2, chh = cpx * 2.4, cy2 = y + px * 0.55 + chh / 2;
      c.save(); c.globalAlpha *= ck; c.translate(0, (1 - ck) * 12 * S.u);
      L.card(c, S.W / 2 - cw / 2, cy2 - chh / 2, cw, chh, chh / 2, { fill: I.ink, u: S.u, lift: 0.6, shadow: 'rgba(24,18,10,0.16)' });
      const pulse = 0.5 + 0.5 * Math.sin(S.lt * 6); L.circle(c, S.W / 2 - cw / 2 + cpx * 1.4, cy2, cpx * 0.32 + pulse * cpx * 0.12, rgba(OK, 0.35)); L.circle(c, S.W / 2 - cw / 2 + cpx * 1.4, cy2, cpx * 0.26, OK);
      L.text(c, S.look, addr.slice(0, Math.ceil(addr.length * clamp(loc / 0.18))), S.W / 2 - cw / 2 + cpx * 2.5, cy2 + cpx * 0.36, { role: 'micro', px: cpx, color: I.fg, tracking: 0 });
      c.restore();
    },
  });

  /* 10. the offer line: one centred line arriving phrase by phrase, a rule from the centre, the facts in spaced caps */
  L.def('insert:offer-line-facts', {
    kind: 'setup',
    plan(b, F) { const tp = T(b, F, 0.1), rule = tp.done + 0.05; return { cues: { head: 0.1, headDone: tp.done, rule, facts: rule + 0.3 }, events: [...tp.events, { at: rule, event: 'accent' }, { at: rule + 0.3, event: 'word' }], min: rule + 1.5, entry: { kind: 'dot', x: 0.5, y: 0.5, r: 0.01 }, exit: { kind: 'dot', x: 0.5, y: 0.56, r: 0.01 } }; },
    draw(S) {
      const b = S.b, c = S.ctx, wide = isWide(S), px = (wide ? 124 : 108) * S.u * (toks(b).length > 8 ? 0.82 : 1), maxW = S.W * (wide ? 0.86 : 0.88);
      const l0 = L.layout(c, S.look, toks(b), { px, maxW, x: S.W / 2, y: 0, align: 'center', maxLines: wide ? 2 : 3 });
      const lay = L.headline(S, { px, maxW, x: S.W / 2, y: S.H * 0.46 - l0.H / 2, align: 'center', maxLines: wide ? 2 : 3 });
      const ry = (lay ? lay.bottom : S.H * 0.55) + 30 * S.u, rk = E.out(prog(S.lt, S.at('rule'), 0.36)), rw = 200 * S.u * rk;
      if (rk > 0) { L.rr(c, S.W / 2 - rw / 2, ry, rw, 4 * S.u, 2 * S.u); c.fillStyle = S.P.accent; c.fill(); }
      const facts = ((b.data && b.data.items) || []).slice(0, wide ? 3 : 2).join('   ·   ') || brand().host;
      caps(S, facts, S.W / 2, ry + 70 * S.u, E.out(prog(S.lt, S.at('facts'), 0.35)), { px: 22, maxW: S.W * 0.86 });
    },
  });

  /* ════════════════════════ end cards ════════════════════════ */
  // the offer stays on top, the small accent logo, the address in mono and a tiny grey note stack under it
  L.def('end_card:offer-mono-url-stack', {
    kind: 'end',
    plan(b, F) { const tp = L.get('effect:type-phrase-blur-in').plan(b, F, 0.05); const lift = Math.max(tp.done + 0.15, 0.6); return { cues: { head: 0.05, lift, logo: lift + 0.05, url: lift + 0.3, note: lift + 0.55 }, events: [...tp.events, { at: lift + 0.05, event: 'pop' }, { at: lift + 0.3, event: 'cta' }], min: lift + 1.8, entry: { kind: 'dot', x: 0.5, y: 0.5, r: 0.01 } }; },
    draw(S) {
      const b = S.b, c = S.ctx, B = brand(), wide = isWide(S), tk = toks(b).length ? toks(b) : [{ s: B.name + '.' }];
      const px = (tk.length <= 3 ? 150 : wide ? 104 : 96) * S.u, maxW = S.W * 0.86, l0 = L.layout(c, S.look, tk, { px, maxW, x: S.W / 2, y: 0, align: 'center', maxLines: 2 });
      const lift = E.io(prog(S.lt, S.at('lift'), 0.6)), y = lerp(S.H * 0.5 - l0.H / 2, S.H * 0.36 - l0.H / 2, lift);
      L.headline(S, { px, maxW, x: S.W / 2, y, align: 'center', maxLines: 2 }, { tokens: tk, type: 'effect:type-phrase-blur-in', t0: S.at('head') });
      const base = S.H * 0.36 + l0.H / 2 + 70 * S.u;
      const lk = spring(S.lt - S.at('logo'), 'pop'), lpx = 44 * S.u;
      if (S.lt > S.at('logo')) {
        const logo = L.img('logo'), nw = L.textW(c, S.look, B.name, { role: 'ui', px: lpx, weight: 650 }), m = lpx * 1.3, tot = m + lpx * 0.4 + nw, lx = S.W / 2 - tot / 2, cy = base + lpx * 0.5;
        c.save(); c.globalAlpha *= clamp(lk * 2); c.translate(S.W / 2, cy); c.scale(clamp(lk, 0, 1.2), clamp(lk, 0, 1.2)); c.translate(-S.W / 2, -cy);
        if (logo) { const s = m / Math.max(logo.width, logo.height); c.drawImage(logo, lx, cy - logo.height * s / 2, logo.width * s, logo.height * s); }
        else { L.rr(c, lx, cy - m / 2, m, m, m * 0.26); c.fillStyle = S.P.accent; c.fill(); L.icon(c, 'layers', lx + m / 2, cy, m * 0.62, L.onColor(S.P.accent), 2.2); }
        L.text(c, S.look, B.name, lx + m + lpx * 0.4, cy + lpx * 0.36, { role: 'ui', px: lpx, weight: 650, color: S.P.accent });
        c.restore();
      }
      const uk = E.out(prog(S.lt, S.at('url'), 0.4)); if (uk > 0) { c.save(); c.globalAlpha *= uk; L.text(c, S.look, B.host, S.W / 2, base + 140 * S.u + (1 - uk) * 8 * S.u, { role: 'micro', px: 52 * S.u, color: S.P.fg, align: 'center', tracking: 0, maxW: S.W * 0.84 }); c.restore(); }
      const nk = E.out(prog(S.lt, S.at('note'), 0.4)), note = b.text.sub || B.tagline; if (note && nk > 0) { c.save(); c.globalAlpha *= nk; L.text(c, S.look, note, S.W / 2, base + 204 * S.u + (1 - nk) * 6 * S.u, { role: 'ui', px: 28 * S.u, color: S.P.dim, align: 'center', maxW: S.W * 0.8 }); c.restore(); }
    },
  });
  // the wordmark set big in the look's serif, rising letter by letter, a centre-drawn accent rule, the address in caps
  L.def('end_card:serif-wordmark-rule', {
    kind: 'end',
    plan(b, F) { const n = (((F && F.brand) || {}).name || 'Brand').length, gap = Math.min(0.09, 0.7 / n), rule = 0.1 + gap * n + 0.2; return { cues: { mark: 0.1, rule, caps: rule + 0.3, tag: rule + 0.55 }, events: [{ at: 0.1, event: 'riffle' }, { at: rule, event: 'accent' }, { at: rule + 0.3, event: 'cta' }], min: rule + 1.8, entry: { kind: 'dot', x: 0.5, y: 0.5, r: 0.01 } }; },
    draw(S) {
      const c = S.ctx, B = brand(), name = B.name, n = name.length, gap = Math.min(0.09, 0.7 / n);
      let px = Math.min(S.H * 0.26, S.W * 0.2); const mw0 = L.textW(c, S.look, name, { role: 'wordmark', px }); if (mw0 > S.W * 0.8) px *= S.W * 0.8 / mw0;
      const mw = L.textW(c, S.look, name, { role: 'wordmark', px }), x0 = S.W / 2 - mw / 2, y = S.H * 0.5 + px * 0.2;
      for (let j = 0; j < n; j++) {
        const k = prog(S.lt, S.at('mark') + j * gap, 0.45), e = E.settle(k); if (k <= 0) continue;
        const gx = x0 + L.textW(c, S.look, name.slice(0, j), { role: 'wordmark', px });
        c.save(); c.beginPath(); c.rect(gx - px * 0.2, y - px * 1.05, px * 1.4, px * 1.35); c.clip(); if (k < 1) c.filter = `blur(${((1 - e) * 6 * S.u).toFixed(2)}px)`;
        L.text(c, S.look, name[j], gx, y + (1 - e) * px * 0.5, { role: 'wordmark', px, color: S.P.fg }); c.restore();
      }
      const rk = E.out(prog(S.lt, S.at('rule'), 0.36)), rw = Math.min(mw * 0.4, 300 * S.u) * rk, ry = y + px * 0.26;
      if (rk > 0) { L.rr(c, S.W / 2 - rw / 2, ry, rw, 5 * S.u, 2.5 * S.u); c.fillStyle = S.P.accent; c.fill(); }
      caps(S, B.host, S.W / 2, ry + 58 * S.u, E.out(prog(S.lt, S.at('caps'), 0.3)), { px: 18 });
      const tk = E.out(prog(S.lt, S.at('tag'), 0.5)); if (B.tagline && tk > 0) { c.save(); c.globalAlpha *= tk; L.text(c, S.look, B.tagline, S.W / 2, ry + 120 * S.u, { role: 'accent', px: 40 * S.u, color: S.P.dim, align: 'center', maxW: S.W * 0.8 }); c.restore(); }
    },
  });

  /* ════════════════════════ transitions ════════════════════════ */
  const splitK = (o, k) => { const span = (o.pre || 0) + (o.post || 0) || 1; return clamp(k * span / Math.max(1e-6, o.pre || 1e-6)); };
  const afterK = (o, k) => { const span = (o.pre || 0) + (o.post || 0) || 1; return clamp((k * span - (o.pre || 0)) / Math.max(1e-6, o.post || 1e-6)); };
  // the outgoing line fades to paper, then a dark slab soaks in where B's window will be and opens onto B
  L.def('transition:ink-materialise', {
    kind: 'transition', plan() { return { pre: 0.14, post: 0.46, events: [{ at: 0.02, event: 'card-in' }] }; },
    tr(S, A, B, k, o) {
      const c = S.ctx;
      if (S.t < o.cut) { const g = E.in(splitK(o, k)); c.drawImage(A, 0, 0); c.save(); c.globalAlpha = g; c.fillStyle = (S.PA || S.P).bg; c.fillRect(0, 0, S.W, S.H); c.restore(); return; }
      const g = afterK(o, k), to = o.to && o.to.kind === 'rect' ? o.to : { x: 0.5, y: 0.5, w: 0.7, h: 0.78 };
      const w = to.w * S.W, h = to.h * S.H, x = to.x * S.W - w / 2, y = to.y * S.H - h / 2, show = E.out(clamp((g - 0.6) / 0.4)), m = E.out(clamp(g / 0.75));
      c.fillStyle = S.P.bg; c.fillRect(0, 0, S.W, S.H);
      c.save(); c.globalAlpha = show; c.drawImage(B, 0, 0); c.restore();
      const ink = S.look.palette.ink || '#111113', mid = mix(S.P.bg, ink, 0.4), fill = m < 0.5 ? mix(S.P.bg, mid, m * 2) : mix(mid, ink, (m - 0.5) * 2), s = lerp(0.94, 1, m);
      c.save(); c.globalAlpha = 1 - show; c.translate(x + w / 2, y + h / 2); c.scale(s, s); c.translate(-(x + w / 2), -(y + h / 2));
      L.card(c, x, y, w, h, 14 * S.u, { fill, u: S.u, lift: m, stroke: false, grad: false, shadow: 'rgba(24,18,10,0.16)' }); c.restore();
    },
  });
  // a plain cut on the beat: one blank frame of the ground, then B racks in from a 6 px blur over three frames
  L.def('transition:beat-blank-cut', {
    kind: 'transition', plan() { return { pre: 0.02, post: 0.09, events: [{ at: 0, event: 'scene' }] }; },
    tr(S, A, B, k, o) {
      const c = S.ctx; if (S.t < o.cut) { c.drawImage(A, 0, 0); return; }
      const dt = S.t - o.cut; if (dt < 1 / 60) { c.fillStyle = S.P.bg; c.fillRect(0, 0, S.W, S.H); return; }
      const bl = (1 - clamp((dt - 1 / 60) / 0.06)) * 6 * S.u; c.fillStyle = S.P.bg; c.fillRect(0, 0, S.W, S.H); if (bl > 0.3) c.filter = `blur(${bl.toFixed(2)}px)`; c.drawImage(B, 0, 0); c.filter = 'none';
    },
  });
  // the finished line greys and softens into the paper; the next one focuses in out of it (line to line)
  L.def('transition:grey-out-relay', {
    kind: 'transition', plan() { return { pre: 0.2, post: 0.3, events: [{ at: 0.02, event: 'word' }] }; },
    tr(S, A, B, k, o) {
      const c = S.ctx;
      if (S.t < o.cut) { const g = E.in(splitK(o, k)); c.fillStyle = (S.PA || S.P).bg; c.fillRect(0, 0, S.W, S.H); c.save(); c.filter = `grayscale(${g.toFixed(2)}) blur(${(g * 6 * S.u).toFixed(2)}px)`; c.globalAlpha = 1 - g * 0.92; c.drawImage(A, 0, 0); c.restore(); return; }
      const g = E.out(afterK(o, k)), s = lerp(1.012, 1, g); c.fillStyle = S.P.bg; c.fillRect(0, 0, S.W, S.H);
      c.save(); c.translate(S.W / 2, S.H / 2); c.scale(s, s); c.translate(-S.W / 2, -S.H / 2); if (g < 1) c.filter = `blur(${((1 - g) * 10 * S.u).toFixed(2)}px)`; c.globalAlpha = clamp(g * 1.8); c.drawImage(B, 0, 0); c.restore();
    },
  });

  /* ════════════════════════ cameras ════════════════════════ */
  // a slow 2% push toward the product side of a split frame (the long window holds breathe)
  L.def('camera:window-side-push', {
    kind: 'camera',
    cam(lt, d, o, S) { const k = clamp(lt / Math.max(0.1, d)), s = lerp(1, 1 + ((o && o.amount) || 0.024), E.io(k)), wide = S ? S.W / S.H > 1.3 : true, fx = ((o && o.fx != null) ? o.fx : wide ? 0.68 : 0.5) - 0.5, fy = ((o && o.fy != null) ? o.fy : wide ? 0.5 : 0.62) - 0.5; return { s, x: -fx * (S ? S.W : 1920) * (s - 1), y: -fy * (S ? S.H : 1080) * (s - 1), r: 0 }; },
  });
  // a near-still editorial hold: a 1% settle with a faint breath on the bar (never dead, never moving)
  L.def('camera:bar-breath-hold', {
    kind: 'camera',
    cam(lt, d, o, S) { const k = clamp(lt / Math.max(0.1, d)), bar = 4 * beatLen(L.film), u = (S && S.u) || 1; return { s: 1.004 + 0.009 * E.io(k) + 0.0016 * Math.sin(Math.PI * 2 * lt / bar), x: 0, y: lerp(3, -3, k) * u, r: 0 }; },
  });

  /* ════════════════════════ texture ════════════════════════ */
  // warm paper with a soft brighter ellipse in the middle and slightly darker edges (a lit print page), drifting slowly
  L.def('texture:paper-centre-glow', {
    kind: 'texture',
    draw(S) {
      const c = S.ctx, bg = S.P.bg, dark = lum(bg) < 0.3, cx = S.W / 2 + Math.sin(S.t * 0.21) * S.W * 0.02, cy = S.H * 0.48 + Math.cos(S.t * 0.17) * S.H * 0.015, R = Math.max(S.W, S.H) * 0.62;
      c.save(); c.translate(cx, cy); c.scale(1, S.W / S.H > 1.3 ? 0.62 : 0.9);
      const g = c.createRadialGradient(0, 0, 0, 0, 0, R); g.addColorStop(0, rgba(mix(bg, '#FFFFFF', dark ? 0.06 : 0.5), dark ? 0.5 : 0.75)); g.addColorStop(0.5, rgba(bg, 0)); g.addColorStop(1, rgba('#000000', dark ? 0.25 : 0.05));
      c.fillStyle = g; c.fillRect(-R * 2, -R * 3, R * 4, R * 6); c.restore();
      L.grain(c, S.W, S.H, S.t, 0.022);
    },
  });
})(globalThis.LAUNCH);
