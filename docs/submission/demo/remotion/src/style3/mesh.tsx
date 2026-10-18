import React from "react";
import { AbsoluteFill } from "remotion";
import { FlowKey, flow } from "./lib";

// A mesh gradient background: a coarse grid of colours (measured on a reference with styles/tools/s3_palette.py, or
// designed), interpolated in time between keys and in space by the browser's bilinear upscale + a soft blur.
// Pastel launch films live on these drifting gradients; one component instead of hand-tuned CSS stops.

/** a measured/designed colour grid at time t; `cut: true` starts a new run (the field jumps there: a hard cut) */
export type MeshKey = { t: number; grid: string[][]; cut?: boolean };
const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const smooth = (x: number) => x * x * (3 - 2 * x);

/** the grid at time t: keys blended with a smoothstep between neighbours */
export const meshAt = (keys: MeshKey[], t: number): number[][][] => {
  if (t <= keys[0].t) return keys[0].grid.map((r) => r.map(hex));
  const last = keys[keys.length - 1];
  if (t >= last.t) return last.grid.map((r) => r.map(hex));
  let i = 0;
  while (i < keys.length - 2 && t > keys[i + 1].t) i++;
  const a = keys[i], b = keys[i + 1];
  const k = smooth((t - a.t) / (b.t - a.t));
  return a.grid.map((row, y) => row.map((c, x) => hex(c).map((v, j) => v + (hex(b.grid[y][x])[j] - v) * k)));
};

/** the grid at time t, flowing THROUGH the keys (per cell and channel monotone-cubic `flow`, continuous velocity: no
 * colour stop at each key, unlike meshAt's smoothstep); `cut` keys jump. Used by the 2D MeshGradient. */
export const meshFlow = (keys: MeshKey[], t: number): number[][][] => {
  const hx = keys.map((k) => k.grid.map((r) => r.map(hex)));
  return hx[0].map((row, y) => row.map((_, x) => [0, 1, 2].map((j) => {
    const fk = keys.map((k, i) => (k.cut ? [k.t, hx[i][y][x][j], "cut"] : [k.t, hx[i][y][x][j]]) as FlowKey);
    return Math.max(0, Math.min(255, flow(t, fk)));
  })));
};

/**
 * Pre-compensate a measured grid for the shot's post so the backdrop LANDS on the measured colours: undo gain/lift
 * (display space), then the saturation (linear, Rec.709 luma), the inverse of post.tsx's order. Without it a measured
 * field is graded twice (A cards v15: the ref's pale lavender came out saturated violet, ΔE 44 at the bottom).
 */
export const throughPost = (g: number[][][], o: { saturation?: number; gain?: number[]; lift?: number[] }): number[][][] => {
  const sat = Math.max(0.05, o.saturation ?? 1), gain = o.gain ?? [1, 1, 1], lift = o.lift ?? [0, 0, 0];
  const toLin = (v: number) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  const toSrgb = (v: number) => (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);
  const cl = (v: number) => Math.min(1, Math.max(0, v));
  return g.map((row) => row.map((c) => {
    const lin = c.map((v, i) => toLin(cl((v / 255 - lift[i]) / gain[i])));
    const lum = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
    return lin.map((v) => toSrgb(cl(lum + (v - lum) / sat)) * 255);
  }));
};

