/**
 * The camera layer's core: one camera state, the easing presets, deterministic noise, and the adapters that turn a state
 * into a CSS 3D camera (the DOM runtime), a flat zoom key (the 2D runtimes: style-1 `CamKey`, MotionEasy) or a three.js
 * camera. A move (./moves.ts) is a pure function of eased progress and seconds, so a frame is the same on every run.
 *
 * World: y up, units are arbitrary. The subject sits at the origin; at rest the camera stands REST.z in front of it
 * (+z), looks at it, and the z = 0 plane fills the frame height exactly. A plane at z = d is a layer at depth d.
 */

export interface Vec3 { x: number; y: number; z: number }

export interface CamState {
  /** camera position */
  pos: Vec3;
  /** the point the camera looks at */
  target: Vec3;
  /** vertical field of view, degrees (zooms change this; dollies move `pos`) */
  fov: number;
  /** roll around the view axis, degrees (positive = the picture turns clockwise on screen) */
  roll: number;
  /** where the subject is: tracking shots carry it, so a renderer moves the hero layer by this much */
  subject: Vec3;
  /** tilt-shift: height of the sharp band as a fraction of the frame (0 = off) */
  focusBand: number;
  /** time-lapse: how fast the scene's own animation should run (1 = real time) */
  timeScale: number;
  /** rack focus: the depth (world z) that is sharp */
  focusZ: number;
  /** rack focus: blur per unit of depth away from focusZ (0 = everything sharp); see `depthBlur` */
  dof: number;
}

export const REST: CamState = Object.freeze({
  pos: Object.freeze({ x: 0, y: 0, z: 10 }),
  target: Object.freeze({ x: 0, y: 0, z: 0 }),
  fov: 40,
  roll: 0,
  subject: Object.freeze({ x: 0, y: 0, z: 0 }),
  focusBand: 0,
  timeScale: 1,
  focusZ: 0,
  dof: 0,
}) as CamState;

export const v3 = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z });
export const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
/** Interpolate in log space: zoom factors and distances feel even this way. */
export const lerpLog = (a: number, b: number, u: number) => Math.exp(lerp(Math.log(a), Math.log(b), u));
export const clamp01 = (u: number) => (u < 0 ? 0 : u > 1 ? 1 : u);
const RAD = Math.PI / 180;

/** Clone a state with some fields replaced. */
export function cam(base: CamState, o: Partial<CamState> = {}): CamState {
  return {
    pos: { ...(o.pos ?? base.pos) }, target: { ...(o.target ?? base.target) }, subject: { ...(o.subject ?? base.subject) },
    fov: o.fov ?? base.fov, roll: o.roll ?? base.roll, focusBand: o.focusBand ?? base.focusBand, timeScale: o.timeScale ?? base.timeScale,
    focusZ: o.focusZ ?? base.focusZ, dof: o.dof ?? base.dof,
  };
}

// ── easing ──

/**
 * Easing presets a director can name. "ramp up" = starts slow and accelerates (ease-in); "ramp down" = arrives fast and
 * settles (ease-out); "smooth" = both; "snap" = an expo-out hit (crash zooms, whips land); "whip" = a quint in-out with a
 * violent middle; "linear" = constant speed (pans, slider, time-lapse drift).
 */
export const EASES = {
  linear: (u: number) => u,
  'ramp-up': (u: number) => u * u * u,
  'ramp-down': (u: number) => 1 - (1 - u) ** 3,
  smooth: (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2),
  snap: (u: number) => (u >= 1 ? 1 : 1 - 2 ** (-10 * u)),
  whip: (u: number) => (u < 0.5 ? 16 * u ** 5 : 1 - (-2 * u + 2) ** 5 / 2),
  /** lands a touch past the mark and settles back (back-out): a jelly, Moovi-touched landing */
  overshoot: (u: number) => 1 + 2.70158 * (u - 1) ** 3 + 1.70158 * (u - 1) ** 2,
  /** no motion at all: jumps to the end on the first frame (the editor's jump-cut punch-in) */
  cut: (u: number) => (u > 0 ? 1 : 0),
  /** PREMIUM speed ramp (time remap): A → 2× → 0.5× → 2× → B. Leaves already moving at twice the average speed, slows to
   *  half speed through the middle (the look-at-this moment), whips out at 2× into B: what a premium edit does instead of
   *  one even 1× move. Velocity is 2× for the first and last sixth and 0.5× for the middle two thirds, joined smoothly. */
  'speed-ramp': (u: number) => speedRamp(u),
} as const satisfies Record<string, (u: number) => number>;
export type EaseId = keyof typeof EASES;

