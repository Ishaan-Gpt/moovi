import { EASES, REST, cam, clamp01, frame2d, type CamState, type EaseId } from './core';
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
  return r.m.at(base, EASES[r.ease](u), { a: r.a, k: r.k, t: tt, u, dur: r.duration, seed: r.seed });
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

// ── the gen-AI side of the same keyword ──

const EASE_WORDS: Record<EaseId, string> = {
  linear: 'at one constant rate',
  'ramp-up': 'starting slow and accelerating (ramp up)',
  'ramp-down': 'starting quick and easing to a gentle stop (ramp down)',
  smooth: 'easing in and out',
  snap: 'hitting fast and stopping dead',
  whip: 'with a sudden, blurred middle',
};

/**
 * The generative-video prompt for a call (Kling, Runway, Veo, Seedance, Higgsfield, ...): the camera instruction only,
 * kept apart from the scene so it can be pasted next to any first frame. Speed and size follow the call's parameters.
 */
export function promptFor(call: CameraCall): string {
  const r = resolveCall(call), p = r.m.prompt;
  const size = r.k < 0.75 ? 'subtle, ' : r.k > 1.3 ? 'pronounced, ' : '';
  const full = r.m.family === 'orbit' && r.a >= 300 ? ', a full 360-degree circle' : '';
  const speed = r.ease === r.m.defaults.ease ? p.speed : `${p.speed}, ${EASE_WORDS[r.ease]}`;
  return `Camera: ${size}${p.name}${full}. Movement: ${p.motion}. Speed: ${speed}, about ${+r.duration.toFixed(1)} s. Framing: ${p.framing}. End: ${p.end}.`;
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

/** A compact menu of every move for a director model's prompt (small models included): one line each. */
export function cameraMenu(moves: readonly CameraMove[] = CAMERA_MOVES): string {
  return moves.map(m => `${m.id}: ${m.use}`).join('\n');
}
