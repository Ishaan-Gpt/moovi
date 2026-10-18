import React from "react";
import * as THREE from "three";
import {
  Blinds, Blocks, BokehSprites, Books, Bulbs, Cable, CityLights, Dust, Env, Film, FilmShot, Finish, Floor, Frames, Glare, Haze, Keyboard, DeskLamp, LightShafts,
  Monitor, Mug, Papers, Pegboard, Plant, Practical, Rain, RigCamera, RingLight, Shelf, curveS, keys, mat, pathRig, rigPost, roundedSlab, travel, useCanvasTex,
} from "../kit";

// Style 3 LOOK LAB (skill style-3-build §1): three one-second worlds built ONLY from kit parts, to prove that a rich,
// lit, finished frame needs no bespoke modelling. Copy a world's recipe into a film, then replace its props with the
// film's own. Stills: node scripts/stills.mjs S3LookLab <dir> 12,36,60 --scale 0.5
//   0-1 s  creator's room, pastel register (window sun through blinds, LED strip, ring light, 40+ objects)
//   1-2 s  night-city penthouse, dark register (lamp key, city rim, rain on glass, bokeh)
//   2-3 s  candy studio, B register (neon practicals, glossy hero, bulbs, halftone finish)
// What the stills proved (2026-10-12, styles/style-3/renders/looklab/): the room reads as a place once the window
// gobo (Blinds between a LOW sun and the wall) rakes bands across wall and desk, the fill stays <= 1:5 and the grade
// sets a black point (curveS 0.07); the night world is the strongest (one warm practical as the key, a cyan city rim,
// bokeh + rain + glare); the candy world is the weakest on this renderer (a glossy floor without real reflections stays
// milky): for a B-register film give the gloss a Blender plate (style-3-build §7) or a darker cyc with the tubes as the
// only bright things.
export const LOOKLAB_SECONDS = 3;

