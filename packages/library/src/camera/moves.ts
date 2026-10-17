import { EASES, cam, lerp, lerpLog, len, sub, wobble, type CamState, type EaseId, type Vec3 } from './core';

/**
 * The camera move library: every movement on aicameramovements.com (46 shots in 7 groups, studied 2026-10-16) plus the
 * dolly zoom, each as a code component an AI director can call by keyword. A move is relative to a base state (REST, or
 * where the previous move ended) and is a pure function of eased progress p and seconds t: deterministic, any fps.
 *
 * Shape rules so a flat 2D layout never shows its edge: "in" moves start on the base framing and travel; "out" moves
 * start tight and END on the base framing; lateral moves are centred on it (from -a/2 to +a/2). The exceptions that
 * leave the base on purpose (earth zoom out, infinite zoom, pass-through, the tracking family) say so in `avoid`.
 *
 * Beyond the site: the dolly zoom, and the moves an editor needs that a gen-AI catalogue never lists (the "edit" group:
 * punch-in/out, beat pulse, impact shake, drift, dive and reframe to a point, Ken Burns, roll, roll-settle, rack focus).
 * Every move says where it can play (`scope`) and which camera code already in the repo does the same thing (`existing`).
 */

export type CameraGroup = 'pan-tilt' | 'zoom-lens' | 'dolly-track' | 'physical' | 'drone-crane' | 'human' | 'special' | 'edit';
export type Dir = 'in' | 'out' | 'left' | 'right' | 'up' | 'down' | 'cw' | 'ccw';
/**
 * Where a move can really play:
 * - `edit`: on a flat frame (the video editor's footage, any 2D layout): it is a crop, zoom, slide, roll or blur, so it
 *   maps onto the editor's `{ scale, cx, cy }` framing keys (`toEdlZoom`) and style-1 `CamKey`s.
 * - `coded`: needs depth Moovi builds itself (a layered set in CSS 3D, three.js, the maps renderer): on flat footage it
 *   would only degrade to a zoom or a slide, so the editor should not offer it.
 * - `gen`: needs a world that moves on its own or is filmed from where we cannot go (a walking subject, a car, the sky,
 *   time passing): only a gen-AI video model (or real footage) can give it. Its prompt is still useful.
 */
export type CameraScope = 'edit' | 'coded' | 'gen';

export interface MoveCtx {
  /** the move's magnitude after intensity: `amount.value × intensity`, or the caller's own amount */
  a: number;
  /** intensity multiplier (1 = the move as catalogued) */
  k: number;
  /** seconds since the move started (noise and footsteps run on this, not on eased progress) */
  t: number;
  /** linear progress 0..1 (for moves that pace on their own, such as walking) */
  u: number;
  dur: number;
  seed: number;
  /** the frame point the call aims at (`CameraCall.at`), as a world point on the base's target plane */
  at: Vec3;
}

export interface CameraMove {
  id: string;
  name: string;
  group: CameraGroup;
  /** moves that differ only by direction share a family (the parser matches "orbit" + "left") */
  family: string;
  dir?: Dir;
  /** extra phrases that name this exact move */
  aliases: readonly string[];
  /** where it comes from: the site's shot number, or "film grammar" for our additions */
  ref: string;
  /** how it works, mechanically */
  about: string;
  /** the feeling and the job: when a director should reach for it */
  use: string;
  /** when not to */
  avoid: string;
  defaults: { duration: number; ease: EaseId; intensity: number };
  /** the magnitude intensity scales; a call may override it in these units */
  amount: { value: number; unit: 'units' | 'deg' | 'x' | 'fraction'; what: string };
  /** our own gen-AI prompt wording, assembled by `promptFor` with the call's speed and timing */
  prompt: { name: string; motion: string; speed: string; framing: string; end: string };
  at(base: CamState, p: number, c: MoveCtx): CamState;
  /** where it can play (see `CameraScope`) */
  scope: CameraScope;
  /** camera code that already existed in the repo and does the same job (style-1 presets, the visual renderer, Dark Vox) */
  existing: readonly string[];
  /** a premium move (tagged `premium` in the camera graph): what separates a studio edit from an even 1× move */
  premium?: boolean;
}

// ── geometry on a base state ──

const RAD = Math.PI / 180;
const add = (a: Vec3, b: Partial<Vec3>): Vec3 => ({ x: a.x + (b.x ?? 0), y: a.y + (b.y ?? 0), z: a.z + (b.z ?? 0) });
const dirOf = (s: CamState) => { const d = sub(s.target, s.pos), l = len(d) || 1; return { x: d.x / l, y: d.y / l, z: d.z / l, l }; };

/** Turn the lens from a fixed point: yaw right / pitch up by degrees. */
function turn(s: CamState, yaw: number, pitch: number): CamState {
  const d = dirOf(s), y0 = Math.atan2(d.x, -d.z), p0 = Math.asin(d.y);
  const y1 = y0 + yaw * RAD, p1 = Math.max(-1.5, Math.min(1.5, p0 + pitch * RAD));
  return cam(s, { target: { x: s.pos.x + Math.sin(y1) * Math.cos(p1) * d.l, y: s.pos.y + Math.sin(p1) * d.l, z: s.pos.z - Math.cos(y1) * Math.cos(p1) * d.l } });
}
/** Travel along the lens axis toward the target (negative = back), target fixed. */
function dolly(s: CamState, dist: number): CamState {
  const d = dirOf(s);
  return cam(s, { pos: add(s.pos, { x: d.x * dist, y: d.y * dist, z: d.z * dist }) });
}
/** Move camera and target together (truck, pedestal, tracking). */
function shift(s: CamState, o: Partial<Vec3>, carrySubject = false): CamState {
  return cam(s, { pos: add(s.pos, o), target: add(s.target, o), subject: carrySubject ? add(s.subject, o) : s.subject });
}
/** Swing the camera around its target on the horizontal plane (positive = counterclockwise seen from above = camera goes right). */
function swing(s: CamState, deg: number, rise = 0): CamState {
  const r = sub(s.pos, s.target), a = deg * RAD;
  return cam(s, { pos: { x: s.target.x + r.x * Math.cos(a) + r.z * Math.sin(a), y: s.pos.y + rise, z: s.target.z - r.x * Math.sin(a) + r.z * Math.cos(a) } });
}
/** Optical zoom by factor z (fov narrows; nothing moves). */
const zoom = (s: CamState, z: number): CamState => cam(s, { fov: (2 * Math.atan(Math.tan((s.fov / 2) * RAD) / z)) / RAD });
/** Human-operator shake: position in units, roll in degrees, all deterministic. */
function shake(s: CamState, t: number, seed: number, amp: number, rollDeg: number, rate = 1): CamState {
  const T = t * rate;
  const o = { x: wobble(T, seed, 0) * amp, y: wobble(T, seed, 1) * amp * 0.8, z: 0 };
  const aim = { x: wobble(T, seed, 2) * amp * 0.6, y: wobble(T, seed, 3) * amp * 0.5, z: 0 };
  return cam(s, { pos: add(s.pos, o), target: add(s.target, aim), roll: s.roll + wobble(T, seed, 4) * rollDeg });
}
/** Slide camera and target together toward a world point by share u (flat-frame exact: the plane stays square to the lens). */
const aim = (s: CamState, at: Vec3, u: number) => shift(s, { x: (at.x - s.target.x) * u, y: (at.y - s.target.y) * u });
/** Roll the picture by `deg` (positive = clockwise), zooming just enough to keep a 9:16 frame's corners covered. */
function rollTo(s: CamState, deg: number): CamState {
  const r = Math.abs(deg) * RAD;
  return zoom(cam(s, { roll: s.roll + deg }), Math.cos(r) + (16 / 9) * Math.sin(r));
}
const EASE_SNAP = EASES.snap, EASE_SMOOTH = EASES.smooth;
/** Footsteps: a vertical bob and a smaller sway at a walking cadence. */
const steps = (t: number, hz: number, amp: number) => ({ x: Math.sin(t * Math.PI * hz) * amp * 0.5, y: -Math.abs(Math.sin(t * Math.PI * hz)) * amp, z: 0 });

const sign = (dir: Dir | undefined) => (dir === 'left' || dir === 'down' || dir === 'out' || dir === 'cw' ? -1 : 1);

// ── the catalogue ──

type Entry = Omit<CameraMove, 'scope' | 'existing'>;
type Def = Omit<Entry, 'family' | 'dir'> & { family?: string; dir?: Dir };
const M = (d: Def): Entry => ({ ...d, family: d.family ?? d.id, dir: d.dir });

/** Build a left/right (or in/out, up/down, cw/ccw) pair from one definition. */
function pair(family: string, dirs: [Dir, Dir], make: (dir: Dir, s: 1 | -1) => Omit<Def, 'family' | 'dir'>): Entry[] {
  return dirs.map(dir => { const d = make(dir, sign(dir) as 1 | -1); return M({ ...d, family, dir }); });
}

