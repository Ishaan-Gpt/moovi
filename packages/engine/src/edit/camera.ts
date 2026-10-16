import { cameraMenu, cameraMove, editorMoves, resolveCall, toEdlZoom, type CameraCall } from '@moovi/library/camera';
import type { Edl } from './edl';
import type { EdlZoom } from './lib';

/**
 * The editor's camera: every framing change on an uploaded clip is a named move from the camera layer
 * (@moovi/library/camera), so a shot says which move it plays (`shot.camera.asset_ref` = `camera:<move id>`, the same id
 * as the craft graph's camera asset) and its zoom keys are that move sampled by `toEdlZoom`, not hand-built numbers.
 *
 * One shot carries at most two calls: a framing (punch-in / punch-out, the jump-cut grammar, folded into the shot's
 * base framing because it lands on the cut) and one motion move on top of it. A model may pick the motion per sentence
 * from `EDIT_CAMERA_MENU`; without one, the rules below pick it.
 */

/**
 * Edit-scope moves that read on flat, filmed footage: a rack focus needs layers Moovi builds, and a static shot is a dead
 * frame (a model given it picks it for every sentence; a held shot drifts instead), so both are left out.
 */
export const EDIT_MOVES = editorMoves().filter(m => !m.id.startsWith('rack-focus') && m.id !== 'static');
export const EDIT_MOVE_IDS = EDIT_MOVES.map(m => m.id);
/** The menu a model reads when it picks a move per sentence (one line a move). */
export const EDIT_CAMERA_MENU = cameraMenu(EDIT_MOVES);

