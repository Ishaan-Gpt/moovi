# Launch mastery: taste log

Ishaan's direction (2026-10-18): the saved looks, arcs, parts and rules hold poor taste. **Taste first, style second.**
Make bespoke films, take Ishaan's verdict on each, and write what he likes into taste. Only once the taste is proven,
turn it into a Launch style. Until then, nothing new is cast from the old Launch library. It stays in the code but
isn't used for taste.

## The loop
1. **Make.** One bespoke film for one site (resend.com for now), written from scratch with the ishaan-motion skill and
   Ishaan's references (`refs-launch.md`). The first output is a board of stills in about 2 minutes. The playable
   film comes only when he asks.
2. **Verdict.** Ishaan says what is off. That answer is the taste.
3. **Write it down.** Each verdict becomes a line below, plus a law or number on the skill's Launch branch.
4. **Convert.** Once a few films in a row land, turn the proven taste into the Launch style (motifs, camera grammar,
   type, transitions, sound, polish) for the Director to write from.

## Films and verdicts
| # | Film | How it was made | Ishaan's verdict |
|---|---|---|---|
| p0 | Launch pipeline, resend.com (`data/launch/v1-resend`) | 12 looks, 10 arcs, ~400 graph parts | about 2/10. Captions bad, no SFX on captions, no continuity, abrupt cuts, no motion graphics, no camera moves, no effects, no polish |
| f1 | "One Line" (`data/freeform/resend`) | one master prompt, no pipeline | better than the pipeline |
| f2 | "Delivered" (`data/freeform/resend-v2`) | the prompt plus the ishaan-motion skill | a little better than f1 |
| f3 | "Inbox-ready" (`data/freeform/resend-v3`) | the skill plus ref 1's grammar (UI as the film, chaos to order, a bridge element) | waiting |

## Taste learned
- One bespoke film beats a template made of re-skinned parts. Never cast the old Launch looks, arcs or parts blindly.
- A slideshow of one headline per beat reads as cheap. A film needs continuity: one motif and one moving camera,
  with transitions made from objects.

