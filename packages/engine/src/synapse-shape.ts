/**
 * The synapse view's wire format and its whitelist (client-safe: no node imports). Everything the studio's graph view
 * receives is built here, field by field, from raw rows: a field that is not named below never leaves the server.
 * What may go out: agent ids, named-query names, which kind of graph (craft, your memory, this project…), row counts,
 * times, task kinds and states, decision kinds and short crew labels. Never: query text, parameters, graph names,
 * user or project ids, file paths, URLs, emails, keys, prompts, model answers, error messages.
 */
import { agentOf, type AgentId } from './events';

/** Which memory a query touched. The graph's real name (user_…, proj_…) is never sent. */
export type MemKind = 'craft' | 'you' | 'project' | 'styles' | 'sys' | 'other';
export const MEM_KINDS: MemKind[] = ['project', 'you', 'craft', 'styles', 'sys', 'other'];

/** One call or one step. Compact keys: a run sends hundreds of these. */
export interface SynEvent {
  /** when (ms) */ t: number;
  /** the run (its own short id) */ r: string;
  /** which agent */ a: AgentId;
  /** q = a graph call, s = an agent step (a task or a preset stage started, finished, failed) */ k: 'q' | 's';
  /** q: the named query */ q?: string;
  /** q: which memory */ g?: MemKind;
  /** q: rows back */ n?: number;
  /** q: ms */ ms?: number;
  /** q: 1 = a write */ w?: 1;
  /** q: 1 = it failed */ e?: 1;
  /** s: what kind of step */ x?: 'start' | 'done' | 'fail' | 'line';
  /** s: a short safe label ("cutting the clip") */ s?: string;
}

export interface SynTask { id: string; kind: string; agent: AgentId; status: string; ms: number | null }
export interface SynCause { label: 'Rule' | 'Reference' | 'Asset' | 'Feedback'; id: string }
export interface SynDecision { kind: string; agent: AgentId; choice: string; why: string; causes: SynCause[] }
export interface SynQuery { name: string; g: MemKind; about: string; write: boolean }
export interface SynRun { id: string; n: number; status: string; kind: string; at: number | null }
export interface SynSnapshot {
  /** the project, shortened (the owner's own) */ project: string;
  runs: SynRun[];
  run: SynRun | null;
  /** where the view follows on from (the live stream's id) */ seq: string;
  /** true once the run ended and its synapse was kept in FalkorDB */ kept: boolean;
  events: SynEvent[];
  tasks: SynTask[];
  decisions: SynDecision[];
  /** what each named query in the events does (the static line from packages/graph) */ queries: SynQuery[];
}

/* ───────── value whitelists ───────── */

