import React from "react";
import * as THREE from "three";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import jakarta800 from "./fonts/jakarta-800.typeface.json";
import type { V3 } from "../lib";
import { PAPER, paperGrain, useTex } from "./canvas";

// Style 3 kit (from ce3-04 "Pop-Up"): paper engineering. Every piece is card stock with real thickness (0.9 mm) cut to a shape, hinged on
// its fold line and driven by knobs: `rise` 0 (flat on the page) → 1 (standing; springs overshoot it), `fold` for
// V-folds (0 flat → 1 fully creased). Faces take a print (canvas texture); edges are the paper's own colour.
//
// prop specs (build.md §1)
//   PopCard   die-cut card on a hinge · knobs rise, lean · ExtrudeGeometry(shape, 0.9 mm), uv over the shape's bounds
//   VFold     a pill-topped bar creased down its middle (the logo's bars) · knobs rise, fold · two half-shapes on a hinge
//   PaperWord die-cut letters in coloured stock · knobs rise per letter (staggered by the shot)
//   PhonePop  a card phone with a die-cut screen window; the real clip plays behind the window · knobs rise, look
//   Volvelle  a printed wheel on a pivot (looks round the rim) · knob turn (radians)

export const CARD = 0.0009;

export const roundRectShape = (w: number, h: number, r: number, o: { flatBottom?: boolean; holes?: THREE.Path[] } = {}) => {
  const s = new THREE.Shape();
  const x0 = -w / 2, x1 = w / 2, y0 = 0, y1 = h, rb = o.flatBottom ? 0 : r;
  s.moveTo(x0 + rb, y0);
  s.lineTo(x1 - rb, y0);
  if (rb) s.quadraticCurveTo(x1, y0, x1, y0 + rb);
  s.lineTo(x1, y1 - r);
  s.quadraticCurveTo(x1, y1, x1 - r, y1);
  s.lineTo(x0 + r, y1);
  s.quadraticCurveTo(x0, y1, x0, y1 - r);
  s.lineTo(x0, y0 + rb);
  if (rb) s.quadraticCurveTo(x0, y0, x0 + rb, y0);
  if (o.holes) s.holes.push(...o.holes);
  return s;
};
export const holePath = (cx: number, cy: number, w: number, h: number, r: number) => {
  const p = new THREE.Path();
  const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - h / 2, y1 = cy + h / 2;
  p.moveTo(x0 + r, y0);
  p.quadraticCurveTo(x0, y0, x0, y0 + r);
  p.lineTo(x0, y1 - r);
  p.quadraticCurveTo(x0, y1, x0 + r, y1);
  p.lineTo(x1 - r, y1);
  p.quadraticCurveTo(x1, y1, x1, y1 - r);
  p.lineTo(x1, y0 + r);
  p.quadraticCurveTo(x1, y0, x1 - r, y0);
  p.lineTo(x0 + r, y0);
  return p;
};

/** extrude a die-cut shape to card thickness (front face at z = +CARD/2), uv mapped over the shape's bounds */
export const cardGeo = (shape: THREE.Shape, depth = CARD) => {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 14 });
  g.translate(0, 0, -depth / 2);
  g.computeBoundingBox();
  const b = g.boundingBox!, p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) - b.min.x) / (b.max.x - b.min.x), (p.getY(i) - b.min.y) / (b.max.y - b.min.y));
  g.computeVertexNormals();
  return g;
};

/** card stock: a face material (print or flat colour) + the edge (same stock, a touch darker) */
export const useStock = (color: string, print: THREE.Texture | null = null, rough = 0.88) => {
  const grain = useTex(paperGrain, [], { srgb: false });
  const m = React.useMemo(() => {
    const face = new THREE.MeshStandardMaterial({ color: print ? "#FFFFFF" : color, map: print, roughness: rough, bumpMap: grain, bumpScale: 0.5, shadowSide: THREE.DoubleSide });
    const edge = new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.86), roughness: 0.9 });
    return [face, edge] as THREE.Material[];
  }, [color, print, rough, grain]);
  React.useEffect(() => () => m.forEach((x) => x.dispose()), [m]);
  return m;
};

