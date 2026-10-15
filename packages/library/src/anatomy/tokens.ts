/**
 * Anatomy: every editable number of the style in one place (see GRAMMAR.md for why each one is what it is).
 * Distilled from the MIT-licensed "anatomy" agent skill (https://github.com/wheresryan22/anatomy): its camera, its
 * four-tone face shading, its tone hierarchy, its line weights and its exploded-view springs, re-expressed for a 9:16
 * voice-led reel. The engine (packages/engine/src/anatomy) and the browser player read ONLY these tokens (they travel
 * inside film.json), so a change here changes every Anatomy film.
 *
 * The look in one line: a brand's product or system drawn as a precise isometric instrument on a bench plate, in paper
 * greys with ONE brand accent, that builds itself on the voice: parts drop in and settle, lids lift to show insides,
 * callouts draw out on the spoken word, particles run through the pipes, and the camera drifts round and pushes in.
 */

/* ───────── camera (degrees / seconds / screen px of the 1080x1920 stage) ───────── */
export const CAMERA = {
  azimuth: 45,          // the skill's default: x runs down-right, y down-left, +x/+y faces toward the viewer
  elevation: 32,        // 30 is the skill's default; a touch higher reads the plate's top in portrait
  orbit: 9,             // the azimuth drifts ±orbit° over the film (a slow turntable, never a spin)
  orbitPeriod: 1.15,    // one sine period = film duration × this
  focusOrbit: 5,        // extra azimuth while pushed in on a part (shows its other side)
  overview: { cx: 540, cy: 860, w: 900, h: 980 }, // where the whole plate is fitted
  focus: { cy: 900, maxH: 760, maxW: 760, maxZoom: 2.2, minZoom: 1.3 }, // a push-in: the part's box fills up to max
  move: 0.95,           // seconds a camera move takes (ease in-out)
  hold: 1.5,            // a camera move never starts sooner than this after the last one
  dolly: 0.07,          // while a key holds, the camera keeps pushing in by up to 7% (never a dead frame)
  dollySeconds: 5,
  gap: 4.5,             // a hold longer than this gets a push-in on the newest part (or back out)
} as const;

/* ───────── line weights (px on the stage at zoom 1; they never scale with the camera) ───────── */
export const STROKE = {
  outline: 2.1,   // a solid's silhouette (the skill's .6px at 600 wide ≈ 2px at 1080 on a phone)
  outlineHi: 2.6, // the subject's silhouette
  crease: 1.1,    // top/side join (faint)
  detail: 1.3,    // seams, vents, ticks, rule lines
  leader: 2.2,    // callout leader
  dot: 3.4,       // a screw at zoom 1 (radius)
} as const;

/* ───────── shading: four side tones by facing + a lighter top (the skill's extrude) ───────── */
export const SHADE = {
  levels: 12,     // continuous facing → 12 bands (a slow orbit never pops a whole face)
} as const;

/* ───────── motion (seconds, world units) ───────── */
export const MOTION = {
  enter: { drop: 320, seconds: 0.9, stagger: 0.05, fade: 0.14, lead: 0.1 }, // parts fall in, base first, lid last
  spring: { zeta: 0.74, omega: 13 },     // one soft overshoot, settled by ~0.6 s (Raptor: stiffness 64, drag 14.2)
  explode: { gap: 64, seconds: 0.9, hold: 3.2, stagger: 0.035 }, // layers lift gap×layer; out in order, back reversed
  leader: { draw: 0.4, text: 0.22, hold: 3.4 },
  pipe: { draw: 0.7 },
  flow: { speed: 300, spacing: 80, size: 7 }, // particles: world units/s, gap, radius (px at zoom 1)
  caption: { in: 0.16, rise: 14 },
} as const;

/* ───────── layout (world units ≈ 1 px of the real thing at the overview's scale) ───────── */
export const LAYOUT = {
  slot: 212,          // centre-to-centre of two parts on the plate (tight: one machine, not parts on a table)
  footprint: 160,     // a part's plan fits in this square
  margin: 62,         // plate edge beyond the outer slots
  plateH: 26,         // plate thickness
  maxParts: 7,
  minParts: 3,
} as const;

/* ───────── type and the frame (stage px) ───────── */
export const TYPE = {
  mono: 'JetBrains Mono',
  sans: 'Inter Tight',
  head: { size: 28, track: 0.16, y: 128 },          // FIG. 01 · TITLE
  label: { size: 28, sub: 23, track: 0.08, gap: 96, colL: 70, colR: 1010, pad: 12 },
  caption: { size: 58, weight: 600, y: 1520, w: 900, line: 1.12 },
  foot: { size: 23, y: 1786 },
  frame: { inset: 40, tick: 26 },
} as const;

/** Where words and labels may sit: the reel's safe area (top and bottom bands are covered by the app's UI). */
export const SAFE = {
  x0: 52, x1: 1028, y0: 220, y1: 1700,
  scene: { x0: 60, x1: 1020, y0: 260, y1: 1460 },
  /** the drawing's window: anything a push-in carries past it fades out over `fade` px (never over the header or caption) */
  window: { x0: 40, x1: 1040, y0: 168, y1: 1488, fade: 64 },
} as const;

