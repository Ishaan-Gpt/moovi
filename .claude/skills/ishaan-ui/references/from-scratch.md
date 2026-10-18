# Path A: Create a website from scratch

## 1. Concept and story (from intake)
Run `concept.md` (five concepts, build the fifth) and `storytelling.md` (beats, protagonist, pacing). Post the concept sheet. Everything below is derived from it.

## 2. Foundations first
0. **Stack**: whatever the repo uses; otherwise Next.js (App Router) + plain CSS or Tailwind + GSAP (ScrollTrigger, SplitText) + Lenis for smooth scroll; Motion for React micro-interactions if wanted. One animation engine for scroll, not three.
1. **Tokens** in one CSS file: canvas, surface, surface-2, ink/ink-2/ink-3, line, accent, accent-hover, accent-ink, accent-soft, status, radii, shadows, easing curves (`--ease: cubic-bezier(.22,1,.36,1)`, `--spring: cubic-bezier(.34,1.56,.64,1)`). Map them into the styling system (e.g. Tailwind `@theme`).
2. **Fonts** via the framework loader; expose `--font-display`, `--font-body`, `--font-mono`.
3. **Utilities**: glass / glass-strong / glass-inset, skeleton shimmer, keyframes (`assets/glass.css`), and the motion kit (`assets/motion-kit/`: smooth scroll, reveals, masked splits, intro guard, pinned chapters).
3b. **Scale**: for story sites, size everything off a screen unit (`taste.md` §4) so each scene fits any viewport.
4. **Brand mark**: a custom logo mark drawn in SVG that expresses the visual idea (e.g. a loupe for a "see clearly" brand) + a wordmark set in the display face.
5. **Icon set**: draw the first 10–15 icons the site needs in one consistent hand (`assets.md`).
6. **Art**: decide the environment (sky, paper, landscape, texture). Render it with `scripts/render-art.mjs` or write prompts, and wire images with slots.

## 3. The landing page

**If the concept is a story** (most landings): build it as chapters from `storytelling.md` with the mechanics in `scroll.md`: a persistent protagonist, pinned chapters with back/front layers, a keyframe script, subtle in/out motion, chrome that shows position. Build chapter by chapter, verifying each (`verify.md`).

**If the concept is calmer** (editorial, utility), this skeleton is reliable; change order and content to fit the brand:
1. **Nav**: transparent full-width bar that becomes a floating glass pill on scroll; centre links; secondary + primary button right; account menu when signed in.
2. **Hero**: big display headline (plain line + italic turn), one-sentence lede, one primary action. Below it a large rounded panel holding the environment art with the **real product UI** floating in glass, lightly interactive. Decorative elements (branches, shapes) tucked behind the panel edges with slow parallax.
3. **How it works**: centered heading whose italic line ink-fills on scroll; a numbered accordion on the left that auto-advances (progress hairline) and a panel on the right that shows the real component for each step.
4. **One or two scroll-driven, interactive sections** that teach the product's core idea by letting the visitor *do* it (see `motion.md` → scroll sections).
5. **Cards over an environment**: three glass cards, each with a small real component inside.
6. **A brand-object moment**: an emblem, a stamp, a ticket, a postcard — an object from the visual metaphor that makes the page memorable.
7. **Pricing** (honest), FAQ if useful.
8. **Closing CTA** over the environment, flowing into a **footer set inside art** (landscape, texture).

## 4. App / dashboard (if in scope)
- Same tokens, a quieter environment: blurred version of the brand art, tinted for time of day.
- Navigation as a floating glass dock (left on desktop, bottom on mobile) with a moving active "bead", hover name-tags, and an account menu that always offers Home, Tools and Sign out.
- Every page: big serif masthead (no crumb label above it), glass panes, custom data visuals (dials, ink-well gauges, glass bars), real empty states, a skeleton loading route in the page's own shape.

## 5. Auth
A memorable object (e.g. a postcard: picture side + message side with stamp and postmark) with a gentle 3D tilt toward the pointer. Inputs are glass-inset; the primary button uses the accent. Already-signed-in visitors skip the form.

## 6. Then: motion, components, assets, performance, checklist
Read `motion.md`, `loaders.md`, `scroll.md`, `components.md`, `assets.md`, `performance.md` (and `3d.md` only if the concept needs real-time 3D); verify with `verify.md`; finish with `checklist.md`.
