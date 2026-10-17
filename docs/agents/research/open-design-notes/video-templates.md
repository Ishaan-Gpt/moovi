# OpenDesign video templates, prompts and media orchestration (area key: video-templates)

Source: OpenDesign (nexu-io/open-design, Apache-2.0), commit 78d5637, read-only clone at
`scratchpad/ext/open-design`. Paths below are relative to that root unless they start with `moovi:`.
Nothing from the clone was installed, built or run. Line numbers are from this commit.

Short version: OpenDesign's video quality at the content level does not come from a smart video
director in the daemon. It comes from three things:
1. **Hand-timed beat maps** written in seconds, inside each template's prompt or SKILL.md.
2. **A dense, opinionated motion and transition rulebook** that the agent reads
   (`design-templates/hyperframes/**`, a vendored copy of HeyGen's HyperFrames skill).
3. **A thin, honest media dispatcher** (`apps/daemon/src/media/index.ts`). It has no automatic routing. It
   clamps durations to buckets, uses a long-poll protocol, and classifies every failure into a closed set of
   `nextStep` values, which decide whether the agent retries.

Most "skills" for fal, Venice, YouTube clipping, music albums and Sora are catalogue stubs that point upstream
(section 15).

---

## 1. Inventory

| Set | Count | Model | Licence | Shape |
|---|---|---|---|---|
| `prompt-templates/video/*.json` | 58 | 39 `seedance-2.0`, 19 `hyperframes-html` | Seedance: CC-BY-4.0 (YouMind awesome-seedance-2-prompts) or Apache (first-party); HF: Apache (HeyGen) | one JSON: `prompt` text plus metadata |
| `plugins/_official/video-templates/frame-*` + `vfx-text-cursor` | 23 | HyperFrames HTML+GSAP | Apache-2.0 / MIT (frame-product-promo-30s is MIT, Nate Herk) | `template.json` + `open-design.json` + `SKILL.md` + `source/` (index.html, compositions/, fonts, assets incl. mp3) + preview.mp4 |
| `plugins/_official/video-templates/<seedance id>` | ~38 | Seedance | as source | manifest + `template.json` only (prompt-only) |
| `plugins/_official/examples/motion-*` | 6 (product-promo, showreel, future, ui-morph, visual-lesson, frames) | canvas `render(t)` + GSAP master clock | Apache | `example.html` + bundled OFL fonts + original `soundtrack.mp3` |
| `design-templates/hyperframes/**` | rulebook | n/a | Apache (HeyGen fork) | SKILL.md (502 lines), house-style, visual-styles (8), palettes (9), references (motion, transitions + catalog, captions, tts, audio-reactive, data, typography, css-patterns), scripts (animation-map.mjs, contrast-report.mjs) |

HF template durations (from each `template.json`): 15 s for most, 10 s (swiss-grid, vignelli 9:16, warm-grain, play-mode),
20 s (product-promo), 30 s (product-promo-30s). Almost all are 16:9 at 30 fps.

### 1.1 Schemas
- Prompt template validation (`apps/daemon/src/media/prompt-templates.ts:93-143`) requires `id` == filename,
  `surface` == folder, a title, `prompt` of at least 20 chars, `source.repo` and `source.license`. Optional fields:
  `model`, `aspect`, preview URLs, author, url.
- Plugin manifest (`video-templates/frame-product-promo-30s/open-design.json:46-122`) has `od.kind: scenario`,
  `taskKind: new-generation`, `inputs` (aspect select, format mp4/webm, durationSec number), and
  `pipeline.stages: compose[file-write] → render[media-video]`. Seedance plugins instead use
  `generate[video-generate]`, with inputs model + aspect (16:9/9:16/1:1/4:5)
  (`cinematic-street-racing-sequence-for-seedance-2/open-design.json`).
- HF `template.json` fields: `engine: hyperframes`, `engineVersion ^0.4.0`, `sourceEntry`, `fps`, `durationSec`,
  `formats`, `bestFor`.

### 1.2 How a template reaches the agent
- `apps/daemon/src/prompts/system.ts:1901-1928`: the project metadata block lists the video model, length and
  aspect (or common choices) and `referenceTemplate`. It also gives the one dispatch command. For
  `hyperframes-html` it adds a special case: this is a motion-design renderer, ask at most one question, then
  scaffold, edit and dispatch.
- `system.ts:2044-2099`: the chosen template's prompt is inlined **verbatim and truncated to 4000 chars** in a
  fenced block (triple backticks are escaped so they cannot break out). The instruction says to treat it as a
  structural and stylistic reference (composition, palette, lighting, lens/motion, level of detail), to adapt it
  to the user's subject, and **not** to reproduce the template subject verbatim. Attribution travels with it.

---

## 2. Beat-sheet formulas per video type (seconds)

All numbers are from the template prompt or source as written (evidence: source).

| Type (file) | Length / aspect | Scenes | Beat map | Text density | CTA |
|---|---|---|---|---|---|
| SaaS promo (`hyperframes-saas-product-promo-30s.json:11`) | 30 s 16:9 | 4 × ~7 s | HOOK 0-7 (headline scale 0.9→1, 0.6 s expo.out; mono kicker with marker sweep) · PROBLEM 7.4-14.4 (3 Reddit-style quote cards, 280 ms stagger, x -60→0, 0.5 s power3.out, hold 2 s on 3rd) · SOLUTION 14.9-22 (UI flies from z=-400, 0.7 s; 3 feature pills over 1.6 s; one cursor click at 19.5) · END 22.3-30 | min 60 px headlines; one kicker per scene | wordmark assembles over 1.4 s; one CTA line at 25.5 ("try it · 14-day free"); ~4.5 s hold |
| Product promo 30 s (`frame-product-promo-30s/source/index.html:63-115`) | 30 s | 8 | problem-type 0-4 · card→logo morph 4-8 · brand reveal 8-10 (2 s) · benefits flowchart 10-14.8 · product surfaces 14.8-19.5 · wheel pillars 19.5-22 · foundation callback 22-25 · CTA outro 25-30 (5 s) | 1 line per beat | last 5 s |
| Brand sizzle (`hyperframes-brand-sizzle-reel.json:11`) | 30 s | 5 × ~6 s, **inner cuts every 1.8-2 s** | WHO (one display word, +2 % scale pop per beat) · WHAT (3 product cuts × 1.8 s, whip-pan 0.25 s) · STATS (3 counters × 2 s) · PEOPLE (3 NYT pull quotes × 2 s, hairline rule 0.4 s then clip-path type-in) · END | one word per scene at 220 px | CTA at 28.5, hold to 30 |
| Website-to-video (`hyperframes-website-to-video-promo.json:11`) | 15 s | 3 × 5 s | DESKTOP 0-5 · flash-through-white 0.3 · TABLET 5.3-10 (rotateY -8°) · chromatic radial split 0.5 · MOBILE 10.5-15 (rotateY +8°) | URL chip at +1.0 s; kicker types in at +4.5 / 8.5 | tap on primary CTA at 12.0 with 0.8 s ripple; logo outro at 13.5 (bottom-right) |
| Product reveal (`hyperframes-product-reveal-minimal.json:11`) | 5 s | 3 | 0-2 hairline (enters 0.2 s, 0.8 s) + small-caps kicker 0.6 s · 2-4.2 wordmark, 80 ms per-glyph stagger, 0.7 s expo.out, radial glow pulse 1→1.04→1 over 1.6 s; tagline (≤56 chars) at 3.4 · 4.2-5 hold, rule extends 80 px | wordmark + one tagline | no exits, ends on hero frame |
| Logo outro (`hyperframes-logo-outro-cinematic.json:11`) | 4 s | 1, 5 tracks | 0-0.3 grain 0→8 % · 0.3-1.7 seeded piece assembly 1.4 s expo.out · 1.7-2.0 glow pulse 0.96→1.04→1 · 2.0-2.8 shimmer sweep · 2.6-3.4 CTA rises y 20→0, 0.7 s · 3.4-4 hold | wordmark 200 px + one CTA at y=72 % | CTA contrast ≥4.5:1 |
| Social overlay (`hyperframes-social-overlay-stack.json:11`) | 15 s 9:16 | 4 cards | x-post 0.4 (from x=-340, expo 0.6) · reddit 3.6 (y 80→0) · spotify 7.0 (x=+340) · instagram-follow 11.0 (scale 0.9→1 back.out 1.4), follow button pulses at 13.5 | cards keep in-platform typefaces; 38 % scrim over the bottom 32 % | 0.18 s white flash between cards; landings on a 90 BPM (666 ms) grid |
| TikTok karaoke (`hyperframes-tiktok-karaoke-talking-head.json:11`) | 25 s 9:16 | VO-led | lower third 5.0-9.5 (x -360→0, 0.7 s) · follow overlay 22-25 | 2-3 words per chunk, max 28 chars, y=78 %, min 60 px, fit text if >22 chars | follow card in the last 3 s |
| Money counter (`hyperframes-money-counter-hype.json:11`) | 6 s 9:16 | 1 | kicker 0.2 · count $0→$10,000 over 0.5-3.5 (power2.inOut) · white flash 3.4-3.6 · +4 % pop and green flash 0.3 s then back 0.6 s · burst 3.5-4.5 (50 seeded shards) · hold 4.5-6 | 280 px counter, tabular-nums slashed-zero | caption "day · one" at 4.0 |
| Bar race (`hyperframes-data-bar-chart-race.json:11`) | 12 s | 1 | rule wipe 0-0.4 · headline 0.3-1.2 · bars 1.2-9.0 (1.4 s each, 180 ms stagger, leader +4 % pulse) · callout 9.5-11.5 · source line 11.0+ | headline ≤64 chars; layout bands 18/64/18 % | the annotation is the payoff |
| App showcase (`hyperframes-app-showcase-three-phones.json:11`) | 12 s | 1 | headline 0-1 · 3 phones fly in 0.6-2.0 (180 ms stagger) · each phone gets a 2 s spotlight (2-4, 4-6, 6-8: rotateY→0, scale 1.04, typed callout 0.4 s) · idle bob 8-10 · logo + shimmer 10-12 | one label per phone | logo bottom-right |
| Flight map (`hyperframes-flight-map-route.json:11`) | 8 s | 1 | zoom 0-1.2 · origin label 1.0-1.8 · arc draws 1.8-6.0 with a distance counter · destination 5.5-6.5 · footer 7.0 | city 64 px, coords 18 px mono | hold |
| Motion product promo (`examples/motion-product-promo/SKILL.md:32-38`) | 15 s | 6 chapters | HOOK 0-2.45 · ANYTHING 2.45-4.45 · STORE 4.45-6.95 · HANDLED 6.95-11.2 · FLOW 11.2-13.3 · END 13.3-15 | one line per chapter, a mascot reacts | wordmark built from the previous word ("flow.") |
| Showreel (`examples/motion-showreel/SKILL.md:30-38`) | 15 s at 128 BPM | 8 chapters (~1.9 s each) | identity 0-2 · wordmark 2-3.5 · easing 3.5-5.5 · morph 5.5-7.45 · systems 7.45-9.75 · depth 9.75-11.2 · kinetic type 11.2-13.1 · end 13.1-15 | HUD on every frame | end card at 13.1 |
| Motion future (`examples/motion-future/SKILL.md:38-41`) | 20 s at 120 BPM | ~15 hard cuts (~1.3 s each) | "keep hard cuts on the 120 BPM grid" | 1-2 words per cut | 18.5-20 |
| HTML-video frames (`skills/video-hyperframes/SKILL.md`, body) | N frames × 3 s | 6-10 for a short script | frame 1 = hook (a statistic, a counter-intuitive fact or a question); 2..N-1 = argument; last = conclusion + CTA | **one sentence per frame**, text-9xl | each frame carries a `<!-- frame:N duration:3000 transition:fade -->` marker plus a final HYPERFRAMES_META JSON |

**Derived formulas (inference from the table):**
- Hook lands within **2-2.5 s**: the hero word at 1.95 s (problem-type), HOOK ends at 2.45 s (motion promo), and the
  first visual change comes 0.1-0.3 s after t=0 (motion-principles.md, guardrail 6).
- Cut rate follows energy: calm/premium is 1 scene per 5-7 s; promo is one per 2.5-4 s; sizzle/showreel is one per
  1.3-2 s, locked to a BPM grid.
- The end card is **15-25 % of the film**: 4.5-7.7 s of 30, 1.7-2.5 s of 15, 1.5 s of 6. The CTA enters **2.3-3.2 s
  after** the end card starts and holds for at least 0.6 s.
- Text density: one sentence or one display word per scene. Headlines are at least 60 px at 1080p, body at least
  20 px, data labels at least 16 px.

---

## 3. The hook formula in code (problem-type opener)

`video-templates/frame-product-promo-30s/source/compositions/01-problem-type.html:137-182` (MIT, Nate Herk):
- SLOT = 4 s. The background grid floor scrolls `backgroundPositionY -120px` linearly for the whole slot and the
  vignette breathes 0.7→0.9 with a yoyo. The ambient layer is never still.
- Words arrive with **decaying travel and duration**:
  - w1 x 360→0 at 0.8 s (0.33 s expo.out)
  - w2 x 120→0 at 1.2 s (0.30 s)
  - w3 x 25→0 at 1.7 s (0.25 s)
  - hero word scale 0.85→1 at 1.95 s with back.out(1.4), 200 px vs 120 px for the others
- **Punch-through exit:** the hero scales to 5 and fades over 1.2 s power2.in at 2.4 s. The other words fade 0.5 s
  at 2.5 s. The grid rotates 5° at 2.6 s.
- **Whip streak** (a blurred white bar) crosses from 3.6 s over 0.4 s power3.in, with `sfx-whoosh-1` at
  3.8 s, volume 0.20 (`index.html:124-127`).

---

## 4. Scene grammar and motion rules (the rulebook the agent reads)

`design-templates/hyperframes/references/motion-principles.md`:
- Do not use the same ease on more than 2 tweens per scene. The slowest scene should be **3× slower** than the
  fastest. Vary entry directions and use a different stagger rhythm per scene. Use different ambient motion per
  scene, or none. Never start at t=0; offset 0.1-0.3 s (lines 7-14).
- Easing is emotion: `.out` for entering, `.in` for leaving, `.inOut` for moving. Speed bands:
  - 0.15-0.3 s: energy
  - 0.3-0.5 s: professional
  - 0.5-0.8 s: luxury
  - 0.8-2.0 s: cinematic
- **Build / breathe / resolve = 0-30 % / 30-70 % / 70-100 % of each scene** (line 39). Exits are faster than
  entrances (0.4 s in vs 0.25 s out). The total stagger stays **under 500 ms** whatever the item count (line 53).
  Whatever moves first is read as most important.
- Composition: **two focal points minimum**, hero text fills 60-80 % of the width, **three layers minimum**
  (background treatment, content, accents), anchor content to edges, split frames (lines 63-69).

`design-templates/hyperframes/SKILL.md`:
- Lay out the hero frame first (static CSS for the most-visible moment), then add `gsap.from()` entrances
  (lines 180-248).
- Non-negotiables (lines 361-388): always a transition between scenes; every element has an entrance; **no exit
  animations except in the final scene** (the transition is the exit).
- Use at least 3 different eases per scene. Avoid full-screen linear gradients on dark backgrounds (H.264
  banding). Use tabular-nums (lines 390-397).

`design-templates/hyperframes/house-style.md`:
- AI tells to question (line 11): gradient text, left-edge accent stripes, cyan-on-dark / purple-blue gradients,
  pure #000/#fff, identical card grids, everything centred.
- Background layer (line 33): 2-5 persistent decoratives per scene (radial glow, ghost text at 3-8 % opacity,
  hairline rules, grain, thematic shapes), each with slow ambient motion.
- One accent hue and the same background across all scenes. Light themes for food, wellness and kids; dark for
  tech, cinema and finance.

---

## 5. Transition grammar

`design-templates/hyperframes/references/transitions.md`:

| Energy | Primary | Duration | Ease |
|---|---|---|---|
| Calm | blur crossfade / focus pull (shader: cross-warp, thermal) | 0.5-0.8 s | sine.inOut, power1 |
| Medium | push slide / staggered blocks (whip pan, cinematic zoom) | 0.3-0.5 s | power2, power3 |
| High | zoom through / overexposure (ridged burn, glitch, chromatic split) | 0.15-0.3 s | power4, expo |

- **One primary transition for 60-70 % of changes, plus 1-2 accents** (line 22).
- Mood table (line 26): editorial uses push/vertical push/diagonal split/shutter; cold-clinical uses
  squeeze/zoom-out/blinds/grid dissolve; dramatic uses zoom through/gravity drop/dip to black.
- Narrative position (line 40):
  - opening: the most distinctive transition, 0.4-0.6 s
  - between related points: the primary, 0.3 s
  - topic change: something different from the primary
  - climax: the boldest accent
  - wind-down: gentle, 0.5-0.7 s
  - outro: the slowest and simplest, 0.6-1.0 s
- Blur by energy: calm 20-30 px for 0.8-1.2 s; medium 8-15 px; high 3-6 px.
- Presets: snappy 0.2 s, smooth 0.4 s, gentle 0.6 s, luxe 0.7 s, instant 0.15 s.
- Do not mix CSS and shader transitions in one composition. Avoid repeating geometric tile patterns.
- Meaning (motion-principles.md): crossfade says "this continues"; hard cut says "wake up"; slow dissolve says
  "drift with me".

Moovi note: ishaan-motion bans crossfades outright and says no transition more than twice in a row. OD allows
crossfade as the calm primary. Moovi's taste rule wins; keep OD's energy and position structure only.

---

## 6. Captions, text density, type

- Word grouping (`references/captions.md:59-65`): 2-3 words at high energy, 3-5 conversational, 4-6 calm. Break on
  sentences, pauses of 150 ms or more, or the max count.
- Tone table (line 49): font weight, entry, colour and size per tone. Hype is 72-96 px at back.out(1.7) for
  0.1-0.2 s; storytelling is 44-56 px, power2.out 0.5-0.6 s.
- Every group gets a hard `tl.set(... visibility hidden)` at `group.end`, plus a self-lint that seeks to each end
  and warns if the group is still visible (lines 94-118).
- Fit: `fitTextFontSize` with maxWidth 1600 (landscape) or 900 (portrait), base 78, min 42. With scaled emphasis,
  maxWidth = safe ÷ maxScale.
- Emphasis words break the pattern (brand, ALL CAPS, numbers, CTA). Music forces audio-reactive captions: per
  group, scale = 1 + 0.06 × peak bass and glow = 12 px × treble (`references/dynamic-techniques.md:40-86`).
- Moovi already has energy-indexed caption styles with chunk rules (`moovi:packages/engine/src/edit/captions.ts`,
  `router/captions.ts`), so this is mostly confirmation.

## 7. Data in motion

- `design-templates/hyperframes/data-in-motion.md`: successive stats of one concept stay in the same visual space
  and only the value changes. Every number is paired with a visual (fill bar or ring). No pie charts, multi-axis
  charts, 6-panel dashboards, gridlines, legends or chart libraries.
- Counter numbers (money-counter, sizzle): 3.0 s power2.inOut, +4 % pop on landing, a colour flash of 0.3 s
  out and 0.6 s back, tabular-nums.
- Bars: 1.4 s power2.out, 180 ms stagger, the leader pulses 4 %, then one annotation callout.

## 8. End card / logo outro (code)

`video-templates/frame-logo-outro/source/index.html` (CSS keyframes):
- 5 logo pieces with fixed offsets (`--dx/--dy` ±40-80 px), staggered 80 ms, scale 1.4→1, 1 s on
  cubic-bezier(.34,1.56,.64,1) (overshoot).
- Glow drop-shadow 0→32 px at 1.1 s. Brand fadeUp at 1.4 s, tagline at 1.7 s, meta/URL at 2.1 s.
- Shimmer gradient sweep across the wordmark at 1.9 s for 1.8 s, once. Everything resolves by about 2.7 s.

---

## 9. Prompt grammar for generated shots (Seedance / Kling / Veo)

### 9.1 Community Seedance grammar (CC-BY prompts)
- **Time-coded shot list** (`cinematic-street-racing-sequence-for-seedance-2.json:14`):
  - a one-line logline
  - a `camera:` system line naming the angle order (interior close-up → OTS → exterior tracking → low ground) and
    the transition tools (whip pans + speed ramps + motion-blur-masked cuts, "continuous flow illusion")
  - then `(0-2s) … (10-12s)` with one action per 2 s
  - environment paragraph, then a style/quality paragraph, then negatives ("no distortion, no stretching")
- **Per-shot fields** (`luxury-supercar-cinematic-narrative.json:14`): a Global Intent line (mood, palette,
  **music tempo and genre driving the cuts**), then for each shot `SHOT n (t0-t1) <shot size>`,
  `camera_motion: push in | static | tracking`, `core_action` with physics adjectives ("authentic momentum
  conservation", "realistic physics"), an **Audio cue per shot** (bass hit, door clunk, screech pitched to the
  track) and `(CUT TO)` between shots. Shots run 1-2 s each.
- **Identity lock** for reference images: "maintain perfect face consistency … no face change"
  (`a-decade-of-refinement-glow-up.json:14`, `seedance-2-0-15-second-cinematic-japanese-romance-short-film.json:13`).
- **Dialogue and lip-sync spec**: whispered lines, 200-400 ms pauses, and "mouth only moves slightly". The
  soundscape is listed (cicadas, pen scratch, heartbeat, then piano).
- **On-screen UI text as timed tokens** (`character-intro-motion-graphics-sequence.json:14`): each 2 s block lists
  the HUD strings to show ("ID: 01", "CODENAME", "SYSTEM SYNC COMPLETE").

### 9.2 First-party Seedance grammar (Apache)
`video-templates/video-seedance-three-kingdoms-guanyu-slaying-yanliang/template.json`:
- `{argument name="…" default="…"}` slots for the parameters: reference_image, environment, hero, mount, weapon,
  target, qi_color.
- `# Scene` lists the setting, the hero ("stays identical from first to last frame") and the targets.
- `# Action`: **three micro-beats in about 10 s, one continuous shot** (0-4 charge / 4-7 raise / 7-10 single cleave).
- `# Technical direction`: Framing (centre-left third, horizon low, never cut to a close-up), Camera (lateral dolly
  matching speed, zero handheld, zero rack focus), Lighting (cold key from the left, warm rim, volumetric mist,
  bloom only on the effect), Motion (4-beat gait, real-time, no slow-mo, flash < 0.2 s), Color (desaturated, teal +
  amber split, grain, chromatic aberration only at the edges), HUD (none).
- `# Negative prompt`: a long explicit ban list (gore, cel-shading, speed lines, whip-pan, lens flare, text,
  garbled glyphs, duplicated hero, extra fingers, weightless props, jump cut).
- I found no code that substitutes `{argument …}`; the agent fills it (inference). Grep in `apps/daemon/src`
  found none.

### 9.3 Per-model ordering and the shot plan
`plugins/_official/examples/video-shortform/SKILL.md:30-128`:
- Short form (≤10 s) is the sweet spot: **one shot, one idea per call**. Multi-shot timelines belong to HyperFrames.
- Clamp to model limits: Seedance 2 caps at 10 s; Veo 3 runs 8 s with audio.
- Plan slots before the prompt: Subject / Camera (static, pan, push-in, orbit) / Lighting (key direction +
  temperature) / Motion (subject vs camera, pace) / Sound.
- Ordering by model: **Seedance = motion + camera + mood; Kling = subject + camera + style; Veo = subject +
  cinematography + sound**.
- Bind aspect and length to API params, never prose. For `hyperframes-html`, write a motion-design brief (subject,
  layout, palette, motion character, tone), not camera physics.

---

## 10. Audio: music, voice, SFX, sync

### 10.1 Mixing mechanics (code)
`apps/daemon/src/media/hyperframes-audio.ts:14-79`:
- Every `<audio>` must be a local relative file inside the composition. At most 32 tracks.
- Each track needs `data-start`, `data-duration` and `data-volume` (0-1). No `loop`, no `data-media-start` and no
  `data-playback-rate`; tracks must be pre-trimmed.
- ffmpeg filter per track: `atrim` → stereo → **fade-out of min(0.6 s, audible/4)** at the track's audible end
  (its own end or the film's end, whichever is first) → volume → `adelay`. Then `amix … volume=N` undoes amix's
  averaging, and the result is `apad` + `atrim` to the film length, encoded AAC 192k.
- ffmpeg owns the audio clock and frames are captured silently (`media/index.ts:4000-4020`).

### 10.2 Levels and placement (product-promo-30s, `index.html:119-135`)
- Warm pad: volume 0.15, the full 30 s.
- Whoosh 0.20 at 3.8 s, timed to the middle of the whip streak at 3.6-4.0.
- Whoosh 0.20 at 6.0 s, on the morph.
- Twinkle 0.20 at 8.3 s, 0.3 s after the brand reveal begins at 8.0.
- So the template uses **4 audio events in 30 s**: sparse SFX only on transitions and the reveal.

### 10.3 Music rules
`examples/motion-product-promo/SKILL.md:70-102`:
- Each remake ships an original 15 s soundtrack timed to its beats, with quiet sparse percussion and no hits on
  transitions.
- Precedence: no music if asked; then the user's file; otherwise keep the bundled score, even when the user asks for
  a different genre. The skill says plainly "this flow cannot generate music".
- `data-duration` = min(music, film), never `loop`, and the exporter fades the music out at that point.

`examples/audio-jingle/SKILL.md:129-130`: music under 30 s is a single section; 30-90 s is intro + body; over 90 s
is a full arc.

### 10.4 Beat grid
- Sizzle: 90 BPM, so a beat every 666 ms. "Every scene cut and major pop lands on a beat", "no orphan motion".
- Social cards land on the 666 ms grid. Showreel runs at 128 BPM over 8 bars. ui-morph runs at 120 BPM over
  7 bars and its last frame matches the first, so it loops.

### 10.5 Audio-reactive
`references/audio-reactive.md`:
- Pre-extracted bands per frame (no Web Audio).
- Mapping: bass → scale, treble → glow, amplitude → opacity/y/colour.
- Text varies 3-6 %; backgrounds may swing 10-30 %.
- Banned: equalizer bars, waveforms, pulsing orbs, strobes.

### 10.6 Voice / TTS
`references/tts.md:5-46`:
- Kokoro-82M runs locally on CPU with 54 voices. Voice by content: product demo `af_heart`/`af_nova`, tutorial
  `am_adam`/`bf_emma`, marketing `af_sky`/`am_michael`.
- **Speed: 0.7-0.8 for tutorials, 1.0 natural, 1.1-1.2 for intros/upbeat**, rarely 1.5.
- Workflow is TTS → `transcribe` for word timestamps, which become the caption timeline.

Daemon TTS providers (`media/models.ts:206-216`): minimax-tts (default), fish-speech-2, elevenlabs-v3,
senseaudio, doubao, gpt-4o-mini-tts, aihubmix tts-1, grok-tts.

Rules (`prompts/media-contract.ts:480-498`):
- `--voice` must be a real provider id, never prose.
- TTS runs the script literally, so proof it first; "one stray comma changes the cadence" (`audio-jingle/SKILL.md:124`).

### 10.7 SFX generation
ElevenLabs SFX (`media-contract.ts:490-496`, `media/index.ts:2599-2633`):
- Prompt under 450 chars, **target 180-320**.
- A literal sound brief: source/action, materials, intensity, space, timing, tail/decay, what to avoid.
- `--prompt-influence 0.7` for user-specified SFX. `--loop` only for ambience. At most 30 s.

---

## 11. Website → promo

- Prompt-only, with no daemon code (evidence: the template text; grep found no viewport-capture code in
  `apps/daemon/src`).
- `hyperframes-website-to-video-promo.json:11`: capture the site headlessly at **three viewports, desktop 1440×900,
  tablet 1024×768 and mobile 390×844**, into `assets/site-{desktop,tablet,mobile}.png`. Then 3 × 5 s scenes:
  - desktop in browser chrome: scale 1.04→1.0 over 0.7 s expo.out, then a 1.5 s Ken Burns across the hero
  - URL chip at 1.0 s; kicker types in at 4.5 s
  - tablet at rotateY -8°, mobile in an iPhone frame at rotateY +8°
  - a hand cursor **taps the primary CTA region at 12.0 s** with a ripple ring (0.8 s)
  - logo outro at 13.5 s
- Wrap the `<img>` in an untimed div; never animate the image's own size.
- Related: the HTML-in-canvas device demo puts real DOM on GLTF iPhone/MacBook screens via `drawElementImage`, with a
  fallback to flat screenshots (`hyperframes-html-in-canvas-iphone-device.json:11`). The glass shatter outro
  "shatters a pricing card" (`…-shatter.json:11`).

---

## 12. Orchestration (which model, fallbacks, cost)

### 12.1 Registry
`apps/daemon/src/media/models.ts`:
- `MEDIA_PROVIDERS` (lines 33-85) each carry an `integrated` flag. **Not integrated** (stub only): bfl, replicate,
  google, kling direct, midjourney, **suno, udio**, comfyui.
- Video models with caps (lines 157-197): seedance-2.0 (t2v/i2v/audio, **default**), seedance-2.0-fast, seedance
  1.x, grok-imagine-video (native audio), OpenRouter seedance 1080/720/480, veo-3.1, wan-2.7, kling-v3.0-pro;
  fal veo-3/veo-2/wan/seedance/kling-2.1/sora-2(-pro); minimax video-01; `hyperframes-html`.
- Audio by kind (lines 199-221): music suno-v5 / udio / lyria (none integrated); speech as in 10.6; sfx
  elevenlabs-sfx (default) and audiocraft.
- Buckets (lines 223-225): `VIDEO_LENGTHS_SEC = [3,5,8,10,15,30]`, `AUDIO_DURATIONS_SEC = [5,10,15,30,60,120]`.

### 12.2 Dispatch
`media/index.ts:351-907`:
- A single function branches on (provider, surface). Unknown `fal-ai/*` paths pass straight through. Cross-surface
  use is rejected.
- Lengths are clamped to the buckets with a warning, except Vela, which allows only 5 or 10 s
  (`vela.ts:579-584`).
- Fal Veo snaps to the nearest of [4,6,8] s; Wan takes no duration (`index.ts:3646-3660, 3819-3833`).
- Seedance flags (`--resolution 720p --duration --ratio`) are appended to the prompt text unless already present
  (`index.ts:1471-1484`). i2v sends the image as a data URL `image_url` content entry, used as the first frame.

### 12.3 Polling
- Volcengine polls every 4 s with a **12 min** ceiling (`index.ts:1546-1578`). Fal polls its queue every 3 s with a
  10 min ceiling for video (`index.ts:3662-3746`).
- Every poll emits a progress line. This is a heartbeat so the agent's shell does not time out at about 2 min.

### 12.4 Agent protocol
`media-contract.ts:379-436`:
- `media generate` polls for at most about 25 s, then returns `{taskId}`.
- `media wait <id> --since n` long-polls for up to 120 s. Exit codes: 0 done, 2 still running, 5 failed.

### 12.5 No automatic cross-provider fallback
- A real provider failure throws, or writes a labelled `[stub]` file only when `OD_MEDIA_ALLOW_STUBS=1`.
  HyperFrames and Vela never fall back to a stub (`index.ts:818-863`).
- Retry policy lives in the prompt and is keyed on `error.nextStep` (`media-contract.ts:50-62`):
  - `switch-model`: pick another allowed model and dispatch **once**
  - `retry-later`: identical retry **once**
  - every other value: report immediately and never re-dispatch ("may bill the user again")
- The classifier (`packages/contracts/src/api/media.ts:145-238`) checks in this order:
  1. the producer's code map (safety_rejection → revise-request, RATE_LIMITED → retry-later, insufficient balance
     → add-credit, …)
  2. the HTTP status (401/403 → sign-in for OD-owned models or open-settings for BYOK; 402 add-credit; 404
     switch-model; 408/425/429/5xx retry-later)
  3. a status parsed from the anchored message shapes `"<tag> <status>: "` and `"<verb> <status>"`
  4. a "no … api key" regex → open-settings
  5. "did not finish in time" → retry-later
  6. `retryable: true` → retry-later
  7. otherwise contact-support
- **It never guesses revise-request**; the comment says doing so would blame the user for an outage.

### 12.6 Defaults
`media-contract.ts:499-528`:
- Dispatch without a discovery question when the subject and style are present.
- Best video is the project metadata's model, else seedance-2.0. Best image is flux-pro-ultra (with a warning that
  it takes 60-180 s).
