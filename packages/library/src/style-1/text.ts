import type { SfxRef } from './spec';
import type { EffectId } from './effects';
import { BRANDS, FONT, GOLD_GRADIENT, PROP_COLORS, STAGE_COLORS, TIMING, TYPE, type BrandName, type FontId } from './tokens';

/**
 * Text looks as parameterised factories: `ink('Hello', { top: 420 })` -> `{ look, layer, effects, sfx }`.
 * `layer` is a MotionEasy `style1-timeline` line layer (also what the ContentEasy kit compiles to); word frames are 0 until
 * the kit aligns them to the voice. Defaults are exposed as constants (INK_LINE, ACCENT_LINE ...): edit one, every factory follows.
 */

export type LookId =
  | 'ink' | 'film-ink' | 'accent-slam' | 'serif-gold' | 'hero-word' | 'kicker' | 'quiet' | 'stat-number' | 'bullet-item'
  | 'chip-title' | 'dark-title' | 'metal' | 'neon' | 'glow' | 'label-pill' | 'watermark';

export interface WordSpec { w: string; f: number }

/** A line layer in the renderer's own keys. */
export interface LineLayer {
  kind: 'line';
  words: WordSpec[];
  top: number;
  width?: number;
  size?: number;
  font?: FontId;
  weight?: number;
  tracking?: number;
  color?: string;
  grey?: string;
  italic?: boolean;
  gradient?: string[];
  align?: 'center' | 'left';
  cx?: number;
  x?: number;
  reveal?: number;
  hold?: number;
  slide?: number;
  motion?: 'rise' | 'elastic' | 'slam' | 'slide';
  instant?: boolean;
  sparks?: boolean;
  dim?: number;
  out?: number;
  chip?: string;
  count?: [number, number];
  look?: 'metal' | 'neon' | 'glow';
  shimmer?: number;
  bullet?: { x: number; size: number; f: number };
  k?: number;
  fixed?: boolean;
  [extra: string]: unknown;
}

export interface TextSpec {
  look: LookId;
  layer: LineLayer;
  /** Effects this look switches on (see effects.ts). */
  effects: EffectId[];
  /** Sounds that belong to it (the kit adds a typing note per word on top). */
  sfx: SfxRef[];
  /** Plain-language "use it when". */
  use: string;
}

/** Options every factory takes. Anything else is passed straight onto the layer (an override wins). */
export interface TextOpts {
  top: number;
  /** The width the line is sized to (the renderer solves the font size). Default from the text length. */
  width?: number;
  /** Explicit size in px instead of a width. */
  size?: number;
  cx?: number;
  x?: number;
  align?: 'center' | 'left';
  font?: FontId;
  /** Use the film type (Bricolage 800, -0.035) instead of the kit default (brand font, -0.02). */
  film?: boolean;
  /** Brand colours for ink / accent. Default: CaptionsEasy. */
  brand?: BrandName;
  color?: string;
  out?: number;
  dim?: number;
  fixed?: boolean;
  [extra: string]: unknown;
}

