import { z } from 'zod';
import { TYPE_IDS, TYPE_WORDS, TYPES, isTypeId, typeOf, type TypeId } from '@moovi/library/types';
import type { Attachment, AttachmentRole } from '../commands';
import { brainPresence, byokMode, loadModel, serverModel } from '../keys';
import { ask } from '../runtime';
import { brainMode, type LaneFacts } from '../runtime/lane';
import { HOW_WORDS, ROLE_CHOICES, ROLE_QUESTION, TYPE_QUESTION, typeChoice } from './pipeline-words';

/**
 * The one way in (Stage 1 W1; DECISIONS.md 1, 2, 4, 13), behind MOOVI_ROUTER=pipeline: decide the brain → give every
 * attachment a role → (a video) the Editor's preparation → pick the type → the shared stages. `route` is the only
 * entry; everything else here is pure so the D1 test reads it without a model or a graph.
 *
 * Type: the card, else the look picked from the old style menu, else a video you sent is Edit, else "like the previous
 * one", else the words (`TYPE_WORDS`, one phrase table per type in the registry, today's keyword meaning only), else
 * one small model call that must answer one of the 7 ids. Moovi asks only when two types score within TYPE_MARGIN.
 */
export { pipelineOn } from './switch';

export type Brain = 'creative' | 'precise' | 'waiting' | 'none';
export type PickHow = keyof typeof HOW_WORDS;
export interface Upload { id: string; name: string; mime: string; path?: string; probe?: string | null }
export interface Pick { type: TypeId; look: string | null; how: PickHow; why: string }
export interface Question { id: 'film-role' | 'film-type'; text: string; choices: { id: string; label: string }[] }
export interface Score { type: TypeId; score: number; look: string | null; hits: string[] }

/** The pipeline's stages as docs/PIPELINE.html bands; every film runs the same list, a video adds the Editor's prep. */
export const SHARED_STAGES = ['type', 'kit', 'gather', 'write', 'sound', 'design', 'build', 'check'] as const;
export const stagesOf = (prep: boolean) => ['brain', 'roles', ...(prep ? ['prep'] : []), ...SHARED_STAGES];

export interface Route {
  brain: Brain;
  type: Pick | null;
  /** a video to edit: the Editor prepares it before the type stages */
  prep: boolean;
  attachments: Attachment[];
  /** one line, for the log and the "why" graph */
  why: string;
  stages: string[];
  /** the one question to ask before anything runs, if any */
  ask: Question | null;
  scores: Score[];
}

export interface RouteInput {
  text: string;
  /** the brief's uploads, in the order sent */
  uploads: Upload[];
  /** the tapped type card */
  card?: TypeId | null;
  /** a style picked in the old style menu (still a look inside its type) */
  style?: { id: string } | null;
  /** roles from the studio's role chips */
  given?: Attachment[];
  /** the project's last film, when the brief asks for "like the previous one" */
  previous?: { type: TypeId; look: string | null } | null;
  /** answers to this route's earlier question cards */
  answers?: { role?: string | null; type?: string | null };
}

/* ───── roles ───── */

/** "Like this" words: the upload shows the look (today's edit.ts WANTS_REFERENCE plus the decision's "like this"). */
export const LIKE_THIS = /\b(like this|in this style|in the style( of)?|style of|copy (its|the|this) (style|look|vibe)|make (one|something) like|same (style|look|vibe) as this)\b/i;
const CALLED_REF = /\breferences?\b/i;
const kindOf = (u: Upload) => (u.mime.startsWith('video/') ? 'video' : u.mime.startsWith('image/') ? 'image' : 'other');

/**
 * Every attachment's role. A chip the user set wins. A video with no "like this" words is footage; "like this" makes
 * it a reference; images and logos are assets unless called references. Unclear (two videos, or videos and images,
 * with "like this"): one question, answered with `ROLE_CHOICES` ids. Pure.
 */
