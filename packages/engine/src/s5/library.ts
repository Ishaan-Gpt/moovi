/**
 * Clear Signal's LIBRARY: every set-up the style can cast, each a real renderer in ./client.js (same id), tagged with
 * the needs it serves (kit/needs.ts), its family (two of one family never stand back to back), the spoken items or
 * number it shows, the beat length and roles it suits. All of them obey the style's laws (BREAKDOWN.md): white paper,
 * one accent hue, near-black ink, grotesk + italic serif, words on the voice, flat accent-filled pictograms, blur
 * hand-offs. Plus the VOCABULARY its composer draws improvised set-ups from, the arcs it allows and its voice rules.
 */
import type { Setup, Vocab } from '../styles/kit';
import { ICON_NAMES } from './icons';

type S = Omit<Setup, 'name'> & { name?: string };
const L = (s: S): Setup => ({ name: s.id, seconds: [1.1, 3.8], ...s });
const LIST: [number, number] = [2, 4];

export const S5_LIBRARY: Setup[] = [
  // ── type (the style's voice on paper) ──
  L({ id: 'hero', about: 'the hook: first word huge alone, then the line builds on a soft accent glow', needs: ['hook', 'claim', 'brand', 'reveal', 'focus'], family: 'type', roles: ['open'], weight: 1.15 }),
  L({ id: 'words', about: 'one word at a time, centred, in the accent colour', needs: ['focus', 'claim', 'emotion', 'payoff', 'calm'], family: 'type', typeOnly: true, words: [2, 6] }),
  L({ id: 'serif', about: 'the whole line in italic serif: a turn or aside', needs: ['contrast', 'idea', 'emotion', 'claim', 'answer'], family: 'type', typeOnly: true, words: [3, 12] }),
  L({ id: 'quote', about: 'a big accent quotation mark and the line in serif', needs: ['quote', 'voices', 'proof', 'emotion'], family: 'type', typeOnly: true }),
  L({ id: 'question', about: 'a giant outlined question mark behind the line', needs: ['question', 'hook', 'problem', 'hidden'], family: 'type', weight: 1.05 }),
  // ── the close ──
  L({ id: 'circle', about: 'thesis typed small, slides left, the payoff gets a hand-drawn ellipse', needs: ['payoff', 'claim', 'cta', 'brand'], family: 'close', roles: ['close'], seconds: [1.2, 5] }),
  L({ id: 'underline', about: 'the line centred, its last words underlined by a drawn accent swoosh', needs: ['payoff', 'cta', 'brand', 'claim'], family: 'close', roles: ['close'], seconds: [1.2, 5] }),
  L({ id: 'stamp', about: 'the line, then a round accent seal with a tick stamps under it', needs: ['payoff', 'success', 'cta', 'proof'], family: 'close', roles: ['close'], seconds: [1.2, 5] }),
  // ── time ──
  L({ id: 'dial', about: 'a giant clock arc cropped by the frame, a sweeping hand', needs: ['time', 'stakes', 'speed', 'warning'], family: 'time' }),
  L({ id: 'stopwatch', about: 'a stopwatch whose accent wedge sweeps round, a spoken time inside', needs: ['time', 'speed', 'number', 'stakes'], family: 'time', number: 'optional' }),
  L({ id: 'calendar', about: 'a calendar page; days fill in accent one by one', needs: ['time', 'timeline', 'cycle', 'steps'], family: 'time' }),
  L({ id: 'hourglass', about: 'an hourglass, accent sand running out', needs: ['time', 'stakes', 'decline', 'warning', 'calm'], family: 'time' }),
  L({ id: 'meter', about: 'a half-moon gauge; the needle swings into the accent zone', needs: ['speed', 'growth', 'scale', 'percent', 'success'], family: 'gauge', number: 'optional' }),
  L({ id: 'ruler', about: 'a timeline ruler with dated marks, a marker slides to now', needs: ['timeline', 'time', 'steps', 'growth'], family: 'timeline', number: 'optional' }),
  // ── people ──
  L({ id: 'crowd', about: 'a row of five people, the centre one in ink, in corner brackets', needs: ['people', 'focus', 'voices', 'scale'], family: 'people' }),
  L({ id: 'spotlight', about: 'one person under a soft accent spotlight', needs: ['people', 'focus', 'hook', 'emotion', 'reveal'], family: 'people' }),
  L({ id: 'avatars', about: 'a grid of avatars filling in, a few in accent', needs: ['people', 'scale', 'global', 'network', 'growth'], family: 'people' }),
  L({ id: 'pair', about: 'two people joined by a drawn link', needs: ['connect', 'people', 'voices', 'flow'], family: 'people' }),
  // ── voices ──
  L({ id: 'cards', about: 'floating review/message cards around an outlined ???', needs: ['chaos', 'voices', 'question', 'problem'], family: 'voices' }),
  L({ id: 'chat', about: 'chat bubbles arrive left and right, then typing dots', needs: ['voices', 'quote', 'connect', 'people', 'ai'], family: 'voices' }),
  L({ id: 'inbox', about: 'an inbox panel, rows sliding in, the unread count climbing', needs: ['voices', 'chaos', 'stakes', 'data', 'problem'], family: 'voices', number: 'optional' }),
  L({ id: 'notifs', about: 'a ringing bell, notification cards dropping into a stack', needs: ['voices', 'chaos', 'warning', 'speed'], family: 'voices' }),
  // ── numbers ──
  L({ id: 'counter', about: 'a progress ring counting up to the spoken number', needs: ['number', 'growth', 'proof', 'scale'], family: 'number', number: 'required' }),
  L({ id: 'slam', about: 'the spoken number slams in huge, an accent bar under it', needs: ['number', 'hook', 'proof', 'stakes', 'scale'], family: 'number', number: 'required', weight: 1.05 }),
  L({ id: 'percent', about: 'a circle filling with accent liquid to the spoken percent', needs: ['percent', 'decline', 'growth'], family: 'number', number: 'required' }),
  L({ id: 'dots', about: 'a 10x10 dot grid, the spoken share (or a few) filling in accent', needs: ['percent', 'scale', 'people'], family: 'number-grid', number: 'optional' }),
  // ── money ──
  L({ id: 'coins', about: 'a stack of accent coins growing beside a short grey one', needs: ['money', 'growth', 'stakes', 'scale'], family: 'money', number: 'optional' }),
  L({ id: 'tag', about: 'a swinging price tag with the price or key word', needs: ['money', 'number', 'product'], family: 'money', number: 'optional' }),
  L({ id: 'receipt', about: 'a receipt printing its lines and an accent total', needs: ['money', 'list', 'stakes', 'data'], family: 'money', number: 'optional' }),
  // ── charts ──
  L({ id: 'bars', about: 'a bar chart growing, the last bar in accent', needs: ['growth', 'data', 'decline', 'compare', 'success'], family: 'chart', number: 'optional' }),
  L({ id: 'linechart', about: 'a line chart drawing itself to an accent point', needs: ['growth', 'decline', 'data', 'success', 'timeline'], family: 'chart', number: 'optional' }),
  L({ id: 'donut', about: 'a donut chart whose accent share draws round', needs: ['percent', 'data', 'layers', 'choice'], family: 'chart', number: 'optional' }),
  // ── compare ──
  L({ id: 'versus', about: 'two cards, muted left and accent right, a vs disc between', needs: ['compare', 'choice', 'before-after', 'contrast'], family: 'compare' }),
  L({ id: 'wipe', about: 'a messy before-scribble wiped into a clean accent after', needs: ['before-after', 'simplify', 'chaos', 'calm', 'contrast'], family: 'compare' }),
  L({ id: 'xcheck', about: 'a crossed-out old way above a ticked new way', needs: ['contrast', 'compare', 'warning', 'success', 'answer'], family: 'compare' }),
  L({ id: 'balance', about: 'a balance scale tipping toward the accent side', needs: ['compare', 'choice', 'proof', 'money'], family: 'compare' }),
  L({ id: 'toggle', about: 'a settings panel; one switch flips on in accent', needs: ['simplify', 'choice', 'before-after', 'calm', 'ui'], family: 'ui' }),
  // ── lists ──
  L({ id: 'nodes', about: 'accent hexagons with icons and leader-line labels, one per item', needs: ['list', 'benefit', 'stakes', 'process'], family: 'list', items: LIST, seconds: [1.6, 5] }),
  L({ id: 'pills', about: 'rounded tags, one per spoken item, filled and outlined', needs: ['list', 'benefit', 'claim'], family: 'list', items: [2, 5], seconds: [1.5, 5] }),
  L({ id: 'checklist', about: 'a checklist; each item ticks in accent as it is said', needs: ['list', 'steps', 'success', 'focus'], family: 'list', items: [2, 5], seconds: [1.6, 5] }),
  L({ id: 'steps', about: 'numbered accent circles along a drawn path, one per step', needs: ['steps', 'process', 'list', 'timeline'], family: 'list', items: LIST, seconds: [1.6, 5] }),
  L({ id: 'tiles', about: 'a grid of app tiles with icons, one per item', needs: ['list', 'tool', 'product', 'network'], family: 'list', items: [3, 6], seconds: [1.6, 5] }),
  L({ id: 'podium', about: 'a podium rising, first place in accent with a trophy', needs: ['ranking', 'success', 'proof', 'compare'], family: 'rank' }),
  L({ id: 'pyramid', about: 'three tiers stacking into a pyramid, the top in accent', needs: ['hierarchy', 'layers', 'ranking', 'build'], family: 'rank' }),
  L({ id: 'layers', about: 'isometric slabs stacking and lifting apart, the top in accent', needs: ['layers', 'build', 'data', 'security', 'process'], family: 'stack' }),
  // ── flow / systems ──
  L({ id: 'flow', about: 'three icon discs joined by drawn arrows, A to B to C', needs: ['flow', 'process', 'connect', 'steps'], family: 'flow' }),
  L({ id: 'funnel', about: 'many grey dots fall into a funnel, one accent drop comes out', needs: ['simplify', 'focus', 'process', 'data', 'chaos'], family: 'flow' }),
  L({ id: 'cycle', about: 'three icons on a looping ring of arrows', needs: ['cycle', 'process', 'time', 'build'], family: 'flow' }),
  L({ id: 'orbit', about: 'a core hexagon with small icons orbiting it', needs: ['network', 'connect', 'ai', 'brand', 'product'], family: 'system' }),
  L({ id: 'hub', about: 'a hub with spokes drawing out to six icon nodes', needs: ['network', 'connect', 'global', 'tool', 'data'], family: 'system' }),
  // ── place ──
  L({ id: 'pins', about: 'a flat map; accent pins drop onto it', needs: ['location', 'travel', 'home', 'people'], family: 'place' }),
  L({ id: 'globe', about: 'a line globe turning, accent arcs drawn between points', needs: ['global', 'network', 'scale', 'travel'], family: 'place' }),
  // ── focus / safety ──
  L({ id: 'magnifier', about: 'a magnifier glides over grey lines, one turns accent', needs: ['focus', 'hidden', 'data', 'learn', 'answer'], family: 'focus' }),
  L({ id: 'target', about: 'a target; an arrow lands dead centre', needs: ['focus', 'success', 'benefit', 'answer'], family: 'focus' }),
  L({ id: 'lock', about: 'an accent padlock clicks shut inside a turning dashed shield ring', needs: ['security', 'proof', 'calm', 'hidden'], family: 'safe' }),
  L({ id: 'warning', about: 'an accent warning triangle pulsing', needs: ['warning', 'problem', 'stakes', 'chaos'], family: 'safe' }),
  // ── interface ──
  L({ id: 'slider', about: 'a slider knob gliding along an accent track', needs: ['scale', 'growth', 'choice', 'simplify', 'decline'], family: 'ui', number: 'optional' }),
  L({ id: 'cursor', about: 'a cursor glides to an accent button with the key word and clicks', needs: ['cta', 'ui', 'simplify', 'speed', 'answer'], family: 'ui-click' }),
  L({ id: 'browser', about: 'a browser window building its page block by block', needs: ['ui', 'product', 'tool', 'build', 'reveal'], family: 'screen' }),
  L({ id: 'phone', about: 'a phone frame, app cards stacking inside', needs: ['ui', 'product', 'people', 'voices'], family: 'screen' }),
  L({ id: 'search', about: 'a search bar typing the key words, results below', needs: ['question', 'answer', 'learn', 'focus', 'data'], family: 'screen' }),
  // ── ideas ──
  L({ id: 'bulb', about: 'a line bulb lights up in accent with rays', needs: ['idea', 'answer', 'reveal', 'learn'], family: 'idea' }),
  L({ id: 'puzzle', about: 'two puzzle pieces slide together and lock', needs: ['connect', 'answer', 'simplify', 'idea'], family: 'idea' }),
  L({ id: 'rocket', about: 'an accent rocket lifting off on a dashed trail', needs: ['speed', 'growth', 'success', 'build', 'reveal'], family: 'launch' }),
  L({ id: 'mark', about: 'the brand mark lands big on the name, a dashed ring turning round it', needs: ['brand', 'reveal', 'answer', 'hook'], family: 'brand', weight: 1.05 }),
  L({ id: 'emblem', about: 'one big accent hexagon with the line\'s icon and key word', needs: ['benefit', 'reveal', 'product', 'brand', 'claim'], family: 'emblem', weight: 0.92 }),
];

