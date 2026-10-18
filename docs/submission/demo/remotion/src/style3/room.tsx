import React from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { Bake, E, FONT, FlowKey3, RoomAssets, V3, drift, flow3, fovFromLens, kf, pr, rand, roundRect, roundedPlane, useCanvasTex } from "./lib";
import { Cursor } from "./kit/props";
import { GlassPanel } from "./kit/glass";

// Shot 1 (0–2.9 s): the baked desk room. Blender coords (x, y, z) → three (x, z, -y).
export const MON = { x: 0.02, y: 1.171, z: 0.1832, w: 0.558, h: 0.313 };

// ── camera path (measured on the ref: monitor width 24 % → 25.5 % → jump 30 % → 40 % → rush in) ──
// one flowing curve per take (flow3: no stop at interior keys); the jump at 1.33 is a cut
const CAM: FlowKey3[] = [
  [0.0, [0.0, 1.15, 3.62]],
  [1.32, [0.0, 1.15, 3.36]],
  [1.33, [0.01, 1.1, 2.78], "cut"],
  [2.33, [0.02, 1.11, 2.42]], // ref: monitor 30 % wide at 1.5 s, only 35 % by 2.58 s
  // then a white bloom with the room still around it at 2.75 and into the screen by 2.95 (accelerating: cut on motion)
  [2.62, [0.02, 1.13, 2.3]],
  [2.8, [0.02, 1.15, 1.6]],
  [2.95, [0.02, 1.17, 0.42]],
];
const LOOK: FlowKey3[] = [
  [0.0, [0.0, 1.15, 0]],
  [1.32, [0.0, 1.15, 0]],
  [1.33, [0.02, 1.13, 0], "cut"],
  [2.33, [0.02, 1.14, 0]],
  [2.95, [0.02, 1.17, 0]],
];
export const roomCam = (t: number) => {
  const p = flow3(t, CAM);
  const l = flow3(t, LOOK);
  // hand-held float layered on top: never fully still
  p[0] += drift(t, 1, 0.012);
  p[1] += drift(t, 2, 0.006);
  return { pos: p, look: l, fov: fovFromLens(t < 1.33 ? 50 : 46) };
};

const CameraRig: React.FC<{ t: number }> = ({ t }) => {
  const { camera } = useThree();
  useFrame(() => {
    const c = roomCam(t);
    const cam = camera as THREE.PerspectiveCamera;
    cam.position.set(...c.pos);
    cam.lookAt(...c.look);
    cam.fov = c.fov;
    cam.near = 0.05;
    cam.far = 40;
    cam.updateProjectionMatrix();
  }, -1);
  return null;
};

// ── the monitor screen: a slow vortex of ~70 product thumbnails, traffic lights, dock ──
export const Screen: React.FC<{ t: number }> = ({ t }) => {
  const tex = useCanvasTex(
    1116,
    626,
    (c, w, h) => {
      c.globalAlpha = 1;
      c.fillStyle = "#F3F0F5";
      c.fillRect(0, 0, w, h);
      const cx = w * 0.46, cy = h * 0.47;
      const N = 72;
      c.globalAlpha = 1 - pr(t, 2.45, 2.72); // the card ring washes out as the camera rushes in
      for (let i = 0; i < N; i++) {
        const k = i / N;
        // two interleaved loops of a "?" ring, turning slowly
        const a = k * Math.PI * 2 * 1.6 + t * 0.5 + rand(i) * 0.3;
        const r = (0.12 + 0.3 * k + rand(i + 9) * 0.07) * h;
        const x = cx + Math.cos(a) * r * 1.25;
        const y = cy + Math.sin(a) * r * 0.95;
        const s = 0.85 + rand(i + 3) * 0.7;
        const cw = 62 * s, ch = 46 * s;
        c.save();
        c.translate(x, y);
        c.rotate((rand(i + 5) - 0.5) * 0.5 + Math.sin(t + i) * 0.05);
        c.fillStyle = "#FFFFFF";
        c.shadowColor = "rgba(40,20,40,0.25)";
        c.shadowBlur = 6;
        c.shadowOffsetY = 2;
        c.fillRect(-cw / 2 - 3, -ch / 2 - 3, cw + 6, ch + 8);
        c.shadowColor = "transparent";
        const pink = rand(i + 11) > 0.82;
        c.fillStyle = pink ? "#B23A73" : "#2B2830";
        c.fillRect(-cw / 2, -ch / 2, cw, ch);
        if (pink) {
          c.fillStyle = "#F6B1CF";
          c.fillRect(-cw / 2 + cw * 0.15, -ch / 2 + ch * 0.2, cw * 0.4, ch * 0.5);
        }
        c.restore();
      }
      // traffic lights
      ["#53C96B", "#F1C24D", "#EE5A70"].forEach((col, i) => {
        c.fillStyle = col;
        c.beginPath();
        c.arc(w * 0.79 + i * 26, h * 0.17, 9, 0, Math.PI * 2);
        c.fill();
      });
      // dock
      c.fillStyle = "rgba(60,58,70,0.85)";
      roundRect(c, w * 0.32, h * 0.88, w * 0.38, 34, 10);
      c.fill();
      for (let i = 0; i < 14; i++) {
        c.fillStyle = ["#7AA7FF", "#F2F2F2", "#9BE0B0", "#F7A3C2", "#FFD36B", "#B9A2FF"][i % 6];
        roundRect(c, w * 0.33 + i * 29, h * 0.88 + 6, 22, 22, 6);
        c.fill();
      }
    },
    [Math.round(t * 24)],
  );
  return (
    <mesh position={[MON.x, MON.y, MON.z]}>
      <planeGeometry args={[MON.w, MON.h]} />
      <meshBasicMaterial map={tex} color={new THREE.Color(1.9, 1.9, 1.9)} toneMapped={false} />
    </mesh>
  );
};

