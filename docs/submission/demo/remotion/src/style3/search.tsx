import React from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { E, FONT, FlowKey, V3, drift, flow, flow3, kf, pr, rand, roundRect, roundedPlane, roundedSlab, useCanvasTex } from "./lib";
import { Logo } from "./logo";
import { GlassPanel } from "./kit/glass";
import { faceCamRot } from "./kit/cursor";
import { Cursor } from "./room";
import { spring } from "./motion";
import { meshFlow, paintMesh } from "./mesh";
import { MESH_SEARCH, MESH_SITE } from "./meshes-a";

// Shots 8–9 (12.5–16 s): "your smart shopping assistant. Just describe what you want…"
// 8: the site hero inside a tilted frosted-glass card. 9: the purple search panel, fuzzy sphere, lavender sprigs.

const pinkBg = (c: CanvasRenderingContext2D, w: number, h: number, warm: number) => {
  c.fillStyle = warm > 0.5 ? "#F4919E" : "#E3A0F8"; // site shot: pink-violet (ref 13.0: #E7A2FD → #FCC9EF)
  c.fillRect(0, 0, w, h);
  const blob = (x: number, y: number, r: number, col: string) => {
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, col);
    g.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  };
  blob(w * 0.5, h * 0.35, w * 0.45, warm > 0.5 ? "rgba(255,214,222,0.9)" : "rgba(222,160,250,0.85)");
  blob(w * 0.05, h * 0.9, w * 0.5, warm > 0.5 ? "rgba(217,51,74,0.8)" : "rgba(252,201,239,0.9)");
  blob(w * 0.95, h * 0.1, w * 0.35, "rgba(255,190,220,0.7)");
  blob(w * 0.1, h * 0.1, w * 0.3, "rgba(255,255,255,0.6)");
};

// the far backdrop, painted from the ref's measured colour field (meshes-a.ts). The camera sees roughly the central
// half of this 18 × 10.2 m plane, so the field goes there; a stretched copy fills the margins.
const BgPlane: React.FC<{ warm: number; z?: number; t: number }> = ({ warm, z = -5, t }) => {
  const tex = useCanvasTex(1024, 576, (c, w, h) => {
    const g = meshFlow(warm > 0.5 ? MESH_SEARCH : MESH_SITE, t);
    paintMesh(c, w, h, g, 0.24);
  }, [warm, Math.round(t * 12)]);
  return (
    <mesh position={[0, 0, z]}>
      <planeGeometry args={[18, 10.2]} />
      <meshBasicMaterial map={tex} toneMapped={false} />
    </mesh>
  );
};

// three product tiles (desk, car, gift) drawn small, used on the site card and above the search panel
export const drawTiles = (c: CanvasRenderingContext2D, x: number, y: number, s: number) => {
  const tile = (tx: number, rot: number, draw: () => void) => {
    c.save();
    c.translate(x + tx * s, y);
    c.rotate(rot);
    c.shadowColor = "rgba(90,40,90,0.25)";
    c.shadowBlur = 14 * s;
    c.shadowOffsetY = 6 * s;
    c.fillStyle = "#FBF7FB";
    roundRect(c, -60 * s, -55 * s, 120 * s, 110 * s, 16 * s);
    c.fill();
    c.shadowColor = "transparent";
    draw();
    c.restore();
  };
  tile(-118, -0.12, () => {
    c.fillStyle = "#E9B9A0";
    c.fillRect(-40 * s, -10 * s, 80 * s, 36 * s);
    c.fillStyle = "#D99A82";
    c.fillRect(-36 * s, 26 * s, 8 * s, 20 * s);
    c.fillRect(28 * s, 26 * s, 8 * s, 20 * s);
    c.fillStyle = "#B7A7E8";
    c.fillRect(-18 * s, -34 * s, 30 * s, 22 * s);
  });
  tile(0, 0.02, () => {
    c.fillStyle = "#8DB8F0";
    roundRect(c, -46 * s, -12 * s, 92 * s, 34 * s, 14 * s);
    c.fill();
    c.fillStyle = "#A9CCF6";
    roundRect(c, -26 * s, -32 * s, 52 * s, 26 * s, 12 * s);
    c.fill();
    c.fillStyle = "#2A2D3A";
    for (const wx of [-26, 26]) {
      c.beginPath();
      c.arc(wx * s, 24 * s, 11 * s, 0, Math.PI * 2);
      c.fill();
    }
  });
  tile(118, 0.1, () => {
    c.fillStyle = "#FFFFFF";
    c.strokeStyle = "#EBC3CF";
    c.lineWidth = 3 * s;
    roundRect(c, -34 * s, -18 * s, 68 * s, 56 * s, 6 * s);
    c.fill();
    c.stroke();
    c.fillStyle = "#F07B97";
    c.fillRect(-5 * s, -18 * s, 10 * s, 56 * s);
    c.beginPath();
    c.ellipse(-14 * s, -26 * s, 14 * s, 9 * s, -0.5, 0, Math.PI * 2);
    c.ellipse(14 * s, -26 * s, 14 * s, 9 * s, 0.5, 0, Math.PI * 2);
    c.fill();
  });
};

