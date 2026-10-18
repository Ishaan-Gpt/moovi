import React from "react";
import { AbsoluteFill } from "remotion";
import { E, clamp01, pr, rand } from "../../kit";

// Ref C clone: what sits on the measured field: silhouettes, falling monitors, columns, cloth, cards, shards, light.
// 1080×1920 px. Every element is a function of t (seeded randomness only). Depth of field = per-element blur.

const W = 1080, H = 1920;
type S = React.CSSProperties;
const abs = (x: number, y: number, w: number, h: number, extra: S = {}): S => ({ position: "absolute", left: x, top: y, width: w, height: h, ...extra });
const on = (t: number, a: number, b: number) => t >= a && t < b;

// ── 0–2.0 s · night meadow: beige CRT monitors tumbling in slow motion over grass, bokeh ──
const CRT: React.FC<{ x: number; y: number; s: number; r: number; ry: number; blur: number; o?: number }> = ({ x, y, s, r, ry, blur, o = 1 }) => (
  <div style={abs(x - 60 * s, y - 50 * s, 120 * s, 100 * s, { transform: `rotate(${r}deg) skewY(${ry}deg)`, filter: `blur(${blur}px)`, opacity: o })}>
    <div style={abs(0, 0, 120 * s, 100 * s, { background: "linear-gradient(160deg,#D9CFAE,#A69A78 60%,#6E6650)", borderRadius: 10 * s, boxShadow: `${14 * s}px ${10 * s}px 0 #5E5743` })} />
    <div style={abs(14 * s, 12 * s, 78 * s, 60 * s, { background: "linear-gradient(150deg,#3A3A2E,#16160F)", borderRadius: 8 * s, boxShadow: "inset 0 0 6px rgba(0,0,0,0.6)" })} />
    <div style={abs(98 * s, 30 * s, 10 * s, 10 * s, { background: "#5A5240", borderRadius: "50%" })} />
  </div>
);
const CRTS = [[230, 930, 2.4, -18, 6, 2], [470, 1060, 2.0, 12, -8, 0.5], [800, 880, 2.0, 28, 10, 1.5], [900, 1220, 2.6, -32, -6, 3], [300, 1300, 2.2, 40, 8, 2],
  [640, 1340, 1.7, -8, -4, 1], [600, 700, 1.2, -40, 12, 4]] as const;
const Grass: React.FC<{ y0: number; tint: string }> = ({ y0, tint }) => (
  <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
    {Array.from({ length: 260 }, (_, i) => {
      const x = rand(i * 3) * W, h = 40 + rand(i * 5) * 160, yb = y0 + rand(i * 7) * (H - y0);
      const lean = (rand(i * 11) - 0.5) * 60;
      return <path key={i} d={`M ${x} ${yb} q ${lean * 0.4} ${-h * 0.6} ${lean} ${-h}`} stroke={i % 3 ? tint : "#2C3418"} strokeWidth={2 + rand(i) * 3} fill="none" opacity={0.55 + rand(i * 13) * 0.4} />;
    })}
  </svg>
);
const Bokeh: React.FC<{ n: number; seed: number; color: string; t: number; area?: [number, number, number, number]; r?: [number, number] }> = ({ n, seed, color, t, area = [0, 0, W, H], r = [30, 90] }) => (
  <>
    {Array.from({ length: n }, (_, i) => {
      const rr = r[0] + rand(seed + i) * (r[1] - r[0]);
      const x = area[0] + rand(seed + i * 3) * area[2] + Math.sin(t * 0.4 + i) * 10, y = area[1] + rand(seed + i * 7) * area[3] + Math.cos(t * 0.3 + i) * 8;
      return <div key={i} style={abs(x - rr, y - rr, rr * 2, rr * 2, { borderRadius: "50%", background: `radial-gradient(circle, ${color} 0%, ${color} 55%, transparent 70%)`, opacity: 0.18 + rand(seed + i * 11) * 0.22, filter: "blur(2px)" })} />;
    })}
  </>
);
const Meadow: React.FC<{ t: number }> = ({ t }) => {
  const s = t * 0.25; // slow motion
  const tilt = pr(t, 1.0, 1.25, E.inOut) * (1 - pr(t, 1.9, 2.0));
  return (
    <AbsoluteFill style={{ transform: `perspective(1600px) rotateY(${-22 * tilt}deg) rotateZ(${-6 * tilt}deg) scale(${1 - 0.12 * tilt})` }}>
      <Grass y0={1050} tint="#4A5A24" />
      <div style={abs(-200, 560, 700, 700, { borderRadius: "50%", background: "radial-gradient(circle, rgba(220,200,90,0.45), transparent 65%)", filter: "blur(30px)" })} />
      <Bokeh n={6} seed={5} color="#E8DC9A" t={t} area={[0, 300, W, 900]} r={[40, 110]} />
      {CRTS.map(([x, y, sc, r, ry, b], i) => (
        <CRT key={i} x={x + Math.sin(s + i) * 20} y={y + s * 60 * (0.5 + rand(i))} s={sc} r={r + s * 30 * (rand(i * 3) - 0.5)} ry={ry} blur={b} />
      ))}
    </AbsoluteFill>
  );
};

