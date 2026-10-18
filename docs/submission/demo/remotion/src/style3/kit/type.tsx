import React from "react";
import { AbsoluteFill } from "remotion";
import { E, FONT, Key, clamp01, drift, kf, pr, rand } from "../lib";
import { spring } from "../motion";
import { MeshGradient, MeshKey } from "../mesh";

// Style 3 2D kit (the After Effects half): typed type, type cards on mesh gradients, letter bursts, spring pops, wipes,
// cut carriers (radial bloom, star iris, white dips) and the overlays laid on 3D shots. DOM in 1920×1080 frame px,
// pure functions of t. Copy, colours, fonts and timings are props; a film keeps its own copy/timings in its shot files.
// Catalogue + where each part is proven: styles/style-3/library/README.md.

// ── typing ──────────────────────────────────────────────────────────────────────────────────────────────────────
/** caret blink: on/off at hz (ref A ≈ 3.2) */
export const caretOn = (t: number, hz = 3.2) => Math.floor(t * hz) % 2 === 0;
/** the first chars of s, typed linearly between a and b */
export const typed = (s: string, t: number, a: number, b: number) => s.slice(0, Math.round(clamp01((t - a) / (b - a)) * s.length));
/** words typed one after another ([word, a, b] on the VO), joined by spaces; words not started yet are left out */
export const typedWords = (words: [string, number, number][], t: number) => words.map(([w, a, b]) => typed(w, t, a, b)).filter(Boolean).join(" ");
/** how many chars of an n-char word are shown, typed linearly over [a, b] (logo type-on) */
export const typeOn = (t: number, a: number, b: number, n: number) => Math.round(pr(t, a, b, E.lin) * n);
/** type cards never hold still: a linear creep 1 → 1 + amt over [a, b] (ref A: 0.02–0.08 per card) */
export const creep = (t: number, a: number, b: number, amt: number) => 1 + pr(t, a, b, E.lin) * amt;

export const center: React.CSSProperties = { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" };

export const Caret: React.FC<{ t: number; color: string; h: number; hz?: number }> = ({ t, color, h, hz }) => (
  <span style={{ display: "inline-block", width: Math.max(2, h * 0.06), height: h * 0.9, background: color, opacity: caretOn(t, hz) ? 1 : 0, marginLeft: h * 0.06, verticalAlign: "middle", transform: `translateY(-${h * 0.06}px)` }} />
);

/** a typed line with a blinking caret after it; `style` carries the font, colour and glow; children ride after the caret */
export const TypedLine: React.FC<{ t: number; text: React.ReactNode; size: number; caret: string; style?: React.CSSProperties; children?: React.ReactNode }> = ({ t, text, size, caret, style, children }) => (
  <div style={{ fontSize: size, ...style }}>
    {text}
    <Caret t={t} color={caret} h={size} />
    {children}
  </div>
);

// ── per-char typing (ref A: a character never pops; it eases in over 2–3 frames) ─────────────────────────────────
/** text + per-char birth times from parts [chunk, a, b]: each chunk typed linearly over [a, b] (a === b: the whole
 * chunk lands at once, e.g. a word on the VO) */
export const seq = (parts: [string, number, number][]) => {
  let text = "";
  const born: number[] = [];
  for (const [s, a, b] of parts) {
    for (let i = 0; i < s.length; i++) born.push(a + ((i + 0.5) / s.length) * (b - a));
    text += s;
  }
  return { text, born };
};
/** "#rrggbb" mix (k 0 → a, 1 → b) */
export const hexMix = (a: string, b: string, k: number) => {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const A = p(a), B = p(b), kk = clamp01(k);
  return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * kk).toString(16).padStart(2, "0")).join("");
};
/** colour at x ∈ [0, 1] along evenly spaced hex stops */
export const stopsAt = (stops: string[], x: number) => {
  const u = clamp01(x) * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(u));
  return hexMix(stops[i], stops[i + 1], u - i);
};
/** a per-char fill that samples a horizontal gradient by char position (solid colour per char keeps text-shadow
 * extrusions working, which background-clip gradients can't) */
export const hstops = (stops: string[]) => (i: number, n: number) => stopsAt(stops, n <= 1 ? 0 : i / (n - 1));