- Aspect by cue: landscape/cinematic 16:9, vertical social 9:16, product/abstract 1:1.

### 12.7 Cost posture
`media-contract.ts:273-280`, `vela.ts:245-336`:
- `--quality` and `--resolution` are the user's call because tiers are priced differently. An unqualified request
  uses the model's default tier.
- A size or tier the user named ("2K", "high quality") goes to the parameter, not the prompt.
- There is no budget system in OD core. External services own budgets via MCP (`docs/external-media-orchestration.md:25-27`).

### 12.8 External orchestration
`docs/external-media-orchestration.md`:
- An external service owns auth, templates, fan-out, retries, budgets and routing.
- A run carries `mediaExecution {mode, allowedSurfaces, allowedModels}`.
- MCP tools of the form `media.describe_policy/submit/status/cancel/attach_result`.
- Each generated asset gets a project note: brief, surface/dimensions, prompt summary, asset path, usage constraints.

### 12.9 Critique loop
- The default media scenario runs discovery → plan → generate → `critique-theater` until `score >= 4 ||
  iterations >= 3` (`plugins/_official/scenarios/od-media-generation/SKILL.md`). I did not read the critique
  implementation.

---

## 13. QA tooling (what keeps the output clean)

- `design-templates/hyperframes/scripts/animation-map.mjs`:
  - flags `paced-fast` (<0.2 s on x/y/opacity/scale) and `paced-slow` (>2 s) at lines 310-313
  - `collision` when two concurrent tweens' boxes overlap by more than 30 % of A's area (lines 318-337)
  - `offscreen` and `invisible`
  - **dead zones**: 0.5 s density buckets with no active tween for 1.0 s or more (lines 372-417)
  - **staggers**: 3 or more tweens with the same props and duration (within 0.05 s), started within 4× the
    duration; "consistent" if the max interval drift is under 30 % of the average (lines 419-471)
  - an ASCII Gantt chart at 60 columns