// ── 2.0–8.0 s · dark teal room: desk, office chair, desk lamp (silhouettes), feathers, window light ──
const Feathers: React.FC<{ t: number; n: number; seed: number; color: string; area: [number, number, number, number]; size?: number }> = ({ t, n, seed, color, area, size = 1 }) => (
  <>
    {Array.from({ length: n }, (_, i) => {
      const x = area[0] + rand(seed + i) * area[2] + Math.sin(t * 0.7 + i * 2) * 40;
      const y = area[1] + ((rand(seed + i * 3) * area[3] + t * 22 * (0.5 + rand(i))) % area[3]);
      const sc = (0.6 + rand(seed + i * 5) * 0.9) * size;
      return (
        <svg key={i} width={90 * sc} height={34 * sc} viewBox="0 0 90 34" style={{ position: "absolute", left: x, top: y, transform: `rotate(${(rand(i) - 0.5) * 120 + Math.sin(t + i) * 20}deg)`, filter: `blur(${rand(i * 9) * 3}px)` }}>
          <path d="M2 17 C 20 2, 60 0, 88 15 C 62 30, 24 32, 2 17 Z" fill={color} />
          <path d="M2 17 L 88 15" stroke="rgba(0,0,0,0.35)" strokeWidth={1.4} />
        </svg>
      );
    })}
  </>
);
const Room: React.FC<{ t: number }> = ({ t }) => {
  const push = pr(t, 2.0, 3.5, E.lin);
  const sc = 1 + 0.06 * push;
  return (
    <AbsoluteFill style={{ transform: `scale(${sc})` }}>
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <linearGradient id="lampbeam" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="rgba(220,240,240,0.45)" />
            <stop offset="1" stopColor="rgba(220,240,240,0)" />
          </linearGradient>
        </defs>
        <path d="M 280 905 L 120 1240 L 470 1240 Z" fill="url(#lampbeam)" opacity={0.5} />
        <g fill="#0E1416" stroke="#0E1416">
          <rect x={140} y={1150} width={820} height={18} rx={4} />
          <rect x={170} y={1168} width={14} height={300} />
          <rect x={910} y={1168} width={14} height={300} />
          <path d="M 300 1150 L 300 1010 L 230 900" strokeWidth={8} fill="none" />
          <path d="M 205 885 L 275 870 L 290 905 L 220 925 Z" />
          <rect x={700} y={1080} width={140} height={70} rx={8} opacity={0.9} />
          <path d="M 470 1000 Q 470 900 560 890 Q 650 900 650 1000 L 640 1150 L 480 1150 Z" />
          <rect x={455} y={1150} width={210} height={40} rx={14} />
          <rect x={552} y={1190} width={16} height={150} />
          <path d="M 470 1360 L 560 1330 L 650 1360 M 560 1330 L 560 1370" strokeWidth={10} fill="none" />
        </g>
        <path d="M 210 920 L 290 905" stroke="rgba(230,255,255,0.7)" strokeWidth={4} />
      </svg>
      <Bokeh n={6} seed={21} color="#BFE0DD" t={t} area={[60, 500, 700, 500]} r={[50, 110]} />
      <Feathers t={t} n={7} seed={3} color="#1A2224" area={[100, 300, 880, 700]} />
    </AbsoluteFill>
  );
};
const ChairPush: React.FC<{ t: number }> = ({ t }) => {
  const k = pr(t, 3.5, 5.0, E.in);
  return (
    <AbsoluteFill>
      <div style={abs(160, 260, 760, 900, { background: "linear-gradient(180deg, rgba(230,245,245,0.35), transparent 75%)", clipPath: "polygon(38% 0, 62% 0, 100% 100%, 0 100%)", filter: "blur(18px)" })} />
      <div style={abs(250 - 260 * k, 1150 - 120 * k, 580 + 520 * k, 560 + 700 * k, { background: "radial-gradient(ellipse at 50% 35%, #1D2A2C, #0B1112 70%)", borderRadius: "48% 48% 30% 30%", filter: `blur(${10 + 18 * k}px)` })} />
      <Feathers t={t} n={6} seed={11} color="#151C1E" area={[120, 300, 840, 900]} size={1.3} />
    </AbsoluteFill>
  );
};
const WindowRoom: React.FC<{ t: number }> = ({ t }) => {
  const fade = 1 - pr(t, 7.0, 7.9);
  return (
    <AbsoluteFill style={{ opacity: fade }}>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} style={abs(905 + (i % 2) * 70, 620 + Math.floor(i / 2) * 210, 58, 190, { background: "linear-gradient(180deg,#CFE4E6,#9DB8BC)", filter: "blur(3px)", opacity: 0.8 })} />
      ))}
      <div style={abs(300, 300, 700, 1100, { background: "linear-gradient(200deg, rgba(200,230,230,0.25), transparent 60%)", clipPath: "polygon(70% 0, 100% 0, 60% 100%, 10% 100%)", filter: "blur(30px)" })} />
      <Feathers t={t} n={5} seed={31} color="#C9DADA" area={[200, 600, 600, 700]} size={0.7} />
    </AbsoluteFill>
  );
};
const SunBurst: React.FC<{ t: number }> = ({ t }) => {
  const k = pr(t, 8.0, 8.25);
  return (
    <AbsoluteFill>
      <div style={abs(420, 980, 500, 500, { borderRadius: "50%", background: "radial-gradient(circle, #FFFDF2 0%, rgba(255,250,230,0.9) 18%, rgba(255,240,210,0.2) 45%, transparent 70%)", transform: `scale(${0.8 + 0.4 * k})` })} />
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        {Array.from({ length: 30 }, (_, i) => (
          <path key={i} d={`M ${200 + rand(i) * 500} ${500 + rand(i * 3) * 300} q ${rand(i * 5) * 200} ${-60 - rand(i * 7) * 120} ${rand(i * 9) * 300 - 50} ${-120}`} stroke="#0B0C0A" strokeWidth={6 + rand(i) * 10} fill="none" />
        ))}
      </svg>
    </AbsoluteFill>
  );
};

