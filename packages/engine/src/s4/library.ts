/**
 * Editorial (Style 4) as a STYLE, not a template. The ten laws (packages/library/src/style-4/GRAMMAR.md) never
 * change: one hue world, one sentence → one picture made of its nouns, the voice typeset over it (KEY caps,
 * connectors italic), one coined term, grounded / lit / alive pictures, something new every second. What changes is
 * the COMPOSITION around each picture: every beat is cast from this library by what its line needs (kit/library.ts
 * cast), and a beat nothing serves is improvised in the same grammar (kit/compose.ts, drawn by the player's composer).
 *
 * Each set-up here has a renderer of the same id in ./client.js (the player). `pics` says how many pictures the
 * set-up asks the picture planner for (0 = pure type, 2 = a pair); `note` tells the planner how to frame them; `echo`
 * set-ups also show earlier pictures of the film (a wall, a strip, a stack), so they cost no extra drawing.
 */
import { createHash } from 'node:crypto';
import type { Arc, BeatIn, Need, Role, Setup, Slot, Spec, Vocab } from '../styles/kit';
import { isNeed, keyWords, listItems, mergeNeeds, spokenNumber } from '../styles/kit';
import type { Piece } from './compose';

export type Enter = 'push' | 'turn' | 'drop' | 'fly';
export interface S4Setup extends Setup {
  /** pictures the planner draws for it: 0 (type only), 1, or 2 (a pair) */
  pics?: 0 | 1 | 2;
  /** how the planner frames its picture(s): one note per picture */
  note?: string[];
  /** the entrance it wants (else the film's rotation) */
  enter?: Enter;
  /** it also shows earlier pictures of the film */
  echo?: boolean;
}

const P2 = (a: string, b: string) => [a, b];
const ANY: Role[] = ['open', 'middle', 'close'];

