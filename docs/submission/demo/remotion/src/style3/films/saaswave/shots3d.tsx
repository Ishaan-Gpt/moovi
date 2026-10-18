import React from "react";
import * as THREE from "three";
import { RoundedBox } from "@react-three/drei";
import {
  CamSample, Cursor, E, Headphones, faceCamRot, PostParams, Ribbon, RigCamera, Room, RoomAssets, V3, clamp01, floatIdle, kf, path, pr, rand,
  rigPost, roundRect, sampledRig, spring, FONT,
} from "../../kit";
import {
  BalloonWord, ConeToy, Cup, FaceCard, FileCard, Folder, Lights, Marker, NOTES, PAL, Paper, PaperClip, PencilCup, Phone,
  SW_PATH, Scissors, Shadowed, T, TuftedChair, Umbrella, drawNote, drawSite, drawSketch, drawSticky, soft, useMat,
} from "./common";

// Ref B clone, the 3D shots. Cameras are by-eye samples on the ref's own timeline (sampledRig), so the ramps and
// whips land where the ref's do; each scene is a function of t only.

const cam = (s: [number, V3, V3, number, number][], seed: number, amp = 0.0025): ReturnType<typeof sampledRig> =>
  sampledRig(s.map(([t, pos, look, lens, roll]) => ({ t, pos, look, lens, roll }) as CamSample), { handheld: { amp, seed } });

/** a canvas texture redrawn every render (animated faces: type that pops letter by letter) */
const useLiveTex = (w: number, h: number, draw: (c: CanvasRenderingContext2D, w: number, h: number) => void) => {
  const [cv] = React.useState(() => {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return c;
  });
  const tex = React.useMemo(() => {
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  }, [cv]);
  React.useEffect(() => () => tex.dispose(), [tex]);
  const c = cv.getContext("2d")!;
  c.clearRect(0, 0, w, h);
  draw(c, w, h);
  tex.needsUpdate = true;
  return tex;
};

const flat = (rotY = 0): [number, number, number] => [-Math.PI / 2, 0, rotY]; // lay a +z-facing card flat, then turn it

// per-shot tone curves fitted to the ref (styles/tools/s3_grade.py curves on s3Ungraded stills, 2026-10-11)
const CURVES_DESK: number[][] = [[0.235, 0.270, 0.305, 0.340, 0.375, 0.404, 0.431, 0.461, 0.525, 0.542, 0.585, 0.830, 0.891, 0.940, 0.989, 1.000, 1.000], [0.000, 0.000, 0.000, 0.058, 0.110, 0.169, 0.225, 0.300, 0.321, 0.381, 0.746, 0.788, 0.817, 1.000, 1.000, 1.000, 1.000], [0.000, 0.000, 0.036, 0.113, 0.223, 0.298, 0.356, 0.430, 0.490, 0.547, 0.646, 0.683, 0.731, 0.978, 1.000, 1.000, 1.000]];
// room5 (IT'S LIVE) fit crushed the darks into magenta/green artefacts: not used
const CURVES_ROOM5_UNUSED: number[][] = [[0.000, 0.003, 0.004, 0.005, 0.006, 0.007, 0.008, 0.008, 0.008, 0.008, 0.008, 0.008, 0.054, 0.629, 0.719, 0.761, 0.977], [0.001, 0.006, 0.008, 0.010, 0.012, 0.012, 0.012, 0.012, 0.110, 0.352, 0.483, 0.613, 0.654, 0.685, 0.712, 0.747, 0.963], [0.016, 0.024, 0.027, 0.029, 0.031, 0.031, 0.031, 0.031, 0.031, 0.051, 0.509, 0.625, 0.664, 0.700, 0.734, 0.767, 0.974]];
const CURVES_MACRO: number[][] = [[0.000, 0.000, 0.000, 0.000, 0.000, 0.000, 0.000, 0.022, 0.192, 0.475, 0.547, 0.590, 0.608, 0.626, 0.646, 0.687, 0.982], [0.000, 0.000, 0.000, 0.000, 0.000, 0.000, 0.008, 0.013, 0.185, 0.318, 0.442, 0.539, 0.562, 0.582, 0.592, 0.612, 0.968], [0.000, 0.000, 0.000, 0.000, 0.000, 0.000, 0.148, 0.310, 0.402, 0.431, 0.509, 0.599, 0.625, 0.646, 0.657, 0.671, 0.985]];
const CURVES_LOGO: number[][] = [[0.246, 0.278, 0.310, 0.343, 0.375, 0.408, 0.440, 0.473, 0.506, 0.543, 0.570, 0.596, 0.619, 0.649, 0.676, 0.690, 0.965], [0.000, 0.000, 0.000, 0.000, 0.035, 0.099, 0.163, 0.223, 0.294, 0.354, 0.499, 0.590, 0.622, 0.636, 0.656, 0.679, 0.945], [0.000, 0.000, 0.000, 0.000, 0.004, 0.097, 0.191, 0.284, 0.377, 0.462, 0.567, 0.626, 0.663, 0.685, 0.698, 0.706, 0.960]];
const CURVES_CHASE: number[][] = [[0.000, 0.000, 0.000, 0.047, 0.133, 0.218, 0.304, 0.390, 0.476, 0.562, 0.691, 0.742, 0.768, 0.793, 0.828, 0.855, 1.000], [0.063, 0.368, 0.455, 0.500, 0.531, 0.547, 0.561, 0.574, 0.591, 0.627, 0.668, 0.699, 0.720, 0.737, 0.752, 0.773, 0.987], [0.000, 0.000, 0.128, 0.461, 0.614, 0.656, 0.674, 0.691, 0.707, 0.719, 0.730, 0.746, 0.765, 0.776, 0.788, 0.804, 0.978]];
const CURVES_SKY: number[][] = [[0.000, 0.000, 0.000, 0.000, 0.000, 0.000, 0.004, 0.191, 0.379, 0.621, 0.718, 0.774, 0.832, 0.885, 0.920, 0.937, 1.000], [0.000, 0.000, 0.000, 0.000, 0.067, 0.154, 0.241, 0.326, 0.405, 0.617, 0.761, 0.769, 0.773, 0.776, 0.847, 0.890, 0.994], [0.000, 0.000, 0.000, 0.000, 0.000, 0.018, 0.116, 0.213, 0.311, 0.408, 0.504, 0.600, 0.695, 0.753, 0.790, 0.824, 0.994]];

