/* shots.js: the Azad Short's shot list. Every start is a word cue (cues.js), never a fixed second.
   SHOT = { id, set, at() -> start, tr, trDur, run(t, lt, X) -> look }. One place (X.bagh): Alfred Park, one morning.
   Frame 1 is his icon (the moustache twirl, the janeu, the pistol). His death is never shown: the last bullet is a cut
   to birds leaving the jamun tree, then the quiet park. */
(function () {
'use strict';
const { BAPU, reach, orientSocket, attach, headWorld, sockWorld, blinkAt, breath, sm, cl, lerp } = window.ACT;
const W = (w, l, n) => wordT(w, l, n), WE = (w, l, n) => wordE(w, l, n), LS = i => lineT(i).start, LE = i => lineT(i).end;
const sine = x => 0.5 - 0.5 * Math.cos(Math.PI * cl(x));
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const P = window.DANDI_PAL, ok_ = (L, C, h) => P.oklch(L, C, h);
// ---------- camera ----------
const expoOut = x => 1 - Math.pow(1 - cl(x), 4);
function cam(X, lt, dur, p0, p1, t0, t1, fov = 30, roll = 0, ez) {
  const u = ez ? ez(lt / dur) : sine(lt / dur) * 0.8 + 0.2 * cl(lt / dur), c = X.cam; c.fov = fov; c.updateProjectionMatrix();
  const d = [Math.sin(lt * 0.6) * 0.3, Math.sin(lt * 0.43 + 1) * 0.22, 0];
  c.position.set(lerp(p0[0], p1[0], u) + d[0], lerp(p0[1], p1[1], u) + d[1], lerp(p0[2], p1[2], u)); c.up.set(0, 1, 0);
  const tg = V(lerp(t0[0], t1[0], u), lerp(t0[1], t1[1], u), lerp(t0[2], t1[2], u)); c.lookAt(tg); if (roll) c.rotateZ(roll); X.focus = c.position.distanceTo(tg);
  c.updateMatrixWorld(); const r = V(1, 0, 0).applyQuaternion(c.quaternion), wu = V(0, 1, 0);
  const S = X.bagh; S.key.position.copy(c.position).addScaledVector(r, -120).addScaledVector(wu, 110); S.key.target.position.copy(tg);
  const back = tg.clone().sub(c.position).normalize(); S.rim.position.copy(tg).addScaledVector(back, 160).addScaledVector(r, 90).addScaledVector(wu, 120); S.rim.target.position.copy(tg);
  return u; }
// a handheld jolt on an impact (gunshots), decaying fast
function shake(X, t, t0, amp = 2.4) { const u = t - t0; if (u < 0 || u > 0.5) return; const k = amp * Math.exp(-u * 9), c = X.cam;
  c.position.add(new THREE.Vector3(Math.sin(u * 93) * k, Math.cos(u * 71) * k, 0).applyQuaternion(c.quaternion)); c.rotateZ(Math.sin(u * 57) * 0.012 * k); c.updateMatrixWorld(); }
// the dolly zoom (vertigo): the camera pulls back while the lens tightens, the subject holds its size and the world swells
function dollyZoom(X, lt, dur, h, dir, d0, d1, fov0) { const u = sine(lt / dur), d = lerp(d0, d1, u), fov = 2 * Math.atan(Math.tan(fov0 * Math.PI / 360) * d0 / d) * 180 / Math.PI;
  return cam(X, 0, 1, [h.x + dir[0] * d, h.y + dir[1] * d, h.z + dir[2] * d], [h.x + dir[0] * d, h.y + dir[1] * d, h.z + dir[2] * d], [h.x, h.y - 6, h.z], [h.x, h.y - 6, h.z], fov); }
// face camera: offsets from the head (in the rig's own frame via rel), the head at frame height F (0 top .. 1 bottom)
function fc(X, lt, dur, h, o0, o1, F = 0.4, fov = 30, minD = 150) {
  const sc = o => { const L = Math.hypot(o[0], o[1], o[2]), k = Math.max(1, minD / L); return [o[0] * k, o[1] * k, o[2] * k]; };
  const a = sc(o0), b = sc(o1), D = Math.hypot(b[0], b[1], b[2]), sh = (0.5 - F) * 2 * D * Math.tan(fov * Math.PI / 360);
  return cam(X, lt, dur, [h.x + a[0], h.y + a[1], h.z + a[2]], [h.x + b[0], h.y + b[1], h.z + b[2]], [h.x, h.y - sh, h.z], [h.x, h.y - sh, h.z], fov); }
function face(rig, name, t, seed, k = 1, extraBlink = 0) { rig.setExpression(name, k); rig.setBlink(Math.max(blinkAt(t, seed), extraBlink)); }
function faceMix(rig, a, b, k, t, seed, extraBlink = 0) { rig.mix(a, b, k); rig.setBlink(Math.max(blinkAt(t, seed), extraBlink)); }
// ---------- looks: a bright winter morning; the memory in warm sepia; the hush flatter; today clear ----------
const BASE = { contrast: 0.5, sat: 1.04, bloom: 0.12, bloomThr: 0.92, grain: 0.06, split: 0.07, aperture: 0.05 };
const LOOK = {
  morn: Object.assign({}, BASE, { expo: 0.8, shadowTint: ok_(0.34, 0.025, 230), hiTint: '#fff4e4', vigCol: P.NEEM[7] }),
  hush: Object.assign({}, BASE, { expo: 0.78, contrast: 0.46, sat: 0.86, shadowTint: P.AAKASH[6], hiTint: '#f3efe6', vigCol: P.NEEM[7] }),
  aaj: Object.assign({}, BASE, { expo: 0.8, sat: 1.1, shadowTint: P.AAKASH[6], hiTint: '#fff8ec', vigCol: P.NEEM[7] }),
  court: Object.assign({}, BASE, { expo: 0.8, contrast: 0.5, sat: 0.42, split: 0.24, shadowTint: P.SHEESHAM[6], hiTint: '#ffe0b4', vigCol: P.SHEESHAM[7], vig: 1.5, grain: 0.16 }),
};
const look = (X, o) => Object.assign({ focus: X.focus }, LOOK[X.bagh.state], o || {});
// ---------- staging ----------
const TZ = -40;   // the tree (chabutra centre z)
function reset(C) { C.setState(null); C.focusPt = null; [C.saathi, ...C.cops, C.judge, C.boy].forEach(r => { r.root.visible = false; }); C.hero.root.visible = true;
  C.pistol.visible = false; C.mag.visible = false; C.mag.scale.setScalar(1); C.copPistols.forEach(p => { p.visible = false; }); C.flash.intensity = 0; C.flashSprite.visible = false;
  C.puffs.forEach(p => { p.visible = false; }); C.chips.forEach(c => { c.visible = false; }); C.fall.visible = false; C.birds.visible = false; C.scars.forEach(s => { s.visible = false; });
  C.car.position.set(-260, 0, 1020); C.wheels.forEach(w => { w.rotation.z = 0; }); }
function mark(rig, x, z, ry, y = 0) { rig.root.position.set(x, y, z); rig.root.quaternion.setFromEuler(new THREE.Euler(0, ry || 0, 0)); }
const hw = (r) => headWorld(r);
function rel(r, o) { const v = V(o[0], o[1], o[2]).applyQuaternion(r.root.quaternion); return [v.x, v.y, v.z]; }
function mcu(X, r, lt, dur, o0, o1, F = 0.38, fov = 30, minD = 150) { return fc(X, lt, dur, hw(r), rel(r, o0), rel(r, o1), F, fov, minD); }
// on the chabutra's edge facing out (angle a round the tree, 0 = toward the gate)
function edgeAt(a, r = 112) { return [Math.sin(a) * r, TZ + Math.cos(a) * r]; }
function sitEdge(r, t, a, o = {}) { const J = r.joints, b = breath(t, 3.2), [x, z] = edgeAt(a); mark(r, x, z, a + (o.ry || 0)); r.pose('idle', t);
  J.hips.position.set(0, 47 + 0.2 * b, 0); J.hips.rotation.set(0, 0, 0);
  ['L', 'R'].forEach((S, i) => { const s = i ? -1 : 1; J['leg' + S].rotation.set(-1.42, 0, s * 0.12); J['shin' + S].rotation.set(1.2, 0, 0); J['foot' + S].rotation.set(0.1, 0, 0); });
  const sl = o.slump || 0; J.torso.rotation.set(0.06 + 0.25 * sl + 0.012 * b, o.twist || 0, 0); J.neck.rotation.set(0.04, 0, 0); J.head.rotation.set((o.pitch || 0), o.yaw || 0, o.roll || 0);
  r.update(); if (o.hands !== false) handsOnThighs(r); }
function restOn(r, side, p, curl = 0.3) { BAPU.hand(r, side, p, { curl, pole: [side === 'L' ? 0.6 : -0.6, -1, -0.2] }); }
function handsOnThighs(r, which = 'LR') { r.root.updateMatrixWorld(true); const J = r.joints;
  which.split('').forEach(S => { const hip = J['leg' + S].getWorldPosition(V(0, 0, 0)), knee = J['shin' + S].getWorldPosition(V(0, 0, 0)); restOn(r, S, hip.clone().lerp(knee, 0.6).add(V(0, 4.5, 0)), 0.32); }); }
function stand(r, t, x, z, ry, o = {}) { mark(r, x, z, ry); BAPU.stand(r, t, o); }
const PLAT_Y = 43.5;   // the chabutra's top
function onPlat(r, a, rad = 96, ry = 0) { mark(r, Math.sin(a) * rad, TZ + Math.cos(a) * rad, ry, PLAT_Y); }
// the twirl: thumb and finger pinch the right tip of the moustache and roll it up
function twirl(r, t, k = 1) { if (k <= 0) return; r.root.updateMatrixWorld(true); const h = r.root.getObjectByName('headShape');
  const ph = t * 5.2, tip = h.localToWorld(V(-16.5 + 0.6 * Math.sin(ph), -7.5 + 0.8 * Math.cos(ph), 9.5));   // beside the cheek at the moustache tip, never across the face
  const rest = r.joints.shinR.getWorldPosition(V(0, 0, 0)).add(V(0, 10, 4)); BAPU.hand(r, 'R', rest.lerp(tip, k), { curl: 0.62, spread: 0.1, thumb: 0.8, pole: [-0.9, -0.6, -0.3] }); }
// the pistol in his right hand, aimed at world point p (k 0 = resting on the thigh, 1 = arm out)
function aim(r, side, p, k, gun) { r.root.updateMatrixWorld(true); const sh = r.joints['arm' + side].getWorldPosition(V(0, 0, 0));
  const out = sh.clone().add(p.clone().sub(sh).normalize().multiplyScalar(34)), low = r.joints['shin' + side].getWorldPosition(V(0, 0, 0)).add(V(0, 12, 6));
  const hp = low.lerp(out, k); BAPU.hand(r, side, hp, { curl: 0.88, pole: [side === 'L' ? 0.5 : -0.5, -1, -0.2] });
  if (gun) gripGun(r, side, gun); }
// the pistol in the fist: mounted on the hand's grip socket (grip across the palm, barrel along the fingers), never floating
function gripGun(r, side, gun) { const G = window.__GR || { off: [0, 0, 0], rot: [0, 0, -Math.PI / 2] }; attach(gun, r, side, G.off, 1.15);
  gun.rotateX(G.rot[0]); gun.rotateY(G.rot[1]); gun.rotateZ(G.rot[2]); gun.translateX(4.1); gun.translateY(3.0); gun.updateMatrixWorld(true); }   // the grip's centre into the palm
// a shot fired: the flash at the muzzle for a few frames
function fire(C, gun, t, t0, big = 1) { const u = t - t0; if (u < 0 || u > 0.12) return; gun.updateMatrixWorld(true); const m = gun.userData.muzzle.getWorldPosition(V(0, 0, 0));
  C.flash.position.copy(m); C.flash.intensity = 9 * big * (1 - u / 0.12); C.flashSprite.visible = true; C.flashSprite.position.copy(m); C.flashSprite.scale.setScalar(26 * big); C.flashSprite.material.opacity = 0.9 * (1 - u / 0.12); }
function smoke(C, i, p, t, t0, life = 1.6) { const u = (t - t0) / life, sp = C.puffs[i]; if (u < 0 || u > 1) return; sp.visible = true; sp.position.copy(p).add(V(4 * u, 10 * u, 0)); sp.scale.setScalar(10 + 40 * u); sp.material.opacity = 0.5 * (1 - u); }
// a cop at a cover tree, half hidden, aiming at the tree (k: how far he leans out)
function copAt(C, i, x, z, t, k = 1, o = {}) { const r = C.cops[i]; r.root.visible = true; let px = x, pz = z;
  if (o.cover) { const dx = x, dz = z - TZ, L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L; px = x + ux * 46 - uz * 44 * (o.side || 1) * (0.4 + 0.6 * k); pz = z + uz * 46 + ux * 44 * (o.side || 1) * (0.4 + 0.6 * k); }
  mark(r, px, pz, Math.atan2(-px, TZ - pz)); BAPU.stand(r, t, { lean: 0.08 * k });
  face(r, o.face || 'stern', t, 30 + i, 1); aim(r, 'R', V(0, 130, TZ), k, C.copPistols[i]); return r; }
function scarsUpTo(C, n) { C.scars.forEach((s, i) => { s.visible = i < n; }); }
const SHOTS = []; const add = s => SHOTS.push(s);
const shot = (id, at, fn, tr = 'cut', trDur = 0.35) => add({ id, set: 'bagh', at, tr, trDur, run(t, lt, X) { const C = X.bagh; reset(C); return fn(t, lt, X, C, C.hero); } });
// ===================== LINE 0: the icon under the jamun tree =====================
function barkHit(C, r, t, t0, side = 1, cam) { const u = t - t0; if (u < 0) return; r.root.updateMatrixWorld(true); const h = hw(r);
  const rt = V(1, 0, 0).applyQuaternion(cam.quaternion), fw = V(0, 0, -1).applyQuaternion(cam.quaternion), d = fw.clone().negate();
  const hit = h.clone().addScaledVector(rt, 27 * side).addScaledVector(fw, 30).add(V(0, 8, 0));   // on the trunk just beside his head, as the camera sees it
  C.chips.forEach((c, i) => { if (u > 0.9) return; c.visible = true; const a = i * 2.39, v = V(Math.cos(a) * 0.6, 0.6 + 0.5 * ((i * 0.37) % 1), Math.sin(a) * 0.6).add(d.clone().multiplyScalar(1.1)).multiplyScalar(90);
    c.position.copy(hit).addScaledVector(v, u).add(V(0, -260 * u * u, 0)); c.rotation.set(u * 20 + i, u * 14, i); });
  [1, 2, 3].forEach((k, j) => { const sp = C.puffs[k], uu = (u - 0.03 * j) / 0.9; if (uu < 0 || uu > 1) return; sp.visible = true; sp.position.copy(hit).addScaledVector(d, 10 + 30 * uu).add(V((j - 1) * 8 * uu, 14 * uu, 0)); sp.scale.setScalar(14 + 46 * uu); sp.material.color.set(0xd8c3a0); sp.material.opacity = 0.75 * (1 - uu); });
  C.scars[0].visible = true; C.scars[0].parent.updateMatrixWorld(true); C.scars[0].position.copy(C.scars[0].parent.worldToLocal(hit.clone())); }
// HOOK: a bullet smacks the trunk beside his head, bark sprays, he does not flinch, and twirls his moustache
shot('A1-hook', () => 0, (t, lt, X, C, r) => { sitEdge(r, t, 0.15, { pitch: -0.05, yaw: -0.15 - 0.3 * sm(0.42, 0.6, t) * (1 - sm(0.8, 1.0, t)), hands: false }); handsOnThighs(r, 'L');
  twirl(r, t, sm(0.6, 0.9, lt)); faceMix(r, 'resolve', 'smile', sm(0.7, 1.0, lt), t, 1); const h = hw(r), o0 = rel(r, [-140, 60, 560]), o1 = rel(r, [-26, -4, 92]);
  cam(X, lt, 0.42, [h.x + o0[0], h.y + o0[1], h.z + o0[2]], [h.x + o1[0], h.y + o1[1], h.z + o1[2]], [h.x, h.y - 2, h.z], [h.x, h.y - 3, h.z], 32, 0, expoOut);
  barkHit(C, r, t, 0.4, -1, X.cam); shake(X, t, 0.4, 3); return look(X); });
shot('A2-park', () => W('Allahabad', 0) - 0.1, (t, lt, X, C, r) => { sitEdge(r, t, 0.15, { pitch: 0.02, yaw: -0.2 }); face(r, 'calm', t, 2);
  const a = lerp(-0.9, 0.12, expoOut(lt / 1.4)), d = lerp(820, 700, expoOut(lt / 2)); cam(X, 0, 1, [Math.sin(a) * d, 150, TZ + Math.cos(a) * d], [Math.sin(a) * d, 150, TZ + Math.cos(a) * d], [0, 200, TZ], [0, 200, TZ], 40); return look(X); }, 'whip', 0.28);
shot('A2b-ped', () => W('ped', 0) - 0.1, (t, lt, X, C, r) => { sitEdge(r, t, 0.15, { pitch: -0.25, yaw: -0.2 }); face(r, 'calm', t, 2);
  cam(X, lt, 1.2, [70, 20, 260], [56, 60, 200], [0, 200, TZ], [0, 360, TZ], 42, 0, expoOut); return look(X); });
shot('A3-moonch', () => W('moonchon', 0) - 0.1, (t, lt, X, C, r) => { sitEdge(r, t, 0.15, { pitch: -0.08, yaw: 0.1, hands: false }); handsOnThighs(r, 'L'); twirl(r, t, 1); face(r, 'smile', t, 3, 0.7);
  mcu(X, r, lt, 1.2, [-36, -2, 70], [-32, -2, 62], 0.42, 26, 60); return look(X); });
shot('A4-colt', () => W('kamar', 0) - 0.1, (t, lt, X, C, r) => { sitEdge(r, t, 0.15, { pitch: 0.18, yaw: -0.1 }); face(r, 'resolve', t, 4, 0.6);
  r.root.updateMatrixWorld(true); const wst = r.joints.hips.localToWorld(V(-9, 3, 10)); C.pistol.visible = true; C.pistol.position.copy(wst); C.pistol.quaternion.copy(r.root.quaternion).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0.1, -1.35)));
  handsOnThighs(r, 'R'); const h = hw(r); fc(X, lt, 1.7, h.clone().lerp(wst, 0.55), rel(r, [60, 10, 110]), rel(r, [52, 8, 96]), 0.5, 30, 110); return look(X); });
