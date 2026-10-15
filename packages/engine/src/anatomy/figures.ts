/**
 * Anatomy's figure layouts: one function per figure type in ./library.ts. Each takes a section's parts (named by the
 * script, timed on the voice) and lays out a technical figure in world units: where each assembly stands and how it
 * moves (keys, entry vectors, explodes), the links between them (pipes, wires, tracks), the structure around them
 * (props: rails, levels, cabinets, dials, columns), its annotations (dimension lines, trails, guides, ghost housings,
 * hatched cuts, tags), the ground it stands on and how the camera looks at it. Everything is drawn by ./iso.ts, so
 * every figure obeys the same laws (projection, tones, line weights, springs). No figure invents a fact: tags are
 * figure furniture (BEFORE/AFTER, 01/02, A/B, L1) or a number the voice says.
 */
import type { Spec } from '../styles/kit/compose';
import { composePart, sketchPart } from './improv';
import { box, cyl, scalePart, retone, type Part, type Prim } from './prims';
import type { Figure } from './library';

export interface Asm { id: string; name: string; note: string; kind: string; x: number; y: number; z: number; prims: Prim[]; fp: Part['fp']; hero: number; anchor: [number, number, number]; layers: number; tIn: number; ex: [number, number][]; enter?: number[]; keys?: number[][]; ghost?: number; tOut?: number; look?: string; src: number }
export interface Link { a: number; b: number; route: number[][]; kind: 'pipe' | 'wire' | 'track'; tIn: number; tFlow: number; loop?: boolean; dir?: number; spacing?: number }
export interface Prop { p: Prim; tIn: number; layer?: 'under' | 'sort'; base?: boolean; grow?: [number, number] | [number, number, number]; needle?: [number, number, number]; keys?: number[][]; drop?: number }
export interface Line { k: 'dim' | 'trail' | 'guide' | 'ghost' | 'hatch'; pts: number[][]; t0: number; t1?: number; text?: string; off?: number[] }
export interface Tag { text: string; at: number[]; t0: number; t1?: number; size?: number; tone?: 'acc' | 'hi' | 'muted' }
export interface Label { asm: number; at?: number[]; text: string; sub: string; t0: number; t1: number; side?: 'L' | 'R' }
export interface Ground { k: 'plate' | 'round' | 'sheet' | 'twin' | 'none'; w: number; d: number; r?: number; at?: number[][]; cx?: number; cy?: number; label?: string; spin?: number }
export interface View { az: number; el: number; orbit: number; sweep?: number; fit?: number; zcap?: number; shift?: [number, number]; w?: number; h?: number; push: boolean }
export interface Detail { asm: number; t0: number; t1: number; pts: [number, number[]][]; c: [number, number]; r: number; zoom: number; name: string }

export interface PartIn { id: string; kind: string; name: string; note: string; tIn: number; tEx: number | null; tLabel: number | null; g: Part; key: boolean }
export interface FigIn {
  t0: number; t1: number; parts: PartIn[]; variant: string; brand: string; text: string; seed: number;
  /** a spoken number with its noun ("40 countries"), or null */
  number: string | null;
  /** parts of the film's earlier sections (a recap draws them) */
  all: PartIn[];
  /** any part by kind (library or improvised) */
  partFor: (kind: string) => Part;
}
export interface LinkIn { a: number; b: number; kind?: Link['kind']; route?: number[][]; tFlow?: number; tIn?: number; loop?: boolean; dir?: number; spacing?: number }
export interface FigOut { asms: Asm[]; links: LinkIn[]; props: Prop[]; lines: Line[]; tags: Tag[]; ground: Ground; view: View; detail?: Detail; labels?: Label[]; noAuto?: boolean }

const SLOT = 212;
export const rng = (seed: number) => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

/** an assembly from a part, at (x, y, z), optionally scaled / retoned */
export function A(p: PartIn, x: number, y: number, z = 0, o: Partial<Asm> & { sc?: number; tone?: [Part['prims'][number]['t'], Part['prims'][number]['t']] } = {}, src = -1): Asm {
  let g = o.sc && o.sc !== 1 ? scalePart(p.g, o.sc) : p.g;
  if (o.tone) g = retone(g, o.tone[0], o.tone[1]);
  const { sc: _s, tone: _t, ...rest } = o; void _s; void _t;
  return { id: p.id, name: p.name, note: p.note, kind: p.kind, x, y, z, prims: g.prims, fp: g.fp, hero: g.hero, anchor: g.anchor, layers: g.layers, tIn: p.tIn, ex: [], src, ...rest };
}
const rep = (p: PartIn, tIn: number, g?: Part): PartIn => ({ ...p, tIn, g: g ?? p.g, key: false });

/** an L-shaped route between two assemblies' footprints (axis-aligned legs, trimmed to leave and land at their edges) */
export function lroute(A0: { x: number; y: number; fp: Part['fp'] }, B0: { x: number; y: number; fp: Part['fp'] }, z = 0): number[][] {
  const pts: number[][] = A0.x === B0.x || A0.y === B0.y ? [[A0.x, A0.y, z], [B0.x, B0.y, z]] : [[A0.x, A0.y, z], [B0.x, A0.y, z], [B0.x, B0.y, z]];
  const trim = (p: number[], q: number[], fp: Part['fp']) => { const dx = Math.sign(q[0]! - p[0]!), dy = Math.sign(q[1]! - p[1]!); return [p[0]! + dx * (fp.w / 2 + 14), p[1]! + dy * (fp.d / 2 + 14), z]; };
  pts[0] = trim(pts[0]!, pts[1]!, A0.fp); pts[pts.length - 1] = trim(pts[pts.length - 1]!, pts[pts.length - 2]!, B0.fp);
  return pts;
}
/** a straight wire between two assemblies, leaving and landing at their footprint's edge */
function wroute(A0: Asm, B0: Asm, z = 8): number[][] {
  const dx = B0.x - A0.x, dy = B0.y - A0.y, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
  const ra = Math.min(A0.fp.w, A0.fp.d) / 2 + 10, rb = Math.min(B0.fp.w, B0.fp.d) / 2 + 10;
  return [[A0.x + ux * ra, A0.y + uy * ra, A0.z + z], [B0.x - ux * rb, B0.y - uy * rb, B0.z + z]];
}
const chain = (n: number, kind: Link['kind'] = 'pipe'): LinkIn[] => Array.from({ length: Math.max(0, n - 1) }, (_, i) => ({ a: i, b: i + 1, kind }));
const fitScale = (g: Part, w: number, h: number, cap = 1) => Math.min(cap, w / Math.max(g.fp.w, g.fp.d), h / Math.max(1, g.fp.h));
const V = (o: Partial<View> = {}): View => ({ az: 45, el: 32, orbit: 9, push: true, ...o });
const spaced = (t0: number, t1: number, n: number, i: number) => t0 + (t1 - t0) * (n <= 1 ? 0 : i / (n - 1));
const later = (p: PartIn | undefined, d: number) => (p ? p.tIn + d : 0);

/* ───────────────────────── the figures ───────────────────────── */

function bench(f: FigIn): FigOut {
  let ps = f.parts;
  if (f.variant === 'recap') {
    const seen = new Set<string>(), pool = [...f.all, ...f.parts].filter(p => p.key && !seen.has(p.kind) && (seen.add(p.kind), true));
    ps = (pool.length >= 2 ? pool : f.parts).slice(-6).map((p, i) => ({ ...p, tIn: f.t0 + 0.12 + i * 0.3, tLabel: null, tEx: null }));
  }
  const n = ps.length, ncol = n <= 2 ? n : n <= 4 ? 2 : 3, nrow = Math.ceil(n / ncol);
  const slots: [number, number][] = []; for (let r = 0; r < nrow; r++) for (let c = 0; c < ncol; c++) slots.push([r % 2 ? ncol - 1 - c : c, r]);
  const asms = ps.map((p, i) => A(p, (slots[i]![0] - (ncol - 1) / 2) * SLOT, (slots[i]![1] - (nrow - 1) / 2) * SLOT, 0, {}, f.variant === 'recap' ? (i < 2 ? i : -1) : i));
  const w = (ncol - 1) * SLOT + 160 + 124, d = (nrow - 1) * SLOT + 160 + 124;
  return { asms, links: chain(n), props: [], lines: [], tags: [], ground: { k: 'plate', w, d }, view: V({ push: f.variant !== 'recap' }) };
}

