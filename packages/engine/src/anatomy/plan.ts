/**
 * Anatomy planner. A film is a run of technical FIGURES, one per section of the script, cast from the style's library
 * (./library.ts) by what each section needs, never the same figure family twice in a row and away from the style's
 * recent films (the kit's cast/remember). Stages, all but the last run while the voice records:
 *   1. sections: the script's lines grouped where they share a structure (three steps → one process figure)
 *   2. cast (deterministic): needs = the arc's slot needs ∪ the detector; a section nothing fits is IMPROVISED (the
 *      kit's improvise() with Anatomy's vocabulary; a model call, or the deterministic sketch) and kept with grow()
 *   3. ONE flat model call: parts (kind from the parts library, or "other" + a primitive), names, notes, the spoken
 *      word each lands / opens / is named on, per-line needs tags and optional figure hints. Rule-based fallback.
 *      A part the library lacks is composed from primitives (./improv.ts) and kept with grow().
 *   4. re-cast with the model's tags + hints; then (after the voice) each section's figure is laid out
 *      (./figures.ts), timed on the voice, given callouts, explodes, links and camera keys, and checked frame by frame
 *      with the player's own code (content inside the safe area, callouts apart).
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { config } from '../config';
import { ask, modelName } from '../runtime';
import { CAMERA, MOTION, SAFE, TOKENS, palette, type Palette, type Theme } from '../../../library/src/anatomy/tokens';
import { within } from '../styles/common';
import { NEEDS, cast, detectNeeds, grow, mergeNeeds, grown, improvise, isNeed, keyWords, listItems, recentSetups, sketch, spokenNumber, type BeatIn, type Cast, type Need, type Setup, type Spec } from '../styles/kit';
import { siteFilms as kitSiteFilms } from '../styles/kit/library';
import { ISO } from './iso';
import { KINDS, KIND_HINT, isKind, part, type Kind } from './parts';
import { PRIMS, composePart, partErrors, sketchPart, tidyPart, type PartSpec } from './improv';
import { FIGURES, FIGURE_TITLE, SETUPS, VOCAB, setupOf, type AnSetup, type Figure } from './library';
import { LAYOUTS, composed, lroute, type Asm, type Detail, type FigIn, type FigOut, type Ground, type Label, type Line, type Link, type PartIn, type Prop, type Tag, type View } from './figures';
import type { Part } from './prims';

const V = 2;
export interface Word { word: string; t: number; end: number }
export interface Beat { t0: number; t1: number; toks: { text: string; t: number; end: number; accent: boolean }[] }
export interface Sec {
  i: number; setup: string; figure: string; variant: string; title: string; source: string; text: string;
  t0: number; t1: number; ground: Ground; asms: Asm[]; links: Link[]; props: Prop[]; lines: Line[]; tags: Tag[]; labels: Label[];
  cams: { t: number; focus: number }[]; view: View; detail?: Detail; ext: number[][];
}
export interface Film {
  id: string; duration: number; audio: string; theme: Theme; pal: Palette; tokens: typeof TOKENS; title: string; brand: string; line: string; arc: string;
  secs: Sec[]; beats: Beat[]; end: { t0: number; name: string; line: string };
}

/* ───────── 1. sections ───────── */

export interface SecPlan { /** how many things it names (the plan's parts in it, else a rule count) */ things?: number; l0: number; l1: number; w0: number; w1: number; text: string; needs: Need[]; number: string | null; role: BeatIn['role']; items: number; setup: string | null; spec?: Spec; specSource?: string; why: string; hints?: string[] }
const STRUCT: Need[] = ['steps', 'process', 'list', 'compare', 'layers', 'stakes', 'before-after', 'timeline', 'cycle'];
const wc = (s: string) => s.split(/\s+/).filter(Boolean).length;
const est = (s: string) => wc(s) / 2.15; // the voice speaks ~2.0-2.3 words a second

/** The lines grouped into sections: a line joins the one before when that one is too short, or when they share a structure. */
export function sectionize(lines: string[], slotNeeds: Need[][] = []): SecPlan[] {
  const needsOf = (i: number) => [...new Set([...(slotNeeds[i] ?? []), ...detectNeeds(lines[i]!, { index: i, count: lines.length })])] as Need[];
  const groups: number[][] = [];
  lines.forEach((l, i) => {
    const cur = groups.at(-1);
    if (!cur) { groups.push([i]); return; }
    const curText = cur.map(k => lines[k]).join(' '), share = STRUCT.some(n => cur.every(k => needsOf(k).includes(n)) && needsOf(i).includes(n));
    const lastLine = i === lines.length - 1;
    if (cur.length < 3 && ((est(curText) < 2.4 && !(lastLine && est(l) >= 2)) || (share && est(curText) + est(l) <= 7.2))) cur.push(i); else groups.push([i]);
  });
  if (groups.length > 1 && est(groups.at(-1)!.map(k => lines[k]).join(' ')) < 1.6) { const g = groups.pop()!; groups.at(-1)!.push(...g); }
  while (groups.length > 7) { let best = 0; for (let i = 1; i < groups.length - 1; i++) if (groups[i]!.length + groups[i + 1]!.length < groups[best]!.length + groups[best + 1]!.length) best = i; groups.splice(best, 2, [...groups[best]!, ...groups[best + 1]!]); }
  const starts: number[] = []; let w = 0; for (const l of lines) { starts.push(w); w += wc(l); }
  return groups.map((g, gi) => {
    const text = g.map(k => lines[k]).join(' '), needs = [...new Set(g.flatMap(needsOf))] as Need[];
    const share = g.length > 1 && STRUCT.some(n => g.every(k => needsOf(k).includes(n)));
    return { l0: g[0]!, l1: g.at(-1)!, w0: starts[g[0]!]!, w1: starts[g.at(-1)!]! + wc(lines[g.at(-1)!]!), text, needs, number: numberPhrase(text), role: gi === 0 ? 'open' : gi === groups.length - 1 ? 'close' : 'middle', items: share ? g.length : listItems(text).length, setup: null, why: '' };
  });
}

