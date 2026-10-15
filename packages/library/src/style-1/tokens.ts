import type { Bezier, SpringCfg } from './spec';

/**
 * Style 1 design tokens. One place to tweak a colour, size, timing or curve.
 * Sources (MotionEasy): style1-timeline.ts (renderer constants), style1-props.ts (prop looks), engine math.ts (E, SPRING),
 * fonts.ts, styles/tools/s1kit.py (kit numbers), cli/s1qa.mjs (QA geometry), .claude/skills/style-1/SKILL.md (owner rules),
 * styles/style-1/brands/*.json. Layout numbers are for the 1080x1920 vertical frame; landscape scales via `scaleFor`.
 */

// ── frame & time ─────────────────────────────────────────────────────────────────────────────────────────────
export const FPS = 30; // SKILL §1: 30 fps

export const FRAME = {
  vertical: { w: 1080, h: 1920, aspect: '9x16' },
  landscape: { w: 1920, h: 1080, aspect: '16x9' }, // Moovi port: positions scale to the frame, sizes to the short edge
} as const;
export type FrameName = keyof typeof FRAME;

/** The port's geometry: x by width, y by height, sizes by the short edge (presets.ts geo()). */
export function scaleFor(frame: FrameName) {
  const { w, h } = FRAME[frame];
  const u = Math.min(w, h) / 1080;
  return { X: (x: number) => (x * w) / 1080, Y: (y: number) => (y * h) / 1920, S: (s: number) => s * u };
}

export const sec = (frames: number) => frames / FPS;
export const frames = (seconds: number) => Math.round(seconds * FPS);

/** Timing units. Frames at 30 fps unless the name says otherwise. */
export const TIMING = {
  /** QA / skill: first shown word before 2 s. */
  hookMaxSec: 2.0,
  /** SKILL §1: something new about every 0.5-1 s; QA dead-air limit 1.6 s. */
  newEventEverySec: [0.5, 1.0] as const,
  deadAirMaxSec: 1.6,
  /** A scene opens this many frames before its first spoken word (kit _scene). */
  sceneLead: 4,
  /** The slow start of a hook: first shown word lands no later than this frame. */
  hookMaxFrame: 60,
  /** Shown word lands on the frame before the voice says it (finish(): round(t*30) - 1). */
  wordLead: 1,
  /** Two words never share a frame: at least this many frames apart (finish()). */
  wordMinGap: 2,
  /** Typing notes on words keep at least this gap (s) (mixer min_gap 0.06; kit spreads to 0.067). */
  sfxMinGapSec: 0.06,
  /** A scene never ends on an empty cut: a visual is already mid-entry this many frames before the cut. */
  cutGuard: [3, 4] as const,
  /** Props glide out this many frames before their scene cuts (polish()). */
  exitBeforeCut: 10,
  /** Scene arrives (settles) this many frames after its cut. */
  sceneArrive: 24,
  /** Landing frame -> element count for grids: one pop every N frames per item (kit `_stagger=2*i`). */
  cascadeStagger: 2,
  /** Music: 136 BPM (SKILL §0 Sound). */
  bpm: 136,
  /** Last-frame tail after the final spoken word (kit finish(): + 1.2 s). */
  tailSec: 1.2,
} as const;

/** Beat lengths at the bed's BPM (136 -> 0.441 s = 13.2 frames; bar = 4 beats; the bed loops on 10 bars). */
export const BEAT = {
  bpm: TIMING.bpm,
  beatSec: 60 / TIMING.bpm,
  beatFrames: (60 / TIMING.bpm) * FPS,
  barBeats: 4,
  barFrames: (60 / TIMING.bpm) * 4 * FPS,
  loopBars: 10,
  /** SKILL §0: a riser is the full 3 s file and ends exactly on the cut. */
  riserSec: 3,
} as const;

