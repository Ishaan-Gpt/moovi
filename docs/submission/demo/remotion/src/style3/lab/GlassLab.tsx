import React from "react";
import * as THREE from "three";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useFrame, useThree } from "@react-three/fiber";
import { MeshTransmissionMaterial } from "@react-three/drei";
import { E, FONT, FPS, H, V3, W, drift, kf, kf3, pr, rand, roundRect, roundedPlane, roundedSlab, useCanvasTex, useFonts } from "../lib";
import { Post } from "../post";
import { Logo } from "../logo";
import { drawTiles } from "../search";
import { GlassPanel as Glass, GlassProps, StudioSlab } from "../kit/glass";
import { Cursor3D, velSmear } from "../kit/cursor";

// Style 3 glass + cursor bench (kit/glass.tsx, kit/cursor.tsx): a frosted site card with a sweeping sheen, the purple
// search panel (knurled clear glass over a purple body and a red base) with a level-1 glass query pill, a mac cursor
// whipping in with smear, a facet cursor pressing send, a small glowing cursor. 3 s, 24 fps, 16:9.
//   mode "mtm": the site card drawn with drei's MeshTransmissionMaterial instead, for cost/look comparison.
//   mode "plain": every panel as a flat transparent plane (the pre-glass look), to time the glass overhead.
export const GLASSLAB_FRAMES = 72;
type Mode = "custom" | "mtm" | "plain";
export type GlassLabProps = { mode?: Mode };

// wide on the whole bench, then a push into the panel's send corner (ref 16.0–16.5 s close-up)
const camAt = (t: number) => ({
  p: kf3(t, [[0, [-0.05, 0, 3.0]], [2.25, [0.05, 0, 3.0]], [2.9, [1.02, -0.12, 1.05], E.inOut]]),
  l: kf3(t, [[0, [0, 0, 0]], [2.25, [0.02, 0, 0]], [2.9, [1.12, -0.3, 0.1], E.inOut]]),
});
const Cam: React.FC<{ t: number }> = ({ t }) => {
  const { camera } = useThree();
  useFrame(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const { p, l } = camAt(t);
    cam.position.set(p[0] + drift(t, 1, 0.03), p[1] + drift(t, 2, 0.02), p[2]);
    cam.lookAt(...l);
    cam.fov = 36;
    cam.near = 0.05;
    cam.far = 40;
    cam.updateProjectionMatrix();
  }, -1);
  return null;
};

// the pastel field behind everything: pink-violet base, soft blobs, vertical light sheets (ref 13.0 s)
const Backdrop: React.FC = () => {
  const tex = useCanvasTex(1600, 900, (c, w, h) => {
    // left: the site shot's violet-pink (ref 13.0 s), right: the search shot's salmon pink (ref 15.2 s)
    const g = c.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, "#DC8CF6");
    g.addColorStop(0.42, "#EE9AF0");
    g.addColorStop(0.62, "#F6A6C6");
    g.addColorStop(1, "#F4A3AE");
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    const blob = (x: number, y: number, r: number, col: string) => {
      const b = c.createRadialGradient(x, y, 0, x, y, r);
      b.addColorStop(0, col);
      b.addColorStop(1, "rgba(255,255,255,0)");
      c.fillStyle = b;
      c.fillRect(0, 0, w, h);
    };
    blob(w * 0.18, h * 0.85, w * 0.35, "rgba(217,51,170,0.75)");
    blob(w * 0.62, h * 0.2, w * 0.3, "rgba(255,240,252,0.9)");
    blob(w * 0.9, h * 0.75, w * 0.28, "rgba(255,120,190,0.7)");
    blob(w * 0.4, h * 0.55, w * 0.18, "rgba(150,90,255,0.55)");
    for (let i = 0; i < 5; i++) {
      const x = w * (0.12 + i * 0.19 + rand(i) * 0.05);
      const s = c.createLinearGradient(x - 60, 0, x + 60, 0);
      s.addColorStop(0, "rgba(255,255,255,0)");
      s.addColorStop(0.5, `rgba(255,255,255,${0.35 + rand(i + 7) * 0.3})`);
      s.addColorStop(1, "rgba(255,255,255,0)");
      c.fillStyle = s;
      c.fillRect(x - 60, 0, 120, h);
    }
  }, []);
  return (
    <mesh position={[0, 0, -2.2]}>
      <planeGeometry args={[9.5, 5.4]} />
      <meshBasicMaterial map={tex} toneMapped={false} />
    </mesh>
  );
};

