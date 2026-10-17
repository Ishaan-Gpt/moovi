# OpenDesign: brand capture and design systems (area key: brand-designsystems)

Source: OpenDesign (OD) at commit 78d5637, cloned read-only. All OD paths are relative to the OD repo root.
All Moovi paths are relative to `C:\Ishaan GPT\hackthons\moovi`. Nothing was installed, built or run from OD.
Evidence labels: SOURCE = I read the implementing code/prompt; DOCS = a doc says so, no code found; INFER = my reading.

---

## 0. One-paragraph answer

OD keeps output on-brand with four stacked mechanisms. (1) **Measure, never guess**: a URL is harvested
deterministically (regex over HTML plus up to 6 linked stylesheets, or computed styles in a live DOM in the Chrome
clipper), colours are counted with provenance (which CSS variable, property, selector, or logo SVG they came from),
then scored into seven semantic roles by fixed thresholds. A usable brand is registered in seconds with no LLM; an
agent then enriches it in place. (2) **One compiled contract**: every brand compiles to a single `:root {}` block of
~56 shared semantic tokens with a layered schema (required identity tokens, defaulted tokens, alias slots,
allow-listed extensions). Every artifact must paste that block verbatim and reference `var(--*)` only. (3)
**Injection with precedence**: the system prompt carries USAGE.md, DESIGN.md as "authoritative", then tokens.css as
"the binding contract", component inventory, and craft rules, and it removes the generic direction library when a
brand is active. (4) **Post-checks**: a greppy anti-slop linter (raw hex outside `:root` >12, `var(--accent)` used
inline >6 times, default AI indigo), brand rules written into memory and checked by an enforced self-verify
scorecard, a critique panel with a dedicated BRAND scorer, repo guards that fail on token drift between files, and a
sha256 digest of the exact design-system context on every run for attribution. "Drift tracking" in OD means this
digest and guards. The `design-system-tracking-spec.md` is an analytics spec (funnel events), not visual drift.