/** The composition library: 49 set-ups in 42 families. */
export const LIBRARY: S4Setup[] = [
  // ── one picture, the voice above and below it (the essay's base grammar, now in several framings) ──
  { id: 'hero-stack', name: 'hero, lockups above and below', about: 'one big object, clause 1 above it, clause 2 below', needs: ['claim', 'idea', 'product', 'benefit', 'reason'], family: 'hero', pics: 1, weight: 0.92 },
  { id: 'hero-low', name: 'headline over a low object', about: 'a big headline at the top, the object low on the lit floor', needs: ['hook', 'claim', 'stakes', 'emotion', 'problem'], family: 'hero', pics: 1, roles: ['open', 'middle'] },
  { id: 'hero-side', name: 'object left, words right', about: 'the object leans in from the left edge, the lockup hangs in the right column', needs: ['reason', 'process', 'benefit', 'tool', 'build'], family: 'side', pics: 1, words: [3, 14] },
  { id: 'hero-side-r', name: 'object right, words left', about: 'the object leans in from the right edge, the lockup hangs in the left column', needs: ['answer', 'idea', 'product', 'benefit', 'success'], family: 'side', pics: 1, words: [3, 14] },
  { id: 'turntable', name: 'object on a turning plinth', about: 'the object stands on a museum plinth and turns slowly to show itself', needs: ['product', 'build', 'tool', 'proof'], family: 'plinth', pics: 1, enter: 'turn' },
  { id: 'drop-floor', name: 'object drops onto its shadow', about: 'the object falls into its own waiting shadow, the words below', needs: ['stakes', 'warning', 'decline', 'problem', 'chaos'], family: 'fall', pics: 1, enter: 'drop' },
  { id: 'cover-word', name: 'magazine cover word', about: 'the key word huge behind, the object standing in front of it like a magazine cover', needs: ['brand', 'reveal', 'hook', 'claim', 'payoff'], family: 'cover', pics: 1 },
  { id: 'coined-hero', name: 'coined-term hero', about: 'the coined term on its single clear object, centred, the orbit riding it', needs: ['idea', 'reveal', 'focus', 'claim'], family: 'coined', pics: 1, weight: 1.05 },
  { id: 'coined-plate', name: 'coined-term plaque', about: 'the object on show, the coined term engraved on a museum plaque beneath it', needs: ['idea', 'reveal', 'focus', 'claim'], family: 'coined', pics: 1 },
  { id: 'coined-margin', name: 'coined term in the margin', about: 'the object, a pen bracket in the margin and the coined term written beside it', needs: ['idea', 'reveal', 'focus', 'claim'], family: 'coined', pics: 1 },
  { id: 'footnote', name: 'footnote', about: 'the claim big with an asterisk; its reason set small as a footnote at the foot of the frame', needs: ['reason', 'proof', 'claim', 'hidden'], family: 'footnote', pics: 1, words: [6, 16] },
  // ── two pictures ──
  { id: 'diptych', name: 'diptych', about: 'two objects side by side on one floor, a hairline between them', needs: ['compare', 'contrast', 'choice', 'before-after'], family: 'pair', pics: 2, note: P2('the FIRST of two pictures side by side: the first / old / one thing the sentence names', 'the SECOND of two pictures side by side: the other / new thing the sentence names') },
  { id: 'pair-stacked', name: 'then, diagonal pair', about: 'one object high on the left, the next low on the right, clause beside each', needs: ['steps', 'flow', 'process', 'before-after', 'time'], family: 'pair', pics: 2, note: P2('the FIRST of two pictures (what comes first)', 'the SECOND of two pictures (what comes after)') },
  { id: 'binary', name: 'binary halves', about: 'two tonal panels, dark and light, an object on each: one or the other', needs: ['choice', 'contrast', 'compare', 'warning'], family: 'binary', pics: 2, note: P2('the FIRST of two options the sentence weighs (the wrong / old one)', 'the SECOND option (the right / new one)') },
  { id: 'before-after', name: 'before / after, torn', about: 'the old way faded above a torn edge, the new way lit below', needs: ['before-after', 'contrast', 'calm', 'chaos', 'problem'], family: 'change', pics: 2, note: P2('BEFORE: the old, worn or troubled thing of the sentence', 'AFTER: the same kind of thing made new or right') },
  { id: 'scale-shift', name: 'scale shift', about: 'a tiny object standing on a giant one that runs off the frame', needs: ['scale', 'contrast', 'focus', 'people', 'growth'], family: 'scale', pics: 2, note: P2('the GIANT thing of the sentence (shown huge, cropped by the frame)', 'the TINY thing of the sentence (a small figure or object standing on the giant one)') },
  { id: 'arrow-flow', name: 'A to B, drawn arrow', about: 'one object, a hand-drawn arrow, the object it becomes', needs: ['flow', 'connect', 'process', 'steps', 'growth'], family: 'flow', pics: 2, note: P2('the START of the change (what goes in)', 'the RESULT of the change (what comes out)') },
  // ── collections (the film's earlier pictures come back) ──
  { id: 'taped-wall', name: 'taped collection wall', about: 'cards taped to a wall, each item on its own card with a typed caption', needs: ['list', 'voices', 'people', 'proof', 'choice'], family: 'wall', pics: 1, items: [2, 5], seconds: [1.8, 8], echo: true, note: ['a collection: 6-12 small items of the sentence'] },
  { id: 'timeline-strip', name: 'timeline strip', about: 'a strip of small prints along a ruled line with tick marks, the newest one large', needs: ['timeline', 'time', 'steps', 'growth', 'cycle'], family: 'strip', pics: 1, seconds: [1.6, 8], echo: true, roles: ['middle', 'close'] },
  { id: 'polaroid-stack', name: 'polaroid stack', about: 'instant prints drop onto a pile, the last one is this line', needs: ['proof', 'people', 'emotion', 'voices', 'quote'], family: 'polaroid', pics: 1, echo: true, roles: ['middle', 'close'] },
  { id: 'flipbook', name: 'flipbook', about: 'pages flip fast through the film so far and stop on this line', needs: ['cycle', 'time', 'speed', 'process', 'growth'], family: 'flip', pics: 1, seconds: [1.6, 7], echo: true, roles: ['middle', 'close'] },
  { id: 'pile', name: 'stacked pile', about: 'copies of the object drop one by one into a growing pile', needs: ['chaos', 'layers', 'scale', 'growth', 'voices'], family: 'pile', pics: 1, enter: 'drop', note: ['one small object that reads when repeated in a pile'] },
  { id: 'chart-objects', name: 'chart made of objects', about: 'bars built from stacked copies of the object, the number on the tallest', needs: ['growth', 'decline', 'data', 'ranking', 'number', 'percent'], family: 'chart', pics: 1, number: 'optional', seconds: [1.6, 8], note: ['one small object that reads when stacked into chart bars'] },
  { id: 'spotlight-one', name: 'spotlight on one of many', about: 'a row of dark silhouettes, one lit in a beam', needs: ['focus', 'choice', 'ranking', 'people', 'hidden'], family: 'spot', pics: 1, note: ['one object with a clear silhouette (it stands in a row of copies)'] },
  // ── devices on one picture ──
  { id: 'orbit', name: 'orbit', about: 'two tilted dashed orbits around the object, an earlier picture riding one', needs: ['cycle', 'time', 'network', 'connect', 'global'], family: 'orbit', pics: 1, echo: true },
  { id: 'arrow-point', name: 'arrow device', about: 'a hand-drawn arrow curls in and points at the object, the key word at its tail', needs: ['focus', 'answer', 'reveal', 'proof', 'idea'], family: 'mark', pics: 1 },
  { id: 'circled', name: 'circled detail', about: 'a hand-drawn ring circles a detail of the object, a leader line to the key word', needs: ['focus', 'hidden', 'proof', 'problem', 'warning'], family: 'mark', pics: 1 },
  { id: 'beam', name: 'light beam', about: 'a cone of light falls on the object from above, the words below', needs: ['reveal', 'idea', 'answer', 'emotion', 'brand'], family: 'light', pics: 1 },
  { id: 'magnifier', name: 'under the magnifier', about: 'a magnifying lens drifts over the object and enlarges a detail', needs: ['hidden', 'focus', 'data', 'learn', 'proof'], family: 'lens', pics: 1, note: ['one object with fine detail worth enlarging'] },
  { id: 'ruler', name: 'measured', about: 'dimension lines and a ruler measure the object, the number or key word on the line', needs: ['scale', 'number', 'time', 'speed', 'money'], family: 'measure', pics: 1, number: 'optional' },
  { id: 'shadow-only', name: 'shadow only', about: 'only the object\'s ink silhouette and its long cast shadow', needs: ['hidden', 'warning', 'problem', 'stakes', 'emotion'], family: 'shadow', pics: 1, note: ['one object with a strong, instantly recognisable silhouette'] },
  { id: 'macro-crop', name: 'macro crop', about: 'the object so close it fills the frame, the words on a paper band across it', needs: ['focus', 'emotion', 'product', 'hook', 'hidden'], family: 'macro', pics: 1, enter: 'push', note: ['a CLOSE-UP: one detail of the object filling the box, its material and texture showing'] },
  { id: 'window', name: 'window reveal', about: 'a pale wall; an opening widens and shows the object in the lit world behind it', needs: ['reveal', 'home', 'answer', 'calm', 'travel'], family: 'window', pics: 1 },
  { id: 'torn-reveal', name: 'torn-paper reveal', about: 'a paper sheet tears in two and reveals the object beneath', needs: ['reveal', 'brand', 'answer', 'hidden', 'build'], family: 'tear', pics: 1 },
  // ── paper artefacts ──
  { id: 'specimen-card', name: 'specimen card', about: 'the object pinned to a ruled index card with a typed caption', needs: ['product', 'proof', 'learn', 'nature', 'idea'], family: 'card', pics: 1, note: ['one small specimen object, centred'] },
  { id: 'frame-wall', name: 'framed on a wall', about: 'the object hangs in a frame from a nail and sways', needs: ['timeline', 'emotion', 'home', 'proof', 'people'], family: 'frame', pics: 1 },
  { id: 'luggage-tag', name: 'luggage tag', about: 'a paper tag on a string swings from the object, the key word typed on it', needs: ['travel', 'product', 'brand', 'location', 'money'], family: 'tag', pics: 1 },
  { id: 'stamp', name: 'rubber stamp', about: 'a rubber stamp slams the key word across the object', needs: ['success', 'proof', 'warning', 'claim', 'payoff'], family: 'stamp', pics: 1, roles: ANY },
  { id: 'envelope', name: 'envelope and letter', about: 'a letter slides out of an envelope carrying the object and a typed line', needs: ['voices', 'quote', 'people', 'emotion', 'connect'], family: 'letter', pics: 1 },
  { id: 'receipt', name: 'receipt strip', about: 'a receipt prints down line by line, the number as its total', needs: ['money', 'stakes', 'list', 'number', 'data'], family: 'receipt', pics: 1, number: 'optional', words: [4, 16] },
  { id: 'ticket', name: 'ticket', about: 'a ticket with a perforated stub flies in, the object printed on it', needs: ['travel', 'time', 'choice', 'cta', 'payoff'], family: 'ticket', pics: 1, enter: 'fly' },
  { id: 'postcard', name: 'postcard', about: 'a postcard turns in: the object on its face, the key word written on the lines', needs: ['location', 'travel', 'global', 'nature', 'emotion'], family: 'postcard', pics: 1, enter: 'turn' },
  { id: 'map-pin', name: 'map with a pin', about: 'a contour map, a pin drops, the object rises in a round callout', needs: ['location', 'global', 'travel', 'network', 'nature'], family: 'map', pics: 1 },
  // ── type (no picture; capped by the cast's type share) ──
  { id: 'pull-quote', name: 'pull quote', about: 'the line set as a big pull quote under a giant quote mark', needs: ['payoff', 'quote', 'claim', 'emotion'], family: 'quote', pics: 0, typeOnly: true, roles: ['middle', 'close'] },
  { id: 'strike-swap', name: 'struck word replaced', about: 'a word is struck through by hand and the true word lands', needs: ['contrast', 'before-after', 'answer', 'warning'], family: 'strike', pics: 0, typeOnly: true, words: [3, 14] },
  { id: 'coined-card', name: 'coined-term card', about: 'the coined term as a dictionary entry on a paper card', needs: ['idea', 'reveal', 'claim', 'focus'], family: 'coined', pics: 0, typeOnly: true, words: [2, 9] },
  { id: 'giant-number', name: 'number as an object', about: 'the spoken number as a giant lit object, the picture small on top of it', needs: ['number', 'percent', 'money', 'time', 'scale'], family: 'number', pics: 1, number: 'required' },
  { id: 'masthead', name: 'masthead headline', about: 'the line as a newspaper headline between rules, a small print in its column', needs: ['hook', 'claim', 'reveal', 'brand', 'proof'], family: 'headline', pics: 1, roles: ['open', 'middle'] },
  { id: 'redaction', name: 'redaction bars', about: 'the key words sit under ink bars that lift as each is said', needs: ['hidden', 'security', 'warning', 'problem', 'question'], family: 'redact', pics: 0, typeOnly: true, words: [3, 14] },
];

