// Style 1 backgrounds (1080x1920) and brand assets. Source: MotionEasy styles/style-1/backgrounds/ (README.md, spec.json) and brands/, assets/logos/.
import type { Background, MediaRef } from '../types';

const bg = (id: string, name: string, use: string): Background => ({
  id, kind: 'image', file: `backgrounds/${name}`, source: `styles/style-1/backgrounds/${name}`, use,
});

export const backgrounds: Background[] = [
  bg('white', 'bg-white.png', '#FFFFFF. Text-only beats (lists, "you get...").'),
  bg('offwhite', 'bg-offwhite.png', '#F6F6F6. Default stage.'),
  bg('grey', 'bg-grey.png', '#F2F2F2. Card stacks and screenshots, so cards read brighter than the floor.'),
  bg('offwhite-grid-panel', 'bg-offwhite-grid-panel.png', 'Off-white with an 8x9 dashed grid patch centred behind a phone, product or hero object.'),
  bg('offwhite-grid-full', 'bg-offwhite-grid-full.png', 'Full-frame grid. Variation, use sparingly.'),
  bg('white-dots', 'bg-white-dots.png', 'Dots only, no lines. Quiet variation for text beats.'),
  bg('white-plus', 'bg-white-plus.png', 'Field of small "+" marks. Behind lists and icons.'),
  bg('overlay-plus', 'overlay-plus.png', 'Transparent "+" layer over any tone; animate with a slow drift or parallax.'),
  bg('overlay-grid-panel', 'overlay-grid-panel.png', 'Transparent grid patch layer to put over any tone and animate.'),
  bg('overlay-grid-full', 'overlay-grid-full.png', 'Transparent full-frame grid layer.'),
  bg('overlay-dots', 'overlay-dots.png', 'Transparent dots layer.'),
  // Measured values (tones, grid 108x92, lines #D9D9D9, plus step 90) the PNGs are generated from by styles/tools/backgrounds.py.
  { id: 'spec', kind: 'procedural', file: 'backgrounds/spec.json', source: 'styles/style-1/backgrounds/spec.json', use: 'Measured values the background PNGs are generated from; edit and regenerate to change them.' },
];

const ref = (file: string, source: string): MediaRef => ({ file: `brand/${file}`, source: `styles/style-1/${source}` });

/** Brand configs (accent, font, watermark, CTA) and the shipped logo SVGs. muse/requests.json is a work queue, not an asset. */
export const brandAssets: MediaRef[] = [
  ref('captionseasy.json', 'brands/captionseasy.json'),
  ref('eegnite.json', 'brands/eegnite.json'),
  ref('neutral.json', 'brands/neutral.json'),
  ref('oped.json', 'brands/oped.json'),
  ref('logos/blender/ready.svg', 'assets/logos/blender/ready.svg'),
  ref('logos/blender/asset.json', 'assets/logos/blender/asset.json'),
  ref('logos/claude/brand.svg', 'assets/logos/claude/brand.svg'),
  ref('logos/claude/white.svg', 'assets/logos/claude/white.svg'),
  ref('logos/figma/ready.svg', 'assets/logos/figma/ready.svg'),
  ref('logos/figma/asset.json', 'assets/logos/figma/asset.json'),
  ref('logos/inkscape/ready.svg', 'assets/logos/inkscape/ready.svg'),
  ref('logos/inkscape/asset.json', 'assets/logos/inkscape/asset.json'),
  ref('logos/openai/white.svg', 'assets/logos/openai/white.svg'),
];
