/**
 * The vision review (NORTH-STAR CHECK, the "one review of up to 3 frames"): the frames the pixel pass already saved go
 * to a model that SEES, once, and it answers with a short list of concrete problems, each naming the one repair that
 * would fix it (move the captions, a backing plate, drop a card) or none. Its findings join the code checks' issues and
 * feed the runner's single repair. It never blocks and never throws: no model that sees, no frames, a timeout or any
 * error is written down as `skipped` or `error` and the render ships without it. The model is the engine's own
 * (runtime/ ask, the crew tier, the same door the S1 critic uses); nothing new is added for it.
 */
import { existsSync, readFileSync } from 'node:fs';
import { z } from 'zod';
import type { PlayerEdl } from '../edit/lib';
import { ask, runtime, tool } from '../runtime';
import type { ReviewConfig } from './config';
import type { CapBox } from './geometry';
import type { Issue } from './types';

export interface VisionFrame { t: number; file: string; chunk?: number; caption?: string }
export interface VisionFinding { frame: number; problem: string; fix: 'move' | 'plate' | 'drop' | 'none'; severity: number }
/** the model call; injectable so tests and kits can bring their own eye */
export type VisionFn = (frames: VisionFrame[], o: { signal: AbortSignal; max: number; brief: string }) => Promise<VisionFinding[]>;
export interface VisionResult { issues: Issue[]; ms: number; asked: number; findings: VisionFinding[]; skipped?: string; error?: string }

const Finding = z.object({
  frame: z.number().int().describe('the frame number, 1-based, as listed'),
  problem: z.string().describe('one concrete, visible problem in a few words: what is wrong and where (e.g. "caption covers the speaker\'s mouth")'),
  fix: z.enum(['move', 'plate', 'drop', 'none']).describe('move = move the captions up or down; plate = a dark backing plate behind the captions; drop = remove the card or overlay; none = no automatic fix'),
  severity: z.number().int().min(1).max(5).describe('5 = unreadable or broken, 3 = clearly wrong, 1 = polish'),
});

/** The default eye: one ask through the engine's runtime with a tool that returns the frames as images. */
export const askVision: VisionFn = async (frames, o) => {
  const look = tool({
    name: 'look', description: 'See the frames of the rendered 9:16 short, in order.', input: {},
    async run() {
      return { text: frames.map((f, i) => `Frame ${i + 1} at ${f.t.toFixed(2)} s${f.caption ? `, caption "${f.caption}"` : ''}.`).join(' '), images: frames.map(f => ({ data: readFileSync(f.file).toString('base64'), mime: 'image/jpeg' as const })) };
    },
  });
  const a = await ask({
    agent: 'review:vision', tier: 'crew', tools: [look], maxTurns: 3, deadlineMs: 60_000, signal: o.signal,
    system: 'You are the last check before a 9:16 short ships. You look at a few rendered frames and list only concrete, visible problems a viewer would notice: a caption on a face or mouth, a caption under the platform\'s buttons or cut off at an edge, text hard to read on its background, a caption on top of a card or other text, a card covering the subject, a broken or empty frame. No taste notes, no praise. Call look first.',
    prompt: `${o.brief}\n\nReturn at most ${o.max} problems, the worst first. An empty list is a good answer when nothing is wrong.`,
    schema: { problems: z.array(Finding) },
  });
  return a.problems;
};

/** Run the one vision review over the frames; findings become issues tied to the frame's caption chunk or card. */
export async function visionReview(e: PlayerEdl, frames: VisionFrame[], cfg: ReviewConfig, see?: VisionFn): Promise<VisionResult> {
  const t0 = Date.now(), done = (x: Partial<VisionResult>): VisionResult => ({ issues: [], findings: [], asked: 0, ...x, ms: Date.now() - t0 });
  const fs = frames.filter(f => f.file && existsSync(f.file)).slice(0, 3);
  if (!cfg.vision) return done({ skipped: 'off for this style or kit' });
  const flag = process.env.MOOVI_REVIEW_VISION?.trim().toLowerCase();
  if (flag === 'off') return done({ skipped: 'MOOVI_REVIEW_VISION=off' });
  // under the test runner the engine's own model is never called (an injected eye still runs); MOOVI_REVIEW_VISION=on calls it
  if (!see && process.env.NODE_TEST_CONTEXT && flag !== 'on') return done({ skipped: 'test run' });
  if (!fs.length) return done({ skipped: 'no frames saved' });
  let eye = see;
  if (!eye) {
    try { if (!runtime().vision) return done({ skipped: 'the model in use cannot see images' }); } catch (err) { return done({ skipped: `no model: ${String((err as Error)?.message ?? err).slice(0, 120)}` }); }
    eye = askVision;
  }
  const abort = new AbortController();
  let timer: NodeJS.Timeout | undefined;
  try {
    const brief = `A ${e.output?.w || 720}x${e.output?.h || 1280} talking short with burned-in captions${(e.inserts ?? []).length ? ` and ${(e.inserts ?? []).length} cards` : ''}.`;
    const findings = await Promise.race([
      eye(fs, { signal: abort.signal, max: cfg.visionMaxIssues, brief }),
      new Promise<never>((_, rej) => { timer = setTimeout(() => { abort.abort(); rej(new Error(`timed out after ${cfg.visionTimeoutMs} ms`)); }, cfg.visionTimeoutMs); }),
    ]);
    const issues: Issue[] = [];
    for (const f of (Array.isArray(findings) ? findings : []).slice(0, cfg.visionMaxIssues)) {
      const fr = fs[Math.round(f.frame) - 1]; if (!fr || typeof f.problem !== 'string' || !f.problem.trim()) continue;
      const sev = Math.max(1, Math.min(5, Math.round(Number(f.severity) || 1)));
      const ins = f.fix === 'drop' ? (e.inserts ?? []).findIndex(x => x.t0 <= fr.t && fr.t <= x.t1) : -1;
      const fix = f.fix === 'move' || f.fix === 'plate' || (f.fix === 'drop' && ins >= 0) ? f.fix : undefined;
      issues.push({ kind: 'vision', severity: sev >= cfg.visionMinSeverity ? 'error' : 'warn', t: fr.t, msg: `vision (frame ${f.frame}, ${fr.t.toFixed(2)} s): ${f.problem.trim().slice(0, 160)}`, value: sev,
        ...(fr.chunk !== undefined ? { chunk: fr.chunk } : {}), ...(ins >= 0 ? { insert: ins } : {}), ...(fix ? { fix } : {}) });
    }
    return done({ issues, findings: Array.isArray(findings) ? findings : [], asked: fs.length });
  } catch (err) {
    return done({ asked: fs.length, error: String((err as Error)?.message ?? err).slice(0, 200) });
  } finally { if (timer) clearTimeout(timer); }
}

/** The frames to show the model: the pixel pass's saved frames, each with its caption chunk. */
export const visionFrames = (frames: { t: number; file?: string }[], caps: CapBox[]): VisionFrame[] =>
  frames.filter((f): f is { t: number; file: string } => !!f.file).map(f => { const c = caps.find(x => Math.abs(x.t - f.t) < 1e-3); return { t: f.t, file: f.file, ...(c ? { chunk: c.chunk, caption: c.text } : {}) }; });