/** Arcs that suit an editorial essay (no checklist, no steps, no "three things", no CTA endings). */
export const ARCS_ALLOWED = ['myth-truth', 'contrarian', 'origin', 'zoom-out', 'fable', 'stakes-ladder', 'before-after', 'one-number', 'customer-voice', 'day-in-life'];

/** The Editorial voice, on top of any arc. */
export const VOICE = 'This is an EDITORIAL essay reel: calm authority, a magazine voice about the customer\'s world and the brand\'s craft. Every line carries a concrete, picturable noun (an object, a material, a place, a hand). Coin ONE two-word term borrowed from another field (like "crop rotation" or "slow ledger") for the idea, and say it in its own short line. The essay turns once. The last line is quotable on its own. No hype, no lists of features, no questions as the opener, no call to action, no "in this video", never the domain or "visit".';
export const COINED_FIELD = { coined: 'the coined two-word term (lowercase), exactly as one of the lines says it' };

/** An arc in the Editorial dialect: a little longer per line (an essay breathes) plus the coined-term line. */
export function editorialArc(arc: Arc): Arc {
  const slots: Slot[] = arc.slots.map(s => ({ ...s, words: [Math.round(s.words[0] * 1.25), Math.round(s.words[1] * 1.3)] as [number, number] }));
  const name: Slot = { does: 'NAME IT: the coined two-word term in a short line of its own ("Call it <term>." / "Think of it as <term>.")', words: [3, 7], needs: ['idea', 'reveal', 'focus'] };
  const at = Math.max(1, slots.findIndex((s, i) => i > 0 && s.needs.some(n => n === 'brand' || n === 'answer' || n === 'benefit')));
  slots.splice(Math.min(at, slots.length - 1), 0, name);
  // an essay needs room (about 30 s, something new every 2-5 s): a short arc gets one more sourced image before its payoff
  if (slots.length < 7) slots.splice(slots.length - 1, 0, { does: 'DETAIL: one more concrete, sourced detail from the facts, said as an image', words: [7, 14], needs: ['proof', 'product'] });
  return { ...arc, slots };
}

