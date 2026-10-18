import * as THREE from "three";
import { E, V3, clamp01, kf, lerp, rand } from "./lib";

// Style 3 motion core. Pure functions of time (Remotion renders frames out of order, in parallel tabs: no state,
// no "previous frame"). Calibrated against the three @arsacre5 refs with styles/tools/s3_motion.py; the numbers in
// REF_RAMP and the comments are measured, not guessed (see .claude/skills/style-3/references/speed-ramps.md).

type Ease = (x: number) => number;
export const FPS24 = 24;

// ═══ 1 · Speed = time remapping ═══════════════════════════════════════════════════════════════════════════════════
// A shot has two clocks: the CAMERA's travel and the WORLD's time (objects, particles, cloth, lights). Each is a speed
// curve integrated over output time: scene time s(t) = ∫ speed dt. 0 = freeze (0x), 1 = real time, 2 = 2x,
// 8–30 = hyper, 0.1–0.4 = slow motion, < 0 = reverse. Ramp the world and the camera separately:
//   bullet time = world 0x + camera 1x orbit · slow-mo float = world 0.2x + camera 1x drift ·
//   hyperlapse = world 8x + camera fast and steady · speed ramp = both 1x → hyper → 1x.
export const SPEED = { freeze: 0, crawl: 0.1, slowmo: 0.25, half: 0.5, real: 1, double: 2, fast: 4, hyper: 12, warp: 30 } as const;

/** [output time (s), speed, ease into this key (default inOut)] */
export type SpeedKey = [number, number, Ease?];

/** A clock from speed keys. Build once at module level (it precomputes the integral).
 * time(t) = scene seconds elapsed SINCE THE FIRST KEY (0 at keys[0][0]; negative before it). */
export const clock = (keys: SpeedKey[], res = 480) => {
  const t0 = keys[0][0], t1 = keys[keys.length - 1][0];
  const speed = (t: number) => kf(t, keys as [number, number, Ease?][]);
  const n = Math.max(2, Math.ceil((t1 - t0) * res) + 1);
  const dt = (t1 - t0) / (n - 1) || 1;
  const cum = new Float64Array(n);
  let prev = speed(t0);
  for (let i = 1; i < n; i++) {
    const v = speed(t0 + i * dt);
    cum[i] = cum[i - 1] + (prev + v) * 0.5 * dt;
    prev = v;
  }
  const time = (t: number) => {
    if (t <= t0) return (t - t0) * keys[0][1];
    if (t >= t1) return cum[n - 1] + (t - t1) * keys[keys.length - 1][1];
    const x = (t - t0) / dt, i = Math.min(n - 2, Math.floor(x)), f = x - i;
    return cum[i] + (speed(t0 + i * dt) + speed(t)) * 0.5 * f * dt;
  };
  return { time, speed, t0, t1, total: cum[n - 1] };
};
export type Clock = ReturnType<typeof clock>;
export const realtime: Clock = { time: (t) => t, speed: () => 1, t0: 0, t1: 1e9, total: 1e9 };

// ── speed ramps, shaped like the refs ──
// Every measured ramp is a spike on a slow floor: a fast attack, a slower exponential decay. Frames are the 10 %
// points (attack: from 10 % to the peak, decay: peak back to 10 % above the floor), at 24 fps.
export type Ramp = { at: number; peak: number; attack?: number; decay?: number };
export const REF_RAMP = {
  // ref A "Bundance" (VO launch): 0.58 ramps/s, peak ≈ 26× floor, attack 2 f, decay 3 f, half land within 0.12 s of a word
  launch: { attack: 2, decay: 3, ratio: 26, perSecond: 0.58 },
  // ref B "SaasWAVE" (music only, 110 BPM): 0.76/s, 23×, attack 1.5 f, decay 5.5 f, 40 % sit on a cut (cut on motion)
  beat: { attack: 1.5, decay: 5.5, ratio: 23, perSecond: 0.76 },
  // ref C (dark VO essay): 0.38/s, 9×, attack 5.5 f, decay 6 f, mostly 3D parallax moves (gentle, symmetric)
  essay: { attack: 5.5, decay: 6, ratio: 9, perSecond: 0.38 },
} as const;

