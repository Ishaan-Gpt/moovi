# Showreel branch

Showreel is one of the three presets (Edit, Launch video, Showreel). It takes a topic, a brief or a link and makes a
theme-locked film. The product's Showreel writer (`packages/engine/src/showreel`) reads THIS FILE at runtime (decision
18): the themes below, each theme's voice and the writing laws are what the writer is told. Edit this file and the
product changes on the next deploy.

## The lock
- One theme per film, chosen once (named by the user, else picked by the writer from the brief). Every beat is drawn
  in that theme's world: its stage, palette, type, props and sound. A film never mixes looks that break the theme.
- The writer chooses only words and ids from menus. Code builds the film, casting per beat from the theme's own set-up
  library and the craft graph (sfx by event, inserts, grades), tailored to what each line says. Never a fixed set.
- Two films on one topic must differ (the theme's memory casts away from its recent films).

## Writing laws (every theme)
- Plain, specific, concrete nouns the viewer could point at. Sentence case. 3 to 12 words a line.
- No hype words (revolutionary, seamless, unleash, supercharge, next-gen, game-changer), no exclamation marks, no
  emoji, no "in this video", no "click", no "sign up", never a call to action read aloud (the end card carries it).
- Never invent a number, a name or a claim the brief or site does not give.
- One turn in the middle; the last line lands on its own.

Every theme below holds TODAY's values (moved from the old styles' voices on 2026-10-18). They are references to beat,
not defaults Ishaan chose: each changes only with his verdict on a film (decision 15 and 16).

## Theme: night-stage
- renderer: darkvox
- name: Night stage
- use when: a story, a fable, a turn of fortune, a mood piece, people and places, history, anything told as a tale.
- lines: 6-9
- voice: A deep, calm, cinematic voice telling a fable at night on a paper stage. Short declarative sentences of 3 to 10 words. Every line names one concrete thing you could cut out of paper and hold (a ticket, a clock, a letter, a lamp, a door), never only an abstraction. A turn in the middle. The last line lands like a moral.

## Theme: editorial
- renderer: s4
- name: Editorial
- use when: an idea, an essay, a craft, a brand's philosophy, culture, a calm argument with one coined term.
- lines: 7-10
- voice: Calm authority, a magazine voice about the subject's world and its craft. Every line carries a concrete, picturable noun (an object, a material, a place, a hand). Coin ONE two-word term borrowed from another field (like "crop rotation" or "slow ledger") for the idea, and say it in its own short line. The essay turns once. The last line is quotable on its own. No lists of features, no question as the opener.

## Theme: blueprint
- renderer: anatomy
- name: Blueprint
- use when: how something works, a machine, a system, a product's insides, a process, science, a step-by-step.
- lines: 6-9
- voice: Calm, precise and technical, like an engineer narrating a cutaway drawing. Name the real components and say what each one does, in the order things move through them. Short declarative sentences built on concrete nouns the viewer could point at. No rhetorical flourishes.

## Theme: real-footage
- renderer: clip-moment
- name: Real footage
- use when: news, places, nature, sport, travel, food, cities, events, facts and numbers about the real world.
- lines: 6-9
- voice: A clear, confident documentary voice. Every line names something a camera could film (a street, a hand, a harbour, a crowd), so a real clip can stand under it. Numbers only when the brief gives them. Short lines, one picture each.