export function rolesFor(text: string, uploads: Upload[], given: Attachment[] = [], answer?: string | null): { attachments: Attachment[]; ask: Question | null; why: string } {
  const set = new Map(given.filter(g => uploads.some(u => u.id === g.upload)).map(g => [g.upload, g.role] as const));
  const open = uploads.filter(u => !set.has(u.id));
  const videos = open.filter(u => kindOf(u) === 'video'), stills = open.filter(u => kindOf(u) !== 'video');
  const likeThis = LIKE_THIS.test(text), calledRef = likeThis || CALLED_REF.test(text);
  const out = (role: (u: Upload) => AttachmentRole, why: string) =>
    ({ attachments: uploads.map(u => ({ upload: u.id, role: set.get(u.id) ?? role(u) })), ask: null, why });
  if (!open.length) return out(() => 'asset', given.length ? 'your role chips' : 'no attachments');
  if (!likeThis || !videos.length) return out(u => (kindOf(u) === 'video' ? 'footage' : calledRef ? 'reference' : 'asset'),
    !videos.length ? (calledRef ? 'images you call references' : 'images and files go in as assets') : 'a video with no “like this” is footage');
  if (videos.length === 1 && !stills.length) return out(() => 'reference', '“like this” makes the video a reference');
  // unclear: which upload is the look and which goes in?
  const choices = stills.length ? ['video-reference', 'images-reference'] : ['first-footage', 'all-reference', 'all-footage'];
  if (answer && choices.includes(answer)) {
    const first = videos[0]!.id;
    const role = (u: Upload): AttachmentRole => answer === 'video-reference' ? (kindOf(u) === 'video' ? 'reference' : 'asset')
      : answer === 'images-reference' ? (kindOf(u) === 'video' ? 'footage' : 'reference')
      : answer === 'first-footage' ? (u.id === first ? 'footage' : 'reference')
      : answer === 'all-reference' ? 'reference' : 'footage';
    return out(role, 'you said which is which');
  }
  return { attachments: uploads.map(u => ({ upload: u.id, role: set.get(u.id) ?? (kindOf(u) === 'video' ? 'footage' : 'asset') })), why: 'unclear which attachment shows the look',
    ask: { id: 'film-role', text: ROLE_QUESTION, choices: choices.map(id => ({ id, label: ROLE_CHOICES[id]! })) } };
}

/* ───── type ───── */

/** Ask only when the top two types score closer than this (the phrase weights are 0.5, 1 and 2, so: a tie). */
export const TYPE_MARGIN = 0.5;

/**
 * The words' score per type: every phrase of every table found in the text, longest match first (so "saas explainer"
 * is not also "explainer"), each span counted once. A type's look is its strongest matched phrase's look. Pure.
 */
export function typeFromWords(text: string): Score[] {
  const hits: { type: TypeId; start: number; end: number; w: number; look?: string; word: string }[] = [];
  for (const [type, phrases] of Object.entries(TYPE_WORDS) as [TypeId, (typeof TYPE_WORDS)[TypeId]][]) {
    for (const p of phrases) {
      for (const m of text.matchAll(new RegExp(`\\b(?:${p.re})\\b`, 'gi'))) hits.push({ type, start: m.index, end: m.index + m[0].length, w: p.w, ...(p.look ? { look: p.look } : {}), word: m[0] });
    }
  }
  hits.sort((a, b) => (b.end - b.start) - (a.end - a.start) || b.w - a.w || a.start - b.start);
  const kept: typeof hits = [];
  for (const h of hits) if (!kept.some(k => h.start < k.end && k.start < h.end)) kept.push(h);
  const by = new Map<TypeId, Score>(), lookW = new Map<TypeId, number>();
  for (const h of kept.sort((a, b) => a.start - b.start)) {
    const s = by.get(h.type) ?? { type: h.type, score: 0, look: null, hits: [] };
    s.score += h.w; s.hits.push(h.word.toLowerCase());
    if (h.look && h.w > (lookW.get(h.type) ?? 0)) { s.look = h.look; lookW.set(h.type, h.w); }
    by.set(h.type, s);
  }
  return [...by.values()].sort((a, b) => b.score - a.score || TYPE_IDS.indexOf(a.type) - TYPE_IDS.indexOf(b.type));
}

