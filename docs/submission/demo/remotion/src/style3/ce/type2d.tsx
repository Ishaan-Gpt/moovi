import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { E, FONT, clamp01, drift, kf, pr, rand } from "../lib";
import { BRAND } from "./shared";

// ce3-01 After-Effects half: typed type on brand pastels (cream, apricot, mint, lavender) + overlays on the 3D shots.

const caretOn = (t: number) => Math.floor(t * 3.2) % 2 === 0;
const typed = (s: string, t: number, a: number, b: number) => s.slice(0, Math.round(clamp01((t - a) / (b - a)) * s.length));
const center: React.CSSProperties = { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" };
const radial = (inner: string, mid: string, outer: string, x = 50, y = 50) => `radial-gradient(ellipse 75% 85% at ${x}% ${y}%, ${inner} 0%, ${mid} 45%, ${outer} 100%)`;
const Caret: React.FC<{ t: number; color: string; h: number }> = ({ t, color, h }) => (
  <span style={{ display: "inline-block", width: Math.max(2, h * 0.06), height: h * 0.9, background: color, opacity: caretOn(t) ? 1 : 0, marginLeft: h * 0.06, verticalAlign: "middle", transform: `translateY(-${h * 0.06}px)` }} />
);
const serifGrad: React.CSSProperties = { fontFamily: FONT.serif, fontStyle: "italic", background: `linear-gradient(95deg, ${BRAND.apricot}, #FF6FA8)`, WebkitBackgroundClip: "text", color: "transparent", padding: "0 0.08em" };

// ── 2.32–4.3 "Your captions should too." ──
const ShouldToo: React.FC<{ t: number }> = ({ t }) => {
  const a = typed("Your captions ", t, 2.34, 2.8);
  const b = typed("should ", t, 2.85, 3.05);
  const c = typed("too.", t, 3.12, 3.3);
  const white = 1 - pr(t, 2.32, 2.55);
  return (
    <AbsoluteFill style={{ background: radial("#FFFBF4", "#F3E6FB", "#DCCBF6") }}>
      <AbsoluteFill style={{ background: "radial-gradient(circle at 12% 88%, rgba(255,169,70,0.45), transparent 40%), radial-gradient(circle at 90% 12%, rgba(52,211,153,0.3), transparent 38%)" }} />
      <div style={{ ...center, transform: `scale(${1 + pr(t, 2.32, 4.3, E.lin) * 0.07})` }}>
        <div style={{ fontFamily: FONT.sans, fontWeight: 700, fontSize: 80, letterSpacing: "-0.025em", color: "#1C1A24", textShadow: "0 10px 30px rgba(126,98,214,0.25)" }}>
          {a}
          {b}
          {c && <span style={{ ...serifGrad, fontSize: 108, fontWeight: 400 }}>{c}</span>}
          <Caret t={t} color="#1C1A24" h={80} />
        </div>
      </div>
      <AbsoluteFill style={{ background: "#FFF", opacity: white }} />
    </AbsoluteFill>
  );
};

// ── 7.4–9.45 "What if they moved like After Effects," ──
const WORDS: [string, number, number][] = [["What", 7.45, 7.6], ["if", 7.64, 7.72], ["they", 7.76, 7.88], ["moved", 7.94, 8.16], ["like", 8.24, 8.36], ["After", 8.46, 8.62], ["Effects,", 8.72, 8.96]];
const PlaneSvg: React.FC<{ color: string; size: number; style?: React.CSSProperties }> = ({ color, size, style }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" style={style}>
    <path d="M38 4 L2 18 L16 22 Z" fill={color} />
    <path d="M38 4 L16 22 L20 37 Z" fill={color} opacity={0.75} />
  </svg>
);
const WhatIf: React.FC<{ t: number }> = ({ t }) => {
  const parts = WORDS.map(([w, a, b]) => typed(w, t, a, b));
  const scale = kf(t, [[7.4, 0.48], [8.0, 0.6, E.inOut], [8.7, 1.05, E.inOut], [9.45, 1.18, E.glide]]);
  const fly = pr(t, 9.05, 9.4, E.in);
  return (
    <AbsoluteFill style={{ background: "#FFFFFF" }}>
      <div style={{ ...center, transform: `scale(${scale})` }}>
        <div style={{ position: "relative", fontFamily: FONT.ui, fontWeight: 500, fontSize: 58, letterSpacing: "-0.02em", color: "#24222B" }}>
          {parts.slice(0, 5).filter(Boolean).join(" ")}
          {parts[5] && <span style={{ fontWeight: 800, color: "#7E62D6" }}> {parts[5]}</span>}
          {parts[6] && <span style={{ fontWeight: 800, color: "#7E62D6" }}> {parts[6]}</span>}
          <Caret t={t} color="#24222B" h={58} />
          <PlaneSvg color="#7E62D6" size={36} style={{ position: "absolute", right: -50 - fly * 900, bottom: -32 + fly * 520, transform: `rotate(${-10 - fly * 30}deg)`, opacity: 1 - pr(t, 9.3, 9.42) }} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── 9.45–11.45 "without ever opening After Effects?" (struck through, then zoomed through) ──
const NoAE: React.FC<{ t: number }> = ({ t }) => {
  if (t < 10.15) {
    return (
      <AbsoluteFill style={{ background: radial("#E9DDFB", "#C9B2F4", "#9A80E6", 40, 60) }}>
        <div style={center}>
          <div style={{ fontFamily: FONT.sans, fontWeight: 700, fontSize: 60, color: "#2E1F66", textShadow: "0 6px 24px rgba(255,255,255,0.55)" }}>
            {typed("without ever opening", t, 9.47, 10.05)}
            <Caret t={t} color="#2E1F66" h={60} />
          </div>
        </div>
      </AbsoluteFill>
    );
  }
  const z = kf(t, [[10.15, 1.0], [11.12, 1.1, E.lin], [11.45, 2.7, E.in]]);
  const blur = kf(t, [[10.15, 8], [10.3, 0, E.out], [11.12, 0], [11.45, 26, E.in]]);
  const strike = pr(t, 10.7, 10.92, E.out);
  return (
    <AbsoluteFill style={{ background: radial("#F6D2F0", "#D9A0F0", "#9A80E6", 50, 40) }}>
      <div style={{ ...center, transform: `scale(${z})`, filter: `blur(${blur}px)` }}>
        <div style={{ position: "relative", fontFamily: FONT.sans, fontWeight: 800, fontSize: 190, letterSpacing: "-0.04em", color: "#FFF8FF", textShadow: "0 18px 50px rgba(90,40,160,0.45)" }}>
          After Effects?
          <div style={{ position: "absolute", left: -20, top: "52%", height: 30, width: `${strike * 104}%`, background: BRAND.mint, borderRadius: 16, transform: "rotate(-3deg)", boxShadow: "0 8px 20px rgba(0,80,50,0.35)" }} />
        </div>
      </div>
      <AbsoluteFill style={{ background: "#FFF", opacity: pr(t, 11.35, 11.45, E.in) }} />
    </AbsoluteFill>
  );
};

// ── 11.45–12.95 letters gather into "Meet", then the real CaptionsEasy logo ──
const SCATTER = "aftereffectscaptions".split("");
const Meet: React.FC<{ t: number }> = ({ t }) => {
  if (t < 12.05) {
    const g = pr(t, 11.45, 11.75, E.inOut);
    const meet = pr(t, 11.62, 11.86, E.back);
    return (
      <AbsoluteFill style={{ background: "#FFFDF8" }}>
        {SCATTER.map((ch, i) => {
          const a = rand(i * 5 + 3) * Math.PI * 2;
          const r = 260 + rand(i * 5 + 4) * 380;
          return (
            <div key={i} style={{ position: "absolute", left: 960 + Math.cos(a) * r * 1.4 * (1 - g), top: 540 + Math.sin(a) * r * 0.45 * (1 - g), fontFamily: FONT.sans, fontWeight: 700, fontSize: 26 + rand(i * 5 + 2) * 22, color: i % 3 ? "#7E62D6" : BRAND.apricot, transform: `translate(-50%,-50%) rotate(${(rand(i * 5 + 1) - 0.5) * 140 * (1 - g)}deg)`, opacity: (1 - pr(t, 11.62, 11.7)) * pr(t, 11.45, 11.5) }}>
              {ch}
            </div>
          );
        })}
        <div style={{ ...center, opacity: pr(t, 11.62, 11.67), transform: `scale(${0.82 + 0.18 * meet}) rotate(${(1 - meet) * -4}deg)` }}>
          <div style={{ position: "relative" }}>
            <svg width={120} height={120} viewBox="0 0 100 100" style={{ position: "absolute", left: -64, top: -40, transform: `rotate(${-18 + drift(t, 1, 6)}deg)` }}>
              <path d="M10 20 L80 6 L60 70 Z" fill={BRAND.apricot} />
              <path d="M10 20 L60 70 L30 90 Z" fill="#FFD3A0" />
            </svg>
            <div style={{ fontFamily: FONT.sans, fontWeight: 800, fontSize: 170, letterSpacing: "-0.04em", background: "linear-gradient(100deg,#7E62D6 10%,#FF6FA8 90%)", WebkitBackgroundClip: "text", color: "transparent" }}>Meet</div>
            <svg width={90} height={90} viewBox="0 0 100 100" style={{ position: "absolute", right: -44, bottom: -10, transform: `rotate(${24 + drift(t, 2, 6)}deg)` }}>
              <path d="M20 10 L90 40 L30 80 Z" fill={BRAND.mint} />
              <path d="M20 10 L30 80 L5 50 Z" fill="#A6F0D2" />
            </svg>
          </div>
        </div>
      </AbsoluteFill>
    );
  }
  const k = pr(t, 12.05, 12.35, E.out);
  return (
    <AbsoluteFill style={{ background: radial("#FFFFFF", "#FFF8EE", "#F4ECFA") }}>
      <div style={{ ...center, transform: `scale(${0.94 + 0.06 * k + pr(t, 12.1, 12.95, E.lin) * 0.03})`, opacity: k }}>
        <Img src={staticFile("style3/ce/captionseasy-logo.png")} style={{ width: 760 }} />
      </div>
    </AbsoluteFill>
  );
};

// ── 16.0–18.7 "No watermark. Free, and open source." ──
const Promise3: React.FC<{ t: number }> = ({ t }) => {
  const bg = radial("#FFFDF8", "#FBF1E4", "#F1E4F7");
  if (t < 16.85) {
    const k = pr(t, 16.08, 16.3, E.back);
    const sweep = pr(t, 16.35, 16.6, E.out);
    return (
      <AbsoluteFill style={{ background: bg }}>
        <div style={{ ...center, transform: `scale(${1.15 - 0.15 * k})`, filter: `blur(${(1 - k) * 10}px)`, opacity: k }}>
          <div style={{ position: "relative", fontFamily: FONT.sans, fontWeight: 800, fontSize: 132, letterSpacing: "-0.04em", color: "#1C1A24" }}>
            No watermark.
            <div style={{ position: "absolute", left: "34%", right: `${(1 - sweep) * 66}%`, bottom: -6, height: 16, borderRadius: 8, background: BRAND.apricot }} />
          </div>
        </div>
      </AbsoluteFill>
    );
  }
  if (t < 17.42) {
    const k = pr(t, 16.88, 17.05, E.back);
    return (
      <AbsoluteFill style={{ background: bg }}>
        <div style={{ ...center, transform: `scale(${1.4 - 0.4 * k})`, filter: `blur(${(1 - k) * 12}px)` }}>
          <div style={{ fontFamily: FONT.sans, fontWeight: 800, fontSize: 250, letterSpacing: "-0.05em", background: `linear-gradient(100deg, #12B07C, ${BRAND.mint})`, WebkitBackgroundClip: "text", color: "transparent" }}>Free.</div>
        </div>
      </AbsoluteFill>
    );
  }
  const k = pr(t, 17.45, 17.7, E.back);
  return (
    <AbsoluteFill style={{ background: bg }}>
      <div style={{ ...center, gap: 34, transform: `scale(${0.92 + 0.08 * k + pr(t, 17.5, 18.7, E.lin) * 0.04})`, opacity: k }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", height: 120 }}>
          {[["#1A1A1A", 70], [BRAND.apricot, 120], [BRAND.mint, 92]].map(([c, h], i) => (
            <div key={i} style={{ width: 26, height: (h as number) * pr(t, 17.5 + i * 0.06, 17.75 + i * 0.06, E.back), borderRadius: 13, background: c as string }} />
          ))}
        </div>
        <div style={{ fontFamily: FONT.sans, fontWeight: 700, fontSize: 96, color: "#1C1A24" }}>
          and <span style={{ ...serifGrad, fontSize: 130, background: "linear-gradient(95deg,#7E62D6,#FF6FA8)", WebkitBackgroundClip: "text" }}>open source.</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── 22.2–24 end card ──
const EndCard: React.FC<{ t: number }> = ({ t }) => {
  const k = pr(t, 22.2, 22.55, E.out);
  const tag = pr(t, 22.55, 22.85, E.out);
  return (
    <AbsoluteFill style={{ background: radial("#FFFFFF", "#FFF8EE", "#EEE3FA") }}>
      <div style={{ ...center, flexDirection: "column", gap: 34, transform: `scale(${0.95 + 0.05 * k + pr(t, 22.2, 24, E.lin) * 0.03})` }}>
        <Img src={staticFile("style3/ce/captionseasy-logo.png")} style={{ width: 820, opacity: k }} />
        <div style={{ opacity: tag, transform: `translateY(${(1 - tag) * 14}px)`, fontFamily: FONT.sans, fontWeight: 700, fontSize: 52, color: "#1C1A24" }}>
          Viral captions. <span style={{ ...serifGrad, fontSize: 64, fontWeight: 400 }}>Zero watermark.</span>
        </div>
        <div style={{ opacity: pr(t, 22.85, 23.1), fontFamily: FONT.ui, fontWeight: 500, fontSize: 28, color: "#6B6480", letterSpacing: "0.04em" }}>FREE · OPEN SOURCE · 30+ LOOKS</div>
      </div>
    </AbsoluteFill>
  );
};

export const TypeShots: React.FC<{ t: number }> = ({ t }) => {
  if (t >= 2.32 && t < 4.3) return <ShouldToo t={t} />;
  if (t >= 7.4 && t < 9.45) return <WhatIf t={t} />;
  if (t >= 9.45 && t < 11.45) return <NoAE t={t} />;
  if (t >= 11.45 && t < 12.95) return <Meet t={t} />;
  if (t >= 16.0 && t < 18.7) return <Promise3 t={t} />;
  if (t >= 22.2) return <EndCard t={t} />;
  return null;
};

// ── overlays on the 3D shots ──
const Halftone: React.FC<{ corner: "tr" | "bl"; color: string; o: number }> = ({ corner, color, o }) => (
  <AbsoluteFill
    style={{
      backgroundImage: `radial-gradient(${color} 32%, transparent 36%)`,
      backgroundSize: "11px 11px",
      opacity: o,
      WebkitMaskImage: corner === "tr" ? "radial-gradient(circle at 100% 0%, black 0%, rgba(0,0,0,0.6) 14%, transparent 30%)" : "radial-gradient(circle at 0% 100%, black 0%, rgba(0,0,0,0.6) 12%, transparent 26%)",
      mixBlendMode: "multiply",
    }}
  />
);
const Leaks: React.FC<{ t: number; o: number }> = ({ t, o }) => (
  <AbsoluteFill style={{ mixBlendMode: "screen", opacity: o }}>
    {[0, 1, 2].map((i) => (
      <div key={i} style={{ position: "absolute", left: -420 + i * 200 + drift(t, i, 30), top: -300, width: 110 + i * 30, height: 1700, transform: "rotate(-34deg)", background: "linear-gradient(90deg, rgba(255,214,170,0) 0%, rgba(255,206,160,0.55) 50%, rgba(255,214,170,0) 100%)", filter: "blur(18px)" }} />
    ))}
  </AbsoluteFill>
);
const Sparkles: React.FC<{ t: number }> = ({ t }) => {
  const k = pr(t, 1.95, 2.32, E.lin);
  if (k <= 0 || k >= 1) return null;
  return (
    <AbsoluteFill>
      {Array.from({ length: 60 }, (_, i) => {
        const a = rand(i * 3) * Math.PI * 2;
        const r = (80 + rand(i * 3 + 1) * 700) * (0.3 + k);
        return <div key={i} style={{ position: "absolute", left: 960 + Math.cos(a) * r * 1.3, top: 520 + Math.sin(a) * r * 0.8, width: 3 + rand(i) * 4, height: 3 + rand(i) * 4, borderRadius: 9, background: "#FFFFFF", opacity: Math.sin(k * Math.PI) * (0.5 + rand(i + 7) * 0.5), boxShadow: "0 0 6px #fff" }} />;
      })}
    </AbsoluteFill>
  );
};
const InsetFrame: React.FC = () => (
  <AbsoluteFill>
    {[110, 1806].map((x) => <div key={x} style={{ position: "absolute", left: x, top: 0, width: 2, height: 1080, background: "rgba(255,255,255,0.85)" }} />)}
    {[104, 958].map((y) => <div key={y} style={{ position: "absolute", top: y, left: 0, height: 2, width: 1920, background: "rgba(255,255,255,0.85)" }} />)}
  </AbsoluteFill>
);

export const Overlays: React.FC<{ t: number }> = ({ t }) => {
  const bars = t < 1.0 ? 138 : 0;
  return (
    <>
      {t < 2.32 && (
        <>
          <Leaks t={t} o={0.28} />
          <Halftone corner="tr" color="#E0803A" o={0.7} />
          <Sparkles t={t} />
        </>
      )}
      {t >= 4.3 && t < 7.4 && <InsetFrame />}
      {((t >= 12.95 && t < 16) || (t >= 18.7 && t < 22.2)) && <Halftone corner="bl" color="#B48CE8" o={0.35} />}
      {bars > 0 && (
        <>
          <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: bars, background: "#000" }} />
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: bars, background: "#000" }} />
        </>
      )}
      {t < 0.06 && <AbsoluteFill style={{ background: "#000" }} />}
    </>
  );
};
