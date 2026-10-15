import { params, defaults, type Params, type SfxRef } from './spec';
import { EASE, FPS, MOTION_BLUR, PROP_COLORS, SCENE_MOTION, SPRINGS, TIMING, WORD_MOTION, type EaseName, type SpringName } from './tokens';

/**
 * Every effect Style 1 actually uses: id, params with defaults, duration (frames at 30 fps), easing, the paired sound
 * and a short "use when". Numbers come from the renderer (MotionEasy style1-timeline.ts), the props file and s1kit.polish().
 * Edit a default here and `EFFECT_DEFAULTS[id]` / `applyEffect()` pick it up. Nothing here shakes the frame: Style 1
 * moves by springs, glides and camera roll, never by random shake.
 */

export type EffectGroup = 'word' | 'object' | 'accent' | 'draw' | 'stage' | 'exit';

export interface EffectDef {
  id: string;
  group: EffectGroup;
  /** Plain-language "use it when". */
  use: string;
  params: Params;
  /** Frames at 30 fps; null = open-ended (idle loops, time-driven). */
  frames: number | null;
  /** Named bezier (tokens.EASE), spring (tokens.SPRINGS) or a formula tag. */
  easing: { bezier: EaseName } | { spring: SpringName } | { formula: string };
  sfx: SfxRef | null;
  /** Layer key(s) that switch it on in a scene program / timeline. */
  layerKey: string;
  source: string;
}

const out = { bezier: 'out' } as const;
const inOut = { bezier: 'inOut' } as const;