shot('A5-reveal', () => W('kyunki', 0) - 0.1, (t, lt, X, C, r) => { const k = sm(0, 1.0, lt); onPlat(r, 0, 100, 0); BAPU.stand(r, t, { pitch: -0.12, yaw: 0 }); face(r, 'resolve', t, 5, 0.6 + 0.4 * k);
  r.joints.armR.rotation.z = -0.1; r.update(); const h = hw(r); cam(X, lt, 3.2, [30, 70, 330], [20, 90, 260], [0, h.y - 20, 60], [0, h.y - 8, 60], 34); return look(X); });
// ===================== LINE 1: the vow, and where the name came from =====================
shot('A6-naam', () => W('Chandrashekhar', 0) - 0.1, (t, lt, X, C, r) => { onPlat(r, 0, 100, 0); BAPU.stand(r, t, { pitch: -0.05 }); face(r, 'resolve', t, 5);
  [[1, -60, 760], [2, 40, 780]].forEach(([i, x, z]) => { const c = C.cops[i]; c.root.visible = true; mark(c, x, z, Math.PI); BAPU.stand(c, t, {}); face(c, 'stern', t, 40 + i); });
  mcu(X, r, lt, 2.2, [-20, 8, 150], [-16, 8, 128], 0.36, 30, 120); return look(X); });