export const S5_IDS = S5_LIBRARY.map(s => s.id);

/** The composer's vocabulary (client.js `compose` draws any spec built from it in the Clear Signal world). */
export const S5_VOCAB: Vocab = {
  layouts: ['hero', 'stack', 'grid', 'row', 'split', 'path', 'orbit', 'ring'],
  kinds: ['icon', 'shape', 'word', 'label', 'number', 'arrow', 'bar', 'ring', 'dots'],
  shapes: ['hex', 'circle', 'pill', 'square', 'diamond'],
  motions: ['pop', 'rise', 'slide', 'draw', 'grow', 'count', 'spin'],
  tones: ['accent', 'ink', 'muted', 'paper'],
  // spark first: the kit's sketch falls back to the first icon when no word maps to one (never a crowd)
  icons: ['spark', ...ICON_NAMES.filter(n => n !== 'spark')],
  about: {
    hero: 'one big picture in the centre', stack: 'a column, top to bottom', grid: 'two columns of tiles', row: 'side by side, left to right',
    split: 'left vs right halves', path: 'a drawn zig-zag path joining them in order', orbit: 'one at the centre, the rest around it', ring: 'evenly around a drawn circle',
  },
};

/** Arcs that suit a calm declarative explainer (kit/arcs.ts ids). */
export const S5_ARCS = ['pain-turn', 'myth-truth', 'how-it-works', 'one-number', 'before-after', 'question-answer', 'three-things', 'versus', 'checklist', 'stakes-ladder', 'contrarian', 'zoom-out', 'inside-machine'];

export const S5_VOICE = 'This is "Clear Signal": a calm, clear, declarative explainer, like a good teacher. Short sentences of 3-10 words, one idea per line. Say lists with commas ("fast, private, and free"). Concrete nouns over adjectives. Ask a question only where a slot asks for one. No hype, no exclamation marks, no filler, no "imagine".';
