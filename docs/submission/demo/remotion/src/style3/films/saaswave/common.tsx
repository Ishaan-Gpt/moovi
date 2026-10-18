import React from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { FONT, V3, clamp01, rand, roundRect, useCanvasTex } from "../../lib";
import { FONT3D, layoutWord } from "../onbeat/studio";

// Ref B (SaasWAVE, ig-DcvVp-Qof2x) clone, shared parts: palette, the cut list (ref seconds), lights, canvas faces and the
// props every shot builds from. Private study: never posted. Breakdown: styles/style-3/breakdowns/arsacre-launches.md.

export const PAL = {
  lav: "#C3A2F0", lavDeep: "#9C77E6", lavPale: "#E7D9FA", pink: "#F29BCB", pinkHot: "#E5359A", magenta: "#D81F7F",
  cream: "#F6F2F0", white: "#FBF8FA", ink: "#2A2230", red: "#E0263A", coral: "#F2755F", orange: "#F49A3C",
  sky: "#8FD3EA", yellow: "#F6C445", grey: "#C9C4CC",
};

/** the cut list (ref seconds, 24 fps; cuts.txt + the 8 fps sheets) */
export const T = {
  s1: 0, s3: 3.167, s4: 5.375, s5: 7.458, burst: 8.875, torn: 9.125, s7: 9.417, flash7: 11.292, s8: 11.542, s9: 13.333,
  pink: 15.417, s11: 15.75, panel: 17.292, s12: 18.583, files: 19.75, s13: 20.208, s14: 21.583, building: 22.0, real: 22.583,
  projects: 23.125, s15: 23.625, end: 26.333,
};

// ── studio reflections without an HDRI fetch; metals/glossy plastics tagged userData.envBoost get it as their own envMap ──
export const Env: React.FC<{ intensity?: number }> = ({ intensity = 0.5 }) => {
  const { gl, scene } = useThree();
  const env = React.useMemo(() => {
    const pm = new THREE.PMREMGenerator(gl);
    const tex = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    pm.dispose();
    return tex;
  }, [gl]);
  React.useEffect(() => {
    scene.environment = env;
    return () => {
      scene.environment = null;
    };
  }, [env, scene]);
  scene.environmentIntensity = intensity;
  React.useLayoutEffect(() => {
    scene.traverse((o) => {
      const mats = (o as THREE.Mesh).material;
      if (!mats) return;
      (Array.isArray(mats) ? mats : [mats]).forEach((mt) => {
        const b = mt.userData?.envBoost as number | undefined;
        const ms = mt as THREE.MeshStandardMaterial;
        if (b && ms.envMap !== env) {
          ms.envMap = env;
          ms.envMapIntensity = b;
          ms.needsUpdate = true;
        }
      });
    });
  });
  return null;
};

/** soft key from a direction with real shadow maps, low fill (the pastel washes white under heavy fill) */
export const Lights: React.FC<{ key3?: V3; keyI?: number; keyColor?: string; fill?: number; hemi?: [string, string, number]; target?: V3; span?: number; env?: number }> = ({
  key3 = [-1.2, 2.4, 1.0], keyI = 2.2, keyColor = "#FFF4F8", fill = 0.25, hemi = ["#FFFFFF", "#D9B8F0", 0.55], target = [0, 0, 0], span = 1.2, env = 0.5,
}) => {
  const light = React.useRef<THREE.DirectionalLight>(null);
  React.useLayoutEffect(() => {
    const l = light.current;
    if (!l) return;
    l.target.position.set(...target);
    l.target.updateMatrixWorld();
    const c = l.shadow.camera as THREE.OrthographicCamera;
    c.left = -span; c.right = span; c.top = span; c.bottom = -span; c.near = 0.05; c.far = 12;
    c.updateProjectionMatrix();
  });
  return (
    <>
      <Env intensity={env} />
      <ambientLight intensity={fill} />
      <hemisphereLight args={hemi} />
      <directionalLight ref={light} position={[target[0] + key3[0], target[1] + key3[1], target[2] + key3[2]]} intensity={keyI} color={keyColor} castShadow
        shadow-mapSize-width={2048} shadow-mapSize-height={2048} shadow-bias={-0.0004} shadow-normalBias={0.01} shadow-radius={6} />
    </>
  );
};

/** every mesh below casts and receives shadows */
export const Shadowed: React.FC<{ children: React.ReactNode; cast?: boolean; receive?: boolean }> = ({ children, cast = true, receive = true }) => {
  const g = React.useRef<THREE.Group>(null);
  React.useLayoutEffect(() => {
    g.current?.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = cast;
        o.receiveShadow = receive;
      }
    });
  });
  return <group ref={g}>{children}</group>;
};

// ── materials ──
export const soft = (color: string, o: Partial<THREE.MeshPhysicalMaterialParameters> = {}) =>
  new THREE.MeshPhysicalMaterial({ color, roughness: 0.5, clearcoat: 0.2, clearcoatRoughness: 0.5, sheen: 0.4, sheenColor: new THREE.Color("#FFFFFF"), sheenRoughness: 0.7, ...o });
