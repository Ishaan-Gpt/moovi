/**
 * Lints on the film's own data (film.json + script.txt), no browser: the beat map in seconds. Every style writes its
 * beats with t0/t1 (Style 4 and 5 `beats`, Dark Vox `shots`, Anatomy `secs`), so one reader covers them all.
 * Numbers follow docs/agents/research/R11-open-design.md: the hook lands by about 2.5 s, no beat sits still past
 * ~6.5 s, an end card is 8–30 % of the film, captions carry the script's words. The hook and the beat length are floor
 * rules (review/floor.ts), so their numbers live there; the rest of the floor runs over the plan after them.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beatFloor, floorCheck, floorRules, type FloorFilm, type FloorRules } from '../floor';
import { filmIssueOf } from '../lens';
import type { Issue } from './types';

export interface Beat { i: number; t0: number; t1: number; setup: string; words: string[] }
export interface Plan { duration: number; beats: Beat[]; end: number | null; script: string[] }

const words = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);

/** The beats of any style's film.json, in time order. */
export function readPlan(dir: string): Plan {
  const film = JSON.parse(readFileSync(join(dir, 'film.json'), 'utf8')) as Record<string, unknown>;
  const list = (['beats', 'shots', 'secs'] as const).map(k => film[k]).find(v => Array.isArray(v) && v.length && typeof (v[0] as { t0?: unknown }).t0 === 'number') as Record<string, unknown>[] | undefined ?? [];
  // Anatomy keeps its sections in `secs` and its word timings in `beats`: the sections are the set-ups
  const secs = Array.isArray(film.secs) ? film.secs as Record<string, unknown>[] : null;
  const src = secs?.length ? secs : list;
  const toks = (b: Record<string, unknown>) => Array.isArray(b.toks) ? (b.toks as { text?: string }[]).map(x => x.text ?? '').join(' ') : typeof b.text === 'string' ? b.text : '';
  const beats = src.map((b, i) => ({ i, t0: Number(b.t0), t1: Number(b.t1), setup: String(b.setup ?? b.figure ?? ''), words: words(toks(b)) })).sort((a, b) => a.t0 - b.t0);
  // word timings may live apart from the set-ups (Anatomy): gather every caption word in the film
  if (secs?.length && Array.isArray(film.beats)) {
    const all = (film.beats as Record<string, unknown>[]).flatMap(b => Array.isArray(b.toks) ? (b.toks as { text?: string; t?: number }[]) : []);
    for (const b of beats) b.words = words(all.filter(x => (x.t ?? -1) >= b.t0 && (x.t ?? -1) < b.t1).map(x => x.text ?? '').join(' '));
  }
  const end = film.end && typeof (film.end as { t0?: unknown }).t0 === 'number' ? (film.end as { t0: number }).t0 : null;
  const sf = join(dir, 'script.txt');
  const script = existsSync(sf) ? readFileSync(sf, 'utf8').split('\n').filter(l => l.trim() && !l.trim().startsWith('#')) : [];
  return { duration: Number(film.duration) || (beats.at(-1)?.t1 ?? 0), beats, end, script };
}

/**
 * A generated film as the floor reads it: its beats (the end card marked, which may hold) and their starts as the
 * visual changes. Captions, transitions, text sizes and sound are not in film.json in one shape yet, so they are left
 * out, never guessed.
 */
export function floorOfPlan(p: Plan): FloorFilm {
  // the end card is allowed to hold; every other beat must move on
  const beats = p.beats.map(b => ({ i: b.i, t0: b.t0, t1: b.t1, setup: b.setup, ...(p.end !== null && b.t0 >= p.end - 0.05 ? { end: true } : {}) }));
  return { input: 'film', duration: p.duration, beats, changes: beats.slice(1).map(b => b.t0) };
}

const BEAT_RULES = ['pacing.hookSec', 'pacing.maxBeatSec', 'text.textOnly'] as const;

export function lintPlan(p: Plan, o: { captions: boolean } = { captions: true }, rules: FloorRules = floorRules()): Issue[] {
  const out: Issue[] = [];
  const film = floorOfPlan(p);
  out.push(...beatFloor(film.beats!, rules).map(filmIssueOf));
  for (let i = 1; i < p.beats.length; i++) {
    const a = p.beats[i - 1]!, b = p.beats[i]!;
    if (a.setup && a.setup === b.setup) out.push({ sev: 'P2', code: 'repeat-setup', beat: b.i, t: b.t0, text: `beats ${a.i + 1} and ${b.i + 1} use the same set-up (${b.setup}) back to back` });
  }
  if (p.end !== null && p.duration > 0) {
    const share = (p.duration - p.end) / p.duration;
    if (share < 0.08 || share > 0.3) out.push({ sev: 'P2', code: 'end-card', t: p.end, text: `the end card is ${Math.round(share * 100)} % of the film; 8–30 % reads as a deliberate close` });
  }
  // captions against the script: every script word should be heard and read (a dropped line is a real bug)
  const said = words(p.script.join(' ')), shown = new Set(p.beats.flatMap(b => b.words));
  if (o.captions && said.length >= 6 && shown.size) {
    const missing = said.filter(w => !shown.has(w));
    const cover = 1 - missing.length / said.length;
    if (cover < 0.85) out.push({ sev: 'P1', code: 'caption-gap', text: `captions carry ${Math.round(cover * 100)} % of the script's words (missing e.g. "${[...new Set(missing)].slice(0, 5).join('", "')}")` });
  }
  out.push(...floorCheck(film, rules, [...BEAT_RULES]).map(filmIssueOf));
  return out;
}