/** The type a look (a style id or an edit look id) belongs to. */
export function typeOfLook(look: string): TypeId | null {
  if (look === 'edit') return 'edit';
  return TYPES.find(t => t.looks.some(l => l.id === look))?.id ?? null;
}
/** The look a type wears when none is named: its main (or default) look; null for a type with none yet. */
export const mainLook = (t: TypeId) => typeOf(t).looks.find(l => l.role === 'main' || l.role === 'default')?.id ?? null;

/** The rule part of the type pick (no model). `tie` names the types to ask between. Pure. */
export function pickType(i: RouteInput, attachments: Attachment[]): { pick: Pick | null; tie: TypeId[] | null; scores: Score[] } {
  const scores = typeFromWords(i.text);
  const lookIn = (t: TypeId) => scores.find(s => s.type === t)?.look ?? null;
  if (i.answers?.type && isTypeId(i.answers.type)) return { pick: { type: i.answers.type, look: lookIn(i.answers.type), how: 'answer', why: 'you chose it' }, tie: null, scores };
  if (i.card && isTypeId(i.card)) return { pick: { type: i.card, look: lookIn(i.card), how: 'card', why: 'the type card' }, tie: null, scores };
  const fromStyle = i.style?.id ? typeOfLook(i.style.id) : null;
  if (fromStyle) return { pick: { type: fromStyle, look: i.style!.id, how: 'style', why: `the ${i.style!.id} look from the style menu` }, tie: null, scores };
  const footage = attachments.find(a => a.role === 'footage' && i.uploads.find(u => u.id === a.upload && kindOf(u) === 'video'));
  if (footage) return { pick: { type: 'edit', look: lookIn('edit'), how: 'video', why: 'a video to edit' }, tie: null, scores };
  if (i.previous) return { pick: { type: i.previous.type, look: i.previous.look, how: 'previous', why: 'like the previous film' }, tie: null, scores };
  const [top, second] = scores;
  if (!top) return { pick: null, tie: null, scores };
  if (second && top.score - second.score < TYPE_MARGIN) return { pick: null, tie: scores.filter(s => top.score - s.score < TYPE_MARGIN).map(s => s.type), scores };
  return { pick: { type: top.type, look: top.look, how: 'words', why: `your words: ${top.hits.join(', ')}` }, tie: null, scores };
}

const typeQuestion = (ids: readonly TypeId[]): Question => ({ id: 'film-type', text: TYPE_QUESTION, choices: ids.map(id => ({ id, label: typeChoice(id) })) });

/** Brain, roles, type: the whole route without the model call (pure). */
export function routeRules(i: RouteInput, brain: Brain): Route {
  const roles = rolesFor(i.text, i.uploads, i.given ?? [], i.answers?.role);
  const prep = roles.attachments.some(a => a.role === 'footage' && i.uploads.some(u => u.id === a.upload && kindOf(u) === 'video'));
  const base = { brain, prep, attachments: roles.attachments, stages: stagesOf(prep) };
  if (roles.ask) return { ...base, type: null, ask: roles.ask, scores: [], why: roles.why };
  const t = pickType(i, roles.attachments);
  const ask = t.tie ? typeQuestion(t.tie) : null;
  return { ...base, type: t.pick, ask, scores: t.scores, why: [roles.why, t.pick ? `${t.pick.type}: ${t.pick.why}` : t.tie ? `${t.tie.join(' or ')} fit equally` : 'no type named'].join('; ') };
}

/* ───── brain ───── */