shot('B1-kasam', () => LS(1) - 0.1, (t, lt, X, C, r) => { sitEdge(r, t, -0.3, { pitch: -0.04, yaw: 0.25, slump: 0.1 }); face(r, 'resolve', t, 6);
  mcu(X, r, lt, 2.2, [60, -4, 150], [54, -4, 136]); return look(X); });
const court = (C) => { C.setState('court'); C.hero.root.visible = false; C.focusPt = C.COURT; };
shot('B2-court', () => W('pandrah', 1) - 0.1, (t, lt, X, C, r) => { court(C); const b = C.boy, j = C.judge, Q = C.COURT; b.root.visible = true; stand(b, t, Q.x, Q.z + 60, Math.PI, { pitch: -0.25 }); face(b, 'resolve', t, 7);
  j.root.visible = true; mark(j, Q.x, Q.z - 185, 0, 70); BAPU.stand(j, t, { pitch: 0.25, lean: 0.12 }); face(j, 'stern', t, 8);
  cam(X, lt, 3.2, [Q.x + 70, 70, Q.z + 230], [Q.x + 60, 66, Q.z + 200], [Q.x, 170, Q.z - 150], [Q.x, 175, Q.z - 160], 36); return look(X); }, 'dissolve', 0.5);
shot('B3-naam', () => W('angrez', 1) - 0.1, (t, lt, X, C, r) => { court(C); const b = C.boy, Q = C.COURT; b.root.visible = true; stand(b, t, Q.x, Q.z + 60, Math.PI, { pitch: -0.3 }); faceMix(b, 'resolve', 'smile', sm(W('Azad', 1) - 0.2, W('Azad', 1) + 0.3, t) * 0.6, t, 9);
  mcu(X, b, lt, 3.4, [30, 14, 150], [26, 18, 132], 0.42); return look(X); });
