import { byId } from './artifacts';
import { slotsOf } from './layouts';
import { castScene, type ClipPool, type PlanOptions } from './plan';
import { STATIC_BELOW, type Audit, type Issue } from './qa';
import type { BeatIn, VPlan, VScene } from './types';

/**
 * The frame critic. After a render, every scene is scored 0-10 against the quality bar, from what was measured on the
 * sampled frames and what the plan holds:
 *   footage   real moving footage on screen (when there is any to use)
 *   motion    nothing static for a second (the audit's motion energy over the scene's seconds)
 *   depth     layers at different depths: ambient layers, slots at different z, a real 3D object
 *   layers    several elements at once, not one flat card
 *   richness  different kinds of artifact together (a card with a chart with an icon), not three of the same
 *   clean     no element over the captions, no empty or frozen frame in the scene's seconds
 * The scores are stored in FalkorDB per artifact and per layout (running means), the art director prefers what has
 * scored well, and only the scenes below the bar are cast again and rendered again.
 */
export type Part = 'footage' | 'motion' | 'depth' | 'layers' | 'richness' | 'clean';
export interface SceneScore { scene: number; score: number; parts: Record<Part, number>; issues: string[] }

export const WEIGHTS: Record<Part, number> = { footage: 2, motion: 2, depth: 2, layers: 1.5, richness: 1, clean: 1.5 };
/** a scene below this is cast again */
export const FAIL_BELOW = 7;

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export function scoreScenes(plan: VPlan, audit: Pick<Audit, 'issues' | 'perSecond'>, o: { clipsAvailable?: boolean } = {}): SceneScore[] {
  return plan.scenes.map(s => {
    const secs = audit.perSecond.filter(p => p.second >= Math.floor(s.start) && p.second < Math.ceil(s.end)), inScene = (i: Issue) => i.scene === s.i || (i.t !== undefined && i.t >= s.start && i.t < s.end);
    const mine = audit.issues.filter(inScene);
    const elKinds = new Set(s.elements.map(e => byId(e.art)?.kind)), ambKinds = new Set(s.ambient.map(id => byId(id)?.kind));
    const zs = new Set(slotsOf(s.layout, plan.format).filter(sl => s.elements.some(e => e.slot === sl.id)).map(sl => sl.z));
    const hasObject = s.elements.some(e => byId(e.art)?.kind === 'object3d');
    const parts: Record<Part, number> = {
      footage: !o.clipsAvailable ? 1 : s.elements.some(e => e.content.clip) ? 1 : 0,
      motion: secs.length ? clamp01((Math.min(...secs.map(p => p.energy)) - STATIC_BELOW) / 1.65) : mine.some(i => i.kind === 'static') ? 0 : 0.8,
      depth: clamp01((s.ambient.length + zs.size + (hasObject ? 1 : 0)) / 6),
      layers: s.elements.length >= 3 ? 1 : s.elements.length === 2 ? 0.65 : 0.25,
      richness: clamp01((elKinds.size + 0.5 * ambKinds.size - 1) / 3),
      clean: clamp01(1 - 0.5 * mine.filter(i => ['caption-cover', 'static', 'empty-frame'].includes(i.kind)).length),
    };
    const w = { ...WEIGHTS, footage: o.clipsAvailable ? WEIGHTS.footage : 0 };
    const sum = (Object.keys(parts) as Part[]).reduce((a, k) => a + w[k] * parts[k], 0), tot = (Object.keys(parts) as Part[]).reduce((a, k) => a + w[k], 0);
    return { scene: s.i, score: +(10 * sum / tot).toFixed(2), parts, issues: mine.map(i => i.detail) };
  });
}

export const failing = (scores: SceneScore[], below = FAIL_BELOW) => scores.filter(s => s.score < below).map(s => s.scene);

/**
 * Cast the failing scenes again (a different seed, and the artifacts that scored badly are treated as already worn out),
 * leave every other scene exactly as it was, and say which frames need rendering again: the scene's own and the half
 * second of the next scene's transition that still shows it.
 */
export function replanScenes(plan: VPlan, beats: BeatIn[], bad: number[], o: PlanOptions, attempt = 1, pool?: ClipPool, transitionS = 0.5): { plan: VPlan; ranges: [number, number][] } {
  const scenes: VScene[] = [...plan.scenes], used: Record<string, number> = { ...(o.used ?? {}) };
  for (const i of bad) for (const e of plan.scenes[i]!.elements) used[e.art] = (used[e.art] ?? 0) + 6;
  const recent = plan.scenes.map(s => s.layout);
  for (const i of bad) {
    const fresh = castScene(beats[i]!, i, beats.length, { ...o, seed: (o.seed ?? 7) + 7919 * attempt, picks: undefined }, scenes[i - 1] ?? null, recent.slice(Math.max(0, i - 2), i), used, pool);
    scenes[i] = { ...fresh, start: plan.scenes[i]!.start, end: plan.scenes[i]!.end, transition: plan.scenes[i]!.transition };
    recent[i] = fresh.layout;
  }
  const fps = plan.fps, total = Math.round(plan.seconds * fps);
  const ranges = bad.map(i => [Math.round(plan.scenes[i]!.start * fps), Math.min(total, Math.round((plan.scenes[i]!.end + transitionS) * fps))] as [number, number]);
  return { plan: { ...plan, scenes }, ranges: merge(ranges) };
}

/** overlapping or touching frame ranges joined, in order */
export function merge(r: [number, number][]): [number, number][] {
  const out: [number, number][] = [];
  for (const [a, b] of [...r].sort((x, y) => x[0] - y[0])) { const l = out.at(-1); if (l && a <= l[1]) l[1] = Math.max(l[1], b); else out.push([a, b]); }
  return out;
}
