// Launch pack l08 "Bracket Red" (learned from an email tool promo): paper, ink and one signal red. Red bracketed
// captions that type in and out, a glossy accent ball that is the full stop of giant words and bursts into the app
// icon, a year odometer rolling back over echo rows, a stuck import wizard, a full-bleed dot matrix where hollow dots
// are the stat, a slot-machine price reel, a terminal whose link breaks on an error disc, a hub of neutral glyph chips,
// a query that filters a dot grid into a workflow pill, an ink line / red line promise with counter cards.
// Everything is drawn from the palette (S.P, S.look) and content (b.text, b.data, F.brand): it re-skins to any brand.
'use strict';
(function (L) {
  const { clamp, lerp, prog, E, rgba, mix, lum, spring, rand, noise } = L;
  const brand = () => (L.film && L.film.brand) || { name: 'Brand', host: 'brand.com', tagline: '' };
  const isWide = S => S.W / S.H > 1.3, isTall = S => S.H / S.W > 1.3;
  const toks = b => (b && b.text && b.text.tokens) || [];
  const joinT = t => t.map(x => x.s).join(' ');
  const itemsOf = b => ((b && b.data && b.data.items) || []).filter(Boolean);
  const numOf = b => (b && b.data && b.data.number) || null;
  const pop = (S, t0, kind = 'pop') => (S.lt < t0 ? 0 : spring(S.lt - t0, kind));
  const appear = (S, t0, d = 0.5) => E.out(prog(S.lt, t0 || 0, d));
  const scaleAbout = (c, x, y, sx, sy) => { c.translate(x, y); c.scale(sx, sy == null ? sx : sy); c.translate(-x, -y); };
  const commas = s => String(s).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const isDark = S => lum(S.P.bg) < 0.35;
  const cardFill = S => (isDark(S) ? mix(S.P.bg, '#FFFFFF', 0.08) : '#FFFFFF');
  const grey = (S, k) => mix(S.P.bg, S.P.fg, k);
  const trimStop = t => t.map((x, i, a) => (i === a.length - 1 ? Object.assign({}, x, { s: x.s.replace(/[.!…]+$/, '') }) : x));
  const slugOf = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  // a point drawn under the camera → where it is on screen (so a transition can dive into the real ball)
  const toScreen = (S, x, y) => { const c = S.cam || { s: 1, x: 0, y: 0 }, s = c.s || 1; return { x: (x - S.W / 2) * s + S.W / 2 + (c.x || 0), y: (y - S.H / 2) * s + S.H / 2 + (c.y || 0), s }; };
  const markExit = (S, x, y, r) => { const p = toScreen(S, x, y); S.b.__exit = { kind: 'dot', x: p.x / S.W, y: p.y / S.H, r: (r * p.s) / S.H }; };
  // payoff tail: when a line has no accent words, its last two words carry the accent (the reference's red tail)
  const withTail = (t, n = 2) => (t.some(x => x.accent) || t.length < 3 ? t : t.map((x, i) => (i >= t.length - n ? Object.assign({}, x, { accent: true }) : x)));
  const tokOf = s => String(s || '').split(/\s+/).filter(Boolean).map(w => ({ s: w }));

  /* ───────── shared drawing ───────── */
  // the glossy accent ball: one key light top-left, a specular, a floor bounce, a contact shadow on the paper
  function ball(c, S, x, y, r, o = {}) {
    if (r <= 0.3) return;
    const base = o.color || S.look.accent, col = o.grey ? mix(base, grey(S, 0.32), clamp(o.grey)) : base;
    c.save();
    if (o.floor != null) {
      const h = clamp((o.floor - (y + r)) / (r * 5)), R = r * 1.25 * (1 + h * 0.6);
      c.save(); c.translate(x, o.floor); c.scale(1, 0.2);
      const g = c.createRadialGradient(0, 0, 0, 0, 0, R); g.addColorStop(0, `rgba(0,0,0,${(0.3 * (1 - h * 0.85)).toFixed(3)})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.beginPath(); c.arc(0, 0, R, 0, Math.PI * 2); c.fill(); c.restore();
    }
    if (o.glow !== false && !(o.grey > 0.5)) { const g = c.createRadialGradient(x, y + r * 0.3, r * 0.4, x, y + r * 0.3, r * 2.2); g.addColorStop(0, rgba(col, 0.26)); g.addColorStop(1, rgba(col, 0)); c.fillStyle = g; c.fillRect(x - r * 2.3, y - r * 2, r * 4.6, r * 4.6); }
    c.translate(x, y); c.scale(o.sx || 1, o.sy || 1);
    const g = c.createRadialGradient(-r * 0.34, -r * 0.4, r * 0.04, -r * 0.08, -r * 0.08, r * 1.2);
    g.addColorStop(0, mix(col, '#FFFFFF', 0.5)); g.addColorStop(0.24, mix(col, '#FFFFFF', 0.1)); g.addColorStop(0.64, col); g.addColorStop(1, mix(col, '#000000', 0.4));
    c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fillStyle = g; c.fill();
    const b2 = c.createLinearGradient(0, r * 0.25, 0, r); b2.addColorStop(0, rgba(col, 0)); b2.addColorStop(1, rgba(mix(col, '#FFFFFF', 0.4), 0.32)); c.fillStyle = b2; c.fill();
    const sp = c.createRadialGradient(-r * 0.36, -r * 0.44, 0, -r * 0.36, -r * 0.44, r * 0.32); sp.addColorStop(0, 'rgba(255,255,255,0.92)'); sp.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = sp; c.beginPath(); c.arc(-r * 0.36, -r * 0.44, r * 0.32, 0, Math.PI * 2); c.fill();
    c.restore();
  }
  // ball height over time: falls, two damped bounces, rests (returns offset above the rest point, and a squash)
  function bounce(dt, r, fall = 0.12, drop = 6) {
    if (dt < 0) return { up: Infinity, sq: 1 };
    if (dt < fall) { const k = dt / fall; return { up: r * drop * (1 - k * k), sq: 1 }; }
    const hops = [[0.26, r * 1.5], [0.15, r * 0.45]]; let t = dt - fall;
    if (t < 0.05) return { up: 0, sq: 1 - Math.sin(t / 0.05 * Math.PI) * 0.18 };
    for (const [d, h] of hops) { if (t < d) { const u = t / d; return { up: h * 4 * u * (1 - u), sq: 1 }; } t -= d; }
    return { up: 0, sq: t < 0.06 ? 1 - Math.sin(t / 0.06 * Math.PI) * 0.08 : 1 };
  }
  // the app icon: a glossy squircle in the accent (morph 0 = the ball, 1 = the tile), the glyph wiping on
  function iconTile(c, S, x, y, s, o = {}) {
    const m = o.morph == null ? 1 : clamp(o.morph), r = lerp(s / 2, s * 0.26, m), logo = L.img && L.img('logo'), col = S.look.accent;
    const fill = logo ? mix(col, '#FFFFFF', m) : col;
    c.save();
    c.save(); L.rr(c, x - s / 2, y - s / 2, s, s, r); c.shadowColor = rgba(col, 0.38); c.shadowBlur = s * 0.32; c.shadowOffsetY = s * 0.12; c.fillStyle = fill; c.fill(); c.restore();
    c.save(); L.rr(c, x - s / 2, y - s / 2, s, s, r); c.clip();
    const g = c.createLinearGradient(0, y - s / 2, 0, y + s / 2); g.addColorStop(0, mix(fill, '#FFFFFF', 0.2)); g.addColorStop(1, mix(fill, '#000000', 0.16)); c.fillStyle = g; c.fillRect(x - s / 2, y - s / 2, s, s);
    const sp = c.createRadialGradient(x - s * 0.22, y - s * 0.3, 0, x - s * 0.22, y - s * 0.3, s * 0.5); sp.addColorStop(0, 'rgba(255,255,255,0.4)'); sp.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = sp; c.fillRect(x - s / 2, y - s / 2, s, s);
    const gk = o.glyph == null ? 1 : clamp(o.glyph);
    if (gk > 0) {
      c.save(); c.beginPath(); c.rect(x - s / 2, y + s / 2 - s * gk * 1.05, s, s * gk * 1.05); c.clip();
      if (logo) { const mm = s * 0.18, iw = s - mm * 2, ih = iw * (logo.height / logo.width || 1); c.drawImage(logo, x - iw / 2, y - Math.min(ih, iw) / 2, iw, Math.min(ih, iw)); }
      else { const nm = (brand().name || 'B').trim(); L.text(c, S.look, nm.slice(0, 1).toUpperCase(), x, y + s * 0.2, { role: 'display', px: s * 0.58, color: L.onColor(col), align: 'center', weight: 800 }); }
      c.restore();
    }
    c.restore();
    L.rr(c, x - s / 2 + 1, y - s / 2 + 1, s - 2, s - 2, r); c.strokeStyle = 'rgba(255,255,255,0.25)'; c.lineWidth = 1.2 * S.u; c.stroke();
    c.restore();
  }
  // a digit odometer: each column rolls like a mechanical counter (lower columns spin, higher ones step)
  function odometer(c, S, v, x, y, o = {}) {
    const px = o.px, wt = o.weight || 700, role = o.role || 'numeral', fin = Math.max(Math.abs(o.final || v), Math.abs(v));
    const nd = Math.max(o.digits || 1, String(Math.floor(fin)).length), useC = o.commas !== false && nd > 4;
    const fd = String(Math.floor(fin)).padStart(nd, '0'), w0 = L.textW(c, S.look, '0', { role, px, weight: wt, tracking: 0 });
    const cellW = Array.from({ length: nd }, (_, i) => Math.max(w0 * 0.72, L.textW(c, S.look, fd[i], { role, px, weight: wt, tracking: 0 }))), dW = w0, cW = L.textW(c, S.look, ',', { role, px, weight: wt, tracking: 0 }) * 0.9;
    const pre = o.prefix || '', suf = o.suffix || '', sPx = o.sufPx || px;
    const preW = pre ? L.textW(c, S.look, pre, { role, px, weight: wt, tracking: -0.03 }) : 0, sufW = suf ? L.textW(c, S.look, suf, { role: o.sufRole || role, px: sPx, weight: o.sufWeight || wt, tracking: -0.02 }) : 0;
    let total = preW + cellW.reduce((a, v) => a + v, 0) - px * 0.02 * nd + (useC ? Math.floor((nd - 1) / 3) * cW : 0) + (suf ? sPx * 0.06 + sufW : 0);
    let cx = o.align === 'left' ? x : o.align === 'right' ? x - total : x - total / 2;
    const col = o.color || S.P.fg, lh = px * 0.92, vv = Math.max(0, v);
    if (pre) cx += L.text(c, S.look, pre, cx, y, { role, px, weight: wt, color: col, tracking: -0.03 });
    for (let i = 0; i < nd; i++) {
      const dW = cellW[i] - px * 0.02, p = nd - 1 - i, P = Math.pow(10, p), rem = vv - Math.floor(vv / P) * P;
      const frac = p === 0 ? vv - Math.floor(vv) : clamp(rem - (P - 1)), d = Math.floor(vv / P) % 10;
      const lead = p > 0 && Math.floor(vv) < P; // a leading zero: hidden until the column first turns
      const a = lead ? (frac > 0.001 ? 1 : o.pad ? 0.18 : 0) : 1;
      if (a > 0.01) {
        c.save(); c.globalAlpha *= a; c.beginPath(); c.rect(cx - dW * 0.1, y - px * 0.8, dW * 1.2, px * 0.9); c.clip();
        const moving = frac > 0.001 && frac < 0.999, gh = moving && !lead && o.blur !== false ? 2 : 0;
        for (let g = gh; g >= 0; g--) {
          c.save(); if (g) c.globalAlpha *= 0.14;
          const off = g ? (g === 1 ? -1 : 1) * px * 0.1 : 0;
          // each digit fades with its distance from the window, so a turning column never leaves a sliver behind
          if (!lead) { c.save(); c.globalAlpha *= clamp(1 - frac * 1.7); L.text(c, S.look, String(d), cx + dW / 2, y - frac * lh + off, { role, px, weight: wt, color: col, align: 'center', tracking: 0 }); c.restore(); }
          if (moving) { c.save(); c.globalAlpha *= clamp(1 - (1 - frac) * 1.7); L.text(c, S.look, String((d + 1) % 10), cx + dW / 2, y + (1 - frac) * lh + off, { role, px, weight: wt, color: col, align: 'center', tracking: 0 }); c.restore(); }
          c.restore();
        }
        c.restore();
      }
      cx += dW;
      if (useC && p > 0 && p % 3 === 0) { if (!(p > 0 && Math.floor(vv) < P)) L.text(c, S.look, ',', cx, y, { role, px, weight: wt, color: col, tracking: 0 }); cx += cW; }
    }
    if (suf) L.text(c, S.look, suf, cx + sPx * 0.06, y, { role: o.sufRole || role, px: sPx, weight: o.sufWeight || wt, color: o.sufColor || col, tracking: -0.02 });
    return { w: total, x0: o.align === 'left' ? x : o.align === 'right' ? x - total : x - total / 2 };
  }
  // typed text over a ghost of the final line (the line's shape is there from the first frame), with backspace out
  function typeWords(S, lay, t0, cps, o = {}) {
    const c = S.ctx; let shown = (S.lt - t0) * cps, caret = null;
    const total = lay.words.reduce((a, w) => a + w.s.length + 1, 0);
    if (o.outAt != null && S.lt > o.outAt) shown = Math.min(shown, total - (S.lt - o.outAt) * cps * 2.6);
    for (const w of lay.words) {
      const n = clamp(Math.floor(shown), 0, w.s.length); shown -= w.s.length + 1;
      const col = o.fill || (w.tk.accent ? S.P.accent : (o.color || S.P.fg));
      if (o.ghost !== 0 && n < w.s.length && S.lt > t0 - 0.05) { c.save(); c.globalAlpha *= o.ghost || 0.13; L.drawWord(c, S.look, S.P, w, { fill: col }); c.restore(); }
      if (n > 0) { const part = Object.assign({}, w, { s: w.s.slice(0, n) }); L.drawWord(c, S.look, S.P, part, { fill: col }); if (n < w.s.length || shown < 0) { L.setFont(c, S.look, w.role, w.px); caret = { x: w.x + c.measureText(part.s).width, y: w.y, px: w.px }; } }
      else if (!caret && shown <= 0 && S.lt >= t0) caret = { x: w.x, y: w.y, px: w.px };
    }
    try { c.letterSpacing = '0px'; } catch (e) { /* */ }
    return caret;
  }
  const bounds = lay => { const ws = lay.words; if (!ws.length) return { x0: lay.x, x1: lay.x }; return { x0: Math.min(...ws.map(w => w.x)), x1: Math.max(...ws.map(w => w.x + w.w)) }; };
  // a bracket caption drawn directly (setups that own their caption): [ typed words ] in the accent brackets
  function bracketCaption(S, tokens, x, y, px, t0, o = {}) {
    if (!tokens.length) return null;
    const lay = L.layout(S.ctx, S.look, withTail(tokens), { role: o.role || 'ui', px, maxW: o.maxW || S.W * 0.8, x, y, align: o.align || 'center', maxLines: o.maxLines || 2, lineH: 1.18, space: 0.27 });
    L.get('effect:type-bracket-typer').draw(S, { lay, t0, outAt: o.outAt });
    return lay;
  }

  /* ───────── type treatments (effect kind 'type') ───────── */
  /* bracket typer: [ a sentence types in letter by letter ] over its own faint ghost, the payoff words in accent */
  L.def('effect:type-bracket-typer', {
    kind: 'type',
    plan(b, F, t0 = 0) {
      const tk = toks(b), chars = tk.reduce((a, t) => a + t.s.length + 1, 0), cps = clamp(chars / 1.1, 30, 55); const ws = []; let at = t0 + 0.08;
      for (const t of tk) { ws.push(+at.toFixed(3)); at += (t.s.length + 1) / cps; }
      const a = tk.findIndex(t => t.accent);
      return { words: ws, done: at, cps, events: [{ at: t0, event: 'word' }, ...(a > 0 ? [{ at: ws[a], event: 'key-word' }] : [])] };
    },
    draw(S, o) {
      const lay = o.lay, c = S.ctx, t0 = o.t0 || 0; if (!lay || !lay.words.length) return;
      const chars = lay.words.reduce((a, w) => a + w.s.length + 1, 0), cps = clamp(chars / 1.1, 30, 55);
      const bk = pop(S, t0, 'snap'); if (bk <= 0) return;
      const first = lay.words[0], last = lay.words[lay.words.length - 1], bpx = first.px, role = first.role;
      const outAt = o.outAt != null ? o.outAt : (S.d && S.d > 2 ? S.d - 0.32 : null);
      const outK = outAt != null ? E.in(prog(S.lt, outAt + chars / (cps * 2.6), 0.12)) : 0;
      c.save(); c.globalAlpha *= 1 - outK;
      const lb = lay.words.filter(w => w.li === 0), x0 = Math.min(...lb.map(w => w.x));
      L.text(c, S.look, '[', x0 - bpx * 0.62 - (1 - bk) * bpx * 0.4, first.y, { role, px: bpx, weight: 500, color: S.P.accent, tracking: 0 });
      const lastLine = lay.words.filter(w => w.li === last.li), x1 = Math.max(...lastLine.map(w => w.x + w.w));
      L.text(c, S.look, ']', x1 + bpx * 0.3 + (1 - bk) * bpx * 0.4, last.y, { role, px: bpx, weight: 500, color: S.P.accent, tracking: 0 });
      typeWords(S, lay, t0 + 0.08, cps, { outAt });
      c.restore();
    },
  });

  /* billboard slide: the line (best one huge word) slides in from the right edge with ghost copies, ink with a dark accent start */
  L.def('effect:type-billboard-ghost-slide', {
    kind: 'type',
    plan(b, F, t0 = 0) { return { words: Array(toks(b).length).fill(t0), done: t0 + 0.42, events: [{ at: t0, event: 'slide-out' }, { at: t0 + 0.3, event: 'hard-hit' }] }; },
    draw(S, o) {
      const lay = o.lay, c = S.ctx, t0 = o.t0 || 0; if (S.lt < t0 || !lay.words.length) return;
      const bx = bounds(lay), off = tt => S.W * 0.46 * (1 - E.expo(prog(tt, t0, 1.1)));
      const g = c.createLinearGradient(bx.x0, 0, bx.x1, 0), dk = lum(S.P.bg) > 0.4;
      g.addColorStop(0, mix(S.P.accent, S.P.fg, dk ? 0.62 : 0.3)); g.addColorStop(0.55, S.P.fg); g.addColorStop(1, S.P.fg);
      const v = Math.abs(off(S.lt) - off(S.lt - 1 / 60)), ghosts = v > 2 * S.u ? 5 : 0;
      for (let j = ghosts; j >= 0; j--) {
        c.save(); c.globalAlpha *= j ? 0.2 * (1 - j / 6) : clamp((S.lt - t0) / 0.05);
        c.translate(off(S.lt - j * 0.012), 0);
        for (const w of lay.words) L.drawWord(c, S.look, S.P, w, { fill: w.tk.accent ? S.P.accent : g });
        c.restore();
      }
    },
  });

  /* ping kicker: an accent dot pings with a ring, then a short line drops in word by word on the 8ths */
  L.def('effect:type-ping-kicker', {
    kind: 'type',
    plan(b, F, t0 = 0) { const n = toks(b).length, gap = Math.min(0.25, 1.4 / Math.max(1, n)); const ws = toks(b).map((_, i) => +(t0 + 0.3 + i * gap).toFixed(3)); return { words: ws, done: (ws[n - 1] || t0) + 0.15, events: [{ at: t0, event: 'pop' }, ...ws.slice(0, 6).map(at => ({ at, event: 'word' }))] }; },
    draw(S, o) {
      const lay = o.lay, c = S.ctx, t0 = o.t0 || 0, n = lay.words.length; if (!n) return;
      const gap = Math.min(0.25, 1.4 / n), w0 = lay.words[0], px = w0.px;
      const dx = w0.x - px * 0.5, dy = w0.y - px * 0.34, dr = px * 0.15, k = pop(S, t0);
      if (k > 0) { L.circle(c, dx, dy, dr * k, S.P.accent); const rk = prog(S.lt, t0, 0.55); if (rk > 0 && rk < 1) L.circle(c, dx, dy, lerp(dr, dr * 4.4, E.out(rk)), null, rgba(S.P.accent, 0.6 * (1 - rk)), 2 * S.u); }
      lay.words.forEach((w, i) => { const at = t0 + 0.3 + i * gap, e = E.out(prog(S.lt, at, 0.14)); if (e <= 0) return; c.save(); c.globalAlpha *= clamp(e * 2); L.drawWord(c, S.look, S.P, w, { y: w.y - (1 - e) * px * 0.16 }); c.restore(); });
    },
  });

  /* ink line, red line: the promise in two lines, the first ink and the second accent, word by word out of a soft blur */
  L.def('effect:type-ink-red-lines', {
    kind: 'type',
    plan(b, F, t0 = 0) { const n = toks(b).length, lines = n > 3 ? 2 : 1, per = Math.ceil(n / lines); const ws = toks(b).map((_, i) => +(t0 + Math.floor(i / per) * 0.6 + (i % per) * 0.1).toFixed(3)); return { words: ws, done: (ws[n - 1] || t0) + 0.42, events: [{ at: t0, event: 'word' }, ...(lines > 1 ? [{ at: t0 + 0.6, event: 'key-word' }] : [])] }; },
    draw(S, o) {
      const lay = o.lay, c = S.ctx, t0 = o.t0 || 0, last = lay.lines - 1;
      for (const w of lay.words) {
        const idx = lay.words.filter(x => x.li === w.li && x.i < w.i).length, at = t0 + w.li * 0.6 + idx * 0.1, k = prog(S.lt, at, 0.42), e = E.out(k);
        if (k <= 0) continue;
        c.save(); c.globalAlpha *= clamp(k * 2.5); const bl = (1 - E.out(clamp(k * 1.3))) * 9 * S.u; if (bl > 0.4) c.filter = `blur(${bl.toFixed(1)}px)`;
        L.drawWord(c, S.look, S.P, w, { y: w.y + (1 - e) * 22 * S.u, fill: (lay.lines > 1 && w.li === last) || w.tk.accent ? S.P.accent : S.P.fg });
        c.restore();
      }
    },
  });

  /* thinking shimmer: a sparkle and a quiet status line whose letters brighten in a band that sweeps across */
  L.def('effect:type-shimmer-thinking', {
    kind: 'type',
    plan(b, F, t0 = 0) { return { words: Array(toks(b).length).fill(t0), done: t0 + 0.35, events: [{ at: t0, event: 'ui-reveal' }] }; },
    draw(S, o) {
      const lay = o.lay, c = S.ctx, t0 = o.t0 || 0, k = appear(S, t0, 0.35); if (k <= 0 || !lay.words.length) return;
      const bx = bounds(lay), wd = bx.x1 - bx.x0, px = lay.words[0].px;
      c.save(); c.globalAlpha *= k;
      const sx = (lay.align === 'center' ? bx.x0 : bx.x0) - px * 0.9, sy = lay.words[0].y - px * 0.34;
      c.save(); c.translate(sx, sy); c.rotate(Math.sin(S.lt * 2) * 0.25); L.icon(c, 'sparkle', 0, 0, px * 0.95, S.P.accent, 2); c.restore();
      const base = grey(S, 0.42);
      for (const w of lay.words) L.drawWord(c, S.look, S.P, w, { fill: base });
      const ph = ((S.lt - t0) * 0.9) % 1.35, cx = bx.x0 - wd * 0.25 + ph * wd * 1.1, bw = Math.max(px * 3, wd * 0.25);
      const g = c.createLinearGradient(cx - bw, 0, cx + bw, 0); g.addColorStop(0, rgba(S.P.fg, 0)); g.addColorStop(0.5, rgba(S.P.fg, 1)); g.addColorStop(1, rgba(S.P.fg, 0));
      for (const w of lay.words) L.drawWord(c, S.look, S.P, w, { fill: w.tk.accent ? S.P.accent : g });
      c.restore();
    },
  });

  /* ───────── UI widgets ───────── */
  L.def('ui:glossy-accent-ball', {
    kind: 'ui',
    draw(S, o) { const r = o.r || 80 * S.u, floor = o.y + r, b = bounce(S.lt - (o.t0 || 0) - 0.1, r); if (b.up === Infinity) return; ball(S.ctx, S, o.x, floor - r - b.up, r, { floor, sx: 1 / Math.sqrt(b.sq), sy: b.sq, grey: o.grey }); },
  });

  L.def('ui:squircle-glyph-icon', {
    kind: 'ui',
    draw(S, o) {
      const s = o.size || 200 * S.u, t0 = o.t0 || 0, k = pop(S, t0); if (k <= 0) return;
      const m = E.out(prog(S.lt, t0 + 0.25, 0.25)), gk = E.ramp(prog(S.lt, t0 + 0.45, 0.3));
      const c = S.ctx; c.save(); scaleAbout(c, o.x, o.y, k * lerp(0.6, 1, m)); iconTile(c, S, o.x, o.y, s, { morph: m, glyph: gk }); c.restore();
      const fl = o.y + s / 2 + s * 0.12; c.save(); c.globalAlpha *= 0.5 * k; c.translate(o.x, fl); c.scale(1, 0.12); const g = c.createRadialGradient(0, 0, 0, 0, 0, s * 0.6); g.addColorStop(0, 'rgba(0,0,0,0.25)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(-s, -s, s * 2, s * 2); c.restore();
    },
  });

  /* digit odometer: a number whose digit columns roll (a year rolling back, a total climbing) */
  L.def('ui:digit-odometer-roll', {
    kind: 'ui',
    draw(S, o) {
      const n = o.number || numOf(S.b) || { value: 2014 }, t0 = o.t0 || 0, c = S.ctx;
      const to = typeof n.value === 'number' ? n.value : 100, year = Number.isInteger(to) && to > 1900 && to < 2100 && !n.prefix && !n.suffix;
      const from = o.from != null ? o.from : year ? to + 12 : 0, dur = o.dur || 1.75, k = (year ? E.settle : E.out)(prog(S.lt, t0 + 0.1, dur));
      const v = lerp(from, to, k), px = o.px || Math.min(S.H * 0.3, (o.w || S.W * 0.5) * 0.36);
      const a = appear(S, t0, 0.3); if (a <= 0) return;
      c.save(); c.globalAlpha *= a;
      odometer(c, S, v, o.x, o.y + px * 0.36, { px, final: Math.max(from, to), prefix: n.prefix, suffix: n.suffix, sufPx: px * 0.5, color: mix(grey(S, 0.72), S.P.fg, k), commas: !year });
      if (n.label && !o.noLabel) { const lk = appear(S, t0 + dur * 0.7, 0.4); c.globalAlpha *= lk; L.text(c, S.look, n.label, o.x, o.y + px * 0.36 + px * 0.42, { role: 'micro', px: Math.max(16 * S.u, px * 0.11), color: S.P.dim, align: 'center', upper: true, maxW: S.W * 0.8 }); }
      c.restore();
    },
  });

  // the reel's values: a geometric climb to the final number, rounded to readable steps
  const reelValues = (n, steps = 6) => { const to = Math.max(1, Math.abs(n.value || 0)), from = Math.max(1, to * 0.08), out = []; for (let i = 0; i < steps; i++) { const v = from * Math.pow(to / from, i / (steps - 1)); const r = Number.isInteger(n.value) ? Math.max(1, Math.round(v)) : Math.round(v * 10) / 10; if (!out.length || r !== out[out.length - 1]) out.push(r); } out[out.length - 1] = n.value; return out; };
  const priceStr = (n, v) => `${n.prefix || ''}${commas(Number.isInteger(v) ? v : v.toFixed(1))}`;
  /* slot-machine reel: a column of rising values steps up like a slot reel; the centre row is ink, the last lands in accent */
  function reel(c, S, o) {
    const n = o.number, vals = o.values || reelValues(n), px = o.px, pitch = px * 1.18, t0 = o.t0 || 0, step = o.step || 0.25, roll = 0.14;
    const n1 = vals.length - 1, s0 = t0 + (o.first || 0.4);
    let idx = 0; for (let i = 1; i <= n1; i++) idx += E.ramp(prog(S.lt, s0 + (i - 1) * step, roll));
    const landed = S.lt >= s0 + (n1 - 1) * step + roll, frac = idx - Math.floor(idx), moving = frac > 0.02 && frac < 0.98;
    const rise = (1 - appear(S, t0, 0.35)) * S.H * 0.4;
    const sufPx = px * 0.32;
    // the reel is a drum: rows sit on a cylinder (y = R sin θ, squashed by cos θ), so it reads as a turning object
    const th = 0.36, R = pitch / th;
    for (let i = 0; i < vals.length; i++) {
      const a = (i - idx) * th, dist = Math.abs(i - idx); if (Math.abs(a) > Math.PI / 2 - 0.05) continue;
      const centre = dist < 0.5, final = i === n1 && landed && centre, cs = Math.cos(a), dy = R * Math.sin(a) + rise;
      const col = final ? S.P.accent : centre ? S.P.fg : grey(S, 0.24);
      c.save(); c.globalAlpha *= clamp(cs * cs * 1.15) * (centre ? 1 : 0.85);
      if (!centre || moving) { const bl = (moving ? 5 : 0) + Math.min(3, dist * 1.2); if (bl > 0.4) c.filter = `blur(${(bl * S.u).toFixed(1)}px)`; }
      c.translate(0, o.y + dy); c.scale(1, cs); c.translate(0, -(o.y + dy));
      const y = o.y + dy + px * 0.36, str = priceStr(n, vals[i]), w = L.textW(c, S.look, str, { role: 'numeral', px, weight: 700, tracking: -0.05 });
      const sw = n.suffix ? L.textW(c, S.look, n.suffix, { role: 'ui', px: sufPx, weight: 600 }) : 0, x0 = o.x - (w + sw + px * 0.05) / 2;
      L.text(c, S.look, str, x0, y, { role: 'numeral', px, weight: 700, color: col, tracking: -0.05 });
      if (n.suffix) L.text(c, S.look, n.suffix, x0 + w + px * 0.05, y, { role: 'ui', px: sufPx, weight: 600, color: col });
      c.restore();
    }
    return { landed, landAt: s0 + (n1 - 1) * step + roll, idx };
  }
  L.def('ui:slot-price-reel', {
    kind: 'ui',
    draw(S, o) { const n = o.number || numOf(S.b) || { value: 612, prefix: '$' }; const c = S.ctx; c.save(); c.beginPath(); c.rect(0, o.y - (o.h || S.H) / 2, S.W, o.h || S.H); c.clip(); reel(c, S, { number: n, x: o.x, y: o.y, px: o.px || Math.min(S.H * 0.17, (o.w || S.W * 0.4) * 0.3), t0: o.t0 }); c.restore(); },
  });

  /* wavy dot loader: a row of dots riding a travelling sine, a few flicking hollow (busy, going nowhere) */
  function wavy(c, S, x, y, w, amp, t, o = {}) {
    const n = o.n || 22, r = w / n * 0.3, col = o.color || S.P.fg;
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1), xi = x - w / 2 + u * w, yi = y + amp * Math.sin(Math.PI * 2 * (u / 0.9 - t * 0.6)), a = o.k == null ? 1 : clamp(o.k * 1.6 - u * 0.6);
      if (a <= 0) continue;
      const hollow = rand(i * 31 + Math.floor(t * 4) * 7) > 0.8;
      c.save(); c.globalAlpha *= a;
      if (hollow) L.circle(c, xi, yi, r * 0.86, null, col, Math.max(1.5, r * 0.22)); else L.circle(c, xi, yi, r, col);
      c.restore();
    }
  }
  L.def('ui:wavy-dot-loader', {
    kind: 'ui',
    draw(S, o) { const t0 = o.t0 || 0, k = appear(S, t0, 0.6); if (k <= 0) return; const w = o.w || S.W * 0.5; wavy(S.ctx, S, o.x, o.y, w, (o.h || w * 0.3) * 0.28, S.lt - t0, { k, n: o.n || 22 }); },
  });

  // a status pill (Done / In progress / Pending) in product colours
  function statusPill(c, S, x, y, px, state, t) {
    const label = state === 'done' ? 'Done' : state === 'run' ? 'In progress' : 'Pending', dk = isDark(S);
    const w = L.textW(c, S.look, label, { role: 'ui', px, weight: 600 }) + px * (state === 'run' ? 2.4 : 1.4), h = px * 1.8;
    const bg = state === 'done' ? (dk ? '#1C3A28' : '#E3F5EA') : dk ? 'rgba(255,255,255,0.08)' : grey(S, 0.06), fg = state === 'done' ? '#1F9D57' : dk ? 'rgba(255,255,255,0.55)' : grey(S, 0.5);
    L.pill(c, x - w, y - h / 2, w, h, bg);
    if (state === 'run') { c.save(); c.strokeStyle = fg; c.lineWidth = px * 0.14; c.lineCap = 'round'; c.beginPath(); const a = t * 6; c.arc(x - w + px * 0.95, y, px * 0.36, a, a + 4.2); c.stroke(); c.restore(); }
    L.text(c, S.look, label, x - w + (state === 'run' ? px * 1.65 : px * 0.7), y + px * 0.36, { role: 'ui', px, weight: 600, color: fg });
  }
  /* stuck import wizard: a big white card with numbered steps, status pills, a wavy loader and a bar that creeps to 99% and freezes */
  function wizard(S, o) {
    const c = S.ctx, w = o.w, h = o.h || w * 0.56, x = o.x - w / 2, y = o.y - h / 2, t0 = o.t0 || 0, k = appear(S, t0, 0.55); if (k <= 0) return;
    const dk = isDark(S), fg = dk ? '#F2F2F2' : S.P.fg, dim = rgba(fg, 0.45), rule = rgba(fg, 0.08);
    const steps = (o.steps && o.steps.length ? o.steps : ['Upload', 'Map fields', 'Review', 'Import']).slice(0, 4), n = steps.length;
    const pad = Math.min(w, h) * 0.07, px = clamp(Math.min(w * 0.027, h * 0.05), 14 * S.u, 34 * S.u), tall = h / w > 0.75;
    c.save(); c.globalAlpha *= clamp(k * 1.6); c.translate(0, (1 - k) * 34 * S.u); scaleAbout(c, o.x, o.y, lerp(0.96, 1, k));
    L.card(c, x, y, w, h, Math.min(28 * S.u, w * 0.03), { fill: cardFill(S), u: S.u, lift: 0.8 });
    const doneAt = t0 + (o.doneAt || 0.9), done = S.lt >= doneAt ? 1 : 0;
    const hy = y + pad + px * 0.9;
    L.text(c, S.look, o.title || 'Import', x + pad, hy, { role: 'ui', px: px * 1.25, weight: 650, color: fg, maxW: w * 0.5 });
    L.text(c, S.look, `Step ${done + 1} of ${n}`, x + w - pad, hy, { role: 'micro', px: px * 0.85, color: dim, align: 'right' });
    L.line(c, x + pad, hy + px * 1.0, x + w - pad, hy + px * 1.0, rule, 1.2 * S.u);
    const bodyT = hy + px * 1.9, barH = px * 3.2, bodyB = y + h - pad - barH;
    let lx = x + pad, lw = w - pad * 2, sT = bodyT, sB = bodyB, loader;
    if (tall) { loader = { x: x + w / 2, y: bodyT + (bodyB - bodyT) * 0.16, w: lw * 0.9 }; sT = bodyT + (bodyB - bodyT) * 0.36; }
    else { lw = (w - pad * 2) * 0.56; loader = { x: x + pad + lw + (w - pad * 2 - lw) / 2 + pad * 0.4, y: (bodyT + bodyB) / 2, w: (w - pad * 2 - lw) * 0.82 }; }
    const rowH = (sB - sT) / n;
    steps.forEach((s, i) => {
      const ry = sT + rowH * (i + 0.5), rk = appear(S, t0 + 0.2 + i * 0.08, 0.4); if (rk <= 0) return;
      c.save(); c.globalAlpha *= rk; c.translate((1 - rk) * 16 * S.u, 0);
      const st = i < done ? 'done' : i === done ? 'run' : 'pend', r = px * 1.05;
      L.circle(c, lx + r, ry, r, st === 'pend' ? null : st === 'done' ? fg : S.P.accent, st === 'pend' ? rgba(fg, 0.2) : null, 1.5 * S.u);
      if (st === 'done') L.icon(c, 'check', lx + r, ry, r * 1.1, cardFill(S), 2.6); else L.text(c, S.look, String(i + 1), lx + r, ry + px * 0.36, { role: 'ui', px, weight: 700, color: st === 'pend' ? dim : '#FFFFFF', align: 'center' });
      L.text(c, S.look, s, lx + r * 2 + px * 0.8, ry + px * 0.36, { role: 'ui', px: px * 1.05, weight: 550, color: st === 'pend' ? dim : fg, maxW: lw * 0.5 });
      statusPill(c, S, lx + lw, ry, px * 0.86, st, S.lt);
      if (i < n - 1) L.line(c, lx, ry + rowH / 2, lx + lw, ry + rowH / 2, rule, 1 * S.u);
      c.restore();
    });
    wavy(c, S, loader.x, loader.y, loader.w, Math.min(loader.w * 0.12, (tall ? (bodyB - bodyT) * 0.1 : (bodyB - bodyT) * 0.18)), S.lt - t0, { k: appear(S, t0 + 0.3, 0.6), n: 20, color: fg });
    // the bar: creeps, then sits at 99% forever (a faint shimmer runs along it, going nowhere)
    const v = L.kf(S.lt, [[t0 + 0.3, 0.2], [t0 + 0.7, 0.68], [t0 + 1.05, 0.88], [t0 + 1.35, 0.95], [t0 + 1.65, 0.98], [t0 + 2.0, 0.99]]);
    const by = y + h - pad - barH * 0.35, bw = w - pad * 2 - px * 4.2;
    L.text(c, S.look, o.barLabel || `${n} of ${n}`, x + pad, by - px * 1.0, { role: 'micro', px: px * 0.8, color: dim });
    L.pill(c, x + pad, by - px * 0.3, bw, px * 0.6, rgba(fg, 0.08)); L.pill(c, x + pad, by - px * 0.3, Math.max(px * 0.6, bw * v), px * 0.6, fg);
    if (S.lt > t0 + 2.0) { const sh = ((S.lt - t0) * 0.7) % 1; c.save(); L.rr(c, x + pad, by - px * 0.3, bw * v, px * 0.6, px * 0.3); c.clip(); const gx = x + pad + sh * bw * 1.3 - bw * 0.15, g = c.createLinearGradient(gx - bw * 0.1, 0, gx + bw * 0.1, 0); g.addColorStop(0, rgba(cardFill(S), 0)); g.addColorStop(0.5, rgba(cardFill(S), 0.5)); g.addColorStop(1, rgba(cardFill(S), 0)); c.fillStyle = g; c.fillRect(x, by - px, w, px * 2); c.restore(); }
    L.text(c, S.look, `${Math.floor(v * 100)}%`, x + w - pad, by + px * 0.3, { role: 'micro', px: px * 1.1, weight: 600, color: v >= 0.99 ? S.P.accent : fg, align: 'right' });
    c.restore();
  }
  L.def('ui:import-wizard-stuck', {
    kind: 'ui',
    draw(S, o) { wizard(S, { x: o.x, y: o.y, w: o.w, h: o.h, t0: o.t0, steps: o.steps || (o.items || itemsOf(S.b)).slice(0, 4), title: o.title }); },
  });

  /* dark agent terminal: traffic lights, a mono title, an accent prompt typing a plain-language command, status lines */
  function terminal(S, o) {
    const c = S.ctx, w = o.w, h = o.h || w * 0.56, t0 = o.t0 || 0, k = appear(S, t0, 0.4); if (k <= 0) return null;
    const x = o.x - w / 2 + (o.shake || 0), y = o.y - h / 2, ink = mix(S.look.palette.ink, '#000000', 0.15), px = clamp(w * 0.034, 12 * S.u, 34 * S.u);
    c.save(); c.globalAlpha *= clamp(k * 1.5); c.translate(0, (1 - k) * 22 * S.u);
    const fin = isDark(S) ? mix(S.P.bg, '#FFFFFF', 0.1) : ink, fill = mix(mix(fin, '#FFFFFF', 0.28), fin, E.out(prog(S.lt, t0, 0.35)));
    L.card(c, x, y, w, h, Math.min(24 * S.u, w * 0.035), { fill, u: S.u, lift: 1.1, shadow: 'rgba(0,0,0,0.28)' });
    const bar = px * 2;
    ['#FF5F57', '#FEBC2E', '#28C840'].forEach((col, i) => L.circle(c, x + bar * 0.6 + i * px * 0.95, y + bar * 0.55, px * 0.26, col));
    L.text(c, S.look, o.title || slugOf(brand().name) || 'agent', x + w / 2, y + bar * 0.55 + px * 0.28, { role: 'micro', px: px * 0.7, color: 'rgba(255,255,255,0.38)', align: 'center' });
    const lx = x + px * 1.3, mono = { role: 'micro', px, weight: 500 }, cmd = o.cmd || '', cps = o.cps || 24, ta = o.typeAt != null ? o.typeAt : t0 + 0.4;
    let ly = y + bar + px * 1.6;
    const nC = clamp(Math.floor((S.lt - ta) * cps), 0, cmd.length), maxW = w - px * 4;
    L.text(c, S.look, '>', lx, ly, Object.assign({ color: S.P.accentRaw || S.look.accent }, mono));
    const tw = L.text(c, S.look, cmd.slice(0, nC), lx + px * 1.3, ly, Object.assign({ color: '#F3F1ED', maxW }, mono));
    let caret = nC < cmd.length || !(o.lines || []).length ? { x: lx + px * 1.3 + Math.min(tw, maxW), y: ly } : null;
    for (const ln of o.lines || []) {
      if (S.lt < ln.at) break;
      ly += px * 1.55; const a = appear(S, ln.at, 0.25);
      c.save(); c.globalAlpha *= a;
      if (ln.err || ln.ok) L.circle(c, lx + px * 0.35, ly - px * 0.33, px * 0.22, ln.err ? (S.look.accent) : '#2DB36A');
      L.text(c, S.look, ln.s, lx + px * 1.3, ly, Object.assign({}, mono, { color: ln.err ? mix(S.look.accent, '#FFFFFF', 0.15) : ln.dim ? 'rgba(243,241,237,0.42)' : '#F3F1ED', maxW }));
      c.restore();
      caret = null;
    }
    if (!caret && o.lines && o.lines.length && S.lt > o.lines[o.lines.length - 1].at + 0.3) { ly += px * 1.55; L.text(c, S.look, '>', lx, ly, Object.assign({ color: S.look.accent }, mono)); caret = { x: lx + px * 1.3, y: ly }; }
    if (caret && Math.floor(S.lt * 2.4) % 2 === 0) { c.fillStyle = '#F3F1ED'; c.fillRect(caret.x + 2 * S.u, caret.y - px * 0.82, px * 0.55, px * 1.0); }
    c.restore();
    return { x, y, w, h };
  }
  L.def('ui:agent-terminal-dark', {
    kind: 'ui',
    draw(S, o) { const t0 = o.t0 || 0, cmd = o.cmd || (S.b.data && S.b.data.prompt) || ''; terminal(S, { x: o.x, y: o.y, w: o.w, h: o.h, t0, cmd, typeAt: t0 + 0.35, lines: o.lines ? o.lines.map((l, i) => Object.assign({ at: t0 + 0.6 + cmd.length / 24 + i * 0.45 }, l)) : [] }); },
  });

  // a greyed legacy window: version title, sidebar, skeleton rows (the old tool that cannot answer)
  function legacy(S, o) {
    const c = S.ctx, w = o.w, h = o.h, x = o.x - w / 2, y = o.y - h / 2, k = appear(S, o.t0 || 0, 0.6); if (k <= 0) return;
    const dk = isDark(S), fill = mix(S.P.bg, S.P.fg, dk ? 0.1 : 0.05), bar = Math.max(26 * S.u, h * 0.09), sk = mix(S.P.bg, S.P.fg, dk ? 0.22 : 0.12);
    c.save(); c.globalAlpha *= clamp(k) * 0.9; c.translate(0, (1 - k) * 10 * S.u);
    L.card(c, x, y, w, h, 14 * S.u, { fill, u: S.u, lift: 0.35 });
    c.save(); L.rr(c, x, y, w, h, 14 * S.u); c.clip();
    c.fillStyle = mix(S.P.bg, S.P.fg, 0.08); c.fillRect(x, y, w, bar);
    for (let i = 0; i < 3; i++) L.rr(c, x + w - bar * (0.7 + i * 0.6), y + bar * 0.38, bar * 0.36, bar * 0.24, 2 * S.u), (c.fillStyle = sk), c.fill();
    L.text(c, S.look, o.title || '', x + bar * 0.5, y + bar * 0.64, { role: 'micro', px: bar * 0.36, color: mix(S.P.bg, S.P.fg, 0.4), maxW: w * 0.6 });
    c.fillStyle = mix(S.P.bg, S.P.fg, 0.07); c.fillRect(x, y + bar, w * 0.24, h - bar);
    c.fillStyle = sk;
    for (let i = 0; i < 6; i++) { L.rr(c, x + w * 0.04, y + bar + h * 0.07 + i * h * 0.11, w * 0.14, h * 0.035, 3 * S.u); c.fill(); }
    for (let i = 0; i < 7; i++) { const lw = w * (0.62 - (rand(i + 4) * 0.25)); L.rr(c, x + w * 0.3, y + bar + h * 0.08 + i * h * 0.1, lw, h * 0.03, 3 * S.u); c.fill(); }
    c.restore(); c.restore();
  }
  /* dashed link with packets: an accent dashed line marching from sender to receiver, packets travelling on it */
  function dashedLink(c, S, a, b, o = {}) {
    const k = o.k == null ? 1 : o.k; if (k <= 0) return;
    const len = Math.hypot(b.x - a.x, b.y - a.y), stop = o.stopAt != null ? o.stopAt : 1;
    c.save(); c.strokeStyle = rgba(S.P.accent, 0.75); c.lineWidth = 2 * S.u; c.setLineDash([10 * S.u, 8 * S.u]); c.lineDashOffset = -S.lt * 30 * S.u;
    c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(lerp(a.x, b.x, k), lerp(a.y, b.y, k)); c.stroke(); c.restore();
    if (o.packetsAt != null && S.lt > o.packetsAt) {
      const n = o.n || 2;
      for (let i = 0; i < n; i++) {
        let u = ((S.lt - o.packetsAt) * (o.speed || 0.9) + i / n) % 1;
        if (o.blockAt != null && S.lt > o.blockAt) { if (u > stop - 0.06) continue; }
        if (u > stop) continue;
        const px = lerp(a.x, b.x, u), py = lerp(a.y, b.y, u), r = 6 * S.u * (o.blockAt != null && S.lt > o.blockAt ? clamp(1 - (S.lt - o.blockAt) * 3) : 1);
        if (r > 0.3) { L.circle(c, px, py, r * 1.8, rgba(S.P.accent, 0.18)); L.circle(c, px, py, r, S.P.accent); }
      }
    }
    if (o.ends !== false) { L.circle(c, a.x, a.y, 5 * S.u * k, S.P.accent); L.circle(c, b.x, b.y, 5 * S.u * clamp(k * 2 - 1), S.P.accent); }
  }
  L.def('ui:dashed-link-packets', {
    kind: 'ui',
    draw(S, o) { const t0 = o.t0 || 0, w = o.w || S.W * 0.4, k = E.out(prog(S.lt, t0, 0.5)); const c = S.ctx; dashedLink(c, S, { x: o.x - w / 2, y: o.y }, { x: o.x + w / 2, y: o.y }, { k, packetsAt: t0 + 0.4, n: 3 }); [-1, 1].forEach(s => { const nk = pop(S, t0 + (s < 0 ? 0 : 0.35)); if (nk > 0) { c.save(); scaleAbout(c, o.x + s * w / 2, o.y, nk); L.card(c, o.x + s * w / 2 - 36 * S.u, o.y - 36 * S.u, 72 * S.u, 72 * S.u, 20 * S.u, { fill: cardFill(S), u: S.u, lift: 0.6 }); L.icon(c, s < 0 ? 'terminal' : 'mail', o.x + s * w / 2, o.y, 34 * S.u, S.P.fg, 2); c.restore(); } }); },
  });

  /* error disc: an accent disc with a white X lands on a connector, a ring pulse behind it */
  function errorDisc(c, S, x, y, d, t0) {
    const k = pop(S, t0, 'pop'); if (k <= 0) return;
    const rk = prog(S.lt, t0, 0.5); if (rk < 1) L.circle(c, x, y, lerp(d * 0.5, d * 1.25, E.out(rk)), null, rgba(S.P.accent, 0.55 * (1 - rk)), 2 * S.u);
    const pulse = 1 + Math.sin(Math.max(0, S.lt - t0 - 0.5) * 3) * 0.04 * clamp(S.lt - t0 - 0.5);
    L.circle(c, x, y, d * 0.68 * k * pulse, rgba(S.P.accent, 0.12));
    c.save(); scaleAbout(c, x, y, k); ball(c, S, x, y, d / 2, { glow: false }); L.icon(c, 'x', x, y, d * 0.5, '#FFFFFF', 3.2); c.restore();
  }
  L.def('ui:error-disc-x', {
    kind: 'ui',
    draw(S, o) { const t0 = o.t0 || 0, w = o.w || S.W * 0.4, d = Math.min(120 * S.u, w * 0.18); dashedLink(S.ctx, S, { x: o.x - w / 2, y: o.y }, { x: o.x + w / 2, y: o.y }, { k: 1, ends: true }); errorDisc(S.ctx, S, o.x, o.y, d, t0 + 0.4); },
  });

  /* mono counter pill: a small black pill in mono, a number that keeps climbing and short dot-separated tags */
  function counterPill(c, S, x, y, o) {
    const k = pop(S, o.t0 || 0, 'firm'); if (k <= 0.01) return;
    const px = o.px || 18 * S.u, from = o.from || 0, to = o.to || 0, v = Math.round(lerp(from, to, E.out(prog(S.lt, (o.t0 || 0) + 0.2, o.dur || 1.2))));
    const str = `${o.prefix || ''}${commas(v)}${o.suffix || ''}${o.label ? ' ' + o.label : ''}`, tags = (o.tags || []).slice(0, 3);
    const parts = [str, ...tags], sep = ' · ', full = parts.join(sep);
    const tw = L.textW(c, S.look, full, { role: 'micro', px, weight: 500 }), w = tw + px * 2.4, h = px * 2.2;
    c.save(); scaleAbout(c, x, y, k);
    L.card(c, x - w / 2, y - h / 2, w, h, h / 2, { fill: isDark(S) ? mix(S.P.bg, '#FFFFFF', 0.12) : mix(S.look.palette.ink, '#000000', 0.1), u: S.u, lift: 0.4, stroke: false });
    L.text(c, S.look, full, x, y + px * 0.36, { role: 'micro', px, weight: 500, color: '#F3F1ED', align: 'center', maxW: S.W * 0.9 });
    c.restore();
  }
  L.def('ui:mono-counter-pill', {
    kind: 'ui',
    draw(S, o) { const n = o.number || numOf(S.b) || { value: 126 }, to = typeof n.value === 'number' ? n.value : 126; counterPill(S.ctx, S, o.x, o.y, { t0: o.t0, from: Math.round(to * 0.72), to, prefix: n.prefix, suffix: n.suffix, label: n.label, tags: (o.items || itemsOf(S.b)).slice(0, 2), px: Math.max(18 * S.u, (o.w || S.W * 0.4) * 0.03) }); },
  });

  /* agent tool-call panel: a light panel with a mono header, a tinted prompt row that types, tool calls with status dots */
  function toolPanel(S, o) {
    const c = S.ctx, w = o.w, h = o.h, x = o.x - w / 2, y = o.y - h / 2, t0 = o.t0 || 0, k = appear(S, t0, 0.5); if (k <= 0) return;
    const dk = isDark(S), fg = dk ? '#F2F2F2' : S.P.fg, dim = rgba(fg, 0.42), px = clamp(Math.min(w * 0.034, h / 17), 12 * S.u, 30 * S.u), pad = px * 1.4;
    c.save(); c.globalAlpha *= clamp(k * 1.5); c.translate(0, (1 - k) * 24 * S.u);
    L.card(c, x, y, w, h, Math.min(26 * S.u, w * 0.03), { fill: cardFill(S), u: S.u, lift: 0.8 });
    const mono = { role: 'micro', px, weight: 500 };
    L.text(c, S.look, o.title || 'agent', x + pad, y + pad + px * 0.4, Object.assign({}, mono, { color: fg, weight: 600 }));
    L.text(c, S.look, o.meta || '', x + w - pad, y + pad + px * 0.4, Object.assign({}, mono, { color: dim, align: 'right' }));
    const py = y + pad + px * 1.6, ph = px * 2.4;
    L.rr(c, x + pad * 0.7, py, w - pad * 1.4, ph, px * 0.5); c.fillStyle = dk ? 'rgba(255,255,255,0.05)' : grey(S, 0.035); c.fill();
    const q = o.prompt || '', n = clamp(Math.floor((S.lt - (o.typeAt || t0 + 0.3)) * (o.cps || 26)), 0, q.length);
    L.text(c, S.look, '>', x + pad * 1.2, py + ph / 2 + px * 0.36, Object.assign({}, mono, { color: S.P.accent }));
    const tw = L.text(c, S.look, q.slice(0, n), x + pad * 1.2 + px * 1.3, py + ph / 2 + px * 0.36, Object.assign({}, mono, { color: fg, maxW: w - pad * 3.4 }));
    if (n < q.length || Math.floor(S.lt * 2.4) % 2 === 0) { c.fillStyle = S.P.accent; c.fillRect(x + pad * 1.2 + px * 1.3 + Math.min(tw, w - pad * 3.4) + 3 * S.u, py + ph / 2 - px * 0.5, px * 0.5, px); }
    let ly = py + ph + px * 2.2;
    for (const cl of o.calls || []) {
      if (S.lt < cl.at) break;
      const a = appear(S, cl.at, 0.3), doneK = cl.res != null && S.lt > cl.at + 0.35;
      c.save(); c.globalAlpha *= a; c.translate((1 - a) * 12 * S.u, 0);
      L.circle(c, x + pad + px * 0.3, ly - px * 0.33, px * 0.28, cl.err ? S.P.accent : doneK ? '#2DB36A' : rgba(fg, 0.28));
      const nw = L.text(c, S.look, cl.name, x + pad + px * 1.2, ly, Object.assign({}, mono, { color: fg, weight: 600, maxW: w * 0.5 }));
      if (cl.arg) L.text(c, S.look, cl.arg, x + pad + px * 1.2 + Math.min(nw, w * 0.5) + px * 0.6, ly, Object.assign({}, mono, { color: dim, maxW: w - pad * 2 - Math.min(nw, w * 0.5) - px * 2.4 }));
      if (doneK) { const rk = appear(S, cl.at + 0.35, 0.3); c.globalAlpha *= rk; L.text(c, S.look, '└ ' + cl.res, x + pad + px * 1.2, ly + px * 1.35, Object.assign({}, mono, { color: dim })); }
      c.restore();
      ly += px * (cl.res != null ? 3.3 : 2);
    }
    c.restore();
  }
  L.def('ui:agent-toolcall-panel', {
    kind: 'ui',
    draw(S, o) {
      const it = (o.items || itemsOf(S.b)).slice(0, 3), t0 = o.t0 || 0, q = o.text || (S.b.data && S.b.data.prompt) || '', B = slugOf(brand().name);
      const at0 = t0 + 0.3 + q.length / 26 + 0.25;
      toolPanel(S, { x: o.x, y: o.y, w: o.w, h: o.h || o.w * 0.66, t0, title: 'agent', meta: B, prompt: q, calls: it.map((s, i) => ({ name: `${B} · ${slugOf(s)}`, res: `${[312, 312, 312][i]} ${['found', 'tagged', 'added'][i]}`, at: at0 + i * 0.5 })) });
    },
  });

  /* query dot grid: grey dots answer a query; matches turn accent and grow, a count lands, then the matches stream into a pill */
  function qgrid(S, o) {
    const c = S.ctx, cols = o.cols || 11, rows = o.rows || 13, pitch = Math.min(o.w / cols, o.h / rows), r0 = pitch * 0.26;
    const gx = o.x - pitch * (cols - 1) / 2, gy = o.y - pitch * (rows - 1) / 2, t0 = o.t0 || 0, share = o.share || 0.2;
    const mk = E.out(prog(S.lt, o.matchAt, 0.5)), fade = o.fadeAt != null ? E.out(prog(S.lt, o.fadeAt, 0.4)) : 0;
    let count = 0; const sink = o.sink;
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const id = j * cols + i, diag = (i + j) / (cols + rows - 2), a = E.out(prog(S.lt, t0 + diag * 0.35, 0.18)); if (a <= 0) continue;
      const hit = rand(id * 13 + (o.seed || 5)) < share; if (hit) count++;
      let x = gx + i * pitch + noise(S.lt * 0.6 + id, 3) * 0.8 * S.u, y = gy + j * pitch + noise(S.lt * 0.5 + id, 9) * 0.8 * S.u, r = r0 * a;
      let col = S.P.fg;
      if (mk > 0) col = hit ? mix(S.P.fg, S.P.accent, mk) : mix(S.P.fg, grey(S, 0.2), mk);
      if (hit) r = lerp(r, r0 * 1.28, mk);
      if (fade > 0 && !hit) col = mix(col, grey(S, 0.14), fade);
      if (hit && sink && o.streamAt != null) {
        const st = o.streamAt + rand(id + 77) * 0.35, k = E.in(prog(S.lt, st, 0.5));
        if (k >= 1) { L.circle(c, x, y, r0 * 0.9, null, rgba(S.P.fg, 0.12), 1.2 * S.u); continue; }
        if (k > 0) { const mx = lerp(x, sink.x, 0.5), my = Math.max(y, sink.y) + pitch * 1.2; const u = k; x = (1 - u) * (1 - u) * x + 2 * (1 - u) * u * mx + u * u * sink.x; y = (1 - u) * (1 - u) * y + 2 * (1 - u) * u * my + u * u * sink.y; r *= lerp(1, 0.5, u); }
      }
      L.circle(c, x, y, r, col);
    }
    return { count, top: gy - pitch, bottom: gy + pitch * (rows - 1) + pitch, pitch };
  }
  L.def('ui:query-dot-grid', {
    kind: 'ui',
    draw(S, o) { const t0 = o.t0 || 0, w = o.w || S.W * 0.4, h = o.h || w * 0.6; const g = qgrid(S, { x: o.x, y: o.y, w: w * 1.1, h: h * 1.1, cols: 17, rows: 9, t0, matchAt: t0 + 0.9 }); const k = appear(S, t0 + 1.1, 0.3); if (k > 0) { S.ctx.save(); S.ctx.globalAlpha *= k; L.text(S.ctx, S.look, `${g.count} found`, o.x, g.top - 4 * S.u, { role: 'micro', px: 22 * S.u, weight: 600, color: S.P.accent, align: 'center' }); S.ctx.restore(); } },
  });

  /* workflow pill: a black pill naming a workflow, an accent status dot that becomes a tick */
  function workflowPill(c, S, x, y, o) {
    const k = pop(S, o.t0 || 0, 'firm'); if (k <= 0.01) return;
    const px = o.px || 28 * S.u, label = o.label || 'Workflow', tw = L.textW(c, S.look, label, { role: 'ui', px, weight: 650 }), h = px * 2.6, w = tw + px * 2 + h * 0.9;
    c.save(); scaleAbout(c, x, y, k);
    L.card(c, x - w / 2, y - h / 2, w, h, h / 2, { fill: isDark(S) ? mix(S.P.bg, '#FFFFFF', 0.12) : mix(S.look.palette.ink, '#000000', 0.1), u: S.u, lift: 0.7, stroke: false });
    L.text(c, S.look, label, x - w / 2 + px * 1.1, y + px * 0.36, { role: 'ui', px, weight: 650, color: '#F7F5F1' });
    const dx = x + w / 2 - h * 0.5, dr = h * 0.25, on = o.on != null ? o.on : 1e9, tk = E.out(prog(S.lt, on, 0.25)), sp = S.lt > on ? spring(S.lt - on, 'pop') : 0;
    L.circle(c, dx, y, dr * (1 + 0.15 * Math.sin(Math.min(1, sp) * Math.PI)), S.P.accent);
    if (tk > 0) { c.save(); c.strokeStyle = '#FFFFFF'; c.lineWidth = dr * 0.22; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); const pts = [[-0.42, 0.02], [-0.1, 0.32], [0.45, -0.3]]; const segs = tk * 2; c.moveTo(dx + pts[0][0] * dr, y + pts[0][1] * dr); for (let i = 1; i < 3; i++) { const f = clamp(segs - (i - 1)); if (f <= 0) break; c.lineTo(dx + lerp(pts[i - 1][0], pts[i][0], f) * dr, y + lerp(pts[i - 1][1], pts[i][1], f) * dr); } c.stroke(); c.restore(); }
    else { const pr = 0.5 + 0.5 * Math.sin(S.lt * 6); L.circle(c, dx, y, dr * (1.2 + pr * 0.3), null, rgba(S.P.accent, 0.35 * (1 - pr)), 1.5 * S.u); }
    c.restore();
    return { w, h, dx };
  }
  L.def('ui:workflow-pill-tick', {
    kind: 'ui',
    draw(S, o) { workflowPill(S.ctx, S, o.x, o.y, { t0: o.t0, label: o.label || (itemsOf(S.b)[0]) || 'Workflow', on: (o.t0 || 0) + 1.2, px: Math.max(26 * S.u, (o.w || S.W * 0.4) * 0.045) }); },
  });

  /* counter card pair: one white card whose total rolls up digit by digit, one frozen value with a lock that never moves */
  function cardPair(S, o) {
    const c = S.ctx, n = o.number || { value: 250000 }, wide = o.side, gap = 36 * S.u, cw = o.cw, ch = o.ch, t0 = o.t0 || 0;
    const pos = wide ? [[o.x - cw / 2 - gap / 2, o.y], [o.x + cw / 2 + gap / 2, o.y]] : [[o.x, o.y - ch / 2 - gap / 2], [o.x, o.y + ch / 2 + gap / 2]];
    const px = Math.min(ch * 0.42, cw * 0.17), lpx = Math.max(15 * S.u, ch * 0.085), fg = isDark(S) ? '#F2F2F2' : S.P.fg, dim = rgba(fg, 0.5);
    pos.forEach(([x, y], i) => {
      const k = appear(S, t0 + i * 0.12, 0.5); if (k <= 0) return;
      c.save(); c.globalAlpha *= clamp(k * 1.5); c.translate(0, (1 - k) * 26 * S.u);
      L.card(c, x - cw / 2, y - ch / 2, cw, ch, Math.min(26 * S.u, ch * 0.12), { fill: cardFill(S), u: S.u, lift: 0.7 });
      const lx = x - cw / 2 + ch * 0.18, ty = y - ch / 2 + ch * 0.24;
      if (i === 0) {
        L.text(c, S.look, (n.label || '').slice(0, 40), lx, ty, { role: 'micro', px: lpx, color: dim, upper: true, maxW: cw * 0.8 });
        const to = typeof n.value === 'number' ? n.value : 0, v = lerp(0, to, 1 - Math.pow(1 - prog(S.lt, o.countAt, 1.5), 4));
        odometer(c, S, v, lx, y + ch * 0.32, { px, final: to, prefix: n.prefix, suffix: n.suffix, sufPx: px * 0.55, align: 'left', color: fg });
        L.icon(c, 'trend', x + cw / 2 - ch * 0.24, ty - lpx * 0.3, lpx * 1.6, rgba(fg, 0.4), 2);
      } else {
        L.text(c, S.look, (o.frozenLabel || '').slice(0, 40), lx, ty, { role: 'micro', px: lpx, color: dim, upper: true, maxW: cw * 0.7 });
        L.text(c, S.look, o.frozen || `${n.prefix || ''}0`, lx, y + ch * 0.32, { role: 'numeral', px, weight: 700, color: S.P.accent, tracking: -0.05 });
        const lk = pop(S, o.lockAt || t0 + 0.6), ix = x + cw / 2 - ch * 0.26, iy = y + ch * 0.12;
        if (lk > 0) { c.save(); scaleAbout(c, ix, iy, lk); L.circle(c, ix, iy, ch * 0.17, rgba(S.P.accent, 0.1)); L.icon(c, 'lock', ix, iy, ch * 0.18, S.P.accent, 2.2); c.restore(); }
      }
      c.restore();
    });
  }
  L.def('ui:counter-card-pair', {
    kind: 'ui',
    draw(S, o) { const wide = isWide(S), cw = wide ? (o.w || S.W * 0.46) * 0.48 : (o.w || S.W * 0.8) * 0.9; cardPair(S, { x: o.x, y: o.y, cw, ch: cw * 0.42, side: wide, t0: o.t0, countAt: (o.t0 || 0) + 0.4, number: o.number || numOf(S.b) || { value: 250000, label: 'Total' }, frozenLabel: (o.items || itemsOf(S.b))[0] || '', lockAt: (o.t0 || 0) + 0.7 }); },
  });

  // a neutral glyph chip (never a third-party logo): a dark circle holding one of our line icons, the name beside it
  function glyphChip(c, S, x, y, label, px, k, side) {
    if (k <= 0.01) return null;
    const tw = L.textW(c, S.look, label, { role: 'ui', px, weight: 600 }), h = px * 2.4, w = tw + h + px * 1.1, x0 = side < 0 ? x - w : x;
    c.save(); scaleAbout(c, x0 + w / 2, y, k); c.globalAlpha *= clamp(k * 1.5);
    L.card(c, x0, y - h / 2, w, h, h / 2, { fill: cardFill(S), u: S.u, lift: 0.5 });
    L.circle(c, x0 + h / 2, y, h * 0.33, isDark(S) ? mix(S.P.bg, '#FFFFFF', 0.2) : S.P.fg);
    L.icon(c, L.iconFor(label), x0 + h / 2, y, h * 0.38, isDark(S) ? '#FFFFFF' : S.P.bg, 2.1);
    L.text(c, S.look, label, x0 + h + px * 0.2, y + px * 0.36, { role: 'ui', px, weight: 600, color: isDark(S) ? '#F2F2F2' : S.P.fg });
    c.restore();
    return { x0, w, h, inner: side < 0 ? x0 + w : x0 };
  }

  /* ───────── set-ups ───────── */
  const T = (b, F, t0, id) => { const p = L.get(id || b.type) || L.get('effect:type-mask-rise'); return p.plan(b, F, t0); };

  /* billboard + ball: one giant word slides in from the right with ghosts; a glossy accent ball drops and bounces as its full stop */
  L.def('insert:billboard-ball-period', {
    kind: 'setup',
    plan(b, F) { const head = b.text && b.text.eyebrow ? 0.3 : 0.05, tp = T(b, F, head, 'effect:type-billboard-ghost-slide'), ball0 = head + 0.62; return { cues: { eyebrow: 0, head, headDone: tp.done, ball: ball0, land: ball0 + 0.12 }, events: [...tp.events, { at: ball0 + 0.12, event: 'pop' }, { at: ball0 + 0.43, event: 'accent' }], exit: { kind: 'dot', x: 0.82, y: 0.6, r: 0.05 }, min: ball0 + 1.4 }; },
    draw(S) {
      const b = S.b, c = S.ctx, tokens = trimStop(toks(b)); if (!tokens.length) return;
      const n = tokens.length, tl = isTall(S), ml = n > 2 ? (tl ? 4 : 3) : n, px = Math.min(S.H * (n === 1 ? 0.56 : 0.4), S.W * (tl ? 0.3 : 0.34)), maxW = S.W * 0.84 - px * 0.25;
      const lay0 = L.layout(c, S.look, tokens, { px, maxW, x: S.W / 2, y: 0, align: 'center', maxLines: ml, min: px * 0.2 });
      const top = S.H / 2 - lay0.H / 2 - lay0.px * 0.06, shift = -lay0.px * 0.13;
      if (b.text.eyebrow) bracketCaption(S, tokOf(b.text.eyebrow), S.W / 2, top - 70 * S.u, 30 * S.u, S.at('eyebrow'), { maxW: S.W * 0.7, maxLines: 1 });
      const lay = L.headline(S, { px, maxW, x: S.W / 2 + shift, y: top, align: 'center', maxLines: ml, min: px * 0.2 }, { tokens, type: 'effect:type-billboard-ghost-slide' });
      const last = lay.words[lay.words.length - 1], r = lay.px * 0.1, bx = last.x + last.w + r * 1.25, floor = last.y;
      const bb = bounce(S.lt - S.at('ball'), r, 0.12, (floor + r) / r);
      if (bb.up !== Infinity) ball(c, S, bx, floor - r - bb.up, r, { floor, sx: 1 / Math.sqrt(bb.sq), sy: bb.sq });
      markExit(S, bx, floor - r, r);
    },
  });

  /* year odometer over echo rows: a bracket caption types, its echo drifts behind, a huge year rolls back and the ball lands as its stop, then greys */
  L.def('insert:year-odometer-echo', {
    kind: 'setup',
    plan(b, F) { const tp = T(b, F, 0.05, 'effect:type-bracket-typer'), roll = 0.4, land = roll + 1.75; return { cues: { head: 0.05, headDone: tp.done, roll, land, grey: land + 0.35 }, events: [...tp.events, { at: roll, event: 'riffle' }, { at: land, event: 'stat' }, { at: land + 0.02, event: 'pop' }, { at: land + 0.35, event: 'click-ui' }], exit: { kind: 'dot', x: 0.72, y: 0.62, r: 0.03 }, min: land + 1.1 }; },
    draw(S) {
      const b = S.b, c = S.ctx, n = numOf(b) || { value: 2014 }, tall = isTall(S);
      const to = typeof n.value === 'number' ? n.value : 0, year = Number.isInteger(to) && to > 1900 && to < 2100 && !n.prefix && !n.suffix;
      const px = Math.min(S.H * 0.36, S.W * (tall ? 0.3 : 0.24)), cpx = 42 * S.u, capY = S.H / 2 - px * 0.62 - cpx;
      L.get('texture:echo-marquee-rows').draw(S, { y: S.H / 2, rows: Math.ceil(S.H / (cpx * 1.6)) + 1, text: joinT(toks(b)), px: cpx * 0.92 });
      const lay = bracketCaption(S, toks(b), S.W / 2, capY - cpx * 0.8, cpx, S.at('head'), { maxW: S.W * (tall ? 0.8 : 0.66), maxLines: 2 });
      const top = (lay ? lay.bottom : capY) + 34 * S.u;
      const from = year ? to + 12 : 0, k = (year ? E.settle : E.out)(prog(S.lt, S.at('roll'), 1.75)), v = lerp(from, to, k);
      const a = appear(S, S.at('roll') - 0.1, 0.3); if (a <= 0) return;
      const base = top + px * 0.8, col = mix(grey(S, 0.75), S.P.fg, k);
      c.save(); c.globalAlpha *= a;
      const sufPx = px * 0.45;
      const r = odometer(c, S, v, S.W / 2, base, { px, final: Math.max(from, to), prefix: n.prefix, suffix: n.suffix, sufPx, color: col, commas: !year });
      c.restore();
      // the stop: the ball lands on the baseline after the number, then (a year: the past) goes grey
      const rr = px * 0.1, bx = r.x0 + r.w + rr * 1.3, bb = bounce(S.lt - (S.at('land') - 0.12), rr, 0.12, 8);
      if (bb.up !== Infinity) ball(c, S, bx, base - rr - bb.up, rr, { floor: base, sx: 1 / Math.sqrt(bb.sq), sy: bb.sq, grey: year ? E.out(prog(S.lt, S.at('grey'), 0.4)) : 0 });
      markExit(S, bx, base - rr, rr);
      if (n.label && !year) { const lk = appear(S, S.at('land') + 0.2, 0.4); if (lk > 0) { c.save(); c.globalAlpha *= lk; L.text(c, S.look, n.label, S.W / 2, base + px * 0.42, { role: 'micro', px: 22 * S.u, color: S.P.dim, align: 'center', upper: true, maxW: S.W * 0.8 }); c.restore(); } }
    },
  });

  /* stuck wizard: a bracket caption over a big import wizard whose bar creeps to 99% and freezes */
  L.def('insert:stuck-import-wizard', {
    kind: 'setup',
    plan(b, F) { const tp = T(b, F, 0.05, 'effect:type-bracket-typer'); return { cues: { head: 0.05, headDone: tp.done, card: 0.2, step: 1.1, stuck: 2.2 }, events: [...tp.events, { at: 0.2, event: 'card-in' }, { at: 1.1, event: 'list-item' }, { at: 2.2, event: 'click-ui' }], exit: { kind: 'rect', x: 0.5, y: 0.58, w: 0.62, h: 0.62 }, min: 3.4 }; },
    draw(S) {
      const b = S.b, wide = isWide(S), tall = isTall(S), cpx = 40 * S.u;
      const lay = bracketCaption(S, toks(b), S.W / 2, S.H * (tall ? 0.1 : 0.07), cpx, S.at('head'), { maxW: S.W * 0.78, maxLines: 2 });
      const top = (lay ? lay.bottom : S.H * 0.1) + 44 * S.u, w = S.W * (wide ? 0.7 : 0.9), h = Math.min(S.H - top - 44 * S.u, wide ? w * 0.6 : tall ? w * 1.1 : w * 0.72);
      const d = b.data || {}, ui = d.ui || {};
      wizard(S, { x: S.W / 2, y: top + h / 2, w, h, t0: S.at('card'), steps: itemsOf(b).slice(0, 4), title: ui.title || (b.text && b.text.eyebrow) || '', doneAt: S.at('step') - S.at('card') });
    },
  });

  /* hollow dot matrix: a full-bleed dot field blooms out of the centre around a label window; the stat's share of dots empties to rings; a wave recolours them */
  L.def('insert:hollow-dot-matrix', {
    kind: 'setup',
    plan(b, F) { const n = numOf(b), hasSub = !!(b.text && b.text.sub); const hollow = 1.9, wipe = hollow + 1.7; return { cues: { bloom: 0.08, label: 0.7, hollow, label2: hollow, wipe, label3: wipe }, events: [{ at: 0.08, event: 'build' }, { at: 0.7, event: 'word' }, { at: hollow, event: 'stat' }, { at: hollow + 0.3, event: 'cascade' }, { at: wipe, event: 'hard-hit' }, ...(hasSub ? [{ at: wipe + 0.1, event: 'word' }] : [])], exit: { kind: 'rect', x: 0.5, y: 0.5, w: 0.5, h: 0.1 }, entry: { kind: 'dot', x: 0.5, y: 0.5, r: 0.01 }, min: wipe + 1.4 }; },
    draw(S) {
      const b = S.b, c = S.ctx, n = numOf(b), pct = n && (/%/.test(n.suffix || '') || (n.value > 1 && n.value <= 100 && !n.prefix && !n.suffix)) ? n.value / 100 : 0.8;
      const pitch = Math.max(S.W, S.H) / (isWide(S) ? 31 : 22), dotR = pitch * 0.315, cols = Math.ceil(S.W / pitch) + 1, rows = Math.ceil(S.H / pitch) + 1;
      const ox = (S.W - (cols - 1) * pitch) / 2 + Math.sin(S.lt * 0.45) * 3 * S.u, oy = (S.H - (rows - 1) * pitch) / 2 + Math.cos(S.lt * 0.4) * 2 * S.u;
      // the label: three phases (headline → the number line → the sub with its accent tail)
      const phases = [toks(b)];
      if (n) phases.push([{ s: `${n.prefix || ''}${n.value}${n.suffix || ''}`, accent: true }, ...tokOf(n.label || '')]);
      if (b.text && b.text.sub) phases.push(withTail(tokOf(b.text.sub), 3));
      const cue = ['label', 'label2', 'label3'], tpx = Math.max(30 * S.u, pitch * 0.62), maxTW = S.W * 0.78;
      const lays = phases.map(p => L.layout(c, S.look, p.length ? p : [{ s: ' ' }], { role: 'ui', px: tpx, maxW: maxTW, x: S.W / 2, y: S.H / 2 - tpx * 0.62, align: 'center', maxLines: 1, space: 0.27 }));
      const tw = Math.max(...lays.map(l => l.W)), wc = Math.ceil((tw + pitch * 1.6) / pitch), hc = 2;
      const winW = wc * pitch, winH = hc * pitch, wx = S.W / 2 - winW / 2, wy = S.H / 2 - winH / 2;
      const bk = E.out(prog(S.lt, S.at('bloom'), 0.85)), R = bk * 1.45, wipeK = prog(S.lt, S.at('wipe'), 0.8), front = lerp(-4, cols + 4, wipeK);
      const darkAcc = mix(S.P.accent, S.P.fg, 0.55);
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        const x = ox + i * pitch, y = oy + j * pitch;
        if (x > wx - pitch * 0.2 && x < wx + winW + pitch * 0.2 && y > wy - pitch * 0.2 && y < wy + winH + pitch * 0.2) continue;
        const id = j * 97 + i, ed = Math.hypot((x - S.W / 2) / (S.W * 0.5), (y - S.H / 2) / (S.H * 0.5) * 0.75), sz = clamp((R - ed) / 0.28);
        if (sz <= 0.02) continue;
        const jx = noise(S.lt * 0.7 + id * 0.37, 2) * 0.9 * S.u, jy = noise(S.lt * 0.6 + id * 0.53, 5) * 0.9 * S.u;
        const hollow = rand(id + 41) < pct, hs = S.at('hollow') + rand(id + 9) * 1.3, hk = hollow ? E.out(prog(S.lt, hs, 0.16)) : 0;
        const wk = clamp((front - i) / 4), col = wk <= 0 ? S.P.fg : wk < 0.5 ? mix(S.P.fg, darkAcc, wk * 2) : mix(darkAcc, S.P.accent, (wk - 0.5) * 2);
        const r = dotR * sz;
        if (hk > 0) { L.circle(c, x + jx, y + jy, r - 1.6 * S.u, null, col, 3.2 * S.u * sz); const ir = r * (1 - hk); if (ir > 0.4) L.circle(c, x + jx, y + jy, ir, col); }
        else L.circle(c, x + jx, y + jy, r, hollow ? col : (wk > 0 ? mix(S.P.fg, darkAcc, wk) : col));
      }
      // the label window's text: each phase types in; the previous one fades out
      phases.forEach((p, pi) => {
        const at = S.at(cue[pi]), next = pi < phases.length - 1 ? S.at(cue[pi + 1]) : 1e9; if (S.lt < at || !p.length) return;
        const out = 1 - E.out(prog(S.lt, next - 0.12, 0.12)); if (out <= 0) return;
        c.save(); c.globalAlpha *= out; typeWords(S, lays[pi], at + 0.05, 45, { ghost: 0 }); c.restore();
      });
    },
  });

  /* slot bill: a shimmering status line on the left; a reel of rising values steps up on the 8ths and the last lands in accent with a ring */
  L.def('insert:slot-bill-roll', {
    kind: 'setup',
    plan(b, F) { const n = numOf(b) || { value: 612 }, steps = reelValues(n).length - 1, first = 0.45, land = first + (steps - 1) * 0.25 + 0.14; return { cues: { reel: 0.05, first, land, label: 0.1, label2: land + 0.1, head: 0.1, headDone: 0.5 }, events: [{ at: 0.05, event: 'card-in' }, { at: 0.1, event: 'ui-reveal' }, ...Array.from({ length: steps }, (_, i) => ({ at: first + i * 0.25, event: 'click-ui' })), { at: land, event: 'hard-hit' }, { at: land + 0.05, event: 'stat' }], exit: { kind: 'dot', x: 0.66, y: 0.5, r: 0.02 }, min: land + 1.3 }; },
    draw(S) {
      const b = S.b, c = S.ctx, n = numOf(b) || { value: 612, prefix: '$' }, wide = isWide(S), tall = isTall(S);
      const rx = wide ? S.W * 0.66 : S.W / 2, ry = wide ? S.H / 2 : S.H * (tall ? 0.56 : 0.6), px = Math.min(S.H * (wide ? 0.21 : 0.17), S.W * (wide ? 0.13 : 0.2));
      // the reel's window: two hairlines with accent ticks frame the centre row (the payline)
      const wk = E.out(prog(S.lt, S.at('reel') + 0.1, 0.6)), ww = Math.min(S.W * (wide ? 0.5 : 0.86), px * 4.4) * wk, wy = px * 0.66;
      if (wk > 0) [-1, 1].forEach(sg => { L.line(c, rx - ww / 2, ry + sg * wy, rx + ww / 2, ry + sg * wy, rgba(S.P.fg, 0.14), 1.5 * S.u); L.line(c, rx - ww / 2, ry + sg * wy, rx - ww / 2 + 22 * S.u, ry + sg * wy, S.P.accent, 3 * S.u); L.line(c, rx + ww / 2 - 22 * S.u, ry + sg * wy, rx + ww / 2, ry + sg * wy, S.P.accent, 3 * S.u); });
      const res = reel(c, S, { number: n, x: rx, y: ry, px, t0: S.at('reel'), first: S.at('first') - S.at('reel') });
      // the ring burst behind the landed value
      const rk = prog(S.lt, S.at('land'), 0.55);
      if (rk > 0 && rk < 1) { [0, 0.12].forEach(dl => { const k = prog(S.lt, S.at('land') + dl, 0.5); if (k > 0 && k < 1) L.circle(c, rx - px * 0.9, ry, lerp(px * 0.3, px * 1.5, E.out(k)), null, rgba(S.P.accent, 0.5 * (1 - k)), lerp(3, 0.8, k) * S.u); }); }
      // the status line: shimmer while it rolls, then the verdict (headline, accent tail)
      const eb = b.text && b.text.eyebrow, p1 = eb ? tokOf(eb.replace(/[.…]+$/, '') + '…') : toks(b), p2 = eb ? toks(b) : (b.text && b.text.sub ? tokOf(b.text.sub) : null);
      const lpx = (wide ? 54 : 46) * S.u, lx = wide ? S.W * 0.07 + lpx * 0.9 : S.W / 2, ly = wide ? S.H / 2 - lpx * 0.6 : S.H * (tall ? 0.14 : 0.1), lmax = wide ? S.W * 0.32 : S.W * 0.8;
      const opt = { role: 'ui', px: lpx, maxW: lmax, x: lx, y: ly, align: wide ? 'left' : 'center', maxLines: 2, space: 0.27 };
      const out1 = p2 ? 1 - E.out(prog(S.lt, S.at('label2') - 0.1, 0.15)) : 1;
      if (out1 > 0) { c.save(); c.globalAlpha *= out1; L.get('effect:type-shimmer-thinking').draw(S, { lay: L.layout(c, S.look, p1, opt), t0: S.at('label') }); c.restore(); }
      if (p2 && S.lt > S.at('label2')) L.get('effect:type-word-blur-rise').draw(S, { lay: L.layout(c, S.look, withTail(p2, 3), opt), t0: S.at('label2') });
    },
  });

  /* terminal vs the old tool: the agent types, the grey window fades in, packets run the dashed link, an error disc breaks it, the terminal jolts */
  L.def('insert:terminal-error-link', {
    kind: 'setup',
    plan(b, F) {
      const tp = T(b, F, 0.05, 'effect:type-bracket-typer'), cmd = (b.data && b.data.prompt) || '', type = 0.55, typed = type + Math.min(1.8, cmd.length / 24), legacy = typed + 0.15, packets = legacy + 0.35, error = packets + 0.9;
      return { cues: { head: 0.05, headDone: tp.done, term: 0.15, type, typed, legacy, packets, error }, events: [...tp.events, { at: 0.15, event: 'card-in' }, { at: type, event: 'code' }, { at: legacy, event: 'ui-reveal' }, { at: packets, event: 'pop' }, { at: error, event: 'hard-hit' }, { at: error + 0.05, event: 'pop' }], exit: { kind: 'dot', x: 0.5, y: 0.56, r: 0.03 }, min: error + 1.5 };
    },
    draw(S) {
      const b = S.b, c = S.ctx, wide = isWide(S), cpx = 38 * S.u, B = brand();
      bracketCaption(S, toks(b), S.W / 2, S.H * (wide ? 0.09 : 0.08), cpx, S.at('head'), { maxW: S.W * 0.8, maxLines: 2 });
      const cmd = (b.data && b.data.prompt) || '', err = (b.data && b.data.error) || (b.text && b.text.sub) || 'no response';
      const cps = Math.max(24, cmd.length / 1.8), er = S.at('error'), dt = S.lt - er, shake = dt > 0 && dt < 0.4 ? 9 * S.u * Math.exp(-dt * 9) * Math.sin(dt * 60) : 0;
      let tA, lB, a, bpt;
      if (wide) { const tw = S.W * 0.46, th = Math.min(tw * 0.6, S.H * 0.62), cy = S.H * 0.58; tA = { x: S.W * 0.29, y: cy, w: tw, h: th }; lB = { x: S.W * 0.8, y: cy, w: S.W * 0.3, h: th * 0.92 }; a = { x: tA.x + tw / 2 + 14 * S.u, y: cy }; bpt = { x: lB.x - lB.w / 2 - 14 * S.u, y: cy }; }
      else { const tw = S.W * 0.84, th = Math.min(tw * 0.5, S.H * 0.3); tA = { x: S.W / 2, y: S.H * (isTall(S) ? 0.36 : 0.36), w: tw, h: th }; lB = { x: S.W / 2, y: S.H * (isTall(S) ? 0.78 : 0.8), w: tw * 0.8, h: th * 0.75 }; a = { x: S.W / 2, y: tA.y + th / 2 + 14 * S.u }; bpt = { x: S.W / 2, y: lB.y - lB.h / 2 - 14 * S.u }; }
      legacy(S, { x: lB.x, y: lB.y, w: lB.w, h: lB.h, t0: S.at('legacy'), title: '' });
      const lk = E.out(prog(S.lt, S.at('legacy') + 0.2, 0.4));
      dashedLink(c, S, a, bpt, { k: lk, packetsAt: S.at('packets'), blockAt: er, stopAt: 0.5, n: 2, speed: 1.1 });
      terminal(S, { x: tA.x, y: tA.y, w: tA.w, h: tA.h, t0: S.at('term'), cmd, typeAt: S.at('type'), cps, shake, title: slugOf(B.name), lines: [{ s: `→ ${B.host || ''}`.trim(), dim: true, at: S.at('typed') + 0.1 }, { s: `✕ ${err}`, err: true, at: er + 0.08 }] });
      const mx = (a.x + bpt.x) / 2, my = (a.y + bpt.y) / 2;
      errorDisc(c, S, mx, my, Math.min(96 * S.u, S.W * 0.07), er);
      markExit(S, mx, my, Math.min(96 * S.u, S.W * 0.07) / 2);
    },
  });

  /* giant ellipsis, pulled back: the first word huge and cropped, its dots tick in on the 8ths (the third is the ball), then a pull back to the whole line */
  L.def('insert:giant-ellipsis-pullback', {
    kind: 'setup',
    plan(b, F) { const n = toks(b).length, pull = 1.05, rest = pull + 0.38; return { cues: { d1: 0.15, d2: 0.4, d3: 0.65, pull, rest, head: rest, headDone: rest + Math.max(0, n - 1) * 0.1 + 0.4 }, events: [{ at: 0.15, event: 'pop' }, { at: 0.4, event: 'pop' }, { at: 0.65, event: 'accent' }, { at: pull, event: 'slide-out' }, ...(n > 1 ? [{ at: rest, event: 'word' }] : [])], exit: { kind: 'dot', x: 0.5, y: 0.5, r: 0.02 }, min: rest + 1.2 }; },
    draw(S) {
      const b = S.b, c = S.ctx, tk = toks(b); if (!tk.length) return;
      const first = tk[0].s.replace(/[.,!?…]+$/, ''), rest = trimStop(tk.slice(1)), spx = (isWide(S) ? 92 : 84) * S.u;
      const tokens = [{ s: first + '...' }, ...rest];
      const lay = L.layout(c, S.look, tokens, { px: spx, maxW: S.W * 0.84, x: S.W / 2, y: S.H / 2 - spx * 0.6, align: 'center', maxLines: 2 });
      const w0 = lay.words[0], px = lay.px; L.setFont(c, S.look, w0.role, w0.px); try { c.letterSpacing = w0.tr.toFixed(2) + 'px'; } catch (e) { /* */ }
      const fw = c.measureText(first).width; try { c.letterSpacing = '0px'; } catch (e) { /* */ }
      const dotsW = w0.w - fw, dr = px * 0.072, dotX = i => w0.x + fw + dotsW * (0.2 + i * 0.32), dotY = w0.y - dr;
      const pivot = { x: w0.x + fw, y: w0.y };
      const G = Math.min(S.H * 0.66, S.W * 0.62) / px, gp = { x: S.W * (isWide(S) ? 0.42 : isTall(S) ? 0.5 : 0.4), y: S.H * (isTall(S) ? 0.58 : 0.66) };
      const k = E.io(prog(S.lt, S.at('pull'), 0.38)), s = L.logLerp(G, 1, k), pp = { x: lerp(gp.x, pivot.x, k), y: lerp(gp.y, pivot.y, k) };
      const vel = Math.abs(L.logLerp(G, 1, E.io(prog(S.lt + 1 / 60, S.at('pull'), 0.38))) - s);
      c.save(); c.translate(pp.x, pp.y); c.scale(s, s); c.translate(-pivot.x, -pivot.y);
      if (vel > 0.05) c.filter = `blur(${Math.min(10, vel * 8).toFixed(1)}px)`;
      const gk = E.out(prog(S.lt, S.at('rest') + 0.2, 0.5));
      L.drawWord(c, S.look, S.P, Object.assign({}, w0, { s: first }), { fill: mix(S.P.fg, grey(S, 0.4), gk) });
      for (let i = 0; i < 3; i++) {
        const at = S.at('d' + (i + 1)), pk = pop(S, at); if (pk <= 0) continue;
        if (i < 2) L.circle(c, dotX(i), dotY, dr * pk, mix(S.P.fg, grey(S, 0.4), gk));
        else { const r = dr * 1.35; c.save(); scaleAbout(c, dotX(i), w0.y - r, pk); ball(c, S, dotX(i), w0.y - r, r, { floor: w0.y }); c.restore(); }
      }
      c.restore();
      // the rest of the sentence arrives once the camera has pulled back
      if (rest.length && S.lt > S.at('rest')) {
        const sub = Object.assign({}, lay, { words: lay.words.slice(1).map((w, i) => Object.assign({}, w, { i })) });
        L.get('effect:type-word-blur-rise').draw(S, { lay: sub, t0: S.at('rest') });
      }
      const r3 = dr * 1.35, bx = dotX(2), by = w0.y - r3, sp = { x: (bx - pivot.x) * s + pp.x, y: (by - pivot.y) * s + pp.y };
      markExit(S, sp.x, sp.y, r3 * s);
    },
  });

  /* ball swallows the line and bursts into the app icon: it rolls along the baseline eating each word, swells, bursts with specks and a ring, squashes into the squircle and the glyph wipes on */
  L.def('insert:ball-burst-icon', {
    kind: 'setup',
    plan(b, F) { return { cues: { roll: 0.35, gather: 1.0, burst: 1.25, morph: 1.33, glyph: 1.5, name: 1.85 }, events: [{ at: 0.35, event: 'slide-out' }, { at: 0.95, event: 'build' }, { at: 1.25, event: 'hard-hit' }, { at: 1.35, event: 'pop' }, { at: 1.55, event: 'accent' }], exit: { kind: 'rect', x: 0.5, y: 0.47, w: 0.16, h: 0.28 }, entry: { kind: 'dot', x: 0.5, y: 0.5, r: 0.02 }, min: 2.9 }; },
    draw(S) {
      const b = S.b, c = S.ctx, tk = trimStop(toks(b)), cx = S.W / 2, cy = S.H * 0.47, size = Math.min(S.W, S.H) * 0.28;
      const spx = (isWide(S) ? 120 : 100) * S.u, lay = tk.length ? L.layout(c, S.look, tk, { px: spx, maxW: S.W * 0.8, x: cx, y: S.H / 2 - spx * 0.6, align: 'center', maxLines: 2 }) : null;
      const r0 = spx * 0.16, base = lay ? lay.words[lay.words.length - 1].y : cy, bxEnd = lay ? bounds(lay).x1 + r0 * 2 : cx;
      const rk = E.io(prog(S.lt, S.at('roll'), S.at('gather') - S.at('roll'))), bx = lerp(-r0 * 2, bxEnd, rk);
      // the words: each one is pulled into the ball as it passes
      if (lay) for (const w of lay.words) {
        const wc = w.x + w.w / 2, eaten = clamp((bx - wc) / (spx * 1.2) + 0.2), e = E.in(eaten); if (e >= 1) continue;
        c.save(); c.globalAlpha *= 1 - e; const tx = lerp(wc, bx, e), ty = lerp(w.y - spx * 0.35, base - r0, e); scaleAbout(c, tx, ty, 1 - e * 0.85);
        L.drawWord(c, S.look, S.P, w, { x: w.x + (tx - wc), y: w.y + (ty - (w.y - spx * 0.35)) });
        c.restore();
      }
      const gk = E.io(prog(S.lt, S.at('gather'), S.at('burst') - S.at('gather'))), burst = S.at('burst');
      const swell = lerp(r0, r0 * 2.2, rk), r = lerp(swell, size * 0.42, gk), x = lerp(bx, cx, gk), y = lerp(base - swell, cy, gk);
      if (S.lt < burst) { const roll = (S.lt - S.at('roll')) * 9; ball(c, S, x, y, r, { floor: lerp(base, cy + size * 0.62, gk) }); void roll; return; }
      // burst: specks with drag, a shockwave ring, then the squircle and its glyph
      const dt = S.lt - burst;
      const ringK = prog(dt, 0, 0.6); if (ringK < 1) L.circle(c, cx, cy, lerp(size * 0.45, size * 2.4, E.out(ringK)), null, rgba(S.P.accent, 0.5 * (1 - ringK)), lerp(4, 1, ringK) * S.u);
      for (let i = 0; i < 40; i++) {
        const a = rand(i + 3) * Math.PI * 2, sp = size * (1.1 + rand(i + 11) * 2.2), d = sp * (1 - Math.exp(-dt * 4.5)) / 1, life = clamp(1 - dt / (0.55 + rand(i + 5) * 0.5));
        if (life <= 0) continue;
        L.circle(c, cx + Math.cos(a) * (size * 0.4 + d), cy + Math.sin(a) * (size * 0.4 + d) + dt * dt * 120 * S.u, (2 + rand(i + 19) * 3.5) * S.u * life, i % 3 ? S.P.accent : S.P.fg);
      }
      const sq = spring(S.lt - S.at('morph'), 'pop'), m = E.out(prog(S.lt, S.at('morph'), 0.16)), s = lerp(size * 0.84, size, clamp(sq, 0, 1.2));
      const breathe = 1 + Math.sin(Math.max(0, S.lt - S.at('name')) * 1.4) * 0.006;
      c.save(); scaleAbout(c, cx, cy, breathe, breathe * (1 + (1 - clamp(sq)) * -0.12));
      iconTile(c, S, cx, cy, s, { morph: m, glyph: E.ramp(prog(S.lt, S.at('glyph'), 0.28)) }); c.restore();
      const fl = cy + size * 0.62; c.save(); c.translate(cx, fl); c.scale(1, 0.12); const g = c.createRadialGradient(0, 0, 0, 0, 0, size * 0.6); g.addColorStop(0, 'rgba(0,0,0,0.22)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(-size, -size, size * 2, size * 2); c.restore();
      const nk = appear(S, S.at('name'), 0.5);
      if (nk > 0) { c.save(); c.globalAlpha *= nk; L.text(c, S.look, brand().name, cx, cy + size * 0.88 + (1 - nk) * 14 * S.u, { role: 'wordmark', px: size * 0.26, weight: 760, color: S.P.fg, align: 'center', tracking: -0.04, maxW: S.W * 0.8 }); c.restore(); }
    },
  });

  /* icon slides, wordmark wipes: the centred icon slides left as the wordmark wipes out from behind it, the tagline types with an accent tail */
  L.def('insert:icon-wordmark-wipe', {
    kind: 'setup',
    plan(b, F) { const tg = brand().tagline || joinT(toks(b)); return { cues: { icon: 0.0, slide: 0.35, tag: 0.95 }, events: [{ at: 0, event: 'pop' }, { at: 0.35, event: 'build' }, { at: 0.95, event: 'word' }], entry: { kind: 'dot', x: 0.5, y: 0.45, r: 0.04 }, exit: { kind: 'dot', x: 0.5, y: 0.45, r: 0.04 }, min: 1.2 + Math.min(1.6, tg.length / 40) + 0.8 }; },
    draw(S) {
      const c = S.ctx, B = brand(), name = B.name || 'Brand', px = Math.min(S.H * 0.17, S.W * 0.13) * (name.length > 8 ? 8 / name.length : 1), y = S.H * 0.45;
      const mw = L.textW(c, S.look, name, { role: 'wordmark', px, weight: 800, tracking: -0.05 }), iconS = px * 1.06, gap = px * 0.3, total = iconS + gap + mw, x0 = S.W / 2 - total / 2;
      const k = E.expo(prog(S.lt, S.at('slide'), 0.7)), ix = lerp(S.W / 2, x0 + iconS / 2, k), ip = pop(S, S.at('icon'));
      // the wordmark, clipped to the right of the icon, from behind it with a blur
      const mx = x0 + iconS + gap, edge = ix + iconS / 2 + gap * 0.3;
      if (k > 0) { c.save(); c.beginPath(); c.rect(edge, y - px * 1.2, S.W, px * 1.6); c.clip(); const bl = (1 - k) * 8 * S.u; if (bl > 0.4) c.filter = `blur(${bl.toFixed(1)}px)`; L.text(c, S.look, name, lerp(mx - mw * 0.55, mx, k), y + px * 0.34, { role: 'wordmark', px, weight: 800, color: S.P.fg, tracking: -0.05 }); c.restore(); }
      if (ip > 0) { c.save(); scaleAbout(c, ix, y, ip); iconTile(c, S, ix, y, iconS, { morph: 1, glyph: 1 }); c.restore(); }
      const tg = B.tagline || joinT(toks(S.b)); if (!tg) return;
      const tl = L.layout(c, S.look, withTail(tokOf(tg), 2), { role: 'ui', px: Math.max(28 * S.u, px * 0.24), maxW: S.W * 0.82, x: S.W / 2, y: y + px * 0.85, align: 'center', maxLines: 2, space: 0.27 });
      typeWords(S, tl, S.at('tag'), 40, { ghost: 0 });
    },
  });

  /* agents wired to the hub: the icon in dotted orbit rings, S-curve wires to four neutral glyph chips, accent packets running in, a mono counter pill */
  L.def('insert:agent-hub-wires', {
    kind: 'setup',
    plan(b, F) { const tp = T(b, F, 0.05), n = Math.min(4, itemsOf(b).length || 4), ch = [0.45, 0.7, 1.2, 1.45].slice(0, n); return { cues: { head: 0.05, headDone: tp.done, hub: 0.2, chip0: ch[0], chip1: ch[1] || 0.7, chip2: ch[2] || 1.2, chip3: ch[3] || 1.45, packets: 1.3, counter: 1.8 }, events: [...tp.events, { at: 0.2, event: 'pop' }, ...ch.map(at => ({ at, event: 'list-item' })), { at: 1.8, event: 'stat' }], exit: { kind: 'dot', x: 0.5, y: 0.54, r: 0.04 }, entry: { kind: 'dot', x: 0.5, y: 0.54, r: 0.04 }, min: 3.4 }; },
    draw(S) {
      const b = S.b, c = S.ctx, wide = isWide(S), tall = isTall(S), its = itemsOf(b).slice(0, 4), n = its.length || 0;
      L.headline(S, { px: (wide ? 76 : 68) * S.u, maxW: S.W * 0.84, x: S.W / 2, y: S.H * (tall ? 0.1 : 0.08), align: 'center', maxLines: 2 });
      const cx = S.W / 2, cy = S.H * (tall ? 0.52 : 0.55), m = Math.min(S.W, S.H), hub = m * (tall ? 0.17 : 0.16), hk = pop(S, S.at('hub'));
      // orbit rings: dotted, slowly turning
      [0.2, 0.32].forEach((rr, i) => { const rk = appear(S, S.at('hub') + 0.1 + i * 0.1, 0.6); if (rk <= 0) return; c.save(); c.globalAlpha *= rk; c.strokeStyle = rgba(S.P.fg, 0.18); c.lineWidth = 1.6 * S.u; c.setLineDash([2 * S.u, 9 * S.u]); c.lineDashOffset = S.lt * (i ? -12 : 16) * S.u; c.beginPath(); c.arc(cx, cy, m * rr * lerp(0.9, 1, rk), 0, Math.PI * 2); c.stroke(); c.restore(); });
      L.circle(c, cx, cy, m * 0.17, rgba(S.P.accent, 0.05 * hk));
      const px = (wide ? 38 : tall ? 34 : 30) * S.u, dx = wide ? S.W * 0.31 : S.W * 0.05, dy = wide ? S.H * 0.19 : tall ? S.H * 0.17 : S.H * 0.22;
      const slots = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
      let pulse = 0;
      its.forEach((s, i) => {
        const [sx, sy] = slots[i], at = S.at('chip' + i), ck = pop(S, at);
        const chx = wide ? cx + sx * dx : sx < 0 ? dx : S.W - dx, chy = cy + sy * dy;
        const ch = glyphChip(c, S, chx, chy, s, px, ck, sx < 0 ? 1 : -1); if (!ch) return;
        // the wire: an S-curve from the chip's inner edge to the hub, drawn on
        const a = { x: sx < 0 ? ch.x0 + ch.w + 8 * S.u : ch.x0 - 8 * S.u, y: chy }, e = { x: cx + sx * hub * 0.62, y: cy + sy * hub * 0.32 };
        const p1 = { x: lerp(a.x, e.x, 0.55), y: a.y }, p2 = { x: lerp(a.x, e.x, 0.45), y: e.y }, wk = E.io(prog(S.lt, at + 0.1, 0.5));
        const bz = u => ({ x: (1 - u) ** 3 * a.x + 3 * (1 - u) ** 2 * u * p1.x + 3 * (1 - u) * u * u * p2.x + u ** 3 * e.x, y: (1 - u) ** 3 * a.y + 3 * (1 - u) ** 2 * u * p1.y + 3 * (1 - u) * u * u * p2.y + u ** 3 * e.y });
        if (wk > 0) { c.save(); c.strokeStyle = rgba(S.P.fg, 0.22); c.lineWidth = 2 * S.u; c.beginPath(); for (let q = 0; q <= 40 * wk; q++) { const p = bz(q / 40); if (q) c.lineTo(p.x, p.y); else c.moveTo(p.x, p.y); } c.stroke(); c.restore(); L.circle(c, a.x, a.y, 4 * S.u, rgba(S.P.fg, 0.35)); }
        if (wk >= 1) { const pt = S.lt - S.at('packets') - i * 0.13; if (pt > 0) for (let q = 0; q < 2; q++) { const u = (pt * 1.1 + q * 0.5) % 1, p = bz(E.io(u)); L.circle(c, p.x, p.y, 5 * S.u, S.P.accent); L.circle(c, p.x, p.y, 10 * S.u, rgba(S.P.accent, 0.15)); if (u > 0.9) pulse = Math.max(pulse, (u - 0.9) / 0.1); } }
      });
      if (hk > 0) { c.save(); scaleAbout(c, cx, cy, hk * (1 + pulse * 0.03)); iconTile(c, S, cx, cy, hub, { morph: 1, glyph: 1 }); c.restore(); }
      if (pulse > 0) L.circle(c, cx, cy, hub * (0.62 + pulse * 0.25), null, rgba(S.P.accent, 0.4 * (1 - pulse)), 2 * S.u);
      const nb = numOf(b);
      if (nb && typeof nb.value === 'number') counterPill(c, S, cx, cy + Math.max(dy, m * 0.27) + px * 2.6, { t0: S.at('counter'), from: Math.round(nb.value * 0.72), to: nb.value, prefix: nb.prefix, suffix: nb.suffix, label: nb.label, px: 24 * S.u });
    },
  });

  /* a query filters the grid: an agent panel types the question, the dot grid answers (matches in accent, a count, a tag), the matches stream into a workflow pill that ticks */
  L.def('insert:query-grid-workflow', {
    kind: 'setup',
    plan(b, F) { const q = (b.data && b.data.prompt) || '', type = 0.35, typed = type + Math.min(1.6, q.length / 26), found = typed + 0.2, tag = found + 0.5, stream = found + 0.95, tick = stream + 0.8; return { cues: { head: 0.0, headDone: 0.4, panel: 0.05, grid: 0.25, type, found, tag, stream, pill: stream - 0.2, tick }, events: [{ at: 0.05, event: 'card-in' }, { at: type, event: 'code' }, { at: found, event: 'stat' }, { at: tag, event: 'pop' }, { at: stream, event: 'cascade' }, { at: tick, event: 'click-ui' }], exit: { kind: 'pill', x: 0.73, y: 0.88, w: 0.2, h: 0.08 }, min: tick + 0.9 }; },
    draw(S) {
      const b = S.b, c = S.ctx, wide = isWide(S), tall = isTall(S), its = itemsOf(b), q = (b.data && b.data.prompt) || '', B = slugOf(brand().name);
      const hasHead = toks(b).length > 0;
      const lay = hasHead ? bracketCaption(S, toks(b), S.W / 2, S.H * (tall ? 0.06 : 0.05), 32 * S.u, 0.05, { maxW: S.W * 0.8, maxLines: 1 }) : null;
      const top = lay ? lay.bottom + 30 * S.u : S.H * 0.06;
      let P, G, pillY;
      if (wide) { const ph = S.H - top - 70 * S.u, pw = S.W * 0.46, phh = Math.min(ph, clamp(pw * 0.034, 12 * S.u, 30 * S.u) * 16.5); P = { x: S.W * 0.3, y: top + ph * 0.45, w: pw, h: phh }; G = { x: S.W * 0.76, y: top + ph * 0.42, w: S.W * 0.3, h: ph * 0.74 }; pillY = top + ph * 0.93; }
      else { const ph = S.H * (tall ? 0.34 : 0.4); P = { x: S.W / 2, y: top + ph / 2, w: S.W * 0.88, h: ph }; const gt = top + ph + 70 * S.u, gh = S.H * (tall ? 0.94 : 0.92) - gt - 110 * S.u; G = { x: S.W / 2, y: gt + gh / 2, w: S.W * 0.8, h: gh }; pillY = S.H * (tall ? 0.92 : 0.92); }
      const cols = wide ? 11 : tall ? 13 : 17, rows = wide ? 13 : tall ? 11 : 7;
      const found = S.at('found'), sinkK = S.lt > S.at('pill') ? 1 : 0;
      const g = qgrid(S, { x: G.x, y: G.y, w: G.w, h: G.h, cols, rows, t0: S.at('grid'), matchAt: found, streamAt: S.at('stream'), sink: sinkK ? { x: G.x + (wide ? S.W * 0.06 : S.W * 0.12), y: pillY } : null, seed: 7, fadeAt: S.at('tick') + 0.3 });
      // the count and the tag pill above the grid
      const fk = appear(S, found, 0.3);
      if (fk > 0) { const cnt = Math.round(lerp(g.count * 0.8, g.count, E.out(prog(S.lt, found, 0.6)))); c.save(); c.globalAlpha *= fk * (1 - E.out(prog(S.lt, S.at('tag') - 0.1, 0.15))); L.text(c, S.look, `${cnt} found`, G.x, g.top - 6 * S.u, { role: 'micro', px: 28 * S.u, weight: 600, color: S.P.accent, align: 'center' }); c.restore(); }
      const tg = its[1] ? slugOf(its[1]) : '';
      if (tg) { const tk = pop(S, S.at('tag'), 'firm'); if (tk > 0) { const tpx = 26 * S.u, tw = L.textW(c, S.look, tg, { role: 'micro', px: tpx, weight: 600 }) + tpx * 1.6, th = tpx * 1.7, ty = g.top - 14 * S.u - (1 - Math.min(1, tk)) * 30 * S.u; c.save(); c.globalAlpha *= clamp(tk * 2); L.pill(c, G.x - tw / 2, ty - th / 2, tw, th, S.P.accent); L.text(c, S.look, tg, G.x, ty + tpx * 0.36, { role: 'micro', px: tpx, weight: 600, color: '#FFFFFF', align: 'center' }); c.restore(); } }
      toolPanel(S, { x: P.x, y: P.y, w: P.w, h: P.h, t0: S.at('panel'), typeAt: S.at('type'), title: 'agent', meta: B, prompt: q, calls: [
        { name: `${B} · ${slugOf(its[0] || 'query')}`, res: `${g.count} found`, at: found },
        ...(tg ? [{ name: `${B} · ${tg}`, res: `${g.count} tagged`, at: S.at('tag') }] : []),
        { name: `${B} · ${slugOf(b.text && b.text.sub ? b.text.sub : its[2] || 'workflow')}`, res: `${g.count} added`, at: S.at('stream') + 0.2 },
      ] });
      const label = (b.text && b.text.sub) || its[2] || its[0] || brand().name;
      workflowPill(c, S, G.x + (wide ? S.W * 0.06 : S.W * 0.12) - (wide ? S.W * 0.06 : S.W * 0.12) * 0, pillY, { t0: S.at('pill'), label, on: S.at('tick'), px: (wide ? 34 : 34) * S.u });
    },
  });

  /* ink line, red line + counter cards: the promise in two lines, then a card whose total rolls up beside a frozen value with a lock */
  L.def('insert:promise-counter-cards', {
    kind: 'setup',
    plan(b, F) { const tp = T(b, F, 0.05, 'effect:type-ink-red-lines'), cards = tp.done + 0.1; return { cues: { head: 0.05, headDone: tp.done, cards, count: cards + 0.3, lock: cards + 0.55 }, events: [...tp.events, { at: cards, event: 'card-in' }, { at: cards + 0.3, event: 'riffle' }, { at: cards + 1.8, event: 'stat' }, { at: cards + 0.55, event: 'pop' }], exit: { kind: 'rect', x: 0.5, y: 0.72, w: 0.6, h: 0.22 }, min: cards + 2.4 }; },
    draw(S) {
      const b = S.b, wide = isWide(S), tall = isTall(S), n = toks(b).length;
      const px = Math.min(S.H * (wide ? 0.13 : 0.1), S.W * (wide ? 0.075 : 0.11)), top = S.H * (tall ? 0.2 : wide ? 0.17 : 0.12);
      const lay = L.headline(S, { px, maxW: S.W * 0.86, x: S.W / 2, y: top, align: 'center', maxLines: n > 3 ? 2 : 1, lineH: 1.12 }, { type: 'effect:type-ink-red-lines' });
      const nb = numOf(b); if (!nb) return;
      const side = S.W / S.H > 0.9, cw = wide ? Math.min(S.W * 0.34, 700 * S.u) : side ? S.W * 0.42 : S.W * 0.8, ch = cw * (side ? 0.42 : 0.34), ctop = (lay ? lay.bottom : top) + (wide ? 70 : 80) * S.u;
      const cy = side ? ctop + ch / 2 : ctop + ch + 18 * S.u;
      cardPair(S, { x: S.W / 2, y: cy, cw, ch, side, t0: S.at('cards'), countAt: S.at('count'), lockAt: S.at('lock'), number: nb, frozenLabel: (b.data && b.data.frozenLabel) || itemsOf(b)[0] || '', frozen: b.data && b.data.frozen });
    },
  });

  /* ───────── end card ───────── */
  /* lockup, wide accent pill, click: icon + wordmark centred, a wide accent CTA pill grows under it, the cursor glides in and clicks, the address small below */
  L.def('end_card:icon-cta-click-terms', {
    kind: 'end',
    plan(b) { return { cues: { icon: 0.05, mark: 0.22, pill: 0.8, click: 1.55, terms: 1.0 }, events: [{ at: 0.05, event: 'pop' }, { at: 0.25, event: 'key-word' }, { at: 0.8, event: 'cta' }, { at: 1.55, event: 'click-ui' }], entry: { kind: 'dot', x: 0.5, y: 0.4, r: 0.03 } }; },
    draw(S) {
      const c = S.ctx, B = brand(), name = B.name || 'Brand', wide = isWide(S), cx = S.W / 2;
      const px = Math.min(S.H * 0.19, S.W * 0.13) * (name.length > 8 ? 8 / name.length : 1), y = S.H * (wide ? 0.42 : 0.4);
      const mw = L.textW(c, S.look, name, { role: 'wordmark', px, weight: 800, tracking: -0.05 }), iconS = px * 1.06, gap = px * 0.28, x0 = cx - (iconS + gap + mw) / 2;
      const ik = pop(S, S.at('icon')); if (ik > 0) { c.save(); scaleAbout(c, x0 + iconS / 2, y, ik); iconTile(c, S, x0 + iconS / 2, y, iconS, { morph: 1, glyph: E.ramp(prog(S.lt, S.at('icon') + 0.15, 0.3)) }); c.restore(); }
      const mk = E.out(prog(S.lt, S.at('mark'), 0.6));
      c.save(); c.beginPath(); c.rect(x0 + iconS + gap * 0.5, y - px, mw + gap * 2, px * 1.4); c.clip(); L.text(c, S.look, name, x0 + iconS + gap + (1 - mk) * -mw * 0.3, y + px * 0.34, { role: 'wordmark', px, weight: 800, color: S.P.fg, tracking: -0.05 }); c.restore();
      // the CTA: wide accent pill (scale 0.6 → 1), presses on the click, a ripple
      const tok = toks(S.b).map(t => t.s).join(' ').replace(/[.]+$/, ''), label = (S.b.data && S.b.data.cta) || (tok && tok.toLowerCase() !== name.toLowerCase() ? tok : 'Get started');
      const pk = pop(S, S.at('pill'), 'firm'), press = L.pressAt([S.at('click')], S.lt).p, ppx = Math.max(28 * S.u, px * 0.27);
      const pw = Math.max(L.textW(c, S.look, label, { role: 'ui', px: ppx, weight: 650 }) + ppx * 4, Math.min(S.W * 0.36, 600 * S.u)), ph = ppx * 2.5, py = y + px * 1.25;
      if (pk > 0.01) {
        c.save(); scaleAbout(c, cx, py, lerp(0.6, 1, Math.min(1.1, pk)) * (1 - press * 0.04)); c.globalAlpha *= clamp(pk * 2);
        L.card(c, cx - pw / 2, py - ph / 2, pw, ph, ph / 2, { fill: S.P.accent, u: S.u, lift: 0.8, stroke: false, shadow: rgba(S.P.accent, 0.35) });
        const g = c.createLinearGradient(0, py - ph / 2, 0, py + ph / 2); g.addColorStop(0, 'rgba(255,255,255,0.18)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); L.rr(c, cx - pw / 2, py - ph / 2, pw, ph, ph / 2); c.fillStyle = g; c.fill();
        L.text(c, S.look, label, cx, py + ppx * 0.36, { role: 'ui', px: ppx, weight: 650, color: L.onColor(S.P.accent), align: 'center' });
        c.restore();
        const rk = prog(S.lt, S.at('click'), 0.45); if (rk > 0 && rk < 1) { c.save(); L.rr(c, cx - pw / 2 - rk * 30 * S.u, py - ph / 2 - rk * 30 * S.u, pw + rk * 60 * S.u, ph + rk * 60 * S.u, ph / 2 + rk * 30 * S.u); c.strokeStyle = rgba(S.P.accent, 0.5 * (1 - rk)); c.lineWidth = 2.5 * S.u; c.stroke(); c.restore(); }
      }
      const tk = appear(S, S.at('terms'), 0.5); if (tk > 0 && B.host) { c.save(); c.globalAlpha *= tk; L.text(c, S.look, B.host, cx, py + ph * 0.5 + 56 * S.u, { role: 'micro', px: 22 * S.u, color: S.P.dim, align: 'center' }); c.restore(); }
      L.cursorDraw(S, [[S.at('pill') + 0.2, 0.72, 0.95], [S.at('click') - 0.05, 0.5 + pw / S.W * 0.18, py / S.H + 0.012], [S.d + 1, 0.53, py / S.H + 0.06]], [S.at('click')]);
    },
  });

  /* ───────── transitions ───────── */
  const pt = (S, a, dx = 0.5, dy = 0.5) => ({ x: (a && a.x != null ? a.x : dx) * S.W, y: (a && a.y != null ? a.y : dy) * S.H });
  const cover = (S, x, y) => Math.max(Math.hypot(x, y), Math.hypot(S.W - x, y), Math.hypot(x, S.H - y), Math.hypot(S.W - x, S.H - y)) * 1.04;
  const split = (o, k) => { const span = (o.pre || 0) + (o.post || 0) || 1; return clamp(k * span / Math.max(1e-6, o.pre || 1e-6)); };
  const after = (o, k) => { const span = (o.pre || 0) + (o.post || 0) || 1; return clamp((k * span - (o.pre || 0)) / Math.max(1e-6, o.post || 1e-6)); };
  const exitOf = o => (o.fromBeat && o.fromBeat.__exit) || o.from;

  /* zoom into the full stop: the camera accelerates into A's ball until its colour fills the frame, then the colour contracts into B */
  L.def('transition:zoom-into-period', {
    kind: 'transition', plan() { return { pre: 0.45, post: 0.32, events: [{ at: -0.45, event: 'build' }, { at: 0, event: 'scene' }] }; },
    tr(S, A, B, k, o) {
      const c = S.ctx, ex = exitOf(o) || { x: 0.5, y: 0.5, r: 0.03 }, p = pt(S, ex), r0 = Math.max(10 * S.u, (ex.r || 0.03) * S.H);
      if (S.t < o.cut) {
        const g = E.in(split(o, k)), smax = cover(S, p.x, p.y) / r0 * 1.05, s = L.logLerp(1, smax, g);
        c.fillStyle = (S.PA || S.P).bg; c.fillRect(0, 0, S.W, S.H);
        c.save(); c.translate(p.x, p.y); c.scale(s, s); c.translate(-p.x, -p.y); if (g > 0.12) c.filter = `blur(${Math.min(14, g * 14).toFixed(1)}px)`; c.drawImage(A, 0, 0); c.restore();
        if (g > 0.02) { c.save(); c.globalAlpha = clamp(g * 4); ball(c, S, p.x, p.y, r0 * s, { glow: false }); c.restore(); }
      } else {
        const g = E.ramp(after(o, k)), q = pt(S, o.to), r1 = (o.to && o.to.r != null ? o.to.r : 0.006) * S.H;
        c.drawImage(B, 0, 0);
        const r = lerp(cover(S, q.x, q.y), r1, g); if (g < 1) L.circle(c, lerp(p.x, q.x, g), lerp(p.y, q.y, g), r * (g > 0.9 ? 1 - (g - 0.9) * 10 : 1), S.look.accent);
      }
    },
  });

  /* halftone bloom: a dot matrix grows out of the centre over A until the dots merge, then empties from the centre onto B */
  L.def('transition:halftone-bloom', {
    kind: 'transition', plan() { return { pre: 0.42, post: 0.45, events: [{ at: -0.42, event: 'build' }, { at: 0.02, event: 'cascade' }] }; },
    tr(S, A, B, k, o) {
      // one colour for the whole move, readable over both shots (ink, else the accent, else paper)
      const c = S.ctx, pre = S.t < o.cut, bgs = [(S.PA || S.P).bg, S.P.bg], cands = o.color === 'accent' ? [S.look.accent, S.look.palette.ink] : [S.look.palette.ink, S.look.accent, S.look.palette.paper];
      const col = cands.find(x => bgs.every(bg => L.contrast(x, bg) >= 1.6)) || S.look.accent;
      c.drawImage(pre ? A : B, 0, 0);
      const pitch = Math.max(S.W, S.H) / 30, cols = Math.ceil(S.W / pitch) + 1, rows = Math.ceil(S.H / pitch) + 1, ox = (S.W - (cols - 1) * pitch) / 2, oy = (S.H - (rows - 1) * pitch) / 2;
      const R = pre ? E.in(split(o, k)) * 1.75 : E.out(after(o, k)) * 1.75; c.fillStyle = col;
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        const x = ox + i * pitch, y = oy + j * pitch, d = Math.hypot((x - S.W / 2) / (S.W * 0.5), (y - S.H / 2) / (S.H * 0.5) * 0.75);
        const f = pre ? clamp((R - d) / 0.4) : clamp((d - R + 0.4) / 0.4);
        if (f <= 0.01) continue;
        c.beginPath(); c.arc(x, y, pitch * 0.74 * f, 0, Math.PI * 2); c.fill();
      }
    },
  });

  /* glitch double: the last frame of A doubles with an offset copy and a slipped slice, then a hard cut onto B (which settles from one doubled frame) */
  L.def('transition:glitch-double-cut', {
    kind: 'transition', plan() { return { pre: 0.12, post: 0.12, events: [{ at: -0.1, event: 'slide-out' }, { at: 0, event: 'hard-hit' }] }; },
    tr(S, A, B, k, o) {
      const c = S.ctx, pre = S.t < o.cut, img = pre ? A : B, g = pre ? split(o, k) : 1 - after(o, k), f = Math.floor(S.t * 60);
      c.drawImage(img, 0, 0); if (g <= 0.05) return;
      const off = (6 + rand(f) * 10) * S.u * g;
      c.save(); c.globalAlpha = 0.55 * g; c.drawImage(img, -off, 0); c.globalAlpha = 0.35 * g; c.drawImage(img, off * 0.6, off * 0.3); c.restore();
      for (let i = 0; i < 2; i++) { const y = rand(f * 3 + i) * S.H, h = (12 + rand(f + i * 5) * 50) * S.u, dx = (rand(f + i * 9) - 0.5) * 60 * S.u * g; c.save(); c.beginPath(); c.rect(0, y, S.W, h); c.clip(); c.drawImage(img, dx, 0); c.restore(); }
    },
  });

  /* ball swallow + burst: the accent ball rolls across A, swells, A collapses into it; it bursts (ring, specks) and B opens out of the burst */
  L.def('transition:ball-swallow-burst', {
    kind: 'transition', plan() { return { pre: 0.5, post: 0.45, events: [{ at: -0.5, event: 'slide-out' }, { at: -0.15, event: 'build' }, { at: 0, event: 'hard-hit' }] }; },
    tr(S, A, B, k, o) {
      const c = S.ctx, ex = exitOf(o), p = ex ? pt(S, ex) : { x: S.W / 2, y: S.H / 2 }, r0 = 0.035 * S.H;
      if (S.t < o.cut) {
        const g = split(o, k), rk = E.io(clamp(g / 0.6)), x = lerp(-r0 * 2, p.x, rk), r = lerp(r0, r0 * 2.6, E.in(clamp((g - 0.4) / 0.6)));
        const col = E.in(clamp((g - 0.5) / 0.5));
        c.fillStyle = (S.PA || S.P).bg; c.fillRect(0, 0, S.W, S.H);
        c.save(); c.globalAlpha = 1 - col * 0.9; c.translate(p.x, p.y); c.scale(1 - col * 0.92, 1 - col * 0.92); c.translate(-p.x, -p.y); c.drawImage(A, 0, 0); c.restore();
        ball(c, S, x, p.y, r, {});
      } else {
        const g = after(o, k), R = lerp(0.035 * S.H * 2.6, cover(S, p.x, p.y), E.out(g));
        c.fillStyle = (S.PA || S.P).bg; c.fillRect(0, 0, S.W, S.H);
        c.save(); c.beginPath(); c.arc(p.x, p.y, R, 0, Math.PI * 2); c.clip(); c.drawImage(B, 0, 0); c.restore();
        L.circle(c, p.x, p.y, R * 1.02, null, rgba(S.look.accent, 0.6 * (1 - g)), lerp(5, 1, g) * S.u);
        for (let i = 0; i < 36; i++) { const a = rand(i + 7) * Math.PI * 2, d = R * (0.9 + rand(i + 3) * 0.5) + g * 80 * S.u, life = 1 - g; if (life <= 0) continue; L.circle(c, p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, (2 + rand(i + 13) * 3.5) * S.u * life, i % 3 ? S.look.accent : S.look.palette.ink); }
      }
    },
  });

  /* ───────── cameras ───────── */
  /* pull back snap: the shot starts tight on its subject and snaps back to the frame in a fast ease at the set-up's 'pull' cue */
  L.def('camera:pull-back-snap', {
    kind: 'camera',
    cam(lt, d, o, S) { const at = S && S.cues && S.cues.pull != null ? S.cues.pull : d * 0.3, s0 = (o && o.amount) || 1.28, k = E.io(prog(lt, at, 0.32)); const before = s0 + Math.min(lt, at) * 0.02; return { s: L.logLerp(before, 1, k) * (1 + Math.max(0, lt - at - 0.32) * 0.006), x: 0, y: (1 - k) * -8 * ((S && S.u) || 1), r: 0 }; },
  });
  /* slow truck left with a gentle push: a calm drift for a held giant word (about 30 px a second, never still) */
  L.def('camera:truck-left-push', {
    kind: 'camera',
    cam(lt, d, o, S) { const u = (S && S.u) || 1, k = clamp(lt / Math.max(0.1, d)); return { s: 1.015 + k * 0.025, x: (30 - lt * 30) * u * ((o && o.dir) || 1), y: 0, r: 0 }; },
  });

  /* ───────── texture / overlay ───────── */
  /* echo marquee: the beat's line repeated in faint rows above and below, alternate rows drifting left and right */
  L.def('texture:echo-marquee-rows', {
    kind: 'texture',
    draw(S, o = {}) {
      const c = S.ctx, txt = o.text || joinT(toks(S.b)) || (S.b.text && S.b.text.eyebrow) || brand().name; if (!txt) return;
      const px = o.px || 34 * S.u, pitch = px * 1.75, cy = o.y != null ? o.y : S.H / 2, n = o.rows || Math.ceil(S.H / pitch) + 1;
      const tw = L.textW(c, S.look, txt, { role: 'ui', px, weight: 500 }) + px * 2.2;
      c.save();
      for (let r = 0; r < n; r++) {
        const row = r - Math.floor(n / 2), y = cy + row * pitch - px * 0.4, fall = o.rows ? 1 - Math.abs(row) / (n / 2 + 0.5) : 1 - Math.abs(y - S.H / 2) / (S.H * 0.7);
        if (fall <= 0) continue;
        const speed = (row % 2 ? 28 : -14) * S.u, off = ((S.t * speed + row * tw * 0.37) % tw + tw) % tw;
        c.globalAlpha = 0.085 * fall * (row === 0 && o.rows ? 0.6 : 1);
        for (let x = -tw + off - tw; x < S.W + tw; x += tw) L.text(c, S.look, txt, x, y, { role: 'ui', px, weight: 500, color: S.P.fg });
      }
      c.restore();
    },
  });
  /* ring burst on landing: two thin accent rings expand and fade behind the thing that just landed (the set-up's land / headDone cue) */
  L.def('effect:ring-burst-on-land', {
    kind: 'overlay',
    draw(S, o = {}) {
      const c = S.ctx, at = o.at != null ? o.at : S.cues.land != null ? S.cues.land : S.cues.headDone != null ? S.cues.headDone : 0.5;
      const ex = S.b.__exit, x = (o.x != null ? o.x : ex ? ex.x : 0.5) * S.W, y = (o.y != null ? o.y : ex ? ex.y : 0.5) * S.H;
      [0, 0.1].forEach(dl => { const k = prog(S.lt, at + dl, 0.55); if (k <= 0 || k >= 1) return; L.circle(c, x, y, lerp(30 * S.u, S.H * 0.28, E.out(k)), null, rgba(S.P.accent, 0.55 * (1 - k)), lerp(3, 0.6, k) * S.u); });
    },
  });
})(globalThis.LAUNCH);
