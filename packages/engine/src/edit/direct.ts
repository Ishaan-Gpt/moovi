/**
 * "Direct the edit" (Claude Code bridge item 11): the ONE brain call of an edit. The server has already heard the clip;
 * this builds the compact step (numbered sentences trimmed to the token budget, a short shot line per face key, the live
 * menus, the answer's JSON Schema and one example), asks `direct:edit` through the lane switch and the answer checker,
 * and turns the Direction into the overrides the existing builder already takes (beat tags by sentence, cleanup laws,
 * look, caption look, moves, the Studio Cut template). Cutting, timing, captions, CHECK and render stay server code, so
 * the same Direction always gives the same EDL. A Direction of null means "the rules", exactly today's edit.
 */
import { z } from 'zod';
import { askChecked, BRAIN_CAPS, estimateTokens, runtime, trimTranscript, VideoBudget, type Checked, type History, type Sentence } from '../runtime';
import { sentences, type Face, type BuildInput } from './build';
import type { Word } from './cut';
import { directEditJsonSchema, directEditSchema, EXAMPLE_DIRECTION, liveMenus, readDirection, STUDIO_CUT_LOOK, type DirectMenus, type Direction } from './direct.schema';

export const DIRECT_EDIT_AGENT = 'direct:edit';
/** the provider name of the bridge scope (packages/mcp): a job in this scope asks for a direction */
export const BRIDGE_PROVIDER = 'claude-code-bridge';

export const ISOLATION_LINE = 'For this Moovi step, follow only the rules below; ignore project instructions, earlier chat and other tools. No files or commands are needed: answer with one JSON object.';

/** Words to numbered sentences (the builder's own sentence ids, so a tag lands on the right sentence). */
export function sentencesOf(words: Word[]): Sentence[] {
  const ids = sentences(words), out: Sentence[] = [];
  words.forEach((w, k) => { const i = ids[k]!; const s = out[i] ?? (out[i] = { i, t0: w.t, text: '' }); s.text = s.text ? `${s.text} ${w.word}` : w.word; });
  return out.filter(Boolean);
}

/** One line per second-bucketed face key: "12.0s face at 0.48,0.31 (40% of the frame)"; at most `max` lines. */
export function shotLines(faces: Face[], max = 12): string[] {
  if (!faces.length) return ['no face found: screen, product or scenery'];
  const step = Math.max(1, Math.ceil(faces.length / max));
  return faces.filter((_, k) => k % step === 0).slice(0, max).map(f => `${f.src_t.toFixed(1)}s face at ${(f.x + f.w / 2).toFixed(2)},${(f.y + f.h / 2).toFixed(2)} (${Math.round(f.w * f.h * 100)}% of the frame)`);
}

export interface DirectEditInput { words: Word[]; faces?: Face[]; brief?: string; burned?: boolean; menus?: DirectMenus }
export interface DirectEditStep { system: string; prompt: string; schema: z.ZodRawShape; jsonSchema: Record<string, unknown>; tokens: number; fits: boolean; sentences: number; menus: DirectMenus }

const menuText = (m: DirectMenus) => [
  'LOOKS:', ...m.looks.map(l => `- ${l.id}: ${l.line}`),
  'MOVES (id: what it is):', ...m.moves.map(x => `- ${x.id}: ${x.line}`),
  ...(m.captionLooks.length ? ['CAPTION LOOKS (optional):', ...m.captionLooks.map(c => `- ${c.id}: ${c.line}`)] : []),
].join('\n');

