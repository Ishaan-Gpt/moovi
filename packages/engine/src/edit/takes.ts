import { bare, FILLERS, type Word } from './cut';

/**
 * W15 steps 1 and 2, the Editor's takes: a raw recording of yourself says the same line twice or more ("So today we...
 * so today we're going to talk about Moovi."). The lines that are retakes of one another are grouped, each take is
 * scored on fluency (fillers, restarts, stumbles, word gaps, whether it was finished) and on the hearing's confidence
 * (each word's `p`), and one take per group is kept; the others (and any short aside said between them, "sorry, again")
 * are cut as `retake` holes by the builder (build.ts). "use take 2" swaps the kept take later (reedit.ts).
 * Pure: words in, a plan of takes out, so it is unit-tested on word lists. A clip without retakes gives no groups.
 */

export interface TakeMarks {
  fillers: number; restarts: number; stumbles: number;
  /** pauses inside the take longer than SCORING.gap_s */
  gaps: number;
  /** its spoken words over the longest take's in the group (a take that broke off scores under 1) */
  complete: number;
}
export interface Take {
  /** 1-based, in the order said */
  n: number;
  /** source seconds: the first word's start, the last word's end */
  a: number; b: number;
  text: string;
  fluency: number;
  /** the hearing's mean word confidence (1 when the words carry none) */
  confidence: number;
  marks: TakeMarks;
}
export interface TakeGroup {
  id: number;
  takes: Take[];
  /** the take played (its `n`) */
  kept: number;
  by: 'score' | 'person';
  why: string;
  /** short asides said between two takes ("sorry, one more time"), cut with the dropped takes */
  between: { a: number; b: number; text: string }[];
}
export interface Takes { version: 1; groups: TakeGroup[]; scoring: typeof SCORING }

/**
 * How takes are compared. Fluency first, then the hearing's confidence, then the later take (a person usually says a
 * line again to fix it). The order and the penalties are a taste call that is Ishaan's: energy and pace (loudness) are
 * not weighed yet. Until he says, fluency-first.
 */
export const SCORING = {
  order: ['fluency', 'confidence', 'later'] as const,
  penalty: { filler: 0.15, restart: 0.2, stumble: 0.2, gap: 0.1 },
  /** a pause inside a take longer than this counts as a gap */
  gap_s: 0.6,
  /** fluency within this of the best is a tie (confidence decides), confidence within `tie_p` too (the later take) */
  tie: 0.05, tie_p: 0.03,
  pending: 'ishaan' as const,
};

/** How lines are found to be retakes of each other (not taste: what counts as "the same line"). */
export const GROUPING = {
  /** a pause this long ends a line even without a full stop (a broken-off take rarely gets one) */
  line_gap: 0.7,
  /** a later take starts at most this long after the earlier one ends, with at most `max_between` lines between */
  window_s: 20, max_between: 2,
  /** a line between two takes is an aside (cut with them) only up to this many words; a longer one is content */
  aside_words: 6,
  /** a whole retake: their common words over the longer line */
  same: 0.6,
  /** a false start: the earlier line's words found at the start of the later one */
  start: 0.8,
};

const isStop = (w: string) => /[.!?।]["')\]]*$/.test(w.trim());
const truncated = (w: string) => /[-–—…]$|\.\.\.$/.test(w.trim());
const toks = (ws: Word[]) => ws.map(w => bare(w.word)).filter(t => t && !FILLERS.has(t));
const r3 = (x: number) => Math.round(x * 1000) / 1000;

function lcs(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  let prev = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    const cur = new Array<number>(b.length + 1).fill(0);
    for (let j = 1; j <= b.length; j++) cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1]! + 1 : Math.max(prev[j]!, cur[j - 1]!);
    prev = cur;
  }
  return prev[b.length]!;
}

/** Lines: word runs closed by a full stop or a pause over `line_gap`; a line that restarts itself ("so today we so today we are") is split where it restarts. */
export function linesOf(ws: Word[]): Word[][] {
  const out: Word[][] = []; let cur: Word[] = [];
  ws.forEach((w, i) => {
    const prev = ws[i - 1];
    if (cur.length && prev && w.t - prev.end > GROUPING.line_gap) { out.push(cur); cur = []; }
    cur.push(w);
    if (isStop(w.word)) { out.push(cur); cur = []; }
  });
  if (cur.length) out.push(cur);
  // a restart inside one line: its first two spoken words said again further on
  return out.flatMap(line => {
    const parts: Word[][] = [];
    let rest = line;
    for (let guard = 0; guard < 8; guard++) {
      const sp = rest.map((w, k) => ({ t: bare(w.word), k })).filter(x => x.t && !FILLERS.has(x.t));
      if (sp.length < 4) break;
      const [x0, x1] = [sp[0]!.t, sp[1]!.t];
      const j = sp.findIndex((x, k) => k >= 2 && x.t === x0 && sp[k + 1]?.t === x1);
      if (j < 0) break;
      parts.push(rest.slice(0, sp[j]!.k)); rest = rest.slice(sp[j]!.k);
    }
    return [...parts, rest].filter(p => p.length);
  });
}

