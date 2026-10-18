import React from "react";
import * as THREE from "three";
import { V3 } from "../lib";
import { makeStudio, setStudio, smoothGeo, useGlassHidden } from "./glass";

// 3D cursors for Style 3 (ref A): an extruded arrow with real thickness, a coloured cap on its top face (+z) and a
// bevelled body that reads as a rim from the front and as the thickness from an angle.
//   "mac"   4.08–4.6 s, 7.1–8.6 s: the macOS arrow, glossy black cap, white bevelled rim/body
//   "facet" 1.5 s, 16.3–16.6 s, 19.3–22 s: the rounded "send" dart (concave back), violet → magenta cap, pale rim/body
// Local frame: the tip sits at the origin and the arrow points along +x, lying in the xy plane, its top facing +z
// (same convention as the old paper-plane Cursor; roll ≈ 2.5 rad points it up-left on screen). ~0.095 m long at
// scale 1. Lit by camera-relative softboxes (kit/glass.tsx studio material), so it reads the same in every set.

export type CursorVariant = "mac" | "facet";

type Built = { geo: THREE.BufferGeometry; outline: THREE.Vector2[]; rim: number; zTop: number; zBot: number; box: THREE.Box3; grad: [number, number, number, number] };

// macOS pointer outline (y up, tip at 0,0, 1 unit ≈ 1 px of the 12 × 19 px system arrow)
const MAC: [number, number][] = [[0, 0], [0, -16.2], [3.9, -12.4], [6.5, -18.4], [9.2, -17.3], [6.7, -11.6], [11.9, -11.6]];

const rotate = (pts: [number, number][], a: number, s: number) =>
  pts.map(([x, y]) => new THREE.Vector2((x * Math.cos(a) - y * Math.sin(a)) * s, (x * Math.sin(a) + y * Math.cos(a)) * s));

/** a closed outline with rounded corners (r per vertex; 0 = sharp), optional concave edge i → i+1 (control point) */
const roundedOutline = (pts: THREE.Vector2[], r: number[], bulge?: { from: number; ctrl: THREE.Vector2 }) => {
  const s = new THREE.Shape();
  const n = pts.length;
  const curved = (i: number) => !!bulge && bulge.from === i; // edge i → i+1 is the concave curve
  const corner = (i: number) => {
    const p = pts[i];
    // corner tangents follow the curve when the neighbouring edge is the concave one
    const a = curved((i - 1 + n) % n) ? bulge!.ctrl : pts[(i - 1 + n) % n];
    const b = curved(i) ? bulge!.ctrl : pts[(i + 1) % n];
    const ra = Math.min(r[i], p.distanceTo(a) * 0.45), rb = Math.min(r[i], p.distanceTo(b) * 0.45);
    return { p, in: p.clone().add(a.clone().sub(p).setLength(ra)), out: p.clone().add(b.clone().sub(p).setLength(rb)), round: r[i] > 0 };
  };
  const C = pts.map((_, i) => corner(i));
  s.moveTo(C[0].round ? C[0].out.x : C[0].p.x, C[0].round ? C[0].out.y : C[0].p.y);
  for (let k = 1; k <= n; k++) {
    const i = k % n;
    const c = C[i];
    const to = c.round ? c.in : c.p;
    if (curved((i - 1 + n) % n)) s.quadraticCurveTo(bulge!.ctrl.x, bulge!.ctrl.y, to.x, to.y);
    else s.lineTo(to.x, to.y);
    if (c.round) s.quadraticCurveTo(c.p.x, c.p.y, c.out.x, c.out.y);
  }
  return s;
};

