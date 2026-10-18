import React from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { continueRender, delayRender, getInputProps } from "remotion";
import { PostParams } from "../post";

// Blender bridge, three.js side: with input prop s3Export = "http://localhost:7071" (scripts/bridge-server.mjs) every
// rendered frame posts its scene to the server: camera, lights, background/fog, and every visible mesh (world matrix,
// geometry, materials, canvas textures, draw ranges, shader uniforms). styles/tools/s3_bridge.py rebuilds the shot
// in Blender from that dump and renders it with real light (EEVEE / Cycles). Render with --concurrency=1 so mesh ids
// stay stable from frame to frame (one page). Meshes with a light map (the baked set) are skipped: the bridge builds
// the set from its own Blender script.

export const BRIDGE_URL = (getInputProps() as { s3Export?: string }).s3Export;

type Json = Record<string, unknown>;
const b64 = (a: ArrayBufferView) => {
  const u8 = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
  let s = "";
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  return btoa(s);
};
const hex = (c?: THREE.Color | null) => (c ? `#${c.getHexString()}` : null);
const seenGeo = new Map<string, number>(); // uuid → last sent position version
const seenTex = new Map<string, number>(); // uuid → last sent version

const texRef = (t: THREE.Texture | null | undefined, out: Json) => {
  if (!t) return null;
  const img = t.image as HTMLCanvasElement | HTMLImageElement | ImageBitmap | undefined;
  const key = `${t.uuid}_${t.version}`;
  if (img && seenTex.get(t.uuid) !== t.version) {
    let url: string | null = null;
    try {
      if (img instanceof HTMLCanvasElement) url = img.toDataURL("image/png");
      else {
        const c = document.createElement("canvas");
        c.width = (img as HTMLImageElement).width;
        c.height = (img as HTMLImageElement).height;
        c.getContext("2d")!.drawImage(img as CanvasImageSource, 0, 0);
        url = c.toDataURL("image/png");
      }
    } catch {
      url = null;
    }
    if (url) (out[key] = { png: url, repeat: [t.repeat.x, t.repeat.y], wrap: t.wrapS === THREE.RepeatWrapping });
    seenTex.set(t.uuid, t.version);
  }
  return key;
};

const matJson = (m: THREE.Material, texs: Json): Json => {
  const a = m as THREE.MeshPhysicalMaterial & THREE.MeshBasicMaterial;
  const j: Json = {
    type: m.type, name: m.name, side: m.side, transparent: m.transparent, opacity: m.opacity, alphaTest: m.alphaTest,
    blending: m.blending, visible: m.visible, depthWrite: m.depthWrite,
  };
  if ("color" in a && a.color) j.color = hex(a.color);
  for (const k of ["roughness", "metalness", "clearcoat", "clearcoatRoughness", "transmission", "thickness", "ior", "sheen", "sheenRoughness", "emissiveIntensity", "envMapIntensity"] as const)
    if (typeof (a as unknown as Json)[k] === "number") j[k] = (a as unknown as Json)[k];
  if (a.sheenColor) j.sheenColor = hex(a.sheenColor);
  if (a.emissive) j.emissive = hex(a.emissive);
  if (a.map) j.map = texRef(a.map, texs);
  if (a.emissiveMap) j.emissiveMap = texRef(a.emissiveMap, texs);
  if (a.alphaMap) j.alphaMap = texRef(a.alphaMap, texs);
  if (a.lightMap) j.lightMap = true;
  if ((m as THREE.ShaderMaterial).isShaderMaterial) {
    const u: Json = {};
    for (const [k, v] of Object.entries((m as THREE.ShaderMaterial).uniforms)) {
      const x = v.value;
      if (typeof x === "number" || typeof x === "boolean") u[k] = x;
      else if (x instanceof THREE.Color) u[k] = hex(x);
      else if (x instanceof THREE.Vector2 || x instanceof THREE.Vector3 || x instanceof THREE.Vector4) u[k] = x.toArray();
    }
    j.uniforms = u;
  }
  return j;
};

