# The Launch kit

Browser canvas code for the Launch style (`packages/engine/src/styles/launch.ts`, docs/LAUNCH.md). Everything here is
drawn in code from a palette, so every part re-skins to any brand. The files load in `manifest.json` order (runtime
first, the player last) into the live player page, and the same files run in a Node `vm` (no canvas) where the planner
calls each part's `plan()`.

## A part

```js
(function (L) {
  L.def('<library asset id>', {      // e.g. 'ui:glass-toolbar', 'transition:flood-contract-circle'
    kind: 'setup' | 'end' | 'type' | 'transition' | 'camera' | 'ui' | 'texture' | 'overlay',
    plan(b, F) { return { cues, events, exit, entry, min }; },   // pure: no canvas, no Date, no Math.random
    draw(S, o) { /* S.ctx at beat-local time S.lt */ },          // setups, end cards, ui, type, textures, overlays
    tr(S, A, B, k, o) { /* composite A (out) and B (in) */ },     // transitions
    cam(lt, d, o, S) { return { s, x, y, r }; },                 // camera moves
  });
})(globalThis.LAUNCH);
```

- The id IS the library asset id (`<category>:<slug>`), so FalkorDB, the caster and the player name a part the same way.
  Every asset with runtime `launch` must have a part here and every part must have an asset (tested).
- `plan()` gives beat-local seconds: `cues` (named moments the draw reads with `S.at(name)`), `events`
  (`[{at, event}]` sound cues; event names from `packages/engine/assets/sfx/map.json`: word, key-word, list-item, pop,
  cascade, bubble, card-in, slide-out, scene, hard-hit, stat, notify, accent, click-ui, code, ui-reveal, build,
  big-build, cta, page-turn, riffle, paper-pop, thud, tear), `exit`/`entry` anchors (frame fractions
  `{kind: 'dot'|'circle'|'pill'|'rect', x, y, w, h, r}`: a transition floods out of A's exit and contracts into B's
  entry), `min` (seconds the set-up needs; the beat is stretched to the next half bar).
- Pure functions of time. No `Math.random`, `Date`, timers or CSS animation: use `L.rand(seed)`, `L.noise`,
  `L.stagger`, `S.r(i)` (seeded per beat).

## What a draw gets

`S = { ctx, W, H, u, t, lt, d, b, F, look, P, src, cues, at(name), k(name, dur, ease), r(i), seed, cam }`

- `W × H` is the film's frame (1920×1080, 1080×1080, 1080×1920 or 1080×1350). Size everything from `u`
  (short side / 1080) and lay out from `W`, `H` (check `W/H` for wide vs tall). Never hard-code 1920.
- `P` is the beat's palette: `bg, bg2, fg, dim, rule, card, cardFg, accent, soft, ink, paper, accentRaw`.
  Colours come only from `P` and `S.look.palette` (+ `S.look.accent`). Never a hex of your own except neutral UI
  chrome (traffic lights, a phone bezel, the green of a success tick).
- `b.text.tokens` (`[{s, accent}]`), `b.text.eyebrow`, `b.text.sub`, `b.data` (`items`, `prompt`, `number`
  `{value, prefix, suffix, label}`, `ui`, `image`, `focus`), `F.brand` (`name, host, tagline`), `L.img(name)`
  (`logo`, `hero`, `mobile` when the site gave them).
- `src` is the canvas being drawn: glass samples it (`L.glass`).

## The runtime (runtime.js)

Motion: `clamp lerp prog smooth bez E.{ramp,hard,out,outBack,in,io,expo,apple,quick,settle} spring(t, kind)
springTrack(t, keys) tw kf logLerp logPull drift vel shutter rand hash noise stagger iho`.
Colour: `hex rgba mix lum contrast readable onColor`. Look: `palette(look, world) font(look, role, px, weight)`.
Text: `layout(ctx, look, tokens, {px, maxW, x, y, align, role, maxLines, lineH})` (measured, shrinks before it wraps,
balanced lines, no orphans) → `{words: [{x, y, w, px, li, tk}], H, lines, top, bottom}`; `drawWord`, `text(ctx, look,
s, x, y, {role, px, color, align, upper, maxW, weight, tracking})`, `textW`. Roles: `display accent micro ui wordmark
numeral`. Headline: `L.headline(S, slot)` draws the beat's headline with the beat's cast type treatment.
Drawing: `rr card(ctx,x,y,w,h,r,{fill,lift,u}) pill circle line bloom vignette grain dotGrid glass(ctx, src, x, y, w,
h, r, {u, dark, tint, blur})`, `icon(ctx, name, x, y, size, color)` (our own 24-unit line set; `L.icons`,
`L.iconFor(word)`), `drawCursor(ctx, x, y, {u, press, ring, halo, dark, blur})`, `cursorAt(path, t)`,
`pressAt(clicks, t)`, `L.cursorDraw(S, path, clicks)` (path in frame fractions), `applyCam focusCam`, `buffer(name,W,H)`.

## Taste (non-negotiable; from ishaan-motion and the twelve references)

- One idea per beat. Big confident type (a hero line is 9–14% of the frame height). Never a dead frame: something is
  arriving, settling or drifting on every frame; the camera is never still.
- Every arrival has micro-motion (spring, blur-in, lift, a soft shadow that grows) and a sound cue in `plan()`.
- Transitions are made of objects (floods that contract into the next object, iris blades, masks, dives, the accent
  dot); never a crossfade. No lens flares, no glow on everything, no random particles, no camera shake, no fake copy.
- UI is product-real: real icons, real density, real labels from `b.data`; a skeleton only where the real thing is
  missing. Fill the frame (a card is 40–70% of the frame width), never small widgets in empty space.
- Glass samples what is behind it. Shadows are stacked (contact + ambient). Text never overflows (use `layout`, `maxW`).
