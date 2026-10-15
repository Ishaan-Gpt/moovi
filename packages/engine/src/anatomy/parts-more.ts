/**
 * Anatomy's wider part library: everyday products, vehicles, buildings, money, nature, medical, retail and factory
 * kit, in the same isometric grammar as ./parts.ts (many small solids, a base, structure, insides, a lid; one small
 * brand-ink element; screens, vents, dials and seams drawn in the plane of their face). Parts sit centred on their
 * slot's origin inside a 160 x 160 footprint on z = 0. Explode layers `ex`: the shell lifts, the insides show.
 */
import { ball, box, cols, cone, cyl, disc, grid, hcyl, prism, ring, rows, screws, type Part, type Prim } from './prims';

export const MORE_KINDS = [
  // devices + wearables
  'watch', 'earbuds', 'headphones', 'speaker', 'camera', 'tablet', 'keyboard', 'drone', 'robot', 'printer', 'lamp', 'bulb',
  // home + kitchen + nature
  'kettle', 'mug', 'blender', 'fridge', 'washer', 'plant', 'tree', 'bottle',
  // vehicles
  'car', 'truck', 'scooter', 'plane', 'rocket', 'container',
  // buildings
  'house', 'shop', 'factory', 'office', 'warehouse',
  // money + paperwork + signals
  'coin', 'cash', 'wallet', 'creditcard', 'chart', 'clock', 'calendar', 'mail', 'chat', 'bell', 'book',
  'target', 'trophy', 'alert', 'search', 'shield', 'key',
  // health
  'pill', 'heart', 'medkit',
  // retail
  'cart', 'bag', 'pos', 'shelf',
  // factory + energy
  'crate', 'solar', 'turbine', 'silo', 'valve',
] as const;
export type MoreKind = (typeof MORE_KINDS)[number];

export const MORE_HINT: Record<MoreKind, string> = {
  watch: 'a wristwatch / smartwatch (wearables, time, health tracking)', earbuds: 'earbuds in their charging case (audio, wearables)',
  headphones: 'over-ear headphones (audio, listening, focus)', speaker: 'a speaker cabinet with drivers (sound, voice, a smart speaker)',
  camera: 'a photo camera with its lens (photos, video, capture, creators)', tablet: 'a tablet with its insides (an app, reading, a POS screen)',
  keyboard: 'a keyboard (typing, writing, input, work)', drone: 'a quadcopter drone (delivery, aerial, inspection, autonomy)',
  robot: 'an industrial robot arm (automation, manufacturing, AI that acts)', printer: 'a 3D printer printing a part (making, prototyping, manufacturing)',
  lamp: 'a desk lamp (light, focus, home)', bulb: 'a light bulb (an idea, insight, energy)',
  kettle: 'an electric kettle (kitchen, heating, home appliance)', mug: 'a coffee cup on a saucer (coffee, a break, a cafe, a habit)',
  blender: 'a blender with its blades (kitchen, mixing, food)', fridge: 'a refrigerator with shelves inside (food, storage, cold, groceries)',
  washer: 'a washing machine with its drum (laundry, home, cleaning)', plant: 'a potted plant (growth, nature, wellbeing, care)',
  tree: 'a tree (nature, sustainability, a forest, growth over time)', bottle: 'a bottle with its liquid and cap (drinks, skincare, a consumer product)',
  car: 'a car with its engine (driving, mobility, rides, the road)', truck: 'a delivery truck with goods (logistics, shipping, fleet)',
  scooter: 'an electric scooter (micromobility, city travel, commuting)', plane: 'an airliner (travel, flights, global reach)',
  rocket: 'a rocket on its pad (launch, speed, growth, ambition)', container: 'a shipping container with cargo (supply chain, trade, freight)',
  house: 'a house with a gable roof (home, real estate, a household, living)', shop: 'a storefront with an awning (a store, retail, local business)',
  factory: 'a factory hall with a chimney (manufacturing, production, industry)', office: 'an office tower (a company, enterprise, HQ, finance)',
  warehouse: 'a warehouse with loading doors (fulfilment, inventory, storage)',
  coin: 'stacks of coins (money, savings, pricing, rewards)', cash: 'a banded stack of banknotes (cash, payouts, revenue)',
  wallet: 'a wallet with cards (payments, spending, a customer\'s money)', creditcard: 'two payment cards with a chip (cards, checkout, payments)',
  chart: 'a small bar chart rising (growth, analytics, metrics, results)', clock: 'a clock with its gears inside (time, speed, schedules, hours)',
  calendar: 'a calendar pad (dates, scheduling, bookings, planning)', mail: 'envelopes (email, messages, newsletters, invoices)',
  chat: 'speech bubbles (chat, support, conversations, feedback)', bell: 'a bell (notifications, alerts, reminders)',
  book: 'a stack of books (learning, docs, knowledge, a course)', target: 'a target with an arrow (goals, accuracy, focus, marketing)',
  trophy: 'a trophy (winning, success, awards, the best)', alert: 'a warning beacon (a problem, risk, incidents, danger)',
  search: 'a magnifying glass over a page (search, discovery, inspection)', shield: 'a shield (protection, security, insurance, trust)',
  key: 'a key (access, passwords, ownership, unlocking)', pill: 'a pill bottle and capsules (medicine, pharmacy, health)',
  heart: 'a heart-rate monitor with a pulse line (health, vitals, care, a clinic)', medkit: 'a first-aid kit (care, safety, healthcare)',
  cart: 'a shopping cart full of goods (ecommerce, shopping, orders)', bag: 'a shopping bag (retail, a purchase, fashion)',
  pos: 'a card terminal on a counter (checkout, point of sale, payments in store)', shelf: 'a store shelf of products (retail, catalogue, inventory)',
  crate: 'a crate on a pallet with goods inside (shipping, wholesale, packaging)', solar: 'solar panels (clean energy, power, sustainability)',
  turbine: 'a wind turbine (renewable energy, power, climate)', silo: 'storage silos (raw materials, agriculture, bulk storage)',
  valve: 'a pipe with a valve and handwheel (control, flow, plumbing, utilities)',
};

type P = Prim[];
const R = (prims: P, w: number, d: number, h: number, hero: number, anchor: [number, number, number], layers: number): Part => ({ prims, fp: { w, d, h }, hero, anchor, layers });
/** half a disc (an arched roof), u in [-r, r], v ≥ 0 */
const arch = (r: number, n = 14) => Array.from({ length: n + 1 }, (_, i) => { const a = Math.PI * i / n; return [r * Math.cos(a), r * Math.sin(a)]; });