export const useMat = (make: () => THREE.Material, deps: unknown[] = []) => {
  const m = React.useMemo(make, deps); // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => () => m.dispose(), [m]);
  return m;
};

// ── canvas faces ──
const scribble = (c: CanvasRenderingContext2D, seed: number, x: number, y: number, w: number, h: number, lines = 3, color = "rgba(70,60,80,0.55)") => {
  c.strokeStyle = color;
  c.lineWidth = Math.max(1.5, h * 0.06);
  c.lineCap = "round";
  for (let l = 0; l < lines; l++) {
    const yy = y + (l + 0.5) * (h / lines);
    const len = w * (0.55 + 0.45 * rand(seed + l));
    c.beginPath();
    c.moveTo(x, yy);
    for (let k = 1; k <= 14; k++) c.lineTo(x + (len * k) / 14, yy + Math.sin(k * 1.7 + seed) * h * 0.06 * (rand(seed * 3 + k) - 0.3));
    c.stroke();
  }
};

/** a wireframe sketch on paper (ref 0–2 s, 9.4–13 s): pencil boxes, arrows and scribbled labels */
export const drawSketch = (c: CanvasRenderingContext2D, w: number, h: number, seed = 1, paper = "#F8F5F2") => {
  c.fillStyle = paper;
  c.fillRect(0, 0, w, h);
  c.strokeStyle = "rgba(60,55,70,0.6)";
  c.lineWidth = w * 0.004;
  scribble(c, seed, w * 0.08, h * 0.04, w * 0.5, h * 0.05, 1, "rgba(60,55,70,0.65)");
  for (let i = 0; i < 6; i++) {
    const bx = w * (0.08 + (i % 2) * 0.45), by = h * (0.14 + Math.floor(i / 2) * 0.27), bw = w * 0.38, bh = h * 0.2;
    c.strokeRect(bx + rand(seed + i) * 6, by + rand(seed + i * 2) * 6, bw, bh);
    c.beginPath();
    c.moveTo(bx + bw * 0.1, by + bh * 0.8);
    c.lineTo(bx + bw * 0.45, by + bh * 0.35);
    c.lineTo(bx + bw * 0.7, by + bh * 0.6);
    c.stroke();
    scribble(c, seed + i * 7, bx + bw * 0.05, by + bh + h * 0.01, bw * 0.8, h * 0.035, 1);
  }
};

