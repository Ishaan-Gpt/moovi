import React from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { getInputProps } from "remotion";
import { SoftShadows } from "@react-three/drei";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { V3 } from "../lib";
import { PAPER, clothCanvas, edgeCanvas, linenCanvas, paperGrain, useTex } from "./canvas";

// Style 3 kit (from ce3-04 "Pop-Up"): a tabletop desk (linen, lamp, soft PCSS shadows, dressing) and a hardback book. Real scale in metres: a 20 × 27 cm
// page, 11 mm of leaves per side, 2.8 mm cloth boards. The spine runs along z at x = 0; pages open to −x / +x.
//
// prop spec (build.md §1)
//   name: Book                      story job: the world — the dull textbook that becomes a pop-up book
//   real size: 41 × 28 cm open, 2.5 cm thick       shots: every shot
//   silhouette: an open hardback, pages curving up out of the gutter, green cloth boards
//   parts: 2 boards (rounded slabs, cloth) · 2 page blocks (custom geometry: curved top, fore-edge, head/tail edges)
//          · a turning leaf (PageSheet) · the ribbon bookmark (Ribbon)
//   materials: cloth green 0.85 · leaves news grey → cream stock 0.92 + fibre bump · edges striped
//   knobs: Book `close` 0..1 (right half folds over the left) · PageSheet `p` 0..1 (right → left) + `lead` (edge
//          leads/lags) · Ribbon `pts` (its path, driven by the shot)
//   factory: R3F procedural, rebuilt per frame only where a knob moves (quantised)     budget: < 40k tris

export const PW = 0.2; // page width (spine → fore-edge)
export const PH = 0.27; // page height (along the spine)
export const BOARD = 0.0028;
export const STACK = 0.011;
const GUT = 0.0006; // half the spine gap (the leaves meet in the valley)
/** height of the top leaf above the desk at distance x from the spine (the gutter valley, then nearly flat) */
export const leafY = (x: number) => {
  const s = Math.min(1, Math.max(0, (x - GUT) / 0.034));
  return BOARD + STACK * (0.42 + 0.58 * (1 - Math.pow(1 - s, 2.4))) - 0.0012 * Math.pow(x / PW, 2);
};
const leafSlope = (x: number) => (leafY(x + 0.0005) - leafY(x - 0.0005)) / 0.001;

// ── the desk: linen cloth, a warm lamp key with soft (PCSS) shadows, cream fill, lavender rim ──
const Env: React.FC<{ intensity: number }> = ({ intensity }) => {
  const { gl, scene } = useThree();
  const env = React.useMemo(() => {
    const pm = new THREE.PMREMGenerator(gl);
    const tex = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    pm.dispose();
    return tex;
  }, [gl]);
  React.useEffect(() => {
    scene.environment = env;
    return () => {
      scene.environment = null;
      env.dispose();
    };
  }, [env, scene]);
  scene.environmentIntensity = intensity;
  return null;
};