// a few solid things between the backdrop and the glass, so the frost and the lensing have something to bend
const Shapes: React.FC<{ t: number }> = ({ t }) => (
  <>
    <mesh position={[-1.05 + Math.sin(t * 1.4) * 0.05, 0.42, -0.55]}>
      <sphereGeometry args={[0.24, 48, 32]} />
      <meshStandardMaterial color="#FFFFFF" roughness={0.35} emissive="#FFE8F6" emissiveIntensity={0.35} />
    </mesh>
    <mesh position={[-0.35, -0.2, -0.7]} rotation={[0.6, 0.3 + t * 0.4, 0]}>
      <torusGeometry args={[0.2, 0.07, 24, 64]} />
      <meshStandardMaterial color="#E0218A" roughness={0.4} />
    </mesh>
    <mesh position={[-1.25, -0.35, -0.45]} rotation={[0, 0, 0.1]}>
      <boxGeometry args={[0.06, 1.2, 0.06]} />
      <meshBasicMaterial color={new THREE.Color(1.4, 1.35, 1.45)} toneMapped={false} />
    </mesh>
    <mesh position={[1.12, -0.12, -0.35]} rotation={[0.4, 0.5 + t * 0.3, 0.2]}>
      <boxGeometry args={[0.16, 0.16, 0.16]} />
      <meshStandardMaterial color="#5B3BE0" roughness={0.45} />
    </mesh>
    <mesh position={[1.25, 0.28, -0.6]}>
      <sphereGeometry args={[0.13, 32, 24]} />
      <meshStandardMaterial color="#FFB547" roughness={0.4} />
    </mesh>
  </>
);

// ── the site hero printed on the frosted card ──
const useSiteFace = () =>
  useCanvasTex(1620, 1008, (c, w, h) => {
    c.fillStyle = "rgba(255,255,255,0.22)";
    for (let y = 40; y < h; y += 46)
      for (let x = 40; x < w; x += 46) {
        if (rand(x * 7 + y) > 0.72) {
          c.beginPath();
          c.arc(x, y, 4, 0, Math.PI * 2);
          c.fill();
        }
      }
    Logo.draw(c, 210, 110, 0.8);
    c.fillStyle = "rgba(255,255,255,0.88)";
    roundRect(c, w - 420, 82, 140, 52, 26);
    c.fill();
    c.fillStyle = "#4B1C9E";
    roundRect(c, w - 268, 82, 140, 52, 26);
    c.fill();
    c.font = `600 24px ${FONT.ui}`;
    c.textBaseline = "middle";
    c.fillStyle = "#3B2A55";
    c.fillText("Sign up", w - 392, 109);
    c.fillStyle = "#FFFFFF";
    c.fillText("Sign in", w - 238, 109);
    drawTiles(c, w / 2, 400, 1.15);
    c.font = `500 40px ${FONT.ui}`;
    c.fillStyle = "#FFFFFF";
    c.textAlign = "center";
    c.fillText("Shop smarter. Find the right item faster.", w / 2, 540);
    c.textAlign = "left";
    c.strokeStyle = "rgba(255,255,255,0.85)";
    c.lineWidth = 3;
    c.fillStyle = "rgba(255,255,255,0.12)";
    roundRect(c, w / 2 - 340, 600, 680, 200, 22);
    c.fill();
    c.stroke();
    c.font = `400 22px ${FONT.ui}`;
    c.fillStyle = "rgba(255,255,255,0.75)";
    c.fillText("Search anything...", w / 2 - 316, 636);
  }, []);