export const drawPhone = (c: CanvasRenderingContext2D, w: number, h: number) => {
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#F2A2B8");
  g.addColorStop(0.45, "#E2465A");
  g.addColorStop(1, "#B31E33");
  c.fillStyle = g;
  roundRect(c, 0, 0, w, h, w * 0.12);
  c.fill();
  c.fillStyle = "rgba(255,255,255,0.18)"; // a soft car-and-road silhouette like the wallpaper
  c.beginPath();
  c.ellipse(w * 0.5, h * 0.82, w * 0.6, h * 0.1, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "#FFFFFF";
  c.textAlign = "center";
  c.font = `600 ${w * 0.05}px ${FONT.ui}`;
  c.fillText("Tue Apr 27", w / 2, h * 0.12);
  c.font = `700 ${w * 0.24}px ${FONT.ui}`;
  c.fillText("9:41", w / 2, h * 0.29);
  c.fillStyle = "rgba(255,226,236,0.85)";
  roundRect(c, w * 0.06, h * 0.36, w * 0.88, h * 0.08, w * 0.05);
  c.fill();
  c.fillStyle = "#7B3FD0";
  c.beginPath();
  c.arc(w * 0.15, h * 0.4, w * 0.045, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "#4A2A3A";
  c.textAlign = "left";
  c.font = `700 ${w * 0.04}px ${FONT.ui}`;
  c.fillText("nonamebutcool", w * 0.23, h * 0.392);
  c.font = `500 ${w * 0.036}px ${FONT.ui}`;
  c.fillText("When will you launch Saaswave course?", w * 0.23, h * 0.418);
};

export const NOTES = [
  { user: "nonamebutcool", text: "Where da course at?", c0: "#F7A9D3", c1: "#EC72B8" },
  { user: "vectorgrapher", text: "bro pls its taking forever", c0: "#C9A6F7", c1: "#A982EE" },
  { user: "motion.vibes", text: "is course available now? I'd love to check it out", c0: "#F7B4D7", c1: "#EF86BF" },
  { user: "uiuxnerd", text: "drop the link already", c0: "#F3A0CF", c1: "#E66FB0" },
  { user: "pixelpusher", text: "when is saaswave launching?", c0: "#CDAEF7", c1: "#B08BF0" },
];
export const drawNote = (c: CanvasRenderingContext2D, w: number, h: number, i: number) => {
  const n = NOTES[i % NOTES.length];
  const g = c.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, n.c0);
  g.addColorStop(1, n.c1);
  c.fillStyle = g;
  roundRect(c, 0, 0, w, h, h * 0.28);
  c.fill();
  c.fillStyle = "rgba(255,255,255,0.35)";
  roundRect(c, 3, 3, w - 6, h * 0.45, h * 0.26);
  c.fill();
  const av = c.createRadialGradient(h * 0.42, h * 0.45, 2, h * 0.5, h * 0.5, h * 0.32);
  av.addColorStop(0, "#FFC07A");
  av.addColorStop(1, "#D9663C");
  c.fillStyle = av;
  c.beginPath();
  c.arc(h * 0.5, h * 0.5, h * 0.3, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "#FFFFFF";
  c.textAlign = "left";
  c.font = `600 ${h * 0.17}px ${FONT.ui}`;
  c.fillText(n.user, h * 0.95, h * 0.36);
  c.textAlign = "right";
  c.font = `500 ${h * 0.14}px ${FONT.ui}`;
  c.fillText("1m ago", w - h * 0.25, h * 0.34);
  c.textAlign = "left";
  c.font = `700 ${h * (n.text.length > 30 ? 0.17 : 0.22)}px ${FONT.ui}`;
  c.fillText(n.text, h * 0.95, h * 0.7);
};

/** the product site on the laptop (ref 5.4 s): big pink wordmark, a Publish pill, a pink room hero */
export const drawSite = (c: CanvasRenderingContext2D, w: number, h: number, page: "home" | "course" = "home") => {
  c.fillStyle = "#FBF4F2";
  c.fillRect(0, 0, w, h);
  if (page === "home") {
    const g = c.createLinearGradient(0, h * 0.1, 0, h * 0.3);
    g.addColorStop(0, "#F7B8C4");
    g.addColorStop(1, "#E8707E");
    c.fillStyle = g;
    c.textAlign = "center";
    c.font = `800 ${h * 0.17}px ${FONT.sans}`;
    c.fillText("SaaSWAVE", w / 2, h * 0.27);
    const hero = c.createLinearGradient(0, h * 0.55, 0, h);
    hero.addColorStop(0, "#F6C9C4");
    hero.addColorStop(1, "#E77F72");
    c.fillStyle = hero;
    roundRect(c, w * 0.05, h * 0.5, w * 0.9, h * 0.52, 20);
    c.fill();
    c.fillStyle = "#FBEDEA";
    roundRect(c, w * 0.32, h * 0.58, w * 0.36, h * 0.28, 10);
    c.fill();
    c.fillStyle = "#3A2B33";
    c.fillRect(w * 0.47, h * 0.86, w * 0.06, h * 0.08);
    c.fillStyle = "#D7B5F3";
    roundRect(c, w * 0.36, h * 0.35, w * 0.28, h * 0.11, h * 0.055);
    c.fill();
    c.fillStyle = "#8A3FC6";
    c.font = `700 ${h * 0.065}px ${FONT.sans}`;
    c.fillText("Publish", w / 2, h * 0.425);
  } else {
    c.fillStyle = "#2E2433";
    c.textAlign = "center";
    c.font = `700 ${h * 0.05}px ${FONT.sans}`;
    c.fillText("Motion Design For SaaS", w / 2, h * 0.47);
    c.font = `500 ${h * 0.026}px ${FONT.ui}`;
    c.fillStyle = "#8D7F86";
    c.fillText("The complete 3D + 2D launch-video course", w / 2, h * 0.53);
    drawSketchTiles(c, w, h);
    c.fillStyle = "#E77F72";
    roundRect(c, w * 0.42, h * 0.58, w * 0.16, h * 0.06, h * 0.03);
    c.fill();
  }
};
const drawSketchTiles = (c: CanvasRenderingContext2D, w: number, h: number) => {
  c.strokeStyle = "rgba(60,55,70,0.35)";
  c.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    const x = w * (0.08 + i * 0.18), y = h * 0.08;
    c.strokeRect(x, y, w * 0.14, h * 0.24);
    c.beginPath();
    c.moveTo(x + 10, y + h * 0.2);
    c.lineTo(x + w * 0.07, y + h * 0.06);
    c.lineTo(x + w * 0.13, y + h * 0.18);
    c.stroke();
  }
};

/** pastel sticky note with handwriting (ref 13.4–15.2 s) */
export const STICKY = ["#F9C7D8", "#FBD3A8", "#C9E9F3", "#D8C8F7", "#F7B1C2", "#BFE9D9", "#FFE2A8"];
export const drawSticky = (c: CanvasRenderingContext2D, w: number, h: number, i: number) => {
  c.fillStyle = STICKY[i % STICKY.length];
  c.fillRect(0, 0, w, h);
  c.fillStyle = "rgba(0,0,0,0.05)";
  c.fillRect(0, 0, w, h * 0.12);
  const words = ["how do I do sound design?", "where are the project files", "is the workflow easy?", "how is it rendered",
    "what plugins?", "is this blender?", "need more ideas", "how they doing this??"];
  c.fillStyle = "rgba(50,40,60,0.75)";
  c.font = `500 ${h * 0.13}px ${FONT.serif}`;
  c.textAlign = "left";
  const s = words[i % words.length].split(" ");
  let line = "", y = h * 0.34;
  for (const word of s) {
    if (c.measureText(line + word).width > w * 0.84) {
      c.fillText(line, w * 0.08, y);
      line = "";
      y += h * 0.17;
    }
    line += word + " ";
  }
  c.fillText(line, w * 0.08, y);
};

// ── props ──
/** a card with a canvas face on its front (rounded slab + face plane) */
export const FaceCard: React.FC<{ w: number; h: number; d?: number; r?: number; px: number; draw: (c: CanvasRenderingContext2D, w: number, h: number) => void; deps?: unknown[]; back?: string; glow?: number }> = ({
  w, h, d = 0.004, r, px, draw, deps = [], back = "#F3D4E8", glow = 0,
}) => {
  const tex = useCanvasTex(px, Math.round((px * h) / w), draw, deps);
  const rr = r ?? Math.min(w, h) * 0.28;
  return (
    <group>
      <RoundedBox args={[w, h, d]} radius={Math.min(rr, d / 2)} smoothness={3}>
        <meshStandardMaterial color={back} roughness={0.5} />
      </RoundedBox>
      <mesh position={[0, 0, d / 2 + 0.0004]} geometry={faceGeo(w, h, rr)}>
        <meshStandardMaterial map={tex} roughness={0.45} emissive="#FFFFFF" emissiveMap={tex} emissiveIntensity={glow} />
      </mesh>
    </group>
  );
};
const shapeCache = new Map<string, THREE.Shape>();
export const roundedShape = (w: number, h: number, r: number) => {
  const k = `${w}|${h}|${r}`;
  let s = shapeCache.get(k);
  if (!s) {
    s = new THREE.Shape();
    const x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y);
    s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r);
    s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h);
    s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r);
    s.quadraticCurveTo(x, y, x + r, y);
    shapeCache.set(k, s);
  }
  return s;
};
// shapeGeometry UVs are in shape units: remap to 0..1 so canvas faces fill the card
const fixUV = (g: THREE.BufferGeometry, w: number, h: number) => {
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / w + 0.5, p.getY(i) / h + 0.5);
  uv.needsUpdate = true;
  return g;
};
export const faceGeo = (() => {
  const cache = new Map<string, THREE.BufferGeometry>();
  return (w: number, h: number, r: number) => {
    const k = `${w}|${h}|${r}`;
    let g = cache.get(k);
    if (!g) {
      g = fixUV(new THREE.ShapeGeometry(roundedShape(w, h, r), 12), w, h);
      cache.set(k, g);
    }
    return g;
  };
})();

