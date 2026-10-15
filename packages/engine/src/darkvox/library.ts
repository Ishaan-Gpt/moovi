/**
 * The Dark Vox library: every stage set-up the style can cast, tagged for the matcher (kit/library.ts cast()) with
 * the needs it serves, its family (two of one family never stand back to back), roles, items, number, seconds, and
 * the Dark Vox staging it wants: the sets it stands on, the camera moves that suit it, whether it hosts the line's
 * model-drawn picture as its hero, how many props it shows, and whether it must carry on-screen words. Each id has a
 * renderer in ./stage.ts (SETUPS); improvised set-ups the style kept (kit grow) join through `darkvoxLibrary()` and
 * play through the composer. The improvising vocabulary (VOCAB) is the composer's grammar.
 */
import { grown, type Setup } from '../styles/kit/library';
import type { Vocab } from '../styles/kit/compose';
import type { CameraMove, LightPreset, SetKind } from '../../../library/src/dark-vox/tokens';
import { PROP_NAMES } from './props';

export interface DvSetup extends Setup {
  /** the sets it stands on (the planner rotates them) */
  sets: SetKind[];
  /** camera moves that suit it (default: any) */
  moves?: CameraMove[];
  /** the line's model-drawn picture is its hero (else code-drawn props only) */
  pic?: boolean;
  /** how many props it shows (lists: one per item) */
  props?: number;
  /** it must carry on-screen words (a sign, a ticket, a headline) */
  wants?: 'words' | 'line';
  /** the stage dressing it needs over the set's defaults */
  dress?: { light?: LightPreset; wings?: 'curtains' | 'frame' | 'none'; floor?: 'rays' | 'checker' | 'none'; fore?: 'stars' | 'clouds' | 'none' };
  /** a portal (the last shot as a framed picture) may open it */
  portal?: boolean;
  /** it fills the frame's width (signs, paper, rows): never framed tighter */
  wide?: boolean;
}

const ANY: SetKind[] = ['velvet', 'harlequin', 'checker', 'night', 'wood', 'swirl', 'sunburst'];
const S = (id: string, family: string, about: string, needs: Setup['needs'], o: Partial<DvSetup> = {}): DvSetup => ({ id, name: id, family, about, needs, sets: ANY, seconds: [1.3, 5.5], ...o });

