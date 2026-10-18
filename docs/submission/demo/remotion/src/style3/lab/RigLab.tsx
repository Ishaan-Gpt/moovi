import React from "react";
import * as THREE from "three";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { E, FONT, FPS, H, V3, W, kf, pr, roundedSlab, useFonts } from "../lib";
import { Post, PostParams } from "../post";
import { Cursor } from "../room";
import { SPEED, clock, path, spring, stride, travel, burst, REF_RAMP } from "../motion";
import { Rig, RigCamera, keys, orbitRig, pathRig, rigPost } from "../rig";
import { Blocks, Debris, Fabric, Ribbon, Shards } from "../assets3d";

// Style 3 rig lab: one calibrated mini-shot per technique, to prove the motion core and to measure it with
// styles/tools/s3_motion.py (targets: REF_RAMP). Not a film; a test bench. 15 s, 24 fps, 16:9.
export const RIGLAB_SECONDS = 15;
const SEG = [0, 3, 6, 9, 11.5, 15];

// ── 1 · fly-through with parallax: cut in on a whip (ref B ramp), drift, ramp up into the cut ──
const s1move = travel({ t0: 0, t1: 3, floor: 1, ramps: [{ at: 0, peak: REF_RAMP.beat.ratio, attack: 0, decay: REF_RAMP.beat.decay }, { at: 3, peak: 18, attack: 6, decay: 0 }] });
const rig1: Rig = pathRig({
  path: [[3.2, 0.9, 3.2], [1.4, 0.5, 1.2], [-0.4, 0.3, -0.6], [-2.2, 0.6, -2.8]],
  look: [[1.6, 0.3, -1.5], [0.2, 0.2, -3], [-1.4, 0.4, -4.4], [-3, 0.5, -6]],
  move: s1move, lens: 30, roll: keys([[0, -0.16], [1.2, 0.02], [3, 0.12, E.in]]), handheld: { amp: 0.01, seed: 1 },
});

// ── 2 · bullet time: the world freezes mid-burst (0x) while the camera keeps orbiting (1x) ──
const w2 = clock([[3, 1], [3.45, 1], [3.8, 0, E.out], [5.0, 0], [5.5, 1, E.in], [6, SPEED.double]]);
const s2move = travel({ t0: 3, t1: 6, floor: 1, ramps: [{ at: 3, peak: 20, attack: 0, decay: 6 }] });
const rig2: Rig = orbitRig({ target: [0, 0.2, 0], radius: keys([[3, 3.2], [6, 2.4]]), height: keys([[3, 0.5], [6, 0.15]]), a0: -0.9, a1: 0.55, move: s2move, lens: 38, roll: keys([[3, 0.1], [6, -0.06]]) });

// ── 3 · slow-mo float (ref C): world at 0.2x, camera a gentle essay-ramp push, shallow DOF, dark grade ──
const w3 = clock([[6, SPEED.slowmo], [9, SPEED.slowmo]]);
const s3move = travel({ t0: 6, t1: 9, floor: 1, ramps: [{ at: 7.6, peak: REF_RAMP.essay.ratio * 0.4, attack: REF_RAMP.essay.attack, decay: REF_RAMP.essay.decay }] });
const rig3: Rig = pathRig({ path: [[0.5, 0.1, 3.6], [0.1, 0.15, 2.4]], look: [0, 0.25, 0], move: s3move, lens: 50, roll: keys([[6, 0.05], [9, -0.03]]), handheld: { amp: 0.006, seed: 3 } });

// ── 4 · hyperlapse: steady fast travel down a corridor, stride bob, world clock ×8 ──
const w4 = clock([[9, 8], [11.5, 8]]);
const rig4base: Rig = pathRig({ path: [[0, 0.4, 6], [0.15, 0.45, -3], [0, 0.4, -12]], look: [0, 0.35, -40], move: (t) => (t - 9) / 2.5, lens: 24 });
const rig4: Rig = (t) => {
  const s = rig4base(t), st = stride(t, 2.4, 0.02);
  return { ...s, pos: [s.pos[0], s.pos[1] + st.y, s.pos[2]] as V3, roll: st.roll };
};

// ── 5 · ramp-up 1x → 2x → hyper into a screen, white bloom, cut, ramp-in (hyper → settle) on the hero ──
const CUT5 = 13.0;
const s5a = travel({ t0: 11.5, t1: CUT5, floor: 1, ramps: [{ at: CUT5, peak: 30, attack: 9, decay: 0 }] });
const rig5a: Rig = pathRig({ path: [[0.6, 0.35, 4.2], [0.15, 0.1, 1.6], [0, 0, 0.12]], look: [0, 0, -1], move: s5a, lens: keys([[11.5, 40], [CUT5, 26]]), roll: keys([[11.5, 0.04], [CUT5, -0.18, E.in]]) });
const s5b = travel({ t0: CUT5, t1: 15, floor: 1, ramps: [{ at: CUT5, peak: 26, attack: 0, decay: REF_RAMP.launch.decay + 1 }] });
const rig5b: Rig = pathRig({ path: [[-1.6, 0.9, 4.5], [-0.5, 0.4, 2.6], [0.1, 0.25, 2.1]], look: [0, 0.1, 0], move: s5b, lens: 40, roll: keys([[CUT5, 0.22], [13.5, 0.02, E.out], [15, -0.02]]) });