export type Lamp = { pos: V3; target?: V3; intensity?: number; color?: string; angle?: number };
export const Desk: React.FC<{ lamp?: Lamp; fill?: number; rim?: number; env?: number; bg?: string; wall?: number; dressing?: boolean; drain?: number; children?: React.ReactNode }> = ({
  lamp = { pos: [-0.95, 0.62, 0.38] }, fill = 0.08, rim = 1.6, env = 0.04, bg = "#9E9278", wall = -0.9, dressing = true, drain = 0, children,
}) => {
  // look-dev switch: stills.mjs --props '{"popLight":"key"}' renders the key alone (no fill, rim, env)
  if ((getInputProps() as { popLight?: string }).popLight === "key") (fill = 0), (rim = 0), (env = 0);
  const linen = useTex(linenCanvas, [], { repeat: 7 });
  const grain = useTex(paperGrain, [], { repeat: 9, srgb: false });
  const spot = React.useMemo(() => new THREE.SpotLight(), []);
  const target = lamp.target ?? [0.02, 0, 0];
  React.useLayoutEffect(() => {
    spot.position.set(...lamp.pos);
    spot.target.position.set(...target);
    spot.target.updateMatrixWorld();
    spot.castShadow = true;
    spot.shadow.mapSize.set(2048, 2048);
    spot.shadow.bias = -0.00012;
    spot.shadow.normalBias = 0.0006;
    spot.shadow.camera.near = 0.3;
    spot.shadow.camera.far = 3;
    spot.angle = lamp.angle ?? 0.4;
    spot.penumbra = 1;
    spot.decay = 0;
    spot.intensity = lamp.intensity ?? 6.4;
    spot.color.set(lamp.color ?? "#FFE6C4");
  });
  React.useEffect(() => () => spot.dispose(), [spot]);
  return (
    <>
      <color attach="background" args={[bg]} />
      <SoftShadows size={12} samples={16} focus={0.3} />
      <Env intensity={env} />
      <primitive object={spot} />
      <primitive object={spot.target} />
      <hemisphereLight args={["#E9DEFF", "#CDB99A", fill]} />
      {/* rim from behind right: lavender on the paper edges; a weak cream bounce from the front right lifts the shadows */}
      <directionalLight position={[0.9, 0.2, -0.9]} intensity={rim} color="#E3C8FF" />
      <pointLight position={[0.6, 0.35, 0.7]} intensity={fill > 0 ? 0.12 : 0} decay={0} color="#FFF3DF" />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[6, 6]} />
        <meshStandardMaterial map={linen} bumpMap={grain} bumpScale={1.2} roughness={0.95} color={new THREE.Color(1, 1, 1).lerp(new THREE.Color(0.93, 1.0, 1.12), drain)} />
      </mesh>
      {/* a plain wall behind the desk: far, soft, catches the lamp's falloff */}
      <mesh position={[0, 0.7, wall]} receiveShadow>
        <planeGeometry args={[6, 1.4]} />
        <meshStandardMaterial color="#E4D7BA" roughness={1} />
      </mesh>
      {dressing && <DeskProps />}
      {children}
    </>
  );
};

// ── desk dressing, far back and soft: a stack of closed books and a mug (depth planes, never the hero) ──
const MUG_PROFILE = [[0, 0], [0.036, 0], [0.04, 0.004], [0.041, 0.09], [0.0375, 0.09], [0.0365, 0.008], [0, 0.008]].map(([x, y]) => new THREE.Vector2(x, y));
export const DeskProps: React.FC<{ books?: V3; mug?: V3 }> = ({ books = [-0.46, 0, -0.34], mug = [0.42, 0, -0.3] }) => {
  const g = React.useMemo(() => ({ mug: new THREE.LatheGeometry(MUG_PROFILE, 40), handle: new THREE.TorusGeometry(0.022, 0.0055, 12, 28, Math.PI) }), []);
  React.useEffect(() => () => Object.values(g).forEach((x) => x.dispose()), [g]);
  const stack: [number, number, number, string][] = [[0.23, 0.032, 0.3, PAPER.lavDeep], [0.21, 0.026, 0.28, PAPER.green], [0.19, 0.03, 0.25, "#E9DDC2"]];
  let y = 0;
  return (
    <>
      <group position={books} rotation={[0, 0.35, 0]}>
        {stack.map(([w, h, d, c], i) => {
          const yy = y + h / 2;
          y += h;
          return (
            <group key={i} position={[0.006 * i, yy, -0.004 * i]} rotation={[0, (i - 1) * 0.07, 0]}>
              <mesh castShadow receiveShadow>
                <boxGeometry args={[w, h, d]} />
                <meshStandardMaterial color={c} roughness={0.8} />
              </mesh>
              <mesh position={[0.004, 0, 0]}>
                <boxGeometry args={[w - 0.006, h - 0.006, d + 0.0005]} />
                <meshStandardMaterial color="#F4ECD8" roughness={0.95} />
              </mesh>
            </group>
          );
        })}
      </group>
      <group position={mug} rotation={[0, -0.6, 0]}>
        <mesh geometry={g.mug} castShadow receiveShadow>
          <meshPhysicalMaterial color={PAPER.green} roughness={0.3} clearcoat={0.7} side={THREE.DoubleSide} />
        </mesh>
        <mesh geometry={g.handle} position={[0.041, 0.045, 0]} rotation={[0, 0, -Math.PI / 2]} castShadow>
          <meshPhysicalMaterial color={PAPER.green} roughness={0.3} clearcoat={0.7} />
        </mesh>
      </group>
    </>
  );
};