/* ───────── colour: a blueprint palette from the brand (light paper or dark blueprint) ───────── */
export type Theme = 'light' | 'dark';
export interface Palette {
  theme: Theme;
  page: string; card: string; paper: string; top: string; shade: [string, string, string, string];
  hi: string; mid: string; lo: string; faint: string; lit: string; litTop: string;
  accent: string; accentTop: string; accentShade: [string, string]; soft: string;
  dark: string; darkTop: string; darkShade: [string, string]; screen: string; screenLine: string;
  halo: string; haloOpacity: number; text: string; muted: string;
}

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export function hexToHsl(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim()); const n = m ? parseInt(m[1]!, 16) : 0x2b67c6;
  const r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (!d) return [0, 0, l * 100];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = mx === r ? ((g - b) / d + (g < b ? 6 : 0)) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s * 100, l * 100];
}
const hsl = (h: number, s: number, l: number) => {
  s = clamp(s / 100); l = clamp(l / 100);
  const k = (n: number) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n: number) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))));
  return `#${[f(0), f(8), f(4)].map(v => v.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
};

/**
 * The palette from one brand colour. The greys carry the brand's hue at a whisper (paper, faces, ink), and the brand
 * itself is the ONE loud ink: the watched part's top, the screens' glow, the particles and the callout dots. An
 * achromatic brand (black, white, grey) keeps the skill's own world: an ice-blue whisper and a black (light) or white
 * (dark) lit part.
 */
export function palette(brand: string, theme: Theme): Palette {
  const [h0, s0, l0] = hexToHsl(brand);
  const grey = s0 < 12 || l0 < 6 || l0 > 96, h = grey ? 208 : h0, s = Math.max(55, s0);
  if (theme === 'light') {
    return {
      theme, page: hsl(h, 22, 94.5), card: hsl(h, 30, 98.4), paper: hsl(h, 30, 98.4), top: '#FFFFFF',
      shade: [hsl(h, 9, 82), hsl(h, 10, 87), hsl(h, 12, 91.5), hsl(h, 14, 95.5)],
      hi: hsl(h, 16, 15), mid: hsl(h, 7, 47), lo: hsl(h, 7, 66), faint: hsl(h, 10, 83), lit: grey ? '#000000' : hsl(h, 60, 20),
      litTop: grey ? hsl(h, 30, 96) : hsl(h, 80, 95),
      accent: grey ? '#15181D' : hsl(h, s, clamp(l0, 36, 52)),
      accentTop: grey ? '#3A3F47' : hsl(h, s, clamp(l0 + 14, 52, 66)),
      accentShade: grey ? ['#0E1013', '#1F2228'] : [hsl(h, s, clamp(l0 - 8, 24, 40)), hsl(h, s, clamp(l0, 34, 48))],
      soft: grey ? hsl(h, 30, 90) : hsl(h, 70, 92), dark: hsl(h, 14, 17), darkTop: hsl(h, 12, 30), darkShade: [hsl(h, 14, 12), hsl(h, 13, 21)],
      screen: grey ? hsl(h, 18, 15) : hsl(h, 40, 13), screenLine: grey ? hsl(h, 40, 82) : hsl(h, 85, 72),
      halo: hsl(h, 12, 44), haloOpacity: 0.32, text: hsl(h, 16, 15), muted: hsl(h, 7, 47),
    };
  }
  return {
    theme, page: hsl(h, 38, 6), card: hsl(h, 34, 8), paper: hsl(h, 30, 10.5), top: hsl(h, 24, 15.5),
    shade: [hsl(h, 30, 7), hsl(h, 28, 8.8), hsl(h, 26, 10.6), hsl(h, 24, 12.8)],
    hi: hsl(h, 26, 88), mid: hsl(h, 14, 54), lo: hsl(h, 16, 35), faint: hsl(h, 20, 21), lit: grey ? '#FFFFFF' : hsl(h, 90, 90),
    litTop: grey ? hsl(h, 20, 26) : hsl(h, 45, 24),
    accent: grey ? '#FFFFFF' : hsl(h, Math.max(60, s0), clamp(l0 + 10, 56, 68)),
    accentTop: grey ? '#E8ECF2' : hsl(h, Math.max(60, s0), clamp(l0 + 22, 66, 78)),
    accentShade: grey ? ['#9AA0A8', '#C2C7CE'] : [hsl(h, s, clamp(l0 - 4, 34, 46)), hsl(h, s, clamp(l0 + 6, 44, 56))],
    soft: hsl(h, 50, 18), dark: hsl(h, 30, 4.5), darkTop: hsl(h, 22, 9), darkShade: [hsl(h, 30, 3), hsl(h, 26, 6)],
    screen: hsl(h, 50, 5), screenLine: grey ? hsl(h, 40, 82) : hsl(h, 85, 70),
    halo: '#000000', haloOpacity: 0.7, text: hsl(h, 26, 88), muted: hsl(h, 14, 58),
  };
}

/** Every token the browser player needs, as one plain object (travels in film.json). */
export const TOKENS = { CAMERA, STROKE, SHADE, MOTION, LAYOUT, TYPE, SAFE };
export type Tokens = typeof TOKENS;
