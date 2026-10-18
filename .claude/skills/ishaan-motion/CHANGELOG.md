# Changelog
- 1.16.0 (2026-10-18): Ishaan on Showreel v2 (0/10: "supposed to be a brand showreel", "could not understand what any reel is about", black screens where clips failed): showreel.md "What a Showreel is" (a brand showreel, the writer as creative director, understood by second 3, watched, remembered), the arc rewritten around the brand (solution names it, cta says it), the never-a-black-frame law; taste.md Craft: never a black frame, a promo is understood by second 3.
- 1.15.3 (2026-10-18): Showreel: a topic film's cta names no site, shop or studio (v2 invented lighthouse.org, WatchLab, Indigo Studio); the problem beat is a real problem, never a made-up disaster.
- 1.15.2 (2026-10-18): Showreel script arc (Ishaan: "hook -> problem -> solution -> .. -> cta"): every Showreel script fills hook, problem, solution, climax, cta in order, read aloud; humanized writing laws; the old ban on a spoken CTA is removed; theme voices are tone only.
- 1.15.0 (2026-10-18): Showreel branch references/showreel.md, read at runtime by the Showreel writer (packages/engine/src/showreel): the theme lock, the writing laws, four themes (night-stage, editorial, blueprint, real-footage) holding today's voices, pending Ishaan.
- 1.14.0 (2026-10-18): Launch skillset absorbed to f15: launch.md reference intake, looks L-REF-3 "Product tour" and L-REF-4 "Calm one-hue"; canvas-engine 3D shots (three.js), soft fields, plates and glass; music-and-sound real bed, beat phase, beat warp, the owner pack by map.json; shots-and-transitions refs 3–4; camera.md rows (UI dive, screen pull-back, 3D dolly, calm push).
- 1.13.8 (2026-10-18): launch.md item 7, the finish layers (real bed, owner sfx pack by map.json, cuts on the beat by a time warp, filter-free glass, sky band).
- 1.13.4 (2026-10-18): launch.md shot-for-shot item 6 (owner on f12: "better, push it further"): the reference's own moves (deep dive into one real element, drag-and-drop, blur placeholders, type at reference size, 3D composited onto the light world), clips decode from Play.
- 1.13.3 (2026-10-18): launch.md "When Ishaan sends a reference to match, rebuild it shot for shot" (Ishaan on f11: 2/10, "not at all the premium launch video i sent"): map the reference second by second, use the brand's REAL product screens and renders, real moving plates, one continuous camera per section.
- 1.13.1 (2026-10-18): references/camera.md (which camera move where, durations, eases, the smooth-speed law); motion-feel "smooth as butter"; canvas-engine rAF measuring, filter-free blur variants, bitmaps; launch.md look L-UI-2 "One material" and the f7–f10 lessons.
- 1.12.3 (2026-10-18): launch.md "smooth, filled, and ramped": sprite/blur-variant rendering rule with measured frame times, the media tools (footage finder + drawn art), the premium speed ramp (camera:speed-ramp).
- 1.12.2 (2026-10-18): launch.md "a new grammar never costs the craft" (Ishaan on f7: premiumness 10 → 6); the f8 checklist.
- 1.12.1 (2026-10-18): Launch look L-UI-1 "Product UI" absorbed from Resend v6 (kits/launch-ui, scripts/launch-ui.ts: any site in under a minute).
- 1.11.2 (2026-10-18): palette gate (read the site CSS first, every hex a ramp token, monochrome brands stay monochrome, content colours count); launch.md item 5.
- 1.11.1 (2026-10-18): Launch branch references/launch.md (Ishaan's verdicts f1-f5: product UI as the film, chaos to order, bridge element, product-only beat, brand look from the live site).

## 1.0.0 (2026-10-07)
- First version, distilled from the CaptionsEasy launch film (Remotion, 40 s), the MotionEasy canvas engine
  (58 components, 13 transitions, 13 prompt kits), the bloom-reel showreel backtrack and the motion-feel review notes.

## 1.1.0 (2026-10-07)
- §0 five non-negotiables: know your limits and ask for assets; beyond-perfectionist rebuilds (the leap check);
  micro-details only added, never skipped; best hybrid stack with install-and-integrate; pick the 4th/5th idea.
- New references: ideation.md (5-idea drill), toolbox.md (per-shot engine choice, hybrid recipes, install log).
- Research-story-reel learnings: word-by-word type, visualise the verb, two worlds, depth of field, new transitions,
  15-second breakdown cadence.

## 1.2.0 (2026-10-07)
- After a 2/10 review: §11 default to the cinematic one-take, VO by default, physical ideas per beat.
- toolbox.md: what works for 3D inside Remotion on this machine (custom post, glyph planes, advance-before-continueRender).

## 1.3.0 (2026-10-16)
- §12 and references/talking-head.md: the talking-head / voice-led edit playbook (voice as the grid, layouts as data, camera on jump cuts, captions, big words, panels that act out their sentence, chapter cards from the poster), learned rebuilding reference R1.
- Owner A/B on R1: the skill-guided clone beat a faithful rule-by-rule copy. The skill is now used on every video job and grows after every reference (see "Keep improving this skill").
- New references/canvas-engine.md: the tested canvas-2D port of every helper (bisection bezier, closed-form springs,
  log pull, drift, velocity ghosts, word-by-word re-flow, slams, slot rolls, panel wipe/pixel/bars, DOF cards) plus the
  `?grid=` check sheet, sweep and determinism tools.
- Rule 0.1: when working unattended, build labelled swappable stand-ins and put the asset wish-list in the report.
- §4 voice-as-grid; §7 keeping a glowing-type look without glow-everywhere; §8 quieter SFX under a voice;
  §9 browser preview builds; §10 live-preview finishing; §11 exception for talking-head rebuilds.
- lessons.md: 8 build lessons from R1 (black reveals under panels, out-of-bounds camera keys, gradients on scaled text,
  behind-the-head placement, stacked lockups, Whisper stamps, the getImageData perf trap). checklist.md: talking-head
  and live-preview sections. New R1 transitions in shots-and-transitions.md; canvas row in toolbox.md; R1 case study.

## 1.4.0 (2026-10-16)
- talking-head.md: the roadmap / levels grammar from reference R2 (prop-row level marker on the desk, coin-flip level
  worlds, two-tier captions, hand labels with self-drawing arrows, grid boards + lime stickers, shatter, black punch, desk dive).
- lessons.md: list edits keep a physical marker in the speaker's world; share the canvas engine across references.
- The shared canvas engine and each reference's devices now live in the Moovi repo as kits (packages/library/src/kits).

## 1.5.0 (2026-10-16)
- talking-head.md: the chapter-dial grammar from reference R3 (one hero object holds the list; blackletter + gold heat;
  night-ground panels; library sound design only where the reference has none).
- Workflow: start every reference with `scripts/ref-intake.ts` (Moovi repo) and reuse kits/motion (engine + sfx kit)
  and the palette-driven speaker world; write only the new devices.

## 1.6.0 (2026-10-16)
- The quality ratchet (references/ratchet.md): every new film is judged blind against the best film so far and ships only at or above it; scoreboard kept there.
- taste.md: type, composition and craft rules from the owner and the blind judge (no full Fraktur; lit metal titles need an additive halo; fill panels; one big card at a time; the owner overrides the judge).

## 1.7.0 (2026-10-16)
- Reference R4 (red-table tutorial): the ratchet now requires **strictly above** the previous best sheet **in the same
  judge round**. Taste: never name a font family "Serif"; the tall condensed serif hero word with an eye for the dot;
  marker lettering inside measured widths; captions never touch a card; dense hardware cards.

## 1.8.0 (2026-10-16)
- Footage spans: fetch real b-roll and photos (Moovi's footage finder, scripts/ref-footage.ts) instead of drawing
  stand-ins, which read as paused video (owner note on R4). Rule 0.1's unattended clause now fetches first.

## 1.9.0 (2026-10-16)
- Reference R5 (night-glass how-to): R5 shipped at 7.0 against R4's sheet at 4.8 in the same round. Taste gains a "Glass and UI" section
  (live-blur glass, drawn walkthroughs with line icons and a touch dot, removed items turn red). Lessons: the self-check
  side-by-side before the judge, and check every fetched footage poster.

## 1.10.0 (2026-10-18)
- Rule 0.6, no silent defaults: every default (colour, font, ease, layout, saved style, pipeline rule) is questioned against alternatives.
- New references/palette.md: the banned AI-default palettes, the 5-palette drill, OKLCH tint ramps, roles, contrast from ramps.
- §10 storyboard board spec: frame plus a structured side panel, a timeline ribbon, the palette strip (owner: notes under frames read poorly).

## 1.10.1 (2026-10-18)
- Lessons: a moving piece is shown as a playable preview (range-capable server); every owner correction lands in the skills unasked.

## 1.11.0 (2026-10-18)
- New references/edit-fundamentals.md: editing a talking head from first principles (brand world, two worlds, devices by sentence function and verb, one caption system with backdrop-aware contrast, layout rhythm, build as a beat spec).

## 1.11.1 (2026-10-18)
- Captions: never punctuation; the premium two-tier glow caption (Moovi 1.1 green / 1.2 red) spec in talking-head.md; lessons on bloom vs stacked shadows, decoding a font from a zoomed reference, one-cut fonts thickened by stroke, reading motion from a reel at 30 fps.

## 1.11.2 (2026-10-18)
- Premium Caption 1 shipped as two variations whose colour comes from the video (one accent → fill ramp + bloom); 1.1 word spacing.

## 1.12.0 (2026-10-18)
- edit-fundamentals.md: creator-reel devices decoded from em1 (cascade on springs, dim + product on top, the lit one in a row, the post frame, object wipe, comment pill ending), as brand-reskinnable fundamentals.

## 1.11.3 (2026-10-18)
- Premium Caption 2 (hybrid three-tier, AE glow); lessons: letter vs word spacing, AE glow on every tier, premium faces from a grid, size type by measured cap height.

## 1.11.4 (2026-10-18)
- Lesson: difference-blend faces and extruded 3D type (Premium Caption 3); check captionseasy looks for a named technique first.

## 1.11.5 (2026-10-18)
- Lesson: words behind the speaker need a person matte (MediaPipe in the browser); difference faces: invert first, accent over.

## 1.11.6 (2026-10-18)
- Lesson: negative difference captions are pure (no fill over); 3D type = words on turned perspective planes, not extrusion.

## 1.11.7 (2026-10-18)
- Premium Caption 3 per the owner's breakdown (stack + shiny negative behind the speaker); lesson: when a look keeps missing, ask for the owner's own breakdown.

## 1.11.8 (2026-10-18)
- Rule: captions never cover the face. Premium Caption 3 v7: negative colour from the background, reel composition; lesson: an owner breakdown is a description, apply taste.

## 1.11.9 (2026-10-18)
- Premium Caption 3: the highlight spans the shoulders at neck height; the rest is arranged around it.

## 1.12.0 (2026-10-18)
- edit-fundamentals §12, the recipe for a top-tier talking-head edit every time; §13 the motion-graphics gap.

## 1.13.2 (2026-10-18)
- Lesson: smooth captions in rAF (sprite cache, matte in a worker, measured fps).

## 1.13.5 (2026-10-18)
- Lesson: glossy display type (deep fill, bevel rims, solid extrusion, firm shadow); small words need a firm shadow.

## 1.13.7 (2026-10-18)
- Removed the edit `window` form rule and its automatic picker (1.13.6 and the lab-vlog note): Claude's own invention, never the owner's taste; the owner rated the edit it produced 1/10.

## 1.13.9 (2026-10-18)
- Rule: caption cards at least 1.2 s on screen, hold up to 1 s after the last word.

## 1.13.10 (2026-10-18)
- Rule: text behind the speaker is wider than the shoulders, centred at the neck, never across the face.

## 1.13.10 (2026-10-18)
- Owner rule: the edit's motion graphics, clips and UI components are tailored to each video, never a fixed set.

## 1.14.1 (2026-10-18)
- Rule: text behind the speaker is wider than the shoulders, centred at the neck, never across the face.

## 1.15.1 (2026-10-18)
- Owner rule: capable models invent each graphic; a small free model directs from the approved library menu (menu.json) and never builds from scratch.

## 1.16.1 (2026-10-18)
- Owner: only his approved edit rules stay (the v1-v6 board-era sections and the retired looks' numbers are scrapped from edit-fundamentals §1-§9).
- Owner rule: every edit shows the checklist (burn-in graphics, a form change, full-screen, camera, leaks, grade, palette from the footage, sfx on every arrival, music, smooth), at least 80-90%.

## 1.16.2 (2026-10-18)
- Owner: the capable model designs premium motion graphics itself (the player's `art` device: SVG/HTML + CSS on the edit's clock).

## 1.16.3 (2026-10-18)
- Owner on the demo film's ref D1 (2/10, "copy it exactly ... the sphere became a weird idk what"): backtracking.md "Copy it exactly" (formation first, 10 fps measuring, the reference's pacing and sound pattern, same frame and time); lessons.md line.

## 1.16.4 (2026-10-18)
- Owner (demo film H1): show every iteration as an MP4 file with sound, sent to him; a live browser page is not a deliverable (lessons.md).

## 1.16.5 (2026-10-18)
- Owner (demo hook): inserts follow the spoken order and live only on their word; set-pieces are filled with real footage-finder pictures, never invented UI or placeholders (lessons.md).

## 1.16.6 (2026-10-18)
- Owner (demo beat 2): a 3D reference is rebuilt in 3D, never flattened to 2D; only headline type may be a 2D overlay (lessons.md).

## 1.16.7 (2026-10-18)
- Owner (demo beat 2, 3/10): a film made 'from my clone' reuses the clone's own code, grade, type and stems re-timed to the new lines; never a fresh lookalike (lessons.md).

## 1.16.6 (2026-10-18)
- Owner (Meet Moovi beat): product films from the product's own code and real captured UI only (no other films, no invented or placeholder UI); the hero morphs through every transition; Apple-grade camera keys, whips with motion blur, segment-to-window UI morphs (lessons.md).