/** hinge: lies flat (rise 0, face up toward +y) and stands up about its bottom edge (rise 1, face toward +z) */
const hingeX = (rise: number, lean = 0) => -Math.PI / 2 * (1 - rise) - lean;

export const PopCard: React.FC<{ shape: THREE.Shape; mats: THREE.Material[]; pos: V3; rotY?: number; rise: number; lean?: number; s?: number; children?: React.ReactNode }> = ({ shape, mats, pos, rotY = 0, rise, lean = 0, s = 1, children }) => {
  const geo = React.useMemo(() => cardGeo(shape), [shape]);
  React.useEffect(() => () => geo.dispose(), [geo]);
  return (
    <group position={pos} rotation={[0, rotY, 0]} scale={s}>
      <group rotation={[hingeX(rise, lean), 0, 0]}>
        <mesh geometry={geo} material={mats} castShadow receiveShadow />
        {children}
      </group>
    </group>
  );
};

// ── V-fold bar (the logo mark's bars, in paper) ──
const halfPill = (w: number, h: number, dir: 1 | -1) => {
  const r = w; // the half-width is the cap radius
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.lineTo(dir * w, 0);
  s.lineTo(dir * w, h - r);
  s.absarc(0, h - r, r, dir > 0 ? 0 : Math.PI, Math.PI / 2, dir < 0);
  s.lineTo(0, 0);
  return s;
};
export const VFold: React.FC<{ w: number; h: number; color: string; pos: V3; rise: number; fold?: number; rotY?: number }> = ({ w, h, color, pos, rise, fold = 1, rotY = 0 }) => {
  const geo = React.useMemo(() => ({ a: cardGeo(halfPill(w / 2, h, 1)), b: cardGeo(halfPill(w / 2, h, -1)) }), [w, h]);
  React.useEffect(() => () => [geo.a, geo.b].forEach((g) => g.dispose()), [geo]);
  const mats = useStock(color, null, color === PAPER.ink ? 0.7 : 0.82);
  const beta = 0.4 * fold; // each half swings back from the crease (crease toward the lens)
  return (
    <group position={pos} rotation={[0, rotY, 0]}>
      <group rotation={[hingeX(rise), 0, 0]}>
        <mesh geometry={geo.a} material={mats} rotation={[0, beta, 0]} castShadow receiveShadow />
        <mesh geometry={geo.b} material={mats} rotation={[0, -beta, 0]} castShadow receiveShadow />
      </group>
    </group>
  );
};

// ── die-cut letters ──
const FONT3D = new FontLoader().parse(jakarta800 as unknown as Parameters<FontLoader["parse"]>[0]);
const glyphW = (ch: string, size: number) => (((FONT3D.data.glyphs as Record<string, { ha: number }>)[ch]?.ha ?? 600) / FONT3D.data.resolution) * size;
const letterCache = new Map<string, THREE.BufferGeometry>();
const letterGeo = (ch: string, size: number) => {
  const key = `${ch}|${size}`;
  let g = letterCache.get(key);
  if (!g) {
    g = new TextGeometry(ch, { font: FONT3D, size, depth: CARD * 1.4, curveSegments: 10, bevelEnabled: false });
    g.computeBoundingBox();
    const b = g.boundingBox!;
    g.translate(-(b.min.x + b.max.x) / 2, 0, -CARD * 0.7);
    g.computeVertexNormals();
    letterCache.set(key, g);
  }
  return g;
};
/** a word of die-cut letters standing on the page; rise per letter (the shot staggers them) */
export const PaperWord: React.FC<{ text: string; size: number; color: string; pos: V3; rotY?: number; rise: (i: number) => number; tracking?: number }> = ({ text, size, color, pos, rotY = 0, rise, tracking = 0.04 }) => {
  const mats = useStock(color, null, 0.8);
  const adv = text.split("").map((ch) => glyphW(ch, size) + tracking * size);
  const total = adv.reduce((a, b) => a + b, 0) - tracking * size;
  let x = -total / 2;
  return (
    <group position={pos} rotation={[0, rotY, 0]}>
      {text.split("").map((ch, i) => {
        const cx = x + adv[i] / 2;
        x += adv[i];
        if (ch === " ") return null;
        return (
          <group key={i} position={[cx, 0, 0]} rotation={[hingeX(rise(i)), 0, 0]}>
            <mesh geometry={letterGeo(ch, size)} material={mats} castShadow receiveShadow />
          </group>
        );
      })}
    </group>
  );
};