function stack(f: FigIn): FigOut {
  const ps = f.parts.slice(0, 4);
  const hs = ps.map(p => p.g.fp.h), tot = hs.reduce((a, b) => a + b, 0) + 12 * (ps.length - 1), k = Math.min(1, 380 / tot, 150 / Math.max(...ps.map(p => Math.max(p.g.fp.w, p.g.fp.d))) * 1.15);
  const last = Math.max(...ps.map(p => p.tIn));
  const ts = Math.min(f.t1 - 1.6, Math.max(last + 0.8, ps.find(p => p.tEx != null)?.tEx ?? f.t0 + (f.t1 - f.t0) * 0.5));
  const G = f.variant === 'spine' ? 64 : 84;
  let z = 0; const asms = ps.map((p, i) => { const a = A(p, 0, 0, z, { sc: k }, i); a.keys = [[f.t0, 0, 0, z], [ts + i * 0.05, 0, 0, z + i * G]]; z += p.g.fp.h * k + 12; return a; });
  const top = z + (ps.length - 1) * G, rr = Math.max(...asms.map(a => Math.max(a.fp.w, a.fp.d))) / 2 + 40;
  const props: Prop[] = [], lines: Line[] = [];
  if (f.variant === 'spine') {
    props.push({ p: cyl(0, 0, 0, 7, top + 30, 'mid', 0, [{ d: 'seams', z: [0.25, 0.5, 0.75], t: 'faint' }], 14), tIn: f.t0 + 0.05, layer: 'under', drop: 0, grow: [ts, 0.9, (z + 20) / (top + 30)] });
    for (const [x, y] of [[rr - 30, -(rr - 30)], [-(rr - 30), rr - 30]]) lines.push({ k: 'guide', pts: [[x!, y!, 0], [x!, y!, top + 20]], t0: ts });
  }
  return { asms, links: [], props, lines, tags: [], ground: { k: 'round', w: rr * 2, d: rr * 2, r: rr + 20 }, view: V({ el: 22, orbit: 7 }) };
}

function cutaway(f: FigIn): FigOut {
  if (f.variant === 'open') {
    const h = f.parts[0]!, k = Math.min(1.5, fitScale(h.g, 240, 220) * 1.5), a = A(h, 0, 0, 0, { sc: k }, 0);
    const tOpen = Math.max(h.tIn + 1, h.tEx ?? f.t0 + (f.t1 - f.t0) * 0.35);
    a.ex = a.layers >= 1 ? [[tOpen, f.t1 + 1]] : [];
    const asms = [a], R = Math.max(a.fp.w, a.fp.d) / 2 + 30;
    f.parts.slice(1, 3).forEach((p, i) => asms.push(A(p, i ? -R - 70 : R + 70, i ? R + 40 : -R - 40, 0, { sc: 0.55 }, i + 1)));
    const H = a.fp.h + a.layers * 64 + 30;
    const lines: Line[] = [{ k: 'guide', pts: [[-R, 0, 0], [R, 0, 0], [R, 0, H], [-R, 0, H], [-R, 0, 0]], t0: tOpen - 0.2 }];
    const tags: Tag[] = [{ text: 'A', at: [-R - 26, 0, H + 10], t0: tOpen, size: 26, tone: 'acc' }, { text: 'A', at: [R + 26, 0, H + 10], t0: tOpen, size: 26, tone: 'acc' }];
    return { asms, links: [], props: [], lines, tags, ground: { k: 'plate', w: 2 * R + 260, d: 2 * R + 200 }, view: V({ el: 28 }) };
  }
  const ps = f.parts.slice(0, 4), n = ps.length, sp = 150, ncol = n <= 2 ? n : 2, nrow = Math.ceil(n / ncol);
  const asms = ps.map((p, i) => A(p, ((i % ncol) - (ncol - 1) / 2) * sp, (Math.floor(i / ncol) - (nrow - 1) / 2) * sp, 0, { sc: 0.68 }, i));
  const x0 = -((ncol - 1) * sp) / 2 - 92, x1 = -x0, y0 = -((nrow - 1) * sp) / 2 - 92, y1 = -y0, H = Math.max(...asms.map(a => a.fp.h)) + 46, w = 14, t = f.t0 + 0.05;
  const hatch = (pts: number[][]): Line => ({ k: 'hatch', pts, t0: t + 0.3 });
  const lines: Line[] = [{ k: 'ghost', pts: [[x0, y0, 0], [x1, y1, H]], t0: t },
    hatch([[x0, y1 - w, H], [x1, y1 - w, H], [x1, y1, H], [x0, y1, H]]), hatch([[x1 - w, y0, H], [x1, y0, H], [x1, y1, H], [x1 - w, y1, H]]),
    hatch([[x0, y0, H], [x1, y0, H], [x1, y0 + w, H], [x0, y0 + w, H]]), hatch([[x0, y0, H], [x0 + w, y0, H], [x0 + w, y1, H], [x0, y1, H]])];
  return { asms, links: chain(n, 'wire'), props: [], lines, tags: [], ground: { k: 'plate', w: x1 - x0 + 120, d: y1 - y0 + 120 }, view: V({ push: false, orbit: 12 }) };
}

function pipeline(f: FigIn): FigOut {
  const ps = f.parts.slice(0, 6), n = ps.length;
  if (f.variant === 'zigzag' && n >= 4) {
    const half = Math.ceil(n / 2), asms = ps.map((p, i) => { const r = i < half ? 0 : 1, c = r === 0 ? i : n - 1 - i; return A(p, (c - (half - 1) / 2) * 200, (r - 0.5) * 230, 0, { sc: 0.82 }, i); });
    return { asms, links: chain(n), props: [], lines: [], tags: ps.map((p, i) => ({ text: String(i + 1).padStart(2, '0'), at: [asms[i]!.x + 70, asms[i]!.y + 84, 0], t0: p.tIn + 0.2, size: 22, tone: 'muted' as const })), ground: { k: 'plate', w: half * 200 + 120, d: 230 + 260 }, view: V() };
  }
  const k = n > 4 ? 0.78 : 0.9, sp = 200 * (n > 4 ? 0.92 : 1), L = (n - 1) * sp;
  const asms = ps.map((p, i) => A(p, i * sp - L / 2, 0, 16, { sc: k }, i));
  const props: Prop[] = [{ p: box(-L / 2 - 110, -60, 0, L + 220, 120, 16, 'lo', 0, 10, [{ d: 'top', l: Array.from({ length: Math.round((L + 220) / 24) }, (_, i) => [[(i + 0.5) / Math.round((L + 220) / 24), 0.08], [(i + 0.5) / Math.round((L + 220) / 24), 0.92]]), t: 'faint' }, { d: 'face', f: 'y', l: [[[0.01, 0.5], [0.99, 0.5]]], t: 'faint' }]), tIn: f.t0 + 0.02, base: true, drop: 30 }];
  const route = [[-L / 2 - 90, 52, 16], [L / 2 + 90, 52, 16]];
  return {
    asms, links: [{ a: 0, b: n - 1, kind: 'wire', route, tFlow: later(ps[1], 0.3), spacing: 60 }], props,
    lines: [{ k: 'trail', pts: [[L / 2 + 60, 100, 0], [L / 2 + 150, 100, 0]], t0: later(ps[n - 1], 0.5) }],
    tags: ps.map((p, i) => ({ text: String(i + 1).padStart(2, '0'), at: [asms[i]!.x, 104, 0], t0: p.tIn + 0.15, size: 22, tone: 'muted' as const })),
    ground: { k: 'sheet', w: L + 320, d: 360 }, view: V({ az: 34, el: 30 }),
  };
}

