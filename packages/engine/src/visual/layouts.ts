/**
 * Layouts: where a scene's elements go. A layout is a list of slots in the scene's VISUAL AREA, which is the frame
 * without the caption band (the kinetic words live there and nothing else may cover them) and the platform safe zone.
 * Slot coordinates are fractions of that area, so one layout serves vertical, landscape and square films.
 */
export type FormatId = 'vertical' | 'landscape' | 'square';
export const FORMATS: Record<FormatId, { W: number; H: number }> = { vertical: { W: 1080, H: 1920 }, landscape: { W: 1920, H: 1080 }, square: { W: 1080, H: 1080 } };

export interface Rect { x: number; y: number; w: number; h: number }
/** a slot: its centre and size in the visual area (0..1), a depth (px behind (−) or in front (+) of the film plane) and its job */
export interface Slot { id: string; cx: number; cy: number; w: number; h: number; z: number; job: 'main' | 'side' | 'pip' | 'label' | 'satellite' }

/** The caption band and the visual area, in frame pixels, per format. Nothing but ambient layers may cross the band. */
export function bands(f: FormatId): { caption: Rect; area: Rect; safeBottom: number } {
  const { W, H } = FORMATS[f];
  if (f === 'vertical') return { caption: { x: 0.06 * W, y: 0.60 * H, w: 0.88 * W, h: 0.2 * H }, area: { x: 0.04 * W, y: 0.05 * H, w: 0.92 * W, h: 0.53 * H }, safeBottom: 0.86 * H };
  if (f === 'square') return { caption: { x: 0.06 * W, y: 0.62 * H, w: 0.88 * W, h: 0.2 * H }, area: { x: 0.04 * W, y: 0.04 * H, w: 0.92 * W, h: 0.55 * H }, safeBottom: 0.9 * H };
  return { caption: { x: 0.08 * W, y: 0.72 * H, w: 0.84 * W, h: 0.17 * H }, area: { x: 0.05 * W, y: 0.05 * H, w: 0.9 * W, h: 0.64 * H }, safeBottom: 0.93 * H };
}

export const LAYOUT_IDS = ['hero', 'split-stack', 'split-side', 'pip', 'triptych', 'cascade', 'callouts', 'orbit', 'wall'] as const;
export type LayoutId = (typeof LAYOUT_IDS)[number];

export interface LayoutInfo { id: LayoutId; name: string; about: string; /** how many elements it holds (main first) */ slots: number; /** needs a wide area to read well */ prefers: FormatId[] }

const S = (id: string, cx: number, cy: number, w: number, h: number, z: number, job: Slot['job']): Slot => ({ id, cx, cy, w, h, z, job });

