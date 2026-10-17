# OpenDesign motion/video engine (HyperFrames + motion skills): notes for Moovi

Source: OpenDesign clone at commit 78d5637 (read-only). Paths below are relative to the OD repo root unless they
start with `moovi:`. Line numbers are from that commit. Nothing was built or run. Quotes are at most two lines;
everything else is paraphrase.

---------------------------------------------------------------------------------------------------------------------

## 0. One-paragraph answer

OpenDesign's video engine is HyperFrames (heygen-com/hyperframes, npm `hyperframes@0.8.1`, pinned in
`apps/daemon/package.json:58`, with `gsap@3.14.2` at :57). A film is one HTML file: a root
`[data-composition-id]` div carries `data-duration/width/height/fps`, child "clips" carry `data-start`,
`data-duration`, `data-track-index`, and ONE paused GSAP master timeline registered at `window.__timelines[id]` is
the only clock. The agent (a strong coding model: Claude Code / Codex) writes that HTML, guided by long prose skills
(`design-templates/hyperframes/**`, `skills/motion-design`), and the daemon renders it: inject a seek bridge, open a
hidden Electron Chromium window, for every frame `seek(i/fps)` → wait for seek completion / LUTs / two rAFs → CDP
`Page.captureScreenshot` PNG → bundled FFmpeg `libx264 yuv420p +faststart`, with authored `<audio>` tracks stripped
from the page and mixed by FFmpeg. Quality comes from (a) the rule text (house style, motion principles, transition
tables, typography bans), (b) a few deterministic QA tools (animation map, WCAG contrast audit, layout inspect),
(c) the best "templates" being code remakes of measured viral motion posts with beat maps and `render(t)` pure
functions, and (d) MIT craft packs vendored as skills, especially huashu-art-motion, whose explainer "grammar
cards" carry MEASURED numbers (shot lengths, camera ease medians, on-twos stepping) and a pulse camera.

---------------------------------------------------------------------------------------------------------------------

## 1. Composition model (scenes, clips, tracks, data attributes)

`design-templates/hyperframes/SKILL.md`
- :34 HTML is the source of truth; data attributes give timing, a GSAP timeline gives animation, CSS gives look.
- :252-262 every clip: `id`, `data-start` (seconds OR a clip-id reference such as `"el-1"` / `"intro + 2"`),
  `data-duration` (required for img/div/compositions; media defaults to its own length), `data-track-index`
  (same-track clips may not overlap; it does NOT set z-order, CSS z-index does), `data-media-start` (trim),
  `data-volume`.
- :265-273 composition clips: `data-composition-id`, `data-start`, `data-duration` (wins over GSAP length),
  `data-width/height`, optional `data-composition-src` (external file). Sub-compositions use a `<template>` wrapper;
  the standalone root must NOT (:277).
- :303-325 video is always `muted playsinline`; audio is a separate `<audio>` element even when it is the same file.
- :327-333 timeline contract: all timelines `{paused:true}`, registered in `window.__timelines`, sub-timelines are
  auto-nested by the framework, duration comes from `data-duration`, never pad with empty tweens.
- `patterns.md:72-189` PiP (animate a wrapper with NO data attrs), title card, slideshow (same track, sequential
  ranges auto-mount/unmount), top-level example with sub-compositions on their own tracks.
- `references/transitions/catalog.md:9-13` scene model inside one composition: scene 1 visible by default, scenes 2+
  `opacity:0` on the container, GSAP reveals them; only the root has timing attrs.

Weread 9:16 template (`skills/weread-year-in-review-video-template/assets/template.html:597-694`): 12 `section.scene.clip`
with explicit start/duration on track 10, and ONE loop that choreographs every scene by CSS role:
container y 26→0 (0.55 s power3.out) at start; `.kicker,h1,h2` at +0.08 (stagger 0.08, 0.6 s); `.visual>*` +0.35
(stagger 0.08, 0.72 s); `.mega,.persona` +0.45; bars `scaleX` +0.75 (stagger 0.04, 0.85 s); small chips +0.68 (stagger
0.07, 0.48 s power2.out); caption at +min(1.2, dur−1.2); exit y −18 / autoAlpha 0 at dur−0.46 (0.45 s); hard set at
dur. A role→offset choreography table (Moovi is already better: elements land on spoken words).

