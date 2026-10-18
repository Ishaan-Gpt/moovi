import { AGENT_IDS, AGENT_NAMES, type AgentId } from '@moovi/engine/events';
import type { MemKind, SynDecision, SynEvent, SynSnapshot } from '@moovi/engine/synapse-shape';

/**
 * The synapse view's model: from a run's events (graph calls and agent steps) to what is on screen at time T, drawn as
 * nodes and lines (Ishaan's pick over swimlanes, 2026-10-18). Pure: no DOM. World units are a 1000 × 700 board; the view's camera pans and zooms over it.
 */
export const W = 1000, H = 700;

/** Memory names and what each holds (fixed copy; the graph's real name never reaches the browser). */
export const MEM: Record<MemKind, { name: string; about: string }> = {
  project: { name: 'This project', about: 'This video’s own graph: its chat, runs, tasks, scenes and every decision with its reasons.' },
  you: { name: 'Your memory', about: 'Your own graph: lessons from your notes, your preferences, what your videos already used.' },
  craft: { name: 'Craft library', about: 'The shared craft graph: about 950 library assets, styles and kits. Nothing about you.' },
  styles: { name: 'Style memory', about: 'What each style remembers across films: set-ups, arcs, what was over-used.' },
  sys: { name: 'Accounts', about: 'The index of accounts and projects.' },
  other: { name: 'Other', about: 'Another graph.' },
};
/** Fills from @moovi/brand only (tokens.css): each memory a different ice. */
export const MEM_FILL: Record<MemKind, string> = {
  project: '#7DB7EA', // frost-mid
  you: '#E3DEFF', // aurora lilac
  craft: '#D2F5EC', // aurora mint
  styles: '#A9D6F6', // frost-hi
  sys: '#E6F2FB', // ice-soft
  other: '#E3EBF3', // hairline
};
export const MEM_INK: Record<MemKind, string> = {
  project: '#2B67C6', you: '#3F6E9F', craft: '#3F6E9F', styles: '#3F6E9F', sys: '#5B6B80', other: '#5B6B80',
};

export interface Node {
  id: string; kind: 'agent' | 'mem' | 'query' | 'decision';
  x: number; y: number; r: number;
  label: string; agent?: AgentId; mem?: MemKind; query?: string; decision?: number;
  /** calls so far (agents, queries) */ n: number;
  /** last time something happened here (ms), for the flare */ hot: number;
  /** first call (queries) or when it was made (decisions), for the pop-in */ first?: number;
}
export interface Edge { from: string; to: string; n: number; hot: number; mem: MemKind }
export interface Pulse { from: string; to: string; p: number; mem: MemKind; write: boolean; err: boolean }

export interface Frame {
  nodes: Node[]; edges: Edge[]; pulses: Pulse[];
  /** the timeline */ t0: number; t1: number; T: number;
  counts: { calls: number; rows: number; writes: number; mems: number; queries: number };
  active: Set<AgentId>;
}

const PULSE_MS = 1100;

/** The run's time span: from its first event to its last (or now, while it runs). */
export function span(events: SynEvent[], live: boolean) {
  if (!events.length) return { t0: Date.now() - 1000, t1: Date.now() };
  const t0 = events[0]!.t, last = events.at(-1)!.t;
  return { t0, t1: live ? Math.max(last, Date.now()) : Math.max(last, t0 + 1000) };
}

/** Which memories to draw: the three a run always stands on, plus any other it touched. */
function memsOf(events: SynEvent[]): MemKind[] {
  const seen = new Set<MemKind>(['project', 'you', 'craft']);
  for (const e of events) if (e.k === 'q' && e.g) seen.add(e.g);
  return (['project', 'you', 'craft', 'styles', 'sys', 'other'] as MemKind[]).filter(m => seen.has(m));
}

/** Everything on screen at time T (events must be sorted by t). */
export function frame(snap: SynSnapshot, events: SynEvent[], T: number, live: boolean): Frame {
  const { t0, t1 } = span(events, live);
  const upTo = events.filter(e => e.t <= T);
  const mems = memsOf(events);
  const calls = upTo.filter(e => e.k === 'q');
  const counts = { calls: calls.length, rows: calls.reduce((s, e) => s + (e.n ?? 0), 0), writes: calls.filter(e => e.w).length, mems: new Set(calls.map(e => e.g)).size, queries: new Set(calls.map(e => `${e.g}|${e.q}`)).size };
  // who is working at T: started and not yet done
  const active = new Set<AgentId>();
  for (const e of upTo) if (e.k === 's') { if (e.x === 'start') active.add(e.a); else if (e.x === 'done' || e.x === 'fail') active.delete(e.a); }
  for (const e of upTo) if (e.k === 'q' && T - e.t < 2500) active.add(e.a);
  const base = { t0, t1, T, counts, active };
  return hubs(snap, events, upTo, mems, T, base);
}

