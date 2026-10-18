import React from "react";
import * as THREE from "three";
import { FONT, V3, drift, roundRect, roundedSlab } from "../lib";
import { Blocks } from "../assets3d";
import type { Layer } from "./cams";

/** the depth layers of a shot (cams.ts DEPTH): soft blocks near the lens and behind the subject, on the world clock */
export const DepthLayers: React.FC<{ layers: Layer[]; s: number }> = ({ layers, s }) => (
  <>
    {layers.map((l, i) => (
      <Blocks key={i} n={l.n} seed={l.seed} box={l.box} size={l.size} colors={l.colors} s={s} />
    ))}
  </>
);

// ce3-01 decor: an apricot fur ball (shell fur) and floating 3D caption chips ("WOW", "NO WAY", "viral").

const FUR_VERT = `
uniform float shell; varying vec2 vUv; varying vec3 vN;
void main(){ vUv = uv; vN = normalize(normalMatrix * normal);
  vec3 p = position * (1.0 + shell * 0.13);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`;
const FUR_FRAG = `
uniform float shell; uniform vec3 root; uniform vec3 tip; varying vec2 vUv; varying vec3 vN;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main(){
  vec2 g = vUv * vec2(420.0, 210.0);
  vec2 cell = floor(g); vec2 f = fract(g) - 0.5;
  float len = 0.35 + 0.65 * h(cell);
  if (shell > 0.0 && (shell > len || length(f) > 0.5 * (1.0 - shell / len) + 0.04)) discard;
  float lam = max(dot(vN, normalize(vec3(-0.45, 0.6, 0.66))), 0.0);
  float rim = pow(1.0 - max(vN.z, 0.0), 2.0);
  vec3 c = mix(root, tip, 0.25 + 0.75 * shell) * (0.3 + 0.85 * lam) + vec3(1.0, 0.8, 0.6) * rim * 0.35 * shell;
  gl_FragColor = vec4(c, 1.0);
}`;
export const FurBall: React.FC<{ pos: V3; r: number; root?: string; tip?: string }> = ({ pos, r, root = "#A9521A", tip = "#FFC27A" }) => {
  const shells = React.useMemo(() => {
    const geo = new THREE.SphereGeometry(r, 64, 48);
    return Array.from({ length: 22 }, (_, i) => ({
      geo,
      m: new THREE.ShaderMaterial({ vertexShader: FUR_VERT, fragmentShader: FUR_FRAG, uniforms: { shell: { value: i / 21 }, root: { value: new THREE.Color(root) }, tip: { value: new THREE.Color(tip) } } }),
    }));
  }, [r, root, tip]);
  return (
    <group position={pos}>
      {shells.map((s, i) => (
        <mesh key={i} geometry={s.geo} material={s.m} />
      ))}
    </group>
  );
};

const chipTex = (label: string, bg: string, fg: string, w: number, h: number, font: string) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const x = c.getContext("2d")!;
  x.fillStyle = bg;
  roundRect(x, 0, 0, w, h, h / 2);
  x.fill();
  x.font = font;
  x.fillStyle = fg;
  x.textAlign = "center";
  x.textBaseline = "middle";
  x.fillText(label, w / 2, h / 2 + 4);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
};
/** a floating rounded chip with a caption word, idle-drifting */
export const Chip: React.FC<{ t: number; label: string; pos: V3; rot?: V3; bg: string; fg: string; w?: number; seed: number; font?: "sans" | "serif" }> = ({ t, label, pos, rot = [0, 0, 0], bg, fg, w = 0.36, seed, font = "sans" }) => {
  const h = 0.12;
  const tex = React.useMemo(() => chipTex(label, bg, fg, Math.round(w * 1000), 120, font === "serif" ? `italic 76px ${FONT.serif}` : `800 58px ${FONT.sans}`), [label, bg, fg, w, font]);
  const slab = React.useMemo(() => roundedSlab(w, h, 0.03, h / 2 - 0.002), [w]);
  return (
    <group position={[pos[0] + drift(t, seed, 0.02), pos[1] + drift(t, seed + 1, 0.025), pos[2]]} rotation={[rot[0] + drift(t, seed + 2, 0.08), rot[1] + drift(t, seed + 3, 0.12), rot[2]]}>
      <mesh geometry={slab}>
        <meshStandardMaterial color={bg} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0, 0.0155]}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial map={tex} transparent toneMapped={false} />
      </mesh>
    </group>
  );
};

export const pastelBg = (c: CanvasRenderingContext2D, w: number, h: number, base: string, blobs: [number, number, number, string][]) => {
  c.fillStyle = base;
  c.fillRect(0, 0, w, h);
  for (const [x, y, r, col] of blobs) {
    const g = c.createRadialGradient(x * w, y * h, 0, x * w, y * h, r * w);
    g.addColorStop(0, col);
    g.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  }
};