// ── defaults, all in one place ────────────────────────────────────────────────────────────────────────────────
/** Base of every ink line (s1kit.ln). */
export const INK_LINE = { weight: FONT.kit.weight, tracking: FONT.kit.tracking, reveal: TYPE.kitReveal.frames, hold: TYPE.kitReveal.hold, slide: TYPE.kitReveal.slide, cx: 540 } as const;
/** Accent slam (s1kit.accent): weight 900, motion slam, instant. */
export const ACCENT_LINE = { weight: FONT.accent.weight, tracking: FONT.accent.tracking, motion: 'slam', instant: true } as const;
/** Serif gold (s1kit.serif): Instrument Serif italic 400, gold gradient. */
export const SERIF_LINE = { weight: FONT.serif.weight, tracking: FONT.serif.tracking, italic: true, instant: true, gradient: [...GOLD_GRADIENT] } as const;
/** Kicker: the small lead-in line above a hero (ce-01 "Top creators use", "Say hello to"): weight 500, narrower. */
export const KICKER_LINE = { weight: 500, widthPerChar: 38, widthPad: 40 } as const;
/** Stat number: heavy, counts up over 20 frames and chimes. */
export const STAT_LINE = { weight: 800, countFrames: 20, from: 0 } as const;
/** Bullet list item: left aligned, elastic, sparkle bullet 54 px at x 250, text at x 330 (ce-01 pick/export/post). */
export const BULLET_LINE = { x: 330, bulletX: 250, bulletSize: 54, weight: 800 } as const;
/** Title that rides over a dark UI capture (ce-03 reveal): white, fixed above the camera, with a top scrim. */
export const DARK_TITLE = { color: '#FFFFFF', weights: [600, 800] as const, widths: [520, 860] as const, top: 170, pitch: 80, scrim: { h: 640, from: 'rgba(0,0,0,0.62)', to: 'rgba(0,0,0,0)' } } as const;
/** Premium looks (only for videos about caption looks). */
export const PREMIUM_LINE = { metal: { glow: 'rgba(190,150,255,0.55)', stroke: '#1E1630' }, neon: { color: '#FFB347' }, glow: { color: '#FFFFFF' } } as const;
/** Watermark: fixed text above the camera, small, grey (SKILL §2, ce-01 '#E8E6CF' on cream). */
export const WATERMARK_LINE = { y: BRANDS.captionseasy.watermark ? 1645 : 1645, size: 34, weight: 700, color: STAGE_COLORS.refWatermark } as const;
/** Pill / field text (typebox): see ui.ts typebox for geometry. */
export const LABEL_PILL = { weight: 800, h: 90, perChar: 0.7 } as const;

// ── helpers ───────────────────────────────────────────────────────────────────────────────────────────────────
export const words = (text: string): WordSpec[] => text.split(/\s+/).filter(Boolean).map(w => ({ w, f: 0 }));

const lum = (hex: string) => { const n = parseInt(hex.replace('#', '').slice(0, 6), 16); const c = [n >> 16, (n >> 8) & 255, n & 255].map(v => v / 255); return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!; };

/** A pale accent can't carry text on a light stage: words use the deep accent instead (port stage.accentText). */
export const accentInk = (accent: string, accentDeep: string) => (lum(accent) > 0.62 ? accentDeep : accent);

/** Width budget for a line (kit presets): min(cap, perChar * chars + pad). */
export function budget(kind: keyof typeof TYPE.width, text: string): number {
  const b = TYPE.width[kind];
  return Math.min(b.cap, b.perChar * [...text].length + b.pad);
}

/** The type size that fits a width and a height budget by average glyph width per look (port fitSize). */
export function fitSize(text: string, maxW: number, maxSize: number, look: 'ink' | 'accent' | 'serif' = 'ink'): number {
  const em = TYPE.fitEm[look];
  return Math.round(Math.max(28, Math.min(maxSize, maxW / (Math.max(1, [...text].length) * em))));
}

/** "*WORD*" -> accent slam; "~words" -> the serif accent; anything else is ink (port parseLine). */
export function parseMarkup(t: string): { text: string; look: 'ink' | 'accent' | 'serif' } {
  const s = t.trim();
  if (/^\*.+\*$/.test(s)) return { text: s.slice(1, -1).trim(), look: 'accent' };
  if (s.startsWith('~')) return { text: s.slice(1).trim(), look: 'serif' };
  return { text: s.replace(/\*/g, ''), look: 'ink' };
}

/** Lint a line against the laws (<= 26 characters, <= 5 words). Returns the problems, empty = fine. */
export function lintLine(text: string): string[] {
  const out: string[] = [];
  if ([...text].length > TYPE.maxChars) out.push(`"${text}" is ${[...text].length} characters (max ${TYPE.maxChars})`);
  if (text.split(/\s+/).filter(Boolean).length > TYPE.maxWords) out.push(`"${text}" has more than ${TYPE.maxWords} words`);
  return out;
}