// ════════ S1 · top-down desk: DMs pop out of the phone, the cursor and the sketch lift off (0–3.167) ════════
export const rig1 = cam([
  [0.0, [0.03, 0.64, 0.1], [0.02, 0, 0.0], 30, -0.12],
  [0.8, [0.03, 0.67, 0.11], [0.025, 0, 0.0], 30, -0.16],
  [1.5, [0.05, 0.78, 0.17], [0.05, 0, 0.0], 30, -0.26],
  [2.3, [-0.06, 0.92, 0.45], [0.1, 0.04, -0.02], 29, -0.42],
  [2.9, [-0.16, 1.05, 0.7], [0.14, 0.05, -0.04], 28, -0.55],
  [3.167, [-0.24, 1.14, 0.86], [0.17, 0.05, -0.06], 27, -0.66],
], 11);
const POPS = [0.08, 0.79, 1.46, 1.9, 2.29];
const NOTE_TO: V3[] = [[-0.035, 0.06, -0.035], [0.065, 0.085, -0.055], [-0.08, 0.12, 0.035], [0.1, 0.15, 0.02], [0.0, 0.22, 0.06]];
const NOTE_ROT: number[] = [0.35, -0.25, 0.5, -0.4, 0.15];
const cursorTrack1 = (t: number): V3 => {
  const k = pr(t, 1.25, 3.167, E.inOut);
  return [0.05 - 0.01 * k, 0.02 + 0.36 * k * k, 0.05 + 0.08 * k];
};
export const Shot1: React.FC<{ t: number }> = ({ t }) => {
  const desk = useMat(() => soft("#BE96F4", { roughness: 0.6, sheen: 0.3 }));
  const floor = useMat(() => soft("#A57BE6", { roughness: 0.7 }));
  const lift = pr(t, 1.4, 3.1, E.inOut);
  const cp = cursorTrack1(t);
  return (
    <>
      <RigCamera rig={rig1} t={t} near={0.01} far={20} />
      <Lights key3={[-0.9, 1.6, -0.5]} keyI={2.3} span={0.8} fill={0.3} env={0.45} />
      <Shadowed>
        <RoundedBox args={[1.7, 0.04, 1.4]} radius={0.015} smoothness={3} position={[-0.43, -0.02, 0.1]} material={desk} />
        <mesh position={[0, -0.74, 0]} rotation={[-Math.PI / 2, 0, 0]} material={floor}>
          <planeGeometry args={[8, 8]} />
        </mesh>
        <group position={[0, 0.0043, 0]} rotation={[0, -0.12, 0]}>
          <group rotation={[-Math.PI / 2, 0, 0]}>
            <Phone />
          </group>
        </group>
        <group position={[0.15, 0.001 + 0.2 * lift * lift, 0.03 - 0.06 * lift]} rotation={[-Math.PI / 2 + 0.9 * lift, 0.5 * lift, -0.45 + 0.6 * lift]}>
          <Paper seed={2} curl={0.2 + 0.4 * lift} bend={lift * 0.7} />
        </group>
        <group position={[-0.21, 0, -0.17]}>
          <PencilCup glass r={0.042} />
        </group>
        <group position={[-0.15, 0, -0.01]} rotation={[0, 0.5, 0]}>
          <ConeToy />
        </group>
        {[[-0.27, 0.13, 0.3], [-0.2, 0.19, -0.2], [-0.31, 0.21, 0.8]].map(([x, z, r], i) => (
          <RoundedBox key={i} args={[0.05, 0.035, 0.05]} radius={0.006} smoothness={3} position={[x, 0.0175, z]} rotation={[0, r, 0]}>
            <meshPhysicalMaterial color={i === 1 ? "#F06FB0" : "#E9A0D6"} roughness={0.45} clearcoat={0.3} />
          </RoundedBox>
        ))}
        <group position={[0.02, 0, 0.25]}>
          <Cup />
        </group>
        <Headphones pos={[-0.16, 0.03, 0.36]} rot={[-1.2, 0.3, 0.4]} s={1.15} cup="#F2A0B0" band="#F7C7D2" cushion="#FBE6EC" />
        <group position={[0.66, -0.3, 0.12]} rotation={[0, 0.45, 0]}>
          <TuftedChair />
        </group>
      </Shadowed>
      {POPS.map((p, i) => {
        if (t < p) return null;
        const k = clamp01(spring(t, p, 2.2, 0.55));
        const fl = floatIdle(t + i, 1.6, 0.006);
        const to = NOTE_TO[i];
        const up = 0.03 * (t - p);
        const pos: V3 = [to[0] * k + fl[0], 0.012 + (to[1] - 0.012) * k + up + fl[1], to[2] * k + fl[2]];
        return (
          <group key={i} position={pos} rotation={[-Math.PI / 2 + 0.25 * (1 - k) + 0.15 * Math.sin(i), 0.2 * Math.sin(i * 2), NOTE_ROT[i] * k]} scale={0.35 + 0.65 * k}>
            <FaceCard w={0.13} h={0.033} d={0.004} px={720} back="#F2B2D8" draw={(c, w, h) => drawNote(c, w, h, i)} deps={[i]} glow={0.25} />
          </group>
        );
      })}
      <Cursor pos={cp} rot={[-Math.PI / 2 + 0.6 * pr(t, 1.3, 3, E.inOut), 0, 2.35]} scale={1.15} color="#B78AF2" shadow={0.5} />
    </>
  );
};
export const post1 = (t: number): PostParams => ({
  ...rigPost(rig1, t, { aperture: 0.28, bloom: 0.3, threshold: 0.78, vignette: 0.12, grain: 0.04, saturation: 1.25, contrast: 0.06, exposure: 1.05, agx: 1, curves: CURVES_DESK }, { blurGain: 0.35 }),
  zoomBlur: kf(t, [[2.95, 0], [3.167, 0.05, E.in]]),
});