// ── page blocks ──
const blockGeo = (side: 1 | -1) => {
  const nx = 56, pos: number[] = [], uv: number[] = [], idx: number[] = [];
  const g = new THREE.BufferGeometry();
  // top leaf: x from the gutter to the fore-edge, z from head (−PH/2) to tail (+PH/2)
  const xs = Array.from({ length: nx + 1 }, (_, i) => GUT + (PW - GUT) * Math.pow(i / nx, 1.6));
  for (const zz of [-PH / 2, PH / 2])
    xs.forEach((x) => {
      pos.push(side * x, leafY(x), zz);
      uv.push(side > 0 ? x / PW : 1 - x / PW, zz < 0 ? 1 : 0);
    });
  for (let i = 0; i < nx; i++) {
    const a = i, b = i + 1, c = nx + 1 + i, d = nx + 2 + i;
    idx.push(...(side > 0 ? [a, c, b, b, c, d] : [a, b, c, b, d, c]));
  }
  const topCount = idx.length;
  // fore-edge and head/tail edges (striped leaves): u across the length, v up the stack
  const base = pos.length / 3;
  const fx = side * PW, fy = leafY(PW);
  pos.push(fx, BOARD, -PH / 2, fx, BOARD, PH / 2, fx, fy, -PH / 2, fx, fy, PH / 2);
  uv.push(0, 0, 1, 0, 0, 1, 1, 1);
  idx.push(...(side > 0 ? [base, base + 2, base + 1, base + 1, base + 2, base + 3] : [base, base + 1, base + 2, base + 1, base + 3, base + 2]));
  for (const zz of [-PH / 2, PH / 2]) {
    const b0 = pos.length / 3;
    xs.forEach((x) => {
      pos.push(side * x, BOARD, zz, side * x, leafY(x), zz);
      uv.push(x / PW, 0, x / PW, 1);
    });
    for (let i = 0; i < nx; i++) {
      const a = b0 + 2 * i, b = a + 1, c = a + 2, d = a + 3;
      const front = (zz > 0) === side > 0;
      idx.push(...(front ? [a, c, b, b, c, d] : [a, b, c, b, d, c]));
    }
  }
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.addGroup(0, topCount, 0);
  g.addGroup(topCount, idx.length - topCount, 1);
  g.computeVertexNormals();
  return g;
};

const boardGeo = () => {
  const w = PW + 0.006, h = PH + 0.008, r = 0.004;
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + r, -h / 2);
  s.lineTo(w / 2 - r, -h / 2);
  s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  s.lineTo(w / 2, h / 2 - r);
  s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  s.lineTo(-w / 2 + r, h / 2);
  s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
  s.lineTo(-w / 2, -h / 2 + r);
  s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  const g = new THREE.ExtrudeGeometry(s, { depth: BOARD - 0.001, bevelEnabled: true, bevelThickness: 0.0005, bevelSize: 0.0006, bevelSegments: 2, curveSegments: 6 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, 0.0005, 0);
  // planar uv from the top (the cloth weave runs square)
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + w / 2) / w, (p.getZ(i) + h / 2) / h);
  g.computeVertexNormals();
  return g;
};

export type BookTex = { left: THREE.Texture | null; right: THREE.Texture | null };
const HINGE = BOARD + STACK + 0.0004; // the right half folds about the top of the stack (lands face to face on the left)
/** the open book. `close` 0..1 folds the right half (board + block) over onto the left about the spine; `label` = the
 *  cover label (cream paper, the real logo) on the right board's outside, which faces up once closed. (The colour
 *  drain is a post saturation key; the ribbon is pushed more saturated meanwhile so it stays the only colour.) */
