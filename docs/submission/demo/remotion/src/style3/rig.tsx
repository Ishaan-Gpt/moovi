import React from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { V3, kf, lerp } from "./lib";
import { Path, Travel, path as mkPath } from "./motion";
import type { PostParams } from "./post";

// Style 3 camera rigs. A rig is a pure function t → camera state, so the same rig drives the R3F camera, the DOF
// focus and the motion blur (blur needs the camera at t − shutter: we just evaluate the rig there).

export type CamState = { pos: V3; look: V3; fov: number; roll: number; focus: number };
export type Rig = (t: number) => CamState;
type Num = number | ((t: number) => number);
const val = (v: Num | undefined, t: number, d = 0) => (v === undefined ? d : typeof v === "number" ? v : v(t));

/** vertical fov (deg) of a lens (mm) on a 36 mm-wide sensor; aspect = width / height of the output */
export const lensFov = (mm: number, aspect = 16 / 9) => (2 * Math.atan(36 / aspect / 2 / mm) * 180) / Math.PI;
/** a lens that "breathes" from mm0 to mm1 along a travel (dolly-zoom = move closer while widening: vertigo) */
export const lensRamp = (mm0: number, mm1: number, k: (t: number) => number) => (t: number) => lerp(mm0, mm1, k(t));

/**
 * Camera on a spline. `move` (0..1, from travel()) places it along `path`; it looks at `look` (a point, a second
 * path walked with the same progress, or a function). lens in mm (35–50 for sets, 24–28 for rush-ins, 85+ for
 * macro product); roll in radians (dutch: ±0.05–0.2 on drifts, up to ±0.8 through a tumble); focus defaults to the
 * look point (rack focus = pass a function).
 */
export const pathRig = (o: { path: V3[] | Path; look: V3 | V3[] | Path | ((t: number) => V3); move: Travel | ((t: number) => number);
  lens?: Num; roll?: Num; focus?: Num; aspect?: number; handheld?: { amp: number; seed: number; hz?: number } }): Rig => {
  const P = Array.isArray(o.path) ? mkPath(o.path) : o.path;
  const L = Array.isArray(o.look) && Array.isArray(o.look[0]) ? mkPath(o.look as V3[]) : (o.look as V3 | Path | ((t: number) => V3));
  return (t) => {
    const u = o.move(t);
    const pos = P(u);
    const look: V3 = typeof L === "function" ? ("tangent" in L ? (L as Path)(u) : (L as (t: number) => V3)(t)) : (L as V3);
    const hh = o.handheld ? handheld(t, o.handheld.seed, o.handheld.amp, o.handheld.hz) : null;
    const p: V3 = hh ? [pos[0] + hh.pos[0], pos[1] + hh.pos[1], pos[2] + hh.pos[2]] : pos;
    const roll = val(o.roll, t) + (hh ? hh.roll : 0);
    const focus = o.focus !== undefined ? val(o.focus, t) : Math.hypot(look[0] - p[0], look[1] - p[1], look[2] - p[2]);
    return { pos: p, look, fov: lensFov(val(o.lens, t, 40), o.aspect), roll, focus };
  };
};

/**
 * A camera that replays samples in time (frame-matched to a reference): positions, look points, lens and roll at
 * given times, interpolated with time-parameterised Catmull-Rom (Barry–Goldman), so the ref's own speed — its ramps,
 * holds and whips — comes through exactly. Samples come from styles/tools/s3_camsolve.py (cams.json) or by eye.
 */