// ════════ room shots (baked set "style3/saaswave-room"): wide 3.167–5.375, Publish 5.375–7.458, IT'S LIVE 7.458–8.875 ════════
// set coordinates (three.js): desk top y 0.74, desk front edge z 0.82, laptop centre (0.18, 0.74, 0.48), screen centre
// (0.18, 0.865, 0.344) leaning back 14°
const SCREEN: V3 = [0.18, 0.8652, 0.3443];
const LID = THREE.MathUtils.degToRad(-14);
const LaptopScreen: React.FC<{ page: "home" | "course" }> = ({ page }) => {
  return (
    <group position={SCREEN} rotation={[LID, 0, 0]}>
      <FaceCard w={0.316} h={0.198} d={0.0005} r={0.004} px={1280} back="#1C1620" draw={(c, w, h) => drawSite(c, w, h, page)} deps={[page]} glow={0.3} />
    </group>
  );
};
export const rig3 = cam([
  [3.167, [1.95, 0.74, 2.75], [0.12, 0.98, 0.15], 24, 0.42],
  [3.3, [1.9, 0.75, 2.68], [0.13, 0.98, 0.15], 24, 0.3],
  [4.3, [1.72, 0.78, 2.42], [0.15, 0.97, 0.2], 25, 0.24],
  [5.375, [1.5, 0.8, 2.15], [0.18, 0.95, 0.25], 26, 0.2],
], 13);
const cursorTrack3 = (t: number): V3 => {
  const k = pr(t, 3.25, 5.3, E.inOut);
  return [0.55 + 1.05 * k, 0.92 - 0.12 * k, 0.95 + 1.3 * k];
};
export const ShotRoom: React.FC<{ t: number; room: RoomAssets }> = ({ t, room }) => {
  if (t < T.s4) return <Shot3 t={t} room={room} />;
  if (t < T.s5) return <Shot4 t={t} room={room} />;
  return <Shot5 t={t} room={room} />;
};
const RoomLights: React.FC = () => {
  const glare = React.useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 512;
    const x = c.getContext("2d")!;
    const g = x.createRadialGradient(256, 256, 0, 256, 256, 256);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.25, "rgba(255,240,250,0.55)");
    g.addColorStop(1, "rgba(255,230,245,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, 512, 512);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  React.useEffect(() => () => glare.dispose(), [glare]);
  return (
    <>
      <Lights key3={[0.2, 2.2, -2.4]} target={[0.2, 0.74, 0.5]} keyI={1.6} span={1.4} fill={0.35} hemi={["#FFF5FA", "#E2B6E8", 0.55]} env={0.4} />
      <fog attach="fog" args={["#F6E2F2", 1.2, 7.5]} />
      <mesh position={[0.35, 1.75, -1.05]} userData={{ bridge: "skip" }}>
        <planeGeometry args={[3.2, 2.4]} />
        <meshBasicMaterial color="#FFFAFD" toneMapped={false} fog={false} />
      </mesh>
      <mesh position={[0.2, 1.65, -0.2]} userData={{ bridge: "skip" }}>
        <planeGeometry args={[4.5, 4.5]} />
        <meshBasicMaterial map={glare} transparent opacity={0.85} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} fog={false} />
      </mesh>
    </>
  );
};
const Shot3: React.FC<{ t: number; room: RoomAssets }> = ({ t, room }) => {
  const fly = pr(t, 3.3, 4.0, E.out);
  return (
    <>
      <RigCamera rig={rig3} t={t} near={0.02} far={40} />
      <RoomLights />
      <Room room={room} />
      <LaptopScreen page="home" />
      <Shadowed>
        <Headphones pos={[0.55, 0.77, 0.52]} rot={[0.2, -0.5, 0]} s={0.9} cup="#F8F2F2" band="#F09A6A" cushion="#F7E6E0" />
        <group position={[0.0 + 0.3 * fly, 0.8 + 0.35 * fly, 0.55 + 0.4 * fly]} rotation={[0.4 + 2 * fly, 0.6 * fly, 0.3]}>
          <Paper w={0.15} h={0.2} seed={4} curl={0.3} bend={fly * 1.5} />
        </group>
      </Shadowed>
      <Cursor pos={cursorTrack3(t)} rot={faceCamRot(cursorTrack3(t), rig3(t).pos, -0.5, 0.4)} scale={1.7} color="#B78AF2" />
    </>
  );
};
export const rig4 = cam([
  [5.375, [-0.45, 0.9, 1.75], [0.28, 0.82, 0.38], 42, 0.06],
  [5.6, [-0.2, 0.88, 1.35], [0.24, 0.83, 0.4], 44, 0.0],
  [6.0, [0.12, 0.812, 0.84], [0.2, 0.845, 0.48], 42, -0.12],
  [7.0, [0.13, 0.81, 0.8], [0.2, 0.845, 0.48], 42, -0.16],
  [7.458, [0.14, 0.812, 0.78], [0.205, 0.848, 0.48], 43, -0.2],
], 14, 0.0018);
const PRESS = 6.92;
const PublishPill: React.FC<{ white: number; glow: number }> = ({ white, glow }) => {
  const body = useMat(() => new THREE.MeshPhysicalMaterial({ color: "#D9B8F7", roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.1, transmission: 0.35, thickness: 0.02, sheen: 0.5, sheenColor: new THREE.Color("#FFFFFF"), userData: { envBoost: 1 } }));
  return (
    <group>
      <RoundedBox args={[0.17, 0.05, 0.022]} radius={0.011} smoothness={6} material={body} />
      <group position={[0, 0, 0.0115]}>
        <FaceCard w={0.15} h={0.04} d={0.0003} r={0.0001} px={900} back="#D9B8F7" glow={0.3 + glow} deps={[Math.round(white * 20)]}
          draw={(c, w, h) => {
            c.clearRect(0, 0, w, h);
            c.fillStyle = "#D7B5F5";
            c.fillRect(0, 0, w, h);
            const col = new THREE.Color("#A3279B").lerp(new THREE.Color("#FFFFFF"), white);
            c.fillStyle = `#${col.getHexString()}`;
            c.font = `800 ${h * 0.72}px ${FONT.sans}`;
            c.textAlign = "center";
            c.textBaseline = "middle";
            c.fillText("Publish", w / 2, h * 0.54);
          }}
        />
      </group>
    </group>
  );
};
const Shot4: React.FC<{ t: number; room: RoomAssets }> = ({ t, room }) => {
  const out = clamp01(spring(t, 5.45, 1.6, 0.7));
  const press = Math.exp(-Math.max(0, t - PRESS) * 9) * (t >= PRESS ? 1 : 0);
  const white = pr(t, PRESS, PRESS + 0.12);
  const pill: V3 = [0.2 + 0.0 * out, 0.84 + 0.0 * out, SCREEN[2] + 0.02 + 0.13 * out - 0.015 * press];
  const cin = pr(t, 6.05, PRESS, E.out);
  const cur: V3 = [0.34 - 0.11 * cin + 0.004 * press, 0.8 + 0.035 * cin, 0.5 + 0.005 * cin];
  return (
    <>
      <RigCamera rig={rig4} t={t} near={0.01} far={40} />
      <RoomLights />
      <Room room={room} />
      <LaptopScreen page="home" />
      <Shadowed>
        <Headphones pos={[0.55, 0.77, 0.52]} rot={[0.2, -0.5, 0]} s={0.9} cup="#F8F2F2" band="#F09A6A" cushion="#F7E6E0" />
        <group position={[0.4, 0.745, 0.66]} rotation={[0, 0, Math.PI / 2]}>
          <group rotation={[0, 0.35, 0]}>
            <Marker s={0.9} />
          </group>
        </group>
        <group position={pill} rotation={[LID * (1 - out), -0.08 * out, 0.06 * out]} scale={0.2 + 0.8 * out}>
          <PublishPill white={white} glow={press * 1.5} />
        </group>
      </Shadowed>
      {t > 6.0 && <Cursor pos={cur} rot={[0.5, -0.4, 2.6]} scale={0.5} color="#9F6EF0" />}
    </>
  );
};
export const rig5 = cam([
  [7.458, [0.2, 0.865, 0.74], [0.18, 0.845, 0.35], 34, 0.12],
  [8.2, [0.33, 0.92, 1.06], [0.2, 0.86, 0.35], 32, 0.42],
  [8.875, [0.52, 1.0, 1.46], [0.2, 0.88, 0.3], 30, 0.78],
], 15);
const BURST: { from: V3; to: V3; kind: number; spin: V3 }[] = [
  { from: [0.3, 0.8, 0.45], to: [0.5, 0.96, 0.6], kind: 0, spin: [0.4, 1.2, 0.3] },
  { from: [0.1, 0.82, 0.45], to: [-0.1, 0.9, 0.58], kind: 1, spin: [0.2, 0.6, 0.9] },
  { from: [0.2, 0.8, 0.5], to: [0.4, 0.77, 0.58], kind: 2, spin: [1.4, 0.2, 0.8] },
  { from: [0.18, 0.84, 0.42], to: [-0.02, 1.0, 0.5], kind: 3, spin: [0.3, 0.9, 0.2] },
  { from: [0.25, 0.82, 0.45], to: [0.62, 0.84, 0.5], kind: 3, spin: [2.0, 0.5, 0.4] },
];
const Shot5: React.FC<{ t: number; room: RoomAssets }> = ({ t, room }) => {
  return (
    <>
      <RigCamera rig={rig5} t={t} near={0.01} far={40} />
      <RoomLights />
      <Room room={room} />
      <LaptopScreen page="course" />
      <Shadowed>
        {BURST.map((b, i) => {
          const k = clamp01(spring(t, T.s5 + 0.05 + i * 0.06, 1.1, 0.8));
          const drift = (t - T.s5) * 0.06;
          const p: V3 = [b.from[0] + (b.to[0] - b.from[0]) * k, b.from[1] + (b.to[1] - b.from[1]) * k + drift, b.from[2] + (b.to[2] - b.from[2]) * k];
          const r: V3 = [b.spin[0] * (t - T.s5), b.spin[1] * (t - T.s5), b.spin[2] * (t - T.s5)];
          return (
            <group key={i} position={p} rotation={r} scale={0.75}>
              {b.kind === 0 && <Headphones pos={[0, 0, 0]} rot={[0, 0, 0]} s={1.4} cup="#F28A7A" band="#F7B4A4" cushion="#FBE3DD" />}
              {b.kind === 1 && <PublishPill white={1} glow={0.2} />}
              {b.kind === 2 && <Marker s={1.1} />}
              {b.kind === 3 && <Paper w={0.12} h={0.16} seed={6} curl={0.4} bend={0.6} />}
              {b.kind === 4 && <Cup />}
            </group>
          );
        })}
      </Shadowed>
      <Cursor pos={[0.2 + 0.15 * pr(t, T.s5, T.burst), 0.95 + 0.06 * pr(t, T.s5, T.burst), 0.6]} rot={[0.4, -0.6, 2.2]} scale={0.8} color="#9F6EF0" />
    </>
  );
};
export const postRoom = (t: number): PostParams => {
  const rig = t < T.s4 ? rig3 : t < T.s5 ? rig4 : rig5;
  return {
    ...rigPost(rig, t, { aperture: t < T.s4 ? 0.32 : 0.26, bloom: 0.5, threshold: 0.78, vignette: 0.08, grain: 0.04, saturation: t < T.s4 ? 0.9 : 1.05, contrast: 0.03, exposure: t < T.s4 ? 1.04 : 0.96, agx: 0 }, { blurGain: 0.35 }),
    flash: Math.max(kf(t, [[T.s3, 0.55], [T.s3 + 0.12, 0, E.out]]), pr(t, PRESS, PRESS + 0.05) * (1 - pr(t, PRESS + 0.05, PRESS + 0.3)) * 0.45, kf(t, [[T.burst - 0.15, 0], [T.burst, 1, E.in]])),
    flashColor: [1, 0.96, 1],
  };
};

