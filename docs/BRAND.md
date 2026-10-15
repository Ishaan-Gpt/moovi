# Brand: palette (decided 2026-10-12: icy white + ice blue)

Rule: **two majors**, icy white and ice blue. Everything else is minor, at no more than about 10% of any screen. The Director inherits the same split: an icy-white body, ice-blue accents, an aurora-sheen halo and ice-glow eyes.

| Token | Hex | Use |
|---|---|---|
| `ice-white` (major 1) | `#F7FAFD` | Page background, the Director's body |
| `surface` | `#FFFFFF` | Cards, panels |
| `ice` (major 2) | `#CFE6F7` | Big colour fields, accents, glow, the Director's collar, gloves and soles |
| `ice-soft` | `#E6F2FB` | Tinted sections, hover fills |
| `deep-ice` | `#2B67C6` | CTAs, focus rings, links. 5.2:1 contrast on white. |
| `ink` | `#0E1A2B` | Text, line work, the visor glass |
| `ink-muted` | `#5B6B80` | Secondary text |
| `hairline` | `#E3EBF3` | Borders, dividers |
| `frost-ink` | `#3F6E9F` | Landing text: a light icy blue, never black or navy. 5.1:1 on ice-white. |
| `frost-muted` | `#4C76A3` | Landing secondary text. 4.5:1 on ice-white. |
| `frost-hi` → `frost-mid` → `glacier` (`#A9D6F6` → `#7DB7EA` → `#5394DA`) | `--ce-ice-text` | The ice gradient on landing display type (headlines, names, statements), painted per letter. `glacier` is also the landing accent (CTAs, links); the landing uses no `deep-ice`. |
| `aurora-mint` (minor) | `#D2F5EC` | Iridescent shift on the halo and highlights only |
| `aurora-lilac` (minor) | `#E3DEFF` | Iridescent shift on the halo and highlights only |
| `signal` (semantic minor) | `#C8463D` on `#FBE9E7` | Studio only: a line the truth guard rejected, a raised issue. Tiny areas. |
| `pass` (semantic minor) | `#1F7A5A` | Studio only: a check that passed. Tiny areas. |

The **surreal quality** comes from the aurora sheen: the ice blue shifting to mint and lilac at grazing angles. That's three.js `iridescence` on the halo, and a sparing conic sheen on hero highlights. Everything else is flat, calm and frosty.

These values become `packages/brand/tokens.ts` and CSS variables.

**Landing type (2026-10-14):** Manrope (UI and body, a calm slightly rounded grotesk) with Fraunces at full SOFT, no WONK (the expressive italic lines; its rounded terminals echo the jelly) and DM Mono (timecodes). Text is never black on the landing: frost ink for reading, the ice gradient for display type.

**Mark:** the halo as a jelly wheel (a ring, eight spokes from a hub, a ball on every tip), the same wheel Moovi wears. It is the logo, the favicon, the loader and the busy spinner, and in every one of them it is the halo itself: a render of Moovi's own SDF halo (same jelly material), saved as `apps/landing/public/brand/halo.webp` and `halo-128.webp`, with `app/icon.png` and `app/apple-icon.png` made from it. Never redraw it as flat vector art.