/** a unit spike at x = 0 (seconds): exp rise over `attack` frames, exp fall over `decay` frames (10 % points) */
export const pulse = (x: number, attack = 2, decay = 4, fps = FPS24) => {
  const ta = Math.max(attack, 0.25) / (2.303 * fps), td = Math.max(decay, 0.25) / (2.303 * fps);
  return x < 0 ? Math.exp(x / ta) : Math.exp(-x / td);
};

/** speed curve = floor + ramps (+ holds that pin the speed to 0 between [a, b]) */
export const rampSpeed = (floor: number, ramps: Ramp[], holds: [number, number][] = []) => (t: number) => {
  for (const [a, b] of holds) if (t >= a && t <= b) return 0;
  let v = floor;
  for (const r of ramps) v += (r.peak - floor) * pulse(t - r.at, r.attack, r.decay);
  return v;
};

/**
 * Normalised travel 0..1 over [t0, t1] whose velocity follows a speed shape: the camera covers the whole path,
 * with the timing the ramps give it. floor = the 1x drift; ramps peak in multiples of the floor.
 *   travel({ t0: 0, t1: 3, ramps: [{ at: 0, peak: 25, attack: 0, decay: 5 }] })   cut in on a whip, settle to drift
 *   travel({ t0: 0, t1: 3, ramps: [{ at: 3, peak: 20, attack: 6, decay: 0 }] })   drift, then ramp up into the cut
 */
export const travel = (o: { t0: number; t1: number; floor?: number; ramps?: Ramp[]; holds?: [number, number][]; res?: number }) => {
  const f = o.floor ?? 1;
  const sp = rampSpeed(f, o.ramps ?? [], o.holds ?? []);
  const n = Math.max(2, Math.ceil((o.t1 - o.t0) * (o.res ?? 480)) + 1);
  const dt = (o.t1 - o.t0) / (n - 1);
  const cum = new Float64Array(n);
  for (let i = 1; i < n; i++) cum[i] = cum[i - 1] + (sp(o.t0 + (i - 1) * dt) + sp(o.t0 + i * dt)) * 0.5 * dt;
  const total = cum[n - 1] || 1;
  const at = (t: number) => {
    if (t <= o.t0) return 0;
    if (t >= o.t1) return 1;
    const x = (t - o.t0) / dt, i = Math.min(n - 2, Math.floor(x)), fr = x - i;
    return lerp(cum[i], cum[i + 1], fr) / total;
  };
  /** instantaneous speed as a multiple of the floor (1 = 1x drift, 25 = the whip) */
  const mult = (t: number) => sp(t) / f;
  return Object.assign(at, { mult, t0: o.t0, t1: o.t1 });
};
export type Travel = ReturnType<typeof travel>;

/** classic keyed speed ramp for a clock: 1x → ramp up → hyper at `at` → back to 1x (or `after`) */
export const rampKeys = (at: number, o: { from?: number; peak?: number; after?: number; up?: number; down?: number } = {}): SpeedKey[] => [
  [at - (o.up ?? 0.35), o.from ?? 1],
  [at, o.peak ?? SPEED.hyper, E.in],
  [at + (o.down ?? 0.25), o.after ?? 1, E.out],
];

