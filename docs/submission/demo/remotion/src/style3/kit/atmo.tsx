import React from "react";
import * as THREE from "three";
import { V3, rand } from "../lib";

// Atmosphere (skill style-3-build §5, law 3): light needs a body. Haze (fog + a far gradient), dust in the key,
// bokeh sprites near the lens, light shafts, glare at every practical. All pure functions of the world clock `s`.
// Sprites and shafts are flagged `userData.bridge = "skip"` (the Blender bridge adds its own volumetrics).

const discTex = (() => {
  let tex: THREE.Texture | null = null;
  return () => {
    if (tex) return tex;
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const x = c.getContext("2d")!;
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.55, "rgba(255,255,255,0.55)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, 128, 128);
    tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  };
})();

/** scene fog + background in one colour: depth falls into the world's colour, never into black */
export const Haze: React.FC<{ color: string; near?: number; far?: number }> = ({ color, near = 3, far = 18 }) => (
  <>
    <color attach="background" args={[color]} />
    <fog attach="fog" args={[color, near, far]} />
  </>
);

/** dust motes drifting in a box on the world clock; brighter toward `key` (the light's direction) */
export const Dust: React.FC<{ n?: number; seed?: number; box?: [V3, V3]; s: number; size?: number; color?: string; opacity?: number; drift?: number }> = ({
  n = 160, seed = 11, box = [[-2, 0, -2], [2, 2.4, 1.5]], s, size = 0.012, color = "#FFF2DC", opacity = 0.55, drift = 0.06 }) => {
  const ref = React.useRef<THREE.InstancedMesh>(null);
  const geo = React.useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  const m = React.useMemo(() => new THREE.MeshBasicMaterial({ map: discTex(), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), [color, opacity]);
  React.useEffect(() => () => { geo.dispose(); m.dispose(); }, [geo, m]);
  React.useLayoutEffect(() => {
    const im = ref.current;
    if (!im) return;
    const o = new THREE.Object3D();
    const span = [0, 1, 2].map((a) => box[1][a] - box[0][a]);
    for (let i = 0; i < n; i++) {
      const k = seed * 1000 + i * 17;
      const p = [0, 1, 2].map((a) => {
        const base = box[0][a] + rand(k + a) * span[a];
        const v = (rand(k + 3 + a) - 0.5) * drift * 2 * (a === 1 ? 0.5 : 1) * s + 0.015 * Math.sin(s * (0.6 + rand(k + 7)) + rand(k + 8) * 7);
        return box[0][a] + ((((base + v - box[0][a]) % span[a]) + span[a]) % span[a]);
      });
      const sz = size * (0.5 + rand(k + 9) * 1.2);
      o.position.set(p[0], p[1], p[2]);
      o.scale.setScalar(sz);
      o.rotation.set(0, 0, 0);
      o.updateMatrix();
      im.setMatrixAt(i, o.matrix);
    }
    im.instanceMatrix.needsUpdate = true;
  }, [n, seed, box, s, size, drift]);
  return <instancedMesh ref={ref} args={[geo, m, n]} frustumCulled={false} userData={{ bridge: "skip" }} onUpdate={(im) => im.quaternion.set(0, 0, 0, 1)} />;
};

/** soft bokeh discs near the lens (parallax from their depth), slowly floating; the near plane of a dark world */
export const BokehSprites: React.FC<{ n?: number; seed?: number; box?: [V3, V3]; s: number; size?: [number, number]; colors?: string[]; opacity?: number }> = ({
  n = 24, seed = 4, box = [[-2.5, -1.2, 0.2], [2.5, 1.6, 2.2]], s, size = [0.06, 0.22], colors = ["#FFD9A6", "#FFF6E6", "#F0B6FF"], opacity = 0.35 }) => {
  const tex = discTex();
  const mats = React.useMemo(() => colors.map((c) => new THREE.SpriteMaterial({ map: tex, color: c, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })), [colors, opacity, tex]);
  React.useEffect(() => () => mats.forEach((m) => m.dispose()), [mats]);
  return (
    <group userData={{ bridge: "skip" }}>
      {Array.from({ length: n }, (_, i) => {
        const k = seed * 100 + i * 5;
        const p: V3 = [0, 1, 2].map((a) => box[0][a] + rand(k + a) * (box[1][a] - box[0][a])) as V3;
        const f = 0.03 * Math.sin(s * (0.3 + rand(k + 4) * 0.4) + rand(k + 6) * 6);
        const sz = size[0] + rand(k + 3) * (size[1] - size[0]);
        return <sprite key={i} material={mats[i % mats.length]} position={[p[0] + f, p[1] + f * 0.6, p[2]]} scale={[sz, sz, 1]} />;
      })}
    </group>
  );
};

/** additive light shafts: n long soft wedges from `from` toward `dir` (a window, a projector, a gap in blinds) */
export const LightShafts: React.FC<{ from: V3; dir: V3; n?: number; length?: number; width?: number; spread?: number; color?: string; opacity?: number; seed?: number; s?: number }> = ({
  from, dir, n = 5, length = 6, width = 0.35, spread = 1.2, color = "#FFE7B8", opacity = 0.12, seed = 2, s = 0 }) => {
  const tex = React.useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 8;
    const x = c.getContext("2d")!;
    const g = x.createLinearGradient(0, 0, 256, 0);
    g.addColorStop(0, "rgba(255,255,255,0.9)");
    g.addColorStop(0.5, "rgba(255,255,255,0.35)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, 256, 8);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  const m = React.useMemo(() => new THREE.MeshBasicMaterial({ map: tex, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false }), [tex, color, opacity]);
  React.useEffect(() => () => { tex.dispose(); m.dispose(); }, [tex, m]);
  const d = new THREE.Vector3(...dir).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), d);
  return (
    <group position={from} quaternion={q} userData={{ bridge: "skip" }}>
      {Array.from({ length: n }, (_, i) => {
        const k = seed * 50 + i * 3;
        const y = (rand(k) - 0.5) * spread, z = (rand(k + 1) - 0.5) * spread * 0.6;
        const w = width * (0.6 + rand(k + 2)) * (1 + 0.08 * Math.sin(s * 0.7 + i));
        return (
          <mesh key={i} material={m} position={[length / 2, y, z]} rotation={[rand(k + 4) * Math.PI, 0, 0]}>
            <planeGeometry args={[length, w]} />
          </mesh>
        );
      })}
    </group>
  );
};