/** The improvising vocabulary: everything the player's composer can draw in the editorial world. */
export const VOCAB: Vocab = {
  layouts: ['hero', 'stack', 'row', 'grid', 'split', 'orbit', 'path', 'scatter', 'corner', 'frame'],
  kinds: ['picture', 'word', 'label', 'number', 'device', 'shape', 'line'],
  shapes: ['card', 'tape', 'frame', 'circle', 'arrow', 'orbit', 'beam', 'ruler', 'stamp', 'pin', 'bar', 'underline', 'bracket'],
  motions: ['push', 'turn', 'drop', 'fly', 'rise', 'type', 'draw', 'stamp'],
  tones: ['ink', 'edge', 'top', 'mid', 'center', 'paper'],
  icons: ['main', 'second', 'echo'],
  about: {
    hero: 'one big element centred, the rest small around it', stack: 'elements in a column', row: 'elements side by side',
    grid: 'a 2-column grid', split: 'two halves, left against right', orbit: 'one centre, the rest around it on an ellipse',
    path: 'elements on a diagonal path', scatter: 'cards taped at angles', corner: 'one element huge in the corner, cropped', frame: 'everything on one paper card',
  },
};
/** The context line the improvise call gets. */
export const IMPROVISE_CONTEXT = 'Style: an editorial magazine essay in one colour. A "picture" is the line\'s drawn object (icon main = this line\'s picture, echo = an earlier picture of the film); shapes and devices are paper cards, tape, frames, hand-drawn circles and arrows, orbits, light beams, rulers, rubber stamps, map pins; "word" marks a spoken key word for heavy caps; a label is a short typed caption.';