// ── colour ───────────────────────────────────────────────────────────────────────────────────────────────────
/** Renderer defaults (style1-timeline.ts) and the reference stage (SKILL §2, measured on the refs). */
export const STAGE_COLORS = {
  ink: '#1E1E1E', // renderer INK
  greyWord: '#BEBEBE', // a word's first look, before it turns ink (measured ~#C8..#BE)
  dimWord: '#BDB9AA', // dimmed line colour (line.dimTo default)
  dimAlpha: 0.62, // dim = 1 - 0.62 * ease(10 frames)
  refStage: '#F6F6F6', // reference stage tones: #FFFFFF text beats, #F6F6F6 default, #F2F2F2 card stacks
  refStageLight: '#FFFFFF',
  refStageStack: '#F2F2F2',
  refGridLine: '#D9D9D9', // ref grid: 108x92 cells, dashed 6/5, 2 px, 11 px dots #D7D7D7
  refGridDot: '#D7D7D7',
  refPlus: '#CACACA',
  refWatermark: '#E0E0E0',
  paper: '#FFFFEB', // CaptionsEasy stage and the props' "cream"
} as const;

/** Brand files (styles/style-1/brands/*.json). The kit reads ink / accent / stage / font / glows / grid / burst. */
export const BRANDS = {
  captionseasy: {
    ink: '#1A1A1A', accent: '#F0D7FF', accentDeep: '#034F46', stage: '#FFFFEB', font: 'inter-std',
    glows: [[140, 280, 820, '#EBCBFF', 0.55], [1000, 1000, 760, '#FFD9AE', 0.5], [180, 1760, 700, '#CDEFDA', 0.5]],
    grid: '#8E7BB0', burst: '#E9CCFF', watermark: 'captionseasy.com',
  },
  eegnite: {
    ink: '#0A0A0A', accent: '#FF6105', accentDeep: '#2A1810', stage: '#FFFEF8', font: 'geist',
    glows: [[140, 280, 820, '#FFD9C2', 0.55], [1000, 1000, 760, '#FFE6D2', 0.5], [180, 1760, 700, '#FFDCC6', 0.45]],
    grid: '#C98A62', burst: '#FFD3B8', watermark: '',
  },
  neutral: {
    ink: '#1E1E1E', accent: '#E8735A', accentDeep: '#2A1810', stage: '#F6F6F6', font: 'roboto',
    glows: [[140, 280, 820, '#EBCBFF', 0.55], [1000, 1000, 760, '#FFD9AE', 0.5], [180, 1760, 700, '#CDEFDA', 0.5]],
    grid: '#8E7BB0', burst: '#E9CCFF', watermark: '',
  },
} as const;
export type BrandName = keyof typeof BRANDS;

/** The default stage: cream + three slow glows + dot grid + grain (kit DEFAULT glows, s1kit.finish BACK). */
export const BACKDROP = {
  glows: BRANDS.captionseasy.glows,
  /** Glow drift in the renderer: 70*sin(t*.35 + i*2.1) x, 60*cos(t*.28 + i*1.3) y, 0.1 camera parallax. */
  glowDrift: { x: 70, y: 60, fx: 0.35, fy: 0.28, parallax: 0.1 },
  grid: { step: 90, dot: 2.3, line: 'rgba(120,100,120,0.06)', color: BRANDS.captionseasy.grid, parallax: 0.25 },
  grain: 0.05,
  vignette: 0.09,
  vignetteTint: 'rgba(70,50,30,A)', // radial, centre y 0.47, radius 0.65 of the long edge
  /** Four-point twinkling sparkles [x, y, r, phase]; colour = accent. */
  sparkles: [[205, 340, 26, 0], [955, 1630, 30, 3.3], [150, 1490, 20, 2.4], [890, 440, 18, 1.3]] as const,
  sparkleTwinkle: { base: 0.55, depth: 0.45, speed: 1.6 },
  /** Corner assets: half off the edge, still between rotate-in and rotate-out (SKILL §0 2026-10-10 v3, FINAL). */
  corners: [
    { side: 'top-left', x: 0, y: 150, w: 370, in: 40 },
    { side: 'bottom-right', x: 1080, y: 1700, w: 350, in: 48 },
  ] as const,
  /** Bigger-than-spec corner assets are 360-380 px; cut dip-and-pop is off when `still`. */
  cornerSize: [350, 380] as const,
  watermark: { y: 1645, size: 34, weight: 700, color: STAGE_COLORS.refWatermark, widthPx: 380 },
} as const;