/** the phone lying on the desk (screen up = +z of the group; rotate the group −π/2 on x to lay it flat) */
export const Phone: React.FC = () => {
  const tex = useCanvasTex(500, 1040, drawPhone, []);
  const W = 0.0715, Hh = 0.1475;
  return (
    <group>
      <RoundedBox args={[W, Hh, 0.0085]} radius={0.004} smoothness={4}>
        <meshPhysicalMaterial color="#F0A0B4" roughness={0.3} metalness={0.4} clearcoat={0.6} />
      </RoundedBox>
      <mesh position={[0, 0, 0.00435]} geometry={faceGeo(W - 0.004, Hh - 0.004, 0.009)}>
        <meshStandardMaterial map={tex} roughness={0.2} emissive="#FFFFFF" emissiveMap={tex} emissiveIntensity={0.35} />
      </mesh>
      <mesh position={[0, Hh / 2 - 0.012, 0.0045]}>
        <planeGeometry args={[0.02, 0.006]} />
        <meshBasicMaterial color="#120A10" />
      </mesh>
    </group>
  );
};

/** a sheet of paper with a sketch; `curl` lifts one corner/edge (0 flat … 1 rolled), `bend` waves it (flight) */
export const Paper: React.FC<{ w?: number; h?: number; seed?: number; curl?: number; bend?: number; paper?: string }> = ({ w = 0.21, h = 0.297, seed = 1, curl = 0.15, bend = 0, paper }) => {
  const tex = useCanvasTex(840, Math.round((840 * h) / w), (c, cw, ch) => drawSketch(c, cw, ch, seed, paper), [seed, paper]);
  const geo = React.useMemo(() => new THREE.PlaneGeometry(w, h, 24, 32), [w, h]);
  React.useEffect(() => () => geo.dispose(), [geo]);
  React.useLayoutEffect(() => {
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const u = (geo.attributes.uv.getX(i)), v = geo.attributes.uv.getY(i);
      const x0 = (u - 0.5) * w, y0 = (v - 0.5) * h;
      // corner curl: the lower-right corner rolls up around a diagonal axis
      const d = clamp01((u - v + 0.2) / 0.6);
      const ang = curl * Math.PI * 0.9 * d * d;
      const R = 0.06;
      const rx = x0, ry = y0;
      const z = ang > 0.001 ? R * (1 - Math.cos(ang)) : 0;
      const wave = bend * 0.03 * Math.sin(u * 5 + v * 3) + bend * 0.02 * Math.sin(v * 9);
      p.setXYZ(i, rx - (ang > 0.001 ? R * (ang - Math.sin(ang)) * 0.4 : 0), ry, z + wave);
    }
    p.needsUpdate = true;
    geo.computeVertexNormals();
  });
  return (
    <mesh geometry={geo}>
      <meshStandardMaterial map={tex} roughness={0.85} side={THREE.DoubleSide} />
    </mesh>
  );
};

