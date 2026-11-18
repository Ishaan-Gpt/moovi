/* family.js: the shared craft kit for the Diwali Short's cast (Aap and Dadi), three r128, units cm, all procedural.
   One family look: a stylised human head (skull, jaw, cheeks, brow ridge, nose, lips, chin) sculpted from a deformed
   sphere, eyeballs in sockets under real lids that close over the eye (never an empty socket), cupped ears with a helix
   rim and a lobe, a neck, five-fingered hands with three-segment fingers and nails, and a matte skin with a wrapped,
   warm terminator (cheap subsurface). window.CASTKIT(THREE, lin) -> kit (memoised per THREE). */
(function () {
'use strict';
const TAU = Math.PI * 2;
function oklch(L, C, h) {
  const a = C * Math.cos(h * Math.PI / 180), b = C * Math.sin(h * Math.PI / 180);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b, m_ = L - 0.1055613458 * a - 0.0638541728 * b, s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, bb = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;
  const f = x => { x = Math.max(0, Math.min(1, x)); return x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055; };
  return '#' + [r, g, bb].map(x => Math.round(f(x) * 255).toString(16).padStart(2, '0')).join('');
}
const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const cl = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, k) => a + (b - a) * k;
const gss = (x, y, cx, cy, sx, sy) => Math.exp(-((x - cx) ** 2) / (2 * sx * sx) - ((y - cy) ** 2) / (2 * sy * sy));
function hash(x, y, s) { let h = (x * 374761393 + y * 668265263 + s * 1442695041) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
function vnoise(x, y, s, per) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi; const w = v => ((v % per) + per) % per;
  const a = hash(w(xi), w(yi), s), b = hash(w(xi + 1), w(yi), s), c = hash(w(xi), w(yi + 1), s), d = hash(w(xi + 1), w(yi + 1), s);
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
const hexRgb = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const rgba = (h, a) => `rgba(${hexRgb(h).join(',')},${a})`;

let KIT = null;
window.CASTKIT = function (THREE, lin) {
  if (KIT) return KIT;
  const V2 = (x, y) => new THREE.Vector2(x, y), V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const tex = (cv, srgb, rx = 1, ry = 1) => { const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.repeat.set(rx, ry); if (srgb) t.encoding = THREE.sRGBEncoding; return t; };
  // a seamless colour + bump tile: f(x, y) -> [tone -1..1 between dark/base/light, bump 0..1]
  function tile(N, cols, f) {
    const c = document.createElement('canvas'), b = document.createElement('canvas'); c.width = c.height = b.width = b.height = N;
    const g = c.getContext('2d'), gb = b.getContext('2d'), id = g.createImageData(N, N), ib = gb.createImageData(N, N);
    const [dk, md, lt] = cols.map(hexRgb);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const [k, bv] = f(x, y), o = (y * N + x) * 4;
      for (let i = 0; i < 3; i++) id.data[o + i] = k < 0 ? md[i] + (dk[i] - md[i]) * -k : md[i] + (lt[i] - md[i]) * k;
      id.data[o + 3] = 255; ib.data[o] = ib.data[o + 1] = ib.data[o + 2] = cl(bv, 0, 1) * 255; ib.data[o + 3] = 255;
    }
    g.putImageData(id, 0, 0); gb.putImageData(ib, 0, 0); return [c, b];
  }
  function weld(geo) {
    geo.computeVertexNormals(); const p = geo.attributes.position, n = geo.attributes.normal, m = new Map();
    for (let i = 0; i < p.count; i++) { const k = Math.round(p.getX(i) * 300) + ',' + Math.round(p.getY(i) * 300) + ',' + Math.round(p.getZ(i) * 300);
      let e = m.get(k); if (!e) { e = [0, 0, 0, []]; m.set(k, e); } e[0] += n.getX(i); e[1] += n.getY(i); e[2] += n.getZ(i); e[3].push(i); }
    m.forEach(e => { const l = Math.hypot(e[0], e[1], e[2]) || 1; e[3].forEach(i => n.setXYZ(i, e[0] / l, e[1] / l, e[2] / l)); }); n.needsUpdate = true; return geo;
  }
  function ao(geo, f) { const p = geo.attributes.position, c = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) { const v = f ? cl(f(p.getX(i), p.getY(i), p.getZ(i)), 0.2, 1.08) : 1; c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = v; }
    geo.setAttribute('color', new THREE.BufferAttribute(c, 3)); return geo; }
  const lathe = (prof, seg = 40) => weld(new THREE.LatheGeometry(prof.map(p => V2(Math.max(p[0], 0.001), p[1])), seg, Math.PI, TAU));
  // tapered capsule hanging down -Y from its joint (ball ends so joints never open)
  function limb(r0, r1, len, bulge = 0, seg = 28) {
    const P = [], N = 7;
    for (let k = 0; k <= N; k++) { const a = k / N * Math.PI / 2; P.push([r0 * Math.sin(a), r0 * Math.cos(a)]); }
    for (let k = 1; k < 10; k++) { const f = k / 10; P.push([lerp(r0, r1, f) + bulge * Math.sin(Math.PI * f), -len * f]); }
    for (let k = 0; k <= N; k++) { const a = k / N * Math.PI / 2; P.push([r1 * Math.cos(a), -len - r1 * Math.sin(a)]); }
    return lathe(P.reverse(), seg);
  }
  function tube(pts, r, rf, seg = 40, flatDir = null, flat = 0, radial = 10) {
    const path = new THREE.CatmullRomCurve3(pts), T = seg, R = radial, geo = new THREE.TubeGeometry(path, T, r, R, false), p = geo.attributes.position;
    for (let i = 0; i <= T; i++) { const c = path.getPointAt(i / T), k = rf ? rf(i / T) : 1;
      for (let j = 0; j <= R; j++) { const idx = i * (R + 1) + j; const o = V3(p.getX(idx) - c.x, p.getY(idx) - c.y, p.getZ(idx) - c.z).multiplyScalar(k);
        if (flatDir) { const d = o.dot(flatDir); o.addScaledVector(flatDir, -d * flat); } p.setXYZ(idx, c.x + o.x, c.y + o.y, c.z + o.z); } }
    return weld(geo);
  }

  // ---------- skin: matte, a wrapped warm terminator (light bleeding red under the skin), soft pores ----------
  function skinMaterial(cols, o = {}) {
    const [sc, sb] = tile(256, [cols.dk, cols.base, cols.lt], (x, y) => { const low = vnoise(x / 40, y / 40, 21, 6.4) - 0.5, mid = vnoise(x / 9, y / 9, 23, 28.4) - 0.5, f = vnoise(x / 1.4, y / 1.4, 22, 182.9) - 0.5;
      return [low * 0.16 + mid * 0.06 + f * 0.035, 0.5 + f * 0.55 + mid * 0.2]; });
    const m = new THREE.MeshPhysicalMaterial({ vertexColors: true, map: tex(sc, true, 2, 1), bumpMap: tex(sb, false, 3, 2), bumpScale: o.bump == null ? 0.01 : o.bump,
      roughness: o.rough || 0.7, envMapIntensity: o.env || 0.34 });
    const sss = lin(cols.sss || '#c4553a'), wrap = o.wrap == null ? 0.4 : o.wrap, k = 0; if ('sheen' in m) m.sheen = new THREE.Color(lin(cols.sss || '#c4553a')).multiplyScalar(window.__NOSSS ? 0 : 0.22);   // warm grazing sheen: the subsurface warmth (the wrap hook leaked light inside the collar)
    m.onBeforeCompile = sh => {
      sh.uniforms.uSSS = { value: new THREE.Vector3(sss.r * k, sss.g * k, sss.b * k) }; sh.uniforms.uWrap = { value: wrap };
      const chunk = THREE.ShaderChunk.lights_physical_pars_fragment, key = 'vec3 irradiance = dotNL * directLight.color;';
      if (chunk.indexOf(key) < 0) { console.warn('skin: SSS hook not found'); return; }
      sh.fragmentShader = 'uniform vec3 uSSS; uniform float uWrap;\n' + sh.fragmentShader.replace('#include <lights_physical_pars_fragment>',
        chunk.replace(key, key + '\n float wNL = saturate((dot(geometry.normal, directLight.direction) + uWrap) / (1. + uWrap));\n irradiance += min(max(wNL - dotNL, 0.), 0.3) * directLight.color * uSSS;'));
    };
    m.customProgramCacheKey = () => 'skin-sss-' + wrap + '-' + k;
    return m;
  }

  // ---------- head: a stylised human head from a deformed sphere ----------
  // P: { rx, ry, rz, jaw (0..1 taper), chin, cheek, nose, brow, eyeX, eyeY, socket, lips, round (age softness) }
  function headShape(P) {
    const f = (dx, dy, dz) => {
      let x = dx * P.rx, y = dy * P.ry, z = dz * P.rz;
      // skull: fuller at the back and top, flatter sides at the temples
      if (dz < 0) z *= 1 + 0.1 * sm(-0.35, 0.55, dy);
      x *= 1 - 0.06 * sm(0.2, 0.75, dy) * (1 - Math.abs(dz));
      // jaw: the lower face narrows to the chin; the back of the lower head tucks in to the neck
      const t = sm(-0.12, -1.0, dy);
      x *= 1 - P.jaw * Math.pow(t, 2.5) - 0.06 * t * (dz < 0 ? 1 : 0);
      if (dz < 0) z *= 1 - 0.5 * sm(-0.15, -0.95, dy);
      else z *= 1 - 0.1 * t;
      if (y < -P.ry * 0.88) y = -P.ry * 0.88 - (y + P.ry * 0.88) * 0.45;   // soft underside
      // front features (gaussian pushes along the outward direction)
      let push = 0;
      { const jw = sm(-0.45, 0.2, dz) * (1 - sm(0.75, 0.98, Math.abs(dz))); push += (P.jawMass == null ? 1 : P.jawMass) * 1.1 * jw * (gss(x, y, 9.6, P.eyeY - 10.2, 2.8, 2.6) + gss(x, y, -9.6, P.eyeY - 10.2, 2.8, 2.6)); }
      if (dz > 0.05) {
        const fw = sm(0.05, 0.45, dz);
        const eX = P.eyeX, eY = P.eyeY;
        push += P.cheek * (1.7 * (gss(x, y, 7.4, eY - 5.6, 3.8, 3.4) + gss(x, y, -7.4, eY - 5.6, 3.8, 3.4)));
        push += 0.55 * (gss(x, y, 9.4, eY - 1.4, 2.4, 1.6) + gss(x, y, -9.4, eY - 1.4, 2.4, 1.6));                  // cheekbones
        push += P.brow * 0.9 * (gss(x, y, 5.4, eY + 4.3, 3.6, 1.1) + gss(x, y, -5.4, eY + 4.3, 3.6, 1.1));         // brow ridge
        push -= P.socket * (gss(x, y, eX, eY, 2.7, 2.3) + gss(x, y, -eX, eY, 2.7, 2.3));                         // eye sockets
        push -= 0.25 * (gss(x, y, 12.2, eY + 5.5, 1.6, 2.4) + gss(x, y, -12.2, eY + 5.5, 1.6, 2.4));              // temples
        push += 1.0 * gss(x, y, 0, eY, 9.0, 3.4) + 0.5 * (gss(x, y, eX + 3.0, eY - 0.5, 1.8, 2.4) + gss(x, y, -eX - 3.0, eY - 0.5, 1.8, 2.4));                                                              // a fuller face plane across the eyes
        push += 0.75 * gss(x, y, 0, eY - 8.5, 4.6, 4.2);                                                         // muzzle: the mouth area comes forward
        push -= 0.3 * (gss(x, y, 11, eY - 7, 3.2, 4.5) + gss(x, y, -11, eY - 7, 3.2, 4.5));                     // the face turns back at the sides
        // nose: a bridge that grows into a rounded tip with nostril wings
        const ny = eY - 5.1 * P.nose;
        const bridge = sm(eY + 2.2, ny, y) * (y > ny ? 1 : 0);
        push += P.nose * (bridge * 1.7 * gss(x, 0, 0, 0, 1.05, 1) + 2.2 * gss(x, y, 0, ny, 1.45, 1.3) + 1.15 * (gss(x, y, 1.75, ny - 0.55, 0.85, 0.75) + gss(x, y, -1.75, ny - 0.55, 0.85, 0.75)));
        push += 0.55 * gss(x, y, 0, ny - 1.9, 2.6, 1.1);   // a full philtrum: no concave band under the nose                                                         // under the tip
        // lips and chin
        const my = ny - 3.5;
        push += P.lips * (0.45 * gss(x, y, 0, my + 0.4, 3.2, 1.6) + 0.5 * gss(x, y, 0, my - 1.0, 2.6, 1.0));
        push -= 0.38 * (gss(x, y, 3.2, my, 0.8, 0.9) + gss(x, y, -3.2, my, 0.8, 0.9));
        push -= 0.35 * gss(x, y, 0, my - 2.6, 2.6, 0.8);                                                           // mentolabial crease
        push += P.chin * 1.05 * gss(x, y, 0, my - 5.0, 4.0, 1.9);
        push *= fw;
      }
      const L = Math.hypot(dx, dy, dz) || 1;
      return [x + dx / L * push, y + dy / L * push, z + dz / L * push];
    };
    return f;
  }
  // build a head geometry + a face-overlay twin with planar UVs over [fx0..fx1] x [fy0..fy1]
  function head(P, AO) {
    const f = headShape(P), geo = new THREE.SphereGeometry(1, 160, 120), p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const v = f(p.getX(i), p.getY(i), p.getZ(i)); p.setXYZ(i, v[0], v[1], v[2]); }
    weld(geo);
    ao(geo, (x, y, z) => { let a = 1 - 0.3 * sm(-P.ry * 0.6, -P.ry * 0.95, y) * (z < 2 ? 1 : 0.35);
      if (z > 0) a -= 0.16 * (gss(x, y, P.eyeX, P.eyeY, 3.2, 2.6) + gss(x, y, -P.eyeX, P.eyeY, 3.2, 2.6));
      
      if (z > 0) { const ny = P.eyeY - 5.1 * P.nose; a += 0.2 * gss(x, y, 0, ny - 1.9, 3.0, 1.1) + 0.1 * gss(x, y, 0, ny - 4.6, 4.5, 2.5); }   // lift the philtrum and chin so a top light never paints a moustache
      return AO ? AO(x, y, z, a) : a; });
    const ov = geo.clone(), op = ov.attributes.position, uv = ov.attributes.uv, F = P.face;
    for (let i = 0; i < op.count; i++) { op.setXYZ(i, op.getX(i) * 1.0035, op.getY(i) * 1.0035, op.getZ(i) * 1.0035);
      const z = op.getZ(i); if (z < P.rz * 0.3) uv.setXY(i, -1, -1); else uv.setXY(i, (op.getX(i) - F[0]) / (F[1] - F[0]), (op.getY(i) - F[2]) / (F[3] - F[2])); }
    uv.needsUpdate = true;
    const mesh = new THREE.Mesh(geo); mesh.updateMatrixWorld(true);
    const rc = new THREE.Raycaster();
    // surface point straight in front of (x, y) in head space
    const surf = (x, y) => { rc.set(V3(x, y, 200), V3(0, 0, -1)); const h = rc.intersectObject(mesh, false)[0]; return h ? h.point.z : 0; };
    const surfN = (x, y) => { rc.set(V3(x, y, 200), V3(0, 0, -1)); const h = rc.intersectObject(mesh, false)[0]; return h ? h.face.normal.clone() : V3(0, 0, 1); };
    // side surface (x) at (y, z): for ears
    const side = (s, y, z) => { rc.set(V3(s * 200, y, z), V3(-s, 0, 0)); const h = rc.intersectObject(mesh, false)[0]; return h ? h.point.x : s * P.rx; };
    return { geo, ov, surf, surfN, side, P };
  }
  // a face canvas: planar head-space transform over P.face, paint(g) draws in cm
  function faceTex(P, paint) {
    const F = P.face, N = 1024, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d');
    const sx = N / (F[1] - F[0]), sy = N / (F[3] - F[2]);
    g.setTransform(sx, 0, 0, -sy, -F[0] * sx, F[3] * sy); g.lineCap = g.lineJoin = 'round';
    paint(g);
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, N, 4); g.clearRect(0, N - 4, N, 4); g.clearRect(0, 0, 4, N); g.clearRect(N - 4, 0, 4, N);
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; return t;
  }
  const faceMat = (t) => new THREE.MeshStandardMaterial({ map: t, transparent: true, depthWrite: false, roughness: 0.55, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, envMapIntensity: 0.5 });

  // ---------- eyes: an iris texture on the front pole of a sphere ----------
  function eyeTex(C, irisR, pupR) {
    const W = 512, H = 256, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, C.white2 || C.white); gr.addColorStop(0.36, C.white); gr.addColorStop(1, C.white); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    // faint vessels toward the corners
    g.strokeStyle = 'rgba(190,90,80,.10)'; g.lineWidth = 0.8; for (let i = 0; i < 14; i++) { const y0 = 100 + hash(i, 1, 3) * 56, x0 = i % 2 ? 40 : 216; g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(x0 + (i % 2 ? 30 : -30), y0 + 12, x0 + (i % 2 ? 50 : -50), y0 - 6 + hash(i, 2, 3) * 12); g.stroke(); }
    const px = 81.5, cx = 128, cy = 128, ir = irisR * px, pr = pupR * px;
    const ig = g.createRadialGradient(cx, cy + ir * 0.12, pr * 0.6, cx, cy, ir);
    ig.addColorStop(0, C.iris2); ig.addColorStop(0.5, C.iris1); ig.addColorStop(0.88, C.iris0); ig.addColorStop(1, C.limbal || '#1a120c');
    g.fillStyle = ig; g.beginPath(); g.arc(cx, cy, ir, 0, TAU); g.fill();
    g.lineWidth = 1.1; for (let i = 0; i < 110; i++) { const a = i / 110 * TAU + hash(i, 4, 2) * 0.05, r0 = pr * (1.05 + hash(i, 5, 2) * 0.2), r1 = ir * (0.7 + hash(i, 6, 2) * 0.22);
      g.strokeStyle = i % 3 ? rgba(C.iris2, 0.28) : 'rgba(20,12,8,.18)'; g.beginPath(); g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); g.lineTo(cx + Math.cos(a + 0.04) * r1, cy + Math.sin(a + 0.04) * r1); g.stroke(); }
    g.fillStyle = C.pupil; g.beginPath(); g.arc(cx, cy, pr, 0, TAU); g.fill();
    const hl = (x, y, r, a) => { const h = g.createRadialGradient(x, y, 0, x, y, r); h.addColorStop(0, `rgba(255,252,244,${a})`); h.addColorStop(0.65, `rgba(255,252,244,${a})`); h.addColorStop(1, 'rgba(255,252,244,0)'); g.fillStyle = h; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); };
    hl(cx - ir * 0.34, cy - ir * 0.38, ir * 0.24, 0.95); hl(cx + ir * 0.36, cy + ir * 0.34, ir * 0.1, 0.7);
    return tex(c, true);
  }
  // one eye rig: group at the eyeball centre. Lids are skin shells a little larger than the ball; closed, the upper lid
  // meets the lower lid below the centre so the eye is always covered by skin, never an empty socket.
  function eye(ER, M, o = {}) {
    const g = new THREE.Group(), sc = new THREE.Group(); g.add(sc); sc.scale.set(1, o.sy || 1.08, o.sz || 0.8);
    const ball = new THREE.Mesh(KIT._eyeGeo(ER), M.eye); sc.add(ball);
    const lidR = ER * 1.075, lidG = KIT._lidGeo(lidR), lashG = KIT._lashGeo(lidR, o.lash || 0.3), lowG = KIT._lowGeo(lidR * 0.995), lowLash = KIT._lashGeo(lidR * 0.995, 0.12);
    const tiltU = new THREE.Group(), up = new THREE.Group(); sc.add(tiltU); tiltU.add(up);
    const lidM = new THREE.Mesh(lidG, M.lid); up.add(lidM); const la = new THREE.Mesh(lashG, M.lash); up.add(la);
    const tiltL = new THREE.Group(), lo = new THREE.Group(); sc.add(tiltL); tiltL.add(lo);
    const lowM = new THREE.Mesh(lowG, M.lid); lo.add(lowM); const ll = new THREE.Mesh(lowLash, M.lashLow || M.lash); lo.add(ll);
    [ball, lidM, la, lowM, ll].forEach(m => { m.castShadow = false; m.receiveShadow = true; });
    // set(open 0..1 of upper lid closure, low raise 0..1, tilt rad, gaze [yaw, pitch])
    function set(upK, lowK, tilt, gaze, side) {
      const aOpen = -0.98, aClosed = 0.4;            // upper lid angle (about x): open = edge above the iris; closed = past the centre
      up.rotation.x = lerp(aOpen, aClosed, upK);
      lo.rotation.x = lerp(0.72, 0.2, lowK);            // lower lid: open edge low, raised toward the centre
      tiltU.rotation.z = side * tilt; tiltL.rotation.z = -side * tilt * 0.3;
      ball.rotation.set(-(gaze[1] || 0), gaze[0] || 0, 0);
    }
    return { g, sc, ball, set };
  }

  // ---------- ear: a cupped shell with a rolled helix rim, an antihelix ridge, a concha bowl and a lobe ----------
  // ear-local: y up, z back (the ear's back edge), x out from the head. Height H.
  function earGeo(H) {
    const geo = new THREE.SphereGeometry(1, 48, 36), p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const ux = p.getX(i), uy = p.getY(i), uz = p.getZ(i);
      // outline: a C shape, wider at the top, a lobe at the bottom
      const h = H / 2, wTop = H * 0.33, wBot = H * 0.22;
      let y = uy * h, z = uz * lerp(wBot, wTop, sm(-0.8, 0.6, uy)), x = ux * H * 0.11;
      const r = Math.hypot(uy, uz);                        // 0 at the bowl centre, 1 at the rim
      // the outer face (x > 0): rim stands out, bowl sinks toward the head
      if (ux > 0) { x += H * 0.13 * sm(0.7, 0.93, r) - H * 0.12 * (1 - sm(0.15, 0.62, r)) * sm(-0.7, 0.2, uy) + H * 0.05 * gss(uy, uz, 0.15, 0.1, 0.12, 0.35); }
      // lobe: thicker, rounder; the front (z < 0) attaches to the head
      if (uy < -0.55) { x *= 1.15; z *= 1 - 0.15 * sm(-0.55, -1, uy); }
      z += H * 0.08 * uy;                                   // lean back at the top
      p.setXYZ(i, x + H * 0.06, y, z);
    }
    weld(geo); ao(geo, (x, y, z) => 1 - 0.35 * gss(y, z, -H * 0.05, -H * 0.02, H * 0.13, H * 0.1) * (x > H * 0.06 ? 0 : 1) - 0.2 * sm(H * 0.1, -H * 0.02, x));
    return geo;
  }

  // ---------- hand: palm + four three-segment fingers with nails + a two-segment thumb ----------
  // hand-local: hangs down -Y; width along Z (thumb on +Z), palm faces -s X. Returns { group, fingers: [[k1,k2,k3]...], thumb: [t1,t2] }
  function handBuilder(cfg) {
    const S = cfg.size || 1, R = cfg.r || 1;
    const palmG = (() => { const g = new THREE.SphereGeometry(1, 40, 30), q = g.attributes.position;
      for (let i = 0; i < q.count; i++) { let x = q.getX(i), y = q.getY(i), z = q.getZ(i);
        const w = 1 - 0.12 * sm(0.3, 1, y);
        q.setXYZ(i, x * 1.45 * S * R * (1 + 0.15 * (z > 0 ? 1 : 0) * (1 - y * y)), (y * 3.9 - 3.7) * S, z * 3.55 * S * w + (y < -0.3 ? z * 0.25 * S : 0)); }
      return ao(weld(g), (x, y) => 0.88 + 0.12 * sm(-7.6 * S, -2 * S, y)); })();
    const segG = {}; const seg = (r0, r1, L) => { const k = [r0, r1, L].map(v => v.toFixed(2)).join(); if (!segG[k]) segG[k] = ao(limb(r0, r1, L, 0, 16), (x, y) => 0.9 + 0.1 * sm(-L, 0, y)); return segG[k]; };
    const nailG = (() => { const g = new THREE.SphereGeometry(1, 16, 10); g.scale(0.22, 0.62, 0.55); return ao(weld(g)); })();
    // finger table: z offset, length, radius
    const F = [[2.75, 5.3, 0.78], [0.92, 5.9, 0.8], [-0.92, 5.6, 0.77], [-2.6, 4.5, 0.68]];
    return function make(s, M) {
      const root = new THREE.Group(); const palm = new THREE.Mesh(palmG, M.skin); palm.castShadow = true; root.add(palm);
      const fingers = F.map(([z, L, r], i) => {
        const k1 = new THREE.Group(); k1.position.set(0, -7.3 * S, z * S); root.add(k1);
        const ls = [0.45, 0.31, 0.24].map(f => f * L * S), rs = [r * S * R, r * 0.9 * S * R, r * 0.8 * S * R, r * 0.68 * S * R];
        const segs = [k1]; let par = k1;
        ls.forEach((l, j) => { const m = new THREE.Mesh(seg(rs[j], rs[j + 1], l), M.skin); m.castShadow = true; par.add(m);
          if (j < 2) { const k = new THREE.Group(); k.position.y = -l; par.add(k); segs.push(k); par = k; }
          else { const n = new THREE.Mesh(nailG, M.nail); n.position.set(s * rs[3] * 0.72, -l * 0.62, 0); n.scale.setScalar(rs[3] / 0.6); par.add(n); } });
        return segs;
      });
      const t1 = new THREE.Group(); t1.position.set(-s * 0.35 * S, -2.6 * S, 2.7 * S); root.add(t1);
      const tm = new THREE.Mesh(seg(1.02 * S * R, 0.9 * S * R, 2.6 * S), M.skin); tm.castShadow = true; t1.add(tm);
      const t2 = new THREE.Group(); t2.position.y = -2.6 * S; t1.add(t2); const tm2 = new THREE.Mesh(seg(0.9 * S * R, 0.74 * S * R, 2.2 * S), M.skin); tm2.castShadow = true; t2.add(tm2);
      const tn = new THREE.Mesh(nailG, M.nail); tn.position.set(s * 0.55 * S, -1.5 * S, 0.15 * S); tn.scale.setScalar(1.35 * S); t2.add(tn);
      t1.rotation.set(-0.55, 0, -s * 0.45);
      // curl: k (0 open .. 1 fist), spread
      function curl(k, spread = 0, thumbK = null) {
        fingers.forEach((sg, i) => { const ki = cl(k * (1 + i * 0.05));
          sg[0].rotation.set((i - 1.5) * -0.07 * spread, 0, -s * (0.12 + 1.25 * ki)); sg[1].rotation.z = -s * (0.08 + 1.35 * ki); sg[2].rotation.z = -s * (0.06 + 0.9 * ki); });
        const tk = thumbK == null ? k : thumbK; t1.rotation.set(-0.55 + 0.25 * tk, 0.0, -s * (0.45 + 0.55 * tk)); t2.rotation.z = -s * (0.15 + 0.7 * tk);
      }
      curl(0.15);
      return { root, fingers, thumb: [t1, t2], curl };
    };
  }

  // a neck: a slightly tapered column with a soft front (throat) and a nape
  function neckGeo(r0, r1, len) { const g = limb(r0, r1, len, 0, 32); g.rotateX(Math.PI); g.translate(0, 0, 0); return ao(g, (x, y, z) => 0.72 + 0.28 * sm(0, len * 0.8, y) - 0.1 * sm(0, -r0, z) * sm(len * 0.6, len, y)); }

  // geometry caches used by eye()
  const gc = {};
  KIT = {
    oklch, sm, cl, lerp, gss, hash, vnoise, rgba, hexRgb, tile, tex, weld, ao, lathe, limb, tube, skinMaterial, head, headShape, faceTex, faceMat, eyeTex, eye, earGeo, handBuilder, neckGeo,
    _eyeGeo: r => gc['e' + r] || (gc['e' + r] = ao(weld(new THREE.SphereGeometry(r, 48, 32)))),
    _lidGeo: r => gc['l' + r] || (gc['l' + r] = ao(weld(new THREE.SphereGeometry(r, 48, 18, 0, TAU, 0, Math.PI / 2)), (x, y) => 0.84 + 0.16 * sm(0, r, y))),
    _lowGeo: r => gc['w' + r] || (gc['w' + r] = ao(weld(new THREE.SphereGeometry(r, 48, 18, 0, TAU, Math.PI / 2, Math.PI / 2)), (x, y) => 0.86 + 0.1 * sm(0, -r, y))),
    _lashGeo: (r, th) => gc['a' + r + th] || (gc['a' + r + th] = (() => { const g = new THREE.TorusGeometry(r, th, 8, 48, Math.PI); g.rotateX(Math.PI / 2);
      // thicker toward the outer corner
      return ao(weld(g)); })()),
  };
  return KIT;
};
window.CASTKIT.oklch = oklch;
})();
