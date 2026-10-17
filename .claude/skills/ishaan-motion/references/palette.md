# Palette: never the AI default, always a rare one, built as ramps (owner, 2026-10-18)

The owner's rule: never use the colours an AI reaches for by default. Blue, orange, cream and their usual pairings read
as "made by Claude" before a single frame moves. Every film gets a palette that is **rare, premium and owned**, built as
tint ramps so contrast is designed, not hoped for.

## Banned as a final palette (allowed only as idea #1, to be rejected)
These are the defaults every model and template ships. If the palette you are about to use is on this list, or is a
near neighbour of one (same hue family, same role), it is wrong.
- Blue or indigo + orange accent (`#3B82F6`, `#6366F1`, `#FF6B35`, `#F97316`, `#FF8A1F`, …)
- Cream / beige / paper + terracotta, burnt orange or brick (`#F5E9CF`, `#FBFAF6`, `#C2410C`, …)
- Navy + ice blue / sky / cyan "tech" (`#0B1220`, `#0F172A`, `#CFE6F7`, `#38BDF8`, …)
- Teal + orange, purple → pink gradients, "sunset" gradients
- Neon green or acid lime on black, hot red on black (the creator-reel cliché), gold on black
- Tailwind slate / zinc / gray as the neutral, pure `#000` / `#FFF` / `#808080` neutrals
- Yellow highlighter key words (`#FFD23F`, `#FFD84A`) and the green caption box
**First source, always: the brand's own website and logo** (owner, 2026-10-18: "ofc take the theme from the website and logo only"). Capture the live site (past its loader), read its CSS tokens, fonts and real assets (logo, character, UI) and build from those; an invented colour next to a brand that has its own is a cheap default. A brand palette wins over this list only when the brand **really** owns it (in its logo, site and product). Even then,
question it once (rule 0.6): if the brand colour is itself a default, keep it as the brand mark and build the film's
world around a rare palette that makes the brand colour look chosen.

## The 5-palette drill (before any frame is built)
Write five palettes, one line each with hex codes, then pick from #4 or #5 (ideation.md):
1. **The obvious one** (what any AI would pick for this topic). Name it to avoid it.
2. **The polished obvious** (the same hues, nicer).
3. **The reference's palette.**
4. **Steal from a material, place or era**: a pigment (oxblood, verdigris, lapis, raw umber, cadmium, bone black), a
   material (anodised titanium, oxidised copper, lacquer, smoked glass, wet slate, kraft), a place or light (Bombay
   monsoon dusk, a Tokyo pharmacy at night, a darkroom safelight), an era (1970s Swiss print, 1990s Sony).
5. **Steal from the footage and the product itself**: the dominant real colours in the speaker's shot (shirt, wall,
   skin, room light) and the product's own UI. The palette that grows out of the footage makes the graphics belong
   to the picture instead of floating on it.
Then the test: could this palette appear unchanged in another brand's video? If yes, go again.

## Building it: ramps, not swatches
- **Roles:** one dominant hue (about 60% of the frame's colour), one support hue (about 30%), one accent (10% at most,
  only on the hero word or the one thing that matters). Neutrals are **tinted** with the dominant hue (a near-black
  with 3–6% of the hue in it, a near-white the same), never pure grey, `#000` or `#FFF`.
- **A ramp per hue:** 9 steps (50 → 900) in OKLCH. Keep the hue angle fixed (±3°), walk lightness evenly, and pull
  chroma down at both ends (very light and very dark tints lose saturation, or they look neon or muddy). Write the
  ramp as tokens (`--h1-50 … --h1-900`), and every colour on screen is a token.
- **Contrast is designed from the ramps:** body text and captions at least 4.5:1 against what they sit on (check the
  real frame behind them, not the token), display type at least 3:1; pick the step that passes, never add a stroke or
  glow to rescue a failing colour. Light and dark worlds (look.md) use the same hues at opposite ends of the ramps.
- **Footage harmony:** grade the footage towards the palette (shadows into the dominant's dark end, a hint of the
  support in the highlights), so the picture and the graphics share one world.
- Glow and blooms use the accent's mid-ramp at low alpha, one per shot.

## Examples of the kind of palette that passes (never reuse one blindly; derive per film)
| Name | Dominant | Support | Accent | Neutrals | Born from |
|---|---|---|---|---|---|
| Oxblood + bone | oxblood `#4A1420` ramp | warm bone `#E9E1D3` | mineral chartreuse `#C9D85A` | aubergine-black `#140B0F`, bone-white `#F4EFE6` | a maroon shirt on a warm wall |
| Verdigris dusk | oxidised copper `#2F6B5E` | smoked plum `#3A2433` | sodium amber `#E2A33B` (sparingly) | ink `#0D1514`, fog `#E6ECE8` | copper roofs at monsoon dusk |
| Darkroom | safelight red `#8E1B12` | developer brown `#3B2A20` | silver `#C9CCCF` | carbon `#0E0C0B`, fixer white `#EFEDE8` | a photo darkroom |
Write the chosen palette, its five-palette drill and its ramps into the film's notes before building.

## The palette gate (owner, 2026-10-18: "white and purple don't match Resend's theme; the skill said not to use defaults")
The miss: the Resend film took the brand's world (black) from the site but invented the **content's** colours (white
email cards, a purple hero email, blue/green/red status dots). Every colour on screen counts, including the product's
own content (cards, emails, thumbnails, buttons, status dots, syntax colours) and any "hero" object. The rule had
been written, but nothing forced it to be checked. Now, before any frame is built:
1. **Read the site's real palette (30 seconds).** Fetch the page and its CSS, then count the colours and fonts:
   `curl -sL <site> -o home.html; for u in $(grep -o '/_next/static/[^"]*\.css' home.html | sort -u); do curl -sL "<site>$u" >> all.css; done`
   `grep -oiE '#[0-9a-f]{6}\b|#[0-9a-f]{3}\b' all.css home.html | cut -d: -f2 | tr A-F a-f | sort | uniq -c | sort -rn | head -25`
   `grep -oE 'font-family:[^;}]{0,80}' all.css | sort | uniq -c | sort -rn | head`
   (Other frameworks: take every `<link rel=stylesheet>`.) Resend gave black, white and warm stone greys (#c7c2bc,
   #ebeced, #a0a0a0, #464a4d), Domaine as the serif, ABC Favorit as the sans and Commit Mono: **no hue at all**.
2. **Write the drill into the film's notes** (five palettes, then the pick), and then the ramp as tokens (`ST[50…950]`).
3. **Every colour in the code is a token from that ramp.** Grep the film for hex values; any hex that is not a token,
   and not inside a real photo or footage, is a bug.
4. **A monochrome brand stays monochrome.** Colour enters only through real photos and footage. Status dots, syntax
   colours, buttons and "hero" cards come from the ramp's steps (light end = good or active, dark end = off or failed).
5. **Self-check on the board:** put the site capture beside our frames. If a colour in ours isn't in theirs, it's wrong.
