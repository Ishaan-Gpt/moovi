---
name: ishaan-motion
description: Ishaan Motion: the full approach for making motion-design videos that feel hand-made by a senior motion designer, never "AI-made". Use it whenever someone wants a launch film, product promo, explainer, showreel, Reel/Short/TikTok, LinkedIn/X video, animated ad, kinetic-type piece, animated social post or a talking-head Reel with captions, big words and graphic inserts, OR wants an existing video rebuilt, "made like this reference", re-timed to music, or made to feel more premium. Works with any engine (Remotion, the MotionEasy canvas engine, HyperFrames, plain canvas/three.js browser previews, After Effects-style specs). Trigger even if the user only says "make a video for my product", "animate this", "make it feel like [some video]", or "this motion feels off".
---

# Ishaan Motion

A way of thinking about motion design rather than a template pack. Every video it makes has:
- one idea per shot,
- cuts locked to a measured grid (the music's beats, or the voice's word stamps on a talking-head edit),
- transitions that come from the objects themselves,
- physical motion curves,
- real product assets,
- a strict list of effects it never uses.

```
Intake ─> Reference study ─> Message + shot list ─> Grid (beats or words) ─> Build ─> Finish layers ─> Review loop ─> Ship
```

Work through the stages in order and don't skip ahead. Most bad videos come from starting the build before the beat grid and the shot list exist.

## 0. The six non-negotiables (read before anything else)

1. **Know your limits. Never make a cheap copy.** If a shot would look better with a real video, image, 3D render, recording or asset than with a code approximation, **stop and ask for it**. Say exactly what you need: format, size, alpha or not, length, angle, and why it beats the code version. Ask in one batched list, early (at intake or reference study), never halfway through the build. A labelled placeholder is better than a fake. Only build it in code when code genuinely wins or the owner says no.
   **When you are working unattended** (a side session, a one-pass brief, nobody to answer): do not stall. **First fetch real footage or a photo** for every span where the reference cuts to b-roll, a photo or a clip inside a device (Moovi: `scripts/ref-footage.ts <id> name="query"`, the engine footage finder, licence on every clip; play it with `kits/motion/footage.js`). A drawn stand-in there reads as a paused video. Only when nothing passes: build the best labelled stand-in, keep it swappable (one function or file per asset), and put the batched wish-list (spec + reason per asset) at the top of your report.
2. **Beyond-perfectionist, never "optimized".** When rebuilding a reference, matching it is the floor, not the goal. Take every shot a leap forward: richer depth, better type, cleaner choreography, more precise timing and more layered sound. Ask of every shot: *what would make the original's designer jealous?* Never ship the simplified or "good enough" version to save effort.
3. **Micro-details are never skipped, only added.** Every arrival, hover, press, settle, cursor move, number change and colour change gets its micro-motion (blur-in, overshoot, secondary wobble, shadow and light response) **and** its SFX. If the reference has it, keep it and improve it. If the reference lacks it but it would help, add it. Removing a micro-effect needs a reason; adding one doesn't.
4. **Best hybrid stack, used proudly.** Don't stay loyal to one engine. Choose per shot from Remotion, HyperFrames, the MotionEasy canvas engine, Three.js/R3F, GSAP, Lottie/Rive, shaders, ffmpeg and Python analysis. Composite them if that gives the best frame. If a library, skill or tool would speed up or improve the output, **install it, integrate it and use it** (respect licences; record it in `references/toolbox.md`). Research when unsure: docs, examples, Motion/Remotion skills, the web.
5. **Never the first idea. Pick the 4th or 5th.** For every shot, transition, layout, text treatment and icon, write down 5 ideas. The first 1–3 are what everyone (and every AI) would make. Choose from 4–5, or combine them. The procedure is in `references/ideation.md`. If the choice still looks like a template, go again.
6. **No silent defaults. Ever.** Anything that arrived by default (a colour, a font, an ease, a layout, a caption style, an SFX, a library preset, a pipeline template, a saved style or rule table, the first thing that came to mind) is a suspect, not a choice. Before keeping it, ask: *can something be better?* Write at least two alternatives and keep the default only if it beats them, and say why in the notes. This includes this repo's own saved looks, kits and rule tables: the owner judged them weak (2026-10-18), so they are references to out-invent, never to apply blindly. **Colour first:** never the AI-default palette (blue, orange, cream, navy + ice blue, neon on black); run the palette drill in `references/palette.md` and build tint ramps for contrast.

