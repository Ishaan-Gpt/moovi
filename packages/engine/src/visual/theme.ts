import { color } from '@moovi/brand';

/**
 * The film's palette, only ever the brand's tokens (icy white and ice blue are the majors) and mixes of them. A dark
 * film is the ink with the same ice on it. The page gets it as plain hex strings.
 */
export interface Palette {
  bg: string; bg2: string; ink: string; muted: string; accent: string; accent2: string; soft: string; card: string; hair: string;
  onAccent: string; good: string; warn: string; dark: boolean;
}

const mix = (a: string, b: string, k: number) => {
  const p = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const A = p(a), B = p(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i]! - v) * k).toString(16).padStart(2, '0')).join('');
};

export function paletteOf(theme: 'light' | 'dark'): Palette {
  if (theme === 'dark') return { bg: color.ink, bg2: mix(color.ink, color.deepIce, 0.28), ink: color.iceWhite, muted: mix(color.ice, color.ink, 0.35), accent: color.frostMid, accent2: color.frostHi, soft: color.ice, card: mix(color.ink, color.iceWhite, 0.09), hair: mix(color.ink, color.iceWhite, 0.2), onAccent: color.ink, good: color.auroraMint, warn: color.signal, dark: true };
  return { bg: color.iceWhite, bg2: color.iceSoft, ink: color.ink, muted: color.inkMuted, accent: color.deepIce, accent2: color.glacier, soft: color.ice, card: color.surface, hair: color.hairline, onAccent: color.surface, good: color.pass, warn: color.signal, dark: false };
}