// ── 1 · creator's room (pastel) ───────────────────────────────────────────────────────────────────────────────────
const P1 = { wall: "#F2B6A4", wallDark: "#D98E7E", floor: "#C9A58A", desk: "#D9A676", cream: "#FFF3E8", pink: "#F6A7C2", lav: "#C9B6F5", mint: "#BFEBDD", ink: "#2A2630" };
const rig1 = pathRig({ path: [[0.42, 1.28, 2.45], [0.18, 1.2, 2.05]], look: [[0.02, 1.0, -0.2], [0.0, 0.98, -0.25]], move: travel({ t0: 0, t1: 1, floor: 1 }), lens: 35, roll: keys([[0, -0.02], [1, 0.015]]), handheld: { amp: 0.004, seed: 1 } });
const DESK = roundedSlab(1.9, 0.04, 0.8, 0.02, 0.006);
const DRAWER = roundedSlab(0.42, 0.62, 0.7, 0.02, 0.006);
const Room1: React.FC<{ t: number }> = ({ t }) => {
  const s = t;
  // the screen carries a drawn stand-in UI (a film puts the product's REAL output here via useAtlas / useImages)
  const ui = useCanvasTex(1200, 675, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, "#FFE9F4");
    g.addColorStop(1, "#E7DBFF");
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    c.fillStyle = "#FFFFFF";
    c.fillRect(60, 70, 760, 520);
    c.fillStyle = "#2A2630";
    c.fillRect(60, 70, 760, 44);
    ["#F6A7C2", "#C9B6F5", "#BFEBDD", "#FFD9B0"].forEach((col, i) => { c.fillStyle = col; c.fillRect(860, 70 + i * 128, 280, 110); });
    c.fillStyle = "#D9257C";
    c.font = "700 64px sans-serif";
    c.fillText("real output here", 120, 360);
    c.fillStyle = "#2A2630";
    c.font = "500 30px sans-serif";
    c.fillText("the product's own media, never faked", 120, 420);
  }, []);
  const screen = React.useMemo(() => new THREE.MeshBasicMaterial({ map: ui, color: new THREE.Color(1.25, 1.25, 1.25), toneMapped: false }), [ui]);
  React.useEffect(() => () => screen.dispose(), [screen]);
  return (
    <>
      <RigCamera rig={rig1} t={t} />
      <Env intensity={0.3} />
      <Haze color={P1.wall} near={7} far={22} />
      {/* key: a low warm sun through the blinds (the gobo), a second steeper soft sun, a lavender fill, a screen practical */}
      <directionalLight position={[-3.6, 1.1, 1.3]} intensity={4.2} color="#FFD3A0" castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} shadow-bias={-0.0003} shadow-normalBias={0.012} shadow-radius={5}
        shadow-camera-left={-3.5} shadow-camera-right={3.5} shadow-camera-top={4} shadow-camera-bottom={-1.5} shadow-camera-near={0.5} shadow-camera-far={14} />
      <directionalLight position={[-1.5, 4.5, 2.5]} intensity={0.3} color="#FFE6D2" />
      <hemisphereLight args={["#F0DCFF", "#8E6A9A", 0.3]} />
      <pointLight position={[1.4, 1.9, -0.6]} intensity={2.2} color="#F0A0FF" distance={4} decay={1.8} />
      <Blinds pos={[-2.75, 2.15, -0.05]} w={2.0} h={2.2} n={16} tilt={0.45} rot={[0, Math.PI / 2, 0]} />
      {/* set: wall, floor, desk with a drawer unit, a rug */}
      <mesh position={[0, 1.4, -0.95]} material={mat("matte", P1.wall)} receiveShadow><boxGeometry args={[7, 2.9, 0.1]} /></mesh>
      <Floor y={0} size={16} color={P1.floor} kind="matte" />
      <mesh position={[0.1, 0.005, 0.9]} rotation={[-Math.PI / 2, 0, 0]} material={mat("velvet", "#B98AC8")} receiveShadow><planeGeometry args={[2.2, 1.6]} /></mesh>
      <mesh geometry={DESK} material={mat("satin", P1.desk)} position={[0, 0.74, -0.35]} castShadow receiveShadow />
      <mesh geometry={DRAWER} material={mat("satin", P1.desk)} position={[0.72, 0.4, -0.35]} castShadow receiveShadow />
      {[-0.85, 0.85].map((x) => <mesh key={x} material={mat("matte", P1.ink)} position={[x, 0.36, -0.35]} castShadow><boxGeometry args={[0.04, 0.72, 0.6]} /></mesh>)}
      {/* the hero: the monitor (the product's real output goes on this face), with the LED strip glow above it */}
      <mesh geometry={roundedSlab(0.5, 0.06, 0.26, 0.01, 0.004)} material={mat("satin", P1.cream)} position={[0, 0.79, -0.55]} castShadow receiveShadow />
      <Monitor pos={[0, 0.82, -0.55]} w={0.6} face={screen} bezel="#1C1A22" glow={2.4} glowColor="#FFE6F4" />
      <Practical pos={[0, 1.62, -0.86]} kind="tube" length={1.2} size={0.006} color="#FFB37A" intensity={3.2} glare={0.08} rotation={[0, 0, Math.PI / 2]} distance={2.6} emissive={2.6} />
      <Shelf pos={[0, 1.66, -0.78]} w={1.4} d={0.2} color="#B98556" />
      <Shelf pos={[0.2, 2.08, -0.78]} w={1.1} d={0.2} color="#B98556" />
      <Books at={[-0.62, 1.68, -0.8]} n={8} palette={[P1.pink, P1.lav, P1.mint, "#2F3B5C", P1.cream, "#E2B04B"]} seed={2} />
      <Books at={[0.35, 2.1, -0.8]} n={4} dir="y" palette={["#2F3B5C", P1.pink, P1.cream]} seed={4} size={0.9} />
      <Plant pos={[0.72, 2.1, -0.8]} s={0.8} pot={P1.mint} leaf="#4F9A6E" seed={2} />
      <Plant pos={[-1.05, 0.76, -0.6]} s={1.3} pot={P1.pink} leaf="#5AA87A" seed={5} n={13} />
      <Mug pos={[0.52, 0.76, -0.2]} color={P1.lav} s={1.1} rot={0.6} />
      <Mug pos={[-0.95, 1.68, -0.8]} color={P1.pink} s={0.8} />
      <Frames at={[0.95, 1.9, -0.89]} n={2} palette={[P1.pink, P1.lav, "#FFD9B0", "#2F3B5C"]} frame={P1.cream} seed={3} sizes={[[0.26, 0.34], [0.34, 0.26]]} />
      <Pegboard pos={[-1.7, 1.75, -0.89]} w={0.8} h={0.6} color="#F6C9B8" dot="#D99A86" tools={5} />
      <Keyboard pos={[-0.05, 0.76, -0.12]} rot={0.04} body="#F7DCE3" cap="#FFF7F9" accent="#D9257C" />
      <mesh geometry={roundedSlab(0.06, 0.03, 0.1, 0.015, 0.004)} material={mat("gloss", P1.pink)} position={[0.3, 0.775, -0.1]} castShadow />
      <Papers box={[[-0.8, 0.762, -0.3], [-0.45, 0.762, 0.05]]} n={3} seed={7} />
      <DeskLamp pos={[-0.72, 0.76, -0.58]} color="#2F3B5C" rot={0.5} tilt={1.0}>
        <Practical pos={[0, 0.05, 0]} color="#FFD8A0" intensity={1.8} size={0.02} glare={0.22} distance={1.6} />
      </DeskLamp>
      <RingLight pos={[1.35, 1.75, 0.25]} r={0.17} color="#FFF1DD" on={1}>
        <Practical pos={[0, 0, 0]} color="#FFF1DD" intensity={1.6} size={0.0} glare={0.3} distance={2.2} />
      </RingLight>
      <mesh material={mat("satin", "#2A2A30")} position={[0.95, 1.05, -0.3]} castShadow><cylinderGeometry args={[0.012, 0.012, 0.5, 12]} /></mesh>
      <mesh material={mat("brushed", "#D9B38C")} position={[0.95, 1.32, -0.3]} castShadow><capsuleGeometry args={[0.03, 0.08, 6, 14]} /></mesh>
      <Cable from={[0.55, 0.76, -0.45]} to={[0.72, 0.0, -0.1]} sag={0.08} />
      <Cable from={[-0.3, 0.76, -0.5]} to={[0.95, 0.9, -0.3]} sag={0.14} color="#F4EFE6" />
      {[-0.5, 0.5].map((x) => (
        <group key={x} position={[x * 0.9 + 0.1, 0, -0.62]}>
          <mesh geometry={roundedSlab(0.16, 0.24, 0.16, 0.02, 0.005)} material={mat("satin", x < 0 ? P1.cream : P1.pink)} position={[0, 0.9, 0]} castShadow />
          <mesh material={mat("matte", P1.ink)} position={[0, 0.92, 0.081]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.05, 0.05, 0.01, 24]} /></mesh>
        </group>
      ))}
      {/* foreground: the chair back, soft, between the lens and the desk */}
      <mesh geometry={roundedSlab(0.5, 0.5, 0.06, 0.06, 0.01)} material={mat("velvet", "#E0583A")} position={[-0.55, 0.95, 1.55]} rotation={[0.08, 0.35, 0]} castShadow />
      <mesh material={mat("velvet", "#E0583A")} position={[-0.55, 0.45, 1.5]} rotation={[0, 0.35, 0]} castShadow><boxGeometry args={[0.5, 0.08, 0.5]} /></mesh>
      <Dust n={140} box={[[-1.6, 0.4, -0.8], [1.2, 2.2, 1.2]]} s={s} color="#FFE4C4" opacity={0.5} />
      <LightShafts from={[-2.6, 2.4, 1.4]} dir={[1, -0.45, -0.55]} n={4} length={5} width={0.22} spread={0.9} opacity={0.07} s={s} />
    </>
  );
};
const post1 = (t: number) => rigPost(rig1, t, { aperture: 0.38, bloom: 0.3, threshold: 0.8, vignette: 0.28, grain: 0.03, saturation: 1.15, contrast: 0.1, ca: 0.005, agx: 1, exposure: 1.0, curves: curveS(0.07, 0.35) }, { blurGain: 0.15 });

