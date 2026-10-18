import React from "react";
import * as THREE from "three";
import { V3, useCanvasTex } from "../lib";
import { MeshKey, meshFlow, paintMesh } from "../mesh";

// Backgrounds for 3D shots: the far plane carries the film's pastel field (measured with s3_palette.py or designed),
// so the 3D shots and the 2D type cards share one palette.

/**
 * A far plane painted with a mesh gradient, repainted `rate` times a second. inset: the measured field covers the
 * central (1 − 2·inset) of the plane, its edge colours stretch into the margins the camera may see while it moves.
 */
export const MeshBackdrop: React.FC<{ keys: MeshKey[]; t: number; position?: V3; size?: [number, number]; inset?: number; rate?: number }> = ({
  keys, t, position = [0, 0, -5], size = [18, 10.2], inset = 0.24, rate = 12 }) => {
  const tex = useCanvasTex(1024, 576, (c, w, h) => paintMesh(c, w, h, meshFlow(keys, t), inset), [keys, Math.round(t * rate)]);
  return (
    <mesh position={position}>
      <planeGeometry args={size} />
      <meshBasicMaterial map={tex} toneMapped={false} />
    </mesh>
  );
};

/** a vertical two-colour gradient as the scene background (no geometry: it never parallaxes) */
export const SkyGradient: React.FC<{ top: string; bottom: string }> = ({ top, bottom }) => {
  const tex = React.useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 4;
    c.height = 256;
    const x = c.getContext("2d")!;
    const g = x.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, top);
    g.addColorStop(1, bottom);
    x.fillStyle = g;
    x.fillRect(0, 0, 4, 256);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [top, bottom]);
  React.useEffect(() => () => tex.dispose(), [tex]);
  return <primitive attach="background" object={tex} />;
};