// ── 8.25–14.75 s · Greek columns against the sky, a GPU card, red cloth, debris ──
const Column: React.FC<{ x: number; y: number; w: number; h: number; r: number; blur?: number; shade?: number }> = ({ x, y, w, h, r, blur = 0, shade = 0 }) => (
  <div style={abs(x, y, w, h, { transform: `rotate(${r}deg)`, transformOrigin: "50% 100%", filter: `blur(${blur}px) brightness(${1 - shade})` })}>
    <div style={abs(-w * 0.12, 0, w * 1.24, w * 0.18, { background: "linear-gradient(180deg,#B9B6AD,#7D7A72)" })} />
    <div style={abs(-w * 0.06, w * 0.18, w * 1.12, w * 0.12, { background: "#8F8B82" })} />
    <div style={abs(0, w * 0.3, w, h - w * 0.5, { background: `repeating-linear-gradient(90deg, #6E6B64 0, #A8A49A ${w * 0.06}px, #CFCBC0 ${w * 0.1}px, #8C887F ${w * 0.16}px)` })} />
    <div style={abs(-w * 0.1, h - w * 0.2, w * 1.2, w * 0.2, { background: "linear-gradient(180deg,#9A968C,#5E5B55)" })} />
  </div>
);
const Cloth: React.FC<{ t: number; x: number; y: number; s: number; r: number }> = ({ t, x, y, s, r }) => {
  const ph = t * 1.4;
  const top = Array.from({ length: 12 }, (_, i) => [i * 80, Math.sin(ph + i * 0.7) * 60 + i * 18] as const);
  const bot = top.map(([px, py], i) => [px, py + 240 + Math.sin(ph * 1.3 + i) * 50] as const).reverse();
  const d = "M " + [...top, ...bot].map(([px, py]) => `${px} ${py}`).join(" L ") + " Z";
  return (
    <svg width={1000} height={700} viewBox="0 -120 900 760" style={{ position: "absolute", left: x, top: y, transform: `rotate(${r}deg) scale(${s})`, filter: "blur(3px)" }}>
      <defs>
        <linearGradient id="cloth" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#B33A22" />
          <stop offset="0.5" stopColor="#7A1E12" />
          <stop offset="1" stopColor="#C94A2C" />
        </linearGradient>
      </defs>
      <path d={d} fill="url(#cloth)" opacity={0.9} />
    </svg>
  );
};
const GPU: React.FC<{ x: number; y: number; r: number; s?: number }> = ({ x, y, r, s = 1 }) => (
  <div style={abs(x, y, 220 * s, 90 * s, { transform: `rotate(${r}deg)`, background: "linear-gradient(160deg,#3A3A3C,#121214)", borderRadius: 8 * s, boxShadow: `0 ${8 * s}px 0 #0A0A0B` })}>
    {[0, 1].map((i) => <div key={i} style={abs(20 * s + i * 100 * s, 10 * s, 70 * s, 70 * s, { borderRadius: "50%", background: "radial-gradient(circle,#555 10%,#1A1A1C 30%,#2A2A2C 60%,#0E0E10 70%)" })} />)}
  </div>
);
const Debris: React.FC<{ t: number; n: number; seed: number }> = ({ t, n, seed }) => (
  <>
    {Array.from({ length: n }, (_, i) => {
      const x = rand(seed + i) * W + Math.sin(t + i) * 30, y = (rand(seed + i * 3) * H + t * 40 * (0.3 + rand(i))) % H;
      return <div key={i} style={abs(x, y, 8 + rand(i * 5) * 14, 4 + rand(i * 7) * 6, { background: "#2A2C30", transform: `rotate(${rand(i * 9) * 180 + t * 40}deg)`, opacity: 0.8 })} />;
    })}
  </>
);
const Columns: React.FC<{ t: number }> = ({ t }) => {
  const a = t < 12.15;
  const k = pr(t, 8.25, 12.15, E.lin), k2 = pr(t, 12.15, 14.75, E.lin);
  return a ? (
    <AbsoluteFill>
      <Column x={760 - 20 * k} y={760} w={150} h={1150} r={2} shade={0.18} />
      <Column x={-160 + 30 * k} y={-200} w={200} h={1300} r={-14} blur={4} shade={0.55} />
      <GPU x={360 + 60 * k} y={760 - 80 * k} r={-24 + 12 * k} />
      <Cloth t={t} x={-420 + 160 * k} y={60 + 160 * k} s={2.1 + 0.3 * k} r={22} />
      <Debris t={t} n={60} seed={41} />
    </AbsoluteFill>
  ) : (
    <AbsoluteFill>
      <Column x={180 - 30 * k2} y={560} w={200} h={1450} r={-6} shade={0.45} />
      <Column x={600 + 20 * k2} y={420} w={230} h={1600} r={9} shade={0.5} />
      <Column x={10} y={-300} w={160} h={1300} r={-22} blur={3} shade={0.55} />
      <GPU x={520 - 40 * k2} y={900 + 300 * k2} r={70 + 40 * k2} s={0.8} />
      {t < 12.6 && <Cloth t={t} x={-300} y={400} s={1.6} r={-30} />}
      <Debris t={t} n={30} seed={51} />
    </AbsoluteFill>
  );
};

