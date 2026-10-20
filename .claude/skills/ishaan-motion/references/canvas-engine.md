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

## Smooth playback (measured, 2026-10-18)
Per-frame `ctx.filter = 'blur(...)'` and `shadowBlur` on many draws is what makes a canvas film hang: a Launch film
spent 165 s on one frame. Bake sprites once instead (`sprite(key, w, h, pad, draw)`, which renders into an offscreen
canvas with its shadow), plus blurred variants on first use (`blurOf(sprite, px)`, quantised to 0/2/4/7/11/16). Draw
them with `drawImage`. Blur a whole moving layer by drawing it into a small buffer and scaling it back up. Keep colours
in lookup tables, build patterns once, and warm all sprites at load. Check every frame at 30 fps (`render(f / 30)` in
headless Chrome) and count frames over 33 ms before calling a preview smooth. Reference: `data/freeform/resend-v9`.
- **Measure the way it plays** (2026-10-18): drive frames with `requestAnimationFrame` for 30 s and record the gaps
  between frames. A synchronous loop of `render(t)` over hundreds of frames piles up draw commands and reports
  multi-second flushes that never happen in playback. Resend v8 played at 11 fps (it hung); v10 plays at 138 fps with
  a median frame of 3 ms.
- **Blur variants without filters:** downsample twice and keep the small canvas (it is soft anyway; `drawImage`
  scales it up). Use 1 px levels at the low end. Convert every sprite and blur level to an `ImageBitmap` at load. Keep
  one layer buffer allocated for the whole film (resizing a canvas every frame reallocates it).

## 3D shots inside a canvas film (three.js, measured 2026-10-18)
- One `THREE.WebGLRenderer({ preserveDrawingBuffer: true })` for the film, one scene per 3D shot. `render(t)` poses the
  scene for `t`, renders it, and `drawImage`s the WebGL canvas onto the film canvas, so stills (`__render(t)`) and
  playback share one path. Type and overlays stay 2D on top.
- Render 3D at 3/4 size (1440×810) and scale it up: on an integrated GPU the stack went from 29 to 52 fps.
- Shadows: `PCFShadowMap` with `shadow.radius` for soft edges, maps at 1024. A scene that never moves computes its
  shadows once (`shadowMap.autoUpdate = false` + one `needsUpdate`).
- A screen inside 3D is a `CanvasTexture` on a `MeshBasicMaterial({ toneMapped: false })`; redraw and re-upload it
  only when its content changes (typing changes it ~12 times a second; a 960×600 texture, not 1280×800).
- Card faces are 2D canvases painted once (the film's own `txt`, `mark`, `cover` helpers, with X swapped), used as
  maps on the top face of a thin box (`[side, side, top, side, side, side]` materials).
- Colour: `outputEncoding = sRGBEncoding`, ACES filmic tone mapping, every material from the palette ramp.

## Soft fields (gradient worlds without filters)
Draw a few big radial blobs into a 160×90 canvas and scale it up to the frame with `imageSmoothingQuality = 'high'`.
It is perfectly smooth and costs almost nothing. Animate the blob centres slowly (sin/cos at 0.3 rad/s). A sweep from
one field to another: paint the second field into a second 160×90 canvas, mask it with `destination-in` and a radial
gradient (opaque to 62 %, soft to the edge), and draw it over the first. A hard `clip()` circle shows a stair edge.

## Video plates and the clock
Start every clip on Play and keep it decoding; a clip that starts or seeks mid-film stalls a frame. Plates never
need frame sync; only stills seek (posters). Glass: copy the frame behind into a 1/4 canvas, then a 1/16 one, draw that
back clipped to the card (a blur with no filter), then a tint, a rim and a top sheen.

## Bugs that cost a round (CaptionsEasy keynote, 2026-10-21)
- **Scene-local time.** A scene function gets the film time `t` and its own `lt`; every in-scene entry, exit and
  transition (`ph(lt,0,…)`, `ph(lt,d-…,…)`) must read `lt`. Using `t` blanked three whole scenes (an exit overlay was
  "already finished") and skipped a bridge. Words keyed to voice stamps read `t`.
- **A word helper multiplies the parent alpha** (`g.globalAlpha *= …`), or a fading line under `save(); globalAlpha=x`
  stays fully opaque and two lines overprint.
- **A ring (iris) as an even-odd fill:** `rect(); moveTo(cx+r,cy); arc(cx,cy,r,0,2π,true); fill('evenodd')`. Without
  the `moveTo` the arc joins the rect's corner and draws a wedge.
- **Order:** an iris is drawn before the bridge element that rides on it (the logo), or it covers it.
- **Hidden preview pane:** rAF does not fire when the pane is off screen (audio keeps running). Verify the clock by
  stubbing rAF and calling `loop(performance.now())` twice a second apart; render stills with headless Chrome
  (playwright-core in the engine, `renderAt(t)` → JPEG) instead of pane screenshots.