function hub(f: FigIn): FigOut {
  const c = f.parts[0]!, sats = f.parts.slice(1, 7), n = sats.length, R = n > 4 ? 270 : n > 2 ? 240 : 210, k = n > 4 ? 0.72 : 0.82;
  const asms = [A(c, 0, 0, 0, {}, 0)];
  sats.forEach((p, i) => { const a = (200 + i * 360 / Math.max(3, n)) * Math.PI / 180; asms.push(A(p, Math.cos(a) * R, Math.sin(a) * R, 0, { sc: k }, i + 1)); });
  const links: LinkIn[] = sats.map((_, i) => ({ a: 0, b: i + 1, kind: 'wire' as const, dir: i % 2 ? -1 : 1, spacing: 70 }));
  if (f.variant === 'ring') links.push({ a: 1, b: 1, kind: 'track', route: Array.from({ length: 49 }, (_, i) => [Math.cos(i / 48 * Math.PI * 2) * R, Math.sin(i / 48 * Math.PI * 2) * R, 2]), loop: true, tIn: f.t0 + 0.4, tFlow: later(sats[n - 1], 0.4), spacing: 110 });
  return { asms, links, props: [], lines: [], tags: [], ground: { k: 'round', w: 2 * R + 200, d: 2 * R + 200, r: R + 95 }, view: V({ el: 36 }) };
}

function loop(f: FigIn): FigOut {
  const R = 230;
  if (f.variant === 'orbit') {
    const c = f.parts[0]!, sats = f.parts.slice(1, 5), n = Math.max(1, sats.length), asms = [A(c, 0, 0, 0, { sc: 1.05 }, 0)];
    const notches = [f.t0 + (f.t1 - f.t0) * 0.45, f.t0 + (f.t1 - f.t0) * 0.7].filter(t => t < f.t1 - 1);
    sats.forEach((p, i) => {
      const at = (deg: number) => { const a = deg * Math.PI / 180; return [Math.cos(a) * R, Math.sin(a) * R, 0]; };
      const a0 = 210 + i * 360 / n, s = at(a0), a = A(p, s[0]!, s[1]!, 0, { sc: 0.66 }, i + 1);
      a.keys = [[f.t0, ...s], ...notches.map((t, k) => [t + i * 0.05, ...at(a0 + (k + 1) * 30)])];
      asms.push(a);
    });
    const track: LinkIn = { a: 0, b: 0, kind: 'track', route: Array.from({ length: 49 }, (_, i) => [Math.cos(i / 48 * Math.PI * 2) * R, Math.sin(i / 48 * Math.PI * 2) * R, 2]), loop: true, tIn: f.t0 + 0.2, tFlow: later(sats[0], 0.6), spacing: 120 };
    return { asms, links: [track], props: [], lines: [], tags: [], ground: { k: 'round', w: 2 * R + 220, d: 2 * R + 220, r: R + 110, spin: 4 }, view: V({ el: 38 }) };
  }
  const ps = f.parts.slice(0, 5), n = ps.length, ang = (i: number) => (225 + i * 360 / n) * Math.PI / 180;
  const asms = ps.map((p, i) => A(p, Math.cos(ang(i)) * R, Math.sin(ang(i)) * R, 0, { sc: n > 3 ? 0.68 : 0.78 }, i));
  const arc = (a0: number, a1: number) => Array.from({ length: 9 }, (_, k) => { const a = a0 + (a1 - a0) * k / 8; return [Math.cos(a) * (R + 0), Math.sin(a) * R, 40]; });
  const step = 2 * Math.PI / n, gap = Math.min(0.42, step * 0.3);
  return {
    asms, links: [{ a: 0, b: 0, kind: 'track', route: Array.from({ length: 49 }, (_, i) => [Math.cos(i / 48 * Math.PI * 2) * R, Math.sin(i / 48 * Math.PI * 2) * R, 2]), loop: true, tIn: f.t0 + 0.2, tFlow: later(ps[1], 0.3), spacing: 100 }],
    props: [], lines: ps.map((p, i) => ({ k: 'trail' as const, pts: arc(ang(i) + gap, ang(i) + step - gap), t0: p.tIn + 0.5 })), tags: [],
    ground: { k: 'round', w: 2 * R + 220, d: 2 * R + 220, r: R + 110 }, view: V({ el: 40 }),
  };
}

function tower(f: FigIn): FigOut {
  const L = f.variant === 'three' ? 3 : 2, ps = f.parts.slice(0, L * 2), H = 175, S = 320, props: Prop[] = [], asms: Asm[] = [], links: LinkIn[] = [], tags: Tag[] = [];
  const per = Math.ceil(ps.length / L);
  for (let l = 0; l < L; l++) {
    const z = l * H, t = f.t0 + 0.05 + l * 0.12;
    if (l > 0) {
      props.push({ p: box(-S / 2, -S / 2, z - 12, S, S, 12, 'lo', 0, 8, [{ d: 'top', l: [[[0.04, 0.04], [0.96, 0.04], [0.96, 0.96], [0.04, 0.96], [0.04, 0.04]]], t: 'faint' }, { d: 'dots', p: [[0.04, 0.04], [0.96, 0.04], [0.96, 0.96], [0.04, 0.96]], r: 2.6 }]), tIn: t, base: true });
      for (const [x, y] of [[-S / 2 + 12, -S / 2 + 12], [S / 2 - 12, -S / 2 + 12], [-S / 2 + 12, S / 2 - 12], [S / 2 - 12, S / 2 - 12]]) props.push({ p: cyl(x!, y!, (l - 1) * H, 7, H - 12, 'mid', 0, [], 14), tIn: t });
    }
    tags.push({ text: `L${l + 1}`, at: [S / 2 + 20, S / 2 + 20, z], t0: t + 0.2, size: 22, tone: 'muted' });
    const mine = ps.slice(l * per, l * per + per);
    mine.forEach((p, j) => { const off = mine.length === 1 ? 0 : (j - 0.5) * 150; asms.push(A(p, off, -off, z, { sc: mine.length === 1 ? 0.85 : 0.7 }, l * per + j)); });
  }
  for (let l = 0; l < L - 1; l++) links.push({ a: 0, b: 0, kind: 'wire', route: [[S / 2 - 40, 30, l * H + 4], [S / 2 - 40, 30, (l + 1) * H]], tFlow: f.t0 + (f.t1 - f.t0) * (0.35 + l * 0.2), spacing: 50 });
  return { asms, links, props, lines: [], tags, ground: { k: 'plate', w: S + 90, d: S + 90 }, view: V({ el: 24, orbit: 7 }) };
}

function grid(f: FigIn): FigOut {
  const v = f.variant, hero = f.parts[0]!;
  const kinds = v === 'crowd' ? ['pawn'] : v === 'city' ? ['house', 'office', 'shop', 'warehouse', 'house'] : [hero.kind];
  const [nx, ny, sp, k] = v === 'crowd' ? [5, 4, 96, 1] : v === 'city' ? [4, 3, 150, 0.62] : [4, 3, 150, Math.min(0.62, fitScale(hero.g, 130, 200) * 0.9)];
  const asms: Asm[] = [], hx = Math.floor(nx / 2), hy = ny - 1;
  for (let r = 0; r < ny; r++) for (let c = 0; c < nx; c++) {
    const x = (c - (nx - 1) / 2) * sp, y = (r - (ny - 1) / 2) * sp, t = f.t0 + 0.12 + (r + c) * 0.07;
    if (c === hx && r === hy) { asms.push(A(hero, x, y, 0, { sc: v === 'crowd' ? (hero.kind === 'pawn' ? 1.15 : fitScale(hero.g, 120, 150)) : k * 1.08, tone: ['hi', 'acc'], tIn: Math.max(hero.tIn, t + 0.3) }, 0)); continue; }
    if (f.parts[1] && c === 0 && r === hy) { asms.push(A(f.parts[1], x, y, 0, { sc: k, tIn: Math.max(f.parts[1].tIn, t) }, 1)); continue; }
    const kind = kinds[(r * nx + c) % kinds.length]!, g = kind === hero.kind ? hero.g : f.partFor(kind);
    asms.push(A(rep(hero, t, g), x, y, 0, { sc: k, kind, name: kind, look: v === 'fleet' ? '' : '' }));
  }
  const W = (nx - 1) * sp + 200, D = (ny - 1) * sp + 200;
  const lines: Line[] = f.number ? [{ k: 'dim', pts: [[-W / 2 + 60, D / 2 - 40, 0], [W / 2 - 60, D / 2 - 40, 0]], off: [0, 70, 0], text: f.number, t0: f.t0 + 1 }] : [];
  return { asms, links: [], props: [], lines, tags: [], ground: v === 'city' ? { k: 'plate', w: W + 40, d: D + 40 } : { k: 'sheet', w: W + 120, d: D + 140 }, view: V({ el: 38 }) };
}

