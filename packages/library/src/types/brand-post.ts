import { blankTaste } from './common';
import { pending, type TypeSpec } from './spec';

/** Today's arcs, by id (a test keeps them in step with the engine). */
export const EDITORIAL_ARCS = ['myth-truth', 'contrarian', 'origin', 'zoom-out', 'fable', 'stakes-ladder', 'before-after', 'one-number', 'customer-voice', 'day-in-life'];
export const DARKVOX_ARCS = ['fable', 'before-after', 'origin', 'stakes-ladder', 'myth-truth', 'day-in-life', 'zoom-out', 'contrarian', 'question-answer', 'one-number', 'customer-voice'];

/** Brand post (decision 1: Editorial → Brand post, Dark Vox as its story look; decision 9: R1, R3, R4). */
export const BRAND_POST: TypeSpec = {
  id: 'brand-post',
  name: 'Brand post',
  status: 'partial',
  looks: [
    { id: 's4', name: 'Editorial', kind: 'style', role: 'main', src: 'packages/engine/src/styles/s4.ts', slice: [{ runtime: 's4' }],
      today: { arcs: { value: EDITORIAL_ARCS, src: 'packages/engine/src/s4/library.ts:92 (ARCS_ALLOWED)' } } },
    { id: 'darkvox', name: 'Dark Vox', kind: 'style', role: 'story', src: 'packages/engine/src/styles/darkvox.ts', slice: [{ runtime: 'darkvox' }],
      today: { arcs: { value: DARKVOX_ARCS, src: 'packages/engine/src/styles/darkvox.ts:32 (DV_ARCS)' } } },
  ],
  references: [
    { id: 'ref:r1', role: 'reference', name: 'R1 crimson-poster' },
    { id: 'ref:r3', role: 'reference', name: 'R3 golden-hand' },
    { id: 'ref:r4', role: 'reference', name: 'R4 red-table' },
  ],
  seeds: [],
  toolRules: [],
  ...blankTaste('brand-post'),
  arcs: pending({ s4: EDITORIAL_ARCS, darkvox: DARKVOX_ARCS }, 'packages/engine/src/s4/library.ts:92, styles/darkvox.ts:32', 'W5 the Writer: arcs per type'),
};
