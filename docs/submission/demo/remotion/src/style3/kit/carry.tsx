import React from "react";
import { AbsoluteFill } from "remotion";
import { rand } from "../lib";

// Cut carriers built from UI parts (2D, DOM + CSS 3D): a query bar with a row of product tiles standing on it, a
// progress fill, and a rotating light blade. Ref A 17.2–17.5: the bar rides a pink→violet bloom, a white blade sweeps
// across it, the bar tilts in 3D with its fill running, and the cut lands on the monitor showing the same bar.
// All drawings are ours (simple SVG glyphs), never reference pixels.

/** product glyphs on white tiles (viewBox 0..40): picture, plant, car, gift, headphones, bag, jeans, dress */
const GLYPHS: React.ReactNode[] = [
  <g key="pic"><rect x="7" y="9" width="26" height="20" rx="2" fill="#F2D9C9" stroke="#D9A88C" strokeWidth="1.5" /><path d="M9 27 L17 18 L23 24 L27 20 L31 27 Z" fill="#E59A7A" /><circle cx="26" cy="14" r="2.6" fill="#F7C35B" /></g>,
  <g key="plant"><path d="M14 27 h12 l-2 9 h-8 Z" fill="#C9875D" /><path d="M20 27 C 12 22, 9 14, 13 9 C 17 14, 19 20, 20 27 Z" fill="#5DBB6A" /><path d="M20 27 C 26 21, 31 15, 28 8 C 23 13, 21 20, 20 27 Z" fill="#3FA055" /></g>,
  <g key="car"><path d="M7 25 C 8 19, 12 15, 19 15 C 25 15, 29 18, 32 22 L 34 25 C 34 28, 33 29, 31 29 H 9 C 7 29, 6 27, 7 25 Z" fill="#7FA6EE" /><path d="M13 21 C 14 18, 17 17, 19 17 V 21 Z M21 17 C 24 17, 27 19, 28 21 H 21 Z" fill="#D7E6FF" /><circle cx="13" cy="29" r="3.4" fill="#2A2D3A" /><circle cx="28" cy="29" r="3.4" fill="#2A2D3A" /></g>,
  <g key="gift"><rect x="9" y="17" width="22" height="18" rx="2" fill="#FFFFFF" stroke="#EBB9C8" strokeWidth="1.5" /><rect x="7.5" y="13" width="25" height="6" rx="1.5" fill="#F7A8BF" /><rect x="18.5" y="13" width="3" height="22" fill="#EE5C88" /><path d="M20 13 C 15 6, 10 9, 13 12 Z M20 13 C 25 6, 30 9, 27 12 Z" fill="#EE5C88" /></g>,
  <g key="hp"><path d="M10 26 C 9 14, 31 14, 30 26" fill="none" stroke="#E84B7F" strokeWidth="3.4" strokeLinecap="round" /><rect x="7" y="23" width="7" height="11" rx="3" fill="#F06A93" /><rect x="26" y="23" width="7" height="11" rx="3" fill="#F06A93" /></g>,
  <g key="bag"><path d="M14 16 C 14 9, 26 9, 26 16" fill="none" stroke="#6F55D9" strokeWidth="2.6" /><path d="M9 16 H 31 L 33 35 H 7 Z" fill="#9C86F2" /><path d="M9 16 H 31 L 31.6 21 H 8.4 Z" fill="#B7A6F8" /></g>,
  <g key="jeans"><path d="M12 7 H 28 L 30 35 H 22 L 20 18 L 18 35 H 10 Z" fill="#5C86D6" /><rect x="12" y="7" width="16" height="4" fill="#3F67B5" /></g>,
  <g key="dress"><path d="M16 6 h8 l-1 8 l8 21 H 9 l8 -21 Z" fill="#F07C9A" /><path d="M16 14 h8" stroke="#D4557A" strokeWidth="2" /></g>,
];

/** a row of n product tiles (each `size` px) standing on a line; small seeded tilts and a gentle bob on t */
export const TileRow: React.FC<{ t: number; size: number; gap?: number; n?: number; seed?: number }> = ({ t, size, gap = 0.12, n = 8, seed = 11 }) => (
  <div style={{ display: "flex", gap: size * gap, alignItems: "flex-end" }}>
    {Array.from({ length: n }, (_, i) => {
      const rot = (rand(seed + i) - 0.5) * 22 + Math.sin(t * 5 + i) * 2;
      return (
        <div key={i} style={{ width: size, height: size, borderRadius: size * 0.2, background: "linear-gradient(160deg,#FFFFFF,#F4EEF8)", boxShadow: `0 ${size * 0.08}px ${size * 0.2}px rgba(120,60,160,0.28)`, transform: `rotate(${rot}deg) translateY(${(rand(seed + i + 40) - 0.5) * size * 0.15}px)` }}>
          <svg width={size} height={size} viewBox="0 0 40 40">{GLYPHS[i % GLYPHS.length]}</svg>
        </div>
      );
    })}
  </div>
);

/** a rounded query/progress bar: white with a thin violet rim, a gradient fill to `fill` (0..1) and a dotted pattern */
export const QueryBar: React.FC<{ w: number; fill: number; from?: string; to?: string; rim?: string; style?: React.CSSProperties }> = ({ w, fill, from = "#9A7BF5", to = "#F24AA6", rim = "rgba(150,110,235,0.9)", style }) => {
  const h = w * 0.13;
  return (
    <div style={{ position: "relative", width: w, height: h, borderRadius: h / 2, background: "#FFFFFF", boxShadow: `inset 0 0 0 ${Math.max(1.5, h * 0.035)}px ${rim}, 0 ${h * 0.25}px ${h * 0.6}px rgba(130,70,200,0.25)`, overflow: "hidden", ...style }}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(rgba(200,160,235,0.55) 30%, transparent 34%)", backgroundSize: `${h * 0.22}px ${h * 0.22}px`, opacity: 0.8 }} />
      {fill > 0 && (
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${fill * 100}%`, background: `linear-gradient(90deg, ${from}, ${to})`, borderRadius: `${h / 2}px 0 0 ${h / 2}px` }}>
          <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(rgba(255,255,255,0.45) 28%, transparent 34%)", backgroundSize: `${h * 0.22}px ${h * 0.22}px`, maskImage: "linear-gradient(90deg, transparent 40%, black 100%)", WebkitMaskImage: "linear-gradient(90deg, transparent 40%, black 100%)" }} />
        </div>
      )}
    </div>
  );
};

/** a soft white light blade: centre (x, y), length, width, CSS rotation (deg; 0 = vertical) */
export const LightBlade: React.FC<{ x: number; y: number; len: number; w: number; rot: number; o: number }> = ({ x, y, len, w, rot, o }) =>
  o > 0 ? (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", left: x - w / 2, top: y - len / 2, width: w, height: len, borderRadius: w / 2, transform: `rotate(${rot}deg)`, opacity: o, background: "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.85) 30%, #FFFFFF 50%, rgba(255,255,255,0.85) 70%, rgba(255,255,255,0) 100%)", filter: `blur(${w * 0.12}px)`, boxShadow: `0 0 ${w * 0.6}px rgba(255,190,240,0.7)` }} />
    </AbsoluteFill>
  ) : null;
