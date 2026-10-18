import React from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { ContactShadows } from "@react-three/drei";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import jakarta800 from "../../kit/fonts/jakarta-800.typeface.json";

// ce3-03 "On Beat" foundation: the owner's palette (BRIEF.md: cream dominant, ink lines, lavender accents, deep green
// emphasis) as the brand's house look (matte lavender soft-touch plastic + brushed gold, soft key from the top left),
// an infinite cream studio, the beat grid of "Raving Energy" (122.02 BPM), and extruded 3D type in our own font.

export const PAL = {
  cream: "#FFFFEB", ink: "#1A1A1A", lavender: "#F0D7FF", lavDeep: "#C9A7F5", green: "#034F46", gold: "#D9A94E",
  grey: "#A3A19C", apricot: "#FFA946", mint: "#34D399",
};

// ── beat grid: kick at 0.025 s, then every 60/122.02 s; the track breaks at beats 14–15 and drops at 16 ──
export const BEAT = 60 / 122.02;
export const B0 = 0.025;
export const bt = (k: number) => B0 + k * BEAT;
export const beatOf = (t: number) => Math.floor((t - B0) / BEAT);
/** 1 on each beat, decaying (a kick envelope); `every` = only every n-th beat; `from` = first beat that counts */
export const kick = (t: number, decay = 9, every = 1, from = 0) => {
  const k = beatOf(t);
  if (k < from) return 0;
  const kk = k - ((k - from) % every);
  return Math.exp(-(t - bt(kk)) * decay);
};

// ── materials (one set per mount) ──
export const useMats = () =>
  React.useMemo(() => {
    const m = {
      lav: new THREE.MeshPhysicalMaterial({ color: "#D8BBFA", roughness: 0.55, clearcoat: 0.15, clearcoatRoughness: 0.6, sheen: 0.5, sheenColor: new THREE.Color("#FFFFFF"), sheenRoughness: 0.8 }),
      lavDeep: new THREE.MeshPhysicalMaterial({ color: "#B993EE", roughness: 0.5, clearcoat: 0.2, clearcoatRoughness: 0.5, sheen: 0.4, sheenColor: new THREE.Color("#FFFFFF") }),
      gold: new THREE.MeshStandardMaterial({ color: PAL.gold, metalness: 1, roughness: 0.3, userData: { envBoost: 1.25 } }),
      ink: new THREE.MeshStandardMaterial({ color: PAL.ink, roughness: 0.42 }),
      green: new THREE.MeshPhysicalMaterial({ color: PAL.green, roughness: 0.42, clearcoat: 0.3, clearcoatRoughness: 0.4 }),
      grey: new THREE.MeshStandardMaterial({ color: "#8C8A85", roughness: 0.7 }),
      cream: new THREE.MeshStandardMaterial({ color: PAL.cream, roughness: 0.6 }),
      apricot: new THREE.MeshPhysicalMaterial({ color: PAL.apricot, roughness: 0.45, clearcoat: 0.25 }),
      mint: new THREE.MeshPhysicalMaterial({ color: PAL.mint, roughness: 0.45, clearcoat: 0.25 }),
    };
    return m;
  }, []);
export type Mats = ReturnType<typeof useMats>;

// studio reflections for the gold and the clearcoat (no HDRI fetch): three's RoomEnvironment through PMREM
const EnvMap: React.FC<{ intensity?: number }> = ({ intensity = 0.45 }) => {
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
    };
  }, [env, scene]);
  scene.environmentIntensity = intensity;
  // materials tagged userData.envBoost get the env as their own envMap, so their own intensity applies (three uses
  // scene.environmentIntensity only for materials without an envMap)
  React.useLayoutEffect(() => {
    scene.traverse((o) => {
      const mats = (o as THREE.Mesh).material;
      if (!mats) return;
      (Array.isArray(mats) ? mats : [mats]).forEach((mt) => {
        const b = mt.userData?.envBoost as number | undefined;
        const ms = mt as THREE.MeshStandardMaterial;
        if (b && ms.envMap !== env) {
          ms.envMap = env;
          ms.envMapIntensity = b;
          ms.needsUpdate = true;
        }
      });
    });
  });
  return null;
};

/** the infinite cream studio: an unlit cream floor fading into a cream background (fog), soft key from the top left,
 *  contact shadows under everything (no floating particles, no gradients: BRIEF.md quality laws) */