const geoJson = (g: THREE.BufferGeometry, full: boolean): Json => {
  const j: Json = { pos: b64(g.attributes.position.array as Float32Array) };
  if (!full) return j;
  if (g.attributes.normal) j.nor = b64(g.attributes.normal.array as Float32Array);
  if (g.attributes.uv) j.uv = b64(g.attributes.uv.array as Float32Array);
  if (g.index) j.idx = b64(new Uint32Array(g.index.array));
  j.groups = g.groups.map((x) => [x.start, x.count, x.materialIndex ?? 0]);
  return j;
};

/** mount inside the R3F scene of each shot while exporting; `post` gives focus/aperture for Blender's DOF */
export const BridgeExport: React.FC<{ shot: string; frame: number; t: number; post: PostParams }> = ({ shot, frame, t, post }) => {
  const { scene, camera } = useThree();
  const sent = React.useRef(-1);
  useFrame(() => {
    if (!BRIDGE_URL || sent.current === frame) return;
    sent.current = frame;
    const h = delayRender(`bridge ${frame}`);
    scene.updateMatrixWorld(true);
    const cam = camera as THREE.PerspectiveCamera;
    cam.updateMatrixWorld(true);
    const geos: Json = {}, mats: Json = {}, texs: Json = {};
    const meshes: Json[] = [], lights: Json[] = [];
    let baked = false;
    const walk = (o: THREE.Object3D) => {
      if (!o.visible) return;
      if (o.userData?.bridge === "set") {
        baked = true;
        return;
      }
      if (o.userData?.bridge !== "skip") visit(o);
      o.children.forEach(walk);
    };
    const visit = (o: THREE.Object3D) => {
      const L = o as THREE.Light & { target?: THREE.Object3D; groundColor?: THREE.Color };
      if (L.isLight) {
        const p = new THREE.Vector3().setFromMatrixPosition(L.matrixWorld);
        const tgt = L.target ? new THREE.Vector3().setFromMatrixPosition(L.target.matrixWorld).toArray() : null;
        lights.push({ type: L.type, color: hex(L.color), intensity: L.intensity, pos: p.toArray(), target: tgt, ground: hex(L.groundColor ?? null), shadow: L.castShadow });
        return;
      }
      const m = o as THREE.Mesh;
      if (!m.isMesh || (m as unknown as THREE.InstancedMesh).isInstancedMesh) return;
      const ml = Array.isArray(m.material) ? m.material : [m.material];
      if (ml.some((x) => (x as THREE.MeshBasicMaterial).lightMap)) {
        baked = true;
        return;
      }
      const g = m.geometry;
      const pv = (g.attributes.position as THREE.BufferAttribute | undefined)?.version ?? 0;
      if (!seenGeo.has(g.uuid)) geos[g.uuid] = geoJson(g, true);
      else if (seenGeo.get(g.uuid) !== pv) geos[g.uuid] = geoJson(g, false);
      seenGeo.set(g.uuid, pv);
      ml.forEach((x) => (mats[x.uuid] = matJson(x, texs)));
      meshes.push({
        id: m.uuid, geo: g.uuid, mats: ml.map((x) => x.uuid), m: m.matrixWorld.toArray(),
        draw: g.drawRange.count !== Infinity ? [g.drawRange.start, g.drawRange.count] : null, shadow: m.castShadow,
      });
    };
    walk(scene);
    const fog = scene.fog as THREE.Fog | null;
    const bg = scene.background instanceof THREE.Color ? hex(scene.background) : null;
    const body = JSON.stringify({
      frame, t, shot, baked, bg, fog: fog ? { color: hex(fog.color), near: fog.near, far: fog.far } : null,
      env: scene.environment ? scene.environmentIntensity : 0,
      camera: { m: cam.matrixWorld.toArray(), fov: cam.fov, near: cam.near, far: cam.far, focus: post.focus, aperture: post.aperture },
      lights, meshes, geos, mats, texs,
    });
    fetch(`${BRIDGE_URL}/frame`, { method: "POST", body, headers: { "Content-Type": "text/plain" } })
      .catch((e) => console.error("bridge post failed", e))
      .finally(() => continueRender(h));
  }, -0.5);
  return null;
};
