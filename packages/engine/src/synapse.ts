import { ALL, onQuery, projectGraph, project as P, run, synapse as SY, why as W } from '@moovi/graph';
import { blocking, redis } from './bus';
import type { AgentId } from './events';
import { memKind, qName, shapeEvents, shapeSnapshot, label, type SynEvent, type SynSnapshot } from './synapse-shape';

/**
 * The synapse feed (the studio's live FalkorDB view). Every named query a task runs (live.ts scopes each task to its
 * project, chat, agent and, inside a preset, the agent whose stage is on) becomes one tiny event; so does each step an
 * agent starts or ends. Events are batched per chat and written to one Redis stream per chat (`ce:syn:<chat>`) a few
 * times a second, so the render never waits on it. When the run ends, its events are kept in the project graph
 * (queries/synapse.ts) and a finished video replays from there. Only names, counts and times go in (synapse-shape.ts).
 */
type Client = Awaited<ReturnType<typeof blocking>>;
export const synStream = (chat: string) => `ce:syn:${chat}`;
const FLUSH_MS = 350;
const KEEP_EVENTS = 5000;
/** the feed's own queries are not part of the synapse */
const SELF = new Set(Object.keys(SY));

/**
 * Whose job each named query is (the PIPELINE.html roles). A one-task preset (Edit, Launch, Showreel) runs every step
 * under one agent's task, so a call is credited to the agent whose role that query serves; a query not named here stays
 * with the agent whose stage or task ran it.
 */
const ROLES: Partial<Record<AgentId, string[]>> = {
  sound: ['assetsForEvent', 'tracksByMood', 'tracks', 'downbeats', 'recentBeds', 'castVoice', 'voiceSpoken', 'voiceHistory', 'rejectVoice', 'whyVoice', 'voiceMix', 'preferredVoice', 'rejectedVoices'],
  designer: ['editCast', 'assetsForStyle', 'assetsByCategory', 'assetsServing', 'assetsByX1', 'styleCast', 'assetById', 'transitionForCut', 'transitionFamily', 'resolveAsset',
    'kits', 'kitParts', 'kitsServing', 'assetKits', 'referenceParts', 'references', 'assetOrigins', 'kitOrigins', 'typesAll', 'typeKit',
    'artifactsServing', 'artifactRatings', 'layoutRatings', 'artifactNeeds', 'artifactUsage', 'artifactsInRun', 'useArtifact', 'clearArtifacts', 'useLook3d', 'looksInRun', 'look3dUsage',
    'saveScene', 'scenes', 'recipes', 'signatures', 'styles', 'stylePresets', 'presetFlows', 'defaultStage', 'styleDecks', 'allProps', 'candidates',
    'launchParts', 'launchPartStory', 'launchReferences', 'launchServing', 'launchRecentLooks', 'launchPartUse', 'boardPaths', 'latticeNodes', 'latticeEdges', 'clearLattice', 'coCast', 'grownSetups', 'growSetup'],
  lens: ['lawsAndChecks', 'openIssues', 'raiseIssue', 'resolveIssue', 'scoreScene', 'weakScenes', 'overUsed', 'recentFilms', 'styleStats', 'unshippable', 'assetCredits', 'licenceMix'],
  keeper: ['recordDecision', 'decide', 'recordVideo', 'recordAssets', 'recordSequence', 'rememberFilm', 'launchFilmParts', 'writeLesson', 'supersedeLesson', 'lessonsFor', 'lessonsOnTopic',
    'lessonTimeline', 'setPreference', 'preferences', 'recordFeedback', 'linkFeedbackScene', 'noteFeedback', 'noteFeedbackScene', 'feedbackOnRun', 'rejectedStyles', 'rejectedShots',
    'rewrittenLines', 'captionNotes', 'styleTaste', 'feedbackTrail', 'overUse', 'anglesUsed', 'assetUsed', 'whyThis', 'decisionsOfRun', 'filmArc', 'filmSite', 'filmStory'],
  writer: ['writeClaim', 'truthGuard', 'judgeClaim', 'supersedeClaims', 'claims', 'factSearch', 'facts', 'skillFor'],
  researcher: ['writeSources', 'writeFacts', 'writePage', 'writeShots', 'factOnPage', 'runShots', 'factProof', 'claimEvidence', 'writeClips', 'useClip', 'clipSeen', 'clipCredits', 'clipRejects', 'writeAsset', 'showPlace', 'placesInRun', 'placeUsage'],
};
const ROLE_OF = new Map(Object.entries(ROLES).flatMap(([a, qs]) => qs!.map(q => [q, a as AgentId] as const)));
/** who made a call: the query's role, else the agent whose stage is on, else the task's agent */
export const creditOf = (name: string, where: { agent: AgentId; stage?: AgentId }): AgentId => ROLE_OF.get(name) ?? where.stage ?? where.agent;