- `scripts/contrast-report.mjs`:
  - samples at `(i+0.5)/N × duration`
  - background = **median of a 4 px ring just outside each text bbox**
  - WCAG ratio, with AA at 4.5:1, or 3:1 for large text (≥24 px or ≥19 px bold)
  - writes an overlay sprite (magenta = fail)
- The SKILL output checklist requires lint + validate (contrast at 5 timestamps) + inspect (layout overflow with
  `--samples 15` or `--at` the hero frames) before render.

## 14. Template packaging (examples/motion-*)
- One composition root with canvas layers. A pure `render(t)` reads the GSAP master clock. Copy, palette and timing
  live in a `CFG` at the top.
- "Keep the N chapters on their timing" while copy and palette are swapped.
- Backward seeks must reproduce identical frames. Avoid large canvas gradients and per-pixel noise because they
  slow export.
- Moovi already works this way: `window.__render(t)` players, kits with `kit.json`.

## 15. Catalogue stubs (honest list)
These skills are 40-line SKILL.md files that say "install the upstream bundle". They contain **no workflow or
code**: `skills/fal-video-edit`, `fal-kling-o3`, `fal-lip-sync`, `fal-generate`, `venice-video`, `venice-audio-music`,
`venice-audio-speech`, `ai-music-album`, `youtube-clipper`, `video-downloader`, `speech`, `sora`.

