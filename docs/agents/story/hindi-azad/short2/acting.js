/* acting.js: hand-set poses for Bapu and the girl on top of their own clips (pure functions of t; always alive:
   breathing, blinks, saccades). Joint conventions: arm/leg rotation.x < 0 swings forward, shin.x > 0 bends the knee,
   foreArm.x < 0 bends the elbow, torso/neck/head rotation.x > 0 leans forward / chin down, rotation.y > 0 turns to the
   character's left (+X), arm rotation.z > 0 lifts the LEFT arm out (s * z lifts either arm out). After hand-set joints
   call rig.update(). */
(function () {
'use strict';
const cl = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x)), sm = (a, b, x) => { const t = cl((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, k) => a + (b - a) * k, TAU = Math.PI * 2;
function blinkAt(t, seed = 0) { const per = [3.1, 2.3, 4.2, 1.7, 3.6, 2.8]; let k = 0, acc = -seed;
  while (acc < t + 5) { const p = per[k % per.length] * (0.85 + 0.3 * ((k * 0.618) % 1)); if (t >= acc && t < acc + 0.16) return Math.sin((t - acc) / 0.16 * Math.PI); acc += p; k++; } return 0; }
const breath = (t, per = 3.6) => Math.sin(t * TAU / per);
const Q = () => window.THREE;
function headWorld(rig) { return rig.root.getObjectByName('headShape').getWorldPosition(new (Q().Vector3)()); }
function sockWorld(rig, side) { rig.root.updateMatrixWorld(true); return rig.sockets['hand' + side].getWorldPosition(new (Q().Vector3)()); }
function attach(obj, rig, side, off = [0, 0, 0], scale = 1) { rig.root.updateMatrixWorld(true); const s = rig.sockets['hand' + side]; const T = Q();
  const p = new T.Vector3(...off).applyQuaternion(s.getWorldQuaternion(new T.Quaternion())).add(s.getWorldPosition(new T.Vector3()));
  obj.position.copy(p); obj.quaternion.copy(s.getWorldQuaternion(new T.Quaternion())); obj.scale.setScalar(scale); obj.visible = true; }
function orientSocket(rig, side, up, fwd, k = 1) {
  const T = Q(), hand = rig.joints['hand' + side], sock = rig.sockets['hand' + side];
  rig.root.updateMatrixWorld(true);
  const pq = new T.Quaternion(); hand.parent.getWorldQuaternion(pq);
  const qs = sock.quaternion.clone();
  const U = new T.Vector3(...up).normalize(), F = new T.Vector3(...fwd); F.sub(U.clone().multiplyScalar(F.dot(U))).normalize();
  const Xv = new T.Vector3().crossVectors(U, F);
  const m = new T.Matrix4().makeBasis(Xv, U, F); const qt = new T.Quaternion().setFromRotationMatrix(m);
  const qh = qt.multiply(qs.invert()); const loc = pq.invert().multiply(qh);
  hand.quaternion.slerp(loc, k); rig.update && rig.update();
}
// two-bone arm IK: put the hand joint of 'side' at world point p (elbow bends down/out by 'pole' in torso space)
// the body's collision proxies (head sphere, torso capsule) in world space, scaled with the rig
function bodyProxies(rig) { const T = Q(), J = rig.joints, sc = rig.root.getWorldScale(new T.Vector3()).x, hs = rig.root.getObjectByName('headShape');
  const out = []; if (hs) out.push({ type: 's', c: hs.getWorldPosition(new T.Vector3()), r: 17.5 * sc });
  if (J.hips && J.neck) out.push({ type: 'c', a: J.hips.getWorldPosition(new T.Vector3()).add(new T.Vector3(0, 6 * sc, 0)), b: J.neck.getWorldPosition(new T.Vector3()).add(new T.Vector3(0, -4 * sc, 0)), r: 15.5 * sc });
  return out; }
// push a hand target out of the body (a wrist is about 4 cm thick): hands rest ON the face or chest, never inside them
function clearOfBody(rig, p) { const T = Q(); rig.root.updateMatrixWorld(true);
  for (let it = 0; it < 2; it++) for (const b of bodyProxies(rig)) {
    if (b.type === 's') { const d = p.clone().sub(b.c), L = d.length(); if (L < b.r) p.copy(b.c).addScaledVector(L > 1e-3 ? d.normalize() : new T.Vector3(0, 0, 1), b.r); }
    else { const ab = b.b.clone().sub(b.a), u = Math.min(1, Math.max(0, p.clone().sub(b.a).dot(ab) / ab.lengthSq())), q = b.a.clone().addScaledVector(ab, u), d = p.clone().sub(q), L = d.length();
      if (L < b.r) p.copy(q).addScaledVector(L > 1e-3 ? d.normalize() : new T.Vector3(0, 0, 1), b.r); } }
  return p; }
function reach(rig, side, p, pole = [0, -1, -0.4]) {
  const T = Q(), J = rig.joints, A = J['arm' + side], F = J['foreArm' + side], H = J['hand' + side];
  rig.root.updateMatrixWorld(true); p = clearOfBody(rig, p.clone());
  const sh = A.getWorldPosition(new T.Vector3()), l1 = F.position.length(), l2 = H.position.length();
  const pw = A.parent.getWorldQuaternion(new T.Quaternion()), inv = pw.clone().invert();
  const d = p.clone().sub(sh).applyQuaternion(inv); const D = Math.min(d.length(), (l1 + l2) * 0.999), dir = d.clone().normalize();
  const a = Math.acos(cl((l1 * l1 + D * D - l2 * l2) / (2 * l1 * D), -1, 1));
  const pv = new T.Vector3(...pole); pv.sub(dir.clone().multiplyScalar(pv.dot(dir))).normalize();
  const up = dir.clone().multiplyScalar(Math.cos(a)).add(pv.clone().multiplyScalar(Math.sin(a)));   // upper arm direction
  // the upper arm hangs along -Y: rotate -Y onto 'up'
  A.quaternion.setFromUnitVectors(new T.Vector3(0, -1, 0), up);
  A.updateMatrixWorld(true);
  const el = A.getWorldPosition(new T.Vector3()).add(up.clone().applyQuaternion(pw).multiplyScalar(l1));
  const fd = p.clone().sub(el).applyQuaternion(A.getWorldQuaternion(new T.Quaternion()).invert()).normalize();
  F.quaternion.setFromUnitVectors(new T.Vector3(0, -1, 0), fd);
  rig.update && rig.update();
}
const BAPU = {
  stand(rig, t, o = {}) { const J = rig.joints; rig.pose(o.clip || 'idle', o.ct == null ? t : o.ct);
    if (o.yaw != null) J.head.rotation.y = o.yaw + 0.04 * Math.sin(t * 1.3);
    if (o.pitch != null) J.head.rotation.x += o.pitch; if (o.roll != null) J.head.rotation.z += o.roll; if (o.twist != null) J.torso.rotation.y += o.twist;
    if (o.lean != null) J.torso.rotation.x += o.lean; rig.update(); },
  // lying on the back on the mat (the shot sets root: it lies along +X with the head at -X); lift raises both hands above the face
  lie(rig, t, o = {}) { const J = rig.joints; rig.pose('idle', t); const b = breath(t, 4);
    J.hips.position.set(0, 51, 0); J.hips.rotation.set(0, 0, 0); J.torso.rotation.set(-0.02 + 0.015 * b, 0, 0); J.neck.rotation.set(-0.1, 0, 0); J.head.rotation.set(-0.15 + (o.pitch || 0), o.yaw || 0, o.roll || 0);
    ['L', 'R'].forEach((S, i) => { const s = i ? -1 : 1; J['leg' + S].rotation.set(0.02, 0, s * 0.05); J['shin' + S].rotation.set(0.05, 0, 0); J['foot' + S].rotation.set(-0.7, 0, 0);
      const lift = o.lift || 0; J['arm' + S].rotation.set(lerp(0.02, -1.25, lift), 0, s * lerp(0.12, 0.06, lift)); J['foreArm' + S].rotation.set(lerp(-0.15, -0.95, lift) + 0.06 * lift * Math.sin(t * 2 + i), 0, 0);
      J['hand' + S].rotation.set(lerp(0, -0.4, lift), s * lerp(0.3, -1.2 + 0.4 * Math.sin(t * 1.6 + i * 1.3) * lift, lift), 0); rig.hands[S].curl(lerp(0.35, 0.12, lift), 0.25 * lift); });
    rig.update(); },
  // seated cross-legged on the floor (root on the floor under the hips)
  sit(rig, t, o = {}) { const J = rig.joints, b = breath(t, 3.6); rig.pose('idle', t);
    J.hips.position.set(0, 15 + 0.2 * b, 0); J.hips.rotation.set(0, 0, 0);
    ['L', 'R'].forEach((S, i) => { const s = i ? -1 : 1; J['leg' + S].rotation.set(-1.45, 0, s * 0.95); J['shin' + S].rotation.set(0, 0, 0); J['shin' + S].rotation.set(2.55, 0, 0); J['foot' + S].rotation.set(-0.3, 0, 0); });
    J.torso.rotation.set((o.lean == null ? 0.06 : o.lean) + 0.012 * b, o.twist || 0, 0); J.neck.rotation.set(0.04, 0, 0); J.head.rotation.set((o.pitch || 0) - 0.06 + 0.01 * b, o.yaw || 0, o.roll || 0);
    // hands rest on the knees
    ['L', 'R'].forEach((S, i) => { const s = i ? -1 : 1; J['arm' + S].rotation.set(-0.35, 0, s * 0.22); J['foreArm' + S].rotation.set(-0.95, 0, 0); J['hand' + S].rotation.set(0.1, s * 0.6, 0); rig.hands[S].curl(0.35); });
    rig.update(); },
  // sitting on the heels (kneeling low beside someone)
  crouch(rig, t, o = {}) { const J = rig.joints, b = breath(t, 3.4); rig.pose('idle', t);
    J.hips.position.set(0, 24 + 0.2 * b, 0); ['L', 'R'].forEach((S, i) => { const s = i ? -1 : 1; J['leg' + S].rotation.set(-0.35, 0, s * 0.18); J['shin' + S].rotation.set(2.7, 0, 0); J['foot' + S].rotation.set(0.9, 0, 0); });
    J.torso.rotation.set(0.25 + (o.lean || 0) + 0.012 * b, o.twist || 0, 0); J.neck.rotation.set(0.05, 0, 0); J.head.rotation.set((o.pitch || 0) - 0.05, o.yaw || 0, o.roll || 0);
    ['L', 'R'].forEach((S, i) => { const s = i ? -1 : 1; J['arm' + S].rotation.set(-0.55, 0, s * 0.15); J['foreArm' + S].rotation.set(-0.85, 0, 0); J['hand' + S].rotation.set(0.1, s * 0.5, 0); rig.hands[S].curl(0.35); });
    rig.update(); },
  // a hand to a world point (IK) with a finger pose
  hand(rig, side, p, o = {}) { reach(rig, side, p, o.pole); if (o.point) { rig.point(side, 1); } else if (o.curl != null) rig.hands[side].curl(o.curl, o.spread || 0, o.thumb == null ? null : o.thumb);
    if (o.up) orientSocket(rig, side, o.up, o.fwd || [0, 0, 1], o.k == null ? 1 : o.k); rig.update(); },
};
const GIRL = {
  stand(rig, t, o = {}) { const J = rig.joints; rig.pose('idle', t); if (o.yaw != null) J.head.rotation.y = o.yaw; if (o.pitch != null) J.head.rotation.x += o.pitch; rig.update(); },
  // sitting on the ground where she fell, legs out in front; rub (0..1) brings both fists to the eyes
  sit(rig, t, o = {}) { const J = rig.joints, b = breath(t, 1.6); rig.pose('idle', t);
    J.hips.position.set(0, 7, 0); ['L', 'R'].forEach((S, i) => { const s = i ? -1 : 1; J['leg' + S].rotation.set(-1.45, 0, s * 0.25); J['shin' + S].rotation.set(0.15, 0, 0); J['foot' + S].rotation.set(-0.6, 0, 0); });
    const sob = (o.sob || 0) * Math.abs(Math.sin(t * TAU * 1.4));
    J.torso.rotation.set(0.12 + 0.05 * sob + 0.015 * b, 0, 0); J.head.rotation.set((o.pitch || 0) - 0.05 + 0.06 * sob, o.yaw || 0, o.roll || 0);
    const r = cl(o.rub || 0);
    ['L', 'R'].forEach((S, i) => { const s = i ? -1 : 1; J['arm' + S].rotation.set(lerp(0.0, -0.95, r), 0, s * lerp(0.35, 0.2, r)); J['foreArm' + S].rotation.set(lerp(-0.2, -2.2, r) + 0.15 * r * Math.sin(t * 9 + i), 0, 0); J['hand' + S].rotation.set(0, s * lerp(0.3, 0.9, r), 0); rig.hands[S].curl(lerp(0.3, 0.85, r)); });
    rig.update(); },
};
window.ACT = { BAPU, GIRL, reach, orientSocket, attach, headWorld, sockWorld, blinkAt, breath, sm, cl, lerp };
})();
