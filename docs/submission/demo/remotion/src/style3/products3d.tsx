import React from "react";
import * as THREE from "three";

// Small glossy 3D products for product cards (the "3D icon" look of launch films): procedural, real-ish proportions,
// ~0.2 m tall, centred at the origin, facing +z. Colour per card. Reusable for any e-commerce / catalogue shot.
export type ProductKind = "headphones" | "shorts" | "nightstand" | "camera" | "dress" | "tote" | "bottle";

const gloss = (color: string, rough = 0.32) => new THREE.MeshPhysicalMaterial({ color, roughness: rough, clearcoat: 0.6, clearcoatRoughness: 0.25, metalness: 0 });
const matCache = new Map<string, THREE.Material>();
const M = (color: string, rough?: number) => {
  const k = `${color}/${rough ?? 0.32}`;
  if (!matCache.has(k)) matCache.set(k, gloss(color, rough));
  return matCache.get(k)!;
};
const shadeHex = (hex: string, k: number) => {
  const c = new THREE.Color(hex).multiplyScalar(k);
  return `#${c.getHexString()}`;
};

const dressGeo = (() => {
  const pts = [[0, 0.1], [0.03, 0.1], [0.034, 0.06], [0.028, 0.03], [0.05, -0.02], [0.08, -0.08], [0.095, -0.1], [0, -0.1]].map(([x, y]) => new THREE.Vector2(x, y));
  return new THREE.LatheGeometry(pts, 40);
})();
const shortsGeo = (() => {
  const s = new THREE.Shape();
  s.moveTo(-0.075, 0.06); s.lineTo(0.075, 0.06); s.lineTo(0.09, -0.07); s.lineTo(0.012, -0.075); s.lineTo(0, -0.005); s.lineTo(-0.012, -0.075); s.lineTo(-0.09, -0.07); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.035, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 3 });
  g.translate(0, 0, -0.0175);
  return g;
})();

export const Product3D: React.FC<{ kind: ProductKind; color: string; s?: number; rot?: [number, number, number] }> = ({ kind, color, s = 1, rot = [0, 0, 0] }) => {
  const dark = shadeHex(color, 0.6);
  return (
    <group scale={s} rotation={rot}>
      {kind === "headphones" && (
        <>
          <mesh position={[0, 0.02, 0]} material={M(color)}>
            <torusGeometry args={[0.08, 0.011, 16, 48, Math.PI]} />
          </mesh>
          {[-1, 1].map((k) => (
            <group key={k} position={[0.082 * k, -0.02, 0]} rotation={[0, 0, (Math.PI / 2) * k]}>
              <mesh material={M(color)}>
                <cylinderGeometry args={[0.042, 0.042, 0.036, 32]} />
              </mesh>
              <mesh position={[0, 0.02, 0]} rotation={[Math.PI / 2, 0, 0]} material={M("#F5C34B", 0.5)}>
                <torusGeometry args={[0.03, 0.012, 12, 32]} />
              </mesh>
            </group>
          ))}
        </>
      )}
      {kind === "tote" && (
        <>
          <mesh material={M(color)}>
            <boxGeometry args={[0.16, 0.15, 0.05]} />
          </mesh>
          {[-1, 1].map((k) => (
            <mesh key={k} position={[0.04 * k, 0.075, 0]} material={M(dark)}>
              <torusGeometry args={[0.028, 0.006, 10, 24, Math.PI]} />
            </mesh>
          ))}
        </>
      )}
      {kind === "dress" && (
        <>
          <mesh geometry={dressGeo} scale={[1, 1, 0.55]} material={M(color)} />
          {[-1, 1].map((k) => (
            <mesh key={k} position={[0.02 * k, 0.12, 0]} material={M(color)}>
              <cylinderGeometry args={[0.004, 0.004, 0.04, 8]} />
            </mesh>
          ))}
        </>
      )}
      {kind === "bottle" && (
        <>
          <mesh material={M(color, 0.2)} position={[0, -0.02, 0]}>
            <cylinderGeometry args={[0.04, 0.042, 0.15, 36]} />
          </mesh>
          <mesh material={M(color, 0.2)} position={[0, 0.07, 0]}>
            <cylinderGeometry args={[0.018, 0.038, 0.035, 36]} />
          </mesh>
          <mesh material={M("#2A2733", 0.4)} position={[0, 0.1, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 0.03, 24]} />
          </mesh>
          <mesh material={M("#FFFFFF", 0.6)} position={[0, -0.02, 0.0405]}>
            <planeGeometry args={[0.05, 0.05]} />
          </mesh>
        </>
      )}
      {kind === "camera" && (
        <>
          <mesh material={M(color, 0.35)}>
            <boxGeometry args={[0.19, 0.12, 0.07]} />
          </mesh>
          <mesh material={M("#8E8A96", 0.25)} position={[0.01, -0.005, 0.05]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.042, 0.046, 0.04, 36]} />
          </mesh>
          <mesh material={M("#15131A", 0.1)} position={[0.01, -0.005, 0.071]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.032, 0.032, 0.004, 36]} />
          </mesh>
          <mesh material={M("#F5C34B", 0.4)} position={[-0.06, 0.075, 0]}>
            <boxGeometry args={[0.04, 0.03, 0.04]} />
          </mesh>
        </>
      )}
      {kind === "nightstand" && (
        <>
          <mesh material={M(color, 0.55)}>
            <boxGeometry args={[0.16, 0.16, 0.12]} />
          </mesh>
          {[0.035, -0.04].map((y, i) => (
            <group key={i}>
              <mesh material={M(shadeHex(color, 0.9), 0.5)} position={[0, y, 0.061]}>
                <boxGeometry args={[0.14, 0.06, 0.006]} />
              </mesh>
              <mesh material={M("#C9A15A", 0.3)} position={[0, y, 0.067]}>
                <sphereGeometry args={[0.007, 12, 8]} />
              </mesh>
            </group>
          ))}
          {[-1, 1].map((k) => (
            <mesh key={k} material={M(shadeHex(color, 0.75), 0.5)} position={[0.065 * k, -0.1, 0.045]}>
              <boxGeometry args={[0.014, 0.04, 0.014]} />
            </mesh>
          ))}
        </>
      )}
      {kind === "shorts" && <mesh geometry={shortsGeo} material={M(color)} />}
    </group>
  );
};
