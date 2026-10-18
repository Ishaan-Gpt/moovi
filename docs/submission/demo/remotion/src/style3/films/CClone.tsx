import React from "react";
import { AbsoluteFill, Audio, continueRender, delayRender, staticFile, useCurrentFrame } from "remotion";
import { E, clamp01, pr } from "../kit";
import { meshFlow, MeshKey } from "../mesh";
import MESH from "../../../data/c-clone/mesh.json";
import CURVES from "../../../data/c-clone/curves.json";
import { Props } from "./cclone/props";

// Ref C ("Not everything has a tutorial", ig-C-pPfbftP_6) clone, FAST pipeline, 9:16 1080×1920, 41.58 s (998 frames).
// Private study, never posted. Grade first: the background is the ref's measured colour field (styles/tools/s3_palette.py,
// 6×10 cells, 4 keys/s + both sides of every cut → styles/style-3/videos/c-clone/mesh.json); props and type sit on it.
export const C_CLONE_FRAMES = 998;
const W = 1080, H = 1920;
const KEYS = MESH as MeshKey[];
const AUDIO: string | undefined = "style3/audio/c-clone.wav"; // our Kokoro VO on the ref's phrase slots + "Almost Bliss" (CC-BY) + SFX, s3_mix.py

// ── fonts: Instrument Serif (upright + italic), Fraunces (heavy display), Inter (small caps) ──
const FONTS: [string, string, FontFaceDescriptors][] = [
  ["C-Serif", "style3/c-clone/fonts/instrument-serif-latin-400-normal.woff2", { style: "normal" }],
  ["C-Serif", "style3/c-clone/fonts/instrument-serif-latin-400-italic.woff2", { style: "italic" }],
  ["C-Display", "style3/c-clone/fonts/fraunces-latin-wght-normal.woff2", { weight: "100 900" }],
  ["C-Sans", "style3/c-clone/fonts/inter-latin-wght-normal.woff2", { weight: "100 900" }],
];
let fontsP: Promise<void> | null = null;
const useCFonts = () => {
  const [ok, setOk] = React.useState(false);
  const [h] = React.useState(() => delayRender("c-clone fonts"));
  React.useEffect(() => {
    if (!fontsP)
      fontsP = Promise.all(FONTS.map(([f, u, d]) => new FontFace(f, `url(${staticFile(u)})`, d).load().then((ff) => void document.fonts.add(ff)))).then(() => undefined);
    fontsP.then(() => {
      setOk(true);
      continueRender(h);
    });
  }, [h]);
  return ok;
};

// ── the measured background: a portrait field (6 × 10 cells → 30 × 54 fine pixels, smoothed by the browser) ──
const FW = 30, FH = 54;
const Field: React.FC<{ t: number }> = ({ t }) => {
  const ref = React.useRef<HTMLCanvasElement>(null);
  const g = meshFlow(KEYS, t);
  const rows = g.length, cols = g[0].length;
  React.useLayoutEffect(() => {
    const c = ref.current!.getContext("2d")!;
    const img = c.createImageData(FW, FH);
    for (let v = 0; v < FH; v++)
      for (let u = 0; u < FW; u++) {
        const x = ((u + 0.5) / FW) * cols - 0.5, y = ((v + 0.5) / FH) * rows - 0.5;
        const x0 = Math.max(0, Math.min(cols - 1, Math.floor(x))), y0 = Math.max(0, Math.min(rows - 1, Math.floor(y)));
        const x1 = Math.min(cols - 1, x0 + 1), y1 = Math.min(rows - 1, y0 + 1);
        const fx = clamp01(x - x0), fy = clamp01(y - y0);
        for (let ch = 0; ch < 3; ch++) {
          const a = g[y0][x0][ch] * (1 - fx) + g[y0][x1][ch] * fx, b = g[y1][x0][ch] * (1 - fx) + g[y1][x1][ch] * fx;
          img.data[(v * FW + u) * 4 + ch] = a * (1 - fy) + b * fy;
        }
        img.data[(v * FW + u) * 4 + 3] = 255;
      }
    c.putImageData(img, 0, 0);
  });
  return <canvas ref={ref} width={FW} height={FH} style={{ position: "absolute", inset: 0, width: W, height: H, imageRendering: "auto", filter: "blur(18px)", transform: "scale(1.04)" }} />;
};

