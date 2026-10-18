import React from "react";
import * as THREE from "three";
import { E, FONT, drift, kf, kf3, pr, rand, roundRect, roundedPlane, roundedSlab, useCanvasTex } from "../lib";
import { Cursor } from "../room";
import { RigCamera, rigPost } from "../rig";
import { COMMENT, DEPTH, commentRig } from "./cams";
import { BRAND } from "./shared";
import { Chip, DepthLayers, FurBall, pastelBg } from "./decor";

// Shot 10 (18.7–22.2 s) "Comment captions, and I'll send you the link.": a frosted comment box types "captions",
// the cursor presses send, a "Sent! Check your DMs" bubble pops (owner wording, Style 1 §0).
// Camera: cams.ts commentRig (arc in, truck right; spikes on "captions" and "link", ramp-up into the end card).
export const COMMENT_T0 = COMMENT.t0;
const WORD = "captions";
const TYPE = [19.3, 19.8] as const;
const SEND = 20.3;

const Bg: React.FC = () => {
  const tex = useCanvasTex(1024, 576, (c, w, h) => pastelBg(c, w, h, "#F3D9EC", [[0.1, 0.85, 0.5, "rgba(255,169,70,0.75)"], [0.9, 0.15, 0.45, "rgba(183,160,242,0.9)"], [0.5, 0.4, 0.35, "rgba(255,240,246,0.9)"], [0.85, 0.9, 0.35, "rgba(52,211,153,0.45)"]]), []);
  return (
    <mesh position={[0, 0, -5]}>
      <planeGeometry args={[18, 10.2]} />
      <meshBasicMaterial map={tex} toneMapped={false} />
    </mesh>
  );
};

const Panel: React.FC<{ t: number }> = ({ t }) => {
  const slab = React.useMemo(() => roundedSlab(1.7, 0.5, 0.05, 0.05), []);
  const face = React.useMemo(() => roundedPlane(1.68, 0.48, 0.045), []);
  const n = Math.round(pr(t, TYPE[0], TYPE[1], (x) => x) * WORD.length);
  const caret = Math.floor(t * 3.2) % 2 === 0;
  const sent = t >= SEND + 0.05;
  const tex = useCanvasTex(
    1680,
    480,
    (c, w, h) => {
      const g = c.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, "#8E6BEA");
      g.addColorStop(0.55, "#6F4FD6");
      g.addColorStop(1, "#A36BE8");
      c.fillStyle = g;
      roundRect(c, 0, 0, w, h, 44);
      c.fill();
      for (let i = 0; i < 22; i++) {
        const x = rand(i * 3 + 7) * w, y = rand(i * 3 + 8) * h, r = 110 + rand(i * 3 + 9) * 240;
        const gg = c.createRadialGradient(x, y, 0, x, y, r);
        gg.addColorStop(0, i % 3 ? "rgba(60,30,150,0.25)" : "rgba(230,190,255,0.22)");
        gg.addColorStop(1, "rgba(0,0,0,0)");
        c.fillStyle = gg;
        c.fillRect(0, 0, w, h);
      }
      // avatar + handle row
      c.fillStyle = BRAND.apricot;
      c.beginPath();
      c.arc(86, 92, 38, 0, Math.PI * 2);
      c.fill();
      c.font = `700 34px ${FONT.ui}`;
      c.fillStyle = "rgba(255,255,255,0.95)";
      c.textBaseline = "middle";
      c.fillText("you", 142, 92);
      c.font = `400 30px ${FONT.ui}`;
      c.fillStyle = "rgba(255,255,255,0.6)";
      c.fillText("· now", 210, 94);
      // the comment line
      if (sent) {
        c.font = `500 84px ${FONT.ui}`;
        c.fillStyle = "rgba(255,255,255,0.97)";
        c.fillText(WORD, 70, 262);
      } else if (n === 0) {
        c.font = `400 66px ${FONT.ui}`;
        c.fillStyle = "rgba(255,255,255,0.7)";
        c.fillText("Add a comment…", 70, 262);
      } else {
        c.font = `500 84px ${FONT.ui}`;
        c.fillStyle = "rgba(255,255,255,0.97)";
        c.fillText(WORD.slice(0, n) + (caret ? "|" : ""), 70, 262);
      }
      // hearts / emoji row
      c.font = `400 34px ${FONT.ui}`;
      c.fillStyle = "rgba(255,255,255,0.65)";
      c.fillText("♡  Reply", 70, 400);
    },
    [n, caret, sent],
  );
  const press = pr(t, SEND - 0.04, SEND + 0.04) - pr(t, SEND + 0.06, SEND + 0.2);
  return (
    <group rotation={[0.08, -0.1, 0.02]}>
      <mesh geometry={slab} position={[0.035, -0.035, -0.06]}>
        <meshStandardMaterial color="#FF7FB0" roughness={0.4} />
      </mesh>
      <mesh geometry={slab}>
        <meshPhysicalMaterial color="#C9B2FF" roughness={0.25} transparent opacity={0.35} clearcoat={1} />
      </mesh>
      <mesh geometry={face} position={[0, 0, 0.027]}>
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
      {/* send button: a mint key that presses in */}
      <group position={[0.7, -0.14, 0.06 - press * 0.025]}>
        <mesh geometry={React.useMemo(() => roundedSlab(0.16, 0.12, 0.05, 0.035), [])}>
          <meshStandardMaterial color={BRAND.mint} roughness={0.35} />
        </mesh>
        <mesh position={[0, 0, 0.026]} rotation={[0, 0, -0.5]}>
          <circleGeometry args={[0.03, 3]} />
          <meshBasicMaterial color="#06301F" toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
};