function base(text: string, o: TextOpts, look: LookId): { L: LineLayer; ink: string; accent: string; deep: string } {
  const B = BRANDS[o.brand ?? 'captionseasy'];
  const { brand: _b, film, ...rest } = o;
  const L: LineLayer = { kind: 'line', words: words(text), top: o.top, ...INK_LINE, color: o.color ?? B.ink, font: o.font ?? (film ? FONT.film.id : (B.font as FontId)), ...(film ? { weight: FONT.film.weight, tracking: FONT.film.tracking } : {}) };
  void look;
  const { top: _t, ...over } = rest;
  Object.assign(L, over);
  return { L, ink: B.ink, accent: B.accent, deep: B.accentDeep };
}
const spec = (look: LookId, L: LineLayer, use: string, effects: EffectId[] = [], sfx: SfxRef[] = []): TextSpec => ({ look, layer: L, effects, sfx, use });

// ── looks ──────────────────────────────────────────────────────────────────────────────────────────────────────
/** Plain ink line: brand font, weight 800, grey -> ink fill, rises (centred) or elastic (left). */
export function ink(text: string, o: TextOpts): TextSpec {
  const { L } = base(text, o, 'ink');
  L.width ??= o.size ? undefined : budget('lines', text);
  return spec('ink', L, 'The default line: key words of the script, one idea per line.', ['word-rise', 'grey-to-ink']);
}

/** The film's ink: Bricolage 800 at -0.035 (ce-06 v2 .. ce-12). Same as ink() with film on. */
export function filmInk(text: string, o: TextOpts): TextSpec {
  const s = ink(text, { ...o, film: true });
  return { ...s, look: 'film-ink', use: 'Ink line in the premium film face (Bricolage 800). Use for every ink line when the brand has no font of its own.' };
}

/** Accent slam: the style's one accent colour, weight 900, slams in. One per scene, usually the last line. */
export function accentSlam(text: string, o: TextOpts): TextSpec {
  const { L, accent, deep } = base(text, o, 'accent-slam');
  Object.assign(L, ACCENT_LINE, { color: o.color ?? accentInk(accent, deep) }, o.motion ? { motion: o.motion } : {});
  L.width ??= o.size ? undefined : budget('stackSlamLast', text);
  return spec('accent-slam', L, 'The punch line / climax word: hard-hit + key-word snap. Max two hard-hits a video.', ['word-slam', 'slam-sparks'], [{ id: 'punch', event: 'hard-hit' }, { id: 'snap', event: 'key-word', offset: 0 }]);
}

/** The one serif-italic gold accent line (Instrument Serif, gold gradient). At most one per scene. */
export function serifGold(text: string, o: TextOpts): TextSpec {
  const { L } = base(text, o, 'serif-gold');
  Object.assign(L, SERIF_LINE, { gradient: [...GOLD_GRADIENT], font: FONT.serif.id });
  L.width ??= o.size ? undefined : budget('lines', text) * 0.8;
  if (o.shimmer) L.shimmer = o.shimmer as number;
  return spec('serif-gold', L, 'Second line of every two-line title: line 1 ink, line 2 gold cursive (never two ink lines).', ['word-rise', ...(o.shimmer ? (['gold-shimmer'] as EffectId[]) : [])]);
}

/** A mixed-hierarchy line: the same ink line with its glyphs `k` times larger at the same width (key word 1.5-2x). */
export function heroWord(text: string, o: TextOpts & { k?: number }): TextSpec {
  const s = ink(text, o);
  s.layer.k = o.k ?? TYPE.heroScale;
  return { ...s, look: 'hero-word', use: 'The key word of a sentence at 1.5-2x with the rest small/regular: "64 *specialised* AI agents".', effects: ['word-rise', 'word-slam'] };
}

