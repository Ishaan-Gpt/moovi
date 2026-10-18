import React from "react";
import { AbsoluteFill } from "remotion";
import { E, FONT, Halftone, Letterbox, clamp01, kf, pr, rand, spring } from "../../kit";
import { PAL, SW_PATH, T } from "./common";

// Ref B clone, the 2D layers (1920×1080 px): HUD copy, halftone corners, letterbox, the bursts and torn paper between
// shots, the course panels, the kinetic type and the logo draw-on. Each returns null outside its window.

const px = (n: number) => `${n}px`;
const ui = (size: number, weight = 500, color = "#FFFFFF"): React.CSSProperties => ({ fontFamily: FONT.ui, fontSize: size, fontWeight: weight, color, lineHeight: 1.25 });

/** the course facts in small type down the left (ref 3.2–9.1 s), and a caption line in shot 1 */
const HUD_LINES = ["64 video tutorials", "Blender + After Effects", "", "12hrs+", "", "Projects Files", "", "Assets", "", "Sound Design Masterclass (FL Studio)", "", "Free SoundKit", "", "7.02GB total (uncompressed)"];
export const Hud: React.FC<{ t: number }> = ({ t }) => {
  if (t >= T.s3 && t < T.torn) {
    const o = pr(t, T.s3, T.s3 + 0.2) * (1 - pr(t, T.burst - 0.1, T.burst));
    return (
      <div style={{ position: "absolute", left: 30, top: 300, opacity: o * 0.85 }}>
        {HUD_LINES.map((l, i) => (
          <div key={i} style={{ ...ui(15, 500, "rgba(255,240,250,0.95)"), height: l ? 19 : 14 }}>{l}</div>
        ))}
      </div>
    );
  }
  if (t < T.s3) {
    return (
      <div style={{ position: "absolute", left: 300, top: 720, ...ui(11, 500, "rgba(255,255,255,0.8)"), width: 360 }}>
        The most anticipated motion design course for SaaS creators is almost here
      </div>
    );
  }
  return null;
};

/** halftone dots in the corners over the 3D (the ref's print texture) */
export const Dots: React.FC<{ t: number }> = ({ t }) => {
  const on = (t < T.torn) || (t >= T.s7 && t < T.s11) || (t >= T.s11 && t < T.s12);
  if (!on) return null;
  const c = t < T.s7 ? "rgba(140,40,200,0.55)" : t < T.s11 ? "rgba(120,110,140,0.35)" : "rgba(255,255,255,0.4)";
  return (
    <>
      <Halftone corner="bl" color={c} o={0.9} dot={10} reach={[10, 30]} />
      <Halftone corner="tr" color={c} o={0.7} dot={10} reach={[8, 26]} />
    </>
  );
};

/** letterbox over the Publish / IT'S LIVE stretch */
export const Bars: React.FC<{ t: number }> = ({ t }) => {
  const h = 128 * (pr(t, T.s4 - 0.04, T.s4 + 0.04) * (1 - pr(t, T.s7 + 0.05, T.s7 + 0.12)));
  return <Letterbox h={h} color="#06040A" />;
};

/** "WAIT IS OVER / IT'S LIVE!!!" types on bottom-left during the pull-out */
export const ItsLive: React.FC<{ t: number }> = ({ t }) => {
  if (t < T.s5 || t >= T.torn) return null;
  const a = "WAIT IS OVER!", b = "IT'S LIVE!!!";
  const na = Math.round(pr(t, T.s5 + 0.02, T.s5 + 0.3, E.lin) * a.length), nb = Math.round(pr(t, T.s5 + 0.2, T.s5 + 0.55, E.lin) * b.length);
  return (
    <div style={{ position: "absolute", left: 18, top: 852 }}>
      <div style={{ ...ui(20, 600, "rgba(255,255,255,0.9)"), letterSpacing: 1 }}>{a.slice(0, na)}</div>
      <div style={{ fontFamily: FONT.sans, fontWeight: 800, fontSize: 58, color: "#FFFFFF", lineHeight: 1, textShadow: "0 0 18px rgba(255,200,240,0.6)" }}>{b.slice(0, nb)}</div>
    </div>
  );
};