/** a spoken number with its noun, as the voice says it ("40 countries", "99.99% uptime", "$2B") */
export function numberPhrase(text: string): string | null {
  const m = /((?:[$€£₹])?\d[\d,]*(?:\.\d+)?(?:\s?(?:%|×|x|k|bn|million|billion|thousand))?)(?:\s+([a-z][a-z-]{2,}))?/i.exec(text);
  if (!m) return null;
  const STOP = /^(and|the|of|to|in|on|for|with|a|an|or|is|are|per|at|by|from|that|this|than|more|less|times)$/i;
  const s = (m[2] && !STOP.test(m[2]) ? `${m[1]!.trim()} ${m[2]}` : m[1]!.trim()).replace(/\s+/g, ' ');
  return s.length > 16 ? m[1]!.trim() : s;
}

/* ───────── the parts menu: library kinds + the improvised parts the style has kept ───────── */

export interface GrownPart { name: string; spec: PartSpec }
export const grownParts = (): GrownPart[] => grown('anatomy').filter(s => s.family === 'part' && s.generated).map(s => ({ name: s.name, spec: tidyPart(s.generated!.spec as PartSpec, s.name) }));
const slugKind = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').slice(-2).join('-');

/** what a kind string the model (or rules) gave resolves to: a library kind, a kept improvised part, or a new one */
export function resolveKind(kind: string, name: string, shape?: string): { kind: string; g: Part; improvised?: PartSpec } {
  const k = kind.toLowerCase().trim();
  if (isKind(k)) return { kind: k, g: part(k, '') };
  const gp = grownParts().find(p => p.name === k || p.name === slugKind(name));
  if (gp) return { kind: gp.name, g: composePart(gp.spec) };
  const near = (KINDS as readonly string[]).find(x => k && (k === `${x}s` || k.endsWith(x) || k.startsWith(x)) && x.length > 2);
  if (near && k !== 'other') return { kind: near, g: part(near, '') };
  const label = k && k !== 'other' ? k : name;
  const spec = shape && (PRIMS as readonly string[]).includes(shape) ? tidyPart({ ...sketchPart(label, name), body: shape as PartSpec['body'] }, slugKind(label) || 'unit') : sketchPart(slugKind(label) || 'unit', name);
  const g = composePart(spec);
  return { kind: spec.name, g, improvised: partErrors(g).length ? undefined : spec };
}

/* ───────── 3. the model call (one flat schema) + the rule-based fallback ───────── */

export type Raw = {
  title: string;
  lines: { line: number; needs: string[]; figure?: string }[];
  parts: { kind: string; name: string; note: string; word: number; explode: number; label: number; shape?: string }[];
};
const SYSTEM = () => `You storyboard Anatomy reels: a voice explains a brand's product or system while precise isometric technical drawings build themselves. The film is a run of FIGURES (an exploded stack, a process line, a hub, a scale comparison, a detail circle...), and each figure is made of PARTS drawn from a fixed library of code-drawn isometric objects.
Parts library (kind: what it pictures):
${KINDS.map(k => `${k}: ${KIND_HINT[k as Kind]}`).join('\n')}${grownParts().length ? `\n${grownParts().slice(-20).map(p => `${p.name}: (kept) ${p.spec.body}`).join('\n')}` : ''}
If nothing in the library pictures a thing, use kind "other" and shape = the closest primitive (${PRIMS.join(', ')}).
Figures (for optional hints): ${FIGURES.filter(f => f !== 'composed').join(', ')}.
Needs words: ${NEEDS.join(', ')}.
Rules: 1-3 parts per line, 4-14 in all, each a real component, actor or object that THIS line names or clearly implies, in spoken order. word: index of the spoken word where it should appear (on or just before the word that names it). name: 1-3 words, the thing's real name as spoken (e.g. "Edge network", "Cyclone", "Git push"); note: 2-5 words, a true detail from the script or facts, or "". label: the word index where its name is spoken, or -1. explode: the word index where it should open to show its insides (devices, machines, servers, buildings, containers), else -1. lines: for each script line, 1-4 needs words and optionally the figure that would show it best. Never invent facts. Pick kinds that picture the thing literally, not a pun.`;

const schema = {
  title: z.string().describe('2-5 word technical title for the whole film'),
  lines: z.array(z.object({ line: z.number().int(), needs: z.array(z.string()), figure: z.string().optional() })),
  parts: z.array(z.object({ kind: z.string(), name: z.string(), note: z.string(), word: z.number().int(), explode: z.number().int(), label: z.number().int(), shape: z.string().optional() })).min(1).max(18),
};