const drawTagline = (c: CanvasRenderingContext2D, cx: number, y: number, size: number) => {
  const parts: [string, string, number][] = [["Shop ", "#9B5BD6", 400], ["smarter. ", "#7B3FC4", 700], ["Find the right item ", "#B65BC9", 400], ["faster.", "#D1307A", 700]];
  let total = 0;
  for (const [s, , wgt] of parts) {
    c.font = `${wgt} ${size}px ${FONT.ui}`;
    total += c.measureText(s).width;
  }
  let x = cx - total / 2;
  c.textBaseline = "middle";
  for (const [s, col, wgt] of parts) {
    c.font = `${wgt} ${size}px ${FONT.ui}`;
    c.fillStyle = col;
    c.fillText(s, x, y);
    x += c.measureText(s).width;
  }
};

// ── shot 8: the site hero on a frosted glass card ──
const SiteCard: React.FC<{ t: number }> = ({ t }) => {
  const tex = useCanvasTex(
    1600,
    966,
    (c, w, h) => {
      c.clearRect(0, 0, w, h); // the card body is GlassPanel; this canvas carries only the printed site
      // nav
      Logo.draw(c, 70, 70, 0.75);
      c.fillStyle = "rgba(255,255,255,0.85)";
      roundRect(c, w - 330, 52, 120, 46, 23);
      c.fill();
      c.fillStyle = "#6A3FD0";
      roundRect(c, w - 196, 52, 130, 46, 23);
      c.fill();
      c.font = `600 22px ${FONT.ui}`;
      c.fillStyle = "#3B2A55";
      c.fillText("Log in", w - 302, 82);
      c.fillStyle = "#FFFFFF";
      c.fillText("Sign up", w - 172, 82);
      drawTiles(c, w / 2, 330, 1.1);
      // ref 13.0: white tagline (bold accents) and a translucent dotted search box with a small white button
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.shadowColor = "rgba(90,30,140,0.35)";
      c.shadowBlur = 10;
      c.font = `500 34px ${FONT.ui}`;
      c.fillStyle = "#FFFFFF";
      c.fillText("Shop smarter. Find the right item faster.", w / 2, 470);
      c.shadowColor = "transparent";
      c.textAlign = "left";
      c.fillStyle = "rgba(255,255,255,0.14)";
      roundRect(c, w / 2 - 330, 520, 660, 190, 22);
      c.fill();
      c.strokeStyle = "rgba(255,255,255,0.7)";
      c.lineWidth = 3;
      c.stroke();
      c.fillStyle = "rgba(255,255,255,0.35)";
      for (let yy = 545; yy < 700; yy += 16) for (let xx = w / 2 - 315; xx < w / 2 + 315; xx += 16) if (rand(xx * 7 + yy) > 0.45) c.fillRect(xx, yy, 3, 3);
      c.font = `400 24px ${FONT.ui}`;
      c.fillStyle = "rgba(255,255,255,0.75)";
      c.fillText("Search anything...", w / 2 - 305, 548);
      c.fillStyle = "rgba(255,255,255,0.9)";
      roundRect(c, w / 2 + 268, 650, 40, 40, 8);
      c.fill();
      c.font = `500 20px ${FONT.ui}`;
      c.fillStyle = "rgba(255,255,255,0.85)";
      c.fillText("Try  ›", w / 2 - 330, 750);
      ["something unique", "mother's day", "airbuds", "decor", "clothes"].forEach((chip, i) => {
        const x = w / 2 - 250 + i * 118;
        c.fillStyle = "rgba(255,255,255,0.25)";
        roundRect(c, x, 736, 108, 28, 14);
        c.fill();
        c.font = `400 14px ${FONT.ui}`;
        c.fillStyle = "rgba(255,255,255,0.85)";
        c.fillText(chip, x + 10, 751);
      });
    },
    [],
  );
  // the card turns so its right side comes forward (ref 13.0 → 13.3), then pitches its top toward the lens as it hands
  // over to the search box: the bottom edge is 75 % of the top's width by 13.58 (≈ 43°), measured on the ref frames
  const rot = flow3(t, [[12.708, [0.0, 0.04, 0.0]], [13.0, [0.02, 0.02, 0.0]], [13.2, [0.03, -0.05, 0]], [13.33, [0.12, -0.09, -0.005]],
    [13.46, [0.32, -0.13, -0.01]], [13.58, [0.7, -0.15, -0.01]], [13.625, [0.82, -0.16, -0.01]]]);
  const pos: V3 = [0, 0, 0];
  // liquid glass (kit/glass.tsx): the backdrop blurs through, a bright rim, an inner glow, a diagonal sheen sweeps across
  // as the card turns, and a vivid violet shadow below/behind (ref 12.7–13.6)
  return (
    <group position={pos} rotation={rot}>
      <GlassPanel w={2.4} h={1.45} depth={0.04} radius={0.08} frost={0.72} tint="#B98AF5" tintStrength={0.32} milk={0.3} milkColor="#CBAAF8"
        brightness={1.06} glow={0.16} face={tex} sheen={flow(t, [[12.708, -0.25], [13.625, 1.2]])} sheenStrength={0.2} sheenWidth={0.14}
        shadow={0.9} shadowColor="#C21FF2" sideGlow={0.3} />
    </group>
  );
};