So OD's real media paths are:
- the dispatcher's integrated providers: Seedance via Volcengine/OpenRouter/Vela, Grok, fal, ImageRouter, AIHubMix,
  MiniMax video
- TTS: MiniMax, Fish, ElevenLabs, OpenAI, xAI, SenseAudio
- ElevenLabs SFX
- HyperFrames local render, with bundled soundtracks
- **No music generation is integrated.**

---

## 16. Moovi transfers

### 16.1 Per style
- **Auto (`moovi:packages/engine/src/router/route.ts`, `tasks/director.ts`)**: add a video-type detector before
  routing. Each signal points at an OD beat map (section 2), cast as Moovi set-up families, not fixed templates:
  - software/app signals → "site trio" + SaaS-promo order
  - 3 or more numbers → number hype / data race
  - quotes → proof stack
  - places → route map (Moovi maps)
  - plain words → a mood→style table (technical → Anatomy, dark dramatic → Dark Vox, editorial → s4, data → s5)

  Also pass the matched kit's beat map text from `parts.json` as a "structural reference, do not copy the subject"
  block (OD `system.ts:2077-2091`). Today Auto passes only the palette.
- **s1** (`styles/s1.ts`, `s1fast/planner.ts`):
  - it already screenshots 1280×800 + a phone; add the tablet (1024×768) and the CTA bbox, and offer a 15 s
    site-trio sequence in the Groq template menu
  - add a "problem-type" hook template with the decaying-offset numbers (section 3)
  - order the 30 s menu as problem → morph → brand reveal (2 s) → benefits → surfaces → pillars → CTA (5 s)
