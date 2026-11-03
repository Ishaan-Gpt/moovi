# Changelog
- 1.17.76 (2026-11-03): ONE export per film, at the very end, only after Ishaan has watched the live preview and says export (Ishaan: "why so many exports.. only one final export must happen at the end when I say ok done previewed now export"). Every check and every blind judge runs on frames seeked from the live page (docs/agents/speed/grab.mjs), never on an MP4; this replaces the 1.17.69-1.17.70 per-scene export (SKILL.md, film-in-an-hour.md, lessons.md).
- 1.17.75 (2026-11-03): Ishaan on the Bhagat Singh Short (5/10): a new character starts from the best rig ever built (list them, beat or match the best blind), never the nearest; a new hero is a kit day at 8/10 in close-ups and in its film actions before any shot; a historical hero keeps his icon; shots are pre-vized as a still contact sheet before animating (lessons.md, checklist.md).
- 1.17.74 (2026-11-03): match the reference's medium. When the reference is 2D that feels 3D (layered silhouettes, light and depth), ours is built the same way in 2D (canvas/SVG layers, parallax, light, depth of field), never real 3D by habit: less render time and a higher ceiling (Ishaan, on the stickman What If genre) (look.md, lessons.md).
- 1.17.73 (2026-11-03): a how-to or tutorial film's spine is the famous channels' own viral clips shown as the target, with ours made beside them; never an invented story of ours (Ishaan: "u dont need turbo or anybody... u are getting the essence wrong"). Before planning from any reference, write its essence in one line (what the viewer comes for and what the reference shows on screen) and check the plan against it (why-not-what.md, lessons.md).
- 1.17.72 (2026-11-03): speed lab, the first real one-hour run (a 48 s stickman short in 47 min wall): it plateaued at 5.0-5.2/10 from two blind judges because its beats needed actions the kit had never shown on screen (running on the spot, a hand to the face, a fly at film size) and a replay with no marker read as a character falling twice. The hour only holds when every beat is cast from the kit's proven actions; a new action is a kit day, proven at 8/10 alone first (lessons.md, film-in-an-hour.md).
- 1.17.71 (2026-11-03): Blender character clips on this PC take the measured fast path: settled-start cloth (30 -> 6 min), skinned undergarments, low render-time subdivision (15-22 s -> 3 s a frame), and one frame timed before any batch (toolbox.md, lessons.md).
- 1.17.70 (2026-11-02): speed lab: films export with docs/agents/speed/export.mjs (re-renders only changed chunks: 267 s full vs 7 s unchanged; GPU lease, resume, gates, timing row) and judge per scene on sheet.mjs contact sheets of the export; every chunk/tab/segment starts with a 1 s pre-roll because the pages keep motion state (a cold split at 63 s on the Gandhi long form jumped the slip: SSIM 0.974 vs 0.991) (lessons.md, SKILL.md, film-in-an-hour.md).
- 1.17.69 (2026-11-02): speed lab: every film runs the Moovi repo's docs/agents/speed/preflight.mjs (rules read, estimate, look/kit, voice first, contract, disk, RAM, one GPU owner) and tlog.mjs; judge per scene with one fix round, export per scene as it passes, probe picks the tab count; measured: rework is over half of logged hours, and this PC's integrated GPU renders 3D at 6-23 s per film second (SKILL.md, film-in-an-hour.md).
- 1.17.68 (2026-11-01): Ishaan on the Gandhi long form (abrupt sentence cuts, 3D jitters, letter crops): reused voice lines cut at the take's own silence with fades and a join gate; walking cameras follow the path, not the bobbing head, no shake loops over about 1 Hz; slip text auto-fits its paper, no hand on written words, captions hide while a slip is read; an overlay probe before every render (lessons.md, checklist.md).
- 1.17.67 (2026-10-31): Ishaan on the Gandhi long form captions: never a blurred dark plate; less stroke and shadow (hairline edge, one tight shadow); themed emphasis from the film's world (the key word on a khadi slip); a long form's captions start from its Short's; 2-3 word cards (lessons.md).
- 1.17.66 (2026-10-31): Ishaan: a long form after a viral Short is the next chapter, never a rerun; it must look better than the Short, judged blind against it (lessons.md).
- 1.17.65 (2026-10-30): Ishaan, "many errors, make it 8/10": a blind judge on 0.5 s contact sheets of the exported MP4 plus the pop scan gate every film at 8/10; story clocks tick every second; no bodies through props, no floating, both faces at the climax (lessons.md).
- 1.17.63 (2026-10-29): ASMR simulation Shorts are hyper smooth, realistic thin slices, 60 fps, channel-fit subjects (2/10 onion).
- 1.17.62 (2026-10-29): Ishaan: games have an emotional spine; every featured character has a felt stake, every loss is a fight, the first loss is its own event, setups pay off against expectation, the segment climbs to a climax decided by a character's choice; fewer, heavier exits (lessons.md).
- 1.17.61 (2026-10-28): Ishaan 2/10 on Stickman Games clip 3: games and contests are told the MrBeast way (one rule plus a visible threat, proven by the first try; few featured tries by known characters, each a 15-30 s story; mass exits narrated in one line; calm read, compression in narration; cuts stay as fast but cover one moment from many angles); a reference why comes from the videos themselves (lessons.md, showreel-youtube-automation.md; stick-games/WHY-MRBEAST-GAMES.md).
- 1.17.60 (2026-10-28): Ishaan: titles, dates and numbers over the picture never share the captions' look; they get a period look of their own (vintage paper for history), offered as 2-3 systems (lessons.md).
- 1.17.59 (2026-10-28): Ishaan rejected all Edge Hindi voices; Hindi narration is an ElevenLabs library narrator (Viraj), made on the website on the free plan and timed by forced alignment; Indian instruments in code (music-and-sound.md).
- 1.17.58 (2026-10-28): reference characters are built as the sheet shows them: a faceless sheet face = facial structure only, no invented features; swatch colours at full strength (proper white, pitch black); the figure keeps its presence (regal stance); face effects stay compositing overlays (taste.md, lessons.md).
- 1.17.55 (2026-10-28): Ishaan on the Stickman Games hook v3: a finished grade on bright worlds, smooth (not faceted) stylised props, polish fast and move on (lessons.md).
- 1.17.57 (2026-10-28): a character's face is always a real, good human face; blur/smear/stylised face effects are compositing overlays on a head matte, never geometry (taste.md, lessons.md).
- 1.17.56 (2026-10-28): Ishaan: a list Short opens on the list and its payoff in the first words ("Five free skills will unslop..."), the first frame already shows the problem; items joined in author's English (showreel-youtube-automation.md).
- 1.17.55 (2026-10-28): Ishaan: tool Shorts are about what is new or rising this week (GitHub Trending first, weekly star gains), never an old known tool; a ranked top 5 in one theme is a strong format (showreel-youtube-automation.md).
- 1.17.54 (2026-10-28): Ishaan on the Stickman Games cold open: a cold open meets the hero and the stakes first and shows a rule before any gag that needs it; his own reference sheets are the look spec for his show and replace any derived palette or character (lessons.md, taste.md).
- 1.17.53 (2026-10-28): Ishaan on Stickman Games: a long-form film starts as its first 10-15 s, complete and iterated to 10/10 with him before any other scene is built; it locks look, voices, sound and captions (lessons.md).
- 1.17.52 (2026-10-28): uploads target researched neighbour videos (yt-dlp), with an impressions plan.
- 1.17.51 (2026-10-28): Ishaan: never lifeless (breathing, blinks, head and eye micro-motion, weight shifts every frame), a smooth rig with no seams or popping, full-size render-error check before showing (taste.md).
- 1.17.52 (2026-10-27): Ishaan on Stickman Games: a reference why serves the owner premise, never graft its devices; view-mining crossover = famous characters showing their famous traits, logical witty eliminations, cinematic wrestler/hero intros, one uniform + number with distinctive features (lessons.md).
- 1.17.50 (2026-10-27): Ishaan: soothing animation; nail camera, light, contrast and grade; bright themed worlds with full-of-life pastels are the first choice for story films; use the saved camera moves (taste.md).
- 1.17.51 (2026-10-27): Ishaan on the Stickman Games look: soothing and bright; bright pastel sunlit worlds full of life are the first choice for channel story films; calm camera moves from the library camera layer; spend on camera, light, contrast and grade, never complex rigging (palette.md, lessons.md).
- 1.17.50 (2026-10-27): Ishaan 4/10 on the Stickman Games foundation vs Miko: open on the hurt, second person, one ticking number, science as evidence cards, small cast and faces first, one narrator voice (ElevenLabs when given), end on a viewer choice (lessons.md; the why in stick-games/WHY-MIKO.md).
- 1.17.49 (2026-10-27): Ishaan 4/10 on "Regrow Humanity": SIMPLE, NAILED. Pick little complication (few characters, simple actions, few places) and nail each 10/10 with story, light and captions; never stage crowds, vast scale shots or complex body actions that are not proven (taste.md, lessons.md).
- 1.17.48 (2026-10-26): multi-hero films: model kit first and checked, look locked before builders, honest scope estimate, preview when over time (film-in-an-hour.md).
- 1.17.47 (2026-10-26): Ishaan's own avatar is the hero version of him: muscular build, handsome manly face, a chosen groomed haircut; identity kept through skin tone and facial hair (taste.md, lessons.md).
- 1.17.46 (2026-10-26): Ishaan on the voice-cloning Short: a realistic young male voice (Brian), a bed he can hear (~7.5-8.5 LU under the voice), a keyword CTA on tool Shorts ("Comment VOICE..."), a small finishing grade in the encode (music-and-sound.md, showreel-youtube-automation.md, look.md).
- 1.17.45 (2026-10-26): a reference's character is rebuilt as THAT character (same silhouette, then better), never a logo or a new creature, and never worse than the reference in a blind side-by-side; 8/10 before anything reaches Ishaan (taste.md, lessons.md).
- 1.17.44 (2026-10-26): music-and-sound: per-line level riding from measured stems (bed ~7.5 LU under the voice).
- 1.17.43 (2026-10-25): one rig per channel cast, improved in place, a wardrobe of outfits on the same skeleton; films never build or fork characters (Ishaan).
- 1.17.42 (2026-10-25): the Ordinary Odd common end card (brand/cta): the channel idea in one beat, the character becomes the logo and directs the Subscribe ask, a sonic logo from the name; every Short appends it.
- 1.17.41 (2026-10-25): Ishaan 4/10 on the teaser Short: Shorts safe-area mask for all text, no punctuation in captions (enforced in code), separation lights so black heads never sit on black, a hook line in the first 2 s, a designed CTA end card, trailer sound rules (string models, stems measured 6-9 LU under the voice), and no subagents for a Short.
- 1.17.40 (2026-10-25): author's English is now its own skill (author-english): continuity of statements, flowing joined sentences with the feeling inside, never stacked short ones (Ishaan 0/10 on draft 2).
- 1.17.39 (2026-10-25): Ishaan: scripts in plain, easy English a half-watching viewer follows on first listen (everyday words, a visible spine named at each turn, what/why/finding/joke per beat, joins instead of jumps); re-read author-english.md before every script.
- 1.17.38 (2026-10-25): "uploadcontent" with every MP4; verify the audio stream before handing over.
- 1.17.37 (2026-10-24): no blackish captions; white type on a frosted translucent pill of the scene on light worlds (approved on the tardigrade film).
- 1.17.36 (2026-10-24): captions carry no punctuation; grey words >= 4.5:1 on light looks at weight 600 (Ishaan on the tardigrade film).
- 1.17.35 (2026-10-23): long-form films are 16:9 landscape, Shorts 9:16; the format is fixed in the contract first (showreel-youtube-automation.md, film-in-an-hour.md).
- 1.17.34 (2026-10-23): Ishaan: no haze (central caps on bloom, grain, fog; clarity and a firm black point); judge to 8/10 before sending (showreel-youtube-automation.md, lessons.md).
- 1.17.33 (2026-10-23): Ishaan 3/10: DOF is a hint, never a smear; caption visibility verified on the final MP4, a camera-side grad ND when bands miss (showreel-youtube-automation.md, lessons.md).
- 1.17.32 (2026-10-23): Ishaan: no RULE/PROBLEM corner labels or REAL/MATH fact markers on screen; they read as AI tags (showreel-youtube-automation.md, lessons.md).
- 1.17.31 (2026-10-23): Ishaan: the premise and title formula are WHAT too; never pick an idea that fits the reference's premise shape (why-not-what.md, lessons.md).
- 1.17.30 (2026-10-23): Ishaan: launch films are soft, slow and premium (keynote pacing); the fast-pacing rule is for channel/social films (launch.md, lessons.md, ~/.claude/CLAUDE.md).
- 1.17.29 (2026-10-23): launch.md L-2D-1 "Brand UI, 2D" (Fetaccino): one real demo item through the whole job, the site's UI redrawn from CSS, worlds from the site's own line, hand-set caption cards, 9:16 by reframing an off-screen 16:9 render, judge on full frames.
- 1.17.28 (2026-10-23): Ishaan on the Fetaccino launch: 2D, bright, on the brand's own colours, never a derived 3D material world by default; offer 2D vs 3D at intake (launch.md, lessons.md).
- 1.17.27 (2026-10-22): channel copy (bio, description, banner) describes the channel as a whole, never one video (showreel-youtube-automation.md).
- 1.17.27 (2026-10-22): Ishaan on coat film 2: story and storytelling good, "the English still feels AI": three levels (AI English, human English, author's English); every script is written at the author level. The tells and the fix in references/author-english.md.
- 1.17.26 (2026-10-22): Ishaan: background and texture are dynamic per video, never channel branding (the malachite was two films' look); brand assets use only the constant mark/wordmark/type on a neutral ground. In showreel-youtube-automation.md, film-in-an-hour.md, palette.md.
- 1.17.26 (2026-10-22): Ishaan on coat film 1 (first 43 s): animation and storytelling 9/10, voice, captions, sfx and music 2/10: sound is built with the picture by a sound lead from minute one (composed score, designed sfx families, captions always on, a chosen storyteller voice, an offline measured mix). In music-and-sound.md.
- 1.17.25 (2026-10-21): Ishaan on the battery film captions: cards 1-4 words on one line (no 1.0 s floor at a fast voice), the key word bounce stays in its line, no blur-in, full-res crop check by eye before showing. In edit-fundamentals.md 3 and film-in-an-hour.md.
- 1.17.24 (2026-10-21): references/film-in-an-hour.md (Ishaan: "the next video takes one hour max"): why the captions failed twice and why they work now (the caption band is designed in the contract), the 60-minute order with the look kit and shared models first, 4 builders at once, taste decided once per series.
- 1.17.24 (2026-10-21): Ishaan: the "Your daily dose of AI" tagline is removed from all films; from the next film the last sentence is spoken at a more normal speed (TAIL / TAIL_RATE in synth.mts).
- 1.17.23 (2026-10-21): edit-fundamentals.md 3: plate-free captions need a calm, deep caption band kept free of the hero by framing (Ishaan chose reframing over a floor grade or moving captions).
- 1.17.23 (2026-10-21): Ishaan: A vs B topics must compare two things of the same kind (no product-vs-category pairs like ChatGPT vs AI agent).
- 1.17.22 (2026-10-21): Ishaan on the AirPods film: captions (better font, spoken-word focus with the rest grey, elastic key highlight, no black shadow plate, why from references), sfx below average (designed sound, A/B), no "Magnified illustration" label, no dull/muddy backgrounds (vibrant colour + material texture, picked from rendered options), next film fast paced. In showreel-youtube-automation.md, edit-fundamentals.md 3, palette.md.
- 1.17.22 (2026-10-21): Ishaan: farm 10-15 raw films first, no channel name/logo/CTA in the films or captions; branding later (showreel-youtube-automation.md).
- 1.17.21 (2026-10-21): Ishaan: per-line pitch/rate shifts sound like different voices; one voice, one continuous read, faster; silences tightened by cutting gaps over 0.2 s. Replaces the per-line direction in 1.17.20 (voice rule in showreel-youtube-automation.md, music-and-sound.md).
- 1.17.20 (2026-10-21): Ishaan on the API vs MCP paper film: pacing too slow (faster, hook inside 2 s, 3.2-3.8 words/s, 0.05-0.25 s gaps), transitions and animations repeated (varied set, tabulated), voice monotonic (directed per line with rate/pitch/volume, A/B against flat). In showreel-youtube-automation.md, motion-feel.md, music-and-sound.md.
- 1.17.19 (2026-10-21): conflict resolved by Ishaan: films are 100% code (looks, frames, motion); the 'generated stills as art' note is superseded. Note: two entries were both numbered 1.17.17 by parallel sessions.
- 1.17.18 (2026-10-21): showreel-youtube-automation.md: verdict 0/10 on the one-shot cut-out puppet sample; motion samples are built from a measured shot list of the reference and compared side by side before showing.
- 1.17.17 (2026-10-21): Ishaan: the entire film is made 100% in code; this replaces the generated-hero-frame look route (1.17.12). Looks reach the bar through the measured 3D craft (taste.md) and the blind ratchet; never ask him for images. In showreel-youtube-automation.md and lessons.md.
- 1.17.17 (2026-10-21): showreel-youtube-automation.md: no image-to-video; motion entirely in code (Ishaan).
- 1.17.16 (2026-10-21): taste.md "3D look craft, measured": renderer and post before any frame is shown, measured never-black thresholds (mean luma 40-70, no flat region over 25%), holes get geometry, one camera spline, mechanism verbs acted on their word, anatomy details, OKLCH blends, named risks fixed, placeholder captions follow the rules (three blind critics on the Draft C board).
- 1.17.15 (2026-10-21): Draft C look board verdict A 4/10, B 2/10, C 2/10 (bare three.js primitives, no post, one near-black look): re-read the newest rules before building anything shown; generated hero frames choose a look, code previews are for motion; build on the best; ratchet look samples. In showreel-youtube-automation.md and lessons.md.
- 1.17.14 (2026-10-21): edit-fundamentals.md 14: Edit-DNA test verdict 2/10 (picture, subject, cards and motion, sound all named): source at least 1080p and camera-made, subject matches the look, designed cards, sound as A/B, a visual bar before showing.
- 1.17.13 (2026-10-21): lessons.md: measure faces inside the chosen window on the cropped card (whole-clip Haar medians lie), match each caption look to a speaker's framing, take a look's accent from the footage.
- 1.17.12 (2026-10-21): showreel-youtube-automation.md: look route (generated hero frames choose the look; cast sheet plus set plate feed the Remotion animation).
- 1.17.11 (2026-10-21): showreel-youtube-automation.md: look samples must clear the reference quality bar (verdict 1/10 on code-drawn samples); measure the bar, build one hero frame per look, compare frame by frame before showing.
- 1.17.10 (2026-10-21): showreel-youtube-automation.md: clone the WHY at full depth (finesse, direction, storytelling, virality) into a different niche/characters/concept, own 3D/Remotion world.
- 1.17.9 (2026-10-21): canvas-engine.md: the MP4 export of a live preview with its exact sound (offline mix via the same scheduler, seeked frames, ffmpeg at -14 LUFS).
- 1.17.8 (2026-10-21): CaptionsEasy keynote film shipped at 7.2 (blind, vs 4.8 same round); Ishaan locked its celadon palette, Andrew voice and synth bed. launch.md look L-KEY-1 "Keynote cut", palette.md worked example, canvas-engine.md bugs (scene-local time, alpha multiply, even-odd iris, hidden-pane rAF), ratchet.md scoreboard row and debts, lessons.md.
- 1.17.7 (2026-10-20): Ishaan decisions after the measured taste spec: real pages/apps/marks on screen; literal first, one metaphor max; reference pacing (no frozen holds); sound by A/B of two previews. In references/showreel-youtube-automation.md.
- 1.17.6 (2026-10-20): Ishaan: "references 9/10, you 1/10, you did not extract their taste": taste is measured per dimension from 4 fps frames, 30 fps bursts and audio, verified by a skeptic, and compared frame by frame before a rebuild. In references/showreel-youtube-automation.md.
- 1.17.5 (2026-10-20): Ishaan 1/10 on the hand-built reel ("you fucked the good parts of the template too"): remove the hard-coded what, never the engine's craft; ask which old parts he liked before a rebuild. In references/showreel-youtube-automation.md.
- 1.17.4 (2026-10-20): Ishaan verdict 3/10 on the API vs MCP reel: the look is derived from the reference WHYs not inherited from library/templates; one ink colour plus grey (no hard-coded multicolour text); a logo only if the subject has one; animation by meaning not one slide-in; min read/understand time sets animation speed; the explanation must teach; use all premium sfx; channel tagline "Your daily dose of AI". In references/showreel-youtube-automation.md.
- 1.17.3 (2026-10-20): Style 1 topic reel verdict 2/10: a film shows ALL the approved script (a layout/QA step never drops text); hard-coded layout rules to be replaced by principles. In references/showreel-youtube-automation.md.
- 1.17.2 (2026-10-20): Ishaan corrections on the Story track, in references/showreel-youtube-automation.md: brands are never forced on topic reels (no "Meet <Brand>" or domain line added by a doctor); scripts must hook (2-3 angle drafts, he picks); approve the script before any run; voice is taste (playable samples, he picks).
- 1.17.1 (2026-10-20): Showreel sub-skill references/showreel-youtube-automation.md (YouTube/social automation, 10-minute story channels, measured-time honesty rule).
- 1.17.0 (2026-10-20): Ishaan: "you took the what, not the why; four hours per reference; I need 10-15 min videos daily": references/why-not-what.md (the why card, principles not assets, variation test, 2-3 minute speed budget, shots not frames, parallel scenes).
- 1.16.0 (2026-10-18): Ishaan on Showreel v2 (0/10: "supposed to be a brand showreel", "could not understand what any reel is about", black screens where clips failed): showreel.md "What a Showreel is" (a brand showreel, the writer as creative director, understood by second 3, watched, remembered), the arc rewritten around the brand (solution names it, cta says it), the never-a-black-frame law; taste.md Craft: never a black frame, a promo is understood by second 3.
- 1.15.3 (2026-10-18): Showreel: a topic film's cta names no site, shop or studio (v2 invented lighthouse.org, WatchLab, Indigo Studio); the problem beat is a real problem, never a made-up disaster.
- 1.15.2 (2026-10-18): Showreel script arc (Ishaan: "hook -> problem -> solution -> .. -> cta"): every Showreel script fills hook, problem, solution, climax, cta in order, read aloud; humanized writing laws; the old ban on a spoken CTA is removed; theme voices are tone only.
- 1.15.0 (2026-10-18): Showreel branch references/showreel.md, read at runtime by the Showreel writer (packages/engine/src/showreel): the theme lock, the writing laws, four themes (night-stage, editorial, blueprint, real-footage) holding today's voices, pending Ishaan.
- 1.14.0 (2026-10-18): Launch skillset absorbed to f15: launch.md reference intake, looks L-REF-3 "Product tour" and L-REF-4 "Calm one-hue"; canvas-engine 3D shots (three.js), soft fields, plates and glass; music-and-sound real bed, beat phase, beat warp, the owner pack by map.json; shots-and-transitions refs 3â€“4; camera.md rows (UI dive, screen pull-back, 3D dolly, calm push).
- 1.13.8 (2026-10-18): launch.md item 7, the finish layers (real bed, owner sfx pack by map.json, cuts on the beat by a time warp, filter-free glass, sky band).
- 1.13.4 (2026-10-18): launch.md shot-for-shot item 6 (owner on f12: "better, push it further"): the reference's own moves (deep dive into one real element, drag-and-drop, blur placeholders, type at reference size, 3D composited onto the light world), clips decode from Play.
- 1.13.3 (2026-10-18): launch.md "When Ishaan sends a reference to match, rebuild it shot for shot" (Ishaan on f11: 2/10, "not at all the premium launch video i sent"): map the reference second by second, use the brand's REAL product screens and renders, real moving plates, one continuous camera per section.
- 1.13.1 (2026-10-18): references/camera.md (which camera move where, durations, eases, the smooth-speed law); motion-feel "smooth as butter"; canvas-engine rAF measuring, filter-free blur variants, bitmaps; launch.md look L-UI-2 "One material" and the f7â€“f10 lessons.
- 1.12.3 (2026-10-18): launch.md "smooth, filled, and ramped": sprite/blur-variant rendering rule with measured frame times, the media tools (footage finder + drawn art), the premium speed ramp (camera:speed-ramp).
- 1.12.2 (2026-10-18): launch.md "a new grammar never costs the craft" (Ishaan on f7: premiumness 10 â†’ 6); the f8 checklist.
- 1.12.1 (2026-10-18): Launch look L-UI-1 "Product UI" absorbed from Resend v6 (kits/launch-ui, scripts/launch-ui.ts: any site in under a minute).
- 1.11.2 (2026-10-18): palette gate (read the site CSS first, every hex a ramp token, monochrome brands stay monochrome, content colours count); launch.md item 5.
- 1.11.1 (2026-10-18): Launch branch references/launch.md (Ishaan's verdicts f1-f5: product UI as the film, chaos to order, bridge element, product-only beat, brand look from the live site).

## 1.0.0 (2026-10-07)
- First version, distilled from the CaptionsEasy launch film (Remotion, 40 s), the MotionEasy canvas engine
  (58 components, 13 transitions, 13 prompt kits), the bloom-reel showreel backtrack and the motion-feel review notes.

## 1.1.0 (2026-10-07)
- Â§0 five non-negotiables: know your limits and ask for assets; beyond-perfectionist rebuilds (the leap check);
  micro-details only added, never skipped; best hybrid stack with install-and-integrate; pick the 4th/5th idea.
- New references: ideation.md (5-idea drill), toolbox.md (per-shot engine choice, hybrid recipes, install log).
- Research-story-reel learnings: word-by-word type, visualise the verb, two worlds, depth of field, new transitions,
  15-second breakdown cadence.

## 1.2.0 (2026-10-07)
- After a 2/10 review: Â§11 default to the cinematic one-take, VO by default, physical ideas per beat.
- toolbox.md: what works for 3D inside Remotion on this machine (custom post, glyph planes, advance-before-continueRender).

## 1.3.0 (2026-10-16)
- Â§12 and references/talking-head.md: the talking-head / voice-led edit playbook (voice as the grid, layouts as data, camera on jump cuts, captions, big words, panels that act out their sentence, chapter cards from the poster), learned rebuilding reference R1.
- Owner A/B on R1: the skill-guided clone beat a faithful rule-by-rule copy. The skill is now used on every video job and grows after every reference (see "Keep improving this skill").
- New references/canvas-engine.md: the tested canvas-2D port of every helper (bisection bezier, closed-form springs,
  log pull, drift, velocity ghosts, word-by-word re-flow, slams, slot rolls, panel wipe/pixel/bars, DOF cards) plus the
  `?grid=` check sheet, sweep and determinism tools.
- Rule 0.1: when working unattended, build labelled swappable stand-ins and put the asset wish-list in the report.
- Â§4 voice-as-grid; Â§7 keeping a glowing-type look without glow-everywhere; Â§8 quieter SFX under a voice;
  Â§9 browser preview builds; Â§10 live-preview finishing; Â§11 exception for talking-head rebuilds.
- lessons.md: 8 build lessons from R1 (black reveals under panels, out-of-bounds camera keys, gradients on scaled text,
  behind-the-head placement, stacked lockups, Whisper stamps, the getImageData perf trap). checklist.md: talking-head
  and live-preview sections. New R1 transitions in shots-and-transitions.md; canvas row in toolbox.md; R1 case study.

## 1.4.0 (2026-10-16)
- talking-head.md: the roadmap / levels grammar from reference R2 (prop-row level marker on the desk, coin-flip level
  worlds, two-tier captions, hand labels with self-drawing arrows, grid boards + lime stickers, shatter, black punch, desk dive).
- lessons.md: list edits keep a physical marker in the speaker's world; share the canvas engine across references.
- The shared canvas engine and each reference's devices now live in the Moovi repo as kits (packages/library/src/kits).

## 1.5.0 (2026-10-16)
- talking-head.md: the chapter-dial grammar from reference R3 (one hero object holds the list; blackletter + gold heat;
  night-ground panels; library sound design only where the reference has none).
- Workflow: start every reference with `scripts/ref-intake.ts` (Moovi repo) and reuse kits/motion (engine + sfx kit)
  and the palette-driven speaker world; write only the new devices.

## 1.6.0 (2026-10-16)
- The quality ratchet (references/ratchet.md): every new film is judged blind against the best film so far and ships only at or above it; scoreboard kept there.
- taste.md: type, composition and craft rules from the owner and the blind judge (no full Fraktur; lit metal titles need an additive halo; fill panels; one big card at a time; the owner overrides the judge).

## 1.7.0 (2026-10-16)
- Reference R4 (red-table tutorial): the ratchet now requires **strictly above** the previous best sheet **in the same
  judge round**. Taste: never name a font family "Serif"; the tall condensed serif hero word with an eye for the dot;
  marker lettering inside measured widths; captions never touch a card; dense hardware cards.

## 1.8.0 (2026-10-16)
- Footage spans: fetch real b-roll and photos (Moovi's footage finder, scripts/ref-footage.ts) instead of drawing
  stand-ins, which read as paused video (owner note on R4). Rule 0.1's unattended clause now fetches first.

## 1.9.0 (2026-10-16)
- Reference R5 (night-glass how-to): R5 shipped at 7.0 against R4's sheet at 4.8 in the same round. Taste gains a "Glass and UI" section
  (live-blur glass, drawn walkthroughs with line icons and a touch dot, removed items turn red). Lessons: the self-check
  side-by-side before the judge, and check every fetched footage poster.

## 1.10.0 (2026-10-18)
- Rule 0.6, no silent defaults: every default (colour, font, ease, layout, saved style, pipeline rule) is questioned against alternatives.
- New references/palette.md: the banned AI-default palettes, the 5-palette drill, OKLCH tint ramps, roles, contrast from ramps.
- Â§10 storyboard board spec: frame plus a structured side panel, a timeline ribbon, the palette strip (owner: notes under frames read poorly).

## 1.10.1 (2026-10-18)
- Lessons: a moving piece is shown as a playable preview (range-capable server); every owner correction lands in the skills unasked.

## 1.11.0 (2026-10-18)
- New references/edit-fundamentals.md: editing a talking head from first principles (brand world, two worlds, devices by sentence function and verb, one caption system with backdrop-aware contrast, layout rhythm, build as a beat spec).

## 1.11.1 (2026-10-18)
- Captions: never punctuation; the premium two-tier glow caption (Moovi 1.1 green / 1.2 red) spec in talking-head.md; lessons on bloom vs stacked shadows, decoding a font from a zoomed reference, one-cut fonts thickened by stroke, reading motion from a reel at 30 fps.

## 1.11.2 (2026-10-18)
- Premium Caption 1 shipped as two variations whose colour comes from the video (one accent â†’ fill ramp + bloom); 1.1 word spacing.

## 1.12.0 (2026-10-18)
- edit-fundamentals.md: creator-reel devices decoded from em1 (cascade on springs, dim + product on top, the lit one in a row, the post frame, object wipe, comment pill ending), as brand-reskinnable fundamentals.

## 1.11.3 (2026-10-18)
- Premium Caption 2 (hybrid three-tier, AE glow); lessons: letter vs word spacing, AE glow on every tier, premium faces from a grid, size type by measured cap height.

## 1.11.4 (2026-10-18)
- Lesson: difference-blend faces and extruded 3D type (Premium Caption 3); check captionseasy looks for a named technique first.

## 1.11.5 (2026-10-18)
- Lesson: words behind the speaker need a person matte (MediaPipe in the browser); difference faces: invert first, accent over.

## 1.11.6 (2026-10-18)
- Lesson: negative difference captions are pure (no fill over); 3D type = words on turned perspective planes, not extrusion.

## 1.11.7 (2026-10-18)
- Premium Caption 3 per the owner's breakdown (stack + shiny negative behind the speaker); lesson: when a look keeps missing, ask for the owner's own breakdown.

## 1.11.8 (2026-10-18)
- Rule: captions never cover the face. Premium Caption 3 v7: negative colour from the background, reel composition; lesson: an owner breakdown is a description, apply taste.

## 1.11.9 (2026-10-18)
- Premium Caption 3: the highlight spans the shoulders at neck height; the rest is arranged around it.

## 1.12.0 (2026-10-18)
- edit-fundamentals Â§12, the recipe for a top-tier talking-head edit every time; Â§13 the motion-graphics gap.

## 1.13.2 (2026-10-18)
- Lesson: smooth captions in rAF (sprite cache, matte in a worker, measured fps).

## 1.13.5 (2026-10-18)
- Lesson: glossy display type (deep fill, bevel rims, solid extrusion, firm shadow); small words need a firm shadow.

## 1.13.7 (2026-10-18)
- Removed the edit `window` form rule and its automatic picker (1.13.6 and the lab-vlog note): Claude's own invention, never the owner's taste; the owner rated the edit it produced 1/10.

## 1.13.9 (2026-10-18)
- Rule: caption cards at least 1.2 s on screen, hold up to 1 s after the last word.

## 1.13.10 (2026-10-18)
- Rule: text behind the speaker is wider than the shoulders, centred at the neck, never across the face.

## 1.13.10 (2026-10-18)
- Owner rule: the edit's motion graphics, clips and UI components are tailored to each video, never a fixed set.

## 1.14.1 (2026-10-18)
- Rule: text behind the speaker is wider than the shoulders, centred at the neck, never across the face.

## 1.15.1 (2026-10-18)
- Owner rule: capable models invent each graphic; a small free model directs from the approved library menu (menu.json) and never builds from scratch.

## 1.16.1 (2026-10-18)
- Owner: only his approved edit rules stay (the v1-v6 board-era sections and the retired looks' numbers are scrapped from edit-fundamentals Â§1-Â§9).
- Owner rule: every edit shows the checklist (burn-in graphics, a form change, full-screen, camera, leaks, grade, palette from the footage, sfx on every arrival, music, smooth), at least 80-90%.

## 1.16.2 (2026-10-18)
- Owner: the capable model designs premium motion graphics itself (the player's `art` device: SVG/HTML + CSS on the edit's clock).

## 1.16.3 (2026-10-18)
- Owner on the demo film's ref D1 (2/10, "copy it exactly ... the sphere became a weird idk what"): backtracking.md "Copy it exactly" (formation first, 10 fps measuring, the reference's pacing and sound pattern, same frame and time); lessons.md line.

## 1.16.4 (2026-10-18)
- Owner (demo film H1): show every iteration as an MP4 file with sound, sent to him; a live browser page is not a deliverable (lessons.md).

## 1.16.5 (2026-10-18)
- Owner (demo hook): inserts follow the spoken order and live only on their word; set-pieces are filled with real footage-finder pictures, never invented UI or placeholders (lessons.md).

## 1.16.6 (2026-10-18)
- Owner (demo beat 2): a 3D reference is rebuilt in 3D, never flattened to 2D; only headline type may be a 2D overlay (lessons.md).

## 1.16.7 (2026-10-18)
- Owner (demo beat 2, 3/10): a film made 'from my clone' reuses the clone's own code, grade, type and stems re-timed to the new lines; never a fresh lookalike (lessons.md).

## 1.16.6 (2026-10-18)
- Owner (Meet Moovi beat): product films from the product's own code and real captured UI only (no other films, no invented or placeholder UI); the hero morphs through every transition; Apple-grade camera keys, whips with motion blur, segment-to-window UI morphs (lessons.md).