// ── shot 9: purple frosted search panel ──
const QUERY = "Best quality budget headphones";
export const SEND = 16.45; // the cursor presses send; the query lifts out as a pill
export const CUT9 = 14.75; // hidden cut: the tall empty search box becomes the slim typing bar
// ref 14.4 (face-on, camera 3.8 m): the empty box is 2.7:1 (1.94 × 0.72 m); after the cut the bar is 1.94 × 0.42
const faceH = (t: number) => (t < CUT9 ? 0.72 : 0.42);
const Panel: React.FC<{ t: number }> = ({ t }) => {
  const tall = t < CUT9;
  const fh = faceH(t);
  const n = t >= SEND ? 0 : Math.round(pr(t, 14.75, 15.55, (x) => x) * QUERY.length);
  const caret = Math.floor(t * 3.2) % 2 === 0;
  const dark = pr(t, SEND, SEND + 0.3); // the bar goes smoky once the query has lifted out (ref 16.75)
  const tex = useCanvasTex(
    1840,
    tall ? 684 : 400,
    (c, w, h) => {
      const g = c.createLinearGradient(0, 0, w, h);
      // sampled on ref frames 14.0/15.0: a dark plum-indigo panel; 16.75: smoky violet-black on the left
      g.addColorStop(0, dark > 0.5 ? "#2A1846" : "#5A3290");
      g.addColorStop(0.5, dark > 0.5 ? "#2E1A5E" : "#40237F");
      g.addColorStop(1, dark > 0.5 ? "#4A2A88" : "#4E2A88");
      c.fillStyle = g;
      roundRect(c, 0, 0, w, h, 34);
      c.fill();
      // cloudy noise
      for (let i = 0; i < 26; i++) {
        const x = rand(i * 3) * w, y = rand(i * 3 + 1) * h, r = 120 + rand(i * 3 + 2) * 260;
        const gg = c.createRadialGradient(x, y, 0, x, y, r);
        gg.addColorStop(0, i % 3 ? "rgba(70,30,160,0.28)" : "rgba(210,150,255,0.25)");
        gg.addColorStop(1, "rgba(0,0,0,0)");
        c.fillStyle = gg;
        c.fillRect(0, 0, w, h);
      }
      c.textBaseline = "middle"; // (the knurled weave is drawn by the glass on top)
      if (n === 0 && t < SEND) {
        c.font = `400 60px ${FONT.ui}`;
        c.fillStyle = "rgba(255,255,255,0.88)";
        c.fillText("Search anything...", 145, tall ? 84 : 80);
      } else if (n > 0) {
        // ref 15.4: the typed query fills ~71 % of the bar
        c.font = `300 84px ${FONT.ui}`;
        c.fillStyle = "rgba(255,255,255,0.92)";
        c.fillText(QUERY.slice(0, n) + (caret ? "|" : ""), 170, 160);
      }
      // image icon
      c.strokeStyle = "rgba(255,255,255,0.7)";
      c.lineWidth = 4;
      roundRect(c, w - 270, h - 140, 56, 48, 8);
      c.stroke();
      c.beginPath();
      c.moveTo(w - 262, h - 100);
      c.lineTo(w - 240, h - 122);
      c.lineTo(w - 222, h - 104);
      c.stroke();
    },
    [n, caret, tall, dark > 0.5],
  );
  const button = React.useMemo(() => roundedSlab(0.1, 0.1, 0.04, 0.02), []);
  React.useEffect(() => () => button.dispose(), [button]);
  // ref 13.7–17.0: a clear knurled glass slab over the dark purple printed body, a red underside slab below/behind (depth),
  // the glass a little wider than the body so its clear knurled strip shows at the right end
  // tall box: square to camera (ref 14.4); slim bar: a slight yaw and ~1° roll (ref 14.8/15.4)
  return (
    <group rotation={tall ? [0, 0, 0] : [-0.06, 0.1, 0.02]}>
      <GlassPanel w={2.1} h={fh + 0.04} depth={0.03} radius={0.04} frost={0.06} tint="#EDE2FF" tintStrength={0.05} milk={0.02} refract={0.6} edge={1.3} glow={0.1}
        weave={0.85} weaveScale={0.0085} sideGlow={0.7}
        under={[{ color: "#3A1E8A", face: tex, w: 1.94, h: fh, offset: [-0.07, 0, -0.035], depth: 0.025, radius: 0.035, side: "#6B47C8" },
          { color: "#D41F4A", w: 1.96, h: fh, offset: [-0.05, tall ? -0.06 : -0.035, -0.07], depth: 0.02, radius: 0.035, gloss: 0.5 }]}>
        {/* send button */}
        <mesh position={[0.86, tall ? -0.12 : -0.2, 0.04 - (pr(t, SEND - 0.04, SEND + 0.02) - pr(t, SEND + 0.05, SEND + 0.2)) * 0.03]} rotation={[0, -0.25, 0.05]} geometry={button}>
          <meshStandardMaterial color="#25203A" roughness={0.3} metalness={0.2} />
        </mesh>
      </GlassPanel>
    </group>
  );
};

