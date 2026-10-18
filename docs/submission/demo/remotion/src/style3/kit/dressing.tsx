import React from "react";
import * as THREE from "three";
import { V3, rand, roundedSlab, useCanvasTex } from "../lib";
import { mat } from "./materials";

// Dressing (skill style-3-build §5, law 4): the 30+ objects that make a hero world read as a place. Crowds take a seed
// and a palette and vary every instance; every hard edge is bevelled (roundedSlab); real sizes in metres. Combine
// them with bespoke hero props; never ship a frame whose objects you can count in two seconds.

const SLAB = roundedSlab(1, 1, 1, 0.04, 0.01);
const slabCache = new Map<string, THREE.BufferGeometry>();
const slab = (w: number, h: number, d: number, r = 0.06, bevel = 0.004) => {
  const k = `${w}|${h}|${d}|${r}|${bevel}`;
  let g = slabCache.get(k);
  if (!g) {
    g = roundedSlab(w, h, d, Math.min(r, Math.min(w, h, d) * 0.45), Math.min(bevel, Math.min(w, h, d) * 0.2));
    slabCache.set(k, g);
  }
  return g;
};
const Shadowed: React.FC<{ children: React.ReactNode; cast?: boolean; receive?: boolean }> = ({ children, cast = true, receive = true }) => {
  const ref = React.useRef<THREE.Group>(null);
  React.useLayoutEffect(() => {
    ref.current?.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = cast;
        o.receiveShadow = receive;
      }
    });
  });
  return <group ref={ref}>{children}</group>;
};

/** a row (dir "x") or a stack (dir "y") of n books from `at`, varied in height, thickness, tilt and colour */
export const Books: React.FC<{ at: V3; n?: number; dir?: "x" | "y"; palette?: string[]; seed?: number; size?: number; lean?: number }> = ({
  at, n = 7, dir = "x", palette = ["#B74A6C", "#4A3C8C", "#E2B04B", "#2E7D6B", "#F4EFE6", "#C2552F", "#2F3B5C"], seed = 1, size = 1, lean = 0.25 }) => {
  const items = React.useMemo(() => {
    let off = 0;
    return Array.from({ length: n }, (_, i) => {
      const k = seed * 100 + i * 3;
      const h = (0.19 + rand(k) * 0.09) * size, th = (0.018 + rand(k + 1) * 0.03) * size, w = (0.13 + rand(k + 2) * 0.04) * size;
      const o = off;
      off += th + 0.002;
      const tilt = i === n - 1 && dir === "x" ? -lean * (0.5 + rand(k + 4)) : (rand(k + 5) - 0.5) * 0.03;
      return { h, th, w, o, tilt, c: palette[(i + seed) % palette.length], page: `#${["F6F0E4", "EFE7D8", "FBF7EE"][i % 3]}` };
    });
  }, [n, dir, palette, seed, size, lean]);
  return (
    <Shadowed>
      <group position={at}>
        {items.map((b, i) =>
          dir === "x" ? (
            <group key={i} position={[b.o + b.th / 2, b.h / 2, 0]} rotation={[0, 0, b.tilt]}>
              <mesh geometry={slab(b.th, b.h, b.w, 0.004, 0.002)} material={mat("matte", b.c)} />
              <mesh geometry={slab(b.th * 0.8, b.h * 0.96, b.w * 0.94, 0.002, 0.001)} material={mat("paper", b.page)} position={[0, 0, -b.w * 0.02]} />
            </group>
          ) : (
            <group key={i} position={[(rand(seed + i * 7) - 0.5) * 0.02, b.o + b.th / 2, (rand(seed + i * 9) - 0.5) * 0.02]} rotation={[0, (rand(seed + i * 11) - 0.5) * 0.3, 0]}>
              <mesh geometry={slab(b.w, b.th, b.h, 0.004, 0.002)} material={mat("matte", b.c)} />
              <mesh geometry={slab(b.w * 0.94, b.th * 0.8, b.h * 0.96, 0.002, 0.001)} material={mat("paper", b.page)} position={[-b.w * 0.02, 0, 0]} />
            </group>
          ),
        )}
      </group>
    </Shadowed>
  );
};

