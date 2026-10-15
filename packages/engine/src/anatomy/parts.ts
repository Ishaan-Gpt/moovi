/**
 * Anatomy's part library: every part a code-drawn isometric instrument built from many small solids (the skill's
 * "many small, precise, purposeful parts"): a base, its structure, its insides and a lid, each solid on another,
 * screws as dots, seams, vents, ticks, a screen drawn in the plane of its face. Parts sit centred on (0,0) of their
 * slot, inside LAYOUT.footprint, on z = 0 (the plate's top).
 *
 * Every solid carries an explode layer `ex` (0 stays down; 1, 2, 3 lift by MOTION.explode.gap each): the lid lifts
 * furthest, so an exploded part shows its insides (the skill's exploded view, vertical so nothing passes through).
 * Tones: lo = base, mid = structure, hi = the subject (lit when the camera watches it), acc = the brand's ink (one
 * small part), dark = glass / rubber / a chip's package.
 */
export const CORE_KINDS = ['server', 'database', 'phone', 'laptop', 'browser', 'card', 'chip', 'board', 'gear', 'motor', 'fan', 'battery', 'tower', 'cyclone', 'globe', 'pawn', 'crowd', 'package', 'conveyor', 'lock', 'hub', 'sensor', 'tank'] as const;
export type CoreKind = (typeof CORE_KINDS)[number];
/** every drawn part kind (the core 23 + the wider library in ./parts-more.ts) */
export const KINDS = [...CORE_KINDS, ...MORE_KINDS] as const;
export type Kind = CoreKind | MoreKind;

/** what each kind pictures (the planner's menu) */
const CORE_HINT: Record<CoreKind, string> = {
  server: 'a rack server (compute, hosting, a backend, an API)',
  database: 'stacked platters (data, storage, records, memory)',
  phone: 'a phone lying on its dock (a mobile app, notifications, a customer)',
  laptop: 'an open laptop (a developer, a workstation, writing code)',
  browser: 'a standing screen with a web page (a website, a dashboard, a preview)',
  card: 'a stack of sheets (a document, code files, an invoice, a form)',
  chip: 'a processor on its board (AI, compute, intelligence, speed)',
  board: 'a circuit board with parts (electronics, a controller, hardware)',
  gear: 'two meshing gears (automation, a process, a workflow)',
  motor: 'an electric motor (power, a drive, suction, torque)',
  fan: 'a fan in its frame (airflow, cooling, a purifier, an intake)',
  battery: 'a battery pack with cells (energy, run time, charging)',
  tower: 'a tall round device body with a filter and motor inside (a vacuum, purifier, speaker, bottle)',
  cyclone: 'a stepped cone of cyclones (separation, filtering, sorting)',
  globe: 'a globe with nodes (the internet, a global network, edge locations, regions)',
  pawn: 'one person (a user, a customer, a developer)',
  crowd: 'three people (a team, an audience, customers)',
  package: 'a carton with its contents (a product, a delivery, a release, a bundle)',
  conveyor: 'a belt with items on it (a pipeline, a queue, shipping, steps)',
  lock: 'a padlock (security, privacy, protection)',
  hub: 'a network switch with ports and antennas (connections, integrations, a router)',
  sensor: 'a lens / sensor head (a camera, detection, measuring, vision)',
  tank: 'a tank with a gauge (a reservoir, capacity, a bin, a container)',
};

import { MORE_HINT, MORE_KINDS, makeMore, type MoreKind } from './parts-more';
import { ball, box, cols, cyl, grid, rows, screws, type Part, type Prim, type Tone } from './prims';
export type { Part, Prim } from './prims';

type T = Tone;