export const EFFECTS = {
  // ── words ────────────────────────────────────────────────────────────────────────────────────────────────
  'word-rise': {
    id: 'word-rise', group: 'word', use: 'Centred lines: each word rises from below inside its own masked box with a small overshoot. The default entry.',
    params: params({ frames: [WORD_MOTION.rise.frames, 'frames'], offset: [WORD_MOTION.rise.offset, 'x', 'start depth, in word heights'], mask: true }),
    frames: WORD_MOTION.rise.frames, easing: { bezier: 'outBack' }, sfx: { id: 'typing', event: 'word' }, layerKey: 'line.motion="rise"', source: 'style1-timeline drawLine, SKILL §0 Direction',
  },
  'word-elastic': {
    id: 'word-elastic', group: 'word', use: 'Left-aligned lists: each word comes in from the right with a damped overshoot (about 25 %).',
    params: params({ decay: [WORD_MOTION.elastic.decay, 'x', 'exp(-decay*s)'], freq: [WORD_MOTION.elastic.freq, 'x', 'cos(freq*s)'], slide: [60, 'px', 'kit slide; min size*1.1'], alphaFrames: [5, 'frames'] }),
    frames: 18, easing: { formula: 'k = 1 - exp(-5.5 s) cos(12.5 s)' }, sfx: { id: 'typing', event: 'word' }, layerKey: 'line.motion="elastic"', source: 'style1-timeline drawLine',
  },
  'word-slam': {
    id: 'word-slam', group: 'word', use: 'ONE hero word per scene: scales in from 1.22x with a hard-hit; later words grow away from the previous word. The accent line and the hook claim.',
    params: params({ frames: [WORD_MOTION.slam.frames, 'frames'], from: [WORD_MOTION.slam.from, 'x'], rippleAmp: WORD_MOTION.slam.ripple.amp, rippleDecay: WORD_MOTION.slam.ripple.decay, rippleFreq: WORD_MOTION.slam.ripple.freq, instant: true, sparks: false }),
    frames: WORD_MOTION.slam.frames, easing: out, sfx: { id: 'punch', event: 'hard-hit' }, layerKey: 'line.motion="slam"', source: 'style1-timeline drawLine, SKILL §0',
  },
  'word-slide': {
    id: 'word-slide', group: 'word', use: 'The old soft x-slide: a few px into place. Reference-clone look (Roboto refs).',
    params: params({ frames: [WORD_MOTION.slide.frames, 'frames'], slide: [24, 'px'], alphaFrames: [WORD_MOTION.slide.alphaFrames, 'frames'] }),
    frames: WORD_MOTION.slide.frames, easing: out, sfx: { id: 'typing', event: 'word' }, layerKey: 'line.motion="slide"', source: 'style1-timeline drawLine',
  },
  'grey-to-ink': {
    id: 'grey-to-ink', group: 'word', use: 'Every non-instant word: lands light grey, holds, then turns ink. Read-along karaoke without a highlight colour.',
    params: params({ reveal: [7, 'frames', 'kit uses 6'], hold: [12, 'frames', 'kit uses 6'], from: '#BEBEBE', ease: 'inOut' }),
    frames: 19, easing: inOut, sfx: null, layerKey: 'line.reveal / line.hold / line.grey', source: 'style1-timeline drawLine, SKILL §3 (6-8 frames confirmed)',
  },
  'dim-back': {
    id: 'dim-back', group: 'word', use: 'A stacked list: the earlier line steps back to stone grey when the next line starts, so focus travels down.',
    params: params({ frames: [10, 'frames'], to: '#BDB9AA', alphaDrop: 0.62 }),
    frames: 10, easing: inOut, sfx: null, layerKey: 'line.dim (frame) / dim:"next"', source: 'style1-timeline drawLine, s1kit.finish dims',
  },
  'line-out': {
    id: 'line-out', group: 'exit', use: 'A later text group replaces this one on the same spot: fade over 5 frames.',
    params: params({ frames: [5, 'frames'] }), frames: 5, easing: { formula: 'linear' }, sfx: null, layerKey: 'line.out', source: 'style1-timeline drawLine',
  },
  'count-up': {
    id: 'count-up', group: 'word', use: 'A number word counts up from 0 to its value (e.g. "30+") as it lands; pair with a chime.',
    params: params({ from: 0, frames: [20, 'frames'] }), frames: 20, easing: out, sfx: { id: 'chime', event: 'stat' }, layerKey: 'line.count=[from, frames]', source: 'style1-timeline drawLine (count)',
  },
  'slam-sparks': {
    id: 'slam-sparks', group: 'accent', use: 'Landing sparks around a slammed word or climax line: a ring of 12 four-point sparks over 18 frames.',
    params: params({ count: 12, frames: [18, 'frames'], size: [0.09, 'x', 'of font size'], reach: [0.5, 'x', 'of line width'] }),
    frames: 18, easing: out, sfx: null, layerKey: 'line.sparks', source: 'style1-timeline drawLine (sparks)',
  },
  'gold-shimmer': {
    id: 'gold-shimmer', group: 'accent', use: 'The serif accent line: its gold gradient drifts along the line. Use sparingly on the CTA line.',
    params: params({ speed: [0.4, 'cycles/s'] }), frames: null, easing: { formula: 'linear loop' }, sfx: null, layerKey: 'line.shimmer', source: 'style1-timeline drawLine (shimmer)',
  },
  'bullet-sparkle': {
    id: 'bullet-sparkle', group: 'word', use: 'A four-point "+" sparkle bullet pops beside a list item (v1 lists: Pick a look / Export / Post).',
    params: params({ size: [54, 'px'], spring: 'pop' }), frames: 14, easing: { spring: 'pop' }, sfx: { id: 'ui-blip', event: 'list-item' }, layerKey: 'line.bullet', source: 'style1-timeline drawLine, ce-01',
  },
  'chip-title': {
    id: 'chip-title', group: 'word', use: 'A soft rounded card behind a title that rides over a busy UI capture; pops in with the first word.',
    params: params({ pad: [0.32, 'x', 'of font size'], spring: 'pop', fill: '#FFFFFF' }), frames: 12, easing: { spring: 'pop' }, sfx: null, layerKey: 'line.chip', source: 'style1-timeline drawLine (chip), ce-03',
  },
  'premium-look': {
    id: 'premium-look', group: 'accent', use: 'CaptionsEasy viral looks drawn on type: metal (chrome + lavender glow), neon tube, soft glow. Only when the video is about those looks.',
    params: params({ look: 'metal', glowBlur: [0.3, 'x', 'of size'] }), frames: null, easing: { formula: 'static' }, sfx: null, layerKey: 'line.look = metal | neon | glow', source: 'style1-timeline drawLine',
  },
  'typewriter-box': {
    id: 'typewriter-box', group: 'word', use: 'A pill / field where text types in with a blinking caret (CTA bubble, "Open source", "Free", "0 watermarks").',
    params: params({ perChar: [1.0, 'frames', '0.7-1.6 in builds'], caretBlink: [8, 'frames'], cursorLead: [2, 'frames'] }),
    frames: null, easing: { formula: 'perChar' }, sfx: { id: 'fast-typing', event: 'code' }, layerKey: 'kind:"typebox"', source: 'style1-timeline drawTypeBox, ce-02/08/11',
  },

  // ── objects ──────────────────────────────────────────────────────────────────────────────────────────────
  'glide-in': {
    id: 'glide-in', group: 'object', use: 'DEFAULT entry for phones, cards, props, browser: rise 220 px + scale 0.86 -> 1 + focus-pull blur 12 -> 0 + 6 deg settle on a cubic-bezier. polish() turns pop / rise / slam into this.',
    params: params({ frames: [SCENE_MOTION.glide.inFrames, 'frames'], rise: [220, 'px'], scaleFrom: [0.86, 'x'], blur: [12, 'px'], settleDeg: [6, 'deg'], alphaGain: 2.2 }),
    frames: SCENE_MOTION.glide.inFrames, easing: out, sfx: { id: 'woosh-short', event: 'card-in' }, layerKey: 'image.enter="glide"', source: 'style1-timeline drawImage, SKILL §0 (2026-10-12), s1kit.polish',
  },
  'glide-out': {
    id: 'glide-out', group: 'exit', use: 'Every object leaves 10 frames before its scene cuts: lift 170 px, shrink 10 %, defocus, fade on the ease-in curve.',
    params: params({ frames: [SCENE_MOTION.glide.outFrames, 'frames'], lift: [170, 'px'], shrink: [0.1, 'x'], blur: [10, 'px'], before: [TIMING.exitBeforeCut, 'frames', 'before the cut'] }),
    frames: SCENE_MOTION.glide.outFrames, easing: { bezier: 'in' }, sfx: { id: 'woosh-tight', event: 'slide-out' }, layerKey: 'image.exit (frame)', source: 'style1-timeline drawImage, s1kit.polish',
  },
  'swipe-out': {
    id: 'swipe-out', group: 'exit', use: 'A notification / card swiped away to the right (urgency through real UI, not a clock).',
    params: params({ frames: [10, 'frames'], dist: [900, 'px'], tiltDeg: [9, 'deg'], shrink: [0.03, 'x'], blur: [4, 'px'] }),
    frames: 10, easing: { bezier: 'in' }, sfx: { id: 'woosh-tight', event: 'slide-out' }, layerKey: 'image.exitDir="right"', source: 'style1-timeline drawImage',
  },
  'pop-in': {
    id: 'pop-in', group: 'object', use: 'Small things and logos: scale 0 -> about 110 % -> 100 % on the pop spring; groups cascade every 1-2 frames.',
    params: params({ spring: 'pop', stagger: [TIMING.cascadeStagger, 'frames'], overshoot: [1.1, 'x'] }),
    frames: 8, easing: { spring: 'pop' }, sfx: { id: 'pop', event: 'pop' }, layerKey: 'image.enter="pop"', source: 'style1-timeline drawImage, breakdowns/insiderforce.md (6-8 frames)',
  },
  'slam-in': {
    id: 'slam-in', group: 'object', use: 'An object / sticker / reel card thuds in from 1.4x with a short fade: stamps, notes, the Hormozi-Box sticker.',
    params: params({ from: [1.4, 'x'], seconds: [0.27, 's'], alphaS: [0.07, 's'], rotDeg: -5 }),
    frames: 8, easing: out, sfx: { id: 'soft-hit', event: 'hard-hit' }, layerKey: 'image.enter="slam"', source: 'style1-timeline drawImage',
  },
  'rise-in': {
    id: 'rise-in', group: 'object', use: 'Soft spring up 140 px (no overshoot). The pre-polish entry for cards, looks and the browser.',
    params: params({ spring: 'soft', dist: [140, 'px'], tiltDeg: [4, 'deg', 'optional tilt that settles to rot'], alphaS: [0.12, 's'] }),
    frames: 24, easing: { spring: 'soft' }, sfx: { id: 'woosh-short', event: 'card-in' }, layerKey: 'image.enter="rise"', source: 'style1-timeline drawImage',
  },
  'side-in': {
    id: 'side-in', group: 'object', use: 'Cards slide in from the left or right on the soft spring; pairs of look cards that flank a headline.',
    params: params({ spring: 'soft', dist: [260, 'px'], side: 'left', tiltDeg: [10, 'deg'] }),
    frames: 24, easing: { spring: 'soft' }, sfx: { id: 'woosh-short', event: 'card-in' }, layerKey: 'image.enter="left" | "right"', source: 'style1-timeline drawImage, ce-01/ce-02',
  },
  'idle-float': {
    id: 'idle-float', group: 'object', use: 'Nothing fully stops: after landing, objects drift on 1-2 sine harmonics [amp px, period s, phase rad]. Phones also tighten a contact shadow.',
    params: params({ amp: [6, 'px', '4-10'], period: [3.0, 's', '2.6-3.4'], phase: [0, 'deg'] }),
    frames: null, easing: { formula: 'amp * sin(2*pi*t/period + phase)' }, sfx: null, layerKey: 'image.float', source: 'style1-timeline drawImage, SKILL §4',
  },
  'idle-spin': {
    id: 'idle-spin', group: 'object', use: 'The burst / asterisk and the centre mark turn slowly (deg per second).',
    params: params({ degPerSec: [22, 'deg', 'burst 22-40; centre mark 10'] }), frames: null, easing: { formula: 'linear' }, sfx: null, layerKey: 'image.spin', source: 'style1-timeline drawImage, s1kit.burst',
  },
  'glow-bloom': {
    id: 'glow-bloom', group: 'object', use: 'A colour aura blooms behind a hero phone over 0.5 s and breathes. One per scene.',
    params: params({ color: '#E6C6FF', seconds: [0.5, 's'], radius: [0.85, 'x', 'of the long edge'], breathe: 0.15 }),
    frames: 15, easing: out, sfx: null, layerKey: 'image.glow', source: 'style1-timeline drawImage',
  },
  'burst-behind': {
    id: 'burst-behind', group: 'object', use: 'The style\'s asterisk: a 12-ray soft burst behind a hero (phone, logo, number). Brand burst colour, d 600-1200, pops with the hero word.',
    params: params({ d: [640, 'px', '600-1200'], core: [0.14, 'x'], spin: [22, 'deg'], color: PROP_COLORS.burst }),
    frames: 8, easing: { spring: 'pop' }, sfx: null, layerKey: 'image.draw="asterisk"', source: 's1kit.burst, kit RAYS',
  },
  'tilt-settle': {
    id: 'tilt-settle', group: 'object', use: 'A browser / phone arrives rotated a few degrees and settles flat (cards in browser frames: tilt 4).',
    params: params({ tilt: [4, 'deg'] }), frames: 24, easing: { spring: 'soft' }, sfx: null, layerKey: 'image.tilt', source: 'style1-timeline drawImage',
  },
  'move-along-path': {
    id: 'move-along-path', group: 'object', use: 'An object travels keyed points [frame, x, y] on the in-out curve (file flying to the wall, a paper plane, the loupe).',
    params: params({ ease: 'inOut', alignToPath: false }), frames: null, easing: inOut, sfx: null, layerKey: 'image.path / pathRot', source: 'style1-timeline drawImage',
  },
  'shatter': {
    id: 'shatter', group: 'exit', use: 'Things that get REJECTED shatter: crack at the kill frame, shards fly 2 frames later under gravity, gone after 34 frames. Thud + whoosh. (Owner 2026-10-11: no strike-through slash, no drop out of frame.)',
    params: params({ cols: 3, rows: 4, crackFrames: [2, 'frames'], totalFrames: [MOTION_BLUR.killFrames, 'frames'], impactRing: true }),
    frames: MOTION_BLUR.killFrames, easing: { formula: 'gravity' }, sfx: { id: 'soft-hit', event: 'thud', offset: 0 }, layerKey: 'image.kill + shatter:true', source: 'style1-timeline shatter, SKILL §0 (ce-05)',
  },
  'strike-drop': {
    id: 'strike-drop', group: 'exit', use: 'Older rejection: ink slash corner to corner (5 f), colour drains (8 f), then falls under gravity. Superseded by shatter; keep for logo kills.',
    params: params({ slashFrames: [5, 'frames'], drainFrames: [8, 'frames'], gravity: [2600, 'px/s'], spinDegPerSec2: 70, fadeFrom: [0.25, 's'], fadeTo: [0.5, 's'] }),
    frames: 40, easing: { formula: 'gravity' }, sfx: { id: 'woosh-tight', event: 'slide-out' }, layerKey: 'image.kill (no shatter)', source: 'style1-timeline drawImage (kill), ce-02 competitor logos',
  },
  'cascade-pops': {
    id: 'cascade-pops', group: 'object', use: 'Several cards / logos / phones arrive one every 2 frames with their own rotation and float.',
    params: params({ stagger: [TIMING.cascadeStagger, 'frames'], count: 4, sfxEvery: 2 }), frames: null, easing: { spring: 'pop' }, sfx: { id: 'pop-9', event: 'cascade' }, layerKey: 'image._stagger', source: 's1kit.logo_grid / grid4',
  },

  // ── accents & drawn gestures ─────────────────────────────────────────────────────────────────────────────
  'highlight-sweep': {
    id: 'highlight-sweep', group: 'draw', use: 'A lavender highlighter sweeps across a detail (repo name, headword, proof corner) on its spoken word: the rect grows left to right.',
    params: params({ frames: [9, 'frames'], color: PROP_COLORS.highlighter, radius: [0.18, 'x', 'of height'] }),
    frames: 9, easing: inOut, sfx: { id: 'chime', event: 'stat', offset: 0 }, layerKey: 'kind:"mark"', source: 'style1-timeline drawMark, s1kit.mark_hl',
  },
  'marker-loop': {
    id: 'marker-loop', group: 'draw', use: 'A hand-drawn marker ellipse that overshoots its start, optional arrow and label pill: "this one". Draws over `frames`.',
    params: params({ frames: [10, 'frames'], color: PROP_COLORS.red, width: [10, 'px'], rotRad: -0.06, label: '' }),
    frames: 10, easing: out, sfx: { id: 'drop', event: 'accent' }, layerKey: 'image.draw="marker"', source: 'style1-props marker, ce-10 / ce-12',
  },
  'selection-ring': {
    id: 'selection-ring', group: 'draw', use: 'A glowing lavender ring pops onto a picked card, with a lift. The "picked this one" beat.',
    params: params({ r: [34, 'px'], spring: 'pop', lift: [10, 'px'], scale: [0.08, 'x'] }),
    frames: 12, easing: { spring: 'pop' }, sfx: { id: 'mouse', event: 'click-ui' }, layerKey: 'image.draw="ring" / swatch.selAt', source: 'style1-props ring, swatch, ce-09 / ce-11',
  },
  'focus-lock': {
    id: 'focus-lock', group: 'draw', use: 'Camera focus brackets start wide, snap tight onto a target at lockAt, turn green, "LOCKED" pill.',
    params: params({ lockAt: [12, 'frames', 'after the entry frame'], color: '#22C55E', startScale: [1.6, 'x'], bracket: [0.18, 'x', 'of the short side'], line: [9, 'px'] }), frames: 12, easing: { spring: 'punchy' }, sfx: { id: 'chime', event: 'stat' }, layerKey: 'image.draw="brackets"', source: 'style1-props brackets, ce-11',
  },
  'click-ripple': {
    id: 'click-ripple', group: 'draw', use: 'On a cursor click: press to 82 % for 6 frames and a 16-frame lavender ripple ring.',
    params: params({ press: [0.18, 'x'], frames: [16, 'frames'], color: PROP_COLORS.cursorRipple, ring: [0.6, 'x', 'of cursor size'] }),
    frames: 16, easing: out, sfx: { id: 'mouse', event: 'click-ui', offset: 0 }, layerKey: 'kind:"cursor" keys[3]=1', source: 'style1-timeline drawCursor',
  },
  'cursor-move': {
    id: 'cursor-move', group: 'draw', use: 'A big cursor (110 px, constant on-screen size whatever the camera does) travels keyed points on the in-out curve, entering with outBack over 6 frames.',
    params: params({ size: [110, 'px'], enter: [6, 'frames'], ease: 'inOut' }), frames: null, easing: inOut, sfx: null, layerKey: 'kind:"cursor"', source: 'style1-timeline drawCursor',
  },
  'progress-fill': {
    id: 'progress-fill', group: 'draw', use: 'An honest export pill: lavender fill 0 -> 100 % with a % label, then deep green "Exported" with a punchy settle.',
    params: params({ startDelay: [4, 'frames'], fill: PROP_COLORS.lavenderSoft, done: PROP_COLORS.green, spring: 'pop' }),
    frames: null, easing: inOut, sfx: { id: 'notify', event: 'notify', offset: 0 }, layerKey: 'kind:"progress"', source: 'style1-timeline drawProgress',
  },
  'odometer-total': {
    id: 'odometer-total', group: 'draw', use: 'A receipt TOTAL whose digits spin, then lands (₹0). Paper unrolls line by line first.',
    params: params({ landAt: [0, 'frames', 'frame anchor'], printStep: [80, 'px', 'paper length per print key'] }),
    frames: null, easing: out, sfx: { id: 'fast-typing', event: 'code' }, layerKey: 'image.draw="receipt"', source: 'style1-props receipt, ce-08',
  },
  'stamp-slam': {
    id: 'stamp-slam', group: 'accent', use: 'A rubber stamp (PAID, NO) slams on at an angle (-10..-14 deg) with a thud.',
    params: params({ rotDeg: -12, text: 'PAID', enter: 'slam' }), frames: 8, easing: out, sfx: { id: 'soft-hit', event: 'hard-hit' }, layerKey: 'image.draw="stamp" enter="slam"', source: 'style1-props stamp, ce-06 / ce-08',
  },
  'coin-flip': {
    id: 'coin-flip', group: 'accent', use: 'A 3D gold coin flips (6 flips) and lands face-up on the number: "free", ₹0.',
    params: params({ flips: 6, landAt: [0, 'frames', 'frame anchor'] }), frames: null, easing: { formula: 'rotation' }, sfx: { id: 'chime', event: 'stat' }, layerKey: 'image.draw="coin"', source: 'style1-props coin, ce-06 v2 / ce-08',
  },
  'shine-sweep': {
    id: 'shine-sweep', group: 'accent', use: 'One glass glare sweeps over a stamped seal or a landing phone (the proof moment).',
    params: params({ from: [8, 'frames'], to: [26, 'frames'], angleRad: 0.5, passes: 1 }), frames: 18, easing: out, sfx: null, layerKey: 'image.draw="seal"', source: 'style1-props seal, drawn phone glare',
  },
  'spark-ring': {
    id: 'spark-ring', group: 'accent', use: 'A spark ring bursts on a save / pick (bookmark fills, "Saved" pill).',
    params: params({ spring: 'pop' }), frames: 12, easing: { spring: 'pop' }, sfx: { id: 'chime', event: 'stat' }, layerKey: 'image.draw="bookmark"', source: 'style1-props bookmark, ce-10',
  },
  'contact-shadow': {
    id: 'contact-shadow', group: 'object', use: 'Every object sits on a desk: big soft shadow to the lower right; phones get a floor blob that breathes with the float. Low-key 3D: bevel, extrusion, glass highlight.',
    params: params({ dx: [0, 'px'], dy: [30, 'px'], blur: [50, 'px'], alpha: 0.28, floorY: [0.53, 'x', 'of height'], floorSquash: 0.16 }),
    frames: null, easing: { formula: 'static' }, sfx: null, layerKey: 'image.shadow', source: 's1kit.phone, style1-timeline drawImage',
  },
  'camera-aware-cursor': {
    id: 'camera-aware-cursor', group: 'draw', use: 'Cursor and caret stay the same on-screen size when the camera pushes (size / scale).',
    params: params({ size: [110, 'px'] }), frames: null, easing: { formula: 'size / camScale' }, sfx: null, layerKey: 'kind:"cursor"', source: 'style1-timeline drawCursor',
  },

  // ── stage ────────────────────────────────────────────────────────────────────────────────────────────────
  'glow-drift': {
    id: 'glow-drift', group: 'stage', use: 'The stage never freezes: three coloured glows drift slowly with light parallax against the camera. Never change the background.',
    params: params({ ampX: [70, 'px'], ampY: [60, 'px'], speedX: 0.35, speedY: 0.28, parallax: 0.1 }), frames: null, easing: { formula: 'sin / cos' }, sfx: null, layerKey: 'backdrop.glows', source: 'style1-timeline drawBackdrop',
  },
  'dot-grid-parallax': {
    id: 'dot-grid-parallax', group: 'stage', use: 'A fine dot grid (90 px, 2.3 px dots) fading to the edges, moving at a quarter of the camera.',
    params: params({ step: [90, 'px'], dot: [2.3, 'px'], parallax: 0.25 }), frames: null, easing: { formula: 'camera * 0.25' }, sfx: null, layerKey: 'backdrop.grid', source: 'style1-timeline drawBackdrop',
  },
  'sparkle-twinkle': {
    id: 'sparkle-twinkle', group: 'stage', use: 'Four tiny four-point sparkles drift and twinkle in the accent colour so the stage never feels empty.',
    params: params({ base: 0.55, depth: 0.45, speed: 1.6 }), frames: null, easing: { formula: 'sin' }, sfx: null, layerKey: 'backdrop.sparkles', source: 'style1-timeline drawBackdrop',
  },
  'corner-assets': {
    id: 'corner-assets', group: 'stage', use: 'Two brand assets sit half off the frame edge (top-left, bottom-right, 350-380 px), rotate in at the start, rotate out at the end, perfectly still between.',
    params: params({ still: true, inFrame: [40, 'frames', 'second corner: 48'], rotInDeg: [-28, 'deg'], size: [370, 'px'] }), frames: 14, easing: out, sfx: null, layerKey: 'backdrop.corners[].still', source: 'SKILL §0 ce-02 v3 (FINAL)',
  },
  'grain-vignette': {
    id: 'grain-vignette', group: 'stage', use: 'Film grain (overlay, 5 %) and a soft warm vignette (9 %) over the stage.',
    params: params({ grain: 0.05, vignette: 0.09 }), frames: null, easing: { formula: 'static' }, sfx: null, layerKey: 'backdrop.grain / vignette', source: 's1kit.finish',
  },
  'motion-blur': {
    id: 'motion-blur', group: 'stage', use: 'Real sub-frame motion blur, only inside fast-move windows (opening, cuts, slams, entries, exits, shatters).',
    params: params({ samples: MOTION_BLUR.samples, shutter: MOTION_BLUR.shutter }), frames: null, easing: { formula: 'sub-frame samples' }, sfx: null, layerKey: 'timeline.mblur', source: 's1kit.polish',
  },
  'clip-grade': {
    id: 'clip-grade', group: 'stage', use: 'A subtle grade on clips only, never a night grade.',
    params: params({ media: 'contrast(1.05) saturate(1.06)' }), frames: null, easing: { formula: 'css filter' }, sfx: null, layerKey: 'timeline.grade.media', source: 's1kit.polish',
  },
} as const satisfies Record<string, EffectDef>;