// fur by shell texturing: N concentric spheres, strands = hashed cells that survive to a height
const FUR_VERT = `
uniform float shell; varying vec2 vUv; varying vec3 vN; varying vec3 vW;
void main(){ vUv = uv; vN = normalize(normalMatrix * normal);
  vec3 p = position * (1.0 + shell * 0.14);
  vW = (modelMatrix * vec4(p, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`;
const FUR_FRAG = `
uniform float shell; uniform vec3 root; uniform vec3 tip; uniform vec3 tip2; varying vec2 vUv; varying vec3 vN;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
void main(){
  vec2 g = vUv * vec2(420.0, 210.0);
  vec2 cell = floor(g); vec2 f = fract(g) - 0.5;
  float len = 0.35 + 0.65 * h(cell);
  if (shell > 0.0 && (shell > len || length(f) > 0.5 * (1.0 - shell / len) + 0.04)) discard;
  float lam = max(dot(vN, normalize(vec3(-0.45, 0.6, 0.66))), 0.0);
  float rim = pow(1.0 - max(vN.z, 0.0), 2.0);
  // ref 14.4–16.4: mottled, magenta tufts and peach-pink patches
  float m = smoothstep(0.35, 0.75, vn(vUv * vec2(9.0, 5.0)) * 0.7 + vn(vUv * vec2(23.0, 12.0)) * 0.3);
  vec3 c = mix(root, mix(tip, tip2, m), 0.25 + 0.75 * shell) * (0.3 + 0.85 * lam) + vec3(1.0, 0.62, 0.72) * rim * 0.35 * shell;
  gl_FragColor = vec4(c, 1.0);
}`;
const Fuzz: React.FC<{ pos: V3; r: number }> = ({ pos, r }) => {
  const shells = React.useMemo(() => {
    const geo = new THREE.SphereGeometry(r, 64, 48);
    return Array.from({ length: 22 }, (_, i) => {
      const m = new THREE.ShaderMaterial({
        vertexShader: FUR_VERT,
        fragmentShader: FUR_FRAG,
        // measured on the ref (14.4–16.2 s): shadow #42000E, mid #87194B, highlights #E066B4
        uniforms: { shell: { value: i / 21 }, root: { value: new THREE.Color("#3A000C") }, tip: { value: new THREE.Color("#C8408E") }, tip2: { value: new THREE.Color("#F0A0AE") } },
      });
      return { geo, m };
    });
  }, [r]);
  return (
    <group position={pos}>
      {shells.map((s, i) => (
        <mesh key={i} geometry={s.geo} material={s.m} />
      ))}
    </group>
  );
};