shot('B4-azad', () => W('isiliye', 1) - 0.1, (t, lt, X, C, r) => { court(C); const j = C.judge, Q = C.COURT; j.root.visible = true; mark(j, Q.x, Q.z - 185, 0, 70); BAPU.stand(j, t, { pitch: 0.2, lean: 0.1 }); faceMix(j, 'stern', 'shocked', sm(W('Azad', 1), W('Azad', 1) + 0.4, t), t, 10);
  const b = C.boy; b.root.visible = true; stand(b, t, Q.x, Q.z + 60, Math.PI, { pitch: -0.3 }); face(b, 'smile', t, 11, 0.5);
  mcu(X, j, lt, 2.6, [-40, -30, 160], [-36, -34, 146], 0.4); return look(X); });
// ===================== LINE 2: a morning's talk, then the car at the gate =====================
shot('C1-baat', () => LS(2) - 0.1, (t, lt, X, C, r) => { sitEdge(r, t, 0.35, { pitch: 0.02, yaw: -0.45 }); faceMix(r, 'calm', 'smile', 0.4 + 0.3 * Math.sin(t * 1.1), t, 12);
  const s = C.saathi; s.root.visible = true; sitEdge(s, t, -0.25, { pitch: 0.06, yaw: 0.45, slump: 0.15 }); face(s, 'neutral', t, 13);
  cam(X, lt, 3.6, [30, 95, 330], [20, 92, 290], [0, 92, 70], [0, 92, 70], 32); return look(X); });