export const Book: React.FC<{ pages: BookTex; close?: number; label?: THREE.Texture | null; stock?: "news" | "cream"; cloth?: string; children?: React.ReactNode }> = ({ pages, close = 0, label = null, stock = "news", cloth: clothColor = PAPER.green, children }) => {
  const geo = React.useMemo(() => ({ L: blockGeo(-1), R: blockGeo(1), board: boardGeo() }), []);
  React.useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);
  const cloth = useTex(() => clothCanvas(clothColor), [clothColor], { repeat: 3 });
  const edge = useTex(() => edgeCanvas(stock === "news" ? "#DCD6C3" : "#F6F0DA"), [stock]);
  const grain = useTex(paperGrain, [], { srgb: false });
  const mats = React.useMemo(() => {
    const leaf = (map: THREE.Texture | null) => new THREE.MeshStandardMaterial({ map, color: map ? "#FFFFFF" : stock === "news" ? PAPER.news : PAPER.cream, roughness: 0.92, bumpMap: grain, bumpScale: 0.6 });
    return {
      L: leaf(pages.left),
      R: leaf(pages.right),
      edge: new THREE.MeshStandardMaterial({ map: edge, roughness: 0.95 }),
      cloth: new THREE.MeshStandardMaterial({ map: cloth, roughness: 0.85, color: "#FFFFFF" }),
      label: label ? new THREE.MeshStandardMaterial({ map: label, roughness: 0.9, bumpMap: grain, bumpScale: 0.4 }) : null,
    };
  }, [pages.left, pages.right, edge, cloth, grain, label, stock]);
  React.useEffect(() => () => Object.values(mats).forEach((m) => m?.dispose()), [mats]);
  const a = Math.PI * Math.min(1, Math.max(0, close));
  const bx = (PW + 0.006) / 2 + GUT;
  return (
    <group>
      {/* spine cloth bridging the boards */}
      <mesh position={[0, 0.0012, 0]} castShadow receiveShadow material={mats.cloth}>
        <boxGeometry args={[GUT * 2 + 0.004, 0.0024, PH + 0.008]} />
      </mesh>
      <group>
        <mesh geometry={geo.board} position={[-bx, 0, 0]} material={mats.cloth} castShadow receiveShadow />
        <mesh geometry={geo.L} material={[mats.L, mats.edge]} castShadow receiveShadow />
      </group>
      <group position={[0, HINGE, 0]} rotation={[0, 0, a]}>
        <group position={[0, -HINGE, 0]}>
          <mesh geometry={geo.board} position={[bx, 0, 0]} material={mats.cloth} castShadow receiveShadow />
          <mesh geometry={geo.R} material={[mats.R, mats.edge]} castShadow receiveShadow />
          {mats.label && (
            // under the board (facing down while open); after the fold it faces up and reads the right way round
            <mesh position={[bx, -0.0002, 0]} rotation={[Math.PI / 2, 0, Math.PI]} material={mats.label} receiveShadow>
              <planeGeometry args={[0.15, (0.15 * 640) / 1400]} />
            </mesh>
          )}
        </group>
      </group>
      {close > 0.97 && (
        // the closed spine: cloth rounds over the leaves' gutter edge
        <mesh position={[0, HINGE, 0]} rotation={[Math.PI / 2, 0, 0]} material={mats.cloth} castShadow receiveShadow>
          <cylinderGeometry args={[HINGE, HINGE, PH + 0.008, 24, 1, true, 0, Math.PI]} />
        </mesh>
      )}
      {children}
    </group>
  );
};

// ── a single leaf turning over the spine ──
/** the leaf's centre line in the xy plane for progress p (0 lying on the right block, 1 on the left) and `lead`
 *  (+: the free edge goes first, a hand lifting the corner; −: it trails, air or a riffle) */
