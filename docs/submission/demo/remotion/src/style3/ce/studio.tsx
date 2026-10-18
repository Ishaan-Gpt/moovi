import React from "react";
import * as THREE from "three";
import { Bake, E, FONT, RoomAssets, drift, kf, kf3, rand, roundRect, useCanvasTex } from "../lib";
import { Cursor } from "../room";
import { Debris } from "../assets3d";
import { RigCamera, rigPost } from "../rig";
import { studioRig } from "./cams";
import { BRAND, LOOK_NAMES, PREMIUM, useAtlas } from "./shared";

// Shot 1 (0–2.32 s) "Every creator has a vibe.": the dusk studio (studio.py), baked; screens play real CaptionsEasy output.
// Blender (x, y, z) → three (x, z, -y). Camera: cams.ts studioRig (one push, whip at 1.0, spike on "vibe", rush in).
const SCREEN = { x: 0.24, y: 1.19, z: 0.2135, w: 0.59, h: 0.32 };
const PHONE = { x: 1.0483, y: 1.3, z: 0.7964, w: 0.074, h: 0.155, ry: (18 * Math.PI) / 180 };
const DUST: [[number, number, number], [number, number, number]] = [[-0.4, 0.85, 1.0], [1.0, 1.55, 3.9]];

// the editor on the monitor: dark UI chrome (looks rail, timeline) around the vertical preview
const EditorChrome: React.FC<{ t: number }> = ({ t }) => {
  const tex = useCanvasTex(
    1180,
    640,
    (c, w, h) => {
      c.fillStyle = "#16141D";
      c.fillRect(0, 0, w, h);
      c.fillStyle = "#211E2B";
      c.fillRect(0, 0, 250, h);
      c.fillRect(w - 250, 0, 250, h);
      c.font = `600 20px ${FONT.ui}`;
      c.fillStyle = "#EDE7FF";
      c.fillText("Looks", 24, 40);
      for (let i = 0; i < 6; i++) {
        const sel = i === 2;
        c.fillStyle = sel ? "#3A2F55" : "#2A2636";
        roundRect(c, 20, 60 + i * 86, 210, 74, 12);
        c.fill();
        if (sel) {
          c.strokeStyle = BRAND.mint;
          c.lineWidth = 3;
          c.stroke();
        }
        c.font = `800 22px ${FONT.sans}`;
        c.fillStyle = ["#9FF05A", "#FF5A6E", "#FFD23F", "#F4F1FF", "#7FE3FF", "#FFB0D6"][i];
        c.fillText(["SLAM", "Glow", "POP", "Soft", "Ice", "Duo"][i], 40, 104 + i * 86);
        c.font = `500 14px ${FONT.ui}`;
        c.fillStyle = "#9B95AE";
        c.fillText(LOOK_NAMES[i][0], 120, 104 + i * 86);
      }
      c.font = `600 18px ${FONT.ui}`;
      c.fillStyle = "#EDE7FF";
      c.fillText("Style", w - 226, 40);
      for (let i = 0; i < 5; i++) {
        c.fillStyle = "#2A2636";
        roundRect(c, w - 230, 60 + i * 56, 210, 40, 10);
        c.fill();
        c.fillStyle = [BRAND.apricot, BRAND.mint, "#B7A0F2", "#FF7FB0", "#F4F1FF"][i];
        c.beginPath();
        c.arc(w - 206, 80 + i * 56, 9, 0, Math.PI * 2);
        c.fill();
      }
      // timeline with a moving playhead
      c.fillStyle = "#211E2B";
      c.fillRect(250, h - 110, w - 500, 110);
      for (let i = 0; i < 9; i++) {
        c.fillStyle = i % 3 === 0 ? "#6E56C8" : i % 3 === 1 ? "#2FA77D" : "#C9781F";
        roundRect(c, 268 + i * 74, h - 92 + (i % 2) * 34, 64 + (i % 3) * 8, 26, 8);
        c.fill();
      }
      const ph = 268 + ((t * 120) % (w - 540));
      c.fillStyle = BRAND.apricot;
      c.fillRect(ph, h - 108, 3, 106);
      // tiny window controls
      ["#FF6159", "#FFBD2E", "#28C941"].forEach((col, i) => {
        c.fillStyle = col;
        c.beginPath();
        c.arc(w - 60 + i * 18, 18, 6, 0, Math.PI * 2);
        c.fill();
      });
      // grain of light leaking from the preview
      for (let i = 0; i < 30; i++) {
        c.fillStyle = `rgba(255,255,255,${0.02 + rand(i) * 0.03})`;
        c.fillRect(rand(i + 5) * w, rand(i + 9) * h, 2, 2);
      }
    },
    [Math.round(t * 12)],
  );
  return (
    <mesh position={[SCREEN.x, SCREEN.y, SCREEN.z]}>
      <planeGeometry args={[SCREEN.w, SCREEN.h]} />
      <meshBasicMaterial map={tex} color={new THREE.Color(1.6, 1.6, 1.6)} toneMapped={false} />
    </mesh>
  );
};

const Screens: React.FC<{ t: number }> = ({ t }) => {
  const tiles = useAtlas(PREMIUM, 4, 1);
  const ph = SCREEN.h * 0.62;
  return (
    <>
      <EditorChrome t={t} />
      {tiles && (
        <>
          <mesh position={[SCREEN.x, SCREEN.y + SCREEN.h * 0.08, SCREEN.z + 0.001]}>
            <planeGeometry args={[ph * (9 / 16), ph]} />
            <meshBasicMaterial map={tiles[2]} color={new THREE.Color(1.8, 1.8, 1.8)} toneMapped={false} />
          </mesh>
          <mesh position={[PHONE.x, PHONE.y, PHONE.z + 0.0006]} rotation={[0, PHONE.ry, 0]}>
            <planeGeometry args={[PHONE.w, PHONE.h]} />
            <meshBasicMaterial map={tiles[0]} color={new THREE.Color(2.2, 2.2, 2.2)} toneMapped={false} />
          </mesh>
        </>
      )}
    </>
  );
};

