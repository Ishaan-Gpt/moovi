/**
 * "Direct the edit" (Claude Code bridge, docs/agents/claude-code-bridge, items 3 and 3a): the frozen contract of the ONE
 * top-level decision an edit asks the user's own Claude Code for. It sees a compact view of the clip (numbered sentences,
 * a shot list, a few keyframes) and the live menus, and answers every creative choice at once: the look, the cleanup
 * level, the hook, one tag per sentence, a few named moves and cards, the caption look and a title. Everything mechanical
 * (cutting, timing, captions, CHECK, render) stays server code and reads this answer as overrides.
 *
 * What lives here: the menus (read from the engine's own registries at call time, so a new look, move or caption look
 * appears with no change here), the answer's shape (an enum wherever the choice is a fixed list, sent as JSON Schema),
 * the checks a shape cannot carry (indices in range, one tag per sentence, short card words) and `readDirection`, which
 * turns any raw answer into a Direction or a list of plain problems for the one re-ask. Pure: no model, no I/O.
 */
import { z } from 'zod';
import { listLooks } from 'captionseasy';
import { Beat } from './edl';
import { D22_STYLES, STYLE_LAWS } from './styles';
import { X1_MOVES } from './moves';
import { STYLE_LOOKS } from './looks';
import type { InsertDraw } from './inserts';
import { assetIdOf, EDIT_FNS, menuEntries, type EditFn } from './registry';

export const DIRECT_EDIT_VERSION = 'direct-edit/1';
/** a sentence's job in the video (the EDL's own beat tags: one source of truth) */
export const BEAT_TAGS = Beat.shape.tag.options;
/** job.ts cleanupLevel: light and tight change the pause laws, balanced keeps the default laws */
export const CLEANUP_LEVELS = ['light', 'balanced', 'tight'] as const;
/** the card drawers an edit can place on a beat (edit/inserts.ts InsertDraw; `satisfies` breaks the build if one goes away) */
export const CARD_KINDS = ['stat', 'checklist', 'notify', 'comment', 'poster', 'title'] as const satisfies readonly InsertDraw[];
/** a short clip carries a few moves and cards, never one per sentence */
export const MAX_MOVES = 4, MAX_CARDS = 3, MAX_CARD_WORDS = 6;
/** the beat spec part (Edit mastery, docs/agents/mastery/edit.md "The director's interface"): a few explicit picks, short verb lists */
export const MAX_PICKS = 6, MAX_VERBS = 4, MAX_HERO = 32;
/** the look that is not a D2.2 style but the Studio Cut grammar (job.ts `template: 'studio-cut'`) */
export const STUDIO_CUT_LOOK = 'studio-cut';

export interface MenuItem { id: string; line: string }
export interface DirectMenus {
  /** edit looks: 'base' (the plain edit), the D2.2 styles (edit/styles.ts) and the Studio Cut grammar */
  looks: MenuItem[];
  /** the X1 moves by number (edit/moves.ts) */
  moves: MenuItem[];
  /** captionseasy look numbers (edit/looks.ts); empty when the look library is not offered */
  captionLooks: MenuItem[];
  /** the edit registry's assets the player draws (edit/registry.ts), by library id; empty or absent: no beat spec part */
  edit?: MenuItem[];
}

/**
 * The menus as the engine has them now. Caption looks: by default the looks the edit styles start from (STYLE_LOOKS, a
 * handful, so the step stays small); `captionLooks: 'all'` offers all of captionseasy's numbered looks, 'none' none.
 */
export function liveMenus(o: { captionLooks?: 'styles' | 'all' | 'none' } = {}): DirectMenus {
  const looks: MenuItem[] = [
    { id: 'base', line: 'the plain Moovi edit: clean cuts, word captions, punch-ins on key words' },
    ...D22_STYLES.map(id => ({ id, line: STYLE_LAWS[id].about })),
    { id: STUDIO_CUT_LOOK, line: 'Studio Cut grammar: stacked captions, a continuous camera, graphics, its own sound' },
  ];
  const moves = Object.values(X1_MOVES).map(m => ({ id: m.n, line: `${m.name} (${m.layer}${m.tags.length ? `; suits ${m.tags.join(', ')}` : ''})` }));
  const which = o.captionLooks ?? 'styles';
  const wanted = new Set(Object.values(STYLE_LOOKS));
  const captionLooks = which === 'none' ? [] : listLooks()
    .filter(l => which === 'all' || wanted.has(l.number))
    .map(l => ({ id: String(l.number), line: `${l.name} (${l.layout})` }));
  const edit = menuEntries().map(e => ({ id: assetIdOf(e), line: e.fns.join('/') }));
  return { looks, moves, captionLooks, edit };
}