// ── 15.33–17.54 s · the film card (stand-in footage: an abstract yellow mech in motion) ──
const FilmCard: React.FC<{ t: number }> = ({ t }) => (
  <div style={abs(54, 580, 972, 760, { borderRadius: 46, overflow: "hidden", boxShadow: "0 0 0 2px rgba(255,255,255,0.08), 0 40px 80px rgba(0,0,0,0.6)" })}>
    <div style={abs(0, 0, 972, 760, { background: "linear-gradient(135deg,#3B4022,#1C1E12 50%,#4A4320)" })} />
    {Array.from({ length: 9 }, (_, i) => (
      <div key={i} style={abs(100 + rand(i) * 700 + Math.sin(t * 2 + i) * 40, 60 + rand(i * 3) * 560, 160 + rand(i * 5) * 200, 50 + rand(i * 7) * 120, {
        background: i % 2 ? "linear-gradient(135deg,#E7C23A,#8A6A10)" : "linear-gradient(135deg,#2C2A20,#0F0E0A)", transform: `rotate(${rand(i * 9) * 90 - 45 + t * 10 * (rand(i) - 0.5)}deg)`, filter: "blur(10px)", borderRadius: 10, opacity: 0.85,
      })} />
    ))}
  </div>
);

// ── 17.54–19.0 s · three outlined question marks and a scanning light ──
const QMarks: React.FC<{ t: number }> = ({ t }) => {
  const scan = pr(t, 17.54, 18.9, E.inOut);
  return (
    <AbsoluteFill>
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        {[0, 1, 2].map((i) => (
          <g key={i} transform={`translate(${300 + i * 200} ${520}) rotate(${(i - 1) * 6}) scale(2.2)`} opacity={0.55}>
            <path d="M -30 0 Q -30 -60 20 -60 Q 70 -60 70 -10 Q 70 30 25 50 L 25 110" stroke="#C9D6C9" strokeWidth={6} fill="none" />
            <circle cx={25} cy={150} r={10} stroke="#C9D6C9" strokeWidth={5} fill="none" />
          </g>
        ))}
      </svg>
      <div style={abs(-300 + 1300 * scan, 300, 260, 1300, { background: "linear-gradient(90deg, transparent, rgba(220,235,220,0.35), transparent)", transform: "rotate(-25deg)", filter: "blur(20px)" })} />
    </AbsoluteFill>
  );
};