// ════════ S7 · macro: the gradient marker draws a grey stroke past the mesh pencil cup (9.417–11.292) ════════
const STROKE = path([[0.17, 0.0007, 0.095], [0.09, 0.0007, 0.09], [0.0, 0.0007, 0.085], [-0.06, 0.0007, 0.08], [-0.095, 0.0007, 0.064], [-0.075, 0.0007, 0.045], [0.0, 0.0007, 0.04], [0.06, 0.0007, 0.042]]);
const DRAW7: [number, number] = [9.55, 11.2];
export const rig7 = cam([
  [9.417, [-0.02, 0.22, 0.12], [-0.05, 0.04, -0.06], 28, -1.0],
  [9.75, [0.03, 0.23, 0.11], [-0.02, 0.02, -0.03], 30, -0.6],
  [10.05, [0.14, 0.13, 0.22], [0.1, 0.0, 0.08], 32, -0.25],
  [10.6, [0.06, 0.11, 0.23], [0.02, 0.0, 0.08], 33, -0.1],
  [11.292, [-0.07, 0.12, 0.21], [-0.05, 0.0, 0.05], 33, 0.15],
], 17, 0.002);
export const Shot7: React.FC<{ t: number }> = ({ t }) => {
  const desk = useMat(() => soft("#F4F2F5", { roughness: 0.75, sheen: 0 }));
  const d = pr(t, DRAW7[0], DRAW7[1], E.inOut);
  const tip = STROKE(d);
  const lift = pr(t, DRAW7[1], DRAW7[1] + 0.2, E.out);
  return (
    <>
      <RigCamera rig={rig7} t={t} near={0.004} far={10} />
      <color attach="background" args={["#E8E6EB"]} />
      <fog attach="fog" args={["#ECEAEE", 0.5, 2.2]} />
      <Lights key3={[0.6, 1.4, -0.6]} keyI={2.6} span={0.35} fill={0.4} hemi={["#FFFFFF", "#E6E3EA", 0.7]} env={0.55} />
      <Shadowed>
        <mesh rotation={[-Math.PI / 2, 0, 0]} material={desk}>
          <planeGeometry args={[3, 3]} />
        </mesh>
        {[[0.02, 0.06, -0.3, 3], [-0.12, -0.08, 0.4, 5], [0.12, -0.06, 0.15, 7]].map(([x, z, r, s], i) => (
          <group key={i} position={[x, 0.0004 + i * 0.0002, z]} rotation={flat(r)}>
            <Paper w={0.21} h={0.297} seed={s} curl={0.05} paper="#FBFAFB" />
          </group>
        ))}
        <group position={[-0.05, 0, -0.07]}>
          <PencilCup r={0.045} h={0.11} n={8} seed={5} />
        </group>
        {[[0.0, 0.02, 0.5], [0.035, 0.055, -0.4], [-0.02, 0.095, 1.2], [0.05, 0.11, 0.2]].map(([x, z, r], i) => (
          <group key={i} position={[x, 0.0012, z]} rotation={[0, r, 0]}>
            <PaperClip />
          </group>
        ))}
        <Ribbon path={STROKE} draw={d} width={0.0026} color="#4D4855" />
        <group position={[tip[0], tip[1] + 0.002 + 0.03 * lift, tip[2]]} rotation={[0.55, 0.9, -0.35]}>
          <Marker />
        </group>
      </Shadowed>
    </>
  );
};
export const post7 = (t: number): PostParams => ({
  ...rigPost(rig7, t, { aperture: 0.4, bloom: 0.35, threshold: 0.8, vignette: 0.12, grain: 0.045, saturation: 0.75, contrast: 0.05, exposure: 1.1, agx: 0, bokeh: 0.3, curves: CURVES_MACRO }, { blurGain: 0.3 }),
  flash: Math.max(kf(t, [[T.s7, 0.6], [T.s7 + 0.1, 0, E.out]]), kf(t, [[T.flash7 - 0.1, 0], [T.flash7, 0.9, E.in]])),
});

