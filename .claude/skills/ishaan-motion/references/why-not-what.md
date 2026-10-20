# Reference = the WHY, never the WHAT (Ishaan, 2026-10-20)

Ishaan's correction, said repeatedly: every reference was broken into its elements (sfx, captions, transitions,
colours) and re-used as a template. That is the what. He wants the **why**: the thought process and taste behind how
the reference was built, so the principle works on any new subject and two films never look alike.

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
