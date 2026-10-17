/**
 * "Direct the film" (Claude Code bridge, docs/agents/claude-code-bridge, item 4): the frozen contract of the ONE top-level
 * decision a generated video asks the user's own Claude Code for. It sees the brief (and what the server read from the
 * site: title, description, a few facts) and the menus, and answers with the chosen style's OWN brief: the same fields
 * that style's brief call asks a model for today, wrapped with the style pick, why, and the model's own id. Every detail
 * call after it (scenes, props, pictures, footage, voice) stays on the server.
 *
 * One entry per style in FILM_BRIEFS. Launch is first (Ishaan's newest style); a style without an entry is not offered to
 * Claude Code and keeps its own server path. The step only carries the styles the user can get: when the user picked one
 * on the site, the menu has exactly that one, so the schema stays small. Pure: no model, no I/O.
 */
import { z } from 'zod';
import { LAUNCH_ARCS, type LaunchArc } from '../launch/arcs';
import { inventedNumbers } from '../styles/kit/script';
import type { StyleId } from '../styles';

export const DIRECT_FILM_VERSION = 'direct-film/1';
export const MAX_FACTS = 6, MAX_FEATURES = 6, MAX_FEATURE_WORDS = 4;

export interface MenuItem { id: string; line: string }

/** What the server knows before it asks: the site's text (to refuse invented numbers) and, per style, its own choices. */
export interface FilmContext {
  /** the styles the user can get here (one when the user picked it on the site) */
  styles: StyleId[];
  /** the site's readable text, or the user's script; numbers in the answer must appear here */
  sourceText: string;
  /** Launch: the arc the server picked (chooseLaunchArc: site signals and variety), offered first */
  launchArc?: string;
}

/** one style's entry: its menus, its answer shape and the checks the shape cannot carry */
export interface FilmBrief {
  id: StyleId;
  line: string;
  menus(ctx: FilmContext): Record<string, MenuItem[]>;
  shape(ctx: FilmContext): z.ZodObject;
  check(a: Record<string, unknown>, ctx: FilmContext): string[];
}

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean);
const unmarked = (s: string) => s.replace(/\*/g, '');
const ids = (xs: { id: string }[]) => xs.map(x => x.id) as [string, ...string[]];

/** Launch arcs as the menu shows them: the server's pick first, each with its slots as one short line */
export function launchArcMenu(first?: string): MenuItem[] {
  const arcs = [...LAUNCH_ARCS].sort((a, b) => (a.id === first ? -1 : b.id === first ? 1 : 0));
  return arcs.map(a => ({ id: a.id, line: `${a.name}: ${a.slots.length} lines (${a.slots.map(s => s.kind).join(', ')})` }));
}
const arcOf = (id: unknown): LaunchArc | undefined => LAUNCH_ARCS.find(a => a.id === id);

/** the slot lines one arc asks for (shown with the step so the model writes them in order) */
export function launchSlotLines(arcId: string): string[] {
  const a = arcOf(arcId); if (!a) return [];
  return a.slots.map((s, i) => `line ${i + 1} (${s.kind}): ${s.does.replace(/<Brand>/g, 'the brand')} (${s.words[0]} to ${s.words[1]} words; wrap the ONE key word in *asterisks*)`);
}

