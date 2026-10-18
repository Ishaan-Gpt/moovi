import React from "react";
import * as THREE from "three";
import { E, FONT, V3, drift, kf, kf3, pr, roundRect, roundedPlane } from "../lib";
import { Cursor } from "../room";
import { RigCamera, rigPost } from "../rig";
import { DEPTH, LOOKS as SHOT, looksRig } from "./cams";
import { DepthLayers } from "./decor";
import { BRAND, LOOKS, LOOK_NAMES, useAtlas } from "./shared";

// Shot 4 (4.3–7.4 s) "Thirty-plus viral looks. Pick yours.": a receding wave of look cards playing the real looks.
// Camera: cams.ts looksRig (truck right along the row; ramp-in on "30+", spike on "yours", ramp-up into the cut).
export const LOOKS_T0 = SHOT.t0;
const N = 16;
const PICK = 6; // the card the cursor picks
const CW = 0.62, CH = 0.5;

const cardChrome = (i: number) => {
  const [name, list] = LOOK_NAMES[i % LOOK_NAMES.length];
  const c = document.createElement("canvas");
  c.width = 620;
  c.height = 500;
  const x = c.getContext("2d")!;
  x.fillStyle = "#FFFFFF";
  roundRect(x, 0, 0, 620, 500, 48);
  x.fill();
  // the video window is a separate mesh; leave a dark hole behind it
  x.fillStyle = "#1A1822";
  roundRect(x, 24, 24, 572, 232, 30);
  x.fill();
  x.font = `700 40px ${FONT.sans}`;
  x.fillStyle = "#1C1A24";
  x.fillText(name, 34, 318);
  x.font = `600 22px ${FONT.ui}`;
  const tag = list === "Viral" ? "● Viral" : "★ Popular";
  const tw = x.measureText(tag).width + 34;
  x.fillStyle = list === "Viral" ? "#FFE6C7" : "#DDF7EC";
  roundRect(x, 34, 340, tw, 42, 21);
  x.fill();
  x.fillStyle = list === "Viral" ? "#B5600F" : "#147A55";
  x.fillText(tag, 51, 369);
  x.fillStyle = "#1C1A24";
  roundRect(x, 34, 408, 250, 62, 31);
  x.fill();
  x.fillStyle = "#FFFFFF";
  x.font = `600 26px ${FONT.ui}`;
  x.fillText("Use look ↗", 66, 448);
  x.fillStyle = "#EFEAF7";
  roundRect(x, 470, 408, 116, 62, 31);
  x.fill();
  x.fillStyle = "#6B6480";
  x.font = `600 22px ${FONT.ui}`;
  x.fillText("Preview", 486, 446);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
};

const Bg = () => {
  const tex = React.useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 1024;
    c.height = 576;
    const x = c.getContext("2d")!;
    x.fillStyle = "#D8CCF6";
    x.fillRect(0, 0, 1024, 576);
    const blob = (cx: number, cy: number, r: number, col: string) => {
      const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, col);
      g.addColorStop(1, "rgba(216,204,246,0)");
      x.fillStyle = g;
      x.fillRect(0, 0, 1024, 576);
    };
    blob(160, 110, 420, "rgba(255,201,140,0.95)");
    blob(860, 120, 380, "rgba(150,230,200,0.85)");
    blob(620, 540, 440, "rgba(140,110,240,0.9)");
    blob(60, 540, 300, "rgba(255,255,255,0.7)");
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  return (
    <mesh position={[0, 0, -6]}>
      <planeGeometry args={[22, 12.4]} />
      <meshBasicMaterial map={tex} toneMapped={false} />
    </mesh>
  );
};

const cardPos = (i: number): V3 => [-1.1 + i * 0.25, -0.34 + i * 0.05, 0.3 - i * 0.17];

