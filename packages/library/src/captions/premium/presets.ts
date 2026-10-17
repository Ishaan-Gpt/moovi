/**
 * Premium caption presets (caption mastery, 2026-10-18): one preset per reference Ishaan sends, approved by him.
 * Each preset is two things that describe the same caption: a captionseasy look (a base look number plus `--set`
 * overrides, valid keys only) and the Moovi player spec that `draw.ts` paints on a canvas, the same code in the live
 * preview and in the MP4 path (Chromium). None of these is a product default; wiring them into types comes later.
 */

import { litKey } from './theme';

export interface TierSpec {
  /** CSS font family, loaded from Google Fonts (`fonts` below) */
  font: string;
  weight: number;
  /** 'upper' (default) or 'none': the words as spoken (sentence case), punctuation still stripped */
  casing?: 'upper' | 'none';
  /** slant: horizontal shear (0.2 ≈ 11°), the italic of the red key line */
  skew?: number;
  /** corner softening: a round-joined stroke in the fill colour, as a share of the font size */
  round?: number;
  /** horizontal scale of the letters (a face set wider than it was cut, e.g. 1.08) */
  wide?: number;
  /** extra space between words, as a share of the font size */
  wordGap?: number;
  /** font-stretch keyword (a width axis), e.g. 'expanded' */
  stretch?: string;
  /** cap size as a share of the frame's short edge */
  size: number;
  /** tracking in em */
  tracking: number;
  /** fill: one colour, or a vertical gradient top → bottom */
  fill: string | string[];
  /** thin edge drawn under the fill (px at a 1080 short edge), or none */
  edge?: { color: string; width: number };
  /** soft drop shadow (share of short edge) */
  shadow?: { color: string; blur: number; dy: number };
  /** bloom: the word blurred at each radius (share of short edge) and screened on, wide+faint to tight+hot */
  glow?: { color: string; layers: { r: number; a: number; c?: string }[] };
  /** inner light: the letters' own shape blurred white over the fill, 0..1 */
  sheen?: number;
}

export interface PremiumPreset {
  id: string;
  name: string;
  /** the reference it was built from (data/refs/captions/<ref>, never committed) */
  ref: string;
  /** Google Fonts css2 families to load */
  fonts: string[];
  /** tier 1: the lead words; tier 2: the key word(s), the one the voice hits */
  tiers: [TierSpec, TierSpec];
  /** centre of the two-line block as a share of frame height (over the chest, off the face) */
  y: number;
  /** gap between the tiers as a share of short edge */
  gap: number;
  /** max words on a card, key word(s) included */
  maxWords: number;
  /**
   * The entry, decoded from the reference reel (30 fps): each word pops in at `scaleFrom`, soft (`blur`, share of the
   * short edge, sharp after `blurS` s), fading in over `fadeS`, and snaps to size on 1 - exp(-decay s) cos(freq s);
   * its glow flashes to 1 + `flash` and eases over `flashS`; the card then drifts smaller by `drift` per second.
   */
  enter: { scaleFrom: number; decay: number; freq: number; blur: number; blurS: number; fadeS: number; flash: number; flashS: number; drift: number };
  /** captionseasy equivalent: `captionseasy build --look <base> --set k=v …` */
  captionseasy: { look: number; set: Record<string, string | number | boolean> };
}

/** The entry decoded from the reference reel (c02, 30 fps): ~5 frames from 1.22x and soft to sharp, a small bounce. */
/** The entry decoded from the reference reel (c02, 30 fps): ~5 frames from 1.22x and soft to sharp, a small bounce. */
const REEL_ENTER: PremiumPreset['enter'] = { scaleFrom: 1.22, decay: 11, freq: 15, blur: 0.01, blurS: 0.16, fadeS: 0.06, flash: 0.8, flashS: 0.3, drift: -0.025 };

export type Caption1Variant = '1.1' | '1.2';

/** The accents of the two references, for previews only: the product takes the accent from the video (theme.ts). */
export const REF_ACCENTS: Record<Caption1Variant, string> = { '1.1': '#52F42E', '1.2': '#FF3434' };

/**
 * Premium Caption 1 (refs c01 and the reel DbS2vcfyQxx, approved by Ishaan 2026-10-18): a white lead tier and the
 * spoken key word lit underneath, in any accent (the video's own, from `accentFromPixels`).
 *   1.1  both tiers caps, Russo One 600, a little extra word space
 *   1.2  sentence-case white lead (Poppins 800) over a slanted key line
 * Ishaan's pick: Russo One at 600. It has one cut (400); a 4.5 % same-colour stroke thickens it to 600 identically on
 * every layer (the browser's synthetic bold skips offscreen layers, which ghosted the glow).
 */
export function premiumCaption1(variant: Caption1Variant, accent = REF_ACCENTS[variant]): PremiumPreset {
  const lit = litKey(accent);
  const key: TierSpec = {
    font: 'Russo One', weight: 400, round: 0.045, size: 0.1, tracking: -0.005, fill: lit.fill,
    // a dark bed under the word, then the bloom: the word reads highlighted, not just glowing
    shadow: { color: 'rgba(0,0,0,0.75)', blur: 0.04, dy: 0.01 },
    glow: lit.glow,
    sheen: 0.25,
  };
  const lead: TierSpec = variant === '1.1'
    ? { font: 'Russo One', weight: 400, round: 0.045, size: 0.07, tracking: -0.01, wordGap: 0.08, fill: ['#FFFFFF', '#FFFFFF', '#D9DDE3'], shadow: { color: 'rgba(0,0,0,0.7)', blur: 0.03, dy: 0.008 } }
    : { font: 'Poppins', weight: 800, casing: 'none', size: 0.068, tracking: -0.01, fill: ['#FFFFFF', '#FFFFFF', '#E2E2E6'], shadow: { color: 'rgba(0,0,0,0.7)', blur: 0.03, dy: 0.008 } };
  return {
    id: `premium-1-${variant.replace('.', '-')}`,
    name: `Premium Caption ${variant}`,
    ref: 'c01.png; reel DbS2vcfyQxx (0 s green, 4.9 s red)',
    fonts: variant === '1.1' ? ['Russo+One'] : ['Russo+One', 'Poppins:wght@800'],
    tiers: [lead, variant === '1.1' ? { ...key, wordGap: 0.08 } : { ...key, skew: 0.2 }],
    y: 0.8,
    gap: 0.016,
    maxWords: 4,
    enter: REEL_ENTER,
    captionseasy: {
      look: 34,
      set: {
        fontId: 'Russo One', fontWeight: 600, casing: 'upper', letterSpacing: -1, lineHeight: 1,
        'fill.color': '#FFFFFF', 'active.color': lit.glow.color, 'hero.scale': 1.43, 'hero.fontId': 'Russo One',
        'shadow.enabled': true, 'shadow.color': 'rgba(0,0,0,0.7)',
        'glow.enabled': true, 'glow.color': lit.glow.color, 'glow.radius': 24,
        'position.y': 0.8, maxWordsPerCard: 4, 'entrance.type': 'pop',
      },
    },
  };
}

export const PREMIUM_PRESETS: PremiumPreset[] = [premiumCaption1('1.1'), premiumCaption1('1.2')];