- **f3 (Ishaan: better):** the product's own UI as the whole film, a header that stays as the anchor, a dense colourful pile that sorts into order, and a bridge element (the search bar becomes the end pill). Keep this direction.
- **f4 (Ishaan: better):** real photos in the emails, and one beat only this product can have (its own code, edited live, re-rendering the preview).
- **Brand fidelity:** read the brand's real site first (palette, display face, logo). A reference's world (dump's light grey) is grammar to learn from, not a palette to copy.

- **f5 (Ishaan: the colours don't match the brand):** the content wears the brand too. Read the site's CSS colours and fonts before building, and make every hex a ramp token (the skill's palette gate in `palette.md`).

## Ref 1: dump.cam (x.com/javiiarchive, 20 s) — what it teaches
- **The product's own UI is the whole film.** There are no headline cards; the only on-screen words are the UI's own
  ("Your dumps.", the filter pills, the search box, "New dump"). The copy lives in the product.
- **The logo becomes the UI.** The mark slides left, the wordmark appears beside it and the header bar builds around
  them (filters, search, the call to action). That header then stays put as the anchor across most of the film.
- **Real content, dense and colourful.** Dozens of real-looking user items (photos, posters, stickers, phone shots)
  pop into a growing pile. Density and colour carry the energy, on a calm warm-grey world with one brand colour.
- **Chaos, then order.** The pile is zoomed into, one item opens, then everything flies into a tidy grid ("Your
  dumps."). A filter pill click re-flows the grid, then a phone view, then the Templates page scrolls.
- **Dive into a tile.** One template goes full-bleed (a real photo). A frosted search bar appears on it and types
  "little wins". The photo shrinks away and the search bar stays as the bridge. Results fly in around it, then fly out.
- **The end card is the brand's own button.** The search bar turns into the orange "dump.cam" pill: the call to action
  is a piece of the UI.
- **Craft:** 60 fps, fast but smooth layout morphs, a cursor that clicks and selects, selection handles on the chosen
  item, motion blur on the fly-ins, no camera shake, no glow.

## Ref 2: Vainu (instagram.com/p/Del5jxutfmh, 64 s): what it teaches
- **One material runs the film: dots.** Real photos scatter at depth, then swarm into a rotating sphere of thumbnails.
  The sphere collapses to one dot, the dot becomes the logo ("Reintroducing ● VAINU"). Then come dot-matrix numbers
  over dark halftone tiles, a dot field that "pulls up the ones that matter", signal pins rising out of a halftone
  landscape, and a dot-matrix map with counts.
- **One sentence across many beats,** small and precise, centred, word by word: "Companies don't stand still. They
  grow. They hire. They acquire. They change." Each verb has its own picture. The type is small (about 2.5% of the
  frame height); the picture carries the scale.
- **Busywork as a cloud:** dozens of chore verbs swirl around the payoff line ("So you can spend less time…"), then
  clear for "And more time acting on what matters."
- **One accent** (a signal green) on a white world, with dark tiles for the stats. The product's UI appears as frosted
  glass over real photos (the search prompt over a city, signal cards over fog).
- **End:** the logo with a rule and the line "Nothing changes except everything."
- launch-ui.ts input (for Tab's directFilm): one site URL in, data.json out {name, host, url, tagline, gridTitle, sub, cta, nav[], cards[], query, colours[{hex,w,role}], fonts{display,displayWeight,ui,cssUrl}, images[], logo, hero}; unchanged since L-UI-1.

## Ref 3: Commas Studios (instagram.com/p/Dd_YP9Wo8c-, 35 s): what it teaches
- **Type out of stipple:** "Introducing" resolves inside sweeping ribbons of stippled dots (a dither smear) that
  condense around the word, then clear.
- **The black was a screen (pull-out reveal):** the mark drops on black and the wordmark slides out of it; the camera
  then pulls back in log space, and the black turns out to be a phone's screen, floating over a real mountain
  landscape, with the product's feed on it.
- **One giant verb per beat, blurred behind floating UI** (Post, Engage, Grow): the word is huge and soft, the UI card
  sharp in front, a real photo plate behind both.
- **UI over real environment plates:** the product's windows float over mountains, a famous painting, clouds and a
  wheat field. The plate gives the colour, and the UI stays the brand's.
- **Two worlds:** the dark brand world (logo beats), and a light product world with a soft glow of the brand colour
  rising from the bottom (product demo: sidebar click → course grid → zoom → "Gate your best content." → "Host" →
  "Sell inside your community.").
- **End:** a big glass rendering of the mark between the two halves of the name, then the lockup on black.

## Ref 4: Notely (instagram.com/p/DeO1Rh7x5Qm, 21 s): what it teaches
- **One hue, calm:** the whole film lives in one colour's tints (mint → deep green), soft gradient fields instead of
  backgrounds, slow drifts instead of cuts; the energy is in the type and the focus pulls, not the camera.
- **Tiny type:** lines at about 30 px at 1080, word by word, each word drifting in from the right out of a blur; a
  second line in a lighter tint ("To many notes. / To many ideas.").
- **Two 3D shots:** a stack of the product's pages lands with soft shadows (the problem), then a calm room with a laptop
  whose screen asks the question, giant blurred ghost words behind the typed line.
- **Focus pulls as transitions:** a dark blob sweeps the light field to dark ("meet" → the name); a light burst, the
  glass dashboard pulls into focus, holds, then defocuses into a moving field.
- **A word cycler** ("Capture your ideas / thoughts / creativity"), then "Everything connected", "All With", and the
  logo resolves out of scrambled letters.

| f10 | `data/freeform/resend-v10` | f9 smooth as butter: the speed ramp as an easing (rest → ≈2× → ≈0.5× → ≈2× → rest), 1 px blur levels, a continuous layer blur, soft in-out on travel, sprites as bitmaps; rAF playback 138 fps (v8: 11) | absorbed as L-UI-2 "One material" with the skill updates |
| f11 | `data/freeform/resend-v11` | ref 3 grammar: stipple ribbons → "Introducing"; the R drops on black, the name slides out; a speed-ramped pull-back shows the black was the phone's screen over a real mountain; Send / Track / Reach as giant soft verbs behind sharp UI on real plates; the dashboard (click Emails, one opens, Delivered); one API call; the mark and lockup on black. rAF playback: 60 fps for most of it (median 16.7 ms), 17 of 1023 frames over 33 ms | 2/10: "not at all the premium launch video i sent" (it invented its own structure and drew its UI) |
| f12 | `data/freeform/resend-v12` | ref 3 rebuilt shot for shot (32 s, 120 BPM): stipple → "Introducing" → "Resend."; the R drops on black and the name types; a speed-ramp pull-back shows a phone over a real valley clip; the email card ("Send"), a pan down onto Resend's REAL analytics screen ("Track"); "Reach"; the REAL Metrics dashboard over Resend's engraving art, a cursor click on Broadcasts, a grid of Resend's real covers and 3D renders loading blur → sharp; the REAL Audiences card over night turning to day; the light editor with real headers; a monitor in a real field; Resend's own 3D cube between "Email for" and "developers."; black end. rAF: 57 fps, median 16.7 ms, 44 of 1775 frames over 33 ms (video seeks) | better: "keep this direction and push it further" |
| f13 | `data/freeform/resend-v13` (assets from v12) | v12 pushed with ref 3's own moves: a speed-ramp dive until the real sidebar fills the frame (3.4x), a log-space pull-back into the Broadcasts grid whose tiles show as soft blur before loading sharp; type slides at 72 px; in the light editor the cursor drags the AI-editor cover into a dashed upload slot and drops it; the end cube is Resend's 3D render inverted onto the light world (no black tile) with a glow; every clip decodes from Play (no mid-film starts or seeks). rAF on a machine at 100 % CPU (other sessions): 55.6 fps, median 16.7 ms | "push hard" |
| f14 | `data/freeform/resend-v14` (assets from v12, `snd/`) | the finish layers: Mixkit "Golden Storm" bed (product-safe, 127.6 BPM) with its drop on the pull-back; the owner's Style 1 sfx pack placed by map.json events (no synth beeps); every cut snapped to the beat by a piecewise time warp (speed changes only on cuts, 0.87–1.15×); frosted-glass Audiences card over night → day crossfade; the day sky carried under the light world's type. Score renders at load (peak -1.7 dBFS). rAF at 94 % CPU: 57.7 fps, median 16.7 ms, 30 frames over 33 ms | waiting |
| f15 | `data/freeform/resend-v15` (ref 4) | ref 4 rebuilt shot for shot in Resend stone (21 s): a three.js stack of six of Resend's emails (welcome, receipt, the real analytics, send.ts, shipped, digest) landing fanned with soft shadows, "Too many emails. / Too many tools."; a three.js desk (Resend-black laptop, lamp, cup) whose screen types "Every email, scattered?" over ghost words; tiny drift-in type on a light field ("Reaching every inbox / shouldn't feel like a chore."); a soft dark sweep, "meet" / "Resend."; a light burst, the real Metrics screen in glass pulls into focus and defocuses into a moving field; "Send your receipts / updates / launches"; "Everything tracked."; "All with"; the name out of scrambled letters. Mixkit "Close Up" bed (lift on the dashboard reveal), cuts on its beat. rAF (real GPU, CPU busy): 3D 52 / 37 fps, 2D 57 fps | waiting |
