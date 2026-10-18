# Storytelling: theme-built sites that unfold

A premium site is experienced, not read. It has a beginning, a turn and an ending, a protagonist that persists, and one idea per screen. This file is about the *narrative*; the mechanics of pinning, scrubbing and smooth scroll are in `scroll.md`.

## Contents
1. The arc: beats every story site can use
2. The protagonist: continuity is premium
3. Show, don't list: features as scenes
4. Pacing and spaciousness
5. Copy for a story site
6. When there's no character
7. Mobile and reduced motion versions of the story

---

## 1. The arc: beats every story site can use

Pick 5–9 beats; rename them for the brand. Each becomes a chapter (a pinned section 200–350vh tall, or a normal flowing section for dense content).

| Beat | Job | What happens on screen |
|---|---|---|
| **Hook** | who/what, in one image | the protagonist in the world, the one primary action (an input, a button), almost no text |
| **Hello** | make it personal | the camera moves in; the protagonist introduces itself in two lines |
| **Tension** | the problem, felt | the ordinary way shown honestly: a competitor's dull output, a rushed industrial process, a frustration the audience knows; the protagonist reacts |
| **Turn** | the product's idea | one big statement; the protagonist does the thing only this product does |
| **Proof by doing** | understanding | an interactive or scrubbed demo with the real UI; the visitor *does* the core action |
| **Depth** | how it works | steps passed between parts, a graph, a mechanism; still visual |
| **Range** | what it offers | the protagonist transforms into each output, product, flavour, plan or place |
| **Trust** | honest proof | real numbers, real methods, a technical "under the hood" for the curious, in flowing layout |
| **Invitation + goodbye** | action | CTA inside the final scene; the protagonist (and its crew) waves; the footer is the closing frame |

The table leans toward products that *do* something. Re-read each beat for the brand in front of you:

| Beat | Software / AI | Physical goods (food, fashion, objects) | Place / service (hotel, studio, clinic) | Editorial / portfolio |
|---|---|---|---|---|
| Tension | the generic tool fails | the mass-made version, rushed | the impersonal alternative | the noise this work cuts through |
| Turn | what only this product does | the process, the moment of craft | the feeling of arriving | the point of view |
| Proof by doing | try the real UI | pick, configure, compare, see it change | walk through, choose a room/time | browse the work itself |
| Range | output formats | the collection | rooms, menus, services | projects |
| Trust | methods, under the hood | origin, maker, materials, shipping | people, location, reviews you really have | clients, press you really have |

Rules of the arc:
- **Tension before features.** People care about the solution after they have felt the problem.
- **Every chapter changes the protagonist's state**, so scrolling always pays off with something new.
- **One idea per chapter.** If a chapter needs two headings, it's two chapters.
- The hero keeps the **primary action** (input, sign-up) visible within the first screen; the story is a reward for scrolling, never a toll before the product.

## 2. The protagonist: continuity is premium

The single biggest difference between a story site and a long page is that *something persists*. One canvas or object lives behind/between all sections and is re-staged per chapter, instead of every section bringing its own unrelated visual.

Options, from most to least effort:
- **A character** (a mascot rendered in WebGL/SVG; see `3d.md`): it holds the hero input, reacts to the problem, transforms, splits into its "crew", waves goodbye.
- **A hero object** (the product itself, a device, a bottle, a lens): one 3D or image-sequence object that rotates, explodes into parts, re-assembles.
- **A material** (paper, ink, glass, jelly, light): a sheet that folds into the next section, ink that spreads into a chart.
- **An environment** (time of day, weather, a camera moving through a place): the page colour and art shift chapter by chapter.

Give it states, not just positions: idle, greeting, thinking, pointing, holding, celebrating, transforming. Gestures should match the beat (it waves on "hello", points at the words it's talking about, squints at the bad output), never loop one gesture everywhere.

Text that the protagonist "says" should appear in time with its action (the "Hi" lands as it waves).

## 3. Show, don't list: features as scenes

Replace every grid of feature cards with a scene in which the feature happens:
- "Fast" → a timer race between the old way and this way.
- "Remembers your feedback" → a note is dropped in; the protagonist's memory ring lights the node; next time the output changes.
- "Multiple specialists" → the protagonist splits into a crew; each one gets a name tag that rides on it and a one-line job; the task passes between them.
- "Works in many formats" → the protagonist morphs into each format (a play button, a film frame, a waveform, a screen).
- "Honest" → the real check runs on the page and fails a fake claim.

Where possible use the **real product UI** with sample data (`components.md` → Real UI in marketing).

## 4. Pacing and spaciousness

- **One message per viewport.** A screen with a heading, one line and the protagonist is a full screen. Resist filling it.
- **Alternate density**: a busy, interactive chapter is followed by a quiet one (a single sentence, lots of canvas).
- **Generous space** is the cheapest premium signal: 120–200px between flowing sections on desktop, measure ≤ 60ch, big margins around the protagonist.
- **Let things leave.** Elements exit as the story moves on (fade/rise out, blast apart, merge back); a page where nothing ever leaves feels like a stack, not a story.
- **Chapter length**: 200–350vh for pinned chapters. Shorter feels rushed; longer feels like a scroll-jacking chore. Put the busiest choreography in the middle 60% of the chapter and leave a short hold at each end.
- **A scroll cue** on the first screen only, hidden once the visitor has scrolled a quarter screen.
- Give the reader a sense of position: an active-section indicator in the nav, a progress rail or a timecode.

## 5. Copy for a story site

- Headlines are lines of dialogue or plain statements, ≤ 10 words: "Hi. I'm Moovi." / "He doesn't generate. He directs."
- **Two voices** work well: a small plain lead-in and a big expressive line, *read as one sentence* ("ONE DIRECTOR. / five specialists."). This is not an eyebrow tag: a tag is a category label ("FEATURES", "HOW IT WORKS"); a lead-in is the first half of the sentence. If the small line makes sense alone as a label, delete it.
- No labels above headings, no "AI-powered", no hype verbs. Specific nouns, short sentences.
- Body copy only where the visual can't speak, and then one or two sentences.
- The protagonist has a voice; keep it consistent (warm, dry, confident, playful).
- Sample data in demos is fictional and labelled (`.example` brands).

## 5b. Domain language
Speak in the world's own units and words: fists above the horizon, compass points, Bortle class, timecodes, frames, f-stops, grams, knots. Put real computed values in captions and mockups. It's both more honest and more premium than invented marketing numbers.

## 6. When there's no character

Story structure still applies:
- **Product-object story** (hardware, physical goods): one hero render/image sequence scrubbed by scroll; chapters are angles, exploded views, materials, in-use scenes.
- **Material story** (finance, documents, writing): a sheet of paper that the page folds, stamps, signs and files.
- **Environment story** (travel, wellness, food, sky): the page colour and art move through times of day or seasons; tween a `--page` CSS variable per chapter, or alternate surfaces (night → paper → moon → ember) joined by giant-shape transitions. The real world can be the protagonist: tonight's actual sky over a real place, a city's real weather.
- **Interface story** (dev tools, SaaS): the real UI is the protagonist; the camera zooms into parts of it, and each chapter performs a real task.

## 7. Mobile and reduced motion versions of the story

- **Phones** get the same story re-blocked for portrait: the protagonist moves above or below the copy instead of beside it, lateral distances shrink, chapters may shorten, decorative layers drop. Re-check every chapter at ~390×844.
- **Reduced motion**: show each chapter's key frame (final state) with simple fades, keep all content and interactivity; no scrubbed transforms, no auto-playing loops.
- **No WebGL**: a static or SVG version of the protagonist and any 3D text, so the page still tells the story.