/** a potted plant: lathe pot + n bent leaves fanning out (double-sided, a little translucent via emissive) */
export const Plant: React.FC<{ pos: V3; s?: number; pot?: string; leaf?: string; n?: number; seed?: number; droop?: number }> = ({ pos, s = 1, pot = "#D98C6B", leaf = "#4F9A6E", n = 11, seed = 3, droop = 0.35 }) => {
  const potGeo = React.useMemo(() => new THREE.LatheGeometry([new THREE.Vector2(0.0, 0), new THREE.Vector2(0.075, 0), new THREE.Vector2(0.085, 0.02), new THREE.Vector2(0.1, 0.14), new THREE.Vector2(0.108, 0.16), new THREE.Vector2(0.1, 0.165), new THREE.Vector2(0.09, 0.15)], 36), []);
  const leafGeo = React.useMemo(() => {
    const g = new THREE.PlaneGeometry(0.11, 0.3, 2, 8);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i) + 0.15, u = y / 0.3;
      p.setX(i, p.getX(i) * Math.sin(Math.PI * Math.min(1, u * 1.15)) * 1.1);
      p.setZ(i, -droop * u * u);
    }
    g.computeVertexNormals();
    return g;
  }, [droop]);
  const lm = React.useMemo(() => new THREE.MeshStandardMaterial({ color: leaf, roughness: 0.7, side: THREE.DoubleSide, emissive: leaf, emissiveIntensity: 0.12 }), [leaf]);
  React.useEffect(() => () => { potGeo.dispose(); leafGeo.dispose(); lm.dispose(); }, [potGeo, leafGeo, lm]);
  return (
    <Shadowed>
      <group position={pos} scale={s}>
        <mesh geometry={potGeo} material={mat("satin", pot)} />
        <mesh position={[0, 0.15, 0]} rotation={[-Math.PI / 2, 0, 0]} material={mat("matte", "#3A2A1E")}><circleGeometry args={[0.088, 24]} /></mesh>
        {Array.from({ length: n }, (_, i) => {
          const k = seed * 10 + i;
          const a = (i / n) * Math.PI * 2 + rand(k) * 0.6, tilt = 0.5 + rand(k + 1) * 0.6, sc = 0.7 + rand(k + 2) * 0.6;
          return <mesh key={i} geometry={leafGeo} material={lm} position={[0, 0.15, 0]} rotation={[tilt, a, 0]} scale={[sc, sc, sc]} />;
        })}
      </group>
    </Shadowed>
  );
};

/** loose sheets with a faint sketch, scattered flat in a box (a desk, a wall), slightly rotated and overlapping */
export const Papers: React.FC<{ box: [V3, V3]; n?: number; seed?: number; color?: string; ink?: string; size?: [number, number]; upright?: boolean }> = ({ box, n = 6, seed = 5, color = "#F7F2E8", ink = "#9A9AA8", size = [0.21, 0.297], upright = false }) => {
  const tex = useCanvasTex(420, 594, (c, w, h) => {
    c.fillStyle = color;
    c.fillRect(0, 0, w, h);
    c.strokeStyle = ink;
    c.lineWidth = 2;
    c.globalAlpha = 0.5;
    for (let i = 0; i < 9; i++) {
      c.beginPath();
      c.moveTo(60, 90 + i * 50);
      c.lineTo(60 + (w - 120) * (0.35 + rand(seed + i) * 0.6), 90 + i * 50);
      c.stroke();
    }
    c.strokeRect(60, 60, 130, 90);
    c.globalAlpha = 1;
  }, [color, ink, seed]);
  const m = React.useMemo(() => new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, emissive: new THREE.Color(color), emissiveIntensity: 0.15, side: THREE.DoubleSide }), [tex, color]);
  React.useEffect(() => () => m.dispose(), [m]);
  return (
    <Shadowed receive={false}>
      <group>
        {Array.from({ length: n }, (_, i) => {
          const k = seed * 100 + i * 4;
          const p: V3 = [0, 1, 2].map((a) => box[0][a] + rand(k + a) * (box[1][a] - box[0][a])) as V3;
          const rot: V3 = upright ? [0, (rand(k + 3) - 0.5) * 0.2, (rand(k + 4) - 0.5) * 0.12] : [-Math.PI / 2, 0, (rand(k + 3) - 0.5) * 0.9];
          return (
            <mesh key={i} material={m} position={[p[0], p[1] + i * 0.0008, p[2]]} rotation={rot}>
              <planeGeometry args={size} />
            </mesh>
          );
        })}
      </group>
    </Shadowed>
  );
};