/** Prop and UI palette drawn in style1-props.ts (the CaptionsEasy brand: lavender, gold, mint, deep green). */
export const PROP_COLORS = {
  ink: '#1A1A1A',
  cream: '#FFFFEB',
  green: '#034F46', // ticks, done, PAID, export done
  gold: '#B97A2C',
  lavender: '#C9A7F5',
  lavenderSoft: '#F0D7FF',
  lavenderRing: 'rgba(201,167,245,0.6)',
  violet: '#7B4FD6', // out-bubbles, send button, caret
  violetDeep: '#5B3FA8',
  highlighter: '#E4C2FF', // mark_hl default (props use #E9C8FF)
  highlighterAlt: '#E9C8FF',
  cursorRipple: '#B98CF0',
  burst: '#E9CCFF', // asterisk
  red: '#E5484D', // reject cross / NO stamp: the only red allowed
  ok: '#22A06B', // "Sent ✓"
  mutedText: '#8A8678',
  hintText: '#A9A79C',
  rowFill: '#FAF8F1',
  rowFillRejected: '#F7F1F1',
  bubbleIn: '#F1EFE7',
  tile: '#141217', // dark swatch tile
  glass: 'rgba(255,255,255,0.94)',
  glassPill: 'rgba(20,18,23,0.86)',
  shadowBrown: 'rgba(40,25,10,A)', // contact shadows
  avatars: [['#F0D7FF', '#C9A7F5'], ['#FFD9AE', '#F2A541'], ['#CDEFDA', '#6CC79A'], ['#FFE0E6', '#F28AA5'], ['#D7E8FF', '#7FA8F0']] as const,
  browserDots: ['#FF6159', '#FFBD2E', '#28C941'] as const,
  browserPill: '#F1F0E6',
} as const;

/** Orange/warm glow + extra warm accents used by clocks and urgency (watch arc green -> urgent orange). */
export const URGENCY = { arcStart: PROP_COLORS.green, arcEnd: '#FFA53D' } as const;

/** The one gold cursive gradient: Instrument Serif italic (owner 2026-10-12). Never a new gradient. */
export const GOLD_GRADIENT = ['#2B2118', '#B97A2C', '#7E9F45'] as const;

// ── type ─────────────────────────────────────────────────────────────────────────────────────────────────────
export type FontId = 'jakarta' | 'inter' | 'bricolage' | 'instrument' | 'fraunces' | 'mono' | 'geist' | 'archivo' | 'anton' | 'pacifico' | 'roboto' | 'inter-std';

/** Faces and the numbers they run at. tracking is em (-0.035 = -3.5 %). */
export const FONT = {
  /** Film titles since ce-06 v2: Bricolage Grotesque 800, tracking -0.035 (the kit's `ink()` helper in ce-08..12). */
  film: { id: 'bricolage' as FontId, weight: 800, tracking: -0.035 },
  /** Kit default (s1kit.ln): brand font, weight 800, tracking -0.02. */
  kit: { id: 'inter-std' as FontId, weight: 800, tracking: -0.02 },
  /** One accent line per scene: Instrument Serif italic 400, tracking -0.01, gold gradient. */
  serif: { id: 'instrument' as FontId, weight: 400, tracking: -0.01, italic: true },
  /** Slam / accent words. */
  accent: { weight: 900, tracking: -0.02 },
  /** Reference clone: Roboto (single-storey g); 0JZ: Inter. */
  ref: { id: 'roboto' as FontId, weight: 600, tracking: -0.02 },
  /** Product UI chrome (comment box, chat, browser, pills) stays in the UI sans. */
  ui: { id: 'inter-std' as FontId, weight: 600, tracking: -0.01 },
  /** Prop titles (panel, chat name) use Bricolage at -0.03. */
  prop: { id: 'bricolage' as FontId, weight: 800, tracking: -0.03 },
  weights: { quiet: 500, ink: 600, bold: 700, heavy: 800, slam: 900 },
} as const;