const seg = (t: number) => SEG.findIndex((a, i) => t >= a && t < SEG[i + 1]);
const RIGS = [rig1, rig2, rig3, rig4, (t: number) => (t < CUT5 ? rig5a(t) : rig5b(t))];

const Pastel: React.FC<{ top: string; bottom: string }> = ({ top, bottom }) => {
  const tex = React.useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 4;
    c.height = 256;
    const x = c.getContext("2d")!;
    const g = x.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, top);
    g.addColorStop(1, bottom);
    x.fillStyle = g;
    x.fillRect(0, 0, 4, 256);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [top, bottom]);
  return <primitive attach="background" object={tex} />;
};

const Screen: React.FC = () => {
  return (
    <group>
      <mesh geometry={SCREEN}>
        <meshStandardMaterial color="#2A2633" roughness={0.4} />
      </mesh>
      <mesh position={[0, 0, 0.031]}>
        <planeGeometry args={[1.5, 0.85]} />
        <meshBasicMaterial color={new THREE.Color(1.35, 1.25, 1.45)} toneMapped={false} />
      </mesh>
    </group>
  );
};

const Scene: React.FC<{ t: number }> = ({ t }) => {
  const i = seg(t);
  if (i === 0)
    return (
      <>
        <Pastel top="#F3E3F7" bottom="#FFD9C9" />
        <hemisphereLight args={["#FFFFFF", "#C9A8E8", 1.6]} />
        <directionalLight position={[-3, 5, 4]} intensity={1.6} color="#FFE6D2" />
        <Blocks n={90} seed={4} box={[[-5, -1.2, -9], [5, 2.2, 3]]} s={t} />
        <Cursor pos={[0.2 + Math.sin(t * 2) * 0.1, 0.35, -1.8]} rot={[0.3, -0.6 + t * 0.4, 2.4]} scale={1.6} color="#7E5CF0" />
      </>
    );
  if (i === 1) {
    const s = w2.time(t); // world seconds since the burst (a clock counts from its first key)
    return (
      <>
        <Pastel top="#EDE4FF" bottom="#FFE3EE" />
        <hemisphereLight args={["#FFFFFF", "#B9A6EE", 1.7]} />
        <directionalLight position={[-3, 4, 3]} intensity={1.8} />
        {Array.from({ length: 34 }, (_, k) => {
          const b = burst(k, Math.max(0, s), { origin: [0, 0.2, 0], speed: 4.2, spread: 1.2, drag: 2.0, g: 1.2, seed: 21 });
          return (
            <mesh key={k} position={b.pos} rotation={b.rot} scale={0.09 + (k % 5) * 0.025}>
              <boxGeometry args={[1, 0.62, 0.14]} />
              <meshStandardMaterial color={["#FF8FB8", "#A68BF5", "#FFC07A", "#7FE0C2", "#FFFFFF"][k % 5]} roughness={0.5} />
            </mesh>
          );
        })}
        <Shards s={Math.max(0, s)} origin={[0, 0.2, 0]} speed={1.6} n={26} />
        <mesh position={[0, 0.2, 0]} scale={0.3 * (1 - pr(s, 0, 0.12))}>
          <sphereGeometry args={[1, 32, 16]} />
          <meshBasicMaterial color={new THREE.Color(2, 2, 2)} toneMapped={false} />
        </mesh>
      </>
    );
  }
  if (i === 2) {
    const s = w3.time(t);
    return (
      <>
        <color attach="background" args={["#0B1013"]} />
        <hemisphereLight args={["#9FC3C9", "#140C08", 1.1]} />
        <directionalLight position={[2, 3, -2]} intensity={2.4} color="#FFC98A" />
        <pointLight position={[-1.5, 1, 1.5]} intensity={2} color="#6FA8B8" />
        <Debris s={s} n={70} shape="feather" color="#E9E2D4" fall={0.35} spin={0.9} box={[[-2.5, -1.6, -2.5], [2.5, 2.2, 1.6]]} size={[0.09, 0.22]} />
        <Fabric s={s * 4} position={[0.4, -0.4, -1.2]} rotation={[0.2, -0.4, 0.5]} w={4} h={1.1} />
        <group position={[0, 0.25, 0]} rotation={[0.4 + s * 0.25, s * 0.6, 0.2 + s * 0.15]}>
          <mesh geometry={CARD3}>
            <meshStandardMaterial color="#D9D2C4" roughness={0.35} />
          </mesh>
        </group>
      </>
    );
  }
  if (i === 3) {
    const s = w4.time(t);
    return (
      <>
        <Pastel top="#E6F0FF" bottom="#F7E2F1" />
        <hemisphereLight args={["#FFFFFF", "#B5A2EA", 1.6]} />
        <directionalLight position={[-2 + Math.sin(s * 0.5) * 3, 4, 2]} intensity={1.8} color="#FFF0E0" />
        {Array.from({ length: 26 }, (_, k) => {
          const z = 6 - k * 1.1;
          return [-1, 1].map((side) => (
            <mesh key={`${k}${side}`} position={[side * (1.0 + (k % 3) * 0.15), 0.3 + 0.08 * Math.sin(s * 2 + k), z]} rotation={[0, side * -0.5, 0]}>
              <boxGeometry args={[0.7, 0.9, 0.06]} />
              <meshStandardMaterial color={k % 2 ? "#FFFFFF" : "#E8DDFB"} roughness={0.5} />
            </mesh>
          ));
        })}
      </>
    );
  }
  // 5
  if (t < CUT5)
    return (
      <>
        <Pastel top="#F7E4F0" bottom="#E3DAFB" />
        <hemisphereLight args={["#FFFFFF", "#C2A6EE", 1.6]} />
        <directionalLight position={[-2, 3, 4]} intensity={1.6} />
        <Screen />
        <Blocks n={30} seed={8} box={[[-3, -1.2, -4], [3, 1.8, 1.4]]} s={t} />
      </>
    );
  const pop = spring(t, CUT5 + 0.25, 2.4, 0.45);
  return (
    <>
      <Pastel top="#FFF4EC" bottom="#F1E3FA" />
      <hemisphereLight args={["#FFFFFF", "#D2B4E6", 1.6]} />
      <directionalLight position={[-2, 3, 4]} intensity={1.7} />
      <Ribbon path={RIB} draw={pr(t, CUT5, CUT5 + 1.2, E.out)} tail={1} width={0.07} color="#E0283C" />
      <group position={[0, 0.15, 0.2]} scale={Math.max(0.001, pop)}>
        <mesh geometry={PILL5}>
          <meshStandardMaterial color="#34D399" roughness={0.4} />
        </mesh>
      </group>
    </>
  );
};
const RIB = path([[-2, -0.6, -1], [-1, 0.4, -0.2], [0, -0.2, 0.4], [1, 0.5, -0.4], [2, 0, -1.2]]);
const CARD3 = roundedSlab(0.7, 0.45, 0.04, 0.05);
const PILL5 = roundedSlab(0.9, 0.3, 0.12, 0.15);
const SCREEN = roundedSlab(1.6, 0.95, 0.06, 0.06);