export type EffectId = keyof typeof EFFECTS;
export const EFFECT_IDS = Object.keys(EFFECTS) as EffectId[];

/** Defaults of every effect as plain objects: `EFFECT_DEFAULTS['glide-in'].rise === 220`. */
export const EFFECT_DEFAULTS = Object.fromEntries(Object.entries(EFFECTS).map(([k, v]) => [k, defaults(v.params)])) as { [K in EffectId]: Record<string, unknown> };

/** Effects by group, for a picker. */
export const effectsBy = (group: EffectGroup) => EFFECT_IDS.filter(id => EFFECTS[id].group === group);

/** Effect defaults with overrides applied (nothing is mutated). */
export function applyEffect<K extends EffectId>(id: K, over: Record<string, unknown> = {}) {
  return { ...EFFECT_DEFAULTS[id], ...over };
}

// ── pure evaluators (same maths as the renderer; handy for previews and tests) ────────────────────────────────

/** CSS cubic-bezier as an easing function of u in [0, 1] (Newton on x). */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const X = (t: number) => ((ax * t + bx) * t + cx) * t, Y = (t: number) => ((ay * t + by) * t + cy) * t;
  return (u: number) => {
    if (u <= 0) return 0;
    if (u >= 1) return 1;
    let t = u;
    for (let i = 0; i < 6; i++) { const d = (3 * ax * t + 2 * bx) * t + cx; if (Math.abs(d) < 1e-6) break; t -= (X(t) - u) / d; }
    return Y(Math.max(0, Math.min(1, t)));
  };
}
export const ease = (name: EaseName) => { const b = EASE[name]!; return cubicBezier(b[0], b[1], b[2], b[3]); };

