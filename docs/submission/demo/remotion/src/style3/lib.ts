import React from "react";
import * as THREE from "three";
import { continueRender, delayRender, staticFile } from "remotion";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { EXRLoader } from "three/examples/jsm/loaders/EXRLoader.js";

// Style 3 ("launch videos") shared helpers. 24 fps like the @arsacre5 references.
export const FPS = 24;
export const W = 1920;
export const H = 1080;

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (t: number) => t * t * (3 - 2 * t);
export const bez = (x1: number, y1: number, x2: number, y2: number) => (x: number) => {
  // cubic-bezier easing (CSS style), solved by bisection: deterministic and cheap enough per frame.
  // Exact ends: bisection alone gives ~1e-7 at x = 0, which made `if (k <= 0) return null` never hide anything.
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  let lo = 0, hi = 1, t = x;
  for (let i = 0; i < 24; i++) {
    t = (lo + hi) / 2;
    const bx = 3 * (1 - t) * (1 - t) * t * x1 + 3 * (1 - t) * t * t * x2 + t * t * t;
    if (bx < x) lo = t; else hi = t;
  }
  return 3 * (1 - t) * (1 - t) * t * y1 + 3 * (1 - t) * t * t * y2 + t * t * t;
};
export const E = {
  out: bez(0.16, 1, 0.3, 1),
  inOut: bez(0.65, 0, 0.35, 1),
  in: bez(0.7, 0, 0.84, 0),
  glide: bez(0.33, 0, 0.2, 1),
  back: bez(0.34, 1.45, 0.64, 1),
  lin: (x: number) => x,
};
type Ease = (t: number) => number;
/** progress of time t through [a, b] with easing */
export const pr = (t: number, a: number, b: number, ease: Ease = E.out) => ease(clamp01((t - a) / (b - a)));
/** keyframes [time, value, easeIntoThisKey?] */
export type Key = [number, number, Ease?];
export const kf = (t: number, keys: Key[]) => {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) {
    const [a, va] = keys[i];
    const [b, vb, e] = keys[i + 1];
    if (t <= b) return lerp(va, vb, (e ?? E.inOut)(clamp01((t - a) / (b - a))));
  }
  return keys[keys.length - 1][1];
};
export type V3 = [number, number, number];
export const kf3 = (t: number, keys: [number, V3, Ease?][]): V3 =>
  [0, 1, 2].map((i) => kf(t, keys.map(([a, v, e]) => [a, v[i], e] as Key))) as V3;

/**
 * Watery keyframes: one smooth curve THROUGH every key (monotone cubic Hermite, C1, no overshoot), so motion never
 * stops at an interior key (kf eases into every key: 1 → 2 → 3 steps). A key marked "cut" starts a new run: the value
 * jumps there (hard or hidden cut). Run ends keep moving (secant slope: cut on motion) unless `ease` is set, which
 * settles them to zero velocity. Use for cameras, zooms, card waves, anything that should flow.
 */
export type FlowKey = [number, number] | [number, number, "cut"];
export const flow = (t: number, keys: FlowKey[], ease = false): number => {
  let s = 0;
  for (let i = 1; i < keys.length; i++) if (keys[i][2] === "cut" && t >= keys[i][0]) s = i;
  let e = keys.length - 1;
  for (let i = s + 1; i < keys.length; i++) if (keys[i][2] === "cut") { e = i - 1; break; }
  const run = keys.slice(s, e + 1);
  if (run.length === 1 || t <= run[0][0]) return run[0][1];
  if (t >= run[run.length - 1][0]) return run[run.length - 1][1];
  const n = run.length;
  const d = run.slice(0, -1).map((k, i) => (run[i + 1][1] - k[1]) / Math.max(1e-6, run[i + 1][0] - k[0]));
  const m = run.map((_, i) => (i === 0 ? (ease ? 0 : d[0]) : i === n - 1 ? (ease ? 0 : d[n - 2]) : d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2));
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], h = a * a + b * b;
    if (h > 9) { const tau = 3 / Math.sqrt(h); m[i] = tau * a * d[i]; m[i + 1] = tau * b * d[i]; }
  }
  let i = 0;
  while (i < n - 2 && t > run[i + 1][0]) i++;
  const [x0, y0] = run[i], [x1, y1] = run[i + 1], hx = x1 - x0, u = (t - x0) / hx;
  const u2 = u * u, u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * y0 + (u3 - 2 * u2 + u) * hx * m[i] + (-2 * u3 + 3 * u2) * y1 + (u3 - u2) * hx * m[i + 1];
};
export type FlowKey3 = [number, V3] | [number, V3, "cut"];
export const flow3 = (t: number, keys: FlowKey3[], ease = false): V3 =>
  [0, 1, 2].map((i) => flow(t, keys.map((k) => (k[2] ? [k[0], k[1][i], "cut"] : [k[0], k[1][i]]) as FlowKey), ease)) as V3;

