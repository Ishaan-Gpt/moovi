/**
 * Anatomy's library: the FIGURES a film is cast from, section by section. A template drew one figure (a bench of
 * parts); the style draws whichever technical figure the line needs: an exploded stack for what is inside, a process
 * line for steps, a hub for a network, a scale comparison for a number, twin plates for before/after, a detail circle
 * for the one thing that matters, a readout for a measurement... Each figure type has a layout in ./figures.ts and is
 * drawn by the same isometric renderer (./iso.ts); its variants are set-ups the kit's cast() picks between by need,
 * slot fit, the film's own variety and the style's recent films. Improvised set-ups (the kit's improvise(), drawn by
 * the composer in ./figures.ts) and improvised parts (./improv.ts) are kept with grow() and join this library.
 */
import type { Setup } from '../styles/kit/library';
import type { Vocab } from '../styles/kit/compose';
import { KINDS } from './parts';
import { PRIMS } from './improv';

export const FIGURES = ['bench', 'stack', 'cutaway', 'pipeline', 'hub', 'loop', 'tower', 'grid', 'scale', 'twin', 'macro', 'blueprint', 'assembly', 'rack', 'mesh', 'funnel', 'timeline', 'split', 'tree', 'turntable', 'gauge', 'columns', 'composed'] as const;
export type Figure = (typeof FIGURES)[number];

/** the drawing's caption, top right (with the section's subject) */
export const FIGURE_TITLE: Record<Figure, string> = {
  bench: 'General arrangement', stack: 'Exploded stack', cutaway: 'Section A-A', pipeline: 'Process line', hub: 'Hub and spokes', loop: 'Cycle',
  tower: 'Levels', grid: 'Array', scale: 'Scale', twin: 'Before / after', macro: 'Detail A', blueprint: 'Dimensions', assembly: 'Assembly sequence',
  rack: 'Rack elevation', mesh: 'Network', funnel: 'Filter stages', timeline: 'Timeline', split: 'Split flow', tree: 'Hierarchy', turntable: 'Turntable',
  gauge: 'Readout', columns: 'Columns', composed: 'Schematic',
};

export interface AnSetup extends Setup {
  figure: Figure;
  variant: string;
  /** how many distinct named parts it shows well [min, max] (fewer are topped up / replicated) */
  parts: [number, number];
}

const S = (id: string, figure: Figure, variant: string, about: string, needs: AnSetup['needs'], parts: [number, number], o: Partial<AnSetup> = {}): AnSetup =>
  ({ id, name: id, figure, variant, about, needs, parts, family: figure, seconds: [2.4, 12], ...o });