/** Closed-form damped spring 0 -> 1, t in seconds (engine spring()). */
export function spring(t: number, name: SpringName = 'firm'): number {
  if (t <= 0) return 0;
  const { stiffness: k, damping: c, mass: m } = SPRINGS[name]!;
  const w0 = Math.sqrt(k / m), z = c / (2 * Math.sqrt(k * m));
  if (z < 1) { const wd = w0 * Math.sqrt(1 - z * z); return 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + ((z * w0) / wd) * Math.sin(wd * t)); }
  return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const pr = (f: number, a: number, b: number, e?: (u: number) => number) => { const u = clamp01((f - a) / (b - a)); return e ? e(u) : u; };

/**
 * A word's motion at frame `f` when it starts at `start`. Returns the progress a renderer applies:
 * dy (fraction of the word height, rise), dx (px right, elastic / slide), scale (slam), alpha.
 */
export function wordMotion(kind: 'rise' | 'elastic' | 'slam' | 'slide', f: number, start: number, o: { slide?: number; size?: number } = {}) {
  const s = (f - start) / FPS;
  if (f < start) return { dx: 0, dy: 1, scale: 1, alpha: 0 };
  switch (kind) {
    case 'rise': return { dx: 0, dy: (1 - pr(f, start, start + WORD_MOTION.rise.frames, ease('outBack'))) * WORD_MOTION.rise.offset, scale: 1, alpha: 1 };
    case 'elastic': { const k = 1 - Math.exp(-WORD_MOTION.elastic.decay * s) * Math.cos(WORD_MOTION.elastic.freq * s); return { dx: (1 - k) * Math.max(o.slide ?? 60, (o.size ?? 90) * 1.1), dy: 0, scale: 1, alpha: pr(f, start, start + 5) }; }
    case 'slam': { const k = pr(f, start, start + WORD_MOTION.slam.frames, ease('out')), r = WORD_MOTION.slam.ripple; return { dx: 0, dy: 0, scale: 1 + (WORD_MOTION.slam.from - 1) * (1 - k) + r.amp * Math.exp(-r.decay * s) * Math.sin(r.freq * s), alpha: pr(f, start, start + WORD_MOTION.slam.alphaFrames) }; }
    default: return { dx: (1 - pr(f, start, start + WORD_MOTION.slide.frames, ease('out'))) * (o.slide ?? 24), dy: 0, scale: 1, alpha: pr(f, start, start + WORD_MOTION.slide.alphaFrames) };
  }
}