/** Words that point at something to look at: the shot dives in on them. */
const DETAIL = /^(look|see|notice|check|watch|here's|heres|spot|zoom)$/;

export interface ShotCameraIn {
  /** output seconds */
  t_in: number; t_out: number;
  /** the shot's base framing before any move (the face centre, or the frame centre) */
  base: { scale: number; cx: number; cy: number };
  punch: boolean;
  /** this shot follows a punched one */
  afterPunch: boolean;
  /** the first shot of the film */
  first: boolean;
  punchScale: number; push: number;
  /** the shot's kept words in output time, with roles */
  words: { t: number; text: string; role?: string }[];
  /** output seconds of the last pulse / dive (spacing rules) */
  lastPulse: number; lastDive: number;
  /** a move a model chose for this shot's sentence (an EDIT_MOVE_IDS id) */
  pick?: string;
  /** output frame width / height */
  aspect: number;
}
export interface ShotCameraOut {
  framing: { scale: number; cx: number; cy: number; rot?: number };
  zoom?: (EdlZoom & { rule_id?: string })[];
  camera?: NonNullable<Edl['shots'][number]['camera']>;
  /** the shot is punched in (the next shot releases it) */
  punched: boolean;
  pulsed?: number; dived?: number;
}

const r4 = (x: number) => Math.round(x * 10000) / 10000;

/** The motion move for a shot by rule: a dive on a detail word, a pulse on a number or key word, a drift on a long hold, a settle to open. */
function ruleMotion(i: ShotCameraIn): { call: CameraCall; t: number; rule: string } | null {
  const d = i.t_out - i.t_in, room = (t: number) => i.t_out - t;
  const detail = i.words.find(w => DETAIL.test(w.text.toLowerCase().replace(/[^a-z']/g, '')) && room(w.t) >= 0.8);
  if (detail && detail.t - i.lastDive >= 6 && !i.punch) {
    // a dive stays under 1.4x on filmed footage (the move's own avoid: it goes soft past that)
    return { call: { move: 'dive-in', amount: Math.min(1.35, 1.4 / i.base.scale), duration: Math.min(1.2, room(detail.t)) }, t: detail.t, rule: 'camera.dive_on_detail' };
  }
  const num = i.words.find(w => w.role === 'number' && room(w.t) >= 0.4 && w.t - i.lastPulse >= 1.5);
  if (num) return { call: { move: 'pulse', duration: Math.min(0.6, room(num.t)) }, t: num.t, rule: 'camera.pulse_on_number' };
  if (i.first && d >= 1) return { call: { move: 'roll-settle', duration: Math.min(1, d) }, t: i.t_in, rule: 'camera.settle_to_open' };
  if (d >= 1.6) return { call: { move: 'drift', amount: i.push, duration: d }, t: i.t_in, rule: 'camera.drift_on_hold' };
  const key = i.words.find(w => (w.role === 'key' || w.role === 'title') && room(w.t) >= 0.4 && w.t - i.lastPulse >= 2);
  if (key) return { call: { move: 'pulse', intensity: 0.7, duration: Math.min(0.6, room(key.t)) }, t: key.t, rule: 'camera.pulse_on_key_word' };
  return null;
}

/** A model's pick as a call on this shot (its own duration, clamped to the shot); punch picks only set the framing. */
function pickMotion(i: ShotCameraIn): { call: CameraCall; t: number; rule: string } | null {
  const m = i.pick ? cameraMove(i.pick) : undefined;
  if (!m || !EDIT_MOVE_IDS.includes(m.id) || m.family === 'punch') return null;
  const d = i.t_out - i.t_in, own = resolveCall({ move: m.id }).duration;
  // holds and slow moves fill the shot; quick ones play from its start
  const dur = m.id === 'drift' || m.id === 'static' || own >= d ? d : own;
  return { call: { move: m.id, duration: dur }, t: i.t_in, rule: 'camera.model_pick' };
}

/** Lift a track that would go wider than the frame (a zoom out on cover-cropped footage shows the edge) and keep its centre inside. */
function fitKeys(base: { scale: number; cx: number; cy: number }, keys: EdlZoom[]): { scale: number; cx: number; cy: number } {
  const low = Math.min(base.scale, ...keys.map(k => k.scale)), lift = low < 1 ? 1 / low : 1;
  const c = (x: number) => r4(Math.min(1, Math.max(0, x)));
  for (const k of keys) { k.scale = r4(k.scale * lift); k.cx = c(k.cx); k.cy = c(k.cy); }
  return { scale: r4(base.scale * lift), cx: base.cx, cy: base.cy };
}

/** A shot's framing, zoom keys and named camera move. Pure: the same input gives the same keys. */
export function shotCamera(i: ShotCameraIn): ShotCameraOut {
  const punchPick = i.pick === 'punch-in' ? true : i.pick === 'punch-out' ? false : i.punch;
  const calls: CameraCall[] = [];
  let framing = { ...i.base };
  let frameMove: string | null = null;
  if (punchPick) {
    // the punch lands on the cut: its end state is the shot's framing (no one-frame flash of the wide)
    calls.push({ move: 'punch-in', amount: i.punchScale });
    const k = toEdlZoom([calls[0]!], { framing, source: i.aspect }).at(-1)!;
    framing = { scale: k.scale, cx: framing.cx, cy: framing.cy };
    frameMove = 'punch-in';
  } else if (i.afterPunch) { calls.push({ move: 'punch-out' }); frameMove = 'punch-out'; }
  const mo = pickMotion(i) ?? ruleMotion(i);
  const out: ShotCameraOut = { framing, punched: punchPick };
  if (mo) {
    calls.push(mo.call);
    // quick moves (a pulse, a shake) need 15 keys a second; slow ones (a drift, a Ken Burns) read the same at 6 and keep the EDL small
    const slow = resolveCall(mo.call).duration > 1.5;
    const keys: (EdlZoom & { rule_id?: string })[] = toEdlZoom([mo.call], { t0: r4(mo.t), framing, source: i.aspect, rate: slow ? 6 : 15 });
    out.framing = fitKeys(framing, keys);
    // a move that opens the shot starts from its own first frame (a roll-settle opens tight and rolled, not eased into)
    const k0 = keys[0];
    if (k0 && k0.t <= i.t_in + 1e-3) out.framing = { scale: k0.scale, cx: k0.cx, cy: k0.cy, ...(k0.rot ? { rot: k0.rot } : {}) };
    for (const k of keys) k.rule_id = mo.rule;
    out.zoom = keys;
    if (mo.call.move === 'pulse') out.pulsed = mo.t;
    if (mo.call.move === 'dive-in') out.dived = mo.t;
  }
  const id = mo?.call.move ?? frameMove;
  if (id) {
    const dur = mo ? resolveCall(mo.call).duration : 0;
    out.camera = {
      asset_ref: `camera:${id}`, t: r4(mo?.t ?? i.t_in), ...(dur ? { dur: r4(dur) } : {}),
      params: { calls, ...(frameMove && mo ? { framing: frameMove } : {}) },
      rule_id: mo?.rule ?? (frameMove === 'punch-in' ? 'camera.punch_on_cut' : 'camera.release_on_cut'),
    };
  }
  return out;
}
