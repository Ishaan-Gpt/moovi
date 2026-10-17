/**
 * The bounded review of a live preview (docs/agents/research/R11-open-design.md, plan item 1): code checks first, on
 * the film's data and on one still per beat; the preview is already playing while it runs and nothing here can stop
 * it. Writes review.json beside film.json.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { sampleFrames } from './frames';
import { lintPlan, readPlan } from './plan';
import { SEV_ORDER, type Issue, type Review } from './types';

/**
 * Below this edge share a still is a bare background with at most a word on it. Measured on the films on disk
 * (scripts/review.ts): see the calibration note in docs/agents/research/R11-open-design.md.
 */
export const SPARSE = 0.012;
/** At or under this effective opacity a word is on its way out (dimmed), not the one being read. */
const DIMMED = 0.6;
/** Styles that caption every spoken word (their captions must carry the script). */
const FULL_CAPTIONS = new Set(['s5', 'anatomy']);

export async function reviewFilm(o: { style: string; id: string; dir: string; pv: string; signal?: AbortSignal; log?: (s: string) => void }): Promise<Review> {
  const t0 = Date.now();
  const plan = readPlan(o.dir);
  // Dark Vox and Editorial set key words, not every word, by design: only the word-captioned styles owe the script
  const issues: Issue[] = lintPlan(plan, { captions: FULL_CAPTIONS.has(o.style) });
  const { frames, error } = await sampleFrames({ pv: o.pv, plan, dir: o.dir, signal: o.signal, log: o.log });
  if (error) issues.push({ sev: 'P0', code: 'player-error', text: `the player did not load: ${error.slice(0, 160)}` });
  const isEnd = (beat: number, setup: string) => /end/i.test(setup) || (plan.end !== null && (plan.beats.find(b => b.i === beat)?.t0 ?? 0) >= plan.end - 0.05);
  for (const f of frames) {
    if (f.shown === false) issues.push({ sev: 'P0', code: 'empty-frame', beat: f.beat, t: f.t, text: `nothing on screen at ${f.t.toFixed(1)} s (beat ${f.beat + 1}, ${f.setup || 'no set-up'})` });
    // a lead, not a verdict: edge density can't tell a designed minimal frame from a broken one; end cards are minimal on purpose
    else if (f.detail < SPARSE && !isEnd(f.beat, f.setup)) issues.push({ sev: 'P2', code: 'sparse-frame', beat: f.beat, t: f.t, text: `beat ${f.beat + 1} (${f.setup || 'no set-up'}) is a near-empty frame at ${f.t.toFixed(1)} s` });
    // a word at full strength cut by the frame is broken; a dimmed word sliding out (Clear Signal's moving line) is a lead
    const cut = [...f.offFrame].sort((a, b) => b.k - a.k)[0];
    if (cut) issues.push({ sev: cut.k > DIMMED ? 'P0' : 'P2', code: 'text-off-frame', beat: f.beat, t: f.t, text: `${cut.k > DIMMED ? 'text' : 'a dimmed word'} runs off the frame at ${f.t.toFixed(1)} s: "${cut.text}"` });
  }
  issues.sort((a, b) => SEV_ORDER[a.sev] - SEV_ORDER[b.sev] || (a.t ?? 0) - (b.t ?? 0));
  const review: Review = { style: o.style, id: o.id, duration: plan.duration, frames, issues, blocking: issues.filter(i => i.sev === 'P0').length, seconds: +((Date.now() - t0) / 1000).toFixed(1) };
  writeFileSync(join(o.dir, 'review.json'), JSON.stringify(review, null, 1));
  return review;
}

/** One line for the chat: what was checked and what it found. */
export function reviewLine(r: Review): string {
  const n = r.frames.length, p0 = r.blocking, p1 = r.issues.filter(i => i.sev === 'P1').length;
  if (!p0 && !p1) return `Lens checked ${n} frames and the beat map in ${r.seconds.toFixed(1)} s: nothing to fix.`;
  const top = r.issues.filter(i => i.sev !== 'P2').slice(0, 2).map(i => i.text).join('; ');
  return `Lens checked ${n} frames in ${r.seconds.toFixed(1)} s and found ${p0 + p1} thing${p0 + p1 === 1 ? '' : 's'} to fix: ${top}.`;
}

export type { Review, Issue, Frame } from './types';
