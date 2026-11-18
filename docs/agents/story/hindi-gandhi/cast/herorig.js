/* herorig.js: the hero body for the "Kya Ho Agar" family, rebuilt as ONE continuous skinned body (three r128, units cm).
   It upgrades any family character (azad.js, bhagat.js, gent.js, ...): the head, face, hair and expressions are taken
   from the old rig untouched (the look that went viral); the jointed-tube body is replaced by
     - one implicit-surface body (torso, shoulders, arms, hands with 3-joint fingers and a thumb, legs, feet) meshed with
       surface nets and skinned to a bone skeleton with smooth weights; no seams at any joint;
     - helper bones that keep volume: half-angle bones at the shoulder, elbow, hip, knee and waist, three forearm twist
       bones (no candy-wrapper), a shoulder that lifts with the arm, a chest that breathes;
     - the old wardrobe (dhoti, waistband, janeu, kurta skirt, collar, cuffs) re-skinned to the same bones, with cloth
       bones on the skirt that sag under a lifted thigh and lag behind the hips;
     - joint limits, a body collision pass (arm against torso, head, pelvis, thighs and the other arm), foot planting on
       any ground height, a leg IK, and an idle / walk that plants its feet.
   Same rig API as the old files: root, joints {hips, torso, neck, head, arm/foreArm/hand L R, leg/shin/foot L R},
   sockets, hands, pose, setExpression, mix, setBlink, setGaze, grip, point, update. New: rig.hero, rig.plant(),
   rig.setGround(y), rig.legIK(), rig.pushOut(), rig.limits.
   window.HERORIG(THREE, lin).make(baseCharacter, spec) -> rig;  window.HERORIG(THREE, lin).register(id, baseId, spec). */
(function () {
'use strict';
const TAU = Math.PI * 2;
const cl = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x)), sm = (a, b, x) => { const t = cl((x - a) / (b - a)); return t * t * (3 - 2 * t); }, lerp = (a, b, k) => a + (b - a) * k;
const HIP = 55, BA = 0.72, BL = 0.1, UA = 15, FA = 14, TH = 26, SH = 22.6, ANK = 6.4;
const FZ = [2.7, 0.9, -0.9, -2.55], FLEN = [4.5, 4.9, 4.7, 3.8], FR = [0.93, 0.96, 0.92, 0.82], FSEG = [0.45, 0.31, 0.24], FRK = [1, 0.94, 0.88, 0.78];
const TL = [2.6, 1.9, 1.7], TR = [0.95, 0.84, 0.74, 0.62];
const SIDES = [['L', 1], ['R', -1]];
const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
let API = null;

