/* Character K, "Bakri": Bapu's goat. A small, soft, stylised nanny goat in the family's matte look: a cream coat with a
   warm tan saddle and face blaze, long floppy ears, two short swept-back horns, a little beard, knobbly knees, dark
   hooves, a flicking tail, and goat eyes with wide horizontal pupils (the stare). Joints: neck, head, jaw, ears, tail,
   four legs. pose(clip, t): 'idle' (chewing, ear flicks), 'stare' (head still, the slow judging blink), 'bleat'.
   setGaze([yaw, pitch]) turns the head; lookAt(worldVec3) aims the head at a point. */
(function () {
  const TAU = Math.PI * 2;
  const ok = (L, C, h) => window.CASTKIT.oklch(L, C, h);
  const C_ = { coat: ok(0.93, 0.02, 85), coatDk: ok(0.82, 0.03, 75), coatLt: ok(0.97, 0.012, 90), tan: ok(0.7, 0.08, 62), tanDk: ok(0.58, 0.08, 55),
    horn: ok(0.68, 0.035, 75), hoof: ok(0.3, 0.02, 50), nose: ok(0.62, 0.06, 20), eye: ok(0.74, 0.13, 78), pupil: ok(0.12, 0.01, 60), inner: ok(0.72, 0.07, 22) };
  let K = null;
  function buildKit(THREE, lin) {
    const F = window.CASTKIT(THREE, lin), { sm, cl, lerp, gss, vnoise, tile, tex, weld, ao, limb, tube } = F;
    const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
    // a body from a deformed sphere with vertex colours: cream with a tan saddle
    const blob = (rx, ry, rz, def, colF, seg = 64) => { const g = new THREE.SphereGeometry(1, seg, seg * 0.66 | 0), p = g.attributes.position, c = new Float32Array(p.count * 3);
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const d = def ? def(x, y, z) : [x, y, z]; p.setXYZ(i, d[0] * rx, d[1] * ry, d[2] * rz);
        const col = colF ? colF(x, y, z) : lin(C_.coat); c.set([col.r, col.g, col.b], i * 3); }
      g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.computeVertexNormals(); return g; };
    const mixc = (a, b, k) => lin(a).clone().lerp(lin(b), cl(k));
    const fur = (x, y, z) => vnoise(x * 9 + 20, y * 9 + z * 5, 3, 1000) * 0.5 + 0.5;
    const G = {};
    G.body = blob(12.5, 13.5, 29, (x, y, z) => [x * (1 - 0.12 * sm(0.2, 1, y)), y * (1 + 0.08 * sm(-0.1, -1, y)) + 0.08 * Math.sin(z * 2.2) * sm(0.5, 1, y), z],
      (x, y, z) => { const sad = sm(0.15, 0.55, y) * sm(0.85, 0.2, Math.abs(z + 0.1)); const ao_ = 0.78 + 0.22 * sm(-0.9, 0.3, y); return mixc(C_.coat, C_.tan, sad * 0.9).multiplyScalar(ao_ * (0.95 + 0.08 * fur(x, y, z))); });
    G.neck = (() => { const g = tube([V3(0, 0, 0), V3(0, 7, 4), V3(0, 13, 9)], 8.2, u => 1 - 0.28 * u, 30, null, 0, 24), p = g.attributes.position, c = new Float32Array(p.count * 3);
      for (let i = 0; i < p.count; i++) { const y = p.getY(i), z = p.getZ(i); const col = mixc(C_.coat, C_.tan, sm(2, 8, y) * sm(-2, 4, -z + y * 0.2) * 0.5).multiplyScalar(0.85 + 0.15 * sm(-4, 6, y)); c.set([col.r, col.g, col.b], i * 3); }
      g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g; })();
    G.head = blob(6.2, 7.0, 12.0, (x, y, z) => { const sn = sm(0.1, 1, z); return [x * (1 - 0.32 * sn), y * (1 - 0.3 * sn) - 0.22 * sn * sm(-0.2, 1, y) + 0.12 * sm(0.4, 1, y) * (1 - sn), z + 0.08 * sm(0.5, 1, y) * (1 - sn)]; },
      (x, y, z) => { const blaze = Math.exp(-(x * x) / 0.06) * sm(-0.2, 0.6, y) * sm(-0.6, 0.6, z); const nose = sm(0.82, 0.98, z); return mixc(mixc(C_.coat, C_.tan, 0.6 * sm(0.45, 0.95, y) * sm(0.3, -0.4, z)), C_.nose, nose * 0.7).multiplyScalar(0.84 + 0.16 * sm(-1, 0.5, y)); });
    G.jaw = blob(3.3, 1.7, 6.2, null, () => mixc(C_.coat, C_.tan, 0.2).multiplyScalar(0.85));
    G.ear = blob(2.0, 0.7, 6.4, (x, y, z) => [x * (1 - 0.3 * sm(0.2, 1, z)), y + 0.4 * x * x, z], (x, y, z) => y > 0 ? mixc(C_.tan, C_.coat, 0.3) : mixc(C_.inner, C_.coat, 0.4), 32);
    G.horn = tube([V3(0, 0, 0), V3(0, 2.2, -1.8), V3(0, 3.0, -4.2), V3(0, 2.6, -6.6)], 0.8, u => 1 - 0.8 * u, 24, null, 0, 10);
    G.beard = (() => { const g = new THREE.ConeGeometry(0.9, 3.2, 12, 4).translate(0, -1.6, 0).rotateX(0.25); return g; })();
    G.eye = new THREE.SphereGeometry(1.45, 32, 20);
    G.lid = new THREE.SphereGeometry(1.55, 32, 12, 0, TAU, 0, Math.PI / 2);
    G.leg = ao(limb(2.8, 1.7, 15, 0.15)); G.lower = ao(limb(1.75, 1.35, 14, 0.4)); G.knee = new THREE.SphereGeometry(2.05, 16, 12);
    G.hoof = ao(new THREE.CylinderGeometry(1.4, 1.8, 2.6, 16).translate(0, -1.3, 0));
    G.tail = tube([V3(0, 0, 0), V3(0, 2.8, -2), V3(0, 5, -2.4)], 1.4, u => 1 - 0.6 * u, 16, null, 0, 10);
    const furT = (() => { const [c, b] = tile(256, ['#d8d0c4', '#ffffff', '#ffffff'], (x, y) => { const s = vnoise(x / 1.6, y / 6, 7, 160), n = vnoise(x / 16, y / 16, 8, 16); return [(s - 0.5) * 0.35 + (n - 0.5) * 0.3, 0.4 + (s - 0.5) * 0.9]; }); return [tex(c, true, 6, 3), tex(b, false, 6, 3)]; })();
    const eyeMap = (() => { const W = 256, Hh = 128, c = document.createElement('canvas'); c.width = W; c.height = Hh; const g = c.getContext('2d'); g.fillStyle = C_.eye; g.fillRect(0, 0, W, Hh);
      const r = g.createRadialGradient(64, 64, 4, 64, 64, 40); r.addColorStop(0, ok(0.82, 0.12, 85)); r.addColorStop(1, ok(0.6, 0.13, 70)); g.fillStyle = r; g.fillRect(0, 0, 128, 128);
      g.fillStyle = C_.pupil; g.beginPath(); g.ellipse(64, 64, 15, 4.6, 0, 0, TAU); g.fill();    // the horizontal goat pupil
      g.fillStyle = 'rgba(255,253,245,.9)'; g.beginPath(); g.arc(54, 54, 4, 0, TAU); g.fill(); const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t; })();
    const std = (o) => new THREE.MeshStandardMaterial(Object.assign({ envMapIntensity: 0.55 }, o));
    const M = {
      coat: (() => { const m = new THREE.MeshPhysicalMaterial({ vertexColors: true, map: furT[0], bumpMap: furT[1], bumpScale: 0.07, roughness: 0.9, envMapIntensity: 0.45 }); if ('sheen' in m) m.sheen = new THREE.Color(lin(C_.coatLt)).multiplyScalar(0.5); return m; })(),
      horn: std({ color: lin(C_.horn), roughness: 0.55 }), hoof: std({ color: lin(C_.hoof), roughness: 0.5 }), legs: std({ color: lin(C_.coat), map: furT[0], bumpMap: furT[1], bumpScale: 0.15, roughness: 0.95 }),
      eye: new THREE.MeshPhysicalMaterial({ map: eyeMap, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 0.9 }), lid: std({ color: lin(C_.tan), roughness: 0.9 }),
      beard: std({ color: lin(C_.coatDk), roughness: 0.95 }),
    };
    return { G, M, F };
  }
  window.CHARACTERS = window.CHARACTERS || {};
  window.CHARACTERS.K = {
    meta: { id: 'K', name: 'Bakri', idea: 'Bapu\'s goat: cream with a tan saddle, floppy ears, short horns, a beard, horizontal pupils.', height_cm: 70, headSize_cm: 25, faceY: 2 },
    C: C_,
    make(THREE, { lin }) {
      if (!K) K = buildKit(THREE, lin);
      const { G, M, F } = K; const cl = F.cl;
      const root = new THREE.Group(); root.name = 'Bakri'; const J = {};
      const grp = (name, parent, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.name = name; g.position.set(x, y, z); parent.add(g); return g; };
      const mesh = (geo, mat, parent, cast = true) => { const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = true; parent.add(m); return m; };
      J.body = grp('body', root, 0, 46, 0); mesh(G.body, M.coat, J.body);
      J.neck = grp('neck', J.body, 0, 6, 22); J.neck.rotation.x = -0.25; mesh(G.neck, M.coat, J.neck);
      J.head = grp('head', J.neck, 0, 14, 10); const hs = grp('headShape', J.head, 0, 2, 5); mesh(G.head, M.coat, hs);
      J.jaw = grp('jaw', hs, 0, -4.2, 1.0); mesh(G.jaw, M.coat, J.jaw).position.set(0, 0.3, 2.6);
      const beard = mesh(G.beard, M.beard, J.jaw); beard.position.set(0, -0.8, 5.4);
      const eyes = [], lids = [];
      [1, -1].forEach(s => { const eg = grp('eye', hs, s * 4.7, 2.2, 3.4); eg.rotation.y = s * 0.5; const e = mesh(G.eye, M.eye, eg, false); e.rotation.y = -Math.PI / 2 * 0; eyes.push(e);
        const lg = grp('lid', eg, 0, 0, 0); mesh(G.lid, M.lid, lg, false); lids.push(lg);
        const er = grp('ear' + (s > 0 ? 'L' : 'R'), hs, s * 5.4, 3.6, -3.2); er.rotation.set(0, s * 0.3, s * 0.55); const em = mesh(G.ear, M.coat, er); em.rotation.x = Math.PI / 2; em.position.y = -5.4; J['ear' + (s > 0 ? 'L' : 'R')] = er;
        const hn = grp('horn', hs, s * 3.0, 7.0, -2.0); hn.rotation.z = -s * 0.18; mesh(G.horn, M.horn, hn); });
      J.tail = grp('tail', J.body, 0, 10, -29); mesh(G.tail, M.coat, J.tail);
      [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(([s, f], i) => { const n = ['FL', 'FR', 'BL', 'BR'][i];
        const lg = J['leg' + n] = grp('leg' + n, J.body, s * 6.4, -6, f * 18); mesh(G.leg, M.legs, lg);
        const lo = J['low' + n] = grp('low' + n, lg, 0, -15, 0); mesh(G.knee, M.legs, lo).scale.set(1, 1.2, 1); mesh(G.lower, M.legs, lo);
        const hf = mesh(G.hoof, M.hoof, lo); hf.position.y = -14.6; });
      let gaze = [0, 0], blink = 0;
      const setLids = (k) => lids.forEach(l => { l.rotation.x = lerp(-1.75, 0.1, k); });
      const lerp = (a, b, k) => a + (b - a) * k;
      const rig = {
        root, joints: J,
        setGaze(g) { gaze = g; },
        setBlink(k) { blink = k; setLids(k); },
        lookAt(v) { root.updateMatrixWorld(true); const hp = J.head.getWorldPosition(new THREE.Vector3()), d = v.clone().sub(hp); const q = root.getWorldQuaternion(new THREE.Quaternion()).invert(); d.applyQuaternion(q);
          gaze = [Math.atan2(d.x, d.z), Math.atan2(d.y, Math.hypot(d.x, d.z))]; },
        pose(clip, t) {
          const b = Math.sin(t * TAU / 2.4);
          J.body.position.y = 46 + 0.3 * b; J.body.rotation.set(0, 0, 0);
          ['FL', 'FR', 'BL', 'BR'].forEach((n, i) => { J['leg' + n].rotation.set(0, 0, 0); J['low' + n].rotation.set(0, 0, 0); });
          const chew = clip === 'idle' ? Math.max(0, Math.sin(t * TAU * 1.6)) : clip === 'bleat' ? 0.9 * Math.max(0, Math.sin(cl(t / 0.9) * Math.PI)) : 0.15 * Math.max(0, Math.sin(t * TAU * 0.4));
          J.jaw.rotation.set(0.12 * chew + (clip === 'bleat' ? 0.25 * chew : 0), 0, (clip === 'idle' ? 0.04 * Math.sin(t * TAU * 1.6) : 0));
          const still = clip === 'stare';
          J.neck.rotation.set(-0.25 + (still ? 0 : 0.03 * b), gaze[0] * 0.45, 0);
          J.head.rotation.set(-gaze[1] * 0.8 + (still ? 0 : 0.03 * Math.sin(t * 1.3)) + (clip === 'bleat' ? -0.3 * chew : 0), gaze[0] * 0.55, still ? 0.08 : 0.04 * Math.sin(t * 0.9));
          const flick = (ph) => { const u = ((t + ph) % 2.7) / 2.7; return u < 0.08 ? Math.sin(u / 0.08 * Math.PI) : 0; };
          J.earL.rotation.set(0.15 * flick(0.4), 0.3, 0.55 + 0.25 * flick(0.4)); J.earR.rotation.set(0.15 * flick(1.7), -0.3, -0.55 - 0.25 * flick(1.7));
          J.tail.rotation.set(0.3 * flick(0.9) - 0.2, 0.5 * Math.sin(t * 9) * flick(0.9), 0);
          const per = still ? 3.4 : 2.6, u = ((t + 0.7) % per) / per, auto = still ? (u < 0.16 ? Math.sin(u / 0.16 * Math.PI) * 0.7 : 0) : (u < 0.05 ? Math.sin(u / 0.05 * Math.PI) : 0);
          setLids(Math.max(blink, auto));
        },
        update() {},
      };
      rig.pose('idle', 0); return rig;
    },
  };
})();
