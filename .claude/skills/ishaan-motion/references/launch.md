# Launch films: the branch (taste from Ishaan's verdicts, 2026-10-18)

This is what Ishaan judged better on resend.com, version by version. The log and boards are in
`docs/agents/mastery/launch.md`, the films in `data/freeform/resend*`. The old Launch library (12 looks, 10 arcs,
~400 graph parts) scored about 2/10 and is not a taste source.

## What won, in order
1. **A bespoke film beats re-skinned parts.** One film written for this one product, from a strong prompt, beat the
   whole cast-from-the-graph pipeline (f1 > p0). The same prompt plus this skill did a little better again (f2 > f1).
2. **The product's own UI is the film** (ref 1, dump.cam; f3 > f2). There are no headline cards. The words on screen
   are the UI's own: a page title, the filter pills, the search box, the call to action.
   - The logo becomes the header bar, and the bar stays as the anchor across the film.
   - A dense, colourful pile of the product's real content (for an email API: designed emails) grows fast, every item
     popping in on a jittered stagger with its own sound.
   - **Chaos, then order:** the pile flies into the product's own grid, and a filter click re-flows it.
   - **Dive into one tile, full-bleed.** A bridge element (a frosted search bar) appears on it, types, and survives the
     tile shrinking away. Results fly in around the bar, and the bar becomes the end pill.
3. **Real photos, plus one beat only this product can have** (f4 > f3).
   - Emails carry real photos (from the footage finder, licence recorded), never drawn blocks.
   - The product's own mechanic, performed: the email splits into its React source, a cursor renames a prop, and the
     phone preview re-renders live. A Dark toggle recolours it.
   - Depth of field hands over from a busy split to the next bridge element, so there is one text layer.
4. **The brand's own look, from its live site** (f5, awaiting a verdict). Read the site capture first: palette, display
   face, logo, the hero's light. Resend is black, with one light beam, a serif display face and a sharp R. A
   reference's world (dump's light grey) is grammar to learn from, never a palette to copy.
5. **The content wears the brand too** (Ishaan on f5: "white and purple don't match Resend's theme"). The product's
   own content (emails, cards, buttons, status dots, code colours) is built from the site's ramp, never invented. For
   Resend: warm stone from black to bone, the Light/Dark toggle swapping the ramp's ends, and colour only from real
   photos. Run the palette gate in `palette.md` before the first frame.

## Checks that caught real bugs
- **A filter must show what it says.** After "Delivered", only delivered items remain; otherwise the viewer reads it as
  wrong.
- **An active pill's label must flip colour with the thumb that slides under it.** White text on the white thumb
  disappears.
- **Thumbnails never sit on a title.** Put a photo thumb beside the button, not beside the heading.
- **Items that fly out must clear the frame completely.** A white sliver at the edge reads as an error.