const RULES: [RegExp, Kind][] = [
  [/\b(watch|wrist|wearable)/i, 'watch'], [/\b(earbud|headphone|music|audio|listen|podcast)/i, 'headphones'], [/\b(speaker|voice assistant|sound)/i, 'speaker'], [/\b(photo|camera|video|film|shoot)/i, 'camera'],
  [/\b(drone|aerial)/i, 'drone'], [/\b(robot|arm)\b/i, 'robot'], [/\b(print|prototype)/i, 'printer'], [/\b(idea|insight|bright)/i, 'bulb'],
  [/\b(coffee|cafe|mug|tea|latte|espresso)/i, 'mug'], [/\b(kitchen|cook|recipe|meal|food)/i, 'blender'], [/\b(fridge|grocer|fresh|cold)/i, 'fridge'], [/\b(laundry|wash|clean)/i, 'washer'],
  [/\b(plant|garden|green|leaf|grow)/i, 'plant'], [/\b(forest|tree|carbon|climate|sustainab)/i, 'tree'], [/\b(bottle|drink|water|skincare|serum)/i, 'bottle'],
  [/\b(car|drive|driver|ride|road)\b/i, 'car'], [/\b(truck|freight|logistic|deliver|shipping|fleet)/i, 'truck'], [/\b(scooter|bike|commute)/i, 'scooter'], [/\b(flight|plane|travel|airport|trip)/i, 'plane'],
  [/\b(launch|rocket|lift-?off)/i, 'rocket'], [/\b(cargo|container|supply chain|import|export)/i, 'container'],
  [/\b(home|house|rent|property|tenant|landlord)/i, 'house'], [/\b(store|shop|retail|merchant|boutique)/i, 'shop'], [/\b(factory|manufactur|production|plant floor)/i, 'factory'], [/\b(office|company|enterprise|business|bank)/i, 'office'], [/\b(warehouse|inventory|stock|fulfil)/i, 'warehouse'],
  [/\b(payment|pay|checkout|card|transaction)/i, 'creditcard'], [/\b(cash|payout|revenue|profit|earn)/i, 'cash'], [/\b(money|price|cost|save|saving|budget|fee)/i, 'coin'], [/\b(wallet|spend)/i, 'wallet'],
  [/\b(chart|metric|analytic|dashboard|report|growth|insight)/i, 'chart'], [/\b(time|hour|minute|second|fast|instant|schedule)/i, 'clock'], [/\b(calendar|booking|appointment|meeting|date)/i, 'calendar'],
  [/\b(email|mail|inbox|newsletter|invoice)/i, 'mail'], [/\b(chat|message|support|conversation|reply|feedback)/i, 'chat'], [/\b(notif|alert|remind)/i, 'bell'], [/\b(learn|course|docs|guide|book|read)/i, 'book'],
  [/\b(goal|target|aim|precis)/i, 'target'], [/\b(win|award|best|leader)/i, 'trophy'], [/\b(risk|incident|error|outage|problem|fail)/i, 'alert'], [/\b(search|find|discover|inspect)/i, 'search'],
  [/\b(secure|security|safe|privacy|protect|compliance)/i, 'shield'], [/\b(key|access|login|password|identity)/i, 'key'], [/\b(lock|encrypt)/i, 'lock'],
  [/\b(medic|pill|pharma|prescription|drug)/i, 'pill'], [/\b(health|heart|patient|clinic|vital|care)/i, 'heart'], [/\b(cart|order|ecommerce|basket)/i, 'cart'], [/\b(bag|purchase|fashion)/i, 'bag'], [/\b(terminal|point of sale|pos)\b/i, 'pos'], [/\b(catalog|product range|shelf)/i, 'shelf'],
  [/\b(crate|pallet|wholesale|packag)/i, 'crate'], [/\b(solar|sun|energy|power)/i, 'solar'], [/\b(wind|turbine|renewable)/i, 'turbine'], [/\b(silo|grain|raw material|bulk)/i, 'silo'], [/\b(valve|pipe|plumb|flow control)/i, 'valve'],
  [/\b(deploy|server|backend|api|host|compute|function)/i, 'server'], [/\b(data|database|storage|store|record|memory)/i, 'database'], [/\b(global|edge|network|world|region|cdn|internet)/i, 'globe'],
  [/\b(app|mobile|phone|notification)/i, 'phone'], [/\b(tablet|ipad)/i, 'tablet'], [/\b(site|web|page|preview|browser)/i, 'browser'], [/\b(code|developer|git|commit|laptop)/i, 'laptop'], [/\b(type|keyboard|write|writing)/i, 'keyboard'], [/\b(file|document|form|contract)/i, 'card'],
  [/\b(ai|model|chip|processor|gpu|intelligen)/i, 'chip'], [/\b(motor|suction|torque|engine)/i, 'motor'], [/\b(air|fan|cool|purif)/i, 'fan'], [/\b(filter|cyclone|dust|separat)/i, 'cyclone'], [/\b(battery|charge|run ?time)/i, 'battery'],
  [/\b(team|people|customers|users|everyone|community)/i, 'crowd'], [/\b(you|person|founder|creator|developer)\b/i, 'pawn'], [/\b(connect|integrat|switch|router|sync)/i, 'hub'], [/\b(package|product|box|bundle|release)/i, 'package'],
  [/\b(sensor|lens|detect|measur|scan)/i, 'sensor'], [/\b(automat|workflow|process|gear|pipeline)/i, 'gear'], [/\b(tank|reservoir|capacity|bin)/i, 'tank'], [/\b(board|hardware|electronic|circuit)/i, 'board'],
];
const norm = (w: string) => w.toLowerCase().replace(/[^a-z0-9]/g, '');
/** a name or note cut at a word, never mid-word */
const clip = (s: string, n: number) => { s = s.trim().replace(/\s+/g, ' '); if (s.length <= n) return s; const c = s.slice(0, n + 1).replace(/\s+\S*$/, ''); return c.length >= 3 ? c : s.slice(0, n); };