interface Where { project: string; chat: string; agent: AgentId; stage?: AgentId; task: string }
const pending = new Map<string, SynEvent[]>();
let timer: ReturnType<typeof setTimeout> | null = null;

const runOf = (task: string) => (task.includes(':') ? task.slice(0, task.indexOf(':')) : task);

function push(chat: string, ev: SynEvent) {
  const list = pending.get(chat) ?? [];
  list.push(ev);
  pending.set(chat, list);
  if (!timer) timer = setTimeout(() => { timer = null; void flush(); }, FLUSH_MS);
}

/** Write what is waiting, one stream entry per chat (a batch). */
export async function flush() {
  if (!pending.size) return;
  const batches = [...pending]; pending.clear();
  try {
    const r = await redis();
    for (const [chat, evs] of batches) {
      await r.xAdd(synStream(chat), '*', { e: JSON.stringify(evs) }, { TRIM: { strategy: 'MAXLEN', strategyModifier: '~', threshold: 3000 } });
      await r.expire(synStream(chat), 14 * 86400);
    }
  } catch { /* the feed never breaks a run */ }
}

let hooked = false;
/** Start recording (the worker calls this once). `where` is live.ts's scope of the task the query runs in. */
export function recordSynapse(where: () => Where | undefined) {
  if (hooked) return; hooked = true;
  onQuery(e => {
    if (SELF.has(e.name)) return;
    const s = where();
    if (!s) return;
    push(s.chat, { t: e.at, r: runOf(s.task), a: creditOf(e.name, s), k: 'q', q: qName(e.name), g: memKind(e.graph), n: e.rows, ms: e.ms, ...(e.ro ? {} : { w: 1 as const }), ...(e.error ? { e: 1 as const } : {}) });
  });
}

/** An agent's step (a task or a preset stage started, finished or failed), from live.ts's activity rows. */
export function noteStep(chat: string, agent: AgentId, task: string, kind: 'start' | 'done' | 'fail' | 'line', text: string) {
  if (!hooked) return;
  push(chat, { t: Date.now(), r: runOf(task), a: agent, k: 's', x: kind, s: kind === 'fail' ? 'failed' : label(text) ?? (kind === 'done' ? 'done' : 'working') });
}

type XRow = { id: string; message: Record<string, string> };
const batchOf = (x: XRow): SynEvent[] => { try { return shapeEvents(JSON.parse(x.message.e ?? '[]')); } catch { return []; } };

/** Every event of a chat's stream (optionally one run's), and the stream id to follow on from. */
async function streamed(chat: string, runId?: string): Promise<{ events: SynEvent[]; seq: string }> {
  const r = await redis();
  const rows = (await r.xRange(synStream(chat), '-', '+')) as XRow[];
  const events = rows.flatMap(batchOf).filter(e => !runId || e.r === runId.replace(/[^A-Za-z0-9]/g, '').slice(-6));
  return { events: events.slice(-KEEP_EVENTS), seq: rows.at(-1)?.id ?? '0' };
}