/** a sagging cable between two points (tube along a curve) */
export const Cable: React.FC<{ from: V3; to: V3; sag?: number; r?: number; color?: string }> = ({ from, to, sag = 0.12, r = 0.004, color = "#2A2A30" }) => {
  const geo = React.useMemo(() => {
    const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to);
    const mid = a.clone().lerp(b, 0.5).add(new THREE.Vector3(0, -sag, 0));
    const q1 = a.clone().lerp(b, 0.25).add(new THREE.Vector3(0, -sag * 0.75, 0)), q3 = a.clone().lerp(b, 0.75).add(new THREE.Vector3(0, -sag * 0.75, 0));
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3([a, q1, mid, q3, b]), 32, r, 8, false);
  }, [from, to, sag, r]);
  React.useEffect(() => () => geo.dispose(), [geo]);
  return <mesh geometry={geo} material={mat("satin", color)} castShadow />;
};

/** a ceramic mug (lathe + handle) */
export const Mug: React.FC<{ pos: V3; color?: string; s?: number; rot?: number }> = ({ pos, color = "#E8DCCB", s = 1, rot = 0 }) => {
  const g = React.useMemo(() => ({
    body: new THREE.LatheGeometry([new THREE.Vector2(0, 0), new THREE.Vector2(0.038, 0), new THREE.Vector2(0.042, 0.006), new THREE.Vector2(0.044, 0.09), new THREE.Vector2(0.04, 0.095), new THREE.Vector2(0.036, 0.09), new THREE.Vector2(0.034, 0.012), new THREE.Vector2(0, 0.012)], 36),
    handle: new THREE.TorusGeometry(0.026, 0.0065, 12, 24, Math.PI),
  }), []);
  React.useEffect(() => () => { g.body.dispose(); g.handle.dispose(); }, [g]);
  return (
    <Shadowed>
      <group position={pos} scale={s} rotation={[0, rot, 0]}>
        <mesh geometry={g.body} material={mat("gloss", color)} />
        <mesh geometry={g.handle} material={mat("gloss", color)} position={[0.044, 0.05, 0]} rotation={[0, 0, -Math.PI / 2]} />
        <mesh position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]} material={mat("satin", "#3E2418")}><circleGeometry args={[0.034, 24]} /></mesh>
      </group>
    </Shadowed>
  );
};

