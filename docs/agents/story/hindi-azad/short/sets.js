/* sets.js: the Azad Short (three r128, units cm). One place, one morning: Alfred Park, Allahabad, 27 February 1931.
   BAGH: a bright winter-morning park. A big jamun tree at the origin on a round brick chabutra (seat height ~38), lawns
   in neem greens, a gravel path, a ring of other trees (neem, peepal) for the police to hide behind, an iron railing
   with a gate at z +700 and the road beyond, where the police car stops. Plus a small memory set at x +4000: the 1921
   magistrate's court (a raised bench, a back wall, a high window), shown only in the sepia memory look.
   Light: one morning sun from the east (frame left), warm, with soft dappled tree shade; 'hush' after the last shot
   (slightly cooler and flatter), 'aaj' for today (brighter, clearer), 'court' for the memory.
   window.DSETS(THREE, R, K, PR, lin) -> { bagh }. */
(function () {
'use strict';
window.DSETS = function (THREE, R, K, PR, lin) {
  const P = window.DANDI_PAL, ok = P.oklch, TAU = Math.PI * 2;
  const mesh = PR.mesh, std = PR.std, hash = PR.hash;
  const LS = i => lineT(i).start, W = (w, l, n) => wordT(w, l, n);
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  // ---------- surfaces ----------
  const grassMap = K.tex(512, 512, (u, v) => { const n = K.tnoise(u, v, 6, 4, 2.1), f = K.tnoise(u, v, 60, 3, 5.5), patch = Math.pow(K.tnoise(u, v, 3, 3, 9.1), 2);
    return K.mixC(K.mixC(K.hexRGB(ok(0.6, 0.085, 132)), K.hexRGB(ok(0.66, 0.08, 128)), n * 0.8 + f * 0.4), K.hexRGB(ok(0.66, 0.06, 95)), patch * 0.3); }, { repeat: [14, 14] });
  const grassBump = K.dataTex(256, 256, (u, v) => 0.4 + 0.6 * K.tnoise(u, v, 80, 2, 3.3), { repeat: [28, 28] });
  const gravelMap = K.tex(256, 256, (u, v) => K.mixC(K.hexRGB(P.MITTI[2]), K.hexRGB(P.MITTI[3]), K.tnoise(u, v, 40, 3, 1.7) * 0.8 + 0.2 * hash(Math.floor(u * 200) * 7 + Math.floor(v * 200))), { repeat: [6, 6] });
  const brickMap = K.tex(512, 256, (u, v) => { const row = Math.floor(v * 8), x = (u * 12 + (row % 2) * 0.5) % 1, y = (v * 8) % 1, j = Math.min(x, 1 - x) < 0.04 || Math.min(y, 1 - y) < 0.07;
    const c = K.mixC(K.hexRGB(P.KUMKUM[4]), K.hexRGB(P.MITTI[4]), 0.5 + 0.5 * hash(row * 31 + Math.floor(u * 12 + (row % 2) * 0.5)));
    return j ? K.hexRGB(P.CHUNA[2]) : K.mixC(c, K.hexRGB(P.MITTI[3]), K.tnoise(u, v, 20, 3, 4) * 0.4); }, { repeat: [6, 1] });
  const M = {
    grass: new THREE.MeshStandardMaterial({ map: grassMap, bumpMap: grassBump, bumpScale: 1.2, roughness: 0.95 }),
    gravel: new THREE.MeshStandardMaterial({ map: gravelMap, roughness: 0.95 }),
    brick: new THREE.MeshStandardMaterial({ map: brickMap, roughness: 0.9 }),
    lime: std(P.CHUNA[1], { roughness: 0.9 }),
    iron: std(ok(0.34, 0.03, 160), { metalness: 0.5, roughness: 0.55 }),
    road: std(P.MITTI[4], { roughness: 0.97 }),
    wood: PR.M.wood,
    carBody: std(ok(0.36, 0.05, 150), { metalness: 0.35, roughness: 0.4 }),   // a dark bottle-green police tourer
    chrome: std(ok(0.82, 0.01, 90), { metalness: 0.95, roughness: 0.22 }),
    tyre: std(ok(0.22, 0.01, 60), { roughness: 0.85 }),
    gun: std(ok(0.3, 0.012, 250), { metalness: 0.8, roughness: 0.35 }),
    grip: std(ok(0.36, 0.06, 45), { roughness: 0.6 }),
    brass: std(P.HALDI[3], { metalness: 0.9, roughness: 0.3 }),
    court: std(P.CHUNA[2], { roughness: 0.95 }),
  };
  const box = (w, h, d, m, x, y, z, r = 1.5) => { const b = mesh(K.bevelBox(w, h, d, r), m); b.position.set(x, y, z); return b; };
  // ---------- light states ----------
  const STATES = {
    morn: { top: ok(0.7, 0.065, 230), mid: ok(0.84, 0.04, 220), hor: ok(0.92, 0.03, 85), sun: '#fff0dc', sunI: 3.4, sunPos: [-900, 760, 560], hemiS: ok(0.86, 0.03, 220), hemiG: ok(0.62, 0.05, 130), hemiI: 0.5, envSun: '#fff1d6', envSunK: 2.0 },
    hush: { top: P.AAKASH[3], mid: P.AAKASH[2], hor: P.CHUNA[1], sun: '#f4efe4', sunI: 2.6, sunPos: [-900, 900, 300], hemiS: P.AAKASH[2], hemiG: P.NEEM[5], hemiI: 0.42, envSun: '#f4efe4', envSunK: 1.6 },
    aaj: { top: P.AAKASH[3], mid: P.AAKASH[1], hor: P.AAKASH[0], sun: '#fff6e6', sunI: 3.9, sunPos: [-500, 1100, 700], hemiS: P.AAKASH[1], hemiG: P.NEEM[3], hemiI: 0.5, envSun: '#fff6e6', envSunK: 2.2 },
    court: { top: P.KHUBANI[2], mid: P.KHUBANI[1], hor: P.HALDI[0], sun: '#ffe2b8', sunI: 3.0, sunPos: [3600, 900, -900], hemiS: P.KHUBANI[1], hemiG: P.MITTI[3], hemiI: 0.5, envSun: '#ffe2b8', envSunK: 1.8 },
  };
  let forced = null;
  function stateAt(t) { if (forced) return forced; if (t >= W('aaj', 9) - 0.15) return 'aaj'; if (t >= W('dhamaake', 8) - 0.05) return 'hush'; return 'morn'; }

  function bagh() {
    const S = new THREE.Scene(), C = { scene: S, STATES, stateAt, M, setState(k) { forced = k; } };
    const sky = K.sky({ top: P.AAKASH[2], mid: P.AAKASH[1], hor: P.HALDI[0], sunDir: [-0.7, 0.6, 0.4] }); S.add(sky); C.sky = sky;
    C.envs = {}; Object.keys(STATES).forEach(k => { const s = STATES[k], d = V(...s.sunPos).normalize();
      C.envs[k] = K.env(R, { top: s.top, hor: s.hor, ground: P.NEEM[4], sun: s.envSun, sunPos: [d.x * 40, Math.max(4, d.y * 40), d.z * 40], sunK: s.envSunK }); });
    S.fog = new THREE.FogExp2(lin(ok(0.86, 0.025, 215)), 0.00013);   // air between the planes: the background steps back
    const hemi = new THREE.HemisphereLight(lin('#ffffff'), lin('#ffffff'), 0.6); S.add(hemi);
    const sun = new THREE.DirectionalLight(lin('#ffffff'), 3); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera; sc.left = -900; sc.right = 900; sc.top = 900; sc.bottom = -900; sc.near = 10; sc.far = 4000;
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.8; sun.shadow.radius = 4; S.add(sun, sun.target);
    C.key = new THREE.DirectionalLight(lin(P.KHUBANI[0]), 0.7); S.add(C.key, C.key.target);
    C.rim = new THREE.DirectionalLight(lin(P.HALDI[0]), 1.0); S.add(C.rim, C.rim.target);
    const bounce = new THREE.PointLight(lin(P.KHUBANI[0]), 0.25, 700, 1.6); bounce.position.set(0, 40, 80); S.add(bounce);   // a warm bounce (a green one tinted the faces)
    C.flash = new THREE.PointLight(lin(P.GENDA[1]), 0, 420, 1.8); S.add(C.flash);   // muzzle flashes (shots place it)
    C.L = { hemi, sun, bounce };
    // ---------- ground ----------
    const gr = mesh(new THREE.PlaneGeometry(9000, 9000), M.grass); gr.rotation.x = -Math.PI / 2; S.add(gr); C.ground = gr;
    // the gravel path: a ring round the tree and a straight walk to the gate
    { const ring = mesh(new THREE.RingGeometry(330, 420, 96).rotateX(-Math.PI / 2), M.gravel); ring.position.y = 0.4; S.add(ring);
      const walk = mesh(new THREE.PlaneGeometry(110, 380).rotateX(-Math.PI / 2), M.gravel); walk.position.set(0, 0.45, 600); S.add(walk); }
    // the road beyond the railing
    { const rd = mesh(new THREE.PlaneGeometry(9000, 520).rotateX(-Math.PI / 2), M.road); rd.position.set(0, 0.5, 1080); S.add(rd); }
    // ---------- the jamun tree on its chabutra ----------
    C.TREE = V(0, 0, -40);
    { const ch = new THREE.Group(); ch.position.copy(C.TREE); S.add(ch);
      const g = new THREE.CylinderGeometry(120, 124, 38, 64, 1, false); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * 6);
      const base = mesh(g, M.brick); base.position.y = 19; ch.add(base);
      const top = mesh(new THREE.CylinderGeometry(126, 126, 5, 64), M.lime); top.position.y = 40.5; ch.add(top); C.chabutra = ch; C.SEAT = 43; }
    { const t = K.tree({ seed: 7, h: 640, crown: 300, trunk: 0.5, tr: 30, masses: 9, leaf: ok(0.52, 0.09, 135), leafDark: ok(0.34, 0.06, 140), leafLight: ok(0.68, 0.1, 128), bark: ok(0.4, 0.045, 55) });
      t.position.copy(C.TREE); t.position.y = 40; S.add(t); C.jamun = t;
      // a dense skin of small glossy leaves on the crown, so a close camera sees leaves, not blobs
      const lg = new THREE.ShapeGeometry((() => { const s = new THREE.Shape(); s.moveTo(0, 0); s.quadraticCurveTo(3.4, 6, 0, 14); s.quadraticCurveTo(-3.4, 6, 0, 0); return s; })(), 4);
      const lm = new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0, side: THREE.DoubleSide, envMapIntensity: 0.8 });
      const N = 5200, im = new THREE.InstancedMesh(lg, lm, N), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), col = new THREE.Color();
      const masses = t.children.filter(c => c.geometry && c.geometry.type === 'SphereGeometry');
      for (let i = 0; i < N; i++) { const ms = masses[i % masses.length], rad = ms.geometry.parameters.radius, d = V(hash(i * 3 + 1) - 0.5, (hash(i * 3 + 2) - 0.35), hash(i * 3 + 3) - 0.5).normalize();
        const p = ms.position.clone().add(d.clone().multiplyScalar(rad * (0.92 + 0.14 * hash(i * 7)))).multiply(V(1, 0.84, 1));
        e.set(hash(i * 5) * TAU, hash(i * 5 + 1) * TAU, hash(i * 5 + 2) * TAU); q.setFromEuler(e); const s = 1.2 + 0.8 * hash(i * 11);
        m4.compose(p, q, V(s, s, s)); im.setMatrixAt(i, m4);
        col.copy(lin(d.y > 0.2 ? ok(0.62 + 0.06 * hash(i), 0.1, 130) : ok(0.42 + 0.06 * hash(i), 0.07, 138))); im.setColorAt(i, col); }
      im.castShadow = true; im.receiveShadow = true; t.add(im);
      // jamun fruit, a few dark violet clusters under the crown
      const fm = std(ok(0.3, 0.09, 320), { roughness: 0.3 }); for (let i = 0; i < 60; i++) { const ms = masses[i % masses.length], rad = ms.geometry.parameters.radius;
        const f = mesh(new THREE.SphereGeometry(1.6, 10, 8).scale(1, 1.3, 1), fm, false); f.position.copy(ms.position).add(V((hash(i) - 0.5) * rad, -rad * 0.75, (hash(i + 9) - 0.5) * rad)); t.add(f); }
      // bullet scars on the trunk (shots switch them on one by one)
      C.scars = []; const sm_ = std(ok(0.86, 0.06, 70), { roughness: 0.9 });
      [[0.4, 120], [-0.9, 150], [1.3, 95], [2.4, 135], [-2.0, 110], [0.9, 170]].forEach(([a, y]) => { const s = mesh(new THREE.CircleGeometry(2.6, 12), sm_, false);
        const r = 30 * 0.9; s.position.set(Math.sin(a) * r, y - 40, Math.cos(a) * r); s.lookAt(V(Math.sin(a) * 100, y - 40, Math.cos(a) * 100)); s.visible = false; t.add(s); C.scars.push(s); }); }
    // the ring of other trees (cover for the police): world positions
    C.COVER = [[-620, -420], [560, -460], [-760, 260], [720, 200], [-420, 620], [430, 640], [0, -820], [-1150, -150], [1150, -120]];
    C.COVER.forEach(([x, z], i) => { const t = K.tree({ seed: 20 + i, h: 520 + 120 * hash(i), crown: 220 + 60 * hash(i + 4), trunk: 0.5, tr: 22, masses: 7, segU: 40, segV: 26, leaf: ok(i % 2 ? 0.52 : 0.56, 0.085, 133), leafDark: ok(0.34, 0.06, 140), leafLight: ok(0.68, 0.09, 128), bark: ok(i % 2 ? 0.44 : 0.38, 0.04, 55) });
      t.position.set(x, 0, z); t.rotation.y = hash(i) * TAU; S.add(t); });
    // far trees and the town's skyline in the haze (depth)
    for (let i = 0; i < 26; i++) { const a = i / 26 * TAU, r = 2200 + 500 * hash(i * 3); const t = K.tree({ seed: 60 + i, h: 600, crown: 260, masses: 5, segU: 22, segV: 14, leaf: ok(0.62, 0.06, 140), leafDark: ok(0.48, 0.05, 140), leafLight: ok(0.72, 0.06, 135) });
      t.position.set(Math.cos(a) * r, 0, Math.sin(a) * r - 300); S.add(t); }
    // benches along the path
    [[-380, 250, 0.7], [380, 250, -0.7], [-300, -330, 2.4]].forEach(([x, z, ry]) => { const b = new THREE.Group(); b.position.set(x, 0, z); b.rotation.y = ry; S.add(b);
      b.add(box(150, 5, 36, M.wood, 0, 42, 0, 1)); b.add(box(150, 30, 4, M.wood, 0, 62, -17, 1)); [-60, 60].forEach(xx => { b.add(box(6, 42, 34, M.iron, xx, 21, 0, 1)); }); });
    // ---------- the railing, the gate and the board ----------
    const GZ = 700; C.GATE = V(0, 0, GZ);
    { const rail = new THREE.Group(); S.add(rail);
      for (let x = -2000; x <= 2000; x += 26) { if (Math.abs(x) < 80) continue; const b = mesh(new THREE.CylinderGeometry(1.1, 1.1, 120, 8), M.iron); b.position.set(x, 60, GZ); rail.add(b);
        const tip = mesh(new THREE.ConeGeometry(2.2, 7, 8), M.iron); tip.position.set(x, 123, GZ); rail.add(tip); }
      [20, 108].forEach(y => rail.add(box(4000, 4, 4, M.iron, 0, y, GZ, 0.8)));
      [-80, 80].forEach(x => { rail.add(box(34, 190, 34, M.brick, x, 95, GZ, 2)); rail.add(box(42, 10, 42, M.lime, x, 195, GZ, 2)); }); }
    // the board over the gate: "ALFRED PARK" in 1931, "CHANDRASHEKHAR AZAD PARK" today (C.board.set(today))
    { const mk = (lines) => PR.canvasTex(1024, 256, (g, w, h) => { g.fillStyle = ok(0.93, 0.03, 90); g.fillRect(0, 0, w, h); g.strokeStyle = ok(0.36, 0.05, 150); g.lineWidth = 14; g.strokeRect(10, 10, w - 20, h - 20);
        g.fillStyle = ok(0.3, 0.05, 150); g.textAlign = 'center'; g.textBaseline = 'middle'; lines.forEach(([txt, size, y]) => { g.font = `700 ${size}px "Rozha One", Georgia, serif`; g.fillText(txt, w / 2, y); }); });
      const old = mk([['ALFRED PARK', 120, 128]]), now = mk([['CHANDRASHEKHAR AZAD PARK', 58, 100], ['चंद्रशेखर आज़ाद पार्क', 64, 180]]);
      const bm = new THREE.MeshStandardMaterial({ map: old, roughness: 0.8 }); const bd = mesh(new THREE.PlaneGeometry(200, 50), bm, false); bd.position.set(0, 222, GZ - 1); bd.rotation.y = Math.PI; S.add(bd);
      const bd2 = mesh(new THREE.PlaneGeometry(200, 50), bm, false); bd2.position.set(0, 222, GZ + 1); S.add(bd2);
      S.add(box(206, 4, 4, M.iron, 0, 248, GZ, 0.8)); [-80, 80].forEach(x => S.add(box(4, 30, 4, M.iron, x, 233, GZ, 0.8)));
      let cur = null; C.board = { set(today) { if (cur === today) return; cur = today; bm.map = today ? now : old; bm.needsUpdate = true; } }; }   // only on change: a per-frame needsUpdate recompiled the material every frame
    // ---------- the police car: a 1930 open tourer ----------
    { const car = new THREE.Group(); S.add(car); C.car = car;
      car.add(box(320, 46, 150, M.carBody, 0, 62, 0, 10)); car.add(box(120, 40, 140, M.carBody, 110, 100, 0, 12));   // body and bonnet
      car.add(box(16, 52, 120, M.chrome, 176, 96, 0, 4));   // radiator
      car.add(box(4, 56, 140, new THREE.MeshPhysicalMaterial({ color: lin('#e8f0f2'), transparent: true, opacity: 0.25, roughness: 0.05 }), 40, 136, 0, 1));   // windscreen
      car.add(box(90, 40, 140, std(ok(0.34, 0.05, 40), { roughness: 0.7 }), -40, 104, 0, 8)); car.add(box(90, 40, 140, std(ok(0.34, 0.05, 40), { roughness: 0.7 }), -130, 104, 0, 8));   // leather seats
      C.wheels = []; [[110, 72], [110, -72], [-110, 72], [-110, -72]].forEach(([x, z]) => { const w = new THREE.Group(); w.position.set(x, 36, z); car.add(w); C.wheels.push(w);
        const ty = mesh(new THREE.TorusGeometry(26, 9, 14, 36), M.tyre); w.add(ty); const hub = mesh(new THREE.CylinderGeometry(9, 9, 6, 20).rotateX(Math.PI / 2), M.chrome); w.add(hub);
        for (let k = 0; k < 10; k++) { const sp = mesh(new THREE.CylinderGeometry(1.2, 1.2, 34, 6), M.chrome); sp.rotation.z = k / 10 * Math.PI; w.add(sp); } });
      [[150, 64], [150, -64]].forEach(([x, z]) => { const hl = mesh(new THREE.SphereGeometry(11, 20, 14), M.chrome); hl.position.set(x + 30, 104, z); car.add(hl); });
      [72, -72].forEach(z => car.add(box(260, 6, 30, M.carBody, 0, 44, z * 1.25, 2)));   // running boards
      car.position.set(-260, 0, 1020); car.rotation.y = 0; }
    // ---------- the pistol (a Colt pocket pistol) and its magazine ----------
    function pistol() { const g = new THREE.Group();
      g.add(box(16, 3.4, 2.4, M.gun, 3, 3, 0, 0.6)); g.add(box(12, 1.2, 2.2, M.gun, 2, 5.0, 0, 0.4));   // slide
      const grip = box(3.6, 9, 2.6, M.grip, -3.6, -2.6, 0, 0.8); grip.rotation.z = -0.22; g.add(grip);
      const tg = mesh(new THREE.TorusGeometry(1.8, 0.35, 8, 16, Math.PI), M.gun); tg.position.set(1.2, -0.2, 0); tg.rotation.z = Math.PI; g.add(tg);
      const muzzle = new THREE.Object3D(); muzzle.position.set(11.2, 3.2, 0); g.add(muzzle); g.userData.muzzle = muzzle;
      g.scale.setScalar(1.15); return g; }
    C.pistol = pistol(); S.add(C.pistol); C.pistol.visible = false;
    C.copPistols = [0, 1, 2, 3].map(() => { const p = pistol(); p.visible = false; S.add(p); return p; });
    C.mag = new THREE.Group(); { const body = box(2.2, 8, 1.5, std(ok(0.56, 0.012, 250), { metalness: 0.85, roughness: 0.3 }), 0, 0, 0, 0.4); C.mag.add(body); const rd = mesh(new THREE.CylinderGeometry(1.0, 1.0, 3.0, 14).rotateZ(Math.PI / 2), M.brass); rd.position.set(0.4, 4.7, 0); C.mag.add(rd);
      const tip = mesh(new THREE.SphereGeometry(1.0, 12, 8), M.brass); tip.position.set(2.0, 4.7, 0); C.mag.add(tip); } C.mag.visible = false; S.add(C.mag);
    // ---------- smoke, dust and leaves (sprites) ----------
    const puff = PR.canvasTex(128, 128, (g, w, h) => { const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); r.addColorStop(0, 'rgba(255,255,255,0.7)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, w, h); });
    C.puffs = []; for (let i = 0; i < 14; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: puff, color: lin(P.CHUNA[0]), transparent: true, opacity: 0, depthWrite: false })); sp.visible = false; S.add(sp); C.puffs.push(sp); }
    C.chips = []; for (let i = 0; i < 22; i++) { const c = mesh(K.bevelBox(3.4, 1.4, 2.4, 0.4), std(P.UMBER[3], { roughness: 0.9 }), false); c.visible = false; S.add(c); C.chips.push(c); }
    C.flashSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: puff, color: lin(P.GENDA[0]), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); C.flashSprite.visible = false; S.add(C.flashSprite);
    // falling leaves after the shot and birds that burst from the crown
    { const lg = new THREE.PlaneGeometry(4, 9); C.fall = new THREE.InstancedMesh(lg, new THREE.MeshStandardMaterial({ color: lin(P.NEEM[4]), side: THREE.DoubleSide, roughness: 0.6 }), 60); C.fall.visible = false; S.add(C.fall); }
    { const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 6, -9, 1, -2, 0, 1.5, -3, 9, 1, -2, 0, 0, 6, 0, 1.5, -3], 3)); bg.computeVertexNormals();
      C.birds = new THREE.InstancedMesh(bg, new THREE.MeshStandardMaterial({ color: lin(ok(0.3, 0.02, 250)), side: THREE.DoubleSide, roughness: 0.8 }), 40); C.birds.visible = false; S.add(C.birds); }
    // ---------- the memory: the 1921 magistrate's court at x +4000 ----------
    const CX = 4000; C.COURT = V(CX, 0, 0);
    { const cg = new THREE.Group(); cg.position.copy(C.COURT); S.add(cg); C.court = cg;
      const fl = mesh(new THREE.PlaneGeometry(1200, 1200).rotateX(-Math.PI / 2), std(P.MITTI[2], { roughness: 0.92 })); fl.position.y = 0.6; cg.add(fl);
      cg.add(box(900, 420, 20, M.court, 0, 210, -260, 2)); cg.add(box(20, 420, 600, M.court, -450, 210, 0, 2));
      const win = mesh(new THREE.PlaneGeometry(90, 150), new THREE.MeshBasicMaterial({ color: lin(P.HALDI[0]) })); win.position.set(160, 280, -249); cg.add(win);
      [130, 190].forEach(x => cg.add(box(6, 150, 6, M.wood, x, 280, -247, 1)));
      cg.add(box(380, 110, 80, M.wood, 0, 55, -170, 4)); cg.add(box(400, 8, 96, M.wood, 0, 114, -170, 2)); cg.add(box(380, 60, 30, M.wood, 0, 150, -210, 3));   // the raised bench
    }
    // ---------- cast ----------
    C.hero = window.CHARACTERS.A.make(THREE, { lin }); S.add(C.hero.root);
    C.boy = window.CHARACTERS.A.make(THREE, { lin }); S.add(C.boy.root); C.boy.root.scale.setScalar(0.86); C.boy.root.visible = false;
    C.boy.root.traverse(o => { if (o.isMesh && o.geometry && o.geometry.type === 'TubeGeometry' && o.parent && o.parent.name === 'headShape') o.visible = false; });   // fifteen: no moustache yet
    // the saathi: Bhagat's rig, a grey-blue kurta and a white cap (so he never reads as Bhagat Singh)
    { const SC = window.CHARACTERS.S.C; Object.assign(SC, { kurta: ok(0.62, 0.04, 235), kurtaDk: ok(0.53, 0.04, 235), kurtaLt: ok(0.7, 0.035, 235), pyjama: ok(0.9, 0.012, 90), pyjamaDk: ok(0.8, 0.015, 86), pyjamaLt: ok(0.95, 0.01, 92) }); }
    C.saathi = window.CHARACTERS.S.make(THREE, { lin }); S.add(C.saathi.root); C.saathi.root.visible = false;
    { const h = C.saathi.root.getObjectByName('headShape'); const cap = mesh(K.bevelBox(27, 9, 20, 3), std(P.CHUNA[0], { roughness: 0.9 })); cap.position.set(0, 13.5, -1); cap.rotation.x = -0.12; h.add(cap); }
    // the police: the delegate rig in khaki with a sola topi; the judge in black
    { const NC = window.CHARACTERS.N.C; Object.assign(NC, { kurta: ok(0.62, 0.06, 85), kurtaDk: ok(0.53, 0.06, 80), kurtaLt: ok(0.7, 0.05, 88), pyjama: ok(0.6, 0.05, 85), pyjamaDk: ok(0.5, 0.05, 80), pyjamaLt: ok(0.68, 0.045, 88) }); }
    const topiM = std(ok(0.82, 0.05, 88), { roughness: 0.8 });
    const topi = (rig) => { const h = rig.root.getObjectByName('headShape'); const g = new THREE.Group(); g.position.set(0, 11, 0); h.add(g);
      g.add(mesh(new THREE.SphereGeometry(16.5, 32, 16, 0, TAU, 0, Math.PI / 2).scale(1, 0.9, 1.08), topiM)); g.add(mesh(new THREE.CylinderGeometry(22, 22, 1.2, 40).scale(1, 1, 1.12), topiM)); return g; };
    C.cops = [0, 1, 2, 3, 4].map(i => { const r = window.CHARACTERS.N.make(THREE, { lin }); r.root.visible = false; S.add(r.root); topi(r); return r; });
    C.officer = C.cops[0];
    C.judge = window.CHARACTERS.N.make(THREE, { lin }); C.judge.root.visible = false; S.add(C.judge.root);
    // shadows, and less sky fill so the sun's shape reads
    S.traverse(o => { if (o.isMesh && o !== gr && o !== sky) { o.castShadow = o.castShadow !== false; o.receiveShadow = true; } });
    gr.receiveShadow = true; gr.castShadow = false;
    S.traverse(o => { if (o.isMesh || o.isInstancedMesh) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (m && 'envMapIntensity' in m && !m.userData.envCut) { m.envMapIntensity *= 0.6; m.userData.envCut = 1; } }); });
    C.state = 'morn';
    C.update = function (t) {
      const k = stateAt(t), s = STATES[k]; C.state = k;
      const u = sky.userData.u; u.top.value.copy(lin(s.top)); u.mid.value.copy(lin(s.mid)); u.hor.value.copy(lin(s.hor)); u.sunCol.value.copy(lin(s.sun)); u.sunDir.value.set(...s.sunPos).normalize(); u.sunK.value = 0.6; u.cloudK.value = 1; u.uT.value = t;
      S.environment = C.envs[k];
      hemi.color.copy(lin(s.hemiS)); hemi.groundColor.copy(lin(s.hemiG)); hemi.intensity = s.hemiI;
      sun.color.copy(lin(s.sun)); sun.intensity = s.sunI;
      const tgt = k === 'court' ? C.COURT : (C.focusPt || C.TREE); sun.target.position.copy(tgt); sun.position.copy(tgt).add(V(...s.sunPos));
      C.key.intensity = 1.25; C.rim.intensity = k === 'court' ? 1.5 : 1.35;   // the subject keyed and rimmed a step brighter than the world
      C.board.set(k === 'aaj');
    };
    return C;
  }
  return { bagh: bagh() };
};
})();
