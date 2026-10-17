import { agentOf, type AgentId } from '@moovi/engine/events';

/**
 * The set, in its own 1060 × 770 frame (scaled to fit the area beside the chat). Three rows recede toward the back
 * wall in the order the work flows: research, words and sound at the back; the look, the review and the memory in
 * the middle; the editor and Moovi's own desk at the front. Each desk faces the camera at the same
 * three-quarter angle; back rows are smaller. Coordinates are a desk's centre on its top edge.
 */
export interface Desk { id: AgentId; x: number; y: number; s: number; wide?: boolean; director?: boolean }
export const SET = { w: 1060, h: 770 };

export const DESKS: Desk[] = [
  { id: 'researcher', x: 283, y: 160, s: 0.82 },
  { id: 'writer', x: 528, y: 152, s: 0.82 },
  { id: 'sound', x: 773, y: 160, s: 0.82 },
  { id: 'designer', x: 255, y: 384, s: 0.94, wide: true },
  { id: 'lens', x: 610, y: 374, s: 0.94 },
  { id: 'keeper', x: 875, y: 384, s: 0.94 },
  { id: 'editor', x: 215, y: 610, s: 1.06 },
  { id: 'moovi', x: 640, y: 616, s: 1.06, director: true },
];
export const deskOf = (id: AgentId) => DESKS.find(d => d.id === agentOf(id)) ?? DESKS.find(d => d.id === 'moovi')!;

/** Where a crew member's head is, relative to its desk (in the desk's own units): labels sit just above it. */
export const headOf = (d: Desk) => ({ x: d.director ? -78 : d.wide ? -14 : -36, y: d.director ? -104 : -34 });
/** The monitors on a desk (centre x, in the desk's units). */
export const monitorsOf = (d: Pick<Desk, 'wide' | 'director'>) => (d.director ? [44, 124] : d.wide ? [-92, 0, 92] : [38]);
/** Where a desk's (first) monitor glows, for the handoff bead, in set pixels. */
export const monitorOf = (d: Desk) => ({ x: d.x + monitorsOf(d)[d.wide && !d.director ? 1 : 0]! * d.s, y: d.y + 34 * d.s });
/** The back row's desk tops: where the wall meets the floor, in set pixels. */
export const HORIZON = 228;
