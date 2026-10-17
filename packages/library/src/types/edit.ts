import { blankTaste } from './common';
import { pending, type TypeSpec } from './spec';

/**
 * Edit my video (decision 3): the edit lane's five looks, laws kept. Base is the default look for now (Ishaan's call,
 * to be asked again when the look pick is built); the look pick inside the type is today's `pickEditStyle`.
 */
export const EDIT: TypeSpec = {
  id: 'edit',
  name: 'Edit my video',
  status: 'partial',
  looks: [
    { id: 'base', name: 'Base', kind: 'edit-look', role: 'default', src: 'packages/engine/src/edit/build.ts',
      // what the base edit casts from (edit/cast.ts): camera-layer moves, the EDL's cuts, overlays and end cards,
      // the player's caption styles, the sounds by event, the owner's grade baked into every upload (edit/restore.ts)
      slice: [{ runtime: 'camera-layer' }, { runtime: 'edl' }, { runtime: 'fx' }, { runtime: 'browser', category: 'caption' }, { runtime: 'mixer', category: 'sfx' }, { ids: ['grade:natural-punch'] }],
      today: {
        caption: { value: 'punch-duo', src: 'packages/engine/src/edit/build.ts:276' },
        grade: { value: 'grade:natural-punch', src: 'packages/engine/src/edit/restore.ts:39 (ownerGrade, baked into every upload)' },
      } },
    { id: 'atlas', name: 'Atlas', kind: 'edit-look', role: 'look', src: 'packages/engine/src/edit/styles.ts', slice: [{ editStyle: 'atlas' }],
      today: { caption: { value: 'atlas-two', src: 'packages/engine/src/edit/styles.ts (STYLE_LAWS.atlas.caption)' }, grade: { value: 'grade:warm-clean', src: 'packages/engine/src/edit/styles.ts (STYLE_LAWS.atlas.grade)' } } },
    { id: 'handmade', name: 'Handmade', kind: 'edit-look', role: 'look', src: 'packages/engine/src/edit/styles.ts', slice: [{ editStyle: 'handmade' }],
      today: { caption: { value: 'ed-serif', src: 'packages/engine/src/edit/styles.ts (STYLE_LAWS.handmade.caption)' }, grade: { value: 'grade:flat-bright-red', src: 'packages/engine/src/edit/styles.ts (STYLE_LAWS.handmade.grade)' } } },
    { id: 'studio-minimal', name: 'Studio Minimal', kind: 'edit-look', role: 'look', src: 'packages/engine/src/edit/styles.ts', slice: [{ editStyle: 'studio-minimal' }],
      today: { caption: { value: 'sm-two', src: 'packages/engine/src/edit/styles.ts (STYLE_LAWS["studio-minimal"].caption)' }, grade: { value: 'grade:teal-shadows', src: 'packages/engine/src/edit/styles.ts (STYLE_LAWS["studio-minimal"].grade)' } } },
    // Studio Cut draws its own pieces (edit/templates/studio-cut.ts); none are catalogued as library assets yet
    { id: 'studio-cut', name: 'Studio Cut', kind: 'edit-look', role: 'look', src: 'packages/engine/src/edit/templates/studio-cut.ts', slice: [] },
  ],
  references: [],
  seeds: ['Tab’s E1–E6 and I1–I6', 'R8 captions'],
  toolRules: [
    { value: 'the Editor’s preparation on every upload: measure, hear (language lock, Hinglish romanized), faces, burned text, pauses, upscale, grade LUT, voice clean-up, face crop', src: 'packages/engine/src/edit/job.ts, edit/restore.ts (decision 3)' },
    { value: 'the look: a look the brief names wins, else pickEditStyle(brief, words, burned), else Base; Studio Cut by name only', src: 'packages/engine/src/edit/styles.ts:28 (pickEditStyle), edit/job.ts:181' },
  ],
  ...blankTaste('edit'),
  arcs: pending({}, 'none: an edit keeps your words in your order (PIPELINE.html, Pick the script arc)', 'W5 the Writer'),
  musicEnergy: pending(null, 'today an edit gets music only when asked (decision 3, Ishaan’s call for now)', 'decision 7: the music board'),
  motionBranch: { ...blankTaste('edit').motionBranch, startsFrom: '.claude/skills/ishaan-motion/references/talking-head.md (decision 10)' },
};