// lavender sprigs: a dense bush of tiny florets on a few spikes, centred on the bar's end (ref 14.4: ~0.3 m across)
const Sprig: React.FC<{ pos: V3; rot: V3; seed: number; size?: number }> = ({ pos, rot, seed, size = 1 }) => {
  const florets = React.useMemo(
    () =>
      Array.from({ length: 160 }, (_, i) => {
        const spike = i % 7, k = rand(seed * 300 + i * 3);
        const lean = (spike - 3) * 0.16 + (rand(seed * 50 + spike) - 0.5) * 0.2;
        const a = rand(seed * 100 + i) * Math.PI * 2, rr = 0.006 + 0.018 * (1 - k) * rand(seed * 77 + i);
        const y = -0.08 + k * 0.22 * (0.7 + 0.3 * rand(seed * 9 + spike));
        return {
          p: [Math.sin(lean) * (y + 0.08) + Math.cos(a) * rr, y, Math.sin(a) * rr + (rand(seed * 13 + spike) - 0.5) * 0.06] as V3,
          s: (0.006 + rand(seed + i * 7) * 0.007) * (1.15 - k * 0.4),
          c: k > 0.55 ? "#6A58D8" : k > 0.25 ? "#4334A8" : "#261A6A",
        };
      }),
    [seed],
  );
  return (
    <group position={pos} rotation={rot} scale={size}>
      {florets.map((f, i) => (
        <mesh key={i} position={f.p}>
          <sphereGeometry args={[f.s, 8, 6]} />
          <meshStandardMaterial color={f.c} roughness={0.7} />
        </mesh>
      ))}
    </group>
  );
};