// the paper-plane cursor lives in the kit (re-exported for older imports)
export { Cursor, planeGeo } from "./kit/props";
const CUR: FlowKey3[] = [
  [0.1, [-0.62, 1.2, 0.55]],
  [0.5, [-0.48, 1.24, 0.5]],
  [0.85, [-0.32, 1.12, 0.45]],
  [1.2, [-0.05, 1.16, 0.4]],
  [1.32, [0.0, 1.16, 0.4]],
  [1.33, [-0.5, 1.42, 0.7], "cut"],
  [1.5, [-0.16, 1.09, 0.48]],
  [2.3, [0.06, 1.085, 0.48]],
  [2.6, [0.55, 0.98, 0.9]],
];
const curRot = (t: number): V3 => [0.35 + drift(t, 4, 0.15), -0.5 + drift(t, 5, 0.2), 2.5 + drift(t, 6, 0.25)];

// ── frosted search pill in front of the monitor: "isn't searching|" then "It's|" ──
const Pill: React.FC<{ t: number }> = ({ t }) => {
  const typed = "isn't searching";
  const n = Math.round(pr(t, 1.38, 1.66, (x) => x) * typed.length);
  const caret = Math.floor(t * 3.2) % 2 === 0;
  // the ref keeps "isn't searching|" in the pill to the cut; "It's" types in the DOM bloom over the room (type.tsx)
  const ghost = 0;
  const its = "";
  const tex = useCanvasTex(
    1200,
    170,
    (c, w, h) => {
      c.clearRect(0, 0, w, h); // the pill body is frosted glass (GlassPanel): only the icon and the type are printed
      // search icon
      c.strokeStyle = "rgba(255,255,255,0.8)";
      c.lineWidth = 5;
      c.beginPath();
      c.arc(70, h / 2 - 4, 16, 0, Math.PI * 2);
      c.stroke();
      c.beginPath();
      c.moveTo(82, h / 2 + 8);
      c.lineTo(94, h / 2 + 20);
      c.stroke();
      c.font = `500 66px ${FONT.ui}`;
      c.textBaseline = "middle";
      c.fillStyle = `rgba(255,255,255,${1 - ghost})`;
      c.shadowColor = "rgba(80,40,70,0.35)";
      c.shadowBlur = 8;
      const s = typed.slice(0, n);
      c.fillText(s + (caret && !its && t < 2.45 ? "|" : ""), 130, h / 2 + 2);
      if (its) {
        c.font = `700 64px ${FONT.sans}`;
        c.fillStyle = "#E0337F";
        c.textAlign = "center";
        c.fillText(its + (caret ? "|" : ""), w / 2, h / 2 + 2);
      }
    },
    [Math.round(t * 24)],
  );
  const appear = pr(t, 1.33, 1.46, E.back);
  if (t < 1.33) return null;
  // ref 1.33–1.45: the pill pops in violet and settles to a mauve frost; the monitor blurs through it
  const purple = 1 - pr(t, 1.33, 1.45);
  return (
    <GlassPanel w={0.44} h={0.0623} depth={0.008} radius={0.031} position={[0.06, 1.2, 0.5]} scale={[(0.55 + 0.45 * appear) * 1.55, (0.7 + 0.3 * appear) * 1.55, 1]}
      frost={0.62} tint={purple > 0.5 ? "#7A5CC8" : "#9A5C70"} tintStrength={0.6} milk={0.38} milkColor={purple > 0.5 ? "#8C6AD0" : "#A87084"} edge={1.2} glow={0.1} face={tex} />
  );
};

// ── room: baked surfaces unlit, small props lit live ──
/** Dressing per shot (film crews "cheat" props for each angle): move/scale the baked set's top-level objects whose
 * name is `key` or starts with `key_` (e.g. "spk_l" moves the cabinet, face, rings and drivers). [dx, dy, dz, scale?] */
