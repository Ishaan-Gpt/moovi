# Ship checklist

Run through this before showing work and again before deploying. Fix, don't just note.

## Concept and story
- [ ] Five concepts were written; the built one is not the first; you can name it in a sentence and say why.
- [ ] The derivation table is filled: loader, transition, scroll device, icons, empty states and footer all come from the concept.
- [ ] The page tells a story: hook → tension → turn → proof → invitation; a protagonist (character, object, material or environment) persists and changes state.
- [ ] Nothing is cloned from a previous project (no reused mascot, halo, palette or hero layout unless this brand's concept is genuinely that).
- [ ] 3D/shaders are used only if the concept needs them.

## Taste
- [ ] Palette is derived: two majors carry the page, one accent used with intent, small accent text passes contrast; no framework defaults.
- [ ] Two typefaces (+ mono if needed); big type, lots of space, one message per viewport; minimal text.
- [ ] No tags/labels above headings, no badges, no emoji, no hype words; lead-ins only when they read as one sentence with the heading.
- [ ] No icon library imports anywhere (search the code); all icons and art custom.
- [ ] No invented testimonials, logos or numbers; sample data clearly fictional; decorative data is real.
- [ ] Mocks replaced by real components with sample data.

## Motion
- [ ] Intro plays once per session, decided before first paint, skipped for reduced motion, never blocks a repeat visit.
- [ ] Page transitions never delay navigation; prefetch on hover/touch/focus; slow loads show the looping loader.
- [ ] Smooth scroll on; anchor links and keyboard scrolling still work; stops while overlays/menus are open.
- [ ] Reveals are subtle (soft blur rise, masked lines) and things also *leave*; scrubbed chapters hold briefly at each end.
- [ ] Gestures/transformations match each beat; nothing loops one animation everywhere.
- [ ] `prefers-reduced-motion` honoured everywhere: final states, no scrubbed transforms, no loops.
- [ ] No animated `filter`/`opacity`/`mask` on ancestors of glass; glass actually blurs.

## Function
- [ ] Every link goes somewhere; every form submits and shows loading, success and error.
- [ ] From every page there's a visible way home (and to the app / sign out where relevant).
- [ ] Sign-out clears the session cookie with the same path/attributes it was set with; then a full reload.
- [ ] Route loading skeletons in the page's shape; empty and error states exist.

## Performance
- [ ] Hero text and primary action paint first; 3D/canvas/video load after LCP; below-the-fold loads on approach.
- [ ] Everything lazy has a placeholder of its final size; CLS ≈ 0.
- [ ] Only transforms/opacity animate per frame; canvases, videos and loops pause offscreen and in hidden tabs.
- [ ] Images pre-rendered and small; no live SVG filters on large areas; fonts via the framework loader.
- [ ] Any performance claim is measured (method stated).

## Quality
- [ ] Typecheck and lint clean; production build passes.
- [ ] No console errors and no hydration warnings.
- [ ] Verified per `verify.md`: desktop ~1440 and phone ~390, every chapter at start/middle/end, key states; no overflow, nothing cut or covering UI.
- [ ] Metadata, Open Graph image, favicon, sitemap and robots updated to the brand.
- [ ] Old URLs redirected if routes moved.

## Hand-off
- [ ] Plain summary: what was built, what was verified (and how), what still needs the human (credentials, real content, real art).
