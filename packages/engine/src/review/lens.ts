/**
 * Lens (PIPELINE.html step 7, decision 11): one checker with two inputs. CHECK (review/runner.ts) reads edit plans, the
 * film review (review/film/) reads generated films; both read the floor rules (review/floor.ts) and both hand their
 * findings to `lens()`, which puts them on one severity scale in one result shape, the one the chat chip draws.
 *
 * The scale: block (the viewer sees a broken film), fix (a craft fault to send back), note (a lead). The mapping keeps
 * what blocks today: the film review's P0 blocks, P1 is to fix, P2 a note; CHECK never blocked (it only scores and
 * repairs), so its error is to fix and its warn a note. A floor rule Ishaan marks as blocking blocks on either input.
 *
 * One fix everywhere: an edit keeps CHECK's three repairs (move, plate, drop, in runner.ts); a generated film gets one
 * re-cast of its worst failing beat by the Designer (`fixOnce`, an interface until the Designer workstream lands), and
 * when it is still wrong the best version ships with a plain note. Lens never holds up the preview.
 */
import type { Level, FloorFinding, RuleId } from './floor';
import type { Issue as FilmIssue, Review as FilmReview, Severity as FilmSeverity } from './film/types';
import { SEVERITY_COST, type Issue as CheckIssue, type Review as CheckReview, type Severity as CheckSeverity } from './types';

export interface LensFinding {
  level: Level;
  /** a stable name: CHECK's issue kind, the film review's code, or 'floor' */
  code: string;
  text: string;
  t: number | null;
  /** where it came from: code checks, the model's look at frames, or a floor rule */
  from: 'code' | 'vision' | 'floor';
  rule?: RuleId;
  beat?: number; chunk?: number; insert?: number; value?: number;
  /** the one repair that would fix it: CHECK's three for edits, a re-cast of the beat for generated films */
  fix?: 'move' | 'plate' | 'drop' | 'recast';
}

export interface LensResult {
  input: 'edit' | 'film';
  findings: LensFinding[];
  blocking: number; toFix: number; notes: number;
  /** 100 less each finding's cost (CHECK's costs: block and fix as its error, note as its warn) */
  score: number;
  /** stills or frames looked at */
  frames: number;
  seconds: number;
  /** what the one fix did, when it ran and was kept */
  repaired: string | null;
  /** the plain note when the best version ships with something still off */
  note: string | null;
}

export const LEVEL_ORDER: Record<Level, number> = { block: 0, fix: 1, note: 2 };
export const levelOfCheck = (s: CheckSeverity): Level => s === 'error' ? 'fix' : 'note';
export const levelOfFilm: Record<FilmSeverity, Level> = { P0: 'block', P1: 'fix', P2: 'note' };
export const filmSevOf: Record<Level, FilmSeverity> = { block: 'P0', fix: 'P1', note: 'P2' };
/** a floor finding as CHECK counts it (CHECK has two levels: a blocking rule still costs as an error) */
export const checkSevOf = (l: Level): CheckSeverity => l === 'note' ? 'warn' : 'error';
const COST: Record<Level, number> = { block: SEVERITY_COST.error, fix: SEVERITY_COST.error, note: SEVERITY_COST.warn };

/** CHECK's issue kinds that a floor rule produces (the rest of a floor rule's findings are kind 'floor') */
const CHECK_KIND: Partial<Record<RuleId, CheckIssue['kind']>> = { 'captions.minSec': 'caption_time', 'captions.maxWords': 'caption_words', 'captions.face': 'face' };
/** the film review's codes that a floor rule produces */
const FILM_CODE: Partial<Record<RuleId, FilmIssue['code']>> = { 'pacing.hookSec': 'late-hook', 'pacing.maxBeatSec': 'dead-beat' };

/** A floor finding as a CHECK issue (the caption rules keep CHECK's own kinds and messages). */
export function checkIssueOf(x: FloorFinding): CheckIssue {
  const kind = CHECK_KIND[x.rule] ?? 'floor';
  return { kind, severity: checkSevOf(x.level), t: x.t ?? 0, msg: x.text, ...(x.caption !== undefined ? { chunk: x.caption } : {}), ...(x.value !== undefined ? { value: x.value } : {}),
    ...(kind === 'floor' ? { rule: x.rule, ...(x.level === 'block' ? { level: x.level } : {}) } : {}) };
}

/** A floor finding as a film review issue (the beat rules keep the review's own codes and messages). */
export function filmIssueOf(x: FloorFinding): FilmIssue {
  const code = FILM_CODE[x.rule] ?? 'floor';
  return { sev: filmSevOf[x.level], code, text: x.text, ...(x.beat !== undefined ? { beat: x.beat } : {}), ...(x.t !== null ? { t: x.t } : {}), ...(code === 'floor' ? { rule: x.rule } : {}) };
}

const CHECK_FIX: Partial<Record<CheckIssue['kind'], LensFinding['fix']>> = { face: 'move', safe_zone: 'move', collision: 'move', burned_text: 'move', contrast: 'plate', repeat: 'drop', overlays: 'drop' };

export function findingOfCheck(i: CheckIssue): LensFinding {
  const fix = i.fix ?? (i.chunk !== undefined || i.insert !== undefined ? CHECK_FIX[i.kind] : undefined);
  return { level: i.level ?? levelOfCheck(i.severity), code: i.kind, text: i.msg, t: i.t, from: i.kind === 'vision' ? 'vision' : i.kind === 'floor' ? 'floor' : 'code',
    ...(i.rule ? { rule: i.rule } : {}), ...(i.chunk !== undefined ? { chunk: i.chunk } : {}), ...(i.insert !== undefined ? { insert: i.insert } : {}), ...(i.value !== undefined ? { value: i.value } : {}), ...(fix ? { fix } : {}) };
}

