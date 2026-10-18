import React from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { E, FONT, V3, drift, flow, flow3, kf, pr, rand, roundRect, roundedPlane, roundedSlab, useCanvasTex } from "./lib";
import { meshFlow, paintMesh, throughPost } from "./mesh";
import { MESH_CARDS } from "./meshes-a";
import { Cursor } from "./room";
import { velSmear } from "./kit/cursor";
import { Product3D } from "./products3d";

// Shot 4 (4.0–7.04 s): "There's just way too many products." A receding row of product cards with a wave that rises
// toward the cursor; colour drains to grey at ~6 s. Products are drawn (ours), not photos.

type Prod = "headphones" | "shorts" | "nightstand" | "camera" | "dress" | "tote" | "bottle";
const ROW: [Prod, string, string][] = [
  ["headphones", "#E8395A", "$51.99"], ["shorts", "#4E8FD9", "$29.99"], ["nightstand", "#F2C9A8", "$74.99"],
  ["camera", "#2D2A33", "$121.99"], ["dress", "#F07A2E", "$33.99"], ["tote", "#7C5BE0", "$59.99"],
  ["nightstand", "#EFD2B8", "$74.99"], ["dress", "#E85B2A", "$33.99"], ["bottle", "#4B4E8C", "$121.99"],
  ["headphones", "#E84C8A", "$59.99"], ["tote", "#8A63E8", "$51.99"], ["shorts", "#5A9BE0", "$59.99"],
  ["dress", "#F48A3A", "$29.99"], ["headphones", "#E8395A", "$33.99"], ["bottle", "#5B5E9C", "$74.99"],
  ["tote", "#7C5BE0", "$29.99"],
];

const shade = (hex: string, k: number) => {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
};
const grad = (c: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, col: string) => {
  const g = c.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, shade(col, 1.25));
  g.addColorStop(0.55, col);
  g.addColorStop(1, shade(col, 0.7));
  return g;
};