## 1. Intake (ask once, in one message)

Offer to brainstorm, then ask only what you need. Whatever the person skips, decide yourself and say what you chose.
- **Goal + platform:** launch film, Reel, ad or showreel. Format: 9:16 1080×1920, 1:1, 4:5 1080×1350, or 16:9 1920×1080. Length.
- **Brand:** name, the one promise, palette, fonts, logo (vector if possible).
- **Real assets:** screen recordings, site screenshots, product clips, photos, props. Ask for them; never fake them.
- **Asset wish-list:** after the shot list exists, send ONE list of every asset that would beat a code version (rule 0.1), each with spec + reason.
- **Facts:** what claims, numbers and customers are real. **Never invent any.**
- **Reference video(s)** they love → go to §2.
- **Music:** theirs, or pick a CC0/CC-BY track by mood (soft, uplifting, groove, driving, dramatic).

## 2. Reference study (backtracking)

If there is a reference, measure it before designing anything. The full procedure is in `references/backtracking.md`.
Download it, sample frames at fixed timestamps, then write down:
- the BPM and where the cuts fall,
- the palette rhythm,
- type sizes,
- every transition,
- the camera on each shot,
- the ease curves.

Sort each shot into a tier:
- **A:** code-native.
- **B:** needs an asset, then code.
- **C:** hand cel animation. Say honestly that it is out of scope, and offer puppet rigs or supplied clips instead.

Copy the craft and never the content: no other people's names, client logos or illustrations.

## 3. Message → shot list

Use the story arc **hook (pain) → drop (the line) → logo → product proof → how it works → breadth → facts → end card**. Adapt it, but always have a hook and a payoff.
- Each shot gets **one sentence and one hero word**. The hero word goes in serif italic or the accent colour.
- Each shot gets **one signature move** (a morph, a slam, a match cut, a dive or a wall). If you can't name the move, the shot isn't designed yet.
- Write it as a table with these columns: `# | beats | time | shot | key move`. A worked example is in `references/case-studies.md`.
- **Visualise the verb.** When the text is the narration, each phrase's visual acts out its verb: "born" makes cards appear, "fade out" blurs things away, "real" turns the word the accent colour. Write the verb → action pairs into the shot list.
- **Two worlds.** Give the story a light world and a dark world (for example: ideas/promise vs system/problem). Switching worlds signals a change of topic.
- When breaking down a long reference, go **15 s at a time**: shot table, then learnings, then open questions. Don't build until the owner says so.

## 4. Music and the beat grid (before any visuals)

**No music bed (talking head, VO-only explainer)?** The word stamps are the grid: every cut, slam and arrival is `at(word)`, never a typed second. See `references/talking-head.md` for cleaning Whisper stamps and the cut/slam offsets.


Measure the BPM and the first downbeat, then cut the track **on bar lines** so the climax and the final chord land where the story needs them. After that, every time in the project is a beat: `B(n) = round(n × fps × 60 / bpm)`. Cuts go on bars or half-bars, slams go on beats, and the end card lands on the last chord. Details are in `references/music-and-sound.md`.

## 5. Motion laws (the part that separates pro from AI)

The full list with the maths is in `references/motion-feel.md`. The short version:
1. **No dead stops between keys.** Ease only at the start and end of a move; interior keys flow through.
2. **Cut in on motion.** A shot starts already moving and never eases in from zero at a cut.
3. **The camera is never still.** It does a 3–6% push or drift over the whole shot, moving on frame 1 and still moving on the last frame, with 2–4 parallax planes. Which move where, its duration and ease, and the smooth-speed law (speed is a curve, never a step): `references/camera.md`.
4. **Big scale changes in log space:** `s = S0 ** ((1 - t) ** 4)`.
5. **Stagger with jitter.** Never give a group one shared start frame (use roughly 2–2.5 f at 30 fps, or 40–80 ms).
6. **Long soft settles:** the last 5% of travel takes about a third of the time.
7. **Speed ramps** in the After Effects style: `ramp (0.86,0,0.07,1)`, `hard (0.95,0,0.05,1)`, `out (0.16,1,0.3,1)`, `outBack (0.34,1.32,0.64,1)`.
8. **Springs with small overshoot.** Overshoot is only for pops (icons, chips).
9. **Motion blur from velocity** (180° shutter: blur ≈ 0.28 × px/frame, capped).
10. Separate objects get separate timing. One object moves all of its own channels together.
11. **Word-by-word type.** Each word rises a few px, goes blur → sharp and grey → ink; centred lines re-flow as they grow (the slide is part of the motion); spacing slows before the key word.
12. **Depth of field is a tool.** Blur near and far planes, keep the subject sharp, and use defocus as a transition (objects melting into soft blobs).

