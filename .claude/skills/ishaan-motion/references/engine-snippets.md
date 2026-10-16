# Engine snippets (Remotion reference; port the same ideas to canvas)

```ts
// Beat grid
export const FPS = 60;
export const SPB = FPS * 60 / BPM;            // frames per beat
export const B = (n: number) => Math.round(n * SPB);

// AE-style eases
export const E = {
  ramp: Easing.bezier(0.86, 0, 0.07, 1),
  hard: Easing.bezier(0.95, 0, 0.05, 1),
  out: Easing.bezier(0.16, 1, 0.3, 1),
  outBack: Easing.bezier(0.34, 1.32, 0.64, 1),
  in: Easing.bezier(0.7, 0, 0.84, 0),
};

// Tween + keyframe track (ease applies INTO each key; use E.out/E.in on interior keys so it flows through)
export const tw = (f, a, b, from, to, ease = E.ramp) =>
  interpolate(f, [a, b], [from, to], { easing: ease, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
export const kf = (f, keys: [number, number, EaseFn?][]) => { /* walk pairs, tw between them */ };

// Springs
export const SPRING = {
  pop:  { damping: 13, stiffness: 190, mass: 0.9 },
  firm: { damping: 20, stiffness: 210, mass: 1 },
  soft: { damping: 26, stiffness: 120, mass: 1 },
};

// Log-space scale
const logLerp = (a, b, t) => Math.exp(Math.log(a) + (Math.log(b) - Math.log(a)) * t);

// Velocity -> motion blur (180° shutter)
export const vel = (fn, f) => fn(f + 0.5) - fn(f - 0.5);
export const shutter = (v, cap = 40) => Math.min(cap, Math.abs(v) * 0.28);

// Deterministic random (never Math.random)
export const rand = (seed) => { let t = (seed + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

// Jittered stagger
const start = (i) => base + i * gap + (rand(i) - 0.5) * gap * 0.6;
```

Directional motion blur in Remotion: an SVG `feGaussianBlur` with separate stdDeviation x/y wrapping the layer,
switched off below 0.3 px. On canvas: draw N sub-frame samples along the velocity vector, or use a GL directional blur pass.

Shot camera: wrap each shot in a transform whose scale goes 1.00 → 1.04 (or drifts) over the WHOLE shot, starting
already in motion (no ease-in at frame 0) and still moving at the last frame.