// tiles + tagline + chips as one canvas plane above/below the panel
const Furniture: React.FC = () => {
  const tex = useCanvasTex(
    1900,
    1300,
    (c, w) => {
      drawTiles(c, w / 2, 130, 1.25);
      drawTagline(c, w / 2, 300, 66);
      c.font = `400 48px ${FONT.ui}`;
      c.fillStyle = "rgba(255,255,255,0.75)";
      c.fillText("Try  ▸", 70, 1140);
      const chips = ["something unique", "mother's day", "airbuds", "decor", "clothes"];
      let x = 270;
      c.font = `500 36px ${FONT.ui}`;
      for (const s of chips) {
        const cw = c.measureText(s).width + 64;
        c.fillStyle = "#C9307E";
        roundRect(c, x, 1105, cw, 64, 32);
        c.fill();
        c.fillStyle = "rgba(255,230,242,0.95)";
        c.fillText(s, x + 32, 1150);
        x += cw + 24;
      }
    },
    [],
  );
  return (
    <mesh position={[0, 0.06, -0.02]}>
      <planeGeometry args={[2.4, 1.64]} />
      <meshBasicMaterial map={tex} transparent toneMapped={false} depthWrite={false} />
    </mesh>
  );
};

const searchCamAt = (t: number): { p: V3; l: V3 } => {
  const shot9 = t >= 13.625;
  const p = shot9
    ? flow3(t, [[13.625, [0, 0.14, 1.75]], [13.75, [0, 0.06, 3.38]], [13.875, [0, 0.04, 3.55]], [14.0, [0, 0.03, 3.65]], [14.4, [0, 0.03, 3.82]], [14.745, [0, 0.03, 3.9]],
        [14.75, [0.04, 0.09, 2.95], "cut"], [15.2, [0.02, 0.06, 2.72]], [15.58, [0.05, 0.05, 2.5]],
        [15.72, [0.66, -0.03, 1.5]], [16.0, [0.7, -0.035, 1.46]], [16.42, [0.73, -0.04, 1.43]], [16.55, [0.72, 0.03, 1.66]], [16.75, [0.72, 0.045, 1.7]], [17.04, [0.73, 0.05, 1.74]], [17.25, [0.74, 0.055, 1.78]]])
    : // ref 12.708: opens tight on the card's top-left (the logo), pulls back in ~0.2 s, then drifts (card ~66 % wide)
      flow3(t, [[12.708, [-0.82, 0.56, 1.04]], [12.75, [-0.06, 0.08, 2.72]], [12.92, [0.02, 0.04, 3.05]], [13.625, [0.06, 0.0, 3.2]]]);
  const l = shot9
    ? flow3(t, [[13.625, [0, 0.0, 0]], [13.75, [0, 0.03, 0]], [14.745, [0, 0.03, 0]],
        [14.75, [0.04, 0.03, 0], "cut"], [15.58, [0.05, 0.02, 0]],
        [15.72, [0.66, -0.04, 0]], [16.42, [0.73, -0.05, 0]], [16.55, [0.72, 0.03, 0]], [17.25, [0.74, 0.05, 0]]])
    : flow3(t, [[12.708, [-0.82, 0.56, 0]], [12.75, [-0.05, 0.05, 0]], [12.92, [0.0, 0.01, 0]], [13.625, [0.03, 0.0, 0]]]);
  return { p, l };
};