const LAUNCH: FilmBrief = {
  id: 'launch',
  line: 'a premium product launch film: short on-screen headlines cut to music, the real product and icon',
  menus: ctx => ({ arcs: launchArcMenu(ctx.launchArc) }),
  // the same fields launch/brief.ts asks its model for; the lines are one array in the arc's slot order
  shape: ctx => z.object({
    style: z.literal('launch'),
    why: z.string().min(1).max(160).describe('one short line: why this style fits the brief'),
    arc: z.enum(ids(launchArcMenu(ctx.launchArc))).describe('the arc from the menu (the first one is the server\'s pick)'),
    name: z.string().min(1).max(32).describe('the brand or product name, as the site writes it'),
    color: z.string().regex(/^#?[0-9a-fA-F]{6}$/).describe('the brand colour as #RRGGBB'),
    tagline: z.string().min(1).max(60).describe('the brand\'s own short tagline'),
    facts: z.array(z.string().min(1).max(160)).min(1).max(MAX_FACTS).describe('true facts from the source, one line each'),
    features: z.array(z.string().min(1).max(40)).min(1).max(MAX_FEATURES).describe(`feature names of 1 to ${MAX_FEATURE_WORDS - 1} words, not sentences`),
    prompt: z.string().max(120).describe('a realistic request a user would type into the product, or empty'),
    audience: z.string().max(80).describe('who it is for, a few words'),
    number: z.string().max(40).describe('one number the source says, with its unit (e.g. "11 hours saved per week"), or empty'),
    lines: z.array(z.string().min(1).max(90)).min(1).describe('the on-screen lines, one per slot of the chosen arc, in order'),
  }).strict(),
  check: (a, ctx) => {
    const p: string[] = [], arc = arcOf(a.arc);
    const lines = (a.lines as string[]) ?? [];
    if (arc) {
      if (lines.length !== arc.slots.length) p.push(`lines: arc ${arc.id} has ${arc.slots.length} slots; write exactly ${arc.slots.length} lines (you wrote ${lines.length})`);
      lines.forEach((l, i) => {
        const s = arc.slots[i]; if (!s) return;
        const n = words(unmarked(l)).length;
        if (n > s.words[1] + 3) p.push(`lines ${i + 1}: ${n} words; the ${s.kind} slot takes ${s.words[0]} to ${s.words[1]}`);
      });
    }
    const long = ((a.features as string[]) ?? []).filter(f => words(f).length >= MAX_FEATURE_WORDS);
    if (long.length) p.push(`features must be 1 to ${MAX_FEATURE_WORDS - 1} word names, not sentences: ${long.slice(0, 3).map(f => `"${f}"`).join(', ')}`);
    if (ctx.sourceText) {
      const said = [...lines, String(a.number ?? ''), String(a.tagline ?? ''), ...((a.features as string[]) ?? [])].map(unmarked);
      const nums = [...new Set(said.flatMap(l => inventedNumbers(l, ctx.sourceText)))];
      if (nums.length) p.push(`the numbers ${nums.join(', ')} are not in the source: use only numbers it says`);
    }
    return p;
  },
};

/** the styles Claude Code can direct, in menu order (Launch first). A style is added here with its own entry. */
export const FILM_BRIEFS: Partial<Record<StyleId, FilmBrief>> = { launch: LAUNCH };
export const directableStyles = (ctx: Pick<FilmContext, 'styles'>): StyleId[] => ctx.styles.filter(s => FILM_BRIEFS[s]);

/** The menus the step shows: styles with one line each, and each offered style's own menus. */
export function filmMenus(ctx: FilmContext): { styles: MenuItem[] } & Record<string, MenuItem[]> {
  const offered = directableStyles(ctx);
  return Object.assign({ styles: offered.map(s => ({ id: s, line: FILM_BRIEFS[s]!.line })) }, ...offered.map(s => FILM_BRIEFS[s]!.menus(ctx)));
}

/** The answer's shape: one strict object per offered style, told apart by `style`, each carrying `model`. */
export function directFilmSchema(ctx: FilmContext) {
  const offered = directableStyles(ctx);
  if (!offered.length) throw new Error('direct-film: none of these styles can be directed by Claude Code');
  const model = { model: z.string().min(1).max(80).describe('your own model id, as you know it') };
  const members = offered.map(s => FILM_BRIEFS[s]!.shape(ctx).extend(model).strict());
  return members.length === 1 ? members[0]! : z.discriminatedUnion('style', members as unknown as [z.ZodObject, z.ZodObject, ...z.ZodObject[]]);
}
export type FilmDirection = { style: StyleId; why: string; model: string } & Record<string, unknown>;

export function directFilmJsonSchema(ctx: FilmContext): Record<string, unknown> {
  return z.toJSONSchema(directFilmSchema(ctx), { target: 'draft-2020-12' }) as Record<string, unknown>;
}

const where = (path: PropertyKey[]) => path.length ? path.map(String).join('.') : 'answer';

/** Any raw answer to a FilmDirection, or the plain problems with it (quoted back on the one re-ask). Never throws. */
export function readFilmDirection(raw: unknown, ctx: FilmContext): { ok: true; direction: FilmDirection } | { ok: false; problems: string[] } {
  let v = raw;
  if (typeof raw === 'string') {
    const s = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    try { v = JSON.parse(s); } catch { return { ok: false, problems: ['the answer is not JSON: send one JSON object and nothing else'] }; }
  }
  let schema;
  try { schema = directFilmSchema(ctx); } catch (e) { return { ok: false, problems: [(e as Error).message] }; }
  const r = schema.safeParse(v);
  if (!r.success) return { ok: false, problems: r.error.issues.slice(0, 12).map(i => `${where(i.path)}: ${i.message}`) };
  const d = r.data as FilmDirection;
  const problems = FILM_BRIEFS[d.style]!.check(d, ctx);
  return problems.length ? { ok: false, problems } : { ok: true, direction: d };
}

/** One valid Launch answer for the source text below (shown to the model beside the schema; used by tests). */
export const EXAMPLE_SOURCE = 'Linear is the issue tracker built for speed. Plan cycles, track issues and ship. Teams save 11 hours per week. Keyboard first. Used by 10,000 teams.';
export const EXAMPLE_FILM: FilmDirection = {
  style: 'launch', why: 'a software product with a clear pain and real numbers', arc: 'launch-pain-turn',
  name: 'Linear', color: '#5E6AD2', tagline: 'Built for speed', facts: ['Teams save 11 hours per week', 'Used by 10,000 teams'],
  features: ['Cycles', 'Issues', 'Keyboard first'], prompt: 'Plan the next cycle for the web team', audience: 'software teams',
  number: '11 hours saved per week',
  lines: ['Still *chasing* tickets?', 'Hours lost to slow *tools*.', 'Meet *Linear*.', '*Plan* cycles in seconds.', 'Track every *issue* fast.', 'Keyboard *first*.', 'Ship *faster*.', '*Linear*'],
  model: 'example',
};