/** Type sizes (px at 1080 wide). Lines are normally sized by width (the renderer solves size); explicit sizes are ce-06 v2. */
export const TYPE = {
  /** ce-06 v2 explicit sizes (QA fix): ink 86 px, gold 92 px, <= 18 characters a line. */
  inkSize: 86,
  goldSize: 92,
  maxChars: 26, // laws: line-length check
  maxWords: 5,
  /** Width budgets used by the kit presets: min(cap, perChar * chars + pad). */
  width: {
    lines: { cap: 900, perChar: 70, pad: 120 },
    listLeft: { cap: 860, perChar: 46, pad: 60 },
    stackSlam: { cap: 820, perChar: 54, pad: 60 },
    stackSlamLast: { cap: 900, perChar: 66, pad: 80 },
    iconRingTitle: { cap: 840, perChar: 34, pad: 60 },
    iconRingFooter: { cap: 800, perChar: 48, pad: 60 },
    ctaPill: { cap: 860, perChar: 55, pad: 60 },
    wordmark: { cap: 900, perChar: 95, pad: 0 },
  },
  /** Port's glyph width per em for fitting a line to a box (presets.ts fitSize). */
  fitEm: { ink: 0.6, accent: 0.66, serif: 0.46 },
  /** Hero word size multiple in mixed-hierarchy lines (SKILL: key word 1.5-2x; v1 markup `*` = 1.7x). */
  heroScale: 1.7,
  /** Grey -> ink word reveal: refs 6-8 frames; renderer defaults. */
  reveal: { frames: 7, hold: 12, slide: 24 },
  /** The kit's own line defaults (s1kit.ln): reveal 6, hold 6, slide 60. */
  kitReveal: { frames: 6, hold: 6, slide: 60 },
  /** Top-of-line y: cap-top positions used by presets. */
  tops: { hook: 420, listLeft: 270, stackSlam: 420, iconRing: 420, trio: 290, gridTitle: 175, ctaPill: 470, ctaComment: 300 },
  /** Line pitch. */
  gap: { lines: 110, listLeft: 110, stackSlam: 140 },
} as const;

// ── layout ───────────────────────────────────────────────────────────────────────────────────────────────────
/** s1qa.mjs SAFE box: any text outside it for >= 0.2 s is "clipped". */
export const SAFE = { x0: 20, y0: 20, x1: 1060, y1: 1900 } as const;

/** Reserved zones (SKILL §0 ce-02 v2): no text here. s1qa also flags text within 8 px of a card/phone/icon, 24 px of a corner logo. */
export const RESERVED = {
  topLeftCorner: { x0: 20, y0: 60, x1: 330, y1: 370 },
  bottomRightCorner: { x0: 760, y0: 1560, x1: 1060, y1: 1860 },
  watermarkBand: { y0: 1590, y1: 1700 },
  textGapPx: 8,
  cornerGapPx: 24,
  overlapRatio: 0.02, // text/text intersection over the smaller box
  minRunSec: 0.2,
} as const;

/** Platform UI zones on a 9:16 reel (laws: safe-zone). Words never sit in these for >= 0.2 s. */
export const PLATFORM_SAFE = { bottom: 270, rail: 120, railTop: 960 } as const;