export const SETUPS: AnSetup[] = [
  S('bench-pair', 'bench', 'cols2', 'parts on a bench plate, linked by pipes (general arrangement)', ['product', 'process', 'connect', 'flow', 'benefit'], [2, 4], { weight: 0.92 }),
  S('bench-machine', 'bench', 'cols3', 'a whole machine of 4-6 parts on one plate, pipes between them', ['process', 'flow', 'network', 'product', 'success'], [4, 6], { items: [4, 6], weight: 0.92 }),
  S('bench-recap', 'bench', 'recap', 'every part from the film reassembled on one plate: the whole system', ['payoff', 'success', 'brand', 'network', 'cta'], [1, 6], { roles: ['close'], weight: 1.1 }),
  S('stack-spread', 'stack', 'spread', 'parts stacked on one axis that spread apart on the word: what is inside, layer by layer', ['layers', 'hidden', 'product', 'process', 'build'], [3, 5], { items: [3, 5] }),
  S('stack-spine', 'stack', 'spine', 'a layer stack on a central spine with guide lines (a technical exploded view)', ['layers', 'hierarchy', 'data', 'ai', 'hidden'], [3, 4], { items: [3, 4] }),
  S('cutaway-shell', 'cutaway', 'shell', 'a ghosted housing with the working parts inside it, a hatched cut face', ['hidden', 'process', 'product', 'reason', 'layers'], [2, 4], { items: [2, 4] }),
  S('cutaway-open', 'cutaway', 'open', 'one part sliced open on a section plane, its insides lifted and named', ['hidden', 'product', 'focus', 'reveal', 'reason'], [1, 2]),
  S('line-belt', 'pipeline', 'belt', 'parts in a row on a conveyor, packets moving down the line', ['steps', 'process', 'flow', 'build', 'speed'], [3, 5], { items: [3, 5] }),
  S('line-zigzag', 'pipeline', 'zigzag', 'a process that turns back on itself in two rows, piped in order', ['steps', 'process', 'timeline', 'flow'], [4, 6], { items: [4, 6] }),
  S('hub-ring', 'hub', 'ring', 'one centre part with satellites on a ring, wires carrying packets out and back', ['network', 'connect', 'global', 'people', 'brand'], [3, 6], { items: [3, 6] }),
  S('hub-star', 'hub', 'star', 'a centre part with three spokes, each a wire with packets', ['connect', 'ai', 'data', 'answer', 'reveal'], [3, 4], { items: [3, 4] }),
  S('loop-ring', 'loop', 'ring', 'parts on a circular track, particles going round: a cycle', ['cycle', 'process', 'steps', 'growth', 'time'], [3, 5], { items: [3, 5] }),
  S('loop-orbit', 'loop', 'orbit', 'parts orbiting a centre one notch per beat', ['cycle', 'ai', 'connect', 'growth', 'calm'], [2, 5]),
  S('tower-two', 'tower', 'two', 'two platform levels, the lower carries the upper, flow rising between them', ['layers', 'hierarchy', 'build', 'reason', 'data'], [2, 4]),
  S('tower-three', 'tower', 'three', 'three platform levels on columns, a part per level, packets climbing', ['layers', 'growth', 'ranking', 'hierarchy', 'stakes'], [3, 6], { items: [3, 6] }),
  S('grid-crowd', 'grid', 'crowd', 'a grid of many people, one lit in the brand ink', ['people', 'scale', 'global', 'voices', 'number'], [1, 2], { number: 'optional' }),
  S('grid-city', 'grid', 'city', 'a city block of buildings, one marked', ['location', 'global', 'scale', 'home', 'people'], [1, 2], { number: 'optional' }),
  S('grid-fleet', 'grid', 'fleet', 'many identical units in a grid (a fleet, a farm of servers), one lit', ['scale', 'number', 'growth', 'network', 'data'], [1, 2], { number: 'optional' }),
  S('scale-pair', 'scale', 'pair', 'a tiny version beside a huge one, with dimension lines', ['scale', 'compare', 'number', 'stakes', 'contrast'], [1, 2], { number: 'optional' }),
  S('scale-steps', 'scale', 'steps', 'the same part in three sizes, rising, a dashed trend over them', ['growth', 'scale', 'number', 'stakes', 'success'], [1, 1], { number: 'optional' }),
  S('twin-before', 'twin', 'before', 'two plates: the old way scattered and grey, the new way tidy and lit', ['before-after', 'contrast', 'problem', 'chaos', 'calm'], [2, 6], { items: [2, 6] }),
  S('twin-versus', 'twin', 'versus', 'two plates head to head, A versus B', ['compare', 'choice', 'contrast', 'speed', 'money'], [2, 4], { items: [2, 4] }),
  S('macro-detail', 'macro', 'detail', 'one part with a magnified detail circle on the thing that matters', ['focus', 'hidden', 'product', 'idea', 'proof'], [1, 2]),
  S('macro-sweep', 'macro', 'sweep', 'a detail circle that moves across a part, from one feature to the next', ['focus', 'list', 'product', 'build', 'proof'], [1, 2]),
  S('print-dims', 'blueprint', 'dims', 'one part on grid paper with dimension lines and a title block', ['product', 'build', 'tool', 'focus', 'number'], [1, 2], { number: 'optional' }),
  S('print-plan', 'blueprint', 'plan', 'a near top-down plan of 2-4 parts with footprints and spacing dimensions', ['build', 'layers', 'simplify', 'location', 'steps'], [2, 4], { items: [2, 4] }),
  S('assembly-slide', 'assembly', 'slide', 'parts slide in one by one and lock into one product, a housing drops over', ['build', 'reveal', 'product', 'simplify', 'brand'], [2, 4], { items: [2, 4] }),
  S('assembly-converge', 'assembly', 'converge', 'parts converge from the corners into one block on the word', ['connect', 'build', 'simplify', 'success', 'answer'], [2, 4], { items: [3, 4] }),
  S('rack-row', 'rack', 'row', 'a row of rack cabinets filling with units, each labelled', ['data', 'scale', 'security', 'ai', 'tool'], [1, 3]),
  S('rack-single', 'rack', 'single', 'one tall cabinet with its shelves of parts', ['layers', 'data', 'tool', 'hidden', 'security'], [2, 4]),
  S('mesh-net', 'mesh', 'net', 'parts linked by many wires, packets travelling between them', ['network', 'connect', 'global', 'voices', 'flow'], [4, 6], { items: [3, 6] }),
  S('mesh-tangle', 'mesh', 'tangle', 'a tangle of crossing wires between parts: the mess', ['chaos', 'problem', 'voices', 'stakes', 'warning'], [3, 6], { items: [3, 6] }),
  S('funnel-cascade', 'funnel', 'cascade', 'stages stepping down, the stream thinning at each', ['simplify', 'focus', 'process', 'decline', 'steps'], [2, 4], { items: [2, 4] }),
  S('funnel-sieve', 'funnel', 'sieve', 'sieve plates stacked, particles falling through to one part', ['simplify', 'data', 'focus', 'security', 'ai'], [1, 3]),
  S('time-rail', 'timeline', 'rail', 'milestones on a rail, a cursor sliding to each', ['timeline', 'steps', 'time', 'growth', 'build'], [3, 5], { items: [3, 5] }),
  S('time-day', 'timeline', 'day', 'a day on a rail from a clock: moments in order', ['time', 'timeline', 'steps', 'people', 'calm'], [2, 4]),
  S('split-fork', 'split', 'fork', 'one source forking into two or three outputs', ['flow', 'choice', 'connect', 'global', 'data'], [3, 4], { items: [3, 4] }),
  S('split-merge', 'split', 'merge', 'several sources merging into one', ['connect', 'simplify', 'data', 'answer', 'brand'], [3, 4], { items: [3, 4] }),
  S('tree-org', 'tree', 'org', 'a hierarchy from one root to branches to people', ['hierarchy', 'people', 'ranking', 'layers', 'network'], [2, 4], { items: [2, 4] }),
  S('tree-branch', 'tree', 'branch', 'one root branching into parts and their copies', ['hierarchy', 'growth', 'scale', 'connect', 'build'], [2, 4], { items: [2, 4] }),
  S('table-hero', 'turntable', 'hero', 'one hero object large on a turntable, the camera circling it', ['product', 'reveal', 'brand', 'hook', 'payoff'], [1, 1], { roles: ['open', 'middle', 'close'], weight: 1.05 }),
  S('table-explode', 'turntable', 'explode', 'the hero on a turntable opening up, its companions round the rim', ['product', 'hidden', 'layers', 'reveal', 'hook'], [1, 4]),
  S('gauge-dials', 'gauge', 'dials', 'a console of dials and a readout, needles swinging to the value', ['number', 'speed', 'time', 'percent', 'proof'], [0, 2], { number: 'optional' }),
  S('gauge-meter', 'gauge', 'meter', 'one big dial beside rising bars', ['speed', 'growth', 'success', 'number', 'money'], [0, 2], { number: 'optional' }),
  S('cols-rise', 'columns', 'rise', 'an isometric column chart rising, the part on the tallest', ['growth', 'number', 'data', 'success', 'money'], [0, 1], { number: 'optional' }),
  S('cols-fall', 'columns', 'fall', 'columns stepping down: what shrinks', ['decline', 'money', 'stakes', 'problem', 'time'], [0, 1], { number: 'optional' }),
];

export const setupOf = (id: string) => SETUPS.find(s => s.id === id);

/** The improvising vocabulary (the kit's improvise()): figures from layouts + parts + primitives, never coordinates. */
export const VOCAB: Vocab = {
  layouts: ['row', 'ring', 'stack', 'grid', 'pair', 'column', 'scatter', 'orbit', 'hero'],
  kinds: ['part', 'shape', 'label', 'number', 'arrow', 'pipe', 'dimension'],
  shapes: [...PRIMS],
  motions: ['drop', 'slide', 'rise', 'explode', 'flow', 'spin', 'grow'],
  tones: ['hi', 'mid', 'acc', 'lo', 'dark'],
  icons: [...KINDS],
  about: {
    row: 'parts side by side along a line', ring: 'parts on a circle', stack: 'parts stacked on one axis', grid: 'many parts in a grid', pair: 'two things compared',
    column: 'parts rising in a column', scatter: 'parts spread loosely', orbit: 'parts round a centre one', hero: 'one big thing',
  },
};
