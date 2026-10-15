/**
 * Anatomy's solids, as data. Every part, prop and improvised object is a list of these, drawn by ./iso.ts with the
 * same shading, line weights and tone hierarchy (GRAMMAR.md §2-3):
 *   box    a rounded-rectangle plan extruded up (z)
 *   cyl    a circle extruded up; `r2` makes it a frustum / cone (top radius)
 *   gear   a toothed ring extruded up
 *   ball   a sphere (a shaded disc)
 *   prism  any convex profile (u across, v up) extruded along a horizontal axis (x or y): wheels, lying pipes, gable
 *          roofs, wings, blades, tilted panels. `rot`/`spin` turn the profile in its own plane (a turbine's blades).
 * Tones: lo = base, mid = structure, hi = the subject, acc = the brand's ink (one small element), dark = glass/rubber.
 */
export type Tone = 'lo' | 'mid' | 'hi' | 'acc' | 'dark';
export interface Prim {
  k: 'box' | 'cyl' | 'ball' | 'gear' | 'prism';
  x: number; y: number; z: number; w?: number; d?: number; h: number; r?: number; r2?: number; n?: number; teeth?: number; spin?: number; t: Tone; ex?: number; deco?: object[];
  /** prism: profile points [u, v] (u across the axis, v up, relative to (x|y, z)), axis, length along it */
  poly?: number[][]; ax?: 'x' | 'y'; len?: number; rot?: number;
  /** prism: a disc on the visible end cap (fraction of the profile's size), and a grid on one side face */
  hub?: number; grid?: { e: number; nu: number; nv: number };
}
export interface Part { prims: Prim[]; fp: { w: number; d: number; h: number }; hero: number; anchor: [number, number, number]; layers: number }

export const box = (x: number, y: number, z: number, w: number, d: number, h: number, t: Tone, ex = 0, r = 3, deco: object[] = []): Prim => ({ k: 'box', x, y, z, w, d, h, r, t, ex, deco });
export const cyl = (x: number, y: number, z: number, r: number, h: number, t: Tone, ex = 0, deco: object[] = [], n = 32): Prim => ({ k: 'cyl', x, y, z, r, h, t, ex, deco, n });
export const cone = (x: number, y: number, z: number, r: number, r2: number, h: number, t: Tone, ex = 0, deco: object[] = [], n = 32): Prim => ({ k: 'cyl', x, y, z, r, r2, h, t, ex, deco, n });
export const ball = (x: number, y: number, z: number, r: number, t: Tone, ex = 0): Prim => ({ k: 'ball', x, y, z, r, h: 0, t, ex });
export const prism = (x: number, y: number, z: number, poly: number[][], len: number, ax: 'x' | 'y', t: Tone, ex = 0, o: Partial<Prim> = {}): Prim => ({ k: 'prism', x, y, z, poly, len, ax, h: 0, t, ex, ...o });
/** a ring profile (for a lying cylinder: a wheel, a pipe, a fuselage) */
export const disc = (r: number, n = 22) => Array.from({ length: n }, (_, i) => { const a = i / n * Math.PI * 2; return [r * Math.cos(a), r * Math.sin(a)]; });
/** a cylinder lying along x or y, its axis at height z */
export const hcyl = (x: number, y: number, z: number, r: number, len: number, ax: 'x' | 'y', t: Tone, ex = 0, hub = 0.45): Prim => prism(x, y, z, disc(r), len, ax, t, ex, { hub });

/** screws near the corners of a box's top (u/v inset) */
export const screws = (iu = 0.08, iv = 0.08, r = 2.2) => ({ d: 'dots', p: [[iu, iv], [1 - iu, iv], [1 - iu, 1 - iv], [iu, 1 - iv]], r });
export const rows = (n: number, u0: number, u1: number, v0: number, v1: number) => Array.from({ length: n }, (_, i) => { const v = v0 + (v1 - v0) * (i + 0.5) / n; return [[u0, v], [u1, v]]; });
export const cols = (n: number, u0: number, u1: number, v0: number, v1: number) => Array.from({ length: n }, (_, i) => { const u = u0 + (u1 - u0) * (i + 0.5) / n; return [[u, v0], [u, v1]]; });
export const grid = (nu: number, nv: number) => [...rows(nv, 0.08, 0.92, 0.08, 0.92), ...cols(nu, 0.08, 0.92, 0.08, 0.92)];
/** a closed ellipse in a face's (u, v) space (a dial, a speaker cone, a porthole) */
export const ring = (u: number, v: number, ru: number, rv: number, n = 20) => Array.from({ length: n + 1 }, (_, i) => { const a = i / n * Math.PI * 2; return [u + ru * Math.cos(a), v + rv * Math.sin(a)]; });

/** Scale a part about its slot's origin (a scale comparison, a fleet in miniature, a hero on a turntable). */
export function scalePart(p: Part, k: number): Part {
  if (k === 1) return p;
  const s = (pr: Prim): Prim => {
    const q: Prim = { ...pr, x: pr.x * k, y: pr.y * k, z: pr.z * k, h: pr.h * k };
    if (pr.w != null) q.w = pr.w * k; if (pr.d != null) q.d = pr.d * k; if (pr.r != null) q.r = pr.r * k; if (pr.r2 != null) q.r2 = pr.r2 * k;
    if (pr.len != null) q.len = pr.len * k; if (pr.poly) q.poly = pr.poly.map(([u, v]) => [u! * k, v! * k]);
    if (pr.deco) q.deco = (pr.deco as Record<string, unknown>[]).map(d => (d.d === 'text' ? { ...d, s: Math.max(8, Number(d.s) * k) } : d.d === 'dots' ? { ...d, r: Number(d.r ?? 2.4) * Math.sqrt(k) } : d));
    return q;
  };
  return { prims: p.prims.map(s), fp: { w: p.fp.w * k, d: p.fp.d * k, h: p.fp.h * k }, hero: p.hero, anchor: [p.anchor[0] * k, p.anchor[1] * k, p.anchor[2] * k], layers: p.layers };
}

/** A part with one tone swapped (an accented instance in a grid, a ghosted "before" part). */
export function retone(p: Part, from: Tone, to: Tone): Part { return { ...p, prims: p.prims.map(q => (q.t === from ? { ...q, t: to } : q)) }; }