/** Two lines said as one: a whole retake (most words shared), or the earlier one a false start of the later. */
export function sameLine(early: Word[], late: Word[]): boolean {
  const a = toks(early), b = toks(late);
  if (!a.length || !b.length) return false;
  const short = Math.min(a.length, b.length);
  if (short >= 3 && lcs(a, b) / Math.max(a.length, b.length) >= GROUPING.same) return true;
  // a false start: 2+ words, the same first word, nearly all found at the start of the later line, which is longer
  if (a.length >= 2 && a.length < b.length && a[0] === b[0] && !isStop(early.at(-1)!.word)) return lcs(a, b.slice(0, a.length + 2)) / a.length >= GROUPING.start;
  return false;
}

/** Fluency marks of one take (before `complete`, which needs the group). */
function marksOf(ws: Word[]): Omit<TakeMarks, 'complete'> {
  const all = ws.map(w => bare(w.word)).filter(Boolean);
  const fillers = all.filter(t => FILLERS.has(t)).length;
  const sp = all.filter(t => !FILLERS.has(t));
  let restarts = 0;
  for (let i = 1; i < sp.length; i++) {
    if (sp[i] === sp[i - 1]) restarts++;
    else if (i >= 3 && sp[i] === sp[i - 2] && sp[i - 1] === sp[i - 3]) restarts++;
  }
  const stumbles = ws.filter(w => truncated(w.word)).length;
  let gaps = 0;
  for (let i = 1; i < ws.length; i++) if (ws[i]!.t - ws[i - 1]!.end > SCORING.gap_s) gaps++;
  return { fillers, restarts, stumbles, gaps };
}

function scoreTakes(lines: Word[][]): Take[] {
  const longest = Math.max(1, ...lines.map(l => toks(l).length));
  return lines.map((l, k) => {
    const m = marksOf(l), complete = r3(Math.min(1, toks(l).length / longest));
    const P = SCORING.penalty;
    const fluency = r3(Math.max(0, 1 - P.filler * m.fillers - P.restart * m.restarts - P.stumble * m.stumbles - P.gap * m.gaps) * complete);
    const ps = l.map(w => w.p).filter((p): p is number => typeof p === 'number');
    const confidence = r3(ps.length ? ps.reduce((x, y) => x + y, 0) / ps.length : 1);
    return { n: k + 1, a: r3(l[0]!.t), b: r3(l.at(-1)!.end), text: l.map(w => w.word).join(' '), fluency, confidence, marks: { ...m, complete } };
  });
}