const h32 = (s: string) => createHash('sha1').update(s).digest().readUInt32BE(0) / 2 ** 32;

/** The set-up as its renderer's library entry (grown set-ups are rendered by the composer). */
export const setupOf = (lib: S4Setup[], id: string) => lib.find(s => s.id === id);
export const picsOf = (s: S4Setup | null | undefined) => (s ? s.pics ?? 1 : 1);

/** Key words of a line for the lockup when no picture call gave them (≈40 % of the words: the content words + numbers). */
export function keysFor(text: string): string[] {
  const ws = text.split(/\s+/).map((w, i) => ({ word: w, t: i, end: i }));
  return keyWords(ws, Math.max(1, Math.round(ws.length * 0.4))).map(k => k.word);
}

/**
 * The beats as the matcher sees them: needs = the slot's needs (the arc knows what each line does) first, then the
 * detector's merged with any model tags (kit mergeNeeds ignores a model that tags at random); items and numbers from
 * the spoken words; the coined line is hinted to the coined set-ups.
 */
export function beatsIn(ps: Piece[], o: { slotNeeds?: (i: number) => Need[]; coined?: string; tags?: { line: number; needs: string[] }[] }): BeatIn[] {
  const n = ps.length, merged = mergeNeeds(ps.map(p => p.text), o.tags).needs;
  return ps.map((p, i) => {
    const det = merged[i] ?? [];
    const needs = [...new Set([...(o.slotNeeds?.(i) ?? []), ...det])].filter(isNeed);
    const coinedHere = !!o.coined && p.text.toLowerCase().includes(o.coined.toLowerCase());
    const role: Role = i === 0 ? 'open' : i === n - 1 ? 'close' : 'middle';
    return {
      index: i, text: p.text, words: p.words.length, seconds: +(p.words.at(-1)!.end - p.words[0]!.t).toFixed(2), needs,
      items: listItems(p.text).length, number: spokenNumber(p.text), role, hints: coinedHere ? ['coined-hero', 'coined-card', 'coined-plate', 'coined-margin'] : undefined,
    };
  });
}