// ── type: phrases on the ref's word timings (styles/style-3/references/ig-C-pPfbftP_6/words.json) ──
type Font = "sans" | "caps" | "serif" | "italic" | "display";
type Word = { s: string; at: number; f: Font; size: number; x?: number; y: number; w?: number; ls?: number; o?: number };
type Phrase = { t0: number; t1: number; words: Word[]; fx?: "blur" | "glitch" | "rise"; shrink?: [number, number, number]; c?: string };
const INK = "#EDE6D3";
const P: Phrase[] = [
  { t0: 0.0, t1: 1.29, words: [
    { s: "not every", at: 0.02, f: "sans", size: 62, y: 0.47, x: 0.5, w: 300 },
    { s: "thing has", at: 0.3, f: "serif", size: 128, y: 0.515, x: 0.47 },
  ] },
  { t0: 1.29, t1: 2.0, words: [{ s: "tutorial", at: 1.3, f: "display", size: 196, y: 0.52, x: 0.5, w: 800, ls: -6 }] },
  { t0: 2.2, t1: 2.62, words: [{ s: "SOME", at: 2.24, f: "caps", size: 30, y: 0.5, x: 0.5 }, { s: "THINGS", at: 2.36, f: "caps", size: 30, y: 0.5, x: 0.6 }] },
  { t0: 2.62, t1: 3.2, words: [{ s: "YOU", at: 2.66, f: "caps", size: 30, y: 0.5, x: 0.42 }, { s: "HAVE TO", at: 2.84, f: "caps", size: 30, y: 0.5, x: 0.55 }] },
  { t0: 3.22, t1: 4.95, fx: "rise", words: [
    { s: "teach", at: 3.24, f: "sans", size: 176, y: 0.45, x: 0.5, w: 500, o: 0.85 },
    { s: "yourself", at: 3.44, f: "italic", size: 120, y: 0.515, x: 0.56 },
  ] },
  { t0: 12.0, t1: 12.95, words: [{ s: "IT'LL", at: 12.0, f: "caps", size: 30, y: 0.5, x: 0.46 }, { s: "MAKE", at: 12.51, f: "caps", size: 30, y: 0.5, x: 0.57 }, { s: "MORE", at: 12.71, f: "caps", size: 30, y: 0.5, x: 0.68 }] },
  { t0: 12.95, t1: 13.25, words: [{ s: "sense", at: 12.97, f: "italic", size: 150, y: 0.52, x: 0.55 }] },
  { t0: 13.25, t1: 14.25, words: [{ s: "WITH AN", at: 13.27, f: "caps", size: 30, y: 0.49, x: 0.58 }, { s: "EXAMPLE", at: 13.59, f: "caps", size: 30, y: 0.515, x: 0.58 }] },
  { t0: 14.25, t1: 14.75, words: [{ s: "SO", at: 14.29, f: "caps", size: 30, y: 0.5, x: 0.45 }, { s: "HERE'S ONE", at: 14.37, f: "caps", size: 30, y: 0.5, x: 0.57 }] },
  { t0: 14.75, t1: 15.333, shrink: [14.95, 15.2, 0.2], words: [{ s: "1", at: 14.75, f: "italic", size: 640, y: 0.53, x: 0.5 }] },
  { t0: 15.0, t1: 15.333, words: [{ s: "example", at: 15.02, f: "italic", size: 34, y: 0.515, x: 0.43 }] },
  { t0: 15.6, t1: 16.38, fx: "glitch", words: [
    { s: "people who", at: 15.63, f: "sans", size: 64, y: 0.355, x: 0.5, w: 400 },
    { s: "created", at: 15.81, f: "sans", size: 118, y: 0.405, x: 0.5, w: 800 },
  ] },
  { t0: 16.38, t1: 17.54, words: [
    { s: "transformers", at: 16.41, f: "sans", size: 60, y: 0.395, x: 0.52, w: 400 },
    { s: "Movie", at: 17.0, f: "italic", size: 150, y: 0.445, x: 0.5 },
  ] },
  { t0: 17.6, t1: 18.05, words: [{ s: "DID THEY", at: 17.61, f: "caps", size: 30, y: 0.49, x: 0.5 }, { s: "WATCH", at: 17.83, f: "caps", size: 30, y: 0.515, x: 0.5 }] },
  { t0: 18.05, t1: 18.85, words: [{ s: "A TUTORIAL", at: 18.07, f: "caps", size: 32, y: 0.5, x: 0.47 }, { s: "ON", at: 18.55, f: "caps", size: 32, y: 0.5, x: 0.66 }] },
  { t0: 21.4, t1: 22.0, words: [{ s: "example", at: 21.45, f: "italic", size: 40, y: 0.52, x: 0.4 }, { s: "2", at: 21.4, f: "italic", size: 200, y: 0.53, x: 0.58 }] },
  { t0: 22.2, t1: 23.08, words: [{ s: "THE PERSON", at: 22.23, f: "caps", size: 30, y: 0.5, x: 0.52 }, { s: "WHO", at: 22.57, f: "caps", size: 30, y: 0.525, x: 0.44 }, { s: "INVENTED", at: 22.81, f: "caps", size: 30, y: 0.525, x: 0.56 }] },
  { t0: 23.1, t1: 23.72, words: [{ s: "Paper", at: 23.15, f: "italic", size: 176, y: 0.51, x: 0.5 }] },
  { t0: 23.75, t1: 25.2, words: [
    { s: "did he read", at: 23.77, f: "sans", size: 46, y: 0.47, x: 0.44, w: 400 },
    { s: "an", at: 24.13, f: "sans", size: 46, y: 0.47, x: 0.66, w: 400 },
    { s: "assembling", at: 24.27, f: "italic", size: 132, y: 0.505, x: 0.5 },
    { s: "manual", at: 24.55, f: "sans", size: 46, y: 0.54, x: 0.62, w: 400 },
  ] },
  { t0: 25.6, t1: 26.85, words: [{ s: "this can", at: 25.61, f: "sans", size: 36, y: 0.4, x: 0.56, w: 400 }, { s: "Go on", at: 26.15, f: "italic", size: 84, y: 0.425, x: 0.52 }] },
  { t0: 27.1, t1: 27.58, words: [{ s: "a solid", at: 27.11, f: "sans", size: 64, y: 0.46, x: 0.5, w: 500 }] },
  { t0: 27.58, t1: 28.6, words: [
    { s: "a solid", at: 27.58, f: "sans", size: 34, y: 0.465, x: 0.6, w: 500 },
    { s: "foundation", at: 27.59, f: "serif", size: 118, y: 0.5, x: 0.52 },
    { s: "of any", at: 28.03, f: "serif", size: 78, y: 0.535, x: 0.4 },
  ] },
  { t0: 28.6, t1: 29.6, words: [{ s: "visual", at: 28.61, f: "sans", size: 50, y: 0.535, x: 0.56, w: 700 }, { s: "media", at: 28.99, f: "sans", size: 50, y: 0.535, x: 0.75, w: 400 }] },
  { t0: 29.85, t1: 30.62, words: [{ s: "Idea", at: 29.91, f: "italic", size: 190, y: 0.505, x: 0.5 }] },
  { t0: 30.62, t1: 31.6, words: [{ s: "the", at: 30.67, f: "italic", size: 62, y: 0.455, x: 0.36 }, { s: "ability", at: 30.75, f: "italic", size: 150, y: 0.495, x: 0.52 }] },
  { t0: 31.6, t1: 32.9, words: [
    { s: "to turn", at: 31.73, f: "serif", size: 64, y: 0.47, x: 0.42 },
    { s: "this", at: 31.99, f: "serif", size: 46, y: 0.5, x: 0.37 },
    { s: "idea", at: 32.21, f: "italic", size: 140, y: 0.505, x: 0.58 },
  ] },
  { t0: 32.9, t1: 34.3, words: [{ s: "visual", at: 32.95, f: "serif", size: 62, y: 0.475, x: 0.56 }, { s: "representation", at: 33.19, f: "serif", size: 104, y: 0.51, x: 0.5 }] },
  { t0: 34.35, t1: 35.28, words: [{ s: "practicing", at: 34.39, f: "serif", size: 116, y: 0.49, x: 0.52 }] },
  { t0: 35.28, t1: 36.42, words: [{ s: "knowing", at: 35.31, f: "italic", size: 150, y: 0.485, x: 0.5 }, { s: "what you do", at: 35.55, f: "italic", size: 52, y: 0.525, x: 0.52 }] },
  { t0: 36.42, t1: 38.4, words: [{ s: "inspiration", at: 36.77, f: "italic", size: 54, y: 0.475, x: 0.55 }, { s: "reference", at: 36.6, f: "serif", size: 140, y: 0.505, x: 0.5 }] },
  { t0: 38.4, t1: 39.75, words: [{ s: "Vocabulary", at: 38.45, f: "italic", size: 136, y: 0.525, x: 0.5 }] },
  { t0: 39.89, t1: 41.6, c: "#ECEBE6", words: [
    { s: "observe", at: 39.89, f: "serif", size: 150, y: 0.475, x: 0.5 },
    { s: "what you", at: 40.47, f: "serif", size: 150, y: 0.525, x: 0.5 },
    { s: "see", at: 40.85, f: "italic", size: 46, y: 0.56, x: 0.72 },
  ] },
];
// measured against the ref (word width / frame width at the same frame): our first sizes were 1.3–2.4× too small
const SCALE: Record<string, number> = {
  "not every": 1.3, "thing has": 1.3, tutorial: 1.45, teach: 1.7, yourself: 1.6, reference: 2.0, inspiration: 1.6, Vocabulary: 1.9,
  observe: 2.25, "what you": 2.25, see: 2.0, "1": 1.7, example: 1.6,
};
const scaleOf = (w: Word) => SCALE[w.s] ?? (w.f === "caps" ? 2.0 : 1.7);
const fontCss = (f: Font, w?: number): React.CSSProperties =>
  f === "sans" ? { fontFamily: "C-Sans", fontWeight: w ?? 400 } :
  f === "caps" ? { fontFamily: "C-Sans", fontWeight: 500, letterSpacing: "0.08em" } :
  f === "display" ? { fontFamily: "C-Display", fontWeight: w ?? 800 } :
  f === "italic" ? { fontFamily: "C-Serif", fontStyle: "italic" } : { fontFamily: "C-Serif" };