shot('C1b-saathi', () => W('kaam', 2) - 0.1, (t, lt, X, C, r) => { sitEdge(r, t, 0.35, { yaw: -0.45 }); face(r, 'calm', t, 12); const s = C.saathi; s.root.visible = true; sitEdge(s, t, -0.25, { pitch: 0.06, yaw: 0.45, slump: 0.15 }); faceMix(s, 'neutral', 'smile', 0.5, t, 13);
  mcu(X, s, lt, 1.6, [40, -6, 140], [34, -6, 126], 0.4); return look(X); });
shot('C2-gaadi', () => W('tabhi', 2) - 0.1, (t, lt, X, C, r) => { sitEdge(r, t, 0.35, { yaw: -0.3 }); const k = sm(W('tabhi', 2) - 0.1, W('rukti', 2) + 0.3, t);
  C.car.position.set(lerp(-1600, -260, sine(k)), 0, 1020); C.wheels.forEach(w => { w.rotation.z = -C.car.position.x / 26; });
  cam(X, lt, 2.6, [320, 90, 1380], [300, 84, 1340], [-420, 90, 1000], [-260, 80, 980], 36); return look(X); });
shot('C3-khabar', () => W('kyunki', 2) - 0.1, (t, lt, X, C, r) => { sitEdge(r, t, 0.35, { yaw: lerp(-0.3, 0.5, sm(W('police', 2) - 0.3, W('police', 2) + 0.3, t)), pitch: 0.02 });
  faceMix(r, 'calm', 'stern', sm(W('police', 2) - 0.3, W('khabar', 2), t), t, 14);
  r.root.updateMatrixWorld(true); mcu(X, r, lt, 2.6, [-70, -8, 150], [-60, -8, 132], 0.38); return look(X); });
// ===================== LINE 3: "who are you?" and the answer =====================
shot('C3b-gate', () => W('police', 2) - 0.1, (t, lt, X, C, r) => { sitEdge(r, t, 0.35, { yaw: 0.4 }); C.car.position.set(-260, 0, 1020);
  [[1, -150, 740], [2, -80, 760], [3, -10, 750]].forEach(([i, x, z], k) => { const c = C.cops[i]; c.root.visible = true; mark(c, x, z, Math.PI + 0.1 * k); BAPU.stand(c, t, {}); face(c, 'stern', t, 44 + i);
    if (k === 0) BAPU.hand(c, 'R', c.joints.torso.localToWorld(V(-20, 22, 46)), { point: true }); });
  cam(X, lt, 2, [60, 120, 420], [40, 118, 450], [-90, 120, 750], [-90, 118, 750], 30); return look(X); });
shot('D1-afsar', () => LS(3) - 0.1, (t, lt, X, C, r) => { const o = C.officer; o.root.visible = true; const k = sm(0, 2.2, lt), x = lerp(-120, -40, k), z = lerp(640, 330, k);
  mark(o, x, z, Math.atan2(-x, TZ - z)); o.pose(k < 1 ? 'walk' : 'idle', t); o.update(); face(o, 'stern', t, 15); const draw = sm(W('pistol', 3) - 0.2, W('nikaal', 3) + 0.3, t);
  aim(o, 'R', V(0, 90, TZ), draw, C.copPistols[0]); sitEdge(r, t, 0.35, { yaw: 0.4 }); face(r, 'stern', t, 16);
  cam(X, lt, 3.4, [-170, 120, 110], [-150, 118, 130], [x, 130, z], [x, 125, z], 30); return look(X); });
shot('D2-kaun', () => W('poochhta', 3) - 0.1, (t, lt, X, C, r) => { const o = C.officer; o.root.visible = true; mark(o, -40, 330, Math.atan2(40, TZ - 330)); BAPU.stand(o, t, { lean: 0.05 });
  faceMix(o, 'stern', 'angry', sm(W('tum', 3) - 0.1, W('kaun', 3), t), t, 17); aim(o, 'R', V(0, 90, TZ), 1, C.copPistols[0]);
  mcu(X, o, lt, 2, [50, -6, 160], [44, -8, 142], 0.38); return look(X); });
shot('D3-jawaab', () => W('aur', 3) - 0.1, (t, lt, X, C, r) => { const k = sm(W('jawaab', 3) - 0.4, W('jawaab', 3) + 0.1, t); onPlat(r, 0.25, 100, 0.1); BAPU.stand(r, t, { pitch: -0.02 }); face(r, 'angry', t, 18, 0.5 + 0.5 * k);
  aim(r, 'R', V(-40, 120, 330), k, C.pistol); const tf = W('goli', 3) - 0.05; fire(C, C.pistol, t, tf, 1.2); shake(X, t, tf, 2); C.pistol.updateMatrixWorld(true); smoke(C, 0, C.pistol.userData.muzzle.getWorldPosition(V(0, 0, 0)), t, tf);
  mcu(X, r, lt, 2.4, [-210, -24, 110], [-190, -22, 100], 0.34, 38); return look(X); });
