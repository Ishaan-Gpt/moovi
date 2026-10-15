/**
 * Anatomy's isometric core: projection, extruded solids with facing-shaded sides, the part decorations, the film's
 * frame model (sections of figures, camera, enter springs, explode, keyed moves, pipes/wires/tracks, particles, props,
 * dimension lines, trails, ghost housings, tags, the detail circle, callouts) and its SVG. Re-implemented from the
 * MIT-licensed anatomy skill's kit (https://github.com/wheresryan22/anatomy, kit/iso-kit.ts: `iso`, `depthOf`,
 * `extrude`, `roundedPlan`), extended for a timed reel made of many figures.
 *
 * ONE source for Node and the browser: `anatomyLib` is self-contained (no imports, no closures over module scope), so
 * the player inlines it with Function#toString and the engine calls the very same functions to validate a film
 * (content inside the safe area, labels apart) before anything is served. Keep it plain JS-shaped: no classes, no spread.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

export function anatomyLib() {
  const RAD = Math.PI / 180;
  const cl = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const f1 = (n: number) => { const v = Math.round(n * 10) / 10; return v === 0 ? '0' : String(v); };
  const ease = (u: number) => { u = cl(u); return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; };
  const EXIT = 0.5;         // seconds a figure takes to lift away before the next one lands
  const MOVE = 0.85;        // seconds a keyed move (a slide, a spread, a notch round a ring) takes

  /* ── camera ── */
  function cam(P: any) { const a = P.az * RAD, e = P.el * RAD; return { sa: Math.sin(a), ca: Math.cos(a), se: Math.sin(e), ce: Math.cos(e), k: P.s }; }
  function iso(p: number[], P: any, C?: any) { C = C || cam(P); return [P.ox + (p[0]! * C.sa - p[1]! * C.ca) * C.k, P.oy + ((p[0]! * C.ca + p[1]! * C.sa) * C.se - p[2]! * C.ce) * C.k]; }
  function depth(p: number[], P: any, C?: any) { C = C || cam(P); return (p[0]! * C.ca + p[1]! * C.sa) * C.ce + p[2]! * C.se; }
  function path(pts: number[][], closed?: boolean) { let s = ''; for (let i = 0; i < pts.length; i++) s += (i ? 'L' : 'M') + f1(pts[i]![0]!) + ' ' + f1(pts[i]![1]!); return pts.length ? s + (closed ? 'Z' : '') : ''; }

  /* ── plans ── */
  function rounded(x: number, y: number, w: number, d: number, r: number) {
    r = Math.max(0, Math.min(r || 0, w / 2, d / 2)); const out: number[][] = [], n = r > 0 ? 5 : 0;
    const cs = [[x + w - r, y + r, -90], [x + w - r, y + d - r, 0], [x + r, y + d - r, 90], [x + r, y + r, 180]];
    for (const c of cs) for (let s = 0; s <= n; s++) { const a = (c[2]! + (n ? 90 * s / n : 45)) * RAD; out.push([c[0]! + r * Math.cos(a), c[1]! + r * Math.sin(a)]); }
    return out;
  }
  function circle(cx: number, cy: number, r: number, n: number) { const out: number[][] = []; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } return out; }
  function gear(cx: number, cy: number, r: number, teeth: number, rot: number) {
    const out: number[][] = [], ri = r * 0.84;
    for (let i = 0; i < teeth; i++) for (const [f, rr] of [[0, ri], [0.12, r], [0.42, r], [0.54, ri]] as number[][]) { const a = (i + f!) / teeth * Math.PI * 2 + rot * RAD; out.push([cx + rr! * Math.cos(a), cy + rr! * Math.sin(a)]); }
    return out;
  }
  function area(pts: number[][]) { let s = 0; for (let i = 0; i < pts.length; i++) { const a = pts[i]!, b = pts[(i + 1) % pts.length]!; s += a[0]! * b[1]! - b[0]! * a[1]!; } return s / 2; }
  function hull(pts: number[][]) {
    const p = pts.slice().sort((a, b) => a[0]! - b[0]! || a[1]! - b[1]!); if (p.length < 3) return p;
    const cr = (o: number[], a: number[], b: number[]) => (a[0]! - o[0]!) * (b[1]! - o[1]!) - (a[1]! - o[1]!) * (b[0]! - o[0]!);
    const lo: number[][] = [], up: number[][] = [];
    for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2]!, lo[lo.length - 1]!, q) <= 0) lo.pop(); lo.push(q); }
    for (let i = p.length - 1; i >= 0; i--) { const q = p[i]!; while (up.length >= 2 && cr(up[up.length - 2]!, up[up.length - 1]!, q) <= 0) up.pop(); up.push(q); }
    return lo.slice(0, -1).concat(up.slice(0, -1));
  }

  /* ── colour ── */
  function hexRgb(h: string) { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function mix(a: string, b: string, u: number) { const x = hexRgb(a), y = hexRgb(b); return 'rgb(' + [0, 1, 2].map(i => Math.round(x[i]! + (y[i]! - x[i]!) * cl(u))).join(',') + ')'; }
  /** the shade ramp: 4 side tones (darkest → lightest) blended in `levels` bands */
  function ramp(stops: string[], u: number, levels: number) {
    const q = Math.round(cl(u) * (levels - 1)) / (levels - 1), x = q * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(x));
    return mix(stops[i]!, stops[i + 1]!, x - i);
  }

  /**
   * One extruded solid (the kit's `extrude`): a plan ring lifted from z by h (a smaller top ring makes a frustum).
   * Sides that face the viewer are shaded by how they face the light (from the camera's back-left, so a turning camera
   * keeps the same lighting logic); the top is lighter; the outline is the silhouette, the crease is where the top
   * meets the visible sides.
   */
  function extrude(ring: number[][], z: number, h: number, P: any, convex: boolean, topRing?: number[][]) {
    const C = cam(P), n = ring.length, ccw = area(ring) > 0, vx = C.ca, vy = C.sa, lx = -C.sa, ly = C.ca;
    const nm = ring.map((a, i) => { const b = ring[(i + 1) % n]!, dx = b[0]! - a[0]!, dy = b[1]! - a[1]!, L = Math.hypot(dx, dy) || 1; return ccw ? [dy / L, -dx / L] : [-dy / L, dx / L]; });
    const fac = nm.map(v => v[0]! * vx + v[1]! * vy > 1e-9);
    const top = (topRing || ring).map(p => iso([p[0]!, p[1]!, z + h], P, C)), bot = ring.map(p => iso([p[0]!, p[1]!, z], P, C));
    const faces: { d: string; lit: number }[] = [];
    if (h > 0) for (let i = 0; i < n; i++) {
      if (!fac[i]) continue; const j = (i + 1) % n;
      faces.push({ d: path([top[i]!, top[j]!, bot[j]!, bot[i]!], true), lit: (nm[i]![0]! * lx + nm[i]![1]! * ly + 1) / 2 });
    }
    let outline = '';
    if (convex) outline = path(hull(top.concat(bot)), true);
    else { for (let i = 0; i < n; i++) { const j = (i + 1) % n; if (!fac[i]) outline += path([top[i]!, top[j]!]); else outline += path([bot[i]!, bot[j]!]); if (fac[i] !== fac[(i + n - 1) % n]) outline += path([top[i]!, bot[i]!]); } }
    let crease = ''; for (let i = 0; i < n; i++) if (fac[i]) crease += path([top[i]!, top[(i + 1) % n]!]);
    return { fill: convex ? path(hull(top.concat(bot)), true) : '', top: path(top, true), faces, outline, crease, topPts: top };
  }

  function tones(pal: any, tone: string) {
    const stops = tone === 'acc' ? [pal.accentShade[0], pal.accentShade[1], pal.accentShade[1], pal.accentTop] : tone === 'dark' ? [pal.darkShade[0], pal.darkShade[1], pal.darkShade[1], pal.darkTop] : pal.shade;
    const topFill = tone === 'acc' ? pal.accentTop : tone === 'dark' ? pal.darkTop : tone === 'lit' ? pal.litTop : pal.top;
    const ink = tone === 'lit' ? pal.lit : tone === 'hi' ? pal.hi : tone === 'acc' ? pal.accentShade[0] : tone === 'dark' ? (pal.theme === 'dark' ? pal.lo : pal.hi) : pal.mid;
    return { stops, topFill, ink };
  }

  /**
   * A prism: a convex profile (u across the axis, v up) extruded along x or y. Visible side faces are shaded by their
   * 3D normal (an upward face takes the top's tone), the visible end cap is lit by its facing, the outline is the hull.
   */
  function prismSvg(pr: any, x0: number, y0: number, z0: number, P: any, F: any, tone: string, st: any, sw: number) {
    const pal = F.pal, T = F.tokens, C = cam(P), tt = tones(pal, tone), L = pr.len / 2;
    const a = ((pr.rot || 0) + (pr.spin || 0) * (F.t || 0)) * RAD, ca = Math.cos(a), sa = Math.sin(a);
    const poly = pr.poly.map((q: number[]) => [q[0]! * ca - q[1]! * sa, q[0]! * sa + q[1]! * ca]);
    const P3 = (u: number, v: number, s: number) => pr.ax === 'x' ? [x0 + s, y0 + u, z0 + v] : [x0 + u, y0 + s, z0 + v];
    const A = poly.map((q: number[]) => P3(q[0]!, q[1]!, -L)), B = poly.map((q: number[]) => P3(q[0]!, q[1]!, L));
    const pa = A.map((p: number[]) => iso(p, P, C)), pb = B.map((p: number[]) => iso(p, P, C));
    const view = [C.ca * C.ce, C.sa * C.ce, C.se], ccw = area(poly) > 0, n = poly.length;
    let s = '<path d="' + path(hull(pa.concat(pb)), true) + '" fill="' + tt.stops[0] + '"/>';
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, du = poly[j]![0]! - poly[i]![0]!, dv = poly[j]![1]! - poly[i]![1]!, Ln = Math.hypot(du, dv) || 1;
      const nu = ccw ? dv / Ln : -dv / Ln, nv = ccw ? -du / Ln : du / Ln, N = pr.ax === 'x' ? [0, nu, nv] : [nu, 0, nv];
      if (N[0]! * view[0]! + N[1]! * view[1]! + N[2]! * view[2]! <= 1e-6) continue;
      const fill = N[2]! > 0.62 ? tt.topFill : ramp(tt.stops, (N[0]! * -C.sa + N[1]! * C.ca + 1) / 2 + N[2]! * 0.3, T.SHADE.levels);
      const q = [pa[i], pa[j], pb[j], pb[i]];
      s += '<path d="' + path(q, true) + '" fill="' + fill + '" stroke="' + fill + '" stroke-width=".6"/>';
      if (pr.grid && pr.grid.e === i) { // a grid in the plane of this face (solar cells, louvres)
        let g = ''; const lp = (u: number, v: number) => { const p0 = [pa[i]![0]! + (pa[j]![0]! - pa[i]![0]!) * u, pa[i]![1]! + (pa[j]![1]! - pa[i]![1]!) * u], p1 = [pb[i]![0]! + (pb[j]![0]! - pb[i]![0]!) * u, pb[i]![1]! + (pb[j]![1]! - pb[i]![1]!) * u]; return [p0[0]! + (p1[0]! - p0[0]!) * v, p0[1]! + (p1[1]! - p0[1]!) * v]; };
        for (let k = 1; k < pr.grid.nu; k++) g += path([lp(0, k / pr.grid.nu), lp(1, k / pr.grid.nu)]);
        for (let k = 1; k < pr.grid.nv; k++) g += path([lp(k / pr.grid.nv, 0), lp(k / pr.grid.nv, 1)]);
        s += '<path d="' + g + '"' + st(pal.screenLine, T.STROKE.detail * 0.9, ' opacity=".7"') + '/>';
      }
    }
    const axis = pr.ax === 'x' ? view[0]! : view[1]!, capPts = axis > 0 ? pb : pa;
    if (Math.abs(axis) > 0.02) {
      const capLit = (pr.ax === 'x' ? -C.sa : C.ca) * Math.sign(axis);
      s += '<path d="' + path(capPts, true) + '" fill="' + ramp(tt.stops, (capLit + 1) / 2 + 0.15, T.SHADE.levels) + '"' + st(tone === 'acc' ? pal.accentShade[1] : pal.faint, T.STROKE.crease).replace(' fill="none"', '') + '/>';
      if (pr.hub) {
        const sx = axis > 0 ? L : -L, hb = poly.map((q: number[]) => iso(P3(q[0]! * pr.hub, q[1]! * pr.hub, sx), P, C));
        s += '<path d="' + path(hb, true) + '" fill="' + (tone === 'dark' ? pal.mid : pal.dark) + '"' + st(pal.hi, T.STROKE.detail).replace(' fill="none"', '') + '/>';
      }
    }
    s += '<path d="' + path(hull(pa.concat(pb)), true) + '"' + st(tt.ink, sw) + '/>';
    return s;
  }

  /* ── a primitive (one solid + its decorations) at an offset ── */
  function prim(pr: any, o: number[], P: any, F: any, look: string) {
    const pal = F.pal, T = F.tokens, C = cam(P), k = C.k, x0 = o[0]! + pr.x, y0 = o[1]! + pr.y, z0 = o[2]! + pr.z;
    const tone = look === 'lit' && pr.t === 'hi' ? 'lit' : look === 'ghost' && pr.t !== 'lo' ? 'mid' : pr.t;
    const tt = tones(pal, tone), stops = tt.stops, topFill = tt.topFill, ink = tt.ink;
    const sw = (tone === 'hi' || tone === 'lit' ? T.STROKE.outlineHi : T.STROKE.outline) * (0.75 + 0.25 * Math.min(2, F.zoom || 1));
    const st = (c: string, w: number, extra?: string) => ' fill="none" stroke="' + c + '" stroke-width="' + f1(w) + '" stroke-linecap="round" stroke-linejoin="round"' + (extra || '');
    let s = '';
    if (pr.k === 'ball') {
      const c = iso([x0, y0, z0], P, C), r = pr.r * k;
      return '<circle cx="' + f1(c[0]!) + '" cy="' + f1(c[1]!) + '" r="' + f1(r) + '" fill="url(#' + (tone === 'acc' ? 'ballA' : tone === 'dark' ? 'ballD' : 'ballG') + ')"' + st(ink, sw).replace(' fill="none"', '') + '/>';
    }
    if (pr.k === 'prism') return prismSvg(pr, x0, y0, z0, P, F, tone, st, sw);
    const rot = (pr.spin || 0) * (F.t || 0);
    const ring = pr.k === 'cyl' ? circle(x0, y0, pr.r, pr.n || 30) : pr.k === 'gear' ? gear(x0, y0, pr.r, pr.teeth || 12, rot) : rounded(x0, y0, pr.w, pr.d, pr.r || 0);
    const rt = pr.k === 'cyl' && pr.r2 != null ? pr.r2 : pr.r;
    const S = extrude(ring, z0, pr.h, P, pr.k !== 'gear', pr.k === 'cyl' && pr.r2 != null ? circle(x0, y0, pr.r2, pr.n || 30) : undefined);
    if (S.fill) s += '<path d="' + S.fill + '" fill="' + stops[0] + '"/>';
    for (const fc of S.faces) s += '<path d="' + fc.d + '" fill="' + ramp(stops, fc.lit, T.SHADE.levels) + '" stroke="' + ramp(stops, fc.lit, T.SHADE.levels) + '" stroke-width=".6"/>';
    s += '<path d="' + S.top + '" fill="' + topFill + '"/>';
    s += '<path d="' + S.crease + '"' + st(tone === 'acc' ? pal.accentShade[1] : tone === 'dark' ? pal.darkShade[1] : pal.faint, T.STROKE.crease) + '/>';
    // decorations
    const zt = z0 + pr.h, dw = T.STROKE.detail;
    const rAt = (zf: number) => pr.r + (rt - pr.r) * zf;
    const onTop = (u: number, v: number) => pr.k === 'box' ? iso([x0 + u * pr.w, y0 + v * pr.d, zt], P, C) : iso([x0 + u * rt, y0 + v * rt, zt], P, C);
    const onFace = (f: string, u: number, v: number) => {
      if (pr.k !== 'box') { const a = (P.az + (u - 0.5) * 170) * RAD; return iso([x0 + Math.cos(a) * rAt(v), y0 + Math.sin(a) * rAt(v), z0 + v * pr.h], P, C); }
      return f === 'x' ? iso([x0 + pr.w, y0 + u * pr.d, z0 + v * pr.h], P, C) : iso([x0 + u * pr.w, y0 + pr.d, z0 + v * pr.h], P, C);
    };
    const colr = (t: string) => t === 'acc' ? pal.accent : t === 'hi' ? pal.hi : t === 'lo' ? pal.lo : t === 'faint' ? pal.faint : t === 'line' ? pal.screenLine : pal.mid;
    for (const dc of pr.deco || []) {
      if (dc.d === 'top' || dc.d === 'face') {
        let dd = ''; for (const ln of dc.l) dd += path(ln.map((q: number[]) => dc.d === 'top' ? onTop(q[0]!, q[1]!) : onFace(dc.f, q[0]!, q[1]!)), !!dc.closed);
        s += '<path d="' + dd + '"' + st(colr(dc.t || 'mid'), dc.w ? dc.w : dw) + (dc.dash ? ' stroke-dasharray="' + dc.dash + '"' : '') + '/>';
      } else if (dc.d === 'quad') {
        const q = dc.q, f = dc.f, pt = (u: number, v: number) => f === 'top' ? onTop(u, v) : onFace(f, u, v);
        const fill = dc.fill === 'screen' ? pal.screen : dc.fill === 'acc' ? pal.accent : dc.fill === 'soft' ? pal.soft : dc.fill === 'dark' ? pal.dark : pal.paper;
        s += '<path d="' + path([pt(q[0], q[1]), pt(q[2], q[1]), pt(q[2], q[3]), pt(q[0], q[3])], true) + '" fill="' + fill + '"' + st(dc.fill === 'screen' || dc.fill === 'dark' ? pal.hi : pal.mid, dw).replace(' fill="none"', '') + '/>';
        if (dc.ui) { // a screen's interface, drawn in the plane of the screen: header bar, rows, one accent block
          const L = (u0: number, v0: number, u1: number, v1: number) => path([pt(q[0] + (q[2] - q[0]) * u0, q[1] + (q[3] - q[1]) * v0), pt(q[0] + (q[2] - q[0]) * u1, q[1] + (q[3] - q[1]) * v1)]);
          const flip = f === 'top' ? 1 : -1, V = (v: number) => flip > 0 ? v : 1 - v;
          let ui = L(0.1, V(0.16), 0.9, V(0.16)); for (const [v, w] of [[0.42, 0.7], [0.56, 0.55], [0.7, 0.62], [0.84, 0.4]] as number[][]) ui += L(0.1, V(v!), 0.1 + w!, V(v!));
          s += '<path d="' + ui + '"' + st(pal.screenLine, dw * 1.15, ' opacity=".8"') + '/>';
          const a0 = pt(q[0] + (q[2] - q[0]) * 0.62, q[1] + (q[3] - q[1]) * V(0.3)), a1 = pt(q[0] + (q[2] - q[0]) * 0.88, q[1] + (q[3] - q[1]) * V(0.3));
          s += '<path d="' + path([a0, a1]) + '"' + st(pal.accent, dw * 3.2) + '/>';
        }
      } else if (dc.d === 'dots') {
        for (const q of dc.p) { const c = onTop(q[0], q[1]), r = (dc.r || 2.4) * k; s += '<circle cx="' + f1(c[0]!) + '" cy="' + f1(c[1]!) + '" r="' + f1(Math.max(1.4, r)) + '" fill="' + (dc.t === 'acc' ? pal.accent : pal.paper) + '"' + st(dc.t === 'acc' ? pal.accentShade[0] : pal.mid, dw * 0.9).replace(' fill="none"', '') + '/>'; }
      } else if (dc.d === 'rings') { // concentric rings on a round top
        for (const rr of dc.r) { const pts = circle(x0, y0, rt * rr, 40).map(q => iso([q[0]!, q[1]!, zt], P, C)); s += '<path d="' + path(pts, true) + '"' + st(colr(dc.t || 'faint'), dw) + '/>'; }
      } else if (dc.d === 'disc') { // a filled disc on a round top (a lens, a lamp, an LED, a dial face)
        const pts = circle(x0 + (dc.u || 0) * rt, y0 + (dc.v || 0) * rt, rt * dc.r, 30).map(q => iso([q[0]!, q[1]!, zt], P, C));
        s += '<path d="' + path(pts, true) + '" fill="' + (dc.fill === 'acc' ? pal.accent : dc.fill === 'dark' ? pal.dark : dc.fill === 'paper' ? pal.paper : pal.soft) + '"' + st(pal.hi, dw).replace(' fill="none"', '') + '/>';
      } else if (dc.d === 'spokes') {
        let dd = ''; for (let i = 0; i < dc.n; i++) { const a = (i / dc.n * 360 + (dc.a || 0) + rot) * RAD; dd += path([[x0 + Math.cos(a) * rt * dc.r0, y0 + Math.sin(a) * rt * dc.r0, zt], [x0 + Math.cos(a + (dc.sweep || 0) * RAD) * rt * dc.r1, y0 + Math.sin(a + (dc.sweep || 0) * RAD) * rt * dc.r1, zt]].map(q => iso(q, P, C))); }
        s += '<path d="' + dd + '"' + st(colr(dc.t || 'mid'), dc.w || dw) + '/>';
      } else if (dc.d === 'seams' || dc.d === 'knurl') { // front-half rings round a cylinder / vertical knurl lines
        let dd = '';
        if (dc.d === 'seams') for (const zf of dc.z) { const pts: number[][] = []; for (let i = 0; i <= 24; i++) { const a = (P.az - 90 + i * 7.5) * RAD; pts.push(iso([x0 + Math.cos(a) * rAt(zf), y0 + Math.sin(a) * rAt(zf), z0 + zf * pr.h], P, C)); } dd += path(pts); }
        else for (let i = 1; i < dc.n; i++) { const a = (P.az - 90 + 180 * i / dc.n) * RAD, za = dc.z0 || 0.12, zb = dc.z1 || 0.88; dd += path([[x0 + Math.cos(a) * rAt(za), y0 + Math.sin(a) * rAt(za), z0 + pr.h * za], [x0 + Math.cos(a) * rAt(zb), y0 + Math.sin(a) * rAt(zb), z0 + pr.h * zb]].map(q => iso(q, P, C))); }
        s += '<path d="' + dd + '"' + st(colr(dc.t || 'faint'), dw) + '/>';
      } else if (dc.d === 'text') { // engraved text in the plane of the top face
        const o0 = iso([x0 + dc.u * pr.w, y0 + dc.v * pr.d, zt], P, C), ex = iso([x0 + dc.u * pr.w + 1, y0 + dc.v * pr.d, zt], P, C), ey = iso([x0 + dc.u * pr.w, y0 + dc.v * pr.d + 1, zt], P, C);
        s += '<text transform="matrix(' + [ex[0]! - o0[0]!, ex[1]! - o0[1]!, ey[0]! - o0[0]!, ey[1]! - o0[1]!, o0[0]!, o0[1]!].map(n => n.toFixed(3)).join(' ') + ')" font-family="' + T.TYPE.mono + '" font-weight="600" font-size="' + dc.s + '" letter-spacing="' + (dc.s * 0.12).toFixed(1) + '" fill="' + colr(dc.t || 'hi') + '">' + String(dc.text).replace(/[<&>]/g, '') + '</text>';
      }
    }
    s += '<path d="' + S.outline + '"' + st(ink, sw) + '/>';
    return s;
  }

  /** a primitive's 3D corners (for screen bounds) */
  function primPts(pr: any, o: number[]) {
    const x = o[0]! + pr.x, y = o[1]! + pr.y, z = o[2]! + pr.z;
    if (pr.k === 'ball') return corners([x - pr.r, y - pr.r, z - pr.r, x + pr.r, y + pr.r, z + pr.r]);
    if (pr.k === 'prism') { let m = 0; for (const q of pr.poly) m = Math.max(m, Math.hypot(q[0], q[1])); const L = pr.len / 2; return pr.ax === 'x' ? corners([x - L, y - m, z - m, x + L, y + m, z + m]) : corners([x - m, y - L, z - m, x + m, y + L, z + m]); }
    if (pr.k === 'box') return corners([x, y, z, x + pr.w, y + pr.d, z + pr.h]);
    return corners([x - pr.r, y - pr.r, z, x + pr.r, y + pr.r, z + pr.h]);
  }

  /* ── motion ── */
  function spring(tau: number, T: any) {
    if (tau <= 0) return 0; const z = T.MOTION.spring.zeta, w = T.MOTION.spring.omega, wd = w * Math.sqrt(1 - z * z);
    return 1 - Math.exp(-z * w * tau) * (Math.cos(wd * tau) + z * w / wd * Math.sin(wd * tau));
  }
  /** explode amount of one layer of an assembly at t (0 assembled → 1 apart), staggered out in order, back reversed */
  function apart(a: any, layer: number, t: number, T: any) {
    let e = 0; const M = T.MOTION.explode;
    for (const w of a.ex || []) {
      const o = spring(t - w[0] - layer * M.stagger, T), c = t > w[1] ? spring(t - w[1] - (3 - layer) * M.stagger, T) : 0;
      e = Math.max(e, cl(o) * (1 - cl(c)));
    }
    return e;
  }
  /** where a keyed thing is at t: [x, y, z] glides key to key (ease in-out over MOVE) */
  function posOf(a: any, t: number) {
    const K = a.keys; if (!K || !K.length) return [a.x, a.y, a.z || 0];
    let p = [K[0][1], K[0][2], K[0][3]];
    for (let i = 1; i < K.length; i++) { if (t < K[i][0]) break; const u = ease((t - K[i][0]) / (K[i][4] || MOVE)); p = [K[i - 1][1] + (K[i][1] - K[i - 1][1]) * u, K[i - 1][2] + (K[i][2] - K[i - 1][2]) * u, K[i - 1][3] + (K[i][3] - K[i - 1][3]) * u]; }
    return p;
  }

  /** world bbox of an assembly where it stands at t (+ headroom for its explode) */
  function boxOf(a: any, t?: number) { const p = posOf(a, t == null ? 1e9 : t), fp = a.fp; return [p[0]! - fp.w / 2, p[1]! - fp.d / 2, p[2]!, p[0]! + fp.w / 2, p[1]! + fp.d / 2, p[2]! + fp.h + (a.ex && a.ex.length ? a.layers * 64 * 0.8 : 0)]; }
  function corners(b: number[]) { const o: number[][] = []; for (const x of [b[0]!, b[3]!]) for (const y of [b[1]!, b[4]!]) for (const z of [b[2]!, b[5]!]) o.push([x, y, z]); return o; }
  function bboxScreen(pts: number[][], P: any) { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; const C = cam(P); for (const p of pts) { const q = iso(p, P, C); x0 = Math.min(x0, q[0]!); y0 = Math.min(y0, q[1]!); x1 = Math.max(x1, q[0]!); y1 = Math.max(y1, q[1]!); } return [x0, y0, x1, y1]; }

  function secAt(F: any, t: number) { let i = 0; for (let j = 0; j < F.secs.length; j++) if (F.secs[j].t0 <= t + 1e-6) i = j; return i; }

  /**
   * The camera at t inside one section: the overview fit of the figure, or a push-in on one assembly, eased between keys,
   * on a slowly orbiting azimuth (a turntable figure sweeps further). A push-in never lets its subject (with the room
   * its explode needs) leave the scene band: its zoom is capped by the band, not only by the token's maximum.
   */
  function camera(F: any, S: any, t: number) {
    const T = F.tokens, K = T.CAMERA, V = S.view, B = T.SAFE.scene;
    const keys = S.cams; let i = 0; for (let j = 0; j < keys.length; j++) if (keys[j].t <= t) i = j;
    const focusOf = (c: any) => (c && c.focus >= 0 ? 1 : 0);
    const prev = keys[Math.max(0, i - 1)], cur = keys[i], u = i === 0 ? 1 : ease((t - cur.t) / K.move);
    const fb = focusOf(prev) + (focusOf(cur) - focusOf(prev)) * u;
    const sweepU = cl((t - S.t0) / Math.max(0.1, S.t1 - S.t0));
    const az = V.az + V.orbit * Math.sin(2 * Math.PI * t / (F.duration * K.orbitPeriod)) + (V.sweep || 0) * (ease(sweepU) - 0.5) + K.focusOrbit * fb, el = V.el;
    const unit = { az, el, s: 1, ox: 0, oy: 0 };
    const ob = bboxScreen(S.ext, unit), fw = (V.w || K.overview.w), fh = (V.h || K.overview.h);
    const s0 = Math.min(fw / (ob[2]! - ob[0]!), fh / (ob[3]! - ob[1]!)) * (V.fit || 1);
    const sh = V.shift || [0, 0];
    const state = (c: any) => {
      if (!c || c.focus < 0) return { s: s0, fx: (ob[0]! + ob[2]!) / 2, fy: (ob[1]! + ob[3]!) / 2, sx: K.overview.cx + sh[0], sy: K.overview.cy + sh[1] };
      const b = bboxScreen(corners(boxOf(S.asms[c.focus], c.t + 0.5)), unit), bw = b[2]! - b[0]!, bh = b[3]! - b[1]!;
      let z = cl(Math.min(K.focus.maxH / bh, K.focus.maxW / bw) / s0, K.focus.minZoom, Math.min(K.focus.maxZoom, V.zcap || 9));
      z = Math.min(z, (B.y1 - B.y0 - 90) / (bh * s0 * (1 + K.dolly)), (B.x1 - B.x0 - 90) / (bw * s0 * (1 + K.dolly))); // the subject stays inside the band
      return { s: s0 * Math.max(1, z), fx: (b[0]! + b[2]!) / 2, fy: (b[1]! + b[3]!) / 2, sx: K.overview.cx, sy: K.focus.cy };
    };
    const A = state(prev), Bk = state(cur);
    const dolly = 1 + K.dolly * ease(cl((t - cur.t) / K.dollySeconds));
    const s = Math.exp(Math.log(A.s) + (Math.log(Bk.s) - Math.log(A.s)) * u) * dolly, fx = A.fx + (Bk.fx - A.fx) * u, fy = A.fy + (Bk.fy - A.fy) * u, sx = A.sx + (Bk.sx - A.sx) * u, sy = A.sy + (Bk.sy - A.sy) * u;
    return { P: { az, el, s, ox: sx - fx * s, oy: sy - fy * s }, zoom: s / s0, s0, focus: u > 0.5 ? cur.focus : prev.focus };
  }

  function routeLen(r: number[][]) { let L = 0; for (let i = 1; i < r.length; i++) L += Math.hypot(r[i]![0]! - r[i - 1]![0]!, r[i]![1]! - r[i - 1]![1]!, (r[i]![2] || 0) - (r[i - 1]![2] || 0)); return L; }
  function along(r: number[][], s: number) { for (let i = 1; i < r.length; i++) { const a = r[i - 1]!, b = r[i]!, L = Math.hypot(b[0]! - a[0]!, b[1]! - a[1]!, (b[2] || 0) - (a[2] || 0)); if (s <= L || i === r.length - 1) { const u = L ? cl(s / L) : 0; return [a[0]! + (b[0]! - a[0]!) * u, a[1]! + (b[1]! - a[1]!) * u, (a[2] || 0) + ((b[2] || 0) - (a[2] || 0)) * u]; } s -= L; } return [r[0]![0]!, r[0]![1]!, r[0]![2] || 0]; }
  function cut(r: number[][], s: number) { const out = [r[0]!]; let acc = 0; for (let i = 1; i < r.length; i++) { const a = r[i - 1]!, b = r[i]!, L = Math.hypot(b[0]! - a[0]!, b[1]! - a[1]!, (b[2] || 0) - (a[2] || 0)); if (acc + L >= s) { out.push(along([a, b], s - acc)); return out; } out.push(b); acc += L; } return out; }

  /** how far the section's figure has lifted away (0 → 1 over the last EXIT seconds before the next figure) */
  function exitOf(F: any, si: number, t: number) { const S = F.secs[si]; return si < F.secs.length - 1 ? ease(cl((t - (S.t1 - EXIT)) / EXIT)) : 0; }

  /**
   * The frame model at t: the section on screen, its camera, every object (assemblies and props) with its solids,
   * offsets and opacity in draw order, the links and their particles, annotations, tags, the detail circle, callouts
   * (in the side columns, spaced, clamped to the safe area) and the caption beat.
   */
  function frame(F: any, t: number) {
    const T = F.tokens, M = T.MOTION, si = secAt(F, t), S = F.secs[si], cm = camera(F, S, t), P = cm.P, C = cam(P);
    const xk = exitOf(F, si, t), lvl = (z: number) => Math.floor((z + 4) / 50);
    const objs: any[] = [];
    S.asms.forEach((a: any, ai: number) => {
      const items: any[] = [], pos = posOf(a, t), en = a.enter || [0, 0, M.enter.drop];
      const out = a.tOut != null ? ease(cl((t - a.tOut) / EXIT)) : 0, xa = Math.max(xk, out);
      const xl = xa * (260 + ai * 30), xo = 1 - xa, gh = a.ghost || 1;
      a.prims.forEach((pr: any, pi: number) => {
        const t0 = a.tIn + pi * M.enter.stagger, tau = t - t0; if (tau < 0) return;
        const k = Math.max(-0.015, 1 - spring(tau, T)), lift = (pr.ex || 0) * M.explode.gap * apart(a, pr.ex || 0, t, T);
        items.push({ pr, o: [pos[0]! + en[0]! * k, pos[1]! + en[1]! * k, pos[2]! + en[2]! * k + lift + xl], op: cl(tau / M.enter.fade) * xo * gh, settled: tau > 0.7 && xa === 0 });
      });
      objs.push({ kind: 'asm', i: ai, a, items, lv: lvl(pos[2]!), ord: 1, key: depth([pos[0]!, pos[1]!, pos[2]!], P, C), look: a.look || '' });
    });
    S.props.forEach((p: any, pi: number) => {
      const tau = t - p.tIn; if (tau < 0) return;
      let pr = p.p; const pos = p.keys ? posOf(p, t) : [0, 0, 0];
      if (p.grow) { const f0 = p.grow[2] || 0.02, g = f0 + (1 - f0) * ease(cl((t - p.grow[0]) / p.grow[1])); pr = Object.assign({}, pr, { h: pr.h * g }); }
      if (p.needle) { const a = p.needle[1] + (p.needle[2] - p.needle[1]) * cl(spring(t - p.needle[0], T)); pr = Object.assign({}, pr, { deco: (pr.deco || []).map((d: any) => (d.needle ? Object.assign({}, d, { a }) : d)) }); }
      const k = Math.max(-0.015, 1 - spring(tau, T)), xl = xk * 260;
      const it = { pr, o: [pos[0]!, pos[1]!, pos[2]! + (p.drop == null ? 60 : p.drop) * k + xl], op: cl(tau / 0.3) * (1 - xk), settled: tau > 0.7 && xk === 0 };
      objs.push({ kind: 'prop', i: pi, items: [it], lv: p.layer === 'under' ? -9 : lvl(pr.z + (pr.k === 'box' && p.base ? pr.h : 0) + pos[2]!), ord: p.base ? 0 : 1, key: depth([pr.x + (pr.w || 0) / 2 + pos[0]!, pr.y + (pr.d || 0) / 2 + pos[1]!, pr.z + pos[2]!], P, C), look: '' });
    });
    objs.sort((p, q) => p.lv - q.lv || p.ord - q.ord || p.key - q.key);
    const links = S.links.map((l: any) => { const L = routeLen(l.route), drawn = L * cl((t - l.tIn) / M.pipe.draw); return { l, L, drawn, flow: t >= l.tFlow ? t - l.tFlow : -1, xl: xk * 260, op: 1 - xk }; });
    // callouts
    const SA = T.SAFE, LB = T.TYPE.label, labels: any[] = [];
    for (const lb of S.labels) {
      if (t < lb.t0 || t > lb.t1 + 0.35) continue;
      let p: number[];
      if (lb.asm >= 0) {
        const a = S.asms[lb.asm], hero = a.prims[a.hero] || a.prims[0], lift = (hero.ex || 0) * M.explode.gap * apart(a, hero.ex || 0, t, T), pos = posOf(a, t);
        const an = lb.at || a.anchor; p = iso([pos[0]! + an[0], pos[1]! + an[1], pos[2]! + an[2] + lift + xk * 260], P, C);
      } else p = iso([lb.at[0], lb.at[1], lb.at[2] + xk * 260], P, C);
      const w = Math.max(lb.text.length * LB.size * (0.6 + LB.track), (lb.sub || '').length * LB.sub * 0.6) + LB.pad * 2;
      let side = lb.side || (p[0]! < 540 ? 'L' : 'R');
      if (!lb.side) { if (side === 'L' && p[0]! < LB.colL + w + 40) side = 'R'; else if (side === 'R' && p[0]! > LB.colR - w - 40) side = 'L'; }
      labels.push({ lb, ax: p[0], ay: p[1], w, h: lb.sub ? 78 : 46, side, y: p[1]! - 120, op: cl((t - lb.t0) / 0.2) * (t > lb.t1 ? 1 - cl((t - lb.t1) / 0.35) : 1) * (1 - xk), draw: cl((t - lb.t0) / M.leader.draw), txt: cl((t - lb.t0 - M.leader.draw * 0.6) / M.leader.text) });
    }
    for (const side of ['L', 'R']) {
      const col = labels.filter(l => l.side === side).sort((p, q) => p.y - q.y);
      let y = SA.scene.y0 + 10; for (const l of col) { l.y = Math.max(l.y, y); y = l.y + Math.max(LB.gap, l.h + 18); }
      const over = (col.length ? col[col.length - 1].y + col[col.length - 1].h : 0) - (SA.scene.y1 - 20); if (over > 0) for (const l of col) l.y -= over;
      for (const l of col) l.x = side === 'L' ? LB.colL : LB.colR - l.w;
    }
    let beat = -1; for (let i = 0; i < F.beats.length; i++) if (F.beats[i].t0 <= t) beat = i;
    return { t, si, S, P, zoom: cm.zoom, s0: cm.s0, focus: cm.focus, objs, links, labels, beat, xk, enter: ease(cl((t - S.t0) / 0.45)) };
  }

  /** The plate a figure stands on: halo, feet, bevelled slab, grid, ruler, screws, label plate, slot plan lines. */
  function plate(F: any, fr: any, cx: number, cy: number, W: number, D: number, label: string, zl: number, op: number) {
    const P = fr.P, T = F.tokens, pal = F.pal, C = cam(P), H = T.LAYOUT.plateH, x0 = cx - W / 2, y0 = cy - D / 2;
    let s = '<g opacity="' + f1(op) + '"><path d="' + path(rounded(x0 - 10, y0 - 10, W + 20, D + 20, 30).map(p => iso([p[0]!, p[1]!, -H - 10 + zl], P, C)), true) + '" fill="' + pal.halo + '" opacity="' + pal.haloOpacity + '" filter="url(#halo)"/>';
    const F2 = { pal, tokens: T, zoom: fr.zoom };
    for (const [u, v] of [[0.06, 0.08], [0.94, 0.08], [0.94, 0.92], [0.06, 0.92]]) s += prim({ k: 'cyl', x: x0 + u! * W, y: y0 + v! * D, z: -H - 10, r: 16, h: 10, t: 'lo', n: 18 }, [0, 0, zl], P, F2, '');
    const deco: any[] = [];
    const g: number[][][] = []; const step = 50;
    for (let x = step; x < W - 30; x += step) for (let y = step; y < D - 30; y += step) g.push([[x / W, y / D], [x / W + 0.0001, y / D]]);
    deco.push({ d: 'top', l: g, t: 'faint', w: 3.2 });
    deco.push({ d: 'top', l: [rounded(0.025, 0.035, 0.95, 0.93, 0).concat([[0.975, 0.035]])], t: 'faint' });
    const tk: number[][][] = []; for (let x = 40, i = 0; x < W - 40; x += 10, i++) tk.push([[x / W, 1 - 8 / D], [x / W, 1 - (i % 5 === 0 ? 26 : 16) / D]]);
    deco.push({ d: 'top', l: tk, t: 'lo' });
    deco.push({ d: 'top', l: [[[40 / W, 1 - 8 / D], [(W - 40) / W, 1 - 8 / D]]], t: 'lo' });
    deco.push({ d: 'dots', p: [[14 / W, 14 / D], [1 - 14 / W, 14 / D], [1 - 14 / W, 1 - 14 / D], [14 / W, 1 - 14 / D]], r: 3.2 });
    s += prim({ k: 'box', x: x0, y: y0, z: -H, w: W, d: D, h: H, r: 22, t: 'lo', deco }, [0, 0, zl], P, F2, '');
    if (label) {
      const lpW = Math.min(300, W * 0.4), lp = { k: 'box', x: x0 + W - lpW - 34, y: y0 + 26, z: 0, w: lpW, d: 70, h: 3, r: 6, t: 'mid', deco: [
        { d: 'text', u: 0.07, v: 0.42, s: 22, text: label.toUpperCase().slice(0, 18), t: 'hi' },
        { d: 'top', l: [[[0.07, 0.62], [0.62, 0.62]], [[0.07, 0.76], [0.45, 0.76]], [[0.07, 0.88], [0.54, 0.88]]], t: 'lo' },
        { d: 'dots', p: [[0.94, 0.25], [0.94, 0.75]], r: 2.2 }] };
      s += prim(lp, [0, 0, zl], P, F2, '');
    }
    return s + '</g>';
  }

  /** The figure's ground: a bench plate, twin plates, a turntable, grid paper, or nothing. Rises in, sinks away. */
  function ground(F: any, fr: any) {
    const S = fr.S, G = S.ground, P = fr.P, pal = F.pal, C = cam(P), op = fr.enter * (1 - fr.xk), zl = -40 * (1 - fr.enter) - 40 * fr.xk;
    let s = '';
    if (G.k === 'plate') s += plate(F, fr, G.cx || 0, G.cy || 0, G.w, G.d, G.label == null ? F.brand : G.label, zl, op);
    else if (G.k === 'twin') for (const g of G.at) s += plate(F, fr, g[0], g[1], G.w, G.d, '', zl, op);
    else if (G.k === 'round') {
      const F2 = { pal, tokens: F.tokens, zoom: fr.zoom, t: fr.t };
      s += '<g opacity="' + f1(op) + '"><path d="' + path(circle(0, 0, G.r + 12, 60).map(p => iso([p[0]!, p[1]!, -34 + zl], P, C)), true) + '" fill="' + pal.halo + '" opacity="' + pal.haloOpacity + '" filter="url(#halo)"/>';
      s += prim({ k: 'cyl', x: 0, y: 0, z: -30, r: G.r * 0.82, h: 8, t: 'lo', n: 60 }, [0, 0, zl], P, F2, '');
      s += prim({ k: 'cyl', x: 0, y: 0, z: -22, r: G.r, h: 22, t: 'lo', n: 72, spin: G.spin || 0, deco: [{ d: 'spokes', n: 72, r0: 0.93, r1: 0.985, t: 'lo' }, { d: 'spokes', n: 12, r0: 0.88, r1: 0.985, t: 'mid' }, { d: 'rings', r: [0.86, 0.5], t: 'faint' }, { d: 'spokes', n: 1, r0: 0.86, r1: 0.985, t: 'acc', w: 4 }] }, [0, 0, zl], P, F2, '') + '</g>';
    } else if (G.k === 'sheet') {
      const W = G.w, D = G.d, x0 = -W / 2, y0 = -D / 2; let fine = '', bold = '';
      for (let x = 0; x <= W + 0.1; x += 40) (Math.round(x) % 200 === 0 ? (bold += path([iso([x0 + x, y0, zl], P, C), iso([x0 + x, y0 + D, zl], P, C)])) : (fine += path([iso([x0 + x, y0, zl], P, C), iso([x0 + x, y0 + D, zl], P, C)])));
      for (let y = 0; y <= D + 0.1; y += 40) (Math.round(y) % 200 === 0 ? (bold += path([iso([x0, y0 + y, zl], P, C), iso([x0 + W, y0 + y, zl], P, C)])) : (fine += path([iso([x0, y0 + y, zl], P, C), iso([x0 + W, y0 + y, zl], P, C)])));
      s += '<g opacity="' + f1(op) + '"><path d="' + path([[x0, y0], [x0 + W, y0], [x0 + W, y0 + D], [x0, y0 + D]].map(p => iso([p[0]!, p[1]!, zl], P, C)), true) + '" fill="' + pal.paper + '" stroke="' + pal.lo + '" stroke-width="1.6"/>';
      s += '<path d="' + fine + '" stroke="' + pal.faint + '" stroke-width="1" fill="none"/><path d="' + bold + '" stroke="' + pal.faint + '" stroke-width="2" fill="none"/>';
      for (const [u, v] of [[0, 0], [1, 0], [1, 1], [0, 1]]) { const c = iso([x0 + u! * W, y0 + v! * D, zl], P, C); s += '<path d="M' + f1(c[0]! - 12) + ' ' + f1(c[1]!) + 'h24M' + f1(c[0]!) + ' ' + f1(c[1]! - 12) + 'v24" stroke="' + pal.mid + '" stroke-width="1.6"/>'; }
      s += '</g>';
    }
    // the slots: each part's plan drawn as a dashed blueprint line before it lands (the ground is never bare)
    for (const a of S.asms) if (!a.enter && !a.keys && (a.z || 0) === 0 && fr.t < a.tIn + 0.5) {
      const op2 = (fr.t < a.tIn ? 1 : 1 - cl((fr.t - a.tIn) / 0.5)) * op;
      s += '<path d="' + path(rounded(a.x - a.fp.w / 2, a.y - a.fp.d / 2, a.fp.w, a.fp.d, 10).map(p => iso([p[0]!, p[1]!, 0.5 + zl], P, C)), true) + '" fill="none" stroke="' + pal.mid + '" stroke-width="1.6" stroke-dasharray="7 7" opacity="' + f1(op2 * 0.9) + '"/>';
      const c = iso([a.x, a.y, 0.5 + zl], P, C); s += '<path d="M' + f1(c[0]! - 8) + ' ' + f1(c[1]!) + 'h16M' + f1(c[0]!) + ' ' + f1(c[1]! - 5) + 'v10" stroke="' + pal.mid + '" stroke-width="1.6" opacity="' + f1(op2 * 0.9) + '"/>';
    }
    return s;
  }

  /** Links: low pipes (axis-aligned legs + collars), wires (a projected tube), tracks (a closed ring); particles on the word. */
  function links(F: any, fr: any) {
    const P = fr.P, T = F.tokens, pal = F.pal, C = cam(P), M = T.MOTION, F2 = { pal, tokens: T, zoom: fr.zoom }; let s = '', parts = '';
    const zf = 0.75 + 0.25 * Math.min(2, fr.zoom);
    for (const L of fr.links) {
      if (L.drawn <= 0) continue;
      const r = cut(L.l.route, L.drawn), z0 = L.xl, kind = L.l.kind || 'pipe';
      s += '<g opacity="' + f1(L.op) + '">';
      if (kind === 'pipe') {
        const wdt = 18, segs: any[] = [];
        for (let i = 1; i < r.length; i++) { const a = r[i - 1]!, b = r[i]!, x = Math.min(a[0]!, b[0]!) - wdt / 2, y = Math.min(a[1]!, b[1]!) - wdt / 2; segs.push({ k: 'box', x, y, z: (a[2] || 0), w: Math.abs(b[0]! - a[0]!) + wdt, d: Math.abs(b[1]! - a[1]!) + wdt, h: 14, r: 8, t: 'mid', deco: [{ d: 'top', l: [Math.abs(b[0]! - a[0]!) > Math.abs(b[1]! - a[1]!) ? [[0, 0.5], [1, 0.5]] : [[0.5, 0], [0.5, 1]]], t: 'faint' }] }); }
        segs.sort((p, q) => depth([p.x + p.w / 2, p.y + p.d / 2, 0], P, C) - depth([q.x + q.w / 2, q.y + q.d / 2, 0], P, C));
        for (const g of segs) s += prim(g, [0, 0, z0], P, F2, '');
        const c0 = r[0]!; s += prim({ k: 'cyl', x: c0[0], y: c0[1], z: c0[2] || 0, r: 17, h: 20, t: 'mid', n: 20, deco: [{ d: 'rings', r: [0.55], t: 'lo' }] }, [0, 0, z0], P, F2, '');
        if (L.drawn >= L.L - 1) { const c1 = r[r.length - 1]!; s += prim({ k: 'cyl', x: c1[0], y: c1[1], z: c1[2] || 0, r: 17, h: 20, t: 'mid', n: 20, deco: [{ d: 'rings', r: [0.55], t: 'lo' }] }, [0, 0, z0], P, F2, ''); }
      } else {
        const pts = r.map(q => iso([q[0]!, q[1]!, (q[2] || 0) + z0], P, C)), d = path(pts, kind === 'track' && L.drawn >= L.L - 1);
        if (kind === 'track') s += '<path d="' + d + '" fill="none" stroke="' + pal.lo + '" stroke-width="' + f1(26 * fr.P.s) + '" stroke-linejoin="round" stroke-linecap="round"/><path d="' + d + '" fill="none" stroke="' + pal.card + '" stroke-width="' + f1(18 * fr.P.s) + '" stroke-linejoin="round"/><path d="' + d + '" fill="none" stroke="' + pal.faint + '" stroke-width="1.4" stroke-dasharray="6 10"/>';
        else s += '<path d="' + d + '" fill="none" stroke="' + pal.mid + '" stroke-width="' + f1(7.5 * zf) + '" stroke-linejoin="round" stroke-linecap="round"/><path d="' + d + '" fill="none" stroke="' + pal.card + '" stroke-width="' + f1(3.2 * zf) + '" stroke-linejoin="round" stroke-linecap="round"/>';
        if (kind === 'wire') for (const q of [r[0]!].concat(L.drawn >= L.L - 1 ? [r[r.length - 1]!] : [])) { const c = iso([q[0]!, q[1]!, (q[2] || 0) + z0], P, C); s += '<circle cx="' + f1(c[0]!) + '" cy="' + f1(c[1]!) + '" r="' + f1(6 * zf) + '" fill="' + pal.card + '" stroke="' + pal.mid + '" stroke-width="2.2"/>'; }
      }
      s += '</g>';
      if (L.flow >= 0) { // particles: a steady stream in the brand's ink, fading where they enter and leave the machine
        const sp = L.l.spacing || M.flow.spacing, n = Math.floor(L.L / sp) + 1, rr = M.flow.size * (0.7 + 0.3 * fr.zoom), loop = kind === 'track' || L.l.loop;
        for (let j = 0; j < n; j++) {
          const sj = L.flow * M.flow.speed - j * sp; if (sj < 0) continue;
          let u = sj % L.L; if (L.l.dir === -1) u = L.L - u;
          const op = (loop ? 1 : cl(u / 40) * cl((L.L - u) / 40)) * L.op, q = along(L.l.route, u), c = iso([q[0]!, q[1]!, (q[2] || 0) + (kind === 'pipe' ? 16 : 4) + z0], P, C);
          parts += '<circle cx="' + f1(c[0]!) + '" cy="' + f1(c[1]!) + '" r="' + f1(rr * 2.4) + '" fill="' + pal.accent + '" opacity="' + f1(op * 0.18) + '"/><circle cx="' + f1(c[0]!) + '" cy="' + f1(c[1]!) + '" r="' + f1(rr) + '" fill="' + pal.accent + '" opacity="' + f1(op) + '"/>';
        }
      }
    }
    return s + parts;
  }

  function arrowHead(a: number[], b: number[], sz: number) { const dx = b[0]! - a[0]!, dy = b[1]! - a[1]!, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L; return 'M' + f1(b[0]! - ux * sz - uy * sz * 0.5) + ' ' + f1(b[1]! - uy * sz + ux * sz * 0.5) + 'L' + f1(b[0]!) + ' ' + f1(b[1]!) + 'L' + f1(b[0]! - ux * sz + uy * sz * 0.5) + ' ' + f1(b[1]! - uy * sz - ux * sz * 0.5); }

  /** Annotations in the drawing's own hand: dimension lines, motion trails, guides, ghost housings, hatched cuts, tags. */
  function notes(F: any, fr: any) {
    const S = fr.S, P = fr.P, pal = F.pal, T = F.tokens, C = cam(P), xl = fr.xk * 260, xo = 1 - fr.xk; let s = '';
    const pj = (q: number[]) => iso([q[0]!, q[1]!, (q[2] || 0) + xl], P, C);
    for (const L of S.lines) {
      if (fr.t < L.t0) continue;
      const u = cl((fr.t - L.t0) / 0.5), op = (L.t1 != null && fr.t > L.t1 ? 1 - cl((fr.t - L.t1) / 0.4) : 1) * xo * cl((fr.t - L.t0) / 0.25);
      if (op <= 0) continue;
      s += '<g opacity="' + f1(op) + '">';
      if (L.k === 'dim') {
        const o = L.off || [0, 0, 0], a = L.pts[0], b = L.pts[1], A = [a[0] + o[0], a[1] + o[1], (a[2] || 0) + o[2]], B = [b[0] + o[0], b[1] + o[1], (b[2] || 0) + o[2]];
        const m = [(A[0]! + B[0]!) / 2, (A[1]! + B[1]!) / 2, (A[2]! + B[2]!) / 2], e = ease(u), A2 = [m[0]! + (A[0]! - m[0]!) * e, m[1]! + (A[1]! - m[1]!) * e, m[2]! + (A[2]! - m[2]!) * e], B2 = [m[0]! + (B[0]! - m[0]!) * e, m[1]! + (B[1]! - m[1]!) * e, m[2]! + (B[2]! - m[2]!) * e];
        const ext = (p: number[]) => [p[0]! + o[0] * 1.18, p[1]! + o[1] * 1.18, (p[2] || 0) + o[2] * 1.18];
        s += '<path d="' + path([pj(a), pj(ext(a))]) + path([pj(b), pj(ext(b))]) + '" stroke="' + pal.mid + '" stroke-width="1.2" fill="none" stroke-dasharray="3 4"/>';
        const pa = pj(A2), pb = pj(B2);
        s += '<path d="' + path([pa, pb]) + (e > 0.95 ? arrowHead(pb, pa, 13) + arrowHead(pa, pb, 13) : '') + '" stroke="' + pal.hi + '" stroke-width="1.8" fill="none" stroke-linejoin="round"/>';
        if (L.text && e > 0.9) { const c = pj(m), w = String(L.text).length * 15 + 22; s += '<rect x="' + f1(c[0]! - w / 2) + '" y="' + f1(c[1]! - 18) + '" width="' + f1(w) + '" height="34" rx="5" fill="' + pal.card + '" stroke="' + pal.faint + '" stroke-width="1.2"/><text x="' + f1(c[0]!) + '" y="' + f1(c[1]! + 8) + '" text-anchor="middle" font-family="' + T.TYPE.mono + '" font-weight="700" font-size="22" letter-spacing="1.6" fill="' + pal.hi + '">' + esc(String(L.text).toUpperCase()) + '</text>'; }
      } else if (L.k === 'trail' || L.k === 'guide') {
        const r = L.k === 'trail' ? cut(L.pts, routeLen(L.pts) * ease(u)) : L.pts, pts = r.map(pj);
        s += '<path d="' + path(pts) + '" fill="none" stroke="' + (L.k === 'trail' ? pal.accent : pal.mid) + '" stroke-width="' + (L.k === 'trail' ? 2.6 : 1.5) + '" stroke-dasharray="' + (L.k === 'trail' ? '10 8' : '5 7') + '" stroke-linecap="round"/>';
        if (L.k === 'trail' && pts.length > 1 && u > 0.2) s += '<path d="' + arrowHead(pts[pts.length - 2]!, pts[pts.length - 1]!, 16) + '" fill="none" stroke="' + pal.accent + '" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/>';
      } else if (L.k === 'ghost') {
        const b = [L.pts[0][0], L.pts[0][1], L.pts[0][2], L.pts[1][0], L.pts[1][1], L.pts[1][2]], cs = corners(b), e = ease(u);
        const far = cs.reduce((m: any, p: number[]) => (depth(p, P, C) < depth(m, P, C) ? p : m), cs[0]);
        let vis = '', hid = '';
        for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) {
          const p = cs[i]!, q = cs[j]!, diff = (p[0] !== q[0] ? 1 : 0) + (p[1] !== q[1] ? 1 : 0) + (p[2] !== q[2] ? 1 : 0); if (diff !== 1) continue;
          const zz = (pt: number[]) => [pt[0]!, pt[1]!, b[2]! + (pt[2]! - b[2]!) * e];
          const seg = path([pj(zz(p)), pj(zz(q))]); if (p === far || q === far) hid += seg; else vis += seg;
        }
        s += '<path d="' + hid + '" stroke="' + pal.lo + '" stroke-width="1.2" fill="none" stroke-dasharray="2 6"/><path d="' + vis + '" stroke="' + pal.hi + '" stroke-width="1.8" fill="none" stroke-dasharray="9 6"/>';
      } else if (L.k === 'hatch') {
        s += '<path d="' + path(L.pts.map(pj), true) + '" fill="url(#hatch)" stroke="' + pal.hi + '" stroke-width="1.6"/>';
      }
      s += '</g>';
    }
    for (const g of S.tags) {
      if (fr.t < g.t0) continue;
      const op = cl((fr.t - g.t0) / 0.25) * (g.t1 != null && fr.t > g.t1 ? 1 - cl((fr.t - g.t1) / 0.35) : 1) * xo; if (op <= 0) continue;
      const c = pj(g.at), sz = g.size || 24, col = g.tone === 'acc' ? pal.accent : g.tone === 'muted' ? pal.muted : pal.hi, dy = (1 - cl((fr.t - g.t0) / 0.3)) * 10;
      s += '<text x="' + f1(c[0]!) + '" y="' + f1(c[1]! + dy) + '" text-anchor="middle" font-family="' + T.TYPE.mono + '" font-weight="700" font-size="' + sz + '" letter-spacing="' + f1(sz * 0.14) + '" fill="' + col + '" opacity="' + f1(op) + '">' + esc(String(g.text).toUpperCase()) + '</text>';
    }
    return s;
  }

  /** The detail circle: a magnified view of one assembly, joined to it by two tangents, opening on its word. */
  function detail(F: any, fr: any, F2: any) {
    const D = fr.S.detail; if (!D) return '';
    const open = ease(cl((fr.t - D.t0) / 0.55)) * (1 - ease(cl((fr.t - D.t1) / 0.4))) * (1 - fr.xk); if (open <= 0.01) return '';
    const pal = F.pal, T = F.tokens, A = fr.S.asms[D.asm], pos = posOf(A, fr.t);
    let tp = D.pts[0][1]; for (let i = 1; i < D.pts.length; i++) { if (fr.t < D.pts[i][0]) break; const u = ease((fr.t - D.pts[i][0]) / MOVE), a = D.pts[i - 1][1], b = D.pts[i][1]; tp = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u]; }
    const w = [pos[0]! + tp[0], pos[1]! + tp[1], pos[2]! + tp[2]], p = iso(w, fr.P), R = D.r * open;
    const P2: any = { az: fr.P.az, el: fr.P.el, s: fr.P.s * D.zoom, ox: 0, oy: 0 }, q = iso(w, P2); P2.ox = D.c[0] - q[0]!; P2.oy = D.c[1] - q[1]!;
    const vx = D.c[0] - p[0]!, vy = D.c[1] - p[1]!, L = Math.hypot(vx, vy) || 1, nx = -vy / L, ny = vx / L, r0 = 34 * open;
    let s = '<path d="M' + f1(p[0]! + nx * r0) + ' ' + f1(p[1]! + ny * r0) + 'L' + f1(D.c[0] + nx * R) + ' ' + f1(D.c[1] + ny * R) + 'M' + f1(p[0]! - nx * r0) + ' ' + f1(p[1]! - ny * r0) + 'L' + f1(D.c[0] - nx * R) + ' ' + f1(D.c[1] - ny * R) + '" stroke="' + pal.mid + '" stroke-width="1.6" fill="none"/>';
    s += '<circle cx="' + f1(p[0]!) + '" cy="' + f1(p[1]!) + '" r="' + f1(r0) + '" fill="none" stroke="' + pal.hi + '" stroke-width="2.2"/>';
    s += '<clipPath id="dclip"><circle cx="' + f1(D.c[0]) + '" cy="' + f1(D.c[1]) + '" r="' + f1(Math.max(1, R - 2)) + '"/></clipPath>';
    s += '<circle cx="' + f1(D.c[0]) + '" cy="' + f1(D.c[1]) + '" r="' + f1(R) + '" fill="' + pal.card + '"/><g clip-path="url(#dclip)">';
    let gl = ''; for (let k = -6; k <= 6; k++) gl += 'M' + f1(D.c[0] - R) + ' ' + f1(D.c[1] + k * 40) + 'h' + f1(2 * R) + 'M' + f1(D.c[0] + k * 40) + ' ' + f1(D.c[1] - R) + 'v' + f1(2 * R);
    s += '<path d="' + gl + '" stroke="' + pal.faint + '" stroke-width="1"/>';
    const it = fr.objs.find((o: any) => o.kind === 'asm' && o.i === D.asm);
    const F3 = { pal, tokens: T, zoom: fr.zoom * D.zoom, t: fr.t };
    if (it) for (const x of it.items) s += prim(x.pr, x.o, P2, F3, 'lit');
    s += '</g><circle cx="' + f1(D.c[0]) + '" cy="' + f1(D.c[1]) + '" r="' + f1(R) + '" fill="none" stroke="' + pal.hi + '" stroke-width="2.8"/><circle cx="' + f1(D.c[0]) + '" cy="' + f1(D.c[1]) + '" r="' + f1(R + 10) + '" fill="none" stroke="' + pal.faint + '" stroke-width="1.4"/>';
    if (open > 0.6) s += '<text x="' + f1(D.c[0]) + '" y="' + f1(D.c[1] - R - 22) + '" text-anchor="middle" font-family="' + T.TYPE.mono + '" font-weight="700" font-size="24" letter-spacing="3.4" fill="' + pal.hi + '" opacity="' + f1((open - 0.6) / 0.4) + '">' + esc(String(D.name).toUpperCase()) + '</text>';
    void F2;
    return s;
  }

  function callouts(F: any, fr: any) {
    const T = F.tokens, pal = F.pal, LB = T.TYPE.label; let s = '';
    for (const l of fr.labels) {
      const lx = l.side === 'L' ? l.x + l.w : l.x, ly = l.y + 20, kx = l.ax + (l.side === 'L' ? -1 : 1) * Math.min(70, Math.abs(l.ax - lx) * 0.35);
      const pts = [[l.ax, l.ay], [kx, ly], [lx, ly]];
      let total = 0; for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i]![0]! - pts[i - 1]![0]!, pts[i]![1]! - pts[i - 1]![1]!);
      const pr = cut(pts, total * l.draw);
      s += '<g opacity="' + f1(l.op) + '">';
      s += '<circle cx="' + f1(l.ax) + '" cy="' + f1(l.ay) + '" r="15" fill="' + pal.accent + '" opacity=".16"/><circle cx="' + f1(l.ax) + '" cy="' + f1(l.ay) + '" r="6.5" fill="' + pal.accent + '" stroke="' + pal.card + '" stroke-width="2.4"/>';
      s += '<path d="' + path(pr) + '" fill="none" stroke="' + pal.hi + '" stroke-width="' + T.STROKE.leader + '" stroke-linecap="round" stroke-linejoin="round"/>';
      if (l.draw >= 1) s += '<path d="M' + f1(lx) + ' ' + f1(l.y + 4) + 'v' + f1(l.h - 8) + '" stroke="' + pal.accent + '" stroke-width="4" stroke-linecap="round"/>';
      if (l.txt > 0) {
        const tx = l.side === 'L' ? l.x + l.w - LB.pad : l.x + LB.pad, an = l.side === 'L' ? 'end' : 'start', dy = (1 - l.txt) * 8;
        s += '<rect x="' + f1(l.x) + '" y="' + f1(l.y - 4) + '" width="' + f1(l.w) + '" height="' + f1(l.h + 4) + '" rx="6" fill="' + pal.card + '" opacity="' + f1(0.9 * l.txt) + '"/>';
        s += '<text x="' + f1(tx) + '" y="' + f1(l.y + 30 + dy) + '" text-anchor="' + an + '" font-family="' + T.TYPE.mono + '" font-weight="700" font-size="' + LB.size + '" letter-spacing="' + (LB.size * LB.track).toFixed(1) + '" fill="' + pal.hi + '" opacity="' + f1(l.txt) + '">' + esc(l.lb.text.toUpperCase()) + '</text>';
        if (l.lb.sub) s += '<text x="' + f1(tx) + '" y="' + f1(l.y + 64 + dy) + '" text-anchor="' + an + '" font-family="' + T.TYPE.mono + '" font-weight="500" font-size="' + LB.sub + '" fill="' + pal.muted + '" opacity="' + f1(l.txt) + '">' + esc(l.lb.sub) + '</text>';
      }
      s += '</g>';
    }
    return s;
  }
  function esc(x: string) { return String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  /** The whole scene as one SVG string (1080x1920). The drawing lives in a window between the header and the caption. */
  function svg(F: any, fr: any) {
    const pal = F.pal, T = F.tokens, W0 = T.SAFE.window;
    let s = '<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920"><defs>'
      + '<filter id="halo" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="' + f1(16 * Math.sqrt(fr.zoom)) + '"/></filter>'
      + '<radialGradient id="ballG" cx=".36" cy=".3" r=".8"><stop offset="0" stop-color="' + pal.top + '"/><stop offset=".6" stop-color="' + pal.shade[3] + '"/><stop offset="1" stop-color="' + pal.shade[0] + '"/></radialGradient>'
      + '<radialGradient id="ballA" cx=".36" cy=".3" r=".8"><stop offset="0" stop-color="' + pal.accentTop + '"/><stop offset=".6" stop-color="' + pal.accentShade[1] + '"/><stop offset="1" stop-color="' + pal.accentShade[0] + '"/></radialGradient>'
      + '<radialGradient id="ballD" cx=".36" cy=".3" r=".8"><stop offset="0" stop-color="' + pal.darkTop + '"/><stop offset="1" stop-color="' + pal.darkShade[0] + '"/></radialGradient>'
      + '<pattern id="hatch" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="12" height="12" fill="' + pal.card + '"/><path d="M0 0v12" stroke="' + pal.mid + '" stroke-width="2"/></pattern>'
      + '<linearGradient id="winG" x1="0" y1="0" x2="0" y2="1920" gradientUnits="userSpaceOnUse"><stop offset="' + (W0.y0 / 1920).toFixed(4) + '" stop-color="#fff" stop-opacity="0"/><stop offset="' + ((W0.y0 + W0.fade) / 1920).toFixed(4) + '" stop-color="#fff"/><stop offset="' + ((W0.y1 - W0.fade) / 1920).toFixed(4) + '" stop-color="#fff"/><stop offset="' + (W0.y1 / 1920).toFixed(4) + '" stop-color="#fff" stop-opacity="0"/></linearGradient>'
      + '<linearGradient id="winX" x1="0" y1="0" x2="1080" y2="0" gradientUnits="userSpaceOnUse"><stop offset="' + (W0.x0 / 1080).toFixed(4) + '" stop-color="#fff" stop-opacity="0"/><stop offset="' + ((W0.x0 + W0.fade) / 1080).toFixed(4) + '" stop-color="#fff"/><stop offset="' + ((W0.x1 - W0.fade) / 1080).toFixed(4) + '" stop-color="#fff"/><stop offset="' + (W0.x1 / 1080).toFixed(4) + '" stop-color="#fff" stop-opacity="0"/></linearGradient>'
      + '<mask id="win" maskUnits="userSpaceOnUse" x="0" y="0" width="1080" height="1920"><rect x="0" y="0" width="1080" height="1920" fill="url(#winG)"/></mask>'
      + '<mask id="winx" maskUnits="userSpaceOnUse" x="0" y="0" width="1080" height="1920"><rect x="0" y="0" width="1080" height="1920" fill="url(#winX)"/></mask>'
      + '</defs><g mask="url(#win)"><g mask="url(#winx)">';
    s += ground(F, fr);
    const F2 = { pal, tokens: T, zoom: fr.zoom, t: fr.t };
    for (const O of fr.objs) if (O.lv === -9) for (const it of O.items) s += '<g opacity="' + f1(it.op) + '">' + prim(it.pr, it.o, fr.P, F2, '') + '</g>';
    s += links(F, fr);
    for (const O of fr.objs) {
      if (O.lv === -9 || !O.items.length) continue;
      const look = O.kind === 'asm' && fr.focus === O.i ? 'lit' : O.look;
      if (O.kind === 'asm') { // a soft halo under the part once it has landed
        const a = O.a, land = O.items[0], pos = posOf(a, fr.t);
        s += '<path d="' + path(rounded(pos[0]! - a.fp.w / 2 - 6, pos[1]! - a.fp.d / 2 - 6, a.fp.w + 12, a.fp.d + 12, 16).map(p => iso([p[0]!, p[1]!, pos[2]! + 0.4 + fr.xk * 260], fr.P)), true) + '" fill="' + pal.halo + '" opacity="' + f1(pal.haloOpacity * 0.8 * cl(1 - Math.abs(land.o[2] - pos[2]!) / 200) * land.op) + '" filter="url(#halo)"/>';
      }
      for (const it of O.items) s += it.op < 1 ? '<g opacity="' + f1(it.op) + '">' + prim(it.pr, it.o, fr.P, F2, look) + '</g>' : prim(it.pr, it.o, fr.P, F2, look);
    }
    s += notes(F, fr) + '</g></g>';
    s += detail(F, fr, F2);
    s += callouts(F, fr);
    return s + '</svg>';
  }

  return { cl, ease, cam, iso, depth, path, rounded, circle, extrude, prim, primPts, spring, apart, posOf, camera, frame, svg, routeLen, boxOf, corners, bboxScreen, secAt, EXIT };
}

/** The same functions in Node (layout validation). */
export const ISO = anatomyLib();
/** Source for the browser player: `var ANATOMY = (...)();` (esbuild's keepNames helper defined first). */
export const ISO_SRC = `var __name = function (f) { return f; };\nvar ANATOMY = (${anatomyLib.toString()})();`;
