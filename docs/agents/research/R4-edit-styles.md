# R4: the six edit styles as deterministic specs

Owner: Tab · 2026-10-16. Sources: Ishaan's E1 to E6 and X1 (`R4-references.md`) and the 6 reels he sent by Instagram DM
at 13:34 IST (I1 to I6 below). Builds on Claude 1's notes in `R4-references.md` and `R4-gen-assets.md` and does not
repeat them: names, insert material and the generation-style mapping come from there; this file adds the numbers and
the rules code can follow.

## How it was measured

| What | How | Caveat |
|---|---|---|
| Cut times | ffmpeg scene detection (`select=gt(scene,0.25)`, 160 px wide) on E1 to E6; on I1 to I6 only the edited panel was cropped and scanned at 0.18, because I1, I2, I4 and I5 are before/after showcase layouts | Misses punch-ins inside one shot; a flash or glitch transition fires several times, so cuts closer than 0.5 s are merged into one event |
| Frames | contact sheets at 1 fps (whole reel) and 2 fps (edited panel), plus 4 fps for the first 5 s, all looked at | Caption fonts are named by feel, matched to R8 ids |
| Words | faster-whisper `base` with word times on every reel: words per second, pauses, whether cuts land on a word boundary (within 100 ms) | I1 is Hindi and English, word times rougher there |
| Loudness | `audio-proof inspect` (EBU R128, silences under -35 dB longer than 0.4 s) | Instagram normalises to about -14 LUFS, so loudness says little except "no gaps" |
| SFX on cuts | peak level in 40 to 150 Hz (boom) and above 4 kHz (whoosh) within 150 ms of each cut, minus the same at 300 random times | A measure, not listening; sound was not judged by ear |
| Beat sync | onset autocorrelation for tempo; share of cuts within 80 ms of an audio hit against random times | Under continuous voice the tempo peak is weak (strength under 0.25 on every reel), so BPM is not reported as fact |

## The references, measured

| Id | Creator · what | Length, format | Shot changes (merged) | Median shot | Words/s | Pauses over 0.4 s | Cuts on a word boundary | SFX at cuts (whoosh / boom dB over random) |
|---|---|---|---|---|---|---|---|---|
| E1 | zache.fs, creator intro | 44.9 s, 1080x1920 | 17 (0.38/s) | 2.05 s | 3.74 | 8 (max 0.54 s) | 64% | 0.1 / -0.6 (none) |
| E2 | jordans.archivess, Procreate tutorial | 110.8 s, **1440x1080 (4:3)** | 45 (0.41/s) | 1.42 s | 3.45 | 18 (max 3.04 s) | 48% | -0.8 / 0.9 (none) |
| E3 | tharunnaik.0 | 88.7 s, 1080x1920 | 25 (0.28/s) | 2.42 s | 3.87 | 3 | 85% | **3.4** / -1.4 |
| E4 | tharunnaik.0 | 75.8 s, 1080x1920 | 35 (0.46/s) | 1.66 s | 4.13 | 3 | 86% | 1.4 / -1.4 |
| E5 | tharunnaik.0 | 88.2 s, 1080x1920 | 32 (0.36/s) | 1.84 s | 3.83 | 4 | 74% | -0.9 / -1.7 |
| E6 | tharunnaik.0 | 83.9 s, 1080x1920 | 38 (0.45/s) | 1.63 s | 3.92 | 3 | 61% | 0.2 / -0.4 |
| I1 | Nikhil, "$10 vs $150 edit" (podcast) | 16.7 s showcase | 9 (0.54/s) | 1.57 s | 3.11 | 0 | 62% | 2.0 / **3.1** |
| I2 | EditAura, "$20 vs $120 edit" (real estate) | 18.0 s showcase | 5 (0.28/s) | 2.89 s | 3.81 | 0 | 83% | -2.2 / -0.6 (none) |
| I3 | Hani, podcast edit | 31.7 s | 7 (0.22/s) + punch-ins | 4.60 s | 3.46 | 2 | 67% | 2.4 / 2.0 |
| I4 | Amirreza Amiri, brand story | 23.9 s showcase | 9 (0.38/s) | 1.71 s | 3.20 | 1 | 77% | -0.8 / 2.3 |
| I5 | Hossein Hosseinnezhad, before/after | 23.1 s showcase | 7 (0.30/s) + flash bursts | 3.28 s | 2.48 | 4 | 37% | **4.3 / 6.6** |
| I6 | Nishu (motion.nish), apparel promo | 23.0 s | 4 (0.17/s) + in-frame transitions | 3.48 s | 3.20 | 1 | 40% | -9.1 / 0.9 (none) |
| X1 | tenfoldmarc, 17 effects | 27.4 s | effects list, not a style | | | | | |

