import type { Outcome, TaskCtx } from '../ctx';

/**
 * The Showreel preset's entry (decision 19). STUB: the Showreel session owns the real `showreel(input)` and names it to
 * Claude 1; when it lands, this body calls it (one line). Until then it answers null and the preset says it is not
 * ready (router/presets.ts). Nothing here falls back to an old style pipeline (decision 18).
 */
export interface ShowreelInput {
  /** the user's words: a topic or a brief (may contain the link) */
  text: string;
  /** a site link found in the words */
  url?: string;
  /** the brief's uploads (ids in the chat's graph) */
  uploads: string[];
}

export async function showreel(_input: ShowreelInput, _ctx: TaskCtx): Promise<Outcome | null> {
  return null;
}