function scale(f: FigIn): FigOut {
  const a = f.parts[0]!, b = f.parts[1] ?? f.parts[0]!;
  if (f.variant === 'steps') {
    const base = fitScale(a.g, 150, 170, 1.4), ks = [0.55, 0.95, 1.4].map(x => x * base), pos = [[-215, 0], [0, 0], [225, 0]];
    const ts = [a.tIn, Math.max(a.tIn + 0.7, spaced(f.t0, f.t1 - 1.5, 3, 1)), Math.max(a.tIn + 1.4, spaced(f.t0, f.t1 - 1.5, 3, 2))];
    const asms = ks.map((k, i) => A({ ...a, tIn: ts[i]! }, pos[i]![0]!, pos[i]![1]!, 0, { sc: k, tone: i === 2 ? ['hi', 'acc'] : undefined }, i === 2 ? 0 : -1));
    const tops = asms.map(x => [x.x + 40, x.y + 40, x.fp.h + 30]);
    const lines: Line[] = [{ k: 'trail', pts: tops, t0: ts[2]! + 0.5 }];
    const tags: Tag[] = f.number ? [{ text: f.number, at: [asms[2]!.x, asms[2]!.y, asms[2]!.fp.h + 90], t0: ts[2]! + 0.7, size: 34, tone: 'acc' }] : [];
    return { asms, links: [], props: [], lines, tags, ground: { k: 'plate', w: 700, d: 300 }, view: V({ az: 64, el: 28 }) };
  }
  const ka = 0.5 * fitScale(a.g, 160, 200, 1.3), kb = 1.6 * fitScale(b.g, 160, 200, 1.3);
  const sa = A(a, -190, 0, 0, { sc: ka }, 0), sb = A({ ...b, tIn: Math.max(b.tIn, a.tIn + 0.8) }, 90, 0, 0, { sc: kb }, b === a ? -1 : 1);
  if (b === a) { sb.src = 0; sa.src = -1; }
  const ha = sa.fp.h, hb = sb.fp.h, ta = sa.tIn + 0.6, tb = sb.tIn + 0.7;
  const lines: Line[] = [
    { k: 'dim', pts: [[sa.x + sa.fp.w / 2, sa.y + sa.fp.d / 2, 0], [sa.x + sa.fp.w / 2, sa.y + sa.fp.d / 2, ha]], off: [40, 40, 0], t0: ta },
    { k: 'dim', pts: [[sb.x + sb.fp.w / 2, sb.y + sb.fp.d / 2, 0], [sb.x + sb.fp.w / 2, sb.y + sb.fp.d / 2, hb]], off: [50, 50, 0], text: f.number ?? undefined, t0: tb },
    { k: 'guide', pts: [[sa.x, sa.y, ha], [sb.x, sb.y, ha]], t0: tb + 0.3 },
  ];
  return { asms: [sa, sb], links: [], props: [], lines, tags: [], ground: { k: 'plate', w: 640, d: 340, cx: -40 }, view: V({ az: 64, el: 28 }) };
}

function twin(f: FigIn): FigOut {
  const L = [-185, -185], R = [185, 185], ps = f.parts.slice(0, 6), half = Math.max(1, Math.ceil(ps.length / 2));
  const left = ps.slice(0, half), right0 = ps.slice(half), turn = Math.max(f.t0 + (f.t1 - f.t0) * 0.42, (right0[0]?.tIn ?? 0));
  const right = (right0.length ? right0 : left).map((p, i) => ({ ...p, tIn: Math.max(p.tIn, turn + i * 0.25), key: right0.length > 0 && p.key }));
  const rnd = rng(f.seed), asms: Asm[] = [], links: LinkIn[] = [];
  const before = f.variant === 'before';
  left.forEach((p, i) => {
    const j = before ? [(rnd() - 0.5) * 110, (rnd() - 0.5) * 110] : [0, 0], off = (i - (left.length - 1) / 2) * 110;
    asms.push(A(p, L[0]! + off + j[0]!, L[1]! - off + j[1]!, 0, { sc: left.length > 2 ? 0.52 : 0.62, ...(before ? { look: 'ghost', ghost: 0.8 } : {}) }, i));
  });
  right.forEach((p, i) => { const off = (i - (right.length - 1) / 2) * 110; asms.push(A(p, R[0]! + off, R[1]! - off, 0, { sc: right.length > 2 ? 0.52 : 0.62 }, right0.length ? half + i : -1)); });
  for (let i = 0; i + 1 < left.length; i++) {
    const a = asms[i]!, b = asms[i + 1]!, mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    links.push(before ? { a: i, b: i + 1, kind: 'wire', route: [[a.x, a.y + 60, 6], [mx + 70, my - 60, 6], [mx - 60, my + 70, 6], [b.x - 60, b.y, 6]], spacing: 45 } : { a: i, b: i + 1, kind: 'wire' });
  }
  for (let i = 0; i + 1 < right.length; i++) links.push({ a: left.length + i, b: left.length + i + 1, kind: 'wire' });
  const tags: Tag[] = [
    { text: before ? 'Before' : 'A', at: [L[0]! + 175, L[1]! - 120, 0], t0: f.t0 + 0.3, size: 24, tone: 'muted' },
    { text: before ? 'After' : 'B', at: [R[0]! + 175, R[1]! - 120, 0], t0: turn, size: 24, tone: 'acc' },
  ];
  if (!before) tags.push({ text: 'vs', at: [0, 0, 60], t0: turn - 0.2, size: 34, tone: 'hi' });
  return { asms, links, props: [], lines: [], tags, ground: { k: 'twin', w: 310, d: 310, at: [L, R] }, view: V({ el: 34, push: false }) };
}

/** the centre of a part's first accent solid (what a detail circle looks at), else its anchor */
function feature(g: Part, tone: string): number[] {
  const p = g.prims.find(q => q.t === tone); if (!p) return [...g.anchor];
  if (p.k === 'box') return [p.x + (p.w ?? 0) / 2, p.y + (p.d ?? 0) / 2, p.z + p.h];
  return [p.x, p.y, p.z + (p.k === 'ball' ? 0 : p.h)];
}
function macro(f: FigIn): FigOut {
  const h = f.parts[0]!, k = fitScale(h.g, 280, 270, 1.8), a = A(h, 0, 0, 0, { sc: k }, 0);
  const g = scalePart(h.g, k), t0 = Math.max(h.tIn + 0.9, h.tLabel ?? f.t0 + (f.t1 - f.t0) * 0.3);
  const pts: [number, number[]][] = [[t0, feature(g, 'acc')]];
  if (f.variant === 'sweep') pts.push([Math.max(t0 + 1.6, f.t0 + (f.t1 - f.t0) * 0.62), feature(g, 'dark')]);
  const asms = [a];
  if (f.parts[1]) asms.push(A(f.parts[1], -230, 60, 0, { sc: 0.5 }, 1));
  return {
    asms, links: f.parts[1] ? [{ a: 1, b: 0, kind: 'wire' }] : [], props: [], lines: [], tags: [],
    ground: { k: 'plate', w: 440, d: 380 }, view: V({ shift: [-120, 200], w: 680, h: 640, push: false }),
    detail: { asm: 0, t0, t1: f.t1 + 1, pts, c: [720, 560], r: 230, zoom: 2.6, name: f.variant === 'sweep' ? 'Detail A / B' : 'Detail A' },
  };
}