/** a sharpened hex pencil along +y */
export const Pencil: React.FC<{ color: string; len?: number }> = ({ color, len = 0.17 }) => (
  <group>
    <mesh position={[0, len / 2, 0]}>
      <cylinderGeometry args={[0.0035, 0.0035, len, 6]} />
      <meshStandardMaterial color={color} roughness={0.5} />
    </mesh>
    <mesh position={[0, len + 0.009, 0]}>
      <coneGeometry args={[0.0035, 0.018, 6]} />
      <meshStandardMaterial color="#E8C9A0" roughness={0.7} />
    </mesh>
    <mesh position={[0, len + 0.0165, 0]}>
      <coneGeometry args={[0.0012, 0.004, 6]} />
      <meshStandardMaterial color={color} roughness={0.6} />
    </mesh>
  </group>
);
const PENCILS = ["#E85A6B", "#5A86E0", "#7BC48F", "#E9B34A", "#B57BE8", "#F08FB9", "#5BC6D9"];

/** a perforated metal-mesh pencil cup (ref 9.4 s) with pencils; `glass` = the clear tumbler of the room shots */
export const PencilCup: React.FC<{ r?: number; h?: number; n?: number; glass?: boolean; seed?: number }> = ({ r = 0.04, h = 0.1, n = 7, glass = false, seed = 3 }) => {
  const holes = useCanvasTex(512, 256, (c, w, hh) => {
    c.fillStyle = "#FFFFFF";
    c.fillRect(0, 0, w, hh);
    c.fillStyle = "#000000";
    for (let y = 6; y < hh; y += 12) for (let x = (y / 12) % 2 ? 6 : 12; x < w; x += 12) {
      c.beginPath();
      c.arc(x, y, 3.6, 0, Math.PI * 2);
      c.fill();
    }
  }, []);
  holes.wrapS = holes.wrapT = THREE.RepeatWrapping;
  holes.repeat.set(3, 1.5);
  const mat = useMat(() =>
    glass
      ? new THREE.MeshPhysicalMaterial({ color: "#F4E9F4", roughness: 0.05, transmission: 0.9, thickness: 0.004, transparent: true, opacity: 0.45, side: THREE.DoubleSide })
      : new THREE.MeshStandardMaterial({ color: "#B9B2BE", metalness: 0.85, roughness: 0.35, alphaMap: holes, alphaTest: 0.5, side: THREE.DoubleSide, userData: { envBoost: 1.1 } }),
  [glass, holes]);
  return (
    <group>
      <mesh position={[0, h / 2, 0]} material={mat}>
        <cylinderGeometry args={[r, r * 0.92, h, 48, 1, true]} />
      </mesh>
      <mesh position={[0, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[r * 0.92, 48]} />
        <meshStandardMaterial color="#9E97A6" metalness={0.6} roughness={0.4} />
      </mesh>
      {Array.from({ length: n }, (_, i) => {
        const a = rand(seed + i) * Math.PI * 2, rr = r * 0.5 * rand(seed * 2 + i);
        return (
          <group key={i} position={[Math.cos(a) * rr, 0.004, Math.sin(a) * rr]} rotation={[(rand(seed + i * 3) - 0.5) * 0.5, 0, (rand(seed + i * 5) - 0.5) * 0.5]}>
            <Pencil color={PENCILS[i % PENCILS.length]} len={0.15 + 0.04 * rand(i + seed)} />
          </group>
        );
      })}
    </group>
  );
};

/** the gradient marker (blue → pink body, pink tip, "love" script), along +y with the nib at y 0 */
export const Marker: React.FC<{ s?: number }> = ({ s = 1 }) => {
  const body = useCanvasTex(256, 1024, (c, w, h) => {
    const g = c.createLinearGradient(0, h, 0, 0);
    g.addColorStop(0, "#F05A86");
    g.addColorStop(0.45, "#C690D8");
    g.addColorStop(1, "#86B8EE");
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    c.save();
    c.translate(w * 0.55, h * 0.3);
    c.rotate(-Math.PI / 2);
    c.fillStyle = "#D81F3F";
    c.font = `italic 700 ${w * 0.5}px ${FONT.serif}`;
    c.fillText("love", 0, 0);
    c.restore();
  }, []);
  const tipMat = useMat(() => soft("#F0507E", { roughness: 0.35, clearcoat: 0.6 }));
  return (
    <group scale={s}>
      <mesh position={[0, 0.006, 0]}>
        <cylinderGeometry args={[0.0028, 0.0018, 0.012, 16]} />
        <meshStandardMaterial color="#3A3445" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.024, 0]} material={tipMat}>
        <cylinderGeometry args={[0.009, 0.004, 0.026, 6]} />
      </mesh>
      <mesh position={[0, 0.042, 0]} material={tipMat}>
        <cylinderGeometry args={[0.0105, 0.0105, 0.012, 32]} />
      </mesh>
      <mesh position={[0, 0.115, 0]}>
        <cylinderGeometry args={[0.0105, 0.0105, 0.135, 32]} />
        <meshPhysicalMaterial map={body} roughness={0.25} clearcoat={0.8} clearcoatRoughness={0.2} />
      </mesh>
      <mesh position={[0, 0.183, 0]} material={tipMat}>
        <sphereGeometry args={[0.0105, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
    </group>
  );
};

/** a red paper clip lying flat (in the xz plane) */
const clipGeo = (() => {
  let g: THREE.TubeGeometry | null = null;
  return () => {
    if (!g) {
      const L = 0.032, Wd = 0.009;
      const pts: THREE.Vector3[] = [];
      const loop = (cx: number, r: number, a0: number, a1: number) => {
        for (let k = 0; k <= 12; k++) {
          const a = a0 + ((a1 - a0) * k) / 12;
          pts.push(new THREE.Vector3(cx + Math.cos(a) * r, 0, Math.sin(a) * r));
        }
      };
      pts.push(new THREE.Vector3(-L * 0.3, 0, -Wd * 0.5));
      loop(L * 0.5, Wd * 0.5, -Math.PI / 2, Math.PI / 2);
      pts.push(new THREE.Vector3(-L * 0.5, 0, Wd * 0.5));
      loop(-L * 0.5, Wd * 0.5, Math.PI / 2, (Math.PI * 3) / 2);
      pts.push(new THREE.Vector3(L * 0.35, 0, -Wd * 0.5));
      loop(L * 0.35, Wd * 0.32, -Math.PI / 2, Math.PI / 2);
      pts.push(new THREE.Vector3(-L * 0.3, 0, Wd * 0.14));
      g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.2), 160, 0.0011, 8, false);
    }
    return g;
  };
})();
export const PaperClip: React.FC<{ color?: string }> = ({ color = "#E8324A" }) => (
  <mesh geometry={clipGeo()}>
    <meshPhysicalMaterial color={color} roughness={0.25} clearcoat={0.7} />
  </mesh>
);