/** Which arc line a piece belongs to (pieces are cut from the voice's words; lines are the script's): by word position. */
export function lineOfPiece(ps: Piece[], lines: string[]): number[] {
  const lw = lines.map(l => l.split(/\s+/).filter(Boolean).length), total = Math.max(1, lw.reduce((a, b) => a + b, 0));
  const all = Math.max(1, ps.reduce((a, p) => a + p.words.length, 0));
  let seen = 0;
  return ps.map(p => {
    const at = (seen + 0.5) / all * total; seen += p.words.length;
    let acc = 0; for (let i = 0; i < lw.length; i++) { acc += lw[i]!; if (at < acc) return i; }
    return lw.length - 1;
  });
}

/** Entrances for a film: the set-up's own when it has one, else a seeded rotation; never the same three in a row. */
export function entrances(setups: (S4Setup | null)[], seed: string): Enter[] {
  const ROT: Enter[] = ['push', 'turn', 'push', 'drop', 'turn', 'push', 'fly'];
  const off = Math.floor(h32(seed) * ROT.length), out: Enter[] = [];
  setups.forEach((s, i) => {
    let e: Enter = s?.enter ?? ROT[(i + off) % ROT.length]!;
    if (i >= 2 && out[i - 1] === e && out[i - 2] === e) e = e === 'push' ? 'turn' : 'push';
    out.push(e);
  });
  return out;
}

/**
 * A kept improvisation, re-anchored on a new beat: its texts become this line's key words (in order), its word
 * indices land on this line's words, a number stays only if this line says one.
 */
export function adapt(spec: Spec, b: { text: string; words: { word: string; t: number; end: number }[] }): Spec {
  const keys = keyWords(b.words, 4), num = spokenNumber(b.text), n = Math.max(1, b.words.length);
  let k = 0;
  const maxW = Math.max(1, ...spec.elements.map(e => e.word));
  const elements = spec.elements.filter(e => e.kind !== 'number' || num != null).map(e => {
    const word = Math.min(n - 1, Math.round(e.word / maxW * (n - 1)));
    if (['word', 'line', 'label'].includes(e.kind)) { const kw = keys[k++ % Math.max(1, keys.length)]; return { ...e, text: kw?.word ?? e.text, word: kw?.index ?? word }; }
    if (e.kind === 'number') return { ...e, value: num!, text: String(num), word: Math.max(0, b.words.findIndex(w => /\d/.test(w.word))) };
    return { ...e, word };
  });
  return { ...spec, elements };
}