export type CamSample = { t: number; pos: V3; look: V3; lens: number; roll?: number };
export const sampledRig = (samples: CamSample[], o: { aspect?: number; handheld?: { amp: number; seed: number; hz?: number } } = {}): Rig => {
  const S = [...samples].sort((a, b) => a.t - b.t);
  const cr = (t: number, get: (s: CamSample) => number) => {
    const n = S.length;
    if (t <= S[0].t) return get(S[0]);
    if (t >= S[n - 1].t) return get(S[n - 1]);
    let i = 0;
    while (i < n - 2 && t > S[i + 1].t) i++;
    const s0 = S[Math.max(0, i - 1)], s1 = S[i], s2 = S[i + 1], s3 = S[Math.min(n - 1, i + 2)];
    const t0 = s0 === s1 ? s1.t - (s2.t - s1.t) : s0.t, t1 = s1.t, t2 = s2.t, t3 = s3 === s2 ? s2.t + (s2.t - s1.t) : s3.t;
    const p0 = s0 === s1 ? 2 * get(s1) - get(s2) : get(s0), p1 = get(s1), p2 = get(s2), p3 = s3 === s2 ? 2 * get(s2) - get(s1) : get(s3);
    const L = (a: number, b: number, ta: number, tb: number) => (tb === ta ? a : ((tb - t) * a + (t - ta) * b) / (tb - ta));
    const a1 = L(p0, p1, t0, t1), a2 = L(p1, p2, t1, t2), a3 = L(p2, p3, t2, t3);
    const b1 = L(a1, a2, t0, t2), b2 = L(a2, a3, t1, t3);
    return L(b1, b2, t1, t2);
  };
  return (t) => {
    const pos: V3 = [0, 1, 2].map((k) => cr(t, (s) => s.pos[k])) as V3;
    const look: V3 = [0, 1, 2].map((k) => cr(t, (s) => s.look[k])) as V3;
    const hh = o.handheld ? handheld(t, o.handheld.seed, o.handheld.amp, o.handheld.hz) : null;
    const p: V3 = hh ? [pos[0] + hh.pos[0], pos[1] + hh.pos[1], pos[2] + hh.pos[2]] : pos;
    return { pos: p, look, fov: lensFov(cr(t, (s) => s.lens), o.aspect), roll: cr(t, (s) => s.roll ?? 0) + (hh ? hh.roll : 0), focus: Math.hypot(look[0] - p[0], look[1] - p[1], look[2] - p[2]) };
  };
};

/** orbit around a target (bullet time, product hero): angle (rad) along a travel, radius/height can breathe */
export const orbitRig = (o: { target: V3; radius: Num; height: Num; a0: number; a1: number; move: Travel | ((t: number) => number);
  lens?: Num; roll?: Num; aspect?: number }): Rig => (t) => {
  const a = lerp(o.a0, o.a1, o.move(t)), r = val(o.radius, t, 2), h = val(o.height, t, 0);
  const pos: V3 = [o.target[0] + Math.sin(a) * r, o.target[1] + h, o.target[2] + Math.cos(a) * r];
  return { pos, look: o.target, fov: lensFov(val(o.lens, t, 40), o.aspect), roll: val(o.roll, t), focus: Math.hypot(r, h) };
};

/** organic operator drift: layered sines on position and roll, never still, never shaky (amp in metres) */
export const handheld = (t: number, seed: number, amp = 0.01, hz = 0.35) => {
  const s = (k: number, f: number) => Math.sin(t * 2 * Math.PI * hz * f + seed * k) * 0.6 + Math.sin(t * 2 * Math.PI * hz * f * 1.93 + seed * k * 1.7) * 0.4;
  return { pos: [amp * s(1.1, 1), amp * 0.7 * s(2.3, 0.83), amp * 0.5 * s(3.7, 0.61)] as V3, roll: amp * 1.2 * s(5.1, 0.47) };
};

/** blend two rigs (hand-off between moves inside one take) by k(t) 0..1 */
export const blendRig = (a: Rig, b: Rig, k: (t: number) => number): Rig => (t) => {
  const A = a(t), B = b(t), x = k(t);
  const l3 = (p: V3, q: V3): V3 => [lerp(p[0], q[0], x), lerp(p[1], q[1], x), lerp(p[2], q[2], x)];
  return { pos: l3(A.pos, B.pos), look: l3(A.look, B.look), fov: lerp(A.fov, B.fov, x), roll: lerp(A.roll, B.roll, x), focus: lerp(A.focus, B.focus, x) };
};