// ── 19.0–21.25 / 22.0–23.08 / 25.2–26.85 s · penthouse window over a night city, desk, lamp, search bar ──
const City: React.FC<{ y0: number; seed: number }> = ({ y0, seed }) => (
  <>
    {Array.from({ length: 140 }, (_, i) => (
      <div key={i} style={abs(rand(seed + i) * W, y0 + rand(seed + i * 3) * 260, 4 + rand(i) * 6, 3, { background: i % 4 ? "#F4D58A" : "#BFE3F0", opacity: 0.35 + rand(i * 5) * 0.5, filter: "blur(1px)" })} />
    ))}
  </>
);
const SEARCH = "how to make a transformers movie";
const Penthouse: React.FC<{ t: number; snacks?: boolean; typed?: boolean }> = ({ t, snacks, typed }) => {
  const n = typed ? Math.round(pr(t, 19.05, 20.6, E.lin) * SEARCH.length) : SEARCH.length;
  return (
    <AbsoluteFill>
      <City y0={760} seed={61} />
      <div style={abs(0, 560, W, 14, { background: "#0A0D10" })} />
      {[0, 270, 540, 810].map((x) => <div key={x} style={abs(x, 280, 16, 860, { background: "#0A0D10" })} />)}
      <div style={abs(0, 1120, W, 26, { background: "linear-gradient(180deg,#3B3326,#14110C)" })} />
      <div style={abs(0, 1146, W, 420, { background: "linear-gradient(180deg,#14130F,#070706)" })} />
      <div style={abs(20, 900, 200, 260, { background: "radial-gradient(circle at 50% 40%, rgba(255,214,140,0.85), rgba(255,180,90,0.2) 40%, transparent 70%)", filter: "blur(6px)" })} />
      <div style={abs(70, 920, 90, 90, { background: "linear-gradient(180deg,#F7E2B0,#C9A060)", borderRadius: "10px 10px 4px 4px" })} />
      <div style={abs(380, 1010, 140, 100, { background: "#16181C", border: "3px solid #3A3C40", borderRadius: 6 })} />
      <div style={abs(395, 1022, 110, 72, { background: "linear-gradient(135deg,#E8ECEE,#9AA4A8)", opacity: 0.7 })} />
      <div style={abs(500, 1260, 160, 30, { background: "#D8DCD8", transform: "rotate(30deg)", borderRadius: 4, opacity: 0.85 })} />
      <div style={abs(230, 980, 640, 54, { borderRadius: 27, background: "rgba(40,36,24,0.85)", border: "2px solid rgba(255,214,120,0.6)", display: "flex", alignItems: "center", paddingLeft: 26, color: "#F2D27A", fontFamily: "C-Sans", fontSize: 26 })}>
        {SEARCH.slice(0, n)}
      </div>
      {snacks && Array.from({ length: 8 }, (_, i) => (
        <div key={i} style={abs(100 + rand(i * 3) * 820, 560 + rand(i * 5) * 520 - (t - 22) * 60, 60 + rand(i) * 40, 80 + rand(i * 7) * 40, { opacity: 0.75,
          background: ["linear-gradient(135deg,#E8303A,#7A0F18)", "linear-gradient(135deg,#F2D13A,#9A7A12)", "linear-gradient(135deg,#8A3FE0,#3A1478)", "linear-gradient(135deg,#F2F2F2,#9A9A9A)"][i % 4],
          borderRadius: 10, transform: `rotate(${rand(i * 9) * 140 - 70 + (t - 22) * 40}deg)`, filter: `blur(${2 + rand(i) * 5}px) saturate(0.7)`,
        })} />
      ))}
    </AbsoluteFill>
  );
};