const word = (d: Dir) => ({ in: 'in', out: 'out', left: 'left', right: 'right', up: 'up', down: 'down', cw: 'clockwise', ccw: 'counterclockwise' })[d];

const ENTRIES: readonly Entry[] = [
  // ── Pan / Tilt ──
  M({
    id: 'static', name: 'Static shot', group: 'pan-tilt', ref: 'SHOT 01', aliases: ['locked off', 'locked-off', 'static', 'hold', 'tripod', 'still camera', 'no camera movement'],
    about: 'The camera does not move: same position, lens and framing from the first frame to the last.',
    use: 'Lets a performance, a reveal inside the frame or a line of text carry the beat; reads as calm, observational, confident.',
    avoid: 'Moovi films are never dead still: in a coded film prefer a slow push of 1-2 % unless the stillness is the point (a deadpan beat, a time-lapse).',
    defaults: { duration: 3, ease: 'linear', intensity: 1 }, amount: { value: 0, unit: 'units', what: 'no travel' },
    prompt: { name: 'locked-off static camera', motion: 'the camera stays mounted in one place for the whole shot', speed: 'completely still, no drift or shake', framing: 'angle, height, lens and composition never change', end: 'the last frame is framed exactly like the first' },
    at: b => cam(b),
  }),
  ...pair('pan', ['right', 'left'], (dir, s) => ({
    id: `pan-${dir}`, name: `Pan ${dir}`, group: 'pan-tilt', ref: dir === 'right' ? 'SHOT 02' : 'SHOT 02B',
    aliases: [`pan ${dir}`, `pan to the ${dir}`, `swivel ${dir}`],
    about: `The camera turns on its own axis toward the ${dir}; it does not travel, so near and far things slide by the same angle.`,
    use: `Surveys a space or carries the eye from one thing to the next on the ${dir}; patient, explanatory, "look over here".`,
    avoid: 'Two things that are far apart and both matter (cut instead), or when depth should be felt (truck or arc).',
    defaults: { duration: 3, ease: 'smooth', intensity: 1 }, amount: { value: 24, unit: 'deg', what: 'turn angle' },
    prompt: { name: `pan ${dir}`, motion: `swivel the camera ${dir} on a fixed tripod head without moving its position`, speed: 'an even, unhurried turn', framing: `the horizon stays level as new space slides in from the ${dir}`, end: 'come to rest on a composed frame' },
    at: (b, p, c) => turn(b, s * lerp(-c.a / 2, c.a / 2, p), 0),
  })),
  ...pair('whip-pan', ['right', 'left'], (dir, s) => ({
    id: `whip-pan-${dir}`, name: `Whip pan ${dir}`, group: 'pan-tilt', ref: dir === 'right' ? 'SHOT 03' : 'SHOT 03B',
    aliases: [`whip pan ${dir}`, `whip ${dir}`, `swish pan ${dir}`, `flash pan ${dir}`],
    about: 'A pan so fast the middle of it is a streak of motion blur; the camera leaves one composition and lands hard on another.',
    use: 'Energy and surprise; joins two beats as if they were one thought, hides a cut inside the blur, comedic timing.',
    avoid: 'Quiet or sincere beats; more than one or two per film; small screens where the blur reads as a glitch.',
    defaults: { duration: 0.45, ease: 'whip', intensity: 1 }, amount: { value: 70, unit: 'deg', what: 'turn angle' },
    prompt: { name: `whip pan ${dir}`, motion: `flick the camera ${dir} in a sudden turn toward a new subject`, speed: 'violently fast, streaking with motion blur in the middle', framing: 'a clear framing before, a clear framing after', end: 'snap into a sharp, steady frame on the new subject' },
    at: (b, p, c) => turn(b, s * c.a * p, 0),
  })),
  ...pair('tilt', ['up', 'down'], (dir, s) => ({
    id: `tilt-${dir}`, name: `Tilt ${dir}`, group: 'pan-tilt', ref: dir === 'up' ? 'SHOT 04' : 'SHOT 04B',
    aliases: [`tilt ${dir}`, `tilt the camera ${dir}`],
    about: `The camera pivots ${dir} from a fixed point, sweeping the frame vertically.`,
    use: dir === 'up' ? 'Reveals height and scale (a tower, a person standing tall); awe, aspiration, power.' : 'Lands on something below (a product on a table, a detail at the feet); grounding, discovery, deflation.',
    avoid: 'Wide horizontal subjects; when the camera itself should rise (pedestal or crane).',
    defaults: { duration: 2.5, ease: 'smooth', intensity: 1 }, amount: { value: 20, unit: 'deg', what: 'tilt angle' },
    prompt: { name: `tilt ${dir}`, motion: `pivot the lens ${dir}ward while the camera body stays put`, speed: 'a steady, even tilt', framing: `the tall subject stays centred as the frame climbs ${dir === 'up' ? 'upward' : 'downward'}`, end: `settle on the ${dir === 'up' ? 'top' : 'bottom'} of the subject` },
    at: (b, p, c) => turn(b, 0, s * lerp(-c.a / 2, c.a / 2, p)),
  })),
  // ── Zoom / Lens ──
  ...pair('zoom', ['in', 'out'], (dir, s) => ({
    id: `slow-zoom-${dir}`, name: `Slow zoom ${dir}`, group: 'zoom-lens', ref: dir === 'in' ? 'SHOT 05' : 'SHOT 05B',
    aliases: [`slow zoom ${dir}`, `zoom ${dir}`, `creep ${dir}`, `gentle zoom ${dir}`, ...(dir === 'in' ? ['slow push', 'push in slowly'] : [])],
    about: `The lens changes focal length while the camera stays still; the picture ${dir === 'in' ? 'tightens' : 'widens'} with no change of perspective.`,
    use: dir === 'in' ? 'Builds focus and tension on one thing over a held line; the "lean in" of a documentary.' : 'Lets a held image breathe and reveals context at the end of a thought.',
    avoid: 'When the space should be felt (a dolly moves through it, a zoom only magnifies it).',
    defaults: { duration: 5, ease: 'smooth', intensity: 1 }, amount: { value: 1.25, unit: 'x', what: 'zoom factor' },
    prompt: { name: `slow zoom ${dir}`, motion: `the lens zooms ${dir} gradually while the camera stays fixed`, speed: 'slow and even, barely noticeable at first', framing: 'the subject stays readable and centred as its size changes', end: `hold a steady ${dir === 'in' ? 'closer' : 'wider'} framing` },
    at: (b, p, c) => zoom(b, s > 0 ? lerpLog(1, c.a, p) : lerpLog(c.a, 1, p)),
  })),
  ...pair('fast-zoom', ['in', 'out'], (dir, s) => ({
    id: `fast-zoom-${dir}`, name: `Fast zoom ${dir}`, group: 'zoom-lens', ref: dir === 'in' ? 'SHOT 06' : 'SHOT 06B',
    aliases: [`fast zoom ${dir}`, `quick zoom ${dir}`, `zoom ${dir} fast`, `zoom ${dir} quickly`],
    about: `A quick, decisive change of focal length ${dir === 'in' ? 'onto' : 'away from'} the subject; still a camera that does not travel.`,
    use: dir === 'in' ? 'Points at the thing that matters right now: a number, a face, a punchline.' : 'Pops the context in: "and here is the whole picture".',
    avoid: 'Back to back with other fast moves; slower, reflective narration.',
    defaults: { duration: 1, ease: 'smooth', intensity: 1 }, amount: { value: 1.6, unit: 'x', what: 'zoom factor' },
    prompt: { name: `fast zoom ${dir}`, motion: `a quick zoom ${dir} ${dir === 'in' ? 'onto' : 'away from'} the subject with the camera fixed`, speed: 'brisk and decisive', framing: 'keep the subject centred and legible through the size change', end: `land on a stable ${dir === 'in' ? 'tight' : 'wide'} frame` },
    at: (b, p, c) => zoom(b, s > 0 ? lerpLog(1, c.a, p) : lerpLog(c.a, 1, p)),
  })),
  ...pair('crash-zoom', ['in', 'out'], (dir, s) => ({
    id: `crash-zoom-${dir}`, name: `Crash zoom ${dir}`, group: 'zoom-lens', ref: dir === 'in' ? 'SHOT 07A' : 'SHOT 07B',
    aliases: [`crash zoom ${dir}`, `snap zoom ${dir}`, `smash zoom ${dir}`, ...(dir === 'in' ? ['meme zoom', 'dramatic zoom'] : [])],
    about: 'A near-instant zoom that hits like a sound effect: the lens slams to its new focal length and stops dead.',
    use: dir === 'in' ? 'Shock, comedy, emphasis on a key word; the meme zoom. Pair with a hit sound.' : 'A comic or dramatic "pull away": the reaction, the absurd scale of the situation.',
    avoid: 'Brand films that should feel calm; more than one per 10 s; a subject that is not centred (it will fly off).',
    defaults: { duration: 0.3, ease: 'snap', intensity: 1 }, amount: { value: 2.2, unit: 'x', what: 'zoom factor' },
    prompt: { name: `crash zoom ${dir}`, motion: `slam the lens ${dir} in a single violent zoom`, speed: 'almost instant, hits like a punch then stops dead', framing: 'the subject stays centred through the jump in scale', end: `freeze on a bold ${dir === 'in' ? 'close-up' : 'wide'} frame` },
    at: (b, p, c) => zoom(b, s > 0 ? lerpLog(1, c.a, p) : lerpLog(c.a, 1, p)),
  })),
  ...pair('dolly-zoom', ['in', 'out'], (dir, s) => ({
    id: `dolly-zoom-${dir}`, name: `Dolly zoom ${dir}`, group: 'zoom-lens', ref: 'film grammar (not on the site)',
    aliases: [`dolly zoom ${dir}`, ...(dir === 'in' ? ['vertigo', 'vertigo shot', 'vertigo effect', 'zolly', 'dolly zoom', 'trombone shot', 'contra zoom'] : ['reverse vertigo', 'reverse dolly zoom'])],
    about: `The camera ${dir === 'in' ? 'moves toward' : 'pulls away from'} the subject while the lens zooms the other way, so the subject keeps its size and the background ${dir === 'in' ? 'stretches away' : 'swells up behind it'}.`,
    use: 'Realisation, dread, vertigo, "the world just shifted": a single, big moment of inner change.',
    avoid: 'Anything casual; flat scenes with no depth behind the subject (there is nothing to warp).',
    defaults: { duration: 2.5, ease: 'smooth', intensity: 1 }, amount: { value: 0.55, unit: 'fraction', what: 'share of the distance travelled' },
    prompt: { name: `dolly zoom (vertigo effect), camera moving ${dir}`, motion: `the camera ${dir === 'in' ? 'pushes toward' : 'pulls away from'} the subject while the lens zooms in the opposite direction`, speed: 'smooth and deliberate', framing: 'the subject stays the same size in frame while the background perspective warps behind them', end: 'finish with the background dramatically compressed or stretched around an unchanged subject' },
    at: (b, p, c) => {
      const d0 = len(sub(b.target, b.pos)), d = s > 0 ? d0 * (1 - c.a * p) : d0 * (1 - c.a * (1 - p));
      const moved = dolly(b, d0 - d), f0 = Math.tan((b.fov / 2) * RAD);
      return cam(moved, { fov: (2 * Math.atan((f0 * d0) / d)) / RAD });
    },
  })),
  // ── Dolly / Track ──
  ...pair('dolly', ['in', 'out'], (dir, s) => ({
    id: `dolly-${dir}`, name: `Dolly ${dir}`, group: 'dolly-track', ref: dir === 'in' ? 'SHOT 08' : 'SHOT 09',
    aliases: dir === 'in' ? ['dolly in', 'push in', 'dolly forward', 'track in', 'move in', 'push'] : ['dolly out', 'pull out', 'pull back', 'dolly back', 'track out', 'move back', 'pull'],
    about: `The whole camera travels in a straight line ${dir === 'in' ? 'toward' : 'away from'} the subject; parallax makes the space felt.`,
    use: dir === 'in' ? 'Intimacy and importance: we are drawn into the subject. The default "this matters" move.' : 'Release, isolation or reveal: the subject shrinks into its world.',
    avoid: 'When nothing in the frame has depth (a flat card: use a zoom, it looks the same and costs less).',
    defaults: { duration: 3, ease: 'smooth', intensity: 1 }, amount: { value: 0.35, unit: 'fraction', what: 'share of the subject distance travelled' },
    prompt: { name: `dolly ${dir}`, motion: `the camera rolls straight ${dir === 'in' ? 'forward toward' : 'backward away from'} the subject on a track`, speed: `a smooth, controlled ${dir === 'in' ? 'push' : 'retreat'}`, framing: 'height and lens direction stay constant while the distance changes', end: `finish on a ${dir === 'in' ? 'tighter' : 'wider'} composition` },
    at: (b, p, c) => { const d0 = len(sub(b.target, b.pos)); return dolly(b, d0 * c.a * (s > 0 ? p : 1 - p)); },
  })),
  M({
    id: 'tracking', name: 'Tracking shot', group: 'dolly-track', ref: 'SHOT 16', aliases: ['tracking shot', 'tracking', 'track with', 'travelling shot', 'follow along'],
    about: 'Camera and subject travel together; the subject holds its place in frame while the world streams past behind.',
    use: 'Journey and momentum; keeps the viewer beside the subject; a product moving through its use cases.',
    avoid: 'A static subject (it becomes a truck); fast cutting (the move needs time to read).',
    defaults: { duration: 4, ease: 'linear', intensity: 1 }, amount: { value: 6, unit: 'units', what: 'distance travelled' },
    prompt: { name: 'tracking shot', motion: 'the camera travels through the scene alongside the subject', speed: "matched to the subject's own pace", framing: 'the subject keeps the same place in frame while the surroundings flow past', end: 'still moving, the subject clearly framed' },
    at: (b, p, c) => shift(b, { x: c.a * p }, true),
  }),
  M({
    id: 'follow', name: 'Follow shot', group: 'dolly-track', ref: 'SHOT 17', aliases: ['follow shot', 'follow', 'over the shoulder', 'over-the-shoulder', 'ots', 'follow from behind'],
    about: 'The camera walks behind the subject at shoulder height; their back and shoulder frame the route ahead.',
    use: 'Puts the viewer in the subject\'s footsteps: anticipation, "where are we going", entering a new place.',
    avoid: 'Beats that need the face; very short shots (the walk needs a few steps to read).',
    defaults: { duration: 4, ease: 'linear', intensity: 1 }, amount: { value: 6, unit: 'units', what: 'distance walked' },
    prompt: { name: 'follow shot from behind, over the shoulder', motion: 'the camera trails just behind the subject along their path at shoulder height', speed: "walking at the subject's pace", framing: "the subject's shoulder and head sit in the foreground with the way ahead visible past them", end: 'keep following, the subject leading the frame' },
    at: (b, p, c) => { const o = steps(c.t, 1.8, 0.05 * c.k); return cam(shift(b, { x: 0.6 + o.x, y: 0.4 + o.y, z: -4 - c.a * p }, true), { subject: add(b.subject, { z: -c.a * p }) }); },
  }),
  M({
    id: 'reverse-tracking', name: 'Reverse tracking', group: 'dolly-track', ref: 'SHOT 18', aliases: ['reverse tracking', 'reverse tracking shot', 'walk and talk', 'walk-and-talk', 'lead shot', 'leading shot'],
    about: 'The camera moves backward in front of a subject who walks toward it, keeping their face and body in a steady frame.',
    use: 'Conversation on the move, a founder talking while walking, confidence and forward drive.',
    avoid: 'When the destination matters more than the person (use a follow shot).',
    defaults: { duration: 4, ease: 'linear', intensity: 1 }, amount: { value: 5, unit: 'units', what: 'distance walked' },
    prompt: { name: 'reverse tracking shot (walk and talk)', motion: 'the camera backs away ahead of the subject as they walk toward it', speed: "exactly the subject's walking pace", framing: 'a steady front-on frame of face and body with the background sliding behind', end: 'still walking, the subject facing the lens' },
    at: (b, p, c) => { const o = steps(c.t, 1.8, 0.03 * c.k); return cam(shift(b, { x: o.x, y: o.y, z: -3 + c.a * p }), { subject: add(b.subject, { z: c.a * p }) }); },
  }),
  M({
    id: 'side-tracking', name: 'Side tracking', group: 'dolly-track', ref: 'SHOT 19', aliases: ['side tracking', 'side tracking shot', 'lateral tracking', 'profile tracking', 'crab with'],
    about: 'The camera runs parallel to the subject, seeing them in profile or three-quarter as the background slides sideways.',
    use: 'Clean momentum, races and journeys, "progress" read left to right; strong parallax between layers.',
    avoid: 'When the face must be read head-on.',
    defaults: { duration: 4, ease: 'linear', intensity: 1 }, amount: { value: 7, unit: 'units', what: 'distance travelled' },
    prompt: { name: 'side tracking shot', motion: 'the camera moves parallel to the subject alongside their direction of travel', speed: "matched to the subject's speed", framing: 'the subject in profile or three-quarter view at a steady distance', end: 'keep the sideways motion going with the subject framed' },
    at: (b, p, c) => cam(swing(shift(b, { x: c.a * p }, true), 12), {}),
  }),
  M({
    id: 'low-tracking', name: 'Low tracking', group: 'dolly-track', ref: 'SHOT 20', aliases: ['low tracking', 'low tracking shot', 'ground level tracking', 'low angle tracking'],
    about: 'A tracking shot skimming the ground: feet, wheels and the floor rush through the bottom of frame.',
    use: 'Speed, weight and texture; makes small things heroic; sneakers, tyres, a robot rolling.',
    avoid: 'Faces and dialogue; scenes with nothing on the ground plane.',
    defaults: { duration: 3, ease: 'linear', intensity: 1 }, amount: { value: 6, unit: 'units', what: 'distance travelled' },
    prompt: { name: 'low tracking shot', motion: 'the camera glides just above the ground beside the moving subject', speed: 'paced to the footsteps or the wheels', framing: 'low detail stays sharp while the ground plane streams through the frame', end: 'keep the ground-level perspective to the last frame' },
    at: (b, p, c) => { const s1 = shift(b, { x: c.a * p }, true); return cam(s1, { pos: add(s1.pos, { y: -2.6, z: -2 }), target: add(s1.target, { y: -1.2 }) }); },
  }),
  M({
    id: 'vehicle-tracking', name: 'Vehicle tracking', group: 'dolly-track', ref: 'SHOT 21', aliases: ['vehicle tracking', 'car tracking', 'car mount', 'process trailer', 'vehicle tracking shot'],
    about: 'The camera rides with a vehicle; the vehicle holds still in frame while the road blurs past, with a little road vibration.',
    use: 'Travel, logistics, speed and freedom; ads for anything that moves.',
    avoid: 'Slow, intimate scenes; when there is no sense of a road or route.',
    defaults: { duration: 4, ease: 'linear', intensity: 1 }, amount: { value: 14, unit: 'units', what: 'distance driven' },
    prompt: { name: 'vehicle tracking shot', motion: 'the camera travels alongside the vehicle along its route', speed: "matched to the vehicle's speed", framing: 'the vehicle stays steady in frame while the road and scenery race past', end: 'still in motion with the vehicle clearly framed' },
    at: (b, p, c) => shake(swing(shift(b, { x: c.a * p }, true), 20), c.t, c.seed, 0.02 * c.k, 0.15 * c.k, 6),
  }),
  M({
    id: 'chase', name: 'Chase shot', group: 'dolly-track', ref: 'SHOT 22', aliases: ['chase', 'chase shot', 'pursuit', 'running follow'],
    about: 'A fast, close follow with an operator reacting in real time: shake, reframes and a camera that is nearly losing the subject.',
    use: 'Urgency, danger, adrenaline, a deadline; the "everything is happening" beat.',
    avoid: 'Calm brands, explanations, any frame that has to be read (text, charts).',
    defaults: { duration: 3, ease: 'linear', intensity: 1 }, amount: { value: 10, unit: 'units', what: 'distance run' },
    prompt: { name: 'chase shot', motion: 'the camera races after the subject along the action, close behind', speed: 'fast and reactive, the operator running', framing: 'the subject stays in view while the frame jolts and reframes energetically', end: 'still in pursuit, locked onto the subject' },
    at: (b, p, c) => { const o = steps(c.t, 2.8, 0.09 * c.k); return cam(shake(shift(b, { x: o.x, y: 0.3 + o.y, z: -4.5 - c.a * p }), c.t, c.seed, 0.12 * c.k, 1.6 * c.k, 2.2), { subject: add(b.subject, { z: -c.a * p }) }); },
  }),
  // ── Physical moves ──
  ...pair('truck', ['right', 'left'], (dir, s) => ({
    id: `truck-${dir}`, name: `Truck ${dir}`, group: 'physical', ref: dir === 'right' ? 'SHOT 10' : 'SHOT 10B',
    aliases: [`truck ${dir}`, `crab ${dir}`, `strafe ${dir}`, `move ${dir}`, `track ${dir}`, `drift ${dir}`],
    about: `The camera body slides sideways to the ${dir} on a straight line, lens facing the same way; near layers pass faster than far ones.`,
    use: 'Reveals across a row (a lineup, a shelf, a timeline); feels like walking past; strong parallax with layered sets.',
    avoid: 'Single centred subjects with nothing beside them; flat layouts without overscan (the edge shows).',
    defaults: { duration: 4, ease: 'smooth', intensity: 1 }, amount: { value: 3, unit: 'units', what: 'sideways travel' },
    prompt: { name: `truck ${dir}`, motion: `the camera slides sideways to the ${dir} on a straight rail`, speed: 'a steady sideways glide', framing: 'the lens keeps pointing the same way as the scene passes across the frame', end: 'settle on a clean sideways composition' },
    at: (b, p, c) => shift(b, { x: s * lerp(-c.a / 2, c.a / 2, p) }),
  })),
  ...pair('pedestal', ['up', 'down'], (dir, s) => ({
    id: `pedestal-${dir}`, name: `Pedestal ${dir}`, group: 'physical', ref: dir === 'up' ? 'SHOT 11A' : 'SHOT 11B',
    aliases: [`pedestal ${dir}`, `ped ${dir}`, `boom ${dir}`, `elevate ${dir}`, ...(dir === 'up' ? ['rise', 'raise the camera'] : ['lower the camera', 'sink'])],
    about: `The whole camera ${dir === 'up' ? 'rises' : 'lowers'} straight ${dir}, lens level; nothing tilts, the frame simply ${dir === 'up' ? 'climbs' : 'descends'}.`,
    use: dir === 'up' ? 'Climbing a stack (a tall phone, a list, a building) one level at a time; steady and factual.' : 'Coming down to the detail at the bottom: a price, a signature, the floor.',
    avoid: 'When the angle should change (tilt) or when the move should feel grand (crane).',
    defaults: { duration: 3, ease: 'smooth', intensity: 1 }, amount: { value: 2.5, unit: 'units', what: 'vertical travel' },
    prompt: { name: `pedestal ${dir}`, motion: `move the entire camera straight ${dir} in a vertical line`, speed: `a smooth, constant ${dir === 'up' ? 'lift' : 'descent'}`, framing: 'the lens stays level and keeps facing the same direction', end: `finish on the ${dir === 'up' ? 'higher' : 'lower'} framing` },
    at: (b, p, c) => shift(b, { y: s * lerp(-c.a / 2, c.a / 2, p) }),
  })),
  ...pair('slider', ['right', 'left'], (dir, s) => ({
    id: `slider-${dir}`, name: `Slider ${dir}`, group: 'physical', ref: dir === 'right' ? 'SHOT 12' : 'SHOT 12B',
    aliases: [`slider ${dir}`, `slide ${dir}`, `slider shot ${dir}`, `parallax ${dir}`],
    about: `A short, slow sideways slide to the ${dir} that keeps an eye on the subject; layers separate in gentle parallax.`,
    use: 'Product hero shots, desk set-ups, anything that should feel premium and three-dimensional without drama.',
    avoid: 'Big reveals (too small); fast edits (it is a slow move by nature).',
    defaults: { duration: 4, ease: 'linear', intensity: 1 }, amount: { value: 1.2, unit: 'units', what: 'slide distance' },
    prompt: { name: `slider shot moving ${dir}`, motion: `slide the camera a short distance to the ${dir} on a slider`, speed: 'slow, controlled and constant', framing: 'foreground, subject and background separate in gentle parallax', end: `settle with the subject seen from a slightly ${dir}-shifted angle` },
    at: (b, p, c) => { const x = s * lerp(-c.a / 2, c.a / 2, p); return cam(b, { pos: add(b.pos, { x }), target: add(b.target, { x: x * 0.35 }) }); },
  })),
  M({
    id: 'push-past', name: 'Push past', group: 'physical', ref: 'SHOT 13', aliases: ['push past', 'pass by', 'pass-by', 'pass by shot', 'push past foreground', 'foreground wipe'],
    about: 'A forward glide that brushes past an object close to the lens; the foreground sweeps out of frame and the space beyond opens up.',
    use: 'Entering a world: past a doorframe, a plant, a shelf edge; adds depth and a natural wipe.',
    avoid: 'Scenes with no foreground layer to pass (it becomes a plain dolly in).',
    defaults: { duration: 3, ease: 'smooth', intensity: 1 }, amount: { value: 0.65, unit: 'fraction', what: 'share of the subject distance travelled' },
    prompt: { name: 'push past a foreground object', motion: 'glide forward past an object, edge or opening close to the lens', speed: 'a smooth forward glide', framing: 'the foreground sweeps by the lens as the space beyond comes into view', end: 'arrive beyond the foreground layer' },
    at: (b, p, c) => { const d0 = len(sub(b.target, b.pos)); return dolly(b, d0 * c.a * p); },
  }),
  ...pair('arc', ['right', 'left'], (dir, s) => ({
    id: `arc-${dir}`, name: `Arc ${dir}`, group: 'physical', ref: dir === 'right' ? 'SHOT 14' : 'SHOT 14B',
    aliases: [`arc ${dir}`, `arc shot ${dir}`, `curve ${dir}`, `half orbit ${dir}`],
    about: `The camera travels a shallow curve around the subject toward the ${dir}, keeping distance and height; the angle on the subject changes.`,
    use: 'Adds dimension to a hero (person or product) without a full orbit; a considered, admiring look.',
    avoid: 'Flat 2D cards seen edge-on (keep the arc small); when the subject must stay square to camera (text).',
    defaults: { duration: 3.5, ease: 'smooth', intensity: 1 }, amount: { value: 30, unit: 'deg', what: 'arc angle' },
    prompt: { name: `arc ${dir}`, motion: `travel along a shallow curve around the subject toward the ${dir}`, speed: 'a smooth, measured curve', framing: 'distance, height and the subject in frame stay constant while the viewing angle changes', end: `finish on a new ${dir}-side angle of the subject` },
    at: (b, p, c) => swing(b, s * lerp(-c.a / 2, c.a / 2, p)),
  })),
  ...pair('orbit', ['cw', 'ccw'], dir => ({
    id: `orbit-${dir}`, name: `Orbit ${word(dir)}`, group: 'physical', ref: dir === 'cw' ? 'SHOT 15' : 'SHOT 15B',
    aliases: dir === 'cw'
      ? ['orbit clockwise', 'clockwise orbit', 'orbit cw', 'circle clockwise', 'orbit left', '360 clockwise', 'orbit']
      : ['orbit counterclockwise', 'counterclockwise orbit', 'orbit anticlockwise', 'anticlockwise orbit', 'orbit ccw', 'circle counterclockwise', 'orbit right', '360 counterclockwise'],
    about: `The camera circles the subject ${word(dir)} (seen from above) at a constant radius, always looking at it; the background wheels around behind.`,
    use: 'Celebration and importance: the hero moment, a product reveal, a person at the centre of their world.',
    avoid: 'Flat 2D layouts (keep the sweep under ~60°); explanations; more than once per film.',
    defaults: { duration: 5, ease: 'smooth', intensity: 1 }, amount: { value: 60, unit: 'deg', what: 'sweep angle (360 = full circle)' },
    prompt: { name: `${word(dir)} orbit`, motion: `circle ${word(dir)} around the subject at a constant distance`, speed: 'a smooth, controlled orbit', framing: 'the subject stays centred as the background revolves behind them', end: 'complete the arc with a steady frame on the subject' },
    // cw (seen from above) = the camera moves to its left
    at: (b, p, c) => swing(b, (dir === 'cw' ? -1 : 1) * lerp(-c.a / 2, c.a / 2, p), Math.sin(p * Math.PI) * 0.3 * c.k),
  })),
  // ── Human camera ──
  M({
    id: 'handheld', name: 'Handheld', group: 'human', ref: 'SHOT 23', aliases: ['handheld', 'hand held', 'hand-held', 'shaky cam', 'documentary style', 'run and gun'],
    about: 'An operator holds the camera: small organic sway, breathing and micro-corrections on position, aim and roll.',
    use: 'Presence and honesty; documentary, UGC, behind the scenes; makes coded scenes feel filmed rather than generated.',
    avoid: 'Precise UI or text that must be read; luxury or calm brands (use a slider); stacking on fast moves.',
    defaults: { duration: 4, ease: 'linear', intensity: 1 }, amount: { value: 0.06, unit: 'units', what: 'sway amplitude' },
    prompt: { name: 'handheld camera', motion: 'the camera is held by an operator at human height with natural body movement', speed: 'responsive and organic', framing: 'the subject stays readable while the frame sways gently with small corrections', end: 'finish on a natural handheld frame' },
    at: (b, _p, c) => shake(b, c.t, c.seed, c.a, 0.6 * c.k),
  }),
  M({
    id: 'snorricam', name: 'Body-mounted (Snorricam)', group: 'human', ref: 'SHOT 24', aliases: ['snorricam', 'body mounted', 'body-mounted', 'body cam', 'chest rig', 'body mount'],
    about: 'The camera is rigged to the subject: their face stays locked in the frame while the world lurches and swings around them.',
    use: 'Disorientation, intoxication, panic, an intense personal moment.',
    avoid: 'Almost everything else; never for explaining.',
    defaults: { duration: 4, ease: 'linear', intensity: 1 }, amount: { value: 4, unit: 'units', what: 'distance walked' },
    prompt: { name: 'body-mounted Snorricam', motion: "the camera is fixed to the subject's body, facing them, as they move", speed: "follows the body's motion exactly", framing: 'the subject stays close, centred and facing the lens while the background swings around them', end: 'the subject still locked in frame' },
    at: (b, p, c) => {
      const o = steps(c.t, 1.8, 0.12 * c.k), r = Math.sin(c.t * Math.PI * 0.9) * 4 * c.k;
      const s1 = shift(b, { x: o.x, y: o.y, z: -c.a * p }, true);
      return cam(s1, { pos: add(s1.pos, { z: -6 }), roll: b.roll + r });
    },
  }),
  // ── Drone / Crane ──
  ...pair('crane', ['up', 'down'], (dir, s) => ({
    id: `crane-${dir}`, name: `Crane ${dir}`, group: 'drone-crane', ref: dir === 'up' ? 'SHOT 25' : 'SHOT 25B',
    aliases: [`crane ${dir}`, `jib ${dir}`, `crane shot ${dir}`, ...(dir === 'up' ? ['rise up and reveal', 'crane'] : ['descend'])],
    about: `The camera ${dir === 'up' ? 'rises' : 'descends'} through open space on a crane, easing back a little and keeping the subject in view as the scale ${dir === 'up' ? 'opens' : 'closes'}.`,
    use: dir === 'up' ? 'Endings and big-picture reveals: "and this is everywhere". Grand, uplifting.' : 'Openings: coming down out of the sky into the story.',
    avoid: 'Mid-sentence beats; tight interiors.',
    defaults: { duration: 4, ease: 'smooth', intensity: 1 }, amount: { value: 4, unit: 'units', what: 'height travelled' },
    prompt: { name: `crane ${dir}`, motion: `the camera ${dir === 'up' ? 'rises' : 'descends'} smoothly through open space`, speed: `a slow, controlled ${dir === 'up' ? 'lift' : 'descent'}`, framing: `the subject or place stays readable as the camera ${dir === 'up' ? 'climbs' : 'lowers'}`, end: dir === 'up' ? 'end high with the wider scale visible' : 'end low on the subject or destination' },
    at: (b, p, c) => { const u = s > 0 ? p : 1 - p, y = c.a * u; return cam(b, { pos: add(b.pos, { y, z: (len(sub(b.target, b.pos)) * 0.2) * u }), target: add(b.target, { y: y * 0.3 }) }); },
  })),
  ...pair('drone', ['in', 'out'], (dir, s) => ({
    id: dir === 'in' ? 'drone-push-in' : 'drone-pull-back', name: dir === 'in' ? 'Drone push in' : 'Drone pull back', group: 'drone-crane', ref: dir === 'in' ? 'SHOT 26' : 'SHOT 26B',
    aliases: dir === 'in' ? ['drone push in', 'drone in', 'aerial push in', 'fly in', 'flyover in'] : ['drone pull back', 'drone out', 'aerial pull back', 'fly out', 'drone reveal', 'aerial reveal'],
    about: `An aerial glide from above, ${dir === 'in' ? 'flying forward and down onto' : 'flying back and up away from'} the subject while looking at it.`,
    use: dir === 'in' ? 'Arrival: establishing a place and then landing on what matters in it.' : 'Scale and departure: the subject becomes part of a much larger world; endings.',
    avoid: 'Interiors and UI; when there is no "ground" in the scene.',
    defaults: { duration: 5, ease: 'smooth', intensity: 1 }, amount: { value: 1, unit: 'fraction', what: 'flight scale' },
    prompt: { name: dir === 'in' ? 'drone push in' : 'drone pull back', motion: `an aerial camera flies smoothly ${dir === 'in' ? 'forward toward' : 'backward away from'} the subject`, speed: `a controlled aerial ${dir === 'in' ? 'glide' : 'retreat'}`, framing: dir === 'in' ? 'the destination stays readable as the drone approaches' : 'the subject stays readable as more landscape opens up', end: `finish on a ${dir === 'in' ? 'closer' : 'wider'} aerial frame` },
    at: (b, p, c) => { const u = s > 0 ? 1 - p : p; return cam(b, { pos: add(b.pos, { y: 4 * c.a * u + 0.6, z: 8 * c.a * u - 1 }) }); },
  })),
  M({
    id: 'helicopter', name: 'Helicopter shot', group: 'drone-crane', ref: 'SHOT 27', aliases: ['helicopter', 'helicopter shot', 'aerial', 'aerial shot', 'high aerial', 'flyover'],
    about: 'A high, wide aerial that drifts along a broad flight path with a slight bank, the world laid out below.',
    use: 'Epic scale, geography, "a whole industry"; opening establishing shots.',
    avoid: 'Anything that must be read up close.',
    defaults: { duration: 6, ease: 'linear', intensity: 1 }, amount: { value: 8, unit: 'units', what: 'flight distance' },
    prompt: { name: 'helicopter aerial shot', motion: 'fly at high altitude along a broad, gradual path', speed: 'steady and stately', framing: 'the landscape or a distant moving subject reads at a wide scale', end: 'finish on a stable high-altitude frame' },
    at: (b, p, c) => { const x = lerp(-c.a / 2, c.a / 2, p); return cam(b, { pos: add(b.pos, { x, y: 9, z: 12 }), target: add(b.target, { x: x * 0.4 }), roll: b.roll + 2 * c.k * Math.sin(p * Math.PI) }); },
  }),
  // ── Specials ──
  M({
    id: 'first-person', name: 'First-person view', group: 'special', ref: 'SHOT S1', aliases: ['first person', 'first-person', 'pov', 'point of view', 'fpv walk', 'subjective camera'],
    about: 'The camera is the character\'s eyes: a forward walk at eye height with footstep bob and slight sway.',
    use: 'Immersion and empathy: "this is you". Onboarding flows, tours, a day in the life.',
    avoid: 'When the viewer should watch the character rather than be them.',
    defaults: { duration: 4, ease: 'linear', intensity: 1 }, amount: { value: 0.45, unit: 'fraction', what: 'share of the distance walked' },
    prompt: { name: 'first-person point of view', motion: "move forward at eye height as if through the character's own eyes", speed: 'a natural walking pace', framing: 'hands, arms or body edges at the frame edges anchor the viewpoint', end: 'arrive at the next moment of action from the same point of view' },
    at: (b, p, c) => { const d0 = len(sub(b.target, b.pos)), o = steps(c.t, 1.9, 0.07 * c.k); const s1 = dolly(b, d0 * c.a * p); return cam(s1, { pos: add(s1.pos, o), roll: b.roll + Math.sin(c.t * Math.PI * 0.95) * 0.7 * c.k }); },
  }),
  M({
    id: 'tilt-shift', name: 'Tilt-shift', group: 'special', ref: 'SHOT S2', aliases: ['tilt shift', 'tilt-shift', 'miniature', 'miniature effect', 'toy town'],
    about: 'A high, angled view with only a narrow band in focus; the scene reads as a tiny model. The camera barely glides.',
    use: 'Playful overviews: a city, an office, a process laid out like a toy set; charm and distance.',
    avoid: 'Close-ups and text (the blur eats them); emotional beats.',
    defaults: { duration: 4, ease: 'linear', intensity: 1 }, amount: { value: 0.18, unit: 'fraction', what: 'sharp band height' },
    prompt: { name: 'tilt-shift miniature view', motion: 'hold or drift slightly from a high, angled viewpoint over the scene', speed: 'tiny, precise movement', framing: 'a thin horizontal band of sharp focus across the subject, soft blur above and below', end: 'keep the miniature, toy-model look to the end' },
    at: (b, p, c) => cam(b, { pos: add(b.pos, { x: lerp(-0.5, 0.5, p) * c.k, y: 7, z: -2 }), target: add(b.target, { x: lerp(-0.5, 0.5, p) * c.k * 0.8 }), focusBand: c.a }),
  }),
  M({
    id: 'infinite-zoom', name: 'Infinite zoom', group: 'special', ref: 'SHOT S3', aliases: ['infinite zoom', 'endless zoom', 'droste zoom', 'zoom into the next world', 'fractal zoom'],
    about: 'A zoom into the exact centre that keeps accelerating until the centre becomes the next scene; renderers chain worlds by scale.',
    use: 'Transitions between scenes or ideas: "inside this, there is another world"; loops.',
    avoid: 'Off-centre subjects; content that cannot nest (needs a world inside the centre). It leaves the base framing on purpose.',
    defaults: { duration: 4, ease: 'ramp-up', intensity: 1 }, amount: { value: 12, unit: 'x', what: 'total zoom factor' },
    prompt: { name: 'infinite zoom', motion: 'zoom continuously into the exact centre of the frame', speed: 'smooth and accelerating', framing: 'the centre target stays dead centre as it grows', end: 'end as the next world fills the frame' },
    at: (b, p, c) => zoom(b, lerpLog(1, c.a, p)),
  }),
  M({
    id: 'earth-zoom-out', name: 'Earth zoom out', group: 'special', ref: 'SHOT S4', aliases: ['earth zoom out', 'earth zoom', 'google earth zoom', 'zoom out to space', 'cosmic zoom', 'powers of ten'],
    about: 'A rising pull-out that keeps multiplying scale: street, city, country, planet, with the start point kept at the centre.',
    use: 'Global reach, "from one desk to the whole world", the end of a story.',
    avoid: 'Anything without a map or nested scale layers to show. It leaves the base framing on purpose.',
    defaults: { duration: 5, ease: 'ramp-up', intensity: 1 }, amount: { value: 1000, unit: 'x', what: 'distance multiplier' },
    prompt: { name: 'earth zoom out', motion: 'pull straight up from the starting point through street, city, landscape and planet scale', speed: 'rapid, ever-accelerating', framing: 'the starting location stays at the centre as the scale grows', end: 'finish on the whole planet with the start point implied at its centre' },
    at: (b, p, c) => { const d0 = len(sub(b.target, b.pos)); return dolly(b, d0 - d0 * lerpLog(1, c.a, p)); },
  }),
  M({
    id: 'time-lapse', name: 'Time-lapse', group: 'special', ref: 'SHOT S5', aliases: ['time lapse', 'time-lapse', 'timelapse', 'hyperlapse still', 'locked time lapse'],
    about: 'A locked camera while time runs fast: the scene\'s own animation speeds up (timeScale), the frame never moves.',
    use: 'Passing time, growth, busy days, a build coming together.',
    avoid: 'Scenes with nothing animating inside them (it reads as a static shot).',
    defaults: { duration: 4, ease: 'linear', intensity: 1 }, amount: { value: 24, unit: 'x', what: 'time speed-up' },
    prompt: { name: 'locked-camera time-lapse', motion: 'the camera stays fixed while time races forward', speed: 'heavily compressed time, perfectly stable camera', framing: 'the same composition and horizon throughout as motion streaks through the frame', end: 'end on the same angle with time visibly passed' },
    at: (b, _p, c) => cam(b, { timeScale: c.a }),
  }),
  M({
    id: 'pass-through', name: 'Pass-through', group: 'special', ref: 'SHOT S6', aliases: ['pass through', 'pass-through', 'fly through', 'through the object', 'through the window', 'portal push'],
    about: 'A centred forward glide straight into an object, surface or opening and out the other side into the space beyond.',
    use: 'Transitions with a physical logic: through a screen into the app, through a window into the street.',
    avoid: 'When there is nothing on the far side to arrive in. It ends past the base subject on purpose.',
    defaults: { duration: 3, ease: 'smooth', intensity: 1 }, amount: { value: 1.15, unit: 'fraction', what: 'share of the subject distance travelled' },
    prompt: { name: 'pass-through camera move', motion: 'glide forward into a visible object, surface or opening and continue through it', speed: 'a smooth, centred glide', framing: 'the opening or surface stays centred as the crossing point', end: 'arrive inside the space revealed beyond it' },
    at: (b, p, c) => { const d0 = len(sub(b.target, b.pos)); const s1 = dolly(b, d0 * c.a * p); return cam(s1, { target: { x: s1.target.x, y: s1.target.y, z: Math.min(s1.target.z, s1.pos.z - 1) } }); },
  }),

  // ── Edit: what an editor needs that a gen-AI catalogue never lists (all flat-frame safe) ──
  ...pair('punch', ['in', 'out'], (dir, s) => ({
    id: `punch-${dir}`, name: `Punch ${dir}`, group: 'edit', ref: 'editor grammar (R4 edit styles: 115-140 % punch-ins on word boundaries)',
    aliases: dir === 'in' ? ['punch in', 'jump zoom', 'jump cut zoom', 'cut in', 'tighten', 'punch'] : ['punch out', 'cut out', 'back to wide', 'release'],
    about: dir === 'in' ? 'An instant reframe tighter (no visible motion), aimed at a point if given; it holds until the next call. The talking-head editor\'s basic cut.' : 'Jumps from a tight reframe back to the base framing in one frame.',
    use: dir === 'in' ? 'On a word boundary to mark a key word or a new thought; alternate with punch out so a single take feels like two cameras.' : 'Resets after a punch in; the next thought, or a breath.',
    avoid: 'Two punches inside one second; punching past ~1.4x on low-resolution footage (it goes soft).',
    defaults: { duration: 0.1, ease: 'cut', intensity: 1 }, amount: { value: 1.15, unit: 'x', what: 'zoom factor' },
    prompt: { name: dir === 'in' ? 'hard cut to a tighter framing (punch in)' : 'hard cut back to the wider framing', motion: 'no camera move: the shot jumps to a new framing in a single cut', speed: 'instant', framing: 'same angle and subject, only the framing changes', end: dir === 'in' ? 'hold the tighter frame' : 'hold the wide frame' },
    at: (b, p, c) => (s > 0 ? zoom(aim(b, c.at, p), lerpLog(1, c.a, p)) : zoom(aim(b, c.at, 1 - p), lerpLog(c.a, 1, p))),
  })),
  M({
    id: 'speed-ramp', name: 'Speed-ramp push (A → 2× → 0.5× → 2× → B)', group: 'edit', ref: 'premium edit grammar (Ishaan, 2026-10-18: "A→2x→0.5x→2x→B, an advanced camera effect at many places")', premium: true,
    aliases: ['speed ramp', 'speed-ramp', 'time ramp', 'time remap', 'fast slow fast', 'ramp push', 'ramped push', 'speed ramp push'],
    about: 'A push toward a point on one smooth speed curve: it eases out of rest, speeds up to about 2× the average, glides through the middle at about 0.5× (the beat the eye reads), speeds up again and settles into the end. No corners anywhere: an easing, not a hard time remap. The speed-ramp ease gives the same curve to any other move.',
    use: 'Reveals, a hero flying out of a crowd, a lockup moving to the header, scene-to-scene travel, any move that should feel edited rather than mechanical; pair the fast ends with motion blur and a whoosh, the slow middle with the key word.',
    avoid: 'Calm, sincere beats; moves under 0.5 s (the ramp cannot read); stacking two ramps back to back with no rest.',
    defaults: { duration: 1.6, ease: 'speed-ramp', intensity: 1 }, amount: { value: 1.35, unit: 'x', what: 'end zoom factor' },
    prompt: { name: 'speed-ramped push in', motion: 'the camera pushes toward the subject, fast at the start, slowing to a crawl through the middle, then snapping forward to the end', speed: 'fast, then slow motion, then fast again (2x, 0.5x, 2x)', framing: 'the subject stays centred while the distance closes', end: 'land tight on the subject' },
    at: (b, p, c) => zoom(aim(b, c.at, p), lerpLog(1, c.a, p)),
  }),
  M({
    id: 'pulse', name: 'Beat pulse', group: 'edit', ref: 'style-1 punch-in (1.0 → 1.06 on the key word → 1.02)',
    aliases: ['pulse', 'beat pulse', 'zoom bump', 'bump', 'zoom pulse', 'punch and settle', 'beat zoom'],
    about: 'A quick push in that lands on the beat and eases back to the framing: a heartbeat of the camera. The shape is fixed (fast attack, slow release); the ease only shapes the release.',
    use: 'Music beats, a spoken key word, a number landing; adds energy without leaving the shot.',
    avoid: 'Every beat (it becomes a throb); calm or sincere moments.',
    defaults: { duration: 0.6, ease: 'smooth', intensity: 1 }, amount: { value: 1.06, unit: 'x', what: 'peak zoom factor' },
    prompt: { name: 'quick zoom pulse on the beat', motion: 'a small, fast push in that springs back to the original framing', speed: 'a sharp hit then a soft release', framing: 'the subject stays centred', end: 'back on the original framing' },
    at: (b, _p, c) => { const atk = 0.22, q = c.u < atk ? EASE_SNAP(c.u / atk) : 1 - EASE_SMOOTH((c.u - atk) / (1 - atk)); return zoom(aim(b, c.at, q), lerpLog(1, c.a, q)); },
  }),
  M({
    id: 'shake', name: 'Impact shake', group: 'edit', ref: 'editor grammar (R4: slight shake on stamps)',
    aliases: ['shake', 'camera shake', 'impact', 'impact shake', 'screen shake', 'hit shake', 'rumble', 'jolt'],
    about: 'A short, decaying jolt of position and roll, as if something heavy just landed; deterministic noise, so every render matches.',
    use: 'A stamp, a slam, a bass drop, a bold claim landing; pair with an impact sound.',
    avoid: 'Text that must be read during the shake; more than one per beat; calm brands.',
    defaults: { duration: 0.4, ease: 'linear', intensity: 1 }, amount: { value: 0.08, unit: 'units', what: 'shake amplitude' },
    prompt: { name: 'sharp camera shake on impact', motion: 'the frame jolts as if hit, then steadies', speed: 'a violent first frame that dies away in a fraction of a second', framing: 'the subject stays in frame', end: 'settle back to a steady frame' },
    at: (b, _p, c) => { const d = (1 - c.u) ** 2; return zoom(shake(b, c.t, c.seed, c.a * d, 2.5 * c.k * d, 9), 1 + 0.6 * c.a * d); },
  }),
  M({
    id: 'drift', name: 'Drift', group: 'edit', ref: 'style-1 creep (+2.5 %/s after the last key) / Dark Vox drift (+1.5 %/s)',
    aliases: ['drift', 'creep', 'breathe', 'idle drift', 'float', 'subtle push', 'keep alive', 'living camera'],
    about: 'A barely visible, constant push with a slow float: the frame is alive without anything happening.',
    use: 'Under every held shot so nothing is ever dead still (Moovi law: every scene moves); talking heads, held titles, product stills.',
    avoid: 'When a deliberate lock-off is the joke or the point.',
    defaults: { duration: 3, ease: 'linear', intensity: 1 }, amount: { value: 1.04, unit: 'x', what: 'zoom over the move' },
    prompt: { name: 'very slow, almost imperceptible push in', motion: 'the camera creeps forward and floats very slightly', speed: 'extremely slow and constant', framing: 'the composition barely changes', end: 'a hair tighter than it began' },
    at: (b, p, c) => { const s1 = shift(b, { x: Math.sin(c.t * 0.7) * 0.02 * c.k, y: Math.sin(c.t * 0.9 + 1) * 0.015 * c.k }); return zoom(s1, lerpLog(1, c.a, p)); },
  }),
  ...pair('dive', ['in', 'out'], (dir, s) => ({
    id: `dive-${dir}`, name: `Dive ${dir}`, group: 'edit', ref: 'style-1 dive-to-detail (wide → 1.9x on a detail)',
    aliases: dir === 'in' ? ['dive in', 'dive to detail', 'zoom to', 'zoom into', 'zoom to point', 'push to detail', 'focus on detail'] : ['dive out', 'zoom out from detail', 'back out of detail'],
    about: dir === 'in' ? 'Zooms in while sliding toward a point of the frame (`at`), so an off-centre detail ends up centred and big.' : 'Starts tight on a point of the frame and pulls back out to the full framing.',
    use: dir === 'in' ? 'Show the one thing that matters inside a busy frame: a number on a dashboard, a repo name, a face in a crowd.' : 'Answers "and where is that?": from the detail back to the whole.',
    avoid: 'A detail too small for the source resolution at the end scale; when the detail is already centred (use a zoom).',
    defaults: { duration: 1.2, ease: 'smooth', intensity: 1 }, amount: { value: 1.9, unit: 'x', what: 'zoom factor' },
    prompt: { name: dir === 'in' ? 'push in onto a detail' : 'pull back from a detail', motion: dir === 'in' ? 'the camera glides toward one small detail in the frame and fills the frame with it' : 'start close on a small detail and glide back to reveal the whole frame', speed: 'smooth and purposeful', framing: dir === 'in' ? 'the detail moves to the centre as it grows' : 'the detail stays the anchor as the surroundings return', end: dir === 'in' ? 'hold the detail large and centred' : 'end on the full, original framing' },
    at: (b, p, c) => { const u = s > 0 ? p : 1 - p; return zoom(aim(b, c.at, u), lerpLog(1, c.a, u)); },
  })),
  M({
    id: 'reframe', name: 'Reframe', group: 'edit', ref: 'editor framing keys (EdlZoom: scale, cx, cy)',
    aliases: ['reframe', 'reframe on', 'move to', 'pan to', 'slide to', 'recentre', 'recenter', 'frame on'],
    about: 'Glides the frame so a point (`at`) becomes the centre, with an optional change of size (amount, default none).',
    use: 'Follow the action inside a wide shot: from the speaker to the screen, from one card to the next.',
    avoid: 'Jumps of more than half a frame (cut instead); when the point leaves the source (it shows the edge).',
    defaults: { duration: 0.8, ease: 'smooth', intensity: 1 }, amount: { value: 1, unit: 'x', what: 'zoom factor at the end' },
    prompt: { name: 'smooth reframe', motion: 'the camera glides sideways and up or down to centre a new point of interest', speed: 'smooth and quick', framing: 'the new point of interest settles in the centre', end: 'hold the new framing' },
    at: (b, p, c) => zoom(aim(b, c.at, p), lerpLog(1, c.a, p)),
  }),
  ...pair('ken-burns', ['in', 'out'], (dir, s) => ({
    id: `ken-burns-${dir}`, name: `Ken Burns ${dir}`, group: 'edit', ref: 'film grammar (stills animation)',
    aliases: dir === 'in' ? ['ken burns', 'ken burns in', 'pan and zoom', 'photo zoom', 'still push'] : ['ken burns out', 'photo pull out'],
    about: `A slow, steady zoom ${dir} that also slides toward (or away from) a point of the image: the classic way to bring a still photo to life.`,
    use: 'Photos, screenshots, documents, maps and any still in an edit; nostalgic, documentary, considered.',
    avoid: 'Video that already moves a lot; fast-paced cuts (it needs a few seconds).',
    defaults: { duration: 6, ease: 'linear', intensity: 1 }, amount: { value: 1.18, unit: 'x', what: 'zoom factor' },
    prompt: { name: `slow Ken Burns ${dir === 'in' ? 'push in' : 'pull out'} on a still image`, motion: `slowly zoom ${dir} while drifting across the image`, speed: 'slow, even and continuous', framing: 'the key area of the image stays in view throughout', end: `finish ${dir === 'in' ? 'closer on the key area' : 'on the whole image'}` },
    at: (b, p, c) => { const u = s > 0 ? p : 1 - p; return zoom(aim(b, c.at, u * 0.6), lerpLog(1, c.a, u)); },
  })),
  ...pair('roll', ['right', 'left'], (dir, s) => ({
    id: `roll-${dir}`, name: `Roll ${dir} (Dutch)`, group: 'edit', ref: 'film grammar (Dutch angle)',
    aliases: [`roll ${dir}`, `dutch ${dir}`, `dutch angle ${dir}`, `cant ${dir}`, ...(dir === 'right' ? ['dutch angle', 'dutch tilt', 'canted angle', 'roll'] : [])],
    about: `Rotates the picture around its centre (${dir === 'right' ? 'clockwise' : 'counterclockwise'}) into a canted horizon, zooming just enough to keep the corners covered.`,
    use: 'Unease, tension, something is off; a playful tilt on a meme beat.',
    avoid: 'Long holds (it tires); clean product and brand shots.',
    defaults: { duration: 1.2, ease: 'smooth', intensity: 1 }, amount: { value: 8, unit: 'deg', what: 'roll angle' },
    prompt: { name: `camera rolls into a Dutch angle to the ${dir}`, motion: `the camera rotates around its lens axis so the horizon tilts ${dir === 'right' ? 'down to the right' : 'down to the left'}`, speed: 'smooth', framing: 'the subject stays centred in the canted frame', end: 'hold the tilted horizon' },
    at: (b, p, c) => rollTo(b, s * c.a * p),
  })),
  M({
    id: 'roll-settle', name: 'Roll settle', group: 'edit', ref: 'style-1 roll-settle (1.1x at -1° → 1.0 level)',
    aliases: ['roll settle', 'settle', 'level out', 'straighten', 'handheld settle'],
    about: 'Opens a touch tight with a slight roll, then levels out and widens to the framing, as if an operator just found the shot.',
    use: 'The first shot of a beat; a human, cinematic way in instead of a hard static start.',
    avoid: 'Back to back on every shot (pick it for openings).',
    defaults: { duration: 1, ease: 'ramp-down', intensity: 1 }, amount: { value: 1.2, unit: 'deg', what: 'starting roll' },
    prompt: { name: 'slightly tilted frame that levels out', motion: 'start a little close with a small tilt, then straighten and ease back', speed: 'a quick settle that slows to rest', framing: 'the subject stays centred', end: 'a level, composed frame' },
    at: (b, p, c) => zoom(cam(b, { roll: b.roll - c.a * (1 - p) }), lerpLog(1 + 0.1 * c.k, 1, p)),
  }),
  ...pair('rack-focus', ['out', 'in'], (dir, s) => ({
    id: `rack-focus-${dir}`, name: `Rack focus ${dir === 'out' ? 'to background' : 'to subject'}`, group: 'edit', ref: 'film grammar (focus pull)',
    aliases: dir === 'out' ? ['rack focus', 'rack focus out', 'focus pull', 'pull focus', 'rack focus to background', 'focus to background', 'shift focus back'] : ['rack focus in', 'rack focus to subject', 'focus to subject', 'focus to foreground', 'shift focus forward'],
    about: `The camera stays still while the sharp plane slides ${dir === 'out' ? 'from the subject to the background' : 'from the background back to the subject'}; layers blur by their distance from it (\`depthBlur\`).`,
    use: 'Moves attention without moving the frame: from a person to what they are looking at, from a product to its context.',
    avoid: 'Flat footage (a filmed shot cannot be refocused: this needs layers Moovi builds); scenes with only one depth.',
    defaults: { duration: 1.2, ease: 'smooth', intensity: 1 }, amount: { value: 9, unit: 'units', what: 'depth travelled by the focus' },
    prompt: { name: `rack focus ${dir === 'out' ? 'from the subject to the background' : 'from the background to the subject'}`, motion: 'the camera holds still while the focus shifts between depths', speed: 'a smooth focus pull', framing: 'the composition does not change; only what is sharp does', end: `the ${dir === 'out' ? 'background' : 'subject'} is sharp and the rest soft` },
    at: (b, p, c) => cam(b, { focusZ: s > 0 ? -c.a * (1 - p) : -c.a * p, dof: 1.4 * c.k }),
  })),
];

