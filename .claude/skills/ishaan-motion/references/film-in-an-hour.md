# A 60-90 s code-made channel film in one hour (Ishaan's target, 2026-10-21)

**Speed gate (2026-11-02):** the measured plan, the budget table and the gate tools are in the Moovi repo, `docs/agents/speed/`
(PLAN.md, PREFLIGHT.md, preflight.mjs, tlog.mjs). Run `preflight.mjs check <film>` before building and before exporting; it fails
early on unread new rules, no estimate, no locked look/kit, no voice timing, no contract, low disk or RAM, or a GPU leased to
another film. On this PC (integrated AMD GPU, no NVENC) 3D renders at 6-23 s per film second, so the export is the
expensive step and happens ONCE, at the end, after Ishaan has watched the live preview and said export (1.17.76); the master stays on x264.
Every check and every blind judge uses `grab.mjs` sheets of frames seeked from the live page, never an MP4. The one export uses `export.mjs`
(every chunk starts with a 1 s pre-roll so a split never pops). Cast every beat from the kit's proven actions: the first real
one-hour run (47 min wall, 2026-11-03) plateaued at 5/10 because its beats needed new actions (a run on the spot, a hand to the face,
a fly); new actions are a kit day, and a replay always carries a visible marker.

Ishaan, after the AirPods film (channel film 1): "this took too much time; the next video takes one hour max". Film 1
took 2 h 06 min to v1, then about 2.5 h more of fixes (captions, sound, label, palette, reframing every shot for the
captions). Every fix after v1 was a rule known in advance or a choice that could be made before building. This file is
the order that gets it right the first time. Read it, then the newest rules in showreel-youtube-automation.md.

## Why the captions failed, and why they work now (absorb this)
1. **v1 failed** because legibility was given to the caption (a soft dark plate behind light type), not to the frame.
   The plate read as a black smear, and the font pair (Schibsted + Newsreader italic) read as generic.
2. **The plate-free fix failed first** (spoken words 1.3:1) because the shots put skin and the white stem exactly where
   the captions sit. A caption without a plate only works on a frame designed for it.
3. **It works now** (median 9.7:1 spoken, 78/82 card moments pass, the rest only mid-entrance) because every shot keeps
   the caption band (58-78% of height) free of the hero and of text, and deep in the world's own darkest tone (band
   mean luma 20-40/255, textured stone, never flat black), and the type does the rest: the spoken word bright and
   bold, the said words neutral grey at a lighter weight (just over 3:1), a variable font so weight moves, one elastic
   key word whose gesture comes from the subject (an earbud: light bounces, so the word bounces), one fixed position.
4. **So the caption is designed in the CONTRACT, not after the shots.** The band rule goes to every shot builder on
   minute one. The caption system (font, spoken/grey levels, key gesture) is chosen before the shots, from the why
   card, not from the last film.

5. **Cards are 1-4 words on one line** (battery film, 2026-10-21): the why measured it; a ">= 1.0 s per card" floor at a fast voice made 8-12 word, 3-line cards, and the key word's bounce left its line. The caption builder copies the why's numbers, not the last film's floors, and checks full-res crops by eye before the preview.

## The order (budget 60 min wall; about 4 builders at once on this account)
| Min | Step | Who |
|---|---|---|
| 0-5 | Topic from the channel list; facts checked at the source; script (paradox opener, answer early, a test the viewer does, CTA); hook inside 2 s | lead |
| 5-7 | Voice: ONE voice, one continuous fast read (+25-30%, about 3.5 w/s), 0.05-0.25 s gaps; timing.js | lead |
| 7-15 | **The look kit FIRST**: palette and background texture chosen PER VIDEO for its subject (vibrant, a real material texture, picked from 2-3 rendered options; never carried over as a channel look: Ishaan, 2026-10-22), shared models (hero object, world surfaces: e.g. earbud.js, stone.js), one studio/grade file. Reuse the series kit's MODELS and code (studio, phone, captions, sound engine), never its colour or texture | 1 builder (or reuse) |
| 7-15 | Contract (FORMAT FIRST: long-form = 16:9 1920x1080, Short = 9:16): shot list keyed to words (8-10 shots of 6-9 s, a visible change every 1.2-2 s), with the band rule, no disclaimer labels, no transition used twice in a row, the shared models mandatory | lead |
| 15-40 | Shots: 4 builders, 2 shots each, on the warm GPU capture server (tools/capserver.cjs, 1-2 s a check). Each measures its band and its cut matches before reporting | 4 builders |
| 15-35 | Captions + sound from the series player (reuse; new cue list keyed to words; sound designed per event in the series' sonic families, not stock pops) | 1 builder (or lead) |
| 40-48 | Whole-film check: cut pairs side by side, band luma per second, caption contrast (player.measure), a 12-frame sheet; fixes go back to the shot's owner | lead |
| 48-50 | Live preview link to Ishaan (plays with sound) | lead |
| after yes | Export on the GPU in the page (wcexport.js): about 8 min for 65 s, plus a 720p share copy | lead |

## What wasted time on film 1 (never again)
- **2026-10-26, Ishaan ("you already took 5 hours, why so long?") on the 5-animal long film:** (1) a film with several new heroes builds and checks the MODEL KIT first (each animal alone in a full-resolution close-up at 8/10) before any shot is built on it; models and shots in parallel meant every shot was redone when its model improved. (2) The look is locked from rendered options on the real hero BEFORE builders start; a look change mid-build cost every builder a round. (3) Estimate from scope, not from the last film: count new heroes and shots (one new hero about 1 h of kit work); tell Ishaan the honest time up front and offer a smaller scope. (4) When the clock runs past the estimate, offer a live preview of the whole film as it stands instead of silent rounds.
- 9 builders at once hit the account's usage limit (about 50 min lost): about 4 at once.
- Each builder made its own hero object: a whole unify pass. The shared models come first.
- Taste decided after v1: decide the caption system and sound engine once per series and reuse them; the palette and
  background texture are decided per video (rendered options), never inherited.
- Labels and disclaimers drawn into every shot, then removed: not in the contract.
- Software rendering and cold Chrome per check (Draft C): the warm GPU capture server only.