// ── 23.08–25.2 s · gothic arches lit gold, a grand piano ──
const Arch: React.FC<{ t: number }> = ({ t }) => {
  const push = pr(t, 23.08, 25.2, E.in);
  return (
    <AbsoluteFill style={{ transform: `scale(${1 + 0.08 * push})` }}>
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#E9D9A0" />
            <stop offset="1" stopColor="#6E5E2E" />
          </linearGradient>
        </defs>
        {[[60, 420, 300], [720, 420, 300]].map(([x, y, w], i) => (
          <path key={i} d={`M ${x} ${y + 1200} L ${x} ${y + 300} Q ${x} ${y} ${x + w / 2} ${y - 80} Q ${x + w} ${y} ${x + w} ${y + 300} L ${x + w} ${y + 1200}`} stroke="url(#gold)" strokeWidth={18} fill="none" opacity={0.75} />
        ))}
        <path d="M 360 1380 L 360 600 Q 540 380 720 600 L 720 1380" stroke="rgba(233,217,160,0.35)" strokeWidth={10} fill="none" />
        <rect x={420} y={340} width={240} height={160} rx={20} fill="rgba(255,240,200,0.55)" />
      </svg>
      <div style={abs(160, 1330, 640, 120, { background: "linear-gradient(180deg,#B6D8C0,#466A56)", transform: "skewX(-20deg)", borderRadius: 6, opacity: 0.8 })} />
      <div style={abs(170, 1340, 600, 40, { background: "repeating-linear-gradient(90deg,#F2F2EC 0 22px,#222 22px 26px)", transform: "skewX(-20deg)", opacity: 0.85 })} />
      <div style={abs(120, 1450, 760, 260, { background: "linear-gradient(180deg,#0E1612,#050806)", transform: "skewX(-20deg)" })} />
    </AbsoluteFill>
  );
};