/** Kicker: a lighter, smaller lead-in above a hero line. */
export function kicker(text: string, o: TextOpts): TextSpec {
  const { L } = base(text, o, 'kicker');
  L.weight = KICKER_LINE.weight;
  L.width ??= o.size ? undefined : Math.min(760, KICKER_LINE.widthPerChar * [...text].length + KICKER_LINE.widthPad);
  return spec('kicker', L, 'The small lead-in before the hero ("Top creators use", "Say hello to"). Weight 500, never competes with the hero.', ['word-rise', 'grey-to-ink']);
}

/** Quiet: the port's lighter ink (weight 600) for supporting lines. */
export function quiet(text: string, o: TextOpts): TextSpec {
  const s = ink(text, { weight: 600, ...o });
  return { ...s, look: 'quiet', use: 'Supporting line under a headline; light weight so the headline keeps the eye.' };
}

/** Stat number: a number word that counts up as it lands and chimes (30+, 214k, 64). */
export function statNumber(text: string, o: TextOpts & { countFrames?: number }): TextSpec {
  const { L } = base(text, o, 'stat-number');
  Object.assign(L, { weight: STAT_LINE.weight, count: [STAT_LINE.from, o.countFrames ?? STAT_LINE.countFrames] as [number, number], motion: 'slam', instant: true });
  L.width ??= o.size ? undefined : Math.min(500, 120 * [...text].length + 60);
  return spec('stat-number', L, 'A number is the proof: let it count up and land. For a physical numeral use ui.num3d.', ['count-up', 'word-slam'], [{ id: 'chime', event: 'stat', offset: 0 }]);
}

/** Left-aligned list item with the sparkle bullet; words come in from the right (elastic). */
export function bulletItem(text: string, o: TextOpts): TextSpec {
  const { L } = base(text, o, 'bullet-item');
  Object.assign(L, { align: 'left', x: o.x ?? BULLET_LINE.x, weight: BULLET_LINE.weight, motion: 'elastic', cx: undefined, bullet: { x: BULLET_LINE.bulletX, size: BULLET_LINE.bulletSize, f: 0 } });
  L.width ??= o.size ? undefined : budget('listLeft', text);
  return spec('bullet-item', L, 'Steps and value lists: one item per spoken phrase, earlier items dim as the next starts.', ['word-elastic', 'bullet-sparkle', 'dim-back'], [{ id: 'ui-blip', event: 'list-item' }]);
}

/** Title chip: ink line on a soft rounded card, for titles that sit over a busy UI shot. */
export function chipTitle(text: string, o: TextOpts & { chip?: string }): TextSpec {
  const { L } = base(text, o, 'chip-title');
  L.chip = o.chip ?? '#FFFFFF';
  L.width ??= o.size ? undefined : budget('lines', text);
  return spec('chip-title', L, 'A title over a moving capture (browser, editor) so it stays readable.', ['chip-title', 'word-rise']);
}

/** White title on a dark photo/UI with a top scrim (ce-03). Fixed: rides above the camera. */
export function darkTitle(text: string, o: TextOpts & { index?: 0 | 1 }): TextSpec {
  const i = o.index ?? 0;
  const { L } = base(text, o, 'dark-title');
  Object.assign(L, { color: DARK_TITLE.color, grey: DARK_TITLE.color, fixed: true, weight: DARK_TITLE.weights[i], width: o.width ?? DARK_TITLE.widths[i] });
  return spec('dark-title', L, 'Open full-bleed on a clip: the title sits on a black scrim, leaves before the pull-out.', ['word-rise']);
}

/** Premium caption looks (metal chrome, neon tube, soft glow). */
export function premiumLook(text: string, o: TextOpts & { variant?: 'metal' | 'neon' | 'glow' }): TextSpec {
  const v = o.variant ?? 'metal';
  const { L } = base(text, o, v);
  L.look = v;
  if (v === 'neon') L.color = o.color ?? PREMIUM_LINE.neon.color;
  L.width ??= o.size ? undefined : budget('lines', text);
  return spec(v, L, 'Only when the video is about these looks: do not mix caption looks inside a film (owner 2026-10-12).', ['premium-look', 'word-rise']);
}