const ids = (xs: MenuItem[]) => xs.map(x => x.id) as [string, ...string[]];

/** The answer's shape for these menus (zod). */
export function directEditSchema(m: DirectMenus) {
  if (!m.looks.length || !m.moves.length) throw new Error('direct-edit: the looks and moves menus must not be empty');
  return z.object({
    style: z.enum(ids(m.looks)).describe('the edit look, from the looks menu'),
    why: z.string().min(1).max(160).describe('one short line: why this look fits this clip'),
    cleanup: z.enum(CLEANUP_LEVELS).describe('how hard pauses are cut: light keeps breathing room, tight is snappy'),
    hook: z.number().int().min(0).describe('the sentence number that should open the video'),
    beats: z.array(z.object({ i: z.number().int().min(0), tag: z.enum(BEAT_TAGS) }).strict()).min(1).describe('one tag per sentence number'),
    moves: z.array(z.object({ i: z.number().int().min(0), id: z.enum(ids(m.moves)) }).strict()).max(MAX_MOVES).describe('named moves on the sentences that earn them'),
    cards: z.array(z.object({ i: z.number().int().min(0), kind: z.enum(CARD_KINDS), words: z.string().min(1).max(48) }).strict()).max(MAX_CARDS)
      .describe(`cards on screen: up to ${MAX_CARDS}, each at most ${MAX_CARD_WORDS} words taken from what is said`),
    ...(m.captionLooks.length ? { caption_look: z.enum(ids(m.captionLooks)).optional().describe('a caption look number from the menu; leave it out for the look\'s own') } : {}),
    ...(m.edit?.length ? { spec: z.object({
      reads: z.array(z.object({
        i: z.number().int().min(0),
        fn: z.enum(EDIT_FNS).describe('what the sentence does in the film'),
        verbs: z.array(z.string().min(1).max(24)).max(MAX_VERBS).describe('actions the sentence says that a picture can act out ("comment", "type", "grow")'),
        hero: z.string().min(1).max(MAX_HERO).describe('the one word of the sentence the frame is about, as spoken'),
      }).strict()).optional().describe('your reading of the sentences that matter; leave a sentence out to keep Moovi\'s own reading'),
      // an id from the EDIT REGISTRY menu (checked against it in readDirection: an enum here doubled the step's size)
      picks: z.array(z.object({ i: z.number().int().min(0), id: z.string().regex(/^[a-z0-9]+:[a-z0-9-]+$/).max(64) }).strict()).max(MAX_PICKS).optional()
        .describe(`up to ${MAX_PICKS} devices from the EDIT REGISTRY menu, by id, on the sentences that earn them; Moovi picks the rest`),
    }).strict().optional().describe('optional: the beat spec part (Edit mastery); reads and picks by id, never a file, URL or colour') } : {}),
    title: z.string().min(1).max(70).describe('a short title for the video'),
    model: z.string().min(1).max(80).describe('your own model id, as you know it'),
  }).strict();
}
export interface Direction {
  style: string; why: string; cleanup: (typeof CLEANUP_LEVELS)[number]; hook: number;
  beats: { i: number; tag: (typeof BEAT_TAGS)[number] }[];
  moves: { i: number; id: string }[];
  cards: { i: number; kind: (typeof CARD_KINDS)[number]; words: string }[];
  caption_look?: string; title: string; model: string;
  spec?: DirectionSpec;
}
/** The director's interface (engine/src/edit/beatspec.ts): reads replace Moovi's own reading of a sentence, picks name a registry asset. */
export interface DirectionSpec {
  reads?: { i: number; fn: EditFn; verbs: string[]; hero: string }[];
  picks?: { i: number; id: string }[];
}

/** The same shape as JSON Schema (what the bridge puts in the step for Claude Code). */
export function directEditJsonSchema(m: DirectMenus): Record<string, unknown> {
  return z.toJSONSchema(directEditSchema(m), { target: 'draft-2020-12' }) as Record<string, unknown>;
}