/* ───────── nodes and lines: Moovi in the middle, the crew round him, the memories outside, queries budding on them ───────── */

const MEM_AT: Record<MemKind, [number, number]> = {
  project: [872, 350], you: [128, 350], craft: [500, 640], styles: [500, 62], sys: [138, 96], other: [862, 96],
};

function hubs(snap: SynSnapshot, all: SynEvent[], upTo: SynEvent[], mems: MemKind[], T: number, base: Omit<Frame, 'nodes' | 'edges' | 'pulses'>): Frame {
  const nodes: Node[] = [];
  const byId = new Map<string, Node>();
  const add = (n: Node) => { nodes.push(n); byId.set(n.id, n); return n; };
  // the crew: Moovi in the middle, the seven on a ring
  const crew = AGENT_IDS.filter(a => a !== 'moovi');
  add({ id: 'a:moovi', kind: 'agent', agent: 'moovi', x: 500, y: 350, r: 36, label: 'Moovi', n: 0, hot: 0 });
  crew.forEach((a, i) => {
    const ang = -Math.PI / 2 + (i + .5) * (Math.PI * 2 / crew.length);
    add({ id: `a:${a}`, kind: 'agent', agent: a, x: 500 + Math.cos(ang) * 205, y: 350 + Math.sin(ang) * 158, r: 22, label: AGENT_NAMES[a], n: 0, hot: 0 });
  });
  // the memories, and the queries the whole run calls budding round each (stable: every query has its place from t0)
  const qOf = new Map<MemKind, string[]>();
  for (const e of all) if (e.k === 'q') { const l = qOf.get(e.g!) ?? []; if (!l.includes(e.q!)) l.push(e.q!); qOf.set(e.g!, l); }
  for (const m of mems) {
    const qs = (qOf.get(m) ?? []).slice().sort();
    const [mx, my] = MEM_AT[m];
    const r = Math.min(66, 32 + Math.sqrt(qs.length) * 6.5);
    add({ id: `m:${m}`, kind: 'mem', mem: m, x: mx, y: my, r, label: MEM[m].name, n: 0, hot: 0 });
    // beads on the rim, facing the crew first; a second ring when there are many
    const face = Math.atan2(350 - my, 500 - mx);
    qs.forEach((q, i) => {
      const ring = i < 14 ? 0 : 1, k = ring ? i - 14 : i, per = ring ? Math.max(1, qs.length - 14) : Math.min(14, qs.length);
      const spread = Math.min(Math.PI * 1.75, per * .44);
      const ang = face + (per === 1 ? 0 : -spread / 2 + (k / (per - 1)) * spread);
      const rr = r + 15 + ring * 22;
      add({ id: `q:${m}:${q}`, kind: 'query', mem: m, query: q, x: mx + Math.cos(ang) * rr, y: my + Math.sin(ang) * rr, r: 6, label: q, n: 0, hot: 0 });
    });
  }
  // the decisions ("why this edit"): small diamonds just outside the agent who made them
  snap.decisions.forEach((d, i) => {
    if (d.t !== null && d.t > T) return;
    const a = byId.get(`a:${d.agent}`)!;
    const out = Math.atan2(a.y - 350, a.x - 500) || 0;
    const mine = snap.decisions.slice(0, i).filter(x => x.agent === d.agent).length;
    // never below the agent: its name and count sit there
    let ang = out + (mine - 1) * .42;
    if (Math.sin(ang) > .2) ang = -ang;
    const rr = a.r + 20 + (mine > 2 ? 16 : 0);
    add({ id: `d:${i}`, kind: 'decision', decision: i, agent: d.agent, x: a.x + Math.cos(ang) * rr, y: a.y + Math.sin(ang) * rr, r: 5.5, label: d.choice, n: 0, hot: d.t ?? 0, first: d.t ?? 0 });
  });
  // edges and pulses from the calls so far
  const edges = new Map<string, Edge>();
  const pulses: Pulse[] = [];
  for (const e of upTo) {
    const a = byId.get(`a:${e.a}`);
    if (!a) continue;
    if (e.k === 's') { if (e.x === 'start' && e.a !== 'moovi') hand(edges, pulses, 'a:moovi', a.id, e, T); continue; }
    const qn = byId.get(`q:${e.g}:${e.q}`), mn = byId.get(`m:${e.g}`);
    if (!qn || !mn) continue;
    a.n++; a.hot = Math.max(a.hot, e.t); if (!qn.n) qn.first = e.t; qn.n++; qn.hot = Math.max(qn.hot, e.t); mn.n++; mn.hot = Math.max(mn.hot, e.t);
    const key = `${a.id}>${qn.id}`;
    const ed = edges.get(key) ?? { from: a.id, to: qn.id, n: 0, hot: 0, mem: e.g! };
    ed.n++; ed.hot = e.t; edges.set(key, ed);
    if (T - e.t < PULSE_MS) pulses.push({ from: a.id, to: qn.id, p: (T - e.t) / PULSE_MS, mem: e.g!, write: !!e.w, err: !!e.e });
  }
  return { ...base, nodes, edges: [...edges.values()], pulses };
}