// ── 2 · night-city penthouse (dark) ───────────────────────────────────────────────────────────────────────────────
const P2 = { night: "#0A1324", teal: "#0F2A33", desk: "#2A2320", amber: "#FFB45E", cyan: "#6FD8FF", bone: "#F2E8D5" };
const rig2 = pathRig({ path: [[-0.9, 1.25, 2.1], [-0.55, 1.18, 1.75]], look: [[0.15, 0.98, -0.3], [0.1, 0.96, -0.35]], move: travel({ t0: 1, t1: 2, floor: 1 }), lens: 40, roll: keys([[1, 0.03], [2, -0.01]]), handheld: { amp: 0.004, seed: 2 } });
const LAP = roundedSlab(0.34, 0.012, 0.23, 0.01, 0.003);
const LID = roundedSlab(0.34, 0.22, 0.008, 0.01, 0.002);
const Room2: React.FC<{ t: number }> = ({ t }) => {
  const s = t - 1;
  const ui = useCanvasTex(1240, 760, (c, w, h) => {
    c.fillStyle = "#0E1A2B";
    c.fillRect(0, 0, w, h);
    c.fillStyle = "#13263D";
    c.fillRect(0, 0, w, 64);
    c.fillStyle = "#1B3350";
    c.fillRect(40, 110, 360, 600);
    for (let i = 0; i < 9; i++) { c.fillStyle = i % 3 ? "#1F3C5C" : "#2E86C1"; c.fillRect(70, 150 + i * 60, 300, 32); }
    c.fillStyle = "#0A1420";
    c.fillRect(440, 110, 760, 430);
    const g = c.createLinearGradient(440, 110, 1200, 540);
    g.addColorStop(0, "#1E3E66");
    g.addColorStop(1, "#6FD8FF");
    c.fillStyle = g;
    c.fillRect(440, 110, 760, 430);
    c.fillStyle = "#FFFFFF";
    c.font = "700 54px sans-serif";
    c.fillText("real output here", 480, 600);
    c.fillStyle = "#9FD8FF";
    c.font = "500 28px sans-serif";
    c.fillText("the product's own media on every screen", 480, 650);
  }, []);
  const screen = React.useMemo(() => new THREE.MeshBasicMaterial({ map: ui, color: new THREE.Color(1.15, 1.15, 1.15), toneMapped: false }), [ui]);
  React.useEffect(() => () => screen.dispose(), [screen]);
  return (
    <>
      <RigCamera rig={rig2} t={t} />
      <Env intensity={0.25} />
      <Haze color={P2.night} near={6} far={30} />
      {/* key: the desk lamp (warm, practical); rim: the city (cyan); fill: almost nothing */}
      <hemisphereLight args={["#1E3A52", "#05080F", 0.5]} />
      <pointLight position={[1.6, 1.3, -1.6]} intensity={5} color={P2.cyan} distance={6} decay={1.7} />
      <Floor y={0} size={20} color="#15110F" kind="gloss" />
      <mesh position={[0, 1.5, -2.4]} material={mat("glass", "#9ED6F0", { opacity: 0.18 })} ><planeGeometry args={[9, 3.2]} /></mesh>
      {[-1.2, 1.2].map((x) => <mesh key={x} material={mat("matte", "#1B1A22")} position={[x, 1.5, -2.38]}><boxGeometry args={[0.05, 3.2, 0.06]} /></mesh>)}
      <mesh material={mat("matte", "#1B1A22")} position={[0, 3.05, -2.38]}><boxGeometry args={[9, 0.12, 0.08]} /></mesh>
      <CityLights origin={[0.5, -2, -9]} width={30} depths={[0, -9, -20]} blocks={14} seed={8} colors={["#FFC978", "#FFF0D0", "#8ED3FF", "#FF8FB8"]} sky="#070C18" s={s} density={0.5} />
      <Rain n={160} box={[[-3, -0.5, -2.3], [3, 3, -2.2]]} s={s} speed={1.8} length={0.1} opacity={0.3} />
      <mesh geometry={roundedSlab(1.6, 0.035, 0.7, 0.015, 0.005)} material={mat("satin", P2.desk)} position={[0.1, 0.74, -0.5]} castShadow receiveShadow />
      {[-0.7, 0.9].map((x) => <mesh key={x} material={mat("matte", "#141216")} position={[x, 0.36, -0.5]} castShadow><boxGeometry args={[0.04, 0.72, 0.55]} /></mesh>)}
      <group position={[0.15, 0.758, -0.42]} rotation={[0, -0.12, 0]}>
        <mesh geometry={LAP} material={mat("brushed", "#8E8F96")} castShadow />
        <Keyboard pos={[0, 0.004, 0.02]} body="#6E6F76" cap="#2E2E34" accent={P2.amber} cols={12} rows={4} />
        <group position={[0, 0.006, -0.11]} rotation={[-0.3, 0, 0]}>
          <mesh geometry={LID} material={mat("brushed", "#8E8F96")} position={[0, 0.11, 0]} castShadow />
          <mesh material={screen} position={[0, 0.11, 0.0045]}><planeGeometry args={[0.31, 0.19]} /></mesh>
          <pointLight position={[0, 0.11, 0.2]} intensity={1.6} color="#BFEFFF" distance={1.4} decay={1.8} />
        </group>
      </group>
      <DeskLamp pos={[0.72, 0.758, -0.72]} color="#1E1E24" rot={-0.9} tilt={1.15}>
        <Practical pos={[0, 0.05, 0]} color={P2.amber} intensity={9} size={0.022} glare={0.42} distance={3.2} shadow />
      </DeskLamp>
      <Mug pos={[-0.35, 0.758, -0.3]} color="#2F3B5C" s={1.1} rot={-0.5} />
      <mesh geometry={roundedSlab(0.072, 0.008, 0.15, 0.012, 0.003)} material={mat("satin", "#15131A")} position={[-0.12, 0.762, -0.22]} rotation={[0, 0.4, 0]} castShadow />
      <mesh geometry={roundedSlab(0.16, 0.012, 0.21, 0.01, 0.003)} material={mat("velvet", "#3B2A4A")} position={[-0.6, 0.764, -0.3]} rotation={[0, -0.2, 0]} castShadow />
      <group position={[-1.75, 0, -1.55]}>
        <mesh material={mat("matte", "#17151C")} position={[0, 0.9, 0]} castShadow receiveShadow><boxGeometry args={[0.7, 1.8, 0.3]} /></mesh>
        {[0.42, 0.98, 1.54].map((y) => <mesh key={y} material={mat("satin", "#2A2320")} position={[0, y, 0.0]} castShadow><boxGeometry args={[0.66, 0.025, 0.3]} /></mesh>)}
        <Books at={[-0.3, 0.43, 0.02]} n={7} palette={["#3A2A4A", "#5A3A2A", "#E2B04B", "#1F3A4A", "#8A2E3C"]} seed={11} size={0.85} />
        <Books at={[-0.3, 0.99, 0.02]} n={6} palette={["#1F3A4A", "#8A2E3C", "#3A2A4A", "#E2B04B"]} seed={13} size={0.8} />
        <Mug pos={[0.18, 1.57, 0.02]} color="#8A2E3C" s={0.9} />
        <mesh geometry={roundedSlab(0.1, 0.16, 0.1, 0.02, 0.004)} material={mat("gloss", "#E2B04B")} position={[-0.15, 1.64, 0.02]} castShadow />
      </group>
      <mesh geometry={roundedSlab(1.2, 0.42, 0.55, 0.08, 0.01)} material={mat("velvet", "#1B2236")} position={[3.4, 0.21, -1.4]} rotation={[0, -0.4, 0]} castShadow receiveShadow />
      <Papers box={[[-0.6, 0.76, -0.75], [-0.2, 0.76, -0.45]]} n={3} seed={9} color="#E9E1D2" ink="#7A7F8C" />
      <Books at={[-0.65, 0.76, -0.6]} n={3} dir="y" palette={["#3A2A4A", "#5A3A2A", "#E2B04B"]} seed={6} size={0.8} />
      <Plant pos={[-1.05, 0.0, -1.4]} s={2.4} pot="#1F1C24" leaf="#2F6B4F" seed={8} n={15} droop={0.5} />
      <mesh geometry={roundedSlab(0.08, 0.14, 0.08, 0.02, 0.004)} material={mat("gloss", P2.amber)} position={[0.55, 0.83, -0.25]} castShadow />
      <Cable from={[0.5, 0.76, -0.66]} to={[0.9, 0.0, -0.35]} sag={0.1} />
      {/* foreground: the chair back, silhouetted */}
      <mesh geometry={roundedSlab(0.52, 0.5, 0.05, 0.05, 0.01)} material={mat("velvet", "#1A1F2E")} position={[-0.95, 0.95, 0.95]} rotation={[0.06, 0.5, 0]} castShadow />
      <BokehSprites n={18} box={[[-2.2, 0.2, -1.6], [1.6, 2.4, 0.6]]} s={s} size={[0.05, 0.16]} colors={["#FFC978", "#8ED3FF", "#FFE7C4"]} opacity={0.22} />
      <Dust n={90} box={[[-0.6, 0.7, -1.0], [1.2, 1.6, 0.2]]} s={s} color="#FFD9A0" opacity={0.4} size={0.009} />
      <Glare pos={[1.6, 1.3, -1.6]} color={P2.cyan} size={0.9} opacity={0.25} />
    </>
  );
};
const post2 = (t: number) => rigPost(rig2, t, { aperture: 0.75, bloom: 0.38, threshold: 0.66, vignette: 0.5, grain: 0.05, saturation: 0.95, contrast: 0.1, ca: 0.008, agx: 1, exposure: 1.05, curves: curveS(0.03, 0.2) }, { blurGain: 0.15 });