/** the speed-ramp curve: integrate v(u) = 0.5 + 1.5·g(u) (g = 1 near both ends, 0 in the middle, smooth joins), normalised */
const RAMP = (() => { const n = 512, v = (u: number) => { const sm = (e0: number, e1: number, x: number) => { const k = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return k * k * (3 - 2 * k); }; return 0.5 + 1.5 * Math.max(1 - sm(0.1, 0.24, u), sm(0.76, 0.9, u)); };
  const acc = [0]; for (let i = 1; i <= n; i++) acc.push(acc[i - 1]! + (v((i - 0.5) / n)) / n); const tot = acc[n]!; return acc.map(a => a / tot); })();
function speedRamp(u: number): number { if (u <= 0) return 0; if (u >= 1) return 1; const f = u * (RAMP.length - 1), i = Math.floor(f); return RAMP[i]! + (RAMP[i + 1]! - RAMP[i]!) * (f - i); }

// ── deterministic noise (handheld, vehicle shake) ──

/** Smooth pseudo-noise in [-1, 1]: a sum of incommensurate sines, phase-shifted by seed and channel. Same input, same output. */
export function wobble(t: number, seed = 0, channel = 0): number {
  const s = seed * 12.9898 + channel * 78.233;
  return (Math.sin(t * 1.31 + s) * 0.5 + Math.sin(t * 2.71 + s * 1.7) * 0.3 + Math.sin(t * 5.17 + s * 2.3) * 0.2);
}

// ── derived quantities ──

export const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const len = (a: Vec3) => Math.hypot(a.x, a.y, a.z);

/** Yaw (degrees, positive = turned right) and pitch (degrees, positive = looking up) of the view direction. */
export function orientation(s: CamState): { yaw: number; pitch: number } {
  const d = sub(s.target, s.pos), l = len(d) || 1;
  return { yaw: Math.atan2(d.x, -d.z) / RAD, pitch: Math.asin(Math.max(-1, Math.min(1, d.y / l))) / RAD };
}

/** The height of the z = 0 plane the rest frame shows, in world units. */
export const restFrameHeight = () => 2 * REST.pos.z * Math.tan((REST.fov / 2) * RAD);

/**
 * Flat 2D framing of the plane at depth `z` (default the hero plane): which point of it sits at the frame centre (in
 * frame heights from the plane's centre, screen y down), how much bigger it reads than at rest, and the roll. This is
 * what a scale-and-pan runtime can show (style-1 `CamKey`, MotionEasy); turns of the camera read as slides, which is
 * the classic 2D pan. `carried` layers (the hero in a tracking shot) are measured relative to the subject.
 */
export function frame2d(s: CamState, z = 0, carried = false): { scale: number; cx: number; cy: number; roll: number } {
  const d = sub(s.target, s.pos), l = len(d) || 1, dir = { x: d.x / l, y: d.y / l, z: d.z / l };
  const off = carried ? s.subject : v3();
  const depth = s.pos.z - (z + off.z);
  const restDepth = REST.pos.z - z;
  // a ray that never meets the plane (looking away, or the plane is behind the camera): scale 0, centred
  const along = dir.z < -1e-6 && depth > 1e-6 ? depth / -dir.z : Infinity;
  const hit = Number.isFinite(along) ? { x: s.pos.x + dir.x * along, y: s.pos.y + dir.y * along } : { x: off.x, y: off.y };
  const h = 2 * restDepth * Math.tan((REST.fov / 2) * RAD);
  const scale = Number.isFinite(along) ? (restDepth / along) * (Math.tan((REST.fov / 2) * RAD) / Math.tan((s.fov / 2) * RAD)) : 0;
  return { scale, cx: (hit.x - off.x) / h, cy: -(hit.y - off.y) / h, roll: s.roll };
}

