/**
 * Improvised parts: a thing the part library lacks is COMPOSED from iso primitives, in the same grammar (a base, a body
 * with its insides, a top, one brand-ink element, detail in the plane of its face). Whoever picks (the model, or the
 * deterministic sketch below) only chooses from enums: a primitive for the body and the top, proportions, a size and
 * a detail. Never coordinates. A composed part is validated (inside the footprint, at least 3 solids) and kept with
 * the kit's grow(), so the next film's planner sees it in its menu like any library part.
 */
import { box, cone, cyl, ball, hcyl, ring, rows, cols, screws, grid, type Part, type Prim } from './prims';

export const PRIMS = ['box', 'cylinder', 'slab', 'cone', 'ring', 'panel', 'sphere', 'pipe'] as const;
export type PrimName = (typeof PRIMS)[number];
export const SHAPES = ['tall', 'wide', 'flat', 'cube'] as const;
export const DETAILS = ['screen', 'vents', 'dial', 'grid', 'lights', 'lines', 'none'] as const;
export interface PartSpec { name: string; body: PrimName; top: PrimName | 'none'; shape: (typeof SHAPES)[number]; size: 'small' | 'medium' | 'large'; detail: (typeof DETAILS)[number]; base: boolean }

const near = <T extends string>(x: unknown, from: readonly T[], d: T): T => { const s = String(x ?? '').toLowerCase().trim(); return from.find(f => f === s) ?? from.find(f => s.includes(f) || f.includes(s)) ?? d; };

/** A spec any picker produced, made valid (unknown enums → nearest, a name always). */
export function tidyPart(s: Partial<PartSpec>, name: string): PartSpec {
  return {
    name: String(s.name ?? name).trim().slice(0, 24) || name, body: near(s.body, PRIMS, 'box'), top: s.top === 'none' ? 'none' : near(s.top, PRIMS, 'cylinder'),
    shape: near(s.shape, SHAPES, 'cube'), size: near(s.size, ['small', 'medium', 'large'] as const, 'medium'), detail: near(s.detail, DETAILS, 'lines'), base: s.base !== false,
  };
}

const WORDS: [RegExp, Partial<PartSpec>][] = [
  [/bottle|can\b|jar|tube|silo|tank|cup|vase|candle|lipstick|thermos|flask|canister/i, { body: 'cylinder', shape: 'tall', top: 'cylinder', detail: 'lines' }],
  [/sign|screen|board|display|monitor|poster|billboard|kiosk|menu|tv|television|whiteboard/i, { body: 'panel', shape: 'wide', top: 'none', detail: 'screen' }],
  [/ball|planet|sphere|orb|egg|bubble|globe|moon|fruit|apple|orange/i, { body: 'sphere', shape: 'cube', top: 'none', detail: 'none' }],
  [/pipe|cable|hose|wire|duct|tunnel|rail|beam|bar\b|rod/i, { body: 'pipe', shape: 'wide', top: 'none', detail: 'lines' }],
  [/ring|wheel|tire|tyre|donut|loop|coil|reel|disk|disc|record|plate\b|dish/i, { body: 'ring', shape: 'flat', top: 'none', detail: 'none' }],
  [/cone|funnel|nozzle|mountain|hat|pyramid|tent|spire|horn|lampshade/i, { body: 'cone', shape: 'tall', top: 'sphere', detail: 'none' }],
  [/card|sheet|mat|tile|pad|floor|ticket|label|page|paper|map|tray|rug|mattress/i, { body: 'slab', shape: 'flat', top: 'none', detail: 'lines' }],
  [/oven|stove|microwave|machine|unit|appliance|engine|generator|printer|terminal|console|amplifier|router|modem/i, { body: 'box', shape: 'cube', top: 'box', detail: 'vents' }],
  [/meter|gauge|thermostat|scale|sensor|thermometer|speedometer|dial|compass/i, { body: 'box', shape: 'flat', top: 'cylinder', detail: 'dial' }],
  [/solar|keypad|keys|piano|grid|matrix|calendar|chessboard|waffle/i, { body: 'slab', shape: 'wide', top: 'none', detail: 'grid' }],
  [/light|led|signal|status|beacon|traffic|lantern|torch/i, { body: 'cylinder', shape: 'tall', top: 'sphere', detail: 'lights' }],
  [/tower|column|pillar|post|pole|antenna|mast|chimney/i, { body: 'cylinder', shape: 'tall', top: 'cone', detail: 'lines' }],
  [/box|case|cabinet|container|locker|safe|chest|drawer|parcel|bin|cube|block|brick/i, { body: 'box', shape: 'cube', top: 'slab', detail: 'lines' }],
  [/bench|table|desk|counter|bed|sofa|couch|platform|stage|dock/i, { body: 'slab', shape: 'wide', top: 'box', detail: 'none' }],
];

