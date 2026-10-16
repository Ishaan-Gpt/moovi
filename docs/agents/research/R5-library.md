# R5: the omnipotent library, inventory and gap

Owner: Claude 2. Read only: no product code was changed. Counted from `main` @ a5274a2 by importing the real
modules (not by reading docs), 2026-10-16. Target from `PLAN.md`: **50+ of each**, in FalkorDB.

## 1. Headline

1. **FalkorDB holds almost none of the library.** Of the nine categories, only transitions (12), music tracks (29,
   metadata and beat grids only) and the visual artifacts (74: icons, cards, devices, charts, 3D objects) are seeded.
   Voices are written only when cast. SFX, captions, effects, camera moves and UI components are TypeScript
   objects the graph has never heard of. "The graph picks from it" is not true yet for 6 of 9 categories.
2. **There are two parallel libraries that do not share ids.** The *style-1 library* (`packages/library`, the
   MotionEasy canvas runtime: 51 effects, 58 UI, 16 transitions, 8 camera presets) and the *visual compositor*
   (`packages/engine/src/visual`, three.js: 74 artifacts, 8 enters, 6 idles, 7 camera moves, 5 transitions, 10
   layouts). The same idea ("push-in", "whip") exists twice with different code. A shared id and a `runtime`
   property on each graph node is the fix (section 5).
3. **On paper four categories already clear 50** (voices, effects, UI, artifacts), but the numbers flatter us:
   - Voices: 63, all from Microsoft Edge's online voices through an unofficial protocol. Licence-safe count: 0.
   - Music: 29 tracks catalogued, but only **1** mp3 is in the repo.
   - SFX: 27 mapped sounds are really 22 distinct files.
   - Effects/UI are style-1 only; the visual path cannot use them.
4. **Real gaps** (far under 50): caption styles (~8), camera moves and angles (~15), 3D styles (15), transitions
   (~25 deduped), sfx (22 files), music (1 shippable).

## 2. The table

"Today" counts distinct, usable items. "Graph" is what is in FalkorDB now.

| Category | Today | Graph (FalkorDB) | Gap to 50 | Where in code |
|---|---|---|---|---|
| Voices | **63** (47 English, 16 in 8 Indian languages) | cast-time only: `(:Voice)` written by `castVoice`, `(:Film)-[:VOICED_BY]->` | 0 on count, **licence risk** | `packages/engine/src/audio/voices.ts` (`VOICES`), `tts.ts`, `eleven.ts` (optional BYO key) |
| SFX | **22 files**, 27 mapped sound ids, 24 events (25 catalogue entries in `library`) | none | 28 files | `packages/engine/assets/sfx/*.wav` + `map.json`; `packages/library/src/style-1/sfx.ts` |
| Music beds | **1 shippable** (`bed.mp3`, 29.7 s); **29 catalogued** (7 soft, 7 uplifting, 8 groove, 7 driving) | 29 `(:Track)` + `(:Beat)` grids, 120 s each | 49 shippable, 21 catalogued | `engine/assets/music/`; `graph/data/craft.json` `tracks`; `library/.../music.ts` |
| Caption styles | **~8** | none | ~42 | see 3.4 |
| Video effects | **65** (51 style-1 + 8 enters + 6 idles) | none | 0 | `library/.../effects.ts` (`EFFECTS`); `engine/src/visual/page/motion.js` |
| Camera moves | **~15** (8 style-1 + 7 visual, 2 overlap) | none | ~35 | `library/.../camera.ts` (`CAMERA_PRESETS`); `visual/page/motion.js` (`cameraFx`) |
| Camera angles | **0** as a concept | none | 50 | (orbit and tilt are moves, not angles) |
| UI components | **58** style-1 (`UI`) + **74** artifacts (28 icons, 10 cards, 4 devices, 6 charts, 5 backgrounds, 4 glows, 4 particles, 3 clips, 10 3D) | 74 `(:Artifact)-[:SERVES]->(:Need)` | 0 | `library/.../ui.ts`; `visual/artifacts.ts`; `ui/src/icons.tsx` (19 studio icons, not video) |
| three.js 3D styles | **15**: 5 looks + 10 objects | `(:Look3D)` per film only; objects are `Artifact` | 35 | `render3d/looks.ts` (`LOOKS`); `visual/page/objects.js` (`OBJECTS`) |
| Transitions | **~25 deduped**: 16 style-1 (12 distinct + 4 slide directions), 5 visual, 12 in the graph | 12 `(:Transition)` | ~25 | `library/.../transitions.ts`; `visual/page/motion.js` (`transitionFx`); `craft.json` |