/** Wait for new batches after `after` (use a `blocking()` connection). */
export async function followSynapse(conn: Client, chat: string, after: string, blockMs = 15000): Promise<{ events: SynEvent[]; seq: string }> {
  const reply = await conn.xRead({ key: synStream(chat), id: after }, { BLOCK: blockMs, COUNT: 200 });
  const rep = reply as unknown;
  const rows: XRow[] = !rep ? [] : Array.isArray(rep) ? (rep as { messages?: XRow[] }[]).flatMap(s => s.messages ?? []) : Object.values(rep as Record<string, XRow[]>).flat();
  return { events: rows.flatMap(batchOf), seq: rows.at(-1)?.id ?? after };
}

/** The run ended: keep its synapse in the project graph (events plus one CALLED edge per agent and query). */
export async function keepSynapse(pid: string, chat: string, runId: string) {
  try {
    await flush();
    const { events } = await streamed(chat, runId);
    const calls = new Map<string, { agent: string; name: string; graph: string; n: number; rows: number; ms: number }>();
    for (const e of events) {
      if (e.k !== 'q') continue;
      const key = `${e.a}|${e.q}|${e.g}`;
      const c = calls.get(key) ?? { agent: e.a, name: e.q!, graph: e.g!, n: 0, rows: 0, ms: 0 };
      c.n++; c.rows += e.n ?? 0; c.ms = +(c.ms + (e.ms ?? 0)).toFixed(1);
      calls.set(key, c);
    }
    await run(projectGraph(pid), SY.saveSynapse, { run: runId, events: JSON.stringify(events), n: events.length, at: Date.now(), calls: [...calls.values()] });
  } catch (e) { console.error('[synapse] keep failed', e instanceof Error ? e.message : e); }
}

const ABOUT = new Map(ALL.map(x => [x.query.name, { about: x.query.about, write: !x.query.ro, g: x.graph === 'user' ? 'you' : x.graph }]));
const ENDED = new Set(['done', 'failed', 'cancelled']);

/**
 * One chat's synapse for the view: its runs, the chosen (or latest) run's events (kept in FalkorDB once it ended, else
 * from the live stream), its task board, its decisions and their causes. Whitelisted by shapeSnapshot. The caller has
 * already checked the signed-in user owns `pid`; the chat must be in that project.
 */
export async function synapseSnapshot(pid: string, chat: string, runPick?: string | null): Promise<SynSnapshot | null> {
  const g = projectGraph(pid);
  const [c] = await run<{ id: string }>(g, P.chat, { id: chat });
  if (!c) return null;
  const runs = await run<Record<string, unknown>>(g, SY.runsOfChat, { chat });
  const pick = runPick ? runs.find(r => String(r.id).endsWith(runPick)) : runs[0];
  const live = await streamed(chat);
  if (!pick) return shapeSnapshot({ project: pid, runs, run: null, seq: live.seq, kept: false, events: [], tasks: [], decisions: [], queries: [] });
  const rid = String(pick.id);
  let events: SynEvent[] = live.events.filter(e => e.r === rid.replace(/[^A-Za-z0-9]/g, '').slice(-6));
  let kept = false;
  if (ENDED.has(String(pick.status))) {
    const [s] = await run<{ events: string | null }>(g, SY.synapseOf, { run: rid });
    if (s?.events) { try { events = shapeEvents(JSON.parse(s.events)); kept = true; } catch { /* the stream's copy stands */ } }
  }
  const [tasks, decisions] = await Promise.all([run<Record<string, unknown>>(g, P.board, { run: rid }), run<Record<string, unknown>>(g, W.decisionsOfRun, { run: rid })]);
  // runs kept before the roles were credited read with them too
  events = events.map(e => (e.k === 'q' && e.q && ROLE_OF.has(e.q) ? { ...e, a: ROLE_OF.get(e.q)! } : e));
  const names = [...new Set(events.filter(e => e.k === 'q').map(e => e.q!))];
  const queries = names.map(name => { const a = ABOUT.get(name); return { name, g: a?.g ?? 'other', about: a?.about ?? '', write: a?.write ?? false }; });
  return shapeSnapshot({ project: pid, runs, run: pick, seq: live.seq, kept, events, tasks, decisions, queries });
}

