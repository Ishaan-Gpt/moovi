import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { kit, type Ev, type Word } from '@moovi/skills';
import { renderFilm, openFilm, type FilmStats, type RenderOpts } from './capture';
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
}
export interface FilmResult { plan: VPlan; issues: Issue[]; audit: Audit | null; stats: FilmStats | null }

/** Plan, check, render. `skipRender` stops after the plan and its checks. */
export async function makeFilm(i: FilmInput, o: { skipRender?: boolean } = {}): Promise<FilmResult> {
  const plan = planFilm(i.beats, i);
  mkdirSync(i.dir, { recursive: true });
  writeFileSync(join(i.dir, 'plan.json'), JSON.stringify(plan, null, 1));
  const issues = checkPlan(plan, i.askedSeconds);
  let audit: Audit | null = null;
  if (i.audit && !o.skipRender) { const s = await openFilm(plan, { scale: 0.5 }); try { audit = await auditFilm(s, plan); } finally { await s.close(); } issues.push(...audit.issues); }
  const stats = o.skipRender ? null : await renderFilm(plan, i.dir, { ...i.render, out: i.out, audio: i.audio });
  return { plan, issues, audit, stats };
}