// ── 25.2–26.85 s · the frame as a card, its corner peeling ──
const Peel: React.FC<{ t: number }> = ({ t }) => {
  const k = pr(t, 25.6, 26.85, E.inOut);
  return (
    <AbsoluteFill>
      <div style={abs(120, 300, 840, 1400, { borderRadius: 40, boxShadow: "0 0 0 2px rgba(200,230,230,0.15), 0 0 0 4000px rgba(5,7,8,0.82)" })} />
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        <path d={`M ${960 - 160 * k} 1700 L 960 ${1700 - 160 * k} L ${960 - 110 * k} ${1700 - 40 * k} Z`} fill="#5FC9C2" opacity={0.85} />
      </svg>
    </AbsoluteFill>
  );
};

// ── 27–34.4 s · feathers + glass shards in darkness, then the light streak ──
const Shards: React.FC<{ t: number; n: number; seed: number; bright?: number }> = ({ t, n, seed, bright = 0.3 }) => (
  <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
    {Array.from({ length: n }, (_, i) => {
      const cx = rand(seed + i) * W + Math.sin(t * 0.5 + i) * 30, cy = rand(seed + i * 3) * H + Math.cos(t * 0.4 + i) * 30;
      const s = 60 + rand(seed + i * 5) * 150, a = t * 0.3 * (rand(i) - 0.5) + rand(i * 7) * 6;
      const pts = [0, 1, 2, 3].map((k) => [cx + Math.cos(a + k * 1.7 + rand(i * k + 1)) * s, cy + Math.sin(a + k * 1.7 + rand(i * k + 2)) * s * 0.7]);
      return <path key={i} d={"M " + pts.map((p) => p.join(" ")).join(" L ") + " Z"} fill={`rgba(200,210,205,${0.06 + rand(i * 11) * 0.12})`} stroke={`rgba(240,245,240,${bright})`} strokeWidth={2} />;
    })}
  </svg>
);
const Streak: React.FC<{ t: number }> = ({ t }) => {
  const k = pr(t, 32.3, 33.3, E.inOut), fade = 1 - pr(t, 34.0, 34.35);
  const len = 2200;
  return (
    <svg width={W} height={H} style={{ position: "absolute", inset: 0, opacity: fade }}>
      <defs>
        <filter id="glow"><feGaussianBlur stdDeviation="14" /></filter>
      </defs>
      <path d="M -40 1180 C 220 1420, 420 1360, 600 1250 C 780 1140, 900 1250, 1120 1120" stroke="#F4EDDC" strokeWidth={70} fill="none" strokeLinecap="round" strokeDasharray={len} strokeDashoffset={len * (1 - k)} filter="url(#glow)" opacity={0.9} />
      <path d="M -40 1180 C 220 1420, 420 1360, 600 1250 C 780 1140, 900 1250, 1120 1120" stroke="#FFFFFF" strokeWidth={26} fill="none" strokeLinecap="round" strokeDasharray={len} strokeDashoffset={len * (1 - k)} />
    </svg>
  );
};
const Sparkles: React.FC<{ t: number; n: number; seed: number; path: (u: number) => [number, number]; color?: string }> = ({ t, n, seed, path, color = "#F7EBC8" }) => (
  <>
    {Array.from({ length: n }, (_, i) => {
      const [x, y] = path(rand(seed + i));
      const tw = 0.5 + 0.5 * Math.sin(t * 8 + i * 1.7);
      return <div key={i} style={abs(x + (rand(i * 3) - 0.5) * 60, y + (rand(i * 5) - 0.5) * 60, 4 + rand(i) * 6, 4 + rand(i) * 6, { borderRadius: "50%", background: color, opacity: tw, boxShadow: `0 0 10px ${color}` })} />;
    })}
  </>
);