Every reel: integrated loudness -14.0 to -14.9 LUFS, no silence under -35 dB longer than 0.4 s anywhere (a bed or room
tone runs under the whole film).

Three findings that change the plan:
1. **Talking heads are cut tight.** In every talking style the longest pause left is 0.4 to 0.6 s, and 61 to 86% of
   cuts land on a word boundary. Pause trimming plus word-snapped cuts is the base law for five of the six styles.
2. **Picture changes every 1.4 to 2.4 s (median) in the E styles, but every 3 to 4.6 s in I2, I3, I5 and I6**, where the
   motion lives inside the shot (punch-ins, words building, UI animating). Shot length alone is not the energy measure;
   the EDL needs an event density (any cut, insert, title or zoom key) per second.
3. **Sound design is a style property, not a constant.** Measured hits on cuts in I5, I1, I3 and E3; none in E1, E2, E5,
   E6, I2, I6. The spec says per style which events carry a sound.

Correction to `R4-references.md`: E2 is not slow. Its median shot is 1.42 s, the fastest of all the E reels; what is
calm is the voice (18 pauses over 0.4 s, up to 3 s, kept in the edit).

## Shared laws (every style unless its table says otherwise)

| Law | Rule |
|---|---|
| Pause trim | Any gap between words over `pause_max` (default 0.40 s) is shortened to `pause_keep` (default 0.18 s). Slates, false starts and repeated phrases are cut. |
| Cut snap | A jump cut on the speaker snaps to the nearest word boundary within 100 ms. An insert may start mid-word; the voice carries under it (J/L cut). |
| Sentence rhythm | Each new sentence starts on a new framing (hard cut, punch or insert). The longest a single framing may hold is `hold_max` per style. |
| Loudness | Voice cleaned (ffmpeg `arnndn`, D1.2b), mix to -14 LUFS integrated, true peak -1 dBTP. Music ducks under voice. |
| Safe zones | Captions never cover the face box (YuNet, footage-edit already tracks it) and stay out of the top 8% and bottom 15% (platform UI). |
| Determinism | Same source, same style id, same seed: same EDL. Every choice in the EDL names the rule that made it. |

## Style 1 · Atlas (creator intro)