shot('D4-haath', () => W('seedha', 3) - 0.1, (t, lt, X, C, r) => { const o = C.officer; o.root.visible = true; mark(o, -40, 330, Math.atan2(40, TZ - 330)); BAPU.stand(o, t, { lean: -0.1 });
  const hit = sm(W('seedha', 3) + 0.1, W('seedha', 3) + 0.35, t); face(o, 'pain', t, 19, hit); o.root.updateMatrixWorld(true);
  if (hit < 0.5) aim(o, 'R', V(0, 90, TZ), 1, C.copPistols[0]); else { const ch = o.joints.torso.localToWorld(V(-4, 18, 12)); BAPU.hand(o, 'R', ch, { curl: 0.85 }); BAPU.hand(o, 'L', ch.clone().add(V(2, 2, 3)), { curl: 0.6 });
    const g = C.copPistols[0]; g.visible = true; g.position.set(-40 + 10, lerp(80, 1, sm(W('seedha', 3) + 0.35, W('haath', 3) + 0.3, t)), 330 + 12); g.rotation.set(0, 0.5, sm(0, 1, hit) * 1.6); }
  mcu(X, o, lt, 2.6, [70, -30, 170], [64, -34, 154], 0.34, 32); return look(X); });
// ===================== LINE 4: fire from every side; the thigh; he sends his friend away =====================
shot('E1-chaaron', () => LS(4) - 0.1, (t, lt, X, C, r) => { onPlat(r, -0.6, 96, -0.4); BAPU.stand(r, t, { pitch: 0 }); face(r, 'stern', t, 20); r.root.updateMatrixWorld(true); aim(r, 'R', V(-560, 120, -380), 0.9, C.pistol);
  [[0, -620, -420], [1, 560, -460], [2, -760, 260], [3, 720, 200]].forEach(([i, x, z]) => { copAt(C, i + 1, x, z, t, 1, { cover: true, side: i % 2 ? 1 : -1 }); });
  const n = Math.floor(sm(LS(4), W('hain', 4), t) * 4); scarsUpTo(C, n);
  [0, 0.45, 0.9, 1.3, 1.75].forEach((d, i) => { const g = C.copPistols[(i % 4)]; if (g.visible) fire(C, g, t, LS(4) + 0.2 + d, 0.9); });
  cam(X, lt, 1.6, [0, 340, 900], [0, 250, 640], [0, 90, TZ - 60], [0, 90, TZ - 60], 46, 0, expoOut); [0, 0.45, 0.9, 1.3, 1.75].forEach(d => shake(X, t, LS(4) + 0.2 + d, 1.4)); return look(X); }, 'whip', 0.26);
shot('E2-jaangh', () => W('aapki', 4) - 0.1, (t, lt, X, C, r) => { const hit = sm(W('jaangh', 4) - 0.05, W('jaangh', 4) + 0.25, t); onPlat(r, -0.5, 96, -0.3); BAPU.stand(r, t, { lean: 0.12 * hit, pitch: 0.15 * hit });
  r.joints.legR.rotation.x = -0.2 * hit; r.joints.shinR.rotation.x = 0.35 * hit; r.update(); faceMix(r, 'stern', 'pain', hit, t, 21);
  r.root.updateMatrixWorld(true); const th = r.joints.legR.localToWorld(V(0, -12, 4)); if (hit > 0.2) BAPU.hand(r, 'L', th, { curl: 0.7 }); aim(r, 'R', V(-560, 120, -380), 0.4 * (1 - hit), C.pistol);
  mcu(X, r, lt, 2.4, [70, -26, 160], [64, -30, 146], 0.34, 32); return look(X); });
shot('E3-bhaga', () => W('par', 4) - 0.1, (t, lt, X, C, r) => { onPlat(r, -0.5, 96, 0.2); BAPU.stand(r, t, { lean: 0.08, yaw: -0.5 }); face(r, 'resolve', t, 22);
  r.root.updateMatrixWorld(true); const wave = sm(W('bhaga', 4) - 0.6, W('bhaga', 4), t); BAPU.hand(r, 'L', r.joints.torso.localToWorld(V(22, 30 + 6 * Math.sin(t * 9) * wave, 20)), { curl: 0.1 }); aim(r, 'R', V(-560, 120, -380), 0.5, C.pistol);
  const s = C.saathi, k = sm(W('bhaga', 4) - 0.2, LE(4) + 1.2, t); s.root.visible = true; const sx = lerp(48, 520, k), sz = lerp(TZ + 84, TZ - 300, k), dr = Math.hypot(sx, sz - TZ); mark(s, sx, sz, k > 0 ? Math.atan2(500, -392) : Math.PI + 0.3, 43.5 * (1 - sm(110, 150, dr))); s.pose(k > 0 ? 'walk' : 'idle', t * 1.6); s.update(); face(s, 'press', t, 23);
  cam(X, lt, 3, [-330, 150, 330], [-310, 144, 300], [0, 130, TZ + 40], [160, 120, TZ - 80], 38); return look(X); });
// ===================== LINE 5: alone behind the tree, counting =====================
shot('F1-aad', () => LS(5) - 0.1, (t, lt, X, C, r) => { onPlat(r, -1.2, 94, -1.0); BAPU.stand(r, t, { lean: 0.1, yaw: 0.5 }); r.joints.shinR.rotation.x = 0.25; r.update(); face(r, 'stern', t, 24); scarsUpTo(C, 5);
  const k = 0.6 + 0.4 * sm(W('akele', 5) - 0.3, W('akele', 5), t); aim(r, 'R', V(-760, 120, 260), k, C.pistol); fire(C, C.pistol, t, W('lad', 5), 1); copAt(C, 3, -760, 260, t, 0.5, { cover: true });
  { const h = hw(r); cam(X, lt, 3, [h.x + 190, h.y + 10, h.z + 220], [h.x + 170, h.y + 6, h.z + 190], [h.x - 10, h.y - 30, h.z], [h.x - 20, h.y - 30, h.z], 34); }; return look(X); });
