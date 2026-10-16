# R4 references (from Ishaan, 2026-10-16 13:31 IST)

These replace the R2 seed styles for R4. Ishaan listed them in two groups (E1–E4 plus the effect X1, then E5–E6).
Instagram may need a login to view; whoever can open them notes what they saw under each id below.

| Id | Link | What it is |
|---|---|---|
| E1 | https://www.instagram.com/p/DehkOI3qX6d/ | edit style |
| X1 | https://www.instagram.com/p/Def9pj5TWtA/ | **not an edit style:** an effect for the video-effects library, used as an editing move |
| E2 | https://www.instagram.com/p/DZsVuGdx2cE/ | edit style |
| E3 | https://www.instagram.com/p/Ddtf1lUzljq/ | edit style |
| E4 | https://www.instagram.com/p/DeZM3UDTxfF/ | edit style |
| E5 | https://www.instagram.com/p/Dd31rjBznGo/ | edit style (second group) |
| E6 | https://www.instagram.com/p/DcbCMzoTwhS/ | edit style (second group) |

Ishaan also says the **5 generation styles** (Style 1, Editorial, Clear Signal, Dark Vox, Anatomy) can feed edits:
their images, drawn assets, UI components and motion graphics become overlay and b-roll material in an edit.
Claude 1 maps that in `R4-gen-assets.md`.

## Notes per reference

Seen by Claude 1 at 14:00 IST: 24 frames sampled evenly from each video, in the browser, with no login (sound not
heard). Times are into the video. **Four of the six (E3–E6) are one creator, tharunnaik.0,** so they form one style
family with two variants. That leaves **four distinct edit styles** plus the effects list X1, not six.

### E1 · zache.fs, "Let me reintroduce myself" (44.9 s) → style **"Atlas"** (creator intro)
- Talking head, warm grade, several looks and locations. A picture change about every 2 s (Tab measured 18 hard cuts).
- Captions: **two tiers**. Small white connector words plus a big heavy yellow uppercase key word ("NOT BECAUSE",
  "IDEAS", "DISAPPEARED"), stacked left of the head, sizes varying per word. Words sometimes sit behind the head.
- Inserts: rounded video cards with white pill labels ("Camera Angles", "Transitions") on an **aged parchment map**
  texture, joined by a red string line; phone mockups on white; a city photo card on the map ("Dubai"); an app-icon
  card on white; full-frame b-roll (empty chair for "disappeared").
- A white sunburst/ray graphic behind the head on hook lines; one shot on a red backdrop.
- **Already built:** the "Afterglow" session (Ishaan's machine) broke this one down to the frame and has an engine for
  it (see `CLAUDE1.md` 14:05 entry).

### X1 · tenfoldmarc, "17 video effects Claude can create" (27.2 s) → **effects library, not a style**
The 17 named moves: 01 orbit · 02 couch wall · 03 UI world · 04 frame break · 05 digital zoom · 06 phone mockup ·
07 checklist · 08 headline wall · 09 zoom-through cut · 10 chart grow · 11 pull-back reveal · 12 green screen ·
13 paper cut · 14 doodle boil · 15 vertigo · 16 cover story · 17 glass type. Shown as a phone held to camera playing
each effect. **footage-edit on `vignesh/router-r2` already has orbit, frame break, zoom-through, 3D wall and phone
pull-back** (R3). This list is the target set for the effects category, each one an `Asset` with a runtime.

### E2 · jordans.archivess, Procreate Dreams tutorial (110.7 s) → style **"Handmade"**
- A flat, saturated **red** stage. An iPad seen from above, a hand drawing on it; full-frame white cards with editorial
  type ("TODAY" inside dotted crop corners, "Moment" in a condensed serif).
- Hand-lettered, **doodle-boiled** words ("SENTENCES"), stop-motion feel (twos), sticker-like props cut out on red,
  big serif numerals ("2 seconds / 30 frame").
- Slow and calm: about one new idea every 4–5 s, small lowercase captions.
- Closest existing kit: **Dark Vox** (paper-theatre, paper cut) plus X1's doodle boil and paper cut.

### E3–E6 · tharunnaik.0, four reels (76–89 s) → one style family **"Night Desk"**, two variants
Common to all four: a dark, warm, low-key room (a desk, a lamp, a figure in the background); the speaker centred; small
white lowercase captions around the chest, one or two words at a time, sometimes with a serif italic word mixed in
("the surprising part?"); a big title word now and then ("UNDERRATED SKILL", "WASTE", "NEUROGUM", "GREAT").
- **Variant A, "split explainer"** (E4, E5): the frame is cut into a **graphic panel on top, speaker below**. Panels are
  dark charcoal UI: folders and file icons, numbered lists, glowing node graphs with a travelling dot, lock and
  pentagon icons, slide cards with yellow highlights, product screenshots (Gamma). Gold-gradient serif title for the
  hook ("MAKE YOUR FIRST LAKH"); olive army-star emblem textures between sections. A panel change every 3–4 s.
- **Variant B, "story with inserts"** (E3, E6): the speaker full-frame; **full-frame inserts** cut in on nouns: crimson
  poster graphics with glowing type ("NEVER FORGET", "PURE", keys, a sprouting plant), a news-article screenshot,
  a purple glowing AI orb UI, a game screen, a laptop UI, real photos. Props on the desk (poker chips as levels) that
  the story points at. A big number line ("500 crores of revenue").
- Sound not heard; assume a bed under the voice and hits on the inserts (R3 measured no gaps on E1).

## Proposed final set of edit styles (for Tab's R4 and the plan)

| # | Style | From | Status |
|---|---|---|---|
| 1 | Atlas (creator intro) | E1 | engine exists (Afterglow), needs to join the EDL |
| 2 | Night Desk · split explainer | E4, E5 | spec in R4 |
| 3 | Night Desk · story with inserts | E3, E6 | spec in R4 |
| 4 | Handmade | E2 | spec in R4 |
| 5–6 | Two from the R2 seeds (Hormozi punch, documentary) | R2 | Tab's seed drafts |

All of them draw their moves from the X1 effects list.
