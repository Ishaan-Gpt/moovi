/* gprops.js: the props of Bapu's day, procedural (three r128, units cm), on top of props.js (lota, katori, flame, pool).
   window.GPROPS(THREE, K, PR, lin) -> { chatai, charkha, desk, letter, pen, inkpot, bucket, broom, stick, lantern, note, matka }.
   Animated props carry userData (charkha.userData.spin(a), .thread(k, snap); lantern.userData.update(t)). */
(function () {
'use strict';
window.GPROPS = function (THREE, K, PR, lin) {
  const P = window.DANDI_PAL, ok = P.oklch, TAU = Math.PI * 2, mesh = PR.mesh, std = PR.std, hash = PR.hash;
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const bamboo = new THREE.MeshStandardMaterial({ map: K.tex(64, 256, (u, v) => { const n = K.tnoise(u, v, 8, 3, 3), node = Math.exp(-Math.pow(((v * 3) % 1 - 0.5) / 0.03, 2));
    return K.mixC(K.mixC(K.hexRGB(ok(0.8, 0.07, 88)), K.hexRGB(ok(0.72, 0.08, 80)), n), K.hexRGB(ok(0.58, 0.07, 70)), node * 0.8); }), roughness: 0.6 });
  const wood = PR.M.wood, khadiM = std(ok(0.95, 0.014, 92), { roughness: 0.95 });
  // chatai: a woven reed mat (a checker weave in canvas)
  const chataiMap = PR.canvasTex(512, 512, (g, w, h) => { g.fillStyle = ok(0.8, 0.06, 82); g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 16) for (let x = 0; x < w; x += 16) { const o = ((x + y) / 16) % 2; g.fillStyle = o ? ok(0.76, 0.065, 78) : ok(0.84, 0.055, 86); g.fillRect(x + 1, y + 1, 14, 14);
      g.strokeStyle = 'rgba(90,70,40,.18)'; g.lineWidth = 1; g.beginPath(); for (let k = 3; k < 16; k += 4) { if (o) { g.moveTo(x + k, y + 1); g.lineTo(x + k, y + 15); } else { g.moveTo(x + 1, y + k); g.lineTo(x + 15, y + k); } } g.stroke(); }
    g.fillStyle = ok(0.62, 0.07, 60); g.fillRect(0, 0, w, 10); g.fillRect(0, h - 10, w, 10); }, { repeat: [1, 1] });
  function chatai(w = 190, d = 90) { const m = mesh(new THREE.BoxGeometry(w, 0.8, d), new THREE.MeshStandardMaterial({ map: chataiMap, roughness: 0.9 })); m.position.y = 0.4; return m; }
  // charkha: the box-less floor wheel: two plank feet, an upright, a spoked wheel with a cord rim, a handle, the spindle with a cop of yarn
  function charkha() {
    const g = new THREE.Group(), R = 26;
    { const ft = mesh(K.bevelBox(90, 4, 14, 1.2), wood); ft.position.set(0, 2, 0); g.add(ft); }
    [-1, 1].forEach(s => { const u = mesh(K.bevelBox(4, 40, 4, 1), wood); u.position.set(-22, 22, s * 7); g.add(u); });
    const wheel = new THREE.Group(); wheel.position.set(-22, 40, 0); g.add(wheel);
    [-1, 1].forEach(s => { const rim = mesh(new THREE.TorusGeometry(R, 0.9, 8, 64), wood); rim.position.z = s * 3; wheel.add(rim);
      for (let k = 0; k < 8; k++) { const sp = mesh(new THREE.CylinderGeometry(0.55, 0.55, R * 2, 8), wood); sp.rotation.z = k / 8 * Math.PI; sp.position.z = s * 3; wheel.add(sp); } });
    for (let k = 0; k < 16; k++) { const a = k / 16 * TAU, c = mesh(new THREE.CylinderGeometry(0.25, 0.25, 6.4, 6), PR.M.rope); c.rotation.x = Math.PI / 2; c.position.set(Math.cos(a) * R, Math.sin(a) * R, 0); wheel.add(c); }
    const hub = mesh(new THREE.CylinderGeometry(3, 3, 10, 16), wood); hub.rotation.x = Math.PI / 2; wheel.add(hub);
    const handle = new THREE.Group(); handle.position.z = 7; wheel.add(handle); const arm = mesh(K.bevelBox(2, 12, 1.6, 0.6), wood); arm.position.set(0, 6, 0); handle.add(arm);
    const knob = mesh(new THREE.CylinderGeometry(1.1, 1.1, 7, 12), wood); knob.rotation.x = Math.PI / 2; knob.position.set(0, 11, 3.5); handle.add(knob);
    const sp = new THREE.Group(); sp.position.set(30, 14, 0); g.add(sp);
    [-1, 1].forEach(s => { const p = mesh(K.bevelBox(3, 14, 3, 0.8), wood); p.position.set(s * 6, -4, 0); sp.add(p); });
    const spindle = mesh(new THREE.CylinderGeometry(0.25, 0.25, 30, 8), PR.M.iron); spindle.rotation.z = Math.PI / 2; spindle.position.x = 6; sp.add(spindle);
    const cop = mesh(K.lathe([[0.3, -4], [1.8, -3], [2.3, 0], [1.6, 3], [0.3, 4]], 24, 24), khadiM); cop.rotation.z = Math.PI / 2; cop.position.x = 2; sp.add(cop);
    // the drive cord from the wheel rim to the spindle pulley
    const cord = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V3(-22, 40 + R, 0), V3(10, 26, 0), V3(30, 14.5, 0), V3(10, 12, 0), V3(-22, 40 - R, 0)]), 40, 0.18, 6), PR.M.rope); g.add(cord);
    // the yarn: from the spindle tip up to the spinner's left hand (set by thread(): a point in charkha space)
    const yarnM = std(ok(0.97, 0.01, 90), { roughness: 0.9 });
    const yarn = mesh(new THREE.BufferGeometry(), yarnM, false); g.add(yarn);
    const tail = mesh(new THREE.BufferGeometry(), yarnM, false); g.add(tail);
    const tipW = V3(51, 14, 0);
    g.userData = { wheel, spin(a) { wheel.rotation.z = -a; },
      // k: how far the drawn thread reaches toward 'to' (charkha space); snap 0..1: broken, the loose ends curl back
      thread(to, snap = 0, t = 0) { const a = tipW.clone(); const b = to.clone();
        if (snap <= 0) { yarn.geometry.dispose(); yarn.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([a, a.clone().lerp(b, 0.5).add(V3(0, 1.5 * Math.sin(t * 9), 0)), b]), 24, 0.3, 6); tail.visible = false; yarn.visible = true; return; }
        const m = a.clone().lerp(b, 0.55), e = Math.min(1, snap * 2.2), cA = a.clone().lerp(m, 1 - 0.6 * e).add(V3(0, -6 * e * e, 2 * e)), cB = b.clone().lerp(m, 1 - 0.7 * e).add(V3(0, -4 * e * e - 2 * e * Math.sin(t * 7), -1 * e));
        yarn.geometry.dispose(); yarn.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([a, a.clone().lerp(cA, 0.5).add(V3(0, 1 * e, 0)), cA]), 16, 0.3, 6);
        tail.geometry.dispose(); tail.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([b, b.clone().lerp(cB, 0.5).add(V3(0, 1.2 * e, 0)), cB]), 16, 0.3, 6); tail.visible = true; } };
    return g;
  }
  // Bapu's low writing desk (a sloped lap desk on short legs)
  function desk() { const g = new THREE.Group(); const top = mesh(K.bevelBox(62, 2.4, 38, 0.8), wood); top.position.set(0, 26, 0); top.rotation.x = 0.12; g.add(top);
    [[-27, -15], [27, -15], [-27, 15], [27, 15]].forEach(([x, z]) => { const l = mesh(K.bevelBox(3, 24 + (z < 0 ? 2.5 : -2.5), 3, 0.8), wood); l.position.set(x, (24 + (z < 0 ? 2.5 : -2.5)) / 2, z); g.add(l); });
    const lip = mesh(K.bevelBox(62, 2.5, 1.5, 0.5), wood); lip.position.set(0, 26.8, 18.5); g.add(lip); g.userData.topY = 27.6; g.userData.tilt = 0.12; return g; }
  // a letter: a sheet with a few lines of hand-written Gujarati-like loops (abstract, unreadable on purpose)
  const letterTex = (seed) => PR.canvasTex(256, 340, (g, w, h) => { g.fillStyle = ok(0.97, 0.018, 92); g.fillRect(0, 0, w, h); g.strokeStyle = ok(0.35, 0.05, 260); g.lineWidth = 1.6;
    for (let r = 0; r < 14; r++) { let x = 24; const y = 40 + r * 20; g.beginPath(); g.moveTo(x, y); while (x < w - 28 - hash(seed + r) * 40) { const s = 4 + hash(seed * 3 + x) * 6; g.quadraticCurveTo(x + s / 2, y - 6 - hash(x + r) * 4, x + s, y); x += s + (hash(x * 7 + r) > 0.86 ? 8 : 0); if (hash(x + seed) > 0.86) g.moveTo(x, y); } g.stroke(); } });
  const LT = [0, 1, 2, 3].map(i => letterTex(i * 13 + 1));
  function letter(i = 0) { const m = mesh(new THREE.BoxGeometry(18, 0.12, 24), [khadiM, khadiM, new THREE.MeshStandardMaterial({ map: LT[i % 4], roughness: 0.9 }), khadiM, khadiM, khadiM], false); return m; }
  function pen() { const g = new THREE.Group(); const b = mesh(new THREE.CylinderGeometry(0.45, 0.35, 15, 12), std(ok(0.35, 0.05, 40), { roughness: 0.5 })); b.position.y = 7.5; g.add(b);
    const nib = mesh(new THREE.ConeGeometry(0.35, 1.8, 10), PR.M.brass); nib.rotation.x = Math.PI; nib.position.y = -0.9; g.add(nib); return g; }
  function inkpot() { const g = new THREE.Group(); g.add(mesh(K.lathe([[0.01, 0], [3, 0], [3.4, 2], [3, 4], [1.4, 4.6], [1.5, 5.4], [0.01, 5.4]], 32, 32), new THREE.MeshPhysicalMaterial({ color: lin(ok(0.4, 0.06, 250)), roughness: 0.1, clearcoat: 1, transmission: 0 })));
    return g; }
  function bucket() { const g = new THREE.Group(); g.add(mesh(K.lathe([[0.01, 0], [11, 0], [12.6, 22], [13.2, 23], [12.4, 23], [11.6, 2], [0.01, 2]], 40, 40), new THREE.MeshStandardMaterial({ color: lin(ok(0.62, 0.012, 230)), metalness: 0.75, roughness: 0.42, side: THREE.DoubleSide, envMapIntensity: 1 })));
    const w = mesh(new THREE.CylinderGeometry(11.9, 11.9, 0.3, 40), new THREE.MeshPhysicalMaterial({ color: lin(ok(0.75, 0.04, 200)), roughness: 0.05, clearcoat: 1 })); w.position.y = 16; g.add(w);
    const h = mesh(new THREE.TorusGeometry(12.8, 0.35, 6, 32, Math.PI), PR.M.iron); h.position.y = 23; g.add(h); g.userData.handleY = 35.5; return g; }
  // jhaadu: a hand broom of grass stems bound at the top
  function broom() { const g = new THREE.Group(); const sm_ = std(ok(0.78, 0.07, 88), { roughness: 0.9 });
    for (let i = 0; i < 70; i++) { const a = hash(i) * TAU, r = hash(i + 50) * 2.4, sp = 1 + 2.2 * hash(i + 90); const c = new THREE.CatmullRomCurve3([V3(Math.cos(a) * r * 0.3, 0, Math.sin(a) * r * 0.3), V3(Math.cos(a) * r * sp * 0.6, -26, Math.sin(a) * r * sp * 0.4), V3(Math.cos(a) * r * sp, -54 - hash(i + 7) * 6, Math.sin(a) * r * sp * 0.5)]);
      g.add(mesh(new THREE.TubeGeometry(c, 8, 0.22, 4), sm_)); }
    const bind = mesh(new THREE.CylinderGeometry(2.1, 2.1, 6, 16), PR.M.rope); bind.position.y = -2; g.add(bind); return g; }
  function stick() { const g = new THREE.Group(); const s = mesh(new THREE.CylinderGeometry(1.1, 1.2, 150, 12), bamboo); s.position.y = -75; g.add(s); return g; }
  // a hurricane lantern: base tank, wire guard, glass chimney with a flame
  function lantern() { const g = new THREE.Group(); const tin = new THREE.MeshStandardMaterial({ color: lin(ok(0.48, 0.03, 160)), metalness: 0.6, roughness: 0.5 });
    g.add(mesh(K.lathe([[0.01, 0], [7, 0], [7.4, 4], [6, 6.5], [0.01, 6.5]], 32, 32), tin));
    const glass = mesh(K.lathe([[4, 6.5], [5.6, 10], [5.2, 15], [3, 18.5]], 32, 32), new THREE.MeshPhysicalMaterial({ color: lin('#fff6e6'), transparent: true, opacity: 0.22, roughness: 0.05, depthWrite: false, side: THREE.DoubleSide })); g.add(glass);
    const top = mesh(K.lathe([[0.01, 18], [4.6, 18.5], [3, 22], [0.01, 22.5]], 32, 32), tin); g.add(top);
    for (let k = 0; k < 4; k++) { const w = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V3(6.6, 6, 0), V3(6.8, 12, 0), V3(4.4, 18.5, 0)]), 12, 0.25, 4), tin); w.rotation.y = k / 4 * TAU + 0.4; g.add(w); }
    const bail = mesh(new THREE.TorusGeometry(6, 0.3, 6, 24, Math.PI), tin); bail.position.y = 22; g.add(bail);
    const f = PR.flame(4.2, 3); f.position.y = 9.5; g.add(f);
    const light = new THREE.PointLight(lin(P.GENDA[1]), 1.2, 700, 1.6); light.position.y = 11; light.castShadow = true; light.shadow.mapSize.set(1024, 1024); light.shadow.bias = -0.002; light.shadow.radius = 6; g.add(light);
    g.userData = { flame: f, light, update(t, k = 1) { if (f.userData.update) f.userData.update(t); light.intensity = k * (2.2 + 0.15 * Math.sin(t * 13) + 0.1 * Math.sin(t * 29)); f.visible = k > 0.02; } };
    return g; }
  // the Monday note: a paper slip with "मौन" in Bapu's quick hand
  function note(text = 'आज मौन') { const t = PR.canvasTex(512, 256, (g, w, h) => { g.fillStyle = ok(0.96, 0.02, 90); g.fillRect(0, 0, w, h); g.fillStyle = ok(0.32, 0.05, 260);
      g.font = '700 120px "Tiro Devanagari Hindi", "Noto Serif Devanagari", serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.save(); g.translate(w / 2, h / 2 + 8); g.rotate(-0.04); g.fillText(text, 0, 0); g.restore();
      g.strokeStyle = 'rgba(80,60,30,.15)'; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(0, 30 + i * 40); g.lineTo(w, 30 + i * 40); g.stroke(); } });
    const m = mesh(new THREE.BoxGeometry(20, 0.12, 10), [khadiM, khadiM, new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 }), khadiM, khadiM, khadiM], false); return m; }
  function matka() { return mesh(K.lathe([[0.01, 0], [6, 0.5], [15, 10], [17, 20], [14, 31], [8, 36], [7.6, 39], [9, 40], [0.01, 39]], 48, 48), PR.M.clay); }
  return { chatai, charkha, desk, letter, pen, inkpot, bucket, broom, stick, lantern, note, matka, bamboo };
};
})();
