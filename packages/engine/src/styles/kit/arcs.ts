/**
 * Story arcs: the shapes a script can take. A template has ONE shape; a style has many and picks the one the
 * material wants (a site full of numbers gets a number story, a how-to site gets steps, a site with quotes gets
 * customer voices), away from the arcs its last films used. The arc becomes a line-by-line brief: each slot says
 * what the line does and how long it is, which any model can follow (a small one fills slots far better than it
 * invents a structure). The style adds only its voice (tone rules) on top.
 */
import { createHash } from 'node:crypto';
import type { Need } from './needs';

export interface Slot { /** what the line is (shown to the model) */ does: string; /** its words [min, max] */ words: [number, number]; /** what it needs on screen */ needs: Need[] }
export interface Arc { id: string; name: string; /** when it fits */ wants?: Partial<Record<keyof Signals, number>>; slots: Slot[] }
export interface Signals { numbers: number; steps: number; people: number; compare: number; quotes: number; physical: number; software: number; problem: number; history: number; places: number }

const S = (does: string, lo: number, hi: number, ...needs: Need[]): Slot => ({ does, words: [lo, hi], needs });

export const ARCS: Arc[] = [
  { id: 'pain-turn', name: 'Pain, then the turn', wants: { problem: 2 }, slots: [
    S('HOOK: a scroll-stopping reframe or sharp pain in the viewer\'s own words', 3, 8, 'hook', 'problem'),
    S('STAKES: make the pain concrete (what it costs them)', 5, 11, 'stakes', 'problem'),
    S('"Meet <Brand>." alone', 2, 4, 'brand', 'reveal'),
    S('PROOF 1: a benefit from the facts, short', 2, 6, 'benefit'),
    S('PROOF 2: another benefit, same rhythm', 2, 6, 'benefit'),
    S('PROOF 3: another benefit, same rhythm', 2, 6, 'benefit'),
    S('CLIMAX: a two-beat line that sums it up', 3, 7, 'payoff', 'claim'),
    S('CTA: the action and the site\'s domain', 3, 8, 'cta')] },
  { id: 'myth-truth', name: 'The myth, then the truth', wants: { problem: 1, compare: 1 }, slots: [
    S('HOOK: the common belief, stated plainly as if true', 4, 9, 'hook', 'claim'),
    S('the turn: it is wrong (short, flat)', 2, 6, 'contrast', 'warning'),
    S('the truth, from the facts', 6, 12, 'answer', 'idea'),
    S('why it is true (a "because" line)', 6, 12, 'reason'),
    S('what <Brand> does about it', 6, 12, 'brand', 'benefit'),
    S('PAYOFF: a short quotable line', 3, 7, 'payoff')] },
  { id: 'how-it-works', name: 'How it works, in steps', wants: { steps: 2, software: 1 }, slots: [
    S('HOOK: the result the viewer wants, in one breath', 4, 9, 'hook', 'benefit'),
    S('STEP 1: the first thing you do (start with a verb)', 3, 8, 'steps', 'build'),
    S('STEP 2: what happens next', 3, 8, 'steps', 'process'),
    S('STEP 3: the last step', 3, 8, 'steps', 'success'),
    S('the result, concrete', 5, 11, 'benefit', 'success'),
    S('PAYOFF: name <Brand> and the domain', 3, 8, 'cta', 'brand')] },
  { id: 'one-number', name: 'One number tells it', wants: { numbers: 3 }, slots: [
    S('HOOK: the most striking number from the facts, said plainly', 3, 9, 'hook', 'number'),
    S('what that number means for a person', 6, 12, 'stakes', 'people'),
    S('why it happens', 6, 12, 'reason', 'process'),
    S('how <Brand> changes it', 6, 12, 'brand', 'benefit'),
    S('a second true detail from the facts (another number if there is one)', 4, 10, 'proof', 'number'),
    S('PAYOFF: short and quotable', 3, 7, 'payoff')] },
  { id: 'before-after', name: 'Before and after', wants: { problem: 1, compare: 1 }, slots: [
    S('HOOK: "Before <Brand>," plus the old way in a picture', 4, 9, 'hook', 'before-after'),
    S('the friction of the old way, concrete', 5, 11, 'problem', 'chaos'),
    S('"Now:" the new way, concrete', 4, 10, 'before-after', 'calm'),
    S('a second change, concrete', 4, 10, 'benefit'),
    S('a third change, concrete', 4, 10, 'benefit'),
    S('PAYOFF: the difference in two beats', 3, 8, 'payoff', 'contrast')] },
  { id: 'question-answer', name: 'A question, answered', wants: { problem: 1 }, slots: [
    S('HOOK: a sharp question the viewer has asked themselves', 4, 10, 'hook', 'question'),
    S('why it is hard to answer today', 6, 12, 'problem'),
    S('the answer: <Brand>', 2, 6, 'answer', 'brand'),
    S('what it does, concretely', 6, 12, 'process', 'benefit'),
    S('a proof from the facts', 5, 11, 'proof'),
    S('PAYOFF + domain', 3, 8, 'payoff', 'cta')] },
  { id: 'three-things', name: 'Three things that matter', wants: { software: 1, physical: 1 }, slots: [
    S('HOOK: "<N> things" framed as what makes the difference', 4, 9, 'hook', 'list'),
    S('THING 1: a noun phrase and why it matters', 4, 10, 'list', 'benefit'),
    S('THING 2: same rhythm', 4, 10, 'list', 'benefit'),
    S('THING 3: same rhythm', 4, 10, 'list', 'benefit'),
    S('what they add up to', 5, 10, 'success', 'claim'),
    S('PAYOFF + <Brand>', 3, 8, 'payoff', 'brand')] },
  { id: 'day-in-life', name: 'A day in the life', wants: { people: 2 }, slots: [
    S('HOOK: a specific moment in the customer\'s day (time or place)', 4, 10, 'hook', 'time'),
    S('the friction in that moment', 5, 11, 'problem'),
    S('the moment <Brand> steps in', 5, 10, 'brand', 'reveal'),
    S('what changes, concretely', 5, 11, 'benefit'),
    S('how the day ends now', 5, 11, 'success', 'calm'),
    S('PAYOFF', 3, 7, 'payoff')] },
  { id: 'contrarian', name: 'Stop doing this', wants: { problem: 2 }, slots: [
    S('HOOK: "Stop <common practice>."', 3, 7, 'hook', 'warning'),
    S('why it fails, concrete', 6, 12, 'reason', 'problem'),
    S('what works instead', 5, 11, 'answer', 'idea'),
    S('how <Brand> does that', 6, 12, 'brand', 'process'),
    S('a proof from the facts', 5, 11, 'proof'),
    S('PAYOFF', 3, 7, 'payoff')] },
  { id: 'origin', name: 'Where it began', wants: { history: 2 }, slots: [
    S('HOOK: the moment it started (who saw what)', 5, 11, 'hook', 'timeline'),
    S('the problem they could not ignore', 5, 11, 'problem'),
    S('what they built', 5, 10, 'build', 'reveal'),
    S('who uses it now / what it became', 5, 11, 'people', 'growth'),
    S('PAYOFF + <Brand>', 3, 8, 'payoff', 'brand')] },
  { id: 'inside-machine', name: 'Inside the machine', wants: { physical: 2, software: 1 }, slots: [
    S('HOOK: what it does, in one breath', 4, 9, 'hook', 'product'),
    S('PART 1: the first component and its job', 5, 11, 'process', 'layers'),
    S('PART 2: the next component and its job', 5, 11, 'process', 'flow'),
    S('PART 3: the last component and its job', 5, 11, 'process', 'connect'),
    S('what they do together', 5, 10, 'success', 'network'),
    S('PAYOFF + <Brand>', 3, 8, 'payoff', 'brand')] },
  { id: 'versus', name: 'Old way versus new', wants: { compare: 2 }, slots: [
    S('HOOK: the old way named plainly', 3, 8, 'hook', 'compare'),
    S('old way vs <Brand>, on time or speed', 5, 11, 'compare', 'speed'),
    S('old way vs <Brand>, on effort or cost', 5, 11, 'compare', 'money'),
    S('old way vs <Brand>, on the result', 5, 11, 'compare', 'success'),
    S('PAYOFF: the choice is obvious', 3, 8, 'payoff', 'choice')] },
  { id: 'customer-voice', name: 'In their words', wants: { quotes: 2, people: 1 }, slots: [
    S('HOOK: who the customers are', 4, 9, 'hook', 'people'),
    S('what they say, quoted or closely paraphrased from the facts ONLY', 5, 12, 'quote', 'voices'),
    S('what it means', 5, 10, 'idea'),
    S('another true detail from the facts', 5, 11, 'proof'),
    S('PAYOFF + <Brand>', 3, 8, 'payoff', 'brand')] },
  { id: 'fable', name: 'A short fable', wants: { problem: 1 }, slots: [
    S('HOOK: "Once," a scene with one concrete object', 4, 10, 'hook', 'emotion'),
    S('the trouble in that world', 5, 11, 'problem', 'chaos'),
    S('the arrival of something new (<Brand>)', 5, 10, 'reveal', 'brand'),
    S('how the world changed, concrete', 5, 11, 'before-after', 'calm'),
    S('a second change, concrete', 5, 11, 'benefit'),
    S('the moral, quotable', 3, 8, 'payoff')] },
  { id: 'stakes-ladder', name: 'The cost climbs', wants: { problem: 2, numbers: 1 }, slots: [
    S('HOOK: a small everyday cost', 4, 9, 'hook', 'stakes'),
    S('a bigger cost it causes', 4, 10, 'stakes', 'growth'),
    S('the biggest cost', 4, 10, 'stakes', 'warning'),
    S('the fix: <Brand>', 3, 8, 'answer', 'brand'),
    S('what you get back', 5, 10, 'benefit'),
    S('PAYOFF', 3, 7, 'payoff')] },
  { id: 'zoom-out', name: 'Zoom out', wants: { places: 1, people: 1 }, slots: [
    S('HOOK: one tiny concrete detail', 3, 8, 'hook', 'focus'),
    S('zoom out: the thing around it', 5, 10, 'scale', 'layers'),
    S('zoom out again: the people or place', 5, 10, 'scale', 'people'),
    S('the whole picture: what <Brand> connects', 6, 12, 'network', 'brand'),
    S('PAYOFF', 3, 7, 'payoff')] },
  { id: 'checklist', name: 'The quick check', wants: { software: 1, steps: 1 }, slots: [
    S('HOOK: "If you <situation>, check this."', 4, 10, 'hook', 'question'),
    S('CHECK 1: a yes/no the viewer can answer', 4, 9, 'list', 'focus'),
    S('CHECK 2', 4, 9, 'list', 'focus'),
    S('CHECK 3', 4, 9, 'list', 'focus'),
    S('if not: <Brand> does it', 4, 10, 'answer', 'brand'),
    S('PAYOFF + domain', 3, 8, 'cta')] },
];
export const arcOf = (id: string) => ARCS.find(a => a.id === id);