// ── 3 · candy studio (register B) ─────────────────────────────────────────────────────────────────────────────────
const P3 = { cyc: "#F1D3E8", magenta: "#FF3FA8", cyan: "#4FE0FF", mint: "#5CE0B8", lilac: "#C9B6F5", cherry: "#FF4D6D", white: "#FFFFFF", ink: "#2A2235" };
const rig3 = pathRig({ path: [[1.3, 0.9, 2.6], [0.9, 0.75, 2.2]], look: [[0.05, 0.55, 0], [0.0, 0.5, 0]], move: travel({ t0: 2, t1: 3, floor: 1 }), lens: 40, roll: keys([[2, -0.06], [3, 0.04]]), handheld: { amp: 0.005, seed: 3 } });
const Studio3: React.FC<{ t: number }> = ({ t }) => {
  const s = t - 2;
  const spin = s * 0.6;
  const cyc = useCanvasTex(64, 512, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#C94FB4");
    g.addColorStop(0.4, "#E58BD4");
    g.addColorStop(0.75, "#F5C9E8");
    g.addColorStop(1, "#FBE6F4");
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  }, []);
  const cycMat = React.useMemo(() => new THREE.MeshBasicMaterial({ map: cyc, toneMapped: false }), [cyc]);
  React.useEffect(() => () => cycMat.dispose(), [cycMat]);
  return (
    <>
      <RigCamera rig={rig3} t={t} />
      <Env intensity={0.5} />
      <Haze color={P3.cyc} near={8} far={30} />
      <hemisphereLight args={["#FFFFFF", "#D9A8E0", 0.35]} />
      <pointLight position={[-1.2, 1.4, -0.8]} intensity={6} color={P3.cyan} distance={5} decay={1.8} />
      <directionalLight position={[1.5, 4, 3]} intensity={1.0} color="#FFF4FA" castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} shadow-bias={-0.0003} shadow-normalBias={0.01} shadow-radius={6}
        shadow-camera-left={-3} shadow-camera-right={3} shadow-camera-top={3} shadow-camera-bottom={-1} />
      <Floor y={0} size={30} color="#F0BFDD" kind="satin" />
      <mesh position={[0, 1.5, -3.2]} material={cycMat}><planeGeometry args={[16, 5]} /></mesh>
      {/* practicals in frame: three neon tubes + a bulb string; the floor and the hero reflect them */}
      <Practical pos={[-1.05, 0.8, -1.0]} kind="tube" length={1.6} size={0.03} color={P3.magenta} intensity={18} glare={0.9} rotation={[0, 0, 0.1]} distance={6} emissive={3} />
      <Practical pos={[1.15, 0.7, -0.85]} kind="tube" length={1.3} size={0.03} color={P3.cyan} intensity={16} glare={0.8} rotation={[0, 0, -0.16]} distance={6} emissive={3} />
      <Practical pos={[0.1, 1.45, -1.5]} kind="tube" length={2.8} size={0.015} color={P3.mint} intensity={9} glare={0.5} rotation={[0, 0, Math.PI / 2]} distance={6} emissive={2.6} />
      <Bulbs points={[[-2.2, 1.9, -1.8], [-0.8, 1.35, -1.6], [0.6, 1.65, -1.7], [2.0, 1.2, -1.5]]} n={16} color="#FFD38A" s={s} />
      {[[-1.05, -1.0], [1.15, -0.85]].map(([x, z]) => <mesh key={x} material={mat("matte", P3.ink)} position={[x, 0.0, z]} castShadow><cylinderGeometry args={[0.07, 0.09, 0.03, 24]} /></mesh>)}
      {/* the hero: a candy capsule on a chrome ring over a glossy plinth, lilac slabs around it */}
      <group position={[0, 0.52, 0]} rotation={[0.1, spin, 0.05]}>
        <mesh material={mat("candy", P3.cherry)} castShadow><capsuleGeometry args={[0.16, 0.22, 8, 32]} /></mesh>
        <mesh material={mat("chrome", "#E8E8F0")} rotation={[Math.PI / 2 + 0.3, 0, 0]} castShadow><torusGeometry args={[0.3, 0.025, 16, 64]} /></mesh>
      </group>
      <mesh material={mat("gloss", P3.white)} position={[0, 0.1, 0]} castShadow receiveShadow><cylinderGeometry args={[0.36, 0.4, 0.2, 48]} /></mesh>
      {[[-0.75, 0.36, 0.3, 0.3], [0.8, 0.3, -0.2, -0.5], [0.55, 0.9, -0.7, 0.9], [-0.5, 1.0, -0.4, -0.2]].map(([x, y, z, r], i) => (
        <mesh key={i} geometry={roundedSlab(0.34, 0.22, 0.05, 0.04, 0.006)} material={mat(i % 2 ? "candy" : "gloss", i % 2 ? P3.lilac : P3.mint)} position={[x, y, z]} rotation={[0.2, r, 0.1 + s * 0.1]} castShadow />
      ))}
      <Blocks n={18} seed={12} box={[[-3, 0.1, -2.6], [3, 2.4, -1.4]]} colors={[P3.lilac, P3.mint, "#FFD1E8", P3.white]} size={[0.1, 0.3]} s={s} />
      <Blocks n={5} seed={13} box={[[-1.4, -0.1, 1.2], [1.6, 1.2, 1.9]]} colors={[P3.magenta, P3.lilac]} size={[0.08, 0.2]} s={s} />
      <Mug pos={[0.95, 0.0, 0.7]} color={P3.cyan} s={2.2} rot={0.4} />
      <Plant pos={[-1.9, 0, 0.2]} s={2.6} pot={P3.lilac} leaf="#4FB58A" seed={4} n={14} />
      <Dust n={120} box={[[-2, 0.2, -1.5], [2, 2.3, 1.2]]} s={s} color="#FFFFFF" opacity={0.35} size={0.01} />
    </>
  );
};
const post3 = (t: number) => rigPost(rig3, t, { aperture: 0.32, bloom: 0.3, threshold: 0.74, vignette: 0.22, grain: 0.03, saturation: 1.3, contrast: 0.08, ca: 0.005, agx: 1, exposure: 0.95, curves: curveS(0.08, 0.4) }, { blurGain: 0.15 });

const SHOTS: FilmShot[] = [
  { id: "room", t0: 0, t1: 1, scene: (t) => <Room1 t={t} />, post: post1 },
  { id: "night", t0: 1, t1: 2, scene: (t) => <Room2 t={t} />, post: post2 },
  { id: "candy", t0: 2, t1: 3, scene: (t) => <Studio3 t={t} />, post: post3 },
];
const FinishLayer: React.FC<{ t: number }> = ({ t }) => <Finish t={t} preset={t < 1 ? "pastel" : t < 2 ? "dark" : "candy"} params={t >= 2 ? { halftone: 0.22 } : t < 1 ? { leaks: 0.18 } : undefined} />;

export const LookLab: React.FC = () => <Film shots={SHOTS} overlays={[FinishLayer]} shadows="soft" bg="#000" camera={{ fov: 30, near: 0.03, far: 80, position: [0, 1, 3] }} />;

