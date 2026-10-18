import React from "react";
import * as THREE from "three";
import { AbsoluteFill, Audio, Img, staticFile, useCurrentFrame } from "remotion";
import { applyCam, useFonts } from "../kit";
import { T } from "./saaswave/common";
import {
  ANSWERS_PLANE, drawAnswers, makeCloudCanvas, makeSkyCanvas, post1, post7, post8, post9, post11, post12, postRoom, rig11,
} from "./saaswave/shots3d";
import { Bars, Burst1, Burst2, Burst3, CoursePanel, Dots, EasyWorkflows, GoBeyond, Hud, ItsLive, LogoEnd, Rings, TypeRun } from "./saaswave/layers2d";
import { PostParams } from "../post";

// Ref B clone, the BEST-OVERALL pipeline: the same film as SaaswaveClone (same motion, cut list, 2D layers and
// soundtrack), but every 3D shot is a Blender plate. kit/bridge.tsx exported the R3F scenes frame by frame;
// styles/tools/s3_bridge.py rebuilt them in Blender (the room from its own set script) and rendered them with real
// light (EEVEE here, Cycles on a GPU box; looks: styles/style-3/videos/saaswave-clone/bridge-looks.json).
// Plates: public/style3/saaswave-best/<shot>_<frame>.jpg|png on the film's frame numbers. Flat backdrops (sky,
// clouds, white) are painted here under alpha plates, so they keep their exact colours; Remotion adds the glow.
export const SAASWAVE_BEST_SECONDS = T.end;

type Plate = { id: string; t0: number; t1: number; post: (t: number) => PostParams; alpha?: boolean; glow: number; bg?: "cloud" | "sky" | string; grade?: string };
const PLATES: Plate[] = [
  { id: "desk", t0: T.s1, t1: T.s3, post: post1, glow: 0.22 },
  { id: "room", t0: T.s3, t1: T.burst, post: postRoom, glow: 0.42 },
  { id: "macro", t0: T.s7, t1: T.flash7, post: post7, glow: 0.25 },
  { id: "logo-desk", t0: T.s8, t1: T.s9, post: post8, glow: 0.25 },
  // AgX under bright light desaturates the hero colours (umbrella lilac-white, folder peach): grade the alpha plates back
  { id: "chase", t0: T.s9, t1: T.pink + 0.12, post: post9, alpha: true, glow: 0.3, bg: "cloud", grade: "saturate(1.5) contrast(1.05)" },
  { id: "sky", t0: T.s11, t1: T.s12, post: post11, alpha: true, glow: 0.18, bg: "sky", grade: "saturate(2.1) contrast(1.08) brightness(0.97)" },
  { id: "folder", t0: T.s12, t1: T.s13, post: post12, alpha: true, glow: 0.15, bg: "#FBF7FA", grade: "saturate(1.9) contrast(1.06)" },
];
const pad = (n: number) => String(n).padStart(4, "0");

const Backdrop: React.FC<{ kind: string }> = ({ kind }) => {
  const url = React.useMemo(() => (kind === "cloud" ? makeCloudCanvas().toDataURL() : kind === "sky" ? makeSkyCanvas().toDataURL() : null), [kind]);
  if (!url) return <AbsoluteFill style={{ background: kind }} />;
  return <Img src={url} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />;
};

/** "Answers" between the sky and the umbrella: the same canvas the 3D plane used, placed where rig11 projects it */
const tmpCam = new THREE.PerspectiveCamera();
const AnswersLayer: React.FC<{ t: number }> = ({ t }) => {
  const ref = React.useRef<HTMLCanvasElement>(null);
  React.useLayoutEffect(() => {
    const c = ref.current?.getContext("2d");
    if (!c) return;
    c.clearRect(0, 0, 2048, 512);
    drawAnswers(c, 2048, 512, t);
  });
  applyCam(tmpCam, rig11(t));
  const [x, y, z] = ANSWERS_PLANE.pos;
  const pts = [[-1, -1], [1, 1]].map(([sx, sy]) => new THREE.Vector3(x + (sx * ANSWERS_PLANE.w) / 2, y + (sy * ANSWERS_PLANE.h) / 2, z).project(tmpCam));
  const left = ((pts[0].x + 1) / 2) * 1920, right = ((pts[1].x + 1) / 2) * 1920;
  const top = ((1 - pts[1].y) / 2) * 1080, bottom = ((1 - pts[0].y) / 2) * 1080;
  return <canvas ref={ref} width={2048} height={512} style={{ position: "absolute", left, top, width: right - left, height: bottom - top }} />;
};

/** fine animated film grain (an SVG turbulence re-seeded per frame) */
const Grain: React.FC<{ frame: number; o: number }> = ({ frame, o }) => (
  <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, opacity: o, mixBlendMode: "overlay", pointerEvents: "none" }}>
    <filter id="g">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={frame % 97} />
      <feColorMatrix type="saturate" values="0" />
    </filter>
    <rect width="100%" height="100%" filter="url(#g)" />
  </svg>
);

export const SaaswaveBest: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / 24;
  const fonts = useFonts();
  const p = PLATES.find((s) => t >= s.t0 && t < s.t1);
  const q = p?.post(t);
  const src = p ? staticFile(`style3/saaswave-best/${p.id}_${pad(frame)}.${p.alpha ? "png" : "jpg"}`) : null;
  const layers = [Burst1, Burst2, Burst3, EasyWorkflows, CoursePanel, Rings, GoBeyond, TypeRun, LogoEnd];
  const overlays = [Dots, Hud, ItsLive, Bars];
  const fc = q?.flashColor ?? [1, 1, 1];
  return (
    <AbsoluteFill style={{ background: "#F6F0F4" }}>
      {p && src && (
        <>
          {p.bg && <Backdrop kind={p.bg} />}
          {p.id === "sky" && <AnswersLayer t={t} />}
          <Img src={src} style={{ position: "absolute", inset: 0, width: 1920, height: 1080, filter: p.grade }} />
          <Img src={src} style={{ position: "absolute", inset: 0, width: 1920, height: 1080, filter: "blur(26px) brightness(1.15) saturate(1.15)", mixBlendMode: "screen", opacity: p.glow }} />
          {q && q.flash > 0 && <AbsoluteFill style={{ background: `rgb(${fc.map((x) => Math.round(x * 255)).join(",")})`, opacity: q.flash }} />}
          <Grain frame={frame} o={0.07} />
        </>
      )}
      {fonts && layers.map((L, i) => <L key={`l${i}`} t={t} />)}
      {fonts && overlays.map((L, i) => <L key={`o${i}`} t={t} />)}
      <Audio src={staticFile("style3/audio/saaswave-clone.wav")} />
    </AbsoluteFill>
  );
};
