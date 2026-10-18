/**
 * Launch "Product UI" picks by the brain (C1 go, 2026-10-18 04:57 IST: "Launch directFilm on launch-ui.ts data.json:
 * go. Picks by id (image, card index, colour role), never a hex or a URL, and launch-ui stays the server's").
 *
 * `scripts/launch-ui.ts` (the server's, not edited here) reads a real site into data.json: its headings as cards, its
 * images, its area-weighted colours, its tagline. This module lets `direct:film` choose among those by index only:
 * which cards and in what order, which of the site's own lines is the tagline, which of the site's saturated colours
 * is the brand mark. Images are not picked here: images[0] is the crop the camera's dive lands on (launch-ui keeps the
 * tile and the dive in step), and a pick by file name is blind; that waits for a step that sees them. `applyUiPicks` writes the same data.json shape back, so the player
 * runs unchanged. Pure apart from `directFilmUi`'s one model call.
 */
import { z } from 'zod';
import { askChecked, BRAIN_CAPS, DEFAULT_NOTE, estimateTokens, runtime, VideoBudget, type Checked, type History } from '../runtime';
import { ISOLATION_LINE } from '../edit/direct';
import { DIRECT_FILM_AGENT } from './direct-film';

/** data.json as launch-ui.ts writes it (the fields this module reads or rewrites; the rest rides along untouched) */
export interface LaunchUiData {
  name: string; tagline: string; gridTitle: string; sub: string; cards: string[]; query: string;
  colours: { hex: string; w: number; role: string }[]; images: string[];
  [k: string]: unknown;
}
export const MIN_UI_CARDS = 2, MAX_UI_CARDS = 12; // launch-ui keeps at most 12 headings

const hsl = (hex: string) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim()); if (!m) return null;
  const n = parseInt(m[1]!, 16), r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0; if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s, l };
};
const HUES: [number, string][] = [[15, 'red'], [45, 'orange'], [70, 'yellow'], [160, 'green'], [200, 'teal'], [235, 'blue'], [260, 'indigo'], [290, 'violet'], [335, 'pink'], [361, 'red']];
const hueName = (h: number) => HUES.find(([top]) => h < top)![1];

/** OKLCH as the player computes it (packages/library/src/kits/launch-ui/player.html toOk), so a pick means what it shows */
const lin = (c: number) => (c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
export function toOk(hex: string): { L: number; C: number; h: number } | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim()); if (!m) return null;
  const n = parseInt(m[1]!, 16), r = lin(n >> 16), g = lin((n >> 8) & 255), b = lin(n & 255);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), mm = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * mm - 0.0040720468 * s, A = 1.9779984951 * l - 2.428592205 * mm + 0.4505937099 * s, B = 0.0259040371 * l + 0.7827717662 * mm - 0.808675766 * s;
  return { L, C: Math.hypot(A, B), h: Math.atan2(B, A) };
}
/** the player's own mark rule: chroma over 0.09, lightness 0.3 to 0.9, the heaviest wins when it holds over 0.4% of the page */
const playerSat = (hex: string) => { const o = toOk(hex); return !!o && o.C > 0.09 && o.L > 0.3 && o.L < 0.9; };
export const MARK_MIN_SHARE = 0.004;

/** the site's saturated colours the player could keep as its brand mark, by index into data.colours, heaviest first */
export function markCandidates(d: LaunchUiData, max = 6): { i: number; line: string }[] {
  const total = d.colours.reduce((s, c) => s + c.w, 0) || 1;
  return d.colours.map((c, i) => ({ c, i, x: hsl(c.hex) })).filter(o => o.x && playerSat(o.c.hex))
    .sort((a, b) => b.c.w - a.c.w).slice(0, max)
    .map(o => ({ i: o.i, line: `${o.x!.l > 0.6 ? 'light ' : o.x!.l < 0.4 ? 'deep ' : ''}${hueName(o.x!.h)}, used as ${o.c.role}, ${(100 * o.c.w / total).toFixed(1)}% of the page` }));
}

