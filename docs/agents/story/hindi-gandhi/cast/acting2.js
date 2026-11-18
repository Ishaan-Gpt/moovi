/* acting2.js: acting.js with the same API, aware of the hero rig (herorig.js). On a hero rig the arm IK is anatomical
   (the elbow is a hinge, limited to a human's range; the elbow swivels out of the torso and head; the hand keeps the
   orientation the old solver gave it, and the difference is spread along the forearm as pronation), the body guard
   uses the rig's own proxies (head, torso, pelvis and skirt, thighs, the other arm), BAPU.hand takes { touch } to put the
   fingertips on a point, BAPU.seat sits the rig on a surface of any height, and ACT.plant grounds the feet.
   Old rigs (no rig.hero) run the old code unchanged.
   acting.js: hand-set poses for Bapu and the girl on top of their own clips (pure functions of t; always alive:
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
function clearOfBody(rig, p) { const T = Q(); if (rig.hero) { rig.pushOut(p, 2.3, null); return p; } rig.root.updateMatrixWorld(true);
  for (let it = 0; it < 2; it++) for (const b of bodyProxies(rig)) {
    if (b.type === 's') { const d = p.clone().sub(b.c), L = d.length(); if (L < b.r) p.copy(b.c).addScaledVector(L > 1e-3 ? d.normalize() : new T.Vector3(0, 0, 1), b.r); }
    else { const ab = b.b.clone().sub(b.a), u = Math.min(1, Math.max(0, p.clone().sub(b.a).dot(ab) / ab.lengthSq())), q = b.a.clone().addScaledVector(ab, u), d = p.clone().sub(q), L = d.length();
      if (L < b.r) p.copy(q).addScaledVector(L > 1e-3 ? d.normalize() : new T.Vector3(0, 0, 1), b.r); } }
  return p; }
function reachOld(rig, side, p, pole = [0, -1, -0.4]) {
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
// ---- hero rig: anatomical two-bone arm IK
function reach(rig, side, p, pole = [0, -1, -0.4]) {
  if (!rig.hero) return reachOld(rig, side, p, pole);
  const T = Q(), J = rig.joints, A = J['arm' + side], F = J['foreArm' + side], H = J['hand' + side], sgn = side === 'L' ? 1 : -1;
  rig.proxyRefresh(); p = p.clone(); rig.pushOut(p, 2.3, side, true);
  const sc = rig.root.getWorldScale(new T.Vector3()).x, sh = A.getWorldPosition(new T.Vector3()), l1 = F.position.length(), l2 = H.position.length();
  const pw = A.parent.getWorldQuaternion(new T.Quaternion()), inv = pw.clone().invert();
  const d = p.clone().sub(sh).applyQuaternion(inv).multiplyScalar(1 / sc), Dmin = Math.sqrt(l1 * l1 + l2 * l2 - 2 * l1 * l2 * Math.cos(Math.PI - rig.limits.elbow));
  const D = Math.min(Math.max(d.length(), Dmin), (l1 + l2) * 0.999), dir = d.clone().normalize();
  const a = Math.acos(cl((l1 * l1 + D * D - l2 * l2) / (2 * l1 * D), -1, 1));
  const pv0 = new T.Vector3(...pole); pv0.sub(dir.clone().multiplyScalar(pv0.dot(dir))); if (pv0.lengthSq() < 1e-6) pv0.set(sgn, 0, 0).sub(dir.clone().multiplyScalar(sgn * dir.x)); pv0.normalize();
  const wr = sh.clone().add(dir.clone().multiplyScalar(D * sc).applyQuaternion(pw));
  // swivel the elbow round the shoulder-wrist axis until the upper arm and forearm are clear of the body
  let pv = pv0, up = null; const tries = [0, 0.3, -0.3, 0.6, -0.6, 0.9, -0.9, 1.25, -1.25, 1.6, -1.6];
  for (let i = 0; i < tries.length; i++) { const pvi = pv0.clone().applyAxisAngle(dir, tries[i] * -sgn), upi = dir.clone().multiplyScalar(Math.cos(a)).add(pvi.clone().multiplyScalar(Math.sin(a)));
    const el = sh.clone().add(upi.clone().multiplyScalar(l1 * sc).applyQuaternion(pw)), q1 = el.clone(), q2 = el.clone().lerp(wr, 0.5), q3 = sh.clone().lerp(el, 0.6);
    const hit = (rig.pushOut(q1, 3.0, side, true) && q1.distanceTo(el) > 0.4 * sc) || (rig.pushOut(q2, 2.6, side, true) && q2.distanceTo(el.clone().lerp(wr, 0.5)) > 0.4 * sc) || (rig.pushOut(q3, 3.2, side, true) && q3.distanceTo(sh.clone().lerp(el, 0.6)) > 1.2 * sc);
    if (!up || !hit) { pv = pvi; up = upi; } if (!hit) break; }
  // the old solver's forearm frame (the hand orientation every film was tuned on)
  const qAo = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, -1, 0), up), elL = up.clone().multiplyScalar(l1), fdo = dir.clone().multiplyScalar(D).sub(elL).applyQuaternion(qAo.clone().invert()).normalize();
  const qOld = qAo.clone().multiply(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, -1, 0), fdo));
  // anatomical: Y down the upper arm, Z the way the forearm folds (away from the pole), a pure hinge at the elbow
  const Y = up.clone().negate(), Z = pv.clone().negate(); Z.sub(up.clone().multiplyScalar(Z.dot(up))).normalize(); const X = new T.Vector3().crossVectors(Y, Z);
  A.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(X, Y, Z));
  const flex = Math.PI - Math.acos(cl((l1 * l1 + l2 * l2 - D * D) / (2 * l1 * l2), -1, 1)); F.rotation.set(-flex, 0, 0);
  const tw = A.quaternion.clone().multiply(F.quaternion).invert().multiply(qOld);
  const mem = rig._hb || (rig._hb = {}), m = mem[side]; if (m && m.q1.angleTo(H.quaternion) < 1e-5) H.quaternion.copy(m.q0);
  const q0 = H.quaternion.clone(); H.quaternion.premultiply(tw); mem[side] = { q0, q1: H.quaternion.clone() };
  rig.update();
}
// aim the fingers (the hand's -Y) at a world point, keeping the hand's roll
function fingersTo(rig, side, pt, k = 1) { const T = Q(), H = rig.joints['hand' + side]; rig.root.updateMatrixWorld(true);
  const w = H.getWorldPosition(new T.Vector3()), qw = H.getWorldQuaternion(new T.Quaternion()), cur = new T.Vector3(0, -1, 0).applyQuaternion(qw), want = pt.clone().sub(w).normalize();
  const arc = new T.Quaternion().setFromUnitVectors(cur, want), pq = H.parent.getWorldQuaternion(new T.Quaternion()), tgt = pq.clone().invert().multiply(arc.multiply(qw)); H.quaternion.slerp(tgt, k); rig.update(); }
function plant(rig, which, groundY) { if (rig.hero) rig.plant(which, groundY); }
// thumb and forefinger pinch a world point (a moustache tip, a thread, a page corner): the hand is turned about the wrist
// until the pinch sits on the point with the palm toward 'palmTo', and the wrist is moved by what is left
function pinchTo(rig, side, pt, palmTo, k = 1) { if (!rig.hero || k <= 0) return; const T = Q(), H = rig.joints['hand' + side], h = rig.hands[side], sg = side === 'L' ? 1 : -1;
  const tipI = h.fingers[0][2], tipT = h.thumb[2], li = -tipI.position.y * 0.78, q0 = H.quaternion.clone(), coll = rig.collide; rig.collide = false;
  const pinch = () => { rig.root.updateMatrixWorld(true); return tipI.localToWorld(new T.Vector3(0, -li, 0)).lerp(tipT.localToWorld(new T.Vector3(0, -1.5, 0)), 0.5); };
  const turn = (arc) => { const qw = H.getWorldQuaternion(new T.Quaternion()), pq = H.parent.getWorldQuaternion(new T.Quaternion()); H.quaternion.copy(pq.invert().multiply(arc.multiply(qw))); };
  for (let it = 0; it < 4; it++) { const w = H.getWorldPosition(new T.Vector3()), P = pinch(), a = P.clone().sub(w).normalize(), b = pt.clone().sub(w).normalize(); turn(new T.Quaternion().setFromUnitVectors(a, b));
    if (palmTo) { rig.root.updateMatrixWorld(true); const ax = pinch().sub(w).normalize(), pn = new T.Vector3(-sg, 0, 0).transformDirection(H.matrixWorld), want = palmTo.clone().sub(w);
      pn.sub(ax.clone().multiplyScalar(pn.dot(ax))).normalize(); want.sub(ax.clone().multiplyScalar(want.dot(ax))).normalize(); const ang = Math.atan2(new T.Vector3().crossVectors(pn, want).dot(ax), pn.dot(want)); turn(new T.Quaternion().setFromAxisAngle(ax, ang)); }
    if (it === 1 || it === 2) { const w2 = H.getWorldPosition(new T.Vector3()), off = pt.clone().sub(pinch()); if (off.length() > 0.15) { const keep = H.quaternion.clone(), wq = H.getWorldQuaternion(new T.Quaternion()); reach(rig, side, w2.add(off)); rig.root.updateMatrixWorld(true); H.quaternion.copy(H.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(wq)); } } }
  if (k < 1) { const q1 = H.quaternion.clone(); H.quaternion.copy(q0).slerp(q1, k); }
  rig.collide = coll; rig.update(); }

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
    if (o.up) orientSocket(rig, side, o.up, o.fwd || [0, 0, 1], o.k == null ? 1 : o.k); if (o.touch && rig.hero) fingersTo(rig, side, o.touch, o.tk == null ? 1 : o.tk); rig.update(); },
  // seated on a surface whose top is seatY above the rig's root (a bench, a platform edge): buttocks ON it, thighs along it,
  // shins hanging from the knee; feet plant themselves if the ground is within reach
  seat(rig, t, o = {}) { const J = rig.joints, b = breath(t, 3.2), y = o.seatY == null ? 43 : o.seatY; rig.pose('idle', t);
    J.hips.position.set(0, y + (rig.hero ? 6.4 : 3.5) + 0.2 * b, 0); J.hips.rotation.set(0, 0, 0);
    ['L', 'R'].forEach((S, i) => { const s = i ? -1 : 1; J['leg' + S].rotation.set(rig.hero ? -1.5 : -1.42, 0, s * (o.spread == null ? 0.12 : o.spread)); J['shin' + S].rotation.set(o.knee == null ? (rig.hero ? 1.32 : 1.2) : o.knee, 0, 0); J['foot' + S].rotation.set(0.12, 0, 0); });
    const sl = o.slump || 0; J.torso.rotation.set(0.06 + 0.25 * sl + 0.012 * b, o.twist || 0, 0); J.neck.rotation.set(0.04, 0, 0); J.head.rotation.set(o.pitch || 0, o.yaw || 0, o.roll || 0); rig.update(); },
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
window.ACT = { BAPU, GIRL, reach, reachOld, fingersTo, pinchTo, plant, clearOfBody, orientSocket, attach, headWorld, sockWorld, blinkAt, breath, sm, cl, lerp };
})();
