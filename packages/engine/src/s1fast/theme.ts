/**
 * A brand's Style 1 theme from its own colours: the stage (a light tint of the brand, never CaptionsEasy cream), the
 * ink and both accents contrast-checked against that stage (WCAG ratios), the three backdrop glows, the dot grid and
 * the burst, all from the brand's palette. Deterministic: the same colours always give the same theme.
 */

type RGB = [number, number, number];
const hex = (h: string): RGB => { const m = /^#?([0-9a-f]{6})$/i.exec(h.trim()); if (!m) return [26, 26, 26]; const n = parseInt(m[1]!, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const toHex = (c: RGB) => '#' + c.map(v => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('').toUpperCase();
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const WHITE: RGB = [255, 255, 255], BLACK: RGB = [0, 0, 0];
const lum = (c: RGB) => { const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
export const contrast = (a: string, b: string) => { const x = lum(hex(a)), y = lum(hex(b)); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const sat = (c: RGB) => { const mx = Math.max(...c), mn = Math.min(...c); return mx === 0 ? 0 : (mx - mn) / mx; };

/** Darken `c` toward black until it reaches `ratio` against `bg` (keeps the hue). */
function darkenTo(c: RGB, bg: string, ratio: number): string {
  for (let t = 0; t <= 1; t += 0.02) { const h = toHex(mix(c, BLACK, t)); if (contrast(h, bg) >= ratio) return h; }
  return '#111111';
}

export const FONTS = ['inter-std', 'inter', 'geist', 'jakarta', 'bricolage', 'archivo', 'roboto', 'anton'] as const;

export interface BrandTheme { name: string; stage: string; ink: string; accent: string; accent_deep: string; font: string; glows: [number, number, number, string, number][]; grid: string; burst: string; watermark?: string; cta?: Record<string, string> }

export function buildTheme(o: { name: string; primary: string; secondary?: string; tertiary?: string; font?: string; site?: string }): BrandTheme {
  const p = hex(o.primary);
  // a near-grey "primary" (black/white brands) still needs colour somewhere: fall back to the secondary for accents
  const s = hex(o.secondary ?? o.primary), t = hex(o.tertiary ?? o.secondary ?? o.primary);
  const lead = sat(p) < 0.15 && sat(s) >= 0.15 ? s : p;
  const stage = toHex(mix(lead, WHITE, 0.955));                         // brand-tinted paper, Style 1 stays a light stage
  const inkBase = mix(lead, BLACK, 0.86);                                // near-black with the brand's hue
  const ink = contrast(toHex(inkBase), stage) >= 12 ? toHex(inkBase) : '#141414';
  const accent = contrast(toHex(lead), stage) >= 3 ? toHex(lead) : darkenTo(lead, stage, 3); // key words: at least 3:1 (large text)
  const accent_deep = darkenTo(lead, stage, 7);                           // chips/pills with stage-coloured text on them
  const glow = (c: RGB) => toHex(mix(sat(c) < 0.15 ? lead : c, WHITE, 0.72)); // a grey/black brand colour glows in the lead hue instead
  return {
    name: o.name, stage, ink, accent, accent_deep,
    font: FONTS.includes(o.font as never) ? o.font! : 'inter-std',
    glows: [[140, 280, 820, glow(lead), 0.55], [1000, 1000, 760, glow(s), 0.5], [180, 1760, 700, glow(t), 0.5]],
    grid: toHex(mix(mix(lead, [128, 128, 128], 0.5), WHITE, 0.15)),
    // the burst is the reel's loudest shape: a tint of the brand's own hue (a grey or dark secondary went drab grey)
    burst: toHex(mix(sat(s) >= 0.45 && lum(s) > 0.12 ? s : lead, WHITE, 0.6)),
    ...(o.site ? { watermark: o.site, cta: { keyword: '', magnet: '', follow: o.site } } : {}),
  };
}
