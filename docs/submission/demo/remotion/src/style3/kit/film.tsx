import React from "react";
import * as THREE from "three";
import { AbsoluteFill, Audio, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { RoomAssets, useFonts, useRoom } from "../lib";
import { Post, PostParams } from "../post";
import { BRIDGE_URL, BridgeExport } from "./bridge";

// Style 3 film router: a shot table of 3D scenes (each with its post) under 2D layers, plus the soundtrack. One
// ThreeCanvas stays mounted for the whole film (no GL context churn between shots); the active 3D shot is picked by
// time, and each 2D layer decides for itself (returns null where a 3D shot plays). Proven in Bundance.tsx; scaffold:
// styles/style-3/library/templates/new-film (styles/tools/s3_new.py film <slug>).

export type FilmShot = {
  id: string;
  /** active on [t0, t1) seconds */
  t0: number;
  t1: number;
  /** the R3F scene (RigCamera + set + props); `set` = the baked set when the film has one, else null */
  scene: (t: number, set: RoomAssets | null) => React.ReactNode;
  post: (t: number) => PostParams;
};
export type FilmLayer = React.FC<{ t: number }>;

export const shotAt = (shots: FilmShot[], t: number) => shots.find((s) => t >= s.t0 && t < s.t1) ?? null;

/** neutral post for frames with no 3D shot (2D cards cover the canvas there) */
export const POST_IDLE: PostParams = { focus: 5, aperture: 0, bloom: 0, threshold: 1, blurDir: [0, 0], zoomBlur: 0, vignette: 0, grain: 0, flash: 0, exposure: 1, agx: 0 };

type CanvasCam = { fov: number; near: number; far: number; position: [number, number, number] };
const CAM: CanvasCam = { fov: 23, near: 0.05, far: 60, position: [0, 1.15, 3.6] };

// loads the baked set at mount (its delayRender must exist from the first render, never after the fonts resolve)
const WithSet: React.FC<{ base: string; children: (set: RoomAssets) => React.ReactNode }> = ({ base, children }) => {
  const set = useRoom(base);
  return set ? <>{children(set)}</> : null;
};

export const Film: React.FC<{
  shots: FilmShot[];
  /** 2D shots, drawn above the canvas in order */
  layers?: FilmLayer[];
  /** drawn above the layers (letterbox, iris, overlays on 3D) */
  overlays?: FilmLayer[];
  /** public path of the mix, e.g. "style3/audio/mix.wav" (styles/tools/s3_mix.py --to …) */
  audio?: string;
  /** public base of a baked set from bake.py, e.g. "style3/room" */
  set?: string;
  /** post when no 3D shot is active (default POST_IDLE) */
  idlePost?: (t: number) => PostParams;
  camera?: CanvasCam;
  bg?: string;
  /** shadow maps on the canvas (R3F `shadows`: true = PCF soft; "basic" | "percentage" | "soft" | "variance") */
  shadows?: boolean | "basic" | "percentage" | "soft" | "variance";
  children?: React.ReactNode;
}> = ({ shots, layers = [], overlays = [], audio, set, idlePost, camera = CAM, bg = "#000", shadows, children }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;
  const fonts = useFonts();
  const shot = shotAt(shots, t);
  const canvas = (room: RoomAssets | null) => (
    <ThreeCanvas width={width} height={height} gl={{ antialias: false, toneMapping: THREE.NoToneMapping, preserveDrawingBuffer: true }} camera={camera} shadows={shadows}>
      {shot && <React.Fragment key={shot.id}>{shot.scene(t, room)}</React.Fragment>}
      {shot && BRIDGE_URL && <BridgeExport shot={shot.id} frame={frame} t={t} post={shot.post(t)} />}
      <Post frame={frame} params={() => (shot ? shot.post(t) : idlePost ? idlePost(t) : POST_IDLE)} />
    </ThreeCanvas>
  );
  return (
    <AbsoluteFill style={{ background: bg }}>
      {set ? <WithSet base={set}>{(room) => fonts && canvas(room)}</WithSet> : fonts && canvas(null)}
      {fonts && layers.map((L, i) => <L key={`l${i}`} t={t} />)}
      {fonts && overlays.map((L, i) => <L key={`o${i}`} t={t} />)}
      {children}
      {audio && <Audio src={staticFile(audio)} />}
    </AbsoluteFill>
  );
};