// ── the pop-up phone: a cream card frame with a die-cut window; the screen sits 2 mm behind it ──
export const PhonePop: React.FC<{ pos: V3; rise: number; screen: THREE.Texture | null; w?: number; h?: number; rotY?: number; lean?: number }> = ({ pos, rise, screen, w = 0.082, h = 0.158, rotY = 0, lean = 0.08 }) => {
  const shape = React.useMemo(() => roundRectShape(w, h, 0.012, { flatBottom: false, holes: [holePath(0, h / 2 + 0.002, w - 0.012, h - 0.024, 0.007)] }), [w, h]);
  const mats = useStock(PAPER.cream);
  const back = useStock(PAPER.creamShade);
  const backGeo = React.useMemo(() => cardGeo(roundRectShape(w, h, 0.012)), [w, h]);
  React.useEffect(() => () => backGeo.dispose(), [backGeo]);
  const scr = React.useMemo(() => new THREE.MeshBasicMaterial({ map: screen, toneMapped: false, color: new THREE.Color(1.15, 1.15, 1.15) }), [screen]);
  React.useEffect(() => () => scr.dispose(), [scr]);
  return (
    <PopCard shape={shape} mats={mats} pos={pos} rotY={rotY} rise={rise} lean={lean}>
      <mesh position={[0, h / 2 + 0.002, -0.0012]}>
        <planeGeometry args={[w - 0.012, h - 0.024]} />
        <primitive object={scr} attach="material" />
      </mesh>
      <mesh geometry={backGeo} material={back} position={[0, 0, -0.0028]} castShadow />
      {/* the camera dot on the frame */}
      <mesh position={[0, h - 0.0062, CARD / 2 + 0.0002]}>
        <circleGeometry args={[0.0017, 20]} />
        <meshStandardMaterial color={PAPER.ink} roughness={0.5} />
      </mesh>
    </PopCard>
  );
};

/** printed wheel (looks round the rim), lying on the page, turning about its pin */
export const Volvelle: React.FC<{ pos: V3; r: number; turn: number; print: THREE.Texture | null }> = ({ pos, r, turn, print }) => {
  const shape = React.useMemo(() => {
    const s = new THREE.Shape();
    s.absarc(0, 0, r, 0, Math.PI * 2, false);
    return s;
  }, [r]);
  const geo = React.useMemo(() => cardGeo(shape), [shape]);
  React.useEffect(() => () => geo.dispose(), [geo]);
  const mats = useStock(PAPER.lavender, print);
  return (
    <group position={pos} rotation={[-Math.PI / 2, 0, turn]}>
      <mesh geometry={geo} material={mats} castShadow receiveShadow />
      <mesh position={[0, 0, CARD]}>
        <cylinderGeometry args={[0.004, 0.004, 0.002, 20]} />
        <meshStandardMaterial color={PAPER.green} roughness={0.4} metalness={0.2} />
      </mesh>
    </group>
  );
};

