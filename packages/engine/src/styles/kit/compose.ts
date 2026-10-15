/**
 * Improvising: a set-up the library does not have yet, made in the style's own grammar. The model never gives
 * coordinates or colours (weak models are bad at both, and the style's laws own them): it picks a LAYOUT and up to
 * six ELEMENTS from the style's vocabulary (enums), each landing on a spoken word. The style's composer lays them out
 * and draws them in its world, so an improvised set-up obeys the same laws as a hand-made one. When the model fails
 * (or there is none), `sketch` composes one deterministically from the line's needs and words. A kept improvisation
 * joins the library (./library.ts grow), so the next film can cast it like any other set-up.
 */
import { z } from 'zod';
import { ask } from '../../runtime';
import { within } from '../common';
import { NEEDS, isNeed, listItems, spokenNumber, type Need } from './needs';

export interface Vocab {
  /** how elements are arranged (the composer knows each one) */
  layouts: readonly string[];
  /** what an element can be: e.g. word, line, number, icon, shape, label, arrow, bar, ring, picture, part */
  kinds: readonly string[];
  /** shapes the composer draws */
  shapes: readonly string[];
  /** entrances / behaviours the style allows */
  motions: readonly string[];
  /** the style's tone tokens (never raw colours) */
  tones: readonly string[];
  /** the style's icon / part names */
  icons: readonly string[];
  /** one line per layout for the model (optional) */
  about?: Record<string, string>;
}
export interface El { kind: string; text?: string; icon?: string; shape?: string; value?: number; word: number; size: 's' | 'm' | 'l' | 'xl'; tone: string; motion: string }
export interface Spec { layout: string; about: string; needs: Need[]; elements: El[] }
export interface BeatWords { text: string; words: { word: string; t: number; end: number }[]; needs: Need[] }

const TEXTY = new Set(['word', 'line', 'label', 'caption', 'title']);

/** Icon by meaning: a keyword → the names a style's icon set usually has (first one that exists wins). */
const ICON_WORDS: [RegExp, string[]][] = [
  [/people|customer|user|team|everyone|crowd|community|audience/i, ['people', 'crowd', 'users', 'user']],
  [/\b(you|person|founder|creator|he|she|me)\b/i, ['user', 'person', 'pawn']],
  [/time|hour|minute|second|day|week|clock|wait|late|deadline/i, ['clock', 'dial', 'timer']],
  [/fast|speed|instant|quick|rapid/i, ['bolt', 'rocket', 'zap']],
  [/grow|rise|more|scale|increase|up\b|double/i, ['chart', 'growth', 'trend']],
  [/money|price|cost|pay|budget|revenue|sale|cheap|free|bill/i, ['coin', 'money', 'wallet', 'card']],
  [/secure|safe|privacy|protect|lock|trust/i, ['lock', 'shield']],
  [/world|global|everywhere|countr|planet|edge/i, ['globe', 'world']],
  [/data|database|record|storage|memory/i, ['database', 'data', 'stack']],
  [/ai\b|model|agent|automat|smart|brain/i, ['spark', 'chip', 'brain', 'ai']],
  [/message|chat|feedback|review|comment|email|inbox|notification/i, ['chat', 'message', 'mail', 'bell']],
  [/app|phone|mobile/i, ['phone', 'mobile']],
  [/site|web|page|browser|dashboard|screen/i, ['browser', 'screen', 'laptop']],
  [/code|developer|deploy|build|ship|git/i, ['code', 'laptop', 'server', 'rocket']],
  [/connect|integrat|link|join|together|sync/i, ['link', 'hub', 'plug']],
  [/goal|target|focus|aim/i, ['target', 'eye']],
  [/see|look|watch|visible|insight/i, ['eye', 'search']],
  [/idea|think|insight|imagine/i, ['bulb', 'spark', 'idea']],
  [/done|success|win|check|ready|works/i, ['check', 'star', 'trophy']],
  [/problem|error|wrong|mistake|danger|risk|broken/i, ['alert', 'warning', 'x']],
  [/home|house|room/i, ['home', 'house']],
  [/heart|love|care|health/i, ['heart']],
  [/package|deliver|ship|order|box/i, ['package', 'box', 'truck']],
  [/learn|study|course|book|read/i, ['book', 'cap']],
  [/search|find|discover/i, ['search', 'eye']],
];
export function iconFor(text: string, icons: readonly string[], avoid: string[] = []): string {
  for (const [re, names] of ICON_WORDS) if (re.test(text)) { const hit = names.find(n => icons.includes(n) && !avoid.includes(n)); if (hit) return hit; }
  return icons.find(n => !avoid.includes(n)) ?? icons[0] ?? '';
}