// dusk sky behind the window
const Sky: React.FC = () => {
  const tex = useCanvasTex(
    512,
    512,
    (c, w, h) => {
      const g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "#5B4BB8");
      g.addColorStop(0.35, "#B07AD8");
      g.addColorStop(0.62, "#FF9FB4");
      g.addColorStop(0.85, "#FFC07A");
      g.addColorStop(1, "#FFD9A0");
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
      const sun = c.createRadialGradient(w * 0.35, h * 0.8, 0, w * 0.35, h * 0.8, w * 0.3);
      sun.addColorStop(0, "rgba(255,240,210,1)");
      sun.addColorStop(1, "rgba(255,240,210,0)");
      c.fillStyle = sun;
      c.fillRect(0, 0, w, h);
    },
    [],
  );
  return (
    <mesh position={[-0.89, 1.45, -1.4]}>
      <planeGeometry args={[3.2, 2.4]} />
      <meshBasicMaterial map={tex} color={new THREE.Color(2.4, 2.4, 2.4)} toneMapped={false} />
    </mesh>
  );
};

const GLOW: Record<string, [string, number]> = {
  ring: ["#FFF3E4", 6], globe: ["#FFC27A", 5], neon_bubble: ["#FF7FB0", 7], neon_tail: ["#FF7FB0", 7],
  neon_bar0: ["#FF7FB0", 7], neon_bar1: ["#FFA946", 7], neon_bar2: ["#5BF0B8", 7],
};
const Studio: React.FC<{ room: RoomAssets }> = ({ room }) => {
  const obj = React.useMemo(() => {
    const s = room.scene.clone(true);
    const baked = new Map<string, Bake>();
    room.bakes.forEach((b, n) => baked.set(THREE.PropertyBinding.sanitizeNodeName(n), b));
    s.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const name = baked.has(m.name) || GLOW[m.name] || ["screen", "phone_screen", "sky"].includes(m.name) ? m.name : m.parent?.name ?? m.name;
      const b = baked.get(name);
      if (b) {
        m.material = new THREE.MeshBasicMaterial({ map: b.col, lightMap: b.light, lightMapIntensity: Math.PI, toneMapped: false });
      } else if (GLOW[name]) {
        const [col, k] = GLOW[name];
        m.material = new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(k), toneMapped: false });
      } else if (["screen", "phone_screen", "sky"].includes(name)) {
        m.visible = false;
      } else {
        const old = m.material as THREE.MeshStandardMaterial;
        m.material = new THREE.MeshStandardMaterial({ color: old.color, roughness: Math.max(0.5, old.roughness), metalness: 0 });
      }
    });
    return s;
  }, [room]);
  const sun = room.info.sunDir;
  return (
    <>
      <primitive object={obj} />
      <hemisphereLight args={["#D9CCFF", "#8A6A9A", 1.5]} />
      <directionalLight position={[-sun[0] * 6, -sun[1] * 6, -sun[2] * 6]} intensity={1.4} color="#FFC08A" />
      <pointLight position={[0.24, 1.15, 0.6]} intensity={0.5} distance={1.4} decay={2} color="#E6E0FF" />
      <pointLight position={[0.82, 1.62, 0.15]} intensity={0.6} distance={1.2} decay={2} color="#FF8FC0" />
      <pointLight position={[1.42, 1.6, 0.32]} intensity={1.2} distance={2.0} decay={2} color="#FFB466" />
    </>
  );
};

export const StudioShot: React.FC<{ t: number; room: RoomAssets }> = ({ t, room }) => (
  <>
    <RigCamera rig={studioRig} t={t} near={0.05} far={40} />
    <color attach="background" args={["#7E6AC4"]} />
    <Studio room={room} />
    <Sky />
    <Screens t={t} />
    {/* dust in the dusk light between the lens and the desk: the push travels through it */}
    <Debris s={t} n={60} seed={12} box={DUST} color="#FFE6CC" size={[0.006, 0.014]} fall={0.03} spin={0.5} />
    {t < 2.2 && (
      <Cursor
        pos={kf3(t, [[0.1, [-0.7, 1.45, 1.2]], [0.95, [-0.3, 1.3, 0.9], E.inOut], [1.8, [0.12, 1.12, 0.7], E.inOut], [2.2, [0.6, 0.95, 1.2], E.in]])}
        rot={[0.35 + drift(t, 4, 0.15), -0.5 + drift(t, 5, 0.2), 2.5 + drift(t, 6, 0.25)]}
        scale={kf(t, [[0.9, 1.7], [1.1, 1.3]])}
        color="#8A5CF0"
      />
    )}
  </>
);

// follow focus + physical motion blur from the rig; the zoom-blur kick into the white bloom stays as a creative extra
export const studioPost = (t: number) =>
  rigPost(studioRig, t, {
    aperture: kf(t, [[0, 0.45], [1.9, 0.7], [2.32, 0.15]]),
    bloom: kf(t, [[0, 0.3], [2.0, 0.35], [2.3, 1.4]]),
    threshold: kf(t, [[0, 0.78], [2.0, 0.7], [2.3, 0.3]]),
    zoomBlur: kf(t, [[1.95, 0], [2.2, 0.015, E.in], [2.32, 0.005]]),
    vignette: 0.3,
    grain: 0.035,
    flash: kf(t, [[2.05, 0], [2.3, 0.9, E.in]]),
    exposure: 1.0,
    saturation: 1.15,
    contrast: 0.2,
    ca: 0.006,
  });
