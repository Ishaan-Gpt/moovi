/**
 * Dark Vox: every editable number of the style in one place. Measured from the reference reel (DdI5hwFuoI6,
 * 1080x1920, 15 fps, 28.8 s); see BREAKDOWN.md for where each number comes from. The engine (packages/engine/src/darkvox)
 * and the browser player read ONLY these tokens (they travel inside film.json), so changing a value here changes
 * every Dark Vox film.
 *
 * The look in one line: a lit paper-theatre stage at night. Every shot is a layered set (backdrop, floor, wings,
 * hero cut-out, foreground props) seen by a camera that punches through each cut, pulls back through frames and
 * rises over sets; one spotlight with a deep vignette, warm practicals with bloom, crushed-but-not-black shadows,
 * film grain; few words, big and lit, set BEHIND the hero.
 */

/* ───────── colour: the stage palette (sampled hexes, rounded to the cluster centres) ───────── */
export const PALETTE = {
  night: '#0D121D',     // night sky / deep backdrop (dominant cluster of the dark sets)
  soot: '#231A18',      // the warm black of velvet folds and wood shadow (never #000)
  oxblood: '#5E2222',   // curtain velvet, harlequin red in shadow
  scarlet: '#A8282B',   // velvet / harlequin red where the spot hits
  cream: '#F0EEE7',     // card stock, harlequin white, type highlight
  parchment: '#D8D0BC', // aged paper mid
  brass: '#A8743A',     // frames, stars, lamp housings
  gold: '#E2B456',      // gilt highlight
  cobalt: '#2C67AD',    // paper waves lit
  navy: '#1E3F73',      // paper waves shadow
  wood: '#45291C',      // table / boards
  woodLit: '#7A4A2E',
  lamp: '#FFB347',      // practical lamp core (bloom tint)
  marker: '#D62B2B',    // the hand-drawn annotation ellipse
  acid: '#DCDB09',      // the end-card radial centre → acidEdge at the corners
  acidEdge: '#797905',
} as const;

/** The grade (8-bit luma percentiles of the reference's stage shots). */
export const GRADE = {
  blackP2: 12,     // 2nd percentile 6-17: shadows crushed, never pure black
  whiteP98: 238,   // 98th percentile 220-246: highlights never clip
  vignette: 0.36,  // corner / centre luma on the dark sets (0.23-0.45; 1.0 = none)
  warmth: 0.08,    // sepia mix on the whole frame
  saturation: 1.08,
  contrast: 1.12,
  grain: 0.10,     // grain opacity (overlay), new every frame
  grainSize: 270,  // grain canvas width (1080 / 4 → ~4 px grains)
} as const;

/* ───────── motion: easings (CSS cubic-bezier) and the measured camera ───────── */
export const EASE = {
  /** cut punch settle: the per-frame zoom halves every frame at 15 fps (×1.136-1.161 → 1.067 → 1.035 → 1.016 → 1.003): expo-out */
  punchOut: [0.16, 1, 0.3, 1],
  /** the ramp INTO a cut: ×1.0017, 1.0042, 1.0185, 1.10 per frame: expo-in */
  rampIn: [0.7, 0, 0.84, 0],
  /** long pull-backs and rises */
  glide: [0.45, 0, 0.25, 1],
  /** card / prop entries: back-out with a small overshoot */
  land: [0.34, 1.4, 0.64, 1],
} as const;

