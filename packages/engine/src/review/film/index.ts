/**
 * The bounded review of a live preview (docs/agents/research/R11-open-design.md, plan item 1): code checks first, on
 * the film's data and on one still per beat; the preview is already playing while it runs and nothing here can stop
 * it. Writes review.json beside film.json. The result also carries Lens's one shape (review/lens.ts), and the model can
 * look at the beat stills when asked (`vision`, off unless a caller turns it on), never failing the review.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { reviewConfig } from '../config';
import { lens, levelOfCheck, filmSevOf } from '../lens';
import { visionReview, VISION_FRAMES, type VisionFn, type VisionFrame } from '../vision';
import { sampleFrames } from './frames';
import { lintPlan, readPlan, type Plan } from './plan';
import { SEV_ORDER, type Frame, type Issue, type Review } from './types';

/**
 * Below this edge share a still is a bare background with at most a word on it. Measured on the films on disk
 * (scripts/review.ts): see the calibration note in docs/agents/research/R11-open-design.md.
 */
export const SPARSE = 0.012;
/** At or under this effective opacity a word is on its way out (dimmed), not the one being read. */
const DIMMED = 0.6;
/** Styles that caption every spoken word (their captions must carry the script). */
const FULL_CAPTIONS = new Set(['s5', 'anatomy']);

/** The model's look at the stills: which beats, the flagged ones first, then spread over the film; every beat with `every`. */
export function pickStills(frames: Frame[], issues: Issue[], n: number): Frame[] {
  if (n >= frames.length) return frames;
  const flagged = new Set(issues.filter(i => i.sev !== 'P2' && i.beat !== undefined).map(i => i.beat!));
  const out = frames.filter(f => flagged.has(f.beat)).slice(0, n);
  for (let k = 0; out.length < n && k < n; k++) { const f = frames[Math.min(frames.length - 1, Math.floor((k + 0.5) * frames.length / n))]!; if (!out.includes(f)) out.push(f); }
  return out.slice(0, n).sort((a, b) => a.t - b.t);
}

/**
 * The one model look at a generated film's stills (review/vision.ts, the same eye CHECK uses). Its findings never block:
 * an error-level one is to fix (P1), the rest notes (P2). Never throws: skipped or failed comes back as a reason.
 */
export async function visionStills(o: { style: string; plan: Plan; frames: Frame[]; issues: Issue[]; see?: VisionFn; every?: boolean }): Promise<{ issues: Issue[]; ms: number; asked: number; skipped?: string; error?: string }> {
  const cfg = reviewConfig(null), n = o.every ? o.frames.length : VISION_FRAMES;
  const frames: VisionFrame[] = pickStills(o.frames, o.issues, n).map(f => ({ t: f.t, file: f.file }));
  const vr = await visionReview({ brief: `A ${o.plan.duration.toFixed(0)} s 9:16 generated short (${o.style}), one still per beat.` }, frames, cfg, o.see, { limit: n });
  const issues: Issue[] = vr.issues.map(i => {
    const fr = o.frames.find(f => Math.abs(f.t - i.t) < 1e-3);
    return { sev: filmSevOf[levelOfCheck(i.severity)], code: 'vision' as const, t: i.t, text: i.msg, ...(fr ? { beat: fr.beat } : {}) };
  });
  return { issues, ms: vr.ms, asked: vr.asked, ...(vr.skipped ? { skipped: vr.skipped } : {}), ...(vr.error ? { error: vr.error } : {}) };
}

export async function reviewFilm(o: { style: string; id: string; dir: string; pv: string; signal?: AbortSignal; log?: (s: string) => void;
  /** the model's look at the stills: off unless asked (today's films ship without it); `every` looks at every beat (Creative mode) */
  vision?: { see?: VisionFn; every?: boolean } }): Promise<Review> {
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
  let vision: Review['vision'];
  if (o.vision && frames.length && !error && !o.signal?.aborted) {
    const v = await visionStills({ style: o.style, plan, frames, issues, ...o.vision });
    issues.push(...v.issues);
    vision = { ms: v.ms, asked: v.asked, found: v.issues.length, ...(v.skipped ? { skipped: v.skipped } : {}), ...(v.error ? { error: v.error } : {}) };
  }
  issues.sort((a, b) => SEV_ORDER[a.sev] - SEV_ORDER[b.sev] || (a.t ?? 0) - (b.t ?? 0));
  const seconds = +((Date.now() - t0) / 1000).toFixed(1);
  const review: Review = { style: o.style, id: o.id, duration: plan.duration, frames, issues, blocking: issues.filter(i => i.sev === 'P0').length, seconds,
    ...(vision ? { vision } : {}), lens: lens({ input: 'film', review: { issues, frames, seconds } }) };
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
