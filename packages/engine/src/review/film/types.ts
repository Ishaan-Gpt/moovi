/**
 * The review of a finished live preview: what is wrong with it, found by code first. P0 = the viewer sees a broken
 * frame (nothing on screen, text cut off the frame); P1 = a craft fault a senior editor would send back (a dead beat,
 * captions that drop the script's words); P2 = a lead worth knowing (a late hook, a repeated set-up).
 */
export type Severity = 'P0' | 'P1' | 'P2';

export interface Issue {
  sev: Severity;
  /** a stable name, so a repair or a lint table can key on it */
  code: 'empty-frame' | 'sparse-frame' | 'text-off-frame' | 'dead-beat' | 'late-hook' | 'end-card' | 'caption-gap' | 'repeat-setup' | 'player-error' | 'floor' | 'vision';
  /** the floor rule it breaks (review/floor.ts) */
  rule?: import('../floor').RuleId;
  /** the beat it belongs to (index into the film's beats), when it has one */
  beat?: number;
  /** the film time it was seen at */
  t?: number;
  text: string;
}

/** One sampled still and what code measured on it. */
export interface Frame {
  t: number;
  beat: number;
  setup: string;
  file: string;
  /** the player's own "is anything on screen" answer (null when the player has no such hook) */
  shown: boolean | null;
  /** text boxes that run past the frame edge by more than a few pixels, with their effective opacity k (0..1) */
  offFrame: { text: string; k: number }[];
  /** share of the frame with visible edges, 0..1 (ffmpeg edgedetect): near 0 = a bare background */
  detail: number;
}

export interface Review {
  style: string;
  id: string;
  duration: number;
  frames: Frame[];
  issues: Issue[];
  /** P0 count: anything here and the film should not be called checked */
  blocking: number;
  seconds: number;
  /** the model's look at the stills, when it was asked for */
  vision?: { ms: number; asked: number; found: number; skipped?: string; error?: string };
  /** the same findings on Lens's one scale and shape (review/lens.ts) */
  lens?: import('../lens').LensResult;
}

export const SEV_ORDER: Record<Severity, number> = { P0: 0, P1: 1, P2: 2 };