const NAME = /^[A-Za-z][A-Za-z0-9_]{0,47}$/;
/** a short human label: letters, digits, spaces and light punctuation; no slashes, colons, @, = or URLs */
const LABEL = /^[\p{L}\p{N} .,'’·()&+\-–—%×!?]{1,80}$/u;
const ID = /^[A-Za-z0-9_.\-:]{1,64}$/;
/** a long hex or base64-looking run of characters (a token, a hash, a key) */
const SECRETISH = /([A-Za-z0-9_\-]{24,})|(sk-|gsk_|AKIA|Bearer)/;

export const qName = (s: unknown): string => (typeof s === 'string' && NAME.test(s) ? s : 'query');
export const memKind = (graph: unknown): MemKind => {
  const g = String(graph ?? '');
  if (g === 'craft' || g === 'sys' || g === 'styles') return g;
  if (g === 'you' || g === 'user' || g.startsWith('user_')) return 'you';
  if (g === 'project' || g.startsWith('proj_')) return 'project';
  return 'other';
};
export function label(s: unknown, max = 56): string | null {
  if (typeof s !== 'string') return null;
  const t = s.replace(/\s+/g, ' ').trim();
  if (!t || !LABEL.test(t) || SECRETISH.test(t)) return null;
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}
export const safeId = (s: unknown): string | null => (typeof s === 'string' && ID.test(s) && !SECRETISH.test(s) ? s : null);
/** an id we own (run, task, project) shown short: its last 6 characters */
export const shortId = (s: unknown): string => String(s ?? '').replace(/[^A-Za-z0-9]/g, '').slice(-6);
/** a query's one-line description: static text from packages/graph (the server only sends lines for names it knows) */
const aboutLine = (s: unknown): string => {
  if (typeof s !== 'string') return '';
  const t = s.replace(/[\u0000-\u001f]+/g, ' ').trim();
  return SECRETISH.test(t) || /https?:|[\\@]/.test(t) ? '' : t.slice(0, 220);
};
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const word = (s: unknown, fallback: string): string => (typeof s === 'string' && /^[a-z][a-z0-9_\-]{0,31}$/i.test(s) ? s : fallback);

/* ───────── shapers: raw rows in, whitelisted objects out ───────── */

export function shapeEvent(raw: Record<string, unknown>): SynEvent | null {
  const t = num(raw.t), k = raw.k;
  if (t === null || (k !== 'q' && k !== 's')) return null;
  const ev: SynEvent = { t, r: shortId(raw.r), a: agentOf(typeof raw.a === 'string' ? raw.a : null), k };
  if (k === 'q') {
    ev.q = qName(raw.q); ev.g = memKind(raw.g);
    ev.n = Math.max(0, Math.round(num(raw.n) ?? 0)); ev.ms = Math.max(0, +(num(raw.ms) ?? 0).toFixed(1));
    if (raw.w) ev.w = 1;
    if (raw.e) ev.e = 1;
  } else {
    ev.x = raw.x === 'start' || raw.x === 'done' || raw.x === 'fail' || raw.x === 'line' ? raw.x : 'line';
    const s = ev.x === 'fail' ? null : label(raw.s);
    ev.s = s ?? (ev.x === 'fail' ? 'failed' : ev.x === 'done' ? 'done' : 'working');
  }
  return ev;
}
export const shapeEvents = (raw: unknown): SynEvent[] =>
  (Array.isArray(raw) ? raw : []).map(x => (x && typeof x === 'object' ? shapeEvent(x as Record<string, unknown>) : null)).filter((x): x is SynEvent => !!x);

export const shapeTask = (r: Record<string, unknown>): SynTask => ({
  id: shortId(r.id), kind: word(r.kind, 'task'), agent: agentOf(typeof r.agent === 'string' ? r.agent : null),
  status: word(r.status, 'waiting'), ms: num(r.ms) ?? (num(r.ended) !== null && num(r.started) !== null ? (r.ended as number) - (r.started as number) : null),
});

const CAUSES = new Set(['Rule', 'Reference', 'Asset', 'Feedback']);
export function shapeDecision(r: Record<string, unknown>): SynDecision {
  const causes = (Array.isArray(r.causes) ? r.causes : []).flatMap((c: Record<string, unknown> | null) => {
    if (!c || !CAUSES.has(String(c.label))) return [];
    const lab = c.label as SynCause['label'];
    // the user's own words stay in their notes: the view shows that a note was the cause, not what it said
    const id = lab === 'Feedback' ? 'your note' : safeId(c.id);
    return id ? [{ label: lab, id }] : [];
  });
  return { kind: word(r.kind, 'decision'), agent: agentOf(typeof r.agent === 'string' ? r.agent : null), choice: label(r.choice, 64) ?? 'a choice', why: label(r.why, 80) ?? '', causes };
}

export const shapeRun = (r: Record<string, unknown>): SynRun => ({
  id: shortId(r.id), n: num(r.n) ?? 1, status: word(r.status, 'planned'), kind: word(r.kind, 'make'), at: num(r.at),
});

export function shapeSnapshot(raw: {
  project: unknown; runs: Record<string, unknown>[]; run: Record<string, unknown> | null; seq: unknown; kept: unknown;
  events: unknown; tasks: Record<string, unknown>[]; decisions: Record<string, unknown>[];
  queries: Record<string, unknown>[];
}): SynSnapshot {
  return {
    project: shortId(raw.project),
    runs: raw.runs.map(shapeRun),
    run: raw.run ? shapeRun(raw.run) : null,
    seq: typeof raw.seq === 'string' && /^\d+-\d+$/.test(raw.seq) ? raw.seq : '0',
    kept: raw.kept === true,
    events: shapeEvents(raw.events),
    tasks: raw.tasks.map(shapeTask),
    decisions: raw.decisions.map(shapeDecision),
    queries: raw.queries.map(q => ({ name: qName(q.name), g: memKind(q.g), about: aboutLine(q.about), write: q.write === true })),
  };
}