export type CameraMove = 'punch' | 'pull' | 'rise' | 'slide' | 'hold';
/** Camera presets. Scale is relative to the shot's rest framing; x / y are fractions of the frame. */
export const CAMERA = {
  fps: 15,                                          // the reference's delivered rate (the player runs at display rate)
  shotSeconds: { min: 1.6, median: 2.4, max: 5.1 }, // 12 shots in 28.8 s
  /** the zoom-through cut: the last `ramp` s of a shot push +rampScale (expo-in); the next shot lands at +landScale and settles in `settle` s (expo-out) */
  cut: { ramp: 0.33, rampScale: 0.13, landScale: 0.13, settle: 0.42, blurPx: 10 },
  /** between moves the camera HOLDS dead still for 0.5-1.5 s (s = 1.0000, |t| < 0.02 %): no handheld shake */
  hold: { min: 0.5, max: 1.5 },
  /** slow push while holding (12.3-14.5 s of the reference): +1.5 % per second */
  drift: 0.015,
  moves: {
    punch: { from: 1.13, to: 1.0, x: 0, y: 0, roll: 0 },
    /** pull back through the set: ×0.98-0.99 per frame sustained → about 1.55x → 1.0 over the shot */
    pull: { from: 1.55, to: 1.0, x: 0, y: 0, roll: 0 },
    /** rise: tilt over a set, -8.7 %/frame decaying → about 23 % of frame height in 0.8 s, 1° roll settling */
    rise: { from: 1.06, to: 1.0, x: 0, y: 0.23, roll: 1.0 },
    /** slide: lateral whip, about 28 % of frame width in 0.4 s */
    slide: { from: 1.04, to: 1.0, x: 0.28, y: 0, roll: -0.6 },
    hold: { from: 1.02, to: 1.0, x: 0, y: 0, roll: 0 },
  } satisfies Record<CameraMove, { from: number; to: number; x: number; y: number; roll: number }>,
  /** seconds each move takes before it holds */
  moveSeconds: { punch: 0.42, pull: 2.4, rise: 0.8, slide: 0.45, hold: 0.42 } satisfies Record<CameraMove, number>,
  /** a shot longer than `after` s gets a mid-shot reframe (a punch to a tighter framing), keeping the measured cut cadence (one camera event every ~2.4 s) */
  reframe: { after: 3.0, scale: 1.2, settle: 0.42 },
  /** the frame-within-frame "portal": the new shot appears at 0.30 of its size inside the old frame and pulls out */
  portal: { startScale: 0.30, settle: 0.9 },
  /** depth of each set layer: how much of the camera move it takes (parallax). 1 = the hero plane */
  depth: { backdrop: 0.45, floor: 0.7, typeBack: 0.82, hero: 1.0, wings: 1.25, fore: 1.6 },
} as const;

/* ───────── light ───────── */
export type LightPreset = 'spot' | 'lamps' | 'top' | 'moon' | 'day' | 'acid';
/** Spotlight centre (fractions), radius (fraction of height), how dark the corners go (0-1), practical lamps, bloom, leak tint, haze (volumetric beam). */
export const LIGHT: Record<LightPreset, { cx: number; cy: number; r: number; edge: number; lamps: [number, number][]; bloom: number; leak: string; haze: number }> = {
  spot:  { cx: 0.5, cy: 0.52, r: 0.62, edge: 0.70, lamps: [], bloom: 0.35, leak: '#FFB36A', haze: 0.10 },
  lamps: { cx: 0.5, cy: 0.62, r: 0.55, edge: 0.88, lamps: [[0.2, 0.15], [0.8, 0.15]], bloom: 0.9, leak: '#FFB347', haze: 0.18 },
  top:   { cx: 0.5, cy: 0.32, r: 0.70, edge: 0.66, lamps: [], bloom: 0.25, leak: '#FFD9A0', haze: 0.22 },
  moon:  { cx: 0.5, cy: 0.40, r: 0.75, edge: 0.55, lamps: [], bloom: 0.2, leak: '#9FC2FF', haze: 0.08 },
  day:   { cx: 0.5, cy: 0.45, r: 0.95, edge: 0.20, lamps: [], bloom: 0.15, leak: '#FFF2D6', haze: 0.0 },
  acid:  { cx: 0.5, cy: 0.50, r: 0.80, edge: 0.52, lamps: [], bloom: 0.4, leak: '#FFFFA0', haze: 0.0 },
};
/** The light leak that sweeps across each cut (warm streak, screen blend). */
/** The warm lift at the spotlight's centre (screen blend), as alpha at full bloom. */
export const SPOT_GLOW = 0.28;
/** The light leak that sweeps across each cut (warm streak, screen blend). */
export const LEAK = { seconds: 0.5, opacity: 0.45, angle: 112 } as const;