const TypeLayer: React.FC<{ t: number }> = ({ t }) => (
  <>
    {P.filter((p) => t >= p.t0 && t < p.t1).map((p, i) => {
      const out = pr(t, p.t1 - 0.08, p.t1, E.in);
      const sh = p.shrink ? 1 - (1 - p.shrink[2]) * pr(t, p.shrink[0], p.shrink[1], E.inOut) : 1;
      return (
        <AbsoluteFill key={i} style={{ opacity: 1 - out, filter: out > 0 ? `blur(${out * 10}px)` : undefined, transform: `scale(${sh})`, transformOrigin: "50% 52%" }}>
          {[...new Set(p.words.filter((w) => w.f === "caps").map((w) => w.y))].map((y) => (
            <div key={`row${y}`} style={{ position: "absolute", left: 0, right: 0, top: y * H, transform: "translateY(-50%)", display: "flex", justifyContent: "center", gap: "0.45em", fontSize: 30 * 2.0, lineHeight: 1, color: p.c ?? INK, whiteSpace: "nowrap", textShadow: "0 0 18px rgba(255,236,200,0.35)", ...fontCss("caps") }}>
              {p.words.filter((w) => w.f === "caps" && w.y === y).map((w, j) => {
                const k = pr(t, w.at, w.at + 0.16, E.out);
                return <span key={j} style={{ opacity: k, filter: k < 1 ? `blur(${(1 - k) * 8}px)` : undefined }}>{w.s}</span>;
              })}
            </div>
          ))}
          {p.words.filter((w) => w.f !== "caps").map((w, j) => {
            const k = pr(t, w.at, w.at + 0.16, E.out);
            if (k <= 0) return null;
            const glitch = p.fx === "glitch" && t - w.at < 0.25 ? Math.round(Math.sin(t * 90 + j) * 14) : 0;
            const rise = p.fx === "rise" ? (1 - k) * 30 : 0;
            return (
              <div key={j} style={{
                position: "absolute", left: (w.x ?? 0.5) * W, top: w.y * H, transform: `translate(-50%, -50%) translate(${glitch}px, ${rise}px) scale(${1.06 - 0.06 * k})`,
                whiteSpace: "nowrap", fontSize: w.size * scaleOf(w), lineHeight: 1, color: p.c ?? INK, opacity: k * (w.o ?? 1), letterSpacing: w.ls,
                filter: k < 1 ? `blur(${(1 - k) * 10}px)` : undefined,
                textShadow: "0 0 18px rgba(255,236,200,0.35), 0 0 2px rgba(255,240,215,0.5)",
                ...fontCss(w.f, w.w),
              }}>{w.s}</div>
            );
          })}
        </AbsoluteFill>
      );
    })}
  </>
);