export const DV_SETUPS: DvSetup[] = [
  // one prop, staged
  S('spot-prop', 'solo', 'one prop under a spotlight, the word above it', ['product', 'focus', 'reveal', 'idea', 'hook', 'benefit'], { pic: true, props: 1, portal: true }),
  S('pedestal-marquee', 'pedestal', 'a prop on a column under a lit marquee sign', ['brand', 'reveal', 'product', 'success', 'proof', 'ranking'], { pic: true, props: 1, dress: { wings: 'none' }, sets: ['velvet', 'checker', 'harlequin', 'night'], wants: 'words', weight: 1.05, wide: true }),
  S('curtain-reveal', 'reveal', 'velvet curtains part to reveal the prop', ['reveal', 'brand', 'answer', 'hook', 'product'], { pic: true, props: 1, roles: ['open', 'middle'], sets: ['night', 'swirl', 'sunburst', 'checker', 'wood'], dress: { wings: 'none' }, moves: ['hold', 'pull', 'punch'], weight: 1.05 }),
  S('hat-reveal', 'magic', 'the prop rises out of a magician\'s top hat with sparks', ['reveal', 'idea', 'answer', 'simplify', 'hidden', 'benefit'], { pic: true, props: 1, sets: ['velvet', 'harlequin', 'night', 'checker'] }),
  S('shadow-play', 'shadow', 'a lamp throws the prop\'s giant shadow on a paper screen', ['hidden', 'emotion', 'problem', 'idea', 'stakes', 'question'], { pic: true, props: 1, sets: ['wood', 'checker', 'night'], dress: { wings: 'none', fore: 'none', light: 'top' }, wide: true }),
  S('puppet-strings', 'puppet', 'the prop hangs from a marionette\'s strings and swings', ['ai', 'process', 'hidden', 'problem', 'tool', 'people'], { pic: true, props: 1, sets: ['harlequin', 'velvet', 'night', 'swirl', 'sunburst'], dress: { fore: 'none' }, moves: ['rise', 'punch', 'hold'], wide: true }),
  S('diorama', 'diorama', 'a paper diorama: hills, a house and a tree, the prop in the middle plane', ['location', 'home', 'nature', 'travel', 'calm', 'people'], { pic: true, props: 1, sets: ['night', 'sunburst'], dress: { fore: 'none' }, moves: ['pull', 'rise'], portal: true }),
  S('popup-book', 'book', 'an open book; the prop pops up from the pages', ['learn', 'idea', 'build', 'timeline', 'quote', 'hook'], { pic: true, props: 3, sets: ['wood', 'grid', 'velvet', 'night'] }),
  // two things
  S('versus', 'compare', 'two props on two columns, a red bolt between; the old one dims', ['compare', 'contrast', 'choice', 'before-after', 'problem'], { props: 2, sets: ['checker', 'harlequin', 'velvet', 'wood'], wide: true, moves: ['punch', 'hold'] }),
  S('balance-scale', 'scale', 'a brass balance tips toward the second prop', ['compare', 'money', 'choice', 'proof', 'before-after', 'reason'], { props: 2, sets: ['wood', 'grid', 'velvet', 'checker', 'swirl'], wide: true, moves: ['punch', 'hold', 'rise'] }),
  S('mirror', 'mirror', 'a gilt mirror shows a different prop than the one before it', ['contrast', 'before-after', 'hidden', 'idea', 'emotion'], { pic: true, props: 2, sets: ['velvet', 'swirl', 'harlequin', 'night'] }),
  S('moon-sun', 'swap', 'the moon sinks and a paper sun rises: night turns to day', ['before-after', 'contrast', 'calm', 'time', 'success', 'hook'], { props: 0, sets: ['night'], dress: { fore: 'none', light: 'moon' } }),
  S('masks', 'masks', 'comedy and tragedy masks swing in on strings', ['emotion', 'contrast', 'people', 'voices', 'before-after'], { props: 0, sets: ['velvet', 'harlequin', 'night', 'swirl'], dress: { fore: 'none' }, wide: true }),
  // lists, procession
  S('carousel', 'list', 'props ride a turning carousel; the items stack as engraved lines', ['list', 'cycle', 'choice', 'benefit'], { items: [2, 5], props: 5, sets: ['night', 'sunburst', 'velvet', 'harlequin'], dress: { fore: 'none' }, wide: true, moves: ['hold', 'rise', 'punch'] }),
  S('lantern-procession', 'list', 'lanterns on a wire light one by one, each with its item', ['list', 'steps', 'timeline', 'benefit', 'calm'], { items: [2, 4], props: 1, sets: ['night', 'waves', 'swirl', 'velvet'], dress: { fore: 'none' }, wide: true, moves: ['hold', 'rise'] }),
  S('gallery-wall', 'gallery', 'framed props swing onto a wall, each with its label', ['list', 'proof', 'people', 'voices', 'timeline', 'quote'], { props: 4, sets: ['swirl', 'wood', 'velvet', 'harlequin'], moves: ['hold', 'rise'], wide: true }),
  S('conveyor', 'row', 'props ride a conveyor belt in, each labelled', ['process', 'flow', 'steps', 'speed', 'build', 'list'], { props: 4, sets: ['grid', 'wood', 'checker'], moves: ['slide', 'hold', 'punch'], wide: true }),
  S('train', 'row', 'a toy train pulls in, its cars carrying the items', ['list', 'flow', 'travel', 'steps', 'speed', 'connect'], { items: [2, 3], props: 4, sets: ['night', 'sunburst', 'grid', 'waves'], moves: ['slide', 'hold'], wide: true }),
  S('doors-choice', 'doors', 'three doors; the last one opens on light', ['choice', 'question', 'answer', 'list', 'reveal'], { props: 1, pic: true, sets: ['checker', 'velvet', 'night', 'harlequin'], wide: true, moves: ['hold', 'punch'] }),
  // signs and paper: the words live on an object
  S('marquee-word', 'sign', 'the word in lights on a theatre marquee', ['brand', 'claim', 'payoff', 'hook', 'reveal', 'success'], { props: 1, dress: { wings: 'none' }, sets: ['velvet', 'night', 'checker', 'harlequin'], wants: 'words', moves: ['punch', 'rise', 'hold'], weight: 1.05, wide: true }),
  S('ticket-word', 'ticket', 'the word printed in the brand ink on a giant ticket', ['cta', 'brand', 'payoff', 'money', 'proof', 'claim'], { props: 0, dress: { wings: 'none' }, sets: ['velvet', 'wood', 'harlequin', 'sunburst', 'swirl'], wants: 'words', moves: ['punch', 'slide'], wide: true }),
  S('telegram', 'paper', 'the line stamped word by word on a telegram', ['quote', 'voices', 'warning', 'claim', 'stakes', 'reason'], { props: 0, dress: { wings: 'none' }, sets: ['wood', 'grid', 'night'], wants: 'line', typeOnly: true, seconds: [2.0, 6], words: [4, 12], moves: ['hold', 'punch'], wide: true }),
  S('playbill', 'poster', 'a playbill poster drops in: the word and the prop on it', ['brand', 'reveal', 'people', 'hook', 'payoff', 'product'], { pic: true, props: 1, dress: { wings: 'none' }, sets: ['checker', 'night', 'velvet', 'wood'], wants: 'words', wide: true }),
  S('headline', 'press', 'a newspaper spins in with the word as its headline', ['claim', 'proof', 'stakes', 'number', 'timeline', 'warning'], { props: 1, dress: { wings: 'none' }, sets: ['wood', 'grid', 'checker'], wants: 'words', moves: ['punch', 'hold'], wide: true }),
  S('announce', 'horn', 'a brass megaphone with sound rings, the word above', ['voices', 'claim', 'brand', 'cta', 'people'], { props: 0, sets: ['sunburst', 'harlequin', 'velvet', 'swirl'], wants: 'words' }),
  S('title-card', 'type', 'the word as a huge title between gold rules', ['claim', 'payoff', 'hook', 'idea', 'focus'], { props: 0, sets: ['velvet', 'night', 'swirl', 'checker'], wants: 'words', typeOnly: true, moves: ['hold', 'punch'], wide: true }),
  S('quote-card', 'type', 'the whole line in engraved serif inside a gilt frame', ['quote', 'voices', 'proof', 'emotion', 'payoff'], { props: 0, dress: { wings: 'none' }, sets: ['wood', 'velvet', 'harlequin', 'swirl'], wants: 'line', typeOnly: true, seconds: [2.0, 6], words: [3, 14], moves: ['hold'], wide: true }),
  // place, journey, connection
  S('window-scene', 'window', 'the prop on a window sill, the moon outside, a candle lit', ['home', 'calm', 'time', 'emotion', 'location', 'hidden'], { pic: true, props: 1, sets: ['wood', 'velvet', 'harlequin', 'swirl'] }),
  S('door-opens', 'door', 'a door swings open on warm light; the prop waits inside', ['answer', 'reveal', 'cta', 'idea', 'success', 'brand'], { pic: true, props: 1, sets: ['night', 'checker', 'velvet', 'harlequin'] }),
  S('map-scroll', 'map', 'a map unrolls; a red route joins pinned props', ['travel', 'global', 'location', 'flow', 'steps', 'timeline'], { props: 3, sets: ['wood', 'grid', 'night'], moves: ['hold', 'rise'], wide: true }),
  S('constellation', 'network', 'stars appear and join into a constellation', ['network', 'connect', 'people', 'global', 'data', 'list'], { props: 3, sets: ['night'], dress: { fore: 'none', light: 'moon' }, moves: ['hold', 'rise'], wide: true }),
  S('orbit', 'orbit', 'small props orbit the main prop like a planetarium', ['network', 'ai', 'data', 'connect', 'cycle', 'list'], { pic: true, props: 4, sets: ['night', 'swirl', 'sunburst'], dress: { fore: 'none' }, moves: ['hold', 'punch', 'rise'] }),
  S('bridge', 'bridge', 'planks drop in to bridge two cliffs, a prop on each side', ['connect', 'flow', 'answer', 'simplify', 'compare'], { props: 2, sets: ['night', 'waves', 'swirl'], dress: { fore: 'none' }, wide: true }),
  S('letter-flight', 'mail', 'letters fly in an arc to the prop', ['voices', 'flow', 'connect', 'people', 'speed', 'growth'], { pic: true, props: 1, sets: ['sunburst', 'night', 'swirl', 'grid'], moves: ['slide', 'hold', 'punch'], wide: true }),
  S('paper-boat', 'sea', 'a paper boat rocks on the paper waves at night', ['travel', 'flow', 'chaos', 'calm', 'stakes', 'emotion'], { props: 1, sets: ['waves'], dress: { fore: 'none' }, portal: true, moves: ['hold', 'rise', 'punch'] }),
  S('staircase', 'climb', 'a paper figure climbs steps as they rise, a prop at the top', ['growth', 'steps', 'success', 'ranking', 'build', 'timeline'], { props: 1, sets: ['sunburst', 'night', 'checker', 'swirl'], moves: ['rise', 'hold'], portal: true }),
  S('tightrope', 'risk', 'a figure balances on a tightrope over the dark', ['stakes', 'warning', 'problem', 'focus', 'choice'], { props: 1, pic: true, sets: ['night', 'waves', 'swirl'], dress: { fore: 'none' }, moves: ['slide', 'hold'] }),
  // light, darkness, time, weather
  S('searchlight', 'search', 'a searchlight sweeps the dark and finds the prop', ['question', 'hidden', 'focus', 'problem', 'hook', 'answer'], { pic: true, props: 1, sets: ['checker', 'velvet', 'night', 'wood'], dress: { fore: 'none' }, moves: ['hold', 'punch'], weight: 1.05 }),
  S('fog', 'fog', 'the prop comes out of drifting fog', ['hidden', 'chaos', 'problem', 'question', 'reveal', 'emotion'], { pic: true, props: 1, sets: ['night', 'waves', 'swirl'], dress: { fore: 'none' }, moves: ['hold', 'punch'] }),
  S('clock-tower', 'time', 'a clock tower against the moon, its hands racing', ['time', 'speed', 'stakes', 'timeline', 'hook'], { props: 0, sets: ['night', 'swirl'], dress: { fore: 'none' }, moves: ['rise', 'hold'], wide: true }),
  S('hourglass', 'time', 'a big hourglass runs out', ['time', 'stakes', 'decline', 'warning', 'calm'], { props: 0, number: 'optional', sets: ['wood', 'velvet', 'swirl', 'checker'] }),
  S('candle-burn', 'time', 'a tall candle burns down, its flame flickering', ['time', 'calm', 'decline', 'stakes', 'emotion', 'focus'], { props: 0, sets: ['night', 'wood', 'velvet'], dress: { fore: 'none' }, moves: ['hold', 'punch'] }),
  S('storm', 'storm', 'a storm cloud strikes lightning over the prop', ['chaos', 'warning', 'problem', 'speed', 'stakes'], { pic: true, props: 1, sets: ['night', 'waves', 'swirl'], dress: { fore: 'none' }, moves: ['punch', 'hold'] }),
  S('chest-open', 'treasure', 'a chest opens on gold light; the prop floats up', ['benefit', 'hidden', 'money', 'reveal', 'success', 'answer'], { pic: true, props: 1, sets: ['wood', 'velvet', 'checker', 'harlequin'] }),
  S('telescope-view', 'vision', 'a brass telescope; its lens circle shows the prop among stars', ['idea', 'focus', 'global', 'timeline', 'question', 'hook'], { pic: true, props: 1, sets: ['night'], dress: { fore: 'none' } }),
  S('audience', 'people', 'a seated audience in silhouette before a lit stage and the word', ['people', 'voices', 'proof', 'brand', 'global', 'scale'], { props: 1, sets: ['velvet', 'checker', 'harlequin'], wants: 'words', moves: ['hold', 'rise'], wide: true }),
  S('confetti', 'finale', 'confetti falls over the word', ['success', 'payoff', 'claim', 'growth'], { props: 1, roles: ['middle', 'close'], sets: ['velvet', 'harlequin', 'checker', 'sunburst'], dress: { fore: 'none' }, wants: 'words', wide: true }),
  S('curtain-call', 'finale', 'the curtains close over the closing word', ['payoff', 'cta', 'brand', 'claim'], { props: 0, roles: ['close'], sets: ['velvet', 'harlequin', 'checker', 'night'], dress: { wings: 'none', fore: 'none' }, wants: 'words', moves: ['hold'], weight: 1.1, wide: true }),
  // numbers, money, growth
  S('number-odometer', 'number', 'a brass counter rolls its drums to the spoken number', ['number', 'percent', 'scale', 'growth', 'data', 'time'], { number: 'required', props: 1, sets: ['grid', 'velvet', 'checker', 'wood'], moves: ['punch', 'hold'], weight: 1.05, wide: true }),
  S('number-giant', 'number', 'the spoken number counts up huge; a tiny prop sits on it', ['number', 'scale', 'proof', 'money', 'people', 'percent'], { number: 'required', props: 1, pic: true, sets: ['velvet', 'night', 'checker', 'swirl'], moves: ['punch', 'hold'], weight: 1.05, wide: true }),
  S('coin-stack', 'money', 'stacks of gold coins rise', ['money', 'growth', 'benefit', 'success', 'number'], { number: 'optional', props: 0, sets: ['wood', 'velvet', 'checker', 'grid'], portal: true }),
  S('growth-plant', 'growth', 'a paper plant grows tall and blooms with the prop', ['growth', 'build', 'nature', 'success', 'learn', 'health'], { props: 1, sets: ['sunburst', 'night', 'grid', 'wood'], moves: ['hold', 'punch'] }),
];

