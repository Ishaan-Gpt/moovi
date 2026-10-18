import React from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { useOffthreadVideoTexture } from "@remotion/three";
import { continueRender, delayRender, staticFile, useCurrentFrame } from "remotion";
import { E, FONT, clamp01, pr } from "../lib";

// ce3-01 shared bits: real CaptionsEasy footage as textures (one atlas video → many tiles) and the in-film captions.

export const BRAND = { apricot: "#FFA946", mint: "#34D399", charcoal: "#1A1A1A", cream: "#FBF6EE", lavender: "#B7A0F2", pink: "#FF7FB0" };

/** one decoded frame of an atlas video, cut into cols x rows tile textures (shared image, own offset).
 * ThreeCanvas only draws when the frame number changes, but the video frame arrives later, so we hold the
 * render until the new tiles exist and draw once more with them (otherwise every screen comes out black). */
export const useAtlas = (src: string, cols: number, rows: number) => {
  const tex = useOffthreadVideoTexture({ src: staticFile(src) });
  const advance = useThree((s) => s.advance);
  const frame = useCurrentFrame();
  const hold = React.useRef<number | null>(null);
  React.useLayoutEffect(() => {
    const h = delayRender(`atlas ${src} frame ${frame}`);
    hold.current = h;
    const fallback = setTimeout(() => hold.current === h && release(), 8000);
    return () => {
      clearTimeout(fallback);
      if (hold.current === h) release();
    };
  }, [frame, src]);
  const release = () => {
    if (hold.current === null) return;
    continueRender(hold.current);
    hold.current = null;
  };
  const tiles = React.useMemo(() => {
    if (!tex) return null;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    const tiles: THREE.Texture[] = [];
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const t = tex.clone();
        t.colorSpace = THREE.SRGBColorSpace;
        t.repeat.set(1 / cols, 1 / rows);
        t.offset.set(c / cols, 1 - (r + 1) / rows);
        t.needsUpdate = true;
        tiles.push(t);
      }
    return tiles;
  }, [tex, cols, rows]);
  React.useEffect(() => {
    if (!tiles) return;
    advance(performance.now());
    release();
    return () => tiles.forEach((t) => t.dispose());
  }, [tiles]);
  return tiles;
};
export const PREMIUM = "style3/ce/premium-atlas.mp4"; // premium-1..4 side by side, 360x640 each, 10 s
export const LOOKS = "style3/ce/looks-atlas.mp4"; // 12 looks, 4 x 3 tiles of 640x240, looped, 5.5 s
export const LOOK_NAMES = [
  ["Metal Script", "Viral"], ["Soft Glow", "Viral"], ["Neon Duo", "Viral"], ["Serif Behind", "Viral"],
  ["Ice Duo", "Viral"], ["Serif Accent Glow", "Viral"], ["Staggered Splash", "Viral"], ["Glow Stack", "Viral"],
  ["Hormozi Box", "Popular"], ["Beast Bounce", "Popular"], ["Comic Burst", "Popular"], ["Kinetic Mix", "Popular"],
] as const;

// ── captions of our own VO, in CaptionsEasy-style looks (words pop as they're said, one hero word) ──
export type CapWord = { w: string; t: number; hero?: boolean };
type CapStyle = "slam" | "highlight" | "glow" | "accentGlow";