/** white speed-line burst out of a centre (ref 8.9 s, 11.5 s, 15.6 s); seeded, so frames are stable */
const SpeedLines: React.FC<{ k: number; color: string; n?: number; x?: number; y?: number; seed?: number; bg?: string }> = ({ k, color, n = 70, x = 960, y = 540, seed = 1, bg }) => (
  <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, background: bg }}>
    {Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2 + rand(seed + i) * 0.1;
      const r0 = 60 + 500 * k * (0.4 + rand(seed + i * 3) * 0.6), r1 = r0 + 200 + 700 * k * rand(seed + i * 7);
      return <line key={i} x1={x + Math.cos(a) * r0} y1={y + Math.sin(a) * r0} x2={x + Math.cos(a) * r1} y2={y + Math.sin(a) * r1} stroke={color} strokeWidth={2 + 7 * rand(seed + i * 11)} strokeLinecap="round" opacity={0.9 * (1 - k * 0.6)} />;
    })}
  </svg>
);

/** 8.875–9.417: white flash + speed lines, then the magenta torn-paper wipe with a violet ink stroke and a star burst */
export const Burst1: React.FC<{ t: number }> = ({ t }) => {
  if (t < T.burst || t >= T.s7) return null;
  if (t < T.torn) {
    const k = pr(t, T.burst, T.torn);
    return (
      <AbsoluteFill style={{ background: "#FFFFFF" }}>
        <SpeedLines k={k} color="#E6DFF0" seed={3} />
        <div style={{ position: "absolute", left: 870, top: 470, width: 180, height: 140, background: "linear-gradient(135deg,#F6A8D9,#B18BEF)", clipPath: "polygon(10% 30%, 40% 0, 70% 20%, 100% 10%, 85% 60%, 100% 90%, 50% 75%, 20% 100%, 0 70%)", transform: `scale(${0.6 + 1.6 * k}) rotate(${k * 40}deg)` }} />
      </AbsoluteFill>
    );
  }
  const k = pr(t, T.torn, T.s7);
  return (
    <AbsoluteFill style={{ background: "#F07ACB", overflow: "hidden" }}>
      <AbsoluteFill style={{ backgroundImage: "radial-gradient(rgba(140,20,140,0.55) 30%, transparent 34%)", backgroundSize: "12px 12px", opacity: 0.8 }} />
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        <path d={`M ${-100 + 0 * k} 520 C 400 ${300 - 80 * k}, 900 ${260 + 40 * k}, ${1500 + 300 * k} 140 L ${1600 + 300 * k} 300 C 1000 ${420 + 30 * k}, 500 ${520 - 40 * k}, -60 760 Z`} fill="#5A1FD1" opacity={0.92} />
        {Array.from({ length: 28 }, (_, i) => {
          const a = (i / 28) * Math.PI * 2;
          const r = 120 + 520 * k;
          return <line key={i} x1={960} y1={540} x2={960 + Math.cos(a) * r} y2={540 + Math.sin(a) * r} stroke="#C53DE0" strokeWidth={10} opacity={t > T.torn + 0.12 ? 0.85 : 0} />;
        })}
      </svg>
    </AbsoluteFill>
  );
};

/** 11.292–11.542: violet smear of the marker over magenta paper, then a white starburst */
export const Burst2: React.FC<{ t: number }> = ({ t }) => {
  if (t < T.flash7 || t >= T.s8) return null;
  const k = pr(t, T.flash7, T.s8);
  if (k < 0.45)
    return (
      <AbsoluteFill style={{ background: "linear-gradient(120deg,#EADFFB,#B9A2F2)", overflow: "hidden" }}>
        <AbsoluteFill style={{ backgroundImage: "radial-gradient(rgba(220,30,170,0.6) 30%, transparent 34%)", backgroundSize: "10px 10px", opacity: 0.6 }} />
        <div style={{ position: "absolute", left: 500, top: 420, width: 1100, height: 120, borderRadius: 60, background: "linear-gradient(90deg,#7C3BEA,#9A55F2)", transform: `rotate(-14deg) translateX(${(k - 0.2) * 600}px)`, filter: "blur(2px)" }} />
      </AbsoluteFill>
    );
  return (
    <AbsoluteFill style={{ background: "#FFFFFF" }}>
      <SpeedLines k={(k - 0.45) / 0.55} color="#F1DCEB" seed={9} />
      <div style={{ position: "absolute", left: 940, top: 470, width: 40, height: 140, borderRadius: 20, background: "#E5359A", transform: `rotate(18deg) scale(${1 - (k - 0.45)})` }} />
    </AbsoluteFill>
  );
};