/** Object glide-in progress (0..1) and glide-out progress at frame f (polish()). Use the pieces the glide-in params describe. */
export function glide(f: number, enterF: number, exitF?: number) {
  const g = EFFECT_DEFAULTS['glide-in'] as { frames: number; rise: number; scaleFrom: number; blur: number; alphaGain: number };
  const o = EFFECT_DEFAULTS['glide-out'] as { frames: number; lift: number; shrink: number; blur: number };
  const gi = ease('out')(pr(f, enterF, enterF + g.frames)), go = exitF === undefined ? 0 : ease('in')(pr(f, exitF, exitF + o.frames));
  return {
    y: (1 - gi) * g.rise - go * o.lift,
    scale: (g.scaleFrom + (1 - g.scaleFrom) * gi) * (1 - o.shrink * go),
    alpha: Math.min(1, gi * g.alphaGain) * (1 - go),
    blur: (1 - gi) * g.blur + go * o.blur,
  };
}

/** Idle float offset (px) of one or more [amp, period s, phase rad] harmonics at time t (s). */
export function floatY(t: number, h: readonly [number, number, number][] | readonly [number, number, number]): number {
  const list = (typeof h[0] === 'number' ? [h as readonly [number, number, number]] : h) as readonly (readonly [number, number, number])[];
  return list.reduce((a, [amp, per, ph]) => a + amp * Math.sin((2 * Math.PI * t) / per + ph), 0);
}