What Moovi does today (read-only check): `packages/engine/src/styles/common.ts:227-238` `readSite` regexes 6-digit hex
out of the raw HTML only (no linked CSS, no rgb()/hsl()/3-digit, no CSS variables in external sheets), keeps the top
12 by count, and the brief prompt (`packages/engine/src/styles/kit/script.ts:154`) asks the LLM to return **one**
`color`. Every style then builds its whole world from that one hex (`s1fast/theme.ts:26`, `s4/world.ts:30`,
`darkvox/film.ts:54`). Fonts come from a fixed list (`s1fast/theme.ts` `FONTS`), the logo only exists in Style 1
(`s1fast/logo.ts`), site imagery is only used as screenshots, and the graph has only `(:Site {host})`
(`packages/graph/src/queries/styles.ts:34-39`). S4 already noticed colour drift ("a model's colour guess can drift
between films", `styles/s4.ts:98-101`) and pins the first hex per host in a JSON file. The router's director picks
"one hex colour that suits the topic" (`router/film.ts:71`) and hardcodes secondary/tertiary (`router/film.ts:198`).

---

## 1. The design-system package format (151 bundled brands)

### 1.1 Files and manifest
`docs/design-systems.md:10-89`, `design-systems/_schema/AGENTS.md`, `design-systems/_schema/manifest.schema.ts`.

```
design-systems/<slug>/
  manifest.json            schemaVersion "od-design-system-project/v1", id, name, category, description, source{type},
                           files{design,tokens,designTokens,tailwind,components}, usage, componentsManifest,
                           importMode normalized|hybrid|verbatim, craft{applies,suggested,exemptions},
                           preview{dir,pages[{path,role,title}]}, sourceFiles{evidence,tokens,report}
  DESIGN.md                prose for agents (guard: >= 7 H2 sections; no fixed template)
  tokens.css               canonical compiled :root (the binding contract)
  USAGE.md                 agent router: H2 "Read Order", "Design Highlights", "Do", "Avoid" (required)
  components.html          fixture proving tokens compose into controls (>= 10 selectors, >= 8 tokens referenced)
  components.manifest.json derived from components.html + tokens.css (guard: must match fresh derivation)
  design-tokens.json       derived (W3C-ish Design Tokens) from token-contract report
  tailwind-v4.css          derived @theme from tokens.css
  preview/                 colors.html, typography.html, spacing.html (>= 3 pages required)
  source/                  evidence.md, tokens.source.json, token-contract.report.json (provenance, file:line)
  system/                  output of the brand engine: kit.html, kit.dark.html, index.html, tokens.default.json,
                           artifacts/{landing,deck,poster,email,newsletter,form}.html
  DESIGN-<locale>.md       translations (stripe, playstation, shopify ship 17)
```

Read for this note (10+): stripe, linear-app, runwayml, loom, playstation, shopify, spotify, nike, apple, kami,
airbnb. All carry the same manifest keys (`importMode: normalized`, `craft.suggested: [color,
accessibility-baseline]`), and every DESIGN.md uses the same nine H2s (kami adds Attribution):
1 Visual Theme & Atmosphere, 2 Color Palette & Roles, 3 Typography Rules (hierarchy table: role, font, size,
weight, line-height, letter-spacing, features), 4 Component Stylings, 5 Layout Principles, 6 Depth & Elevation,
7 Do's and Don'ts, 8 Responsive Behavior, 9 Agent Prompt Guide (quick colour reference, example component prompts
with literal values, iteration guide).

Notable content patterns:
- **Signature token called out**: stripe/tokens.css header lists "#Stripe 1..7" binding decisions; #Stripe 6 says the
  blue-tinted multi-layer shadow `rgba(50,50,93,0.25)` is "the single most brand-distinctive token"; rebinding it to a
  neutral shadow "erases Stripe's atmosphere even when every color is right".
- **Negative rules are as specific as positive ones**: Stripe "Don't use weight 600-700 ... Don't use 12px+ radius ...
  Don't use magenta/ruby for buttons" (stripe/DESIGN.md:254-262).
- **Imagery-led brands say the UI must disappear**: runwayml/DESIGN.md:12-17,50,167 ("zero shadows", "the only colour
  comes from photography", "Images replace whitespace"). Directly relevant to video.
- **Motion is thin** in packages: only `--motion-fast`, `--motion-base`, `--ease-standard` tokens
  (packages/contracts/src/design-systems/token-schema.ts:188-191), plus a repo convention (200 ms enter / 140 ms
  exit, `cubic-bezier(0.23,1,0.32,1)`, never scale from 0; docs/design-systems.md:201-217).

### 1.2 The token schema (layers)
`packages/contracts/src/design-systems/token-schema.ts:103-197` (re-exported by `design-systems/_schema/tokens.schema.ts`).

| Group | Tokens | Layer |
|---|---|---|
| Surface | `--bg`, `--surface`, `--surface-warm` | A1-identity, A1-identity, B-slot (alias `var(--surface)`) |
| Foreground | `--fg`, `--fg-2`, `--muted`, `--meta` | A1, B-slot, A1, B-slot |
| Border | `--border`, `--border-soft` | A1, B-slot |
| Accent | `--accent` ("<= 2 visible uses per screen (lint enforced)"), `--accent-on`, `--accent-hover`, `--accent-active` | A1, A2, A2, A2 |
| Semantic | `--success #16a34a`, `--warn #eab308`, `--danger #dc2626` | A2 with fallback |
| Type | `--font-display`, `--font-body` (A1), `--font-mono` (A2), `--text-xs..--text-4xl` (A1-structure), `--leading-body`, `--leading-tight`, `--tracking-display` | |
| Space | `--space-1..12` (4..48px) | A2 |
| Layout | `--section-y-{desktop,tablet,phone}`, `--container-max`, `--container-gutter-*` | A1-structure |
| Shape/depth | `--radius-{sm 8,md 12,lg 16,pill}`, `--elev-{flat,ring,raised}`, `--focus-ring` | A2 |
| Motion | `--motion-fast 150ms`, `--motion-base 200ms`, `--ease-standard` | A2 |

Rules (`design-systems/_schema/AGENTS.md:61-167`): A1 must be declared (guard fails); A2 must be declared today
(no global stylesheet loads beside a pasted `:root`, so a missing `--motion-fast` silently breaks transitions);
B-slot must be declared either as alias `var(--sibling)` or an independent value; brand-only tokens are
C-extensions in a per-brand allowlist. Promotion: C -> B-slot or A2 once **>= 2 brands** declare the same name.
"When not to add a token": component-internal, one-off, speculative, already expressible with `color-mix()`.

### 1.3 Brand (the URL-extracted kit) schema
`packages/contracts/src/api/brands.ts:11-125`.

```
Brand {
  name, tagline, description, sourceUrl,
  logo { primary: "logos/<file>"|null, alternates[], notes },
  colors: BrandColor[]  // role in [background, surface, foreground, muted, border, accent, accent-secondary],
                        // hex #rrggbb lowercase, oklch, name, usage
  typography { display, body, mono? : { family, fallbacks[], weights[], googleFontsUrl?, notes? } },
  voice { adjectives[], tone, messagingPillars[], vocabulary { use[], avoid[] } },
  imagery { style, subjects[], treatment, avoid[], samples?[{ file:"imagery/<f>", kind, caption }] },
  layout { radius, borderWeight, spacing, postureRules[] },
  seed?: BrandSeedOverrides   // ~20 engine knobs: colorPrimary.., fontSize, borderRadius, sizeUnit, motionUnit..
}
BrandMeta { status extracting|needs_input|ready|failed, designSystemId "user:<id>", blocked, blockedReason,
            extractionAttemptId, systemFiles[], projectId, ... }
```
Validation (`apps/daemon/src/brands/validate.ts:51-129`): name required; colours filtered to known roles and
`^#[0-9a-fA-F]{6}$`; **background, foreground and accent are mandatory** or it throws; everything else defaults
(radius 8px, border 1px, "8px baseline grid", Inter for missing fonts). `extractJsonBlock` (131-152) recovers
JSON from the last fenced block when an agent writes prose around it (small-model friendly).

---

## 2. URL -> brand: the actual algorithms

### 2.1 Pipeline and timing
`apps/daemon/src/brands/index.ts:1-16, 1631-1720` (runProgrammaticExtraction), `1393-1590` (finalizeBrandCore).

1. `POST /api/brands` (`apps/daemon/src/brand-routes.ts:330`) reserves brand + backing project + conversation, returns
   immediately; a background programmatic pass starts (timeout 180 s, stall checkpoint 30 s, index.ts:1244-1250).
2. `prefetchBrand` (server fetch) -> `PrefetchResult` + `prefetch/material.md` digest.
3. If `blocked` (anti-bot) -> mark meta `blocked`, stay `extracting`, ask the user to clear the wall in the in-app
   browser, then `POST /api/brands/:id/extract-from-html` re-harvests the rendered DOM + computed CSS
   (`prefetchFromHtml`, prefetch.ts:1044-1063; permissive `browserHarvestIsUnusable`, index.ts:1733-1750).
4. If `thin` -> stop, hand to the agent.
5. Else `brandFromMaterial` (no LLM, no Date/random; `apps/daemon/src/brands/provisional.ts:91-170`) -> finalize:
   logo safety net, imagery safety net, Google Font self-hosting, `rebuildSystem` (tokens light/dark/compact + kit +
   6 artifacts), register `user:<id>` design system with `brandToDesignMd` body, sync to project, render brand.html
   `ready`, **reflow into memory as rules**.
6. Set `pendingPrompt` = enrichment prompt (index.ts:1917-1973): "A usable design system has ALREADY been extracted
   ... ENRICH ... re-measure ... Do not guess - measure", progressive preview after each field group, then
   `od brand finalize` re-registers **in place** (same id, so templates already using it pick up the sharper version).

### 2.2 Server harvest (`apps/daemon/src/brands/prefetch.ts`)
- Caps (24-29): HTML 6,000,000 bytes, CSS 400 KB per file, **6** linked stylesheets, 6 logos, 2 extra pages, 8 s per fetch.
- CSS gathered (847-881): inline `<style>`, every `style=""` attribute rewritten as a pseudo-rule with a synthetic
  selector (tag + 3 classes + data-framer-name/aria-label/role/data-highlight; 665-684), linked sheets, and up to 2
  Google Fonts CSS files.
- Colour regex (440-447): `#[0-9a-fA-F]{3,8}` | `rgba?()` | `hsla?()` | `oklch()`; `normalizeColor` (312-347)
  folds #rgb/#rgba/#rrggbbaa/rgb/hsl to `#rrggbb` (oklch kept raw).
- Provenance (`colorSourceForMatch`, 369-386): looks back 900 chars to find the declaring property and selector;
  stores `css-var:--x`, `prop:background`, `selector:...` (up to 12 sources per colour).
- Logo SVG colours (449-465): every fill/stroke/stop-color/style colour in downloaded SVG logos counted with
  **weight 18** and source `logo-svg:<file>`; merged into the CSS candidates (944-947).
- Ranking (`sortColorCandidates`, 408-438): extreme = Rec.709 luma > 0.96 or < 0.04. Output order: up to **8
  high-signal** (logo SVG or a css-var whose name matches brand|primary|accent|coral|mustard|olive|cta|action|
  highlight|link, excluding --token-/--framer- generated names), then top **15 chromatic** by count, then **4
  extremes** (so the agent still sees the real black/white).
- Fonts (495-522): first non-generic, non-icon family of each `font-family` stack, counted; `@font-face` families
  listed separately; top 10 each.
- Copy: title, meta description/og:description, og:site_name, h1-h3, `<p>` > 40 chars (12), nav labels (<= 40
  chars, 20), plus 2 extra same-host pages whose URL matches /about|company|pricing|product|features|story|mission/
  (first 2000 chars of h1/h2/p).
- `thin` (1024-1027) = blocked OR < 3 non-extreme colours OR (no headings and no description).
- `material.md` (688-766) = the single digest the agent reads (colours with `xN` counts and first 3 sources, fonts,
  self-hosted font files, logo candidates, headings, body copy, nav, extra pages). Saved with `page.html` (scripts
  defused by prefixing `type="text/od-defused-script"`) and `styles.css` as evidence.
- No server screenshot: the headless-Chrome capture was removed because it could not be constrained to public
  hosts (SSRF; prefetch.ts:70-74, 950-953). Screenshots happen only in the in-app browser / agent path.

### 2.3 Colour -> roles, server version (`apps/daemon/src/brands/seed.ts`, line numbers of the file)
- `primaryScore` (140-150): -inf if extreme (luma > 0.92 or < 0.06) or HSV saturation < 0.18; else
  `sat*2 + log2(count+1)*0.6 - valuePenalty` (value < 0.2: (0.2-v)*3; > 0.95: (v-0.95)*4).
- `tokenNameScore` (103-119): per css-var name, skip neutrals (bg/background/paper/surface/canvas/ink/text/
  foreground/muted/border/line/shadow/white/black/grey/neutral/bone); +4.5 for brand|primary|accent|coral|mustard|
  olive|cta|action|highlight|link; -1.8 for soft|tint|subtle|faint|hover|active|bg|background|border|shadow.
- `semanticScore` (121-132): tokenName + 2.2 if from logo SVG + 1.6 if selector/prop mentions brand|accent|cta|
  button|hero|label|dot|selected|active|focus|primary - 4 if it smells like a canvas/physics demo
  (fillstyle|strokestyle|wireframe|collisions|inspector|mouseposition|runner|matter).
- Primary = first of: (a) `explicitSemanticPrimary` (156-170): best `chromatic + semantic` among non-extremes
  with semantic >= **3.2**; (b) `dominantDarkPrimary` (172-183): a near-black (luma < 0.12) when the total dark count
  >= **60** and >= **1.35x** the most frequent chromatic colour (monochrome brands like Nike/Apple keep black as the
  brand); (c) best chromatic score; default `#1677ff`.
- Secondary (`chooseSecondary`, 205-218): best `chromatic + semantic + 2.5 if logo` among saturated non-extremes.
- Cast (243-253): count-weighted mean luma < **0.45** -> dark (biased light: "a wrong dark canvas is far more jarring").
- Provisional palette (provisional.ts:105-130): bg/fg from cast; surface = mix(bg,fg,0.04); muted = mix 0.45;
  border = mix 0.14; accent = primary; accent-secondary only if distinct.
- First-paint variant (`seed-fallback.ts:154-229`, used while extracting): chromatic = HSL sat >= 0.18 and
  0.08 < luma < 0.95; vivid = sat >= 0.32 and 0.22 <= luma <= 0.80; accent = `theme-color` if sat >= 0.18 else top
  vivid else top chromatic; bg = most frequent luma >= 0.9 (light cast) or <= 0.12 (dark cast); fg = most frequent
  luma <= 0.25 (or >= 0.85 on dark); surface mix 0.06, muted 0.45, border 0.12. "It never fabricates a palette from
  memory - every role traces to a measured colour (or a blend of two measured colours)."
- Typography seed (seed-fallback.ts:262-293): mono = first family matching mono|consol|courier|menlo|code|jetbrains|
  fira code|source code; display = first serif-ish (serif|playfair|tiempos|georgia|garamond|merriweather|lora|times|
  caslon|freight) else first family; body = next non-mono family; icon faces dropped; googleFontsUrl attached when a
  linked GF URL contains the slug.

**There is no k-means / clustering.** "Clustering" in OD is exact-hex dedupe after normalization (server) and a
greedy distinctness filter (clipper, below).

### 2.4 Live-DOM computed-style harvest (Chrome clipper, `clipper/brand-capture.js`)
- `visibleElements` (292-311): up to **1400** elements, skipping display:none / visibility:hidden / opacity 0 /
  zero-size boxes.
- `collectPalette` (313-361), additive scores per hex:
  `theme-color` +60; `<html>` bg +25; `<body>` bg +40 (role background); `<body>` color +40 (foreground);
  each `:root` custom property whose name matches color|bg|background|accent|brand|border|surface|foreground|text
  +16; for each element: bg += `min(40, max(1, w*h/6000))` (+24 if a/button/input/select/textarea or role=button),
  text color += `min(18, textLength/12)` (+18 for controls, +2 otherwise), border-top +10 (controls) / +3,
  outline +2, SVG fill/stroke +4. Alpha <= 0.04 ignored; `#000000` only kept if score > 8.
- `distinctColors` (276-290): greedy, keep a colour only if its Manhattan RGB distance to every kept colour is
  >= **44**; top **12**.
- `deriveBrandColors` (425-481), WCAG relative luminance: neutrals = sat < 0.16; colored = sat > 0.2 and
  0.05 < lum < 0.93, ranked by `score*(0.4+sat)`; background = lightest if lum > 0.55 else #FFFFFF; foreground =
  darkest with lum < 0.4; surface = a neutral with lum > 0.84 (else mix toward white 0.55); muted = neutral with
  0.22 < lum < 0.62; border = neutral 0.6..0.92; accent = top colored; accent-secondary = next colored whose lum
  differs by > 0.03; up to 8 roles with `highlight` extras. Comment: only swatches and the accent carry brand colour,
  the chrome stays neutral ("the fix for ... a saturated brand background picked as surface tinted every card").
- `accentInk` (483-489): an accent with lum > 0.6 (yellows) is mixed 55% toward the foreground for text use.
- Components (`pickButton` 722-748, `pickCard` 767-794, `collectComponents` 796-804): button score =
  solid(alpha > 0.55)*36 + sat*24 + border*8 + min(18, width/14), sizes 40 px wide, 22..90 px tall; card score =
  shadow*24 + border*16 + min(12, radius) + min(10, pad/2), 120..920 px wide; first visible input and nav.
- `deriveAtoms` (837-883): turns those computed styles into clamped atoms (button radius 0..26, padX 10..30,
  padY 6..18, weight 400..800, text-transform, letter-spacing, shadow <= 120 chars; input; card radius 0..28) so
  "each captured design system's kit looks like THAT site, not a shared template".
- `deriveLayout` (491-504): posture rules from real components: radius <= 2 -> "square", else "rounded ~Npx";
  shadow present -> "soft shadows" else "flat".
- `collectTypography` (552-576): computed font of `h1,[class*=hero],[class*=title]` (Display), `body,p` (Body),
  `button,a,input,select` (UI), `code,pre,kbd` (Mono) with size, weight, line-height, letter-spacing; family
  frequency over 80 elements.
- `collectImageAssets` (585-664): icons scored 70; og:image 45; `<img>` logoish (alt/id/class/src matches
  logo|brand|mark|icon|wordmark, or inside header/nav) scores `75 + min(20, renderedArea/2000) + 30 if alt/id/class
  contains the brand name` (og:site_name or h1 or title; src URL deliberately excluded); other images
  `20 + min(30, naturalArea/30000)`; images < 32 px dropped unless logoish; CSS backgrounds >= 64 px score
  `18 + min(35, area/30000)`; top 8 logos, 15 images.
- `clipper/capture.js` additionally serializes the page into a self-contained HTML snapshot and a Figma-like IR
  (FRAME/TEXT/RECTANGLE with geometry, fills, strokes, radii, shadows, fonts; MAX_NODES 6000).

### 2.5 Logos (server) and imagery
- `findLogoRefs` (prefetch.ts:603-636): `<link rel*=icon>` (apple-touch flagged), og:image / twitter:image, any
  `<img>` inside the first `<header>`/`<nav>` or with "logo" in the tag; deduped, order kept.
- `extractInlineHeaderSvg` (639-648): first `<svg>` in header/nav, >= 80 chars, xmlns added, saved as
  `header-inline.svg`.
- Download with browser-shaped headers (Referer, Sec-Fetch-*), one retry after 400 ms, <= 5 MB (140-170).
- No origin logo -> public favicon services by hostname (569-599): Google s2 `sz=256` accepted only if PNG >= 64x64
  (rejects the 16x16 globe placeholder), DuckDuckGo .ico accepted if > 1000 bytes.
- Rank (provisional.ts:41-54): apple-touch-icon 0 < favicon 1 < header-img 2 < inline-svg 3 < og-image 4 (inline
  header SVGs are "frequently a nav/UI glyph"). The agent prompt overrides: SVG wordmark > apple-touch > favicon >
  og:image, never a photographic og:image as primary.
- Imagery fallback (`apps/daemon/src/brands/imagery-fallback.ts:30-43`, refs ranked 136-208): og:image (secure_url
  first) > `<link rel=preload as=image>` (the LCP image) > `<picture><source srcset>` highest > `<img>` (largest
  srcset/data-srcset) > CSS hero backgrounds. Keep >= 3 KB, <= 6 MB, long edge >= **320**, short edge >= **160**;
  save **8**; triggers only when < **4** samples; fetch at most 28 candidates.

### 2.6 Fonts (`apps/daemon/src/brands/fonts.ts`)
Parse `@font-face` from harvested CSS; one face per (family, weight, style); prefer the face whose unicode-range
covers latin; best format woff2 < woff < opentype < truetype; magic-bytes check; caps 16 files, 4 MB each, 12 MB
total, 8 s timeout; families actually used on the page download first (`preferFamilies`); writes
`fonts/manifest.json` (`brand-fonts/1`) + portable `fonts/fonts.css`. At finalize `selfHostGoogleFonts` fetches the
GF CSS the agent chose as a stand-in. Agent rule: proprietary face -> keep real family, put the closest Google font
first in fallbacks, set googleFontsUrl, note "stand-in for <face>" (skills/brand-extract/SKILL.md:189-191).

### 2.7 Anti-bot gates (prefetch.ts:174-218)
Title regex (just a moment|attention required|access denied|verifying you are human|...) blocks unconditionally;
definitive body markers (cf-browser-verification|_cf_chl_opt|px-captcha|_incapsula_|...) in the first 60 KB block;
ambiguous widgets (challenges.cloudflare.com|cf-turnstile|datadome) block **only** when the page is not content
rich (`anchors >= 8 || h1-3 >= 3 || (anchors >= 3 && p >= 3)` in the first 400 KB). A blocked page's colours,
fonts and copy are discarded. A site's own 404/500 is a failed fetch, not a brand.

### 2.8 Deterministic engine from a ~20-field seed (`apps/daemon/src/brands/engine/`)
README.md:1-30, types.ts, palette.ts, derive.ts. A Brand collapses into `SeedToken` (colorPrimary, success,
warning, error, info, link, textBase, bgBase, fontFamily, fontFamilyCode, fontSize 14, borderRadius 6, sizeUnit 4,
sizeStep 4, controlHeight 32, lineWidth 1, motionUnit 0.1, motionBase 0, wireframe, motion). A faithful port of
`@ant-design/colors generate()` (palette.ts:18-38: hueStep 2, saturationStep 0.16/0.05, brightnessStep 0.05/0.15,
5 lighter + base + 4 darker; dark map blends) yields a 10-step ladder per colour; `deriveTokens(seed, default|dark|
compact)` produces the full map (bg=[0], bgHover=[1], border=[2], borderHover=[3], hover=[4], base=[5],
active=[6], text=[8]; neutral text = alpha 88/65/45/25% over the text base). Light, dark and compact are the same
seed through different math, so "it can never drift from the light theme" (kit.ts:1086). Dark-first only when bg
luma <= 0.3 AND fg luma >= 0.6 (derive.ts `seedPrefersDark`). Deterministic artifacts render from `--brand-*` vars:
e.g. poster.ts header: 3:4 frame, <= 3 type-size roles, accent on **exactly one element**, cqi units, pure
`(brand, tokens) -> string`.

### 2.9 DESIGN.md as input (`apps/daemon/src/brands/design-md-input.ts:209-250`)
A pasted DESIGN.md is parsed without an LLM: frontmatter/body hexes keyed by name; background = key matching
background|bg|canvas|neutral|paper|base with luma > 0.55 (else lightest); foreground = text|ink|black|primary with
luma < 0.55 (else darkest); accent = accent|brand|cta|tertiary|interactive|button|link (else first chromatic,
sat >= 0.16 and 0.08 < luma < 0.9); surface/muted/border by key name else mixes 0.04/0.45/0.14.

### 2.10 web-clone recon (skills/web-clone)
`scripts/recon-site.mjs:206-226` computed bg/color/border/font/backgroundImage of body, header, nav, main, footer and
12 buttons; `:root` variables resolved via getComputedStyle (260-264); `@font-face` rules with src URLs (170-191);
resources actually loaded via `performance.getEntriesByType('resource')`; motion signals (229-257): scroll-snap
rule count, smooth-scroll rules, sticky/fixed element count, `html` scroll-behavior; framework flags incl. gsap,
lenis, three. `audit-clone.mjs --strict` (84-125) exits 2 unless the original body/header/footer computed
bg and color appear **verbatim** in the clone, custom fonts are self-hosted and >= 3 original images became local
files. `visual-diff.mjs:35-40` scores pixel diff: 5 if diffRatio <= 0.01 and meanAbs <= 0.01; 4.5 <= 0.04/0.025;
4 <= 0.08/0.05; 3 <= 0.16/0.08; 2 <= 0.30/0.14. `dna-scaffold.mjs` writes a `design-dna.json` with three blocks
(design_system / design_style / visual_effects incl. motion, scroll effects, text effects) prefilled only from
measured signals; uncertain colours go to `_recon_signals` for a human to assign.

---

## 3. Forcing the agent to stick to the brand

### 3.1 Prompt layers and order (`apps/daemon/src/prompts/system.ts`)
Header comment 1-29; composition 1061-1340. Order when a design system is active:
1. Official designer charter + discovery layer. The ~6.7 KB **direction library is dropped** when a design system
   is active (1140-1160) and `ACTIVE_DESIGN_SYSTEM_VISUAL_DIRECTION_OVERRIDE` (695-707) forbids asking the user to
   pick a palette/direction.
2. Personal memory (1216/1235): "when they collide with the active design system tokens, the brand wins".
   Verified rules last, then the self-verify scorecard instruction (~1252).
3. Custom instructions (user, then project).
4. "## How to use this design system" = USAGE.md or default router (709, 1273-1280).
5. "## Active design system - <title>": "Treat the following DESIGN.md as authoritative ... Do not invent tokens
   outside this palette. When you copy the active skill's seed template, bind these tokens into its :root block
   before generating any layout." (1283)
6. Import mode guidance normalized/hybrid/verbatim (711-723, 1286-1290).
7. "## Active design system tokens": "Paste the unscoped :root block verbatim into the artifact's first <style> ...
   Do not invent new tokens. Do not redefine these values. Do not write raw hex outside this :root block. The DESIGN.md
   above is prose; this is the binding contract." (1304-1307)
8. Reference component manifest (or full fixture HTML) (1310-1317), pull-layer index readable on demand (1320-1323).
9. Craft references: "The DESIGN.md decides which tokens; craft rules decide how ... brand wins for token values;
   craft rules still apply (letter-spacing, accent overuse caps, anti-slop)" (1332).
10. Active skill, plugin blocks, metadata, deck framework pinned last.

Brand-spec Branch A (`apps/daemon/src/prompts/discovery.ts:104-134`) when a user supplies a URL/spec without a
registered design system: locate source, download CSS, `grep -E '#[0-9a-fA-F]{3,8}'`, codify `brand-spec.md` (six
OKLch tokens, display/body/mono stacks, 3-5 posture rules), then **Vocalise**: "State the system you'll use in one
sentence ... so the user can redirect cheaply."

### 3.2 Linting the output (`apps/daemon/src/lint-artifact.ts`)
Greppy, deterministic, returns `{severity P0|P1|P2, id, message, fix, snippet}`:
- `ai-default-indigo` P0 (197-212): Tailwind indigo hexes found outside token blocks (a brand that declares indigo
  as `--accent` in `:root` is exempt via `stripTokenBlocks`).
- `purple-gradient`, `trust-gradient` (blue->cyan) P0, `emoji-icon`, `sans-display`, `invented-metric`,
  `filler-copy`, `left-accent-card`.
- `raw-hex` P1 (412-430): more than **12** hex literals in the first `<style>` outside `:root` -> "design tokens
  probably not honoured".
- `accent-overuse` P1 (432-446): `var(--accent)` more than **6** times outside `<style>` -> "Cap accent usage at 2
  visible uses per screen".
- Wiring: artifact save/lint routes (`apps/daemon/src/routes/project/index.ts:5756-5781`) return
  `renderFindingsForAgent` (519-537): an `<artifact-lint>` block "Re-emit a corrected <artifact> in your next turn".
- Token self-check for packages (`apps/daemon/src/design-systems/token-contract.ts:170-200`): missing schema token,
  non-schema token, `var()` to undeclared token -> errors; fixture with > 2 `var(--accent)` -> warning.
- Craft numbers (`craft/color.md:11-32`): neutrals 70-90% of pixels, one accent 5-10%, semantic 0-5%, effects < 1%;
  at most 2 visible accent uses per screen; links, hover and focus rings count as accent.

### 3.3 Brand -> memory rules -> enforced self-verify
`apps/daemon/src/brands/memory.ts:71-195`: at finalize, a brand becomes `user_brand_<slug>_visual` (palette, type,
layout, "when to apply"), `reference_brand_<slug>_voice`, and **rules** with `Assertion:`/`Check:` lines:
palette-only ("every CSS color literal is one of {hexes}" + "accent ... use it sparingly, not as a large wash"),
typography stack, layout posture (radius + posture rules), logo usage (if logo.notes). Ids are deterministic so
re-finalize overwrites. `apps/daemon/src/memory-verify.ts`: after an artifact turn with active rules, the daemon
parses the `<od-card type="verify-scorecard">`; missing -> `missing`, any row `fail` or any rule uncovered ->
`fail`. Coverage is lenient: row contains the rule name (>= 5 chars) or check (>= 8 chars), or shares >= 2
significant words (>= 4 chars, stopwords removed).

### 3.4 Critique panel with a BRAND scorer
`packages/contracts/src/critique.ts:17-75`: panelists designer, critic, brand, a11y, copy; default weights critic
0.4, brand 0.2, a11y 0.2, copy 0.2; scale 10, threshold 8.0, max 3 rounds, fallback ship_best.
`apps/daemon/src/prompts/panel.ts:97-134`: BRAND "Scores against <name>'s DESIGN.md tokens, palette rules, and
tone; only whether the artifact conforms to the brand source"; the critic explicitly does NOT score brand; the
DESIGN.md is embedded as data in `<BRAND_SOURCE>` with tag escaping.

---

## 4. Drift tracking (what exists)
- **Per-run digest**: `digestDesignSystemContext` (`apps/daemon/src/design-systems/index.ts:709-743`) = sha256 of
  {id, title, DESIGN.md body, USAGE.md, tokens.css, component manifest, fixture, pull index, import mode}; recorded on
  run records and Langfuse traces with `designSystemSelectionSource` (`langfuse-trace.ts:1201`,
  `runtimes/chat-run-records.ts:259`). Any output can be traced to the exact brand version that produced it.
- **Stable-prompt section digests** (`apps/daemon/src/db.ts:210-220`): per-section hashes so when the stable prompt
  hash moves, a diff names which input drifted.
- **Revisions**: `createUserDesignSystemRevision` (index.ts:1480-1515) stores feedback + baseBody + proposedBody +
  fileChanges with status `pending`; status updated separately (1564). Brand edits are proposals, not silent writes.
- **Token provenance and quality score**: `token-contract.ts:213-247` binds each schema token: exact name -> `high`;
  role/name heuristic (needle scores exact 100 / suffix 80 / contains 40, plus value validators) -> `medium`;
  B-slot alias -> `alias`; A2 fallback -> `fallback`; A1 default -> `low`. Score (297) =
  `round((A1 source-backed coverage*0.7 + nonFallbackRatio*0.2 + nonAliasRatio*0.1)*100)`; grade >= 80 excellent,
  >= 60 usable, >= 40 needs-review, else needs-rebuild; `recommendRebuild` if review/rebuild or self-check fails.
  Stripe's report: 56 tokens, score 100.
- **Repo guards** (`scripts/guard.ts:1538-1548`, `scripts/check-tokens-fixture-sync.ts`): components.html `:root`
  byte-equivalent to tokens.css `:root`; A1/A2/B-slot present; unknown tokens only via allowlist; defaults.css equals
  schema fallbacks; components.manifest.json equals a fresh derivation.
- **Analytics** (`docs/design-system-tracking-spec.md`): `enrichment_status` programmatic vs ai_refined,
  `ds_source_origins[]`, `design_system_source` (user_selected/default/project_saved/...), official vs custom,
  edit surface. This is product telemetry, not visual drift.

## 5. Skills in this area
- `skills/brand-extract/SKILL.md` (232 lines): the measure -> synthesize -> finalize chain; "an LLM left alone
  regresses to the mean - Inter, an indigo accent, a purple gradient"; exact brand.json shape; preview after each of
  six field groups; anti-bot question form; "(from brand knowledge)" marking when the user skips.
- `skills/brandkit/SKILL.md` (822 lines, image generation): strategy first (category, audience, emotional promise,
  core metaphor; a category -> symbol-logic table), logo concept methods, 3x3 board, colour discipline ("accents
  must repeat across panels", "one accent can carry the entire system"), anti-generic list.
- `skills/web-clone/` (SKILL.md + 14 scripts): see 2.10.
- `skills/brand-guidelines`, `skills/design-md`, `skills/full-page-screenshot`: 42-line catalogue stubs pointing to
  upstream repos (Anthropic skills, Google Labs Stitch, LewisLiu007); no implementation in OD.
- `specs/od-clipper.md`: Library + Clipper + Brand Kit spec; all phases marked `pending` in the frontmatter, but the
  clipper code (brand-capture.js, capture.js) exists. Key design: content-addressed assets (`content_hash`) with
  many source backlinks, programmatic enrichment always on and AI enrichment optional, Brand Kit = aggregate over
  design system + assets + generated outputs, "programmatic candidates -> user confirms adoption".

---

## 6. Moovi mapping (where Moovi reads a site, and what to change)

| OD piece | Moovi today | Change |
|---|---|---|
| prefetch + seed scoring | `styles/common.ts:227-238` HTML-only 6-digit hex counts; `fallbackBrief:159-188` theme-color or most-used hex with channel spread > 60 | new `packages/engine/src/research/brand.ts`; readSite returns a `BrandPack`; port extractColors/normalizeColor/seed.ts scoring |
| clipper computed-style harvest | `research/capture.ts` Reader already has a rendered page (mobile UA for vertical) but only reads text and shots | add one `page.evaluate(harvestBrand)` inside `readNow` before shots; store result with the `(:Page)` |
| 7 roles + typography + voice + imagery + layout | one `color` from the LLM (`styles/kit/script.ts:154`) | `BrandPack` type; brief prompt gets measured roles and must not output colour |
| one `:root` contract | kits use ad-hoc palette names (`packages/library/src/kits/*/kit.json`: deep, accentMid, pop, glow, lobe, skin); `kitInsertPalette` (`styles/kit/kits.ts:31-34`) maps a few | `packages/library/src/tokens.ts` shared video token schema with layers; guard test that every kit binds it |
| logo pipeline | `s1fast/logo.ts` (S1 only; icons/manifest; no inline header SVG; no brand-name match) | generalize into research/brand.ts; pass logo to every style and the router |
| imagery harvest | stock footage first; site only as screenshots | brand images as `(:Asset {licence:'customer-site'})` inserts, first choice for footage panels on URL films |
| fonts self-hosting | fixed FONTS list (`s1fast/theme.ts:22`) | harvest woff2 into `data/brands/<host>/fonts`, load in players; closest-FONTS fallback with licence flag |
| lint + verify | Lens has no brand checks (`tasks/lens.ts`) | frame-level palette lint + scene-spec hex lint + scorecard |
| memory rules | FEEDBACK_KINDS lacks brand (`memory.ts:11`) | `(:Rule)` nodes from the brand; feedback kind `brand` -> revision |
| digest + revisions | S4 pins first hex per host in a JSON file (`styles/s4.ts:98-101`) | `(:Brand)` with version digest in FalkorDB; `(:Film)-[:USED_BRAND {digest}]` |

Proposed FalkorDB shape (`packages/graph/src/queries/brand.ts`, indexes in `packages/graph/src/schema.ts`):
```
(:Site {host})-[:HAS_BRAND]->(:Brand {id, name, tagline, sourceUrl, version, digest, score, grade,
                                      enrichment: 'measured'|'ai'|'user', extractedAt, blocked})
(:Brand)-[:HAS_COLOR {role}]->(:BrandColor {key: brandId+':'+role, hex, name, usage, confidence, source, share})
(:Brand)-[:USES_FONT {role: 'display'|'body'|'mono'}]->(:Font {family, file, licence, standIn})
(:Brand)-[:HAS_LOGO {primary: bool, rank}]->(:Asset {category: 'logo', licence: 'customer-site', sha})
(:Brand)-[:HAS_IMAGE {kind}]->(:Asset {category: 'insert', licence: 'customer-site', sha, w, h})
(:Brand)-[:HAS_RULE]->(:Rule {id, assertion, check, kind: 'palette'|'type'|'logo'|'layout'|'accent-budget'})
(:Brand)-[:REVISED]->(:BrandRevision {id, status: 'pending'|'accepted'|'rejected', feedback, before, after, at})
(:Film)-[:USED_BRAND {digest}]->(:Brand)
(:User|:Project)-[:OWNS_BRAND]->(:Brand)
```
Named queries: `upsertBrand`, `brandForHost`, `brandColors`, `brandRules`, `filmUsedBrand`, `brandDriftFilms`
(films whose USED_BRAND digest differs from the brand's current digest), `proposeBrandRevision`,
`decideBrandRevision`, `brandAssets` (reuse library licence codes).

## 7. Unknowns / not verified
- I did not run anything, so thresholds' real-world accuracy (e.g. how often semantic >= 3.2 fires) is unmeasured.
- The live site (open-design.ai) was not observed for this area.
- Whether OD measures accent pixel share in rendered output: I found no code; the 5-10% numbers are craft prose.
- `brand-kit.html` template internals beyond module skeletons and soft reload were not read line by line.
- `token-contract-rebuild.ts`, `source-context.ts`, `showcase.ts`, `shadcn-import.ts`, `github-import.ts` were only
  skimmed (repo/codebase imports, less relevant to URL films).
- The clipper Library/Brand Kit backend routes (`/api/library/*`) are specified as pending; I did not find them.
- Font licensing: OD downloads site webfonts without a licence check; implications for Moovi's licence rules are mine.