/**
 * Whether the user's Claude Code is online. Wired by Tab (bridge, 2026-10-18): keys.brainPresence asks the bridge
 * (packages/mcp hub.register's presence hook: online while a window polls, linked when connected but quiet, else off),
 * so "connected and online" is Creative; without the bridge in the process it reads the token alone (linked or off).
 * `registerPresence` still overrides it (tests).
 */
export type PresenceFn = (user: string) => Promise<LaneFacts['claudeCode']> | LaneFacts['claudeCode'];
// the bridge's own reading when it is plugged in (online while a Claude Code window polls), else the token alone
const linkedOnly: PresenceFn = user => brainPresence(user);
let presence: PresenceFn = linkedOnly;
export function registerPresence(fn: PresenceFn | null) { presence = fn ?? linkedOnly; }

/** Claude Code connected and online → Creative; else the key (or the server model) → Precise (runtime/lane.ts brainMode). */
export async function brainFor(user: string): Promise<Brain> {
  const claudeCode = await Promise.resolve(presence(user)).catch(() => 'off' as const);
  const m = brainMode({ claudeCode, hasKey: !!loadModel(user), server: !!serverModel(), byok: byokMode() });
  return m === 'creative' ? 'creative' : m === 'precise' || m === 'server' ? 'precise' : m;
}

/* ───── the one model call ───── */

/** What each type is, for the one small model call (docs/PIPELINE.html band 1, the type cards' own lines). */
const TYPE_BRIEFS: Record<TypeId, string> = {
  edit: 'the user’s own talking head, podcast clip or demo, edited',
  launch: 'an 18–30 s product launch cut to music, the product shown for real',
  showreel: 'a montage cut to the beat: footage and clips, every moment used once',
  'brand-post': 'a post about the brand that is not a launch or a reel: an idea, a story, a point of view',
  'saas-explainer': 'what the product does and how, in steps, with real screens',
  'ui-morph': 'one UI element that never cuts, morphing through the product’s states',
  kinetic: 'words as the picture, timed to the voice or the music',
};

/** One small model call that must answer one of the 7 type ids. */
export async function typeFromModel(text: string, attachments: Attachment[], signal?: AbortSignal): Promise<Pick> {
  const r = await ask({
    agent: 'moovi:type', tier: 'fast', maxTurns: 3, deadlineMs: 30_000, ...(signal ? { signal } : {}),
    system: 'You pick the type of a short video from its brief. Answer with exactly one of the given type ids.',
    prompt: `Brief: ${text.slice(0, 800) || '(no words)'}\nAttachments: ${attachments.map(a => a.role).join(', ') || 'none'}\n\nTypes:\n${TYPE_IDS.map(id => `- ${id}: ${TYPE_BRIEFS[id]}`).join('\n')}`,
    schema: { type: z.enum(TYPE_IDS), why: z.string().max(200) },
  });
  return { type: r.type, look: null, how: 'model', why: r.why };
}

/**
 * The one way in: route(brief) → { brain, type, prep, attachments, why }. When no rule names a type, one small model
 * call picks it; when that call fails, the question card lists all 7 types (never a silent guess).
 */
export async function route(i: RouteInput & { user: string; signal?: AbortSignal; model?: typeof typeFromModel }): Promise<Route> {
  const r = routeRules(i, await brainFor(i.user));
  if (r.type || r.ask) return r;
  try {
    const p = await (i.model ?? typeFromModel)(i.text, r.attachments, i.signal);
    const look = typeFromWords(i.text).find(s => s.type === p.type)?.look ?? null;
    return { ...r, type: { ...p, look }, why: `${r.why}; ${p.type}: ${p.why}` };
  } catch (e) {
    if (i.signal?.aborted) throw e;
    console.warn(`[pipeline] type call: ${String((e as Error)?.message ?? e).slice(0, 160)}`);
    return { ...r, ask: typeQuestion(TYPE_IDS), why: `${r.why}; the type call failed` };
  }
}
