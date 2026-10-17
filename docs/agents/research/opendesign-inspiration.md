# OpenDesign: how it works, and what Moovi can take

Owner: Claude 1 · 2026-10-17. Ishaan will implement later; this is the reference. Source: the full teardown
(`docs/archive/research/R11-open-design.md` and `open-design-notes/` there, from OpenDesign's Apache-2.0 code read file by file, plus the live site).

## What OpenDesign is

An **open-source design-agent workspace** ("open-source Claude Design"). It makes websites, slides, posters and
**videos**; video is one output, not the product. A coding model (Claude Code, Codex or your own key) writes the
design; their server renders and checks it.

## How it makes a video, step by step

1. **The prompt is built in fixed layers.** House rules → the design system (colour tokens pasted verbatim) → the task's
   playbook → your memory last. On a conflict: your message > design system > memory > house rules. Catalogues go in as
   a shortlist plus an index, never whole.
2. **It infers the task type** (website promo, SaaS promo, sizzle…) and asks only when two readings give really
   different results, with its own guess preselected.
3. **It picks the look, then says it in one sentence:** from your design system, your measured brand, or a **closed
   library of 5 directions**. It never invents colours.
4. **Direction before motion:** a **premise**, **one motif**, and a **beat map in seconds** (per beat: the takeaway, the
   focal object, how it changes, the copy, the exit). Beat maps are fixed per type: a 30 s SaaS promo is 4 beats of
   ~7 s with the CTA at 25.5 s; the hook lands by 2–2.5 s; the end card is 15–25 % of the film.
5. **The film is one HTML file (HyperFrames):** clips with start and duration tags, **one paused GSAP timeline as the
   only clock**, entrances only (transitions do the exits).
6. **Taste as numbers and bans:** accents 120–220 ms, arrivals 350–650 ms, big moves 900–1800 ms; one main transition
   for 60–70 % of cuts; frame-fill rules; a banned-pattern list; "grammar cards" with measured numbers (a pulse camera
   that punches 0.28 s then holds still; paper stepped at 12 fps, "on twos").
7. **Render:** hidden Chromium seeks the clock frame by frame (seek → wait for media and two frames → screenshot),
   FFmpeg encodes and mixes audio separately.
8. **Check, code first:** an anti-slop linter (P0/P1 fed back to the model), contrast measured on rendered pixels, an
   animation map for dead zones and collisions. Then **one** review of **at most 3 frames**, **at most 1** fix; if it's
   still wrong, report it. The preview ships first; review never blocks. **Code computes the score**, not the model.
   They **retired** their five-persona AI jury (expensive, not independent).
9. **Brand measured, not guessed:** colours scored from the site's CSS and computed styles (no model; theme colour and
   logo weigh most), turned into a binding contract, linted after render.
10. **Memory as checkable rules:** feedback becomes `Assertion / Check / Verified by`; code scores every rule pass/fail
    each run. One-offs stay one-offs; you approve each rule.
11. **Changes and growth:** comments pinned on the preview become structured edits; three next-step suggestions after
    each delivery; a landing with real outputs, live counters and full SEO.

## Same as Moovi

- Every frame drawn by code in a browser, then frames to MP4. Their clock-driven HTML ≈ our live players and edit player.
- Deterministic craft, not generated footage.
- Memory of user feedback (theirs as rules, ours in FalkorDB).
- A library of reusable parts (their design systems and grammar cards; our graph library and kits).

## Different

| | OpenDesign | Moovi |
|---|---|---|
| Product | General design agent; video is one output | Video only: generate, and edit your own clip |
| Who writes the film | A strong coding model writes raw animation code each time | Code builds the film from data (styles, set-ups, the EDL); the model fills slots and picks from lists |
| Your own footage | No | Core: transcription, cuts, face tracking, captions |
| Library | Prose skills and design systems in files | A queryable graph (FalkorDB), ~950 parts with "serves" and "suits" links |
| Timing | By role | On spoken words |

## Where Moovi is better

- **Any model, including small free ones** (slots and closed lists; same film on Groq's free tier). They need
  Claude Code or Codex class models.
- **Faster:** parallel capture and in-browser H.264 vs their single sequential screenshot loop; our previews play live
  with nothing rendered.
- **Edits real footage.**
- **Motion lands on the words.**
- **An independent judge** (the blind-judge ratchet), the thing they gave up on.
- **The graph** as the brain's memory: parts, licences, styles, references, all queryable.
- **Landing motion** (scroll film, live 3D Moovi).

## Where OpenDesign is better

- **It checks its own work on the default path.** Ours doesn't (the review step is uncommitted; Lens runs only on the
  crew path).
- **Taste written as numbers and bans, enforced by code in every run.** Ours lives in the `ishaan-motion` skill and the
  clones, which users' videos don't use.
- **Direction chosen from a library and stated in one line.** Ours: keyword regexes, reason only in the console log.
- **Brand measured from CSS.** Our Auto film asks the model for "one hex colour that suits the topic".
- **Checkable memory**, pass/fail per rule. Ours is free text, and Auto ignores memory.
- **Iteration:** pinned comments → edits, next-step suggestions. Our live versions have no Download or "Tweak in
  chat", and chat edits work only on the crew path.
- **Findability:** SEO, OG image, sitemap, `llms.txt`. Our landing's `metadataBase` is still `https://moovi.example`,
  with no robots file, sitemap or OG image.

## What to take

Films:
1. **Bounded check-then-fix on every video:** code lints, then ≤ 3 frames to a model, ≤ 1 fix, ship the best, never
   block the preview. (Started: `engine/src/review/`, uncommitted.)
2. **Direction from the library, stated in one line** ("Dark Vox, a founder's story, the motif is a paper boat"),
   replacing regex routing.
3. **Beat maps as lints:** hook by 2–2.5 s, end card 15–25 %, one idea per beat.
4. **One transition grammar per style:** one main transition for 60–70 % of cuts plus 1–2 accents.
5. **Frame-fill law** for Anatomy: 3 layers, 2 focal points, 2–5 background decorations.
6. **Pulse camera and "on twos"** for the paper styles. It contradicts `ishaan-motion` law 3 ("the camera is never
   still"), so A/B it with the blind judge first.
7. **Brand measured from the URL** into a `(:Brand)` node, used as a contract.
8. **One clock for every preview**, so any live preview renders to MP4 with no second code path.
9. **Memory as checkable rules**, read on the Auto path too.

Website: SEO basics; paint the page at once instead of behind the intro (up to 8 s today); real Moovi films in the hero.

Don't take: the self-judging AI jury (they retired it), their stub catalogue of generation and music skills, role-timed
choreography (word-timed is better).