const build = (variant: CursorVariant): Built => {
  let shape: THREE.Shape;
  let rim: number, depth: number, bt: number, grad: [number, number, number, number];
  if (variant === "mac") {
    // rotate so the arrow's axis (tip-angle bisector) lies along +x
    const u = 0.0043;
    const pts = rotate(MAC, (-113 * Math.PI) / 180, u);
    shape = new THREE.Shape(pts);
    rim = 0.0033;
    depth = 0.0036;
    bt = 0.0028;
    grad = [-0.02, 0.02, -0.07, -0.02];
  } else {
    const L = 0.08, W = 0.038;
    const pts = [new THREE.Vector2(0, 0), new THREE.Vector2(-L, W), new THREE.Vector2(-L, -W)];
    shape = roundedOutline(pts, [0.006, 0.008, 0.008], { from: 1, ctrl: new THREE.Vector2(-L * 0.66, 0) });
    rim = 0.0042;
    depth = 0.0042;
    bt = 0.0038;
    grad = [-L, W, -L * 0.25, -W * 0.35];
  }
  const raw = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bt, bevelSize: rim, bevelSegments: 4, curveSegments: 10 });
  // the visual tip is the rim's tip: put it on the origin, thickness centred on z = 0
  const pos = raw.attributes.position;
  let tipY = 0, best = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    if (pos.getX(i) <= best) continue;
    best = pos.getX(i);
    tipY = pos.getY(i);
  }
  // extrusion spans z ∈ [−bt, depth + bt]; centre it (note: translate() re-computes any bounding box in place)
  const half = depth / 2 + bt;
  raw.translate(-best, -tipY, -(depth / 2));
  const geo = smoothGeo(raw, 0.75);
  geo.computeBoundingBox();
  const outline = shape.extractPoints(10).shape.map((p) => new THREE.Vector2(p.x - best, p.y - tipY));
  const g: [number, number, number, number] = [grad[0] - best, grad[1] - tipY, grad[2] - best, grad[3] - tipY];
  return { geo, outline, rim, zTop: half, zBot: -half, box: geo.boundingBox!.clone(), grad: g };
};

// a soft silhouette (glow / drop shadow), blurred on a 2D canvas once per mount
const haloTexture = (b: Built, margin: number) => {
  const S = 256;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const x = c.getContext("2d")!;
  const bw = b.box.max.x - b.box.min.x + margin * 2, bh = b.box.max.y - b.box.min.y + margin * 2;
  const k = S / Math.max(bw, bh);
  const cx = (b.box.min.x + b.box.max.x) / 2, cy = (b.box.min.y + b.box.max.y) / 2;
  const path = () => {
    x.beginPath();
    b.outline.forEach((p, i) => {
      const X = S / 2 + (p.x - cx) * k, Y = S / 2 - (p.y - cy) * k;
      if (i) x.lineTo(X, Y);
      else x.moveTo(X, Y);
    });
    x.closePath();
  };
  x.fillStyle = x.strokeStyle = "#FFFFFF";
  x.lineJoin = "round";
  x.lineWidth = b.rim * 2 * k;
  x.filter = `blur(${Math.round(S * 0.03)}px)`;
  path();
  x.fill();
  x.stroke();
  x.globalAlpha = 0.55;
  x.filter = `blur(${Math.round(S * 0.08)}px)`;
  path();
  x.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return { tex: t, size: Math.max(bw, bh), cx, cy };
};

export type Cursor3DProps = {
  pos: V3;
  rot?: V3;
  scale?: number;
  variant?: CursorVariant;
  /** cap colours: `fill` over most of the face, `fill2` at the back wing (facet) — mac: glossy black */
  fill?: string;
  fill2?: string;
  /** body / rim colour */
  rim?: string;
  /** cap gloss 0..1 */
  gloss?: number;
  /** 0..1 stretch for fast moves: the trailing half is dragged back along −smearDir (up to 2.5 lengths) and fades */
  smear?: number;
  /** direction of motion in the parent's space (where `pos` lives) */
  smearDir?: V3;
  /** soft coloured halo behind the arrow (the 2D-ish "What if" cursor) */
  glow?: number;
  glowColor?: string;
  glowSize?: number;
  /** soft drop shadow (a blurred silhouette behind/below the arrow): strength, colour, offset in the parent's space
   *  (× scale; default down-right and behind) */
  shadow?: number;
  shadowColor?: string;
  shadowOffset?: V3;
  opacity?: number;
  /** where the tip sits in the group's local space (the compat Cursor uses [0.06, 0, 0] like the old paper plane) */
  tipAt?: V3;
  /** leave it out of the glass capture (default true: cursors sit in front of glass) */
  hideFromGlass?: boolean;
};