window.HERORIG = function (THREE, lin) {
  if (API) return API;
  const F = window.CASTKIT(THREE, lin);
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const ID4 = new THREE.Matrix4();

  // ---------------------------------------------------------------- skeleton
  function buildSk() {
    const root = new THREE.Group(), B = {}, list = [];
    const bone = (name, parent, x, y, z) => { const b = new THREE.Bone(); b.name = name; b.position.set(x, y, z); (parent ? B[parent] : root).add(b); B[name] = b; b.userData.i = list.length; list.push(b); return b; };
    bone('hips', null, 0, HIP, 0); bone('waistH', 'hips', 0, 2, 0); bone('torso', 'hips', 0, 2, 0); bone('chestH', 'torso', 0, 17, 0); bone('neck', 'torso', 0, 31, 0.2); bone('head', 'neck', 0, 5.6, 0.6);
    SIDES.forEach(([S, s]) => {
      bone('shH' + S, 'torso', s * 12.8, 26.6, -0.4); bone('arm' + S, 'torso', s * 12.8, 26.6, -0.4); bone('elH' + S, 'arm' + S, 0, -UA, 0); bone('foreArm' + S, 'arm' + S, 0, -UA, 0);
      bone('tw1' + S, 'foreArm' + S, 0, 0, 0); bone('tw2' + S, 'foreArm' + S, 0, 0, 0); bone('tw3' + S, 'foreArm' + S, 0, 0, 0); bone('hand' + S, 'foreArm' + S, 0, -FA, 0);
      for (let i = 0; i < 4; i++) { bone('f' + S + i + '0', 'hand' + S, 0, -7.5, FZ[i]); bone('f' + S + i + '1', 'f' + S + i + '0', 0, -FLEN[i] * FSEG[0], 0); bone('f' + S + i + '2', 'f' + S + i + '1', 0, -FLEN[i] * FSEG[1], 0); }
      bone('t' + S + '0', 'hand' + S, -s * 0.35, -2.6, 2.7); bone('t' + S + '1', 't' + S + '0', 0, -TL[0], 0); bone('t' + S + '2', 't' + S + '1', 0, -TL[1], 0);
      bone('hipH' + S, 'hips', s * 5, 0, 0); bone('leg' + S, 'hips', s * 5, 0, 0); bone('skF' + S, 'leg' + S, 0, 0, 0); bone('skB' + S, 'leg' + S, 0, 0, 0); bone('knH' + S, 'leg' + S, 0, -TH, 0); bone('shin' + S, 'leg' + S, 0, -TH, 0); bone('foot' + S, 'shin' + S, 0, -SH, 0);
    });
    return { root, B, list };
  }
  function fingerPose(B, S, s, k, spread, tk) {
    for (let i = 0; i < 4; i++) { const ki = cl(k * lerp(0.62 + 0.26 * i, 1 + i * 0.05, sm(0.45, 0.85, k)));
      B['f' + S + i + '0'].rotation.set((i - 1.5) * (0.07 * (1 - 0.85 * ki) + 0.12 * spread), 0, -s * (0.12 + 1.25 * ki)); B['f' + S + i + '1'].rotation.set(0, 0, -s * (0.08 + 1.35 * ki)); B['f' + S + i + '2'].rotation.set(0, 0, -s * (0.06 + 0.9 * ki)); }
    B['t' + S + '0'].rotation.set(-0.55 + 0.25 * tk, 0, -s * (0.45 + 0.55 * tk)); B['t' + S + '1'].rotation.set(0, 0, -s * (0.15 + 0.7 * tk)); B['t' + S + '2'].rotation.set(0, 0, -s * (0.1 + 0.55 * tk));
  }
  function bindPose(sk) { const B = sk.B;
    SIDES.forEach(([S, s]) => { B['arm' + S].rotation.set(0, 0, s * BA); B['leg' + S].rotation.set(0, 0, s * BL); B['foot' + S].rotation.set(0, 0, -s * BL); fingerPose(B, S, s, 0, 0, 0); });
    solveHelpers(sk); sk.root.updateMatrixWorld(true); }
  // helper bones: pure functions of the main joints
  const _q = new THREE.Quaternion(), _qi = new THREE.Quaternion(), _v = new THREE.Vector3();
  function half(dst, src, k) { _q.copy(src); if (_q.w < 0) { _q.x = -_q.x; _q.y = -_q.y; _q.z = -_q.z; _q.w = -_q.w; } dst.quaternion.set(0, 0, 0, 1).slerp(_q, k); return 2 * Math.acos(Math.min(1, _q.w)); }
  function solveHelpers(sk) { const B = sk.B;
    half(B.waistH, B.torso.quaternion, 0.5);
    for (let n = 0; n < 2; n++) { const S = SIDES[n][0], s = SIDES[n][1];
      const arm = B['arm' + S], sh = B['shH' + S]; half(sh, arm.quaternion, 0.5);
      _v.set(0, -1, 0).applyQuaternion(arm.quaternion); const lift = sm(-0.25, 0.95, _v.y);   // the shoulder rolls up and in as the arm rises
      sh.position.set(s * (12.8 - 0.7 * lift), 26.6 + 1.3 * lift, -0.4);
      let th = half(B['elH' + S], B['foreArm' + S].quaternion, 0.5), sc = 1 + 0.4 * (1 / Math.cos(Math.min(th, 2.9) / 4) - 1); B['elH' + S].scale.set(sc, 1, sc);
      const hq = B['hand' + S].quaternion; let ph = 2 * Math.atan2(hq.y, hq.w); if (ph > Math.PI) ph -= TAU; if (ph < -Math.PI) ph += TAU; ph = cl(ph, -2.0, 2.0);
      B['tw1' + S].rotation.set(0, ph / 3, 0); B['tw2' + S].rotation.set(0, ph * 2 / 3, 0); B['tw3' + S].rotation.set(0, ph, 0);
      half(B['hipH' + S], B['leg' + S].quaternion, 0.5);
      th = half(B['knH' + S], B['shin' + S].quaternion, 0.5); sc = 1 + 0.2 * (1 / Math.cos(Math.min(th, 2.9) / 4) - 1); B['knH' + S].scale.set(sc, 1, sc);
    } }

  // ---------------------------------------------------------------- implicit body
  function buildField(T, O) {   // T: template skeleton in the bind pose; O: { loose: {trunk, arm, fore, leg, shin}, shoes }
    const B = T.B, wp = (n, x = 0, y = 0, z = 0) => { const v = B[n].localToWorld(V3(x, y, z)); return [v.x, v.y, v.z]; };
    const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], mix = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
    const G = [[], [], [], [], []], L = Object.assign({ trunk: 0, arm: 0, fore: 0, leg: 0, shin: 0 }, O.loose || {});
    const rc = (g, a, b, r1, r2, k = 0, fine = 0) => { const bx = b[0] - a[0], by = b[1] - a[1], bz = b[2] - a[2], l2 = bx * bx + by * by + bz * bz, rr = r1 - r2;
      G[g].push({ t: 0, ax: a[0], ay: a[1], az: a[2], bx, by, bz, l2, rr, a2: l2 - rr * rr, il2: 1 / l2, r1, r2, k, fine }); };
    const el = (g, c, r, k = 0, fine = 0) => G[g].push({ t: 1, cx: c[0], cy: c[1], cz: c[2], rx: r[0], ry: r[1], rz: r[2], mr: Math.min(r[0], r[1], r[2]), k, fine });
    const bx = (g, c, h, rd, R, k = 0) => G[g].push({ t: 2, cx: c[0], cy: c[1], cz: c[2], hx: h[0], hy: h[1], hz: h[2], rd, R, k, fine: 0 });
    // trunk
    el(0, [0, 54.5, -0.2], [10.9 + L.leg * 0.6, 8.2, 8.3 + L.leg * 0.6]);
    el(0, [0, 63.5, 0.4], [10.9 + L.trunk * 1.5, 10.5, 8.5 + L.trunk * 1.5], O.clothTrunk ? 7 : 5.5);
    el(0, [0, 75.6, 0], [11.7 + L.trunk * 0.6, 11.6, 9.1 + L.trunk], O.clothTrunk ? 8 : 6);
    rc(0, [-9.0, 83.3, -0.9], [9.0, 83.3, -0.9], 4.1 + L.trunk * 0.5, 4.1 + L.trunk * 0.5, 3.5);
    [1, -1].forEach(s => { if (!O.clothTrunk) el(0, [s * 4.9, 78.6, 4.6], [5.4, 4.6, 3.4], 4.6); rc(0, [0, 88.4, -1.5], [s * 9.4, 85.0, -1.3], 2.6, 2.9, 4); el(0, [s * 4.8, 52.3, -3.4], [5.8 + L.leg * 0.5, 6.2, 5.2 + L.leg * 0.5], 3); });
    rc(0, [0, 84.5, -0.7], [0, 97, 1.0], 6.0, 4.9, 2.6);
    const J = {};   // bind joints, per side
    SIDES.forEach(([S, s], n) => {
      const g = 1 + n, Sh = wp('arm' + S), E = wp('foreArm' + S), W = wp('hand' + S), la = L.arm, lf = L.fore;
      el(g, add(Sh, [s * 0.4, -0.4, 0]), [4.25 + la, 4.5 + la, 4.25 + la]);
      rc(g, Sh, E, 3.75 + la, 3.0 + la, 3);
      rc(g, E, W, 2.8 + lf, 2.05 + lf * 0.7, 2.5);
      const hb = B['hand' + S], R = new THREE.Matrix3().setFromMatrix4(hb.matrixWorld).elements.slice();   // columns = hand axes in root space
      rc(g, W, wp('hand' + S, 0, -2.2, 0), 1.95, 1.7, 1.0);
      bx(g, wp('hand' + S, 0, -4.1, -0.1), [0.22, 2.55, 2.3], 1.2, R, 1.2); el(g, wp('hand' + S, s * 0.25, -4.4, -0.2), [1.25, 3.0, 2.9], 1.0);
      rc(g, wp('hand' + S, -s * 0.45, -1.7, 1.9), wp('hand' + S, -s * 0.55, -4.6, 2.5), 1.25, 1.2, 0.8);
      const Tp = [wp('t' + S + '0'), wp('t' + S + '1'), wp('t' + S + '2'), wp('t' + S + '2', 0, -TL[2], 0)];
      rc(g, Tp[0], Tp[1], TR[0], TR[1], 0.8); rc(g, Tp[1], Tp[2], TR[1], TR[2], 0, 1); rc(g, Tp[2], Tp[3], TR[2], TR[3], 0, 1);
      const chains = [];
      for (let i = 0; i < 4; i++) { const P = [wp('f' + S + i + '0'), wp('f' + S + i + '1'), wp('f' + S + i + '2'), wp('f' + S + i + '2', 0, -FLEN[i] * FSEG[2], 0)];
        for (let j = 0; j < 3; j++) rc(g, P[j], P[j + 1], FR[i] * FRK[j], FR[i] * FRK[j + 1], 0, 1);
        chains.push({ P, r: FR[i], b: [0, 1, 2].map(j => B['f' + S + i + j].userData.i), bl: 1 }); }
      chains.push({ P: Tp, r: TR[1], b: [0, 1, 2].map(j => B['t' + S + j].userData.i), bl: 1.9 });
      chains.forEach(c => { c.len = [0, 1, 2].map(j => Math.hypot(c.P[j + 1][0] - c.P[j][0], c.P[j + 1][1] - c.P[j][1], c.P[j + 1][2] - c.P[j][2])); });
      const gl = 3 + n, H = wp('leg' + S), K = wp('shin' + S), A = wp('foot' + S), ll = L.leg, ls = L.shin;
      rc(gl, H, K, 5.6 + ll, 3.85 + ll);
      el(gl, add(K, [0, 0, 0.3]), [3.6 + ll, 3.4 + ll, 3.35 + ll], 3.5);
      rc(gl, K, A, 3.55 + ls, 2.45 + ls * 0.8, 3.5);
      el(gl, add(mix(K, A, 0.34), [0, 0, -0.5]), [2.9 + ls, 7.4, 2.95 + ls], 4);
      if (O.shoes) { el(gl, add(A, [0, -3.7, -1.3]), [3.2, 2.9, 3.6], 1.5); rc(gl, add(A, [0, -3.9, 0]), add(A, [0, -4.5, 9.2]), 2.9, 2.3, 1.5); el(gl, add(A, [0, -2.6, 3.0]), [2.8, 2.6, 4.8], 2); el(gl, add(A, [0, -4.7, 10.2]), [3.3, 1.9, 3.2], 1.5); }
      else { el(gl, add(A, [0, -3.9, -1.5]), [2.8, 2.6, 3.3], 1.5); rc(gl, add(A, [0, -4.2, 0]), add(A, [-s * 0.2, -4.95, 8.0]), 2.4, 1.75, 1.5); el(gl, add(A, [0, -2.4, 2.6]), [2.4, 2.3, 4.4], 2); el(gl, add(A, [-s * 0.1, -5.0, 8.6]), [3.6, 1.5, 2.3], 1.2);
        [[-2.45, 10.3, 2.5, 1.15], [-1.1, 10.5, 2.3, 0.85], [0.05, 10.3, 2.1, 0.8], [1.1, 9.8, 1.8, 0.75], [2.0, 9.1, 1.5, 0.7]].forEach(([x, z, len, r]) => rc(gl, add(A, [s * x, -5.25, z]), add(A, [s * x * 1.04, -5.45, z + len]), r, r * 0.86, 0, 1)); }
      const dir = v => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; };
      J[S] = { s, Sh, E, W, H, K, A, ad: dir([W[0] - Sh[0], W[1] - Sh[1], W[2] - Sh[2]]), ld: dir([A[0] - H[0], A[1] - H[1], A[2] - H[2]]), chains, soleY: A[1] - ANK };
    });
    const FB = G.map(P => { const f = P.filter(q => q.fine); if (!f.length) return null; let cx = 0, cy = 0, cz = 0; f.forEach(q => { cx += q.ax + q.bx / 2; cy += q.ay + q.by / 2; cz += q.az + q.bz / 2; }); cx /= f.length; cy /= f.length; cz /= f.length;
      let R = 0; f.forEach(q => { R = Math.max(R, Math.hypot(q.ax - cx, q.ay - cy, q.az - cz), Math.hypot(q.ax + q.bx - cx, q.ay + q.by - cy, q.az + q.bz - cz)); }); return [cx, cy, cz, (R + 3.2) * (R + 3.2)]; });
    function ev(q, x, y, z) {
      if (q.t === 0) { const pax = x - q.ax, pay = y - q.ay, paz = z - q.az, yy = pax * q.bx + pay * q.by + paz * q.bz, zz = yy - q.l2;
        const cx = pax * q.l2 - q.bx * yy, cy = pay * q.l2 - q.by * yy, cz = paz * q.l2 - q.bz * yy, x2 = cx * cx + cy * cy + cz * cz, y2 = yy * yy * q.l2, z2 = zz * zz * q.l2, k = Math.sign(q.rr) * q.rr * q.rr * x2;
        if (Math.sign(zz) * q.a2 * z2 > k) return Math.sqrt(x2 + z2) * q.il2 - q.r2;
        if (Math.sign(yy) * q.a2 * y2 < k) return Math.sqrt(x2 + y2) * q.il2 - q.r1;
        return (Math.sqrt(x2 * q.a2 * q.il2) + yy * q.rr) * q.il2 - q.r1; }
      if (q.t === 1) { const lx = x - q.cx, ly = y - q.cy, lz = z - q.cz, k0 = Math.hypot(lx / q.rx, ly / q.ry, lz / q.rz), k1 = Math.hypot(lx / (q.rx * q.rx), ly / (q.ry * q.ry), lz / (q.rz * q.rz));
        return k0 < 1e-5 ? -q.mr : k0 * (k0 - 1) / k1; }
      const dx = x - q.cx, dy = y - q.cy, dz = z - q.cz, R = q.R;
      const qx = Math.abs(dx * R[0] + dy * R[1] + dz * R[2]) - q.hx, qy = Math.abs(dx * R[3] + dy * R[4] + dz * R[5]) - q.hy, qz = Math.abs(dx * R[6] + dy * R[7] + dz * R[8]) - q.hz;
      return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - q.rd;
    }
    function grp(g, x, y, z, lod) { let d = 1e9, df = 1e9; const P = G[g], fb = FB[g]; if (lod && fb && (x - fb[0]) * (x - fb[0]) + (y - fb[1]) * (y - fb[1]) + (z - fb[2]) * (z - fb[2]) > fb[3]) lod = 0;
      for (let i = 0; i < P.length; i++) { const q = P[i]; if (q.fine) { if (!lod) continue; df = Math.min(df, ev(q, x, y, z)); } else { const v = ev(q, x, y, z); d = q.k > 0 && d < 1e8 ? smin(d, v, q.k) : Math.min(d, v); } }
      if (lod && df < 1e8) d = smin(d, df, g < 3 ? 0.7 : 0.5);
      if (g >= 3) { const sy = g === 3 ? J.L.soleY : J.R.soleY; if (y < sy + 3) d = -smin(-d, y - sy, 0.5); }
      return d; }
    const gd = [0, 0, 0, 0, 0], KA = O.clothTrunk ? 4.6 : 3.6;
    function groups(x, y, z, lod) { gd[0] = y > 40 ? grp(0, x, y, z, lod) : 1e9; gd[1] = x > 4 ? grp(1, x, y, z, lod) : 1e9; gd[2] = x < -4 ? grp(2, x, y, z, lod) : 1e9;
      gd[3] = y < 64 && x > -6 ? grp(3, x, y, z, lod) : 1e9; gd[4] = y < 64 && x < 6 ? grp(4, x, y, z, lod) : 1e9; return gd; }
    function sdf(x, y, z, lod) { groups(x, y, z, lod); let d = gd[0]; if (gd[1] < 1e8) d = smin(d, gd[1], KA); if (gd[2] < 1e8) d = smin(d, gd[2], KA);
      let l = gd[3]; if (gd[4] < 1e8) l = l < 1e8 ? smin(l, gd[4], 1.5) : gd[4]; if (l < 1e8) d = d < 1e8 ? smin(d, l, 3.5) : l; return d; }
    const grad = (x, y, z, lod, out) => { const e = 0.04; out[0] = sdf(x + e, y, z, lod) - sdf(x - e, y, z, lod); out[1] = sdf(x, y + e, z, lod) - sdf(x, y - e, z, lod); out[2] = sdf(x, y, z + e, lod) - sdf(x, y, z - e, lod);
      const l = Math.hypot(out[0], out[1], out[2]) || 1; out[0] /= l; out[1] /= l; out[2] /= l; return out; };
    return { sdf, groups, grad, J, B };
  }

  // surface nets over a box (optionally in a rotated frame M: local -> root). Returns { pos: number[], tri: number[] }
  function nets(f, bb, h, M) {
    const nx = Math.ceil((bb[3] - bb[0]) / h) + 1, ny = Math.ceil((bb[4] - bb[1]) / h) + 1, nz = Math.ceil((bb[5] - bb[2]) / h) + 1, val = new Float32Array(nx * ny * nz);
    const e = M ? M.elements : null, P = [0, 0, 0];
    const at = (i, j, k) => { const x = bb[0] + i * h, y = bb[1] + j * h, z = bb[2] + k * h; if (e) { P[0] = e[0] * x + e[4] * y + e[8] * z + e[12]; P[1] = e[1] * x + e[5] * y + e[9] * z + e[13]; P[2] = e[2] * x + e[6] * y + e[10] * z + e[14]; } else { P[0] = x; P[1] = y; P[2] = z; } return P; };
    const Bk = 4, lim = Bk * h * 0.87 * 1.6 + h;
    for (let k0 = 0; k0 < nz; k0 += Bk) for (let j0 = 0; j0 < ny; j0 += Bk) for (let i0 = 0; i0 < nx; i0 += Bk) {
      at(i0 + Bk / 2 - 0.5, j0 + Bk / 2 - 0.5, k0 + Bk / 2 - 0.5); const dc = f(P[0], P[1], P[2]), far = Math.abs(dc) > lim;
      for (let k = k0; k < Math.min(nz, k0 + Bk); k++) for (let j = j0; j < Math.min(ny, j0 + Bk); j++) for (let i = i0; i < Math.min(nx, i0 + Bk); i++) { if (far) val[(k * ny + j) * nx + i] = dc; else { at(i, j, k); val[(k * ny + j) * nx + i] = f(P[0], P[1], P[2]); } } }
    const cx = nx - 1, cy = ny - 1, cz = nz - 1, cid = new Int32Array(cx * cy * cz).fill(-1), pos = [], tri = [];
    for (let k = 0; k < cz; k++) for (let j = 0; j < cy; j++) for (let i = 0; i < cx; i++) {
      let mask = 0; const v = []; for (let c = 0; c < 8; c++) { const d = val[((k + (c >> 2 & 1)) * ny + j + (c >> 1 & 1)) * nx + i + (c & 1)]; v.push(d); if (d < 0) mask |= 1 << c; }
      if (mask === 0 || mask === 255) continue;
      let sx = 0, sy = 0, sz = 0, n = 0;
      for (let a = 0; a < 8; a++) for (let bit = 1; bit < 8; bit <<= 1) { if (a & bit) continue; const b = a | bit; if ((v[a] < 0) === (v[b] < 0)) continue; const t = v[a] / (v[a] - v[b]);
        sx += (a & 1) + (bit === 1 ? t : 0); sy += (a >> 1 & 1) + (bit === 2 ? t : 0); sz += (a >> 2 & 1) + (bit === 4 ? t : 0); n++; }
      at(i + sx / n, j + sy / n, k + sz / n); cid[(k * cy + j) * cx + i] = pos.length / 3; pos.push(P[0], P[1], P[2]); }
    const C = (i, j, k) => cid[(k * cy + j) * cx + i];
    const quad = (a, b, c, d, flip) => { if (a < 0 || b < 0 || c < 0 || d < 0) return; if (flip) tri.push(a, d, c, a, c, b); else tri.push(a, b, c, a, c, d); };
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const v0 = val[(k * ny + j) * nx + i];
      if (i < nx - 1 && j > 0 && k > 0 && j < cy && k < cz) { const v1 = val[(k * ny + j) * nx + i + 1]; if ((v0 < 0) !== (v1 < 0)) quad(C(i, j - 1, k - 1), C(i, j, k - 1), C(i, j, k), C(i, j - 1, k), v0 > 0); }
      if (j < ny - 1 && i > 0 && k > 0 && i < cx && k < cz) { const v1 = val[(k * ny + j + 1) * nx + i]; if ((v0 < 0) !== (v1 < 0)) quad(C(i - 1, j, k - 1), C(i, j, k - 1), C(i, j, k), C(i - 1, j, k), v0 < 0); }
      if (k < nz - 1 && i > 0 && j > 0 && i < cx && j < cy) { const v1 = val[((k + 1) * ny + j) * nx + i]; if ((v0 < 0) !== (v1 < 0)) quad(C(i - 1, j - 1, k), C(i, j - 1, k), C(i, j, k), C(i - 1, j, k), v0 > 0); } }
    return { pos, tri };
  }
  // cut a triangle list along g = 0 (new vertices on the cut); returns [tris where g > 0, tris where g <= 0]
  function split(pos, tri, g) {
    const gv = [], gval = i => { if (gv[i] === undefined) gv[i] = g(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]); return gv[i]; }, cache = new Map(), A = [], Bn = [];
    const cut = (a, b) => { const key = a < b ? a * 1e6 + b : b * 1e6 + a; let n = cache.get(key); if (n !== undefined) return n; const ga = gval(a), gb = gval(b), t = ga / (ga - gb); n = pos.length / 3;
      pos.push(lerp(pos[a * 3], pos[b * 3], t), lerp(pos[a * 3 + 1], pos[b * 3 + 1], t), lerp(pos[a * 3 + 2], pos[b * 3 + 2], t)); gv[n] = 0; cache.set(key, n); return n; };
    for (let t = 0; t < tri.length; t += 3) { const v = [tri[t], tri[t + 1], tri[t + 2]], s = v.map(i => gval(i) > 0), np = s[0] + s[1] + s[2];
      if (np === 3) { A.push(v[0], v[1], v[2]); continue; } if (np === 0) { Bn.push(v[0], v[1], v[2]); continue; }
      const lone = np === 1 ? s.indexOf(true) : s.indexOf(false), a = v[lone], b = v[(lone + 1) % 3], c = v[(lone + 2) % 3], ab = cut(a, b), ac = cut(a, c);
      (np === 1 ? A : Bn).push(a, ab, ac); (np === 1 ? Bn : A).push(ab, b, c, ab, c, ac); }
    return [A, Bn];
  }

  // the implicit body has no uv layout: its colour tile is sampled on three planes of the bind pose and blended by the normal
  function triplanar(m, tile) { const prev = m.onBeforeCompile, pk = m.customProgramCacheKey ? m.customProgramCacheKey() : ''; m.bumpMap = null;
    m.onBeforeCompile = sh => { if (prev) prev(sh); sh.uniforms.uTri = { value: 1 / tile };
      sh.vertexShader = 'varying vec3 vBP; varying vec3 vBN;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vBP = position; vBN = normal;');
      sh.fragmentShader = 'varying vec3 vBP; varying vec3 vBN; uniform float uTri;\n' + sh.fragmentShader.replace('#include <map_fragment>', [
        '#ifdef USE_MAP', ' vec3 tw = pow(abs(normalize(vBN)), vec3(4.0)); tw /= (tw.x + tw.y + tw.z);',
        ' vec4 texelColor = texture2D(map, vBP.zy * uTri) * tw.x + texture2D(map, vBP.xz * uTri) * tw.y + texture2D(map, vBP.xy * uTri) * tw.z;',
        ' texelColor = mapTexelToLinear(texelColor); diffuseColor *= texelColor;', '#endif'].join('\n')); };
    m.customProgramCacheKey = () => 'tri|' + pk; m.needsUpdate = true; return m; }
  // ---------------------------------------------------------------- kit (geometry, weights, materials), cached per character
  const KITS = {};
  function buildKit(baseChar, base, spec) {
    const t0 = performance.now(), T = buildSk(); bindPose(T);
    const inv = T.list.map(b => new THREE.Matrix4().copy(b.matrixWorld).invert()), bi = n => T.B[n].userData.i, NB = T.list.length;
    const OJ = base.joints, firstMesh = o => o.children.find(c => c.isMesh), meshes = o => o.children.filter(c => c.isMesh);
    const oldSkin = firstMesh(base.hands.L.root).material;
    const mats = { trunk: firstMesh(OJ.torso).material, fore: firstMesh(OJ.foreArmL).material, thigh: firstMesh(OJ.legL).material, shin: firstMesh(OJ.shinL).material };
    const fs = OJ.footL.getObjectByName('footShape'), footMat = fs && firstMesh(fs) ? firstMesh(fs).material : oldSkin;
    const cloth = m => m !== oldSkin, shoes = spec.shoes != null ? spec.shoes : cloth(footMat);
    const loose = Object.assign({ trunk: cloth(mats.trunk) ? 0.5 : 0, arm: cloth(mats.trunk) ? 0.45 : 0, fore: cloth(mats.fore) ? 0.45 : 0, leg: cloth(mats.thigh) && cloth(mats.shin) ? 0.5 : 0, shin: cloth(mats.shin) ? 0.9 : 0 }, spec.loose || {});
    const fld = buildField(T, { loose, shoes, clothTrunk: cloth(mats.trunk) }), { sdf, groups, grad, J } = fld;
    const C = baseChar.C || {}, skin = triplanar(F.skinMaterial({ dk: C.skinDk, base: C.skin, lt: C.skinLt, sss: C.sss }), 45); skin.skinning = true;
    const mcache = new Map(), skinned = (m, tri) => { if (m === oldSkin) return skin; const key = tri ? 't' : 'u'; let e = mcache.get(m); if (!e) { e = {}; mcache.set(m, e); } if (!e[key]) { const c = m.clone(); c.skinning = true; if (tri && c.map) { triplanar(c, 20); c.roughness = 1; c.envMapIntensity = (c.envMapIntensity || 0.4) * 0.4; if (c.sheen && c.sheen.multiplyScalar) c.sheen.multiplyScalar(0.25); } e[key] = c; } return e[key]; };
    // ---- weights
    const acc = new Float32Array(NB), g5 = [0, 0, 0, 0, 0];
    const I = { hips: bi('hips'), waistH: bi('waistH'), torso: bi('torso'), chestH: bi('chestH'), neck: bi('neck'), head: bi('head') };
    SIDES.forEach(([S]) => ['shH', 'arm', 'elH', 'foreArm', 'tw1', 'tw2', 'tw3', 'hand', 'hipH', 'leg', 'skF', 'skB', 'knH', 'shin', 'foot'].forEach(n => { I[n + S] = bi(n + S); }));
    function trunkW(x, y, z, w) { const a = sm(52.5, 57.5, y), b = sm(57.5, 63.5, y); acc[I.hips] += w * (1 - a); acc[I.waistH] += w * (a - b); let t = w * b; if (t <= 0) return;
      const n = sm(86.3, 90, y) * sm(8.8, 5.6, Math.hypot(x, z)), hd = sm(92, 95.5, y); acc[I.neck] += t * n * (1 - hd); acc[I.head] += t * n * hd; t *= 1 - n;
      const c = 0.55 * sm(66, 74, y) * sm(88, 81, y) * sm(-3, 5, z); acc[I.chestH] += t * c; acc[I.torso] += t * (1 - c); }
    function chainAt(x, y, z, c) { let best = 1e9, s = 0, cum = 0;
      for (let j = 0; j < 3; j++) { const a = c.P[j], b = c.P[j + 1], L = c.len[j], ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L, uz = (b[2] - a[2]) / L, tu = (x - a[0]) * ux + (y - a[1]) * uy + (z - a[2]) * uz, t = cl(tu, 0, L);
        const d = Math.hypot(x - a[0] - ux * t, y - a[1] - uy * t, z - a[2] - uz * t); if (d < best) { best = d; s = cum + (j === 0 && tu < 0 ? tu : j === 2 && tu > L ? L : t); } cum += L; }
      return [best, s]; }
    function handW(x, y, z, S, w) { const ch = J[S].chains, m = [], res = []; let tot = 0;
      for (let i = 0; i < 5; i++) { const r = chainAt(x, y, z, ch[i]); res.push(r); const rho = sm(ch[i].r + 1.1 * ch[i].bl, ch[i].r + 0.25, r[0]); m.push(rho); tot += rho; }
      let used = 0; const mx = Math.max.apply(null, m);
      for (let i = 0; i < 5; i++) { if (m[i] <= 0) continue; const c = ch[i], share = w * (tot > 1e-6 ? m[i] / tot * mx : 0), s = res[i][1];
        const a0 = sm(-0.9 * c.bl, 0.45 * c.bl, s), a1 = sm(c.len[0] - 0.55, c.len[0] + 0.55, s), a2 = sm(c.len[0] + c.len[1] - 0.5, c.len[0] + c.len[1] + 0.5, s);
        acc[c.b[0]] += share * (a0 - a1); acc[c.b[1]] += share * (a1 - a2); acc[c.b[2]] += share * a2; used += share * a0; }
      acc[I['hand' + S]] += w - used; }
    function armW(x, y, z, S, w) { const j = J[S], u = (x - j.Sh[0]) * j.ad[0] + (y - j.Sh[1]) * j.ad[1] + (z - j.Sh[2]) * j.ad[2];
      let a = sm(-5.5, 0.5, u), b = sm(0.5, 7, u); acc[I.torso] += w * (1 - a); acc[I['shH' + S]] += w * (a - b); let r = w * b; if (r <= 0) return;
      const u2 = u - UA; a = sm(-4.6, 0, u2); b = sm(0, 4.6, u2); acc[I['arm' + S]] += r * (1 - a); acc[I['elH' + S]] += r * (a - b); r *= b; if (r <= 0) return;
      const h = sm(-1.3, 1.3, u - UA - FA), q = 3 * cl((u2 - 3) / 8.5), rf = r * (1 - h);
      acc[I['foreArm' + S]] += rf * Math.max(0, 1 - q); acc[I['tw1' + S]] += rf * Math.max(0, 1 - Math.abs(q - 1)); acc[I['tw2' + S]] += rf * Math.max(0, 1 - Math.abs(q - 2)); acc[I['tw3' + S]] += rf * Math.max(0, q - 2);
      if (h > 0) { if (u - UA - FA < 0.4) acc[I['hand' + S]] += r * h; else handW(x, y, z, S, r * h); } }
    function legW(x, y, z, S, w) { const j = J[S], u = (x - j.H[0]) * j.ld[0] + (y - j.H[1]) * j.ld[1] + (z - j.H[2]) * j.ld[2];
      let a = sm(-3, 2, u), b = sm(2, 7.5, u); acc[I.hips] += w * (1 - a); acc[I['hipH' + S]] += w * (a - b); let r = w * b; if (r <= 0) return;
      const u2 = u - TH; a = sm(-4, 0, u2); b = sm(0, 4, u2); acc[I['leg' + S]] += r * (1 - a); acc[I['knH' + S]] += r * (a - b); r *= b; if (r <= 0) return;
      const f = sm(j.A[1] + 2.0, j.A[1] - 1.2, y); acc[I['shin' + S]] += r * (1 - f); acc[I['foot' + S]] += r * f; }
    function bodyW(x, y, z) { acc.fill(0); const d = groups(x, y, z, 0); let mn = Math.min(d[0], d[1], d[2], d[3], d[4]), tot = 0;
      for (let i = 0; i < 5; i++) { g5[i] = d[i] > 1e8 ? 0 : Math.exp(-(d[i] - mn) / 0.8); tot += g5[i]; }
      if (g5[0] > 1e-3) trunkW(x, y, z, g5[0] / tot); if (g5[1] > 1e-3) armW(x, y, z, 'L', g5[1] / tot); if (g5[2] > 1e-3) armW(x, y, z, 'R', g5[2] / tot);
      if (g5[3] > 1e-3) legW(x, y, z, 'L', g5[3] / tot); if (g5[4] > 1e-3) legW(x, y, z, 'R', g5[4] / tot); return g5; }
    const segD = (x, y, z, a, b) => { const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], t = cl(((x - a[0]) * ux + (y - a[1]) * uy + (z - a[2]) * uz) / (ux * ux + uy * uy + uz * uz)); return Math.hypot(x - a[0] - ux * t, y - a[1] - uy * t, z - a[2] - uz * t); };
    function skirtW(x, y, z) { acc.fill(0); const dl = segD(x, y, z, J.L.H, J.L.K), dr = segD(x, y, z, J.R.H, J.R.K), el_ = Math.exp(-(dl - Math.min(dl, dr)) / 3.2), er = Math.exp(-(dr - Math.min(dl, dr)) / 3.2);
      const a = sm(57.5, 51.5, y); acc[I.hips] += 1 - a;
      [['L', el_ / (el_ + er)], ['R', er / (el_ + er)]].forEach(([S, sh]) => { const j = J[S], u = (x - j.H[0]) * j.ld[0] + (y - j.H[1]) * j.ld[1] + (z - j.H[2]) * j.ld[2], r = sh * a, b = sm(-2, 5.5, u);
        const wf = sm(-6, 6, z); acc[I.hips] += r * (1 - b); acc[I['skF' + S]] += r * b * wf; acc[I['skB' + S]] += r * b * (1 - wf); }); }
    function top4(si, sw, o) { let a = [-1, -1, -1, -1], w = [0, 0, 0, 0];
      for (let b = 0; b < NB; b++) { const v = acc[b]; if (v <= w[3]) continue; let k = 3; while (k > 0 && v > w[k - 1]) { w[k] = w[k - 1]; a[k] = a[k - 1]; k--; } w[k] = v; a[k] = b; }
      const t = w[0] + w[1] + w[2] + w[3] || 1; for (let k = 0; k < 4; k++) { si[o * 4 + k] = a[k] < 0 ? 0 : a[k]; sw[o * 4 + k] = w[k] / t; } }
    // ---- the body: a coarse mesh, plus fine meshes for the hands and feet over the same field
    const body = nets((x, y, z) => sdf(x, y, z, 0), [-44, -1, -13, 44, 99, 17], spec.h || 0.9);
    const uArm = (S, x, y, z) => { const j = J[S]; return (x - j.Sh[0]) * j.ad[0] + (y - j.Sh[1]) * j.ad[1] + (z - j.Sh[2]) * j.ad[2]; };
    const inHand = (x, y, z) => (x > 14 && uArm('L', x, y, z) > UA + FA + 0.8) || (x < -14 && uArm('R', x, y, z) > UA + FA + 0.8), inFoot = (x, y, z) => y < J.L.A[1] + 1.6;
    const keep = (m, drop) => { const out = []; for (let t = 0; t < m.tri.length; t += 3) { let all = true; for (let k = 0; k < 3; k++) { const i = m.tri[t + k]; if (!drop(m.pos[i * 3], m.pos[i * 3 + 1], m.pos[i * 3 + 2])) { all = false; break; } } if (!all) out.push(m.tri[t], m.tri[t + 1], m.tri[t + 2]); } m.tri = out; return m; };
    const OV = 0.12, cutKeep = (m, g) => { m.tri = split(m.pos, m.tri, g)[0]; return m; };
    cutKeep(body, (x, y, z) => Math.min(x > 14 ? UA + FA - 1.2 + OV - uArm('L', x, y, z) : 1e3, x < -14 ? UA + FA - 1.2 + OV - uArm('R', x, y, z) : 1e3, y > 40 ? 1e3 : y - (J.L.A[1] + 2.6 - OV)));
    const fine = [];
    SIDES.forEach(([S, s]) => {
      fine.push(cutKeep(nets((x, y, z) => sdf(x, y, z, 1), [-4.8, -16.2, -5.0, 4.8, 2.2, 7.6], spec.hh || 0.27, T.B['hand' + S].matrixWorld), (x, y, z) => uArm(S, x, y, z) - (UA + FA - 1.2 - OV)));
      const A = J[S].A; fine.push(cutKeep(nets((x, y, z) => sdf(x, y, z, 1), [A[0] - 5.2, A[1] - ANK - 0.6, -6.6, A[0] + 5.2, A[1] + 4.2, 15.4], spec.fh || 0.42), (x, y, z) => A[1] + 2.6 + OV - y)); });
    // merge
    const pos = body.pos.slice(); let tri = body.tri.slice();
    fine.forEach(m => { const o = pos.length / 3; for (let i = 0; i < m.pos.length; i++) pos.push(m.pos[i]); for (let i = 0; i < m.tri.length; i++) tri.push(m.tri[i] + o); });
    // regions -> materials (cuts are clean lines through the triangles)
    const isSkin = m => m === oldSkin, mid = Math.abs;
    const cuts = [];
    if (mats.trunk !== oldSkin) cuts.push((x, y, z) => Math.min(y - 86.6, 6.3 - Math.hypot(x, z + 0.2)));                                  // collar line
    if (mats.thigh !== mats.trunk) cuts.push((x, y, z) => Math.min(58.1 - y, 17 - mid(x)));                                         // waist
    if (mats.shin !== mats.thigh) cuts.push((x, y, z) => Math.min(J.L.K[1] + 1.4 - y, 17 - mid(x)));                               // knee hem
    if (footMat !== mats.shin) cuts.push((x, y, z) => Math.min(J.L.A[1] + (shoes ? 0.2 : 2.2) - y, 17 - mid(x)));                 // ankle
    if (mats.fore !== mats.trunk) cuts.push((x, y, z) => mid(x) < 14 ? -1 : uArm(x > 0 ? 'L' : 'R', x, y, z) - (UA - 0.4));        // elbow
    if (mats.fore !== oldSkin) cuts.push((x, y, z) => mid(x) < 14 ? -1 : uArm(x > 0 ? 'L' : 'R', x, y, z) - (UA + FA - 0.9));      // wrist
    let lists = [tri]; cuts.forEach(g => { const nx = []; lists.forEach(l => { const [a, b] = split(pos, l, g); if (a.length) nx.push(a); if (b.length) nx.push(b); }); lists = nx; });
    const regionMat = (x, y, z) => { const ax = mid(x);
      if (ax > 14 && y > 40) { const u = uArm(x > 0 ? 'L' : 'R', x, y, z); if (u > UA + FA - 0.9) return oldSkin; if (u > UA - 0.4) return mats.fore; return mats.trunk; }
      if (y > 86.6 && Math.hypot(x, z + 0.2) < 6.3) return oldSkin; if (y > 58.1) return mats.trunk; if (y > J.L.K[1] + 1.4) return mats.thigh; if (y > J.L.A[1] + (shoes ? 0.2 : 2.2)) return mats.shin; return footMat; };
    const byMat = new Map();
    lists.forEach(l => { let cx = 0, cy = 0, cz = 0, n = 0; for (let t = 0; t < Math.min(l.length, 600); t++) { cx += pos[l[t] * 3]; cy += pos[l[t] * 3 + 1]; cz += pos[l[t] * 3 + 2]; n++; }
      // classify each connected list by its triangles (a list can hold both arms or both legs: classify per triangle)
      for (let t = 0; t < l.length; t += 3) { const a = l[t], b = l[t + 1], c = l[t + 2], m = regionMat((pos[a * 3] + pos[b * 3] + pos[c * 3]) / 3, (pos[a * 3 + 1] + pos[b * 3 + 1] + pos[c * 3 + 1]) / 3, (pos[a * 3 + 2] + pos[b * 3 + 2] + pos[c * 3 + 2]) / 3);
        let arr = byMat.get(m); if (!arr) { arr = []; byMat.set(m, arr); } arr.push(a, b, c); } });
    const gr = [0, 0, 0];
    function finish(tris, mat) { const map = new Map(), P = [], idx = [], us = mat === oldSkin ? 1 / 45 : 1 / 140;
      for (let t = 0; t < tris.length; t++) { let n = map.get(tris[t]); if (n === undefined) { n = P.length / 3; map.set(tris[t], n); P.push(pos[tris[t] * 3], pos[tris[t] * 3 + 1], pos[tris[t] * 3 + 2]); } idx.push(n); }
      const N = P.length / 3, p = new Float32Array(P), nr = new Float32Array(N * 3), col = new Float32Array(N * 3), uv = new Float32Array(N * 2), si = new Uint16Array(N * 4), sw = new Float32Array(N * 4);
      for (let i = 0; i < N; i++) { let x = p[i * 3], y = p[i * 3 + 1], z = p[i * 3 + 2];
        for (let it = 0; it < 2; it++) { const d = sdf(x, y, z, 1); grad(x, y, z, 1, gr); x -= d * gr[0]; y -= d * gr[1]; z -= d * gr[2]; }
        grad(x, y, z, 1, gr); p[i * 3] = x; p[i * 3 + 1] = y; p[i * 3 + 2] = z; nr[i * 3] = gr[0]; nr[i * 3 + 1] = gr[1]; nr[i * 3 + 2] = gr[2];
        // near and far occlusion: folds (armpit, groin, between fingers) sit in shade under any light
        const ao = cl(0.6 + 0.4 * sdf(x + gr[0] * 2.4, y + gr[1] * 2.4, z + gr[2] * 2.4, 1) / 2.4, 0.66, 1) * cl(0.5 + 0.5 * sdf(x + gr[0] * 6, y + gr[1] * 6, z + gr[2] * 6, 0) / 6, 0.58, 1) * (0.9 + 0.1 * sm(-0.3, 0.5, gr[1])); col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = ao;
        const ax = Math.abs(gr[0]), ay = Math.abs(gr[1]), az = Math.abs(gr[2]); if (ax > ay && ax > az) { uv[i * 2] = z * us; uv[i * 2 + 1] = y * us; } else if (ay > az) { uv[i * 2] = x * us; uv[i * 2 + 1] = z * us; } else { uv[i * 2] = x * us; uv[i * 2 + 1] = y * us; }
        bodyW(x, y, z); top4(si, sw, i); }
      // orient the triangles outward
      for (let t = 0; t < idx.length; t += 3) { const a = idx[t], b = idx[t + 1], c = idx[t + 2];
        const ux = p[b * 3] - p[a * 3], uy = p[b * 3 + 1] - p[a * 3 + 1], uz = p[b * 3 + 2] - p[a * 3 + 2], vx = p[c * 3] - p[a * 3], vy = p[c * 3 + 1] - p[a * 3 + 1], vz = p[c * 3 + 2] - p[a * 3 + 2];
        if ((uy * vz - uz * vy) * nr[a * 3] + (uz * vx - ux * vz) * nr[a * 3 + 1] + (ux * vy - uy * vx) * nr[a * 3 + 2] < 0) { idx[t + 1] = c; idx[t + 2] = b; } }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nr, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4)); g.setIndex(N > 65535 ? new THREE.BufferAttribute(new Uint32Array(idx), 1) : new THREE.BufferAttribute(new Uint16Array(idx), 1));
      return { geo: g, mat: skinned(mat, true) }; }
    const parts = []; byMat.forEach((tris, m) => parts.push(finish(tris, m)));
    let skirtR = 11.6;
    // ---- the old wardrobe, re-skinned
    function adopt(mesh, boneName, mode) { const g = mesh.geometry.clone(); mesh.updateMatrix(); g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(T.B[boneName].matrixWorld, mesh.matrix));
      if (T.B[boneName].name.indexOf('arm') === 0 || T.B[boneName].name.indexOf('foreArm') === 0) { /* modelled on the hanging arm: already carried to the bind pose by the bone matrix */ }
      const p = g.attributes.position, N = p.count, si = new Uint16Array(N * 4), sw = new Float32Array(N * 4);
      for (let i = 0; i < N; i++) { let x = p.getX(i), y = p.getY(i), z = p.getZ(i); const d = sdf(x, y, z, 0), lo = mode === 'skirt' ? 0.45 : 0.08, hi = mode === 'hug' ? 0.7 : 1e9;
        if (d < lo || d > hi) { grad(x, y, z, 0, gr); const k = (d < lo ? lo : hi) - d; x += gr[0] * k; y += gr[1] * k; z += gr[2] * k; p.setXYZ(i, x, y, z); }
        if (mode === 'skirt') skirtW(x, y, z); else if (boneName === 'hips') { acc.fill(0); acc[I.hips] = 0.4; acc[I.waistH] = 0.6; } else bodyW(x, y, z); top4(si, sw, i); }   // a waistband belongs to the trunk: the thighs never drag it
      g.computeVertexNormals(); F.weld(g); if (!g.attributes.color) F.ao(g);
      if (mode === 'skirt') for (let i = 0; i < N; i++) { const y = p.getY(i); if (y > 47 && y < 58) skirtR = Math.max(skirtR, Math.hypot(p.getX(i), p.getZ(i) * 1.22) + 0.2); }
      g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4)); parts.push({ geo: g, mat: skinned(mesh.material), cloth: mode === 'skirt' }); }
    const extra = (o, bone, skipFirst, mode) => meshes(o).slice(skipFirst ? 1 : 0).forEach(m => { if (m.material === oldSkin || m.visible === false) return; g_box(m); const hgt = m.geometry.boundingBox.max.y - m.geometry.boundingBox.min.y; adopt(m, bone, mode || (bone === 'hips' && hgt > 12 ? 'skirt' : hgt < 1.2 || m.geometry.boundingBox.max.x - m.geometry.boundingBox.min.x > 12 && bone === 'torso' ? 'hug' : 'band')); });
    const g_box = m => { if (!m.geometry.boundingBox) m.geometry.computeBoundingBox(); };
    extra(OJ.hips, 'hips', false); if (!spec.janeu) extra(OJ.torso, 'torso', true);
    if (spec.janeu) { const surfZ = (x, y, sg) => { let z = sg * 26; while (Math.abs(z) > 0.2 && sdf(x, y, z, 0) > 0) z -= sg * 0.25; let a = z, b = z + sg * 0.25; for (let i = 0; i < 12; i++) { const m = (a + b) / 2; if (sdf(x, y, m, 0) > 0) b = m; else a = m; } return (a + b) / 2; };
      const surfY = (x, z) => { let y = 100; while (y > 60 && sdf(x, y, z, 0) > 0) y -= 0.2; return y; };
      const fr = [[-10.2, -0.4], [-9.2, 2.6], [-5.6, 6.2], [-1.6, 12.0], [2.4, 19.0], [6.4, 26.0], [8.3, 28.9]], bk = [[8.3, 28.6], [6.6, 24], [1, 16], [-5, 8.5], [-9.2, 2.6], [-10.2, -0.4]], pts = [];
      fr.forEach(([x, y]) => pts.push(V3(x * 0.86, y + 57, surfZ(x * 0.86, y + 57, 1) + 0.22))); const tx = 8.6 * 0.86; [2.0, -2.0].forEach(z => pts.push(V3(tx, surfY(tx, z) + 0.22, z)));
      bk.forEach(([x, y]) => pts.push(V3(x * 0.86, y + 57, surfZ(x * 0.86, y + 57, -1) - 0.22)));
      const g = F.ao(F.tube(pts, 0.3, null, 160, null, 0, 8)), p = g.attributes.position, N = p.count, si = new Uint16Array(N * 4), sw = new Float32Array(N * 4);
      for (let i = 0; i < N; i++) { bodyW(p.getX(i), p.getY(i), p.getZ(i)); top4(si, sw, i); } g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
      parts.push({ geo: g, mat: skinned(meshes(OJ.torso)[1].material) }); } extra(OJ.neck, 'neck', true, 'band');
    SIDES.forEach(([S]) => { extra(OJ['arm' + S], 'arm' + S, true, 'band'); extra(OJ['foreArm' + S], 'foreArm' + S, true, 'band'); extra(OJ['leg' + S], 'leg' + S, true, 'band'); extra(OJ['shin' + S], 'shin' + S, true, 'band'); });
    // ---- nails (rigid on the last finger bones, one skinned mesh)
    { const ng = new THREE.SphereGeometry(1, 14, 10), P = [], Nn = [], Ix = [], SI = [], SW = [], nm = new THREE.Matrix4();
      const put = (bn, lx, ly, lz, sx, sy, sz) => { nm.compose(V3(lx, ly, lz), new THREE.Quaternion(), V3(sx, sy, sz)).premultiply(T.B[bn].matrixWorld); const g = ng.clone().applyMatrix4(nm), o = P.length / 3, p = g.attributes.position, n = g.attributes.normal;
        for (let i = 0; i < p.count; i++) { P.push(p.getX(i), p.getY(i), p.getZ(i)); Nn.push(n.getX(i), n.getY(i), n.getZ(i)); SI.push(bi(bn), 0, 0, 0); SW.push(1, 0, 0, 0); } const ix = g.index.array; for (let i = 0; i < ix.length; i++) Ix.push(ix[i] + o); };
      SIDES.forEach(([S, s]) => { for (let i = 0; i < 4; i++) { const r = FR[i] * FRK[3], l = FLEN[i] * FSEG[2]; put('f' + S + i + '2', s * r * 0.86, -l * 0.6, 0, 0.2, l * 0.36, r * 0.82); } put('t' + S + '2', s * TR[3] * 0.92, -TL[2] * 0.58, 0, 0.22, TL[2] * 0.36, TR[3] * 0.9); });
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(Nn, 3)); g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(SI, 4)); g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(SW, 4)); g.setIndex(Ix);
      parts.push({ geo: g, mat: new THREE.MeshStandardMaterial({ color: lin(C.nail || '#d9b9a8'), roughness: 0.4, skinning: true, envMapIntensity: 0.6 }) }); }
    const tris = parts.reduce((a, p) => a + p.geo.index.count / 3, 0);
    return { parts, inv, sdf, J, NB, ms: Math.round(performance.now() - t0), tris, shoes, skirtR };
  }

  // ---------------------------------------------------------------- the rig
  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _e = new THREE.Vector3(), _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion();
  const DOWN = new THREE.Vector3(0, -1, 0), EUL = new THREE.Euler();
  function make(baseChar, spec = {}) {
    const base = baseChar.make(THREE, { lin }), key = spec.key || baseChar.meta.id;
    const K = KITS[key] || (KITS[key] = buildKit(baseChar, base, spec));
    const sk = buildSk(), B = sk.B, root = sk.root; root.name = base.root.name;
    const skeleton = new THREE.Skeleton(sk.list, K.inv);
    const meshes = K.parts.map(pt => { const m = new THREE.SkinnedMesh(pt.geo, pt.mat); m.frustumCulled = false; m.castShadow = true; m.receiveShadow = true; root.add(m); m.bind(skeleton, ID4); return m; });
    // the head (face, hair, eyes, expressions) is the old rig's own
    while (base.joints.head.children.length) B.head.add(base.joints.head.children[0]);
    if (spec.keepNeck) base.joints.neck.children.filter(c => c !== base.joints.head && !c.isMesh).forEach(c => B.neck.add(c));
    const J = { hips: B.hips, torso: B.torso, neck: B.neck, head: B.head }, hands = {}, sockets = {};
    SIDES.forEach(([S, s]) => { ['arm', 'foreArm', 'hand', 'leg', 'shin', 'foot'].forEach(n => { J[n + S] = B[n + S]; });
      const so = new THREE.Group(); so.name = 'socket' + S; so.position.set(-s * 1.8, -4.4, 0.4); so.rotation.z = s * Math.PI / 2; B['hand' + S].add(so); sockets['hand' + S] = so;
      const fingers = [0, 1, 2, 3].map(i => [0, 1, 2].map(j => B['f' + S + i + j])), thumb = [0, 1, 2].map(j => B['t' + S + j]);
      const h = { root: B['hand' + S], fingers, thumb, k: 0.15, curl(k, spread = 0, thumbK = null) { h.k = k; fingerPose(B, S, s, k, spread, thumbK == null ? k : thumbK); } }; hands[S] = h; h.curl(0.15); });
    const sc = () => root.matrixWorld.elements[5] !== 0 ? Math.hypot(root.matrixWorld.elements[4], root.matrixWorld.elements[5], root.matrixWorld.elements[6]) : 1;
    // helper bones are solved whenever the rig's matrices are refreshed, so the skin is always consistent
    const umw = root.updateMatrixWorld; root.updateMatrixWorld = function (force) { solveHelpers(sk); drape(); umw.call(this, force); };

    // ---- leg IK in root space: ankle to 'tgt', knee toward 'pole' (default forward), optional foot orientation
    function legIK(S, tgt, pole, footQ) { const s = S === 'L' ? 1 : -1, hq = B.hips.quaternion, leg = B['leg' + S], shin = B['shin' + S], foot = B['foot' + S];
      _a.set(s * 5, 0, 0).applyQuaternion(hq).add(B.hips.position); _qi.copy(hq).invert();
      _b.copy(tgt).sub(_a).applyQuaternion(_qi); const D = cl(_b.length(), 9, (TH + SH) * 0.9995); _b.normalize();
      const a = Math.acos(cl((TH * TH + D * D - SH * SH) / (2 * TH * D), -1, 1));
      if (pole) _c.copy(pole).applyQuaternion(_qi); else _c.set(s * 0.1, 0, 1); _c.addScaledVector(_b, -_c.dot(_b)); if (_c.lengthSq() < 1e-6) _c.set(0, 0, 1).addScaledVector(_b, -_b.z); _c.normalize();
      _d.copy(_b).multiplyScalar(Math.cos(a)).addScaledVector(_c, Math.sin(a));                      // thigh direction
      _e.copy(_c).addScaledVector(_d, -_c.dot(_d)).normalize();                                       // Z: the knee's forward
      _a.copy(_d).negate(); _b.crossVectors(_a, _e); leg.quaternion.setFromRotationMatrix(_m.makeBasis(_b, _a, _e));
      const flex = Math.PI - Math.acos(cl((TH * TH + SH * SH - D * D) / (2 * TH * SH), -1, 1)); shin.rotation.set(flex, 0, 0);
      if (footQ) { _q1.copy(hq).multiply(leg.quaternion).multiply(shin.quaternion).invert(); foot.quaternion.copy(_q1).multiply(footQ); } }
    // ---- collision proxies (world space) and the push-out used by the IK and by the collision pass
    const invT = new THREE.Matrix4(), invH = new THREE.Matrix4(), headC = new THREE.Vector3(), caps = [];
    const skirtR = spec.skirtR || K.skirtR, thighPad = K.parts.some(p => p.cloth) ? 1.5 : 0.2;
    function proxyRefresh() { root.updateMatrixWorld(true); invT.copy(B.torso.matrixWorld).invert(); invH.copy(B.hips.matrixWorld).invert(); headC.set(0, 12.2, 1.6).applyMatrix4(B.head.matrixWorld);
      caps.length = 0; SIDES.forEach(([S]) => { caps.push({ a: B['leg' + S].getWorldPosition(new THREE.Vector3()), b: B['shin' + S].getWorldPosition(new THREE.Vector3()), r: 5.7 + thighPad, r2: 4.2 + thighPad, S: 'leg' }, { a: B['shin' + S].getWorldPosition(new THREE.Vector3()), b: B['foot' + S].getWorldPosition(new THREE.Vector3()), r: 3.5, S: 'leg' },
        { a: B['arm' + S].getWorldPosition(new THREE.Vector3()), b: B['foreArm' + S].getWorldPosition(new THREE.Vector3()), r: 3.3, S }, { a: B['foreArm' + S].getWorldPosition(new THREE.Vector3()), b: B['hand' + S].getWorldPosition(new THREE.Vector3()), r: 2.6, S }); }); }
    function ellCap(p, r, inv, mw, y0, y1, R, zs) { _a.copy(p).applyMatrix4(inv); const cy = cl(_a.y, y0, y1), dx = _a.x, dy = _a.y - cy, dz = _a.z * zs, L = Math.hypot(dx, dy, dz), lim = R + r; if (L >= lim) return false;
      const k = L > 1e-4 ? lim / L : 1; if (L <= 1e-4) { _a.z = lim / zs; } else { _a.x = dx * k; _a.y = cy + dy * k; _a.z = dz * k / zs; } p.copy(_a).applyMatrix4(mw); return true; }
    // push a world point (radius r, cm in rig units) out of the body; 'side' skips that arm's own capsules. Returns true if it moved.
    function pushOut(p, r, side, fresh) { if (!fresh) proxyRefresh(); const k = sc(); let moved = false;
      for (let it = 0; it < 2; it++) {
        _b.copy(p).sub(headC); let L = _b.length(), lim = (16.4 + r) * k; if (L < lim) { p.copy(headC).addScaledVector(L > 1e-4 ? _b.normalize() : _b.set(0, 0, 1), lim); moved = true; }
        if (ellCap(p, r, invT, B.torso.matrixWorld, 15, 24.5, 12.3, 1.3)) moved = true; if (ellCap(p, r, invT, B.torso.matrixWorld, 2, 12, 10.9, 1.27)) moved = true;
        if (ellCap(p, r, invH, B.hips.matrixWorld, -7, 3, skirtR, 1.22)) moved = true;
        for (let i = 0; i < caps.length; i++) { const c = caps[i]; if (c.S === side) continue; _c.copy(c.b).sub(c.a); const u = cl(_b.copy(p).sub(c.a).dot(_c) / _c.lengthSq()); _d.copy(c.a).addScaledVector(_c, u); _b.copy(p).sub(_d); L = _b.length(); lim = ((c.r2 != null ? c.r + (c.r2 - c.r) * u : c.r) + r) * k;
          if (L < lim) { p.copy(_d).addScaledVector(L > 1e-4 ? _b.normalize() : _b.set(0, 0, 1), lim); moved = true; } } }
      return moved; }
    function rotAbout(bone, pivotW, ptW, pushW, cap) { _a.copy(ptW).sub(pivotW); const L = _a.length(); _b.crossVectors(_a, pushW); const bl = _b.length(); if (bl < 1e-6 || L < 1e-3) return; _b.multiplyScalar(1 / bl);
      _q1.setFromAxisAngle(_b, Math.min(cap, pushW.length() / L * 1.05)); bone.parent.getWorldQuaternion(_q2); _q3.copy(_q2).invert(); bone.quaternion.premultiply(_q2).premultiply(_q1).premultiply(_q3); }
    const _p = new THREE.Vector3(), _p0 = new THREE.Vector3(), _piv = new THREE.Vector3(), _push = new THREE.Vector3();
    function avoid() { if (rig.collide === false) return; const k = sc();
      SIDES.forEach(([S]) => { const arm = B['arm' + S], fore = B['foreArm' + S], hand = B['hand' + S];
        for (let it = 0; it < 3; it++) { proxyRefresh(); let best = 0, hit = false; arm.getWorldPosition(_piv);
          [[fore, 0, 3.1], [fore, -FA * 0.5, 2.7], [hand, 0, 2.3]].forEach(([b, y, r]) => { _p0.set(0, y, 0).applyMatrix4(b.matrixWorld); _p.copy(_p0); if (pushOut(_p, r, S, true)) { const d = _p.distanceTo(_p0); if (d > best) { best = d; _push.copy(_p).sub(_p0); _e.copy(_p0); hit = true; } } });
          if (!hit || best < 0.02 * k) break; const pt = _e.clone(), pu = _push.clone(); rotAbout(arm, _piv, pt, pu, 0.5); }
        for (let it = 0; it < 2; it++) { proxyRefresh(); let best = 0, hit = false; hand.getWorldPosition(_piv);
          [[0, -4.4, 0, 1.5], [0, hands[S].k > 0.55 ? -7.5 : -10.5, 0, 1.0]].forEach(([x, y, z, r]) => { _p0.set(x, y, z).applyMatrix4(hand.matrixWorld); _p.copy(_p0); if (pushOut(_p, r, S, true)) { const d = _p.distanceTo(_p0); if (d > best) { best = d; _push.copy(_p).sub(_p0); _e.copy(_p0); hit = true; } } });
          if (!hit || best < 0.02 * k) break; const pt = _e.clone(), pu = _push.clone(); rotAbout(hand, _piv, pt, pu, 0.7); } }); }
    // ---- joint limits (a human's): knees and elbows never bend backwards or fold flat, the spine and neck stay in range
    const LIM = { knee: 2.8, elbow: 2.62, torsoX: [-0.6, 1.25], torsoY: 0.9, torsoZ: 0.5, neckX: [-0.5, 0.6], headX: [-0.85, 0.9], headY: 1.25, headZ: 0.6, footX: [-0.9, 1.1], wrist: 1.2 };
    function hinge(b, sign, max) { const q = b.quaternion; if (Math.abs(q.y) + Math.abs(q.z) < 1e-5) { const x = 2 * Math.atan2(q.x, q.w), xx = sign > 0 ? cl(x, 0, max) : cl(x, -max, 0); if (xx !== x) b.rotation.set(xx, 0, 0); return; }
      const th = 2 * Math.acos(cl(Math.abs(q.w), 0, 1)); if (th > max) { _q1.copy(q); if (_q1.w < 0) { _q1.x = -_q1.x; _q1.y = -_q1.y; _q1.z = -_q1.z; _q1.w = -_q1.w; } q.set(0, 0, 0, 1).slerp(_q1, max / th); } }
    const clampE = (b, X, Y, Z) => { const r = b.rotation; if (X) r.x = cl(r.x, X[0], X[1]); if (Y != null) r.y = cl(r.y, -Y, Y); if (Z != null) r.z = cl(r.z, -Z, Z); };
    function limits() { if (rig.limit === false) return; clampE(B.torso, LIM.torsoX, LIM.torsoY, LIM.torsoZ); clampE(B.neck, LIM.neckX, 0.6, 0.4); clampE(B.head, LIM.headX, LIM.headY, LIM.headZ);
      SIDES.forEach(([S]) => { hinge(B['shin' + S], 1, LIM.knee); hinge(B['foreArm' + S], -1, LIM.elbow);
        const hq = B['hand' + S].quaternion, sw = 2 * Math.acos(cl(Math.hypot(hq.w, hq.y), 0, 1)); if (sw > LIM.wrist) { _q1.set(0, hq.y, 0, hq.w).normalize(); _q2.copy(_q1).invert().premultiply(hq); /* swing = q * twist^-1 */ _q2.copy(hq).multiply(_q1.clone().invert()); _q3.set(0, 0, 0, 1).slerp(_q2, LIM.wrist / sw); hq.copy(_q3).multiply(_q1); } }); }
    // ---- foot planting: a foot never sinks below the ground, and flattens onto it as it comes down
    let groundY = null; const SOLE = [[0, -ANK, -3.6], [-1.5, -ANK, 8.6], [2.2, -ANK, 7.6], [0, -ANK, 12.6]];
    function plant(which = 'LR', gy) { root.updateMatrixWorld(true); const e = root.matrixWorld.elements, k = sc(); if (e[5] / k < 0.94) return;
      const g = gy != null ? gy : groundY != null ? groundY : e[13]; _m2.copy(root.matrixWorld).invert();
      which.split('').forEach(S => { const s = S === 'L' ? 1 : -1, foot = B['foot' + S], shin = B['shin' + S]; const a = foot.getWorldPosition(new THREE.Vector3()), c = (a.y - g) / k - ANK; if (c > 4.5) return;
        const kf = sm(4.0, 0.6, c), qf = foot.getWorldQuaternion(new THREE.Quaternion()); const fw = V3(0, 0, 1).applyQuaternion(qf); fw.y = 0; if (fw.lengthSq() < 0.05) fw.set(0, 0, 1).applyQuaternion(root.getWorldQuaternion(_q1)); fw.normalize();
        const up = V3(0, 1, 0), xx = new THREE.Vector3().crossVectors(up, fw), qFlat = new THREE.Quaternion().setFromRotationMatrix(_m.makeBasis(xx, up, fw)), qT = qf.clone().slerp(qFlat, kf);
        const setFoot = () => { shin.getWorldQuaternion(_q1); foot.quaternion.copy(_q1.invert()).multiply(qT); foot.updateMatrixWorld(true); }; setFoot();
        let low = 1e9; SOLE.forEach(p => { low = Math.min(low, _a.set(s * p[0], p[1], p[2]).applyMatrix4(foot.matrixWorld).y); }); const pen = g - low; if (pen < 0.02 * k) return;
        const knee = shin.getWorldPosition(new THREE.Vector3()), hip = B['leg' + S].getWorldPosition(new THREE.Vector3()), tgt = a.clone(); tgt.y += pen;
        const pole = knee.sub(hip.clone().lerp(a, 0.5)).transformDirection(_m2), rq = root.getWorldQuaternion(new THREE.Quaternion()).invert();
        legIK(S, tgt.applyMatrix4(_m2), pole.lengthSq() > 1e-4 ? pole : null, rq.multiply(qT)); B['leg' + S].updateMatrixWorld(true); }); }
    // ---- cloth: the skirt sags under a lifted thigh (static) and lags behind the hips and legs (a spring; resets on a seek)
    const cloth = { t: null, lag: [new THREE.Vector3(), new THREE.Vector3()], e: [new THREE.Vector3(), new THREE.Vector3()], v: [new THREE.Vector3(), new THREE.Vector3()], g: [new THREE.Vector3(), new THREE.Vector3()], hp: new THREE.Vector3(), ok: false };
    function clothStep(t) { root.updateMatrixWorld(true); const k = sc(), hp = B.hips.getWorldPosition(_p), dt = cloth.t == null ? 1 : t - cloth.t, live = cloth.ok && dt > 0 && dt < 0.12;
      SIDES.forEach(([S], n) => { const leg = B['leg' + S], g = _a.set(0, -1, 0).transformDirection(leg.matrixWorld), e = cloth.e[n], v = cloth.v[n];
        if (!live) { e.set(0, 0, 0); v.set(0, 0, 0); } else { e.addScaledVector(_b.copy(g).sub(cloth.g[n]), -0.9); e.addScaledVector(_b.copy(hp).sub(cloth.hp).multiplyScalar(1 / k), -0.016); e.y = 0;
          const W = 10, Z = 0.42; let rem = dt; while (rem > 1e-5) { const h = Math.min(rem, 1 / 90); v.addScaledVector(e, -W * W * h).multiplyScalar(Math.max(0, 1 - 2 * Z * W * h)); e.addScaledVector(v, h); rem -= h; } if (e.length() > 0.5) e.setLength(0.5); }
        cloth.g[n].copy(g);
        const el = _c.copy(e).transformDirection(_m.copy(leg.matrixWorld).invert()).multiplyScalar(e.length()); cloth.lag[n].set(el.x, 0.012 * Math.sin(t * 1.7 + n * 2.1), el.z); });
      cloth.hp.copy(hp); cloth.t = t; cloth.ok = true; }

    // the static drape is a pure function of the pose in hand (so a seek is always right); only the lag above carries state
    const _dr = new THREE.Vector3();
    function drape() { for (let n = 0; n < 2; n++) { const S = SIDES[n][0], leg = B['leg' + S], lg = cloth.lag[n], sx = S === 'L' ? -1 : 1;
        _dr.set(0, -1, 0).applyQuaternion(leg.quaternion); const abd = Math.asin(cl(-sx * _dr.x, -1, 1)); _dr.applyQuaternion(B.hips.quaternion); const f = sm(0.12, 0.95, 1 + _dr.y), air = lg.y;
        // a lifted thigh takes up the slack: the cloth in front settles onto the thigh, the cloth behind is drawn up under it, the sides come in;
        // a thigh swung out to the side leaves the cloth hanging toward the middle, it never stands up past the waist
        const kF = B['skF' + S], kB = B['skB' + S], dx = (spec.drapeIn == null ? 1.6 : spec.drapeIn) * f * sx, ab = sx * (spec.drapeAb == null ? 0.7 : spec.drapeAb) * abd;
        kF.position.set(dx, 0, -(spec.drapeF == null ? 3.9 : spec.drapeF) * f); kB.position.set(dx, 0, (spec.drapeB == null ? 4.4 : spec.drapeB) * f);
        kF.rotation.set(cl(-lg.z + air, -0.45, 0.5), 0, cl(lg.x, -0.4, 0.4) + ab); kB.rotation.set(cl(-lg.z * 1.2 - air + 0.05 * f, -0.45, 0.5), 0, cl(lg.x * 1.2, -0.4, 0.4) + ab); } }
    const ARMREST = 0.16;
    const rig = {
      hero: true, root, joints: J, sockets, hands, bones: B, skeleton, meshes, kit: K, base, limits: LIM, collide: true, limit: true, autoGround: true, watch: base.watch,
      setGlasses(v) { base.setGlasses && base.setGlasses(v); },
      mix(a, b, k) { base.mix(a, b, k); }, setExpression(n, k) { base.setExpression(n, k); }, setBlink(k) { base.setBlink(k); }, setWink(k) { base.setWink && base.setWink(k); }, setGaze(g) { base.setGaze(g); },
      grip(side, k, spread = 0, thumb = null) { hands[side].curl(k, spread, thumb); },
      point(side, k) { const s = side === 'L' ? 1 : -1; hands[side].curl(0.95 * k, 0, 0.75 * k); hands[side].k = 0.2; const f = hands[side].fingers[0]; f[0].rotation.set(-0.02, 0, -s * (0.12 + 0.06 * k)); f[1].rotation.z = -s * (0.08 + 0.07 * k); f[2].rotation.z = -s * 0.06; },
      // thumb and forefinger pinch (k 0..1), the other three fingers folded into the palm
      pinch(side, k = 1) { const s = side === 'L' ? 1 : -1, S = side; fingerPose(B, S, s, 0.92 * k, 0, 0); hands[S].k = 0.6;   // the pads of thumb and forefinger meet in front of the palm
        B['f' + S + '00'].rotation.set(-0.105 + 0.325 * k, 0, -s * (0.12 + 0.91 * k)); B['f' + S + '01'].rotation.set(0, 0, -s * (0.08 + 0.83 * k)); B['f' + S + '02'].rotation.set(0, 0, -s * (0.06 + 0.24 * k));
        B['t' + S + '0'].rotation.set(-0.55 + 0.64 * k, -s * 0.14 * k, -s * (0.45 + 0.04 * k)); B['t' + S + '1'].rotation.set(0, 0, -s * (0.15 + 0.2 * k)); B['t' + S + '2'].rotation.set(0, 0, -s * (0.1 + 0.31 * k)); },
      legIK, plant, pushOut, proxyRefresh, setGround(y) { groundY = y; },
      pose(clip, t) {
        clothStep(t);   // samples the pose the last frame ended on, before this frame resets it
        base.pose(clip, t);   // the face's own life: blinks, saccades
        J.hips.position.set(0, HIP, 0); J.hips.rotation.set(0, 0, 0); J.torso.rotation.set(0.08, 0, 0); J.neck.rotation.set(0.08, 0, 0); J.head.rotation.set(-0.12, 0, 0);
        SIDES.forEach(([S]) => ['arm', 'foreArm', 'hand', 'leg', 'shin', 'foot'].forEach(n => J[n + S].rotation.set(0, 0, 0)));
        const b = Math.sin(t * TAU / 3.6), w = Math.sin(t * TAU / 6.4), br = 0.5 + 0.5 * Math.sin(t * TAU / 3.6 - 0.6);
        B.chestH.scale.set(1 + 0.012 * br, 1 + 0.006 * br, 1 + 0.035 * br);   // breathing: the ribs swell forward
        if (clip === 'walk') {
          const p = t / (spec.walkPeriod || 0.62) * TAU, sw = Math.sin(p), stride = spec.stride || 19;
          J.hips.position.set(0.7 * sw, HIP - 1.75 + 0.75 * Math.cos(2 * p), 0); J.hips.rotation.set(0.02, 0.09 * sw, -0.03 * sw); J.torso.rotation.set(0.13, -0.2 * sw, 0.025 * sw); J.neck.rotation.set(0.05, 0.03 * sw, 0); J.head.rotation.set(-0.14, 0.03 * sw, 0);
          SIDES.forEach(([S, s], i) => { const u = ((p / TAU + (i ? 0.5 : 0) + 0.25) % 1 + 1) % 1; let z, y = ANK, pitch = 0;
            if (u < 0.56) { const v = u / 0.56; z = stride * (0.5 - v); pitch = -0.28 * sm(0.12, 0, v) + 0.5 * sm(0.72, 1, v); y += 2.6 * sm(0.72, 1, v); }
            else { const v = (u - 0.56) / 0.44, e = 0.5 - 0.5 * Math.cos(Math.PI * v); z = stride * (-0.5 + e); y += 2.6 * (1 - sm(0, 0.3, v)) + 4.2 * Math.sin(Math.PI * v); pitch = 0.5 * (1 - sm(0, 0.45, v)) - 0.28 * sm(0.6, 1, v); }
            legIK(S, _p.set(s * 5.9, y, z), _c.set(s * 0.22, 0, 1), _q2.setFromEuler(EUL.set(pitch, s * 0.14, 0)));
            const q = -Math.sin(p) * s; J['arm' + S].rotation.set(0.42 * q - 0.04, 0, s * 0.17); J['foreArm' + S].rotation.set(-0.38 - 0.22 * Math.max(0, -q), 0, 0); J['hand' + S].rotation.set(0, s * 0.3, 0); hands[S].curl(0.4, 0, 0.25); });
        } else {
          const sx = 0.8 * w; J.hips.position.set(sx, HIP - 0.25 - 0.1 * b, 0); J.hips.rotation.set(0, 0.025 * w, -0.014 * w); J.torso.rotation.set(0.08 + 0.012 * b, 0, 0.02 * w); J.neck.rotation.set(0.08, 0, -0.006 * w);
          SIDES.forEach(([S, s]) => { legIK(S, _p.set(s * 5.6, ANK, 0.4), null, _q2.setFromEuler(EUL.set(0, s * 0.16, 0)));
            J['arm' + S].rotation.set(0.03 + 0.012 * b, 0, s * (ARMREST + 0.006 * b)); J['foreArm' + S].rotation.set(-0.24, 0, 0); J['hand' + S].rotation.set(0, s * 0.3, s * 0.05); hands[S].curl(0.24, 0.15, 0.1); });
          J.head.rotation.set(-0.06 + 0.02 * b, 0.1 * Math.sin(t * TAU / 5.6), 0.04 * Math.sin(t * TAU / 7.3));
        }
        rig.update();
      },
      update() { base.update && base.update(); limits(); avoid(); if (rig.autoGround) plant(); },
    };
    bindPose(sk); rig.setExpression('neutral', 1); rig.pose('idle', 0); cloth.ok = false; root.updateMatrixWorld(true);
    return rig;
  }
  function register(id, baseId, spec = {}) { const base = window.CHARACTERS[baseId]; window.CHARACTERS[id] = { meta: Object.assign({}, base.meta, { id, rig: 'hero' }), C: base.C, make: (T, o) => make(base, Object.assign({ key: id }, spec)) }; return window.CHARACTERS[id]; }
  API = { make, register, buildSk, bindPose, solveHelpers, nets, KITS, HIP, UA, FA, TH, SH, ANK };
  return API;
};
})();