- **s4 Editorial** (`styles/s4.ts`, `s4/library.ts`, `s4/compose.ts`):
  - the editorial transition family (push / vertical push / diagonal split / shutter) as the primary for 60-70 %
    of cuts, plus 1-2 accents placed by slot (hook = most distinctive, payoff = boldest, CTA = slowest)
  - one-number arc set-ups get NYT data timing: rule wipe 0-0.4 s, headline 0.3-1.2 s, count, and a small-caps
    source line at the end
  - a shared end card with the coined term as the tagline
- **s5 Clear Signal** (`s5/plan.ts`, `s5/library.ts`, `s5/client.js`):
  - Swiss Pulse grammar: hard cuts primary, geometric iris accent on the brand reveal, expo.out / power4.out
    entries, counters from 0 (3.0 s power2.inOut, +4 % pop, colour flash 0.3/0.6 s)
  - **continuity rule**: successive numbers of one concept keep the same set-up and only the value changes
- **Dark Vox** (`darkvox/film.ts:218-278`, `darkvox/player.ts`):
  - already matches "one primary (zoom) + accents (portal ≤2, cut ≤2)"
  - add the Shadow Cut "pause before the hit": 0.2-0.3 s of no new motion plus an SFX gap before the end-card
    punch
  - stretch the end card from 2.6 s to 3.5-4 s using the logo-outro micro-timeline (CTA in at +2.3 s, hold ≥0.6 s)
