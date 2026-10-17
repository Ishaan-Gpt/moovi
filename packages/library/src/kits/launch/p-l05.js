// Launch pack l05 (a Mac utility promo): one 3D laptop drawn in code tells the story. On a navy stage it works with
// the lid open, the lid falls shut and it falls asleep; the drop flips the world to a cobalt sky (a giant glyph punch,
// a shockwave disc), the wordmark streams in, then a claim carousel where the headline, a frosted ice card with live
// micro-UI and the laptop's pose change together; a white end card with a black address pill closes.
// The laptop is real projected 3D: rounded slabs extruded in perspective, a hinged lid, per-face light, a keyboard,
// a trackpad, a soft contact shadow on an unseen floor, and the brand's site shot (L.img('hero')) mapped onto the
// screen in perspective (triangle-subdivided), or a live agent terminal when there is no shot.
'use strict';
(function (L) {
  const { clamp, lerp, prog, E, rgba, mix, lum, spring, rand } = L;
  const D2R = Math.PI / 180;
  const brand = () => (L.film && L.film.brand) || { name: 'Brand', host: 'brand.com', tagline: '' };
  const isWide = S => S.W / S.H > 1.3, isTall = S => S.H / S.W > 1.3;
  const toks = b => (b && b.text && b.text.tokens) || [];
  const T = (b, F, t0) => { const p = L.get(b.type) || L.get('effect:type-grotesk-serif-lockup'); return p.plan(b, F, t0); };
  const MONO = () => (L.FAM && L.FAM.mono) || 'JetBrainsMono';
  const GREEN = '#30D058', RED = '#F04438'; // status chrome (a success dot, a threshold line)
  const fall = L.bez(0.55, 0, 1, 0.45); // gravity: accelerating, lands flat

  /* ───────── the two worlds of this film, re-skinned from the look ───────── */
  function skyCols(S) {
    const ink = S.look.palette.ink; let a = S.look.accent;
    if (lum(a) > 0.3) a = mix(a, ink, 0.38);
    if (lum(a) < 0.025) a = mix(a, '#FFFFFF', 0.28);
    return { a, top: mix(a, ink, 0.45), hi: mix(a, ink, 0.16), mid: mix(a, '#FFFFFF', 0.05), low: mix(a, '#FFFFFF', 0.42), bot: mix(a, '#FFFFFF', 0.72), ice: mix('#FFFFFF', a, 0.24), deep: mix(ink, a, 0.18) };
  }
  // the sky; scroll 0..1 slides its stops up and lets the paper of the next world rise from below
  function drawSky(S, scroll = 0) {
    const c = S.ctx, k = skyCols(S), m = 0.2, H = S.H, sc = scroll * H * 1.25;
    const y0 = -H * m - sc, y1 = H * (1 + m) - sc, y2 = y1 + H * 0.55, span = y2 - y0, f = y => clamp((y - y0) / span);
    const g = c.createLinearGradient(0, y0, 0, y2);
    g.addColorStop(0, k.top); g.addColorStop(f(y0 + (y1 - y0) * 0.2), k.hi); g.addColorStop(f(y0 + (y1 - y0) * 0.5), k.mid);
    g.addColorStop(f(y0 + (y1 - y0) * 0.82), k.low); g.addColorStop(f(y1), k.bot); g.addColorStop(1, S.look.palette.paper);
    c.fillStyle = g; c.fillRect(-S.W * m, -H * m, S.W * (1 + 2 * m), H * (1 + 2 * m));
    return k;
  }
  function navyCols(S) { const ink = S.look.palette.ink, a = S.look.accent; const mid = mix(mix(ink, '#FFFFFF', 0.03), a, 0.05); return { mid, corner: mix(ink, '#000000', 0.4), floor: mix(mix(mid, '#FFFFFF', 0.07), a, 0.06) }; }
  // the navy stage: darkest in the corners, a faint cool lift on the floor under the object
  function drawNavy(S, fx = 0.5, fy = 0.7) {
    const c = S.ctx, k = navyCols(S), m = 0.2;
    c.fillStyle = k.mid; c.fillRect(-S.W * m, -S.H * m, S.W * (1 + 2 * m), S.H * (1 + 2 * m));
    const R = Math.max(S.W, S.H) * 0.6;
    c.save(); c.translate(S.W * fx, S.H * fy); c.scale(1.35, 0.55);
    const g = c.createRadialGradient(0, 0, 0, 0, 0, R); g.addColorStop(0, rgba(k.floor, 1)); g.addColorStop(0.55, rgba(k.floor, 0.35)); g.addColorStop(1, rgba(k.floor, 0));
    c.fillStyle = g; c.fillRect(-R, -R, R * 2, R * 2); c.restore();
    L.vignette(c, S.W, S.H, 0.55, k.corner);
    return k;
  }
  const skyP = S => { const k = skyCols(S); return Object.assign({}, S.P, { world: 'sky', bg: k.mid, bg2: k.hi, fg: '#FFFFFF', dim: 'rgba(255,255,255,0.74)', accent: '#FFFFFF', rule: 'rgba(255,255,255,0.22)', card: k.ice, cardFg: k.deep, soft: k.low }); };
  const navyP = S => { const k = navyCols(S); return Object.assign({}, S.P, { world: 'navy', bg: k.mid, bg2: k.floor, fg: '#FFFFFF', dim: 'rgba(255,255,255,0.56)', accent: '#FFFFFF', rule: 'rgba(255,255,255,0.12)' }); };
  const withP = (S, P) => Object.assign({}, S, { P });

  /* ───────── projected 3D: a camera, rounded slabs, a laptop ───────── */
  function proj(o) {
    const cy = Math.cos((o.yaw || 0) * D2R), sy = Math.sin((o.yaw || 0) * D2R), cp = Math.cos(o.pitch * D2R), sp = Math.sin(o.pitch * D2R);
    const rl = (o.roll || 0) * D2R, cr = Math.cos(rl), sr = Math.sin(rl), dist = o.dist || 3.4, c0 = o.c0 || [0, 0, 0];
    const rotV = v => { const x1 = v[0] * cy + v[2] * sy, z1 = -v[0] * sy + v[2] * cy; const y2 = v[1] * cp - z1 * sp, z2 = z1 * cp + v[1] * sp; return [x1 * cr - y2 * sr, x1 * sr + y2 * cr, z2]; };
    const rotP = p => rotV([p[0] - c0[0], p[1] - c0[1], p[2] - c0[2]]);
    const P = (x, y, z) => { const r = rotP([x, y, z]), s = o.w * dist / (dist - r[2]); return [o.cx + r[0] * s, o.cy - r[1] * s, r[2]]; };
    const face = (n, p) => { const nr = rotV(n), pr = rotP(p); return -nr[0] * pr[0] - nr[1] * pr[1] + nr[2] * (dist - pr[2]) > 0; };
    const Ld = [-0.42, 0.78, 0.47], ln = Math.hypot(...Ld);
    const light = n => { const r = rotV(n); return clamp((r[0] * Ld[0] + r[1] * Ld[1] + r[2] * Ld[2]) / ln); };
    return { P, face, light, rotV };
  }
  function rrPts(w, h, r, n = 5) {
    const pts = [], cs = [[w / 2 - r, h / 2 - r, 0], [-w / 2 + r, h / 2 - r, Math.PI / 2], [-w / 2 + r, -h / 2 + r, Math.PI], [w / 2 - r, -h / 2 + r, Math.PI * 1.5]];
    for (const [cx, cy, a0] of cs) for (let i = 0; i <= n; i++) { const a = a0 + i / n * Math.PI / 2; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
    return pts;
  }
  const poly = (c, pts) => { c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.closePath(); };
  // an extruded rounded rectangle in a frame {o, U, V, N}: facing sides shaded by the light, then the facing cap
  function slab(c, K, f, d, col) {
    const ring = rrPts(d.w, d.h, d.r);
    const at = (a, b, t) => [0, 1, 2].map(i => f.o[i] + f.U[i] * a + f.V[i] * b + f.N[i] * t);
    const p0 = ring.map(q => K.P(...at(q[0], q[1], 0))), p1 = ring.map(q => K.P(...at(q[0], q[1], d.th)));
    const n = ring.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, e0 = ring[j][0] - ring[i][0], e1 = ring[j][1] - ring[i][1], len = Math.hypot(e0, e1);
      if (len < 1e-7) continue;
      let na = e1 / len, nb = -e0 / len; const ma = (ring[i][0] + ring[j][0]) / 2, mb = (ring[i][1] + ring[j][1]) / 2;
      if (na * ma + nb * mb < 0) { na = -na; nb = -nb; }
      const nw = [0, 1, 2].map(k => f.U[k] * na + f.V[k] * nb);
      if (!K.face(nw, at(ma, mb, d.th / 2))) continue;
      const cc = col.side(K.light(nw), mb / d.h);
      c.beginPath(); c.moveTo(p0[i][0], p0[i][1]); c.lineTo(p0[j][0], p0[j][1]); c.lineTo(p1[j][0], p1[j][1]); c.lineTo(p1[i][0], p1[i][1]); c.closePath();
      c.fillStyle = cc; c.fill(); c.strokeStyle = cc; c.lineWidth = 1; c.stroke();
    }
    const neg = f.N.map(v => -v), top = K.face(f.N, at(0, 0, d.th)), bot = !top && K.face(neg, at(0, 0, 0));
    if (top && col.cap) col.cap(p1, true, K.light(f.N), (a, b) => K.P(...at(a, b, d.th)));
    else if (bot && col.cap) col.cap(p0, false, K.light(neg), (a, b) => K.P(...at(a, b, -0.0006)));
    return { at, p0, p1, top, bot, ring };
  }
  // aluminium that takes the world's colour (silver-white on navy, lavender-grey on the sky)
  function aluOf(S, tint) {
    const ink = S.look.palette.ink, dark = lum(tint) < 0.1;
    const base = dark ? mix(mix('#FFFFFF', ink, 0.12), tint, 0.08) : mix(mix('#FFFFFF', ink, 0.2), tint, 0.32);
    return { hi: mix(base, '#FFFFFF', 0.6), mid: base, lo: mix(base, ink, dark ? 0.5 : 0.36), key: mix(base, ink, 0.52), well: mix(base, ink, 0.1), rim: mix(base, '#FFFFFF', 0.85) };
  }
  // one textured triangle (affine inside a small cell: the grid makes the whole quad perspective-correct)
  function tri(c, img, s0, s1, s2, d0, d1, d2) {
    const cx = (d0[0] + d1[0] + d2[0]) / 3, cy = (d0[1] + d1[1] + d2[1]) / 3;
    const ex = p => { const dx = p[0] - cx, dy = p[1] - cy, l = Math.hypot(dx, dy) || 1; return [p[0] + dx / l * 0.8, p[1] + dy / l * 0.8]; };
    const den = (s1[0] - s0[0]) * (s2[1] - s0[1]) - (s2[0] - s0[0]) * (s1[1] - s0[1]);
    if (Math.abs(den) < 1e-6) return;
    const a = ((d1[0] - d0[0]) * (s2[1] - s0[1]) - (d2[0] - d0[0]) * (s1[1] - s0[1])) / den;
    const b = ((d1[1] - d0[1]) * (s2[1] - s0[1]) - (d2[1] - d0[1]) * (s1[1] - s0[1])) / den;
    const cc = ((d2[0] - d0[0]) * (s1[0] - s0[0]) - (d1[0] - d0[0]) * (s2[0] - s0[0])) / den;
    const dd = ((d2[1] - d0[1]) * (s1[0] - s0[0]) - (d1[1] - d0[1]) * (s2[0] - s0[0])) / den;
    const e = d0[0] - a * s0[0] - cc * s0[1], f = d0[1] - b * s0[0] - dd * s0[1];
    c.save(); poly(c, [ex(d0), ex(d1), ex(d2)]); c.clip(); c.transform(a, b, cc, dd, e, f);
    const x0 = Math.max(0, Math.min(s0[0], s1[0], s2[0]) - 2), y0 = Math.max(0, Math.min(s0[1], s1[1], s2[1]) - 2);
    const x1 = Math.min(img.width, Math.max(s0[0], s1[0], s2[0]) + 2), y1 = Math.min(img.height, Math.max(s0[1], s1[1], s2[1]) + 2);
    if (x1 > x0 && y1 > y0) c.drawImage(img, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
    c.restore();
  }
  function mapQuad(c, img, pt, nx = 8, ny = 6) { // pt(u, v) → screen point, u, v in 0..1 (v = 0 is the image top)
    const G = []; for (let j = 0; j <= ny; j++) { G.push([]); for (let i = 0; i <= nx; i++) G[j].push(pt(i / nx, j / ny)); }
    const sw = img.width / nx, sh = img.height / ny;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const s00 = [i * sw, j * sh], s10 = [(i + 1) * sw, j * sh], s01 = [i * sw, (j + 1) * sh], s11 = [(i + 1) * sw, (j + 1) * sh];
      tri(c, img, s00, s10, s11, G[j][i], G[j][i + 1], G[j + 1][i + 1]); tri(c, img, s00, s11, s01, G[j][i], G[j + 1][i + 1], G[j + 1][i]);
    }
  }
  // the laptop. o: {cx, cy, w, yaw, pitch, lid (deg, 0 closed), tint, screen (canvas), glow 0..1, shadow 0..1, lift, sheen, c0}
  function laptop(S, o) {
    const c = S.ctx, ink = S.look.palette.ink, tint = o.tint || S.P.bg, A = aluOf(S, tint), u = S.u;
    const lidDeg = clamp(o.lid || 0, 0, 125), th = lidDeg * D2R, sn = Math.sin(th), cs = Math.cos(th);
    const BD = 0.7, BT = 0.03, LT = 0.016, LD = 0.69;
    const c0 = o.c0 || [0, 0.02 + 0.3 * sn, -0.13 * sn];
    const K = proj({ cx: o.cx, cy: o.cy, w: o.w, yaw: o.yaw || 0, pitch: o.pitch == null ? 22 : o.pitch, roll: o.roll || 0, dist: o.dist || 3.4, c0 });
    c.save(); if (o.alpha != null) c.globalAlpha *= clamp(o.alpha);
    // the contact shadow on an unseen floor: tighter and darker as the object comes down
    const gap = 0.14 + (o.lift || 0);
    if (o.shadow !== 0) {
      const sh = rrPts(1.0, 0.74, 0.1, 3).map(q => K.P(q[0], -gap, q[1]));
      c.save(); c.filter = `blur(${(22 * u * (1 + gap * 2)).toFixed(1)}px)`; c.globalAlpha *= (o.shadow == null ? 1 : o.shadow) * clamp(0.62 - gap * 1.1, 0.14, 0.6);
      poly(c, sh); c.fillStyle = mix(tint, ink, lum(tint) < 0.1 ? 0.9 : 0.62); c.fill(); c.restore();
      const core = rrPts(0.86, 0.5, 0.1, 3).map(q => K.P(q[0], -gap, q[1]));
      c.save(); c.filter = `blur(${(9 * u).toFixed(1)}px)`; c.globalAlpha *= (o.shadow == null ? 1 : o.shadow) * clamp(0.32 - gap, 0, 0.3); poly(c, core); c.fillStyle = mix(tint, ink, 0.9); c.fill(); c.restore();
    }
    if (o.pool) { const pl = rrPts(1.0, 0.74, 0.2, 3).map(q => K.P(q[0] * 1.7, -gap - 0.05, q[1] * 1.9)); c.save(); c.filter = `blur(${(60 * u).toFixed(1)}px)`; c.globalAlpha *= 0.22 * o.pool; poly(c, pl); c.fillStyle = '#FFFFFF'; c.fill(); c.restore(); }
    const glow = o.glow == null ? (lidDeg > 20 ? 1 : 0) : o.glow;
    const hinge = [0, BT, -BD / 2 + 0.006], V = [0, sn, cs], N = [0, cs, -sn];
    if (glow > 0.01 && lidDeg > 30) { const sc = K.P(hinge[0], hinge[1] + V[1] * 0.36 - N[1] * 0.1, hinge[2] + V[2] * 0.36 - N[2] * 0.1); L.bloom(c, sc[0], sc[1], o.w * 0.62, mix(S.look.accent, '#FFFFFF', 0.1), 0.2 * glow * (o.bloom == null ? 1 : o.bloom)); }
    const capMetal = sheen => (pts, top, s, P2) => {
      const g0 = P2(-0.5, -0.35), g1 = P2(0.5, 0.35), g = c.createLinearGradient(g0[0], g0[1], g1[0], g1[1]);
      const k = 0.8 + s * 0.2;
      g.addColorStop(0, mix(A.hi, '#FFFFFF', 0.3)); g.addColorStop(0.45, mix(A.mid, A.hi, 0.5 * k)); g.addColorStop(1, mix(A.mid, A.lo, 0.25));
      poly(c, pts); c.fillStyle = g; c.fill();
      if (sheen != null && sheen > -0.3 && sheen < 1.3) {
        c.save(); poly(c, pts); c.clip(); const sg = c.createLinearGradient(g0[0], g0[1], g1[0], g1[1]);
        const st = (x, col) => sg.addColorStop(clamp(x), col);
        st(sheen - 0.22, 'rgba(255,255,255,0)'); st(sheen - 0.04, 'rgba(255,255,255,0.55)'); st(sheen, 'rgba(255,255,255,0.85)'); st(sheen + 0.05, 'rgba(255,255,255,0.4)'); st(sheen + 0.22, 'rgba(255,255,255,0)');
        c.fillStyle = sg; c.fillRect(-S.W, -S.H, S.W * 3, S.H * 3); c.restore();
      }
      c.lineWidth = 1.2 * u; c.strokeStyle = rgba(A.rim, 0.7); poly(c, pts); c.stroke();
    };
    const side = (s, b) => mix(A.lo, A.hi, clamp(s * 1.05 + 0.08));
    // base
    const base = slab(c, K, { o: [0, 0, 0], U: [1, 0, 0], V: [0, 0, 1], N: [0, 1, 0] }, { w: 1, h: BD, r: 0.045, th: BT }, { side, cap: capMetal(null) });
    if (base.top && lidDeg > 4) { // the keyboard well, keys, trackpad
      const tp = BT + 0.0006, P3 = (a, b) => K.P(a, tp, b);
      poly(c, rrPts(0.9, 0.3, 0.012, 2).map(q => P3(q[0], q[1] - 0.17))); c.fillStyle = A.well; c.fill();
      const cols = 14, rows = 6, x0 = -0.43, x1 = 0.43, z0 = -0.31, z1 = -0.035, gp = 0.0065;
      const kw = (x1 - x0 - gp * (cols - 1)) / cols, rh = (z1 - z0 - gp * (rows - 1) - 0.02) / (rows - 0.5);
      c.fillStyle = A.key; let z = z0;
      for (let r = 0; r < rows; r++) {
        const h = r === 0 ? rh * 0.5 : rh;
        if (r === rows - 1) { // the bottom row: a long space bar
          const xs = [[x0, x0 + kw * 1.2], [x0 + kw * 1.2 + gp, x0 + kw * 2.4 + gp], [x0 + kw * 2.4 + gp * 2, x0 + kw * 3.6 + gp * 2], [x0 + kw * 3.6 + gp * 3, x1 - kw * 3.6 - gp * 3], [x1 - kw * 3.6 - gp * 2, x1 - kw * 2.4 - gp * 2], [x1 - kw * 2.4 - gp, x1 - kw * 1.2 - gp], [x1 - kw * 1.2, x1]];
          for (const [a0, a1] of xs) { poly(c, [P3(a0, z), P3(a1, z), P3(a1, z + h), P3(a0, z + h)]); c.fill(); }
        } else for (let i = 0; i < cols; i++) { const a0 = x0 + i * (kw + gp); poly(c, [P3(a0, z), P3(a0 + kw, z), P3(a0 + kw, z + h), P3(a0, z + h)]); c.fill(); }
        z += h + gp;
      }
      poly(c, rrPts(0.36, 0.215, 0.02, 3).map(q => P3(q[0], q[1] + 0.185))); c.fillStyle = mix(A.mid, A.hi, 0.35); c.fill(); c.strokeStyle = mix(A.mid, ink, 0.18); c.lineWidth = 1 * u; c.stroke();
    }
    // the lid on its hinge
    const lo = [0, 1, 2].map(i => hinge[i] + V[i] * LD / 2);
    const lid = slab(c, K, { o: lo, U: [1, 0, 0], V, N }, { w: 0.995, h: LD, r: 0.045, th: LT }, {
      side: (s) => mix(A.lo, A.hi, clamp(s * 1.05 + 0.18)),
      cap: (pts, top, s, P2) => {
        if (top) return capMetal(o.sheen)(pts, top, s, P2);
        // the screen side: a black bezel, the live screen in perspective, glass reflection, dimming as it dies
        poly(c, pts); c.fillStyle = mix(ink, '#000000', 0.35); c.fill();
        const quad = (u0, v0) => P2(lerp(-0.455, 0.455, u0), lerp(0.315, -0.3, v0));
        const scr = [quad(0, 0), quad(1, 0), quad(1, 1), quad(0, 1)];
        if (o.screen && glow > 0.01) mapQuad(c, o.screen, quad);
        else { poly(c, scr); c.fillStyle = mix(ink, '#000000', 0.2); c.fill(); }
        if (glow < 1) { poly(c, scr); c.fillStyle = rgba('#000000', (1 - glow) * 0.94); c.fill(); }
        // the edge glow and a diagonal glass reflection
        c.save(); poly(c, scr); c.clip();
        c.lineWidth = 10 * u; c.strokeStyle = rgba(mix(S.look.accent, '#FFFFFF', 0.15), 0.32 * glow); poly(c, scr); c.stroke();
        const r0 = quad(0, 0), r1 = quad(1, 1), rg = c.createLinearGradient(r0[0], r0[1], r1[0], r1[1]);
        rg.addColorStop(0, 'rgba(255,255,255,0.08)'); rg.addColorStop(0.42, 'rgba(255,255,255,0.03)'); rg.addColorStop(0.43, 'rgba(255,255,255,0)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = rg; poly(c, scr); c.fill(); c.restore();
      },
    });
    // the light rim between lid and base (closed: reads as a two-layer slab)
    if (lidDeg < 8) { c.save(); c.strokeStyle = rgba(A.rim, 0.9); c.lineWidth = 1.4 * u; c.beginPath(); const n = lid.ring.length; for (let i = 0; i < n; i++) { const q = lid.ring[i]; const p = lid.p0[i]; if (q[1] > -0.2 && (Math.abs(q[0]) > 0.3 || q[1] > 0.2)) { c.lineTo(p[0], p[1]); } else c.moveTo(p[0], p[1]); } c.stroke(); c.restore(); }
    c.restore();
    const topY = BT + (lidDeg < 8 ? LT : 0);
    return { K, corner: K.P(0.4, topY + 0.02, -0.26), front: K.P(0, 0, BD / 2), top: K.P(0, topY + 0.3 * sn, -0.1), scr: K.P(hinge[0] + V[0] * 0.35, hinge[1] + V[1] * 0.35, hinge[2] + V[2] * 0.35) };
  }

  /* ───────── the screen: the brand's site shot, or a live agent terminal ───────── */
  const slug = s => String(s || 'task').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 18) || 'task';
  const steps = (S, d) => {
    const items = (d.items && d.items.length ? d.items : ['setup', 'tests', 'build', 'docs']);
    const verbs = ['Read', 'Update', 'Run', 'Write', 'Update'];
    return Array.from({ length: 14 }, (_, i) => { const it = items[i % items.length], v = verbs[i % verbs.length]; return { head: `${v}(${v === 'Run' ? 'tests/' + slug(it) : 'src/' + slug(it) + '.ts'})`, add: i % 3 === 1 ? 12 + i * 7 : 0, del: i % 3 === 1 ? 3 + i * 2 : 0, note: i % 3 === 0 ? `${40 + i * 13} lines` : i % 3 === 2 ? `${18 + i * 4} passed` : '' }; });
  };
  // a shimmer status line: a spinning star, a verb whose letters catch a moving light band, a dim meta
  function shimmer(c, x, y, px, verb, meta, t, col, hi, dim) {
    const fr = Math.floor(t * 8);
    c.save(); c.translate(x + px * 0.45, y - px * 0.34); c.rotate(fr * Math.PI / 6); c.strokeStyle = col; c.lineWidth = Math.max(1, px * 0.11); c.lineCap = 'round';
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3, r = px * (0.42 - (fr % 2) * 0.06); c.beginPath(); c.moveTo(Math.cos(a) * r * 0.25, Math.sin(a) * r * 0.25); c.lineTo(Math.cos(a) * r, Math.sin(a) * r); c.stroke(); }
    c.restore();
    c.font = `500 ${px.toFixed(1)}px ${MONO()}`; c.textBaseline = 'alphabetic'; c.textAlign = 'left';
    let xx = x + px * 1.3; const totalW = c.measureText(verb).width, band = ((t * 1.6) % 1.6 - 0.3) * totalW;
    for (let i = 0; i < verb.length; i++) { const ch = verb[i], cw = c.measureText(ch).width, d = (xx - (x + px * 1.3) + cw / 2 - band) / (px * 2.2); c.fillStyle = mix(col, hi, Math.exp(-d * d)); c.fillText(ch, xx, y); xx += cw; }
    c.fillStyle = dim; c.font = `400 ${(px * 0.86).toFixed(1)}px ${MONO()}`; c.fillText(meta, xx + px * 0.6, y);
  }
  // a terminal where an agent's steps append one by one (shared by the laptop screen and ui:agent-step-stream)
  function drawStream(S, c, x, y, w, h, t, o = {}) {
    const ink = S.look.palette.ink, s = w / 1280, d = (S.b && S.b.data) || {}, B = brand();
    const bg = mix(ink, '#FFFFFF', 0.075), fg = 'rgba(240,242,248,0.92)', dim = 'rgba(240,242,248,0.46)';
    c.save(); L.rr(c, x, y, w, h, o.r || 0); c.clip();
    c.fillStyle = bg; c.fillRect(x, y, w, h);
    const tb = 52 * s; c.fillStyle = mix(bg, '#FFFFFF', 0.05); c.fillRect(x, y, w, tb); c.fillStyle = 'rgba(255,255,255,0.06)'; c.fillRect(x, y + tb - 1, w, 1);
    ['#FF5F57', '#FEBC2E', '#28C840'].forEach((col, i) => L.circle(c, x + (28 + i * 26) * s, y + tb / 2, 7.5 * s, col));
    c.font = `500 ${(19 * s).toFixed(1)}px ${MONO()}`; c.fillStyle = dim; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(`~/${slug(B.name)} — agent`, x + w / 2, y + tb / 2); c.textAlign = 'left'; c.textBaseline = 'alphabetic';
    const px = 25 * s, lh = 40 * s, pad = 44 * s, top = y + tb + 40 * s, bottomBar = 92 * s, area = h - (top - y) - bottomBar;
    const every = o.every || 0.5, n = Math.max(1, Math.floor((t - (o.t0 || 0)) / every) + 1), list = steps(S, d);
    const prompt = (d.prompt || B.tagline || 'ship the next release').slice(0, 64);
    const rows = [{ k: 'p', s: prompt }];
    for (let i = 0; i < Math.min(n, list.length); i++) { rows.push({ k: 'h', s: list[i].head, i }); rows.push({ k: 's', st: list[i], i }); }
    const totalH = rows.length * lh, over = Math.max(0, totalH - area);
    const scrollK = E.out(clamp(((t - (o.t0 || 0)) % every) / 0.2)), prevOver = Math.max(0, (rows.length - 2) * lh - area);
    const off = lerp(prevOver, over, scrollK);
    c.save(); c.beginPath(); c.rect(x, top - px * 1.2, w, area + px * 1.2); c.clip();
    rows.forEach((r, j) => {
      const yy = top + j * lh - off + px * 0.2; if (yy < top - lh || yy > top + area + lh) return;
      const born = r.k === 'p' ? 0 : (o.t0 || 0) + r.i * every, a = r.k === 'p' ? 1 : E.out(clamp((t - born - (r.k === 's' ? 0.08 : 0)) / 0.12));
      c.globalAlpha = a; const dy = (1 - a) * 6 * s;
      c.font = `500 ${px.toFixed(1)}px ${MONO()}`;
      if (r.k === 'p') { c.fillStyle = mix(S.look.accent, '#FFFFFF', 0.35); c.fillText('›', x + pad, yy); c.fillStyle = fg; c.fillText(r.s, x + pad + px * 1.1, yy); }
      else if (r.k === 'h') { L.circle(c, x + pad + px * 0.3, yy - px * 0.33 + dy, px * 0.24, GREEN); c.fillStyle = fg; c.font = `700 ${px.toFixed(1)}px ${MONO()}`; c.fillText(r.s, x + pad + px * 1.1, yy + dy); }
      else {
        const st = r.st, x0 = x + pad + px * 1.1; c.strokeStyle = dim; c.lineWidth = 1.5 * s; c.beginPath(); c.moveTo(x0 + px * 0.3, yy - px * 0.9 + dy); c.lineTo(x0 + px * 0.3, yy - px * 0.35 + dy); c.lineTo(x0 + px * 0.9, yy - px * 0.35 + dy); c.stroke();
        c.font = `400 ${(px * 0.92).toFixed(1)}px ${MONO()}`;
        if (st.add) { c.fillStyle = dim; c.fillText('Updated with', x0 + px * 1.3, yy + dy); let xx = x0 + px * 1.3 + c.measureText('Updated with ').width; c.fillStyle = GREEN; c.fillText(`+${st.add}`, xx, yy + dy); xx += c.measureText(`+${st.add} `).width; c.fillStyle = RED; c.fillText(`−${st.del}`, xx, yy + dy); }
        else { c.fillStyle = dim; c.fillText(st.note, x0 + px * 1.3, yy + dy); }
      }
    });
    c.restore(); c.globalAlpha = 1;
    // the bottom: a rule, the shimmer line, a prompt caret
    const by = y + h - bottomBar; c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(x + pad, by, w - pad * 2, 1.5 * s);
    const el = Math.floor(t);
    shimmer(c, x + pad, by + 42 * s, 24 * s, 'Working…', `(2h ${String(14 + Math.floor(el / 60)).padStart(2, '0')}m ${String(el % 60).padStart(2, '0')}s · ↓ ${(48 + el * 0.7).toFixed(1)}k)`, t, mix(S.look.accent, '#FFFFFF', 0.25), '#FFFFFF', dim);
    c.restore();
  }
  function screenTex(S, o = {}) {
    const cv = L.buffer('l05-screen', 1280, 800); if (!cv) return null;
    const c = cv.getContext('2d'), t = o.t != null ? o.t : S.lt; c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.filter = 'none';
    const hero = o.image !== false && L.img(o.image || 'hero');
    if (hero) {
      c.fillStyle = '#FFFFFF'; c.fillRect(0, 0, 1280, 800);
      const s = 1280 / hero.width, ih = hero.height * s, sc = Math.max(0, Math.min(ih - 772, 380)) * E.io(clamp((t - (o.t0 || 0) - 0.6) / 4));
      c.drawImage(hero, 0, 28 - sc, 1280, ih);
      c.fillStyle = 'rgba(246,246,248,0.94)'; c.fillRect(0, 0, 1280, 28); c.fillStyle = 'rgba(0,0,0,0.08)'; c.fillRect(0, 28, 1280, 1);
      c.font = `600 15px ${L.FAM.ui}`; c.fillStyle = '#1A1A1E'; c.textBaseline = 'middle'; c.fillText(brand().name, 22, 14); c.textAlign = 'right'; c.font = `500 14px ${L.FAM.ui}`; c.fillText(brand().host || '', 1258, 14); c.textAlign = 'left'; c.textBaseline = 'alphabetic';
    } else drawStream(S, c, 0, 0, 1280, 800, t, { t0: o.t0 || 0, every: o.every || 0.45 });
    return cv;
  }

  /* ───────── marks: the Z, the brand glyph, the slanted wordmark ───────── */
  const ZP = [[0.08, 0], [1, 0], [1, 0.21], [0.42, 0.79], [0.94, 0.79], [0.94, 1], [0, 1], [0, 0.79], [0.58, 0.21], [0.08, 0.21]];
  function zMark(c, x, y, s, o) {
    c.save(); c.translate(x, y); c.transform(1, 0, -0.24, 1, 0, 0); c.beginPath();
    ZP.forEach(([a, b], i) => { const px = (a - 0.5) * s * 0.9, py = (b - 0.5) * s; if (i) c.lineTo(px, py); else c.moveTo(px, py); }); c.closePath();
    if (o.fill) { c.fillStyle = o.fill; c.fill(); }
    if (o.stroke) { c.lineJoin = 'round'; c.lineWidth = o.lw || 2; c.strokeStyle = o.stroke; c.stroke(); }
    c.restore();
  }
  const italicWM = S => !!(((S.look.type || {}).wordmark || {}).italic);
  const glyphOf = () => { const n = String(brand().name || 'B').replace(/[^A-Za-z0-9]/g, ''); return (n[0] || 'b').toLowerCase(); };
  // the brand glyph: its initial in the heavy wordmark face with a round dot, centred on (x, y)
  function glyph(S, x, y, px, col, o = {}) {
    if (px > 240) { const k = px / 240, c = S.ctx; c.save(); c.translate(x, y); c.scale(k, k); const r = glyph(S, 0, 0, 240, col, o); c.restore(); return { x0: x + r.x0 * k, w: r.w * k, base: y + r.base * k }; }
    const c = S.ctx, g = o.s || glyphOf(), w = L.textW(c, S.look, g, { role: 'wordmark', px, weight: 900, tracking: -0.05 }), r = px * 0.11, total = w + px * 0.05 + r * 2;
    const x0 = x - total / 2, base = y + px * 0.36;
    c.save(); if (!italicWM(S)) { c.translate(x, base); c.transform(1, 0, -0.2, 1, 0, 0); c.translate(-x, -base); }
    L.text(c, S.look, g, x0, base, { role: 'wordmark', px, weight: 900, color: col, tracking: -0.05 });
    L.circle(c, x0 + w + px * 0.05 + r, base - r, r * (o.dotK == null ? 1 : o.dotK), o.dot || col);
    c.restore(); return { x0, w: total, base };
  }
  function wordmark(S, x, y, px, col, o = {}) {
    const c = S.ctx, s = o.s || brand().name, w = L.textW(c, S.look, s, { role: 'wordmark', px, weight: 900, tracking: -0.05 }), r = px * 0.1, total = w - px * 0.02 + r * 2;
    const x0 = o.align === 'left' ? x : x - total / 2;
    c.save(); if (!italicWM(S)) { c.translate(x0, y); c.transform(1, 0, -0.2, 1, 0, 0); c.translate(-x0, -y); }
    L.text(c, S.look, s, x0, y, { role: 'wordmark', px, weight: 900, color: col, tracking: -0.05 });
    if (o.dot !== false) L.circle(c, x0 + w - px * 0.02 + r, y - r, r * (o.dotK == null ? 1 : o.dotK), o.dotCol || col);
    c.restore(); return { x0, w: total };
  }
  const wmPx = (S, frac) => { const n = String(brand().name).length; return Math.min(S.H * 0.2, S.W * frac / Math.max(3.2, n * 0.55)); };

  /* ───────── frosted ice cards (the claim cards) ───────── */
  function ice(S, x, y, w, h, k, P) {
    const c = S.ctx, sk = skyCols(S), u = S.u, r = Math.min(h * 0.24, 40 * u);
    c.save(); c.globalAlpha *= clamp(k * 1.6); const s = lerp(0.95, 1, k); c.translate(x + w / 2, y + h / 2 + (1 - k) * 24 * u); c.scale(s, s); c.translate(-(x + w / 2), -(y + h / 2));
    L.glass(c, S.src, x, y, w, h, r, { u, tint: rgba(sk.ice, 0.8), blur: 26 * u, chroma: false });
    c.restore();
    return { r, fg: sk.deep, dim: rgba(sk.deep, 0.5) };
  }
  const iceInk = S => { const sk = skyCols(S); return { fg: sk.deep, dim: rgba(sk.deep, 0.5) }; };
  // content swaps inside a card: old blurs out, new blurs in (two-frame blur crossfade, as in the reference)
  const swapK = (t, at, dur = 0.1) => E.out(clamp((t - at) / dur));
  function blurDraw(c, k, px, fn) { if (k <= 0.01) return; c.save(); c.globalAlpha *= clamp(k); if (k < 0.98) c.filter = `blur(${((1 - k) * px).toFixed(1)}px)`; fn(); c.restore(); }
  const fmtN = (v, n) => `${(n && n.prefix) || ''}${Math.round(v).toLocaleString('en-US')}${(n && n.suffix) || ''}`;

  function cardStatus(S, x, y, w, t0, o) { // live dot, state eyebrow, a name that cycles, a counter
    const c = S.ctx, h = w * 0.21, k = E.out(prog(S.lt, t0, 0.32)); if (k <= 0) return h;
    const I = o.box === false ? iceInk(S) : ice(S, x, y, w, h, k), u = S.u, ck = E.out(prog(S.lt, t0 + 0.06, 0.25));
    blurDraw(c, ck * k, 10 * u, () => {
      const dx = x + h * 0.36, dy = y + h * 0.5, per = ((S.lt - t0) % 1) / 1;
      L.circle(c, dx, dy, h * (0.09 + 0.12 * per), rgba(GREEN, 0.4 * (1 - per))); L.circle(c, dx, dy, h * 0.08, GREEN);
      L.text(c, S.look, o.label || 'Working', x + h * 0.62, y + h * 0.4, { role: 'micro', px: h * 0.115, weight: 600, color: I.dim, upper: true, maxW: w * 0.42 });
      const names = (o.names && o.names.length ? o.names : [brand().name]).slice(0, 5), every = o.every || 0.55;
      const i = Math.max(0, Math.floor((S.lt - t0 - 0.3) / every)), cur = names[i % names.length], prev = names[(i + names.length - 1) % names.length], sk = swapK(S.lt, t0 + 0.3 + i * every, 0.08);
      const nm = (s, a) => blurDraw(c, a, 6 * u, () => L.text(c, S.look, s, x + h * 0.62, y + h * 0.72, { role: 'ui', px: h * 0.22, weight: 700, color: I.fg, maxW: w * 0.44 }));
      if (i > 0 && sk < 1) nm(prev, 1 - sk); nm(cur, i > 0 ? sk : 1);
      L.line(c, x + w * 0.66, y + h * 0.22, x + w * 0.66, y + h * 0.78, rgba(I.fg, 0.14), 1.5 * u);
      L.text(c, S.look, o.countLabel || 'Actions', x + w * 0.7, y + h * 0.4, { role: 'micro', px: h * 0.115, weight: 600, color: I.dim, upper: true, maxW: w * 0.26 });
      const ct = o.count || [131, 172], v = lerp(ct[0], ct[1], E.io(prog(S.lt, t0 + 0.25, o.countDur || 1.3)));
      L.text(c, S.look, fmtN(v, o.num), x + w * 0.7, y + h * 0.74, { role: 'ui', px: h * 0.24, weight: 700, color: I.fg, maxW: w * 0.26 });
    });
    return h;
  }
  function cardThermal(S, x, y, w, t0, o) { // a big reading, a heat gauge with two threshold ticks, mode chips
    const c = S.ctx, h = w * 0.25, k = E.out(prog(S.lt, t0, 0.32)); if (k <= 0) return h;
    const I = o.box === false ? iceInk(S) : ice(S, x, y, w, h, k), u = S.u, ck = E.out(prog(S.lt, t0 + 0.06, 0.25));
    blurDraw(c, ck * k, 10 * u, () => {
      const cnt = o.count || [43, 61], v = lerp(cnt[0], cnt[1], E.out(prog(S.lt, t0 + 0.1, 0.45)));
      L.text(c, S.look, o.label || 'Reading', x + h * 0.3, y + h * 0.36, { role: 'micro', px: h * 0.1, weight: 600, color: I.dim, upper: true, maxW: w * 0.22 });
      L.text(c, S.look, fmtN(v, o.num || { suffix: '°' }), x + h * 0.28, y + h * 0.74, { role: 'ui', px: h * 0.32, weight: 750, color: I.fg, maxW: w * 0.27 });
      const gx = x + w * 0.34, gw = w * 0.6, gy = y + h * 0.3, gh = Math.max(6 * u, h * 0.055);
      L.rr(c, gx, gy - gh / 2, gw, gh, gh / 2); c.fillStyle = rgba('#FFFFFF', 0.55); c.fill();
      const fk = clamp(o.gauge != null ? o.gauge * lerp(cnt[0], cnt[1], E.out(prog(S.lt, t0 + 0.1, 0.45))) / cnt[1] : 0.5);
      const g = c.createLinearGradient(gx, 0, gx + gw, 0); g.addColorStop(0, '#2FD06A'); g.addColorStop(0.4, '#F5D23A'); g.addColorStop(0.7, '#F59A2A'); g.addColorStop(1, RED);
      c.save(); L.rr(c, gx, gy - gh / 2, Math.max(gh, gw * fk), gh, gh / 2); c.fillStyle = g; c.fill(); c.restore();
      [0.78, 0.9].forEach((at, i) => { L.line(c, gx + gw * at, gy - gh * 1.7, gx + gw * at, gy + gh * 1.7, rgba(I.fg, 0.55), 2 * u); if (o.ticks && o.ticks[i]) L.text(c, S.look, o.ticks[i], gx + gw * at, gy + gh * 3.4, { role: 'micro', px: h * 0.06, color: I.dim, align: 'center' }); });
      const chips = (o.chips || []).slice(0, 3); let cx = gx; const cpx = h * 0.085, cy = y + h * 0.7;
      chips.forEach((s, i) => {
        const tw = L.textW(c, S.look, s, { role: 'ui', px: cpx, weight: 600 }), cw = Math.min(tw + cpx * 2, gw / 3 - 8 * u); if (cx + cw > gx + gw + 1) return;
        const ak = E.out(prog(S.lt, t0 + 0.35 + i * 0.1, 0.12));
        blurDraw(c, ak, 6 * u, () => { L.pill(c, cx, cy - cpx * 1.15, cw, cpx * 2.3, rgba('#FFFFFF', 0.6)); L.text(c, S.look, s, cx + cw / 2, cy + cpx * 0.36, { role: 'ui', px: cpx, weight: 600, color: I.fg, align: 'center', maxW: cw - cpx }); });
        cx += cw + 8 * u;
      });
    });
    return h;
  }
  function cardBattery(S, x, y, w, t0, o) { // a battery above a red threshold, a percentage that drains a step at a time
    const c = S.ctx, h = w * 0.2, k = E.out(prog(S.lt, t0, 0.32)); if (k <= 0) return h;
    const I = o.box === false ? iceInk(S) : ice(S, x, y, w, h, k), u = S.u, ck = E.out(prog(S.lt, t0 + 0.06, 0.25));
    blurDraw(c, ck * k, 10 * u, () => {
      const from = o.from == null ? 86 : o.from, to = o.to == null ? Math.max(0, from - 2) : o.to, step = Math.min(from - to, Math.max(0, Math.floor((S.lt - t0 - 0.5) / 0.7)));
      const v = from - step, thr = o.threshold == null ? 15 : o.threshold;
      const bx = x + h * 0.32, bw = h * 0.95, bh = h * 0.42, by = y + h / 2 - bh / 2;
      L.rr(c, bx, by, bw, bh, bh * 0.26); c.lineWidth = Math.max(2, h * 0.04); c.strokeStyle = I.fg; c.stroke();
      L.rr(c, bx + bw + h * 0.02, by + bh * 0.3, h * 0.05, bh * 0.4, h * 0.02); c.fillStyle = I.fg; c.fill();
      const ins = h * 0.055, fw = (bw - ins * 2) * v / 100;
      L.rr(c, bx + ins, by + ins, fw, bh - ins * 2, bh * 0.16); c.fillStyle = GREEN; c.fill();
      const tx = bx + ins + (bw - ins * 2) * thr / 100; L.line(c, tx, by - h * 0.05, tx, by + bh + h * 0.05, RED, Math.max(2, h * 0.03));
      const flip = swapK(S.lt, t0 + 0.5 + step * 0.7, 0.1);
      blurDraw(c, step > 0 ? flip : 1, 6 * u, () => L.text(c, S.look, `${v}%`, bx + bw + h * 0.2, y + h * 0.63, { role: 'ui', px: h * 0.32, weight: 750, color: I.fg }));
      const rx = x + w * 0.6;
      L.text(c, S.look, o.label || 'Floor', rx, y + h * 0.42, { role: 'micro', px: h * 0.11, weight: 600, color: I.dim, upper: true, maxW: w * 0.36 });
      const tw = L.text(c, S.look, `${thr}%`, rx, y + h * 0.72, { role: 'ui', px: h * 0.17, weight: 700, color: RED });
      L.text(c, S.look, o.word || 'reserve', rx + tw + h * 0.06, y + h * 0.72, { role: 'ui', px: h * 0.17, weight: 700, color: I.fg, maxW: w * 0.34 - tw });
    });
    return h;
  }
  function cardToast(S, x, y, w, t0, o) { // a green check that morphs to a dark sleep badge; the text swaps with it
    const c = S.ctx, h = w * 0.2, k = E.out(prog(S.lt, t0, 0.32)); if (k <= 0) return h;
    const I = o.box === false ? iceInk(S) : ice(S, x, y, w, h, k), u = S.u, ck = E.out(prog(S.lt, t0 + 0.06, 0.25)), ink = S.look.palette.ink;
    blurDraw(c, ck * k, 10 * u, () => {
      const sw = o.swapAt == null ? 1e9 : o.swapAt, m = swapK(S.lt, sw, 0.14), dip = 1 - 0.1 * Math.sin(Math.PI * m);
      const ix = x + h * 0.42, iy = y + h / 2, ir = h * 0.2 * dip;
      blurDraw(c, 1 - m, 6 * u, () => { L.circle(c, ix, iy, ir, GREEN); L.icon(c, 'check', ix, iy, ir * 1.25, '#FFFFFF', 3); });
      blurDraw(c, m, 6 * u, () => { L.circle(c, ix, iy, ir, mix(ink, '#000000', 0.2)); zMark(c, ix - ir * 0.24, iy + ir * 0.05, ir * 0.62, { fill: '#FFFFFF' }); zMark(c, ix + ir * 0.3, iy - ir * 0.18, ir * 0.42, { fill: '#FFFFFF' }); });
      const tx = x + h * 0.78, mw = w - h * 1.1;
      const line = (t1, t2, a) => blurDraw(c, a, 6 * u, () => { L.text(c, S.look, t1, tx, y + h * 0.5, { role: 'ui', px: h * 0.2, weight: 700, color: I.fg, maxW: mw }); L.text(c, S.look, t2, tx, y + h * 0.77, { role: 'ui', px: h * 0.11, weight: 500, color: I.dim, maxW: mw }); });
      line(o.title || 'Done', o.meta || '', 1 - m); if (m > 0) line(o.title2 || o.title || 'Asleep', o.meta2 || o.meta || '', m);
    });
    return h;
  }
  const CARDS = { status: cardStatus, thermal: cardThermal, battery: cardBattery, toast: cardToast };
  const cardH = (kind, w) => w * ({ status: 0.21, thermal: 0.25, battery: 0.2, toast: 0.2 }[kind] || 0.21);

  // the content each card shows, from the beat's data (never the reference's copy)
  function cardData(S, kind) {
    const b = S.b, d = b.data || {}, n = d.number, items = d.items || [], B = brand();
    const eyebrow = (b.text && b.text.eyebrow) || (n && n.label) || '';
    if (kind === 'status') return { label: eyebrow || 'Working', names: items.length ? items : [B.name], countLabel: (n && n.label) ? n.label.split(/\s+/).slice(0, 2).join(' ') : 'Actions', count: n && typeof n.value === 'number' ? [Math.round(n.value * 0.76), n.value] : [131, 172], num: n };
    if (kind === 'thermal') return { label: eyebrow || 'Reading', count: n && typeof n.value === 'number' ? [Math.round(n.value * 0.7), n.value] : [43, 61], num: n && typeof n.value === 'number' ? n : { suffix: '°' }, gauge: 0.6, chips: items.slice(0, 3) };
    if (kind === 'battery') { const pct = n && typeof n.value === 'number' && /%/.test(n.suffix || '') ? clamp(n.value, 20, 100) : 86; return { from: pct, to: Math.max(18, pct - 2), threshold: 15, label: eyebrow || 'Floor', word: (n && n.label ? n.label.split(/\s+/)[0] : 'reserve') }; }
    return { title: items[0] || B.name, meta: (b.text && b.text.sub) || `Done · ${B.host || ''}`, title2: B.name, meta2: B.tagline || B.host || '' };
  }

  /* ───────── stack layout: headline, the floating object, one card (side by side on 16:9) ───────── */
  function geo(S) {
    const W = S.W, H = S.H, u = S.u;
    if (isWide(S)) return { head: { x: W * 0.065, y: H * 0.3, maxW: W * 0.34, align: 'left', px: u * 118, maxLines: 4 }, obj: { cx: W * 0.7, cy: H * 0.4, w: W * 0.44 }, card: { cx: W * 0.7, cy: H * 0.77, w: W * 0.48 }, bug: { x: W * 0.045, y: H * 0.1, px: u * 52 } };
    if (isTall(S)) return { head: { x: W / 2, y: H * 0.11, maxW: W * 0.86, align: 'center', px: u * 108, maxLines: 3 }, obj: { cx: W / 2, cy: H * 0.46, w: W * 0.7 }, card: { cx: W / 2, cy: H * 0.71, w: W * 0.88 }, bug: { x: W * 0.07, y: H * 0.055, px: u * 50 } };
    return { head: { x: W / 2, y: H * 0.085, maxW: W * 0.8, align: 'center', px: u * 90, maxLines: 3 }, obj: { cx: W / 2, cy: H * 0.5, w: W * 0.68 }, card: { cx: W / 2, cy: H * 0.8, w: W * 0.78 }, bug: { x: W * 0.05, y: H * 0.07, px: u * 46 } };
  }
  const headSlot = (S, g, b) => { const n = toks(b).length; return Object.assign({}, g.head, { px: g.head.px * (n <= 3 ? 1.12 : n <= 6 ? 1 : 0.84) }); };
  const floatY = (S, amp = 6) => Math.sin(S.lt * Math.PI * 2 / 3.2) * amp * S.u;
  function bug(S, g, k = 1, col = '#FFFFFF') { if (k <= 0) return; const c = S.ctx; c.save(); c.globalAlpha *= clamp(k); wordmark(S, g.bug.x - (1 - k) * 20 * S.u, g.bug.y + g.bug.px * 0.36, g.bug.px, col, { align: 'left' }); c.restore(); }
  // sleeping Z's from a point: outlined (asleep) or solid, every `every` s, rising and growing up-right
  function zTrail(S, x, y, s, t0, o = {}) {
    const c = S.ctx, every = o.every || 0.2, life = o.life || 1.1, n = o.n || 6;
    for (let i = 0; i < n; i++) {
      const born = t0 + i * every, a = S.lt - born; if (a < 0) continue;
      const loop = o.loop ? a % (every * n) : a; if (!o.loop && a > life * 2.2) continue;
      const k = clamp(loop / life), sc = lerp(0.55, 1.15, E.out(k)) * (o.grow ? 1 + i * 0.06 : 1);
      const al = clamp(loop / 0.08) * (o.loop ? 1 - E.in(k) : (o.hold ? 1 : 1 - E.in(clamp((loop - life) / life))));
      if (al <= 0.01) continue;
      const zx = x + E.out(k) * s * (0.6 + i * 0.12) * (o.dir || 1), zy = y - E.out(k) * s * (0.9 + (o.hold ? i * 0.25 : 0.3));
      c.save(); c.globalAlpha *= al;
      zMark(c, zx, zy, s * sc, o.solid ? { fill: o.color || '#FFFFFF' } : { stroke: o.color || '#FFFFFF', lw: Math.max(1.5, s * 0.06) });
      c.restore();
    }
  }

  /* ═════════ type treatments ═════════ */
  function wordD(S, w, o) { const c = S.ctx; if (o.a <= 0.002) return; c.save(); c.globalAlpha *= clamp(o.a); if (o.blur > 0.35) c.filter = `blur(${o.blur.toFixed(2)}px)`; L.drawWord(c, S.look, S.P, w, { x: w.x + (o.dx || 0), y: w.y + (o.dy || 0), fill: o.fill || S.P.fg }); c.restore(); }
  // a two-voice lockup: plain words in the grotesk, the turn (accent words, else the second half) in serif italic
  function lockupLayout(S, lay, slot) {
    const tk = lay.words.map(w => w.tk); if (!slot || tk.length < 2) return [lay];
    let i0 = tk.findIndex(t => t.accent); if (i0 <= 0) i0 = Math.ceil(tk.length / 2);
    const l1 = tk.slice(0, i0).map(t => Object.assign({}, t, { accent: false })), l2 = tk.slice(i0).map(t => Object.assign({}, t, { accent: true }));
    const base = Object.assign({ role: 'display', align: 'center' }, slot, { maxLines: 2 });
    const a = L.layout(S.ctx, S.look, l1, base), b = L.layout(S.ctx, S.look, l2, Object.assign({}, base, { px: a.px, y: a.bottom - a.px * 0.06 }));
    return [a, b];
  }
  L.def('effect:type-grotesk-serif-lockup', {
    kind: 'type',
    plan(b, F, t0 = 0) { const n = toks(b).length, two = n >= 2; return { words: Array(n).fill(t0), done: t0 + 0.5 + (two ? 0.12 : 0), events: [{ at: t0, event: 'word' }, ...(two ? [{ at: t0 + 0.12, event: 'word' }] : [])] }; },
    draw(S, o) {
      const c = S.ctx, t0 = o.t0 || 0, lays = lockupLayout(S, o.lay, o.slot), out = o.out != null ? o.out : (o.exit !== false && S.d > 1.3 ? S.d - 0.24 : 1e9);
      let li = 0;
      for (const lay of lays) for (let l = 0; l < lay.lines; l++, li++) {
        const ws = lay.words.filter(w => w.li === l); if (!ws.length) continue;
        const k = E.out(prog(S.lt, t0 + li * 0.12, 0.5)), ko = E.in(prog(S.lt, out + li * 0.04, 0.16)); if (k <= 0 || ko >= 1) continue;
        const x0 = Math.min(...ws.map(w => w.x)), x1 = Math.max(...ws.map(w => w.x + w.w)), y = ws[0].y, px = lay.px;
        c.save(); c.beginPath(); c.rect(x0 - px, y - px * 1.1, x1 - x0 + px * 2, px * 1.5); c.clip();
        for (const w of ws) wordD(S, w, { a: clamp(k * 1.5) * (1 - ko), dy: (1 - k) * px * 0.62 - ko * px * 0.42, blur: ((1 - k) * 8 + ko * 8) * S.u });
        c.restore();
      }
    },
  });
  // letters stream in from the left with a heavy horizontal smear, staggered 25 ms
  L.def('effect:type-smear-stream', {
    kind: 'type',
    plan(b, F, t0 = 0) { const ch = toks(b).reduce((a, t) => a + t.s.length, 0); return { words: Array(toks(b).length).fill(t0), done: t0 + 0.25 + ch * 0.022, events: [{ at: t0, event: 'cascade' }] }; },
    draw(S, o) {
      const c = S.ctx, t0 = o.t0 || 0; let j = 0;
      for (const w of o.lay.words) {
        L.setFont(c, S.look, w.role, w.px, w.tk.weight); try { c.letterSpacing = w.tr.toFixed(2) + 'px'; } catch (e) { /* */ }
        const pre = []; for (let i = 0; i <= w.s.length; i++) pre.push(c.measureText(w.s.slice(0, i)).width);
        for (let i = 0; i < w.s.length; i++, j++) {
          const k = E.out(prog(S.lt, t0 + j * 0.022, 0.24)); if (k <= 0) continue;
          const dx = -(1 - k) * w.px * 1.4, ch = Object.assign({}, w, { s: w.s[i], x: w.x + pre[i] });
          const v = 1 - k;
          if (v > 0.04) for (let gI = 3; gI >= 1; gI--) wordD(S, ch, { a: 0.16 * v * 3 / gI, dx: dx - gI * w.px * 0.14 * v, blur: 2 * S.u, fill: w.tk.accent ? S.P.accent : S.P.fg });
          wordD(S, ch, { a: lerp(0.35, 1, k), dx, blur: v * 5 * S.u, fill: w.tk.accent ? S.P.accent : S.P.fg });
        }
      }
    },
  });
  // a heavy forward lean that settles: words slide in from the right leaning hard, straighten to a slant, the period
  // becomes a round dot that springs in
  L.def('effect:type-slant-dot-period', {
    kind: 'type',
    plan(b, F, t0 = 0) { const n = toks(b).length; return { words: L.wordTimes(n, t0, 0.06, 5), done: t0 + 0.4 + n * 0.06 + 0.25, events: [{ at: t0, event: 'word' }, { at: t0 + 0.3 + n * 0.06, event: 'accent' }] }; },
    draw(S, o) {
      const c = S.ctx, lay = o.lay, t0 = o.t0 || 0, n = lay.words.length, ws = L.wordTimes(n, t0, 0.06, 5), base = italicWM(S) ? -0.06 : -0.17;
      lay.words.forEach((w, i) => {
        const k = E.out(prog(S.lt, ws[i], 0.42)); if (k <= 0) return;
        const last = i === n - 1, s = last ? w.s.replace(/[.!?。]+$/, '') : w.s, ww = Object.assign({}, w, { s });
        c.save(); c.translate(0, w.y); c.transform(1, 0, lerp(-0.45, base, k), 1, 0, 0); c.translate(0, -w.y);
        wordD(S, ww, { a: clamp(k * 1.8), dx: (1 - k) * w.px * 0.6, blur: (1 - k) * 6 * S.u, fill: w.tk.accent ? S.P.accent : S.P.fg });
        if (last) {
          L.setFont(c, S.look, w.role, w.px, w.tk.weight); try { c.letterSpacing = w.tr.toFixed(2) + 'px'; } catch (e) { /* */ }
          const sw = c.measureText(s).width, dt = S.lt - (t0 + 0.3 + n * 0.06), sp = dt > 0 ? spring(dt, 'pop') : 0;
          if (sp > 0) L.circle(c, w.x + sw + w.px * 0.16, w.y - w.px * 0.1, w.px * 0.11 * clamp(sp, 0, 1.3), S.P.accent);
        }
        c.restore();
      });
    },
  });
  // the accent word cycles through the brand's items (blur swaps, a third of a second each) and lands on itself
  L.def('effect:type-name-cycle-blur', {
    kind: 'type',
    plan(b, F, t0 = 0) { const m = Math.min(4, ((b.data && b.data.items) || []).length); return { words: Array(toks(b).length).fill(t0), done: t0 + 0.2 + (m + 1) * 0.3 + 0.1, events: [{ at: t0, event: 'word' }, ...Array.from({ length: m }, (_, i) => ({ at: t0 + 0.2 + i * 0.3, event: 'click-ui' })), { at: t0 + 0.2 + m * 0.3, event: 'key-word' }] }; },
    draw(S, o) {
      const c = S.ctx, lay = o.lay, t0 = o.t0 || 0, items = ((S.b.data && S.b.data.items) || []).slice(0, 4);
      let ti = lay.words.findIndex(w => w.tk.accent); if (ti < 0) ti = lay.words.length - 1;
      const k = E.out(prog(S.lt, t0, 0.5));
      lay.words.forEach((w, i) => {
        if (i !== ti) return wordD(S, w, { a: clamp(k * 1.6), dy: (1 - k) * w.px * 0.5, blur: (1 - k) * 6 * S.u });
        const seq = [...items, w.s], at0 = t0 + 0.2, idx = Math.min(seq.length - 1, Math.max(0, Math.floor((S.lt - at0) / 0.3)));
        if (S.lt < at0) return;
        const sk = swapK(S.lt, at0 + idx * 0.3, 0.07), cur = Object.assign({}, w, { s: seq[idx] }), prev = Object.assign({}, w, { s: seq[Math.max(0, idx - 1)] });
        const fill = w.tk.accent ? S.P.accent : S.P.fg, last = idx === seq.length - 1;
        if (idx > 0 && sk < 1) wordD(S, prev, { a: 1 - sk, blur: sk * 7 * S.u, fill: mix(fill, S.P.bg, 0.35) });
        wordD(S, cur, { a: idx > 0 ? sk : clamp((S.lt - at0) / 0.07), blur: (1 - sk) * 7 * S.u, fill: last ? fill : mix(fill, S.P.bg, 0.35) });
      });
    },
  });

  /* ═════════ textures and an overlay ═════════ */
  L.def('texture:navy-spotlight-floor', {
    kind: 'texture',
    draw(S) {
      if (lum(S.P.bg) > 0.45) { const c = S.ctx; c.save(); c.translate(S.W / 2, S.H * 0.72); c.scale(1.4, 0.5); const R = Math.max(S.W, S.H) * 0.55, g = c.createRadialGradient(0, 0, 0, 0, 0, R); g.addColorStop(0, rgba('#FFFFFF', 0.7)); g.addColorStop(1, rgba('#FFFFFF', 0)); c.fillStyle = g; c.fillRect(-R, -R, 2 * R, 2 * R); c.restore(); L.vignette(c, S.W, S.H, 0.12, S.look.palette.ink); return; }
      drawNavy(S);
    },
  });
  L.def('texture:cobalt-sky-gradient', {
    kind: 'texture',
    draw(S) {
      if (lum(S.P.bg) > 0.45) { const c = S.ctx, k = skyCols(S), g = c.createLinearGradient(0, 0, 0, S.H); g.addColorStop(0, S.P.bg); g.addColorStop(0.55, mix(S.P.bg, k.bot, 0.5)); g.addColorStop(1, mix(S.P.bg, k.low, 0.55)); c.fillStyle = g; c.fillRect(0, 0, S.W, S.H); return; }
      drawSky(S);
    },
  });
  // the brand's slanted wordmark as a small bug in the top-left corner, kept on screen while claims run
  L.def('effect:corner-wordmark-bug', {
    kind: 'overlay',
    draw(S) { const g = geo(S), k = E.out(prog(S.lt, 0.05, 0.4)), col = S.stageFg || (lum(S.P.bg) > 0.45 ? S.P.fg : '#FFFFFF'); bug(S, g, k, col); },
  });

  /* ═════════ UI widgets ═════════ */
  L.def('ui:laptop-open-live', {
    kind: 'ui',
    draw(S, o) {
      const k = E.out(prog(S.lt, o.t0 || 0, 0.7)), scr = screenTex(S, { t0: o.t0 || 0 });
      laptop(S, { cx: o.x, cy: o.y + (1 - k) * 60 * S.u + floatY(S), w: o.w, yaw: lerp(-34, -20, k) + Math.sin(S.lt * 0.6) * 2, pitch: 18, lid: lerp(70, 106, E.out(prog(S.lt, (o.t0 || 0), 0.9))), screen: scr, alpha: clamp(k * 2), tint: S.P.bg });
    },
  });
  L.def('ui:laptop-closed-float', {
    kind: 'ui',
    draw(S, o) {
      const k = E.out(prog(S.lt, o.t0 || 0, 0.7));
      laptop(S, { cx: o.x, cy: o.y + (1 - k) * 80 * S.u + floatY(S, 8), w: o.w * 0.9, yaw: lerp(-55, -28, k) + S.lt * 2.2, pitch: 24, lid: 0, alpha: clamp(k * 2), lift: 0.04 + Math.sin(S.lt * Math.PI * 2 / 3.2) * 0.02, sheen: o.sheen != null ? o.sheen : (S.lt - (o.t0 || 0) - 0.8) / 1.1, tint: S.P.bg });
    },
  });
  L.def('ui:agent-step-stream', {
    kind: 'ui',
    draw(S, o) {
      const c = S.ctx, w = o.w, h = w * 0.62, x = o.x - w / 2, y = o.y - h / 2, k = E.out(prog(S.lt, o.t0 || 0, 0.5)); if (k <= 0) return;
      c.save(); c.globalAlpha *= clamp(k * 1.5); c.translate(0, (1 - k) * 30 * S.u);
      L.card(c, x, y, w, h, 18 * S.u, { fill: mix(S.look.palette.ink, '#FFFFFF', 0.075), u: S.u, lift: 1.1, shadow: 'rgba(0,0,0,0.35)' });
      drawStream(S, c, x, y, w, h, S.lt, { t0: (o.t0 || 0) + 0.2, every: 0.42, r: 18 * S.u });
      c.restore();
    },
  });
  L.def('ui:shimmer-status-line', {
    kind: 'ui',
    draw(S, o) {
      const c = S.ctx, w = o.w, h = w * 0.15, x = o.x - w / 2, y = o.y - h / 2, k = E.out(prog(S.lt, o.t0 || 0, 0.45)); if (k <= 0) return;
      c.save(); c.globalAlpha *= clamp(k * 1.5); c.translate(0, (1 - k) * 20 * S.u);
      L.card(c, x, y, w, h, h * 0.3, { fill: mix(S.look.palette.ink, '#FFFFFF', 0.07), u: S.u, lift: 0.9, shadow: 'rgba(0,0,0,0.3)' });
      const el = Math.floor(S.lt * 7 + 754);
      shimmer(c, x + h * 0.38, y + h * 0.62, h * 0.32, o.verb || 'Working…', `(${Math.floor(el / 3600) + 2}h ${String(Math.floor(el / 60) % 60).padStart(2, '0')}m · ↓ ${(31 + S.lt * 0.9).toFixed(1)}k)`, S.lt, mix(S.look.accent, '#FFFFFF', 0.3), '#FFFFFF', 'rgba(240,242,248,0.45)');
      c.restore();
    },
  });
  const cardUi = kind => ({
    kind: 'ui',
    draw(S, o) { const w = o.w, h = cardH(kind, w), d = Object.assign(cardData(S, kind), o.card || {}); if (kind === 'toast' && d.swapAt == null) d.swapAt = (o.t0 || 0) + 1.2; CARDS[kind](S, o.x - w / 2, o.y - h / 2, w, o.t0 || 0, d); },
  });
  L.def('ui:agent-status-ice-card', cardUi('status'));
  L.def('ui:thermal-gauge-ice-card', cardUi('thermal'));
  L.def('ui:battery-threshold-ice-card', cardUi('battery'));
  L.def('ui:done-to-sleep-toast', cardUi('toast'));
  // a solid black address pill with an arrow: arrives grey and blurred, sharpens to black, later one sheen crosses it
  function addressPill(S, x, y, px, t0, o = {}) {
    const c = S.ctx, host = o.label || brand().host || brand().name, k = E.out(prog(S.lt, t0, 0.22)); if (k <= 0) return null;
    const tw = L.textW(c, S.look, host, { role: 'ui', px, weight: 650 }), w = tw + px * 3.3, h = px * 2.35, ink = o.fill || S.look.palette.ink;
    const fill = mix(mix(ink, '#FFFFFF', 0.62), ink, k), fg = L.onColor(ink);
    c.save(); c.globalAlpha *= clamp(k * 1.6); if (k < 0.98) c.filter = `blur(${((1 - k) * 9 * S.u).toFixed(1)}px)`;
    const sx = lerp(0.94, 1, k); c.translate(x, y); c.scale(sx, sx); c.translate(-x, -y);
    L.card(c, x - w / 2, y - h / 2, w, h, h / 2, { fill, u: S.u, lift: 0.5, stroke: false });
    L.text(c, S.look, host, x - px * 0.6, y + px * 0.36, { role: 'ui', px, weight: 650, color: fg, align: 'center' });
    L.icon(c, 'arrowRight', x + tw / 2 + px * 0.35, y, px * 0.9, fg, 2.4);
    const sh = o.sheenAt != null ? prog(S.lt, o.sheenAt, 0.45) : 0;
    if (sh > 0 && sh < 1) { c.save(); L.rr(c, x - w / 2, y - h / 2, w, h, h / 2); c.clip(); const sxp = lerp(x - w * 0.8, x + w * 0.8, E.io(sh)), g = c.createLinearGradient(sxp - h, 0, sxp + h, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.32)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.transform(1, 0, -0.5, 1, y * 0.5, 0); c.fillRect(sxp - h * 2, y - h, h * 4, h * 2); c.restore(); }
    c.restore();
    return { w, h };
  }
  L.def('ui:address-pill-sheen', { kind: 'ui', draw(S, o) { addressPill(S, o.x, o.y, (o.px || Math.max(30 * S.u, o.w * 0.06)), o.t0 || 0, { sheenAt: (o.t0 || 0) + 1.1 }); } });
  L.def('ui:zzz-outline-trail', {
    kind: 'ui',
    draw(S, o) {
      const s = (o.size || 160 * S.u) * 0.7, col = lum(S.P.bg) > 0.45 ? S.P.fg : '#FFFFFF';
      zTrail(S, o.x - s * 0.8, o.y + s * 0.8, s, o.t0 || 0, { every: 0.2, life: 0.9, n: 6, loop: true, color: col });
      zTrail(S, o.x + s * 0.9, o.y + s * 0.7, s * 0.8, (o.t0 || 0) + 1.2, { every: 0.35, life: 0.8, n: 2, solid: true, hold: true, color: col });
    },
  });

  /* ═════════ set-ups ═════════ */
  // 1. the agent at work: an open laptop at three-quarter on the navy stage, its screen live, the lockup above
  function openGeo(S) {
    const W = S.W, H = S.H, u = S.u;
    if (isWide(S)) return { head: { x: W * 0.07, y: H * 0.34, maxW: W * 0.38, align: 'left', px: u * 112, maxLines: 4 }, obj: { cx: W * 0.68, cy: H * 0.5, w: W * 0.36 } };
    if (isTall(S)) return { head: { x: W / 2, y: H * 0.13, maxW: W * 0.86, align: 'center', px: u * 104, maxLines: 3 }, obj: { cx: W / 2, cy: H * 0.56, w: W * 0.62 } };
    return { head: { x: W / 2, y: H * 0.08, maxW: W * 0.8, align: 'center', px: u * 88, maxLines: 3 }, obj: { cx: W / 2, cy: H * 0.555, w: W * 0.6 } };
  }
  L.def('insert:laptop-agent-stage', {
    kind: 'setup',
    plan(b, F) { const tp = T(b, F, 0.08); return { cues: { head: 0.08, headDone: tp.done, obj: 0, stream: 0.2 }, events: [...tp.events, { at: 0.25, event: 'code' }, { at: 0.95, event: 'click-ui' }], exit: { kind: 'rect', x: 0.5, y: 0.55, w: 0.5, h: 0.4 }, entry: { kind: 'dot', x: 0.5, y: 0.55, r: 0.02 }, min: 1.6 }; },
    draw(S) {
      const g = openGeo(S), P = navyP(S), S2 = withP(S, P); S.stageFg = '#FFFFFF';
      drawNavy(S, g.obj.cx / S.W, g.obj.cy / S.H + 0.12);
      const k = E.out(prog(S.lt, S.at('obj'), 0.8));
      laptop(S, { cx: g.obj.cx, cy: g.obj.cy + (1 - k) * 40 * S.u + floatY(S), w: g.obj.w * lerp(0.94, 1, k), yaw: -20 + Math.sin(S.lt * 0.5) * 1.5 - (1 - k) * 8, pitch: 20, lid: 108, screen: screenTex(S, { t0: S.at('stream') }), tint: P.bg });
      L.headline(S2, headSlot(S, g, S.b));
    },
  });
  // 2. the lid falls shut: an anticipation lift, a gravity close, the glow dies, a thud and a tiny nudge
  L.def('insert:laptop-lid-shut', {
    kind: 'setup',
    plan(b, F) { const tp = T(b, F, 0.06), lift = Math.max(0.45, tp.done - 0.1), fallAt = lift + 0.3, shut = fallAt + 0.26; return { cues: { head: 0.06, headDone: tp.done, lift, fall: fallAt, shut, act: fallAt, land: shut }, events: [...tp.events, { at: lift, event: 'build' }, { at: shut, event: 'thud' }, { at: shut + 0.01, event: 'hard-hit' }], exit: { kind: 'rect', x: 0.5, y: 0.62, w: 0.5, h: 0.2 }, entry: { kind: 'rect', x: 0.5, y: 0.55, w: 0.5, h: 0.4 }, min: shut + 0.8 }; },
    draw(S) {
      const g = openGeo(S), P = navyP(S), S2 = withP(S, P); S.stageFg = '#FFFFFF';
      drawNavy(S, g.obj.cx / S.W, g.obj.cy / S.H + 0.12);
      const lt = S.lt, sh = S.at('shut'), up = E.io(prog(lt, S.at('lift'), 0.3)) * (1 - E.out(prog(lt, sh, 0.5)));
      const fk = fall(prog(lt, S.at('fall'), sh - S.at('fall'))), lid = lerp(108, 0, fk);
      const nudge = lt > sh && lt < sh + 0.07 ? Math.sin((lt - sh) / 0.07 * Math.PI) * 3 * S.u : 0;
      const glow = (1 - E.in(prog(lt, S.at('fall'), 0.22)));
      const st = E.io(prog(lt, sh + 0.05, 0.7)); // after the thud the slab settles where the asleep beat holds it
      laptop(S, { cx: g.obj.cx, cy: g.obj.cy - up * S.H * 0.05 + nudge + floatY(S, 4) + st * g.obj.w * 0.08, w: g.obj.w * (1 + 0.03 * up) * lerp(1, 0.94, st), yaw: -20 - fk * 6, pitch: 20 + fk * 6, lid, glow, screen: glow > 0.02 ? screenTex(S, { t0: -2 }) : null, tint: P.bg, c0: [0, lerp(0.3, 0.02, st), lerp(-0.13, 0, st)], lift: up * 0.08 });
      L.headline(S2, headSlot(S, g, S.b));
    },
  });
  // 3. asleep: the closed slab on the dark stage, outlined Z's rising from the lid's far corner
  L.def('insert:laptop-asleep-zzz', {
    kind: 'setup',
    plan(b, F) { const tp = T(b, F, 0.06), zz = Math.max(0.35, tp.done - 0.15); return { cues: { head: 0.06, headDone: tp.done, zz }, events: [...tp.events, { at: zz, event: 'pop' }, { at: zz + 0.4, event: 'pop' }, { at: zz + 0.8, event: 'pop' }], exit: { kind: 'dot', x: 0.6, y: 0.48, r: 0.02 }, entry: { kind: 'rect', x: 0.5, y: 0.62, w: 0.5, h: 0.2 }, min: zz + 1.2 }; },
    draw(S) {
      const g = openGeo(S), P = navyP(S), S2 = withP(S, P); S.stageFg = '#FFFFFF';
      drawNavy(S, g.obj.cx / S.W, g.obj.cy / S.H + 0.08);
      const breathe = Math.sin(S.lt * Math.PI * 2 / 3.6);
      const lp = laptop(S, { cx: g.obj.cx, cy: g.obj.cy + g.obj.w * 0.08 + breathe * 4 * S.u, w: g.obj.w * 0.94, yaw: -26 + S.lt * 0.8, pitch: 26, lid: 0, tint: P.bg, lift: 0.02 + breathe * 0.01 });
      L.headline(S2, headSlot(S, g, S.b));
      zTrail(S, lp.corner[0], lp.corner[1], g.obj.w * 0.09, S.at('zz'), { every: 0.2, life: 0.9, n: 9, loop: true, color: 'rgba(255,255,255,0.9)' });
    },
  });
  // 4. the drop: a giant brand glyph punches onto the cobalt sky with a shockwave ring, then creeps
  L.def('insert:glyph-punch-sky', {
    kind: 'setup',
    plan() { return { cues: { hit: 0, ring: 0 }, events: [{ at: 0, event: 'hard-hit' }, { at: 0.04, event: 'big-build' }], exit: { kind: 'circle', x: 0.5, y: 0.5, r: 0.1 }, entry: { kind: 'circle', x: 0.5, y: 0.5, r: 0.2 } }; },
    draw(S) {
      const c = S.ctx, k = drawSky(S); S.stageFg = '#FFFFFF';
      const cx = S.W / 2, cy = S.H * 0.5, px = Math.min(S.W, S.H) * 0.46, lt = S.lt - S.at('hit');
      const rk = prog(lt, 0, 0.5); if (rk > 0 && rk < 1) { L.circle(c, cx, cy, lerp(px * 0.6, Math.hypot(S.W, S.H) * 0.62, E.out(rk)), null, rgba('#FFFFFF', 0.55 * (1 - rk)), 14 * S.u * (1 - rk) + 1); }
      const s = L.logPull(1.3, E.out(prog(lt, 0, 0.24))) * (1 + 0.035 * clamp(lt / Math.max(0.5, S.d))) * (1 - 0.1 * E.in(prog(lt, S.d - 0.22, 0.22)));
      c.save(); c.translate(cx, cy); c.scale(s, s); c.translate(-cx, -cy);
      c.save(); c.filter = `blur(${(30 * S.u).toFixed(1)}px)`; c.globalAlpha = 0.32; glyph(S, cx + 10 * S.u, cy + 34 * S.u, px, k.top); c.restore();
      glyph(S, cx, cy, px, '#FFFFFF', { dotK: clamp(spring(lt - 0.05, 'pop'), 0, 1.3) });
      c.restore();
    },
  });
  // 5. the glyph extends into the wordmark: it shrinks to its letter, the rest stream in with smear, the line focuses in
  L.def('insert:wordmark-smear-reveal', {
    kind: 'setup',
    plan(b, F) { const n = String((F && F.brand && F.brand.name) || 'Brand').length; return { cues: { shrink: 0, letters: 0.1, tag: 0.3 + n * 0.025 }, events: [{ at: 0.05, event: 'slide-out' }, { at: 0.1, event: 'cascade' }, { at: 0.3 + n * 0.025, event: 'word' }], exit: { kind: 'dot', x: 0.5, y: 0.45, r: 0.02 }, entry: { kind: 'circle', x: 0.5, y: 0.5, r: 0.2 } }; },
    draw(S) {
      const c = S.ctx, B = brand(), name = String(B.name); drawSky(S); S.stageFg = '#FFFFFF';
      const creep = 1 + 0.03 * clamp(S.lt / Math.max(0.8, S.d)), cx = S.W / 2, cy = S.H * 0.47;
      c.save(); c.translate(cx, cy); c.scale(creep, creep); c.translate(-cx, -cy);
      const px = wmPx(S, isWide(S) ? 0.5 : 0.72), base = cy + px * 0.3, r = px * 0.1;
      const ws = [...name].map((_, i) => L.textW(c, S.look, name.slice(0, i), { role: 'wordmark', px, weight: 900, tracking: -0.05 }));
      const full = L.textW(c, S.look, name, { role: 'wordmark', px, weight: 900, tracking: -0.05 }), total = full - px * 0.02 + r * 2, x0 = cx - total / 2;
      c.save(); if (!italicWM(S)) { c.translate(cx, base); c.transform(1, 0, -0.2, 1, 0, 0); c.translate(-cx, -base); }
      const sk = E.io(prog(S.lt, S.at('shrink'), 0.18)), gpx = Math.min(S.W, S.H) * 0.46;
      [...name].forEach((ch, i) => {
        if (i === 0) { // the glyph: from its giant centred size to its slot
          const p2 = lerp(gpx, px, sk), gx = lerp(cx - L.textW(c, S.look, ch, { role: 'wordmark', px, weight: 900 }) * gpx / px / 2 - gpx * 0.1, x0, sk), gy = lerp(cy + gpx * 0.36, base, sk);
          const ks = p2 / px; c.save(); c.translate(gx, gy); c.scale(ks, ks); L.text(c, S.look, ch, 0, 0, { role: 'wordmark', px, weight: 900, color: '#FFFFFF', tracking: -0.05 }); c.restore(); return;
        }
        const k = E.out(prog(S.lt, S.at('letters') + (i - 1) * 0.025, 0.21)); if (k <= 0) return;
        const dx = -(1 - k) * px * 1.6, x = x0 + ws[i];
        for (let gI = 3; gI >= 1 && k < 0.96; gI--) { c.save(); c.globalAlpha = 0.18 * (1 - k); c.filter = `blur(${(2 * S.u).toFixed(1)}px)`; L.text(c, S.look, ch, x + dx - gI * px * 0.16 * (1 - k), base, { role: 'wordmark', px, weight: 900, color: '#FFFFFF', tracking: -0.05 }); c.restore(); }
        c.save(); c.globalAlpha = lerp(0.35, 1, k); if (k < 0.97) c.filter = `blur(${((1 - k) * 6 * S.u).toFixed(1)}px)`; L.text(c, S.look, ch, x + dx, base, { role: 'wordmark', px, weight: 900, color: '#FFFFFF', tracking: -0.05 }); c.restore();
      });
      const dk = spring(S.lt - (S.at('letters') + name.length * 0.025 + 0.05), 'pop'); if (dk > 0) L.circle(c, x0 + full - px * 0.02 + r, base - r, r * clamp(dk, 0, 1.3), '#FFFFFF');
      c.restore();
      const pk = E.in(prog(S.lt, S.d - 0.5, 0.5)); if (pk > 0) { const g = geo(S); laptop(S, { cx: g.obj.cx, cy: lerp(S.H * 1.4, S.H * 1.12, pk), w: g.obj.w, yaw: -62, pitch: 34, lid: 0, tint: skyCols(S).mid, lift: 0.4, shadow: 0 }); }
      const tk = E.out(prog(S.lt, S.at('tag'), 0.3)), tag = B.tagline || B.host;
      if (tag && tk > 0) blurDraw(c, tk, 8 * S.u, () => L.text(c, S.look, tag, cx, base + px * 0.55, { role: 'ui', px: Math.max(22 * S.u, px * 0.14), weight: 500, color: 'rgba(255,255,255,0.85)', align: 'center', maxW: S.W * 0.8 }));
      c.restore();
    },
  });
  // 6. the wordmark flies to the corner as the closed laptop rises from below and its first live card arrives
  L.def('insert:laptop-rise-to-stack', {
    kind: 'setup',
    plan(b, F) { const tp = T(b, F, 0.75); return { cues: { fly: 0.12, rise: 0.2, head: 0.75, headDone: tp.done, card: 0.95 }, events: [{ at: 0.12, event: 'slide-out' }, { at: 0.25, event: 'scene' }, ...tp.events, { at: 0.95, event: 'card-in' }, { at: 1.3, event: 'stat' }], exit: { kind: 'rect', x: 0.5, y: 0.82, w: 0.6, h: 0.12 }, entry: { kind: 'dot', x: 0.5, y: 0.45, r: 0.02 }, min: 2.2 }; },
    draw(S) {
      const c = S.ctx, g = geo(S), P = skyP(S), S2 = withP(S, P); drawSky(S); S.stageFg = '#FFFFFF';
      const fk = E.io(prog(S.lt, S.at('fly'), 0.32)), px0 = wmPx(S, isWide(S) ? 0.5 : 0.72), bigW = L.textW(c, S.look, brand().name, { role: 'wordmark', px: px0, weight: 900, tracking: -0.05 }) + px0 * 0.24;
      const px = lerp(px0, g.bug.px, fk), x = lerp(S.W / 2 - bigW / 2, g.bug.x, fk), y = lerp(S.H * 0.47 + px0 * 0.3, g.bug.y + g.bug.px * 0.36, fk);
      wordmark(S, x, y, px, '#FFFFFF', { align: 'left' });
      const tagK = 1 - E.in(prog(S.lt, S.at('fly') - 0.04, 0.08)), tag = brand().tagline || brand().host;
      if (tag && tagK > 0) { c.save(); c.globalAlpha *= tagK; L.text(c, S.look, tag, S.W / 2, S.H * 0.47 + px0 * 0.85, { role: 'ui', px: Math.max(22 * S.u, px0 * 0.14), weight: 500, color: 'rgba(255,255,255,0.85)', align: 'center', maxW: S.W * 0.8 }); c.restore(); }
      const rk = E.out(prog(S.lt, S.at('rise'), 0.7));
      if (rk > 0) laptop(S, { cx: g.obj.cx, cy: lerp(S.H * 1.12, g.obj.cy, rk) + floatY(S), w: g.obj.w, yaw: lerp(-62, -30, rk) + S.lt * 0.6, pitch: lerp(34, 24, rk), lid: 0, tint: P.bg, lift: 0.06 + (1 - rk) * 0.4, shadow: rk, pool: rk });
      L.headline(S2, headSlot(S, g, S.b));
      const d = cardData(S, 'status'), w = g.card.w * (isWide(S) ? 1 : 0.92); cardStatus(S, g.card.cx - w / 2, g.card.cy - cardH('status', w) / 2, w, S.at('card'), d);
    },
  });
  // 7-10. the claim beats: headline + the floating closed laptop in a fresh pose + one live ice card
  function claimSetup(kind, pose, extra = {}) {
    return {
      kind: 'setup',
      plan(b, F) {
        const tp = T(b, F, 0.05), ev = [...tp.events, { at: 0.08, event: 'card-in' }];
        if (kind === 'status') ev.push({ at: 0.6, event: 'list-item' }, { at: 1.1, event: 'stat' });
        if (kind === 'thermal') ev.push({ at: 0.25, event: 'stat' }, { at: 0.42, event: 'list-item' });
        if (kind === 'battery') ev.push({ at: 0.6, event: 'stat' });
        if (kind === 'toast') ev.push({ at: 0.3, event: 'notify' }, { at: 1.0, event: 'pop' });
        return { cues: { head: 0.05, headDone: tp.done, pose: 0, card: 0.08, swap: 1.0, sheen: 0.35 }, events: ev, exit: { kind: 'rect', x: 0.5, y: 0.82, w: 0.6, h: 0.12 }, entry: { kind: 'rect', x: 0.5, y: 0.5, w: 0.5, h: 0.25 }, min: kind === 'toast' ? 1.9 : 1.4 };
      },
      draw(S) {
        const g = geo(S), P = skyP(S), S2 = withP(S, P); drawSky(S); S.stageFg = '#FFFFFF';
        bug(S, g);
        const pk = E.io(prog(S.lt, S.at('pose'), 0.32)), yaw = lerp(pose.from, pose.yaw, pk) + S.lt * 0.8, pitch = lerp(pose.pfrom || pose.pitch, pose.pitch, pk);
        const sheen = extra.sheen ? lerp(-0.3, 1.3, E.io(prog(S.lt, S.at('sheen'), 0.9))) : null;
        const lp = laptop(S, { cx: g.obj.cx, cy: g.obj.cy + floatY(S), w: g.obj.w, yaw, pitch, lid: 0, tint: P.bg, lift: 0.05 + Math.sin(S.lt * Math.PI * 2 / 3.2) * 0.015, sheen, pool: 1 });
        L.headline(S2, headSlot(S, g, S.b));
        const d = cardData(S, kind); if (kind === 'toast') d.swapAt = S.at('swap');
        const w = g.card.w * (kind === 'thermal' ? 1.04 : kind === 'status' ? 0.92 : 0.86); CARDS[kind](S, g.card.cx - w / 2, g.card.cy - cardH(kind, w) / 2, w, S.at('card'), d);
        if (kind === 'toast') zTrail(S, lp.corner[0], lp.corner[1], g.obj.w * 0.075, S.at('swap') + 0.1, { every: 0.4, life: 0.7, n: 2, solid: true, hold: true, color: '#FFFFFF' });
      },
    };
  }
  L.def('insert:laptop-status-claim', claimSetup('status', { from: -44, yaw: -30, pitch: 24, pfrom: 30 }));
  L.def('insert:laptop-thermal-claim', claimSetup('thermal', { from: -32, yaw: -14, pitch: 24 }, { sheen: true }));
  L.def('insert:laptop-battery-claim', claimSetup('battery', { from: -16, yaw: 0, pitch: 14, pfrom: 22 }));
  L.def('insert:laptop-done-sleeps', claimSetup('toast', { from: 2, yaw: 20, pitch: 22, pfrom: 14 }));
  // 11. the carousel: N claims on one beat grid, each changes the headline, the card content and the pose together
  const POSES = [{ yaw: -30, pitch: 24 }, { yaw: -14, pitch: 24 }, { yaw: 0, pitch: 14 }, { yaw: 20, pitch: 22 }];
  const KINDS = ['status', 'thermal', 'battery', 'toast'];
  const claimsOf = b => { const it = ((b.data && b.data.items) || []).slice(0, 4); return it.length >= 2 ? it : ['Always on', 'Stays cool', 'Never drains', 'Sleeps after']; };
  L.def('insert:laptop-claim-carousel', {
    kind: 'setup',
    plan(b) {
      const n = claimsOf(b).length, per = Math.max(1.15, ((b.d || 4) - 0.3) / n), ev = [], cues = { head: 0.05, headDone: 0.6 };
      for (let i = 0; i < n; i++) { const at = 0.05 + i * per; cues['swap' + i] = at; ev.push({ at, event: i ? 'card-in' : 'scene' }, { at: at + 0.02, event: 'word' }, { at: at + 0.35, event: 'stat' }); }
      return { cues, events: ev, exit: { kind: 'rect', x: 0.5, y: 0.82, w: 0.6, h: 0.12 }, entry: { kind: 'rect', x: 0.5, y: 0.5, w: 0.5, h: 0.25 }, min: 0.3 + n * 1.15 };
    },
    draw(S) {
      const c = S.ctx, g = geo(S), P = skyP(S), S2 = withP(S, P); drawSky(S); S.stageFg = '#FFFFFF';
      bug(S, g);
      const claims = claimsOf(S.b), n = claims.length, at = i => S.at('swap' + i);
      let cur = 0; for (let i = 0; i < n; i++) if (S.lt >= at(i)) cur = i;
      // pose: each claim re-poses in a quick ease, a slow drift between
      let yaw = POSES[0].yaw - 14, pitch = 30;
      for (let i = 0; i < n; i++) { const k = E.io(prog(S.lt, at(i) + 0.05, 0.3)), p = POSES[i % 4]; yaw = lerp(yaw, p.yaw, k); pitch = lerp(pitch, p.pitch, k); }
      const sheen = (cur % 4) === 1 ? lerp(-0.3, 1.3, E.io(prog(S.lt, at(cur) + 0.3, 0.9))) : null;
      const lp = laptop(S, { cx: g.obj.cx, cy: g.obj.cy + floatY(S), w: g.obj.w, yaw: yaw + (S.lt - at(cur)) * 1.2, pitch, lid: 0, tint: P.bg, lift: 0.05, sheen, pool: 1 });
      // headlines: the claim words, the last word in the serif voice; old line leaves upward as the new one rises
      claims.forEach((s, i) => {
        if (S.lt < at(i) - 0.01 || (i < n - 1 && S.lt > at(i + 1) + 0.25)) return;
        const words = String(s).split(/\s+/), tokens = words.map((w, j) => ({ s: j === words.length - 1 && !/[.!?]$/.test(w) ? w + '.' : w, accent: words.length > 1 && j >= Math.ceil(words.length / 2) }));
        L.headline(S2, headSlot(S, g, { text: { tokens } }), { tokens, t0: at(i), type: 'effect:type-grotesk-serif-lockup', out: i < n - 1 ? at(i + 1) - 0.2 : 1e9 });
      });
      // the card container stays; its content blurs out and the next blurs in, the container easing to the new size
      const kindAt = i => KINDS[i % 4], w0 = g.card.w * 0.9, sz = i => cardH(kindAt(i), w0 * (kindAt(i) === 'thermal' ? 1.12 : 1));
      const mk = E.io(prog(S.lt, at(cur), 0.15)), hPrev = cur ? sz(cur - 1) : sz(0), h = lerp(hPrev, sz(cur), mk), w = lerp(cur && kindAt(cur - 1) === 'thermal' ? w0 * 1.12 : w0, kindAt(cur) === 'thermal' ? w0 * 1.12 : w0, mk);
      const x = g.card.cx - w / 2, y = g.card.cy - h / 2;
      const d = cardData(S, kindAt(cur)); if (kindAt(cur) === 'toast') d.swapAt = at(cur) + 0.6;
      // one container: the glass stays, the old content blurs out, the new blurs in
      ice(S, x, y, w, h, cur ? 1 : E.out(prog(S.lt, at(0) + 0.05, 0.32)));
      if (cur > 0 && S.lt < at(cur) + 0.12) { const ko = E.out(prog(S.lt, at(cur), 0.08)); c.save(); c.globalAlpha *= 1 - ko; c.filter = `blur(${(ko * 10 * S.u).toFixed(1)}px)`; CARDS[kindAt(cur - 1)](S, x, g.card.cy - cardH(kindAt(cur - 1), w) / 2, w, at(cur - 1) - 5, Object.assign(cardData(S, kindAt(cur - 1)), { box: false })); c.restore(); }
      CARDS[kindAt(cur)](S, x, g.card.cy - cardH(kindAt(cur), w) / 2, w, cur ? at(cur) - 0.08 : at(0) + 0.05, Object.assign(d, { box: false }));
      if (kindAt(cur) === 'toast') zTrail(S, lp.corner[0], lp.corner[1], g.obj.w * 0.075, at(cur) + 0.7, { every: 0.4, life: 0.7, n: 2, solid: true, hold: true, color: '#FFFFFF' });
    },
  });
  // 12. the lid opens on the sky and the brand's own site lights the screen (the demo beat)
  L.def('insert:laptop-site-open', {
    kind: 'setup',
    plan(b, F) { const tp = T(b, F, 0.06); return { cues: { head: 0.06, headDone: tp.done, open: 0.2, lit: 0.55 }, events: [...tp.events, { at: 0.2, event: 'build' }, { at: 0.6, event: 'ui-reveal' }], exit: { kind: 'rect', x: 0.5, y: 0.58, w: 0.5, h: 0.4 }, entry: { kind: 'rect', x: 0.5, y: 0.6, w: 0.5, h: 0.15 }, min: 1.8 }; },
    draw(S) {
      const g = openGeo(S), P = skyP(S), S2 = withP(S, P); drawSky(S); S.stageFg = '#FFFFFF';
      const ok = E.outBack(prog(S.lt, S.at('open'), 0.75)), lid = lerp(2, 104, ok), lit = E.out(prog(S.lt, S.at('lit'), 0.4));
      laptop(S, { cx: g.obj.cx, cy: g.obj.cy + floatY(S), w: g.obj.w * (1 + 0.03 * clamp(S.lt / S.d)), yaw: lerp(-26, -12, E.io(prog(S.lt, 0, 1.4))), pitch: lerp(26, 16, E.io(prog(S.lt, 0.1, 1.2))), lid, glow: lit, screen: screenTex(S, { t0: S.at('lit') }), tint: P.bg, c0: [0, 0.3, -0.13], lift: 0.05, bloom: 0.6 });
      L.headline(S2, headSlot(S, g, S.b));
    },
  });

  /* ═════════ end card ═════════ */
  L.def('end_card:white-address-pill', {
    kind: 'end',
    plan(b) { return { cues: { mark: 0.05, head: 0.3, pill: 0.62, fine: 0.85, sheen: 1.9 }, events: [{ at: 0.05, event: 'scene' }, { at: 0.3, event: 'word' }, { at: 0.42, event: 'word' }, { at: 0.62, event: 'cta' }], entry: { kind: 'rect', x: 0.5, y: 0.4, w: 0.66, h: 0.16 }, min: 2.4 }; },
    draw(S) {
      const c = S.ctx, B = brand(), pal = S.look.palette, P = Object.assign({}, S.P, { bg: pal.paper, fg: pal.ink, dim: rgba(pal.ink, 0.45), accent: pal.ink }), S2 = withP(S, P); S.stageFg = pal.ink;
      const g = c.createLinearGradient(0, 0, 0, S.H * 0.5); g.addColorStop(0, mix(pal.paper, S.look.accent, 0.05)); g.addColorStop(1, pal.paper); c.fillStyle = g; c.fillRect(-S.W * 0.2, -S.H * 0.2, S.W * 1.4, S.H * 1.4);
      const wide = isWide(S), px = wmPx(S, wide ? 0.5 : 0.7), cx = S.W / 2, my = S.H * (wide ? 0.36 : 0.38);
      const mk = E.out(prog(S.lt, S.at('mark'), 0.4));
      blurDraw(c, mk, 14 * S.u, () => { c.save(); c.translate(0, (1 - mk) * 40 * S.u); wordmark(S, cx, my, px, pal.ink); c.restore(); });
      const tokens = (() => { const tk = toks(S.b), joined = tk.map(t => t.s).join(' ').replace(/[.!]/g, '').trim(); if (tk.length >= 2 && joined.toLowerCase() !== String(B.name).toLowerCase()) return tk; const tg = (B.tagline || B.host || '').split(/\s+/).filter(Boolean); return tg.map((s, i) => ({ s: i === tg.length - 1 ? s.replace(/[.!]?$/, '.') : s, accent: i >= Math.ceil(tg.length / 2) })); })();
      const hp = Math.max(40 * S.u, px * 0.36);
      const lay = tokens.length ? L.headline(S2, { x: cx, y: my + px * 0.32, maxW: S.W * 0.8, px: hp, align: 'center', maxLines: 2 }, { tokens, t0: S.at('head'), type: 'effect:type-grotesk-serif-lockup', out: 1e9 }) : null;
      const below = lay ? my + px * 0.32 + hp * 2.3 : my + px * 0.5;
      const pr = addressPill(S, cx, below + hp * 0.75, Math.max(24 * S.u, hp * 0.42), S.at('pill'), { sheenAt: S.at('sheen'), fill: pal.ink });
      const items = ((S.b.data && S.b.data.items) || []).slice(0, 3), fine = (S.b.text && S.b.text.sub) || items.join(' · ');
      const fk = E.out(prog(S.lt, S.at('fine'), 0.3));
      if (fine && fk > 0 && pr) blurDraw(c, fk, 8 * S.u, () => L.text(c, S.look, fine, cx, below + hp * 0.75 + pr.h * 0.5 + hp * 0.85, { role: 'ui', px: Math.max(16 * S.u, hp * 0.3), weight: 500, color: rgba(pal.ink, 0.42), align: 'center', maxW: S.W * 0.8 }));
    },
  });

  /* ═════════ transitions ═════════ */
  const coverR = (S, x, y) => Math.max(Math.hypot(x, y), Math.hypot(S.W - x, y), Math.hypot(x, S.H - y), Math.hypot(S.W - x, S.H - y)) * 1.04;
  // the brand glyph, translucent, swells at the lens over the old shot; one light frame; the new world is there
  L.def('transition:glyph-fly-at-lens', {
    kind: 'transition', plan() { return { pre: 0.16, post: 0.16, events: [{ at: -0.16, event: 'build' }, { at: 0, event: 'hard-hit' }] }; },
    tr(S, A, B, k, o) {
      const c = S.ctx, dt = S.t - o.cut, pre = o.pre || 0.16, post = o.post || 0.16, cx = S.W / 2, cy = S.H / 2, px = Math.min(S.W, S.H) * 0.46;
      if (dt < 0) {
        const g = E.in(clamp(1 + dt / pre)), s = L.logLerp(0.7, 5.5, g); c.drawImage(A, 0, 0);
        c.save(); c.globalAlpha = lerp(0.5, 0.9, g); if (g > 0.3) c.filter = `blur(${((g - 0.3) * 10 * S.u).toFixed(1)}px)`; c.translate(cx, cy); c.scale(s, s); c.translate(-cx, -cy); glyph(S, cx, cy, px, mix((S.PA || S.P).bg, '#FFFFFF', 0.82)); c.restore();
      } else {
        const g = clamp(dt / post); c.drawImage(B, 0, 0);
        if (dt < 1 / 30) { c.save(); c.globalAlpha = 0.7; c.fillStyle = mix(S.P.bg, '#FFFFFF', 0.6); c.fillRect(0, 0, S.W, S.H); c.restore(); }
        c.save(); c.globalAlpha = 0.35 * (1 - g); c.filter = `blur(${(10 * S.u).toFixed(1)}px)`; const s = L.logLerp(5.5, 11, E.out(g)); c.translate(cx, cy); c.scale(s, s); c.translate(-cx, -cy); glyph(S, cx, cy, px, '#FFFFFF'); c.restore();
      }
    },
  });
  // the new world bursts open in a disc from the centre, a thin white shockwave ring overshooting out of frame
  L.def('transition:disc-burst-ring', {
    kind: 'transition', plan() { return { pre: 0.05, post: 0.42, events: [{ at: 0, event: 'hard-hit' }] }; },
    tr(S, A, B, k, o) {
      const c = S.ctx, dt = S.t - o.cut, p = o.to && o.to.x != null ? { x: o.to.x * S.W, y: o.to.y * S.H } : { x: S.W / 2, y: S.H / 2 };
      if (dt < 0) { c.drawImage(A, 0, 0); c.save(); c.globalAlpha = 0.5 * clamp(1 + dt / (o.pre || 0.05)); c.fillStyle = mix((S.PA || S.P).bg, '#FFFFFF', 0.55); c.fillRect(0, 0, S.W, S.H); c.restore(); return; }
      const g = clamp(dt / (o.post || 0.42)), r = lerp(Math.min(S.W, S.H) * 0.2, coverR(S, p.x, p.y), E.out(clamp(g * 1.25)));
      c.drawImage(A, 0, 0);
      c.save(); c.beginPath(); c.arc(p.x, p.y, r, 0, Math.PI * 2); c.clip(); c.drawImage(B, 0, 0); c.restore();
      const rr = r * 1.06 + E.out(g) * Math.min(S.W, S.H) * 0.12; L.circle(c, p.x, p.y, rr, null, rgba('#FFFFFF', 0.62 * (1 - g)), (16 * (1 - g) + 1.5) * S.u);
    },
  });
  // sleep marks converge: three Z's from the old shot's exit fly together, fill in and burst at the centre
  L.def('transition:zzz-converge-glyph', {
    kind: 'transition', plan() { return { pre: 0.34, post: 0.28, events: [{ at: -0.34, event: 'cascade' }, { at: -0.04, event: 'accent' }, { at: 0, event: 'hard-hit' }] }; },
    tr(S, A, B, k, o) {
      const c = S.ctx, dt = S.t - o.cut, pre = o.pre || 0.34, cx = S.W / 2, cy = S.H / 2, s0 = Math.min(S.W, S.H) * 0.07, s1 = Math.min(S.W, S.H) * 0.34;
      const fx = (o.from && o.from.x != null ? o.from.x : 0.62) * S.W, fy = (o.from && o.from.y != null ? o.from.y : 0.45) * S.H;
      if (dt < 0) {
        const g = clamp(1 + dt / pre); c.drawImage(A, 0, 0);
        c.save(); c.globalAlpha = 0.45 * E.in(g); c.fillStyle = (S.PA || S.P).bg; c.fillRect(0, 0, S.W, S.H); c.restore();
        for (let i = 0; i < 3; i++) {
          const gi = E.ramp(clamp((g - i * 0.12) / 0.76)), sx = fx + (i - 1) * s0 * 1.1, sy = fy - i * s0 * 0.9;
          const x = lerp(sx, cx + (i - 1) * s1 * 0.18 * (1 - gi), gi), y = lerp(sy, cy, gi), s = lerp(s0 * (0.8 + i * 0.15), s1 * (i === 1 ? 1 : 0.6), gi);
          const fill = clamp((gi - 0.5) * 2);
          zMark(c, x, y, s, { stroke: rgba('#FFFFFF', 0.9 * (1 - fill)), lw: Math.max(2, s * 0.05), fill: fill > 0 ? rgba('#FFFFFF', fill) : null });
        }
      } else {
        const g = clamp(dt / (o.post || 0.28)); c.drawImage(B, 0, 0);
        c.save(); c.globalAlpha = 1 - E.out(g); zMark(c, cx, cy, s1 * L.logLerp(1, 3.2, E.in(g)), { fill: '#FFFFFF' }); c.restore();
      }
    },
  });
  // the whole stack slides up while the world's bottom colour stretches and fades into the next world's paper;
  // the next shot rises through a blur
  L.def('transition:sky-scroll-to-white', {
    kind: 'transition', plan() { return { pre: 0.26, post: 0.42, events: [{ at: -0.26, event: 'slide-out' }, { at: 0.04, event: 'scene' }] }; },
    tr(S, A, B, k, o) {
      const c = S.ctx, g = E.io(k), dy = -g * S.H * 0.78, dt = S.t - o.cut;
      c.fillStyle = S.P.bg; c.fillRect(0, 0, S.W, S.H);
      const yb = S.H + dy, ext = S.H * 0.9;
      c.drawImage(A, 0, S.H - 2, S.W, 2, 0, yb - 1, S.W, ext);
      const gr = c.createLinearGradient(0, yb, 0, yb + ext); gr.addColorStop(0, rgba(S.P.bg, 0)); gr.addColorStop(1, rgba(S.P.bg, 1)); c.fillStyle = gr; c.fillRect(0, yb - 1, S.W, ext + 2);
      c.drawImage(A, 0, dy);
      if (dt > 0) { const h = E.out(clamp(dt / (o.post || 0.42))); c.save(); c.globalAlpha = h; if (h < 0.98) c.filter = `blur(${((1 - h) * 14 * S.u).toFixed(1)}px)`; c.drawImage(B, 0, (1 - h) * S.H * 0.08); c.restore(); }
    },
  });
  // a lid shuts over the frame: a dark panel hinges down from the top edge (its free edge widens as it nears the
  // lens, a light rim on it), the shot dims under it, then it lifts off the next shot
  function lidPanel(S, c, g) {
    const y = g * S.H * 1.02, spread = S.W * 0.12 * Math.sin(g * Math.PI / 2), ink = S.look.palette.ink;
    if (g <= 0) return;
    c.save(); c.beginPath(); c.moveTo(-2, 0); c.lineTo(S.W + 2, 0); c.lineTo(S.W + spread, y); c.lineTo(-spread, y); c.closePath();
    const gr = c.createLinearGradient(0, 0, 0, Math.max(1, y)); gr.addColorStop(0, mix(ink, '#000000', 0.3)); gr.addColorStop(0.8, mix(ink, '#FFFFFF', 0.06)); gr.addColorStop(1, mix(ink, '#FFFFFF', 0.14));
    c.shadowColor = 'rgba(0,0,0,0.45)'; c.shadowBlur = 40 * S.u; c.shadowOffsetY = 18 * S.u; c.fillStyle = gr; c.fill(); c.shadowColor = 'transparent';
    L.line(c, -spread, y - 2 * S.u, S.W + spread, y - 2 * S.u, 'rgba(255,255,255,0.55)', 2.5 * S.u);
    c.restore();
  }
  L.def('transition:lid-shut-reveal', {
    kind: 'transition', plan() { return { pre: 0.3, post: 0.34, events: [{ at: -0.3, event: 'slide-out' }, { at: 0, event: 'thud' }] }; },
    tr(S, A, B, k, o) {
      const c = S.ctx, dt = S.t - o.cut;
      if (dt < 0) { const g = fall(clamp(1 + dt / (o.pre || 0.3))); c.drawImage(A, 0, 0); c.save(); c.globalAlpha = 0.6 * g; c.fillStyle = '#000'; c.fillRect(0, 0, S.W, S.H); c.restore(); lidPanel(S, c, g); }
      else { const g = 1 - E.out(clamp(dt / (o.post || 0.34))); c.drawImage(B, 0, 0); c.save(); c.globalAlpha = 0.6 * g; c.fillStyle = '#000'; c.fillRect(0, 0, S.W, S.H); c.restore(); lidPanel(S, c, g); }
    },
  });

  /* ═════════ cameras ═════════ */
  // before a mechanical action the shot eases up and in, holds, the action lands with a 2-frame nudge, it settles
  L.def('camera:anticipation-lift', {
    kind: 'camera',
    cam(lt, d, o, S) {
      const act = S && S.cues.act != null ? S.at('act') : d * 0.45, land = S && S.cues.land != null ? S.at('land') : act + 0.26, u = (S && S.u) || 1, H = (S && S.H) || 1080;
      const up = E.io(prog(lt, act - 0.32, 0.3)) * (1 - E.out(prog(lt, land, 0.45)));
      const nud = lt > land && lt < land + 0.07 ? Math.sin((lt - land) / 0.07 * Math.PI) * 3 * u : 0;
      return { s: (1 + 0.02 * clamp(lt / Math.max(0.1, d))) * (1 + 0.03 * up), x: 0, y: -up * 0.03 * H + nud, r: 0 };
    },
  });
  // holds, then steps on each claim (swap cues or quarters of the beat): a quick eased push and a side shift
  L.def('camera:repose-steps', {
    kind: 'camera',
    cam(lt, d, o, S) {
      let s = 1, x = 0; const u = (S && S.u) || 1;
      for (let i = 1; i < 4; i++) { const at = S && S.cues['swap' + i] != null ? S.at('swap' + i) : d * i / 4, k = E.io(prog(lt, at, 0.3)); s += 0.012 * k; x += (i % 2 ? -1 : 1) * 12 * u * k; }
      return { s: s + 0.012 * clamp(lt / Math.max(0.1, d)), x, y: Math.sin(lt * 1.1) * 3 * u, r: 0 };
    },
  });
  // a slow 3.5% creep in log space, then a quick recoil in the last 0.2 s (hands the frame to the next beat)
  L.def('camera:creep-recoil', {
    kind: 'camera',
    cam(lt, d) { return { s: L.logLerp(1, 1.035, clamp(lt / Math.max(0.1, d))) * (1 - 0.06 * E.in(prog(lt, d - 0.2, 0.2))), x: 0, y: 0, r: 0 }; },
  });
})(globalThis.LAUNCH);
