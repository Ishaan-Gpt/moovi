import type { AgentId } from '@moovi/engine/events';

/**
 * The 3D office: eight jelly desks on a horseshoe round the FalkorDB sphere, open toward you, in the order a film
 * passes through them (docs/PIPELINE.html). Each agent sits behind its desk, facing you over it, and a channel on
 * the floor runs from every desk into the sphere: the crew share nothing but the graph.
 * World units: Moovi is about 2 tall at scale 1, the floor is at y = -1.04.
 */
export const FLOOR = -1.04;
export const ORDER: AgentId[] = ['editor', 'researcher', 'writer', 'moovi', 'sound', 'designer', 'lens', 'keeper'];
/** The seven specialists in crew-blob slots 0..6 (the renderer's crew array); Moovi is the big one. */
export const CREW_SLOTS: AgentId[] = ORDER.filter(a => a !== 'moovi');
/** Each blob's jelly tint (0 ice, 1 lilac, 2 mint), alternating round the room. */
export const TINT: Partial<Record<AgentId, number>> = { editor: 0, researcher: 2, writer: 1, sound: 0, designer: 1, lens: 2, keeper: 0 };

export const GRAPH = { x: 0, y: .05, z: .15, r: 1.02 };
const SPAN = 270 * Math.PI / 180;
const RING = 3.25;        // desk centres
const SEAT = .62;         // how far behind its desk an agent sits
export const DESK_TOP = -.56;
export const CREW_R = .36;
export const MOOVI_S = .5;

export interface Place { id: AgentId; angle: number; desk: { x: number; z: number; yaw: number; w: number }; seat: { x: number; y: number; z: number } }

/** Where the camera stands (roughly): every desk turns its front to you, so each face is seen over its desk. */
const VIEW = { x: 0, z: 12.6 };

export const PLACES: Place[] = ORDER.map((id, i) => {
  const a = -SPAN / 2 + (SPAN * i) / (ORDER.length - 1);
  const dir = { x: Math.sin(a), z: -Math.cos(a) };   // from the sphere out to the desk (a = 0 is straight back)
  const big = id === 'moovi';
  const dx = GRAPH.x + dir.x * RING, dz = GRAPH.z + dir.z * RING;
  const fl = Math.hypot(VIEW.x - dx, VIEW.z - dz), f = { x: (VIEW.x - dx) / fl, z: (VIEW.z - dz) / fl };
  const back = SEAT * (big ? 1.15 : 1);
  return {
    id, angle: a,
    desk: { x: dx, z: dz, yaw: Math.atan2(f.x, f.z), w: big ? .7 : .5 },
    seat: { x: dx - f.x * back, y: big ? -.08 : -.16, z: dz - f.z * back },
  };
});
export const placeOf = (id: AgentId) => PLACES.find(p => p.id === id)!;

/** Each agent's node in the graph: where its writes land (spread round the sphere, the core is Moovi's). */
export const NODE_OF: Record<AgentId, number> = { moovi: 0, editor: 3, researcher: 7, writer: 11, sound: 15, designer: 19, lens: 22, keeper: 25 };