function make(kind: CoreKind, brand: string): Part {
  const B = brand.toUpperCase().slice(0, 12);
  switch (kind) {
    case 'server': {
      const p = [
        box(-72, -62, 0, 144, 124, 14, 'lo', 0, 4, [screws()]),
        box(-62, -52, 14, 124, 104, 4, 'mid', 1, 2, [{ d: 'top', l: [[[0.1, 0.2], [0.5, 0.2], [0.5, 0.6], [0.9, 0.6]], [[0.1, 0.8], [0.3, 0.8], [0.3, 0.4]]], t: 'lo' }]),
        box(-48, -40, 18, 34, 34, 8, 'dark', 1, 2, [{ d: 'top', l: grid(3, 3), t: 'lo' }]),
        box(-4, -40, 18, 34, 34, 8, 'dark', 1, 2, [{ d: 'top', l: grid(3, 3), t: 'lo' }]),
        cyl(28, 26, 18, 18, 10, 'mid', 1, [{ d: 'spokes', n: 7, r0: 0.25, r1: 0.92, sweep: 28 }, { d: 'rings', r: [0.25] }], 24),
        box(-50, 10, 18, 52, 30, 12, 'acc', 2, 3, [{ d: 'top', l: cols(5, 0.05, 0.95, 0.15, 0.85), t: 'lo' }]),
        box(-72, -62, 18, 144, 124, 92, 'hi', 3, 4, [
          screws(0.05, 0.05), { d: 'top', l: [[[0.06, 0.5], [0.94, 0.5]]], t: 'faint' },
          { d: 'face', f: 'x', l: rows(9, 0.12, 0.88, 0.12, 0.88), t: 'lo' },
          { d: 'face', f: 'y', l: [[[0, 0.34], [1, 0.34]], [[0, 0.67], [1, 0.67]]], t: 'mid' },
          { d: 'quad', f: 'y', q: [0.08, 0.72, 0.5, 0.92], fill: 'dark' }, { d: 'quad', f: 'y', q: [0.08, 0.40, 0.5, 0.60], fill: 'dark' }, { d: 'quad', f: 'y', q: [0.08, 0.07, 0.5, 0.27], fill: 'dark' },
          { d: 'face', f: 'y', l: [[[0.82, 0.82], [0.83, 0.82]], [[0.82, 0.5], [0.83, 0.5]], [[0.82, 0.17], [0.83, 0.17]]], t: 'acc', w: 7 },
        ]),
      ];
      return { prims: p, fp: { w: 144, d: 124, h: 110 }, hero: 6, anchor: [0, 0, 110], layers: 3 };
    }
    case 'database': {
      const disc = (z: number, ex: number, t: T): Prim => cyl(0, 0, z, 64, 30, t, ex, [{ d: 'rings', r: [0.35, 0.7], t: 'faint' }, { d: 'seams', z: [0.5], t: 'faint' }], 40);
      const p = [cyl(0, 0, 0, 72, 10, 'lo', 0, [{ d: 'knurl', n: 24, z0: 0.2, z1: 0.8, t: 'faint' }], 40), disc(10, 0, 'mid'), disc(44, 1, 'mid'), disc(78, 2, 'hi'), cyl(0, 0, 108, 64, 6, 'mid', 3, [{ d: 'rings', r: [0.82], t: 'lo' }, { d: 'disc', r: 0.14, fill: 'acc' }], 40)];
      return { prims: p, fp: { w: 144, d: 144, h: 114 }, hero: 3, anchor: [0, 0, 114], layers: 3 };
    }
    case 'phone': {
      const p = [
        box(-62, -84, 0, 124, 168, 10, 'lo', 0, 14, [screws(0.08, 0.06)]),
        box(-46, -76, 10, 92, 152, 6, 'mid', 0, 12),
        box(-40, -66, 16, 80, 60, 10, 'acc', 1, 5, [{ d: 'top', l: rows(3, 0.1, 0.9, 0.1, 0.9), t: 'lo' }]),
        box(-40, 2, 16, 80, 54, 4, 'mid', 1, 3, [{ d: 'top', l: [[[0.1, 0.3], [0.6, 0.3], [0.6, 0.7]], [[0.2, 0.8], [0.9, 0.8]]], t: 'lo' }]),
        box(-24, 14, 20, 20, 20, 5, 'dark', 1, 2),
        box(-46, -76, 26, 92, 152, 8, 'hi', 3, 12, [{ d: 'quad', f: 'top', q: [0.07, 0.05, 0.93, 0.95], fill: 'screen', ui: true }, { d: 'dots', p: [[0.5, 0.03]], r: 1.6 }]),
      ];
      return { prims: p, fp: { w: 124, d: 168, h: 34 }, hero: 5, anchor: [0, 0, 34], layers: 3 };
    }
    case 'laptop': {
      const p = [
        box(-78, -50, 0, 156, 108, 10, 'lo', 0, 6, [screws(0.04, 0.06, 1.8)]),
        box(-72, -26, 10, 144, 60, 4, 'mid', 1, 3, [{ d: 'top', l: grid(12, 4), t: 'lo' }]),
        box(-24, 38, 10, 48, 16, 2, 'mid', 1, 2),
        box(-78, -58, 10, 156, 8, 104, 'hi', 2, 4, [{ d: 'quad', f: 'y', q: [0.06, 0.08, 0.94, 0.92], fill: 'screen', ui: true }, { d: 'face', f: 'y', l: [[[0.49, 0.96], [0.51, 0.96]]], t: 'lo', w: 4 }]),
      ];
      return { prims: p, fp: { w: 156, d: 116, h: 114 }, hero: 3, anchor: [0, -54, 100], layers: 2 };
    }
    case 'browser': {
      const p = [
        box(-50, -30, 0, 100, 64, 10, 'lo', 0, 8, [screws(0.1, 0.12, 1.8)]),
        box(-10, -14, 10, 20, 12, 46, 'mid', 0, 2, [{ d: 'face', f: 'y', l: [[[0.5, 0.1], [0.5, 0.9]]], t: 'faint' }]),
        box(-80, -26, 46, 160, 12, 124, 'hi', 1, 5, [
          { d: 'quad', f: 'y', q: [0.04, 0.05, 0.96, 0.84], fill: 'screen', ui: true },
          { d: 'face', f: 'y', l: [[[0.06, 0.92], [0.07, 0.92]], [[0.1, 0.92], [0.11, 0.92]], [[0.14, 0.92], [0.15, 0.92]]], t: 'acc', w: 6 },
          { d: 'face', f: 'y', l: [[[0.22, 0.92], [0.9, 0.92]]], t: 'lo', w: 3 },
        ]),
      ];
      return { prims: p, fp: { w: 160, d: 64, h: 170 }, hero: 2, anchor: [0, -14, 170], layers: 1 };
    }
    case 'card': {
      const sheet = (dx: number, z: number, ex: number, t: T, lines: boolean): Prim => box(-58 + dx, -72 + dx, z, 116, 144, 4, t, ex, 3, lines ? [{ d: 'top', l: [[[0.1, 0.1], [0.55, 0.1]], ...rows(6, 0.1, 0.9, 0.2, 0.8)], t: 'lo' }, { d: 'top', l: [[[0.1, 0.88], [0.4, 0.88]]], t: 'acc', w: 4 }] : []);
      const p = [box(-66, -80, 0, 132, 160, 8, 'lo', 0, 6, [screws(0.06, 0.05, 1.8)]), sheet(8, 8, 0, 'mid', false), sheet(4, 12, 1, 'mid', false), sheet(0, 16, 2, 'mid', true), sheet(-4, 20, 3, 'hi', true)];
      return { prims: p, fp: { w: 132, d: 160, h: 24 }, hero: 4, anchor: [0, 0, 24], layers: 3 };
    }
    case 'chip': {
      const pins: Prim[] = []; for (let i = 0; i < 6; i++) { const o = -38 + i * 15; pins.push(box(46, o - 3, 8, 12, 6, 4, 'mid', 1, 1), box(o - 3, 46, 8, 6, 12, 4, 'mid', 1, 1), box(-58, o - 3, 8, 12, 6, 4, 'mid', 1, 1), box(o - 3, -58, 8, 6, 12, 4, 'mid', 1, 1)); }
      const p = [
        box(-78, -78, 0, 156, 156, 8, 'lo', 0, 6, [screws(0.05, 0.05), { d: 'top', l: [[[0.05, 0.3], [0.2, 0.3], [0.25, 0.25]], [[0.95, 0.7], [0.8, 0.7], [0.75, 0.75]], [[0.3, 0.95], [0.3, 0.82]], [[0.7, 0.05], [0.7, 0.18]]], t: 'lo' }]),
        ...pins,
        box(-46, -46, 8, 92, 92, 12, 'dark', 1, 3, [{ d: 'top', l: grid(4, 4), t: 'lo' }]),
        box(-20, -20, 20, 40, 40, 5, 'acc', 2, 2, [{ d: 'top', l: grid(3, 3), t: 'lo' }]),
        box(-46, -46, 25, 92, 92, 9, 'hi', 3, 4, [{ d: 'text', u: 0.12, v: 0.55, s: 13, text: B, t: 'hi' }, { d: 'top', l: [[[0.12, 0.72], [0.6, 0.72]]], t: 'lo' }, { d: 'dots', p: [[0.12, 0.14]], r: 3, t: 'acc' }]),
      ];
      return { prims: p, fp: { w: 156, d: 156, h: 34 }, hero: p.length - 1, anchor: [0, 0, 34], layers: 3 };
    }
    case 'board': {
      const p = [
        box(-78, -66, 0, 156, 132, 6, 'mid', 0, 4, [screws(0.05, 0.06), { d: 'top', l: [[[0.1, 0.5], [0.4, 0.5], [0.45, 0.4], [0.9, 0.4]], [[0.1, 0.62], [0.5, 0.62], [0.55, 0.7], [0.9, 0.7]], [[0.6, 0.1], [0.6, 0.3]]], t: 'lo' }]),
        box(-56, -48, 6, 50, 50, 10, 'dark', 1, 2, [{ d: 'top', l: grid(3, 3), t: 'lo' }]),
        box(14, -50, 6, 36, 24, 8, 'dark', 1, 2),
        cyl(36, 30, 6, 12, 26, 'mid', 1, [{ d: 'rings', r: [0.5] }], 20), cyl(10, 36, 6, 9, 20, 'mid', 1, [], 18),
        box(-62, 22, 6, 40, 30, 18, 'hi', 2, 2, [{ d: 'face', f: 'y', l: cols(4, 0.1, 0.9, 0.3, 0.8), t: 'lo' }]),
        box(48, -10, 6, 14, 14, 6, 'acc', 2, 2),
      ];
      return { prims: p, fp: { w: 156, d: 132, h: 32 }, hero: 5, anchor: [-42, 37, 24], layers: 2 };
    }
    case 'gear': {
      const p = [
        box(-76, -70, 0, 152, 140, 16, 'lo', 0, 6, [screws(0.05, 0.05)]),
        cyl(-26, -18, 16, 8, 30, 'mid', 1, [], 16), cyl(46, 40, 16, 7, 30, 'mid', 1, [], 16),
        { k: 'gear', x: -26, y: -18, z: 22, r: 56, h: 16, teeth: 14, spin: 24, t: 'hi', ex: 2, deco: [{ d: 'spokes', n: 5, r0: 0.2, r1: 0.7 }, { d: 'rings', r: [0.2, 0.72], t: 'lo' }] } as Prim,
        { k: 'gear', x: 46, y: 40, z: 22, r: 34, h: 16, teeth: 9, spin: -37, t: 'mid', ex: 2, deco: [{ d: 'rings', r: [0.3], t: 'lo' }] } as Prim,
        cyl(-26, -18, 38, 10, 6, 'acc', 3, [], 16), cyl(46, 40, 38, 8, 6, 'mid', 3, [], 16),
      ];
      return { prims: p, fp: { w: 152, d: 140, h: 44 }, hero: 3, anchor: [-26, -18, 38], layers: 3 };
    }
    case 'motor': {
      const p = [
        box(-70, -56, 0, 140, 112, 14, 'lo', 0, 5, [screws(0.06, 0.08)]),
        box(-46, -40, 14, 92, 80, 12, 'mid', 0, 3),
        cyl(0, 0, 26, 40, 66, 'acc', 1, [{ d: 'knurl', n: 26, z0: 0.08, z1: 0.92, t: 'lo' }], 36),
        cyl(0, 0, 26, 12, 112, 'mid', 2, [{ d: 'seams', z: [0.85], t: 'lo' }], 20),
        cyl(0, 0, 26, 54, 80, 'hi', 3, [{ d: 'seams', z: [0.15, 0.85], t: 'lo' }, { d: 'knurl', n: 14, z0: 0.22, z1: 0.78, t: 'faint' }, { d: 'rings', r: [0.4, 0.75], t: 'faint' }, { d: 'disc', r: 0.18, fill: 'dark' }], 40),
      ];
      return { prims: p, fp: { w: 140, d: 112, h: 138 }, hero: 4, anchor: [0, 0, 106], layers: 3 };
    }
    case 'fan': {
      const p = [
        box(-76, -76, 0, 152, 152, 24, 'mid', 0, 10, [screws(0.07, 0.07, 2.6), { d: 'rings', r: [] }]),
        cyl(0, 0, 24, 18, 8, 'dark', 1, [], 20),
        { k: 'cyl', x: 0, y: 0, z: 24, r: 64, h: 4, t: 'acc', ex: 1, n: 40, spin: 160, deco: [{ d: 'spokes', n: 7, r0: 0.3, r1: 0.98, sweep: 40, t: 'lo' }] } as Prim,
        cyl(0, 0, 28, 22, 10, 'hi', 2, [{ d: 'rings', r: [0.5], t: 'lo' }], 24),
        cyl(0, 0, 38, 70, 4, 'mid', 3, [{ d: 'rings', r: [0.35, 0.55, 0.75, 0.92], t: 'lo' }, { d: 'spokes', n: 4, r0: 0.35, r1: 0.92, t: 'lo' }], 40),
      ];
      return { prims: p, fp: { w: 152, d: 152, h: 42 }, hero: 3, anchor: [0, 0, 42], layers: 3 };
    }
    case 'battery': {
      const p: Prim[] = [box(-70, -56, 0, 140, 112, 12, 'lo', 0, 6, [screws(0.05, 0.07)])];
      for (const [x, y] of [[-36, -22], [0, -22], [-36, 22], [36, -22], [0, 22], [36, 22]]) p.push(cyl(x!, y!, 12, 16, 70, 'acc', 1, [{ d: 'seams', z: [0.88], t: 'lo' }, { d: 'rings', r: [0.4], t: 'lo' }], 24));
      p.push(box(-62, -48, 12, 124, 96, 78, 'hi', 3, 6, [{ d: 'face', f: 'y', l: [[[0.08, 0.6], [0.92, 0.6]]], t: 'faint' }, { d: 'quad', f: 'y', q: [0.1, 0.25, 0.42, 0.48], fill: 'soft' }, { d: 'top', l: [[[0.22, 0.5], [0.34, 0.5]], [[0.28, 0.38], [0.28, 0.62]], [[0.66, 0.5], [0.78, 0.5]]], t: 'hi', w: 3 }]));
      p.push(cyl(-28, 0, 90, 9, 8, 'mid', 3, [], 16), cyl(28, 0, 90, 9, 8, 'mid', 3, [], 16));
      return { prims: p, fp: { w: 140, d: 112, h: 98 }, hero: 7, anchor: [0, 0, 98], layers: 3 };
    }
    case 'tower': {
      const p = [
        cyl(0, 0, 0, 66, 18, 'lo', 0, [{ d: 'knurl', n: 30, z0: 0.25, z1: 0.75, t: 'faint' }], 40),
        cyl(0, 0, 18, 30, 60, 'acc', 1, [{ d: 'knurl', n: 18, z0: 0.1, z1: 0.9, t: 'lo' }, { d: 'rings', r: [0.4] }], 28),
        cyl(0, 0, 78, 48, 50, 'mid', 2, [{ d: 'knurl', n: 34, z0: 0.06, z1: 0.94, t: 'lo' }, { d: 'rings', r: [0.6], t: 'lo' }], 36),
        cyl(0, 0, 18, 56, 160, 'hi', 3, [{ d: 'seams', z: [0.12, 0.5, 0.88], t: 'faint' }, { d: 'knurl', n: 10, z0: 0.18, z1: 0.44, t: 'faint' }, { d: 'rings', r: [0.7], t: 'lo' }, { d: 'disc', r: 0.4, fill: 'dark' }], 40),
        cyl(0, 0, 178, 22, 8, 'acc', 3, [{ d: 'rings', r: [0.5], t: 'lo' }], 24),
      ];
      return { prims: p, fp: { w: 132, d: 132, h: 186 }, hero: 3, anchor: [0, 0, 160], layers: 3 };
    }
    case 'cyclone': {
      const p: Prim[] = [cyl(0, 0, 0, 70, 12, 'lo', 0, [], 40)];
      [62, 52, 42, 32, 22].forEach((r, i) => p.push(cyl(0, 0, 12 + i * 26, r, 24, i === 4 ? 'acc' : i === 2 ? 'hi' : 'mid', Math.min(3, i), [{ d: 'seams', z: [0.5], t: 'faint' }, { d: 'rings', r: [0.75], t: 'faint' }], 36)));
      return { prims: p, fp: { w: 140, d: 140, h: 142 }, hero: 3, anchor: [0, 0, 90], layers: 3 };
    }
    case 'globe': {
      const p = [
        cyl(0, 0, 0, 60, 14, 'lo', 0, [{ d: 'rings', r: [0.6], t: 'faint' }], 40), cyl(0, 0, 14, 8, 40, 'mid', 0, [], 18),
        ball(0, 0, 112, 60, 'hi', 1),
        ball(-62, 30, 74, 9, 'acc', 2), ball(58, -30, 150, 9, 'acc', 2), ball(40, 50, 60, 8, 'acc', 2), ball(-40, -56, 168, 8, 'acc', 2),
      ];
      return { prims: p, fp: { w: 132, d: 132, h: 176 }, hero: 2, anchor: [0, 0, 150], layers: 2 };
    }
    case 'pawn': {
      const p = [cyl(0, 0, 0, 30, 10, 'lo', 0, [], 28), cyl(0, 0, 10, 20, 54, 'hi', 0, [{ d: 'seams', z: [0.7], t: 'faint' }], 28), ball(0, 0, 84, 19, 'mid', 0)];
      return { prims: p, fp: { w: 60, d: 60, h: 104 }, hero: 1, anchor: [0, 0, 104], layers: 0 };
    }
    case 'crowd': {
      const p: Prim[] = [];
      for (const [x, y, t] of [[-40, -36, 'mid'], [40, -26, 'mid'], [-6, 36, 'hi']] as [number, number, T][]) p.push(cyl(x, y, 0, 26, 8, 'lo', 0, [], 24), cyl(x, y, 8, 17, 48, t, 0, [{ d: 'seams', z: [0.7], t: 'faint' }], 24), ball(x, y, 74, 16, t === 'hi' ? 'acc' : 'mid', 0));
      return { prims: p, fp: { w: 140, d: 130, h: 92 }, hero: 7, anchor: [-6, 36, 92], layers: 0 };
    }
    case 'package': {
      const p = [
        box(-64, -56, 0, 128, 112, 8, 'lo', 0, 4, [screws(0.06, 0.07, 1.8)]),
        box(-58, -50, 8, 116, 100, 72, 'mid', 0, 2, [{ d: 'quad', f: 'y', q: [0.1, 0.18, 0.5, 0.55], fill: 'paper' }, { d: 'face', f: 'y', l: rows(3, 0.14, 0.44, 0.24, 0.5), t: 'lo' }, { d: 'face', f: 'x', l: [[[0.5, 0], [0.5, 1]]], t: 'faint' }]),
        box(-30, -26, 24, 60, 52, 50, 'acc', 1, 6, [{ d: 'top', l: [[[0.5, 0.1], [0.5, 0.9]]], t: 'lo' }]),
        box(-58, -50, 80, 116, 100, 6, 'hi', 3, 2, [{ d: 'top', l: [[[0.5, 0], [0.5, 1]]], t: 'acc', w: 5 }, { d: 'top', l: [[[0, 0.5], [0.42, 0.5]], [[0.58, 0.5], [1, 0.5]]], t: 'faint' }]),
      ];
      return { prims: p, fp: { w: 128, d: 112, h: 86 }, hero: 3, anchor: [0, 0, 86], layers: 3 };
    }
    case 'conveyor': {
      const p = [
        box(-78, -34, 0, 10, 10, 30, 'lo', 0, 2), box(68, -34, 0, 10, 10, 30, 'lo', 0, 2), box(-78, 24, 0, 10, 10, 30, 'lo', 0, 2), box(68, 24, 0, 10, 10, 30, 'lo', 0, 2),
        box(-80, -36, 30, 160, 72, 12, 'mid', 0, 10, [{ d: 'top', l: cols(14, 0.04, 0.96, 0.12, 0.88), t: 'lo' }, { d: 'face', f: 'y', l: [[[0.04, 0.5], [0.96, 0.5]]], t: 'faint' }]),
        box(-60, -22, 42, 40, 40, 30, 'hi', 1, 3, [{ d: 'top', l: [[[0.5, 0], [0.5, 1]]], t: 'acc', w: 4 }]),
        box(14, -20, 42, 36, 36, 26, 'mid', 1, 3, [{ d: 'top', l: [[[0.5, 0], [0.5, 1]]], t: 'lo' }]),
        cyl(66, 0, 42, 7, 4, 'acc', 2, [], 14),
      ];
      return { prims: p, fp: { w: 160, d: 72, h: 72 }, hero: 5, anchor: [-40, -2, 72], layers: 2 };
    }
    case 'lock': {
      const p = [
        box(-66, -40, 0, 132, 80, 10, 'lo', 0, 5, [screws(0.05, 0.1)]),
        cyl(-32, 0, 96, 9, 50, 'mid', 2, [{ d: 'seams', z: [0.9], t: 'faint' }], 18), cyl(32, 0, 96, 9, 50, 'mid', 2, [{ d: 'seams', z: [0.9], t: 'faint' }], 18),
        box(-41, -9, 146, 82, 18, 14, 'mid', 2, 9),
        box(-54, -24, 10, 108, 48, 88, 'hi', 0, 8, [{ d: 'quad', f: 'y', q: [0.43, 0.3, 0.57, 0.62], fill: 'dark' }, { d: 'face', f: 'y', l: [[[0.06, 0.88], [0.94, 0.88]], [[0.06, 0.12], [0.94, 0.12]]], t: 'faint' }, screws(0.06, 0.2, 2)]),
        cyl(0, 0, 98, 10, 4, 'acc', 1, [], 16),
      ];
      return { prims: p, fp: { w: 132, d: 80, h: 160 }, hero: 4, anchor: [0, 0, 98], layers: 2 };
    }
    case 'hub': {
      const ports = Array.from({ length: 6 }, (_, i) => ({ d: 'quad', f: 'y', q: [0.08 + i * 0.145, 0.25, 0.08 + i * 0.145 + 0.1, 0.65], fill: 'dark' }));
      const p = [
        box(-76, -46, 0, 152, 92, 8, 'lo', 0, 5, [screws(0.04, 0.08)]),
        box(-66, -36, 8, 132, 72, 4, 'mid', 1, 3, [{ d: 'top', l: [[[0.1, 0.3], [0.9, 0.3]], [[0.1, 0.7], [0.6, 0.7]]], t: 'lo' }]),
        box(-30, -20, 12, 40, 40, 8, 'dark', 1, 2, [{ d: 'top', l: grid(3, 3), t: 'lo' }]),
        box(-70, -40, 12, 140, 80, 28, 'hi', 3, 5, [...ports, { d: 'dots', p: [[0.12, 0.8], [0.2, 0.8], [0.28, 0.8], [0.36, 0.8]], r: 2.6, t: 'acc' }, { d: 'top', l: rows(5, 0.55, 0.92, 0.15, 0.85), t: 'faint' }]),
        cyl(-56, -28, 40, 4, 64, 'mid', 3, [], 12), cyl(56, -28, 40, 4, 64, 'mid', 3, [], 12),
      ];
      return { prims: p, fp: { w: 152, d: 92, h: 104 }, hero: 3, anchor: [0, 0, 40], layers: 3 };
    }
    case 'sensor': {
      const p = [
        box(-62, -50, 0, 124, 100, 12, 'lo', 0, 6, [screws(0.06, 0.08)]),
        box(-50, -40, 12, 100, 80, 56, 'mid', 0, 6, [{ d: 'face', f: 'x', l: rows(5, 0.15, 0.85, 0.2, 0.8), t: 'faint' }, { d: 'dots', p: [[0.12, 0.15]], r: 3, t: 'acc' }]),
        cyl(0, 0, 68, 36, 22, 'hi', 1, [{ d: 'knurl', n: 20, z0: 0.15, z1: 0.85, t: 'faint' }, { d: 'rings', r: [0.8, 0.62], t: 'lo' }], 36),
        cyl(0, 0, 90, 24, 10, 'dark', 2, [{ d: 'rings', r: [0.6], t: 'mid' }, { d: 'disc', r: 0.3, fill: 'acc' }], 30),
      ];
      return { prims: p, fp: { w: 124, d: 100, h: 100 }, hero: 2, anchor: [0, 0, 100], layers: 2 };
    }
    case 'tank': {
      const p = [
        cyl(0, 0, 0, 68, 12, 'lo', 0, [], 40),
        cyl(0, 0, 12, 46, 70, 'acc', 1, [{ d: 'seams', z: [0.5], t: 'lo' }], 36),
        cyl(0, 0, 12, 58, 120, 'hi', 2, [{ d: 'seams', z: [0.1, 0.9], t: 'faint' }, { d: 'knurl', n: 6, z0: 0.2, z1: 0.8, t: 'faint' }, { d: 'rings', r: [0.85, 0.3], t: 'lo' }], 40),
        cyl(24, -10, 132, 14, 10, 'mid', 3, [{ d: 'disc', r: 0.6, fill: 'soft' }, { d: 'spokes', n: 1, r0: 0, r1: 0.5, a: 220, t: 'acc' }], 20),
      ];
      return { prims: p, fp: { w: 136, d: 136, h: 142 }, hero: 2, anchor: [0, 0, 132], layers: 3 };
    }
  }
}

/** what each kind pictures (the planner's menu) */
export const KIND_HINT: Record<Kind, string> = { ...CORE_HINT, ...MORE_HINT };
export const isKind = (k: string): k is Kind => (KINDS as readonly string[]).includes(k);

/** One part by kind (unknown kinds become a server; every part is deep-copied so a film can't mutate the library). */
export function part(kind: string, brand: string): Part {
  const k = isKind(kind) ? kind : 'server';
  const p = (CORE_KINDS as readonly string[]).includes(k) ? make(k as CoreKind, brand) : makeMore(k as MoreKind);
  return JSON.parse(JSON.stringify(p)) as Part;
}
