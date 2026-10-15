import { EASE, FPS, TIMING } from './tokens';
import { cubicBezier } from './effects';
import type { SfxRef } from './spec';

/**
 * Camera moves. A scene's camera is a list of keys `[frame, scale, cx, cy, roll?]`: the layout point (cx, cy) sits at the frame
 * centre at `scale`, eased in log space on the in-out curve between keys. After the last key the camera keeps creeping in
 * (never a dead stop). Every scene moves (law 8). Numbers: s1kit presets (push), bespoke builds (_keys), style1-timeline.
 */

/** [frame, scale, cx, cy, roll degrees]. Frames are absolute in the film. */
export type CamKey = readonly [number, number, number, number, number?];

/** Renderer behaviour after the last key: scale *= 1 + creep * seconds. */
export const CAMERA = {
  creepPerSec: 0.025,
  /** Default end key of a pushed scene: back to rest, centre y +20 (kit [f1, 1.0, 540, 980]). */
  rest: { scale: 1.0, cx: 540, cy: 980 },
  start: { cx: 540, cy: 960 },
  /** Max safe push with headlines up top: > 1.06 drives text into the corner logo (SKILL ce-10/11 note). */
  maxPushWithHeadline: 1.06,
  /** Roll is a few tenths to one degree, always settling to 0. */
  rollDeg: [0.5, 1.2] as const,
  ease: EASE.inOut,
} as const;

/** Push scale at the cut by kit preset (s1kit `push=`). */
export const PUSH_BY_PRESET: Record<string, number> = {
  lines: 1.05, list_left: 1.04, stack_slam: 1.05, logo_land: 1.1, icon_ring: 1.04, logo_grid: 1.05, trio: 1.05, grid4: 1.1,
  export_proof: 1.05, cta_comment: 1.05, cta_pill: 1.05, reveal: 1.0,
};

export interface CameraPreset {
  id: string;
  use: string;
  /** Typical key list for a 90-frame scene at (cx, cy) = (540, 960) - see `cameraKeys`. */
  scales: readonly number[];
  roll: readonly number[];
  sfx: readonly SfxRef[];
  source: string;
}

export const CAMERA_PRESETS = {
  'push-in': {
    id: 'push-in', use: 'DEFAULT: start at 1.04-1.1, ease to 1.0 by the next cut. Slow and felt, never a static frame.',
    scales: [1.05, 1.0], roll: [0, 0], sfx: [], source: 's1kit._scene, PUSH_BY_PRESET',
  },
  'roll-settle': {
    id: 'roll-settle', use: 'Scene opens a touch tight with a -1 degree roll that straightens as it settles to 1.0 (cinematic hand-held feel). Opening shot of a story beat.',
    scales: [1.1, 1.0], roll: [-1.0, 0], sfx: [], source: 'ce-08 / ce-09 scene 1 (_keys [0, 1.1..1.18, ..., -1.0] -> [.., 1.0, ..., 0])',
  },
  'roll-punch': {
    id: 'roll-punch', use: 'Three keys: enter slightly rolled at 1.04, punch in to 1.07 on the key word, ease to 1.02 into the next cut. The ce-11 pattern for explainer scenes.',
    scales: [1.04, 1.07, 1.02], roll: [0.6, 0, 0], sfx: [], source: 'ce-11-hormozi-style _keys',
  },
  'punch-in': {
    id: 'punch-in', use: 'A short push 1.00 -> 1.05-1.07 landing on a spoken key word, with the framing nudged toward the object (cx -20, cy +40).',
    scales: [1.0, 1.06, 1.02], roll: [0, 0, 0], sfx: [{ id: 'soft-hit', event: 'hard-hit' }], source: 'ce-08 (loupe), ce-11 (eye / dict)',
  },
  'pull-out': {
    id: 'pull-out', use: 'Starts tight (1.1-1.18) on the hero and pulls back to 1.0 as the line lands; reveals the surrounding UI or the second half of a gag.',
    scales: [1.18, 1.0], roll: [-1.0, 0], sfx: [{ id: 'air-cut', event: 'scene' }], source: 'ce-09 scene 1 (1.18 at the phone, centre 420,1120)',
  },
  'dive-to-detail': {
    id: 'dive-to-detail', use: 'Camera dives onto a detail inside a capture (GitHub repo name, a number) and a highlighter sweeps it. Aim cx/cy at the detail.',
    scales: [1.0, 1.9], roll: [0, 0], sfx: [{ id: 'chime', event: 'stat' }], source: 'SKILL §0 Direction (ce-02), ce-02 camera keys',
  },
  'reveal-pull': {
    id: 'reveal-pull', use: 'Full-bleed on a pane (scale = fill), tiny 3.5 % push while the titles fade, then a long pull to 1.0 on the reveal word.',
    scales: [1.0, 1.035, 1.0], roll: [0, 0, 0], sfx: [{ id: 'air-cut', event: 'scene', offset: -3 }], source: 's1kit.reveal',
  },
  'opening-zoom-out': {
    id: 'opening-zoom-out', use: 'Frame 0: very tight (3x in builds, ~6x in refs) with a slow tail; the stage reveals around the hook.',
    scales: [4.0, 1.0], roll: [0, 0], sfx: [{ id: 'soft-hit', event: 'hard-hit', offset: 1 }], source: 'ce-01 zoom {a:3.0,tau:.12,b:.12,tau2:.9}',
  },
} as const satisfies Record<string, CameraPreset>;
export type CameraPresetId = keyof typeof CAMERA_PRESETS;