const Sent: React.FC<{ t: number }> = ({ t }) => {
  const k = pr(t, SEND + 0.15, SEND + 0.5, E.back);
  const tex = useCanvasTex(
    900,
    220,
    (c, w, h) => {
      c.fillStyle = BRAND.mint;
      roundRect(c, 0, 0, w, h - 30, 70);
      c.fill();
      c.beginPath();
      c.moveTo(110, h - 34);
      c.lineTo(90, h);
      c.lineTo(170, h - 34);
      c.fill();
      c.font = `800 72px ${FONT.sans}`;
      c.fillStyle = "#06301F";
      c.textBaseline = "middle";
      c.fillText("Sent!", 60, (h - 30) / 2 + 4);
      c.font = `italic 76px ${FONT.serif}`;
      c.fillText("Check your DMs", 290, (h - 30) / 2 + 6);
    },
    [],
  );
  if (k <= 0) return null;
  return (
    <mesh position={[0.35, 0.45 + (1 - k) * -0.15, 0.25]} rotation={[0, -0.1, 0.03]} scale={0.5 + 0.5 * k}>
      <planeGeometry args={[0.95, 0.232]} />
      <meshBasicMaterial map={tex} transparent toneMapped={false} />
    </mesh>
  );
};

export const CommentShot: React.FC<{ t: number }> = ({ t }) => (
  <>
    <RigCamera rig={commentRig} t={t} />
    <color attach="background" args={["#F3D9EC"]} />
    <Bg />
    <DepthLayers layers={DEPTH.comment} s={t - COMMENT.t0} />
    <ambientLight intensity={1.1} />
    <directionalLight position={[-2, 3, 3]} intensity={2.0} color="#FFF0F4" />
    <pointLight position={[1.5, -0.5, 1.2]} intensity={1.6} color="#FFB466" />
    <Panel t={t} />
    <Sent t={t} />
    <FurBall pos={[1.15 + drift(t, 80, 0.01), -0.38, -0.12]} r={0.32} />
    <Chip t={t} label="link?" pos={[-0.95, 0.4, 0.05]} rot={[0, 0.3, 0.1]} bg="#FFFFFF" fg="#6F4FD6" w={0.32} seed={81} font="serif" />
    <Chip t={t} label="NEED THIS" pos={[-1.0, -0.42, 0.12]} rot={[0, 0.35, -0.08]} bg={BRAND.apricot} fg="#3B1C00" w={0.46} seed={82} />
    {t < 21.2 && (
      <Cursor
        pos={kf3(t, [[18.7, [-0.9, 0.5, 0.9]], [19.9, [0.45, -0.3, 0.55], E.inOut], [SEND, [0.72, -0.2, 0.3], E.out], [SEND + 0.3, [0.74, -0.21, 0.32], E.out], [21.2, [1.6, 0.4, 0.9], E.in]])}
        rot={[0.2, 0.4 + drift(t, 3, 0.2), -2.4 + drift(t, 9, 0.2) - pr(t, SEND - 0.05, SEND) * 0.3 + pr(t, SEND, SEND + 0.2) * 0.3]}
        scale={1.6}
        color="#1D1A22"
      />
    )}
  </>
);

export const commentPost = (t: number) =>
  rigPost(commentRig, t, {
    aperture: 0.32,
    bloom: 0.15,
    threshold: 0.88,
    vignette: 0.2,
    grain: 0.03,
    flash: kf(t, [[18.7, 0.35], [18.85, 0, E.out]]),
    exposure: 1.0,
    saturation: 1.05,
    contrast: 0.04,
    ca: 0.005,
    agx: 0,
  });