const NO_REF: React.RefObject<THREE.Object3D | null> = { current: null };

const DEF = {
  mac: { fill: "#060509", fill2: "#100D16", rim: "#FFFFFF", gloss: 0.85, env: "#D8CCFF", bodyEmit: 0.22, bodyGloss: 0.25 },
  // ref 19.4 s: violet ≈ (100, 5, 120), magenta ≈ (130, 0, 52) after the grade, pale pink rim
  facet: { fill: "#5C0E92", fill2: "#B00C5C", rim: "#F7DDF0", gloss: 0.55, env: "#FFE6F6", bodyEmit: 0.12, bodyGloss: 0.3 },
};

export const Cursor3D: React.FC<Cursor3DProps> = ({
  pos, rot = [0, 0, 0], scale = 1, variant = "facet", fill, fill2, rim, gloss, smear = 0, smearDir = [1, 0, 0],
  glow = 0, glowColor = "#8B5CF6", glowSize = 1.35, shadow = 0, shadowColor = "#2A1030", shadowOffset, opacity = 1, tipAt, hideFromGlass = true,
}) => {
  const b = React.useMemo(() => build(variant), [variant]);
  const mat = React.useMemo(makeStudio, []);
  const halo = React.useMemo(() => haloTexture(b, 0.03), [b]);
  const glowMat = React.useMemo(() => new THREE.MeshBasicMaterial({ map: halo.tex, transparent: true, depthWrite: false, toneMapped: false }), [halo]);
  const shadowMat = React.useMemo(() => new THREE.MeshBasicMaterial({ map: halo.tex, transparent: true, depthWrite: false, toneMapped: false }), [halo]);
  React.useEffect(() => () => b.geo.dispose(), [b]);
  React.useEffect(() => () => mat.dispose(), [mat]);
  React.useEffect(() => () => halo.tex.dispose(), [halo]);
  React.useEffect(() => () => glowMat.dispose(), [glowMat]);
  React.useEffect(() => () => shadowMat.dispose(), [shadowMat]);
  const hideRef = React.useRef<THREE.Group>(null);
  useGlassHidden(hideFromGlass ? hideRef : NO_REF);

  const d = DEF[variant];
  const len = b.box.max.x - b.box.min.x;
  // smear + shadow are given in the parent's space; bring them into the arrow's frame (rotation only)
  const inv = new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)).invert();
  const sm = Math.max(0, Math.min(1, smear));
  const dirL = new THREE.Vector3(...smearDir);
  if (dirL.lengthSq() < 1e-12) dirL.set(1, 0, 0);
  dirL.normalize().applyQuaternion(inv);
  const so = new THREE.Vector3(...(shadowOffset ?? [0.007, -0.014, -0.012])).applyQuaternion(inv);
  const u = mat.uniforms;
  setStudio(mat, {
    col0: fill2 ?? d.fill2, col1: fill ?? d.fill, grad: b.grad, body: rim ?? d.rim, bodyEmit: d.bodyEmit, capEmit: 0,
    gloss: d.bodyGloss, capGloss: gloss ?? d.gloss, env: d.env, zTop: b.zTop, opacity, trailFade: sm > 0 ? 0.8 : 0,
  });
  u.uSmear.value.copy(dirL).multiplyScalar(sm * 2.5 * len);
  u.uSmearC.value.set((b.box.min.x + b.box.max.x) / 2, (b.box.min.y + b.box.max.y) / 2, 0);
  u.uSmearExt.value = len * 0.5;
  glowMat.color.set(glowColor);
  glowMat.opacity = glow * opacity;
  shadowMat.color.set(shadowColor);
  shadowMat.opacity = shadow * opacity * (1 - sm * 0.7);
  return (
    <group position={pos} rotation={rot} scale={scale}>
      <group ref={hideRef} position={tipAt}>
        {glow > 0 && (
          <mesh position={[halo.cx, halo.cy, b.zBot - 0.002]} scale={glowSize} material={glowMat} userData={{ bridge: "skip" }}>
            <planeGeometry args={[halo.size, halo.size]} />
          </mesh>
        )}
        {shadow > 0 && (
          <mesh position={[halo.cx + so.x, halo.cy + so.y, Math.min(so.z, b.zBot - 0.002)]} material={shadowMat} userData={{ bridge: "skip" }}>
            <planeGeometry args={[halo.size, halo.size]} />
          </mesh>
        )}
        <mesh geometry={b.geo} material={mat} />
      </group>
    </group>
  );
};

