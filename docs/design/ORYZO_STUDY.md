# Reference study: oryzo.ai (Lusion), studied 2026-10-12

## Stack and structure
- Astro static site, one hoisted JS bundle, a custom WebGL engine (no GSAP/Lenis globals exposed). Fonts:
  - **Halyard Display Variable** (500): every heading and all UI text
  - Halyard Text
  - **Literata** (serif)
  - **DM Mono**
- **One fixed full-screen WebGL canvas** behind a DOM storyboard **45,678 px tall** (about 63 viewports at 720 px).
- Sections, as heights in viewports:

| hero | ai | wearable | features | encryption | grip | sustainability | testimonies | social | product | open-weight | footer |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 8 | 13 | 10.5 | 4 | 4 | 5.7 | 2.7 | 8.3 | 3.4 | 1.4 | 1.2 |

- **Fixed chrome:**
  - header: logo, plus a nav whose letters roll on hover, with a dashed line under it
  - footer: a dot and a "SCROLL TO CONTINUE" cue with a ring icon
  - a right-edge scroll-progress bar
  - a vertical cream tab, "ORYZO-1 MODEL"
  - a video overlay with a custom play/pause/close cursor

## Design system
- **Type that scales to the window.** `--screen-unit = min(innerWidth/1800, vh*100/1024*1.25)`. Sizes are multiples of it:
  - headings: h1 164u · h2 68u · h3 45u · h4 32u · h5 20u
  - sub-labels: sub1 24u · sub2 16u
  - body: body1 38u · body2 24u

  The layout always fits the viewport, in width *and* height.
- **Grid:** 16 columns, side padding 3.125vw, gap ratio 24/90.
- **Palette:** dark warm (`#100904` near-black brown, `#ffedd7` cream ink, olives `#445231` / `#5d6c49`, grey-brown `#6c5f51`). One burnt-orange accent, `#dc5000`, used sparingly: product name, highlighted quote words, active pill, video border.
- **Headings:**
  - **uppercase** h2 and h3 at weight 500
  - one big **mixed-case** h1 ("Powered by AI*")
  - pattern: a small uppercase lead-in followed by a big line ("SO PORTABLE, / it's wearable")
- **Dotted and dashed "cutting lines"** frame everything: image frames, inputs, table rows, header.
- **Rolling letters:** each character sits in an overflow-clip span with a duplicate at `top:100%`. On hover the letters translate up with a stagger.

## Sequence
1. **Preloader:** the logo is drawn as a vector construction (dashed circles, orange bezier handles) on an olive background. The camera then pulls back to reveal the 3D desk scene (a cutting mat at an angle, pencils, a craft knife).
2. **Hero:** a giant "ORYZO" wordmark top-left (it scrubs down into the header logo), a tiny tagline, body copy mid-right, a frosted "Designed by Lusion" card bottom-left with a dotted rule, the scroll cue bottom-centre, and a floating video thumbnail with an orange border bottom-right.
3. **"Isn't just a coaster":** the uppercase headline and the paragraph **fill word by word** from muted to cream as you scroll. Then "Powered by AI*", with a rainbow Apple-Intelligence-style glow around the viewport edge, a "try to hover hand" toy, and a joke footnote.
4. **Wearable:** the two-voice headline, plus a photo inside a dotted frame.
5. **Features:** a numbered side list, a fake "temperature" gauge (Creative T = 10 / Balanced 1 / Deterministic 0.1), and a softmax formula.
6. **Encryption:** a centred stack, plus a **working toy** (an input with a dotted border and a "Decode message" pill).
7. **Grip / sustainability:** numeric spec items.
8. **Testimonials:** a table with dotted dividers, stars, an orange-highlighted word in each quote, and an image on the right. The row in focus is bright; the others dim.
9. **Product:** the giant wordmark again, segmented model pills, a glowing scatter of 3D objects, a description on the left and a ring-icon spec list on the right.
10. **Open-weight paper:** a satirical technical paper (abstract, BibTeX, "code coming soon").
11. **Footer:** black, a giant right-aligned uppercase statement, a newsletter input with a dotted underline and an arrow, contacts, and tiny legal text.

## What we take for Moovi (the skeleton) and what we change
- **Take:**
  - a persistent hero object travelling through a long pinned story
  - the viewport-scaled type unit and the 16-column grid
  - the two-voice headlines and the word-by-word scroll fill
  - tiny uppercase interface text and the dotted cutting lines
  - rolling-letter links
  - the vertical progress tab
  - working toys in place of mockups
  - a table section, a chooser with pills, a technical paper, a statement footer
- **Change:**
  - **Light**, not dark: icy white and ice blue are the brand's two main colours.
  - The cutting mat becomes an **editor's light table** whose ruler is **timecode**.
  - Dotted lines become **cut marks**; the scroll bar becomes a **timeline scrubber with a timecode readout**.
  - The construction-drawing preloader becomes **the halo being drafted**.
  - The rainbow glow becomes an **aurora edge glow** while Moovi thinks.
  - Fake testimonials become **a sample crew log**, because we never invent social proof.
