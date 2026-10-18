import React from "react";
import { Film, FilmShot } from "../kit";
import { T } from "./saaswave/common";
import {
  Shot1, Shot7, Shot8, Shot9, Shot11, Shot12, ShotRoom, post1, post7, post8, post9, post11, post12, postRoom,
} from "./saaswave/shots3d";
import { Bars, Burst1, Burst2, Burst3, CoursePanel, Dots, EasyWorkflows, GoBeyond, Hud, ItsLive, LogoEnd, Rings, TypeRun } from "./saaswave/layers2d";

// Ref B (SaasWAVE, ig-DcvVp-Qof2x) clone, the FAST pipeline: everything real-time in Remotion + R3F; the room is a
// Cycles light bake (styles/style-3/videos/saaswave-clone/room.py → public/style3/saaswave-room). Private study, never
// posted. The full 26.33 s / 632 frames on the ref's own cut list (saaswave/common.tsx T).
export const SAASWAVE_CLONE_SECONDS = T.end;
// "Newer Wave" (Kevin MacLeod, CC-BY, 110.02 BPM), the ref's tempo: s3_mix.py --no-vo → public/style3/audio/saaswave-clone.wav
const AUDIO: string | undefined = "style3/audio/saaswave-clone.wav";

const SHOTS: FilmShot[] = [
  { id: "desk", t0: T.s1, t1: T.s3, scene: (t) => <Shot1 t={t} />, post: post1 },
  { id: "room", t0: T.s3, t1: T.burst, scene: (t, set) => <ShotRoom t={t} room={set!} />, post: postRoom },
  { id: "macro", t0: T.s7, t1: T.flash7, scene: (t) => <Shot7 t={t} />, post: post7 },
  { id: "logo-desk", t0: T.s8, t1: T.s9, scene: (t) => <Shot8 t={t} />, post: post8 },
  { id: "chase", t0: T.s9, t1: T.pink + 0.12, scene: (t) => <Shot9 t={t} />, post: post9 },
  { id: "sky", t0: T.s11, t1: T.s12, scene: (t) => <Shot11 t={t} />, post: post11 },
  { id: "folder", t0: T.s12, t1: T.s13, scene: (t) => <Shot12 t={t} />, post: post12 },
];

export const SaaswaveClone: React.FC = () => (
  <Film
    set="style3/saaswave-room"
    shots={SHOTS}
    shadows="percentage"
    layers={[Burst1, Burst2, Burst3, EasyWorkflows, CoursePanel, Rings, GoBeyond, TypeRun, LogoEnd]}
    overlays={[Dots, Hud, ItsLive, Bars]}
    audio={AUDIO}
    bg="#F6F0F4"
  />
);
