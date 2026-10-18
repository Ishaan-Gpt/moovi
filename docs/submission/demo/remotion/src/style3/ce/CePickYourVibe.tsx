import React from "react";
import * as THREE from "three";
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { FPS, H, W, useFonts, useRoom } from "../lib";
import { Post, PostParams } from "../post";
import { StudioShot, studioPost } from "./studio";
import { LOOKS_T0, LooksShot, looksPost } from "./looks";
import { PHONES_T0, PhonesShot, phonesPost } from "./phones";
import { COMMENT_T0, CommentShot, commentPost } from "./comment";
import { Overlays, TypeShots } from "./type2d";
import { Caption, CapWord } from "./shared";

// ce3-01 "Pick your vibe": CaptionsEasy launch film in Style 3 (styles/style-3/videos/ce3-01-pick-your-vibe/script.txt).
export const CE3_SECONDS = 24;

type Shot = "studio" | "looks" | "phones" | "comment" | null;
const shot3d = (t: number): Shot =>
  t < 2.32 ? "studio" : t >= LOOKS_T0 && t < 7.4 ? "looks" : t >= PHONES_T0 && t < 16.0 ? "phones" : t >= COMMENT_T0 && t < 22.2 ? "comment" : null;
const postFor = (t: number): PostParams => {
  const s = shot3d(t);
  return s === "studio" ? studioPost(t) : s === "looks" ? looksPost(t) : s === "phones" ? phonesPost(t) : commentPost(t);
};

// the VO, captioned in CaptionsEasy's "Serif Accent Glow" look on the 3D shots
const CAPS: { words: CapWord[]; style: "slam" | "highlight" | "glow" | "accentGlow"; until: number }[] = [
  { words: [{ w: "every", t: 0.25 }, { w: "creator", t: 0.5 }, { w: "has", t: 0.92 }, { w: "a", t: 1.1 }, { w: "vibe", t: 1.28, hero: true }], style: "accentGlow", until: 2.3 },
  { words: [{ w: "30+", t: 4.42, hero: true }, { w: "viral", t: 4.95 }, { w: "looks", t: 5.25 }], style: "accentGlow", until: 5.75 },
  { words: [{ w: "pick", t: 5.85 }, { w: "yours", t: 6.15, hero: true }], style: "accentGlow", until: 7.38 },
  { words: [{ w: "every", t: 13.1 }, { w: "word", t: 13.35 }, { w: "lands", t: 13.6 }, { w: "in", t: 13.92 }, { w: "sync", t: 14.05, hero: true }], style: "accentGlow", until: 14.42 },
  { words: [{ w: "comment", t: 19.0 }, { w: "captions", t: 19.3, hero: true }], style: "accentGlow", until: 19.85 },
  { words: [{ w: "I'll", t: 19.95 }, { w: "send", t: 20.2 }, { w: "you", t: 20.45 }, { w: "the", t: 20.6 }, { w: "link", t: 20.75, hero: true }], style: "accentGlow", until: 22.15 },
];

export const CePickYourVibe: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const fonts = useFonts();
  const room = useRoom("style3/ce/studio");
  const s = shot3d(t);
  const at = (sec: number) => Math.round(sec * FPS);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {fonts && room && (
        <ThreeCanvas width={W} height={H} gl={{ antialias: false, toneMapping: THREE.NoToneMapping, preserveDrawingBuffer: true }} camera={{ fov: 30, near: 0.05, far: 60, position: [0.16, 1.12, 4.1] }}>
          {s === "studio" && <StudioShot t={t} room={room} />}
          {s === "looks" && (
            <Sequence from={at(LOOKS_T0)} layout="none">
              <LooksShot t={t} />
            </Sequence>
          )}
          {s === "phones" && (
            <Sequence from={at(PHONES_T0)} layout="none">
              <PhonesShot t={t} />
            </Sequence>
          )}
          {s === "comment" && <CommentShot t={t} />}
          <Post frame={frame} params={() => postFor(t)} />
        </ThreeCanvas>
      )}
      {fonts && <TypeShots t={t} />}
      {fonts && <Overlays t={t} />}
      {fonts && CAPS.map((c, i) => <Caption key={i} t={t} words={c.words} style={c.style} until={c.until} y={850} />)}
      {/* VO + "Newer Wave" bed (lifted at 10.91 s) + SFX: styles/tools/s3_mix.py on videos/ce3-01-pick-your-vibe */}
      <Audio src={staticFile("style3/ce/mix.wav")} />
    </AbsoluteFill>
  );
};
