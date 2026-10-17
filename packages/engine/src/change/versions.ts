import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Edl } from '../edit/edl';
import { parseEdit, reEditDir, type ReEditOpts, type ReEditResult, type ReEditStep } from '../edit/reedit';
import { liveRefFile, type LiveRef } from '../styles/serve';
import { forkDir } from './fork';

export { forkDir, forksOf, linkInto } from './fork';

/**
 * W10 step 1: every version of a film is its own folder, so going back to an older version plays that version, and
 * undo and redo walk the whole list.
 *
 * - A change forks the folder of the version it changes into `videos/<chat>/v<n>/`: the plan files (edl.json, film.json,
 *   words.json and the other small json and text files) are copied, the media (the clip, hd.mp4, voice, audio,
 *   pictures) are hard-linked, so nothing large is copied (a copy only where the disk cannot link). The change is then
 *   made in the new folder; the old one is never written again (apart from the picture pass that finishes late,
 *   which reaches every fork: see `forksOf`).
 * - The live ref of a version (v<n>.live.json) points at its folder and carries the undo stack: `states` are the
 *   versions that hold each step of the history, `at` the one this version shows.
 * - Undo and redo make a new version too (version numbers only grow, the studio lists them all): its ref points at the
 *   folder of the step it goes back to, which is never written again, so it plays that step exactly.
 */
export interface VersionStack { states: number[]; at: number }
export type VersionRef = LiveRef & { stack?: VersionStack; from?: number };

/** The folder a version made by a change lives in. */
export const versionDir = (projectDir: string, chat: string, version: number) => join(projectDir, 'videos', chat, `v${version}`);

export function readRef(projectDir: string, chat: string, version: number): VersionRef | null {
  const f = liveRefFile(projectDir, chat, version);
  return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) as VersionRef : null;
}
export const stackOf = (ref: VersionRef, version: number): VersionStack => ref.stack ?? { states: [version], at: 0 };

export interface ChangeResult extends ReEditResult {
  written: boolean;
  /** the new version, when one was made */
  version?: number;
  ref?: VersionRef;
  /** what the message did to the history: a change, a walk back or forward, or nothing */
  kind: 'change' | 'undo' | 'redo' | 'none';
}

const durationOf = (e: Edl) => e.shots.at(-1)?.t_out ?? 0;
const readEdl = (dir: string) => JSON.parse(readFileSync(join(dir, 'edl.json'), 'utf8')) as Edl;

/**
 * Change a live edit by words as a new version (`next`, the chat's next version number). "undo" and "redo" walk the
 * stack of the version shown (`version`); any other instruction in the message is then made on that step, in a
 * fork of its folder. Nothing is written when nothing changed (no version, `written` false).
 */
export async function changeEdit(o: { projectDir: string; chat: string; version: number; next: number; words: string; opts?: ReEditOpts }): Promise<ChangeResult> {
  const t0 = performance.now();
  const ref = readRef(o.projectDir, o.chat, o.version);
  if (!ref) throw new Error(`Version ${o.version} has no live ref`);
  const stack = stackOf(ref, o.version);
  const cur = readEdl(ref.dir);
  const parsed = parseEdit(o.words);
  // walk the stack first, in the order said; then the rest of the message is a change on the step it lands on
  let at = stack.at;
  const walked: ReEditStep[] = [];
  for (const x of parsed.ops) {
    if (x.op.op === 'undo') { const ok = at > 0; if (ok) at--; walked.push({ ...x, did: ok ? 'put the previous edit back' : 'nothing to undo' }); }
    else if (x.op.op === 'redo') { const ok = at < stack.states.length - 1; if (ok) at++; walked.push({ ...x, did: ok ? 'put the undone edit back' : 'nothing to redo' }); }
  }
  let change = parsed.ops.filter(x => x.op.op !== 'undo' && x.op.op !== 'redo').map(x => x.said);
  // a version made before W10 (no stack) kept its one undo step in its folder (edl.prev.json): its message goes whole
  // to reEditDir in a fork, as it did in place
  if (!ref.stack && at === stack.at && walked.some(w => w.op.op === 'undo') && existsSync(join(ref.dir, 'edl.prev.json'))) { change = parsed.ops.map(x => x.said); walked.length = 0; }
  const base = at === stack.at ? ref : readRef(o.projectDir, o.chat, stack.states[at]!);
  if (!base) throw new Error(`Version ${stack.states[at]} has no live ref`);
  const before = durationOf(cur);
  const finish = (kind: ChangeResult['kind'], edl: Edl, dir: string, states: VersionStack, extra: Partial<ReEditResult> = {}): ChangeResult => {
    const next: VersionRef = { ...base, dir, duration: +durationOf(edl).toFixed(3), stack: states, from: o.version };
    writeFileSync(liveRefFile(o.projectDir, o.chat, o.next), JSON.stringify(next, null, 1));
    return { edl, steps: walked, unknown: parsed.unknown, problems: [], ms: Math.round(performance.now() - t0), duration: { before, after: +durationOf(edl).toFixed(3) }, ...extra, written: true, version: o.next, ref: next, kind };
  };

  if (!change.length) {
    // only a walk: the new version plays the step it lands on, from that step's own folder (never written again)
    if (at === stack.at) return { edl: cur, steps: walked, unknown: parsed.unknown, problems: [], ms: Math.round(performance.now() - t0), duration: { before, after: before }, written: false, kind: 'none' };
    const kind = at < stack.at ? 'undo' : 'redo';
    return finish(kind, readEdl(base.dir), base.dir, { states: stack.states, at });
  }

  // a change: fork the step's folder, change it there; the history after this step is dropped (a new branch)
  const dir = versionDir(o.projectDir, o.chat, o.next);
  forkDir(base.dir, dir);
  const r = await reEditDir(dir, [...change, ...parsed.unknown].join(', '), o.opts);
  if (!r.written) {
    rmSync(dir, { recursive: true, force: true });
    if (at !== stack.at) return { ...finish(at < stack.at ? 'undo' : 'redo', readEdl(base.dir), base.dir, { states: stack.states, at }), steps: [...walked, ...r.steps], problems: r.problems, unknown: r.unknown };
    return { ...r, steps: [...walked, ...r.steps], duration: { before, after: r.duration.after }, ms: Math.round(performance.now() - t0), written: false, kind: 'none' };
  }
  const states = { states: [...stack.states.slice(0, at + 1), o.next], at: at + 1 };
  const out = finish('change', r.edl, dir, states, { ...(r.review ? { review: r.review } : {}), unknown: r.unknown, problems: r.problems });
  return { ...out, steps: [...walked, ...r.steps] };
}
