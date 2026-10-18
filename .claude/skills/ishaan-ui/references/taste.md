# Taste: what makes a website feel premium

## Contents
1. The core idea
2. Finding the visual idea (never the first one)
3. Colour
4. Typography
5. Layout, rhythm and space
6. Copy
7. Honesty
8. The anti-slop list (with reasons)
9. Premium signals, quickly

---

## 1. The core idea

Premium sites feel *authored*. One person with taste made consistent decisions about everything: a single visual metaphor, one accent colour, two typefaces, a motion personality, and an asset style that could only belong to this brand. Generic sites feel *assembled*: a hero from here, a feature grid from there, icons from a library, a gradient because gradients are popular.

So every decision should answer: *does this belong to this brand and this idea?* If a component could be dropped onto any other site unchanged, it is not finished.

## 2. Finding the visual idea (never the first one)

The full method is in `concept.md` (write five concepts, build the fifth). The short version: generate several directions and write each as one sentence. Examples of the shape (not to copy):
- "Painted pastoral skies with glass panes floating over them; calm, warm, human."
- "A printed field guide: engraved line art, stamps, postmarks, paper grain."
- "Instrument panel: watch-bezel dials, hairlines, precise mono numerals."

Discard the first (it's usually the most common), then pick the one that best fits the brand's promise. Strong sites often combine one *environment* (sky, paper, studio, night city) with one *object language* (glass, stamps, dials, lenses). Name the metaphor and let it generate details: a "lens" brand gets a loupe logo, a loader where the lens opens, a scanning transition.

Write down why you chose it in one line; tell the user.

## 3. Colour

- **Derive, don't default.** Start from the brand's existing colours, the product's subject, and the reference. Never ship a framework's default palette.
- **Never the AI-default palette** (owner, 2026-10-18): blue/indigo + orange, cream/beige + terracotta, navy + ice blue, teal + orange, purple-pink gradients, neon on black, Tailwind slate neutrals, pure #000/#FFF. Run the five-palette drill and build OKLCH tint ramps for contrast: `references/palette.md`. Ask of every colour: *can something be better?*
- **Two majors, everything else minor.** Pick two colours that *are* the brand world (e.g. oxblood + bone; verdigris + smoked plum; safelight red + carbon) and let them cover ~90% of every screen. One deeper accent for actions and focus. Minors (status, a chapter tint) appear in small areas only. When the story moves through tones (green → dark, day → night), the page colour travels *between and within the world's colours*; it doesn't introduce new ones. The hex values in this file are examples of the reasoning, not defaults: derive yours from the world.
- **Structure**: canvas (the page), surface (cards), ink (text, 2–3 steps), one accent, status colours (success/warning/danger) tuned to the palette, a line colour at low alpha.
- **The page colour can move.** Tween a `--page` (or `--bd`) custom property per chapter so the world shifts tone with the story (a cooler band for "memory", a warmer one for the finale), and make the hero's background gradient fade into the page colour before the next section so no seam shows.
- **Warm neutrals beat pure greys.** Off-white canvases (e.g. a cream around `#f2efe5`) and warm near-black ink (e.g. `#2b2927`) read as crafted; pure `#fff`/`#000` read as default.
- **One accent, used with intent**: primary buttons, key highlights, focus rings, a few accent words. If everything is accented, nothing is. Best when the accent has a reason inside the world (an astronomer's red torch for a night-sky app: selection, focus rings, the logo's spark, the one "needs your phone" label).
- **Palette as chapters**: define 3–5 surfaces that each set background *and* text (night, paper, moon, ember) and alternate them like chapters of one story, with giant-shape transitions between them (`scroll.md` §9).
- **Dark themes are welcome** when the world is dark (night, cinema, studio); use a near-black tinted with the dominant hue, an off-white tinted the same way, alpha tiers for secondary text, and an instrument-like detail colour (brass `#c9b98f`).
- **Pastel accents need contrast care.** If the accent is soft (e.g. a pastel apricot), put ink-coloured text on it, and create a darker "accent-ink" shade for any small accent text so it passes contrast.
- **Status colours** should be desaturated to sit in the palette (a sage green, a burnt amber, a brick red), not neon.
- Put colours in CSS custom properties (tokens) and map them into the styling system; components only use tokens.

## 4. Typography

- **Pairing**: an expressive display face for headings + a calm grotesk for UI and body. A serif display with an *italic second line or italic accent word* is a strong default for warm brands; a tight grotesk display suits technical brands.
- **Scale with confidence**: hero headlines are big (64–110px desktop, and giant display words can be 30–60% of the viewport), tight leading (0.85–1.05), slight negative tracking. Body 15–18px with 1.5–1.6 line height, muted ink.
- **A screen unit instead of breakpoints** for story sites: `--u: min(calc(var(--inner) / 1800), calc(100svh / 1024 * 1.25))` (the smaller of width-fit and height-fit), and every size as `calc(N * var(--u))`, so each scene fits the viewport in both directions. On narrow screens switch to width only (`--u: calc(var(--inner) / 760)`). Clamp small text with `max(12px, …)`.
- **Italic as emphasis**, not bold. Split headlines into a plain line and an italic line.
- **Numbers**: tabular figures; big numerals in the display face look editorial.
- **Variable font axes are free drama**: a condensed width (`"wdth" 62.5`) of a Didone at 15–30vw reads as a magazine cover; micro-labels in a *wide* sans (`"wdth" 125`, weight 700, tracking .3em, 9–11px caps) for captions; body slightly widened (`"wdth" 108–110`).
- **Mix scripts sparingly**: one handwritten line crossing the display word ("after dark" over "LUNA", rotated −5°) is a signature; two is a wedding invitation.
- **Composed headings**: break a statement over lines with staggered indents ("Darker / than you / think"), let a display word bleed into the next section, put licences or footnotes as tiny wide-tracked superscripts.
- **Fluid vw scale** for editorial sites (h1 15vw, h2 10.6vw … with phone values) or the screen-unit scale below for story sites; either way the type is sized by the viewport, not a fixed ramp.
- Load fonts with the framework's font loader (no layout shift). At most two families plus a mono if genuinely needed.

## 5. Layout, rhythm and space

- **Space is the premium signal.** One message per viewport; big empty canvas around the protagonist; 120–200px between flowing sections on desktop; text measure ≤ 60ch. When unsure, remove an element rather than shrink everything.
- **Minimal text.** A screen with a heading, one line and a visual is complete. Cut every sentence the visual already says.
- Narrow measure for text (≤ 600px), wide for product visuals.
- Centered headline sections alternate with asymmetric splits (text left / live UI right).
- Big rounded "panels" (24–32px radius) that hold an environment (painted sky, photo, texture) with glass UI floating inside are a reliable premium device.
- Let decorative elements break the grid (branches overlapping a panel edge), but never cover content or interactive UI; put them behind the panel if they collide.
- Mobile is designed, not squashed: re-order, reduce decoration, keep tap targets ≥ 44px, no horizontal scroll.

## 6. Copy

- Headlines are specific and human: what the product does for the reader, in their words. Avoid category slogans.
- Short sentences. No hype words ("revolutionary", "unlock", "supercharge", "seamless", "leverage").
- Every section heading should make sense on its own, without a label above it.
- A small lead-in line is fine **only if it reads as the first half of the heading's sentence** ("ONE DIRECTOR. / five specialists."). If the small line would make sense alone as a category label ("FEATURES", "HOW IT WORKS", "Built for:"), it's an AI tag: delete it.
- No "AI-powered", "Introducing", "Meet X", "Welcome to", "Unlock", "Elevate", "Seamless", "Supercharge", "Next-gen", "Revolutionary", "Game-changing"; no emoji; no exclamation marks in headings.
- Microcopy is part of the design: empty states, loading labels, errors ("A passing cloud").

## 7. Honesty

- Never invent testimonials, logos, user counts, ratings or metrics. Leave them out or ask.
- Sample data in demos uses obviously fictional names and `.example` domains, and is labelled as sample where it could be mistaken for real.
- Label estimates as estimates. Don't claim integrations or features that don't exist.

## 8. The anti-slop list (and why)

| Don't | Why | Do instead |
|---|---|---|
| Icon libraries (lucide, heroicons, etc.) | Instantly recognisable; makes every site look the same | Draw a custom SVG set in one hand (`assets.md`) |
| Prebuilt component kits used as-is | Same shapes and spacing as thousands of sites | Write components for the brand; restyle any library you must keep |
| Eyebrow/kicker tags above titles ("FEATURES", "Built for:", "STUDIO / OVERVIEW") | Reads as AI template filler and clutters the hierarchy | Let the heading carry the meaning; put context in body copy |
| Purple-blue gradients, glowing orbs, glassmorphism with no environment behind it | The default "AI startup" look | Glass only over a real painted/photographic environment; palette from the brand |
| Emoji as icons or bullets | Cheapens the voice | Custom glyphs or nothing |
| Mock UIs drawn as grey boxes | Feels fake and generic | Render the product's real components with sample data, animated and interactive |
| Fake social proof | Damages trust, can be screenshotted | Omit, or show honest proof (live tool results, real numbers) |
| Animating everything on load | Noise; slows perception | Motion with purpose: reveal, explain, reward |
| Default fonts and default colours | Unauthored | Chosen pairing, derived palette |
| Generic stock photos | Interchangeable | Real photography with a written art direction (light, angle, props, grade, shot list); until it exists, procedural art, clean product renders, generation prompts, or placeholders in the exact aspect ratio, labelled for the swap (`assets.md`) |
| Badges and pills everywhere ("New", "Beta", "AI", sparkles next to every heading) | Template noise | One honest status mark where it matters |
| Every section a card grid | The page feels like a catalogue | Scenes, splits, one big statement, interactive demos (`storytelling.md`) |
| Centered-everything | Monotone rhythm | Alternate centered statements with asymmetric splits and full-bleed moments |
| Motion that never leaves (everything only fades in) | The page stacks up | Subtle exits too: rise/fade out, merge back, blast apart (`motion.md`) |
| A theme applied only to the hero | The concept dies after one screen | Derive every surface from the concept (`concept.md` §4) |

## 9. Premium signals, quickly

- A branded **intro** that plays once and gets out of the way; **page transitions** that never slow navigation.
- **Smooth scroll** with scroll-scrubbed chapters and a persistent protagonist.
- Huge type against lots of space; an italic turn; tabular numerals.
- **Subtle in/out motion**: soft blur rises on enter, quiet exits, masked line reveals, ink-fill on scroll; springs only on things you touch.
- Custom icons, custom art, custom cursor/hover echoes of the concept.
- Real product UI, live and interactive, with honest sample data.
- Every state designed: loading in the page's shape, empty, error, success.
- Fast: hero text first, 3D after LCP, nothing jumps.