export function makeMore(kind: MoreKind): Part {
  switch (kind) {
    case 'watch': return R([
      box(-20, -78, 0, 40, 156, 6, 'dark', 0, 10, [{ d: 'top', l: rows(5, 0.3, 0.7, 0.04, 0.26), t: 'lo' }]),
      cyl(0, 0, 6, 46, 8, 'lo', 0, [], 40),
      cyl(0, 0, 14, 36, 10, 'acc', 1, [{ d: 'rings', r: [0.55], t: 'lo' }, { d: 'spokes', n: 8, r0: 0.25, r1: 0.85, t: 'lo' }], 36),
      cyl(0, 0, 14, 44, 16, 'hi', 2, [{ d: 'disc', r: 0.84, fill: 'dark' }, { d: 'spokes', n: 12, r0: 0.66, r1: 0.76, t: 'line' }, { d: 'spokes', n: 1, r0: 0, r1: 0.42, a: 220, t: 'line' }, { d: 'spokes', n: 1, r0: 0, r1: 0.6, a: 300, t: 'acc' }], 40),
      hcyl(48, 0, 22, 6, 10, 'x', 'mid', 2),
    ], 104, 156, 30, 3, [0, 0, 30], 2);
    case 'earbuds': return R([
      box(-56, -38, 0, 112, 76, 40, 'mid', 0, 34, [{ d: 'face', f: 'y', l: [[[0.5, 0.5], [0.52, 0.5]]], t: 'acc', w: 7 }]),
      ball(-24, 0, 32, 15, 'hi', 1), cyl(-24, 0, 14, 6, 18, 'hi', 1, [], 14), ball(24, 0, 32, 15, 'hi', 1), cyl(24, 0, 14, 6, 18, 'hi', 1, [], 14),
      box(-56, -38, 40, 112, 76, 16, 'hi', 3, 34, [{ d: 'top', l: [[[0.12, 0.5], [0.88, 0.5]]], t: 'faint' }]),
    ], 112, 76, 56, 5, [0, 0, 56], 3);
    case 'headphones': return R([
      cyl(-46, 0, 0, 30, 26, 'hi', 0, [{ d: 'rings', r: [0.72], t: 'faint' }, { d: 'disc', r: 0.42, fill: 'dark' }], 32),
      cyl(46, 0, 0, 30, 26, 'hi', 0, [{ d: 'rings', r: [0.72], t: 'faint' }, { d: 'disc', r: 0.42, fill: 'dark' }], 32),
      cyl(-46, 0, 26, 24, 6, 'acc', 1, [{ d: 'rings', r: [0.5], t: 'lo' }], 28), cyl(46, 0, 26, 24, 6, 'acc', 1, [{ d: 'rings', r: [0.5], t: 'lo' }], 28),
      box(-50, -5, 32, 8, 10, 46, 'mid', 2, 2), box(42, -5, 32, 8, 10, 46, 'mid', 2, 2),
      box(-52, -9, 78, 104, 18, 10, 'mid', 2, 8, [{ d: 'top', l: [[[0.08, 0.5], [0.92, 0.5]]], t: 'faint' }]),
    ], 152, 60, 88, 6, [0, 0, 88], 2);
    case 'speaker': return R([
      box(-52, -46, 0, 104, 92, 8, 'lo', 0, 10, [screws(0.06, 0.07)]),
      cyl(0, 0, 8, 30, 70, 'acc', 1, [{ d: 'rings', r: [0.5], t: 'lo' }, { d: 'knurl', n: 14, t: 'lo' }], 28),
      box(-46, -40, 8, 92, 80, 140, 'hi', 2, 10, [
        { d: 'face', f: 'y', l: [ring(0.5, 0.3, 0.33, 0.17)], t: 'mid', w: 2.4 }, { d: 'face', f: 'y', l: [ring(0.5, 0.3, 0.12, 0.06)], t: 'lo' },
        { d: 'face', f: 'y', l: [ring(0.5, 0.72, 0.2, 0.1)], t: 'mid', w: 2 }, { d: 'face', f: 'x', l: rows(10, 0.2, 0.8, 0.1, 0.9), t: 'faint' }]),
      box(-46, -40, 148, 92, 80, 6, 'mid', 3, 10, [{ d: 'dots', p: [[0.3, 0.5], [0.5, 0.5], [0.7, 0.5]], r: 3, t: 'acc' }]),
    ], 104, 92, 154, 2, [0, 0, 154], 3);
    case 'camera': return R([
      box(-30, -20, 8, 50, 30, 40, 'dark', 1, 4, [{ d: 'top', l: grid(3, 3), t: 'line' }]),
      box(-64, -36, 0, 128, 72, 70, 'hi', 2, 10, [{ d: 'face', f: 'x', l: rows(3, 0.2, 0.8, 0.3, 0.7), t: 'faint' }, { d: 'face', f: 'y', l: [[[0.04, 0.82], [0.96, 0.82]]], t: 'faint' }]),
      box(-16, -26, 70, 40, 44, 22, 'mid', 3, 4, [{ d: 'face', f: 'y', l: [[[0.2, 0.5], [0.8, 0.5]]], t: 'faint' }]),
      cyl(-42, -10, 70, 12, 10, 'acc', 3, [{ d: 'knurl', n: 12, t: 'lo' }], 20),
      hcyl(6, 56, 34, 28, 40, 'y', 'mid', 2, 0.62),
    ], 128, 112, 92, 1, [0, 0, 92], 3);
    case 'tablet': return R([
      box(-74, -56, 0, 148, 112, 6, 'lo', 0, 12, [screws(0.05, 0.06, 1.8)]),
      box(-62, -48, 6, 124, 96, 4, 'mid', 1, 8, [{ d: 'top', l: [[[0.1, 0.3], [0.5, 0.3], [0.5, 0.7]], [[0.6, 0.2], [0.9, 0.2]]], t: 'lo' }]),
      box(-46, -30, 10, 32, 26, 5, 'dark', 1, 2), box(4, -36, 10, 50, 72, 6, 'acc', 1, 4, [{ d: 'top', l: rows(3, 0.1, 0.9, 0.1, 0.9), t: 'lo' }]),
      box(-70, -52, 16, 140, 104, 7, 'hi', 3, 12, [{ d: 'quad', f: 'top', q: [0.06, 0.07, 0.94, 0.93], fill: 'screen', ui: true }]),
    ], 148, 112, 24, 4, [0, 0, 24], 3);
    case 'keyboard': return R([
      box(-80, -42, 0, 160, 84, 12, 'mid', 0, 8, [{ d: 'face', f: 'y', l: [[[0.04, 0.5], [0.96, 0.5]]], t: 'faint' }]),
      box(-74, -36, 12, 148, 72, 4, 'dark', 1, 4, [{ d: 'top', l: grid(14, 4), t: 'lo' }]),
      box(-44, 16, 16, 76, 12, 6, 'hi', 2, 3), box(46, -30, 16, 20, 14, 6, 'acc', 2, 3), box(-70, -30, 16, 18, 14, 6, 'hi', 2, 3),
    ], 160, 84, 22, 2, [0, 0, 22], 2);
    case 'drone': {
      const p: P = [box(-22, -32, 0, 4, 64, 14, 'lo', 0, 2), box(18, -32, 0, 4, 64, 14, 'lo', 0, 2), ball(0, 0, 10, 9, 'dark', 0),
        box(-60, -5, 22, 120, 10, 6, 'mid', 1, 3), box(-5, -60, 22, 10, 120, 6, 'mid', 1, 3)];
      for (const [x, y] of [[-58, 0], [0, -58], [58, 0], [0, 58]] as const) p.push(cyl(x, y, 28, 6, 8, 'dark', 1, [], 14), { k: 'cyl', x, y, z: 36, r: 20, h: 2, t: 'mid', ex: 2, n: 28, spin: 720, deco: [{ d: 'spokes', n: 2, r0: 0.05, r1: 1, t: 'lo' }] });
      p.push(box(-26, -26, 14, 52, 52, 20, 'hi', 3, 10, [{ d: 'top', l: [[[0.2, 0.5], [0.8, 0.5]]], t: 'faint' }, { d: 'dots', p: [[0.5, 0.25]], r: 3.4, t: 'acc' }]));
      return R(p, 156, 156, 40, p.length - 1, [0, 0, 34], 3);
    }
    case 'robot': return R([
      cyl(0, 0, 0, 50, 14, 'lo', 0, [{ d: 'rings', r: [0.72], t: 'faint' }], 36), cyl(0, 0, 14, 32, 26, 'mid', 1, [{ d: 'knurl', n: 16, t: 'faint' }], 30),
      box(-14, -14, 40, 28, 28, 82, 'hi', 2, 6, [{ d: 'face', f: 'y', l: [[[0.5, 0.1], [0.5, 0.9]]], t: 'faint' }]),
      hcyl(0, 0, 126, 16, 34, 'y', 'acc', 2),
      box(-12, -10, 116, 94, 20, 20, 'hi', 3, 6, [{ d: 'face', f: 'y', l: [[[0.1, 0.5], [0.9, 0.5]]], t: 'faint' }]),
      cyl(70, 0, 82, 9, 34, 'mid', 3, [], 16), box(62, -10, 70, 6, 20, 12, 'dark', 3, 2), box(76, -10, 70, 6, 20, 12, 'dark', 3, 2),
    ], 100, 100, 142, 4, [30, 0, 136], 3);
    case 'printer': {
      const post = (x: number, y: number) => box(x, y, 14, 10, 10, 150, 'mid', 0, 2);
      return R([
        box(-72, -72, 0, 144, 144, 14, 'lo', 0, 8, [screws()]), post(-72, -72), post(62, -72), post(-72, 62),
        box(-50, -50, 40, 100, 100, 6, 'hi', 1, 4, [{ d: 'top', l: grid(6, 6), t: 'faint' }]), cone(0, 0, 46, 26, 12, 50, 'acc', 1, [{ d: 'seams', z: [0.3, 0.6], t: 'lo' }]),
        box(-62, -6, 122, 124, 12, 10, 'mid', 2, 3), box(-12, -14, 104, 24, 28, 26, 'dark', 2, 4), cone(0, 0, 96, 5, 1.5, 8, 'acc', 2, [], 12),
        post(62, 62), box(-72, -72, 164, 144, 10, 8, 'mid', 3, 2), box(-72, -72, 164, 10, 144, 8, 'mid', 3, 2), box(62, -72, 164, 10, 144, 8, 'mid', 3, 2), box(-72, 62, 164, 144, 10, 8, 'mid', 3, 2),
      ], 144, 144, 172, 5, [0, 0, 96], 3);
    }
    case 'lamp': return R([
      cyl(0, 0, 0, 40, 10, 'mid', 0, [{ d: 'rings', r: [0.6], t: 'faint' }], 36), cyl(0, 0, 10, 5, 84, 'lo', 0, [], 14),
      ball(0, 0, 100, 14, 'acc', 1), cone(0, 0, 90, 48, 24, 46, 'hi', 2, [{ d: 'seams', z: [0.15], t: 'faint' }, { d: 'disc', r: 0.5, fill: 'dark' }]),
    ], 96, 96, 136, 3, [0, 0, 136], 2);
    case 'bulb': return R([
      cyl(0, 0, 0, 32, 8, 'lo', 0, [], 28), cyl(0, 0, 8, 18, 30, 'mid', 0, [{ d: 'knurl', n: 10, t: 'lo' }, { d: 'seams', z: [0.33, 0.66], t: 'lo' }], 24),
      cone(0, 0, 38, 18, 26, 10, 'acc', 1, [], 24), ball(0, 0, 86, 42, 'hi', 2),
    ], 84, 84, 128, 3, [0, 0, 120], 2);
    case 'kettle': return R([
      cyl(0, 0, 0, 58, 10, 'lo', 0, [{ d: 'rings', r: [0.8], t: 'faint' }], 40), cyl(0, 0, 10, 40, 6, 'acc', 1, [{ d: 'rings', r: [0.4, 0.7], t: 'lo' }], 36),
      box(-74, -8, 28, 12, 16, 70, 'mid', 2, 4), box(-64, -8, 90, 26, 16, 10, 'mid', 2, 4),
      cone(0, 0, 10, 50, 38, 96, 'hi', 2, [{ d: 'seams', z: [0.15, 0.6], t: 'faint' }]),
      cone(52, 0, 44, 12, 7, 46, 'mid', 2, [], 18), cyl(0, 0, 106, 30, 8, 'mid', 3, [{ d: 'disc', r: 0.3, fill: 'acc' }], 30),
    ], 148, 116, 114, 4, [0, 0, 114], 3);
    case 'mug': return R([
      cyl(0, 0, 0, 64, 6, 'lo', 0, [{ d: 'rings', r: [0.72], t: 'faint' }], 40),
      cyl(0, 0, 6, 40, 72, 'hi', 1, [{ d: 'disc', r: 0.86, fill: 'dark' }, { d: 'rings', r: [0.45], t: 'acc' }, { d: 'seams', z: [0.88], t: 'faint' }], 36),
      box(36, -6, 24, 24, 12, 8, 'hi', 1, 4), box(52, -6, 24, 8, 12, 42, 'hi', 1, 3), box(36, -6, 58, 24, 12, 8, 'hi', 1, 4),
    ], 128, 128, 78, 1, [0, 0, 78], 1);
    case 'blender': return R([
      box(-46, -46, 0, 92, 92, 44, 'mid', 0, 14, [{ d: 'face', f: 'y', l: [ring(0.5, 0.5, 0.14, 0.22)], t: 'acc', w: 2.4 }, { d: 'face', f: 'x', l: rows(3, 0.2, 0.8, 0.3, 0.7), t: 'faint' }]),
      { k: 'cyl', x: 0, y: 0, z: 44, r: 30, h: 6, t: 'acc', ex: 1, n: 28, spin: 300, deco: [{ d: 'spokes', n: 4, r0: 0.1, r1: 0.95, sweep: 24, t: 'lo' }] },
      cone(0, 0, 50, 36, 46, 110, 'hi', 2, [{ d: 'knurl', n: 8, z0: 0.1, z1: 0.9, t: 'faint' }, { d: 'seams', z: [0.33, 0.66], t: 'faint' }]),
      cyl(0, 0, 160, 46, 8, 'dark', 3, [{ d: 'disc', r: 0.28, fill: 'acc' }], 36),
    ], 92, 92, 168, 2, [0, 0, 150], 3);
    case 'fridge': return R([
      box(-60, -50, 0, 120, 100, 8, 'lo', 0, 6),
      box(-50, -40, 40, 100, 80, 4, 'mid', 1, 2), box(10, -26, 44, 30, 30, 30, 'mid', 1, 3), box(-50, -40, 90, 100, 80, 4, 'mid', 1, 2), cyl(-18, -6, 94, 14, 34, 'acc', 1, [], 20), box(-50, -40, 140, 100, 80, 4, 'mid', 1, 2),
      box(-56, -46, 8, 112, 92, 190, 'hi', 3, 8, [{ d: 'face', f: 'y', l: [[[0, 0.64], [1, 0.64]]], t: 'mid' }, { d: 'face', f: 'y', l: [[[0.1, 0.72], [0.1, 0.88]], [[0.1, 0.3], [0.1, 0.55]]], t: 'mid', w: 5 }, { d: 'face', f: 'x', l: [[[0, 0.64], [1, 0.64]]], t: 'faint' }]),
    ], 120, 100, 198, 6, [0, 0, 198], 3);
    case 'washer': return R([
      box(-60, -56, 0, 120, 112, 8, 'lo', 0, 6),
      hcyl(0, 0, 66, 44, 80, 'y', 'acc', 1, 0.5),
      box(-56, -52, 8, 112, 104, 124, 'hi', 3, 8, [{ d: 'face', f: 'y', l: [ring(0.5, 0.42, 0.3, 0.27, 28)], t: 'mid', w: 3 }, { d: 'face', f: 'y', l: [ring(0.5, 0.42, 0.2, 0.18, 24)], t: 'lo' }, { d: 'face', f: 'y', l: [[[0, 0.84], [1, 0.84]]], t: 'faint' }, { d: 'quad', f: 'y', q: [0.62, 0.88, 0.9, 0.96], fill: 'dark' }]),
      cyl(26, 26, 132, 10, 6, 'acc', 3, [{ d: 'spokes', n: 1, r0: 0, r1: 0.8, a: 30, t: 'lo' }], 18),
    ], 120, 112, 138, 2, [0, 0, 132], 3);
    case 'plant': return R([
      cone(0, 0, 0, 40, 52, 56, 'mid', 0, [{ d: 'seams', z: [0.86], t: 'faint' }, { d: 'disc', r: 0.9, fill: 'dark' }]),
      cyl(0, 0, 56, 4, 40, 'lo', 1, [], 10),
      ball(-22, -8, 94, 22, 'hi', 1), ball(-4, -22, 124, 20, 'acc', 1), ball(20, 10, 104, 24, 'hi', 1), ball(4, 14, 136, 16, 'hi', 1),
    ], 104, 104, 152, 4, [0, 0, 150], 1);
    case 'tree': return R([
      cyl(0, 0, 0, 58, 8, 'lo', 0, [{ d: 'rings', r: [0.5], t: 'faint' }], 40), cyl(0, 0, 8, 10, 50, 'mid', 0, [], 16),
      cone(0, 0, 58, 54, 30, 42, 'hi', 1, [], 30), cone(0, 0, 100, 42, 16, 40, 'hi', 2, [], 28), cone(0, 0, 140, 24, 2, 34, 'acc', 3, [], 22),
    ], 116, 116, 174, 2, [0, 0, 160], 3);
    case 'bottle': return R([
      cyl(0, 0, 0, 40, 6, 'lo', 0, [], 36), cyl(0, 0, 6, 26, 72, 'acc', 1, [{ d: 'seams', z: [0.5], t: 'lo' }], 28),
      cyl(0, 0, 6, 32, 100, 'hi', 2, [{ d: 'seams', z: [0.3, 0.72], t: 'faint' }, { d: 'knurl', n: 6, z0: 0.34, z1: 0.68, t: 'faint' }], 36),
      cone(0, 0, 106, 32, 13, 26, 'hi', 2, [], 32), cyl(0, 0, 132, 13, 16, 'hi', 2, [], 20), cyl(0, 0, 148, 15, 14, 'acc', 3, [{ d: 'knurl', n: 12, t: 'lo' }], 20),
    ], 80, 80, 162, 2, [0, 0, 150], 3);
    case 'car': return R([
      hcyl(-48, -38, 16, 16, 12, 'y', 'dark', 0), hcyl(48, -38, 16, 16, 12, 'y', 'dark', 0),
      box(-78, -36, 12, 156, 72, 10, 'mid', 0, 6), box(26, -24, 22, 40, 48, 24, 'acc', 0, 4, [{ d: 'top', l: grid(3, 2), t: 'lo' }]),
      box(-76, -34, 22, 152, 68, 30, 'hi', 1, 12, [{ d: 'face', f: 'x', l: [[[0.15, 0.55], [0.3, 0.55]], [[0.7, 0.55], [0.85, 0.55]]], t: 'acc', w: 6 }, { d: 'face', f: 'y', l: [[[0.5, 0.15], [0.5, 0.9]]], t: 'faint' }]),
      box(-42, -30, 52, 80, 60, 28, 'hi', 2, 10, [{ d: 'quad', f: 'y', q: [0.06, 0.15, 0.46, 0.85], fill: 'dark' }, { d: 'quad', f: 'y', q: [0.54, 0.15, 0.94, 0.85], fill: 'dark' }, { d: 'quad', f: 'x', q: [0.1, 0.15, 0.9, 0.85], fill: 'dark' }]),
      hcyl(-48, 38, 16, 16, 12, 'y', 'dark', 0), hcyl(48, 38, 16, 16, 12, 'y', 'dark', 0),
    ], 156, 88, 80, 4, [0, 0, 80], 2);
    case 'truck': return R([
      hcyl(-52, -34, 16, 16, 12, 'y', 'dark'), hcyl(-10, -34, 16, 16, 12, 'y', 'dark'), hcyl(54, -34, 16, 16, 12, 'y', 'dark'),
      box(-78, -32, 12, 156, 64, 10, 'lo', 0, 4),
      box(-70, -26, 22, 40, 40, 36, 'acc', 1, 3), box(-26, -26, 22, 40, 40, 30, 'mid', 1, 3),
      box(-78, -34, 22, 104, 68, 76, 'hi', 2, 4, [{ d: 'face', f: 'y', l: cols(8, 0.04, 0.96, 0.08, 0.92), t: 'faint' }, { d: 'face', f: 'x', l: [[[0.5, 0.06], [0.5, 0.94]]], t: 'mid' }]),
      box(30, -32, 22, 48, 64, 56, 'mid', 0, 8, [{ d: 'quad', f: 'x', q: [0.1, 0.45, 0.9, 0.85], fill: 'dark' }, { d: 'quad', f: 'y', q: [0.45, 0.45, 0.85, 0.85], fill: 'dark' }, { d: 'face', f: 'x', l: [[[0.1, 0.2], [0.25, 0.2]], [[0.75, 0.2], [0.9, 0.2]]], t: 'acc', w: 5 }]),
      hcyl(-52, 34, 16, 16, 12, 'y', 'dark'), hcyl(-10, 34, 16, 16, 12, 'y', 'dark'), hcyl(54, 34, 16, 16, 12, 'y', 'dark'),
    ], 156, 80, 98, 6, [-26, 0, 98], 2);
    case 'scooter': return R([
      hcyl(-58, 0, 16, 16, 8, 'y', 'dark'), box(-40, -9, 12, 60, 18, 8, 'acc', 1, 3),
      box(-62, -12, 22, 112, 24, 8, 'hi', 0, 6, [{ d: 'top', l: rows(3, 0.1, 0.9, 0.2, 0.8), t: 'faint' }]),
      box(46, -5, 24, 10, 10, 104, 'mid', 0, 3), box(46, -34, 126, 10, 68, 8, 'mid', 0, 4), box(46, -40, 124, 10, 10, 12, 'dark', 0, 3), box(46, 30, 124, 10, 10, 12, 'dark', 0, 3),
      hcyl(56, 0, 16, 16, 8, 'y', 'dark'),
    ], 150, 80, 136, 2, [0, 0, 30], 1);
    case 'plane': return R([
      cyl(0, 0, 0, 30, 8, 'lo', 0, [], 28), cyl(0, 0, 8, 4, 24, 'mid', 0, [], 12),
      box(-22, -78, 44, 46, 76, 5, 'hi', 0, 6, [{ d: 'top', l: [[[0.2, 0.1], [0.2, 0.9]]], t: 'faint' }]), hcyl(0, -42, 38, 8, 30, 'x', 'acc', 0, 0.5),
      box(-78, -3, 52, 22, 6, 36, 'mid', 0, 3), box(-78, -26, 50, 18, 52, 4, 'mid', 0, 3),
      hcyl(0, 0, 48, 16, 150, 'x', 'hi', 0, 0.35),
      box(-22, 2, 44, 46, 76, 5, 'hi', 0, 6, [{ d: 'top', l: [[[0.2, 0.1], [0.2, 0.9]]], t: 'faint' }]), hcyl(0, 42, 38, 8, 30, 'x', 'acc', 0, 0.5),
    ], 152, 156, 90, 6, [0, 0, 64], 0);
    case 'rocket': return R([
      box(-60, -60, 0, 120, 120, 10, 'lo', 0, 8, [screws()]),
      box(-4, -46, 10, 8, 26, 40, 'acc', 0, 2), box(-46, -4, 10, 26, 8, 40, 'acc', 0, 2),
      cone(0, 0, 10, 18, 24, 14, 'dark', 1, [], 24),
      cyl(0, 0, 24, 24, 110, 'hi', 2, [{ d: 'seams', z: [0.3, 0.75], t: 'faint' }, { d: 'knurl', n: 4, z0: 0.4, z1: 0.6, t: 'faint' }], 30),
      cone(0, 0, 134, 24, 2, 44, 'hi', 3, [], 30),
      box(-4, 20, 10, 8, 26, 40, 'acc', 0, 2), box(20, -4, 10, 26, 8, 40, 'acc', 0, 2),
    ], 120, 120, 178, 4, [0, 0, 150], 3);
    case 'container': return R([
      box(-80, -34, 0, 160, 68, 6, 'lo', 0, 3),
      box(-70, -24, 6, 50, 48, 40, 'acc', 1, 3), box(-14, -24, 6, 40, 48, 30, 'mid', 1, 3), cyl(46, 0, 6, 16, 40, 'mid', 1, [], 20),
      box(-78, -32, 6, 156, 64, 64, 'hi', 2, 2, [{ d: 'face', f: 'y', l: cols(16, 0.02, 0.98, 0.06, 0.94), t: 'faint' }, { d: 'face', f: 'x', l: [[[0.5, 0.04], [0.5, 0.96]], [[0.3, 0.1], [0.3, 0.9]], [[0.7, 0.1], [0.7, 0.9]]], t: 'mid' }, { d: 'top', l: cols(10, 0.02, 0.98, 0.1, 0.9), t: 'faint' }, { d: 'dots', p: [[0.02, 0.04], [0.98, 0.04], [0.98, 0.96], [0.02, 0.96]], r: 3, t: 'acc' }]),
    ], 160, 68, 70, 4, [0, 0, 70], 2);
    case 'house': return R([
      box(-72, -72, 0, 144, 144, 6, 'lo', 0, 8, [{ d: 'top', l: [[[0.62, 1], [0.62, 0.78]]], t: 'faint', w: 6 }]),
      box(-30, -20, 6, 30, 30, 22, 'acc', 1, 3),
      box(-50, -42, 6, 100, 84, 62, 'hi', 2, 2, [{ d: 'quad', f: 'y', q: [0.12, 0, 0.32, 0.58], fill: 'dark' }, { d: 'quad', f: 'y', q: [0.48, 0.34, 0.86, 0.74], fill: 'soft' }, { d: 'quad', f: 'x', q: [0.2, 0.36, 0.5, 0.74], fill: 'soft' }, { d: 'quad', f: 'x', q: [0.6, 0.36, 0.86, 0.74], fill: 'soft' }]),
      prism(0, 0, 68, [[-52, 0], [52, 0], [0, 44]], 112, 'x', 'mid', 3),
      box(14, -30, 82, 14, 14, 32, 'acc', 3, 2),
    ], 144, 144, 114, 3, [0, 0, 112], 3);
    case 'shop': return R([
      box(-74, -60, 0, 148, 120, 6, 'lo', 0, 6),
      box(-40, -30, 6, 60, 20, 40, 'acc', 1, 3),
      box(-60, -46, 6, 120, 92, 80, 'hi', 2, 3, [{ d: 'quad', f: 'y', q: [0.06, 0.06, 0.6, 0.62], fill: 'soft' }, { d: 'quad', f: 'y', q: [0.68, 0, 0.92, 0.64], fill: 'dark' }, { d: 'face', f: 'x', l: rows(3, 0.2, 0.8, 0.3, 0.62), t: 'faint' }]),
      prism(0, 0, 0, [[46, 66], [72, 54], [72, 60], [46, 74]], 124, 'x', 'acc', 3),
      box(-56, 36, 86, 112, 6, 22, 'mid', 3, 2),
    ], 148, 120, 108, 2, [0, 0, 86], 3);
    case 'factory': {
      const p: P = [box(-80, -64, 0, 160, 128, 6, 'lo', 0, 6), box(-60, -40, 6, 40, 40, 30, 'acc', 1, 3), cyl(10, 0, 6, 18, 40, 'mid', 1, [], 22),
        box(-76, -56, 6, 120, 112, 58, 'hi', 2, 2, [{ d: 'face', f: 'y', l: rows(2, 0.06, 0.94, 0.35, 0.8), t: 'faint' }, { d: 'face', f: 'x', l: cols(6, 0.06, 0.94, 0.4, 0.8), t: 'mid' }])];
      for (let i = 0; i < 3; i++) p.push(prism(-76 + i * 40, 0, 64, [[0, 0], [40, 0], [40, 26]], 112, 'y', 'mid', 3));
      p.push(cyl(62, -38, 6, 11, 138, 'acc', 0, [{ d: 'seams', z: [0.3, 0.6, 0.9], t: 'lo' }], 20));
      return R(p, 160, 128, 144, 3, [-16, 0, 90], 3);
    }
    case 'office': return R([
      box(-60, -60, 0, 120, 120, 6, 'lo', 0, 6, [screws(0.06, 0.06)]),
      box(-34, -34, 6, 68, 68, 120, 'mid', 1, 2), box(-14, -14, 6, 28, 28, 170, 'acc', 1, 2),
      box(-40, -40, 6, 80, 80, 196, 'hi', 2, 3, [{ d: 'face', f: 'y', l: [...rows(12, 0.08, 0.92, 0.03, 0.97), ...cols(4, 0.04, 0.96, 0.03, 0.97)], t: 'faint' }, { d: 'face', f: 'x', l: [...rows(12, 0.08, 0.92, 0.03, 0.97), ...cols(4, 0.04, 0.96, 0.03, 0.97)], t: 'faint' }, { d: 'quad', f: 'y', q: [0.35, 0, 0.65, 0.05], fill: 'dark' }]),
      box(-30, -30, 202, 60, 60, 12, 'mid', 3, 4), cyl(0, 0, 214, 3, 40, 'acc', 3, [], 10),
    ], 120, 120, 254, 3, [0, 0, 214], 3);
    case 'warehouse': return R([
      box(-80, -60, 0, 160, 120, 6, 'lo', 0, 6, [{ d: 'top', l: [[[0.1, 0.95], [0.9, 0.95]]], t: 'faint', w: 3 }]),
      box(-50, -30, 6, 30, 30, 26, 'acc', 1, 3), box(-12, -30, 6, 30, 30, 26, 'mid', 1, 3), box(26, -30, 6, 30, 30, 26, 'mid', 1, 3),
      box(-74, -50, 6, 148, 100, 46, 'hi', 2, 2, [{ d: 'quad', f: 'y', q: [0.08, 0, 0.28, 0.72], fill: 'dark' }, { d: 'quad', f: 'y', q: [0.4, 0, 0.6, 0.72], fill: 'dark' }, { d: 'quad', f: 'y', q: [0.72, 0, 0.92, 0.72], fill: 'dark' }, { d: 'face', f: 'x', l: rows(2, 0.1, 0.9, 0.4, 0.8), t: 'faint' }]),
      prism(0, 0, 52, arch(50), 148, 'x', 'mid', 3),
    ], 160, 120, 102, 4, [0, 0, 100], 3);
    case 'coin': {
      const p: P = [box(-66, -50, 0, 132, 100, 6, 'lo', 0, 8)];
      for (let i = 0; i < 5; i++) p.push(cyl(-26, -10, 6 + i * 12, 27, 11, i === 4 ? 'acc' : 'hi', i >= 3 ? 1 : 0, [{ d: 'knurl', n: 18, z0: 0.15, z1: 0.85, t: 'faint' }, ...(i === 4 ? [{ d: 'rings', r: [0.7], t: 'lo' }] : [])], 32));
      for (let i = 0; i < 3; i++) p.push(cyl(32, 16, 6 + i * 12, 27, 11, 'hi', 0, [{ d: 'knurl', n: 18, z0: 0.15, z1: 0.85, t: 'faint' }, ...(i === 2 ? [{ d: 'rings', r: [0.7, 0.35], t: 'faint' }] : [])], 32));
      return R(p, 132, 100, 66, 5, [-26, -10, 66], 1);
    }
    case 'cash': {
      const p: P = [box(-70, -44, 0, 140, 88, 6, 'lo', 0, 6)];
      for (let i = 0; i < 6; i++) p.push(box(-56 + (i % 2) * 3, -30, 6 + i * 6, 112, 60, 5, 'hi', i > 3 ? 1 : 0, 2, i === 5 ? [{ d: 'top', l: [ring(0.5, 0.5, 0.12, 0.22)], t: 'mid' }, { d: 'top', l: [[[0.06, 0.12], [0.94, 0.12]], [[0.06, 0.88], [0.94, 0.88]]], t: 'faint' }] : []));
      p.push(box(-12, -32, 6, 24, 64, 30, 'acc', 0, 2));
      return R(p, 140, 88, 42, 6, [0, 0, 42], 1);
    }
    case 'wallet': return R([
      box(-60, -42, 0, 120, 84, 20, 'mid', 0, 10, [{ d: 'face', f: 'y', l: [[[0.04, 0.5], [0.96, 0.5]]], t: 'faint' }]),
      box(-48, -40, 16, 76, 50, 4, 'acc', 1, 4, [{ d: 'top', l: [[[0.1, 0.3], [0.4, 0.3]]], t: 'lo' }]), box(-40, -32, 20, 76, 50, 4, 'hi', 1, 4),
      box(-60, -42, 20, 120, 84, 8, 'hi', 2, 10, [{ d: 'dots', p: [[0.92, 0.5]], r: 4.5, t: 'acc' }, { d: 'top', l: [[[0.06, 0.08], [0.94, 0.08]]], t: 'faint' }]),
    ], 120, 84, 28, 3, [0, 0, 28], 2);
    case 'creditcard': return R([
      box(-70, -52, 0, 128, 82, 4, 'mid', 0, 8, [{ d: 'top', l: [[[0, 0.18], [1, 0.18]]], t: 'lo', w: 7 }]),
      box(-56, -32, 10, 128, 82, 4, 'hi', 1, 8, [{ d: 'quad', f: 'top', q: [0.1, 0.25, 0.26, 0.48], fill: 'acc' }, { d: 'top', l: [[[0.1, 0.68], [0.62, 0.68]], [[0.1, 0.8], [0.4, 0.8]]], t: 'lo' }, { d: 'dots', p: [[0.84, 0.78], [0.9, 0.78]], r: 6, t: 'acc' }]),
    ], 142, 112, 14, 1, [8, 9, 14], 1);
    case 'chart': return R([
      box(-76, -56, 0, 152, 112, 10, 'lo', 0, 6, [{ d: 'top', l: rows(4, 0.05, 0.95, 0.1, 0.9), t: 'faint' }]),
      box(-62, -18, 10, 24, 40, 30, 'mid', 1, 2), box(-30, -18, 10, 24, 40, 56, 'mid', 1, 2), box(2, -18, 10, 24, 40, 84, 'hi', 1, 2), box(34, -18, 10, 24, 40, 120, 'acc', 1, 2),
    ], 152, 112, 130, 4, [46, 2, 130], 1);
    case 'clock': return R([
      box(-50, -30, 0, 100, 60, 10, 'lo', 0, 6),
      { k: 'gear', x: -14, y: 6, z: 12, r: 30, h: 6, teeth: 12, spin: 20, t: 'mid', ex: 1 }, { k: 'gear', x: 24, y: -16, z: 12, r: 18, h: 6, teeth: 9, spin: -34, t: 'acc', ex: 1 },
      cyl(0, 0, 10, 62, 16, 'hi', 2, [{ d: 'disc', r: 0.92, fill: 'paper' }, { d: 'spokes', n: 12, r0: 0.76, r1: 0.88, t: 'mid' }, { d: 'spokes', n: 1, r0: 0, r1: 0.5, a: 250, t: 'hi', w: 3.4 }, { d: 'spokes', n: 1, r0: 0, r1: 0.7, a: 340, t: 'hi', w: 2.4 }, { d: 'spokes', n: 1, r0: 0, r1: 0.78, a: 20, t: 'acc', w: 1.6 }], 44),
      cyl(0, 0, 26, 5, 4, 'acc', 2, [], 14),
    ], 124, 124, 30, 3, [0, 0, 30], 2);
    case 'calendar': return R([
      box(-66, -60, 0, 132, 120, 10, 'lo', 0, 6),
      box(-60, -54, 10, 120, 108, 4, 'mid', 0, 3), box(-60, -54, 14, 120, 108, 4, 'mid', 1, 3),
      box(-60, -54, 18, 120, 108, 4, 'hi', 2, 3, [{ d: 'top', l: [...rows(5, 0.06, 0.94, 0.25, 0.95), ...cols(7, 0.06, 0.94, 0.25, 0.95)], t: 'faint' }, { d: 'top', l: [[[0.08, 0.12], [0.5, 0.12]]], t: 'mid', w: 4 }, { d: 'quad', f: 'top', q: [0.56, 0.5, 0.68, 0.64], fill: 'acc' }]),
      cyl(-30, -56, 22, 6, 12, 'acc', 2, [], 12), cyl(0, -56, 22, 6, 12, 'acc', 2, [], 12), cyl(30, -56, 22, 6, 12, 'acc', 2, [], 12),
    ], 132, 120, 34, 3, [0, 0, 22], 2);
    case 'mail': return R([
      box(-70, -54, 0, 130, 86, 6, 'mid', 0, 4, [{ d: 'top', l: [[[0, 0], [0.5, 0.55], [1, 0]]], t: 'lo' }]),
      box(-52, -30, 6, 110, 70, 3, 'hi', 1, 2, [{ d: 'top', l: rows(4, 0.1, 0.8, 0.15, 0.7), t: 'faint' }]),
      box(-60, -32, 12, 130, 86, 6, 'hi', 2, 4, [{ d: 'top', l: [[[0, 0], [0.5, 0.56], [1, 0]]], t: 'lo' }, { d: 'dots', p: [[0.5, 0.56]], r: 6, t: 'acc' }]),
    ], 140, 108, 18, 2, [5, 11, 18], 2);
    case 'chat': return R([
      box(-74, -64, 0, 148, 128, 6, 'lo', 0, 8),
      box(-68, -54, 6, 104, 72, 24, 'hi', 1, 24, [{ d: 'top', l: rows(3, 0.16, 0.84, 0.22, 0.78), t: 'lo' }]), box(-60, 14, 6, 18, 22, 24, 'hi', 1, 4),
      box(-16, -6, 34, 86, 60, 24, 'acc', 2, 24, [{ d: 'top', l: rows(2, 0.18, 0.72, 0.28, 0.72), t: 'lo' }]), box(48, 50, 34, 16, 18, 24, 'acc', 2, 4),
    ], 148, 128, 58, 3, [26, 24, 58], 2);
    case 'bell': return R([
      cyl(0, 0, 0, 50, 8, 'lo', 0, [{ d: 'rings', r: [0.7], t: 'faint' }], 36), ball(0, 0, 24, 13, 'acc', 1),
      cone(0, 0, 8, 52, 20, 80, 'hi', 2, [{ d: 'seams', z: [0.1, 0.22], t: 'faint' }], 36), cyl(0, 0, 88, 20, 8, 'hi', 2, [], 24), ball(0, 0, 106, 10, 'mid', 3),
    ], 100, 100, 116, 2, [0, 0, 100], 3);
    case 'book': return R([
      box(-66, -50, 0, 130, 96, 22, 'mid', 0, 3, [{ d: 'face', f: 'x', l: rows(5, 0.02, 0.98, 0.2, 0.8), t: 'faint' }]),
      box(-58, -44, 22, 118, 86, 18, 'acc', 1, 3, [{ d: 'face', f: 'y', l: rows(4, 0.02, 0.98, 0.2, 0.8), t: 'lo' }]),
      box(-62, -40, 40, 118, 80, 16, 'hi', 2, 3, [{ d: 'face', f: 'x', l: rows(4, 0.02, 0.98, 0.2, 0.8), t: 'faint' }, { d: 'top', l: [[[0.15, 0.3], [0.6, 0.3]], [[0.15, 0.42], [0.45, 0.42]]], t: 'lo' }]),
    ], 130, 96, 56, 2, [0, 0, 56], 2);
    case 'target': return R([
      box(-66, -66, 0, 132, 132, 6, 'lo', 0, 8, [screws()]),
      cyl(0, 0, 6, 60, 8, 'mid', 0, [], 40), cyl(0, 0, 14, 44, 8, 'hi', 0, [], 36), cyl(0, 0, 22, 28, 8, 'mid', 0, [], 30), cyl(0, 0, 30, 12, 8, 'acc', 0, [], 20),
      cyl(6, -4, 38, 3, 64, 'hi', 1, [], 10), cone(6, -4, 102, 10, 2, 16, 'acc', 1, [], 3),
    ], 132, 132, 118, 4, [0, 0, 38], 1);
    case 'trophy': return R([
      box(-40, -40, 0, 80, 80, 22, 'mid', 0, 4, [{ d: 'face', f: 'y', l: [[[0.2, 0.5], [0.8, 0.5]]], t: 'faint' }, { d: 'face', f: 'x', l: [[[0.2, 0.5], [0.8, 0.5]]], t: 'faint' }]),
      cyl(0, 0, 22, 8, 34, 'hi', 0, [], 16), cyl(0, 0, 56, 18, 6, 'mid', 0, [], 24),
      box(-60, -4, 82, 16, 8, 28, 'hi', 1, 4), cone(0, 0, 62, 20, 48, 58, 'hi', 1, [{ d: 'disc', r: 0.86, fill: 'dark' }, { d: 'seams', z: [0.8], t: 'faint' }], 36), box(44, -4, 82, 16, 8, 28, 'hi', 1, 4),
      ball(0, 0, 138, 13, 'acc', 2),
    ], 120, 80, 152, 4, [0, 0, 120], 2);
    case 'alert': return R([
      cyl(0, 0, 0, 48, 14, 'mid', 0, [{ d: 'knurl', n: 20, t: 'faint' }], 36), cyl(0, 0, 14, 38, 16, 'dark', 0, [{ d: 'knurl', n: 10, t: 'mid' }], 32),
      cone(0, 0, 30, 34, 26, 56, 'acc', 1, [{ d: 'knurl', n: 8, z0: 0.1, z1: 0.9, t: 'lo' }], 30), cyl(0, 0, 86, 28, 10, 'hi', 2, [{ d: 'rings', r: [0.5], t: 'faint' }], 30),
    ], 96, 96, 96, 3, [0, 0, 96], 2);
    case 'search': return R([
      box(-70, -64, 0, 112, 132, 4, 'mid', 0, 4, [{ d: 'top', l: rows(8, 0.1, 0.9, 0.1, 0.9), t: 'faint' }]),
      box(16, -6, 10, 66, 14, 10, 'mid', 1, 4),
      cyl(-12, -6, 6, 34, 12, 'hi', 1, [{ d: 'disc', r: 0.78, fill: 'soft' }, { d: 'rings', r: [0.55], t: 'acc' }], 36),
    ], 154, 132, 22, 2, [-12, -6, 18], 1);
    case 'shield': return R([
      box(-58, -30, 0, 116, 60, 10, 'lo', 0, 6, [screws(0.06, 0.15)]),
      prism(0, 0, 10, [[-46, 108], [46, 108], [46, 56], [0, 4], [-46, 56]], 18, 'y', 'hi', 0),
      prism(0, 12, 10, [[-30, 94], [30, 94], [30, 58], [0, 24], [-30, 58]], 6, 'y', 'acc', 1),
    ], 116, 60, 118, 1, [0, 0, 100], 1);
    case 'key': return R([
      box(-78, -34, 0, 156, 68, 6, 'lo', 0, 6),
      cyl(-46, 0, 6, 26, 8, 'hi', 0, [{ d: 'disc', r: 0.38, fill: 'dark' }, { d: 'rings', r: [0.72], t: 'acc' }], 34),
      box(-22, -6, 6, 92, 12, 8, 'hi', 0, 3, [{ d: 'top', l: [[[0.05, 0.5], [0.9, 0.5]]], t: 'faint' }]), box(46, 6, 6, 8, 14, 8, 'hi', 0, 2), box(58, 6, 6, 8, 10, 8, 'hi', 0, 2),
    ], 156, 68, 14, 1, [-46, 0, 14], 0);
    case 'pill': return R([
      box(-70, -56, 0, 140, 112, 6, 'lo', 0, 8),
      cyl(-24, -10, 6, 30, 64, 'acc', 0, [{ d: 'seams', z: [0.25, 0.75], t: 'lo' }], 32), cyl(-24, -10, 70, 32, 18, 'hi', 2, [{ d: 'knurl', n: 20, t: 'faint' }, { d: 'rings', r: [0.6], t: 'faint' }], 32),
      hcyl(30, 14, 15, 9, 34, 'x', 'hi', 1), hcyl(26, 38, 15, 9, 34, 'x', 'acc', 1),
    ], 140, 112, 88, 2, [-24, -10, 88], 2);
    case 'heart': return R([
      box(-56, -36, 0, 112, 72, 10, 'lo', 0, 6), box(-10, -8, 10, 20, 16, 30, 'mid', 0, 3),
      box(-76, -16, 40, 152, 12, 104, 'hi', 1, 6, [{ d: 'quad', f: 'y', q: [0.05, 0.08, 0.95, 0.9], fill: 'screen' }, { d: 'face', f: 'y', l: [[[0.08, 0.5], [0.3, 0.5], [0.36, 0.76], [0.42, 0.18], [0.48, 0.62], [0.53, 0.5], [0.92, 0.5]]], t: 'acc', w: 3.4 }, { d: 'face', f: 'y', l: [[[0.08, 0.84], [0.3, 0.84]]], t: 'line' }]),
    ], 152, 72, 144, 2, [0, -10, 144], 1);
    case 'medkit': return R([
      box(-60, -44, 0, 120, 88, 48, 'mid', 0, 8, [{ d: 'face', f: 'y', l: [[[0.4, 0.9], [0.6, 0.9]]], t: 'faint', w: 4 }]),
      cyl(-24, -10, 48, 12, 30, 'acc', 1, [], 16), box(4, -16, 48, 34, 30, 22, 'hi', 1, 4),
      box(-60, -44, 48, 120, 88, 18, 'hi', 2, 8, [{ d: 'quad', f: 'top', q: [0.42, 0.2, 0.58, 0.8], fill: 'acc' }, { d: 'quad', f: 'top', q: [0.3, 0.38, 0.7, 0.62], fill: 'acc' }]),
      box(-22, -4, 66, 6, 8, 16, 'mid', 2, 2), box(16, -4, 66, 6, 8, 16, 'mid', 2, 2), box(-22, -4, 80, 44, 8, 6, 'mid', 2, 2),
    ], 120, 88, 86, 3, [0, 0, 66], 2);
    case 'cart': return R([
      hcyl(-44, -30, 10, 9, 8, 'y', 'dark'), hcyl(44, -30, 10, 9, 8, 'y', 'dark'),
      box(-56, -34, 20, 112, 68, 6, 'mid', 0, 3),
      box(-60, -38, 26, 120, 76, 56, 'hi', 0, 4, [{ d: 'face', f: 'y', l: [...rows(4, 0, 1, 0.1, 0.9), ...cols(9, 0.02, 0.98, 0, 1)], t: 'lo' }, { d: 'face', f: 'x', l: [...rows(4, 0, 1, 0.1, 0.9), ...cols(6, 0.02, 0.98, 0, 1)], t: 'lo' }]),
      box(-40, -24, 82, 32, 32, 30, 'acc', 1, 3), cyl(14, 0, 82, 14, 40, 'mid', 1, [], 20),
      box(-70, -34, 66, 8, 68, 8, 'mid', 0, 3),
      hcyl(-44, 30, 10, 9, 8, 'y', 'dark'), hcyl(44, 30, 10, 9, 8, 'y', 'dark'),
    ], 140, 76, 122, 3, [0, 0, 112], 1);
    case 'bag': return R([
      box(-74, -40, 0, 148, 80, 4, 'lo', 0, 6),
      box(-62, -22, 4, 60, 40, 70, 'mid', 0, 3, [{ d: 'face', f: 'y', l: [[[0, 0.86], [1, 0.86]]], t: 'faint' }]),
      box(-20, -28, 4, 84, 56, 100, 'hi', 0, 4, [{ d: 'face', f: 'y', l: [[[0, 0.88], [1, 0.88]]], t: 'faint' }, { d: 'quad', f: 'y', q: [0.28, 0.35, 0.72, 0.6], fill: 'acc' }]),
      box(-4, -4, 104, 6, 8, 30, 'mid', 1, 2), box(42, -4, 104, 6, 8, 30, 'mid', 1, 2), box(-4, -4, 128, 52, 8, 6, 'mid', 1, 2),
    ], 148, 80, 134, 2, [22, 0, 104], 1);
    case 'pos': return R([
      box(-74, -50, 0, 148, 100, 40, 'mid', 0, 6, [{ d: 'face', f: 'y', l: [[[0.04, 0.84], [0.96, 0.84]]], t: 'faint' }]),
      box(-34, -30, 40, 64, 70, 10, 'hi', 1, 6, [{ d: 'top', l: grid(3, 4), t: 'lo' }]),
      box(-34, -36, 50, 64, 8, 54, 'hi', 2, 4, [{ d: 'quad', f: 'y', q: [0.08, 0.1, 0.92, 0.9], fill: 'screen', ui: true }]),
      box(42, -16, 40, 26, 40, 3, 'acc', 1, 3),
    ], 148, 100, 104, 2, [0, -32, 104], 2);
    case 'shelf': {
      const p: P = [box(-76, -42, 0, 152, 60, 10, 'lo', 0, 3), box(-76, -42, 0, 152, 10, 150, 'mid', 0, 2)];
      for (const z of [10, 60, 110]) {
        if (z > 10) p.push(box(-76, -32, z - 5, 152, 50, 5, 'mid', 0, 2));
        const k = z / 50;
        p.push(box(-66, -24, z, 26, 30, 30 + (k % 2) * 6, 'hi', 0, 3), cyl(-20, -8, z, 12, 34, k === 1 ? 'acc' : 'hi', 0, [], 18), box(6, -24, z, 26, 30, 28, 'hi', 0, 3), cyl(52, -8, z, 12, 30 - k * 2, 'mid', 0, [], 18));
      }
      return R(p, 152, 60, 150, 1, [0, -20, 150], 0);
    }
    case 'crate': return R([
      box(-70, -60, 0, 140, 120, 6, 'lo', 0, 2, [{ d: 'face', f: 'y', l: cols(4, 0, 1, 0, 1), t: 'faint' }]),
      cyl(-24, -16, 12, 18, 40, 'acc', 1, [], 22), box(10, 0, 12, 40, 40, 30, 'mid', 1, 3),
      box(-64, -54, 6, 128, 108, 66, 'hi', 2, 2, [{ d: 'face', f: 'y', l: rows(4, 0, 1, 0, 1), t: 'mid' }, { d: 'face', f: 'x', l: rows(4, 0, 1, 0, 1), t: 'mid' }, { d: 'face', f: 'y', l: [[[0.02, 0.05], [0.98, 0.95]]], t: 'faint' }]),
      box(-64, -54, 72, 128, 108, 8, 'hi', 3, 2, [{ d: 'top', l: cols(5, 0, 1, 0, 1), t: 'mid' }]),
    ], 140, 120, 80, 3, [0, 0, 80], 3);
    case 'solar': return R([
      box(-74, -40, 0, 148, 80, 8, 'lo', 0, 4), box(-44, -4, 8, 8, 8, 44, 'mid', 0, 2), box(36, -4, 8, 8, 8, 44, 'mid', 0, 2),
      box(56, 20, 8, 20, 18, 26, 'acc', 0, 3),
      prism(0, 0, 0, [[-50, 40], [50, 82], [50, 88], [-50, 46]], 150, 'x', 'dark', 1, { grid: { e: 2, nu: 8, nv: 4 } }),
    ], 150, 100, 88, 4, [0, 0, 80], 1);
    case 'turbine': return R([
      cyl(0, 0, 0, 40, 10, 'lo', 0, [{ d: 'rings', r: [0.6], t: 'faint' }], 32), cone(0, 0, 10, 14, 7, 164, 'hi', 0, [{ d: 'seams', z: [0.5], t: 'faint' }], 24),
      hcyl(-8, 0, 178, 13, 44, 'x', 'mid', 0, 0), ball(18, 0, 178, 9, 'acc', 0),
      ...[0, 120, 240].map(a => prism(24, 0, 178, [[-5, 6], [5, 6], [2, 76], [-2, 76]], 4, 'x', 'hi', 0, { rot: a, spin: 50 })),
    ], 100, 160, 256, 3, [18, 0, 178], 0);
    case 'silo': return R([
      box(-72, -60, 0, 144, 120, 6, 'lo', 0, 6),
      cyl(-22, -14, 6, 40, 130, 'hi', 0, [{ d: 'seams', z: [0.25, 0.5, 0.75], t: 'faint' }, { d: 'knurl', n: 3, z0: 0.05, z1: 0.95, t: 'faint' }], 36),
      cone(-22, -14, 136, 40, 10, 26, 'hi', 1, [], 36), cyl(-22, -14, 162, 10, 8, 'acc', 1, [], 16),
      cyl(40, 30, 6, 26, 90, 'mid', 0, [{ d: 'seams', z: [0.33, 0.66], t: 'faint' }], 30), cone(40, 30, 96, 26, 6, 18, 'mid', 1, [], 30),
    ], 144, 120, 170, 1, [-22, -14, 160], 1);
    case 'valve': return R([
      box(-78, -30, 0, 156, 60, 8, 'lo', 0, 4), box(-56, -8, 8, 12, 16, 24, 'mid', 0, 2), box(44, -8, 8, 12, 16, 24, 'mid', 0, 2),
      hcyl(0, 0, 46, 16, 156, 'x', 'mid', 0, 0.6),
      box(-22, -22, 24, 44, 44, 44, 'hi', 0, 6, [screws(0.12, 0.12, 2)]), cyl(0, 0, 68, 5, 24, 'mid', 1, [], 12),
      { k: 'cyl', x: 0, y: 0, z: 92, r: 32, h: 6, t: 'acc', ex: 1, n: 36, deco: [{ d: 'spokes', n: 5, r0: 0.15, r1: 0.88, t: 'lo' }, { d: 'rings', r: [0.86, 0.2], t: 'lo' }] },
    ], 156, 64, 98, 4, [0, 0, 68], 1);
  }
}

/** quiet unused-import guard for helpers some cases may drop */
void disc;