/** 15.417–15.75: hot-pink burst with speed lines around the umbrella's silhouette */
export const Burst3: React.FC<{ t: number }> = ({ t }) => {
  if (t < T.pink + 0.12 || t >= T.s11) return null;
  const k = pr(t, T.pink + 0.12, T.s11);
  return (
    <AbsoluteFill style={{ background: "radial-gradient(circle at 50% 48%, #7A6AF2 0%, #5F4FE6 60%, #5040D8 100%)" }}>
      <SpeedLines k={k} color="#45E4F2" seed={21} n={90} />
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        <path d="M 820 520 Q 960 420 1100 520 Q 1060 500 1030 520 Q 1000 500 960 522 Q 920 500 890 520 Q 860 500 820 520 Z" fill="#6E2C6E" transform={`translate(960 520) scale(${1.1 + 0.4 * k}) translate(-960 -520)`} />
      </svg>
    </AbsoluteFill>
  );
};

/** small magenta words under "Answers" (ref 16.2–17.1 s) */
export const EasyWorkflows: React.FC<{ t: number }> = ({ t }) => {
  if (t < 16.15 || t >= 17.12) return null;
  const a = clamp01(spring(t, 16.18, 2.6, 0.55)), b = clamp01(spring(t, 16.3, 2.6, 0.55));
  const st = (k: number): React.CSSProperties => ({ position: "absolute", fontFamily: FONT.sans, fontWeight: 700, fontSize: 34, color: "#E0359F", transform: `translateY(${(1 - k) * 18}px)`, opacity: k });
  return (
    <>
      <div style={{ ...st(a), left: 640, top: 600 }}>easy</div>
      <div style={{ ...st(b), left: 980, top: 600 }}>workflows</div>
    </>
  );
};

const Thumb: React.FC<{ i: number; w: number; h: number }> = ({ i, w, h }) => {
  const g = [["#F28C9D", "#C9435A"], ["#C9D8FA", "#8FA8F0"], ["#E59BF0", "#9C4FD8"], ["#9FE0D8", "#4DB6A6"], ["#F7D0A0", "#E39050"]][i % 5];
  return <div style={{ width: w, height: h, borderRadius: 6, background: `linear-gradient(135deg, ${g[0]}, ${g[1]})`, boxShadow: "0 2px 8px rgba(0,0,0,0.12)" }} />;
};

/** 17.292–18.583: the course panel slides up over the sky */
const FACTS = ["64 video tutorials", "Blender + After Effects", "12hrs+", "Projects Files", "Assets", "Sound Design Masterclass", "Free SoundKit", "7.02GB total"];
export const CoursePanel: React.FC<{ t: number }> = ({ t }) => {
  if (t < T.panel || t >= T.s12) return null;
  const k = clamp01(spring(t, T.panel, 2.0, 0.8));
  const words = ["One", "course", "Teaches", "Full", "Production"];
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 420, transform: `translateY(${(1 - k) * 420}px)`, background: "#FBF7F4", boxShadow: "0 -20px 60px rgba(0,0,0,0.08)" }}>
      <div style={{ position: "absolute", left: 60, top: 40, fontFamily: FONT.sans, fontWeight: 700, fontSize: 52, color: PAL.ink, lineHeight: 1.05, width: 700 }}>
        {words.map((w, i) => {
          const o = pr(t, T.panel + 0.08 + i * 0.12, T.panel + 0.2 + i * 0.12);
          return <span key={i} style={{ opacity: o, color: i === 4 && t < T.panel + 0.8 ? "#C93BC0" : PAL.ink }}>{w}{i === 1 ? <br /> : " "}</span>;
        })}
      </div>
      <div style={{ position: "absolute", left: 60, top: 190, display: "flex", gap: 16 }}>
        {[0, 1, 2].map((i) => <Thumb key={i} i={i} w={190} h={110} />)}
      </div>
      <div style={{ position: "absolute", left: 60, top: 320, display: "flex", gap: 40, ...ui(14, 500, "#9C8F98") }}>
        {["Lifetime access", "Private discord", "Beginner friendly"].map((s) => <span key={s}>{s}</span>)}
      </div>
      <div style={{ position: "absolute", left: 1220, top: 40 }}>
        <div style={{ width: 160, height: 14, borderRadius: 7, background: "#F2D9B8", marginBottom: 14 }} />
        {FACTS.map((f, i) => (
          <div key={f} style={{ ...ui(19, 500, PAL.ink), opacity: pr(t, T.panel + 0.1 + i * 0.05, T.panel + 0.2 + i * 0.05) }}>• {f}</div>
        ))}
      </div>
    </div>
  );
};