// ── grade: per-section tone curves fitted to the ref (styles/tools/s3_grade.py curves on the finished frames) as SVG
//    colour tables in display sRGB; only where the fit predicts a gain (columns/room/card/penthouse/peel keep theirs) ──
type Fit = { t0: number; t1: number; before: number; after: number; curves: number[][] };
const FITS = Object.entries(CURVES as Record<string, Fit>).filter(([, f]) => f.after > f.before + 0.005);
const Grades: React.FC = () => (
  <svg width={0} height={0} style={{ position: "absolute" }}>
    {FITS.map(([n, f]) => (
      <filter key={n} id={`cc-${n}`} colorInterpolationFilters="sRGB">
        <feComponentTransfer>
          <feFuncR type="table" tableValues={f.curves[0].join(" ")} />
          <feFuncG type="table" tableValues={f.curves[1].join(" ")} />
          <feFuncB type="table" tableValues={f.curves[2].join(" ")} />
        </feComponentTransfer>
      </filter>
    ))}
  </svg>
);
const gradeAt = (t: number) => {
  const hit = FITS.find(([, f]) => t >= f.t0 && t < f.t1);
  return hit ? `url(#cc-${hit[0]})` : undefined;
};

/** film grain (re-seeded per frame) + the ref's heavy vignette */
const Finish: React.FC<{ frame: number }> = ({ frame }) => (
  <>
    <AbsoluteFill style={{ background: "radial-gradient(ellipse 75% 62% at 50% 46%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%)" }} />
    <svg width={W} height={H} style={{ position: "absolute", inset: 0, opacity: 0.14, mixBlendMode: "overlay" }}>
      <filter id="cg">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed={frame % 89} />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#cg)" />
    </svg>
  </>
);

export const CClone: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / 24;
  const fonts = useCFonts();
  return (
    <AbsoluteFill style={{ background: "#0B0B0A", overflow: "hidden" }}>
      <Grades />
      <AbsoluteFill style={{ filter: gradeAt(t) }}>
        <Field t={t} />
        <Props t={t} />
      </AbsoluteFill>
      {fonts && <TypeLayer t={t} />}
      <Finish frame={frame} />
      {AUDIO && <Audio src={staticFile(AUDIO)} />}
    </AbsoluteFill>
  );
};