## 6. Transitions: motivated, never crossfades

Choose transitions from `references/shots-and-transitions.md`: iris born from a dot inside the type, melt-to-blobs, text blur-out, leftover-element bridge, pull-out reveal, morph, iris, match cut (the end frame equals the next shot's start frame), whip pan, dive into a tile, giant-object wipe, pixel-block dissolve, white flash on motion, rack focus, mosaic→sharp, bar wipe and recede. **No transition should appear more than twice in a row.**

## 7. Look

The rules are in `references/look.md` and `references/palette.md`:
- **A rare, derived palette, built as OKLCH ramps** (palette.md): never the AI defaults (blue/orange/cream/navy + ice blue/neon on black). The brand's own colour is kept as its mark; the film's world is built around it from the drill, not from defaults.
- Alternate light and dark every 1–3 shots so cuts still read at speed.
- Dark shots get **one** big soft colour bloom; never a glow on every element.
- A display sans plus a serif italic accent.
- Text uses measured layout and never overflows.
- Phone-safe margins and no overlapping elements.

**Banned unless asked:** crossfades, lens flares, glows on everything, camera shake, random particles, stock-looking 3D, fake UI.

**When the reference's look IS glowing type** (lit-sign titles, hot keys): keep the look, but build it as one soft bloom
behind the lockup that ignites with the word (a short deterministic flicker, then on) plus a bright heat gradient in the
fill, never a `shadowBlur` stroke glow on each word. Expect it to read a little flatter than the original; push the
gradient's bright end (near-white top) before adding more glow.

## 8. Sound

The music carries the piece (on a talking head, the voice does: SFX quieter still, gains about 0.15–0.5). SFX are sparse and recorded (CC0): a hit on slams, a whoosh on wipes, a click on cursor clicks, one keystroke per typed word. Risers are re-timed so they end exactly on the hit. Master to **−14 LUFS with true peak ≤ −1 dB**. Credit CC-BY tracks on the end card.

## 9. Build rules (any engine)

- Render is a **pure function of frame + props**: no `Math.random()`, `Date.now()`, timers or CSS animation. Use seeded random only. The same input must give the same frame.
- Keep the brand in tokens and timing in beats, and keep helpers (`tw`, `kf`, `sp`, `vel`, `shutter`, `rand`) in one core file. The reference implementation is in `references/engine-snippets.md`.
- Choose the engine per shot (rule 0.4). The hybrid recipes and the install-and-integrate log are in `references/toolbox.md`.
- Reuse components and keep posts as data. A new video should be a spec (clips + props + transition + music), with new code only when the library truly lacks something.
- **Browser preview builds** (canvas 2D / three.js, played against the voice track): time comes from the audio element,
  `frame(t)` renders everything, and a `?grid=t1,t2,…` mode draws our frame above the reference frame at each time.
  The tested canvas port of every helper (bezier solver, closed-form springs, log pull, drift, velocity ghosts,
  word-by-word lines, slams, slot rolls, panel wipes/dissolves) is in `references/canvas-engine.md`.

## 10. Review loop and ship checklist

1. **Stills first.** Make contact sheets at fixed timestamps and compare them side by side with the reference. Fix size and timing before any full render.
   **The storyboard board** (what the owner reviews; owner, 2026-10-18: small grey notes under each frame "read poorly"):
   - one card per beat: the frame large on the left, a **structured side panel** on the right, never a line of small text under it;
   - the panel, in the film's own type and palette, readable at phone size (≥ 22 px at board scale): the time and
     beat as a headline, the spoken words with the hero word marked, then labelled rows **CAM · TYPE · GFX · FX · SFX ·
     MUSIC · TRANSITION OUT**, one short line each, an icon per row;
   - a timeline ribbon across the top of the board: the whole film's length, beats as blocks, cuts as ticks, SFX
     hits as dots, the music's sections, so the rhythm is visible at a glance;
   - the palette strip (the ramps, with their roles) and the type system in the board's header;
   - frames are settled moments (never mid-transition), and the board itself is designed, not a dump.
2. Watch it at normal speed, then at 0.25×, checking for dead stops, lockstep groups and settles that are too fast.
3. **Leap check:** put each shot next to the reference. If ours isn't clearly better (depth, detail, timing, sound), it isn't done.
4. Run the full checklist in `references/checklist.md`: honesty, overflow, safe areas, banned effects, variety, loudness and ffprobe output.
5. Render the master at 60 fps (CRF ≤ 16), then loudnorm. Export every requested format.
   **Live-preview deliverables** (no MP4 asked for) skip step 5. Instead: sweep `frame(t)` over the whole runtime at
   15–30 fps catching exceptions, render the same t twice and compare pixels (determinism), play it end to end with
   SFX on, read the console, and **check every transition at 3–6 sub-steps** (most bugs live in the first 0.3 s of an entry).

## The quality ratchet and taste (learned 2026-10-16)
- **Every new film must score strictly higher than the best film so far, with both sheets scored in the same judge round**, judged blind from stills by a fresh subagent on a fixed rubric (typography, composition, craft, fidelity, premium). Below the bar it does not ship: apply the judge's fixes and re-score. Process and scoreboard: `references/ratchet.md`. Never skip it to go faster.
- Read `references/taste.md` before choosing fonts or composing panels: what the owner and the judge rejected (full Fraktur, flat gold, small props in empty panels) and what passed.

## Keep improving this skill

**Use this skill on every video job (generate, edit, clone, review); it is meant to grow.** After every reference or review: log what the owner preferred in `references/lessons.md`, fold new grammar into the right reference file (talking heads: `references/talking-head.md`; product launch films: `references/launch.md`; camera by moment: `references/camera.md`), bump `VERSION` and add a `CHANGELOG.md` line. Never let a session end with a lesson only in its own notes.

When a review note teaches something new (for example "UI comes in too fast"), add it to `references/lessons.md` with the date, the symptom, the cause, the fix and a measured number if there is one. Bump `VERSION` and add a line to `CHANGELOG.md`.

## 11. Default to the cinematic version (learned 2026-10-07)
- Default to ONE continuous camera take in a real 3D world (or 2.5D with real depth) over a sequence of flat slides.
- Default to a voiceover (word-synced) unless the owner says text-only.
- Every beat needs a physical idea (strings, liquid, glass, gravity, light) and a camera move with a ramp. If a frame
  could be a PowerPoint slide, it is not done.
- Reuse the reference's strongest set-pieces when told to (e.g. a pull-out pill wall), then push them further.
- Exception: a **talking-head rebuild** keeps the reference's edit grammar (speaker, split panels, poster, cards);
  the cinematic push goes into each insert (§12), not into replacing the speaker with a one-take.

## 12. Talking-head and voice-led edits (learned 2026-10-16)
The full playbook is `references/talking-head.md`; **the method that decides what goes in each frame is `references/edit-fundamentals.md` (read it first: brand world from the brand, two worlds, devices chosen by sentence meaning, one caption system, build as a spec, never a one-off).** The short version:
- **The voice is the grid.** Clean the Whisper stamps (monotonic starts, real ends), look words up by normalised text
  and an `after` time, cut slightly before a word, slam exactly on it.
- **Layouts as data:** `full` / `split` (graphic panel top half, captions on the seam) / `poster` / `card`.
- **Camera:** a new framing on every jump cut that lands ~3.5% big and settles; 6–8% log punch on each big word;
  an accelerating push into a world change; one continuous push through the CTA.
- **Captions:** ≤ 3 words / ≤ 14 chars, words arrive on their own stamps and the line re-flows; hidden during big words.
- **Big words:** low / top-behind-the-head / left number / stack / CTA, all landing in log space with a smear and a hit.
  Behind-the-head needs a person matte; ask for it (rule 0.1).
- **Every panel acts out its sentence** (icons pop on their words, a stopwatch sweeps, notes write themselves, an
  acronym's letters press like keys, "instead of X" strikes X, a label travels with the metaphor, numbers roll).
- **Chapter cards come from the poster:** card n dives into object n of the hero poster and lights it; vary the entry
  (flash / rack / whip / dive).
- **Under an incoming panel, keep drawing the outgoing shot.** A wipe or dissolve over nothing reveals black.