shot('F2-gin', () => W('ek', 5) - 0.1, (t, lt, X, C, r) => { onPlat(r, -1.2, 94, -1.0); BAPU.stand(r, t, { lean: 0.1, yaw: 0.6 }); r.joints.shinR.rotation.x = 0.25; r.update(); scarsUpTo(C, 5);
  const beats = [W('ek', 5), W('ek', 5, 1), W('goli', 5), W('chala', 5)]; let tt = -9; beats.forEach(b => { if (t >= b) tt = b; }); faceMix(r, 'stern', 'press', sm(tt, tt + 0.15, t) * (1 - sm(tt + 0.25, tt + 0.5, t)), t, 25);
  aim(r, 'R', V(-760, 120, 260), 0.9, C.pistol); beats.slice(2).forEach(b => fire(C, C.pistol, t, b + 0.05, 0.9));
  mcu(X, r, lt, 2.6, [-40, -2, 120], [-34, -2, 106], 0.4, 28, 110); return look(X); });
shot('F3-kareeb', () => W('aur', 5) - 0.1, (t, lt, X, C, r) => { onPlat(r, -1.2, 94, -1.0); BAPU.stand(r, t, { lean: 0.1, yaw: 0.6 }); face(r, 'stern', t, 26); scarsUpTo(C, 6); aim(r, 'R', V(-760, 120, 260), 0.6, C.pistol);
  const k = sm(W('police', 5), LE(5), t); [[1, -620, -420], [2, -760, 260], [3, -420, 620]].forEach(([i, x, z]) => { const cx = lerp(x, x * 0.62, k), cz = lerp(z, TZ + (z - TZ) * 0.62, k); const c = C.cops[i]; c.root.visible = true;
    mark(c, cx, cz, Math.atan2(-cx, TZ - cz)); c.pose('walk', t * 0.7 + i); c.update(); face(c, 'stern', t, 27 + i); aim(c, 'R', V(0, 90, TZ), 0.9, C.copPistols[i]); });
  cam(X, lt, 3, [120, 160, 140], [110, 150, 120], [-500, 80, 140], [-420, 80, 120], 36); return look(X); });
// ===================== LINE 6: one bullet left =====================
shot('G1-khol', () => LS(6) - 0.1, (t, lt, X, C, r) => { onPlat(r, 0.3, 96, 0.2); BAPU.stand(r, t, { pitch: 0.35, lean: 0.12 }); face(r, 'stern', t, 28); scarsUpTo(C, 6);
  r.root.updateMatrixWorld(true); BAPU.hand(r, 'R', r.joints.torso.localToWorld(V(-5, 17, 27)), { curl: 0.88, pole: [-0.6, -1, -0.3] }); gripGun(r, 'R', C.pistol); handsOnThighs(r, 'L');   // he brings the pistol up to check it
  mcu(X, r, lt, 2, [30, -30, 130], [26, -34, 112], 0.32, 32, 110); return look(X); });
shot('G2-ek', () => W('ki', 6) - 0.1, (t, lt, X, C, r) => { onPlat(r, 0.3, 96, 0.2); BAPU.stand(r, t, { pitch: 0.3, lean: 0.08 }); faceMix(r, 'stern', 'shocked', sm(W('bas', 6), W('ek', 6) + 0.2, t) * 0.45, t, 29); scarsUpTo(C, 6);
  r.root.updateMatrixWorld(true); const h = hw(r), m = h.clone().add(V(...rel(r, [-6, -30, 20])));
  BAPU.hand(r, 'L', m, { curl: 0.85, pole: [0.5, -1, -0.2] }); attach(C.mag, r, 'L', [0, 0, 0], 1.25); C.mag.translateY(3); C.mag.updateMatrixWorld(true);
  aim(r, 'R', V(0, 60, 200), 0.1, C.pistol); mcu(X, r, lt, 2.6, [14, -12, 120], [10, -12, 100], 0.42, 28, 100); return look(X, { aperture: 0.07 }); });
// ===================== LINE 7: the choice =====================
shot('H1-faisla', () => LS(7) - 0.1, (t, lt, X, C, r) => { onPlat(r, -0.35, 96, 0.3); BAPU.stand(r, t, { pitch: 0.05 }); r.joints.shinR.rotation.x = 0.25; r.update(); face(r, 'resolve', t, 30); scarsUpTo(C, 6);
  { const h = hw(r), d = rel(r, [0.25, -0.02, 1]); const L = Math.hypot(...d); dollyZoom(X, lt, W('dushman', 7) - LS(7), h, d.map(v => v / L), 120, 300, 34); } return look(X); });
shot('H2-dushman', () => W('dushman', 7) - 0.1, (t, lt, X, C, r) => { onPlat(r, -0.35, 96, 0.3); BAPU.stand(r, t, {}); scarsUpTo(C, 6); r.root.visible = false;
  [[1, -380, 170], [2, -280, 260], [3, 330, 280], [4, 420, 120]].forEach(([i, x, z]) => copAt(C, i, x, z, t, 1, { face: 'stern' }));
  cam(X, lt, 3, [-20, 140, TZ + 40], [-24, 140, TZ + 50], [-300, 110, 260], [-200, 110, 300], 40); return look(X); });
shot('H3-kasam', () => W('ya', 7) - 0.1, (t, lt, X, C, r) => { onPlat(r, -0.35, 96, 0.3); BAPU.stand(r, t, { pitch: 0.02 }); faceMix(r, 'resolve', 'smile', sm(W('kasam', 7), W('nibhaoge', 7) + 0.2, t) * 0.55, t, 31); scarsUpTo(C, 6);
  mcu(X, r, lt, 2.2, [10, 0, 80], [8, 0, 68], 0.42, 26, 60); return look(X); });
// ===================== LINE 8: the last bullet (never shown), the birds, the quiet =====================
shot('I1-antim', () => LS(8) - 0.1, (t, lt, X, C, r) => { sitEdge(r, t, 0.6, { pitch: -0.2, yaw: 0.1, hands: false }); handsOnThighs(r, 'L'); twirl(r, t, sm(0, 0.5, lt)); faceMix(r, 'resolve', 'smile', sm(0.3, 1.4, lt) * 0.7, t, 32); scarsUpTo(C, 6);
  mcu(X, r, lt, W('dhamaake', 8) - LS(8), [-60, -40, 130], [-48, -44, 112], 0.42, 30, 120); return look(X); });