export const LooksShot: React.FC<{ t: number }> = ({ t }) => {
  const tiles = useAtlas(LOOKS, 4, 3);
  const geo = React.useMemo(() => roundedPlane(CW, CH, 0.048), []);
  const back = React.useMemo(() => roundedPlane(CW + 0.014, CH + 0.014, 0.054), []);
  const vid = React.useMemo(() => roundedPlane(CW * 0.92, CH * 0.465, 0.028), []);
  const ring = React.useMemo(() => roundedPlane(CW + 0.04, CH + 0.04, 0.066), []);
  const chrome = React.useMemo(() => Array.from({ length: N }, (_, i) => cardChrome(i)), []);
  const wc = kf(t, [[4.7, 1.0], [5.3, 4.6, E.out], [6.1, PICK, E.inOut], [7.4, 9.5, E.glide]]);
  const picked = pr(t, 6.1, 6.35, E.back);
  return (
    <>
      <RigCamera rig={looksRig} t={t} />
      <color attach="background" args={["#D8CCF6"]} />
      <Bg />
      <DepthLayers layers={DEPTH.looks} s={t - SHOT.t0} />
      <ambientLight intensity={1.4} />
      <directionalLight position={[-2, 3, 4]} intensity={1.4} />
      {Array.from({ length: N }, (_, i) => {
        const base = cardPos(i);
        const enter = pr(t, 4.4 + i * 0.04, 5.0 + i * 0.04, E.out);
        const d = i - wc;
        const bump = Math.exp(-(d * d) / 3.2);
        const lift = i === PICK ? picked : 0;
        const pos: V3 = [base[0] + (1 - enter) * 2.4, base[1] + bump * 0.1 + lift * 0.12 + Math.sin(t * 2.2 + i * 0.7) * 0.01, base[2] + bump * 0.22 + lift * 0.35 + (1 - enter) * -1.0];
        const ry = -0.5 + bump * 0.25 + lift * 0.35 + drift(t, i, 0.02);
        return (
          <group key={i} position={pos} rotation={[0.02, ry, 0.01 * Math.sin(i)]} scale={0.94 + bump * 0.18 + lift * 0.1}>
            {lift > 0 && (
              <mesh geometry={ring} position={[0, 0, -0.006]}>
                <meshBasicMaterial color={new THREE.Color(BRAND.mint).multiplyScalar(1.2)} toneMapped={false} />
              </mesh>
            )}
            <mesh geometry={back} position={[0, 0, -0.004]}>
              <meshStandardMaterial color="#ECE6F6" roughness={0.6} />
            </mesh>
            <mesh geometry={geo}>
              <meshBasicMaterial map={chrome[i]} toneMapped={false} transparent />
            </mesh>
            {tiles && (
              <mesh geometry={vid} position={[0, CH * 0.5 - 0.024 - (CH * 0.465) / 2, 0.002]}>
                <meshBasicMaterial map={tiles[i % 12]} toneMapped={false} />
              </mesh>
            )}
          </group>
        );
      })}
      <Cursor
        pos={kf3(t, [[4.3, [-0.3, 0.14, 1.1]], [4.7, [0.35, 0.08, 0.8], E.inOut], [5.3, [0.25, -0.1, 0.5], E.out], [6.05, [0.42, -0.06, 0.12], E.inOut], [6.15, [0.42, -0.07, 0.12], E.out], [7.4, [1.4, 0.1, -0.5], E.glide]])}
        rot={[0.2, 0.4 + drift(t, 3, 0.2), -2.4 + drift(t, 9, 0.2) - pr(t, 6.05, 6.12) * 0.3 + pr(t, 6.12, 6.3) * 0.3]}
        scale={kf(t, [[4.3, 4.2], [4.75, 2.2, E.out], [5.3, 1.5]])}
        color="#1D1A22"
      />
    </>
  );
};

export const looksPost = (t: number) =>
  rigPost(looksRig, t, {
    aperture: 0.35,
    bloom: 0.15,
    threshold: 0.88,
    vignette: 0.2,
    grain: 0.03,
    flash: kf(t, [[4.3, 0.35], [4.45, 0, E.out]]),
    exposure: 1.0,
    saturation: 1.05,
    contrast: 0.04,
    ca: 0.005,
    agx: 0,
  });