/** What a site offers (counts of each signal in its text). */
export function signals(text: string): Signals {
  const n = (re: RegExp) => (text.match(re) ?? []).length;
  return {
    numbers: n(/\b\d[\d,.]*\s*(%|x|×|k|m|million|billion|hours?|minutes?|days?|customers|users|countries)?/gi) > 4 ? 3 : n(/\d/g) > 6 ? 1 : 0,
    steps: Math.min(3, n(/\b(step \d|first,|then,|next,|how it works|get started in)\b/gi)),
    people: Math.min(3, n(/\b(customers?|teams?|people|users|founders|creators|families|students)\b/gi) / 3),
    compare: Math.min(3, n(/\b(vs\.?|versus|unlike|instead of|compared|than)\b/gi)),
    quotes: Math.min(3, n(/[“"][^”"]{20,160}[”"]|\btestimonial|\bsays\b|\breview/gi)),
    physical: Math.min(3, n(/\b(made of|material|battery|motor|ingredients?|fabric|steel|wood|bottle|device|hardware|weight|dimensions)\b/gi)),
    software: Math.min(3, n(/\b(app|platform|api|dashboard|integrat\w*|cloud|deploy|software|ai|automat\w*)\b/gi) / 2),
    problem: Math.min(3, n(/\b(problem|pain|struggle|waste|hard|slow|manual|tired|stop|without)\b/gi) / 2),
    history: Math.min(3, n(/\b(founded|since \d{4}|story|began|started|our mission|years ago)\b/gi)),
    places: Math.min(3, n(/\b(city|cities|countries|worldwide|global|stores?|locations?)\b/gi)),
  };
}

/**
 * Pick the arc: fit to the site's signals + a per-film jitter − arcs this style used lately. Only arcs the style
 * allows. Deterministic for one seed; different films of one site land on different arcs.
 */
export function chooseArc(allowed: string[], sig: Signals, recent: string[], seed: string): Arc {
  const pool = ARCS.filter(a => allowed.includes(a.id));
  if (!pool.length) throw new Error('chooseArc: the style allows no known arc');
  const jitter = (id: string) => createHash('sha1').update(`${seed}:${id}`).digest().readUInt32BE(0) / 2 ** 32;
  const score = (a: Arc) => {
    let s = 1;
    for (const [k, w] of Object.entries(a.wants ?? {})) s += Math.min(sig[k as keyof Signals], 3) * (w as number) * 0.6;
    const r = recent.indexOf(a.id); if (r >= 0) s -= [9, 6, 4, 2][r] ?? 1; // the last film's arc never comes straight back
    return s + jitter(a.id) * 2.2;
  };
  return pool.reduce((m, a) => (score(a) > score(m) ? a : m), pool[0]!);
}

/** The arc as a line-by-line brief any model can fill. */
export function arcBrief(arc: Arc, brand: string): string {
  return `Write exactly ${arc.slots.length} lines, one per slot, in this order (each line is one spoken sentence):\n${arc.slots
    .map((s, i) => `${i + 1}. ${s.does.replace(/<Brand>/g, brand)} (${s.words[0]}-${s.words[1]} words)`).join('\n')}`;
}

/** Arc words range (sum of slots), for the script doctor. */
export const arcWords = (arc: Arc): [number, number] => [arc.slots.reduce((a, s) => a + s.words[0], 0), arc.slots.reduce((a, s) => a + s.words[1], 0)];