/** The default push: [f0, push] -> [f1, 1.0]. */
export function pushKeys(f0: number, f1: number, push = 1.05): CamKey[] {
  return [[f0, push, CAMERA.start.cx, CAMERA.start.cy], [f1, CAMERA.rest.scale, CAMERA.rest.cx, CAMERA.rest.cy]];
}

/** Roll-and-settle: opens at `scale` rolled by `rollDeg`, straightens to 1.0 by `settleF` and holds to the next cut. */
export function rollSettleKeys(f0: number, settleF: number, cx = 540, cy = 960, scale = 1.1, rollDeg = -1.0): CamKey[] {
  return [[f0, scale, cx, cy, rollDeg], [settleF, 1.0, 540, 960, 0]];
}

/** The ce-11 pattern: start slightly rolled, punch in on the key word, ease into the next cut. */
export function rollPunchKeys(f0: number, keyF: number, nextCut: number, o: { start?: number; punch?: number; end?: number; roll?: number; at?: [number, number] } = {}): CamKey[] {
  const [px, py] = o.at ?? [540, 1040];
  return [[f0, o.start ?? 1.04, 540, 1000, o.roll ?? 0.6], [keyF, o.punch ?? 1.07, px, py, 0], [nextCut, o.end ?? 1.02, 540, 980, 0]];
}

/** Punch-in on a spoken word: rest -> punch at `keyF` aiming at (cx, cy) -> ease out by `endF`. */
export function punchKeys(f0: number, keyF: number, endF: number, cx = 520, cy = 1040, punch = 1.06): CamKey[] {
  return [[f0, 1.0, 540, 960], [keyF, Math.min(punch, 1.08), cx, cy], [endF, 1.02, 540, 980]];
}

/** Dive to a detail: wide on the capture, then into (cx, cy) at `scale` by `diveF`, hold until `endF`. */
export function diveKeys(f0: number, diveF: number, endF: number, cx: number, cy: number, scale = 1.9): CamKey[] {
  return [[f0, 1.0, 540, 960], [diveF, scale, cx, cy], [endF, scale, cx, cy]];
}

/** Reveal pull: fill the frame with a pane, creep 3.5 % until `pullF - 3`, then pull to 1.0 by `revealF + 24`. */
export function revealKeys(pane: { cx: number; cy: number; fill: number }, pullF: number, revealF: number, frame = { w: 1080, h: 1920 }): CamKey[] {
  return [[0, pane.fill, pane.cx, pane.cy], [pullF - 3, pane.fill * 1.035, pane.cx, pane.cy], [revealF + 24, 1.0, frame.w / 2, frame.h * (900 / 1920)]];
}

/** The fill scale of a pane that should cover the frame: max(W / pw, H / ph) * 1.01. */
export const fillScale = (pw: number, ph: number, frame = { w: 1080, h: 1920 }) => Math.max(frame.w / pw, frame.h / ph) * 1.01;

/** Opening zoom-out (scene.zoom): scale = 1 + a e^(-t/tau) + b e^(-t/tau2), t in seconds. */
export const OPENING_ZOOM = { a: 3.0, tau: 0.12, b: 0.12, tau2: 0.9 } as const;
export const openingScale = (t: number, z: { a: number; tau: number; b?: number; tau2?: number } = OPENING_ZOOM) => 1 + z.a * Math.exp(-t / z.tau) + (z.b ?? 0) * Math.exp(-t / (z.tau2 ?? 1));

/** Evaluate keys at frame `f` as the renderer does (log-space scale, in-out ease, creep after the last key). */
export function cameraAt(keys: readonly CamKey[], f: number, fps = FPS): { scale: number; cx: number; cy: number; roll: number } {
  if (!keys.length) return { scale: 1, cx: 540, cy: 960, roll: 0 };
  const e = CAMERA.ease, ease = cubicBezier(e[0], e[1], e[2], e[3]);
  let i = 0;
  while (i < keys.length - 1 && f >= keys[i + 1]![0]) i++;
  const a = keys[i]!, b = keys[Math.min(i + 1, keys.length - 1)]!;
  const u = f <= a[0] ? 0 : b[0] > a[0] ? ease(Math.min(1, (f - a[0]) / (b[0] - a[0]))) : 1;
  const last = keys[keys.length - 1]!, after = f > last[0] ? (f - last[0]) / fps : 0;
  return {
    scale: Math.exp(Math.log(a[1]) + (Math.log(b[1]) - Math.log(a[1])) * u) * (1 + CAMERA.creepPerSec * after),
    cx: a[2] + (b[2] - a[2]) * u, cy: a[3] + (b[3] - a[3]) * u,
    roll: (a[4] ?? 0) + ((b[4] ?? 0) - (a[4] ?? 0)) * u,
  };
}

/** Lint a key list: every scene moves, nothing over the headline-safe push, rolls stay small. Returns problems. */
export function lintCamera(keys: readonly CamKey[], headlineUp = true): string[] {
  const out: string[] = [];
  if (!keys.length) return ['no camera keys: every scene must move'];
  const moves = keys.some(k => k[1] !== keys[0]![1] || k[2] !== keys[0]![2] || k[3] !== keys[0]![3]);
  if (!moves && keys.length < 2) out.push('camera never moves (add a second key)');
  if (headlineUp && keys.some(k => k[1] > CAMERA.maxPushWithHeadline && k[1] < 1.5)) out.push(`push over ${CAMERA.maxPushWithHeadline} with a headline up top can drive text into the corner logo`);
  if (keys.some(k => Math.abs(k[4] ?? 0) > 2)) out.push('roll over 2 degrees');
  return out;
}

/** One sound stays with the camera move when it is a cut-like pull; everything else is silent. */
export const CAMERA_TIMING = { leadFrames: TIMING.sceneLead } as const;