/** framed pictures on a wall (frame slab + an abstract print painted from the palette) */
export const Frames: React.FC<{ at: V3; n?: number; gap?: number; palette?: string[]; frame?: string; seed?: number; sizes?: [number, number][] }> = ({ at, n = 3, gap = 0.08, palette = ["#F2B5C8", "#C9B6F5", "#FFD9B0", "#2F3B5C"], frame = "#F4EFE6", seed = 2, sizes }) => {
  const prints = useCanvasTex(512, 512 * n, (c, w) => {
    for (let i = 0; i < n; i++) {
      const y0 = i * 512;
      c.fillStyle = palette[(i + seed) % palette.length];
      c.fillRect(0, y0, w, 512);
      for (let b = 0; b < 4; b++) {
        const k = seed * 50 + i * 9 + b * 3;
        const g = c.createRadialGradient(rand(k) * w, y0 + rand(k + 1) * 512, 0, rand(k) * w, y0 + rand(k + 1) * 512, 120 + rand(k + 2) * 220);
        g.addColorStop(0, palette[(i + b + 1 + seed) % palette.length]);
        g.addColorStop(1, "rgba(255,255,255,0)");
        c.fillStyle = g;
        c.fillRect(0, y0, w, 512);
      }
    }
  }, [n, palette, seed]);
  const items = React.useMemo(() => {
    let x = 0;
    return Array.from({ length: n }, (_, i) => {
      const [w, h] = sizes?.[i] ?? [0.28 + rand(seed + i) * 0.14, 0.32 + rand(seed + i + 1) * 0.16];
      const o = x;
      x += w + gap;
      return { w, h, o };
    });
  }, [n, gap, seed, sizes]);
  return (
    <Shadowed receive={false}>
      <group position={at}>
        {items.map((f, i) => (
          <group key={i} position={[f.o + f.w / 2, 0, 0]}>
            <mesh geometry={slab(f.w + 0.03, f.h + 0.03, 0.02, 0.004, 0.002)} material={mat("satin", frame)} />
            <mesh position={[0, 0, 0.011]}>
              <planeGeometry args={[f.w, f.h]} />
              <meshStandardMaterial map={prints} roughness={0.8} onUpdate={(m) => { m.map!.repeat.set(1, 1 / n); m.map!.offset.set(0, 1 - (i + 1) / n); }} />
            </mesh>
          </group>
        ))}
      </group>
    </Shadowed>
  );
};

/** a pegboard with hooks and a few hung tools (a ruler, tape, scissors stand-in, a hank of cable) */
export const Pegboard: React.FC<{ pos: V3; w?: number; h?: number; color?: string; dot?: string; seed?: number; tools?: number }> = ({ pos, w = 0.9, h = 0.6, color = "#F2C9B8", dot = "#D9A48F", seed = 4, tools = 5 }) => {
  const tex = useCanvasTex(900, 600, (c, cw, ch) => {
    c.fillStyle = color;
    c.fillRect(0, 0, cw, ch);
    c.fillStyle = dot;
    for (let y = 30; y < ch; y += 36) for (let x = 30; x < cw; x += 36) { c.beginPath(); c.arc(x, y, 5, 0, Math.PI * 2); c.fill(); }
  }, [color, dot]);
  const tm = React.useMemo(() => new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 }), [tex]);
  React.useEffect(() => () => tm.dispose(), [tm]);
  const palette = ["#2F3B5C", "#E2B04B", "#C2552F", "#4F9A6E", "#F4EFE6"];
  return (
    <Shadowed>
      <group position={pos}>
        <mesh material={tm} geometry={slab(w, h, 0.015, 0.01, 0.003)} />
        {Array.from({ length: tools }, (_, i) => {
          const k = seed * 20 + i * 5;
          const x = -w / 2 + 0.08 + ((i + 0.5) / tools) * (w - 0.16), y = h / 2 - 0.06 - rand(k) * 0.08;
          const kind = i % 3;
          return (
            <group key={i} position={[x, y, 0.012]}>
              <mesh material={mat("chrome", "#CFCFD6")} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.004, 0.004, 0.03, 8]} /></mesh>
              {kind === 0 && <mesh geometry={slab(0.03, 0.3, 0.004, 0.003, 0.001)} material={mat("satin", palette[i % 5])} position={[0, -0.16, 0.008]} rotation={[0, 0, (rand(k + 1) - 0.5) * 0.12]} />}
              {kind === 1 && <mesh material={mat("satin", palette[(i + 1) % 5])} position={[0, -0.07, 0.012]}><torusGeometry args={[0.045, 0.016, 10, 28]} /></mesh>}
              {kind === 2 && <mesh material={mat("matte", palette[(i + 2) % 5])} position={[0, -0.09, 0.01]} rotation={[0, 0, 0.3]}><capsuleGeometry args={[0.012, 0.12, 4, 10]} /></mesh>}
            </group>
          );
        })}
      </group>
    </Shadowed>
  );
};

