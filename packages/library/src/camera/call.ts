import { EASES, REST, cam, clamp01, frame2d, framePoint, type CamState, type EaseId } from './core';
import { CAMERA_MOVES, cameraMove, type CameraMove } from './moves';

/**
 * A camera call is what a director writes: a move id plus optional parameters. Calls play in sequence (each starts where
 * the previous one ended), and every sampler here is a pure function of time.
 */
export interface CameraCall {
  move: string;
  /** seconds (default: the move's own) */
  duration?: number;
  /** easing preset (default: the move's own) */
  ease?: EaseId;
  /** 1 = as catalogued; 0.5 subtle, 1.6 dramatic */
  intensity?: number;
  /** override the move's magnitude in its own unit (degrees for pans/arcs/orbits, a factor for zooms, ...) */
  amount?: number;
  /** seed for handheld noise (default 0) */
  seed?: number;
  /** a point of the frame the move aims at, [x, y] in 0..1 of its width and height (dive, reframe, Ken Burns, punch) */
  at?: readonly [number, number];
  /** frame width / height for `at` (default 9 / 16) */
  aspect?: number;
}

export interface ResolvedCall { m: CameraMove; duration: number; ease: EaseId; k: number; a: number; seed: number }

export function resolveCall(c: CameraCall): ResolvedCall {
  const m = cameraMove(c.move);
  if (!m) throw new Error(`unknown camera move "${c.move}"`);
  const k = c.intensity ?? m.defaults.intensity;
  // factors (unit x) scale in log space, so intensity 2 on a 1.25x zoom is 1.5625x rather than 2.5x
  const a = c.amount ?? (m.amount.unit === 'x' ? m.amount.value ** k : m.amount.value * k);
  return { m, duration: Math.max(0.05, c.duration ?? m.defaults.duration), ease: c.ease ?? m.defaults.ease, k, a, seed: c.seed ?? 0 };
}

/** The camera state `t` seconds into one call (clamped to the call's length), starting from `base`. */
export function cameraAt(call: CameraCall, t: number, base: CamState = REST): CamState {
  const r = resolveCall(call), tt = Math.max(0, Math.min(t, r.duration)), u = clamp01(tt / r.duration);
  const at = framePoint(base, call.at ?? [0.5, 0.5], call.aspect);
  return r.m.at(base, EASES[r.ease](u), { a: r.a, k: r.k, t: tt, u, dur: r.duration, seed: r.seed, at });
}

/** Total length of a sequence of calls, seconds. */
export const trackDuration = (calls: readonly CameraCall[]) => calls.reduce((s, c) => s + resolveCall(c).duration, 0);

/**
 * The camera at time `t` of a sequence: each call starts from the state the previous one ended on. Before 0 it is the
 * base; after the end it holds the last frame.
 */
export function cameraTrack(calls: readonly CameraCall[], t: number, base: CamState = REST): CamState {
  let b = base, start = 0;
  for (let i = 0; i < calls.length; i++) {
    const c = calls[i]!, d = resolveCall(c).duration;
    if (t < start + d || i === calls.length - 1) return cameraAt(c, t - start, b);
    b = cameraAt(c, d, b);
    start += d;
  }
  return cam(base);
}

/**
 * 2D framing at `t` (see `frame2d`) plus a motion-blur hint: how far the frame centre moved over the last frame, in
 * frame heights (whips and crash zooms read through this).
 */
export function frameAt(calls: readonly CameraCall[], t: number, fps = 30, base: CamState = REST) {
  const a = frame2d(cameraTrack(calls, t, base)), b = frame2d(cameraTrack(calls, Math.max(0, t - 1 / fps), base));
  // scale 0 = the plane is behind the camera (pass-through): no blur to report
  if (!(a.scale > 0 && b.scale > 0)) return { ...a, blurX: 0, blurY: 0, blurZoom: 0 };
  return { ...a, blurX: a.cx - b.cx, blurY: a.cy - b.cy, blurZoom: Math.log(a.scale / b.scale) };
}

/** The video editor's framing key (structurally `EdlZoom` in packages/engine/src/edit/lib.ts). */
export interface EdlZoomKey { t: number; scale: number; cx: number; cy: number; ease?: 'out' | 'inout' | 'cut'; dur?: number; /** roll, degrees clockwise (only on keys of a rolled move) */ rot?: number }

/**
 * A camera track as the editor's zoom keys on a shot: sampled `rate` times a second from output time `t0`, each key easing
 * in over one step, so any `edit`-scope move (punch, pulse, dive, Ken Burns, shake, pans as slides) plays in the editor's
 * player unchanged. `framing` is the shot's base framing (source fractions, the editor's default 1 / 0.5 / 0.42);
 * `source` is the source frame's width / height. Assumes scale 1 fits the source height to the output height, as the
 * editor's 9:16 crop does. A rolled move (roll-left/right, roll-settle, shake) carries its roll as `rot` on every key.
 */
