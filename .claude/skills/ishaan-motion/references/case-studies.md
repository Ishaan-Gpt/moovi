# Case studies

## CaptionsEasy launch film (Remotion, 1920×1080, 60 fps, 40 s, 2400 frames)
Music: "Inspired" (Kevin MacLeod, CC-BY), 120.19 BPM, cut on bars so the climax hits beat 8 and the real final chord hits beat 72.

| # | beats | time | shot | key move |
|---|---|---|---|---|
| 1 | 0–8 | 0:00 | Logo bars pulse like a voice, morph into caption chips on a timeline; playhead scrubs. "Still timing captions *by hand?*" | bars → chips morph, ramp-in exit with motion blur |
| 2 | 8–16 | 0:04 | The drop. Ink. "Stop / timing / captions." one word per beat; "*Start posting.*" in emerald; cream iris swallows frame | slams on beats 8, 9, 10 |
| 3 | 16–22.5 | 0:08 | Logo reveal: bars rise, slide left, wordmark slides out from behind them | lockup ends at the exact size/place of the site nav logo |
| 4 | 22.5–34 | 0:11 | Match cut: camera pulls out 12.8× into the real site; cursor clicks the real CTA; dive into hero card | log-space zoom with AE speed ramps |
| 5 | 34–46 | 0:17 | Coverflow of 10 real captioned clips, advancing on beats, look name under centre card | whip pan out |
| 6 | 46–56 | 0:23 | "From camera roll to *captioned* in four moves": odometer 01→04 + product card from real labels | whip pan in, a step every ~2.25 beats |
| 7 | 56–64 | 0:28 | Ink colour event: tilted 3D wall of all 33 real look previews; "33 looks. *One click.*"; dive into a tile | tile → full-frame match |
| 8 | 64–72 | 0:32 | One fact per beat: Free. / Open source. / No install. / No watermark. / MP4 + SRT. / In your *browser.* | vertical roll with motion blur |
| 9 | 72–80 | 0:36 | On the last chord: lockup on deep green, tagline, URL pill, credits | bars spring, wordmark rises in a mask |

What made it work: real assets only, a beat grid fixed before any shot was built, transitions motivated by objects, springs + speed ramps +
velocity motion blur, banned effects held, every fact checked.

## R1 talking-head explainer (canvas preview, 1080×1920, 88.6 s, 2026-10-16)
Reference: a crimson-poster "5 memory secrets" Reel (speaker + top-half panels + poster + chapter cards, 27 scene
changes). Rebuilt twice from the same timing: once without this skill, once with it (Moovi library worktree,
`data/refs/r1/clone` vs `clone-motion`, local only). The voice's word stamps were the grid. What the skill added: AE ramps and
springs instead of generic eases, log-space slams and pulls, a camera that reframes and settles on every jump cut and
punches on big words, word-by-word captions that re-flow, verb-acting panels, chapter cards that dive into their own key
on the hero ring, varied transitions with no black reveals, sparse SFX with a keystroke per typed word. What it lacked
(added in v1.3.0): a talking-head grammar, the voice-as-grid rule, an unattended-mode asset rule, a live-preview finish,
a canvas port of the helpers.

## Bloom-reel (showreel backtrack → MotionEasy kit, CaptionsEasy 9:16, 60 s, 19 clips, 125 BPM)
Backtracked from a 74 s designer showreel (~128 BPM, cuts on bars, −14.2 LUFS). Split into tiers: ~45% code-native,
~30% asset + code, ~25% character animation (replaced by honest code-native flat scenes on the owner's props).
The craft that was kept: a metal + script bookend, one bloom per dark shot, light/dark alternation, pixel-block dissolves,
white flash on motion, morphs, 3–6% camera drift on every shot.

## MotionEasy (the reusable engine)
58 components + 13 transitions as pure render functions of (t, props) on canvas; a post is a JSON spec of clips.
Stills → render → audit. Reuse components freely, but never the same recipe twice in a row.

## Research-story-reel (ULTIMATE REFERENCE, 2026-10-07)
Full breakdown: MotionEasy repo `docs/reference/research-story-reel.md` (video: `sources/references/research-story-reel/source.mp4`).
123 s, 16:9, 30 fps, −14.1 LUFS with LRA 1.9 (an even bed), ≈ 99–100 BPM, only 7 hard cuts: a near one-take where type and
objects carry every transition. The opening 9 s are one sentence built word by word, each phrase visualising its verb,
then a gear change into a dark "system" world at about one idea per second. Target for CaptionsEasy: match it, then go a leap beyond.
