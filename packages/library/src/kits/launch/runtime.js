// The Launch runtime: the one engine every Launch component draws with (ishaan-motion §9). Every frame is a pure
// function of t: no Math.random, no timers, no CSS animation. The same file runs in the live player (browser) and in
// Node (the planner loads it in a vm to read each part's plan(): timing, sound cues, anchors), so the picture and the
// sound are scheduled by one piece of code.
//
// Parts register themselves with LAUNCH.def(id, spec). The id is the part's library asset id (ui:glass-toolbar,
// transition:flood-contract-circle, ...), so the craft graph, the planner and the player all name a part the same way.
//   spec.plan(b, F)  pure, no canvas: { cues, events:[{at,event}], exit, entry, need } in beat-local seconds
//   spec.draw(S, o)  draws with S.ctx (setups, ui, type, effects, worlds, end cards)
//   spec.tr(S, A, B, k, o)  composites two shots (transitions)
//   spec.cam(lt, d, o) → { s, x, y, r } (camera moves)
'use strict';
(function (G) {
  const L = G.LAUNCH = G.LAUNCH || {};
  L.parts = L.parts || {};
  L.def = (id, spec) => { L.parts[id] = Object.assign({ id }, spec); return L.parts[id]; };
  L.get = id => L.parts[id] || null;
  L.has = id => !!L.parts[id];

  /* ───────── motion math ───────── */
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, k) => a + (b - a) * k;
  const prog = (t, t0, d) => clamp((t - t0) / (d || 1e-6));
  const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };
  function bez(x1, y1, x2, y2) {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const X = u => ((ax * u + bx) * u + cx) * u, Y = u => ((ay * u + by) * u + cy) * u;
    return x => { if (x <= 0) return 0; if (x >= 1) return 1; let lo = 0, hi = 1, u = x;
      for (let i = 0; i < 22; i++) { u = (lo + hi) / 2; if (X(u) < x) lo = u; else hi = u; } return Y(u); };
  }
  const E = {
    ramp: bez(0.86, 0, 0.07, 1), hard: bez(0.95, 0, 0.05, 1), out: bez(0.16, 1, 0.3, 1), outBack: bez(0.34, 1.32, 0.64, 1),
    in: bez(0.7, 0, 0.84, 0), io: bez(0.65, 0, 0.35, 1), expo: x => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * clamp(x))),
    apple: bez(0.25, 0.1, 0.25, 1), quick: bez(0.2, 0.8, 0.2, 1), lin: x => clamp(x), settle: x => 1 - Math.pow(1 - clamp(x), 4),
  };
  // closed-form damped spring step response (a value of many targets = the sum of one spring per change)
  const SPRING = { pop: [13, 190, 0.9], firm: [20, 210, 1], soft: [26, 120, 1], snap: [24, 420, 1], wobble: [9, 160, 0.9], ui: [22, 300, 1] };
  function spring(t, kind = 'pop') {
    if (t <= 0) return 0;
    const [c, k, m] = Array.isArray(kind) ? kind : SPRING[kind] || SPRING.pop, w0 = Math.sqrt(k / m), z = c / (2 * Math.sqrt(k * m));
    if (z >= 1) return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
    const wd = w0 * Math.sqrt(1 - z * z);
    return 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + (z * w0 / wd) * Math.sin(wd * t));
  }
  // a value driven by a list of [time, target] changes, each change its own spring: pure in t
  function springTrack(t, keys, kind = 'ui') {
    let v = keys[0][1];
    for (let i = 1; i < keys.length; i++) v += (keys[i][1] - keys[i - 1][1]) * spring(t - keys[i][0], kind);
    return v;
  }
  const tw = (t, a, b, from, to, ease = E.ramp) => lerp(from, to, ease(prog(t, a, b - a)));
  function kf(t, keys) { if (t <= keys[0][0]) return keys[0][1]; for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) return tw(t, keys[i - 1][0], keys[i][0], keys[i - 1][1], keys[i][1], keys[i][2] || E.ramp); return keys[keys.length - 1][1]; }
  const logLerp = (a, b, k) => Math.exp(Math.log(a) + (Math.log(b) - Math.log(a)) * k);
  const logPull = (S0, k) => Math.pow(S0, Math.pow(1 - clamp(k), 4));
  const drift = (dt, A, B, tau) => A * (1 - Math.exp(-Math.max(0, dt) / tau)) + B * Math.max(0, dt);
  const vel = (fn, t) => fn(t + 1 / 120) - fn(t - 1 / 120);
  const shutter = (v, cap = 40) => Math.min(cap, Math.abs(v) * 0.28);
  function rand(seed) { let t = (seed * 2654435761 + 0x6d2b79f5) | 0; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  function hash(s) { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function noise(x, seed = 0) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(rand(i * 7 + seed * 131) * 2 - 1, rand((i + 1) * 7 + seed * 131) * 2 - 1, u); }
  const stagger = (base, i, gap, seed = 1) => base + i * gap + (rand(i * 17 + seed) - 0.5) * gap * 0.6;
  // in, hold, out: 0→1 over [a, a+i], 1 until b, 1→0 over [b, b+o]
  const iho = (t, a, i, b, o, ease = E.out, easeOut = E.in) => (t < a ? 0 : t < a + i ? ease(prog(t, a, i)) : t < b ? 1 : t < b + o ? 1 - easeOut(prog(t, b, o)) : 0);
  Object.assign(L, { clamp, lerp, prog, smooth, bez, E, spring, springTrack, tw, kf, logLerp, logPull, drift, vel, shutter, rand, hash, noise, stagger, iho, SPRING });

  /* ───────── colour ───────── */
  const hex = h => { h = String(h || '#000').replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h.slice(0, 6), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const toHex = c => '#' + c.map(v => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
  const rgba = (h, a = 1) => { const [r, g, b] = Array.isArray(h) ? h : hex(h); return `rgba(${r | 0},${g | 0},${b | 0},${a})`; };
  const mix = (a, b, k) => { const A = hex(a), B = hex(b); return toHex(A.map((v, i) => lerp(v, B[i], clamp(k)))); };
  const lum = h => { const c = hex(h).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  // nudge a colour darker or lighter until it reads on `bg` (ratio >= want), keeping its hue
  function readable(c, bg, want = 3) {
    let x = c; const dark = lum(bg) > 0.4;
    for (let i = 0; i < 24 && contrast(x, bg) < want; i++) x = mix(x, dark ? '#000000' : '#ffffff', 0.08);
    return x;
  }
  const onColor = bg => (lum(bg) > 0.42 ? '#0E0E10' : '#FFFFFF');
  Object.assign(L, { hex, toHex, rgba, mix, lum, contrast, readable, onColor });

  /* ───────── the look: palette per world, the type system ───────── */
  // A film's look = a learned kit (its palette roles, its type pairing) with the brand's accent folded in. Worlds:
  // paper (light), ink (dark), flood (the accent, full bleed), haze (cool light gradient), deep (accent-tinted dark).
  function palette(look, world) {
    const k = look.palette, acc = look.accent;
    const W = {
      paper: { bg: k.paper, bg2: k.paperShade || mix(k.paper, '#000000', 0.035), fg: k.text, dim: k.textDim, rule: k.rule || rgba(k.text, 0.12), card: k.card || '#FFFFFF', cardFg: k.text, accent: readable(acc, k.paper, 3), soft: mix(k.paper, acc, 0.12) },
      ink: { bg: k.ink, bg2: k.inkLift || mix(k.ink, '#FFFFFF', 0.05), fg: k.inkText || '#F4F2EE', dim: k.inkTextDim || 'rgba(244,242,238,0.5)', rule: rgba(k.inkText || '#F4F2EE', 0.12), card: k.inkCard || mix(k.ink, '#FFFFFF', 0.07), cardFg: k.inkText || '#F4F2EE', accent: readable(acc, k.ink, 3.2), soft: mix(k.ink, acc, 0.22) },
      flood: { bg: acc, bg2: mix(acc, '#000000', 0.12), fg: onColor(acc), dim: rgba(onColor(acc), 0.62), rule: rgba(onColor(acc), 0.18), card: lum(acc) > 0.4 ? '#FFFFFF' : mix(acc, '#FFFFFF', 0.9), cardFg: '#0E0E10', accent: onColor(acc), soft: mix(acc, '#FFFFFF', 0.25) },
      haze: { bg: k.haze || mix(k.paper, mix(acc, '#9DB8E0', 0.5), 0.28), bg2: k.paper, fg: k.text, dim: k.textDim, rule: rgba(k.text, 0.1), card: '#FFFFFF', cardFg: k.text, accent: readable(acc, k.paper, 3), soft: mix(k.paper, acc, 0.15) },
      deep: { bg: mix(k.ink, acc, 0.16), bg2: mix(k.ink, acc, 0.3), fg: '#FFFFFF', dim: 'rgba(255,255,255,0.58)', rule: 'rgba(255,255,255,0.14)', card: mix(k.ink, acc, 0.24), cardFg: '#FFFFFF', accent: readable(mix(acc, '#FFFFFF', 0.15), mix(k.ink, acc, 0.16), 3.5), soft: mix(k.ink, acc, 0.4) },
    };
    const p = W[world] || W.paper;
    return Object.assign({ world, accentRaw: acc, ink: k.ink, paper: k.paper, text: k.text, glow: k.glow || acc }, p);
  }
  L.palette = palette;
  // font roles → canvas font strings; families are registered by the page (@font-face)
  const FAM = { display: 'InterTight', serif: 'InstrumentSerif', mono: 'JetBrainsMono', ui: 'Geist', wide: 'Archivo', fraunces: 'Fraunces', grotesk: 'Bricolage', jakarta: 'Jakarta', anton: 'Anton' };
  L.FAM = FAM;
  function fontOf(look, role, px, weight) {
    const T = look.type || {};
    const r = T[role] || {};
    const fam = FAM[r.family] || r.family || ({ display: FAM.display, accent: FAM.serif, micro: FAM.mono, ui: FAM.ui, numeral: FAM.display, wordmark: FAM.display }[role]) || FAM.display;
    const w = weight || r.weight || (role === 'micro' ? 500 : role === 'ui' ? 500 : role === 'accent' ? 400 : 650);
    const it = r.italic || (role === 'accent' && r.italic !== false) ? 'italic ' : '';
    const stretch = r.stretch ? `${r.stretch} ` : '';
    return `${it}${stretch}${w} ${Math.max(1, px).toFixed(1)}px ${fam}`;
  }
  L.font = fontOf;

  /* ───────── text: layout + draw (measured, never overflowing) ───────── */
  // tokens: [{s, accent?, role?}] → lines of placed words. Fits to maxW by shrinking first (down to min), then
  // wrapping with balanced lines (no orphan), at most maxLines.
  function setFont(ctx, look, role, px, w) { ctx.font = fontOf(look, role, px, w); }
  function trackingOf(look, role, px) { const r = (look.type || {})[role] || {}; const em = r.tracking != null ? r.tracking : role === 'micro' ? 0.14 : role === 'display' ? -0.035 : role === 'accent' ? -0.01 : -0.01; return em * px; }
  function measureWord(ctx, look, tok, px, baseRole) {
    const role = tok.role || (tok.accent && (look.type || {}).accentSerif !== false ? 'accent' : baseRole);
    const size = px * (role === 'accent' && baseRole === 'display' ? ((look.type || {}).accentScale || 1.08) : 1);
    setFont(ctx, look, role, size, tok.weight);
    const tr = trackingOf(look, role, size);
    try { ctx.letterSpacing = tr.toFixed(2) + 'px'; } catch (e) { /* older canvas */ }
    const w = ctx.measureText(tok.s).width;
    return { role, size, tr, w };
  }
  function layout(ctx, look, tokens, o) {
    const baseRole = o.role || 'display', maxW = o.maxW, maxLines = o.maxLines || 3;
    let px = o.px, min = o.min || px * 0.55;
    const spaceOf = p => p * (o.space || 0.26);
    const build = p => {
      const ms = tokens.map(tk => Object.assign({ tk }, measureWord(ctx, look, tk, p, baseRole)));
      const sp = spaceOf(p), total = ms.reduce((a, m) => a + m.w, 0) + sp * (ms.length - 1);
      // greedy into n balanced lines: target width = total / n
      let best = null;
      for (let n = 1; n <= Math.min(maxLines, ms.length); n++) {
        const target = total / n, lines = [[]]; let w = 0;
        for (const m of ms) {
          const cur = lines[lines.length - 1];
          const add = (cur.length ? sp : 0) + m.w;
          if (cur.length && w + add > target * 1.12 && lines.length < n) { lines.push([m]); w = m.w; } else { cur.push(m); w += add; }
        }
        const widths = lines.map(l => l.reduce((a, m) => a + m.w, 0) + sp * (l.length - 1));
        const widest = Math.max(...widths);
        // never leave a single short word alone on the last line when another split exists
        const orphan = lines.length > 1 && lines[lines.length - 1].length === 1 && widths[widths.length - 1] < widest * 0.34;
        if (widest <= maxW && !orphan) { best = { lines, widths, widest }; break; }
        if (widest <= maxW && !best) best = { lines, widths, widest };
      }
      return best;
    };
    let got = build(px);
    while ((!got || got.widest > maxW) && px > min) { px *= 0.94; got = build(px); }
    if (!got) { // last resort: one line, scaled to fit
      got = build(px) || { lines: [tokens.map(tk => Object.assign({ tk }, measureWord(ctx, look, tk, px, baseRole)))], widths: [0], widest: 0 };
    }
    const lh = px * (o.lineH || 1.04), sp = spaceOf(px);
    const H = lh * got.lines.length;
    const align = o.align || 'center';
    const words = []; let i = 0;
    got.lines.forEach((ln, li) => {
      const lw = got.widths[li];
      let x = align === 'center' ? o.x - lw / 2 : align === 'right' ? o.x - lw : o.x;
      const y = o.y + li * lh + px * 0.8; // baseline
      ln.forEach(m => { words.push({ i: i++, li, x, y, w: m.w, px: m.size, role: m.role, tr: m.tr, tk: m.tk, s: m.tk.s }); x += m.w + sp; });
    });
    return { px, lh, H, W: got.widest, lines: got.lines.length, words, top: o.y, bottom: o.y + H, align, x: o.x };
  }
  function drawWord(ctx, look, P, w, o = {}) {
    setFont(ctx, look, w.role, w.px, w.tk.weight);
    try { ctx.letterSpacing = w.tr.toFixed(2) + 'px'; } catch (e) { /* */ }
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    ctx.fillStyle = o.fill || (w.tk.accent ? (o.accent || P.accent) : (o.color || P.fg));
    ctx.fillText(w.s, (o.x != null ? o.x : w.x), (o.y != null ? o.y : w.y));
  }
  // one-off text (labels): returns width
  function text(ctx, look, s, x, y, o = {}) {
    const role = o.role || 'ui', px = o.px || 24;
    setFont(ctx, look, role, px, o.weight);
    try { ctx.letterSpacing = (o.tracking != null ? o.tracking * px : trackingOf(look, role, px)).toFixed(2) + 'px'; } catch (e) { /* */ }
    ctx.textBaseline = o.baseline || 'alphabetic'; ctx.textAlign = o.align || 'left';
    if (o.maxW) { let w = ctx.measureText(s).width; if (w > o.maxW) { const k = o.maxW / w; setFont(ctx, look, role, px * k, o.weight); } }
    ctx.fillStyle = o.color || '#000';
    const str = o.upper ? String(s).toUpperCase() : String(s);
    ctx.fillText(str, x, y);
    const w = ctx.measureText(str).width;
    try { ctx.letterSpacing = '0px'; } catch (e) { /* */ }
    return w;
  }
  function textW(ctx, look, s, o = {}) { const role = o.role || 'ui', px = o.px || 24; setFont(ctx, look, role, px, o.weight); try { ctx.letterSpacing = (o.tracking != null ? o.tracking * px : trackingOf(look, role, px)).toFixed(2) + 'px'; } catch (e) { /* */ } const w = ctx.measureText(o.upper ? String(s).toUpperCase() : String(s)).width; try { ctx.letterSpacing = '0px'; } catch (e) { /* */ } return w; }
  Object.assign(L, { layout, drawWord, text, textW, setFont, tracking: trackingOf });

  /* ───────── drawing primitives ───────── */
  function rr(ctx, x, y, w, h, r) { r = Math.max(0, Math.min(r, w / 2, h / 2)); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  // a card with a real shadow stack (contact + ambient), optional hairline and inner top light
  function card(ctx, x, y, w, h, r, o = {}) {
    const lift = o.lift == null ? 1 : o.lift;
    ctx.save();
    if (lift > 0) {
      rr(ctx, x, y, w, h, r);
      ctx.shadowColor = o.shadow || 'rgba(16,14,12,0.16)'; ctx.shadowBlur = 60 * lift * (o.u || 1); ctx.shadowOffsetY = 24 * lift * (o.u || 1);
      ctx.fillStyle = o.fill || '#fff'; ctx.fill();
      ctx.shadowColor = o.shadow2 || 'rgba(16,14,12,0.10)'; ctx.shadowBlur = 6 * lift * (o.u || 1); ctx.shadowOffsetY = 2 * lift * (o.u || 1); ctx.fill();
    }
    ctx.shadowColor = 'transparent';
    rr(ctx, x, y, w, h, r); ctx.fillStyle = o.fill || '#fff'; ctx.fill();
    if (o.grad !== false && o.fill && lum(o.fill) < 0.5) { const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, 'rgba(255,255,255,0.05)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fill(); }
    if (o.stroke !== false) { rr(ctx, x + 0.5, y + 0.5, w - 1, h - 1, r); ctx.lineWidth = o.lineWidth || 1; ctx.strokeStyle = o.stroke || (o.fill && lum(o.fill) < 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'); ctx.stroke(); }
    ctx.restore();
  }
  function pill(ctx, x, y, w, h, fill, stroke) { rr(ctx, x, y, w, h, h / 2); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.stroke(); } }
  function circle(ctx, x, y, r, fill, stroke, lw) { ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.lineWidth = lw || 2; ctx.strokeStyle = stroke; ctx.stroke(); } }
  function line(ctx, x1, y1, x2, y2, c, w = 1.5, dash) { ctx.save(); ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.strokeStyle = c; ctx.lineWidth = w; if (dash) ctx.setLineDash(dash); ctx.stroke(); ctx.restore(); }
  // one big soft bloom (look.md: a dark shot gets exactly one)
  function bloom(ctx, x, y, r, color, a = 0.5) { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, rgba(color, a)); g.addColorStop(0.45, rgba(color, a * 0.35)); g.addColorStop(1, rgba(color, 0)); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); }
  function vignette(ctx, W, H, a = 0.35, color = '#000') { const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.62); g.addColorStop(0, rgba(color, 0)); g.addColorStop(1, rgba(color, a)); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
  Object.assign(L, { rr, card, pill, circle, line, bloom, vignette });

  /* ───────── offscreen buffers, textures ───────── */
  const BUF = {};
  L.buffer = (name, W, H) => { if (typeof document === 'undefined') return null; let c = BUF[name]; if (!c || c.width !== W || c.height !== H) { c = BUF[name] = document.createElement('canvas'); c.width = W; c.height = H; } return c; };
  const TEX = {};
  // grain: a 256² tile of seeded noise, shifted by frame (looks alive, deterministic)
  L.grain = (ctx, W, H, t, a = 0.06) => {
    if (typeof document === 'undefined') return;
    let g = TEX.grain;
    if (!g) { g = TEX.grain = document.createElement('canvas'); g.width = g.height = 256; const c = g.getContext('2d'), im = c.createImageData(256, 256); for (let i = 0; i < 256 * 256; i++) { const v = rand(i + 99) * 255; im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255; } c.putImageData(im, 0, 0); }
    const f = Math.floor(t * 24), ox = Math.floor(rand(f) * 256), oy = Math.floor(rand(f + 7) * 256);
    ctx.save(); ctx.globalAlpha = a; ctx.globalCompositeOperation = 'overlay';
    const pat = ctx.createPattern(g, 'repeat'); ctx.translate(-ox, -oy); ctx.fillStyle = pat; ctx.fillRect(ox, oy, W, H);
    ctx.restore();
  };
  // a dot grid texture (editorial backgrounds): spacing s, radius r
  L.dotGrid = (ctx, W, H, s, r, color, o = {}) => {
    ctx.save(); ctx.fillStyle = color;
    const ox = o.ox || 0, oy = o.oy || 0;
    for (let y = ((oy % s) + s) % s; y < H; y += s) for (let x = ((ox % s) + s) % s; x < W; x += s) {
      let rr_ = r; if (o.fn) rr_ = o.fn(x, y, r); if (rr_ <= 0.05) continue;
      ctx.beginPath(); ctx.arc(x, y, rr_, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  };

  /* ───────── glass (draws what is really behind it) ───────── */
  // The glass samples the frame under it (src = the canvas already drawn this frame), magnifies it a touch (refraction),
  // blurs and tints it, adds a top sheen, a rim light and a chromatic edge. A flat translucent box reads as a template.
  L.glass = (ctx, src, x, y, w, h, r, o = {}) => {
    const u = o.u || 1, blur = o.blur == null ? 18 * u : o.blur, mag = o.mag || 1.04, tint = o.tint || 'rgba(255,255,255,0.16)', dark = !!o.dark;
    ctx.save();
    rr(ctx, x, y, w, h, r);
    if (o.shadow !== false) { ctx.shadowColor = dark ? 'rgba(0,0,0,0.45)' : 'rgba(20,24,40,0.22)'; ctx.shadowBlur = 40 * u; ctx.shadowOffsetY = 16 * u; ctx.fillStyle = 'rgba(0,0,0,0.001)'; ctx.fill(); ctx.shadowColor = 'transparent'; }
    ctx.clip();
    if (src) {
      const cx = x + w / 2, cy = y + h / 2, sw = w / mag, sh = h / mag;
      ctx.filter = `blur(${blur.toFixed(1)}px) saturate(${o.sat || 1.25})`;
      ctx.drawImage(src, cx - sw / 2 - blur, cy - sh / 2 - blur, sw + blur * 2, sh + blur * 2, x - blur * mag, y - blur * mag, w + blur * 2 * mag, h + blur * 2 * mag);
      ctx.filter = 'none';
    }
    ctx.fillStyle = dark ? (o.tint || 'rgba(14,14,18,0.38)') : tint; ctx.fillRect(x, y, w, h);
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, dark ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.42)'); g.addColorStop(0.35, 'rgba(255,255,255,0.0)'); g.addColorStop(1, dark ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.08)');
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    ctx.restore();
    // rim: a light top-left edge, a darker bottom edge, a faint chromatic split
    ctx.save();
    rr(ctx, x + 0.75, y + 0.75, w - 1.5, h - 1.5, r - 0.75);
    const rim = ctx.createLinearGradient(x, y, x + w * 0.3, y + h);
    rim.addColorStop(0, dark ? 'rgba(255,255,255,0.32)' : 'rgba(255,255,255,0.95)'); rim.addColorStop(0.5, dark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.35)'); rim.addColorStop(1, dark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.6)');
    ctx.strokeStyle = rim; ctx.lineWidth = 1.5 * u; ctx.stroke();
    if (o.chroma !== false) { ctx.globalCompositeOperation = 'screen'; rr(ctx, x + 2 * u, y + 1 * u, w - 4 * u, h - 2 * u, r); ctx.strokeStyle = 'rgba(120,170,255,0.18)'; ctx.lineWidth = 1 * u; ctx.stroke(); rr(ctx, x + 1 * u, y + 2 * u, w - 2 * u, h - 4 * u, r); ctx.strokeStyle = 'rgba(255,150,170,0.14)'; ctx.stroke(); }
    ctx.restore();
  };

  /* ───────── icons: our own 24-unit line set (Path2D) ───────── */
  const IC = {
    search: 'M10.5 3a7.5 7.5 0 1 1 0 15a7.5 7.5 0 0 1 0-15zM16 16l5 5', heart: 'M12 20s-7-4.4-9-8.6C1.6 8.3 3.6 5 7 5c2 0 3.4 1.2 5 3c1.6-1.8 3-3 5-3c3.4 0 5.4 3.3 4 6.4C19 15.6 12 20 12 20z',
    share: 'M12 3v12M7 8l5-5l5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6', info: 'M12 3a9 9 0 1 1 0 18a9 9 0 0 1 0-18zM12 11v6M12 7.5v.5',
    sliders: 'M4 7h10M18 7h2M4 17h4M12 17h8M16 5v4M10 15v4', check: 'M4.5 12.5l5 5L19.5 7', x: 'M6 6l12 12M18 6L6 18', plus: 'M12 5v14M5 12h14',
    play: 'M8 5l11 7l-11 7z', pause: 'M8 5v14M16 5v14', mail: 'M3 6h18v12H3zM3 7l9 6l9-6', bell: 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0',
    calendar: 'M4 6h16v14H4zM4 10h16M8 3v5M16 3v5', chart: 'M4 20V4M4 20h16M8 16v-4M12 16V8M16 16v-6', user: 'M12 12a4 4 0 1 0 0-8a4 4 0 0 0 0 8zM4 21c0-4 3.6-7 8-7s8 3 8 7',
    users: 'M9 11a3.5 3.5 0 1 0 0-7a3.5 3.5 0 0 0 0 7zM2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14c2.3.6 3.8 2.9 3.8 6',
    settings: 'M12 9a3 3 0 1 0 0 6a3 3 0 0 0 0-6zM12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1',
    sparkle: 'M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6zM19 16l.7 2l2 .7l-2 .7l-.7 2l-.7-2l-2-.7l2-.7z', bolt: 'M13 2L4 14h7l-1 8l9-12h-7z',
    globe: 'M12 3a9 9 0 1 1 0 18a9 9 0 0 1 0-18zM3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z',
    link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1', folder: 'M3 6h6l2 2h10v11H3z', file: 'M6 3h8l5 5v13H6zM14 3v5h5',
    image: 'M4 5h16v14H4zM4 16l5-5l4 4l3-3l4 4M15.5 8.5h.01', camera: 'M4 8h4l2-3h4l2 3h4v11H4zM12 17a3.5 3.5 0 1 0 0-7a3.5 3.5 0 0 0 0 7z', mic: 'M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM5 11a7 7 0 0 0 14 0M12 18v3',
    send: 'M4 12l16-8l-6 16l-3-7z', arrowUp: 'M12 19V5M6 11l6-6l6 6', arrowRight: 'M5 12h14M13 6l6 6l-6 6', lock: 'M6 11h12v10H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
    shield: 'M12 3l8 3v6c0 5-3.5 8.5-8 9.5C7.5 20.5 4 17 4 12V6z', clock: 'M12 3a9 9 0 1 1 0 18a9 9 0 0 1 0-18zM12 7v5l3.5 2', zap: 'M13 2L4 14h7l-1 8l9-12h-7z',
    home: 'M3 11l9-7l9 7M5 10v10h14V10', cart: 'M3 4h2l2.5 11h11L21 7H6.5M9 20a1 1 0 1 0 0-.01M18 20a1 1 0 1 0 0-.01', card: 'M3 6h18v12H3zM3 10h18M7 15h4',
    code: 'M8 7l-5 5l5 5M16 7l5 5l-5 5', terminal: 'M3 5h18v14H3zM7 9l3 3l-3 3M12 15h5', layers: 'M12 3l9 5l-9 5l-9-5zM3 13l9 5l9-5', grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
    message: 'M4 5h16v11H9l-5 4z', star: 'M12 3l2.7 5.6l6.1.9l-4.4 4.3l1 6.1L12 17l-5.4 2.9l1-6.1L3.2 9.5l6.1-.9z', eye: 'M2 12s3.6-7 10-7s10 7 10 7s-3.6 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6a3 3 0 0 0 0 6z',
    sun: 'M12 7a5 5 0 1 0 0 10a5 5 0 0 0 0-10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
    moon: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z', download: 'M12 3v12M7 10l5 5l5-5M5 21h14', upload: 'M12 21V9M7 14l5-5l5 5M5 3h14',
    target: 'M12 3a9 9 0 1 1 0 18a9 9 0 0 1 0-18zM12 8a4 4 0 1 1 0 8a4 4 0 0 1 0-8zM12 11.5v1', trend: 'M3 17l6-6l4 4l8-8M15 7h6v6', wand: 'M4 20L16 8M14 4v2M18 8h2M17.5 4.5l1.5-1.5M19 11l1.5 1.5',
    cursor: 'M5 3l14 7l-6 2l-2 6z', battery: 'M3 8h16v8H3zM21 11v2', wifi: 'M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 19.5h.01',
    filter: 'M4 5h16l-6 7v6l-4 2v-8z', refresh: 'M20 12a8 8 0 1 1-2.4-5.7M20 4v5h-5', inbox: 'M3 13l3-8h12l3 8v6H3zM3 13h5l1 3h6l1-3h5', pin: 'M12 21s-7-6.4-7-11.5A7 7 0 0 1 19 9.5C19 14.6 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5a2.5 2.5 0 0 0 0 5z',
  };
  const ICP = {};
  L.icons = Object.keys(IC);
  L.icon = (ctx, name, x, y, size, color, lw) => {
    if (typeof Path2D === 'undefined') return;
    const p = ICP[name] || (ICP[name] = new Path2D(IC[name] || IC.sparkle));
    ctx.save(); ctx.translate(x - size / 2, y - size / 2); ctx.scale(size / 24, size / 24);
    ctx.lineWidth = (lw || 1.8); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = color; ctx.stroke(p); ctx.restore();
  };
  // which icon fits a word (a feature name, a list item): a small keyword table, a hash for the rest
  const ICON_WORDS = [[/search|find|discover|look/i, 'search'], [/mail|email|inbox|newsletter/i, 'mail'], [/team|people|users|customer|client|member/i, 'users'], [/secur|privacy|safe|encrypt|protect/i, 'shield'], [/lock|private|password/i, 'lock'], [/fast|speed|instant|quick|real-?time/i, 'bolt'], [/ai|smart|magic|generat|auto/i, 'sparkle'], [/chart|analytic|insight|report|metric|data|stat/i, 'chart'], [/calendar|schedul|book|meeting|event/i, 'calendar'], [/time|hour|minute|clock|deadline/i, 'clock'], [/global|world|languag|international|everywhere/i, 'globe'], [/link|connect|integrat|sync/i, 'link'], [/file|doc|page|note/i, 'file'], [/image|photo|picture|design/i, 'image'], [/video|camera|record/i, 'camera'], [/voice|audio|call|speak|mic/i, 'mic'], [/message|chat|comment|reply|talk/i, 'message'], [/code|develop|api|sdk|deploy/i, 'code'], [/terminal|cli|command/i, 'terminal'], [/setting|config|custom/i, 'settings'], [/home|house/i, 'home'], [/shop|store|cart|buy|order/i, 'cart'], [/pay|price|card|billing|money|invoice/i, 'card'], [/grow|trend|revenue|increase/i, 'trend'], [/notif|alert|remind/i, 'bell'], [/share|send|publish/i, 'send'], [/star|review|rating|favorite/i, 'star'], [/layer|stack|workflow/i, 'layers'], [/target|goal|focus/i, 'target'], [/view|watch|see|monitor/i, 'eye'], [/download|export/i, 'download'], [/upload|import/i, 'upload'], [/filter|sort/i, 'filter'], [/location|map|place|local/i, 'pin']];
  L.iconFor = (s, seed = 0) => { for (const [re, n] of ICON_WORDS) if (re.test(s)) return n; const pool = ['sparkle', 'layers', 'grid', 'target', 'bolt', 'star', 'eye', 'wand']; return pool[hash(s + seed) % pool.length]; };

  /* ───────── cursor (macOS arrow): press, halo, velocity smear ───────── */
  // path: [[t, x, y, press?]] keys; returns {x, y, down}
  L.cursorAt = (path, t) => {
    if (!path || !path.length) return null;
    if (t <= path[0][0]) return { x: path[0][1], y: path[0][2], down: 0 };
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1], b = path[i];
      if (t <= b[0]) { const k = E.io(prog(t, a[0], b[0] - a[0])); // a gentle arc: offset perpendicular to the move
        const mx = lerp(a[1], b[1], k), my = lerp(a[2], b[2], k), arc = Math.sin(k * Math.PI) * Math.hypot(b[1] - a[1], b[2] - a[2]) * 0.08;
        const dx = b[1] - a[1], dy = b[2] - a[2], n = Math.hypot(dx, dy) || 1;
        return { x: mx - dy / n * arc, y: my + dx / n * arc, down: 0 };
      }
    }
    const last = path[path.length - 1]; return { x: last[1], y: last[2], down: 0 };
  };
  // clicks: [t...] → press amount at t (0..1) and the ring after it
  L.pressAt = (clicks, t) => { let p = 0, ring = -1; for (const c of clicks || []) { const d = t - c; if (d >= -0.06 && d < 0.16) p = Math.max(p, d < 0 ? 1 + d / 0.06 : 1 - d / 0.16); if (d >= 0 && d < 0.5) ring = d; } return { p: clamp(p), ring }; };
  L.drawCursor = (ctx, x, y, o = {}) => {
    const u = o.u || 1, s = (o.scale || 1) * u * (1 - 0.14 * (o.press || 0));
    if (o.ring != null && o.ring >= 0) { const k = o.ring / 0.5; circle(ctx, x, y, (10 + 34 * E.out(k)) * u, null, rgba(o.halo || '#4F7BFF', 0.55 * (1 - k)), 3 * u); }
    if (o.halo) { ctx.save(); ctx.globalAlpha = 0.22 * (o.haloA == null ? 1 : o.haloA); circle(ctx, x, y, 22 * u, o.halo); ctx.restore(); }
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    if (o.blur > 0.5) ctx.filter = `blur(${Math.min(6, o.blur).toFixed(1)}px)`;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 25); ctx.lineTo(6.2, 19.4); ctx.lineTo(10.4, 28.6); ctx.lineTo(14.2, 26.9); ctx.lineTo(10.1, 18); ctx.lineTo(18, 18); ctx.closePath();
    ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
    ctx.fillStyle = o.dark ? '#FFFFFF' : '#111111'; ctx.fill(); ctx.shadowColor = 'transparent';
    ctx.lineWidth = 1.6; ctx.strokeStyle = o.dark ? '#111' : '#FFFFFF'; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.restore();
  };

  /* ───────── camera ───────── */
  // a camera is {s, x, y, r}: scale about the frame centre then translate (px) and rotate (rad). Moves are parts
  // (camera:*) with cam(lt, d, o); a setup may add a focus target (screen-studio zoom) on top.
  L.applyCam = (ctx, W, H, c) => { if (!c) return; ctx.translate(W / 2 + (c.x || 0), H / 2 + (c.y || 0)); if (c.r) ctx.rotate(c.r); ctx.scale(c.s || 1, c.s || 1); ctx.translate(-W / 2, -H / 2); };
  // zoom so the rect (x, y, w, h) fills `fill` of the frame, k = 0..1
  L.focusCam = (W, H, rect, k, fill = 0.8) => { const s = lerp(1, Math.min(W * fill / rect.w, H * fill / rect.h), k); const fx = rect.x + rect.w / 2 - W / 2, fy = rect.y + rect.h / 2 - H / 2; return { s, x: -fx * (s) * k, y: -fy * (s) * k, r: 0 }; };
  L.camMul = (a, b) => ({ s: (a.s || 1) * (b.s || 1), x: (a.x || 0) + (b.x || 0), y: (a.y || 0) + (b.y || 0), r: (a.r || 0) + (b.r || 0) });

  /* ───────── beats: local time helpers for setups ───────── */
  // S.at(name) → the beat-local time of a cue (from plan); S.k(name, dur, ease) → its 0..1 progress
  L.mkS = (base, b, t) => {
    const lt = t - b.t0, cues = (b.cues || {});
    const S = Object.assign({}, base, { b, t, lt, d: b.t1 - b.t0, cues });
    S.at = n => (cues[n] != null ? cues[n] : 0);
    S.k = (n, dur = 0.4, ease = E.out) => ease(prog(lt, S.at(n), dur));
    S.seed = hash(b.setup + ':' + b.i + ':' + (base.F && base.F.seed || ''));
    S.r = i => rand(S.seed + i * 977);
    return S;
  };

  /* ───────── the film's headline: the cast type treatment draws it into a slot the setup gives ───────── */
  // slot: {x, y, maxW, px, align, role, maxLines, color, accent}; the treatment (b.type) owns the motion
  L.headline = (S, slot, o = {}) => {
    const tokens = o.tokens || (S.b.text && S.b.text.tokens) || [];
    if (!tokens.length) return null;
    const lay = L.layout(S.ctx, S.look, tokens, Object.assign({ role: 'display', align: 'center', maxLines: 3 }, slot));
    const part = L.get(o.type || S.b.type) || L.get('effect:type-mask-rise');
    if (part && part.draw) part.draw(S, Object.assign({ lay, t0: o.t0 != null ? o.t0 : S.at('head'), slot }, o));
    return lay;
  };
  // a type treatment's word timing (plan side): word i lands at t0 + gap*i (jittered)
  L.wordTimes = (n, t0, gap, seed = 1) => Array.from({ length: n }, (_, i) => +stagger(t0, i, gap, seed).toFixed(3));
})(typeof globalThis !== 'undefined' ? globalThis : this);