const drawProduct = (c: CanvasRenderingContext2D, p: Prod, col: string, cx: number, cy: number, s: number) => {
  c.save();
  c.translate(cx, cy);
  c.scale(s, s);
  c.shadowColor = "rgba(40,20,60,0.22)";
  c.shadowBlur = 18;
  c.shadowOffsetY = 10;
  c.lineCap = "round";
  if (p === "headphones") {
    c.strokeStyle = grad(c, -90, -110, 90, 0, col);
    c.lineWidth = 26;
    c.beginPath();
    c.arc(0, 10, 92, Math.PI * 1.08, Math.PI * 1.92);
    c.stroke();
    for (const sx of [-1, 1]) {
      c.fillStyle = grad(c, sx * 60, -10, sx * 120, 110, col);
      roundRect(c, sx > 0 ? 58 : -118, -6, 60, 104, 28);
      c.fill();
      c.fillStyle = "#F5C34B";
      roundRect(c, sx > 0 ? 58 : -72, 18, 14, 56, 7);
      c.fill();
    }
  } else if (p === "shorts") {
    c.fillStyle = grad(c, -90, -80, 90, 100, col);
    c.beginPath();
    c.moveTo(-88, -70); c.lineTo(88, -70); c.lineTo(104, 92); c.lineTo(14, 100); c.lineTo(0, 10); c.lineTo(-14, 100); c.lineTo(-104, 92);
    c.closePath(); c.fill();
    c.shadowColor = "transparent";
    c.fillStyle = "#8A5634";
    c.fillRect(-90, -78, 180, 18);
    c.fillStyle = shade(col, 1.35);
    c.fillRect(-100, 78, 88, 14); c.fillRect(12, 78, 88, 14);
  } else if (p === "nightstand") {
    c.fillStyle = grad(c, -90, -90, 90, 110, col);
    roundRect(c, -86, -78, 172, 170, 12); c.fill();
    c.shadowColor = "transparent";
    for (let i = 0; i < 3; i++) {
      c.fillStyle = shade(col, 0.88);
      roundRect(c, -72, -64 + i * 52, 144, 42, 8); c.fill();
      c.fillStyle = "#B98A62";
      roundRect(c, -12, -48 + i * 52, 24, 8, 4); c.fill();
    }
    c.fillStyle = "#F7D25A"; c.fillRect(-60, -98, 50, 20); c.fillStyle = "#9AD0F0"; c.fillRect(10, -94, 40, 16);
  } else if (p === "camera") {
    c.fillStyle = grad(c, -100, -60, 100, 90, "#EDE6DC");
    roundRect(c, -104, -50, 208, 124, 22); c.fill();
    c.fillStyle = grad(c, -100, 0, 100, 90, col);
    roundRect(c, -104, 6, 208, 68, 18); c.fill();
    c.shadowColor = "transparent";
    c.fillStyle = "#1A1820"; c.beginPath(); c.arc(0, 14, 50, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#6E7BB8"; c.beginPath(); c.arc(0, 14, 30, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#F6C343"; roundRect(c, 50, -74, 40, 26, 6); c.fill();
  } else if (p === "dress") {
    c.fillStyle = grad(c, -90, -110, 90, 110, col);
    c.beginPath();
    c.moveTo(-34, -96); c.lineTo(34, -96); c.lineTo(40, -30); c.lineTo(104, 104); c.quadraticCurveTo(0, 124, -104, 104); c.lineTo(-40, -30);
    c.closePath(); c.fill();
    c.shadowColor = "transparent";
    c.strokeStyle = shade(col, 0.8); c.lineWidth = 8;
    c.beginPath(); c.moveTo(-26, -96); c.lineTo(-20, -128); c.moveTo(26, -96); c.lineTo(20, -128); c.stroke();
  } else if (p === "tote") {
    c.strokeStyle = shade(col, 0.85); c.lineWidth = 14;
    c.beginPath(); c.arc(0, -40, 48, Math.PI, 0); c.stroke();
    c.fillStyle = grad(c, -90, -40, 90, 110, col);
    c.beginPath(); c.moveTo(-82, -40); c.lineTo(82, -40); c.lineTo(100, 104); c.lineTo(-100, 104); c.closePath(); c.fill();
    c.shadowColor = "transparent";
    c.fillStyle = "#F4C04C"; roundRect(c, 40, -20, 18, 34, 5); c.fill();
  } else {
    c.fillStyle = grad(c, -60, -110, 60, 110, col);
    roundRect(c, -56, -84, 112, 196, 40); c.fill();
    c.fillStyle = shade(col, 0.75); roundRect(c, -26, -122, 52, 46, 12); c.fill();
  }
  c.restore();
};

const cardTex = (p: Prod, col: string, price: string) => {
  const c = document.createElement("canvas");
  c.width = 520;
  c.height = 660;
  const x = c.getContext("2d")!;
  x.fillStyle = "#FFFFFF";
  roundRect(x, 0, 0, 520, 660, 64);
  x.fill();
  x.strokeStyle = "rgba(120,110,140,0.25)";
  x.lineWidth = 4;
  roundRect(x, 22, 22, 476, 400, 44);
  x.stroke();
  const bg = x.createLinearGradient(0, 22, 0, 420);
  bg.addColorStop(0, "#FBFAFD");
  bg.addColorStop(1, "#F1EEF6");
  x.fillStyle = bg;
  roundRect(x, 24, 24, 472, 396, 42);
  x.fill();
  // the product is a 3D prop on the card (products3d.tsx), not a drawing
  // stars
  for (let i = 0; i < 5; i++) {
    x.fillStyle = i < 4 ? "#F2B33D" : "#D8D3DF";
    x.beginPath();
    for (let k = 0; k < 10; k++) {
      const r = k % 2 ? 9 : 20;
      const a = -Math.PI / 2 + (k * Math.PI) / 5;
      x.lineTo(110 + i * 46 + Math.cos(a) * r, 462 + Math.sin(a) * r);
    }
    x.fill();
  }
  x.fillStyle = "#8C8796";
  x.font = `500 22px ${FONT.ui}`;
  x.fillText("HD surround, best for", 44, 528);
  x.fillText("every day…", 44, 556);
  x.fillStyle = "#18161E";
  x.font = `700 46px ${FONT.ui}`;
  x.textAlign = "right";
  x.fillText(price, 486, 548);
  x.textAlign = "left";
  x.fillStyle = "#1C1A22";
  roundRect(x, 44, 582, 300, 56, 28);
  x.fill();
  x.fillStyle = "#FFFFFF";
  x.font = `600 26px ${FONT.ui}`;
  x.fillText("View Product ↗", 84, 620);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
};

// the backdrop: the ref's measured colour field (MESH_CARDS) on a plane locked to the camera 8 m out (the ref's soft
// gradient stays put on screen while the camera tracks the row), painted through cardsPost's inverse so it lands on
// the measured colours after the saturation drain and grade
const BG_D = 8, BG_FOV = 34;
const BG: React.FC<{ t: number }> = ({ t }) => {
  const ref = React.useRef<THREE.Mesh>(null);
  const { camera } = useThree();
  const p = cardsPost(t);
  const tex = useCanvasTex(512, 288, (c, w, h) => paintMesh(c, w, h, throughPost(meshFlow(MESH_CARDS, t), p)), [Math.round(t * 12)]);
  useFrame(() => {
    const m = ref.current;
    if (!m) return;
    m.position.copy(camera.position);
    m.quaternion.copy(camera.quaternion);
    m.translateZ(-BG_D);
  });
  const bh = 2 * Math.tan(((BG_FOV / 2) * Math.PI) / 180) * BG_D * 1.06;
  return (
    <mesh ref={ref} renderOrder={-1}>
      <planeGeometry args={[(bh * 16) / 9, bh]} />
      <meshBasicMaterial map={tex} toneMapped={false} depthWrite={false} />
    </mesh>
  );
};

// row geometry: card i sits on a line from lower-left (near) to upper-right (far). Solved against ref 5.0 s through the
// fitted camera: card 0 centred at (299, 286) of 960×540 and 135 px wide, card 9 at (857, 172) and 95 px wide
const cardPos = (i: number): V3 => [-0.154 + i * 0.2325, -0.017 + i * 0.0442, -0.3 - i * 0.0954];
const CARD_W = 0.42, CARD_H = 0.533;

// ── camera: held on the 5.0 s camfit pose while the stack arrives, then tracks right ALONG the row (ref 5.0 → 7.0, same
// view direction, a little push-in). One flowing curve (flow3): no stop at any key. ──
const C5: V3 = [0.346, 0.174, 2.385], L5: V3 = [0.405, 0.012, -0.667];
const camPos = (t: number) => flow3(t, [[4.0, [0.343, 0.182, 2.53]], [5.0, C5], [5.5, [0.802, 0.261, 2.198]], [6.0, [1.123, 0.316, 1.967]], [6.6, [1.399, 0.362, 1.755]], [7.05, [1.583, 0.392, 1.581]]]);
// after 5.0 the aim rises a little (ref 6.0–7.0: the row sits mid-frame, ours fell to the lower third)
const camLook = (t: number) => flow3(t, [[4.0, [0.4, 0.02, -0.66]], [5.0, L5], [5.5, [0.861, 0.17, -0.854]], [6.0, [1.18, 0.27, -0.985]], [6.6, [1.454, 0.34, -1.097]], [7.05, [1.636, 0.38, -1.172]]]);
const Cam: React.FC<{ t: number }> = ({ t }) => {
  const { camera } = useThree();
  useFrame(() => {
    const p = camPos(t), l = camLook(t);
    camera.position.set(p[0] + drift(t, 7, 0.01), p[1] + drift(t, 8, 0.006), p[2]);
    camera.lookAt(...l);
    (camera as THREE.PerspectiveCamera).fov = 34;
    (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
  }, -1);
  return null;
};

// ── the stack arrives as ONE piece from the upper right (ref 4.5–5.0: card 0 travels from frame (0.78, 0.20) to
// (0.32, 0.50) as the crest of the wave, ~1.4x, then the crest rolls on to cards 2–3). Offsets solved through the camera. ──
const rowOffset = (t: number) => flow3(t, [[4.2, [3.4, 1.05, 0.0]], [4.42, [2.0, 0.6, 0.05]], [4.583, [1.337, 0.416, 0.1]], [4.667, [0.992, 0.333, 0.15]], [4.75, [0.674, 0.26, 0.2]],
  [4.833, [0.441, 0.16, 0.17]], [4.917, [0.206, 0.09, 0.07]], [5.0, [0.03, 0.04, 0.02]], [5.12, [0, 0, 0]]], true);
const waveAt = (t: number) => flow(t, [[4.4, 0], [4.75, 0.05], [4.833, 0.3], [4.917, 1.2], [5.0, 2.8], [6.0, 6.5], [7.05, 9.6]]);
// the cursor stays put on screen (ref 4.17–5.0 measured), 1.3 m in front of the lens; it flies in from the left smeared
// at 4.08 and shrinks as it settles (frame width 0.2 → 0.065); after 5.0 it rides along with the camera
const curScreen = (t: number) => flow3(t, [[4.04, [-0.62, 0.16, 1.1]], [4.083, [-0.3, 0.15, 1.1]], [4.12, [0.0, 0.13, 1.1]], [4.17, [0.134, 0.122, 1.103]], [4.25, [0.272, 0.145, 1.087]],
  [4.42, [0.329, 0.129, 1.086]], [4.583, [0.539, 0.09, 1.102]], [4.75, [0.56, 0.082, 1.106]], [4.917, [0.497, 0.058, 1.099]], [5.0, [0.427, 0.026, 1.096]],
  [5.6, [0.47, 0.03, 1.1]], [6.3, [0.44, 0.0, 1.1]], [7.05, [0.5, 0.02, 1.1]]]);
const curTrack = (t: number): V3 => {
  const cs = curScreen(t);
  if (t <= 5.0) return cs;
  const c = camPos(t);
  return [cs[0] + c[0] - C5[0], cs[1] + c[1] - C5[1], cs[2] + c[2] - C5[2]];
};
const curScale = (t: number) => flow(t, [[4.04, 3.2], [4.12, 3.0], [4.25, 2.5], [4.42, 1.8], [4.583, 1.5], [4.75, 1.2], [5.0, 1.0], [7.05, 1.0]]);

// a soft violet glow under/behind each card: the ref's row casts a coloured shadow that reads as one violet band along the
// diagonal (ref 5.0–6.0), drained to grey-mauve with the rest at 6.25
const glowTex = (() => {
  let tex: THREE.CanvasTexture | null = null;
  return () => {
    if (tex) return tex;
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const x = c.getContext("2d")!;
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.45, "rgba(255,255,255,0.55)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, 128, 128);
    tex = new THREE.CanvasTexture(c);
    return tex;
  };
})();

export const CardsShot: React.FC<{ t: number; noCam?: boolean }> = ({ t, noCam }) => {
  const geo = React.useMemo(() => roundedPlane(CARD_W, CARD_H, 0.05), []);
  // the card is a real tile: a white rounded slab with thickness, the printed face on its front
  const slab = React.useMemo(() => roundedSlab(CARD_W + 0.01, CARD_H + 0.01, 0.03, 0.055), []);
  React.useEffect(() => () => { geo.dispose(); slab.dispose(); }, [geo, slab]);
  const texes = React.useMemo(() => ROW.map(([p, c, pr2]) => cardTex(p, c, pr2)), []);
  const wc = waveAt(t);
  const off = rowOffset(t);
  const cur = curTrack(t); // screen-locked (moves with the camera after 5.0)
  return (
    <>
      {!noCam && <Cam t={t} />}
      <color attach="background" args={["#D9CCF5"]} />
      <BG t={t} />
      <ambientLight intensity={1.4} color="#FFFFFF" />
      <directionalLight position={[-2, 3, 4]} intensity={1.6} />
      <group position={off}>
        {ROW.map((_, i) => {
          const base = cardPos(i);
          const d = i - wc;
          const bump = Math.exp(-(d * d) / 3.2);
          const sc = 0.94 + bump * 0.48;
          // grow from the bottom edge (the crest rises, its base stays on the row line)
          const pos: V3 = [base[0], base[1] + (sc - 1) * CARD_H * 0.5 + Math.sin(t * 2.2 + i * 0.7) * 0.008, base[2] + bump * 0.08];
          const ry = -0.12 + bump * 0.2 + drift(t, i, 0.02); // ref: faces almost square to the lens
          return (
            <group key={i} position={pos} rotation={[0.02, ry, 0.01 * Math.sin(i)]} scale={sc}>
              {/* ref: lavender-white tiles (the violet light wraps them), not paper white */}
              <mesh geometry={slab}>
                <meshStandardMaterial color="#E8E0F7" roughness={0.45} />
              </mesh>
              <mesh geometry={geo} position={[0, 0, 0.0155]}>
                <meshBasicMaterial map={texes[i]} color="#F2ECFC" toneMapped={false} transparent />
              </mesh>
              <mesh position={[0.04, -CARD_H * 0.42, -0.09]} scale={[CARD_W * 2.1, CARD_H * 1.15, 1]} renderOrder={0}>
                <planeGeometry args={[1, 1]} />
                <meshBasicMaterial map={glowTex()} color="#7E62F2" transparent opacity={0.55} depthWrite={false} toneMapped={false} />
              </mesh>
              <group position={[0, CARD_H * 0.5 - (230 / 660) * CARD_H, 0.05]}>
                {/* ref: the product sits inside the card's picture area, it does not stand out above the card */}
                <Product3D kind={ROW[i][0]} color={ROW[i][1]} s={1.05} rot={[0.15, 0.5 + Math.sin(t * 1.4 + i) * 0.12, 0]} />
              </group>
            </group>
          );
        })}
      </group>
      {/* the ref's arrow: black with a white bevelled rim, pointing up-right; smeared while it flies in; dips on the click */}
      {t >= 4.083 && <Cursor
        variant="mac"
        pos={cur}
        rot={[0.12 - pr(t, 5.0, 5.08) * 0.2 + pr(t, 5.08, 5.25) * 0.2, 0.15 + drift(t, 3, 0.08), 0.87 + drift(t, 9, 0.08)]}
        scale={curScale(t)}
        shadow={0.5}
        {...velSmear(curTrack, t)}
      />}
    </>
  );
};

export const cardsPost = (t: number) => ({
  // focus: on the cursor while it flies in, then racks to the wave crest (the near cards sharp, the far row soft)
  focus: flow(t, [[4.0, 1.25], [4.4, 1.35], [4.6, 2.3], [5.0, 3.0], [7.05, 2.9]]),
  aperture: 0.35,
  bloom: 0.18,
  threshold: 0.85,
  blurDir: [kf(t, [[4.0, 0.012], [4.3, 0]]), 0] as [number, number],
  zoomBlur: 0,
  vignette: 0.2,
  grain: 0.03,
  flash: kf(t, [[4.0, 0.35], [4.15, 0, E.out]]),
  exposure: 1.0,
  saturation: kf(t, [[5.8, 1.05], [6.3, 0.3, E.inOut]]),
  contrast: 0.04,
  ca: 0.005,
  agx: 0,
  // grade fitted to ref frames 127/150 with styles/tools/s3_grade.py
  gain: [1.269, 1.299, 1.386] as [number, number, number],
  lift: [-0.183, -0.203, -0.327] as [number, number, number],
});