shot('I2-panchhi', () => W('dhamaake', 8) - 0.05, (t, lt, X, C, r) => { r.root.visible = false; scarsUpTo(C, 6); const u = t - W('dhamaake', 8);
  C.birds.visible = true; const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(); for (let i = 0; i < 40; i++) { const a = (i * 2.4) % (Math.PI * 2), sp = 140 + 90 * ((i * 0.37) % 1);
    const p = V(Math.cos(a) * (40 + sp * 0.7 * u), 300 + (i % 7) * 14 + (110 + 50 * ((i * 0.53) % 1)) * u, TZ + Math.sin(a) * (40 + sp * 0.7 * u)); q.setFromEuler(new THREE.Euler(0.3 * Math.sin(t * 30 + i), -a + Math.PI / 2, 0.6 * Math.sin(t * 34 + i)));
    m4.compose(p, q, V(3.2, 3.2, 3.2)); C.birds.setMatrixAt(i, m4); } C.birds.instanceMatrix.needsUpdate = true;
  cam(X, lt, 1.2, [0, 210, 160], [0, 120, 620], [0, 330, TZ], [0, 380, TZ], 42, 0, expoOut); shake(X, t, W('dhamaake', 8) - 0.05, 2.2); return look(X); });
shot('I3-shaant', () => W('shaant', 8) - 0.1, (t, lt, X, C, r) => { r.root.visible = false; scarsUpTo(C, 6); C.fall.visible = true; const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
  for (let i = 0; i < 60; i++) { const u = ((t * 0.12 + i / 60) % 1); q.setFromEuler(new THREE.Euler(t * 2 + i, t * 1.3 + i * 2, 0)); m4.compose(V(-120 + (i * 37) % 240 + 20 * Math.sin(t + i), 300 - 260 * u, TZ + 40 + (i * 53) % 140), q, V(0.55, 0.55, 0.55)); C.fall.setMatrixAt(i, m4); }
  C.fall.instanceMatrix.needsUpdate = true; cam(X, lt, 4, [160, 90, 300], [120, 84, 250], [0, 60, TZ + 60], [0, 56, TZ + 60], 34); return look(X); }, 'dissolve', 0.6);
// ===================== LINE 9: nobody dared; the park's name today; the dare =====================
shot('I4-surya', () => W('Azad', 8) - 0.1, (t, lt, X, C, r) => { r.root.visible = false; scarsUpTo(C, 6); C.fall.visible = true; const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
  for (let i = 0; i < 60; i++) { const u = ((t * 0.1 + i / 60) % 1); q.setFromEuler(new THREE.Euler(t * 2 + i, t * 1.3 + i * 2, 0)); m4.compose(V(-150 + (i * 37) % 300, 420 - 360 * u, TZ + 160 + (i * 53) % 120), q, V(0.6, 0.6, 0.6)); C.fall.setMatrixAt(i, m4); }
  C.fall.instanceMatrix.needsUpdate = true; cam(X, lt, 3, [60, 60, 330], [50, 70, 300], [-120, 420, TZ], [-140, 470, TZ], 42); return look(X, { bloom: 0.4 }); });
shot('J1-himmat', () => LS(9) - 0.1, (t, lt, X, C, r) => { r.root.visible = false; scarsUpTo(C, 6);
  [[1, -380, 170], [2, -280, 260], [3, 330, 280]].forEach(([i, x, z]) => { const c = copAt(C, i, x, z, t, 0.3, { face: 'shocked' }); });
  cam(X, lt, 3.6, [90, 130, 20], [80, 128, 30], [-330, 110, 215], [-330, 110, 215], 40); return look(X); });
shot('J1b-dar', () => W('himmat', 9) - 0.1, (t, lt, X, C, r) => { r.root.visible = false; const c = copAt(C, 1, -380, 170, t, 0.3, { face: 'shocked' }); mcu(X, c, lt, 1.8, [10, -4, 130], [8, -4, 116], 0.38); return look(X); });
shot('J2-aaj', () => W('aaj', 9) - 0.15, (t, lt, X, C, r) => { r.root.visible = false;
  cam(X, lt, 4.2, [0, 175, 1700], [0, 205, 1440], [0, 205, 700], [0, 218, 650], 38); return look(X); }, 'dissolve', 0.6);
shot('J2b-naam', () => W('Chandrashekhar', 9) - 0.1, (t, lt, X, C, r) => { r.root.visible = false; cam(X, lt, 2.4, [0, 214, 1220], [0, 216, 1150], [0, 222, 700], [0, 222, 700], 30); return look(X); });
shot('J3-dare', () => W('Aapki', 9) - 0.1, (t, lt, X, C, r) => { C.setState('aaj'); sitEdge(r, t, 0.0, { pitch: -0.05, hands: false }); handsOnThighs(r, 'L'); twirl(r, t, sm(W('kasam', 9) - 0.3, W('kasam', 9) + 0.3, t));
  faceMix(r, 'resolve', 'smile', 0.3, t, 33); mcu(X, r, lt, W('Comment', 9) - W('Aapki', 9), [0, -6, 170], [0, -6, 140], 0.4, 30, 120); return look(X); });
shot('J4-comment', () => W('Comment', 9) - 0.1, (t, lt, X, C, r) => { C.setState('aaj'); sitEdge(r, t, 0.0, { pitch: -0.05, hands: false }); handsOnThighs(r, 'L'); twirl(r, t, 1); face(r, 'smile', t, 34);
  mcu(X, r, lt, 3, [0, -2, 90], [0, -2, 76], 0.42, 28, 70); return look(X); });
function DUR0() { return filmDuration(); }
window.SHOTS = SHOTS;
})();