/** Checks the shape cannot carry. Returns plain problems (empty = good), quoted back to the model on the one re-ask. */
export function checkDirection(a: Direction, ctx: { sentences: number; texts?: string[]; editIds?: readonly string[] }): string[] {
  const p: string[] = [], n = ctx.sentences, inRange = (i: number) => i >= 0 && i < n;
  const range = n > 0 ? `0 to ${n - 1}` : 'none: the clip has no sentences';
  if (!inRange(a.hook)) p.push(`hook ${a.hook} is not a sentence number (${range})`);
  const seen = new Set<number>();
  for (const b of a.beats) {
    if (!inRange(b.i)) p.push(`beats: ${b.i} is not a sentence number (${range})`);
    else if (seen.has(b.i)) p.push(`beats: sentence ${b.i} is tagged twice`);
    seen.add(b.i);
  }
  const missing = Array.from({ length: n }, (_, i) => i).filter(i => !seen.has(i));
  if (missing.length) p.push(`beats: tag every sentence; missing ${missing.slice(0, 12).join(', ')}${missing.length > 12 ? ', ...' : ''}`);
  for (const mv of a.moves) if (!inRange(mv.i)) p.push(`moves: ${mv.i} is not a sentence number (${range})`);
  for (const c of a.cards) {
    if (!inRange(c.i)) p.push(`cards: ${c.i} is not a sentence number (${range})`);
    const w = c.words.trim().split(/\s+/).filter(Boolean).length;
    if (w > MAX_CARD_WORDS) p.push(`cards: "${c.words}" has ${w} words; at most ${MAX_CARD_WORDS}`);
  }
  const norm = (x: string) => x.toLowerCase().replace(/[^\p{L}\p{N}%$₹€£]/gu, '');
  const readSeen = new Set<number>(), pickSeen = new Set<number>();
  for (const r of a.spec?.reads ?? []) {
    if (!inRange(r.i)) { p.push(`spec.reads: ${r.i} is not a sentence number (${range})`); continue; }
    if (readSeen.has(r.i)) p.push(`spec.reads: sentence ${r.i} is read twice`);
    readSeen.add(r.i);
    const said = ctx.texts?.[r.i];
    if (said !== undefined && !said.split(/\s+/).some(w => norm(w) === norm(r.hero))) p.push(`spec.reads: hero "${r.hero}" is not a word of sentence ${r.i}; use one word as it is said`);
  }
  for (const k of a.spec?.picks ?? []) {
    if (!inRange(k.i)) { p.push(`spec.picks: ${k.i} is not a sentence number (${range})`); continue; }
    if (pickSeen.has(k.i)) p.push(`spec.picks: sentence ${k.i} has two picks; one device per sentence`);
    if (ctx.editIds && !ctx.editIds.includes(k.id)) p.push(`spec.picks: "${k.id}" is not in the EDIT REGISTRY menu; pick an id from it`);
    pickSeen.add(k.i);
  }
  return p;
}

const where = (path: PropertyKey[]) => path.length ? path.map(String).join('.') : 'answer';

/**
 * Any raw answer (a JSON string or a parsed value) to a Direction, or the plain problems with it. Never throws: the
 * bridge quotes the problems back on its one re-ask, then falls back to the rules (item 10).
 */
export function readDirection(raw: unknown, ctx: { sentences: number; menus: DirectMenus; texts?: string[] }): { ok: true; direction: Direction } | { ok: false; problems: string[] } {
  let v = raw;
  if (typeof raw === 'string') {
    const s = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    try { v = JSON.parse(s); } catch { return { ok: false, problems: ['the answer is not JSON: send one JSON object and nothing else'] }; }
  }
  const r = directEditSchema(ctx.menus).safeParse(v);
  if (!r.success) return { ok: false, problems: r.error.issues.slice(0, 12).map(i => `${where(i.path)}: ${i.message}`) };
  const direction = r.data as Direction;
  const problems = checkDirection(direction, { ...ctx, editIds: (ctx.menus.edit ?? []).map(e => e.id) });
  return problems.length ? { ok: false, problems } : { ok: true, direction };
}

/** One valid answer for a four-sentence clip, shown to the model beside the schema (and used by tests). */
export const EXAMPLE_DIRECTION: Direction = {
  style: 'atlas', why: 'a creator intro with two numbers: static looks and number cards carry it', cleanup: 'balanced', hook: 1,
  beats: [{ i: 0, tag: 'aside' }, { i: 1, tag: 'hook' }, { i: 2, tag: 'number' }, { i: 3, tag: 'cta' }],
  moves: [{ i: 1, id: '05' }], cards: [{ i: 2, kind: 'stat', words: '19 billion transistors' }],
  title: 'The chip in your pocket', model: 'example',
};
