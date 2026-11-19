/* shots.js: the shot list of "GTA 6 Mein Buddha". Every start is a word cue (cues.js), never a fixed second (only the
   first 1.25 s, which sit under the title words, are cut in seconds from the film's start).
   SHOT = { id, set, at() -> start, tr, trDur, run(t, lt, X) -> look }. One place (X.city), one night.
   Nobody is hurt and no shot is fired: the gang scene is tension that ends in stillness (a dolly zoom on the seated
   Buddha, then a pull-back as the guns come down and the city stops to watch). */
(function () {
'use strict';
const { BAPU, reach, orientSocket, attach, headWorld, blinkAt, breath, sm, cl, lerp } = window.ACT;
const W = (w, l, n) => wordT(w, l, n), WE = (w, l, n) => wordE(w, l, n), LS = i => lineT(i).start, LE = i => lineT(i).end;
const sine = x => 0.5 - 0.5 * Math.cos(Math.PI * cl(x)), TAU = Math.PI * 2;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const expoOut = x => 1 - Math.pow(1 - cl(x), 4), expoIn = x => Math.pow(cl(x), 3), backOut = x => { x = cl(x) - 1; return 1 + x * x * (2.6 * x + 1.6); };
const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
// ---------- the story's fixed places ----------
const GC = V(0, 0, 760);            // where the gang closes in and he sits
const CAR = V(352, 0, 250);         // the parked car of mission 1
const OWN = V(214, 0, 318);         // where its owner stands
const MEET = V(118, 0, 318);        // where the Buddha stops in front of him
const T_STOP = () => W('ruk', 8);   // the city stops
// ---------- camera ----------
function lights(X, tg) { const c = X.cam, S = X.city; c.updateMatrixWorld(); const r = V(1, 0, 0).applyQuaternion(c.quaternion), wu = V(0, 1, 0);
  const kd = c.position.clone().sub(tg).normalize().addScaledVector(r, -0.55).addScaledVector(wu, 0.5).normalize(); S.key.position.copy(tg).addScaledVector(kd, 900); S.key.target.position.copy(tg);   // the key sits near the lens, a little left and above: the whole face is lit
  const back = tg.clone().sub(c.position).setY(0).normalize(); S.rim.position.copy(tg).addScaledVector(back, 300).addScaledVector(r, 220).addScaledVector(wu, 200); S.rim.target.position.copy(tg);
  S.rim2.position.copy(tg).addScaledVector(back, 300).addScaledVector(r, -260).addScaledVector(wu, 120); S.rim2.target.position.copy(tg);
  S.bounce.position.copy(tg).addScaledVector(back, -260).addScaledVector(wu, -300); S.bounce.target.position.copy(tg); }
function cam(X, lt, dur, p0, p1, t0, t1, fov = 30, roll = 0, ez, lightAt) {
  const u = ez ? ez(lt / dur) : sine(lt / dur) * 0.8 + 0.2 * cl(lt / dur), c = X.cam; c.fov = fov; c.updateProjectionMatrix();
  const T = X.t || 0, d = [Math.sin(T * 0.9) * 0.9 + Math.sin(T * 2.3) * 0.3, Math.sin(T * 0.73 + 1) * 0.7 + Math.sin(T * 1.9) * 0.25];   // the camera breathes: it is never locked off
  c.position.set(lerp(p0[0], p1[0], u) + d[0], lerp(p0[1], p1[1], u) + d[1], lerp(p0[2], p1[2], u)); c.up.set(0, 1, 0);
  const tg = V(lerp(t0[0], t1[0], u), lerp(t0[1], t1[1], u), lerp(t0[2], t1[2], u)); c.lookAt(tg); if (roll) c.rotateZ(roll); X.focus = c.position.distanceTo(tg);
  lights(X, lightAt || tg); return u; }
function shake(X, t, t0, amp = 2.4, len = 0.5) { const u = t - t0; if (u < 0 || u > len) return; const k = amp * Math.exp(-u * 9 * 0.5 / len), c = X.cam;
  c.position.add(V(Math.sin(u * 93) * k, Math.cos(u * 71) * k, 0).applyQuaternion(c.quaternion)); c.rotateZ(Math.sin(u * 57) * 0.012 * k); c.updateMatrixWorld(); }
function orbit(X, ce, a, d, h, ty, fov = 32, roll = 0) { return cam(X, 0, 1, [ce.x + Math.sin(a) * d, h, ce.z + Math.cos(a) * d], [ce.x + Math.sin(a) * d, h, ce.z + Math.cos(a) * d], [ce.x, ty, ce.z], [ce.x, ty, ce.z], fov, roll, null, V(ce.x, ty, ce.z)); }
function dollyZoom(X, u, h, dir, d0, d1, fov0, drop = 6) { const d = lerp(d0, d1, u), fov = 2 * Math.atan(Math.tan(fov0 * Math.PI / 360) * d0 / d) * 180 / Math.PI, p = [h.x + dir[0] * d, h.y + dir[1] * d, h.z + dir[2] * d];
  return cam(X, 0, 1, p, p, [h.x, h.y - drop, h.z], [h.x, h.y - drop, h.z], fov); }
// face camera: offsets from the head, the head at frame height F (0 top .. 1 bottom)
function fc(X, lt, dur, h, o0, o1, F = 0.4, fov = 30, minD = 90, ez) { F = Math.min(F, 0.33); minD = Math.max(minD, 33.4 / Math.tan(fov * Math.PI / 360));   // a close-up keeps the whole face above y 1230, so the caption line under it is always free
  const sc = o => { const L = Math.hypot(o[0], o[1], o[2]), k = Math.max(1, minD / L); return [o[0] * k, o[1] * k, o[2] * k]; };
  const a = sc(o0), b = sc(o1), D = Math.hypot(b[0], b[1], b[2]), sh = (0.5 - F) * 2 * D * Math.tan(fov * Math.PI / 360);
  return cam(X, lt, dur, [h.x + a[0], h.y + a[1], h.z + a[2]], [h.x + b[0], h.y + b[1], h.z + b[2]], [h.x, h.y - sh, h.z], [h.x, h.y - sh, h.z], fov, 0, ez, h); }
const hw = r => { r.root.updateMatrixWorld(true); return headWorld(r); };
function rel(r, o) { const v = V(o[0], o[1], o[2]).applyQuaternion(r.root.quaternion); return [v.x, v.y, v.z]; }
function mcu(X, r, lt, dur, o0, o1, F = 0.38, fov = 30, minD = 90, ez) { return fc(X, lt, dur, hw(r), rel(r, o0), rel(r, o1), F, fov, minD, ez); }
function face(rig, name, t, seed, k = 1, extraBlink = 0) { rig.setExpression(name, k); rig.setBlink(Math.max(blinkAt(t, seed), extraBlink)); }
function faceMix(rig, a, b, k, t, seed, extraBlink = 0) { rig.mix(a, b, k); rig.setBlink(Math.max(blinkAt(t, seed), extraBlink)); }
// ---------- the look: night neon, the Buddha keyed warm; skin stays natural (no tint in the mids) ----------
const BASE = { contrast: 0.46, sat: 1.1, bloom: 0.5, bloomThr: 1.05, grain: 0.05, split: 0.08, aperture: 0.045, expo: 1.0, shadowTint: '#232c66', hiTint: '#ffeed6', vigCol: '#1a1038', vig: 1.15 };
const look = (X, o) => Object.assign({ focus: X.focus }, BASE, o || {});
// ---------- staging ----------
function mark(rig, x, z, ry, y = 0) { rig.root.position.set(x, y, z); rig.root.quaternion.setFromEuler(new THREE.Euler(0, ry || 0, 0)); }
const toward = (x, z, tx, tz) => Math.atan2(tx - x, tz - z);
function stand(r, t, x, z, ry, o = {}) { mark(r, x, z, ry); BAPU.stand(r, t, o); }
function walk(r, t, x, z, ry, rate = 1) { mark(r, x, z, ry); BAPU.stand(r, t, { clip: 'walk', ct: t * rate }); }
const WALK = 54.7;   // cm/s the walk clip covers at rate 1 (stride 19 over the stance): feet do not slide
function reset(C, t) { C.gang.forEach(r => { r.root.visible = false; }); C.guns.forEach(g => { g.visible = false; }); C.keys.visible = false; C.pick.visible = false; C.marker.visible = false; C.colKey.visible = false; C.colGun.visible = false;
  C.flash.distance = 1600; C.flash.color.set(0xfff2d0).convertSRGBToLinear(); C.beam.visible = C.beamCore.visible = false; C.shock.forEach(s => { s.visible = false; }); C.sparks.forEach(s => { s.visible = false; }); C.aura.intensity = 0.35; C.glowS.material.opacity = 0; C.flash.intensity = 0; C.heliTo = null; C.gather = 0; C.stopT = T_STOP();
  C.hero.root.visible = true; C.owner.root.visible = true; C.ringCars.forEach(c => { c.visible = false; }); C.chaseA.visible = C.chaseB.visible = false; C.hero.root.scale.setScalar(1);
  C.rim2.color.set(0xb46cff).convertSRGBToLinear(); C.rim2.intensity = 0.8; C.key.intensity = 2.5;
  chase(C, t); ownerDefault(C, t); }
// the chase that tears past him in the opening (cars from behind the camera, away toward the tower, then round the corner)
function chase(C, t) { [[C.chaseA, 1.6, -165], [C.chaseB, 1.83, 170]].forEach(([c, t0, x]) => { const s = (t - t0) * 3500; if (t < 0.7 || t > 4.2) return; c.visible = true; const z = 950 - s;
    if (z > -1850) { c.position.set(x + 30 * Math.sin(s * 0.004), 0, z); c.rotation.y = Math.PI + 0.05 * Math.sin(s * 0.004 + 1); } else { const e = -1850 - z, k = sm(0, 500, e); c.position.set(x + e * 0.95, 0, -1850 - 40 * k); c.rotation.y = lerp(Math.PI, Math.PI / 2, k) + 0.25 * Math.sin(k * Math.PI); }
    C.spin(c, s); }); }
// the owner by his car before the Buddha reaches him (he looks about, bored), and the follower afterwards
function ownerDefault(C, t) { const r = C.owner; if (t < W('Laal', 3)) { stand(r, t, OWN.x, OWN.z, -Math.PI / 2 + 0.25, { yaw: 0.5 * Math.sin(t * 0.7), pitch: 0.12 }); face(r, 'neutral', t, 41); } }
const ringAng = [0.0, 1.22, -1.22, 2.42, -2.42];   // the leader in front of him (toward +Z), the rest round the sides and back
function ringPos(i, R = 250) { const a = ringAng[i]; return [GC.x + Math.sin(a) * R, GC.z + Math.cos(a) * R]; }
// a pistol in the fist, on the hand socket (grip across the palm, barrel along the fingers)
function gripGun(r, side, gun) { attach(gun, r, side, [0, 0, 0], 1.15); gun.rotateZ(-Math.PI / 2); gun.translateX(4.1); gun.translateY(3.0); gun.updateMatrixWorld(true); }
// aim at world point p (k 0 = the gun hangs by the thigh, 1 = arm out); a tremble for the unsure hand
function aim(r, side, p, k, gun, tremble = 0, t = 0) { r.root.updateMatrixWorld(true); const s = side === 'L' ? 1 : -1, sh = r.joints['arm' + side].getWorldPosition(V(0, 0, 0));
  const out = sh.clone().add(p.clone().sub(sh).normalize().multiplyScalar(26)).add(V(0, -1, 0)), low = r.joints.hips.localToWorld(V(s * 15.5, -9, 5));
  const hp = low.lerp(out, k); if (tremble) hp.add(V(Math.sin(t * 61) * tremble, Math.sin(t * 47 + 1) * tremble, 0));
  BAPU.hand(r, side, hp, { curl: 0.9, pole: [s * 0.6, -1, -0.3] }); if (gun) gripGun(r, side, gun); }
// the gang on its ring: k 0 = out in the dark, 1 = closed in; guns[i] 0..1 = how far each gun is up
function gang(C, t, k, guns, o = {}) { const hp = V(GC.x, o.aimY == null ? 108 : o.aimY, GC.z);
  C.gang.forEach((r, i) => { r.root.visible = true; const R = lerp(760, i === 0 ? 262 : 250, sm(0, 1, k)), [x, z] = ringPos(i, R), ry = toward(x, z, GC.x, GC.z);
    if (i === 0 && o.leader) { o.leader(r, C.guns[0]); return; }
    if (k < 0.995) walk(r, t + i * 0.37, x, z, ry, 1.5); else stand(r, t + i * 1.7, x, z, ry, { lean: 0.07 * (guns ? guns[i] : 0), yaw: 0 });
    const gk = guns ? guns[i] : 0; if (o.faces) o.faces(r, i); else face(r, gk > 0.5 ? 'stern' : 'neutral', t, 50 + i * 7);
    C.guns[i].visible = true; aim(r, 'R', hp, gk, C.guns[i], o.tremble ? o.tremble[i] || 0 : 0, t); }); }
// the cars that pull up round the ring, headlamps on him (u 0..1 = the arrival)
function ringCars(C, t, u) { C.ringCars.forEach((c, i) => { const [hx, hz, ] = [[-440, 1230], [470, 170], [-470, 60]][i], ry = toward(hx, hz, GC.x, GC.z), e = expoOut(cl(u * 1.15 - i * 0.1)), back = 1500 * (1 - e);
    c.visible = true; c.position.set(hx - Math.sin(ry) * back, 0, hz - Math.cos(ry) * back); c.rotation.y = ry + 0.5 * (1 - e) * (i % 2 ? 1 : -1); C.spin(c, -back); c.rotation.x = -0.035 * Math.sin(Math.PI * cl(e * 1.2)) * (e < 1 ? 1 : 0); }); }
// the owner once he follows: a few steps behind and to one side; later, behind the seated Buddha, keeping low
function ownerBehind(C, t, o = {}) { const r = C.owner; stand(r, t, GC.x + 64, GC.z - 96, 0.2, { lean: 0.16, pitch: 0.1, yaw: o.yaw == null ? 0.3 * Math.sin(t * 2.1) : o.yaw }); face(r, o.face || 'worried', t, 43); }
// ---------- the Buddha's own poses ----------
function heroStand(C, t, x, z, ry, o = {}) { const r = C.hero; stand(r, t, x, z, ry, Object.assign({ pitch: -0.02 }, o)); return r; }
// abhaya: the open right hand raised to the shoulder, palm to the world (k 0..1)
function abhaya(r, k) { if (k <= 0) return; r.root.updateMatrixWorld(true); const J = r.joints, q = r.root.quaternion, rest = J.hips.localToWorld(V(-15, -8, 4)), up = J.armR.getWorldPosition(V(0, 0, 0)).add(V(-7, -3, 15).applyQuaternion(q));
  const f = V(0, 0, 1).applyQuaternion(q), e = sm(0, 1, k); BAPU.hand(r, 'R', rest.lerp(up, e), { curl: lerp(0.3, 0.04, e), spread: 0.05, pole: [-0.5, -1, -0.35], up: [f.x, f.y, f.z], fwd: [0, 1, 0], k: e }); }
// the dhyana hands: both in the lap, palms up, the right on the left
function lapHands(r) { r.root.updateMatrixWorld(true); const J = r.joints, q = r.root.quaternion; ['L', 'R'].forEach((S, i) => { const s = i ? -1 : 1, p = J.hips.localToWorld(V(s * 2.2, 5.5 + (i ? 1.6 : 0), 13.5)), side = V(-s, 0, 0.15).applyQuaternion(q);
    BAPU.hand(r, S, p, { curl: 0.16, pole: [s * 0.9, -0.5, -0.4], up: [0, 1, 0], fwd: [side.x, side.y, side.z], k: 0.9 }); }); }
function heroSit(C, t, o = {}) { const r = C.hero; mark(r, GC.x, GC.z, o.ry || 0); BAPU.sit(r, t, { lean: 0.0, pitch: o.pitch == null ? 0.0 : o.pitch, yaw: o.yaw || 0 }); r.joints.hips.position.y = 16.5 + 0.25 * breath(t, 4.4); r.update(); lapHands(r); return r; }
// stand -> sit, one move (k 0..1): the two poses are solved and blended joint by joint; the hips drop on an ease
const JN = ['hips', 'torso', 'neck', 'head', 'armL', 'armR', 'foreArmL', 'foreArmR', 'handL', 'handR', 'legL', 'legR', 'shinL', 'shinR', 'footL', 'footR'];
function sitDown(C, t, k) { const r = C.hero, J = r.joints; if (k <= 0.001) { heroStand(C, t, GC.x, GC.z, 0); return r; } if (k >= 0.999) return heroSit(C, t);
  heroStand(C, t, GC.x, GC.z, 0); const A = JN.map(n => J[n].quaternion.clone()), ya = J.hips.position.y; heroSit(C, t); const e = sm(0, 1, k);
  JN.forEach((n, i) => { const b = J[n].quaternion.clone(); J[n].quaternion.copy(A[i]).slerp(b, e); }); J.hips.position.y = lerp(ya, J.hips.position.y, e) + 0; J.torso.rotation.x += 0.3 * Math.sin(Math.PI * e); r.update(); return r; }
// ---------- game effects in the world ----------
function beamFx(C, p, k, t) { if (k <= 0) return; C.beam.visible = C.beamCore.visible = true; C.beam.position.set(p.x, 0, p.z); C.beamCore.position.set(p.x, 0, p.z); C.beam.material.opacity = k * 0.55; C.beamCore.material.opacity = k * 0.5; C.beam.material.map.offset.y = -t * 2.2; C.beam.scale.set(1 + 0.06 * Math.sin(t * 40), 1, 1 + 0.06 * Math.sin(t * 40)); C.beamCore.scale.set(k, 1, k); }
function landFx(C, p, u, cam) { if (u < 0) return; C.shock.forEach((s, i) => { const v = (u - i * 0.07) / 0.75; if (v < 0 || v > 1) return; s.visible = true; s.position.x = p.x; s.position.z = p.z; s.scale.setScalar(40 + 900 * expoOut(v)); s.material.opacity = (1 - v) * (1 - v); });
  C.sparks.forEach((s, i) => { const v = u / (0.5 + 0.5 * hash(i)); if (v > 1) return; s.visible = true; const a = hash(i * 3.1) * TAU, sp = 260 + 560 * hash(i * 7.7), up = 300 + 520 * hash(i * 1.9); s.position.set(p.x + Math.cos(a) * sp * u, 4 + up * u - 900 * u * u, p.z + Math.sin(a) * sp * u); if (s.position.y < 2) s.position.y = 2; s.quaternion.copy(cam.quaternion); s.scale.setScalar((16 + 14 * hash(i)) * (1 - v)); });
  C.flash.position.set(p.x, 90, p.z); C.flash.intensity = 7 * Math.exp(-u * 8); }
function markerFx(C, p, t, k = 1, y = 190) { C.marker.visible = k > 0.01; C.marker.position.set(p.x, 0, p.z); C.markerCh.position.y = y + 12 * Math.sin(t * 5) + 300 * (1 - backOut(k)); C.markerCh.rotation.y = t * 2.6; C.markerRing.scale.setScalar(250 * (0.9 + 0.1 * Math.sin(t * 5)) * k); }
function column(col, p, t, k = 1) { col.visible = k > 0.01; col.position.set(p.x, 0, p.z); col.userData.c.material.opacity = 0.9 * k; col.userData.c.material.map.offset.y = -t * 0.8; col.userData.r.scale.setScalar(56 * (1 + 0.12 * Math.sin(t * 6))); }
const PICK = V(GC.x + 4, 0, GC.z + 92);   // the pistol the game offers him, on the road at his feet
function pickGun(C, t, k = 1) { column(C.colGun, PICK, t, k); C.pick.visible = k > 0.01; C.pick.position.set(PICK.x, 46 + 5 * Math.sin(t * 3), PICK.z); C.pick.rotation.set(0, t * 2.4, 0.25); C.pick.scale.setScalar(1.3 * k); }
function halo(C, r, k, cam) { const h = hw(r); C.glowS.position.copy(h).addScaledVector(V(0, 0, -1).applyQuaternion(cam.quaternion), 60); C.glowS.material.opacity = 0.3 * k; C.glowS.scale.setScalar(240 + 60 * k); C.aura.position.set(h.x, h.y + 40, h.z + 40); C.aura.intensity = 0.35 + 1.5 * k; }

const SHOTS = []; const shot = (id, at, fn, tr = 'cut', trDur = 0.22) => SHOTS.push({ id, set: 'city', at, tr, trDur, run(t, lt, X) { const C = X.city; X.t = t; reset(C, t); const L = fn(t, lt, X, C, C.hero); C.update(t, X.cam); return L; } });
// ===================== LINE 0: the spawn, the title, the city, the vow =====================
const T_LAND = 0.6;
const fallY = t => t >= T_LAND ? 0 : 1700 * Math.pow(1 - t / T_LAND, 1.35);
function falling(C, t) { const r = C.hero, y = fallY(t), dip = t >= T_LAND ? 13 * Math.exp(-(t - T_LAND) * 9) * Math.cos((t - T_LAND) * 13) : 0; mark(r, 0, 0, 0, y); BAPU.stand(r, t + 2, { pitch: t < T_LAND ? 0.04 : -0.02 }); const J = r.joints;
  if (t < T_LAND) { ['L', 'R'].forEach((S, i) => { const s = i ? -1 : 1; J['arm' + S].rotation.set(0.05, 0, s * (0.5 + 0.06 * Math.sin(t * 40 + i))); J['foreArm' + S].rotation.set(-0.3, 0, 0); r.hands[S].curl(0.1, 0.2); J['leg' + S].rotation.set(0.06, 0, s * 0.04); J['shin' + S].rotation.set(0.12, 0, 0); J['foot' + S].rotation.set(0.5, 0, 0); }); }
  else { J.hips.position.y -= dip > 0 ? dip : 0; } r.update(); face(r, 'serene', t, 3, 1, 0); return r; }
// frame 1: his calm face in the spawn beam, high over the city, already falling; the camera rides down with him
shot('A0-spawn-face', () => 0, (t, lt, X, C, r) => { falling(C, t); beamFx(C, V(0, 0, 0), 0.35, t); const h = hw(r), k = expoIn(lt / 0.3);
  cam(X, 0, 1, [h.x + lerp(14, 60, k), h.y + lerp(-10, -70, k), h.z + lerp(84, 330, k)], [0, 0, 0], [h.x, h.y - lerp(2, 30, k), h.z], [0, 0, 0], lerp(34, 46, k), -0.12 + 0.1 * k, x => 0, h); halo(C, r, 1, X.cam); return look(X, { bloom: 0.5, aperture: 0.02 }); });
// he lands in the middle of the neon street: shock rings, sparks, a jolt
shot('A1-land', () => 0.3, (t, lt, X, C, r) => { falling(C, t); beamFx(C, V(0, 0, 0), 1 - sm(T_LAND + 0.05, T_LAND + 0.5, t), t); landFx(C, V(0, 0, 0), t - T_LAND, X.cam);
  const z = expoOut((t - T_LAND - 0.02) / 0.4); cam(X, 0, 1, [lerp(190, 110, z), lerp(22, 60, z), lerp(560, 330, z)], [0, 0, 0], [0, lerp(260, 104, sm(0.3, T_LAND, t)), 0], [0, 0, 0], lerp(50, 34, z), 0.06 * (1 - z), null, V(0, 100, 0));
  shake(X, t, T_LAND, 7, 0.45); halo(C, r, sm(T_LAND, T_LAND + 0.2, t) * 0.6, X.cam); return look(X, { bloom: 0.6 + 0.5 * Math.exp(-Math.max(0, t - T_LAND) * 7) }); });
// a whip into a fast orbit that settles on him; behind, the chase is already coming
shot('A2-orbit', () => 1.0, (t, lt, X, C, r) => { heroStand(C, t, 0, 0, 0); face(r, 'serene', t, 3); const u = expoOut(lt / 0.75), a = lerp(-2.3, 0.35, u); orbit(X, V(0, 0, 0), a, lerp(330, 250, u), lerp(46, 104, u), lerp(96, 112, u), 36, 0.05 * (1 - u)); halo(C, r, 0.4, X.cam); return look(X); }, 'whip', 0.2);
// "duniya ka sabse hinsak game": the chase tears past on both sides of him; he does not move
shot('A3-chase', () => W('duniya', 0) - 0.04, (t, lt, X, C, r) => { heroStand(C, t, 0, 0, 0, { yaw: 0 }); face(r, 'serene', t, 3); const J = r.joints; J.torso.rotation.z += 0.03 * Math.sin(t * 30) * sm(1.8, 1.95, t) * sm(2.3, 2.0, t); r.update();
  cam(X, lt, 0.9, [-34, 30, 470], [-22, 44, 400], [0, 104, 0], [0, 108, 0], 40, -0.03); shake(X, t, 1.72, 5, 0.35); shake(X, t, 1.95, 6, 0.4); return look(X, { aperture: 0.03 }); });
shot('A4-away', () => W('hinsak', 0) + 0.12, (t, lt, X, C, r) => { heroStand(C, t, 0, 0, Math.PI); face(r, 'serene', t, 3); C.flash.position.set(900, 260, -1700); C.flash.distance = 2600; C.flash.color.set(0xff8a3a).convertSRGBToLinear(); C.flash.intensity = 5 * Math.max(0, Math.sin(t * 31)) * sm(2.35, 2.5, t);
  cam(X, lt, 0.9, [70, 150, 250], [110, 230, 420], [0, 170, -400], [0, 240, -900], 38, 0.04, expoOut, V(0, 100, 0)); return look(X); }, 'whip', 0.16);
// "aur ek aisa aadmi jisne kasam khaayi hai": his face; the open hand comes up
shot('A5-vow', () => W('aur', 0) - 0.08, (t, lt, X, C, r) => { heroStand(C, t, 0, 0, 0.1); abhaya(r, sm(W('jisne', 0) - 0.1, W('kasam', 0) + 0.1, t)); faceMix(r, 'serene', 'calm', sm(3.4, 4.2, t), t, 5);
  mcu(X, r, lt, 1.5, [-42, -6, 170], [-24, -3, 112], 0.4, 30, 90, expoOut); halo(C, r, 0.5, X.cam); return look(X); });
shot('A6-hand', () => W('khaayi', 0) + 0.1, (t, lt, X, C, r) => { heroStand(C, t, 0, 0, 0.1); abhaya(r, 1); face(r, 'calm', t, 5); const u = sine(lt / 2.1), a = lerp(0.75, 0.15, u);
  const k = sm(W('zara', 0), W('zara', 0) + 0.12, t); orbit(X, V(0, 0, 4), a, lerp(250, 188, k), lerp(64, 84, u), lerp(104, 110, k), 34, 0.03); halo(C, r, 0.5 + 0.5 * sm(W('nahi', 0), W('nahi', 0) + 0.3, t), X.cam); return look(X); });
// ===================== LINE 1: the street, the first mission =====================
shot('B1-street', () => LS(1) - 0.14, (t, lt, X, C, r) => { walk(r, t, 0, -30 + WALK * lt, 0); face(r, 'serene', t, 6); const u = expoOut(lt / 1.25);
  cam(X, 0, 1, [lerp(-240, -70, u), lerp(1500, 210, u), lerp(1500, 700, u)], [0, 0, 0], [0, lerp(900, 140, u), lerp(-2400, -200, u)], [0, 0, 0], lerp(52, 40, u), 0.08 * (1 - u), null, V(0, 100, 0)); return look(X, { aperture: 0.02 }); }, 'whip', 0.2);
shot('B2-neon', () => W('bhari', 1) - 0.06, (t, lt, X, C, r) => { const z0 = -30 + WALK * (W('bhari', 1) - LS(1)); walk(r, t, 0, z0 + WALK * lt, 0); face(r, 'serene', t, 6); const hz = r.root.position.z;
  cam(X, lt, 1.1, [-250, 36, hz + 150], [-236, 44, hz + 60], [10, 96, hz + 10], [10, 100, hz + 30], 36, -0.04); return look(X); });
// the mission lands on the car: the game's marker drops, the keys wait in a pick-up column
shot('B3-mission', () => W('aur', 1) - 0.08, (t, lt, X, C, r) => { heroStand(C, t, 0, 60, 0.9, { yaw: 0.25 }); face(r, 'serene', t, 6); const k = sm(W('mission', 1) - 0.05, W('mission', 1) + 0.3, t); markerFx(C, CAR, t, k, 215);
  column(C.colKey, V(150, 0, 200), t, 1); C.keys.visible = true; C.keys.position.set(150, 64 + 4 * Math.sin(t * 3), 200); C.keys.rotation.set(0, t * 3, 0); C.keys.scale.setScalar(3.2);
  const u = sine(lt / 1.6); cam(X, 0, 1, [lerp(-120, -92, u), lerp(150, 136, u), lerp(-130, -84, u)], [0, 0, 0], [lerp(170, 240, u), 96, lerp(170, 220, u)], [0, 0, 0], lerp(44, 38, u), 0, null, V(0, 100, 60)); shake(X, t, W('mission', 1) + 0.02, 2.5, 0.3); return look(X); });
shot('B4-car', () => W('ye', 1) - 0.1, (t, lt, X, C, r) => { heroStand(C, t, 40, 120, 0.9); face(r, 'serene', t, 6); markerFx(C, CAR, t, 1, 215); const u = expoOut(lt / 0.5), a = lerp(-0.2, -0.75, sine(lt / 1.2));
  cam(X, 0, 1, [CAR.x + Math.sin(a) * lerp(900, 430, u) - 60, lerp(120, 58, u), CAR.z + Math.cos(a) * lerp(900, 430, u) + 120], [0, 0, 0], [CAR.x - 40, 84, CAR.z + 20], [0, 0, 0], 38, 0.05 * (1 - u), null, V(CAR.x - 100, 80, CAR.z + 100)); return look(X); });
// ===================== LINE 2: the keys go back =====================
const walkStart = () => W('Toh', 2) - 0.1, heroPath = (t) => { const u = cl((t - walkStart()) / (W('hain', 2) - walkStart())), e = u; return V(lerp(40, MEET.x, e), 0, lerp(150, MEET.z, e)); };
function holdKeys(C, r, sway = 0) { attach(C.keys, r, 'R', [0, 0, 0], 2.1); C.keys.quaternion.copy(r.root.quaternion); C.keys.rotateZ(sway); C.keys.translateY(-1.5); }
shot('C1-walk', () => walkStart(), (t, lt, X, C, r) => { const p = heroPath(t), ry = toward(40, 150, MEET.x, MEET.z); walk(r, t, p.x, p.z, ry, 1.5); face(r, 'serene', t, 7); r.hands.R.curl(0.75); holdKeys(C, r, 0.25 * Math.sin(t * 9));
  markerFx(C, CAR, t, 1 - sm(0.2, 0.7, lt), 215); const f = V(Math.sin(ry), 0, Math.cos(ry)); cam(X, lt, 1.2, [p.x + f.x * 250 - 60, 66, p.z + f.z * 250 + 40], [p.x + f.x * 215 - 40, 80, p.z + f.z * 215 + 30], [p.x, 96, p.z], [p.x, 100, p.z], 34, 0.03); return look(X); });
shot('C2-owner', () => W('paas', 2) - 0.08, (t, lt, X, C, r) => { const p = heroPath(t), ry = toward(40, 150, MEET.x, MEET.z); if (t < W('hain', 2)) walk(r, t, p.x, p.z, ry, 1.5); else heroStand(C, t, MEET.x, MEET.z, Math.PI / 2); face(r, 'serene', t, 7); r.hands.R.curl(0.75); holdKeys(C, r, 0.1 * Math.sin(t * 9));
  const o = C.owner, k = sm(0.1, 0.45, lt); stand(o, t, OWN.x, OWN.z, -Math.PI / 2 + 0.1, { lean: -0.1 * k, yaw: 0, pitch: -0.04 }); faceMix(o, 'neutral', 'shocked', k, t, 41); const J = o.joints; ['L', 'R'].forEach((S, i) => { const s = i ? -1 : 1; J['arm' + S].rotation.set(lerp(0.03, -0.9, k), 0, s * lerp(0.17, 0.75, k)); J['foreArm' + S].rotation.set(lerp(-0.24, -1.75, k), 0, 0); o.hands[S].curl(lerp(0.24, 0.02, k), 0.3 * k); }); o.update();
  const h = hw(o); cam(X, lt, 1.1, [h.x - 150, h.y - 4, h.z + 120], [h.x - 118, h.y - 2, h.z + 96], [h.x - 6, h.y - 14, h.z], [h.x - 4, h.y - 12, h.z], 34, -0.03, expoOut, h); shake(X, t, W('paas', 2) + 0.15, 1.6, 0.25); return look(X); });
function meet(C, t, o = {}) { const r = C.hero, ow = C.owner; heroStand(C, t, MEET.x, MEET.z, Math.PI / 2, { pitch: -0.1, yaw: 0 }); face(r, 'serene', t, 7, 1);
  const fear = o.fear == null ? 1 : o.fear; stand(ow, t, OWN.x, OWN.z, -Math.PI / 2, { lean: -0.06 * fear, pitch: 0.1 }); faceMix(ow, 'worried', 'shocked', fear, t, 41);
  const J = ow.joints, up = o.handsUp == null ? fear : o.handsUp; ['L', 'R'].forEach((S, i) => { const s = i ? -1 : 1; J['arm' + S].rotation.set(lerp(0.03, -0.9, up), 0, s * lerp(0.17, 0.75, up)); J['foreArm' + S].rotation.set(lerp(-0.24, -1.75, up), 0, 0); ow.hands[S].curl(lerp(0.24, 0.02, up), 0.3 * up); }); ow.update(); }
shot('C3-eyes', () => W('shaanti', 2) - 0.1, (t, lt, X, C, r) => { meet(C, t, { fear: 1 - 0.3 * sm(0, 1.4, lt), handsUp: 0.55 }); r.hands.R.curl(0.75); holdKeys(C, r, 0); face(r, 'calm', t, 7, 1);
  mcu(X, r, lt, 1.4, [-96, 4, 130], [-80, 3, 112], 0.42, 26, 80); halo(C, r, 0.35, X.cam); return look(X, { aperture: 0.07 }); });
shot('C4-owner-soft', () => W('aankhon', 2) + 0.1, (t, lt, X, C, r) => { const k = sm(0, 0.9, lt); meet(C, t, { fear: 1 - 0.75 * k, handsUp: 1 - 0.55 * k }); r.hands.R.curl(0.75); holdKeys(C, r, 0);
  mcu(X, C.owner, lt, 1.0, [92, 2, 128], [78, 2, 112], 0.42, 28, 80); return look(X, { aperture: 0.07 }); });
// the keys into his shaking palm: both faces stay in the frame
shot('C5-keys', () => W('aur', 2) - 0.08, (t, lt, X, C, r) => { const give = sm(W('chaabi', 2) - 0.1, W('haath', 2), t), put = sm(W('rakh', 2) - 0.1, W('rakh', 2) + 0.12, t); meet(C, t, { fear: 0.3, handsUp: 0 });
  const ow = C.owner, mid = V((MEET.x + OWN.x) / 2 + 6, 82, MEET.z + 3), tr = 1.1 * (1 - put * 0.6), tp = mid.clone().add(V(8 + Math.sin(t * 57) * tr, -3 + Math.sin(t * 43 + 1) * tr, Math.sin(t * 49) * tr * 0.6));
  const restL = ow.joints.hips.localToWorld(V(15, -8, 4)); BAPU.hand(ow, 'L', restL.lerp(tp, sm(0, 0.5, give)), { curl: lerp(0.24, 0.08 + 0.5 * put, give), pole: [0.6, -1, -0.3], up: [0, 1, 0], fwd: [-1, 0, 0], k: give });
  faceMix(ow, 'worried', 'shocked', 0.3 + 0.5 * put, t, 41); ow.joints.head.rotation.x += 0.25 * give; ow.update();
  const restR = r.joints.hips.localToWorld(V(-15, -8, 4)), over = mid.clone().add(V(4, 9 - 5 * put, 0)); BAPU.hand(r, 'R', restR.lerp(over, give), { curl: lerp(0.75, 0.2, put), pole: [-0.6, -1, -0.3] });
  if (put < 0.5) holdKeys(C, r, 0.1 * Math.sin(t * 8)); else { C.keys.visible = true; ow.root.updateMatrixWorld(true); const s = ow.sockets.handL.getWorldPosition(V(0, 0, 0)); C.keys.position.copy(s).add(V(0, 2.2, 0)); C.keys.rotation.set(Math.PI / 2, 0, 0.6); C.keys.scale.setScalar(2.1); }
  const pin = sm(W('uske', 2) - 0.05, W('uske', 2) + 0.14, t), cd = lerp(1, 0.78, pin);   // 9:16 is too narrow for a flat two-shot: over the owner's shoulder, the Buddha's face and both hands in the frame
  cam(X, lt, 1.9, [mid.x + 176 * cd, 100 + 30 * cd, mid.z + 196 * cd], [mid.x + 160 * cd, 98 + 28 * cd, mid.z + 204 * cd], [mid.x - 14, 98, mid.z], [mid.x - 12, 96, mid.z], 34, 0, null, mid); return look(X, { aperture: 0.03 }); });
// ===================== LINE 3: the star turns gold; the owner follows =====================
shot('D1-star', () => LS(3) - 0.18, (t, lt, X, C, r) => { meet(C, t, { fear: 0.2, handsUp: 0 }); const g = sm(W('sunehra', 3) - 0.05, W('jal', 3) + 0.1, t); faceMix(r, 'serene', 'calm', g, t, 8);
  C.rim2.color.set(0xff2a2a).convertSRGBToLinear(); C.rim2.intensity = 2.6 * (0.5 + 0.5 * Math.sin(t * 14)) * (1 - g);   // the red of a wanted level sweeps him, and goes out
  const u = sine(lt / 2.6), a = lerp(Math.PI / 2 - 1.0, Math.PI / 2 - 0.35, u), pk = sm(W('sunehra', 3) - 0.08, W('sunehra', 3) + 0.1, t), h = hw(r);
  cam(X, 0, 1, [h.x + Math.sin(a) * lerp(210, 150, pk), lerp(40, 58, u), h.z + Math.cos(a) * lerp(210, 150, pk)], [0, 0, 0], [h.x, h.y - 8, h.z], [0, 0, 0], 34, -0.04, null, h); halo(C, r, g, X.cam); return look(X, { bloom: 0.5 + 0.35 * g * Math.exp(-Math.max(0, t - W('jal', 3)) * 3) }); });
shot('D2-owner-stunned', () => W('aur', 3) - 0.08, (t, lt, X, C, r) => { meet(C, t, { fear: 0.0, handsUp: 0 }); const ow = C.owner, k = sm(0.2, 0.7, lt); faceMix(ow, 'shocked', 'worried', 0.4 * k, t, 41);
  const p = ow.joints.torso.localToWorld(V(9, 18, 17)); BAPU.hand(ow, 'L', p, { curl: 0.5, pole: [0.7, -0.8, -0.3], up: [0, 1, 0], fwd: [-1, 0, 0.2], k: 0.9 }); ow.joints.head.rotation.x += lerp(0.16, -0.02, k); ow.joints.head.rotation.y += lerp(0, 0.2, k); ow.update();
  ow.root.updateMatrixWorld(true); const s = ow.sockets.handL.getWorldPosition(V(0, 0, 0)); C.keys.visible = true; C.keys.position.copy(s).add(V(0, 2.2, 0)); C.keys.rotation.set(Math.PI / 2, 0, 0.6); C.keys.scale.setScalar(2.1);
  mcu(X, ow, lt, 1.1, [-52, -8, 150], [-40, -6, 118], 0.36, 30, 80, expoOut); return look(X, { aperture: 0.06 }); });
const followStart = () => W('unke', 3) - 0.12, heroWalk2 = t => { const u = Math.max(0, t - followStart()); return V(60, 0, 420 + WALK * 1.4 * u); };
shot('D3-follow', () => followStart(), (t, lt, X, C, r) => { const p = heroWalk2(t); walk(r, t, p.x, p.z, 0, 1.4); face(r, 'serene', t, 9); const ow = C.owner; walk(ow, t + 0.3, p.x + 58, p.z - 104, -0.05, 1.4); face(ow, 'worried', t, 41); ow.joints.head.rotation.y -= 0.25; ow.update();
  cam(X, lt, 1.4, [p.x - 40, 74, p.z + 260], [p.x - 24, 84, p.z + 236], [p.x + 18, 96, p.z - 20], [p.x + 18, 98, p.z - 20], 34, 0.03); halo(C, r, 0.5, X.cam); return look(X); });
// ===================== LINE 4: the gang =====================
const T4 = () => LS(4) - 0.1, closeK = t => sm(T4() + 0.35, W('hai,', 4), t);
function gangScene(C, t, o = {}) { const r = C.hero; if (!o.keepHero) { heroStand(C, t, GC.x, GC.z, 0, { yaw: o.yaw || 0 }); face(r, 'serene', t, 10); } ringCars(C, t, o.cars == null ? cl((t - T4()) / 0.9) : o.cars); if (!o.noOwner) ownerBehind(C, t, o.owner); gang(C, t, o.k == null ? closeK(t) : o.k, o.guns, o); }
const gunsUp = t => C5.map((d) => sm(W('sabki', 4) + d, W('sabki', 4) + d + 0.22, t)), C5 = [0.0, 0.14, 0.26, 0.38, 0.5];
shot('E1-headlights', () => T4(), (t, lt, X, C, r) => { gangScene(C, t, { guns: [0, 0, 0, 0, 0] }); const u = expoOut(lt / 0.7);
  cam(X, 0, 1, [lerp(120, 40, u), lerp(26, 40, u), GC.z + lerp(700, 520, u)], [0, 0, 0], [0, lerp(70, 100, u), GC.z - 60], [0, 0, 0], 44, 0.07 * (1 - u), null, V(0, 100, GC.z)); shake(X, t, T4() + 0.42, 4, 0.4); shake(X, t, T4() + 0.62, 3, 0.4); return look(X, { aperture: 0.02 }); }, 'whip', 0.18);
shot('E2-ring', () => W('chaaron', 4) - 0.06, (t, lt, X, C, r) => { gangScene(C, t, { guns: [0, 0, 0, 0, 0] }); const u = expoOut(lt / 1.1), a = lerp(2.6, 5.4, u); orbit(X, V(GC.x, 0, GC.z), a, lerp(520, 430, u), lerp(160, 120, u), 96, 40, 0.06 * (1 - u)); return look(X, { aperture: 0.02 }); });
shot('E3-guns', () => W('sabki', 4) - 0.06, (t, lt, X, C, r) => { gangScene(C, t, { k: 1, guns: gunsUp(t) }); const flip = t >= W('tani', 4) - 0.02, i = 0, [x, z] = ringPos(i, flip ? 300 : 345), sd = flip ? -1 : 1, u = sine((flip ? t - W('tani', 4) : lt) / 0.7);
  /* behind a gunman's shoulder, the Buddha's face beyond the barrel; on "tani" the same from the other side, tighter */
  const an = ringAng[i], off = flip ? lerp(30, 26, u) : lerp(46, 38, u); cam(X, 0, 1, [x + Math.cos(an) * off * sd + Math.sin(an) * 30, lerp(140, 132, u), z - Math.sin(an) * off * sd + Math.cos(an) * 30], [0, 0, 0], [GC.x, 100, GC.z], [0, 0, 0], flip ? 30 : 36, sd * 0.04, null, V(GC.x, 100, GC.z)); C5.forEach(d => shake(X, t, W('sabki', 4) + d + 0.2, 1.4, 0.18)); return look(X, { aperture: 0.03 }); });
shot('E4-crane', () => W('aur', 4) - 0.06, (t, lt, X, C, r) => { gangScene(C, t, { k: 1, guns: [1, 1, 1, 1, 1] }); pickGun(C, t, backOut(sm(W('hukum', 4) - 0.05, W('hukum', 4) + 0.25, t)));
  const u = sine(lt / 1.5); orbit(X, V(GC.x, 0, GC.z), lerp(0.25, 0.8, u), lerp(700, 560, u), lerp(470, 380, u), 50, 40, 0.04); return look(X, { aperture: 0.012 }); });
shot('E5-pick', () => W('hathiyaar', 4) - 0.08, (t, lt, X, C, r) => { gangScene(C, t, { k: 1, guns: [1, 1, 1, 1, 1] }); r.joints.head.rotation.x += 0.2 * sm(0.1, 0.5, lt); r.update(); pickGun(C, t, 1); const u = expoOut(lt / 0.34), v = sm(0.38, 0.9, lt);
  cam(X, 0, 1, [PICK.x + lerp(110, 36, u), lerp(96, 30, u) + 30 * v, PICK.z + lerp(330, 150, u) + 60 * v], [0, 0, 0], [PICK.x, lerp(50, 46, u) + 50 * v, PICK.z - 60 * v], [0, 0, 0], lerp(40, 34, u), 0.04, null, V(GC.x, 100, GC.z)); shake(X, t, W('hathiyaar', 4), 2.4, 0.3); return look(X, { aperture: 0.05 }); });
// ===================== LINE 5: the choice =====================
const still = { k: 1, guns: [1, 1, 1, 1, 1] };
shot('F1-choice', () => LS(5) - 0.1, (t, lt, X, C, r) => { gangScene(C, t, still); pickGun(C, t, 1); face(r, 'serene', t, 11); mcu(X, r, lt, 1.2, [-44, -4, 250], [-34, -2, 200], 0.36, 30, 200); halo(C, r, 0.3, X.cam); return look(X, { aperture: 0.06 }); });
// bhaago: the one gap in the ring, and the open road beyond it
shot('F2-run', () => W('jaan', 5) - 0.08, (t, lt, X, C, r) => { gangScene(C, t, still); pickGun(C, t, 1); const u = expoOut(lt / 0.6), a = 1.82; markerFx(C, V(GC.x + Math.sin(a) * 620, 0, GC.z + Math.cos(a) * 620), t, sm(0.05, 0.3, lt), 120);
  cam(X, 0, 1, [GC.x - Math.sin(a) * lerp(170, 110, u) + 30 + 70 * Math.cos(a), lerp(170, 150, u), GC.z - Math.cos(a) * lerp(170, 110, u) - 70 * Math.sin(a)], [0, 0, 0], [GC.x + Math.sin(a) * 600, 70, GC.z + Math.cos(a) * 600], [0, 0, 0], lerp(40, 52, u), -0.05, null, V(GC.x, 100, GC.z)); return look(X, { aperture: 0.02 }); }, 'whip', 0.16);
// lado: the pistol the game holds out
shot('F3-fight', () => W('ya', 5) - 0.06, (t, lt, X, C, r) => { gangScene(C, t, still); pickGun(C, t, 1); const u = expoOut(lt / 0.45), w = sine(lt / 1.4);
  cam(X, 0, 1, [PICK.x - lerp(190, 96, u) - 14 * w, lerp(90, 52, u), PICK.z + lerp(280, 160, u)], [0, 0, 0], [PICK.x, 48, PICK.z], [0, 0, 0], 36, 0.06, null, V(GC.x, 100, GC.z)); shake(X, t, W('lado,', 5), 2.2, 0.3); return look(X, { aperture: 0.09 }); }, 'whip', 0.16);
// neither: his eyes close
shot('F4-neither', () => W('par', 5) - 0.1, (t, lt, X, C, r) => { const cls = sm(W('kuch', 5), W('karte.', 5) + 0.1, t); gangScene(C, t, still); pickGun(C, t, 1 - sm(W('nahi', 5), W('karte.', 5) + 0.2, t)); face(r, 'serene', t, 11, 1, 0.75 * cls);
  mcu(X, r, lt, 2.3, [44, -2, 250], [30, -1, 205], 0.4, 28, 205); halo(C, r, 0.3 + 0.4 * cls, X.cam); return look(X, { aperture: 0.07 }); });
// ===================== LINE 6: he sits =====================
const sitK = t => sm(W('paalthi', 6) - 0.25, W('jaate', 6) + 0.05, t);
function sitScene(C, t, o = {}) { const k = o.k == null ? 1 : o.k, r = sitDown(C, t, k); face(r, 'serene', t, 12, 1, o.shut == null ? 1 : o.shut); gangScene(C, t, Object.assign({ keepHero: true, k: 1, guns: [1, 1, 1, 1, 1], aimY: lerp(108, 60, k), cars: 1 }, o)); return r; }
shot('G1-sit', () => LS(6) - 0.1, (t, lt, X, C, r) => { const k = sitK(t); sitScene(C, t, { k, shut: 0.6, tremble: [0, 0.5 * k, 0.5 * k, 0.5 * k, 0.5 * k] }); const y = lerp(104, 44, k);
  cam(X, lt, 2.0, [-250, y + 10, GC.z + 150], [-196, lerp(104, 40, k), GC.z + 120], [GC.x, y - 6, GC.z], [GC.x, lerp(98, 50, k), GC.z], 36, -0.03, null, V(GC.x, 80, GC.z)); return look(X, { aperture: 0.05 }); });
shot('G2-eyes', () => W('aankhein', 6) - 0.1, (t, lt, X, C, r) => { sitScene(C, t, { shut: lerp(0.3, 1, sm(W('band', 6) - 0.06, W('lete', 6), t)) }); mcu(X, r, lt, 1.2, [-12, 2, 96], [-8, 2, 74], 0.44, 24, 60); halo(C, r, 0.6, X.cam); return look(X, { aperture: 0.09 }); });
// the dolly zoom: he holds his size and the shouting world swells round him
function noise(C, t, k) { C.gang.forEach((g, i) => { if (!i) return; g.joints.torso.rotation.y += 0.18 * k * Math.sin(t * (7 + i) + i); g.joints.head.rotation.x += 0.1 * k * Math.sin(t * (9 + i * 1.3)); g.update(); }); C.ringCars.forEach((c, i) => { c.userData.beam.material.opacity = 1; c.userData.beam.material.color.setScalar(0.07 + 0.1 * k * (Math.sin(t * (11 + i * 3)) > 0.2 ? 1 : 0)); }); }
shot('G3-dollyzoom', () => W('aur', 6) - 0.1, (t, lt, X, C, r) => { sitScene(C, t, { tremble: [0, 1.2, 1.2, 1.2, 1.2], faces: (g, i) => face(g, 'angry', t, 60 + i) }); noise(C, t, 1); const u = sine(lt / 2.3); dollyZoom(X, u, hw(r), [0.14, 0.1, 0.985], 170, 520, 46, 8); X.cam.rotateZ(0.02 * Math.sin(t * 2)); halo(C, r, 0.8, X.cam); return look(X, { aperture: 0.03, bloom: 0.55 }); });
// ===================== LINE 7: the leader, and the trigger nobody pulls =====================
const leadK = t => sm(LS(7) - 0.05, W('aakar', 7) + 0.1, t), gunK = t => sm(W('bandook', 7) - 0.1, W('taan', 7), t), dipK = t => sm(W('nahi', 7) - 0.05, LE(7) + 0.3, t);
function leaderScene(C, t, o = {}) { const r = sitScene(C, t, { tremble: [0, 0.4, 0.4, 0.4, 0.4], guns: o.guns || [1, 1, 1, 1, 1], faces: o.faces, leader: (L, gun) => { const k = leadK(t), z = GC.z + lerp(262, 96, k); if (k < 0.995) walk(L, t, GC.x + 6, z, Math.PI, 1.6); else stand(L, t, GC.x + 6, z, Math.PI, { lean: 0.14, pitch: 0.28 });
    L.root.visible = true; faceMix(L, 'stern', 'worried', o.doubt || 0, t, 50); gun.visible = true; const h = hw(C.hero); aim(L, 'R', V(h.x, h.y + 2, h.z + 14), o.gun == null ? Math.max(0.25, gunK(t)) * (1 - 0.8 * dipK(t)) : o.gun, gun, o.tr == null ? 0.25 : o.tr, t); } }); return r; }
shot('H1-leader', () => LS(7) - 0.1, (t, lt, X, C, r) => { leaderScene(C, t); const L = C.leader, lz = L.root.position.z; cam(X, lt, 1.3, [150, 50, lz + 250], [128, 56, lz + 210], [GC.x, 70, GC.z + 40], [GC.x, 66, GC.z + 40], 38, 0.04, null, V(GC.x, 60, GC.z)); return look(X, { aperture: 0.05 }); });
shot('H2-gunpoint', () => W('bandook', 7) - 0.08, (t, lt, X, C, r) => { leaderScene(C, t); const h = hw(r); cam(X, lt, 1.6, [GC.x + 96, 128, GC.z + 230], [GC.x + 84, 120, GC.z + 205], [GC.x + 4, 70, GC.z + 20], [GC.x + 4, 68, GC.z + 20], 34, -0.03, null, h); /* over the leader's gun arm, down onto the seated Buddha */ shake(X, t, W('taan', 7), 2, 0.3); halo(C, r, 0.5, X.cam); return look(X, { aperture: 0.05 }); });
shot('H3-leader-face', () => W('aur', 7) - 0.08, (t, lt, X, C, r) => { const d = sm(0.1, 1.3, lt); leaderScene(C, t, { doubt: d, tr: 0.3 + 1.0 * d }); const L = C.leader; mcu(X, L, lt, 1.4, [120, -30, 215], [100, -26, 190], 0.29, 28, 200); return look(X, { aperture: 0.08 }); });
shot('H4-nobody', () => W('koi', 7) - 0.06, (t, lt, X, C, r) => { leaderScene(C, t, { doubt: 1, tr: 1.2 * (1 - dipK(t)) }); const h = hw(r); cam(X, lt, 1.2, [GC.x - 96, h.y + 30, GC.z + 196], [GC.x - 84, h.y + 22, GC.z + 172], [h.x, h.y - 12, h.z], [h.x, h.y - 12, h.z], 30, 0.03, null, h); X.focus = lerp(80, X.focus, sm(0.1, 0.55, lt)); halo(C, r, 0.7, X.cam); return look(X, { aperture: 0.12 }); });
// ===================== LINE 8: the guns come down; the city stops =====================
const downAt = () => [W('Ek', 8) + 0.02, W('karke', 8) + 0.1, W('saari', 8) + 0.14, W('neeche', 8), W('jhuk', 8) + 0.1];
const gunsDown = t => downAt().map(a => 1 - sm(a, a + 0.4, t));
function endScene(C, t, o = {}) { const g = gunsDown(t), calm = 1 - Math.min(...g); const r = sitScene(C, t, { guns: g, faces: (m, i) => faceMix(m, 'stern', 'sad', 1 - g[i], t, 60 + i), leader: (L, gun) => { const bk = sm(LS(8) + 0.25, LS(8) + 1.5, t), lx = GC.x + lerp(6, 118, bk), lz = GC.z + lerp(96, 196, bk); stand(L, t, lx, lz, toward(lx, lz, GC.x, GC.z), { lean: 0.14 * g[0], pitch: 0.28 * (1 - bk) + 0.1 }); /* he backs away as his gun comes down */ L.root.visible = true; faceMix(L, 'worried', 'sad', 1 - g[0], t, 50); gun.visible = true; const h = hw(C.hero); aim(L, 'R', V(h.x, h.y + 2, h.z + 14), 0.2 * g[0], gun, 0, t); }, owner: { face: 'calm', yaw: 0 } });
  const st = sm(T_STOP() - 0.2, T_STOP() + 1.2, t); C.gather = st; C.heliTo = { p: V(GC.x, 0, GC.z), k: sm(T_STOP() - 0.6, T_STOP() + 0.9, t) }; C.ringCars.forEach(c => { c.userData.beam.material.color.setScalar(0.07); }); return r; }
shot('I1-down', () => LS(8) - 0.1, (t, lt, X, C, r) => { endScene(C, t); const u = sine(lt / 2.0), a = lerp(0.9, -1.15, u); orbit(X, V(GC.x, 0, GC.z + 30), a, lerp(430, 380, u), lerp(170, 140, u), 66, 38, 0.03); downAt().forEach(a => shake(X, t, a + 0.3, 1.2, 0.2)); halo(C, r, 0.7, X.cam); return look(X, { aperture: 0.03 }); });
// the pull-back: from his face out over the ring, the cars, the people, the whole stopped street
shot('I2-city', () => W('jab', 8) - 0.1, (t, lt, X, C, r) => { endScene(C, t); const u = expoOut(lt / 2.6) * 0.9 + 0.1 * cl(lt / 3.4), h = hw(r);
  cam(X, 0, 1, [lerp(-40, -330, u), lerp(74, 980, Math.pow(u, 1.25)), GC.z + lerp(170, 1380, u)], [0, 0, 0], [GC.x, lerp(h.y - 4, 110, u), GC.z - 160 * u], [0, 0, 0], lerp(34, 42, u), 0.05 * u, null, V(GC.x, 60, GC.z)); halo(C, r, 1, X.cam); return look(X, { aperture: 0.015, bloom: 0.56 }); });
// ===================== LINE 9: the dare, on his calm face =====================
const openK = t => sm(W('toh', 9) - 0.05, W('kya', 9) + 0.2, t);
shot('J1-face', () => LS(9) - 0.1, (t, lt, X, C, r) => { endScene(C, t); face(r, 'serene', t, 12, 1, 1 - openK(t)); mcu(X, r, lt, 1.5, [-30, 6, 190], [-18, 4, 120], 0.4, 28, 70, expoOut); halo(C, r, 0.9, X.cam); return look(X, { aperture: 0.09 }); });
shot('J2-eyes', () => W('toh', 9) - 0.06, (t, lt, X, C, r) => { endScene(C, t); const o = openK(t); faceMix(r, 'serene', 'smile', 0.55 * sm(0.3, 1.0, lt), t, 12, 1 - o); r.setGaze && r.setGaze([0.06, 0.02]);
  mcu(X, r, lt, 1.3, [-14, 3, 100], [-10, 2, 82], 0.43, 24, 60); halo(C, r, 1, X.cam); return look(X, { aperture: 0.1 }); });
shot('J3-dare', () => W('Comment', 9) - 0.1, (t, lt, X, C, r) => { endScene(C, t); faceMix(r, 'serene', 'smile', 0.6, t, 12, 0); r.setGaze && r.setGaze([0.0, 0.02]); const u = sine(lt / 2.2), a = lerp(-0.3, 0.2, u);
  const h = hw(r); cam(X, 0, 1, [h.x + Math.sin(a) * 150, h.y + 6, h.z + Math.cos(a) * 150], [0, 0, 0], [h.x, h.y - 16, h.z], [0, 0, 0], 30, 0, null, h); halo(C, r, 1, X.cam); return look(X, { aperture: 0.07 }); });
window.SHOTS = SHOTS; window.BUDDHA_PLACES = { GC, CAR, PICK };
})();
