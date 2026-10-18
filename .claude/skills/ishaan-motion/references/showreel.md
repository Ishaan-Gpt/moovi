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

## The script arc (Ishaan, 2026-10-18: "hook -> problem -> solution -> .. -> cta")
Every Showreel script, in every theme, follows this arc. The theme's voice is the tone on top; it never changes the
arc. The writer labels each line with its slot, in this order:
- hook (1 line, 3-9 words): stops the scroll in the viewer's own words: a surprise, a sharp pain or an open question
  the film answers. Never a definition, never "Have you ever", never the topic's name alone.
- problem (1-2 lines): what goes wrong or what is at stake, concrete and felt.
- solution (2-3 lines): the answer, and how it works, one concrete picture a line.
- climax (1 line): the peak, the sharpest and most quotable line of the film.
- cta (1 line, 3-9 words): read aloud. What to do next: with a brand, the action and its name; with a topic, a line
  that makes the viewer act (try it, look for it, follow for the next one). With no brand or link given, the cta
  names no site, shop, studio or address: none exists, so any name is invented.

## Writing laws (every theme)
- Humanized and spoken: how a person talks, contractions, "you", rhythm that varies (a short line after a long one).
  Nothing that reads AI-made or like a press release. Easy to grasp on one listen; watched to the end.
- Plain, specific, concrete nouns the viewer could point at. Sentence case. 3 to 12 words a line.
- No hype words (revolutionary, seamless, unleash, supercharge, next-gen, game-changer), no exclamation marks, no
  emoji, no "in this video".
- Never invent a number, a name, a website or a claim the brief or site does not give (the problem too: a real problem, not a made-up disaster).

Every theme below holds TODAY's values (moved from the old styles' voices on 2026-10-18). They are references to beat,
not defaults Ishaan chose: each changes only with his verdict on a film (decision 15 and 16).

## Theme: night-stage
- renderer: darkvox
- name: Night stage
- use when: a story, a fable, a turn of fortune, a mood piece, people and places, history, anything told as a tale.
- lines: 6-9
- voice: A deep, calm, cinematic voice telling a fable at night on a paper stage. Short declarative sentences of 3 to 10 words. Every line names one concrete thing you could cut out of paper and hold (a ticket, a clock, a letter, a lamp, a door), never only an abstraction. The climax lands like a moral.

## Theme: editorial
- renderer: s4
- name: Editorial
- use when: an idea, an essay, a craft, a brand's philosophy, culture, a calm argument with one coined term.
- lines: 6-9
- voice: Calm authority, a magazine voice about the subject's world and its craft. Every line carries a concrete, picturable noun (an object, a material, a place, a hand). Coin ONE two-word term borrowed from another field (like "crop rotation" or "slow ledger") for the idea, and say it in its own short line. The climax is quotable on its own. No lists of features, no question as the opener.

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
