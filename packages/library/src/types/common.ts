import { pending, type TypeId, type TypeSpec } from './spec';

/**
 * The taste fields every type starts with: all empty and pending Ishaan (decisions 2, 5, 6, 7, 10, 11). A type spec
 * overrides a field only to record today's behaviour, never a new value.
 */
export function blankTaste(id: TypeId): Pick<TypeSpec, 'card' | 'arcs' | 'beatMap' | 'captionPreset' | 'grade' | 'musicEnergy' | 'sfxMarks' | 'floorOverrides' | 'motionBranch'> {
  return {
    card: pending(null, 'today the studio shows a style menu, not type cards', 'decisions 2 and 12: Ishaan approves the type-card copy'),
    arcs: pending({}, 'no arcs today', 'W5 the Writer: arcs per type'),
    beatMap: pending(null, 'no beat map per type today', 'Ishaan: length, hook time, beats, end card'),
    captionPreset: pending({ default: null, alternates: [] }, 'today each look sets its own caption (see looks[].today.caption)', 'decision 5: the caption gallery'),
    grade: pending(null, 'today each look sets its own grade (see looks[].today.grade)', 'Ishaan'),
    musicEnergy: pending(null, 'no music energy per type today', 'decision 7: the music board'),
    sfxMarks: pending({}, 'today every style casts sfx by event (assetsForEvent), with no per-type marks', 'decision 6: the sound board'),
    floorOverrides: pending({}, 'no per-type floor numbers today', 'decision 11: the floor-numbers page'),
    motionBranch: {
      path: `.claude/skills/ishaan-motion/branches/${id}.md`,
      data: `packages/library/src/types/${id}/motion.json`,
      startsFrom: null,
      numbers: pending({}, 'the branch is not written yet', 'decision 10: Ishaan writes every law and number'),
    },
  };
}
