import { CRAFT, graphOr, run as runQ, why as W, whyCraft as WC, type Q } from '@moovi/graph';
import { newId } from './ids';

/**
 * "Why this edit?" (decision 13; hackathon/graphhacks/docs/PLAN.md Q2). Each film decision (the edit's style, its
 * caption look, its cuts, the library cast, the effects, a voice, a change by words) is written to the project graph
 * with BECAUSE edges to what caused it (packages/graph/src/queries/why.ts). "Why this caption?" in the chat is answered
 * from `whyThis`: the shortest path from the newest decision of that kind back to the user's words, a rule, a
 * reference reel or a library asset.
 */
export type WhyKind = 'style' | 'caption' | 'cut' | 'cast' | 'effects' | 'voice' | 'edit' | 'kit';
export interface Cause { label: 'Feedback' | 'Rule' | 'Reference' | 'Asset'; id: string; text: string; how?: string; direct?: boolean }
export interface Link { from: string; to: string; rel: 'LEARNED_FROM' | 'FROM' }
export interface Decision { kind: WhyKind; choice: string; why: string; agent: string; target?: string | null; causes: Cause[]; links?: Link[] }
type Rows = <T = Record<string, unknown>>(q: Q, p?: Record<string, unknown>) => Promise<T[]>;

/** The user's own words as a cause (the brief, or a chat message). */
export const wordsCause = (id: string, text: string, how: string): Cause => ({ label: 'Feedback', id: `fb:${id}`, text: text.slice(0, 300), how });

/**
 * Library assets as causes, each with the reference reel it was broken out of (craft graph, copied in as
 * (:Asset)-[:FROM]->(:Reference) so the path stays in the project graph).
 */
export async function assetCauses(ids: string[], how: (id: string) => string): Promise<{ causes: Cause[]; links: Link[] }> {
  const uniq = [...new Set(ids.filter(Boolean))].slice(0, 24);
  if (!uniq.length) return { causes: [], links: [] };
  const origins = await runQ<{ asset: string; name: string | null; ref: string; title: string }>(CRAFT, WC.assetOrigins, { ids: uniq });
  const causes: Cause[] = uniq.map(id => ({ label: 'Asset', id, text: origins.find(o => o.asset === id)?.name ?? id, how: how(id) }));
  const refs = new Map(origins.map(o => [o.ref, o.title]));
  for (const [id, title] of refs) causes.push({ label: 'Reference', id, text: title, direct: false });
  return { causes, links: origins.map(o => ({ from: o.asset, to: o.ref, rel: 'FROM' as const })) };
}

/** Write one decision and its causes. Without FalkorDB the job stops like every other graph step (decision 13). */
export async function recordDecision(rows: Rows, run: string | null, d: Decision): Promise<string> {
  const id = newId('dec');
  await rows(W.recordDecision, {
    id, kind: d.kind, choice: d.choice.slice(0, 200), why: d.why.slice(0, 400), at: Date.now(), run, target: d.target ?? null, agent: d.agent,
    causes: d.causes.map(c => ({ label: c.label, id: c.id, text: c.text.slice(0, 300), how: c.how ?? null, direct: c.direct !== false })),
    links: d.links ?? [],
  });
  return id;
}

/** Record without ever failing the film for a query error; an outage still stops it (decision 13). */
export const noteDecision = (rows: Rows, run: string | null, d: Decision) =>
  recordDecision(rows, run, d).catch(graphOr(e => { console.warn(`[why] ${d.kind}: ${String(e).slice(0, 160)}`); return null; }, `why: recording the ${d.kind}`));

const ASKS: [RegExp, WhyKind[]][] = [
  [/caption|subtitle|words? on screen|font/, ['caption']],
  [/voice|narrat|speaker/, ['voice']],
  [/style|look/, ['style', 'caption', 'kit']],
  [/cut|pause|trim|length/, ['cut']],
  [/sound|sfx|transition|zoom|camera|whoosh/, ['cast']],
  [/effect|fx/, ['effects']],
  [/kit|palette|colou?r/, ['kit']],
  [/change|edit|version/, ['edit', 'cut', 'style']],
];
/** "why this caption?", "why that voice", "why the cuts?" → the decision kinds it asks about; null if it is not one. */
export function whyQuestion(text: string): WhyKind[] | null {
  const m = /\bwhy\b[^?]{0,40}?\b(?:this|that|the|these|those|my|your)\s+([a-z ]{2,40})/i.exec(text) ?? /\bwhy\s+([a-z]+)\b/i.exec(text);
  if (!m) return null;
  const about = m[1]!.toLowerCase();
  return ASKS.find(([rx]) => rx.test(about))?.[1] ?? null;
}

export interface WhyRow { decision: string; kind: string; choice: string; why: string; at: number; hops: number; path: { id: string; label: string; text: string }[]; rels: string[] }

const LABEL: Record<string, string> = { Feedback: 'your words', Rule: 'the rule', Reference: 'the reference reel', Asset: 'the library asset' };
/** Moovi's answer, read off the paths (pure). */
export function whyAnswer(rows: WhyRow[], ms?: number): string {
  if (!rows.length) return 'I have no recorded decision of that kind in this project yet. Ask me again after the next edit.';
  const top = rows[0]!;
  const chain = (r: WhyRow) => r.path.slice(1).map((n, i) => `${r.rels[i] === 'BECAUSE' ? '' : `${r.rels[i]!.toLowerCase().replace('_', ' ')} `}${LABEL[n.label] ?? n.label} “${n.text}”`).join(', ');
  const more = rows.slice(1, 4).map(r => chain(r)).filter(Boolean);
  return `I chose ${top.choice} because of ${chain(top)}.${top.why ? ` (${top.why})` : ''}${more.length ? ` Also: ${more.join('; ')}.` : ''} That is the shortest path in my memory from the decision back to its cause (${top.hops} hop${top.hops === 1 ? '' : 's'}${ms !== undefined ? `, ${ms} ms` : ''}).`;
}

/** Answer a "why this …?" question from the graph (the newest decision of that kind in the project). */
export async function askWhy(rows: Rows, kinds: WhyKind[], run: string | null = null): Promise<{ text: string; rows: WhyRow[]; ms: number }> {
  const t0 = performance.now();
  const r = await rows<WhyRow>(W.whyThis, { kinds, run });
  const ms = Math.round(performance.now() - t0);
  return { text: whyAnswer(r, ms), rows: r, ms };
}
