import React from "react";
import * as THREE from "three";
import { E, FONT, V3, drift, kf, pr, roundRect, roundedPlane, roundedSlab, useCanvasTex } from "../lib";
import { RigCamera, rigPost } from "../rig";
import { DEPTH, PHONES, phonesRig } from "./cams";
import { BRAND, PREMIUM, useAtlas } from "./shared";
import { Chip, DepthLayers, FurBall, pastelBg } from "./decor";

// Shot 8 (12.95–16.0 s) "Every word lands in sync. Hinglish too.": the owner's premium clip, the same take in 4 looks,
// on four glass phones that fan out from one. Camera: cams.ts phonesRig (orbit + pull-out, spike on "sync").
export const PHONES_T0 = PHONES.t0;
const PW = 0.34, PH = 0.68;

const Bg: React.FC = () => {
  const tex = useCanvasTex(1024, 576, (c, w, h) => pastelBg(c, w, h, "#EFE6FA", [[0.15, 0.2, 0.45, "rgba(255,201,140,0.9)"], [0.85, 0.25, 0.4, "rgba(150,230,200,0.85)"], [0.55, 0.95, 0.5, "rgba(183,160,242,0.9)"], [0.5, 0.45, 0.3, "rgba(255,255,255,0.8)"]]), []);
  return (
    <mesh position={[0, 0, -5]}>
      <planeGeometry args={[18, 10.2]} />
      <meshBasicMaterial map={tex} toneMapped={false} />
    </mesh>
  );
};

const Phone: React.FC<{ tile: THREE.Texture | null; pos: V3; rot: V3; s: number }> = ({ tile, pos, rot, s }) => {
  const body = React.useMemo(() => roundedSlab(PW, PH, 0.03, 0.05), []);
  const glass = React.useMemo(() => roundedPlane(PW - 0.022, PH - 0.022, 0.04), []);
  return (
    <group position={pos} rotation={rot} scale={s}>
      <mesh geometry={body}>
        <meshStandardMaterial color="#26222E" roughness={0.3} metalness={0} />
      </mesh>
      {tile && (
        <mesh geometry={glass} position={[0, 0, 0.0158]}>
          <meshBasicMaterial map={tile} toneMapped={false} />
        </mesh>
      )}
      <mesh position={[0, PH / 2 - 0.035, 0.0162]}>
        <planeGeometry args={[0.07, 0.018]} />
        <meshBasicMaterial color="#0E0C12" toneMapped={false} />
      </mesh>
    </group>
  );
};

// "Hinglish? Bilkul sahi." frosted chip
const HinglishChip: React.FC<{ t: number }> = ({ t }) => {
  const k = pr(t, 14.45, 14.75, E.back);
  const tex = useCanvasTex(
    900,
    200,
    (c, w, h) => {
      c.fillStyle = "rgba(255,255,255,0.92)";
      roundRect(c, 0, 0, w, h, 60);
      c.fill();
      c.font = `700 62px ${FONT.sans}`;
      c.fillStyle = "#1C1A24";
      c.textBaseline = "middle";
      c.fillText("Hinglish?", 60, h / 2 + 4);
      c.font = `italic 78px ${FONT.serif}`;
      c.fillStyle = "#14A877";
      c.fillText("Bilkul sahi.", 380, h / 2 + 6);
    },
    [],
  );
  if (k <= 0) return null;
  return (
    <mesh position={[0.0, 0.5 + (1 - k) * -0.1, 0.55]} scale={0.6 + 0.4 * k}>
      <planeGeometry args={[0.9, 0.2]} />
      <meshBasicMaterial map={tex} transparent opacity={Math.min(1, k * 1.5)} toneMapped={false} />
    </mesh>
  );
};

export const PhonesShot: React.FC<{ t: number }> = ({ t }) => {
  const tiles = useAtlas(PREMIUM, 4, 1);
  const fan = pr(t, 13.55, 14.25, E.out);
  // order: centre = premium-1 (green slam); the others slide out behind it
  const slots: [number, V3, V3][] = [
    [0, [0, 0, 0.12], [0, 0, 0]],
    [1, [-0.42 * fan - 0.02, 0.02, -0.08], [0, 0.32 * fan, 0.05 * fan]],
    [2, [0.42 * fan + 0.02, 0.02, -0.08], [0, -0.32 * fan, -0.05 * fan]],
    [3, [0.8 * fan, -0.02, -0.3], [0, -0.48 * fan, -0.08 * fan]],
  ];
  return (
    <>
      <RigCamera rig={phonesRig} t={t} />
      <color attach="background" args={["#EFE6FA"]} />
      <Bg />
      <DepthLayers layers={DEPTH.phones} s={t - PHONES.t0} />
      <ambientLight intensity={1.2} />
      <directionalLight position={[-2, 3, 4]} intensity={2.0} color="#FFF4EA" />
      <pointLight position={[1.2, -0.4, 1.2]} intensity={1.6} color="#FFB466" />
      {[3, 2, 1, 0].map((k) => {
        const [i, p, r] = slots[k];
        const show = k === 0 ? 1 : fan;
        if (show <= 0.001) return null;
        return <Phone key={i} tile={tiles ? tiles[i] : null} pos={[p[0], p[1] + Math.sin(t * 1.6 + k) * 0.01, p[2]]} rot={[r[0] + drift(t, 40 + k, 0.03), r[1], r[2]]} s={k === 0 ? 1 : 0.92} />;
      })}
      <FurBall pos={[-0.95 + drift(t, 50, 0.01), -0.42, -0.15]} r={0.26} />
      <Chip t={t} label="WOW" pos={[-0.78, 0.38, 0.05]} rot={[0, 0.3, 0.12]} bg="#FFA946" fg="#3B1C00" w={0.3} seed={61} />
      <Chip t={t} label="NO WAY" pos={[0.98, 0.42, -0.05]} rot={[0, -0.35, -0.1]} bg={BRAND.mint} fg="#06301F" w={0.4} seed={62} />
      <Chip t={t} label="viral" pos={[1.05, -0.4, 0.1]} rot={[0, -0.3, 0.08]} bg="#B7A0F2" fg="#FFFFFF" w={0.32} seed={63} font="serif" />
      <HinglishChip t={t} />
    </>
  );
};

export const phonesPost = (t: number) =>
  rigPost(phonesRig, t, {
    aperture: 0.35,
    bloom: 0.15,
    threshold: 0.88,
    vignette: 0.2,
    grain: 0.03,
    flash: kf(t, [[12.95, 0.4], [13.1, 0, E.out]]),
    exposure: 1.0,
    saturation: 1.05,
    contrast: 0.04,
    ca: 0.005,
    agx: 0,
  });
