import type { FontId } from '../../timeline';

/**
 * The stage a video is drawn on: the background world, the type colour and font, the one accent, the glows and
 * grid, the two still corner assets. Style 1 keeps it for the whole video (its law: never change the background).
 * The unique style derives one from its style card.
 */
export interface Stage {
  ink: string;
  /** the one accent colour (slams, pills, the burst) */
  accent: string;
  /** a deep accent for fills that carry light text (CTA bubbles) */
  accentDeep: string;
  /** the paper colour behind everything */
  stage: string;
  font: FontId;
  /** the one serif-italic accent line: font + gradient stops */
  serif: { font: FontId; gradient: [string, string, string] };
  glows: [number, number, number, string, number][];
  grid: { step: number; color: string; dot: number; line?: string } | null;
  burst: string;
  grain: number;
  vignette: number;
  /** two relatable assets, half off the frame edge, still between a rotate-in and a rotate-out */
  corners: { src: string; w: number }[];
  /** a fixed watermark band (empty = none) */
  watermark?: string;
  /** the user's logo, for logo landings and wordmarks */
  logo?: string;
}

/** The owner's gold cursive: the multicolour line is always this gradient (Style 1, owner rule 2026-10-12). */
export const GOLD: [string, string, string] = ['#2B2118', '#B97A2C', '#7E9F45'];

export const DEFAULT_GLOWS: Stage['glows'] = [[140, 280, 820, '#EBCBFF', 0.55], [1000, 1000, 760, '#FFD9AE', 0.5], [180, 1760, 700, '#CDEFDA', 0.5]];

export function lum(hex: string) {
  const n = parseInt(hex.replace('#', '').slice(0, 6), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map(v => v / 255);
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
}
export function mix(a: string, b: string, k: number) {
  const p = (h: string) => { const n = parseInt(h.replace('#', '').slice(0, 6), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const A = p(a), B = p(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i]! - v) * k).toString(16).padStart(2, '0')).join('');
}
/** A pale accent can't carry text on a light stage: use the deep one for words. */
export const accentText = (s: Stage) => (lum(s.accent) > 0.62 ? s.accentDeep : s.accent);

/** A Stage from a stored stage row (craft default, or the user's own look) with the style's fixed parts filled in. */
export function stageFrom(row: Partial<Record<string, unknown>> & { accent?: string }, extra: Partial<Stage> = {}): Stage {
  const accent = String(row.accent ?? '#E8735A');
  const glows = typeof row.glows === 'string' ? JSON.parse(row.glows) as Stage['glows'] : (row.glows as Stage['glows'] | null) ?? DEFAULT_GLOWS;
  return {
    ink: String(row.ink ?? '#111111'), accent, accentDeep: String(row.accentDeep ?? '#0E1A2B'), stage: String(row.stage ?? '#FFFFFF'),
    font: (row.font as FontId) ?? 'inter-std', serif: { font: 'instrument', gradient: GOLD },
    glows, grid: { step: 90, color: String(row.grid ?? mix(accent, '#8E7BB0', 0.7)), dot: 2.3, line: 'rgba(120,100,120,0.06)' },
    burst: String(row.burst ?? mix(accent, '#FFFFFF', 0.72)), grain: 0.05, vignette: 0.09, corners: [], ...extra,
  };
}