/** red-handled scissors lying flat */
export const Scissors: React.FC = () => (
  <group>
    {[-1, 1].map((k) => (
      <group key={k} rotation={[0, k * 0.18, 0]}>
        <mesh position={[-0.03, 0.003, k * 0.012]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.011, 0.0035, 10, 32]} />
          <meshPhysicalMaterial color="#E0263A" roughness={0.3} clearcoat={0.6} />
        </mesh>
        <mesh position={[0.03, 0.002, k * 0.002]}>
          <boxGeometry args={[0.07, 0.0015, 0.007]} />
          <meshStandardMaterial color="#C9C6CF" metalness={0.9} roughness={0.25} />
        </mesh>
      </group>
    ))}
  </group>
);

/** a pink umbrella: 8 gores sagging between ribs, a scalloped hem, a lavender shaft and a J handle; open 0..1 */
export const Umbrella: React.FC<{ open?: number; canopy?: string; inner?: string }> = ({ open = 1, canopy = "#F08FD0", inner = "#B65AC8" }) => {
  const geo = React.useMemo(() => {
    const NA = 128, NR = 16, R = 0.5, Hh = 0.3;
    const pos: number[] = [], uv: number[] = [], idx: number[] = [];
    for (let j = 0; j <= NR; j++) {
      const s = j / NR;
      for (let i = 0; i <= NA; i++) {
        const a = (i / NA) * Math.PI * 2;
        const between = Math.pow(Math.sin(a * 4), 2); // 0 on a rib, 1 between ribs
        const r = R * s * (1 - 0.1 * between * s);
        const y = Hh * (1 - Math.pow(s, 1.35)) - 0.06 * between * s * s;
        pos.push(Math.cos(a) * r, y, Math.sin(a) * r);
        uv.push(i / NA, s);
      }
    }
    for (let j = 0; j < NR; j++)
      for (let i = 0; i < NA; i++) {
        const a = j * (NA + 1) + i, b = a + NA + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }, []);
  React.useEffect(() => () => geo.dispose(), [geo]);
  const outer = useMat(() => soft(canopy, { side: THREE.FrontSide, roughness: 0.42, clearcoat: 0.35, sheen: 0.6 }), [canopy]);
  const innerM = useMat(() => soft(inner, { side: THREE.BackSide, roughness: 0.6 }), [inner]);
  const sy = 0.35 + 0.65 * open;
  return (
    <group>
      <group scale={[0.25 + 0.75 * open, sy, 0.25 + 0.75 * open]}>
        <mesh geometry={geo} material={outer} />
        <mesh geometry={geo} material={innerM} />
      </group>
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
        const pts = Array.from({ length: 9 }, (_, j) => {
          const s = j / 8, r = 0.5 * s * (0.25 + 0.75 * open);
          return new THREE.Vector3(Math.cos(a) * r, (0.3 * (1 - Math.pow(s, 1.35)) - 0.006) * sy, Math.sin(a) * r);
        });
        return (
          <mesh key={i}>
            <tubeGeometry args={[new THREE.CatmullRomCurve3(pts), 16, 0.0025, 5, false]} />
            <meshStandardMaterial color="#5A2A7A" roughness={0.5} />
          </mesh>
        );
      })}
      <mesh position={[0, 0.33 * sy, 0]}>
        <cylinderGeometry args={[0.006, 0.01, 0.07, 12]} />
        <meshStandardMaterial color="#8D5BD8" roughness={0.4} />
      </mesh>
      <mesh position={[0, -0.12, 0]}>
        <cylinderGeometry args={[0.006, 0.006, 0.86, 12]} />
        <meshStandardMaterial color="#9C70E6" roughness={0.35} metalness={0.3} />
      </mesh>
      <mesh position={[0.025, -0.55, 0]} rotation={[0, 0, Math.PI]}>
        <torusGeometry args={[0.025, 0.007, 10, 24, Math.PI]} />
        <meshStandardMaterial color="#9C70E6" roughness={0.35} metalness={0.3} />
      </mesh>
    </group>
  );
};