- **Anatomy** (`anatomy/plan.ts`, `anatomy/figures.ts`, `anatomy/player.ts`; the open item "near-empty frames"):
  - apply the 3-layer and 2-5-decorative background law: blueprint grid drift, ghost part names at 3-8 %,
    hairline dimension rules, one radial bloom
  - two focal points: the figure plus a callout panel anchored to an edge; the hero fills 60-80 % of the width
  - add an ink-coverage check per frame to the existing frame-by-frame check
  - cold-clinical transitions: squeeze / zoom-out / blinds / grid dissolve

### 16.2 New templates (as set-up families or Auto modes)
1. **Site Trio 15 s** (website-to-video): research captures 3 viewports + the CTA bbox; Ken Burns 1.04→1.0,
   URL chip, kicker, tap + ripple on the real CTA, logo outro.
2. **Sizzle 30 s** (music-led, no voice): bed bars give the cut points; WHO/WHAT/STATS/PEOPLE/END; 1.8-2 s inner
   cuts; counters; real quotes only.
3. **Proof Stack 15 s 9:16**: real reviews and quotes from the site rendered as platform-style cards, plus the
   researcher's proof shots; card landings on the bed's beat grid; follow/visit card in the last 4 s.
4. **One-Number Hype 6 s 9:16**: a teaser cut of any film whose arc is one-number. Counter 0→value with a
   pop + flash + burst, then a kicker.