export function toEdlZoom(calls: readonly CameraCall[], o: { t0?: number; framing?: { scale: number; cx: number; cy: number }; source?: number; rate?: number } = {}): EdlZoomKey[] {
  const t0 = o.t0 ?? 0, base = o.framing ?? { scale: 1, cx: 0.5, cy: 0.42 }, src = o.source ?? 9 / 16, rate = o.rate ?? 15;
  const total = trackDuration(calls), n = Math.max(1, Math.ceil(total * rate)), step = total / n;
  const keys: EdlZoomKey[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i * step, f = frame2d(cameraTrack(calls, t)), r = calls.length ? resolveCall(calls[Math.min(calls.length - 1, callIndexAt(calls, t))]!) : null;
    const scale = base.scale * (f.scale || 1);
    const cut = r?.ease === 'cut';
    keys.push({ t: +(t0 + t).toFixed(4), scale: +scale.toFixed(4), cx: +(base.cx + (f.cx / base.scale) / src).toFixed(4), cy: +(base.cy + f.cy / base.scale).toFixed(4), ease: cut ? 'cut' : 'inout', dur: cut ? 0 : +step.toFixed(4), rot: +f.roll.toFixed(3) });
  }
  // roll only on the keys of a rolled track (every other move keeps the plain zoom key)
  if (keys.every(k => !k.rot)) for (const k of keys) delete k.rot;
  // drop keys that change nothing (a held punch is one key, not fifteen)
  return keys.filter((k, i) => i === 0 || k.scale !== keys[i - 1]!.scale || k.cx !== keys[i - 1]!.cx || k.cy !== keys[i - 1]!.cy || k.rot !== keys[i - 1]!.rot);
}

function callIndexAt(calls: readonly CameraCall[], t: number): number {
  let s = 0;
  for (let i = 0; i < calls.length; i++) { s += resolveCall(calls[i]!).duration; if (t < s) return i; }
  return calls.length - 1;
}

// ── the gen-AI side of the same keyword ──

const EASE_WORDS: Record<EaseId, string> = {
  linear: 'at one constant rate',
  'ramp-up': 'starting slow and accelerating (ramp up)',
  'ramp-down': 'starting quick and easing to a gentle stop (ramp down)',
  smooth: 'easing in and out',
  snap: 'hitting fast and stopping dead',
  whip: 'with a sudden, blurred middle',
  overshoot: 'landing slightly past the mark and settling back',
  cut: 'as an instant cut, no visible motion',
};

/** "the upper left of the frame" for an aim point, or '' when it is the centre. */
function placeWords(at: readonly [number, number] | undefined): string {
  if (!at) return '';
  const h = at[0] < 0.4 ? 'left' : at[0] > 0.6 ? 'right' : '', v = at[1] < 0.4 ? 'upper' : at[1] > 0.6 ? 'lower' : '';
  return h || v ? ` toward the ${[v, h].filter(Boolean).join(' ') || 'centre'} of the frame` : '';
}

/**
 * The generative-video prompt for a call (Kling, Runway, Veo, Seedance, Higgsfield, ...): the camera instruction only,
 * kept apart from the scene so it can be pasted next to any first frame. Speed and size follow the call's parameters.
 */
export function promptFor(call: CameraCall): string {
  const r = resolveCall(call), p = r.m.prompt;
  const size = r.k < 0.75 ? 'subtle, ' : r.k > 1.3 ? 'pronounced, ' : '';
  const full = r.m.family === 'orbit' && r.a >= 300 ? ', a full 360-degree circle' : '';
  const speed = r.ease === r.m.defaults.ease ? p.speed : `${p.speed}, ${EASE_WORDS[r.ease]}`;
  return `Camera: ${size}${p.name}${full}${placeWords(call.at)}. Movement: ${p.motion}. Speed: ${speed}, about ${+r.duration.toFixed(1)} s. Framing: ${p.framing}. End: ${p.end}.`;
}

/** A whole gen-AI brief: the camera calls (in order), then the scene, kept in separate sections. */
export function buildPrompt(o: { calls: readonly CameraCall[]; subject?: string; setting?: string; action?: string; mood?: string; firstFrame?: string }): string {
  const cams = o.calls.map((c, i) => (o.calls.length > 1 ? `${i + 1}. ` : '') + promptFor(c)).join('\n');
  return [
    'Camera movement:', cams, '',
    'Scene:', `${o.subject ?? 'The main subject'} in ${o.setting ?? 'a clean, well-lit space'}. ${o.action ?? 'The subject keeps its action simple and readable'}.`, '',
    'Look:', `${o.mood ?? 'cinematic and natural, attention on the camera move'}.`, '',
    'Notes:', o.firstFrame ?? 'If a first frame is given, keep its subject, lighting, lens feel and screen direction; change only what the camera movement asks for.',
  ].join('\n');
}

/**
 * A compact menu for a director model's prompt (small models included): one line each. Pass `editorMoves()` for the
 * video editor, `codedMoves()` for coded 3D styles, or the whole list when the target is a gen-AI video model.
 */
export function cameraMenu(moves: readonly CameraMove[] = CAMERA_MOVES): string {
  return moves.map(m => `${m.id}: ${m.use}`).join('\n');
}