function blueprint(f: FigIn): FigOut {
  const props: Prop[] = [], lines: Line[] = [];
  const block = (x: number, y: number) => props.push({ p: box(x, y, 0, 170, 70, 3, 'mid', 0, 3, [{ d: 'text', u: 0.07, v: 0.45, s: 15, text: f.brand.toUpperCase().slice(0, 14), t: 'hi' }, { d: 'top', l: [[[0.07, 0.66], [0.8, 0.66]], [[0.07, 0.82], [0.5, 0.82]], [[0.62, 0.1], [0.62, 0.32]]], t: 'lo' }]), tIn: f.t0 + 0.3, drop: 0 });
  if (f.variant === 'plan') {
    const ps = f.parts.slice(0, 4), n = ps.length, ncol = n <= 2 ? n : 2, sp = 230;
    const asms = ps.map((p, i) => A(p, ((i % ncol) - (ncol - 1) / 2) * sp, (Math.floor(i / ncol) - (Math.ceil(n / ncol) - 1) / 2) * sp, 0, { sc: 0.82 }, i));
    for (const a of asms) { const w = a.fp.w / 2 + 16, d = a.fp.d / 2 + 16; lines.push({ k: 'guide', pts: [[a.x - w, a.y - d, 0], [a.x + w, a.y - d, 0], [a.x + w, a.y + d, 0], [a.x - w, a.y + d, 0], [a.x - w, a.y - d, 0]], t0: a.tIn - 0.3 }); }
    if (n >= 2) lines.push({ k: 'dim', pts: [[asms[0]!.x, asms[0]!.y, 0], [asms[1]!.x, asms[1]!.y, 0]], off: [0, -150, 0], text: 'A', t0: asms[1]!.tIn + 0.6 });
    if (n >= 3) lines.push({ k: 'dim', pts: [[asms[0]!.x, asms[0]!.y, 0], [asms[2]!.x, asms[2]!.y, 0]], off: [-150, 0, 0], text: 'B', t0: asms[2]!.tIn + 0.6 });
    block(110, 250);
    return { asms, links: [], props, lines, tags: [], ground: { k: 'sheet', w: 640, d: 680 }, view: V({ el: 56, orbit: 5 }) };
  }
  const h = f.parts[0]!, k = fitScale(h.g, 270, 260, 1.8), a = A(h, 0, 0, 0, { sc: k }, 0), w = a.fp.w / 2, d = a.fp.d / 2, H = a.fp.h, t = h.tIn + 0.8;
  lines.push({ k: 'guide', pts: [[-w - 12, -d - 12, 0], [w + 12, -d - 12, 0], [w + 12, d + 12, 0], [-w - 12, d + 12, 0], [-w - 12, -d - 12, 0]], t0: f.t0 + 0.1 });
  lines.push({ k: 'dim', pts: [[-w, d, 0], [w, d, 0]], off: [0, 70, 0], text: 'A', t0: t });
  lines.push({ k: 'dim', pts: [[w, -d, 0], [w, d, 0]], off: [70, 0, 0], text: 'B', t0: t + 0.35 });
  lines.push({ k: 'dim', pts: [[w, d, 0], [w, d, H]], off: [60, 60, 0], text: f.number ?? 'H', t0: t + 0.7 });
  const asms = [a];
  if (f.parts[1]) asms.push(A(f.parts[1], -w - 170, d - 40, 0, { sc: 0.45 }, 1));
  block(w + 30, -d - 170);
  return { asms, links: [], props, lines, tags: [], ground: { k: 'sheet', w: 2 * w + 400, d: 2 * d + 400 }, view: V({ el: 36 }) };
}

function assembly(f: FigIn): FigOut {
  const ps = f.parts.slice(0, 4), n = ps.length, lines: Line[] = [];
  if (f.variant === 'converge') {
    const tGo = Math.min(f.t1 - 1.5, Math.max(Math.max(...ps.map(p => p.tIn)) + 0.9, f.t0 + (f.t1 - f.t0) * 0.55)), sp = 82;
    const fin = [[-sp, -sp], [sp, -sp], [-sp, sp], [sp, sp]], far = fin.map(([x, y]) => [x! * 3.1, y! * 3.1]);
    const asms = ps.map((p, i) => { const a = A(p, far[i]![0]!, far[i]![1]!, 0, { sc: 0.78 }, i); a.keys = [[f.t0, far[i]![0]!, far[i]![1]!, 0], [tGo + i * 0.06, fin[i]![0]!, fin[i]![1]!, 0, 0.7]]; lines.push({ k: 'trail', pts: [[far[i]![0]! * 0.82, far[i]![1]! * 0.82, 4], [fin[i]![0]! * 1.6, fin[i]![1]! * 1.6, 4]], t0: tGo - 0.5, t1: tGo + 0.6 }); return a; });
    lines.push({ k: 'ghost', pts: [[-sp - 86, -sp - 86, 0], [sp + 86, sp + 86, Math.max(...asms.map(a => a.fp.h)) + 20]], t0: tGo + 0.75 });
    return { asms, links: [], props: [], lines, tags: [], ground: { k: 'plate', w: 640, d: 640 }, view: V({ push: false }) };
  }
  const sp = 150, Lx = (n - 1) * sp;
  const asms = ps.map((p, i) => { const x = i * sp - Lx / 2, a = A(p, x, 0, 0, { sc: 0.82, enter: [0, -560, 40] }, i); lines.push({ k: 'trail', pts: [[x, -420, 30], [x, -110, 30]], t0: p.tIn - 0.1, t1: p.tIn + 1.1 }); return a; });
  const last = Math.max(...ps.map(p => p.tIn));
  lines.push({ k: 'ghost', pts: [[-Lx / 2 - 86, -86, 0], [Lx / 2 + 86, 86, Math.max(...asms.map(a => a.fp.h)) + 24]], t0: Math.min(f.t1 - 0.8, last + 0.9) });
  return { asms, links: [], props: [], lines, tags: [], ground: { k: 'plate', w: Lx + 300, d: 420 }, view: V({ push: false }) };
}

function rack(f: FigIn): FigOut {
  const props: Prop[] = [], asms: Asm[] = [];
  const cabinet = (cx: number, W: number, H: number, t: number) => {
    props.push({ p: box(cx - W / 2, -50, 0, W, 100, 10, 'lo', 0, 3), tIn: t, base: true, drop: 20 });
    props.push({ p: box(cx - W / 2, -50, 10, W, 8, H, 'mid', 0, 2, [{ d: 'face', f: 'y', l: [[[0.5, 0.02], [0.5, 0.98]]], t: 'faint' }]), tIn: t });
    props.push({ p: box(cx - W / 2, -50, 10, 8, 100, H, 'mid', 0, 2), tIn: t });
    props.push({ p: box(cx + W / 2 - 8, -50, 10, 8, 100, H, 'mid', 0, 2, [{ d: 'face', f: 'x', l: [[[0.1, 0.03], [0.1, 0.97]]], t: 'faint' }]), tIn: t + 0.04 });
    props.push({ p: box(cx - W / 2, -50, H + 10, W, 100, 8, 'mid', 0, 2, [screws4()]), tIn: t + 0.06 });
  };
  if (f.variant === 'single') {
    const ps = f.parts.slice(0, 4), W = 230, H = 120 * ps.length + 30;
    cabinet(0, W, H, f.t0 + 0.05);
    ps.forEach((p, i) => { const z = 10 + i * 120; if (i) props.push({ p: box(-W / 2 + 8, -42, z - 6, W - 16, 88, 6, 'lo', 0, 2), tIn: f.t0 + 0.1 + i * 0.05, base: true }); asms.push(A(p, 0, 4, z, { sc: Math.min(0.62, fitScale(p.g, 150, 104)) }, i)); });
    return { asms, links: [], props, lines: [], tags: [], ground: { k: 'plate', w: 380, d: 280 }, view: V({ el: 22, az: 40 }) };
  }
  const ps = f.parts.slice(0, 3), m = Math.max(2, ps.length), W = 168, H = 270;
  for (let c = 0; c < m; c++) {
    const cx = (c - (m - 1) / 2) * 190, p = ps[c] ?? ps[c % ps.length]!, t = Math.min(p.tIn, f.t0 + 0.1 + c * 0.15);
    cabinet(cx, W, H, t);
    for (let u = 0; u < 6; u++) props.push({ p: box(cx - W / 2 + 10, -40, 14 + u * 42, W - 20, 82, 34, u === 2 + (c % 3) ? 'acc' : 'hi', 0, 3, [{ d: 'face', f: 'y', l: [[[0.06, 0.5], [0.08, 0.5]], [[0.12, 0.5], [0.14, 0.5]]], t: 'acc', w: 5 }, { d: 'face', f: 'y', l: [[[0.3, 0.3], [0.94, 0.3]], [[0.3, 0.55], [0.94, 0.55]], [[0.3, 0.8], [0.94, 0.8]]], t: 'faint' }]), tIn: t + 0.25 + u * 0.09, drop: 140 });
    asms.push(A({ ...p, tIn: Math.max(p.tIn, t + 0.9) }, cx, 0, H + 18, { sc: Math.min(0.45, fitScale(p.g, 120, 90)) }, c < ps.length ? c : -1));
  }
  return { asms, links: [], props, lines: [], tags: [], ground: { k: 'plate', w: m * 190 + 80, d: 260 }, view: V({ el: 22, az: 40, push: false }) };
}
const screws4 = () => ({ d: 'dots', p: [[0.06, 0.1], [0.94, 0.1], [0.94, 0.9], [0.06, 0.9]], r: 2.2 });