export const rand = (seed: number) => {
  let t = (seed + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
/** slow organic drift (sum of sines), never stops */
export const drift = (t: number, seed: number, amp = 1) =>
  amp * (Math.sin(t * 0.7 + seed * 1.3) * 0.6 + Math.sin(t * 1.31 + seed * 2.1) * 0.4);

export const rgba = (hex: string, a: number) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgba(${r},${g},${b},${a})`;
};

// ── fonts ────────────────────────────────────────────────────────────────────
export const FONT = { sans: "S3-Jakarta", ui: "S3-Inter", serif: "S3-Serif" };
let fontsP: Promise<void> | null = null;
export const useFonts = () => {
  const [ready, setReady] = React.useState(false);
  const [h] = React.useState(() => delayRender("style3 fonts"));
  React.useEffect(() => {
    if (!fontsP) {
      const F: [string, string, FontFaceDescriptors][] = [
        [FONT.sans, "style3/fonts/plus-jakarta-sans-latin-wght-normal.woff2", { weight: "200 800" }],
        [FONT.ui, "style3/fonts/inter-latin-wght-normal.woff2", { weight: "100 900" }],
        [FONT.serif, "style3/fonts/instrument-serif-latin-400-italic.woff2", { style: "italic" }],
      ];
      fontsP = Promise.all(F.map(([n, f, d]) => new FontFace(n, `url(${staticFile(f)})`, d).load().then((ff) => void document.fonts.add(ff)))).then(() => undefined);
    }
    fontsP.then(() => {
      setReady(true);
      continueRender(h);
    });
  }, [h]);
  return ready;
};

// ── room assets (GLB + baked EXR light maps) ────────────────────────────────
export type RoomInfo = { baked: string[]; sunDir: V3; camera: { pos: V3; lens: number; sensor: number } };
export type Bake = { col: THREE.Texture; light: THREE.Texture };
export type RoomAssets = { scene: THREE.Group; info: RoomInfo; bakes: Map<string, Bake> };
const roomP = new Map<string, Promise<RoomAssets>>();
const loadRoom = async (base: string): Promise<RoomAssets> => {
  const info: RoomInfo = await fetch(staticFile(`${base}/room.json`)).then((r) => r.json());
  const gltf = await new GLTFLoader().loadAsync(staticFile(`${base}/room.glb`));
  const exr = new EXRLoader();
  const png = new THREE.TextureLoader();
  const bakes = new Map<string, Bake>();
  const prep = (t: THREE.Texture, cs: THREE.ColorSpace) => {
    t.flipY = false; // glTF UV convention
    t.colorSpace = cs;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.anisotropy = 8;
    t.needsUpdate = true;
    return t;
  };
  await Promise.all(
    info.baked.map(async (n) => {
      const [col, light] = await Promise.all([
        png.loadAsync(staticFile(`${base}/bake/${n}.col.png`)),
        exr.loadAsync(staticFile(`${base}/bake/${n}.light.exr`)),
      ]);
      const img = light.image as unknown as { data: Uint16Array | Float32Array; width: number; height: number };
      const row = img.width * 4;
      for (let y = 0; y < Math.floor(img.height / 2); y++) {
        const a = y * row, b = (img.height - 1 - y) * row;
        const tmp = img.data.slice(a, a + row);
        img.data.copyWithin(a, b, b + row);
        img.data.set(tmp, b);
      }
      bakes.set(n, { col: prep(col, THREE.SRGBColorSpace), light: prep(light, THREE.LinearSRGBColorSpace) });
    }),
  );
  return { scene: gltf.scene, info, bakes };
};
/** a baked set from bake.py: base = public path, e.g. "style3/room" */
export const useRoom = (base = "style3/room") => {
  const [room, setRoom] = React.useState<RoomAssets | null>(null);
  const [h] = React.useState(() => delayRender(`style3 set ${base}`));
  React.useEffect(() => {
    if (!roomP.has(base)) roomP.set(base, loadRoom(base));
    roomP.get(base)!.then((r) => {
      setRoom(r);
      continueRender(h);
    });
  }, [h, base]);
  return room;
};

/** vertical fov (deg) for a lens on a 36 mm wide sensor at 16:9 */
export const fovFromLens = (lens: number) => (2 * Math.atan(36 / (16 / 9) / 2 / lens) * 180) / Math.PI;

/** a 2D canvas that becomes a texture; draw(ctx, w, h) is called whenever deps change */
export const useCanvasTex = (w: number, h: number, draw: (c: CanvasRenderingContext2D, w: number, h: number) => void, deps: unknown[]) => {
  const tex = React.useMemo(() => {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  }, [w, h]);
  React.useMemo(() => {
    const c = tex.image as HTMLCanvasElement;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, w, h);
    draw(ctx, w, h);
    tex.needsUpdate = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tex, ...deps]);
  // free the GPU copy when the shot unmounts (long renders otherwise run Chrome out of memory)
  React.useEffect(() => () => tex.dispose(), [tex]);
  return tex;
};

export const roundRect = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
};

/** rounded-rect plane geometry (for cards, pills, panels) */
export const roundedPlane = (w: number, h: number, r: number, seg = 8) => {
  const s = new THREE.Shape();
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
  const g = new THREE.ShapeGeometry(s, seg);
  // UVs 0..1 across the rect (ShapeGeometry gives raw xy)
  const p = g.attributes.position;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    uv[i * 2] = (p.getX(i) - x) / w;
    uv[i * 2 + 1] = (p.getY(i) - y) / h;
  }
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return g;
};

/** rounded box with depth (extruded rounded rect, bevelled) */
export const roundedSlab = (w: number, h: number, d: number, r: number, bevel = 0.004) => {
  const s = new THREE.Shape();
  const x = -w / 2 + bevel, y = -h / 2 + bevel, ww = w - 2 * bevel, hh = h - 2 * bevel, rr = Math.max(0.001, r - bevel);
  s.moveTo(x + rr, y);
  s.lineTo(x + ww - rr, y);
  s.quadraticCurveTo(x + ww, y, x + ww, y + rr);
  s.lineTo(x + ww, y + hh - rr);
  s.quadraticCurveTo(x + ww, y + hh, x + ww - rr, y + hh);
  s.lineTo(x + rr, y + hh);
  s.quadraticCurveTo(x, y + hh, x, y + hh - rr);
  s.lineTo(x, y + rr);
  s.quadraticCurveTo(x, y, x + rr, y);
  const g = new THREE.ExtrudeGeometry(s, { depth: d - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 10 });
  g.translate(0, 0, -d / 2 + bevel);
  return g;
};