/** 18.583–20.208 over the folder: magenta brush rings sweep round, faded "every…thing" letters behind */
export const Rings: React.FC<{ t: number }> = ({ t }) => {
  if (t < T.s12 || t >= T.s13) return null;
  const k = pr(t, T.s12, T.files + 0.1);
  const fade = 1 - pr(t, T.files - 0.1, T.files + 0.15);
  const ring = (r: number, a0: number, len: number, w: number, rot: number) => {
    const a1 = a0 + len;
    const p = (a: number) => [960 + Math.cos(a) * r, 540 + Math.sin(a) * r * 0.92];
    const [x0, y0] = p(a0), [x1, y1] = p(a1);
    return <path d={`M ${x0} ${y0} A ${r} ${r * 0.92} 0 ${len > Math.PI ? 1 : 0} 1 ${x1} ${y1}`} stroke="url(#hot)" strokeWidth={w} fill="none" strokeLinecap="round" transform={`rotate(${rot} 960 540)`} />;
  };
  return (
    <AbsoluteFill style={{ opacity: fade }}>
      <div style={{ position: "absolute", left: 80, top: 360, fontFamily: FONT.sans, fontWeight: 800, fontSize: 260, color: "rgba(240,120,200,0.18)", letterSpacing: -6 }}>
        {"every".slice(0, Math.round(pr(t, T.s12, T.s12 + 0.4) * 5))}
      </div>
      <div style={{ position: "absolute", left: 1220, top: 360, fontFamily: FONT.sans, fontWeight: 800, fontSize: 260, color: t < 19.0 ? "#D81F7F" : "rgba(240,120,200,0.25)", letterSpacing: -6 }}>
        {"thing".slice(0, Math.round(pr(t, T.s12 + 0.25, T.s12 + 0.5) * 5))}
      </div>
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <linearGradient id="hot" x1="0" x2="1">
            <stop offset="0" stopColor="#E0157F" />
            <stop offset="1" stopColor="#F04BA8" />
          </linearGradient>
        </defs>
        {ring(560 + 120 * k, -0.6 + 2.2 * k, 1.6, 60, -20)}
        {ring(500 + 60 * k, 2.4 + 1.8 * k, 1.2, 46, 10)}
        {ring(640 + 80 * k, 4.1 + 1.4 * k, 0.9, 34, 0)}
      </svg>
    </AbsoluteFill>
  );
};