/** The weights that make the player keep colour `mark` (and only change that one weight), or why it cannot:
 * above every other saturated colour and over the 0.4% floor, but never heavier than the page's main background
 * when it is itself a background (the heaviest 'bg' decides the film's whole world). */
export function liftMark(d: LaunchUiData, mark: number): { ok: true; colours: LaunchUiData['colours'] } | { ok: false; why: string } {
  const c = d.colours[mark]; if (!c) return { ok: false, why: `mark: ${mark} is not a colour number` };
  const rest = d.colours.reduce((s, x, i) => s + (i === mark ? 0 : x.w), 0);
  const rival = Math.max(0, ...d.colours.filter((x, i) => i !== mark && playerSat(x.hex)).map(x => x.w));
  // share over the floor with the new weight in the total: w / (rest + w) > floor  <=>  w > floor * rest / (1 - floor)
  const w = Math.max(c.w, rival * 1.05 + 1e-6, (MARK_MIN_SHARE * rest) / (1 - MARK_MIN_SHARE) * 1.05);
  if (c.role === 'bg') {
    const bg0 = Math.max(0, ...d.colours.filter((x, i) => i !== mark && x.role === 'bg').map(x => x.w));
    const wasMain = d.colours.every((x, i) => i === mark || x.role !== 'bg' || x.w <= c.w);
    if (!wasMain && w >= bg0) return { ok: false, why: `mark: colour ${mark} would have to outweigh the page's main background to lead, and the film's world would change with it` };
  }
  return { ok: true, colours: d.colours.map((x, i) => (i === mark ? { ...x, w } : x)) };
}

/** the site's own lines that may stand as the tagline: an id each, the words as the site has them */
export function taglineCandidates(d: LaunchUiData): { id: string; text: string }[] {
  const out: { id: string; text: string }[] = [];
  const add = (id: string, text: string | undefined) => { const t = (text ?? '').trim(); if (t && t.split(/\s+/).length <= 12 && !out.some(o => o.text === t)) out.push({ id, text: t }); };
  add('tagline', d.tagline); add('sub', d.sub);
  d.cards.forEach((c, i) => add(`card:${i}`, c));
  return out;
}

export function uiSchema(d: LaunchUiData) {
  const tags = taglineCandidates(d).map(t => t.id) as [string, ...string[]];
  return z.object({
    cards: z.array(z.number().int().min(0)).min(Math.min(MIN_UI_CARDS, d.cards.length)).max(MAX_UI_CARDS).describe('card numbers in the order the film shows them'),
    tagline: z.enum(tags).describe('the id of the site\'s own line that closes the film'),
    mark: z.number().int().min(0).nullable().describe('the colour number to keep as the brand mark, or null for the player\'s own pick'),
    why: z.string().min(1).max(160),
    model: z.string().min(1).max(80).describe('your own model id, as you know it'),
  }).strict();
}
export type UiPicks = z.infer<ReturnType<typeof uiSchema>>;

/** checks a shape cannot carry: numbers in range, no card twice, the mark one of the candidates */
export function checkUiPicks(p: UiPicks, d: LaunchUiData): string[] {
  const out: string[] = [], seen = new Set<number>();
  for (const i of p.cards) {
    if (i >= d.cards.length) out.push(`cards: ${i} is not a card number (0 to ${d.cards.length - 1})`);
    else if (seen.has(i)) out.push(`cards: card ${i} is listed twice`);
    seen.add(i);
  }
  if (p.mark !== null && !markCandidates(d).some(m => m.i === p.mark)) out.push(`mark: ${p.mark} is not one of the MARK colours listed`);
  else if (p.mark !== null) { const l = liftMark(d, p.mark); if (!l.ok) out.push(l.why); }
  return out;
}