const Cam: React.FC<{ t: number }> = ({ t }) => {
  const { camera } = useThree();
  useFrame(() => {
    // ref A: 9a 13.625 low angle under the tilting panel (camfit) · hard cut 14.75 to 9b, frontal and closer · 15.58–15.72
    // a 4-frame push into the end of the typed query (9c) · 16.42–16.55 a 3-frame pull back to a low wide (9d)
    // flowing curves (flow3): the push/pull moves keep their speed through the keys; 14.75 is a hard cut. 16.55–17.25 by eye:
    // close and low under the panel's right end, looking up-left (the 16.54 camfit fell into a frontal local optimum)
    // re-measured 2026-10-11 from the panel's size on frame (face 1.94 m wide): 13.625 a 3-frame pull back from 1.7 m off the
    // flat box, 14.4 face-on at 3.8 m · cut · 14.8 bar at 2.9 m, 15.5 at 2.45 m · 15.58–15.72 push to ~1.45 m on the
    // bar's right end (text "budget headphones|" left, send button at 70 % x) · 16.55 back to ~1.65 m with the pill above
    // (a low camera left of the bar's end, solved from four landmarks, scored worse: it saw the backdrop's pale top + chips)
    const { p, l } = searchCamAt(t);
    camera.position.set(p[0] + drift(t, 11, 0.015), p[1] + drift(t, 12, 0.01), p[2]);
    camera.lookAt(...l);
    (camera as THREE.PerspectiveCamera).fov = 36;
    (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
  }, -1);
  return null;
};

const curPos9 = (t: number) => flow3(t, [[15.6, [1.3, 0.2, 0.55]], [15.78, [0.95, -0.18, 0.08]], [16.1, [0.93, -0.17, 0.06]], [16.38, [0.92, -0.19, 0.04]], [SEND, [0.9, -0.2, -0.02]], [16.8, [0.95, -0.17, 0.05]], [17.25, [1.2, 0.1, 0.5]]]);

// the query lifts out of the input as a dark pill and hangs above the panel (ref 16.75 s)
const QueryPill: React.FC<{ t: number }> = ({ t }) => {
  // text only: the pill body is dark plum glass (level 1: it floats over the panel's glass)
  const tex = useCanvasTex(1400, 120, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.fillStyle = "rgba(255,255,255,0.95)";
    c.font = `700 62px ${FONT.ui}`;
    c.textBaseline = "middle";
    c.fillText(QUERY, 60, h / 2 + 3);
  }, []);
  const k = spring(t, SEND + 0.08, 2.3, 0.55);
  if (t < SEND + 0.08) return null;
  const sc = 0.55 + 0.45 * k;
  return (
    <group rotation={[-0.06, 0.1, 0]}>
      {/* ref 16.5–17.1: the lifted query rises out of the bar and hangs level above its right half */}
      <GlassPanel level={1} w={0.86} h={0.086} depth={0.016} radius={0.043} position={[0.3 + 0.52 * k, 0.0 + 0.27 * k, 0.1 + 0.08 * k]} scale={sc}
        frost={0.55} tint="#5A1050" tintStrength={0.8} milk={0.88} milkColor="#4A0A40" edge={1.1} edgeColor="#A88CFF" glow={0.1} fresnel={0.12} face={tex} />
    </group>
  );
};


