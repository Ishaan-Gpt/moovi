/**
 * The answer checker for brain calls (Claude Code bridge item 10). Whatever lane answered (the user's Claude Code, their
 * key or the server model), the answer is read strictly against the step's own contract; a bad one gets ONE re-ask
 * that quotes the exact problems; a second bad one (or no answer at all) gets the stage's safe default (the rules), and
 * the result says so, so the site can show "Moovi's default used for this step". The video always finishes.
 *
 * Determinism: the re-ask carries the first answer and its problems as `history`, so it is its own step with its own
 * memo entry; re-running a job replays both answers from the memo and lands on the same result, asking nothing.
 * `BrainWaiting` is never swallowed (the job parks until Claude Code is back). Pure apart from the `ask` it is given.
 */
import { BrainWaiting } from './lane';

export type History = { role: 'user' | 'assistant'; text: string }[];
export type Reader<T> = (raw: unknown) => { ok: true; value: T } | { ok: false; problems: string[] };

export interface Checked<T> {
  value: T;
  /** brain = first answer; reask = the answer to the one re-ask; default = the rules */
  source: 'brain' | 'reask' | 'default';
  /** every bad try's problems (or error), in order */
  problems: string[][];
  tries: number;
  /** for the job's activity row when the default was used */
  note?: string;
}

export const DEFAULT_NOTE = 'Moovi\'s default used for this step';
export const MAX_PROBLEMS_QUOTED = 8;

/** The re-ask turn: the exact problems, then what to send. */
export function reaskText(problems: string[]): string {
  const ps = problems.slice(0, MAX_PROBLEMS_QUOTED);
  return `Your answer had ${problems.length === 1 ? 'a problem' : 'these problems'}:\n${ps.map(p => `- ${p}`).join('\n')}${problems.length > ps.length ? `\n- and ${problems.length - ps.length} more` : ''}\nSend the whole answer again as one JSON object that fixes ${problems.length === 1 ? 'it' : 'them'}, and nothing else.`;
}

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 200);

export async function askChecked<T>(o: {
  /** one round on the lane: no history = the first ask; history = the re-ask */
  ask: (history?: History) => Promise<string>;
  read: Reader<T>;
  /** the rules' answer for this stage */
  fallback: () => T;
  /** for log lines */
  label: string;
  log?: (line: string) => void;
}): Promise<Checked<T>> {
  const problems: string[][] = [];
  let raw1: string | null = null;
  try {
    raw1 = await o.ask();
    const r = o.read(raw1);
    if (r.ok) return { value: r.value, source: 'brain', problems, tries: 1 };
    problems.push(r.problems);
  } catch (e) {
    if (e instanceof BrainWaiting) throw e;
    problems.push([`no answer: ${msg(e)}`]);
  }
  const first = problems[0]!;
  o.log?.(`${o.label}: re-asking once (${first.slice(0, 3).join('; ')})`);
  try {
    const history: History = raw1 !== null ? [{ role: 'assistant', text: raw1 }, { role: 'user', text: reaskText(first) }] : [];
    const raw2 = await o.ask(history.length ? history : undefined);
    const r = o.read(raw2);
    if (r.ok) return { value: r.value, source: 'reask', problems, tries: 2 };
    problems.push(r.problems);
  } catch (e) {
    if (e instanceof BrainWaiting) throw e;
    problems.push([`no answer: ${msg(e)}`]);
  }
  o.log?.(`${o.label}: ${DEFAULT_NOTE} (${problems[1]!.slice(0, 3).join('; ')})`);
  return { value: o.fallback(), source: 'default', problems, tries: 2, note: DEFAULT_NOTE };
}