// ════════ S8 · top-down: the marker writes the red "Sw" on a sketch over a purple card; the stroke runs off as a ribbon (11.542–13.333) ════════
const SW3 = (() => {
  const pts = SW_PATH.map(([x, y]) => new THREE.Vector3((x - 0.5) * 0.16, 0.012, (y - 0.5) * 0.08));
  return new THREE.CatmullRomCurve3(pts, false, "centripetal");
})();
const swGeo = new THREE.TubeGeometry(SW3, 320, 0.0032, 12, false);
const RIB8 = path([[0.075, 0.012, -0.03], [0.12, 0.02, -0.02], [0.17, 0.035, 0.0], [0.22, 0.03, -0.03], [0.3, 0.06, 0.0], [0.42, 0.1, -0.04], [0.6, 0.16, 0.0]]);
export const rig8 = cam([
  [11.542, [0.0, 0.86, 0.16], [0.0, 0.0, 0.0], 30, 0.22],
  [12.4, [0.02, 0.78, 0.14], [0.02, 0, 0.0], 30, 0.04],
  [13.333, [0.1, 0.6, 0.15], [0.07, 0.0, 0.0], 30, -0.38],
], 18);
export const Shot8: React.FC<{ t: number }> = ({ t }) => {
  const desk = useMat(() => soft("#F3F1F4", { roughness: 0.8, sheen: 0 }));
  const card = useMat(() => soft("#B67CEB", { roughness: 0.45, clearcoat: 0.3 }));
  const red = useMat(() => new THREE.MeshPhysicalMaterial({ color: "#E0233A", roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1, userData: { envBoost: 1 } }));
  const d = pr(t, 11.62, 12.55, E.inOut);
  const n = swGeo.index!.count;
  swGeo.setDrawRange(0, Math.floor((n * d) / 6) * 6);
  const tip = SW3.getPoint(Math.max(0.001, d));
  const lift = pr(t, 12.5, 13.3, E.inOut);
  const rib = pr(t, 12.5, 13.333, E.in);
  return (
    <>
      <RigCamera rig={rig8} t={t} near={0.01} far={10} />
      <color attach="background" args={["#ECEAEE"]} />
      <Lights key3={[0.7, 1.5, -0.4]} keyI={2.6} span={0.5} fill={0.4} hemi={["#FFFFFF", "#E8E4EE", 0.65]} env={0.5} />
      <Shadowed>
        <mesh rotation={[-Math.PI / 2, 0, 0]} material={desk}>
          <planeGeometry args={[4, 4]} />
        </mesh>
        {[[-0.25, -0.12, 0.2, 9], [0.22, -0.16, -0.25, 3], [-0.28, 0.12, -0.1, 4]].map(([x, z, r, s], i) => (
          <group key={i} position={[x, 0.0004, z]} rotation={flat(r)}>
            <Paper w={0.21} h={0.297} seed={s} curl={0.03} paper="#FBFAFB" />
          </group>
        ))}
        <group rotation={[0, 0.22, 0]}>
          <RoundedBox args={[0.34, 0.006, 0.23]} radius={0.003} smoothness={2} position={[0, 0.003, 0]} material={card} />
          <group position={[0.01, 0.0065 + 0.08 * lift, 0.005]} rotation={[-Math.PI / 2 + 0.5 * lift, 0, 0.06 + 0.3 * lift]}>
            <Paper w={0.26} h={0.18} seed={12} curl={0.08 + 0.5 * lift} bend={lift} />
          </group>
          <group position={[0, 0.0 + 0.08 * lift, 0]}>
            <mesh geometry={swGeo} material={red} />
          </group>
          {rib > 0 && <Ribbon path={RIB8} draw={rib} width={0.007} color="#E0233A" twist={3} />}
          <group position={[tip.x, tip.y + 0.002 + 0.12 * lift, tip.z]} rotation={[0.35, 0.4, -0.25]}>
            <Marker />
          </group>
        </group>
        <group position={[-0.17, 0, -0.14]}>
          <PencilCup r={0.035} h={0.1} n={7} seed={8} />
        </group>
        <group position={[0.16, 0.0, 0.13]} rotation={[0, -0.6, 0]}>
          <Scissors />
        </group>
        <group position={[0.21, 0.001, 0.02]} rotation={flat(0.15)}>
          <FaceCard w={0.11} h={0.09} d={0.001} r={0.002} px={400} back="#F7B1C9" draw={(c, w, h) => drawSticky(c, w, h, 4)} />
        </group>
        <group position={[-0.02, 0.001, 0.17]} rotation={flat(-0.1)}>
          <FaceCard w={0.16} h={0.1} d={0.002} r={0.006} px={500} back="#D9CCF5" draw={(c, w, h) => drawSketch(c, w, h, 21, "#E6DCF8")} />
        </group>
        <group position={[-0.14, 0.004, 0.08]} rotation={[0, 0.9, Math.PI / 2]}>
          <group rotation={[0, 0, 0]}>
            <mesh>
              <cylinderGeometry args={[0.0035, 0.0035, 0.15, 6]} />
              <meshStandardMaterial color="#E0233A" roughness={0.5} />
            </mesh>
          </group>
        </group>
      </Shadowed>
      <Cursor pos={[0.2 - 0.05 * pr(t, 12.4, 13.3), 0.05 + 0.1 * pr(t, 12.4, 13.3), -0.06]} rot={[-Math.PI / 2 + 0.4, 0, 2.6]} scale={0.8} color="#9F6EF0" />
    </>
  );
};
export const post8 = (t: number): PostParams => ({
  ...rigPost(rig8, t, { aperture: 0.25, bloom: 0.35, threshold: 0.78, vignette: 0.12, grain: 0.04, saturation: 0.95, contrast: 0.05, exposure: 1.15, agx: 0, curves: CURVES_LOGO }, { blurGain: 0.35 }),
  flash: kf(t, [[T.s8, 0.7], [T.s8 + 0.12, 0, E.out]]),
});