export type Dress = Record<string, [number, number, number, number?]>;
export const Room: React.FC<{ room: RoomAssets; dress?: Dress }> = ({ room, dress }) => {
  const obj = React.useMemo(() => {
    const s = room.scene.clone(true);
    s.userData.bridge = "set"; // the Blender bridge rebuilds the set from its own script
    const baked = new Map<string, Bake>();
    room.bakes.forEach((t, n) => baked.set(THREE.PropertyBinding.sanitizeNodeName(n), t));
    s.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const key = baked.has(m.name) ? m.name : baked.has(m.parent?.name ?? "") ? m.parent!.name : null;
      if (key) {
        const b = baked.get(key)!;
        // colour x light: three's basic material scales the light map by 1/π, so hand it π
        m.material = new THREE.MeshBasicMaterial({ map: b.col, lightMap: b.light, lightMapIntensity: Math.PI, toneMapped: false });
      } else if (m.name === "screen" || m.parent?.name === "screen") {
        m.visible = false;
      } else {
        const old = m.material as THREE.MeshStandardMaterial;
        m.material = new THREE.MeshStandardMaterial({ color: old.color, roughness: Math.max(0.5, old.roughness), metalness: 0 });
      }
    });
    return s;
  }, [room]);
  // the clone's materials are per mount: dispose them on unmount (textures are shared and stay)
  React.useEffect(
    () => () =>
      obj.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.Material | undefined;
        if (m && (o as THREE.Mesh).isMesh) m.dispose();
      }),
    [obj],
  );
  const base = React.useMemo(() => new Map(obj.children.map((o) => [o, { p: o.position.clone(), s: o.scale.clone() }] as const)), [obj]);
  base.forEach((b, o) => {
    const key = dress && Object.keys(dress).find((k) => o.name === k || o.name.startsWith(k + "_"));
    const d = key ? dress![key] : undefined;
    o.position.set(b.p.x + (d?.[0] ?? 0), b.p.y + (d?.[1] ?? 0), b.p.z + (d?.[2] ?? 0));
    o.scale.copy(b.s).multiplyScalar(d?.[3] ?? 1);
  });
  const sun = room.info.sunDir;
  return (
    <>
      <primitive object={obj} />
      <hemisphereLight args={["#FFD3C2", "#B8644A", 1.6]} />
      <directionalLight position={[-sun[0] * 6, -sun[1] * 6, -sun[2] * 6]} intensity={1.2} color="#FFD6B0" />
      <pointLight position={[0.02, 1.22, 0.05]} intensity={0.9} distance={1.6} decay={2} color="#FF5A2A" />
      <pointLight position={[0.02, 1.12, 0.45]} intensity={0.35} distance={1.2} decay={2} color="#F4F1F6" />
    </>
  );
};

export const RoomShot: React.FC<{ t: number; room: RoomAssets }> = ({ t, room }) => {
  const cp = flow3(t, CUR);
  return (
    <>
      <CameraRig t={t} />
      <color attach="background" args={["#E89A84"]} />
      <Room room={room} />
      <Screen t={t} />
      <Pill t={t} />
      {t < 2.62 && <Cursor pos={cp} rot={curRot(t)} scale={t < 1.33 ? 1.5 : 1.1} />}
    </>
  );
};

/** post settings for the room shot */
export const roomPost = (t: number) => {
  const c = roomCam(t);
  const dist = Math.hypot(c.pos[0] - MON.x, c.pos[1] - MON.y, c.pos[2] - MON.z);
  return {
    focus: dist,
    aperture: kf(t, [[0, 0.55], [2.3, 0.6], [2.6, 0.3], [2.9, 0.2]]),
    bloom: kf(t, [[0, 0.14], [2.4, 0.22], [2.9, 0.5]]), // the DOM bloom carries the white; post bloom stays light (room crisp)
    threshold: kf(t, [[0, 0.8], [2.4, 0.75], [2.85, 0.3]]),
    blurDir: [0, 0] as [number, number],
    zoomBlur: kf(t, [[2.45, 0], [2.75, 0.015, E.in], [2.95, 0.0]]),
    vignette: 0.28,
    grain: 0.035,
    // ref 2.62–2.8: the screen blows out to white before the cut (only the "It's|" pill reads)
    // light only: the DOM bloom (type.tsx) whitens the centre; the ref keeps the room visible at the edges to f70
    flash: kf(t, [[2.6, 0], [2.8, 0.18, E.in], [2.95, 0.3]]),
    exposure: 1.0,
    saturation: 1.22,
    contrast: 0.28,
    ca: 0.006,
    // per-channel curves fitted on ungraded stills 6–60 (styles/tools/s3_grade.py curves, v16); the old gain/lift turned
    // the dark mat and books navy
    curves: [[0.004, 0.011, 0.017, 0.023, 0.059, 0.128, 0.178, 0.234, 0.282, 0.330, 0.364, 0.394, 0.444, 0.534, 0.672, 0.854, 0.973], [0.000, 0.000, 0.000, 0.038, 0.087, 0.109, 0.124, 0.148, 0.190, 0.301, 0.462, 0.585, 0.673, 0.726, 0.781, 0.890, 0.964], [0.008, 0.017, 0.051, 0.079, 0.098, 0.133, 0.171, 0.269, 0.405, 0.524, 0.613, 0.680, 0.735, 0.826, 0.843, 0.921, 0.969]],
  };
};
