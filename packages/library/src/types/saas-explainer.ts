import { ARCS as STYLE1_ARCS } from '../style-1/scenes';
import { blankTaste } from './common';
import { pending, type TypeSpec } from './spec';

/** Today's arcs, by id (a test keeps them in step with the engine). */
export const CLEAR_SIGNAL_ARCS = ['pain-turn', 'myth-truth', 'how-it-works', 'one-number', 'before-after', 'question-answer', 'three-things', 'versus', 'checklist', 'stakes-ladder', 'contrarian', 'zoom-out', 'inside-machine'];
export const ANATOMY_ARCS = ['inside-machine', 'how-it-works', 'three-things', 'versus', 'zoom-out', 'one-number', 'before-after', 'checklist', 'question-answer', 'stakes-ladder'];
const S1_ARCS = Object.keys(STYLE1_ARCS);

/** SaaS explainer (decision 1: Style 1 + Clear Signal → SaaS explainer, Anatomy as its "how it works" look). */
export const SAAS_EXPLAINER: TypeSpec = {
  id: 'saas-explainer',
  name: 'SaaS explainer',
  status: 'partial',
  looks: [
    { id: 's1', name: 'Style 1', kind: 'style', role: 'main', src: 'packages/engine/src/styles/s1.ts', slice: [{ runtime: 's1' }, { runtime: 'style1' }],
      today: { arcs: { value: S1_ARCS, src: 'packages/library/src/style-1/scenes.ts (ARCS)' } } },
    { id: 's5', name: 'Clear Signal', kind: 'style', role: 'main', src: 'packages/engine/src/styles/s5.ts', slice: [{ runtime: 's5' }],
      today: { arcs: { value: CLEAR_SIGNAL_ARCS, src: 'packages/engine/src/s5/library.ts:117 (S5_ARCS)' } } },
    { id: 'anatomy', name: 'Anatomy', kind: 'style', role: 'how-it-works', src: 'packages/engine/src/styles/anatomy.ts', slice: [{ runtime: 'anatomy' }],
      today: { arcs: { value: ANATOMY_ARCS, src: 'packages/engine/src/styles/anatomy.ts:22 (ANATOMY_ARCS)' } } },
  ],
  references: [],
  seeds: ['Style 1 plans', 'Anatomy figures'],
  toolRules: [],
  ...blankTaste('saas-explainer'),
  arcs: pending({ s1: S1_ARCS, s5: CLEAR_SIGNAL_ARCS, anatomy: ANATOMY_ARCS }, 'style-1/scenes.ts ARCS, s5/library.ts:117, styles/anatomy.ts:22', 'W5 the Writer: arcs per type'),
};