/** The take to keep: fluency first, then confidence, then the later take (SCORING, pending Ishaan's word). */
export function bestTake(takes: Take[]): number {
  const top = Math.max(...takes.map(t => t.fluency));
  const fluent = takes.filter(t => t.fluency >= top - SCORING.tie);
  const clear = Math.max(...fluent.map(t => t.confidence));
  return fluent.filter(t => t.confidence >= clear - SCORING.tie_p).at(-1)!.n;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
function faults(t: Take): string {
  const m = t.marks, xs: string[] = [];
  if (m.complete < 0.85) xs.push(`broke off after ${plural(Math.round(t.text.split(/\s+/).filter(w => !FILLERS.has(bare(w))).length), 'word')}`);
  if (m.fillers) xs.push(plural(m.fillers, 'filler'));
  if (m.restarts) xs.push(plural(m.restarts, 'restart'));
  if (m.stumbles) xs.push(plural(m.stumbles, 'stumble'));
  if (m.gaps) xs.push(plural(m.gaps, 'long pause'));
  return xs.join(', ');
}
/** Why a take is the kept one, in a line (takes.json and the note to the person). */
export function whyKept(g: Pick<TakeGroup, 'takes' | 'kept' | 'by'>): string {
  const k = g.takes.find(t => t.n === g.kept)!;
  if (g.by === 'person') return `take ${k.n}: you chose it`;
  const others = g.takes.filter(t => t.n !== k.n);
  const worse = others.map(t => { const f = faults(t); return f ? `take ${t.n} ${f}` : ''; }).filter(Boolean);
  if (others.every(t => t.fluency < k.fluency - SCORING.tie)) return `take ${k.n}: the most fluent${worse.length ? ` (${worse.join('; ')})` : ''}`;
  if (others.every(t => t.fluency < k.fluency - SCORING.tie || t.confidence < k.confidence - SCORING.tie_p)) return `take ${k.n}: as fluent, heard more clearly (confidence ${k.confidence} against ${others.map(t => t.confidence).join(', ')})`;
  return `take ${k.n}: as fluent and as clear, the later take`;
}

/**
 * Find the retakes in a clip's timed words: lines grouped when a later line says an earlier one again (within
 * GROUPING.window_s, at most GROUPING.max_between short asides between), every take scored, the best one kept.
 */
export function findTakes(words: Word[]): Takes {
  const ws = words.filter(w => w.word.trim() && w.end >= w.t).sort((a, b) => a.t - b.t);
  const lines = linesOf(ws);
  const groupOf = new Map<number, number>(), members: number[][] = [];
  for (let j = 1; j < lines.length; j++) {
    for (let i = j - 1; i >= Math.max(0, j - 1 - GROUPING.max_between); i--) {
      const between = lines.slice(i + 1, j).map((l, k) => i + 1 + k);
      // an aside between two takes is short and belongs to no other group; a longer line between is content: stop
      if (between.some(b => toks(lines[b]!).length > GROUPING.aside_words || groupOf.has(b))) break;
      if (lines[j]![0]!.t - lines[i]!.at(-1)!.end > GROUPING.window_s) break;
      // an aside run into the retake without a pause ("sorry Try it today."): split it off, then this line is the aside
      const head = toks(lines[i]!)[0];
      const k = toks(lines[j]!)[0] === head ? -1 : lines[j]!.findIndex((w, x) => x > 0 && x <= GROUPING.aside_words && bare(w.word) === head && sameLine(lines[i]!, lines[j]!.slice(x)));
      if (k > 0) { lines.splice(j, 1, lines[j]!.slice(0, k), lines[j]!.slice(k)); j--; break; }
      if (!sameLine(lines[i]!, lines[j]!)) continue;
      const gid = groupOf.get(i) ?? (members.push([i]) - 1);
      groupOf.set(i, gid); members[gid]!.push(j); groupOf.set(j, gid);
      break;
    }
  }
  const groups: TakeGroup[] = members.map((idx, id) => {
    const takes = scoreTakes(idx.map(i => lines[i]!));
    const between = idx.slice(1).flatMap((j, k) => lines.slice(idx[k]! + 1, j)).map(l => ({ a: r3(l[0]!.t), b: r3(l.at(-1)!.end), text: l.map(w => w.word).join(' ') }));
    const g = { id, takes, kept: bestTake(takes), by: 'score' as const, between };
    return { ...g, why: whyKept(g) };
  });
  return { version: 1, groups, scoring: SCORING };
}

/** The source spans to cut: every take not kept, and the asides between takes. */
export function dropSpans(t: Takes | null | undefined): { a: number; b: number; text: string }[] {
  if (!t) return [];
  return t.groups.flatMap(g => [...g.takes.filter(x => x.n !== g.kept).map(x => ({ a: x.a, b: x.b, text: x.text })), ...g.between]).sort((x, y) => x.a - y.a);
}

/** The person chose a take: a new Takes with that group's kept take changed (pure). */
export function chooseTake(t: Takes, group: number, n: number): Takes {
  return { ...t, groups: t.groups.map(g => g.id !== group ? g : (() => { const x = { ...g, kept: n, by: 'person' as const }; return { ...x, why: whyKept(x) }; })()) };
}

/** A take said by its place: "take 2", "the second take", "the other take", "the last take", "this one" (with a time). */
export type TakePick = number | 'first' | 'last' | 'other' | 'earlier' | 'later' | 'this';
export function pickN(g: TakeGroup, pick: Exclude<TakePick, 'this'>): number | null {
  const ns = g.takes.map(t => t.n);
  if (typeof pick === 'number') return ns.includes(pick) ? pick : null;
  if (pick === 'first') return ns[0]!;
  if (pick === 'last') return ns.at(-1)!;
  if (pick === 'other') return ns.length === 2 ? ns.find(n => n !== g.kept)! : null;
  if (pick === 'earlier') return ns.includes(g.kept - 1) ? g.kept - 1 : null;
  return ns.includes(g.kept + 1) ? g.kept + 1 : null;
}