/** slot tables for a tall area (vertical, square) and a wide one (landscape) */
const TALL: Record<LayoutId, Slot[]> = {
  hero: [S('a', 0.5, 0.5, 0.86, 0.9, 0, 'main')],
  'split-stack': [S('a', 0.5, 0.25, 0.9, 0.46, 0, 'main'), S('b', 0.5, 0.76, 0.9, 0.46, 20, 'side')],
  'split-side': [S('a', 0.26, 0.5, 0.47, 0.8, 0, 'main'), S('b', 0.76, 0.5, 0.47, 0.8, 30, 'side')],
  pip: [S('a', 0.5, 0.48, 0.9, 0.84, -40, 'main'), S('b', 0.74, 0.82, 0.46, 0.34, 120, 'pip')],
  triptych: [S('a', 0.2, 0.5, 0.3, 0.5, 0, 'main'), S('b', 0.5, 0.5, 0.3, 0.5, 40, 'side'), S('c', 0.8, 0.5, 0.3, 0.5, 0, 'side')],
  cascade: [S('a', 0.4, 0.3, 0.74, 0.5, -60, 'main'), S('b', 0.6, 0.55, 0.74, 0.46, 40, 'side'), S('c', 0.4, 0.8, 0.74, 0.4, 140, 'side')],
  callouts: [S('a', 0.5, 0.5, 0.64, 0.8, 0, 'main'), S('b', 0.18, 0.22, 0.34, 0.2, 100, 'label'), S('c', 0.82, 0.78, 0.34, 0.2, 100, 'label')],
  orbit: [S('a', 0.5, 0.5, 0.5, 0.56, 0, 'main'), S('b', 0.14, 0.2, 0.2, 0.2, 80, 'satellite'), S('c', 0.86, 0.3, 0.2, 0.2, -80, 'satellite'), S('d', 0.16, 0.8, 0.2, 0.2, 60, 'satellite'), S('e', 0.86, 0.82, 0.2, 0.2, -40, 'satellite')],
  wall: [S('a', 0.26, 0.26, 0.46, 0.46, 0, 'side'), S('b', 0.76, 0.26, 0.46, 0.46, 30, 'side'), S('c', 0.26, 0.76, 0.46, 0.46, 30, 'side'), S('d', 0.76, 0.76, 0.46, 0.46, 0, 'side')],
};
const WIDE: Record<LayoutId, Slot[]> = {
  hero: [S('a', 0.5, 0.5, 0.7, 0.92, 0, 'main')],
  'split-stack': [S('a', 0.5, 0.24, 0.8, 0.44, 0, 'main'), S('b', 0.5, 0.76, 0.8, 0.44, 20, 'side')],
  'split-side': [S('a', 0.25, 0.5, 0.48, 0.9, 0, 'main'), S('b', 0.75, 0.5, 0.48, 0.9, 30, 'side')],
  pip: [S('a', 0.46, 0.5, 0.78, 0.92, -40, 'main'), S('b', 0.82, 0.74, 0.34, 0.44, 120, 'pip')],
  triptych: [S('a', 0.17, 0.5, 0.31, 0.78, 0, 'main'), S('b', 0.5, 0.5, 0.31, 0.78, 40, 'side'), S('c', 0.83, 0.5, 0.31, 0.78, 0, 'side')],
  cascade: [S('a', 0.26, 0.4, 0.44, 0.7, -60, 'main'), S('b', 0.5, 0.56, 0.44, 0.66, 40, 'side'), S('c', 0.74, 0.44, 0.44, 0.6, 140, 'side')],
  callouts: [S('a', 0.5, 0.5, 0.46, 0.92, 0, 'main'), S('b', 0.14, 0.28, 0.24, 0.3, 100, 'label'), S('c', 0.86, 0.72, 0.24, 0.3, 100, 'label')],
  orbit: [S('a', 0.5, 0.5, 0.34, 0.8, 0, 'main'), S('b', 0.14, 0.24, 0.16, 0.3, 80, 'satellite'), S('c', 0.86, 0.26, 0.16, 0.3, -80, 'satellite'), S('d', 0.14, 0.78, 0.16, 0.3, 60, 'satellite'), S('e', 0.86, 0.78, 0.16, 0.3, -40, 'satellite')],
  wall: [S('a', 0.18, 0.3, 0.3, 0.5, 0, 'side'), S('b', 0.4, 0.3, 0.3, 0.5, 30, 'side'), S('c', 0.62, 0.3, 0.3, 0.5, 30, 'side'), S('d', 0.84, 0.3, 0.3, 0.5, 0, 'side')],
};

export const LAYOUTS: readonly LayoutInfo[] = [
  { id: 'hero', name: 'Hero', about: 'one big thing, with ambient depth behind it', slots: 1, prefers: ['vertical', 'landscape', 'square'] },
  { id: 'split-stack', name: 'Split screen (top / bottom)', about: 'two panels one above the other: before and after, A and B', slots: 2, prefers: ['vertical', 'square'] },
  { id: 'split-side', name: 'Split screen (side by side)', about: 'two panels beside each other: compare, versus', slots: 2, prefers: ['landscape', 'square', 'vertical'] },
  { id: 'pip', name: 'Picture in picture', about: 'a big panel with a small one overlapping its corner', slots: 2, prefers: ['vertical', 'landscape', 'square'] },
  { id: 'triptych', name: 'Three across', about: 'three equal things: three benefits, three steps', slots: 3, prefers: ['landscape', 'square', 'vertical'] },
  { id: 'cascade', name: 'Cascading cards', about: 'three cards stacked at different depths', slots: 3, prefers: ['vertical', 'landscape', 'square'] },
  { id: 'callouts', name: 'Hero with callouts', about: 'a hero with two labelled callouts and leader lines', slots: 3, prefers: ['vertical', 'landscape', 'square'] },
  { id: 'orbit', name: 'Orbit', about: 'a hero with four satellites circling it', slots: 5, prefers: ['vertical', 'square', 'landscape'] },
  { id: 'wall', name: 'Wall', about: 'four tiles at once: features, logos, proof', slots: 4, prefers: ['square', 'landscape', 'vertical'] },
];

/** The slots of a layout for a format, in frame pixels (rect + depth + job). */
export function slotsOf(layout: LayoutId, f: FormatId): { id: string; rect: Rect; z: number; job: Slot['job'] }[] {
  const { area } = bands(f), table = f === 'landscape' ? WIDE : TALL;
  return table[layout].map(s => ({ id: s.id, z: s.z, job: s.job, rect: { x: area.x + (s.cx - s.w / 2) * area.w, y: area.y + (s.cy - s.h / 2) * area.h, w: s.w * area.w, h: s.h * area.h } }));
}

export const slotCount = (l: LayoutId) => LAYOUTS.find(x => x.id === l)!.slots;
