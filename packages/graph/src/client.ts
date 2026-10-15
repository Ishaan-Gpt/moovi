import { FalkorDB } from 'falkordb';

/**
 * The one connection to Moovi's memory. Every query goes through `read` (GRAPH.RO_QUERY: the server refuses
 * writes) or `write`, always with a timeout, always timed, always observable: the studio shows the real Cypher
 * behind every step. If FalkorDB is unreachable we throw `MemoryDown` and the crew refuses to work.
 */

export class MemoryDown extends Error {
  constructor(cause: unknown) {
    super(`Moovi has no memory: FalkorDB is unreachable (${why(cause)})`);
    this.name = 'MemoryDown';
  }
}

/** Socket errors often arrive as an AggregateError with an empty message; dig out something a human can read. */
function why(e: unknown): string {
  if (!(e instanceof Error)) return String(e);
  const x = e as Error & { code?: string; errors?: unknown[]; cause?: unknown };
  if (x.message) return x.message;
  if (x.code) return x.code;
  if (x.errors?.length) return why(x.errors[0]);
  if (x.cause) return why(x.cause);
  return x.name;
}

export interface QueryEvent {
  graph: string;
  /** a stable name from the query library, e.g. "truthGuard" */
  name: string;
  cypher: string;
  params: Record<string, unknown>;
  ro: boolean;
  ms: number;
  rows: number;
  at: number;
  error?: string;
}

type Params = Record<string, unknown>;

const url = () => process.env.FALKORDB_URL ?? 'falkor://localhost:6379';
let conn: Promise<FalkorDB> | null = null;

async function db(): Promise<FalkorDB> {
  if (!conn) {
    conn = FalkorDB.connect({ url: url(), socket: { connectTimeout: 2500, reconnectStrategy: false } as never })
      .then(d => {
        // a dropped connection must surface on the next query, not hang it
        (d as unknown as { on?: (e: string, f: (err: unknown) => void) => void }).on?.('error', () => { conn = null; });
        return d;
      })
      .catch(e => { conn = null; throw new MemoryDown(e); });
  }
  return conn;
}

// process-wide: bundlers may load this module more than once (one copy per route), but there is one log
const G = globalThis as unknown as { __graphListeners?: Set<(e: QueryEvent) => void>; __graphRecent?: QueryEvent[] };
const listeners: Set<(e: QueryEvent) => void> = (G.__graphListeners ??= new Set());
/** Observe every query (the crew forwards these to the studio as graph events). */
export function onQuery(fn: (e: QueryEvent) => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }

const recent: QueryEvent[] = (G.__graphRecent ??= []);
/** The last few hundred queries, for latency numbers (p50 / p95 per query name). */
export function queryLog() { return recent.slice(); }

async function run<T>(graph: string, name: string, cypher: string, params: Params, ro: boolean, timeoutMs: number): Promise<T[]> {
  const t0 = performance.now();
  let rows: T[] = [];
  let error: string | undefined;
  try {
    const g = (await db()).selectGraph(graph);
    const opts = { params: params as never, TIMEOUT: timeoutMs };
    const reply = ro ? await g.roQuery<T>(cypher, opts) : await g.query<T>(cypher, opts);
    rows = reply.data ?? [];
    return rows;
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
    if (e instanceof MemoryDown) throw e;
    if (/ECONNREFUSED|ENOTFOUND|socket|closed|connect/i.test(error)) { conn = null; throw new MemoryDown(e); }
    throw new Error(`[${graph}] ${name} failed: ${error}`);
  } finally {
    const ev: QueryEvent = { graph, name, cypher: cypher.trim(), params, ro, ms: +(performance.now() - t0).toFixed(2), rows: rows.length, at: Date.now(), error };
    recent.push(ev);
    if (recent.length > 600) recent.shift();
    listeners.forEach(fn => { try { fn(ev); } catch { /* a listener never breaks a query */ } });
  }
}

/** Read-only query (server-enforced). */
export const read = <T = Record<string, unknown>>(graph: string, name: string, cypher: string, params: Params = {}, timeoutMs = 2500) =>
  run<T>(graph, name, cypher, params, true, timeoutMs);

/** Write query. Seeds and agents' writes only; every write is idempotent (MERGE) where it can be. */
export const write = <T = Record<string, unknown>>(graph: string, name: string, cypher: string, params: Params = {}, timeoutMs = 6000) =>
  run<T>(graph, name, cypher, params, false, timeoutMs);

/** Is the memory up? Used by the studio's status pill and by the crew before every run (the kill test). */
export async function health(): Promise<{ ok: boolean; ms: number; graphs?: string[]; error?: string }> {
  const t0 = performance.now();
  try {
    const d = await db();
    const graphs = await Promise.race([
      d.list(),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 4000)),
    ]);
    return { ok: true, ms: +(performance.now() - t0).toFixed(1), graphs };
  } catch (e) {
    conn = null;
    return { ok: false, ms: +(performance.now() - t0).toFixed(1), error: e instanceof Error ? e.message : String(e) };
  }
}

export async function listGraphs() { return (await db()).list(); }
export async function dropGraph(graph: string) {
  const d = await db();
  if ((await d.list()).includes(graph)) await d.selectGraph(graph).delete();
}
export async function closeMemory() { const c = conn; conn = null; if (c) await (await c).close(); }

/**
 * Graph names (FalkorDB's multi-tenancy: one server, isolated graphs).
 * - `craft`: style and craft knowledge only, shared by everyone, never anything about a user or a brand.
 * - `sys`: accounts, sessions and the index of who owns which project.
 * - `user_<uid>`: one per user: lessons, preferences, the assets and angles their videos already used.
 * - `proj_<pid>`: one per project: its chats, videos, runs, tasks, facts, claims, decisions, issues, scenes.
 */
export const CRAFT = 'craft';
export const SYS = 'sys';
/** what every reel style remembers (films, set-ups, arcs, sites, kept improvisations): queries/styles.ts */
export const STYLES = 'styles';
const safeId = (id: string) => {
  const s = id.replace(/[^a-z0-9]/gi, '').toLowerCase();
  if (!s || s.length > 40) throw new Error(`Bad graph id "${id}"`);
  return s;
};
export const userGraph = (uid: string) => `user_${safeId(uid)}`;
export const projectGraph = (pid: string) => `proj_${safeId(pid)}`;