## 2. Timing grammar (beats, durations, eases, stagger, holds)

`skills/motion-design/SKILL.md`
- :59-62 defaults for an unconstrained short film: 12–18 s, 16:9 1920×1080, 30 fps, no invented VO.
- :64-72 beat map, one line per beat: `time → viewer takeaway → focal object → transformation → copy/audio → exit`,
  with ONE recurring motif (object/shape/line/type) linking the beats; example mechanism: words orbit → one attracts
  the rest → orbit becomes a timer → timer becomes the wordmark.
- :113-127 timing table: accent 120–220 ms; main arrival 350–650 ms; meaningful shape transform 600–1200 ms; large
  reveal / camera move 900–1800 ms. Ease-out arrivals, ease-in motivated exits, in-out cameras, linear only for
  mechanical motion; playful may overshoot, precise instruments should not.
- :129-142 anticipation + recovery on fast actions, arcs for physical paths, match-cut / track / mask / clean cut
  chosen by beat relationship, preserve velocity at hand-offs, alternate action and rest, loops match state AND
  velocity.

`design-templates/hyperframes/references/motion-principles.md`
- :7-12 guardrails aimed at LLM habits: no more than 2 independent tweens with the same ease in a scene; slowest
  scene ≥ 3× slower than the fastest; vary entry direction; per-scene stagger rhythm; vary ambient motion per scene;
  first animation offset 0.1–0.3 s (never t=0).
- :20-26 ease direction: `.out` entering, `.in` leaving, `.inOut` moving between positions.
- :28-33 speed tiers: 0.15–0.3 s energy, 0.3–0.5 professional, 0.5–0.8 gravity/luxury, 0.8–2.0 cinematic.
- :35-41 scene phases: build 0–30 %, breathe 30–70 % (ONE ambient motion), resolve 70–100 %.
- :51-57 the element that moves first reads as most important; stagger by importance not DOM order; total stagger
  sequence < 500 ms regardless of count; entrances longer than exits (0.4 vs 0.25 s).
- `SKILL.md:390-397` guardrails restated: ≥ 3 different eases per scene; no repeated entrance pattern in a scene;
  60 px+ headlines, 20 px+ body, 16 px+ labels; tabular-nums on number columns; avoid full-screen linear gradients on
  dark (H.264 banding).

`SKILL.md:361-388` scene transitions are non-negotiable: always transition between scenes; every element enters via
`gsap.from()`; NO exit animations before a transition (the transition IS the exit; outgoing content must be fully
visible when it starts); only the final scene may fade out.

## 3. House style (what makes it look premium)

`design-templates/hyperframes/house-style.md`
- :7-9 real content (a recipe lists real ingredients), declare bg/fg/accent before code, pick fonts first.
- :11-23 "lazy defaults" to question: gradient text, left-edge accent stripes, cyan-on-dark / purple→blue gradients /
  neon, pure #000 / #fff (tint toward the accent), identical card grids, everything centred with equal weight.
- :25-31 colour: light for food/wellness/kids, dark for tech/cinema/finance; ONE accent; same background across all
  scenes; tint neutrals toward the accent; contrast enforced by `validate`.
- :33-45 background layer: 2–5 persistent decoratives per scene (radial glows, ghost text at 3–8 % opacity, hairline
  rules, grain, thematic decoratives) and every decorative gets slow ambient motion.
- :55-71 nine palette families (`palettes/*.md`, each 8 rows of 5 hex) or derive from OKLCH.
`references/motion-principles.md:59-69` frame composition: ≥ 2 focal points, hero text 60–80 % of frame width,
≥ 3 layers (background treatment, content, accent elements), background never empty, anchor to edges, split frames /
zone layouts, structural rules that animate (scaleX from 0).
`SKILL.md:108-116` inside OD the identity gate is skipped and the default is dark canvas #0b0b0f, warm accent
#ffb76b, cool accent #7da4ff, restrained motion. `SKILL.md:161-176` outside OD, a HARD-GATE: no composition without
DESIGN.md / visual-style.md / named style / 3 mood questions; if you reach for #333, #3b82f6 or Roboto you skipped it.

## 4. Catalogue: patterns and visual styles