/** The style's whole library: the hand-made set-ups plus the improvised ones it kept. */
export function darkvoxLibrary(): DvSetup[] {
  const kept = grown('darkvox').map(g => ({ ...g, sets: ANY, props: 2, family: g.family || 'generated', weight: 0.85 } as DvSetup)); // the hand-made set-ups lead
  return [...DV_SETUPS, ...kept];
}
export const setupOf = (id: string, lib: DvSetup[] = DV_SETUPS) => lib.find(s => s.id === id);

/** The improvising grammar: what the composer (stage.ts composeSpec) can stage. */
export const VOCAB: Vocab = {
  layouts: ['solo', 'pair', 'procession', 'pedestal', 'frame', 'rain', 'orbit', 'stair'],
  kinds: ['prop', 'word', 'label', 'number', 'shape', 'lamp', 'arrow'],
  shapes: ['star', 'moon', 'sun', 'cloud', 'arch', 'circle', 'ring', 'diamond', 'heart', 'frame', 'wave'],
  motions: ['drop', 'rise', 'swing', 'slide', 'flicker', 'unfurl', 'pop', 'grow'],
  tones: ['scarlet', 'gold', 'cream', 'brass', 'cobalt', 'parchment', 'navy', 'oxblood'],
  icons: PROP_NAMES,
  about: {
    solo: 'one big prop centre stage, small ones beside it',
    pair: 'two props side by side (this vs that)',
    procession: 'a row of props across the stage (a list or a sequence)',
    pedestal: 'the main prop on a column, others on the floor',
    frame: 'props in gilt frames on a wall',
    rain: 'props falling from above (many, chaos, abundance)',
    orbit: 'small props circling the main one (a network, a system)',
    stair: 'props on rising steps (growth, steps)',
  },
};
