import type { SfxRef } from './spec';
import { SCENE_MOTION, TIMING } from './tokens';

/**
 * Scene entries, exits and cuts. Style 1 has no fades and few hard cuts: a scene change is elements leaving and arriving
 * on the same stage, with the next scene sliding in on an exponential settle. Numbers from s1kit.finish()
 * (enter tau 7.5 / arrive +24 f / exit 10 f), style1-timeline (zoom, keys) and the bespoke builds.
 */

export type TransitionKind = 'slide' | 'zoom' | 'reveal' | 'cut' | 'morph' | 'object';

export interface TransitionDef {
  id: string;
  kind: TransitionKind;
  use: string;
  /** Scene `enter` for slides: the layout shifts `from` px along `axis` and settles. */
  enter?: { axis: 'x' | 'y'; from: number; tau: number; arrive: number };
  /** The outgoing scene leans toward the incoming one by `to` px over `frames` (cubic ease-in). */
  exit?: { to: number; frames: number };
  /** Camera scale at the cut frame (kit `push`). */
  push?: number;
  /** Frames (at 30 fps) the whole move takes, where it has a length. */
  frames: number | null;
  easing: string;
  sfx: readonly SfxRef[];
  source: string;
}

const air = 'air-cut', tight = 'woosh-tight', short = 'woosh-short';
const A = SCENE_MOTION.enter;

/** The slide table (kit AXIS): up = y 300, down = y -300, left = x 500, right = x -500. */
export const SLIDES = {
  up: { axis: 'y', from: A.upFrom },
  down: { axis: 'y', from: A.downFrom },
  left: { axis: 'x', from: A.leftFrom },
  right: { axis: 'x', from: A.rightFrom },
} as const;
export type SlideName = keyof typeof SLIDES;

const slide = (dir: SlideName, use: string): TransitionDef => ({
  id: `slide-${dir}`, kind: 'slide', use,
  enter: { ...SLIDES[dir], tau: A.tau, arrive: A.arrive },
  exit: { to: SCENE_MOTION.exit.to, frames: SCENE_MOTION.exit.frames },
  push: 1.05, frames: A.arrive, easing: 'exponential settle, normalised to land on frame f0 + 24; exit u^3',
  sfx: [{ id: air, event: 'scene' }], source: 's1kit._scene/finish, port assemble AXIS',
});

