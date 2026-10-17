import { blankTaste } from './common';
import type { TypeSpec } from './spec';

/** Kinetic type (decision 1: starts empty, built from about 5 references; decision 9: l02 seeds it). */
export const KINETIC: TypeSpec = {
  id: 'kinetic',
  name: 'Kinetic type',
  status: 'new',
  looks: [],
  references: [{ id: 'ref:l02', role: 'seed', name: 'l02' }],
  seeds: ['the kin-type caption (caption:kin-type)', 'the visual renderer’s kinetic captions'],
  toolRules: [],
  ...blankTaste('kinetic'),
};
