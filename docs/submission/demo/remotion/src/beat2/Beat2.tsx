// Beat 2 of the Moovi demo film, "The wave" (0:12–0:30), built from Ishaan's C-Clone (MotionEasy clone 3) itself: its
// measured colour field, its set pieces (cclone/props.tsx), its fitted grades, its grain + vignette, its type system
// (small caps, Instrument Serif upright/italic, Fraunces display, words blurring in on their own times) and its stems
// (music "Almost Bliss" + the sfx track, cut per shot in audio/beat2-mix.ts). Re-timed to Ishaan's lines, 16:9.
import React from "react";
import { AbsoluteFill, continueRender, delayRender, staticFile, useCurrentFrame } from "remotion";
import { E, clamp01, pr } from "../style3/kit";
import { meshFlow, MeshKey } from "../style3/mesh";
import MESH from "../../data/c-clone/mesh.json";
import CURVES from "../../data/c-clone/curves.json";
import { Props } from "../style3/films/cclone/props";

export const FPS = 24, W = 1920, H = 1080;
(globalThis as { CC_SEARCH?: string }).CC_SEARCH = "vibe edit my launch video";

/** shots: our time → C-Clone source time (speed < 1 = the ref's slow motion stretched), and where its 9:16 world is centred */
export const SHOTS = [
  { a: 0.0, b: 3.0, src: 0.0, speed: 0.667, fy: 0.56, name: "crts" },        // "We had AI video generators."
  { a: 3.0, b: 7.0, src: 29.6, speed: 1.0, fy: 0.52, name: "streak" },      // "Now there's a new wave: videos written in code."
  { a: 7.0, b: 10.0, src: 8.25, speed: 1.0, fy: 0.5, name: "columns" },     // "Every frame is code,"
  { a: 10.0, b: 11.9, src: 15.333, speed: 1.0, fy: 0.5, name: "card" },     // "every cut is a decision"
  { a: 11.9, b: 13.0, src: 17.6, speed: 1.0, fy: 0.42, name: "qmarks" },     // "you can read."
  { a: 13.0, b: 16.0, src: 19.0, speed: 0.75, fy: 0.45, name: "penthouse" }, // "After vibe coding comes vibe editing."
  { a: 16.0, b: 18.0, src: 34.375, speed: 1.0, fy: 0.5, name: "gold" },     // "And we're riding it."
];
export const BEAT2_SECONDS = 18;
const shotAt = (t: number) => SHOTS.find((s) => t >= s.a && t < s.b) ?? SHOTS[SHOTS.length - 1];
const srcOf = (t: number) => { const s = shotAt(t); return s.src + (t - s.a) * s.speed; };

// ── fonts (C-Clone's own) ──
const FONTS: [string, string, FontFaceDescriptors][] = [
  ["C-Serif", "style3/c-clone/fonts/instrument-serif-latin-400-normal.woff2", { style: "normal" }],
  ["C-Serif", "style3/c-clone/fonts/instrument-serif-latin-400-italic.woff2", { style: "italic" }],
  ["C-Display", "style3/c-clone/fonts/fraunces-latin-wght-normal.woff2", { weight: "100 900" }],
  ["C-Sans", "style3/c-clone/fonts/inter-latin-wght-normal.woff2", { weight: "100 900" }],
];
let fontsP: Promise<void> | null = null;
const useCFonts = () => {
  const [ok, setOk] = React.useState(false);
  const [h] = React.useState(() => delayRender("beat2 fonts"));
  React.useEffect(() => {
    if (!fontsP) fontsP = Promise.all(FONTS.map(([f, u, d]) => new FontFace(f, `url(${staticFile(u)})`, d).load().then((ff) => void document.fonts.add(ff)))).then(() => undefined);
    fontsP.then(() => { setOk(true); continueRender(h); });
  }, [h]);
  return ok;
};