`visual-styles.md` eight named styles, each = designer tradition + palette + type + GSAP ease signature + shader:
Swiss Pulse (expo.out / power4.out, counters from 0, grid-locked, 80–120 px numbers) :24-40; Velvet Standard
(sine.inOut / power1, thin caps 0.15em tracking, long holds) :44-60; Deconstructed (back.out(2.5), steps(8),
elastic.out(1.2,0.4)) :64-80; Maximalist Type (expo.out, back.out(1.8), type 50–80 % of frame, 2–3 s scenes) :84-100;
Data Drift (sine.inOut, power2.out) :104-120; Soft Signal (sine.inOut, power1.inOut) :124-141; Folk Frequency
(back.out(1.6), elastic.out(1,0.5)) :145-161; Shadow Cut (power4.in exits, power3.out reveals, "pause before the
hit") :165-181. Mood→style table :185-196. Custom style recipe :200-211: name → 2–3 hex → one family two weights →
motion rules → transition → 2–3 anti-patterns.

Transitions (`references/transitions.md`):
- :83-91 energy → primary: calm (blur crossfade, focus pull; 0.5–0.8 s; sine.inOut/power1), medium (push slide,
  staggered blocks; 0.3–0.5 s; power2/3), high (zoom through, overexposure; 0.15–0.3 s; power4/expo). Pick ONE
  primary for 60–70 % of scene changes + 1–2 accents; never a different one per scene.
- :93-107 mood → transition types (warm, cold, editorial, tech, tense, playful, dramatic, premium, retro).
- :109-118 narrative position: opening = most distinctive (0.4–0.6 s); between related points = primary (0.3 s);
  topic change = something different; climax = boldest accent; wind-down = gentle (0.5–0.7 s); outro = slowest,
  simplest (0.6–1.0 s).
- :120-126 blur by energy: calm 20–30 px / 0.8–1.2 s / hold 0.3–0.5 s; medium 8–15 px / 0.4–0.6 s / hold 0.1–0.2;
  high 3–6 px / 0.2–0.3 s / no hold. Presets :128-137 (snappy 0.2 power4.inOut … luxe 0.7 power1.inOut).
- :179-181 avoid transitions that show repeating geometric grids; organic noise is fine.
- Per-type GSAP code: `references/transitions/css-*.md` (push, radial, 3d, scale, dissolve, cover, light,
  distortion, mechanical, grid, other, blur, destruction). Hard rules `catalog.md:5-29` (blind counts by energy:
  calm 4h/6v, medium 6–8h/8v, high 12–16h/16v; light-leak overlays ≥ 2400 px; glitch RGB at 35 % normal blend; page
  burn hides scene1 via `tl.set` never `onComplete`, for reversibility; banned: star iris, tilt-shift, lens flare,
  hinge).
- Shader transitions live in `@hyperframes/shader-transitions` (not in this repo); html2canvas-compat rules
  `transitions.md:166-177`.

Marker emphasis (`references/css-patterns.md`): highlight sweep (scaleX 0→1 0.5 s), hand circle (scale with
back.out(1.7), −3° tilt), burst (12 lines, lengths varied 40–80 px; equal lengths look mechanical), scribble
(stroke-dashoffset), sketchout. Energy mapping `dynamic-techniques.md:194`: burst = hype, circle = key terms,
highlight = standard, scribble = subtle.

Data (`data-in-motion.md:5-19`): successive stats of one concept stay in the same visual space and only the VALUE
changes; every number gets visual weight (fill bar, ring, shape); no pie, multi-axis, 6-panel dashboards,
gridlines/ticks/legends or chart libraries.

Frame templates (`skills/frame-*`, `vfx-text-cursor`): single-frame prompt recipes (glitch title, NYT chart with
staggered reveal: title 0 s, kicker 200 ms, line stroke-dashoffset 1.2 s from 400 ms, labels every 100 ms; light-leak
cinema; liquid hero; logo outro 4–8 geometric blocks ±100 px, scale 1.4→1, 80 ms stagger, 1.2 s; macOS notification;
sticky flowchart). They animate with `@keyframes` / `setTimeout`, which contradicts the determinism rules elsewhere.

Viral remakes (`plugins/_official/examples/motion-*`, `docs/motion-template-sources.md`): selected from a 1,483-case
library (top-10 % view threshold 255,312; like and save rates > 1 %) :11-31; each is one canvas, `render(t)` pure in
`t`, a `CFG` block with copy/palette/timing, a beat map in SKILL.md, an original soundtrack timed to the beats,
bundled OFL fonts, and a regression that seeks forward and backward with callbacks suppressed and requires identical
canvas output :146-149.

## 5. How the agent is told to write motion (constraints, banned moves)

- `SKILL.md:149-157` think What → Structure → Timing → Layout → Animate; `:180-248` "layout before animation": build
  the hero frame (most elements visible) as static CSS; `.scene-content` = full-size flex with padding, never an
  absolutely positioned content container; entrances `gsap.from()` (CSS is ground truth), exits `gsap.to()`.
- `SKILL.md:335-359` non-negotiables: no Math.random/Date.now (seeded PRNG e.g. mulberry32); animate only visual
  props (not visibility/display), never call play/pause on media; never two timelines on one property; no
  `repeat:-1` (compute `ceil(duration/cycle)-1`); build timelines synchronously; no `gsap.set` on later-scene clips
  at load (use `tl.set` at time); no `<br>` in body text (use max-width).
- `skills/motion-design/SKILL.md:76-97` one strong representative frame first; "premium/cinematic/modern" are not art
  directions; one material/world logic; no default neon gradient, glass cards, glowing orb or beige background.
- `:99-112` three possible layers (primary action, secondary weight/causality, ambient only when needed; reading
  holds may be still); "do not mechanically stagger every word".
- `:368-388` defect → decision table (slideshow → carry one object through a transformation; everything competes →
  choose the lead action; no weight → travel/acceleration/anticipation/settle; generic → type/composition/motif;
  texture flicker → seed and cache marks; monotonous → vary shot scale and action/hold rhythm; busy but empty →
  remove decoration, show the causal action). Never invent a numeric aesthetic score.
- `:350-366` bounded video check: ONE review after the first render (clock/dimensions, captions vs factual
  invariants, at most 3 frames actually viewed: opening, key explanation, ending), at most ONE targeted repair and
  re-render, else report the limitation; no acceptance agents, no open-ended polish loop.
- Typography `references/typography.md`: banned (training-data defaults) Inter, Roboto, Open Sans, Noto Sans, Arimo,
  Lato, Source Sans, PT Sans, Nunito, Poppins, Outfit, Sora, Playfair Display, Cormorant Garamond, Bodoni Moda,
  EB Garamond, Cinzel, Prata, Syne (:5-11); never two sans; one expressive font per scene; weight contrast 300 vs 900;
  video sizes (:13-20); "3 seconds on screen must be readable in 2"; display tracking −0.03 to −0.05 em (:22-32);
  discovery script pulls Google Fonts metadata and SHUFFLES the top 5 of each category so the model does not always
  take the first (:103-109); dark backgrounds: body 350 instead of 400, line-height +0.05–0.1, display +0.01 em
  (:137-142); OpenType tabular-nums / diagonal-fractions / all-small-caps (:144-175).
- Audio-reactive (`references/audio-reactive.md:29-35`): audio sets timing and intensity, content sets the visual;
  banned: equalizer bars, spectrum analyzers, waveforms, note clip-art, generic particles, rainbow cycling, white
  strobes on beats, pulsing orbs. Text 3–6 % scale, non-text 10–30 % (:65-70).
- Captions (`references/captions.md`): tone → font/animation/colour/size table :166-174; grouping 2–3 words high
  energy, 3–5 conversational, 4–6 calm, break on sentence ends, ≥ 150 ms pauses or max count :176-182; one group
  visible; hard `tl.set(visibility:hidden)` kill at `group.end` + an in-page self-lint that seeks to end+0.01 and
  warns if still visible :211-235; `fitTextFontSize` (maxWidth 1600/900, base 78, min 42, step 2) and
  maxWidth = safeWidth / maxScale for scaled emphasis :194-209. `dynamic-techniques.md:180-194`: karaoke baseline at
  all energies (high: accent + glow + 15 % pop; low: 3 %), cycle highlight style every 2/3/4 groups by energy,
  emphasis words always break the pattern.

## 6. Determinism and rendering (how an HTML composition becomes an MP4)

Clock contract (`packages/contracts/src/runtime/motion-source-player.ts:11-22`, injected for
`<meta name="od-motion-output" content="video">` films): `data-duration` > 0; a registered GSAP timeline;
`timeScale()` exactly 1 (tolerance 1e-6); `duration()` equal to `data-duration` within 1 ms; no repeat or delay.
`skills/motion-design/SKILL.md:190-219`: add a clock tween `tl.to(clock,{t:duration,duration,ease:'none'},0)`; never
`tl.duration(seconds)` (that changes speed, not length).

Callbacks are suppressed in export (`media/index.ts:4085` `renderSeek(t,{suppressEvents: !motionVideo})` and
`motion-design/SKILL.md:237-242`), so canvas films draw from a per-frame rAF loop that redraws whenever `tl.time()`
changed (`motion-showreel/example.html:505-523`; schedule the next rAF BEFORE drawing so one failed frame cannot stop
the loop). Backward seeks must reproduce identical frames.

Render path (`apps/daemon/src/media/index.ts`):
- :3880-3983 `renderHyperFrames`: composition dir must be inside the project, contain `hyperframes.json`,
  `meta.json`, `index.html`; temp dir; desktop renderer by default, `HYPERFRAMES_BROWSER_PATH` escape hatch runs the
  HF CLI with `--workers 1` and streams "Capturing frame N/M" lines (:4230-4320). 5-minute timeout (:3878).
- :4023-4046 metrics: fps from `data-fps` (default 30); width/height ≤ 8192; fps ≤ 240.
- :4048-4144 frame bridge `window.__odFrameRenderer = {ready(), seek(t)}`: waits ≤ 45 s for `__renderReady` and
  `__player.renderSeek` (or legacy `__hf.seek`); each seek awaits `__hfWaitForSeekCompletion`, colour-grading LUTs,
  the page-composite prepare/resolve pair, then a "next paint" = two rAFs or 100 ms, whichever first.
- `apps/desktop/src/main/frame-capture.ts:106-280`: hidden BrowserWindow (`backgroundThrottling:false`, sandboxed),
  opacity 0 + `showInactive`, CDP `Emulation.setDeviceMetricsOverride` (DPR 1), frameCount = ceil(duration × fps)
  (cap 1,000,000), per frame: seek → settle → `Page.captureScreenshot {fromSurface:true, png}` → write
  `frame-%08d.png`. Stage deadline 30 s, setup 60 s, total 5 min (:18-22). It refuses pages that still contain
  `<audio>` (`AUDIO_UNSUPPORTED`, :174-180).
- Audio (`apps/daemon/src/media/hyperframes-audio.ts:193-258`): ≤ 32 tracks; local relative src inside the
  composition; no loop / media-start / playback-rate; each `<audio>` is replaced by a hidden span (ids kept), then
  FFmpeg: per track `atrim`, stereo, fade-out over min(0.6 s, audible/4) ending at min(track end, film end), volume,
  `adelay`; `amix … volume=N` to undo amix averaging; `apad,atrim=film`; AAC 192 k.
- Encode (`index.ts:4146-4203`): `-framerate fps -i frame-%08d.png`, `pad=ceil(iw/2)*2:ceil(ih/2)*2`, libx264,
  yuv420p, `+faststart` (no CRF given: x264 default 23).
- Delivery checks (`apps/daemon/src/artifacts/motion-delivery.ts`): the source must `<link rel=alternate
  type=video/mp4>` the exact output path; audio policy `required|silent` (`od-motion-audio` meta); after export:
  `ftyp` header, one decodable frame, `volumedetect max_volume > −80 dB` when required, silent when declared silent.
  Cover: `data-poster-time` (0 ≤ t < duration) is extracted from the finished MP4
  (`apps/daemon/src/chat-artifacts/motion-cover.ts:28-64`, duration must match within 0.05 s).
- Preview player (`motion-source-player.ts:28-150`): one clock (the GSAP timeline), audio synced to it with 0.2 s
  drift tolerance, stage uniformly scaled, click toggles, and in a gallery only one hosted preview plays at a time
  (probe/request/activity postMessage handshake, `apps/web/src/runtime/motion-preview-activity.ts`).

## 7. QA tools (the most transferable part)

`design-templates/hyperframes/scripts/animation-map.mjs`
- defaults :33-38: 6 samples per tween, ignore tweens < 0.15 s, 1920×1080, 30 fps.
- :147-201 walks every registered timeline recursively (children offset by parent start) and lists tweens: first
  target selector, target count, animated props (vars minus duration/ease/delay/…), start, end, ease.
- :68-79 samples bbox + opacity + visibility at (k+0.5)/N of each tween.
- :287-316 flags: `degenerate` (zero size), `offscreen` (more than half outside), `invisible` (opacity < 0.01 all
  along while "visible"), `paced-fast` (< 0.2 s on x/y/opacity/scale), `paced-slow` (> 2 s).
- :318-337 `collision`: two tweens overlapping in time whose boxes overlap > 30 % of A's area at a shared sample.
- :222-283 one sentence per tween ("#card1 animates opacity+y over 0.50s (power3.out). moves 23px up. fades in. ends
  at (120, 200) …"), the agent-facing output.
- :372-417 density in 0.5 s buckets and dead zones ≥ 1 s with no active tween ("intentional hold or missing
  entrance?"); :419-471 stagger detection (same props, |Δdur| < 0.05 s, start within 4× duration, ≥ 3 members,
  "consistent" if max interval drift < 30 % of the mean); :473-510 element lifecycles; :512-553 snapshots at 0, 25,
  50, 75 % and end − 0.1 s; :349-370 a 60-column ASCII Gantt.

`design-templates/hyperframes/scripts/contrast-report.mjs`
- 10 samples at (i+0.5)/N of duration (:43, :65-68); text elements = elements with direct non-empty text, visible,
  opacity > 0.01, box ≥ 8×8 (:104-146); background = per-channel median of a 4-px ring just outside the box in the
  captured PNG (:179-203); fg alpha composited over that bg; WCAG relative luminance; large text = ≥ 24 px or
  ≥ 19 px bold → 3:1 else 4.5:1; AAA 4.5/7 (:210-236); sprite sheet overlay magenta = fail AA, yellow = AA only,
  green = AAA (:240-290); exit code 1 on any AA failure (:96). Fix rule `SKILL.md:448-453`: stay in the palette
  family, brighten on dark / darken on light.

`hyperframes inspect` (CLI, not in repo; documented `SKILL.md:424-437`): seeks samples (`--samples 15`, `--at`), maps
overflow with timestamps/selectors/boxes/fix hints, `data-layout-allow-overflow` / `data-layout-ignore` opt-outs.

## 8. Motion skills reviewed

- `skills/motion-design` (OD's own craft layer): see §2, §5, §6. Highest value: beat-map line format, timing table,
  clock contract, poster time, sound policy (`:262-296`: "no voiceover" ≠ no music; declare audio required/silent;
  local pre-trimmed tracks), bounded check, defect table.
- `skills/huashu-art-motion` (MIT, alchaincyf): 35 art-style recipes + 9 explainer grammar cards
  (`references/explainer-grammars.md`), craft workflow, and 8 canvas modules (`references/canvas-helpers.md`).
  * Vox card :588-788: first checks (real material fills ≥ 60 % of width or it is a "frame layout"; rotate the
    reveal sequence, the same sequence at most 3 times in a row, evidence: 36 of 37 labels slid in; text to be read
    goes on the top layer and is drawn last; derive the camera target by framing what must be read plus margin; after
    each new card read all on-screen text in reading order to avoid accidental sentences; play each event once)
    :596-605. Measured: two-layer frame rate, camera smooth while elements step at 12 fps "on twos" (52 % of motion
    frames show move-stop-move) :645-648; camera moves median 1.29 s (0.71–1.96), none linear, 7 sine in-out for
    long travel, 6 long-tail (.33,0,.2,1) for pull-out reveals :650-652; paper texture static (frame diff 0.0–0.1, no
    per-frame grain) :638; camera stops during holds, punch 18–32 % in 0.28 s or pan 0.30 s on VO beats, no slow
    drift :669; red underline 0.5–1 s, red circle ≈ 1 s, highlighter 1.5–3 s per line, typing ≈ 13 chars/s on twos
    :660-668; shot length tiers: slow median 3.3 s (≈ 12 cuts/min), fast 1.4–1.8 s (25–33 cuts/min) :687-690; most
    transitions are hard cuts on VO punctuation :673; the torn-paper transition never appears in the measured
    samples :683. Each card ends with the 3 commonest mistakes, a blind review score and the revision log, and a QA
    table: motion area % mean/peak, static frame pairs %, jump frames, ms/frame mean/peak, pixel determinism
    :765-788.
  * Storytime card (~:1040-1065): TheOdd1sOut ASL 2.43 s, 70.7 % fully static adjacent frames, holds median 0.40 s,
    motion bursts median 100 ms (pose-to-pose); character on 24 fps steps, pose switch 0.10 s expoOut, 7 % squash
    settle(3.5 Hz, decay 9) ≈ 0.35 s, mouth shape from RMS envelope changed at most every 1/12 s (closed < 0.06, half
    < 0.22, open), blinks 2 frames @24 fps on a fixed schedule 2.4–3.6 s, breathing ±1.2 % / 1.6 s.
  * `motion.js` (:825-940): `MO.step(t,fps)` (:845), manim `smooth`, `lagged(i,n,p,r)` (:858), named beziers incl.
    `longTail` (:892), SwiftUI-parameterised spring (duration, bounce), `springHz` (freq/decay; 3/6 ≈ 37 %
    overshoot, 2.5/9 ≈ 16 %, 2.2/10 ≈ 8 %) (:911), `settle` (Ebberts), `MO.PULSE = {punch .28, pan .30, slam .17,
    k .25 (.18–.32)}` (:918), `slamK` 1.55 → 0.94 over the first 60 % then → 1.0 (:920), `float` two-sine with
    period away from ~5 s (:929), `onBeat(barTime, revealP, trDur)` to land a transition's reveal point on a bar
    (:937).
  * `camera.js` (:941+): world camera {x,y,z,r}; `zlerp` log zoom (:966); `coverZoom(r)` minimum zoom for an
    aperture to cover the frame (≈ 1101/r centred) (:969); `pushTo` (:974); keyframes `CAM.at`; `CAM.track(base,
    events, t)` with `punch / pan / to / slam / shake (≤ 2 per film) / cut` events, each starting from where the
    previous one is NOW, returning `moving` for motion blur and label visibility (:1004).
- `skills/ui-animation` (MIT, Matthew Blode): reverse-engineer workflow (`SKILL.md:217-259`): extract frames →
  contact sheet → vision pass → `track_motion.py` (bbox, centroid, width/height separately, opacity proxy, blur =
  inverse Laplacian variance /1000, radius proxy; min area 0.2 %; diff threshold 25) → `fit_curves.py` (spring k/c
  with m = 1, zeta, overshoot; bezier with y capped at 1.5; normalised RMS error) → read `curve-fitting.md` (error
  < 0.03 tight, 0.03–0.08 decent, > 0.08 suspect = multi-phase, split and fit per phase; fit axes separately;
  open and close are different curves; match `--fps` to extraction).
- `skills/oil-motion` (MIT): interactive scroll/pointer media from AI keyframes. Four single sources of truth
  (concept contract, motion brief, compiled `timeline.json`, `motion-budget.json`); clip chains reuse the accepted
  real tail frame as the next first frame; output seam gate `scripts/production_gate.py:278-307` SSIM ≥ 0.97 and
  normalised MAE ≤ 0.04 between decoded tail and next head.
- `skills/motion-lab` (MIT): 160 web micro-animation cases indexed by id/tag (`references/index.md`); web UI focus.
- `skills/review-animations` (MIT, Matt Pocock) `STANDARDS.md`: UI rules (frequency table, never ease-in on UI,
  < 300 ms, never scale(0) start at 0.9–0.97, stagger 30–80 ms, blur ≤ 20 px to mask crossfades).
- `skills/emilkowalski-motion`, `skills/animate`, `skills/gsap-frameworks`: UI/web motion for artifacts; not video.
- `skills/remotion`: a catalogue pointer to upstream only (no content).
- `skills/chat-motion-overlay`: Remotion chat-bubble overlay; fixed gap 18 frames, hold 36 frames
  (`scripts/build_chat_overlay_spec.py:54`), bubble spring damping 14 / stiffness 180 / mass 0.7; transparent MOV/WebM.
- `skills/video-hyperframes`: 8 autoplay frames with `<!-- frame:N duration transition -->` + HYPERFRAMES_META;
  wall-clock `setTimeout`, not render-deterministic.
- `skills/8-bit-orbit-…`, `weread-…`, `swiss-user-research-…`: templates with P0/P1/P2 checklists (exact scene
  counts, scene holds within bounds e.g. 2.8–4.2 s, contact sheet must show content in every scene, no overlap).

## 9. Moovi comparison

Moovi already has (read-only check):
- Pure `frame(t)` canvas core with AE ramps, closed-form springs, log pull, drift, shutter blur, seeded noise and
  jittered stagger: `moovi:packages/library/src/kits/motion/core.js:1-80`; word-by-word re-flowing lines and log-space
  slams: `moovi:packages/library/src/kits/motion/type.js`.
- A 63-move camera library with log-space intensity and edit moves (punch, pulse, crash zoom):
  `moovi:packages/library/src/camera/moves.ts:467-485`, `core.ts:47-48`.
- Weak-model-safe planning: arcs as slot briefs (`moovi:packages/engine/src/styles/kit/arcs.ts:1-40`), enum-only
  improvisation (`kit/compose.ts:1-30`). OD instead needs a strong coding agent to author raw GSAP HTML; its fast path
  is a blank scaffold plus 1–3 edited clips (`SKILL.md:46-71`). Moovi is ahead for "any model, equal quality".
- Throughput: parallel pages + in-browser WebCodecs H.264 + a custom MP4 muxer (`moovi:packages/engine/src/visual/
  mp4.ts`, `capture.ts:134-245`) vs OD's single sequential CDP-screenshot loop.
- Plan/frames QA: plan tiling, ambient depth, caption band, static seconds (MAD < 0.35), empty frames, caption cover
  (`moovi:packages/engine/src/visual/qa.ts:1-98`) and a per-scene critic stored in FalkorDB
  (`visual/critic.ts:1-30`). A blind-judge quality ratchet for kits (`.claude/skills/ishaan-motion/SKILL.md:140-142`).
- Captions as data: 12 styles with energy, chunk mode, pause breaks 0.45–0.7 s, highlight rule
  (`moovi:packages/engine/src/edit/captions.ts`).

Moovi lacks (candidates, ranked in the structured output):
1. A pulse camera mode and "camera stops on holds" for explainers (Dark Vox drifts continuously:
   `moovi:packages/engine/src/darkvox/player.ts:159-160`; ishaan-motion law 3 says never still).
2. On-twos element stepping and static paper texture for the paper-theatre style (Dark Vox grain is "fresh each
   frame": `darkvox/player.ts:7`).
3. A motion map lint over the film plan (paced-fast/slow, collisions, dead zones, lockstep staggers, ease monotony).
4. A rendered-pixel WCAG audit (Moovi checks palette pairs only: `moovi:packages/engine/src/s1fast/theme.ts:13-18`).
5. Measured grammar cards per style.
6. Automated curve fitting for reference clones (backtracking step 6 is manual:
   `.claude/skills/ishaan-motion/references/backtracking.md:21-26`; and no Python is allowed, so port to TS).
7. Transition casting by narrative position and one-primary share (Dark Vox: zoom default, portal ≤ 2, cut ≤ 2 on
   contrast/warning beats: `moovi:packages/engine/src/darkvox/film.ts:218-221`).
8. Summed-spring retargeting and two-edge springs.
9. Build-time audio-reactive modulation from precomputed bands of the fixed bundled bed.
10. Post-export audio/duration assertions and fade-on-cut.
11. Number-continuity exception to anti-repeat casting.
12. Poster time chosen by the director; one active preview in galleries.

OD inconsistencies worth not copying: `motion-frames` asks for CSS `@keyframes` "so a frame-grabber can capture it
deterministically" while `motion-design:237-242` forbids independent CSS animation; `audio-reactive.md:37-59`
samples audio via `tl.call` per frame while export suppresses callbacks; frame-* and video-hyperframes templates use
`setTimeout`. Whether the HyperFrames runtime seeks CSS animations is not visible in this repo.