/** the glare at a practical light (a soft additive disc that always faces the lens); size in metres */
export const Glare: React.FC<{ pos: V3; color?: string; size?: number; opacity?: number }> = ({ pos, color = "#FFE9C4", size = 0.5, opacity = 0.6 }) => {
  const m = React.useMemo(() => new THREE.SpriteMaterial({ map: discTex(), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), [color, opacity]);
  React.useEffect(() => () => m.dispose(), [m]);
  return <sprite material={m} position={pos} scale={[size, size, 1]} userData={{ bridge: "skip" }} />;
};

/**
 * A practical in frame: an emissive body (bulb / tube / panel) + a point light + its glare, in one. kind: "bulb"
 * (sphere), "tube" (a cylinder along y of `length`), "panel" (a flat rectangle facing +z). Intensity in candela-ish
 * three units (2-8 for a desk lamp, 10-30 for a neon tube in a dark room).
 */
export const Practical: React.FC<{ pos: V3; color?: string; kind?: "bulb" | "tube" | "panel"; size?: number; length?: number; intensity?: number; glare?: number; rotation?: V3; distance?: number; emissive?: number; shadow?: boolean }> = ({
  pos, color = "#FFD8A0", kind = "bulb", size = 0.04, length = 0.8, intensity = 6, glare = 0.5, rotation = [0, 0, 0], distance = 6, emissive = 2.4, shadow = false }) => {
  const m = React.useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(emissive), toneMapped: false }), [color, emissive]);
  React.useEffect(() => () => m.dispose(), [m]);
  return (
    <group position={pos} rotation={rotation}>
      {kind === "bulb" && <mesh material={m}><sphereGeometry args={[size, 24, 16]} /></mesh>}
      {kind === "tube" && <mesh material={m}><cylinderGeometry args={[size, size, length, 20]} /></mesh>}
      {kind === "panel" && <mesh material={m}><planeGeometry args={[length, size * 6]} /></mesh>}
      <pointLight color={color} intensity={intensity} distance={distance} decay={1.6} castShadow={shadow} />
      {glare > 0 && <Glare pos={[0, 0, 0]} color={color} size={glare} opacity={0.55} />}
    </group>
  );
};

/** rain / snow streaks falling in a box on the world clock (thin additive planes); for night windows and rooftops */
export const Rain: React.FC<{ n?: number; seed?: number; box?: [V3, V3]; s: number; speed?: number; length?: number; color?: string; opacity?: number; slant?: number }> = ({
  n = 120, seed = 21, box = [[-2, -1, -1], [2, 2.5, 1]], s, speed = 2.2, length = 0.12, color = "#CFE6FF", opacity = 0.35, slant = 0.08 }) => {
  const ref = React.useRef<THREE.InstancedMesh>(null);
  const geo = React.useMemo(() => new THREE.PlaneGeometry(0.004, 1), []);
  const m = React.useMemo(() => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide }), [color, opacity]);
  React.useEffect(() => () => { geo.dispose(); m.dispose(); }, [geo, m]);
  const span = box[1][1] - box[0][1];
  React.useLayoutEffect(() => {
    const im = ref.current;
    if (!im) return;
    const o = new THREE.Object3D();
    for (let i = 0; i < n; i++) {
      const k = seed * 1000 + i * 7;
      const x = box[0][0] + rand(k) * (box[1][0] - box[0][0]);
      const z = box[0][2] + rand(k + 2) * (box[1][2] - box[0][2]);
      const y0 = box[0][1] + rand(k + 1) * span;
      const y = box[0][1] + ((((y0 - s * speed * (0.8 + rand(k + 3) * 0.5) - box[0][1]) % span) + span) % span);
      o.position.set(x + slant * (y - box[0][1]), y, z);
      o.scale.set(1, length * (0.6 + rand(k + 4)), 1);
      o.rotation.set(0, 0, slant);
      o.updateMatrix();
      im.setMatrixAt(i, o.matrix);
    }
    im.instanceMatrix.needsUpdate = true;
  }, [n, seed, box, s, speed, length, slant, span]);
  return <instancedMesh ref={ref} args={[geo, m, n]} frustumCulled={false} userData={{ bridge: "skip" }} />;
};
