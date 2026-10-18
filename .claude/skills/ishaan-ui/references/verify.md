# Verify: look at it like a reviewer

You can't judge motion, layering or a scroll story from code. Render it, look at the frames, fix, repeat. Do this after every meaningful slice, not just at the end.

## 1. What to capture
- **Desktop** ~1440×900 (and 1280×800 for tighter laptops) and **phone** ~390×844.
- **Load sequence**: a frame during the loader, right after it, and once every entrance has settled.
- **Every chapter** of a scroll story at a few points: start, middle, end of its choreography (e.g. 15%, 50%, 85% of the chapter).
- **States**: hover/focus on key controls, open menus, a form's loading/success/error, empty states.
- **Reduced motion** once (emulate `prefers-reduced-motion: reduce`).

## 2. How to capture
- If a browser preview tool is available, use it: navigate, scroll, screenshot, read console errors.
- If the preview pane is hidden or unavailable (frames don't paint in hidden panes), use `scripts/shoot.mjs`: it drives a local Chrome/Edge headless over the DevTools protocol, scrolls by expression, waits for scrubbed animations to settle, saves JPEGs and prints console errors and an fps readout.
  ```
  node scripts/shoot.mjs http://localhost:3000 ./shots --size 1440x900 --wait 6000 \
    --shots '[["hero",null,0],["story-mid","scrollTo(0, innerHeight*2)",2200]]'
  node scripts/shoot.mjs http://localhost:3000 ./shots --size 390x844 --wait 6000
  ```
- Compute scroll positions from the DOM rather than guessing: `document.querySelector('.chapter-x').offsetTop + innerHeight * 0.5`.
- Headless intros can take longer than real browsers; wait long enough for the first entrance before judging it.

## 3. What to look for in every frame
- Does it read in two seconds? One message per screen, nothing competing with the protagonist.
- Overlaps: decorative layers covering UI, text over busy art without contrast, elements cut by the viewport edge (a halo, a hand, a letter) when they shouldn't be.
- Rhythm and space: cramped margins, uneven gaps, orphaned words in headings.
- Motion states caught mid-way that look broken (stale cut-outs, doubled elements, a hand holding nothing).
- Phone: horizontal overflow, tap targets < 44px, the protagonist dwarfed or covering the copy, inputs < 16px (iOS zoom).
- Console: no errors, no hydration warnings.

## 4. Fix loop
List the gaps, fix the biggest three, recapture the same frames, compare. Stop when a fresh pass finds nothing you'd point out to a client. Then run `checklist.md`.

## 5. Report honestly
Say what you verified and how (sizes, which states, which tool), what you could not verify, and any numbers with their method ("~57 fps in headless Chrome, indicative only").
