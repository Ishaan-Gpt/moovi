# Reference = the WHY, never the WHAT (Ishaan, 2026-10-20)

Ishaan's correction, said repeatedly: every reference was broken into its elements (sfx, captions, transitions,
colours) and re-used as a template. That is the what. He wants the **why**: the thought process and taste behind how
the reference was built, so the principle works on any new subject and two films never look alike.

## First, the essence in one line (Ishaan, 2026-11-03)
Before any why card or plan, write what the reference IS for its viewer in one line: what they came for, and what is on screen
while they get it. Every plan beat is checked against that line. Mr omi's "How to Make Viral Animated Shorts Using Claude" is
"a famous channel's viral clips shown as the target, then the same kind of film made with Claude beside them, and how". A plan
that swapped in our own invented story (a stickman game show) kept the numbers and the tips but lost the essence: Ishaan, "u
are getting the essence wrong in itself". **A how-to film's subject is the genre the viewer wants to make**, shown through the
genre's famous channels' own clips (short credited excerpts, with their real view counts), and our film made in that genre beside
them. Why-not-what still holds for OUR film (own premise, own look), but the references themselves are on screen.

## A YouTube long form is for a stranger, and its demo must win (Ishaan, 2026-11-03)
- **The demo beats the hits.** When a how-to shows its own result beside famous ones, its result must be visibly better (or at least equal):
  a weaker demo tells the viewer the method does not work. Raise the demo first; never compare down.
- **It is a video, not a report.** Moving picture most of the time (the result playing, the process in motion, the hits), on-screen text a small
  minority (a prompt shown once, briefly, then the picture). A film that is mostly text windows or files reads as an email to the owner.
- **The retention graph, built on purpose:** (1) the reveal first, showing the payoff in the first seconds; (2) the problem the viewer has;
  (3) structured steps, each ending on a visible result; (4) a reason to stay to the end, promised early and paid last. Study the newest
  breakouts in the exact niche (the last days, views over subscribers) from the videos themselves before writing a word.

## The why of a how-to is the viewer's utility (Ishaan, 2026-11-03, "very bad")
Ask why the viewer clicked. For "how to make X with Claude" the answer is "so I can make X myself". Every section is then one step the
viewer can do, in order: the exact prompt or command (shown big and long enough to pause and copy), what Claude gives back (the real
output), and the result it leads to. The maker's story (the fall, the scores, the corrections) only seasons the steps; when it becomes the
spine the viewer learns nothing ("even if they watch, they would not get any utility out of it"). Before building, write the steps the viewer
will be able to do after watching; if the list is short or vague, the film is not a how-to yet.

## Then, the form at the shot level (Ishaan, 2026-11-03, 0/10)
The essence line is not enough on its own: list what is ON SCREEN in the reference every 2 s, from its own frames (a sheet at 0.5 fps),
and name the kind of picture (real screen, real footage, designed graphic, character animation). Our film uses the same KIND of picture.
Mr omi's how-to is a screen recording of the real work in almost every frame: the real channel page and its counts, the real folder of
downloads, his real prompts in Claude Code (the blunt "it looks like a cheap copy" one included), the rulebook file scrolled with the spoken
line highlighted, real code, real waveforms, frame grids and graphs, the reference Shorts playing large beside his own, and a new picture
on almost every 2 s sample. I kept his principles and replaced that picture with designed cards and bar charts on a dark grid: "shitty af
explainer, 0 retention". Rule: a how-to or build-in-public film shows the real work (real pages, prompts, files, outputs, footage), zoomed
and panned to the line being said; designed graphics only where the reference uses them.

## What a reference must yield (the "why card", one page, written in words)
For every reference, answer in plain sentences, each with the timestamp(s) it is seen at:
1. **Intent**: what is the viewer meant to feel or understand at second 0, 3, mid, end? Why does it hold attention?
2. **Beat logic**: why does each cut land where it does? (on a word, on a beat, on a change of idea?) State the rule, e.g.
   "cut when the idea changes, never when the sentence ends."
3. **Choice logic**: why this element here (a slam on this word, a zoom on that face, silence before the drop)?
   What would have been the obvious choice, and why was it rejected?
4. **Hierarchy**: what is the one thing the eye is on in each shot, and what was removed to make that true?
5. **Restraint**: what does the reference NOT do? (the taste is mostly what is left out)
6. **Transferable rule**: each finding is written as a rule with a condition ("when X, do Y because Z"), never as an asset.
7. **Variation test**: apply the rule to a different subject in one sentence. If the result looks like the reference,
   it is still a template; rewrite the rule until it does not.
Assets (sfx names, hexes, font names, transition names) may be listed as *evidence* only, never as the output.

## Where the why goes
Rules go to the craft graph as `(:Principle {when, do, because})` linked to the `(:Reference)` they came from, with
`SERVES` need edges. The writer picks principles by the brief's need, then improvises the elements. A film cast from
principles must differ from the reference.

## Speed budget (Ishaan, 2026-10-20): reference to why card in 2-3 minutes, a film in 2-3 minutes
Target throughput: 10-15 minutes of finished video every day, for automated social channels.
- Work in **shots, not frames**. Cut detection gives shots; take 1-3 keyframes per shot plus the word timings. Never
  read every frame (the old 2 fps dump is for human side-by-side checks only).
- One batched vision call per reference over a contact sheet + transcript + cut times, returning the why card as JSON.
  Run reference analysis in parallel, off the film's critical path, ahead of time (a nightly intake queue).
- A film is **composed from principles + a shot list**, rendered by the fast engine, never hand-cloned per reference.
  Hand-cloning a reference is a one-off research task, not the production path.
- Long form (10-15 min) is made as scenes rendered in parallel (one per ~15-30 s) and stitched; time scales with the
  slowest scene, not the total length.
- Measure every stage (seconds per film second) and write it down; claims are measured, not assumed.

## The premise is WHAT too (Ishaan, 2026-10-23: "it is a copied idea.. I wanted you to copy the why and not the what")
I cloned Ifology's WHY (gag first, labelled rules, numbers on screen, the turn, two questions) correctly, then picked a premise
from inside Ifology's own formula: "What IF You Lived One Second in the Future?" is a personal superpower, exactly their 12-of-12
"What IF You Could X" shape. The premise, the title formula and the kind of topic are the WHAT. Rules:
1. Before writing a script, name the reference's premise formula in one line (Ifology: "you get one superpower") and reject any idea
   that fits it, even with a new power.
2. Generate at least 10 premises from a DIFFERENT source of wonder (the world changes, not you; an everyday system breaks; a
   scale/time/number flip; a hidden fact about the viewer's day) and pick from #4-#10 (ideation.md), after a quick search that
   nobody has made it.
3. Keep the structural why (cold-open gag, a rule of the world, setup/payoff, numbers, turn, two questions); change everything a
   viewer would recognise: premise shape, title formula, hero's situation, set pieces.