/* ───────── sets: the code-drawn stages a shot stands on ───────── */
export const SETS = ['harlequin', 'sunburst', 'night', 'waves', 'wood', 'swirl', 'grid', 'checker', 'velvet'] as const;
export type SetKind = (typeof SETS)[number];
export const SET_DEFAULTS: Record<SetKind, { light: LightPreset; wings: 'curtains' | 'frame' | 'none'; floor: 'rays' | 'checker' | 'none'; fore: 'stars' | 'clouds' | 'none'; about: string }> = {
  harlequin: { light: 'spot', wings: 'curtains', floor: 'none', fore: 'none', about: 'red/cream harlequin diamonds framed by velvet curtains: play, risk, identity, a reveal' },
  sunburst:  { light: 'day', wings: 'none', floor: 'none', fore: 'clouds', about: 'pale swirling sun rays with paper clouds: an opening, a promise, daylight, optimism' },
  night:     { light: 'moon', wings: 'none', floor: 'none', fore: 'stars', about: 'navy night with hanging paper stars and clouds: belief, dreams, ambition, quiet' },
  waves:     { light: 'moon', wings: 'none', floor: 'none', fore: 'stars', about: 'layered blue paper waves at night: the world, scale, struggle, travel, flow' },
  wood:      { light: 'top', wings: 'none', floor: 'none', fore: 'none', about: 'a lit wooden table from above: evidence, craft, hands-on work, a desk' },
  swirl:     { light: 'spot', wings: 'frame', floor: 'none', fore: 'none', about: 'painterly blue swirls inside a gilt frame: the past, memory, a portrait, legacy' },
  grid:      { light: 'day', wings: 'none', floor: 'none', fore: 'none', about: 'graph paper on a desk: tools, numbers, method, the end card for a product' },
  checker:   { light: 'lamps', wings: 'none', floor: 'checker', fore: 'none', about: 'a checkerboard floor under two street lamps: a turn, a verdict, the big line' },
  velvet:    { light: 'spot', wings: 'curtains', floor: 'rays', fore: 'stars', about: 'a midnight booth stage with radial stripe floor: money, power, status, a show' },
};

/* ───────── type ───────── */
export type TypeLook = 'title' | 'engraved' | 'label';
/** Cap height as a fraction of frame HEIGHT; maximum width as a fraction of frame width. */
export const TYPE: Record<TypeLook, { font: string; weight: number; cap: number; maxWidth: number; tracking: number; fill: [string, string]; shadow: string }> = {
  /** the hero word: condensed grotesque, ~18 % of frame height with its line box, about 75 % wide, lit from the top */
  title:    { font: 'Anton', weight: 400, cap: 0.135, maxWidth: 0.72, tracking: 0.0, fill: ['#FFFFFF', '#BDB3A0'], shadow: '0 10px 30px rgba(0,0,0,.65)' },
  /** the engraved line: heavy old-style serif, 3.5 % high, tracked +8 %, letterpress white */
  engraved: { font: 'Fraunces', weight: 900, cap: 0.034, maxWidth: 0.74, tracking: 0.08, fill: ['#FFFFFF', '#E9E2D2'], shadow: '0 4px 0 rgba(0,0,0,.55)' },
  /** the label: heavy rounded grotesque, 5 % high, white with a soft dark halo; may carry the marker ellipse */
  label:    { font: 'Bricolage', weight: 800, cap: 0.045, maxWidth: 0.78, tracking: 0.0, fill: ['#FFFFFF', '#EDEDED'], shadow: '0 0 16px rgba(0,0,0,.6)' },
};
/** Words pop on the voice: at each word's onset scale 1.15 → 1, blur 6 → 0 px, opacity 0 → 1 in 0.13 s (2 frames at 15 fps). */
export const TYPE_MOTION = { popFrom: 1.15, blurFrom: 6, inSeconds: 0.13, markerDraw: 0.4, markerDelay: 0.25, maxWords: 3 } as const;
/** Share of shots that carry on-screen words (5 of 12 in the reference): words are rare and big. */
export const TYPE_SHARE = 0.45;

/* ───────── hero cut-outs: drawn in greys, mapped through this tritone (luminance → colour) ───────── */
export const HERO_TONES = { ink: '#16100C', edge: '#5E2222', top: '#A8743A', mid: '#E2C48A', paper: '#F4EEDF', hue: 20 } as const;
/** Hero placement: centred, an 80 % box (the drawn prop fills ~70-80 % of it: the reference's heroes fill 40-60 % of the frame), base on the 80 % line, soft drop shadow; entry from below with a roll that settles. */
export const HERO = { width: 0.8, baseY: 0.80, shadow: 'drop-shadow(0 26px 34px rgba(0,0,0,.6))', entry: { seconds: 0.45, fromY: 0.22, roll: 7 } } as const;

/* ───────── sound ───────── */
export const SOUND = { lufs: -14, bedUnderVoiceLU: 9 } as const;

/** Everything the browser player needs, as one JSON-able object. */
export const DARK_VOX = { PALETTE, GRADE, EASE, CAMERA, LIGHT, LEAK, SPOT_GLOW, SET_DEFAULTS, TYPE, TYPE_MOTION, HERO } as const;
export type DarkVoxTokens = typeof DARK_VOX;
