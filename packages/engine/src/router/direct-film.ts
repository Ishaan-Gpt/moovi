/**
 * "Direct the film" (Claude Code bridge item 11): the ONE brain call of a generated video. Builds the step from the
 * brief and what the server read (title, description, a few facts), asks `direct:film` through the lane switch and the
 * answer checker, and returns the chosen style's own brief. For Launch, `launchRecord` gives exactly the record
 * launch/brief.ts gets back from its own model call (name, color, tagline, facts, features, prompt, audience, number,
 * line1..N), so its doctor, accent words and number checks still run unchanged. Null value = the style's own path.
 */
import { askChecked, BRAIN_CAPS, DEFAULT_NOTE, estimateTokens, runtime, VideoBudget, type Checked, type History } from '../runtime';
import { ISOLATION_LINE } from '../edit/direct';
import { directFilmJsonSchema, directFilmSchema, EXAMPLE_FILM, filmMenus, launchSlotLines, readFilmDirection, type FilmContext, type FilmDirection } from './direct-film.schema';

export const DIRECT_FILM_AGENT = 'direct:film';

export interface DirectFilmInput extends FilmContext { brief: string; title?: string; description?: string; facts?: string[] }

export function directFilmStep(i: DirectFilmInput): { system: string; prompt: string; schema: ReturnType<typeof directFilmSchema>; tokens: number; fits: boolean } {
  const menus = filmMenus(i), schema = directFilmSchema(i);
  const system = [
    ISOLATION_LINE,
    'You direct a short vertical video. Moovi builds every scene, voice, picture and the render; you pick the style and write that style\'s own brief. Use only facts and numbers from the source. Put your own model id in "model".',
    `Answer schema (JSON Schema):\n${JSON.stringify(directFilmJsonSchema(i))}`,
    `Example answer:\n${JSON.stringify(EXAMPLE_FILM)}`,
  ].join('\n\n');
  const arcs = menus.arcs ? ['ARCS (the first is Moovi\'s pick):', ...menus.arcs.map(a => `- ${a.id}: ${a.line}`), 'LINES FOR THE FIRST ARC:', ...launchSlotLines(menus.arcs[0]!.id)] : [];
  const src = i.sourceText.replace(/\s+/g, ' ').trim();
  const head = [
    `BRIEF: ${i.brief.trim().slice(0, 600)}`,
    i.title ? `SITE TITLE: ${i.title.slice(0, 120)}` : '', i.description ? `SITE DESCRIPTION: ${i.description.slice(0, 300)}` : '',
    ...(i.facts?.length ? ['FACTS:', ...i.facts.slice(0, 8).map(f => `- ${f.slice(0, 160)}`)] : []),
    'STYLES:', ...menus.styles.map(s => `- ${s.id}: ${s.line}`), ...arcs,
  ].filter(Boolean).join('\n');
  // the source text fills what is left of the cap (the facts above carry the essentials)
  const room = Math.max(0, BRAIN_CAPS.film.in - estimateTokens(system) - estimateTokens(head) - 50);
  const source = src.slice(0, Math.max(0, room * 3));
  const prompt = source ? `${head}\nSOURCE:\n${source}` : head;
  const tokens = estimateTokens(system) + estimateTokens(prompt);
  return { system, prompt, schema, tokens, fits: tokens <= BRAIN_CAPS.film.in };
}

export async function directFilm(i: DirectFilmInput & { signal?: AbortSignal; budget?: VideoBudget; log?: (s: string) => void }): Promise<Checked<FilmDirection | null>> {
  let step;
  try { step = directFilmStep(i); } catch (e) { return { value: null, source: 'default', problems: [[(e as Error).message]], tries: 0, note: 'the style\'s own path' }; }
  const budget = i.budget ?? new VideoBudget();
  const ok = budget.allow('film', step.tokens);
  if (!step.fits || !ok.ok) return { value: null, source: 'default', problems: [[!step.fits ? 'step too large' : (ok as { why: string }).why]], tries: 0, note: DEFAULT_NOTE };
  // one style = one strict object whose shape goes to APIs that constrain decoding; a union is checked on read only
  const shape = 'shape' in step.schema ? (step.schema as unknown as { shape: Record<string, never> }).shape : undefined;
  return askChecked<FilmDirection | null>({
    label: DIRECT_FILM_AGENT, ...(i.log ? { log: i.log } : {}),
    ask: async (history?: History) => {
      const rt = runtime();
      if (!rt.complete) throw new Error(`${rt.name} has no single-answer call`);
      const text = await rt.complete({ agent: DIRECT_FILM_AGENT, system: step.system, prompt: step.prompt, ...(shape ? { schema: shape } : {}), model: 'brain', deadlineMs: 300_000, ...(history ? { history } : {}), ...(i.signal ? { signal: i.signal } : {}) });
      budget.spend('film', step.tokens, text);
      return text;
    },
    read: raw => { const x = readFilmDirection(raw, i); return x.ok ? { ok: true, value: x.direction } : x; },
    fallback: () => null,
  });
}

/** A Launch direction as the record launch/brief.ts's own model call returns (its doctor runs on it unchanged). */
export function launchRecord(d: FilmDirection): { arc: string; record: Record<string, unknown> } {
  const lines = (d.lines as string[]) ?? [];
  return {
    arc: String(d.arc),
    record: {
      name: d.name, color: d.color, tagline: d.tagline, facts: d.facts, features: d.features, prompt: d.prompt, audience: d.audience, number: d.number,
      ...Object.fromEntries(lines.map((l, k) => [`line${k + 1}`, l])), source: 'claude-code',
    },
  };
}