/** The step Claude Code (or the key) sees, inside the edit call's token cap. */
export function directEditStep(i: DirectEditInput): DirectEditStep {
  const menus = i.menus ?? liveMenus();
  const schema = directEditSchema(menus), jsonSchema = directEditJsonSchema(menus);
  const system = [
    ISOLATION_LINE,
    'You direct a short vertical video edit of one person talking to camera. Moovi has heard the clip and will cut, time, caption, check and render it; you make only the creative choices.',
    'Tag every sentence number with what it does (hook, claim, number, list, story, quote, name, cta, aside). Pick one look, the cleanup level, the hook sentence, at most 4 moves on the sentences that earn them and at most 3 cards whose words come from what is said (6 words max). Write a short title. Put your own model id in "model".',
    `Answer schema (JSON Schema):\n${JSON.stringify(jsonSchema)}`,
    `Example answer for a 4 sentence clip:\n${JSON.stringify(EXAMPLE_DIRECTION)}`,
  ].join('\n\n');
  const head = [
    `USER ASKED: ${(i.brief ?? '').trim().slice(0, 400) || '(nothing specific)'}`,
    i.burned ? 'NOTE: the clip already has captions burned in.' : '',
    menuText(menus),
    'SHOTS:', ...shotLines(i.faces ?? []),
    'SENTENCES (number [start] words):',
  ].filter(Boolean).join('\n');
  const ss = sentencesOf(i.words);
  const fixed = estimateTokens(system) + estimateTokens(head);
  const t = trimTranscript(ss, BRAIN_CAPS.edit.in, fixed);
  return { system, prompt: `${head}\n${t.lines}`, schema: schema.shape, jsonSchema, tokens: t.tokens, fits: t.fits, sentences: ss.length, menus };
}

/** What the builder and planEdit take from a Direction (null = the rules, unchanged). */
export interface EditOverrides {
  style?: string; template?: 'studio-cut' | 'none'; moves?: string[];
  tags?: BuildInput['tags']; laws?: BuildInput['laws']; look?: number | string;
}
const CLEANUP_LAWS: Record<string, BuildInput['laws'] | undefined> = {
  // the same numbers as job.ts cleanupLevel (Cardboard's Light / Tight); balanced = the default laws
  light: { pause_max: 0.65, pause_keep: 0.26 }, balanced: undefined, tight: { pause_max: 0.28, pause_keep: 0.12 },
};
export function overridesOf(d: Direction): EditOverrides {
  const tags: NonNullable<BuildInput['tags']> = {};
  for (const b of d.beats) tags[b.i] = b.tag;
  tags[d.hook] = 'hook';
  const sc = d.style === STUDIO_CUT_LOOK;
  const laws = CLEANUP_LAWS[d.cleanup];
  return {
    ...(sc ? { template: 'studio-cut' as const } : { template: 'none' as const, ...(d.style !== 'base' ? { style: d.style } : {}) }),
    moves: d.moves.map(m => m.id),
    tags, ...(laws ? { laws } : {}),
    ...(d.caption_look !== undefined ? { look: Number.isFinite(+d.caption_look) ? +d.caption_look : d.caption_look } : {}),
  };
}

/**
 * Ask for the direction (one brain call, at most one re-ask). Null value = the rules. A step that cannot fit the
 * budget, or a video budget already spent, uses the rules without asking.
 */
export async function directEdit(i: DirectEditInput & { signal?: AbortSignal; budget?: VideoBudget; log?: (s: string) => void }): Promise<Checked<Direction | null> & { step: DirectEditStep | null }> {
  if (!i.words.length) return { value: null, source: 'default', problems: [['no words heard']], tries: 0, note: 'no words, the rules edit', step: null };
  const step = directEditStep(i);
  const budget = i.budget ?? new VideoBudget();
  const ok = budget.allow('edit', step.tokens);
  if (!step.fits || !ok.ok) {
    const why = !step.fits ? `the transcript is too long for one step (${step.tokens} tokens)` : (ok as { why: string }).why;
    i.log?.(`direct:edit: rules (${why})`);
    return { value: null, source: 'default', problems: [[why]], tries: 0, note: 'Moovi\'s default used for this step', step };
  }
  const ctx = { sentences: step.sentences, menus: step.menus };
  const r = await askChecked<Direction | null>({
    label: DIRECT_EDIT_AGENT, ...(i.log ? { log: i.log } : {}),
    ask: async (history?: History) => {
      const rt = runtime();
      if (!rt.complete) throw new Error(`${rt.name} has no single-answer call`);
      const text = await rt.complete({ agent: DIRECT_EDIT_AGENT, system: step.system, prompt: step.prompt, schema: step.schema, model: 'brain', deadlineMs: 300_000, ...(history ? { history } : {}), ...(i.signal ? { signal: i.signal } : {}) });
      budget.spend('edit', step.tokens + (history ? estimateTokens(history.map(h => h.text).join('\n')) : 0), text);
      return text;
    },
    read: raw => { const x = readDirection(raw, ctx); return x.ok ? { ok: true, value: x.direction } : x; },
    fallback: () => null,
  });
  return { ...r, step };
}