// ═══ 2 · Object motion (physical, closed form) ═══════════════════════════════════════════════════════════════════
/** damped spring 0 → 1 started at t0 (s). freq in Hz, zeta < 1 overshoots. Pops: 2.4 Hz, 0.45; soft lands: 1.6 Hz, 0.7 */
export const spring = (t: number, t0: number, freq = 2.4, zeta = 0.45) => {
  const x = t - t0;
  if (x <= 0) return 0;
  const w = 2 * Math.PI * freq;
  if (zeta >= 1) return 1 - Math.exp(-w * x) * (1 + w * x);
  const wd = w * Math.sqrt(1 - zeta * zeta);
  return 1 - Math.exp(-zeta * w * x) * (Math.cos(wd * x) + ((zeta * w) / wd) * Math.sin(wd * x));
};
export const springV3 = (t: number, t0: number, a: V3, b: V3, freq?: number, zeta?: number): V3 => {
  const k = spring(t, t0, freq, zeta);
  return [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
};

/** projectile with linear drag k (1/s): position at time t of a body launched at t0 from p0 with velocity v0 */
export const ballistic = (t: number, t0: number, p0: V3, v0: V3, g: V3 = [0, -9.81, 0], k = 0): V3 => {
  const x = Math.max(0, t - t0);
  if (k < 1e-4) return [0, 1, 2].map((i) => p0[i] + v0[i] * x + 0.5 * g[i] * x * x) as V3;
  const e = (1 - Math.exp(-k * x)) / k;
  return [0, 1, 2].map((i) => p0[i] + v0[i] * e + g[i] * (x / k - e / k)) as V3;
};

/** drop from y0 onto yFloor with bounces (restitution e): height at time t */
export const bounceFall = (t: number, t0: number, y0: number, yFloor: number, e = 0.35, g = 9.81) => {
  let x = t - t0;
  if (x <= 0) return y0;
  const h = y0 - yFloor;
  const tf = Math.sqrt((2 * h) / g);
  if (x < tf) return y0 - 0.5 * g * x * x;
  x -= tf;
  let v = g * tf * e;
  for (let k = 0; k < 6 && v > 0.05; k++) {
    const tb = (2 * v) / g;
    if (x < tb) return yFloor + v * x - 0.5 * g * x * x;
    x -= tb;
    v *= e;
  }
  return yFloor;
};

/** idle float: a slow bob + sway that never stops (amp in metres) */
export const floatIdle = (t: number, seed: number, amp = 0.01): V3 => [
  amp * 0.6 * Math.sin(t * 0.9 + seed * 2.1),
  amp * Math.sin(t * 1.3 + seed * 1.7),
  amp * 0.4 * Math.sin(t * 0.7 + seed * 3.3),
];
/** tumbling rotation for debris / floating props: radians, rate in rad/s (use a world clock for slow-mo) */
export const tumble = (s: number, seed: number, rate = 1): V3 => [
  (rand(seed) - 0.5) * 6 + s * rate * (rand(seed + 1) - 0.5) * 2,
  (rand(seed + 2) - 0.5) * 6 + s * rate * (rand(seed + 3) - 0.5) * 2,
  (rand(seed + 4) - 0.5) * 6 + s * rate * (rand(seed + 5) - 0.5) * 2,
];

/** burst i of n out of an origin (toward +z = camera by default): ballistic with drag, so it flies then hangs */
export const burst = (i: number, s: number, o: { origin: V3; speed?: number; spread?: number; toward?: V3; drag?: number; g?: number; seed?: number }) => {
  const seed = (o.seed ?? 7) + i * 11;
  const dir = new THREE.Vector3(...(o.toward ?? [0, 0, 1])).normalize();
  const sp = o.spread ?? 0.9;
  const d = dir.clone().add(new THREE.Vector3((rand(seed) - 0.5) * 2 * sp, (rand(seed + 1) - 0.5) * 2 * sp, (rand(seed + 2) - 0.5) * 2 * sp)).normalize();
  const v = (o.speed ?? 3) * (0.6 + 0.8 * rand(seed + 3));
  const pos = ballistic(s, 0, o.origin, [d.x * v, d.y * v, d.z * v], [0, -(o.g ?? 1.5), 0], o.drag ?? 2.2);
  return { pos, rot: tumble(s, seed, 2.5) };
};

// ═══ 3 · Paths ═══════════════════════════════════════════════════════════════════════════════════════════════════
/** a smooth path through points (centripetal Catmull-Rom: no loops/overshoot), evaluated by arc length */
export const path = (pts: V3[], closed = false) => {
  const c = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), closed, "centripetal");
  c.arcLengthDivisions = 400;
  const at = (u: number): V3 => {
    const v = c.getPointAt(clamp01(u));
    return [v.x, v.y, v.z];
  };
  const tangent = (u: number): V3 => {
    const v = c.getTangentAt(clamp01(u));
    return [v.x, v.y, v.z];
  };
  return Object.assign(at, { tangent, len: c.getLength(), curve: c }); // (a function's `length` is read-only)
};
export type Path = ReturnType<typeof path>;

/** walking/stride cadence for hyperlapse moves: a small vertical + roll bob at `hz` steps per second */
export const stride = (t: number, hz = 2.2, amp = 0.012) => ({ y: amp * Math.abs(Math.sin(Math.PI * hz * t)) - amp * 0.5, roll: amp * 0.6 * Math.sin(Math.PI * hz * t) });
