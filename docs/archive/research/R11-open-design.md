# OpenDesign: how it works, and what Moovi should take

Owner: Claude (Ishaan's session) · 2026-10-17. Status: done. Method: the Apache-2.0 source
([nexu-io/open-design](https://github.com/nexu-io/open-design), commit 78d5637, 2026-10-16) read by seven agents, plus
REA (CDP capture, static bundle analysis) and the browser on the live site, which is not in the repo. An eighth agent
mapped Moovi's site, studio and director. The key claims were then checked against both codebases by hand (table at the
end). No sign-in, no forms, nothing installed or run from their repo. The detailed notes, with file:line references,
are in [`open-design-notes/`](open-design-notes/).

## Summary for Ishaan

OpenDesign (OD) is a design agent workspace ("open-source Claude Design"), not a video tool. Its videos come from
**HyperFrames**: a film is one HTML file with timed clips and one paused GSAP timeline. A renderer seeks it frame by
frame in Chromium and encodes the frames with FFmpeg. That is very close to what Moovi already does with live canvas
previews.

Their edge is **not a secret algorithm**. It's discipline, written down and enforced in code:

1. **Direction before motion.** Each film gets a premise, one recurring motif and a beat map in seconds (time, what the
   viewer takes away, the focal object, how it changes, copy, exit). The direction is inferred, stated in one line,
   and picked from a closed library, not invented as free hex colours.
2. **Taste as numbers and bans.** Fixed timing bands (accent 120–220 ms, arrival 350–650 ms, big moves 900–1800 ms),
   one primary transition for 60–70 % of cuts, frame-fill rules, a banned-pattern list. Some styles have "grammar
   cards" with measured numbers: a pulse camera (punch 0.28 s, then still), paper elements stepped at 12 fps.
3. **Code checks first, a small bounded review second.** Deterministic lints (anti-slop P0/P1, contrast measured on
   rendered pixels, an animation map for dead zones and collisions, brand lint). Then one review of at most 3 frames
   and at most 1 targeted repair. Preview ships first, and review never blocks delivery. They **retired** their
   five-persona LLM jury (`CRITIQUE_THEATER_RETIRED = true`). One model grading itself in five voices did not earn
   its cost.
4. **Brand measured, not guessed.** From a URL they score colours from computed styles and CSS (theme-color +60,
   body bg +40, logo SVG weighted), name semantic tokens and inject them as a binding contract. No LLM in that step.
5. **Memory as checkable rules.** Feedback becomes `Assertion / Check / Verified by`, and code parses a per-rule
   pass/fail scorecard on every run.

Their website wins on **proof and findability, not motion**. Moovi's landing motion is already ahead (Lenis, GSAP film
chapters, a live 3D Moovi). OD shows real outputs in a scroll-scrubbed pile, puts the product in the hero with real
timings, uses live GitHub counters, and runs a full SEO system ("Best Open Source X Alternative" pages, JSON-LD, split
sitemaps, llms.txt, 11 locales).

**The three moves that matter most:**
- A bounded verify-then-fix pass on the default path. Today the default live path has none (the Lens step runs only on
  the crew path), and this is the #1 gap in both this review and the Cardboard review.
- Direction stated and chosen from a library instead of regex routing.
- A landing that shows real Moovi films and fixes its SEO basics. `metadataBase` is still `https://moovi.example`, and
  there is no robots file, sitemap or OG image.

## What was looked at

| Surface | Result |
|---|---|
| OD repo, 13,213 files: `apps/daemon` (prompt composer, critique, memory, brands, media), `apps/web`, `design-templates/hyperframes`, 171 skills, 58 video prompt templates, `plugins/_official` (video templates, scenarios, atoms), 154 design systems, `craft/*.md`, `clipper/` | read by 7 agents (812 tool calls) |
| open-design.ai (Astro on Cloudflare Pages; source not in the repo) | REA capture in headless Chrome 155, bundle analysis, screenshots at 1440 and 375, robots/sitemap/llms.txt, pricing, alternatives and showcase pages |
| Moovi: `apps/landing`, live moovi-three.vercel.app, `apps/studio`, `packages/engine` director/router/styles | read by 1 agent, gaps spot-checked by hand |

Not observed: OD Cloud (needs an account), the desktop app's runtime, and any paid model output.

## How OpenDesign works

### The directing brain
- **Prompt layers with fixed precedence.** Stable parts come first (house rules, craft slugs, the design system as
  data), then the scenario, then the user's memory rules last, as a rubric. Catalogues go in as a shortlist plus an
  index the model can pull from, never whole (`apps/daemon/src/prompts/system.ts`).
- **Route inference.** The hidden default scenario infers the task type. It asks only when two routes are materially
  plausible, with its own pick preselected. The direction picker goes design system → user's brand → inference, and
  the chosen direction is said in one sentence so the user can redirect cheaply.
- **Art direction before motion** (`skills/motion-design`): defaults of 12–18 s at 30 fps, a beat map with one line per
  beat, and one recurring motif linking the beats.
- **Craft as shared rules** (`craft/anti-ai-slop.md`, `animation-discipline.md`, typography, colour), injected into
  every prompt by slug. The rules use numbers and bans, not adjectives.

### Quality control
- **Deterministic first.** An anti-slop linter with P0/P1/P2 findings, fix text and a snippet, fed back as one block.
- **Bounded video review** (`od-next-strategy/.../core-system-prompt.md:122-137`): one review of source plus MP4,
  covering clock and size, captions against invariants frozen at plan time, and at most 3 frames viewed (opening, key
  moment, end). At most one targeted repair, then recheck only the affected frames. If it's still wrong, they report
  the limitation instead of certifying it.
- **Code decides, not the model** (`critique/scoreboard.ts:27-56`). The model gives scores and must-fix items; code
  computes the composite and ships only if composite ≥ threshold and must-fix = 0. If no round passes, they ship the
  best round.
- **What they dropped:** the same-model five-persona jury. It leaked its markup into chat and added cost without an
  independent eye.

### The motion engine (HyperFrames)
- **Composition.** Each clip has `data-start`/`data-duration`/`data-track-index`. One paused timeline sits in
  `window.__timelines` and is the only clock. Animation is entrance-only, and transitions handle the exits.
- **Rendering.** A seek bridge, then for each frame: `seek(i/fps)` → wait for media, LUTs and two rAFs → CDP
  screenshot → FFmpeg (libx264). Audio tracks are stripped from the page and mixed by FFmpeg with per-track fades.
- **Measured grammar cards** (vendored `huashu-art-motion`):
  - A pulse camera: `MO.PULSE` punch 0.28 s, pan 0.30 s, slam 0.17 s, and still during holds.
  - "On twos": `MO.step` quantises paper elements to 12 fps while the camera stays smooth.
  - The card's most common mistake is moving everything at a silky 60 fps.
- **QA tools.** An animation map (dead zones, collisions, stagger drift), WCAG contrast measured on rendered frames,
  and a seam gate for match cuts (SSIM ≥ 0.97).

### The video templates
- **Beat maps fixed in seconds per type:**

  | Type | Beats |
  |---|---|
  | SaaS promo, 30 s | 4 × ~7 s, CTA at 25.5 s |
  | Sizzle, 30 s | 5 × ~6 s, inner cuts every ~2 s |
  | Website promo, 15 s | 3 × 5 s |

- **Shared laws.** The hook lands by 2–2.5 s, and the first motion starts 0.1–0.3 s in. The end card is 15–25 % of the
  film, with the CTA 2.3–3.2 s after it starts. One idea per scene, headlines at least 60 px.
- **Generated-shot prompts** (Seedance, Kling, Veo): time-coded micro-beats, one camera-system line, technical
  direction and negatives.
- **Mostly stubs.** Most fal, Venice and music skills are catalogue entries; music generation isn't wired in.

### Brand capture
- **Clipper** (`clipper/brand-capture.js`): scans up to 1,400 visible elements and scores each colour by role and area.
  It keeps up to 12 colours that are at least 44 apart in RGB distance and derives roles by WCAG luminance.
- **Server side** (`apps/daemon/src/brands/prefetch.ts`): parses CSS (inline, up to 6 sheets), records where each colour
  came from, weights logo-SVG colours and boosts brand-ish variable names.
- **Contract.** A schema with 7 colour roles plus type, logo, voice, imagery and layout. It is injected as a contract
  the model must not deviate from, then a brand lint runs after rendering.

### Product and growth
- **After a delivery:** three next-step suggestions written by the model that fill the composer without sending, and
  pinned comments on the live preview, sent back as structured edits.
- **Before the first run:** pressing Send on an empty box runs the example shown, and first run asks "where does the
  AI come from" before anything else.
- **Sharing:** a public share page with "Built with OpenDesign" attribution.
- **Distribution:** a release rhythm as marketing (codename, PR count, contributors), a stars campaign, 14 README
  languages, honest "alternative to X" pages, and a model Arena that doubles as SEO.

## The promo experiment (done today)

Ishaan asked for a quick test of their "website to video promo" recipe on our own site. I built it by hand in their
format, at `open-design-notes/promo/promo.html`:
- 15 s, three scenes: desktop, then a tilted tablet, then a phone with a tap and the Moovi outro.
- A flash cut and a radial-split transition.
- Brand tokens only, one paused GSAP timeline.
- Captures taken with Playwright after the intro (`cap.cjs`); frames checked by seeking (`frames.cjs`).

**Verdict: cheap, but not a headline feature.** It took about 15 minutes and looks clean. But a screenshot sizzle is
only as good as the site it shows. One capture (the "any video generator" chapter) is a grey, mid-transition frame,
and it shows a site, not a film. It's worth adding later as a small URL-in style, "Site trio". The real value for
Moovi is the format itself: one HTML file, one paused clock, seek-to-render. Our live previews can adopt that clock
contract so the same preview renders to MP4 with no second code path.

## The plan, ranked

Effort: S under half a day, M one to two days, L more. Owners follow CLAUDE.md: Vignesh has feedback memory, the
style router, voice and the visual renderer; Ishaan has styles, studio, site and deploy.

### Films (biggest lever)

| # | Move | From OD | Moovi files | Effort | Owner |
|---|---|---|---|---|---|
| 1 | **Bounded verify-then-fix on the default live path.** Deterministic checks on the beat plan and on frames sampled from the live preview (contrast on pixels, empty frame / frame-fill, text overflow, brand colours, caption vs script). Then at most 3 frames to the model, at most 1 targeted repair of the failing beat, ship best; never blocks the preview. Show a "checked 3 frames · fixed 1" chip. | CL-02/03/04/07/08, ME-03/04, PUX-07 | new `engine/src/review/`; hook after the style build in `router/job.ts`; chip in `apps/studio` | M | Ishaan |
| 2 | **Direction stated, chosen from a library.** Replace the regex `urlStyleFor`/`autoStyleFor` (`router/job.ts:56-78`) with a small model call that returns `{style, premise, motif, why}`, constrained to the style list. Say it in one line in chat ("Dark Vox, a founder's story, the motif is a paper boat"). Fall back to the regex on small models. | DB-03/05/10 | `router/job.ts`, `router/route.ts` | S–M | Vignesh (router) |
| 3 | **Beat maps in seconds.** Hook by 2–2.5 s, first motion at 0.1–0.3 s, end card 15–25 % of the film with the CTA 2.3–3.2 s in, one idea per beat. Write these as lints on the plan, not as prompt prose. | VT1/3/7/9, ME-08 | style planners in `engine/src/styles/*` | S | Ishaan |
| 4 | **Transition grammar.** One primary transition for 60–70 % of cuts plus 1–2 accents, cast by energy and position in the story. | VT4, ME-07 | styles, `library` transition picks | S | Ishaan |
| 5 | **Frame-fill law for Anatomy:** 3 layers, 2 focal points, 2–5 ambient decoratives. This fixes the "near-empty frames" open item. | VT5 | `engine/src/styles/anatomy*` | S | Ishaan |
| 6 | **Pulse camera and on-twos for the paper styles** (Dark Vox): camera punches then holds still, paper elements step at 12 fps, static paper texture (we redraw grain every frame, `darkvox/player.ts:7`). **Ishaan's call:** this contradicts ishaan-motion law 3 ("camera is never still"). A/B it with the blind judge first. | ME-01/02/05 | `engine/src/darkvox/player.ts`, `.claude/skills/ishaan-motion` | S | Ishaan |
| 7 | **Measure-first brand from the URL.** Score colours from the site's CSS and computed styles (no LLM), store a `(:Brand)` node with roles and provenance in FalkorDB, and inject it as a contract. Brand lint in step 1. | BD-01/02/03/05/06/07 | research/footage intake, `packages/graph` (new named queries) | M | Ishaan |
| 8 | **One clock contract for previews**, so any live preview can seek-render to MP4 (HyperFrames' seek → settle → screenshot loop). | ME-10/22 | `engine/src/runtime`, players | M | Vignesh (renderer) |

### Director memory

| # | Move | From OD | Moovi files | Effort | Owner |
|---|---|---|---|---|---|
| 9 | **Feedback as checkable rules.** Keeper writes `Assertion / Check / Verified by` instead of free text, and code checks a per-rule scorecard each run. Also read memory on the Auto path, which ignores it today. | DB-01/02, CL-12 | `engine/src/tasks/keeper.ts`, `packages/graph` | M | Vignesh |
| 10 | **Chat edits that work on live previews.** `startEdit` (`engine/src/talk.ts:134-175`) only handles crew task kinds; style and combined reels get the change dropped. Patch the failing beat, don't regenerate. | CL-07 | `engine/src/talk.ts`, `VideoPopup.tsx` (Tweak is hidden for live) | M | Ishaan |

### Studio

| # | Move | From OD | Effort |
|---|---|---|---|
| 11 | Three next-step suggestions after each film that fill the composer (not auto-send) | PUX-02 | S |
| 12 | An empty Send runs the example brief shown in the placeholder; first run asks "your key or ours" before anything else | PUX-03/04 | S |
| 13 | Pin a comment on a frame of the live preview and send it as a structured edit | PUX-06 | M |
| 14 | A public share page per film with "Made with Moovi", plus versions that keep the prompt that made them | PUX-01/09 | M |

### Website

| # | Move | From OD | Effort |
|---|---|---|---|
| 15 | **SEO basics:** a real `metadataBase` (`apps/landing/src/app/layout.tsx:24`), `robots.ts`, `sitemap.ts`, an OG image route, JSON-LD, `llms.txt` | site-05 | S |
| 16 | **Content first:** don't hold the page behind the intro (up to 8 s today; a headless capture stalls at "Moovi is getting ready"). Paint the hero at once and play the intro over it. | site-07 | S |
| 17 | **Real films as proof:** a scroll-scrubbed pile of curated live previews (depth scale 1 − 0.035·d, lift 14 px·d, play only the active and visible card), including one "same link, two films" card for styles-not-templates | site-01 | M |
| 18 | **Hero:** a visible H1, words blurring in at 35 ms each, and a 9:16 glass frame playing a real Moovi film with the crew's real timings | site-02 | S–M |
| 19 | **"Your model, your choice":** three equal paths (your key / our server / local Ollama) with plain facts, plus our measured seconds-to-preview per style as an honest mini-arena | site-03/04 | S |
| 20 | Live counters from the graph (assets, set-ups, films made), with static fallbacks; per-section view tracking | site-08/09 | S |

### Don't copy
- The five-persona self-judging jury. OD retired it, and our blind-judge ratchet is already better because the judge
  is independent.
- The `until` dev-loop scaffolding (CL-19).
- Their fal, Venice and music skill catalogue: mostly stubs.
- Their role-timed choreography. We land elements on spoken words, which is better.

## Item 1 built: the review (2026-10-17)

`packages/engine/src/review/` runs after every live style reel (`tasks/reel.ts`). It starts once the preview is
already playing, has a hard 60 s deadline, and can never fail the film. `MOOVI_REVIEW=0` turns it off.

- **Plan lints** (`review/plan.ts`, no browser), all on `film.json`:
  - a late hook (opening beat over 4 s)
  - a dead beat (over 6.5 s on one set-up, end card exempt)
  - the same set-up back to back
  - an end card outside 8–30 % of the film
  - caption coverage of `script.txt`, only for the word-captioned styles (Clear Signal, Anatomy)
- **Frame checks** (`review/frames.ts`): one still per beat, from the player's own seek, at the contact sheets' sample
  time. On each still:
  - the player's own "anything on screen" hook
  - text boxes cut by the frame edge, graded by effective opacity
  - ffmpeg edge density
- **Output:** `review.json` beside `film.json`, plus a Lens note in chat that the studio draws as a chip ("Checked" or
  "N to fix", issues on expand).

Calibration on the 6 films on this PC (`scripts/review.ts`, warm runs 5–26 s each, most of it Chromium start-up):

| Finding | How it's graded, and why |
|---|---|
| "Near-empty" (edge share under 0.012) | **P2 lead**, not a fault. It flagged a designed minimal Style 4 frame (a blimp and two words) and the Dark Vox end card. Edge density can't tell minimal from broken, and end cards are exempt. |
| Text cut by the frame | **P0** only at effective opacity over 0.6. Clear Signal slides its spoken line left and dims earlier words, so a dimmed word leaving the frame is a P2. |
| Caption gap | **Off for Dark Vox and Style 4**, which set key words only by design (Dark Vox showed 13 % coverage on purpose). |

After calibration: 0 P0, 2 dead beats (Anatomy's print-plan, 6.5 and 6.9 s), 1 late hook (Anatomy figma-com, 5.6 s)
and 9 leads.

**Live job, end to end** (`scripts/run.ts`, a plain story brief → Auto → Dark Vox, on the server model with
`MOOVI_BYOK=optional` as production runs):
- The preview was ready at 43 s, the sheet at 59 s, and the review at 65 s (6.2 s), posted as a Lens note in chat.
- It flagged one P0, the number-odometer's digits, which was a false positive: the digits roll behind the counter's
  own clipping window. The check now measures only the part of a text box that its clipping ancestors let through.
- After that fix, a re-run over all 7 films gives 0 P0, warm runs 3–7 s.

**Not built yet, on purpose:**
- **The one targeted repair.** No film here has a P0, and the P1s found are voice-timed, so a data edit would break
  sync. Build it once real runs on the server have collected `review.json` files that show which defect is common.
- **The ≤ 3-frame model look.** It needs a vision runtime, and the server's Groq model has none.

## Verification

Checked by hand in source after the agents reported:

| Claim | Where | Result |
|---|---|---|
| Critique jury retired | `apps/daemon/src/critique/rollout.ts:104-107` | confirmed |
| Ship = composite ≥ threshold and must-fix = 0, computed in code | `apps/daemon/src/critique/scoreboard.ts:27-56` | confirmed |
| One review, ≤ 3 frames, ≤ 1 repair | `plugins/_official/scenarios/od-next-strategy/assets/core-system-prompt.md:122-137` | confirmed |
| Assertion/Check rules plus a parsed scorecard | `apps/daemon/src/memory-rules.ts:63`, `memory-verify.ts:82-107` | confirmed |
| Clipper: 1,400 elements, theme-color +60, 12 distinct colours | `clipper/brand-capture.js:10,276,325,354` | confirmed |
| Pulse camera and on-twos numbers | `skills/huashu-art-motion/references/canvas-helpers.md:845,918` | confirmed |
| Next steps capped at 3 | `packages/contracts/src/api/next-step-marker.ts:75` | confirmed |
| Moovi Auto routing is keyword regex | `packages/engine/src/router/job.ts:56-78` | confirmed |
| Moovi live-reel edits drop the feedback | `packages/engine/src/talk.ts:134-175` (the notes say `tasks/talk.ts`; the right path is this one) | consistent with code; not run end to end |
| Landing SEO gaps | `apps/landing/src/app/layout.tsx:24`; no robots/sitemap/OG files | confirmed |

The other ~130 findings were not each re-checked. Each carries an evidence type in the notes (`source`,
`live-observation`, `docs-claim`, `inference`); treat `docs-claim` and `inference` as leads, not facts.

## Licence

OD is Apache-2.0. Code may be ported with the licence and a NOTICE credit. The notes name the files worth porting
(`port_candidate`), for example the brand colour scorer and the next-step marker parser. The promo here is our own code
in their format. Their marketing site is not in the repo and isn't licensed, so we re-implement its ideas and copy
nothing from it.