export const Studio: React.FC<{ children?: React.ReactNode; fog?: [number, number]; shadowScale?: number; shadowY?: number; desat?: number }> = ({ children, fog = [7, 26], shadowScale = 16, shadowY = 0.002, desat = 0 }) => {
  const bg = React.useMemo(() => new THREE.Color(PAL.cream).lerp(new THREE.Color("#E9E7E1"), desat), [desat]);
  return (
    <>
      <color attach="background" args={[bg]} />
      <fog attach="fog" args={[bg, fog[0], fog[1]]} />
      <EnvMap />
      <ambientLight intensity={0.16} />
      <hemisphereLight args={["#FFFFFF", "#E2D3BE", 0.38]} />
      <directionalLight position={[-4.5, 7, 5]} intensity={1.65} color="#FFF6E6" />
      <directionalLight position={[5, 3, -5]} intensity={0.45} color={PAL.lavender} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[120, 120]} />
        <meshBasicMaterial color={bg} />
      </mesh>
      <ContactShadows position={[0, shadowY, 0]} scale={shadowScale} resolution={1024} blur={2.4} far={3.2} opacity={0.42} color="#2E2440" frames={Infinity} />
      {children}
    </>
  );
};

// ── extruded 3D type (Plus Jakarta Sans ExtraBold via styles/tools/s3_typeface.py) ──
export const FONT3D = new FontLoader().parse(jakarta800 as unknown as Parameters<FontLoader["parse"]>[0]);
const glyphAdv = (ch: string, size: number) => {
  const g = (FONT3D.data.glyphs as Record<string, { ha: number }>)[ch];
  return ((g?.ha ?? 600) / FONT3D.data.resolution) * size;
};
/** per-letter layout of a word: x centre of each letter (word centred on 0) */
export const layoutWord = (text: string, size: number, tracking = 0.02) => {
  const adv = text.split("").map((ch) => glyphAdv(ch, size) + tracking * size);
  const total = adv.reduce((a, b) => a + b, 0) - tracking * size;
  let x = -total / 2;
  return text.split("").map((ch, i) => {
    const cx = x + adv[i] / 2;
    x += adv[i];
    return { ch, x: cx, w: adv[i] };
  });
};
const geoCache = new Map<string, THREE.BufferGeometry>();
export const letterGeo = (ch: string, size: number, depth: number, bevel: number) => {
  const key = `${ch}|${size}|${depth}|${bevel}`;
  let g = geoCache.get(key);
  if (!g) {
    g = new TextGeometry(ch, { font: FONT3D, size, depth, curveSegments: 8, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.7, bevelSegments: 3 });
    g.computeBoundingBox();
    const b = g.boundingBox!;
    g.translate(-(b.min.x + b.max.x) / 2, 0, -depth / 2);
    g.computeVertexNormals();
    geoCache.set(key, g);
  }
  return g;
};
/** a whole word as one extruded mesh (face material + side material), centred on x, baseline at y 0 */
export const Word3D: React.FC<{ text: string; size: number; depth?: number; bevel?: number; face: THREE.Material; side: THREE.Material; tracking?: number }> = ({ text, size, depth = size * 0.28, bevel = size * 0.03, face, side, tracking = 0.02 }) => {
  const L = React.useMemo(() => layoutWord(text, size, tracking), [text, size, tracking]);
  return (
    <group>
      {L.map((l, i) => (l.ch === " " ? null : <mesh key={i} position={[l.x, 0, 0]} geometry={letterGeo(l.ch, size, depth, bevel)} material={[face, side]} />))}
    </group>
  );
};

/** an ink shockwave ring (flat, facing +z) expanding from the speaker on a beat */
export const Shock: React.FC<{ t: number; t0: number; pos: [number, number, number]; r0?: number; r1?: number; dur?: number; color?: string; rot?: [number, number, number] }> = ({ t, t0, pos, r0 = 0.45, r1 = 2.4, dur = 0.42, color = PAL.ink, rot = [0, 0, 0] }) => {
  const k = (t - t0) / dur;
  if (k < 0 || k > 1) return null;
  const r = r0 + (r1 - r0) * (1 - Math.pow(1 - k, 2.4));
  const w = 0.035 * (1 - k * 0.7);
  return (
    <mesh position={pos} rotation={rot}>
      <ringGeometry args={[r - w, r, 96]} />
      <meshBasicMaterial color={color} transparent opacity={(1 - k) * 0.85} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  );
};