const STOP = new Set('the a an and or but of to in on for with is are was were be been it its this that these those your you our we they their at by from as so if then than very just only also not no can will has have had do does did into over about more most'.split(' '));
/** The beat's key words (content words, longest first), as spoken. */
export function keyWords(ws: BeatWords['words'], n = 2): { word: string; index: number }[] {
  return ws.map((w, index) => ({ word: w.word.replace(/[’']s\b/g, '').replace(/[^\p{L}\p{N}'%$€£₹.-]/gu, '').replace(/\.$/, ''), index }))
    .filter(x => x.word.length > 2 && !STOP.has(x.word.toLowerCase())).sort((a, b) => b.word.length - a.word.length).slice(0, n).sort((a, b) => a.index - b.index);
}

/** A set-up composed with no model: the layout from the line's needs, elements from its own words and meaning. */
export function sketch(b: BeatWords, v: Vocab): Spec {
  const pick = <T extends string>(want: string[], from: readonly T[]) => (want.find(w => from.includes(w as T)) ?? from[0]) as T;
  const has = (n: Need) => b.needs.includes(n);
  const items = listItems(b.text), num = spokenNumber(b.text), keys = keyWords(b.words, 2);
  const tone = (i: number) => v.tones[i % Math.max(1, v.tones.length)] ?? 'ink';
  const motion = (i: number) => v.motions[i % Math.max(1, v.motions.length)] ?? 'pop';
  const els: El[] = [];
  let layout: string;
  if (items.length >= 2) {
    layout = pick(['stack', 'grid', 'row', 'orbit'], v.layouts);
    const lower = b.words.map(w => w.word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, ''));
    items.slice(0, 5).forEach((it, i) => {
      const first = it.toLowerCase().split(/\s+/)[0]!.replace(/[^\p{L}\p{N}]/gu, ''); const word = Math.max(0, lower.indexOf(first));
      els.push({ kind: pick(['icon', 'shape'], v.kinds), icon: iconFor(it, v.icons, els.map(e => e.icon ?? '')), shape: v.shapes[0], word, size: 'm', tone: tone(i), motion: motion(0) });
      els.push({ kind: pick(['label', 'word', 'line'], v.kinds), text: it, word, size: 's', tone: 'ink', motion: motion(1) });
    });
  } else if (num != null && (v.kinds.includes('number'))) {
    layout = pick(['center', 'hero', 'stack'], v.layouts);
    const word = Math.max(0, b.words.findIndex(w => /\d/.test(w.word)));
    els.push({ kind: 'number', value: num, text: b.words[word]?.word.replace(/[^\d.,%$€£₹kKmMxX]/g, ''), word, size: 'xl', tone: tone(0), motion: pick(['count', 'grow', 'pop'], v.motions) });
    els.push({ kind: pick(['icon', 'shape'], v.kinds), icon: iconFor(b.text, v.icons), shape: pick(['ring', 'circle'], v.shapes), word: 0, size: 'l', tone: tone(1), motion: motion(0) });
  } else if (has('compare') || has('before-after') || has('contrast')) {
    layout = pick(['split', 'left-right', 'versus', 'stack'], v.layouts);
    const half = Math.floor(b.words.length / 2);
    els.push({ kind: pick(['icon', 'shape'], v.kinds), icon: iconFor(b.words.slice(0, half).map(w => w.word).join(' '), v.icons), shape: v.shapes[0], word: 0, size: 'l', tone: pick(['muted', 'ink'], v.tones), motion: motion(0) });
    els.push({ kind: pick(['icon', 'shape'], v.kinds), icon: iconFor(b.words.slice(half).map(w => w.word).join(' '), v.icons, [els[0]!.icon ?? '']), shape: v.shapes[1] ?? v.shapes[0], word: half, size: 'l', tone: tone(0), motion: motion(1) });
    if (v.kinds.includes('arrow')) els.push({ kind: 'arrow', word: half, size: 'm', tone: 'ink', motion: pick(['draw', 'slide'], v.motions) });
  } else if (has('flow') || has('process') || has('steps') || has('connect') || has('network')) {
    layout = pick(['path', 'chain', 'flow', 'orbit', 'row'], v.layouts);
    const ks = keyWords(b.words, 3);
    ks.forEach((k, i) => els.push({ kind: pick(['icon', 'shape', 'part'], v.kinds), icon: iconFor(k.word, v.icons, els.map(e => e.icon ?? '')), shape: v.shapes[i % v.shapes.length], word: k.index, size: 'm', tone: tone(i), motion: motion(i) }));
    if (v.kinds.includes('arrow')) els.push({ kind: 'arrow', word: ks[1]?.index ?? 0, size: 'm', tone: 'ink', motion: pick(['draw'], v.motions) });
  } else {
    layout = pick(['hero', 'center', 'stack'], v.layouts);
    els.push({ kind: pick(['icon', 'picture', 'part', 'shape'], v.kinds), icon: iconFor(b.text, v.icons), shape: v.shapes[0], word: 0, size: 'xl', tone: tone(0), motion: motion(0) });
  }
  // the line's key word(s) as type, on their own spoken word
  for (const k of keys) if (els.filter(e => TEXTY.has(e.kind)).length < 3 && !els.some(e => e.text?.toLowerCase() === k.word.toLowerCase())) els.push({ kind: pick(['word', 'line', 'label'], v.kinds), text: k.word, word: k.index, size: 'l', tone: 'ink', motion: pick(['rise', 'type', 'pop'], v.motions) });
  return { layout, about: `sketch: ${b.text.slice(0, 60)}`, needs: b.needs.slice(0, 4), elements: els.slice(0, 8) };
}