/** 20.208–21.583: cards whip past, then the course page "Go beyond tutorials." with chips */
export const GoBeyond: React.FC<{ t: number }> = ({ t }) => {
  if (t < T.s13 || t >= T.s14) return null;
  const whip = pr(t, T.s13, T.s13 + 0.42, E.out);
  const words = "Go beyond tutorials.".split(" ");
  const chips = ["3D", "2D", "VO Edit", "Composite", "Sound design"];
  return (
    <AbsoluteFill style={{ background: "#F7F2EE" }}>
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 210, background: "#EFE6DE", opacity: pr(t, T.s13 + 0.05, T.s13 + 0.2) }}>
        <div style={{ position: "absolute", left: 24, top: 22, width: 46, height: 24 }}>
          <svg viewBox="0 0 100 50" width={46} height={24}><path d={SW_PATH.map(([x, y], i) => `${i ? "L" : "M"} ${x * 100} ${y * 50}`).join(" ")} stroke="#C8152E" strokeWidth={6} fill="none" strokeLinecap="round" /></svg>
        </div>
        {["Contents", "Videos", "Sound Design", "Content Details", "FAQs"].map((s, i) => (
          <div key={s} style={{ position: "absolute", left: 26, top: 80 + i * 40, ...ui(17, 500, "#3A3036") }}>▢ {s}</div>
        ))}
        <div style={{ position: "absolute", left: 18, bottom: 70, width: 170, height: 34, borderRadius: 8, background: "#E9DED5", ...ui(14, 500, "#5A4A50"), display: "flex", alignItems: "center", justifyContent: "center" }}>Explore Course</div>
        <div style={{ position: "absolute", left: 18, bottom: 26, width: 170, height: 34, borderRadius: 8, background: "#D9775F", ...ui(14, 600, "#FFFFFF"), display: "flex", alignItems: "center", justifyContent: "center" }}>Purchase</div>
      </div>
      <div style={{ position: "absolute", left: 960 - 330, top: 470, display: "flex", gap: 8, transform: `translateX(${(1 - whip) * 900}px)`, filter: `blur(${(1 - whip) * 16}px)` }}>
        {[0, 1, 2, 3, 4, 0, 1].map((i, j) => <Thumb key={j} i={i + j} w={88} h={62} />)}
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 410, textAlign: "center", fontFamily: FONT.sans, fontWeight: 600, fontSize: 40, color: PAL.ink }}>
        {words.map((w, i) => (
          <span key={i} style={{ opacity: pr(t, T.s13 + 0.4 + i * 0.12, T.s13 + 0.5 + i * 0.12), color: i === 2 && t < T.s13 + 0.9 ? "#C93BC0" : PAL.ink }}>{w} </span>
        ))}
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 560, display: "flex", gap: 12, justifyContent: "center" }}>
        {chips.map((c, i) => {
          const k = clamp01(spring(t, T.s13 + 0.55 + i * 0.1, 3, 0.5));
          return <div key={c} style={{ padding: "6px 22px", borderRadius: 20, background: "#3F8FC9", ...ui(18, 600, "#FFFFFF"), transform: `scale(${k})`, opacity: k > 0 ? 1 : 0 }}>{c}</div>;
        })}
      </div>
      <AbsoluteFill style={{ background: "#F6E9F8", opacity: pr(t, T.s14 - 0.08, T.s14) }} />
    </AbsoluteFill>
  );
};