/** paint a mesh grid into a 2D canvas (for a 3D background plane's texture): smoothstep between cell centres */
export const paintMesh = (c: CanvasRenderingContext2D, w: number, h: number, g: number[][][], inset = 0) => {
  // inset: the field occupies the central (1 − 2·inset) of the canvas; outside it the edge colours extend smoothly
  const rows = g.length, cols = g[0].length;
  const FWp = 64, FHp = 36;
  const tmp = document.createElement("canvas");
  tmp.width = FWp;
  tmp.height = FHp;
  const x = tmp.getContext("2d")!;
  const img = x.createImageData(FWp, FHp);
  for (let v = 0; v < FHp; v++)
    for (let u = 0; u < FWp; u++) {
      const uu = ((u + 0.5) / FWp - inset) / (1 - 2 * inset), vv = ((v + 0.5) / FHp - inset) / (1 - 2 * inset);
      const gx = Math.min(cols - 1, Math.max(0, uu * cols - 0.5));
      const gy = Math.min(rows - 1, Math.max(0, vv * rows - 0.5));
      const x0 = Math.min(cols - 2, Math.floor(gx)), y0 = Math.min(rows - 2, Math.floor(gy));
      const fx = smooth(gx - x0), fy = smooth(gy - y0);
      const o = (v * FWp + u) * 4;
      for (let j = 0; j < 3; j++) {
        const top = g[y0][x0][j] + (g[y0][x0 + 1][j] - g[y0][x0][j]) * fx;
        const bot = g[y0 + 1][x0][j] + (g[y0 + 1][x0 + 1][j] - g[y0 + 1][x0][j]) * fx;
        img.data[o + j] = top + (bot - top) * fy;
      }
      img.data[o + 3] = 255;
    }
  x.putImageData(img, 0, 0);
  c.imageSmoothingEnabled = true;
  c.imageSmoothingQuality = "high";
  c.drawImage(tmp, 0, 0, w, h);
};

const FW = 48, FH = 27; // fine field, stretched to the frame (bilinear between fine samples = smooth)
/**
 * 2D mesh-gradient background. Keys flow in time (meshFlow). `warp` (0..~0.08, frame fractions) bends the sampling
 * grid with slow travelling sines so blobs drift and morph between measured keys (a liquid field, not a cross-fade).
 */
export const MeshGradient: React.FC<{ keys: MeshKey[]; t: number; warp?: number; style?: React.CSSProperties }> = ({ keys, t, warp = 0, style }) => {
  const ref = React.useRef<HTMLCanvasElement>(null);
  const g = meshFlow(keys, t);
  const rows = g.length, cols = g[0].length;
  React.useLayoutEffect(() => {
    const c = ref.current!.getContext("2d")!;
    const img = c.createImageData(FW, FH);
    for (let v = 0; v < FH; v++)
      for (let u = 0; u < FW; u++) {
        let uu = (u + 0.5) / FW, vv = (v + 0.5) / FH;
        if (warp) {
          const du = Math.sin(vv * 5.1 + t * 1.3) * 0.6 + Math.sin((uu + vv) * 7.3 - t * 0.9 + 1.7) * 0.4;
          const dv = Math.cos(uu * 4.3 - t * 1.1 + 0.6) * 0.6 + Math.sin((uu - vv) * 6.1 + t * 1.5) * 0.4;
          uu += du * warp;
          vv += dv * warp * 1.4;
        }
        // cell centres sit where they were measured; smoothstep between them (C1, no creases), clamped at the edges
        const gx = Math.min(cols - 1, Math.max(0, uu * cols - 0.5));
        const gy = Math.min(rows - 1, Math.max(0, vv * rows - 0.5));
        const x0 = Math.min(Math.max(0, cols - 2), Math.floor(gx)), y0 = Math.min(Math.max(0, rows - 2), Math.floor(gy));
        const fx = cols > 1 ? smooth(Math.min(1, gx - x0)) : 0, fy = rows > 1 ? smooth(Math.min(1, gy - y0)) : 0;
        const x1 = Math.min(cols - 1, x0 + 1), y1 = Math.min(rows - 1, y0 + 1);
        const o = (v * FW + u) * 4;
        for (let j = 0; j < 3; j++) {
          const top = g[y0][x0][j] + (g[y0][x1][j] - g[y0][x0][j]) * fx;
          const bot = g[y1][x0][j] + (g[y1][x1][j] - g[y1][x0][j]) * fx;
          img.data[o + j] = top + (bot - top) * fy;
        }
        img.data[o + 3] = 255;
      }
    c.putImageData(img, 0, 0);
  });
  return (
    <AbsoluteFill style={{ overflow: "hidden", ...style }}>
      <canvas ref={ref} width={FW} height={FH} style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, imageRendering: "auto" }} />
    </AbsoluteFill>
  );
};