/** how a fresh char eases in: dur s, blur px → 0, rise/dx em → 0, scale from → 1, colour from `color` → its fill */
export type Fresh = { dur?: number; blur?: number; rise?: number; dx?: number; from?: number; color?: string };
export const FRESH: Required<Omit<Fresh, "color">> = { dur: 0.11, blur: 5, rise: 0.08, dx: 0, from: 0.9 };
const easeOut3 = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);

/** caret: on while typing and `hold` s after the last char, then blinking (off first) with half-period `half` */
export const caretVisible = (t: number, start: number, end: number, hold = 0.25, half = 0.25) =>
  t >= start && (t < end + hold || Math.floor((t - end - hold) / half) % 2 === 1);

/**
 * Typed text, one span per char: each char fades/blurs/rises in over `fresh.dur` from its birth time, optionally from a
 * `fresh.color` (ref A: new chars land white, then take the line's colour). `fill(i, n)` gives the char colour (hex) or
 * a CSS gradient (then drawn with background-clip and no text-shadow). `reserve` lays the whole text out from the
 * start and reveals chars in place (left-anchored reveal: "What if I told You", "and Money"); otherwise the visible
 * part is centred as it grows. The caret sits after the last born char.
 */
export const TypeText: React.FC<{
  t: number; text: string; born: number[]; size: number; style?: React.CSSProperties;
  fill?: string | ((i: number, n: number) => string); shadow?: string; glow?: string; fresh?: Fresh; reserve?: boolean;
  caret?: { color: string; hold?: number; half?: number; w?: number } | false;
  accent?: (i: number) => React.CSSProperties | undefined;
  /** rides right after the last typed char (zero layout width), e.g. the cursor that follows the typing */
  tail?: React.ReactNode;
}> = ({ t, text, born, size, style, fill = "#000000", shadow, glow, fresh, reserve, caret, accent, tail }) => {
  const f = { ...FRESH, ...fresh };
  const n = text.length;
  let last = -1;
  for (let i = 0; i < n; i++) if (born[i] <= t) last = i;
  const caretOn = caret && caretVisible(t, born[0] - 0.04, born[n - 1], caret.hold, caret.half);
  const bar = caret ? (
    <span style={{ display: "inline-block", width: caret.w ?? Math.max(2, size * 0.055), height: size * 0.9, background: caret.color, opacity: caretOn ? 1 : 0, marginLeft: size * 0.05, verticalAlign: "middle", transform: `translateY(-${size * 0.06}px)` }} />
  ) : null;
  const caretEl = (
    <>
      {bar && (reserve ? <span style={{ display: "inline-block", width: 0, position: "relative" }}><span style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)" }}>{bar}</span></span> : bar)}
      {tail && <span style={{ display: "inline-block", width: 0, height: size, position: "relative", verticalAlign: "top" }}>{tail}</span>}
    </>
  );
  const chars: React.ReactNode[] = [];
  for (let i = 0; i < n; i++) {
    const shown = born[i] <= t;
    if (!shown && !reserve) continue;
    const k = shown ? easeOut3((t - born[i]) / f.dur) : 0;
    const c = typeof fill === "string" ? fill : fill(i, n);
    const grad = c.startsWith("linear") || c.startsWith("radial");
    const col = !grad && fresh?.color ? hexMix(fresh.color, c, k) : c;
    const blur = (1 - k) * f.blur;
    chars.push(
      <span key={i} style={{
        display: "inline-block", opacity: shown ? Math.min(1, k * 1.35) : 0,
        transform: k < 1 ? `translate(${(1 - k) * f.dx}em, ${(1 - k) * f.rise}em) scale(${f.from + (1 - f.from) * k})` : undefined,
        filter: blur > 0.05 ? `blur(${blur}px)` : undefined,
        ...(grad ? { backgroundImage: c, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" } : { color: col, textShadow: shadow }),
        ...accent?.(i),
      }}>{text[i]}</span>,
    );
    if (i === last) chars.push(<React.Fragment key="caret">{caretEl}</React.Fragment>);
  }
  if (last < 0 && (bar || tail)) chars.unshift(<React.Fragment key="caret">{caretEl}</React.Fragment>);
  return <div style={{ fontSize: size, whiteSpace: "pre", lineHeight: 1.2, filter: glow, ...style }}>{chars}</div>;
};

/** white type extruded in 3D: stacked 1 px shadows from `light` to `dark` toward the lower right + a soft drop
 * (ref A "Get Smarter Deals": ~6 px of lavender → violet extrusion, purple shadow) */
export const extrude3D = (depth = 6, light = [243, 232, 255], dark = [168, 120, 238], drop = "rgba(70,20,150,0.55)"): React.CSSProperties => ({
  textShadow: [
    ...Array.from({ length: depth }, (_, i) => {
      const k = i / Math.max(1, depth - 1);
      const c = light.map((v, j) => Math.round(v + (dark[j] - v) * k));
      return `${i + 1}px ${i + 1}px 0 rgb(${c.join(",")})`;
    }),
    `${depth}px ${depth + 3}px ${depth * 2.5}px ${drop}`,
  ].join(", "),
});
/** gradient-filled type (background-clip: text) */
export const gradText = (gradient: string): React.CSSProperties => ({ background: gradient, WebkitBackgroundClip: "text", color: "transparent" });
/** wipe a word away to the right with a blur (k 0 → 1) */
export const wipeOut = (k: number, blur = 6): React.CSSProperties => ({ clipPath: `inset(0 0 0 ${k * 100}%)`, filter: `blur(${blur * k}px)` });

/** spring pop-in scale from `from` to 1 (overshoot, capped at `cap`); pops 2.4 Hz ζ 0.45, a heavy word 3 Hz ζ 0.55 */
export const popScale = (t: number, t0: number, o: { from?: number; freq?: number; zeta?: number; cap?: number } = {}) => {
  const k = Math.max(0, Math.min(o.cap ?? Infinity, spring(t, t0, o.freq ?? 2.4, o.zeta ?? 0.45)));
  const from = o.from ?? 0;
  return from ? from + (1 - from) * k : k;
};

/** zoom-through type: settle from a blur, creep, then rush through the lens with a growing blur (ref A "Overwhelming") */
export const zoomThrough = (t: number, o: { t0: number; settle: number; hold: number; t1: number; scale?: [number, number, number]; blur?: [number, number] }) => {
  const [s0, s1, s2] = o.scale ?? [1, 1.12, 2.6];
  const [b0, b1] = o.blur ?? [6, 26];
  return {
    scale: kf(t, [[o.t0, s0], [o.hold, s1, E.lin], [o.t1, s2, E.in]]),
    blur: kf(t, [[o.t0, b0], [o.settle, 0, E.out], [o.hold, 0], [o.t1, b1, E.in]]),
  };
};

// ── cards ───────────────────────────────────────────────────────────────────────────────────────────────────────
/** a solid fill (white dip = the house cut, black open) */
export const Dip: React.FC<{ o: number; color?: string }> = ({ o, color = "#FFF" }) => <AbsoluteFill style={{ background: color, opacity: o }} />;

/**
 * A full-frame type card: background (mesh-gradient keys and/or a colour), `under` layers, the centred content with its
 * own scale/filter/opacity, `over` layers, then an optional white dip (`white` 0..1) into the next cut.
 */
export const TypeCard: React.FC<{
  t: number; mesh?: MeshKey[]; warp?: number; bg?: string; scale?: number; x?: number; y?: number; filter?: string; opacity?: number; white?: number;
  under?: React.ReactNode; over?: React.ReactNode; children?: React.ReactNode;
}> = ({ t, mesh, warp, bg, scale, x = 0, y = 0, filter, opacity, white, under, over, children }) => (
  <AbsoluteFill style={bg ? { background: bg } : undefined}>
    {mesh && <MeshGradient keys={mesh} t={t} warp={warp} />}
    {under}
    <div style={{ ...center, transform: scale === undefined && !x && !y ? undefined : `translate(${x}px, ${y}px) scale(${scale ?? 1})`, filter, opacity }}>{children}</div>
    {over}
    {white !== undefined && white > 0 && <Dip o={white} />}
  </AbsoluteFill>
);

// ── text metrics (fonts are loaded before any layer renders: Film waits on useFonts) ──
let measureCtx: CanvasRenderingContext2D | null = null;
/** advance widths (px) of every prefix of `text` (length n + 1) in a CSS font, e.g. "600 48px S3-Jakarta"; letterSpacing in px */
export const prefixWidths = (text: string, font: string, letterSpacing = 0) => {
  if (!measureCtx) measureCtx = document.createElement("canvas").getContext("2d");
  const c = measureCtx!;
  c.font = font;
  return Array.from({ length: text.length + 1 }, (_, i) => c.measureText(text.slice(0, i)).width + i * letterSpacing);
};

/**
 * Re-centring that flows: a centred line that grows (word appended) slides to its new centre instead of jumping
 * (ref A "Shouldn't Feel": the line lands offset by half the new word and glides back in ~4 frames). Returns the x
 * offset (px, before scale) for the visible text given the word births and the visible widths at each step.
 */
export const glideCentre = (t: number, steps: { at: number; w: number }[], tau = 0.05) => {
  let x = 0;
  for (let i = 1; i < steps.length; i++) {
    if (t < steps[i].at) break;
    x += ((steps[i].w - steps[i - 1].w) / 2) * Math.exp(-(t - steps[i].at) / tau);
  }
  return x;
};

/**
 * A phrase that bursts into its letters from where they stand: each char flies outward from the phrase centre with a
 * fast ease-out (τ), keeps drifting, tumbles and fades over [t0 + fadeA, t0 + fadeB]. Chars sit at measured x positions.
 */
export const Scatter: React.FC<{
  t: number; t0: number; text: string; font: string; size: number; letterSpacing?: number; fill: (i: number, n: number) => string;
  spread?: number; lift?: number; spin?: number; tau?: number; fade?: [number, number]; seed?: number; y?: number;
}> = ({ t, t0, text, font, size, letterSpacing = 0, fill, spread = 260, lift = 90, spin = 160, tau = 0.05, fade = [0.06, 0.2], seed = 3, y = 540 }) => {
  const px = prefixWidths(text, font, letterSpacing);
  const W = px[text.length];
  const dt = Math.max(0, t - t0);
  const burst = 1 - Math.exp(-dt / tau);
  const o = 1 - pr(t, t0 + fade[0], t0 + fade[1], E.inOut);
  if (o <= 0) return null;
  return (
    <AbsoluteFill>
      {text.split("").map((ch, i) => {
        if (ch === " ") return null;
        const cx = (px[i] + px[i + 1]) / 2 - W / 2;
        const r = rand(seed + i * 7), r2 = rand(seed + i * 7 + 1), r3 = rand(seed + i * 7 + 2);
        const dx = (cx / (W / 2)) * spread * (0.4 + r * 0.8) + (r2 - 0.5) * spread * 0.5;
        const dy = (r3 - 0.5) * 2 * lift;
        const fall = dt * dt * 260;
        return (
          <div key={i} style={{ position: "absolute", left: 960 + cx + dx * burst + dx * dt * 0.8, top: y + dy * burst + dy * dt * 0.6 + fall, transform: `translate(-50%,-50%) rotate(${(r - 0.5) * 2 * spin * burst + (r2 - 0.5) * 120 * dt}deg)`, font, fontSize: size, color: fill(i, text.length), opacity: o * (0.85 + 0.15 * r3), whiteSpace: "pre" }}>{ch}</div>
        );
      })}
    </AbsoluteFill>
  );
};

/** a word bursting into tumbling letters: k 0 → 1 = flight (fling up/out, then fall), fade 0 → 1 = gone. Seeded. */
export const LetterBurst: React.FC<{
  text: string; k: number; fade: number; x?: number; y?: number; spacing?: number; size?: [number, number];
  spread?: [number, number]; fall?: number; spin?: number; seed?: number; style?: React.CSSProperties;
}> = ({ text, k, fade, x = 960, y = 540, spacing = 34, size = [30, 14], spread = [80, 380], fall = 120, spin = 220, seed = 0, style }) => {
  const chars = text.split("");
  return (
    <>
      {chars.map((ch, i) => {
        const s = seed + i * 5;
        const a = (rand(s) - 0.5) * Math.PI * 1.6 - Math.PI / 2;
        const r = spread[0] + rand(s + 1) * spread[1];
        const x0 = (i - chars.length / 2) * spacing;
        return (
          <div key={i} style={{ position: "absolute", left: x + x0 + Math.cos(a) * r * k * 1.6, top: y + Math.sin(a) * r * k * 0.5 + k * k * fall, fontSize: size[0] + rand(s + 2) * size[1], transform: `translate(-50%,-50%) rotate(${(rand(s + 3) - 0.5) * spin * k}deg)`, opacity: 1 - fade, ...style }}>
            {ch}
          </div>
        );
      })}
    </>
  );
};

/** a two-tone folded-paper facet (SVG, viewBox 0..100): the shards that flank a hero word */
export const Facet: React.FC<{ size: number; paths: [string, string][]; style?: React.CSSProperties }> = ({ size, paths, style }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={style}>
    {paths.map(([d, fill], i) => <path key={i} d={d} fill={fill} />)}
  </svg>
);

/** the paper-plane cursor as a 2D icon (tip up-right): the "user" character inside type shots */
export const PlaneIcon: React.FC<{ color: string; size: number; style?: React.CSSProperties }> = ({ color, size, style }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" style={style}>
    <path d="M38 4 L2 18 L16 22 Z" fill={color} />
    <path d="M38 4 L16 22 L20 37 Z" fill={color} opacity={0.75} />
  </svg>
);

/** a gradient UI pill with a label (search query, CTA): the object carried across a match cut */
export const Pill: React.FC<{ text: string; size?: number; gradient?: string; color?: string; shadow?: string; font?: string; style?: React.CSSProperties }> = ({
  text, size = 40, gradient = "linear-gradient(90deg,#8F6BFF,#FF6FB8)", color = "#FFFFFF", shadow = "0 18px 50px rgba(120,60,200,0.45)", font = FONT.ui, style }) => (
  <div style={{ padding: `${Math.round(size * 0.45)}px ${Math.round(size * 1.1)}px`, borderRadius: Math.round(size * 0.7), background: gradient, fontFamily: font, fontWeight: 500, fontSize: size, color, boxShadow: shadow, ...style }}>{text}</div>
);

/** a stack of cash notes ("3D icon" look) centred at x, y; scale it with popScale, rot in degrees */
export const CashStack: React.FC<{ x: number; y: number; scale: number; rot: number; n?: number; note?: [string, string]; ink?: string; symbol?: string }> = ({
  x, y, scale, rot, n = 3, note = ["#7BE08A", "#2E9E55"], ink = "#1F7A3E", symbol = "$" }) => (
  <div style={{ position: "absolute", left: x, top: y, transform: `translate(-50%,-50%) scale(${scale}) rotate(${rot}deg)` }}>
    {Array.from({ length: n }, (_, i) => (
      <div key={i} style={{ position: "absolute", left: -46 + i * 3, top: -26 - i * 7, width: 92, height: 52, borderRadius: 8, background: `linear-gradient(135deg,${note[0]},${note[1]})`, boxShadow: "0 6px 14px rgba(20,90,40,0.35), inset 0 0 0 4px rgba(255,255,255,0.35)" }}>
        <div style={{ position: "absolute", left: 32, top: 12, width: 28, height: 28, borderRadius: 14, background: "rgba(255,255,255,0.55)", fontFamily: FONT.sans, fontWeight: 800, fontSize: 20, color: ink, textAlign: "center", lineHeight: "28px" }}>{symbol}</div>
      </div>
    ))}
  </div>
);

// ── logos ───────────────────────────────────────────────────────────────────────────────────────────────────────
export type Mark = { draw: (c: CanvasRenderingContext2D, x: number, y: number, s: number, chars?: number, ks?: number[]) => void };
/** a wordmark = icon (canvas draw fn) + a word that can type on (chars, or per-char progress ks 0..1: each letter slides
 * in from the right by `track` em while it fades in — ref A's logo types with the tracking closing up); offsets in s units */
export const wordmark = (o: { word: string; color: string; size?: number; weight?: number; font?: string; text?: [number, number];
  icon?: (c: CanvasRenderingContext2D, x: number, y: number, s: number) => void; iconAt?: [number, number]; track?: number }): Mark => ({
  draw: (c, x, y, s, chars = o.word.length, ks) => {
    const [ix, iy] = o.iconAt ?? [30, 4], [tx, ty] = o.text ?? [70, 8];
    if (o.icon) o.icon(c, x + ix * s, y + iy * s, s);
    const px = (o.size ?? 44) * s;
    c.font = `${o.weight ?? 800} ${px}px ${o.font ?? FONT.sans}`;
    c.fillStyle = o.color;
    c.textBaseline = "middle";
    if (!ks) {
      c.fillText(o.word.slice(0, chars), x + tx * s, y + ty * s);
      return;
    }
    const a0 = c.globalAlpha;
    for (let i = 0; i < o.word.length; i++) {
      const k = clamp01(ks[i] ?? 1);
      if (k <= 0) continue;
      const ease = 1 - Math.pow(1 - k, 3);
      c.globalAlpha = a0 * Math.min(1, k * 1.5);
      c.fillText(o.word[i], x + tx * s + c.measureText(o.word.slice(0, i)).width + (1 - ease) * (o.track ?? 0.35) * px, y + ty * s);
    }
    c.globalAlpha = a0;
  },
});
/** a crisp 2× canvas in the DOM (logo marks, wordmarks): draw(ctx) in w × h units, redrawn when deps change */
export const CanvasMark: React.FC<{ w: number; h: number; scale: number; draw: (c: CanvasRenderingContext2D) => void; deps: unknown[]; style?: React.CSSProperties }> = ({ w, h, scale, draw, deps, style }) => {
  const ref = React.useRef<HTMLCanvasElement>(null);
  React.useLayoutEffect(() => {
    const c = ref.current!.getContext("2d")!;
    c.setTransform(2, 0, 0, 2, 0, 0);
    c.clearRect(0, 0, w, h);
    draw(c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return <canvas ref={ref} width={w * 2} height={h * 2} style={{ width: w * scale, height: h * scale, ...style }} />;
};
/** a Mark as a DOM logo (360 × 90 units, mark drawn at 6, 40), chars typed on (or per-char progress ks) */
export const LogoMark: React.FC<{ mark: Mark; scale: number; chars?: number; ks?: number[]; style?: React.CSSProperties }> = ({ mark, scale, chars, ks, style }) => (
  <CanvasMark w={360} h={90} scale={scale} style={style} deps={[mark, chars, ks?.join(",")]} draw={(c) => mark.draw(c, 6, 40, 1, chars, ks)} />
);

// ── cut carriers ────────────────────────────────────────────────────────────────────────────────────────────────
type RGBA = [number, number, number, number];
/** radial colour bloom from a point ("radial bloom carry"): grow 0 → 1 widens it, fade 0 → 1 clears it to the card */
export const RadialBloom: React.FC<{ grow: number; fade: number; inner?: RGBA; mid?: RGBA; at?: [number, number] }> = ({ grow, fade, inner = [214, 70, 230, 0.95], mid = [150, 80, 255, 0.75], at = [50, 50] }) => (
  <AbsoluteFill style={{ background: `radial-gradient(circle at ${at[0]}% ${at[1]}%, rgba(${inner[0]},${inner[1]},${inner[2]},${inner[3] * (1 - fade)}) 0%, rgba(${mid[0]},${mid[1]},${mid[2]},${mid[3] * (1 - fade)}) ${18 + grow * 22}%, rgba(255,255,255,0) ${40 + grow * 40}%)` }} />
);

/** star iris over [t0, t1]: a 4-point sparkle grows exp(4.6 k) through the lens with sparkle dust (zoom-through into a screen) */
export const StarIris: React.FC<{ t: number; t0: number; t1: number; color?: string; dust?: number; x?: number; y?: number }> = ({ t, t0, t1, color = "#FFFFFF", dust = 24, x = 960, y = 540 }) => {
  const k = pr(t, t0, t1, E.in);
  if (k <= 0 || k >= 1) return null;
  const s = 0.3 * Math.exp(k * 4.6);
  return (
    <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
      <svg width={1920} height={1080} viewBox="-50 -50 100 100" style={{ transform: `scale(${s}) rotate(${10 + k * 25}deg)`, filter: `blur(${k * 2}px)` }}>
        <path d="M0 -40 C 4 -8, 8 -4, 40 0 C 8 4, 4 8, 0 40 C -4 8, -8 4, -40 0 C -8 -4, -4 -8, 0 -40 Z" fill={color} />
      </svg>
      {Array.from({ length: dust }, (_, i) => (
        <div key={i} style={{ position: "absolute", left: x + Math.cos(rand(i) * 6.28) * (200 + rand(i + 2) * 600) * k, top: y + Math.sin(rand(i) * 6.28) * (120 + rand(i + 3) * 380) * k, width: 5, height: 5, borderRadius: 3, background: "#fff", boxShadow: "0 0 8px #fff", opacity: 1 - k }} />
      ))}
    </AbsoluteFill>
  );
};

// ── overlays on 3D shots ────────────────────────────────────────────────────────────────────────────────────────
type Corner = "tr" | "tl" | "br" | "bl";
const CORNER: Record<Corner, string> = { tr: "100% 0%", tl: "0% 0%", br: "100% 100%", bl: "0% 100%" };
/** halftone dot cluster fading out of a corner (multiply); reach = [mid %, end %] of the radial mask */
export const Halftone: React.FC<{ corner: Corner; color: string; o: number; dot?: number; reach?: [number, number] }> = ({ corner, color, o, dot = 11, reach }) => {
  const [m, e] = reach ?? (corner === "bl" ? [12, 26] : [14, 30]);
  return (
    <AbsoluteFill
      style={{
        backgroundImage: `radial-gradient(${color} 32%, transparent 36%)`,
        backgroundSize: `${dot}px ${dot}px`,
        opacity: o,
        WebkitMaskImage: `radial-gradient(circle at ${CORNER[corner]}, black 0%, rgba(0,0,0,0.6) ${m}%, transparent ${e}%)`,
        mixBlendMode: "multiply",
      }}
    />
  );
};

/** diagonal light leaks (screen blend), drifting; ref A 0.28–0.3 over the room */
export const Leaks: React.FC<{ t: number; o: number; n?: number; angle?: number; tint?: string }> = ({ t, o, n = 4, angle = -38, tint = "255,236,224" }) => (
  <AbsoluteFill style={{ mixBlendMode: "screen", opacity: o }}>
    {Array.from({ length: n }, (_, i) => (
      <div key={i} style={{ position: "absolute", left: -500 + i * 170 + drift(t, i, 30), top: -300, width: 90 + i * 30, height: 1700, transform: `rotate(${angle}deg)`, background: `linear-gradient(90deg, rgba(255,240,230,0) 0%, rgba(${tint},0.55) 50%, rgba(255,240,230,0) 100%)`, filter: "blur(18px)" }} />
    ))}
  </AbsoluteFill>
);

/** a sparkle burst spreading from (x, y) over [t0, t1] (on a bloom into a screen) */
export const Sparkles: React.FC<{ t: number; t0: number; t1: number; n?: number; x?: number; y?: number; spread?: [number, number]; color?: string }> = ({
  t, t0, t1, n = 60, x = 975, y = 520, spread = [80, 700], color = "#FFFFFF" }) => {
  const k = pr(t, t0, t1, E.lin);
  if (k <= 0 || k >= 1) return null;
  return (
    <AbsoluteFill>
      {Array.from({ length: n }, (_, i) => {
        const a = rand(i * 3) * Math.PI * 2;
        const r = (spread[0] + rand(i * 3 + 1) * spread[1]) * (0.3 + k);
        return <div key={i} style={{ position: "absolute", left: x + Math.cos(a) * r * 1.3, top: y + Math.sin(a) * r * 0.8, width: 3 + rand(i) * 4, height: 3 + rand(i) * 4, borderRadius: 9, background: color, opacity: Math.sin(k * Math.PI) * (0.5 + rand(i + 7) * 0.5), boxShadow: "0 0 6px #fff" }} />;
      })}
    </AbsoluteFill>
  );
};

/** thin frame lines inset from the edges (ref A card wave) */
export const InsetFrame: React.FC<{ o: number; xs?: number[]; ys?: number[]; color?: string }> = ({ o, xs = [110, 1806], ys = [104, 958], color = "rgba(255,255,255,0.85)" }) => (
  <AbsoluteFill style={{ opacity: o }}>
    {xs.map((x) => <div key={x} style={{ position: "absolute", left: x, top: 0, width: 2, height: 1080, background: color }} />)}
    {ys.map((y) => <div key={y} style={{ position: "absolute", top: y, left: 0, height: 2, width: 1920, background: color }} />)}
  </AbsoluteFill>
);

/** a soft white light band across the frame (screen blend): centre line through (x, y) at `angle` deg, `w` px wide */
export const LightBand: React.FC<{ x: number; y: number; angle: number; w: number; o: number; len?: number; color?: string; blur?: number }> = ({ x, y, angle, w, o, len = 2600, color = "255,255,255", blur = 14 }) =>
  o > 0 ? (
    <AbsoluteFill style={{ mixBlendMode: "screen", opacity: o, pointerEvents: "none" }}>
      <div style={{ position: "absolute", left: x - w / 2, top: y - len / 2, width: w, height: len, transform: `rotate(${angle}deg)`, background: `linear-gradient(90deg, rgba(${color},0) 0%, rgba(${color},0.55) 30%, rgba(${color},0.95) 50%, rgba(${color},0.55) 70%, rgba(${color},0) 100%)`, filter: `blur(${blur}px)` }} />
    </AbsoluteFill>
  ) : null;

/** a banded bundle of notes ("3D icon" cash): w × h px, a paper band across it, a $ disc; rotate/scale from outside */
export const CashBundle: React.FC<{ w: number; h: number; band?: string; note?: [string, string]; ink?: string; layers?: number; style?: React.CSSProperties }> = ({
  w, h, band = "#F3E7A6", note = ["#4CC46A", "#1F8A3A"], ink = "#1C7034", layers = 3, style }) => (
  <div style={{ position: "absolute", width: w, height: h, ...style }}>
    {Array.from({ length: layers }, (_, i) => (
      <div key={i} style={{ position: "absolute", left: 0, top: (layers - 1 - i) * h * 0.07, width: w, height: h * 0.86, borderRadius: h * 0.1, background: i === layers - 1 ? `linear-gradient(160deg, ${note[0]}, ${note[1]})` : note[1], boxShadow: i === 0 ? "0 8px 16px rgba(20,80,40,0.3)" : undefined }}>
        {i === layers - 1 && (
          <>
            <div style={{ position: "absolute", inset: h * 0.07, borderRadius: h * 0.07, border: `${Math.max(1.5, h * 0.03)}px solid rgba(255,255,255,0.35)` }} />
            <div style={{ position: "absolute", left: w * 0.45, top: 0, width: w * 0.14, height: "100%", background: band, boxShadow: "inset 0 0 0 1px rgba(160,140,60,0.25)" }} />
            <div style={{ position: "absolute", left: w * 0.12, top: h * 0.43 - h * 0.2, width: h * 0.4, height: h * 0.4, borderRadius: "50%", background: "rgba(255,255,255,0.28)", color: "#FFFFFF", fontFamily: FONT.sans, fontWeight: 800, fontSize: h * 0.32, lineHeight: `${h * 0.4}px`, textAlign: "center", textShadow: `0 1px 0 ${ink}` }}>$</div>
            <div style={{ position: "absolute", right: w * 0.12, top: h * 0.43 - h * 0.17, width: h * 0.34, height: h * 0.34, borderRadius: "50%", background: "rgba(0,60,20,0.18)" }} />
          </>
        )}
      </div>
    ))}
  </div>
);

/** letterbox bars of height h px (of 1080) top and bottom; key h with kf(t, LETTERBOX_A) or your own keys */
export const Letterbox: React.FC<{ h: number; color?: string }> = ({ h, color = "#000" }) =>
  h > 0 ? (
    <>
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: h, background: color }} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: h, background: color }} />
    </>
  ) : null;

/** ref A's opening letterbox, measured (px of 1080): opens from closed, holds ~140, opens again on the 1.33 s jump cut, gone by 2.6 s */
export const LETTERBOX_A: Key[] = [[0.083, 364], [0.167, 256, E.lin], [0.25, 220, E.lin], [0.333, 198, E.lin], [0.5, 170, E.lin], [0.75, 148, E.lin],
  [1.0, 141, E.lin], [1.25, 135, E.lin], [1.333, 121, E.lin], [1.417, 80, E.lin], [1.5, 48, E.lin], [1.625, 34, E.lin], [2.0, 32, E.lin], [2.33, 26, E.lin], [2.6, 0, E.lin]];
