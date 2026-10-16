// Motion core (ishaan-motion §9): every frame is a pure function of t. No Math.random, no timers, no CSS animation.
// AE speed ramps as cubic beziers, closed-form springs, log-space scale, velocity motion blur, seeded noise.
'use strict';
const W = 1080, H = 1920;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, k) => a + (b - a) * k;
const prog = (t, t0, d) => clamp((t - t0) / d);

/* cubic-bezier, solved by bisection (robust for the steep "hard" ramp) */
function bez(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const X = u => ((ax * u + bx) * u + cx) * u, Y = u => ((ay * u + by) * u + cy) * u;
  return x => {
    if (x <= 0) return 0; if (x >= 1) return 1;
    let lo = 0, hi = 1, u = x;
    for (let i = 0; i < 22; i++) { u = (lo + hi) / 2; if (X(u) < x) lo = u; else hi = u; }
    return Y(u);
  };
}
// motion-feel.md: the five curves that work
const E = {
  ramp: bez(0.86, 0, 0.07, 1),     // slow, whip, slow: the default move
  hard: bez(0.95, 0, 0.05, 1),     // camera moves and big pulls
  out: bez(0.16, 1, 0.3, 1),       // entries that land and glide
  outBack: bez(0.34, 1.32, 0.64, 1), // tiny overshoot, pops only
  in: bez(0.7, 0, 0.84, 0),        // accelerating away into a cut
  lin: x => clamp(x),
  // long soft settle: the last 5% of travel takes about a third of the time (quartic-ish tail)
  settle: x => 1 - Math.pow(1 - clamp(x), 4),
};

/* springs, closed form (pop shows a visible overshoot; firm barely any) */
const SPRING = { pop: [13, 190, 0.9], firm: [20, 210, 1], soft: [26, 120, 1] };
function spring(t, kind = 'pop') {
  if (t <= 0) return 0;
  const [c, k, m] = SPRING[kind], w0 = Math.sqrt(k / m), z = c / (2 * Math.sqrt(k * m));
  if (z >= 1) return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
  const wd = w0 * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + (z * w0 / wd) * Math.sin(wd * t));
}

/* tween + keyframe track. Interior keys use out/in eases so motion flows through instead of stopping. */
const tw = (t, a, b, from, to, ease = E.ramp) => lerp(from, to, ease(prog(t, a, b - a)));
function kf(t, keys) { // keys: [time, value, ease-into-this-key]
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) return tw(t, keys[i - 1][0], keys[i][0], keys[i - 1][1], keys[i][1], keys[i][2] ?? E.ramp);
  return keys[keys.length - 1][1];
}
const logLerp = (a, b, k) => Math.exp(Math.log(a) + (Math.log(b) - Math.log(a)) * k);
// big scale changes in log space: s = S0 ** ((1 - k) ** 4)
const logPull = (S0, k) => Math.pow(S0, Math.pow(1 - clamp(k), 4));
// float/drift settle: half quick ease-out, half steady drift; never fully still
const drift = (dt, A, B, tau) => A * (1 - Math.exp(-Math.max(0, dt) / tau)) + B * Math.max(0, dt);
// velocity -> shutter (180°): px of smear for a channel function f(t) at 60 fps
const vel = (fn, t) => (fn(t + 1 / 120) - fn(t - 1 / 120));
const shutter = (v, cap = 40) => Math.min(cap, Math.abs(v) * 0.28);

/* deterministic randomness */
function rand(seed) {
  let t = (seed * 2654435761 + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
// smooth 1D value noise in [-1, 1]
function noise(x, seed = 0) {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return lerp(rand(i * 7 + seed * 131) * 2 - 1, rand((i + 1) * 7 + seed * 131) * 2 - 1, u);
}
// jittered stagger (§5.5): never one shared start frame
const stagger = (base, i, gap, seed = 1) => base + i * gap + (rand(i * 17 + seed) - 0.5) * gap * 0.6;

/* brand tokens for this edit (one place) */
const C = {
  crimsonHot: '#d01a22', crimson: '#8c0b12', crimsonDeep: '#3a0306',
  paper: '#f6f1ea', ink: '#ffffff', dimInk: 'rgba(255,255,255,0.38)',
  ember: '#ffb070', emberCore: '#fff3dc', gold: '#ffe14a', ice: '#8fe8ff',
  roomTop: '#3d2b21', roomMid: '#2a1d16', roomLow: '#140d09',
};
const F = { cond: 'Anton', sans: 'InterTight', serif: 'Serif' };