/**
 * Smear from a position track (the same function that drives `pos`): central-difference velocity in the parent's
 * space; speeds above `floor` (units/s) map to 0..1 through `gain`. Spread it: <Cursor3D {...velSmear(track, t)} />
 */
export const velSmear = (track: (t: number) => V3, t: number, gain = 0.22, floor = 0.6, dt = 1 / 48) => {
  const a = track(t - dt), b = track(t + dt);
  const v: V3 = [(b[0] - a[0]) / (2 * dt), (b[1] - a[1]) / (2 * dt), (b[2] - a[2]) / (2 * dt)];
  return { smear: Math.max(0, Math.min(1, (Math.hypot(...v) - floor) * gain)), smearDir: v };
};

/**
 * Rotation (Euler XYZ) that turns the arrow's coloured cap (+z) toward the camera with its tip (+x) pointing up on
 * screen, turned `tilt` rad toward screen-left (negative = right), then `lean` rad about the tip axis so a facet catches
 * the light. A fixed `rot` on a moving cursor shows its pale rim edge-on from many angles (ref A: the dart always reads
 * violet/magenta). Pass the camera position at the same time.
 */
export const faceCamRot = (pos: V3, cam: V3, tilt = -0.35, lean = 0.35): V3 => {
  const z = new THREE.Vector3(cam[0] - pos[0], cam[1] - pos[1], cam[2] - pos[2]).normalize();
  const up = new THREE.Vector3(0, 1, 0);
  const x0 = up.clone().sub(z.clone().multiplyScalar(up.dot(z))).normalize();
  const y0 = new THREE.Vector3().crossVectors(z, x0);
  const x = x0.clone().multiplyScalar(Math.cos(tilt)).add(y0.multiplyScalar(Math.sin(tilt)));
  const y = new THREE.Vector3().crossVectors(z, x);
  const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
  q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), lean));
  const e = new THREE.Euler().setFromQuaternion(q);
  return [e.x, e.y, e.z];
};

const mixHex = (a: string, b: string, k: number) => "#" + new THREE.Color(a).lerp(new THREE.Color(b), k).getHexString();

/**
 * Drop-in for the old paper-plane `Cursor` (kit/props.tsx): same props, same placement (tip at +0.06 x, body back to
 * −0.035, top toward +z), now the ref's facet dart; `color` becomes the cap's accent with a violet partner.
 */
export const Cursor: React.FC<{ pos: V3; rot: V3; scale?: number; color?: string; variant?: CursorVariant } & Partial<Cursor3DProps>> = ({
  pos, rot, scale = 1, color = "#D3206A", variant = "facet", ...rest
}) => (
  <Cursor3D
    pos={pos}
    rot={rot}
    scale={scale}
    variant={variant}
    fill={variant === "facet" ? mixHex(color, "#3E0A8C", 0.65) : undefined}
    fill2={variant === "facet" ? mixHex(color, "#5A0028", 0.25) : undefined}
    tipAt={[0.06, 0, 0]}
    {...rest}
  />
);
