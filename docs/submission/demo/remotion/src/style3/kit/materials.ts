import React from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

// Style 3 materials (skill style-3-build §4): one shared env map for reflections and a few presets that read as
// premium on this renderer. Everything is matte toy plastic by default; a film gets ONE accent material (its hand's
// material card). Materials from `mat()` are cached per (kind, colour) and shared; never dispose them.

export type MatKind = "matte" | "satin" | "gloss" | "candy" | "chrome" | "brushed" | "glass" | "paper" | "velvet" | "neon" | "screen";

const cache = new Map<string, THREE.Material>();
/** a shared material preset. `neon`/`screen` are unlit emitters (bloom them with the post); `envBoost` metals keep
 *  their own env map when the scene env is lowered for the matte parts (see useEnv). */
export const mat = (kind: MatKind, color = "#FFFFFF", o: { emissive?: number; envBoost?: number; opacity?: number } = {}) => {
  const key = `${kind}|${color}|${o.emissive ?? ""}|${o.envBoost ?? ""}|${o.opacity ?? ""}`;
  let m = cache.get(key);
  if (m) return m;
  const c = new THREE.Color(color);
  switch (kind) {
    case "matte": m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, metalness: 0 }); break;
    case "satin": m = new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.35, metalness: 0, clearcoat: 0.3, clearcoatRoughness: 0.4 }); break;
    case "gloss": m = new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.18, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.1 }); break;
    case "candy": m = new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.12, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06, sheen: 0.4, sheenColor: new THREE.Color("#FFFFFF"), userData: { envBoost: o.envBoost ?? 1.1 } }); break;
    case "chrome": m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.08, metalness: 1, userData: { envBoost: o.envBoost ?? 1.3 } }); break;
    case "brushed": m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.32, metalness: 0.9, userData: { envBoost: o.envBoost ?? 1.1 } }); break;
    case "glass": m = new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.08, metalness: 0, transmission: 0.92, thickness: 0.04, ior: 1.45, transparent: true, opacity: o.opacity ?? 1, userData: { envBoost: o.envBoost ?? 1 } }); break;
    case "paper": m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.92, metalness: 0, emissive: c, emissiveIntensity: o.emissive ?? 0.22 }); break;
    case "velvet": m = new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.85, metalness: 0, sheen: 1, sheenRoughness: 0.55, sheenColor: c.clone().lerp(new THREE.Color("#FFFFFF"), 0.35) }); break;
    case "neon": m = new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(o.emissive ?? 2.6), toneMapped: false }); break;
    case "screen": m = new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(o.emissive ?? 1.25), toneMapped: false }); break;
  }
  cache.set(key, m);
  return m;
};

/** a warm brand colour reads darker under a soft key: give it a little self-light (style-3-build §4) */
export const warmMatte = (color: string, lift = 0.2) => {
  const key = `warm|${color}|${lift}`;
  let m = cache.get(key);
  if (!m) {
    const c = new THREE.Color(color);
    m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, emissive: c, emissiveIntensity: lift });
    cache.set(key, m);
  }
  return m;
};

/**
 * The scene's reflections without an HDRI: three's RoomEnvironment through PMREM, once per GL context. Matte parts
 * see it at `intensity` (keep ~0.45 so pastel plastic does not wash white); materials tagged `userData.envBoost`
 * (candy, chrome, brushed, glass) get it as their own envMap at their own intensity, so lowering the scene env for
 * the matte parts never turns the metals black (ce3-03).
 */
export const useEnv = (intensity = 0.45) => {
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
  return env;
};

/** mounts useEnv as a component (drop it inside any scene) */
export const Env: React.FC<{ intensity?: number }> = ({ intensity }) => {
  useEnv(intensity);
  return null;
};