/** Make a spec obey the vocabulary and the beat (unknown enums → nearest allowed, texts from the spoken words). */
export function tidy(spec: Partial<Spec>, b: BeatWords, v: Vocab): Spec | null {
  const near = (x: unknown, from: readonly string[], d: string) => { const s = String(x ?? '').toLowerCase().trim(); return from.find(f => f === s) ?? from.find(f => f.startsWith(s) || s.startsWith(f)) ?? from.find(f => s.includes(f) || f.includes(s)) ?? d; };
  const said = b.words.map(w => w.word.toLowerCase().replace(/[^\p{L}\p{N}%]/gu, ''));
  const els = (spec.elements ?? []).slice(0, 8).map(e => {
    const kind = near(e.kind, v.kinds, v.kinds[0]!);
    let text = typeof e.text === 'string' ? e.text.trim().slice(0, 40) : undefined;
    // on-screen words are SPOKEN words (a label may paraphrase, but stays short)
    if (text && (kind === 'word' || kind === 'line')) { const keep = text.split(/\s+/).filter(t => said.includes(t.toLowerCase().replace(/[^\p{L}\p{N}%]/gu, ''))); text = keep.join(' ') || undefined; }
    if (text && kind === 'label') text = text.split(/\s+/).slice(0, 4).join(' ');
    const value = typeof e.value === 'number' && Number.isFinite(e.value) ? e.value : undefined;
    return {
      kind, text, value, word: Math.max(0, Math.min(b.words.length - 1, Math.round(Number(e.word) || 0))),
      icon: e.icon != null ? near(e.icon, v.icons, iconFor(b.text, v.icons)) : (kind === 'icon' ? iconFor(b.text, v.icons) : undefined),
      shape: e.shape != null ? near(e.shape, v.shapes, v.shapes[0]!) : undefined,
      size: (['s', 'm', 'l', 'xl'].includes(String(e.size)) ? e.size : 'm') as El['size'],
      tone: near(e.tone, v.tones, v.tones[0]!), motion: near(e.motion, v.motions, v.motions[0]!),
    } as El;
  }).filter(e => !(TEXTY.has(e.kind) && !e.text) && !(e.kind === 'number' && e.value == null && !e.text));
  // a number on screen must be spoken
  for (const e of els) if (e.kind === 'number') { const n = spokenNumber(b.text); if (n == null) e.kind = v.kinds.includes('icon') ? 'icon' : v.kinds[0]!; else e.value = n; }
  if (els.length < 2 || els.every(e => TEXTY.has(e.kind))) return null;
  return { layout: near(spec.layout, v.layouts, v.layouts[0]!), about: String(spec.about ?? '').slice(0, 80) || b.text.slice(0, 60), needs: (spec.needs ?? b.needs).filter(isNeed).slice(0, 4) as Need[], elements: els };
}

