import React from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { continueRender, delayRender, staticFile } from "remotion";
import { rand } from "../lib";

/** seeded generator (lib `rand` is a hash of one seed): r() → [0, 1) */
export const rng = (seed: number) => {
  let i = seed * 7919;
  return () => rand(i++);
};

// Style 3 kit: canvas textures and image loading for tabletop/paper worlds (first used by ce3-04 "Pop-Up"). Everything
// is drawn on canvases (deterministic, ours): paper grain (bump + tone), linen weave, book cloth, page-edge stripes.
// useImages holds the frame until images decode and redraws once (R3F only draws on a new frame number).

/** the CaptionsEasy campaign palette (BRIEF.md) + paper/print tones; kit paper props default to it */
export const PAPER = {
  cream: "#FFFFEB", // pop-up stock, the dominant surface
  creamShade: "#F2EBD3",
  linen: "#EFE6CF", // the desk cloth (a shade under the pages so they separate)
  ink: "#1A1A1A",
  lavender: "#F0D7FF",
  lavDeep: "#C9A7F5", // the ribbon (satin), pop-up layers in shade
  green: "#034F46", // book cloth, flags, emphasis
  greenDeep: "#02342E",
  apricot: "#FFA946", // logo bar
  mint: "#34D399", // logo bar
  news: "#E3DFD0", // the textbook's paper: greyed cream
  newsInk: "#55534D",
};

// ── images: hold the frame until decoded, then draw once more (ThreeCanvas only redraws on a new frame number, so
//    a texture that arrives later would otherwise leave the shot black; same fix as ce/shared.tsx useAtlas) ──
const imageCache = new Map<string, Promise<HTMLImageElement>>();
const loadImage = (s: string) => {
  let p = imageCache.get(s);
  if (!p) {
    p = new Promise<HTMLImageElement>((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = rej;
      im.src = staticFile(s);
    });
    imageCache.set(s, p);
  }
  return p;
};
export const useImages = (srcs: string[]) => {
  const advance = useThree((s) => s.advance);
  const [imgs, setImgs] = React.useState<HTMLImageElement[] | null>(null);
  const [handle] = React.useState(() => delayRender(`popup images ${srcs.join(",")}`));
  React.useEffect(() => {
    let alive = true;
    Promise.all(srcs.map(loadImage)).then((r) => alive && setImgs(r), () => continueRender(handle));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  React.useEffect(() => {
    if (!imgs) return;
    advance(performance.now());
    continueRender(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imgs]);
  return imgs;
};

// ── shared noise canvases (made once per page load) ──
export const makeCanvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
};
let grainCanvas: HTMLCanvasElement | null = null;
/** paper fibre: fine value noise + a few long fibres, mid-grey (for bump maps and a faint tone on prints) */
export const paperGrain = () => {
  if (grainCanvas) return grainCanvas;
  const N = 1024, c = makeCanvas(N, N), g = c.getContext("2d")!, r = rng(41);
  const img = g.createImageData(N, N);
  for (let i = 0; i < N * N; i++) {
    const v = 128 + (r() - 0.5) * 36;
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  g.filter = "blur(0.6px)";
  g.drawImage(c, 0, 0);
  g.filter = "none";
  g.lineCap = "round";
  for (let k = 0; k < 900; k++) {
    const x = r() * N, y = r() * N, a = r() * Math.PI, l = 6 + r() * 26;
    g.strokeStyle = r() < 0.5 ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.14)";
    g.lineWidth = 0.6 + r() * 0.8;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + (r() - 0.5) * 4, y + Math.sin(a) * l * 0.5 + (r() - 0.5) * 4, x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.stroke();
  }
  grainCanvas = c;
  return c;
};

/** a canvas texture that lives for the mount (disposed after) */
export const useTex = (make: () => HTMLCanvasElement | null, deps: unknown[], o: { repeat?: number; srgb?: boolean } = {}) => {
  const tex = React.useMemo(() => {
    const c = make();
    if (!c) return null;
    const t = new THREE.CanvasTexture(c);
    if (o.srgb !== false) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    if (o.repeat) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(o.repeat, o.repeat);
    }
    return t;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  React.useEffect(() => () => tex?.dispose(), [tex]);
  return tex;
};

/** linen weave on the desk cloth: warp/weft threads with slubs */
export const linenCanvas = () => {
  const N = 1024, c = makeCanvas(N, N), g = c.getContext("2d")!, r = rng(7);
  g.fillStyle = PAPER.linen;
  g.fillRect(0, 0, N, N);
  for (let y = 0; y < N; y += 4) {
    g.fillStyle = `rgba(120,100,70,${0.05 + r() * 0.06})`;
    g.fillRect(0, y, N, 1.6 + r() * 0.8);
  }
  for (let x = 0; x < N; x += 4) {
    g.fillStyle = `rgba(255,252,240,${0.08 + r() * 0.08})`;
    g.fillRect(x, 0, 1.4 + r() * 0.8, N);
  }
  for (let k = 0; k < 160; k++) {
    g.fillStyle = `rgba(110,90,60,${0.05 + r() * 0.05})`;
    g.fillRect(r() * N, Math.floor(r() * N / 4) * 4, 20 + r() * 80, 2.2);
  }
  return c;
};

/** book cloth: tight weave in the board colour */
export const clothCanvas = (base: string) => {
  const N = 512, c = makeCanvas(N, N), g = c.getContext("2d")!, r = rng(13);
  g.fillStyle = base;
  g.fillRect(0, 0, N, N);
  for (let y = 0; y < N; y += 2) {
    g.fillStyle = `rgba(0,0,0,${0.06 + r() * 0.05})`;
    g.fillRect(0, y, N, 1);
  }
  for (let x = 0; x < N; x += 2) {
    g.fillStyle = `rgba(255,255,255,${0.03 + r() * 0.04})`;
    g.fillRect(x, 0, 1, N);
  }
  return c;
};

/** page edges seen on the block's sides: hundreds of leaves, slightly uneven */
export const edgeCanvas = (base: string) => {
  const W = 64, H = 256, c = makeCanvas(W, H), g = c.getContext("2d")!, r = rng(5);
  g.fillStyle = base;
  g.fillRect(0, 0, W, H);
  for (let y = 0; y < H; y += 1.5) {
    g.fillStyle = `rgba(90,80,60,${0.05 + r() * 0.12})`;
    g.fillRect(0, y, W, 0.6);
  }
  return c;
};