// ── the purple search body (under the knurled clear glass) and the floating query ──
const QUERY = "Best quality budget headphones";
const usePanelFace = (n: number, caret: boolean) =>
  useCanvasTex(1800, 500, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, "#5A3290");
    g.addColorStop(0.5, "#40237F");
    g.addColorStop(1, "#4E2A88");
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 22; i++) {
      const x = rand(i * 3) * w, y = rand(i * 3 + 1) * h, r = 120 + rand(i * 3 + 2) * 260;
      const gg = c.createRadialGradient(x, y, 0, x, y, r);
      gg.addColorStop(0, i % 3 ? "rgba(40,16,110,0.35)" : "rgba(190,130,255,0.25)");
      gg.addColorStop(1, "rgba(0,0,0,0)");
      c.fillStyle = gg;
      c.fillRect(0, 0, w, h);
    }
    c.font = `300 84px ${FONT.ui}`;
    c.textBaseline = "middle";
    c.fillStyle = "rgba(255,255,255,0.92)";
    c.fillText(QUERY.slice(0, n) + (caret ? "|" : ""), 80, 150);
    c.strokeStyle = "rgba(255,255,255,0.7)";
    c.lineWidth = 5;
    roundRect(c, w - 300, h - 150, 64, 54, 9);
    c.stroke();
  }, [n, caret]);
const usePillFace = () =>
  useCanvasTex(1240, 150, (c, w, h) => {
    c.font = `700 70px ${FONT.ui}`;
    c.textBaseline = "middle";
    c.fillStyle = "rgba(255,255,255,0.95)";
    c.fillText(QUERY, 64, h / 2 + 3);
    void w;
  }, []);
const useSendFace = (lit: number) =>
  useCanvasTex(128, 128, (c, w, h) => {
    c.fillStyle = lit > 0 ? `rgb(${Math.round(37 + lit * 140)},${Math.round(32 + lit * 10)},${Math.round(58 + lit * 60)})` : "#25203A";
    c.fillRect(0, 0, w, h);
    c.strokeStyle = lit > 0 ? "#FFD0F0" : "rgba(255,255,255,0.85)";
    c.lineWidth = 9;
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(38, 90);
    c.lineTo(90, 38);
    c.moveTo(52, 38);
    c.lineTo(90, 38);
    c.lineTo(90, 76);
    c.stroke();
  }, [Math.round(lit * 10)]);

// a mock desk-room monitor: white screen, a ring of dark thumbnails (ref 1.5 s), behind the frosted search pill
const useMonitor = () =>
  useCanvasTex(900, 506, (c, w, h) => {
    c.fillStyle = "#F3F0F5";
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 46; i++) {
      const a = (i / 46) * Math.PI * 3.2, r = (0.12 + 0.3 * (i / 46)) * h;
      const x = w * 0.48 + Math.cos(a) * r * 1.3, y = h * 0.48 + Math.sin(a) * r;
      c.fillStyle = "#FFFFFF";
      c.fillRect(x - 30, y - 23, 60, 48);
      c.fillStyle = rand(i + 11) > 0.8 ? "#B23A73" : "#2B2830";
      c.fillRect(x - 27, y - 20, 54, 40);
    }
    ["#53C96B", "#F1C24D", "#EE5A70"].forEach((col, i) => {
      c.fillStyle = col;
      c.beginPath();
      c.arc(w * 0.8 + i * 22, h * 0.15, 8, 0, Math.PI * 2);
      c.fill();
    });
  }, []);
const useRoomPillFace = () =>
  useCanvasTex(1200, 170, (c, w, h) => {
    c.strokeStyle = "rgba(255,255,255,0.85)";
    c.lineWidth = 5;
    c.beginPath();
    c.arc(80, h / 2 - 5, 18, 0, Math.PI * 2);
    c.stroke();
    c.beginPath();
    c.moveTo(93, h / 2 + 8);
    c.lineTo(106, h / 2 + 22);
    c.stroke();
    c.font = `500 70px ${FONT.ui}`;
    c.textBaseline = "middle";
    c.fillStyle = "#FFFFFF";
    c.fillText("isn't searching|", 170, h / 2 + 2);
    void w;
  }, []);

const PRESS = 2.0;

const MtmCard: React.FC<{ face: THREE.Texture }> = ({ face }) => {
  const geo = React.useMemo(() => roundedSlab(1.35, 0.84, 0.03, 0.06), []);
  React.useEffect(() => () => geo.dispose(), [geo]);
  return (
    <>
      <mesh geometry={geo}>
        <MeshTransmissionMaterial samples={10} resolution={1024} roughness={0.55} thickness={0.08} ior={1.3} chromaticAberration={0} anisotropicBlur={0.3} distortion={0} temporalDistortion={0} color="#E6D2FF" backside={false} />
      </mesh>
      <mesh position={[0, 0, 0.016]}>
        <planeGeometry args={[1.35, 0.84]} />
        <meshBasicMaterial map={face} transparent toneMapped={false} />
      </mesh>
    </>
  );
};