// ── amplify: a bill envelope sliding out from between the leaves at the fore-edge ──
//   name: Envelope   story job: "a bill every month" — one slides out per beat, fanning toward the lens
//   real size: 11 × 6.5 cm, 1.5 mm     knobs: out 0..1 (slide distance), fan (radians about y)
export const Envelope: React.FC<{ base: V3; out: number; fan: number; tex: THREE.Texture | null; tilt?: number }> = ({ base, out, fan, tex, tilt = 0 }) => {
  const mats = React.useMemo(() => {
    const plain = new THREE.MeshStandardMaterial({ color: "#E4DED0", roughness: 0.9 });
    const face = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.88 });
    return [plain, plain, face, plain, plain, plain];
  }, [tex]);
  React.useEffect(() => () => mats.forEach((m) => m.dispose()), [mats]);
  const w = 0.11, d = 0.065;
  return (
    <group position={base} rotation={[0, fan, 0]}>
      <group position={[w / 2 - 0.1 + out * 0.105, 0, 0]} rotation={[0, 0, tilt]}>
        <mesh material={mats} castShadow receiveShadow>
          <boxGeometry args={[w, 0.0015, d]} />
        </mesh>
      </group>
    </group>
  );
};

// ── demo: a pull-tab sliding out of a printed slot; the strip carries a Hinglish caption ──
//   knobs: out 0..1 (visible length of the strip), tick (spring scale of the green tick)
export const PullTab: React.FC<{ slot: V3; len: number; w: number; out: number; tick: number; tex: THREE.Texture | null }> = ({ slot, len, w, out, tick, tex }) => {
  const shown = Math.max(0.0005, out * len);
  const strip = React.useMemo(() => (tex ? tex.clone() : null), [tex]);
  React.useEffect(() => () => strip?.dispose(), [strip]);
  if (strip) {
    strip.repeat.set(shown / len, 1); // the printed strip travels with the paper: only its leading part is out
    strip.offset.set(1 - shown / len, 0);
    strip.needsUpdate = true;
  }
  const mats = React.useMemo(() => {
    const face = new THREE.MeshStandardMaterial({ map: strip, roughness: 0.8 });
    const edge = new THREE.MeshStandardMaterial({ color: PAPER.greenDeep, roughness: 0.85 });
    return [edge, edge, face, edge, edge, edge];
  }, [strip]);
  React.useEffect(() => () => mats.forEach((m) => m.dispose()), [mats]);
  const tickS = Math.max(0, tick);
  return (
    <group position={slot}>
      {/* the slot: a dark cut in the page */}
      <mesh position={[0, -0.0003, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.003, w + 0.004]} />
        <meshBasicMaterial color="#2A2620" />
      </mesh>
      <mesh position={[shown / 2, 0.0004, 0]} material={mats} castShadow receiveShadow>
        <boxGeometry args={[shown, 0.0009, w]} />
      </mesh>
      {tickS > 0.001 && (
        <group position={[shown + 0.014, 0.004, -w * 0.1]} scale={tickS}>
          <mesh castShadow>
            <cylinderGeometry args={[0.011, 0.011, 0.003, 32]} />
            <meshStandardMaterial color={PAPER.mint} roughness={0.5} />
          </mesh>
          <mesh position={[-0.0025, 0.0022, 0.0012]} rotation={[-Math.PI / 2, 0, -0.75]}>
            <boxGeometry args={[0.007, 0.0022, 0.0012]} />
            <meshStandardMaterial color={PAPER.cream} roughness={0.6} />
          </mesh>
          <mesh position={[0.0028, 0.0022, -0.0008]} rotation={[-Math.PI / 2, 0, 0.9]}>
            <boxGeometry args={[0.012, 0.0022, 0.0012]} />
            <meshStandardMaterial color={PAPER.cream} roughness={0.6} />
          </mesh>
        </group>
      )}
    </group>
  );
};