const tmpCam = new THREE.PerspectiveCamera();
export const applyCam = (cam: THREE.PerspectiveCamera, s: CamState, aspect = 16 / 9) => {
  cam.position.set(...s.pos);
  cam.up.set(0, 1, 0);
  cam.lookAt(...s.look);
  if (s.roll) cam.rotateZ(s.roll);
  cam.fov = s.fov;
  cam.aspect = aspect;
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld(true);
};

/**
 * Physical motion blur for a rig: where do points at the focus distance land on screen at t − shutter vs t?
 * Splits the motion into a uniform part (pan/tilt/roll → blurDir, uv) and a radial part (dolly/zoom → zoomBlur), in
 * the units post.tsx uses. shutter 180° at 24 fps = 1/48 s, like the refs (their whips smear ~5–15 % of the frame).
 */
export const rigBlur = (rig: Rig, t: number, aspect = 16 / 9, shutterDeg = 180, fps = 24, gain = 1) => {
  const dt = (shutterDeg / 360) / fps;
  const a = rig(t - dt), b = rig(t);
  applyCam(tmpCam, b, aspect);
  const probes: THREE.Vector3[] = [];
  const grid = [[0, 0], [-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]];
  for (const [x, y] of grid) {
    const p = new THREE.Vector3(x, y, 0.5).unproject(tmpCam).sub(tmpCam.position).normalize().multiplyScalar(Math.max(0.2, b.focus)).add(tmpCam.position);
    probes.push(p);
  }
  const now = probes.map((p) => p.clone().project(tmpCam));
  applyCam(tmpCam, a, aspect);
  const then = probes.map((p) => p.clone().project(tmpCam));
  let dx = 0, dy = 0, rad = 0;
  for (let i = 0; i < probes.length; i++) {
    dx += (now[i].x - then[i].x) / 2;
    dy += (now[i].y - then[i].y) / 2;
  }
  dx /= probes.length;
  dy /= probes.length;
  for (let i = 1; i < probes.length; i++) {
    const r0 = Math.hypot(then[i].x, then[i].y), r1 = Math.hypot(now[i].x, now[i].y);
    rad += (r1 - r0) / Math.max(0.2, r1);
  }
  rad /= probes.length - 1;
  return { blurDir: [dx * gain, dy * gain] as [number, number], zoomBlur: Math.abs(rad) * gain };
};

/** post params driven by the rig: focus follows the rig, blur is physical; `base` sets the look */
export const rigPost = (rig: Rig, t: number, base: Partial<PostParams>, o: { aspect?: number; blurGain?: number } = {}): PostParams => {
  const s = rig(t);
  const b = rigBlur(rig, t, o.aspect, 180, 24, o.blurGain ?? 1);
  return {
    focus: s.focus, aperture: 0.4, bloom: 0.2, threshold: 0.85, vignette: 0.2, grain: 0.03, flash: 0, exposure: 1,
    ...base,
    blurDir: [b.blurDir[0] + (base.blurDir?.[0] ?? 0), b.blurDir[1] + (base.blurDir?.[1] ?? 0)],
    zoomBlur: b.zoomBlur + (base.zoomBlur ?? 0),
  };
};

/** drives the R3F camera from a rig (render before everything else) */
export const RigCamera: React.FC<{ rig: Rig; t: number; aspect?: number; near?: number; far?: number }> = ({ rig, t, aspect = 16 / 9, near = 0.03, far = 80 }) => {
  const { camera } = useThree();
  useFrame(() => {
    const cam = camera as THREE.PerspectiveCamera;
    cam.near = near;
    cam.far = far;
    applyCam(cam, rig(t), aspect);
  }, -1);
  return null;
};

/** keyframed number helper re-export for rigs: roll/lens/focus keys → function */
export const keys = (k: [number, number, ((x: number) => number)?][]) => (t: number) => kf(t, k);