Related catalogues already present (they count toward "more", not toward a row above): 40 scene recipes
(`SCENES`), 23 components and 8 recipes and 206 flows (`craft.json`), 33 props, 12 backgrounds, 18 past-video
specs, 10 layouts; and *style setups*: Style 4 has 49, Style 5 has 66, Anatomy 46 (23 figures), Dark Vox 52,
kept in each style's own `library.ts`, not in the craft graph (the styles graph has a `Setup` node).

## 3. Per category

### 3.1 Voices (63)
- Counted: `VOICES.length` = 63; `en` 47, and `hi ta te kn ml mr gu bn` 2 each. Tagged with accent, gender, age feel,
  energy, tone, use (good for matching a brief).
- Graph: `castVoice` merges a `Voice` only when a film casts it, so the graph knows the voices used, not the library.
  `docs/QUERIES.md` voice queries read history, not the catalogue.
- **Licence:** these are Microsoft Edge's online neural voices called over the edge-tts protocol (`tts.ts` says so).
  That is an unofficial endpoint, not a licence to redistribute or sell audio. It is fine for a demo and a risk for a
  product. ElevenLabs works only with the user's own key. I am not asserting what Microsoft's terms say; the point is
  nobody has *checked*, so treat the licence-safe count as 0 until someone reads them.
