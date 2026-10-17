import { blankTaste } from './common';
import { pending, type RefLink, type TypeSpec } from './spec';

/** The twelve launch references (decision 9: l01–l12 → Launch). */
export const LAUNCH_REFS = ['l01', 'l02', 'l03', 'l04', 'l05', 'l06', 'l07', 'l08', 'l09', 'l10', 'l11', 'l12'] as const;

/** Today's Launch arcs, by id (packages/engine/src/launch/arcs.ts LAUNCH_ARCS; a test keeps the two in step). */
export const LAUNCH_ARC_IDS = ['launch-pain-turn', 'launch-manifesto', 'launch-question', 'launch-since', 'launch-verbs', 'launch-day-night', 'launch-one-number', 'launch-chapters', 'launch-verdict', 'launch-prompt'];

/** Launch (decision 1: Launch → Launch). */
export const LAUNCH: TypeSpec = {
  id: 'launch',
  name: 'Launch',
  status: 'partial',
  looks: [
    { id: 'launch', name: 'Launch', kind: 'style', role: 'main', src: 'packages/engine/src/styles/launch.ts', slice: [{ runtime: 'launch' }],
      today: { arcs: { value: LAUNCH_ARC_IDS, src: 'packages/engine/src/launch/arcs.ts:18 (LAUNCH_ARCS)' } } },
  ],
  references: LAUNCH_REFS.map((id): RefLink => ({ id: `ref:${id}`, role: 'reference', name: id })),
  seeds: [],
  toolRules: [
    { value: 'a link: the site is read and captured (real icon and site shots) beside the brief and the music', src: 'packages/engine/src/styles/launch.ts:7 (captureSite, launch/capture.ts)' },
    { value: 'the music is measured to a beat grid', src: 'packages/engine/src/launch/audio.ts (decision 7)' },
  ],
  ...blankTaste('launch'),
  arcs: pending({ launch: LAUNCH_ARC_IDS }, 'packages/engine/src/launch/arcs.ts:18 (LAUNCH_ARCS)', 'W5 the Writer: arcs per type'),
  motionBranch: { ...blankTaste('launch').motionBranch, startsFrom: 'docs/LAUNCH.md laws (decision 10)' },
};