// ── the measured colour field, laid full-bleed at 16:9 ──
const KEYS = MESH as MeshKey[], FW = 48, FH = 27;
const Field: React.FC<{ t: number }> = ({ t }) => {
  const ref = React.useRef<HTMLCanvasElement>(null);
  const g = meshFlow(KEYS, t), rows = g.length, cols = g[0].length;
  React.useLayoutEffect(() => {
    const c = ref.current!.getContext("2d")!, img = c.createImageData(FW, FH);
    for (let v = 0; v < FH; v++) for (let u = 0; u < FW; u++) {
      const x = ((u + 0.5) / FW) * cols - 0.5, y = (0.3 + 0.4 * (v + 0.5) / FH) * rows - 0.5; // the middle band of the portrait field
      const x0 = Math.max(0, Math.min(cols - 1, Math.floor(x))), y0 = Math.max(0, Math.min(rows - 1, Math.floor(y))), x1 = Math.min(cols - 1, x0 + 1), y1 = Math.min(rows - 1, y0 + 1), fx = clamp01(x - x0), fy = clamp01(y - y0);
      for (let ch = 0; ch < 3; ch++) { const a = g[y0][x0][ch] * (1 - fx) + g[y0][x1][ch] * fx, b = g[y1][x0][ch] * (1 - fx) + g[y1][x1][ch] * fx; img.data[(v * FW + u) * 4 + ch] = a * (1 - fy) + b * fy; }
      img.data[(v * FW + u) * 4 + 3] = 255;
    }
    c.putImageData(img, 0, 0);
  });
  return <canvas ref={ref} width={FW} height={FH} style={{ position: "absolute", inset: 0, width: W, height: H, filter: "blur(22px)", transform: "scale(1.06)" }} />;
};

// ── the set pieces: C-Clone's 1080×1920 world, scaled to cover 16:9, centred on each shot's action band, with a slow push ──
const Stage: React.FC<{ t: number; src: number }> = ({ t, src }) => {
  const s = shotAt(t), k = (t - s.a) / (s.b - s.a), scale = (W / 1080) * (1 + 0.04 * k), top = H / 2 - s.fy * 1920 * scale;
  return (
    <div style={{ position: "absolute", left: (W - 1080 * scale) / 2, top, width: 1080, height: 1920, transform: `scale(${scale})`, transformOrigin: "0 0" }}>
      <Props t={src} />
    </div>
  );
};

// ── grades fitted to the ref, by source time ──
type Fit = { t0: number; t1: number; before: number; after: number; curves: number[][] };
const FITS = Object.entries(CURVES as Record<string, Fit>).filter(([, f]) => f.after > f.before + 0.005);
const Grades: React.FC = () => (
  <svg width={0} height={0} style={{ position: "absolute" }}>
    {FITS.map(([n, f]) => (
      <filter key={n} id={`b2-${n}`} colorInterpolationFilters="sRGB"><feComponentTransfer>
        <feFuncR type="table" tableValues={f.curves[0].join(" ")} /><feFuncG type="table" tableValues={f.curves[1].join(" ")} /><feFuncB type="table" tableValues={f.curves[2].join(" ")} />
      </feComponentTransfer></filter>
    ))}
  </svg>
);
const gradeAt = (src: number) => { const hit = FITS.find(([, f]) => src >= f.t0 && src < f.t1); return hit ? `url(#b2-${hit[0]})` : undefined; };