/** a wall shelf (slab + two brackets) */
export const Shelf: React.FC<{ pos: V3; w?: number; d?: number; color?: string }> = ({ pos, w = 1.0, d = 0.22, color = "#B98556" }) => (
  <Shadowed>
    <group position={pos}>
      <mesh geometry={slab(w, 0.03, d, 0.006, 0.003)} material={mat("satin", color)} />
      {[-1, 1].map((k) => <mesh key={k} geometry={slab(0.03, 0.12, d * 0.8, 0.004, 0.002)} material={mat("matte", "#2A2A30")} position={[k * (w / 2 - 0.08), -0.075, -d * 0.05]} />)}
    </group>
  </Shadowed>
);

/** a keyboard: a slab body with instanced keycaps */
export const Keyboard: React.FC<{ pos: V3; rot?: number; body?: string; cap?: string; accent?: string; cols?: number; rows?: number }> = ({ pos, rot = 0, body = "#F3DDE4", cap = "#FFF6F8", accent = "#D9257C", cols = 14, rows = 5 }) => {
  const pitch = 0.0195, w = cols * pitch + 0.02, d = rows * pitch + 0.02;
  const capGeo = React.useMemo(() => roundedSlab(0.0165, 0.008, 0.0165, 0.003, 0.001), []);
  React.useEffect(() => () => capGeo.dispose(), [capGeo]);
  return (
    <Shadowed>
      <group position={pos} rotation={[0, rot, 0]}>
        <mesh geometry={slab(w, 0.014, d, 0.008, 0.003)} material={mat("satin", body)} position={[0, 0.007, 0]} />
        {Array.from({ length: rows * cols }, (_, i) => {
          const r = Math.floor(i / cols), c = i % cols;
          const wide = r === rows - 1 && c > 3 && c < 10;
          if (wide && c !== 4) return null;
          return <mesh key={i} geometry={capGeo} material={mat("satin", r === 0 && c === cols - 1 ? accent : cap)} position={[-w / 2 + 0.018 + c * pitch + (wide ? 0.05 : 0), 0.018, -d / 2 + 0.018 + r * pitch]} scale={[wide ? 6.5 : 1, 1, 1]} />;
        })}
      </group>
    </Shadowed>
  );
};

/** a monitor on a stand; `face` = the screen's material (mat("screen") or a canvas / video texture material) */
export const Monitor: React.FC<{ pos: V3; w?: number; rot?: number; bezel?: string; face: THREE.Material; stand?: string; glow?: number; glowColor?: string }> = ({ pos, w = 0.62, rot = 0, bezel = "#1E1E24", face, stand = "#C9C9CF", glow = 0, glowColor = "#FFFFFF" }) => {
  const h = w * 0.5625;
  return (
    <Shadowed>
      <group position={pos} rotation={[0, rot, 0]}>
        <mesh geometry={slab(w + 0.03, h + 0.03, 0.025, 0.012, 0.003)} material={mat("satin", bezel)} position={[0, h / 2 + 0.11, 0]} />
        <mesh material={face} position={[0, h / 2 + 0.11, 0.0135]}><planeGeometry args={[w, h]} /></mesh>
        {glow > 0 && <pointLight color={glowColor} intensity={glow} distance={2.2} decay={1.8} position={[0, h / 2 + 0.11, 0.12]} />}
        <mesh material={mat("brushed", stand)} position={[0, 0.055, -0.03]}><cylinderGeometry args={[0.02, 0.025, 0.11, 16]} /></mesh>
        <mesh geometry={slab(0.26, 0.012, 0.16, 0.01, 0.003)} material={mat("brushed", stand)} position={[0, 0.006, -0.02]} />
      </group>
    </Shadowed>
  );
};