// ════════ S9 · chase the ribbon through floating sticky notes into "SD", "many" and a rising umbrella (13.333–15.417) ════════
const RIB9 = path([[-1.4, 0.0, 0.0], [-0.9, 0.08, -0.12], [-0.4, -0.02, 0.05], [0.1, 0.06, -0.08], [0.6, 0.0, 0.06], [1.0, 0.1, -0.1], [1.3, 0.04, 0.12], [1.9, 0.18, -0.05], [2.6, 0.1, 0.0]]);
export const rig9 = cam([
  [13.333, [-1.25, 0.1, 0.75], [-0.6, 0.0, 0.0], 32, -0.2],
  [13.8, [-0.45, 0.14, 0.7], [0.2, 0.04, -0.02], 30, -0.45],
  [14.3, [0.45, 0.18, 0.72], [1.1, 0.1, -0.05], 30, -0.6],
  [14.6, [1.52, 0.3, 0.52], [1.62, 0.2, -0.32], 32, -0.2],
  [15.1, [1.6, 0.3, 0.42], [1.62, 0.2, -0.32], 34, -0.06],
  [15.417, [1.61, 0.31, 0.36], [1.62, 0.21, -0.32], 34, 0.05],
], 19, 0.003);
const STICKIES = Array.from({ length: 34 }, (_, i) => ({
  pos: [-1.3 + rand(i * 3 + 1) * 3.2, -0.25 + rand(i * 5 + 2) * 0.6, -0.6 + rand(i * 7 + 3) * 0.8] as V3,
  rot: [rand(i + 9) * 2 - 1, rand(i + 19) * 2 - 1, rand(i + 29) * 2 - 1] as V3,
  s: 0.7 + rand(i + 39) * 0.6,
}));
export const makeCloudCanvas = () => {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 512;
  const x = c.getContext("2d")!;
  const g = x.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, "#FBF5F7");
  g.addColorStop(1, "#F2E6EC");
  x.fillStyle = g;
  x.fillRect(0, 0, 1024, 512);
  for (let i = 0; i < 70; i++) {
    const r = 40 + rand(i * 3) * 120;
    const gg = x.createRadialGradient(0, 0, 0, 0, 0, r);
    gg.addColorStop(0, "rgba(255,255,255,0.8)");
    gg.addColorStop(1, "rgba(255,255,255,0)");
    x.save();
    x.translate(rand(i * 5) * 1024, rand(i * 7) * 512);
    x.fillStyle = gg;
    x.beginPath();
    x.arc(0, 0, r, 0, Math.PI * 2);
    x.fill();
    x.restore();
  }
  return c;
};
const Cloud: React.FC = () => {
  const tex = React.useMemo(() => {
    const c = makeCloudCanvas();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  React.useEffect(() => () => tex.dispose(), [tex]);
  return (
    <mesh>
      <sphereGeometry args={[12, 32, 16]} />
      <meshBasicMaterial map={tex} side={THREE.BackSide} toneMapped={false} />
    </mesh>
  );
};
export const Shot9: React.FC<{ t: number }> = ({ t }) => {
  const draw = pr(t, T.s9 - 0.3, 14.4, E.lin);
  const umb = pr(t, 14.95, 15.42, E.out);
  return (
    <>
      <RigCamera rig={rig9} t={t} near={0.01} far={30} />
      <Lights key3={[0.8, 2.2, 1.6]} target={[0.6, 0, 0]} keyI={1.8} span={2.2} fill={0.45} hemi={["#FFFFFF", "#F0D5E6", 0.7]} env={0.55} />
      <Cloud />
      <Ribbon path={RIB9} draw={Math.min(1, draw * 1.15)} tail={1} width={0.035} color="#E0233A" twist={4} />
      {STICKIES.map((s, i) => {
        const fl = floatIdle(t + i * 0.37, 0.9, 0.02);
        return (
          <group key={i} position={[s.pos[0] + fl[0], s.pos[1] + fl[1], s.pos[2] + fl[2]]} rotation={[s.rot[0] + t * 0.2, s.rot[1], s.rot[2]]} scale={s.s}>
            <FaceCard w={0.11} h={0.085} d={0.0015} r={0.002} px={256} back={["#F9C7D8", "#FBD3A8", "#C9E9F3", "#D8C8F7"][i % 4]} draw={(c, w, h) => drawSticky(c, w, h, i)} deps={[i % 7]} glow={0.25} />
          </group>
        );
      })}
      {t > 14.25 && t < 14.75 && (
        <group position={[1.15, 0.2, -0.15]} rotation={[0.1, -0.5, 0.1]}>
          <BalloonWord text="SD" size={0.14} colors={["#D8142C", "#E3263C"]} t={t} t0={14.3} />
        </group>
      )}
      {t > 14.55 && (
        <group position={[1.62, 0.18, -0.32]} rotation={[0.05, -0.12, 0.02]}>
          <BalloonWord text="many" size={0.16} colors={["#F2639F", "#F06AB0", "#DF70D4", "#B47AF0"]} t={t} t0={14.6} />
        </group>
      )}
      {umb > 0 && (
        <group position={[1.6, -0.6 + 0.62 * umb, -0.12]} rotation={[0.45 - 0.2 * umb, t * 0.6, 0.15]} scale={0.42}>
          <Umbrella open={0.6 + 0.4 * umb} canopy="#E99BE6" />
        </group>
      )}
    </>
  );
};
export const post9 = (t: number): PostParams => ({
  ...rigPost(rig9, t, { aperture: 0.2, bloom: 0.35, threshold: 0.8, vignette: 0.1, grain: 0.04, saturation: 1.1, contrast: 0.05, exposure: 1.0, agx: 0, curves: CURVES_CHASE }, { blurGain: 0.5 }),
  flash: Math.max(kf(t, [[T.s9, 0.5], [T.s9 + 0.12, 0, E.out]]), kf(t, [[T.pink - 0.12, 0], [T.pink, 0.6, E.in]])),
  flashColor: t > 15 ? [1, 0.55, 0.85] : [1, 1, 1],
});

// ════════ S11 · the umbrella floats in a blue sky, "Answers" behind it (15.75–18.583) ════════
export const rig11 = cam([
  [15.75, [0, 0.05, 2.1], [0, 0.08, 0], 35, 0.0],
  [16.0, [0, 0.06, 1.95], [0, 0.08, 0], 35, 0.0],
  [18.583, [0.02, 0.07, 1.82], [0, 0.09, 0], 35, 0.0],
], 21, 0.0015);
export const makeSkyCanvas = () => {
  const c = document.createElement("canvas");
  c.width = 2048;
  c.height = 1152;
  const x = c.getContext("2d")!;
  const g = x.createLinearGradient(0, 0, 0, 1152);
  g.addColorStop(0, "#7ACBE6");
  g.addColorStop(0.55, "#A9DDEE");
  g.addColorStop(1, "#E3F3F8");
  x.fillStyle = g;
  x.fillRect(0, 0, 2048, 1152);
  // soft cumulus: clusters of blurred white puffs, flatter at the bottom
  for (let cl = 0; cl < 7; cl++) {
    const cx = [180, 1700, 1250, 520, 1900, 980, 60][cl], cy = [980, 900, 1080, 300, 260, 1150, 520][cl], sz = 120 + rand(cl * 17) * 170;
    for (let i = 0; i < 18; i++) {
      const r = sz * (0.25 + rand(cl * 100 + i) * 0.45);
      const px = cx + (rand(cl * 100 + i * 3) - 0.5) * sz * 2.4, py = cy + (rand(cl * 100 + i * 7) - 0.65) * sz * 0.8;
      const gg = x.createRadialGradient(px, py, 0, px, py, r);
      gg.addColorStop(0, "rgba(255,255,255,0.75)");
      gg.addColorStop(0.6, "rgba(255,255,255,0.35)");
      gg.addColorStop(1, "rgba(255,255,255,0)");
      x.fillStyle = gg;
      x.beginPath();
      x.arc(px, py, r, 0, Math.PI * 2);
      x.fill();
    }
  }
  const sun = x.createRadialGradient(260, 60, 0, 260, 60, 700);
  sun.addColorStop(0, "rgba(255,255,255,1)");
  sun.addColorStop(0.25, "rgba(255,255,255,0.55)");
  sun.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = sun;
  x.fillRect(0, 0, 2048, 1152);
  return c;
};
const Sky: React.FC = () => {
  const tex = React.useMemo(() => {
    const c = makeSkyCanvas();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  React.useEffect(() => () => tex.dispose(), [tex]);
  return (
    <mesh position={[0, 0.1, -4]}>
      <planeGeometry args={[9.6, 5.4]} />
      <meshBasicMaterial map={tex} toneMapped={false} />
    </mesh>
  );
};
/** "Answers" letter by letter (ref 15.8–17.4 s): drawn on a 2048×512 canvas; the 3D plane is 2.2 × 0.55 m at (0, 0.1, −0.35) */
export const drawAnswers = (c: CanvasRenderingContext2D, w: number, h: number, t: number) => {
  const word = "Answers";
  c.font = `800 ${h * 0.5}px ${FONT.sans}`;
  c.textBaseline = "middle";
  c.shadowColor = "rgba(60,110,150,0.28)";
  c.shadowBlur = 24;
  const ws = word.split("").map((ch) => c.measureText(ch).width);
  const total = ws.reduce((a, b) => a + b, 0) - 0.03 * h * (word.length - 1);
  const out = pr(t, 17.05, 17.32, E.inOut);
  let x = (w - total) / 2 - out * w * 0.32;
  word.split("").forEach((ch, i) => {
    const k = clamp01((t - 15.82 - i * 0.045) / 0.18);
    const s = k <= 0 ? 0 : 0.6 + 0.4 * E.out(k) + 0.08 * Math.sin(k * Math.PI);
    c.save();
    c.translate(x + ws[i] / 2, h / 2);
    c.scale(s, s);
    c.globalAlpha = clamp01(k * 2) * (1 - pr(t, 17.3, 17.42));
    if (out > 0) {
      c.strokeStyle = "rgba(255,255,255,0.9)";
      c.lineWidth = 6;
      c.strokeText(ch, -ws[i] / 2, 0);
    } else {
      c.fillStyle = i === word.length - 1 && t < 16.2 ? "#E23A9A" : "#FFFFFF";
      c.fillText(ch, -ws[i] / 2, 0);
    }
    c.restore();
    x += ws[i] - 0.03 * h;
  });
};
export const ANSWERS_PLANE = { pos: [0, 0.1, -0.35] as V3, w: 2.2, h: 0.55 };
const AnswersWord: React.FC<{ t: number }> = ({ t }) => {
  const tex = useLiveTex(2048, 512, (c, w, h) => drawAnswers(c, w, h, t));
  return (
    <mesh position={[0, 0.1, -0.35]}>
      <planeGeometry args={[2.2, 0.55]} />
      <meshBasicMaterial map={tex} transparent toneMapped={false} depthWrite={false} />
    </mesh>
  );
};
export const Shot11: React.FC<{ t: number }> = ({ t }) => {
  const arrive = clamp01(spring(t, T.s11 - 0.05, 1.4, 0.7));
  const fl = floatIdle(t, 0.5, 0.012);
  return (
    <>
      <RigCamera rig={rig11} t={t} near={0.05} far={30} />
      <Lights key3={[-1.5, 2.0, 1.5]} target={[0, 0.1, 0]} keyI={2.2} span={1.2} fill={0.5} hemi={["#E9F7FF", "#F2C9E6", 0.8]} env={0.6} />
      <Sky />
      <AnswersWord t={t} />
      <group position={[fl[0], 0.16 + fl[1] + 0.2 * (1 - arrive), 0.15]} rotation={[0.28 + 0.04 * Math.sin(t * 1.3), 0.4 + t * 0.25, -0.16]} scale={0.5 * (0.8 + 0.2 * arrive)}>
        <Umbrella canopy="#F592D6" inner="#E58FD6" />
      </group>
    </>
  );
};
export const post11 = (t: number): PostParams => ({
  ...rigPost(rig11, t, { aperture: 0.06, bloom: 0.4, threshold: 0.8, vignette: 0.06, grain: 0.035, saturation: 1.05, contrast: 0.03, exposure: 1.06, agx: 0, curves: CURVES_SKY }, { blurGain: 0.2 }),
  flash: kf(t, [[T.s11, 0.8], [T.s11 + 0.18, 0, E.out]]),
});

// ════════ S12 · the folder of project files (18.583–20.208): files pop out, then everything flies apart ════════
export const rig12 = cam([
  [18.583, [0.0, 0.22, 1.75], [0, 0.12, 0], 40, -0.3],
  [19.2, [0.02, 0.23, 1.68], [0, 0.12, 0], 40, -0.12],
  [19.46, [0.03, 0.23, 1.65], [0, 0.12, 0], 40, 0.35],
  [20.208, [0.08, 0.26, 1.6], [0.05, 0.13, 0], 40, 0.55],
], 22, 0.0015);
export const Shot12: React.FC<{ t: number }> = ({ t }) => {
  const apart = pr(t, T.files, T.s13, E.in);
  const pop = (i: number) => clamp01(spring(t, 18.85 + i * 0.16, 2.2, 0.5));
  return (
    <>
      <RigCamera rig={rig12} t={t} near={0.01} far={20} />
      <color attach="background" args={["#FBF7FA"]} />
      <Lights key3={[-0.8, 1.6, 1.4]} target={[0, 0.1, 0]} keyI={2.2} span={0.6} fill={0.5} hemi={["#FFFFFF", "#F3D8EA", 0.7]} env={0.55} />
      <group position={[0.02 + 0.5 * apart * apart, 0.02 - 0.2 * apart, 0]} rotation={[0.15, -0.35 + 0.25 * Math.sin(t * 0.8) + 1.2 * apart, 0.12 - 0.5 * apart]}>
        <Folder open={0.3 + 0.1 * Math.sin(t * 2)} />
        {[".aep", ".blend", ".aep"].map((l, i) => {
          const k = pop(i);
          const fly = apart;
          return (
            <group key={i} position={[(-0.06 + i * 0.05) + 0.3 * fly * (i - 1), 0.1 + 0.12 * k + 0.25 * fly * (i + 1), 0.005 - i * 0.004 + 0.2 * fly]} rotation={[-0.1 - 0.3 * fly, 0.1 * (i - 1), (i - 1) * 0.12 + fly * (i - 1)]} scale={0.6 + 0.4 * k}>
              <FileCard label={l} />
            </group>
          );
        })}
      </group>
    </>
  );
};
export const post12 = (t: number): PostParams => ({
  ...rigPost(rig12, t, { aperture: 0.12, bloom: 0.25, threshold: 0.85, vignette: 0.04, grain: 0.035, saturation: 1.05, contrast: 0.04, exposure: 1.05, agx: 0 }, { blurGain: 0.45 }),
  flash: kf(t, [[T.s12, 0.5], [T.s12 + 0.1, 0, E.out]]),
});

// unused-import guard for helpers kept for the Blender pass
void roundRect;
void CURVES_ROOM5_UNUSED;
void NOTES;
