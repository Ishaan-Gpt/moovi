import { blankTaste } from './common';
import type { TypeSpec } from './spec';

/** Showreel (decision 1: Clip Moment → Showreel; decision 9: R2 level-ladder, R5 night-glass). */
export const SHOWREEL: TypeSpec = {
  id: 'showreel',
  name: 'Showreel',
  status: 'partial',
  looks: [
    // Clip Moment fetches its clips at run time (footage assets, never catalogued), so its slice is its references' parts
    { id: 'clip-moment', name: 'Clip Moment', kind: 'style', role: 'main', src: 'packages/engine/src/styles/clip-moment.ts', slice: [],
      today: { caption: { value: 'cm-gold', src: 'packages/engine/src/edit/templates/clip-moment.ts:261 (CM_CAPTION)' } } },
  ],
  references: [
    { id: 'ref:r2', role: 'reference', name: 'R2 level-ladder' },
    { id: 'ref:r5', role: 'reference', name: 'R5 night-glass' },
  ],
  seeds: ['the reel kits (packages/library/src/kits/level-ladder, night-glass)'],
  toolRules: [
    { value: 'a stock clip per line, through the footage finder', src: 'packages/engine/src/edit/templates/clip-moment-run.ts' },
  ],
  ...blankTaste('showreel'),
};
