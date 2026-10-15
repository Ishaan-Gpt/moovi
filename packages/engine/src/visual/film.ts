import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { kit, type Ev, type Word } from '@moovi/skills';
import { renderFilm, openFilm, encodeFrames, type FilmStats, type RenderOpts } from './capture';
import { failing, replanScenes, scoreScenes, FAIL_BELOW, type SceneScore } from './critic';
import { auditFilm, checkPlan, type Audit, type Issue } from './qa';
import { planFilm, type PlanOptions } from './plan';
import type { BeatIn, VPlan } from './types';

/**
 * The visual system as one call. Beats (the script's lines) + the voice's word times → a plan → frames → a film. Used by
 * the crew's visual renderer (MOOVI_RENDERER=visual), by scripts/visual.ts, and by anything that already has a script and
 * a voice (Tab's showcase films).
 */

/** Each script line with the time it starts and ends on the voice and the time of each of its words (the Kit's own alignment). */
export function beatsFromVoice(beats: { say: string; needs?: string[] }[], words: Word[], fps = 30): BeatIn[] {
  const { scenes, frames } = kit.sceneFrames(beats, words, fps);
  return scenes.map((s, i) => {
    const start = i === 0 ? 0 : s.f0 / fps, end = s.f1 / fps;
    const ws = s.words.map((w, k) => ({ w: w.w, start: w.t, end: s.words[k + 1]?.t ?? Math.min(end, w.t + 0.35) }));
    return { text: beats[i]!.say, start, end: i === scenes.length - 1 ? frames / fps : end, words: ws, needs: beats[i]!.needs };
  });
}

/** The sound the picture asks for: a hit at every cut, a card-in as cards land, a pop for objects, a stat for numbers. Seconds, in order. */
export function eventsFor(plan: VPlan): Ev[] {
  const ev: Ev[] = [];
  for (const s of plan.scenes) {
    if (s.i > 0) ev.push({ t: +s.start.toFixed(3), event: 'scene' });
    for (const e of s.elements) {
      const t = +(s.start + e.at).toFixed(3), kind = e.art.split(':')[0];
      if (kind === 'card' || kind === 'device') ev.push({ t, event: 'card-in' });
      else if (kind === 'chart') ev.push({ t, event: 'stat' });
      else if (kind === 'obj' || kind === 'icon') ev.push({ t, event: 'pop' });
    }
    for (const l of s.type) if (l.em !== null && l.at[l.em] !== undefined) ev.push({ t: +(s.start + l.at[l.em]!).toFixed(3), event: 'key-word' });
  }
  // the mixer wants them in order and not stacked on one frame
  return ev.sort((a, b) => a.t - b.t).filter((e, i, all) => !(i > 0 && Math.abs(e.t - all[i - 1]!.t) < 0.05 && e.event === all[i - 1]!.event));
}

export interface FilmInput extends PlanOptions {
  beats: BeatIn[];
  /** the length the brief asked for; the film is checked to be within 2 s of it */
  askedSeconds?: number;
  dir: string;
  out?: string;
  audio?: string;
  render?: RenderOpts;
  /** also run the frame audit (about 4 s) */
  audit?: boolean;
  /**
   * The frame critic: score every scene on the sampled frames, cast the scenes below the bar again and render only those.
   * `store` writes the scores to FalkorDB (per scene, per artifact, per layout) for the next film's art director.
   */
  critic?: { attempts?: number; below?: number; store?: (plan: VPlan, scores: SceneScore[]) => Promise<void> };
}
export interface FilmResult { plan: VPlan; issues: Issue[]; audit: Audit | null; stats: FilmStats | null; scores: SceneScore[] | null; /** scenes cast again, per attempt */ recast: number[][]; encode: { out: string | null; encodeMs: number; encodeError: string | null } | null }

/** Plan, check, render; with a critic: audit, score, recast and re-render only the weak scenes, then encode. */
export async function makeFilm(i: FilmInput, o: { skipRender?: boolean } = {}): Promise<FilmResult> {
  let plan = planFilm(i.beats, i);
  mkdirSync(i.dir, { recursive: true });
  const issues = checkPlan(plan, i.askedSeconds);
  let audit: Audit | null = null, stats: FilmStats | null = null, scores: SceneScore[] | null = null, encode: FilmResult['encode'] = null;
  const recast: number[][] = [];
  const audited = async () => { const s = await openFilm(plan, { scale: 0.5 }); try { return await auditFilm(s, plan); } finally { await s.close(); } };
  if (!o.skipRender) {
    // frames stay on disk until the film is final: a re-render writes over only the frames of the scenes it recast
    stats = await renderFilm(plan, i.dir, { ...i.render, keepFrames: true });
    if (i.audit || i.critic) audit = await audited();
    if (i.critic && audit) {
      const below = i.critic.below ?? FAIL_BELOW, clips = !!i.clips?.length;
      scores = scoreScenes(plan, audit, { clipsAvailable: clips });
      for (let attempt = 1; attempt <= (i.critic.attempts ?? 1); attempt++) {
        const bad = failing(scores, below); if (!bad.length) break;
        recast.push(bad);
        const pool = { list: i.clips ?? [], handed: (i.clips ?? []).map(() => 0) };
        const re = replanScenes(plan, i.beats, bad, i, attempt, pool);
        plan = re.plan;
        await renderFilm(plan, i.dir, { ...i.render, ranges: re.ranges, keepFrames: true });
        audit = await audited();
        scores = scoreScenes(plan, audit, { clipsAvailable: clips });
      }
      await i.critic.store?.(plan, scores);
    }
    if (audit) issues.push(...audit.issues);
    if (i.out) encode = await encodeFrames(plan, join(i.dir, 'frames'), i.out, { audio: i.audio, format: i.render?.format, keepFrames: false });
  }
  writeFileSync(join(i.dir, 'plan.json'), JSON.stringify(plan, null, 1));
  return { plan, issues, audit, stats, scores, recast, encode };
}