/** A spec with no model: the thing's own name (and its line) mapped to primitives by meaning. */
export function sketchPart(name: string, context = ''): PartSpec {
  const hit = WORDS.find(([re]) => re.test(name)) ?? WORDS.find(([re]) => re.test(context));
  const h = [...name].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  return tidyPart({ name, body: 'box', shape: (['cube', 'tall', 'wide'] as const)[h % 3], top: (['cylinder', 'box', 'sphere'] as const)[h % 3], detail: (['lines', 'vents', 'lights'] as const)[(h >> 3) % 3], base: true, ...(hit?.[1] ?? {}) }, name);
}

/** The part a spec describes: base slab, body (with insides that show when it explodes), top, detail. */
export function composePart(s: PartSpec): Part {
  const k = s.size === 'small' ? 0.72 : s.size === 'large' ? 1 : 0.86;
  const [W, D, H] = s.shape === 'tall' ? [96, 96, 150] : s.shape === 'wide' ? [150, 96, 66] : s.shape === 'flat' ? [140, 120, 22] : [110, 110, 100];
  const w = W * k, d = D * k, h = H * k, x0 = -w / 2, y0 = -d / 2;
  const p: Prim[] = [];
  let z = 0;
  if (s.base && s.body !== 'panel') { p.push(box(x0 - 10, y0 - 10, 0, w + 20, d + 20, 8, 'lo', 0, 6, [screws(0.06, 0.06)])); z = 8; }
  const faceDeco: object[] = s.detail === 'screen' ? [{ d: 'quad', f: 'y', q: [0.08, 0.12, 0.92, 0.88], fill: 'screen', ui: true }]
    : s.detail === 'vents' ? [{ d: 'face', f: 'x', l: rows(7, 0.15, 0.85, 0.15, 0.85), t: 'lo' }, { d: 'face', f: 'y', l: [[[0, 0.75], [1, 0.75]]], t: 'faint' }]
    : s.detail === 'dial' ? [{ d: 'face', f: 'y', l: [ring(0.3, 0.5, 0.14, 0.24)], t: 'mid', w: 2.2 }, { d: 'face', f: 'y', l: [[[0.3, 0.5], [0.38, 0.68]]], t: 'acc', w: 3 }]
    : s.detail === 'grid' ? [{ d: 'face', f: 'y', l: [...rows(3, 0.05, 0.95, 0.1, 0.9), ...cols(6, 0.05, 0.95, 0.1, 0.9)], t: 'lo' }]
    : s.detail === 'lights' ? [{ d: 'face', f: 'y', l: [[[0.2, 0.75], [0.22, 0.75]], [[0.4, 0.75], [0.42, 0.75]], [[0.6, 0.75], [0.62, 0.75]]], t: 'acc', w: 7 }]
    : s.detail === 'lines' ? [{ d: 'face', f: 'y', l: [[[0, 0.3], [1, 0.3]], [[0, 0.7], [1, 0.7]]], t: 'faint' }] : [];
  const topDeco: object[] = s.detail === 'grid' ? [{ d: 'top', l: grid(6, 4), t: 'lo' }] : s.detail === 'screen' && s.body === 'slab' ? [{ d: 'quad', f: 'top', q: [0.08, 0.1, 0.92, 0.9], fill: 'screen', ui: true }] : [{ d: 'top', l: [[[0.1, 0.5], [0.9, 0.5]]], t: 'faint' }];
  const r = Math.min(w, d) / 2;
  // the insides (an accent core): seen when the body lifts
  const core = (zz: number, hh: number) => (s.body === 'sphere' || s.body === 'ring' ? cyl(0, 0, zz, r * 0.4, hh * 0.5, 'acc', 1, [{ d: 'rings', r: [0.5], t: 'lo' }], 20) : box(-w * 0.25, -d * 0.25, zz, w * 0.5, d * 0.5, hh * 0.55, 'acc', 1, 4, [{ d: 'top', l: grid(3, 3), t: 'lo' }]));
  let top = z + h;
  switch (s.body) {
    case 'box': p.push(core(z, h), box(x0, y0, z, w, d, h, 'hi', 2, 6, [...faceDeco, ...topDeco])); break;
    case 'slab': p.push(box(x0, y0, z, w, d, Math.max(10, h * 0.35), 'hi', 1, 6, [...topDeco, ...faceDeco.filter(f => (f as { d: string }).d !== 'quad')])); top = z + Math.max(10, h * 0.35); break;
    case 'cylinder': p.push(core(z, h), cyl(0, 0, z, r, h, 'hi', 2, [{ d: 'seams', z: [0.2, 0.8], t: 'faint' }, ...(s.detail === 'lights' ? [{ d: 'knurl', n: 6, t: 'acc' }] : [{ d: 'rings', r: [0.6], t: 'faint' }])], 36)); break;
    case 'cone': p.push(core(z, h), cone(0, 0, z, r, r * 0.35, h, 'hi', 2, [{ d: 'seams', z: [0.15], t: 'faint' }], 32)); break;
    case 'ring': p.push(cyl(0, 0, z, r * 0.4, h * 0.6 + 6, 'acc', 1, [], 20), cyl(0, 0, z, r, Math.max(14, h * 0.6), 'hi', 2, [{ d: 'disc', r: 0.45, fill: 'dark' }, { d: 'rings', r: [0.75], t: 'faint' }], 40)); top = z + Math.max(14, h * 0.6); break;
    case 'panel': p.push(box(-20, -8, 0, 40, 16, 30, 'mid', 0, 3), box(x0, -8, 30, w, 14, Math.max(70, h), 'hi', 1, 4, [s.detail === 'screen' || s.detail === 'none' ? { d: 'quad', f: 'y', q: [0.05, 0.08, 0.95, 0.9], fill: 'screen', ui: true } : faceDeco[0] ?? {}])); top = 30 + Math.max(70, h); break;
    case 'sphere': p.push(cyl(0, 0, z, r * 0.5, 10, 'mid', 0, [], 24), ball(0, 0, z + 10 + r * 0.8, r * 0.8, 'hi', 1)); top = z + 10 + r * 1.6; break;
    case 'pipe': p.push(box(x0 + 10, -10, z, 14, 20, h * 0.4, 'mid', 0, 2), box(-x0 - 24, -10, z, 14, 20, h * 0.4, 'mid', 0, 2), hcyl(0, 0, z + h * 0.4 + r * 0.4, r * 0.4, w, 'x', 'hi', 1, 0.6)); top = z + h * 0.4 + r * 0.8; break;
  }
  if (s.top !== 'none' && s.body !== 'panel' && s.body !== 'pipe') {
    const tr = r * 0.32;
    const t: Prim = s.top === 'sphere' ? ball(0, 0, top + tr, tr, 'acc', 3) : s.top === 'cone' ? cone(0, 0, top, tr, 2, tr * 2.2, 'acc', 3, [], 24)
      : s.top === 'box' || s.top === 'slab' ? box(-w * 0.3, -d * 0.3, top, w * 0.6, d * 0.6, s.top === 'slab' ? 6 : tr, 'mid', 3, 4, [{ d: 'dots', p: [[0.15, 0.5]], r: 3, t: 'acc' }])
      : s.top === 'ring' ? cyl(0, 0, top, tr * 1.6, 6, 'acc', 3, [{ d: 'disc', r: 0.5, fill: 'dark' }], 28) : s.top === 'panel' ? box(-w * 0.35, -4, top, w * 0.7, 8, tr * 1.6, 'mid', 3, 3, [{ d: 'quad', f: 'y', q: [0.08, 0.12, 0.92, 0.88], fill: 'screen' }])
      : cyl(0, 0, top, tr, Math.max(8, tr * 0.6), 'acc', 3, [{ d: 'rings', r: [0.5], t: 'lo' }], 24);
    p.push(t);
  }
  const hh = Math.max(...p.map(q => (q.k === 'ball' ? q.z + (q.r ?? 0) : q.k === 'prism' ? q.z + (q.r ?? 20) : q.z + q.h)));
  const hero = p.findIndex(q => q.t === 'hi');
  return { prims: p, fp: { w: Math.max(w + 20, 60), d: Math.max(d + 20, 60), h: hh }, hero: hero < 0 ? p.length - 1 : hero, anchor: [0, 0, hh], layers: Math.max(...p.map(q => q.ex ?? 0)) };
}

/** A composed part is usable: inside the footprint, enough solids, finite numbers. */
export function partErrors(p: Part): string[] {
  const e: string[] = [];
  if (p.prims.length < 2) e.push('fewer than 2 solids');
  if (p.fp.w > 172 || p.fp.d > 172) e.push(`footprint ${p.fp.w}x${p.fp.d} beyond 160`);
  if (!p.prims.every(q => [q.x, q.y, q.z, q.h].every(Number.isFinite))) e.push('non-finite geometry');
  return e;
}