function mesh(f: FigIn): FigOut {
  const ps = f.parts.slice(0, 6), n = ps.length, rnd = rng(f.seed + 7), cells = [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [0, 2], [1, 2], [2, 2]];
  for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [cells[i], cells[j]] = [cells[j]!, cells[i]!]; }
  const asms = ps.map((p, i) => A(p, (cells[i]![0]! - 1) * 210 + (rnd() - 0.5) * 50, (cells[i]![1]! - 1) * 210 + (rnd() - 0.5) * 50, 0, { sc: 0.78, ...(f.variant === 'tangle' && i ? { ghost: 0.85 } : {}) }, i));
  const links: LinkIn[] = [], seen = new Set<string>();
  const add = (a: number, b: number) => { const k = [a, b].sort().join('-'); if (a === b || seen.has(k)) return; seen.add(k); links.push({ a, b, kind: 'wire', dir: links.length % 2 ? -1 : 1, spacing: f.variant === 'tangle' ? 40 : 75 }); };
  if (f.variant === 'tangle') { for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) add(a, b); }
  else for (let a = 0; a < n; a++) asms.map((x, b) => [b, Math.hypot(x.x - asms[a]!.x, x.y - asms[a]!.y)] as [number, number]).filter(([b]) => b !== a).sort((p, q) => p[1] - q[1]).slice(0, 2).forEach(([b]) => add(a, b));
  const xs = asms.map(a => a.x), ys = asms.map(a => a.y), cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  for (const a of asms) { a.x -= cx; a.y -= cy; }
  const W = Math.max(...xs) - Math.min(...xs) + 280, D = Math.max(...ys) - Math.min(...ys) + 280;
  return { asms, links: links.slice(0, 10), props: [], lines: [], tags: [], ground: { k: f.variant === 'tangle' ? 'plate' : 'sheet', w: W, d: D }, view: V({ el: 40 }) };
}

function funnel(f: FigIn): FigOut {
  const props: Prop[] = [], asms: Asm[] = [], links: LinkIn[] = [], labels: Label[] = [];
  if (f.variant === 'sieve') {
    const zs = [330, 220, 110];
    zs.forEach((z, i) => {
      const t = f.t0 + 0.1 + i * 0.12;
      props.push({ p: cyl(0, 0, z, 130 - i * 14, 8, 'mid', 0, [{ d: 'rings', r: [0.25, 0.5, 0.75], t: 'lo' }, { d: 'spokes', n: 16, r0: 0.1, r1: 0.96, t: 'lo' }], 48), tIn: t, base: true });
      for (const a of [45, 165, 285]) { const r = (130 - i * 14) - 8, x = Math.cos(a * Math.PI / 180) * r, y = Math.sin(a * Math.PI / 180) * r; props.push({ p: cyl(x, y, 0, 5, z, 'lo', 0, [], 12), tIn: t }); }
      const p = f.parts[i + 1]; if (p) labels.push({ asm: -1, at: [130 - i * 14, 0, z + 8], text: p.name, sub: p.note, t0: Math.max(p.tLabel ?? p.tIn, t + 0.6), t1: f.t1 });
    });
    const h = f.parts[0]!; asms.push(A(h, 0, 0, 0, { sc: Math.min(0.7, fitScale(h.g, 130, 90)) }, 0));
    links.push({ a: 0, b: 0, kind: 'wire', route: [[0, 0, 480], [0, 0, asms[0]!.fp.h + 12]], tFlow: f.t0 + 0.6, spacing: 34 });
    return { asms, links, props, lines: [], tags: [], ground: { k: 'round', w: 360, d: 360, r: 170 }, view: V({ el: 26, push: false }), labels };
  }
  const ps = f.parts.slice(0, 4), n = ps.length;
  ps.forEach((p, i) => {
    const x = (i - (n - 1) / 2) * 170, y = (i - (n - 1) / 2) * 60, z = (n - 1 - i) * 100, r = 110 - i * 10, t = f.t0 + 0.05 + i * 0.1;
    props.push({ p: cyl(x, y, z - 10, r, 10, 'lo', 0, [{ d: 'rings', r: [0.8], t: 'faint' }], 40), tIn: t, base: true });
    if (z > 0) props.push({ p: cyl(x, y, 0, 8, z - 10, 'mid', 0, [], 14), tIn: t });
    asms.push(A(p, x, y, z, { sc: 0.62 }, i));
    if (i) links.push({ a: i - 1, b: i, kind: 'wire', route: [[x - 170 + 50, y - 60 + 20, z + 100 + 4], [x - 52, y - 18, z + 4]], tFlow: p.tIn + 0.3, spacing: 50 * Math.pow(1.7, i) });
  });
  return { asms, links, props, lines: [], tags: [], ground: { k: 'sheet', w: n * 170 + 260, d: 520 }, view: V({ el: 28 }) };
}

function timeline(f: FigIn): FigOut {
  let ps = f.parts.slice(0, 5);
  if (f.variant === 'day') ps = [{ id: 'clock', kind: 'clock', name: '', note: '', tIn: f.t0 + 0.1, tEx: null, tLabel: null, g: f.partFor('clock'), key: false }, ...ps.slice(0, 3)];
  const n = ps.length, sp = 210, L = (n - 1) * sp, props: Prop[] = [], tags: Tag[] = [];
  props.push({ p: box(-L / 2 - 100, 60, 0, L + 200, 36, 12, 'lo', 0, 6, [{ d: 'top', l: Array.from({ length: Math.round((L + 200) / 20) }, (_, i) => [[(i + 0.5) / Math.round((L + 200) / 20), 0.15], [(i + 0.5) / Math.round((L + 200) / 20), i % 5 ? 0.45 : 0.8]]), t: 'mid' }]), tIn: f.t0 + 0.03, base: true, drop: 20 });
  const times = (f.text.match(/\b\d{1,2}(:\d\d)?\s?(am|pm)\b|\b(morning|noon|afternoon|evening|night|midnight|today|tomorrow|monday|friday|weekend)\b/gi) ?? []).slice(0, n);
  const asms = ps.map((p, i) => {
    const x = i * sp - L / 2;
    props.push({ p: cyl(x, -20, 0, 62, 8, 'mid', 0, [{ d: 'rings', r: [0.8], t: 'faint' }], 36), tIn: p.tIn - 0.15, base: true });
    tags.push({ text: (f.variant === 'day' && times[i - 1]) || (f.variant === 'day' && i === 0 ? '' : String(f.variant === 'day' ? i : i + 1).padStart(2, '0')), at: [x, 130, 0], t0: p.tIn, size: 22, tone: i === n - 1 ? 'acc' : 'muted' });
    return A(p, x, -20, 8, { sc: Math.min(0.75, fitScale(p.g, 120, 170)) }, f.variant === 'day' ? i - 1 : i);
  });
  props.push({ p: box(-14, -10, 0, 28, 20, 14, 'acc', 0, 4), tIn: f.t0 + 0.2, keys: [[f.t0, -L / 2, 78, 12], ...ps.map((p, i) => [p.tIn, i * sp - L / 2, 78, 12, 0.6])], drop: 0 });
  return { asms, links: [], props, lines: [{ k: 'trail', pts: [[L / 2 + 40, 78, 14], [L / 2 + 140, 78, 14]], t0: later(ps[n - 1], 0.4) }], tags: tags.filter(t => t.text), ground: { k: 'sheet', w: L + 320, d: 420 }, view: V({ az: 32, el: 30, push: false }) };
}

