# promptsmotion.com: how it works, and what Moovi can take

Owner: Claude 1 · 2026-10-17. Ishaan will implement later. Source: the "Launch video style" session's research
(its notes and `docs/LAUNCH.md` on the uncommitted `ishaan/launch-style` worktree, `moovi-launch`). Note the name:
the site is **promptsmotion.com**, with an "s".

## What it is

**Not a video product and not an engine.** It's a **public gallery of 251 motion films made by Claude**, each shown
with **its full build prompt** and the video. Many are product-launch films. Anyone can browse; the film metadata
(prompts, video URLs, views) is in the page's own public bundle. There are no agents, no pipeline and no renderer behind
it to reverse-engineer. What it gives is **proof of what a model can make with the right prompt**, and the prompts.

## How its films are made (as far as we know)

- A person writes a long, specific **build prompt** and a Claude model writes the motion film from it. The exact
  toolchain per film isn't stated in our notes; the films are code-made motion (UI, type, 3D objects, glass, cursors).
- The quality comes from the **prompt's specificity**: one idea per beat, a named continuous motif, object-born
  transitions, a cursor that drives the product, music-led timing.
- It is **one prompt → one film**, made by hand each time. Nothing is reused or remembered between films.

## What our session took from it

- **47 candidate films** (promptsmotion plus motion.so's public "Made with Motion" launch films) triaged by three blind
  scorers; **12 made the cut** (l01–l12).
- Each was **broken down frame by frame** (beats on the music grid, camera, transitions, type, UI, 3D, effects, grade,
  sound, measured timings) and stored as a `(:Reference)` with `HAS_PART` edges, plus one `(:Kit)` look per reference.
  Parts carry exact numbers (eases, spring stiffness and damping, sizes as fractions of the frame).
- They were rebuilt in our own code as a new generation style, **Launch**: a site (or lines) in, an 18–30 s launch film
  out, cut to music, playing live. 12 learned looks, 10 launch arcs, every beat's set-up, type, camera, transition and
  background **cast from FalkorDB** (`launchParts`), away from recent repeats.
- **Status:** all uncommitted on `ishaan/launch-style` (`src/launch/`, `src/styles/launch.ts`,
  `packages/library/src/kits/launch/`, `data/refs/l01–l12`). Round 1 blind judge: Launch raycast.com 5.50, cal.com
  5.00, resend.com 4.38, against the best reference at 7.88. The judge's systemic flaws: text on text (our headline over
  the site's own), empty frames, tiny UI, headlines caught mid-mask, weak copy, leftover chrome. Round 2 targets those in
  the kit and the brief.

## Same as Moovi

- Code-made motion films, not generated footage.
- Taste comes from specific, measured direction (their prompts; our laws, parts and kits).

## Different

| | promptsmotion | Moovi |
|---|---|---|
| What it is | A gallery of finished films and their prompts | A product that makes films |
| How a film is made | A person hand-writes one long prompt per film | A pipeline: research → direct → cast from the graph → play |
| Reuse | None; every film starts from scratch | Parts, kits and memory in the graph; two films of one site differ |
| Model | Strong Claude models | Any model, including small free ones |
| Speed and cost | A full authoring session per film | Seconds to a live preview |

## Where Moovi is better

- **Repeatable and cheap:** a film per prompt in seconds, on any model, without a person writing a long prompt.
- **Reuse and memory:** what one film teaches becomes graph parts every later film can cast.
- **Variety by design:** looks, arcs and casting move away from recent films.

## Where promptsmotion is better

- **The bar.** Its best films (judged 7.88 and 7.25 in our blind round) are clearly above anything Moovi ships today,
  including Launch (5.50 at best) and R3 (4.63 in the same round).
- **Copy:** the best prompts carry sharp, grammatical, specific lines. Ours had "Never wasting time again?".
- **Continuity:** the best films are one continuous take, where every scene is made from the last.

## What to take

1. **The reference bar:** keep the 12 learned references as the blind-judge bar for every launch-type film.
2. **The copy doctor:** a stricter brief (grammar, no invented years, one idea per line).
3. **One text layer per frame:** scrim or blur any site shot that sits under a headline.
4. **Minimum sizes:** UI and text never below a set fraction of the frame; no near-empty frames.
5. **Object-born transitions and a continuous motif**, from l01, l02, l06, l09.
6. **Judge only settled frames:** take stills once each beat has settled, never mid-mask.

Don't take: the hand-written-prompt-per-film workflow (it's the opposite of a product), or any of their footage, fonts,
audio, logos or copy (none is in the repo; everything is rebuilt in our code).
