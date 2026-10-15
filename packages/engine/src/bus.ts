import { createClient } from 'redis';
import { config } from './config';
import { ACTIVE, COMMANDS, chatStream, readyQueue, type Command } from './commands';
import type { ChatEvent, Stamped } from './events';

/**
 * The bus, on the FalkorDB server's Redis side:
 * - one stream per chat (`ce:chat:<id>`): every event the studio draws from, kept (trimmed to the last ~5000), so a
 *   reconnecting browser replays from its last id and a restarted server loses nothing;
 * - one command stream (`ce:cmd`) read by the engine's consumer group;
 * - one ready queue per resource (`ce:q:<resource>`): pointers to tasks whose state lives in the project graph.
 * Blocking reads get their own connection each.
 */
type Client = ReturnType<typeof createClient>;
const G = globalThis as unknown as { __ceBus?: Promise<Client> };

export function redis(): Promise<Client> {
  if (!G.__ceBus) {
    const c = createClient({ url: config.redis, socket: { connectTimeout: 3000, reconnectStrategy: n => Math.min(n * 200, 3000) } });
    c.on('error', () => { /* reconnects; callers see the failure on their next command */ });
    G.__ceBus = c.connect().then(() => c).catch(e => { G.__ceBus = undefined; throw e; });
  }
  return G.__ceBus;
}

/** A dedicated connection for blocking reads (one per long-lived reader). */
export async function blocking(): Promise<Client> {
  const c = createClient({ url: config.redis, socket: { connectTimeout: 3000, reconnectStrategy: n => Math.min(n * 200, 3000) } });
  c.on('error', () => undefined);
  await c.connect();
  return c;
}

/* ───────── chat event streams ───────── */

export async function publish(chat: string, ev: ChatEvent): Promise<string> {
  const r = await redis();
  return r.xAdd(chatStream(chat), '*', { e: JSON.stringify({ ...ev, at: Date.now() }) }, { TRIM: { strategy: 'MAXLEN', strategyModifier: '~', threshold: 5000 } });
}

type XEntries = { id: string; message: Record<string, string> }[];
function entries(reply: unknown): XEntries {
  if (!reply) return [];
  // RESP2: [{ name, messages: [{ id, message }] }]; RESP3 maps: { key: [{ id, message }] }
  if (Array.isArray(reply)) return reply.flatMap((s: { messages?: XEntries }) => s.messages ?? []);
  if (typeof reply === 'object') return Object.values(reply as Record<string, XEntries>).flat();
  return [];
}
const parse = (x: { id: string; message: Record<string, string> }): Stamped | null => {
  try { return { ...(JSON.parse(x.message.e ?? 'null') as ChatEvent & { at: number }), seq: x.id }; } catch { return null; }
};

/** Everything after `after` (a stream id; '0' = from the start), without waiting. */
export async function history(chat: string, after = '0', count = 2000): Promise<Stamped[]> {
  const r = await redis();
  const rows = await r.xRange(chatStream(chat), after === '0' ? '-' : `(${after}`, '+', { COUNT: count });
  return rows.map(parse).filter((x): x is Stamped => !!x);
}

/** Wait up to `blockMs` for events after `after` on a chat (use a `blocking()` connection). */
export async function follow(conn: Client, chat: string, after: string, blockMs = 15000): Promise<Stamped[]> {
  const reply = await conn.xRead({ key: chatStream(chat), id: after }, { BLOCK: blockMs, COUNT: 500 });
  return entries(reply).map(parse).filter((x): x is Stamped => !!x);
}

/* ───────── commands (studio → engine) ───────── */

export async function sendCommand(cmd: Command): Promise<string> {
  const r = await redis();
  return r.xAdd(COMMANDS, '*', { c: JSON.stringify(cmd) }, { TRIM: { strategy: 'MAXLEN', strategyModifier: '~', threshold: 10000 } });
}

/** The engine's command loop: a consumer group, so a command is handled once and redelivered if the worker died. */
export async function consumeCommands(consumer: string, handle: (cmd: Command) => Promise<void>, stop: () => boolean) {
  const conn = await blocking();
  try { await conn.xGroupCreate(COMMANDS, 'engine', '0', { MKSTREAM: true }); } catch (e) { if (!/BUSYGROUP/.test(String(e))) throw e; }
  // first our own pending (delivered before a crash, never acked), then new ones
  let id = '0';
  while (!stop()) {
    const reply = await conn.xReadGroup('engine', consumer, { key: COMMANDS, id }, { BLOCK: 5000, COUNT: 10 });
    const rows = entries(reply);
    if (id === '0' && !rows.length) { id = '>'; continue; }
    for (const row of rows) {
      try { await handle(JSON.parse(row.message.c ?? '{}') as Command); }
      catch (e) { console.error('[engine] command failed', e); }
      await conn.xAck(COMMANDS, 'engine', row.id);
    }
  }
  await conn.quit();
}

/* ───────── ready queues (the scheduler's pointers) ───────── */

export interface Ready { project: string; task: string }
export async function enqueue(resource: string, item: Ready) {
  const r = await redis();
  await r.lPush(readyQueue(resource), JSON.stringify(item));
}
export async function dequeue(conn: Client, resource: string, timeoutS = 2): Promise<Ready | null> {
  const v = await conn.brPop(readyQueue(resource), timeoutS);
  if (!v) return null;
  try { return JSON.parse((v as { element: string }).element) as Ready; } catch { return null; }
}

/** Projects with a run in flight (the worker re-queues their ready tasks after a restart). */
export async function markActive(project: string, on: boolean) {
  const r = await redis();
  if (on) await r.sAdd(ACTIVE, project); else await r.sRem(ACTIVE, project);
}
export async function activeProjects(): Promise<string[]> { return (await redis()).sMembers(ACTIVE); }

/** A simple fixed-window counter (login attempts). */
export async function hit(key: string, windowS: number): Promise<number> {
  const r = await redis();
  const n = await r.incr(key);
  if (n === 1) await r.expire(key, windowS);
  return n;
}