// ── type: C-Clone's system, our lines ──
type Font = "sans" | "caps" | "serif" | "italic" | "display";
type Word = { s: string; at: number; f: Font; size: number; x?: number; y: number; w?: number; ls?: number; o?: number };
type Phrase = { t0: number; t1: number; words: Word[]; fx?: "blur" | "glitch" | "rise"; shrink?: [number, number, number] };
const INK = "#EDE6D3";
const P: Phrase[] = [
  { t0: 0.1, t1: 1.05, words: [{ s: "WE HAD", at: 0.12, f: "caps", size: 30, y: 0.44 }, { s: "AI video", at: 0.42, f: "italic", size: 200, y: 0.53, x: 0.5 }] },
  { t0: 1.05, t1: 2.9, fx: "glitch", words: [{ s: "generators", at: 1.08, f: "display", size: 230, y: 0.52, x: 0.5, w: 800, ls: -8 }] },
  { t0: 3.05, t1: 4.45, fx: "rise", words: [{ s: "NOW THERE'S A", at: 3.08, f: "caps", size: 30, y: 0.43 }, { s: "new wave", at: 3.55, f: "italic", size: 240, y: 0.53, x: 0.5 }] },
  { t0: 4.5, t1: 6.85, words: [
    { s: "videos", at: 4.52, f: "sans", size: 70, y: 0.4, x: 0.42, w: 400 },
    { s: "written in", at: 4.78, f: "serif", size: 150, y: 0.5, x: 0.5 },
    { s: "code", at: 5.25, f: "display", size: 250, y: 0.63, x: 0.56, w: 800, ls: -8 },
  ] },
  { t0: 7.05, t1: 8.4, shrink: [8.1, 8.38, 0.3], words: [{ s: "EVERY", at: 7.08, f: "caps", size: 30, y: 0.4 }, { s: "frame", at: 7.3, f: "italic", size: 380, y: 0.54, x: 0.5 }] },
  { t0: 8.4, t1: 9.9, words: [{ s: "is", at: 8.42, f: "italic", size: 90, y: 0.45, x: 0.4 }, { s: "code,", at: 8.6, f: "serif", size: 230, y: 0.53, x: 0.53 }] },
  { t0: 10.05, t1: 11.0, words: [{ s: "EVERY CUT", at: 10.08, f: "caps", size: 30, y: 0.46 }, { s: "IS A", at: 10.5, f: "caps", size: 30, y: 0.52 }] },
  { t0: 11.0, t1: 11.85, words: [{ s: "decision", at: 11.02, f: "italic", size: 250, y: 0.52, x: 0.5 }] },
  { t0: 11.95, t1: 12.95, words: [{ s: "you can", at: 11.97, f: "sans", size: 64, y: 0.42, x: 0.44, w: 400 }, { s: "read.", at: 12.2, f: "italic", size: 260, y: 0.54, x: 0.52 }] },
  { t0: 13.05, t1: 14.4, words: [{ s: "after", at: 13.08, f: "italic", size: 80, y: 0.2, x: 0.38 }, { s: "vibe coding", at: 13.3, f: "serif", size: 170, y: 0.28, x: 0.5 }] },
  { t0: 14.4, t1: 15.95, fx: "rise", words: [{ s: "COMES", at: 14.42, f: "caps", size: 30, y: 0.16 }, { s: "vibe editing", at: 14.62, f: "italic", size: 230, y: 0.28, x: 0.5 }] },
  { t0: 16.05, t1: 18.0, words: [{ s: "AND WE'RE", at: 16.08, f: "caps", size: 30, y: 0.42 }, { s: "riding it.", at: 16.4, f: "italic", size: 270, y: 0.53, x: 0.5 }] },
];
const fontCss = (f: Font, w?: number): React.CSSProperties =>
  f === "sans" ? { fontFamily: "C-Sans", fontWeight: w ?? 400 } : f === "caps" ? { fontFamily: "C-Sans", fontWeight: 500, letterSpacing: "0.12em" } :
  f === "display" ? { fontFamily: "C-Display", fontWeight: w ?? 800 } : f === "italic" ? { fontFamily: "C-Serif", fontStyle: "italic" } : { fontFamily: "C-Serif" };