/** inflated balloon letters (ref 14.4–15.2 s "many"): TextGeometry with a fat round bevel, smooth normals, glossy */
const balloonCache = new Map<string, THREE.BufferGeometry>();
export const balloonGeo = (ch: string, size: number) => {
  const k = `${ch}|${size}`;
  let g = balloonCache.get(k);
  if (!g) {
    const t = new TextGeometry(ch, { font: FONT3D, size, depth: size * 0.12, curveSegments: 10, bevelEnabled: true, bevelThickness: size * 0.2, bevelSize: size * 0.085, bevelSegments: 8 });
    t.deleteAttribute("uv");
    t.deleteAttribute("normal");
    const m = mergeVertices(t, 1e-4);
    m.computeVertexNormals();
    m.computeBoundingBox();
    const b = m.boundingBox!;
    m.translate(-(b.min.x + b.max.x) / 2, 0, -(b.min.z + b.max.z) / 2);
    g = m;
    balloonCache.set(k, g);
  }
  return g;
};
export const BalloonWord: React.FC<{ text: string; size: number; colors: string[]; t: number; t0: number; stagger?: number }> = ({ text, size, colors, t, t0, stagger = 0.05 }) => {
  const L = React.useMemo(() => layoutWord(text, size, -0.02), [text, size]);
  const mats = React.useMemo(() => colors.map((c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.12, sheen: 0.15, sheenColor: new THREE.Color("#FFE0F2"), userData: { envBoost: 0.45 } })), [colors]);
  React.useEffect(() => () => mats.forEach((m) => m.dispose()), [mats]);
  return (
    <group>
      {L.map((l, i) => {
        const k = clamp01((t - t0 - i * stagger) / 0.28);
        const sc = k <= 0 ? 0.001 : 1 + 0.25 * Math.sin(k * Math.PI) * (1 - k) - (1 - k) * 0.6;
        return l.ch === " " ? null : (
          <mesh key={i} position={[l.x, 0, 0]} scale={Math.max(0.001, sc)} geometry={balloonGeo(l.ch, size)} material={mats[Math.min(i, mats.length - 1)]} />
        );
      })}
    </group>
  );
};

/** a yellow-orange folder (back panel + tab, front panel hinged open by `open` rad) with the "Sw" mark */
export const Folder: React.FC<{ open?: number }> = ({ open = 0.35 }) => {
  const front = useCanvasTex(640, 460, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, "#FBD46A");
    g.addColorStop(1, "#F29A3A");
    c.fillStyle = g;
    roundRect(c, 0, 0, w, h, 34);
    c.fill();
    drawSwMark(c, w * 0.5, h * 0.55, w * 0.32, "#C8152E");
  }, []);
  const backM = useMat(() => soft("#F6B347", { roughness: 0.45, clearcoat: 0.4 }));
  const W = 0.34, Hh = 0.245;
  return (
    <group>
      <RoundedBox args={[W, Hh, 0.008]} radius={0.004} smoothness={3} position={[0, Hh / 2, -0.012]} material={backM} />
      <RoundedBox args={[W * 0.36, 0.04, 0.008]} radius={0.004} smoothness={3} position={[-W * 0.3, Hh + 0.012, -0.012]} material={backM} />
      <group rotation={[open, 0, 0]}>
        <mesh position={[0, Hh * 0.45, 0.002]} geometry={faceGeo(W, Hh * 0.9, 0.02)}>
          <meshPhysicalMaterial map={front} roughness={0.4} clearcoat={0.4} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  );
};