// ── 34.4–41.6 s · gold flash, red cloth, flourishes, the gold dune, flowers ──
const Flourish: React.FC<{ t: number }> = ({ t }) => {
  const k = pr(t, 36.5, 37.3, E.out);
  return (
    <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
      <path d="M 300 960 C 220 880, 240 760, 330 740 C 420 720, 440 820, 380 850 C 330 870, 300 820, 340 800" stroke="#D8CDB0" strokeWidth={6} fill="none" strokeDasharray={900} strokeDashoffset={900 * (1 - k)} />
      <path d="M 790 990 C 880 1060, 870 1180, 780 1190 C 700 1196, 690 1110, 750 1090" stroke="#D8CDB0" strokeWidth={6} fill="none" strokeDasharray={700} strokeDashoffset={700 * (1 - k)} />
    </svg>
  );
};
const Dune: React.FC<{ t: number }> = ({ t }) => {
  const k = pr(t, 38.4, 39.6, E.out);
  return <div style={abs(220, 870 + 30 * (1 - k), 640, 260, { borderRadius: "50% 50% 0 0 / 100% 100% 0 0", background: "radial-gradient(ellipse at 45% 20%, #F6DA8A, #B8862E 45%, #3A2A10 85%)", opacity: 0.85 * k, filter: "blur(2px)" })} />;
};
const Flowers: React.FC<{ t: number }> = ({ t }) => (
  <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
    {[[540, 760, 1.6], [220, 1300, 0.9], [860, 1250, 0.8], [400, 1550, 0.7]].map(([x, y, s], i) => (
      <g key={i} transform={`translate(${x} ${y}) scale(${s}) rotate(${t * 4 + i * 30})`} opacity={0.55}>
        {Array.from({ length: 6 }, (_, k) => (
          <ellipse key={k} cx={0} cy={-90} rx={46} ry={95} transform={`rotate(${k * 60})`} fill="rgba(170,170,160,0.35)" stroke="rgba(230,230,220,0.5)" strokeWidth={2} />
        ))}
        <circle r={22} fill="rgba(210,205,190,0.6)" />
      </g>
    ))}
    {Array.from({ length: 10 }, (_, i) => <rect key={i} x={rand(i) * W} y={0} width={3} height={900} fill="rgba(220,220,210,0.18)" />)}
  </svg>
);

export const Props: React.FC<{ t: number }> = ({ t }) => (
  <>
    {on(t, 0, 2.0) && <Meadow t={t} />}
    {on(t, 2.0, 3.5) && <Room t={t} />}
    {on(t, 3.5, 5.0) && <ChairPush t={t} />}
    {on(t, 5.0, 8.0) && <WindowRoom t={t} />}
    {on(t, 8.0, 8.25) && <SunBurst t={t} />}
    {on(t, 8.25, 14.75) && <Columns t={t} />}
    {on(t, 15.333, 17.5) && <FilmCard t={t} />}
    {on(t, 17.5, 19.0) && <QMarks t={t} />}
    {on(t, 19.0, 21.25) && <Penthouse t={t} typed />}
    {on(t, 22.0, 23.083) && <Penthouse t={t} snacks />}
    {on(t, 23.083, 25.208) && <Arch t={t} />}
    {on(t, 25.208, 26.9) && (
      <>
        <Penthouse t={t} />
        <Peel t={t} />
      </>
    )}
    {on(t, 27.0, 29.6) && (
      <>
        <Shards t={t} n={8} seed={71} bright={0.15} />
        <Feathers t={t} n={6} seed={81} color="#5E8C88" area={[100, 500, 880, 900]} size={2.2} />
      </>
    )}
    {on(t, 29.6, 34.375) && (
      <>
        <Shards t={t} n={12} seed={91} bright={0.5} />
        <Streak t={t} />
        <Sparkles t={t} n={60} seed={101} path={(u) => [120 + u * 760, 1300 - u * 500]} />
      </>
    )}
    {on(t, 34.375, 36.417) && (
      <>
        <Sparkles t={t} n={70} seed={111} path={(u) => [150 + u * 780, 1350 - u * 900]} />
        {t > 35.0 && <div style={abs(-80, 1350, 520, 260, { background: "linear-gradient(120deg,#8A1C12,#3A0806)", borderRadius: "40% 60% 30% 70%", filter: "blur(6px)", transform: `rotate(${-20 + Math.sin(t * 2) * 6}deg)` })} />}
      </>
    )}
    {on(t, 36.417, 38.4) && <Flourish t={t} />}
    {on(t, 38.4, 39.833) && <Dune t={t} />}
    {on(t, 40.0, 41.6) && <Flowers t={t} />}
  </>
);
void clamp01;
