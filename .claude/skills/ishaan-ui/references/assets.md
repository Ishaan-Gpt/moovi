# Assets: everything custom

## 1. Icons (custom SVG, one hand)
Draw a set specific to the site; never import an icon library.
- Grid 24×24, stroke 1.4px, round caps and joins, `currentColor`.
- Give each a little **character**: a circle left open at one o'clock, a softly curved arrow shaft, a bin whose lid can lift, a handle ending in a spark. Slight imperfection reads as hand-drawn.
- **Duotone option** for primary nav: an accent "wash" shape slightly off-register behind the line, shown when active.
- Per-feature **glyphs** (one per tool/feature) in the same language, used on cards, inputs, menus and medallions.
- Keep them in one file; name by meaning (`IconLoupe`, `IcDossier`), not by shape.
- Template: `assets/icon-template.tsx`.

## 2. Logo mark + wordmark
A mark that expresses the visual idea (a loupe for clarity, a compass for direction, a seal for trust) drawn as engraver's lines; the wordmark in the display face (often italic). Also make a favicon version (filled background, bolder strokes).

## 3. Environment art (procedural, pre-rendered)
`scripts/render-art.mjs` builds painterly art from SVG primitives pushed through fractal-noise displacement, then rasterises to WebP with sharp:
- **Skies**: gradient + soft cloud banks (displaced, blurred ellipses) + paper grain + horizontal stroke texture. Vary seeds and warmth per section.
- **Foliage**: a branch with leaf clusters (seeded ellipses in 5–6 tones + highlights), transparent background; flip for the other side.
- **Landscape**: layered hills, misty tree line, a path; crop edges after displacement.
Adapt palettes to the brand (cool blue-greys + accent glow, or dusk roses, or night indigos). Run `node scripts/render-art.mjs`, inspect every output image, iterate. Keep images small (skies ~10KB, foliage ~200KB).

Why pre-render: live SVG filters stall the page and cause hydration mismatches; static images are fast and swappable.

Name every rendered file for its slot and keep its aspect ratio, so a real photo or painting can replace it 1:1 later; scenes that crossfade (dusk → night) must share exact positions (the same moon) so the swap reads as one place.

## 3b. Photography direction (physical goods, places, people)
Real photos beat everything when the product is physical. Write the art direction as part of the concept: light (hard morning side light, dusk, studio softbox), angle and distance, surfaces and props from the world, colour grade toward the two majors, and a numbered shot list with aspect ratio, crop and the slot each fills. Until the shoot exists, use procedural art, clean product renders or generation prompts in the exact aspect ratios, and placeholder frames labelled with the shot number, so swapping is mechanical.

## 4. Generated imagery (when the user can run an image model)
Write precise prompts with a shared style line, exact sizes and file names, so real paintings can replace procedural art 1:1. Example style line: "gouache / oil-pastel impressionist illustration, visible brush strokes, palette of <brand colours>, calm, editorial, no people, no text." Leave the procedural version in place until replaced.

## 5. Small illustrations and objects
Inline SVG drawn by hand: emblems (ring of hairline rays + a central object), empty-state scenes, error clouds, stamps, postmarks (text on a circular path + wavy cancellation lines). Use the palette, 1.2–1.6px lines, one accent fill.

## 6. Type as art
- **Giant wordmarks** (30–60% of the viewport) behind the protagonist or across the hero: a condensed editorial serif ("LUNA"), or letters built in the brand's material (inflated SVG tubes with a lighting filter; or 3D letters in the same renderer as the protagonist, see `3d.md`, only when the concept is 3D).
- **Two-script pairing**: a handwritten/script line crossing a big serif ("after dark" over "LUNA") gives an instant editorial cover feel.
- Puffy/inflated SVG letters: draw each glyph as a thick round-capped stroke, then one filter: blur the alpha into a dome → `feDiffuseLighting` + `feSpecularLighting` → composite onto the fill → soft offset shadow. Keep letters as separate elements so they can animate individually.

## 7. Real-data art
Draw the world from real data when the subject has it: a star field from a catalogue (magnitude → size/alpha), today's moon phase, a city's real skyline heights, real waveform peaks. It is more beautiful than random noise and it's honest. Render once to a canvas (or pre-render to an image), cap DPR, pause when offscreen.

Canvas craft for data skies and fields: paint once (no loop) and only repaint on resize or when data arrives; pre-paint both states of a toggle on two stacked canvases and crossfade with CSS; one cached radial-glow sprite drawn with `globalCompositeOperation = 'lighter'` instead of per-star gradients; `fillRect` for faint points; one batched path for lines; deterministic hash noise (no RNG state) so repaints match; DPR capped at 2; a gradient placeholder that fades when painted; fetch the dataset once with a memoised promise and draw the bright subset first.

## 8. Layered silhouettes
Landscapes as 3–5 SVG ridge paths in the palette's darks, each on its own parallax speed, with a soft haze gradient between them. Cheap, crisp at any size, perfect for night/nature/travel worlds.

## 9. Textures
- Paper grain: an SVG fractal-noise data URI at 6–9% opacity, overlay blend.
- Halftone dots: `radial-gradient` dots masked to a couple of soft regions over skies.
- Light streaks on glass: a blurred white bar rotated ~12°.

## 10. Never
Stock photos, icon packs, AI-looking orbs, clip-art, copied images from a reference site.
