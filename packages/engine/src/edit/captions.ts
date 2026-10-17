import type { CaptionStyle } from './lib';

/**
 * The first caption styles from docs/agents/research/R8-captions.md, as data the player draws. Colours are roles the
 * edit style's palette resolves. R8 names fonts by family; until those are vendored, each maps to the closest one
 * already in engine/assets/renderer/fonts (all OFL): Montserrat and Archivo Black → Archivo 900, Bebas → Anton,
 * Poppins → Plus Jakarta Sans, Space Grotesk → Geist.
 */
export const CAPTION_STYLES: CaptionStyle[] = [
  { id: 'punch-slam', family: 'punch', energy: 5, font: { family: 'Anton', weight: 400, case: 'upper', tracking: 0.01 }, size: 'XL',
    chunk: { mode: 'word', maxChars: 14, breakOnPause: 0.5 }, look: { fill: 'paper', stroke: { px: 8, role: 'ink' }, shadow: 'hard' },
    highlight: { rule: 'current', treat: 'colour', role: 'accent' }, entry: 'stamp', position: 'face-safe' },
  { id: 'punch-duo', family: 'punch', energy: 5, font: { family: 'Archivo', weight: 900, case: 'upper', tracking: 0 }, size: 'L',
    chunk: { mode: '2w', maxChars: 16, breakOnPause: 0.5 }, look: { fill: 'paper', stroke: { px: 6, role: 'ink' } },
    highlight: { rule: 'current', treat: 'colour', role: 'accent' }, entry: 'pop', position: 'face-safe' },
  { id: 'kara-block', family: 'karaoke', energy: 4, font: { family: 'Archivo', weight: 900, case: 'upper', tracking: 0 }, size: 'L',
    chunk: { mode: '3w', maxChars: 20, breakOnPause: 0.5 }, look: { fill: 'paper', stroke: { px: 4, role: 'ink' } },
    highlight: { rule: 'current', treat: 'box', role: 'accent' }, entry: 'pop', position: 'face-safe' },
  { id: 'kara-sweep', family: 'karaoke', energy: 3, font: { family: 'Archivo', weight: 800, case: 'upper', tracking: 0 }, size: 'L',
    chunk: { mode: '3w', maxChars: 20, breakOnPause: 0.5 }, look: { fill: 'paper', stroke: { px: 3, role: 'ink' }, shadow: 'soft' },
    highlight: { rule: 'current', treat: 'colour', role: 'accent' }, entry: 'none', position: 'face-safe' },
  { id: 'clean-keyword', family: 'clean', energy: 2, font: { family: 'Inter', weight: 600, case: 'as-is', tracking: -0.01 }, size: 'M',
    chunk: { mode: 'phrase', maxChars: 24, breakOnPause: 0.45 }, look: { fill: 'paper', shadow: 'soft' },
    highlight: { rule: 'keyword', treat: 'colour', role: 'accent' }, entry: 'fade', position: 'lower' },
  { id: 'ed-mixed', family: 'editorial', energy: 3, font: { family: 'Inter Tight', weight: 700, case: 'as-is', tracking: -0.02 }, size: 'L',
    chunk: { mode: '3w', maxChars: 18, breakOnPause: 0.5 }, look: { fill: 'paper', shadow: 'soft' },
    highlight: { rule: 'keyword', treat: 'colour', role: 'paper' }, entry: 'blur-in', position: 'face-safe',
    key: { family: 'Instrument Serif', weight: 400, case: 'as-is', size: 'XL', role: 'paper', italic: true } },
  { id: 'box-label', family: 'boxed', energy: 3, font: { family: 'Geist', weight: 700, case: 'upper', tracking: 0.02 }, size: 'M',
    chunk: { mode: '3w', maxChars: 20, breakOnPause: 0.5 }, look: { fill: 'paper', box: 'pill' },
    highlight: { rule: 'keyword', treat: 'colour', role: 'accent' }, entry: 'slide-up', position: 'chest' },
  { id: 'kin-type', family: 'kinetic', energy: 3, font: { family: 'JetBrains Mono', weight: 500, case: 'as-is', tracking: 0 }, size: 'M',
    chunk: { mode: 'phrase', maxChars: 22, breakOnPause: 0.5 }, look: { fill: 'paper', shadow: 'soft' },
    highlight: { rule: 'none', treat: 'colour' }, entry: 'typewriter', position: 'lower' },
  // D2.2 Atlas (R4 style 1): tier-two with readable connectors (M) and a heavy condensed key word, 2 to 4 words a group (a lone word joins its neighbour)
  { id: 'atlas-two', family: 'punch', energy: 4, font: { family: 'Inter', weight: 700, case: 'lower', tracking: -0.01 }, size: 'M',
    chunk: { mode: '3w', maxChars: 22, breakOnPause: 0.45, minWords: 2, maxWords: 4, together: true }, look: { fill: 'paper', shadow: 'soft' },
    highlight: { rule: 'keyword', treat: 'colour', role: 'accent' }, entry: 'pop', position: 'chest',
    key: { family: 'Anton', weight: 400, case: 'upper', size: 'XL', role: 'accent', line: true } },
  // D2.2 Handmade (R4 style 3): a serif italic lowercase subtitle, bottom centre, a phrase at a time (R8 ed-serif); large with a thin deep outline so it reads on bright walls, the phrase up as a whole, no lone word
  // v4: XXL (130 px on 1080) after root QA of handmade-v3 ("still small"), phrases of 2 to 5 words so two lines at most
  // v5: the white serif had low contrast on bright pavement (root QA of handmade-v4): an 8 px deep outline (painted under the fill, so 4 px shows) and a lifted dark shadow
  { id: 'ed-serif', family: 'editorial', energy: 1, font: { family: 'Instrument Serif', weight: 400, case: 'lower', tracking: 0, italic: true }, size: 'XXL',
    chunk: { mode: 'phrase', maxChars: 20, breakOnPause: 0.6, minWords: 2, maxWords: 5, together: true }, look: { fill: 'paper', stroke: { px: 8, role: 'deep' }, shadow: 'lift' },
    highlight: { rule: 'none', treat: 'colour' }, entry: 'fade', position: 'lower' },
  // D2.2 Studio Minimal (R4 style 2): tier-two at a size that reads on a phone (connectors M, not S), 2 to 4 words a
  // group that come up together, the key word heavy and orange; never a lone word (sm-v1: 'uaw' alone, 34 px)
  { id: 'sm-two', family: 'punch', energy: 4, font: { family: 'Inter', weight: 700, case: 'lower', tracking: -0.01 }, size: 'M',
    chunk: { mode: '3w', maxChars: 22, breakOnPause: 0.45, minWords: 2, maxWords: 4, together: true }, look: { fill: 'paper', shadow: 'soft' },
    highlight: { rule: 'keyword', treat: 'colour', role: 'accent' }, entry: 'fade', position: 'chest',
    key: { family: 'Archivo', weight: 900, case: 'upper', size: 'XL', role: 'accent', line: true } },
  { id: 'sub-box', family: 'subtitle', energy: 1, font: { family: 'Inter', weight: 600, case: 'as-is', tracking: 0 }, size: 'S',
    chunk: { mode: 'line', maxChars: 38, breakOnPause: 0.7 }, look: { fill: 'paper', box: 'block' },
    highlight: { rule: 'none', treat: 'colour' }, entry: 'none', position: 'lower' },
  { id: 'tech-chip', family: 'tech', energy: 3, font: { family: 'Geist', weight: 600, case: 'as-is', tracking: 0 }, size: 'M',
    chunk: { mode: '3w', maxChars: 20, breakOnPause: 0.5 }, look: { fill: 'paper', box: 'chip' },
    highlight: { rule: 'number', treat: 'colour', role: 'accent' }, entry: 'slide-up', position: 'chest' },
  // added after R4: Atlas's signature, a small white connector line over a big key word in the accent
  { id: 'tier-two', family: 'punch', energy: 4, font: { family: 'Inter', weight: 600, case: 'lower', tracking: -0.01 }, size: 'S',
    chunk: { mode: 'phrase', maxChars: 26, breakOnPause: 0.45 }, look: { fill: 'paper', shadow: 'soft' },
    highlight: { rule: 'keyword', treat: 'colour', role: 'accent' }, entry: 'fade', position: 'chest',
    key: { family: 'Archivo', weight: 900, case: 'upper', size: 'XL', role: 'accent', line: true } },
  // added for clip-moment (Tab, 2026-10-16; v3: kinetic word entrances): Inter 900 caps in 1 to 3 word groups, the spoken word in the accent
  // (#FFD84A), the line's accent word in a gold italic serif (clip-moment's palette sets 'pop' to gold #FFC93C; Instrument Serif is the bundled serif)
  { id: 'cm-gold', family: 'punch', energy: 5, font: { family: 'Inter', weight: 900, case: 'upper', tracking: 0 }, size: 'L',
    chunk: { mode: '3w', maxChars: 18, breakOnPause: 0.5 }, look: { fill: 'paper', stroke: { px: 5, role: 'ink' }, shadow: 'soft' },
    highlight: { rule: 'current', treat: 'colour', role: 'accent' }, entry: 'kinetic', position: 'face-safe',
    key: { family: 'Instrument Serif', weight: 400, case: 'upper', size: 'XL', role: 'pop', italic: true } },
];

/** By R8 slug or by library id (`caption:<slug>`, the form an EDL holds). */
export const captionStyle = (id: string) => CAPTION_STYLES.find(s => s.id === id.replace(/^caption:/, '')) ?? CAPTION_STYLES[0]!;

/** @font-face rules for the fonts the styles above use (served by the players from /engine/fonts). */
export const CAPTION_FONTS = [
  ['Anton', 'anton-latin-400-normal.woff2', '400'],
  ['Archivo', 'archivo-latin-wdth-normal.woff2', '100 900'],
  ['Inter', 'inter-latin-wght-normal.woff2', '100 900'],
  ['Inter Tight', 'inter-tight-latin-wght-normal.woff2', '100 900'],
  ['Instrument Serif', 'instrument-serif-latin-400-italic.woff2', '400', 'italic'],
  ['Geist', 'geist-latin-wght-normal.woff2', '100 900'],
  ['JetBrains Mono', 'jetbrains-mono-latin-wght-normal.woff2', '100 800'],
].map(([f, file, w, style]) => `@font-face{font-family:'${f}';src:url(/engine/fonts/${file}) format('woff2');font-weight:${w};font-style:${style ?? 'normal'}}`).join('\n');
