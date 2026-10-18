import React from "react";
import * as THREE from "three";
import { AbsoluteFill } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { V3, useFonts, useRoom } from "../lib";
import { Dress, MON, Room } from "../room";
import { ShoppingBag } from "../kit/props";
import { CardsShot } from "../cards";
import { SearchShot } from "../search";
import { RigCamera, lensFov } from "../rig";

// Camera probe for styles/tools/s3_camfit.py: a set seen from a camera given as props (no post), rendered small and
// fast so an optimiser can fit our camera to a reference frame by render-and-compare.
//   scene "room": the baked desk set (+ white screen, bag) · "cards" / "search": that shot's 3D content at time t
//   dress / bagScale: the take's dressing (room2.tsx: shot 11 hides the chair; take 11c's bag is at 0.6 scale)
export type CamProbeProps = { pos: V3; look: V3; lens: number; roll?: number; set?: string; bag?: V3 | null; bagScale?: number; dress?: Dress; screen?: string; scene?: "room" | "cards" | "search"; t?: number };

export const CamProbe: React.FC<CamProbeProps> = ({ pos, look, lens, roll = 0, set = "style3/room", bag = [0.66, 0.8, 0.45], bagScale = 1, dress, screen = "#F4F1F6", scene = "room", t = 0 }) => {
  const room = useRoom(set);
  const fonts = useFonts();
  const rig = React.useCallback(() => ({ pos, look, fov: lensFov(lens), roll, focus: 1 }), [pos, look, lens, roll]);
  const ready = scene === "room" ? !!room : !!fonts;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {ready && (
        <ThreeCanvas width={960} height={540} gl={{ antialias: true, toneMapping: THREE.NoToneMapping, preserveDrawingBuffer: true }} camera={{ fov: 40, position: [0, 1, 3] }}>
          <RigCamera rig={rig} t={0} near={0.02} far={60} />
          {scene === "room" && room && (
            <>
              <color attach="background" args={["#E89A84"]} />
              <Room room={room} dress={dress} />
              <mesh position={[MON.x, MON.y, MON.z]}>
                <planeGeometry args={[MON.w, MON.h]} />
                <meshBasicMaterial color={screen} toneMapped={false} />
              </mesh>
              {bag && <ShoppingBag pos={bag} rotY={-0.12} w={0.22 * bagScale} d={0.14 * bagScale} h={0.29 * bagScale} />}
            </>
          )}
          {scene === "cards" && <CardsShot t={t} noCam />}
          {scene === "search" && <SearchShot t={t} noCam />}
        </ThreeCanvas>
      )}
    </AbsoluteFill>
  );
};