/** Pill label text (a typebox): returns the typebox layer geometry for ui.typebox. */
export function labelPill(text: string, o: { x: number; y: number; w: number; h?: number; fill?: string; color?: string; brand?: BrandName }): { look: LookId; layer: Record<string, unknown>; use: string } {
  const B = BRANDS[o.brand ?? 'captionseasy'];
  return {
    look: 'label-pill',
    layer: { kind: 'typebox', x: o.x, y: o.y, w: o.w, h: o.h ?? LABEL_PILL.h, r: (o.h ?? LABEL_PILL.h) / 2, fill: o.fill ?? B.accentDeep, color: o.color ?? B.stage, text, cursor: 0, start: 0, perChar: LABEL_PILL.perChar },
    use: 'Short label that types in: "Open source", "Free", "0 watermarks", "captionseasy.com".',
  };
}

/** Fixed watermark text (timeline.watermark). */
export function watermark(text: string, o: { y?: number; width?: number; color?: string } = {}) {
  return { text, y: o.y ?? WATERMARK_LINE.y, size: WATERMARK_LINE.size, weight: WATERMARK_LINE.weight, width: o.width, color: o.color ?? WATERMARK_LINE.color };
}

// ── stacks ─────────────────────────────────────────────────────────────────────────────────────────────────────
/** A centred stack of markup lines ("*SLAM*", "~gold", plain ink), pitch 110 from `top` (kit lines()). */
export function stack(lines: string[], o: { top?: number; gap?: number; film?: boolean; brand?: BrandName } = {}): TextSpec[] {
  const top = o.top ?? TYPE.tops.hook, gap = o.gap ?? TYPE.gap.lines;
  return lines.map((t, i) => {
    const { text, look } = parseMarkup(t);
    const to = { top: top + i * gap, film: o.film, brand: o.brand } as TextOpts;
    return look === 'accent' ? accentSlam(text, to) : look === 'serif' ? serifGold(text, to) : ink(text, to);
  });
}

/** Left list: lines left-aligned at x 90, pitch 110, each dims when the next starts (kit list_left). */
export function listLeft(lines: string[], o: { top?: number; gap?: number; x?: number; film?: boolean } = {}): TextSpec[] {
  const top = o.top ?? TYPE.tops.listLeft, gap = o.gap ?? TYPE.gap.listLeft;
  return lines.map((t, i) => {
    const s = ink(parseMarkup(t).text, { top: top + i * gap, align: 'left', x: o.x ?? 90, width: budget('listLeft', t), film: o.film });
    return { ...s, effects: ['word-elastic', 'dim-back'] as EffectId[] };
  });
}

/** Punch stack: heavy ink lines at pitch 140, the last one an accent slam (kit stack_slam). */
export function punchStack(lines: string[], o: { top?: number; gap?: number; film?: boolean } = {}): TextSpec[] {
  const top = o.top ?? TYPE.tops.stackSlam, gap = o.gap ?? TYPE.gap.stackSlam;
  return lines.map((t, i) => (i < lines.length - 1
    ? ink(t, { top: top + i * gap, weight: 900, width: budget('stackSlam', t), film: o.film })
    : accentSlam(t, { top: top + i * gap + 15, film: o.film })));
}

/** Reserved so callers can read the timing the kit applies to a line's words. */
export const WORD_TIMING = { lead: TIMING.wordLead, minGap: TIMING.wordMinGap } as const;

/** Caption looks drawn ON a phone screen (style1-props `capt`). */
export const PHONE_CAPTION = {
  styles: ['plain', 'stroke', 'box', 'hormozi'] as const,
  /** One look per film (ce-06 v2: Bricolage 800 outlined). */
  filmDefault: { style: 'stroke', font: FONT.film.id, weight: FONT.film.weight },
  /** Hormozi Box: hero word in a coloured box; the chunk swaps on frames. */
  note: 'p.chunks [[frame, text, hero?]], p.ys [[frame, yFrac]], p.heroWord, p.fade, p.fix (retype), p.squig (red spell-check), p.tick',
  heroColor: PROP_COLORS.green,
} as const;
