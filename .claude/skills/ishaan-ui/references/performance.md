# Performance: premium means fast

A site that stutters or shifts can't feel premium, however good it looks. Motion-heavy sites stay fast by doing three things: loading late, animating cheap properties, and measuring instead of assuming.

## Contents
1. Budgets
2. Lazy loading: what loads when
3. Images, video, fonts
4. Animating cheaply
5. Heavy visuals (WebGL, canvas, SVG filters)
6. Layout stability and hydration
7. Measuring

---

## 1. Budgets
Agree them at the start and check them at the end:
- LCP < 2.5s on a mid phone; the hero's text and primary action render before any 3D or video.
- CLS < 0.05; INP < 200ms.
- JS for the first screen as small as you can make it; animation libraries are fine, three of them are not.
- Hero art: skies/backgrounds 10–60KB WebP/AVIF; one large raster at most above the fold.
- 3D: a code-drawn shader or a GLB ≤ 3MB (Draco/meshopt compressed), loaded after LCP.
- 60fps for scroll and motion on a mid laptop; degrade (quality tiers) rather than drop frames.

## 2. Lazy loading: what loads when
Think in waves:
1. **First paint**: HTML, critical CSS, fonts (preloaded, `font-display: swap` with metric-matched fallbacks via the framework font loader), the hero copy and primary action, the intro overlay (if any) decided by an inline script before paint.
2. **After LCP / on idle**: smooth scroll, the 3D/canvas renderer, below-the-fold section code. Use dynamic `import()` behind `requestIdleCallback` (fallback `setTimeout`) or after the intro's "done" event.
3. **On approach**: images, videos, iframes and heavy sections when they come within ~1–2 viewports (`loading="lazy"`, an `IntersectionObserver` with a generous `rootMargin`, or `next/dynamic` with `ssr:false` for client-only widgets).
4. **On intent**: prefetch routes on `pointerenter`/`touchstart`/`focusin` of links; warm up modals on hover.

Give every lazy thing a placeholder that has the final size (aspect-ratio boxes, a blurred tiny image, a skeleton in the component's own shape) so nothing jumps.

## 3. Images, video, fonts
- Use the framework image component or `srcset`/`sizes`; AVIF/WebP; explicit width/height or aspect-ratio.
- Pre-render procedural art to static images (see `assets.md`); never ship live SVG noise filters for backgrounds.
- Background video: muted, `playsinline`, `preload="none"` until near, a poster frame, pause when offscreen (`IntersectionObserver`) and when the tab is hidden; offer no-motion stills.
- Fonts: at most two families plus mono; subset; variable fonts where they replace several weights; load through the framework loader to avoid layout shift.

## 4. Animating cheaply
- Animate `transform` and `opacity`. Treat `filter: blur()` as a short entrance effect, then clear it (`clearProps`), and never on large areas every frame.
- Never animate `width/height/top/left/margin`, `box-shadow` on big elements, or `backdrop-filter`.
- Write per-frame values to transforms or CSS variables on one element; read layout once (or never) per frame. A read after a write forces layout; batch reads first.
- `will-change` only on elements that are actually animating (a few at a time), and only while they animate.
- Pause what isn't visible: rAF loops, canvases, videos and CSS loops stop when offscreen or when `document.hidden`.
- Respect `prefers-reduced-motion`: render final states; no scrubbed transforms, no loops.

## 5. Heavy visuals (WebGL, canvas, SVG filters)
See `3d.md` for the full pattern. In short: lazy-load after LCP; quality tiers by device; render below native resolution (0.6–0.8× DPR) because soft visuals don't need full res; adaptive resolution when frames run long; pause offscreen and in hidden tabs; handle context loss; a static fallback without WebGL.

SVG filters (lighting, displacement, blur) are fine on small or static elements; on large areas, rasterise them once (an image) or move them into the shader.

## 6. Layout stability and hydration
- Reserve space for everything that loads later.
- Values that differ between server and client cause hydration errors: `Date.now()`, locale formatting, random numbers, long floating-point SVG coordinates. Round coordinates, seed randomness, compute time-dependent text after mount.
- Decide intro/theme visibility before first paint with a tiny inline script that sets an attribute on `<html>`; style off that attribute.

## 6b. Resilience
- Gate hidden-until-revealed states behind `html.js`, and unhide everything after a timeout if motion never boots.
- A service worker that caches the shell, fonts, art and data, network-first for navigations with a cached fallback after a few seconds, makes a sleeping free-tier host feel instant on return visits.
- A `?shot=<y>` query (or similar) that disables the intro and jumps to a scroll position makes screenshots and QA deterministic.

## 7. Measuring
- Claims are measured, never assumed. Lighthouse/PageSpeed for LCP/CLS/INP; the browser Performance panel for long frames.
- For shaders and renderers, build a benchmark: render N frames at a fixed size and read back once, run A/B alternated several times, compare medians. Report numbers with the method.
- `scripts/shoot.mjs` prints a frames-per-second readout per page; treat headless numbers as indicative only.
