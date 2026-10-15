import { CRAFT, craft as C, project as P, run as runQ } from '@moovi/graph';
import { ARTIFACTS, byId } from './artifacts';
import type { Need } from '../styles/kit/needs';
import type { VPlan } from './types';

/**
 * The artifact library lives in FalkorDB: (:Artifact)-[:SERVES]->(:Need) in the craft graph (what the art director picks
 * from, by what a scene needs), and every film's picks come back as (Scene)-[:USES_ARTIFACT]->(Artifact) in the project
 * graph (so the next film varies and "why does this scene look like this" has an answer). Queries: docs/QUERIES.md.
 */
type Rows = <T = Record<string, unknown>>(q: Parameters<typeof runQ>[1], params?: Record<string, unknown>) => Promise<T[]>;
const craftRows: Rows = (q, p = {}) => runQ(CRAFT, q, p) as never;

/** Seed the library when the graph holds fewer artifacts than the code (idempotent; safe to call before every film). */
export async function ensureArtifactLibrary(rows: Rows = craftRows): Promise<{ seeded: boolean; artifacts: number }> {
  const [c] = await rows<{ n: number }>(C.artifactCount).catch(() => [{ n: 0 }]);
  if ((c?.n ?? 0) >= ARTIFACTS.length) return { seeded: false, artifacts: c!.n };
  await rows(C.seedArtifacts, { rows: ARTIFACTS.map(a => ({ id: a.id, kind: a.kind, name: a.name, roles: a.role.join(','), wants: a.wants, cost: a.cost, glyph: a.glyph ?? null, needs: a.needs })) });
  return { seeded: true, artifacts: ARTIFACTS.length };
}

/** What the graph says serves each beat's needs: artifact id → shared needs (the planner adds this to its own score). */
export async function graphPrior(needsPerBeat: Need[][], rows: Rows = craftRows): Promise<Record<string, number>[]> {
  return Promise.all(needsPerBeat.map(async needs => {
    if (!needs.length) return {};
    const r = await rows<{ id: string; hits: number }>(C.artifactsServing, { needs, kinds: null, n: 60 });
    return Object.fromEntries(r.map(x => [x.id, x.hits]));
  }));
}

/** How often this project already used each artifact (the planner's `used`). */
export async function artifactUsage(rows: Rows): Promise<Record<string, number>> {
  const r = await rows<{ id: string; n: number }>(P.artifactUsage, { limit: 200 });
  return Object.fromEntries(r.map(x => [x.id, x.n]));
}

/** Store a plan's picks: one USES_ARTIFACT per element, plus the ambient layers (slot "ambient:i"). */
export async function storePicks(rows: Rows, run: string, plan: VPlan, at = Date.now()): Promise<number> {
  let n = 0;
  for (const s of plan.scenes) {
    const scene = `${run}:scene:${s.i}`;
    for (const e of s.elements) { const a = byId(e.art); if (a) { await rows(P.useArtifact, { run, scene, i: s.i, art: a.id, kind: a.kind, name: a.name, slot: e.slot, layout: s.layout, at }); n++; } }
    for (const [k, id] of s.ambient.entries()) { const a = byId(id); if (a) { await rows(P.useArtifact, { run, scene, i: s.i, art: a.id, kind: a.kind, name: a.name, slot: `ambient:${k}`, layout: s.layout, at }); n++; } }
  }
  return n;
}