export function readUiPicks(raw: unknown, d: LaunchUiData): { ok: true; picks: UiPicks } | { ok: false; problems: string[] } {
  let v = raw;
  if (typeof raw === 'string') { try { v = JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')); } catch { return { ok: false, problems: ['the answer is not JSON: send one JSON object and nothing else'] }; } }
  const r = uiSchema(d).safeParse(v);
  if (!r.success) return { ok: false, problems: r.error.issues.slice(0, 12).map(i => `${i.path.map(String).join('.') || 'answer'}: ${i.message}`) };
  const problems = checkUiPicks(r.data, d);
  return problems.length ? { ok: false, problems } : { ok: true, picks: r.data };
}

/** The picks applied to data.json: the same shape, the site's own words and colours, only chosen and ordered. Pure. */
export function applyUiPicks(d: LaunchUiData, p: UiPicks): LaunchUiData {
  const cards = p.cards.map(i => d.cards[i]!);
  const tagline = taglineCandidates(d).find(t => t.id === p.tagline)?.text ?? d.tagline;
  let colours = d.colours;
  if (p.mark !== null) { const l = liftMark(d, p.mark); if (l.ok) colours = l.colours; }
  const first = (cards[0] ?? d.name).split(/\s+/)[0]!.toLowerCase().replace(/[^\p{L}\p{N}-]/gu, '');
  return { ...d, cards, tagline, colours, query: first || d.query, directed: { by: DIRECT_FILM_AGENT, kind: 'launch-ui', why: p.why, model: p.model } };
}

/** The step: the site's own cards, images and colours by number; the answer is numbers and ids only. */
export function uiStep(d: LaunchUiData, brief: string) {
  const schema = uiSchema(d);
  const system = [
    ISOLATION_LINE,
    'You direct a short product launch film made from a real website. Moovi has read the site and will build every shot from it; you only choose among what the site has, by number: which cards (the site\'s own headings) and in what order (leave out headings that are cut off, a bare label or not about the product; the grid shows about 10 tiles and repeats titles when given fewer, so keep every heading that is good), which of the site\'s own lines closes the film, and which of its colours is the brand mark. Never write a colour, a URL or new words.',
    `Answer schema (JSON Schema):\n${JSON.stringify(z.toJSONSchema(schema, { target: 'draft-2020-12' }))}`,
  ].join('\n\n');
  const prompt = [
    `BRIEF: ${brief.trim().slice(0, 400) || '(nothing specific)'}`, `PRODUCT: ${d.name}`,
    'CARDS (number: heading):', ...d.cards.map((c, i) => `${i}: ${c}`),
    'LINES (id: the site\'s words):', ...taglineCandidates(d).map(t => `${t.id}: ${t.text}`),
    'MARK colours (number: what it is):', ...(markCandidates(d).map(m => `${m.i}: ${m.line}`)), ...(markCandidates(d).length ? [] : ['(none: answer null)']),
  ].join('\n');
  const tokens = estimateTokens(system) + estimateTokens(prompt);
  return { system, prompt, schema, tokens, fits: tokens <= BRAIN_CAPS.film.in };
}

/** One `direct:film` call over data.json; null value = data.json stays as launch-ui wrote it. */
export async function directFilmUi(d: LaunchUiData, brief: string, o: { signal?: AbortSignal; budget?: VideoBudget; log?: (s: string) => void } = {}): Promise<Checked<UiPicks | null>> {
  const step = uiStep(d, brief), budget = o.budget ?? new VideoBudget();
  const ok = budget.allow('film', step.tokens);
  if (!step.fits || !ok.ok) return { value: null, source: 'default', problems: [[!step.fits ? 'step too large' : (ok as { why: string }).why]], tries: 0, note: DEFAULT_NOTE };
  return askChecked<UiPicks | null>({
    label: DIRECT_FILM_AGENT, ...(o.log ? { log: o.log } : {}),
    ask: async (history?: History) => {
      const rt = runtime();
      if (!rt.complete) throw new Error(`${rt.name} has no single-answer call`);
      const text = await rt.complete({ agent: DIRECT_FILM_AGENT, system: step.system, prompt: step.prompt, schema: step.schema.shape, model: 'brain', deadlineMs: 300_000, ...(history ? { history } : {}), ...(o.signal ? { signal: o.signal } : {}) });
      budget.spend('film', step.tokens, text);
      return text;
    },
    read: raw => { const x = readUiPicks(raw, d); return x.ok ? { ok: true, value: x.picks } : x; },
    fallback: () => null,
  });
}
