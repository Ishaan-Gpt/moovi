# Launch look "Product UI" (L-UI-1)

The first launch film Ishaan rated well (Resend v6, `data/freeform/resend-v6`, 2026-10-18), absorbed as a look that
any site can wear. Grammar from ref 1 (dump.cam): the product's own UI is the film.
1. The logo becomes the header bar, and the bar stays as the anchor.
2. A dense pile of the site's real content pops in.
3. Chaos becomes order in the product's grid, and a filter click re-flows it.
4. The camera dives into one tile, full-bleed on the real site.
5. A frosted search bar types over it and survives as the bridge; results fly around it.
6. The bar becomes the end pill, under the site's own headline.

- `player.html`: the look. It reads `data.json` and builds the palette ramp in the browser from the site's
  area-weighted computed colours (ishaan-motion `references/palette.md`, the palette gate). The dominant background
  decides the dark or light world, the tint of the neutrals becomes the ramp's hue, and a saturated colour with real
  weight is kept as the brand mark.
- `packages/engine/scripts/launch-ui.ts <https://site>`: one browser pass over the live site. It reads the colours,
  rendered fonts (the site's own when Google Fonts serves them), logo, images, nav, headings and call to action, takes
  five shots down the page (card crops; the busiest shot is the dive), writes `data.json`, serves it with byte ranges
  and writes `board.jpg`. Measured: linear.app gave a live preview in 17 s and the board in 24–28 s.
- **Open slot:** the brand's one product-only beat (Resend's was its email splitting into React code, a prop renamed
  live, the preview re-rendering). It's not generic yet. A Director writes it per brand.
