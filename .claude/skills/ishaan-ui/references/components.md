# Components: build them for the brand

Write every component yourself. These are proven patterns; adapt their shape to the visual idea.

## Surfaces
- **glass**: translucent warm-white gradient, `backdrop-filter: blur(28px) saturate(1.4)`, 1px white/70 border, inset top highlight, long soft shadow. Only over an environment (art, blurred sky), never over flat colour.
- **glass-strong**: more opaque, for dense content and popovers.
- **glass-inset**: white/40 with inner shadow, for inputs, chips, icon wells.
- Radii: 12px controls, 18–24px cards, 28–32px panels.
- Provide `prefers-reduced-transparency` and print fallbacks (solid surface).

## Buttons
- Primary: accent fill, ink text, inset top highlight, small accent-tinted shadow, 1px press. Secondary: glass-inset or a warm neutral fill. Rectangular with soft corners (10–14px) reads more premium than full pills for most brands.
- Every async button: spinner + present-tense verb, disabled while busy.

## Inputs
- glass-inset, 48px tall, 12px radius, accent focus ring (`0 0 0 4px accent/30%`).
- Big "front door" input for the product's core action: a glass bar with the tool's own glyph in a well, a primary action, and quiet example chips ("try …") under it.
- **The hero prompt box** (for AI/creative tools), built for the brand rather than copied from chat apps:
  - structure: an attach/upload tile that overlaps the top edge, an auto-growing textarea (Enter sends, Shift+Enter breaks), a bottom bar with a "suggest" button that types a real example brief, an options menu (e.g. frame size) as a small listbox, and a send button that only turns to the accent once there's something to send;
  - **when the product has a few distinct modes** (e.g. Edit / Launch video / Showreel), show them all as visible chips on the box, never hidden in a menu or a dropdown: each chip has its glyph, its name and a one-line "what you get"; nothing is pre-picked; the chosen mode changes the placeholder, the suggest samples and a small "needs …" line beside the suggest button that ticks once the mode has what it can't start without (a video, a link, a topic); sending without it says what is missing in words, not only a shake (Ishaan, Moovi landing, 2026-10-18: he picked visible chips over a bar menu so new users see every option);
  - accepts dropped files (rim highlights while dragging), shows them as removable chips;
  - empty submit = a small shake and focus, never a dead click; sending = a visible reaction, then navigate;
  - wide (up to ~880px) and spacious; the surface is the palette's lightest major with a rim in the second major;
  - if the concept has a protagonist, let it *hold* or *present* the box, but only if that suits this brand.

## Navigation
- **Story-site chrome**: a minimal header (logo appears once the hero wordmark has left; nav labels that roll on hover), an **active-section bead** under the nav, and a quiet **position rail** that belongs to the concept (a timecode for a film, a depth gauge for an ocean, coordinates for a sky). A **scroll cue** on the first screen only.
- **Circular CTA** for story heroes: a ring button with a slow progress arc or orbit, wide-tracked caps inside ("GET LUNA TONIGHT").
- **Hover labels that roll**: each letter sits in a clipped cell with a copy below; on hover the copies roll up with a small stagger (Oryzo "flipper").
- **Marketing nav**: transparent → floating glass pill on scroll (animate max-width); hover mega-menu in the display face; signed-in visitors get "Your studio" + an avatar menu (Overview, Saved items, Sign out).
- **App dock**: vertical glass dock fixed left, centered; logo (with "Back to home" name-tag), primary destinations, divider, tools popover, avatar menu (Home, All tools, Sign out). Bottom dock on mobile. A `layoutId` bead marks the active item.
- There is always a visible way home and a way to sign out from every page.

## Headings
- Masthead: big display heading with an italic turn and a one-line lede. **Nothing above it.**
- Section headings: two lines, second italic; optionally scroll-filled.

## Data visuals (custom, never default chart skins)
- **Bezel dial**: 60 hairline ticks around a ring, score arc in a status tone, numeral in the display face, sweeping + counting on change.
- **Ink-well gauge**: glass test-tube filling with accent liquid, looping wave surface, bubbles, faster slosh on hover. Great for quotas/usage.
- **Glass lanes**: horizontal glass tubes for comparisons.
- **Seals/stamps** as status markers (filled seal = good, hollow ring = pending, dashed = never).
- If a chart library is used, restyle everything: palette, gridlines at low alpha, glass tooltip, gradient area fill.
- **A live graph of who called what** (agents, stores, calls; Ishaan, Moovi synapse view, 2026-10-18): draw it as **nodes and lines**, not swimlanes or a timeline. The orchestrator in the middle, the workers round it, the stores as big jelly blobs outside with each thing asked budding on their rim; every call a pulse with a short tail along a gently bowed filament (never through the middle node), thicker the more it is used; things pop in when first used so the graph grows; unused workers rest faint; hover or click lights a node's own lines and dims the rest. Time lives in a scrubber under it, not on an axis. Once he picks a layout, ship that one only (no layout toggle).