// CaptionsEasy "Serif Accent Glow" (Viral list, styles/assets/looks/serif_accent_glow.mp4): white bold sans with a soft
// white glow, each word blurs in, the hero word in serif italic. A plum haze under the glow keeps it legible on pastels.
const AccentGlow: React.FC<{ t: number; words: CapWord[]; until: number; y: number }> = ({ t, words, until, y }) => {
  const out = pr(t, until - 0.14, until, E.in);
  const shown = clamp01((t - words[0].t) / 0.25);
  return (
    <>
    {/* soft plum scrim behind the line: the white glow needs contrast on the pale pastel sets */}
    <div style={{ position: "absolute", left: 360, right: 360, top: y - 50, height: 210, background: "radial-gradient(ellipse 50% 50% at 50% 50%, rgba(45,15,60,0.42), rgba(45,15,60,0) 100%)", opacity: shown * (1 - out) }} />
    <div style={{ position: "absolute", left: 0, right: 0, top: y, display: "flex", justifyContent: "center", alignItems: "baseline", gap: 16, opacity: 1 - out, filter: `blur(${out * 6}px)` }}>
      {words.map((wd, i) => {
        const k = clamp01((t - wd.t) / 0.22);
        if (k <= 0) return null;
        const e = E.out(k);
        const hero = !!wd.hero;
        const glow = hero
          ? "0 0 6px rgba(255,255,255,0.95), 0 0 18px rgba(255,236,214,0.85), 0 0 42px rgba(255,190,150,0.6), 0 2px 10px rgba(50,15,60,0.55), 0 0 30px rgba(50,15,60,0.35)"
          : "0 0 5px rgba(255,255,255,0.9), 0 0 16px rgba(255,255,255,0.6), 0 0 34px rgba(255,255,255,0.35), 0 2px 8px rgba(50,15,60,0.6), 0 0 26px rgba(50,15,60,0.4)";
        return (
          <span key={i} style={{
            display: "inline-block", color: "#FFFFFF", textShadow: glow, opacity: e,
            transform: `translateY(${(1 - e) * 14}px) scale(${0.94 + 0.06 * e})`, filter: `blur(${(1 - e) * 7}px)`,
            ...(hero ? { fontFamily: FONT.serif, fontStyle: "italic", fontWeight: 400, fontSize: 92, letterSpacing: "-0.01em" } : { fontFamily: FONT.sans, fontWeight: 700, fontSize: 60, letterSpacing: "-0.015em" }),
          }}>{wd.w}</span>
        );
      })}
    </div>
    </>
  );
};
export const Caption: React.FC<{ t: number; words: CapWord[]; style: CapStyle; until: number; y?: number }> = ({ t, words, style, until, y = 820 }) => {
  if (t < words[0].t - 0.05 || t > until) return null;
  if (style === "accentGlow") return <AccentGlow t={t} words={words} until={until} y={y} />;
  const out = pr(t, until - 0.12, until, E.in);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: y, display: "flex", justifyContent: "center", alignItems: "baseline", gap: 18, opacity: 1 - out }}>
      {words.map((wd, i) => {
        const k = clamp01((t - wd.t) / 0.16);
        if (k <= 0) return null;
        const pop = E.back(k);
        const hero = !!wd.hero;
        const base: React.CSSProperties = { display: "inline-block", transform: `translateY(${(1 - pop) * 18}px) scale(${0.7 + 0.3 * pop})`, opacity: k };
        if (style === "slam" && hero)
          return <span key={i} style={{ ...base, fontFamily: FONT.sans, fontWeight: 800, fontSize: 96, letterSpacing: "-0.03em", textTransform: "uppercase", color: BRAND.apricot, textShadow: "0 6px 0 #B85F12, 0 14px 30px rgba(0,0,0,0.35)", transform: `${base.transform} rotate(-3deg)` }}>{wd.w}</span>;
        if (style === "highlight" && hero)
          return <span key={i} style={{ ...base, fontFamily: FONT.sans, fontWeight: 800, fontSize: 64, textTransform: "uppercase", color: "#0F2A20", background: BRAND.mint, padding: "2px 18px", borderRadius: 14, boxShadow: "0 10px 26px rgba(0,0,0,0.3)" }}>{wd.w}</span>;
        if (style === "glow" && hero)
          return <span key={i} style={{ ...base, fontFamily: FONT.serif, fontStyle: "italic", fontSize: 96, color: "#E0368A", textShadow: "0 0 16px rgba(255,127,176,0.75), 0 0 40px rgba(255,127,176,0.55), 0 6px 14px rgba(110,20,70,0.25)" }}>{wd.w}</span>;
        // white with a charcoal outline, like the real looks: reads on the pale pastel sets too
        return <span key={i} style={{ ...base, fontFamily: FONT.sans, fontWeight: 800, fontSize: 56, color: "#FFFFFF", WebkitTextStroke: `10px ${BRAND.charcoal}`, paintOrder: "stroke fill", textShadow: "0 8px 18px rgba(26,26,26,0.4)" }}>{wd.w}</span>;
      })}
    </div>
  );
};