References: E1 (and Afterglow's frame-level `BREAKDOWN.md` for it, once committed). Also feeds the two-tier caption
used by Brand Promo.

| Field | Spec |
|---|---|
| Format | 9:16, talking head, several looks and locations (E1 changes background colour, outfit and place) |
| Cut rhythm | 0.38 shot changes/s, median shot 2.05 s, p90 4.5 s; `hold_max` 4.5 s |
| Cut triggers | sentence start (new look), named thing (insert card), hook line (sunburst backdrop) |
| Captions | Two tiers: small white connector words, big heavy yellow uppercase key word ("NOT BECAUSE", "IDEAS"); 1 to 3 words per group, stacked left of the head, size varies per word, some words behind the head. Word-by-word build at speech time (about 0.25 s per word in the first 5 s). R8: `punch-stack` with keyword in accent (yellow), title words `kin-behind`. R8 has no explicit two-tier style; proposed new id `tier-two` (connector S, keyword XL) |
| Highlight rule | nouns, numbers and the last word of a clause become key words; at most 1 key word per group |
| Camera, zoom | Static frames per look; no punch-ins measured; cards slide in from the side |
| Transitions | hard cut (most); slide-in for cards; X1 06 phone mockup, 11 pull-back reveal |
| Inserts | rounded video cards with white pill labels on an aged parchment map, joined by a red string; phone mockups on white; city photo card on the map; full-frame b-roll for literal nouns ("disappeared": empty chair) |
| Overlays | white sunburst rays behind the head on hook lines |
| SFX | none measurable on cuts (+0.1 dB); keep to soft whooshes on card entries only |
| Music | continuous bed, no gaps; voice-first, ducked |
| Grade | warm, saturated skin, clean whites |
| End | name or handle card |
| First 5 s | 0.0 cold open on another look; 0.25 "So" then "LET'S TRY THIS AGAIN" builds left of head; 1.25 look change; 1.5 dark look, name line with yellow key word; 2.3 back; 2.5 to 3.75 word build; 4.1 white page, phone mockup slides in. 4 cuts and about 20 words in 5 s |

## Style 2 · Night Desk (split explainer and story with inserts)

References: E3, E4, E5, E6 (one creator). One style with two layout variants, as Claude 1 found: **A** charcoal UI
panels (E4, E5), **B** crimson poster inserts (E3, E6). Both variants use the top-panel split, so the variant is a
palette and insert-kind switch, not a different engine.

| Field | Spec |
|---|---|
| Format | 9:16. Speaker centred in a dark, warm, low-key room. Layouts: `full` (speaker), `split_top` (graphic panel top 50%, speaker reframed into the bottom 50%), `full_insert` (graphic full frame) |
| Cut rhythm | 0.28 to 0.46 changes/s, median shot 1.63 to 2.42 s, p90 3.5 to 5.8 s; `hold_max` 4 s; fastest talker of the set (3.8 to 4.1 words/s), pauses all trimmed (max 0.5 s) |
| Cut triggers | 85% on word boundaries in E3/E4: sentence start, every numbered point ("1. DON'T SELL FEATURES" header bar), every concrete noun gets a panel |
| Captions | small white lowercase sans, 1 to 3 words, at chest height, one group at a time; one serif italic word mixed in on a contrast word ("the surprising part?"). R8: `ed-mixed` at size S, lowercase |
| Titles | big white condensed uppercase title word for the hook and each section ("UNDERRATED SKILL", "66 SECONDS", "18 Y/O"), often **behind the head** (matte). Variant A hook may use a gold-gradient serif ("MAKE YOUR FIRST LAKH"). R8: `kin-behind` |
| Highlight rule | numbers and the section noun go to the title tier; captions carry no colour highlight |
| Camera, zoom | static medium shot; reframed smaller in `split_top`; slow 2 to 4% push over a held line |
| Transitions | hard cut; panel content swaps with a fast slide or fade under 6 frames; X1 08 headline wall, 07 checklist, 10 chart grow |
| Inserts A | charcoal UI panels: folders and files, numbered lists, glowing node graph with a travelling dot, lock and pentagon icons, slide cards with yellow highlight, product screenshots. Source: Clear Signal, Anatomy, Style 1 UI (R4b) |
| Inserts B | crimson poster graphics with glowing type ("NEVER FORGET"), icons (keys, plant), news screenshots, AI orb UI, real photos; desk props the speaker holds. Source: Editorial posters (R4b) |
| Overlays | olive army-star emblem texture between sections (A); none on the speaker |
| SFX | whoosh on panel and insert entries: measured +3.4 dB on E3 cuts, +1.4 dB on E4; none on plain jump cuts |
| Music | continuous low bed, no gaps; ducked about 12 dB under voice |
| Grade | low-key warm: lifted blacks slightly crushed, warm highlights from a practical lamp, saturation down on everything but skin |
| End | "comment WORD" CTA card (white on black, big word) |
| First 5 s | E3: 0 to 1 small captions "you", "give me"; 1.0 title "66 SECONDS" top; 2.25 "5 SECRETS"; 3.2 crimson poster "NEVER FORGET ANYTHING". E4: 0 lock-icon card at chest; 2.0 "UNDERRATED SKILL", SKILL behind head; 3.5 black panel "16" to "16 to 24 years old". About 1 event/s, 18 to 21 words |

## Style 3 · Handmade

Reference: E2.

| Field | Spec |
|---|---|
| Format | **4:3 landscape** in the reference (1440x1080); for 9:16 output the stage is cropped centre and cards are re-laid vertically. Overhead camera on a flat saturated red tabletop, hands and an iPad |
| Cut rhythm | 0.41 changes/s, median shot 1.42 s, p90 5.6 s: bursts of fast stop-motion cuts, then long holds on the hands working; `hold_max` 6 s |
| Pause rule | **exception:** pauses kept up to 1.5 s (E2 keeps 18 over 0.4 s, up to 3 s); the voice is calm, 3.45 words/s; only 48% of cuts on word boundaries because pictures cut on the stop-motion beat |
| Cut triggers | each new object placed on the table; each new term (white card); stop-motion runs on twos (12 fps feel) |
| Captions | serif italic lowercase subtitle, bottom centre, a phrase at a time. R8: `ed-serif` (lowercase) |
| Titles | hand-lettered white words drawn on the footage that boil (redrawn every 2 frames): "SENTENCES", "SOOOO"; big serif numerals on a blurred background ("2 SECONDS / 30 FRAMES"); white editorial cards with dotted crop corners ("TODAY"). R8 has no fit for a boiling hand-lettered word; proposed new id `hand-boil` |
| Camera, zoom | locked overhead; no moves; scale-pops on cut-out objects |
| Transitions | hard cut; paper cut and doodle boil (X1 13, 14); white card full-frame cut-ins |
| Inserts | paper cut-out icons and stickers placed by hand; white cards with serif type; crimson card with eye doodle |
| Overlays | white hand-drawn arrows and underlines on the footage |
| SFX | none measurable on cuts; paper and pencil foley would fit but is not in the reference |
| Music | the most rhythmic bed of the set (tempo peak 150 BPM, strength 0.23, still weak); light, ducked |
| Grade | flat bright, red pushed, whites clean |
| End | "comment WORD" sticker |
| First 5 s | 0 "SO" multiplies into "SOOOOO" (stop motion); 0.5 "TODAY" in crop corners; 1.5 crimson card "Finally"; 2.5 white cards "HOW I"; 3.25 black squiggles animate; 4.25 hand on iPad. 6 cuts in 5 s, then it slows |

## Style 4 · Crimson Cutout (new, from Ishaan's DM reels)

References: I1 (calm version) and I4 (high-energy version).

| Field | Spec |
|---|---|
| Format | 9:16. The speaker is **matted out** and placed on a flat background that changes with the line: crimson, cream paper, textured paper, black (I1). I4 keeps the real room but flashes to black and white with red type |
| Cut rhythm | I1 0.54 changes/s, median 1.57 s; I4 0.38/s, median 1.71 s; a visual event (background swap, word, prop) every 0.5 to 1 s in I4; `hold_max` 3 s |
| Cut triggers | each clause swaps the background colour (I1: red, cream, red, split, cream, black, paper, red, cream); emphasised words trigger a black and white flash (I4) |
| Captions | mixed type: small white sans connector plus a crimson **serif italic or script key word** ("mistakes"); red label boxes ("I have made many"); outline-stroke echo of a repeated word ("Manny Manny" stacked); big bold white uppercase across the chest ("IMPROVE"). I4 sets words rotated 90 degrees and along arcs around the head. R8: `ed-mixed` (keyword to crimson serif italic), `box-label` for label boxes, `kin-scatter` for the I4 orbit |
| Highlight rule | the emotional or moral word of the clause gets the crimson serif; repeated words get the outline echo |
| Camera, zoom | punch-in and out per sentence (I4); slight shake on stamps |
| Transitions | background colour swap on a cut; black and white flash for 0.5 s; torn paper reveal (X1 13 paper cut); face-grid collage (X1 04 frame break); red circle wipe; a flicker burst of 6 to 9 frames (I1 at 10 to 12 s) |
| Inserts | magazine header strip on top ("MISTAKES HARDWORK CONSISTENCY") as section tabs; triptych split-screen b-roll with red censor bars; 3D object on black (I1 virus sphere); money, laptop and museum b-roll with red stickers (I4); red "PROOF" stamp |
| Overlays | red or crimson circle halo behind the head; doodle spark lines by the head; paper grain |
| SFX | booms on swaps (I1 +3.1 dB low band, I4 +2.3), whoosh on flashes (I1 +2.0 high band); stamp hit on "PROOF" |
| Music | continuous bed; hits follow the cut, not a beat grid (cuts on audio hits at baseline rate) |
| Grade | warm skin on crimson (sampled #81011F) and cream paper (sampled #F5E9CF); black and white beats with red kept |
| End | logo card or the last key word large |
| First 5 s | I1: 0 to 2 red ground, "All of us will" with an arrow, "make mistakes" in crimson italic; 2.0 cream ground, red label "I have made many"; 2.5 "mistakes" in script; 3.5 "Many Many" outline echo; 4.4 back to red. I4: 0 wide with words; 0.5 rotated red words; 1.0 black and white flash; 1.8 punch; 3.2 cut; 3.5 paper card flies in; 4.4 flicker |

## Style 5 · Brand Promo (new, from Ishaan's DM reels)

References: I2 and I6. Shares the two-tier caption with Atlas but is built for a business message: checklist UI,
locations and a CTA.

| Field | Spec |
|---|---|
| Format | 9:16. Speaker in 2 to 3 locations (I2: office, hallway, garden) or one location plus AI and stock b-roll (I6) |
| Cut rhythm | 0.17 to 0.28 shot changes/s, median 2.9 to 3.5 s, but UI elements animate inside every shot (an element every 0.5 to 1 s); `hold_max` 4.5 s |
| Cut triggers | I2: cuts land on audio hits 67% of the time against 25% at random, the only reel with a measurable cut-to-hit link, so cuts go on the bed's hits; each sentence moves location |
| Captions | two tiers: big heavy rounded key word in one brand colour (lime and teal alternating in I2; pink gradient in I6, with a letter swapped for an icon: "LOOking" with glasses) plus small white connector words above or below; key word sits high (I2) or mid-chest (I6). R8: proposed `tier-two`; nearest existing `punch-stack` |
| Highlight rule | the content word of each 2 to 4 word group; the brand colour alternates per group (I2) |
| Camera, zoom | static per location; push-in on list moments; picture in picture card that grows to full (I6 7 to 7.5 s) |
| Transitions | hard cut between locations; blur-zoom (I6); 3x3 tile-grid reveal at the open (I6, X1 04 frame break variant) |
| Inserts | numbered checklist pills that stack (I2: 1 STABILITY, 2 SECURITY, 3 WEALTH; I6: "Constant washing", "Ironing", "Lot of maintenance"); icon plus label pill with a cursor click ("BUYING"); white UI world with product icons and a toggle (X1 03 UI world); AI b-roll scenes; year pill ("2025") |
| Overlays | glow outline traced around the speaker (I2 at 10.5 s); pink doodle squiggles (I6); strong vignette |
| SFX | none measurable on cuts (I2 -2.2, I6 -9.1 dB high band); a soft click on each pill and cursor is the one sound to add |
| Music | upbeat bed, cuts on its hits; ducked under voice |
| Grade | bright and clean, natural skin, brand colour kept saturated |
| End | CTA pill ("LET'S TALK" with phone and mail icons) |
| First 5 s | I2: 0 "if you only" small, "watch" big lime; 1.0 "one video"; 2.0 "this" teal; 2.73 cut to hallway, "Homeownership"; 4.5 "my entire". I6: 0 to 1 tile-grid reveal zooms out to full frame; 1 to 3 "2025" pill and pink "LOOking forward"; 3.5 blur zoom; 4.0 white UI world |

## Style 6 · Studio Minimal (new, from Ishaan's DM reels)

References: I3 (podcast) and I5 (dark version). One take, no locations: everything comes from framing, words and one
hero graphic per section.

| Field | Spec |
|---|---|
| Format | 9:16, a single seated take (podcast mic in I3) |
| Cut rhythm | 0.22 to 0.30 changes/s, median 3.3 to 4.6 s; punch-ins inside shots every 2 to 3 s; `hold_max` 5 s. I5 talks slowly (2.5 words/s) and keeps 4 pauses over 0.4 s for weight |
| Cut triggers | framing alternates wide and close per sentence (I3 at about 2, 4.5, 5.4, 8.0, 12.6, 18.5, 20.9, 25.8, 27 s); the key line of a section goes to the close framing |
| Captions | centred at chest, built word by word; three sizes: small white connectors, medium white words, a bold large key word in orange gradient (I3: "Golden rule", "their attention", "uncomfortable"); I5 stacks a phrase in mixed fonts per line (bold sans, script italic, thin) with a blur-in per word and later single-word subtitles. R8: `ed-mixed` plus the proposed `tier-two`; single words `clean-center` |
| Highlight rule | one key word per sentence, the noun that answers the hook |
| Camera, zoom | digital punch-ins of 115 to 140% (X1 05 digital zoom) cut on word boundaries, holds static between; I5 close framing is a background-removed black and white crop |
| Transitions | punch cut; pull back into a device frame (X1 11 pull-back reveal and 06 phone mockup, I3 8 to 12 s); colour frame offset inset (I3 25.5 s); flash bursts of 3 to 6 frames (I5 at 7.3, 11.4, 16.0 s) |
| Inserts | one hero graphic per section: 3D gold bars falling with ripple rings (I3 hook), a red neon number on black ("%94", I5) |
| Overlays | white matte outline around the head on the black and white close (I5); film grain; red light panels in the room (I5) |
| SFX | the strongest sound design of the set: I5 +4.3 dB whoosh and +6.6 dB boom on cuts; I3 +2.4 and +2.0. Every punch and flash gets a hit; the hero number gets a riser and impact |
| Music | sparse bed, near silent under key lines (I5 loudness range 6.7 LU, the widest of the set) |
| Grade | I3 cinematic green and teal shadows, warm skin; I5 dark, contrasty, black and white beats with red as the only colour |
| End | brand logo card on black (I5) |
| First 5 s | I3: 0 to 1.5 gold bars fall with ripples over the speaker, "There is a / Golden rule"; 2.0 punch in, "their attention"; 4.5 wide. I5: 0 to 3.5 wide room, red light flicker, "What happens / to your paid ad" builds; 3.5 cut to black and white close with white outline, red outlined "PRESENCE" |

## X1 as the move list

The 17 named effects are moves the styles call by id: 01 orbit, 02 couch wall, 03 UI world (Brand Promo), 04 frame
break (Crimson Cutout grid, Brand Promo tile reveal), 05 digital zoom (Studio Minimal), 06 phone mockup (Atlas, Studio
Minimal), 07 checklist (Night Desk A, Brand Promo), 08 headline wall (Night Desk), 09 zoom-through cut, 10 chart grow
(Night Desk A), 11 pull-back reveal (Atlas, Studio Minimal), 12 green screen (Crimson Cutout's matte), 13 paper cut
(Handmade, Crimson Cutout), 14 doodle boil (Handmade), 15 vertigo, 16 cover story (Crimson Cutout header strip), 17
glass type. The R2 seeds (Hormozi punch, documentary) stay as extra styles; the three I styles replace them in the set.

## What the EDL must carry for these styles

Input for D1.1 (EDL schema v0). Times are output seconds unless named `src_`.

| Group | Fields | Needed by |
|---|---|---|
| Header | `version`, `style_id`, `style_variant` (Night Desk A or B), `seed`, `source {id, duration, fps, w, h}`, `output {aspect, w, h, fps}`, `palette` (roles: ink, paper, accent, accent2, ground, from R8), `caption_style_id`, `rules_version` | all |
| Words | `words[] {src_t0, src_t1, text, speaker, conf, role: connector, key, number, title, line_id}` | all captions, cut snap, highlight rules |
| Keep list | `keep[] {src_in, src_out, reason: speech, pause_trim, slate, retake}` plus the style's `pause_max`, `pause_keep` | all (Handmade loosens it) |
| Shots | `shots[] {t_in, t_out, src_in, src_out, layout: full, split_top, split_bottom, card, pip, grid, full_insert, framing {scale, cx, cy, rot}, zoom[] {t, scale, cx, cy, ease}, bg {mode: original, matte_fill, matte_texture, asset_ref}, matte: bool, mono: bool, grade_id}` | punch-ins, splits, cutouts, black and white beats |
| Cuts | `cuts[] {t, type: hard, jump, punch, flash, glitch, blur_zoom, tile_grid, paper_tear, circle_wipe, slide, device_pullback, dur, trigger: sentence, keyword, number, beat, insert, rule_id}` | every style's rhythm |
| Captions | `captions[] {t0, t1, word_idx[], tier: connector, key, title, style_id, case, size, font_role, position: chest, left_of_head, top, lower, behind_subject, path: line, arc, vertical, rotation, entry, exit, highlight_idx, colour_role}` | tiers (Atlas, Brand Promo, Studio Minimal), behind-head titles (Night Desk), arcs (Crimson Cutout) |
| Inserts | `inserts[] {t0, t1, kind: broll, panel, poster, ui, checklist, card, number, map, phone, object3d, photo, frame: full, top_half, card_box, beside_head, asset_ref (R7 Asset id), need (R4b needs), label, enter, exit}` | Night Desk panels, Atlas cards, Brand Promo UI, hero graphics |
| Overlays | `overlays[] {t0, t1, kind: halo, sunburst, doodle, outline_stroke, header_strip, glow_trace, grain, vignette, light_leak, params}` | Atlas, Crimson Cutout, Brand Promo, Studio Minimal |
| SFX | `sfx[] {t, asset_ref, event: cut, insert_in, title_in, flash, stamp, ui_click, number_hit, gain_db}` | per-style sound rules |
| Music | `music {asset_ref, bpm, beats[], gain_db, duck {db, attack_ms, release_ms}, cut_on_beat: bool, end: button, fade}` | Brand Promo beat cuts, all beds |
| Voice | `voice {clean: arnndn, gain_db, target_lufs: -14, true_peak: -1}` | all |
| End card | `end {kind: cta_comment, cta_pill, logo, name, text, t0}` | all |
| Metrics | `metrics {changes_per_s, events_per_s, median_shot, max_hold, words_per_s, max_gap, cuts_on_word_pct, sfx_on_cut_pct}` written by the builder and checked against the style's band | R9 score, style check |

The metrics block lets every build be scored against the measured bands in this file (R9): a Night Desk edit with a
median shot over 2.5 s or a gap over 0.5 s fails its own style.