export function findingOfFilm(i: FilmIssue): LensFinding {
  return { level: levelOfFilm[i.sev], code: i.code, text: i.text, t: i.t ?? null, from: i.code === 'vision' ? 'vision' : i.code === 'floor' ? 'floor' : 'code',
    ...(i.rule ? { rule: i.rule } : {}), ...(i.beat !== undefined ? { beat: i.beat, fix: 'recast' as const } : {}) };
}

export type LensInput =
  | { input: 'edit'; review: CheckReview; seconds?: number; repaired?: string | null }
  | { input: 'film'; review: Pick<FilmReview, 'issues' | 'frames' | 'seconds'>; repaired?: string | null };

/** The one result shape for both inputs; findings keep the order the input gave them. */
export function lens(i: LensInput): LensResult {
  const findings = i.input === 'edit' ? i.review.issues.map(findingOfCheck) : i.review.issues.map(findingOfFilm);
  const n = (l: Level) => findings.filter(x => x.level === l).length;
  const score = i.input === 'edit' ? i.review.score : Math.max(0, 100 - findings.reduce((s, x) => s + COST[x.level], 0));
  return { input: i.input, findings, blocking: n('block'), toFix: n('fix'), notes: n('note'), score, frames: i.review.frames.length,
    seconds: i.input === 'edit' ? i.seconds ?? 0 : i.review.seconds, repaired: i.repaired ?? null, note: null };
}

/** better = fewer blocking, then fewer to fix, then fewer notes */
export const better = (a: LensResult, b: LensResult) => a.blocking - b.blocking || a.toFix - b.toFix || a.notes - b.notes;

/**
 * The chat chip's data (apps/studio ChatPanel ReviewData: frames, seconds, blocking, issues with sev P0/P1/P2, code, t,
 * text), unchanged in shape so today's chip draws it; `level`, `input`, `repaired` and `note` ride along for the UI.
 */
export function chipOf(r: LensResult) {
  return { frames: r.frames, seconds: r.seconds, blocking: r.blocking, input: r.input, repaired: r.repaired, note: r.note,
    issues: r.findings.map(x => ({ sev: filmSevOf[x.level], level: x.level, code: x.code, t: x.t, text: x.text })) };
}

// ---------------------------------------------------------------- the one fix for generated films

/**
 * The Designer re-casts one beat (decision 11). An interface for now: the Designer workstream (W7, design/cast.ts)
 * implements it. It rewrites the film's data for that beat only and hands back an undo, or null when it cannot.
 */
export type Recast = (o: { beat: number; findings: LensFinding[]; signal?: AbortSignal }) => Promise<{ undo: () => Promise<void> | void; did: string } | null>;

export interface FixOutcome { result: LensResult; kept: 'first' | 'recast'; beat: number | null; error?: string }

/** the beat worth re-casting: the first one with a blocking finding, else the first with one to fix */
export function failingBeat(r: LensResult): number | null {
  for (const l of ['block', 'fix'] as const) { const x = r.findings.find(f => f.level === l && f.beat !== undefined); if (x) return x.beat!; }
  return null;
}

/** The plain note a film ships with when something is still off after the one fix; null when nothing is. */
export function plainNote(r: LensResult): string | null {
  const off = r.findings.filter(x => x.level !== 'note');
  if (!off.length) return null;
  return `Shipped the best version; still off: ${off.slice(0, 3).map(x => x.text).join('; ')}${off.length > 3 ? ` (and ${off.length - 3} more)` : ''}.`;
}

/**
 * The one fix for a generated film: re-cast the worst failing beat once, check again, keep whichever is better, and
 * when something is still off ship it with a plain note. With no recaster (today) the first version ships with its
 * note. Never throws; a recaster that fails leaves the first version.
 */
export async function fixOnce(o: { first: LensResult; recast?: Recast; recheck: () => Promise<LensResult>; signal?: AbortSignal }): Promise<FixOutcome> {
  const ship = (result: LensResult, kept: FixOutcome['kept'], beat: number | null, error?: string): FixOutcome => ({ result: { ...result, note: plainNote(result) }, kept, beat, ...(error ? { error } : {}) });
  const beat = failingBeat(o.first);
  if (beat === null || !o.recast || o.signal?.aborted) return ship(o.first, 'first', beat);
  let done: Awaited<ReturnType<Recast>> = null;
  try {
    done = await o.recast({ beat, findings: o.first.findings.filter(x => x.beat === beat), ...(o.signal ? { signal: o.signal } : {}) });
    if (!done) return ship(o.first, 'first', beat);
    const second = await o.recheck();
    if (better(second, o.first) < 0) return ship({ ...second, repaired: done.did }, 'recast', beat);
    await done.undo();
    return ship(o.first, 'first', beat);
  } catch (err) {
    try { await done?.undo(); } catch { /* the first version stays as the recaster left it */ }
    return ship(o.first, 'first', beat, String((err as Error)?.message ?? err).slice(0, 200));
  }
}

export const sortFindings = (xs: LensFinding[]) => [...xs].sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level] || (a.t ?? 0) - (b.t ?? 0));