function split(f: FigIn): FigOut {
  const ps = f.parts.slice(0, 4), merge = f.variant === 'merge', one = merge ? ps[ps.length - 1]! : ps[0]!, many = merge ? ps.slice(0, -1) : ps.slice(1);
  const m = Math.max(1, many.length), sy = (i: number) => (i - (m - 1) / 2) * (m > 2 ? 210 : 240);
  const asms: Asm[] = [A(one, merge ? 230 : -230, 0, 0, { sc: 0.92 }, merge ? ps.length - 1 : 0)];
  many.forEach((p, i) => asms.push(A(p, merge ? -200 : 200, sy(i), 0, { sc: 0.72 }, merge ? i : i + 1)));
  const links: LinkIn[] = many.map((_, i) => {
    const o = asms[0]!, b = asms[i + 1]!, mx = 0, dx = merge ? -1 : 1;
    const route = [[o.x + dx * (o.fp.w / 2 + 14), 0, 0], [mx, 0, 0], [mx, b.y, 0], [b.x - dx * (b.fp.w / 2 + 14), b.y, 0]];
    return { a: 0, b: i + 1, kind: 'pipe', route: merge ? route.reverse() : route };
  });
  return { asms, links, props: [], lines: [], tags: [], ground: { k: 'plate', w: 760, d: m * 220 + 240 }, view: V() };
}

function tree(f: FigIn): FigOut {
  const root = f.parts[0]!, kids = f.parts.slice(1, 4), m = Math.max(1, kids.length), asms: Asm[] = [A(root, -280, 0, 0, { sc: 0.82 }, 0)], links: LinkIn[] = [];
  const ky = (i: number) => (i - (m - 1) / 2) * 230;
  kids.forEach((p, i) => {
    const c = A(p, 0, ky(i), 0, { sc: 0.62 }, i + 1); asms.push(c); const ci = asms.length - 1;
    links.push({ a: 0, b: ci, kind: 'wire', route: [[-280 + 70, 0, 6], [-120, 0, 6], [-120, ky(i), 6], [-60, ky(i), 6]] });
    for (let j = 0; j < 2; j++) {
      const leafKind = f.variant === 'org' ? 'pawn' : p.kind, g = leafKind === p.kind ? p.g : f.partFor(leafKind);
      asms.push(A(rep(p, p.tIn + 0.35 + j * 0.12, g), 250, ky(i) + (j - 0.5) * 100, 0, { sc: f.variant === 'org' ? 0.8 : 0.36, kind: leafKind, name: leafKind }));
      links.push({ a: ci, b: asms.length - 1, kind: 'wire', route: [[60, ky(i), 6], [150, ky(i), 6], [150, ky(i) + (j - 0.5) * 100, 6], [212, ky(i) + (j - 0.5) * 100, 6]] });
    }
  });
  return { asms, links, props: [], lines: [], tags: [], ground: { k: 'plate', w: 820, d: m * 230 + 200 }, view: V({ el: 38 }) };
}

function turntable(f: FigIn): FigOut {
  const h = f.parts[0]!, k = Math.min(1.9, 300 / Math.max(h.g.fp.w, h.g.fp.d), 330 / Math.max(1, h.g.fp.h)) * (f.variant === 'explode' ? 0.8 : 1), a = A(h, 0, 0, 0, { sc: k }, 0);
  if (f.variant === 'explode' && a.layers >= 1) { const t = Math.max(h.tIn + 1.2, h.tEx ?? f.t0 + (f.t1 - f.t0) * 0.4); a.ex = [[t, f.t1 + 1]]; }
  const asms = [a];
  f.parts.slice(1, 4).forEach((p, i) => { const ang = (100 + i * 70) * Math.PI / 180; asms.push(A(p, Math.cos(ang) * 235, Math.sin(ang) * 235, 0, { sc: 0.42 }, i + 1)); });
  return { asms, links: [], props: [], lines: [], tags: [], ground: { k: 'round', w: 560, d: 560, r: 270, spin: 9 }, view: V({ sweep: 64, orbit: 0, el: 26, push: false }) };
}

function gauge(f: FigIn): FigOut {
  const props: Prop[] = [], tags: Tag[] = [], t = f.t0 + 0.05, asms: Asm[] = [];
  const pct = f.number && /%/.test(f.number) ? Math.min(100, parseFloat(f.number)) / 100 : null;
  const dial = (x: number, y: number, z: number, r: number, t0: number, to: number) => props.push({ p: cyl(x, y, z, r, 10, 'hi', 0, [{ d: 'disc', r: 0.9, fill: 'paper' }, { d: 'spokes', n: 24, r0: 0.72, r1: 0.82, t: 'faint' }, { d: 'spokes', n: 8, r0: 0.66, r1: 0.84, t: 'mid' }, { d: 'rings', r: [0.86], t: 'mid' }, { d: 'spokes', n: 1, r0: 0, r1: 0.78, a: 135, t: 'acc', w: 4, needle: true }], 40), tIn: t0 - 0.4, needle: [t0, 135, 135 + to * 270] });
  if (f.variant === 'meter') {
    props.push({ p: box(-230, -150, 0, 260, 260, 30, 'mid', 0, 12, [screws4()]), tIn: t, base: true });
    dial(-100, -20, 30, 115, f.t0 + 0.8, pct ?? 0.78);
    for (let i = 0; i < 4; i++) props.push({ p: box(80 + i * 46, -60 + i * 0, 0, 34, 70, 60 + i * 42, i === 3 ? 'acc' : 'hi', 0, 3), tIn: t + 0.2, grow: [f.t0 + 0.6 + i * 0.18, 0.7] });
  } else {
    props.push({ p: box(-220, -90, 0, 440, 190, 44, 'mid', 0, 10, [{ d: 'face', f: 'y', l: [[[0.04, 0.5], [0.96, 0.5]]], t: 'faint' }, screws4()]), tIn: t, base: true });
    props.push({ p: box(-170, -100, 44, 340, 14, 100, 'hi', 0, 5, [{ d: 'quad', f: 'y', q: [0.04, 0.08, 0.96, 0.9], fill: 'screen' }]), tIn: t + 0.1 });
    [-130, 0, 130].forEach((x, i) => dial(x, 10, 44, 52, f.t0 + 0.7 + i * 0.25, i === 1 && pct != null ? pct : [0.62, 0.84, 0.45][i]!));
    if (f.number) tags.push({ text: f.number, at: [0, -86, 112], t0: f.t0 + 0.9, size: 34, tone: 'acc' });
  }
  f.parts.slice(0, 2).forEach((p, i) => asms.push(A(p, f.variant === 'meter' ? 120 + i * 120 : -110 + i * 220, f.variant === 'meter' ? 170 : 230, 0, { sc: Math.min(0.5, fitScale(p.g, 100, 110)) }, i)));
  if (f.variant === 'meter' && f.number) tags.push({ text: f.number, at: [-100, -20, 200], t0: f.t0 + 1.0, size: 34, tone: 'acc' });
  return { asms, links: [], props, lines: [], tags, ground: { k: 'plate', w: 560, d: 560 }, view: V({ el: 34, push: false }) };
}

