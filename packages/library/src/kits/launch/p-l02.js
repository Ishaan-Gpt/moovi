// Launch pack l02 "Signal Serif": an espresso-night problem that flips to a warm cream product world through one
// accent dot. Soft serif clauses rise word by word out of their own line masks (one accent noun each), a sonar dot
// lights scattered points, a radar sweep finds signals, a lead card unfolds from the dot in real perspective, a message
// ghost-types and whips away on speed lines, a reply drops in, and four petals orbit into the brand mark.
// Everything is drawn from the palette (S.P / S.look), content from b.text / b.data / F.brand.
'use strict';
(function (L) {
  const { clamp, lerp, prog, E, rgba, mix, lum, spring, rand, noise, logLerp } = L;
  const wide = S => S.W / S.H > 1.3, tall = S => S.H / S.W > 1.3;
  const brand = () => (L.film && L.film.brand) || { name: 'Brand', host: 'brand.com', tagline: '' };
  const toks = b => (b && b.text && b.text.tokens) || [];
  const T = (b, F, t0) => (L.get(b.type) || L.get('effect:type-mask-rise')).plan(b, F, t0);
  const initials = s => String(s || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
  const quint = L.bez(0.22, 1, 0.36, 1);
  const eio = x => { x = clamp(x); return x === 0 || x === 1 ? x : x < 0.5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2; };
  const inExpo = x => (x <= 0 ? 0 : Math.pow(2, 10 * clamp(x) - 10));
  const split = (o, k) => { const span = (o.pre || 0) + (o.post || 0) || 1; return clamp(k * span / Math.max(1e-6, o.pre || 1e-6)); };
  const after = (o, k) => { const span = (o.pre || 0) + (o.post || 0) || 1; return clamp((k * span - (o.pre || 0)) / Math.max(1e-6, o.post || 1e-6)); };
  const pt = (S, a, dx = 0.5, dy = 0.5) => ({ x: (a && a.x != null ? a.x : dx) * S.W, y: (a && a.y != null ? a.y : dy) * S.H });
  const cover = (S, x, y) => Math.max(Math.hypot(x, y), Math.hypot(S.W - x, y), Math.hypot(x, S.H - y), Math.hypot(S.W - x, S.H - y)) * 1.04;

  // colours derived from the brand accent (hue turns), never hexes of our own
  function hsl(h) { const [r, g, b] = L.hex(h).map(v => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b); let H = 0, Sa = 0; const Lm = (mx + mn) / 2; if (mx !== mn) { const d = mx - mn; Sa = Lm > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); H = (mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60; } return [H, Sa, Lm]; }
  function fromHsl(H, Sa, Lm) { const C = (1 - Math.abs(2 * Lm - 1)) * Sa, X = C * (1 - Math.abs((H / 60) % 2 - 1)), m = Lm - C / 2; const [r, g, b] = H < 60 ? [C, X, 0] : H < 120 ? [X, C, 0] : H < 180 ? [0, C, X] : H < 240 ? [0, X, C] : H < 300 ? [X, 0, C] : [C, 0, X]; return L.toHex([(r + m) * 255, (g + m) * 255, (b + m) * 255]); }
  const turn = (c, deg, l) => { const [h, s, lm] = hsl(c); return fromHsl((((h + deg) % 360) + 360) % 360, Math.max(0.5, s), l != null ? l : clamp(lm, 0.4, 0.55)); };
  const signals = S => [S.look.accent, turn(S.look.accent, 125, 0.36), turn(S.look.accent, 190, 0.5), turn(S.look.accent, 255, 0.55)];
  // card colours (cards stay light on both worlds, like a real app window)
  const cardP = S => { const k = S.look.palette; return { card: k.card || '#FFFFFF', cream: mix(k.paper, '#FFFFFF', 0.45), ink: k.text, dim: rgba(k.text, 0.5), faint: rgba(k.text, 0.28), rule: rgba(k.text, 0.09), soft: mix(k.paper, k.text, 0.05), paper: k.paper, inkW: k.ink }; };

  function wrap(c, look, s, maxW, o) { const ws = String(s || '').split(/\s+/).filter(Boolean), lines = []; let cur = ''; for (const w of ws) { const t = cur ? cur + ' ' + w : w; if (cur && L.textW(c, look, t, o) > maxW) { lines.push(cur); cur = w; } else cur = t; } if (cur) lines.push(cur); return lines; }
  // ghost typing over wrapped lines: n chars shown, the newest `fade` chars still fading in; returns the caret position
  function ghostType(c, S, lines, x, y, lh, n, o) {
    let idx = 0, caret = { x, y };
    for (let li = 0; li < lines.length; li++) {
      const s = lines[li], yy = y + li * lh;
      if (n <= idx) break;
      const shown = Math.min(s.length, Math.ceil(n - idx)), solid = Math.max(0, Math.min(shown, Math.floor(n - idx - (o.fade || 3))));
      const head = s.slice(0, solid);
      if (head) L.text(c, S.look, head, x, yy, o);
      let cx = x + (head ? L.textW(c, S.look, head, o) : 0);
      for (let j = solid; j < shown; j++) { const a = clamp((n - idx - j) / (o.fade || 3)); c.save(); c.globalAlpha *= a; L.text(c, S.look, s[j], cx, yy, o); c.restore(); cx = x + L.textW(c, S.look, s.slice(0, j + 1), o); }
      caret = { x: cx, y: yy };
      idx += s.length + 1;
    }
    return caret;
  }

  /* ───────── shared set-up pieces ───────── */
  const subPill = (S, s, t0) => { if (!s) return; L.get('ui:subtitle-pill-karaoke').draw(S, { x: S.W / 2, y: S.H * (tall(S) ? 0.9 : 0.925), text: s, t0, dur: Math.max(0.8, S.d - t0 - 0.45), px: 26 * S.u * (tall(S) ? 1.2 : 1), maxW: S.W * 0.86 }); };
  const subText = S => (S.b.text && S.b.text.sub) || '';
  const headBase = S => S.H * (subText(S) ? (tall(S) ? 0.8 : 0.83) : (tall(S) ? 0.86 : 0.88));
  function cornerHead(S, o = {}) {
    const tokens = o.tokens || toks(S.b); if (!tokens.length) return null;
    const w = wide(S), px = (o.px || 104) * S.u * (tall(S) ? 1.08 : 1), x = S.W * (w ? 0.057 : 0.075), maxW = S.W * (o.maxW || (w ? 0.6 : 0.85));
    const m = L.layout(S.ctx, S.look, tokens, { px, maxW, x, y: 0, align: 'left', maxLines: 2, lineH: 1.06 });
    const base = o.base || headBase(S), y = base - m.px * 0.8 - (m.lines - 1) * m.lh;
    return L.headline(S, { px, maxW, x, y, align: 'left', maxLines: 2, lineH: 1.06 }, o);
  }
  function chapter(S, t0) {
    const eb = S.b.text && S.b.text.eyebrow; if (!eb) return;
    const n = (S.b.data && S.b.data.step) || ((S.b.i || 0) % 9) + 1;
    L.get('ui:chapter-index-eyebrow').draw(S, { x: S.W * (wide(S) ? 0.057 : 0.075), y: S.H * (tall(S) ? 0.07 : 0.09), n, label: eb, t0: t0 == null ? 0.1 : t0, px: 20 * S.u, align: 'left' });
  }
  const clock = (S, t0) => L.get('ui:midnight-clock-ticker').draw(S, { x: S.W * (wide(S) ? 0.94 : 0.92), y: S.H * (tall(S) ? 0.07 : 0.09), t0, px: 19 * S.u, align: 'right' });

  // the radar ground: hairline rings, a crosshair, a bearing scale with ticks and labels
  function radarScale(S, cx, cy, R, a = 1) {
    const c = S.ctx; c.save(); c.globalAlpha *= a; c.lineWidth = 1.1 * S.u;
    for (let i = 1; i <= 5; i++) { c.strokeStyle = rgba(S.P.fg, 0.1 - i * 0.008); c.beginPath(); c.arc(cx, cy, R * i / 5, 0, Math.PI * 2); c.stroke(); }
    c.strokeStyle = rgba(S.P.fg, 0.07); c.beginPath(); c.moveTo(cx - R * 1.12, cy); c.lineTo(cx + R * 1.12, cy); c.moveTo(cx, cy - R * 1.12); c.lineTo(cx, cy + R * 1.12); c.stroke();
    const ro = R * 1.06, rot = (S.t * 0.6) * Math.PI / 180;
    for (let d = 0; d < 360; d += 3) {
      const long = d % 30 === 0, a1 = d * Math.PI / 180 + rot, l = (long ? 14 : 6) * S.u;
      c.strokeStyle = rgba(S.P.fg, long ? 0.2 : 0.09); c.beginPath(); c.moveTo(cx + Math.sin(a1) * ro, cy - Math.cos(a1) * ro); c.lineTo(cx + Math.sin(a1) * (ro + l), cy - Math.cos(a1) * (ro + l)); c.stroke();
      if (long) L.text(c, S.look, String(d).padStart(3, '0') + '°', cx + Math.sin(a1) * (ro + 34 * S.u), cy - Math.cos(a1) * (ro + 34 * S.u) + 5 * S.u, { role: 'micro', px: 12 * S.u, color: rgba(S.P.fg, 0.32), align: 'center', tracking: 0.04 });
    }
    c.restore();
  }
  const radarGeom = (W, H) => { const w = W / H > 1.3, t = H / W > 1.3; return { cx: W * 0.5, cy: H * (t ? 0.4 : w ? 0.47 : 0.43), R: w ? H * 0.5 : t ? W * 0.4 : W * 0.36 }; };
  // the signals a radar finds: bearing (deg, 0 = up, clockwise), radius fraction, found time
  const SWEEP = 98;
  function radarItems(n, s0, W, H) {
    const g = radarGeom(W, H), out = [];
    for (let i = 0; i < n; i++) {
      const found = s0 + 0.45 + i * 0.55, bearing = -40 + SWEEP * (found - s0), bn = ((bearing % 360) + 360) % 360, r = bn > 165 && bn < 300 ? 0.28 + rand(i * 7) * 0.08 : 0.42 + ((i * 0.37 + rand(i * 31 + 5) * 0.3) % 0.45);
      const a = bearing * Math.PI / 180;
      out.push({ found, bearing, r, x: g.cx + Math.sin(a) * r * g.R, y: g.cy - Math.cos(a) * r * g.R });
    }
    return out;
  }
  // chips never collide: try the right side, then the left, then nudge up/down (a leader line keeps the link)
  function placeChips(S, its, labels, sc) {
    const placed = [], out = [], m = 24 * S.u;
    its.forEach((p, i) => {
      const label = labels[i % labels.length], w = L.textW(S.ctx, S.look, label, { role: 'ui', px: 17 * sc, weight: 550 }) + L.textW(S.ctx, S.look, i ? `${i + 1}h` : 'now', { role: 'micro', px: 11 * sc }) + 58 * sc, h = 38 * sc;
      const pref = p.x + 24 * sc + w > S.W - m ? [-1, 1] : [1, -1], tries = [];
      for (const dy of [0, -46, 46, -92, 92]) for (const sd of pref) tries.push([sd, dy * sc]);
      let best = tries[0];
      for (const [sd, dy] of tries) {
        const x = sd > 0 ? p.x + 24 * sc : p.x - 24 * sc - w, y = p.y + dy - h / 2;
        if (x < m || x + w > S.W - m || y < S.H * 0.14) continue;
        if (y + h > S.H * (tall(S) ? 0.72 : 0.68) && x < S.W * (wide(S) ? 0.6 : 0.9)) continue;
        if (placed.some(r => x < r.x + r.w + 8 * sc && x + w + 8 * sc > r.x && y < r.y + r.h + 6 * sc && y + h + 6 * sc > r.y)) continue;
        if (its.some((q, j) => j !== i && q.x > x - 8 * sc && q.x < x + w + 8 * sc && q.y > y - 8 * sc && q.y < y + h + 8 * sc)) continue;
        best = [sd, dy]; break;
      }
      const x = best[0] > 0 ? p.x + 24 * sc : p.x - 24 * sc - w; placed.push({ x, y: p.y + best[1] - h / 2, w, h }); out.push({ side: best[0], dy: best[1], label });
    });
    return out;
  }
  function wedge(S, cx, cy, R, ang, a = 1) {
    const c = S.ctx, A = (ang - 90) * Math.PI / 180, trail = 70 * Math.PI / 180, RR = R * 1.18;
    c.save(); c.globalAlpha *= a;
    c.beginPath(); c.moveTo(cx, cy); c.arc(cx, cy, RR, A - trail, A); c.closePath();
    if (c.createConicGradient) { const g = c.createConicGradient(A - trail, cx, cy); g.addColorStop(0, rgba(S.look.accent, 0)); g.addColorStop(trail / (Math.PI * 2), rgba(S.look.accent, 0.34)); g.addColorStop(Math.min(1, trail / (Math.PI * 2) + 0.001), rgba(S.look.accent, 0)); c.fillStyle = g; }
    else c.fillStyle = rgba(S.look.accent, 0.16);
    c.fill();
    const rg = c.createRadialGradient(cx, cy, 0, cx, cy, RR); rg.addColorStop(0, rgba(S.P.bg, 0)); rg.addColorStop(0.8, rgba(S.P.bg, 0)); rg.addColorStop(1, rgba(S.P.bg, 0.6)); c.fillStyle = rg; c.fill();
    c.strokeStyle = S.look.accent; c.lineWidth = 2.5 * S.u; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(A) * RR, cy + Math.sin(A) * RR); c.stroke();
    c.restore();
  }
  function bgPoints(S, cx, cy, R, ang, seed, a = 1) {
    const c = S.ctx;
    for (let i = 0; i < 46; i++) {
      const b = rand(seed + i * 13) * 360, r = 0.12 + rand(seed + i * 29) * 0.95, x = cx + Math.sin(b * Math.PI / 180) * r * R, y = cy - Math.cos(b * Math.PI / 180) * r * R;
      let since = ang == null ? 9 : ((ang - b) % 360 + 360) % 360 / SWEEP; if (ang != null && ang - b < 0 && ang < 360) since = 9;
      const hot = Math.exp(-since * 2.4);
      c.save(); c.globalAlpha *= a; L.circle(c, x, y, (2 + hot * 2) * S.u, hot > 0.05 ? mix(mix(S.P.bg, S.P.fg, 0.3), S.look.accent, hot) : rgba(S.P.fg, 0.24)); c.restore();
    }
  }
  // per-slice perspective: paint a card into a buffer, draw it as N vertical slices, each scaled by its depth
  function persp(S, key, DW, DH, sc, cx, cy, rotY, paint, o = {}) {
    const c = S.ctx, pad = 70, bw = Math.ceil((DW + pad * 2) * sc), bh = Math.ceil((DH + pad * 2) * sc), cv = L.buffer(key, bw, bh);
    if (!cv) { c.save(); c.translate(cx - DW * sc / 2, cy - DH * sc / 2); c.scale(sc, sc); paint(c); c.restore(); return; }
    const bc = cv.getContext('2d'); bc.setTransform(1, 0, 0, 1, 0, 0); bc.clearRect(0, 0, bw, bh); bc.setTransform(sc, 0, 0, sc, pad * sc, pad * sc); paint(bc);
    const N = 32, f = bw * 2.4, cs = Math.cos(rotY), sn = Math.sin(rotY);
    // slices go to a second buffer first, so a blur (depth of field) is applied once, without seams
    const ow = Math.ceil(bw * 1.2), oh = Math.ceil(bh * 1.3), ob = o.blur ? L.buffer(key + ':o', ow, oh) : null, oc = ob ? ob.getContext('2d') : c;
    const ox = ob ? ow / 2 : cx, oy = ob ? oh / 2 : cy;
    if (ob) { oc.setTransform(1, 0, 0, 1, 0, 0); oc.clearRect(0, 0, ow, oh); }
    // the card's shadow (contact + ambient) cast by its projected outline, drawn off-canvas so only the shadow lands
    if (o.shadow !== false) {
      const hx = DW * sc / 2, hy = DH * sc / 2, fl = f / (f - hx * sn), fr = f / (f + hx * sn), OFF = 20000, ka = oc.getTransform ? oc.getTransform().a || 1 : 1, OU = OFF / ka;
      const quad = () => { oc.beginPath(); oc.moveTo(ox - hx * cs * fl - OU, oy - hy * fl); oc.lineTo(ox + hx * cs * fr - OU, oy - hy * fr); oc.lineTo(ox + hx * cs * fr - OU, oy + hy * fr); oc.lineTo(ox - hx * cs * fl - OU, oy + hy * fl); oc.closePath(); };
      oc.save(); oc.fillStyle = '#000'; oc.shadowOffsetX = OFF;
      oc.shadowColor = 'rgba(16,14,12,0.18)'; oc.shadowBlur = 60 * sc; oc.shadowOffsetY = 26 * sc; quad(); oc.fill();
      oc.shadowColor = 'rgba(16,14,12,0.12)'; oc.shadowBlur = 6 * sc; oc.shadowOffsetY = 2 * sc; quad(); oc.fill(); oc.restore();
    }
    for (let i = 0; i < N; i++) {
      const u0 = i / N, X0 = (u0 - 0.5) * bw, X1 = (u0 + 1 / N - 0.5) * bw;
      const z0 = X0 * sn, z1 = X1 * sn, f0 = f / (f + z0), f1 = f / (f + z1), xa = ox + X0 * cs * f0, xb = ox + X1 * cs * f1, fm = (f0 + f1) / 2;
      oc.drawImage(cv, u0 * bw, 0, bw / N, bh, xa, oy - bh * fm / 2, xb - xa + 0.8, bh * fm);
    }
    if (ob) { c.save(); c.filter = `blur(${o.blur.toFixed(1)}px)`; c.drawImage(ob, cx - ow / 2, cy - oh / 2); c.restore(); }
  }

  /* ═════════ UI widgets ═════════ */

  /* frosted subtitle pill, the spoken word lit in the accent */
  L.def('ui:subtitle-pill-karaoke', {
    kind: 'ui',
    draw(S, o) {
      const c = S.ctx, t0 = o.t0 || 0, k = E.out(prog(S.lt, t0, 0.3)); if (k <= 0 || !o.text) return;
      const px = o.px || (o.w ? o.w * 0.036 : 26 * S.u), ws = String(o.text).split(/\s+/).filter(Boolean), dur = o.dur || ws.length * 0.28;
      const lit = Math.floor((S.lt - t0) / (dur / ws.length));
      const lay = L.layout(c, S.look, ws.map(s => ({ s })), { role: 'ui', px, maxW: (o.maxW || S.W * 0.8) - px * 1.6, x: o.x, y: 0, align: 'center', maxLines: 2, lineH: 1.32, space: 0.27 });
      const pw = lay.W + lay.px * 1.5, ph = lay.H + lay.px * 0.75, x = o.x - pw / 2, y = o.y - ph / 2 + (1 - k) * 10 * S.u;
      const ink = S.look.palette.ink, fg = S.look.palette.inkText || '#F3EDE4';
      c.save(); c.globalAlpha *= k; if (k < 1) c.filter = `blur(${((1 - k) * 6).toFixed(1)}px)`;
      L.glass(c, S.src, x, y, pw, ph, lay.px * 0.42, { u: S.u, dark: true, tint: rgba(ink, 0.8), chroma: false, blur: 14 * S.u });
      c.filter = 'none';
      for (const w of lay.words) L.drawWord(c, S.look, S.P, w, { y: y + lay.px * 0.38 + w.li * lay.lh + lay.px * 0.8, fill: w.i === lit ? L.readable(S.look.accent, ink, 3) : w.i < lit ? fg : rgba(fg, 0.78) });
      c.restore();
    },
  });

  /* time-lapse clock: an accent dot and a tabular clock racing past midnight; the changed digit rolls */
  L.def('ui:midnight-clock-ticker', {
    kind: 'ui',
    draw(S, o) {
      const c = S.ctx, t0 = o.t0 || 0, k = E.out(prog(S.lt, t0, 0.4)); if (k <= 0) return;
      const px = o.px || (o.w ? o.w * 0.07 : 19 * S.u), rate = o.rate || 3.4, start = o.start != null ? o.start : 23 * 60 + 48;
      const mt = Math.max(0, S.lt - t0) * rate, m = Math.floor(mt), frac = mt - m, roll = E.out(clamp(frac / 0.35));
      const fmt = v => { v = ((v % 1440) + 1440) % 1440; return String(Math.floor(v / 60)).padStart(2, '0') + ':' + String(v % 60).padStart(2, '0'); };
      const now = fmt(start + m), prev = fmt(start + m - 1), o2 = { role: 'micro', px, color: S.P.dim, tracking: 0.06 };
      const cw = L.textW(c, S.look, '0', o2), w = cw * 5 + px * 1.1, x0 = o.align === 'right' ? o.x - w : o.align === 'left' ? o.x : o.x - w / 2;
      c.save(); c.globalAlpha *= k;
      L.circle(c, x0 + px * 0.25, o.y - px * 0.34, px * 0.22 * (1 + 0.35 * (1 - roll)), S.look.accent);
      for (let i = 0; i < 5; i++) {
        const xx = x0 + px * 1.0 + i * cw, a = now[i], b = prev[i];
        if (a === b || m === 0) { L.text(c, S.look, a, xx, o.y, o2); continue; }
        c.save(); c.beginPath(); c.rect(xx - 2, o.y - px * 1.05, cw + 4, px * 1.35); c.clip();
        L.text(c, S.look, b, xx, o.y - roll * px * 1.1, o2); L.text(c, S.look, a, xx, o.y + (1 - roll) * px * 1.1, o2); c.restore();
      }
      c.restore();
    },
  });

  /* sent vs replies: one counter ticking up, the other frozen at zero in a warm red tint */
  L.def('ui:outreach-counters', {
    kind: 'ui',
    draw(S, o) {
      const c = S.ctx, sc = o.scale || (o.w ? o.w / 300 : S.u), t0 = o.t0 || 0, k = E.out(prog(S.lt, t0, 0.4)); if (k <= 0) return;
      const P = cardP(S), labels = o.labels || ['Sent', 'Replies'], cnt = o.count || [12, 47], dur = o.dur || 3.5;
      const sent = Math.floor(lerp(cnt[0], cnt[1], E.apple(prog(S.lt, t0 + 0.2, dur)))), red = turn(S.look.accent, -20, 0.46);
      c.save(); c.translate(o.x, o.y); c.scale(sc, sc); c.globalAlpha *= k;
      const items = [[labels[0], String(sent), P.soft, P.ink, P.dim], [labels[1], '0', mix('#FFFFFF', red, 0.13), red, rgba(red, 0.75)]];
      const ws = items.map(it => L.textW(c, S.look, it[0], { role: 'ui', px: 15 }) + L.textW(c, S.look, it[1], { role: 'ui', px: 15, weight: 650 }) + 34);
      let x = o.align === 'right' ? -(ws[0] + ws[1] + 8) : o.align === 'left' ? 0 : -(ws[0] + ws[1] + 8) / 2;
      items.forEach((it, i) => {
        L.rr(c, x, -17, ws[i], 34, 9); c.fillStyle = it[2]; c.fill();
        const lw = L.text(c, S.look, it[0], x + 13, 5.5, { role: 'ui', px: 15, color: it[4] });
        L.text(c, S.look, it[1], x + 13 + lw + 8, 5.5, { role: 'ui', px: 15, weight: 650, color: it[3] });
        x += ws[i] + 8;
      });
      c.restore();
    },
  });

  /* the prospect list window: a tab strip that keeps multiplying, a search field, counters, rows that flick past */
  L.def('ui:prospect-list-window', {
    kind: 'ui',
    draw(S, o) {
      const c = S.ctx, DW = 1180, DH = 660, sc = o.w / DW, t0 = o.t0 || 0, P = cardP(S), sig = signals(S);
      const k = o.appear === false ? 1 : E.out(prog(S.lt, t0, 0.45)); if (k <= 0) return;
      c.save(); c.translate(o.x, o.y + (1 - k) * 30 * S.u); c.scale(sc, sc); c.globalAlpha *= clamp(k * 1.4); c.translate(-DW / 2, -DH / 2);
      L.card(c, 0, 0, DW, DH, 20, { fill: P.cream, u: 1, lift: 1.1, shadow: 'rgba(0,0,0,0.32)' });
      c.save(); L.rr(c, 0, 0, DW, DH, 20); c.clip();
      // tab strip
      const tabBar = mix(P.paper, P.ink, 0.09); c.fillStyle = tabBar; c.fillRect(0, 0, DW, 54);
      ['#FF5F57', '#FEBC2E', '#28C840'].forEach((col, i) => L.circle(c, 26 + i * 20, 27, 6, col));
      const tabs0 = t0 + (o.tabsAt != null ? o.tabsAt : 0.3), nf = lerp(3, o.tabs || 28, E.io(prog(S.lt, tabs0, o.tabsDur || 3.0))), n = Math.floor(nf), grow = nf - n;
      const stripX = 100, stripW = DW - stripX - 16, tw = Math.min(210, stripW / (n + grow));
      for (let i = 0; i <= n; i++) {
        const w = i === n ? tw * E.out(grow) : tw; if (w < 2) continue;
        const x = stripX + i * tw, act = i === n - 1;
        L.rr(c, x + 2, 10, w - 4, 36, 9); c.fillStyle = act ? P.cream : mix(tabBar, '#FFFFFF', 0.32); c.fill();
        L.rr(c, x + 12, 21, Math.min(14, w - 16), 14, 3); c.fillStyle = mix(sig[i % 4], '#FFFFFF', 0.35); c.fill();
        if (w > 90) { L.rr(c, x + 34, 25, Math.min(110, w - 64), 6, 3); c.fillStyle = P.faint; c.fill(); }
      }
      // toolbar: search + counters
      L.rr(c, 24, 70, 520, 42, 11); c.fillStyle = P.soft; c.fill();
      L.icon(c, 'search', 48, 91, 18, P.dim, 2);
      L.text(c, S.look, o.query || o.text || 'Search', 68, 97, { role: 'ui', px: 16, color: P.dim, maxW: 460 });
      L.get('ui:outreach-counters').draw(S, { x: DW - 24, y: 91, scale: 1, t0, align: 'right', count: o.count || [12, 47], dur: 3.6, labels: o.labels });
      L.line(c, 0, 128, DW, 128, P.rule, 1);
      // rows: flick one row every 0.7 s with a short eased move (ghosts while moving)
      const rows = (o.rows && o.rows.length ? o.rows : (o.items || ['Lead']).map(s => ({ name: s }))), RH = 86;
      const tau = Math.max(0, (S.lt - t0 - (o.scrollAt != null ? o.scrollAt : 0.6)) / 0.7), step = Math.floor(tau), fr = E.io(clamp((tau - step) * 1.7)), off = (step + fr) * RH;
      const moving = fr > 0.02 && fr < 0.98;
      c.save(); c.beginPath(); c.rect(0, 129, DW, DH - 129); c.clip();
      const drawRows = (dy, a) => {
        c.save(); c.globalAlpha *= a;
        const first = Math.floor((off + dy) / RH);
        for (let r = first; r < first + 8; r++) {
          const y = 129 + r * RH - off - dy, row = rows[((r % rows.length) + rows.length) % rows.length], col = sig[(r * 3 + 1) % 4];
          if (y > DH) break;
          L.circle(c, 56, y + RH / 2, 25, mix(col, '#FFFFFF', 0.72));
          L.text(c, S.look, initials(row.name), 56, y + RH / 2 + 6, { role: 'ui', px: 16, weight: 650, color: mix(col, P.ink, 0.35), align: 'center' });
          L.text(c, S.look, row.name, 100, y + RH / 2 - 4, { role: 'ui', px: 19, weight: 600, color: P.ink, maxW: 420 });
          if (row.sub) L.text(c, S.look, row.sub, 100, y + RH / 2 + 20, { role: 'ui', px: 14, color: P.dim, maxW: 420 });
          else { L.rr(c, 100, y + RH / 2 + 10, 120 + rand(r * 7 + 3) * 140, 8, 4); c.fillStyle = P.rule; c.fill(); }
          L.rr(c, DW * 0.56, y + RH / 2 - 4, 90 + rand(r * 11) * 80, 8, 4); c.fillStyle = P.rule; c.fill();
          L.rr(c, DW - 160, y + RH / 2 - 17, 128, 34, 9); c.strokeStyle = rgba(P.ink, 0.14); c.lineWidth = 1.2; c.stroke();
          L.icon(c, 'user', DW - 136, y + RH / 2, 15, P.dim, 1.8); L.rr(c, DW - 120, y + RH / 2 - 3, 70, 6, 3); c.fillStyle = P.faint; c.fill();
          L.line(c, 24, y + RH, DW - 24, y + RH, P.rule, 1);
        }
        c.restore();
      };
      if (moving) for (let g = 3; g >= 1; g--) drawRows(-g * 12 * Math.sin(Math.PI * fr), 0.18);
      drawRows(0, 1);
      c.restore(); c.restore(); c.restore();
    },
  });

  /* a compose popover that types a draft, selects it all in the accent tint, deletes it and starts again */
  L.def('ui:draft-rewrite-popover', {
    kind: 'ui',
    draw(S, o) {
      const c = S.ctx, DW = 580, DH = 230, sc = o.w / DW, t0 = o.t0 || 0, P = cardP(S), k = spring(Math.max(0, S.lt - t0), 'firm'); if (S.lt < t0) return;
      const text = o.text || o.prompt || 'Hi, quick question about your team', ws = text.split(/\s+/), text2 = o.retype || ws.slice(0, Math.max(2, Math.ceil(ws.length / 2))).join(' ') + '…';
      const ty0 = t0 + 0.3, t1 = ty0 + text.length / 28, tSel = t1 + 0.45, tDel = tSel + 0.4, t2 = tDel + 0.15;
      c.save(); c.translate(o.x, o.y); c.scale(sc * lerp(0.92, 1, clamp(k)), sc * lerp(0.92, 1, clamp(k))); c.globalAlpha *= clamp(k * 2); c.translate(-DW / 2, -DH / 2);
      L.card(c, 0, 0, DW, DH, 16, { fill: P.card, u: 1, lift: 0.9 });
      L.icon(c, 'mail', 32, 34, 18, P.ink, 1.9); L.text(c, S.look, o.title || 'New message', 52, 40, { role: 'ui', px: 17, weight: 620, color: P.ink });
      L.icon(c, 'x', DW - 32, 34, 16, P.dim, 1.8); L.line(c, 0, 62, DW, 62, P.rule, 1);
      const to = { role: 'ui', px: 18, color: P.ink }, lh = 30;
      let lines, n;
      if (S.lt < tDel) { lines = wrap(c, S.look, text, DW - 64, to); n = (S.lt - ty0) * 28; }
      else { lines = wrap(c, S.look, text2, DW - 64, to); n = Math.max(0, (S.lt - t2) * 20); }
      if (S.lt >= tSel && S.lt < tDel) { const sk = E.out(prog(S.lt, tSel, 0.12)); lines.forEach((s, i) => { L.rr(c, 30, 84 + i * lh, (L.textW(c, S.look, s, to) + 6) * sk, 26, 4); c.fillStyle = rgba(S.look.accent, 0.24); c.fill(); }); }
      const car = ghostType(c, S, lines, 32, 104, lh, Math.max(0, n), Object.assign({ fade: 2 }, to));
      if (S.lt > ty0 && (Math.floor(S.lt * 2.4) % 2 === 0 || (S.lt < t1 || (S.lt > t2 && n < text2.length)))) { c.fillStyle = S.look.accent; c.fillRect(car.x + 2, car.y - 18, 2.2, 23); }
      L.rr(c, DW - 124, DH - 52, 96, 34, 9); c.fillStyle = P.soft; c.fill(); L.text(c, S.look, o.cta || 'Send', DW - 76, DH - 30, { role: 'ui', px: 15, weight: 600, color: P.dim, align: 'center' });
      c.restore();
    },
  });

  /* a found signal: a ring circles the point, the point takes the signal colour, a label chip slides out of blur */
  L.def('ui:signal-chip-ring', {
    kind: 'ui',
    draw(S, o) {
      const c = S.ctx, sc = o.scale || (o.w ? o.w / 420 : S.u), t0 = o.t0 || 0, p = o.pt || { x: o.x - 170 * sc, y: o.y }, col = o.color || S.look.accent, dt = S.lt - t0;
      const cull = o.cull || 0; if (cull >= 1) return;
      c.save(); c.globalAlpha *= 1 - cull; if (cull > 0.02) c.filter = `blur(${(cull * 10 * sc).toFixed(1)}px)`;
      if (dt < 0) { L.circle(c, p.x, p.y, 3 * sc, rgba(S.P.fg, 0.3)); c.restore(); return; }
      const rk = clamp(dt / 0.45); if (rk < 1) L.circle(c, p.x, p.y, lerp(10, 48, E.out(rk)) * sc, null, rgba(col, 0.6 * (1 - rk)), 2 * sc);
      const pk = spring(dt, 'pop'); L.bloom(c, p.x, p.y, 22 * sc, col, 0.28 * clamp(pk)); L.circle(c, p.x, p.y, 6.5 * sc * pk, col);
      const ck = prog(dt, 0.22, 0.16), e = E.out(ck);
      if (ck > 0) {
        const label = o.label || 'Signal', meta = o.meta || 'now', dark = lum(S.P.bg) < 0.35;
        const lw = L.textW(c, S.look, label, { role: 'ui', px: 17 * sc, weight: 550 }), mw = L.textW(c, S.look, meta, { role: 'micro', px: 11 * sc }), w = lw + mw + 58 * sc, h = 38 * sc;
        let side = o.side || 1; if (!o.side) { if (p.x + 24 * sc + w > S.W - 24 * S.u) side = -1; }
        const cyy = p.y + (o.dy || 0), x = side > 0 ? p.x + (24 + (1 - e) * 12) * sc : p.x - (24 + (1 - e) * 12) * sc - w, y = cyy - h / 2;
        if (o.dy) L.line(c, p.x + side * 9 * sc, p.y, x + (side > 0 ? 0 : w), cyy, rgba(col, 0.5), 1.2 * sc);
        c.save(); c.globalAlpha *= clamp(ck * 1.4); if (e < 0.98) c.filter = `blur(${((1 - e) * 8 * sc).toFixed(1)}px)`;
        L.card(c, x, y, w, h, 10 * sc, { fill: dark ? mix(S.P.bg, '#FFFFFF', 0.12) : '#FFFFFF', u: sc, lift: 0.3 });
        L.rr(c, x + 14 * sc, cyy - 4.5 * sc, 9 * sc, 9 * sc, 2 * sc); c.fillStyle = col; c.fill();
        L.text(c, S.look, label, x + 32 * sc, cyy + 6 * sc, { role: 'ui', px: 17 * sc, weight: 550, color: dark ? '#F3EDE4' : S.look.palette.text });
        L.text(c, S.look, meta, x + 40 * sc + lw, cyy + 4.5 * sc, { role: 'micro', px: 11 * sc, color: dark ? 'rgba(243,237,228,0.5)' : rgba(S.look.palette.text, 0.45) });
        c.restore();
      }
      c.restore();
      return p;
    },
  });

  /* corner-bracket reticle that snaps onto a point, with an accent score tag */
  L.def('ui:reticle-score-tag', {
    kind: 'ui',
    draw(S, o) {
      const c = S.ctx, sc = o.scale || (o.w ? o.w / 260 : S.u), dt = S.lt - (o.t0 || 0); if (dt < 0) return;
      const k = E.outBack(clamp(dt / 0.2)), s = lerp(80, 40, k) * sc, l = 11 * sc, col = S.look.accent;
      c.save(); c.globalAlpha *= clamp(dt / 0.08); c.strokeStyle = col; c.lineWidth = 2.4 * sc; c.lineCap = 'round';
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => { const x = o.x + sx * s / 2, y = o.y + sy * s / 2; c.beginPath(); c.moveTo(x, y - sy * l); c.lineTo(x, y); c.lineTo(x - sx * l, y); c.stroke(); });
      L.bloom(c, o.x, o.y, 26 * sc, col, 0.3); L.circle(c, o.x, o.y, 7 * sc, col);
      const tk = spring(dt - 0.12, 'pop');
      if (dt > 0.12) {
        const label = `${o.value != null ? o.value : 92}${o.tag ? ' · ' + o.tag : ''}`, tw = L.textW(c, S.look, label, { role: 'ui', px: 14 * sc, weight: 650 }) + 18 * sc, tx = o.x - tw / 2, ty = o.y - s / 2 - 30 * sc;
        c.save(); c.translate(o.x, ty + 11 * sc); c.scale(tk, tk); c.translate(-o.x, -(ty + 11 * sc));
        L.rr(c, tx, ty, tw, 22 * sc, 6 * sc); c.fillStyle = col; c.fill();
        L.text(c, S.look, label, o.x, ty + 16 * sc, { role: 'ui', px: 14 * sc, weight: 650, color: L.onColor(col), align: 'center' }); c.restore();
      }
      c.restore();
    },
  });

  /* lead score card: avatar, name, role, a counting score with signal bars, company, chips, an AI insight line */
  const SC_DW = 780, SC_DH = 400;
  function paintScore(c, S, o) {
    const P = cardP(S), t0 = o.t0 || 0, lt = S.lt, acc = S.look.accent, vio = turn(acc, 255, 0.5);
    const name = o.name || o.title || 'Lead', value = o.value != null ? o.value : 92;
    L.card(c, 0, 0, SC_DW, SC_DH, 18, { fill: P.card, u: 1, lift: 0 });
    L.circle(c, 72, 72, 32, acc); L.text(c, S.look, initials(name), 72, 80, { role: 'ui', px: 21, weight: 650, color: L.onColor(acc), align: 'center' });
    L.text(c, S.look, name, 124, 68, { role: 'ui', px: 26, weight: 620, color: P.ink, maxW: 420 });
    if (o.role) L.text(c, S.look, o.role, 124, 98, { role: 'ui', px: 16, color: P.dim, maxW: 420 });
    const v = Math.round(lerp(Math.min(23, value), value, E.out(prog(lt, t0 + 0.1, 0.95))));
    L.text(c, S.look, (o.scoreLabel || 'fit score').toUpperCase(), SC_DW - 40, 50, { role: 'micro', px: 11, color: P.dim, align: 'right' });
    L.text(c, S.look, String(v), SC_DW - 78, 106, { role: 'ui', px: 52, weight: 620, color: P.ink, align: 'right', tracking: -0.03 });
    for (let i = 0; i < 4; i++) { const h = 10 + i * 6; L.rr(c, SC_DW - 70 + i * 8, 100 - h, 5, h, 2); c.fillStyle = v > (i + 1) * 22 ? acc : P.rule; c.fill(); }
    L.line(c, 40, 140, SC_DW - 40, 140, P.rule, 1);
    const rk = i => E.out(prog(lt, t0 + 0.32 + i * 0.1, 0.4));
    let k = rk(0); c.save(); c.globalAlpha *= k; c.translate(0, (1 - k) * 8);
    L.rr(c, 40, 160, 30, 30, 7); c.fillStyle = P.ink; c.fill(); L.text(c, S.look, initials(o.company || brand().name).slice(0, 1), 55, 181, { role: 'ui', px: 15, weight: 700, color: P.card, align: 'center' });
    L.text(c, S.look, o.company || brand().name, 82, 181, { role: 'ui', px: 18, weight: 600, color: P.ink, maxW: 400 }); c.restore();
    k = rk(1); c.save(); c.globalAlpha *= k; c.translate(0, (1 - k) * 8);
    let x = 40; for (const s of (o.chips || []).slice(0, 4)) { const w = L.textW(c, S.look, s, { role: 'ui', px: 14 }) + 26; if (x + w > SC_DW - 40) break; L.rr(c, x, 208, w, 32, 16); c.fillStyle = P.soft; c.fill(); L.text(c, S.look, s, x + 13, 229, { role: 'ui', px: 14, color: P.dim }); x += w + 8; }
    c.restore();
    k = rk(2); c.save(); c.globalAlpha *= k; c.translate(0, (1 - k) * 8);
    L.rr(c, 40, 262, SC_DW - 80, 96, 12); c.fillStyle = mix('#FFFFFF', vio, 0.1); c.fill();
    L.icon(c, 'sparkle', 70, 292, 20, vio, 1.9);
    wrap(c, S.look, o.line || o.text || brand().tagline || '', SC_DW - 170, { role: 'ui', px: 17 }).slice(0, 2).forEach((s, i) => L.text(c, S.look, s, 96, 298 + i * 26, { role: 'ui', px: 17, color: mix(vio, P.ink, 0.25) }));
    c.restore();
  }
  L.def('ui:fit-score-card', {
    kind: 'ui',
    draw(S, o) {
      const k = o.t0 == null ? 1 : E.out(prog(S.lt, o.t0 - 0.1, 0.4)); if (k <= 0) return;
      const sc = o.w / SC_DW, ry = (o.rotY != null ? o.rotY : -0.13) + Math.sin(S.lt * 0.7) * 0.012;
      const oo = Object.assign({ name: (o.rows && o.rows[0] && o.rows[0].name) || o.title, role: (o.rows && o.rows[0] && o.rows[0].sub) || o.sub, chips: o.chips || o.items, line: o.line }, o);
      S.ctx.save(); S.ctx.globalAlpha *= k;
      persp(S, o.key || 'l02-score', SC_DW, SC_DH, sc, o.x, o.y + (1 - k) * 20 * S.u, ry, c => paintScore(c, S, oo), { blur: o.blur });
      S.ctx.restore();
    },
  });

  /* sequence card: step chips, subject, a message that ghost-types with an accent caret, an accent Send button */
  const SQ_DW = 760, SQ_DH = 430;
  L.def('ui:sequence-message-card', {
    kind: 'ui',
    draw(S, o) {
      const c = S.ctx, sc = o.w / SQ_DW, P = cardP(S), acc = S.look.accent, t0 = o.t0 || 0; if (o.t0 != null && S.lt < t0) return null;
      const text = o.text || o.prompt || 'Saw your note on hiring. Here is a thought.', typeAt = o.typeAt != null ? o.typeAt : t0 + 0.4, cps = o.cps || 34;
      const press = o.press || 0;
      c.save(); c.translate(o.x, o.y); c.scale(sc, sc); c.translate(-SQ_DW / 2, -SQ_DH / 2);
      L.card(c, 0, 0, SQ_DW, SQ_DH, 18, { fill: P.card, u: 1, lift: o.flat ? 0 : 0.9 });
      L.icon(c, 'layers', 44, 40, 18, P.ink, 1.9); L.text(c, S.look, o.title || 'Sequence', 64, 46, { role: 'ui', px: 17, weight: 620, color: P.ink });
      const steps = o.steps || ['Email', 'Call', 'LinkedIn'], icons = ['mail', 'mic', 'link'];
      let x = SQ_DW - 36; for (let i = steps.length - 1; i >= 0; i--) { const w = L.textW(c, S.look, steps[i], { role: 'ui', px: 13, weight: 550 }) + 44; x -= w; const act = i === 0; L.rr(c, x, 26, w, 30, 15); if (act) { c.fillStyle = P.ink; c.fill(); } else { c.strokeStyle = rgba(P.ink, 0.16); c.lineWidth = 1.2; c.stroke(); } L.icon(c, icons[i % 3], x + 17, 41, 13, act ? P.card : P.dim, 1.8); L.text(c, S.look, steps[i], x + 30, 46, { role: 'ui', px: 13, weight: 550, color: act ? P.card : P.dim }); x -= 8; }
      L.line(c, 0, 76, SQ_DW, 76, P.rule, 1);
      L.text(c, S.look, 'SUBJECT', 44, 116, { role: 'micro', px: 11, color: P.dim });
      L.text(c, S.look, o.subject || (o.items && o.items[0]) || brand().name, 130, 117, { role: 'ui', px: 18, weight: 600, color: P.ink, maxW: SQ_DW - 180 });
      const to = { role: 'ui', px: 18, color: P.ink }, lines = wrap(c, S.look, text, SQ_DW - 88, to).slice(0, 6), n = Math.max(0, (S.lt - typeAt) * cps);
      const car = ghostType(c, S, lines, 44, 166, 30, n, Object.assign({ fade: 3 }, to));
      const total = lines.join(' ').length, idle = n >= total;
      if (S.lt > typeAt - 0.2 && (!idle || Math.floor(S.lt * 2) % 2 === 0)) { c.fillStyle = acc; c.fillRect(car.x + 2, car.y - 18, 2.2, 23); }
      L.line(c, 0, SQ_DH - 74, SQ_DW, SQ_DH - 74, P.rule, 1);
      L.text(c, S.look, (o.meta || brand().host || '').toUpperCase(), 44, SQ_DH - 30, { role: 'micro', px: 11, color: P.dim, maxW: 300 });
      const bw = 140, bh = 44, bx = SQ_DW - 44 - bw, by = SQ_DH - 59, ps = 1 - press * 0.06;
      c.save(); c.translate(bx + bw / 2, by + bh / 2); c.scale(ps, ps); c.translate(-(bx + bw / 2), -(by + bh / 2));
      c.save(); c.shadowColor = rgba(acc, 0.4); c.shadowBlur = 18; c.shadowOffsetY = 6; L.rr(c, bx, by, bw, bh, 11); c.fillStyle = acc; c.fill(); c.restore();
      L.text(c, S.look, o.cta || 'Send', bx + bw / 2 - 12, by + 28, { role: 'ui', px: 16, weight: 650, color: L.onColor(acc), align: 'center' });
      L.icon(c, 'arrowRight', bx + bw - 30, by + bh / 2, 16, L.onColor(acc), 2.2); c.restore();
      c.restore();
      return { send: { x: o.x + (bx + bw / 2 - SQ_DW / 2) * sc, y: o.y + (by + bh / 2 - SQ_DH / 2) * sc }, typedAt: typeAt + total / cps };
    },
  });

  /* a reply notification drops from above with velocity ghosts, settles on a spring, rings pulse from its avatar */
  L.def('ui:reply-notification-drop', {
    kind: 'ui',
    draw(S, o) {
      const c = S.ctx, DW = 640, DH = 116, sc = o.w / DW, t0 = o.t0 || 0, dt = S.lt - t0, P = cardP(S), acc = S.look.accent; if (dt < 0) return null;
      const name = o.name || (o.rows && o.rows[0] && o.rows[0].name) || o.title || 'Lead', fade = o.fade || 0;
      const yo = t => (1 - spring(Math.max(0, t), [15, 230, 1])) * -320;
      const ax = o.x + (60 - DW / 2) * sc, ay = o.y + yo(dt) * sc;
      const paint = (dy, a) => {
        c.save(); c.globalAlpha *= a; c.translate(o.x, o.y + dy * sc); c.scale(sc, sc); c.translate(-DW / 2, -DH / 2);
        L.card(c, 0, 0, DW, DH, 18, { fill: P.card, u: 1, lift: 0.8 });
        L.text(c, S.look, name, 104, 48, { role: 'ui', px: 18, weight: 650, color: P.ink, maxW: 300 });
        const nw = Math.min(300, L.textW(c, S.look, name, { role: 'ui', px: 18, weight: 650 }));
        L.text(c, S.look, o.verb || 'replied', 110 + nw, 48, { role: 'ui', px: 18, color: P.dim });
        L.text(c, S.look, `“${o.line || 'Sounds good, let us talk Thursday.'}”`, 104, 80, { role: 'ui', px: 17, color: P.ink, maxW: DW - 150 });
        L.text(c, S.look, (o.meta || 'now').toUpperCase(), DW - 28, 46, { role: 'micro', px: 11, color: P.dim, align: 'right' });
        c.restore();
      };
      const v = Math.abs(yo(dt + 0.008) - yo(dt - 0.008));
      c.save(); c.globalAlpha *= 1 - fade;
      if (v > 4) for (let g = 3; g >= 1; g--) paint(yo(dt) - g * v * 1.6, 0.12);
      paint(yo(dt), 1);
      c.restore();
      // rings from the avatar (they outlive the card's fade)
      if (dt > 0.35) for (let j = 0; j < 2; j++) { const ph = ((dt - 0.35 - j * 0.25) / 1.0); if (ph < 0) continue; const f = ph - Math.floor(ph); L.circle(c, ax, ay, lerp(30, 150, E.out(f)) * sc, null, rgba(acc, 0.5 * (1 - f) * (1 - fade * 0.6)), 1.6 * sc); }
      L.circle(c, ax, ay, 30 * sc, acc);
      c.save(); c.globalAlpha *= 1 - fade; L.text(c, S.look, initials(name), ax, ay + 7 * sc, { role: 'ui', px: 19 * sc, weight: 650, color: L.onColor(acc), align: 'center' });
      L.circle(c, ax + 21 * sc, ay + 21 * sc, 7 * sc, '#34C759', '#FFFFFF', 2.5 * sc); c.restore();
      return { avatar: { x: ax, y: ay, r: 30 * sc } };
    },
  });

  /* numbered chapter eyebrow: an accent index, a hairline that draws, the chapter word sliding in */
  L.def('ui:chapter-index-eyebrow', {
    kind: 'ui',
    draw(S, o) {
      const c = S.ctx, t0 = o.t0 || 0, px = o.px || (o.w ? o.w * 0.032 : 18 * S.u), k = E.out(prog(S.lt, t0, 0.4)); if (k <= 0) return;
      const num = String(o.n || 1).padStart(2, '0'), label = o.label || 'Chapter';
      const nw = L.textW(c, S.look, num, { role: 'micro', px }), rule = px * 1.9, lw = L.textW(c, S.look, label, { role: 'ui', px: px * 1.05, weight: 550 });
      const total = nw + rule + lw + px * 1.6, x0 = o.align === 'left' ? o.x : o.x - total / 2;
      c.save(); c.globalAlpha *= k;
      L.text(c, S.look, num, x0, o.y, { role: 'micro', px, color: S.look.accent });
      const rk = E.out(prog(S.lt, t0 + 0.08, 0.4)); L.line(c, x0 + nw + px * 0.6, o.y - px * 0.36, x0 + nw + px * 0.6 + rule * rk, o.y - px * 0.36, rgba(S.P.fg, 0.3), Math.max(1, px * 0.06));
      const lk = E.out(prog(S.lt, t0 + 0.14, 0.4)); c.globalAlpha *= lk;
      L.text(c, S.look, label, x0 + nw + rule + px * 1.2 + (1 - lk) * px * 0.5, o.y, { role: 'ui', px: px * 1.05, weight: 550, color: o.color || S.P.fg });
      c.restore();
    },
  });

  /* ═════════ textures + overlay ═════════ */

  /* warm cream: a slow peach glow drifting in one corner, corner shade, and giant faint arcs left by the radar */
  L.def('texture:peach-glow-cream', {
    kind: 'texture',
    draw(S, o) {
      const c = S.ctx, dark = lum(S.P.bg) < 0.35, acc = S.look.accent;
      const gx = S.W * (0.85 + Math.sin(S.t * 0.25) * 0.03), gy = S.H * (0.22 + Math.cos(S.t * 0.2) * 0.04), r = Math.max(S.W, S.H) * 0.55;
      const g = c.createRadialGradient(gx, gy, 0, gx, gy, r); g.addColorStop(0, rgba(mix(S.P.bg, acc, dark ? 0.16 : 0.13), 1)); g.addColorStop(1, rgba(S.P.bg, 0)); c.fillStyle = g; c.fillRect(0, 0, S.W, S.H);
      const g2 = c.createRadialGradient(S.W * 0.12, S.H * 0.95, 0, S.W * 0.12, S.H * 0.95, r * 0.7); g2.addColorStop(0, rgba(mix(S.P.bg, acc, 0.06), 1)); g2.addColorStop(1, rgba(S.P.bg, 0)); c.fillStyle = g2; c.fillRect(0, 0, S.W, S.H);
      L.vignette(c, S.W, S.H, dark ? 0.3 : 0.06, dark ? '#000' : S.P.bg2);
      const ax = -S.W * 0.25, ay = S.H * 1.25; c.save(); c.lineWidth = 1.2 * S.u;
      for (let i = 0; i < 4; i++) { const rr = Math.hypot(S.W, S.H) * (0.62 + i * 0.22) + Math.sin(S.t * 0.3 + i) * 6 * S.u; c.strokeStyle = rgba(S.P.fg, 0.055 - i * 0.008); c.beginPath(); c.arc(ax, ay, rr, -Math.PI / 2, 0); c.stroke(); }
      c.restore();
    },
  });

  /* radar ground: hairline rings, a crosshair and a bearing scale with degree labels (it turns very slowly) */
  L.def('texture:radar-bearing-scale', {
    kind: 'texture',
    draw(S, o) { const g = radarGeom(S.W, S.H); radarScale(S, (o && o.x != null ? o.x * S.W : g.cx), (o && o.y != null ? o.y * S.H : g.cy), g.R * ((o && o.scale) || 1), (o && o.a) || 0.8); },
  });

  /* two thin accent rings expanding and fading from a point, repeating: live, just now */
  L.def('effect:avatar-ring-pulse', {
    kind: 'overlay',
    draw(S, o) {
      const c = S.ctx, ex = S.b.exit || {}, x = ((o && o.x != null) ? o.x : ex.x != null ? ex.x : 0.5) * S.W, y = ((o && o.y != null) ? o.y : ex.y != null ? ex.y : 0.5) * S.H, at = (o && o.at) || 0.3, per = (o && o.period) || 1.0;
      for (let j = 0; j < 2; j++) { const ph = (S.lt - at - j * 0.25) / per; if (ph < 0) continue; const f = ph - Math.floor(ph); L.circle(c, x, y, lerp(20, 150, E.out(f)) * S.u, null, rgba(S.look.accent, 0.5 * (1 - f)), 1.6 * S.u); }
    },
  });

  /* ═════════ type treatments ═════════ */

  const lineBox = (lay, li) => { const ws = lay.words.filter(w => w.li === li); return { x0: Math.min(...ws.map(w => w.x)), x1: Math.max(...ws.map(w => w.x + w.w)), y: ws[0].y }; };
  const wordWrite = (S, w, dy, a, fill) => { const c = S.ctx; c.save(); c.globalAlpha *= a; L.drawWord(c, S.look, S.P, w, { y: w.y + dy, fill: fill || (w.tk.accent ? S.P.accent : S.P.fg) }); c.restore(); };
  const emTimes = (tks, t0) => { let at = t0; return tks.map(t => { const tt = at + (t.accent ? 0.07 : 0); at += 0.11 + (/[,.;:…?!]$/.test(t.s) ? 0.16 : 0) + Math.min(0.06, t.s.length * 0.006); return +tt.toFixed(3); }); };

  /* serif em rise: each word slides up one full em out of its own line mask and stops dead (accent word a hair late) */
  L.def('effect:type-serif-em-rise', {
    kind: 'type',
    plan(b, F, t0 = 0) { const tk = toks(b), ws = emTimes(tk, t0), a = tk.findIndex(t => t.accent); return { words: ws, done: (ws.length ? Math.max(...ws) : t0) + 0.42, events: [{ at: t0, event: 'word' }, ...(a >= 0 ? [{ at: ws[a] + 0.1, event: 'key-word' }] : [])] }; },
    draw(S, o) {
      const lay = o.lay, c = S.ctx, ws = emTimes(lay.words.map(w => w.tk), o.t0 || 0);
      for (let li = 0; li < lay.lines; li++) {
        const bx = lineBox(lay, li); c.save(); c.beginPath(); c.rect(bx.x0 - lay.px, bx.y - lay.px * 1.05, bx.x1 - bx.x0 + lay.px * 2, lay.px * 1.4); c.clip();
        for (const w of lay.words.filter(x => x.li === li)) {
          const k = prog(S.lt, ws[w.i], 0.42); if (k <= 0) continue;
          if (k < 1) for (let j = 2; j >= 1; j--) wordWrite(S, w, (1 - quint(prog(S.lt - j / 120, ws[w.i], 0.42))) * w.px, 0.22);
          wordWrite(S, w, (1 - quint(k)) * w.px, 1);
        }
        c.restore();
      }
    },
  });

  /* rise + sink: the line rises out of its mask, and before the cut it sinks back down into it, word by word */
  L.def('effect:type-rise-sink', {
    kind: 'type',
    plan(b, F, t0 = 0) { const n = toks(b).length; return { words: Array(n).fill(t0), done: t0 + 0.55, events: [{ at: t0 + 0.05, event: 'word' }, ...(toks(b).some(t => t.accent) ? [{ at: t0 + 0.3, event: 'key-word' }] : [])] }; },
    draw(S, o) {
      const lay = o.lay, c = S.ctx, t0 = o.t0 || 0, out = o.out != null ? o.out : S.d - 0.34;
      for (let li = 0; li < lay.lines; li++) {
        const bx = lineBox(lay, li); c.save(); c.beginPath(); c.rect(bx.x0 - lay.px, bx.y - lay.px * 1.05, bx.x1 - bx.x0 + lay.px * 2, lay.px * 1.4); c.clip();
        for (const w of lay.words.filter(x => x.li === li)) {
          const kin = quint(prog(S.lt, t0 + li * 0.09 + (w.tk.accent ? 0.07 : 0), 0.5)), kout = E.in(prog(S.lt, out + w.i * 0.025, 0.25));
          if (kin <= 0 || kout >= 1) continue;
          wordWrite(S, w, ((1 - kin) + kout) * w.px * 1.05, 1);
        }
        c.restore();
      }
    },
  });

  /* ghost typing: characters type in with the newest three still fading, an accent caret after them */
  const gtCps = tk => { const ch = tk.reduce((a, t) => a + t.s.length + 1, 0); return Math.max(22, Math.min(40, ch / 1.0)); };
  L.def('effect:type-ghost-caret', {
    kind: 'type',
    plan(b, F, t0 = 0) { const tk = toks(b), cps = gtCps(tk), ws = []; let at = t0; for (const t of tk) { ws.push(+at.toFixed(3)); at += (t.s.length + 1) / cps; } return { words: ws, done: at + 0.1, events: ws.filter((_, i) => i % 2 === 0).map(w => ({ at: w, event: 'word' })) }; },
    draw(S, o) {
      const lay = o.lay, c = S.ctx, tk = lay.words.map(w => w.tk), cps = gtCps(tk), n = Math.max(0, (S.lt - (o.t0 || 0)) * cps), total = tk.reduce((a, t) => a + t.s.length + 1, 0);
      let idx = 0, caret = null;
      for (const w of lay.words) {
        const loc = n - idx; idx += w.s.length + 1;
        if (loc <= 0) { if (!caret) caret = { x: w.x, y: w.y, px: w.px }; continue; }
        L.setFont(c, S.look, w.role, w.px); try { c.letterSpacing = w.tr.toFixed(2) + 'px'; } catch (e) { /* */ }
        const shown = Math.min(w.s.length, Math.ceil(loc));
        for (let j = 0; j < shown; j++) {
          const a = clamp((loc - j) / 3), xo = c.measureText(w.s.slice(0, j)).width;
          c.save(); c.globalAlpha *= a; L.drawWord(c, S.look, S.P, Object.assign({}, w, { s: w.s[j] }), { x: w.x + xo }); c.restore();
          L.setFont(c, S.look, w.role, w.px); try { c.letterSpacing = w.tr.toFixed(2) + 'px'; } catch (e) { /* */ }
        }
        caret = { x: w.x + c.measureText(w.s.slice(0, shown)).width + w.px * 0.05, y: w.y, px: w.px };
      }
      if (caret && (n < total || Math.floor(S.lt * 2) % 2 === 0)) { c.fillStyle = S.P.accent; c.fillRect(caret.x, caret.y - caret.px * 0.76, Math.max(2, caret.px * 0.045), caret.px * 0.9); }
    },
  });

  /* speech cadence: words land at reading pace (syllables + pauses), each rising 14 px; the accent word turns last */
  const syl = s => Math.max(1, (String(s).match(/[aeiouyàâäéèêëîïôöûüù]+/gi) || []).length);
  const cadTimes = (tks, t0) => { let at = t0; return tks.map(t => { const tt = at; at += 0.08 + 0.06 * syl(t.s) + (/[,.;:…?!]$/.test(t.s) ? 0.2 : 0); return +tt.toFixed(3); }); };
  L.def('effect:type-speech-cadence', {
    kind: 'type',
    plan(b, F, t0 = 0) { const tk = toks(b), ws = cadTimes(tk, t0), a = tk.findIndex(t => t.accent); return { words: ws, done: (ws.length ? ws[ws.length - 1] : t0) + 0.4, events: [...ws.filter((_, i) => i % 3 === 0).map(w => ({ at: w, event: 'word' })), ...(a >= 0 ? [{ at: ws[a] + 0.12, event: 'key-word' }] : [])] }; },
    draw(S, o) {
      const lay = o.lay, ws = cadTimes(lay.words.map(w => w.tk), o.t0 || 0);
      for (const w of lay.words) {
        const k = prog(S.lt, ws[w.i], 0.3); if (k <= 0) continue;
        const e = E.out(k), fill = w.tk.accent ? mix(S.P.fg, S.P.accent, E.out(prog(S.lt, ws[w.i] + 0.1, 0.25))) : S.P.fg;
        wordWrite(S, w, (1 - e) * 14 * S.u, clamp(k * 1.6), fill);
      }
    },
  });

  /* ═════════ transitions ═════════ */

  /* tilted spring rise: the next shot shoots up from below as a card, tilted, with vertical ghosts; overshoots, settles */
  L.def('transition:tilted-spring-rise', {
    kind: 'transition', plan() { return { pre: 0.04, post: 0.62, events: [{ at: 0, event: 'card-in' }] }; },
    tr(S, A, B, k, o) {
      const c = S.ctx; c.drawImage(A, 0, 0); if (S.t < o.cut) return;
      const q = after(o, k), t = q * (o.post || 0.62), y = t => (1 - spring(t, [15, 220, 1])) * S.H * 1.04 * (1 - smoothEnd(q)), smoothEnd = x => L.smooth(clamp((x - 0.82) / 0.18));
      const yy = y(t), v = Math.abs(y(t + 0.008) - y(t - 0.008)), rot = yy / S.H * 0.06, rad = lerp(28 * S.u, 0, clamp(1 - yy / (S.H * 0.15)) * L.smooth(clamp((q - 0.6) / 0.4)));
      c.fillStyle = rgba('#000000', 0.25 * clamp(1 - yy / S.H)); c.fillRect(0, 0, S.W, S.H);
      const paint = (dy, a) => { c.save(); c.globalAlpha = a; c.translate(S.W / 2, S.H / 2 + dy); c.rotate(rot); c.translate(-S.W / 2, -S.H / 2); if (a === 1) { c.shadowColor = 'rgba(0,0,0,0.35)'; c.shadowBlur = 60 * S.u; c.shadowOffsetY = -10 * S.u; L.rr(c, 0, 0, S.W, S.H, rad); c.fillStyle = S.P.bg; c.fill(); c.shadowColor = 'transparent'; } L.rr(c, 0, 0, S.W, S.H, rad); c.clip(); c.drawImage(B, 0, 0); c.restore(); };
      if (v > 6) for (let g = 4; g >= 1; g--) paint(yy + g * v * 0.9, 0.14);
      paint(yy, 1);
    },
  });

  /* UI drains into the dot: a breath, the colour drains, the shot shrinks with blur into one accent dot */
  L.def('transition:drain-collapse-dot', {
    kind: 'transition', plan() { return { pre: 0.55, post: 0.22, events: [{ at: -0.4, event: 'hard-hit' }, { at: -0.22, event: 'slide-out' }] }; },
    tr(S, A, B, k, o) {
      const c = S.ctx, PA = S.PA || S.P;
      if (S.t < o.cut) {
        const p = split(o, k), f = o.from && o.from.kind === 'rect' ? o.from : { x: 0.5, y: 0.5, w: 0.62, h: 0.62 };
        const R = { x: (f.x - f.w / 2) * S.W, y: (f.y - f.h / 2) * S.H, w: f.w * S.W, h: f.h * S.H }, cx = R.x + R.w / 2, cy = R.y + R.h / 2;
        const breath = p < 0.27 ? 1 + 0.025 * Math.sin(Math.PI * p / 0.27) : 1, q = clamp((p - 0.27) / 0.25), s = eio(clamp((p - 0.5) / 0.5)), d = 28 * S.u;
        c.fillStyle = PA.bg; c.fillRect(0, 0, S.W, S.H);
        c.save(); c.globalAlpha = 1 - q; c.translate(cx, cy); c.scale(breath, breath); c.translate(-cx, -cy); c.drawImage(A, 0, 0); c.restore();
        const w = lerp(R.w * breath, d, s), h = lerp(R.h * breath, d, s), r = lerp(20 * S.u, d / 2, s);
        c.save(); if (s > 0) c.filter = `blur(${(Math.sin(Math.PI * s) * 24 * S.u).toFixed(1)}px)`;
        L.rr(c, cx - w / 2, cy - h / 2, w, h, r); c.save(); c.clip();
        if (s < 0.6) { c.globalAlpha = 1 - clamp(s / 0.6); if (q > 0) c.filter = `${s > 0 ? `blur(${(Math.sin(Math.PI * s) * 24 * S.u).toFixed(1)}px) ` : ''}grayscale(${q.toFixed(2)})`; c.drawImage(A, R.x, R.y, R.w, R.h, cx - w / 2, cy - h / 2, w, h); }
        c.restore();
        c.globalAlpha = clamp(q * 0.7 + s); L.rr(c, cx - w / 2, cy - h / 2, w, h, r); c.fillStyle = mix(mix(PA.bg, PA.fg, 0.35), S.look.accent, clamp((s - 0.55) / 0.45)); c.fill();
        c.restore();
      } else {
        const q = after(o, k), p = pt(S, o.to); c.drawImage(B, 0, 0);
        c.save(); c.globalAlpha = 1 - E.in(q); L.circle(c, p.x, p.y, 14 * S.u, S.look.accent); c.restore();
      }
    },
  });

  /* dot flood then day iris: the accent dot inflates exponentially to a full-frame flash (stepped echo bands on its
     edge), then the next world opens as a disc from the centre */
  L.def('transition:dot-flood-double-iris', {
    kind: 'transition', plan() { return { pre: 0.17, post: 0.16, events: [{ at: -0.17, event: 'scene' }, { at: 0.02, event: 'hard-hit' }] }; },
    tr(S, A, B, k, o) {
      const c = S.ctx, acc = S.look.accent;
      if (S.t < o.cut) {
        const p = split(o, k), c0 = pt(S, o.from), r0 = ((o.from && o.from.r) || 0.013) * S.H, Rm = cover(S, c0.x, c0.y), rr = x => r0 * Math.pow(Rm / r0, clamp(x));
        c.drawImage(A, 0, 0);
        [[0.12, 0.25], [0.08, 0.45], [0.04, 0.7]].forEach(([d, a]) => { if (p > 0) L.circle(c, c0.x, c0.y, rr(p + d) * (p + d > 1 ? 1 : 1), rgba(acc, a * clamp(p * 4))); });
        L.circle(c, c0.x, c0.y, rr(p), acc);
      } else {
        const q = after(o, k), c1 = pt(S, o.to && o.to.kind === 'dot' ? o.to : null), r0 = 30 * S.u, Rm = cover(S, c1.x, c1.y), rr = x => r0 * Math.pow(Rm / r0, clamp(x));
        c.fillStyle = acc; c.fillRect(0, 0, S.W, S.H);
        [[0.1, 0.35], [0.05, 0.65]].forEach(([d, m]) => L.circle(c, c1.x, c1.y, rr(q + d * (1 - q)), mix(acc, S.P.bg, m)));
        c.save(); c.beginPath(); c.arc(c1.x, c1.y, rr(q), 0, Math.PI * 2); c.clip(); c.drawImage(B, 0, 0); c.restore();
      }
    },
  });

  /* send whip: the shot winds back a few px, then whips off right in a smear; thin streaks are left behind and fade */
  const streaks = (S, a, shift) => { const c = S.ctx; if (a <= 0) return; c.save(); c.lineCap = 'round'; for (let i = 0; i < 8; i++) { const y = S.H * (0.3 + rand(i * 7 + 2) * 0.42), len = (300 + rand(i * 5 + 9) * 600) * S.u, x = S.W * (0.15 + rand(i * 3 + 1) * 0.5) + shift; c.globalAlpha = a * (0.5 + rand(i) * 0.5); c.strokeStyle = i % 3 === 0 ? S.look.accent : rgba(S.P.fg, 0.3); c.lineWidth = (1 + rand(i + 4)) * S.u; c.beginPath(); c.moveTo(x, y); c.lineTo(x + len, y); c.stroke(); } c.restore(); };
  L.def('transition:send-whip-streaks', {
    kind: 'transition', plan() { return { pre: 0.24, post: 0.3, events: [{ at: -0.24, event: 'click-ui' }, { at: -0.08, event: 'slide-out' }] }; },
    tr(S, A, B, k, o) {
      const c = S.ctx;
      if (S.t < o.cut) {
        const p = split(o, k), xf = x => (x < 0.45 ? -10 * S.u * E.out(x / 0.45) : lerp(-10 * S.u, S.W * 1.1, inExpo((x - 0.45) / 0.55))), x = xf(p), v = Math.abs(xf(p + 0.02) - xf(p - 0.02));
        c.drawImage(B, 0, 0);
        if (v > 8) for (let g = 5; g >= 1; g--) { c.save(); c.globalAlpha = 0.12; c.drawImage(A, x - g * v * 0.5, 0); c.restore(); }
        c.drawImage(A, x, 0);
        streaks(S, clamp((p - 0.5) * 3), x * 0.2);
      } else { const q = after(o, k); c.drawImage(B, 0, 0); streaks(S, 1 - E.out(q), S.W * 0.22 + q * S.W * 0.2); }
    },
  });

  /* dive into the point: the camera dives onto A's exit dot in log space; B opens out of that dot as a disc */
  L.def('transition:dive-into-point', {
    kind: 'transition', plan() { return { pre: 0.42, post: 0.4, events: [{ at: -0.42, event: 'slide-out' }, { at: 0, event: 'hard-hit' }] }; },
    tr(S, A, B, k, o) {
      const c = S.ctx, PA = S.PA || S.P, p0 = pt(S, o.from), m0 = E.io(split(o, 1));
      const zoom = (x, a, extra) => { const m = E.io(x), s = logLerp(1, 6, m) * (extra || 1); c.save(); c.globalAlpha = a; c.translate(lerp(p0.x, S.W / 2, m), lerp(p0.y, S.H / 2, m)); c.scale(s, s); c.translate(-p0.x, -p0.y); c.drawImage(A, 0, 0); c.restore(); };
      if (S.t < o.cut) { const p = split(o, k); c.fillStyle = PA.bg; c.fillRect(0, 0, S.W, S.H); if (p > 0.1) zoom(p - 0.06, 0.3); zoom(p, 1); }
      else {
        const q = after(o, k), p1 = pt(S, o.to), r0 = ((o.to && o.to.r) || 0.016) * S.H, R = lerp(r0, cover(S, p1.x, p1.y), E.ramp(clamp((q - 0.15) / 0.85)));
        c.fillStyle = PA.bg; c.fillRect(0, 0, S.W, S.H); zoom(1, 1 - q, 1 + q * 0.6);
        c.save(); c.beginPath(); c.arc(p1.x, p1.y, R, 0, Math.PI * 2); c.clip(); c.drawImage(B, 0, 0); c.restore();
        if (q < 0.5) L.circle(c, p1.x, p1.y, r0 * (1 - q * 2), S.look.accent);
        void m0;
      }
    },
  });

  /* card stacks over card: the next shot slides up and over; the old one stays behind, higher, smaller, defocused */
  L.def('transition:card-stack-over', {
    kind: 'transition', plan() { return { pre: 0.02, post: 0.5, events: [{ at: 0, event: 'card-in' }] }; },
    tr(S, A, B, k, o) {
      const c = S.ctx, PA = S.PA || S.P; if (S.t < o.cut) { c.drawImage(A, 0, 0); return; }
      const q = E.out(after(o, k)), s = lerp(1, 0.92, q);
      c.fillStyle = PA.bg; c.fillRect(0, 0, S.W, S.H);
      c.save(); c.translate(S.W / 2, S.H / 2 - S.H * 0.05 * q); c.scale(s, s); c.translate(-S.W / 2, -S.H / 2); if (q > 0.02) c.filter = `blur(${(4 * S.u * q).toFixed(1)}px)`; c.drawImage(A, 0, 0); c.restore();
      c.fillStyle = rgba(PA.bg, 0.35 * q); c.fillRect(0, 0, S.W, S.H);
      const y = (1 - q) * S.H * 0.85, r = lerp(26 * S.u, 0, L.smooth(clamp((q - 0.7) / 0.3))), sb = lerp(0.95, 1, q);
      c.save(); c.translate(S.W / 2, S.H / 2 + y); c.scale(sb, sb); c.translate(-S.W / 2, -S.H / 2);
      c.shadowColor = 'rgba(0,0,0,0.25)'; c.shadowBlur = 50 * S.u; c.shadowOffsetY = -6 * S.u; L.rr(c, 0, 0, S.W, S.H, r); c.fillStyle = S.P.bg; c.fill(); c.shadowColor = 'transparent';
      L.rr(c, 0, 0, S.W, S.H, r); c.clip(); c.drawImage(B, 0, 0); c.restore();
    },
  });

  /* ═════════ cameras ═════════ */

  L.def('camera:float-drift', { kind: 'camera', cam(lt, d, o, S) { const u = (S && S.u) || 1; return { s: 1.025 + 0.014 * E.io(clamp(lt / Math.max(0.1, d))) + Math.sin(lt * 0.9) * 0.003, x: noise(lt * 0.25, 5) * 16 * u, y: noise(lt * 0.21, 11) * 11 * u, r: noise(lt * 0.18, 17) * 0.004 }; } });
  // a slow float, then in the last ~0.55 s a log dive onto the beat's exit point (it ends centred on it)
  L.def('camera:dive-to-exit', {
    kind: 'camera',
    cam(lt, d, o, S) {
      const dur = (o && o.dur) || 0.55, k = E.io(prog(lt, d - dur, dur)), ex = (S && S.b.exit) || { x: 0.5, y: 0.5 }, W = S ? S.W : 1920, H = S ? S.H : 1080;
      const base = 1.02 + 0.015 * clamp(lt / Math.max(0.1, d)), s = logLerp(1, (o && o.amount) || 5, k), fx = ((ex.x != null ? ex.x : 0.5) - 0.5) * W, fy = ((ex.y != null ? ex.y : 0.5) - 0.5) * H;
      return { s: base * s, x: -fx * base * s * k + noise(lt * 0.25, 3) * 8 * (1 - k), y: -fy * base * s * k, r: 0 };
    },
  });

  /* ═════════ set-ups ═════════ */

  // what the radar leaves behind: giant faint arcs crossing the frame, slowly breathing outward
  function giantArcs(S, a = 1, ox = 0.32, oy = 1.25) {
    const c = S.ctx, cx = S.W * ox, cy = S.H * oy, D = Math.hypot(S.W, S.H); c.save(); c.lineWidth = 1.3 * S.u;
    for (let i = 0; i < 6; i++) { const r = D * (0.42 + i * 0.2) + S.lt * 10 * S.u; c.strokeStyle = rgba(S.P.fg, (0.075 - i * 0.009) * a); c.beginPath(); c.arc(cx, cy, r, Math.PI, Math.PI * 2); c.stroke(); }
    c.restore();
  }
  // a defocused card further back (another lead, another window): depth, not decoration
  function ghostCard(S, x, y, w, h, blur, a, seed) {
    const c = S.ctx, P = cardP(S); c.save(); c.globalAlpha *= a; c.filter = `blur(${blur.toFixed(1)}px)`;
    L.card(c, x - w / 2, y - h / 2, w, h, 16 * S.u, { fill: P.card, u: S.u, lift: 0.6 });
    const pad = w * 0.06; L.circle(c, x - w / 2 + pad + w * 0.04, y - h / 2 + pad + w * 0.04, w * 0.04, mix(signals(S)[seed % 4], '#FFFFFF', 0.3));
    for (let i = 0; i < 4; i++) { L.rr(c, x - w / 2 + pad + (i ? 0 : w * 0.12), y - h / 2 + pad + w * 0.02 + i * h * 0.18 + (i ? h * 0.1 : 0), w * (i ? 0.5 + rand(seed + i) * 0.35 : 0.36), h * 0.045, h * 0.02); c.fillStyle = i ? P.rule : rgba(P.ink, 0.5); c.fill(); }
    c.restore();
  }

  /* night question: a centred two-line serif question, words rising out of their masks; a clock races past midnight */
  L.def('insert:serif-question-night', {
    kind: 'setup',
    plan(b, F) { const tp = T(b, F, 0.3); return { cues: { clock: 0.05, head: 0.3, headDone: tp.done, sub: tp.done + 0.15 }, events: tp.events, exit: { kind: 'rect', x: 0.5, y: 0.5, w: 0.62, h: 0.62 }, entry: { kind: 'dot', x: 0.5, y: 0.5, r: 0.012 } }; },
    draw(S) {
      const b = S.b, n = toks(b).length, px = S.u * (wide(S) ? 112 : 104) * (n <= 4 ? 1.2 : n <= 9 ? 1 : 0.84), maxW = S.W * (wide(S) ? 0.72 : 0.86);
      const m = L.layout(S.ctx, S.look, toks(b), { px, maxW, x: S.W / 2, y: 0, align: 'center', maxLines: 3, lineH: 1.08 });
      { const c = S.ctx, ww = S.W * (wide(S) ? 0.9 : 1.3); c.save(); c.globalAlpha *= 0.11 * E.out(prog(S.lt, 0, 1.2)); c.filter = `blur(${(16 * S.u).toFixed(1)}px)`; L.get('ui:prospect-list-window').draw(S, { x: S.W / 2, y: S.H * 0.62 - S.lt * 9 * S.u, w: ww, t0: -0.5, items: (S.b.data || {}).items, appear: false, tabsAt: 0.2, scrollAt: 0.3 }); c.restore(); L.bloom(c, S.W / 2, S.H * 1.05, S.W * 0.55, S.look.accent, 0.06); }
      L.headline(S, { px, maxW, x: S.W / 2, y: S.H * 0.48 - m.H / 2, align: 'center', maxLines: 3, lineH: 1.08 });
      clock(S, S.at('clock'));
      subPill(S, subText(S), S.at('sub'));
    },
  });

  /* the grind: a prospect list window (tabs multiplying, rows flicking, sent climbing, replies at zero) and a draft that
     gets typed, selected and deleted; the line runs as a karaoke subtitle */
  L.def('insert:prospect-list-grind', {
    kind: 'setup',
    plan(b) {
      const text = (b.data && b.data.prompt) || 'Hi, quick question about your team', d0 = 1.6, ty0 = d0 + 0.3, typed = ty0 + text.length / 28, sel = typed + 0.45, del = sel + 0.4;
      return { cues: { win: 0, sub: 0.25, draft: d0, sel, del }, events: [{ at: 0, event: 'card-in' }, { at: 0.6, event: 'list-item' }, { at: 1.3, event: 'list-item' }, { at: d0, event: 'card-in' }, { at: ty0, event: 'code' }, { at: sel, event: 'click-ui' }, { at: del, event: 'slide-out' }], exit: { kind: 'rect', x: 0.5, y: 0.5, w: 0.62, h: 0.62 }, entry: { kind: 'rect', x: 0.5, y: 0.5, w: 0.62, h: 0.62 }, min: del + 1.2 };
    },
    draw(S) {
      const b = S.b, d = b.data || {}, w = wide(S), t = tall(S), ww = S.W * (w ? 0.62 : t ? 0.92 : 0.88), wh = ww * 660 / 1180, cy = S.H * (t ? 0.42 : 0.47);
      L.get('ui:prospect-list-window').draw(S, { x: S.W / 2, y: cy, w: ww, t0: S.at('win'), items: d.items, rows: d.rows, query: d.query, appear: false });
      L.get('ui:draft-rewrite-popover').draw(S, { x: S.W / 2 + ww * 0.2, y: cy + wh * (t ? 0.42 : 0.24), w: ww * (t ? 0.62 : 0.48), t0: S.at('draft'), text: d.prompt });
      clock(S, 0.05);
      subPill(S, subText(S) || toks(b).map(x => x.s).join(' '), S.at('sub'));
    },
  });

  /* sonar: one accent dot, scattered grey points; rings pulse out and light each point they pass */
  const sonarPts = (W, H, seed) => { const w = W / H > 1.3, cx = W / 2, cy = H * (H / W > 1.3 ? 0.42 : 0.44), rx = w ? H * 0.62 : W * 0.42, ry = w ? H * 0.34 : W * 0.4, out = []; for (let i = 0; i < 16; i++) { const a = rand(seed + i * 17) * Math.PI * 2, r = 0.3 + rand(seed + i * 23) * 0.7; out.push({ x: cx + Math.cos(a) * rx * r, y: cy + Math.sin(a) * ry * r, d: Math.hypot(Math.cos(a) * rx * r, Math.sin(a) * ry * r) }); } return { cx, cy, pts: out, R: Math.max(rx, ry) * 1.1 }; };
  const SON = { ring0: 0.9, per: 0.34, speed: 0.95 };
  L.def('insert:sonar-points-light', {
    kind: 'setup',
    plan(b, F) {
      const g = sonarPts(F.W || 1920, F.H || 1080, L.hash('sonar' + (b.i || 0))), v = g.R / SON.speed, tp = T(b, F, 0.5);
      const lit = g.pts.map(p => SON.ring0 + p.d / v).sort((a, c) => a - c);
      return { cues: { pts: 0.15, head: 0.5, headDone: tp.done, sub: 0.3 }, events: [{ at: 0.15, event: 'cascade' }, { at: SON.ring0, event: 'stat' }, ...lit.filter((_, i) => i % 4 === 0).map(at => ({ at, event: 'pop' })), ...tp.events], exit: { kind: 'dot', x: g.cx / (F.W || 1920), y: g.cy / (F.H || 1080), r: 0.013 }, entry: { kind: 'dot', x: g.cx / (F.W || 1920), y: g.cy / (F.H || 1080), r: 0.013 } };
    },
    draw(S) {
      const c = S.ctx, g = sonarPts(S.W, S.H, L.hash('sonar' + (S.b.i || 0))), v = g.R / SON.speed, acc = S.look.accent;
      for (let j = 0; j < 12; j++) { const r = (S.lt - SON.ring0 - j * SON.per) * v; if (r <= 0 || r > g.R) continue; c.save(); c.shadowColor = rgba(acc, 0.6); c.shadowBlur = 6 * S.u; L.circle(c, g.cx, g.cy, r, null, rgba(acc, 0.6 * (1 - r / g.R)), 2.5 * S.u); c.restore(); }
      g.pts.forEach((p, i) => {
        const a = E.out(prog(S.lt, S.at('pts') + i * 0.03, 0.4)); if (a <= 0) return;
        const lt = SON.ring0 + p.d / v, lk = S.lt > lt ? spring(S.lt - lt, 'pop') : 0;
        c.save(); c.globalAlpha *= a; if (lk > 0) L.bloom(c, p.x, p.y, 18 * S.u, acc, 0.35 * clamp(lk));
        L.circle(c, p.x, p.y, lerp(4, 6.5, lk) * S.u, lk > 0 ? mix(S.P.fg, acc, clamp(lk * 1.5)) : rgba(S.P.fg, 0.4)); c.restore();
      });
      const br = 1 + Math.sin(S.lt * 3) * 0.05; L.bloom(c, g.cx, g.cy, 40 * S.u, acc, 0.25); L.circle(c, g.cx, g.cy, 14 * S.u * br, acc);
      cornerHead(S, { px: 84 });
      subPill(S, subText(S), S.at('sub'));
    },
  });

  /* the radar finds signals: rings + bearing scale, an accent sweep wedge; each signal blooms and grows a chip */
  L.def('insert:radar-signal-sweep', {
    kind: 'setup',
    plan(b, F) {
      const n = Math.max(3, Math.min(6, ((b.data && b.data.items) || []).length || 4)), its = radarItems(n, 0.2, F.W || 1920, F.H || 1080), tp = T(b, F, 0.35), last = its[its.length - 1];
      return { cues: { sweep: 0.2, eyebrow: 0.1, head: 0.35, headDone: tp.done, sub: 0.4 }, events: [{ at: 0.2, event: 'ui-reveal' }, ...its.map(x => ({ at: x.found + 0.22, event: 'list-item' })), ...tp.events], exit: { kind: 'dot', x: last.x / (F.W || 1920), y: last.y / (F.H || 1080), r: 0.008 }, entry: { kind: 'dot', x: 0.5, y: radarGeom(F.W || 1920, F.H || 1080).cy / (F.H || 1080), r: 0.013 }, min: last.found + 1.0 };
    },
    draw(S) {
      const c = S.ctx, g = radarGeom(S.W, S.H), d = S.b.data || {}, items = (d.items || ['Signal']).slice(0, 6), n = Math.max(3, Math.min(6, items.length || 4)), its = radarItems(n, S.at('sweep'), S.W, S.H), sig = signals(S);
      radarScale(S, g.cx, g.cy, g.R, 0.9);
      const ang = -40 + SWEEP * Math.max(0, S.lt - S.at('sweep'));
      bgPoints(S, g.cx, g.cy, g.R, ang, S.seed);
      wedge(S, g.cx, g.cy, g.R, ang, E.out(prog(S.lt, S.at('sweep'), 0.3)));
      const csc = S.u * (tall(S) ? 1.3 : wide(S) ? 1.2 : 1.05), pl = placeChips(S, its, items, csc);
      its.forEach((it, i) => L.get('ui:signal-chip-ring').draw(S, { pt: it, t0: it.found, label: pl[i].label, side: pl[i].side, dy: pl[i].dy, meta: i ? `${i + 1}h` : 'now', color: sig[i % 4], scale: csc }));
      L.circle(c, g.cx, g.cy, 9 * S.u, S.look.accent);
      chapter(S, S.at('eyebrow')); cornerHead(S); subPill(S, subText(S), S.at('sub'));
    },
  });

  /* lock-on: the sweep slows onto one signal, brackets snap round it with a score tag, every other signal blurs away */
  L.def('insert:radar-lock-target', {
    kind: 'setup',
    plan(b, F) {
      const n = Math.max(2, Math.min(6, ((b.data && b.data.items) || []).length || 4)), its = radarItems(n, 0.2, F.W || 1920, F.H || 1080), tgt = its[Math.min(1, n - 1)], tp = T(b, F, 0.3);
      return { cues: { lock: 1.0, head: 0.3, headDone: tp.done, sub: 0.3, eyebrow: 0.05 }, events: [{ at: 0.15, event: 'cascade' }, { at: 1.0, event: 'key-word' }, { at: 1.15, event: 'stat' }, ...tp.events], exit: { kind: 'dot', x: tgt.x / (F.W || 1920), y: tgt.y / (F.H || 1080), r: 0.009 }, min: 2.4 };
    },
    draw(S) {
      const c = S.ctx, g = radarGeom(S.W, S.H), d = S.b.data || {}, items = (d.items || ['Signal']).slice(0, 6), n = Math.max(2, Math.min(6, items.length || 4)), its = radarItems(n, 0.2, S.W, S.H), sig = signals(S), ti = Math.min(1, n - 1), tgt = its[ti], lock = S.at('lock');
      const ang = L.kf(S.lt, [[0, tgt.bearing - 160], [lock, tgt.bearing, E.out]]), wa = 1 - E.out(prog(S.lt, lock + 0.4, 0.4));
      radarScale(S, g.cx, g.cy, g.R, 0.9);
      bgPoints(S, g.cx, g.cy, g.R, ang, S.seed, 1 - 0.6 * E.out(prog(S.lt, lock + 0.2, 0.4)));
      wedge(S, g.cx, g.cy, g.R, ang, wa);
      const csc = S.u * (tall(S) ? 1.3 : wide(S) ? 1.2 : 1.05), pl = placeChips(S, its, items, csc);
      its.forEach((it, i) => { const cull = i === ti ? 0 : E.out(prog(S.lt, lock + 0.2 + i * 0.03, 0.3)); L.get('ui:signal-chip-ring').draw(S, { pt: it, t0: 0.1 + i * 0.07, label: pl[i].label, side: pl[i].side, dy: pl[i].dy, meta: i ? `${i + 1}h` : 'now', color: i === ti ? S.look.accent : sig[i % 4], scale: csc, cull }); });
      const num = d.number && typeof d.number.value === 'number' && d.number.value <= 100 ? d.number.value : 92;
      L.get('ui:reticle-score-tag').draw(S, { x: tgt.x, y: tgt.y, t0: lock, value: num, scale: S.u * 1.1 });
      L.circle(c, g.cx, g.cy, 9 * S.u, S.look.accent);
      chapter(S, S.at('eyebrow')); cornerHead(S); subPill(S, subText(S), S.at('sub'));
    },
  });

  /* the dot becomes the avatar: a lead score card unfolds around it in real perspective, the score counts up */
  const scoreGeom = S => { const w = wide(S), t = tall(S), cw = S.W * (w ? 0.46 : t ? 0.86 : 0.76); return { x: S.W * (w ? 0.63 : 0.5), y: S.H * (w ? 0.42 : t ? 0.38 : 0.4), w: cw, sc: cw / SC_DW }; };
  const scoreData = (S, o = {}) => { const d = S.b.data || {}, it = d.items || []; return { name: (d.lead && d.lead.name) || it[0] || brand().name, role: (d.lead && d.lead.sub) || brand().host, chips: it.slice(1, 4), line: subText(S) || brand().tagline, value: d.number && typeof d.number.value === 'number' && d.number.value <= 100 ? d.number.value : 92, scoreLabel: d.number && d.number.label && d.number.label.length < 16 ? d.number.label : undefined, company: brand().name }; };
  L.def('insert:lead-score-card', {
    kind: 'setup',
    plan(b, F) {
      const W = F.W || 1920, H = F.H || 1080, w = W / H > 1.3, t = H / W > 1.3, cw = W * (w ? 0.46 : t ? 0.86 : 0.76), sc = cw / SC_DW, cx = W * (w ? 0.63 : 0.5), cy = H * (w ? 0.42 : t ? 0.38 : 0.4);
      const ax = cx + (72 - SC_DW / 2) * sc, ay = cy + (72 - SC_DH / 2) * sc, tp = T(b, F, 0.45);
      return { cues: { grow: 0.15, card: 0.12, head: 0.45, headDone: tp.done, eyebrow: 0.1, sub: 0.5 }, events: [{ at: 0.12, event: 'card-in' }, { at: 1.1, event: 'stat' }, ...tp.events], entry: { kind: 'dot', x: ax / W, y: ay / H, r: 0.014 }, exit: { kind: 'rect', x: cx / W, y: cy / H, w: cw / W, h: cw * SC_DH / SC_DW / H } };
    },
    draw(S) {
      const c = S.ctx, g = scoreGeom(S), ax = g.x + (72 - SC_DW / 2) * g.sc, ay = g.y + (72 - SC_DH / 2) * g.sc, k = E.out(prog(S.lt, S.at('grow'), 0.3));
      giantArcs(S);
      const gk = E.out(prog(S.lt, 0.35, 0.7)), gh = g.w * SC_DH / SC_DW, dr = Math.sin(S.lt * 0.8) * 6 * S.u;
      if (gk > 0) { ghostCard(S, g.x - g.w * 0.42, g.y - gh * 0.55 + (1 - gk) * 40 * S.u + dr, g.w * 0.7, gh * 0.72, 9 * S.u, 0.55 * gk, 3); ghostCard(S, g.x + g.w * 0.44, g.y + gh * 0.62 - (1 - gk) * 40 * S.u - dr, g.w * 0.62, gh * 0.66, 12 * S.u, 0.45 * gk, 6); }
      if (k < 1) { const r = lerp(14 * S.u, 32 * g.sc, E.out(prog(S.lt, 0, 0.18))); L.circle(c, ax, ay, r, S.look.accent); }
      if (k > 0) { c.save(); c.translate(ax, ay); c.scale(lerp(0.06, 1, k), lerp(0.06, 1, k)); c.translate(-ax, -ay); L.get('ui:fit-score-card').draw(S, Object.assign(scoreData(S), { x: g.x, y: g.y, w: g.w, t0: S.at('card') + 0.1 })); c.restore(); }
      chapter(S, S.at('eyebrow')); cornerHead(S, { maxW: wide(S) ? 0.42 : 0.85 }); subPill(S, subText(S), S.at('sub'));
    },
  });

  /* the message: a sequence card stacks over the score card, ghost-types the message, the cursor sends it, and the
     stack whips off right on speed lines */
  const seqTimes = b => { const text = (b.text && b.text.sub) || (b.data && b.data.prompt) || 'Saw your note on hiring. Here is a thought.', typeAt = 0.6, typed = typeAt + Math.min(text.length, 220) / 34, click = typed + 0.45; return { typeAt, typed, click, whip: click + 0.22 }; };
  L.def('insert:sequence-draft-send', {
    kind: 'setup',
    plan(b, F) { const q = seqTimes(b), tp = T(b, F, 0.3); return { cues: { stack: 0.05, head: 0.3, headDone: tp.done, eyebrow: 0.05, click: q.click, whip: q.whip }, events: [{ at: 0.05, event: 'card-in' }, { at: q.typeAt, event: 'code' }, { at: q.click, event: 'click-ui' }, { at: q.whip + 0.05, event: 'slide-out' }, ...tp.events], exit: { kind: 'dot', x: 0.5, y: 0.45, r: 0.012 }, entry: { kind: 'rect', x: 0.6, y: 0.45, w: 0.42, h: 0.4 }, min: q.whip + 0.75 };
    },
    draw(S) {
      const c = S.ctx, g = scoreGeom(S), q = seqTimes(S.b), d = S.b.data || {}, w = wide(S), t = tall(S);
      giantArcs(S);
      const sk = E.out(prog(S.lt, S.at('stack'), 0.4)), wk = clamp((S.lt - q.whip) / 0.16), wind = S.lt < q.whip ? -10 * S.u * E.out(clamp((S.lt - q.click - 0.05) / 0.17)) : lerp(-10 * S.u, S.W * 1.2, inExpo(wk)), v = S.lt > q.whip && wk < 1 ? S.W * 0.25 : 0;
      // the back card stays; after the send it comes back into focus and settles down a little
      const back = 1 - E.out(prog(S.lt, q.whip + 0.15, 0.5)), bk = sk * back;
      L.get('ui:fit-score-card').draw(S, Object.assign(scoreData(S), { x: g.x, y: g.y - S.H * 0.06 * sk + S.H * 0.03 * (1 - back), w: g.w * lerp(1, 0.94, bk), blur: 3 * S.u * bk, key: 'l02-back', t0: -5 }));
      const front = (dx, a) => {
        c.save(); c.globalAlpha *= a; c.translate(dx, 0);
        const fy = g.y + (t ? S.H * 0.06 : S.H * 0.1) + (1 - sk) * S.H * 0.6;
        const r = L.get('ui:sequence-message-card').draw(S, { x: g.x + (w ? 40 * S.u : 0), y: fy, w: g.w, typeAt: q.typeAt, text: (S.b.text && S.b.text.sub) || d.prompt, subject: (d.items && d.items[0]), press: L.pressAt([q.click], S.lt).p, steps: d.steps });
        c.restore(); return r;
      };
      if (v) for (let gi = 4; gi >= 1; gi--) front(wind - gi * v * 0.12, 0.12);
      const r = wk < 1 ? front(wind, 1) : null;
      if (S.lt > q.whip) streaks(S, 1 - E.out(prog(S.lt, q.whip + 0.1, 0.45)), (S.lt - q.whip) * S.W * 0.4);
      if (r && S.lt < q.whip) L.cursorDraw(S, [[q.typed - 0.3, 0.86, 0.95], [q.click - 0.04, r.send.x / S.W + 0.004, r.send.y / S.H + 0.01], [q.whip, r.send.x / S.W, r.send.y / S.H + 0.01]], [q.click]);
      chapter(S, S.at('eyebrow')); cornerHead(S, { tokens: toks(S.b), maxW: w ? 0.42 : 0.85 });
    },
  });

  /* the reply: a notification drops in and settles, rings pulse from the avatar; the card fades and leaves its dot */
  L.def('insert:reply-drop-pulse', {
    kind: 'setup',
    plan(b, F) { const tp = T(b, F, 0.6), d = b.d || 3; return { cues: { drop: 0.2, head: 0.6, headDone: tp.done, eyebrow: 0.05, sub: 0.4, leave: Math.max(tp.done + 0.6, d - 0.7) }, events: [{ at: 0.2, event: 'notify' }, { at: 0.5, event: 'pop' }, ...tp.events], exit: { kind: 'dot', x: 0.5, y: 0.5, r: 0.012 }, min: 2.6 }; },
    draw(S) {
      const g = { x: S.W / 2, y: S.H * (tall(S) ? 0.36 : 0.4), w: S.W * (wide(S) ? 0.46 : tall(S) ? 0.9 : 0.78) }, d = S.b.data || {}, leave = S.at('leave');
      giantArcs(S, 0.8);
      { const bk = E.out(prog(S.lt, 0, 0.6)) * (1 - E.out(prog(S.lt, leave, 0.3))), ww = S.W * (wide(S) ? 0.7 : 0.96); S.ctx.save(); S.ctx.globalAlpha *= 0.42 * bk; S.ctx.filter = `blur(${(7 * S.u).toFixed(1)}px)`; L.get('ui:prospect-list-window').draw(S, { x: S.W / 2 + Math.sin(S.lt * 0.5) * 8 * S.u, y: S.H * 0.44 - S.lt * 6 * S.u, w: ww, t0: -0.2, items: d.items, appear: false, tabs: 6, tabsAt: 99, scrollAt: 0.2 }); S.ctx.restore(); }
      const fade = E.out(prog(S.lt, leave, 0.2)), gk = E.io(prog(S.lt, leave + 0.15, 0.4)), sc = g.w / 640;
      const ax = g.x + (60 - 320) * sc;
      if (gk <= 0) L.get('ui:reply-notification-drop').draw(S, { x: g.x, y: g.y, w: g.w, t0: S.at('drop'), name: (d.lead && d.lead.name) || (d.items && d.items[0]), line: subText(S) || d.prompt || brand().tagline, fade });
      else { const x = lerp(ax, S.W / 2, gk), y = lerp(g.y, S.H / 2, gk) - Math.sin(Math.PI * gk) * S.H * 0.06; L.circle(S.ctx, x, y, lerp(30 * sc, 14 * S.u, gk), S.look.accent); }
      chapter(S, S.at('eyebrow'));
      S.ctx.save(); S.ctx.globalAlpha *= 1 - fade; cornerHead(S); S.ctx.restore();
      if (!subText(S)) return; S.ctx.save(); S.ctx.globalAlpha *= 1 - fade; subPill(S, subText(S), S.at('sub')); S.ctx.restore();
    },
  });

  /* petals into the mark: the dot pulses, four coloured petals burst onto an orbit, circle, converge, turn ink */
  function petalMark(S, cx, cy, M, t, o = {}) {
    const c = S.ctx, sig = signals(S), inkC = S.P.fg, grey = mix(S.P.fg, S.P.bg, 0.45), RO = M * 1.9;
    const outK = E.out(prog(t, 0.45, 0.22)), conv = E.io(prog(t, 0.95, 0.2)), toInk = E.out(prog(t, 1.0, 0.25)), spin = (1 - spring(t - 1.15, 'pop')) * (t > 1.15 ? -0.9 : 0);
    if (t < 0.5) { const pk = t > 0.3 ? 1 + Math.sin(Math.PI * clamp((t - 0.3) / 0.15)) * 0.4 : 1; L.circle(c, cx, cy, 14 * S.u * pk * (1 - clamp((t - 0.45) / 0.05)), S.look.accent); }
    if (t > 1.1 && t < 2.2) { const gk = prog(t, 1.1, 1.0); L.circle(c, cx, cy, RO * lerp(1, 1.7, E.out(gk)), null, rgba(S.look.accent, 0.35 * (1 - gk)), 1.5 * S.u); }
    if (t > 0.45 && t < 1.1) L.circle(c, cx, cy, RO * outK, null, rgba(S.look.accent, 0.25 * (1 - conv)), 1.2 * S.u);
    if (t <= 0.45) return;
    const logo = L.img && L.img('logo'), lk = logo && o.logo !== false ? E.out(prog(t, 1.45, 0.35)) : 0;
    c.save(); c.translate(cx, cy); c.rotate(spin); c.globalAlpha *= 1 - lk;
    for (let i = 0; i < 4; i++) {
      const th = (i * 90 + 45 + 200 * Math.max(0, t - 0.45)) * Math.PI / 180, ox = Math.sin(th) * RO * outK, oy = -Math.cos(th) * RO * outK;
      const fa = i * Math.PI / 2, fx = Math.cos(fa) * -M * 0.1 - Math.sin(fa) * -M * 0.02, fy = Math.sin(fa) * -M * 0.1 + Math.cos(fa) * -M * 0.02;
      const x = lerp(ox, fx, conv), y = lerp(oy, fy, conv), rot = lerp(th - Math.PI / 4 + Math.PI / 2 * 0, fa, conv), pr = lerp(lerp(M * 0.12, M * 0.3, outK), M * 0.5, conv);
      const col = mix(sig[i], i % 2 ? grey : inkC, toInk);
      c.save(); c.translate(x, y); c.rotate(rot); c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, pr, -Math.PI / 2, 0); c.closePath(); c.fillStyle = col; c.fill(); c.restore();
    }
    c.restore();
    if (lk > 0) { const s = M * 1.15; c.save(); c.globalAlpha *= lk; c.drawImage(logo, cx - s / 2, cy - s / 2, s, s); c.restore(); }
  }
  L.def('insert:petal-orbit-mark', {
    kind: 'setup',
    plan(b, F) { const tp = T(b, F, 1.5); return { cues: { mark: 0, head: 1.5, headDone: tp.done }, events: [{ at: 0.3, event: 'accent' }, { at: 0.45, event: 'build' }, { at: 1.0, event: 'hard-hit' }, ...tp.events], entry: { kind: 'dot', x: 0.5, y: 0.44, r: 0.013 }, exit: { kind: 'dot', x: 0.5, y: 0.44, r: 0.03 }, min: 2.6 }; },
    draw(S) {
      const M = Math.min(S.W, S.H) * 0.13, cx = S.W / 2, cy = S.H * 0.44;
      giantArcs(S, 0.7 * (1 - E.out(prog(S.lt, 0.9, 0.8))), 0.5, 0.44 + 0.0);
      petalMark(S, cx, cy, M, S.lt - S.at('mark'));
      if (toks(S.b).length) { const px = 64 * S.u * (tall(S) ? 1.1 : 1), maxW = S.W * 0.78; L.headline(S, { px, maxW, x: cx, y: cy + M * 1.25, align: 'center', maxLines: 2 }); }
    },
  });

  /* one clause per chapter: an index column (01 — item) with a filling hairline, a big serif clause that rises and
     sinks per step, and a segmented dial counting the chapters */
  const STEP = 0.95;
  L.def('insert:clause-chapter-steps', {
    kind: 'setup',
    plan(b) { const n = Math.max(2, Math.min(4, ((b.data && b.data.items) || []).length || 3)); return { cues: { col: 0.05, sub: 0.3 }, events: [{ at: 0.05, event: 'cascade' }, ...Array.from({ length: n }, (_, i) => ({ at: 0.2 + i * STEP, event: 'list-item' }))], exit: { kind: 'dot', x: 0.5, y: 0.5, r: 0.012 }, min: 0.2 + n * STEP + 0.5 }; },
    draw(S) {
      const c = S.ctx, items = ((S.b.data && S.b.data.items) || ['One', 'Two', 'Three']).slice(0, 4), n = Math.max(2, items.length), w = wide(S), t = tall(S);
      const cur = clamp(Math.floor((S.lt - 0.2) / STEP), 0, n - 1), x0 = S.W * (w ? 0.057 : 0.075), y0 = S.H * (t ? 0.08 : 0.13), rowH = 56 * S.u, px = 22 * S.u;
      items.forEach((s, i) => {
        const a = E.out(prog(S.lt, 0.05 + i * 0.06, 0.4)), y = y0 + i * rowH, act = i === cur, done = i < cur;
        c.save(); c.globalAlpha *= a; c.translate((1 - a) * 12 * S.u, 0);
        L.text(c, S.look, String(i + 1).padStart(2, '0'), x0, y, { role: 'micro', px, color: act || done ? S.look.accent : S.P.dim });
        const rx = x0 + px * 2.2, rw = px * 2.4; L.line(c, rx, y - px * 0.36, rx + rw, y - px * 0.36, rgba(S.P.fg, 0.18), 1.5 * S.u);
        const fk = done ? 1 : act ? clamp((S.lt - 0.2 - i * STEP) / STEP) : 0; if (fk > 0) L.line(c, rx, y - px * 0.36, rx + rw * fk, y - px * 0.36, S.look.accent, 1.5 * S.u);
        L.text(c, S.look, s, rx + rw + px * 0.8, y, { role: 'ui', px: px * 1.2, weight: 550, color: act ? S.P.fg : S.P.dim, maxW: S.W * 0.4 });
        c.restore();
      });
      if (w || !t) { // the dial: n segments, one fills per step
        const dx = S.W * (w ? 0.76 : 0.74), dy = S.H * (w ? 0.36 : 0.3), R = Math.min(S.H * 0.2, S.W * 0.16), gap = 0.08;
        for (let i = 0; i < n; i++) { const a0 = -Math.PI / 2 + i * Math.PI * 2 / n + gap, a1 = -Math.PI / 2 + (i + 1) * Math.PI * 2 / n - gap; c.save(); c.lineCap = 'round'; c.lineWidth = 3 * S.u; c.strokeStyle = rgba(S.P.fg, 0.12); c.beginPath(); c.arc(dx, dy, R, a0, a1); c.stroke(); const fk = clamp((S.lt - 0.2 - i * STEP) / (STEP * 0.6)); if (fk > 0) { c.strokeStyle = S.look.accent; c.beginPath(); c.arc(dx, dy, R, a0, lerp(a0, a1, E.out(fk))); c.stroke(); } c.restore(); }
        const nk = E.out(prog(S.lt, 0.2 + cur * STEP, 0.35)); c.save(); c.beginPath(); c.rect(dx - R, dy - R * 0.6, R * 2, R * 1.0); c.clip();
        L.text(c, S.look, String(cur + 1).padStart(2, '0'), dx, dy + R * 0.25 + (1 - nk) * R * 0.6, { role: 'numeral', px: R * 0.72, color: S.P.fg, align: 'center' }); c.restore();
      }
      for (let i = 0; i < n; i++) {
        const t0 = 0.2 + i * STEP; if (S.lt < t0 - 0.05 || (i < n - 1 && S.lt > t0 + STEP)) continue;
        const ws = String(items[i]).split(/\s+/), tokens = ws.map((s, j) => ({ s, accent: j === ws.length - 1 }));
        cornerHead(S, { tokens, px: 124, maxW: w ? 0.62 : 0.85, type: 'effect:type-rise-sink', t0, out: i < n - 1 ? t0 + STEP - 0.26 : 99 });
      }
      subPill(S, subText(S) || toks(S.b).map(x => x.s).join(' '), S.at('sub'));
    },
  });

  /* serif odometer: one big serif number whose digits roll like a mechanical counter, a hairline, a label */
  L.def('insert:serif-stat-ticker', {
    kind: 'setup',
    plan(b, F) { const tp = T(b, F, 0.75); return { cues: { num: 0.1, label: 0.7, head: 0.75, headDone: tp.done }, events: [{ at: 0.1, event: 'riffle' }, { at: 1.2, event: 'stat' }, ...tp.events], exit: { kind: 'dot', x: 0.5, y: 0.5, r: 0.012 } }; },
    draw(S) {
      const c = S.ctx, b = S.b, nn = (b.data && b.data.number) || { value: 92, suffix: '%' }, val = typeof nn.value === 'number' ? nn.value : parseFloat(nn.value) || 0;
      const dec = Number.isInteger(val) ? 0 : 1, target = Math.round(Math.abs(val) * Math.pow(10, dec)), digits = String(target).length, k = E.out(prog(S.lt, S.at('num'), 1.2)), v = target * k;
      const px = Math.min(S.H * 0.42, S.W * 0.28) * Math.min(1, 4 / (digits + (nn.prefix || '').length + (nn.suffix || '').length * 0.6 + dec * 0.4));
      const o = { role: 'numeral', px, color: S.P.fg, tracking: -0.02 }, cw = Math.max(...'0123456789'.split('').map(d => L.textW(c, S.look, d, o)));
      const pre = nn.prefix || '', suf = nn.suffix || '', pw = pre ? L.textW(c, S.look, pre, o) : 0, sw = suf ? L.textW(c, S.look, suf, Object.assign({}, o, { color: S.look.accent })) : 0, dotW = dec ? px * 0.25 : 0;
      const total = pw + cw * digits + dotW + sw, x0 = S.W / 2 - total / 2, base = S.H * 0.52 + px * 0.34, rise = (1 - E.out(prog(S.lt, S.at('num'), 0.5))) * 40 * S.u;
      { const R0 = Math.min(S.W, S.H) * 0.2; for (let i = 0; i < 6; i++) { const r = R0 * (1 + i * 0.55) + S.lt * 14 * S.u; L.circle(c, S.W / 2, S.H * 0.5, r, null, rgba(S.P.fg, 0.07 - i * 0.009), 1.2 * S.u); }
        const its = ((b.data && b.data.items) || []).slice(0, 4), sig = signals(S);
        its.forEach((s, i) => { const a = -2.4 + i * (Math.PI * 2 / Math.max(4, its.length)) + S.lt * 0.06, rx = S.W * (wide(S) ? 0.36 : 0.38), ry = S.H * (wide(S) ? 0.36 : 0.34), x = S.W / 2 + Math.cos(a) * rx, y = S.H * 0.5 + Math.sin(a) * ry, far = i % 2; c.save(); if (far) { c.globalAlpha *= 0.55; c.filter = `blur(${(3 * S.u).toFixed(1)}px)`; } L.get('ui:signal-chip-ring').draw(S, { pt: { x, y }, t0: 0.5 + i * 0.18, label: s, color: sig[i % 4], scale: S.u * (far ? 0.95 : 1.15), side: x > S.W / 2 ? 1 : -1 }); c.restore(); }); }
      c.save(); c.globalAlpha *= clamp(prog(S.lt, S.at('num'), 0.2)); c.translate(0, rise);
      if (pre) L.text(c, S.look, pre, x0, base, o);
      let x = x0 + pw;
      for (let i = 0; i < digits; i++) {
        const p = digits - 1 - i, pos = (v / Math.pow(10, p)) % 10, lower = p > 0 ? (v / Math.pow(10, p - 1)) % 10 : 0;
        let dg = Math.floor(pos), fr = p === 0 ? pos - dg : (lower > 9 ? lower - 9 : 0); if (k >= 1) { dg = Number(String(target)[i]); fr = 0; }
        if (i === digits - dec && dec) { L.text(c, S.look, '.', x, base, o); x += dotW; }
        c.save(); c.beginPath(); c.rect(x - 4, base - px * 0.8, cw + 8, px * 0.83); c.clip();
        c.save(); c.globalAlpha *= 1 - fr; L.text(c, S.look, String(dg % 10), x + cw / 2, base - fr * px * 0.9, Object.assign({}, o, { align: 'center' })); c.restore();
        if (fr > 0) { c.save(); c.globalAlpha *= fr * fr; L.text(c, S.look, String((dg + 1) % 10), x + cw / 2, base + (1 - fr) * px * 0.9, Object.assign({}, o, { align: 'center' })); c.restore(); }
        c.restore(); x += cw;
      }
      if (suf) L.text(c, S.look, suf, x + px * 0.02, base, Object.assign({}, o, { color: S.look.accent }));
      c.restore();
      const lk = E.out(prog(S.lt, S.at('label'), 0.5));
      if (lk > 0) { L.line(c, S.W / 2 - 150 * S.u * lk, base + 56 * S.u, S.W / 2 + 150 * S.u * lk, base + 56 * S.u, S.look.accent, 1.5 * S.u); if (nn.label) { c.save(); c.globalAlpha *= lk; L.text(c, S.look, nn.label, S.W / 2, base + 104 * S.u, { role: 'ui', px: 28 * S.u, color: S.P.dim, align: 'center', maxW: S.W * 0.8 }); c.restore(); } }
      if (toks(b).length) L.headline(S, { px: 58 * S.u, maxW: S.W * 0.7, x: S.W / 2, y: S.H * 0.1, align: 'center', maxLines: 2 });
    },
  });

  /* ═════════ end card ═════════ */

  /* lockup: the petal mark spins in, slides left as the wordmark reveals behind a mask, the tagline lands at reading
     pace with its last word in the accent, an accent CTA rises on a soft glow */
  L.def('end_card:mark-slide-lockup', {
    kind: 'end',
    plan(b, F) { const tag = (F && F.brand && F.brand.tagline) || '', wn = tag ? tag.split(/\s+/).length : 0, tagEnd = 0.95 + wn * 0.22; return { cues: { mark: 0, slide: 0.45, tag: 0.95, cta: tagEnd + 0.3 }, events: [{ at: 0.05, event: 'build' }, { at: 0.5, event: 'key-word' }, { at: 0.95, event: 'word' }, { at: tagEnd + 0.3, event: 'cta' }], entry: { kind: 'dot', x: 0.5, y: 0.46, r: 0.013 }, min: tagEnd + 1.4 }; },
    draw(S) {
      const c = S.ctx, B = brand(), name = B.name || 'Brand', px = Math.min(S.H * 0.13, S.W * 0.1) * (name.length > 9 ? 9 / name.length : 1), cy = S.H * 0.46;
      const M = px * 0.92, gap = px * 0.3, nw = L.textW(c, S.look, name, { role: 'wordmark', px, weight: 700, tracking: -0.04 }), total = M + gap + nw;
      const sk = eio(prog(S.lt, S.at('slide'), 0.5)), mx = lerp(S.W / 2, S.W / 2 - total / 2 + M / 2, sk), my = cy - px * 0.34;
      // the mark: settled petals spinning in (or the real logo)
      const ink = S.P.fg, grey = mix(S.P.fg, S.P.bg, 0.45), mk = spring(S.lt - S.at('mark'), 'pop'), rot = (1 - E.out(prog(S.lt, 0, 0.6))) * -Math.PI * 0.75;
      const logo = L.img && L.img('logo');
      c.save(); c.translate(mx, my); c.scale(mk, mk); c.rotate(rot);
      if (logo) c.drawImage(logo, -M / 2, -M / 2, M, M);
      else for (let i = 0; i < 4; i++) { const fa = i * Math.PI / 2; c.save(); c.translate(Math.cos(fa) * -M * 0.1 - Math.sin(fa) * -M * 0.02, Math.sin(fa) * -M * 0.1 + Math.cos(fa) * -M * 0.02); c.rotate(fa); c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, M * 0.5, -Math.PI / 2, 0); c.closePath(); c.fillStyle = i % 2 ? grey : ink; c.fill(); c.restore(); }
      c.restore();
      const gk = prog(S.lt, 0.1, 1.4); if (gk > 0 && gk < 1) L.circle(c, mx, my, M * lerp(0.9, 2.6, E.out(gk)), null, rgba(S.look.accent, 0.3 * (1 - gk)), 1.4 * S.u);
      // the wordmark letters, revealed right of the mark's edge
      const nx = S.W / 2 - total / 2 + M + gap, mask = mx + M / 2 + gap * 0.3;
      c.save(); c.beginPath(); c.rect(mask, cy - px * 1.1, S.W, px * 1.5); c.clip();
      let x = nx; [...name].forEach((ch, i) => { const cwid = L.textW(c, S.look, ch, { role: 'wordmark', px, weight: 700, tracking: -0.04 }); const lk = E.expo(prog(S.lt, S.at('slide') + 0.05 + i * 0.035, 0.45)); if (lk > 0) { c.save(); c.globalAlpha *= clamp(lk * 1.5); L.text(c, S.look, ch, x + (1 - lk) * 40 * S.u, cy, { role: 'wordmark', px, weight: 700, color: S.P.fg, tracking: -0.04 }); c.restore(); } x += cwid; });
      c.restore();
      // tagline at reading pace, last word in the accent
      const tag = B.tagline || '', tw = tag.split(/\s+/).filter(Boolean), tpx = Math.max(24 * S.u, px * 0.26), ty = cy + px * 0.72;
      if (tw.length) {
        const lay = L.layout(c, S.look, tw.map((s, i) => ({ s, accent: i === tw.length - 1, role: 'ui' })), { role: 'ui', px: tpx, maxW: S.W * 0.8, x: S.W / 2, y: ty - tpx * 0.8, align: 'center', maxLines: 2, space: 0.3 });
        for (const w of lay.words) { const k = E.out(prog(S.lt, S.at('tag') + w.i * 0.22, 0.3)); if (k > 0) { c.save(); c.globalAlpha *= k; L.drawWord(c, S.look, S.P, w, { y: w.y + (1 - k) * 14 * S.u, fill: w.tk.accent ? S.P.accent : S.P.dim }); c.restore(); } }
      }
      // CTA on a soft accent glow
      const ck = E.out(prog(S.lt, S.at('cta'), 0.4));
      if (ck > 0) {
        const label = B.cta || B.host || 'Get started', cpx = Math.max(20 * S.u, px * 0.2), lw = L.textW(c, S.look, label, { role: 'ui', px: cpx, weight: 600 }), bw = lw + cpx * 3.4, bh = cpx * 2.4, bx = S.W / 2 - bw / 2, by = ty + tpx * 1.3 + (1 - ck) * 18 * S.u;
        c.save(); c.globalAlpha *= ck; L.bloom(c, S.W / 2, by + bh * 0.7, bw * 0.7, S.look.accent, 0.18);
        c.save(); c.shadowColor = rgba(S.look.accent, 0.38); c.shadowBlur = 30 * S.u; c.shadowOffsetY = 10 * S.u; L.rr(c, bx, by, bw, bh, bh * 0.22); c.fillStyle = S.look.accent; c.fill(); c.restore();
        const fg = L.onColor(S.look.accent); L.text(c, S.look, label, S.W / 2 - cpx * 0.6, by + bh / 2 + cpx * 0.36, { role: 'ui', px: cpx, weight: 600, color: fg, align: 'center' }); L.icon(c, 'arrowRight', S.W / 2 + lw / 2 + cpx * 0.3, by + bh / 2, cpx, fg, 2.2);
        c.restore();
      }
    },
  });
})(globalThis.LAUNCH);