/** the "Sw" script mark as a canvas stroke (ref end card), centred at (x, y), width w */
export const drawSwMark = (c: CanvasRenderingContext2D, x: number, y: number, w: number, color: string, k = 1) => {
  const pts = SW_PATH.map(([px, py]) => [x + (px - 0.5) * w, y + (py - 0.5) * w * 0.5] as [number, number]);
  const n = Math.max(2, Math.round(pts.length * clamp01(k)));
  c.strokeStyle = color;
  c.lineWidth = w * 0.06;
  c.lineCap = "round";
  c.lineJoin = "round";
  c.beginPath();
  c.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < n; i++) c.lineTo(pts[i][0], pts[i][1]);
  c.stroke();
};
/** a hand-drawn "Sw" in unit space (x 0..1, y 0..1 top-down): a loop S running into a w */
export const SW_PATH: [number, number][] = (() => {
  const out: [number, number][] = [];
  const ctrl: [number, number][] = [
    [0.08, 0.62], [0.12, 0.3], [0.3, 0.12], [0.42, 0.22], [0.3, 0.42], [0.14, 0.55], [0.18, 0.82], [0.36, 0.86], [0.44, 0.6],
    [0.52, 0.42], [0.56, 0.78], [0.64, 0.82], [0.7, 0.45], [0.76, 0.8], [0.84, 0.82], [0.92, 0.3],
  ];
  const c = new THREE.CatmullRomCurve3(ctrl.map(([a, b]) => new THREE.Vector3(a, b, 0)), false, "centripetal");
  for (let i = 0; i <= 160; i++) {
    const p = c.getPoint(i / 160);
    out.push([p.x, p.y]);
  }
  return out;
})();

/** a white file card with an extension label (.aep / .blend) */
export const FileCard: React.FC<{ label: string }> = ({ label }) => (
  <FaceCard w={0.2} h={0.13} d={0.004} r={0.012} px={400} back="#F4F1F6" deps={[label]}
    draw={(c, w, h) => {
      c.fillStyle = "#FBFAFC";
      c.fillRect(0, 0, w, h);
      c.fillStyle = "#1E1A22";
      c.font = `800 ${h * 0.3}px ${FONT.sans}`;
      c.textAlign = "left";
      c.fillText(label, w * 0.1, h * 0.42);
      c.fillStyle = "rgba(30,26,34,0.25)";
      c.fillRect(w * 0.1, h * 0.62, w * 0.5, h * 0.05);
      c.fillRect(w * 0.1, h * 0.74, w * 0.35, h * 0.05);
    }}
  />
);

/** the tufted lavender chair seen from above (ref 2.3–3 s): a deep cushion with buttons */
export const TuftedChair: React.FC = () => {
  const m = useMat(() => soft("#B98AF0", { roughness: 0.55, sheen: 0.8 }));
  return (
    <group>
      <RoundedBox args={[0.5, 0.12, 0.48]} radius={0.05} smoothness={5} material={m} />
      <RoundedBox args={[0.5, 0.36, 0.12]} radius={0.05} smoothness={5} position={[0, 0.2, -0.22]} material={m} />
      {Array.from({ length: 9 }, (_, i) => (
        <mesh key={i} position={[(-1 + (i % 3)) * 0.13, 0.062, (-1 + Math.floor(i / 3)) * 0.13]}>
          <sphereGeometry args={[0.009, 12, 8]} />
          <meshStandardMaterial color="#6E3FC0" roughness={0.5} />
        </mesh>
      ))}
    </group>
  );
};

/** a little cone toy on a magenta cube (ref 0 s, left of the phone) */
export const ConeToy: React.FC = () => (
  <group>
    <RoundedBox args={[0.055, 0.03, 0.055]} radius={0.006} smoothness={3} position={[0, 0.015, 0]}>
      <meshPhysicalMaterial color="#E0418E" roughness={0.4} clearcoat={0.4} />
    </RoundedBox>
    <mesh position={[0, 0.05, 0]}>
      <coneGeometry args={[0.02, 0.045, 32]} />
      <meshPhysicalMaterial color="#F59A3C" roughness={0.35} clearcoat={0.5} />
    </mesh>
    <mesh position={[0, 0.034, 0]}>
      <torusGeometry args={[0.02, 0.005, 10, 32]} />
      <meshPhysicalMaterial color="#F7B347" roughness={0.35} />
    </mesh>
  </group>
);

/** a cup on a saucer, white with a coral rim */
export const Cup: React.FC<{ rim?: string }> = ({ rim = "#F08C5A" }) => (
  <group>
    <mesh position={[0, 0.004, 0]}>
      <cylinderGeometry args={[0.07, 0.065, 0.008, 48]} />
      <meshPhysicalMaterial color="#FBF7F8" roughness={0.25} clearcoat={0.5} />
    </mesh>
    <mesh position={[0, 0.04, 0]}>
      <cylinderGeometry args={[0.042, 0.034, 0.065, 48, 1, true]} />
      <meshPhysicalMaterial color="#FBF7F8" roughness={0.25} clearcoat={0.5} side={THREE.DoubleSide} />
    </mesh>
    <mesh position={[0, 0.0725, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[0.042, 0.0025, 8, 48]} />
      <meshStandardMaterial color={rim} roughness={0.4} />
    </mesh>
    <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[0.039, 40]} />
      <meshStandardMaterial color="#8A4A36" roughness={0.2} />
    </mesh>
  </group>
);