// ── payoff: a banner card on a dowel (FREE, OPEN SOURCE) ──
export const Banner: React.FC<{ pos: V3; w: number; h: number; rise: number; tex: THREE.Texture | null; rotY?: number; color?: string }> = ({ pos, w, h, rise, tex, rotY = 0, color = PAPER.green }) => {
  const shape = React.useMemo(() => {
    const s = new THREE.Shape(); // a banner with a swallowtail on the right
    s.moveTo(-w / 2, 0);
    s.lineTo(w / 2, 0);
    s.lineTo(w / 2 - h * 0.22, h / 2);
    s.lineTo(w / 2, h);
    s.lineTo(-w / 2, h);
    s.lineTo(-w / 2, 0);
    return s;
  }, [w, h]);
  const geo = React.useMemo(() => cardGeo(shape), [shape]);
  React.useEffect(() => () => geo.dispose(), [geo]);
  const mats = useStock(color, tex, 0.8);
  const pole = h * 1.9;
  return (
    <group position={pos} rotation={[0, rotY, 0]}>
      <group rotation={[hingeX(rise, 0.04), 0, 0]}>
        <mesh position={[-w / 2 - 0.0016, pole / 2, 0]} castShadow>
          <cylinderGeometry args={[0.0016, 0.0016, pole, 12]} />
          <meshStandardMaterial color={PAPER.ink} roughness={0.5} />
        </mesh>
        <mesh geometry={geo} material={mats} position={[0, pole - h, 0]} castShadow receiveShadow />
      </group>
    </group>
  );
};

// ── payoff: the loose WATERMARK sheet: peels up from its right edge, then flies at the lens ──
//   knobs: peel 0..1 (the curl travels from the right edge across), fly 0..1 (lift off toward `to`, tumbling)
export const TearSheet: React.FC<{ x0: number; y0: number; w: number; h: number; peel: number; fly: number; to: V3; tex: THREE.Texture | null; back?: THREE.Texture | null }> = ({ x0, y0, w, h, peel, fly, to, tex, back = tex }) => {
  const q = Math.round(peel * 300) / 300;
  const geo = React.useMemo(() => {
    const nx = 48, nz = 6, pos: number[] = [], uv: number[] = [], idx: number[] = [];
    for (let j = 0; j <= nz; j++) {
      const zf = j / nz - 0.5;
      let x = 0, y = 0;
      const ds = w / nx;
      for (let i = 0; i <= nx; i++) {
        pos.push(x0 + x, y0 + y, zf * h);
        uv.push(i / nx, 1 - j / nz);
        const s = (i + 0.5) / nx;
        const front = 1 - q * 1.25 + 0.12 * zf; // the curl leads at the head corner
        const k = Math.min(1, Math.max(0, (s - front) / 0.32));
        const th = Math.PI * 0.92 * k * k * (3 - 2 * k) * Math.min(1, q * 1.6);
        x += Math.cos(th) * ds;
        y += Math.sin(th) * ds;
      }
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
  }, [q, x0, y0, w, h]);
  React.useEffect(() => () => geo.dispose(), [geo]);
  const mats = React.useMemo(() => ({
    f: new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.5, roughness: 0.9, side: THREE.FrontSide, shadowSide: THREE.DoubleSide }),
    b: new THREE.MeshStandardMaterial({ color: "#E2DED4", map: back, transparent: true, alphaTest: 0.5, roughness: 0.9, side: THREE.BackSide }),
  }), [tex, back]);
  React.useEffect(() => () => [mats.f, mats.b].forEach((m) => m.dispose()), [mats]);
  // fly: lift from the sheet's centre toward `to`, ease-in (it accelerates at the lens), with a tumble
  const c: V3 = [x0 + w / 2, y0, 0];
  const e = fly * fly;
  const p: V3 = [c[0] + (to[0] - c[0]) * e, c[1] + (to[1] - c[1]) * e, c[2] + (to[2] - c[2]) * e];
  return (
    <group position={p} rotation={[-1.1 * e, 0.6 * e, 0.9 * e]}>
      <group position={[-c[0], -c[1], -c[2]]}>
        <mesh geometry={geo} material={mats.f} castShadow receiveShadow />
        <mesh geometry={geo} material={mats.b} receiveShadow />
      </group>
    </group>
  );
};