/** Where each move can play (see `CameraScope`). Anything not listed is `edit`. */
const CODED = ['dolly-zoom-in', 'dolly-zoom-out', 'dolly-in', 'dolly-out', 'push-past', 'slider-left', 'slider-right', 'arc-left', 'arc-right', 'orbit-cw', 'orbit-ccw',
  'crane-up', 'crane-down', 'drone-push-in', 'drone-pull-back', 'infinite-zoom', 'earth-zoom-out', 'pass-through', 'rack-focus-in', 'rack-focus-out'];
const GEN = ['tracking', 'follow', 'reverse-tracking', 'side-tracking', 'low-tracking', 'vehicle-tracking', 'chase', 'snorricam', 'helicopter', 'first-person', 'time-lapse'];

/** Camera code that already existed in the repo and does the same job (so nobody builds it twice). */
const EXISTING: Record<string, readonly string[]> = {
  static: ['darkvox hold'],
  'slow-zoom-out': ['style-1 push-in (1.05 → 1.0: named a push, but in scale it settles outward)', 'style-1 reveal-pull', 'darkvox pull (1.55 → 1.0)'],
  'crash-zoom-out': ['style-1 opening-zoom-out (4x, exponential)', 'darkvox punch (1.13 → 1.0 in 0.42 s)'],
  'dolly-in': ['visual push'],
  'dolly-out': ['visual pull'],
  'truck-left': ['visual drift-left', 'darkvox slide (a fast truck with blur)'],
  'truck-right': ['visual drift-right', 'darkvox slide (a fast truck with blur)'],
  'arc-left': ['visual orbit (a ±12.6° arc)'],
  'arc-right': ['visual orbit (a ±12.6° arc)'],
  'pedestal-up': ['visual rise', 'darkvox rise (with a 1° roll settling)'],
  'tilt-up': ['visual tilt (a diagonal slide)'],
  'tilt-down': ['visual tilt (a diagonal slide)'],
  handheld: ['visual hand-held wobble (on every visual camera)'],
  'pass-through': ['darkvox portal and zoom-through cut', 'visual zoom-through transition'],
  'punch-in': ['editor rough cut (every other shot framed at 1.12)', 'darkvox reframe (mid-shot punch to 1.2)'],
  'punch-out': ['editor rough cut (every other shot back at 1.0)'],
  pulse: ['style-1 punch-in', 'style-1 roll-punch (pulse + roll-settle)'],
  drift: ['style-1 creep after the last key (+2.5 %/s)', 'darkvox drift (+1.5 %/s)'],
  'dive-in': ['style-1 dive-to-detail'],
  reframe: ['editor framing keys (EdlZoom)'],
  'roll-settle': ['style-1 roll-settle', 'style-1 pull-out (its roll)'],
};

export const CAMERA_MOVES: readonly CameraMove[] = ENTRIES.map(m => ({
  ...m, scope: GEN.includes(m.id) ? 'gen' : CODED.includes(m.id) ? 'coded' : 'edit', existing: EXISTING[m.id] ?? [],
}));

/** The moves a flat-frame editor can render (scope `edit`), and the ones for coded 3D scenes too. */
export const editorMoves = () => CAMERA_MOVES.filter(m => m.scope === 'edit');
export const codedMoves = () => CAMERA_MOVES.filter(m => m.scope !== 'gen');

export const CAMERA_MOVE_IDS = CAMERA_MOVES.map(m => m.id);
const BY_ID = new Map(CAMERA_MOVES.map(m => [m.id, m]));
export const cameraMove = (id: string): CameraMove | undefined => BY_ID.get(id);
