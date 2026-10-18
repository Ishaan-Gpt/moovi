import React from "react";
import * as THREE from "three";
import { V3, useCanvasTex } from "../lib";
import { burst } from "../motion";

// Reusable R3F props for Style 3 films (catalogue: styles/style-3/library/README.md). Real-world sizes in metres,
// three.js axes (y up). Each prop is a pure function of its props: animate it from the shot with the world clock.

// ── the paper-plane cursor (an arrowhead folded down the middle, tip at +x): the recurring "user" character ──
export const planeGeo = (() => {
  const g = new THREE.BufferGeometry();
  const v = new Float32Array([
    0.06, 0, 0, -0.035, 0.032, -0.006, -0.02, 0, 0.012, // top-left wing
    0.06, 0, 0, -0.02, 0, 0.012, -0.035, -0.032, -0.006, // top-right wing
  ]);
  g.setAttribute("position", new THREE.BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g;
})();
// the cursor is the 3D arrow in kit/cursor.tsx (extruded, bevelled rim, "mac" black/white or "facet" violet→magenta);
// same props as the old paper plane, so every shot picks it up
export { Cursor } from "./cursor";

// ── over-ear headphones: band (half torus), two cups with cushions on the inner faces ──
export const Headphones: React.FC<{ pos: V3; rot: V3; s?: number; cup?: string; band?: string; cushion?: string }> = ({
  pos, rot, s = 1, cup = "#9A6862", band = "#D8AFA2", cushion = "#F6E9DF",
}) => (
  <group position={pos} rotation={rot} scale={s}>
    <mesh position={[0, 0.02, 0]}>
      <torusGeometry args={[0.078, 0.0085, 16, 48, Math.PI]} />
      <meshStandardMaterial color={band} roughness={0.45} />
    </mesh>
    {[-1, 1].map((k) => (
      <group key={k} position={[0.08 * k, -0.01, 0]} rotation={[0, 0, (Math.PI / 2) * k]}>
        <mesh>
          <cylinderGeometry args={[0.038, 0.038, 0.028, 32]} />
          <meshStandardMaterial color={cup} roughness={0.45} />
        </mesh>
        <mesh position={[0, 0.016, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.028, 0.011, 12, 32]} />
          <meshStandardMaterial color={cushion} roughness={0.85} />
        </mesh>
      </group>
    ))}
  </group>
);

/**
 * A paper shopping bag (w × d × h, open top, handle slots in both wide faces). `open` 0→1 flares the mouth and
 * chamfers its corners (rectangle → octagon: the bag "opening up" to catch something, ref A 20.0 s); `squash`
 * 0→1 is the impact (shorter, wider). The base stays on the floor at y = 0 of the group.
 */
const bagGeo = (w: number, d: number, h: number, open: number) => {
  // 8-point rings: two points per corner; closed they coincide at the corner, open they split along the sides
  const ring = (y: number, flare: number, chamfer: number) => {
    const pts: [number, number][] = [];
    const corners: [number, number][] = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
    corners.forEach(([sx, sz], i) => {
      const [nx, nz] = corners[(i + 1) % 4];
      const X = sx * (w / 2 + flare), Z = sz * (d / 2 + flare);
      const toPrev: [number, number] = sz === corners[(i + 3) % 4][1] ? [-sx, 0] : [0, -sz];
      const toNext: [number, number] = nz === sz ? [-sx, 0] : [0, -sz];
      pts.push([X + toPrev[0] * chamfer, Z + toPrev[1] * chamfer], [X + toNext[0] * chamfer, Z + toNext[1] * chamfer]);
    });
    return pts.map(([x, z]) => [x, y, z] as V3);
  };
  const bot = ring(0, 0, 0), top = ring(h, open * 0.035, open * Math.min(w, d) * 0.28);
  const v: number[] = [];
  const quad = (a: V3, b: V3, c: V3, e: V3) => v.push(...a, ...b, ...c, ...a, ...c, ...e);
  for (let i = 0; i < 8; i++) quad(bot[i], bot[(i + 1) % 8], top[(i + 1) % 8], top[i]);
  quad([w / 2, 0.001, d / 2], [w / 2, 0.001, -d / 2], [-w / 2, 0.001, -d / 2], [-w / 2, 0.001, d / 2]);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g;
};
export const ShoppingBag: React.FC<{ pos: V3; rotY?: number; w?: number; d?: number; h?: number; open?: number; squash?: number; color?: string }> = ({
  pos, rotY = 0, w = 0.25, d = 0.15, h = 0.3, open = 0, squash = 0, color = "#FBF8F6",
}) => {
  const o = Math.round(open * 40) / 40;
  const geo = React.useMemo(() => bagGeo(w, d, h, o), [w, d, h, o]);
  React.useEffect(() => () => geo.dispose(), [geo]);
  return (
    <group position={pos} rotation={[0, rotY, 0]} scale={[1 + squash * 0.06, 1 - squash * 0.08, 1 + squash * 0.06]}>
      <mesh geometry={geo}>
        {/* paper reads white in the refs even in shade: a little self-light keeps it off grey */}
        <meshStandardMaterial color={color} roughness={0.92} side={THREE.DoubleSide} flatShading emissive="#FFF1EC" emissiveIntensity={0.28} />
      </mesh>
      {[1, -1].map((k) => (
        <mesh key={k} position={[0, h - 0.045, k * (d / 2 + 0.0015 + open * 0.02)]} rotation={[0, k > 0 ? 0 : Math.PI, 0]}>
          <planeGeometry args={[w * 0.32, 0.018]} />
          <meshStandardMaterial color="#8E8580" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
};

// ── a wooden ruler (tick marks drawn on a canvas) ──
export const Ruler: React.FC<{ pos: V3; rot: V3; len?: number }> = ({ pos, rot, len = 0.17 }) => {
  const tex = useCanvasTex(512, 64, (c, w, h) => {
    c.fillStyle = "#F2C27F";
    c.fillRect(0, 0, w, h);
    c.fillStyle = "#8A5A2B";
    for (let i = 0; i < 50; i++) c.fillRect(8 + i * 10, 0, 2, i % 5 ? 14 : 26);
  }, []);
  return (
    <mesh position={pos} rotation={rot}>
      <boxGeometry args={[len, 0.026, 0.003]} />
      <meshStandardMaterial map={tex} roughness={0.5} />
    </mesh>
  );
};

// ── confetti burst: flat paper bits thrown from an origin, drag + gravity (motion.ts burst), s = world seconds ──
export const CONFETTI = ["#FF5A8A", "#7A5CFF", "#FFC54D", "#3DD6A0", "#FFFFFF"];
export const Confetti: React.FC<{ s: number; origin: V3; toward?: V3; n?: number; speed?: number; seed?: number; colors?: string[] }> = ({
  s, origin, toward = [0.6, 0.3, 1], n = 26, speed = 1.1, seed = 41, colors = CONFETTI,
}) => (
  <>
    {Array.from({ length: n }, (_, i) => {
      const b = burst(i, Math.max(0, s), { origin, toward, speed, spread: 0.9, drag: 1.6, g: 0.6, seed });
      return (
        <mesh key={i} position={b.pos} rotation={b.rot} scale={0.012 + (i % 3) * 0.004}>
          <planeGeometry args={[1, 0.6]} />
          <meshStandardMaterial color={colors[i % colors.length]} roughness={0.6} side={THREE.DoubleSide} />
        </mesh>
      );
    })}
  </>
);

// ── canvas helpers for screen content ──
/** a party-face emoji (hat + horn + blush) drawn on a 2D canvas, centre x,y, radius r */
export const drawEmoji = (c: CanvasRenderingContext2D, x: number, y: number, r: number) => {
  const g = c.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
  g.addColorStop(0, "#FFE58A");
  g.addColorStop(1, "#F5A623");
  c.fillStyle = g;
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = "#6B3A12";
  c.lineWidth = r * 0.07;
  c.lineCap = "round";
  for (const k of [-1, 1]) {
    c.beginPath();
    c.arc(x + k * r * 0.36, y - r * 0.12, r * 0.14, Math.PI * 1.1, Math.PI * 1.9);
    c.stroke();
  }
  c.fillStyle = "rgba(255,120,120,0.55)";
  for (const k of [-1, 1]) {
    c.beginPath();
    c.ellipse(x + k * r * 0.55, y + r * 0.2, r * 0.16, r * 0.1, 0, 0, Math.PI * 2);
    c.fill();
  }
  c.fillStyle = "#4FB6FF";
  c.beginPath();
  c.moveTo(x + r * 0.1, y + r * 0.42);
  c.lineTo(x + r * 0.95, y + r * 0.2);
  c.lineTo(x + r * 0.95, y + r * 0.62);
  c.closePath();
  c.fill();
  c.fillStyle = "#C66BFF";
  c.beginPath();
  c.moveTo(x - r * 0.75, y - r * 0.55);
  c.lineTo(x - r * 0.15, y - r * 0.92);
  c.lineTo(x - r * 0.62, y - r * 1.55);
  c.closePath();
  c.fill();
  c.fillStyle = "#FFD84D";
  c.beginPath();
  c.arc(x - r * 0.62, y - r * 1.55, r * 0.12, 0, Math.PI * 2);
  c.fill();
};
