// p-l06: the accent-dot motion system (reference l06). One accent dot threads every part: it is the colour that drains
// out of a toggle, the tittle on an i, the particle that draws its own spring curve, the shape that morphs on the beat
// (disc → diamond squircle → pill → dot), the hub of a ring of orbiting type, the stone dropped into a halftone pond and
// the full stop of the closing line. Flat colour only (paper, ink, the brand accent), squash and stretch on every hop,
// every state change on a beat. Content from b.text / b.data / the brand; colours from S.P and S.look only.
'use strict';
(function (L) {
  const { clamp, lerp, prog, E, rgba, mix, lum, spring, springTrack, logLerp, contrast, onColor } = L;
  const TAU = Math.PI * 2;
  const isWide = S => S.W / S.H > 1.3, isTall = S => S.H / S.W > 1.3;
  const qOf = F => (((F && F.grid && F.grid.bar) || (L.film && L.film.grid && L.film.grid.bar) || 1.88) / 4);
  const toks = b => (b && b.text && b.text.tokens) || [];
  const clean = s => String(s == null ? '' : s).replace(/[.,!?;:…]+$/, '');
  const keyIdx = b => { const t = toks(b); const a = t.findIndex(x => x.accent); if (a >= 0) return a; let best = 0; t.forEach((x, i) => { if (clean(x.s).length > clean(t[best].s).length) best = i; }); return best; };
  const keyWord = b => { const t = toks(b); return t.length ? clean(t[keyIdx(b)].s) : ((L.film && L.film.brand && L.film.brand.name) || 'Now'); };
  const itemsOf = b => ((b && b.data && b.data.items) || []).filter(Boolean).map(String);
  const brand = () => (L.film && L.film.brand) || { name: 'Brand', host: 'brand.com', tagline: '' };
  const numStr = n => (n ? `${n.prefix || ''}${n.value}${n.suffix || ''}` : '');
  const noStop = tk => tk.map((t, i, a) => (i === a.length - 1 ? Object.assign({}, t, { s: t.s.replace(/[.!]+$/, '') }) : t));
  const dotCol = S => S.P.accent;
  // a ground that the accent reads on (the accent itself, or ink / paper when the accent would vanish)
  const onGround = (S, under) => (contrast(S.look.accent, under) >= 1.7 ? S.look.accent : lum(under) > 0.4 ? S.look.palette.ink : S.look.palette.paper);

  /* ───────── words: measured glyphs, the tittle, the full stop ───────── */
  // a word set at (x, baseline y), shaped like a laid-out word so the kit's drawWord can draw it
  function mkW(S, s, x, y, px, o = {}) {
    const role = o.role || 'display', tr = L.tracking(S.look, role, px), c = S.ctx;
    L.setFont(c, S.look, role, px, o.weight); try { c.letterSpacing = tr.toFixed(2) + 'px'; } catch (e) { /* */ }
    const w = c.measureText(s).width; try { c.letterSpacing = '0px'; } catch (e) { /* */ }
    const x0 = o.align === 'left' ? x : o.align === 'right' ? x - w : x - w / 2;
    return { x: x0, y, w, px, role, tr, tk: { s, weight: o.weight }, s };
  }
  function charsOf(S, w, s) {
    s = s == null ? w.s : s; const c = S.ctx;
    L.setFont(c, S.look, w.role, w.px, w.tk && w.tk.weight); try { c.letterSpacing = (w.tr || 0).toFixed(2) + 'px'; } catch (e) { /* */ }
    const out = []; let prev = 0;
    for (let i = 0; i < s.length; i++) {
      const x = c.measureText(s.slice(0, i + 1)).width, ch = s[i];
      out.push({ i, ch, x: w.x + prev, w: x - prev, top: w.y - w.px * (/[A-Z0-9bdfhklı]/.test(ch) ? 0.73 : ch === 't' ? 0.66 : /[a-z]/.test(ch) ? 0.55 : 0.62) });
      prev = x;
    }
    try { c.letterSpacing = '0px'; } catch (e) { /* */ }
    return out;
  }
  const glyphC = (w, ch) => ch.x + (ch.w - (w.tr || 0)) / 2;
  const tittleI = s => String(s).indexOf('i');
  const dotless = (s, i) => (i >= 0 ? s.slice(0, i) + 'ı' + s.slice(i + 1) : s);
  // where the accent dot belongs on a word: the tittle of its i (ti), and its full stop
  function dotSpots(S, w, ti) {
    const ch = charsOf(S, w, dotless(w.s, ti)), r = w.px * 0.094, last = ch[ch.length - 1];
    const tit = ti >= 0 && ch[ti] ? { x: glyphC(w, ch[ti]), y: w.y - w.px * 0.7, r } : null;
    const per = last ? { x: last.x + last.w - (w.tr || 0) + w.px * 0.04 + r, y: w.y - r, r } : { x: w.x, y: w.y - r, r };
    return { ch, tit, per };
  }
  const drawW = (S, w, o = {}) => L.drawWord(S.ctx, S.look, S.P, w, o);
  const drawCh = (S, w, ch, o = {}) => L.drawWord(S.ctx, S.look, S.P, Object.assign({}, w, { s: ch.ch }), Object.assign({ x: ch.x, y: w.y }, o));
  const lineBox = (lay, li) => { const ws = lay.words.filter(w => w.li === li); const x0 = Math.min(...ws.map(w => w.x)), x1 = Math.max(...ws.map(w => w.x + w.w)); const y = ws[0].y; return { x0, x1, y, top: y - lay.px * 1.02, bottom: y + lay.px * 0.3 }; };

  /* ───────── the dot's body: hops with squash and stretch ───────── */
  // hops: [{at, d, x, y, apex, fall?, noAnt?}] launch at `at`, land on (x, y) at at + d. Anticipation squash 1.32×0.80,
  // launch stretch along the velocity, landing squash 1.41×0.73 that springs back (bottom anchored).
  function hopAt(t, start, hops, r) {
    let p = start, land = -1;
    for (const h of hops) {
      if (t < h.at - (h.noAnt ? 0 : 0.1)) break;
      if (t < h.at) { const k = E.out(prog(t, h.at - 0.1, 0.1)); return { x: p.x, y: p.y + r * 0.2 * k, sx: lerp(1, 1.32, k), sy: lerp(1, 0.8, k), rot: 0, air: 0 }; }
      if (t < h.at + h.d) {
        const u = (t - h.at) / h.d, ap = h.apex || 0, e = h.fall ? u * u : u;
        const x = lerp(p.x, h.x, u), y = lerp(p.y, h.y, e) - ap * 4 * u * (1 - u);
        const vx = (h.x - p.x) / h.d, vy = (h.y - p.y) * (h.fall ? 2 * u : 1) / h.d - ap * 4 * (1 - 2 * u) / h.d;
        const st = 1 + 0.24 * clamp(Math.hypot(vx, vy) / (r * 45));
        return { x, y, sx: st, sy: 1 / st, rot: Math.atan2(vy, vx), air: 1, u, from: p, to: h };
      }
      p = h; land = h.at + h.d;
    }
    if (land >= 0 && t - land < 0.6) { const k = 1 - spring(t - land, [11, 320, 1]); return { x: p.x, y: p.y + r * 0.27 * k, sx: 1 + 0.41 * k, sy: 1 - 0.27 * k, rot: 0, air: 0 }; }
    return { x: p.x, y: p.y, sx: 1, sy: 1, rot: 0, air: 0 };
  }
  function blob(c, p, r, col, sh) { c.save(); c.translate(p.x, p.y); c.rotate(p.rot || 0); c.scale(p.sx || 1, p.sy || 1); c.beginPath(); c.arc(0, 0, Math.max(0, r), 0, TAU); if (sh) { c.shadowColor = 'rgba(20,16,12,0.22)'; c.shadowBlur = r * 0.7; c.shadowOffsetY = r * 0.22; } c.fillStyle = col; c.fill(); c.restore(); }
  // the dot with a short shutter smear behind it while it flies
  function blobTrail(c, f, t, r, col) {
    const p = f(t);
    if (p.air) for (let j = 3; j >= 1; j--) { const q = f(t - j / 200); c.save(); c.globalAlpha *= 0.14; blob(c, { x: q.x, y: q.y, sx: p.sx, sy: p.sy, rot: p.rot }, r, col); c.restore(); }
    blob(c, p, r, col, true);
    return p;
  }

  /* ───────── one spring (zeta 0.44, omega 14): the curve and the dot share it ───────── */
  const Z = 0.44, WN = 14, WD = WN * Math.sqrt(1 - Z * Z);
  const springZ = t => (t <= 0 ? 0 : 1 - Math.exp(-Z * WN * t) * (Math.cos(WD * t) + Z / Math.sqrt(1 - Z * Z) * Math.sin(WD * t)));
  const PEAK = Math.PI / WD;

  /* ───────── shapes, halftone, ripples ───────── */
  function shapePath(c, x, y, w, h, r, rot) { c.save(); c.translate(x, y); c.rotate(rot || 0); L.rr(c, -w / 2, -h / 2, w, h, Math.min(r, w / 2, h / 2)); c.restore(); }
  function ghost(c, S, a, col, draw) { if (a <= 0.01) return; c.save(); c.globalAlpha *= a; c.strokeStyle = col; c.lineWidth = 2.5 * S.u; draw(); c.stroke(); c.restore(); }
  function halftone(c, S, pitch, col, rOf) {
    c.fillStyle = col; c.beginPath();
    const ox = (S.W / 2) % pitch, oy = (S.H / 2) % pitch;
    for (let y = oy - pitch; y < S.H + pitch; y += pitch) for (let x = ox - pitch; x < S.W + pitch; x += pitch) { const r = rOf(x, y); if (r > 0.25) { c.moveTo(x + r, y); c.arc(x, y, r, 0, TAU); } }
    c.fill();
  }
  // a ripple crest travelling out from an impact, a shallow trough behind it (1 = rest)
  function ripple(d, t, hits, v, w, crest) {
    let k = 0;
    for (const h of hits) { const dt = t - h; if (dt <= 0) continue; const x = (d - dt * v) / w, decay = Math.exp(-dt * 1.3); k += (Math.exp(-x * x * 2.2) * (crest - 1) - (x < 0 ? 0.38 * Math.exp(-(x + 1.3) * (x + 1.3) * 1.2) : 0)) * decay; }
    return Math.max(0, 1 + k);
  }
  const smoothstep = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };
  const S2of = (S, world) => Object.assign({}, S, { P: L.palette(S.look, world) });

  /* ════════════════════ UI ════════════════════ */

  /* a big accent toggle; on the click the knob slides off and the track drains to a warm grey (the accent leaves) */
  L.def('ui:toggle-accent-drain', {
    kind: 'ui',
    draw(S, o) {
      const c = S.ctx, h = o.h || 120 * S.u, w = h * 1.75, x = o.x - w / 2, y = o.y - h / 2, at = o.off != null ? o.off : o.on != null ? o.on : 1e9;
      const ent = o.t0 != null ? clamp(spring(S.lt - o.t0, 'pop'), 0, 1.2) : 1;
      if (ent <= 0.001) return null;
      const lead = clamp(spring(S.lt - at, 'snap'), 0, 1.08), trail = clamp(spring(S.lt - at - 0.04, 'ui'), 0, 1.08);
      const drain = E.out(prog(S.lt, at + 0.02, 0.12));
      c.save(); c.translate(o.x, o.y); c.scale(ent, ent); c.translate(-o.x, -o.y);
      L.pill(c, x, y, w, h, mix(S.look.accent, mix(S.P.bg, S.P.fg, 0.2), drain));
      const pad = h * 0.1, kr = h / 2 - pad, xOn = x + w - pad - kr, xOff = x + pad + kr;
      const a = lerp(xOn, xOff, lead) - kr, b = lerp(xOn, xOff, trail) + kr;
      c.shadowColor = 'rgba(0,0,0,0.2)'; c.shadowBlur = 10 * S.u; c.shadowOffsetY = 3 * S.u;
      L.pill(c, Math.min(a, b - 2 * kr), y + pad, Math.max(2 * kr, b - a), h - 2 * pad, '#FFFFFF');
      c.restore();
      return { knob: { x: lerp(xOn, xOff, lead), y: o.y, r: kr }, track: { x, y, w, h } };
    },
  });

  /* a chart reduced to a stage: two ink axes and a dashed target line, sliding in with the whip */
  L.def('ui:bare-axes-target', {
    kind: 'ui',
    draw(S, o) {
      const c = S.ctx, x0 = o.x0 != null ? o.x0 : o.x - o.w / 2, x1 = o.x1 != null ? o.x1 : o.x + o.w / 2, oy = o.oy != null ? o.oy : o.y + o.h / 2, top = o.top != null ? o.top : o.y - o.h / 2;
      const ty = o.ty != null ? o.ty : oy - (oy - top) / 1.25, k = E.out(prog(S.lt, o.t0 || 0, 0.45));
      if (k <= 0) return;
      c.save(); c.translate((1 - k) * S.W * 0.25, 0); c.globalAlpha *= clamp(k * 3);
      c.lineCap = 'square'; c.strokeStyle = S.P.fg; c.lineWidth = 3 * S.u;
      c.beginPath(); c.moveTo(x0, top); c.lineTo(x0, oy); c.lineTo(x1, oy); c.stroke();
      L.line(c, x0, ty, x1, ty, mix(S.P.bg, S.P.fg, 0.42), 2.2 * S.u, [18 * S.u, 13 * S.u]);
      c.restore();
    },
  });

  /* the spring curve drawn by the dot itself: one damped spring gives both; beads every 1/30 s show the easing,
     the overshoot is named by a callout that rises from its own baseline with a short leader */
  L.def('ui:spring-bead-trace', {
    kind: 'ui',
    draw(S, o) {
      const c = S.ctx, x0 = o.x0 != null ? o.x0 : o.x - o.w / 2, oy = o.oy != null ? o.oy : o.y + o.h / 2, len = o.len || o.w, rise = o.rise || o.h / 1.25 * 0.92;
      const t0 = o.t0 || 0, dur = o.dur || 2.2, r = o.r || 18 * S.u, T = S.lt - t0, te = clamp(T, 0, dur);
      const X = tt => x0 + len * tt / dur, Y = tt => oy - rise * springZ(tt);
      if (T > 0) {
        c.save(); c.strokeStyle = S.P.fg; c.lineWidth = 3 * S.u; c.lineJoin = 'round'; c.beginPath();
        const n = Math.max(2, Math.ceil(te * 120)); for (let i = 0; i <= n; i++) { const tt = te * i / n; if (i) c.lineTo(X(tt), Y(tt)); else c.moveTo(X(tt), Y(tt)); }
        c.stroke(); c.fillStyle = S.P.fg; c.beginPath();
        for (let tt = 1 / 30; tt < te - 1 / 60; tt += 1 / 30) { c.moveTo(X(tt) + 4.4 * S.u, Y(tt)); c.arc(X(tt), Y(tt), 4.4 * S.u, 0, TAU); }
        c.fill(); c.restore();
      }
      // the callout at the peak
      if (o.callout && T > PEAK) {
        const k = E.out(prog(T, PEAK + 0.02, 0.28)), px = o.px || S.H * 0.07, px0 = X(PEAK), py0 = Y(PEAK) - r * 1.2;
        const lx = px0 + px * 0.42, ly = py0 - px * 0.55;
        c.save(); c.globalAlpha *= clamp(k * 3); L.line(c, px0 + px * 0.06, py0 - px * 0.05, lerp(px0 + px * 0.06, lx, k), lerp(py0 - px * 0.05, ly, k), S.P.fg, 2 * S.u); c.restore();
        c.save(); c.beginPath(); c.rect(lx - px * 0.2, ly - px * 1.3, px * 12, px * 1.3 + px * 0.05); c.clip();
        L.text(c, S.look, o.callout, lx + px * 0.1, ly + (1 - k) * px * 1.1, { role: 'numeral', px, color: S.P.fg, weight: 800 });
        c.restore();
        if (o.label) { const lk = E.out(prog(T, PEAK + 0.3, 0.4)); c.save(); c.globalAlpha *= lk; L.text(c, S.look, o.label, lx + px * 0.12, ly + px * 0.42 + (1 - lk) * 8 * S.u, { role: 'micro', px: Math.max(14 * S.u, px * 0.24), color: S.P.dim, upper: true, maxW: S.W * 0.3 }); c.restore(); }
      }
      // the dot, stretched along its velocity
      const x = X(te), y = Y(te), vx = T > 0 && T < dur ? len / dur : 0, vy = T > 0 && T < dur ? -rise * (springZ(te + 0.004) - springZ(te - 0.004)) / 0.008 : 0;
      const st = 1 + 0.2 * clamp(Math.hypot(vx, vy) / (r * 70)), br = T > dur ? 1 + Math.sin((T - dur) * 5) * 0.025 : 1;
      if (T > -0.05 && !o.noDot) blob(c, { x, y, sx: st * br, sy: br / st, rot: Math.atan2(vy, vx) }, r, dotCol(S));
      return { dot: { x, y, r } };
    },
  });

  /* capital words on a tilted 3D ring around a centre: the near side big and bright, the far side small, dim and
     mirrored; it spins in from a tiny fast blur and settles to a calm orbit; the near letters pass over the centre */
  const RINGW = {};
  L.def('ui:word-ring-3d', {
    kind: 'ui',
    draw(S, o) {
      const c = S.ctx, cx = o.x, cy = o.y, RX = o.rx || Math.min(S.W * 0.36, (o.w || S.W * 0.6) * 0.5), RY = o.ry || RX * 0.34, dt = S.lt - (o.t0 || 0);
      const words = (o.words || o.items || []).map(s => String(s).toUpperCase());
      if (dt < 0 || !words.length) { if (o.mid) o.mid(); return; }
      let px = o.px || RX * 0.2; const g = E.expo(prog(dt, 0, 0.6)), rad = lerp(0.06, 1, g);
      const w0 = 11, wc = o.speed || 0.6, tau = 0.2, theta = -(wc * dt + (w0 - wc) * tau * (1 - Math.exp(-dt / tau))), omega = wc + (w0 - wc) * Math.exp(-dt / tau);
      const unit = words.join(' · ') + ' · ';
      L.setFont(c, S.look, 'display', px, 800); try { c.letterSpacing = '0px'; } catch (e) { /* */ }
      { const uw = c.measureText(unit).width; if (uw > TAU * RX * 0.98) { px *= TAU * RX * 0.98 / uw; L.setFont(c, S.look, 'display', px, 800); } }
      const key = unit + '|' + px.toFixed(1);
      let ws = RINGW[key];
      if (!ws) { const uw = c.measureText(unit).width, reps = Math.max(1, Math.round(TAU * RX / uw)); ws = RINGW[key] = [...unit.repeat(reps)].map(ch => ({ ch, w: c.measureText(ch).width })); }
      const total = ws.reduce((a, g2) => a + g2.w, 0), kk = TAU / total;
      let cum = 0; const gl = ws.map(gq => { const a = theta + (cum + gq.w / 2) * kk; cum += gq.w; return { ch: gq.ch, w: gq.w, a, z: Math.cos(a) }; });
      const back = mix(S.P.bg, S.P.fg, 0.36), gsize = lerp(0.35, 1, g);
      const drawG = (q, a, alpha) => {
        const z = Math.cos(a), ds = lerp(0.6, 1, (z + 1) / 2) * gsize, fx = Math.cos(a);
        if (Math.abs(fx) < 0.04) return;
        c.save(); c.globalAlpha *= alpha; c.translate(cx + Math.sin(a) * RX * rad, cy + z * RY * rad); c.scale(fx * ds, ds);
        c.fillStyle = z >= 0 ? mix(back, S.P.fg, clamp(z * 1.6)) : back; c.fillText(q.ch, -q.w / 2, px * 0.36); c.restore();
      };
      c.textBaseline = 'alphabetic'; c.textAlign = 'left';
      const pass = front => { for (const q of gl) { if ((q.z >= 0) !== front || q.ch === ' ') continue; if (omega > 2.5) for (let j = 3; j >= 1; j--) drawG(q, q.a + omega * 0.012 * j, 0.16); drawG(q, q.a, 1); } };
      pass(false);
      if (o.mid) o.mid();
      L.setFont(c, S.look, 'display', px, 800); try { c.letterSpacing = '0px'; } catch (e) { /* */ }
      pass(true);
    },
  });

  /* ════════════════════ SET-UPS ════════════════════ */

  /* macro on an accent toggle: the cursor glides in and clicks, the knob slides off, the track drains to grey and the
     camera pulls back to the label, whose i now carries the accent dot (the accent changes hands) */
  L.def('insert:toggle-macro-pullout', {
    kind: 'setup',
    plan(b) {
      const click = 0.55, long = toks(b).length > 3;
      return { cues: { click, pull: click + 0.05, hand: click + 0.06, head: click + 0.55, headDone: click + 1.1, eyebrow: click + 0.7, sub: click + 0.95 }, events: [{ at: click, event: 'click-ui' }, { at: click + 0.07, event: 'slide-out' }, { at: click + 0.45, event: 'accent' }, ...(long ? [{ at: click + 0.6, event: 'key-word' }] : [])], exit: { kind: 'dot', x: 0.5, y: 0.45, r: 0.012 }, entry: { kind: 'circle', x: 0.5, y: 0.5, r: 0.12 }, min: click + 1.9 };
    },
    draw(S) {
      const c = S.ctx, b = S.b, tall = isTall(S), tk = toks(b), long = tk.length > 3;
      const label = long ? clean((b.text && b.text.eyebrow) || itemsOf(b)[0] || keyWord(b)) : clean(tk.map(t => t.s).join(' '));
      // the world, at scale 1: label + toggle on one line (stacked in a tall frame)
      let px = S.H * (tall ? 0.07 : 0.13);
      const fit = () => { const lw = L.textW(c, S.look, label, { role: 'display', px }), th = px * 0.95; return { lw, th, total: tall ? Math.max(lw, th * 1.75) : lw + px * 0.5 + th * 1.75 }; };
      let m = fit(); if (m.total > S.W * 0.84) { px *= S.W * 0.84 / m.total; m = fit(); }
      const blockY = long ? S.H * (tall ? 0.4 : 0.38) : S.H / 2;
      let lx, ly, tx, ty;
      if (tall) { lx = S.W / 2; ly = blockY - px * 0.25; tx = S.W / 2; ty = blockY + px * 1.05; }
      else { const x0 = S.W / 2 - m.total / 2; lx = x0 + m.lw / 2; ly = blockY + px * 0.36; tx = x0 + m.lw + px * 0.5 + m.th * 0.875; ty = blockY; }
      const pk = E.expo(prog(S.lt, S.at('pull'), 0.55)), zf = tt => lerp(3.1, 1, E.expo(prog(tt, S.at('pull'), 0.55)));
      const z = zf(S.lt), fx = lerp(tx, S.W / 2, pk), fy = lerp(ty, S.H / 2, pk), blur = clamp(Math.abs(L.vel(zf, S.lt)) * 30, 0, 6) * S.u;
      c.save(); c.translate(S.W / 2, S.H / 2); c.scale(z, z); c.translate(-fx, -fy);
      if (blur > 0.4) c.filter = `blur(${blur.toFixed(1)}px)`;
      const w = mkW(S, label, lx, ly, px), ti = tittleI(label), sp = dotSpots(S, w, ti);
      drawW(S, Object.assign({}, w, { s: dotless(label, ti) }));
      const tg = L.get('ui:toggle-accent-drain').draw(S, { x: tx, y: ty, h: m.th, off: S.at('click') });
      c.filter = 'none';
      // the hand-off: the dot is ink while the toggle is on, the accent the moment the track drains
      const hk = E.out(prog(S.lt, S.at('hand'), 0.14));
      if (sp.tit) L.circle(c, sp.tit.x, sp.tit.y, sp.tit.r, mix(S.P.fg, dotCol(S), hk));
      else { const s2 = clamp(spring(S.lt - S.at('hand') - 0.1, 'pop'), 0, 1.3); if (s2 > 0) L.circle(c, sp.per.x, sp.per.y, sp.per.r * s2, dotCol(S)); }
      // the cursor lives in the world (big in the macro), glides onto the knob, clicks, leaves
      const kx = tx + m.th * 0.45, ky = ty + m.th * 0.12, cl = S.at('click');
      const path = [[0.0, tx + m.th * 2.4, ty + m.th * 1.7], [cl - 0.08, kx, ky], [cl + 0.9, tx + m.th * 1.9, ty + m.th * 2.6]];
      const cp = L.cursorAt(path, S.lt), pr = L.pressAt([cl], S.lt), ca = 1 - E.in(prog(S.lt, cl + 0.5, 0.4));
      if (cp && ca > 0) { c.save(); c.globalAlpha *= ca; L.drawCursor(c, cp.x, cp.y + pr.p * 4 * S.u, { u: S.u * 1.05, press: pr.p, dark: lum(S.P.bg) < 0.35 }); c.restore(); }
      c.restore();
      if (long) L.headline(S, { px: S.H * (tall ? 0.062 : 0.085), maxW: S.W * 0.8, x: S.W / 2, y: blockY + (tall ? px * 2.1 : px * 1.25), align: 'center', maxLines: 2 });
      else if (b.text && b.text.sub) L.subDraw(S, b.text.sub, S.W / 2, blockY + (tall ? px * 2.1 : px * 1.3), S.W * 0.6);
      void tg;
    },
  });

  /* the phrase arrives, then every word but the kept one peels off letter by letter along a falling curve (each letter
     turning with the curve, a ribbon dropping out of frame); the kept word centres and grows, its i dotted in the accent */
  L.def('insert:word-peel-keep', {
    kind: 'setup',
    plan(b) { const peel = 0.8; return { cues: { head: 0, peel, grow: peel + 0.22, sub: peel + 1.35 }, events: [{ at: 0.02, event: 'word' }, { at: peel, event: 'build' }, { at: peel + 0.3, event: 'slide-out' }, { at: peel + 0.85, event: 'key-word' }], exit: { kind: 'dot', x: 0.5, y: 0.42, r: 0.016 }, entry: { kind: 'dot', x: 0.5, y: 0.5, r: 0.012 }, min: peel + 2 }; },
    draw(S) {
      const c = S.ctx, b = S.b, tk = toks(b); if (!tk.length) return;
      const ki = keyIdx(b), tall = isTall(S), px0 = S.H * (tall ? 0.06 : 0.1);
      const lay = L.layout(c, S.look, tk, { px: px0, maxW: S.W * 0.84, x: S.W / 2, y: S.H / 2 - px0 * 0.62, align: 'center', maxLines: 3 });
      const inK = E.out(prog(S.lt, 0, 0.55)), dy0 = (1 - inK) * lay.px * 0.7, peel = S.at('peel');
      const kw = lay.words.find(w => w.i === ki) || lay.words[0], kcx = kw.x + kw.w / 2;
      // peel order: from the outside in on each side
      const left = lay.words.filter(w => w !== kw && w.x + w.w / 2 <= kcx && w.li <= kw.li || w !== kw && w.li < kw.li), right = lay.words.filter(w => w !== kw && !left.includes(w));
      const seq = [];
      left.forEach(w => charsOf(S, w).forEach(h => seq.push({ w, h, side: -1 })));
      right.slice().reverse().forEach(w => charsOf(S, w).slice().reverse().forEach(h => seq.push({ w, h, side: 1 })));
      c.save(); c.globalAlpha *= clamp(inK * 2);
      seq.forEach((q, n) => {
        const tt = S.lt - (peel + n * 0.028), s = E.in(clamp(tt / 0.62));
        const p0 = { x: glyphC(q.w, q.h), y: q.w.y + dy0 }, c1 = { x: p0.x + q.side * S.W * 0.16, y: p0.y - S.H * 0.04 }, e = { x: p0.x + q.side * S.W * 0.42, y: S.H * 1.25 };
        const B = (a, b2, d) => (1 - s) * (1 - s) * a + 2 * s * (1 - s) * b2 + s * s * d;
        const x = B(p0.x, c1.x, e.x), y = B(p0.y, c1.y, e.y);
        const tx = 2 * (1 - s) * (c1.x - p0.x) + 2 * s * (e.x - c1.x), ty = 2 * (1 - s) * (c1.y - p0.y) + 2 * s * (e.y - c1.y);
        const rot = (Math.atan2(ty, tx) - (q.side < 0 ? Math.PI : 0)) * clamp(s * 4);
        if (s >= 1) return;
        c.save(); c.translate(x, y); c.rotate(q.side < 0 ? rot : rot); drawCh(S, q.w, q.h, { x: -(q.h.w - (q.w.tr || 0)) / 2, y: 0 }); c.restore();
      });
      c.restore();
      // the kept word: from its place in the line to the centre, growing to fill the frame
      const ks = clean(kw.s), g = E.out(prog(S.lt, S.at('grow'), 0.9));
      const big = Math.min(S.H * (tall ? 0.2 : 0.3), S.W * 0.74 / (L.textW(c, S.look, ks, { role: kw.role, px: 100 }) / 100));
      const px = lerp(kw.px, big, g), x = lerp(kcx, S.W / 2, g), y = lerp(kw.y + dy0, S.H / 2 + big * 0.3, g);
      c.save(); c.globalAlpha *= clamp(inK * 2);
      const w = mkW(S, ks, x, y, px, { role: kw.role }), ti = tittleI(ks), sp = dotSpots(S, w, ti);
      drawW(S, Object.assign({}, w, { s: dotless(ks, ti) }));
      if (sp.tit) L.circle(c, sp.tit.x, sp.tit.y, sp.tit.r, dotCol(S));
      else { const s2 = clamp(spring(S.lt - S.at('grow') - 0.7, 'pop'), 0, 1.3); if (s2 > 0) L.circle(c, sp.per.x, sp.per.y, sp.per.r * s2, dotCol(S)); }
      c.restore();
      if (b.text.sub) L.subDraw(S, b.text.sub, S.W / 2, S.H / 2 + big * 0.62, S.W * 0.6);
    },
  });

  /* one big word; its accent dot drops onto the i, then hops from letter to letter on the beat (squash, stretch, a
     contact shadow on each landing, the letter dipping under it) and finally lands as the word's full stop */
  function hopWordPlan(b, F) {
    const q = qOf(F), s = keyWord(b), ti = tittleI(s), st = ti >= 0 ? ti : 0, rest = [];
    for (let i = st + 1; i < s.length; i++) if (/[a-z0-9]/i.test(s[i])) rest.push(i);
    const picks = rest.length >= 3 ? [rest[Math.floor(rest.length * 0.3)], rest[Math.floor(rest.length * 0.75)]] : rest.length ? [rest[rest.length - 1]] : [];
    const drop = 0.38, land0 = drop + 0.22, hops = picks.map((p, i) => ({ at: land0 + 0.32 + i * q, d: q * 0.93 })), end = land0 + 0.32 + picks.length * q;
    return { q, s, ti, st, picks, drop, land0, hops, end, d2: q * 0.93 };
  }
  L.def('insert:dot-hop-word', {
    kind: 'setup',
    plan(b, F) {
      const h = hopWordPlan(b, F);
      return { cues: { word: 0, drop: h.drop, eyebrow: 0.1, sub: h.end + 0.9 }, events: [{ at: 0.03, event: 'key-word' }, { at: h.land0, event: 'pop' }, ...h.hops.map(x => ({ at: x.at + x.d, event: 'pop' })), { at: h.end + h.d2, event: 'accent' }], exit: { kind: 'dot', x: 0.84, y: 0.58, r: 0.03 }, entry: { kind: 'dot', x: 0.5, y: 0.2, r: 0.02 }, min: h.end + h.d2 + 1.0 };
    },
    draw(S) {
      const c = S.ctx, b = S.b, h = hopWordPlan(b, L.film), s = h.s, tall = isTall(S);
      const px = Math.min(S.H * (tall ? 0.22 : 0.34), S.W * 0.74 / (L.textW(c, S.look, s, { role: 'display', px: 100 }) / 100));
      const y = S.H / 2 + px * 0.32, w = mkW(S, s, S.W / 2, y, px), sp = dotSpots(S, w, h.ti), r = sp.per.r;
      const top = j => ({ x: glyphC(w, sp.ch[j]), y: sp.ch[j].top - r - px * 0.015 });
      const start = sp.tit || top(0);
      const hops = [{ at: h.drop, d: 0.22, x: start.x, y: start.y, fall: true, noAnt: true }];
      h.picks.forEach((j, i) => { const p = top(j); hops.push({ at: h.hops[i].at, d: h.hops[i].d, x: p.x, y: p.y, apex: px * 0.5 }); });
      hops.push({ at: h.end, d: h.d2, x: sp.per.x, y: sp.per.y, apex: px * 0.42 });
      const lands = hops.map((x, i) => ({ at: x.at + x.d, j: i === 0 ? h.st : h.picks[i - 1] }));
      // the word rises out of its baseline mask; each letter dips when the dot lands on it
      const k = E.out(prog(S.lt, 0, 0.55));
      c.save(); c.beginPath(); c.rect(0, y - px * 1.3, S.W, px * 1.6); c.clip();
      sp.ch.forEach(ch => {
        let dip = 0; for (const l of lands) if (l.j === ch.i && S.lt >= l.at) dip = Math.max(dip, (1 - spring(S.lt - l.at, [12, 300, 1])) * 0.06);
        c.save(); c.translate(0, y + (1 - k) * px * 1.15); c.scale(1 + dip * 0.4, 1 - dip); c.translate(0, -y);
        if (dip) { c.translate(glyphC(w, ch), 0); c.scale(1 / (1 + dip * 0.4), 1); c.translate(-glyphC(w, ch), 0); }
        drawCh(S, w, ch); c.restore();
      });
      c.restore();
      if (b.text.eyebrow) L.eyebrowDraw(S, b.text.eyebrow, S.W / 2, y - px * 1.18);
      if (b.text.sub) L.subDraw(S, b.text.sub, S.W / 2, y + px * 0.42, S.W * 0.6);
      if (S.lt < h.drop) return;
      const f = tt => hopAt(tt, { x: start.x, y: -r * 4 }, hops, r), p = f(S.lt);
      // contact shadow: on the surface under the dot, smaller and darker as it comes down
      if (p.air && p.to) { const surf = lerp(p.from.y, p.to.y, p.u) + r, hgt = surf - (p.y + r), a = 0.16 * (1 - clamp(hgt / (px * 0.7))); if (a > 0.01) { c.save(); c.fillStyle = rgba(S.P.fg, a); c.beginPath(); c.ellipse(p.x, surf, r * (1.1 + hgt / px), r * 0.22, 0, 0, TAU); c.fill(); c.restore(); } }
      blobTrail(c, f, S.lt, r, dotCol(S));
    },
  });

  /* the spring graph: a bare chart slides in, the dot drops to the origin and rides one damped spring along a steady time
     axis, drawing its own beaded curve; the brand's number rises at the overshoot */
  const chartBox = (S, b) => {
    const wide = S.W / S.H > 1.1;
    const x0 = S.W * (wide ? 0.2 : 0.12), x1 = S.W * (wide ? 0.86 : 0.88), oy = S.H * (wide ? 0.84 : isTall(S) ? 0.7 : 0.82), top = S.H * (wide ? 0.32 : isTall(S) ? 0.4 : 0.36);
    return { x0, x1, oy, top, rise: (oy - top) / 1.25 * 0.94 };
  };
  L.def('insert:spring-trace-chart', {
    kind: 'setup',
    plan(b, F) {
      const run = 0.85, dur = Math.max(1.6, Math.min(2.4, ((b && b.d) || 4) - 1.3)), wide = !F || F.W / F.H > 1.1;
      return { cues: { head: 0.05, headDone: 0.7, axes: 0.1, drop: 0.3, run, dur }, events: [{ at: 0.1, event: 'slide-out' }, { at: 0.62, event: 'pop' }, { at: run, event: 'build' }, { at: run + PEAK + 0.04, event: 'stat' }], exit: { kind: 'dot', x: wide ? 0.86 : 0.88, y: wide ? 0.43 : 0.5, r: 0.018 }, entry: { kind: 'dot', x: 0.2, y: 0.84, r: 0.016 }, min: run + 2 };
    },
    draw(S) {
      const c = S.ctx, b = S.b, d = b.data || {}, bx = chartBox(S, b), n = d.number, tall = isTall(S);
      if (toks(b).length) L.headline(S, { px: S.H * (tall ? 0.05 : 0.068), maxW: S.W * (tall ? 0.8 : 0.62), x: bx.x0, y: S.H * (tall ? 0.14 : 0.09), align: 'left', maxLines: 2 });
      L.get('ui:bare-axes-target').draw(S, { x0: bx.x0, x1: bx.x1, oy: bx.oy, top: bx.top, ty: bx.oy - bx.rise, t0: S.at('axes') });
      const r = Math.min(S.W, S.H) * 0.024, run = S.at('run'), dur = S.at('dur') || 2.2;
      L.get('ui:spring-bead-trace').draw(S, { x0: bx.x0, oy: bx.oy, len: bx.x1 - bx.x0, rise: bx.rise, t0: run, dur, r, callout: n ? numStr(n) : keyWord(b), label: n && n.label, px: S.H * (tall ? 0.05 : 0.075), noDot: S.lt < run });
      if (S.lt < run && S.lt > S.at('drop')) blobTrail(c, tt => hopAt(tt, { x: bx.x0 - S.W * 0.08, y: bx.top - S.H * 0.1 }, [{ at: S.at('drop'), d: 0.32, x: bx.x0, y: bx.oy, apex: S.H * 0.06 }], r), S.lt, r, dotCol(S));
    },
  });

  /* one shape, four states, one per beat, the ground hard-cutting with it: an accent disc on ink → inverted (ink on the
     accent) turning into a diamond squircle inside a guide circle → paper, the shape levels and stretches into a pill
     holding the key word (old pose left as an outline) → ink, the pill contracts to a dot that flies to be the line's
     full stop as the headline rises */
  L.def('insert:shape-state-beats', {
    kind: 'setup',
    plan(b, F) { const q = qOf(F); return { cues: { m1: q, m2: 2 * q, m3: 3 * q, head: 3 * q + 0.32, headDone: 3 * q + 0.9, land: 3 * q + 0.84 }, events: [{ at: 0.0, event: 'hard-hit' }, { at: q, event: 'hard-hit' }, { at: 2 * q, event: 'hard-hit' }, { at: 3 * q, event: 'pop' }, { at: 3 * q + 0.32, event: 'key-word' }, { at: 3 * q + 0.84, event: 'accent' }], entry: { kind: 'circle', x: 0.5, y: 0.5, r: 0.22 }, exit: { kind: 'dot', x: 0.5, y: 0.5, r: 0.012 }, min: 3 * q + 2 }; },
    draw(S) {
      const c = S.ctx, b = S.b, lt = S.lt, m1 = S.at('m1'), m2 = S.at('m2'), m3 = S.at('m3');
      const acc = S.look.accent, ink = S.look.palette.ink, paper = S.look.palette.paper;
      const stage = lt < m1 ? 0 : lt < m2 ? 1 : lt < m3 ? 2 : 3;
      const ground = [ink, acc, paper, ink][stage], fill = [acc, ink, acc, acc][stage];
      c.fillStyle = ground; c.fillRect(-S.W, -S.H, S.W * 3, S.H * 3);
      const mn = Math.min(S.W, S.H), R = mn * 0.24, cx = S.W / 2, cy = S.H / 2;
      const side = 2 * R * 0.86, ph = 2 * R * 0.6, pw = Math.min(S.W * 0.84, ph * 3.2), dd = mn * 0.034;
      let w = springTrack(lt, [[0, 2 * R], [m1, side], [m2, pw]], 'snap'), h = springTrack(lt, [[0, 2 * R], [m1, side], [m2, ph]], 'snap');
      let rad = springTrack(lt, [[0, R], [m1, side * 0.22], [m2, ph / 2]], 'snap');
      const rot = springTrack(lt, [[0, 0], [m1, Math.PI / 4], [m2, 0]], 'pop');
      if (lt >= m3) { w = lerp(pw, dd, E.io(prog(lt, m3, 0.15))); h = lerp(ph, dd, E.io(prog(lt, m3 + 0.03, 0.15))); rad = h / 2; }
      const s0 = lerp(0.12, 1, clamp(spring(lt, 'pop'), 0, 1.2));
      if (stage === 0) { w *= s0; h *= s0; rad *= s0; }
      // the construction ghosts: the guide circle, the previous pose, the pill's outline
      ghost(c, S, stage === 1 ? 0.7 * (1 - prog(lt, m1 + 0.12, 0.3)) : 0, ink, () => { c.beginPath(); c.arc(cx, cy, side * 0.5 * Math.SQRT2 * 0.86, 0, TAU); });
      ghost(c, S, stage === 2 ? 0.8 * (1 - prog(lt, m2 + 0.16, 0.3)) : 0, acc, () => shapePath(c, cx, cy, side, side, side * 0.22, Math.PI / 4));
      ghost(c, S, stage === 3 ? 0.85 * (1 - prog(lt, m3 + 0.18, 0.4)) : 0, acc, () => shapePath(c, cx, cy, pw, ph, ph / 2, 0));
      const head = S.at('head'), land = S.at('land');
      if (lt < head + 0.1) {
        const vr = Math.abs(L.vel(tt => springTrack(tt, [[0, 0], [m1, Math.PI / 4], [m2, 0]], 'pop'), lt));
        if (vr > 0.02) { c.save(); c.globalAlpha *= 0.3; shapePath(c, cx, cy, w, h, rad, rot - vr * 1.4); c.fillStyle = fill; c.fill(); c.restore(); }
        shapePath(c, cx, cy, w, h, rad, rot); c.fillStyle = fill; c.fill();
        if (stage === 2) { // the pill holds the key word
          const kw = keyWord(b), px = Math.min(h * 0.5, w * 0.78 / (L.textW(c, S.look, kw, { role: 'display', px: 100 }) / 100));
          c.save(); shapePath(c, cx, cy, w, h, rad, rot); c.clip();
          const k = E.out(prog(lt, m2 + 0.04, 0.3));
          L.text(c, S.look, kw, cx, cy + px * 0.36 + (1 - k) * h * 0.6, { role: 'display', px, color: onColor(acc), align: 'center' });
          c.restore();
        }
      }
      // the headline rises on ink; the dot flies over and lands as its full stop
      if (lt >= head - 0.02) {
        const S2 = S2of(S, 'ink'), tk = noStop(toks(b)), tall = isTall(S);
        const px = S.H * (tall ? 0.085 : 0.13) * (tk.length > 5 ? 0.8 : 1);
        const lay = tk.length ? L.headline(S2, { px, maxW: S.W * 0.82, x: cx, y: cy - px * 0.62, align: 'center', maxLines: 3 }, { tokens: tk }) : null;
        const last = lay && lay.words[lay.words.length - 1];
        const per = last ? dotSpots(S2, Object.assign({}, last, { s: last.s }), -1).per : { x: cx, y: cy, r: dd / 2 };
        const rr = lerp(dd / 2, per.r, E.out(prog(lt, head + 0.1, 0.5)));
        blobTrail(c, tt => hopAt(tt, { x: cx, y: lay ? lay.top - px * 0.2 : cy }, [{ at: head + 0.08, d: land - head - 0.08, x: per.x, y: per.y, apex: S.H * 0.1 }], rr), lt, rr, acc);
      }
    },
  });

  /* the craft as a ring: the brand's items in capitals on a tilted ring spin in around the dot and keep orbiting, the
     near letters passing over it; at the end the dot drops through the ring and out of frame */
  L.def('insert:word-ring-orbit', {
    kind: 'setup',
    plan(b) { const fall = Math.max(2.2, ((b && b.d) || 4) - 0.42); return { cues: { head: 0.05, headDone: 0.7, ring: 0.12, fall }, events: [{ at: 0.12, event: 'scene' }, { at: 0.6, event: 'list-item' }, { at: fall, event: 'slide-out' }], entry: { kind: 'dot', x: 0.5, y: 0.56, r: 0.016 }, exit: { kind: 'dot', x: 0.5, y: 1.02, r: 0.016 }, min: 2.6 }; },
    draw(S) {
      const c = S.ctx, b = S.b, tall = isTall(S), wide = isWide(S);
      const it = itemsOf(b).length ? itemsOf(b).slice(0, 5) : toks(b).map(t => clean(t.s));
      const cx = S.W / 2, cy = S.H * (tall ? 0.56 : 0.57), rx = wide ? Math.min(S.W * 0.4, S.H * 0.74) : S.W * 0.4, ry = rx * (tall ? 0.42 : 0.3);
      if (toks(b).length && itemsOf(b).length) L.headline(S, { px: S.H * (tall ? 0.05 : 0.08), maxW: S.W * 0.8, x: cx, y: S.H * (tall ? 0.2 : 0.07), align: 'center', maxLines: 2 });
      const r = Math.min(S.W, S.H) * 0.028, fall = S.at('fall');
      L.get('ui:word-ring-3d').draw(S, { x: cx, y: cy, rx, ry, words: it, t0: S.at('ring'), px: rx * (tall ? 0.2 : 0.21), mid: () => {
        const fk = E.in(prog(S.lt, fall, 0.36)), br = 1 + Math.sin(S.lt * 4) * 0.03 * (1 - fk), st = 1 + fk * 0.3;
        const pop = clamp(spring(S.lt - 0.02, 'pop'), 0, 1.2);
        blob(c, { x: cx, y: cy + fk * S.H * 0.6, sx: br / Math.sqrt(st), sy: br * st }, r * pop, dotCol(S));
      } });
    },
  });

  /* the halftone pond, seen from above: the dot falls toward the paper (shrinking, its shadow sliding in under it),
     lands, and the grid answers with a ring of swollen dots on two beats; the field parts to let the headline in */
  L.def('insert:halftone-pond-drop', {
    kind: 'setup',
    plan(b, F) { const q = qOf(F), land = 0.5; return { cues: { land, r2: land + q, head: land + 0.3, headDone: land + 0.9, sub: land + 1.0 }, events: [{ at: 0.02, event: 'slide-out' }, { at: land, event: 'pop' }, { at: land + q, event: 'pop' }, { at: land + 0.3, event: 'key-word' }], exit: { kind: 'dot', x: 0.5, y: 0.34, r: 0.013 }, entry: { kind: 'circle', x: 0.5, y: 0.34, r: 0.12 }, min: land + 1.9 }; },
    draw(S) {
      const c = S.ctx, b = S.b, tall = isTall(S), lt = S.lt, land = S.at('land');
      const pitch = 54 * S.u, base = 4.6 * S.u, dx = S.W / 2, dy = S.H * (tall ? 0.36 : 0.32);
      const tk = toks(b), px = S.H * (tall ? 0.07 : 0.105);
      const lay0 = tk.length ? L.layout(c, S.look, tk, { px, maxW: S.W * 0.8, x: S.W / 2, y: S.H * (tall ? 0.48 : 0.5), align: 'center', maxLines: 2 }) : null;
      const pad = pitch * 0.9, box = lay0 ? { x0: S.W / 2 - lay0.W / 2 - pad, x1: S.W / 2 + lay0.W / 2 + pad, y0: lay0.top - pad * 0.6, y1: lay0.bottom + pad * (b.text.sub ? 2.4 : 0.6) } : null;
      const hk = E.out(prog(lt, S.at('head') - 0.12, 0.5)), v = 1100 * S.u, hits = [land, S.at('r2')];
      halftone(c, S, pitch, S.P.fg, (x, y) => {
        const d = Math.hypot(x - dx, y - dy); let rr = base * ripple(d, lt, hits, v, 70 * S.u, 2.6);
        if (box && hk > 0) { const ox = Math.max(box.x0 - x, 0, x - box.x1), oy = Math.max(box.y0 - y, 0, y - box.y1); rr *= 1 - hk * (1 - clamp(Math.max(ox, oy) / (pitch * 1.6))); }
        return rr;
      });
      // the falling dot and its shadow (height = 1 → 0)
      const z = 1 - E.in(prog(lt, 0, land)), r = lerp(Math.min(S.W, S.H) * 0.026, Math.min(S.W, S.H) * 0.13, z);
      const so = lerp(9, 150, z) * S.u, sb = lerp(3, 30, z) * S.u;
      c.save(); c.filter = `blur(${sb.toFixed(1)}px)`; L.circle(c, dx + so * 0.7, dy + so, r * lerp(1, 0.8, z), rgba(S.P.fg, lerp(0.22, 0.1, z))); c.restore();
      const sq = lt >= land ? 1 - spring(lt - land, [10, 300, 1]) : 0, br = lt > land + 0.6 ? 1 + Math.sin((lt - land) * 4.5) * 0.025 : 1;
      blob(c, { x: dx, y: dy, sx: (1 + 0.3 * sq) * br, sy: (1 - 0.2 * sq) * br }, r, dotCol(S));
      if (lay0) { const lay = L.headline(S, { px, maxW: S.W * 0.8, x: S.W / 2, y: lay0.top, align: 'center', maxLines: 2 }); if (b.text.sub && lay) L.subDraw(S, b.text.sub, S.W / 2, lay.bottom + 22 * S.u, S.W * 0.6); }
    },
  });

  /* a left-aligned lockup: a grey kicker, the headline in heavy type with the accent dot flying in to be its full stop,
     and a third line whose number is in the accent; at the end the lines sink back into their slots */
  L.def('insert:kicker-title-stat', {
    kind: 'setup',
    plan(b) { const n = b && b.data && b.data.number, sink = Math.max(2.3, ((b && b.d) || 4) - 0.38); return { cues: { kick: 0.04, head: 0.12, headDone: 0.7, land: 0.66, third: 1.1, sink }, events: [{ at: 0.04, event: 'word' }, { at: 0.12, event: 'key-word' }, { at: 0.66, event: 'accent' }, { at: 1.1, event: n ? 'stat' : 'word' }, { at: sink, event: 'slide-out' }], entry: { kind: 'dot', x: 0.5, y: 0.5, r: 0.014 }, exit: { kind: 'dot', x: 0.5, y: 0.5, r: 0.014 }, min: 2.7 }; },
    draw(S) {
      const c = S.ctx, b = S.b, d = b.data || {}, tall = isTall(S), lt = S.lt, x = S.W * (tall ? 0.08 : 0.085);
      const kicker = (b.text && b.text.eyebrow) || brand().name, n = d.number, tk = noStop(toks(b));
      const kpx = S.H * (tall ? 0.03 : 0.048), tpx = S.H * (tall ? 0.085 : 0.16) * (tk.length > 5 ? 0.78 : 1);
      const lay0 = L.layout(c, S.look, tk, { px: tpx, maxW: S.W * 0.84, x, y: 0, align: 'left', maxLines: 3 });
      const third = n ? numStr(n) : (b.text.sub || ''), rest = n ? (n.label || '') : '', thpx = lay0.px * 0.62;
      const blockH = kpx * 1.5 + lay0.H + (third ? thpx * 1.5 : 0), creep = E.out(prog(lt, 0.2, 1.4)) * 12 * S.u;
      const top = S.H / 2 - blockH / 2 - creep, sk = E.in(prog(lt, S.at('sink'), 0.28));
      c.save(); c.beginPath(); c.rect(0, top - kpx * 1.2, S.W, blockH + kpx * 1.6); c.clip(); c.translate(0, sk * blockH * 1.1);
      // the kicker rises from its baseline
      const kk = E.out(prog(lt, S.at('kick'), 0.45));
      c.save(); c.beginPath(); c.rect(0, top - kpx * 1.1, S.W, kpx * 1.4); c.clip(); L.text(c, S.look, kicker, x, top + kpx * 0.1 + (1 - kk) * kpx * 1.2, { role: 'display', px: kpx, weight: 600, color: S.P.dim, maxW: S.W * 0.84 }); c.restore();
      const ty = top + kpx * 0.55, lay = L.headline(S, { px: tpx, maxW: S.W * 0.84, x, y: ty, align: 'left', maxLines: 3 }, { tokens: tk });
      if (third && lay) {
        const k3 = E.out(prog(lt, S.at('third'), 0.4)), by = lay.bottom + thpx * 1.15;
        c.save(); c.beginPath(); c.rect(0, by - thpx * 1.05, S.W, thpx * 1.35); c.clip();
        const yy = by + (1 - k3) * thpx * 1.2, nw = L.text(c, S.look, third, x, yy, { role: 'display', px: thpx, color: n ? dotCol(S) : S.P.dim, maxW: S.W * 0.84 });
        if (rest) L.text(c, S.look, rest, x + nw + thpx * 0.28, yy, { role: 'display', px: thpx, color: S.P.fg, maxW: S.W * 0.84 - nw - thpx * 0.28 });
        c.restore();
      }
      c.restore();
      if (!lay || !lay.words.length) return;
      const last = lay.words[lay.words.length - 1], per = dotSpots(S, last, -1).per, land = S.at('land');
      const lift = E.in(prog(lt, S.at('sink') + 0.06, 0.32)), br = 1 + Math.sin(lt * 4) * 0.03 * clamp(lt - land - 0.5);
      const f = tt => hopAt(tt, { x: S.W / 2, y: S.H / 2 }, [{ at: land - 0.36, d: 0.36, x: per.x, y: per.y - creep * 0 + sk * 0, apex: S.H * 0.11 }], per.r);
      const p = f(lt); p.x = lerp(p.x, S.W / 2, lift); p.y = lerp(p.y, S.H / 2, lift); p.sx *= br; p.sy *= br;
      if (p.air) blobTrail(c, f, lt, per.r, dotCol(S)); else blob(c, p, per.r, dotCol(S));
    },
  });

  /* the line beside a ruled column of the brand's items in grey; the dot hops down onto each on the beat and the word it lands on
     turns to ink and dips under its weight */
  L.def('insert:squash-hop-list', {
    kind: 'setup',
    plan(b, F) { const q = qOf(F), n = Math.max(1, Math.min(4, itemsOf(b).length)), l0 = 0.62; return { cues: { head: 0.04, headDone: 0.6, items: 0.12, l0, q }, events: [{ at: 0.12, event: 'cascade' }, ...Array.from({ length: n }, (_, i) => ({ at: l0 + i * q, event: 'list-item' }))], entry: { kind: 'dot', x: 0.2, y: 0.1, r: 0.014 }, exit: { kind: 'dot', x: 0.8, y: 0.5, r: 0.014 }, min: l0 + n * q + 0.9 }; },
    draw(S) {
      const c = S.ctx, b = S.b, tall = isTall(S), wide = isWide(S), lt = S.lt, its = itemsOf(b).slice(0, 4), q = S.at('q') || 0.47, l0 = S.at('l0');
      if (!its.length) return;
      // the line on the left (on top when tall), the items as a ruled column the dot walks down
      const n = its.length, x0 = wide ? S.W * 0.53 : S.W * 0.16, colW = wide ? S.W * 0.4 : S.W * 0.72;
      let px = S.H * (tall ? 0.055 : wide ? 0.088 : 0.085);
      const mw = Math.max(...its.map(s => L.textW(c, S.look, s, { role: 'display', px }))); if (mw > colW) px *= colW / mw;
      const sp = px * 1.8, y0 = (tall ? S.H * 0.58 : S.H / 2) - (n - 1) * sp / 2 + px * 0.36;
      if (toks(b).length) {
        if (wide) { const hp = S.H * 0.095, lay0 = L.layout(c, S.look, toks(b), { px: hp, maxW: S.W * 0.38, x: S.W * 0.08, y: 0, align: 'left', maxLines: 4 }); L.headline(S, { px: hp, maxW: S.W * 0.38, x: S.W * 0.08, y: S.H / 2 - lay0.H / 2, align: 'left', maxLines: 4 }); }
        else L.headline(S, { px: S.H * (tall ? 0.055 : 0.075), maxW: S.W * 0.84, x: S.W / 2, y: S.H * (tall ? 0.14 : 0.08), align: 'center', maxLines: 3 });
      }
      const r = px * 0.13, lands = its.map((_, i) => l0 + i * q), rule = rgba(S.P.fg, 0.12);
      its.forEach((s, i) => {
        const at = L.stagger(S.at('items'), i, 0.07, 3), k = E.out(prog(lt, at, 0.5)); if (k <= 0) return;
        const y = y0 + i * sp, lit = lt >= lands[i], lk = lit ? E.out(prog(lt, lands[i], 0.14)) : 0, dip = lit ? (1 - spring(lt - lands[i], [12, 300, 1])) * 0.07 : 0;
        const slide = lit ? clamp(spring(lt - lands[i], 'ui'), 0, 1.1) * 14 * S.u : 0;
        c.save(); c.globalAlpha *= clamp(k * 2);
        L.line(c, x0 - px * 0.9, y + sp * 0.5 - px * 0.36, x0 - px * 0.9 + (colW + px * 0.9) * k, y + sp * 0.5 - px * 0.36, rule, 1.2 * S.u);
        if (i === 0) L.line(c, x0 - px * 0.9, y - sp * 0.5 - px * 0.36, x0 - px * 0.9 + (colW + px * 0.9) * k, y - sp * 0.5 - px * 0.36, rule, 1.2 * S.u);
        L.text(c, S.look, String(i + 1).padStart(2, '0'), x0 - px * 0.9, y - px * 0.08, { role: 'micro', px: Math.max(13 * S.u, px * 0.24), color: lit ? S.P.accent : S.P.dim });
        c.translate(x0 + slide, y + (1 - k) * px * 0.5); c.scale(1 + dip * 0.3, 1 - dip);
        L.text(c, S.look, s, 0, 0, { role: 'display', px, color: mix(mix(S.P.bg, S.P.fg, 0.28), S.P.fg, lk) });
        c.restore();
      });
      const tops = its.map((s, i) => ({ x: x0 + px * 0.32 + (lt >= lands[i] ? 14 * S.u : 0), y: y0 + i * sp - px * 0.74 - r }));
      const hops = [{ at: l0 - 0.3, d: 0.3, x: tops[0].x, y: tops[0].y, fall: true, noAnt: true }];
      for (let i = 1; i < n; i++) hops.push({ at: lands[i] - q * 0.93, d: q * 0.93, x: tops[i].x, y: tops[i].y, apex: px * 0.75 });
      if (lt > l0 - 0.3) blobTrail(c, tt => hopAt(tt, { x: tops[0].x, y: -r * 3 }, hops, r), lt, r, dotCol(S));
    },
  });

  /* the camera dives into the dot at the end of its beaded trail until it is a big disc, and the line appears in it */
  L.def('insert:dot-dive-disc-reveal', {
    kind: 'setup',
    plan(b) { return { cues: { dive: 0.42, head: 0.95, headDone: 1.5, sub: 1.5 }, events: [{ at: 0.02, event: 'build' }, { at: 0.42, event: 'scene' }, { at: 0.95, event: 'key-word' }], entry: { kind: 'dot', x: 0.62, y: 0.5, r: 0.03 }, exit: { kind: 'circle', x: 0.5, y: 0.5, r: 0.3 }, min: 2.3 }; },
    draw(S) {
      const c = S.ctx, b = S.b, lt = S.lt, mn = Math.min(S.W, S.H), r0 = mn * 0.03, dxp = S.W * 0.62, dyp = S.H * 0.5, Rend = mn * 0.32;
      const zk = E.out(prog(lt, S.at('dive'), 0.6)), z = logLerp(1, Rend / r0, zk), Cx = lerp(dxp, S.W / 2, zk), Cy = lerp(dyp, S.H / 2, zk);
      const arrive = E.out(prog(lt, 0, 0.5)), headX = lerp(dxp - S.W * 0.2, dxp, arrive);
      c.save(); c.translate(Cx, Cy); c.scale(z, z); c.translate(-dxp, -dyp);
      // the tail of a settled spring: a beaded line from the left that calms into the dot
      const yAt = x => dyp - S.H * 0.06 * Math.exp(-(headX - x) / (S.W * 0.16)) * Math.sin((headX - x) / (S.W * 0.05)) * clamp((headX - x) / (S.W * 0.03));
      c.strokeStyle = S.P.fg; c.lineWidth = 3 * S.u; c.beginPath();
      for (let x = -S.W * 0.1; x <= headX; x += 4 * S.u) { if (x <= -S.W * 0.1) c.moveTo(x, yAt(x)); else c.lineTo(x, yAt(x)); }
      c.stroke(); c.fillStyle = S.P.fg; c.beginPath();
      for (let x = headX - 22 * S.u; x > -S.W * 0.1; x -= 22 * S.u) { c.moveTo(x + 4.4 * S.u, yAt(x)); c.arc(x, yAt(x), 4.4 * S.u, 0, TAU); }
      c.fill();
      const br = zk >= 1 ? 1 + Math.sin(lt * 3) * 0.008 : 1;
      L.circle(c, headX, dyp, r0 * br, S.look.accent);
      c.restore();
      if (lt >= S.at('head') && toks(b).length) {
        const S2 = S2of(S, 'flood'), R = Rend, px = R * 0.3, mw = R * 1.5;
        const lay0 = L.layout(c, S.look, toks(b), { px, maxW: mw, x: S.W / 2, y: 0, align: 'center', maxLines: 3 });
        L.headline(S2, { px, maxW: mw, x: S.W / 2, y: S.H / 2 - lay0.H / 2, align: 'center', maxLines: 3 });
      }
    },
  });

  /* ════════════════════ END CARDS ════════════════════ */

  /* left-aligned closing lockup: the tagline as a grey kicker, the brand's name heavy with the accent dot arcing in to
     be its full stop (then breathing), the address (or the brand's number, numeral in the accent) as the third line */
  L.def('end_card:kicker-title-period', {
    kind: 'end',
    plan(b) { const n = b && b.data && b.data.number; return { cues: { kick: 0.05, mark: 0.13, land: 0.62, third: 1.15 }, events: [{ at: 0.05, event: 'word' }, { at: 0.13, event: 'key-word' }, { at: 0.62, event: 'cta' }, { at: 1.15, event: n ? 'stat' : 'word' }], entry: { kind: 'dot', x: 0.5, y: 0.5, r: 0.014 }, min: 2.4 }; },
    draw(S) {
      const c = S.ctx, B = brand(), lt = S.lt, tall = isTall(S), x = S.W * (tall ? 0.08 : 0.085);
      const name = clean(B.name), kicker = B.tagline || B.host, third = B.host && B.tagline ? B.host : '';
      const kpx = S.H * (tall ? 0.03 : 0.05);
      const tpx = Math.min(S.H * (tall ? 0.13 : 0.27), S.W * 0.74 / (L.textW(c, S.look, name, { role: 'wordmark', px: 100 }) / 100)), thpx = tpx * 0.42;
      const blockH = kpx * 1.6 + tpx * 1.05 + (third ? thpx * 1.8 : 0), creep = E.out(prog(lt, 0.3, 1.6)) * 12 * S.u, top = S.H / 2 - blockH / 2 - creep;
      const rise = (s, y, px, at, o) => { const k = E.out(prog(lt, at, 0.42)); if (k <= 0) return 0; c.save(); c.beginPath(); c.rect(0, y - px * 1.05, S.W, px * 1.35); c.clip(); const w = L.text(c, S.look, s, x, y + (1 - k) * px * 1.15, Object.assign({ px, maxW: S.W * 0.84 }, o)); c.restore(); return w; };
      rise(kicker, top + kpx, kpx, S.at('kick'), { role: 'display', weight: 600, color: S.P.dim });
      const ty = top + kpx * 1.6 + tpx * 0.78;
      rise(name, ty, tpx, S.at('mark'), { role: 'wordmark', color: S.P.fg });
      if (third) { const yy = ty + thpx * 1.8; const k = E.out(prog(lt, S.at('third'), 0.42)); if (k > 0) { c.save(); c.beginPath(); c.rect(0, yy - thpx * 1.05, S.W, thpx * 1.35); c.clip(); const y2 = yy + (1 - k) * thpx * 1.15; L.icon(c, 'arrowRight', x + thpx * 0.4, y2 - thpx * 0.34, thpx * 0.8, dotCol(S), 2.4); L.text(c, S.look, third, x + thpx * 1.05, y2, { role: 'display', px: thpx, color: S.P.fg, maxW: S.W * 0.7 }); c.restore(); } }
      const w = mkW(S, name, x, ty, tpx, { role: 'wordmark', align: 'left' }), per = dotSpots(S, w, -1).per, land = S.at('land');
      const br = 1 + Math.sin(lt * 3.6) * 0.035 * clamp(lt - land - 0.45);
      const f = tt => hopAt(tt, { x: S.W / 2, y: S.H / 2 }, [{ at: land - 0.36, d: 0.36, x: per.x, y: per.y, apex: S.H * 0.11 }], per.r);
      const p = f(lt); p.sx *= br; p.sy *= br;
      if (p.air) blobTrail(c, f, lt, per.r, dotCol(S)); else blob(c, p, per.r, dotCol(S));
    },
  });

  /* the dot becomes the button: dot → diamond squircle (in a guide circle) → a pill holding the address, the
     wordmark rising above it, the old pose left as a fading outline; the cursor clicks the pill */
  L.def('end_card:shape-morph-pill-host', {
    kind: 'end',
    plan(b, F) { const q = qOf(F); return { cues: { m1: q, m2: 2 * q, mark: 2 * q + 0.08, tag: 2 * q + 0.5, click: 2 * q + 1.2 }, events: [{ at: 0.0, event: 'pop' }, { at: q, event: 'hard-hit' }, { at: 2 * q, event: 'cta' }, { at: 2 * q + 0.1, event: 'key-word' }, { at: 2 * q + 1.2, event: 'click-ui' }], entry: { kind: 'dot', x: 0.5, y: 0.6, r: 0.016 }, min: 2 * q + 1.9 }; },
    draw(S) {
      const c = S.ctx, B = brand(), lt = S.lt, tall = isTall(S), m1 = S.at('m1'), m2 = S.at('m2'), mn = Math.min(S.W, S.H);
      const acc = onGround(S, S.P.bg), cx = S.W / 2, cy = S.H * (tall ? 0.56 : 0.62);
      const host = B.host || B.name, hpx = mn * 0.066, hw = L.textW(c, S.look, host, { role: 'display', px: hpx, weight: 650 });
      const ph = mn * 0.16, pw = Math.min(S.W * 0.84, hw + ph * 1.3), side = mn * 0.3, dd = mn * 0.04;
      const w = springTrack(lt, [[0, dd], [m1, side], [m2, pw]], 'snap'), h = springTrack(lt, [[0, dd], [m1, side], [m2, ph]], 'snap');
      const rad = springTrack(lt, [[0, dd / 2], [m1, side * 0.22], [m2, ph / 2]], 'snap'), rot = springTrack(lt, [[0, 0], [m1, Math.PI / 4], [m2, 0]], 'pop');
      const pop = clamp(spring(lt, 'pop'), 0, 1.2), press = L.pressAt([S.at('click')], lt).p, sc = pop * (1 - press * 0.05);
      ghost(c, S, lt >= m1 && lt < m2 ? 0.7 * (1 - prog(lt, m1 + 0.15, 0.4)) : 0, acc, () => { c.beginPath(); c.arc(cx, cy, side * 0.62, 0, TAU); });
      ghost(c, S, lt >= m2 ? 0.8 * (1 - prog(lt, m2 + 0.18, 0.4)) : 0, acc, () => shapePath(c, cx, cy, side, side, side * 0.22, Math.PI / 4));
      c.save(); c.translate(cx, cy); c.scale(sc, sc); c.translate(-cx, -cy);
      shapePath(c, cx, cy, w, h, rad, rot); c.fillStyle = acc; c.fill();
      if (lt >= m2) { const k = E.out(prog(lt, m2 + 0.06, 0.35)); c.save(); shapePath(c, cx, cy, w, h, rad, rot); c.clip(); L.text(c, S.look, host, cx, cy + hpx * 0.36 + (1 - k) * ph * 0.7, { role: 'display', px: hpx, weight: 650, color: onColor(acc), align: 'center' }); c.restore(); }
      c.restore();
      const mpx = Math.min(S.H * (tall ? 0.12 : 0.2), S.W * 0.72 / (L.textW(c, S.look, B.name, { role: 'wordmark', px: 100 }) / 100)), my = cy - ph * 0.9 - mpx * 0.28;
      const mk = E.out(prog(lt, S.at('mark'), 0.55));
      if (mk > 0) { c.save(); c.beginPath(); c.rect(0, my - mpx * 1.05, S.W, mpx * 1.32); c.clip(); L.text(c, S.look, B.name, cx, my + (1 - mk) * mpx * 1.15, { role: 'wordmark', px: mpx, color: S.P.fg, align: 'center' }); c.restore(); }
      if (B.tagline) { const tk = E.out(prog(lt, S.at('tag'), 0.5)); if (tk > 0) { c.save(); c.globalAlpha *= tk; L.text(c, S.look, B.tagline, cx, cy + ph * 0.5 + mn * 0.075 + (1 - tk) * 10 * S.u, { role: 'display', weight: 500, px: mn * 0.04, color: S.P.dim, align: 'center', maxW: S.W * 0.8 }); c.restore(); } }
      L.cursorDraw(S, [[S.at('tag') + 0.1, 0.7, 0.95], [S.at('click') - 0.05, 0.5 + pw / S.W * 0.25, cy / S.H + 0.01], [S.d + 1, 0.56, cy / S.H + 0.08]], [S.at('click')]);
    },
  });

  /* ════════════════════ TYPE TREATMENTS ════════════════════ */

  /* lines rise from their masks; the i of the key word is dotless and the accent dot drops onto it with a squash (no i:
     the dot drops in as the line's full stop) */
  const tittleLand = (lines, t0) => t0 + 0.5 + (lines - 1) * 0.08 + 0.2;
  L.def('effect:type-accent-tittle', {
    kind: 'type',
    plan(b, F, t0 = 0) { const n = toks(b).length, lines = Math.min(3, Math.ceil(n / 3)), land = tittleLand(lines, t0); return { words: Array(n).fill(t0), done: land + 0.15, events: [{ at: land, event: 'accent' }] }; },
    draw(S, o) {
      const lay = o.lay, c = S.ctx, t0 = o.t0 || 0, n = lay.words.length; if (!n) return;
      let wi = lay.words.findIndex(w => w.tk.accent && tittleI(w.s) >= 0); if (wi < 0) wi = lay.words.findIndex(w => tittleI(w.s) >= 0);
      const per = wi < 0, tw = per ? lay.words[n - 1] : lay.words[wi], ti = per ? -1 : tittleI(tw.s);
      const sp = dotSpots(S, per ? Object.assign({}, tw, { s: clean(tw.s) }) : tw, ti), spot = per ? sp.per : sp.tit;
      for (let li = 0; li < lay.lines; li++) {
        const bx = lineBox(lay, li), k = E.out(prog(S.lt, t0 + li * 0.08, 0.6)); if (k <= 0) continue;
        c.save(); c.beginPath(); c.rect(bx.x0 - lay.px, bx.top - lay.px * 0.25, bx.x1 - bx.x0 + lay.px * 2, bx.bottom - bx.top + lay.px * 0.3); c.clip();
        for (const w of lay.words) if (w.li === li) drawW(S, Object.assign({}, w, { s: w === tw ? (per ? clean(w.s) : dotless(w.s, ti)) : w.s }), { y: w.y + (1 - k) * lay.px * 1.15 });
        c.restore();
      }
      const land = tittleLand(lay.lines, t0);
      if (S.lt < land - 0.3) return;
      blobTrail(c, tt => hopAt(tt, { x: spot.x, y: spot.y - S.H * 0.32 }, [{ at: land - 0.3, d: 0.3, x: spot.x, y: spot.y, fall: true, noAnt: true }], spot.r), S.lt, spot.r, dotCol(S));
    },
  });

  /* letter hop: letters spring up from the baseline one after another while the accent dot hops over the line, landing on
     each word as it lands, and ends as the full stop */
  const hopGap = b => { const ch = toks(b).reduce((a, t) => a + t.s.length, 0); return { ch, gap: Math.min(0.03, 0.9 / Math.max(1, ch)) }; };
  L.def('effect:type-letter-hop', {
    kind: 'type',
    plan(b, F, t0 = 0) { const { ch, gap } = hopGap(b), end = t0 + ch * gap + 0.3; let idx = 0; const ws = toks(b).map(t => { const at = t0 + idx * gap; idx += t.s.length; return +at.toFixed(3); }); return { words: ws, done: end + 0.15, events: [{ at: t0, event: 'cascade' }, { at: end, event: 'accent' }] }; },
    draw(S, o) {
      const lay = o.lay, c = S.ctx, t0 = o.t0 || 0, n = lay.words.length; if (!n) return;
      const chars = lay.words.reduce((a, w) => a + w.s.length, 0), gap = Math.min(0.03, 0.9 / Math.max(1, chars)), last = lay.words[n - 1];
      let idx = 0; const tops = [];
      for (const w of lay.words) {
        const s = w === last ? clean(w.s) : w.s, ch = charsOf(S, w, s);
        for (const h of ch) {
          const sp = spring(S.lt - (t0 + (idx + h.i) * gap), 'pop'); if (sp <= 0.002) continue;
          c.save(); c.globalAlpha *= clamp(sp * 3); c.translate(0, w.y); c.scale(1, clamp(sp, 0, 1.35)); c.translate(0, -w.y); drawCh(S, w, h); c.restore();
        }
        tops.push({ x: w.x + w.w / 2, y: w.y - w.px * 0.82, at: t0 + (idx + s.length * 0.6) * gap });
        idx += w.s.length;
      }
      const per = dotSpots(S, Object.assign({}, last, { s: clean(last.s) }), -1).per, r = per.r, end = t0 + chars * gap + 0.3;
      const hops = []; let prev = t0 - 0.12;
      tops.forEach(tp => { const at = Math.max(prev + 0.02, tp.at - 0.2); hops.push({ at, d: Math.max(0.12, tp.at - at), x: tp.x, y: tp.y - r, apex: lay.px * 0.35, noAnt: true }); prev = at + Math.max(0.12, tp.at - at); });
      hops.push({ at: Math.max(prev + 0.02, end - 0.26), d: 0.26, x: per.x, y: per.y, apex: lay.px * 0.35, noAnt: true });
      if (S.lt < t0 - 0.12) return;
      blobTrail(c, tt => hopAt(tt, { x: lay.words[0].x - lay.px * 0.4, y: tops[0].y - lay.px * 0.5 }, hops, r), S.lt, r, dotCol(S));
    },
  });

  /* peel-in ribbon: every letter flies in along a falling curve in reverse (a ribbon unspooling into place), turning
     with the curve and landing upright */
  const peelGap = b => { const ch = toks(b).reduce((a, t) => a + t.s.length, 0); return { ch, gap: Math.min(0.024, 0.7 / Math.max(1, ch)) }; };
  L.def('effect:type-peel-in-ribbon', {
    kind: 'type',
    plan(b, F, t0 = 0) { const { ch, gap } = peelGap(b); let idx = 0; const ws = toks(b).map(t => { const at = t0 + idx * gap; idx += t.s.length; return +at.toFixed(3); }); const ai = toks(b).findIndex(t => t.accent); return { words: ws, done: t0 + ch * gap + 0.55, events: [{ at: t0, event: 'riffle' }, ...(ai >= 0 ? [{ at: ws[ai] + 0.5, event: 'key-word' }] : [])] }; },
    draw(S, o) {
      const lay = o.lay, c = S.ctx, t0 = o.t0 || 0, chars = lay.words.reduce((a, w) => a + w.s.length, 0), gap = Math.min(0.024, 0.7 / Math.max(1, chars));
      let idx = 0;
      for (const w of lay.words) {
        for (const h of charsOf(S, w)) {
          const k = prog(S.lt, t0 + (idx + h.i) * gap, 0.55); if (k <= 0) continue;
          const s = 1 - E.out(k), p0 = { x: glyphC(w, h), y: w.y }, c1 = { x: p0.x - S.W * 0.12, y: p0.y + S.H * 0.03 }, e = { x: p0.x - S.W * 0.32, y: p0.y + S.H * 0.6 };
          const B = (a, b2, d) => (1 - s) * (1 - s) * a + 2 * s * (1 - s) * b2 + s * s * d;
          const tx = 2 * (1 - s) * (c1.x - p0.x) + 2 * s * (e.x - c1.x), ty = 2 * (1 - s) * (c1.y - p0.y) + 2 * s * (e.y - c1.y);
          const rot = (Math.atan2(ty, tx) - Math.PI) * clamp(s * 3);
          c.save(); c.globalAlpha *= clamp(k * 4); c.translate(B(p0.x, c1.x, e.x), B(p0.y, c1.y, e.y)); c.rotate(rot);
          drawCh(S, w, h, { x: -(h.w - (w.tr || 0)) / 2, y: 0 }); c.restore();
        }
        idx += w.s.length;
      }
    },
  });

  /* period arc: lines rise from their masks, then the accent dot arcs over the line and lands as its full stop, squashing,
     and keeps breathing */
  const arcLand = (lines, t0) => t0 + 0.5 + (lines - 1) * 0.08 + 0.3;
  L.def('effect:type-period-arc-land', {
    kind: 'type',
    plan(b, F, t0 = 0) { const n = toks(b).length, lines = Math.min(3, Math.ceil(n / 3)), land = arcLand(lines, t0); return { words: Array(n).fill(t0), done: land + 0.1, events: [{ at: t0 + 0.04, event: 'word' }, { at: land, event: 'accent' }] }; },
    draw(S, o) {
      const lay = o.lay, c = S.ctx, t0 = o.t0 || 0, n = lay.words.length; if (!n) return;
      const last = lay.words[n - 1];
      for (let li = 0; li < lay.lines; li++) {
        const bx = lineBox(lay, li), k = E.out(prog(S.lt, t0 + li * 0.08, 0.6)); if (k <= 0) continue;
        c.save(); c.beginPath(); c.rect(bx.x0 - lay.px, bx.top - lay.px * 0.25, bx.x1 - bx.x0 + lay.px * 2, bx.bottom - bx.top + lay.px * 0.3); c.clip();
        for (const w of lay.words) if (w.li === li) drawW(S, Object.assign({}, w, { s: w === last ? clean(w.s) : w.s }), { y: w.y + (1 - k) * lay.px * 1.15 });
        c.restore();
      }
      const per = dotSpots(S, Object.assign({}, last, { s: clean(last.s) }), -1).per, land = arcLand(lay.lines, t0);
      if (S.lt < land - 0.42) return;
      const first = lay.words[0], br = 1 + Math.sin(S.lt * 4) * 0.03 * clamp(S.lt - land - 0.45);
      const f = tt => hopAt(tt, { x: first.x - lay.px * 0.3, y: lay.top - lay.px * 0.15 }, [{ at: land - 0.36, d: 0.36, x: per.x, y: per.y, apex: lay.px * 0.75 }], per.r);
      const p = f(S.lt); p.sx *= br; p.sy *= br;
      if (p.air) blobTrail(c, f, S.lt, per.r, dotCol(S)); else blob(c, p, per.r, dotCol(S));
      if (S.lt < land - 0.25) { const a = E.out(prog(S.lt, land - 0.42, 0.16)); c.save(); c.globalAlpha *= 1 - a; c.restore(); }
    },
  });

  /* numeral accent rise: lines rise from their baselines 80 ms apart; a token with a number rolls up to it in the accent
     (the rest stays ink), and the block keeps creeping up a few px */
  const NUM = /^([^\d]*)(\d[\d,.]*)(.*)$/;
  L.def('effect:type-numeral-accent-rise', {
    kind: 'type',
    plan(b, F, t0 = 0) { const n = toks(b).length, lines = Math.min(3, Math.ceil(n / 3)), hasN = toks(b).some(t => NUM.test(t.s)); return { words: Array(n).fill(t0), done: t0 + 0.5 + (lines - 1) * 0.08, events: [{ at: t0 + 0.02, event: hasN ? 'riffle' : 'word' }, { at: t0 + 0.45, event: hasN ? 'stat' : 'key-word' }] }; },
    draw(S, o) {
      const lay = o.lay, c = S.ctx, t0 = o.t0 || 0, creep = E.out(prog(S.lt, t0 + 0.4, 1.2)) * 10 * S.u;
      for (let li = 0; li < lay.lines; li++) {
        const bx = lineBox(lay, li), k = E.out(prog(S.lt, t0 + li * 0.08, 0.5)); if (k <= 0) continue;
        c.save(); c.translate(0, -creep); c.beginPath(); c.rect(bx.x0 - lay.px, bx.top - lay.px * 0.25, bx.x1 - bx.x0 + lay.px * 2, bx.bottom - bx.top + lay.px * 0.3); c.clip();
        for (const w of lay.words) {
          if (w.li !== li) continue;
          const m = w.s.match(NUM), dy = w.y + (1 - k) * lay.px * 1.15;
          if (!m) { drawW(S, w, { y: dy }); continue; }
          const target = parseFloat(m[2].replace(/,/g, '')), dec = (m[2].split('.')[1] || '').length, rk = E.out(prog(S.lt, t0 + li * 0.08, 0.7));
          const v = (target * rk).toFixed(dec).replace(/\B(?=(\d{3})+(?!\d))/g, m[2].includes(',') ? ',' : '');
          drawW(S, Object.assign({}, w, { s: m[1] + v + m[3] }), { y: dy, fill: S.P.accent });
        }
        c.restore();
      }
    },
  });

  /* slot rise and sink: lines rise out of their slots top line first, hold, and near the end of the beat sink back into
     them bottom line first (the lockup clears itself for the next beat) */
  L.def('effect:type-rise-sink-slots', {
    kind: 'type',
    plan(b, F, t0 = 0) { const n = toks(b).length, lines = Math.min(3, Math.ceil(n / 3)), d = (b && b.d) || 4; return { words: Array(n).fill(t0), done: t0 + 0.45 + (lines - 1) * 0.08, events: [{ at: t0 + 0.03, event: 'word' }, ...(d - 0.4 > t0 + 1 ? [{ at: d - 0.4, event: 'slide-out' }] : [])] }; },
    draw(S, o) {
      const lay = o.lay, c = S.ctx, t0 = o.t0 || 0, out = S.d - 0.4;
      for (let li = 0; li < lay.lines; li++) {
        const bx = lineBox(lay, li), k = E.out(prog(S.lt, t0 + li * 0.08, 0.45)), ks = out > t0 + 1 ? E.in(prog(S.lt, out + (lay.lines - 1 - li) * 0.05, 0.2)) : 0;
        if (k <= 0 || ks >= 1) continue;
        c.save(); c.beginPath(); c.rect(bx.x0 - lay.px, bx.top - lay.px * 0.25, bx.x1 - bx.x0 + lay.px * 2, bx.bottom - bx.top + lay.px * 0.3); c.clip();
        for (const w of lay.words) if (w.li === li) drawW(S, w, { y: w.y + ((1 - k) + ks) * lay.px * 1.15 });
        c.restore();
      }
    },
  });

  /* ════════════════════ TRANSITIONS ════════════════════ */
  const pt = (S, a, dx = 0.5, dy = 0.5) => ({ x: (a && a.x != null ? a.x : dx) * S.W, y: (a && a.y != null ? a.y : dy) * S.H });
  const cover = (S, x, y) => Math.max(Math.hypot(x, y), Math.hypot(S.W - x, y), Math.hypot(x, S.H - y), Math.hypot(S.W - x, S.H - y)) * 1.04;
  const split = (o, k) => { const span = (o.pre || 0) + (o.post || 0) || 1; return clamp(k * span / Math.max(1e-6, o.pre || 1e-6)); };
  const after = (o, k) => { const span = (o.pre || 0) + (o.post || 0) || 1; return clamp((k * span - (o.pre || 0)) / Math.max(1e-6, o.post || 1e-6)); };
  const under = S => (S.t < 0 ? S.P : (S.PA || S.P)).bg;

  /* dive into the dot: the camera dives into A's dot until it is a big disc at the centre; on the cut the disc stands
     on B's ground and contracts into B's first object */
  L.def('transition:dot-dive-disc', {
    kind: 'transition', plan() { return { pre: 0.36, post: 0.4, events: [{ at: -0.36, event: 'scene' }, { at: 0, event: 'hard-hit' }] }; },
    tr(S, A, B, k, o) {
      const c = S.ctx, p0 = pt(S, o.from), mn = Math.min(S.W, S.H), r0 = Math.max(4 * S.u, ((o.from && o.from.r) || 0.014) * S.H), Rend = mn * 0.26;
      if (S.t < o.cut) {
        const g = E.out(split(o, k)), z = logLerp(1, Math.max(1.2, Rend / r0), g), Cx = lerp(p0.x, S.W / 2, g), Cy = lerp(p0.y, S.H / 2, g);
        c.fillStyle = (S.PA || S.P).bg; c.fillRect(0, 0, S.W, S.H);
        c.save(); c.translate(Cx, Cy); c.scale(z, z); c.translate(-p0.x, -p0.y); c.drawImage(A, 0, 0); c.restore();
        L.circle(c, Cx, Cy, r0 * z, onGround(S, (S.PA || S.P).bg));
      } else {
        const g = after(o, k), p1 = pt(S, o.to), r1 = ((o.to && o.to.r) || 0.014) * S.H, e = E.ramp(clamp((g - 0.15) / 0.85));
        c.drawImage(B, 0, 0);
        c.save(); c.globalAlpha = 1 - clamp((g - 0.85) / 0.15); L.circle(c, lerp(S.W / 2, p1.x, e), lerp(S.H / 2, p1.y, e), lerp(Rend, r1, e), onGround(S, S.P.bg)); c.restore();
      }
    },
  });

  /* stage colour cut: on three quick sub-beats the ground hard-cuts ink → accent → paper while one registered shape
     stays put (disc, inverted disc, pill), then B; the shape contracts into B's first object */
  L.def('transition:stage-colour-cut', {
    kind: 'transition', plan() { return { pre: 0.36, post: 0.3, events: [{ at: -0.36, event: 'hard-hit' }, { at: -0.24, event: 'hard-hit' }, { at: -0.12, event: 'hard-hit' }, { at: 0, event: 'pop' }] }; },
    tr(S, A, B, k, o) {
      const c = S.ctx, acc = S.look.accent, ink = S.look.palette.ink, paper = S.look.palette.paper, mn = Math.min(S.W, S.H), R = mn * 0.2, cx = S.W / 2, cy = S.H / 2;
      if (S.t < o.cut) {
        const g = split(o, k), st = g < 1 / 3 ? 0 : g < 2 / 3 ? 1 : 2, lk = (g * 3) % 1;
        if (g < 0.04) { c.drawImage(A, 0, 0); return; }
        c.fillStyle = [ink, acc, paper][st]; c.fillRect(0, 0, S.W, S.H);
        const fill = [acc, ink, acc][st];
        if (st === 2) { const e = E.out(clamp(lk * 2.4)); const w = lerp(R * 1.7, R * 4.2, e), h = lerp(R * 1.7, R * 1.25, e); shapePath(c, cx, cy, w, h, h / 2, 0); }
        else if (st === 1) { const e = E.out(clamp(lk * 2.4)); shapePath(c, cx, cy, R * 1.7, R * 1.7, lerp(R * 0.85, R * 0.4, e), lerp(0, Math.PI / 4, e)); }
        else { const s = clamp(spring(lk * 0.12, 'pop'), 0, 1.2); c.beginPath(); c.arc(cx, cy, R * lerp(0.2, 1, s), 0, TAU); }
        c.fillStyle = fill; c.fill();
      } else {
        const g = after(o, k), p1 = pt(S, o.to), e = E.ramp(g), r1 = ((o.to && o.to.r) || 0.014) * S.H;
        c.drawImage(B, 0, 0);
        const w = lerp(R * 4.2, r1 * 2, e), h = lerp(R * 1.25, r1 * 2, E.ramp(clamp(g * 1.2)));
        c.save(); c.globalAlpha = 1 - clamp((g - 0.85) / 0.15); shapePath(c, lerp(cx, p1.x, e), lerp(cy, p1.y, e), w, h, h / 2, 0); c.fillStyle = onGround(S, S.P.bg); c.fill(); c.restore();
      }
    },
  });

  /* figure-ground invert: the accent floods out of A's dot; on the cut the dot is a hole of A's old ground in the
     accent field, and that hole opens onto B */
  L.def('transition:figure-ground-invert', {
    kind: 'transition', plan() { return { pre: 0.3, post: 0.44, events: [{ at: -0.3, event: 'build' }, { at: 0, event: 'hard-hit' }, { at: 0.14, event: 'scene' }] }; },
    tr(S, A, B, k, o) {
      const c = S.ctx, PA = S.PA || S.P, col = onGround(S, PA.bg), p0 = pt(S, o.from), R = Math.min(S.W, S.H) * 0.2;
      if (S.t < o.cut) {
        const g = E.in(split(o, k)); c.drawImage(A, 0, 0); L.circle(c, p0.x, p0.y, lerp(((o.from && o.from.r) || 0.014) * S.H, cover(S, p0.x, p0.y), g), col);
      } else {
        const g = after(o, k), hold = 0.3, e = E.ramp(clamp((g - hold) / (1 - hold))), p1 = pt(S, o.to), x = lerp(S.W / 2, p1.x, e * 0.4), y = lerp(S.H / 2, p1.y, e * 0.4);
        const r = g < hold ? R * lerp(0.94, 1, E.out(g / hold)) : lerp(R, cover(S, x, y), e);
        c.fillStyle = col; c.fillRect(0, 0, S.W, S.H);
        c.save(); c.beginPath(); c.arc(x, y, r, 0, TAU); c.clip();
        if (g < hold) { c.fillStyle = PA.bg; c.fillRect(0, 0, S.W, S.H); } else c.drawImage(B, 0, 0);
        c.restore();
        if (g >= hold) { c.save(); c.globalAlpha = 0.5 * (1 - e); c.strokeStyle = PA.bg; c.lineWidth = 2.5 * S.u; c.beginPath(); c.arc(x, y, R, 0, TAU); c.stroke(); c.restore(); }
      }
    },
  });

  /* pill contract: A shrinks into a pill on a contrasting ground, then the pill squeezes into a dot inside its own
     fading outline; the dot travels to B's first object and B opens out of it */
  L.def('transition:pill-contract-dot', {
    kind: 'transition', plan() { return { pre: 0.36, post: 0.38, events: [{ at: -0.36, event: 'slide-out' }, { at: -0.1, event: 'pop' }, { at: 0.06, event: 'scene' }] }; },
    tr(S, A, B, k, o) {
      const c = S.ctx, PA = S.PA || S.P, gr = lum(PA.bg) > 0.4 ? S.look.palette.ink : S.look.palette.paper, acc = onGround(S, gr), mn = Math.min(S.W, S.H);
      const pw = Math.min(S.W * 0.7, mn * 1.1), ph = mn * 0.3, dd = mn * 0.03, cx = S.W / 2, cy = S.H / 2;
      c.fillStyle = gr; c.fillRect(0, 0, S.W, S.H);
      if (S.t < o.cut) {
        const g = split(o, k), a = E.io(clamp(g / 0.58)), b2 = clamp((g - 0.58) / 0.42);
        let w = lerp(S.W, pw, a), h = lerp(S.H, ph, a), r = lerp(0, ph / 2, a);
        if (b2 > 0) { w = lerp(pw, dd, E.io(clamp(b2 * 1.25))); h = lerp(ph, dd, E.io(b2)); r = h / 2; }
        if (b2 > 0) ghost(c, S, 0.85 * (1 - b2 * 0.3), acc, () => shapePath(c, cx, cy, pw, ph, ph / 2, 0));
        c.save(); shapePath(c, cx, cy, w, h, r, 0); c.clip(); c.drawImage(A, 0, 0); if (b2 > 0) { c.fillStyle = rgba(acc, clamp(b2 * 3)); c.fillRect(0, 0, S.W, S.H); } c.restore();
      } else {
        const g = after(o, k), p1 = pt(S, o.to), mv = E.io(clamp(g / 0.4)), x = lerp(cx, p1.x, mv), y = lerp(cy, p1.y, mv);
        ghost(c, S, 0.6 * (1 - clamp(g / 0.5)), acc, () => shapePath(c, cx, cy, pw, ph, ph / 2, 0));
        const R = lerp(dd / 2, cover(S, x, y), E.in(clamp((g - 0.35) / 0.65)));
        c.save(); c.beginPath(); c.arc(x, y, R, 0, TAU); c.clip(); c.drawImage(B, 0, 0); c.restore();
        if (g < 0.6) L.circle(c, x, y, dd / 2 * (1 - clamp((g - 0.35) / 0.25)), acc);
      }
    },
  });

  /* halftone flood: dots grow out of A's dot in a halftone front until they merge into one solid colour past the
     corners; then the field breaks back into dots that shrink away from B's first object, revealing B */
  L.def('transition:halftone-flood', {
    kind: 'transition', plan() { return { pre: 0.42, post: 0.42, events: [{ at: -0.42, event: 'build' }, { at: 0, event: 'hard-hit' }] }; },
    tr(S, A, B, k, o) {
      const c = S.ctx, PA = S.PA || S.P, col = lum(PA.bg) > 0.3 ? S.look.palette.ink : onGround(S, PA.bg), pitch = 40 * S.u, maxR = pitch * 0.76, edge = 230 * S.u;
      if (S.t < o.cut) {
        const p0 = pt(S, o.from), g = E.in(split(o, k)), R = lerp(-edge * 0.3, cover(S, p0.x, p0.y) + edge, g);
        c.drawImage(A, 0, 0);
        halftone(c, S, pitch, col, (x, y) => maxR * smoothstep(R + edge, R, Math.hypot(x - p0.x, y - p0.y)));
      } else {
        const p1 = pt(S, o.to), g = E.out(after(o, k)), R = lerp(-edge * 0.5, cover(S, p1.x, p1.y) + edge, g);
        c.drawImage(B, 0, 0);
        halftone(c, S, pitch, col, (x, y) => maxR * smoothstep(R, R + edge, Math.hypot(x - p1.x, y - p1.y)));
      }
    },
  });

  /* depth-fall match cut: A's dot drops out of frame, stretching; on the cut we look down at B and the dot falls toward
     it from close up, shrinking while its shadow slides in under it, landing on B's first object */
  L.def('transition:depth-fall-match', {
    kind: 'transition', plan() { return { pre: 0.3, post: 0.48, events: [{ at: -0.3, event: 'slide-out' }, { at: 0.46, event: 'pop' }] }; },
    tr(S, A, B, k, o) {
      const c = S.ctx, mn = Math.min(S.W, S.H);
      if (S.t < o.cut) {
        const p0 = pt(S, o.from), g = E.in(split(o, k)), r = Math.max(6 * S.u, ((o.from && o.from.r) || 0.016) * S.H);
        c.drawImage(A, 0, -g * S.H * 0.04);
        const y = lerp(p0.y, S.H + r * 3, g);
        blob(c, { x: p0.x, y, sx: 1 / (1 + g * 0.25), sy: 1 + g * 0.25 }, r, onGround(S, (S.PA || S.P).bg));
      } else {
        const p1 = pt(S, o.to), g = after(o, k), z = 1 - E.in(g), r1 = Math.max(6 * S.u, ((o.to && o.to.r) || 0.016) * S.H), r = lerp(r1, mn * 0.16, z);
        c.drawImage(B, 0, 0);
        const so = lerp(8, 150, z) * S.u, sb = lerp(3, 30, z) * S.u, a = 1 - clamp((g - 0.94) / 0.06);
        c.save(); c.globalAlpha = a; c.filter = `blur(${sb.toFixed(1)}px)`; L.circle(c, p1.x + so * 0.7, p1.y + so, r * 0.9, rgba(S.P.fg, lerp(0.22, 0.1, z))); c.restore();
        c.save(); c.globalAlpha = a; L.circle(c, p1.x, p1.y, r, onGround(S, S.P.bg)); c.restore();
      }
    },
  });

  /* strip peel: A is cut into vertical strips that peel away one after another, left to right, each falling and turning
     along a curve like a ribbon, uncovering B underneath */
  L.def('transition:strip-peel-fall', {
    kind: 'transition', plan() { return { pre: 0.14, post: 0.5, events: [{ at: -0.14, event: 'tear' }] }; },
    tr(S, A, B, k, o) {
      const c = S.ctx, n = 12, sw = S.W / n;
      c.drawImage(B, 0, 0);
      for (let i = n - 1; i >= 0; i--) {
        const s = E.in(clamp((k - i * 0.045) / 0.48));
        if (s >= 1) continue;
        const x0 = i * sw, cx = x0 + sw / 2;
        c.save(); c.translate(cx - s * S.W * 0.22, S.H / 2 + s * s * S.H * 1.25); c.rotate(-s * 0.9);
        if (s > 0) { c.shadowColor = 'rgba(0,0,0,0.25)'; c.shadowBlur = 30 * S.u * s; c.shadowOffsetY = 12 * S.u * s; }
        c.drawImage(A, x0, 0, sw + 1, S.H, -sw / 2, -S.H / 2, sw + 1, S.H);
        c.restore();
      }
    },
  });

  /* ════════════════════ CAMERAS ════════════════════ */

  /* click pull-out: the shot opens 2.6x on a point and, on the set-up's click (or 0.35 s), pulls back with an expo-out */
  L.def('camera:click-pullout-expo', {
    kind: 'camera',
    cam(lt, d, o, S) {
      const at = S && S.cues && S.cues.click != null ? S.at('click') + 0.02 : 0.35, k = E.expo(prog(lt, at, 0.5)), W = S ? S.W : 1920, H = S ? S.H : 1080;
      const f = (S && S.b.data && S.b.data.focus) || null, fx = ((o && o.fx) != null ? o.fx : f ? f.x + f.w / 2 : 0.5) * W, fy = ((o && o.fy) != null ? o.fy : f ? f.y + f.h / 2 : 0.5) * H;
      const s = lerp(2.6, 1, k) * (1 + clamp(lt / Math.max(0.1, d)) * 0.015);
      return { s, x: -(fx - W / 2) * s * (1 - k), y: -(fy - H / 2) * s * (1 - k), r: 0 };
    },
  });

  /* beat steps: the camera pushes in a small step on every beat (a stiff spring each time), never still between */
  L.def('camera:beat-step-push', {
    kind: 'camera',
    cam(lt, d, o, S) { const q = qOf(S && S.F), amt = (o && o.amount) || 0.014; let s = 1; for (let j = 1; j * q < lt + 0.001 && j < 64; j++) s += amt * spring(lt - j * q, 'snap'); return { s: s + lt * 0.004, x: 0, y: -(s - 1) * 60 * ((S && S.u) || 1), r: 0 }; },
  });

  /* dive and recentre: the shot dives in 1.2x over the first beat while recentring on the focus (b.data.focus, o.fx/fy),
     then creeps */
  L.def('camera:dive-recentre', {
    kind: 'camera',
    cam(lt, d, o, S) {
      const W = S ? S.W : 1920, H = S ? S.H : 1080, f = (S && S.b.data && S.b.data.focus) || null, k = E.out(prog(lt, 0, 0.85));
      const fx = ((o && o.fx) != null ? o.fx : f ? f.x + f.w / 2 : 0.5) * W, fy = ((o && o.fy) != null ? o.fy : f ? f.y + f.h / 2 : 0.5) * H;
      const s = lerp(1, 1 + ((o && o.amount) || 0.2), k) + clamp(lt / Math.max(0.1, d)) * 0.02;
      return { s, x: -(fx - W / 2) * s * k, y: -(fy - H / 2) * s * k, r: 0 };
    },
  });

  /* ════════════════════ TEXTURE + OVERLAYS ════════════════════ */

  /* a quiet halftone grid on the ground that ripples out from the centre on every bar downbeat */
  L.def('texture:halftone-ripple-field', {
    kind: 'texture',
    draw(S, o) {
      const g = (L.film && L.film.grid) || { bar: 2, offset: 0 }, bar = g.bar || 2, off = g.offset || 0, n = Math.floor((S.t - off) / bar);
      const hits = [n * bar + off, (n - 1) * bar + off], cx = (o && o.x != null ? o.x : 0.5) * S.W, cy = (o && o.y != null ? o.y : 0.5) * S.H, base = 2.6 * S.u;
      halftone(S.ctx, S, 54 * S.u, rgba(S.P.fg, 0.16), (x, y) => base * ripple(Math.hypot(x - cx, y - cy), S.t, hits, 900 * S.u, 80 * S.u, 2.3));
    },
  });

  /* a beaded timeline along the bottom: the accent dot steps along it on every beat on a spring, leaving beads every
     1/30 s, so the beads bunch where it slowed (the easing made visible) */
  L.def('effect:beaded-spring-timeline', {
    kind: 'overlay',
    draw(S) {
      const c = S.ctx, q = qOf(S.F), n = Math.max(1, Math.round(S.d / q)), x0 = S.W * 0.08, x1 = S.W * 0.92, y = S.H - 64 * S.u;
      const pos = tt => { let v = 0; for (let j = 0; j < n; j++) v += springZ(tt - j * q) / n; return lerp(x0, x1, v); };
      c.save(); L.line(c, x0, y, x1, y, rgba(S.P.fg, 0.14), 1.5 * S.u);
      c.fillStyle = rgba(S.P.fg, 0.45); c.beginPath();
      for (let tt = 1 / 30; tt < S.lt; tt += 1 / 30) { const x = pos(tt); c.moveTo(x + 2.4 * S.u, y); c.arc(x, y, 2.4 * S.u, 0, TAU); }
      c.fill(); L.circle(c, pos(S.lt), y, 8 * S.u, dotCol(S)); c.restore();
    },
  });

  /* construction guides: thin hairline guides (a circle, its square, a crosshair) draw themselves around the centre
     like a design tool's guides, then fade (process / build beats) */
  L.def('effect:construction-guides', {
    kind: 'overlay',
    draw(S) {
      const c = S.ctx, k = E.out(prog(S.lt, 0.05, 0.8)), a = 0.55 * (1 - E.in(prog(S.lt, 1.6, 0.8))); if (a <= 0.01 || k <= 0) return;
      const cx = S.W / 2, cy = S.H / 2, R = Math.min(S.W, S.H) * 0.4, col = S.P.accent;
      c.save(); c.globalAlpha *= a; c.strokeStyle = col; c.lineWidth = 1.5 * S.u;
      c.beginPath(); c.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + TAU * k); c.stroke();
      c.save(); c.translate(cx, cy); c.rotate(Math.PI / 4 * k); c.setLineDash([R * 8 * k, 1e5]); c.strokeRect(-R / Math.SQRT2, -R / Math.SQRT2, R * Math.SQRT2, R * Math.SQRT2); c.restore();
      c.setLineDash([6 * S.u, 8 * S.u]); c.beginPath(); c.moveTo(cx - R * 1.3 * k, cy); c.lineTo(cx + R * 1.3 * k, cy); c.moveTo(cx, cy - R * 1.3 * k); c.lineTo(cx, cy + R * 1.3 * k); c.stroke();
      c.setLineDash([]); [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => L.circle(c, cx + sx * R / Math.SQRT2, cy + sy * R / Math.SQRT2, 4 * S.u * k, col));
      c.restore();
    },
  });
})(globalThis.LAUNCH);