/** a desk lamp with an articulated arm; the bulb is a Practical when `on` (import Practical from ./atmo in the shot) */
export const DeskLamp: React.FC<{ pos: V3; color?: string; rot?: number; tilt?: number; children?: React.ReactNode }> = ({ pos, color = "#2F3B5C", rot = 0, tilt = 0.9, children }) => {
  const shade = React.useMemo(() => new THREE.LatheGeometry([new THREE.Vector2(0.012, 0), new THREE.Vector2(0.03, 0.02), new THREE.Vector2(0.075, 0.16), new THREE.Vector2(0.07, 0.165), new THREE.Vector2(0.026, 0.03), new THREE.Vector2(0.012, 0.02)], 32), []);
  React.useEffect(() => () => shade.dispose(), [shade]);
  return (
    <Shadowed>
      <group position={pos} rotation={[0, rot, 0]}>
        <mesh material={mat("satin", color)} position={[0, 0.012, 0]}><cylinderGeometry args={[0.07, 0.08, 0.024, 32]} /></mesh>
        <mesh material={mat("brushed", "#C9C9CF")} position={[0, 0.2, 0]}><cylinderGeometry args={[0.008, 0.008, 0.36, 12]} /></mesh>
        <group position={[0, 0.38, 0]} rotation={[tilt, 0, 0]}>
          <mesh material={mat("brushed", "#C9C9CF")} position={[0, 0.12, 0]}><cylinderGeometry args={[0.007, 0.007, 0.26, 12]} /></mesh>
          <group position={[0, 0.26, 0]} rotation={[Math.PI, 0, 0]}>
            <mesh geometry={shade} material={mat("satin", color)} />
            {children}
          </group>
        </group>
      </group>
    </Shadowed>
  );
};

/** a ring light on a stand (emissive torus); light it with a Practical placed at its centre */
export const RingLight: React.FC<{ pos: V3; r?: number; color?: string; on?: number; children?: React.ReactNode }> = ({ pos, r = 0.17, color = "#FFF1DD", on = 1, children }) => {
  const m = React.useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(0.6 + on * 1.6), toneMapped: false }), [color, on]);
  React.useEffect(() => () => m.dispose(), [m]);
  return (
    <group position={pos}>
      <mesh material={m}><torusGeometry args={[r, r * 0.11, 14, 64]} /></mesh>
      <mesh material={mat("matte", "#1E1E24")} position={[0, -r - 0.35, 0]}><cylinderGeometry args={[0.012, 0.012, 0.7, 12]} /></mesh>
      <mesh material={mat("matte", "#1E1E24")} position={[0, -r - 0.7, 0]}><cylinderGeometry args={[0.16, 0.18, 0.02, 24]} /></mesh>
      {children}
    </group>
  );
};

/** venetian blinds (n slats that cast the window gobo); put them between the sun and the set */
export const Blinds: React.FC<{ pos: V3; w?: number; h?: number; n?: number; tilt?: number; color?: string; rot?: V3 }> = ({ pos, w = 1.4, h = 1.6, n = 16, tilt = 0.35, color = "#F4EFE6", rot = [0, 0, 0] }) => (
  <group position={pos} rotation={rot}>
    {Array.from({ length: n }, (_, i) => (
      <mesh key={i} material={mat("matte", color)} position={[0, h / 2 - (i + 0.5) * (h / n), 0]} rotation={[tilt, 0, 0]} castShadow>
        <boxGeometry args={[w, 0.05, 0.004]} />
      </mesh>
    ))}
    {[-1, 1].map((k) => <mesh key={k} material={mat("matte", color)} position={[k * w * 0.3, 0, 0.004]}><cylinderGeometry args={[0.002, 0.002, h, 6]} /></mesh>)}
  </group>
);

/** a string of bulbs along points (wire + emissive spheres); add 2-3 Practicals near the hero for real light */
export const Bulbs: React.FC<{ points: V3[]; n?: number; color?: string; size?: number; s?: number; emissive?: number }> = ({ points, n = 14, color = "#FFD38A", size = 0.02, s = 0, emissive = 2.2 }) => {
  const curve = React.useMemo(() => new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))), [points]);
  const wire = React.useMemo(() => new THREE.TubeGeometry(curve, 48, 0.002, 6, false), [curve]);
  const bm = React.useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(emissive), toneMapped: false }), [color, emissive]);
  React.useEffect(() => () => { wire.dispose(); bm.dispose(); }, [wire, bm]);
  return (
    <group>
      <mesh geometry={wire} material={mat("matte", "#2A2A30")} />
      {Array.from({ length: n }, (_, i) => {
        const p = curve.getPointAt((i + 0.5) / n);
        const flick = 0.92 + 0.08 * Math.sin(s * 3 + i * 1.7);
        return (
          <group key={i} position={[p.x, p.y - 0.025, p.z]}>
            <mesh material={mat("matte", "#2A2A30")} position={[0, 0.018, 0]}><cylinderGeometry args={[0.006, 0.007, 0.016, 10]} /></mesh>
            <mesh material={bm} scale={flick}><sphereGeometry args={[size, 16, 12]} /></mesh>
          </group>
        );
      })}
    </group>
  );
};

