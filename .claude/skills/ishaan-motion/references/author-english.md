# Author's English, not AI English (Ishaan, 2026-10-22, on coat film 2 "You Wake Up in Pompeii")

> **Now a skill of its own: `~/.claude/skills/author-english/SKILL.md`** (Ishaan, 2026-10-25). Load it before any script; this file keeps the history.

Ishaan: the story and the storytelling were good, but "the English still feels AI". He names three levels, each clearer
and more interesting than the last: **AI English → human English → author's English**. Every narration script (films,
reels, launch copy, titles, descriptions) is written at the author level.

## Why the Pompeii draft read as AI English (the tells, with the lines that showed them)
1. **Signposting the structure aloud** instead of playing it: "So here's what that mountain is about to do." "Here's the
   part that's real." "Remember that." "You'll find out why." The narrator announces beats; an author just plays them.
2. **The negation reveal on repeat** ("It's not X. It's Y."): "It's not the lava." "Not fire from the sky. A hot cloud you
   cannot outrun." "You don't say flashlight. You say sign." Once is a device; three times is a model's habit.
3. **Tidy triplets and anaphora**: "They can't see the road. They can't see the gate. They can't see each other." "Not for
   a stranger. Not for a coat." Too symmetrical to be spoken by a person.
4. **Explaining the joke or the moral**: "In their language, that is a miracle. And people follow miracles." "That's a
   terrible number." The viewer already got it.
5. **Stock similes and generic abstractions**: "faster than any horse", "the worst part", "exactly what's coming".
6. **One rhythm everywhere**: short fragment, short fragment, punchline. Every line lands with the same thud.
7. **Recycled formulas across films** without a twist ("You can fix this. Probably."). A callback must be chosen and
   changed, never pasted.

## What author's English does instead
- **A narrator with a point of view**: dry, a little wry, on your side; notices things only this narrator would notice
  ("Warm water up to your second button").
- **Concrete over abstract**: the object, the verb, the number ("a borrowed pair of sandals two sizes too big").
- **Trust the viewer**: no announcing, no explaining the gag, no moral after the image.
- **Rhythm that varies on purpose**: a long rolling sentence, then a short one; fragments only where they hit.
- **Images that belong to the world**, not stock ones ("like the pine trees in every garden in town").
- **Jokes from character and situation** (the wet wool coat that weighs as much as a goat), not from sentence structure.
- **Fresh callbacks**: a series line ("It's later than you think") can return, but placed so it means something new.

## How to apply (checklist before any voice is synthesized)
- Search the draft for: "here's", "remember", "you'll find out", "It's not", "Not ... Not ...", three parallel sentences,
  "that's a/the [adjective] [noun]", "faster than", "exactly". Rewrite every hit unless it earns its place.
- Read it aloud in your head as a specific person: if it sounds like a template, rewrite.
- Keep facts exact; voice changes never change a number or a claim.
- In code films, a rewrite must keep the words the shots and cues are keyed to (wordT anchors): list them per line first,
  then rewrite around them. Include per-shot wrapper helpers (e.g. `const W9 = (w, n) => wordT(w, 9, n)`; film 1's shot I
  used one and broke on load after the rewrite), then open every shot page once and confirm `__ready` before rendering.

## Plain, easy English first (Ishaan, 2026-10-25, on "How to Never Finish Anything" draft 1)
Ishaan: the script "still looks AI generated, a little abrupt, and less easy and clear to understand. Use very easy language so users
can easily understand everything happening." Author's English is never clever English: a viewer half-watching on a phone must follow
every beat on the first listen.
- **Everyday words, short sentences.** "Putting things off", not "procrastination is mood repair"; "a scientist noticed", not a citation.
- **A visible spine** the viewer can hold (days of the week, steps, a countdown), named out loud at each turn so nothing feels abrupt.
- **Every beat in the same easy order:** what he does, why (one plain sentence), the real finding (one plain sentence), a small joke.
- **Joins between beats** ("On Wednesday he means to...", "Then...", "So...") instead of hard jumps; no fragment piles.
- **Re-read this file before writing any script** (draft 1 was written from memory of it, and it showed).