/** Rule-based parts: per line 1-2 kinds from what it says, named by the word that triggered them (a spoken word). */
export function ruleParts(script: string[], lines: string[], avoid: string[] = []): Raw['parts'] {
  const out: Raw['parts'] = [], used = new Set<string>(avoid);
  let w0 = 0;
  for (const line of lines) {
    const ws = line.split(/\s+/).filter(Boolean), text = ws.join(' ');
    let n = 0;
    for (const [re, k] of RULES) {
      if (n >= (wc(text) > 11 ? 2 : 1) || used.has(k)) continue;
      const m = re.exec(text); if (!m) continue;
      const wi = ws.findIndex(w => norm(w).startsWith(norm(m[1] ?? m[0]).slice(0, 4)));
      const word0 = wi >= 0 ? ws[wi]! : m[0], word = /^(you|your|yours|we|our|it|its|they|their|every|all|one|that|this|the|a|an)$/i.test(norm(word0)) ? '' : word0;
      used.add(k); n++;
      out.push({ kind: k, name: word.replace(/[^\p{L}\p{N}' -]/gu, '').replace(/^./, c => c.toUpperCase()), note: '', word: w0 + Math.max(0, wi), explode: -1, label: w0 + Math.max(0, wi), shape: undefined });
    }
    w0 += ws.length;
  }
  void script;
  return out;
}
function fallback(script: string[], lines: string[], name: string): Raw {
  const parts = ruleParts(script, lines);
  if (parts[1]) parts[1].explode = parts[1].word + 2;
  return { title: `${name} anatomy`, lines: [], parts };
}

/* ───────── 2+3+4. plan: sections → cast → (model ∥ improvise) → re-cast ───────── */

export interface PlanOut { raw: Raw; source: string; seconds: number; secs: SecPlan[]; partsGrown: string[]; setupsGrown: string[] }
export const LIB = (): AnSetup[] => [...SETUPS, ...(grown('anatomy').filter(s => s.family !== 'part' && s.generated) as AnSetup[]).map(s => ({ ...s, figure: 'composed' as const, variant: 'grown', parts: [1, 6] as [number, number], family: s.family || 'improvised' }))];

function beatsIn(secs: SecPlan[]): BeatIn[] {
  return secs.map((s, i) => ({ index: i, text: s.text, words: wc(s.text), seconds: est(s.text), needs: s.needs, items: Math.max(s.items, s.things ?? ruleParts([], [s.text]).length), number: spokenNumber(s.text), role: s.role, hints: s.hints }));
}
/**
 * The kit's cast() with Anatomy's memory made firm: the set-ups of the style's last film weigh 0.55 (on top of the kit's
 * recency penalty, which fades by list position), so a second film of the same site is a different film.
 */
export function castFigures(beats: BeatIn[], o: { seed: string; recent: string[]; last?: string[]; lib?: AnSetup[] }): Cast[] {
  const last = new Set(o.last ?? o.recent.slice(0, beats.length));
  const lib = (o.lib ?? SETUPS).map(s => (last.has(s.id) ? { ...s, weight: (s.weight ?? 1) * 0.55 } : s));
  return cast(beats, lib, { seed: o.seed, recent: o.recent, floor: 3.2, maxUse: 1, typeShare: 0 });
}
/** this site's own earlier films, newest first, from the styles graph (a site's second film must differ from its first) */
const siteFilms = (site: string) => kitSiteFilms('anatomy', site, 2);
const siteSetups = (site: string) => siteFilms(site).flatMap(x => x.setups);
/** arcs this site's own last films used, newest first (put ahead of the style's recent arcs) */
export const siteArcs = (site: string) => siteFilms(site).map(x => x.arc ?? '').filter(Boolean);
const castSecs = (secs: SecPlan[], seed: string, lib: AnSetup[], site: string): Cast[] => { const mine = siteSetups(site); return castFigures(beatsIn(secs), { seed, recent: [...mine, ...recentSetups('anatomy', 3)], last: [...recentSetups('anatomy', 1), ...mine], lib }); };

export async function planFilm(o: { id: string; script: string; lines?: string[]; slotNeeds?: Need[][]; facts: string[]; brand: string; line: string; seed: string; signal?: AbortSignal; log?: (s: string) => void; improviseMs?: number; offline?: boolean; force?: string[] }): Promise<PlanOut> {
  const s0 = Date.now(), log = o.log ?? (() => undefined);
  const lines = (o.lines ?? o.script.split('\n')).map(l => l.trim()).filter(Boolean);
  const script = lines.join(' ').split(/\s+/).filter(Boolean);
  const secs = sectionize(lines, o.slotNeeds);
  const lib = LIB();
  // 2. a first cast from the detector + the arc (no model), so improvisations can start now
  let c0 = castSecs(secs, o.seed, lib, o.id);
  const wordsOf = (s: SecPlan) => script.slice(s.w0, s.w1).map((w, i) => ({ word: w, t: i * 0.38, end: i * 0.38 + 0.3 }));
  const improvs = new Map<number, Promise<{ spec: Spec; source: string }>>();
  c0.forEach((c, i) => { if (!c.setup && !o.offline) improvs.set(i, improvise({ style: 'anatomy', vocab: VOCAB, beat: { text: secs[i]!.text, words: wordsOf(secs[i]!), needs: secs[i]!.needs }, ms: o.improviseMs ?? 25_000, signal: o.signal, log, context: 'This style draws precise isometric technical illustrations: "part" elements are real objects from the icon list (the things the line names), "shape" elements are primitives, 2-4 pictured elements, labels are the spoken names.' }).catch(() => ({ spec: sketch({ text: secs[i]!.text, words: wordsOf(secs[i]!), needs: secs[i]!.needs }, VOCAB), source: 'sketch' }))); });
  // 3. the one model call (cached by its input)
  const key = createHash('sha1').update(JSON.stringify([V, lines, o.facts])).digest('hex').slice(0, 16);
  const cdir = join(config.data, 'anatomy', 'cache'), cfile = join(cdir, `${key}.json`); mkdirSync(cdir, { recursive: true });
  let raw: Raw | null = null, source = 'rules';
  if (o.offline) raw = null; else if (existsSync(cfile)) { try { raw = JSON.parse(readFileSync(cfile, 'utf8')); source = 'cache'; } catch { raw = null; } }
  if (!raw && !o.offline) {
    let w = 0; const numbered = lines.map((l, li) => `L${li}: ${l.split(/\s+/).filter(Boolean).map(x => `${w++}:${x}`).join(' ')}`).join('\n');
    const prompt = `Brand: ${o.brand} (${o.line})\nFacts (the only claims allowed): ${o.facts.join(' | ') || '(none beyond the script)'}\n\nScript, line by line (word index:word):\n${numbered}\n\nStoryboard it.`;
    for (const [tier, ms] of [['crew', 45_000], ['fast', 40_000]] as const) {
      try { raw = await within(ms, o.signal, signal => ask({ agent: 'anatomy-plan', tier, deadlineMs: ms, maxTurns: 3, quick: true, system: SYSTEM(), prompt, schema, signal })) as Raw; writeFileSync(cfile, JSON.stringify(raw)); source = modelName(tier); break; }
      catch (e) { if (o.signal?.aborted) throw e; log(`plan on ${tier} failed (${String(e instanceof Error ? e.message : e).slice(0, 100)})${tier === 'crew' ? `; ${modelName('fast')} next` : '; rule-based plan'}`); }
    }
  }
  if (!raw) raw = fallback(script, lines, o.brand);
  raw.parts = (raw.parts ?? []).filter(p => p && typeof p.name === 'string' && p.name.trim()).map(p => ({ ...p, word: Math.max(0, Math.min(script.length - 1, Math.round(Number(p.word) || 0))) }));
  raw.lines = Array.isArray(raw.lines) ? raw.lines : [];
  // 4. re-cast with the model's needs tags + figure hints merged in
  const mn = mergeNeeds(lines, raw.lines.map(l => ({ line: Math.round(Number(l.line)), needs: (Array.isArray(l.needs) ? l.needs : []).map(n => String(n).toLowerCase().trim()) })));
  if (!mn.trusted && raw.lines.length) log('plan: the model need tags look random; casting on the detector + the arc');
  for (const s of secs) {
    const tags = raw.lines.filter(l => l.line >= s.l0 && l.line <= s.l1);
    for (let li = s.l0; li <= s.l1; li++) s.needs = [...new Set([...s.needs, ...(mn.needs[li] ?? [])])] as Need[];
    const figs = tags.map(l => String(l.figure ?? '').toLowerCase().trim()).filter(f => (FIGURES as readonly string[]).includes(f));
    s.hints = lib.filter(x => figs.includes(x.figure)).map(x => x.id);
  }
  for (const s of secs) s.things = new Set(raw.parts.filter(p => p.word >= s.w0 && p.word < s.w1).map(p => norm(p.name))).size || undefined;
  const c1 = castSecs(secs, o.seed, lib, o.id), setupsGrown: string[] = [];
  for (let i = 0; i < secs.length; i++) {
    const s = secs[i]!, c = c1[i]!;
    if (improvs.has(i) && (!c.setup || c0[i]?.setup == null)) { // an improvisation was made for this beat: it is the beat's figure
      const r = await improvs.get(i)!; s.spec = r.spec; s.specSource = r.source; s.setup = null; s.why = `improvised (${r.source}; ${c0[i]!.why})`;
      if (r.source === 'model') setupsGrown.push(grow('anatomy', { name: `improvised ${r.spec.layout}`, about: r.spec.about, needs: (r.spec.needs.length ? r.spec.needs : s.needs).slice(0, 4), family: 'improvised', generated: { spec: r.spec, model: 'model', created: new Date().toISOString(), uses: 1 } }));
    } else if (!c.setup) { s.spec = sketch({ text: s.text, words: wordsOf(s), needs: s.needs }, VOCAB); s.specSource = 'sketch'; s.why = c.why; }
    else { s.setup = c.setup.id; s.why = c.why; if ((c.setup as AnSetup).figure === 'composed') { s.spec = c.setup.generated!.spec as Spec; s.specSource = 'grown'; } }
  }
  if (o.force?.length) secs.forEach((s, i) => { const id = o.force![i % o.force!.length]!; const st = setupOf(id); if (st) { s.setup = st.id; s.spec = undefined; s.why = 'forced'; } else if (id.startsWith('improv')) { s.setup = null; s.spec = sketch({ text: s.text, words: wordsOf(s), needs: s.needs }, VOCAB); s.specSource = 'sketch'; s.why = 'forced'; } });
  c0 = c1;
  return { raw, source, seconds: +((Date.now() - s0) / 1000).toFixed(1), secs, partsGrown: [], setupsGrown };
}

/* ───────── after the voice: lay out, time, check ───────── */

/** script word index → the voice's word (greedy alignment on normalised text; proportional where they disagree) */
export function align(script: string[], words: Word[]): number[] {
  const out: number[] = []; let j = 0;
  for (let i = 0; i < script.length; i++) {
    const s = norm(script[i]!); let hit = -1;
    for (let k = j; k < Math.min(words.length, j + 6); k++) if (norm(words[k]!.word) === s) { hit = k; break; }
    if (hit >= 0) { out.push(hit); j = hit + 1; } else out.push(Math.min(words.length - 1, Math.max(j, Math.round(i / Math.max(1, script.length - 1) * (words.length - 1)))));
  }
  return out;
}

/** Caption beats: the voice in phrases of up to ~2.8 s, broken at sentence ends and (when long) commas. */
function beatsOf(words: Word[], accents: Set<string>): Beat[] {
  const out: Beat[] = []; let cur: Word[] = [];
  const flush = () => { if (!cur.length) return; out.push({ t0: cur[0]!.t, t1: cur.at(-1)!.end, toks: cur.map(w => ({ text: w.word, t: w.t, end: w.end, accent: accents.has(norm(w.word)) })) }); cur = []; };
  words.forEach(w => { cur.push(w); const span = w.end - cur[0]!.t; if (/[.!?]["')]?$/.test(w.word) || (span > 2.2 && /[,;:]$/.test(w.word)) || span > 2.8 || cur.length >= 9) flush(); });
  flush();
  out.forEach((b, i) => { b.t0 = i ? Math.max(out[i - 1]!.t1, b.t0 - 0.08) : 0; });
  out.forEach((b, i) => { b.t1 = out[i + 1]?.t0 ?? b.t1 + 0.4; });
  return out;
}

const EXPLODES: string[] = ['bench', 'cutaway', 'pipeline', 'hub', 'split', 'tower', 'macro', 'blueprint', 'composed', 'twin', 'mesh'];

export function buildFilm(o: { id: string; plan: PlanOut; script: string; words: Word[]; duration: number; brand: string; line: string; brandColor: string; theme: Theme; audio: string; arc?: string; seed: string; log?: (s: string) => void }): { film: Film; notes: string[] } {
  const notes: string[] = [], lines = o.script.split('\n').map(l => l.trim()).filter(Boolean), script = lines.join(' ').split(/\s+/).filter(Boolean), map = align(script, o.words), W = o.words;
  const tAt = (i: number) => W[map[Math.max(0, Math.min(script.length - 1, i))]!]!.t;
  const lastT = W.at(-1)!.end, endT = +(lastT + 0.35).toFixed(3);
  const plan = o.plan, seedN = parseInt(createHash('sha1').update(o.seed).digest('hex').slice(0, 8), 16);
  // section times: each starts a beat before its first word (the first at 0); a section too short to read merges back
  let sp = plan.secs.map(s => ({ ...s }));
  let times = sp.map((s, i) => (i === 0 ? 0 : Math.max(0, tAt(s.w0) - 0.3)));
  for (let k = 1; k < sp.length;) { const t1 = k + 1 < sp.length ? times[k + 1]! : endT; if (t1 - times[k]! < 2.2 || times[k]! - times[k - 1]! < 2.2) { const a = sp[k - 1]!, b = sp[k]!; const keep = times[k]! - times[k - 1]! < 2.2 ? b : a; sp.splice(k - 1, 2, { ...keep, l0: a.l0, l1: b.l1, w0: a.w0, w1: b.w1, text: `${a.text} ${b.text}`, number: a.number ?? b.number, role: k - 1 === 0 ? 'open' : keep.role }); times.splice(k, 1); notes.push(`merged a short section into its neighbour`); } else k++; }
  // parts: the plan's, each to the section its word is in; resolved to geometry (library, kept, or improvised now)
  const partsGrown: string[] = [];
  const resolved = plan.raw.parts.map((p, i) => {
    const r = resolveKind(String(p.kind ?? ''), p.name, p.shape);
    if (r.improvised) { partsGrown.push(grow('anatomy', { name: r.kind, about: `improvised part "${p.name}": ${r.improvised.body}/${r.improvised.shape}/${r.improvised.detail}`, needs: ['product'], family: 'part', generated: { spec: r.improvised, model: plan.source, created: new Date().toISOString(), uses: 1 } })); notes.push(`improvised part "${p.name}" from primitives (${r.improvised.body}, ${r.improvised.shape}, top ${r.improvised.top})`); }
    return { ...p, kind: r.kind, g: r.g, i };
  });
  const partFor = (kind: string) => (isKind(kind) ? part(kind, o.brand) : resolveKind(kind, kind).g);
  const allSoFar: PartIn[] = [];
  const secs: Sec[] = sp.map((s, si) => {
    const t0 = times[si]!, t1 = si + 1 < sp.length ? times[si + 1]! : endT;
    const setup = s.setup ? setupOf(s.setup) ?? LIB().find(x => x.id === s.setup) : undefined;
    const figure: Figure = setup ? setup.figure : 'composed';
    const range = setup?.parts ?? [1, 4];
    // this section's named parts, in spoken order
    let mine = resolved.filter(p => p.word >= s.w0 && p.word < s.w1).sort((a, b) => a.word - b.word);
    const seenK = new Set<string>(); mine = mine.filter(p => { const k = `${p.kind}:${norm(p.name)}`; if (seenK.has(k)) return false; seenK.add(k); return true; });
    mine = mine.slice(0, range[1]);
    const pins: PartIn[] = mine.map((p, k) => ({ id: `s${si}p${k}`, kind: p.kind, name: clip(p.name, 22), note: clip(p.note ?? '', 30), tIn: tAt(p.word) - MOTION.enter.lead, tEx: p.explode >= 0 ? tAt(p.explode) : null, tLabel: p.label >= 0 ? tAt(p.label) : null, g: p.g, key: true }));
    // top up to the figure's minimum: from the section's own words (rules), then its key words
    if (pins.length < Math.max(1, range[0])) {
      const extra = ruleParts(script, [script.slice(s.w0, s.w1).join(' ')], pins.map(p => p.kind)).map(p => ({ ...p, word: p.word + s.w0 }));
      const keys = keyWords(script.slice(s.w0, s.w1).map(w => ({ word: w, t: 0, end: 0 })), 4).map(k => k.word);
      for (const p of extra) { if (pins.length >= Math.max(1, range[0])) break; if (pins.some(q => norm(q.name) === norm(p.name))) continue; pins.push({ id: `s${si}t${pins.length}`, kind: p.kind, name: p.name, note: '', tIn: tAt(p.word) - MOTION.enter.lead, tEx: null, tLabel: tAt(p.word), g: part(p.kind, o.brand), key: true }); }
      const pool = ['server', 'chip', 'database', 'hub', 'package', 'gear', 'sensor', 'board'].filter(k => !pins.some(p => p.kind === k));
      void keys;
      while (pins.length < 1) { const k = pool[(seedN + si + pins.length) % pool.length]!; pins.push({ id: `s${si}f${pins.length}`, kind: k, name: '', note: '', tIn: t0 + 0.4 + pins.length * 0.5, tEx: null, tLabel: null, g: part(k, o.brand), key: false }); }
      if (pins.length < range[0]) notes.push(`section ${si + 1}: ${setup?.id ?? 'improvised'} drawn with ${pins.length} part(s) (wants ${range[0]})`); else notes.push(`section ${si + 1}: topped up to ${pins.length} part(s) from its own words`);
    }
    // entry times: the first lands at once (the figure is never bare), then in spoken order, at least 0.45 s apart
    // and every part is on by 65% of the section, so a part named late still gets its time on screen
    pins.sort((a, b) => a.tIn - b.tIn).forEach((p, k, arr) => { const latest = t0 + 0.1 + Math.max(0.4, (t1 - t0) * 0.65 - 0.1) * (k + 1) / arr.length; p.tIn = +Math.min(t1 - 1.0, latest, k === 0 ? t0 + 0.1 : Math.max(p.tIn, arr[k - 1]!.tIn + 0.45, t0 + 0.1)).toFixed(3); });
    const f: FigIn = { t0, t1, parts: pins, variant: setup?.variant ?? 'composed', brand: o.brand, text: s.text, seed: seedN + si * 101, number: s.number, all: [...allSoFar], partFor };
    let out: FigOut;
    try { out = figure === 'composed' ? composed(f, s.spec ?? sketch({ text: s.text, words: script.slice(s.w0, s.w1).map((w, i) => ({ word: w, t: i * 0.38, end: i * 0.38 + 0.3 })), needs: s.needs }, VOCAB)) : LAYOUTS[figure](f); }
    catch (e) { notes.push(`section ${si + 1}: ${figure} failed (${String(e instanceof Error ? e.message : e).slice(0, 80)}); bench instead`); out = LAYOUTS.bench({ ...f, variant: 'cols2' }); }
    allSoFar.push(...pins.filter(p => p.key));
    return finish(si, setup?.id ?? (s.specSource === 'grown' ? s.setup ?? 'grown' : `improvised-${s.spec?.layout ?? 'row'}`), figure, f, out, s, notes);
  });
  const accents = new Set(secs.flatMap(s => s.asms.filter(a => a.src >= 0).flatMap(a => a.name.split(/\s+/).map(norm))).filter(w => w.length > 2));
  const film: Film = {
    id: o.id, duration: +Math.max(o.duration, endT + 2.4).toFixed(2), audio: o.audio, theme: o.theme, pal: palette(o.brandColor, o.theme), tokens: TOKENS,
    title: plan.raw.title?.trim().slice(0, 32) || `${o.brand} anatomy`, brand: o.brand, line: o.line, arc: o.arc ?? '', secs, beats: beatsOf(W, accents), end: { t0: endT, name: o.brand, line: o.line },
  };
  check(film, notes);
  if (partsGrown.length) notes.push(`kept ${partsGrown.length} improvised part(s): ${partsGrown.join(', ')}`);
  return { film, notes };
}

/** A figure's output becomes a timed section: link routes, explodes, callouts, camera keys and the camera's extent. */
function finish(si: number, setup: string, figure: Figure, f: FigIn, out: FigOut, sp: SecPlan, notes: string[]): Sec {
  const { t0, t1 } = f, M = MOTION;
  const asms = out.asms.map(a => ({ ...a, tIn: +Math.max(t0 + 0.05, Math.min(a.tIn, t1 - 0.9)).toFixed(3) }));
  // explodes: the plan's word, at least 1.1 s after landing, at most 2 per section; one is added on a long section
  let exN = asms.filter(a => a.ex.length).length;
  if (EXPLODES.includes(figure)) {
    for (const a of asms) {
      const p = a.src >= 0 ? f.parts.find(q => q.id === a.id) : undefined; if (!p || p.tEx == null || a.ex.length || a.layers < 2 || exN >= 2) continue;
      const t = Math.max(p.tEx, a.tIn + 1.1); if (t > t1 - 1.2) continue;
      a.ex.push([+t.toFixed(3), +Math.min(t + M.explode.hold, t1 - 0.35).toFixed(3)]); exN++;
    }
    if (!exN && t1 - t0 > 4.2) { const a = asms.find(x => x.src >= 0 && x.layers >= 2 && x.tIn + 1.3 < t1 - 1.6); if (a) { const t = a.tIn + 1.3; a.ex.push([+t.toFixed(3), +Math.min(t + M.explode.hold, t1 - 0.35).toFixed(3)]); } }
  }
  // links
  const links: Link[] = [];
  for (const l of out.links) {
    const A0 = asms[l.a], B0 = asms[l.b]; if (!A0 || !B0) continue;
    const tIn = +(l.tIn ?? Math.min(t1 - 0.8, Math.max(A0.tIn, B0.tIn) + 0.5)).toFixed(3);
    const route = l.route ?? (l.kind === 'wire' ? wire(A0, B0) : lroute(A0, B0, A0.z));
    links.push({ a: l.a, b: l.b, route, kind: l.kind ?? 'pipe', tIn, tFlow: +Math.min(t1 - 0.4, Math.max(l.tFlow ?? tIn + 0.9, tIn + M.pipe.draw)).toFixed(3), loop: l.loop, dir: l.dir, spacing: l.spacing });
  }
  // callouts: every named part, on its name (or just after it lands), 0.9 s apart, never past the section
  const labels: Label[] = [...(out.labels ?? [])];
  if (!out.noAuto) {
    const own = (a: Asm) => f.parts.find(q => q.id === a.id) ?? f.all.find(q => q.id === a.id);
    const want = asms.map((a, i) => ({ a, i })).filter(({ a }) => a.src >= 0 && (own(a)?.key ?? false) && a.name);
    const seenSrc = new Set<string>();
    want.map(({ a, i }) => ({ i, a, t: Math.max((f.parts.some(q => q.id === a.id) ? own(a)?.tLabel : null) ?? a.tIn + 0.6, a.tIn + 0.45) })).sort((p, q) => p.t - q.t).forEach(({ i, a, t }) => {
      if (seenSrc.has(a.id)) return; seenSrc.add(a.id);
      const prev = labels.filter(l => l.asm >= 0).at(-1); if (prev && t < prev.t0 + 0.9) t = prev.t0 + 0.9;
      if (t > t1 - 0.9) return;
      labels.push({ asm: i, text: a.name, sub: a.note, t0: +t.toFixed(3), t1: +Math.min(t + M.leader.hold, t1 - 0.15).toFixed(3) });
    });
  }
  labels.sort((a, b) => a.t0 - b.t0);
  // camera: overview at the cut; a push-in on an explode or a callout (when the figure wants one); keys ≥ CAMERA.hold apart
  const cams: { t: number; focus: number }[] = [{ t: t0, focus: -1 }];
  if (out.view.push && asms.length) {
    const ev: { t: number; focus: number; w: number }[] = [];
    asms.forEach((a, i) => a.ex.forEach(([t]) => ev.push({ t: t - 0.25, focus: i, w: 3 })));
    for (const l of labels) if (l.asm >= 0) ev.push({ t: l.t0 - 0.3, focus: l.asm, w: 2 });
    ev.sort((a, b) => a.t - b.t || b.w - a.w);
    let pushes = 0;
    for (const e of ev) {
      const last = cams.at(-1)!;
      if (e.t - last.t < CAMERA.hold || e.t > t1 - 1.6 || pushes >= 2) continue;
      if (asms.some((a, i) => i !== e.focus && a.ex.some(([x0, x1]) => e.t + 0.2 < x1 + 0.6 && e.t + CAMERA.hold > x0))) continue; // never in on one part while another is open
      if (last.focus === e.focus) continue;
      cams.push({ t: +e.t.toFixed(3), focus: e.focus }); pushes++;
      const back = e.t + Math.min(2.6, CAMERA.hold + 0.8);
      if (back < t1 - 1.0) cams.push({ t: +back.toFixed(3), focus: -1 });
    }
    // back out before the figure lifts away
    const last = cams.at(-1)!; if (last.focus >= 0) { const tb = Math.max(last.t + CAMERA.hold, t1 - 1.1); if (tb < t1 - 0.4) cams.push({ t: +tb.toFixed(3), focus: -1 }); }
  }
  const view: View = { ...out.view };
  const sec: Sec = { i: si, setup, figure, variant: f.variant, title: `${FIGURE_TITLE[figure]}`, source: figure === 'composed' ? (sp.specSource ?? 'sketch') : 'library', text: sp.text, t0: +t0.toFixed(3), t1: +t1.toFixed(3), ground: out.ground, asms, links, props: out.props, lines: out.lines, tags: out.tags, labels, cams, view, detail: out.detail, ext: [] };
  sec.ext = extent(sec);
  void notes;
  return sec;
}
const wire = (A0: Asm, B0: Asm) => { const dx = B0.x - A0.x, dy = B0.y - A0.y, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, ra = Math.min(A0.fp.w, A0.fp.d) / 2 + 10, rb = Math.min(B0.fp.w, B0.fp.d) / 2 + 10; return [[A0.x + ux * ra, A0.y + uy * ra, A0.z + 8], [B0.x - ux * rb, B0.y - uy * rb, B0.z + 8]]; };

/** Everything a section can show, as 3D points (the overview fits these): grounds, parts at every key with explode room, props, links, notes. */
export function extent(S: Sec): number[][] {
  const pts: number[][] = [], G = S.ground;
  const rect = (cx: number, cy: number, w: number, d: number) => { for (const [x, y] of [[cx - w / 2, cy - d / 2], [cx + w / 2, cy - d / 2], [cx + w / 2, cy + d / 2], [cx - w / 2, cy + d / 2]]) pts.push([x!, y!, -TOKENS.LAYOUT.plateH], [x!, y!, 0]); };
  if (G.k === 'plate' || G.k === 'sheet') rect(G.cx ?? 0, G.cy ?? 0, G.w, G.d);
  else if (G.k === 'twin') for (const c of G.at ?? []) rect(c[0]!, c[1]!, G.w, G.d);
  else if (G.k === 'round') for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; pts.push([Math.cos(a) * (G.r ?? 200), Math.sin(a) * (G.r ?? 200), -30]); }
  for (const a of S.asms) for (const k of a.keys?.length ? a.keys : [[0, a.x, a.y, a.z]]) {
    const b = { ...a, keys: undefined, x: k[1]!, y: k[2]!, z: k[3]! };
    pts.push(...ISO.corners(ISO.boxOf(b)));
  }
  for (const p of S.props) { const g = p.grow ? p.p : p.p; for (const k of p.keys?.length ? p.keys : [[0, 0, 0, 0]]) pts.push(...ISO.primPts(g, [k[1]!, k[2]!, k[3]!])); }
  for (const l of S.links) pts.push(...l.route.map(q => [q[0]!, q[1]!, q[2] ?? 0]));
  for (const l of S.lines) { pts.push(...l.pts.map(q => [q[0]!, q[1]!, q[2] ?? 0])); if (l.off) pts.push(...l.pts.map(q => [q[0]! + l.off![0]! * 1.2, q[1]! + l.off![1]! * 1.2, (q[2] ?? 0) + l.off![2]! * 1.2])); }
  for (const t of S.tags) pts.push([t.at[0]!, t.at[1]!, (t.at[2] ?? 0) + 30]);
  for (const l of S.labels) if (l.at) pts.push(l.at);
  return pts;
}

/**
 * Frame-by-frame checks with the player's own code, every 0.1 s: in the overview every settled solid lies inside the
 * scene band; in a push-in the watched part does (the window fades anything else); callouts inside the safe area and
 * apart. A section that breaks a rule has its camera corrected (the overview fits tighter, a push-in is capped) and is
 * checked again.
 */
export function check(F: Film, notes: string[]) {
  const S = SAFE.scene, tol = 6;
  const over = (a: { x: number; y: number; w: number; h: number }, b: typeof a) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  const report: string[] = [];
  for (const sec of F.secs) {
    let fixes = 0, pass = 0, lastBad = '';
    for (; pass < 7; pass++) {
      let bad = '';
      for (let t = sec.t0 + 0.05; t < sec.t1 - ISO.EXIT && !bad; t += 0.1) {
        const fr = ISO.frame(F, t) as { P: object; focus: number; objs: { kind: string; i: number; items: { pr: object; o: number[]; settled: boolean }[] }[]; labels: { lb: Label; x: number; y: number; w: number; h: number }[] };
        let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
        for (const O of fr.objs) { if (fr.focus >= 0 && !(O.kind === 'asm' && O.i === fr.focus)) continue; for (const it of O.items) { if (!it.settled) continue; const b = ISO.bboxScreen(ISO.primPts(it.pr, it.o), fr.P); x0 = Math.min(x0, b[0]!); y0 = Math.min(y0, b[1]!); x1 = Math.max(x1, b[2]!); y1 = Math.max(y1, b[3]!); } }
        if (x1 > x0 && (x0 < S.x0 - tol || x1 > S.x1 + tol || y0 < S.y0 - tol || y1 > S.y1 + tol)) bad = `${fr.focus >= 0 ? 'push-in' : 'overview'} at ${t.toFixed(1)}s spans ${x0.toFixed(0)},${y0.toFixed(0)}–${x1.toFixed(0)},${y1.toFixed(0)}`;
        if (!bad && fr.focus < 0) { /* ok */ }
        if (bad) { if (fr.focus >= 0) sec.view.zcap = Math.max(1, (sec.view.zcap ?? CAMERA.focus.maxZoom) * 0.88); else sec.view.fit = (sec.view.fit ?? 1) * 0.92; break; }
        for (const l of fr.labels) {
          const out = l.x < SAFE.x0 || l.x + l.w > SAFE.x1 || l.y < SAFE.y0 || l.y + l.h > SAFE.y1;
          if (out && l.lb.sub) { l.lb.sub = ''; bad = 'label'; } else if (out && l.lb.text.includes(' ')) { l.lb.text = l.lb.text.split(' ')[0]!; bad = 'label'; }
          const hit = fr.labels.find(m => m !== l && over(m, l));
          if (hit) { const [a, b] = l.lb.t0 <= hit.lb.t0 ? [l.lb, hit.lb] : [hit.lb, l.lb]; if (a.t1 > b.t0 - 0.05) { a.t1 = Math.max(a.t0 + 0.6, b.t0 - 0.05); bad = 'label'; } }
        }
      }
      if (!bad) break;
      fixes++; lastBad = bad;
    }
    if (fixes) report.push(`fig ${sec.i + 1} (${sec.setup}): ${fixes} camera/callout fix(es)${pass >= 7 ? `, still: ${lastBad}` : ''}`);
  }
  if (report.length) notes.push(...report);
  if (!F.secs.length || !F.secs[0]!.asms.length || F.secs[0]!.asms[0]!.tIn > 0.5) notes.push('first figure lands late');
}

/** Style 1 SFX kit events: a hit to open and on each new figure, a whoosh as named parts land, a pop per callout, a key on each explode and flow. */
export function events(F: Film): Record<string, unknown>[] {
  const ev: Record<string, unknown>[] = [{ t: 0, event: 'hard-hit' }];
  for (const S of F.secs) {
    if (S.i > 0) ev.push({ t: +(S.t0 + 0.05).toFixed(3), event: 'hard-hit' });
    let n = 0;
    for (const a of S.asms) { if (a.src >= 0 && n++ < 4) ev.push({ t: +(a.tIn + 0.3).toFixed(3), event: 'scene' }); for (const [t] of a.ex) ev.push({ t: +(t + 0.05).toFixed(3), event: 'key-word' }); }
    for (const l of S.labels) ev.push({ t: +(l.t0 + 0.05).toFixed(3), event: 'paper-pop' });
    for (const l of S.links.slice(0, 2)) ev.push({ t: +l.tFlow.toFixed(3), event: 'stat' });
  }
  ev.push({ t: F.end.t0, event: 'card-in' });
  const out = ev.sort((a, b) => (a.t as number) - (b.t as number));
  return out.filter((e, i) => !i || (e.t as number) - (out[i - 1]!.t as number) > 0.08 || e.event !== out[i - 1]!.event);
}

/** One line per section for logs and the report: figure, parts, how it was cast. */
export const describe = (F: Film) => F.secs.map(s => `${s.i + 1}. ${s.setup} [${s.figure}/${s.variant}, ${s.source}] ${s.t0.toFixed(1)}-${s.t1.toFixed(1)}s: ${s.asms.filter(a => a.src >= 0).map(a => `${a.kind}:${a.name || '-'}`).join(' · ') || '(structure only)'}`);
export type { Setup };
