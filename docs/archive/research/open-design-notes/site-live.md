# OpenDesign marketing site (open-design.ai), reverse engineered for Moovi

Area key: `site-live`. Captured 2026-10-17 (UTC 05:16 to 06:10). Everything here comes from the live site
(curl and REA over my own headless Chrome through CDP), plus a read-only look at the OD repo at 78d5637 and the
Moovi repo. Nothing from the OD clone was built or run.

Paths used below (all under the session scratchpad, `...\scratchpad\`):

- `site-raw/home.html`: home page as served (386,635 B raw, 91,701 B over the wire, brotli, h3).
- `site-raw/home.inline.js.txt`: the 11 inline `<script>` blocks, split out, **unminified on the live site**
  (3,130 lines). Line numbers below (`js:L`) refer to this file.
- `site-raw/home.pretty.css`: the single inline `<style>` (164,535 B minified), pretty-printed by me (9,404 lines).
  `css:L` refers to this file.
- `site-raw/home.nostyle.html`: home markup with style/script/svg removed, one tag per line. `html:L`.
- `site-raw/home.text.txt`: home copy in reading order.
- `site-raw/page_*.html`: 20 sub-pages (pricing, download, alternatives/claude-design, compare, solutions, showcase,
  plugins/templates, blog, official, faq, agents, llm-arena-for-design, solutions/ai-landing-page-generator,
  design-system, skills, craft, quickstart, enterprise, og, stories). `robots.txt`, `sitemap.xml`, `llms.txt`,
  `pricing.md`, `speculation.json`.
- `od-notes/shots/w1440-y<scrollY>.jpg`: 22 desktop screenshots at 1440x900; `od-notes/shots-mobile/w390-y*.jpg`:
  11 mobile screenshots at 390x844 (Android UA); `od-notes/shots-moovi/`: Moovi's live landing for comparison.
  Metrics JSON next to each set.
- `od-notes/site-rea-evidence.json`: REA evidence bundle with 4 records:
  `ev_872af9b9...` list_browser_targets, `ev_8711fda6...` inspect_web_page (scripts, resources, DOM 1,458 nodes),
  `ev_c7aac8d6...` analyze_web_bundle (chunk graph, endpoints, source maps), `ev_c733f88a...` capture_web_screenshot
  (`od-notes/site-rea-hero.png`).

## 0. Where the source is

- **Not in the Apache-2.0 repo.** `vercel.json` builds `apps/web` (the Next.js app). No `astro.config*` and no
  `.astro` file is tracked (git ls-files over 13,213 files). Distinctive live strings (`enhanceCapScrolly`,
  `blurTextIn`, `precise-bg-in`, `hero-workspace-v2`, "Collaborative Design Agent Workspace", `header-enhancer`)
  are absent from the repo (`git grep`).
- The live site is **Astro on Cloudflare Pages**: robots.txt names `astro.config.ts` and `@astrojs/sitemap`; the
  `/og/` page carries `data-astro-cid-*`; JS comments mention `_components/header-enhancer.astro`,
  "renderToStaticMarkup, no @astrojs/react" (js:2096-2100), Pages Functions `/subscribe` (js:2852-2865) and
  `/api/attribution/bridge/consume` (js:962). The measurement env classifier names the hosts:
  `open-design-landing-staging.pages.dev` and preview `*.open-design-landing.pages.dev` (js:462-471).
- **Licence consequence:** the site code is © Powerformer, Inc. and is not covered by the repo's Apache-2.0 grant
  (footer: "© 2026 Powerformer, Inc. · Apache-2.0" refers to the product). Treat everything below as mechanisms to
  re-implement, not code to port. The one porting candidate that *is* Apache-2.0 is the older in-repo template
  `design-templates/open-design-landing/` (SKILL.md, schema.ts, styles.css, scripts/compose.ts, scripts/imagegen.ts,
  assets/imagegen-prompts.md, image-manifest.json), which the SKILL.md calls "the canonical OpenDesign
  marketing-page recipe". Its section list (hero, about, capabilities, labs, method, work, testimonial, cta, footer)
  is still the live section taxonomy.
- Dogfooding detail: every live home section carries `data-od-id="<slug>"`, the same attribute the OD agent is told
  to put on generated sections (`apps/daemon/src/prompts/official-system.ts:51-53`, linted at
  `apps/daemon/src/lint-artifact.ts:449-461`). The site doubles the id as its analytics taxonomy (§9).

## 1. Tech stack

| Layer | What | Evidence |
|---|---|---|
| Framework | Astro SSG, zero client framework (React only at build via renderToStaticMarkup) | js:2096-2100, `/og/` cid attrs |
| Hosting/CDN | Cloudflare Pages; `server: cloudflare`, `cf-cache-status: HIT`, h3 | `home.headers` |
| HTML caching | `Cache-Control: public, max-age=0, s-maxage=60, must-revalidate` | `home.headers` |
| Asset caching | media served `max-age=0, must-revalidate` with unhashed names (weak point) | curl -I on mp4/webp |
| Speculation | `Speculation-Rules: "/cdn-cgi/speculation"` header → Cloudflare Speed Brain: prefetch, eagerness conservative, `href_matches: "/*"` | `speculation.json` |
| CSS | one inline `<style>`, 164.5 KB minified; 109 `@media` blocks; no dark mode (0 `prefers-color-scheme`) | css |
| JS | 11 inline classic scripts, unminified, ~155 KB raw, **zero external first-party JS** (a build gate "Verify zero external JavaScript" is mentioned at js:1441-1446); REA: 7 first-party scripts, no chunk graph, no routes, no source maps | REA `ev_c7aac8d6` |
| Animation libs | **none**. No GSAP, Lenis, Motion, three, Lottie, Rive. Vanilla IntersectionObserver + rAF + CSS keyframes/transitions | grep counts: gsap 0, lenis 0, three 0 |
| 3D/canvas | none on the page. WebGL is only used to read `UNMASKED_RENDERER_WEBGL` to tell Apple Silicon from Intel | js:1186-1192, js:2250-2258 |
| Video | 5 capability `<video>` (mp4, `preload="none"`, poster webp), 1 lab video (VP9 WebM preferred via `canPlayType`) | html:407-449, js:1806-1815 |
| Fonts | one variable font, Albert Sans (52,216 B woff2, preloaded) + italic + a 2.3 KB Remix Icon subset; all `--serif/--sans/--mono` vars point at Albert Sans | css:1-21, css:41-44 |
| Analytics | GA4 `G-2N1F3J61CX` (gtag, CTA click events), PostHog (`autocapture:false`, `capture_pageview/pageleave:true`, `disable_session_recording:true`, surveys.js + exception-autocapture loaded), Cloudflare Web Analytics beacon, custom measurement layer | js:293-335, js:340-816 |
| Experiments | `window.__odExperiment` hook with `observe/enrich/sdkReady`, and a `refresh()` path for "a registered experiment renderer may replace below-fold DOM"; the experiment block is empty in this build | js:752-754, js:732-741 |
| Live data | GitHub REST: `repos/nexu-io/open-design` (stars), `/contributors?per_page=1` (Link header last page = count), `/contributors?per_page=12` (wire), `/releases/latest` (version badge + installer asset) | js:1600-1663, js:1710, js:1223 |

## 2. Information architecture

- Header (`data-chrome-headroom`): Product ▾ (Agents, Tools, Codex Plugin, Solutions, Compare) · Arena · Pricing ·
  Resources ▾ (Templates, Systems, Skills, Quickstart, Tutorials, Blog, Stories) · Community ▾ (Showcase,
  Contributors, Ambassadors, Events) · centred logo · GitHub star pill (live count) · Download (dark pill).
  Dropdowns are pure CSS `:hover/:focus-within` (js:3027-3031).
- Sitemap index splits into 13 child sitemaps: agents, alternatives, blog, community, craft, design-system, plugins,
  showcase, skills, solutions, stories, tutorials, pages (`sitemap.xml`).
- Footer is a link hub: Explore (3), Solutions (8 incl. "AI wireframe/UI/prototype/landing page generator"),
  Agents (5 + all), Compare (14: Claude Design, Figma, Lovable, Bolt, v0, Framer, Google Stitch, Penpot, Cursor,
  Canva, Webflow, Replit, Uizard, Base44), Tools (6: HTML Anything, HTML Video, Design to code, Figma to code,
  Screenshot to code, HTML to PPT), Library, Learn, Community, Company, Get OpenDesign; 11-language switcher.
  (`home.text.txt` 201-286, shot `w1440-y14850.jpg`.)
- 11 locales (`en zh ja ko de fr ru es pt-br it tr`), hreflang + x-default on every page.

## 3. Home page, section by section (desktop 1440x900, document 15,657 px tall)

Section offsets measured live: hero 0/967 · about 967/3,494 · capabilities 4,462/5,050 · labs 9,512/1,092 ·
method 10,603/856 · pricing 11,459/421 · testimonial 11,880/59 · work 11,939/573 · customer-stories 12,512/981 ·
cta 13,492/584 · faq 14,076/714 · footer 14,790/867. About and capabilities together are 8,544 px: more than half
the page is two pinned scrollytelling sections.

0. **Campaign banner** (hidden outside its window). `data-campaign-start-at/end-at` ISO times; ticks every 250 ms;
   countdown text via `Intl.NumberFormat(..., {style:'unit', unit:'day'})` + `HH:MM:SS`; dismissal stored under
   `open-design:home-campaign-banner-dismissed:<campaign>`; toggles `html.home-campaign-banner-active` so the hero
   padding grows by `--home-campaign-banner-height`; exposure counted once at ≥50 % visible for ≥1 s; click mints
   a first-touch campaign id and rewrites the pricing URL with `od_entry_*` params (html:66-76, js:1244-1300,
   js:842-884).
1. **Hero** (`data-od-id="hero"`, html:208-242). Copy formula: category claim H1 ("The First Collaborative Design
   Agent Workspace"), one-sentence support naming the three pillars (one design system → brand everywhere; the agent
   you know; your team), two CTAs (primary "Download OpenDesign" with a green download disc and a sheen sweep;
   secondary "Join Discord" pale glass pill). Visual device: a rounded panel (8 px inset, ~24 px radius) filled with
   a **painted sky** and a **real product window** in front: left an agent chat log with honest timings ("Done 1m
   50s", "Success. Success. 56.1s"), right the canvas showing an old-master painting being turned into a site,
   with three **multiplayer cursors** labelled in acid green ("siry", "Hansi", "nike"). One WebP does all of it:
   `hero-workspace-v2-{960,1440,1920,2880}.webp`, `sizes="100vw"`, `fetchpriority="high"`, 2880x1910, 115,606 B at
   1440 (REA `ev_8711fda6`). It is the LCP (828 ms desktop, 1,060 ms mobile with the 960w file at 84,907 B).
   Motion: H1 words are `span.blur-word` with `--i:1..6`; when `[data-revealed]` lands, each runs `blurTextIn`
   .38 s `cubic-bezier(.23,1,.32,1)` with `animation-delay: i*35ms`; keyframes 0 % opacity 0, blur 10 px,
   translateY −50 px → 50 % opacity .5, blur 5 px, +5 px (overshoot) → 100 % rest (css:1913-1948). Siblings in
   `.hero-copy` get `--reveal-delay` 0/80/160/240/320/400 ms (css:6309-6326). Primary CTA: `hm-dl-sheen` 4.2 s loop
   (sheen crosses between 62 % and 82 % of the cycle) and `hm-dl-breathe` 2.8 s (a 7 px `#63fe1322` ring)
   (css:8039-8070). A scroll-driven "workspace expands to full width" script exists (js:3070-3130: width from
   `min(1080, .92vw)` to `vw − 64` with smoothstep over 75 % of the viewport, product kept 16:9 at .85 scale) but its
   `.hero-workspace-background` element is **not in this build** (0 matches), so it is a leftover of an earlier
   hero or an experiment arm.
   Mobile (shot `w390-y0.jpg`): title and sub sit dark on paper above the art card; the two CTAs overlap the top
   edge of the art card.
2. **About / "Four steps"** (html:243-378). Kicker "From Prompt to Prototype, With Your Team in the Loop", then a
   sticky statement `Four steps from idea to on-brand work.` split into `span.reveal-char` (aria-hidden; the h2
   keeps an `aria-label`). Scroll fill: target = clamp((scrollY − start) / distance), `distance` = host height −
   sticky height; current eases toward target with `1 − exp(−dt/80ms)` (dt capped at 64 ms); chars `< round(current·N)`
   get `.show`, which runs `about-text-fill-color` .5 s: dim (`ink 20 %`) → `#00ff08` at 30 % → ink (js:1742-1793,
   css:2523-2570). So each letter flashes green as it inks: a scrubbed, eased fill with a colour accent.
   Then a pinned 4-step tablist (radio inputs + labels, CSS `:checked` fallback). At ≥1200 px the scroll drives it
   1:1: panel k+1 translates from 100 % to 0 % over panel k with no CSS transition; the stack completes at
   `STACK_END = .85` of the range so the last panel dwells for the final 15 % before the pin releases; the range is
   measured with the **tallest** state (all radios checked in turn); the free space in the left rail transfers from
   the current step to the next as it rises; clicking a step smooth-scrolls to `i/(n−1)·.85` of the range + 1 px
   (js:2671-2797). Panels are WebP screenshots of the real app in painted frames (step 2 is a 300 KB WebP),
   lazy-swapped from a 1x1 SVG placeholder (html:353-368). A "Download" pill ends the rail.
3. **Capabilities / "See What You Can Make With OpenDesign"** (html:379-469, 5,050 px tall). Left: category buttons
   (Websites, App UI, Dashboards, Slides, Graphics) + "View All" pill to /showcase. Right: a **growing pile of real
   outputs**, 11 media (5 videos + 6 stills) across 5 frames. Per scroll frame (one rAF, one layout read):
   `progress = clamp(stickyTop − rect.top, 0, range)/range · (n−1)`; for media i: `reveal = clamp(progress − i + 1,
   0, 1)` drives `--cap-entry-scale` (the new card scales up from its centre from 0 to 1), `depth = clamp(progress − i,
   0, 4)` drives `--cap-depth-scale = 1 − .035·depth` and `--cap-depth-shift = −14px·depth` (older cards shrink and
   step back up to 4 levels). The pile's centre is re-blended between the old and the incoming bounding box so earlier
   cards never teleport (js:2458-2665, css:8848-8870). Each output sits on a painted canvas mat with ragged brush
   edges (shots `w1440-y5300.jpg`, `w1440-y7100.jpg`). Videos are `preload="none"` with posters and only play when
   all hold: not reduced-motion, tab visible, ≥15 % in view, frame is the active one, card revealed (js:2492-2514).
   Clicking a category jumps the scroll instantly to that stage. Mobile: no pin, categories switch in place.
4. **Labs / "Inside the OpenDesign App"** (html:470-544). Full-bleed painted backdrop (painterly-background
   1440/1920/2880), a dark "dock" of 4 feature tabs (Design Systems, Editing, Skills Community, Team Collaboration)
   with an icon + one plain paragraph each, and a white card floating the matching 2304x1296 still (53 KB WebP).
   Auto-advance every 10 s, restart from tile 1 each time the stage re-enters (IO threshold .3), pause on hover,
   off under reduced motion; arrows and "1 / 4" on mobile, native scroll-snap with a 120 ms settle to pick the nearest
   card (js:2282-2455). The whole enhancer waits for `__whenNear('.lab-stage')` (rootMargin `0 0 150% 0`) because its
   init preloads ~500 KB of stills (js:3038-3040). An older dock variant has proximity magnification: scale
   `1 + .08·max(0, 1 − |x − centre|/104px)` (js:1795-1888) and a slide carousel with
   `transform 560ms cubic-bezier(.23,1,.32,1)` that decodes the incoming image before sliding (js:1941-2038).
5. **Method / "Your Setup, Your Choice"** (html:545-776). Caption "Works with the coding agents you already use";
   a 70 s linear marquee of 21 agent chips (list duplicated, pause on hover/focus, reduced motion → horizontal scroll)
   (css:4516-4545). Then **three equal cards**: Local CLI, BYOK, Hosted, each with a painted header image, one
   sentence, three numbered plain facts (account needed?, what you must set up, who bills you), and a CTA ("Connect
   Your Coding Agent", "Set Up BYOK", "Compare OpenDesign Plans") (shot `w1440-y10700.jpg`).
6. **Pricing teaser** (html:778-808): Free / Plus, Pro, and Max / Team, one sentence each. The Free card's button is
   relabelled per platform from `data-download-label-{macos,windows,fallback}` ("Download for Windows" on my host;
   "Download OpenDesign" on mobile).
7. **Testimonial header + Work stats** (html:809-880). "Open Source / Built in Public Under Apache-2.0" + "Star us".
   Five painted stat cards with slight tilts (`--tilt` −1.2°…1.4°): GitHub Stars (live; card has a monthly trend
   sparkline whose `<title>` says missing months are interpolated from verified samples, snapshot 2026-09-24 ·
   97,852), Contributors (live), Plugins 458+, Design Systems 152+, Coding Agents 21. Count-up: 2 s, easeOutQuart
   `1 − (1 − t)^4`, triggered at `rootMargin 0 0 −8% 0`; the **final value is in the HTML** and the element is reset
   to `from` only at the moment it enters view, so a failed observer can never leave a 0 (js:2096-2164).
   Numbers are acid green on dark/painted cards (shot `w1440-y11500.jpg`).
8. **Customer stories** (html:881-952): 5 quote cards (3 + 2 grid), real names, roles, 40 px avatars, link to
   /stories.
9. **CTA** (html:953-974): full-bleed painted landscape, app icon, "Download OpenDesign." + "Built open. Run local.
   Connect freely. Design your way." Two buttons: Download (with detected-platform chip "· Windows" at 70 % opacity)
   and Star on GitHub.
10. **FAQ** (html:975+): 7 questions, `<details>` per item; on fine pointers at ≥881 px a mouse hover opens and
    closes the row (touch and keyboard keep native toggle) (js:2799-2815). Answers name limits plainly: "There is no
    Figma export", "your own API key generates designs but can't edit files in your project", "Turning a prototype
    into a production app is still engineering work", "Product analytics is on by default and can be turned off".
11. **Footer**: dark, big wordmark, socials, locale menu, the link hub (§2).

## 4. Motion system (numbers)

- Base reveal: `[data-reveal]` starts at opacity 0, `translate: 0 28px`; variants `left` (−36 px), `right` (36 px),
  `scale` (.96), `rise-lg` (64 px, .985); transition .9 s `cubic-bezier(.22,1,.36,1)` with `--reveal-delay`;
  IO threshold .12, rootMargin `0 0 −8% 0`, one-shot (css:6238-6262, js:3053-3064). Stagger tables: cards 90 ms,
  method steps 110 ms, partners 70 ms, hero copy 80 ms.
- Easing census (css): `cubic-bezier(.23,1,.32,1)` ×17 (house ease, an expo-out), `(.22,1,.36,1)` ×4 (reveals),
  `(.22,.61,.36,1)` ×2. Micro-interaction durations cluster at 160 ms (×32) and 180 ms (×30), then 220 ms.
- Loops: agent marquee 70 s, contributor wire `marquee-x` 52 s, contributor orbit 38 s (two rings, opposite),
  CTA sheen 4.2 s, CTA breathe 2.8 s, badge pulse 2.2 s, live dot pulse 2.4 s.
- No loader, no page transition, no smooth-scroll library. Native scroll everywhere; all scrubbing reads
  `getBoundingClientRect` once per rAF.
- Header: condense with hysteresis (on above 64 px, off below 24 px, rAF-throttled) and a liquid-glass SVG
  displacement map rebuilt 140 ms after the bar stops resizing (radius = h/2, border .07, lightness 50, alpha .93,
  blur 11, blend difference) (js:1497-1597). Nav fit: a hidden clone of the links is measured to decide
  `nav-icon-only` / `nav-compact` (js:2875-2951).
- Every motion path has a reduced-motion branch (13 CSS blocks, 9 JS checks).

## 5. Showing product output

Hero: one composite still of the real app mid-task. About: four real app screenshots in painted frames. Capabilities:
11 real outputs (5 looping mp4 with posters, `preload="none"`, played only when active and visible). Labs: 4 feature
stills, video variant WebM-first. Showcase page: 89 examples filterable by type, purpose, series and **the model that
made it**; each opens with layout notes and a "recreation prompt"; ImageGallery + ImageObject JSON-LD per item.
Weak points I measured: capability mp4s are big (website-primary 8.5 MB, slides-deco 5.0 MB) with no WebM, and all
five posters (~420 KB) load at start because `poster` ignores `preload="none"` (REA resources list).

## 6. Social proof

Live GitHub stars in the header pill and the stat card (static fallback 83.3K+, live 101.7K+), live contributors,
live release version, a contributor "wire" marquee of the top 12 committers + a final "@you · be next" item
(js:1666-1737), named customer quotes with avatars, a stars trend line with an honesty note. No logo wall.

## 7. CTAs and conversion path

- One primary action everywhere: Download. Placements are tagged `data-download-placement` = nav, hero, about,
  home_pricing, cta, so each is measured separately.
- Platform resolution: iPad (maxTouchPoints > 1 + Mac platform) and phones keep the neutral /download/ page;
  Windows → `win-x64-setup.exe`; Mac → `getHighEntropyValues(['architecture'])` first, WebGL renderer string
  second; undetermined arch shows no chip (no guessing) (js:2173-2276, js:1164-1240).
- Links get a direct asset URL at once (baked `directAssets` for v0.25.0), then the latest GitHub release asset.
  On click, a POST to `download.open-design.ai/api/attribution/mint` returns a tracked download URL (falls back to
  the raw href) (js:915-953).
- First-touch attribution cookie `od_attr` (utm + external referrer + landing path, 30 days, apex domain so
  `/cloud/*` checkout can read it) (js:1105-1158); a desktop-app → web bridge token `od_bridge` identifies the
  installation in PostHog (js:955-978).
- Header probes a Cloud session (`/api/auth/get-session`, credentials included) and swaps in an avatar menu for
  signed-in visitors (js:2957-3026).
- Newsletter form posts to `/subscribe` and shows an inline error on failure: comment says "no silent fake-success"
  (js:2817-2868).

## 8. SEO strategy

- Home title "OpenDesign — Best Open Source Claude Design Alternative"; description stacks the category terms
  ("Open-source vibe design workspace & Claude Design alternative — build prototypes, landing pages, dashboards,
  slides & HTML video with your own coding agent.").
- Home JSON-LD `@graph`: WebSite (alternateName ×6 spellings), Organization (sameAs GitHub, releases, Discord,
  /official/), SoftwareApplication (applicationCategory DesignApplication, OS, licence, softwareVersion v0.25.0,
  downloadUrl, installUrl, offers price 0) (js:1162).
- Per-page schema: FAQPage on alternatives/compare/agents/templates/solutions; HowTo on quickstart; Product on
  pricing; CollectionPage + ItemList on hubs; ImageGallery with ~100 ImageObject on showcase; BreadcrumbList almost
  everywhere.
- Page title formulas: "Open-Source Claude Design Alternative — OpenDesign (BYOK, Local-First)"; "OpenDesign vs 19 AI
  Design Tools | Honest Alternatives"; "AI Landing Page Generator — prompt to a landing page you ship"; "Design
  Skills for Claude Code & Codex: PPT, UI, Frontend"; "OpenDesign quickstart — Install in three commands (Node 24,
  pnpm)". Numbers in titles (19 tools, 22 agents, 138 skills, 278 systems, 11 principles).
- Alternative page formula (`page_alternatives_claude-design.html`): breadcrumb "X vs OpenDesign" → H1 → one-line
  short answer → 3 intent-routing cards (choosing / already on X / different question) → in-page TOC → "What each
  tool is" (Runs / Agent / Output / Cost rows) → "What this page does not claim" → verdict by situation ("Pick X
  if…", "Pick OpenDesign if…", "Run both if…") → "Same brief, two results" with a fully specified brief (brand,
  breakpoints, edit test, what to record) and an explicit "illustrations, not screenshots" note → 9-dimension
  table "checked 2026-09-06", "pricing tiers deliberately not stated" → decision → move or coexist → 20-minute test
  → other options → FAQ.
- `llms.txt`: canonical identity, every alias spelling, "official open-source alternative to Claude Design",
  entry points, comparison and solution URLs, key blog posts, citation guidance ("do not cite preview deploys…").
  `pricing.md`: machine-readable pricing (stale against the live pricing page, which now has a "Go" plan).
  `/official/` page exists to disambiguate aliases. RSS at /blog/rss.xml.
- OG image: a dated PNG (`og-homepage-20261009.png`, 1200x630); an `/og/` HTML route (1200x630, noindex, crop
  marks, grid paper, lime highlighter under "your brand.") is the screenshot surface; robots.txt disallows `/og/`.
- Arena page (`/llm-arena-for-design/`): 19 models scored on a private benchmark, score/100 split 70 design quality
  + 30 requirement fulfilment, cost per artifact and minutes; "Choose by preference" weights (Balanced 50/30/20),
  a "best value" headline ("91 % of the top score at 5 % of its cost"), per-scenario picks.

## 9. Measurement layer (homepage-path-v1)

Inline, ~400 lines (js:359-751). Every `section[data-od-id]`, CTA and marked block is observed. Exposure =
**≥50 % visible (intersecting clipping ancestors, not just the viewport) for ≥1,000 ms**, scanned every 250 ms
only for blocks near the viewport. Also: `homepage_module_reached` on first pixel, `homepage_boundary_reached` for
`initial_viewport` (first scroll >2 px) and `hero_end`, a stage label on every event (initial_viewport_only /
below_initial_viewport / after_hero / unknown with a reason such as restored_scroll, layout_changed,
viewport_changed, bfcache_restore), click → destination matching via sessionStorage (`od.homepage-navigation.v1`,
10-min TTL, last 20, matched on path + referrer, ambiguous stays unknown), `page_exit` with geometry. Every event is
enriched with build id, content hash, page instance id, sequence number, viewport, locale, environment.

## 10. Performance (measured with my CDP script, warm-ish cache)

- OD desktop: TTFB 384 ms, DCL 869 ms, FCP = LCP 828 ms (hero WebP), 91.7 KB HTML transfer. Mobile 390x844: FCP =
  LCP 1,060 ms (960w WebP, 84.9 KB).
- Deferral tactics: `img[data-precise-src]` with a 1x1 SVG placeholder and IO rootMargin 600 px; background images
  gated behind `.precise-bg-in` so off-screen `::before` backdrops do not fetch; `video[data-precise-load]`;
  `__whenNear(selector, cb, '0 0 150% 0')` for heavy enhancers; lab clip prefetch only within one viewport; a
  MutationObserver attaches late nodes (js:1304-1460, js:1827-1852).
- Moovi live landing for comparison (same script, 1440x900): FCP = LCP 1,580 ms (LCP is the `p.hero2__hi` text
  behind the intro), 24 requests, ~675 KB transferred, three preloaded font files of 150 KB + 121 KB + 25 KB,
  document 28,887 px tall (32 screens). No robots.txt, sitemap.xml or llms.txt (all 404), no canonical, no
  og:image, no JSON-LD, `metadataBase` is `https://moovi.example` (apps/landing/src/app/layout.tsx), the only H1 is
  a screen-reader "Moovi". In headless Chrome (software GL) the intro was still holding at 6 s ("MOOVI IS GETTING
  READY"), consistent with `MAX_HOLD = 8` s in `apps/landing/src/components/motion/Intro.tsx`.

## 11. Art direction

- Neutral greys (`--paper #fafafa`, `--ink #262626`, lines `#d9d9d9`) + **one acid accent** `#63fe13` (named
  `--coral` for legacy reasons) used only for live/active things: cursor labels, stat numbers, the trend line, the
  download disc, the letter flash (`#00ff08`).
- A fixed full-page grain: `body::before` with two soft radial gradients + an SVG `feTurbulence` fractal noise tile
  (baseFrequency .85, 2 octaves, alpha .035), 240 px tile, `mix-blend-mode: multiply`, opacity .62, z-index 3,
  pointer-events none (css:100-110).
- Painterly oil landscapes (sky, meadow, water) as the "world": the hero panel, about frames, capability mats,
  labs stage, method card headers, stat cards and the CTA all use them. Product UI is always shown inside that
  world, never on flat SaaS gradients. theme-color `#efe7d2` (warm paper).
- One typeface (Albert Sans 800 for display, 400-600 for body), Title Case headings, short declaratives.
- The in-repo Apache-2.0 template shows how they made art at scale: a **style anchor** prepended to every image
  prompt + brand variables + per-slot composition, slot sizes in `image-manifest.json`, and three strategies
  (placeholder SVG frames, generate via gpt-image-2 at ~$0.40 / ~6 min for 16 slots, bring-your-own)
  (`design-templates/open-design-landing/SKILL.md:78-91,117,183-215`, `assets/imagegen-prompts.md:1-60`).

## 12. What would make Moovi's landing dramatically better (section by section)

Moovi already has the premium layer OD lacks (intro, Lenis, GSAP scrubbed chapters, page transition, fill text,
a live 3D character, a real brief box that hands off to the studio). Its gaps are the things OD is strong at:
proof, paths, findability and measurement.

1. **Hero (Hero.tsx).** Keep Moovi holding the brief box. Make the visible line the H1 ("The AI video director you
   hire", Moovi's voice), not a hidden "Moovi". Add a proof object in the same world: a phone-shaped frame in
   Moovi's ice glass playing a real film made by Moovi, with crew name tags working on it (the stage already projects
   crew tags) and an honest stamp from the measured numbers in CLAUDE.md ("Live preview in 27.7 s, Auto style, Groq
   free tier"). Word entry: OD's 35 ms per-word blur-rise is the pattern; Moovi's `splitMasked` chars already do this
   on scroll.
2. **First paint.** Make the LCP a pre-rendered still of Moovi (same idea as `halo.webp`, a render of the real SDF,
   not a GLB) with `fetchpriority=high` and `srcset`, cross-fade to WebGL on `w.ready`, and cut `MAX_HOLD` so the
   intro never holds the page for seconds. Trim fonts (Fraunces with three axes is 150 KB; preload only the face the
   first screen uses).
3. **Styles chapter (Styles.tsx).** Replace words-only cards with the real films, stacked like OD's capability
   pile: each style's film card scales in from its centre as you scroll, earlier ones recede (scale 1 − .035·depth,
   −14 px·depth, depth ≤ 4); only the active, visible card plays; posters first, live preview iframes mounted only
   near the viewport. Every card links to "make one like this" (prefills the brief box).
4. **New chapter "Your model, your choice".** Three equal cards like OD's method section: No key (the server model,
   Groq), Your key (Gemini, Groq, OpenAI, Anthropic, OpenRouter, sealed with AES-256-GCM), Local (Ollama where
   OLLAMA_HOST is set), each with three plain facts (account needed, setup, who pays) and its CTA. This is the "any
   model, equal quality" pillar made concrete.
5. **Proof numbers.** Counters read live from FalkorDB through a public named query (films made, library assets,
   set-ups per style), baked into the HTML at build as fallback, rolled up only on entering view.
6. **Finale.** Primary CTA "Open the studio" / session-aware "Back to your studio"; drop or persist the waitlist
   (today `/api/waitlist` acknowledges without storing).
7. **FAQ** with honest limits and FAQPage schema.
8. **Findability**: robots, sitemap, llms.txt, JSON-LD, real metadataBase, OG route, then a film gallery, a model
   bench page and honest "vs" pages.
9. **Measurement**: chapter reach and effective views, because the page is 32 screens tall.