/**
 * Improvise one set-up: one short model call with enum choices (any model can pick from lists), tidied to the
 * vocabulary; a deterministic sketch if the call fails, is late, or comes back unusable. Never throws.
 */
export async function improvise(o: { style: string; vocab: Vocab; beat: BeatWords; context?: string; signal?: AbortSignal; ms?: number; log?: (s: string) => void }): Promise<{ spec: Spec; source: 'model' | 'sketch' }> {
  const v = o.vocab, b = o.beat;
  const E = <T extends readonly string[]>(a: T) => z.enum(a as unknown as [string, ...string[]]);
  const schema = {
    layout: E(v.layouts).describe(v.about ? Object.entries(v.about).map(([k, d]) => `${k}: ${d}`).join('; ') : 'how the elements are arranged'),
    about: z.string().describe('one line: what this set-up pictures'),
    needs: z.array(E(NEEDS)).describe('1-3 needs it serves'),
    elements: z.array(z.object({
      kind: E(v.kinds), text: z.string().optional().describe('only for text kinds: words from the line'), icon: E(v.icons).optional(), shape: E(v.shapes).optional(),
      value: z.number().optional().describe('only for a spoken number'), word: z.number().int().describe('index of the spoken word where it appears'),
      size: z.enum(['s', 'm', 'l', 'xl']), tone: E(v.tones), motion: E(v.motions),
    })).min(2).max(6),
  };
  try {
    const r = await within(o.ms ?? 30_000, o.signal, signal => ask({
      agent: `${o.style}-improvise`, tier: 'fast', deadlineMs: o.ms ?? 30_000, maxTurns: 3, quick: true, signal,
      system: `You design ONE new scene for a vertical video in a fixed visual style. Pick a layout and 2-6 elements from the given lists only; the style draws them. Show what the line MEANS (an icon or shape for its idea, a number only if spoken, 1-2 key words as type). Elements land on the spoken word where their idea is said.${o.context ? ` ${o.context}` : ''}`,
      prompt: `Line: "${b.text}"\nSpoken words (index:word): ${b.words.map((w, i) => `${i}:${w.word}`).join(' ')}\nNeeds: ${b.needs.join(', ') || '(none detected)'}\nDesign the scene.`,
      schema,
    }));
    const spec = tidy(r as Partial<Spec>, b, v);
    if (spec) return { spec, source: 'model' };
    o.log?.(`improvise: unusable answer for "${b.text.slice(0, 40)}"; sketching`);
  } catch (e) { if (o.signal?.aborted) throw e; o.log?.(`improvise failed (${String(e instanceof Error ? e.message : e).slice(0, 80)}); sketching`); }
  return { spec: sketch(b, v), source: 'sketch' };
}