/** Moovi hands work to an agent: a faint edge and a pulse from the middle. */
function hand(edges: Map<string, Edge>, pulses: Pulse[], from: string, to: string, e: SynEvent, T: number) {
  const key = `${from}>${to}`;
  const ed = edges.get(key) ?? { from, to, n: 0, hot: 0, mem: 'project' as MemKind };
  ed.n++; ed.hot = e.t; edges.set(key, ed);
  if (T - e.t < PULSE_MS) pulses.push({ from, to, p: (T - e.t) / PULSE_MS, mem: 'project', write: false, err: false });
}

/* ───────── cards ───────── */

export type Pick = { kind: 'agent'; agent: AgentId } | { kind: 'mem'; mem: MemKind } | { kind: 'query'; mem: MemKind; query: string } | { kind: 'decision'; i: number } | { kind: 'call'; ev: SynEvent };

export function agentCard(snap: SynSnapshot, events: SynEvent[], T: number, a: AgentId) {
  const mine = events.filter(e => e.a === a && e.t <= T);
  const calls = mine.filter(e => e.k === 'q');
  const byMem = new Map<MemKind, number>();
  const byQ = new Map<string, { n: number; g: MemKind }>();
  for (const e of calls) { byMem.set(e.g!, (byMem.get(e.g!) ?? 0) + 1); const k = byQ.get(e.q!) ?? { n: 0, g: e.g! }; k.n++; byQ.set(e.q!, k); }
  const steps = mine.filter(e => e.k === 's' && e.x === 'start').map(e => e.s ?? '').filter((s, i, l) => s && l.indexOf(s) === i);
  return {
    calls: calls.length, rows: calls.reduce((s, e) => s + (e.n ?? 0), 0),
    byMem: [...byMem].sort((x, y) => y[1] - x[1]),
    top: [...byQ].sort((x, y) => y[1].n - x[1].n).slice(0, 6),
    steps: steps.slice(-6),
    tasks: snap.tasks.filter(t => t.agent === a),
    decisions: snap.decisions.map((d, i) => ({ d, i })).filter(x => x.d.agent === a && (x.d.t === null || x.d.t <= T)),
  };
}
export function queryCard(snap: SynSnapshot, events: SynEvent[], T: number, mem: MemKind, query: string) {
  const calls = events.filter(e => e.k === 'q' && e.q === query && e.g === mem && e.t <= T);
  const who = new Map<AgentId, number>();
  for (const e of calls) who.set(e.a, (who.get(e.a) ?? 0) + 1);
  const meta = snap.queries.find(q => q.name === query);
  return { calls: calls.length, rows: calls.reduce((s, e) => s + (e.n ?? 0), 0), ms: calls.length ? calls.reduce((s, e) => s + (e.ms ?? 0), 0) / calls.length : 0,
    write: meta?.write ?? calls.some(e => e.w), about: meta?.about ?? '', who: [...who].sort((x, y) => y[1] - x[1]) };
}
export function memCard(events: SynEvent[], T: number, mem: MemKind) {
  const calls = events.filter(e => e.k === 'q' && e.g === mem && e.t <= T);
  const byQ = new Map<string, number>();
  for (const e of calls) byQ.set(e.q!, (byQ.get(e.q!) ?? 0) + 1);
  return { calls: calls.length, rows: calls.reduce((s, e) => s + (e.n ?? 0), 0), writes: calls.filter(e => e.w).length, top: [...byQ].sort((x, y) => y[1] - x[1]).slice(0, 8) };
}
export const decisionOf = (snap: SynSnapshot, i: number): SynDecision | undefined => snap.decisions[i];
