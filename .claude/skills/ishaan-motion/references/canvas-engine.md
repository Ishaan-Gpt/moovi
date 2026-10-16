# Canvas engine (tested port for browser previews, 2026-10-16)

Plain canvas 2D, no build step, everything a pure function of `t` (seconds). Proven on the R1 rebuild
(1080x1920, 88.6 s, ~2,600 frames swept with no errors, identical pixels on re-render). Lift these as-is.

## Core
```js
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, k) => a + (b - a) * k;
const prog = (t, t0, d) => clamp((t - t0) / d);

// cubic-bezier solved by bisection: Newton fails on the steep 'hard' ramp (derivative ~0 at the ends)
function bez(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const X = u => ((ax * u + bx) * u + cx) * u, Y = u => ((ay * u + by) * u + cy) * u;
  return x => { if (x <= 0) return 0; if (x >= 1) return 1; let lo = 0, hi = 1, u = x;
    for (let i = 0; i < 22; i++) { u = (lo + hi) / 2; if (X(u) < x) lo = u; else hi = u; } return Y(u); };
}
const E = { ramp: bez(.86, 0, .07, 1), hard: bez(.95, 0, .05, 1), out: bez(.16, 1, .3, 1),
  outBack: bez(.34, 1.32, .64, 1), in: bez(.7, 0, .84, 0), settle: x => 1 - Math.pow(1 - clamp(x), 4) };

// closed-form damped spring (pop overshoots ~10%, firm barely, soft slow)
const SPRING = { pop: [13, 190, .9], firm: [20, 210, 1], soft: [26, 120, 1] };
function spring(t, kind = 'pop') { if (t <= 0) return 0; const [c, k, m] = SPRING[kind], w0 = Math.sqrt(k / m), z = c / (2 * Math.sqrt(k * m));
  if (z >= 1) return 1 - Math.exp(-w0 * t) * (1 + w0 * t); const wd = w0 * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + (z * w0 / wd) * Math.sin(wd * t)); }

const logLerp = (a, b, k) => Math.exp(Math.log(a) + (Math.log(b) - Math.log(a)) * k);
const logPull = (S0, k) => Math.pow(S0, Math.pow(1 - clamp(k), 4));   // S0 -> 1, fast start: cut in on motion
const drift = (dt, A, B, tau) => A * (1 - Math.exp(-Math.max(0, dt) / tau)) + B * Math.max(0, dt);
const vel = (fn, t) => fn(t + 1 / 120) - fn(t - 1 / 120);              // px per 60 fps frame
const shutter = (v, cap = 40) => Math.min(cap, Math.abs(v) * .28);

function rand(seed) { let t = (seed * 2654435761 + 0x6d2b79f5) | 0; t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
function noise(x, seed = 0) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);   // smooth, [-1, 1]
  return lerp(rand(i * 7 + seed * 131) * 2 - 1, rand((i + 1) * 7 + seed * 131) * 2 - 1, u); }
const stagger = (base, i, gap, seed = 1) => base + i * gap + (rand(i * 17 + seed) - .5) * gap * .6;
```

## Type
- **Word-by-word line with re-flow:** per word `k = prog(t, word.at, .3)`; slot width `= (w + gap) * E.out(k)`;
  total = sum − gap; start x = centre − total/2. Draw each visible word with alpha `clamp(k*3)`,
  `filter = blur(lerp(9, 0, E.out(k*1.4)))` only while > 0.3 px, fill mixed grey → white by `E.out(k)`, y + 12·(1−e).
- **Slam:** `scale = logPull(1.45, E.out(prog(t, at, .26)))`, plus 1–4 ghost copies at slightly larger scale and 16%
  alpha while the edge speed `|vel(scale)| * 900` is above ~2 px/frame. Fit condensed type to a max width before scaling.
- **Slot roll (A → B):** per character, clip to a band one cap-height tall; the old glyph moves up by `E.ramp(k)·0.9·px`
  and fades, the new one comes from below; shared characters don't move; widths lerp so the line re-centres.
- **Typed line:** one word per voice stamp (keystroke SFX each), short blur-in, a caret blinking on a fixed clock.
- **Gradient fills on scaled text:** build the gradient in the text's own (pre-scale) coordinates spanning the actual
  glyph box (`baseline - capHeight … baseline`), or most of the word gets the end colour.

## Shots and transitions
- **Camera / parallax:** `plane(cam, depth, draw)` = translate to the focus, scale `1 + (s−1)·depth`, offset `·depth`.
  Wall 0.35, shelves 0.55, chair 0.8, subject 1, foreground 1.15.
- **Panel offscreen:** draw a panel into its own 1080x960 canvas (swap the global `ctx`), then composite with the entry:
  - wipe: `y = −960·(1 − E.out(prog(t, t0−.03, .34)))`, 2–4 ghosts at `y − i·v·.25`, alpha .18;
  - pixel dissolve: 54 px blocks revealed when `rand(block) < k·1.15` over ~0.12 s, a fringe band in the brand colour;
  - bars: 6 rows, alternating sides, `stagger()` starts, `E.out` over 0.3 s, union of rects as the clip.
  - **Always draw the outgoing shot underneath first.**
- **Depth-of-field card:** pre-render the poster once, plus a half-res copy blurred ~4–5 px (≈ 18 px at 2× zoom).
  Rack focus = filter blur on the sharp copy for 0.5 s, then the cached blur. Dive = `logLerp(1, 2, E.hard(k))` with the
  focus point lerped from the centre (keep the frame covered at every zoom). Whip = focus y with `E.hard`, ghost copies
  of the blurred layer along y.
- **Textures:** paper, grain and wall noise generated once from `rand(pixelIndex)` into offscreen canvases at load.

## Check tools
- `?grid=t1,t2,…` renders each t, draws the matching reference frame below it (`f/NNN.jpg` at 2 fps:
  `index = round(t·2) + 1`), labels the time. `&save=name.jpg` POSTs the sheet to a tiny local sink (a 10-line node
  server writing into the scratchpad) so it can be read back as an image.
- Sweep: `for (t = 0; t <= T; t += 1/15) try { frame(t) } catch {}` in chunks (one 30 fps sweep of 90 s in a single
  call can time out the browser tool).
- Do **not** call `getImageData` on the main canvas in a timing loop: it pulls the canvas off the GPU and every later
  frame costs 50–120 ms. Use it only for the determinism check.
- The app's browser pane caps rAF near 31 fps and throttles when hidden; measure real fps in a foreground browser
  before claiming performance.