## Lists and rows
- Glass list with white/60 dividers; row hover lightens; leading glyph well; serif title + muted subtitle; trailing dials, relative date (computed after mount), open arrow, and a lid-lifting delete.
- Filters as a glass segmented control with a sliding bead.

## Objects from the metaphor (use one or two per site)
- Postcard (auth): picture side with "Greetings from *Brand*", message side with perforated stamp (CSS radial mask), circular postmark with text on a path, faint address rules, pointer tilt.
- Ticket (billing/plan): glass ticket with notches (radial mask at the tear line), dashed perforation, a stub that tilts on hover, a vertical serial number.
- Arched window: rounded-top panel with mullions and a light streak, art inside, text over a bottom gradient.
- Emblem: engraved line-art badge with radial hairlines.

## Empty, loading, error states
- Empty: a small custom illustration (e.g. a floating sheet over an open folder), a two-line serif heading with an italic word, one action.
- Loading: skeleton in the page's shape + brand-object loader line (`motion.md`).
- Error: friendly, specific, with retry ("A passing *cloud*").

## The logo that becomes a working object
If the mark is an object from the world (a planisphere, a lens, a dial, a stamp), pay it off later in the page as a real, working, interactive version ("Luna's mark is one. This one works."): a draggable planisphere with a spring, a lens that magnifies, a dial that sets something.

## Device frames and gates
- Phone frames with elliptical percentage radii (`border-radius: 14% / 6.5%`) and everything inside sized in `em` from one clamped font-size, so the mock scales as one unit; render real computed screens inside, not screenshots.
- **Desktop gate** for phone-first products: an honest page ("X lives on your phone") listing what works in the preview vs what needs the phone, a QR code drawn in the palette, platform-aware install instructions, and "Preview on this computer" remembered in `localStorage`.

## Credits as a designed section
Real names of the tools, data and people behind the product, set big with tiny wide-tracked licence superscripts ("Open-Meteo · CC BY 4.0"). Honest and quietly premium.

## Captions and real data as decoration
Small, wide-tracked caps in the corners can carry *true* information that deepens the world: tonight's time and the place, coordinates, a timecode, a file name, a version. These are captions, not tags above headings; they must be real (computed or sourced), never decorative lies.

## Real UI in marketing
- Export presentational pieces from real features (verdict, list, dial, group) and give them `demo` props (no saving, links to public pages).
- Feed them sample data from one `samples` module using obviously fictional `.example` names; compute any derived data with the product's real logic.
- Make them breathe: auto-cycle states while in view, let clicks take over, animate value changes.

## Words on a live set (Ishaan, Moovi office, 2026-10-18)
- A scene that shows work (agents, desks, a graph) carries almost no text: names at rest, one short line only while something is happening, the one product label that matters (e.g. FalkorDB) and nothing under it.
- Never label a stand-in as a stand-in on screen (no "simulated", "sample run", "demo", fps or debug chips in the product UI); keep those in code comments and dev tools only.

## Waits, hand-offs and results (Ishaan, Moovi, 2026-10-18)
- **Never ask twice.** What the visitor already gave (a choice, words, a file) carries through every hand-off; if it is enough to start, the next screen starts it instead of showing the form again.
- **Every wait is the brand mark** (a route change, a hand-off, a busy button): the mark alone on the page colour, no words, no generic ring spinner. A mark that loops moves in steps with a rest between (a tick a second, landing with a little overshoot), never a constant spin.
- **Logo and favicon are one mark**: the same artwork, transparent, at every size. Keep the lockup simple: the word in a face that matches the mark's feel (Moovi: a heavy rounded face for a jelly mark), the mark beside it, no plate behind either; don't force the mark into a letter (Ishaan rejected the halo as the dot on the i).
- **Over the hero the header has no plates**: the nav and logo float on the hero; the one solid piece is the primary action (sign in), made of the site's material.
- **A finished result is shown alone**: the media in a clear glass frame over the blurred scene, one floating glass bar of icons under it (versions, download, change, minimise, close), no titles, meta or stats on screen.
