import React from "react";
import * as THREE from "three";
import { V3, rand, roundedSlab } from "./lib";
import { Path, floatIdle, tumble } from "./motion";

// Style 3 procedural props for the moves the refs keep using. Every animated prop takes `s` = WORLD time (a clock),
// never the output time, so speed ramps / slow-mo / bullet time / hyperlapse apply to it for free.
// Recipes and when to use which: .claude/skills/style-3/references/assets.md

/** depth field of soft toy blocks: gives a camera move real parallax (near/mid/far layers). */
export const Blocks: React.FC<{ n?: number; seed?: number; box?: [V3, V3]; colors?: string[]; size?: [number, number]; s?: number }> = ({
  n = 60, seed = 3, box = [[-4, -1.5, -8], [4, 2.5, 2]], colors = ["#F6C9D8", "#C9B6F5", "#FFD9B0", "#BFEBDD", "#FFFFFF"], size = [0.18, 0.6], s = 0 }) => {
  const geo = React.useMemo(() => roundedSlab(1, 1, 1, 0.12), []);
  const mats = React.useMemo(() => colors.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, metalness: 0 })), [colors]);
  const items = React.useMemo(() => Array.from({ length: n }, (_, i) => {
    const k = seed * 1000 + i * 7;
    const p: V3 = [0, 1, 2].map((a) => box[0][a] + rand(k + a) * (box[1][a] - box[0][a])) as V3;
    const sz = size[0] + rand(k + 4) * (size[1] - size[0]);
    return { p, sz: [sz * (0.6 + rand(k + 5)), sz * (0.6 + rand(k + 6)), sz * (0.4 + rand(k + 8) * 0.6)] as V3, m: i % mats.length, k };
  }), [n, seed, box, size, mats.length]);
  return (
    <group>
      {items.map((it, i) => {
        const f = floatIdle(s, it.k, 0.03);
        return <mesh key={i} geometry={geo} material={mats[it.m]} position={[it.p[0] + f[0], it.p[1] + f[1], it.p[2] + f[2]]} scale={it.sz} rotation={[rand(it.k + 9) * 0.6 + s * 0.05 * (rand(it.k + 10) - 0.5), rand(it.k + 11) * 3, rand(it.k + 12) * 0.4]} />;
      })}
    </group>
  );
};

/** floating / falling debris (feathers, paper scraps, confetti, leaves): instanced, tumbling on the world clock. */
export const Debris: React.FC<{ n?: number; seed?: number; box?: [V3, V3]; color?: string; size?: [number, number]; s: number; fall?: number; spin?: number; shape?: "feather" | "paper" | "confetti" }> = ({
  n = 80, seed = 5, box = [[-3, -2, -4], [3, 3, 1.5]], color = "#F4EFE6", size = [0.04, 0.12], s, fall = 0.25, spin = 0.8, shape = "paper" }) => {
  const ref = React.useRef<THREE.InstancedMesh>(null);
  const geo = React.useMemo(() => {
    if (shape === "feather") {
      const g = new THREE.PlaneGeometry(0.35, 1, 1, 6);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const y = p.getY(i) + 0.5;
        p.setX(i, p.getX(i) * Math.sin(Math.PI * Math.min(1, y * 1.1)) * (1 - y * 0.3));
        p.setZ(i, 0.08 * Math.sin(y * Math.PI));
      }
      g.computeVertexNormals();
      return g;
    }
    return shape === "confetti" ? new THREE.PlaneGeometry(0.5, 1) : new THREE.PlaneGeometry(1, 0.75);
  }, [shape]);
  const mat = React.useMemo(() => new THREE.MeshStandardMaterial({ color, roughness: 0.7, side: THREE.DoubleSide }), [color]);
  const span = box[1][1] - box[0][1];
  React.useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    for (let i = 0; i < n; i++) {
      const k = seed * 1000 + i * 13;
      const x = box[0][0] + rand(k) * (box[1][0] - box[0][0]);
      const z = box[0][2] + rand(k + 2) * (box[1][2] - box[0][2]);
      const y0 = box[0][1] + rand(k + 1) * span;
      const y = box[0][1] + ((((y0 - box[0][1] - s * fall * (0.6 + rand(k + 3) * 0.8)) % span) + span) % span);
      const sway = 0.15 * Math.sin(s * 1.3 + k);
      o.position.set(x + sway, y, z + 0.08 * Math.cos(s * 0.9 + k));
      const r = tumble(s, k, spin);
      o.rotation.set(r[0], r[1], r[2]);
      const sc = size[0] + rand(k + 6) * (size[1] - size[0]);
      o.scale.set(sc, sc, sc);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[geo, mat, n]} frustumCulled={false} />;
};