export const leafLine = (p: number, lead: number, n: number, zf = 0) => {
  const out: [number, number][] = [];
  let x = GUT * 0.5, y = leafY(GUT) + 0.0004;
  const ds = PW / n;
  for (let i = 0; i <= n; i++) {
    out.push([x, y]);
    const s = (i + 0.5) / n;
    const P = Math.min(1, Math.max(0, p + lead * Math.sin(Math.PI * p) * Math.pow(s, 1.4) * (1 + 0.35 * zf)));
    const xs = s * PW;
    const al = Math.atan(leafSlope(xs)) * (1 - Math.sin(Math.PI * P)); // hug the block at rest
    const th = (1 - P) * al + P * (Math.PI - al);
    x += Math.cos(th) * ds;
    y += Math.sin(th) * ds + (P > 0 && P < 1 ? 0.00002 : 0);
  }
  return out;
};
/** `lift` (m) separates leaves that lie on top of each other (a riffle's stack) */
export const PageSheet: React.FC<{ p: number; lead?: number; front: THREE.Texture | null; back: THREE.Texture | null; stock?: string; lift?: number }> = ({ p, lead = 0.35, front, back, stock = PAPER.news, lift = 0 }) => {
  const q = Math.round(p * 400) / 400, ql = Math.round(lead * 100) / 100;
  const geo = React.useMemo(() => {
    const nx = 40, nz = 8;
    const pos: number[] = [], uv: number[] = [], idx: number[] = [];
    for (let j = 0; j <= nz; j++) {
      const zf = j / nz - 0.5;
      const line = leafLine(q, ql, nx, zf * 2);
      line.forEach(([x, y], i) => {
        pos.push(x, y, zf * PH);
        uv.push(i / nx, 1 - j / nz);
      });
    }
    for (let j = 0; j < nz; j++)
      for (let i = 0; i < nx; i++) {
        const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }, [q, ql]);
  React.useEffect(() => () => geo.dispose(), [geo]);
  const mats = React.useMemo(() => {
    // the back is seen after the turn, lying on the left: mirror its u so the print reads the right way round
    const flipped = back ? back.clone() : null;
    if (flipped) {
      flipped.repeat.set(-1, 1);
      flipped.offset.set(1, 0);
      flipped.needsUpdate = true;
    }
    const m = (map: THREE.Texture | null, side: THREE.Side) => new THREE.MeshStandardMaterial({ map, color: map ? "#FFFFFF" : stock, roughness: 0.92, side, shadowSide: THREE.DoubleSide });
    return { f: m(front, THREE.FrontSide), b: m(flipped, THREE.BackSide), flipped };
  }, [front, back, stock]);
  React.useEffect(() => () => [mats.f, mats.b, mats.flipped].forEach((m) => m?.dispose()), [mats]);
  // triangles wind so FrontSide faces up while the leaf lies on the right (the printed front), BackSide after the turn
  return (
    <group position={[0, lift, 0]}>
      <mesh geometry={geo} material={mats.f} castShadow receiveShadow />
      <mesh geometry={geo} material={mats.b} receiveShadow />
    </group>
  );
};

// ── a satin ribbon bookmark along a path (ce3-04's character), width across the surface ──
export const Bookmark: React.FC<{ pts: V3[]; width?: number; up?: V3; color?: string }> = ({ pts, width = 0.007, up = [0, 1, 0], color = PAPER.lavDeep }) => {
  const key = pts.map((p) => p.map((v) => v.toFixed(4)).join(",")).join(";");
  const geo = React.useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), false, "centripetal");
    const n = 120, pos: number[] = [], uv: number[] = [], idx: number[] = [];
    const U = new THREE.Vector3(...up);
    for (let i = 0; i <= n; i++) {
      const u = i / n, P = curve.getPointAt(u), T = curve.getTangentAt(u);
      const side = new THREE.Vector3().crossVectors(T, U);
      if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
      side.normalize().multiplyScalar(width / 2);
      pos.push(P.x - side.x, P.y - side.y, P.z - side.z, P.x + side.x, P.y + side.y, P.z + side.z);
      uv.push(0, u * 8, 1, u * 8);
    }
    for (let i = 0; i < n; i++) {
      const a = 2 * i;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, width]);
  React.useEffect(() => () => geo.dispose(), [geo]);
  const mat = React.useMemo(() => new THREE.MeshPhysicalMaterial({ color, roughness: 0.32, sheen: 1, sheenRoughness: 0.35, sheenColor: new THREE.Color("#FFFFFF"), side: THREE.DoubleSide, clearcoat: 0.2, clearcoatRoughness: 0.4 }), [color]);
  React.useEffect(() => () => mat.dispose(), [mat]);
  return <mesh geometry={geo} material={mat} castShadow receiveShadow />;
};