/** a night city: block silhouettes at 3 depths with instanced lit windows (emissive quads), for glass walls and rooftops */
export const CityLights: React.FC<{ origin?: V3; width?: number; depths?: number[]; blocks?: number; seed?: number; colors?: string[]; sky?: string; s?: number; density?: number }> = ({
  origin = [0, -1, -10], width = 24, depths = [0, -8, -18], blocks = 14, seed = 6, colors = ["#FFD08A", "#FFF4D6", "#9FD8FF", "#FF9FC6"], sky = "#0B1630", s = 0, density = 0.55 }) => {
  const data = React.useMemo(() => {
    const out: { p: V3; w: number; h: number; d: number; wins: { x: number; y: number; c: number; on: number }[] }[] = [];
    depths.forEach((z, di) => {
      let x = -width / 2;
      let i = 0;
      while (x < width / 2 && i < blocks * 3) {
        const k = seed * 1000 + di * 100 + i * 7;
        const w = 0.8 + rand(k) * 1.8, h = (2 + rand(k + 1) * 6) * (1 + di * 0.25), d = 0.6 + rand(k + 2);
        const wins: { x: number; y: number; c: number; on: number }[] = [];
        const nx = Math.max(2, Math.floor(w / 0.22)), ny = Math.max(3, Math.floor(h / 0.26));
        for (let a = 0; a < nx; a++) for (let b = 0; b < ny; b++) {
          const kk = k + a * 31 + b * 17;
          if (rand(kk) < density) wins.push({ x: -w / 2 + (a + 0.5) * (w / nx), y: (b + 0.5) * (h / ny), c: Math.floor(rand(kk + 1) * colors.length), on: 0.6 + rand(kk + 2) * 0.4 });
        }
        out.push({ p: [x + w / 2, 0, z], w, h, d, wins });
        x += w + 0.1 + rand(k + 3) * 0.3;
        i++;
      }
    });
    return out;
  }, [depths, width, blocks, seed, colors.length, density]);
  const winGeo = React.useMemo(() => new THREE.PlaneGeometry(0.14, 0.17), []);
  const mats = React.useMemo(() => colors.map((c) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(1.6), toneMapped: false })), [colors]);
  React.useEffect(() => () => { winGeo.dispose(); mats.forEach((m) => m.dispose()); }, [winGeo, mats]);
  const dark = mat("matte", sky);
  return (
    <group position={origin}>
      {data.map((b, i) => (
        <group key={i} position={b.p}>
          <mesh material={dark} position={[0, b.h / 2, 0]}><boxGeometry args={[b.w, b.h, b.d]} /></mesh>
          {b.wins.map((w, j) => {
            const blink = w.on * (0.85 + 0.15 * Math.sin(s * 0.5 + j));
            return <mesh key={j} geometry={winGeo} material={mats[w.c]} position={[w.x, w.y, b.d / 2 + 0.002]} scale={[blink, blink, 1]} />;
          })}
        </group>
      ))}
    </group>
  );
};

/** a glossy floor plane that receives shadows (use with Env for reflections of the practicals) */
export const Floor: React.FC<{ y?: number; size?: number; color?: string; kind?: "matte" | "satin" | "gloss" }> = ({ y = 0, size = 30, color = "#2B2730", kind = "satin" }) => (
  <mesh position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]} material={mat(kind, color)} receiveShadow>
    <planeGeometry args={[size, size]} />
  </mesh>
);

export const DRESSING_SLAB = SLAB;
