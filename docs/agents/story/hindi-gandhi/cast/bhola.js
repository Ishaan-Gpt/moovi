/* Character H, "Bhola": a village boy of about ten who runs to the ashram with an empty matka. Built from Munni's rig
   (bacchi.js), a different child: a leaner face, sun-darkened skin, short cropped black hair with a cowlick, a worn
   off-white cotton kurta to mid-thigh with short sleeves and a patch, brown shorts, bare dusty feet; taller than Munni.
   Expressions: neutral, worried (brows up and in), cry, smile, laugh. Clips: idle. API as bacchi.js. */
(function () {
  const TAU = Math.PI * 2;
  const ok = (L, C, h) => window.CASTKIT.oklch(L, C, h);
  const C_ = {
    skin: ok(0.56, 0.07, 52), skinLt: ok(0.63, 0.066, 58), skinDk: ok(0.46, 0.07, 46), sss: ok(0.52, 0.15, 28), lid: ok(0.5, 0.068, 46),
    hair: ok(0.22, 0.015, 60), hairDk: ok(0.15, 0.012, 60), hairLt: ok(0.34, 0.02, 64),
    frock: ok(0.88, 0.022, 82), frockDk: ok(0.79, 0.03, 76), frockLt: ok(0.93, 0.016, 88), trim: ok(0.82, 0.03, 78), ribbon: ok(0.5, 0.05, 52), shorts: ok(0.42, 0.05, 50), patch: ok(0.74, 0.04, 70), dust: ok(0.62, 0.05, 60),
    eyeW: ok(0.94, 0.012, 85), eyeW2: ok(0.84, 0.02, 70), iris0: ok(0.22, 0.03, 50), iris1: ok(0.32, 0.05, 55), iris2: ok(0.44, 0.065, 66), pupil: ok(0.12, 0.012, 50),
    lip: ok(0.5, 0.085, 22), lipDk: ok(0.4, 0.08, 22), mouthIn: ok(0.3, 0.07, 20), tongue: ok(0.64, 0.12, 14), teeth: ok(0.94, 0.02, 88),
    blush: ok(0.56, 0.1, 22), line: ok(0.48, 0.06, 40), lash: ok(0.18, 0.012, 60), nail: ok(0.78, 0.04, 30), brow: ok(0.25, 0.015, 60), tear: ok(0.95, 0.02, 230),
  };
  const HEAD = { jawMass: 0.55, rx: 13.2, ry: 14.4, rz: 13.6, jaw: 0.3, chin: 0.6, cheek: 0.8, nose: 0.78, brow: 0.45, eyeX: 4.8, eyeY: -1.2, socket: 0.8, lips: 0.7, face: [-12.5, 12.5, -18.5, 9.5] };
  const ER = 3.05;
  let K = null, HEADF = null;
  function buildKit(THREE, lin) {
    const F = window.CASTKIT(THREE, lin), { sm, cl, lerp, gss, vnoise, rgba, tile, tex, weld, ao, lathe, limb, tube } = F;
    const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
    HEADF = F.headShape(HEAD); const H = F.head(HEAD);
    const ny = HEAD.eyeY - 5.1 * HEAD.nose, my = ny - 3.5, eY = HEAD.eyeY;
    function paintFace(g, mouth) {
      const cry = mouth === 'cry' || mouth === 'sniff';
      { const r = g.createRadialGradient(0, ny - 1.9, 0, 0, ny - 1.9, 3.2); r.addColorStop(0, rgba(C_.skinLt, 0.55)); r.addColorStop(1, rgba(C_.skinLt, 0)); g.fillStyle = r; g.fillRect(-4, ny - 5, 8, 6); }   // lift the shade under the nose (it read as a moustache)
      [-1, 1].forEach(s => { const x = s * 7.2, y = my + 3.6, r = g.createRadialGradient(x, y, 0, x, y, 4.4); r.addColorStop(0, rgba(C_.blush, cry ? 0.5 : 0.32)); r.addColorStop(1, rgba(C_.blush, 0)); g.fillStyle = r; g.fillRect(x - 5, y - 5, 10, 10); });
      if (cry) { const r = g.createRadialGradient(0, ny, 0, 0, ny, 2.4); r.addColorStop(0, rgba(C_.blush, 0.4)); r.addColorStop(1, rgba(C_.blush, 0)); g.fillStyle = r; g.fillRect(-3, ny - 3, 6, 6);
        [-1, 1].forEach(s => { g.fillStyle = rgba(C_.tear, 0.55); g.beginPath(); g.moveTo(s * (HEAD.eyeX - 0.8), eY - 2.6); g.bezierCurveTo(s * (HEAD.eyeX + 0.3), eY - 5, s * (HEAD.eyeX + 0.6), eY - 7, s * (HEAD.eyeX + 0.2), eY - 8.4);
          g.lineTo(s * (HEAD.eyeX - 0.4), eY - 8.2); g.bezierCurveTo(s * (HEAD.eyeX - 0.1), eY - 6.6, s * (HEAD.eyeX - 0.4), eY - 4.6, s * (HEAD.eyeX - 1.2), eY - 2.7); g.fill();
          g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.arc(s * (HEAD.eyeX + 0.05), eY - 8.0, 0.32, 0, TAU); g.fill(); }); }
      const line = (fn, w, col) => { g.beginPath(); fn(); g.strokeStyle = col || C_.lipDk; g.lineWidth = w; g.stroke(); };
      const open = (pathFn, teeth, tongue) => { g.save(); g.beginPath(); pathFn(); g.closePath(); g.fillStyle = C_.mouthIn; g.fill(); g.clip();
        if (teeth) { g.fillStyle = C_.teeth; g.fillRect(-5, teeth[0], 10, teeth[1] - teeth[0]); }
        if (tongue) { g.fillStyle = C_.tongue; g.beginPath(); g.ellipse(tongue[0], tongue[1], tongue[2], tongue[3], 0, 0, TAU); g.fill(); }
        g.restore(); g.beginPath(); pathFn(); g.closePath(); g.strokeStyle = C_.lip; g.lineWidth = 0.45; g.stroke(); };
      const lips = (w) => { g.fillStyle = rgba(C_.lip, 0.28); g.beginPath(); g.moveTo(-w, my); g.bezierCurveTo(-w * 0.5, my + 0.9, -0.4, my + 0.8, 0, my + 0.55); g.bezierCurveTo(0.4, my + 0.8, w * 0.5, my + 0.9, w, my); g.bezierCurveTo(w * 0.5, my - 1.0, -w * 0.5, my - 1.0, -w, my); g.closePath(); g.fill(); };
      if (mouth === 'neutral') { lips(2.2); line(() => { g.moveTo(-2.2, my); g.bezierCurveTo(-1, my - 0.2, 1, my - 0.2, 2.2, my); }, 0.28); }
      else if (mouth === 'smile') { lips(2.6); line(() => { g.moveTo(-2.8, my + 0.7); g.bezierCurveTo(-1.3, my - 0.8, 1.3, my - 0.8, 2.8, my + 0.7); }, 0.3); }
      else if (mouth === 'laugh') open(() => { g.moveTo(-3.3, my + 0.8); g.bezierCurveTo(-1.5, my + 0.2, 1.5, my + 0.2, 3.3, my + 0.8); g.bezierCurveTo(2.6, my - 3.6, -2.6, my - 3.6, -3.3, my + 0.8); }, [my - 0.4, my + 0.6], [0, my - 2.7, 1.8, 0.9]);
      else if (mouth === 'cry') open(() => { g.moveTo(-3.0, my - 1.6); g.bezierCurveTo(-1.6, my + 0.6, 1.6, my + 0.6, 3.0, my - 1.6); g.bezierCurveTo(1.8, my - 3.9, -1.8, my - 3.9, -3.0, my - 1.6); }, [my - 0.3, my + 0.4], [0, my - 3.0, 1.6, 0.8]);
      else if (mouth === 'sniff' || mouth === 'pout') { lips(1.9); line(() => { g.moveTo(-2.1, my - 0.8); g.bezierCurveTo(-1, my + 0.3, 1, my + 0.3, 2.1, my - 0.8); }, 0.32); }
    }
    const FACE = {}; ['neutral', 'smile', 'laugh', 'cry', 'sniff', 'pout'].forEach(n => FACE[n] = F.faceMat(F.faceTex(HEAD, g => paintFace(g, n))));
    const G = { head: H.geo, faceOv: H.ov, ear: F.earGeo(6.6) };
    // hair: centre part, smooth to the nape, a hairline at the forehead
    { const geo = new THREE.SphereGeometry(1, 180, 130), p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) { const dx = p.getX(i), dy = p.getY(i), dz = p.getZ(i), th = Math.acos(cl(dy, -1, 1)), a = Math.atan2(dx, dz), aa = Math.abs(a);
        const lim = aa < 0.9 ? lerp(0.9, 1.08, aa / 0.9) : aa < 1.7 ? lerp(1.0, 1.42, (aa - 0.9) / 0.8) : lerp(1.42, 1.95, sm(1.7, 3.1, aa));
        const c = sm(lim + 0.05, lim - 0.05, th), part = -0.5 * Math.exp(-((a - 2.6) ** 2 + (th - 0.35) ** 2 * 4) / 0.02);
        const comb = 1 - Math.pow(Math.abs(Math.sin(a * 20 + 0.2 * Math.sin(th * 4))), 0.4);
        const t = c * (0.75 + 0.3 * sm(-0.2, 0.9, dy) - 0.12 * comb + 0.15 * (vnoise(a * 9 + 3, th * 9, 17, 5) - 0.5)) - part * c - (1 - c) * 1.1;
        const v = HEADF(dx, dy, dz), L = Math.hypot(v[0], v[1], v[2]); p.setXYZ(i, v[0] + v[0] / L * t, v[1] + v[1] / L * t, v[2] + v[2] / L * t); }
      weld(geo); ao(geo, (x, y, z) => 0.75 + 0.25 * sm(-4, 12, y)); G.hair = geo; }
    // two plaits from behind the ears down over the shoulders, ribbon bows at the ends
    G.plait = (() => { const pts = [V3(0, 0, 0), V3(0.6, -4, 1.0), V3(1.0, -9, 2.6), V3(1.1, -14, 4.0), V3(0.8, -18, 4.6)];
      const geo = tube(pts, 1.5, u => 1 - 0.45 * u, 80, null, 0, 14), p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) { const y = p.getY(i), x = p.getX(i), z = p.getZ(i); const w = 1 + 0.18 * Math.sin(y * 2.2 + Math.atan2(z, x) * 2); p.setXYZ(i, x * w, y, z * w); }
      geo.computeVertexNormals(); return ao(geo, (x, y) => 0.8 + 0.2 * Math.abs(Math.sin(y * 1.1))); })();
    G.bow = (() => { const g = new THREE.SphereGeometry(1, 20, 12); g.scale(1.9, 1.1, 0.7); return ao(weld(g)); })();
    G.brow = [1, -1].map(s => { const pts = [[2.4, 4.3], [3.9, 4.9], [5.5, 5.0], [6.9, 4.5]].map(([x, y]) => V3(s * x, eY + y, H.surf(s * x, eY + y) + 0.1));
      const cen = pts[1].clone(), n = H.surfN(cen.x, cen.y); const geo = tube(pts, 0.3, u => 1 - 0.4 * u, 24, n, 0.6); geo.translate(-cen.x, -cen.y, -cen.z); ao(geo); geo.userData.cen = cen; return geo; });
    G.neck = F.neckGeo(4.2, 4.0, 7);
    // frock: a fitted bodice and a gathered skirt to the knee, puff sleeves, a white collar
    G.bodice = ao(lathe([[0.01, -1], [9.6, -1], [9.9, 4], [10.4, 10], [10.0, 14], [7.6, 16.4], [4.2, 17.2], [0.01, 17.4]], 48).scale(1, 1, 0.78));
    { const N = 96, M_ = 40, Hh = 8, pos = [], uv = [], idx = [];
      for (let j = 0; j <= M_; j++) { const v = j / M_, y = -v * Hh; for (let i = 0; i <= N; i++) { const u = i / N, a = u * TAU; let r = lerp(9.9, 10.9, Math.pow(v, 0.8)) + 0.12 * Math.sin(a * 9 + v * 2) + 0.35 * v * Math.sin(a * 3 + 1.3);
        pos.push(Math.sin(a) * r, y, Math.cos(a) * r * 0.86); uv.push(u * 4, 1 - v); } }
      for (let j = 0; j < M_; j++) for (let i = 0; i < N; i++) { const a = j * (N + 1) + i, b = a + N + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
      weld(g); ao(g, (x, y) => 0.76 + 0.24 * sm(-1, -10, y)); G.skirt = g; }
    G.hem = ao(new THREE.TorusGeometry(11.0, 0.4, 8, 96).rotateX(Math.PI / 2)); G.shorts = ao(limb(4.3, 3.9, 9.5, 0.2));
    G.collar = ao(new THREE.TorusGeometry(4.6, 0.5, 10, 40, Math.PI * 1.1).rotateX(Math.PI / 2 - 0.25).rotateY(Math.PI * 0.95));
    G.puff = ao(limb(2.95, 2.75, 6.5, 0.1));
    G.upper = ao(limb(2.6, 2.3, 11)); G.fore = ao(limb(2.3, 1.8, 10, 0.2));
    G.leg = ao(limb(3.2, 2.4, 15)); G.shin = ao(limb(2.6, 1.9, 14, 0.4));
    G.foot = (() => { const g = new THREE.SphereGeometry(1, 28, 18), q = g.attributes.position; for (let i = 0; i < q.count; i++) q.setXYZ(i, q.getX(i) * 2.6, Math.max(q.getY(i), -0.5) * 2.0, q.getZ(i) * 5.4 + 2.8); return ao(weld(g)); })();
    const std = (o) => new THREE.MeshStandardMaterial(Object.assign({ vertexColors: true, envMapIntensity: 0.6 }, o));
    const [hc, hb] = tile(256, [C_.hairDk, C_.hair, C_.hairLt], (x, y) => { const s = vnoise(x / 1.4, y / 30, 81, 182.9); return [(s - 0.5) * 0.9, 0.4 + (s - 0.5) * 0.8]; });
    const [fc, fb] = tile(256, [C_.frockDk, C_.frock, C_.frockLt], (x, y) => { const w = Math.sin(x / 256 * TAU * 64) * Math.sin(y / 256 * TAU * 64) * 0.1, sl = vnoise(x / 3, y / 40, 52, 40.1) - 0.5, n = vnoise(x / 20, y / 20, 51, 12.8) - 0.5; return [w + n * 0.35 + sl * 0.3, 0.5 + w * 2 + sl * 0.4]; });
    const cotton = (rx, ry) => { const m = new THREE.MeshPhysicalMaterial({ vertexColors: true, map: tex(fc, true, rx, ry), bumpMap: tex(fb, false, rx, ry), bumpScale: 0.04, roughness: 0.92, envMapIntensity: 0.45 }); if ('sheen' in m) m.sheen = new THREE.Color(lin(C_.frockLt)).multiplyScalar(0.3); return m; };
    const M = {
      skin: F.skinMaterial({ dk: C_.skinDk, base: C_.skin, lt: C_.skinLt, sss: C_.sss }), lid: F.skinMaterial({ dk: C_.skinDk, base: C_.lid, lt: C_.skin, sss: C_.sss }, { bump: 0.004 }), nail: std({ color: lin(C_.nail), roughness: 0.4 }),
      hair: std({ map: tex(hc, true, 4, 1), bumpMap: tex(hb, false, 4, 1), bumpScale: 0.08, roughness: 0.5, envMapIntensity: 0.7 }),
      plait: std({ map: tex(hc, true, 1, 3), bumpMap: tex(hb, false, 1, 3), bumpScale: 0.1, roughness: 0.5, envMapIntensity: 0.7 }),
      brow: std({ color: lin(C_.brow), roughness: 0.8 }), lash: std({ color: lin(C_.lash), roughness: 0.6 }),
      eye: new THREE.MeshPhysicalMaterial({ map: F.eyeTex({ white: C_.eyeW, white2: C_.eyeW2, iris0: C_.iris0, iris1: C_.iris1, iris2: C_.iris2, pupil: C_.pupil }, 0.66, 0.3), roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.0 }),
      frock: cotton(3, 2), bodice: cotton(3, 1), trim: std({ color: lin(C_.trim), roughness: 0.9 }), ribbon: std({ color: lin(C_.ribbon), roughness: 0.5 }), shorts: new THREE.MeshStandardMaterial({ color: lin(C_.shorts), roughness: 0.95 }), patch: new THREE.MeshStandardMaterial({ color: lin(C_.patch), roughness: 0.95, side: THREE.DoubleSide }),
    };
    return { F, G, M, FACE, H, hand: F.handBuilder({ size: 0.72, r: 1.12 }) };
  }
  const EXP = {
    neutral: { up: 0.24, tilt: 0, low: 0.12, size: 1, by: 0, bin: 0.04, mouth: 'neutral' },
    smile: { up: 0.3, tilt: 0.05, low: 0.45, size: 1, by: 0.4, bin: 0.1, mouth: 'smile' },
    laugh: { up: 0.5, tilt: 0.12, low: 0.95, size: 1.02, by: 1.1, bin: 0.2, mouth: 'laugh' },
    cry: { up: 0.86, tilt: -0.1, low: 0.8, size: 0.96, by: 0.6, bin: 0.42, mouth: 'cry' },
    sniff: { up: 0.42, tilt: -0.1, low: 0.4, size: 1.0, by: 0.7, bin: 0.4, mouth: 'sniff' },
    worried: { up: 0.2, tilt: -0.12, low: 0.2, size: 1.04, by: 0.9, bin: 0.46, mouth: 'pout' },
  };
  const ALIAS = { happy: 'smile', grin: 'laugh', sad: 'sniff', scared: 'worried' };
  window.CHARACTERS = window.CHARACTERS || {};
  window.CHARACTERS.H = {
    meta: { id: 'H', name: 'Bhola', idea: 'A village boy of about ten: short cropped hair, a worn off-white kurta, brown shorts, bare dusty feet.', height_cm: 104, headSize_cm: 28, faceY: 10 },
    C: C_,
    make(THREE, { lin }) {
      if (!K) K = buildKit(THREE, lin);
      const { F, G, M, FACE, H } = K;
      const root = new THREE.Group(); root.name = 'Bhola'; const body = new THREE.Group(); body.scale.setScalar(1.2); root.add(body); const J = {};
      const grp = (name, parent, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.name = name; g.position.set(x, y, z); parent.add(g); return g; };
      const mesh = (geo, mat, parent, cast = true) => { const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = true; parent.add(m); return m; };
      const HIP = 31;
      J.hips = grp('hips', body, 0, HIP, 0); mesh(G.skirt, M.frock, J.hips); const hem = mesh(G.hem, M.trim, J.hips); hem.position.y = -7.9; hem.scale.set(1, 1, 0.86);
      const pch = mesh(new THREE.PlaneGeometry(3.4, 3.0), M.patch, J.hips, false); pch.position.set(-5.2, -3.5, 9.4); pch.rotation.set(-0.08, -0.3, 0.1);
      J.torso = grp('torso', J.hips, 0, 0, 0); mesh(G.bodice, M.bodice, J.torso); const col = mesh(G.collar, M.trim, J.torso); col.position.set(0, 16.2, 0.6); col.scale.set(1, 1, 0.8);
      J.neck = grp('neck', J.torso, 0, 16.6, 0.2); mesh(G.neck, M.skin, J.neck).position.set(0, -2, -0.4);
      J.head = grp('head', J.neck, 0, 3.6, 0.4);
      const headG = grp('headShape', J.head, 0, 11.4, 1.0);
      mesh(G.head, M.skin, headG, false); const face = mesh(G.faceOv, FACE.neutral, headG, false), face2 = mesh(G.faceOv, FACE.smile, headG, false); face2.visible = false; face2.renderOrder = 1; mesh(G.hair, M.hair, headG);
      [1, -1].forEach(s => { const y = HEAD.eyeY - 2.2, z = -1.4, x = H.side(s, y, z); const e = mesh(G.ear, M.skin, headG); e.position.set(x - s * 0.4, y, z); e.scale.x = s; e.rotation.set(0.05, -s * 0.3, -s * 0.05);
      });
      const eyes = [1, -1].map(s => { const x = s * HEAD.eyeX, y = HEAD.eyeY, z = H.surf(x, y) - ER * 0.8 * 0.62;
        const e = F.eye(ER, M, { sy: 1.06, sz: 0.8, lash: 0.26 }); e.g.position.set(x, y, z); e.g.rotation.set(0.02, s * 0.08, 0); headG.add(e.g); e.s = s; return e; });
      const brows = [1, -1].map((s, i) => { const m = mesh(G.brow[i], M.brow, headG, false); const c = G.brow[i].userData.cen; m.position.copy(c); return { s, m, c }; });
      const hands = {};
      const mkArm = (s, S) => { J['arm' + S] = grp('arm' + S, J.torso, s * 10.6, 14.2, -0.3); mesh(G.puff, M.bodice, J['arm' + S]).position.y = 0.6; mesh(G.upper, M.skin, J['arm' + S]);
        J['foreArm' + S] = grp('foreArm' + S, J['arm' + S], 0, -11, 0); mesh(G.fore, M.skin, J['foreArm' + S]);
        const hd = J['hand' + S] = grp('hand' + S, J['foreArm' + S], 0, -10.4, 0); const h = K.hand(s, M); hd.add(h.root); hands[S] = h;
        const sock = grp('socket' + S, hd, -s * 1.4, -3.4, 0.3); sock.rotation.z = s * Math.PI / 2; return { sock }; };
      const armL = mkArm(1, 'L'), armR = mkArm(-1, 'R');
      ['L', 'R'].forEach((S, i) => { const s = i ? -1 : 1; J['leg' + S] = grp('leg' + S, J.hips, s * 4.2, 0, 0); mesh(G.leg, M.skin, J['leg' + S]); mesh(G.shorts, M.shorts, J['leg' + S]).position.y = 0.5;
        J['shin' + S] = grp('shin' + S, J['leg' + S], 0, -15, 0); mesh(G.shin, M.skin, J['shin' + S]);
        J['foot' + S] = grp('foot' + S, J['shin' + S], 0, -15.2, 0); mesh(G.foot, M.skin, J['foot' + S]).position.y = -1.4; });
      let E = Object.assign({}, EXP.neutral), blink = 0, autoBlink = 0, gaze = [0, 0], gazeOv = null;
      function applyFace() { const b = Math.max(blink, autoBlink);
        eyes.forEach(e => { e.sc.scale.set(E.size, 1.06 * E.size, 0.8); e.set(F.lerp(E.up, 1, b), Math.max(E.low, 0.8 * b), E.tilt * (1 - b), gazeOv || gaze, e.s); });
        brows.forEach(br => { const y = br.c.y + E.by - 0.2 * b; br.m.position.set(br.c.x, y, br.c.z + H.surf(br.c.x, y) - H.surf(br.c.x, br.c.y)); br.m.rotation.set(0, 0, -br.s * E.bin); });
        if (E.mouthB && E.mk > 0.001 && E.mk < 0.999 && E.mouthB !== E.mouth) { face.material = FACE[E.mouth]; face2.material = FACE[E.mouthB]; const kk = F.sm(0.3, 0.7, E.mk); face.material.opacity = 1 - kk; face2.material.opacity = kk; face2.visible = kk > 0.001; }
        else { const m = E.mk >= 0.999 && E.mouthB ? E.mouthB : E.mouth; face.material = FACE[m] || FACE.neutral; face.material.opacity = 1; face2.visible = false; } }
      const rig = {
        root, joints: J, sockets: { handL: armL.sock, handR: armR.sock }, hands,

        mix(a, b, k) { a = ALIAS[a] || a; b = ALIAS[b] || b; const A = EXP[a] || EXP.neutral, B = EXP[b] || EXP.neutral; k = F.cl(k); E = {}; for (const key in A) E[key] = typeof A[key] === 'number' ? F.lerp(A[key], B[key], k) : A[key]; E.mouthB = B.mouth; E.mk = k; applyFace(); },
        setExpression(name, k = 1) { name = ALIAS[name] || name; const T = EXP[name] || EXP.neutral, N = EXP.neutral; E = {}; for (const key in N) E[key] = typeof N[key] === 'number' ? F.lerp(N[key], T[key], k) : (k >= 0.5 ? T[key] : N[key]); applyFace(); },
        setBlink(k) { blink = F.cl(k); applyFace(); }, setGaze(g) { gazeOv = g; applyFace(); },
        grip(side, k, spread = 0, thumb = null) { hands[side].curl(k, spread, thumb); },
        pose(clip, t) {
          J.hips.position.set(0, HIP, 0); J.hips.rotation.set(0, 0, 0); J.torso.rotation.set(0, 0, 0); J.neck.rotation.set(0, 0, 0); J.head.rotation.set(-0.05, 0, 0);
          ['L', 'R'].forEach(S => ['arm', 'foreArm', 'hand', 'leg', 'shin', 'foot'].forEach(n => J[n + S].rotation.set(0, 0, 0)));
          autoBlink = 0; gaze = [0, 0]; gazeOv = null;
          const b = Math.sin(t * TAU / 2.8), w = Math.sin(t * TAU / 5);
          J.torso.rotation.x = 0.01 * b; J.hips.rotation.z = 0.015 * w;
          ['L', 'R'].forEach((S, i) => { const s = i ? -1 : 1; J['arm' + S].rotation.set(0.02, 0, s * 0.16); J['foreArm' + S].rotation.set(-0.25, 0, 0); J['hand' + S].rotation.set(0, s * 0.3, 0); hands[S].curl(0.3); });
          J.head.rotation.set(-0.05 + 0.02 * b, 0.12 * Math.sin(t * TAU / 4.6), 0.05 * Math.sin(t * TAU / 6));
          const u = ((t - 0.9) % 3.1 + 3.1) % 3.1; autoBlink = u < 0.15 ? Math.sin(u / 0.15 * Math.PI) : 0;
          applyFace(); },
        update: () => applyFace(),
      };
      rig.setExpression('neutral', 1); rig.pose('idle', 0); return rig;
    },
  };
})();