export const TRANSITIONS = {
  'slide-up': slide('up', 'DEFAULT cut: the next scene rises 300 px and settles. Hook to proof, any topic change.'),
  'slide-down': slide('down', 'The next scene drops in from above (-300): a payoff or a "back to" beat.'),
  'slide-left': slide('left', 'List and step scenes: content arrives from the right (500) like the words do (elastic).'),
  'slide-right': slide('right', 'The next scene arrives from the left (-500): stack_slam and the grid scenes.'),
  'slide-wide': {
    id: 'slide-wide', kind: 'slide', use: 'ce-01 era: longer travel (380-520 px), tau 7.0, 9-frame exit. A looser, slower hand-off.',
    enter: { axis: 'x', from: 380, tau: SCENE_MOTION.legacy.tau, arrive: SCENE_MOTION.legacy.arrive }, exit: { to: 200, frames: SCENE_MOTION.legacy.exitFrames },
    push: 1.0, frames: 24, easing: 'exponential settle', sfx: [{ id: tight, event: 'scene' }], source: 'ce-01-viral-captions build.py',
  },
  'zoom-out-open': {
    id: 'zoom-out-open', kind: 'zoom', use: 'The very first shot: camera starts zoomed in (about 3x, refs ~6x) and eases out with a slow tail. Opening only.',
    push: 4.0, frames: 32, easing: 'zoom {a: 3.0, tau: 0.12 s, b: 0.12, tau2: 0.9 s}: scale = 1 + a e^(-t/tau) + b e^(-t/tau2)',
    sfx: [{ id: 'soft-hit', event: 'hard-hit', offset: 1 }], source: 'ce-01 build.py (zoom), SKILL §0 "Opening: zoom-out from ~6x"',
  },
  'push-through': {
    id: 'push-through', kind: 'zoom', use: 'Camera pushes in during a scene and lands on 1.0 right at the next cut, so each cut starts from rest: the default for every scene without camera keys.',
    push: 1.05, frames: null, easing: 'scale push -> 1.0, centre y +20, in-out in log space', sfx: [{ id: air, event: 'scene' }], source: 's1kit._scene (push 1.04-1.1)',
  },
  'pull-out-reveal': {
    id: 'pull-out-reveal', kind: 'reveal', use: 'Open full-bleed on a clip that is secretly a pane inside a captured UI; hold, then one long pull-out reveals the browser. The signature "this is the editor" move.',
    frames: 72, easing: 'camera keys [0 fill, pull-3 fill*1.035, reveal+24 1.0]; titles fade 4 frames before the pull',
    sfx: [{ id: air, event: 'scene', offset: -3 }, { id: 'soft-hit', event: 'hard-hit', offset: 22 }], source: 's1kit.reveal, ce-03-not-after-effects, ce-06-sab-chhod-ke',
  },
  'hard-cut-on-beat': {
    id: 'hard-cut-on-beat', kind: 'cut', use: 'No slide: a hard cut on a laugh / sound / reaction, with a slam already mid-entry on the cut frame. Use once, at a comic turn.',
    push: 1.0, frames: 0, easing: 'none', sfx: [{ id: 'punch', event: 'hard-hit' }], source: 'ce-05-ullu-ban-gaye (owl slam)',
  },
  'riser-into-cut': {
    id: 'riser-into-cut', kind: 'cut', use: 'A complete riser ends exactly on the cut / the slam it builds to. 1-2 a video, never on every cut, never early, never cut short.',
    frames: 90, easing: 'riser ends on t', sfx: [{ id: 'riser-short', event: 'build' }, { id: 'punch', event: 'hard-hit' }], source: 'SKILL §0 Sound, ce-06 / ce-08 / ce-11',
  },
  'glide-out-before-cut': {
    id: 'glide-out-before-cut', kind: 'object', use: 'Not a scene move but what makes cuts feel travelled: every phone/card/prop glides out 10 frames before the cut (polish), so the cut lands on a near-empty stage that the next entry fills.',
    frames: TIMING.exitBeforeCut, easing: 'cubic-bezier(0.7,0,0.84,0)', sfx: [{ id: tight, event: 'slide-out' }], source: 's1kit.polish',
  },
  'shatter-out': {
    id: 'shatter-out', kind: 'object', use: 'Rejected things leave by shattering on their word (rows, trial cards, price tags, a Skip pill).',
    frames: 34, easing: 'gravity', sfx: [{ id: 'soft-hit', event: 'thud' }, { id: tight, event: 'slide-out', offset: 3 }], source: 'ce-05, ce-06-haiku, ce-11',
  },
  'collapse-to-point': {
    id: 'collapse-to-point', kind: 'object', use: 'A busy UI (editing timeline) is pulled into one point and leaves; the product icon lands where it was. "Everything collapses into the product."',
    frames: 12, easing: 'in-out', sfx: [{ id: tight, event: 'slide-out' }, { id: 'punch', event: 'hard-hit', offset: 12 }], source: 'ce-09-raat-ke-2-baje (nle collapseAt)',
  },
  'search-to-site': {
    id: 'search-to-site', kind: 'morph', use: 'A search bar types the brand and GROWS into the real site window (morph rect + page).',
    frames: 16, easing: 'in-out', sfx: [{ id: 'fast-typing', event: 'code' }, { id: 'notify', event: 'notify', offset: 16 }], source: 'ce-02-open-source (search.morph)',
  },
  'page-dissolve': {
    id: 'page-dissolve', kind: 'morph', use: 'Inside a browser window the page changes (navigation): a 4-frame dissolve between captures.',
    frames: 4, easing: 'linear', sfx: [{ id: 'notify', event: 'notify' }], source: 'style1-timeline browser.pages, ce-02',
  },
  'line-swap': {
    id: 'line-swap', kind: 'morph', use: 'A text group is replaced in place: the old lines fade over 5 frames as the next group rises on the same top.',
    frames: 5, easing: 'linear', sfx: [], source: 'line.out, ce-11 dict/rule scenes',
  },
} as const satisfies Record<string, TransitionDef>;

export type TransitionId = keyof typeof TRANSITIONS;
export const TRANSITION_IDS = Object.keys(TRANSITIONS) as TransitionId[];

/** Which slide a preset's scene uses (kit presets: lines/trio/export_proof/cta = up, list_left = left, stack_slam/grid4 = right). */
export const PRESET_SLIDE: Record<string, SlideName | 'none'> = {
  lines: 'up', logo_land: 'up', icon_ring: 'up', logo_grid: 'up', trio: 'up', export_proof: 'up', cta_comment: 'up', cta_pill: 'up',
  list_left: 'left', stack_slam: 'right', grid4: 'right', reveal: 'none',
};

/** Rotating cut sounds (finish(): i % 2; ce-01: three). Never the same one twice in a row. */
export const CUT_SOUNDS = [air, tight, short] as const;
export const cutSound = (i: number, kit = true) => CUT_SOUNDS[i % (kit ? 2 : 3)]!;

/** Scene-layout offset at frame `f` after the cut (finish(): exponential settle normalised to land on `arrive`). */
export function enterOffset(f: number, e: { from: number; tau: number; arrive: number }): number {
  if (f >= e.arrive) return 0;
  const a = Math.exp(-f / e.tau), b = Math.exp(-e.arrive / e.tau);
  return e.from * ((a - b) / (1 - b));
}

/** Outgoing offset at frame `f` of a scene that ends at `f1` (cubic ease-in over the last `frames`). */
export function exitOffset(f: number, f1: number, x: { to: number; frames: number }): number {
  const u = Math.max(0, Math.min(1, (f - (f1 - x.frames)) / x.frames));
  return x.to * u * u * u;
}

/** The exit for a scene given the next scene's enter (finish(): toward the incoming one, to = +-220, 10 frames). */
export const exitFor = (next: { from: number } | null) => (next ? { to: (next.from > 0 ? -1 : 1) * SCENE_MOTION.exit.to, frames: SCENE_MOTION.exit.frames } : null);