/** Rack focus: blur (px on an H px frame) for a layer at depth `z`, from how far it sits from the focused depth. */
export const depthBlur = (s: CamState, z: number, H = 1920) => s.dof * Math.abs(z - s.focusZ) * (H / 1920);

/**
 * A point of the current frame (x, y in 0..1 of its width and height, 0.5/0.5 = centre) as a world point on the plane
 * the camera looks at. Moves that aim somewhere ("dive to the top left", "reframe on the logo") use this.
 */
export function framePoint(s: CamState, at: readonly [number, number], aspect = 9 / 16): Vec3 {
  const d = len(sub(s.target, s.pos)), h = 2 * d * Math.tan((s.fov / 2) * RAD);
  return { x: s.target.x + (at[0] - 0.5) * h * aspect, y: s.target.y - (at[1] - 0.5) * h, z: s.target.z };
}

/** A style-1 `CamKey` for frame `f` on a W×H canvas (scale, the layout point at the frame centre, roll). */
export function toCamKey(s: CamState, f: number, W = 1080, H = 1920): [number, number, number, number, number] {
  const k = frame2d(s);
  return [f, k.scale, W / 2 + k.cx * H, H / 2 + k.cy * H, k.roll];
}

/**
 * A real 3D camera for the DOM. Put the layers inside a `world` element (transform-style: preserve-3d, origin at the
 * viewport centre, each layer placed with `translate3d(x·unit, -y·unit, z·unit)`) inside a `viewport` with the returned
 * `perspective`. Returns the viewport's perspective (px) and the world's transform. `unit` = px per world unit (the rest
 * frame shows H px of the z = 0 plane).
 */
export function cssCamera(s: CamState, H: number): { perspective: number; transform: string; unit: number } {
  const unit = H / restFrameHeight();
  const P = H / 2 / Math.tan((s.fov / 2) * RAD);
  const { yaw, pitch } = orientation(s);
  const c = s.pos;
  // the viewer sits at z = +P looking down -z; move the world so the camera lands there: translateZ(P) · R⁻¹ · T(-pos)
  const transform = `translateZ(${P.toFixed(2)}px) rotateZ(${s.roll.toFixed(3)}deg) rotateX(${pitch.toFixed(3)}deg) rotateY(${yaw.toFixed(3)}deg) translate3d(${(-c.x * unit).toFixed(2)}px,${(c.y * unit).toFixed(2)}px,${(-c.z * unit).toFixed(2)}px)`;
  return { perspective: P, transform, unit };
}

/** The bits of a three.js PerspectiveCamera the adapter touches (no three.js import here). */
export interface ThreeCameraLike {
  position: { set(x: number, y: number, z: number): unknown };
  up: { set(x: number, y: number, z: number): unknown };
  fov: number;
  lookAt(x: number, y: number, z: number): void;
  rotateZ(a: number): unknown;
  updateProjectionMatrix(): void;
}

/** Drive a three.js PerspectiveCamera from a state. `unit` scales world units to the scene's units. */
export function applyToThree(camera: ThreeCameraLike, s: CamState, unit = 1): void {
  camera.up.set(0, 1, 0);
  camera.position.set(s.pos.x * unit, s.pos.y * unit, s.pos.z * unit);
  camera.lookAt(s.target.x * unit, s.target.y * unit, s.target.z * unit);
  camera.rotateZ(s.roll * RAD);
  camera.fov = s.fov;
  camera.updateProjectionMatrix();
}