/** 21.583–23.625: start!!!! (purple), Building (cream), Rea[l] (giant magenta slide), projects */
export const TypeRun: React.FC<{ t: number }> = ({ t }) => {
  if (t < T.s14 || t >= T.s15) return null;
  if (t >= T.s14 + 0.17 && t < T.building) {
    const k = clamp01(spring(t, T.s14 + 0.17, 3, 0.45));
    return (
      <AbsoluteFill style={{ background: "#F9E6F3", alignItems: "center", justifyContent: "center" }}>
        <AbsoluteFill style={{ backgroundImage: "radial-gradient(rgba(230,60,170,0.5) 30%, transparent 34%)", backgroundSize: "11px 11px", opacity: 0.55 }} />
        <div style={{ fontFamily: FONT.sans, fontWeight: 800, fontSize: 104, color: "#E0359F", WebkitTextStroke: "3px #9A1E78", transform: `scale(${0.85 + 0.15 * k})` }}>start!!!!!</div>
      </AbsoluteFill>
    );
  }
  if (t < T.building) {
    const k = clamp01(spring(t, T.s14 + 0.05, 2.8, 0.38));
    return (
      <AbsoluteFill style={{ background: "#C97BD8", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontFamily: FONT.sans, fontWeight: 800, fontSize: 120, color: "#FFFFFF", transform: `scale(${0.4 + 0.6 * k}) translateY(${(1 - k) * 60}px)`, letterSpacing: -2 }}>start!!!!</div>
      </AbsoluteFill>
    );
  }
  if (t < T.real) {
    const k = pr(t, T.building, T.building + 0.2, E.out);
    return (
      <AbsoluteFill style={{ background: "#F5F1EE", alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: FONT.sans, fontWeight: 700, fontSize: 64, color: PAL.ink, transform: `translateX(${(1 - k) * 80}px)`, opacity: k }}>
          <div style={{ width: 22, height: 22, borderRadius: 5, background: "#E0359F" }} />
          Building
        </div>
      </AbsoluteFill>
    );
  }
  if (t < T.projects) {
    const k = pr(t, T.real, T.projects, E.inOut);
    return (
      <AbsoluteFill style={{ background: "#F5F1EE", overflow: "hidden" }}>
        <div style={{ position: "absolute", left: 40 - 900 * k, top: 60, fontFamily: FONT.sans, fontWeight: 800, fontSize: 900, color: "#E0237F", lineHeight: 1, letterSpacing: -30, filter: `blur(${Math.abs(k - 0.4) * 10}px)` }}>Real</div>
      </AbsoluteFill>
    );
  }
  const k = clamp01(spring(t, T.projects, 2.6, 0.5));
  return (
    <AbsoluteFill style={{ background: "#ECEAEC", alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontFamily: FONT.sans, fontWeight: 700, fontSize: 70, color: "#D81F7F", transform: `scale(${0.7 + 0.3 * k})`, opacity: k }}>projects</div>
    </AbsoluteFill>
  );
};

/** 23.625 → end: the "Sw" script draws on, the wordmark fades up, a footer band with links */
export const LogoEnd: React.FC<{ t: number }> = ({ t }) => {
  if (t < T.s15) return null;
  const k = pr(t, T.s15 + 0.05, T.s15 + 0.9, E.inOut);
  const n = Math.max(2, Math.round(SW_PATH.length * k));
  const d = SW_PATH.slice(0, n).map(([x, y], i) => `${i ? "L" : "M"} ${x * 300} ${y * 150}`).join(" ");
  const word = pr(t, T.s15 + 0.75, T.s15 + 1.05);
  return (
    <AbsoluteFill style={{ background: "#EDEBEE" }}>
      <svg width={300} height={150} viewBox="0 0 300 150" style={{ position: "absolute", left: 960 - 150 - 20 * (1 - k), top: 360, overflow: "visible" }}>
        <defs>
          <linearGradient id="swg" x1="0" x2="1">
            <stop offset="0" stopColor="#F05A7E" />
            <stop offset="1" stopColor="#D8166A" />
          </linearGradient>
        </defs>
        <path d={d} stroke="url(#swg)" strokeWidth={14} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div style={{ position: "absolute", left: 0, right: 0, top: 505, textAlign: "center", fontFamily: FONT.sans, fontWeight: 800, fontSize: 22, letterSpacing: 2, color: "#C8163E", opacity: word }}>SaaSWAVE</div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 860, bottom: 0, background: "#E2E0E3", opacity: pr(t, T.s15 + 0.4, T.s15 + 0.8) }}>
        <div style={{ display: "flex", gap: 22, justifyContent: "center", marginTop: 24 }}>
          {["◎", "▣", "♪"].map((s) => <span key={s} style={{ ...ui(22, 600, "#4A4048") }}>{s}</span>)}
        </div>
        <div style={{ textAlign: "center", marginTop: 10, ...ui(13, 500, "#6A6068") }}>available now · saaswave.net</div>
        <div style={{ textAlign: "center", marginTop: 8, ...ui(11, 500, "#8A8088") }}>3D Animation · Voiceover · Sound Design · Final Edit</div>
      </div>
    </AbsoluteFill>
  );
};

/** grain + a faint lavender wash over every frame (ref's soft print look) */
export const Wash: React.FC<{ t: number }> = ({ t }) => {
  const pinkFlash = kf(t, [[T.s14 - 0.04, 0], [T.s14, 0.0]]);
  return pinkFlash > 0 ? <AbsoluteFill style={{ background: "#F6E9F8", opacity: pinkFlash }} /> : null;
};

void px;