export const SearchShot: React.FC<{ t: number; noCam?: boolean }> = ({ t, noCam }) => {
  const shot9 = t >= 13.625;
  return (
    <>
      {!noCam && <Cam t={t} />}
      <color attach="background" args={["#F4A8BE"]} />
      <BgPlane warm={shot9 ? 1 : 0} t={t} />
      <ambientLight intensity={1.1} />
      <directionalLight position={[-2, 3, 3]} intensity={2.2} color="#FFF0F4" />
      <pointLight position={[1.5, -0.5, 1.2]} intensity={2} color="#FF7AB0" />
      {!shot9 && <SiteCard t={t} />}
      {shot9 && (
        <>
          <group position={[0, 0.02, 0]}>
            <Furniture />
          </group>
          {/* ref 13.625–14.25: the box lies nearly flat (face up, we look down on its layers) and swings up to face the
              camera, measured from its on-frame aspect: −1.2 → −0.8 (13.75) → −0.47 (14.0) → −0.25 (14.125) → 0 (14.25+) */}
          <group position={[0, -0.02, 0.05]} rotation={[t < CUT9 ? flow(t, [[13.625, -1.2], [13.75, -0.8], [13.875, -0.66], [14.0, -0.47], [14.125, -0.25], [14.25, -0.07], [14.4, 0], [14.745, 0.02]]) : 0, 0, 0]}>
            <Panel t={t} />
          </group>
          <Fuzz pos={[1.25 + drift(t, 13, 0.01), -0.42, -0.15]} r={0.5} />
          <QueryPill t={t} />
          {t > 15.6 && (
            // ref 15.75–16.42: the dart is already on the send button, nudging it; presses at SEND, slides off after
            <Cursor
              pos={curPos9(t)}
              rot={faceCamRot(curPos9(t), searchCamAt(t).p, -0.6 + (pr(t, SEND - 0.06, SEND) - pr(t, SEND, SEND + 0.2)) * 0.3)}
              scale={1.4}
              color="#D3206A"
            />
          )}
          {/* ref 13.875+: one bush at each end of the box/bar, over its top corner (tall box) or mid-end (slim bar) */}
          {t >= 13.8 && (
            <group position={[0, -0.02, 0.05]}>
              <Sprig pos={t < CUT9 ? [-1.03, 0.25, 0.06] : [-1.08, 0.09, 0.06]} rot={[0.15, 0, 0.35]} seed={1} size={1.5} />
              <Sprig pos={t < CUT9 ? [1.08, 0.28, 0.06] : [1.07, 0.15, 0.06]} rot={[0.1, 0, -0.3]} seed={2} size={1.15} />
            </group>
          )}
        </>
      )}
    </>
  );
};

const FOCUS9: FlowKey[] = [[13.625, 1.7], [13.75, 3.3], [14.4, 3.77], [14.745, 3.85], [14.75, 2.9, "cut"], [15.58, 2.45], [15.72, 1.45], [16.42, 1.38], [16.55, 1.62], [17.25, 1.73]];
export const searchPost = (t: number) => {
  // ref 16.94–17.21 (measured frame means): the whole frame mixes toward one pink-magenta-white (#FAAAFA) — 15 % at
  // 16.96, 31 % at 17.0, 47 % at 17.04, 65 % at 17.08, 80 % at 17.12, ~92 % by 17.17 (display space) — before the radial
  // bloom carry at 17.23. post.tsx mixes in linear light, so the keys are ~0.85× and the colour is linear.
  const build = flow(t, [[16.94, 0], [16.96, 0.13], [17.0, 0.27], [17.04, 0.41], [17.08, 0.56], [17.12, 0.7], [17.17, 0.82], [17.21, 0.85], [17.23, 0.86]], true);
  return {
    focus: t < 13.625 ? 3.0 : flow(t, FOCUS9),
    aperture: t < 13.625 ? 0.35 : 0.3,
    bloom: flow(t, [[16.95, 0.2], [17.23, 0.9]], true),
    threshold: flow(t, [[16.95, 0.82], [17.23, 0.45]], true),
    blurDir: [kf(t, [[12.5, -0.01], [12.7, 0]]) + kf(t, [[13.625, 0.008], [13.8, 0]]), 0] as [number, number],
    zoomBlur: 0,
    vignette: 0.2,
    grain: 0.03,
    flash: build,
    flashColor: [0.955, 0.4, 0.955] as [number, number, number],
    exposure: 1.0,
    saturation: 1.05,
    contrast: 0.04,
    ca: 0.005,
    agx: 0,
  };
};