const GLOW = "0 0 22px rgba(255,236,200,0.38), 0 0 2px rgba(255,240,215,0.5), 0 6px 40px rgba(0,0,0,0.5)";
const TypeLayer: React.FC<{ t: number }> = ({ t }) => (
  <>
    {P.filter((p) => t >= p.t0 && t < p.t1).map((p, i) => {
      const out = pr(t, p.t1 - 0.1, p.t1, E.in), sh = p.shrink ? 1 - (1 - p.shrink[2]) * pr(t, p.shrink[0], p.shrink[1], E.inOut) : 1;
      return (
        <AbsoluteFill key={i} style={{ opacity: 1 - out, filter: out > 0 ? `blur(${out * 12}px)` : undefined, transform: `scale(${sh})`, transformOrigin: "50% 52%" }}>
          {[...new Set(p.words.filter((w) => w.f === "caps").map((w) => w.y))].map((y) => (
            <div key={`r${y}`} style={{ position: "absolute", left: 0, right: 0, top: y * H, transform: "translateY(-50%)", display: "flex", justifyContent: "center", gap: "0.5em", fontSize: 40, lineHeight: 1, color: INK, whiteSpace: "nowrap", textShadow: GLOW, ...fontCss("caps") }}>
              {p.words.filter((w) => w.f === "caps" && w.y === y).map((w, j) => { const k = pr(t, w.at, w.at + 0.16, E.out); return <span key={j} style={{ opacity: k, filter: k < 1 ? `blur(${(1 - k) * 8}px)` : undefined }}>{w.s}</span>; })}
            </div>
          ))}
          {p.words.filter((w) => w.f !== "caps").map((w, j) => {
            const k = pr(t, w.at, w.at + 0.18, E.out); if (k <= 0) return null;
            const glitch = p.fx === "glitch" && t - w.at < 0.25 ? Math.round(Math.sin(t * 90 + j) * 16) : 0, rise = p.fx === "rise" ? (1 - k) * 36 : 0;
            return <div key={j} style={{ position: "absolute", left: (w.x ?? 0.5) * W, top: w.y * H, transform: `translate(-50%, -50%) translate(${glitch}px, ${rise}px) scale(${1.06 - 0.06 * k})`, whiteSpace: "nowrap", fontSize: w.size, lineHeight: 1, color: INK, opacity: k * (w.o ?? 1), letterSpacing: w.ls, filter: k < 1 ? `blur(${(1 - k) * 12}px)` : undefined, textShadow: GLOW, ...fontCss(w.f, w.w) }}>{w.s}</div>;
          })}
        </AbsoluteFill>
      );
    })}
  </>
);

/** grain re-seeded per frame + the ref's heavy vignette + a dip on every cut (cuts land out of black, never a crossfade) */
const Finish: React.FC<{ frame: number; t: number }> = ({ frame, t }) => {
  const s = shotAt(t), dip = t - s.a < 0.12 && s.a > 0 ? 1 - (t - s.a) / 0.12 : 0;
  return (
    <>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 72% 70% at 50% 48%, rgba(0,0,0,0) 52%, rgba(0,0,0,0.6) 100%)" }} />
      <svg width={W} height={H} style={{ position: "absolute", inset: 0, opacity: 0.15, mixBlendMode: "overlay" }}>
        <filter id="b2g"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed={frame % 89} /><feColorMatrix type="saturate" values="0" /></filter>
        <rect width="100%" height="100%" filter="url(#b2g)" />
      </svg>
      {dip > 0 && <AbsoluteFill style={{ background: `rgba(0,0,0,${dip * 0.7})` }} />}
    </>
  );
};

export const Beat2: React.FC = () => {
  const frame = useCurrentFrame(), t = frame / FPS, src = srcOf(t), fonts = useCFonts();
  return (
    <AbsoluteFill style={{ background: "#0B0B0A", overflow: "hidden" }}>
      <Grades />
      <AbsoluteFill style={{ filter: gradeAt(src) }}>
        <Field t={src} />
        <Stage t={t} src={src} />
      </AbsoluteFill>
      {fonts && <TypeLayer t={t} />}
      <Finish frame={frame} t={t} />
    </AbsoluteFill>
  );
};
