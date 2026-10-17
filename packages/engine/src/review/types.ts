export type Severity = 'error' | 'warn';
export type IssueKind = 'banned_word' | 'caption_words' | 'repeat' | 'overlays' | 'contrast' | 'face' | 'safe_zone' | 'collision' | 'burned_text' | 'vision';
export interface Box { x0: number; y0: number; x1: number; y1: number }
export interface Issue {
  kind: IssueKind; severity: Severity; t: number; msg: string;
  /** the caption chunk or insert index it is about */
  chunk?: number; insert?: number;
  /** measured value (contrast ratio, overlap share) */
  value?: number;
  /** the repair a finding asks for (the vision review names one; the code checks imply theirs by kind) */
  fix?: 'move' | 'plate' | 'drop';
}
export interface Review { issues: Issue[]; score: number; frames: { t: number; file?: string; contrast?: number }[] }
export const SEVERITY_COST: Record<Severity, number> = { error: 10, warn: 3 };
/** 100 less each issue's cost, never under 0: higher is better */
export const scoreOf = (issues: Issue[]) => Math.max(0, 100 - issues.reduce((s, i) => s + SEVERITY_COST[i.severity], 0));