5. **Data Race 12 s**: from 4 or more numbers on the site. NYT bands 18/64/18, 180 ms stagger, leader pulse, one
   annotation.
6. **App Showcase 12 s**: from the mobile captures: 3 phones, a 2 s spotlight each, typed callouts.
7. **Route 8 s**: Moovi maps, an arc drawn over 4 s with a distance counter.
8. **Logo Outro 4 s**: shared by every style (section 8 timeline).

### 16.3 Engine and QA
- `styles/kit/pace.ts`: a pace profile per style and per type: target seconds, beat length band, end-card share
  15-25 %, CTA hold ≥0.6 s, hook ≤2.5 s.
- `styles/kit/transitions.ts`: an energy × position chooser reading `transition:cut-*` assets from the graph.
- `scripts/motion-map.ts`: dead zones, paced-fast/slow, collisions and stagger drift over `window.__render(t)`,
  added to the ratchet.
- `scripts/contrast.ts`: a ring-median WCAG check on the contact-sheet frames.
- `audio/mix.ts`: pick the bed from library music by mood and BPM; align `end_button_at` to the end-card hit;
  snap non-voice events to the nearest beat within ±80 ms.
- `keys.ts`: replace the boolean `keyFailure` with a closed `nextStep` classifier.

## 17. Port candidates (licences)
- `design-templates/hyperframes/scripts/animation-map.mjs` (Apache-2.0): the dead-zone, stagger and collision
  functions. Re-target them from GSAP introspection to bbox sampling of `__render(t)`.