const POST: Partial<PostParams>[] = [
  { aperture: 0.35, bloom: 0.2, vignette: 0.2, agx: 0, saturation: 1.05, ca: 0.004 },
  { aperture: 0.4, bloom: 0.25, vignette: 0.2, agx: 0, ca: 0.004 },
  { aperture: 0.9, bloom: 0.35, threshold: 0.7, vignette: 0.55, grain: 0.06, agx: 1, saturation: 0.85, contrast: 0.15 },
  { aperture: 0.2, bloom: 0.2, vignette: 0.2, agx: 0 },
  { aperture: 0.35, bloom: 0.25, vignette: 0.2, agx: 0, ca: 0.005 },
];

export const RigLab: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const fonts = useFonts();
  const i = Math.max(0, seg(t));
  const rig = RIGS[i];
  const flash = i === 4 ? kf(t, [[CUT5 - 0.12, 0], [CUT5, 1, E.in], [CUT5 + 0.2, 0, E.out]]) : i === 1 ? kf(t, [[3.0, 0.6], [3.15, 0, E.out]]) : 0;
  const label = ["fly-through · parallax · ramp-in/out", "bullet time · world 0x · camera 1x", "slow-mo float · world 0.25x", "hyperlapse · world 8x · stride", "ramp-up 1x→2x→hyper · zoom-through · ramp-in"][i];
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <ThreeCanvas width={W} height={H} gl={{ antialias: false, toneMapping: THREE.NoToneMapping, preserveDrawingBuffer: true }} camera={{ fov: 40, near: 0.03, far: 80, position: [0, 0, 5] }}>
        <RigCamera rig={rig} t={t} />
        <Scene t={t} />
        <Post frame={frame} params={() => ({ ...rigPost(rig, t, POST[i]), flash })} />
      </ThreeCanvas>
      {fonts && <div style={{ position: "absolute", left: 40, bottom: 34, fontFamily: FONT.ui, fontSize: 22, color: i === 2 ? "#E9E2D4" : "#2A2140", opacity: 0.75 }}>{label}</div>}
    </AbsoluteFill>
  );
};