// "plain" mode: the same panels as flat transparent planes (how the shots drew glass before), to time the glass overhead
const PlainPanel: React.FC<GlassProps> = ({ w, h, position, rotation, scale = 1, face, under = [], children }) => {
  const geo = React.useMemo(() => roundedPlane(w, h, Math.min(w, h) * 0.08), [w, h]);
  React.useEffect(() => () => geo.dispose(), [geo]);
  return (
    <group position={position} rotation={rotation} scale={scale}>
      {under.map((s, i) => (
        <StudioSlab key={i} w={s.w ?? w} h={s.h ?? h} depth={s.depth ?? 0.02} position={s.offset} color={s.color} face={s.face} />
      ))}
      <mesh geometry={geo}>
        <meshBasicMaterial color="#E8D4FF" transparent opacity={0.45} toneMapped={false} />
      </mesh>
      {face && (
        <mesh geometry={geo} position={[0, 0, 0.001]}>
          <meshBasicMaterial map={face} transparent toneMapped={false} />
        </mesh>
      )}
      {children}
    </group>
  );
};

const Scene: React.FC<{ t: number; mode: Mode }> = ({ t, mode }) => {
  const GlassPanel = mode === "plain" ? PlainPanel : Glass;
  const site = useSiteFace();
  const n = Math.round(pr(t, 0.4, 1.5, (x) => x) * QUERY.length);
  const panel = usePanelFace(n, Math.floor(t * 3.2) % 2 === 0 && t < PRESS);
  const pill = usePillFace();
  const press = pr(t, PRESS - 0.05, PRESS) - pr(t, PRESS + 0.06, PRESS + 0.25);
  const send = useSendFace(pr(t, PRESS - 0.02, PRESS + 0.05));
  // mac cursor: whips in from the left edge-on, smeared, and turns to face us as it settles (ref 4.08–4.6 s)
  const macTrack = (s: number) => kf3(s, [[-0.04, [-1.3, 0.38, 0.45]], [0.42, [-0.62, 0.0, 0.32], E.out], [3, [-0.5, -0.06, 0.32], E.inOut]]);
  const macPos = macTrack(t);
  const macRot: V3 = [kf(t, [[0, 0.8], [0.5, 0.12, E.out]]), kf(t, [[0, -0.75], [0.5, -0.18, E.out]]), kf(t, [[0, 0.55], [0.55, 0.9, E.out]]) + drift(t, 4, 0.04)];
  // facet cursor: drifts in and presses the send button (ref 16.3–16.6 s)
  const fPos = kf3(t, [[0.6, [1.75, 0.35, 0.7]], [1.85, [1.27, -0.33, 0.27], E.inOut], [PRESS, [1.26, -0.34, 0.235], E.out], [2.4, [1.3, -0.3, 0.3], E.out], [3, [1.34, -0.26, 0.34]]]);
  const pillK = pr(t, PRESS + 0.08, PRESS + 0.6, E.back);
  const monitor = useMonitor();
  const roomPill = useRoomPillFace();
  return (
    <>
      <Cam t={t} />
      <color attach="background" args={["#F2A6E6"]} />
      <ambientLight intensity={1.0} />
      <directionalLight position={[-2, 3, 3]} intensity={2.0} color="#FFF0F6" />
      <Backdrop />
      <Shapes t={t} />

      {/* site card: heavy frost, sweeping sheen, soft magenta shadow (ref 12.7–13.6 s) */}
      <group position={[-0.72, 0.1, 0]} rotation={[0.03, 0.2 + drift(t, 3, 0.03), 0.01]}>
        {mode === "mtm" ? (
          <MtmCard face={site} />
        ) : (
          <GlassPanel
            w={1.35} h={0.84} depth={0.03} radius={0.06} frost={0.72} tint="#C9A0FF" tintStrength={0.16} milk={0.1} milkColor="#F2DCFF" brightness={1.06}
            face={site} glow={0.16} edge={1.0} sheen={kf(t, [[0.2, -0.25], [2.6, 1.25, E.inOut]])} sheenStrength={0.2} sheenWidth={0.14}
            shadow={0.9} shadowColor="#C21FF2" sideGlow={0.3}
          />
        )}
      </group>

      {/* search panel: clear knurled glass over the purple body and the red base, send button, query pill (ref 14–17 s) */}
      <group position={[0.78, -0.24, 0.1]} rotation={[-0.06, -0.2, 0.05]}>
        <GlassPanel
          w={1.06} h={0.28} depth={0.02} radius={0.022} frost={0.06} tint="#EDE2FF" tintStrength={0.05} milk={0.02} refract={0.6} edge={1.3} glow={0.1}
          weave={0.85} weaveScale={0.0068} sideGlow={0.7}
          under={[
            { color: "#3A1E8A", face: panel, w: 0.9, h: 0.255, offset: [-0.075, 0.0, -0.026], depth: 0.018, radius: 0.016, side: "#6B47C8" },
            { color: "#D41F4A", w: 0.92, h: 0.255, offset: [-0.065, -0.024, -0.052], depth: 0.016, radius: 0.016, gloss: 0.5 },
          ]}
        >
          <StudioSlab w={0.075} h={0.075} depth={0.034} radius={0.016} position={[0.4, -0.075, 0.03 - press * 0.012]} rotation={[0, -0.2, 0.05]} color="#25203A" face={send} gloss={0.6} side="#2E2550" />
        </GlassPanel>
        {t > PRESS + 0.08 && (
          <GlassPanel
            level={1} w={0.66} h={0.08} depth={0.016} radius={0.04} position={[-0.32 + 0.22 * pillK, 0.14 + 0.13 * pillK, 0.03 + 0.09 * pillK]} scale={0.6 + 0.4 * pillK}
            frost={0.55} tint="#5A1050" tintStrength={0.8} milk={0.88} milkColor="#4A0A40" brightness={1.0} face={pill} edge={1.1} edgeColor="#A88CFF" glow={0.1} glowColor="#8E6BFF"
            fresnel={0.12}
          />
        )}
      </group>

      {/* desk-room search pill: frosted over the monitor (ref 1.4–2.6 s) */}
      <mesh position={[-0.1, -0.62, -0.35]}>
        <planeGeometry args={[0.9, 0.506]} />
        <meshBasicMaterial map={monitor} toneMapped={false} />
      </mesh>
      <GlassPanel
        w={0.68} h={0.096} depth={0.014} radius={0.03} position={[-0.06, -0.58, 0.12]} rotation={[0, 0.06, 0]}
        frost={0.62} tint="#9A5C70" tintStrength={0.6} milk={0.12} milkColor="#C08A9C" face={roomPill} edge={1.2} glow={0.1}
      />

      <Cursor3D variant="mac" pos={macPos} rot={macRot} scale={2.3} {...velSmear(macTrack, t)} />
      {t > 0.6 && <Cursor3D variant="facet" pos={fPos} rot={[0.35, -0.45, 2.5 - press * 0.25]} scale={2.2} shadow={0.35} />}
      <Cursor3D variant="facet" pos={[-0.36, -0.6, 0.3]} rot={[0.45, -0.6, 2.6]} scale={1.3} />
      <Cursor3D variant="mac" pos={[0.32, 0.55, 0.4]} rot={[0.1, -0.1, 1.95]} scale={0.8} glow={0.6} glowColor="#9B6BFF" />
    </>
  );
};

export const GlassLab: React.FC<GlassLabProps> = ({ mode = "custom" }) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const fonts = useFonts();
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {fonts && (
        <ThreeCanvas width={W} height={H} gl={{ antialias: false, toneMapping: THREE.NoToneMapping, preserveDrawingBuffer: true }} camera={{ fov: 36, near: 0.05, far: 40, position: [0, 0, 3] }}>
          <Scene t={t} mode={mode} />
          <Post
            frame={frame}
            params={() => ({ focus: new THREE.Vector3(...camAt(t).p).distanceTo(new THREE.Vector3(...camAt(t).l)), aperture: 0.12, bloom: 0.14, threshold: 0.86, blurDir: [0, 0], zoomBlur: 0, vignette: 0.16, grain: 0.02, flash: 0, exposure: 1, agx: 0, saturation: 1.02, contrast: 0.04, ca: 0.003 })}
          />
        </ThreeCanvas>
      )}
    </AbsoluteFill>
  );
};
