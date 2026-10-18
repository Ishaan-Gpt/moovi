import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { Halftone, Leaks, Letterbox } from "./type";

// The 2D finish layer (skill style-3-finish §2): grain, vignette, light leaks, halftone, a soft tint and a letterbox,
// per register. Mount it last in a Film's `overlays`. Without it a frame reads as a render; with it, as a film.
// Chromatic aberration for 3D shots lives in the post (PostParams.ca); the DOM cannot fringe what is under it.

export type FinishPreset = "pastel" | "candy" | "dark" | "paper" | "card" | "none";
export type FinishParams = {
  grain: number; // 0..0.2 opacity of the animated grain (overlay)
  vignette: number; // 0..1 strength of the radial darkening
  vignetteColor?: string; // the dark the edges fall into (a coloured dark, never pure black)
  leaks?: number; // light leaks opacity (0.3 max; 0.55 was too much on A)
  leakTint?: string; // "r,g,b"
  halftone?: number; // corner halftone clusters (candy / pastel)
  halftoneColor?: string;
  tint?: string; // a soft-light tint over everything, e.g. "rgba(255,210,170,0.12)"
  letterbox?: number; // px of 1080
  lift?: number; // 0..0.1 a soft contrast lift (overlay of mid grey)
};
export const FINISH: Record<FinishPreset, FinishParams> = {
  pastel: { grain: 0.06, vignette: 0.3, vignetteColor: "#4A2A5A", leaks: 0.28, leakTint: "255,236,224", halftone: 0.3, halftoneColor: "#E79BD8", tint: "rgba(255,215,230,0.06)" },
  candy: { grain: 0.05, vignette: 0.22, vignetteColor: "#5A1E6A", halftone: 0.45, halftoneColor: "#FF4FB0", tint: "rgba(255,255,255,0.04)" },
  dark: { grain: 0.12, vignette: 0.6, vignetteColor: "#02070A", leaks: 0.22, leakTint: "255,196,120", tint: "rgba(255,170,90,0.07)" },
  paper: { grain: 0.08, vignette: 0.25, vignetteColor: "#3B2A3F", tint: "rgba(255,230,200,0.05)" },
  card: { grain: 0.035, vignette: 0.15, vignetteColor: "#3A2A4A" },
  none: { grain: 0, vignette: 0 },
};

/** a PostParams.curves grade in one call: a black point (0..0.1) and an S contrast (0..1); same curve on R, G, B.
 *  AgX leaves 3D frames milky: curveS(0.04, 0.25) is the usual first grade before a fitted one (style-3-finish §1) */
export const curveS = (black = 0.04, contrast = 0.25, n = 9): number[][] => {
  const pts = Array.from({ length: n }, (_, i) => {
    const x = i / (n - 1);
    const b = Math.max(0, (x - black) / (1 - black));
    const sm = b * b * (3 - 2 * b);
    return Math.min(1, b + (sm - b) * contrast);
  });
  return [pts, pts, pts];
};

/** animated film grain: an SVG turbulence re-seeded per frame, overlay-blended */
export const Grain: React.FC<{ frame: number; o: number; w: number; h: number; size?: number }> = ({ frame, o, w, h, size = 0.9 }) =>
  o > 0 ? (
    <svg width={w} height={h} style={{ position: "absolute", inset: 0, opacity: o, mixBlendMode: "overlay", pointerEvents: "none" }}>
      <filter id="s3grain">
        <feTurbulence type="fractalNoise" baseFrequency={size} numOctaves="2" seed={frame % 97} stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#s3grain)" />
    </svg>
  ) : null;

/** a radial vignette into a coloured dark */
export const Vignette: React.FC<{ o: number; color?: string; inner?: number }> = ({ o, color = "#1A0F22", inner = 48 }) =>
  o > 0 ? <AbsoluteFill style={{ background: `radial-gradient(ellipse at center, rgba(0,0,0,0) ${inner}%, ${color} 130%)`, opacity: o, pointerEvents: "none" }} /> : null;

export const Finish: React.FC<{ t: number; preset?: FinishPreset; params?: Partial<FinishParams>; frame?: number }> = ({ t, preset = "pastel", params, frame }) => {
  const { width, height, fps } = useVideoConfig();
  const p = { ...FINISH[preset], ...params };
  const f = frame ?? Math.round(t * fps);
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {p.leaks ? <Leaks t={t} o={p.leaks} tint={p.leakTint} /> : null}
      {p.halftone ? (
        <>
          <Halftone corner="tr" color={p.halftoneColor ?? "#E79BD8"} o={p.halftone} />
          <Halftone corner="bl" color={p.halftoneColor ?? "#E79BD8"} o={p.halftone * 0.8} />
        </>
      ) : null}
      {p.tint ? <AbsoluteFill style={{ background: p.tint, mixBlendMode: "soft-light" }} /> : null}
      {p.lift ? <AbsoluteFill style={{ background: "#808080", opacity: p.lift, mixBlendMode: "overlay" }} /> : null}
      <Vignette o={p.vignette} color={p.vignetteColor} />
      <Grain frame={f} o={p.grain} w={width} h={height} />
      {p.letterbox ? <Letterbox h={p.letterbox * (height / 1080)} /> : null}
    </AbsoluteFill>
  );
};