/** Layout grid used by the presets: centre column + 3-col logo grid + 2-col phone grid. */
export const GRID = {
  cx: 540,
  cy: 960,
  hero: { cy: 1150 }, // burst / phone hero centre
  logoGrid: { cols: 3, x0: 230, dx: 310, top: 1040, dy: 300, size: 250, radius: 36, rot: [-4, 3, -2, 4, -3, 2] },
  phoneGrid: { xs: [350, 730], ys: [760, 1390], w: 290, rot: [-2, 2, 2, -2] },
  phoneTrio: { xs: [215, 540, 865], y: 1090, yMid: -40, w: 300, rots: [-4, 0, 4] },
  iconRing: { cx: 540, cy: 990, rx: 280, ry: 270, size: 170, markSize: 210, radius: 40, startDeg: -90 },
  browser: { x: 40, y: 560, w: 1000, canvasW: 2880 }, // kit win(): bar = max(46, w * 0.075), h = bar + w / 1.6
  footerTop: 1395,
} as const;

// ── motion: easing & springs ─────────────────────────────────────────────────────────────────────────────────
/** Named cubic-beziers: the engine's E table (math.ts). */
export const EASE = {
  out: [0.16, 1, 0.3, 1], // expo out: lands and glides (B_IN in the timeline: objects in)
  outSoft: [0.22, 1, 0.36, 1],
  in: [0.7, 0, 0.84, 0], // accelerate away (B_OUT: objects out)
  inOut: [0.65, 0, 0.35, 1], // B_IO: paths, camera, scene keys
  ramp: [0.86, 0, 0.07, 1],
  hard: [0.95, 0, 0.05, 1], // extreme ramp for camera moves
  cine: [0.45, 0, 0.1, 1], // slow start, very long glide
  outBack: [0.34, 1.32, 0.64, 1], // tiny overshoot (word rise, cursor in)
  outBackBig: [0.3, 1.6, 0.5, 1],
  snap: [0.2, 0.9, 0.1, 1],
} as const satisfies Record<string, Bezier>;
export type EaseName = keyof typeof EASE;

/** Spring presets (engine SPRING). Time in seconds, 0 -> 1. */
export const SPRINGS = {
  pop: { damping: 13, stiffness: 190, mass: 0.9 }, // visible overshoot (images, bullets, progress)
  firm: { damping: 20, stiffness: 210, mass: 1 }, // tiny overshoot (comment box, corners)
  soft: { damping: 26, stiffness: 120, mass: 1 }, // no overshoot, slow settle (rise / slide-in images)
  punchy: { damping: 11, stiffness: 320, mass: 0.8 }, // fast, bouncy (phone watermark, "done")
  heavy: { damping: 30, stiffness: 160, mass: 1.6 }, // weighty
} as const satisfies Record<string, SpringCfg>;
export type SpringName = keyof typeof SPRINGS;

/** Damped-cosine word motion constants (renderer drawLine). */
export const WORD_MOTION = {
  /** elastic: k = 1 - exp(-decay * s) * cos(freq * s): ~25 % overshoot, settles in ~0.6 s. */
  elastic: { decay: 5.5, freq: 12.5 },
  /** rise: 16 frames, outBack, masked by the word's own box; starts (asc+desc)*0.95 below. */
  rise: { frames: 16, ease: 'outBack' as EaseName, offset: 0.95 },
  /** slam: 9 frames out-ease from +22 %, plus a ripple 0.03 * exp(-5 s) * sin(16 s). */
  slam: { frames: 9, from: 1.22, ripple: { amp: 0.03, decay: 5, freq: 16 }, alphaFrames: 2, maxGrow: 1.22 },
  /** slide: 12 frames out-ease from `slide` px right. */
  slide: { frames: 12, alphaFrames: 3 },
} as const;

/** Scene enter/exit constants (style1-timeline + s1kit). */
export const SCENE_MOTION = {
  enter: { tau: 7.5, arrive: TIMING.sceneArrive, upFrom: 300, leftFrom: 500, rightFrom: -500, downFrom: -300 },
  /** ce-01 era used tau 7.0, distance 380-520 and 9-frame exits. */
  legacy: { tau: 7.0, arrive: 24, exitFrames: 9 },
  exit: { to: 220, frames: 10, ease: 'cubic' }, // u^3, toward the incoming direction
  /** Object glide in/out (polish()). */
  glide: { inFrames: 20, outFrames: 10, inEase: 'out' as EaseName, outEase: 'in' as EaseName },
} as const;