- `design-templates/hyperframes/scripts/contrast-report.mjs` (Apache-2.0): `sampleRingMedian`, `wcagRatio`.
- `packages/contracts/src/api/media.ts:145-238` (Apache-2.0): `mediaFailureNextStep` and its regexes.
- `apps/daemon/src/media/hyperframes-audio.ts:56-79` (Apache-2.0): the fade-out rule and the amix gain fix (Moovi
  mixes in TS, so take the rule rather than the filter).
- `design-templates/hyperframes/references/{transitions,motion-principles,captions,data-in-motion}.md` and
  `house-style.md`, `visual-styles.md` (Apache-2.0, HeyGen fork): as reference text for ishaan-motion.
- `video-templates/frame-logo-outro/source/index.html` (Apache-2.0, nexu-io): the logo-outro timing.
- `video-templates/frame-product-promo-30s/source/compositions/01-problem-type.html`: **MIT (Nate Herk)**, not Apache.
  Attribute separately.
- Seedance community prompts are CC-BY-4.0 with per-author attribution. Take the grammar, not the text.

## 18. Unknowns
- The HyperFrames shader-transition package and the `inspect`/`validate` internals are npm code, not in the repo,
  so they were not read.
- How `critique-theater` scores media: I read the scenario description only.
- Whether `{argument …}` placeholders are ever filled by UI code. A daemon grep found none; apps/web was not
  fully searched because ripgrep timed out on node_modules.
- The real rendered quality and the timing of the bundled `soundtrack.mp3` / `warm-pad.mp3` (they were not played).
- The live site https://open-design.ai was not visited for this area.
- Real latencies and costs of Seedance/Veo per second: the code has ceilings (12 min, 10 min) but no prices.
