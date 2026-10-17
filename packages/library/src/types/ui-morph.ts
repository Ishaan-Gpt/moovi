import { blankTaste } from './common';
import type { TypeSpec } from './spec';

/** UI morph (decision 1: starts empty, built from about 5 references; decision 9: l09 and l06 seed it). */
export const UI_MORPH: TypeSpec = {
  id: 'ui-morph',
  name: 'UI morph',
  status: 'new',
  looks: [],
  references: [
    { id: 'ref:l09', role: 'seed', name: 'l09' },
    { id: 'ref:l06', role: 'seed', name: 'l06' },
  ],
  seeds: ['the 109 library UI pieces'],
  toolRules: [],
  ...blankTaste('ui-morph'),
};