/** Motion blur: n sub-frame samples over `shutter` frames, only inside fast-move windows (polish()). */
export const MOTION_BLUR = { samples: 5, shutter: 0.7, openingWindow: [0, 32], cutWindow: [-12, 14], entryFrames: 20, exitFrames: 10, killFrames: 34 } as const;

/** Light grade on clips only (polish default). */
export const GRADE = { media: 'contrast(1.05) saturate(1.06)', premiumMedia: 'contrast(1.06) saturate(1.10)' } as const;

// ── sound ids ────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * Event -> sfx file id(s) (styles/style-1/sfx/map.json). Ids are filenames without extension; a list rotates
 * ("never repeat the same accent back to back"). `db` = the map's target level in the SFX stem.
 */
export const EVENT_SOUNDS = {
  word: { ids: ['typing'], db: -18, note: 'one note on EVERY shown word, on the frame the voice says it; soft kenney.click layered under at -27' },
  'key-word': { ids: ['snap'], db: -24, note: 'the big bold / slam word' },
  'list-item': { ids: ['ui-blip', 'click'], db: -26, note: '+ bullet item / receipt line appears' },
  pop: { ids: ['pop', 'pop-9', 'pop-4'], db: -25, note: 'icon / logo / prop pops in; rotate, never repeat' },
  cascade: { ids: ['pop-9', 'pop-4', 'pop'], db: -29, note: 'a pop on every 2nd item, fading 6 dB across the run (count 4, spacing 0.067 s)' },
  bubble: { ids: ['bubble'], db: -24, note: 'speech-bubble comment / chat message' },
  'card-in': { ids: ['woosh-short', 'soft-hit'], db: -25, note: 'big card / phone / browser enters: woosh peaks on arrival + soft landing' },
  'slide-out': { ids: ['woosh-tight'], db: -30, note: 'an element leaves, is struck or shatters' },
  scene: { ids: ['air-cut', 'woosh-tight', 'woosh-short'], db: -25, note: 'topic change: alternate air-cut / woosh-tight (ce-01 rotated three)' },
  'hard-hit': { ids: ['punch', 'soft-hit'], db: -21, note: 'hook slam, biggest claim; max 2 a video (soft-hit as a lighter variant)' },
  stat: { ids: ['chime'], db: -27, note: 'a number lands / a look is picked / a lock' },
  notify: { ids: ['notify'], db: -30, note: 'notification / message / "comment" moment / export done' },
  accent: { ids: ['drop'], db: -27, note: 'small surprise accent, sparing' },
  'click-ui': { ids: ['mouse'], db: -27, note: 'cursor clicks something inside a UI' },
  code: { ids: ['fast-typing'], db: -34, note: 'typing inside a box / terminal (<= 1.2 s)' },
  'ui-reveal': { ids: ['ui-riser'], db: -32, note: 'owner removed the UI riser: do not use' },
  build: { ids: ['riser-short', 'riser'], db: -30, note: 'riser: COMPLETE, ends exactly on the cut / the hit; 1-2 a video; never early' },
  'big-build': { ids: ['riser'], db: -30, note: 'full 3 s build into the CTA; once a video' },
  cta: { ids: ['drop-splash'], db: -28, note: 'comment keyword / lead magnet lands' },
  thud: { ids: ['soft-hit'], db: -22, note: 'a heavy print lands, a shard thud' },
} as const;
export type EventName = keyof typeof EVENT_SOUNDS;

/** Mix rules worth keeping next to the numbers (laws 9). */
export const SOUND_RULES = {
  masterLufs: -14, lufsTol: 0.5, truePeakDb: -1,
  sfxPerSec: [2, 3.5] as const,
  maxRisers: 2,
  maxHardHits: 2,
  bedUnderVoiceLu: 3, // owner 2026-10-11 (was 8 -> 5 -> 3)
  sfxStemLiftDb: 6,
  variationDb: 1,
} as const;
