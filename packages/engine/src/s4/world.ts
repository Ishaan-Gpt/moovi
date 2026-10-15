/**
 * A Style 4 world: one hue in four stops (centre / mid / top / edge) plus paper and an ink of the same hue (law 1).
 * The stops are placed by lightness (about L 92 / 82 / 58 / 38, ink L 13), from the brand colour's hue, and the
 * ink is checked to hold at least 7:1 on the mid stop. Deterministic.
 */
import { contrast } from '../s1fast/theme';

export interface World { light?: boolean; name: string; hue: number; center: string; mid: string; top: string; edge: string; ink: string; paper: string; /** the picture tone map, dark to light (default: ink, edge, top, mid, paper) */ tones?: string[] }

/** The reference world (periwinkle). Clone tests only; never dealt for a shipped film. */
export const PERIWINKLE: World = { name: 'periwinkle', hue: 232, center: '#E3E7F8', mid: '#C6CDFA', top: '#7D89E2', edge: '#4652B5', ink: '#1F224A', paper: '#F4F5FF' };

const hsl = (h: number, s: number, l: number) => {
  s /= 100; l /= 100;
  const k = (n: number) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return '#' + [f(0), f(8), f(4)].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
};

export function hueOf(hex: string): { h: number; s: number; l: number } {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim()); if (!m) return { h: 232, s: 0, l: 0.6 };
  const n = parseInt(m[1]!, 16), r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s: mx ? d / mx : 0, l: (mx + mn) / 2 };
}

/** The world for a brand colour (a near-grey brand falls back to its second colour, then to slate blue). */
export function worldFrom(name: string, ...colours: string[]): World {
  const pick = colours.map(hueOf).find(c => c.s >= 0.15) ?? { h: 215, s: 0.3, l: 0.6 };
  const h = Math.round(pick.h), L = pick.l * 100;
  // a light brand colour (pastel, L >= 78) keeps its own lightness: the floor IS the brand colour and the corners are
  // only a little darker, so a lavender brand never turns into a deep-violet world
  const w: World = L >= 78
    ? { light: true, name, hue: h, center: hsl(h, 70, Math.min(97, L + 5)), mid: hsl(h, 70, L), top: hsl(h, 55, L - 10), edge: hsl(h, 45, L - 20), ink: hsl(h, 42, 16), paper: hsl(h, 70, 98) }
    : { name, hue: h, center: hsl(h, 62, 93), mid: hsl(h, 78, 84), top: hsl(h, 60, 63), edge: hsl(h, 46, 42), ink: hsl(h, 42, 16), paper: hsl(h, 70, 97) };
  for (let l = 16; contrast(w.ink, w.mid) < 7 && l > 6; l--) w.ink = hsl(h, 42, l);
  // the pictures are PRINTS lit inside the world, not painted in it: the refs' photos are near-neutral greys with the
  // hue only as a cast (strongest in the shadows), so they pop against the saturated field instead of melting into it
  w.tones = [w.ink, hsl(h, 24, 34), hsl(h, 16, 58), hsl(h, 11, 81), hsl(h, 22, 96)];
  return w;
}

/** Luminance → world: the tone-map stops for the picture filter (dark to light). */
export const toneStops = (w: World) => w.tones ?? [w.ink, w.edge, w.top, w.mid, w.paper];
