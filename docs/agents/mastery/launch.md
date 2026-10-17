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