/** a ribbon / light-painting stroke along a path that draws on (from 0 to `draw`), optional emissive core. */
export const Ribbon: React.FC<{ path: Path; draw: number; tail?: number; width?: number; color?: string; glow?: number; flat?: boolean; twist?: number }> = ({
  path, draw, tail = 1, width = 0.08, color = "#E0283C", glow = 0, flat = true, twist = 2 }) => {
  const geo = React.useMemo(() => {
    const N = 240, pos: number[] = [], uv: number[] = [], idx: number[] = [];
    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const p = new THREE.Vector3(...path(u));
      const tg = new THREE.Vector3(...path.tangent(u));
      const side = new THREE.Vector3().crossVectors(tg, up).normalize();
      if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
      side.applyAxisAngle(tg, u * Math.PI * twist);
      const w = flat ? width : width * 0.5;
      pos.push(p.x + side.x * w, p.y + side.y * w, p.z + side.z * w, p.x - side.x * w, p.y - side.y * w, p.z - side.z * w);
      uv.push(u, 0, u, 1);
      if (i < N) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }, [path, width, flat, twist]);
  const mat = React.useMemo(() => new THREE.ShaderMaterial({
    side: THREE.DoubleSide, transparent: true, toneMapped: false,
    uniforms: { draw: { value: 0 }, tail: { value: 1 }, col: { value: new THREE.Color(color) }, glow: { value: glow } },
    vertexShader: "varying vec2 vUv; varying vec3 vN; void main(){ vUv = uv; vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: `uniform float draw; uniform float tail; uniform vec3 col; uniform float glow; varying vec2 vUv; varying vec3 vN;
      void main(){ if (vUv.x > draw || vUv.x < draw - tail) discard;
        float edge = 1.0 - abs(vUv.y - 0.5) * 2.0; float lam = 0.55 + 0.45 * abs(vN.z);
        vec3 c = col * lam + glow * vec3(1.0, 0.95, 0.85) * pow(edge, 3.0) * 3.0;
        float a = glow > 0.0 ? smoothstep(0.0, 0.35, edge) : 1.0;
        gl_FragColor = vec4(c, a); }`,
  }), [color, glow]);
  mat.uniforms.draw.value = draw;
  mat.uniforms.tail.value = tail;
  return <mesh geometry={geo} material={mat} frustumCulled={false} />;
};

/** flowing fabric (ref C's red cloth): a plane bent by travelling waves on the world clock, soft sheen. */
export const Fabric: React.FC<{ s: number; w?: number; h?: number; color?: string; amp?: number; speed?: number; position?: V3; rotation?: V3 }> = ({
  s, w = 3, h = 1.2, color = "#9E1F24", amp = 0.35, speed = 1, position = [0, 0, 0], rotation = [0, 0, 0] }) => {
  const geo = React.useMemo(() => new THREE.PlaneGeometry(w, h, 96, 32), [w, h]);
  const mat = React.useMemo(() => new THREE.ShaderMaterial({
    side: THREE.DoubleSide, toneMapped: false,
    uniforms: { s: { value: 0 }, amp: { value: amp }, col: { value: new THREE.Color(color) } },
    vertexShader: `uniform float s; uniform float amp; varying vec3 vN; varying vec2 vUv;
      vec3 disp(vec2 p){ float x = p.x, y = p.y;
        float z = amp * (sin(x * 1.7 - s * 2.1) * 0.6 + sin(x * 3.1 + y * 2.0 - s * 2.9) * 0.3 + sin(y * 4.0 - s * 1.3) * 0.15);
        return vec3(x + 0.08 * sin(y * 2.0 + s), y + 0.12 * sin(x * 1.3 - s * 1.7), z); }
      void main(){ vUv = uv; vec3 p = disp(position.xy);
        vec3 px = disp(position.xy + vec2(0.01, 0.0)) - p, py = disp(position.xy + vec2(0.0, 0.01)) - p;
        vN = normalize(normalMatrix * cross(px, py)); gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
    fragmentShader: `uniform vec3 col; varying vec3 vN; varying vec2 vUv;
      void main(){ float l = abs(dot(vN, normalize(vec3(-0.4, 0.6, 0.7)))); float sheen = pow(1.0 - abs(vN.z), 2.0);
        vec3 c = col * (0.25 + 0.9 * l) + vec3(1.0, 0.6, 0.5) * sheen * 0.25;
        float a = smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x); gl_FragColor = vec4(c * a, 1.0); }`,
  }), [amp, color]);
  mat.uniforms.s.value = s * speed;
  return <mesh geometry={geo} material={mat} position={position} rotation={rotation} />;
};

/** glass shards: thin random convex slivers with a bright fresnel edge (ref C's shatter), bursting on the world clock. */
export const Shards: React.FC<{ n?: number; seed?: number; s: number; origin?: V3; speed?: number; tint?: string }> = ({ n = 40, seed = 9, s, origin = [0, 0, 0], speed = 1.2, tint = "#DDE6E8" }) => {
  const geos = React.useMemo(() => Array.from({ length: 6 }, (_, j) => {
    const sh = new THREE.Shape();
    const k = seed * 100 + j * 17;
    const pts = Array.from({ length: 5 }, (_, i) => {
      const a = (i / 5) * Math.PI * 2 + rand(k + i) * 0.9;
      const r = 0.4 + rand(k + i + 9) * 0.6;
      return new THREE.Vector2(Math.cos(a) * r * 0.45, Math.sin(a) * r);
    });
    sh.setFromPoints(pts);
    return new THREE.ExtrudeGeometry(sh, { depth: 0.02, bevelEnabled: false });
  }), [seed]);
  const mat = React.useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
    uniforms: { tint: { value: new THREE.Color(tint) } },
    vertexShader: "varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }",
    fragmentShader: "uniform vec3 tint; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 3.0); gl_FragColor = vec4(tint * (0.25 + 2.2 * f), 0.18 + 0.75 * f); }",
  }), [tint]);
  return (
    <group position={origin}>
      {Array.from({ length: n }, (_, i) => {
        const k = seed * 1000 + i * 31;
        const d = new THREE.Vector3(rand(k) - 0.5, rand(k + 1) - 0.5, rand(k + 2) * 0.8).normalize();
        const dist = speed * (0.3 + rand(k + 3)) * (1 - Math.exp(-s * 2.2)) / 2.2 * 3;
        const r = tumble(s, k, 1.6);
        const sc = 0.08 + rand(k + 4) * 0.22;
        return <mesh key={i} geometry={geos[i % geos.length]} material={mat} position={[d.x * dist, d.y * dist, d.z * dist]} rotation={r} scale={sc} />;
      })}
    </group>
  );
};