function columns(f: FigIn): FigOut {
  const fall = f.variant === 'fall', m = 5, props: Prop[] = [], hs = Array.from({ length: m }, (_, i) => 50 + (fall ? m - 1 - i : i) * 52), top = fall ? 0 : m - 1;
  hs.forEach((h, i) => props.push({ p: box((i - 2) * 92 - 30, -30, 0, 60, 60, h, i === top ? 'acc' : 'hi', 0, 3, [{ d: 'face', f: 'y', l: [[[0, 0.92], [1, 0.92]]], t: 'faint' }]), tIn: f.t0 + 0.1 + i * 0.05, grow: [f.t0 + 0.3 + i * 0.16, 0.65], drop: 0 }));
  const done = f.t0 + 0.3 + (m - 1) * 0.16 + 0.65, asms: Asm[] = [];
  const p = f.parts[0]; if (p) asms.push(A({ ...p, tIn: Math.max(p.tIn, done) }, (top - 2) * 92, 0, hs[top]!, { sc: Math.min(0.42, fitScale(p.g, 90, 90)) }, 0));
  const lines: Line[] = [
    { k: 'guide', pts: [[-2 * 92 - 70, 50, 0], [2 * 92 + 70, 50, 0]], t0: f.t0 + 0.1 },
    { k: 'trail', pts: hs.map((h, i) => [(i - 2) * 92, 0, h + 26]), t0: done - 0.1 },
  ];
  const tags: Tag[] = f.number ? [{ text: f.number, at: [(top - 2) * 92, 0, hs[top]! + (p ? 150 : 70)], t0: done, size: 34, tone: 'acc' }] : [];
  return { asms, links: [], props, lines, tags, ground: { k: 'sheet', w: 640, d: 360 }, view: V({ az: 38, el: 26, push: false }) };
}

/* ───────── the composer: an improvised set-up (the kit's Spec) drawn in Anatomy's grammar ───────── */

export function composed(f: FigIn, spec: Spec): FigOut {
  const els = spec.elements;
  const pics = els.filter(e => e.kind === 'part' || e.kind === 'shape');
  const span = f.t1 - f.t0, nW = Math.max(1, Math.max(...els.map(e => e.word)) + 1), tOf = (w: number) => f.t0 + 0.1 + (w / nW) * Math.max(0.5, span - 1.6);
  // pictures: the script's own parts first (in order), the spec's icons/shapes for the rest
  const ps: PartIn[] = pics.slice(0, 6).map((e, i) => {
    const own = f.parts[i];
    if (own && e.kind === 'part') return { ...own, tIn: Math.max(own.tIn, f.t0 + 0.1) };
    const g = e.kind === 'shape' ? composePart({ ...sketchPart(e.text ?? e.shape ?? 'unit'), body: (e.shape as never) ?? 'box' }) : f.partFor(e.icon ?? 'server');
    return { id: `c${i}`, kind: e.kind === 'shape' ? `shape:${e.shape}` : e.icon ?? 'server', name: own?.name ?? e.text ?? '', note: own?.note ?? '', tIn: tOf(e.word), tEx: null, tLabel: null, g, key: !!own };
  });
  if (!ps.length) ps.push(...f.parts.slice(0, 2));
  if (!ps.length) ps.push({ id: 'c0', kind: 'server', name: '', note: '', tIn: f.t0 + 0.1, tEx: null, tLabel: null, g: f.partFor('server'), key: false });
  const n = ps.length, lay = spec.layout, moves = new Set(els.map(e => e.motion));
  const pos: number[][] = ps.map((_, i) => {
    switch (lay) {
      case 'ring': case 'orbit': { const a = (225 + i * 360 / n) * Math.PI / 180, R = n > 1 ? 220 : 0; return lay === 'orbit' && i === 0 ? [0, 0, 0] : [Math.cos(a) * R, Math.sin(a) * R, 0]; }
      case 'stack': return [0, 0, ps.slice(0, i).reduce((z, p) => z + p.g.fp.h * 0.7 + 10, 0)];
      case 'grid': return [((i % 2) - 0.5) * 210, (Math.floor(i / 2) - (Math.ceil(n / 2) - 1) / 2) * 210, 0];
      case 'pair': return [i ? 170 : -170, i ? -170 : 170, 0];
      case 'column': return [(i - (n - 1) / 2) * 120, (i - (n - 1) / 2) * 120, i * 40];
      case 'scatter': { const r = rng(f.seed + i * 13); return [(r() - 0.5) * 420, (r() - 0.5) * 420, 0]; }
      case 'hero': return i === 0 ? [0, 0, 0] : [Math.cos(i * 2.1) * 240, Math.sin(i * 2.1) * 240, 0];
      default: return [(i - (n - 1) / 2) * 200, 0, 0]; // row
    }
  });
  const sc = lay === 'hero' ? (i: number) => (i ? 0.45 : 1.35) : lay === 'orbit' ? (i: number) => (i ? 0.62 : 1) : () => (n > 3 ? 0.66 : 0.8);
  const asms = ps.map((p, i) => {
    const a = A(p, pos[i]![0]!, pos[i]![1]!, pos[i]![2]!, { sc: sc(i), ...(moves.has('slide') && i ? { enter: [0, -480, 40] } : moves.has('rise') ? { enter: [0, 0, -200] } : {}) }, p.key ? f.parts.indexOf(f.parts.find(q => q.id === p.id)!) : -1);
    if (moves.has('explode') && a.layers >= 2 && i === 0) a.ex = [[Math.min(f.t1 - 1.5, p.tIn + 1.2), f.t1 + 1]];
    return a;
  });
  const links: LinkIn[] = [];
  const arrows = els.filter(e => e.kind === 'arrow' || e.kind === 'pipe').length;
  if (arrows || moves.has('flow')) for (let i = 0; i + 1 < n && links.length < 4; i++) links.push({ a: lay === 'orbit' || lay === 'hero' ? 0 : i, b: i + 1, kind: lay === 'row' && !els.some(e => e.kind === 'arrow') ? 'pipe' : 'wire' });
  const lines: Line[] = [], tags: Tag[] = [];
  const dim = els.find(e => e.kind === 'dimension'), num = els.find(e => e.kind === 'number');
  if (dim && n >= 2) lines.push({ k: 'dim', pts: [[asms[0]!.x, asms[0]!.y, 0], [asms[n - 1]!.x, asms[n - 1]!.y, 0]], off: [0, 150, 0], text: (dim.text ?? '').slice(0, 12) || undefined, t0: tOf(dim.word) });
  if (num && f.number) tags.push({ text: f.number, at: [asms[0]!.x, asms[0]!.y, asms[0]!.z + asms[0]!.fp.h + 80], t0: tOf(num.word), size: 34, tone: 'acc' });
  const xs = asms.map(a => Math.abs(a.x) + a.fp.w / 2), ys = asms.map(a => Math.abs(a.y) + a.fp.d / 2);
  const W = 2 * Math.max(...xs) + 140, D = 2 * Math.max(...ys) + 140;
  return { asms, links, props: [], lines, tags, ground: lay === 'ring' || lay === 'orbit' ? { k: 'round', w: W, d: D, r: Math.max(W, D) / 2 } : lay === 'scatter' || lay === 'grid' ? { k: 'sheet', w: W + 80, d: D + 80 } : { k: 'plate', w: W, d: D }, view: V({ el: lay === 'stack' || lay === 'column' ? 24 : 32 }) };
}

export const LAYOUTS: Record<Exclude<Figure, 'composed'>, (f: FigIn) => FigOut> = {
  bench, stack, cutaway, pipeline, hub, loop, tower, grid, scale, twin, macro, blueprint, assembly, rack, mesh, funnel, timeline, split, tree, turntable, gauge, columns,
};