- Free, licence-safe sources (verify each model card before shipping):
  - **Kokoro-82M**, Apache-2.0, runs locally on CPU, 54 preset voices in 8 languages (English US/UK, Spanish, French,
    Hindi, Italian, Portuguese-BR, Japanese, Mandarin) [source](https://vast.ai/model/kokoro). Best single answer:
    one local engine gives about 28 usable English-leaning voices today and no per-call cost. Check output timing:
    it gives no word timestamps, so word times need a forced aligner (see Tab/R3).
  - **Piper** voices: engine licensing moved (original repo MIT, archived Oct 2025; successor reported GPL-3.0; it
    embeds espeak-ng, also GPL), and *each voice has its own MODEL_CARD licence* (LibriTTS-R voices are CC BY; some
    Lessac-derived ones are unclear) [discussion](https://github.com/rhasspy/piper/discussions/271). Use only voices
    whose card says CC0 or CC BY, and run it as a separate process to keep GPL out of our code.
  - Other permissive local models to evaluate: Chatterbox (MIT), StyleTTS2 (MIT code; check weights and training
    data), Orpheus (Apache-2.0). Avoid Coqui XTTS (non-commercial CPML) and any "CC BY-NC" voice.
- Closing plan: keep Edge voices as the default for now, add Kokoro (about 30 voices) behind the same `VoiceInfo` shape
  so the Voice Director needs no change, seed all voices into the craft graph as `(:Voice)` with their tags and a
  `licence` field, and make "licence-safe only" a filter.

### 3.2 SFX (22 files, 27 ids, 24 events)
- 22 distinct wavs are vendored: Freesound CC0 (qubodup, Daleonfire, Krokulator and others), Kenney CC0, and tones
  and risers synthesised in this repo (MIT). `map.json` rotates alternates per event so a run never repeats a take.
- `CREDITS-freesound-kenney.md` lists **82** sources (57 `fs.*`, 25 `kenney.*`, all CC0) that are *credited but not
  vendored*: the upstream folder is the rest of the library. Getting those 82 in is a copy job, not a research job,
  and it takes us from 22 to ~100 files at zero licence risk.
- `packages/library/.../sfx.ts` lists 25 entries, some pointing at mp3s that are not in `engine/assets` (`typing.mp3`,
  `woosh.mp3`, `finger-snap.mp3`, `viral.typing.wav`). The two lists have drifted.
- Graph: nothing. Add `(:Sfx {id, role, dur, level_db, align, licence})` and `(:Sfx)-[:FITS]->(:Event)`.
- Free sources for the other ~50 (roles that are thin: impacts, glitches, camera shutter, swipes, ambience, UI beeps,
  bass drops, stingers, laughs/applause, record scratch):
  - **Freesound**, filtered to CC0 only (public domain, no attribution) [freesound.org](https://freesound.org).
    CC BY is usable with credit; skip CC BY-NC.
  - **Kenney audio packs** (UI, Interface, Impact, Digital, Sci-fi sounds), CC0 [kenney.nl/assets](https://kenney.nl/assets).
  - **OpenGameArt**, CC0 filter. **Sonniss GameAudioGDC** yearly free bundles (royalty-free for use in a project; do not
    redistribute raw files).
  - **Mixkit** sound effects: free for commercial use without attribution, but redistributing the raw files as a
    standalone pack is barred [source](https://mixkit.co/llm-info/). Fine inside a mixed film, not as a downloadable set.
  - Synthesis in code (`scripts/make-risers.ts` already does this): whooshes from filtered noise, risers, pings, glitch
    hits. Zero licence risk and deterministic; good for ~20 more.
  - Avoid: BBC Sound Effects (non-commercial licence), ZapSplat free tier (attribution + restrictions).

### 3.3 Music beds (1 shippable, 29 catalogued)
- Vendored: `bed.mp3` ("Funkorama", Kevin MacLeod, CC BY 4.0). **Inconsistent record:** `CREDITS.md` says CC BY 4.0
  while `library/.../music.ts` marks the same bed `copyrighted-local-only` and calls it "owner's track". Someone needs to
  settle which is true before it ships.
- The 29 tracks in `craft.json` are all Kevin MacLeod, **CC BY 4.0**: usable commercially, **attribution is mandatory**
  in every published film's description. Their mp3 files (`media/music/library/*.mp3`) are not in the repo
  (`/data/` and `apps/studio/public/media` are gitignored), so they exist on disk only where someone synced them.
  Mood spread is thin (4 moods). Beat grids are seeded (120 s each), which is real value.
- Free sources for 50+ shippable tracks, safest first:
  - **Kevin MacLeod / incompetech**, CC BY 4.0, 2,000+ tracks; already our source, so just vendor more and record the
    credit line per track (the credit string is already in `craft.json`).
  - **Pixabay Music** (Pixabay Content License: free commercial use; no standalone redistribution) and **Mixkit
    Music**, **Free Music Archive** (per-track licence; filter CC0/CC BY), **ccMixter** (CC BY / CC0 filter),
    **Musopen** and **Internet Archive** public-domain classical.
  - Generative, only if the model licence is permissive: **ACE-Step** and **YuE** are reported as Apache-2.0
    (verify before use). Avoid MusicGen weights (CC BY-NC) and treat Stable Audio Open's community licence as
    revenue-capped.
  - For every track record `licence`, `credit`, `bpm`, `beats`, `mood`, `energy`, and `needsAttribution` so the
    exporter writes the credit line automatically.

### 3.4 Caption styles (~8)
What actually renders words over a video today:
1. `caption-pop` (Pop Words) and 2. `caption-karaoke` (Karaoke Pill): MotionEasy CaptionsEasy components, drawn by
   `router/captions-kit.ts` with our word timings.
3. One ASS style (white, dark outline, key word in accent) in `router/captions.ts`.
4-7. `phoneCaption` prop styles: `plain`, `stroke`, `box`, `hormozi` (`library/.../props.ts`).
8. The visual compositor's caption band (`visual/page/compose.js`).
Separately, `library/.../text.ts` has ~14 *text looks* (ink, accent slam, serif gold, kicker, quiet, stat, bullet,
chip, dark title, premium metal/neon/glow, label pill) that are title/kinetic text, not word-by-word captions.
Fonts: 18 woff2, all OFL (`renderer/fonts`). No graph presence.
- A caption style is a small parameter set: font, weight, case, size band, fill, stroke, shadow, highlight rule
  (current word / key word / none), entry animation, chunk size, position, emoji use. That is cheap to author in
  JSON, which is why 50 is reachable without much code.
- Free sources: all **original** (we author them; no licence issue). Fonts: Google Fonts / Fontsource, OFL, e.g.
  Anton, Bebas Neue, Bangers, Luckiest Guy, Permanent Marker, Montserrat, Poppins, Oswald, Archivo Black, Rubik,
  Barlow Condensed, Lilita One, Fredoka (OFL, commercial use fine). Style references to *study, not copy*: the
  public caption looks of Hormozi, Karaoke, "Beasty", boxed word-highlight, typewriter, bounce, shake, glitch.
- Emoji for captions: Twemoji (CC BY 4.0) or Noto Emoji (OFL). Avoid OpenMoji for sale (CC BY-SA).

### 3.5 Video effects (65)
- 51 style-1 effects in six groups (word 10, object 13, draw 9, accent 7, stage 7, exit 5) and 8 enters + 6 idles in
  the visual compositor. Strongest category; no graph rows.
- Missing classes a pro edit uses: colour grades / LUTs (only one, `clip-grade`), speed ramps and freeze frames, film
  grain/light leaks/dust overlays (`grain-vignette` is one), glitch/RGB split/chromatic aberration, lens flare, screen
  shake, mask reveals, split-screen, picture-in-picture, blur backdrops, zoom-punch on beat, subtitle highlights,
  auto-reframe/face-aware crop.
- Sources: our own GLSL/canvas code; LUTs from free CC0 packs (e.g. Freshluts, RocketStock free LUTs: check licence per
  pack) or generate ours; overlays from Pexels/Pixabay/Mixkit footage (Mixkit free licence); ffmpeg filters (LGPL/GPL by
  build) for grading, `xfade`, `zoompan`, `eq`, `curves`.

### 3.6 Camera moves and angles (~15 moves, 0 angles)
- Style-1: `push-in`, `roll-settle`, `roll-punch`, `punch-in`, `pull-out`, `dive-to-detail`, `reveal-pull`,
  `opening-zoom-out`. Visual: `push`, `pull`, `drift-left`, `drift-right`, `orbit`, `rise`, `tilt`, all with a
  handheld wobble. Camera *angles* (low/high/Dutch/over-shoulder/top-down/close-up/wide/two-shot) are not modelled.
- Proposal: split into **move** (how the camera travels: dolly, truck, pedestal, crane up/down, orbit, whip-pan,
  rack focus, handheld, snap zoom, crash zoom, slow push, parallax slide, push + roll) and **angle** (where it sits:
  eye level, low, high, Dutch, top-down, close-up, extreme close-up, wide, over-the-shoulder, profile). 15 moves x ~6
  angles are 90 combinations from 25 parameters, and it can live as JSON consumed by `cameraFx`.
- Sources: film-grammar references (study); the three.js camera itself needs no asset. No licence issue.

### 3.7 UI components (58 + 74)
- Style-1 `UI` (58): phone, browser, laptop, lock phone, notification, chat, voice note, comment feed, crowd, typebox,
  CTA pill, cursor, search bar, receipt, stamp, seal, coin, price tag, reach chart, timeline, flip board, shield, etc.
  Visual artifacts (74): 28 glyph icons, 10 cards, 4 devices, 6 charts, backgrounds, glows, particles, 10 3D objects,
  3 clips, all in FalkorDB with `SERVES` need edges and critic ratings. This is the most graph-ready category.
- Gaps: real product UI (dashboards, tables, forms, toggles, pricing cards, code editor, terminal, kanban,
  calendar, map pins, tweet/post cards, app-store badges, review stars, progress rings) and social-proof frames
  (testimonial, logo wall, rating row).
- Sources: authored by us. Icons: Lucide (ISC), Phosphor (MIT), Tabler (MIT), Heroicons (MIT); brand logos from
  Simple Icons (CC0, but trademarks still apply; use only for the user's own brand or nominative references).

### 3.8 three.js 3D styles (15)
- `render3d`: `particles`, `turntable`, `tower`, `city`, `orbit`. Visual objects: `cubes`, `gyro`, `coin`, `crystal`,
  `knot`, `network`, `dotglobe`, `tower`, `logo`, `shield`. Deterministic, SwiftShader, no GPU (`docs/3D.md`).
- Gap 35. Ideas: wave terrain, DNA helix, glass slab stack, floating cards carousel, ribbon/wire flow, voxel grid,
  low-poly planet, metaballs, tunnel fly-through, text extrusion, phone with rotating screen, chart bars, bokeh
  field, shatter, pixel rain, laser grid, floating islands, product turntable on a plinth.
- Free sources: three.js examples (MIT) as technique references; **Poly Haven** models, HDRIs and textures (all CC0,
  and `footage/polyhaven.ts` already fetches them, no key) [polyhaven.com](https://polyhaven.com); **Quaternius** and
  **Kenney** 3D packs (CC0); **Poly Pizza** (CC0 and CC BY, per model); Khronos glTF sample assets (per-model licence).
  Keep every GLB under the 3 MB rule in `CLAUDE.md`; most 3D styles can be pure code (no asset at all).

### 3.9 Transitions (~25 deduped)
- Style-1 (16): `slide-up/down/left/right/wide`, `zoom-out-open`, `push-through`, `pull-out-reveal`,
  `hard-cut-on-beat`, `riser-into-cut`, `glide-out-before-cut`, `shatter-out`, `collapse-to-point`, `search-to-site`,
  `page-dissolve`, `line-swap`. Visual (5): `whip-left`, `whip-right`, `push-up`, `slide-down`, `zoom-through`. Graph (12,
  from MotionEasy): `whip zoom push slide match recede iris wipe shutter flash blur cut`. They overlap, and the graph's
  12 are *families*, not the 21 implementations.
- Free sources: **GL Transitions** (GLSL shaders; repository is on GitHub with hundreds of stars, widely reported as MIT,
  count and per-file licence not verified here, so read its LICENSE and each file's header) [gl-transitions](https://github.com/gl-transitions/gl-transitions);
  **ffmpeg `xfade`** (roughly 50 built-in blends: fade, wipes, slides, circle/radial, pixelize, dissolve, squeeze,
  zoom; LGPL/GPL by build); our own shader code. Each needs one `blur`/`dx`/`mask` function in the compositor.
- Also needed: sound-matched transitions (the SFX `whoosh` rotated by direction) and "match cut" support.

## 4. Source licence cheat sheet

| Licence | What it needs from us | Safe for a paid product |
|---|---|---|
| CC0 / public domain | nothing | yes |
| MIT, Apache-2.0, ISC, OFL | keep the notice; fonts may not be sold alone | yes |
| CC BY 4.0 | credit in the film's description | yes, with a credit line |
| CC BY-SA | share-alike contaminates outputs/derivatives | avoid |
| CC BY-NC, "free for personal use" | no commercial use | **no** |
| Mixkit, Pixabay, Pexels | free to use in a film; no standalone redistribution | yes, do not ship as a downloadable pack |
| Unofficial endpoints (Edge TTS) | no licence at all | demo only until read |

Rule for the graph: every library node carries `licence`, `credit` and `needsAttribution`; the exporter prints the
credits; a "safe only" flag filters the rest. This is also the cheapest way to turn "we hope it's licensed" into a fact.

## 5. Proposed new categories

Missing from the nine, and each is a thing a senior editor reaches for:

| New category | Why | Today | Free source |
|---|---|---|---|
| Stock footage / b-roll | the biggest quality lever; real motion | 6 providers wired (Mixkit, Wikimedia Commons, Pixabay, Pexels, NASA, Internet Archive) via `footage/sources.ts`, graph has `(:Clip)` | those, plus Coverr, Videvo free tier (check per clip) |
| Colour grades / LUTs | makes cuts from different clips match; instant "pro" look | 1 (`clip-grade`) | own grades, CC0 LUT packs (verify) |
| Overlays | grain, light leaks, dust, film burn, VHS, bokeh, particles | `grain-vignette` + 4 particle artifacts | CC0/Mixkit overlay footage; or generated |
| Text/title animations (kinetic type) | hooks and titles are the most-watched second | ~14 text looks | own code |
| Lower thirds and name bars | essential for interviews and explainers | 0 | own code |
| Data-viz charts | stats are persuasive | 6 chart artifacts | own code; chart styles |
| Stickers, emoji, shapes, arrows | reaction frames, emphasis | partial (props 33) | Twemoji (CC BY), Noto (OFL), own SVG |
| Backgrounds | gradient, mesh, noise, grid, aurora | 12 + 5 backgrounds | own shaders |
| Edit rhythms / pacing presets | the thing that makes a style a style: cuts per second, zoom on beat, jump-cut cadence | per-style rules inside 5 style folders | derive from R4 |
| Hook patterns | first 3 s decide retention | 1 component (`hook-strike`) | own: question, bold claim, pattern interrupt, before/after, "stop scrolling" |
| Speed ramps / freeze / reverse | classic pro moves | 0 | ffmpeg `setpts`, our compositor |
| Reframing / smart crop | one source, many aspect ratios | 3 formats, no face-aware crop | MediaPipe (Apache-2.0), OpenCV |
| Ambience beds | room tone, city, cafe, keyboard, wind; hides cuts | 0 | Freesound CC0, Kenney |
| Voice effects | radio, phone, whisper, echo | 0 | ffmpeg filters |
| Maps | already built: MapLibre globe/route | `maps/` + `(:Place)` | Natural Earth (public domain) |
| Avatar / presenter | Moovi himself on screen | Moovi character (code SDF) | ours |

Highest return first: **stock footage graph, LUTs, overlays, hook patterns, edit-rhythm presets, ambience.**

## 6. What closes the gap, in order (cost to value)

1. **Vendor what is already credited**: 82 CC0 SFX, more Kevin MacLeod tracks (CC BY, record credits).
   Takes sfx 22 → ~100 and music 1 → 30+ shippable, zero research.
2. **Seed the whole library into the craft graph** with one shape: `(:Asset {id, category, runtime, licence, credit, tags})`
   plus `SERVES->Need` edges, as `Artifact` already does. This is the "FalkorDB stays load-bearing" rule applied to
   the whole library, and it lets the deciding agent query by need, mood, cost and rating.
3. **Unify ids** across the style-1 library and the visual compositor (`push`, `push-in`; `whip-left`, `slide-left`).
4. **Author data-only categories** (captions 8 → 50, camera 15 → 50 incl. angles, transitions 25 → 50): JSON params,
   no new assets.
5. **Replace Edge voices with a licence-clean local engine** (Kokoro first) behind the same `VoiceInfo`.
6. **3D**: 15 → 50 as code, with Poly Haven / Quaternius CC0 models only where code cannot do it.

## 7. Open questions (for Claude 1 / the masters)

- Is `bed.mp3` "owner's track" or CC BY 4.0 Kevin MacLeod? The two records disagree (3.3).
- Is Edge TTS acceptable for a paid product? If not, voices need Kokoro or ElevenLabs-with-user-key before launch.
- Is attribution in the film description acceptable for CC BY music, or do we need a no-attribution-only music set?
- Should the unified library carry a `runtime` field so one node can have both a style-1 and a visual implementation?
