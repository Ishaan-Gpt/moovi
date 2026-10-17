/**
 * CHECK (NORTH-STAR step 1): the rules and thresholds the review layer reads. Every number here is a default; the
 * active style or kit overrides any of them through the EDL's style_laws.review (a kit in packages/library sets it when
 * it builds the EDL, a D2.2 style sets it through STYLE_LAWS[id].review), so taste lives with the kit and the checks
 * live with the engine.
 */
import type { PlayerEdl } from '../edit/lib';

export interface ReviewConfig {
  /** filler and slop words a caption or a card label must not carry (lower case, whole words or phrases) */
  banned: string[];
  /** most words one caption shows at once */
  maxCaptionWords: number;
  /** most overlays (cards, inserts) on screen at the same moment */
  maxOverlays: number;
  /** the same card (kind and label, or asset) twice inside this many seconds is a repeat */
  repeatWindow: number;
  /** lowest WCAG contrast ratio between the caption fill and the pixels behind it (3 = AA for large text) */
  minContrast: number;
  /** platform UI the caption keeps out of, as fractions of the frame: top bar, bottom bar (caption, buttons), right rail */
  safe: { top: number; bottom: number; right: number };
  /** share of a caption box that may sit on a face before it counts (0 = any overlap) */
  faceOverlap: number;
  /** frames the pixel pass samples (at most 3) */
  frames: number;
  /** repairs the runner may make (at most 1 is applied) */
  repairs: { move: boolean; plate: boolean; dropDuplicate: boolean };
  /** the one vision review of the sampled frames (NORTH-STAR CHECK): off skips it; it is skipped anyway with no model that sees */
  vision: boolean;
  /** the vision review's budget in ms; past it the render ships without it */
  visionTimeoutMs: number;
  /** most findings the vision review may add */
  visionMaxIssues: number;
  /** a finding at or above this severity (1..5) counts as an error, below it as a warning */
  visionMinSeverity: number;
}

export const REVIEW_DEFAULTS: ReviewConfig = {
  banned: ['um', 'uh', 'umm', 'uhh', 'erm', 'hmm', 'mhm', 'you know', 'i mean', 'delve', 'game changer', 'game-changer', 'unlock the power', 'seamless', 'elevate your', 'in today\'s fast-paced world'],
  maxCaptionWords: 4,
  maxOverlays: 1,
  repeatWindow: 8,
  minContrast: 3,
  safe: { top: 0.1, bottom: 0.2, right: 0.1 },
  faceOverlap: 0,
  frames: 3,
  repairs: { move: true, plate: true, dropDuplicate: true },
  vision: true,
  visionTimeoutMs: 45_000,
  visionMaxIssues: 5,
  visionMinSeverity: 3,
};

export type ReviewOverride = Partial<Omit<ReviewConfig, 'safe' | 'repairs'>> & { safe?: Partial<ReviewConfig['safe']>; repairs?: Partial<ReviewConfig['repairs']> };

/** Defaults, then the style's laws, then the kit's (later wins); a bad value falls back to the default. */
export function reviewConfig(e: Pick<PlayerEdl, 'style_laws'> | null | undefined, ...more: (ReviewOverride | null | undefined)[]): ReviewConfig {
  const fromEdl = (e?.style_laws as { review?: ReviewOverride } | undefined)?.review;
  const out: ReviewConfig = { ...REVIEW_DEFAULTS, safe: { ...REVIEW_DEFAULTS.safe }, repairs: { ...REVIEW_DEFAULTS.repairs }, banned: [...REVIEW_DEFAULTS.banned] };
  for (const o of [...more, fromEdl]) {
    if (!o || typeof o !== 'object') continue;
    if (Array.isArray(o.banned)) out.banned = o.banned.filter(x => typeof x === 'string').map(x => x.toLowerCase());
    if (typeof o.vision === 'boolean') out.vision = o.vision;
    for (const k of ['maxCaptionWords', 'maxOverlays', 'repeatWindow', 'minContrast', 'faceOverlap', 'frames', 'visionTimeoutMs', 'visionMaxIssues', 'visionMinSeverity'] as const) {
      const v = o[k]; if (typeof v === 'number' && Number.isFinite(v) && v >= 0) out[k] = v;
    }
    if (o.safe) for (const k of ['top', 'bottom', 'right'] as const) { const v = o.safe[k]; if (typeof v === 'number' && v >= 0 && v < 0.5) out.safe[k] = v; }
    if (o.repairs) for (const k of ['move', 'plate', 'dropDuplicate'] as const) { const v = o.repairs[k]; if (typeof v === 'boolean') out.repairs[k] = v; }
  }
  out.frames = Math.min(3, Math.max(0, Math.round(out.frames)));
  out.visionMaxIssues = Math.min(10, Math.round(out.visionMaxIssues));
  out.visionTimeoutMs = Math.min(120_000, out.visionTimeoutMs);
  return out;
}
